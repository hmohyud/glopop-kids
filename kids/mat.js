/* ---- kids/mat.js ---- */
/* Fold-Along Bay: the fold mat engine (build plan 3.10; spec K1 fold mat, K3 scrunch), as the owner asked for it:
 * the paper itself is the button. Ori.mat binds every model record a feature file defines to its shell,
 * div.mat[data-mat=id], and does everything the model never does: the stage as the one tap target (role, name,
 * Enter and Space), data-step / data-made / data-busy / data-paper, the lines for the screen reader, storage, sound
 * cues, the "tap the paper" note and the idle nudge, the one small "New paper" button, and reset.
 * One tap is the next thing: a fold, and once the model is finished its action. A tap during a fold is never lost:
 * the running fold lands at once and the next one starts in the same task.
 * Stills are the truth: a fold only travels between two drawn stills, in three held poses of about 58 ms, and always
 * lands on the next still exactly as drawn. When the page is still (Pause, reduced motion, no stage clock) Ori.play
 * draws only the last frame, so every tap swaps stills like a printed instruction strip. No model lives in this file. */
(function () {
  'use strict';
  var Ori = window.Ori;
  if (!Ori) return;                                  // the core is missing: the page stays as the HTML has it

  var doc = document, win = window, root = doc.documentElement, TAU = Math.PI * 2;
  var ORDER = ['boat', 'cube', 'teller', 'wheel'];
  var SHEET = '10,10 90,10 90,90 10,90';             // the flat sheet, when a record names no outline
  var POSES = [45, 100, 150], LITE = [70, 140];      // the held poses of a fold, in degrees; then the next still
  var HOLD = 58;                                     // ms a pose is held: a fold is over in under a quarter of a second
  var NAME = 'Fold the paper', AGAIN = 'New paper', NOTE = 'tap the paper';
  var BALL = { x: 50, y: 63, r: 17 };                // where a scrunched sheet ends up on the stage, and how big
  var IDLE = 4200;                                   // ms between two nudges of a sheet that is waiting to be folded
  var SAME = { k: 1, tx: 0, ty: 0 };
  var models = {}, mats = {}, inited = false, readied = false, tapped = false, timer = 0;

  function now() { return win.performance && win.performance.now ? win.performance.now() : +new Date(); }

  /* ================================ markup: stills, creases, maps ================================ */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function n1(v) { return Math.round(v * 10) / 10 || 0; }
  function poly(cls, pts, extra) { return '<polygon class="' + cls + '" points="' + (typeof pts === 'string' ? pts : Ori.str(pts)) + '"' + (extra || '') + '/>'; }
  function line(cls, x1, y1, x2, y2) { return '<line class="' + cls + '" x1="' + n1(x1) + '" y1="' + n1(y1) + '" x2="' + n1(x2) + '" y2="' + n1(y2) + '"/>'; }
  function modeOf(opts) { var m = opts && opts.mode; return m === 'plan' || m === 'print' ? m : 'paper'; }
  function white(tone) { return /^ob/.test(tone); }
  function shadowTone(tone) { return tone === 'ocs' || tone === 'osh'; }   // a face may be a drawn shadow: it is not paper

  // one crease: [x1, y1, x2, y2, kind]. 'v' and 'm' are notation for the fold about to be made; 'k' is a crease
  // that stayed: the dark hairline and its lit twin 0.4 units beside it, on the side away from the light
  function creaseMarkup(c, mode) {
    var x1 = +c[0], y1 = +c[1], x2 = +c[2], y2 = +c[3], k = c[4], pc = mode === 'print' ? ' mat-pc' : '';
    if (k === 'v') return line('cv' + pc, x1, y1, x2, y2);
    if (k === 'm') return line('cm' + pc, x1, y1, x2, y2);
    if (mode !== 'paper') return line('ck' + pc, x1, y1, x2, y2);
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L * 0.4, ny = dx / L * 0.4;
    if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    return line('ck', x1, y1, x2, y2) + line('ck ck-l', x1 + nx, y1 + ny, x2 + nx, y2 + ny);
  }
  function creasesMarkup(list, mode) {
    var out = '', i;
    for (i = 0; list && i < list.length; i++) out += creaseMarkup(list[i], mode);
    return out;
  }
  // the drawn shadow: the still's outline when it names one (class osh), otherwise one copy of every face in a
  // group that carries the opacity, so overlapping layers do not double up. Offset (1.5, 3), painted first.
  function pathOf(list) {                           // every outline wound the same way: overlaps neither double nor cancel
    var d = '', i, k, p, a;
    for (i = 0; i < list.length; i++) {
      p = typeof list[i] === 'string' ? Ori.pts(list[i]) : list[i];
      if (p.length < 3) continue;
      for (a = 0, k = 0; k < p.length; k++) a += p[k][0] * p[(k + 1) % p.length][1] - p[(k + 1) % p.length][0] * p[k][1];
      if (a < 0) p = p.slice().reverse();
      d += 'M' + p.map(function (q) { return n1(q[0]) + ' ' + n1(q[1]); }).join('L') + 'Z';
    }
    return d;
  }
  function outlines(faces) {                         // the paper of a still: every face that is not a drawn shadow
    var out = [], i;
    for (i = 0; faces && i < faces.length; i++) if (!shadowTone(faces[i][0])) out.push(faces[i][1]);
    return out;
  }
  function shadowPath(list) { var d = pathOf(list); return d ? '<path class="mat__shp" d="' + d + '" transform="translate(1.5 3)"/>' : ''; }
  function shadowMarkup(st) {
    if (!st || st.shadow === false) return '';
    if (typeof st.shadow === 'string') return poly('osh', st.shadow, ' transform="translate(1.5 3)"');
    return shadowPath(outlines(st.faces));
  }
  function facesMarkup(faces, mode) {
    var out = '', i;
    for (i = 0; faces && i < faces.length; i++) {
      if (mode === 'print' && shadowTone(faces[i][0])) continue;
      out += poly(mode === 'print' ? (white(faces[i][0]) ? 'mat-pw' : 'mat-pg') : faces[i][0], faces[i][1]);
    }
    return out;
  }
  // paper: tone classes. plan: the pencil outline, no fills. print: white and grey sides under a black outline.
  function stillMarkup(st, mode) {
    var out = '', i, outline = typeof st.shadow === 'string' ? st.shadow : null, faces = st.faces || [];
    if (mode === 'paper') out = shadowMarkup(st) + facesMarkup(faces, mode);
    else if (mode === 'plan') {
      if (outline) out = poly('mat-plan', outline);
      else for (i = 0; i < faces.length; i++) if (!shadowTone(faces[i][0])) out += poly('mat-plan', faces[i][1]);
    } else {
      out = facesMarkup(faces, mode);
      if (outline) out += poly('mat-po', outline);
      else for (i = 0; i < faces.length; i++) if (!shadowTone(faces[i][0])) out += poly('mat-po', faces[i][1]);
    }
    return out + creasesMarkup(st.creases, mode);
  }
  function stateOf(rec, which) {
    if (which && typeof which === 'object') return which;
    if (which === 'flat') return rec.states[0];
    if (which === 'done' || which === undefined || which === null) return rec.states[rec.states.length - 1];
    return rec.states[+which] || null;
  }
  function sheetOf(rec) {
    var mp = rec.map || {}, s0 = rec.states[0];
    return typeof mp.sheet === 'string' ? mp.sheet : s0 && typeof s0.shadow === 'string' ? s0.shadow : SHEET;
  }

  function still(id, which, opts) {
    var rec = models[id], st = rec && stateOf(rec, which);
    return st ? stillMarkup(st, modeOf(opts)) : '';
  }
  // the flat sheet with every crease of record.map in notation; numbers: the step that folds each crease
  function map(id, opts) {
    var rec = models[id];
    if (!rec) return '';
    var mode = modeOf(opts), numbers = !!(opts && opts.numbers), sheet = sheetOf(rec), cr = (rec.map && rec.map.creases) || [];
    var pr = rec.print || {}, out = '', seen = {}, i, c, dx, dy, L, x, y, t, l;
    if (mode === 'print') {
      for (i = 0; pr.tabs && i < pr.tabs.length; i++) out += poly('mat-pt', pr.tabs[i]);
      out += poly('mat-pw', sheet) + poly('mat-po', sheet);
    } else if (mode === 'plan') out += poly('mat-plan', sheet);
    else out += poly('osh', sheet, ' transform="translate(1.5 3)"') + poly(rec.up ? 'o3' : 'ob1', sheet);
    for (i = 0; i < cr.length; i++) out += creaseMarkup(cr[i], mode);
    if (numbers) for (i = 0; i < cr.length; i++) {
      c = cr[i]; t = c[5];
      if (!t) continue;
      dx = c[2] - c[0]; dy = c[3] - c[1]; L = Math.sqrt(dx * dx + dy * dy) || 1;
      if (L < 12 && seen[t]) continue;               // a short crease is numbered only when its step has no number yet
      seen[t] = 1;
      x = (c[0] + c[2]) / 2; y = (c[1] + c[3]) / 2;
      out += '<circle class="mat-numc' + (mode === 'print' ? ' mat-pc' : '') + '" cx="' + n1(x) + '" cy="' + n1(y) + '" r="3.4"/>' +
        '<text class="mat-num' + (mode === 'print' ? ' mat-pn' : '') + '" x="' + n1(x) + '" y="' + n1(y) + '">' + esc(t) + '</text>';
    }
    if (mode === 'print') for (i = 0; pr.labels && i < pr.labels.length; i++) {
      l = pr.labels[i];
      out += '<text class="mat-lab" transform="translate(' + n1(l[0]) + ' ' + n1(l[1]) + ') rotate(' + n1(l[2] || 0) + ')">' + esc(l[3]) + '</text>';
    }
    return out;
  }

  /* ================================ small geometry ================================ */
  function bbox(st) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ((st && st.faces) || []).forEach(function (f) {
      if (!shadowTone(f[0])) Ori.pts(f[1]).forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    });
    if (x1 < x0) { x0 = y0 = 10; x1 = y1 = 90; }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function centroid(pts) {
    var x = 0, y = 0, i;
    for (i = 0; i < pts.length; i++) { x += pts[i][0]; y += pts[i][1]; }
    return [x / (pts.length || 1), y / (pts.length || 1)];
  }
  function inside(p, pts) {
    var i, j, hit = false;
    for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i][1] > p[1]) !== (pts[j][1] > p[1]) && p[0] < (pts[j][0] - pts[i][0]) * (p[1] - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) hit = !hit;
    }
    return hit;
  }
  // the ragged 16-point outline of Ori.crumplePoints, laid over a figure's own box
  function ragged(c, rnd, box, pad) {
    return Ori.pts(Ori.crumplePoints(c, rnd)).map(function (p) {
      return [box.x - pad + p[0] / 100 * (box.w + 2 * pad), box.y - pad + p[1] / 100 * (box.h + 2 * pad)];
    });
  }
  function seedNow() { return (Math.random() * 2147483647) | 0; }
  // A record with `fit: 1.08` is shown at that size with every still centred on the stage (the boat: a folded
  // model is smaller than its sheet and lies in one corner of it). One size for every still: paper never grows.
  function viewOf(m, st) {
    var f = +m.rec.fit, b;
    if (!(f > 0) || !st) return SAME;
    b = bbox(st);
    return { k: f, tx: 50 - b.cx * f, ty: 50 - b.cy * f };
  }

  /* ================================ painting ================================ */
  function setView(m, v) {
    var t = !v || v === SAME ? '' : 'translate(' + n1(v.tx) + ' ' + n1(v.ty) + ') scale(' + v.k + ')';
    if (t === m.viewNow) return;                     // the same view again: nothing to set
    m.viewNow = t;
    if (t) m.gView.setAttribute('transform', t); else m.gView.removeAttribute('transform');
  }
  function clip(m, pts) {
    if (!pts) { if (m.clipped) { m.gPaper.removeAttribute('clip-path'); m.clipped = false; } return; }
    m.clipPoly.setAttribute('points', Ori.str(pts));
    m.gPaper.setAttribute('clip-path', 'url(#' + m.clipId + ')');
    m.clipped = true;
  }
  function within(m, st) {                           // keep the overlay inside the figure's own silhouette
    if (!st) { if (m.inside) { m.gCrush.removeAttribute('clip-path'); m.inside = false; } return; }
    m.figPath.setAttribute('d', pathOf(outlines(st.faces)));
    m.gCrush.setAttribute('clip-path', 'url(#' + m.clipId + '-fig)');
    m.inside = true;
  }
  function straight(m) { if (m.turned) { m.fig.removeAttribute('transform'); m.turned = false; } }
  function turn(m, t) { m.fig.setAttribute('transform', t); m.turned = true; }
  function paint(m, st, v) {                         // one still, nothing else: no jitter, no clip, no wad
    straight(m);
    clip(m, null);
    within(m, null);
    setView(m, v || viewOf(m, st));
    m.gShadow.innerHTML = shadowMarkup(st);
    m.gFaces.innerHTML = facesMarkup(st.faces, 'paper');
    m.gMarks.innerHTML = creasesMarkup(st.creases, 'paper');
    if (m.crushed) { m.gCrush.innerHTML = ''; m.crushed = false; }
  }
  // the resting picture of the mat's current state: the still of step i
  function rest(m) {
    m.shown = null;
    m.ball = false;
    paint(m, m.rec.states[Math.min(m.i, m.n)], m.views[Math.min(m.i, m.n)]);
    attrs(m);
  }

  /* ================================ the scrunch: a wad of paper ================================ */
  // A crumpled wad about (cx, cy): an uneven outline of many small corners; inside it small facets in tones that
  // barely differ, one soft light across the whole (upper left to lower right), a facet of the other side here and
  // there, and many short creases that start together in a few places and run their own way. Soft and creased:
  // paper that was squeezed in a fist, not a cut gem.
  function wad(m, seed, cx, cy, rx, ry, ground) {
    var R = Ori.rng(seed), spec = [[26, 1], [13, 0.66], [7, 0.34]], rings = [], fill = '', marks = '', r, i, n, a, k, t, ring, A, B, j, j2, c, u, v, d, len, e, g;
    function facet(p, q, s) {
      var mx = (p[0] + q[0] + s[0]) / 3 - cx, my = (p[1] + q[1] + s[1]) / 3 - cy;
      var f = -(mx / rx + my / ry) * 0.3 + (R() - 0.5) * 1.2, cls;   // every facet tips its own way
      cls = R() < 0.07 ? 'wd-r' : f > 0.42 ? 'wd-l2' : f > 0.14 ? 'wd-l1' : f > -0.14 ? '' : f > -0.42 ? 'wd-d1' : 'wd-d2';
      if (cls) fill += poly(cls, [p, q, s]);
    }
    for (r = 0; r < spec.length; r++) {
      n = spec[r][0]; ring = [];
      for (i = 0; i < n; i++) {
        a = (i + (r ? R() * 0.45 : 0)) / n * TAU + (R() - 0.5) * 0.16;
        t = R();
        k = spec[r][1] * (r ? 0.8 + R() * 0.4 : 0.92 + R() * 0.1 + (t < 0.15 ? 0.08 : t > 0.84 ? -0.09 : 0));   // a corner sticks out here, a dent goes in there
        ring.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
      }
      rings.push(ring);
    }
    c = [cx + (R() - 0.5) * rx * 0.2, cy + (R() - 0.5) * ry * 0.2];
    for (r = 0; r < rings.length - 1; r++) {
      A = rings[r]; B = rings[r + 1];
      for (i = 0; i < A.length; i++) {
        j = Math.floor(i * B.length / A.length); j2 = Math.floor(((i + 1) % A.length) * B.length / A.length);
        facet(A[i], A[(i + 1) % A.length], B[j]);
        if (j2 !== j) facet(B[j], B[j2], A[(i + 1) % A.length]);
      }
    }
    A = rings[rings.length - 1];
    for (i = 0; i < A.length; i++) facet(A[i], A[(i + 1) % A.length], c);
    // the creases: a crease is a dark hairline with a lit one beside it, on the side away from the light
    for (i = 0; i < 11; i++) {
      a = R() * TAU; k = Math.sqrt(R()) * 0.7;
      u = Math.cos(a) * k; v = Math.sin(a) * k;
      n = 2 + (R() < 0.5 ? 1 : 0); g = R() * TAU;
      for (j = 0; j < n; j++) {
        d = g + j * TAU / n + (R() - 0.5) * 1.1; len = 0.2 + R() * 0.34;
        e = [u + Math.cos(d) * len, v + Math.sin(d) * len];
        t = Math.sqrt(e[0] * e[0] + e[1] * e[1]);
        if (t > 0.86) { e[0] *= 0.86 / t; e[1] *= 0.86 / t; }
        t = Math.cos(d) - Math.sin(d) > 0 ? 0.035 : -0.035;      // the twin's offset, across the crease
        marks += line('wd-k', cx + u * rx, cy + v * ry, cx + e[0] * rx, cy + e[1] * ry) +
          line('wd-k wd-kl', cx + (u - Math.sin(d) * t) * rx, cy + (v + Math.cos(d) * t) * ry, cx + (e[0] - Math.sin(d) * t) * rx, cy + (e[1] + Math.cos(d) * t) * ry);
      }
    }
    return (ground ? poly('osh', rings[0].map(function (p) { return [cx + (p[0] - cx) * 1.03 + 1.5, cy + ry * 0.93 + (p[1] - cy) * 0.14]; })) : '') +
      poly('wd', rings[0]) + fill + poly('wd-vol', rings[0], ' fill="url(#' + m.clipId + '-vol)"') + marks;
  }
  function wadFrame(m, markup) {                     // one held frame that is all wad: on the stage's own grid
    straight(m);
    clip(m, null);
    within(m, null);
    setView(m, SAME);
    m.gShadow.innerHTML = m.gFaces.innerHTML = m.gMarks.innerHTML = '';
    m.gCrush.innerHTML = markup;
    m.crushed = true;
  }

  /* ================================ fold frames ================================ */
  // the tone a flap lands in: the tone drawn in the next still where the flap comes down (spec 4.3). A fold entry
  // may name it (land: 'o3', or one per face); a flap that goes behind lands out of sight and keeps its reverse.
  function landing(rec, idx, f, ix) {
    var A = rec.states[idx], B = rec.states[idx + 1], face = A.faces[ix], q, c, j;
    if (typeof f.land === 'string') return f.land;
    if (f.land && f.land[f.faces.indexOf(ix)]) return f.land[f.faces.indexOf(ix)];
    if (f.dir !== 'm') {
      q = Ori.foldPoly(face[1], f.a, f.b, 180).pts; c = centroid(q);
      for (j = B.faces.length - 1; j >= 0; j--) if (!shadowTone(B.faces[j][0]) && inside(c, Ori.pts(B.faces[j][1]))) return B.faces[j][0];
    }
    return white(face[0]) ? 'o3' : 'ob1';
  }
  // everything about step idx that is the same in every pose, worked out once at the tap: which fold moves which
  // face, and the tone it lands in
  function plan(rec, idx) {
    var mover = {}, land = {};
    rec.steps[idx].folds.forEach(function (fold) {
      fold.faces.forEach(function (ix) { mover[ix] = fold; land[ix] = landing(rec, idx, fold, ix); });
    });
    return { mover: mover, land: land };
  }
  // step idx at p degrees: the departing still with its flaps turned. No layout is read and nothing is measured:
  // a frame is three strings.
  function flaps(m, idx, p, pl) {
    var rec = m.rec, step = rec.steps[idx], A = rec.states[idx];
    var hinge = {}, bottom = '', mid = '', top = '', marks = '', drawn = [], i, f, face, fp, tone, off, piece;
    if (p <= 90) step.folds.forEach(function (fold) {     // the hinge, once per crease, until the flap stands upright
      var key = fold.a.concat(fold.b).join(',');
      if (!hinge[key]) marks += line(fold.dir === 'm' ? 'cm' : 'cv', fold.a[0], fold.a[1], fold.b[0], fold.b[1]);
      hinge[key] = 1;
    });
    for (i = 0; i < A.faces.length; i++) {
      face = A.faces[i]; f = pl.mover[i];
      if (!f) { mid += poly(face[0], face[1]); if (!shadowTone(face[0])) drawn.push(face[1]); continue; }
      fp = Ori.foldPoly(face[1], f.a, f.b, f.dir === 'm' ? -p : p);
      drawn.push(fp.pts);
      tone = Ori.shade(face[0], p, pl.land[i]);
      if (f.dir === 'm') { bottom += poly(tone, fp.pts); continue; }   // behind the sheet from its first pose: no contact shadow
      off = Ori.contact(fp.lift);
      piece = poly('ocs', fp.pts.map(function (q) { return [q[0] + off[0], q[1] + off[1]]; })) + poly(tone, fp.pts);
      if (p > 90) top += piece; else mid += piece;
    }
    straight(m);
    clip(m, null);
    within(m, null);
    setView(m, m.views[idx]);
    m.gShadow.innerHTML = shadowPath(drawn);         // the shadow of exactly what is drawn in this frame
    m.gFaces.innerHTML = bottom + mid + top;
    m.gMarks.innerHTML = marks;
  }
  function jitter(m, st, idx) {                      // an in-between still of a swap step, placed by hand
    paint(m, st, m.views[idx]);
    turn(m, 'translate(' + n1(Ori.boil(0.6)) + ' ' + n1(Ori.boil(0.6)) + ') rotate(' + n1(Ori.boil(1.5)) + ' 50 50)');
  }
  // play step idx (states[idx] -> states[idx + 1]). The first pose is drawn inside this call, so inside the tap.
  // m.i already holds the destination, so the last frame is always rest(m): the complete end state.
  function travel(m, idx, then) {
    var rec = m.rec, step = rec.steps[idx], frames = [], ms = [], ticked = false, pl;
    if (step.kind === 'swap') (step.via || []).forEach(function (st) { frames.push(function () { jitter(m, st, idx); }); });
    else {
      pl = plan(rec, idx);
      (root.classList.contains('lite') ? LITE : POSES).forEach(function (p) {
        frames.push(function () {
          flaps(m, idx, p, pl);
          if (p > 90 && !ticked) { ticked = true; Ori.sound.play('crease'); }
        });
      });
    }
    frames.push(function () { rest(m); });
    frames.forEach(function (f, k) { ms.push(k === frames.length - 1 ? 16 : HOLD); });   // the landed still is not held: the next tap may come
    m.seq = Ori.play(frames.length, function (k) { frames[k](); }, {
      key: 'mat', ms: ms,
      done: function (completed) { if (!completed) rest(m); if (!ticked) Ori.sound.play('crease'); then(); }
    });
  }

  /* ================================ state, name, announcing ================================ */
  function stepAttr(m) { return m.ball ? 'ball' : m.i >= m.n ? (m.landing ? String(m.n) : 'done') : String(m.i); }
  function attrs(m) {
    m.el.setAttribute('data-step', stepAttr(m));
    m.el.setAttribute('data-made', String(!!m.made));
    m.el.setAttribute('data-busy', String(!!m.busy));
    m.el.setAttribute('data-paper', m.shown || m.paper);
  }
  function guard(m, fn, a, b) {                      // a model's own function: its error is its feature's, never the engine's
    try { return fn(a, b); } catch (e) { Ori.report(m.id, e); }
  }
  function actLabel(m) {
    var act = m.rec.act, l;
    if (!act || typeof act.run !== 'function') return null;
    l = typeof act.label === 'function' ? guard(m, act.label, m.api) : act.label;
    return l === undefined || l === null || l === '' ? null : String(l);
  }
  // the stage's accessible name: "Fold the paper", and once the model is folded the name of its action
  function labels(m) {
    var name = m.i >= m.n && !m.ball ? actLabel(m) || m.rec.name || NAME : NAME;
    if (m.stage.getAttribute('aria-label') !== name) m.stage.setAttribute('aria-label', name);
  }
  function say(m, text) { Ori.say(text, m.sayEl); }
  function keep(m, path, value) { if (ORDER.indexOf(m.id) > -1) Ori.store.set(path + '.' + m.id, value); }
  function emit(m, why) {
    if (typeof win.CustomEvent !== 'function') return;
    try {
      doc.dispatchEvent(new win.CustomEvent('ori:mat', { detail: { id: m.id, step: stepAttr(m), made: !!m.made, paper: m.paper, wrinkle: 0, why: why } }));
    } catch (e) { /* a listener's own error is its own */ }
  }
  function clearAct(m, why) {
    var act = m.rec.act;
    if (act && typeof act.clear === 'function') guard(m, act.clear, m.api, why);
    m.gLayers.innerHTML = '';
  }
  function arrive(m, why) {
    m.busy = false; m.landing = false;
    attrs(m);
    labels(m);
    emit(m, why);
  }

  /* ================================ the invitation: a note, and a nudge ================================ */
  function hintOff() {                               // the first tap on any mat: the note goes for good
    var list, i;
    if (tapped) return;
    tapped = true;
    list = doc.querySelectorAll('.mat__hint');
    for (i = 0; i < list.length; i++) if (list[i].parentNode) list[i].parentNode.removeChild(list[i]);
  }
  function settle(m) { if (m.nudge && !m.nudge.done) m.nudge.finish(); }
  // a sheet that waits to be folded, on screen, moves a hair every few seconds: two held frames, then still again
  function nudge(m) {
    if (m.busy || m.i >= m.n || !m.seen || doc.hidden || Ori.motion.still() || now() - m.touched < IDLE - 200) return;
    m.nudge = Ori.play(3, function (k) {
      if (k === 0) turn(m, 'translate(0 -1.8) rotate(-2.6 50 50)');
      else if (k === 1) turn(m, 'translate(0 0.5) rotate(1.3 50 50)');
      else straight(m);
    }, { ms: [70, 70, 16] });
  }

  /* ================================ what a tap does ================================ */
  function fold(m) {
    var from = m.i, to = from + 1, last = to >= m.n, step = m.rec.steps[from];
    m.i = to; m.busy = true; m.landing = last;
    attrs(m);
    say(m, step.say || '');
    travel(m, from, function () {
      if (last) {
        if (!m.made) { m.made = true; keep(m, 'made', 1); }
        if (m.rec.done) say(m, m.rec.done);
        Ori.sound.play('pat');
      }
      arrive(m, last ? 'done' : 'fold');
    });
  }
  function runAct(m) {
    var act = m.rec.act;
    if (!act || typeof act.run !== 'function') return;
    guard(m, act.run, m.api);
    labels(m);                                       // "Stack one" may have become "Knock it down"
    emit(m, 'act');
  }
  // "New paper": the finished model is scrunched into a ball, the ball is tossed away and a fresh sheet in the
  // next colour is dealt, all from one tap. The model gives first (smaller, turned, ragged, creased); then it is a
  // wad that closes in three sizes on the ball. The last wad is the ball itself a hair larger: no jump in size.
  function renew(m) {
    var rec = m.rec, at = Math.min(m.i, m.n), st = rec.states[at], v = m.views[at], b = bbox(st), papers = rec.papers || [], was = m.paper;
    var X = b.cx * v.k + v.tx, Y = b.cy * v.k + v.ty, hw = Math.max(12, b.w * v.k / 2), hh = Math.max(12, b.h * v.k / 2), seed = seedNow();
    function mix(a, c, t) { return a + (c - a) * t; }
    function ball(t, grow, s, ground) {
      return wad(m, s, mix(X, BALL.x, t), mix(Y, BALL.y, t), mix(hw, BALL.r, t) * grow, mix(hh, BALL.r * 0.93, t) * grow, ground);
    }
    function tossed(dx, dy, deg, k) {
      return '<g transform="translate(' + (BALL.x + dx) + ' ' + (BALL.y + dy) + ') rotate(' + deg + ') scale(' + k + ') translate(' + (-BALL.x) + ' ' + (-BALL.y) + ')">' + ball(1, 1, seed, false) + '</g>';
    }
    if (doc.activeElement === m.again) { try { m.stage.focus({ preventScroll: true }); } catch (e) { m.stage.focus(); } }   // the button is about to go
    clearAct(m, 'fresh');
    m.paper = papers.length ? papers[(papers.indexOf(was) + 1) % papers.length] : was;
    m.shown = was;                                   // the wad keeps the old colour until it has left
    m.ball = true; m.i = 0; m.busy = true; m.touched = now();
    keep(m, 'paper', m.paper);
    attrs(m);
    labels(m);
    say(m, AGAIN + '.');
    Ori.sound.play('scrunch');
    m.seq = Ori.play(9, function (k) {
      if (k === 0) {                                 // the model gives
        paint(m, st, v);
        m.gShadow.innerHTML = m.gMarks.innerHTML = '';
        turn(m, 'translate(' + n1(b.cx) + ' ' + n1(b.cy) + ') rotate(' + n1(-7 + Ori.boil(2)) + ') scale(0.86) translate(' + n1(-b.cx) + ' ' + n1(-b.cy) + ')');
        clip(m, ragged(0.55, Math.random, b, 1));
        within(m, st);
        m.gCrush.innerHTML = '<g opacity="0.55">' + wad(m, seed + 1, b.cx, b.cy, b.w / 2 + 2, b.h / 2 + 2, false) + '</g>';
        m.crushed = true;
      } else if (k < 3) wadFrame(m, ball(k === 1 ? 0.42 : 0.78, 1, seed + k * 13, true));
      else if (k === 3) wadFrame(m, ball(1, 1.1, seed, true));
      else if (k === 4) wadFrame(m, ball(1, 1, seed, true));          // the ball, held long enough to be seen
      else if (k === 5) wadFrame(m, tossed(17, -24, 38, 0.94));       // tossed away in two frames
      else if (k === 6) wadFrame(m, tossed(43, -56, 96, 0.7));
      else if (k === 7) {                            // a clean sheet arrives, not quite straight
        m.ball = false; m.shown = null; attrs(m);
        paint(m, rec.states[0], m.views[0]);
        turn(m, 'translate(-5 2.5) rotate(-5 50 50)');
      } else rest(m);
    }, { key: 'mat', ms: [HOLD, HOLD, HOLD, HOLD, 200, 64, 64, 64, 16], done: function (completed) { if (!completed) rest(m); arrive(m, 'fresh'); } });
  }
  // one tap on the paper. A fold that is still playing lands at once (its last frame, its sound, its event), and
  // the next thing starts in the same task: no tap is ever lost, none waits.
  function go(m) {
    hintOff();
    settle(m);
    m.touched = now();
    if (m.busy && m.seq && !m.seq.done) m.seq.finish();
    if (m.busy) return;
    if (m.i >= m.n) runAct(m); else fold(m);
  }
  function again(m) {
    hintOff();
    settle(m);
    if (m.busy && m.seq && !m.seq.done) m.seq.finish();
    if (m.busy || m.i < m.n) return;
    renew(m);
  }

  /* ================================ binding a model to its shell ================================ */
  function bind(id) {
    var rec = models[id], el = doc.querySelector('.mat[data-mat="' + id + '"]');
    if (!rec || !el || mats[id]) return;
    var q = function (sel) { return el.querySelector(sel); };
    var m = { id: id, rec: rec, n: rec.steps.length, el: el, stage: q('.mat__stage'), art: q('svg.mat__art'), ctl: q('.mat__ctl'), sayEl: q('[data-mat-say]'),
      i: 0, ball: false, made: false, busy: false, landing: false, shown: null, paper: rec.papers && rec.papers[0],
      seq: null, nudge: null, seen: false, touched: 0, readied: false, clipId: 'mat-clip-' + id,
      viewNow: '', turned: false, clipped: false, inside: false, crushed: false, views: [] };
    if (!m.stage || !m.art) return;                  // not the shell this engine knows: leave it as the HTML has it
    var held, i;

    if (rec.papers && rec.papers.length && el.getAttribute('data-paper') !== rec.papers[0]) {
      Ori.report('mat', new Error('mat "' + id + '": data-paper in the HTML is "' + el.getAttribute('data-paper') + '", the record starts with "' + rec.papers[0] + '"'));
    }
    if (ORDER.indexOf(id) > -1) {
      held = Ori.store.get('paper.' + id);
      if (held && (!rec.papers || rec.papers.indexOf(held) > -1)) m.paper = held;   // the stored stock is the only truth for a sheet's colour
      m.made = Ori.store.get('made.' + id) === 1;
    }
    if (!m.paper) m.paper = el.getAttribute('data-paper') || 'berry';
    if (m.made) m.i = m.n;
    for (i = 0; i <= m.n; i++) m.views.push(viewOf(m, rec.states[i]));

    m.art.innerHTML = '<defs><clipPath id="' + m.clipId + '"><polygon points="0,0 100,0 100,100 0,100"/></clipPath><clipPath id="' + m.clipId + '-fig"><path d=""/></clipPath>' +
      '<linearGradient id="' + m.clipId + '-vol" x1="0.12" y1="0.08" x2="0.88" y2="0.96"><stop offset="0" stop-color="#fff" stop-opacity="0.34"/><stop offset="0.48" stop-color="#fff" stop-opacity="0"/>' +
      '<stop offset="0.52" stop-color="#4A0D2E" stop-opacity="0"/><stop offset="1" stop-color="#4A0D2E" stop-opacity="0.24"/></linearGradient></defs>' +
      '<g class="mat__view"><g class="mat__fig"><g class="mat__shadow"></g><g class="mat__paper"><g class="mat__faces"></g><g class="mat__crush"></g><g class="mat__marks"></g></g><g class="mat__layers"></g></g></g>';
    m.gView = m.art.querySelector('.mat__view');
    m.fig = m.art.querySelector('.mat__fig');
    m.gShadow = m.art.querySelector('.mat__shadow');
    m.gPaper = m.art.querySelector('.mat__paper');
    m.gFaces = m.art.querySelector('.mat__faces');
    m.gCrush = m.art.querySelector('.mat__crush');
    m.gMarks = m.art.querySelector('.mat__marks');
    m.gLayers = m.art.querySelector('.mat__layers');
    m.clipPoly = m.art.querySelector('clipPath polygon');
    m.figPath = m.art.querySelector('clipPath path');

    // the paper is the button: one target, named for what the next tap does
    m.stage.removeAttribute('aria-hidden');
    m.stage.setAttribute('role', 'button');
    m.stage.setAttribute('tabindex', '0');
    m.art.setAttribute('aria-hidden', 'true');
    if (!m.sayEl) {                                  // the line for the screen reader, when the shell brings none
      m.sayEl = doc.createElement('p');
      m.sayEl.className = 'mat__say'; m.sayEl.setAttribute('aria-live', 'polite'); m.sayEl.setAttribute('data-mat-say', '');
      el.appendChild(m.sayEl);
    }
    // one small way to start over, beside the finished model (kids/mat.css shows it only at data-step="done")
    m.again = doc.createElement('button');
    m.again.type = 'button'; m.again.className = 'mat__new';
    m.again.setAttribute('aria-label', AGAIN);
    m.again.innerHTML = '<svg class="i" aria-hidden="true" focusable="false"><use href="#i-rotate-ccw"/></svg>';
    el.appendChild(m.again);
    if (!tapped) {                                   // the invitation, until the first tap on any mat
      m.hint = doc.createElement('div');
      m.hint.className = 'mat__hint'; m.hint.setAttribute('aria-hidden', 'true');
      m.hint.innerHTML = '<span class="hand">' + NOTE + '</span><svg viewBox="0 0 110 60" focusable="false"><use href="#ar-swoop" width="110" height="60"/></svg>';
      el.appendChild(m.hint);
    }

    m.api = {
      id: id, el: el, stage: m.stage, art: m.art, again: m.again,
      state: function () { return { step: stepAttr(m), made: !!m.made, paper: m.paper, wrinkle: 0, busy: !!m.busy }; },
      go: function () { go(m); },
      alt: function () { again(m); },
      say: function (text) { say(m, text); },
      layer: function (name) {
        var g = null, kids = m.gLayers.childNodes, k;
        for (k = 0; k < kids.length; k++) if (kids[k].getAttribute && kids[k].getAttribute('data-layer') === String(name)) g = kids[k];
        return g || Ori.svg('g', { 'data-layer': String(name) }, m.gLayers);
      },
      paint: function (which) { var st = stateOf(rec, which); if (st) paint(m, st); }
    };
    mats[id] = m;

    rest(m);
    labels(m);
    if (m.ctl) m.ctl.hidden = false;
    Ori.on(m.stage, 'click', function () { go(m); });
    Ori.on(m.stage, 'keydown', function (e) {
      if (e.target !== m.stage || e.repeat || (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar')) return;
      e.preventDefault();                            // Space must not scroll the page
      go(m);
    });
    Ori.on(m.again, 'click', function () { again(m); });
    Ori.inView(m.stage, function (visible) { m.seen = !!visible; }, { margin: '0px' });
  }
  // stored state says made: rebuild the action state with no animation, set the name, tell everyone (why: 'bind')
  function readyOne(m) {
    var act = m.rec.act;
    if (m.readied) return;
    m.readied = true;
    if (m.made && act && typeof act.restore === 'function') guard(m, act.restore, m.api);
    labels(m);
    emit(m, 'bind');
  }
  function ids() { return ORDER.filter(function (id) { return !!models[id]; }); }
  function each(fn) { Object.keys(mats).forEach(function (id) { fn(mats[id]); }); }
  function ready() {
    readied = true;
    ids().forEach(function (id) { if (mats[id]) readyOne(mats[id]); });
  }
  function reset() {                                 // "Clear my shelf": every mat back to its first-visit state. The store holds the defaults already
    ids().forEach(function (id) {
      var m = mats[id];
      if (!m) return;
      settle(m);
      if (m.seq && !m.seq.done) m.seq.finish();
      clearAct(m, 'reset');
      m.i = 0; m.ball = false; m.made = false; m.busy = false; m.landing = false;
      m.paper = (m.rec.papers && m.rec.papers[0]) || m.paper;
      rest(m);
      labels(m);
      Ori.say('', m.sayEl);
      emit(m, 'reset');
    });
  }
  function define(rec) {
    var ok = rec && typeof rec.id === 'string' && rec.states && rec.steps && rec.states.length === rec.steps.length + 1 && rec.steps.length > 0;
    if (ok) rec.steps.forEach(function (s) {
      if (s.kind === 'swap') return;
      if (s.kind !== 'fold' || !s.folds || !s.folds.length) { ok = false; return; }
      s.folds.forEach(function (f) { if (!f || !f.a || !f.b || !f.faces || (f.dir !== 'v' && f.dir !== 'm')) ok = false; });   // dir is required, no default
    });
    if (!ok) { Ori.report('mat', new Error('Ori.mat.define: not a model record (n + 1 states for n steps; every fold needs a, b, faces and dir "v" or "m")' + (rec && rec.id ? ': ' + rec.id : ''))); return; }
    if (models[rec.id]) return;                      // the first definition stands
    models[rec.id] = rec;
    if (inited) { bind(rec.id); if (readied && mats[rec.id]) readyOne(mats[rec.id]); }   // defined late: bound at once
  }

  Ori.mat = {
    define: define,
    model: function (id) { return models[id] || null; },
    ids: ids,
    get: function (id) { return mats[id] ? mats[id].api : null; },
    still: still,
    map: map,
    ready: ready
  };

  Ori.feature('mat', function () {
    inited = true;
    tapped = ORDER.some(function (id) { return Ori.store.get('made.' + id) === 1; });   // a returning folder needs no invitation
    ids().forEach(bind);
    Object.keys(models).forEach(function (id) { if (ORDER.indexOf(id) < 0) bind(id); });
    if (!timer && Object.keys(mats).length) timer = win.setInterval(function () { try { each(nudge); } catch (e) { Ori.report('mat', e); } }, IDLE);
    return { ready: ready, reset: reset };
  });
})();
