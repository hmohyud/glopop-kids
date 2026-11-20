/* ---- kids/teller.js ---- */
/* Fold-Along Bay: the fortune teller that tells true facts (spec K6) and the fact slip with its crumpled scraps
 * (spec K7). The model record for the #sticks fold mat, its action (a tap on the folded fortune teller asks: three
 * quick pinches, four numbered flaps; a tap on a flap lifts it and a fact unfolds on the slip; the next tap on the
 * model asks again) and the scraps: every fact that leaves the
 * slip is scrunched into a paper ball that can be smoothed back.
 * The fold is real and it is the one on the print sheet: a square, color side down. 1 four corners to the centre.
 * 2 flip it over. 3 four corners to the centre again (each new flap is two half triangles: the eight numbers).
 * 4 fold in half and pinch open. The open view is ONE drawing, seen from above: four pockets, each a little
 * pyramid with its tip toward you, and the mouth between them. Opened the other way it is the same drawing with
 * x and y swapped, which keeps the one light (upper left) where it is.
 * Art is on 0..100, the sheet on 10..90. */
(function () {
  'use strict';
  var Ori = window.Ori;
  if (!Ori || !Ori.mat) return;                      // no core or no engine: the mat keeps the still the HTML has

  var win = window, doc = document, TAU = Math.PI * 2;
  var FACT = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7, 6: 8, 7: 9, 8: 10 };   // flap -> index in ol.facts-list (the eight li[data-kid])
  var DONE = "It's a fortune teller. Tap it to ask.";

  function n1(v) { return Math.round(v * 10) / 10 || 0; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function poly(cls, pts) { return '<polygon class="' + cls + '" points="' + (typeof pts === 'string' ? pts : Ori.str(pts)) + '"/>'; }
  function seg(cls, p, q) { return '<line class="' + cls + '" x1="' + n1(p[0]) + '" y1="' + n1(p[1]) + '" x2="' + n1(q[0]) + '" y2="' + n1(q[1]) + '"/>'; }
  function sticksApi() { var p = win.PaperSun; return (p && p.sticks) || null; }
  function seam() { var s = sticksApi(); return !!s && typeof s.pull === 'function'; }   // app.js finished: the facts can be pulled

  /* ================================ the open view: one drawing ================================ */
  // Seen from above with the mouth open north and south (worked out from the real solid: four unit squares about
  // the middle of the sheet, each folded on its diagonal). o: the middle of the sheet, deep in the mouth. a*: the
  // four edge middles; aW and aE are the hinges of the mouth. t*: the four tips, nearest the eye, two on each
  // lip. c*: the outer corner of each pocket. The mouth is a little under half open: tips still near the middle.
  var PT = {
    o: [50, 50], aN: [50, 14.5], aS: [50, 85.5], aW: [23, 50], aE: [77, 50],
    tNW: [46.3, 33.5], tNE: [53.7, 33.5], tSW: [46.3, 66.5], tSE: [53.7, 66.5],
    cNW: [14, 19], cNE: [86, 19], cSW: [14, 81], cSE: [86, 81],
    sN: [50, 24], sS: [50, 76]                       // where the two pockets of a lip stop touching: the slit starts here
  };
  var RIM = ['cNW', 'aN', 'cNE', 'aE', 'cSE', 'aS', 'cSW', 'aW'];
  // the mouth faces by slot (reading order), open north and south: [tip, hinge, tone]. Lifted about hinge-tip.
  var MOUTH = [['tNW', 'aW', 'o4'], ['tNE', 'aE', 'o4'], ['tSW', 'aW', 'o2'], ['tSE', 'aE', 'o1']];
  var SWAP = [0, 2, 1, 3];                           // x and y swapped: the upper right slot is the lower left drawing
  function at(name, ew, k) {
    var p = PT[name], x = ew ? p[1] : p[0], y = ew ? p[0] : p[1];
    k = k || 1;
    return [50 + (x - 50) * k, 50 + (y - 50) * k];
  }
  function openStill(ew, k) {
    function f(tone, names) { return [tone, Ori.str(names.split(' ').map(function (n) { return at(n, ew, k); }))]; }
    function c(a, b) { var p = at(a, ew, k), q = at(b, ew, k); return [n1(p[0]), n1(p[1]), n1(q[0]), n1(q[1]), 'k']; }
    // the white inside of the pockets shows as a hair of rim past their edges, widest on the side away from the light
    var rim = Ori.str(RIM.map(function (n) {
      var p = at(n, ew, k), dx = p[0] - 50, dy = p[1] - 50, L = Math.sqrt(dx * dx + dy * dy) || 1, w = (dx + dy > 0 ? 2 : 1.2) * (k || 1);
      return [p[0] + dx / L * w, p[1] + dy / L * w];
    }));
    return {
      faces: [
        ['ob1', rim],
        f('o5', 'tNW sN tNE o tSE sS tSW o'),                    // the two slits between the pockets,
        f('osh', 'tNW sN tNE o tSE sS tSW o'),                   // deep in shade
        f('o1', 'tNW aW cNW aN sN'),                             // four pockets: the upper left one faces the light whole,
        f('o2', 'tNE sN aN cNE'), f('o3', 'tNE cNE aE'),         // the others have a lit wall and a shaded one
        f('o2', 'tSW cSW aW'), f('o4', 'tSW sS aS cSW'),
        f('o4', 'tSE aE cSE'), f('o5', 'tSE cSE aS sS'),
        f('o4', 'tNW aW o'), f('o4', 'tNE aE o'),                // the mouth: four of the eight numbered triangles
        f('o2', 'tSW aW o'), f('o1', 'tSE aE o')
      ],
      creases: [c('cNW', 'tNW'), c('cNE', 'tNE'), c('cSW', 'tSW'), c('cSE', 'tSE'),
        c('aW', 'tNW'), c('aW', 'tSW'), c('aE', 'tNE'), c('aE', 'tSE'), c('aW', 'o'), c('o', 'aE'), c('aN', 'sN'), c('sS', 'aS')],
      shadow: f('', 'cNW aN cNE aE cSE aS cSW aW')[1]
    };
  }
  var OPEN = [openStill(false), openStill(true)];    // 0: open north and south (the finished still). 1: open east and west

  /* ================================ the model ================================ */
  var DIA = '50,10 90,50 50,90 10,50';
  Ori.mat.define({
    id: 'teller', name: 'Fortune teller',
    papers: ['sun', 'sea', 'berry'],
    up: false,
    rest: 'One square of paper.',
    done: DONE,
    states: [
      /* 0: the flat sheet, white side up, cut along the four creases the first step folds. One corner tip has
            curled and shows the color underneath */
      { faces: [['ob1', DIA], ['ob1', '10,10 50,10 10,50'], ['ob1', '50,10 90,10 90,50'],
          ['ob1', '90,50 90,84 84,90 50,90'], ['o3', '90,84 84,90 85,85'], ['ob1', '10,50 50,90 10,90']],
        creases: [[50, 10, 10, 50, 'v'], [50, 10, 90, 50, 'v'], [90, 50, 50, 90, 'v'], [50, 90, 10, 50, 'v']],
        shadow: '10,10 90,10 90,84 84,90 10,90' },
      /* 1: four corners in: a coloured diamond. The corners did not quite meet, so the white sheet shows in the
            seams and round the edge, and the curled tip shows its white side */
      { faces: [['ob1', DIA], ['o1', '49.4,11.8 11.8,49.4 47.6,47.6'], ['o2', '50.6,11.8 88.2,49.4 52.4,47.6'],
          ['o2', '11.8,50.6 49.4,88.2 47.6,52.4'], ['o4', '88.2,50.6 50.6,88.2 50.8,57.6 57.6,50.8'],
          ['osh', '58.4,51.8 51.6,58.6 57.2,57.4'], ['ob1', '57.6,50.8 50.8,57.6 56,56']],
        creases: [],
        shadow: DIA },
      /* 2: flipped over: the plain back, the four flaps pressing through as a faint cross. Cut along the four
            creases the next step folds */
      { faces: [['o2', '30,30 70,30 70,70 30,70'], ['o1', '50,10 70,30 30,30'], ['o2', '90,50 70,70 70,30'],
          ['o2', '50,90 30,70 70,70'], ['o1', '10,50 30,30 30,70']],
        creases: [[50, 13, 50, 87, 'k'], [13, 50, 87, 50, 'k'], [30, 30, 70, 30, 'v'], [70, 30, 70, 70, 'v'], [70, 70, 30, 70, 'v'], [30, 70, 30, 30, 'v']],
        shadow: DIA },
      /* 3: four corners in again: a small square of four flaps, each one two half triangles (the eight numbers).
            The layer underneath shows in the seams, and a hair of white along two edges */
      { faces: [['ob1', '30,30 70.9,29.5 71.2,71.2 29.5,70.9'], ['o5', '30,30 70,30 70,70 30,70'],
          ['o1', '31,30.4 49.5,30.4 49.5,47.8'], ['o2', '50.5,30.4 69,30.4 50.5,47.8'],
          ['o2', '30.4,31 30.4,49.5 47.8,49.5'], ['o1', '30.4,50.5 30.4,69 47.8,50.5'],
          ['o4', '69.6,31 69.6,49.5 52.2,49.5'], ['o3', '69.6,50.5 69.6,69 52.2,50.5'],
          ['o3', '31,69.6 49.5,69.6 49.5,52.2'], ['o4', '50.5,69.6 69,69.6 50.5,52.2']],
        creases: [],
        shadow: '30,30 70,30 70,70 30,70' },
      /* 4: pinched open */
      OPEN[0]
    ],
    steps: [
      { say: 'Fold all four corners in.', kind: 'fold', folds: [
        { a: [50, 10], b: [10, 50], faces: [1], dir: 'v', land: 'o1' },
        { a: [50, 10], b: [90, 50], faces: [2], dir: 'v', land: 'o2' },
        { a: [90, 50], b: [50, 90], faces: [3, 4], dir: 'v', land: ['o4', 'ob1'] },
        { a: [50, 90], b: [10, 50], faces: [5], dir: 'v', land: 'o2' }] },
      /* the flip: the diamond turns about its upright diagonal, edge on in the middle frame */
      { say: 'Flip it over.', kind: 'swap', via: [
        { faces: [['ob1', '50,9 25,50 50,91 75,50'], ['o2', '50,10.6 26.6,50 50,89.4'], ['o4', '50,10.6 73.4,50 50,89.4']], creases: [], shadow: '53,13 30,54 53,95 78,54' },
        { faces: [['o5', '50,9 44,50 50,91 56,50'], ['ob1', '50,14 48.6,50 50,86 51.4,50']], creases: [], shadow: '55,15 50,56 55,96 61,56' },
        { faces: [['o1', '50,10 26,50 50,90'], ['o2', '50,10 74,50 50,90']], creases: [], shadow: '53,13 30,54 53,95 78,54' }] },
      { say: 'Fold four corners in again.', kind: 'fold', folds: [
        { a: [30, 30], b: [70, 30], faces: [1], dir: 'v', land: 'o1' },
        { a: [70, 30], b: [70, 70], faces: [2], dir: 'v', land: 'o4' },
        { a: [70, 70], b: [30, 70], faces: [3], dir: 'v', land: 'o3' },
        { a: [30, 70], b: [30, 30], faces: [4], dir: 'v', land: 'o2' }] },
      /* folded in half, picked up, pinched open: the open view comes closer in two sizes */
      { say: 'Pinch it open.', kind: 'swap', via: [
        { faces: [['ob1', '30,40 70.8,39.6 71,61 29.6,60.6'], ['o2', '30,40 50,40 50,60 30,60'], ['o4', '50,40 70,40 70,60 50,60']], creases: [[31, 40.6, 69, 40.6, 'k']], shadow: '30,40 70,40 70,60 30,60' },
        openStill(true, 0.62),
        openStill(false, 0.84)] }
    ],
    /* every crease the four steps leave in the flat sheet, white side up; the sixth value is the step */
    map: { sheet: '10,10 90,10 90,90 10,90', creases: [
      [50, 10, 40, 20, 'v', 1], [40, 20, 10, 50, 'v'], [90, 50, 80, 40, 'v', 1], [80, 40, 50, 10, 'v'],
      [50, 90, 60, 80, 'v', 1], [60, 80, 90, 50, 'v'], [10, 50, 20, 60, 'v', 1], [20, 60, 50, 90, 'v'],
      [30, 30, 70, 30, 'm', 3], [70, 30, 70, 70, 'm', 3], [70, 70, 30, 70, 'm', 3], [30, 70, 30, 30, 'm', 3],
      [50, 10, 50, 78, 'v'], [50, 78, 50, 90, 'v', 4], [10, 50, 90, 50, 'v']] },
    print: { mm: 120, labels: [] },                  // the feature fills the labels: flap digits and the eight kid lines
    act: {
      label: function () { return live && seam() ? (asks > 0 ? 'Ask again' : 'Ask the paper') : null; },
      run: function (mat) { ask(mat); },
      restore: function () {},
      clear: function (mat) { closeAsk(mat, true); }
    }
  });

  /* ================================ asking: pinch, pick, tell ================================ */
  var live = false, asks = 0, pose = 0, busy = false, picking = false, token = 0, seq = null;
  var flapsEl = null, flapBtns = [];

  function onFlap() { var a = doc.activeElement; return !!a && flapBtns.indexOf(a) > -1; }
  function toStage(mat) { try { mat.stage.focus({ preventScroll: true }); } catch (e) { mat.stage.focus(); } }
  function hideFlaps() {
    var i;
    if (flapsEl) flapsEl.hidden = true;
    for (i = 0; i < flapBtns.length; i++) { flapBtns[i].hidden = true; flapBtns[i].removeAttribute('data-slot'); }
  }
  function wipe(mat) { var g = mat.layer('ask'); while (g.firstChild) g.removeChild(g.firstChild); }
  // back to "not asking". all: the model itself is going (scrunch, fresh sheet, reset), so the count starts again
  function closeAsk(mat, all) {
    token++;
    if (seq && !seq.done) seq.cancel();
    seq = null; busy = false; picking = false;
    hideFlaps();
    mat.el.removeAttribute('data-ask');
    if (all) { asks = 0; pose = 0; }
  }
  function ask(mat) {
    var from = pose, mine;
    if (!live || busy || !seam()) return;
    if (picking) {                                   // a tap on the paper while the flaps are up: it asks again
      if (onFlap()) toStage(mat);
      picking = false;
      hideFlaps();
    }
    busy = true; asks++; mine = ++token;
    wipe(mat);
    mat.el.removeAttribute('data-ask');
    // three quick pinches: the same drawing, open one way then the other. Still: only the last one is drawn
    seq = Ori.play(3, function (k) {
      pose = (from + k + 1) % 2;
      mat.paint(OPEN[pose]);
      Ori.sound.play('crease');
    }, { ms: 60, key: 'teller', done: function (completed) { if (completed && mine === token) pick(mat); } });
  }
  function pick(mat) {
    var set = asks % 2 ? [1, 2, 5, 6] : [3, 4, 7, 8], shown = [], i, n, ix;
    for (i = 0; i < flapBtns.length; i++) {
      n = +flapBtns[i].getAttribute('data-flap'); ix = set.indexOf(n);
      if (ix < 0) { flapBtns[i].hidden = true; flapBtns[i].removeAttribute('data-slot'); }
      else { flapBtns[i].setAttribute('data-slot', String(ix + 1)); flapBtns[i].hidden = false; shown.push(flapBtns[i]); }
    }
    busy = false; picking = true;
    mat.el.setAttribute('data-ask', 'pick');
    flapsEl.hidden = false;
    mat.say('Pick a flap.');
    if (shown[0] && doc.activeElement === mat.stage) shown[0].focus();   // the keyboard goes where the choice is
  }
  // the inner triangle under slot s (1..4) of the pose that is showing: tip, hinge, the middle of the sheet
  function mouth(s) {
    var m = MOUTH[pose ? SWAP[s - 1] : s - 1], ew = !!pose;
    return { t: at(m[0], ew), a: at(m[1], ew), o: at('o', ew), tone: m[2] };
  }
  // the flap lifted about its base crease: what was under it is white and written on
  function lift(mat, s, deg) {
    var f = mouth(s), tri = [f.t, f.a, f.o], fp = Ori.foldPoly(tri, f.a, f.t, deg), off = Ori.contact(fp.lift);
    var mid = [(f.a[0] + f.o[0]) / 2, (f.a[1] + f.o[1]) / 2], g = mat.layer('ask');
    function p(u, v) { return [f.a[0] + (f.o[0] - f.a[0]) * u + (f.t[0] - mid[0]) * v, f.a[1] + (f.o[1] - f.a[1]) * u + (f.t[1] - mid[1]) * v]; }
    g.innerHTML = poly('ob1', tri) + seg('tl-ink', p(0.36, 0.2), p(0.84, 0.2)) + seg('tl-ink', p(0.46, 0.45), p(0.8, 0.45)) + seg('tl-ink', p(0.6, 0.7), p(0.76, 0.7)) +
      poly('ocs', fp.pts.map(function (q) { return [q[0] + off[0] + 0.6, q[1] + off[1] + 1.2]; })) +
      poly(Ori.shade(f.tone, deg, 'ob1'), fp.pts);
  }
  function tell(mat, n, s) {
    var mine;
    if (!picking || !FACT.hasOwnProperty(n)) return;
    picking = false; busy = true; mine = ++token;
    if (onFlap()) toStage(mat);                      // the flap that was pressed is about to go
    hideFlaps();
    seq = Ori.play(2, function (k) { lift(mat, s, k ? 150 : 70); }, { ms: 60, key: 'teller', done: function (completed) {
      var api = sticksApi();
      if (!completed || mine !== token) return;
      busy = false;
      mat.el.setAttribute('data-ask', 'told');
      if (api && typeof api.pull === 'function') api.pull(FACT[n]);   // a pinwheel rises, its flag unrolls, the slip shows the fact
      mat.say('Flap ' + n + '. Here is your fact.');
      Ori.sound.play('pat');
    } });
  }
  function cancelPick(mat) {                          // Escape while picking: the flaps close, the paper has the focus again
    if (!picking) return;
    if (onFlap()) toStage(mat);
    closeAsk(mat, false);
    mat.say(DONE);
  }

  /* ================================ the print sheet's words ================================ */
  // The printed face is the color side. Each flap digit goes on its half flap (a corner of the sheet), each kid
  // line in the inner triangle that half flap covers, in short lines that fit the triangle. One frame per edge of
  // the inner square: origin, the direction along the edge, the direction toward the middle, the text's turn.
  var EDGE = [[30, 30, 1, 0, 0, 1, 0], [70, 30, 0, 1, -1, 0, 90], [70, 70, -1, 0, 0, -1, 180], [30, 70, 0, -1, 1, 0, 270]];
  function onEdge(e, u, v) { return [e[0] + e[2] * u + e[4] * v, e[1] + e[3] * u + e[5] * v]; }
  function printLabels() {
    var list = doc.querySelectorAll('[data-facts] li'), out = [], n, e, half, kid, words, v, max, text, p, last;
    for (n = 1; n <= 8; n++) {
      e = EDGE[(n - 1) >> 1]; half = (n - 1) & 1;
      p = onEdge(e, half ? 33.3 : 6.7, -13.3);
      out.push([n1(p[0]), n1(p[1]), 360, String(n)]);            // 360: upright, and the mark teller.css knows a digit by
      kid = list[FACT[n]] && list[FACT[n]].querySelector('.kidline');
      if (!kid) continue;
      words = kid.textContent.replace(/\s+/g, ' ').replace(/^ | $/g, '').split(' ');
      for (v = 4.2; words.length; v += 1.5) {
        max = Math.floor((20 - v - 1.35) / 0.65); last = v + 1.5 > 16.5;
        text = words.shift();
        while (words.length && (last || (text + ' ' + words[0]).length <= max)) text += ' ' + words.shift();
        p = onEdge(e, half ? 20.7 + (19.3 - v - 0.7) / 2 : v + 0.7 + (19.3 - v - 0.7) / 2, v);
        out.push([n1(p[0]), n1(p[1]), e[6], text]);
      }
    }
    return out;
  }

  /* ================================ feature: the fortune teller ================================ */
  Ori.feature('teller', function () {
    var sticks = doc.getElementById('sticks'), mat = Ori.mat.get('teller'), rec = Ori.mat.model('teller'), i;
    if (rec && rec.print) rec.print.labels = printLabels();      // the print sheet needs no mount
    flapsEl = sticks && sticks.querySelector('.teller__flaps');
    if (!sticks || !mat || !flapsEl) return;                     // no mount: the mat still folds, it offers no action
    flapBtns = Array.prototype.slice.call(flapsEl.querySelectorAll('button.flap[data-flap]'));
    if (flapBtns.length !== 8 || !seam()) return;                // app.js never finished: no action, no has-teller
    Ori.on(flapsEl, 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button.flap') : null;
      if (b && !b.hidden) tell(mat, +b.getAttribute('data-flap'), +b.getAttribute('data-slot'));
    });
    Ori.on(mat.el, 'keydown', function (e) { if (e.key === 'Escape' || e.key === 'Esc') cancelPick(mat); });
    live = true;
    sticks.classList.add('has-teller');                          // proven: the flaps replace the fallback button (kids/layout.css)
    return { reset: function () { hideFlaps(); } };
  });

  /* ================================ feature: the slip and its scraps (K7) ================================ */
  // a crumpled slip: an uneven outline, a ring of dents, facets lit from the upper left, crease lines, and a few
  // broken strokes of the words that were on it
  function ballMarkup(seed) {
    var R = Ori.rng(seed), n = 17, m = 6, rim = [], inn = [], out, marks = '', i, j, j2, a, k, c, x, y, t;
    function tri(p, q, r) {
      var f = -((p[0] + q[0] + r[0]) + (p[1] + q[1] + r[1])) / 3 / 46 + (R() - 0.5) * 1.5;
      return poly(f > 0.5 ? 'sb-l' : f > 0 ? 'sb-d1' : f > -0.55 ? 'sb-d2' : 'sb-d3', [p, q, r]);
    }
    for (i = 0; i < n; i++) {
      a = i / n * TAU + (R() - 0.5) * 0.26; t = R();                // a corner of the sheet sticks out here and there, a dent goes in
      k = 46 * (0.82 + R() * 0.16) * (t < 0.2 ? 1.17 : t > 0.74 ? 0.8 : 1);
      rim.push([Math.cos(a) * k, Math.sin(a) * k * 0.92]);
    }
    for (j = 0; j < m; j++) { a = (j + 0.5) / m * TAU + (R() - 0.5) * 0.5; k = 14 + R() * 15; inn.push([Math.cos(a) * k, Math.sin(a) * k]); }
    c = [(R() - 0.5) * 10, (R() - 0.5) * 10];
    out = poly('sb-sh', rim.map(function (p) { return [p[0] * 0.96 + 4, 44 + p[1] * 0.16]; })) + poly('sb', rim);
    for (i = 0; i < n; i++) {
      j = Math.floor(i * m / n); j2 = Math.floor(((i + 1) % n) * m / n);
      out += tri(rim[i], rim[(i + 1) % n], inn[j]);
      if (j2 !== j) { out += tri(rim[(i + 1) % n], inn[j], inn[j2]); marks += seg('sb-k', rim[(i + 1) % n], inn[j]); }
      else if (i % 3 === 0) marks += seg('sb-kl', rim[i], inn[j]);
    }
    for (j = 0; j < m; j++) { out += tri(inn[j], inn[(j + 1) % m], c); marks += seg(j % 2 ? 'sb-kl' : 'sb-k', inn[j], c); }
    for (i = 0; i < 5; i++) {                         // what is left of the writing
      a = (R() - 0.5) * 1.3; k = 6 + R() * 9; x = (R() - 0.5) * 50; y = (R() - 0.5) * 44;
      marks += seg(i ? 'sb-i' : 'sb-a', [x, y], [x + Math.cos(a) * k, y + Math.sin(a) * k]);
    }
    return out + marks;
  }
  // loose facets over a sheet that is being scrunched, rolled again every frame
  function crushMarkup(count) {
    var out = '', i, x, y, a, r, t;
    for (i = 0; i < count; i++) {
      x = Math.random() * 100; y = Math.random() * 100; a = Math.random() * TAU; r = 14 + Math.random() * 24;
      t = Math.random();
      out += poly(t < 0.35 ? 'sb-d1' : t < 0.7 ? 'sb-d2' : t < 0.88 ? 'sb-d3' : 'sb-l', [[x + Math.cos(a) * r, y + Math.sin(a) * r],
        [x + Math.cos(a + 2 + Math.random()) * r, y + Math.sin(a + 2 + Math.random()) * r],
        [x + Math.cos(a + 4 + Math.random()) * r * 0.8, y + Math.sin(a + 4 + Math.random()) * r * 0.8]]);
    }
    return out;
  }

  Ori.feature('slip', function () {
    var slip = doc.querySelector('[data-fact-slip]'), txt = slip && slip.querySelector('[data-fact-text]');
    var box = doc.querySelector('#sticks .scraps'), list = box && box.querySelector('.scraps__list');
    var api = sticksApi(), last, lastLine, lastH = 0, ghost = null, smoothing = false, seed = (Math.random() * 1e9) | 0;
    if (!slip || !txt || !box || !list || !win.MutationObserver || !api || typeof api.show !== 'function') return;

    function index() { var v = parseInt(txt.getAttribute('data-fact-i'), 10); return isNaN(v) ? -1 : v; }
    function line() { var k = txt.querySelector('.kidline'); return (k ? k.textContent : txt.textContent || '').replace(/\s+/g, ' ').replace(/^ | $/g, ''); }
    function scrapOf(i) { return list.querySelector('.scrap[data-scrap-fact="' + i + '"]'); }
    function drop(btn) { var li = btn && btn.parentNode; if (li && li.parentNode) li.parentNode.removeChild(li); }
    function endGhost() { if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost); ghost = null; }
    function trim() {                                 // a fourth scrap pushes the oldest out, in two frames
      var old;
      if (list.children.length <= 3) return;
      old = list.firstElementChild;
      Ori.play(2, function (k) {
        if (k === 0) { if (old.firstElementChild) old.firstElementChild.classList.add('is-out'); return; }
        if (old.parentNode) old.parentNode.removeChild(old);
        while (list.children.length > 3) list.removeChild(list.firstElementChild);
      }, { key: 'slip-out' });
    }
    function scrapEl(i, text) {
      var li = doc.createElement('li'), b = doc.createElement('button');
      b.className = 'scrap'; b.type = 'button';
      b.setAttribute('data-scrap-fact', String(i));
      b.setAttribute('aria-label', 'Smooth out: ' + text);
      b.innerHTML = '<svg viewBox="-55 -55 110 110" aria-hidden="true" focusable="false">' + ballMarkup(seed += 7919) + '</svg>';
      li.appendChild(b);
      return li;
    }
    // the fact that just left the slip: a ghost of the old slip scrunches toward the scraps and becomes a button
    function scrunch(i, text, h) {
      var li = scrapEl(i, text), btn = li.firstChild, dx = 0, dy = 0, measured = false, r1, r2, ix;
      var old = scrapOf(i);
      if (old) drop(old);                             // one scrap per fact
      box.hidden = false;
      Ori.sound.play('scrunch');
      Ori.play(6, function (k, n) {
        var u, c;
        if (k < 4) {
          if (!measured) {                            // one read for the whole gesture, before the first frame
            measured = true;
            r1 = slip.getBoundingClientRect(); r2 = list.getBoundingClientRect();
            ix = Math.min(list.children.length, 2);
            dx = r2.left + ix * 76 + 32 - (r1.left + r1.width / 2); dy = r2.top + 32 - (r1.top + r1.height / 2);
          }
          if (!ghost) {
            ghost = doc.createElement('div');
            ghost.className = 'fact-ghost'; ghost.setAttribute('aria-hidden', 'true');
            ghost.innerHTML = '<div class="fact-ghost__in"><span class="fact-slip__n"></span><p class="fact-slip__t"><span class="kidline"></span></p></div>' +
              '<svg class="fact-ghost__f" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"></svg>';
            ghost.querySelector('.fact-slip__n').textContent = (slip.querySelector('.fact-slip__n') || {}).textContent || '';
            ghost.querySelector('.kidline').textContent = text;
            if (h > 0) ghost.style.height = h + 'px';
            slip.parentNode.appendChild(ghost);
          }
          c = (k + 1) / 4; u = [0.02, 0.14, 0.42, 0.78][k];
          ghost.style.clipPath = Ori.crumpleClip(c);
          ghost.style.translate = Math.round(dx * u) + 'px ' + Math.round(dy * u) + 'px';
          ghost.style.scale = [0.94, 0.7, 0.44, 0.24][k] + ' ' + [0.9, 0.74, 0.56, 0.42][k];
          ghost.style.rotate = n1(1.2 + Ori.boil(2 + k * 3)) + 'deg';
          if (k > 0) ghost.classList.add('is-blank');
          ghost.querySelector('.fact-ghost__f').innerHTML = crushMarkup(5 + k * 6);
          return;
        }
        endGhost();
        if (!li.parentNode) list.appendChild(li);
        if (k < n - 1) { btn.classList.add('is-landing'); return; }
        btn.classList.remove('is-landing');           // the last frame is the whole end state: Rule S needs no more
        trim();
      }, { key: 'slip', done: function (completed) { if (!completed) { endGhost(); if (!li.parentNode) list.appendChild(li); btn.classList.remove('is-landing'); } } });
    }
    function changed() {
      var now = index(), was = last, wasLine = lastLine, h = lastH, mine;
      last = now; lastLine = line();
      lastH = slip.offsetHeight;
      if (smoothing) slip.classList.add('is-smoothed'); else slip.classList.remove('is-smoothed');
      smoothing = false;
      mine = scrapOf(now);
      if (mine) drop(mine);                           // the fact on the slip is not also a scrap
      if (was < 0 || was === now) { if (!list.children.length) box.hidden = true; return; }   // the resting line never becomes a scrap
      scrunch(was, wasLine, h);
    }

    last = index(); lastLine = line();
    new win.MutationObserver(function () {
      try { changed(); } catch (e) { Ori.report('slip', e); }
    }).observe(txt, { childList: true });

    Ori.on(list, 'click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button.scrap') : null, i, go;
      if (!b) return;
      i = parseInt(b.getAttribute('data-scrap-fact'), 10);
      smoothing = true;
      drop(b);
      Ori.sound.play('smooth');
      api.show(i);                                    // the slip takes the fact back; the one it held becomes a scrap in turn
      go = doc.querySelector('.mat[data-mat="teller"] .mat__stage[role="button"]');
      if (go) go.focus();
    });

    return { reset: function () {
      endGhost();
      list.innerHTML = '';
      box.hidden = true;
      slip.classList.remove('is-smoothed');
      smoothing = false;
      last = index(); lastLine = line();
    } };
  });
})();
