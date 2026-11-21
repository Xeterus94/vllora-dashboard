import { portalTitle } from '../../shared/portal-brand';
import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import {
  ApiError,
  message,
  request,
  type BusinessReport,
  type Identity,
  type Site,
  type Stats,
} from '../lib/api';
import { brandStyle } from '../lib/brand';
import { Alert, Field, Panel, TenantBrand, useAction } from './PortalUI';
import { MetricsPanel, Period } from './MetricsPanel';
import { MediaLibrary } from './MediaLibrary';
import { SiteEditor } from './SiteEditor';

export function PortalDashboard({
  identity,
  onLogout,
}: {
  identity: Identity;
  onLogout: () => void;
}) {
  const [site, setSite] = useState(identity.site!),
    [days, setDays] = useState(30),
    [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<{
      stats: Stats;
      report: BusinessReport;
    }>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'editor' | 'media' | 'account'>(
    'overview',
  );
  const [editorDirty, setEditorDirty] = useState(false);
  const canLeaveEditor = () =>
    !editorDirty || confirm('Renunți la modificările nepublicate?');
  const [notes, setNotes] = useState(site.notes),
    [saved, setSaved] = useState(false);
  const action = useAction();
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [stats, report, { site: newSite }] = await Promise.all([
          request<Stats>(`/portal/stats?days=${days}`),
          request<BusinessReport>(`/portal/metrics?days=${days}`),
          request<{ site: Site }>('/portal/me'),
        ]);
        if (active) {
          setReport({ stats, report });
          setSite(newSite);
          setError('');
        }
      } catch (e) {
        if (active) {
          if (e instanceof ApiError && e.status === 401) onLogout();
          else setError(message(e));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [days, refresh, onLogout]);
  useEffect(() => {
    document.title = portalTitle(site.name);
  }, [site.name]);
  useEffect(() => {
    if (!site.favicon_url) return;
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = site.favicon_url;
    document.head.append(link);
    return () => link.remove();
  }, [site.favicon_url]);
  const logout = (all = false) =>
    void action.run(async () => {
      await request(`/auth/${all ? 'sessions/revoke-all' : 'logout'}`, 'POST');
      onLogout();
    });
  return (
    <div
      className={`portal-shell ${site.scheme === 'dark' ? 'dark-portal' : ''}`}
      style={brandStyle(site)}
    >
      <header className="topbar">
        <div className="wrap head-inner">
          <TenantBrand site={site} />
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() => {
              if (canLeaveEditor()) logout();
            }}
          >
            <LogOut size={16} /> Deconectare
          </button>
        </div>
      </header>
      <main className="wrap page stack">
        <div className="hero">
          <div>
            <span className="eyebrow">
              {site.plan} · Spațiul tău de administrare
            </span>
            <h1>{site.name}</h1>
            <a href={`https://${site.domain}`} target="_blank" rel="noreferrer">
              {site.domain} <ExternalLink size={14} />
            </a>
          </div>
          <span className="badge">{identity.user.name}</span>
        </div>
        <nav className="tabs portal-tabs" aria-label="Portal">
          {(
            [
              ['overview', 'Prezentare', LayoutDashboard],
              ['editor', 'Editează site-ul', LayoutTemplate],
              ['media', 'Bibliotecă media', Images],
              ['account', 'Cont și notițe', UserRound],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                if (id !== tab && canLeaveEditor()) setTab(id);
              }}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        {action.error && <Alert>{action.error}</Alert>}
        {tab === 'overview' && (
          <>
            <div className="section-heading">
              <Period
                days={days}
                change={(d) => {
                  setDays(d);
                  setLoading(true);
                  setReport(undefined);
                }}
              />
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setRefresh((v) => v + 1);
                }}
              >
                <RefreshCw size={16} /> Actualizează
              </button>
            </div>
            {error && <Alert>{error}</Alert>}
            {loading && !report && (
              <p role="status">Se încarcă statisticile…</p>
            )}
            {report && <MetricsPanel {...report} />}
          </>
        )}
        {tab === 'editor' && (
          <SiteEditor site={site} onDirty={setEditorDirty} />
        )}
        {tab === 'media' && (
          <MediaLibrary onChange={() => setRefresh((v) => v + 1)} />
        )}
        {tab === 'account' && (
          <>
            <Panel title="Notițe către echipă">
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSaved(false);
                  void action.run(async () => {
                    const data = await request<{ notes: string }>(
                      '/portal/site',
                      'PATCH',
                      { notes },
                    );
                    setNotes(data.notes);
                    setSaved(true);
                  });
                }}
              >
                <Field label="Notițe">
                  <textarea
                    rows={5}
                    maxLength={3000}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setSaved(false);
                    }}
                  />
                </Field>
                <div className="controls">
                  <button className="button primary" disabled={action.busy}>
                    Salvează notițele
                  </button>
                  {saved && (
                    <span role="status">Notițele au fost salvate.</span>
                  )}
                </div>
              </form>
            </Panel>
            <Panel
              title="Sesiunile contului"
              description={identity.user.email || identity.user.username}
            >
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() => logout(true)}
              >
                Deconectează toate dispozitivele
              </button>
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
