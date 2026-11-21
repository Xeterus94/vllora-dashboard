import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  Eye,
  FileText,
  ImagePlus,
  LayoutTemplate,
  MapPin,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  documentLimit,
  fillFromSite,
  galleryLimit,
  hoursLimit,
  servicesLimit,
  type CmsFile,
  type CmsTextField,
  type EditorData,
  type SiteContent,
  type SiteImport,
} from '../../shared/site-content';
import {
  adminSite,
  ApiError,
  collection,
  message,
  request,
  uploadMedia,
  type MediaList,
  type Site,
} from '../lib/api';
import { brandStyle } from '../lib/brand';
import { Alert, Field, Panel, useAction } from './PortalUI';
import { FilePicker } from './FilePicker';

const sections = [
  ['intro', 'Prima pagină'],
  ['brand', 'Nume și culori'],
  ['services', 'Servicii și prețuri'],
  ['media', 'Galerie și fișiere'],
  ['contact', 'Program și contact'],
] as const;
type Slot = 'heroMedia' | 'logoMedia' | 'gallery' | 'documents';
const singleImage = (slot: Slot): slot is 'heroMedia' | 'logoMedia' =>
  slot === 'heroMedia' || slot === 'logoMedia';
const hexColor = (value: string) => /^#[a-f0-9]{6}$/i.test(value);
const fileLimit = {
  heroMedia: 1,
  logoMedia: 1,
  gallery: galleryLimit,
  documents: documentLimit,
};
const move = <T,>(rows: T[], index: number, step: number) => {
  const next = rows.slice();
  [next[index], next[index + step]] = [next[index + step], next[index]];
  return next;
};
const update = <T,>(rows: T[], index: number, row: T) =>
  rows.map((old, i) => (i === index ? row : old));
const remove = <T,>(rows: T[], index: number) =>
  rows.filter((_, i) => i !== index);

function RowActions({
  name,
  index,
  length,
  onRemove,
  onMove,
}: {
  name: string;
  index: number;
  length: number;
  onRemove: () => void;
  onMove?: (step: number) => void;
}) {
  return (
    <div className="controls cms-row-actions">
      {onMove && (
        <>
          <button
            type="button"
            className="button secondary small"
            title={`Mută în sus: ${name}`}
            aria-label={`Mută în sus: ${name}`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="button secondary small"
            title={`Mută în jos: ${name}`}
            aria-label={`Mută în jos: ${name}`}
            disabled={index === length - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={15} />
          </button>
        </>
      )}
      <button
        type="button"
        className="button danger small"
        title={`Elimină: ${name}`}
        aria-label={`Elimină: ${name}`}
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export function SiteEditor({
  site,
  onDirty,
  staff = false,
}: {
  site: Site;
  staff?: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const editorPath = `${staff ? adminSite(site.id) : '/portal'}/content`;
  const mediaPath = collection(staff ? site.id : undefined);
  const [data, setData] = useState<EditorData>(),
    [draft, setDraft] = useState<SiteContent>();
  const [media, setMedia] = useState<CmsFile[]>([]),
    [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0),
    [section, setSection] = useState<(typeof sections)[number][0]>('intro');
  const [preview, setPreview] = useState(false),
    [notice, setNotice] = useState('');
  const [busyLabel, setBusyLabel] = useState('');
  const action = useAction();
  const dirty =
    !!data && JSON.stringify(data.content) !== JSON.stringify(draft);
  useEffect(() => {
    let active = true;
    request<EditorData>(editorPath).then(
      (result) => {
        if (!active) return;
        setData(result);
        setDraft(result.content);
        setLoadError('');
      },
      (error) => {
        if (active) setLoadError(message(error));
      },
    );
    request<MediaList>(mediaPath).then(
      (result) => {
        if (active) setMedia(result.items);
      },
      () => {
        /* Upload is still available if listing fails. */
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, editorPath, mediaPath]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const reload = () => {
    if (
      dirty &&
      !confirm('Reîncarci editorul și renunți la modificările nepublicate?')
    )
      return;
    setLoadError('');
    setData(undefined);
    setDraft(undefined);
    setNotice('');
    action.setError('');
    setAttempt((n) => n + 1);
  };
  if (!data || !draft)
    return (
      <Panel title="Editor site">
        {loadError ? (
          <>
            <Alert>{loadError}</Alert>
            <button className="button secondary" onClick={reload}>
              Reîncearcă
            </button>
          </>
        ) : (
          <p role="status">Se încarcă editorul…</p>
        )}
      </Panel>
    );
  const edit = (patch: Partial<SiteContent>) => {
    setDraft((previous) => previous && { ...previous, ...patch });
    setNotice('');
  };
  const importFromSite = () => {
    setNotice('');
    setBusyLabel('Se caută conținutul public…');
    void action.run(async () => {
      const source = await request<SiteImport>(`${editorPath}/import`, 'POST');
      const next = fillFromSite(draft, source);
      setDraft(next);
      setNotice(
        JSON.stringify(next) === JSON.stringify(draft)
          ? 'Nu există câmpuri goale de completat cu datele detectate. Nu am înlocuit nimic.'
          : `Date ${source.source === 'manifest' ? 'preluate din manifestul site-ului' : 'detectate pe pagina publică'} adăugate în editor. Verifică și publică atunci când sunt corecte.`,
      );
    });
  };
  const field = (
    name: CmsTextField,
    label: string,
    options?: { long?: boolean; url?: boolean },
  ) => (
    <Field label={label}>
      {options?.long ? (
        <textarea
          rows={4}
          maxLength={name === 'aboutText' ? 3000 : 1200}
          value={draft[name]}
          onChange={(e) => edit({ [name]: e.target.value })}
        />
      ) : (
        <input
          type={options?.url ? 'url' : 'text'}
          maxLength={options?.url ? 2048 : name === 'siteName' ? 100 : 1200}
          value={draft[name]}
          onChange={(e) => edit({ [name]: e.target.value })}
        />
      )}
    </Field>
  );
  const attach = (slot: Slot, files: CmsFile[]) => {
    const matching = files.filter((file) =>
      slot === 'documents'
        ? file.content_type === 'application/pdf'
        : file.content_type.startsWith('image/'),
    );
    if (!matching.length) return;
    if (singleImage(slot)) edit({ [slot]: matching[0] });
    else
      edit({
        [slot]: [
          ...new Map(
            [...draft[slot], ...matching].map((file) => [file.id, file]),
          ).values(),
        ].slice(0, fileLimit[slot]),
      });
  };
  const upload = (slot: Slot, files: File[]) => {
    const available = singleImage(slot)
      ? 1
      : fileLimit[slot] - draft[slot].length;
    if (files.length > available) {
      action.setError(
        `Mai poți adăuga ${available} fișier(e) în această secțiune.`,
      );
      return;
    }
    setBusyLabel('Se încarcă fișierele…');
    void action.run(async () => {
      const uploaded: CmsFile[] = [],
        errors: string[] = [];
      for (const file of files) {
        try {
          const isPdf =
            file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
          if (isPdf !== (slot === 'documents'))
            throw new Error(
              slot === 'documents'
                ? 'Alege un document PDF.'
                : 'Alege o imagine.',
            );
          const result = await uploadMedia(
            mediaPath,
            file,
            slot === 'logoMedia' ? 'logo' : 'gallery',
          );
          const valid =
            slot === 'documents'
              ? result.item.content_type === 'application/pdf'
              : result.item.content_type.startsWith('image/');
          if (!valid)
            throw new Error(
              'Fișierul nu se potrivește cu tipul acestei secțiuni.',
            );
          uploaded.push(result.item);
        } catch (error) {
          errors.push(`${file.name}: ${message(error)}`);
        }
      }
      setMedia((old) => [...uploaded, ...old]);
      attach(slot, uploaded);
      if (errors.length) throw new Error(errors.join(' · '));
      if (uploaded.length)
        setNotice(
          'Fișiere atașate în editor. Apasă „Publică modificările” ca să le adaugi în conținut.',
        );
    });
  };
  const picker = (slot: Slot, label: string) => {
    const files = singleImage(slot)
      ? draft[slot]
        ? [draft[slot]]
        : []
      : draft[slot];
    const options = media.filter(
      (file) =>
        !files.some((selected) => file.id === selected.id) &&
        (slot === 'documents'
          ? file.content_type === 'application/pdf'
          : file.content_type.startsWith('image/')),
    );
    const disabled =
      action.busy || (!singleImage(slot) && files.length >= fileLimit[slot]);
    return (
      <div className="cms-files stack">
        <div className="controls">
          <FilePicker
            label={label}
            onFiles={(files) => upload(slot, files)}
            multiple={!singleImage(slot)}
            disabled={disabled}
            accept={
              slot === 'documents' ? '.pdf,application/pdf' : 'image/*,.ico'
            }
          />
          {!!options.length && (
            <select
              aria-label={`Alege din bibliotecă: ${label}`}
              value=""
              disabled={disabled}
              onChange={(e) => {
                const file = options.find((item) => item.id === e.target.value);
                if (file) attach(slot, [file]);
              }}
            >
              <option value="">Alege din bibliotecă…</option>
              {options.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {files.length > 0 && (
          <div className="cms-attachments">
            {files.map((file, index) => (
              <div key={file.id} className="cms-attachment">
                {slot === 'documents' ? (
                  <FileText size={22} />
                ) : (
                  <img src={file.url} alt="" loading="lazy" />
                )}
                <span>{file.name}</span>
                <RowActions
                  name={file.name}
                  index={index}
                  length={files.length}
                  onRemove={() =>
                    singleImage(slot)
                      ? edit({ [slot]: null })
                      : edit({ [slot]: remove(draft[slot], index) })
                  }
                  onMove={
                    slot === 'gallery'
                      ? (step) =>
                          edit({ gallery: move(draft.gallery, index, step) })
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const publish = (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || action.busy) return;
    setNotice('');
    setBusyLabel('Se publică…');
    void action.run(async () => {
      try {
        const result = await request<EditorData>(editorPath, 'PUT', {
          content: draft,
          revision: data.revision,
        });
        setData(result);
        setDraft(result.content);
        setNotice(
          'Conținut publicat. Se afișează pe site în secțiunile conectate la CMS.',
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          throw new Error(
            'Sesiunea a expirat. Deschide portalul într-o filă nouă și autentifică-te înainte de a încerca din nou.',
          );
        throw error;
      }
    });
  };
  return (
    <section className="cms-editor stack" aria-labelledby="cms-title">
      <header className="cms-bar">
        <div>
          <span className="eyebrow">Conținutul site-ului</span>
          <h2 id="cms-title">
            <LayoutTemplate size={21} /> Editor site
          </h2>
          <p className="muted">
            Editează pe secțiuni, verifică previzualizarea, apoi publică.
          </p>
        </div>
        <div className="controls">
          <button
            type="button"
            className="button secondary"
            disabled={action.busy}
            onClick={importFromSite}
          >
            <Download size={17} /> Importă de pe site
          </button>
          <a
            className="button secondary"
            href={`https://${site.domain}`}
            target="_blank"
            rel="noreferrer"
          >
            Deschide site-ul <ExternalLink size={15} />
          </a>
          <button
            type="button"
            className="button secondary"
            aria-pressed={preview}
            onClick={() => setPreview((value) => !value)}
          >
            <Eye size={17} /> {preview ? 'Înapoi la editor' : 'Previzualizează'}
          </button>
        </div>
      </header>
      <p className="muted cms-info">
        Previzualizarea arată conținutul, nu designul exact al site-ului.
        Modificările apar public doar în secțiunile conectate la CMS. Fișierele
        încărcate nu sunt private. Pozele noi se comprimă automat în WebP.
        Importul completează doar câmpurile goale și păstrează imaginile ca
        linkuri către site-ul sursă.
      </p>
      {staff && site.status === 'suspended' && (
        <p className="muted">
          Site suspendat: conținutul salvat nu este disponibil public prin CMS
          până la reactivare.
        </p>
      )}
      <div className={`cms-grid${preview ? ' cms-preview-only' : ''}`}>
        <form onSubmit={publish} className="cms-form stack" hidden={preview}>
          <nav className="tabs" aria-label="Secțiuni editor">
            {sections.map(([id, name]) => (
              <button
                key={id}
                type="button"
                aria-current={section === id ? 'page' : undefined}
                onClick={() => setSection(id)}
              >
                {name}
              </button>
            ))}
          </nav>
          <fieldset disabled={action.busy} className="cms-fields stack">
            {section === 'intro' && (
              <>
                <Panel
                  title="Secțiunea principală"
                  description="Ce vede vizitatorul prima dată."
                >
                  {field('heroTitle', 'Titlu principal')}
                  {field('heroSubtitle', 'Subtitlu principal', { long: true })}
                  {picker('heroMedia', 'Atașează imagine principală')}
                  {field(
                    'heroImageUrl',
                    'Imagine principală din link (rezervă)',
                    { url: true },
                  )}
                  {field('announcement', 'Anunț')}
                  <div className="form-grid">
                    {field('bookingLabel', 'Text buton programări')}
                    {field('bookingUrl', 'Link programări (HTTPS)', {
                      url: true,
                    })}
                  </div>
                </Panel>
                <Panel title="Despre">
                  {field('aboutTitle', 'Titlu Despre')}
                  {field('aboutText', 'Text Despre', { long: true })}
                </Panel>
              </>
            )}
            {section === 'brand' && (
              <Panel
                title="Aspect și identitate"
                description="Aceste setări sunt pentru pagina publică. Nu schimbă sigla sau culorile panoului de autentificare."
              >
                {field('siteName', 'Numele public al site-ului')}
                {picker('logoMedia', 'Atașează sigla site-ului')}
                {field('logoUrl', 'Siglă din link (rezervă)', { url: true })}
                <div className="form-grid">
                  {(
                    [
                      ['primaryColor', 'Culoare principală'],
                      ['secondaryColor', 'Culoare secundară'],
                      ['accentColor', 'Culoare de accent'],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <span className="controls cms-color-control">
                        <input
                          type="color"
                          aria-label={`Alege: ${label}`}
                          value={hexColor(draft[key]) ? draft[key] : '#000000'}
                          onChange={(e) => edit({ [key]: e.target.value })}
                        />
                        <input
                          aria-label={`${label} (HEX)`}
                          value={draft[key]}
                          placeholder="#RRGGBB"
                          maxLength={7}
                          pattern="#[a-fA-F0-9]{6}"
                          onChange={(e) => edit({ [key]: e.target.value })}
                        />
                      </span>
                    </Field>
                  ))}
                  <Field label="Temă publică">
                    <select
                      value={draft.siteScheme}
                      onChange={(e) => edit({ siteScheme: e.target.value })}
                    >
                      <option value="">Păstrează tema site-ului</option>
                      <option value="light">Luminoasă</option>
                      <option value="dark">Întunecată</option>
                    </select>
                  </Field>
                </div>
              </Panel>
            )}
            {section === 'services' && (
              <Panel
                title="Servicii și prețuri"
                description="Adaugă servicii în ordinea în care vrei să le vadă clienții."
              >
                {draft.services.map((item, index) => (
                  <div key={index} className="cms-entry stack">
                    <div className="section-heading">
                      <strong>Serviciu {index + 1}</strong>
                      <RowActions
                        name={`serviciul ${index + 1}`}
                        index={index}
                        length={draft.services.length}
                        onRemove={() =>
                          edit({ services: remove(draft.services, index) })
                        }
                        onMove={(step) =>
                          edit({ services: move(draft.services, index, step) })
                        }
                      />
                    </div>
                    <div className="form-grid three">
                      {(
                        [
                          ['name', 'Nume serviciu', 100],
                          ['price', 'Preț', 80],
                          ['duration', 'Durată', 80],
                        ] as const
                      ).map(([key, label, length]) => (
                        <Field key={key} label={`${label} ${index + 1}`}>
                          <input
                            maxLength={length}
                            value={item[key]}
                            onChange={(e) =>
                              edit({
                                services: update(draft.services, index, {
                                  ...item,
                                  [key]: e.target.value,
                                }),
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <Field label={`Descriere serviciu ${index + 1}`}>
                      <textarea
                        rows={2}
                        maxLength={600}
                        value={item.description}
                        onChange={(e) =>
                          edit({
                            services: update(draft.services, index, {
                              ...item,
                              description: e.target.value,
                            }),
                          })
                        }
                      />
                    </Field>
                  </div>
                ))}
                <button
                  type="button"
                  className="button secondary"
                  disabled={draft.services.length >= servicesLimit}
                  onClick={() =>
                    edit({
                      services: [
                        ...draft.services,
                        { name: '', description: '', price: '', duration: '' },
                      ],
                    })
                  }
                >
                  <Plus size={16} /> Adaugă serviciu
                </button>
              </Panel>
            )}
            {section === 'media' && (
              <>
                <Panel
                  title="Galerie"
                  description="Selectează pozele de pe calculator sau din galeria telefonului."
                >
                  {picker('gallery', 'Atașează poze')}
                  {!!draft.images.length && (
                    <div className="cms-attachments">
                      {draft.images.map((url, i) => (
                        <div key={`${url}-${i}`} className="cms-attachment">
                          <img src={url} alt="" loading="lazy" />
                          <span>Imagine din link {i + 1}</span>
                          <RowActions
                            name={`imagine din link ${i + 1}`}
                            index={i}
                            length={draft.images.length}
                            onRemove={() =>
                              edit({ images: remove(draft.images, i) })
                            }
                            onMove={(step) =>
                              edit({ images: move(draft.images, i, step) })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel
                  title="Documente PDF"
                  description="De exemplu, o listă de prețuri sau un catalog de descărcat."
                >
                  {picker('documents', 'Atașează PDF')}
                </Panel>
              </>
            )}
            {section === 'contact' && (
              <>
                <Panel title="Program">
                  {draft.hours.map((item, index) => (
                    <div key={index} className="cms-entry stack">
                      <div className="section-heading">
                        <strong>Interval {index + 1}</strong>
                        <RowActions
                          name={`intervalul ${index + 1}`}
                          index={index}
                          length={draft.hours.length}
                          onRemove={() =>
                            edit({ hours: remove(draft.hours, index) })
                          }
                        />
                      </div>
                      <div className="form-grid">
                        {(
                          [
                            ['day', 'Zi', 80],
                            ['time', 'Interval', 120],
                          ] as const
                        ).map(([key, label, length]) => (
                          <Field key={key} label={`${label} ${index + 1}`}>
                            <input
                              maxLength={length}
                              value={item[key]}
                              onChange={(e) =>
                                edit({
                                  hours: update(draft.hours, index, {
                                    ...item,
                                    [key]: e.target.value,
                                  }),
                                })
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary"
                    disabled={draft.hours.length >= hoursLimit}
                    onClick={() =>
                      edit({ hours: [...draft.hours, { day: '', time: '' }] })
                    }
                  >
                    <Plus size={16} /> Adaugă interval
                  </button>
                </Panel>
                <Panel title="Date de contact">
                  <div className="form-grid">
                    {field('phone', 'Telefon')}
                    {field('whatsapp', 'WhatsApp')}
                    {field('email', 'Email public')}
                    {field('address', 'Adresă')}
                    {field('mapsUrl', 'Link hartă (HTTPS)', { url: true })}
                    {field('facebook', 'Facebook (HTTPS)', { url: true })}
                    {field('instagram', 'Instagram (HTTPS)', { url: true })}
                  </div>
                </Panel>
              </>
            )}
          </fieldset>
          {action.error && (
            <Alert>
              {action.error}{' '}
              <button type="button" className="text-button" onClick={reload}>
                Reîncarcă editorul
              </button>
            </Alert>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          <div className="cms-publish controls">
            <span className="muted">
              {action.busy
                ? busyLabel
                : dirty
                  ? 'Modificări nepublicate'
                  : 'Nicio modificare nepublicată'}
            </span>
            <button className="button primary" disabled={!dirty || action.busy}>
              <Save size={17} /> Publică modificările
            </button>
          </div>
        </form>
        <ContentPreview site={site} content={draft} />
      </div>
    </section>
  );
}

function ContentPreview({
  site,
  content,
}: {
  site: Site;
  content: SiteContent;
}) {
  const imageUrl = (value: string) => {
    try {
      return new URL(value).protocol === 'https:' ? value : '';
    } catch {
      return '';
    }
  };
  const hero = content.heroMedia?.url || imageUrl(content.heroImageUrl);
  const logo = content.logoMedia?.url || imageUrl(content.logoUrl);
  const brand = {
    ...site,
    primary_color: hexColor(content.primaryColor)
      ? content.primaryColor
      : site.primary_color,
    secondary_color: hexColor(content.secondaryColor)
      ? content.secondaryColor
      : site.secondary_color,
    accent_color: hexColor(content.accentColor)
      ? content.accentColor
      : site.accent_color,
    scheme:
      content.siteScheme === 'dark' || content.siteScheme === 'light'
        ? content.siteScheme
        : site.scheme,
  } as const;
  const images = [
    ...content.images,
    ...content.gallery.map((file) => file.url),
  ];
  return (
    <aside
      className={`cms-preview ${brand.scheme === 'dark' ? 'cms-preview-dark' : 'cms-preview-light'}`}
      style={brandStyle(brand)}
      aria-label="Previzualizare conținut"
    >
      <div className="cms-preview-chrome">
        <Eye size={16} /> <strong>Previzualizare</strong>
        <small>{site.domain}</small>
      </div>
      <div className="cms-preview-body">
        {content.announcement && (
          <p className="cms-preview-banner">{content.announcement}</p>
        )}
        {hero ? (
          <img
            className="cms-preview-image"
            src={hero}
            alt="Imagine principală"
          />
        ) : (
          <div className="cms-preview-image cms-preview-placeholder">
            <ImagePlus size={24} /> Imagine principală
          </div>
        )}
        <div className="cms-preview-copy">
          <div className="cms-preview-brand">
            {logo && <img src={logo} alt="" />}
            <span className="eyebrow">{content.siteName || site.name}</span>
          </div>
          <h3>{content.heroTitle || 'Titlul paginii tale'}</h3>
          <p>
            {content.heroSubtitle || 'Adaugă un subtitlu pentru vizitatori.'}
          </p>
          {content.bookingLabel && (
            <span className="cms-preview-cta">{content.bookingLabel}</span>
          )}
        </div>
        {(content.aboutTitle || content.aboutText) && (
          <div className="cms-preview-copy">
            <h4>{content.aboutTitle || 'Despre'}</h4>
            <p>{content.aboutText}</p>
          </div>
        )}
        {!!content.services.length && (
          <div className="cms-preview-copy">
            <h4>Servicii</h4>
            {content.services.map((item, i) => (
              <div className="cms-preview-row" key={i}>
                <div>
                  <strong>{item.name || `Serviciu ${i + 1}`}</strong>
                  <p className="muted">{item.description}</p>
                  <small>{item.duration}</small>
                </div>
                <strong>{item.price}</strong>
              </div>
            ))}
          </div>
        )}
        {!!images.length && (
          <div className="cms-preview-copy">
            <h4>Galerie</h4>
            <div className="cms-preview-gallery">
              {images.map((url, i) => (
                <img key={`${url}-${i}`} src={url} alt="" loading="lazy" />
              ))}
            </div>
          </div>
        )}
        {!!content.documents.length && (
          <div className="cms-preview-copy">
            <h4>Fișiere</h4>
            {content.documents.map((file) => (
              <p className="cms-preview-row" key={file.id}>
                <FileText size={16} /> {file.name}
              </p>
            ))}
          </div>
        )}
        {(content.address ||
          content.phone ||
          content.email ||
          !!content.hours.length) && (
          <div className="cms-preview-copy">
            <h4>
              <MapPin size={15} /> Contact și program
            </h4>
            <p>{content.address}</p>
            <p>{content.phone}</p>
            <p>{content.email}</p>
            {content.hours.map((item, i) => (
              <p className="cms-preview-row" key={i}>
                <strong>{item.day}</strong> {item.time}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
