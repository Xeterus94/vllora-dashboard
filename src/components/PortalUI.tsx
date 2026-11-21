import {
  cloneElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Check, Copy, ImageOff } from 'lucide-react';
import { portalLabel, type PortalBrand } from '../../shared/portal-brand';
import { message } from '../lib/api';
import { initials, vlloraLogoUrl } from '../lib/brand';

export function VlloraLogo() {
  return <img className="site-logo" src={vlloraLogoUrl} alt="" />;
}

export function Logo({
  site,
  fallback,
}: {
  site?: Pick<PortalBrand, 'logo_url' | 'name'> | null;
  fallback?: string;
}) {
  const [failed, setFailed] = useState('');
  return (
    <span className="site-logo">
      {site?.logo_url && failed !== site.logo_url ? (
        <img
          src={site.logo_url}
          onError={() => setFailed(site.logo_url!)}
          alt=""
        />
      ) : (
        initials(site?.name || fallback || '')
      )}
    </span>
  );
}
export function TenantBrand({ site }: { site?: PortalBrand | null }) {
  const name = site?.name || location.hostname;
  return (
    <div className="brand-lockup">
      <Logo site={site} fallback={name} />
      <div>
        <p>{name}</p>
        <span className="eyebrow tenant-label">{portalLabel}</span>
      </div>
    </div>
  );
}
export function CopyButton({
  value,
  label = 'Copiază',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false),
    [error, setError] = useState(false);
  return (
    <span>
      <button
        type="button"
        className="button secondary small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setError(false);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setError(true);
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
        {copied ? 'Copiat' : label}
      </button>
      {error && <small role="status"> Selectează și copiază manual.</small>}
    </span>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="error">
      {children}
    </p>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        id,
        'aria-describedby': hint ? `${id}-hint` : undefined,
      })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {description && <p className="muted">{description}</p>}
      {children}
    </section>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <ImageOff size={20} aria-hidden />
      {children}
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}
