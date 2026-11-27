import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Globe2,
  Inbox,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { profileSettings, type MetricSettings } from '../../shared/metrics';
import {
  defaultSiteType,
  profileForType,
  siteTypes,
} from '../../shared/portal-brand';
import { blueprintFor } from '../../shared/site-type';
import {
  permissionIds,
  permissions,
  presetFor,
  presetIds,
  presets,
  type Permission,
  type PresetId,
} from '../../shared/permissions';
import {
  adminSite,
  adminUser,
  ApiError,
  message,
  request,
  type AuditEntry,
  type BusinessReport,
  type CertificateReport,
  type Site,
  type SiteDetail,
  type Stats,
  type User,
} from '../lib/api';
import { brandStyle } from '../lib/brand';
import {
  Alert,
  CopyButton,
  Empty,
  Field,
  Logo,
  VlloraLogo,
  Panel,
  useAction,
} from './PortalUI';
import { CompanyFields, readCompanyFields } from './CompanyFields';
import { SiteEditor as ContentEditor } from './SiteEditor';
import { MediaLibrary } from './MediaLibrary';
import { MetricEditor, MetricsPanel, Period } from './MetricsPanel';

const states = {
  active: 'Activ',
  suspended: 'Suspendat',
  deleting: 'În curs de ștergere',
};
const routes: Record<string, string> = {
  active: 'Router Cloudflare configurat',
  manual: 'Necesită configurare manuală',
  error: 'Sincronizare eșuată',
  conflict: 'Ruta este folosită de alt Worker',
};
const auditLabels: Record<string, string> = {
  bootstrap: 'Cont master inițializat',
  login: 'Autentificare',
  sessions_revoked: 'Sesiuni revocate',
  password_changed: 'Parolă schimbată',
  recovery_email_changed: 'Email de recuperare actualizat',
  password_reset_sent: 'Link de resetare trimis',
  password_reset_completed: 'Parolă recuperată',
  site_created: 'Site creat',
  site_updated: 'Site actualizat',
  site_suspended: 'Site suspendat',
  site_deleted: 'Site șters',
  branding_refreshed: 'Branding resincronizat',
  route_sync_attempted: 'Sincronizare rută',
  client_created: 'Acces client generat',
  client_updated: 'Cont client actualizat',
  client_password_reset: 'Parolă temporară regenerată',
  client_deleted: 'Cont client șters',
  portal_notes_changed: 'Notițe actualizate',
  site_content_published: 'Conținutul site-ului publicat',
  metrics_key_rotated: 'Cheie server rotită',
  media_uploaded: 'Imagine încărcată',
  media_deleted: 'Imagine ștearsă',
  media_imported: 'Imagine importată',
  logos_migration: 'Migrare logouri R2',
};
const number = new Intl.NumberFormat('ro-RO');
function Secret({
  title,
  secret,
  dismiss,
  hint,
}: {
  title: string;
  secret: string;
  dismiss: () => void;
  hint?: string;
}) {
  return (
    <div className="secret" role="status">
      <strong>
        <KeyRound size={16} /> {title}
      </strong>
      <p>
        {hint ||
          'Copiază această valoare acum. Nu poate fi recuperată după închidere.'}
      </p>
      <code>{secret}</code>
      <div className="controls">
        <CopyButton value={secret} />
        <button className="text-button" onClick={dismiss}>
          Ascunde
        </button>
      </div>
    </div>
  );
}
function Accounts({
  detail,
  reload,
}: {
  detail: SiteDetail;
  reload: () => Promise<void>;
}) {
  const [secret, setSecret] = useState<{ name: string; value: string }>(),
    [editing, setEditing] = useState(''),
    [editedGrants, setEditedGrants] = useState<Permission[]>([]);
  // New accounts start as Administrator, which is what they could do before.
  const [grants, setGrants] = useState<Permission[]>([
    ...presets.admin.permissions,
  ]);
  const action = useAction(),
    path = adminSite(detail.site.id);
  const create = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    void action.run(async () => {
      setSecret(undefined);
      const result = await request<{ temporary_password: string; user: User }>(
        `${path}/users`,
        'POST',
        {
          username: data.get('username'),
          name: data.get('name') || data.get('username'),
          email: data.get('email'),
          permissions: grants,
        },
      );
      setSecret({
        name: result.user.username,
        value: result.temporary_password,
      });
      form.reset();
      setGrants([...presets.admin.permissions]);
      await reload();
    });
  };
  return (
    <Panel
      title="Acces clienți"
      description="Parola temporară trebuie schimbată la prima autentificare."
    >
      {action.error && <Alert>{action.error}</Alert>}
      {secret && (
        <Secret
          title={`Parola temporară pentru ${secret.name}`}
          secret={secret.value}
          dismiss={() => setSecret(undefined)}
        />
      )}
      <form onSubmit={create} className="stack">
        <div className="form-grid three">
          <Field label="Utilizator">
            <input
              name="username"
              autoComplete="off"
              required
              minLength={3}
              maxLength={64}
            />
          </Field>
          <Field label="Nume client">
            <input name="name" maxLength={100} />
          </Field>
          <Field label="Email de recuperare">
            <input name="email" type="email" maxLength={254} />
          </Field>
        </div>
        <Permissions
          value={grants}
          onChange={setGrants}
          idPrefix="new-user"
        />
        <div>
          <button className="button primary" disabled={action.busy}>
            <KeyRound size={16} /> Generează acces
          </button>
        </div>
      </form>
      {detail.users.length ? (
        <ul className="accounts">
          {detail.users.map((user) => (
            <li key={user.id}>
              <div className="section-heading">
                <div>
                  <strong>{user.username}</strong>
                  <p className="muted">
                    {user.name}
                    {user.email ? ` · ${user.email}` : ''}
                    {user.must_change_password
                      ? ' · parolă temporară activă'
                      : ''}
                  </p>
                  <p className="permission-summary">
                    {presetFor(user.permissions) === 'custom'
                      ? 'Drepturi personalizate'
                      : presets[presetFor(user.permissions) as PresetId].label}
                    {' · '}
                    {user.permissions.length
                      ? user.permissions
                          .map((id) => permissions[id])
                          .join(', ')
                      : 'fără nicio acțiune'}
                  </p>
                </div>
                <div className="controls">
                  <button
                    className="button secondary small"
                    disabled={action.busy}
                    onClick={() => {
                      setEditedGrants([...user.permissions]);
                      setEditing(editing === user.id ? '' : user.id);
                    }}
                  >
                    Editează
                  </button>
                  <button
                    className="button secondary small"
                    disabled={action.busy}
                    onClick={() => {
                      if (
                        confirm(
                          `Resetezi parola pentru ${user.username}? Sesiunile vor fi revocate.`,
                        )
                      )
                        void action.run(async () => {
                          setSecret(undefined);
                          const result = await request<{
                            temporary_password: string;
                          }>(`${adminUser(user.id)}/reset-password`, 'POST');
                          setSecret({
                            name: user.username,
                            value: result.temporary_password,
                          });
                          await reload();
                        });
                    }}
                  >
                    Reset parolă
                  </button>
                  <button
                    className="button danger small"
                    disabled={action.busy}
                    onClick={() => {
                      if (confirm(`Ștergi contul ${user.username}?`))
                        void action.run(async () => {
                          setSecret(undefined);
                          await request(adminUser(user.id), 'DELETE');
                          await reload();
                        });
                    }}
                  >
                    Șterge contul
                  </button>
                </div>
              </div>
              {editing === user.id && (
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    void action.run(async () => {
                      await request(adminUser(user.id), 'PATCH', {
                        name: data.get('name'),
                        email: data.get('email'),
                        permissions: editedGrants,
                      });
                      setEditing('');
                      await reload();
                    });
                  }}
                >
                  <Field label="Nume client">
                    <input
                      name="name"
                      required
                      defaultValue={user.name}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Email de recuperare">
                    <input
                      name="email"
                      type="email"
                      defaultValue={user.email || ''}
                      maxLength={254}
                    />
                  </Field>
                  <Permissions
                    value={editedGrants}
                    onChange={setEditedGrants}
                    idPrefix={`user-${user.id}`}
                  />
                  <button className="button primary" disabled={action.busy}>
                    Salvează contul
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>Niciun cont client.</Empty>
      )}
    </Panel>
  );
}
// Presets fill the checkboxes; any checkbox can still be changed afterwards, and
// the label switches to "Personalizat" as soon as the set no longer matches one.
function Permissions({
  value,
  onChange,
  idPrefix,
}: {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  idPrefix: string;
}) {
  const chosen = presetFor(value);
  const toggle = (id: Permission) =>
    onChange(
      value.includes(id)
        ? value.filter((item) => item !== id)
        : [...permissionIds].filter((item) => item === id || value.includes(item)),
    );
  return (
    <fieldset className="permissions">
      <legend className="lbl">Ce poate face în portal</legend>
      <div className="permission-presets" role="group" aria-label="Preseturi">
        {presetIds.map((id) => (
          <button
            key={id}
            type="button"
            className="button secondary small"
            aria-pressed={chosen === id}
            title={presets[id].description}
            onClick={() => onChange([...presets[id].permissions])}
          >
            {presets[id].label}
          </button>
        ))}
        {chosen === 'custom' && (
          <span className="badge" aria-live="polite">
            Personalizat
          </span>
        )}
      </div>
      <div className="permission-rows">
        {permissionIds.map((id) => {
          const input = `${idPrefix}-${id}`;
          return (
            <label key={id} htmlFor={input} className="permission-row">
              <input
                id={input}
                type="checkbox"
                checked={value.includes(id)}
                onChange={() => toggle(id)}
              />
              <span>{permissions[id]}</span>
            </label>
          );
        })}
      </div>
      <p className="permission-hint">
        Fără „Editează conținutul” nu poate publica, iar fără „Bibliotecă media”
        nu poate încărca poze. Serverul refuză acțiunile lipsă, nu doar ecranul.
      </p>
    </fieldset>
  );
}

type CertificateState = CertificateReport['state'];
const certificateLabels: Record<CertificateState, string> = {
  active: 'Certificat valid',
  expiring: 'Expiră curând',
  expired: 'Certificat expirat',
  none: 'Niciun certificat găsit',
  unknown: 'Stare neconfirmată',
  unmanaged: 'Zonă neadministrată',
  unconfigured: 'Verificare neconfigurată',
  error: 'Verificare eșuată',
};
function certificateDetail(report: CertificateReport) {
  if (report.state === 'unconfigured')
    return 'Verificarea certificatului cere tokenul Cloudflare (Zone:Read) în Worker.';
  if (report.state === 'unmanaged')
    return `${report.domain} nu este într-o zonă Cloudflare administrată de acest token.`;
  if (report.state === 'error')
    return 'Cloudflare nu a răspuns. Reîncearcă verificarea.';
  if (report.state === 'none')
    return 'Nu există un pachet de certificate care să acopere acest domeniu.';
  if (report.expires_on && report.days_left !== null) {
    const date = new Date(report.expires_on).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    if (report.days_left < 0)
      return `A expirat la ${date}. Reînnoiește-l în Cloudflare.`;
    return `Expiră la ${date} (${report.days_left} ${report.days_left === 1 ? 'zi' : 'zile'}). Cloudflare reînnoiește automat certificatele administrate.`;
  }
  return 'Cloudflare nu a raportat o dată de expirare pentru acest domeniu.';
}
function AdministrationRow({
  icon,
  title,
  detail,
  badge,
  tone,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  badge?: string;
  tone?: 'good' | 'warn' | 'muted';
  action?: ReactNode;
}) {
  return (
    <div className={`admin-row${tone ? ` ${tone}` : ''}`}>
      <span className="admin-row-icon" aria-hidden>
        {icon}
      </span>
      <div className="admin-row-body">
        <strong>{title}</strong>
        <small className="muted">{detail}</small>
      </div>
      {(badge || action) && (
        <div className="admin-row-actions">
          {badge && (
            <span className={`badge ${tone === 'good' ? 'good' : ''}`}>
              {badge}
            </span>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
function SiteAdministration({
  detail,
  path,
  reload,
  setTab,
  setStatus,
  disabled,
}: {
  detail: SiteDetail;
  path: string;
  reload: () => Promise<void>;
  setTab: (tab: 'content') => void;
  setStatus: (value: string) => void;
  disabled: boolean;
}) {
  const { site } = detail,
    action = useAction(),
    [certificate, setCertificate] = useState<CertificateReport>(),
    [checking, setChecking] = useState(false);
  const checkCertificate = () => {
    setChecking(true);
    request<CertificateReport>(`${path}/certificate`)
      .then(setCertificate, (e) => {
        setCertificate({
          state: 'error',
          domain: site.portal_host || site.domain,
          expires_on: null,
          days_left: null,
          pack_status: null,
          hosts: [],
          checked_at: new Date().toISOString(),
        });
        action.setError(message(e));
      })
      .finally(() => setChecking(false));
  };
  const toggleStatus = () => {
    const suspend = site.status !== 'suspended';
    const question = suspend
      ? 'Suspenzi site-ul? Portalul și API-ul public răspund cu eroare până la reactivare.'
      : 'Reactivezi site-ul? Portalul și conținutul public redevin disponibile.';
    if (!confirm(question)) return;
    void action.run(async () => {
      await request(path, 'PATCH', {
        status: suspend ? 'suspended' : 'active',
      });
      await reload();
      setStatus(suspend ? 'Site-ul a fost suspendat.' : 'Site-ul a fost reactivat.');
    });
  };
  const busy = disabled || action.busy;
  return (
    <Panel
      title="Administrare site"
      description="Acțiuni pentru site-ul public. Cele neconectate la backend rămân marcate explicit."
    >
      {action.error && <Alert>{action.error}</Alert>}
      <div className="admin-rows">
        <AdministrationRow
          icon={<Wrench size={18} />}
          title={
            site.status === 'suspended'
              ? 'Oprește modul de mentenanță'
              : 'Activează modul de mentenanță'
          }
          detail={
            site.status === 'suspended'
              ? 'Site-ul este oprit acum. Reactivarea îl face din nou public.'
              : 'Oprește site-ul public și portalul până la reactivare.'
          }
          tone={site.status === 'suspended' ? 'warn' : undefined}
          action={
            <button
              className="button secondary small"
              disabled={busy}
              onClick={toggleStatus}
            >
              {site.status === 'suspended' ? 'Reactivează' : 'Suspendă'}
            </button>
          }
        />
        <AdministrationRow
          icon={<Rocket size={18} />}
          title="Publică modificările în așteptare"
          detail="Nu există modificări în coadă: conținutul se publică direct din editor."
          action={
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => setTab('content')}
            >
              Deschide editorul
            </button>
          }
        />
        <AdministrationRow
          icon={<ShieldCheck size={18} />}
          title="Certificat SSL"
          detail={
            certificate
              ? certificateDetail(certificate)
              : 'Verifică certificatul TLS al domeniului în Cloudflare. Reînnoirea este automată la Cloudflare.'
          }
          badge={certificate ? certificateLabels[certificate.state] : undefined}
          tone={
            certificate
              ? certificate.state === 'active'
                ? 'good'
                : certificate.state === 'expiring' ||
                    certificate.state === 'expired' ||
                    certificate.state === 'error'
                  ? 'warn'
                  : 'muted'
              : undefined
          }
          action={
            <button
              className="button secondary small"
              disabled={checking}
              onClick={checkCertificate}
            >
              <RefreshCw size={14} />{' '}
              {checking ? 'Se verifică…' : certificate ? 'Reverifică' : 'Verifică'}
            </button>
          }
        />
        <AdministrationRow
          icon={<Inbox size={18} />}
          title="Cereri de conținut"
          detail="Inbox-ul de cereri nu este conectat la acest dashboard, deci nu există un număr real de cereri."
          badge="Neconectat"
          tone="muted"
        />
      </div>
      <p className="muted">
        Modul de mentenanță folosește suspendarea existentă: site-ul și portalul
        nu mai răspund. O pagină „back soon” proprie nu există încă. Reînnoirea
        forțată a certificatului nu este expusă de Cloudflare; putem doar citi
        starea lui.
      </p>
    </Panel>
  );
}
function SiteReports({ siteId }: { siteId: string }) {
  const [days, setDays] = useState(30),
    [data, setData] = useState<{ stats: Stats; report: BusinessReport }>(),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const path = adminSite(siteId);
    Promise.all([
      request<Stats>(`${path}/stats?days=${days}`),
      request<BusinessReport>(`${path}/metrics?days=${days}`),
    ]).then(
      ([stats, report]) => {
        if (active) setData({ stats, report });
      },
      (e) => {
        if (active) setError(message(e));
      },
    );
    return () => {
      active = false;
    };
  }, [siteId, days]);
  return (
    <div className="stack">
      <Period
        days={days}
        change={(period) => {
          setError('');
          setData(undefined);
          setDays(period);
        }}
      />
      {error ? (
        <Alert>{error}</Alert>
      ) : data ? (
        <MetricsPanel {...data} />
      ) : (
        <p role="status">Se încarcă raportul…</p>
      )}
    </div>
  );
}
function SiteSettings({
  detail,
  reload,
  remove,
  startInContent,
  dirty,
  setDirty,
}: {
  detail: SiteDetail;
  reload: () => Promise<void>;
  remove: () => void;
  startInContent: boolean;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}) {
  const { site } = detail,
    path = adminSite(site.id),
    [tab, setTab] = useState<
      'setup' | 'access' | 'content' | 'media' | 'reports'
    >(startInContent ? 'content' : 'setup');
  const [metrics, setMetrics] = useState(detail.settings),
    [serverKey, setServerKey] = useState(''),
    [status, setStatus] = useState(''),
    [formVersion, setFormVersion] = useState(0);
  const action = useAction();
  const [name, setName] = useState(site.name);
  const clientLink = `https://${site.portal_host || site.domain}/admin`;
  const trackingOrigin = location.origin;
  const tag = `<script async src="${trackingOrigin}/track.js" data-vllora-site="${site.tracking_token}"></script>`;
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus('');
    const payload: Record<string, unknown> = {
      metrics,
      company: readCompanyFields(form, detail.company),
    };
    for (const key of [
      'name',
      'plan',
      'portal_host',
      'status',
      'site_type',
      'primary_color',
      'secondary_color',
      'accent_color',
      'scheme',
    ] as const) {
      const value = form.get(key);
      if (value !== null && (value || null) !== (site[key] || null))
        payload[key] = value;
    }
    void action.run(async () => {
      await request(path, 'PATCH', payload);
      await reload();
      setStatus('Modificările au fost salvate.');
    });
  };
  const refreshBrand = (force: boolean) => {
    if (
      force &&
      !confirm('Înlocuiești valorile manuale cu brandingul detectat?')
    )
      return;
    void action.run(async () => {
      const result = await request<{
        skipped: boolean;
        detected: boolean;
        site: Site;
      }>(`${path}/refresh-branding${force ? '?force=1' : ''}`, 'POST');
      await reload();
      setName(result.site.name);
      setFormVersion((v) => v + 1);
      setStatus(
        result.skipped
          ? 'Brandingul manual a fost păstrat.'
          : result.detected
            ? 'Branding actualizat.'
            : 'Nu s-au găsit date de branding.',
      );
    });
  };
  const patchImage = async (id: string | null, kind: 'logo' | 'favicon') => {
    await request(path, 'PATCH', { [`${kind}_media_id`]: id });
    await reload();
  };
  return (
    <div className="stack">
      <div className="section-heading">
        <div className="brand-lockup" style={brandStyle(site)}>
          <Logo site={site} />
          <div>
            <span className="eyebrow">{site.domain}</span>
            <h1>{site.name}</h1>
          </div>
        </div>
        <span className={`badge ${site.status === 'active' ? 'good' : ''}`}>
          {states[site.status]}
        </span>
      </div>
      {action.error && <Alert>{action.error}</Alert>}
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      {site.status === 'deleting' ? (
        <Panel
          title="Curățare în așteptare"
          description="Portalul este inaccesibil. Dacă ștergerea a eșuat, reîncearcă."
        >
          <button className="button danger" onClick={remove}>
            Reîncearcă ștergerea
          </button>
        </Panel>
      ) : (
        <>
          <nav className="tabs site-settings-tabs" aria-label="Setări site">
            {(
              [
                ['setup', 'Configurare'],
                ['access', 'Acces client'],
                ['content', 'Editează site-ul'],
                ['media', 'Bibliotecă media'],
                ['reports', 'Raport'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => {
                  if (id !== tab && !leaveContent(dirty)) return;
                  setTab(id);
                  setServerKey('');
                  setStatus('');
                  action.setError('');
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === 'setup' && (
            <>
              <SiteAdministration
                detail={detail}
                path={path}
                reload={reload}
                setTab={setTab}
                setStatus={setStatus}
                disabled={action.busy}
              />
              <form key={formVersion} className="stack" onSubmit={save}>
                <Panel title="Setări site">
                  <div className="form-grid">
                    <Field label="Nume afișat">
                      <input
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </Field>
                    <Field
                      label="Tipul site-ului"
                      hint="Decide ce secțiuni are portalul: programări, magazin sau prezentare."
                    >
                      <select
                        name="site_type"
                        defaultValue={site.site_type || defaultSiteType}
                      >
                        {Object.entries(siteTypes).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Plan">
                      <input
                        name="plan"
                        defaultValue={site.plan}
                        required
                        maxLength={60}
                      />
                    </Field>
                    <Field
                      label="Hostname portal suplimentar"
                      hint="Necesită rutare și DNS separate în Cloudflare."
                    >
                      <input
                        name="portal_host"
                        defaultValue={site.portal_host || ''}
                        placeholder="admin.domeniu.ro"
                      />
                    </Field>
                    <Field label="Stare site">
                      <select name="status" defaultValue={site.status}>
                        <option value="active">Activ</option>
                        <option value="suspended">Suspendat</option>
                      </select>
                    </Field>
                  </div>
                </Panel>
                <Panel
                  title="Datele firmei"
                  description="Opționale. La salvare sunt disponibile pentru afișare în subsolul site-ului public."
                >
                  <CompanyFields
                    key={JSON.stringify(detail.company)}
                    values={detail.company}
                  />
                </Panel>
                <Panel
                  title="Branding"
                  description={`Sursă: ${({ html: 'Detectare HTML', 'well-known': 'Fișier well-known', default: 'Implicit', manual: 'Manual' } as Record<string, string>)[site.brand_source || 'default'] || 'Implicit'}`}
                >
                  <div className="form-grid colors">
                    {(
                      [
                        ['primary_color', 'Primară'],
                        ['secondary_color', 'Secundară'],
                        ['accent_color', 'Accent'],
                      ] as const
                    ).map(([id, label]) => (
                      <Field key={id} label={label}>
                        <input type="color" defaultValue={site[id]} name={id} />
                      </Field>
                    ))}
                    <Field label="Temă">
                      <select name="scheme" defaultValue={site.scheme}>
                        <option value="light">Luminoasă</option>
                        <option value="dark">Întunecată</option>
                      </select>
                    </Field>
                  </div>
                  <p className="muted">
                    Alege logoul și faviconul din biblioteca R2. Poți importa o
                    imagine dintr-un URL HTTPS.
                  </p>
                  <div className="controls">
                    <button
                      type="button"
                      className="button secondary small"
                      onClick={() => setTab('media')}
                    >
                      Deschide biblioteca
                    </button>
                    {site.logo_media_id && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(() => patchImage(null, 'logo'))
                        }
                      >
                        Elimină logoul
                      </button>
                    )}
                    {site.favicon_media_id && (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={action.busy}
                        onClick={() =>
                          void action.run(() => patchImage(null, 'favicon'))
                        }
                      >
                        Elimină faviconul
                      </button>
                    )}
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={action.busy}
                      onClick={() => refreshBrand(false)}
                    >
                      <RefreshCw size={14} /> Rescan
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={action.busy}
                      onClick={() => refreshBrand(true)}
                    >
                      Forțează rescan
                    </button>
                  </div>
                </Panel>
                <Panel title="Metrici și obiective">
                  <MetricEditor
                    value={metrics}
                    change={setMetrics}
                    locked={detail.currency_locked}
                  />
                </Panel>
                <div>
                  <button className="button primary" disabled={action.busy}>
                    {action.busy ? 'Se procesează…' : 'Salvează configurarea'}
                  </button>
                </div>
              </form>
              <Panel title="Integrare tracking">
                <div className="snippet">
                  <code>{tag}</code>
                  <CopyButton value={tag} />
                </div>
                <p className="muted">
                  Cheia server este separată de tokenul public. Păstreaz-o
                  exclusiv în backendul integrării.
                </p>
                <button
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() => {
                    if (
                      !detail.server_key_configured ||
                      confirm(
                        'Rotirea invalidează imediat cheia precedentă. Continui?',
                      )
                    )
                      void action.run(async () => {
                        setServerKey(
                          (
                            await request<{ key: string }>(
                              `${path}/metrics-key`,
                              'POST',
                            )
                          ).key,
                        );
                        await reload();
                      });
                  }}
                >
                  <KeyRound size={16} />{' '}
                  {detail.server_key_configured
                    ? 'Rotește cheia server'
                    : 'Generează cheia server'}
                </button>
                {serverKey && (
                  <Secret
                    title="Cheie server"
                    hint="Copiaz-o acum în secretele backendului. Nu va mai fi afișată."
                    secret={serverKey}
                    dismiss={() => setServerKey('')}
                  />
                )}
              </Panel>
              <Panel title="Notițe de la client">
                <p className="notes">{site.notes || 'Nu există notițe.'}</p>
              </Panel>
              <Panel
                title="Ștergere site"
                description="Șterge conturile, statisticile D1 și imaginile R2 pentru acest site."
              >
                <button className="button danger" onClick={remove}>
                  Șterge site-ul
                </button>
              </Panel>
            </>
          )}
          {tab === 'access' && (
            <>
              <Panel title="Link-ul clientului">
                <div className="controls">
                  <a href={clientLink} target="_blank" rel="noreferrer">
                    {clientLink} <ExternalLink size={14} />
                  </a>
                  <CopyButton value={clientLink} />
                </div>
                <p className="muted">
                  {routes[site.route_status || 'manual']}.{' '}
                  {site.portal_host && site.portal_host !== site.domain
                    ? 'Hostname-ul suplimentar se configurează manual. '
                    : ''}
                  Sincronizarea automată acoperă ruta de pe {site.domain}.
                </p>
                <button
                  className="button secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      const result = await request<{ status: string }>(
                        `${path}/sync-route`,
                        'POST',
                      );
                      await reload();
                      setStatus(routes[result.status] || result.status);
                    })
                  }
                >
                  <RefreshCw size={16} /> Sincronizează ruta
                </button>
              </Panel>
              <Accounts detail={detail} reload={reload} />
            </>
          )}
          {tab === 'media' && (
            <MediaLibrary
              siteId={site.id}
              onPick={patchImage}
              logo={site.logo_media_id}
              favicon={site.favicon_media_id}
              onChange={() => {
                void reload().catch((e) => action.setError(message(e)));
              }}
            />
          )}
          {tab === 'content' && (
            <ContentEditor
              site={site}
              staff
              onDirty={setDirty}
              onPublished={() => {
                void reload().catch((e) => action.setError(message(e)));
              }}
            />
          )}
          {tab === 'reports' && <SiteReports siteId={site.id} />}
        </>
      )}
    </div>
  );
}
function NewSite({ created }: { created: (id: string) => void }) {
  const [metrics, setMetrics] = useState<MetricSettings>(profileSettings()),
    // Choosing the type first is what shapes the portal afterwards; the metric
    // profile follows it, and both stay editable later.
    [type, setType] = useState(defaultSiteType),
    action = useAction();
  const blueprint = blueprintFor(type);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        void action.run(async () => {
          const { site } = await request<{ site: Site }>(
            '/admin/sites',
            'POST',
            {
              domain: fields.get('domain'),
              name: fields.get('name'),
              portal_host: fields.get('portal_host'),
              plan: fields.get('plan'),
              site_type: type,
              // The metric profile is sent explicitly: the API must not have to
              // guess it from the type.
              metrics,
              company: readCompanyFields(fields),
            },
          );
          created(site.id);
        });
      }}
    >
      <Panel
        title="Adaugă un site"
        description="Detectarea brandingului și sincronizarea rutei se încearcă automat."
      >
        {action.error && <Alert>{action.error}</Alert>}
        <div className="form-grid">
          <Field label="Domeniu" hint="Hostname, fără https:// sau cale.">
            <input
              name="domain"
              placeholder="client.ro"
              required
              maxLength={253}
            />
          </Field>
          <Field label="Nume afișat (opțional)">
            <input name="name" maxLength={100} />
          </Field>
          <Field
            label="Tipul site-ului"
            hint={blueprint.summary}
          >
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value as typeof type;
                setType(next);
                setMetrics(profileSettings(profileForType[next]));
              }}
            >
              {Object.entries(siteTypes).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plan">
            <input
              name="plan"
              required
              defaultValue="Standard"
              maxLength={60}
            />
          </Field>
          <Field label="Hostname portal suplimentar (opțional)">
            <input
              name="portal_host"
              placeholder="admin.client.ro"
              maxLength={253}
            />
          </Field>
        </div>
      </Panel>
      <Panel
        title="Datele firmei"
        description="Opționale. Datele completate vor fi disponibile pentru subsolul site-ului public."
      >
        <CompanyFields />
      </Panel>
      <Panel title="Metrici și obiective">
        <MetricEditor value={metrics} change={setMetrics} />
      </Panel>
      <div>
        <button className="button primary" disabled={action.busy}>
          {action.busy ? 'Se creează…' : 'Creează site-ul'}
        </button>
      </div>
    </form>
  );
}
function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>(),
    action = useAction();
  useEffect(() => {
    let active = true;
    request<{ entries: AuditEntry[] }>('/admin/audit').then(
      (r) => {
        if (active) setEntries(r.entries);
      },
      (e) => {
        if (active) action.setError(message(e));
      },
    );
    return () => {
      active = false;
    };
  }, [action.setError]);
  return (
    <Panel
      title="Jurnal de activitate"
      description="Ultimele 100 de operațiuni din platformă."
    >
      {action.error && <Alert>{action.error}</Alert>}
      {entries ? (
        entries.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operațiune</th>
                  <th>Utilizator</th>
                  <th>Site</th>
                  <th>Moment</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{auditLabels[entry.action] || entry.action}</td>
                    <td>{entry.username || '—'}</td>
                    <td>{entry.site_id || '—'}</td>
                    <td>{new Date(entry.at).toLocaleString('ro-RO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Nu sunt înregistrări.</Empty>
        )
      ) : (
        !action.error && <p role="status">Se încarcă jurnalul…</p>
      )}
    </Panel>
  );
}
function Recovery({ user, onLogout }: { user: User; onLogout: () => void }) {
  const action = useAction(),
    [u, setUser] = useState(user),
    [notice, setNotice] = useState('');
  return (
    <div className="stack">
      <Panel
        title="Email recuperare"
        description="Folosește o adresă pe care o controlezi; nu este verificată automat."
      >
        {action.error && <Alert>{action.error}</Alert>}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              fields = new FormData(form);
            void action.run(async () => {
              const result = await request<{ user: User }>(
                '/auth/recovery-email',
                'PATCH',
                {
                  email: fields.get('email'),
                  current_password: fields.get('password'),
                },
              );
              setUser(result.user);
              form.reset();
              setNotice('Adresa de recuperare a fost actualizată.');
            });
          }}
        >
          <Field label="Email de recuperare">
            <input
              type="email"
              name="email"
              defaultValue={u.email || ''}
              maxLength={254}
            />
          </Field>
          <Field label="Parola curentă">
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </Field>
          <button className="button primary" disabled={action.busy}>
            Salvează emailul
          </button>
        </form>
      </Panel>
      <Panel title="Sesiunile master">
        <button
          className="button secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await request('/auth/sessions/revoke-all', 'POST');
              onLogout();
            })
          }
        >
          Deconectează toate dispozitivele
        </button>
      </Panel>
    </div>
  );
}
const leaveContent = (dirty: boolean) =>
  !dirty || confirm('Renunți la modificările nepublicate?');
function requestedSite() {
  const id = new URLSearchParams(location.search).get('editSite') ?? '';
  return /^site_[0-9a-f]{24}$/.test(id) ? id : '';
}

export function MasterDashboard({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [id, setId] = useState(requestedSite),
    [tab, setTab] = useState<'sites' | 'new' | 'details' | 'audit' | 'account'>(
      id ? 'details' : 'sites',
    ),
    [startInContent, setStartInContent] = useState(!!id),
    [dirty, setDirty] = useState(false),
    [detail, setDetail] = useState<SiteDetail>(),
    [sites, setSites] = useState<Site[]>();
  const [overview, setOverview] = useState<{
      sites: number;
      active: number;
      clients: number;
      pageviews: number;
    }>(),
    [search, setSearch] = useState(''),
    [listVersion, setListVersion] = useState(0);
  const action = useAction();
  useEffect(() => {
    if (tab !== 'sites' && tab !== 'details') return;
    let active = true;
    const task =
      tab === 'sites'
        ? Promise.all([
            request<{ sites: Site[] }>('/admin/sites'),
            request<NonNullable<typeof overview>>('/admin/overview'),
          ]).then(([r, o]) => {
            if (active) {
              setSites(r.sites);
              setOverview(o);
            }
          })
        : request<SiteDetail>(adminSite(id)).then((r) => {
            if (active) setDetail(r);
          });
    task.catch((e) => {
      if (active) {
        if (e instanceof ApiError && e.status === 401) onLogout();
        else action.setError(message(e));
      }
    });
    return () => {
      active = false;
    };
  }, [tab, id, listVersion, onLogout, action.setError]);
  const open = (target: string, editContent = false) => {
    setStartInContent(editContent);
    setId(target);
    setDetail(undefined);
    action.setError('');
    setTab('details');
    window.scrollTo(0, 0);
  };
  const go = (target: typeof tab) => {
    if (!leaveContent(dirty)) return;
    if (
      target !== 'details' &&
      new URLSearchParams(location.search).has('editSite')
    )
      history.replaceState(null, '', location.pathname);
    action.setError('');
    setTab(target);
    if (target !== tab) window.scrollTo(0, 0);
  };
  const filtered = sites?.filter((s) =>
    `${s.name} ${s.domain}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const drop = () => {
    if (confirm(`Ștergi definitiv site-ul ${detail?.site.domain}?`))
      void action.run(async () => {
        await request(adminSite(id), 'DELETE');
        setSites(undefined);
        setOverview(undefined);
        go('sites');
      });
  };
  return (
    <div className="master-shell">
      <header className="topbar">
        <div className="wrap head-inner">
          <div className="brand-lockup">
            <VlloraLogo />
            <div>
              <span className="eyebrow">Vllora Studio</span>
              <p>Administrare portaluri client</p>
            </div>
          </div>
          <button
            className="button secondary"
            disabled={action.busy}
            onClick={() => {
              if (!leaveContent(dirty)) return;
              void action.run(async () => {
                await request('/auth/logout', 'POST');
                onLogout();
              });
            }}
          >
            <LogOut size={16} /> Deconectare
          </button>
        </div>
      </header>
      <main className="wrap page stack">
        <a className="text-button" href="/">
          <ArrowLeft size={16} /> Înapoi la panoul master
        </a>
        <nav className="tabs" aria-label="Master">
          {(
            [
              ['sites', 'Site-uri'],
              ['audit', 'Jurnal'],
              ['account', 'Email recuperare'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-current={
                tab === value ||
                (value === 'sites' && ['details', 'new'].includes(tab))
                  ? 'page'
                  : undefined
              }
              onClick={() => go(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        {action.error && <Alert>{action.error}</Alert>}
        {(tab === 'new' || tab === 'details') && (
          <div>
            <button className="text-button" onClick={() => go('sites')}>
              <ArrowLeft size={16} /> Înapoi la site-uri
            </button>
          </div>
        )}
        {tab === 'sites' && (
          <>
            <div className="hero">
              <div>
                <span className="eyebrow">Platformă · Super admin</span>
                <h1>Site-uri și acces</h1>
                <p className="muted">
                  Administrează portalele clienților dintr-un singur loc.
                </p>
              </div>
              <button className="button primary" onClick={() => go('new')}>
                <Plus size={17} /> Adaugă site
              </button>
            </div>
            {overview && (
              <div className="card-grid">
                {(
                  [
                    ['Site-uri', overview.sites, Globe2],
                    ['Site-uri active', overview.active, ShieldCheck],
                    ['Conturi client', overview.clients, Users],
                    ['Pagini · 30 zile (rollup)', overview.pageviews, Globe2],
                  ] as const
                ).map(([label, value, Icon]) => (
                  <article className="stat-card" key={label}>
                    <p>
                      <Icon size={17} /> {label}
                    </p>
                    <strong>{number.format(value)}</strong>
                  </article>
                ))}
              </div>
            )}
            <Panel title="Portale client">
              <div className="section-heading">
                <Field label="Caută după domeniu sau nume">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Field>
                <button
                  className="button secondary"
                  onClick={() => {
                    action.setError('');
                    setListVersion((v) => v + 1);
                  }}
                >
                  <RefreshCw size={15} /> Actualizează
                </button>
              </div>
              {filtered ? (
                filtered.length ? (
                  <>
                    <ul
                      className="staff-site-cards"
                      aria-label="Portale client"
                    >
                      {filtered.map((site) => (
                        <li key={site.id} className="staff-site-card">
                          <div
                            className="brand-lockup"
                            style={brandStyle(site)}
                          >
                            <Logo site={site} />
                            <div>
                              <strong>{site.name}</strong>
                              <p className="muted">{site.domain}</p>
                            </div>
                          </div>
                          <div className="staff-site-meta">
                            <span className="muted">Plan: {site.plan}</span>
                            <span
                              className={`badge ${site.status === 'active' ? 'good' : ''}`}
                            >
                              {states[site.status]}
                            </span>
                          </div>
                          <div className="staff-site-actions">
                            <button
                              className="button secondary"
                              onClick={() => open(site.id)}
                            >
                              Deschide
                            </button>
                            {site.status !== 'deleting' && (
                              <button
                                className="button primary"
                                onClick={() => open(site.id, true)}
                              >
                                Editează site-ul
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="table-scroll staff-site-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Site</th>
                            <th>Plan</th>
                            <th>Stare</th>
                            <th>Acțiuni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((site) => (
                            <tr key={site.id}>
                              <td>
                                <div
                                  className="brand-lockup"
                                  style={brandStyle(site)}
                                >
                                  <Logo site={site} />
                                  <div>
                                    <strong>{site.name}</strong>
                                    <p className="muted">{site.domain}</p>
                                  </div>
                                </div>
                              </td>
                              <td>{site.plan}</td>
                              <td>
                                <span
                                  className={`badge ${site.status === 'active' ? 'good' : ''}`}
                                >
                                  {states[site.status]}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="button secondary small"
                                  onClick={() => open(site.id)}
                                >
                                  Deschide
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <Empty>
                    {search
                      ? 'Niciun rezultat.'
                      : 'Nu ai încă site-uri. Adaugă primul portal client.'}
                  </Empty>
                )
              ) : (
                !action.error && <p role="status">Se încarcă site-urile…</p>
              )}
            </Panel>
          </>
        )}
        {tab === 'new' && <NewSite created={open} />}
        {tab === 'details' &&
          (detail ? (
            <SiteSettings
              key={detail.site.id}
              startInContent={startInContent}
              dirty={dirty}
              setDirty={setDirty}
              detail={detail}
              reload={async () => {
                setDetail(await request<SiteDetail>(adminSite(detail.site.id)));
              }}
              remove={drop}
            />
          ) : (
            !action.error && <p role="status">Se încarcă site-ul…</p>
          ))}
        {tab === 'audit' && <AuditLog />}
        {tab === 'account' && <Recovery user={user} onLogout={onLogout} />}
      </main>
    </div>
  );
}
