'use strict';

/*
 * AES-256-GCM encryption using Node.js native crypto only.
 * No third-party encryption libraries are used or permitted.
 *
 * Each encrypted value uses a unique random IV (nonce).
 * The IV is prepended to the ciphertext and auth tag in the stored string,
 * so decryption is self-contained with no external IV storage.
 *
 * Format stored: <hex_iv>:<hex_authtag>:<hex_ciphertext>
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = parseInt(process.env.ENCRYPTION_IV_LENGTH || '12', 10);
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.trim().length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex.trim(), 'hex');
}

/**
 * Encrypt a plaintext string. Returns a storable string:
 * <hex_iv>:<hex_authtag>:<hex_ciphertext>
 */
function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a stored string produced by encrypt().
 * Returns the original plaintext string, or null if input is null.
 */
function decrypt(stored) {
  if (stored == null) return null;
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
