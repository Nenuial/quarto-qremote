/*
 * QRemote — reveal.js plugin for Quarto presentations.
 *
 * - Per-slide timing (optional): `## Title {timing="45"}` (seconds, or "1:30").
 *   Slides without timing use `qremote: default-timing`, or count up if unset.
 * - Speaker view (S key): slide countdown, progress bar and "planned at the end
 *   of this slide", under reveal's own clock. Nothing is shown to the audience.
 * - The presentation clock starts when leaving the title slide (or any slide
 *   with class .standby).
 * - P: pause / resume the slide countdown. R: reset (total clock + slide).
 * - Remote control: if the QRemote Relay Mac app is running, the presentation
 *   connects to it on its own; the iPhone / Apple Watch app can then go to the
 *   next / previous slide, pause, reset, and buzz when a slide's time is up.
 *
 * The speaker view lives in another window: a small script is installed there
 * to draw the countdown, and the presentation sends it its state as messages.
 * The link survives a reload of the presentation.
 */
(function () {
  'use strict';

  var STRINGS = {
    en: {
      slide: 'Current slide',
      untimed: 'untimed',
      paused: 'PAUSED (P to resume)',
      over: "TIME'S UP",
      plannedTotal: 'Planned total: ',
      plannedEnd: 'Planned at the end of this slide: ',
      reset: 'R: reset',
      pauseKey: 'Pause / resume the slide countdown',
      resetKey: 'Reset the clock (total + slide)'
    },
    fr: {
      slide: 'Slide en cours',
      untimed: 'sans durée',
      paused: 'PAUSE (P pour reprendre)',
      over: 'TEMPS ÉCOULÉ',
      plannedTotal: 'Durée totale prévue : ',
      plannedEnd: 'Prévu à la fin de cette slide : ',
      reset: 'R : remise à zéro',
      pauseKey: 'Pause / reprise du compte à rebours',
      resetKey: 'Remise à zéro du chrono (global + slide)'
    }
  };

  var NS = 'qremote';
  var inFrame = window.self !== window.top || /receiver/.test(location.search);

  /** "45", "45s", "1:30", "2m", "1m30s" → seconds; anything else → 0 (untimed). */
  function parseTiming(v) {
    if (v === null || v === undefined || v === false) return 0;
    var s = String(v).trim().toLowerCase();
    var m;
    if ((m = /^(\d+):(\d{1,2})$/.exec(s))) return +m[1] * 60 + +m[2];
    if ((m = /^(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s?)?$/.exec(s)) && (m[1] || m[2])) {
      return Math.round((+m[1] || 0) * 60 + (+m[2] || 0));
    }
    return 0;
  }

  // ------------------------------------------------------------------
  // Script installed in the speaker view (runs in THAT window)
  // ------------------------------------------------------------------
  function speakerSide() {
    if (window.__qremoteInstalled) return;
    window.__qremoteInstalled = true;
    var d = document, box, lbl, num, fill, plan;
    function build(accent, warn) {
      var host = d.querySelector('.speaker-controls-time');
      if (!host) return false;
      var st = d.createElement('style');
      st.textContent =
        '#qr-box{margin-top:6px}' +
        '#qr-num{font-size:2em;font-weight:700;line-height:1.2;color:' + accent + '}' +
        '#qr-bar{height:18px;border-radius:9px;background:rgba(0,0,0,.12);overflow:hidden;margin:4px 0}' +
        '#qr-bar>span{display:block;height:100%;width:0;background:' + accent + '}' +
        '#qr-plan{font-size:13px;color:#777;margin-top:2px}' +
        '#qr-box.over #qr-num{color:' + warn + '}' +
        '#qr-box.over #qr-bar>span{background:' + warn + '}' +
        '#qr-box.untimed #qr-num{color:#777}' +
        '#qr-box.untimed #qr-bar{visibility:hidden}' +
        '#qr-box.paused #qr-num{opacity:.5}';
      d.head.appendChild(st);
      box = d.createElement('div'); box.id = 'qr-box';
      lbl = d.createElement('h4'); lbl.className = 'label';
      num = d.createElement('div'); num.id = 'qr-num';
      var bar = d.createElement('div'); bar.id = 'qr-bar';
      fill = d.createElement('span'); bar.appendChild(fill);
      plan = d.createElement('div'); plan.id = 'qr-plan';
      box.appendChild(lbl); box.appendChild(num); box.appendChild(bar); box.appendChild(plan);
      host.appendChild(box);
      // "Click to Reset" (reveal's total clock): restart the current slide too
      host.addEventListener('click', function () {
        try { window.opener.postMessage('qremote-restart', '*'); } catch (e) {}
      });
      return true;
    }
    window.addEventListener('message', function (e) {
      var m;
      try { m = typeof e.data === 'string' && e.data.charAt(0) === '{' ? JSON.parse(e.data) : null; } catch (err) { return; }
      if (!m || m.namespace !== 'qremote') return;
      if (m.cmd === 'reset-global') {
        var t = d.querySelector('.speaker-controls-time .timer');
        if (t) t.click(); // same as "Click to Reset"
        return;
      }
      if (!box && !build(m.accent, m.warn)) return;
      lbl.textContent = m.lbl;
      num.textContent = m.num;
      fill.style.width = m.w + '%';
      plan.textContent = m.plan;
      box.className = m.cls;
    });
  }

  // ------------------------------------------------------------------
  // Main window
  // ------------------------------------------------------------------
  var speakerWin = null;

  function send(obj) {
    if (!speakerWin || speakerWin.closed) return;
    obj.namespace = NS;
    try { speakerWin.postMessage(JSON.stringify(obj), '*'); } catch (e) {}
  }

  // Install the drawing script in the speaker view (possible as long as this
  // page opened it; it then stays there, even if the presentation is reloaded)
  function install(w, tries) {
    try {
      var d = w.document;
      if (!d.querySelector('.speaker-controls-time')) throw 0; // not ready yet
      if (!w.__qremoteInstalled) {
        var s = d.createElement('script');
        s.textContent = '(' + speakerSide.toString() + ')();';
        d.head.appendChild(s);
      }
    } catch (e) {
      if ((tries || 0) < 30) setTimeout(function () { install(w, (tries || 0) + 1); }, 200);
    }
  }

  function watchSpeakerView() {
    // Speaker view opened by this page (S key)
    var nativeOpen = window.open;
    window.open = function () {
      var w = nativeOpen.apply(window, arguments);
      if (String(arguments[1] || '').indexOf('Notes') !== -1 && w) {
        speakerWin = w;
        install(w, 0);
      }
      return w;
    };
    // Speaker view already open (page reloaded): find it through its messages
    window.addEventListener('message', function (e) {
      if (!e.source || e.source === window) return;
      try {
        var d = typeof e.data === 'string' && e.data.charAt(0) === '{' ? JSON.parse(e.data) : null;
        if (d && d.namespace === 'reveal-notes') speakerWin = e.source;
      } catch (err) {}
    });
  }

  // Steady tick, in a Worker if possible (not throttled in hidden windows)
  function startTicker(fn) {
    try {
      var src = 'setInterval(function(){postMessage(0)},100);';
      var w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = fn;
    } catch (e) {
      setInterval(fn, 100);
    }
  }

  function plainText(el) {
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function setup(deck, cfg) {
    var lang = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
    var t = STRINGS[lang] || STRINGS.en;

    if (inFrame) {
      // Speaker view thumbnails: forward P and R to the presentation
      // (otherwise P = "previous slide" in reveal.js)
      var relay = function (msg) {
        return function () { try { (window.parent.opener || window.top.opener).postMessage(msg, '*'); } catch (e) {} };
      };
      deck.addKeyBinding({ keyCode: 80, key: 'P', description: t.pauseKey }, relay('qremote-toggle-pause'));
      deck.addKeyBinding({ keyCode: 82, key: 'R', description: t.resetKey }, relay('qremote-reset'));
      return;
    }

    deck.configure({ autoSlide: 0 }); // never advance on its own

    var relayURL = cfg.relay === false ? '' : String(cfg.relay || '').replace(/\/+$/, '');
    var defaultS = parseTiming(cfg.defaultTiming);
    var titleStandby = cfg.titleSlideStandby !== false;

    var css = getComputedStyle(document.documentElement);
    var accent = css.getPropertyValue('--qremote-accent').trim() ||
      css.getPropertyValue('--r-link-color').trim() || '#c4a7e7';
    var warn = css.getPropertyValue('--qremote-warn').trim() || '#eb6f92';

    function isStandby(s) {
      return !!(s && (s.classList.contains('standby') || (titleStandby && s.id === 'title-slide')));
    }
    /** Planned seconds for a slide; 0 = untimed. */
    function durOf(s) {
      var v = s && s.getAttribute('data-timing');
      var d = parseTiming(v);
      return d > 0 ? d : defaultS;
    }
    function titleOf(s) {
      if (!s) return '';
      var a = s.getAttribute('data-qremote-title') || s.getAttribute('data-menu-title');
      if (a) return a.trim();
      var h = s.querySelector('h1, h2, h3');
      return h ? plainText(h) : '';
    }
    function notesOf(s) {
      var n = s && s.querySelector('aside.notes');
      if (!n) return '';
      var parts = [];
      n.querySelectorAll('p, li').forEach(function (el) {
        if (el.tagName === 'LI' && el.querySelector('p')) return;
        var x = plainText(el);
        if (x) parts.push(el.tagName === 'LI' ? '• ' + x : x);
      });
      return parts.length ? parts.join('\n\n') : plainText(n);
    }

    var slides = deck.getSlides().filter(function (s) { return !isStandby(s); });
    var total = slides.reduce(function (a, s) { return a + durOf(s); }, 0);
    function plannedEnd(s) {
      var acc = 0;
      for (var i = 0; i < slides.length; i++) { acc += durOf(slides[i]); if (slides[i] === s) return acc; }
      return acc;
    }
    function fmt(ms, up) {
      var s = up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
      return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }

    var slideStart = null;        // start of the current slide (ms); null = title slide
    var pausedAt = null;          // when the countdown was paused; null = running
    var started = false;          // the presentation has left the title slide
    var presentationStart = null; // start of the total clock (ms)

    function draw() {
      var cur = deck.getCurrentSlide();
      var msg = { accent: accent, warn: warn };
      if (slideStart === null || isStandby(cur)) {
        msg.lbl = t.slide; msg.num = '—'; msg.w = 0; msg.cls = '';
        msg.plan = total ? t.plannedTotal + fmt(total * 1000) : '';
      } else {
        var dur = durOf(cur) * 1000;
        var now = pausedAt !== null ? pausedAt : Date.now();
        var p = pausedAt !== null ? ' — ' + t.paused : '';
        if (dur > 0) {
          var elapsed = Math.min(dur, now - slideStart);
          var over = elapsed >= dur;
          msg.num = fmt(dur - elapsed);
          msg.w = 100 * elapsed / dur;
          msg.cls = (over ? 'over' : '') + (pausedAt !== null ? ' paused' : '');
          msg.lbl = t.slide + ' (' + dur / 1000 + ' s)' + (p || (over ? ' — ' + t.over : ''));
        } else {
          msg.num = fmt(Math.max(0, now - slideStart), true);
          msg.w = 0;
          msg.cls = 'untimed' + (pausedAt !== null ? ' paused' : '');
          msg.lbl = t.slide + ' (' + t.untimed + ')' + p;
        }
        msg.plan = (total ? t.plannedEnd + fmt(plannedEnd(cur) * 1000) + ' / ' + fmt(total * 1000) + ' · ' : '') + t.reset;
      }
      send(msg);
    }

    // Restart the countdown of the current slide (and the total clock,
    // which the speaker view has just reset)
    function restartSlide() {
      pausedAt = null;
      slideStart = isStandby(deck.getCurrentSlide()) ? null : Date.now();
      if (slideStart !== null) { started = true; presentationStart = slideStart; }
      draw();
      postState();
    }
    // Full reset: total clock (in the speaker view) + current slide
    function resetAll() {
      send({ cmd: 'reset-global' }); // the speaker view answers "qremote-restart"
      restartSlide();
    }
    function togglePause() {
      if (slideStart === null) return;
      if (pausedAt === null) pausedAt = Date.now();
      else { slideStart += Date.now() - pausedAt; pausedAt = null; } // resume where we stopped
      draw();
      postState();
    }

    // --- Remote control: QRemote Relay (Mac app) ----------------------
    var clientId = Math.random().toString(36).slice(2, 10);
    var relayOK = false, es = null;
    function postState() {
      if (!relayOK) return;
      var cur = deck.getCurrentSlide();
      var next = slides[slides.indexOf(cur) + 1];
      var body = {
        v: 2,
        client: clientId,
        title: document.title,
        index: slides.indexOf(cur) + 1,
        total: slides.length,
        duration: durOf(cur),
        slideStart: slideStart,
        paused: pausedAt !== null,
        pausedAt: pausedAt,
        standby: slideStart === null || isStandby(cur),
        presentationStart: presentationStart,
        plannedEnd: isStandby(cur) ? 0 : plannedEnd(cur),
        plannedTotal: total,
        fragment: cur ? cur.querySelectorAll('.fragment.visible').length : 0,
        fragments: cur ? cur.querySelectorAll('.fragment').length : 0,
        slideTitle: titleOf(cur),
        nextTitle: next ? titleOf(next) : '',
        notes: notesOf(cur)
      };
      // text/plain: no CORS preflight
      fetch(relayURL + '/state', { method: 'POST', body: JSON.stringify(body) })
        .catch(function () { relayOK = false; });
    }
    function connectRelay() {
      if (!relayURL || es) return;
      fetch(relayURL + '/ping').then(function (r) {
        if (!r.ok || es) return;
        relayOK = true;
        es = new EventSource(relayURL + '/events?client=' + clientId);
        es.onmessage = function (e) {
          var m; try { m = JSON.parse(e.data); } catch (err) { return; }
          if (m.cmd === 'next') deck.next();
          else if (m.cmd === 'prev') deck.prev();
          else if (m.cmd === 'pause') togglePause();
          else if (m.cmd === 'reset') resetAll();
          postState(); // confirm to the remote, even if nothing moved
        };
        es.onerror = function () { if (es) es.close(); es = null; relayOK = false; };
        postState();
      }).catch(function () { /* relay not running: try again later */ });
    }
    // Heartbeat every 3 s, driven by the Worker tick below: plain timers are
    // throttled to once a minute when the window is hidden or covered.
    var lastBeat = 0;
    function heartbeat() {
      if (!relayURL || Date.now() - lastBeat < 3000) return;
      lastBeat = Date.now();
      if (!es) connectRelay(); else postState();
    }
    if (relayURL) connectRelay();
    deck.on('fragmentshown', postState);
    deck.on('fragmenthidden', postState);

    deck.on('slidechanged', function () {
      pausedAt = null;
      if (isStandby(deck.getCurrentSlide())) { slideStart = null; draw(); postState(); return; }
      slideStart = Date.now();
      if (!started) { // start of the total clock
        started = true;
        presentationStart = slideStart;
        send({ cmd: 'reset-global' });
      }
      draw();
      postState();
    });

    window.addEventListener('message', function (e) {
      if (e.data === 'qremote-toggle-pause') togglePause();
      else if (e.data === 'qremote-reset') resetAll();
      else if (e.data === 'qremote-restart') restartSlide();
    });
    deck.addKeyBinding({ keyCode: 80, key: 'P', description: t.pauseKey }, togglePause);
    deck.addKeyBinding({ keyCode: 82, key: 'R', description: t.resetKey }, resetAll);

    if (!isStandby(deck.getCurrentSlide())) { // reloaded mid-presentation
      slideStart = Date.now();
      presentationStart = slideStart;
      started = true;
    }
    startTicker(function () { draw(); heartbeat(); });
  }

  window.QRemote = window.QRemote || {
    id: 'QRemote',
    init: function (deck) {
      // Quarto passes YAML keys as written: accept kebab-case and camelCase
      var raw = deck.getConfig().qremote || {};
      var get = function (kebab, camel, dflt) {
        return raw[kebab] !== undefined ? raw[kebab] : raw[camel] !== undefined ? raw[camel] : dflt;
      };
      var cfg = {
        relay: get('relay', 'relay', 'http://localhost:8765'),
        defaultTiming: get('default-timing', 'defaultTiming', null),
        titleSlideStandby: get('title-slide-standby', 'titleSlideStandby', true),
        speakerView: get('speaker-view', 'speakerView', true)
      };
      if (!inFrame && cfg.speakerView !== false) watchSpeakerView();
      if (deck.isReady()) setup(deck, cfg);
      else deck.on('ready', function () { setup(deck, cfg); });
    }
  };
})();
