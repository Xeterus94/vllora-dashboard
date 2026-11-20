import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  all,
  audit,
  dev,
  equal,
  fail,
  hash,
  ipKey,
  json,
  random,
  rate,
  required,
  siteView,
  stmt,
  text,
  userView,
  type Bindings,
  type Ctx,
  type Site,
  type User,
} from './core';
import { hashPassword, verifyPassword } from './password';

const SID = 'vllora_sid';
const TTL = 12 * 60 * 60;
const RESET_TTL = 30 * 60 * 1000;
const MINUTE = 60 * 1000;
const generic =
  'Dacă există un cont eligibil, vei primi un email de recuperare.';
const cookieOptions = (c: Ctx) => ({
  path: c.get('tenant') ? '/admin' : '/',
  httpOnly: true,
  sameSite: 'Lax' as const,
  secure:
    new URL(c.req.url).protocol === 'https:' ||
    !dev(c.env) ||
    c.get('host').endsWith('.e2b.app'),
});
export const clearCookie = (c: Ctx) => deleteCookie(c, SID, cookieOptions(c));
export const strong = (input: unknown) => {
  if (
    typeof input !== 'string' ||
    input.length < 10 ||
    input.length > 256 ||
    !/\p{Lu}/u.test(input) ||
    !/\p{Ll}/u.test(input) ||
    !/[0-9]/.test(input) ||
    !/[^\p{L}\p{N}\s]/u.test(input)
  )
    return fail(
      400,
      'Parola trebuie să aibă cel puțin 10 caractere: majusculă, minusculă, cifră și simbol.',
    );
  return input;
};
export function username(input: unknown) {
  const value = text(input, 64, 'Utilizator').toLowerCase();
  if (!/^[a-z0-9][a-z0-9_.-]{2,63}$/.test(value))
    fail(
      400,
      'Utilizator invalid: 3–64 caractere (litere, cifre, ., _ sau -).',
    );
  return value;
}
export function email(input: unknown) {
  if (input === null || input === '') return null;
  const value = text(input, 254, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    fail(400, 'Adresa de email nu este validă.');
  return value;
}
export function temporary() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let value = '';
  while (value.length < 14)
    for (const n of crypto.getRandomValues(new Uint8Array(20))) {
      if (n < 256 - (256 % alphabet.length) && value.length < 14)
        value += alphabet[n % alphabet.length];
    }
  return `${value.slice(0, 4)}-${value.slice(4, 9)}-${value.slice(9)}`;
}
const scope = (tenant: Site | null) =>
  tenant
    ? "role='client_admin' AND client_id=?"
    : "role='super_admin' AND client_id IS NULL";

export async function authenticate(c: Ctx) {
  const raw = getCookie(c, SID);
  if (!raw || !/^[a-f0-9]{64}$/.test(raw))
    return fail(401, 'Autentificare necesară.');
  const digest = await hash(raw),
    tenant = c.get('tenant');
  const user = await stmt(
    c.env,
    `SELECT u.* FROM sessions x JOIN users u ON x.user_id=u.id
    WHERE x.token_hash=? AND x.host=? AND x.expires_at>? AND x.password_version=u.password_version AND ${scope(tenant)}`,
    digest,
    c.get('host'),
    Date.now(),
    ...(tenant ? [tenant.id] : []),
  ).first<User>();
  if (!user || (tenant && tenant.status !== 'active'))
    return fail(401, 'Sesiune expirată sau indisponibilă.');
  c.set('user', user);
  c.set('session', digest);
  return user;
}
export async function requireRole(c: Ctx, role: User['role']) {
  const u = await authenticate(c);
  if (u.role !== role || u.must_change_password)
    fail(
      403,
      u.must_change_password
        ? 'Schimbă parola pentru a continua.'
        : 'Acces interzis.',
    );
  return u;
}
const identity = (c: Ctx, user: User) => {
  const tenant = c.get('tenant');
  return {
    user: userView(user),
    site: tenant
      ? {
          ...siteView(c.env, tenant, false, '/admin'),
          ...(user.must_change_password ? { notes: '' } : {}),
        }
      : null,
    must_change_password: Boolean(user.must_change_password),
  };
};
export const auth = new Hono<Bindings>();
auth.post('/login', async (c) => {
  const b = await json(c, 4096),
    login = text(b.username, 254, 'Utilizator').toLowerCase();
  const password =
    typeof b.password === 'string' && b.password.length <= 256
      ? b.password
      : '';
  const host = c.get('host'),
    tenant = c.get('tenant');
  const accountKey = `login:u:${await hash(`${host}|${login}`)}`;
  const loginError = 'Utilizator sau parolă incorectă.';
  if (!(await rate(c.env, `login:ip:${await ipKey(c)}`, 100, 15 * MINUTE)))
    return fail(429, loginError);
  if (!(await rate(c.env, accountKey, 5, 15 * MINUTE, true)))
    return fail(429, loginError);
  const u = await stmt(
    c.env,
    `SELECT * FROM users WHERE username=? AND ${scope(tenant)}`,
    login,
    ...(tenant ? [tenant.id] : []),
  ).first<User>();
  if (
    !(await verifyPassword(c.env, password, u?.password_hash)) ||
    !u ||
    (tenant && tenant.status !== 'active')
  )
    return fail(401, loginError);
  const token = random(),
    digest = await hash(token);
  const [inserted] = await c.env.DB.batch([
    stmt(
      c.env,
      `INSERT INTO sessions SELECT ?,id,?,password_version,? FROM users WHERE id=? AND password_version=?
      AND (client_id IS NULL OR EXISTS(SELECT 1 FROM sites s JOIN site_hosts h ON h.site_id=s.id WHERE s.id=users.client_id AND s.status='active' AND h.host=?))`,
      digest,
      host,
      Date.now() + TTL * 1000,
      u.id,
      u.password_version,
      host,
    ),
    stmt(c.env, 'DELETE FROM rate_limits WHERE key=?', accountKey),
    audit(c.env, 'login', u.id, u.client_id),
  ]);
  if (!inserted.meta.changes) return fail(401, loginError);
  setCookie(c, SID, token, { ...cookieOptions(c), maxAge: TTL });
  return c.json(identity(c, u));
});
auth.get('/me', async (c) => c.json(identity(c, await authenticate(c))));
auth.post('/logout', async (c) => {
  const token = getCookie(c, SID);
  if (token && /^[a-f0-9]{64}$/.test(token))
    await stmt(
      c.env,
      'DELETE FROM sessions WHERE token_hash=? AND host=?',
      await hash(token),
      c.get('host'),
    ).run();
  clearCookie(c);
  return c.json({ ok: true });
});
auth.post('/sessions/revoke-all', async (c) => {
  const u = await authenticate(c);
  await c.env.DB.batch([
    stmt(c.env, 'DELETE FROM sessions WHERE user_id=?', u.id),
    audit(c.env, 'sessions_revoked', u.id, u.client_id),
  ]);
  clearCookie(c);
  return c.json({ ok: true });
});
auth.post('/change-password', async (c) => {
  const u = await authenticate(c),
    b = await json(c, 4096);
  const current = b.current_password,
    next = strong(b.new_password);
  if (
    typeof current !== 'string' ||
    current.length > 256 ||
    next === current ||
    !(await verifyPassword(c.env, current, u.password_hash))
  )
    return fail(
      400,
      'Parola curentă este incorectă sau parola nouă nu diferă.',
    );
  const token = random(),
    digest = await hash(token),
    oldSession = c.get('session');
  const [updated] = await c.env.DB.batch([
    stmt(
      c.env,
      `UPDATE users SET password_hash=?,password_version=password_version+1,must_change_password=0 WHERE id=? AND password_version=?
      AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=users.id AND expires_at>?)`,
      await hashPassword(c.env, next),
      u.id,
      u.password_version,
      oldSession,
      Date.now(),
    ),
    stmt(
      c.env,
      `INSERT INTO sessions SELECT ?,id,?,?,? FROM users WHERE id=? AND password_version=? AND EXISTS(SELECT 1 FROM sessions WHERE token_hash=? AND user_id=users.id AND password_version=?)`,
      digest,
      c.get('host'),
      u.password_version + 1,
      Date.now() + TTL * 1000,
      u.id,
      u.password_version + 1,
      oldSession,
      u.password_version,
    ),
    stmt(
      c.env,
      'DELETE FROM sessions WHERE user_id=? AND password_version<(SELECT password_version FROM users WHERE id=?)',
      u.id,
      u.id,
    ),
    stmt(
      c.env,
      'DELETE FROM password_resets WHERE user_id=? AND password_version<(SELECT password_version FROM users WHERE id=?)',
      u.id,
      u.id,
    ),
  ]);
  if (!updated.meta.changes)
    return fail(409, 'Parola sau sesiunea a fost deja schimbată.');
  await audit(c.env, 'password_changed', u.id, u.client_id).run();
  setCookie(c, SID, token, { ...cookieOptions(c), maxAge: TTL });
  return c.json(identity(c, { ...u, must_change_password: 0 }));
});
auth.patch('/recovery-email', async (c) => {
  const u = await requireRole(c, 'super_admin'),
    b = await json(c, 4096),
    value = email(b.email);
  if (
    typeof b.current_password !== 'string' ||
    b.current_password.length > 256 ||
    !(await verifyPassword(c.env, b.current_password, u.password_hash))
  )
    return fail(400, 'Parola curentă este incorectă.');
  const [updated] = await c.env.DB.batch([
    stmt(
      c.env,
      'UPDATE users SET email=? WHERE id=? AND password_version=?',
      value,
      u.id,
      u.password_version,
    ),
    stmt(
      c.env,
      'DELETE FROM password_resets WHERE user_id=? AND email IS NOT ?',
      u.id,
      value,
    ),
  ]);
  if (!updated.meta.changes) return fail(409, 'Contul a fost modificat.');
  await audit(c.env, 'recovery_email_changed', u.id, null).run();
  return c.json({ user: userView({ ...u, email: value }) });
});

auth.post('/forgot-password', async (c) => {
  const body = await json(c, 4096);
  const login =
    typeof body.identifier === 'string'
      ? body.identifier.trim().toLowerCase().slice(0, 254)
      : '';
  const response = () => c.json({ message: generic }, 202);
  const tenant = c.get('tenant'),
    host = c.get('host');
  if (
    !(await rate(c.env, `forgot:ip:${await ipKey(c)}`, 10, 15 * MINUTE)) ||
    !login ||
    (tenant && tenant.status !== 'active')
  )
    return response();
  const matches = await all<User>(
    c.env,
    `SELECT * FROM users WHERE (username=? OR email=?) AND ${scope(tenant)} ORDER BY (username=?) DESC LIMIT 2`,
    login,
    login,
    ...(tenant ? [tenant.id] : []),
    login,
  );
  const u = matches[0];
  if (!u?.email || (matches.length > 1 && u.username !== login))
    return response();
  const { RESEND_API_KEY: key, EMAIL_FROM: from, APP_ORIGIN: origin } = c.env;
  if (!key || !from || (!tenant && !origin)) {
    console.warn('password_reset_email_not_configured');
    return response();
  }
  if (!(await rate(c.env, `forgot:user:${u.id}`, 3, 60 * MINUTE)))
    return response();
  const link = tenant
    ? new URL(`https://${host}/admin/`)
    : new URL('/', origin);
  const token = random(),
    digest = await hash(token);
  link.hash = `reset=${token}`;
  await stmt(
    c.env,
    'INSERT INTO password_resets(token_hash,user_id,host,email,password_version,expires_at) VALUES(?,?,?,?,?,?)',
    digest,
    u.id,
    link.hostname,
    u.email,
    u.password_version,
    Date.now() + RESET_TTL,
  ).run();
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const url =
          dev(c.env) && c.env.DEV_EMAIL_API_URL
            ? c.env.DEV_EMAIL_API_URL
            : 'https://api.resend.com/emails';
        const sent = await fetch(url, {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [u.email],
            subject: 'Resetare parolă · Vllora',
            text: `Setează o parolă nouă în următoarele 30 de minute:\n${link.href}\n\nDacă nu ați cerut dvs. resetarea parolei, vă rugăm să ignorați acest email.`,
          }),
        });
        if (!sent.ok) throw new Error();
      } catch {
        console.warn('password_reset_email_failed');
        await stmt(
          c.env,
          'DELETE FROM password_resets WHERE token_hash=?',
          digest,
        ).run();
        return;
      }
      await audit(c.env, 'password_reset_sent', u.id, u.client_id).run();
    })(),
  );
  return response();
});
auth.post('/reset-password', async (c) => {
  if (!(await rate(c.env, `reset:ip:${await ipKey(c)}`, 20, 15 * MINUTE)))
    return fail(429, 'Prea multe încercări. Revino mai târziu.');
  const b = await json(c, 4096),
    next = strong(b.new_password),
    tenant = c.get('tenant');
  const invalid = 'Linkul de resetare este invalid sau a expirat.';
  if (typeof b.token !== 'string' || !/^[a-f0-9]{64}$/.test(b.token))
    return fail(400, invalid);
  const digest = await hash(b.token),
    now = Date.now(),
    host = c.get('host');
  const row = await stmt(
    c.env,
    `SELECT u.* FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.host=? AND r.used_at IS NULL AND r.expires_at>? AND r.password_version=u.password_version AND r.email=u.email AND ${scope(tenant)}`,
    digest,
    host,
    now,
    ...(tenant ? [tenant.id] : []),
  ).first<User>();
  if (!row || (tenant && tenant.status !== 'active')) return fail(400, invalid);
  const nextHash = await hashPassword(c.env, next);
  const [result] = await c.env.DB.batch([
    stmt(
      c.env,
      `UPDATE users SET password_hash=?,password_version=password_version+1,must_change_password=0 WHERE id=? AND password_version=?
      AND (client_id IS NULL OR EXISTS(SELECT 1 FROM site_hosts h JOIN sites s ON s.id=h.site_id WHERE h.host=? AND s.id=users.client_id AND s.status='active'))
      AND EXISTS(SELECT 1 FROM password_resets r WHERE r.token_hash=? AND r.used_at IS NULL AND r.expires_at>? AND r.email=users.email)`,
      nextHash,
      row.id,
      row.password_version,
      host,
      digest,
      Date.now(),
    ),
    stmt(
      c.env,
      'DELETE FROM sessions WHERE user_id=? AND password_version<(SELECT password_version FROM users WHERE id=?)',
      row.id,
      row.id,
    ),
    stmt(
      c.env,
      'DELETE FROM password_resets WHERE user_id=? AND password_version<(SELECT password_version FROM users WHERE id=?)',
      row.id,
      row.id,
    ),
  ]);
  if (!result.meta.changes) return fail(400, invalid);
  await audit(c.env, 'password_reset_completed', row.id, row.client_id).run();
  clearCookie(c);
  return c.json({ ok: true });
});

export async function bootstrap(c: Ctx) {
  if (
    c.get('tenant') ||
    !c.env.BOOTSTRAP_TOKEN ||
    c.env.BOOTSTRAP_TOKEN.length < 16
  )
    return fail(404, 'Ruta nu există.');
  if (!equal(c.env.BOOTSTRAP_TOKEN, c.req.header('x-bootstrap-token') || ''))
    return fail(403, 'Acces interzis.');
  const b = await json(c, 4096),
    id = `u_${random(12)}`,
    login = username(b.username);
  const [result] = await c.env.DB.batch([
    stmt(
      c.env,
      `INSERT OR IGNORE INTO users(id,username,name,email,role,password_hash,must_change_password,created_at) VALUES(?,?,?,?,'super_admin',?,0,?)`,
      id,
      login,
      text(b.name, 100, 'Nume'),
      b.email === undefined ? null : email(b.email),
      await hashPassword(c.env, strong(b.password)),
      Date.now(),
    ),
    stmt(
      c.env,
      `INSERT INTO audit_log(actor_id,site_id,action,at) SELECT id,NULL,'bootstrap',? FROM users WHERE id=?`,
      Date.now(),
      id,
    ),
  ]);
  if (!result.meta.changes) return fail(409, 'Contul master există deja.');
  return c.json(
    {
      user: userView(
        required(
          await stmt(c.env, 'SELECT * FROM users WHERE id=?', id).first<User>(),
        ),
      ),
    },
    201,
  );
}
