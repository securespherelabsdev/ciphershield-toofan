'use strict';

/*
 * AI INFERENCE WRAPPER
 *
 * This module abstracts all AI inference behind a single internal interface.
 * The underlying provider is an implementation detail of this file only.
 *
 * Rules enforced here:
 * - Provider name, SDK name, and endpoint pattern never appear outside this file.
 * - All credentials are read from process.env only.
 * - If the AI call fails for any reason, the error is logged and the caller
 *   proceeds without enhancement — a dispatch is never blocked by AI failure.
 * - All calls have a 3-second timeout.
 * - On rate-limit (429), the next key in the rotation is tried automatically.
 * - Node.js native fetch is used — no provider SDK.
 */

const TIMEOUT_MS = 3000;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

// Key rotation state — persists across calls within the same process lifetime
let _keyIndex = 0;

function getKeys() {
  const keys = [
    process.env.AI_KEY_1,
    process.env.AI_KEY_2,
    process.env.AI_KEY_3,
  ].filter(Boolean);
  if (keys.length === 0) throw new Error('No AI provider keys configured');
  return keys;
}

function currentKey() {
  const keys = getKeys();
  return keys[_keyIndex % keys.length];
}

function rotateKey() {
  _keyIndex += 1;
  console.info(`[aiLayer] Rotating to key index ${_keyIndex % getKeys().length}`);
}

const ENHANCEMENT_SYSTEM = `You are an intelligence analysis assistant supporting law enforcement.
You receive anonymous civic tip reports about suspected drug-related activity.
IMPORTANT: These reports are 100% anonymous. No reporter identity, contact details, location data, IP address, or device information is available — this is guaranteed by the system architecture. Never suggest contacting, identifying, verifying, or gathering more information from the reporter. Focus only on the reported activity, location, and type of suspected crime.
Produce a structured JSON summary to help officers prioritise and act on the lead.
Output ONLY valid JSON — no prose, no markdown fences.`;

const ANOMALY_SYSTEM = `You are an intelligence pattern analyst supporting law enforcement.
You receive clusters of civic tip reports. Identify notable patterns.
Output ONLY a valid JSON array — no prose, no markdown fences.`;

function enhancementPrompt(report) {
  return `Report Type: ${report.report_type}
District: ${report.district || 'Not specified'}
General Area: ${report.area_desc || 'Not specified'}
Time Observed: ${report.time_observed || 'Not specified'}
Details: ${report.details || 'Not specified'}
Reporter Confidence: ${report.confidence_raw || 'Not specified'}

Return a JSON object with exactly these keys:
{
  "summary": "One paragraph plain-language summary of the lead",
  "key_indicators": ["array", "of", "notable", "details"],
  "suggested_action": "Suggested initial investigative step for officers",
  "confidence_note": "Brief note on information quality and reliability"
}`;
}

function anomalyPrompt(clusters) {
  return `Clusters detected in the past 7 days (same district + type, 3+ reports):
${JSON.stringify(clusters, null, 2)}

Return a JSON array of objects with keys:
{ "district": "...", "report_type": "...", "count": N, "alert": "Brief plain-language alert" }`;
}

async function callProvider(systemPrompt, userPrompt, attempt = 0) {
  const keys = getKeys();
  if (attempt >= keys.length) {
    throw new Error('All AI provider keys exhausted or rate-limited');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentKey()}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      rotateKey();
      return callProvider(systemPrompt, userPrompt, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from provider');

    // Strip markdown fences if the model adds them despite instructions
    const clean = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(clean);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a structured intelligence summary for a report at dispatch time.
 * Returns null if all AI calls fail — callers must handle null gracefully.
 *
 * @param {object} report - Decrypted report fields
 * @returns {Promise<object|null>}
 */
async function enhanceReport(report) {
  try {
    return await callProvider(ENHANCEMENT_SYSTEM, enhancementPrompt(report));
  } catch (err) {
    console.error('[aiLayer] enhanceReport failed:', err.message);
    return null;
  }
}

/**
 * Scan recent DISPATCH-status report clusters and flag anomalies.
 * Runs nightly. Returns [] on failure.
 *
 * @param {Array} clusters - { district, report_type, count }[]
 * @returns {Promise<Array>}
 */
async function flagAnomalies(clusters) {
  if (!clusters || clusters.length === 0) return [];
  try {
    const result = await callProvider(ANOMALY_SYSTEM, anomalyPrompt(clusters));
    return Array.isArray(result) ? result : [];
  } catch (err) {
    console.error('[aiLayer] flagAnomalies failed:', err.message);
    return [];
  }
}

module.exports = { enhanceReport, flagAnomalies };
