/* ---- kids/match.js ---- */
/* Glo Pop Kids · Pop match. A seven by seven tray of paper pieces (a pop, a crane, a boat, a frog, a butterfly, a
   lotus). Swap two neighbors to line up three or more of a kind, across or down; matched pieces fold away, the rest
   fall, new ones drop in from the top, and a fall that lines up more clears again. Every pop you match drops into the
   bag beside the tray: ten pops fill it, and that's the game. There is no losing, no clock and no score to chase.

   The rules are the arcade's (redesign/08-pop-arcade, "Glow Grid"), restyled for the garden:
     · a swap that makes no line swaps back, the two cards shake, and it doesn't count as a move;
     · the board never starts with a line, and always has a move; with no move left, a fresh board drops in;
     · new pieces lean a little toward pops while the bag isn't full;
     · Hint (or nine seconds without a move) makes two cards lean toward each other.
   Mouse: click two neighbors. Touch: tap two, or swipe one toward the other. Keyboard: the arrow keys walk the tray,
   Enter or Space picks a piece up, an arrow key swaps it, Escape puts it down. Pause motion and reduced motion keep
   every rule and drop the movement (html.ori-live, kids/core.js). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  var box = doc.querySelector('[data-match]');
  if (!box || !win.Promise) return;
  var q = function (s) { return box.querySelector(s); };
  var board = q('[data-m-board]'), cover = q('[data-m-cover]'), coverH = q('[data-m-cover-h]'), coverT = q('[data-m-cover-t]');
  var startBtn = q('[data-m-start]'), startLabel = q('[data-m-start-label]'), hintBtn = q('[data-m-hint]'), resetBtn = q('[data-m-reset]');
  var countEl = q('[data-m-count]'), movesEl = q('[data-m-moves]'), cap = q('[data-m-cap]'), live = q('[data-m-live]');
  var slots = Array.prototype.slice.call(box.querySelectorAll('.mb-slot')), bagSvg = q('[data-m-bag]');
  var dots = Array.prototype.slice.call(box.querySelectorAll('[data-m-dots] i')), how = q('[data-m-how]'), told = false;

  var N = 7, GOAL = 10, POP = 0, LEAN = 0.1, IDLE = 9000;
  var KINDS = [
    { name: 'Pop', sym: 'mt-pop' }, { name: 'Crane', sym: 'mt-crane' }, { name: 'Boat', sym: 'mt-boat' },
    { name: 'Frog', sym: 'mt-frog' }, { name: 'Butterfly', sym: 'mt-butterfly' }, { name: 'Lotus', sym: 'mt-lotus' }
  ];
  var K = KINDS.length;
  var grid = [], sel = null, cur = { r: 3, c: 3 }, busy = false, playing = false, moves = 0, bag = 0, idleT = 0, inView = false;
  var touchy = false;
  try { touchy = win.matchMedia('(pointer: coarse)').matches; } catch (e) { /* a mouse, then */ }

  var still = function () { return !root.classList.contains('ori-live'); };
  var wait = function (ms) { return new Promise(function (res) { win.setTimeout(res, still() ? Math.min(ms, 60) : ms); }); };
  var rnd = function (n) { return Math.floor(Math.random() * n); };
  var at = function (r, c) { return r >= 0 && r < N && c >= 0 && c < N ? grid[r][c] : null; };
  var kindAt = function (r, c) { var t = at(r, c); return t ? t.k : -1; };
  var say = function (text, alsoCap) { if (live) { live.textContent = ''; win.setTimeout(function () { live.textContent = text; }, 30); } if (alsoCap && cap) cap.textContent = text; };
  var spawnKind = function () { return bag < GOAL && Math.random() < LEAN ? POP : rnd(K); };

  /* ---------- lines ---------- */
  // every cell in a straight run of three or more of one kind, across or down, given a kind lookup
  function runs(get) {
    var hit = {}, list = [], r, c, e, k;
    var add = function (rr, cc) { var key = rr * N + cc; if (!hit[key]) { hit[key] = 1; list.push([rr, cc]); } };
    for (r = 0; r < N; r++) for (c = 0; c < N; c = e) {
      k = get(r, c); for (e = c + 1; e < N && get(r, e) === k; e++) { /* run on */ }
      if (k >= 0 && e - c >= 3) for (var x = c; x < e; x++) add(r, x);
    }
    for (c = 0; c < N; c++) for (r = 0; r < N; r = e) {
      k = get(r, c); for (e = r + 1; e < N && get(e, c) === k; e++) { /* run on */ }
      if (k >= 0 && e - r >= 3) for (var y = r; y < e; y++) add(y, c);
    }
    return list;
  }
  // a swap that would make a line, on a plain grid of kinds (or null)
  // wantPop: rather a swap that lines up pops (that's what fills the bag), else any swap that makes a row
  function findMove(g, wantPop) {
    var get = function (r, c) { return g[r][c]; }, order = [], i, j, any = null;
    for (i = 0; i < N * N; i++) order.push(i);
    for (i = order.length - 1; i > 0; i--) { j = rnd(i + 1); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    for (i = 0; i < order.length; i++) {
      var r = Math.floor(order[i] / N), c = order[i] % N, dirs = [[0, 1], [1, 0]];
      for (j = 0; j < 2; j++) {
        var r2 = r + dirs[j][0], c2 = c + dirs[j][1];
        if (r2 >= N || c2 >= N) continue;
        var a = g[r][c]; g[r][c] = g[r2][c2]; g[r2][c2] = a;
        var hit = runs(get), pops = wantPop && hit.some(function (p) { return g[p[0]][p[1]] === POP; });
        a = g[r][c]; g[r][c] = g[r2][c2]; g[r2][c2] = a;
        if (hit.length && (!wantPop || pops)) return [[r, c], [r2, c2]];
        if (hit.length && !any) any = [[r, c], [r2, c2]];
      }
    }
    return any;
  }
  var kinds = function () { return grid.map(function (row) { return row.map(function (t) { return t ? t.k : -1; }); }); };
  // a starting board: no line already made, and at least one move
  function freshKinds() {
    var g;
    for (var tries = 0; tries < 60; tries++) {
      g = [];
      for (var r = 0; r < N; r++) {
        g.push([]);
        for (var c = 0; c < N; c++) {
          var k, guard = 0;
          do { k = spawnKind(); guard++; }
          while (guard < 30 && ((c >= 2 && g[r][c - 1] === k && g[r][c - 2] === k) || (r >= 2 && g[r - 1][c] === k && g[r - 2][c] === k)));
          g[r].push(k);
        }
      }
      if (findMove(g)) return g;
    }
    return g;
  }

  /* ---------- pieces ---------- */
  function place(t, r, c) { t.r = r; t.c = c; t.el.style.setProperty('--r', r); t.el.style.setProperty('--c', c); }
  function label(t) { t.el.setAttribute('aria-label', KINDS[t.k].name + ', row ' + (t.r + 1) + ', column ' + (t.c + 1)); }
  function makeTile(k, r, c) {
    var b = doc.createElement('button');
    b.type = 'button'; b.className = 'mt'; b.tabIndex = -1; b.setAttribute('data-k', k);
    b.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#' + KINDS[k].sym + '"/></svg>';
    var t = { k: k, el: b, r: r, c: c };
    b._mt = t;
    place(t, r, c);
    board.appendChild(b);
    return t;
  }
  // drop a new set of pieces in from above the tray
  function newBoard() {
    var g = freshKinds(), focusWas = board.contains(doc.activeElement);
    Array.prototype.slice.call(board.querySelectorAll('.mt')).forEach(function (el) { el.remove(); });
    grid = [];
    for (var r = 0; r < N; r++) {
      grid.push([]);
      for (var c = 0; c < N; c++) {
        var t = makeTile(g[r][c], r - N - 1, c);
        t.el.style.setProperty('--mt-d', '0ms');
        grid[r].push(t);
      }
    }
    void board.offsetWidth;
    var longest = 0;
    grid.forEach(function (row, r) {
      row.forEach(function (t, c) {
        var d = 420 + (N - 1 - r) * 45 + c * 25; longest = Math.max(longest, d);
        t.el.style.setProperty('--mt-d', d + 'ms'); t.el.style.setProperty('--mt-e', 'cubic-bezier(.45,.05,.55,1.12)');
        place(t, r, c); label(t);
      });
    });
    roving(focusWas);
    return wait(longest + 40);
  }
  function roving(refocus) {
    grid.forEach(function (row) { row.forEach(function (t) { if (t) t.el.tabIndex = -1; }); });
    var t = at(cur.r, cur.c);
    if (t) { t.el.tabIndex = 0; if (refocus) t.el.focus({ preventScroll: true }); }
  }
  function select(t) {
    if (sel) { sel.el.classList.remove('is-sel'); sel.el.removeAttribute('aria-pressed'); }
    sel = t || null;
    grid.forEach(function (row) { row.forEach(function (x) { if (x) x.el.setAttribute('aria-pressed', x === sel ? 'true' : 'false'); }); });
    if (sel) sel.el.classList.add('is-sel');
  }
  function swapCells(a, b) {
    var ar = a.r, ac = a.c;
    grid[b.r][b.c] = a; grid[ar][ac] = b;
    a.el.style.setProperty('--mt-d', '190ms'); b.el.style.setProperty('--mt-d', '190ms');
    a.el.style.removeProperty('--mt-e'); b.el.style.removeProperty('--mt-e');
    place(a, b.r, b.c); place(b, ar, ac);
  }
  var adjacent = function (a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; };

  /* ---------- a move ---------- */
  function trySwap(a, b) {
    if (busy || !playing || !a || !b || !adjacent(a, b)) return Promise.resolve();
    busy = true; clearHint(); select(null); stopIdle();
    var hadFocus = board.contains(doc.activeElement);
    swapCells(a, b);
    return wait(200).then(function () {
      if (!runs(kindAt).length) {
        swapCells(a, b);
        return wait(200).then(function () {
          [a, b].forEach(function (t) { t.el.classList.remove('is-no'); void t.el.offsetWidth; t.el.classList.add('is-no'); });
          say('No match there.', true);
        });
      }
      moves++; if (movesEl) movesEl.textContent = moves;
      cur = { r: b.r, c: b.c };
      return resolve();
    }).then(function () {
      grid.forEach(function (row) { row.forEach(label); });
      roving(hadFocus);
      busy = false;
      if (playing) armIdle();
    });
  }

  // clear the lines, let the rest fall, drop new pieces in, and go again while falls keep making lines
  function resolve(chain) {
    chain = chain || 0;
    var hit = runs(kindAt);
    if (!hit.length) return finishTurn(chain);
    chain++;
    var pops = [], cleared = hit.map(function (p) { return grid[p[0]][p[1]]; });
    cleared.forEach(function (t) {
      if (t.k === POP) pops.push(t.el.getBoundingClientRect());
      t.el.classList.add('is-pop');
      grid[t.r][t.c] = null;
    });
    var take = Math.min(pops.length, GOAL - bag);
    for (var i = 0; i < take; i++) fly(pops[i], bag + i);
    bag += take;
    if (countEl) countEl.textContent = bag;
    dots.forEach(function (d, k) { d.classList.toggle('is-in', k < bag); });
    sparkle(cleared);
    var left = GOAL - bag;
    if (take) say((take === 1 ? 'A pop in the bag!' : take + ' pops in the bag!') + (left === 1 ? ' One more to go.' : left > 1 ? ' ' + left + ' more to go.' : ''), true);
    else if (!told) { told = true; say('Nice row! But only pops go in the bag, so look for the pink cards.', true); }
    else if (chain > 1) say('Chain of ' + chain + '! Keep hunting for pops.', true);
    return wait(260).then(function () {
      cleared.forEach(function (t) { t.el.remove(); });
      var longest = 0;
      for (var c = 0; c < N; c++) {
        var write = N - 1;
        for (var r = N - 1; r >= 0; r--) {
          var t = grid[r][c];
          if (!t) continue;
          if (r !== write) {
            grid[write][c] = t; grid[r][c] = null;
            var d = 140 + 60 * (write - r); longest = Math.max(longest, d);
            t.el.style.setProperty('--mt-d', d + 'ms'); t.el.style.setProperty('--mt-e', 'cubic-bezier(.45,.05,.55,1.12)');
            place(t, write, c);
          }
          write--;
        }
        var gap = write + 1;
        for (var n = 0; n < gap; n++) {
          var row = write - n, nt = makeTile(spawnKind(), row - gap, c);
          nt.el.style.setProperty('--mt-d', '0ms');
          grid[row][c] = nt;
        }
      }
      void board.offsetWidth;
      grid.forEach(function (rowT, r) {
        rowT.forEach(function (t, c) {
          if (t.r < 0) {
            var d = 140 + 60 * (r - t.r); longest = Math.max(longest, d);
            t.el.style.setProperty('--mt-d', d + 'ms'); t.el.style.setProperty('--mt-e', 'cubic-bezier(.45,.05,.55,1.12)');
            place(t, r, c);
          }
        });
      });
      return wait(longest + 60);
    }).then(function () { return resolve(chain); });
  }
  function finishTurn(chain) {
    if (bag >= GOAL) return win1();
    if (!findMove(kinds())) {
      say('No moves left, so here’s a fresh board.', true);
      return wait(700).then(newBoard);
    }
    return Promise.resolve();
  }

  /* ---------- the bag ---------- */
  function fillSlot(i) { if (slots[i]) slots[i].classList.add('is-in'); }
  // a matched pop flies from its card into the bag, and stands up in its slot there
  function fly(rect, i) {
    var G = win.GloGarden;
    if (still() || !G || !bagSvg || !rect.width) { fillSlot(i); return; }
    var b = bagSvg.getBoundingClientRect(), x0 = rect.left + rect.width / 2, y0 = rect.top + rect.height / 2;
    var x1 = b.left + b.width * (0.2 + 0.6 * ((i % 5) / 4)), y1 = b.top + b.height * 0.25;
    var ns = 'http://www.w3.org/2000/svg', s = doc.createElementNS(ns, 'svg'), u = doc.createElementNS(ns, 'use');
    s.setAttribute('class', 'gd-fx__pop'); s.setAttribute('viewBox', '0 0 60 140');
    u.setAttribute('href', '#gp-mini' + (i % 4 ? '-' + (i % 4) : '')); u.setAttribute('width', '60'); u.setAttribute('height', '140');
    s.appendChild(u); G.layer().appendChild(s);
    var lift = Math.min(120, Math.abs(x1 - x0) * 0.25 + 60);
    var T = function (x, y, rot, sc) { return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + rot + 'deg) scale(' + sc + ')'; };
    var a = s.animate([
      { transform: T(x0, y0, 0, 0.6), opacity: 1 },
      { transform: T((x0 + x1) / 2, Math.min(y0, y1) - lift, 200, 1.05), opacity: 1, offset: 0.5 },
      { transform: T(x1, y1, 360, 0.8), opacity: 1, offset: 0.9 },
      { transform: T(x1, y1 + 20, 360, 0.7), opacity: 0 }
    ], { duration: 720 + i % 3 * 60, easing: 'ease-in-out' });
    a.onfinish = a.oncancel = function () { s.remove(); fillSlot(i); };
  }
  function sparkle(list) {
    var G = win.GloGarden;
    if (still() || !G) return;
    list.slice(0, 6).forEach(function (t) { var r = t.el.getBoundingClientRect(); G.confetti(r.left + r.width / 2, r.top + r.height / 2, 4, r.width * 0.7); });
  }

  /* ---------- hints and the idle nudge ---------- */
  var hinted = [];
  function clearHint() { hinted.forEach(function (t) { t.el.classList.remove('is-hint'); }); hinted = []; }
  function hint(spoken) {
    if (!playing || busy) return;
    var m = findMove(kinds(), true);
    if (!m) return;
    clearHint();
    var a = at(m[0][0], m[0][1]), b = at(m[1][0], m[1][1]);
    a.el.style.setProperty('--hx', b.c - a.c); a.el.style.setProperty('--hy', b.r - a.r);
    b.el.style.setProperty('--hx', a.c - b.c); b.el.style.setProperty('--hy', a.r - b.r);
    hinted = [a, b];
    [a, b].forEach(function (t) { t.el.classList.remove('is-hint'); void t.el.offsetWidth; t.el.classList.add('is-hint'); });
    win.setTimeout(clearHint, 2400);
    if (spoken) say('Swap the two glowing pieces: the ' + KINDS[a.k].name.toLowerCase() + ' at row ' + (a.r + 1) + ', column ' + (a.c + 1) + ' and the ' + KINDS[b.k].name.toLowerCase() + ' next to it.', true);
  }
  function stopIdle() { win.clearTimeout(idleT); }
  function armIdle() { stopIdle(); idleT = win.setTimeout(function () { if (inView && !busy && playing && !sel) hint(false); armIdle(); }, IDLE); }

  /* ---------- start, win, start over ---------- */
  function setStill() { board.classList.toggle('is-still', still()); }
  function start() {
    playing = true; busy = true; moves = 0; bag = 0; sel = null; cur = { r: 3, c: 3 };
    if (movesEl) movesEl.textContent = '0'; if (countEl) countEl.textContent = '0';
    slots.forEach(function (s) { s.classList.remove('is-in'); }); dots.forEach(function (d) { d.classList.remove('is-in'); }); told = false;
    setStill();
    cover.hidden = true; board.inert = false; board.classList.add('is-on');
    hintBtn.disabled = false; resetBtn.disabled = false;
    say('New board. Swap two pieces that touch to line up three pops. ' + GOAL + ' pops fill the bag.', false);
    return newBoard().then(function () {
      busy = false; roving(true); armIdle();
      hint(false);
      if (cap) cap.textContent = touchy ? 'Try it: tap the two glowing pieces, or swipe one onto the other.' : 'Try it: click the two glowing pieces, or use the arrow keys and Enter.';
    });
  }
  function win1() {
    playing = false; stopIdle(); select(null); clearHint();
    board.inert = true; board.classList.remove('is-on');
    hintBtn.disabled = true;
    var msg = 'The bag is full! Ten pops in ' + moves + (moves === 1 ? ' move.' : ' moves.');
    say(msg, true);
    coverH.textContent = 'The bag is full!';
    coverT.textContent = 'Ten pops in ' + moves + (moves === 1 ? ' move.' : ' moves.'); coverT.hidden = false; if (how) how.hidden = true;
    startLabel.textContent = 'Play again';
    return wait(500).then(function () {
      cover.hidden = false;
      var G = win.GloGarden;
      if (!still() && G && bagSvg) { var b = bagSvg.getBoundingClientRect(); G.confetti(b.left + b.width / 2, b.top + b.height * 0.3, 36, 200); }
      startBtn.focus({ preventScroll: true });
    });
  }

  /* ---------- input ---------- */
  function tap(t) {
    if (busy || !playing || !t) return;
    cur = { r: t.r, c: t.c }; roving(false);
    if (!sel) { select(t); say(KINDS[t.k].name + ' picked up.', false); return; }
    if (sel === t) { select(null); return; }
    if (adjacent(sel, t)) { trySwap(sel, t); return; }
    select(t); say(KINDS[t.k].name + ' picked up.', false);
  }
  var swiped = 0, down = null;
  board.addEventListener('click', function (e) {
    var el = e.target.closest('.mt');
    if (!el || Date.now() - swiped < 400) return;
    tap(el._mt);
  });
  board.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.mt');
    if (!el || !playing || busy || e.button) return;
    down = { t: el._mt, x: e.clientX, y: e.clientY, id: e.pointerId, size: el.getBoundingClientRect().width };
  });
  board.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < down.size * 0.32) return;
    var t = down.t, n = Math.abs(dx) > Math.abs(dy) ? at(t.r, t.c + (dx > 0 ? 1 : -1)) : at(t.r + (dy > 0 ? 1 : -1), t.c);
    down = null; swiped = Date.now();
    if (n) { cur = { r: t.r, c: t.c }; trySwap(t, n); }
  });
  var lift = function () { down = null; };
  board.addEventListener('pointerup', lift); board.addEventListener('pointercancel', lift);
  board.addEventListener('focusin', function (e) { var el = e.target.closest('.mt'); if (el && el._mt) { cur = { r: el._mt.r, c: el._mt.c }; roving(false); } });
  board.addEventListener('keydown', function (e) {
    var el = e.target.closest('.mt'), t = el && el._mt;
    if (!t) return;
    var D = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (D) {
      e.preventDefault();
      if (busy) return;
      var n = at(t.r + D[0], t.c + D[1]);
      if (!n) return;
      if (sel === t) { trySwap(t, n); return; }
      cur = { r: n.r, c: n.c }; roving(true);
    } else if (e.key === 'Escape' && sel) {
      e.preventDefault(); select(null); say('Put down.', false);
    }
  });

  // before the first game a board already lies under the cover, so the tray looks like a game at first sight
  (function preview() {
    var g = freshKinds();
    grid = g.map(function (row, r) { return row.map(function (k, c) { var t = makeTile(k, r, c); label(t); return t; }); });
  })();

  startBtn.addEventListener('click', function () { start(); });
  hintBtn.addEventListener('click', function () { hint(true); armIdle(); });
  resetBtn.addEventListener('click', function () { if (!busy) start(); });
  doc.addEventListener('papersun:motion', setStill);
  if ('IntersectionObserver' in win) new win.IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.4 }).observe(board);
  else inView = true;
})();
