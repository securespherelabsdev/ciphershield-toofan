'use strict';

const express = require('express');
const { hashToken } = require('../services/tokenGenerator');
const db = require('../db/connection');

const router = express.Router();

// Citizen-facing status labels — never expose internal state names
const CITIZEN_STATUS = {
  QUARANTINE:  { label: 'Received — Under Assessment',       short: 'Under Review',           phase: 1 },
  REVIEW:      { label: 'Under Review',                      short: 'Under Review',           phase: 1 },
  DISPATCH:    { label: 'Passed to Field Officers',          short: 'With Field Officers',    phase: 2 },
  ESCALATED:   { label: 'Escalated to Specialist Unit',      short: 'Escalated',              phase: 3 },
  ACTIONED:    { label: 'Action Taken',                      short: 'Action Taken',           phase: 4 },
  NO_FINDING:  { label: 'Reviewed — No Further Action',      short: 'No Further Action',      phase: 4 },
};

const DEPARTMENT_LABELS = {
  KERALA_POLICE: 'Kerala Police',
  EXCISE:        'Excise Department',
  CYBERDOME:     'Cyber Dome',
};

router.get('/:token', async (req, res) => {
  const rawToken = req.params.token;
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length > 24) {
    return res.status(400).json({ error: 'Invalid token format.' });
  }

  const tokenHash = hashToken(rawToken.toUpperCase());

  const [rows] = await db.query(
    `SELECT status, assigned_to, created_at, dispatched_at, outcome_at FROM reports WHERE token_hash = ?`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return res.status(200).json({ found: false });
  }

  const report = rows[0];
  const citizen = CITIZEN_STATUS[report.status] || CITIZEN_STATUS.REVIEW;

  return res.status(200).json({
    found: true,
    label: citizen.label,
    short: citizen.short,
    phase: citizen.phase,
    received_at: report.created_at,
    dispatched_at: report.dispatched_at || null,
    resolved_at: report.outcome_at || null,
    assigned_department: report.assigned_to ? DEPARTMENT_LABELS[report.assigned_to] : null,
  });
});

module.exports = router;
