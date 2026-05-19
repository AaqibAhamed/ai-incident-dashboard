const KEY_STORAGE = 'aid_crypto_key_v1';

async function subtle(): Promise<SubtleCrypto> {
  // globalThis.crypto.subtle should exist in browsers and jsdom (vitest with jsdom)
  const g = globalThis as unknown as { crypto?: Crypto };
  if (!g.crypto || !g.crypto.subtle) {
    throw new Error('Web Crypto API not available in this environment');
  }
  return g.crypto.subtle;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const sub = await subtle();
  const stored = (() => {
    try {
      return sessionStorage.getItem(KEY_STORAGE);
    } catch {
      return null;
    }
  })();
  if (stored) {
    try {
      const jwk = JSON.parse(stored) as JsonWebKey;
      return await sub.importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    } catch {
      // fallthrough to generate
    }
  }
  const key = await sub.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const jwk = await sub.exportKey('jwk', key);
  try {
    sessionStorage.setItem(KEY_STORAGE, JSON.stringify(jwk));
  } catch {
    // ignore storage errors
  }
  return key;
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptState(obj: unknown): Promise<string> {
  const key = await getOrCreateKey();
  const sub = await subtle();
  const g = globalThis as unknown as { crypto?: Crypto };
  const iv = g.crypto!.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(obj));
  const ct = await sub.encrypt({ name: 'AES-GCM', iv }, key, data);
  // store iv + ciphertext as base64
  const combined = new Uint8Array(iv.byteLength + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.byteLength);
  return bufToBase64(combined.buffer);
}

export async function decryptState(b64: string): Promise<Record<string, unknown> | null> {
  try {
    const key = await getOrCreateKey();
    const sub = await subtle();
    const combined = base64ToBuf(b64);
    if (combined.length < 13) return null;
    const iv = combined.slice(0, 12);
    const ct = combined.slice(12).buffer;
    const plain = await sub.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const decoder = new TextDecoder();
    const text = decoder.decode(plain);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// parse JWT payload (base64url) safely
export function parseJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  // base64url -> base64
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(atob(b64));
    } catch {
      return null;
    }
  }
}

// calculate milliseconds until refresh (returns 0 for immediate, or null if not calculable)
export function calculateRefreshDelay(token: string | null, bufferSeconds = 60): number | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;
  const exp = payload['exp'];
  if (typeof exp !== 'number') return null;
  const expiresAt = exp * 1000;
  const now = Date.now();
  const delay = Math.max(0, expiresAt - now - bufferSeconds * 1000);
  return delay;
}
