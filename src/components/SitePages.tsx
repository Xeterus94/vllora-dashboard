import { useEffect, useRef, useState } from 'react';
import {
  pageFieldLength,
  publicPagePath,
  type ContentPage,
  type PageField,
} from '../../shared/site-pages';
import type { SiteContent } from '../../shared/site-content';
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

export function LiveSitePreview({
  domain,
  pages,
  path,
  select,
  content,
  compact = false,
  frameClass = '',
  onConnection,
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
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [connection, setConnection] = useState('');
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
        event.origin === location.origin ||
        event.data?.type !== 'vllora:preview-ready'
      )
        return;
      connect(`${event.origin} ${event.data.path || '/'}`);
      put(event.origin);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [domain, content]);
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
