// src/services/credentials.ts

export interface SecureCredential {
  v: 1;
  algo: 'PBKDF2-SHA256';
  iter: 120000;
  salt: string; // Base64
  hash: string; // Base64
}

/**
 * Constant-time string comparison to mitigate timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Converts ArrayBuffer / Uint8Array to Base64 string safely across browser and Node.
 */
export function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to Uint8Array safely across browser and Node.
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Returns the WebCrypto SubtleCrypto implementation available in the current environment.
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('WebCrypto subtle crypto is not supported in this runtime environment.');
}

/**
 * Hashes a plaintext password using PBKDF2-SHA256 with 120,000 iterations.
 */
export async function hashPassword(password: string, customSaltB64?: string): Promise<SecureCredential> {
  const subtle = getSubtleCrypto();
  let saltBytes: Uint8Array;
  if (customSaltB64) {
    saltBytes = base64ToUint8Array(customSaltB64);
  } else {
    saltBytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(saltBytes as any);
  }

  const enc = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    (enc.encode(password) as unknown as ArrayBuffer),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: (saltBytes as unknown as ArrayBuffer),
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  return {
    v: 1,
    algo: 'PBKDF2-SHA256',
    iter: 120000,
    salt: bufferToBase64(saltBytes),
    hash: bufferToBase64(derivedBits),
  };
}

/**
 * Verifies a plaintext password against a stored SecureCredential in constant time.
 */
export async function verifyPassword(password: string, credential?: SecureCredential | null): Promise<boolean> {
  if (!credential || credential.v !== 1 || credential.algo !== 'PBKDF2-SHA256') {
    return false;
  }
  if (!credential.salt || !credential.hash) {
    return false;
  }
  const derived = await hashPassword(password, credential.salt);
  return constantTimeCompare(derived.hash, credential.hash);
}
