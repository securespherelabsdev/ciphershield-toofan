'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { encrypt } = require('../services/encryption');
const { generateToken, hashToken } = require('../services/tokenGenerator');
const { computeScore, wordSet, jaccardSimilarity } = require('../services/fpScoring');
const { decrypt } = require('../services/encryption');

const router = express.Router();

const VALID_REPORT_TYPES = [
  'Drug Sale Activity',
  'Drug Manufacturing',
  'Drug Transportation',
  'Storage Location',
  'Suspicious Person or Activity',
  'Other',
];

const VALID_DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha',
  'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur',
  'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
];

const VALID_TIME_OBSERVED = ['Today', 'Yesterday', 'Within the past week', 'More than a week ago'];
const VALID_CONFIDENCE    = ['I have a suspicion', 'I am fairly certain', 'I witnessed this directly'];

// Jaccard similarity threshold above which two reports are considered duplicates
const DUPLICATE_THRESHOLD = 0.60;
// Burst: how many reports in same district within 10 min triggers the flag
const BURST_THRESHOLD = 4; // 4 already exist → 5th is the burst

router.post('/', async (req, res) => {
  const {
    report_type,
    district,
    area_desc,
    time_observed,
    details,
    confidence_raw,
    geo_lat,
    geo_lng,
  } = req.body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
    return res.status(400).json({ error: 'Invalid or missing report_type.' });
  }
  if (district && !VALID_DISTRICTS.includes(district)) {
    return res.status(400).json({ error: 'Invalid district.' });
  }
  if (time_observed && !VALID_TIME_OBSERVED.includes(time_observed)) {
    return res.status(400).json({ error: 'Invalid time_observed.' });
  }
  if (confidence_raw && !VALID_CONFIDENCE.includes(confidence_raw)) {
    return res.status(400).json({ error: 'Invalid confidence_raw.' });
  }

  const safeAreaDesc = area_desc ? String(area_desc).slice(0, 500) : null;
  const safeDetails  = details   ? String(details).slice(0, 1000)  : null;

  let safeGeo = null;
  let parsedLat = null;
  let parsedLng = null;
  if (geo_lat != null && geo_lng != null) {
    const lat = parseFloat(geo_lat);
    const lng = parseFloat(geo_lng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      parsedLat = parseFloat(lat.toFixed(5));
      parsedLng = parseFloat(lng.toFixed(5));
      safeGeo = JSON.stringify({ lat: parsedLat, lng: parsedLng });
    }
  }

  // ── Burst detection ────────────────────────────────────────────────────────
  let isBurstSuspect = false;
  if (district) {
    try {
      const [burstRows] = await db.query(
        `SELECT COUNT(*) AS cnt FROM reports
         WHERE district = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)`,
        [district]
      );
      isBurstSuspect = (burstRows[0]?.cnt || 0) >= BURST_THRESHOLD;
    } catch (_) { /* non-fatal */ }
  }

  // ── Corroboration count ────────────────────────────────────────────────────
  let corroborationCount = 0;
  let recentDetailsEnc = [];
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM reports
       WHERE district = ? AND report_type = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [district || null, report_type]
    );
    corroborationCount = rows[0]?.cnt || 0;

    // Fetch encrypted details of recent corroborating reports for similarity check
    if (corroborationCount > 0 && safeDetails) {
      const [detRows] = await db.query(
        `SELECT details_enc FROM reports
         WHERE district = ? AND report_type = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND details_enc IS NOT NULL
         LIMIT 10`,
        [district || null, report_type]
      );
      recentDetailsEnc = detRows.map((r) => r.details_enc);
    }
  } catch (_) { /* non-fatal */ }

  // ── Duplicate cluster detection ────────────────────────────────────────────
  let isDuplicateCluster = false;
  if (recentDetailsEnc.length > 0 && safeDetails) {
    const newWords = wordSet(safeDetails);
    for (const enc of recentDetailsEnc) {
      try {
        const oldText = decrypt(enc);
        if (!oldText) continue;
        const oldWords = wordSet(oldText);
        if (jaccardSimilarity(newWords, oldWords) >= DUPLICATE_THRESHOLD) {
          isDuplicateCluster = true;
          break;
        }
      } catch (_) { /* decryption failure — skip */ }
    }
  }

  // ── Compute score ──────────────────────────────────────────────────────────
  const { score, status, breakdown, flags } = computeScore({
    confidence_raw,
    district,
    area_desc: safeAreaDesc,
    details:   safeDetails,
    time_observed,
    report_type,
    geo_lat:   parsedLat,
    geo_lng:   parsedLng,
    corroborationCount,
    isBurstSuspect,
    isDuplicateCluster,
  });

  const token     = generateToken();
  const tokenHash = hashToken(token);
  const id        = uuidv4();

  const area_desc_enc     = encrypt(safeAreaDesc);
  const details_enc       = encrypt(safeDetails);
  const geo_location_enc  = encrypt(safeGeo);
  const score_flags_json  = JSON.stringify({ breakdown, flags });

  await db.query(
    `INSERT INTO reports
     (id, token_hash, report_type, district, area_desc_enc, geo_location_enc, time_observed,
      details_enc, confidence_raw, fp_score, status, score_flags_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      tokenHash,
      report_type,
      district || null,
      area_desc_enc,
      geo_location_enc,
      time_observed || null,
      details_enc,
      confidence_raw || null,
      score,
      status,
      score_flags_json,
      req.receivedAt,
    ]
  );

  return res.status(201).json({
    token,
    status,
    score,
    message: 'Report received. Save your token — it is the only way to check your report status.',
  });
});

module.exports = router;
