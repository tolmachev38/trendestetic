/*!
 * Trend Esthetic — рендерер статического сайта из content.json.
 * Используется и админкой (в браузере), и сборкой (Node: tools/build.mjs).
 * renderAll(content) → { 'путь/файл': 'текст', ... }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TERender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = '4.0';

  /* ---------------- helpers ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const nbsp = '\u00a0';
  const fmt = n => { const s = String(Math.round(+n)); return s.replace(/\B(?=(\d{3})+(?!\d))/g, nbsp); };
  const isNum = v => v !== null && v !== undefined && v !== '' && !isNaN(+v);
  const rub = n => isNum(n) ? fmt(n) + nbsp + '₽' : 'По запросу';
  const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10; if (n > 10 && n < 20) return c; if (d > 1 && d < 5) return b; if (d === 1) return a; return c; };
  const pad = n => String(n).padStart(2, '0');
  const arr = v => Array.isArray(v) ? v : [];
  const cut = (s, n) => { s = strip(s); return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:—–-]+\S*$/, '') + '…' : s; };
  const telHref = t => 'tel:' + String(t || '').replace(/[^\d+]/g, '');

  function siteUrl(c) { let u = (c.site && c.site.url) || '/'; if (!u.endsWith('/')) u += '/'; return u; }
  function sitePath(c) { try { return new URL(siteUrl(c)).pathname; } catch (e) { return '/'; } }
  const IMG = (base, f) => !f ? '' : /^(https?:|data:|blob:)/.test(f) ? f : base + 'assets/img/' + f;
  const ABS = (c, rel) => /^https?:/.test(rel) ? rel : siteUrl(c) + rel.replace(/^\.?\//, '');

  function ctxOf(c) {
    const products = arr(c.products).filter(p => !p.hidden);
    const priced = products.filter(p => isNum(p.price)).map(p => +p.price);
    const count = products.length, min = priced.length ? Math.min(...priced) : 0, max = priced.length ? Math.max(...priced) : 0;
    const cats = arr(c.catalog && c.catalog.categories);
    const catBy = {}; cats.forEach(k => catBy[k.key] = k);
    return { products, count, countWord: plural(count, 'аппарат', 'аппарата', 'аппаратов'), minPrice: rub(min), maxPrice: rub(max), min, max, cats, catBy, byId: id => products.find(p => p.id === id) || arr(c.products).find(p => p.id === id) };
  }
  const tok = (s, x) => String(s == null ? '' : s).replace(/\{count\}/g, x.count).replace(/\{countWord\}/g, x.countWord).replace(/\{minPrice\}/g, x.minPrice).replace(/\{maxPrice\}/g, x.maxPrice);
  const H = (t, a, x) => `${tok(t, x)}${a ? ` <span>${tok(a, x)}</span>` : ''}`;

  /* ---------------- icons ---------------- */
  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-arrow-ur" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></symbol>
<symbol id="i-l" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></symbol>
<symbol id="i-r" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></symbol>
<symbol id="i-tg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4 3 11l6.5 2.5L18 7l-6 7.5L17.5 20 21 4Z"/><path d="M9.5 13.5V19l3-3"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 10h8M8 13h5"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h12v10H2zM14 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></symbol>
<symbol id="i-card" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></symbol>
<symbol id="i-grad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></symbol>
<symbol id="i-cert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="m9 14-2 7 5-2.5 5 2.5-2-7"/><path d="m9.5 9 1.8 1.8L15 7.5"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></symbol>
<symbol id="i-box" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.3-4 4.4-6 8-6s6.7 2 8 6"/></symbol>
<symbol id="i-move" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V8l6-3 6 3v8l-6 3-6-3Z"/><path d="M15 10h4l2 3v3h-6"/></symbol>
<symbol id="i-flow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></symbol>
<symbol id="i-map" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></symbol>
<symbol id="i-sound" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></symbol>
<symbol id="i-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="m17 9 5 6M22 9l-5 6"/></symbol>
</svg>`;
  const ico = (n, cls) => n ? `<svg${cls ? ` class="${cls}"` : ''}><use href="#i-${n}"/></svg>` : '';

  /* ---------------- head ---------------- */
  function themeCss(t) {
    if (!t) return '';
    const m = { ink: '--ink', ink2: '--ink2', ink3: '--ink3', ink4: '--ink4', paper: '--paper', paper2: '--paper2', paper3: '--paper3', brassLight: '--h1', brass: '--h2', brassDark: '--h3', emerald: '--em', emeraldLight: '--em2', cool: '--cool', textOnDark: '--tx-d', mutedOnDark: '--mu-d', textOnLight: '--tx-l', mutedOnLight: '--mu-l' };
    let s = ''; for (const k in m) if (t[k]) s += `${m[k]}:${t[k]};`;
    if (t.brassLight && t.brass && t.brassDark) s += `--spectral:linear-gradient(100deg,#F1E8D0 0%,${t.brassLight} 18%,${t.brass} 60%,${t.brassDark} 100%);`;
    return s ? `<style id="theme">:root{${s}}</style>` : '';
  }
  function analytics(c) {
    const a = c.analytics || {}; let h = '';
    if (a.yandexVerification) h += `<meta name="yandex-verification" content="${esc(a.yandexVerification)}">`;
    if (a.googleVerification) h += `<meta name="google-site-verification" content="${esc(a.googleVerification)}">`;
    if (a.bingVerification) h += `<meta name="msvalidate.01" content="${esc(a.bingVerification)}">`;
    if (a.yandexMetrikaId) { const id = esc(a.yandexMetrikaId).replace(/\D/g, ''); h += `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});window.TE_YM=${id};</script><noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute;left:-9999px" alt=""></div></noscript>`; }
    if (a.googleAnalyticsId) { const g = esc(a.googleAnalyticsId); h += `<script async src="https://www.googletagmanager.com/gtag/js?id=${g}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${g}');</script>`; }
    return h;
  }
  function head(c, x, pg) {
    const s = c.seo || {}, url = siteUrl(c) + pg.path, ver = esc((c.meta && c.meta.updated || '').replace(/\D/g, '').slice(0, 12) || VERSION);
    const title = esc(pg.title), desc = esc(pg.description);
    const ogImg = ABS(c, 'assets/img/' + (pg.image || s.ogImage || 'og-image.jpg'));
    const geo = c.company && c.company.geo || {};
    return `<!DOCTYPE html>
<html lang="ru" data-base="${pg.base}" data-page="${pg.kind}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
${s.keywords && pg.kind === 'home' ? `<meta name="keywords" content="${esc(s.keywords)}">\n` : ''}<meta name="robots" content="${pg.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="${esc((c.site && c.site.themeColor) || '#04120E')}">
<meta name="format-detection" content="telephone=no">
<meta name="geo.region" content="${esc(s.geoRegion || 'RU-IRK')}">
<meta name="geo.placename" content="${esc(s.city || 'Иркутск')}">
${geo.lat ? `<meta name="geo.position" content="${geo.lat};${geo.lng}"><meta name="ICBM" content="${geo.lat}, ${geo.lng}">\n` : ''}<meta property="og:type" content="${pg.ogType || 'website'}">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="${esc(c.site && c.site.name)}">
<meta property="og:title" content="${esc(pg.ogTitle || pg.title)}">
<meta property="og:description" content="${esc(pg.ogDescription || pg.description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:image:alt" content="${esc(pg.ogTitle || pg.title)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${pg.base}assets/icons/favicon.ico" sizes="any">
<link rel="icon" href="${pg.base}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${pg.base}assets/icons/apple-touch-icon.png">
<link rel="manifest" href="${pg.base}manifest.webmanifest">
<link rel="sitemap" type="application/xml" href="${pg.base}sitemap.xml">
<link rel="alternate" type="text/plain" title="LLM summary" href="${pg.base}llms.txt">
<link rel="preload" href="${pg.base}assets/fonts/unbounded-cyr.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${pg.base}assets/fonts/manrope-cyr.woff2" as="font" type="font/woff2" crossorigin>
${pg.preload ? `<link rel="preload" as="image" href="${esc(pg.preload)}" fetchpriority="high">\n` : ''}<link rel="stylesheet" href="${pg.base}assets/css/site.css?v=${ver}">
${themeCss(c.theme)}${c.site && c.site.customCss ? `<style id="custom-css">${c.site.customCss}</style>` : ''}
${analytics(c)}${pg.jsonld && pg.jsonld.length ? `<script type="application/ld+json">${JSON.stringify(pg.jsonld.length === 1 ? pg.jsonld[0] : { '@context': 'https://schema.org', '@graph': pg.jsonld.map(o => { const r = Object.assign({}, o); delete r['@context']; return r; }) }).replace(/</g, '\\u003c')}</script>` : ''}
${c.site && c.site.customHead || ''}
</head>`;
  }

  /* ---------------- shared chrome ---------------- */
  const link = (href, base, home) => (href && href[0] === '#' && !home) ? (base || './') + href : href;
  const ext = h => /^https?:/.test(h) ? ' target="_blank" rel="noopener"' : '';
  function chrome_top(c, x, base, home) {
    const hd = c.header || {}, co = c.company || {}, ph = co.phone || {}, it = (c.site && c.site.intro) || {};
    const word = String(it.word || '').split('').map((ch, i) => ch === ' ' ? '<span>&nbsp;</span>' : `<span style="--i:${i}">${esc(ch)}</span>`).join('');
    return `<body class="no-js">
<script>document.body.classList.remove('no-js');document.body.classList.add('js')</script>
<a class="skip" href="#main">К основному содержанию</a>
${it.enabled !== false ? `<div class="intro" id="intro" aria-hidden="true"><div class="intro-in"><span class="intro-mark"></span><span class="intro-word">${word}</span><span class="intro-bar"><i></i></span><small>${esc(it.caption)}</small></div></div>` : ''}
<div class="cur" id="cur" aria-hidden="true"><i class="cur-dot"></i><i class="cur-ring"><b id="curT"></b></i></div>
<div class="progress" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
${SPRITE}
<header class="hdr" id="hdr">
  <div class="ubar"><div class="wrap ubar-in"><span>${esc(hd.ubarLeft)}</span><span class="ubar-r">${arr(hd.ubarItems).map(t => `<span>${esc(t)}</span>`).join('')}${hd.ubarLinkUrl ? `<a href="${esc(hd.ubarLinkUrl)}"${ext(hd.ubarLinkUrl)}>${esc(hd.ubarLinkText)}</a>` : ''}</span></div></div>
  <div class="wrap hdr-in">
    <a class="brand" href="${home ? '#top' : (base || './')}" aria-label="${esc(c.site && c.site.name)} — на главную">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-txt"><b>${esc(String(c.site && c.site.name || '').toUpperCase())}</b><small>${esc(c.site && c.site.brandSub)}</small></span>
    </a>
    <nav class="nav" aria-label="Основная навигация">
      ${arr(hd.nav).map(n => `<a href="${esc(link(n.href, base, home))}"${ext(n.href)}>${esc(n.label)}</a>`).join('\n      ')}
    </nav>
    <div class="hdr-cta">
      <a class="hdr-phone" href="${telHref(ph.tel)}">${esc(ph.display)}</a>
      <button class="btn btn-fire magnet" data-quiz type="button">${esc(hd.cta)}</button>
      <button class="burger" id="burger" type="button" aria-label="Открыть меню" aria-expanded="false" aria-controls="mnav"><i></i></button>
    </div>
  </div>
</header>
<nav class="mnav" id="mnav" aria-label="Мобильное меню" data-lenis-prevent>
  ${arr(hd.mobileNav).map(n => `<a href="${esc(link(n.href, base, home))}"${ext(n.href)}>${esc(n.label)} <span>${esc(tok(n.num, x))}</span></a>`).join('\n  ')}
  <div class="mnav-foot">
    <button class="btn btn-fire" data-quiz type="button">${esc(hd.cta)} ${ico('arrow')}</button>
    <a class="btn btn-ghost" href="${telHref(ph.tel)}">${ico('phone', 'ico')}${esc(ph.display)}</a>
  </div>
</nav>
`;
  }

  function footer(c, x, base, home) {
    const f = c.footer || {}, co = c.company || {}, l = co.links || {}, ph = co.phone || {}, ph2 = co.phone2 || {}, ad = co.address || {};
    const ld = c.lead || {};
    return `<footer class="ftr">
  <div class="wrap">
    <div class="ftr-top">
      <div>
        <div class="ftr-logo" role="img" aria-label="Логотип: ${esc(co.legalName)}"></div>
        <p>${esc(f.about)}</p>
      </div>
      <div>
        <h4>Каталог</h4>
        <ul>
          ${x.cats.map(k => `<li><a href="${base}katalog/${esc(k.slug)}/">${esc(k.name || k.label)}</a></li>`).join('\n          ')}
        </ul>
      </div>
      <div>
        <h4>Компания</h4>
        <ul>
          ${arr(f.companyLinks).map(n => `<li><a href="${esc(link(n.href, base, home))}"${ext(n.href)}>${esc(n.label)}</a></li>`).join('\n          ')}
        </ul>
      </div>
      <div>
        <h4>Контакты</h4>
        <ul>
          <li><a href="${telHref(ph.tel)}">${esc(ph.display)}</a></li>
          ${ph2.display ? `<li><a href="${telHref(ph2.tel)}">${esc(ph2.display)}</a></li>` : ''}
          ${co.email ? `<li><a href="mailto:${esc(co.email)}">${esc(co.email)}</a></li>` : ''}
          <li><a href="${esc(l.twogis || l.yandexMaps || '#')}" target="_blank" rel="noopener">${esc(ad.city)}, ${esc(ad.street)}</a></li>
          <li>${[l.telegram && `<a href="${esc(l.telegram)}" target="_blank" rel="noopener">Telegram</a>`, l.max && `<a href="${esc(l.max)}" target="_blank" rel="noopener">MAX</a>`, l.instagram && `<a href="${esc(l.instagram)}" target="_blank" rel="noopener">Instagram*</a>`].filter(Boolean).join(' · ')}</li>
        </ul>
        <p style="margin-top:14px">${esc(co.hours && co.hours.text)}</p>
      </div>
    </div>
    <div class="ftr-big" aria-hidden="true">${esc(f.bigWord)}</div>
    <div class="ftr-bot">
      <div>© <span id="yr">${new Date().getFullYear()}</span> ${esc(c.site && c.site.name)} × ${esc(co.legalName)} · ${esc(ad.city)}<br><span class="req">${esc(co.legalForm)} · ИНН ${esc(co.inn)} · ОГРНИП ${esc(co.ogrnip)}</span></div>
      <div>${esc(f.disclaimer)}${l.instagram ? `<br>${esc(f.instagramNote)}` : ''}</div>
      <div>${c.site && c.site.creditText ? `<a href="${esc(c.site.creditUrl || '#')}" target="_blank" rel="noopener">${esc(c.site.creditText)}</a>` : ''}</div>
    </div>
  </div>
</footer>

<div class="dock" id="dock">
  <a class="round" href="${telHref(ph.tel)}" aria-label="Позвонить">${ico('phone')}</a>
  ${l.telegram ? `<a class="round" href="${esc(l.telegram)}" target="_blank" rel="noopener" aria-label="Telegram">${ico('tg')}</a>` : ''}
  <button class="btn btn-fire" type="button" data-quiz>${esc(c.header && c.header.cta)}</button>
</div>
${musicBtn(c)}
<dialog class="sheet" id="pm" aria-labelledby="pmN" data-lenis-prevent>
  <div class="sheet-in">
    <div class="pm-gal">
      <div class="pm-main" id="pmMain"><img id="pmImg" alt=""></div>
      <div class="pm-th" id="pmTh"></div>
    </div>
    <div class="pm-body">
      <button class="x" type="button" data-close aria-label="Закрыть">${ico('x')}</button>
      <div class="pm-k" id="pmK"></div>
      <h3 class="pm-n" id="pmN"></h3>
      <div class="pm-price"><b id="pmP"></b><span id="pmPs"></span></div>
      <div class="pm-note">${arr(c.catalog && c.catalog.sheetNotes).map((t, i) => `<span>${ico(['truck', 'card', 'doc', 'grad', 'shield', 'cert'][i % 6])}${esc(t)}</span>`).join('')}</div>
      <p class="pm-lead" id="pmL"></p>
      <a class="pm-page" id="pmPage" href="#">Страница аппарата: фото, описание, характеристики ${ico('arrow-ur')}</a>
      <div id="pmF"></div>
      <div id="pmS"></div>
      <div class="pm-cta">
        <button class="btn btn-fire" type="button" id="pmLead">Получить предложение ${ico('arrow')}</button>
        <a class="btn btn-ghost pm-call" href="${telHref(ph.tel)}" aria-label="Позвонить">${ico('phone', 'ico')}<span>Позвонить</span></a>
      </div>
    </div>
  </div>
</dialog>
<dialog class="lb" id="lb" aria-label="Просмотр фото" data-lenis-prevent>
  <div class="lb-top"><span id="lbN">1 / 1</span><button class="x" type="button" data-close aria-label="Закрыть">${ico('x')}</button></div>
  <div class="lb-fig" id="lbFig"><img id="lbImg" alt=""></div>
  <div class="lb-bot"><p id="lbC"></p><div style="display:flex;gap:10px"><button class="round" type="button" id="lbP" aria-label="Предыдущее фото">${ico('l')}</button><button class="round" type="button" id="lbX" aria-label="Следующее фото">${ico('r')}</button></div></div>
</dialog>
<dialog class="quiz" id="qz" aria-labelledby="qzH" data-lenis-prevent>
  <div class="qz">
    <button class="x" type="button" data-close aria-label="Закрыть">${ico('x')}</button>
    <div class="qz-bar"><i id="qzBar"></i></div>
    <div id="qzBody"></div>
  </div>
</dialog>
<div class="toast" id="toast" role="status"></div>
<script src="${base}assets/js/data.js?v=${esc((c.meta && c.meta.updated || '').replace(/\D/g, '').slice(0, 12))}" defer></script>
<script src="${base}assets/js/lenis.min.js" defer></script>
<script src="${base}assets/js/site.js?v=${esc((c.meta && c.meta.updated || '').replace(/\D/g, '').slice(0, 12))}" defer></script>
${c.site && c.site.customBodyEnd || ''}
</body>
</html>
`;
  }

  function musicBtn(c) {
    const m = c.music || {};
    if (!m.enabled || !m.file) return '';
    return `<button class="snd" id="snd" type="button" aria-pressed="false" aria-label="Включить музыку" title="${esc(m.title || 'Музыка')}"><span class="snd-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><svg class="snd-on"><use href="#i-sound"/></svg><svg class="snd-off"><use href="#i-mute"/></svg><span class="snd-t">${esc(m.title || '')}</span></button>`;
  }

  /* ---------------- cards ---------------- */
  function badge(b) { const t = b.type === 'f' ? 'f' : b.type === 'live' ? 'live' : 'l'; return `<span class="badge ${t}">${t === 'live' ? '<i></i>' : ''}${esc(b.text)}</span>`; }
  function card(p, x, base, i) {
    const cat = x.catBy[p.cat] || {};
    return `<a class="card" href="${base}apparaty/${esc(p.slug)}/" data-open="${esc(p.id)}" data-cat="${esc(p.cat)}" data-price="${isNum(p.price) ? +p.price : ''}" data-idx="${i}" data-cursor="Открыть">
  <div class="stage ${p.fit === 'contain' ? 'contain' : 'cover'}"><img src="${IMG(base, p.img)}" alt="${esc(p.imgAlt || p.name + ' — ' + p.kind)}" loading="lazy" decoding="async"${p.pos ? ` style="object-position:${esc(p.pos)}"` : ''}><div class="badges">${arr(p.badges).map(badge).join('')}</div><span class="card-no">№${nbsp}${pad(i + 1)}</span></div>
  <div class="card-b"><span class="card-k">${esc(cat.label || '')} · ${esc(p.kind)}</span><h3 class="card-n">${esc(p.name)}</h3><div class="card-c">${arr(p.chips).map(t => `<span>${esc(t)}</span>`).join('')}</div>
  <div class="card-f"><span class="price${isNum(p.price) ? '' : ' q'}">${rub(p.price)}</span><span class="round" aria-hidden="true">${ico('arrow-ur')}</span></div></div></a>`;
  }

  /* ---------------- home sections ---------------- */
  const S = {};
  S.hero = (c, x, b) => {
    const h = c.hero || {}, p = x.byId(h.cardProduct);
    return `<section class="hero spot" id="top" aria-labelledby="h1">
  <div class="hero-bg" aria-hidden="true"><div class="glow"></div><div class="grid"></div></div>
  <div class="wrap">
    <div class="hero-in">
      <div>
        <h1 class="h1" id="h1">
          <span class="kicker fade-up"><i></i>${esc(h.seoLine)}</span>
          ${arr(h.titleLines).map(t => `<span class="ln"><span>${esc(t)}</span></span>`).join('\n          ')}
          ${h.titleAccent ? `<span class="ln"><span><em class="spectral">${esc(h.titleAccent)}</em></span></span>` : ''}
        </h1>
        <p class="hero-lead fade-up d1">${tok(h.lead, x)}</p>
        <div class="hero-ctas fade-up d2">
          <button class="btn btn-fire magnet" data-quiz type="button">${esc(h.ctaPrimary)} ${ico('arrow')}</button>
          <a class="btn btn-ghost" href="#catalog">${esc(h.ctaSecondary)}</a>
        </div>
        ${h.quote ? `<p class="hero-quote fade-up d3">${esc(h.quote)}</p>` : ''}
      </div>
      <div class="hv" id="hv">
        <div class="ring" aria-hidden="true"></div><div class="ring r2" aria-hidden="true"></div>
        <div class="hv-main">
          <img id="heroImg" src="${IMG(b, h.image)}" alt="${esc(h.imageAlt)}" width="1000" height="1334" fetchpriority="high" decoding="async">
          <div class="scan" aria-hidden="true"></div>
          ${h.chip ? `<span class="chip-glass c1"><i></i>${esc(h.chip)}</span>` : ''}
          ${arr(h.wavelengths).length ? `<div class="wl" aria-label="Длины волны лазера">${arr(h.wavelengths).map(w => `<span>${esc(w)}</span>`).join('')}</div>` : ''}
          ${p ? `<a class="hv-card" href="${b}apparaty/${esc(p.slug)}/" data-open="${esc(p.id)}">
            <div><small>${esc(h.cardLabel || p.kind)}</small><b>${esc(p.name)}</b></div>
            <div class="pr"><small>цена</small>${rub(p.price)}</div>
          </a>` : ''}
        </div>
        ${h.subImage ? `<div class="hv-sub" aria-hidden="true"><img src="${IMG(b, h.subImage)}" alt="" loading="lazy" decoding="async"></div>` : ''}
        <i class="cn" aria-hidden="true"></i>
        <div class="hv-spec" aria-hidden="true">${arr(h.spec).map(t => `<span>${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    <div class="hero-stats fade-up d4">
      ${arr(h.stats).map(s => { const v = tok(s.value, x); return `<div><b>${s.countUp && isNum(v) ? `<span data-count="${esc(v)}">${esc(v)}</span>` : esc(v)}${esc(s.suffix || '')}</b><span>${esc(tok(s.text, x))}</span></div>`; }).join('\n      ')}
    </div>
  </div>
</section>`;
  };
  S.marquee = (c) => { const m = arr(c.marquee); if (!m.length) return ''; const row = m.map(t => `<span>${esc(t)}</span>`).join(''); return `<div class="marquee" aria-hidden="true"><div class="mq-track">${row}${row}</div></div>`; };
  const head2 = (o, id, x, split = true) => split ? `<div class="sec-head split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow" data-r>${esc(o.eyebrow)}</span>
        <h2 class="h2" id="${id}" data-r style="--d:1">${H(esc(o.title), esc(o.accent), x)}</h2>
      </div>
      <p class="lead" data-r style="--d:2">${tok(o.lead, x)}</p>
    </div>` : '';
  S.market = (c, x) => {
    const m = c.market || {};
    return `<section class="sec light" id="market" aria-labelledby="mk-h">
  <div class="wrap">
    <div class="intro-grid">
      <div class="sec-head" style="margin:0">
        <span class="eyebrow" data-r>${esc(m.eyebrow)}</span>
        <h2 class="h2" id="mk-h" data-r style="--d:1">${H(esc(m.title), esc(m.accent), x)}</h2>
      </div>
      <p class="lead" data-r style="--d:2">${tok(m.lead, x)}</p>
    </div>
    <div class="stats4">
      ${arr(m.stats).map((s, i) => `<article class="stat" data-r data-in style="--d:${i}"><span class="k">${esc(s.k)}</span><span class="n">${esc(s.n)}</span><p>${s.text}</p></article>`).join('\n      ')}
    </div>
    ${m.footnote ? `<p class="foot-note">${esc(m.footnote)}</p>` : ''}
  </div>
</section>`;
  };
  S.route = (c, x, b) => {
    const r = c.route || {};
    return `<section class="sec route-sec spot" id="path" aria-labelledby="pt-h">
  <div class="wrap">
    ${head2(r, 'pt-h', x)}
    <div class="route" id="route">
      <div class="route-line" aria-hidden="true"><i></i><b class="cargo">${ico('box')}</b></div>
      <ol class="route-st">
        ${arr(r.steps).map(s => `<li><span class="dot"></span><span class="code">${esc(s.code)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('\n        ')}
      </ol>
    </div>
    <div class="route-proof">
      ${arr(r.proof).map((p, i) => `<figure data-lb="proof" data-i="${i}" data-r style="--d:${i}"><img src="${IMG(b, p.img)}" alt="${esc(p.alt || p.caption)}" loading="lazy" decoding="async"><figcaption>${esc(p.caption)}</figcaption></figure>`).join('\n      ')}
      <div class="doc" data-r style="--d:3">
        <span class="seal">${ico('cert', 'ico')}</span>
        <div><b>${esc(r.docTitle)}</b>
          <ul>${arr(r.docItems).map(t => `<li>${ico('check')}${esc(t)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
  </div>
</section>`;
  };
  const TECH_SVG = `<svg viewBox="0 0 560 520" role="img" aria-label="Схема: диодный лазер нагревает волосяные фолликулы в коже">
            <defs>
              <linearGradient id="gBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9A15E" stop-opacity=".95"/><stop offset=".55" stop-color="#C9A15E" stop-opacity=".35"/><stop offset="1" stop-color="#3C8A72" stop-opacity="0"/></linearGradient>
              <radialGradient id="gHalo"><stop offset="0" stop-color="#F6E2B0" stop-opacity=".95"/><stop offset=".45" stop-color="#C9A15E" stop-opacity=".55"/><stop offset="1" stop-color="#C9A15E" stop-opacity="0"/></radialGradient>
              <linearGradient id="gBeamIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9A15E" stop-opacity=".7"/><stop offset="1" stop-color="#C9A15E" stop-opacity="0"/></linearGradient>
              <linearGradient id="gEpi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7B39C"/><stop offset="1" stop-color="#D99E86"/></linearGradient>
              <linearGradient id="gDer" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EBC5B2"/><stop offset="1" stop-color="#E6BBA6"/></linearGradient>
              <linearGradient id="gHyp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1DDBF"/><stop offset="1" stop-color="#EAD2AE"/></linearGradient>
              <linearGradient id="gWin" x1="0" x2="1"><stop offset="0" stop-color="#6AA795" stop-opacity=".4"/><stop offset=".5" stop-color="#CFE0D8"/><stop offset="1" stop-color="#6AA795" stop-opacity=".4"/></linearGradient>
              <clipPath id="cSkin"><rect x="20" y="150" width="520" height="350" rx="22"/></clipPath>
            </defs>
            <g><rect x="120" y="34" width="320" height="58" rx="18" fill="#0E3125" stroke="rgba(207,224,216,.12)"/><rect x="150" y="50" width="70" height="8" rx="4" fill="#1A5341"/><circle cx="410" cy="63" r="6" fill="#C9A15E"/><rect class="cool" x="140" y="88" width="280" height="10" rx="5" fill="url(#gWin)"/><text x="280" y="22" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#98B2A5" letter-spacing="1.5">САПФИРОВОЕ ОКНО · ОХЛАЖДЕНИЕ</text></g>
            <g class="beam"><polygon class="beam-pulse" points="140,98 420,98 427,150 133,150" fill="#C9A15E" opacity=".9"/></g>
            <g class="wave" stroke="#E9D3A1" stroke-width="1.6" fill="none" opacity=".9"><path d="M180 108 q8 8 0 16 q-8 8 0 16 q8 8 0 16"/><path d="M280 108 q8 8 0 16 q-8 8 0 16 q8 8 0 16"/><path d="M380 108 q8 8 0 16 q-8 8 0 16 q8 8 0 16"/></g>
            <g clip-path="url(#cSkin)">
              <rect x="20" y="150" width="520" height="40" fill="url(#gEpi)"/><rect x="20" y="190" width="520" height="210" fill="url(#gDer)"/><rect x="20" y="400" width="520" height="100" fill="url(#gHyp)"/>
              <g fill="none" stroke="#E2C59C" stroke-width="1.5" opacity=".9"><circle cx="60" cy="440" r="20"/><circle cx="104" cy="462" r="18"/><circle cx="210" cy="448" r="22"/><circle cx="252" cy="476" r="16"/><circle cx="340" cy="446" r="20"/><circle cx="386" cy="470" r="18"/><circle cx="490" cy="448" r="22"/><circle cx="150" cy="486" r="14"/><circle cx="446" cy="486" r="14"/></g>
              <g class="beam"><polygon class="beam-pulse" points="133,150 427,150 470,470 90,470" fill="url(#gBeamIn)"/></g>
              <path d="M20 190 C120 196 200 184 280 190 S440 196 540 188" stroke="#CF9179" stroke-width="1" fill="none" opacity=".6"/>
              <g stroke="#E39A9A" stroke-width="2" fill="none" opacity=".35"><path d="M20 300 C90 290 120 320 200 306 S330 290 360 312 470 300 540 296"/></g>
              ${[[150, 'C0 120 -6 96 -16 72', [200, 260, 320]], [280, 'C0 118 8 92 20 70', [215, 275, 322]], [410, 'C0 122 -4 100 -12 76', [205, 268, 318]]].map(([tx, cv, m]) => `<g transform="translate(${tx} 0)"><path d="M-12 150 C-12 220 -16 290 -20 330 C-22 362 22 362 20 330 C16 290 12 220 12 150 Z" fill="#D9A08A" opacity=".9"/><circle class="halo" cx="0" cy="340" r="44" fill="url(#gHalo)"/><circle class="bulge" cx="14" cy="248" r="6" fill="#B98F86"/><path class="hair" d="M0 345 L0 150 ${cv}" stroke="#3A2A22" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse class="bulb" cx="0" cy="340" rx="18" ry="22" fill="#5E3527"/><ellipse cx="0" cy="352" rx="7" ry="8" fill="#E68C8C"/><g class="mel" fill="#E9D3A1"><circle cx="0" cy="${m[0]}" r="3"/><circle cx="0" cy="${m[1]}" r="3"/><circle cx="0" cy="${m[2]}" r="3.5"/></g></g>`).join('')}
              <g font-family="JetBrains Mono, monospace" font-size="10.5" fill="#6B4A3E" letter-spacing="1"><text x="34" y="174">ЭПИДЕРМИС</text><text x="34" y="214">ДЕРМА</text><text x="34" y="420">ГИПОДЕРМА</text></g>
            </g>
            <g class="ok"><rect x="170" y="222" width="220" height="74" rx="24" fill="#04120E" opacity=".9"/><text x="280" y="256" text-anchor="middle" font-family="Unbounded, sans-serif" font-size="22" fill="#fff" font-weight="500">80–100%</text><text x="280" y="280" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#E9D3A1" letter-spacing="1.5">ВОЛОС УХОДИТ</text></g>
          </svg>`;
  S.tech = (c, x, b) => {
    const t = c.tech || {}, st = arr(t.steps), pts = arr(t.phototypes), pr = arr(t.progress), mid = Math.min(2, pts.length - 1);
    const p0 = pts[mid] || {};
    return `<section class="sec tech spot" id="tech" aria-labelledby="tc-h">
  <div class="wrap">
    <div class="sec-head">
      <span class="eyebrow" data-r>${esc(t.eyebrow)}</span>
      <h2 class="h2" id="tc-h" data-r style="--d:1">${H(esc(t.title), esc(t.accent), x)}</h2>
      <p class="lead" data-r style="--d:2">${tok(t.lead, x)}</p>
    </div>
    <div class="story">
      <div class="story-vis">
        <div class="sv" id="sv" data-s="1">
          <span class="sv-tag" id="svTag">${esc(st[0] && st[0].tag)}</span>
          ${TECH_SVG}
          <div class="hud" aria-live="polite">
            <div class="hot"><small>Фолликул</small><b><span id="tF">${esc(st[0] && st[0].follicle)}</span>°C</b><i id="bF" style="--w:30%"></i></div>
            <div class="cold"><small>Кожа</small><b><span id="tS">${esc(st[0] && st[0].skin)}</span>°C</b><i id="bS" style="--w:25%"></i></div>
          </div>
        </div>
      </div>
      <div class="steps-t" id="steps">
        ${st.map((s, i) => `<div class="st${i ? '' : ' on'}" data-s="${i + 1}"><span class="n">ШАГ ${pad(i + 1)}</span><h3>${esc(s.title)}</h3><p>${s.text}</p></div>`).join('\n        ')}
      </div>
    </div>

    <div class="ptype">
      <div>
        <span class="eyebrow" data-r>${esc(t.ptEyebrow)}</span>
        <h3 class="h3" data-r style="--d:1;margin-top:20px">${H(esc(t.ptTitle), esc(t.ptAccent), x)}</h3>
        <p class="lead" data-r style="--d:2;margin-top:18px">${tok(t.ptLead, x)}</p>
        <div class="pt-btns" role="group" aria-label="Фототип кожи" id="ptBtns">${pts.map((p, i) => `<button class="pt-btn${i > 2 ? ' dk' : ''}" type="button" style="--c:${esc(p.color)}" aria-pressed="${i === mid}" data-i="${i}" aria-label="${esc(p.title)}">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][i] || i + 1}</button>`).join('')}</div>
      </div>
      <div class="pt-card" data-r style="--d:1">
        <h4 id="ptTitle">${esc(p0.title)}</h4>
        <p class="sub" id="ptSub">${esc(p0.sub)}</p>
        <div class="spec-bar" aria-hidden="true">
          <div class="track"></div>
          <div class="tick" data-w="755" style="left:13.75%"><b>755</b><i></i></div>
          <div class="tick" data-w="808" style="left:27%"><b>808</b><i></i></div>
          <div class="tick" data-w="1064" style="left:91%"><b>1064</b><i></i></div>
          <div class="scale"><span>700 нм</span><span>900 нм</span><span>1100 нм</span></div>
        </div>
        <p class="pt-text" id="ptText">${p0.text || ''}</p>
        <div class="facts">${arr(t.facts).map(f => `<div><b>${esc(f.b)}</b><span>${esc(f.s)}</span></div>`).join('')}</div>
      </div>
    </div>

    <div class="results">
      <div>
        <span class="eyebrow" data-r>${esc(t.resEyebrow)}</span>
        <h3 class="h3" data-r style="--d:1;margin-top:20px">${H(esc(t.resTitle), esc(t.resAccent), x)}</h3>
        <p class="lead" data-r style="--d:2;margin-top:18px">${tok(t.resLead, x)}</p>
        <div class="ba" data-r style="--d:2;margin-top:30px">
          ${[t.before, t.after].filter(Boolean).map((o, i) => `<figure><img src="${IMG(b, o.img)}" alt="${esc(o.alt)}" loading="lazy" decoding="async"><figcaption class="badge ${i ? 'f' : 'l'}">${esc(o.label)}</figcaption></figure>`).join('')}
        </div>
      </div>
      ${pr.length ? `<div class="prog" data-r style="--d:1">
        <div class="prog-stage" id="progStage">${pr.map((p, i) => `<img src="${IMG(b, p.img)}" alt="${esc(p.label)}" loading="lazy" decoding="async"${i ? '' : ' class="on"'}>`).join('')}</div>
        <div class="prog-lbl"><b id="progLbl">${esc(pr[0].label)}</b><span id="progN">1 / ${pr.length}</span></div>
        <input class="rng" type="range" min="1" max="${pr.length}" step="1" value="1" id="progR" aria-label="Этап курса">
        <div class="dots" aria-hidden="true">${pr.map((p, i) => `<span>${i + 1}</span>`).join('')}</div>
      </div>` : ''}
    </div>
  </div>
</section>`;
  };
  S.catalog = (c, x, b) => {
    const k = c.catalog || {}, cmp = k.compare || {};
    const counts = {}; x.products.forEach(p => counts[p.cat] = (counts[p.cat] || 0) + 1);
    return `<section class="sec light" id="catalog" aria-labelledby="ct-h">
  <div class="wrap">
    ${head2(k, 'ct-h', x)}
    <div class="tidx" data-r><span class="tidx-k">${esc(k.techIndexTitle)}</span><div class="tidx-l">${arr(k.techIndex).map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
    <div class="cat-wrap">
    <div class="cat-bar">
      <div class="chips" role="group" aria-label="Категории" id="catChips"><button class="chip" type="button" data-cat="all" aria-pressed="true">Все<sup>${x.count}</sup></button>${x.cats.filter(q => counts[q.key]).map(q => `<button class="chip" type="button" data-cat="${esc(q.key)}" aria-pressed="false">${esc(q.label)}<sup>${counts[q.key]}</sup></button>`).join('')}</div>
      <label class="sel"><span class="sr">Сортировка</span>
        <select id="sort"><option value="def">По умолчанию</option><option value="asc">Сначала дешевле</option><option value="desc">Сначала дороже</option></select>
      </label>
    </div>
    <div class="grid-p" id="grid">
${x.products.map((p, i) => card(p, x, b, i)).join('\n')}
    </div>
    </div>
    <p class="cat-links">Разделы каталога: ${x.cats.filter(q => counts[q.key]).map(q => `<a href="${b}katalog/${esc(q.slug)}/">${esc(q.name || q.label)}</a>`).join(' · ')}</p>
    ${arr(cmp.rows).length ? `<div class="cmp" id="compare">
      <div class="sec-head split" style="margin-bottom:0">
        <div style="display:grid;gap:22px">
          <span class="eyebrow" data-r>${esc(cmp.eyebrow)}</span>
          <h3 class="h3" data-r style="--d:1">${H(esc(cmp.title), esc(cmp.accent), x)}</h3>
        </div>
        <p class="lead" data-r style="--d:2">${tok(cmp.lead, x)}</p>
      </div>
      <p class="cmp-hint">${esc(cmp.hint)}</p>
      <div class="cmp-wrap" data-r>
        <table>
          <thead><tr>${arr(cmp.headers).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody id="cmpBody">
          ${arr(cmp.rows).map(r => { const p = x.byId(r.id); if (!p) return ''; const pm = Math.max(...arr(cmp.rows).map(q => +q.powerVal || 0)) || 1, rm = Math.max(...arr(cmp.rows).map(q => +q.resVal || 0)) || 1; return `<tr data-open="${esc(p.id)}" data-href="${b}apparaty/${esc(p.slug)}/" tabindex="0" data-cursor="Открыть"><td><a href="${b}apparaty/${esc(p.slug)}/">${esc(p.name)}</a><small>${esc(r.note)}</small></td><td><div class="mb"><span>${esc(r.power)}</span><i style="--w:${(+r.powerVal || 0) / pm * 100}%"></i></div></td><td><div class="mb"><span>${esc(r.res)}</span><i style="--w:${(+r.resVal || 0) / rm * 100}%"></i></div></td><td class="mono">${esc(r.spot)}</td><td class="mono">${esc(r.screen)}</td><td class="mono">${esc(r.apower)}</td><td class="pr">${rub(p.price)}</td></tr>`; }).join('\n          ')}
          </tbody>
          <tfoot><tr><td colspan="${arr(cmp.headers).length || 7}">${esc(cmp.footer)}</td></tr></tfoot>
        </table>
      </div>
      <div class="tips">
        ${arr(k.tips).map((t, i) => `<div class="tip" data-r style="--d:${i}"><span class="ic">${ico(t.icon || 'spark')}</span><div><b>${esc(t.title)}</b><p>${esc(t.text)}</p></div></div>`).join('\n        ')}
      </div>
    </div>` : ''}
  </div>
</section>`;
  };
  S.studio = (c, x, b) => {
    const s = c.studio || {}, l = (c.company || {}).links || {}, ph = (c.company || {}).phone || {};
    return `<section class="sec use spot" id="practice" aria-labelledby="pr-h" style="overflow:hidden">
  <div class="wrap">
    <div class="use-head">
      <div style="display:grid;gap:22px">
        <span class="eyebrow" data-r>${esc(s.eyebrow)}</span>
        <h2 class="h2" id="pr-h" data-r style="--d:1">${H(esc(s.title), esc(s.accent), x)}</h2>
      </div>
      <div>
        <p class="lead" data-r style="--d:2">${tok(s.lead, x)}</p>
        <div class="use-btns" data-r style="--d:3">
          ${l.studioSite ? `<a class="btn btn-fire" href="${esc(l.studioSite)}" target="_blank" rel="noopener">${esc(s.btnPrimary)} ${ico('arrow-ur')}</a>` : ''}
          <a class="btn btn-ghost" href="${telHref(ph.tel)}">${ico('phone', 'ico')}${esc(s.btnSecondary)}</a>
        </div>
      </div>
    </div>
    <div class="svc">
      ${arr(s.services).map((v, i) => { const d = x.byId(v.device); return `<article class="svc-c" data-r style="--d:${i}">
        <figure class="svc-ph"><img src="${IMG(b, v.img)}" alt="${esc(v.badge + ' — ' + v.title)}" loading="lazy" decoding="async"><span class="badge l">${esc(v.badge)}</span></figure>
        <div class="svc-b">
          <span class="svc-k">Услуга студии · ${pad(i + 1)}</span>
          <h3>${esc(v.title)}</h3>
          <p>${esc(v.text)}</p>
          <ul class="svc-p">${arr(v.rows).map(r => `<li><span>${esc(r.name)}</span><b>${esc(r.value)}</b></li>`).join('')}</ul>
          ${d ? `<a class="svc-dev" href="${b}apparaty/${esc(d.slug)}/" data-open="${esc(d.id)}"><span><small>${esc(v.deviceLabel)}</small><b>${esc(d.name)}</b></span>${ico('arrow-ur')}</a>` : ''}
        </div>
      </article>`; }).join('\n      ')}
    </div>
    <div class="use-band" data-r>${arr(s.band).map(o => `<div><b>${esc(o.b)}</b><span>${esc(o.s)}</span></div>`).join('')}</div>
    <div class="try" data-r>
      <span class="try-ic">${ico('user')}</span>
      <div><b>${esc(s.tryTitle)}</b><p>${esc(s.tryText)}</p></div>
      ${l.studioSite ? `<a class="btn btn-fire btn-sm" href="${esc(l.studioSite)}" target="_blank" rel="noopener">${esc(s.tryBtn)} ${ico('arrow-ur')}</a>` : ''}
    </div>
    <div class="rail-head">
      <h3 class="h3" data-r>${H(esc(s.railTitle), esc(s.railAccent), x)}</h3>
      <div class="rail-ctl">
        <div class="rail-meter"><i id="railM"></i></div>
        <button class="round" type="button" id="railL" aria-label="Назад">${ico('l')}</button>
        <button class="round" type="button" id="railR" aria-label="Вперёд">${ico('r')}</button>
      </div>
    </div>
    <div class="rail" id="rail" data-r>
      ${arr(s.rail).map((r, i) => `<figure data-lb="rail" data-i="${i}"><div class="ph"><img src="${IMG(b, r.img)}" alt="${esc(r.caption)}" draggable="false" loading="lazy" decoding="async"></div><figcaption><span>${pad(i + 1)}</span>${esc(r.caption)}</figcaption></figure>`).join('\n      ')}
    </div>
  </div>
</section>`;
  };
  S.roi = (c, x) => {
    const r = c.roi || {};
    return `<section class="sec light" id="roi" aria-labelledby="ro-h">
  <div class="wrap">
    ${head2(r, 'ro-h', x)}
    <div class="roi">
      <div class="roi-in" data-r>
        <div class="fld"><div class="fld-h"><label for="rDev">Аппарат</label></div><div class="sel"><select id="rDev"></select></div></div>
        <div class="fld">
          <div class="fld-h"><label for="rCheck">Средний чек процедуры</label><output id="oCheck">${rub(r.check)}</output></div>
          <input class="rng" type="range" id="rCheck" min="500" max="6000" step="100" value="${+r.check || 2000}">
          <div class="quick" id="quick" aria-label="Цены в студии"></div>
        </div>
        <div class="fld"><div class="fld-h"><label for="rPer">Клиентов в день</label><output id="oPer">${+r.perDay || 4}</output></div><input class="rng" type="range" id="rPer" min="1" max="14" step="1" value="${+r.perDay || 4}"></div>
        <div class="fld"><div class="fld-h"><label for="rDays">Рабочих дней в месяц</label><output id="oDays">${+r.days || 22}</output></div><input class="rng" type="range" id="rDays" min="8" max="30" step="1" value="${+r.days || 22}"></div>
        <div class="fld"><div class="fld-h"><label for="rCost">Расходы в месяц</label><output id="oCost">${rub(r.costs)}</output></div><input class="rng" type="range" id="rCost" min="0" max="300000" step="5000" value="${+r.costs || 0}"><p class="hint">${esc(r.costsHint)}</p></div>
      </div>
      <div class="roi-out" data-r style="--d:1" aria-live="polite">
        <div class="roi-big"><small>Окупаемость</small><b id="oPay">—</b><span id="oPayS"></span></div>
        <div class="kpis"><div><small>Выручка в месяц</small><b id="oRev">—</b></div><div><small>Прибыль в месяц</small><b id="oProf">—</b></div><div><small>Итог 1-го года с учётом аппарата</small><b id="oYear">—</b></div></div>
        <svg class="chart" id="chart" viewBox="0 0 600 240" role="img" aria-label="График накопленной прибыли за 12 месяцев"></svg>
        <p class="disc">${esc(r.disclaimer)}</p>
        <button class="btn btn-fire" type="button" data-lead-from-roi>${esc(r.btn)} ${ico('arrow')}</button>
      </div>
    </div>
  </div>
</section>`;
  };
  S.why = (c, x, b) => {
    const w = c.why || {}, cls = ['ba1', 'bb', 'bc', 'bd', 'be', 'bf', 'bg', 'bh'];
    return `<section class="sec light light2" id="why" aria-labelledby="wh-h">
  <div class="wrap">
    ${head2(w, 'wh-h', x)}
    <div class="bento">
      ${arr(w.tiles).map((t, i) => { const st = t.style === 'photo' && t.img ? 'photo' : t.style === 'fire' ? 'fire' : ''; return `<article class="tile ${st} ${cls[i] || ''}" data-r style="--d:${i % 3}">${st === 'photo' ? `<img src="${IMG(b, t.img)}" alt="${esc(t.alt || t.title)}" loading="lazy" decoding="async">` : ''}${t.big ? `<span class="big">${esc(t.big)}</span>` : t.icon ? `<span class="ic">${ico(t.icon)}</span>` : ''}<h3${t.big ? ' style="margin-top:12px"' : ''}>${esc(t.title)}</h3>${t.quizBtn ? `<div class="row"><p>${esc(t.text)}</p><button class="btn btn-fire btn-sm" type="button" data-quiz>${esc(t.quizBtn)} ${ico('arrow')}</button></div>` : `<p>${esc(t.text)}</p>`}</article>`; }).join('\n      ')}
    </div>
  </div>
</section>`;
  };
  S.founder = (c, x, b) => {
    const f = c.founder || {};
    return `<section class="sec spot" id="founder" aria-labelledby="fd-h" style="overflow:hidden">
  <div class="wrap">
    <div class="fdr">
      <div class="fdr-ph" data-r>
        <div class="m"><img src="${IMG(b, f.photo)}" alt="${esc(f.photoAlt)}" width="700" height="1029" loading="lazy" decoding="async"></div>
        ${f.photo2 ? `<div class="s"><img src="${IMG(b, f.photo2)}" alt="${esc(f.photo2Alt)}" loading="lazy" decoding="async"></div>` : ''}
        <div class="stamp" aria-hidden="true"><svg viewBox="0 0 112 112"><defs><path id="circ" d="M56 56m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs><text><textPath href="#circ">${esc(f.stamp)}</textPath></text></svg><i></i></div>
      </div>
      <div>
        <span class="eyebrow" data-r>${esc(f.eyebrow)}</span>
        <h2 class="fdr-name" id="fd-h" data-r style="--d:1">${esc(f.name1)}<br><em class="spectral">${esc(f.name2)}</em></h2>
        <div class="fdr-role" data-r style="--d:2">${arr(f.roles).map(r => `<span class="pill">${esc(r)}</span>`).join('')}</div>
        ${arr(f.paragraphs).map((p, i) => `<p data-r style="--d:${2 + i}">${p}</p>`).join('\n        ')}
        ${f.quote ? `<blockquote class="quote" data-r style="--d:3">${esc(f.quote)}<cite>${esc(f.quoteCite)}</cite></blockquote>` : ''}
        <div class="fdr-stats" data-r style="--d:4">${arr(f.stats).map(s => `<div><b>${esc(s.b)}</b><span>${esc(s.s)}</span></div>`).join('')}</div>
      </div>
    </div>
  </div>
</section>`;
  };
  S.geo = (c, x) => {
    const g = c.geo || {};
    return `<section class="sec geo-sec spot" id="geo" aria-labelledby="geo-h">
  <div class="wrap">
    ${head2(g, 'geo-h', x)}
    <div class="geo-cards">${arr(g.cards).map((k, i) => `<article class="geo-card" data-r style="--d:${i}"><span class="ic">${ico(['pin', 'map', 'truck'][i % 3])}</span><h3>${esc(k.title)}</h3><p>${esc(k.text)}</p></article>`).join('')}</div>
    <ul class="geo-cities" data-r aria-label="Города Иркутской области">${arr(g.cities).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    ${g.note ? `<p class="geo-note" data-r>${esc(g.note)}</p>` : ''}
  </div>
</section>`;
  };
  S.showroom = (c, x, b) => {
    const s = c.showroom || {}, co = c.company || {}, l = co.links || {}, ph = co.phone || {}, ph2 = co.phone2 || {}, ad = co.address || {}, hr = co.hours || {};
    return `<section class="sec light" id="showroom" aria-labelledby="sh-h">
  <div class="wrap">
    ${head2(s, 'sh-h', x)}
    <div class="show">
      <div class="mosaic" data-r>
        ${arr(s.photos).map((p, i) => `<figure data-lb="show" data-i="${i}"><img src="${IMG(b, p.img)}" alt="${esc(p.alt || p.caption)}" loading="lazy" decoding="async"><figcaption class="badge l">${esc(p.caption)}</figcaption></figure>`).join('\n        ')}
      </div>
      <address class="contact" data-r style="--d:1">
        <a class="crow" href="${telHref(ph.tel)}"><span class="ic">${ico('phone')}</span><div><small>Телефон</small><b>${esc(ph.display)}</b><span>${esc(ph.note)}</span></div></a>
        ${ph2.display ? `<a class="crow" href="${telHref(ph2.tel)}"><span class="ic">${ico('phone')}</span><div><small>Второй номер</small><b>${esc(ph2.display)}</b><span>${esc(ph2.note)}</span></div></a>` : ''}
        <a class="crow" href="${esc(l.twogis || l.yandexMaps || '#')}" target="_blank" rel="noopener"><span class="ic">${ico('pin')}</span><div><small>Адрес</small><b>${esc(ad.city)}, ${esc(ad.street)}</b><span>${esc(ad.note)}</span></div></a>
        <div class="crow"><span class="ic">${ico('clock')}</span><div><small>Часы работы</small><b>${esc(hr.text)}</b><span>${esc(hr.note)}</span></div></div>
        <div class="links">
          ${l.telegram ? `<a class="btn btn-ink btn-sm" href="${esc(l.telegram)}" target="_blank" rel="noopener">${ico('tg', 'ico')}Telegram</a>` : ''}
          ${l.max ? `<a class="btn btn-ghost btn-sm" href="${esc(l.max)}" target="_blank" rel="noopener">${ico('chat', 'ico')}MAX</a>` : ''}
          ${l.twogis ? `<a class="btn btn-ghost btn-sm" href="${esc(l.twogis)}" target="_blank" rel="noopener">2ГИС</a>` : ''}
          ${l.yandexMaps ? `<a class="btn btn-ghost btn-sm" href="${esc(l.yandexMaps)}" target="_blank" rel="noopener">Яндекс Карты</a>` : ''}
          ${l.allLinks ? `<a class="btn btn-ghost btn-sm" href="${esc(l.allLinks)}" target="_blank" rel="noopener">${ico('link', 'ico')}Все ссылки</a>` : ''}
        </div>
      </address>
    </div>
    <div class="map" id="map" data-r data-lat="${esc(co.geo && co.geo.lat)}" data-lng="${esc(co.geo && co.geo.lng)}">
      <div class="map-pin">
        <span class="p" aria-hidden="true"></span>
        <b>${esc(ad.short || ad.street)}</b>
        <button class="btn btn-fire btn-sm" type="button" id="mapBtn">${esc(s.mapBtn)} ${ico('arrow')}</button>
      </div>
    </div>
  </div>
</section>`;
  };
  S.about = (c, x) => {
    const a = c.about || {}, co = c.company || {}, ad = co.address || {};
    const facts = [
      ['Компания', `${c.site.name} — поставка оборудования для салонов красоты`], ['Город', `${ad.city}, ${ad.street}`], ['Регион работы', (c.seo && c.seo.serviceArea) || ''],
      ['Работаем с', `${co.founded} года`], ['Ассортимент', `${x.count} ${x.countWord}: диодные лазеры, DPL/ELOS, коррекция фигуры, косметология лица, SPA-мебель`],
      ['Цены', `от ${x.minPrice} до ${x.maxPrice}`], ['Условия', 'бесплатная доставка, рассрочка, социальный контракт, обучение, гарантия, Ростест'],
      ['Шоурум', `${co.legalName}, ${ad.city} — оборудование в работе`],
      ['Телефон', (co.phone || {}).display], ['Часы', (co.hours || {}).text],
    ].filter(f => f[1]);
    return `<section class="sec light" id="about" aria-labelledby="ab-h">
  <div class="wrap about">
    <div>
      <span class="eyebrow" data-r>${esc(a.eyebrow)}</span>
      <h2 class="h2" id="ab-h" data-r style="--d:1;margin-top:22px">${H(esc(a.title), esc(a.accent), x)}</h2>
      <div class="about-txt" data-r style="--d:2">${tok(a.html, x)}</div>
    </div>
    <aside class="facts-box" data-r style="--d:1" aria-label="${esc(a.factsTitle)}">
      <h3>${esc(a.factsTitle)}</h3>
      <dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </aside>
  </div>
</section>`;
  };
  S.faq = (c, x) => {
    const f = c.faq || {}, ph = (c.company || {}).phone || {};
    return `<section class="sec light light2" id="faq" aria-labelledby="fq-h">
  <div class="wrap faq">
    <div class="faq-l"><div>
      <span class="eyebrow" data-r>${esc(f.eyebrow)}</span>
      <h2 class="h2" id="fq-h" data-r style="--d:1;margin-top:22px">${H(esc(f.title), esc(f.accent), x)}</h2>
      <p class="lead" data-r style="--d:2;margin-top:22px">${tok(f.lead, x)}</p>
      <a class="btn btn-ink" href="${telHref(ph.tel)}" data-r style="--d:3;margin-top:28px">${ico('phone', 'ico')}${esc(ph.display)}</a>
    </div></div>
    <div class="acc" id="acc">
      ${arr(f.items).map((q, i) => `<div class="acc-i${i ? '' : ' open'}"><h3 class="acc-h"><button class="acc-q" type="button" aria-expanded="${!i}">${esc(q.q)}<i aria-hidden="true"></i></button></h3><div class="acc-a"><div><p>${tok(q.a, x)}</p></div></div></div>`).join('\n      ')}
    </div>
  </div>
</section>`;
  };
  S.lead = (c, x) => {
    const d = c.lead || {}, co = c.company || {}, l = co.links || {}, ph = co.phone || {};
    return `<section class="sec lead-sec spot" id="lead" aria-labelledby="ld-h">
  <div class="wrap lead-g">
    <div>
      <span class="eyebrow" data-r>${esc(d.eyebrow)}</span>
      <h2 class="h2" id="ld-h" data-r style="--d:1;margin-top:22px">${H(esc(d.title), esc(d.accent), x)}</h2>
      <p class="lead" data-r style="--d:2;margin-top:22px">${tok(d.lead, x)}</p>
      <div class="alt" data-r style="--d:3">
        <a href="${telHref(ph.tel)}"><span class="ic">${ico('phone')}</span><div><b>${esc(ph.display)}</b><span>${esc(co.hours && co.hours.text)}</span></div>${ico('arrow-ur')}</a>
        ${l.telegram ? `<a href="${esc(l.telegram)}" target="_blank" rel="noopener"><span class="ic">${ico('tg')}</span><div><b>Telegram</b><span>${esc(d.altTelegram)}</span></div>${ico('arrow-ur')}</a>` : ''}
        ${l.max ? `<a href="${esc(l.max)}" target="_blank" rel="noopener"><span class="ic">${ico('chat')}</span><div><b>MAX</b><span>${esc(d.altMax)}</span></div>${ico('arrow-ur')}</a>` : ''}
      </div>
    </div>
    <form class="form" id="form" novalidate data-r style="--d:1">
      <div class="frow">
        <div class="inp"><input id="fName" name="name" placeholder=" " autocomplete="name"><label for="fName">Ваше имя</label></div>
        <div class="inp" id="fPhoneW"><input id="fPhone" name="phone" type="tel" placeholder=" " autocomplete="tel" inputmode="tel" required><label for="fPhone">Телефон *</label></div>
      </div>
      <div class="grp"><span>Что интересует</span><div class="opt">${arr(d.want).map((t, i) => `<label><input type="radio" name="want" value="${esc(t)}"${i ? '' : ' checked'}><span>${esc(t)}</span></label>`).join('')}</div></div>
      <div class="grp"><span>Как планируете оплату</span><div class="opt">${arr(d.pay).map((t, i) => `<label><input type="radio" name="pay" value="${esc(t)}"${i ? '' : ' checked'}><span>${esc(t)}</span></label>`).join('')}</div></div>
      <div class="inp"><textarea id="fMsg" name="msg" placeholder=" " rows="3"></textarea><label for="fMsg">Модель или вопрос</label></div>
      <label class="agree"><input type="checkbox" id="fAgree" checked required><span>${esc(d.consent)}</span></label>
      <button class="btn btn-fire" type="submit">${esc(d.submit)} ${ico('arrow')}</button>
      <div class="form-ok" role="status"><b>${esc(d.successTitle)}</b>${esc(d.successText)}</div>
    </form>
  </div>
</section>`;
  };

  /* ---------------- JSON-LD ---------------- */
  function orgLd(c, x) {
    const co = c.company || {}, ad = co.address || {}, s = c.seo || {}, l = co.links || {};
    const id = siteUrl(c) + '#org';
    return {
      '@context': 'https://schema.org', '@type': ['Store', 'LocalBusiness'], '@id': id,
      name: c.site.name, alternateName: `${c.site.name} — оборудование для салонов красоты`,
      description: strip(tok(s.description, x)), url: siteUrl(c),
      logo: ABS(c, 'assets/icons/icon-512.png'), image: [ABS(c, 'assets/img/' + (s.ogImage || 'og-image.jpg')), ABS(c, 'assets/img/' + ((c.hero || {}).image || 'hero.webp'))],
      telephone: [(co.phone || {}).tel, (co.phone2 || {}).tel].filter(Boolean), email: co.email || undefined,
      address: { '@type': 'PostalAddress', streetAddress: ad.street, addressLocality: ad.city, addressRegion: ad.region, postalCode: ad.postal || undefined, addressCountry: ad.country || 'RU' },
      geo: co.geo && co.geo.lat ? { '@type': 'GeoCoordinates', latitude: co.geo.lat, longitude: co.geo.lng } : undefined,
      hasMap: l.twogis || l.yandexMaps || undefined,
      openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: (co.hours || {}).opens || '09:00', closes: (co.hours || {}).closes || '22:00' },
      areaServed: [...arr(s.areaServed).map(n => ({ '@type': 'City', name: n })), { '@type': 'AdministrativeArea', name: s.region || 'Иркутская область' }, { '@type': 'Country', name: 'Россия' }],
      priceRange: `${x.minPrice} – ${x.maxPrice}`.replace(/\u00a0/g, ' '), currenciesAccepted: 'RUB', paymentAccepted: 'Наличные, безналичный расчёт, рассрочка, социальный контракт',
      taxID: co.inn, foundingDate: co.founded, knowsLanguage: 'ru',
      founder: co.founder ? { '@type': 'Person', name: co.founder, jobTitle: co.founderTitle } : undefined,
      sameAs: [l.telegram, l.twogis, l.studioSite, l.allLinks].filter(Boolean),
      parentOrganization: { '@type': 'BeautySalon', name: co.legalName, url: l.studioSite || undefined, address: { '@type': 'PostalAddress', streetAddress: ad.street, addressLocality: ad.city, addressCountry: 'RU' }, telephone: (co.phone || {}).tel },
      hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Каталог оборудования', itemListElement: x.cats.map(k => ({ '@type': 'OfferCatalog', name: k.name || k.label, url: siteUrl(c) + 'katalog/' + k.slug + '/' })) },
      aggregateRating: undefined,
    };
  }
  const breadcrumbs = (c, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: siteUrl(c) + it[1] })) });
  function productLd(c, x, p) {
    const k = x.catBy[p.cat] || {}, url = siteUrl(c) + 'apparaty/' + p.slug + '/';
    const o = {
      '@context': 'https://schema.org', '@type': 'Product', '@id': url + '#product', name: p.name, sku: p.id, mpn: p.id,
      category: k.name || k.label, url, image: [p.img, ...arr(p.gallery)].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 8).map(f => ABS(c, 'assets/img/' + f)),
      description: strip(p.seoDescription || [p.lead, p.description].filter(Boolean).join(' ')),
      additionalProperty: arr(p.specs).slice(0, 20).map(s => ({ '@type': 'PropertyValue', name: s.name, value: s.value })),
    };
    if (isNum(p.price)) o.offers = { '@type': 'Offer', url, price: +p.price, priceCurrency: 'RUB', availability: 'https://schema.org/' + (p.availability || 'InStock'), itemCondition: 'https://schema.org/NewCondition', seller: { '@id': siteUrl(c) + '#org' }, areaServed: { '@type': 'AdministrativeArea', name: (c.seo || {}).region || 'Иркутская область' } };
    return o;
  }
  function faqLd(c, items, x) { if (!items.length) return null; return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(q => ({ '@type': 'Question', name: strip(q.q), acceptedAnswer: { '@type': 'Answer', text: strip(tok(q.a, x)) } })) }; }
  const clean = o => JSON.parse(JSON.stringify(o));

  /* ---------------- pages ---------------- */
  function renderHome(c, x) {
    const b = x.forceBase != null ? x.forceBase : '', s = c.seo || {}, home = c.home || {}, hidden = arr(home.hidden);
    const order = arr(home.order).length ? home.order : Object.keys(S);
    const body = order.filter(k => S[k] && hidden.indexOf(k) < 0).map(k => S[k](c, x, b)).join('\n\n');
    const ld = [orgLd(c, x), { '@context': 'https://schema.org', '@type': 'WebSite', '@id': siteUrl(c) + '#website', url: siteUrl(c), name: c.site.name, inLanguage: 'ru-RU', publisher: { '@id': siteUrl(c) + '#org' } },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Каталог оборудования', itemListElement: x.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: siteUrl(c) + 'apparaty/' + p.slug + '/', name: p.name })) },
      faqLd(c, arr((c.faq || {}).items), x)].filter(Boolean).map(clean);
    return head(c, x, { kind: 'home', base: b, path: '', title: tok(s.title, x), description: strip(tok(s.description, x)), ogTitle: s.ogTitle, ogDescription: s.ogDescription, jsonld: ld, preload: IMG(b, (c.hero || {}).image) })
      + chrome_top(c, x, b, true) + `<main id="main">\n${body}\n</main>\n` + footer(c, x, b, true);
  }

  function crumbs(list) {
    return `<nav class="crumbs" aria-label="Хлебные крошки"><ol>${list.map((it, i) => i < list.length - 1 ? `<li><a href="${esc(it[1])}">${esc(it[0])}</a></li>` : `<li aria-current="page">${esc(it[0])}</li>`).join('')}</ol></nav>`;
  }

  function renderProduct(c, x, p) {
    const b = x.forceBase != null ? x.forceBase : '../../', k = x.catBy[p.cat] || {}, co = c.company || {}, ph = co.phone || {}, l = co.links || {}, s = c.seo || {};
    const city = s.city || 'Иркутск';
    const gal = [p.img, ...arr(p.gallery)].filter((v, i, a) => v && a.indexOf(v) === i);
    const title = p.seoTitle || `${p.name} — купить в ${city === 'Иркутск' ? 'Иркутске' : city}, цена ${strip(rub(p.price))} | ${c.site.name}`;
    const desc = p.seoDescription || cut(`${p.name} (${p.kind}): ${strip(p.lead)} Цена — ${strip(rub(p.price))}. Доставка, рассрочка, социальный контракт, обучение. Шоурум в Иркутске.`, 300);
    const related = x.products.filter(q => q.cat === p.cat && q.id !== p.id).slice(0, 4);
    const ld = [productLd(c, x, p), breadcrumbs(c, [['Главная', ''], ['Каталог', '#catalog'], [k.name || k.label || 'Каталог', 'katalog/' + (k.slug || '') + '/'], [p.name, 'apparaty/' + p.slug + '/']])].map(clean);
    const main = `<main id="main" class="page">
<section class="sec light pp" aria-labelledby="pp-h">
  <div class="wrap">
    ${crumbs([['Главная', b], ['Каталог', b + '#catalog'], [k.name || k.label || 'Каталог', b + 'katalog/' + (k.slug || '') + '/'], [p.name, '']])}
    <div class="pp-grid">
      <div class="pp-gal">
        <div class="pp-main ${p.fit === 'contain' ? 'contain' : 'cover'}" data-lb="product" data-i="0" data-cursor="Смотреть"><img id="ppImg" src="${IMG(b, gal[0])}" alt="${esc(p.imgAlt || p.name + ' — ' + p.kind)}" fetchpriority="high" decoding="async"${p.pos ? ` style="object-position:${esc(p.pos)}"` : ''}><div class="badges">${arr(p.badges).map(badge).join('')}</div></div>
        ${gal.length > 1 ? `<div class="pp-th">${gal.map((g, i) => `<button type="button" class="${/^c_/.test(g) ? 'ct' : ''}" data-pp="${i}" aria-label="Фото ${i + 1}"${i ? '' : ' aria-current="true"'}><img src="${IMG(b, g)}" alt="${esc(p.name)} — фото ${i + 1}" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}
      </div>
      <div class="pp-info">
        <span class="pm-k">${esc(k.label || '')} · ${esc(p.kind)}</span>
        <h1 class="pp-n" id="pp-h">${esc(p.name)}</h1>
        <div class="pm-price"><b>${rub(p.price)}</b><span>${esc(isNum(p.price) ? (c.catalog || {}).priceNote : (c.catalog || {}).priceRequestNote)}</span></div>
        <div class="pm-note">${arr((c.catalog || {}).sheetNotes).map((t, i) => `<span>${ico(['truck', 'card', 'doc', 'grad', 'shield', 'cert'][i % 6])}${esc(t)}</span>`).join('')}</div>
        <p class="pm-lead">${esc(p.lead)}</p>
        ${p.description ? `<div class="pp-desc">${p.description}</div>` : ''}
        <div class="pp-cta">
          <a class="btn btn-fire" href="#lead" data-lead-product="${esc(p.name)} — ${esc(strip(rub(p.price)))}">Получить предложение ${ico('arrow')}</a>
          <a class="btn btn-ghost" href="${telHref(ph.tel)}">${ico('phone', 'ico')}${esc(ph.display)}</a>
          ${l.telegram ? `<a class="btn btn-ghost" href="${esc(l.telegram)}" target="_blank" rel="noopener">${ico('tg', 'ico')}Telegram</a>` : ''}
        </div>
        <ul class="pp-chips">${arr(p.chips).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="pp-cols">
      ${arr(p.feats).length ? `<div><h2 class="pm-h">Особенности и преимущества</h2><ul class="pm-feats">${arr(p.feats).map(f => `<li>${ico('check')}<span>${esc(f)}</span></li>`).join('')}</ul></div>` : ''}
      <div><h2 class="pm-h">Технические характеристики</h2>${arr(p.specs).length ? `<dl class="pm-specs">${arr(p.specs).map(s2 => `<div><dt>${esc(s2.name)}</dt><dd>${esc(s2.value)}</dd></div>`).join('')}</dl>` : `<p class="pp-muted">Характеристики и цену уточняйте у менеджера — пришлём полное описание модели.</p>`}</div>
    </div>
    <div class="pp-buy">
      <h2 class="h3">Как купить <span>${esc(p.name)} в ${city === 'Иркутск' ? 'Иркутске' : esc(city)}</span></h2>
      <ol class="pp-steps">${arr((c.route || {}).steps).slice(0, 6).map(s2 => `<li><b>${esc(s2.title)}</b><span>${esc(s2.text)}</span></li>`).join('')}</ol>
    </div>
    ${related.length ? `<div class="pp-rel"><h2 class="h3">Похожие <span>аппараты</span></h2><div class="grid-p">${related.map(q => card(q, x, b, x.products.indexOf(q))).join('\n')}</div><p class="cat-links"><a href="${b}katalog/${esc(k.slug || '')}/">Все ${esc((k.name || k.label || '').toLowerCase())} →</a> · <a href="${b}#catalog">Весь каталог →</a></p></div>` : ''}
  </div>
</section>
${S.lead(c, x)}
</main>
`;
    return head(c, x, { kind: 'product', base: b, path: 'apparaty/' + p.slug + '/', title, description: desc, ogType: 'product', image: gal[0] && !/^c_/.test(gal[0]) ? gal[0] : null, jsonld: ld, preload: IMG(b, gal[0]) })
      + chrome_top(c, x, b, false).replace('<body class="no-js">', `<body class="no-js" data-product="${esc(p.id)}">`) + main + footer(c, x, b, false);
  }

  function renderCategory(c, x, k) {
    const b = x.forceBase != null ? x.forceBase : '../../', list = x.products.filter(p => p.cat === k.key), s = c.seo || {};
    const city = s.city === 'Иркутск' || !s.city ? 'Иркутске' : s.city;
    const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: k.name || k.label, url: siteUrl(c) + 'katalog/' + k.slug + '/', description: strip(k.seoDescription), isPartOf: { '@id': siteUrl(c) + '#website' } },
      { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: siteUrl(c) + 'apparaty/' + p.slug + '/', name: p.name })) },
      breadcrumbs(c, [['Главная', ''], ['Каталог', '#catalog'], [k.name || k.label, 'katalog/' + k.slug + '/']])].map(clean);
    const main = `<main id="main" class="page">
<section class="sec light cp" aria-labelledby="cp-h">
  <div class="wrap">
    ${crumbs([['Главная', b], ['Каталог', b + '#catalog'], [k.name || k.label, '']])}
    <div class="sec-head split">
      <div style="display:grid;gap:22px">
        <span class="eyebrow" data-r>Каталог · ${list.length} ${plural(list.length, 'модель', 'модели', 'моделей')}</span>
        <h1 class="h2" id="cp-h" data-r style="--d:1">${esc(k.name || k.label)} <span>— купить в ${esc(city)}</span></h1>
      </div>
      <div class="lead cp-intro" data-r style="--d:2">${k.intro || ''}</div>
    </div>
    <div class="grid-p" id="grid">
${list.map(p => card(p, x, b, x.products.indexOf(p))).join('\n')}
    </div>
    <p class="cat-links">Другие разделы: ${x.cats.filter(q => q.key !== k.key && x.products.some(p => p.cat === q.key)).map(q => `<a href="${b}katalog/${esc(q.slug)}/">${esc(q.name || q.label)}</a>`).join(' · ')} · <a href="${b}#catalog">Весь каталог</a></p>
  </div>
</section>
${S.faq(c, x)}
${S.lead(c, x)}
</main>
`;
    return head(c, x, { kind: 'category', base: b, path: 'katalog/' + k.slug + '/', title: k.seoTitle || `${k.name || k.label} — купить в ${city} | ${c.site.name}`, description: k.seoDescription || strip(k.intro).slice(0, 250), jsonld: ld })
      + chrome_top(c, x, b, false) + main + footer(c, x, b, false);
  }

  function render404(c, x) {
    const b = sitePath(c);
    const main = `<main id="main" class="page"><section class="sec light nf"><div class="wrap"><span class="eyebrow">Ошибка 404</span><h1 class="h2" style="margin-top:22px">Страница не найдена — <span>но аппарат найдём</span></h1><p class="lead" style="margin-top:22px">Возможно, страница переехала. Загляните в каталог или позвоните — подскажем.</p><p style="margin-top:28px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-ink" href="${b}">На главную</a><a class="btn btn-ghost" href="${b}#catalog">Каталог</a></p><p class="cat-links" style="margin-top:28px">${x.cats.map(q => `<a href="${b}katalog/${esc(q.slug)}/">${esc(q.name || q.label)}</a>`).join(' · ')}</p></div></section></main>\n`;
    return head(c, x, { kind: '404', base: b, path: '404.html', title: 'Страница не найдена | ' + c.site.name, description: 'Страница не найдена.', noindex: true, jsonld: [] }) + chrome_top(c, x, b, false) + main + footer(c, x, b, false);
  }

  /* ---------------- runtime data (assets/js/data.js) ---------------- */
  function runtimeData(c, x) {
    const k = c.catalog || {};
    const d = {
      v: (c.meta && c.meta.updated) || '',
      cats: Object.fromEntries(x.cats.map(q => [q.key, q.label])), catSlugs: Object.fromEntries(x.cats.map(q => [q.key, q.slug])),
      products: x.products.map(p => ({ id: p.id, slug: p.slug, cat: p.cat, name: p.name, kind: p.kind, price: isNum(p.price) ? +p.price : null, img: p.img, fit: p.fit, pos: p.pos, lead: p.lead, gallery: [p.img, ...arr(p.gallery)].filter((v, i, a) => v && a.indexOf(v) === i), feats: arr(p.feats), specs: arr(p.specs).map(s => [s.name, s.value]), tags: arr(p.tags) })),
      priceNote: k.priceNote, priceRequestNote: k.priceRequestNote,
      phototypes: arr((c.tech || {}).phototypes).map(p => ({ t: p.title, s: p.sub, w: arr(p.waves), m: p.main, x: p.text })),
      techSteps: arr((c.tech || {}).steps).map(s => ({ tag: s.tag, f: +s.follicle || 0, s: +s.skin || 0 })),
      progress: arr((c.tech || {}).progress).map(p => p.label),
      lb: { rail: arr((c.studio || {}).rail).map(r => [r.img, r.caption]), proof: arr((c.route || {}).proof).map(r => [r.img, r.caption]), show: arr((c.showroom || {}).photos).map(r => [r.img, r.caption]) },
      quiz: c.quiz || {}, roi: c.roi || {},
      telegram: (c.lead && c.lead.telegramUser) ? 'https://t.me/' + c.lead.telegramUser.replace(/^@/, '') : ((c.company || {}).links || {}).telegram || '',
      webhook: (c.lead || {}).webhookUrl || '',
      siteName: c.site.name,
      map: { lat: (c.company.geo || {}).lat, lng: (c.company.geo || {}).lng, title: `${c.company.address.city}, ${c.company.address.street}` },
      music: c.music || {},
      intro: !!((c.site || {}).intro || {}).enabled,
    };
    return '/* Сгенерировано из content.json — не редактируйте вручную, правьте через админку */\nwindow.TE_DATA=' + JSON.stringify(d).replace(/</g, '\\u003c') + ';\n';
  }

  /* ---------------- SEO files ---------------- */
  function sitemap(c, x) {
    const d = ((c.meta && c.meta.updated) || new Date().toISOString()).slice(0, 10), u = siteUrl(c);
    const urls = [[u, '1.0', 'weekly'], ...x.cats.filter(k => x.products.some(p => p.cat === k.key)).map(k => [u + 'katalog/' + k.slug + '/', '0.8', 'weekly']), ...x.products.map(p => [u + 'apparaty/' + p.slug + '/', '0.9', 'weekly'])];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` + urls.map(([l, p, f], i) => {
      let img = '';
      if (i === 0) img = `<image:image><image:loc>${esc(ABS(c, 'assets/img/' + ((c.hero || {}).image || 'hero.webp')))}</image:loc></image:image>`;
      const pr = x.products.find(q => l.endsWith('apparaty/' + q.slug + '/'));
      if (pr) img = [pr.img, ...arr(pr.gallery)].filter((v, j, a) => v && a.indexOf(v) === j).slice(0, 6).map(f => `<image:image><image:loc>${esc(ABS(c, 'assets/img/' + f))}</image:loc></image:image>`).join('');
      return `  <url><loc>${esc(l)}</loc><lastmod>${d}</lastmod><changefreq>${f}</changefreq><priority>${p}</priority>${img}</url>`;
    }).join('\n') + '\n</urlset>\n';
  }
  function robots(c) {
    const p = sitePath(c);
    return `# ${c.site.name}\nUser-agent: *\nAllow: ${p}\nDisallow: ${p}admin/\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid&ysclid ${p}\n\nUser-agent: Yandex\nAllow: ${p}\nDisallow: ${p}admin/\n\nUser-agent: Googlebot\nAllow: ${p}\nDisallow: ${p}admin/\n\n# ИИ-ассистенты и поисковые ИИ — разрешаем, чтобы нас цитировали\nUser-agent: GPTBot\nAllow: ${p}\nUser-agent: OAI-SearchBot\nAllow: ${p}\nUser-agent: ChatGPT-User\nAllow: ${p}\nUser-agent: PerplexityBot\nAllow: ${p}\nUser-agent: ClaudeBot\nAllow: ${p}\nUser-agent: Claude-SearchBot\nAllow: ${p}\nUser-agent: Google-Extended\nAllow: ${p}\n\nSitemap: ${siteUrl(c)}sitemap.xml\n`;
  }
  function llms(c, x, full) {
    const co = c.company || {}, ad = co.address || {}, l = co.links || {}, u = siteUrl(c), s = c.seo || {};
    let t = `# ${c.site.name} — оборудование для салонов красоты (${ad.city}, ${s.region})\n\n> ${strip(tok(s.description, x))}\n\n`;
    t += `## Коротко\n- Компания: ${c.site.name} — поставка профессионального косметологического оборудования, с ${co.founded} года.\n- Где: ${ad.city}, ${ad.street} (${ad.note}).\n- География работы: ${s.serviceArea || s.region}.\n- Шоурум: ${co.legalName} — оборудование работает в студии, его можно посмотреть и попробовать.\n- Основатель: ${co.founder} — ${String(co.founderTitle || '').toLowerCase()}.\n- Ассортимент: ${x.count} ${x.countWord}, цены от ${strip(x.minPrice)} до ${strip(x.maxPrice)}.\n- Условия: бесплатная доставка, рассрочка, социальный контракт, обучение, гарантия, сертификация Ростест.\n- Телефон: ${(co.phone || {}).display}${(co.phone2 || {}).display ? ', ' + co.phone2.display : ''}. Часы: ${(co.hours || {}).text}.\n- Telegram: ${l.telegram || '—'}. Сайт студии для клиентов: ${l.studioSite || '—'}.\n- Реквизиты: ${co.legalForm}, ИНН ${co.inn}, ОГРНИП ${co.ogrnip}.\n\n`;
    t += `## Разделы каталога\n` + x.cats.filter(k => x.products.some(p => p.cat === k.key)).map(k => `- [${k.name || k.label}](${u}katalog/${k.slug}/): ${strip(k.seoDescription)}`).join('\n') + '\n\n';
    t += `## Аппараты и цены\n` + x.products.map(p => `- [${p.name}](${u}apparaty/${p.slug}/) — ${p.kind}; цена: ${strip(rub(p.price))}. ${strip(p.lead)}`).join('\n') + '\n\n';
    if (full) {
      t += `## Подробно по каждому аппарату\n\n` + x.products.map(p => `### ${p.name}\n- Категория: ${(x.catBy[p.cat] || {}).name || p.cat}\n- Тип: ${p.kind}\n- Цена: ${strip(rub(p.price))}\n- Страница: ${u}apparaty/${p.slug}/\n\n${strip(p.lead)}\n\n${arr(p.feats).length ? 'Особенности:\n' + arr(p.feats).map(f => '- ' + strip(f)).join('\n') + '\n\n' : ''}${arr(p.specs).length ? 'Характеристики:\n' + arr(p.specs).map(q => `- ${q.name}: ${q.value}`).join('\n') + '\n\n' : ''}`).join('');
      t += `## Услуги студии на этом оборудовании\n` + arr((c.studio || {}).services).map(v => `- ${v.title}: ${strip(v.text)} ${arr(v.rows).map(r => r.name + ' — ' + r.value).join('; ')}`).join('\n') + '\n\n';
    }
    t += `## Частые вопросы\n` + arr((c.faq || {}).items).map(q => `### ${strip(q.q)}\n${strip(tok(q.a, x))}\n`).join('\n') + '\n';
    t += `## География\n${arr((c.geo || {}).cities).join(', ')}. ${strip((c.geo || {}).lead)}\n`;
    return t;
  }
  function manifest(c) {
    return JSON.stringify({ name: `${c.site.name} — оборудование для салонов красоты`, short_name: c.site.name, lang: 'ru', start_url: './', scope: './', display: 'standalone', background_color: (c.theme || {}).ink || '#04120E', theme_color: (c.site || {}).themeColor || '#04120E', icons: [{ src: 'assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 2);
  }

  /* ---------------- main ---------------- */
  function renderAll(content, opts) {
    const c = JSON.parse(JSON.stringify(content));
    c.site = c.site || {}; c.company = c.company || {}; c.company.address = c.company.address || {}; c.company.geo = c.company.geo || {};
    const x = ctxOf(c), files = {};
    if (opts && opts.base != null) x.forceBase = opts.base;
    files['index.html'] = renderHome(c, x);
    x.products.forEach(p => { files['apparaty/' + p.slug + '/index.html'] = renderProduct(c, x, p); });
    x.cats.forEach(k => { if (x.products.some(p => p.cat === k.key)) files['katalog/' + k.slug + '/index.html'] = renderCategory(c, x, k); });
    files['404.html'] = render404(c, x);
    files['assets/js/data.js'] = runtimeData(c, x);
    files['sitemap.xml'] = sitemap(c, x);
    files['robots.txt'] = robots(c);
    files['llms.txt'] = llms(c, x, false);
    files['llms-full.txt'] = llms(c, x, true);
    files['manifest.webmanifest'] = manifest(c);
    files['.nojekyll'] = '';
    if (c.site.cname) files['CNAME'] = c.site.cname.trim() + '\n';
    return files;
  }

  return { VERSION, renderAll, ctxOf, slugify: s => String(s || '').toLowerCase().replace(/[а-яё]/g, ch => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }[ch])).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') };
});
