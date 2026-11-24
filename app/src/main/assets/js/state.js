const RAW = [
  ['a1','Notte Lunga','Marta Vessi',2024,'Pop',350,0,['Luci sul porto','Notte Lunga','Dove finisce il mare','Ultimo tram','Cenere e miele','Non dirlo a nessuno']],
  ['a2','Salto nel Blu','Orchestra Pallida',2023,'Indie',215,4,['Prima onda','Salto nel Blu','Vetri di agosto','Tre minuti di sole','Altrove','Marea bassa','Coda']],
  ['a3','Ferro e Velluto','Dario Brenta',2022,'Rock',18,1,['Ferro','Velluto','Strada Statale','Il peso del vento','Bandiera nera','Fino all’alba']],
  ['a4','Mezzanotte a Torino','Elia Corsi',2021,'Jazz',38,2,['Via Po','Mezzanotte a Torino','Caffè lungo','Un’ora in più','Tram 15','Ultimo giro']],
  ['a5','Casa di Vetro','Lune Gemelle',2025,'Dream pop',282,0,['Casa di Vetro','Sottopelle','Fiato corto','Luce diffusa','Nebbia','Sempre domenica']],
  ['a6','Strade Bianche','Fabbrica Verde',2020,'Folk',132,5,['Strade Bianche','Grano','Il treno delle sei','Pane e vino','Campane','Torna presto']],
  ['a7','Polvere d’Oro','Aurelia Nox',2025,'Elettronica',46,3,['Polvere d’Oro','Neon','Frequenza','Orbita','Specchio nero','Alba sintetica','Loop']],
  ['a8','Cielo Basso','Tommaso Ferri',2019,'Cantautori',202,2,['Cielo Basso','Lettera a nessuno','Il piano di sopra','Settembre','Piove ancora']],
  ['a9','Radio Fantasma','Neon Alpi',2024,'Synthwave',305,3,['Radio Fantasma','Autostrada','Notturno 3','Chrome','Ritorno al futuro prossimo','Onde corte']],
  ['a10','Sale','Greta Moro',2023,'R&B',6,4,['Sale','Pelle','Due di notte','Resta','Lento','Rossetto']],
  ['a11','Tredici Giorni','I Cortili',2022,'Indie rock',172,1,['Tredici Giorni','Pallone di cuoio','Estate corta','Sirene','Casa dei nonni','Ultimo banco']],
  ['a12','Specchi d’Acqua','Vanna Lorca',2021,'Ambient',192,5,['Specchi d’Acqua','Lago','Silenzio blu','Profondità','Riflessi']],
  ['a13','Frutta Matura','Bruno Sella',2024,'Funk',72,3,['Frutta Matura','Sabato sera','Groove di quartiere','Mercato','Dammi il basso','Estate indiana']],
  ['a14','Lento Come Luglio','Marta Vessi',2022,'Pop',22,2,['Lento Come Luglio','Sabbia','Gelato al limone','Ombrellone','Tuffo','Settembre dopo']]
];
const LYRICS = [
  ['Le luci si spengono una a una','e la città respira piano','Io resto sveglio con la tua voce','che mi cammina nella mano','Non serve dire dove andiamo','basta restare un altro po’','Tutto il resto può aspettare','finché la notte non finisce qui','Dimmi che non è tardi','dimmi che è ancora presto','Il mare porta via i pensieri','e lascia solo questo','Lasciami il tuo nome sul vetro','prima che si asciughi il cielo','Ci ritroviamo all’alba','senza dire più niente'],
  ['Corro dietro al sole di luglio','con le scarpe in mano e il cuore leggero','Ogni strada porta a un balcone','ogni balcone a un pezzo di cielo','Canta con me se ti ricordi','le parole che non sapevamo','Siamo tutto quello che resta','di un’estate che non finiamo','E se piove, pazienza','balliamo lo stesso','Dentro il rumore della gente','io ti riconosco adesso','Girati, che ti guardo','mentre il mondo va in pezzi','Domani chissà dove siamo','stasera siamo ovunque'],
  ['C’è una stanza in fondo al corridoio','dove tengo le cose che non dico','Ci entro quando fuori è tardi','e il silenzio mi fa da amico','Accendo una luce bassa','e ti scrivo senza spedire','Ogni riga è una porta aperta','su quello che non so finire','Non mi serve una risposta','mi basta sapere che ascolti','Il resto lo fa la notte','con i suoi passi più morbidi','Se mi cerchi sono qui','tra la polvere e le tende','Un battito alla volta','finché tutto si accende']
];
const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const ALBUMS = [], TRACKS = [], ARTISTS = [], PLAYLISTS = [], BYID = {};
const pick = (seed, n) => { const r = rng(seed), a = TRACKS.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const _MOCK_PL_RAW = [
  ['p1','Preferiti','I brani che ti restano in testa',350,0,11,20],
  ['p2','In macchina','Finestrino giù, volume su',18,1,12,16],
  ['p3','Notte tarda','Per quando la città dorme',282,0,13,18],
  ['p4','Concentrazione','Niente parole, solo flusso',192,5,14,14],
  ['p5','Domenica a casa','Piano, con il caffè',38,2,15,15],
  ['p6','Allenamento','Ritmo alto, zero pause',72,3,16,22]
];
let _mockCatalogBuilt = false;
let _mockPlayerSeedReady = false;
function initMockCatalog() {
  if (_mockCatalogBuilt) return;
  _mockCatalogBuilt = true;
  RAW.forEach(([id, title, artist, year, genre, hue, style, names]) => {
    const al = { kind: 'album', id, title, artist, year, genre, hue, style, tracks: [] };
    names.forEach((n, i) => {
      const t = { id: id + '_' + (i + 1), title: n, artist, album: id, no: i + 1, dur: 150 + h32(id + n) % 140, hue, ex: h32(n) % 7 === 0 };
      al.tracks.push(t); TRACKS.push(t); BYID[t.id] = t;
    });
    ALBUMS.push(al); BYID[id] = al;
    let ar = ARTISTS.find(a => a.title === artist);
    if (!ar) { ar = { kind: 'artist', id: 'ar' + ARTISTS.length, title: artist, hue, style, albums: [] }; ARTISTS.push(ar); BYID[ar.id] = ar; }
    ar.albums.push(al);
  });
  _MOCK_PL_RAW.forEach(([id, title, desc, hue, style, seed, n]) => {
    const p = { kind: 'playlist', id, title, desc, hue, style, artist: 'Playlist', tracks: pick(seed, n) };
    BYID[id] = p;
    PLAYLISTS.push(p);
  });
  if (_mockPlayerSeedReady) seedMockPlayer();
}
if (typeof window !== 'undefined') window.initMockCatalog = initMockCatalog;
if (!(typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:'))) {
  initMockCatalog();
}
const STATIONS = [
  { id: 'r1', title: 'Onda Uno', sub: 'La stazione principale, 24 ore su 24', hue: 350 },
  { id: 'r2', title: 'Notte FM', sub: 'Brani lenti e voci basse', hue: 262 },
  { id: 'r3', title: 'Sotto Pelle', sub: 'Indie, rock e dintorni', hue: 18 },
  { id: 'r4', title: 'Frequenza Blu', sub: 'Elettronica e synth', hue: 210 },
  { id: 'r5', title: 'Strade Bianche', sub: 'Cantautori e folk', hue: 130 }
];
const GENRES = [['Pop',350],['Indie',215],['Rock',18],['Jazz',38],['Dream pop',282],['Folk',132],['Elettronica',46],['Cantautori',202],['Synthwave',305],['R&B',6],['Funk',72],['Ambient',192]];
const albumOf = t => BYID[t.album] || t;
const artItem = it => it.kind === 'artist' && !it.thumb && !LIVE.on && it.albums && it.albums[0] ? it.albums[0] : it;
const tracksOf = it => it.kind === 'artist' ? (it.songs || (it.albums || []).flatMap(x => x.tracks || [])) : (it.tracks || []);
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

const $out = document.getElementById('out'), $phone = document.getElementById('phone'), $q = document.getElementById('q');
const FONT = '-apple-system, "SF Pro Display", system-ui, "Inter", sans-serif';
const _F_CACHE = Object.create(null);
const F = (w, s) => { const k = w + '|' + s; return _F_CACHE[k] || (_F_CACHE[k] = w + ' ' + s + 'px ' + FONT); };
const S = document.createElement('canvas'), O = document.createElement('canvas');
const sc = S.getContext('2d'), oc = O.getContext('2d');
const $top = document.getElementById('top'), TC = $top.getContext('2d');
let W = 0, H = 0, FRAME = false, TOP = 12;
const D = { scene: true, ov: true, gl: true };
let _skulletActive = false;
const _wakeFrame = () => { if (typeof window !== 'undefined' && typeof window.wakeFrame === 'function') window.wakeFrame(); };
const redraw = () => { D.scene = D.ov = D.gl = true; _wakeFrame(); };
const redrawSceneOnly = () => { D.scene = D.gl = true; _wakeFrame(); };
const redrawSheetContent = () => {
  if (typeof SH !== 'undefined' && SH && SH.t >= 0.999 &&
      !(typeof CM !== 'undefined' && CM && CM.open) &&
      !(typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER && OUT_DRAWER.open) &&
      !(typeof NAV !== 'undefined' && NAV && NAV.menu) &&
      !(typeof TOAST !== 'undefined' && TOAST && TOAST.t > 0.01)) {
    redrawSceneOnly();
  } else {
    redraw();
  }
};
if (typeof window !== 'undefined') {
  window.redrawSceneOnly = redrawSceneOnly;
  window.redrawSheetContent = redrawSheetContent;
}

window.haptic = function(kind) {
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (N && typeof N.haptic === 'function') {
    try { N.haptic(String(kind || 'tick')); } catch (e) {}
  }
};

const _PRESS = { downKey: null, vals: new Map(), downAt: new Map(), age: new Map() };
function _isSceneOnlyPressKey(k) {
  return k.startsWith('song:') || k.startsWith('card:') || k.startsWith('artrel:') ||
    k.startsWith('pill:') || k.startsWith('librow:') || k.startsWith('set_tile:') ||
    k.startsWith('geo:') || k.startsWith('rec:') || k.startsWith('recap_') ||
    k.startsWith('recs_') || k.startsWith('rec_') || k.startsWith('circ:') ||
    k.startsWith('hPlay:') || k === 'set_upd';
}
window.pressDown = function(key) {
  if (!key) return;
  const k = String(key);
  const isNew = _PRESS.downKey !== k || !_PRESS.downAt.has(k);
  _PRESS.downKey = k;
  if (!_PRESS.vals.has(k)) _PRESS.vals.set(k, 0);
  if (isNew) {
    const now = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    _PRESS.downAt.set(k, now);
    _PRESS.age.set(k, 0);
  }
  if (_isSceneOnlyPressKey(k)) redrawSceneOnly();
  else redraw();
};
window.pressUp = function() {
  if (_PRESS.downKey != null) {
    const prevK = _PRESS.downKey;
    _PRESS.downKey = null;
    if (_isSceneOnlyPressKey(prevK)) redrawSceneOnly();
    else redraw();
  }
};
function pressFactor(key) {
  if (!key) return 0;
  const v = _PRESS.vals.get(String(key)) || 0;
  if (v <= 0.001) return 0;
  const u = clamp(v, 0, 1);
  return typeof sstep === 'function' ? sstep(u) : u * u * (3 - 2 * u);
}
function pressScale(key, amt) {
  const p = pressFactor(key);
  return p > 0.001 ? (1 - p * (amt == null ? 0.015 : amt)) : 1;
}
function pressTint(key, maxA) {
  const p = pressFactor(key);
  return p > 0.001 ? p * (maxA == null ? 0.045 : maxA) : 0;
}
function stepPress(dt) {
  if (!_PRESS.vals.size) return false;
  let ch = false;
  const scrolling = typeof INP !== 'undefined' && INP.mode && INP.mode !== 'none';
  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
  const safeDt = Math.max(0, dt || 0);
  for (const [k, v] of _PRESS.vals) {
    const tg = (_PRESS.downKey === k && !scrolling) ? 1 : 0;
    const hasDownAt = _PRESS.downAt.has(k);
    const tDown = hasDownAt ? _PRESS.downAt.get(k) : 0;
    const age = (_PRESS.age.get(k) || 0) + safeDt;
    _PRESS.age.set(k, age);
    const elapsedS = Math.max(age, tDown > 0 ? (now - tDown) / 1000 : age);
    const effTg = (tg === 0 && !scrolling && hasDownAt && v < 0.45 && elapsedS < 0.065) ? 0.45 : tg;
    let nv;
    if (effTg > v) {
      nv = Math.min(effTg, v + safeDt / 0.13);
    } else if (effTg < v) {
      nv = Math.max(effTg, v - safeDt / 0.165);
    } else {
      nv = v;
    }
    if (nv <= 0.002 && tg === 0 && effTg === 0) {
      _PRESS.vals.delete(k);
      _PRESS.downAt.delete(k);
      _PRESS.age.delete(k);
      ch = true;
    } else {
      if (nv >= 0.998 && tg === 1) nv = 1;
      if (nv !== v || effTg !== tg) ch = true;
      _PRESS.vals.set(k, nv);
    }
  }
  return ch;
}
window.pressState = _PRESS;
window.pressFactor = pressFactor;
window.pressScale = pressScale;
window.pressTint = pressTint;

const PAL = {
  light: { dark: false, bg: '#ffffff', fg: '#000000', sub: 'rgba(60,60,67,.62)', sub2: 'rgba(60,60,67,.30)', sep: 'rgba(60,60,67,.16)', fill: 'rgba(120,120,128,.12)', accent: '#fa2e49' },
  dark:  { dark: true,  bg: '#0d0d0d', fg: '#ffffff', sub: 'rgba(235,235,245,.60)', sub2: 'rgba(235,235,245,.30)', sep: 'rgba(84,84,88,.60)', fill: 'rgba(120,120,128,.24)', accent: '#fa2e49' }
};
let pal = PAL.light, themeMode = 'auto';
try { themeMode = localStorage.getItem('sonora-theme') || 'auto'; } catch (e) {}
const mqDark = matchMedia('(prefers-color-scheme: dark)');
const PREFS = {
  crossfade: 0,
  volumeNorm: true,
  skipFade: true,
  smartShuffle: true,
  lyricsAlone: true,
  swipeQueue: true,
  prefLySource: 'auto',
  glassProfile: 'balanced',
  glassBlur: 2,
  glassRefraction: 24,
  glassChromatic: true,
  barFolds: true,
  eqPreset: 'flat',
  eqGains: [0, 0, 0, 0, 0],
  lang: 'auto',
  country: 'auto'
};
try {
  const sp = JSON.parse(localStorage.getItem('sonora-prefs') || 'null');
  if (sp && typeof sp === 'object') Object.assign(PREFS, sp);
} catch (e) {}
try {
  if (typeof window !== 'undefined' && typeof window.getLocaleConfig === 'function') {
    const lc = window.getLocaleConfig();
    if (lc && typeof lc === 'object') {
      if (lc.lang) PREFS.lang = lc.lang;
      if (lc.country) PREFS.country = lc.country;
    }
  } else if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getLocaleConfig === 'function') {
    const nc = JSON.parse(window.SonoraNative.getLocaleConfig() || 'null');
    if (nc && typeof nc === 'object') {
      if (nc.lang) PREFS.lang = nc.lang;
      if (nc.country) PREFS.country = nc.country;
    }
  }
} catch (e) {}
PREFS.lang = (PREFS.lang === 'it' || PREFS.lang === 'en' || PREFS.lang === 'auto') ? PREFS.lang : 'auto';
PREFS.country = (!PREFS.country || String(PREFS.country).toLowerCase() === 'auto')
  ? 'auto'
  : (/^[A-Za-z]{2}$/.test(String(PREFS.country)) ? String(PREFS.country).toUpperCase() : 'auto');
if (typeof applyStaticI18n === 'function') applyStaticI18n();
PREFS.volumeNorm = PREFS.volumeNorm !== false;
if (!Array.isArray(PREFS.eqGains) || PREFS.eqGains.length !== 5) {
  PREFS.eqGains = [0, 0, 0, 0, 0];
}
const _nativeAudioSync = { eq: null, cf: null, sf: null, vn: null, vol: null, rep: null, eqTimer: 0, volTimer: 0 };
function syncNativeAudioConfig(force) {
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (!N) return;
  try {
    const eqStr = JSON.stringify(PREFS.eqGains || [0, 0, 0, 0, 0]);
    const cf = PREFS.crossfade || 0;
    const sf = !!PREFS.skipFade;
    const vn = PREFS.volumeNorm !== false;
    const vol = (typeof PL !== 'undefined' && PL.vol != null) ? PL.vol : 0.62;
    const rep = (typeof PL !== 'undefined' && PL.repeat) ? Number(PL.repeat) : 0;
    if (typeof N.setEqGains === 'function' && (force || eqStr !== _nativeAudioSync.eq)) {
      _nativeAudioSync.eq = eqStr;
      N.setEqGains(eqStr);
    }
    if (typeof N.setFadeConfig === 'function' && (force || cf !== _nativeAudioSync.cf || sf !== _nativeAudioSync.sf)) {
      _nativeAudioSync.cf = cf;
      _nativeAudioSync.sf = sf;
      N.setFadeConfig(cf, sf);
    }
    if (typeof N.setVolumeNorm === 'function' && (force || vn !== _nativeAudioSync.vn)) {
      _nativeAudioSync.vn = vn;
      N.setVolumeNorm(vn);
    }
    if (typeof N.setVolume === 'function' && (force || _nativeAudioSync.vol === null || Math.abs(vol - _nativeAudioSync.vol) > 0.002)) {
      _nativeAudioSync.vol = vol;
      N.setVolume(vol);
    }
    if (typeof syncNativeRepeat === 'function' && (force || rep !== _nativeAudioSync.rep)) {
      _nativeAudioSync.rep = rep;
      syncNativeRepeat();
    }
  } catch (e) {}
}
function syncNativeVolume(vol) {
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (!N || typeof N.setVolume !== 'function') return;
  if (_nativeAudioSync.vol !== null && Math.abs(vol - _nativeAudioSync.vol) <= 0.003) return;
  _nativeAudioSync.vol = vol;
  if (_nativeAudioSync.volTimer) return;
  _nativeAudioSync.volTimer = setTimeout(() => {
    _nativeAudioSync.volTimer = 0;
    try {
      const curV = (typeof PL !== 'undefined' && PL.vol != null) ? PL.vol : _nativeAudioSync.vol;
      _nativeAudioSync.vol = curV;
      N.setVolume(curV);
    } catch (e) {}
  }, 32);
}
let _prefsSaveTimer = 0, _prefsSaveDirty = false, _lastGlassPrefSig = '';
function _glassPrefSig() {
  return (PREFS.glassProfile || 'balanced') + '|' + (PREFS.glassBlur != null ? PREFS.glassBlur : 2) + '|' +
    (PREFS.glassRefraction != null ? PREFS.glassRefraction : 24) + '|' + (PREFS.glassChromatic ? 1 : 0) + '|' + (pal && pal.dark ? 1 : 0);
}
function _writePrefsStorage() {
  try { localStorage.setItem('sonora-prefs', JSON.stringify(PREFS)); } catch (e) {}
}
function flushPrefsSave() {
  if (_prefsSaveTimer) { clearTimeout(_prefsSaveTimer); _prefsSaveTimer = 0; }
  if (!_prefsSaveDirty) return;
  _prefsSaveDirty = false;
  _writePrefsStorage();
}
function savePrefs(immediate, opts) {
  _prefsSaveDirty = true;
  if (immediate) {
    flushPrefsSave();
  } else {
    if (_prefsSaveTimer) clearTimeout(_prefsSaveTimer);
    _prefsSaveTimer = setTimeout(flushPrefsSave, 200);
  }
  if (!(opts && opts.skipAudioSync)) syncNativeAudioConfig();
  if (typeof lg !== 'undefined' && lg) {
    const gSig = _glassPrefSig();
    if ((opts && opts.glass) || gSig !== _lastGlassPrefSig) {
      _lastGlassPrefSig = gSig;
      lg.setDefaults(glassStyle());
      applyStyles();
    }
  }
  redraw();
}
if (typeof window !== 'undefined') {
  window.flushPrefsSave = flushPrefsSave;
  window.addEventListener('pagehide', flushPrefsSave);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPrefsSave();
    });
  }
}
function glassStyle() {
  const b = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassBlur != null ? PREFS.glassBlur : 2);
  const rAmt = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassRefraction != null ? PREFS.glassRefraction : 24);
  const rH = Math.round(rAmt * (16 / 24));
  return { vibrancy: true, blur: b, refractionHeight: rH, refractionAmount: rAmt,
    chromaticAberration: PREFS.glassChromatic ? (PREFS.glassProfile === 'vivid' ? 1.0 : .8) : 0,
    highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 },
    shadow: { radius: 12, offsetY: 2, color: pal.dark ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.1)' } };
}
function applyTheme(mode) {
  if (mode) { themeMode = mode; try { localStorage.setItem('sonora-theme', mode); } catch (e) {} }
  const d = themeMode === 'dark' || (themeMode === 'auto' && mqDark.matches);
  pal = d ? PAL.dark : PAL.light;
  const r = document.documentElement; if (themeMode === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', themeMode);
  Object.keys(ARTC).forEach(k => { if (ARTC[k] && ARTC[k]._placeholder) delete ARTC[k]; });
  if (typeof BARC !== 'undefined') BARC.init = false;
  if (typeof lg !== 'undefined' && lg) { _lastGlassPrefSig = _glassPrefSig(); lg.setDefaults(glassStyle()); applyStyles(); }
  redraw();
}
mqDark.addEventListener && mqDark.addEventListener('change', () => applyTheme());

const LAY = { tabs: [] };
const _TAB_KEYS = { home: 'tab.home', new: 'tab.new', radio: 'tab.radio', library: 'tab.library' };
const TABS = [['home', 'Home', 'home'], ['new', 'Novità', 'new'], ['radio', 'Radio', 'radio'], ['library', 'Libreria', 'library']];
function syncTabLabels() {
  if (typeof window === 'undefined' || typeof window.t !== 'function') return;
  for (let i = 0; i < TABS.length; i++) {
    const k = _TAB_KEYS[TABS[i][0]];
    if (k) TABS[i][1] = window.t(k);
  }
}
syncTabLabels();
if (typeof window !== 'undefined') window.syncTabLabels = syncTabLabels;
function layout() {
  TOP = (window.SAFE_TOP != null)
    ? window.SAFE_TOP
    : ((typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getTopInset === 'function')
      ? (window.SonoraNative.getTopInset() ?? 44)
      : (window.SonoraNative ? 44 : (FRAME ? 56 : 14)));
  const m = 18, sd = 59, mh = 52, gap = 8, by = H - 14 - sd - (FRAME ? 8 : 0);
  LAY.tab = { x: m, y: by, w: W - m * 2 - sd - gap, h: sd };
  LAY.search = { x: W - m - sd, y: by, w: sd, h: sd };
  LAY.mini = { x: m, y: by - 8 - mh, w: W - m * 2, h: mh };
  const tw = (LAY.tab.w - 8) / 4; LAY.tabs = TABS.map((t, i) => ({ id: t[0], x: LAY.tab.x + 4 + i * tw, w: tw }));
  LAY.avatar = { x: W - 20 - 44, y: TOP + 4, w: 44, h: 44 };
  LAY.more = { x: W - 20 - 44 - 10 - 44, y: TOP + 4, w: 44, h: 44 };
  LAY.back = { x: 16, y: TOP + 4, w: 44, h: 44 };
  LAY.apill = { x: W - 16 - 100, y: TOP + 4, w: 100, h: 44 };
  LAY.bottomPad = H - LAY.mini.y + 24;
}

const PL = { queue: [], qi: 0, playing: false, loading: false, trackLoading: false, loadingSince: 0, pos: 0, sPos: 0, shuffle: false, smartShuffle: false, repeat: 0, infinity: true, fav: {}, vol: .62, audio: null, fadeG: 1, fadeDur: 0, fadingOut: [], _cfTriggered: false };
const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0],
  bass: [5.5, 4.0, .5, -.5, 1.0],
  vocal: [-1.5, .5, 4.2, 3.2, 1.0],
  rock: [4.2, 2.0, -1.5, 2.5, 4.5],
  pop: [-1.0, 2.2, 4.0, 2.5, -.5],
  electronic: [4.8, 2.5, -1.0, 2.0, 4.5]
};
let _actx = null, _eqFilters = null;
function applyEqPreset(id) {
  PREFS.eqPreset = id;
  if (EQ_PRESETS[id]) PREFS.eqGains = EQ_PRESETS[id].slice();
  syncEqFilters();
  savePrefs();
}
function syncEqFilters() {
  const g = PREFS.eqGains || [0, 0, 0, 0, 0];
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (N && typeof N.setEqGains === 'function') {
    const eqStr = JSON.stringify(g);
    if (eqStr !== _nativeAudioSync.eq) {
      _nativeAudioSync.eq = eqStr;
      if (_nativeAudioSync.eqTimer) clearTimeout(_nativeAudioSync.eqTimer);
      _nativeAudioSync.eqTimer = setTimeout(() => {
        _nativeAudioSync.eqTimer = 0;
        try {
          const curStr = JSON.stringify(PREFS.eqGains || [0, 0, 0, 0, 0]);
          _nativeAudioSync.eq = curStr;
          N.setEqGains(curStr);
        } catch (e) {}
      }, 48);
    }
  }
  if (!_eqFilters) return;
  _eqFilters.forEach((f, i) => { try { f.gain.value = clamp(g[i] || 0, -9, 9); } catch (e) {} });
}
function attachAudioEq(a) {
  const g = PREFS.eqGains || [0, 0, 0, 0, 0];
  if (PREFS.eqPreset === 'flat' && g.every(v => Math.abs(v) < .1) && !_actx) return;
  try {
    if (!_actx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      _actx = new Ctx();
      const freqs = [60, 230, 910, 3600, 14000];
      _eqFilters = freqs.map((fr, i) => {
        const bq = _actx.createBiquadFilter();
        bq.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking';
        bq.frequency.value = fr;
        bq.Q.value = 1.0;
        bq.gain.value = clamp(g[i] || 0, -9, 9);
        return bq;
      });
      for (let i = 0; i < _eqFilters.length - 1; i++) _eqFilters[i].connect(_eqFilters[i + 1]);
      _eqFilters[_eqFilters.length - 1].connect(_actx.destination);
    }
    if (_actx.state === 'suspended') _actx.resume().catch(() => {});
    if (!a._eqNode) {
      a._eqNode = _actx.createMediaElementSource(a);
      a._eqNode.connect(_eqFilters[0]);
    }
  } catch (e) {}
}
const cur = () => PL.queue[PL.qi];
const _cleanArtCache = new Map();
const _subTrackCache = new Map();
function cleanArtistText(a) {
  if (!a) return '';
  let cached = _cleanArtCache.get(a);
  if (cached !== undefined) return cached;
  const parts = a.split(/\s*,\s*|\s*&\s*/)
    .map(s => s.trim())
    .filter(s => {
      const l = s.toLowerCase();
      if (!l || l === 'brano' || l === 'canzone' || l === 'singolo' || l === 'album' || l === 'video' || l === 'song') return false;
      if (l.includes('riproduzion') || l.includes('visualizzazion') || l.includes('ascolt') || l.includes('views') || l.includes('plays') || l.includes('iscritt') || l.includes('subscribers')) return false;
      if (/\d+[\d.,]*\s*(?:k|m|b|mln|mila|milioni|mrd)/i.test(l)) return false;
      if (/^\d{1,2}[:.]\d{2}/.test(l)) return false;
      return true;
    });
  const res = parts.length ? parts.join(', ') : a;
  if (_cleanArtCache.size >= 300) _cleanArtCache.clear();
  _cleanArtCache.set(a, res);
  return res;
}
const subOfTrack = t => {
  const raw = t ? t.artist : '';
  if (!raw) return '';
  let cached = _subTrackCache.get(raw);
  if (cached !== undefined) return cached;
  const clean = cleanArtistText(raw);
  const res = clean ? clean.replace(/, ([^,]+)$/, ' & $1') : '';
  if (_subTrackCache.size >= 300) _subTrackCache.clear();
  _subTrackCache.set(raw, res);
  return res;
};
function isSpinnerActive() {
  if (!PL.playing) return false;
  if (PL.trackLoading) return true;
  if (PL.loading && PL.loadingSince && (performance.now() - PL.loadingSince > 800)) return true;
  return false;
}
const LIVE = { on: false, offline: false, _offlineP: 0, ly: {}, lySel: {}, lyV: 0, radio: [], radioBusy: false, res: {}, searchHistory: [], recent: [], known: {}, home: null, homeErr: null, charts: null, chartsErr: null, toast: '', toastT: 0, errRun: 0 };
const durOf = t => t.dur;
let _lastNextTrackKey = null;
function syncNativeNextTrack(force) {
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (!N || typeof N.setNextTrack !== 'function') return;
  let nextIdx = -1;
  if (PL.repeat !== 2) {
    if (PL.qi + 1 < PL.queue.length) nextIdx = PL.qi + 1;
    else if (PL.repeat === 1 && PL.queue.length > 0) nextIdx = 0;
  }
  const nx = nextIdx >= 0 ? PL.queue[nextIdx] : null;
  const curId = cur() && cur().id;
  const hasNext = PL.repeat !== 2 && !!(nx && nx.id && nx.id !== curId);
  const key = hasNext ? (nx.id + '\0' + (nx.title || '') + '\0' + (nx.artist || '') + '\0' + (nx.thumb || '')) : '';
  if (!force && key === _lastNextTrackKey) return;
  _lastNextTrackKey = key;
  try {
    if (hasNext) {
      N.setNextTrack(nx.id, nx.title || '', nx.artist || '', nx.thumb || '');
    } else {
      N.setNextTrack('', '', '', '');
    }
  } catch (e) {}
}
function enqueueTracks(tracks, mode, autoPlayIfIdle) {
  const list = (Array.isArray(tracks) ? tracks : [tracks]).filter(tr => tr && tr.id);
  if (!list.length) return [];
  const wrapped = list.map(tr => Object.assign({}, tr, { _queued: true, _smartRec: false }));
  if (!PL.queue.length && typeof reconcileNativePlayback === 'function') {
    reconcileNativePlayback();
  }
  if (!PL.queue.length && typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getPlaybackSnapshot === 'function') {
    try {
      const snap = JSON.parse(window.SonoraNative.getPlaybackSnapshot() || 'null');
      if (snap && snap.active && snap.trackId) {
        const fallback = {
          id: snap.trackId,
          title: snap.title || '',
          artist: snap.artist || '',
          thumb: snap.thumb || null,
          dur: Math.round(snap.durSec > 1 ? snap.durSec : 180)
        };
        const activeTr = typeof ingestTrack === 'function' ? ingestTrack(fallback) : fallback;
        if (activeTr) {
          PL.queue = [activeTr];
          PL.qi = 0;
          PL.playing = !!snap.isPlaying;
        }
      }
    } catch (e) {}
  }
  if (!PL.queue.length) {
    if (autoPlayIfIdle) {
      if (wrapped.length === 1 && typeof playOne === 'function') playOne(wrapped[0]);
      else if (typeof playList === 'function') playList(wrapped, 0);
      return wrapped;
    }
    PL.queue = wrapped.slice();
    PL.qi = 0;
  } else {
    PL.qi = Math.max(0, Math.min(PL.qi | 0, PL.queue.length - 1));
    if (mode === 'next') {
      PL.queue.splice(PL.qi + 1, 0, ...wrapped);
    } else {
      PL.queue.push(...wrapped);
    }
  }
  syncNativeNextTrack(true);
  const nx = PL.queue[PL.qi + 1];
  if (nx && nx.id) {
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') {
      try { window.SonoraNative.prefetch(nx.id); } catch (e) {}
    } else if (typeof fetch === 'function') {
      fetch('/api/prefetch/' + nx.id).catch(() => {});
    }
    if (typeof preloadArt === 'function') preloadArt(nx, false);
    if (typeof liveLy === 'function') liveLy(nx);
  }
  if (typeof savePlayerState === 'function') savePlayerState();
  if (typeof redraw === 'function') redraw();
  return wrapped;
}
function syncNativeRepeat() {
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (N && typeof N.setRepeatMode === 'function') {
    const rep = (PL && PL.repeat) ? Number(PL.repeat) : 0;
    _nativeAudioSync.rep = rep;
    try { N.setRepeatMode(rep); } catch (e) {}
  }
}
if (typeof window !== 'undefined') window.syncNativeRepeat = syncNativeRepeat;
function syncNativeFavorite(t) {
  const tr = t || (typeof cur === 'function' ? cur() : null);
  const N = typeof window !== 'undefined' && window.SonoraNative;
  if (!tr || !tr.id || !N || typeof N.setTrackFavorite !== 'function') return;
  try {
    N.setTrackFavorite(String(tr.id), !!(PL && PL.fav && PL.fav[tr.id]));
  } catch (e) {}
}
function loadAudio(fadeSec, isAuto) {
  PL._dismissedAt = 0;
  NAV.miniDy = 0;
  NAV.miniDismissT = 0;
  NAV.miniDismissY = 0;
  NAV.miniDismissTr = null;
  PL._switchTime = performance.now();
  const t = cur();
  if (_recCurTrack && (!t || _recCurTrack.id !== t.id)) {
    recFlushCurrent();
  }
  if (t && typeof preloadArt === 'function') preloadArt(t, true);
  if (t && !t.src && t.id) t.src = '/api/stream/' + t.id;
  if (t && (!LIVE.on || typeof liveOnTrack !== 'function') && typeof recStartTrack === 'function') {
    recStartTrack(t, false);
  }
  if (PL.qualityTrackId !== (t && t.id)) {
    PL.qualityTrackId = t ? t.id : null;
    PL.qualityLabel = '';
  }
  if (window.SonoraNative && typeof window.SonoraNative.play === 'function') {
    syncNativeAudioConfig();
    if (t) {
      if (typeof window.SonoraNative.playWithAuto === 'function') {
        window.SonoraNative.playWithAuto(t.id, t.title, t.artist, t.thumb || '', t.dur || 0, !!isAuto);
      } else {
        window.SonoraNative.play(t.id, t.title, t.artist, t.thumb || '', t.dur || 0);
      }
      PL.playing = true;
      PL.loading = true;
      PL.trackLoading = true;
      PL.loadingSince = performance.now();
      for (let i = 1; i <= 2; i++) {
        const nx = PL.queue[PL.qi + i];
        if (nx && nx.id && nx.id !== t.id) {
          if (typeof window.SonoraNative.prefetch === 'function') window.SonoraNative.prefetch(nx.id);
          if (typeof preloadArt === 'function') preloadArt(nx, true);
        }
      }
      syncNativeNextTrack();
      syncNativeFavorite(t);
    }
    syncNativeRepeat();
    liveOnTrack(t);
    return;
  }
  if (t) syncNativeFavorite(t);
  syncNativeRepeat();
  PL._cfTriggered = false;
  const fSec = fadeSec != null ? fadeSec : (PL.playing && PL.audio && PREFS.skipFade ? .52 : 0);
  if (PL.audio) {
    if (fSec > .05 && !PL.audio.paused) {
      const oldA = PL.audio;
      PL.fadingOut.push({ a: oldA, g: PL.fadeG || 1, dur: fSec });
      PL.audio = null;
    } else {
      PL.audio.pause(); PL.audio = null;
    }
  }
  if (t && t.src) {
    const a = PL.audio = new Audio(t.src);
    PL.fadeDur = fSec;
    PL.fadeG = fSec > .05 ? .02 : 1;
    a.volume = clamp(PL.vol * PL.fadeG, 0, 1);
    a.preload = 'auto';
    PL.loading = true;
    PL.trackLoading = true;
    PL.loadingSince = performance.now();
    a.addEventListener('playing', () => { if (PL.audio === a) { PL.loading = false; PL.trackLoading = false; PL.loadingSince = 0; attachAudioEq(a); redraw(); } });
    a.addEventListener('loadedmetadata', () => { if (PL.audio === a && isFinite(a.duration) && a.duration > 1) { t.dur = Math.round(a.duration); LIVE.errRun = 0; redraw(); } });
    a.addEventListener('ended', () => { if (PL.audio === a) next(true); });
    a.addEventListener('error', () => { if (PL.audio !== a) return; PL.loading = false; PL.trackLoading = false; PL.loadingSince = 0; liveAudioError(t); if (++LIVE.errRun < 3 && PL.playing) setTimeout(() => { if (PL.audio === a) next(true); }, 1200); else PL.playing = false; redraw(); });
    if (PL.playing) a.play().catch(e => { if (e.name !== 'AbortError' && PL.audio === a) { liveToast(window.t('toast.browser_blocked')); PL.playing = false; redraw(); } });
  }
  liveOnTrack(t);
}
function playList(list, idx) {
  if (!list.length) return;
  LIVE.radio = [];
  PL.queue = list.slice();
  PL.qi = idx || 0;
  PL.pos = PL.sPos = 0;
  PL.playing = true;
  PL.shuffle = false;
  PL.smartShuffle = false;
  loadAudio();
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
function playShuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (!a.length) return;
  LIVE.radio = []; PL.queue = a; PL.qi = 0; PL.pos = PL.sPos = 0; PL.playing = true;
  PL.shuffle = true;
  PL.smartShuffle = !!PREFS.smartShuffle;
  loadAudio();
  if (PL.smartShuffle) {
    injectSmartShuffleRecs();
    syncNativeNextTrack();
  }
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
function togglePlay() {
  if (!cur() || (!window.SonoraNative && LIVE.on && !cur().src)) return;
  PL.playing = !PL.playing;
  if (window.SonoraNative) {
    if (PL.playing && typeof window.SonoraNative.getPlaybackSnapshot === 'function') {
      let snap = null;
      try { snap = JSON.parse(window.SonoraNative.getPlaybackSnapshot() || 'null'); } catch (e) {}
      if (!snap || !snap.active || snap.trackId !== cur().id) {
        const resumePos = PL.pos || 0;
        loadAudio(0, false);
        if (resumePos > 1 && typeof window.SonoraNative.seekTo === 'function') {
          window.SonoraNative.seekTo(resumePos);
          PL.pos = PL.sPos = resumePos;
        }
        if (typeof savePlayerState === 'function') savePlayerState(true);
        redraw();
        return;
      }
    }
    if (typeof window.SonoraNative.togglePlay === 'function') {
      window.SonoraNative.togglePlay();
    }
  } else if (PL.audio) {
    PL.playing ? PL.audio.play().catch(() => {}) : PL.audio.pause();
  }
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
/* Insert one smart recommendation every 3 non-manual tracks, preserving manually queued items. */
function smartInsertionPoints(startIdx, interval) {
  interval = interval || 3;
  const pts = [];
  let since = 0;
  for (let i = startIdx; i < PL.queue.length; i++) {
    const tr = PL.queue[i];
    if (tr && tr._queued) continue;
    since++;
    if (since >= interval) {
      pts.push(i + 1);
      since = 0;
    }
  }
  return pts;
}
function pickSmartRecs(count) {
  const have = new Set(PL.queue.map(t => t && t.id));
  const cands = [];
  const poolCap = Math.max((count || 1) * 3, 16);
  const pushCand = (x, tierBase) => {
    if (!x || !x.id || have.has(x.id)) return;
    if (typeof isTrackFrequentlySkipped === 'function' && isTrackFrequentlySkipped(x)) return;
    have.add(x.id);
    const aff = (typeof getTrackAffinityScore === 'function' ? getTrackAffinityScore(x) : 0) +
      (typeof getArtistAffinityBonus === 'function' ? getArtistAffinityBonus(x.artist) * 0.5 : 0);
    cands.push({
      tr: Object.assign({}, x, { _smartRec: true, _queued: false }),
      score: tierBase + aff
    });
  };
  if (LIVE.radio && LIVE.radio.length) {
    LIVE.radio.forEach(x => pushCand(x, 12));
  }
  if (cands.length < poolCap) {
    (LIVE.recent || []).concat(typeof favList === 'function' ? favList() : []).forEach(x => pushCand(x, 8));
  }
  if (cands.length < poolCap && LIVE.home) {
    LIVE.home.forEach(r => (r.items || []).filter(isTr).forEach(x => pushCand(x, 5)));
  }
  if (cands.length < poolCap && TRACKS.length) {
    const curTr = cur(), curAlb = curTr && BYID[curTr.album];
    const sameGenre = curAlb ? TRACKS.filter(t => BYID[t.album] && BYID[t.album].genre === curAlb.genre) : [];
    sameGenre.forEach(x => pushCand(x, 3));
    TRACKS.forEach(x => pushCand(x, 1));
  }
  cands.sort((a, b) => b.score - a.score);
  return cands.slice(0, count).map(it => it.tr);
}
function injectSmartShuffleRecs() {
  if (!PL.shuffle || !PL.smartShuffle) return;
  const head = PL.queue.slice(0, PL.qi + 1);
  const tail = PL.queue.slice(PL.qi + 1).filter(t => !(t && t._smartRec));
  PL.queue = head.concat(tail);
  const pts = smartInsertionPoints(PL.qi + 1, 3);
  if (!pts.length && tail.length >= 1) pts.push(PL.queue.length);
  const recs = pickSmartRecs(Math.max(1, pts.length));
  if (recs.length) {
    let shift = 0;
    for (let i = 0; i < pts.length && i < recs.length; i++) {
      const idx = Math.min(PL.queue.length, pts[i] + shift);
      PL.queue.splice(idx, 0, recs[i]);
      shift++;
    }
    const usedIds = new Set(recs.map(r => r.id));
    if (LIVE.radio && LIVE.radio.length) LIVE.radio = LIVE.radio.filter(r => !usedIds.has(r.id));
    redraw();
  } else if (LIVE.on && cur() && !LIVE.radioBusy && typeof api === 'function') {
    LIVE.radioBusy = true;
    const t = cur(), qRef = PL.queue;
    api('/api/radio/' + t.id).then(d => {
      if (qRef !== PL.queue) return;
      const have = new Set(PL.queue.map(x => x && x.id));
      const trks = (d.tracks || []).map(ingestTrack).filter(x => x && !have.has(x.id));
      LIVE.radio.push(...trks);
      if (PL.shuffle && PL.smartShuffle) injectSmartShuffleRecs();
    }).catch(() => {}).finally(() => { LIVE.radioBusy = false; redraw(); });
  }
}
function setShuffle(on, smart) {
  PL.shuffle = !!on;
  PL.smartShuffle = !!(on && smart);
  const head = PL.queue.slice(0, PL.qi + 1);
  const tail = PL.queue.slice(PL.qi + 1).filter(t => !(t && t._smartRec));
  if (on) {
    // Keep manually queued ("Play next" / swipe-to-queue) items ahead of shuffled tracks.
    const manual = tail.filter(t => t && t._queued);
    const rest = tail.filter(t => !(t && t._queued));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    PL.queue = head.concat(manual, rest);
    if (PL.smartShuffle) injectSmartShuffleRecs();
  } else {
    PL.queue = head.concat(tail);
  }
  syncNativeNextTrack();
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
function cycleShuffleMode() {
  if (!PL.shuffle) {
    setShuffle(true, false);
    if (typeof liveToast === 'function') liveToast(t('toast.shuffle_on'), 1800);
  } else if (!PL.smartShuffle) {
    PREFS.smartShuffle = true; savePrefs();
    setShuffle(true, true);
    if (typeof liveToast === 'function') liveToast(t('toast.smart_shuffle_on'), 2400);
  } else {
    setShuffle(false, false);
    if (typeof liveToast === 'function') liveToast(t('toast.shuffle_off'), 1800);
  }
}
function moreTracks() {
  if (LIVE.on && LIVE.radio.length) {
    PL.queue.push(...LIVE.radio.splice(0, 40));
    return;
  }
  const have = new Set(PL.queue.map(t => t.id));
  const pool = TRACKS.filter(t => !have.has(t.id));
  const a = (pool.length > 6 ? pool : TRACKS).slice().sort(() => Math.random() - .5).slice(0, 8);
  PL.queue.push(...a);
  if (LIVE.on && cur() && !LIVE.radioBusy && LIVE.radio.length < 5) liveOnTrack(cur());
}
function next(auto, customFade) {
  const autoAdv = !!auto;
  if (autoAdv && PL.repeat === 2) {
    if (_recCurTrack) recordTrackCompletion(_recCurTrack);
    recFlushCurrent();
    PL.pos = PL.sPos = 0;
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.play === 'function') {
      let snap = null;
      if (typeof window.SonoraNative.getPlaybackSnapshot === 'function') {
        try { snap = JSON.parse(window.SonoraNative.getPlaybackSnapshot() || 'null'); } catch (e) {}
      }
      const curTr = cur();
      if (snap && snap.active && curTr && snap.trackId === curTr.id && (snap.isPlaying || snap.isBuffering)) {
        if ((snap.posSec || 0) > 1.5 && typeof window.SonoraNative.seekTo === 'function') {
          window.SonoraNative.seekTo(0);
        }
      } else {
        loadAudio(0, true);
      }
      if (typeof savePlayerState === 'function') savePlayerState();
      redraw();
    } else if (PL.audio) {
      PL.audio.currentTime = 0;
      PL.audio.play().catch(() => {});
    }
    return;
  }
  if (!autoAdv && _recCurTrack && _recCurSec >= 1.2 && _recCurSec < 14) {
    recordTrackSkip(_recCurTrack, _recCurSec);
  }
  if (autoAdv && _recCurTrack) {
    recordTrackCompletion(_recCurTrack);
  }
  recFlushCurrent();
  if (PL.qi + 1 >= PL.queue.length) {
    if (PL.repeat === 1) PL.qi = 0;
    else if (PL.infinity) { moreTracks(); PL.qi++; }
    else { PL.playing = false; PL.pos = PL.sPos = 0; if (PL.audio) PL.audio.pause(); if (typeof savePlayerState === 'function') savePlayerState(true); redraw(); return; }
  } else PL.qi++;
  PL.pos = PL.sPos = 0;
  const fSec = customFade != null ? customFade : (autoAdv ? (PREFS.crossfade > 0 ? Math.min(2.5, PREFS.crossfade * .6) : (PREFS.skipFade ? .35 : 0)) : (PREFS.skipFade ? .52 : 0));
  loadAudio(fSec, autoAdv);
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
function prev(force) {
  if (!force && (PL.pos > 3 || PL.qi === 0)) {
    PL.pos = PL.sPos = 0;
    if (window.SonoraNative && typeof window.SonoraNative.seekTo === 'function') window.SonoraNative.seekTo(0);
    else if (PL.audio) PL.audio.currentTime = 0;
  } else if (PL.qi > 0) {
    recFlushCurrent();
    PL.qi--; PL.pos = PL.sPos = 0; loadAudio(PREFS.skipFade ? .52 : 0, false);
  } else {
    PL.pos = PL.sPos = 0;
    if (window.SonoraNative && typeof window.SonoraNative.seekTo === 'function') window.SonoraNative.seekTo(0);
    else if (PL.audio) PL.audio.currentTime = 0;
  }
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}
function seek(p) {
  const t = cur();
  PL.pos = PL.sPos = clamp(p, 0, durOf(t));
  if (window.SonoraNative && typeof window.SonoraNative.seekTo === 'function') {
    window.SonoraNative.seekTo(PL.pos);
  } else if (PL.audio) {
    PL.audio.currentTime = PL.pos;
  }
  PL._cfTriggered = false;
  if (typeof savePlayerState === 'function') savePlayerState();
  redraw();
}

function dismissMiniPlayer() {
  const prevTr = cur();
  if (typeof recFlushCurrent === 'function') recFlushCurrent();
  if (typeof SH !== 'undefined') {
    SH.target = 0;
    SH.t = 0;
    SH.drag = 0;
  }
  if (prevTr) {
    NAV.miniDismissTr = prevTr;
    NAV.miniDismissY = Math.max(0, NAV.miniDy || 0);
    NAV.miniDismissT = clamp(1 - NAV.miniDismissY / 52, 0.2, 1);
  }
  NAV.miniDy = 0;
  NAV.miniDx = 0;
  NAV.min = 0;
  PL._dismissedAt = performance.now();
  PL._switchTime = 0;
  PL.queue = [];
  PL.qi = 0;
  PL.pos = 0;
  PL.sPos = 0;
  PL.playing = false;
  PL.loading = false;
  PL.trackLoading = false;
  PL.loadingSince = 0;
  PL.qualityLabel = '';
  PL.qualityTrackId = null;
  PL._cfTriggered = false;
  if (typeof LIVE !== 'undefined' && Array.isArray(LIVE.radio)) LIVE.radio = [];
  if (PL.audio) {
    try { PL.audio.pause(); } catch (e) {}
    PL.audio = null;
  }
  if (Array.isArray(PL.fadingOut) && PL.fadingOut.length) {
    PL.fadingOut.forEach(it => { try { it && it.a && it.a.pause(); } catch (e) {} });
    PL.fadingOut = [];
  }
  _lastNextTrackKey = null;
  if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.stopPlayback === 'function') {
    try { window.SonoraNative.stopPlayback(); } catch (e) {}
  }
  try { localStorage.removeItem('sonora-player-v1'); } catch (e) {}
  if (typeof savePlayerState === 'function') savePlayerState(true);
  if (typeof redraw === 'function') redraw();
}
if (typeof window !== 'undefined') window.dismissMiniPlayer = dismissMiniPlayer;

let _lastPlayerStateSaveT = 0;
window.onSonoraPlaybackState = function(isPlaying, posSec, durSec, isBuffering, trackId) {
  if (PL._dismissedAt && (performance.now() - PL._dismissedAt) < 1000 && !cur()) {
    if (!isPlaying && !trackId) PL._dismissedAt = 0;
    return;
  }
  if (trackId && !cur()) {
    if (typeof reconcileNativePlayback === 'function') reconcileNativePlayback();
    return;
  }
  if (trackId && cur() && trackId !== cur().id) {
    if (PL._switchTime && performance.now() - PL._switchTime < 1500) return;
    if (typeof reconcileNativePlayback === 'function') reconcileNativePlayback();
    return;
  }
  const wasPlaying = PL.playing;
  const wasLoading = PL.loading;
  const curTr = cur();
  const prevDur = curTr ? curTr.dur : 0;
  if (isPlaying) {
    PL.loading = false;
    PL.trackLoading = false;
    PL.loadingSince = 0;
    PL.playing = true;
    PL.pos = posSec;
    if (!wasPlaying || PL.sPos == null || Math.abs(posSec - PL.sPos) > 0.35) {
      PL.sPos = posSec;
    }
  } else if (isBuffering) {
    if (!PL.loading) {
      PL.loading = true;
      PL.loadingSince = performance.now();
    }
    PL.playing = true;
    if (posSec !== undefined && posSec !== null && !isNaN(posSec)) {
      PL.pos = posSec;
      PL.sPos = posSec;
    }
  } else {
    PL.playing = false;
    PL.loading = false;
    PL.trackLoading = false;
    PL.loadingSince = 0;
    if (posSec !== undefined && posSec !== null && !isNaN(posSec)) {
      PL.pos = posSec;
      PL.sPos = posSec;
    }
  }
  const newDur = (durSec > 1 && curTr) ? Math.round(durSec) : prevDur;
  if (durSec > 1 && curTr) curTr.dur = newDur;
  const stateChanged = wasPlaying !== PL.playing || wasLoading !== PL.loading || newDur !== prevDur;
  if (typeof savePlayerState === 'function') {
    const now = performance.now();
    if (stateChanged || (!isPlaying && wasPlaying)) {
      _lastPlayerStateSaveT = now;
      savePlayerState(!PL.playing);
    } else if (PL.playing && (!_lastPlayerStateSaveT || now - _lastPlayerStateSaveT >= 5000)) {
      _lastPlayerStateSaveT = now;
      savePlayerState();
    }
  }
  const lyVis = typeof SH !== 'undefined' && (SH.mode === 'lyrics' || (SH.fromMode === 'lyrics' && typeof SP !== 'undefined' && (SP.shMode.busy || SP.qMode.busy)));
  if (stateChanged) {
    redraw();
  } else if (typeof SH !== 'undefined' && SH.t > .01) {
    if (lyVis) redrawSheetContent();
    else { D.scene = true; _wakeFrame(); }
  } else if (PL.playing) {
    _wakeFrame();
  }
};

window.onSonoraPlaybackError = function(trackId, msg) {
  if (cur() && cur().id === trackId) {
    PL.loading = false;
    PL.trackLoading = false;
    PL.loadingSince = 0;
    PL.playing = false;
    if (typeof liveAudioError === 'function') liveAudioError(cur());
    redraw();
  }
};

window.SonoraNext = function(isAuto) {
  next(isAuto !== false);
};

window.onSonoraStreamQuality = function(trackId, label) {
  if (label) {
    PL.qualityTrackId = trackId || (cur() && cur().id) || null;
    PL.qualityLabel = label;
    if (cur() && (!trackId || cur().id === trackId)) cur().qualityLabel = label;
    redraw();
  }
};

window.onSonoraGaplessTrack = function(trackId) {
  if (!trackId) return;
  let nextIdx = -1;
  if (PL.qi + 1 < PL.queue.length && PL.queue[PL.qi + 1] && PL.queue[PL.qi + 1].id === trackId) {
    nextIdx = PL.qi + 1;
  } else if (PL.repeat === 1 && PL.queue[0] && PL.queue[0].id === trackId) {
    nextIdx = 0;
  }
  if (nextIdx >= 0) {
    const prevTr = _recCurTrack || cur();
    if (prevTr) recordTrackCompletion(prevTr);
    recFlushCurrent();
    PL.qi = nextIdx;
    PL.pos = PL.sPos = 0;
    PL.playing = true;
    PL.loading = false;
    PL.trackLoading = false;
    const t = cur();
    if (t && typeof preloadArt === 'function') preloadArt(t, true);
    syncNativeFavorite(t);
    liveOnTrack(t);
    syncNativeNextTrack();
    redraw();
  }
};

window.onSonoraAutoCrossfade = function(fromTrackId) {
  if (!cur() || (fromTrackId && cur().id !== fromTrackId)) return;
  next(true);
};

window.onSonoraSleepTimer = function(active, mode, remainingSec) {
  PL.sleepActive = !!active;
  PL.sleepMode = mode || 'off';
  PL.sleepRemSec = remainingSec || 0;
  redraw();
};

window.onSonoraAudioOutputsChanged = function() {
  if (typeof refreshAudioOutputsCache === 'function') refreshAudioOutputsCache();
  if (typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER.open) {
    if (typeof updateOutDrawerLayout === 'function') updateOutDrawerLayout();
    redraw();
  }
};

window.SonoraPrev = function() {
  prev();
};

window.onSonoraBackPressed = function() {
  if (typeof navDepth === 'function' && navDepth() === 0) {
    return "false";
  }
  const P = typeof topPage === 'function' ? topPage() : null;
  const s = typeof stackOf === 'function' ? stackOf() : null;
  let handled = false;

  if (typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER.open) {
    if (typeof closeOutDrawer === 'function') closeOutDrawer();
    handled = true;
  } else if (typeof CM !== 'undefined' && CM.open) {
    if (typeof closeCM === 'function') closeCM();
    handled = true;
  } else if (typeof SRCUI !== 'undefined' && SRCUI.open) {
    SRCUI.open = false;
    if (typeof redraw === 'function') redraw();
    handled = true;
  } else if (typeof NAV !== 'undefined' && NAV.menu) {
    NAV.menu = false;
    if (typeof redraw === 'function') redraw();
    handled = true;
  } else if (typeof SH !== 'undefined' && (SH.target > 0.5 || SH.t > 0.5)) {
    if (typeof closeSheet === 'function') closeSheet();
    handled = true;
  } else if (P && typeof hasPill === 'function' && hasPill(P) && P.qOpen) {
    P.qOpen = false; P.q = '';
    if (typeof $q !== 'undefined') { $q.value = ''; $q.blur(); }
    if (typeof redraw === 'function') redraw();
    handled = true;
  } else if (P && P.libQOpen) {
    P.libQOpen = false; P.libQ = '';
    if (typeof $q !== 'undefined') { $q.value = ''; $q.blur(); }
    if (typeof redraw === 'function') redraw();
    handled = true;
  } else if (s && s.length > 1) {
    if (typeof NAV !== 'undefined' && NAV.popT === 1) { s.pop(); NAV.popP = NAV.popT = 0; }
    if (s.length > 1) {
      if (typeof pop === 'function') pop();
    } else {
      if (typeof redraw === 'function') redraw();
    }
    handled = true;
  } else if (typeof NAV !== 'undefined' && NAV.tab === 'search') {
    if (typeof goTab === 'function') goTab(NAV.last && NAV.last !== 'search' ? NAV.last : 'home');
    handled = true;
  } else if (typeof NAV !== 'undefined' && NAV.tab !== 'home') {
    if (typeof goTab === 'function') goTab('home');
    handled = true;
  }

  if (handled && typeof syncHistory === 'function') {
    syncHistory();
  }
  return handled ? "true" : "false";
};
let _waveVis = false;
function tickPlayer(dt) {
  if (PL.fadingOut.length) {
    for (let i = PL.fadingOut.length - 1; i >= 0; i--) {
      const fo = PL.fadingOut[i];
      fo.g -= dt / Math.max(.08, fo.dur);
      if (fo.g <= .01 || fo.a.paused) {
        try { fo.a.pause(); fo.a.src = ''; } catch (e) {}
        PL.fadingOut.splice(i, 1);
      } else {
        try { fo.a.volume = clamp(PL.vol * fo.g * fo.g, 0, 1); } catch (e) {}
      }
    }
  }
  if (PL.audio && PL.fadeG < 1 && !PL.loading) {
    PL.fadeG = Math.min(1, PL.fadeG + dt / Math.max(.08, PL.fadeDur || .45));
    try { PL.audio.volume = clamp(PL.vol * (1 - (1 - PL.fadeG) * (1 - PL.fadeG)), 0, 1); } catch (e) {}
  }
  if (!PL.playing) return; const t = cur(); if (!t) return;
  if (PL.audio) {
    const raw = PL.audio.currentTime;
    if (!PL.loading) {
      if (PL.sPos == null || Math.abs(raw - PL.sPos) > .18) PL.sPos = raw;
      else PL.sPos += dt + (raw - PL.sPos) * Math.min(1, dt * 10);
      PL.pos = raw;
    } else {
      PL.sPos = raw;
      PL.pos = raw;
    }
    const cf = PREFS.crossfade || 0;
    if (cf > 0 && !PL._cfTriggered && PL.repeat !== 2 && isFinite(PL.audio.duration) && PL.audio.duration > cf + 8) {
      const rem = PL.audio.duration - raw;
      if (rem > .15 && rem <= cf) {
        PL._cfTriggered = true;
        next(true, rem);
        return;
      }
    }
  } else {
    if (!PL.loading && PL.playing) {
      PL.pos += dt;
      if (PL.sPos == null || Math.abs(PL.pos - PL.sPos) > .35) PL.sPos = PL.pos;
      else PL.sPos += dt + (PL.pos - PL.sPos) * Math.min(1, dt * 8);
    } else {
      PL.sPos = PL.pos;
    }
  }
  if (!PL.audio && PL.pos >= durOf(t)) next(true);
  if (typeof recTick === 'function') recTick(t, dt);
  if (SH.t > .01) {
    const lyVis = SH.mode === 'lyrics' || (SH.fromMode === 'lyrics' && typeof SP !== 'undefined' && (SP.shMode.busy || SP.qMode.busy));
    if (lyVis) { D.scene = D.gl = true; _wakeFrame(); }
    else if (Math.floor(PL.pos * 2) !== tickPlayer.q) { tickPlayer.q = Math.floor(PL.pos * 2); D.scene = true; _wakeFrame(); }
  }
  if (_waveVis && SH.t < .98) { D.scene = true; _wakeFrame(); }
}
function seedMockPlayer() {
  const p = PLAYLISTS[0];
  if (!p || !Array.isArray(p.tracks) || !p.tracks.length) return;
  if (!PL.queue || !PL.queue.length) {
    PL.queue = p.tracks.slice(); PL.qi = 3; PL.pos = 17; PL.playing = false;
  }
}
_mockPlayerSeedReady = true;
seedMockPlayer();

const SONORA_IDB_NAME = 'sonora-idb-v1';
const SONORA_IDB_STORE = 'kv';
let _sonoraIdbPromise = null;
function _openSonoraIdb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (_sonoraIdbPromise) return _sonoraIdbPromise;
  _sonoraIdbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(SONORA_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (db && !db.objectStoreNames.contains(SONORA_IDB_STORE)) {
            db.createObjectStore(SONORA_IDB_STORE);
          }
        } catch (e) {}
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          db.onclose = () => { _sonoraIdbPromise = null; };
          db.onversionchange = () => { try { db.close(); } catch (e) {} _sonoraIdbPromise = null; };
        } catch (e) {}
        resolve(db);
      };
      req.onerror = () => { _sonoraIdbPromise = null; resolve(null); };
      req.onblocked = () => { resolve(null); };
    } catch (e) {
      _sonoraIdbPromise = null;
      resolve(null);
    }
  });
  return _sonoraIdbPromise;
}
function idbGet(key) {
  return _openSonoraIdb().then(db => {
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(SONORA_IDB_STORE, 'readonly');
        const req = tx.objectStore(SONORA_IDB_STORE).get(String(key));
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
        tx.onerror = () => resolve(null);
      } catch (e) {
        _sonoraIdbPromise = null;
        resolve(null);
      }
    });
  });
}
function idbSet(key, val) {
  return _openSonoraIdb().then(db => {
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(SONORA_IDB_STORE, 'readwrite');
        tx.objectStore(SONORA_IDB_STORE).put(val, String(key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (e) {
        _sonoraIdbPromise = null;
        resolve(false);
      }
    });
  });
}
function idbDel(key) {
  return _openSonoraIdb().then(db => {
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction(SONORA_IDB_STORE, 'readwrite');
        tx.objectStore(SONORA_IDB_STORE).delete(String(key));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (e) {
        _sonoraIdbPromise = null;
        resolve(false);
      }
    });
  });
}
if (typeof window !== 'undefined') {
  window.idbGet = idbGet;
  window.idbSet = idbSet;
  window.idbDel = idbDel;
}

const IT_MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const RECAP_KEY = 'sonora-recap';
let REC_HIST = { months: {} };
let _recHydrated = false;
function _mergeRecapHist(base, delta) {
  const out = {};
  const bMonths = (base && base.months && typeof base.months === 'object') ? base.months : {};
  const dMonths = (delta && delta.months && typeof delta.months === 'object') ? delta.months : {};
  const ymSet = new Set(Object.keys(bMonths).concat(Object.keys(dMonths)));
  for (const ym of ymSet) {
    const bm = bMonths[ym];
    const dm = dMonths[ym];
    if (!dm) {
      out[ym] = bm;
      continue;
    }
    if (!bm) {
      out[ym] = dm;
      continue;
    }
    const mergedTracks = {};
    const bt = (bm.tracks && typeof bm.tracks === 'object') ? bm.tracks : {};
    const dt = (dm.tracks && typeof dm.tracks === 'object') ? dm.tracks : {};
    const tidSet = new Set(Object.keys(bt).concat(Object.keys(dt)));
    for (const tid of tidSet) {
      const be = bt[tid];
      const de = dt[tid];
      if (!de) mergedTracks[tid] = be;
      else if (!be) mergedTracks[tid] = de;
      else {
        mergedTracks[tid] = Object.assign({}, be, de, {
          thumb: de.thumb || be.thumb || null,
          artistThumb: de.artistThumb || be.artistThumb || null,
          artistId: de.artistId || be.artistId || null,
          plays: (be.plays || 0) + (de.plays || 0),
          sec: (be.sec || 0) + (de.sec || 0)
        });
      }
    }
    out[ym] = {
      sec: (bm.sec || 0) + (dm.sec || 0),
      plays: (bm.plays || 0) + (dm.plays || 0),
      tracks: mergedTracks
    };
  }
  return out;
}
(function initRecapStorage() {
  let lsRaw = null;
  try { lsRaw = localStorage.getItem(RECAP_KEY); } catch (e) {}
  if (lsRaw) {
    try {
      const rh = JSON.parse(lsRaw);
      if (rh && rh.months && typeof rh.months === 'object') REC_HIST = rh;
    } catch (e) {}
    _recHydrated = true;
    idbSet(RECAP_KEY, REC_HIST).then(ok => {
      if (ok) { try { localStorage.removeItem(RECAP_KEY); } catch (e) {} }
    });
  } else {
    idbGet(RECAP_KEY).then(stored => {
      _recHydrated = true;
      const hadDelta = Boolean(REC_HIST && REC_HIST.months && Object.keys(REC_HIST.months).length > 0);
      if (stored && stored.months && typeof stored.months === 'object') {
        REC_HIST.months = _mergeRecapHist(stored, REC_HIST);
        if (hadDelta || _recDirty) saveRecap(true);
        if (typeof redraw === 'function') redraw();
      } else if (hadDelta || _recDirty) {
        saveRecap(true);
      }
    });
  }
})();
let _recSaveT = 0, _recCurId = null, _recCurTrack = null, _recCurSec = 0, _recCounted = false;
let _recPlayGen = 0, _recAffSkippedGen = -1, _recAffCompletedGen = -1;

const AFFINITY_KEY = 'sonora-affinity-v1';
let AFFINITY = { tracks: {}, artists: {} };
try {
  const af = JSON.parse(localStorage.getItem(AFFINITY_KEY) || 'null');
  if (af && typeof af === 'object') {
    AFFINITY = {
      tracks: (af.tracks && typeof af.tracks === 'object' && !Array.isArray(af.tracks)) ? af.tracks : {},
      artists: (af.artists && typeof af.artists === 'object' && !Array.isArray(af.artists)) ? af.artists : {}
    };
  }
} catch (e) {}
function _affArtistKey(artistName) {
  const raw = (String(artistName || '').split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i)[0] || '').trim();
  if (!raw) return '';
  const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return norm || raw.toLowerCase();
}
function _pruneAffinity() {
  const trMap = AFFINITY.tracks || (AFFINITY.tracks = {});
  const tKeys = Object.keys(trMap);
  if (tKeys.length > 400) {
    tKeys.sort((a, b) => Math.max(trMap[a].lc || 0, trMap[a].ls || 0) - Math.max(trMap[b].lc || 0, trMap[b].ls || 0));
    const drop = tKeys.length - 400;
    for (let i = 0; i < drop; i++) delete trMap[tKeys[i]];
  }
  const arMap = AFFINITY.artists || (AFFINITY.artists = {});
  const aKeys = Object.keys(arMap);
  if (aKeys.length > 200) {
    aKeys.sort((a, b) => ((arMap[a].c || 0) * 2 + (arMap[a].s || 0)) - ((arMap[b].c || 0) * 2 + (arMap[b].s || 0)));
    const drop = aKeys.length - 200;
    for (let i = 0; i < drop; i++) delete arMap[aKeys[i]];
  }
}
let _affSaveTimer = 0, _affSaveDirty = false;
function flushAffinitySave() {
  if (_affSaveTimer) { clearTimeout(_affSaveTimer); _affSaveTimer = 0; }
  if (!_affSaveDirty) return;
  _affSaveDirty = false;
  try {
    _pruneAffinity();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AFFINITY_KEY, JSON.stringify(AFFINITY));
    }
  } catch (e) {}
}
function saveAffinity(immediate) {
  _affSaveDirty = true;
  if (immediate) { flushAffinitySave(); return; }
  if (_affSaveTimer) return;
  _affSaveTimer = setTimeout(() => {
    _affSaveTimer = 0;
    flushAffinitySave();
  }, 1500);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushAffinitySave);
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAffinitySave();
  });
}
function recordTrackSkip(t, sec) {
  if (!t || !t.id) return;
  if (typeof sec !== 'number' || isNaN(sec) || sec < 1.2 || sec >= 14) return;
  if (_recCurTrack && _recCurTrack.id === t.id) {
    if (_recAffSkippedGen === _recPlayGen) return;
    _recAffSkippedGen = _recPlayGen;
  }
  const trMap = AFFINITY.tracks || (AFFINITY.tracks = {});
  const e = trMap[t.id] || (trMap[t.id] = { s: 0, c: 0, streak: 0, ls: 0, lc: 0 });
  e.s = (e.s || 0) + 1;
  e.streak = (e.streak || 0) + 1;
  e.ls = Date.now();
  const ak = _affArtistKey(t.artist);
  if (ak) {
    const arMap = AFFINITY.artists || (AFFINITY.artists = {});
    const ar = arMap[ak] || (arMap[ak] = { s: 0, c: 0 });
    ar.s = (ar.s || 0) + 1;
  }
  saveAffinity();
}
function recordTrackCompletion(t) {
  if (!t || !t.id) return;
  if (_recCurTrack && _recCurTrack.id === t.id) {
    if (_recAffCompletedGen === _recPlayGen) return;
    _recAffCompletedGen = _recPlayGen;
  }
  const trMap = AFFINITY.tracks || (AFFINITY.tracks = {});
  const e = trMap[t.id] || (trMap[t.id] = { s: 0, c: 0, streak: 0, ls: 0, lc: 0 });
  e.c = (e.c || 0) + 1;
  e.streak = 0;
  e.lc = Date.now();
  const ak = _affArtistKey(t.artist);
  if (ak) {
    const arMap = AFFINITY.artists || (AFFINITY.artists = {});
    const ar = arMap[ak] || (arMap[ak] = { s: 0, c: 0 });
    ar.c = (ar.c || 0) + 1;
  }
  saveAffinity();
}
function getTrackAffinityScore(t) {
  if (!t || !t.id) return 0;
  const e = AFFINITY && AFFINITY.tracks && AFFINITY.tracks[t.id];
  if (!e) return 0;
  const s = e.s || 0, c = e.c || 0, streak = e.streak || 0;
  if (streak >= 3) return clamp(-18 - Math.min(2, Math.max(0, s - 3)), -20, 15);
  if (streak >= 2 && c === 0) return -12;
  let score = 0;
  if (c >= 1) score += Math.min(15, Math.min(c, 3) * 4);
  score -= Math.min(6, s * 2);
  return clamp(score, -20, 15);
}
function isTrackFrequentlySkipped(t) {
  if (!t || !t.id) return false;
  const e = AFFINITY && AFFINITY.tracks && AFFINITY.tracks[t.id];
  if (!e) return false;
  const streak = e.streak || 0, c = e.c || 0, ls = e.ls || 0;
  if (streak >= 3) return true;
  if (streak >= 2 && c === 0 && (Date.now() - ls) < 14 * 86400000) return true;
  return false;
}
function getArtistAffinityBonus(artistName) {
  const ak = _affArtistKey(artistName);
  if (!ak || !AFFINITY || !AFFINITY.artists) return 0;
  const ar = AFFINITY.artists[ak];
  if (!ar) return 0;
  return clamp((ar.c || 0) * 2 - (ar.s || 0) * 2, -6, 8);
}
function recStartTrack(t, counted) {
  if (!t || !t.id) return;
  if (_recCurTrack && _recCurTrack.id !== t.id) recFlushCurrent();
  _recPlayGen++;
  _recCurId = t.id;
  _recCurTrack = t;
  _recCurSec = 0;
  _recCounted = !!counted;
}
function recFlushCurrent() {
  if (_recCurTrack) {
    const dur = _recCurTrack.dur || 0;
    if (_recCurSec >= 42 || (dur > 20 && _recCurSec >= dur * 0.5)) {
      recordTrackCompletion(_recCurTrack);
    }
  }
  _recCurId = null;
  _recCurTrack = null;
  _recCurSec = 0;
  _recCounted = false;
  _recPlayGen++;
  if (_recDirty) saveRecap();
}
if (typeof window !== 'undefined') {
  window.AFFINITY = AFFINITY;
  window.recordTrackSkip = recordTrackSkip;
  window.recordTrackCompletion = recordTrackCompletion;
  window.getTrackAffinityScore = getTrackAffinityScore;
  window.isTrackFrequentlySkipped = isTrackFrequentlySkipped;
  window.getArtistAffinityBonus = getArtistAffinityBonus;
  window.recFlushCurrent = recFlushCurrent;
  window.recStartTrack = recStartTrack;
  window.syncNativeFavorite = syncNativeFavorite;
}
let _curYmCache = '', _curYmCacheAt = 0;
function curYmKey(offsetMonths) {
  if (!offsetMonths) {
    const now = Date.now();
    if (_curYmCache && (now - _curYmCacheAt) < 60000) return _curYmCache;
    const d = new Date(now);
    _curYmCache = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    _curYmCacheAt = now;
    return _curYmCache;
  }
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function fmtYmLabel(ym) {
  const [y, m] = String(ym || curYmKey(0)).split('-').map(Number);
  const months = typeof getMonths === 'function' ? getMonths() : IT_MONTHS;
  const fallback = typeof window !== 'undefined' && typeof window.t === 'function' ? window.t('common.month') : 'Mese';
  return (months[(m - 1 + 12) % 12] || fallback) + ' ' + (y || new Date().getFullYear());
}
let _recSaveTimer = 0, _recDirty = false;
function flushRecap() {
  if (_recSaveTimer) { clearTimeout(_recSaveTimer); _recSaveTimer = 0; }
  if (!_recDirty) return;
  if (!_recHydrated) return;
  _recDirty = false;
  idbSet(RECAP_KEY, REC_HIST).then(ok => {
    if (ok) {
      try { localStorage.removeItem(RECAP_KEY); } catch (e) {}
    } else {
      try { localStorage.setItem(RECAP_KEY, JSON.stringify(REC_HIST)); } catch (e) {}
    }
  });
}
function saveRecap(immediate) {
  _recDirty = true;
  if (immediate) { flushRecap(); return; }
  if (_recSaveTimer) return;
  _recSaveTimer = setTimeout(() => {
    _recSaveTimer = 0;
    flushRecap();
  }, 2000);
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushRecap);
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushRecap();
  });
}
function recRecordPlay(t, addSec, ymKey) {
  if (!t || !t.id) return;
  const ym = ymKey || curYmKey(0);
  const m = REC_HIST.months[ym] || (REC_HIST.months[ym] = { sec: 0, plays: 0, tracks: {} });
  let entry = m.tracks[t.id];
  if (!entry) {
    entry = m.tracks[t.id] = {
      id: t.id,
      title: t.title || window.t('common.track'),
      artist: t.artist || window.t('common.artist'),
      artistId: t.artistId || null,
      artistThumb: t.artistThumb || null,
      album: t.album || null,
      albumTitle: t.albumTitle || '',
      dur: t.dur || 180,
      hue: t.hue || 0,
      style: t.style || 0,
      thumb: t.thumb || null,
      plays: 0,
      sec: 0
    };
  } else {
    if (t.thumb && !entry.thumb) entry.thumb = t.thumb;
    if (t.artistThumb && !entry.artistThumb) entry.artistThumb = t.artistThumb;
    if (t.artistId && !entry.artistId) entry.artistId = t.artistId;
  }
  if (addSec === 'play') {
    entry.plays = (entry.plays || 0) + 1;
    m.plays = (m.plays || 0) + 1;
    saveRecap();
  } else if (typeof addSec === 'number' && addSec > 0) {
    entry.sec = (entry.sec || 0) + addSec;
    m.sec = (m.sec || 0) + addSec;
    _recDirty = true;
  }
}
function recTick(t, dt) {
  if (!t || !t.id || dt <= 0) return;
  if (_recCurId !== t.id) {
    if (_recCurTrack) recFlushCurrent();
    _recPlayGen++;
    _recCurId = t.id;
    _recCurTrack = t;
    _recCurSec = 0;
    _recCounted = false;
  }
  if (!_recCurTrack) _recCurTrack = t;
  _recCurSec += dt;
  recRecordPlay(t, dt);
  if (!_recCounted && _recCurSec >= 3.2) {
    _recCounted = true;
    recRecordPlay(t, 'play');
  }
  const now = performance.now();
  if (now - _recSaveT > 8000) {
    _recSaveT = now;
    saveRecap();
  }
}
function getRecapMonths() {
  const keys = Object.keys(REC_HIST.months || {}).sort();
  const curYm = curYmKey(0);
  if (keys.indexOf(curYm) < 0) keys.push(curYm);
  return keys.sort();
}
function getMonthlyRecap(ym) {
  const key = ym || curYmKey(0);
  const m = (REC_HIST.months && REC_HIST.months[key]) || { sec: 0, plays: 0, tracks: {} };
  const tList = Object.values(m.tracks || {}).map(e => {
    const liveTr = (LIVE.known && LIVE.known[e.id]) || BYID[e.id] || e;
    return {
      track: Object.assign({}, e, liveTr),
      plays: Math.max(1, e.plays || Math.round((e.sec || 0) / 120) || 1),
      sec: e.sec || ((e.plays || 1) * (e.dur || 180))
    };
  }).sort((a, b) => (b.plays - a.plays) || (b.sec - a.sec));

  const artMap = {};
  tList.forEach(({ track, plays }) => {
    const artFallback = window.t('common.artist');
    const rawName = (track.artist || artFallback).split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim() || track.artist || artFallback;
    const k = rawName.toLowerCase();
    if (!artMap[k]) {
      const arObj = (track.artistId && BYID[track.artistId]) || ARTISTS.find(a => a.title.toLowerCase() === k) || {
        kind: 'artist',
        id: track.artistId || ('ar_' + k),
        title: rawName,
        hue: track.hue || 0,
        style: track.style || 0,
        thumb: track.artistThumb || null
      };
      artMap[k] = { name: rawName, artist: arObj, plays: 0, sampleTrack: track };
    }
    artMap[k].plays += plays;
  });
  const topArtists = Object.values(artMap).sort((a, b) => b.plays - a.plays).slice(0, 5);
  const totalPlays = tList.reduce((acc, x) => acc + x.plays, 0);
  const totalSec = tList.reduce((acc, x) => acc + x.sec, 0);
  return {
    ym: key,
    label: fmtYmLabel(key),
    plays: totalPlays,
    minutes: Math.max(totalPlays ? 1 : 0, Math.round(totalSec / 60)),
    songOfTheMonth: tList.length ? tList[0].track : null,
    topTracks: tList.slice(0, 5),
    topArtists
  };
}

const mkPage = (kind, data) => ({ kind, data: data || {}, scroll: 0, vel: 0, rails: {}, h: 0 });
const NAV = { tab: 'home', stacks: { home: [mkPage('home')], new: [mkPage('new')], radio: [mkPage('radio')], library: [mkPage('library')], search: [mkPage('search')] }, popP: 0, popT: 0, pushP: 0, tabX: null, pinDismissed: false, menu: false, menuT: 0, focus: false, min: 0, minT: 0, miniDx: 0, miniDy: 0, miniDismissT: 0, miniDismissY: 0, miniDismissTr: null, lastScroll: 0, dirAcc: 0, pk: 0, sm: 0, last: 'home', lastPage: null, sFilter: 'all' };
const stackOf = () => NAV.stacks[NAV.tab];
const topPage = () => { const s = stackOf(); return s[s.length - 1]; };
function push(kind, data) {
  if (NAV.focus) {
    NAV.focus = false;
    if (typeof INP !== 'undefined') INP.focusPending = false;
    if (typeof $q !== 'undefined' && $q) $q.blur();
  }
  if (typeof window !== 'undefined' && typeof window.onPagePush === 'function') window.onPagePush();
  stackOf().push(mkPage(kind, data)); NAV.popP = 1; NAV.popT = 0; NAV.pushP = 1; if (typeof armHistory === 'function') armHistory(); redraw();
}
function pop() { if (stackOf().length > 1) { NAV.popT = 1; NAV.pushP = 0; redraw(); } }
function goTab(id) {
  const prevTab = NAV.tab;
  if (id !== 'search') { NAV.last = id; if (NAV.focus) { NAV.focus = false; $q.blur(); } }
  if (id === NAV.tab) { const s = stackOf(); if (s.length > 1) { NAV.stacks[id] = [s[0]]; } else { s[0].vel = 0; s[0].scrollTo = 0; } }
  else if (typeof window !== 'undefined' && typeof window.onTabSwitch === 'function') { window.onTabSwitch(prevTab, id); }
  NAV.tab = id; NAV.popP = NAV.popT = NAV.pushP = 0; NAV.menu = false; NAV.min = 0;
  if (typeof armHistory === 'function') armHistory();
  redraw();
}

const SH = { cols: null, t: 0, target: 0, drag: 0, mode: 'art', prevMode: 'lyrics', fromMode: 'art', modeP: 0, textP: 0, qScroll: 0, qVel: 0, qMax: 0, lScroll: 0, lTarget: 0, lMax: 0, lHold: 0, artK: 1, pk: .84, phase: 0, scrub: null, volDrag: false, lastTouch: 0, aloneT: 0, dragQueue: null, qSettle: null, qOff: new Map() };
const openSheet = () => {
  if (NAV.focus) { NAV.focus = false; INP.focusPending = false; $q.blur(); }
  SH.target = 1; SH.lSnap = true; SH.lastTouch = performance.now(); SH.aloneT = 0;
  if (typeof armHistory === 'function') armHistory();
  redraw();
};
const closeSheet = () => { SH.target = 0; SH.aloneT = 0; redraw(); };
function _decodeCoverParam(u) {
  let s = u;
  try {
    if (s.includes('/api/cover')) {
      const m = s.match(/[?&]u=([^&]+)/);
      if (m) s = decodeURIComponent(m[1]);
    }
  } catch (_) {}
  return s;
}
function isAppleArtistThumb(u) {
  if (!u || typeof u !== 'string') return false;
  const s = _decodeCoverParam(u);
  return s.includes('mzstatic.com') || s.includes('spotify.com') || s.includes('scdn.co');
}
function appleThumbAtSize(u, sz) {
  if (!u || typeof u !== 'string') return u;
  return u.replace(/([?&])s=\d+\b/, '$1s=' + sz);
}
function isSameCoverBase(u1, u2) {
  if (u1 === u2) return true;
  if (!u1 || !u2 || typeof u1 !== 'string' || typeof u2 !== 'string') return false;
  const re = /([?&])s=\d+\b/;
  return u1.replace(re, '$1s=0') === u2.replace(re, '$1s=0');
}
if (typeof window !== 'undefined') {
  window.isAppleArtistThumb = isAppleArtistThumb;
  window.appleThumbAtSize = appleThumbAtSize;
  window.isSameCoverBase = isSameCoverBase;
}
function isHqThumb(u) {
  if (!u || typeof u !== 'string') return false;
  if (isAppleArtistThumb(u)) return true;
  const s = _decodeCoverParam(u);
  if (s.includes('ytimg.com')) return false;
  if (s.includes('googleusercontent.com') || s.includes('ggpht.com')) {
    if (/(?:^|[^a-z0-9])(w2160|-h900|w1920|-h800|w1440|-h600|w816|-h340|w540|-h225)(?:[^a-z0-9]|$)/i.test(s)) return false;
    const dm = s.match(/[=-]w(\d+)-h(\d+)/i);
    if (dm) {
      const rw = parseInt(dm[1], 10), rh = parseInt(dm[2], 10);
      if (rw > 0 && rh > 0 && (rw / rh) >= 1.5) return false;
    }
    return true;
  }
  return false;
}
function openTrackArtist(t) {
  if (!t) return;
  const rawName = (t.artist || '').split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
  let ar = (t.artistId && BYID[t.artistId]) || ARTISTS.find(a => a.title.toLowerCase() === rawName.toLowerCase());

  const cachedThumb = t.artistThumb || (typeof _artThumbCache !== 'undefined' && rawName && _artThumbCache[rawName.toLowerCase()]);
  if (cachedThumb && (isAppleArtistThumb(cachedThumb) || isHqThumb(cachedThumb))) {
    if (ar && (!ar.thumb || (!isAppleArtistThumb(ar.thumb) && (isAppleArtistThumb(cachedThumb) || !isHqThumb(ar.thumb))))) {
      ar.thumb = cachedThumb;
      delete ARTC[ar.id];
    }
  }

  if (!ar && LIVE.on) {
    if (t.artistId) {
      ar = BYID[t.artistId] = {
        kind: 'artist',
        id: t.artistId,
        title: rawName || t.artist,
        hue: t.hue || (typeof h32 === 'function' ? (h32(t.artistId || rawName) % 360) : 220),
        style: t.style || 0,
        thumb: (cachedThumb && isHqThumb(cachedThumb)) ? cachedThumb : null
      };
    }
  }

  if (rawName && (!ar || !ar.thumb || !isAppleArtistThumb(ar.thumb))) {
    if (typeof fetchArtistThumb === 'function') {
      fetchArtistThumb(rawName, t.artistId).then(thumb => {
        if (thumb && (isAppleArtistThumb(thumb) || !ar || !ar.thumb)) {
          if (ar) {
            const sameBase = Boolean(ar.thumb && isSameCoverBase(ar.thumb, thumb));
            if (sameBase && /[?&]s=1200\b/.test(ar.thumb) && !/[?&]s=1200\b/.test(thumb)) thumb = ar.thumb;
            ar.thumb = thumb;
            if (!sameBase) delete ARTC[ar.id];
            if (typeof preloadArt === 'function') preloadArt(ar, true);
          }
          t.artistThumb = thumb;
          if (typeof redraw === 'function') redraw();
        }
      });
    }
  } else if (ar && ar.thumb) {
    if (typeof preloadArt === 'function') preloadArt(ar, true);
  }

  if (ar) {
    closeSheet();
    open(ar);
  } else if (rawName) {
    closeSheet();
    api('/api/search?q=' + encodeURIComponent(rawName) + '&type=artists&limit=4').then(d => {
      const list = (d.artists || []).map(ingestItem).filter(Boolean);
      const match = list.find(x => (x.title || '').toLowerCase() === rawName.toLowerCase()) || list[0];
      if (match) open(match);
      else { goTab('search'); NAV.query = rawName; $q.value = rawName; liveSearch(rawName); redraw(); }
    }).catch(() => {});
  }
}
function setSheetMode(newMode) {
  if (SRCUI.open && newMode !== 'lyrics') SRCUI.open = false;
  if (SH.mode === newMode) return;
  SH.fromMode = SH.mode;
  SH.prevMode = SH.fromMode;
  SH.mode = newMode;
  if (SH.mode === 'queue' && SH.fromMode === 'art') {
    SP.qMode.x = 1; SP.qMode.t = 1; SP.qMode.v = 0; SH.qModeP = 1;
  } else if (SH.mode === 'lyrics' && SH.fromMode === 'art') {
    SP.qMode.x = 0; SP.qMode.t = 0; SP.qMode.v = 0; SH.qModeP = 0;
  } else if (SH.mode === 'queue' && SH.fromMode === 'lyrics') {
    SP.qMode.x = 0; SP.qMode.t = 1; SP.qMode.v = 0;
  } else if (SH.mode === 'lyrics' && SH.fromMode === 'queue') {
    SP.qMode.x = 1; SP.qMode.t = 0; SP.qMode.v = 0;
  }
  SH.qScroll = 0; SH.lSnap = true; redraw();
}

class Spring {
  constructor(x, k, c) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = c; }
  step(dt) {
    if (Math.abs(this.t - this.x) <= 4e-4 && Math.abs(this.v) <= 4e-3) {
      this.x = this.t; this.v = 0;
      return;
    }
    const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = this.k * (this.t - this.x) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    if (Math.abs(this.t - this.x) <= 4e-4 && Math.abs(this.v) <= 4e-3) {
      this.x = this.t; this.v = 0;
    }
  }
  get busy() { return Math.abs(this.t - this.x) > 4e-4 || Math.abs(this.v) > 4e-3; }
}
const SRCUI = { open: false, t: 0, ex: false, exT: 0, style: (function () { try { return localStorage.getItem('sonora-ly-style') || 'anim'; } catch (e) { return 'anim'; } })() };
const SP = { tab: new Spring(0, 240, 19.5), tabP: new Spring(0, 380, 17), hl: new Spring(0, 300, 34.6), art: new Spring(.82, 230, 22), shMode: new Spring(0, 280, 29), shText: new Spring(0, 140, 20), qMode: new Spring(0, 230, 24), sP1: new Spring(0, 260, 25), sP2: new Spring(0, 260, 25), sP3: new Spring(1, 260, 25), sLyAnim: new Spring(SRCUI.style === 'classic' ? 0 : 1, 260, 25), sLyClassic: new Spring(SRCUI.style === 'classic' ? 1 : 0, 260, 25) };

let KBH = 0;
const isTr = t => !t.kind;
window.shareMediaItem = function(t) {
  if (!t) return;
  let url = '', title = '';
  if (isTr(t)) {
    url = 'https://music.youtube.com/watch?v=' + (t.id || '');
    title = (t.title || '') + (t.artist ? (' - ' + t.artist) : '');
  } else if (t.kind === 'artist') {
    url = 'https://music.youtube.com/channel/' + (t.id || '');
    title = t.title || '';
  } else {
    url = 'https://music.youtube.com/playlist?list=' + (t.id || '');
    title = t.title || '';
  }
  if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.share === 'function') {
    window.SonoraNative.share(url, title);
  } else if (typeof navigator !== 'undefined' && navigator.share) {
    navigator.share({ title, text: url, url }).catch(() => {});
  } else if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      if (typeof liveToast === 'function') liveToast(window.t('toast.link_copied'));
    }).catch(() => {});
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof liveToast === 'function') liveToast(window.t('toast.link_copied'));
    } catch (e) {
      if (typeof liveToast === 'function') liveToast(url);
    }
  }
};
const PINS = [];
const isPinned = it => PINS.some(x => x.id === it.id);
function saveState() {
  try { localStorage.setItem('sonora-state', JSON.stringify({ pins: PINS.map(x => x.id), fav: PL.fav })); } catch (e) {}
  if (LIVE.on) liveSave();
  if (typeof cur === 'function') syncNativeFavorite(cur());
  syncNativeRepeat();
}
try { const st = JSON.parse(localStorage.getItem('sonora-state') || 'null'); if (st) { (st.pins || []).forEach(id => { if (BYID[id]) PINS.push(BYID[id]); }); Object.assign(PL.fav, st.fav || {}); } } catch (e) {}
if (typeof window !== 'undefined') {
  window.onSonoraCycleRepeat = function(mode) {
    const nextMode = ((Number(mode) || 0) % 3 + 3) % 3;
    PL.repeat = nextMode;
    syncNativeRepeat();
    syncNativeNextTrack(true);
    if (typeof savePlayerState === 'function') savePlayerState();
    else saveState();
    if (typeof redraw === 'function') redraw();
  };
  window.onSonoraToggleFavorite = function(trackId, isFav) {
    const rawId = String(trackId || '').trim();
    if (!rawId) return;
    const bareId = rawId.replace(/^yt:/, '');
    const ytId = 'yt:' + bareId;
    const candIds = [rawId];
    if (bareId && candIds.indexOf(bareId) < 0) candIds.push(bareId);
    if (ytId && candIds.indexOf(ytId) < 0) candIds.push(ytId);

    const curTr = typeof cur === 'function' ? cur() : null;
    let resolvedId = '';
    if (curTr && curTr.id && candIds.indexOf(curTr.id) >= 0) {
      resolvedId = curTr.id;
    } else {
      for (let i = 0; i < candIds.length && !resolvedId; i++) {
        const cid = candIds[i];
        if (PL && PL.fav && Object.prototype.hasOwnProperty.call(PL.fav, cid)) resolvedId = cid;
      }
      for (let i = 0; i < candIds.length && !resolvedId; i++) {
        const cid = candIds[i];
        if (typeof LIVE !== 'undefined' && LIVE && LIVE.known && LIVE.known[cid]) resolvedId = cid;
      }
      for (let i = 0; i < candIds.length && !resolvedId; i++) {
        const cid = candIds[i];
        if (typeof BYID !== 'undefined' && BYID[cid]) resolvedId = cid;
      }
      if (!resolvedId && typeof TRACKS !== 'undefined' && Array.isArray(TRACKS)) {
        const found = TRACKS.find(tr => tr && tr.id && candIds.indexOf(tr.id) >= 0);
        if (found) resolvedId = found.id;
      }
      if (!resolvedId) resolvedId = rawId;
    }

    if (!PL.fav) PL.fav = {};
    if (isFav) {
      PL.fav[resolvedId] = true;
      if (curTr && curTr.id === resolvedId) {
        if (typeof LIVE !== 'undefined' && LIVE && LIVE.known && !LIVE.known[resolvedId]) {
          LIVE.known[resolvedId] = curTr;
        }
        if (typeof BYID !== 'undefined' && !BYID[resolvedId]) {
          BYID[resolvedId] = curTr;
        }
      }
    } else {
      for (let i = 0; i < candIds.length; i++) delete PL.fav[candIds[i]];
      delete PL.fav[resolvedId];
    }

    saveState();
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      const btn = document.getElementById('sStar');
      if (btn && btn.classList) btn.classList.toggle('active', !!isFav);
    }
    if (typeof redraw === 'function') redraw();
  };
}
const togglePin = it => { const i = PINS.findIndex(x => x.id === it.id); if (i >= 0) PINS.splice(i, 1); else PINS.push(it); saveState(); };
const CM = { open: false, tr: null, ax: 0, ay: 0, pressRow: -1, prevPressRow: -1, pressA: 0, mode: 'menu', prevMode: null, fade: 1, animH: 0, animY: 0, r: { x: 0, y: 0, w: 336, h: 290 }, sp: new Spring(0, 340, 37.5) };
const OUT_DRAWER = {
  open: false,
  sp: new Spring(0, 340, 37.5),
  drag: 0,
  pressRow: -1,
  prevPressRow: -1,
  pressA: 0,
  auto: true,
  outputs: [{ id: -1, kind: 'speaker', name: typeof window !== 'undefined' && typeof window.t === 'function' ? window.t('audio.speaker') : 'Altoparlante dispositivo', selected: true }],
  activeName: typeof window !== 'undefined' && typeof window.t === 'function'
    ? window.t('audio.auto_device', { name: window.t('audio.speaker') })
    : 'Automatico · Altoparlante dispositivo',
  rows: [],
  r: { x: 12, y: 0, w: 366, h: 300, rowH: 58 }
};
function syncOutputDrawerLocale() {
  if (typeof window === 'undefined' || typeof window.t !== 'function') return;
  const spName = window.t('audio.speaker');
  if (OUT_DRAWER.outputs && OUT_DRAWER.outputs.length === 1 && OUT_DRAWER.outputs[0].id === -1) {
    OUT_DRAWER.outputs[0].name = spName;
  }
  const sel = OUT_DRAWER.outputs && OUT_DRAWER.outputs.find(o => o.selected);
  if (OUT_DRAWER.auto) {
    OUT_DRAWER.activeName = window.t('audio.auto_device', { name: (sel && sel.name) || spName });
  }
}
if (typeof window !== 'undefined') window.syncOutputDrawerLocale = syncOutputDrawerLocale;
const MENU_SP = new Spring(0, 340, 37.5);
const CM_N = 4, CM_ROW = 50, CM_HEAD = 76;
const G = {};
let lg;
const LQ = {};
const SEG_SP = {};
function lqCtrl(id, initVal) {
  let c = LQ[id];
  if (!c) {
    c = LQ[id] = {
      id,
      val: new Spring(initVal, 1000, 63.2),
      vel: new Spring(0, 300, 17.3),
      pp: new Spring(0, 1000, 63.2),
      sx: new Spring(1, 250, 19.0),
      sy: new Spring(1, 250, 22.1),
      pressed: false, pending: false, lastX: 0, lastT: 0
    };
  }
  return c;
}
let _lqHasBusy = false;
function markLqBusy() {
  _lqHasBusy = true;
  _wakeFrame();
}
if (typeof window !== 'undefined') window.markLqBusy = markLqBusy;
function lqPress(c, px, ps) {
  c.pressed = true; c.pending = false;
  c.lastX = px; c.lastT = performance.now();
  c.vel.t = 0; c.pp.t = 1; c.sx.t = ps || 1.5; c.sy.t = ps || 1.5;
  _lqHasBusy = true;
  redraw();
}
function lqDrag(c, px, span) {
  const now = performance.now(), dt = (now - c.lastT) / 1000, dx = px - c.lastX;
  if (dt > .001 && span > 1) c.vel.t = dx / (span * dt);
  c.lastX = px; c.lastT = now;
  c.val.t = clamp(c.val.t + dx / Math.max(1, span), 0, 1);
  _lqHasBusy = true;
  redraw();
}
function lqRelease(c) {
  c.pressed = false;
  if (Math.abs(c.val.x - c.val.t) > .025) c.pending = true;
  else { c.pp.t = 0; c.sx.t = 1; c.sy.t = 1; c.vel.t = 0; }
  _lqHasBusy = true;
  redraw();
}
function stepLq(dt) {
  if (!_lqHasBusy) return false;
  let busy = false;
  for (const k in LQ) {
    const c = LQ[k];
    if (!c.pending && !c.pressed && !c.val.busy && !c.vel.busy && !c.pp.busy && !c.sx.busy && !c.sy.busy) continue;
    c.val.step(dt); c.vel.step(dt); c.pp.step(dt); c.sx.step(dt); c.sy.step(dt);
    if (c.pending && Math.abs(c.val.x - c.val.t) <= .025) {
      c.pending = false; c.pp.t = 0; c.sx.t = 1; c.sy.t = 1; c.vel.t = 0;
    }
    if (c.pending || c.pressed || c.val.busy || c.vel.busy || c.pp.busy || c.sx.busy || c.sy.busy) busy = true;
  }
  for (const k in SEG_SP) {
    const sp = SEG_SP[k];
    if (!sp.busy) continue;
    sp.step(dt);
    if (sp.busy) busy = true;
  }
  _lqHasBusy = busy;
  return busy;
}

const BTNG = ['back', 'more', 'av', 'apill', 'pSearch', 'hShuf', 'hDown', 'search', 'sStar', 'sMore', 'sP1', 'sP2', 'sP3', 'recapPlay', 'recapMonth', 'filt0', 'filt1', 'filt2', 'filt3', 'filt4', 'filtAct', 'sLyAnim', 'sLyClassic'];
const TINT_ACC = 'rgba(250,46,73,.82)', TINT_NEU = 'rgba(255,255,255,.22)';

function initGlass() {
  lg = new LiquidGlass($out, { maxDpr: 2, autoUpload: false, defaults: glassStyle(), onResize: relayout, onContextRestored: () => { if (typeof window !== 'undefined' && typeof window.onSonoraResume === 'function') window.onSonoraResume(); else if (typeof redraw === 'function') redraw(); } });
  _lastGlassPrefSig = _glassPrefSig();
  const setCtrlNames = [];
  for (let i = 0; i < 24; i++) setCtrlNames.push('setCtrl' + i);
  const names = ['tab', 'thumb', 'search', 'mini', 'more', 'av', 'back', 'apill', 'pSearch', 'backPrev', 'apillPrev', 'pSearchPrev', 'hShufPrev', 'hDownPrev', 'hShuf', 'hDown', 'menu', 'cm', 'outDrawer', 'prompt', 'sStar', 'sMore', 'sP1', 'sP2', 'sP3', 'sP4',
    'recapPlay', 'recapMonth', 'filt0', 'filt1', 'filt2', 'filt3', 'filt4', 'filtAct', 'sLyAnim', 'sLyClassic', 'offlineBanner',
    'setPrevBar', 'setPrevThumb', ...setCtrlNames];
  names.forEach(n => { G[n] = lg.add({ visible: false, x: 0, y: 0, width: 10, height: 10 }); });
  G.hShuf.set({ layer: 0 }); G.hDown.set({ layer: 0 }); G.hShufPrev.set({ layer: 0 }); G.hDownPrev.set({ layer: 0 });
  ['recapPlay', 'recapMonth', 'filt0', 'filt1', 'filt2', 'filt3', 'filt4', 'filtAct', 'offlineBanner'].forEach(n => G[n].set({ layer: 0 }));
  G.sLyAnim.set({ layer: 1 }); G.sLyClassic.set({ layer: 1 });
  G.tab.set({ layer: 1 }); G.mini.set({ layer: 1 }); G.thumb.set({ layer: 2, useOverlay: true });
  G.setPrevBar.set({ layer: 1 }); G.setPrevThumb.set({ layer: 2, useOverlay: true });
  for (let i = 0; i < 24; i++) G['setCtrl' + i].set({ layer: 2, useOverlay: false });
  G.menu.set({ layer: 4, cornerRadius: 24 }); G.cm.set({ layer: 4, cornerRadius: 28 }); G.outDrawer.set({ layer: 4, cornerRadius: 28 }); G.prompt.set({ layer: 4, cornerRadius: 28 });
  BTNG.forEach(n => G[n].set({ interactive: true }));
  applyStyles();
}
let PRESSED = null;
function pressAt(x, y) {
  relGlass(); if (!lg || CM.open || NAV.menu || OUT_DRAWER.open) return;
  for (const n of BTNG) { const g = G[n]; if (g && g.get('visible') && g.width > 0 && inR({ x: g.x, y: g.y, w: g.width, h: g.height }, x, y, 4)) { PRESSED = g; g.setPressed(true); return; } }
}
function relGlass() { if (PRESSED) { PRESSED.setPressed(false); PRESSED = null; } }
const SWQ_ROWS = new Map();
function swqRowState(key) {
  if (typeof SWQ !== 'undefined' && SWQ.key === key) return SWQ;
  return key ? (SWQ_ROWS.get(key) || null) : null;
}
const SWQ = {
  tr: null,
  key: null,
  x: 0,
  v: 0,
  target: 0,
  state: 'idle',
  crossed: false,
  crossP: 0,
  done: false,
  doneT: 0,
  hitT: 0,
  holdUntil: 0,
  baseX: 0,
  startX: 0
};
function applyStyles() {
  if (!lg || !G.tab) return; const d = pal.dark;
  const bBlur = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassBlur != null ? PREFS.glassBlur : 2);
  const rAmt = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassRefraction != null ? PREFS.glassRefraction : 24);
  const rH = Math.round(rAmt * (16 / 24));
  const chrom = PREFS.glassChromatic ? (PREFS.glassProfile === 'vivid' ? 1.0 : .8) : 0;
  const bar = { blur: bBlur, refractionHeight: rH, refractionAmount: rAmt, chromaticAberration: chrom, vibrancy: true, surfaceColor: null,
    highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 },
    shadow: { radius: 24, offsetY: 8, color: d ? 'rgba(0,0,0,.36)' : 'rgba(0,0,0,.16)' },
    tint: d ? 'rgba(255,255,255,.16)' : 'rgba(24,24,28,.28)' };
  [G.tab, G.search, G.mini, G.setPrevBar].forEach(g => g && g.set(bar));
  const tinted = { blur: bBlur, refractionHeight: rH, refractionAmount: rAmt, chromaticAberration: chrom, vibrancy: true, surfaceColor: null,
    highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 },
    shadow: { radius: 12, offsetY: 2, color: d ? 'rgba(0,0,0,.3)' : 'rgba(0,0,0,.08)' } };
  [G.more, G.av, G.back, G.apill, G.pSearch, G.backPrev, G.apillPrev, G.pSearchPrev, G.hShufPrev, G.hDownPrev, G.hShuf, G.hDown].forEach(g => g.set(Object.assign({}, tinted, { tint: d ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.60)' })));
  const rH12 = PREFS.glassProfile === 'light' ? 0 : Math.round(rAmt * (12 / 24));
  const liquidBtn = { blur: bBlur, refractionHeight: rH12, refractionAmount: rAmt, chromaticAberration: chrom, vibrancy: true, surfaceColor: null,
    highlight: { width: 1.0, blurRadius: 0.5, alpha: 0.5, style: 'default', angle: 45, falloff: 1.0 },
    shadow: { radius: 12, offsetY: 2, color: d ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.10)' } };
  [G.recapPlay, G.recapMonth, G.filt0, G.filt1, G.filt2, G.filt3, G.filt4, G.filtAct].forEach(g => g.set(liquidBtn));
  [G.sStar, G.sMore, G.sP1, G.sP2, G.sP3].forEach(g => g.set(Object.assign({}, tinted, { shadow: false, tint: TINT_NEU })));
  [G.sLyAnim, G.sLyClassic].forEach(g => g.set(Object.assign({}, liquidBtn, { shadow: false, tint: TINT_NEU })));
  if (G.offlineBanner) G.offlineBanner.set({
    blur: Math.max(4, bBlur * 2.2), refractionHeight: rH, refractionAmount: rAmt, chromaticAberration: chrom, vibrancy: true,
    tint: d ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.62)',
    surfaceColor: d ? 'rgba(24,24,28,.42)' : 'rgba(245,245,250,.50)',
    highlight: { width: 1, blurRadius: .5, alpha: d ? .28 : .55, style: 'default', angle: 45, falloff: 1 },
    innerShadow: null,
    shadow: { radius: 22, offsetY: 8, color: d ? 'rgba(0,0,0,.38)' : 'rgba(0,0,0,.12)' }
  });
  [G.menu, G.cm, G.outDrawer, G.prompt].forEach(g => g && g.set({ blur: Math.max(4, bBlur * 2.5), refractionHeight: rH, refractionAmount: rAmt, chromaticAberration: chrom, vibrancy: true,
    tint: d ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.55)',
    surfaceColor: d ? 'rgba(20,20,24,.45)' : 'rgba(245,245,250,.48)',
    highlight: { width: 1, blurRadius: .5, alpha: d ? .25 : .55, style: 'default', angle: 45, falloff: 1 },
    innerShadow: null,
    shadow: { radius: 28, offsetY: 10, color: d ? 'rgba(0,0,0,.42)' : 'rgba(0,0,0,.16)' } }));
}
let OUT_RECT = { left: 0, top: 0, width: 390, height: 844 };
function relayout() {
  W = $out.clientWidth; H = $out.clientHeight; FRAME = false; OUT_RECT = $out.getBoundingClientRect();
  if (typeof updateKBH === 'function') updateKBH();
  if (S.width !== $out.width || S.height !== $out.height) {
    S.width = O.width = $top.width = $out.width; S.height = O.height = $top.height = $out.height;
  }
  layout(); redraw();
  if (typeof drawScene === 'function' && (lg || FALLBACK) && W > 0 && H > 0) {
    if (typeof syncQ === 'function') syncQ();
    drawScene(); drawOverlay();
    if (!FALLBACK) { lg.markSceneDirty(); lg.markOverlayDirty(); updateGlass(0); lg.render(); }
    else { FALLBACK.setTransform(1, 0, 0, 1, 0, 0); FALLBACK.drawImage(S, 0, 0); FALLBACK.drawImage(O, 0, 0); }
    D.scene = D.ov = D.gl = false;
  }
}
