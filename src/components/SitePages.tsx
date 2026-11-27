import { useEffect, useRef, useState } from 'react';
import {
  pageFieldLength,
  publicPagePath,
  type ContentPage,
  type PageField,
} from '../../shared/site-pages';
import type { SiteContent } from '../../shared/site-content';
import {
  inlineKind,
  inlineLabel,
  inlineLimit,
  inlineMessages,
  isInlineLink,
  isInlineText,
  type InlineField,
} from '../../shared/site-inline';
import { FilePicker } from './FilePicker';
import { Field, Panel } from './PortalUI';

export function PageFields({
  pages,
  path,
  select,
  change,
  upload,
}: {
  pages: ContentPage[];
  path: string;
  select: (path: string) => void;
  change: (path: string, field: PageField) => void;
  upload: (path: string, field: PageField, file: File) => void;
}) {
  const [imagesOnly, setImagesOnly] = useState(false);
  const [search, setSearch] = useState('');
  const page = pages.find((p) => p.path === path) ?? pages[0];
  const query = search.trim().toLowerCase();
  const inventory = (imagesOnly || query ? pages : page ? [page] : [])
    .map((p) => ({
      ...p,
      fields: p.fields.filter(
        (field) =>
          (!imagesOnly || field.kind === 'image') &&
          (!query ||
            `${field.label} ${field.id} ${field.value} ${p.title} ${p.path}`
              .toLowerCase()
              .includes(query)),
      ),
    }))
    .filter((p) => p.fields.length);
  return (
    <Panel
      title="Pagini, texte și imagini"
      description="Câmpurile sunt preluate din manifestul site-ului. Eliminarea unei imagini ascunde imaginea din poziția conectată, nu șterge fișierul original de pe site."
    >
      {page ? (
        <>
          <div className="form-grid">
            <Field label="Pagina site-ului">
              <select
                value={page.path}
                onChange={(e) => select(e.target.value)}
              >
                {pages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.title} · {p.path}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Caută pe toate paginile">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
          </div>
          <label className="controls">
            <input
              type="checkbox"
              checked={imagesOnly}
              onChange={(e) => setImagesOnly(e.target.checked)}
            />{' '}
            Toate imaginile conectate
          </label>
          {!inventory.length && (
            <p className="muted">Nu există câmpuri care corespund.</p>
          )}
          {inventory.map((p) => (
            <section key={p.path} className="stack cms-fields">
              <h3>
                {p.title} <small className="muted">{p.path}</small>
              </h3>
              {p.fields.map((field) => (
                <div key={field.id} className="cms-entry stack">
                  {field.kind === 'image' &&
                    (field.media?.url || /^https:\/\//i.test(field.value)) && (
                      <img
                        className="cms-slot-image"
                        src={field.media?.url || field.value}
                        loading="lazy"
                        alt=""
                      />
                    )}
                  <Field label={field.label}>
                    {field.kind === 'text' ? (
                      <textarea
                        rows={
                          field.value.includes('\n') || field.value.length > 140
                            ? 4
                            : 2
                        }
                        maxLength={pageFieldLength}
                        value={field.value}
                        onChange={(event) =>
                          change(p.path, {
                            ...field,
                            value: event.target.value,
                          })
                        }
                      />
                    ) : (
                      <input
                        type={field.kind === 'number' ? 'number' : 'url'}
                        step={field.kind === 'number' ? 'any' : undefined}
                        value={field.value}
                        maxLength={2048}
                        onChange={(event) =>
                          change(p.path, {
                            ...field,
                            media: undefined,
                            value: event.target.value,
                          })
                        }
                      />
                    )}
                  </Field>
                  {field.kind === 'image' && (
                    <div className="controls">
                      <FilePicker
                        label="Înlocuiește imaginea"
                        inputLabel={`Încarcă: ${field.label}`}
                        accept="image/*"
                        onFiles={([file]) => upload(p.path, field, file)}
                      />
                      {(field.value || field.media) && (
                        <button
                          type="button"
                          className="button danger small"
                          onClick={() =>
                            change(p.path, {
                              ...field,
                              value: '',
                              media: undefined,
                            })
                          }
                        >
                          Elimină imaginea
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
        </>
      ) : (
        <p className="muted">
          Site-ul nu a furnizat încă inventarul paginilor și câmpurilor. Este
          necesar manifestul CMS v2.
        </p>
      )}
    </Panel>
  );
}

// The editing band that sits over the preview while "Editează în pagină" is on.
// It edits one field at a time and writes straight into the draft, so the page
// and the form never hold two different values.
function InlineEditor({
  field,
  content,
  change,
  close,
}: {
  field: InlineField;
  content: SiteContent;
  change: (field: InlineField, value: string) => void;
  close: () => void;
}) {
  const text = field.source === 'text' ? field.field : undefined;
  const page = field.source === 'page' ? field : undefined;
  const current = page
    ? (content.pages
        ?.find((item) => item.path === page.page)
        ?.fields.find((item) => item.id === page.id)?.value ?? '')
    : text
      ? content[text]
      : '';
  const [value, setValue] = useState(current);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    setValue(current);
    // Focus without scrolling the page inside the frame.
    input.current?.focus({ preventScroll: true });
  }, [field, current]);
  const label = page
    ? `Text din pagina ${page.page}`
    : text
      ? inlineLabel(text)
      : 'Câmp';
  const commit = () => {
    if (value !== current) change(field, value);
    close();
  };
  const kind = text ? inlineKind(text) : 'text';
  return (
    <div className="cms-inline-bar" role="dialog" aria-label={`Editează: ${label}`}>
      <div className="cms-inline-bar-head">
        <strong>{label}</strong>
        {text && isInlineLink(text) && (
          <small className="muted">Adresă HTTPS</small>
        )}
        <button
          type="button"
          className="text-button"
          onClick={close}
          aria-label="Închide editorul din previzualizare"
        >
          ✕
        </button>
      </div>
      {kind === 'line' && !page ? (
        <input
          ref={input}
          value={value}
          maxLength={text ? inlineLimit(text) : 1200}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') close();
          }}
        />
      ) : (
        <textarea
          ref={input}
          rows={kind === 'url' ? 2 : 3}
          value={value}
          maxLength={text ? inlineLimit(text) : 6000}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
              commit();
          }}
        />
      )}
      <div className="controls">
        <button type="button" className="button primary small" onClick={commit}>
          Aplică
        </button>
        <button type="button" className="button secondary small" onClick={close}>
          Renunță
        </button>
        {value !== current && (
          <span className="muted">Se publică împreună cu restul paginii.</span>
        )}
      </div>
    </div>
  );
}

export function LiveSitePreview({
  domain,
  pages,
  path,
  select,
  content,
  compact = false,
  frameClass = '',
  onConnection,
  inline = false,
  change,
}: {
  domain: string;
  pages: ContentPage[];
  path: string;
  select: (path: string) => void;
  content: SiteContent;
  // Compact drops the panel chrome for the always-visible split view.
  compact?: boolean;
  frameClass?: string;
  // The compact view reports the handshake so its parent can show one status.
  onConnection?: (state: string) => void;
  // Click a text in the page and edit it in place.
  inline?: boolean;
  change?: (field: InlineField, value: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [connection, setConnection] = useState('');
  const [selected, setSelected] = useState<InlineField | null>(null);
  const connect = (state: string) => {
    setConnection(state);
    onConnection?.(state);
  };
  const [narrow, setNarrow] = useState(false);
  const route = publicPagePath(path) ?? '/';
  const url = new URL(route, `https://${domain}`);
  const origins = [
    url.origin,
    `https://${domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`}`,
  ];
  // The public CMS shape, never credentials, billing data or session tokens.
  const payload = (): SiteContent => {
    const fileUrl = (value: string) => new URL(value, location.origin).href;
    const file = <T extends { url: string }>(value: T) => ({
      ...value,
      url: fileUrl(value.url),
    });
    return {
      ...content,
      heroMedia: content.heroMedia && file(content.heroMedia),
      logoMedia: content.logoMedia && file(content.logoMedia),
      gallery: content.gallery.map(file),
      documents: content.documents.map(file),
      images: [
        ...new Set([
          ...content.images,
          ...content.gallery.map((item) => fileUrl(item.url)),
        ]),
      ],
      // A product image can be an uploaded file or a plain URL from the site.
      products: content.products.map((product) => ({
        ...product,
        image: product.image && file(product.image),
      })),
      pages: content.pages?.map((page) => ({
        ...page,
        fields: page.fields.map((field) =>
          field.media ? { ...field, media: file(field.media) } : field,
        ),
      })),
    };
  };
  const put = (origin: string) =>
    frame.current?.contentWindow?.postMessage(
      { type: 'vllora:preview-content', content: payload() },
      origin,
    );
  // While the inline mode is on, the page knows it may report clicks.
  const sendMode = () => {
    const origin = connection.split(' ')[0];
      if (!origin) return;
    frame.current?.contentWindow?.postMessage(
      { type: inlineMessages.enable, on: inline },
      origin,
    );
  };
  // Every keystroke has to reach the frame, not only the first readiness handshake.
  useEffect(() => {
    if (!connection) return;
    const timer = window.setTimeout(() => put(connection.split(' ')[0]), 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, JSON.stringify(content)]);
  useEffect(() => {
    const alias = domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`;
    const listener = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        ![`https://${domain}`, `https://${alias}`].includes(event.origin) ||
        event.origin === location.origin
      )
        return;
      const type = event.data?.type;
      if (type === 'vllora:preview-ready') {
        connect(`${event.origin} ${event.data.path || '/'}`);
        put(event.origin);
        return;
      }
      // A click in the page names the field under the pointer.
      if (type !== inlineMessages.pick) return;
      const target = event.data?.target as Partial<InlineField> | undefined;
      if (!target || !inline) return;
      if (target.source === 'text' && isInlineText(target.field))
        setSelected({ source: 'text', field: target.field });
      else if (
        target.source === 'page' &&
        typeof target.page === 'string' &&
        typeof target.id === 'string' &&
        target.page.startsWith('/') &&
        target.id
      )
        setSelected({ source: 'page', page: target.page, id: target.id });
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [domain, content, inline]);
  useEffect(() => {
    sendMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, connection]);
  const body = (
    <>
      <div className="controls" hidden={compact}>
        <Field label="Pagină de previzualizat">
          <select
            value={route}
            onChange={(event) => {
              connect('');
              select(event.target.value);
            }}
          >
            {!pages.some((page) => page.path === '/') && (
              <option value="/">Prima pagină · /</option>
            )}
            {pages.map((page) => (
              <option key={page.path} value={page.path}>
                {page.title} · {page.path}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="button secondary"
          type="button"
          aria-pressed={narrow}
          onClick={() => setNarrow(!narrow)}
        >
          {narrow ? 'Lățime desktop' : 'Lățime telefon'}
        </button>
        <a
          href={url.href}
          className="button secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Deschide pagina publicată
        </a>
      </div>
      <p className="muted" role="status" hidden={compact && !!connection}>
        {connection
          ? 'Varianta nepublicată a fost trimisă paginii conectate.'
          : 'Dacă integrarea de previzualizare lipsește, cadrul arată doar site-ul publicat. Unele site-uri blochează afișarea într-un cadru; în acest caz, deschide pagina publicată separat.'}
      </p>
      {url.origin === location.origin ? (
        <p>Previzualizarea nu poate încărca domeniul dashboardului.</p>
      ) : (
        <iframe
          ref={frame}
          // One frame per route and per context: the pinned and the full-screen
          // preview must not share a DOM node, or the second one never reloads.
          key={`${compact ? 'pinned' : 'full'}:${url.href}`}
          title="Site real — previzualizare"
          className={`cms-live-frame${narrow ? ' cms-live-narrow' : ''}${frameClass ? ` ${frameClass}` : ''}`}
          src={url.href}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            connect('');
            for (const origin of origins)
              if (origin !== location.origin)
                frame.current?.contentWindow?.postMessage(
                  { type: 'vllora:preview-ping' },
                  origin,
                );
          }}
        />
      )}
      {inline && change && selected && (
        <InlineEditor
          field={selected}
          content={content}
          change={change}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
  if (compact) return body;
  return (
    <Panel
      title="Previzualizare site real"
      description="Încarcă pagina originală, cu stilurile, animațiile și navigarea ei. Trimiterea formularelor native și ferestrele noi sunt blocate; nu testa rezervări sau plăți pe site-ul real."
    >
      {body}
    </Panel>
  );
}
