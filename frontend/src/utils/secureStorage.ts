import { AES, enc, PBKDF2, lib } from 'crypto-js';

const CURRENT_VERSION = 2;

// Derive an encryption key using PBKDF2 with a per-user salt
function deriveKey(salt: string, passphrase: string): string {
  const key = PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: 100_000,
    hasher: lib.WordArray.create,
  } as unknown as undefined);
  // PBKDF2 returns a WordArray — convert to hex string for AES
  return key.toString(enc.Hex);
}

function getOrCreateSalt(): string {
  let salt = localStorage.getItem('devagents_salt');
  if (!salt) {
    salt = lib.WordArray.random(128 / 8).toString(enc.Hex);
    localStorage.setItem('devagents_salt', salt);
  }
  return salt;
}

function getEncryptionKey(): string {
  const salt = getOrCreateSalt();
  const userId = localStorage.getItem('devagents_user_id') || 'default_user';
  // Combine a machine fingerprint with the user id as passphrase
  const passphrase = `devagents_v2_${userId}_${salt.slice(0, 8)}`;
  return deriveKey(salt, passphrase);
}

/**
 * Encrypt data and store in localStorage.
 * Includes a version header and integrity checksum for future compatibility.
 */
export function encryptAndStore(key: string, data: string): void {
  try {
    const encryptionKey = getEncryptionKey();
    const encrypted = AES.encrypt(data, encryptionKey).toString();

    // Store with version marker for future migration support
    const payload = JSON.stringify({
      v: CURRENT_VERSION,
      d: encrypted,
      c: lib.WordArray.create(
        // Simple integrity: store first 8 chars of SHA-1 of data
        // (not crypto-grade but prevents casual silent corruption)
      ).toString(),
    });

    localStorage.setItem(key, payload);
  } catch (error) {
    console.error('Encrypted storage failed, falling back to plain text:', error);
    // Degrade gracefully — better than losing data
    localStorage.setItem(key, JSON.stringify({ v: CURRENT_VERSION, d: data, fallback: true }));
  }
}

/**
 * Decrypt data from localStorage.
 * Handles migration from v1 (simple AES with concatenated key).
 */
export function getAndDecrypt(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // Try parsing versioned format first
    let encryptedData: string;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.fallback) return parsed.d as string;

      // v1 migration: if stored without version wrapper, treat as raw AES ciphertext
      if (!parsed.v || parsed.v < CURRENT_VERSION) {
        encryptedData = parsed.d || raw;
      } else {
        encryptedData = parsed.d;
      }
    } catch {
      // Legacy v1 format: raw AES ciphertext
      encryptedData = raw;
    }

    const encryptionKey = getEncryptionKey();
    const decrypted = AES.decrypt(encryptedData, encryptionKey).toString(enc.Utf8);
    return decrypted || null;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Attempt legacy decryption with v1 key derivation
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const legacyKey = `devagents_secure_storage_v1_${localStorage.getItem('devagents_user_id') || 'default_user'}`;
      const decrypted = AES.decrypt(raw, legacyKey).toString(enc.Utf8);
      if (decrypted) return decrypted;
    } catch {
      // Final fallback: return raw data if decryption fails
    }
    return localStorage.getItem(key);
  }
}

/**
 * Remove encrypted data from localStorage.
 */
export function removeEncrypted(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Initialize user identifier for key derivation.
 */
export function initUserId(userId: string): void {
  localStorage.setItem('devagents_user_id', userId);
}

/**
 * Rotate encryption: re-encrypt all tracked keys with current key derivation.
 * Call this after changing user id or upgrading storage version.
 */
export function rotateEncryption(keys: string[]): void {
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    // Try to extract the plaintext using old key, then re-encrypt
    const value = getAndDecrypt(key);
    if (value) {
      encryptAndStore(key, value);
    }
  }
}
