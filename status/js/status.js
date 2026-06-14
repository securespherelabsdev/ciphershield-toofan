/* CipherShield — Status page logic */

(function () {
  'use strict';

  var input   = document.getElementById('token-input');
  var btn     = document.getElementById('check-btn');
  var card    = document.getElementById('result-card');

  /* Auto-format as XXXX-XXXX-XXXX-XXXX */
  input.addEventListener('input', function () {
    var raw = this.value.replace(/[^A-Fa-f0-9]/g, '').toUpperCase().slice(0, 16);
    var out = '';
    for (var i = 0; i < raw.length; i++) {
      if (i > 0 && i % 4 === 0) out += '-';
      out += raw[i];
    }
    this.value = out;
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doCheck(); }
  });

  btn.addEventListener('click', doCheck);

  /* Pre-fill + auto-check from URL ?token= param */
  var urlParam = new URLSearchParams(window.location.search).get('token');
  if (urlParam) {
    input.value = urlParam.toUpperCase();
    doCheck();
  }

  function fmtDate(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function checkSvg() {
    return '<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 6l2.5 2.5 5.5-5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function badgeClass(phase, label) {
    if (phase === 1) return 'badge-review';
    if (phase === 2) return 'badge-field';
    if (phase === 3) return 'badge-escalate';
    if (label && label.toLowerCase().includes('no further')) return 'badge-nofind';
    return 'badge-actioned';
  }

  function buildTimeline(data) {
    var phase = data.phase || 1;
    var steps = [];

    steps.push({
      done:    phase >= 1,
      current: phase === 1,
      title:   'Report Received',
      desc:    'Your report was received and logged anonymously.',
      date:    data.received_at,
      dept:    null,
    });

    steps.push({
      done:    phase >= 2,
      current: phase === 2,
      title:   'Passed to Field Officers',
      desc:    phase >= 2
        ? 'Your report was assessed and forwarded for investigation.'
        : 'Awaiting assessment.',
      date:    phase >= 2 ? data.dispatched_at : null,
      dept:    phase >= 2 ? data.assigned_department : null,
    });

    if (phase === 3) {
      steps.push({
        done:    false,
        current: true,
        title:   'Escalated to Specialist Unit',
        desc:    'The case has been referred to a specialist unit.',
        date:    data.dispatched_at,
        dept:    data.assigned_department,
      });
    }

    var closeTitle = 'Closed';
    var closeDesc  = 'Awaiting outcome.';
    if (phase === 4) {
      if (data.label && data.label.toLowerCase().includes('no further')) {
        closeTitle = 'Reviewed — No Further Action';
        closeDesc  = 'Officers reviewed the intelligence and determined no further action was needed.';
      } else {
        closeTitle = 'Action Taken';
        closeDesc  = 'Officers acted on the intelligence in your report. Thank you for helping.';
      }
    }
    steps.push({
      done:    phase === 4,
      current: false,
      title:   closeTitle,
      desc:    closeDesc,
      date:    phase === 4 ? data.resolved_at : null,
      dept:    null,
    });

    return steps.map(function (s, i) {
      var iconEl;
      if (s.done) {
        iconEl = '<div class="tl-icon done">' + checkSvg() + '</div>';
      } else if (s.current) {
        iconEl = '<div class="tl-icon current"><div class="current-dot"></div></div>';
      } else {
        iconEl = '<div class="tl-icon pending"></div>';
      }

      var titleCls = (s.done || s.current) ? 'tl-title' : 'tl-title pending';
      var descEl   = '<p class="tl-desc">' + s.desc + '</p>';
      var dateEl   = s.date ? '<p class="tl-date">' + fmtDate(s.date) + '</p>' : '';
      var deptEl   = s.dept ? '<span class="tl-dept">' + s.dept + '</span>' : '';

      var isLast = i === steps.length - 1;
      return '<div class="tl-step' + (isLast ? ' last' : '') + '">' +
        iconEl +
        '<div class="tl-body">' +
          '<p class="' + titleCls + '">' + s.title + '</p>' +
          descEl + dateEl + deptEl +
        '</div>' +
      '</div>';
    }).join('');
  }

  function render(data) {
    if (!data.found) {
      card.innerHTML =
        '<div class="rc-header not-found"><div>' +
          '<p class="rc-title">No report found</p>' +
          '<p class="rc-sub">Double-check your token and try again. Tokens are not case-sensitive.</p>' +
        '</div></div>' +
        '<div class="rc-notfound">' +
          '<p>Make sure you\'re entering the full token including the dashes.</p>' +
          '<small>Example format: A1B2-C3D4-E5F6-G7H8</small>' +
        '</div>';
      return;
    }

    var phase   = data.phase || 1;
    var bClass  = badgeClass(phase, data.label);
    var rcvDate = data.received_at ? ('Received approx. ' + fmtDate(data.received_at)) : '';

    card.innerHTML =
      '<div class="rc-header found">' +
        '<div>' +
          '<p class="rc-title">Report found</p>' +
          '<p class="rc-sub">' + (rcvDate || 'Your report is in the system.') + '</p>' +
        '</div>' +
        '<span class="status-badge ' + bClass + '">' +
          '<span class="dot"></span>' +
          (data.short || data.label) +
        '</span>' +
      '</div>' +
      '<div class="rc-timeline">' + buildTimeline(data) + '</div>' +
      '<div class="rc-meta">' +
        '<span>All report data is encrypted. Your identity was never recorded.</span>' +
      '</div>';
  }

  function renderError() {
    card.innerHTML =
      '<div class="rc-header err">' +
        '<div>' +
          '<p class="rc-title err-title">Connection error</p>' +
          '<p class="rc-sub">Could not reach the server. Please try again in a moment.</p>' +
        '</div>' +
      '</div>';
  }

  function doCheck() {
    var token = input.value.trim();
    if (!token || token.length < 4) return;

    btn.disabled = true;
    btn.textContent = 'Checking…';
    card.className  = 'result-card';
    card.innerHTML  = '';

    fetch('/api/status/' + encodeURIComponent(token), {
      credentials:    'omit',
      referrerPolicy: 'no-referrer',
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { render(data); })
      .catch(function () { renderError(); })
      .finally(function () {
        card.classList.add('visible');
        btn.disabled    = false;
        btn.textContent = 'Check Status';
      });
  }
})();
