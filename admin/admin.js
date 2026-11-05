/* Trend Esthetic — админка. Редактирует content.json, пересобирает все страницы (assets/js/render.js)
   и публикует одним коммитом в GitHub через Git Data API. */
(() => {
'use strict';
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const R = window.TERender;
const LS_CFG = 'te-admin-cfg', LS_DRAFT = 'te-admin-draft';
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const k in attrs) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); } kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c))); return e; };
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = t => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove('on'), 3200); };

/* ===================== state ===================== */
let C = null;               // текущий content
let loaded = null;          // снимок после загрузки / публикации
let remoteSha = null;       // sha content.json в репозитории (для проверки конфликтов)
let repoImages = [];        // имена файлов в assets/img репозитория
const pending = {};         // путь → { b64, url, size } — новые бинарные файлы
const deleted = new Set();  // пути к удалению
let current = 'site', curProduct = 0;
let cfg = loadCfg();

function loadCfg() {
  let c = {}; try { c = JSON.parse(localStorage.getItem(LS_CFG) || sessionStorage.getItem(LS_CFG) || '{}'); } catch (e) {}
  if (!c.owner && /\.github\.io$/.test(location.hostname)) {
    c.owner = location.hostname.split('.')[0];
    const seg = location.pathname.split('/').filter(Boolean);
    c.repo = seg.length > 1 ? seg[0] : location.hostname;
  }
  c.branch = c.branch || 'main'; c.prefix = c.prefix || ''; return c;
}
function saveCfg(c, remember) {
  cfg = c; const s = JSON.stringify(c);
  if (remember) { localStorage.setItem(LS_CFG, s); sessionStorage.removeItem(LS_CFG); }
  else { const pub = Object.assign({}, c, { token: '' }); localStorage.setItem(LS_CFG, JSON.stringify(pub)); sessionStorage.setItem(LS_CFG, s); }
}
const connected = () => !!(cfg.owner && cfg.repo && cfg.token);

/* ===================== GitHub API ===================== */
async function gh(path, opts = {}) {
  const r = await fetch((cfg.api || 'https://api.github.com') + '/repos/' + cfg.owner + '/' + cfg.repo + path, Object.assign({}, opts, { headers: Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + cfg.token }, opts.body ? { 'Content-Type': 'application/json' } : {}) }));
  if (!r.ok) { let m = r.status + ' ' + r.statusText; try { const j = await r.json(); m += ': ' + (j.message || ''); } catch (e) {} const err = new Error(m); err.status = r.status; throw err; }
  return r.status === 204 ? null : r.json();
}
const b64ToText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
const pre = p => (cfg.prefix ? cfg.prefix.replace(/^\/|\/$/g, '') + '/' : '') + p;
async function gitSha(bytes) { const head = new TextEncoder().encode('blob ' + bytes.length + '\0'); const buf = new Uint8Array(head.length + bytes.length); buf.set(head); buf.set(bytes, head.length); const h = await crypto.subtle.digest('SHA-1', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }

/* ===================== load ===================== */
async function load() {
  $('#ed').innerHTML = '<div class="loading">Загрузка данных…</div>';
  try {
    if (connected()) {
      const j = await gh('/contents/' + pre('content.json') + '?ref=' + encodeURIComponent(cfg.branch));
      C = JSON.parse(b64ToText(j.content)); remoteSha = j.sha;
      try { const l = await gh('/contents/' + pre('assets/img') + '?ref=' + encodeURIComponent(cfg.branch)); repoImages = l.filter(f => f.type === 'file').map(f => f.name); } catch (e) { repoImages = []; }
      setConn(true, `${cfg.owner}/${cfg.repo} · ${cfg.branch}`);
    } else {
      const r = await fetch('../content.json?ts=' + Date.now(), { cache: 'no-store' }); C = await r.json(); remoteSha = null; repoImages = [];
      setConn(false, 'Не подключено — изменения можно только экспортировать');
    }
  } catch (e) {
    setConn(false, 'Ошибка: ' + e.message);
    try { const r = await fetch('../content.json?ts=' + Date.now(), { cache: 'no-store' }); C = await r.json(); } catch (e2) { $('#ed').innerHTML = `<div class="banner warn">Не удалось загрузить content.json: ${esc(e.message)}. Откройте админку с опубликованного сайта или загрузите JSON через «Экспорт / импорт».</div>`; C = null; }
  }
  if (!C) return;
  loaded = clone(C);
  const d = getDraft();
  if (d && JSON.stringify(d.content) !== JSON.stringify(C)) draftBanner = d; else draftBanner = null;
  buildSide(); show(current); updateDirty(); pvPages(); refreshPreview();
}
let draftBanner = null;
function getDraft() { try { return JSON.parse(localStorage.getItem(LS_DRAFT) || 'null'); } catch (e) { return null; } }
function setConn(ok, text) { const s = $('#conn'); s.classList.toggle('ok', ok); s.querySelector('span').textContent = text; }

/* ===================== change tracking ===================== */
let saveT = 0, pvT = 0;
function changed() {
  updateDirty();
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LS_DRAFT, JSON.stringify({ at: Date.now(), content: C })); } catch (e) {} }, 500);
  clearTimeout(pvT); pvT = setTimeout(refreshPreview, 700);
}
function isDirty() { return JSON.stringify(C) !== JSON.stringify(loaded) || Object.keys(pending).length || deleted.size; }
function updateDirty() { $('#dirty').hidden = !isDirty(); }
addEventListener('beforeunload', e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

/* ===================== path helpers ===================== */
const getP = (o, p) => p.reduce((a, k) => a == null ? a : a[k], o);
function setP(o, p, v) { let a = o; for (let i = 0; i < p.length - 1; i++) { if (a[p[i]] == null) a[p[i]] = typeof p[i + 1] === 'number' ? [] : {}; a = a[p[i]]; } a[p[p.length - 1]] = v; }

/* ===================== schema DSL ===================== */
const T = (label, o = {}) => Object.assign({ t: 'text', label }, o);
const TA = (label, o = {}) => Object.assign({ t: 'textarea', label }, o);
const HT = (label, o = {}) => Object.assign({ t: 'html', label }, o);
const NUM = (label, o = {}) => Object.assign({ t: 'num', label }, o);
const BOOL = (label, o = {}) => Object.assign({ t: 'bool', label }, o);
const COLOR = label => ({ t: 'color', label });
const IMG = (label, o = {}) => Object.assign({ t: 'img', label }, o);
const IMGS = (label, o = {}) => Object.assign({ t: 'imgs', label }, o);
const SEL = (label, options, o = {}) => Object.assign({ t: 'sel', label, options }, o);
const PROD = (label, o = {}) => Object.assign({ t: 'prod', label }, o);
const ICON = label => ({ t: 'sel', label, options: [['', '— без иконки —'], ['truck', 'Грузовик'], ['card', 'Карта/рассрочка'], ['doc', 'Документ'], ['grad', 'Обучение'], ['shield', 'Щит/гарантия'], ['cert', 'Сертификат'], ['search', 'Поиск'], ['spark', 'Искра'], ['box', 'Коробка'], ['user', 'Человек'], ['move', 'Перевозка'], ['flow', 'Поток/график'], ['phone', 'Телефон'], ['pin', 'Метка'], ['map', 'Карта'], ['clock', 'Часы'], ['check', 'Галочка']] });
const STRS = (label, o = {}) => Object.assign({ t: 'strs', label }, o);
const LIST = (label, item, o = {}) => Object.assign({ t: 'list', label, item }, o);
const OBJ = (label, fields, o = {}) => Object.assign({ t: 'obj', label, fields }, o);
const MUSIC = label => ({ t: 'music', label });
const HEAD3 = { eyebrow: T('Надзаголовок (маленькая строка)'), title: T('Заголовок — основная часть'), accent: T('Заголовок — акцент курсивом'), lead: HT('Подзаголовок / вводный текст') };
const TOK = 'Можно использовать подстановки: {count} — число аппаратов, {countWord} — «аппаратов», {minPrice} — минимальная цена, {maxPrice} — максимальная.';

const SECTIONS = [
  { g: 'Главное' },
  { key: 'site', title: 'Сайт', desc: 'Название, адрес сайта, заставка, свой код.', fields: {
    name: T('Название бренда'), url: T('Адрес сайта (обязательно для SEO)', { hint: 'Полный адрес с / на конце: https://ваш-домен.ru/ или https://логин.github.io/репозиторий/. От него строятся canonical, sitemap.xml, robots.txt, Open Graph и разметка Schema.org.' }),
    cname: T('Свой домен для GitHub Pages (необязательно)', { hint: 'Например trend-esthetic.ru — будет создан файл CNAME. Затем пропишите DNS у регистратора (см. README).' }),
    brandSub: T('Подпись под брендом в шапке'), themeColor: COLOR('Цвет вкладки браузера (theme-color)'),
    intro: OBJ('Заставка при входе', { enabled: BOOL('Показывать заставку (один раз за визит)'), word: T('Слово на заставке'), caption: T('Подпись') }),
    creditText: T('Подпись разработчика в подвале'), creditUrl: T('Ссылка разработчика'),
    customCss: TA('Свой CSS (для любых правок дизайна)', { code: 1 }), customHead: TA('Свой код в <head> (счётчики, пиксели)', { code: 1 }), customBodyEnd: TA('Свой код перед </body>', { code: 1 }) } },
  { key: 'seo', title: 'SEO и соцсети', desc: 'Заголовок и описание главной страницы, регион, превью для мессенджеров. ' + TOK, fields: {
    title: TA('Title главной страницы (до ~70 символов в выдаче)', { rows: 2 }), description: TA('Meta description (до ~160 символов в выдаче)', { rows: 3 }), keywords: TA('Ключевые слова (meta keywords)', { rows: 3 }),
    ogTitle: T('Заголовок для соцсетей/мессенджеров'), ogDescription: TA('Описание для соцсетей', { rows: 2 }), ogImage: IMG('Картинка превью 1200×630'),
    city: T('Город'), region: T('Регион'), geoRegion: T('Код региона (RU-IRK)'), serviceArea: T('География работы (текст)'), areaServed: STRS('Города обслуживания (для разметки Schema.org)') } },
  { key: 'analytics', title: 'Аналитика и вебмастера', desc: 'Номера счётчиков и коды подтверждения — вставляются на все страницы автоматически.', fields: {
    yandexMetrikaId: T('Яндекс Метрика — номер счётчика', { hint: 'Только цифры, например 98765432. Цель «lead» отправляется при заявке.' }), googleAnalyticsId: T('Google Analytics 4 — ID (G-XXXX)'),
    yandexVerification: T('Яндекс Вебмастер — код подтверждения (content из meta-тега)'), googleVerification: T('Google Search Console — код подтверждения'), bingVerification: T('Bing Webmaster — код') } },
  { key: 'company', title: 'Компания и контакты', desc: 'Реквизиты, телефоны, адрес, соцсети — используются по всему сайту и в разметке для поисковиков.', fields: {
    legalForm: T('Форма'), legalName: T('Название (как в реквизитах)'), inn: T('ИНН'), ogrnip: T('ОГРНИП'), founded: T('Год основания'), founder: T('Основатель'), founderTitle: T('Должность основателя'),
    phone: OBJ('Основной телефон', { display: T('Как показывать'), tel: T('Для звонка (+7...)'), note: T('Подпись') }),
    phone2: OBJ('Второй телефон', { display: T('Как показывать'), tel: T('Для звонка'), note: T('Подпись') }),
    email: T('E-mail (необязательно)'),
    address: OBJ('Адрес', { street: T('Улица, дом'), city: T('Город'), region: T('Регион'), postal: T('Индекс'), country: T('Страна (код)'), note: T('Как найти'), short: T('Короткий адрес (на карте)') }),
    geo: OBJ('Координаты', { lat: NUM('Широта'), lng: NUM('Долгота') }),
    hours: OBJ('Часы работы', { text: T('Текст'), note: T('Подпись'), opens: T('Открытие (ЧЧ:ММ)'), closes: T('Закрытие (ЧЧ:ММ)') }),
    links: OBJ('Ссылки', { telegram: T('Telegram'), max: T('MAX'), instagram: T('Instagram'), twogis: T('2ГИС'), yandexMaps: T('Яндекс Карты'), allLinks: T('Страница «все ссылки»'), studioSite: T('Сайт студии') }),
    rating: OBJ('Рейтинг', { value: T('Оценка'), count: T('Отзывов'), source: T('Источник') }) } },
  { key: 'theme', title: 'Цвета', desc: 'Палитра сайта. Изменения сразу видны в предпросмотре.', custom: 'colors' },
  { key: 'music', title: 'Музыка', desc: 'Фоновая музыка с кнопкой включения/выключения. Браузеры разрешают звук только после первого клика/касания посетителя — до этого кнопка подсветится подсказкой.', fields: {
    enabled: BOOL('Музыка на сайте'), autoplay: BOOL('Включать автоматически'), file: MUSIC('Файл (mp3)'), title: T('Название трека (подсказка на кнопке)'), volume: NUM('Громкость (0…1)', { step: .05, min: 0, max: 1 }) } },
  { g: 'Страница' },
  { key: 'header', title: 'Шапка и меню', fields: { ubarLeft: T('Верхняя строка — слева'), ubarItems: STRS('Верхняя строка — пункты справа'), ubarLinkText: T('Ссылка — текст'), ubarLinkUrl: T('Ссылка — адрес'), cta: T('Кнопка в шапке'), nav: LIST('Меню (компьютер)', { label: T('Текст'), href: T('Ссылка (#catalog или https://…)') }), mobileNav: LIST('Меню (телефон)', { label: T('Текст'), href: T('Ссылка'), num: T('Номер справа ({count} — число аппаратов)') }) } },
  { key: 'home', title: 'Порядок блоков', desc: 'Перетаскивайте стрелками, выключайте ненужные блоки главной страницы.', custom: 'order' },
  { key: 'hero', title: 'Первый экран', fields: {
    seoLine: T('SEO-строка над заголовком (входит в H1 — пишите ключевую фразу с городом)'), titleLines: STRS('Строки большого заголовка'), titleAccent: T('Акцент заголовка (золотым курсивом)'),
    lead: HT('Текст под заголовком'), ctaPrimary: T('Кнопка 1 (подбор)'), ctaSecondary: T('Кнопка 2 (каталог)'), quote: T('Цитата под кнопками'),
    image: IMG('Главное фото'), imageAlt: T('Описание фото (alt, для SEO)'), subImage: IMG('Маленькое фото поверх'), chip: T('Плашка на фото'), wavelengths: STRS('Плашки длин волн'),
    cardProduct: PROD('Товар в карточке на фото'), cardLabel: T('Подпись над названием товара'), spec: STRS('Вертикальная подпись справа'),
    stats: LIST('Цифры под первым экраном', { value: T('Значение ({count} — число аппаратов)'), countUp: BOOL('Анимировать счётчиком'), suffix: T('Суффикс (например «+ лет»)'), text: T('Подпись ({countWord}, {minPrice})') }) } },
  { key: 'marquee', title: 'Бегущая строка', custom: 'strs-root', label: 'Фразы бегущей строки' },
  { key: 'market', title: '01 · Рынок', fields: Object.assign({}, HEAD3, { stats: LIST('Карточки с цифрами', { k: T('Подпись сверху'), n: T('Цифра'), text: HT('Текст') }), footnote: T('Сноска') }) },
  { key: 'route', title: 'Поставка (маршрут)', fields: Object.assign({}, HEAD3, { steps: LIST('Этапы', { code: T('Код (01 · Подбор)'), title: T('Заголовок'), text: TA('Текст') }), proof: LIST('Фото-доказательства', { img: IMG('Фото'), alt: T('Alt'), caption: T('Подпись') }), docTitle: T('Карточка «С аппаратом вы получаете» — заголовок'), docItems: STRS('Пункты') }) },
  { key: 'tech', title: '02 · Технология', fields: Object.assign({}, HEAD3, {
    steps: LIST('Шаги схемы (прокрутка)', { tag: T('Метка на схеме'), title: T('Заголовок'), text: HT('Текст'), follicle: NUM('Температура фолликула'), skin: NUM('Температура кожи') }),
    ptEyebrow: T('Фототипы — надзаголовок'), ptTitle: T('Фототипы — заголовок'), ptAccent: T('Фототипы — акцент'), ptLead: HT('Фототипы — текст'),
    phototypes: LIST('Фототипы', { color: COLOR('Цвет кружка'), title: T('Название'), sub: T('Описание'), waves: STRS('Длины волн (755/808/1064)'), main: T('Основная волна'), text: HT('Пояснение') }),
    facts: LIST('Факты', { b: T('Крупно'), s: T('Подпись') }), resEyebrow: T('Результат — надзаголовок'), resTitle: T('Результат — заголовок'), resAccent: T('Результат — акцент'), resLead: HT('Результат — текст'),
    before: OBJ('Фото «До»', { img: IMG('Фото'), alt: T('Alt'), label: T('Подпись') }), after: OBJ('Фото «После»', { img: IMG('Фото'), alt: T('Alt'), label: T('Подпись') }),
    progress: LIST('Слайдер по сеансам', { img: IMG('Фото'), label: T('Подпись') }) }) },
  { key: 'catalog', title: '03 · Каталог (тексты)', desc: TOK, fields: Object.assign({}, HEAD3, {
    techIndexTitle: T('Заголовок строки технологий'), techIndex: STRS('Технологии'), priceNote: T('Подпись к цене'), priceRequestNote: T('Подпись, если цена «по запросу»'), sheetNotes: STRS('Плашки в карточке товара'),
    categories: LIST('Категории (у каждой — своя SEO-страница /katalog/…/)', { key: T('Ключ (латиницей, не меняйте у существующих)'), label: T('Короткое название (фильтр)'), name: T('Полное название (H1 страницы)'), slug: T('Адрес страницы (латиницей)'), seoTitle: TA('SEO title', { rows: 2 }), seoDescription: TA('SEO description', { rows: 3 }), intro: HT('Текст на странице категории') }),
    compare: OBJ('Таблица сравнения', Object.assign({}, HEAD3, { headers: STRS('Заголовки столбцов'), rows: LIST('Строки', { id: PROD('Товар'), note: T('Подпись'), power: T('Мощность (текст)'), powerVal: NUM('Мощность (число для полоски)'), res: T('Ресурс (текст)'), resVal: NUM('Ресурс (число)'), spot: T('Пятно'), screen: T('Экран'), apower: T('Мощность аппарата') }), footer: T('Строка под таблицей'), hint: T('Подсказка на телефоне') })),
    tips: LIST('Подсказки под таблицей', { icon: ICON('Иконка'), title: T('Заголовок'), text: TA('Текст') }) }) },
  { key: 'products', title: 'Товары', custom: 'products' },
  { key: 'studio', title: '04 · Студия (используем сами)', fields: Object.assign({}, HEAD3, { btnPrimary: T('Кнопка — сайт студии'), btnSecondary: T('Кнопка — записаться'),
    services: LIST('Услуги студии', { img: IMG('Фото'), badge: T('Плашка на фото'), title: T('Название'), text: TA('Описание'), rows: LIST('Строки (цены/условия)', { name: T('Слева'), value: T('Справа') }), device: PROD('Аппарат'), deviceLabel: T('Подпись над аппаратом') }),
    band: LIST('Полоса фактов', { b: T('Крупно'), s: T('Подпись') }), tryTitle: T('Блок «Попробуйте» — заголовок'), tryText: TA('Текст'), tryBtn: T('Кнопка'), railTitle: T('Галерея — заголовок'), railAccent: T('Галерея — акцент'),
    rail: LIST('Галерея «Оборудование в наших кабинетах»', { img: IMG('Фото'), caption: T('Подпись') }) }) },
  { key: 'roi', title: '05 · Окупаемость', fields: Object.assign({}, HEAD3, { defaultProduct: PROD('Аппарат по умолчанию'), check: NUM('Средний чек по умолчанию'), perDay: NUM('Клиентов в день'), days: NUM('Рабочих дней'), costs: NUM('Расходы в месяц'), quick: LIST('Кнопки с ценами студии', { name: T('Название'), value: NUM('Цена') }), costsHint: T('Подсказка к расходам'), disclaimer: TA('Оговорка'), btn: T('Кнопка') }) },
  { key: 'why', title: '06 · Условия', fields: Object.assign({}, HEAD3, { tiles: LIST('Плитки', { style: SEL('Вид', [['plain', 'Светлая'], ['fire', 'Тёмная'], ['photo', 'С фото']]), img: IMG('Фото (для вида «С фото»)'), alt: T('Alt'), icon: ICON('Иконка'), big: T('Крупная цифра вместо иконки'), title: T('Заголовок'), text: TA('Текст'), quizBtn: T('Кнопка подбора (если нужна)') }) }) },
  { key: 'founder', title: '07 · Основатель', fields: { eyebrow: T('Надзаголовок'), name1: T('Имя'), name2: T('Фамилия (курсивом)'), roles: STRS('Роли'), paragraphs: STRS('Абзацы', { html: 1 }), quote: TA('Цитата'), quoteCite: T('Подпись цитаты'), stats: LIST('Цифры', { b: T('Крупно'), s: T('Подпись') }), photo: IMG('Фото'), photoAlt: T('Alt'), photo2: IMG('Второе фото'), photo2Alt: T('Alt'), stamp: T('Текст на круглом штампе') } },
  { key: 'geo', title: '08 · География', desc: 'Важно для поиска по Иркутской области: перечислите города, куда возите оборудование.', fields: Object.assign({}, HEAD3, { cards: LIST('Карточки', { title: T('Заголовок'), text: TA('Текст') }), cities: STRS('Города'), note: T('Подпись под городами') }) },
  { key: 'showroom', title: '09 · Шоурум и контакты', fields: Object.assign({}, HEAD3, { photos: LIST('Фото', { img: IMG('Фото'), alt: T('Alt'), caption: T('Подпись') }), mapBtn: T('Кнопка карты') }) },
  { key: 'about', title: 'О компании (SEO-текст)', desc: 'Развёрнутый текст для поисковиков и ИИ-ассистентов. Пишите полезно и по делу, с городами и названиями аппаратов. ' + TOK, fields: { eyebrow: T('Надзаголовок'), title: T('Заголовок'), accent: T('Акцент'), html: HT('Текст (HTML: <p>, <b>, <a>)', { rows: 14 }), factsTitle: T('Заголовок блока фактов') } },
  { key: 'faq', title: '10 · Вопросы', desc: 'Вопросы попадают в разметку FAQPage — их цитируют поисковики и ИИ. ' + TOK, fields: Object.assign({}, HEAD3, { items: LIST('Вопросы и ответы', { q: T('Вопрос'), a: HT('Ответ') }) }) },
  { key: 'lead', title: 'Заявка', desc: 'Если указать адрес вебхука, заявки будут отправляться туда (например, на ваш Telegram-бот через сервис-посредник). Иначе текст заявки копируется и открывается Telegram.', fields: Object.assign({}, HEAD3, { altTelegram: T('Подпись Telegram'), altMax: T('Подпись MAX'), want: STRS('Варианты «Что интересует»'), pay: STRS('Варианты оплаты'), consent: T('Текст согласия'), submit: T('Кнопка'), successTitle: T('Успех — заголовок'), successText: TA('Успех — текст'), telegramUser: T('Telegram для заявок (логин без @)'), webhookUrl: T('Вебхук для заявок (POST JSON, необязательно)') }) },
  { key: 'footer', title: 'Подвал', fields: { about: TA('Текст о компании'), companyLinks: LIST('Ссылки «Компания»', { label: T('Текст'), href: T('Ссылка') }), disclaimer: TA('Оговорка'), instagramNote: T('Сноска про Instagram'), bigWord: T('Большое слово внизу') } },
  { key: 'quiz', title: 'Подбор аппарата (квиз)', fields: { questions: LIST('Вопросы', { key: SEL('Тип вопроса (не меняйте)', [['cat', 'Направление (cat)'], ['space', 'Помещение (space)'], ['budget', 'Бюджет (budget)']]), title: T('Вопрос'), options: LIST('Ответы', { v: T('Значение (cat: epil/body/face/multi; space: small/room/flow; budget: число)'), t: T('Текст'), d: T('Подпись') }) }), resultTitle: T('Заголовок результата'), overNote: TA('Подсказка, если не хватило бюджета'), resultBtn: T('Кнопка результата') } },
  { g: 'Файлы и сервис' },
  { key: 'media', title: 'Медиатека', custom: 'media' },
  { key: 'io', title: 'Экспорт / импорт', custom: 'io' },
  { key: 'help', title: 'Помощь', custom: 'help' },
];
const PRODUCT = {
  name: T('Название'), kind: T('Тип (подпись над названием)'), cat: { t: 'cat', label: 'Категория' }, price: NUM('Цена, ₽ (пусто — «По запросу»)'),
  availability: SEL('Наличие (для Schema.org)', [['InStock', 'В наличии'], ['PreOrder', 'Под заказ'], ['BackOrder', 'Ожидается'], ['OutOfStock', 'Нет в наличии']]), hidden: BOOL('Скрыть товар с сайта'),
  slug: { t: 'slug', label: 'Адрес страницы /apparaty/…/ (латиницей)' }, id: T('ID (технический, латиницей; меняйте только у новых товаров)'),
  img: IMG('Фото для карточки'), fit: SEL('Как вписывать фото', [['cover', 'Заполнить (фото)'], ['contain', 'Целиком (вырезанный аппарат)']]), pos: T('Фокус кадра (например 50% 30%)'), imgAlt: T('Alt фото (для SEO)'),
  badges: LIST('Плашки', { type: SEL('Вид', [['live', 'Зелёная точка («В нашей студии»)'], ['f', 'Золотая'], ['l', 'Светлая']]), text: T('Текст') }),
  chips: STRS('Короткие характеристики на карточке'), lead: TA('Короткое описание', { rows: 3 }), description: HT('Подробное описание (на странице товара)'),
  gallery: IMGS('Галерея'), feats: STRS('Особенности и преимущества', { area: 1 }), specs: LIST('Технические характеристики', { name: T('Параметр'), value: T('Значение') }),
  tags: { t: 'tags', label: 'Метки для подбора', options: [['flow', 'Для потока клиентов'], ['compact', 'Компактный'], ['mobile', 'Для выездов'], ['budget', 'Бюджетный'], ['multi', 'Многофункциональный']] },
  seoTitle: TA('SEO title (пусто — сформируется автоматически)', { rows: 2 }), seoDescription: TA('SEO description (пусто — автоматически)', { rows: 3 }),
};

/* ===================== sidebar ===================== */
function buildSide() {
  const s = $('#side'); s.innerHTML = '';
  SECTIONS.forEach(x => {
    if (x.g) { s.append(el('h4', {}, x.g)); return; }
    const extra = x.key === 'products' ? ` ${(C.products || []).length}` : x.key === 'media' ? ` ${allImages().length}` : '';
    s.append(el('button', { type: 'button', 'data-k': x.key, class: x.key === current ? 'on' : '', onclick: () => show(x.key) }, x.title, extra ? el('small', {}, extra.trim()) : null));
  });
}
function show(key) {
  current = key; $$('#side button').forEach(b => b.classList.toggle('on', b.dataset.k === key));
  const sec = SECTIONS.find(x => x.key === key); const ed = $('#ed'); ed.innerHTML = ''; ed.scrollTop = 0;
  if (draftBanner) ed.append(el('div', { class: 'banner' }, `Найден несохранённый черновик от ${new Date(draftBanner.at).toLocaleString('ru-RU')}.`, el('button', { class: 'b sm gold', type: 'button', onclick: () => { C = draftBanner.content; draftBanner = null; changed(); buildSide(); show(current); toast('Черновик восстановлен'); } }, 'Восстановить'), el('button', { class: 'b sm ghost', type: 'button', onclick: () => { localStorage.removeItem(LS_DRAFT); draftBanner = null; show(current); } }, 'Удалить черновик')));
  if (C.site && /USERNAME|REPO/.test(C.site.url || '')) {
    const guess = cfg.owner && cfg.repo ? (cfg.repo.toLowerCase() === (cfg.owner + '.github.io').toLowerCase() ? `https://${cfg.owner.toLowerCase()}.github.io/` : `https://${cfg.owner.toLowerCase()}.github.io/${cfg.repo}/`) : '';
    ed.append(el('div', { class: 'banner warn' }, 'Укажите настоящий адрес сайта в разделе «Сайт» — без него canonical, sitemap и разметка для поисковиков будут неверными.',
      guess ? el('button', { class: 'b sm gold', type: 'button', onclick: () => { C.site.url = guess; changed(); show(current); toast('Адрес подставлен: ' + guess + ' — опубликуйте изменения'); } }, 'Подставить ' + guess) : null,
      el('button', { class: 'b sm', type: 'button', onclick: () => show('site') }, 'Открыть')));
  }
  ed.append(el('h1', {}, sec.title)); if (sec.desc) ed.append(el('p', { class: 'desc' }, sec.desc));
  if (sec.custom) return CUSTOM[sec.custom](ed, sec);
  if (!C[key]) C[key] = {};
  renderFields(ed, sec.fields, [key]);
  pvFollow(key);
}

/* ===================== field renderers ===================== */
function renderFields(box, fields, path) { for (const k in fields) box.append(field(fields[k], path.concat(k))); }
function wrap(f, ...kids) { const w = el('div', { class: 'f' }); if (f.label) w.append(el('label', {}, f.label)); kids.forEach(k => w.append(k)); if (f.hint) w.append(el('div', { class: 'hint' }, f.hint)); return w; }
function field(f, path) {
  const v = getP(C, path);
  const upd = val => { setP(C, path, val); changed(); };
  switch (f.t) {
    case 'text': { const i = el('input', { type: 'text', value: v == null ? '' : v }); i.addEventListener('input', () => upd(i.value)); return wrap(f, i); }
    case 'textarea': { const i = el('textarea', { rows: f.rows || 3, class: f.code ? 'code' : '' }); i.value = v == null ? '' : v; i.addEventListener('input', () => upd(i.value)); return wrap(f, i); }
    case 'html': { const i = el('textarea', { rows: f.rows || 4 }); i.value = v == null ? '' : v; i.addEventListener('input', () => upd(i.value)); return wrap(f, htmlBar(i), i, el('div', { class: 'hint' }, 'Можно HTML: <b>жирный</b>, <i>курсив</i>, <a href="…">ссылка</a>, <br>.')); }
    case 'num': { const i = el('input', { type: 'number', value: v == null ? '' : v, step: f.step || 'any', min: f.min, max: f.max }); i.addEventListener('input', () => upd(i.value === '' ? null : +i.value)); return wrap(f, i); }
    case 'bool': { const i = el('input', { type: 'checkbox' }); i.checked = !!v; i.addEventListener('change', () => upd(i.checked)); const l = el('label', { class: 'chk' }, i, f.label); const w = el('div', { class: 'f' }, l); if (f.hint) w.append(el('div', { class: 'hint' }, f.hint)); return w; }
    case 'color': { const c = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000' }), t = el('input', { type: 'text', value: v || '' }); c.addEventListener('input', () => { t.value = c.value; upd(c.value); }); t.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) c.value = t.value; upd(t.value); }); return wrap(f, el('div', { class: 'color' }, c, t)); }
    case 'sel': { const s = el('select'); f.options.forEach(([val, lab]) => s.append(el('option', { value: val, selected: String(v == null ? '' : v) === String(val) }, lab))); s.addEventListener('change', () => upd(s.value)); return wrap(f, s); }
    case 'prod': { const s = el('select'); s.append(el('option', { value: '' }, '— не выбран —')); (C.products || []).forEach(p => s.append(el('option', { value: p.id, selected: p.id === v }, `${p.name} (${p.id})`))); s.addEventListener('change', () => upd(s.value)); return wrap(f, s); }
    case 'cat': { const s = el('select'); ((C.catalog || {}).categories || []).forEach(k => s.append(el('option', { value: k.key, selected: k.key === v }, k.name || k.label))); s.addEventListener('change', () => { upd(s.value); refreshPList(); }); return wrap(f, s); }
    case 'slug': { const i = el('input', { type: 'text', value: v || '' }); i.addEventListener('input', () => upd(i.value.trim())); const b = el('button', { class: 'b sm ghost', type: 'button', onclick: () => { const p = getP(C, path.slice(0, -1)); i.value = R.slugify(p.name); upd(i.value); } }, 'Из названия'); return wrap(f, el('div', { class: 'imgf' }, i, b)); }
    case 'tags': { const box = el('div', { class: 'grid2' }); const cur = Array.isArray(v) ? v.slice() : []; f.options.forEach(([val, lab]) => { const c = el('input', { type: 'checkbox' }); c.checked = cur.includes(val); c.addEventListener('change', () => { const a = (getP(C, path) || []).filter(x => x !== val); if (c.checked) a.push(val); upd(a); }); box.append(el('label', { class: 'chk' }, c, lab)); }); return wrap(f, box); }
    case 'img': return imgField(f, path, v, upd);
    case 'imgs': return imgsField(f, path);
    case 'music': return musicField(f, path, v, upd);
    case 'strs': return strsField(f, path);
    case 'obj': { const g = el('div', { class: 'grp' }, el('h3', {}, f.label)); if (getP(C, path) == null) setP(C, path, {}); renderFields(g, f.fields, path); return g; }
    case 'list': return listField(f, path);
  }
  return el('div');
}
function htmlBar(ta) {
  const wrapSel = (a, b) => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(a + ta.value.slice(s, e) + b, s, e, 'end'); ta.dispatchEvent(new Event('input')); ta.focus(); };
  return el('div', { class: 'html-bar' }, el('button', { type: 'button', onclick: () => wrapSel('<b>', '</b>') }, 'Ж'), el('button', { type: 'button', onclick: () => wrapSel('<i>', '</i>') }, 'К'), el('button', { type: 'button', onclick: () => { const u = prompt('Адрес ссылки', 'https://'); if (u) wrapSel(`<a href="${u}" target="_blank" rel="noopener">`, '</a>'); } }, 'Ссылка'), el('button', { type: 'button', onclick: () => wrapSel('<br>', '') }, 'Перенос'));
}
function strsField(f, path) {
  if (!Array.isArray(getP(C, path))) setP(C, path, []);
  const box = el('div', { class: 'strs' });
  const draw = () => {
    box.innerHTML = ''; const a = getP(C, path);
    a.forEach((s, i) => {
      const inp = f.area || f.html ? el('textarea', { rows: f.html ? 3 : 2 }) : el('input', { type: 'text' }); inp.value = s;
      inp.addEventListener('input', () => { a[i] = inp.value; changed(); });
      box.append(el('div', { class: 'row' }, inp, el('button', { class: 'ib', type: 'button', title: 'Выше', onclick: () => { if (i) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } } }, '↑'), el('button', { class: 'ib', type: 'button', title: 'Ниже', onclick: () => { if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed(); draw(); } } }, '↓'), el('button', { class: 'ib del', type: 'button', title: 'Удалить', onclick: () => { a.splice(i, 1); changed(); draw(); } }, '✕')));
    });
    box.append(el('button', { class: 'b sm ghost', type: 'button', onclick: () => { a.push(''); changed(); draw(); const l = box.querySelectorAll('input,textarea'); l[l.length - 1] && l[l.length - 1].focus(); } }, '+ Добавить'));
  };
  draw(); return wrap(f, box);
}
function blank(itemSchema) { const o = {}; for (const k in itemSchema) { const s = itemSchema[k]; o[k] = s.t === 'num' ? null : s.t === 'bool' ? false : s.t === 'strs' || s.t === 'list' || s.t === 'imgs' || s.t === 'tags' ? [] : s.t === 'obj' ? blank(s.fields) : s.t === 'sel' ? s.options[0][0] : ''; } return o; }
function itemTitle(it, i) { if (typeof it !== 'object' || !it) return String(it); for (const k of ['title', 'label', 'name', 'q', 'caption', 'text', 'k', 'b', 'code', 'id', 'img']) if (it[k]) return String(it[k]).replace(/<[^>]+>/g, '').slice(0, 90); return 'Элемент ' + (i + 1); }
function listField(f, path) {
  if (!Array.isArray(getP(C, path))) setP(C, path, []);
  const box = el('div', { class: 'lst' }), openSet = new Set();
  const draw = () => {
    box.innerHTML = ''; const a = getP(C, path);
    a.forEach((it, i) => {
      const body = el('div', { class: 'it-b' }); const imgKey = Object.keys(f.item).find(k => f.item[k].t === 'img');
      const title = el('b', {}, itemTitle(it, i));
      const head = el('div', { class: 'it-h', onclick: e => { if (e.target.closest('.ib')) return; card.classList.toggle('open'); card.classList.contains('open') ? openSet.add(i) : openSet.delete(i); if (card.classList.contains('open') && !body.childNodes.length) renderFields(body, f.item, path.concat(i)); } },
        el('span', { class: 'n' }, String(i + 1)), imgKey && it[imgKey] ? el('img', { src: imgUrl(it[imgKey]), alt: '' }) : null, title,
        el('button', { class: 'ib', type: 'button', title: 'Выше', onclick: () => { if (i) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } } }, '↑'),
        el('button', { class: 'ib', type: 'button', title: 'Ниже', onclick: () => { if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed(); draw(); } } }, '↓'),
        el('button', { class: 'ib', type: 'button', title: 'Дублировать', onclick: () => { a.splice(i + 1, 0, clone(it)); changed(); draw(); } }, '⧉'),
        el('button', { class: 'ib del', type: 'button', title: 'Удалить', onclick: () => { if (confirm('Удалить элемент?')) { a.splice(i, 1); changed(); draw(); } } }, '✕'));
      const card = el('div', { class: 'it' + (openSet.has(i) ? ' open' : '') }, head, body);
      if (openSet.has(i)) renderFields(body, f.item, path.concat(i));
      body.addEventListener('input', () => { title.textContent = itemTitle(getP(C, path)[i], i); });
      box.append(card);
    });
    box.append(el('button', { class: 'b sm ghost', type: 'button', onclick: () => { a.push(blank(f.item)); openSet.add(a.length - 1); changed(); draw(); } }, '+ Добавить'));
  };
  draw(); const w = wrap(f, box); return w;
}

/* ===================== images ===================== */
function imgUrl(n) {
  if (!n) return ''; if (/^(https?:|data:|blob:)/.test(n)) return n;
  const p = 'assets/img/' + n; if (pending[p]) return pending[p].url; return '../assets/img/' + n;
}
function allImages() {
  const s = new Set(repoImages); JSON.stringify(C || {}).replace(/"([\w.-]+\.(?:webp|jpg|jpeg|png|svg|gif))"/g, (_, f) => s.add(f));
  Object.keys(pending).filter(p => p.startsWith('assets/img/')).forEach(p => s.add(p.slice(11)));
  return [...s].filter(n => !deleted.has('assets/img/' + n)).sort();
}
function imgField(f, path, v, upd) {
  const th = el('div', { class: 'th', style: v ? `background-image:url("${imgUrl(v)}")` : '' });
  const i = el('input', { type: 'text', value: v || '', placeholder: 'имя файла в assets/img' });
  const set = n => { i.value = n; th.style.backgroundImage = n ? `url("${imgUrl(n)}")` : ''; upd(n); };
  i.addEventListener('change', () => set(i.value.trim()));
  return wrap(f, el('div', { class: 'imgf' }, th, i, el('button', { class: 'b sm', type: 'button', onclick: () => pick(set) }, 'Выбрать'), el('button', { class: 'ib del', type: 'button', title: 'Очистить', onclick: () => set('') }, '✕')));
}
function imgsField(f, path) {
  if (!Array.isArray(getP(C, path))) setP(C, path, []);
  const box = el('div', { class: 'imgs' });
  const draw = () => { box.innerHTML = ''; const a = getP(C, path);
    a.forEach((n, i) => box.append(el('div', { class: 'cell', title: n, style: `background-image:url("${imgUrl(n)}")` }, el('div', { class: 'ops' }, el('button', { class: 'ib', type: 'button', onclick: () => { if (i) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed(); draw(); } } }, '←'), el('button', { class: 'ib del', type: 'button', onclick: () => { a.splice(i, 1); changed(); draw(); } }, '✕'), el('button', { class: 'ib', type: 'button', onclick: () => { if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed(); draw(); } } }, '→')))));
    box.append(el('button', { class: 'add', type: 'button', title: 'Добавить фото', onclick: () => pick(n => { a.push(n); changed(); draw(); }, true) }, '+'));
  };
  draw(); return wrap(f, box, el('div', { class: 'hint' }, 'Первое фото — главное на странице товара. Стрелками меняйте порядок.'));
}
async function toWebp(file) {
  if (/svg|gif/.test(file.type)) return { blob: file, ext: file.type.includes('svg') ? 'svg' : 'gif' };
  const bmp = await createImageBitmap(file); let w = bmp.width, h = bmp.height; const k = Math.min(1, 1800 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(r => cv.toBlob(r, 'image/webp', .84)); return { blob, ext: 'webp' };
}
const blobB64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
async function upload(files) {
  const names = [];
  for (const file of files) {
    const { blob, ext } = await toWebp(file);
    let base = R.slugify(file.name.replace(/\.[^.]+$/, '')) || 'img', name = base + '.' + ext, n = 2; const all = allImages();
    while (all.includes(name)) name = `${base}-${n++}.${ext}`;
    pending['assets/img/' + name] = { b64: await blobB64(blob), url: URL.createObjectURL(blob), size: blob.size };
    names.push(name);
  }
  changed(); buildSide(); toast(`Загружено: ${names.length}. Файлы уйдут на GitHub при публикации.`); return names;
}
let pickCb = null, pickMulti = false;
function pick(cb, multi) { pickCb = cb; pickMulti = !!multi; $('#pkTitle').textContent = multi ? 'Добавить фото (можно несколько по очереди)' : 'Выбор изображения'; drawPicker(); $('#dlgPicker').showModal(); }
function drawPicker() {
  const q = ($('#pkSearch').value || '').toLowerCase(), g = $('#pkGrid'); g.innerHTML = '';
  allImages().filter(n => n.toLowerCase().includes(q)).forEach(n => g.append(el('div', { class: 'mc', onclick: () => { pickCb && pickCb(n); if (!pickMulti) $('#dlgPicker').close(); else toast('Добавлено: ' + n); } }, pending['assets/img/' + n] ? el('span', { class: 'tag' }, 'новое') : null, el('div', { class: 'im', style: `background-image:url("${imgUrl(n)}")` }), el('div', { class: 'nm' }, n))));
}
$('#pkSearch').addEventListener('input', drawPicker);
$('#pkUpload').addEventListener('change', async e => { const names = await upload([...e.target.files]); e.target.value = ''; drawPicker(); if (names.length && pickCb) { if (pickMulti) names.forEach(n => pickCb(n)); else { pickCb(names[0]); $('#dlgPicker').close(); } } });
function musicField(f, path, v, upd) {
  const i = el('input', { type: 'text', value: v || '' }); i.addEventListener('change', () => upd(i.value.trim()));
  const up = el('input', { type: 'file', accept: 'audio/mpeg,audio/mp3,.mp3', hidden: true });
  up.addEventListener('change', async () => { const file = up.files[0]; if (!file) return; if (file.size > 40 * 1048576) { toast('Файл больше 40 МБ — сожмите mp3'); return; } const name = (R.slugify(file.name.replace(/\.[^.]+$/, '')) || 'music') + '.mp3'; pending['assets/music/' + name] = { b64: await blobB64(file), url: URL.createObjectURL(file), size: file.size }; i.value = name; upd(name); toast('Трек загружен, уйдёт на GitHub при публикации'); });
  const audio = el('audio', { controls: true, preload: 'none', style: 'width:100%;margin-top:6px' }); const setSrc = () => { const p = 'assets/music/' + i.value; audio.src = pending[p] ? pending[p].url : '../assets/music/' + i.value; }; setSrc(); i.addEventListener('change', setSrc); up.addEventListener('change', () => setTimeout(setSrc, 300));
  return wrap(f, el('div', { class: 'imgf' }, i, el('label', { class: 'b sm' }, 'Загрузить mp3', up)), audio, el('div', { class: 'hint' }, 'Используйте музыку, на которую у вас есть права (стоки с лицензией, royalty-free). Коммерческие треки известных исполнителей могут привести к жалобам правообладателей и блокировке сайта.'));
}

/* ===================== custom sections ===================== */
const ORDER_NAMES = { hero: 'Первый экран', marquee: 'Бегущая строка', market: 'Рынок', route: 'Поставка', tech: 'Технология', catalog: 'Каталог', studio: 'Студия', roi: 'Окупаемость', why: 'Условия', founder: 'Основатель', geo: 'География', showroom: 'Шоурум', about: 'О компании (SEO)', faq: 'Вопросы', lead: 'Заявка' };
const CUSTOM = {
  colors(ed) {
    const t = C.theme = C.theme || {}; const names = { ink: 'Фон тёмный (основной)', ink2: 'Фон тёмный 2', ink3: 'Фон тёмный 3', ink4: 'Фон тёмный 4', paper: 'Фон светлый', paper2: 'Фон светлый 2', paper3: 'Фон светлый 3', brassLight: 'Латунь светлая', brass: 'Латунь (акцент)', brassDark: 'Латунь тёмная', emerald: 'Изумруд', emeraldLight: 'Изумруд светлый', cool: 'Охлаждение (схема)', textOnDark: 'Текст на тёмном', mutedOnDark: 'Приглушённый на тёмном', textOnLight: 'Текст на светлом', mutedOnLight: 'Приглушённый на светлом' };
    const box = el('div', { class: 'colors' }); for (const k in names) box.append(field(COLOR(names[k]), ['theme', k])); ed.append(box);
    ed.append(el('p', { class: 'desc', style: 'margin-top:16px' }, 'Чтобы вернуть исходную палитру, импортируйте старый content.json или впишите значения вручную.'));
  },
  'strs-root'(ed, sec) { ed.append(strsField({ label: sec.label }, [sec.key])); },
  order(ed) {
    const h = C.home = C.home || {}; h.order = h.order && h.order.length ? h.order : Object.keys(ORDER_NAMES); h.hidden = h.hidden || [];
    Object.keys(ORDER_NAMES).forEach(k => { if (!h.order.includes(k)) h.order.push(k); });
    const box = el('div', { class: 'order' });
    const draw = () => { box.innerHTML = ''; h.order.forEach((k, i) => { const off = h.hidden.includes(k); const c = el('input', { type: 'checkbox' }); c.checked = !off; c.addEventListener('change', () => { h.hidden = h.hidden.filter(x => x !== k); if (!c.checked) h.hidden.push(k); changed(); draw(); }); box.append(el('div', { class: 'o' + (off ? ' off' : '') }, c, el('b', {}, ORDER_NAMES[k] || k), el('button', { class: 'ib', type: 'button', onclick: () => { if (i) { [h.order[i - 1], h.order[i]] = [h.order[i], h.order[i - 1]]; changed(); draw(); } } }, '↑'), el('button', { class: 'ib', type: 'button', onclick: () => { if (i < h.order.length - 1) { [h.order[i + 1], h.order[i]] = [h.order[i], h.order[i + 1]]; changed(); draw(); } } }, '↓'))); }); };
    draw(); ed.append(box);
  },
  products(ed) {
    const P = C.products = C.products || [];
    const wrapEl = el('div', { class: 'prods' }), list = el('div', { class: 'plist', id: 'plist' }), form = el('div', { id: 'pform' });
    const search = el('input', { type: 'search', placeholder: 'Поиск товара' });
    const tools = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px' },
      el('button', { class: 'b sm gold', type: 'button', onclick: () => { const n = blank(PRODUCT); n.id = 'item-' + Date.now().toString(36); n.name = 'Новый аппарат'; n.slug = n.id; n.cat = ((C.catalog || {}).categories || [{}])[0].key || 'epil'; n.fit = 'cover'; n.availability = 'InStock'; P.push(n); curProduct = P.length - 1; changed(); buildSide(); CUSTOM.products(clear()); } }, '+ Новый товар'),
      el('button', { class: 'b sm', type: 'button', onclick: () => { const c = clone(P[curProduct]); c.id += '-copy'; c.slug += '-copy'; c.name += ' (копия)'; P.splice(curProduct + 1, 0, c); curProduct++; changed(); buildSide(); CUSTOM.products(clear()); } }, '⧉ Копия'),
      el('button', { class: 'b sm', type: 'button', onclick: () => { if (curProduct > 0) { [P[curProduct - 1], P[curProduct]] = [P[curProduct], P[curProduct - 1]]; curProduct--; changed(); CUSTOM.products(clear()); } } }, '↑'),
      el('button', { class: 'b sm', type: 'button', onclick: () => { if (curProduct < P.length - 1) { [P[curProduct + 1], P[curProduct]] = [P[curProduct], P[curProduct + 1]]; curProduct++; changed(); CUSTOM.products(clear()); } } }, '↓'),
      el('button', { class: 'b sm red', type: 'button', onclick: () => { if (P[curProduct] && confirm(`Удалить «${P[curProduct].name}»? Страница товара тоже будет удалена при публикации.`)) { P.splice(curProduct, 1); curProduct = Math.max(0, curProduct - 1); changed(); buildSide(); CUSTOM.products(clear()); } } }, '✕ Удалить'));
    const left = el('div', {}, tools, search, el('div', { style: 'height:8px' }), list);
    wrapEl.append(left, form); ed.append(wrapEl);
    window.refreshPListImpl = () => { const q = search.value.toLowerCase(); list.innerHTML = ''; P.forEach((p, i) => { if (q && !(p.name + ' ' + p.kind + ' ' + p.id).toLowerCase().includes(q)) return; list.append(el('button', { type: 'button', class: 'pl' + (i === curProduct ? ' on' : '') + (p.hidden ? ' hid' : ''), onclick: () => { curProduct = i; CUSTOM.products(clear()); } }, el('img', { src: imgUrl(p.img), alt: '' }), el('span', {}, el('b', {}, p.name || '—'), el('small', {}, `${((C.catalog.categories || []).find(k => k.key === p.cat) || {}).label || p.cat} · ${p.price == null || p.price === '' ? 'по запросу' : Number(p.price).toLocaleString('ru-RU') + ' ₽'}${p.hidden ? ' · скрыт' : ''}`)))); }); };
    search.addEventListener('input', refreshPListImpl); refreshPListImpl();
    if (P[curProduct]) { form.append(el('div', { class: 'banner' }, 'Страница товара: ', el('a', { href: '../apparaty/' + (P[curProduct].slug || '') + '/', target: '_blank' }, '/apparaty/' + (P[curProduct].slug || '') + '/'))); renderFields(form, PRODUCT, ['products', curProduct]); form.addEventListener('input', () => setTimeout(refreshPListImpl, 0)); }
    pvFollow('product');
  },
  media(ed) {
    ed.append(el('div', { class: 'pk-bar' }, el('label', { class: 'b gold' }, '⬆ Загрузить изображения', (() => { const i = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }); i.addEventListener('change', async () => { await upload([...i.files]); CUSTOM.media(clear()); }); return i; })())));
    ed.append(el('p', { class: 'desc' }, 'Фото автоматически сжимаются в WebP (до 1800 px). Нажмите на файл, чтобы скопировать имя или пометить к удалению. Используемые на сайте файлы удалять нельзя.'));
    const used = JSON.stringify(C); const g = el('div', { class: 'media' });
    const all = new Set([...allImages(), ...[...deleted].map(p => p.slice(11))]);
    [...all].sort().forEach(n => { const p = 'assets/img/' + n, isDel = deleted.has(p), isUsed = used.includes('"' + n + '"');
      g.append(el('div', { class: 'mc', title: n, onclick: () => { navigator.clipboard && navigator.clipboard.writeText(n); if (isUsed) { toast('Имя скопировано: ' + n + ' (файл используется)'); return; } if (pending[p]) { if (confirm('Убрать загруженный файл?')) { delete pending[p]; changed(); CUSTOM.media(clear()); } return; } if (repoImages.includes(n)) { if (isDel) deleted.delete(p); else if (confirm(`Удалить ${n} из репозитория при публикации?`)) deleted.add(p); changed(); CUSTOM.media(clear()); } } },
        pending[p] ? el('span', { class: 'tag' }, 'новое') : isDel ? el('span', { class: 'tag del' }, 'удалить') : !isUsed ? el('span', { class: 'tag', style: 'background:#3C8A72;color:#fff' }, 'не используется') : null,
        el('div', { class: 'im', style: `background-image:url("${imgUrl(n)}")` }), el('div', { class: 'nm' }, n))); });
    ed.append(g);
  },
  io(ed) {
    ed.append(el('div', { class: 'grp' }, el('h3', {}, 'Резервная копия'), el('p', { class: 'desc' }, 'Скачайте content.json — это все тексты, товары и настройки сайта.'),
      el('button', { class: 'b gold', type: 'button', onclick: () => { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(C, null, 1)], { type: 'application/json' })), download: 'content.json' }); a.click(); } }, '⬇ Скачать content.json'), el('div', { style: 'height:14px' })));
    const inp = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    inp.addEventListener('change', async () => { try { const j = JSON.parse(await inp.files[0].text()); if (!j.products || !j.site) throw new Error('это не content.json сайта'); if (!confirm('Заменить все данные загруженным файлом?')) return; C = j; changed(); buildSide(); toast('Данные загружены — проверьте и опубликуйте'); } catch (e) { alert('Ошибка: ' + e.message); } });
    ed.append(el('div', { class: 'grp' }, el('h3', {}, 'Импорт'), el('p', { class: 'desc' }, 'Загрузите сохранённый ранее content.json.'), el('label', { class: 'b' }, '⬆ Загрузить content.json', inp), el('div', { style: 'height:14px' })));
    ed.append(el('div', { class: 'grp' }, el('h3', {}, 'Сброс'), el('p', { class: 'desc' }, 'Отменить все изменения с момента загрузки/публикации.'), el('button', { class: 'b red', type: 'button', onclick: () => { if (confirm('Отменить все неопубликованные изменения?')) { C = clone(loaded); for (const k in pending) delete pending[k]; deleted.clear(); localStorage.removeItem(LS_DRAFT); changed(); buildSide(); toast('Изменения отменены'); } } }, 'Отменить изменения'), el('div', { style: 'height:14px' })));
    ed.append(el('div', { class: 'grp' }, el('h3', {}, 'Скачать готовые страницы'), el('p', { class: 'desc' }, 'Без GitHub: собрать сайт и скачать главную страницу (для проверки).'), el('button', { class: 'b', type: 'button', onclick: () => { const f = R.renderAll(C); const a = el('a', { href: URL.createObjectURL(new Blob([f['index.html']], { type: 'text/html' })), download: 'index.html' }); a.click(); } }, '⬇ index.html'), el('div', { style: 'height:14px' })));
  },
  help(ed) {
    ed.append(el('div', { class: 'help', html: `
<ol>
<li><b>Подключение.</b> Нажмите «⚙ Подключение», укажите логин GitHub, имя репозитория, ветку (обычно <code>main</code>) и токен. Токен создаётся в GitHub: Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → доступ только к этому репозиторию, право <b>Contents: Read and write</b>.</li>
<li><b>Редактирование.</b> Слева — все блоки сайта. Любое поле сохраняется в черновик этого браузера автоматически. Справа — живой предпросмотр (кнопка «👁 Предпросмотр»).</li>
<li><b>Публикация.</b> «🚀 Опубликовать» пересобирает ВСЕ страницы (главная, страницы товаров и категорий, sitemap.xml, robots.txt, llms.txt, data.js) и отправляет их одним коммитом. GitHub Pages обновит сайт примерно за 1–2 минуты.</li>
<li><b>Фото.</b> Загружайте в «Медиатеке» или прямо в поле фото — они сжимаются в WebP и уходят на GitHub вместе с публикацией.</li>
<li><b>Товары.</b> У каждого товара своя SEO-страница <code>/apparaty/адрес/</code>. Адрес меняйте осторожно: старая страница удалится, а новая получит другой URL.</li>
<li><b>SEO.</b> Обязательно укажите настоящий адрес сайта в разделе «Сайт» и коды Вебмастеров в «Аналитике». Подробный план продвижения — в README.md репозитория.</li>
<li><b>Если что-то сломалось.</b> «Экспорт / импорт» → скачайте резервную копию; в GitHub любой коммит можно откатить (History → Revert).</li>
</ol>` }));
  },
};
const clear = () => { const ed = $('#ed'); ed.innerHTML = ''; const s = SECTIONS.find(x => x.key === current); ed.append(el('h1', {}, s.title)); if (s.desc) ed.append(el('p', { class: 'desc' }, s.desc)); return ed; };
const refreshPList = () => { window.refreshPListImpl && window.refreshPListImpl(); };

/* ===================== preview ===================== */
let pvOn = false;
$('#btnPreview').addEventListener('click', () => { pvOn = !pvOn; $('#pv').hidden = !pvOn; $('#app').classList.toggle('pv-on', pvOn); if (pvOn) refreshPreview(true); });
$('#pvReload').addEventListener('click', () => refreshPreview(true));
$('#pvPage').addEventListener('change', () => refreshPreview(true));
$$('.seg button').forEach(b => b.addEventListener('click', () => { $$('.seg button').forEach(x => x.classList.toggle('on', x === b)); $('#pvFrame').style.width = b.dataset.w; }));
function pvPages() {
  const s = $('#pvPage'), cur = s.value; s.innerHTML = '';
  s.append(el('option', { value: 'index.html' }, 'Главная'));
  ((C.catalog || {}).categories || []).forEach(k => s.append(el('option', { value: 'katalog/' + k.slug + '/index.html' }, 'Категория: ' + (k.name || k.label))));
  (C.products || []).filter(p => !p.hidden).forEach(p => s.append(el('option', { value: 'apparaty/' + p.slug + '/index.html' }, 'Товар: ' + p.name)));
  if (cur && [...s.options].some(o => o.value === cur)) s.value = cur;
}
const ANCHOR = { hero: 'top', market: 'market', route: 'path', tech: 'tech', catalog: 'catalog', studio: 'practice', roi: 'roi', why: 'why', founder: 'founder', geo: 'geo', showroom: 'showroom', about: 'about', faq: 'faq', lead: 'lead' };
let pvAnchor = null;
function pvFollow(key) {
  if (!pvOn) return; const s = $('#pvPage');
  if (key === 'product') { const p = C.products[curProduct]; if (p) { const v = 'apparaty/' + p.slug + '/index.html'; if (s.value !== v) { pvPages(); s.value = v; refreshPreview(true); } } return; }
  if (ANCHOR[key]) { pvAnchor = ANCHOR[key]; if (s.value !== 'index.html') { s.value = 'index.html'; refreshPreview(true); } else scrollPv(); }
}
function scrollPv() { try { const d = $('#pvFrame').contentDocument, t = pvAnchor && d.getElementById(pvAnchor); if (t) d.defaultView.scrollTo(0, t.getBoundingClientRect().top + d.defaultView.scrollY - 70); } catch (e) {} }
function refreshPreview(force) {
  if (!pvOn || !C) return;
  try {
    pvPages(); const page = $('#pvPage').value || 'index.html';
    const c = clone(C); c.music = Object.assign({}, c.music, { enabled: false }); c.site = Object.assign({}, c.site, { intro: Object.assign({}, (c.site || {}).intro, { enabled: false }) }); c.analytics = {};
    const rootUrl = new URL('../', location.href).href;
    const files = R.renderAll(c, { base: rootUrl }); let html = files[page] || files['index.html'];
    html = html.replace(/<script src="[^"]*assets\/js\/data\.js[^"]*" defer><\/script>/, '<script>' + files['assets/js/data.js'].replace(/<\/script/gi, '<\\/script') + '</script>');
    for (const p in pending) if (p.startsWith('assets/img/')) html = html.split(rootUrl + p).join(pending[p].url).split(p).join(pending[p].url);
    const fr = $('#pvFrame'), y = (() => { try { return fr.contentWindow.scrollY; } catch (e) { return 0; } })();
    fr.onload = () => { try { if (!force && y) fr.contentWindow.scrollTo(0, y); else scrollPv(); } catch (e) {} };
    fr.srcdoc = html;
  } catch (e) { console.error(e); toast('Ошибка предпросмотра: ' + e.message); }
}

/* ===================== settings dialog ===================== */
const dS = $('#dlgSettings'), fS = $('#fSettings');
$('#btnSettings').addEventListener('click', () => { for (const k of ['owner', 'repo', 'branch', 'prefix', 'token']) fS.elements[k].value = cfg[k] || ''; fS.elements.remember.checked = !!localStorage.getItem(LS_CFG) && !!JSON.parse(localStorage.getItem(LS_CFG) || '{}').token || !cfg.token; $('#setMsg').textContent = ''; dS.showModal(); });
const readForm = () => ({ owner: fS.elements.owner.value.trim(), repo: fS.elements.repo.value.trim(), branch: fS.elements.branch.value.trim() || 'main', prefix: fS.elements.prefix.value.trim(), token: fS.elements.token.value.trim() });
$('#btnTest').addEventListener('click', async () => { const old = cfg; cfg = readForm(); $('#setMsg').textContent = 'Проверяю…'; try { const r = await gh(''); const ok = r.permissions && (r.permissions.push || r.permissions.admin); $('#setMsg').textContent = ok ? `✅ Доступ есть: ${r.full_name}` : '⚠ Репозиторий виден, но нет права записи — проверьте права токена (Contents: Read and write)'; } catch (e) { $('#setMsg').textContent = '❌ ' + e.message; } cfg = old; });
fS.addEventListener('submit', e => { e.preventDefault(); saveCfg(readForm(), fS.elements.remember.checked); dS.close(); load(); });
$$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

/* ===================== publish ===================== */
const dP = $('#dlgPublish'), plog = $('#pubLog');
const log = (t, cls) => { const d = el('div', { class: cls || '' }, t); plog.append(d); plog.scrollTop = plog.scrollHeight; };
$('#btnPublish').addEventListener('click', () => { plog.innerHTML = ''; $('#pubMsg').value = 'Обновление сайта через админку — ' + new Date().toLocaleString('ru-RU'); $('#btnDoPublish').disabled = false;
  if (!connected()) log('Сначала настройте подключение к GitHub (⚙ Подключение).', 'e');
  else if (!isDirty()) log('Изменений нет — но можно опубликовать, чтобы пересобрать страницы.');
  dP.showModal(); });
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all([...Array(Math.min(n, items.length))].map(async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }
$('#btnDoPublish').addEventListener('click', async () => {
  if (!connected()) { log('Нет подключения к GitHub.', 'e'); return; }
  const btn = $('#btnDoPublish'); btn.disabled = true;
  try {
    const c = clone(C); c.meta = c.meta || {}; c.meta.updated = new Date().toISOString();
    log('Собираю страницы…');
    const files = R.renderAll(c); files['content.json'] = JSON.stringify(c, null, 1);
    log(`Сгенерировано файлов: ${Object.keys(files).length}`);
    log('Получаю состояние репозитория…');
    const ref = await gh('/git/ref/heads/' + encodeURIComponent(cfg.branch)); const baseSha = ref.object.sha;
    const commit = await gh('/git/commits/' + baseSha);
    const tree = await gh('/git/trees/' + commit.tree.sha + '?recursive=1');
    const remote = {}; tree.tree.forEach(t => { if (t.type === 'blob') remote[t.path] = t.sha; });
    const rc = remote[pre('content.json')];
    if (remoteSha && rc && rc !== remoteSha && !confirm('Пока вы редактировали, content.json в репозитории изменился (возможно, правили с другого устройства). Перезаписать вашей версией?')) { log('Отменено.', 'e'); btn.disabled = false; return; }
    const enc = new TextEncoder(), entries = [];
    const texts = Object.entries(files); let skipped = 0;
    await pool(texts, 6, async ([path, text]) => {
      const bytes = enc.encode(text), sha = await gitSha(bytes), full = pre(path);
      if (remote[full] === sha) { skipped++; return; }
      const b = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: text, encoding: 'utf-8' }) });
      entries.push({ path: full, mode: '100644', type: 'blob', sha: b.sha }); log('↑ ' + path);
    });
    await pool(Object.entries(pending), 3, async ([path, f]) => {
      const b = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: f.b64, encoding: 'base64' }) });
      entries.push({ path: pre(path), mode: '100644', type: 'blob', sha: b.sha }); log(`↑ ${path} (${Math.round(f.size / 1024)} КБ)`);
    });
    const gen = new Set(Object.keys(files).map(pre));
    Object.keys(remote).forEach(p => { const rel = cfg.prefix ? p.slice(pre('').length) : p; if (cfg.prefix && !p.startsWith(pre(''))) return; if (/^(apparaty|katalog)\/[^/]+\/index\.html$/.test(rel) && !gen.has(p)) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); log('✕ удаляю устаревшую страницу ' + rel); } });
    deleted.forEach(p => { if (remote[pre(p)]) { entries.push({ path: pre(p), mode: '100644', type: 'blob', sha: null }); log('✕ удаляю ' + p); } });
    if (!entries.length) { log(`Все файлы уже актуальны (проверено ${skipped}). Публиковать нечего.`, 'ok'); loaded = clone(C); updateDirty(); btn.disabled = false; return; }
    log(`Без изменений: ${skipped}. Создаю коммит из ${entries.length} файлов…`);
    const nt = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree: entries }) });
    const nc = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: $('#pubMsg').value || 'Обновление сайта', tree: nt.sha, parents: [baseSha] }) });
    await gh('/git/refs/heads/' + encodeURIComponent(cfg.branch), { method: 'PATCH', body: JSON.stringify({ sha: nc.sha, force: false }) });
    C.meta = c.meta; loaded = clone(C); for (const k in pending) { if (k.startsWith('assets/img/')) repoImages.push(k.slice(11)); delete pending[k]; } deleted.forEach(p => { repoImages = repoImages.filter(n => 'assets/img/' + n !== p); }); deleted.clear();
    try { const j = await gh('/contents/' + pre('content.json') + '?ref=' + encodeURIComponent(cfg.branch)); remoteSha = j.sha; } catch (e) {}
    localStorage.removeItem(LS_DRAFT); updateDirty(); buildSide();
    log('✅ Готово! Коммит ' + nc.sha.slice(0, 7) + '. GitHub Pages обновит сайт через 1–2 минуты.', 'ok');
    plog.append(el('div', {}, el('a', { href: nc.html_url || `https://github.com/${cfg.owner}/${cfg.repo}/commit/${nc.sha}`, target: '_blank' }, 'Открыть коммит на GitHub'), ' · ', el('a', { href: (C.site && C.site.url) || '../', target: '_blank' }, 'Открыть сайт')));
    toast('Опубликовано');
  } catch (e) {
    log('Ошибка: ' + e.message, 'e');
    if (e.status === 401) log('Токен недействителен или истёк — создайте новый.', 'e');
    if (e.status === 403 || e.status === 404) log('Проверьте имя репозитория и права токена (Contents: Read and write, доступ к этому репозиторию).', 'e');
    if (e.status === 409 || e.status === 422) log('Ветка изменилась во время публикации — нажмите «Опубликовать» ещё раз.', 'e');
    btn.disabled = false;
  }
});

/* ===================== boot ===================== */
if (!R) { $('#ed').innerHTML = '<div class="banner warn">Не найден ../assets/js/render.js — админка должна лежать в папке admin/ рядом с сайтом.</div>'; return; }
load();
})();
