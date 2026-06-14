'use strict';

/*
 * Anonymous one-time status token generator.
 *
 * The token is given to the reporter after submission.
 * Only its SHA-256 hash is stored in the database.
 * There is no mapping from token to reporter identity.
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically random token suitable for display to citizens.
 * Format: XXXX-XXXX-XXXX-XXXX (hex groups, uppercase — easy to write down)
 */
function generateToken() {
  const bytes = crypto.randomBytes(8);
  const hex = bytes.toString('hex').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

/**
 * Hash a token for database storage.
 * The raw token is never stored; only this hash is written.
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { generateToken, hashToken };
