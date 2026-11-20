import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { encode, equal, fail, random, type Env } from './core';

const ITERATIONS = 210_000;
const SALT_PATTERN = /^[0-9a-f]{32}$/;
const KEY_PATTERN = /^[0-9a-f]{64}$/;
const STORED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{64}$/;
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(64)}`;
const textEncoder = new TextEncoder();

// Private binding only. Run the expensive derivation outside the HTTP Worker's
// CPU budget and without the production Web Crypto PBKDF2 iteration cap.
// The object has no persistent state and never logs credentials or digests.
export class PasswordKdf {
  async fetch(request: Request): Promise<Response> {
    if (
      request.method !== 'POST' ||
      new URL(request.url).pathname !== '/derive'
    )
      return new Response(null, { status: 404 });
    const { password, salt } = await request.json<{
      password?: unknown;
      salt?: unknown;
    }>();
    if (
      typeof password !== 'string' ||
      password.length > 256 ||
      typeof salt !== 'string' ||
      !SALT_PATTERN.test(salt)
    )
      return new Response(null, { status: 400 });

    // The previous implementation used UTF-8 bytes of the salt's hex text
    // (not decoded hex), so old D1 hashes stay byte-for-byte compatible.
    const key = pbkdf2(
      sha256,
      textEncoder.encode(password),
      textEncoder.encode(salt),
      { c: ITERATIONS, dkLen: 32 },
    );
    try {
      return new Response(encode(key), {
        headers: { 'Cache-Control': 'no-store' },
      });
    } finally {
      key.fill(0);
    }
  }
}

async function deriveKey(env: Env, password: string, salt: string) {
  try {
    // Distribute concurrent logins over a bounded set of stateless objects.
    const shard = crypto.getRandomValues(new Uint8Array(1))[0] % 32;
    const stub = env.PASSWORD_KDF.get(
      env.PASSWORD_KDF.idFromName(`kdf-${shard}`),
    );
    const response = await stub.fetch('https://password-kdf.internal/derive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, salt }),
    });
    if (response.ok) {
      const key = await response.text();
      if (KEY_PATTERN.test(key)) return key;
    }
  } catch {
    // Log only a fixed code, never an internal request, password or digest.
  }
  console.error('password_kdf_unavailable');
  return fail(503, 'Autentificarea este temporar indisponibilă.');
}

export async function hashPassword(env: Env, password: string) {
  const salt = random(16);
  return `${salt}:${await deriveKey(env, password, salt)}`;
}

export async function verifyPassword(
  env: Env,
  password: string,
  stored?: string,
) {
  const valid = typeof stored === 'string' && STORED_PATTERN.test(stored);
  const [salt, expected] = (valid ? stored : DUMMY_HASH).split(':');
  // Unknown usernames and malformed rows do the same KDF work as valid rows.
  const matches = equal(await deriveKey(env, password, salt), expected);
  return valid && matches;
}
