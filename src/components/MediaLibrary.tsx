import { useEffect, useState, type DragEvent } from 'react';
import { Cloud, FileText, HardDrive } from 'lucide-react';
import {
  collection,
  message,
  request,
  uploadMedia,
  type MediaList,
} from '../lib/api';
import { FilePicker } from './FilePicker';
import type { MediaPurpose } from '../lib/web-image';
import { Alert, CopyButton, Empty, Field, Panel, useAction } from './PortalUI';

const mb = (n: number) =>
  `${(n / (1024 * 1024)).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} MB`;
export function MediaLibrary({
  siteId,
  onPick,
  onChange,
  logo,
  favicon,
}: {
  siteId?: string;
  onPick?: (id: string, purpose: 'logo' | 'favicon') => Promise<void>;
  onChange?: () => void;
  logo?: string | null;
  favicon?: string | null;
}) {
  const path = collection(siteId),
    [data, setData] = useState<MediaList>(),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [purpose, setPurpose] = useState<MediaPurpose>('gallery'),
    [drag, setDrag] = useState(false),
    [url, setUrl] = useState('');
  const action = useAction();
  const reload = async () => setData(await request<MediaList>(path));
  useEffect(() => {
    let keep = true;
    request<MediaList>(path)
      .then(
        (value) => {
          if (keep) setData(value);
        },
        (e) => {
          if (keep) setLoadError(message(e));
        },
      )
      .finally(() => {
        if (keep) setLoading(false);
      });
    return () => {
      keep = false;
    };
  }, [path]);
  const upload = (files: File[]) => {
    if (!files.length || action.busy) return;
    void action.run(async () => {
      const errors: string[] = [];
      for (const file of files)
        try {
          await uploadMedia(path, file, purpose);
        } catch (e) {
          errors.push(`${file.name}: ${message(e)}`);
        }
      await reload();
      onChange?.();
      if (errors.length) throw new Error(errors.join(' · '));
    });
  };
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    upload(Array.from(e.dataTransfer.files));
  };
  return (
    <Panel
      title="Biblioteca de fișiere"
      description="Fișierele încărcate pot fi accesate public prin link. Nu încărca fișiere confidențiale."
    >
      {loadError && <Alert>{loadError}</Alert>}
      {action.error && <Alert>{action.error}</Alert>}
      {loading && <p role="status">Se încarcă biblioteca…</p>}
      {data && (
        <div className="quota">
          <div className="section-heading">
            <span>
              {data.delivery === 'cdn' ? (
                <Cloud size={16} />
              ) : (
                <HardDrive size={16} />
              )}{' '}
              {data.delivery === 'cdn' ? 'CDN' : 'Prin Worker'}
            </span>
            <span>
              {mb(data.used)} / {mb(data.quota)}
            </span>
          </div>
          <progress
            max={data.quota}
            value={data.used}
            aria-label="Cotă folosită"
          />
        </div>
      )}
      {siteId && (
        <Field label="Destinația imaginii">
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as MediaPurpose)}
          >
            <option value="gallery">Galerie / conținut</option>
            <option value="logo">Logo</option>
            <option value="favicon">Favicon</option>
          </select>
        </Field>
      )}
      <div
        className={`drop-zone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={drop}
      >
        <FilePicker
          label={action.busy ? 'Se încarcă…' : 'Atașează fișiere'}
          inputLabel="Alege imagini"
          accept="image/*,.ico,.pdf,application/pdf"
          multiple
          disabled={action.busy}
          onFiles={upload}
        />
        <span className="muted">
          Imagini și PDF-uri · poți și să le tragi aici
        </span>
      </div>
      {siteId && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await request(`${path}/import`, 'POST', { url });
              setUrl('');
              await reload();
              onChange?.();
            });
          }}
        >
          <Field label="Importă de la un URL HTTPS">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              required
            />
          </Field>
          <button className="button secondary" disabled={action.busy}>
            Importă
          </button>
        </form>
      )}
      {data &&
        (!data.items.length ? (
          <Empty>Biblioteca nu conține încă fișiere.</Empty>
        ) : (
          <div className="media-grid">
            {data.items.map((item) => (
              <article key={item.id} className="media-card">
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.content_type.startsWith('image/') ? (
                    <img src={item.url} alt={item.name} loading="lazy" />
                  ) : (
                    <span className="media-pdf">
                      <FileText size={28} /> PDF
                    </span>
                  )}
                </a>
                <div className="media-info">
                  <strong title={item.name}>{item.name}</strong>
                  <small className="muted">
                    {item.width && item.height
                      ? `${item.width} × ${item.height} · `
                      : ''}
                    {mb(item.size)}
                  </small>
                  <div className="controls">
                    <CopyButton
                      value={new URL(item.url, location.origin).href}
                      label="URL"
                    />
                    <button
                      className="button danger small"
                      disabled={action.busy}
                      onClick={() => {
                        if (
                          confirm(
                            `Ștergi imaginea „${item.name}”? Linkul poate fi folosit pe site.`,
                          )
                        )
                          void action.run(async () => {
                            await request(`${path}/${item.id}`, 'DELETE');
                            await reload();
                            onChange?.();
                          });
                      }}
                    >
                      Șterge
                    </button>
                  </div>
                  {onPick && item.content_type.startsWith('image/') && (
                    <div className="controls">
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={action.busy || logo === item.id}
                        onClick={() =>
                          void action.run(() => onPick(item.id, 'logo'))
                        }
                      >
                        {logo === item.id ? 'Logo actual' : 'Setează ca logo'}
                      </button>
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={action.busy || favicon === item.id}
                        onClick={() =>
                          void action.run(() => onPick(item.id, 'favicon'))
                        }
                      >
                        {favicon === item.id
                          ? 'Favicon actual'
                          : 'Setează ca favicon'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}
    </Panel>
  );
}
