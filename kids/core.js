/* ---- kids/core.js ---- */
/* Fold-Along Bay: window.Ori, the shared library every kids feature codes against (build plan section 3).
 * Root state, motion state with hold and settle, the stop-motion clock, in-view gating, swipe, announcing,
 * on-device storage, sound state, fold geometry and textures, feature registration, and the three core
 * features (zone, unfold, tex). No fold engine and no model live here.
 * The core never assigns to window.PaperSun and never assumes it exists: with app.js dead the page is still. */
(function () {
  'use strict';
  if (window.Ori) return;
  document.documentElement.classList.add('ori');

  var doc = document, root = doc.documentElement, win = window;
  root.setAttribute('data-zone', 'grown');           // one page for families: no kid zone (see the zone feature)

  var Ori = {}, FRAME = 80, TAU = Math.PI * 2, RAD = Math.PI / 180;
  var noop = function () {};
  var slice = function (list) { return Array.prototype.slice.call(list); };
  var now = function () { return win.performance && win.performance.now ? win.performance.now() : +new Date(); };
  var idle = win.requestIdleCallback ? function (f) { win.requestIdleCallback(f, { timeout: 1500 }); } : function (f) { setTimeout(f, 60); };
  function fire(type, detail) {                      // every ori:* event: a CustomEvent on document, never cancelled
    if (typeof win.CustomEvent !== 'function') return;
    try { doc.dispatchEvent(new win.CustomEvent(type, { detail: detail === undefined ? null : detail })); } catch (e) { /* a listener's own error is its own */ }
  }
  function warn(text) { try { if (win.console && win.console.warn) win.console.warn('[ori] ' + text); } catch (e) { /* no console */ } }

  /* ================================ 3.11 Features, error isolation ================================ */
  // ctx is the name of the feature whose code is running right now. Listeners, clock callbacks, in-view
  // callbacks and motion subscribers remember it when they are made, so a later throw is charged to the
  // feature that made them.
  var ctx = null, feats = [], byName = {}, phase = 0;   // phase: 0 defining, 1 running inits, 2 running ready hooks, 3 booted
  Ori.features = {};

  function report(name, error) {
    try {
      name = String(name);
      if (win.console && win.console.error) win.console.error('[ori] ' + name, error);
      if (!byName[name]) return;                     // not a feature (a bare listener, a clock callback): the console line is the report
      Ori.features[name] = { ok: false, error: error };
      var failed = (root.getAttribute('data-ori-failed') || '').split(/\s+/).filter(Boolean);
      if (failed.indexOf(name) < 0) { failed.push(name); root.setAttribute('data-ori-failed', failed.join(' ')); }
    } catch (e) { /* never throws */ }
  }
  // run fn(a, b) for the feature `owner` (or under the label `what` when nobody owns it); a throw is reported, never passed on
  function guard(owner, what, fn, a, b) {
    var prev = ctx;
    ctx = owner || prev;
    try { return fn(a, b); } catch (e) { report(owner || what, e); } finally { ctx = prev; }
  }
  function runInit(f) {
    if (f.ran) return;
    f.ran = true;
    Ori.features[f.name] = { ok: true };
    var hooks = guard(f.name, f.name, f.init);
    f.hooks = hooks && typeof hooks === 'object' ? hooks : {};
  }
  function hook(f, name, arg) {
    if (f.hooks && typeof f.hooks[name] === 'function') guard(f.name, f.name, function () { f.hooks[name](arg); });
  }
  function runReady(f) {
    if (f.readied) return;
    f.readied = true;
    hook(f, 'ready');
  }
  function eachHook(name, arg) { for (var i = 0; i < feats.length; i++) hook(feats[i], name, arg); }

  function feature(name, init) {
    name = String(name);
    if (byName[name]) { warn('feature "' + name + '" is already registered; the second one is ignored'); return; }
    if (typeof init !== 'function') { warn('feature "' + name + '" has no init function; ignored'); return; }
    var f = { name: name, init: init, hooks: null, ran: false, readied: false };
    byName[name] = f;
    feats.push(f);                                   // while the inits are running, the boot loop reaches it
    if (phase >= 2) runInit(f);                      // registered late: start at once...
    if (phase === 3) runReady(f);                    // ...and, after boot, run its ready hook at once too
  }
  function boot() {
    if (phase) return;
    var i;
    phase = 1;
    region();                                        // the page-wide live region exists before anything speaks
    guard(null, 'theme', function () {               // one subscription for every feature's theme hook
      var ps = win.PaperSun;
      if (ps && typeof ps.onTheme === 'function') ps.onTheme(function (product) { eachHook('theme', product); });
    });
    for (i = 0; i < feats.length; i++) runInit(feats[i]);
    phase = 2;
    for (i = 0; i < feats.length; i++) runReady(feats[i]);
    phase = 3;
    fire('ori:ready');
  }
  // addEventListener whose handler runs inside try/catch. Skipped when el is null. Returns a function that removes it.
  function on(el, type, fn, opts) {
    if (!el || typeof fn !== 'function' || !el.addEventListener) return noop;
    var owner = ctx;
    var handler = function (e) { var self = this; guard(owner, 'on:' + type, function () { fn.call(self, e); }); };
    el.addEventListener(type, handler, opts);
    return function () { el.removeEventListener(type, handler, opts); };
  }
  Ori.feature = feature;
  Ori.report = report;
  Ori.on = on;

  /* ================================ 3.1 Root state: lite ================================ */
  function setLite(signal) {                         // the attribute keeps the first signal that fired
    if (root.classList.contains('lite')) return;
    root.classList.add('lite');
    root.setAttribute('data-ori-lite', signal);
  }
  (function () {
    try {
      var nav = win.navigator || {}, conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      if (conn && conn.saveData) setLite('save');
      else if ((nav.deviceMemory || 8) <= 4) setLite('mem');
      else if ((nav.hardwareConcurrency || 8) <= 2) setLite('cpu');
    } catch (e) { /* unknown device: not lite until the probe says so */ }
  })();

  /* ================================ 3.2 Motion state, hold and settle ================================ */
  var reduceMQ = null;
  try { reduceMQ = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { reduceMQ = null; }
  function stage() {                                 // app.js's clock, or null (app.js never finished, or has no seam)
    try {
      var ps = win.PaperSun, st = ps && ps.stage;
      return st && typeof st.add === 'function' && typeof st.still === 'function' && typeof st.kick === 'function' ? st : null;
    } catch (e) { return null; }
  }
  // Rule S: Pause motion, reduced motion, or no stage clock. One answer for all three.
  function isStill() {
    if (root.getAttribute('data-motion') === 'off') return true;
    if (reduceMQ && reduceMQ.matches) return true;
    var st = stage();
    if (!st) return true;
    try { return !!st.still(); } catch (e) { return true; }
  }
  var ONE_SHOT = {}, subs = [], wasStill = isStill();
  ['place', 'unroll', 'dropin', 'bagdrop', 'flipin', 'openfold', 'laid', 'turnpage', 'pleat', 'bagfold', 'fliptab'].forEach(function (n) { ONE_SHOT[n] = 1; });
  root.classList.toggle('ori-live', !wasStill);

  // Hold: after this, nothing that has already played can play again. A DOM query reaches the sheets the
  // browser is skipping. app.js adds each re-trigger class again, with its own reflow, at the next real trigger.
  function hold() {
    var strip = function (sel, cls) { slice(doc.querySelectorAll(sel)).forEach(function (el) { el.classList.remove(cls); }); };
    slice(doc.querySelectorAll('.rv.in')).forEach(function (el) { el.classList.add('is-held'); });   // reveal is one-way: the class stays
    strip('.fact-slip.unroll', 'unroll');
    strip('.moment__art.swap', 'swap');
    strip('.stack__bag.drop', 'drop');
    strip('.sunpop__in.flip-in', 'flip-in');
    slice(doc.querySelectorAll('.cal__bags svg')).forEach(function (el) { el.style.animation = 'none'; });
  }
  // Settle: lay every sheet out once (so the ones content-visibility was skipping have computed style and
  // their state-driven entrances exist), then finish every running one-shot, all in this task: nothing is painted between.
  function settle() {
    var had = root.classList.contains('cv-off'), n = 0;
    try {
      if (!had) root.classList.add('cv-off');
      if (doc.body) void doc.body.offsetHeight;
      if (doc.getAnimations) doc.getAnimations().forEach(function (a) {
        if (a.animationName && ONE_SHOT[a.animationName] === 1) { try { a.finish(); n++; } catch (e) { /* an endless one cannot be finished */ } }
      });
    } catch (e) { /* no Web Animations: the hold step alone covers the existing one-shots */ }
    if (!had) root.classList.remove('cv-off');
    return n;
  }
  function sync() {
    var still = isStill(), i, list;
    if (still === wasStill) return;
    wasStill = still;
    root.classList.toggle('ori-live', !still);                       // 1
    guard(null, 'motion', hold);                                     // 2
    if (still) finishAll();                                          // 3
    else settle();                                                   // 4
    list = subs.slice();                                             // 5
    for (i = 0; i < list.length; i++) if (subs.indexOf(list[i]) > -1) guard(list[i].owner, 'motion', list[i].fn, still);
    eachHook('motion', still);
    fire('ori:motion', { still: still });
  }
  // Three ways to hear a change; whichever comes first does the work, the others find nothing left to do.
  function changed() { guard(null, 'motion', sync); }
  function mediaChanged() { changed(); setTimeout(changed, 0); }     // once more after app.js's own listener has updated its clock
  on(doc, 'papersun:motion', sync);                                  // app.js touch T2, inside the click that paused
  try { new win.MutationObserver(changed).observe(root, { attributes: true, attributeFilter: ['data-motion'] }); } catch (e) { /* the event alone */ }
  if (reduceMQ) {
    if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', mediaChanged);
    else if (reduceMQ.addListener) reduceMQ.addListener(mediaChanged);
  }
  Ori.motion = {
    still: isStill,
    on: function (fn) {
      if (typeof fn !== 'function') return noop;
      var sub = { fn: fn, owner: ctx };
      subs.push(sub);
      return function () { var i = subs.indexOf(sub); if (i > -1) subs.splice(i, 1); };
    },
    settle: settle,
    oneShot: function () { for (var i = 0; i < arguments.length; i++) if (arguments[i]) ONE_SHOT[String(arguments[i])] = 1; }
  };

  /* ================================ 3.3 The stop-motion clock: held frames, never tweens ================================ */
  // Every sequence rides PaperSun.stage through ONE part, registered the first time a sequence starts live.
  // (STAGE.add has no remove, and registers nothing while the stage is still.)
  var active = [], keyed = {}, part = null, ticking = false;
  function tick(dt) {
    ticking = true;                                  // a sequence started from a draw or a done runs inside the stage's frame
    try {
      var list = active.slice(), ms = dt * 1000, i;
      for (i = 0; i < list.length; i++) if (!list[i].ended) step(list[i], ms);
    } catch (e) { report('clock', e); }              // a throwing tick would stall the whole stage (js-map L2)
    ticking = false;
    if (!active.length && part) part.live = false;
  }
  function ensurePart() {
    if (part) return true;
    var st = stage();
    try {
      if (!st || st.still()) return false;
      part = { el: root, watch: false, live: false, tick: tick };
      st.add(part);
      return true;
    } catch (e) { part = null; return false; }
  }
  function hold_ms(s, i) {                           // how long frame i is held
    var m = s.ms;
    if (m && typeof m === 'object') m = m[i];
    m = +m;
    return m > 0 ? m : FRAME;
  }
  function drawFrame(s) {                            // -> true while the sequence is still alive
    var prev = ctx;
    ctx = s.owner || prev;
    try { s.draw(s.i, s.n); } catch (e) { ctx = prev; end(s, false); report(s.owner || 'clock', e); return false; }
    ctx = prev;
    return !s.ended;
  }
  function end(s, completed) {
    if (s.ended) return;
    s.ended = true;
    s.seq.done = true;
    var i = active.indexOf(s);
    if (i > -1) active.splice(i, 1);
    if (s.key !== undefined && keyed[s.key] === s) delete keyed[s.key];
    if (!active.length && part) part.live = false;
    if (typeof s.cb === 'function') guard(s.owner, 'clock', s.cb, completed);
  }
  function finish(s) {                               // jump to the last frame, then done(true)
    if (s.ended) return;
    if (s.i < s.n - 1) { s.i = s.n - 1; if (!drawFrame(s)) return; }
    end(s, true);
  }
  function step(s, ms) {                             // at most one frame per sequence per tick
    var need = hold_ms(s, s.i);
    s.acc += ms;
    if (s.acc < need) return;
    s.acc -= need;
    if (s.i >= s.n - 1) { end(s, true); return; }    // the last frame has been held: the sequence is over
    s.i++;
    need = hold_ms(s, s.i);
    if (s.acc > need) s.acc = need;                  // never let a slow clock pile frames up
    drawFrame(s);
  }
  function finishAll() { active.slice().forEach(finish); }

  function play(n, draw, opts) {
    opts = opts || {};
    n = Math.max(0, Math.floor(+n || 0));
    var seq = { done: false, finish: noop, cancel: noop };
    var s = { seq: seq, n: n, i: -1, acc: 0, ended: false, draw: typeof draw === 'function' ? draw : noop,
      ms: opts.ms, key: opts.key === undefined || opts.key === null ? undefined : String(opts.key), cb: opts.done, owner: ctx };
    seq.finish = function () { finish(s); };
    seq.cancel = function () { end(s, false); };
    if (s.key !== undefined && keyed[s.key]) finish(keyed[s.key]);    // one sequence per key: the old one lands first
    if (!n) { end(s, true); return seq; }
    if (isStill() !== wasStill) sync();              // a change nobody has told us about yet
    if (isStill() || !ensurePart()) {                // Rule S: only the last frame, at once
      s.i = n - 1;
      if (drawFrame(s)) end(s, true);
      return seq;
    }
    active.push(s);
    if (s.key !== undefined) keyed[s.key] = s;
    s.i = 0;
    if (!drawFrame(s)) return seq;                   // frame 0 is drawn inside the call: the tap answers in the same task
    part.live = true;
    if (ticking) return seq;                         // the stage books its own next frame: a kick here would book a second one (dt 0, NaN wind)
    try { stage().kick(); } catch (e) { finish(s); }
    return seq;
  }
  var EASE = { linear: function (u) { return u; }, out: function (u) { return 1 - (1 - u) * (1 - u); } };
  Ori.FRAME = FRAME;
  Ori.play = play;
  Ori.poses = function (values, set, opts) {
    values = values || [];
    return play(values.length, function (i, n) { set(values[i], i, n); }, opts);
  };
  Ori.tween = function (from, to, n, set, opts) {    // frame i shows from + (to - from) * ease((i + 1) / n): the last frame is exactly `to`
    var ease = opts && opts.ease;
    ease = typeof ease === 'function' ? ease : EASE[ease] || EASE.linear;
    return play(n, function (i, count) { set(i >= count - 1 ? to : from + (to - from) * ease((i + 1) / count), i, count); }, opts);
  };
  Ori.wait = function (frames, fn, opts) {           // fn after that many held frames; at once when still, never after cancel()
    var o = { ms: opts && opts.ms, key: opts && opts.key, done: function (completed) { if (completed && typeof fn === 'function') fn(); } };
    return play(frames, noop, o);
  };
  Ori.foldPoses = function () { return root.classList.contains('lite') ? [60, 120, 180] : [40, 80, 120, 160, 180, 172, 180]; };
  Ori.boil = function (a) { return (Math.random() * 2 - 1) * (+a || 0); };

  /* ================================ 3.4 In-view gating ================================ */
  // fn(visible, entry) on every change, starting from "not visible". Without IntersectionObserver: fn(true) once, asynchronously.
  Ori.inView = function (el, fn, opts) {
    opts = opts || {};
    var owner = ctx, seen = false, dead = false, io = null;
    var api = { disconnect: function () { dead = true; if (io) { io.disconnect(); io = null; } } };
    if (!el || typeof fn !== 'function') return api;
    try {
      io = new win.IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1], v = !!e.isIntersecting;
        if (dead || v === seen) return;
        seen = v;
        if (v && opts.once) api.disconnect();
        guard(owner, 'inView', fn, v, e);
      }, { rootMargin: opts.margin || '80px 0px' });
      io.observe(el);
    } catch (e) {
      io = null;
      setTimeout(function () { if (dead) return; if (opts.once) dead = true; guard(owner, 'inView', fn, true, null); }, 0);
    }
    return api;
  };

  /* ================================ 3.5 Swipe, with the mandatory button alternative ================================ */
  // The only drag on the page. No move tracking, no inertia, no throw: the start, and the release.
  Ori.swipe = function (zone, opts) {
    opts = opts || {};
    var owner = ctx, btn = opts.button, api = { destroy: noop };
    if (!zone || !btn || btn.tagName !== 'BUTTON' || !doc.documentElement.contains(btn)) {
      report(owner || 'swipe', new Error('Ori.swipe needs opts.button: a real <button> in the document that does the same thing'));
      return api;
    }
    var vertical = opts.axis === 'y', min = opts.min > 0 ? +opts.min : 24, act = opts.act;
    var id = null, x0 = 0, y0 = 0, before = zone.style.touchAction, offs = [];
    zone.style.touchAction = vertical ? 'pan-x' : 'pan-y';
    function down(e) {
      if (e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY;                // a new press always starts a new gesture
      try { zone.setPointerCapture(id); } catch (err) { /* the release may then land elsewhere: no action */ }
    }
    function up(e) {
      if (e.pointerId !== id) return;
      id = null;
      var dx = e.clientX - x0, dy = e.clientY - y0, along = vertical ? dy : dx, across = vertical ? dx : dy;
      if (Math.abs(along) > min && Math.abs(along) > Math.abs(across) && typeof act === 'function') act(along > 0 ? 1 : -1);
    }
    function cancel(e) { if (e.pointerId === id) id = null; }
    offs = [on(zone, 'pointerdown', down), on(zone, 'pointerup', up), on(zone, 'pointercancel', cancel)];   // charged to the caller's feature
    api.destroy = function () { offs.forEach(function (off) { off(); }); offs = []; zone.style.touchAction = before; id = null; };
    return api;
  };

  /* ================================ 3.6 Announcing ================================ */
  function region() {                                // the page-wide polite region
    var el = doc.getElementById('ori-say');
    if (el || !doc.body) return el;
    el = doc.createElement('p');
    el.id = 'ori-say';
    el.className = 'sr-only';
    el.setAttribute('aria-live', 'polite');
    doc.body.appendChild(el);
    return el;
  }
  Ori.say = function (text, el) {
    el = el || region();
    if (!el) return;
    text = text === undefined || text === null ? '' : String(text);
    if (el.__oriSay) { clearTimeout(el.__oriSay); el.__oriSay = 0; }
    if (text && el.textContent === text) {           // the same words again: clear, then set, so they are spoken again
      el.textContent = '';
      el.__oriSay = setTimeout(function () { el.__oriSay = 0; el.textContent = text; }, 60);
    } else el.textContent = text;
  };

  /* ================================ 3.8 Sound state (the engine is kids/sound.js) ================================ */
  var soundOn = false, engine = null, lastCue = {}, unlockOffs = [];
  function audioExists() { return !!(win.AudioContext || win.webkitAudioContext); }   // looked up, never constructed here
  function soundReady() { return !!engine && audioExists(); }
  function unlock() { if (engine) guard('sound', 'sound', function () { engine.unlock(); }); }
  function listen(yes) {                             // most cues fire from clock ticks, outside a gesture: keep the context awake
    unlockOffs.forEach(function (off) { off(); });
    unlockOffs = [];
    if (!yes) return;
    var prev = ctx;
    ctx = 'sound';
    unlockOffs = [on(doc, 'pointerup', unlock, true), on(doc, 'keydown', unlock, true)];
    ctx = prev;
  }
  Ori.sound = {
    on: function () { return soundOn; },
    ready: soundReady,
    set: function (want) {                           // never persisted: every load starts silent
      var next = !!want && soundReady();
      if (next) { unlock(); if (!soundOn) listen(true); }
      else { listen(false); if (engine) guard('sound', 'sound', function () { engine.suspend(); }); }
      soundOn = next;
      fire('ori:sound', { on: soundOn });
    },
    play: function (cue) {
      if (!soundOn || !engine || !cue) return;
      var t = now();
      if (lastCue[cue] !== undefined && t - lastCue[cue] < 60) return;
      lastCue[cue] = t;
      guard('sound', 'sound', function () { engine.play(cue); });
    },
    install: function (e) {
      if (engine) { warn('a sound engine is already installed; the second one is ignored'); return; }
      if (!e || typeof e.unlock !== 'function' || typeof e.suspend !== 'function' || typeof e.play !== 'function') { warn('Ori.sound.install needs { unlock(), suspend(), play(cue) }'); return; }
      engine = e;
    }
  };

  /* ================================ 3.7 On-device storage, with reset ================================ */
  var KEY = 'glopop-kids', IDS = ['boat', 'cube', 'teller', 'wheel'], STOCK = { berry: 1, sun: 1, sea: 1, sugar: 1 };
  var DEFAULTS = { v: 1, made: { boat: 0, cube: 0, teller: 0, wheel: 0 }, paper: { boat: 'berry', cube: 'sugar', teller: 'sun', wheel: 'sea' },
    wrinkle: { boat: 0, cube: 0, teller: 0, wheel: 0 }, afloat: 0, planted: 0, stack: 1 };
  var LEAVES = [], storeOk = true, armed = false, resetting = false, dirty = false, mem;
  ['made', 'paper', 'wrinkle'].forEach(function (g) { IDS.forEach(function (id) { LEAVES.push(g + '.' + id); }); });
  LEAVES.push('afloat', 'planted', 'stack');
  function copy(v) { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; }
  function peek(o, path) {
    var p = String(path).split('.'), i;
    for (i = 0; i < p.length; i++) { if (!o || typeof o !== 'object' || !Object.prototype.hasOwnProperty.call(o, p[i])) return undefined; o = o[p[i]]; }
    return o;
  }
  function poke(o, path, v) { var p = path.split('.'); if (p.length === 2) o[p[0]][p[1]] = v; else o[p[0]] = v; }
  function norm(path, v) {                           // -> the value as it is stored, or undefined when it is out of range
    if (LEAVES.indexOf(path) < 0) return undefined;
    var g = path.split('.')[0];
    if (g === 'paper') return typeof v === 'string' && STOCK[v] === 1 ? v : undefined;
    if (v === true) v = 1; else if (v === false) v = 0;
    if (typeof v !== 'number' || v !== v) return undefined;
    if (g === 'wrinkle') return v >= 0 && v <= 0.8 ? Math.round(v * 100) / 100 : undefined;
    if (g === 'stack') return v % 1 === 0 && v >= 1 && v <= 6 ? v : undefined;
    return v === 0 || v === 1 ? v : undefined;       // made.*, afloat, planted
  }
  function ls() { return win.localStorage; }         // the getter itself can throw (blocked storage)
  function load() {                                  // reads the key; never writes. Anything unknown or out of range falls back, silently
    var d = copy(DEFAULTS), raw = null, o = null;
    try { raw = ls().getItem(KEY); } catch (e) { storeOk = false; }
    if (raw) {
      try { o = JSON.parse(raw); } catch (e) { o = null; }
      if (o && typeof o === 'object' && o.v === 1) LEAVES.forEach(function (path) { var v = norm(path, peek(o, path)); if (v !== undefined) poke(d, path, v); });
    }
    return d;
  }
  function drop() { try { ls().removeItem(KEY); } catch (e) { storeOk = false; } }
  function persist() {
    if (!armed || resetting) return;
    try { ls().setItem(KEY, JSON.stringify(mem)); dirty = false; } catch (e) { storeOk = false; }
  }
  mem = load();
  Ori.store = {
    get: function (path, fallback) { var v = peek(mem, path); return v === undefined ? fallback : copy(v); },
    set: function (path, value) {                    // -> true when the value changed
      path = String(path);
      var v = norm(path, value);
      if (v === undefined) { warn('store.set("' + path + '", ' + String(value) + '): unknown field or value out of range; ignored'); return false; }
      if (peek(mem, path) === v) return false;
      poke(mem, path, v);
      dirty = true;
      persist();
      return true;
    },
    all: function () { return copy(mem); },
    ok: function () { return storeOk; },
    arm: function () { armed = true; if (dirty) persist(); },        // a Clear button is on screen: write what is held (spec 7)
    armed: function () { return armed; },
    reset: function () {
      drop();                                                        // 1
      mem = copy(DEFAULTS);                                          // 2
      resetting = true;                                              // 3: a hook's own set() stays in memory
      try { eachHook('reset'); } finally { resetting = false; }
      drop();                                                        // 4
      dirty = false;                                                 //    the key comes back at the next real change
      Ori.sound.set(false);                                          // 5
      fire('ori:reset');                                             // 6
    }
  };

  /* ================================ 3.9 Fold geometry, facet shading, textures ================================ */
  // Point p turned t radians about the crease a -> b and projected back to the page: [x, y, lift] (techniques 3.2).
  function foldPoint(p, a, b, t) {
    var ux = b[0] - a[0], uy = b[1] - a[1], L = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= L; uy /= L;
    var rx = p[0] - a[0], ry = p[1] - a[1], along = rx * ux + ry * uy, d = ry * ux - rx * uy, c = Math.cos(t);
    return [a[0] + ux * along - uy * d * c, a[1] + uy * along + ux * d * c, Math.abs(d) * Math.sin(t)];
  }
  function parsePts(s) {
    if (typeof s !== 'string') return (s || []).map(function (p) { return [+p[0], +p[1]]; });
    var m = s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [], out = [], i;
    for (i = 0; i + 1 < m.length; i += 2) out.push([+m[i], +m[i + 1]]);
    return out;
  }
  function r1(v) { return Math.round(v * 10) / 10 || 0; }             // one decimal; -0 becomes 0
  function strPts(pts) { return (pts || []).map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' '); }
  var COLOUR = ['o1', 'o2', 'o3', 'o4', 'o5'], WHITE = ['ob1', 'ob2'];
  function shade(rest, deg, landing) {
    var a = Math.abs(+deg || 0), fam = COLOUR.indexOf(rest) > -1 ? COLOUR : WHITE.indexOf(rest) > -1 ? WHITE : null;
    if (a >= 170) return landing || rest;
    if (!fam) return rest;                           // ink and shadows do not turn
    if (a >= 100) return fam === COLOUR ? 'ob2' : 'o4';   // past edge-on: the other side of the paper, in shade
    return fam[Math.min(fam.length - 1, fam.indexOf(rest) + (a < 60 ? 1 : 2))];
  }
  function rng(seed) {                               // mulberry32: the same sheet wrinkles the same way
    var a = seed | 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // The ragged outline of a sheet at crumple c (0 flat, 1 ball): 16 points, so the four corners are vertices.
  function crumpleOutline(c, rnd) {
    var P = [], n = 16, i, u, s, t, x, y, pull;
    c = Math.max(0, Math.min(1, +c || 0));
    rnd = typeof rnd === 'function' ? rnd : Math.random;
    for (i = 0; i < n; i++) {
      u = i / n * 4; s = Math.floor(u); t = u - s;
      x = s === 0 ? t : s === 1 ? 1 : s === 2 ? 1 - t : 0;
      y = s === 0 ? 0 : s === 1 ? t : s === 2 ? 1 : 1 - t;
      pull = c * (0.1 + rnd() * 0.3);                // each point is dragged toward the middle by a random share
      P.push([(x + (0.5 - x) * pull) * 100, (y + (0.5 - y) * pull) * 100]);
    }
    return P;
  }
  function paperBall(r, seed) {                      // inner SVG markup for a ball of radius r about 0,0 (techniques 4.7)
    var R = rng(seed), n = 11, pts = [], i, a, k, tone;
    var f = function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); };
    r = +r || 48;
    for (i = 0; i < n; i++) { a = i / n * TAU + (R() - 0.5) * 0.3; k = r * (0.8 + R() * 0.22); pts.push([Math.cos(a) * k, Math.sin(a) * k]); }
    var inner = [[(R() - 0.5) * r * 0.5, (R() - 0.5) * r * 0.5], [(R() - 0.5) * r * 0.8, (R() - 0.5) * r * 0.8], [(R() - 0.5) * r * 0.6, (R() - 0.5) * r * 0.6]];
    var out = '<polygon class="pb" points="' + pts.map(f).join(' ') + '"/>';
    for (i = 0; i < n; i++) {
      tone = (R() < 0.5 ? 'l' : 'd') + (1 + (R() * 3 | 0));
      out += '<polygon class="pb-' + tone + '" points="' + [pts[i], pts[(i + 1) % n], inner[i % 3]].map(f).join(' ') + '"/>';
    }
    return out;
  }
  // The baked crumple tile (techniques 4.4): Voronoi facets, berry ink and white with alpha, so it sits on any stock.
  // crumpleFacets is the arithmetic (the part the probe times); crumpleTile puts it on a canvas and encodes it.
  function crumpleFacets(n, cells, seed, strength) {
    var r = rng(seed), P = [], i, x, y, o = 0, d = new win.Uint8ClampedArray(n * n * 4), half = n / 2;
    for (i = 0; i < cells; i++) P.push({ x: r() * n, y: r() * n, gx: r() * 2 - 1, gy: r() * 2 - 1 });
    for (y = 0; y < n; y++) for (x = 0; x < n; x++, o += 4) {
      var b1 = 1e9, b2 = 1e9, k = 0, kx = 0, ky = 0;
      for (i = 0; i < cells; i++) {
        var dx = x - P[i].x, dy = y - P[i].y;
        if (dx > half) dx -= n; else if (dx < -half) dx += n;        // wrap, so the tile repeats without a seam
        if (dy > half) dy -= n; else if (dy < -half) dy += n;
        var q = dx * dx + dy * dy;
        if (q < b1) { b2 = b1; b1 = q; k = i; kx = dx; ky = dy; } else if (q < b2) b2 = q;
      }
      var edge = Math.sqrt(b2) - Math.sqrt(b1);                      // 0 on a crease, grows into the facet
      var v = (P[k].gx * kx + P[k].gy * ky) / n * 5 + (P[k].gx - P[k].gy) * 0.35;   // a tilted plane
      if (edge < 1.6) v += (P[k].gx > 0 ? 0.9 : -0.9) * (1 - edge / 1.6);           // the crease: a lit or a shaded hairline
      v = Math.max(-1, Math.min(1, v)) * strength;
      if (v < 0) { d[o] = 74; d[o + 1] = 13; d[o + 2] = 46; d[o + 3] = -v * 255; }  // shade: the berry ink
      else { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = v * 255; }                // light: white
    }
    return d;
  }
  function crumpleTile(n, cells, seed, strength) {
    var c = doc.createElement('canvas');
    c.width = c.height = n;
    var g = c.getContext('2d'), img = g.createImageData(n, n);
    img.data.set(crumpleFacets(n, cells, seed, strength));
    g.putImageData(img, 0, 0);
    return 'url(' + c.toDataURL('image/png') + ')';
  }
  Ori.foldPoint = foldPoint;
  Ori.foldPoly = function (pts, a, b, deg) {         // a whole face at deg degrees; negative degrees turn it away (a mountain fold)
    var t = (+deg || 0) * RAD, lift = 0, out = parsePts(pts).map(function (p) {
      var q = foldPoint(p, a, b, t);
      if (Math.abs(q[2]) > Math.abs(lift)) lift = q[2];
      return [q[0], q[1]];
    });
    return { pts: out, lift: lift };
  };
  Ori.pts = parsePts;
  Ori.str = strPts;
  Ori.shade = shade;
  Ori.contact = function (lift) { lift = +lift || 0; return [lift * 0.10, lift * 0.14]; };
  Ori.rng = rng;
  Ori.crumplePoints = function (c, rnd) { return strPts(crumpleOutline(c, rnd)); };
  Ori.crumpleClip = function (c, rnd) {
    return 'polygon(' + crumpleOutline(c, rnd).map(function (p) { return p[0].toFixed(1) + '% ' + p[1].toFixed(1) + '%'; }).join(',') + ')';
  };
  Ori.paperBall = paperBall;
  Ori.svg = function (tag, attrs, parent) {
    var el = doc.createElementNS('http://www.w3.org/2000/svg', tag), k;
    if (attrs) for (k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };

  /* ================================ Core features: zone, unfold, tex ================================ */
  // zone: html[data-zone] is "kid" or "grown" (spec 3.1). One observer over every sheet, read against a line a
  // quarter of the way down the viewport; the last sheet on the line, in document order, decides. The signpost
  // (#grownups) counts as kid, so "grown" starts only when #pop reaches the line. Run at three viewports (plan 0.3, run 12).
  feature('zone', function () {
    // The pop garden is one page for families: there is no kid zone any more. "grown" keeps Shop in the header
    // everywhere (kids/layout.css hides it under any other value).
    root.setAttribute('data-zone', 'grown');
    if (root) return;
    var held = [];
    var order = slice(doc.querySelectorAll('main > section, footer#footer'));
    function isGrown(el) { return el.id !== 'grownups' && !el.classList.contains('kid'); }
    root.setAttribute('data-zone', 'kid');
    if (!('IntersectionObserver' in win)) return;    // it stays kid
    var io = new win.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = held.indexOf(e.target);
        if (e.isIntersecting && i < 0) held.push(e.target);
        if (!e.isIntersecting && i > -1) held.splice(i, 1);
      });
      if (!held.length) return;                      // nothing on the line: keep the last answer
      var last = held.reduce(function (a, b) { return order.indexOf(b) > order.indexOf(a) ? b : a; });
      root.setAttribute('data-zone', isGrown(last) ? 'grown' : 'kid');
    }, { rootMargin: '-25% 0px -75% 0px' });
    order.forEach(function (el) { io.observe(el); });
  });

  // unfold: every [data-unfold] gets .is-in the first time it comes into view (kids/unfold.css plays the entrance,
  // and only under html.ori-live). All of them get it at once when the page is still, when IntersectionObserver
  // is missing, or when setting the observer up throws: the signpost tent and the gummies label can never stay clipped.
  feature('unfold', function () {
    var els = slice(doc.querySelectorAll('[data-unfold]')), io = null;
    function all() {
      if (io) { io.disconnect(); io = null; }
      slice(doc.querySelectorAll('[data-unfold]')).forEach(function (el) { el.classList.add('is-in'); });
    }
    if (isStill()) all();
    else {
      try {
        io = new win.IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-in');
            if (io) io.unobserve(e.target);
          });
        }, { rootMargin: '0px 0px -10% 0px' });      // no threshold: a clipped start state has almost no area to count
        els.forEach(function (el) { io.observe(el); });
      } catch (e) { io = null; all(); }
    }
    return { motion: function (still) { if (still) all(); } };
  });

  // tex: the baked crumple tile, --crumple on <html>, at idle. A 64 px probe is timed first: over 12 ms marks
  // the device lite ("slow"). Under html.lite, however it was set, the 256 px tile is never baked.
  // What is timed is the facet arithmetic of the probe tile, the part that grows with the tile. The canvas and
  // the PNG encode are left out: they wait on other processes, and with a cold JIT they made the first whole
  // bake 9 ms on an idle 32-core desktop and 26 ms on the same machine under load. One reading is not enough
  // either (the arithmetic alone: 3 ms idle, up to 18 ms cold with twelve pages loading at once, 3 to 7 ms on a
  // second pass). So a pass over the line is taken again, up to three passes, each in its own idle slot, and the
  // device is slow only if all three are over it. Ori.features.tex keeps the readings (probe: the fastest,
  // passes: all of them, the cold one first) for the device pass.
  feature('tex', function () {
    if (root.classList.contains('lite')) return;
    var passes = [];
    function bake() {                                // the big tile gets an idle slot of its own
      try { root.style.setProperty('--crumple', crumpleTile(256, 34, 5, 0.16)); } catch (e) { /* no canvas: smooth paper */ }
    }
    function pass() {
      try {
        if (root.classList.contains('lite')) return;
        var t0 = now(), ms;
        crumpleFacets(64, 34, 5, 0.16);
        ms = now() - t0;
        passes.push(Math.round(ms * 10) / 10);
        if (Ori.features.tex) { Ori.features.tex.probe = Math.min.apply(null, passes); Ori.features.tex.passes = passes.slice(); }
        if (ms <= 12) idle(bake);
        else if (passes.length < 3) idle(pass);
        else setLite('slow');
      } catch (e) { /* no typed arrays: smooth paper */ }
    }
    idle(pass);
  });

  /* ================================ Boot ================================ */
  // Files only define while they are evaluated. Every init runs once all scripts have been evaluated, in
  // registration order; then every ready hook; then ori:ready.
  win.Ori = Ori;
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
