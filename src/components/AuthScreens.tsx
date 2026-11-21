import { useEffect, useState, type FormEvent } from 'react';
import type { PortalBrand } from '../../shared/portal-brand';
import { ArrowLeft, ArrowRight, KeyRound, LockKeyhole } from 'lucide-react';
import { mount, request, type Identity } from '../lib/api';
import { brandStyle } from '../lib/brand';
import { Alert, Field, Logo, TenantBrand, useAction } from './PortalUI';

const passwordHint =
  'Minimum 10 caractere, cu majusculă, minusculă, cifră și simbol.';
export function AuthScreens({
  identity,
  portalBrand,
  resetToken,
  onLogin,
  onLogout,
  onDismissReset,
}: {
  identity: Identity | null;
  portalBrand: PortalBrand | null;
  resetToken: string;
  onLogin: (v: Identity) => void;
  onLogout: () => void;
  onDismissReset: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(
    resetToken ? 'reset' : 'login',
  );
  const [notice, setNotice] = useState('');
  const action = useAction();
  useEffect(() => {
    if (resetToken) {
      setMode('reset');
      setNotice('');
    }
  }, [resetToken]);
  const brand = identity?.site ?? portalBrand;
  const changing = !!identity?.must_change_password && mode !== 'reset';
  const title = changing
    ? 'Setează-ți parola'
    : mode === 'login'
      ? 'Bine ai revenit'
      : mode === 'forgot'
        ? 'Recuperează accesul'
        : 'Setează o parolă nouă';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void action.run(async () => {
      setNotice('');
      if (
        (changing || mode === 'reset') &&
        fields.get('new_password') !== fields.get('confirmation')
      )
        throw new Error('Parolele noi nu coincid.');
      if (changing)
        onLogin(
          await request<Identity>('/auth/change-password', 'POST', {
            current_password: fields.get('password'),
            new_password: fields.get('new_password'),
          }),
        );
      else if (mode === 'login')
        onLogin(
          await request<Identity>('/auth/login', 'POST', {
            username: fields.get('username'),
            password: fields.get('password'),
          }),
        );
      else if (mode === 'forgot')
        setNotice(
          (
            await request<{ message: string }>(
              '/auth/forgot-password',
              'POST',
              { identifier: fields.get('identifier') },
            )
          ).message,
        );
      else {
        await request('/auth/reset-password', 'POST', {
          token: resetToken,
          new_password: fields.get('new_password'),
        });
        onLogout();
        setMode('login');
        setNotice('Parola a fost schimbată. Autentifică-te cu parola nouă.');
      }
    });
  };
  const go = (next: 'login' | 'forgot') => {
    if (mode === 'reset') onDismissReset();
    setMode(next);
    setNotice('');
    action.setError('');
  };
  return (
    <main
      className={`auth-shell ${brand?.scheme === 'dark' ? 'dark-portal' : ''}`}
      style={brandStyle(brand)}
    >
      <div className="auth-card">
        {mount ? (
          <TenantBrand site={brand} />
        ) : (
          <div className="brand-lockup">
            <Logo />
            <div>
              <span className="eyebrow">Vllora Studio</span>
              <p>Administrare portaluri client</p>
            </div>
          </div>
        )}
        <div className="auth-intro">
          <span className="auth-icon">
            {changing || mode === 'reset' ? (
              <KeyRound size={21} />
            ) : (
              <LockKeyhole size={21} />
            )}
          </span>
          <h1>{title}</h1>
          <p className="muted">
            {changing
              ? 'Ai intrat cu o parolă temporară. Pentru a accesa portalul, setează o parolă proprie.'
              : mode === 'login'
                ? 'Autentifică-te pentru a intra în spațiul tău.'
                : mode === 'forgot'
                  ? 'Introdu utilizatorul sau adresa asociată contului.'
                  : 'Alege o parolă nouă pentru contul tău.'}
          </p>
        </div>
        {action.error && <Alert>{action.error}</Alert>}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <form
          key={changing ? 'change' : mode}
          onSubmit={submit}
          className="stack"
        >
          {!changing && mode === 'login' && (
            <Field label="Utilizator">
              <input
                name="username"
                autoComplete="username"
                maxLength={254}
                required
              />
            </Field>
          )}
          {mode === 'forgot' && (
            <Field label="Email sau utilizator">
              <input
                name="identifier"
                autoComplete="username"
                maxLength={254}
                required
              />
            </Field>
          )}
          {(changing || mode === 'login') && (
            <Field label={changing ? 'Parola temporară' : 'Parolă'}>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
              />
            </Field>
          )}
          {(changing || mode === 'reset') && (
            <>
              <Field label="Parolă nouă" hint={passwordHint}>
                <input
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={256}
                  required
                />
              </Field>
              <Field label="Confirmă parola">
                <input
                  name="confirmation"
                  type="password"
                  autoComplete="new-password"
                  maxLength={256}
                  required
                />
              </Field>
            </>
          )}
          <button className="button primary" disabled={action.busy}>
            {action.busy
              ? 'Se procesează…'
              : changing || mode === 'reset'
                ? 'Salvează parola'
                : mode === 'forgot'
                  ? 'Trimite linkul'
                  : 'Autentifică-te'}
            <ArrowRight size={16} />
          </button>
        </form>
        {!changing &&
          (mode === 'login' ? (
            <button
              className="text-button"
              disabled={action.busy}
              onClick={() => go('forgot')}
            >
              Ai uitat parola?
            </button>
          ) : (
            <button
              className="text-button"
              disabled={action.busy}
              onClick={() => go('login')}
            >
              <ArrowLeft size={14} /> Înapoi la autentificare
            </button>
          ))}
        {changing && (
          <button
            className="text-button"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await request('/auth/logout', 'POST');
                onLogout();
              })
            }
          >
            Deconectare
          </button>
        )}
      </div>
    </main>
  );
}
