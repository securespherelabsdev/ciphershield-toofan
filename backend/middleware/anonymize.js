/*
 * ANONYMIZE MIDDLEWARE — MUST BE REGISTERED FIRST IN server.js
 *
 * This middleware permanently discards all reporter-identifying
 * metadata before any route handler or logger sees the request.
 *
 * DO NOT reorder this middleware.
 * DO NOT add logging before it.
 * DO NOT pass req.ip or req.headers to any downstream function.
 *
 * This is the architectural privacy guarantee of CipherShield.
 * Reordering or bypassing this middleware breaks that guarantee.
 */

'use strict';

const HEADERS_TO_DELETE = [
  'x-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'x-cluster-client-ip',
  'forwarded',
  'user-agent',
  'referer',
  'referrer',
  'cookie',
  'accept-language',
  'accept-encoding',
  'x-request-id',
  'x-correlation-id',
  'via',
  'x-amzn-trace-id',
];

/**
 * Fuzz a date to the nearest 6-hour block.
 * 14:37 → 12:00, 22:15 → 18:00, 03:50 → 00:00, etc.
 */
function fuzzTimestamp(date) {
  const d = new Date(date);
  const hours = d.getUTCHours();
  const block = Math.floor(hours / 6) * 6;
  d.setUTCHours(block, 0, 0, 0);
  return d;
}

function anonymize(req, res, next) {
  // Permanently delete all identifying network metadata
  delete req.ip;
  delete req.ips;
  req.clientIp = null;

  // Strip all identifying headers
  for (const header of HEADERS_TO_DELETE) {
    delete req.headers[header];
  }

  // Fuzz the request timestamp to the nearest 6-hour block
  req.receivedAt = fuzzTimestamp(new Date());

  // Mark request as sanitized — downstream route handlers verify this flag
  req.sanitized = true;

  next();
}

/**
 * Guard middleware: any route handler that runs after anonymize.js
 * must verify req.sanitized === true before processing.
 * If this check fails, the anonymize middleware was bypassed — refuse to proceed.
 */
function requireSanitized(req, res, next) {
  if (req.sanitized !== true) {
    return res.status(500).json({
      error: 'Internal configuration error. Request pipeline integrity check failed.',
    });
  }
  next();
}

module.exports = { anonymize, requireSanitized, fuzzTimestamp };
