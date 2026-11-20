/* ---- kids/garden.js ---- */
/* Glo Pop Kids · the pop garden comes alive. The steady movement is CSS (kids/garden.css, section 5); this file is
   the part that answers the visitor:
     · a tap plays with what it lands on: a pop boings, the big pop twirls and throws confetti, the frog hops, a boat
       rocks, a crane swoops, a cloud puffs, the bag of ten jumps and two pops jump out of it;
     · in the hero, the pops lean toward the pointer, like flowers toward the sun;
     · pointing at "Meet the pop" makes the pop hop, pointing at "Shop" makes the bag jump (keyboard focus too);
     · further down, each corner of the garden grows in when it comes on screen.
   The garden sits behind the words (z-index -1), so a tap is checked against what is visibly there: a toy plays
   only when nothing that paints (text, a card, an image, a button) covers the spot. Nothing here runs while motion
   is paused or reduced (html.ori-live is kids/core.js's single answer to that). */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, win = window;
  if (!doc.querySelector || !('animate' in doc.documentElement)) return;   // no Web Animations: the CSS motion alone

  var live = function () { return root.classList.contains('ori-live'); };
  var mq = function (q) { try { return win.matchMedia(q); } catch (e) { return { matches: false }; } };
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var slice = function (l) { return Array.prototype.slice.call(l); };
  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var PAPER = ['#FF1493', '#FF5CAF', '#FFC83D', '#41BCC8', '#57C880', '#C4046D', '#FFDD78'];

  /* ---------- the effects layer: confetti and friends, compositor-only, gone when they land ---------- */
  var fx = null;
  function layer() {
    if (!fx) { fx = doc.createElement('div'); fx.className = 'gd-fx'; fx.setAttribute('aria-hidden', 'true'); doc.body.appendChild(fx); }
    return fx;
  }
  // out fast and slowing (up to the top of its arc), then falling under gravity, then a quick fade where it lands
  function fling(el, x, y, dx, dy, fall, spin, ms, s0) {
    layer().appendChild(el);
    var T = function (px, py, r, s) { return 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + r.toFixed(0) + 'deg) scale(' + s + ')'; };
    var a = el.animate([
      { transform: T(x, y, 0, s0), opacity: 1, easing: 'cubic-bezier(.12,.7,.35,1)' },
      { transform: T(x + dx, y + dy, spin * 0.45, 1), opacity: 1, offset: 0.36, easing: 'cubic-bezier(.5,0,.9,.55)' },
      { transform: T(x + dx * 1.25, y + dy + fall, spin * 0.9, 0.95), opacity: 1, offset: 0.84 },
      { transform: T(x + dx * 1.3, y + dy + fall * 1.12, spin, 0.85), opacity: 0 }
    ], { duration: ms, easing: 'linear' });
    a.onfinish = a.oncancel = function () { if (el.parentNode) el.parentNode.removeChild(el); };
  }
  // n pieces of paper confetti and sparkles thrown out from (x, y), reach px out
  function confetti(x, y, n, reach) {
    for (var i = 0; i < n; i++) {
      var el = doc.createElement('i'), ang = (i / n) * Math.PI * 2 + rand(-0.3, 0.3), d = reach * rand(0.5, 1.1);
      el.className = i % 5 === 0 ? 'gd-fx__spark' : 'gd-fx__bit';
      el.style.background = PAPER[i % PAPER.length];
      fling(el, x, y, Math.cos(ang) * d, Math.sin(ang) * d * 0.85 - reach * 0.35, reach * 0.9, rand(-560, 560), rand(950, 1350), 0.4);
    }
  }
  // little pops that jump out of the bag and fall back in
  function popsOut(x, y, n) {
    for (var i = 0; i < n; i++) {
      var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = doc.createElementNS('http://www.w3.org/2000/svg', 'use');
      s.setAttribute('class', 'gd-fx__pop'); s.setAttribute('viewBox', '0 0 60 140');
      u.setAttribute('href', '#gp-mini' + (i % 4 ? '-' + (i % 4) : '')); u.setAttribute('width', '60'); u.setAttribute('height', '140');
      s.appendChild(u);
      var side = i % 2 ? 1 : -1, up = rand(90, 140);
      fling(s, x, y, side * rand(20, 56), -up, up * 0.9, side * rand(160, 300), rand(1150, 1400), 0.5);
    }
  }
  var at = function (el, fx0, fy0) { var r = el.getBoundingClientRect(); return [r.left + r.width * fx0, r.top + r.height * fy0]; };

  /* ---------- toys ---------- */
  var playing = typeof WeakMap === 'function' ? new WeakMap() : null;
  function anim(el, kf, o) { try { return el.animate(kf, o); } catch (e) { return null; } }
  function play(toy, gentle) {
    if (!live()) return;
    var kind = toy.getAttribute('data-toy'), list = [], p;
    if (playing && playing.get(toy)) playing.get(toy).forEach(function (a) { if (a) a.cancel(); });
    var A = function (kf, ms, ease, delay) { list.push(anim(toy, kf, { duration: ms, easing: ease || 'ease-out', delay: delay || 0 })); };
    if (kind === 'pop') {
      if (gentle) A({ translate: ['0 0', '0 -5%', '0 0', '0 -1.5%', '0 0'], scale: ['1 1', '.98 1.03', '1.03 .97', '1 1', '1 1'] }, 760, 'ease-in-out');
      else {
        A({ scale: ['1 1', '-1 1', '1 1'], translate: ['0 0', '0 -4%', '0 0'] }, 900, 'cubic-bezier(.45,0,.25,1)');
        p = at(toy, 0.5, 0.24); confetti(p[0], p[1], 30, Math.min(260, win.innerWidth * 0.32));
      }
    } else if (kind === 'bloom') {
      A({ scale: ['1 1', '1.18 .8', '.9 1.14', '1.05 .96', '1 1'] }, 640);
      if (!gentle) { p = at(toy, 0.5, 0.15); confetti(p[0], p[1], 6, 46); }
    } else if (kind === 'frog') {
      A({ translate: ['0 0', '0 -70%', '0 0', '0 0'], scale: ['1 1', '.9 1.14', '1 1', '1.14 .86', '1 1'] }, 720, 'ease-in-out');
    } else if (kind === 'boat') {
      A({ rotate: ['0deg', '-11deg', '8deg', '-4deg', '0deg'], translate: ['0 0', '0 -8%', '0 0'] }, 1200);
    } else if (kind === 'crane') {
      A({ translate: ['0 0', '18% -34%', '0 0'], rotate: ['0deg', '-12deg', '0deg'] }, 1000, 'ease-in-out');
    } else if (kind === 'cloud') {
      A({ scale: ['1', '1.12', '.97', '1'] }, 640);
    } else if (kind === 'bag') {
      A({ translate: ['0 0', '0 -12%', '0 0'], scale: ['1 1', '.94 1.08', '1.08 .92', '1 1'] }, 640, 'ease-in-out');
      p = at(toy, 0.5, 0.2); popsOut(p[0], p[1], gentle ? 1 : 3);
    }
    if (playing) playing.set(toy, list);
  }

  // what a tap lands on. The garden is under the words, so look down through the stack at that point: the first
  // toy wins, unless something that paints covers it first.
  var CONTROL = 'a,button,input,select,textarea,label,summary,[role="button"],[role="tab"],[tabindex]:not([tabindex="-1"]),[contenteditable]';
  function paints(el) {
    if (el === root || el === doc.body) return false;
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') return true;   // an icon or a drawing (the garden itself never hits)
    if (/^(IMG|VIDEO|CANVAS|IFRAME|PICTURE|INPUT|TEXTAREA|SELECT|BUTTON|HR)$/.test(el.tagName)) return true;
    var cs = win.getComputedStyle(el);
    if (cs.backgroundImage !== 'none') return true;
    var bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return true;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    return false;
  }
  function toyAt(x, y) {
    if (!doc.elementsFromPoint) return null;
    var stack = doc.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var t = stack[i].closest ? stack[i].closest('[data-toy]') : null;
      if (t) return t;
      if (stack[i].closest && stack[i].closest(CONTROL)) return null;
      if (paints(stack[i])) return null;
    }
    return null;
  }
  doc.addEventListener('click', function (e) {
    if (!live() || e.defaultPrevented || e.button) return;
    if (e.target.closest && e.target.closest(CONTROL)) return;
    var sel = win.getSelection && win.getSelection();
    if (sel && !sel.isCollapsed) return;                               // the visitor was selecting text
    var toy = toyAt(e.clientX, e.clientY);
    if (toy) play(toy, false);
  });

  // a pointing hand over a toy, even one under the words (mouse only, once a frame)
  if (finePointer.matches) {
    var hx = 0, hy = 0, hraf = 0, over = false;
    doc.addEventListener('pointermove', function (e) {
      hx = e.clientX; hy = e.clientY;
      if (hraf) return;
      hraf = win.requestAnimationFrame(function () {
        hraf = 0;
        var t = live() ? toyAt(hx, hy) : null;
        if (!!t !== over) { over = !!t; doc.body.style.cursor = over ? 'pointer' : ''; }
      });
    }, { passive: true });
  }

  /* ---------- the hero: pops lean toward the pointer; the two buttons wake the pop and the bag ---------- */
  var hero = doc.querySelector('.gd-hero'), heroArt = doc.querySelector('.gd--hero');
  if (hero && heroArt) {
    var leaners = slice(heroArt.querySelectorAll('.mv-sway, .mv-pop')), spots = null, lx = 0, ly = 0, lraf = 0;
    var measure = function () {
      var sy = win.scrollY || win.pageYOffset || 0;
      spots = leaners.map(function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, x: r.left + r.width / 2, y: r.top + sy + r.height * 0.3, max: el.classList.contains('mv-pop') ? 2.2 : 7 };
      });
    };
    var lean = function () {
      lraf = 0;
      if (!spots) measure();
      var sy = win.scrollY || win.pageYOffset || 0, on = live();
      for (var i = 0; i < spots.length; i++) {
        var s = spots[i], dx = lx - s.x, dy = ly + sy - s.y, near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 640);
        var deg = on ? Math.max(-1, Math.min(1, dx / 220)) * s.max * near : 0;
        s.el.style.rotate = Math.abs(deg) < 0.05 ? '' : deg.toFixed(2) + 'deg';
      }
    };
    var rest = function () { spots && spots.forEach(function (s) { s.el.style.rotate = ''; }); };
    if (finePointer.matches) {
      hero.addEventListener('pointerenter', function () { spots = null; }, { passive: true });
      hero.addEventListener('pointermove', function (e) {
        lx = e.clientX; ly = e.clientY;
        if (!lraf && live()) lraf = win.requestAnimationFrame(lean);
      }, { passive: true });
      hero.addEventListener('pointerleave', rest, { passive: true });
      win.addEventListener('resize', function () { spots = null; }, { passive: true });
    }
    doc.addEventListener('papersun:motion', function () { if (!live()) rest(); });

    var bigPop = heroArt.querySelector('[data-toy="pop"]'), bag = heroArt.querySelector('[data-toy="bag"]'), last = 0;
    var wake = function (toy) {
      return function () { var now = Date.now(); if (!toy || now - last < 900) return; last = now; play(toy, true); };
    };
    var ctas = slice(hero.querySelectorAll('.hero__ctas a'));
    if (ctas[0]) { ctas[0].addEventListener('pointerenter', wake(bigPop)); ctas[0].addEventListener('focus', wake(bigPop)); }
    if (ctas[1]) { ctas[1].addEventListener('pointerenter', wake(bag)); ctas[1].addEventListener('focus', wake(bag)); }

    // hello: once the page is up, the pops on the hills nod in a wave from left to right
    var hello = function () {
      if (!live() || (win.scrollY || win.pageYOffset || 0) > 400) return;
      slice(heroArt.querySelectorAll('[data-toy="bloom"]'))
        .map(function (el) { return { el: el, x: el.getBoundingClientRect().left }; })
        .filter(function (b) { return b.x > -60 && b.x < win.innerWidth + 60; })
        .sort(function (a, b) { return a.x - b.x; })
        .forEach(function (b, i) { anim(b.el, { scale: ['1 1', '1.12 .86', '.94 1.08', '1 1'] }, { duration: 600, delay: 250 + i * 55, easing: 'ease-out' }); });
    };
    if (doc.readyState === 'complete') win.setTimeout(hello, 200); else win.addEventListener('load', function () { win.setTimeout(hello, 200); });
  }

  /* ---------- further down: each corner of the garden grows in when it comes on screen ---------- */
  if ('IntersectionObserver' in win && live()) {
    var io = new win.IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var items = slice(e.target.querySelectorAll('.mv-sway, .mv-bob, .mv-fly'));
        items.sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
        items.forEach(function (el, i) { el.style.setProperty('--gi', Math.min(i * 0.05, 0.9).toFixed(2) + 's'); });
        e.target.classList.remove('gd-wait');
        win.setTimeout(function () { items.forEach(function (el) { el.style.removeProperty('--gi'); }); }, 2200);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    // measured by its sheet, whose box is always laid out (content-visibility skips the insides of far sheets, and
    // measuring a piece in there would make the browser lay the whole sheet out at start-up)
    var vh = win.innerHeight || 800;
    slice(doc.querySelectorAll('.sheet:not(.hero)')).forEach(function (sheet) {
      var r = sheet.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) return;                         // already on screen (a reload mid-page): leave it be
      slice(sheet.querySelectorAll('.gd-v, .gd-pond')).forEach(function (piece) { piece.classList.add('gd-wait'); io.observe(piece); });
    });
  }
})();
