'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { decrypt, encrypt } = require('../services/encryption');
const { enhanceReport } = require('../services/aiLayer');

const router = express.Router();

const AGENCY_REPORT_TYPES = {
  KERALA_POLICE: null,
  EXCISE: ['Drug Sale Activity', 'Drug Manufacturing', 'Drug Transportation'],
  CYBERDOME: null,
};

const AGENCY_LABELS = {
  KERALA_POLICE: 'Kerala Police',
  EXCISE: 'Excise Department',
  CYBERDOME: 'Cyber Dome',
};

// ── JWT middleware ────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.agencyUser = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function requireCyberdome(req, res, next) {
  if (req.agencyUser?.agency !== 'CYBERDOME') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
}

async function writeAudit(agencyUserId, action, reportId, note) {
  await db.query(
    'INSERT INTO audit_log (id, agency_user_id, action, note, report_id, actioned_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [uuidv4(), agencyUserId, action, note || null, reportId]
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const [rows] = await db.query(
    'SELECT * FROM agency_users WHERE email = ?',
    [String(email).toLowerCase().trim()]
  );

  const user = rows[0];
  const valid = user && (await bcrypt.compare(String(password), user.password_hash));

  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  await db.query('UPDATE agency_users SET last_login = NOW() WHERE id = ?', [user.id]);

  const token = jwt.sign(
    { id: user.id, email: user.email, agency: user.agency },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '8h' }
  );

  console.info(`[audit] LOGIN agency_user=${user.id} agency=${user.agency}`);

  return res.json({ token, agency: user.agency });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || String(new_password).length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters.' });
  }

  const [rows] = await db.query('SELECT * FROM agency_users WHERE id = ?', [req.agencyUser.id]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(current_password), user.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = await bcrypt.hash(String(new_password), 12);
  await db.query('UPDATE agency_users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
  return res.json({ message: 'Password updated.' });
});

// ── Reports list ──────────────────────────────────────────────────────────────

router.get('/reports', requireAuth, async (req, res) => {
  const { district, report_type, status, score_min, score_max, assigned_to, page = 1 } = req.query;
  const perPage = 20;
  const offset = (Math.max(1, parseInt(page)) - 1) * perPage;

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];

  const conditions = [];
  const params = [];

  if (allowed) {
    conditions.push(`report_type IN (${allowed.map(() => '?').join(',')})`);
    params.push(...allowed);
  }
  if (district) { conditions.push('district = ?'); params.push(district); }
  if (report_type) {
    if (allowed && !allowed.includes(report_type)) {
      return res.status(403).json({ error: 'Access denied for this report type.' });
    }
    conditions.push('report_type = ?'); params.push(report_type);
  }
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push('status = ?'); params.push(statuses[0]);
    } else {
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }
  if (assigned_to) { conditions.push('assigned_to = ?'); params.push(assigned_to); }
  if (score_min) { conditions.push('fp_score >= ?'); params.push(parseInt(score_min)); }
  if (score_max) { conditions.push('fp_score <= ?'); params.push(parseInt(score_max)); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT id, report_type, district, fp_score, status, assigned_to, created_at, dispatched_at
     FROM reports ${where}
     ORDER BY fp_score DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM reports ${where}`,
    params
  );

  return res.json({ reports: rows, total: countRows[0].total, page: parseInt(page), perPage });
});

// ── Report detail ─────────────────────────────────────────────────────────────

router.get('/reports/:id', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];

  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied for this report type.' });
  }

  await writeAudit(req.agencyUser.id, 'VIEWED', report.id);

  const geoRaw = decrypt(report.geo_location_enc);
  const decrypted = {
    ...report,
    area_desc: decrypt(report.area_desc_enc),
    details: decrypt(report.details_enc),
    geo_location: geoRaw ? JSON.parse(geoRaw) : null,
    ai_summary: report.ai_summary_enc ? JSON.parse(decrypt(report.ai_summary_enc)) : null,
  };
  delete decrypted.area_desc_enc;
  delete decrypted.geo_location_enc;
  delete decrypted.details_enc;
  delete decrypted.ai_summary_enc;
  delete decrypted.token_hash;

  return res.json(decrypted);
});

// ── Status transition ─────────────────────────────────────────────────────────

router.patch('/reports/:id/status', requireAuth, async (req, res) => {
  const { status, note } = req.body;
  const VALID_STATUSES = ['ACTIONED', 'NO_FINDING', 'ESCALATED', 'QUARANTINE', 'REVIEW', 'DISPATCH'];

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const [rows] = await db.query('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied for this report type.' });
  }

  const updates = { status };
  const safeNote = note ? String(note).slice(0, 500) : null;

  if (status === 'DISPATCH' && !report.dispatched_at) {
    updates.dispatched_at = new Date();

    const decryptedReport = {
      report_type: report.report_type,
      district: report.district,
      area_desc: decrypt(report.area_desc_enc),
      details: decrypt(report.details_enc),
      time_observed: report.time_observed,
      confidence_raw: report.confidence_raw,
    };
    const aiSummary = await enhanceReport(decryptedReport);
    if (aiSummary) {
      updates.ai_summary_enc = encrypt(JSON.stringify(aiSummary));
    }
  }

  if (['ACTIONED', 'NO_FINDING', 'ESCALATED'].includes(status)) {
    updates.outcome_at = new Date();
    updates.outcome_note = safeNote;
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  await db.query(
    `UPDATE reports SET ${setClauses} WHERE id = ?`,
    [...Object.values(updates), report.id]
  );

  await writeAudit(req.agencyUser.id, status, report.id, safeNote);
  console.info(`[audit] STATUS_UPDATE agency_user=${req.agencyUser.id} report=${report.id} new_status=${status}`);

  return res.json({ message: 'Status updated.' });
});

// ── Assignment ────────────────────────────────────────────────────────────────

router.patch('/reports/:id/assign', requireAuth, async (req, res) => {
  const { assigned_to } = req.body;
  const VALID = ['KERALA_POLICE', 'EXCISE', 'CYBERDOME', null];

  if (!VALID.includes(assigned_to)) {
    return res.status(400).json({ error: 'Invalid department.' });
  }

  const [rows] = await db.query('SELECT id, report_type FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied for this report type.' });
  }

  await db.query('UPDATE reports SET assigned_to = ? WHERE id = ?', [assigned_to, report.id]);
  await writeAudit(
    req.agencyUser.id,
    'ASSIGNED',
    report.id,
    assigned_to ? `Assigned to ${AGENCY_LABELS[assigned_to]}` : 'Assignment cleared'
  );

  return res.json({ message: 'Assignment updated.', assigned_to });
});

// ── Internal notes ────────────────────────────────────────────────────────────

router.get('/reports/:id/notes', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT id, report_type FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const [notes] = await db.query(
    `SELECT rn.id, rn.note, rn.agency, rn.created_at, au.email
     FROM report_notes rn
     JOIN agency_users au ON au.id = rn.agency_user_id
     WHERE rn.report_id = ?
     ORDER BY rn.created_at ASC`,
    [req.params.id]
  );

  return res.json({ notes });
});

router.post('/reports/:id/notes', requireAuth, async (req, res) => {
  const { note } = req.body;
  if (!note || !String(note).trim()) {
    return res.status(400).json({ error: 'Note cannot be empty.' });
  }

  const [rows] = await db.query('SELECT id, report_type FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const id = uuidv4();
  const safeNote = String(note).slice(0, 2000);

  await db.query(
    'INSERT INTO report_notes (id, report_id, agency_user_id, agency, note, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [id, report.id, req.agencyUser.id, req.agencyUser.agency, safeNote]
  );

  return res.json({
    id,
    note: safeNote,
    agency: req.agencyUser.agency,
    email: req.agencyUser.email,
    created_at: new Date().toISOString(),
  });
});

// ── Dashboard stats ───────────────────────────────────────────────────────────

router.get('/stats', requireAuth, async (req, res) => {
  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  const typeFilter = allowed
    ? `AND report_type IN (${allowed.map(() => '?').join(',')})`
    : '';
  const typeParams = allowed || [];

  const [[totals]] = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status IN ('REVIEW','QUARANTINE')) AS awaiting_review,
       SUM(status = 'DISPATCH') AS dispatched,
       SUM(status IN ('ACTIONED','NO_FINDING','ESCALATED') AND outcome_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS actioned_this_week,
       SUM(assigned_to IS NULL AND status NOT IN ('ACTIONED','NO_FINDING','ESCALATED')) AS unassigned
     FROM reports WHERE 1=1 ${typeFilter}`,
    typeParams
  );

  const [recent] = await db.query(
    `SELECT id, report_type, district, status, assigned_to, fp_score, outcome_at
     FROM reports WHERE 1=1 ${typeFilter}
     ORDER BY COALESCE(outcome_at, dispatched_at, created_at) DESC LIMIT 10`,
    typeParams
  );

  const [clusters] = await db.query(
    `SELECT district, report_type, COUNT(*) AS cnt
     FROM reports
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${typeFilter}
     GROUP BY district, report_type HAVING cnt >= 3`,
    typeParams
  );

  return res.json({ totals, recent_activity: recent, clusters });
});

// ── Report history ────────────────────────────────────────────────────────────

router.get('/reports/:id/history', requireAuth, async (req, res) => {
  const [rows] = await db.query('SELECT id, report_type FROM reports WHERE id = ?', [req.params.id]);
  const report = rows[0];
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  if (allowed && !allowed.includes(report.report_type)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const [history] = await db.query(
    `SELECT al.action, al.note, al.actioned_at, au.email, au.agency
     FROM audit_log al
     JOIN agency_users au ON au.id = al.agency_user_id
     WHERE al.report_id = ?
     ORDER BY al.actioned_at ASC`,
    [req.params.id]
  );

  return res.json({ history });
});

// ── Activity log (CYBERDOME only) ─────────────────────────────────────────────

router.get('/activity', requireAuth, requireCyberdome, async (req, res) => {
  const { page = 1, agency, action } = req.query;
  const perPage = 50;
  const offset = (Math.max(1, parseInt(page)) - 1) * perPage;

  const conditions = [];
  const params = [];
  if (agency) { conditions.push('au.agency = ?'); params.push(agency); }
  if (action) { conditions.push('al.action = ?'); params.push(action); }
  const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT al.id, al.action, al.note, al.report_id, al.actioned_at AS created_at,
            au.email, au.agency
     FROM audit_log al
     JOIN agency_users au ON au.id = al.agency_user_id
     WHERE 1=1 ${where}
     ORDER BY al.actioned_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM audit_log al
     JOIN agency_users au ON au.id = al.agency_user_id WHERE 1=1 ${where}`,
    params
  );

  return res.json({ entries: rows, total, page: parseInt(page), perPage });
});

// ── Anomaly clusters ──────────────────────────────────────────────────────────

router.get('/anomalies', requireAuth, async (req, res) => {
  const allowed = AGENCY_REPORT_TYPES[req.agencyUser.agency];
  const typeFilter = allowed
    ? `AND report_type IN (${allowed.map(() => '?').join(',')})`
    : '';

  const [clusters] = await db.query(
    `SELECT district, report_type, COUNT(*) AS cnt
     FROM reports
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ${typeFilter}
     GROUP BY district, report_type HAVING cnt >= 3
     ORDER BY cnt DESC`,
    allowed || []
  );

  return res.json({ clusters });
});

module.exports = router;
