'use strict';

/*
 * FALSE-POSITIVE SCORING ENGINE
 *
 * Produces a score from 0 to 100 for each submitted report.
 * Higher scores indicate more credible, actionable intelligence.
 *
 * This engine is fully rule-based and deterministic. No AI is involved
 * in scoring. The logic is documented publicly in README.md so it can
 * be audited by security researchers and civil society organisations.
 *
 * Thresholds:
 *   0–39:   QUARANTINE — do not dispatch to agency
 *   40–69:  REVIEW     — hold for manual review
 *   70–100: DISPATCH   — eligible for agency portal
 */

const THRESHOLDS = {
  QUARANTINE: { min: 0,  max: 39 },
  REVIEW:     { min: 40, max: 69 },
  DISPATCH:   { min: 70, max: 100 },
};

const CONFIDENCE_SCORES = {
  'I have a suspicion':        10,
  'I am fairly certain':       25,
  'I witnessed this directly': 40,
};

/**
 * Compute the FP score for a report.
 *
 * @param {object} fields
 * @param {string} fields.confidence_raw    - Reporter's stated confidence level
 * @param {string|null} fields.district     - Reported district
 * @param {string|null} fields.area_desc    - Plaintext area description
 * @param {string|null} fields.details      - Plaintext report details
 * @param {string|null} fields.time_observed - Recency string
 * @param {number} fields.corroborationCount - Count of matching reports in last 7 days
 * @returns {{ score: number, status: string, breakdown: object }}
 */
function computeScore(fields) {
  const {
    confidence_raw,
    district,
    area_desc,
    details,
    time_observed,
    corroborationCount = 0,
  } = fields;

  const breakdown = {};
  let score = 0;

  // Reporter confidence
  const confidencePoints = CONFIDENCE_SCORES[confidence_raw] ?? 0;
  breakdown.confidence = confidencePoints;
  score += confidencePoints;

  // Specificity — district provided
  if (district && district.trim().length > 0) {
    breakdown.district = 10;
    score += 10;
  } else {
    breakdown.district = 0;
  }

  // Specificity — area description length
  if (area_desc && area_desc.trim().length > 50) {
    breakdown.area_desc_length = 10;
    score += 10;
  } else {
    breakdown.area_desc_length = 0;
  }

  // Specificity — detail length
  if (details && details.trim().length > 100) {
    breakdown.details_length = 10;
    score += 10;
  } else {
    breakdown.details_length = 0;
  }

  // Corroboration — same district + report type in last 7 days
  if (corroborationCount >= 5) {
    breakdown.corroboration = 25;
    score += 25;
  } else if (corroborationCount >= 2) {
    breakdown.corroboration = 15;
    score += 15;
  } else {
    breakdown.corroboration = 0;
  }

  // Recency
  if (time_observed === 'Today' || time_observed === 'Yesterday') {
    breakdown.recency = 5;
    score += 5;
  } else {
    breakdown.recency = 0;
  }

  // Cap at 100
  score = Math.min(score, 100);
  breakdown.total = score;

  const status = scoreToStatus(score);

  return { score, status, breakdown };
}

function scoreToStatus(score) {
  if (score <= THRESHOLDS.QUARANTINE.max) return 'QUARANTINE';
  if (score <= THRESHOLDS.REVIEW.max) return 'REVIEW';
  return 'DISPATCH';
}

module.exports = { computeScore, scoreToStatus, THRESHOLDS };
