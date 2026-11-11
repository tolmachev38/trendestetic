/* Trend Esthetic — фоторедактор админки.
   TEPhoto.edit(src, opts)  → Promise<{ blob, width, height, replaceAll } | null>  — обрезка, поворот, фильтры, настройка, экспорт в WebP/JPEG
   TEPhoto.frame(src, value, opts) → Promise<{ fit, x, y, bg } | null | 'reset'> — как фото вписывается в рамки на сайте (файл не меняется) */
(() => {
'use strict';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); } kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c))); return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ===================== фильтры и настройки ===================== */
// параметры: b яркость, c контраст, s насыщенность, w тепло, t оттенок, h света, sh тени, f выцветание, v виньетка, g зерно, sharp резкость, sepia, tone [[тени RGB], [света RGB], сила]
const PRESETS = [
  ['Оригинал', {}],
  ['Студия', { c: .14, s: .1, h: -.12, sh: .16, w: .04, sharp: .3 }],
  ['Яркий', { c: .24, s: .34, b: .05 }],
  ['Ясный', { sh: .36, h: -.26, c: .1, sharp: .4 }],
  ['Тёплый', { w: .45, s: .1, f: .08 }],
  ['Холодный', { w: -.42, t: -.04, c: .1 }],
  ['Латунь', { w: .28, s: -.1, f: .12, tone: [[.16, .12, .07], [1, .86, .6], .28] }],
  ['Изумруд', { c: .12, s: -.05, tone: [[0, .24, .17], [.97, .95, .84], .3] }],
  ['Кино', { c: .2, s: -.1, tone: [[0, .2, .28], [1, .76, .48], .34] }],
  ['Мягкий', { c: -.15, f: .25, h: -.15, sh: .2, s: -.1 }],
  ['Пастель', { f: .34, s: -.2, b: .08, c: -.1, w: .1 }],
  ['Драма', { c: .45, s: -.2, h: -.3, sh: -.1, v: .45, sharp: .4 }],
  ['Винтаж', { f: .3, w: .24, s: -.25, v: .3, g: .25, tone: [[.2, .1, .15], [1, .9, .7], .3] }],
  ['Сепия', { sepia: .85, c: .05 }],
  ['Ч/Б', { s: -1, c: .15 }],
  ['Нуар', { s: -1, c: .5, v: .5, g: .2 }],
];
const ADJ = [['b', 'Яркость', -1, 1], ['c', 'Контраст', -1, 1], ['s', 'Насыщенность', -1, 1], ['w', 'Тепло', -1, 1], ['t', 'Оттенок', -1, 1], ['h', 'Света', -1, 1], ['sh', 'Тени', -1, 1], ['f', 'Выцветание', 0, 1], ['v', 'Виньетка', 0, 1], ['g', 'Зерно', 0, 1], ['sharp', 'Резкость', 0, 1]];

function mix(preset, amount, user) {
  const p = {}; for (const k in preset) if (k !== 'tone') p[k] = preset[k] * amount;
  if (preset.tone) p.tone = [preset.tone[0], preset.tone[1], preset.tone[2] * amount];
  for (const k in user) if (user[k]) p[k] = clamp((p[k] || 0) + user[k], k === 's' ? -1 : -1.5, 1.5);
  return p;
}
const isIdentity = p => !Object.keys(p).some(k => k === 'tone' ? p.tone[2] : p[k]);

function process(cv, P) {
  if (isIdentity(P)) return;
  const w = cv.width, h = cv.height, ctx = cv.getContext('2d', { willReadFrequently: true });
  const id = ctx.getImageData(0, 0, w, h), d = id.data;
  const b = (P.b || 0) * .28, c = 1 + (P.c || 0) * .85, s = 1 + (P.s || 0), wm = (P.w || 0) * .11, tn = (P.t || 0) * .09;
  const hi = (P.h || 0) * .32, sh = (P.sh || 0) * .32, fd = P.f || 0, vg = P.v || 0, gr = (P.g || 0) * .2, sp = P.sepia || 0;
  const tone = P.tone, ta = tone ? tone[2] : 0, cx = w / 2, cy = h / 2, rmax = Math.hypot(cx, cy);
  let seed = 1234567;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i] / 255, g = d[i + 1] / 255, bl = d[i + 2] / 255;
      if (b) { r += b; g += b; bl += b; }
      let L = .2126 * r + .7152 * g + .0722 * bl;
      if (hi || sh) { const k = hi * sstep(.45, 1, L) + sh * (1 - sstep(0, .55, L)); r += k; g += k; bl += k; }
      if (c !== 1) { r = (r - .5) * c + .5; g = (g - .5) * c + .5; bl = (bl - .5) * c + .5; }
      if (s !== 1) { L = .2126 * r + .7152 * g + .0722 * bl; r = L + (r - L) * s; g = L + (g - L) * s; bl = L + (bl - L) * s; }
      if (wm) { r += wm; bl -= wm; }
      if (tn) { g += tn; }
      if (sp) { const R = r * .393 + g * .769 + bl * .189, G = r * .349 + g * .686 + bl * .168, B = r * .272 + g * .534 + bl * .131; r += (R - r) * sp; g += (G - g) * sp; bl += (B - bl) * sp; }
      if (ta) { L = clamp(.2126 * r + .7152 * g + .0722 * bl, 0, 1); const k1 = (1 - L) * ta, k2 = L * ta; r += (tone[0][0] - .5) * k1 + (tone[1][0] - .5) * k2; g += (tone[0][1] - .5) * k1 + (tone[1][1] - .5) * k2; bl += (tone[0][2] - .5) * k1 + (tone[1][2] - .5) * k2; }
      if (fd) { r = .1 * fd + r * (1 - .22 * fd); g = .1 * fd + g * (1 - .22 * fd); bl = .1 * fd + bl * (1 - .22 * fd); }
      if (vg) { const k = 1 - vg * .75 * sstep(.38, 1, Math.hypot(x - cx, y - cy) / rmax); r *= k; g *= k; bl *= k; }
      if (gr) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const n = (seed / 0x7fffffff - .5) * gr; r += n; g += n; bl += n; }
      d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = bl * 255;
    }
  }
  if (P.sharp > 0) sharpen(d, w, h, P.sharp * 1.2);
  ctx.putImageData(id, 0, 0);
}
function sharpen(d, w, h, amt) {
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      const k = i + ch, blur = (src[k - 4] + src[k + 4] + src[k - w * 4] + src[k + w * 4] + src[k] * 4) / 8;
      d[k] = src[k] + (src[k] - blur) * amt;
    }
  }
}

/* ===================== геометрия ===================== */
// O — «ориентированное» изображение: повороты на 90°, отражения, наклон (с увеличением, чтобы не было пустых углов)
function oriented(bmp, g, scale) {
  const q = ((g.rq % 4) + 4) % 4, sw = bmp.width * scale, sh = bmp.height * scale;
  const W = Math.max(1, Math.round(q % 2 ? sh : sw)), H = Math.max(1, Math.round(q % 2 ? sw : sh));
  const cv = el('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const th = g.angle * Math.PI / 180, a = Math.abs(th), k = Math.max((W * Math.cos(a) + H * Math.sin(a)) / W, (W * Math.sin(a) + H * Math.cos(a)) / H);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(W / 2, H / 2); ctx.rotate(th); ctx.scale(k, k); ctx.rotate(q * Math.PI / 2); ctx.scale(g.fx ? -1 : 1, g.fy ? -1 : 1);
  ctx.drawImage(bmp, -sw / 2, -sh / 2, sw, sh);
  return cv;
}
const cropOf = (O, r) => { const x = Math.round(r.x * O.width), y = Math.round(r.y * O.height), w = Math.max(1, Math.round(r.w * O.width)), h = Math.max(1, Math.round(r.h * O.height)); const cv = el('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(O, x, y, w, h, 0, 0, w, h); return cv; };

async function loadBitmap(src) {
  if (src instanceof Blob) return createImageBitmap(src);
  const r = await fetch(src, { cache: 'no-store' }); if (!r.ok) throw new Error('не удалось загрузить фото (' + r.status + ')');
  return createImageBitmap(await r.blob());
}

/* ===================== редактор ===================== */
const ASPECTS = [['Свободно', 0], ['Исходное', -1], ['1:1', 1], ['4:5', 4 / 5], ['3:4', 3 / 4], ['2:3', 2 / 3], ['16:9', 16 / 9], ['3:2', 3 / 2], ['9:16', 9 / 16], ['Соцсети 1.91:1', 1.91]];
let dlg = null;

function edit(src, opts = {}) {
  return new Promise(async resolve => {
    let bmp;
    try { bmp = await loadBitmap(src); } catch (e) { alert('Редактор: ' + e.message); return resolve(null); }
    const g = { rq: 0, fx: false, fy: false, angle: 0 }; let crop = { x: 0, y: 0, w: 1, h: 1 }, aspect = 0, tab = 'crop';
    let preset = 0, amount = 1; const user = {}; ADJ.forEach(a => user[a[0]] = 0);
    const out = { max: opts.max || 1800, q: .86, fmt: 'webp' };
    const PV = Math.min(1, 1100 / Math.max(bmp.width, bmp.height));
    let O = null, holdOrig = false;

    if (dlg) dlg.remove();
    const canvas = el('canvas', { class: 'pe-cv' }), box = el('div', { class: 'pe-box' }, canvas), cropEl = el('div', { class: 'pe-crop' }, el('i', { class: 'g1' }), el('i', { class: 'g2' }), ...['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(hd => el('b', { 'data-h': hd })));
    box.append(cropEl);
    const stage = el('div', { class: 'pe-stage' }, box), info = el('div', { class: 'pe-info' });
    const panel = el('div', { class: 'pe-panel' });
    const tabs = el('div', { class: 'pe-tabs' }, ...[['crop', 'Кадр'], ['filters', 'Фильтры'], ['adjust', 'Настройка'], ['export', 'Сохранение']].map(([k, t]) => el('button', { type: 'button', 'data-t': k, class: k === tab ? 'on' : '', onclick: () => { tab = k; drawPanel(); draw(); } }, t)));
    const replaceAll = el('input', { type: 'checkbox' }); replaceAll.checked = !!opts.replaceAllDefault;
    const foot = el('div', { class: 'pe-foot' },
      opts.allowReplaceAll ? el('label', { class: 'chk' }, replaceAll, 'Заменить это фото везде на сайте') : el('span'),
      el('button', { class: 'b ghost', type: 'button', onpointerdown: () => { holdOrig = true; draw(); }, onpointerup: () => { holdOrig = false; draw(); }, onpointerleave: () => { if (holdOrig) { holdOrig = false; draw(); } }, title: 'Удерживайте, чтобы увидеть исходник' }, '◐ До / после'),
      el('button', { class: 'b ghost', type: 'button', onclick: () => { Object.keys(user).forEach(k => user[k] = 0); preset = 0; amount = 1; Object.assign(g, { rq: 0, fx: false, fy: false, angle: 0 }); aspect = 0; crop = { x: 0, y: 0, w: 1, h: 1 }; rebuild(); drawPanel(); } }, 'Сбросить всё'),
      el('button', { class: 'b ghost', type: 'button', onclick: () => close(null) }, 'Отмена'),
      el('button', { class: 'b gold', type: 'button', onclick: save }, opts.saveLabel || 'Сохранить как новое фото'));
    dlg = el('dialog', { class: 'dlg pe' }, el('div', { class: 'pe-in' }, el('div', { class: 'pe-head' }, el('h2', {}, opts.title || 'Редактор фото'), info), el('div', { class: 'pe-main' }, stage, el('div', { class: 'pe-side' }, tabs, panel)), foot));
    dlg.addEventListener('cancel', e => { e.preventDefault(); close(null); });
    document.body.append(dlg); dlg.showModal();

    function close(v) { removeEventListener('resize', draw); cancelAnimationFrame(raf); clearTimeout(drT); dlg.close(); dlg.remove(); dlg = null; bmp.close && bmp.close(); resolve(v); }
    function params() { return mix(PRESETS[preset][1], amount, user); }
    function rebuild() { O = oriented(bmp, g, PV); fitBox(); draw(); thumbsDirty = true; }
    function fitBox() {
      const W = stage.clientWidth - 24 || 700, H = stage.clientHeight - 24 || 500;
      const src = tab === 'crop' || holdOrig ? { w: O.width, h: O.height } : { w: O.width * crop.w, h: O.height * crop.h };
      const k = Math.min(W / src.w, H / src.h); canvas.style.width = Math.round(src.w * k) + 'px'; canvas.style.height = Math.round(src.h * k) + 'px';
    }
    // отрисовка в ближайшем кадре; таймер — на случай, если вкладка сейчас не перерисовывается
    let raf = 0, drT = 0;
    function draw() { cancelAnimationFrame(raf); clearTimeout(drT); raf = requestAnimationFrame(drawNow); drT = setTimeout(drawNow, 160); }
    function drawNow() {
      cancelAnimationFrame(raf); clearTimeout(drT);
      if (!O) return; fitBox();
      let cv;
      if (holdOrig) { cv = tab === 'crop' ? O : cropOf(O, crop); }
      else if (tab === 'crop') { cv = cropOf(O, { x: 0, y: 0, w: 1, h: 1 }); process(cv, params()); }
      else { cv = cropOf(O, crop); process(cv, params()); }
      canvas.width = cv.width; canvas.height = cv.height; canvas.getContext('2d').drawImage(cv, 0, 0);
      cropEl.hidden = tab !== 'crop' || holdOrig;
      Object.assign(cropEl.style, { left: crop.x * 100 + '%', top: crop.y * 100 + '%', width: crop.w * 100 + '%', height: crop.h * 100 + '%' });
      cropEl.classList.toggle('locked', !!aspect);
      const fw = Math.round(crop.w * O.width / PV), fh = Math.round(crop.h * O.height / PV), k = Math.min(1, out.max / Math.max(fw, fh));
      info.textContent = `Исходник ${bmp.width}×${bmp.height} → результат ${Math.round(fw * k)}×${Math.round(fh * k)} px`;
    }
    // соотношение сторон в нормированных координатах O
    const arN = () => { const a = aspect === -1 ? (bmp.width / bmp.height) ** (g.rq % 2 ? -1 : 1) : aspect; return a ? a * O.height / O.width : 0; };
    function setAspect(a) {
      aspect = a; if (!a) { draw(); return; }
      const r = arN(); let w = 1, h = w / r; if (h > 1) { h = 1; w = r; }
      const cx = crop.x + crop.w / 2, cy = crop.y + crop.h / 2;
      crop = { w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) }; draw();
    }
    // перетаскивание рамки и ручек
    cropEl.addEventListener('pointerdown', e => {
      e.preventDefault(); cropEl.setPointerCapture(e.pointerId);
      const hd = e.target.dataset.h || 'move', r0 = Object.assign({}, crop), bw = box.clientWidth, bh = box.clientHeight, x0 = e.clientX, y0 = e.clientY, ar = arN(), MIN = .04;
      const mv = ev => {
        const dx = (ev.clientX - x0) / bw, dy = (ev.clientY - y0) / bh; let { x, y, w, h } = r0;
        if (hd === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
        else {
          let L = x, T = y, R = x + w, Bm = y + h;
          if (hd.includes('w')) L = clamp(L + dx, 0, R - MIN); if (hd.includes('e')) R = clamp(R + dx, L + MIN, 1);
          if (hd.includes('n')) T = clamp(T + dy, 0, Bm - MIN); if (hd.includes('s')) Bm = clamp(Bm + dy, T + MIN, 1);
          if (ar) {
            let nw = R - L, nh = Bm - T;
            if (hd === 'n' || hd === 's') nw = nh * ar; else if (hd === 'e' || hd === 'w') nh = nw / ar; else if (nw / nh > ar) nh = nw / ar; else nw = nh * ar;
            if (nw > 1) { nw = 1; nh = nw / ar; } if (nh > 1) { nh = 1; nw = nh * ar; }
            if (hd.includes('w')) L = R - nw; else if (hd.includes('e')) R = L + nw; else { const cx = (r0.x + r0.w / 2); L = cx - nw / 2; R = L + nw; }
            if (hd.includes('n')) T = Bm - nh; else if (hd.includes('s')) Bm = T + nh; else { const cy = (r0.y + r0.h / 2); T = cy - nh / 2; Bm = T + nh; }
            if (L < 0) { R -= L; L = 0; } if (R > 1) { L -= R - 1; R = 1; } if (T < 0) { Bm -= T; T = 0; } if (Bm > 1) { T -= Bm - 1; Bm = 1; }
          }
          x = L; y = T; w = R - L; h = Bm - T;
        }
        crop = { x, y, w, h }; draw();
      };
      const up = () => { cropEl.removeEventListener('pointermove', mv); cropEl.removeEventListener('pointerup', up); thumbsDirty = true; };
      cropEl.addEventListener('pointermove', mv); cropEl.addEventListener('pointerup', up);
    });

    let thumbsDirty = true;
    function slider(label, min, max, step, val, on, fmt) {
      const v = el('output', {}, fmt(val)), i = el('input', { type: 'range', min, max, step, value: val });
      i.addEventListener('input', () => { v.textContent = fmt(+i.value); on(+i.value); draw(); });
      i.addEventListener('dblclick', () => { i.value = min < 0 ? 0 : (label === 'Сила фильтра' ? 1 : 0); i.dispatchEvent(new Event('input')); });
      return el('label', { class: 'pe-sl' }, el('span', {}, label, v), i);
    }
    const pctF = v => (v > 0 ? '+' : '') + Math.round(v * 100);
    function drawPanel() {
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
      panel.innerHTML = '';
      if (tab === 'crop') {
        panel.append(el('p', { class: 'pe-h' }, 'Пропорции'), el('div', { class: 'pe-chips' }, ...ASPECTS.map(([t, a]) => el('button', { type: 'button', class: aspect === a ? 'on' : '', onclick: e => { setAspect(a); panel.querySelectorAll('.pe-chips button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, t))));
        panel.append(el('p', { class: 'pe-h' }, 'Поворот и отражение'), el('div', { class: 'pe-chips' },
          el('button', { type: 'button', onclick: () => { g.rq--; crop = { x: 0, y: 0, w: 1, h: 1 }; rebuild(); if (aspect) setAspect(aspect); } }, '⟲ 90°'),
          el('button', { type: 'button', onclick: () => { g.rq++; crop = { x: 0, y: 0, w: 1, h: 1 }; rebuild(); if (aspect) setAspect(aspect); } }, '⟳ 90°'),
          el('button', { type: 'button', onclick: () => { g.fx = !g.fx; rebuild(); } }, '⇋ Зеркально'),
          el('button', { type: 'button', onclick: () => { g.fy = !g.fy; rebuild(); } }, '⇵ Перевернуть')));
        const ang = slider('Наклон', -45, 45, .5, g.angle, v => { g.angle = v; }, v => (v > 0 ? '+' : '') + v + '°');
        ang.querySelector('input').addEventListener('change', rebuild); ang.querySelector('input').addEventListener('input', () => { clearTimeout(ang._t); ang._t = setTimeout(rebuild, 60); });
        panel.append(ang, el('p', { class: 'pe-note' }, 'Тяните рамку и её углы. Двойной щелчок по ползунку — сброс. Обрезка сохраняется в новый файл, исходник остаётся в медиатеке.'));
      }
      if (tab === 'filters') {
        const grid = el('div', { class: 'pe-flt' });
        PRESETS.forEach(([name], i) => { const c = el('canvas'); grid.append(el('button', { type: 'button', class: i === preset ? 'on' : '', onclick: e => { preset = i; grid.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget)); draw(); } }, c, el('span', {}, name))); });
        panel.append(grid, slider('Сила фильтра', 0, 1, .01, amount, v => { amount = v; }, v => Math.round(v * 100) + '%'));
        setTimeout(() => thumbs(grid), 0);
      }
      if (tab === 'adjust') {
        ADJ.forEach(([k, label, min, max]) => panel.append(slider(label, min, max, .01, user[k], v => { user[k] = v; }, pctF)));
        panel.append(el('p', { class: 'pe-note' }, 'Настройки складываются с выбранным фильтром. Двойной щелчок по ползунку — сброс.'));
      }
      if (tab === 'export') {
        const sel = el('select'); [[1200, '1200 px — лёгкий'], [1800, '1800 px — рекомендуем'], [2400, '2400 px — максимум детали'], [100000, 'Исходный размер']].forEach(([v, t]) => sel.append(el('option', { value: v, selected: v === out.max }, t)));
        sel.addEventListener('change', () => { out.max = +sel.value; draw(); });
        const fm = el('select'); [['webp', 'WebP (меньше вес, рекомендуем)'], ['jpeg', 'JPEG']].forEach(([v, t]) => fm.append(el('option', { value: v, selected: v === out.fmt }, t)));
        fm.addEventListener('change', () => { out.fmt = fm.value; });
        panel.append(el('label', { class: 'pe-lb' }, 'Максимальная сторона', sel), el('label', { class: 'pe-lb' }, 'Формат', fm), slider('Качество', .6, 1, .01, out.q, v => { out.q = v; }, v => Math.round(v * 100) + '%'),
          el('p', { class: 'pe-note' }, 'Для сайта хватает 1800 px и качества 80–88%: фото чёткие и быстро грузятся.'));
      }
    }
    function thumbs(grid) {
      if (!O) return;
      const base = cropOf(O, crop), S = 84, t = el('canvas'); const k = Math.max(S / base.width, S / base.height); t.width = S; t.height = S;
      t.getContext('2d').drawImage(base, (S - base.width * k) / 2, (S - base.height * k) / 2, base.width * k, base.height * k);
      grid.querySelectorAll('canvas').forEach((c, i) => { c.width = S; c.height = S; c.getContext('2d').drawImage(t, 0, 0); process(c, mix(PRESETS[i][1], 1, {})); });
      thumbsDirty = false;
    }
    async function save() {
      const btns = foot.querySelectorAll('button'); btns.forEach(b => b.disabled = true); info.textContent = 'Сохраняю…';
      await new Promise(r => setTimeout(r, 30));
      try {
        const fw = crop.w * O.width / PV, fh = crop.h * O.height / PV, k = Math.min(1, out.max / Math.max(fw, fh));
        const big = oriented(bmp, g, k), cv = cropOf(big, crop); process(cv, params());
        const type = out.fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';
        let res = cv;
        if (type === 'image/jpeg') { res = el('canvas'); res.width = cv.width; res.height = cv.height; const x = res.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(cv, 0, 0); }
        const blob = await new Promise(r => res.toBlob(r, type, out.q));
        if (!blob) throw new Error('браузер не смог сохранить изображение');
        close({ blob, width: cv.width, height: cv.height, ext: out.fmt === 'jpeg' ? 'jpg' : 'webp', replaceAll: replaceAll.checked });
      } catch (e) { alert('Ошибка: ' + e.message); btns.forEach(b => b.disabled = false); }
    }
    addEventListener('resize', draw);
    rebuild(); drawPanel();
  });
}

/* ===================== кадр на сайте ===================== */
const FRAMES = [['Карточка товара', '1 / 1.02'], ['Широкий 16:9', '16 / 9'], ['Портрет 3:4', '3 / 4'], ['Высокий 9:16', '9 / 16']];
function frame(src, value, opts = {}) {
  return new Promise(resolve => {
    const v = Object.assign({ fit: 'cover', x: 50, y: 50, bg: '' }, value || {});
    if (dlg) dlg.remove();
    const img = el('img', { src, alt: '', draggable: 'false' }), dot = el('i', { class: 'fr-dot' }), area = el('div', { class: 'fr-area' }, el('div', { class: 'fr-imgw' }, img, dot));
    const previews = el('div', { class: 'fr-pv' });
    const modes = el('div', { class: 'pe-chips' });
    const bg = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v.bg) ? v.bg : '#ffffff' }), bgOn = el('input', { type: 'checkbox' }); bgOn.checked = !!v.bg;
    const bgRow = el('div', { class: 'fr-bg' }, el('label', { class: 'chk' }, bgOn, 'Заливка полей цветом'), bg);
    const xy = el('div', { class: 'pe-note' });
    const MODES = [['cover', 'Заполнить рамку', 'Фото заполняет рамку, лишнее по краям обрезается. Точка — что всегда остаётся в кадре.'], ['fit', 'Целиком, без обрезки', 'Фото показывается полностью, по краям могут быть поля.'], ['contain', 'Как вырезанный аппарат', 'Для фото аппарата на белом/прозрачном фоне: по центру, с тенью.']];
    const desc = el('p', { class: 'pe-note' });
    const draw = () => {
      modes.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === v.fit));
      desc.textContent = (MODES.find(m => m[0] === v.fit) || [])[2] || '';
      dot.hidden = v.fit === 'contain'; Object.assign(dot.style, { left: v.x + '%', top: v.y + '%' });
      bgRow.hidden = v.fit !== 'fit'; xy.textContent = v.fit === 'contain' ? '' : `Фокус: ${Math.round(v.x)}% по горизонтали, ${Math.round(v.y)}% по вертикали. Щёлкните или тяните по фото.`;
      previews.innerHTML = '';
      FRAMES.forEach(([t, ar]) => {
        const im = el('img', { src, alt: '' });
        if (v.fit === 'contain') im.className = 'ct'; else { im.style.objectFit = v.fit === 'fit' ? 'contain' : 'cover'; im.style.objectPosition = `${v.x}% ${v.y}%`; if (v.fit === 'fit' && bgOn.checked) im.style.background = bg.value; }
        previews.append(el('figure', {}, el('div', { class: 'fr-box' + (v.fit === 'contain' ? ' ct' : ''), style: `aspect-ratio:${ar}` }, im), el('figcaption', {}, t)));
      });
    };
    MODES.forEach(([m, t]) => modes.append(el('button', { type: 'button', 'data-m': m, onclick: () => { v.fit = m; draw(); } }, t)));
    const setXY = e => { const r = img.getBoundingClientRect(); v.x = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100); v.y = Math.round(clamp((e.clientY - r.top) / r.height, 0, 1) * 100); draw(); };
    area.addEventListener('pointerdown', e => { if (v.fit === 'contain') return; e.preventDefault(); area.setPointerCapture(e.pointerId); setXY(e); const mv = ev => setXY(ev), up = () => { area.removeEventListener('pointermove', mv); area.removeEventListener('pointerup', up); }; area.addEventListener('pointermove', mv); area.addEventListener('pointerup', up); });
    bg.addEventListener('input', () => { bgOn.checked = true; draw(); }); bgOn.addEventListener('change', draw);
    const done = r => { dlg.close(); dlg.remove(); dlg = null; resolve(r); };
    dlg = el('dialog', { class: 'dlg pe fr' }, el('div', { class: 'pe-in' },
      el('div', { class: 'pe-head' }, el('h2', {}, opts.title || 'Кадр на сайте'), el('span', { class: 'pe-info' }, 'Файл не меняется — меняется только то, как фото вписывается в рамки на сайте. Действует везде, где стоит это фото.')),
      el('div', { class: 'pe-main' }, el('div', { class: 'pe-stage' }, area), el('div', { class: 'pe-side' }, el('p', { class: 'pe-h' }, 'Как вписывать'), modes, desc, bgRow, xy, el('p', { class: 'pe-h' }, 'Так фото будет выглядеть в разных рамках'), previews)),
      el('div', { class: 'pe-foot' }, el('button', { class: 'b ghost', type: 'button', onclick: () => done('reset') }, 'Как было по умолчанию'), el('span'), el('button', { class: 'b ghost', type: 'button', onclick: () => done(null) }, 'Отмена'),
        el('button', { class: 'b gold', type: 'button', onclick: () => done({ fit: v.fit, x: Math.round(v.x), y: Math.round(v.y), bg: v.fit === 'fit' && bgOn.checked ? bg.value : '' }) }, 'Применить'))));
    dlg.addEventListener('cancel', e => { e.preventDefault(); done(null); });
    document.body.append(dlg); dlg.showModal(); draw();
  });
}

window.TEPhoto = { edit, frame, PRESETS };
})();
