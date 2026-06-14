/* CipherShield — Submission form progressive enhancement. */

(function () {
  'use strict';

  // ── Character count helpers ─────────────────────────────────────────────

  function attachCharCount(textareaId, counterId, max) {
    var ta = document.getElementById(textareaId);
    var counter = document.getElementById(counterId);
    if (!ta || !counter) return;
    function update() {
      var len = ta.value.length;
      counter.textContent = len + ' / ' + max;
      counter.className = 'char-count';
      if (max - len <= 50) counter.classList.add('near-limit');
      if (max - len <= 0)  counter.classList.add('at-limit');
    }
    ta.addEventListener('input', update);
    update();
  }

  attachCharCount('area_desc', 'area_desc_count', 500);
  attachCharCount('details',   'details_count',   1000);

  // ── Radio card styling ──────────────────────────────────────────────────

  document.querySelectorAll('.radio-label').forEach(function (label) {
    var input = label.querySelector('input[type="radio"]');
    if (!input) return;
    input.addEventListener('change', function () {
      document.querySelectorAll('.radio-label').forEach(function (l) { l.classList.remove('selected'); });
      label.classList.add('selected');
    });
  });

  // ── Geolocation ─────────────────────────────────────────────────────────

  var geoBtn      = document.getElementById('geo-btn');
  var geoBtnLabel = document.getElementById('geo-btn-label');
  var geoClearBtn = document.getElementById('geo-clear-btn');
  var geoIdle     = document.getElementById('geo-idle');
  var geoCaptured = document.getElementById('geo-captured');
  var geoResult   = document.getElementById('geo-result');
  var geoError    = document.getElementById('geo-error');
  var geoLatInput = document.getElementById('geo_lat');
  var geoLngInput = document.getElementById('geo_lng');

  function showIdle() {
    geoIdle.classList.remove('hidden');
    geoCaptured.classList.add('hidden');
    geoLatInput.value = '';
    geoLngInput.value = '';
    geoResult.textContent = '';
    geoError.textContent = '';
    geoError.classList.remove('visible');
    if (geoBtnLabel) geoBtnLabel.textContent = 'Capture My Location';
    if (geoBtn) geoBtn.disabled = false;
  }

  function showCaptured(lat, lng, accuracy) {
    geoIdle.classList.add('hidden');
    geoCaptured.classList.remove('hidden');
    geoLatInput.value = lat;
    geoLngInput.value = lng;
    geoResult.textContent = '📍 ' + lat + ', ' + lng +
      (accuracy ? '  (±' + Math.round(accuracy) + 'm)' : '');
  }

  function showError(msg) {
    geoError.textContent = msg;
    geoError.classList.add('visible');
    if (geoBtnLabel) geoBtnLabel.textContent = 'Try Again';
    if (geoBtn) geoBtn.disabled = false;
  }

  if (geoBtn) {
    if (!('geolocation' in navigator)) {
      geoBtn.disabled = true;
      if (geoBtnLabel) geoBtnLabel.textContent = 'Geolocation not available in this browser';
    } else {
      geoBtn.addEventListener('click', function () {
        geoBtn.disabled = true;
        geoError.classList.remove('visible');
        if (geoBtnLabel) geoBtnLabel.textContent = 'Getting location…';

        navigator.geolocation.getCurrentPosition(
          function (pos) {
            var lat = pos.coords.latitude.toFixed(5);
            var lng = pos.coords.longitude.toFixed(5);
            showCaptured(lat, lng, pos.coords.accuracy);
          },
          function (err) {
            var msgs = {
              1: 'Location permission was denied. You can still describe the area in the text field above.',
              2: 'Could not determine your location. Try again or describe the area in text.',
              3: 'Location request timed out. Try again.',
            };
            showError(msgs[err.code] || 'Location unavailable.');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }
  }

  if (geoClearBtn) {
    geoClearBtn.addEventListener('click', showIdle);
  }

  // ── Async form submission ───────────────────────────────────────────────

  var form         = document.getElementById('report-form');
  var submitBtn    = document.getElementById('submit-btn');
  var formCard     = document.getElementById('form-card');
  var tokenDisplay = document.getElementById('token-display');
  var tokenValue   = document.getElementById('token-value');
  var copyBtn      = document.getElementById('copy-btn');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    var geoLat = geoLatInput && geoLatInput.value ? parseFloat(geoLatInput.value) : null;
    var geoLng = geoLngInput && geoLngInput.value ? parseFloat(geoLngInput.value) : null;

    var data = {
      report_type:    form.report_type.value,
      district:       form.district.value || null,
      area_desc:      (form.area_desc.value || '').trim() || null,
      time_observed:  form.time_observed.value || null,
      details:        (form.details.value || '').trim() || null,
      confidence_raw: (form.confidence_raw && form.confidence_raw.value) || null,
      geo_lat:        geoLat,
      geo_lng:        geoLng,
    };

    try {
      var res = await fetch('/api/submit', {
        method:         'POST',
        headers:        { 'Content-Type': 'application/json' },
        body:           JSON.stringify(data),
        credentials:    'omit',
        referrerPolicy: 'no-referrer',
      });

      var json = await res.json();

      if (!res.ok || !json.token) {
        throw new Error(json.error || 'Submission failed. Please try again.');
      }

      tokenValue.textContent = json.token;
      formCard.classList.add('hidden');
      tokenDisplay.classList.add('visible');
      tokenDisplay.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Report';
      var errEl = document.getElementById('submit-error');
      if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
  });

  // ── Copy token ──────────────────────────────────────────────────────────

  if (copyBtn && tokenValue) {
    copyBtn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(tokenValue.textContent.trim());
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = 'Copy Token';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (_) {
        copyBtn.textContent = 'Select and copy manually';
      }
    });
  }
})();
