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
  Monitor,
  PanelRight,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  discountMax,
  discountedPrice,
  documentLimit,
  companyFields,
  companyFieldSpec,
  fillFromSite,
  galleryLimit,
  hoursLimit,
  productLimit,
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
import { CompanyFields } from './CompanyFields';
import { FilePicker } from './FilePicker';
import { LiveSitePreview, PageFields } from './SitePages';
import { mergePages, type PageField } from '../../shared/site-pages';

const sections = [
  ['intro', 'Prima pagină'],
  ['brand', 'Nume și culori'],
  ['services', 'Servicii și prețuri'],
  ['products', 'Produse (magazin)'],
  ['media', 'Galerie și fișiere'],
  ['contact', 'Program și contact'],
  ['pages', 'Toate paginile'],
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
  onPublished,
  mediaAllowed = true,
}: {
  site: Site;
  onPublished?: (data: SiteContent) => void;
  staff?: boolean;
  // Without the media permission the API refuses every upload, so the pickers
  // are hidden and the library is never requested.
  mediaAllowed?: boolean;
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
  const [live, setLive] = useState(false),
    [pagePath, setPagePath] = useState('/');
  // The pinned preview keeps the editor and the real page side by side, which
  // is the default for staff: you always see the field you edit and its effect.
  // Side by side needs width; on phones the preview opens on demand so the
  // fields stay above the fold.
  const wide = () =>
    typeof window === 'undefined' ||
    window.matchMedia('(min-width: 1101px)').matches;
  const [pinned, setPinned] = useState(staff && wide()),
    [narrow, setNarrow] = useState(false),
    [previewLive, setPreviewLive] = useState(false);
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
        if (staff) {
          // Automatically fill only sites advertising the multipage integration.
          void request<SiteImport>(`${editorPath}/import?pages=1`, 'POST')
            .then((source) => {
              const pages = source.pages;
              if (active && pages?.length)
                setDraft(
                  (previous) =>
                    previous &&
                    (previous.pages?.length
                      ? {
                          ...previous,
                          pages: mergePages(previous.pages, pages),
                        }
                      : fillFromSite(previous, source)),
                );
            })
            .catch(() => {
              /* Legacy sites still support manual import. */
            });
        }
      },
      (error) => {
        if (active) setLoadError(message(error));
      },
    );
    if (mediaAllowed)
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
  }, [attempt, editorPath, mediaPath, staff, mediaAllowed]);
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
      const next = fillFromSite(
        draft,
        staff ? source : { ...source, pages: undefined },
      );
      setDraft(next);
      if (staff && source.pages?.length) setSection('pages');
      setNotice(
        JSON.stringify(next) === JSON.stringify(draft)
          ? 'Nu există câmpuri goale de completat cu datele detectate. Nu am înlocuit nimic.'
          : `Date ${source.source === 'manifest' ? 'preluate din manifestul site-ului' : 'detectate pe pagina publică'} adăugate în editor. Verifică secțiunea ${staff && source.pages?.length ? '„Toate paginile”' : '„Galerie și fișiere”'}, apoi apasă „Publică modificările” ca să apară pe site.`,
      );
    });
  };
  const changePage = (path: string, changed: PageField) => {
    setDraft(
      (previous) =>
        previous && {
          ...previous,
          pages: previous.pages?.map((page) =>
            page.path === path
              ? {
                  ...page,
                  fields: page.fields.map((field) =>
                    field.id === changed.id ? changed : field,
                  ),
                }
              : page,
          ),
        },
    );
    setNotice('');
  };
  const uploadPageImage = (path: string, field: PageField, file: File) => {
    setBusyLabel('Se încarcă imaginea…');
    void action.run(async () => {
      const { item } = await uploadMedia(mediaPath, file, 'gallery');
      if (!item.content_type.startsWith('image/'))
        throw new Error('Alege o imagine.');
      setMedia((old) => [item, ...old]);
      changePage(path, { ...field, value: '', media: item });
    });
  };
  // Uploaded files plus every image already attached to a product, so a file
  // that is not in the first page of the library can still be reselected.
  const productLibrary = [
    ...new Map(
      [
        ...media.filter((file) => file.content_type.startsWith('image/')),
        ...(draft?.products ?? [])
          .map((product) => product.image)
          .filter((file): file is CmsFile => !!file),
      ].map((file) => [file.id, file]),
    ).values(),
  ];
  const uploadProductImage = (index: number, file: File) => {
    setBusyLabel('Se încarcă poza produsului…');
    void action.run(async () => {
      if (!file.type.startsWith('image/'))
        throw new Error('Alege o imagine pentru produs.');
      const { item } = await uploadMedia(mediaPath, file, 'gallery');
      setMedia((old) => [item, ...old]);
      setDraft(
        (previous) =>
          previous && {
            ...previous,
            products: update(previous.products, index, {
              ...previous.products[index],
              image: item,
              imageUrl: '',
            }),
          },
      );
      setNotice('');
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
          {mediaAllowed ? (
            <FilePicker
              label={label}
              onFiles={(files) => upload(slot, files)}
              multiple={!singleImage(slot)}
              disabled={disabled}
              accept={
                slot === 'documents' ? '.pdf,application/pdf' : 'image/*,.ico'
              }
            />
          ) : (
            <span className="cms-note">
              Pozele se schimbă de echipa Vllora — contul tău nu are acces la
              biblioteca media.
            </span>
          )}
          {mediaAllowed && !!options.length && (
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
        onPublished?.(result.content);
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
          {staff && (
            <button
              type="button"
              className="button secondary"
              aria-pressed={pinned}
              title={
                pinned
                  ? 'Ascunde previzualizarea și păstrează doar editorul.'
                  : 'Vezi site-ul lângă câmpuri, în timp ce editezi.'
              }
              onClick={() => {
                setPinned(!pinned);
                setLive(false);
                setPreview(false);
              }}
            >
              <PanelRight size={17} />{' '}
              {pinned ? 'Ascunde previzualizarea' : 'Previzualizare alături'}
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            aria-pressed={preview}
            title="Machetă simplă a paginii, fără site-ul real."
            onClick={() => {
              setLive(false);
              setPreview((value) => !value);
            }}
          >
            <Eye size={17} />{' '}
            {preview ? 'Înapoi la editor' : 'Previzualizează'}
          </button>
          {staff && (
            <button
              type="button"
              className="button secondary"
              aria-pressed={live}
              title="Site-ul real pe tot ecranul, cu modificările nepublicate."
              onClick={() => {
                setLive(!live);
                setPreview(false);
              }}
            >
              <Eye size={17} />{' '}
              {live ? 'Înapoi la editare' : 'Previzualizare pe tot ecranul'}
            </button>
          )}
        </div>
      </header>
      <p className="muted cms-info">
        Editezi pe secțiuni; previzualizarea alăturată arată site-ul real cu
        modificările nepublicate.{' '}
        {staff &&
          'Previzualizarea apare doar pe paginile conectate la CMS. '}
        Publicarea face modificările vizibile pe site. Fișierele încărcate nu
        sunt private, iar pozele noi se comprimă automat în WebP.
      </p>
      {staff && site.status === 'suspended' && (
        <p className="muted">
          Site suspendat: conținutul salvat nu este disponibil public prin CMS
          până la reactivare.
        </p>
      )}
      {live && (
        <LiveSitePreview
          domain={site.domain}
          pages={draft.pages ?? []}
          path={pagePath}
          select={setPagePath}
          content={draft}
          frameClass={narrow ? 'cms-live-narrow' : ''}
        />
      )}
      {/* Side by side: the page updates from the draft while you type, so the
          field you are editing and its result are always in view together. */}
      <div
        hidden={live}
        className={`cms-workspace${pinned ? ' cms-workspace-split' : ''}`}
      >
      <div
        hidden={live}
        className={`cms-grid${preview ? ' cms-preview-only' : ''}`}
      >
        <form onSubmit={publish} className="cms-form stack" hidden={preview}>
          <nav className="tabs" aria-label="Secțiuni editor">
            {sections
              .filter(([id]) => staff || id !== 'pages')
              .map(([id, name]) => (
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
            {staff && section === 'pages' && (
              <PageFields
                pages={draft.pages ?? []}
                path={pagePath}
                select={setPagePath}
                change={changePage}
                upload={uploadPageImage}
              />
            )}
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
                <fieldset
                  className="stack cms-company"
                  aria-label="Datele firmei"
                >
                  <legend>Datele firmei</legend>
                  <p className="muted">
                    Opționale. Vor apărea în subsolul site-ului, dacă acesta
                    este conectat la CMS.
                  </p>
                  <CompanyFields
                    values={draft}
                    onChange={(key, value) => edit({ [key]: value })}
                  />
                </fieldset>
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
            {section === 'products' && (
              <Panel
                title="Produse"
                description="Fiecare produs are nume, descriere, preț, poză și, opțional, un discount. Site-ul calculează prețul redus și taie prețul vechi; discountul de aici nu modifică prețul de bază."
              >
                {!draft.products.length && (
                  <p className="cms-note">
                    Nu există încă produse. Apasă „Importă de pe site” ca să le
                    preia din magazinul existent, sau adaugă-le manual.
                  </p>
                )}
                {draft.products.map((item, index) => {
                  const reduced = discountedPrice(item.price, item.discount);
                  return (
                    <div key={index} className="cms-entry stack cms-product">
                      <div className="section-heading">
                        <strong>Produs {index + 1}</strong>
                        <RowActions
                          name={`produsul ${index + 1}`}
                          index={index}
                          length={draft.products.length}
                          onRemove={() =>
                            edit({ products: remove(draft.products, index) })
                          }
                          onMove={(step) =>
                            edit({
                              products: move(draft.products, index, step),
                            })
                          }
                        />
                      </div>
                      <div className="cms-product-body">
                        <div className="cms-product-image">
                          {item.image || item.imageUrl ? (
                            <img
                              src={item.image?.url || item.imageUrl}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span className="cms-note">Fără poză</span>
                          )}
                          <FilePicker
                            label="Schimbă poza"
                            inputLabel={`Încarcă poza produsului ${index + 1}`}
                            accept="image/*"
                            disabled={action.busy}
                            onFiles={(files) => {
                              const file = files[0];
                              if (file) uploadProductImage(index, file);
                            }}
                          />
                          {!!productLibrary.length && (
                            <select
                              aria-label={`Alege poza din bibliotecă: produsul ${index + 1}`}
                              value=""
                              onChange={(e) => {
                                const file = productLibrary.find(
                                  (candidate: CmsFile) =>
                                    candidate.id === e.target.value,
                                );
                                if (file)
                                  edit({
                                    products: update(draft.products, index, {
                                      ...item,
                                      image: file,
                                      imageUrl: '',
                                    }),
                                  });
                              }}
                            >
                              <option value="">Din bibliotecă…</option>
                              {productLibrary.map((file) => (
                                <option key={file.id} value={file.id}>
                                  {file.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="stack">
                          <div className="form-grid three">
                            {(
                              [
                                ['name', 'Nume produs', 160],
                                ['price', 'Preț întreg', 40],
                                ['category', 'Categorie', 80],
                              ] as const
                            ).map(([key, label, length]) => (
                              <Field key={key} label={`${label} ${index + 1}`}>
                                <input
                                  maxLength={length}
                                  value={item[key]}
                                  onChange={(e) =>
                                    edit({
                                      products: update(
                                        draft.products,
                                        index,
                                        { ...item, [key]: e.target.value },
                                      ),
                                    })
                                  }
                                />
                              </Field>
                            ))}
                          </div>
                          <Field label={`Descriere produs ${index + 1}`}>
                            <textarea
                              rows={3}
                              maxLength={2000}
                              value={item.description}
                              onChange={(e) =>
                                edit({
                                  products: update(draft.products, index, {
                                    ...item,
                                    description: e.target.value,
                                  }),
                                })
                              }
                            />
                          </Field>
                          <div className="cms-product-deal">
                            <label className="cms-check">
                              <input
                                type="checkbox"
                                checked={item.bestseller}
                                onChange={(e) =>
                                  edit({
                                    products: update(draft.products, index, {
                                      ...item,
                                      bestseller: e.target.checked,
                                    }),
                                  })
                                }
                              />
                              <span>Bestseller</span>
                            </label>
                            <label className="cms-discount">
                              <span>Discount</span>
                              <input
                                type="number"
                                min={0}
                                max={discountMax}
                                step={1}
                                value={item.discount}
                                onChange={(e) => {
                                  const value = Math.round(
                                    Number(e.target.value),
                                  );
                                  edit({
                                    products: update(draft.products, index, {
                                      ...item,
                                      discount: Number.isFinite(value)
                                        ? Math.min(
                                            discountMax,
                                            Math.max(0, value),
                                          )
                                        : 0,
                                    }),
                                  });
                                }}
                              />
                              <span>%</span>
                            </label>
                            <p className="cms-note cms-product-price">
                              {item.discount > 0
                                ? reduced
                                  ? `Se afișează ${reduced.price}, cu ${reduced.compare} tăiat.`
                                  : 'Discountul se aplică doar dacă prețul întreg este un număr, de exemplu 69 sau 69,00.'
                                : 'Fără discount: se afișează doar prețul întreg.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="button secondary"
                  disabled={draft.products.length >= productLimit}
                  onClick={() =>
                    edit({
                      products: [
                        ...draft.products,
                        {
                          name: '',
                          description: '',
                          price: '',
                          comparePrice: '',
                          discount: 0,
                          bestseller: false,
                          category: '',
                          imageUrl: '',
                          image: null,
                        },
                      ],
                    })
                  }
                >
                  <Plus size={16} /> Adaugă produs
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
      {staff && pinned && !live && (
        <aside
          className={`cms-pinned${narrow ? ' cms-pinned-narrow' : ''}`}
          aria-label="Previzualizare site în timp real"
        >
          <div className="cms-pinned-bar">
            <span
              className="cms-pinned-status"
              role="status"
              data-dirty={dirty}
            >
              <span className="cms-pinned-dot" aria-hidden="true" />
              {dirty ? 'Modificări nepublicate' : 'Conținut publicat'}
            </span>
            <div className="controls">
              <button
                type="button"
                className="button secondary small"
                aria-pressed={!narrow}
                onClick={() => setNarrow(false)}
              >
                <Monitor size={15} /> Desktop
              </button>
              <button
                type="button"
                className="button secondary small"
                aria-pressed={narrow}
                onClick={() => setNarrow(true)}
              >
                <Smartphone size={15} /> Telefon
              </button>
            </div>
          </div>
          {site.status === 'suspended' && (
            <p className="cms-pinned-note">
              Site suspendat: previzualizarea poate afișa pagina publicată
              veche.
            </p>
          )}
          {previewLive ? (
            <p className="cms-pinned-note cms-pinned-note--ok">
              Modificările apar aici în timp ce editezi.
            </p>
          ) : (
            <p className="cms-pinned-note">
              Vezi site-ul publicat. Ca să apară și modificările nepublicate,
              site-ul trebuie să încarce integrarea de previzualizare.
            </p>
          )}
          <LiveSitePreview
            compact
            domain={site.domain}
            pages={draft.pages ?? []}
            path={pagePath}
            select={setPagePath}
            content={draft}
            frameClass={narrow ? 'cms-live-narrow' : ''}
            onConnection={(state) => setPreviewLive(!!state)}
          />
        </aside>
      )}
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
        {!!content.products.length && (
          <div className="cms-preview-copy">
            <h4>Produse</h4>
            <div className="cms-preview-products">
              {content.products.slice(0, 6).map((product, i) => {
                const reduced = discountedPrice(product.price, product.discount);
                const image = product.image?.url || product.imageUrl;
                return (
                  <div className="cms-preview-product" key={i}>
                    {image ? (
                      <img src={image} alt="" loading="lazy" />
                    ) : (
                      <span className="cms-preview-product-empty" />
                    )}
                    {product.bestseller && (
                      <span className="cms-preview-badge">Bestseller</span>
                    )}
                    {product.discount > 0 && (
                      <span className="cms-preview-badge cms-preview-badge--deal">
                        −{product.discount}%
                      </span>
                    )}
                    <strong>{product.name || `Produs ${i + 1}`}</strong>
                    <small className="muted">{product.category}</small>
                    <span className="cms-preview-price">
                      <b>{reduced?.price ?? product.price}</b>
                      {reduced && <s>{reduced.compare}</s>}
                    </span>
                  </div>
                );
              })}
            </div>
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
        {companyFields.some((key) => content[key]) && (
          <footer
            className="cms-preview-copy cms-company-footer"
            aria-label="Subsol · Datele firmei"
          >
            <strong>{content.siteName || site.name}</strong>
            {companyFields.map(
              (key) =>
                content[key] && (
                  <p key={key}>
                    {key === 'companyName' || key === 'companyAddress'
                      ? content[key]
                      : `${companyFieldSpec[key].label}: ${content[key]}`}
                  </p>
                ),
            )}
          </footer>
        )}
      </div>
    </aside>
  );
}
