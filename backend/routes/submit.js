'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { encrypt } = require('../services/encryption');
const { generateToken, hashToken } = require('../services/tokenGenerator');
const { computeScore } = require('../services/fpScoring');

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
const VALID_CONFIDENCE = ['I have a suspicion', 'I am fairly certain', 'I witnessed this directly'];

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

  // Validate required field
  if (!report_type || !VALID_REPORT_TYPES.includes(report_type)) {
    return res.status(400).json({ error: 'Invalid or missing report_type.' });
  }

  // Validate optional enum fields if provided
  if (district && !VALID_DISTRICTS.includes(district)) {
    return res.status(400).json({ error: 'Invalid district.' });
  }
  if (time_observed && !VALID_TIME_OBSERVED.includes(time_observed)) {
    return res.status(400).json({ error: 'Invalid time_observed.' });
  }
  if (confidence_raw && !VALID_CONFIDENCE.includes(confidence_raw)) {
    return res.status(400).json({ error: 'Invalid confidence_raw.' });
  }

  // Sanitize free-text length
  const safeAreaDesc = area_desc ? String(area_desc).slice(0, 500) : null;
  const safeDetails = details ? String(details).slice(0, 1000) : null;

  // Optional GPS coordinates — voluntarily shared, encrypted like other fields
  let safeGeo = null;
  if (geo_lat != null && geo_lng != null) {
    const lat = parseFloat(geo_lat);
    const lng = parseFloat(geo_lng);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      safeGeo = JSON.stringify({ lat: parseFloat(lat.toFixed(5)), lng: parseFloat(lng.toFixed(5)) });
    }
  }

  // Count corroborating reports in the last 7 days for scoring
  let corroborationCount = 0;
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM reports
       WHERE district = ? AND report_type = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [district || null, report_type]
    );
    corroborationCount = rows[0]?.cnt || 0;
  } catch (_) {
    // Non-fatal — proceed with zero corroboration
  }

  const { score, status } = computeScore({
    confidence_raw,
    district,
    area_desc: safeAreaDesc,
    details: safeDetails,
    time_observed,
    corroborationCount,
  });

  const token = generateToken();
  const tokenHash = hashToken(token);
  const id = uuidv4();

  // Encrypt sensitive free-text fields
  const area_desc_enc = encrypt(safeAreaDesc);
  const details_enc = encrypt(safeDetails);
  const geo_location_enc = encrypt(safeGeo);

  await db.query(
    `INSERT INTO reports
     (id, token_hash, report_type, district, area_desc_enc, geo_location_enc, time_observed,
      details_enc, confidence_raw, fp_score, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
