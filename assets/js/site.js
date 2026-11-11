/* Trend Esthetic — поведение сайта. Данные: window.TE_DATA (assets/js/data.js, генерируется из content.json) */
(() => {
'use strict';
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const D = window.TE_DATA || { products: [], lb: {}, quiz: {}, roi: {} };
const root = document.documentElement;
const BASE = root.dataset.base || '', PAGE = root.dataset.page || 'home';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer: fine)').matches, motion = !reduce;
const P = f => !f ? '' : /^(https?:|data:|blob:)/.test(f) ? f : BASE + 'assets/img/' + f;
const fmt = n => String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// подписи интерфейса из админки («Подписи и кнопки»); второй аргумент — запасной текст
const T = (k, def, vars) => { let v = (D.ui && D.ui[k]) || def || k; if (vars) for (const n in vars) v = String(v).split('{' + n + '}').join(vars[n]); return v; };
const rub = n => n == null || n === '' || isNaN(+n) ? T('priceRequest', 'По запросу') : fmt(n) + ' ₽';
// кадр фото из админки («Кадр на сайте»): fit cover/contain/fit, фокус x/y, фон
const frame = (n, p) => { const m = (D.media || {})[n]; if (m) return { fit: m[0] || (/^c_/.test(n) ? 'contain' : 'cover'), pos: m[1] + '% ' + m[2] + '%', bg: m[3] || '' }; if (p && n === p.img) return { fit: p.fit || 'cover', pos: p.pos || '', bg: '' }; return { fit: /^c_/.test(n || '') ? 'contain' : 'cover', pos: '', bg: '' }; };
const applyFrame = (img, f) => { img.style.objectFit = f.fit === 'fit' ? 'contain' : ''; img.style.objectPosition = f.fit !== 'contain' && f.pos ? f.pos : ''; img.style.background = f.fit === 'fit' && f.bg ? f.bg : ''; };
const frameAttr = f => { let s = ''; if (f.fit === 'fit') s += 'object-fit:contain;'; if (f.fit !== 'contain' && f.pos) s += 'object-position:' + f.pos + ';'; if (f.fit === 'fit' && f.bg) s += 'background:' + f.bg + ';'; return s ? ` style="${esc(s)}"` : ''; };
const oldHtml = p => p && p.old ? ` <s class="price-old"${p.until ? ` data-until="${esc(p.until)}"` : ''}>${rub(p.old)}</s>` : '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = id => (D.products || []).find(p => p.id === id);
const pUrl = p => BASE + 'apparaty/' + p.slug + '/';
const CATS = D.cats || {};
let lenis = null;

/* ===================== header / nav / progress ===================== */
const hdr = $('#hdr'), prog = $('.progress'), dock = $('#dock'), leadSec = $('#lead'); let lastY = 0;
function onScroll() {
  const y = scrollY, h = root.scrollHeight - innerHeight;
  prog && prog.style.setProperty('--p', h > 0 ? y / h : 0);
  if (hdr) {
    hdr.classList.toggle('scrolled', y > 30);
    if (!document.body.classList.contains('menu-open')) { if (y > 600 && y > lastY + 4) hdr.classList.add('hide'); else if (y < lastY - 4 || y < 600) hdr.classList.remove('hide'); }
    root.classList.toggle('hh', hdr.classList.contains('hide'));
  }
  lastY = y;
  if (dock) { const lt = leadSec ? leadSec.getBoundingClientRect().top : 1e9; dock.classList.toggle('show', y > innerHeight * .8 && lt > innerHeight * .6); }
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const burger = $('#burger');
function menu(open) {
  document.body.classList.toggle('menu-open', open); if (open && hdr) hdr.classList.remove('hide');
  if (lenis) open ? lenis.stop() : lenis.start();
  root.classList.toggle('lock', open);
  if (burger) { burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? T('menuClose', 'Закрыть меню') : T('menuOpen', 'Открыть меню')); }
}
burger && burger.addEventListener('click', () => menu(!document.body.classList.contains('menu-open')));
$$('.mnav a,.mnav button').forEach(a => a.addEventListener('click', () => menu(false)));
if (PAGE === 'home') {
  const navLinks = $$('.nav a');
  const secIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
  navLinks.forEach(a => { const h = a.getAttribute('href'); if (h && h[0] === '#') { const s = document.getElementById(h.slice(1)); s && secIO.observe(s); } });
}

/* ===================== reveal & count ===================== */
$$('.svc-ph,.route-proof figure,.mosaic figure,.fdr-ph .m,.ba figure,.tile.photo').forEach(e => e.setAttribute('data-clip', ''));
const rIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rIO.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .06 });
$$('[data-r],[data-in],[data-clip],.ftr-big').forEach(el => rIO.observe(el));
function countUp(el) { const to = +el.dataset.count; if (reduce || isNaN(to)) { el.textContent = el.dataset.count; return; } const t0 = performance.now(), d = 1600; const f = t => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 4); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
const cIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); cIO.unobserve(e.target); } })); $$('[data-count]').forEach(el => cIO.observe(el));

/* ===================== pointer fx ===================== */
if (fine && motion) {
  $$('.spot').forEach(s => s.addEventListener('pointermove', e => { const r = s.getBoundingClientRect(); s.style.setProperty('--mx', e.clientX - r.left + 'px'); s.style.setProperty('--my', e.clientY - r.top + 'px'); }));
  $$('.magnet').forEach(b => { b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .18}px,${(e.clientY - r.top - r.height / 2) * .28}px)`; }); b.addEventListener('pointerleave', () => b.style.transform = ''); });
  const hv = $('#hv'), hero = $('.hero');
  if (hv && hero) { const main = $('.hv-main', hv), sub = $('.hv-sub', hv); hero.addEventListener('pointermove', e => { const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5; main && (main.style.setProperty('--ry', x * 7 + 'deg'), main.style.setProperty('--rx', -y * 6 + 'deg')); sub && (sub.style.setProperty('--tx', x * -26 + 'px'), sub.style.setProperty('--ty', y * -20 + 'px')); }); }
}

/* ===================== tech story ===================== */
const sv = $('#sv');
if (sv) {
  const steps = D.techSteps || []; let curT = [steps[0] ? steps[0].f : 40, steps[0] ? steps[0].s : 34];
  const animT = (sel, a, b) => { const el = $(sel); if (!el) return; if (reduce) { el.textContent = b + (b >= 70 ? '+' : ''); return; } const t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(a + (b - a) * (1 - Math.pow(1 - k, 3))) + (k === 1 && b >= 70 ? '+' : ''); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); };
  const setStep = n => { const st = steps[n - 1]; if (!st) return; sv.dataset.s = n; $('#svTag').textContent = st.tag; $$('#steps .st').forEach(s => s.classList.toggle('on', +s.dataset.s === n)); animT('#tF', curT[0], st.f); animT('#tS', curT[1], st.s); curT = [st.f, st.s]; $('#bF').style.setProperty('--w', (st.f - 30) / 50 * 100 + '%'); $('#bS').style.setProperty('--w', (st.s - 30) / 50 * 100 + '%'); };
  const stIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setStep(+e.target.dataset.s); }), { rootMargin: '-42% 0px -42% 0px' });
  $$('#steps .st').forEach(s => stIO.observe(s));
}

/* ===================== phototype ===================== */
const ptBtns = $('#ptBtns');
if (ptBtns) {
  const PT = D.phototypes || []; let ptT = 0;
  const setPT = i => { const p = PT[i], card = $('.pt-card'); if (!p) return; $$('.pt-btn').forEach((b, j) => b.setAttribute('aria-pressed', j === i)); card.classList.add('sw'); clearTimeout(ptT); ptT = setTimeout(() => { $('#ptTitle').textContent = p.t; $('#ptSub').textContent = p.s; $('#ptText').innerHTML = p.x; card.classList.remove('sw'); }, ptT ? 220 : 0); $$('.spec-bar .tick').forEach(t => { const w = t.dataset.w; t.classList.toggle('on', p.w.includes(w)); t.classList.toggle('main', p.m === w); t.style.opacity = p.w.includes(w) ? 1 : .45; }); };
  ptBtns.addEventListener('click', e => { const b = e.target.closest('.pt-btn'); b && setPT(+b.dataset.i); });
  const sel = $$('.pt-btn').findIndex(b => b.getAttribute('aria-pressed') === 'true'); setPT(sel < 0 ? 0 : sel);
}

/* ===================== progression ===================== */
const pr = $('#progR');
if (pr) {
  const PL = D.progress || [], n = +pr.max;
  const setProg = () => { const v = +pr.value; $$('#progStage img').forEach((im, i) => im.classList.toggle('on', i === v - 1)); $('#progLbl').textContent = PL[v - 1] || ''; $('#progN').textContent = v + ' / ' + n; pr.style.setProperty('--p', (v - 1) / Math.max(1, n - 1) * 100 + '%'); };
  pr.addEventListener('input', setProg); setProg();
  let auto = null; const pIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !auto && !reduce) { let v = 1; auto = setInterval(() => { if (pr.dataset.touched) { clearInterval(auto); return; } v = v % n + 1; pr.value = v; setProg(); }, 1700); } }), { threshold: .5 });
  pIO.observe($('#progStage')); pr.addEventListener('pointerdown', () => pr.dataset.touched = 1);
}

/* ===================== акции: после даты окончания прячем старую цену, скидку и срок ===================== */
$$('[data-until]').forEach(e => { const d = new Date(e.dataset.until + 'T23:59:59'); if (!isNaN(d) && d < new Date()) e.remove(); });

/* ===================== catalog (filter / sort / reveal / tilt) ===================== */
const cardIO = new IntersectionObserver(es => { es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left).forEach((e, k) => { e.target.style.setProperty('--i', k); e.target.classList.add('in'); cardIO.unobserve(e.target); }); }, { rootMargin: '0px 0px -6% 0px', threshold: .06 });
$$('.card').forEach(c => cardIO.observe(c));
const grid = $('#grid'), chips = $('#catChips');
if (grid && chips) {
  let cat = 'all', sort = 'def';
  const cards = $$('.card', grid);
  const render = () => {
    const list = cards.slice().sort((a, b) => sort === 'def' ? a.dataset.idx - b.dataset.idx : ((a.dataset.price === '' ? 1e12 : +a.dataset.price) - (b.dataset.price === '' ? 1e12 : +b.dataset.price)) * (sort === 'asc' ? 1 : -1));
    let k = 0;
    list.forEach(c => { const show = cat === 'all' || (cat === 'sale' ? !!c.dataset.sale : c.dataset.cat === cat); c.hidden = !show; grid.appendChild(c); if (show) { c.classList.remove('in'); c.style.setProperty('--i', Math.min(k++, 8)); } });
    requestAnimationFrame(() => requestAnimationFrame(() => list.forEach(c => { if (!c.hidden) c.classList.add('in'); })));
  };
  chips.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.cat; $$('.chip', chips).forEach(c => c.setAttribute('aria-pressed', c === b)); render(); });
  const so = $('#sort'); so && so.addEventListener('change', e => { sort = e.target.value; render(); });
}
if (fine && motion) {
  document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.card'); if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg'); c.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg'); c.style.setProperty('--gx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--gy', (y * 100).toFixed(1) + '%'); }, { passive: true });
  document.addEventListener('pointerout', e => { const c = e.target.closest && e.target.closest('.card'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); } });
}

/* ===================== product sheet (modal) ===================== */
const pm = $('#pm'); let cur = null;
function setMain(n) {
  const m = $('#pmMain'), im = $('#pmImg'), f = frame(n, cur), isCut = f.fit === 'contain'; im.classList.add('swap');
  setTimeout(() => { m.className = 'pm-main ' + (isCut ? 'contain' : 'cover'); m.style.setProperty('--bgi', isCut ? 'none' : `url("${new URL(P(n), location.href).href}")`); im.src = P(n); applyFrame(im, f); requestAnimationFrame(() => im.classList.remove('swap')); }, 180);
  $$('#pmTh button').forEach(b => b.setAttribute('aria-current', b.dataset.n === n));
}
function openProduct(id, push = true) {
  const p = byId(id); if (!p || !pm) return false; cur = p;
  $('#pmK').textContent = (CATS[p.cat] || '') + ' · ' + p.kind; $('#pmN').textContent = p.name; $('#pmP').innerHTML = esc(rub(p.price)) + oldHtml(p);
  $('#pmPs').textContent = p.price == null ? (D.priceRequestNote || '') : (D.priceNote || ''); $('#pmL').textContent = p.lead || '';
  const pg = $('#pmPage'); if (pg) pg.href = pUrl(p);
  $('#pmF').innerHTML = p.feats.length ? `<p class="pm-h">${esc(T('featsTitle', 'Особенности и преимущества'))}</p><ul class="pm-feats" style="margin-top:12px">${p.feats.map((f, k) => `<li style="--i:${k}"><svg><use href="#i-check"/></svg><span>${esc(f)}</span></li>`).join('')}</ul>` : '';
  $('#pmS').innerHTML = p.specs.length ? `<p class="pm-h">${esc(T('specsTitle', 'Технические характеристики'))}</p><dl class="pm-specs" style="margin-top:12px">${p.specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : `<p class="pm-h">${esc(T('specsTitle', 'Технические характеристики'))}</p><p style="margin:12px 0 0;color:var(--mu-l)">${esc(T('specsEmpty', 'Характеристики и цену уточняйте у менеджера — пришлём полное описание модели.'))}</p>`;
  $('#pmTh').innerHTML = p.gallery.length > 1 ? p.gallery.map((n, k) => `<button type="button" style="--i:${k}" data-n="${esc(n)}" class="${frame(n, p).fit === 'contain' ? 'ct' : ''}" aria-label="${esc(T('photo', 'Фото'))} ${k + 1}"><img src="${P(n)}" alt="" loading="lazy"${frameAttr(frame(n, p))}></button>`).join('') : '';
  setMain(p.gallery[0] || p.img);
  $$('.pm-body>*', pm).forEach((c, k) => c.style.setProperty('--i', k));
  pm.classList.remove('pm-on'); if (!pm.open) pm.showModal(); requestAnimationFrame(() => requestAnimationFrame(() => pm.classList.add('pm-on')));
  pm.querySelector('.sheet-in').scrollTop = 0; $$('.pm-body,.pm-gal', pm).forEach(e => e.scrollTop = 0);
  if (push && PAGE === 'home') history.replaceState(null, '', '#' + p.slug);
  return true;
}
if (pm) {
  $('#pmTh').addEventListener('click', e => { const b = e.target.closest('button'); b && setMain(b.dataset.n); });
  pm.addEventListener('close', () => { pm.classList.remove('pm-on'); if (cur && location.hash.slice(1) === cur.slug) history.replaceState(null, '', location.pathname + location.search); });
  $('#pmLead').addEventListener('click', () => { pm.close(); toLead(cur ? `${cur.name} — ${rub(cur.price)}` : ''); });
}
document.addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (!o || e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
  if (o.tagName === 'TR' && e.target.closest('a')) { e.preventDefault(); }
  if (openProduct(o.dataset.open)) e.preventDefault();
  else if (o.dataset.href) location.href = o.dataset.href;
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-open]')) { e.preventDefault(); if (!openProduct(e.target.dataset.open) && e.target.dataset.href) location.href = e.target.dataset.href; } });
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }));

/* ===================== product page gallery ===================== */
const ppId = document.body.dataset.product, ppP = ppId && byId(ppId);
if (ppP) {
  D.lb.product = ppP.gallery.map((g, i) => [g, ppP.name + ' — ' + T('photo', 'Фото').toLowerCase() + ' ' + (i + 1)]);
  const main = $('#ppImg'), wrap = $('.pp-main');
  $$('.pp-th button').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.pp, g = ppP.gallery[i]; main.style.opacity = 0; setTimeout(() => { main.src = P(g); const f = frame(g, ppP); applyFrame(main, f); wrap.className = 'pp-main ' + (f.fit === 'contain' ? 'contain' : 'cover'); wrap.dataset.i = i; main.style.opacity = 1; }, 150); $$('.pp-th button').forEach(x => x.setAttribute('aria-current', x === b)); }));
}
$$('[data-lead-product]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toLead(a.dataset.leadProduct); }));

/* ===================== rail ===================== */
const rail = $('#rail'); let dx = 0;
if (rail) {
  const railM = $('#railM');
  const meter = () => { const max = rail.scrollWidth - rail.clientWidth, w = rail.clientWidth / rail.scrollWidth * 100; railM.style.setProperty('--w', w + '%'); railM.style.setProperty('--x', (max > 0 ? rail.scrollLeft / max : 0) * (100 / w * 100 - 100) + '%'); };
  rail.addEventListener('scroll', meter, { passive: true }); addEventListener('resize', meter); setTimeout(meter, 300);
  const step = () => (rail.querySelector('figure') || { getBoundingClientRect: () => ({ width: 300 }) }).getBoundingClientRect().width + 14;
  $('#railL').onclick = () => rail.scrollBy({ left: -step(), behavior: 'smooth' }); $('#railR').onclick = () => rail.scrollBy({ left: step(), behavior: 'smooth' });
  let sx = 0, sl = 0, down = false;
  rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; dx = 0; sx = e.clientX; sl = rail.scrollLeft; });
  addEventListener('pointermove', e => { if (!down) return; dx = e.clientX - sx; if (Math.abs(dx) > 4) rail.classList.add('drag'); rail.scrollLeft = sl - dx; });
  addEventListener('pointerup', () => { if (!down) return; down = false; setTimeout(() => rail.classList.remove('drag'), 0); });
}

/* ===================== lightbox ===================== */
const lb = $('#lb'); let lbSet = null, lbI = 0;
function lbShow(i) { const s = D.lb[lbSet] || []; if (!s.length) return; lbI = (i + s.length) % s.length; const [n, c] = s[lbI]; const im = $('#lbImg'); im.src = P(n); im.alt = c; $('#lbC').textContent = c; $('#lbN').textContent = (lbI + 1) + ' / ' + s.length; }
if (lb) {
  document.addEventListener('click', e => { const f = e.target.closest('[data-lb]'); if (!f || (Math.abs(dx) > 4 && f.closest('.rail'))) return; lbSet = f.dataset.lb; if (!(D.lb[lbSet] || []).length) return; lbShow(+f.dataset.i || 0); lb.showModal(); });
  $('#lbP').onclick = () => lbShow(lbI - 1); $('#lbX').onclick = () => lbShow(lbI + 1);
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') lbShow(lbI - 1); if (e.key === 'ArrowRight') lbShow(lbI + 1); });
  let tsx = 0; const fig = $('#lbFig'); fig.addEventListener('touchstart', e => tsx = e.touches[0].clientX, { passive: true }); fig.addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - tsx; if (Math.abs(d) > 50) lbShow(lbI + (d < 0 ? 1 : -1)); });
  fig.addEventListener('click', e => { if (e.target === fig) lb.close(); });
}

/* ===================== ROI ===================== */
const rDev = $('#rDev');
if (rDev) {
  const R = D.roi || {};
  rDev.innerHTML = D.products.filter(p => p.price).map(p => `<option value="${esc(p.id)}"${p.id === R.defaultProduct ? ' selected' : ''}>${esc(p.name)} — ${rub(p.price)}</option>`).join('');
  $('#quick').innerHTML = (R.quick || []).map(q => `<button type="button" data-v="${+q.value}">${esc(q.name)}<b>${fmt(q.value)}</b></button>`).join('');
  $('#quick').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $('#rCheck').value = b.dataset.v; calc(); });
  const fillR = r => r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%');
  const months = m => { const n = Math.ceil(m); const w = n % 10 === 1 && n % 100 !== 11 ? 'месяц' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'месяца' : 'месяцев'; return [n, w]; };
  const tw = (sel, to) => { const el = $(sel), from = el._v ?? to; el._v = to; if (reduce || from === to) { el.textContent = rub(to); return; } cancelAnimationFrame(el._r); const t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3); el.textContent = rub(from + (to - from) * e); if (k < 1) el._r = requestAnimationFrame(f); }; el._r = requestAnimationFrame(f); };
  function chart(price, prof) {
    const W = 600, H = 240, L = 46, Rr = 10, T = 16, B = 28, cum = [...Array(13)].map((_, m) => prof * m - price), mx = Math.max(0, ...cum), mn = Math.min(0, ...cum), span = mx - mn || 1;
    const y = v => T + (mx - v) / span * (H - T - B), bw = (W - L - Rr) / 13; let s = `<defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9D3A1"/><stop offset="1" stop-color="#C9A15E"/></linearGradient></defs>`;
    [mx, 0, mn].forEach(v => { if (v === 0 || Math.abs(v) > span * .12) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v === 0 ? .35 : .08})" ${v === 0 ? '' : 'stroke-dasharray="3 4"'}/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${v === 0 ? '0' : (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'м' : Math.round(v / 1000) + 'к')}</text>`; });
    cum.forEach((v, m) => { const x = L + m * bw + bw * .18, w = bw * .64, y0 = y(0), yv = y(v), h = Math.max(1.5, Math.abs(yv - y0)); s += `<rect class="${v < 0 ? 'neg' : ''}" style="--i:${m}" x="${x}" y="${Math.min(y0, yv)}" width="${w}" height="${h}" rx="3" fill="${v >= 0 ? 'url(#gb)' : 'rgba(207,224,216,.16)'}"><title>${m} мес: ${fmt(v)} ₽</title></rect>`; if (m % 2 === 0) s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${m === 12 ? '12 мес' : m}</text>`; });
    if (prof > 0) { const m = price / prof; if (m <= 12) { const x = L + m * bw + bw / 2, right = x > W * .55; s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" stroke="#E9D3A1" stroke-dasharray="4 4"/><circle cx="${x}" cy="${y(0)}" r="5" fill="#fff" stroke="#C9A15E" stroke-width="2"/><text x="${right ? x - 8 : x + 8}" y="${T + 12}" text-anchor="${right ? 'end' : 'start'}" style="fill:#E9D3A1">окупился</text>`; } }
    $('#chart').innerHTML = s;
  }
  function calc() {
    const p = byId(rDev.value); if (!p) return; const price = p.price, ch = +$('#rCheck').value, per = +$('#rPer').value, days = +$('#rDays').value, cost = +$('#rCost').value;
    $$('.roi .rng').forEach(fillR); $('#oCheck').textContent = rub(ch); $('#oPer').textContent = per; $('#oDays').textContent = days; $('#oCost').textContent = rub(cost);
    const rev = ch * per * days, prof = rev - cost; tw('#oRev', rev); tw('#oProf', prof); tw('#oYear', prof * 12 - price);
    const ob = $('#oPay');
    if (prof <= 0) { ob.textContent = T('roiNever', 'Не окупится'); $('#oPayS').textContent = T('roiNeverText', 'При таких вводных расходы выше выручки — увеличьте чек или число клиентов.'); }
    else { const m = price / prof, [n, w] = months(m), t = m < 1 ? '<1 мес' : `${n} ${w}`; if (ob.textContent !== t) { ob.textContent = t; ob.classList.remove('bump'); void ob.offsetWidth; ob.classList.add('bump'); } $('#oPayS').textContent = `${p.name} за ${rub(price)} при прибыли ${rub(prof)} в месяц`; }
    chart(price, prof);
  }
  $$('.roi input,.roi select').forEach(i => i.addEventListener('input', calc)); calc();
  $('[data-lead-from-roi]').addEventListener('click', () => { const p = byId(rDev.value); toLead(`Расчёт окупаемости: ${p.name}, чек ${rub(+$('#rCheck').value)}, ${$('#rPer').value} клиентов в день`); });
  const chIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && motion) { const c = $('#chart'); c.classList.add('grow'); setTimeout(() => c.classList.remove('grow'), 2400); chIO.disconnect(); } }), { threshold: .35 }); chIO.observe($('#chart'));
}

/* ===================== quiz ===================== */
const qz = $('#qz');
if (qz) {
  const Q = (D.quiz && D.quiz.questions) || []; let qs = {};
  const recommend = ({ cat, space, budget }) => {
    let pool = D.products.filter(p => cat === 'multi' ? (p.cat === 'multi' || p.tags.includes('multi')) : p.cat === cat);
    if (!pool.length) pool = D.products.slice();
    let fit = pool.filter(p => p.price != null ? p.price <= budget : budget >= 1e9), over = false;
    if (!fit.length) { fit = pool.filter(p => p.price != null).sort((a, b) => a.price - b.price).slice(0, 2); over = true; }
    const mxp = Math.max(...fit.map(p => p.price || 0)) || 1;
    const sc = p => (space === 'small' && (p.tags.includes('compact') || p.tags.includes('mobile')) ? 4 : 0) + (space === 'small' && p.tags.includes('flow') ? -2 : 0) + (space === 'flow' && p.tags.includes('flow') ? 4 : 0) + (space === 'room' && !p.tags.includes('mobile') ? 1 : 0) + ((p.price || mxp) / mxp) * 1.5;
    return { list: fit.sort((a, b) => sc(b) - sc(a)).slice(0, 3), over };
  };
  const qzRender = i => {
    $('#qzBar').style.setProperty('--w', (i / Q.length * 100 || 8) + '%'); const b = $('#qzBody'); b.classList.remove('qz-anim'); void b.offsetWidth; b.classList.add('qz-anim');
    if (i < Q.length) {
      const q = Q[i];
      b.innerHTML = `<span class="qz-k">${esc(T('qzStep', 'Вопрос {n} из {total}', { n: i + 1, total: Q.length }))}</span><h3 id="qzH">${esc(q.title)}</h3><div class="qz-opts">${q.options.map((o, k) => `<button class="qz-o" style="--i:${k}" type="button" data-v="${esc(o.v)}"><b>${esc(o.t)}</b><span>${esc(o.d)}</span></button>`).join('')}</div>${i ? `<button class="qz-back" type="button" data-back>${esc(T('qzBack', '← Назад'))}</button>` : ''}`;
      $$('.qz-o', b).forEach(o => o.onclick = () => { qs[q.key] = q.key === 'budget' ? +o.dataset.v : o.dataset.v; qzRender(i + 1); });
      const bk = $('[data-back]', b); bk && (bk.onclick = () => qzRender(i - 1)); const f = $('.qz-o', b); f && f.focus({ preventScroll: true }); return;
    }
    const { list, over } = recommend({ cat: qs.cat, space: qs.space, budget: qs.budget || 1e9 }); $('#qzBar').style.setProperty('--w', '100%');
    b.innerHTML = `<span class="qz-k">${esc(T('qzReady', 'Подбор готов'))}</span><h3 id="qzH">${esc(D.quiz.resultTitle || 'Вам подойдут')}</h3>${over ? `<p class="qz-note">${esc(D.quiz.overNote || '')}</p>` : ''}<div class="qz-res">${list.map((p, k) => `<a class="qz-r" style="--i:${k}" href="${pUrl(p)}" data-pick="${esc(p.id)}"><span class="im ${p.fit === 'contain' ? 'contain' : 'cover'}"><img src="${P(p.img)}" alt=""${frameAttr(frame(p.img, p))}></span><span><b>${esc(p.name)}</b><small>${esc(p.kind)}</small></span><span class="pr">${rub(p.price)}</span></a>`).join('')}</div>
    <button class="btn btn-fire" type="button" data-qlead style="width:100%">${esc(D.quiz.resultBtn || T('getOffer', 'Получить предложение'))} <svg><use href="#i-arrow"/></svg></button><button class="qz-back" type="button" data-again>${esc(T('qzAgain', 'Пройти заново'))}</button>`;
    $$('[data-pick]', b).forEach(x => x.onclick = e => { if (pm) { e.preventDefault(); qz.close(); openProduct(x.dataset.pick); } });
    $('[data-again]', b).onclick = () => { qs = {}; qzRender(0); };
    $('[data-qlead]', b).onclick = () => { qz.close(); toLead(T('qzPrefix', 'Подбор: ') + list.map(p => p.name).join(', ')); };
  };
  $$('[data-quiz]').forEach(b => b.addEventListener('click', () => { menu(false); qs = {}; qzRender(0); qz.showModal(); }));
}

/* ===================== map ===================== */
const mapBtn = $('#mapBtn');
mapBtn && mapBtn.addEventListener('click', () => { const m = $('#map'), M = D.map || {}; m.innerHTML = `<iframe title="Карта: ${esc(M.title || '')}" loading="lazy" src="https://yandex.ru/map-widget/v1/?ll=${M.lng}%2C${M.lat}&z=16&pt=${M.lng}%2C${M.lat}%2Cpm2rdm" allowfullscreen></iframe>`; });

/* ===================== route ===================== */
const route = $('#route');
if (route) {
  const lis = $$('.route-st li');
  const routeP = () => { const r = route.getBoundingClientRect(), wide = innerWidth >= 1000; const p = Math.min(1, Math.max(0, (innerHeight * .7 - r.top) / (r.height * .85))); route.style.setProperty('--p', p.toFixed(4)); lis.forEach(li => { const f = wide ? li.offsetLeft / route.offsetWidth : li.offsetTop / route.offsetHeight; li.classList.toggle('on', p >= f + .01); }); };
  addEventListener('scroll', routeP, { passive: true }); addEventListener('resize', routeP); routeP();
}

/* ===================== FAQ ===================== */
$$('.acc-q').forEach(q => q.addEventListener('click', () => { const i = q.closest('.acc-i'), o = !i.classList.contains('open'); $$('.acc-i', i.parentElement).forEach(x => { x.classList.remove('open'); $('.acc-q', x).setAttribute('aria-expanded', 'false'); }); if (o) { i.classList.add('open'); q.setAttribute('aria-expanded', 'true'); } }));

/* ===================== lead form ===================== */
const form = $('#form'), ph = $('#fPhone');
function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 4200); }
function toLead(text) {
  const L = $('#lead'); if (!L) { location.href = BASE + '#lead'; return; }
  const m = $('#fMsg'); if (text && m) m.value = text;
  if (lenis) lenis.scrollTo(L, { offset: -20, duration: 1.6 }); else L.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  setTimeout(() => ph && ph.focus({ preventScroll: true }), 900);
}
async function sendLead(text, data) {
  if (D.webhook) { try { const r = await fetch(D.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ text, page: location.href }, data)) }); if (r.ok) return 'webhook'; } catch (e) {} }
  try { await navigator.clipboard.writeText(text); } catch (e) {}
  if (D.telegram) window.open(D.telegram + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  return 'telegram';
}
if (form && ph) {
  ph.addEventListener('input', () => { let d = ph.value.replace(/\D/g, ''); if (d.startsWith('8')) d = '7' + d.slice(1); if (!d.startsWith('7')) d = '7' + d; d = d.slice(0, 11); const p = d.slice(1); let s = '+7'; if (p.length) s += ' (' + p.slice(0, 3); if (p.length >= 3) s += ') ' + p.slice(3, 6); if (p.length >= 6) s += '-' + p.slice(6, 8); if (p.length >= 8) s += '-' + p.slice(8, 10); ph.value = s; $('#fPhoneW').classList.remove('err'); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); const digits = ph.value.replace(/\D/g, '');
    if (digits.length < 11) { $('#fPhoneW').classList.add('err'); ph.focus(); toast(T('errPhone', 'Укажите телефон полностью')); return; }
    if (!$('#fAgree').checked) { toast(T('errConsent', 'Нужно согласие на обработку данных')); return; }
    const fd = new FormData(form), data = { name: fd.get('name') || '', phone: ph.value, want: fd.get('want'), pay: fd.get('pay'), msg: fd.get('msg') || '' };
    const text = `Заявка с сайта ${D.siteName || ''}\nИмя: ${data.name || '—'}\nТелефон: ${data.phone}\nИнтересует: ${data.want}\nОплата: ${data.pay}\nКомментарий: ${data.msg || '—'}\nСтраница: ${location.href}`;
    const how = await sendLead(text, data); form.classList.add('sent');
    toast(how === 'webhook' ? T('okSent', 'Заявка отправлена — скоро свяжемся') : T('okCopied', 'Текст заявки скопирован — отправьте его в Telegram'));
    try { window.ym && window.TE_YM && ym(window.TE_YM, 'reachGoal', 'lead'); } catch (er) {}
  });
}

/* ===================== music ===================== */
(function music() {
  const M = D.music || {}, btn = $('#snd'); if (!btn || !M.enabled || !M.file) return;
  const KEY = 'te-music', POS = 'te-music-pos'; let pref = null; try { pref = localStorage.getItem(KEY); } catch (e) {}
  const audio = new Audio(); audio.src = /^https?:/.test(M.file) ? M.file : BASE + 'assets/music/' + M.file; audio.loop = true; audio.preload = 'auto'; audio.volume = 0;
  try { const t = +sessionStorage.getItem(POS); if (t > 0) audio.currentTime = t; } catch (e) {}
  const target = Math.max(0, Math.min(1, isNaN(+M.volume) ? .35 : +M.volume)); let on = false, raf = 0;
  const fade = (to, ms, cb) => { cancelAnimationFrame(raf); const from = audio.volume, t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / ms); audio.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) raf = requestAnimationFrame(f); else cb && cb(); }; raf = requestAnimationFrame(f); };
  const ui = () => { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.setAttribute('aria-label', on ? T('musicOff', 'Выключить музыку') : T('musicOn', 'Включить музыку')); };
  const play = async () => { try { await audio.play(); on = true; ui(); fade(target, 1600); return true; } catch (e) { return false; } };
  const stop = () => { on = false; ui(); fade(0, 450, () => audio.pause()); };
  const evs = ['pointerdown', 'keydown', 'touchstart'];
  const once = e => { if (e.target && e.target.closest && e.target.closest('#snd')) return; remove(); if (!on) play(); };
  const remove = () => evs.forEach(ev => removeEventListener(ev, once, true));
  btn.addEventListener('click', () => { remove(); if (on) { stop(); try { localStorage.setItem(KEY, 'off'); } catch (e) {} } else { play(); try { localStorage.setItem(KEY, 'on'); } catch (e) {} } });
  if (M.autoplay !== false && pref !== 'off') {
    const start = () => play().then(ok => { if (!ok) { btn.classList.add('hint'); evs.forEach(ev => addEventListener(ev, once, { capture: true, passive: true })); } });
    if (document.readyState === 'complete') start(); else addEventListener('load', start);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (on) audio.pause(); } else if (on) audio.play().catch(() => {}); });
  addEventListener('pagehide', () => { try { sessionStorage.setItem(POS, String(audio.currentTime || 0)); } catch (e) {} });
})();

/* ===================== MOTION ENGINE ===================== */
const intro = $('#intro');
if (window.Lenis && fine && motion) {
  lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) }); window.__lenis = lenis;
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented) return; const id = a.getAttribute('href'); if (id.length < 2) return; const t = document.getElementById(id.slice(1)); if (!t) return; e.preventDefault(); lenis.scrollTo(t, { offset: id === '#top' ? 0 : -70, duration: 1.6 }); });
  $$('dialog').forEach(d => new MutationObserver(() => { if (d.open) lenis.stop(); else if (!document.body.classList.contains('menu-open')) lenis.start(); }).observe(d, { attributes: true, attributeFilter: ['open'] }));
  $$('.rail,.cmp-wrap').forEach(el => el.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation(); }, { passive: true }));
}
function splitWords(el) {
  let k = 0; const unit = () => { const w = document.createElement('span'); w.className = 'w'; const i = document.createElement('i'); i.style.setProperty('--i', k++); w.appendChild(i); return [w, i]; };
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) { if (!n.textContent.trim()) return; const f = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(t)); return; } const [w, i] = unit(); i.textContent = t; f.appendChild(w); }); n.replaceWith(f); }
    else if (n.nodeType === 1 && n.tagName !== 'BR') { if (n.tagName === 'EM' || n.classList.contains('spectral')) { const [w, i] = unit(); n.replaceWith(w); i.appendChild(n); } else walk(n); }
  });
  walk(el); el.classList.add('split');
}
$$('.h2[data-r],.h3[data-r],.fdr-name[data-r]').forEach(splitWords);
const h1 = $('.h1');
if (h1) {
  let ci = 0; h1.setAttribute('aria-label', h1.textContent.replace(/\s+/g, ' ').trim());
  $$('.ln>span', h1).forEach(line => [...line.childNodes].forEach(n => {
    if (n.nodeType === 3) { const f = document.createDocumentFragment(); [...n.textContent].forEach(c => { if (/\s/.test(c)) { f.appendChild(document.createTextNode(c)); return; } const s = document.createElement('span'); s.className = 'ch'; s.setAttribute('aria-hidden', 'true'); s.textContent = c; s.style.setProperty('--i', ci++); f.appendChild(s); }); n.replaceWith(f); }
    else if (n.nodeType === 1) { n.classList.add('ch'); n.style.setProperty('--i', ci++); }
  }));
  h1.classList.add('chs');
}
const fb = $('.ftr-big'); if (fb) fb.innerHTML = [...fb.textContent].map((c, i) => c === ' ' ? ' ' : `<span style="--i:${i}">${esc(c)}</span>`).join('');
$$('.btn').forEach(b => { const t = [...b.childNodes].find(n => n.nodeType === 3 && n.textContent.trim()); if (!t) return; const x = t.textContent.trim(); const r = document.createElement('span'); r.className = 'roll'; r.innerHTML = `<span data-t="${esc(x)}">${esc(x)}</span>`; t.replaceWith(r); });
$$('.hero-stats>div').forEach((d, i) => d.style.setProperty('--i', i));
$$('.tidx-l span').forEach((d, i) => d.style.setProperty('--i', i));
$$('.rail figure,.mosaic figure,.route-proof figure').forEach(f => f.dataset.cursor = T('cursorView', 'Смотреть'));

function startHero() { document.body.classList.add('ready'); }
let seen = null; try { seen = sessionStorage.getItem('te-intro'); } catch (e) { seen = 1; }
if (!intro || !motion || seen || D.intro === false) { intro && intro.classList.add('gone'); startHero(); }
else {
  root.classList.add('intro-on'); lenis && lenis.stop();
  setTimeout(() => { intro.classList.add('out'); startHero(); root.classList.remove('intro-on'); lenis && lenis.start(); try { sessionStorage.setItem('te-intro', '1'); } catch (e) {} }, 1500);
  setTimeout(() => intro.classList.add('gone'), 2900);
}
if (fine && motion) {
  const curEl = $('#cur'), ct = $('#curT');
  if (curEl) {
    root.classList.add('has-cur'); let mx = -99, my = -99, rx = -99, ry = -99;
    addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mx = e.clientX; my = e.clientY; curEl.classList.remove('off'); const el = e.target.closest ? e.target : null; if (!el) return; const t = el.closest('[data-cursor]'), h = !t && el.closest('a,button,select,input,textarea,label,[role="button"],.chip'); curEl.classList.toggle('lbl', !!t); if (t) ct.textContent = t.dataset.cursor; curEl.classList.toggle('hov', !!h); }, { passive: true });
    addEventListener('pointerdown', () => curEl.classList.add('down')); addEventListener('pointerup', () => curEl.classList.remove('down'));
    root.addEventListener('mouseleave', () => curEl.classList.add('off'));
    const loop = () => { rx += (mx - rx) * .2; ry += (my - ry) * .2; curEl.style.setProperty('--x', mx + 'px'); curEl.style.setProperty('--y', my + 'px'); curEl.style.setProperty('--rx', rx.toFixed(1) + 'px'); curEl.style.setProperty('--ry', ry.toFixed(1) + 'px'); requestAnimationFrame(loop); }; loop();
  }
}
const PX = $$('.rail .ph img,.tile.photo img,.mosaic img,.route-proof img,.svc-ph img,.fdr-ph .m img,.fdr-ph .s img,.ba img'), vis = new Set();
if (motion) {
  PX.forEach(img => { img.classList.add('px'); img.parentElement._img = img; });
  const pxIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)), { rootMargin: '120px 0px' });
  PX.forEach(img => pxIO.observe(img.parentElement));
}
const heroS = $('.hero'), heroL = $('.hero-in>div'), hvEl = $('#hv'), stampEl = $('.fdr-ph .stamp'), mq = $('.mq-track');
const isLight = e => e && e.classList && e.classList.contains('light');
const SX = $$('main > section.light').map(s => ({ el: s, a: (!s.previousElementSibling || isLight(s.previousElementSibling)) ? 0 : 1, b: isLight(s.nextElementSibling) ? 0 : 1, last: '' })).filter(o => o.a || o.b);
let vh = innerHeight, vw = innerWidth, lastS = scrollY, vel = 0, mqx = 0, mqHalf = 0;
const mqm = () => { mqHalf = mq ? mq.scrollWidth / 2 : 0; };
addEventListener('resize', () => { vh = innerHeight; vw = innerWidth; mqm(); }); document.fonts && document.fonts.ready.then(mqm); mqm();
if (motion) {
  if (mq) root.classList.add('js-mq');
  const tick = () => {
    const y = scrollY; vel += ((y - lastS) - vel) * .18; lastS = y;
    if (heroS && heroL && hvEl) { const hh = heroS.offsetHeight; if (y < hh + 50) { const p = Math.min(1, Math.max(0, y / hh)); heroL.style.translate = `0 ${(p * 150).toFixed(1)}px`; heroL.style.opacity = (1 - p * 1.15).toFixed(3); hvEl.style.translate = `0 ${(p * -60).toFixed(1)}px`; hvEl.style.scale = (1 - p * .07).toFixed(4); } }
    vis.forEach(par => { const r = par.getBoundingClientRect(); const c = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); par._img.style.setProperty('--py', (-c * r.height * .065).toFixed(1) + 'px'); });
    SX.forEach(o => { const r = o.el.getBoundingClientRect(); if (r.bottom < -80 || r.top > vh + 80) return; let f = 1; if (o.a) f = Math.min(f, (vh - r.top) / (vh * .55)); if (o.b) f = Math.min(f, r.bottom / (vh * .55)); f = Math.max(0, Math.min(1, f)); const e = 1 - Math.pow(1 - f, 2); const side = (1 - e) * Math.min(64, vw * .045), rad = (1 - e) * 56; const v = f >= 1 ? 'none' : `inset(0 ${side.toFixed(1)}px 0 ${side.toFixed(1)}px round ${rad.toFixed(1)}px)`; if (v !== o.last) { o.el.style.clipPath = v; o.last = v; } });
    if (mq && mqHalf) { const sp = .55 + Math.min(14, Math.abs(vel)) * .4; mqx -= sp * (vel < -.6 ? -1 : 1); if (mqx < -mqHalf) mqx += mqHalf; if (mqx > 0) mqx -= mqHalf; const sk = Math.max(-7, Math.min(7, vel * .3)); mq.style.transform = `translate3d(${mqx.toFixed(1)}px,0,0) skewX(${(-sk).toFixed(2)}deg)`; }
    if (stampEl) stampEl.style.rotate = (y * .12 % 360).toFixed(1) + 'deg';
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ===================== boot ===================== */
const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
if (PAGE === 'home') { const h = decodeURIComponent(location.hash.slice(1)); const p = h && (D.products.find(q => q.slug === h || q.id === h)); if (p) setTimeout(() => openProduct(p.id, false), 600); }
})();
