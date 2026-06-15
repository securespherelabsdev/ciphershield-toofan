'use strict';

/*
 * FALSE-POSITIVE SCORING ENGINE v2
 *
 * Produces a credibility score (0–100) and a list of red-flag signals.
 * Higher scores = more credible, actionable intelligence.
 *
 * Key changes from v1:
 *  - Word quality replaces character-length (gaming-resistant)
 *  - GPS coordinates now scored and validated against district boundaries
 *  - GPS/district mismatch is a high-severity flag
 *  - Confidence/time consistency checked — "witnessed directly" + stale → penalty
 *  - Named individual without location context → harassment signal → penalty
 *  - Low text diversity (spam/padding) detected via unique-word ratio
 *  - Stale reports carry a small penalty (not just neutral)
 *  - Report type specificity rewarded
 *  - Burst and duplicate-cluster penalties applied by submit.js before call
 *
 * Thresholds:
 *   0–39   QUARANTINE — do not surface to agency
 *   40–69  REVIEW     — hold for manual officer review
 *   70–100 DISPATCH   — eligible for field dispatch (officer still approves)
 *
 * The scoring breakdown and flags are stored alongside each report so officers
 * can see exactly why a report scored as it did.
 */

const THRESHOLDS = { QUARANTINE: 39, REVIEW: 69 };

const SPECIFIC_TYPES = new Set([
  'Drug Sale Activity',
  'Drug Manufacturing',
  'Drug Transportation',
  'Storage Location',
]);

/*
 * Approximate bounding boxes for Kerala's 14 districts.
 * [minLat, minLng, maxLat, maxLng]
 * Used only for GPS/district mismatch detection — not precise borders.
 */
const DISTRICT_BOUNDS = {
  Thiruvananthapuram: [8.17, 76.65, 8.90, 77.30],
  Kollam:             [8.76, 76.55, 9.36, 77.20],
  Pathanamthitta:     [9.00, 76.55, 9.70, 77.40],
  Alappuzha:          [9.10, 76.25, 9.80, 76.90],
  Kottayam:           [9.25, 76.45, 9.95, 77.25],
  Idukki:             [9.55, 76.80, 10.45, 77.55],
  Ernakulam:          [9.80, 76.15, 10.35, 76.95],
  Thrissur:           [10.10, 76.00, 10.80, 76.75],
  Palakkad:           [10.30, 76.50, 11.10, 77.10],
  Malappuram:         [10.65, 75.90, 11.30, 76.70],
  Kozhikode:          [11.10, 75.55, 11.75, 76.45],
  Wayanad:            [11.45, 75.75, 11.90, 76.60],
  Kannur:             [11.65, 75.25, 12.30, 76.10],
  Kasaragod:          [12.20, 74.85, 12.85, 75.75],
};

// Overall Kerala bounding box (generous margin)
const KERALA_BOUNDS = [8.07, 74.85, 12.90, 77.65];

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordStats(text) {
  if (!text || !text.trim()) return { count: 0, uniqueRatio: 0 };
  const words = text.trim().toLowerCase()
    .replace(/[^a-z0-9ഀ-ൿ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return { count: 0, uniqueRatio: 0 };
  const unique = new Set(words).size;
  return { count: words.length, uniqueRatio: unique / words.length };
}

function wordSet(text) {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function hasNamedIndividual(text) {
  if (!text) return false;
  return /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(text);
}

function gpsInKerala(lat, lng) {
  const [minLat, minLng, maxLat, maxLng] = KERALA_BOUNDS;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

function gpsInDistrict(lat, lng, district) {
  const b = DISTRICT_BOUNDS[district];
  if (!b) return null; // unknown district
  return lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3];
}

// ── Main scoring function ─────────────────────────────────────────────────────

/**
 * @param {object} fields
 * @param {string}       fields.confidence_raw
 * @param {string|null}  fields.district
 * @param {string|null}  fields.area_desc        — plaintext
 * @param {string|null}  fields.details           — plaintext
 * @param {string|null}  fields.time_observed
 * @param {string}       fields.report_type
 * @param {number|null}  fields.geo_lat
 * @param {number|null}  fields.geo_lng
 * @param {number}       fields.corroborationCount
 * @param {boolean}      fields.isBurstSuspect
 * @param {boolean}      fields.isDuplicateCluster
 * @returns {{ score, status, breakdown, flags }}
 */
function computeScore(fields) {
  const {
    confidence_raw,
    district,
    area_desc,
    details,
    time_observed,
    report_type,
    geo_lat,
    geo_lng,
    corroborationCount = 0,
    isBurstSuspect    = false,
    isDuplicateCluster = false,
  } = fields;

  let score = 0;
  const breakdown = {};
  const flags     = [];

  // ── 1. Reporter confidence ────────────────────────────────────────────────
  const CONF = {
    'I have a suspicion':        5,
    'I am fairly certain':       20,
    'I witnessed this directly': 35,
  };
  const confPts = CONF[confidence_raw] ?? 0;
  breakdown.confidence = confPts;
  score += confPts;

  // ── 2. Report type specificity ────────────────────────────────────────────
  const typePts = SPECIFIC_TYPES.has(report_type) ? 5 : 0;
  breakdown.report_type_specificity = typePts;
  score += typePts;
  if (!typePts) {
    flags.push({
      code: 'VAGUE_TYPE',
      severity: 'low',
      label: 'Vague report type',
      detail: '"Suspicious Person or Activity" and "Other" are low-specificity types. These are harder to action without additional detail.',
      officer_action: 'Check the description for any specific activity that might indicate a more specific type.',
    });
  }

  // ── 3. District provided ──────────────────────────────────────────────────
  if (district && district.trim()) {
    breakdown.district = 8;
    score += 8;
  } else {
    breakdown.district = 0;
    flags.push({
      code: 'NO_DISTRICT',
      severity: 'medium',
      label: 'No district specified',
      detail: 'Reports without a district cannot be automatically routed to field officers.',
      officer_action: 'Check the area description and GPS (if provided) to infer a likely district before dispatching.',
    });
  }

  // ── 4. Area description word quality ─────────────────────────────────────
  const areaWS = wordStats(area_desc);
  let areaPts = 0;
  if (areaWS.count >= 8  && areaWS.uniqueRatio >= 0.65) areaPts = 12;
  else if (areaWS.count >= 4 && areaWS.uniqueRatio >= 0.50) areaPts = 6;
  breakdown.area_quality = areaPts;
  score += areaPts;

  if (areaWS.count > 6 && areaWS.uniqueRatio < 0.50) {
    flags.push({
      code: 'LOW_AREA_DIVERSITY',
      severity: 'medium',
      label: 'Area description appears repetitive or padded',
      detail: `Only ${Math.round(areaWS.uniqueRatio * 100)}% of words in the area description are unique. This may indicate padding to inflate the score.`,
      officer_action: 'Read the area description carefully. If it is nonsensical or repetitive, treat as lower credibility.',
    });
  }

  // ── 5. Details word quality ───────────────────────────────────────────────
  const detWS = wordStats(details);
  let detPts = 0;
  if (detWS.count >= 25 && detWS.uniqueRatio >= 0.65) detPts = 12;
  else if (detWS.count >= 12 && detWS.uniqueRatio >= 0.55) detPts = 7;
  else if (detWS.count >= 5)  detPts = 3;
  breakdown.details_quality = detPts;
  score += detPts;

  if (detWS.count > 10 && detWS.uniqueRatio < 0.45) {
    flags.push({
      code: 'LOW_DETAILS_DIVERSITY',
      severity: 'high',
      label: 'Details text appears to be spam or padding',
      detail: `Word uniqueness ratio is ${Math.round(detWS.uniqueRatio * 100)}% — unusually low. This is a common indicator of automated submissions or text padding to game the score.`,
      officer_action: 'Read the details carefully. If the text is repetitive gibberish, quarantine this report.',
    });
  }

  // ── 6. GPS location + district validation ─────────────────────────────────
  const lat = geo_lat != null ? parseFloat(geo_lat) : null;
  const lng = geo_lng != null ? parseFloat(geo_lng) : null;
  const hasGeo = lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng);

  if (hasGeo) {
    if (!gpsInKerala(lat, lng)) {
      breakdown.gps = -15;
      score -= 15;
      flags.push({
        code: 'GPS_OUTSIDE_KERALA',
        severity: 'critical',
        label: 'GPS coordinates are outside Kerala',
        detail: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) do not fall within Kerala. This is a strong indicator of fabricated or test location data.`,
        officer_action: 'Do NOT dispatch based on this GPS. Evaluate the text description independently.',
      });
    } else if (district) {
      const inDistrict = gpsInDistrict(lat, lng, district);
      if (inDistrict === false) {
        breakdown.gps = -10;
        score -= 10;
        flags.push({
          code: 'GPS_DISTRICT_MISMATCH',
          severity: 'high',
          label: `GPS does not match declared district (${district})`,
          detail: `The pin-drop falls outside the expected bounds for ${district}. Either the reporter selected the wrong district, or the location data may be inaccurate.`,
          officer_action: `Cross-reference the GPS pin with the area description. Correct the district if the GPS appears genuine.`,
        });
      } else {
        breakdown.gps = 15;
        score += 15;
      }
    } else {
      // GPS provided but no district to validate against
      breakdown.gps = 12;
      score += 12;
    }
  } else {
    breakdown.gps = 0;
  }

  // ── 7. Recency ────────────────────────────────────────────────────────────
  const RECENCY = {
    'Today':                   8,
    'Yesterday':               5,
    'Within the past week':    2,
    'More than a week ago':   -3,
  };
  const recencyPts = RECENCY[time_observed] ?? 0;
  breakdown.recency = recencyPts;
  score += recencyPts;

  if (time_observed === 'More than a week ago') {
    flags.push({
      code: 'STALE',
      severity: 'low',
      label: 'Intelligence is over one week old',
      detail: 'The reported event occurred more than a week ago. Locations, people, and situations may have changed.',
      officer_action: 'Treat as background intelligence rather than an urgent lead. Verify that the location is still relevant.',
    });
  }

  // ── 8. Confidence / time consistency ─────────────────────────────────────
  const witnessedDirectly = confidence_raw === 'I witnessed this directly';
  const freshReport = time_observed === 'Today' || time_observed === 'Yesterday';
  const staleReport = time_observed === 'More than a week ago';

  if (witnessedDirectly && staleReport) {
    breakdown.consistency = -10;
    score -= 10;
    flags.push({
      code: 'CONSISTENCY_WITNESS_STALE',
      severity: 'high',
      label: 'Direct witness claim contradicts stale timing',
      detail: 'Reporter claims to have directly witnessed the event, but reports it over a week later. Eyewitnesses typically report immediately. This inconsistency reduces credibility significantly.',
      officer_action: 'Ask yourself: why would a direct witness wait this long? Consider whether the "directly witnessed" claim is truthful.',
    });
  } else if (witnessedDirectly && freshReport) {
    breakdown.consistency = 5;
    score += 5;
  } else {
    breakdown.consistency = 0;
  }

  // ── 9. Named individual detection ────────────────────────────────────────
  const nameInDetails = hasNamedIndividual(details || '');
  const nameInArea    = hasNamedIndividual(area_desc || '');
  const hasName       = nameInDetails || nameInArea;

  if (hasName && !hasGeo && areaWS.count < 5) {
    breakdown.harassment_signal = -15;
    score -= 15;
    flags.push({
      code: 'NAMED_INDIVIDUAL_NO_LOCATION',
      severity: 'critical',
      label: 'Report names an individual but provides no location detail',
      detail: 'This report identifies a specific person by name but offers no GPS, no meaningful area description, and no other corroborating context. This is the most common pattern in targeted harassment submissions.',
      officer_action: 'Do NOT dispatch on this report alone. Require independent corroboration before any investigation of the named individual.',
    });
  } else if (hasName) {
    breakdown.harassment_signal = 0;
    flags.push({
      code: 'NAMED_INDIVIDUAL',
      severity: 'medium',
      label: 'Named individual mentioned in report',
      detail: 'The report references a specific person by name. Anonymous reporting can be misused to target individuals.',
      officer_action: 'Verify the allegation against other intelligence before taking action. Do not share the named individual\'s identity beyond the investigation team.',
    });
  } else {
    breakdown.harassment_signal = 0;
  }

  // ── 10. Corroboration ────────────────────────────────────────────────────
  if (isDuplicateCluster) {
    breakdown.corroboration = 0;
    flags.push({
      code: 'DUPLICATE_CLUSTER',
      severity: 'critical',
      label: 'Corroborating reports appear to be near-duplicates',
      detail: 'Reports with very similar text already exist for this district and type. The "corroboration" may come from a single actor submitting the same report multiple times to artificially inflate the score.',
      officer_action: 'Do not treat existing reports as independent corroboration. Evaluate this lead on its own merits only.',
    });
  } else if (corroborationCount >= 5) {
    breakdown.corroboration = 20;
    score += 20;
  } else if (corroborationCount >= 2) {
    breakdown.corroboration = 10;
    score += 10;
  } else {
    breakdown.corroboration = 0;
  }

  // ── 11. Burst submission penalty ─────────────────────────────────────────
  if (isBurstSuspect) {
    breakdown.burst_penalty = -20;
    score -= 20;
    flags.push({
      code: 'BURST_SUBMISSION',
      severity: 'critical',
      label: 'Burst submission pattern detected',
      detail: 'Five or more reports were submitted for this district within a 10-minute window. This is consistent with coordinated abuse, automated submission, or a single person gaming corroboration scores.',
      officer_action: 'Review all reports from this time window as a cluster. Treat corroboration scores across this burst as unreliable.',
    });
  } else {
    breakdown.burst_penalty = 0;
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));
  breakdown.total = score;

  return { score, status: scoreToStatus(score), breakdown, flags };
}

function scoreToStatus(score) {
  if (score <= THRESHOLDS.QUARANTINE) return 'QUARANTINE';
  if (score <= THRESHOLDS.REVIEW)     return 'REVIEW';
  return 'DISPATCH';
}

// Jaccard similarity helper exported for submit.js duplicate detection
module.exports = { computeScore, scoreToStatus, THRESHOLDS, wordSet, jaccardSimilarity };
