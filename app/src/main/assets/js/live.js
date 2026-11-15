const LIVEPAGES = {};
async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) { let m = 'HTTP ' + r.status; try { m = (await r.json()).detail || m; } catch (e) {} throw new Error(String(m).slice(0, 160)); }
  return r.json();
}

function cleanArtistLive(a) {
  if (!a) return '';
  const parts = a.split(/\s*,\s*|\s*&\s*/)
    .map(s => s.trim())
    .filter(s => {
      const l = s.toLowerCase();
      if (!l || l === 'brano' || l === 'canzone' || l === 'singolo' || l === 'album' || l === 'video' || l === 'song' || l === 'e' || l === 'and' || l === '&' || l === 'feat' || l === 'feat.' || l === 'ft' || l === 'ft.') return false;
      if (l.includes('riproduzion') || l.includes('visualizzazion') || l.includes('ascolt') || l.includes('views') || l.includes('plays') || l.includes('iscritt') || l.includes('subscribers')) return false;
      if (/\d+[\d.,]*\s*(?:k|m|b|mln|mila|milioni|mrd)/i.test(l)) return false;
      if (/^\d{1,2}[:.]\d{2}/.test(l)) return false;
      return true;
    });
  return parts.length ? parts.join(', ') : a;
}
function stubAlbum(id, f) {
  if (f && f.artist) f.artist = cleanArtistLive(f.artist);
  const e = BYID[id] || (BYID[id] = { kind: 'album', id, title: '', artist: '', hue: 0, style: 0 });
  for (const k in f) if (f[k] != null && (e[k] == null || e[k] === '')) e[k] = f[k];
  return e;
}
const _byArtistId = new Map();
const _savedIdSet = new Set();
let _libVersion = 0;
function _indexTrackArtist(t, prevArtistId) {
  if (prevArtistId && prevArtistId !== t.artistId) {
    const prevSet = _byArtistId.get(prevArtistId);
    if (prevSet) prevSet.delete(t);
  }
  if (t && t.artistId) {
    let set = _byArtistId.get(t.artistId);
    if (!set) { set = new Set(); _byArtistId.set(t.artistId, set); }
    set.add(t);
  }
}
function _syncSavedIndex() {
  _savedIdSet.clear();
  const list = LIVE.saved || [];
  for (let i = 0; i < list.length; i++) {
    const x = list[i];
    if (x && x.id) _savedIdSet.add(x.id);
  }
}
const _COMPILATION_ALBUM_RE = /\b(mi\s+manchi|rap\s+italiano|hit\s+mania|hits|top\s+hits|top\s+\d+|compilation|best\s+of|the\s+best|greatest\s+hits|antologia|anthology|raccolta|collezione|collection|essentials?|le\s+pi[uù]\s+belle|artisti\s+vari|various\s+artists|estate\s+\d*|summer\s+hits|mix\s+\d*|mega\s+mix|party\s+hits|workout|chill\s+hits|love\s+songs|canzoni\s+d'amore|100%\s+|successi|classifica|sanremo\s+\d*|anni\s+(?:60|70|80|90|2000)|radio\s+hits|italia\s+hits)\b/gi;
function _isCompilationAlbumName(alb, title) {
  if (!alb || typeof alb !== 'string') return false;
  const normAlb = _normSearch(alb);
  if (!normAlb) return false;
  const normTitle = _normSearch(title);
  if (normTitle && normAlb === normTitle) return false;
  const matches = alb.match(_COMPILATION_ALBUM_RE);
  if (!matches || !matches.length) return false;
  if (!normTitle) return true;
  for (let i = 0; i < matches.length; i++) {
    const kw = _normSearch(matches[i]);
    if (!kw || normTitle.indexOf(kw) < 0) return true;
  }
  return false;
}
var _searchCacheUpgradeHook = null;
var _searchCacheAlbumUpgradeHook = null;
function _normalizeAppleListThumb(u) {
  if (!u || typeof u !== 'string') return u;
  if (typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(u) && /[?&]s=288\b/.test(u)) {
    return typeof appleThumbAtSize === 'function' ? appleThumbAtSize(u, 544) : u.replace(/([?&])s=288\b/, '$1s=544');
  }
  return u;
}
function _forceAppleListThumb(u) {
  if (!u || typeof u !== 'string') return u;
  if (typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(u) && /[?&]s=(?:288|1080|1200|1400)\b/.test(u)) {
    return typeof appleThumbAtSize === 'function' ? appleThumbAtSize(u, 544) : u.replace(/([?&])s=(?:288|1080|1200|1400)\b/, '$1s=544');
  }
  return u;
}
function _preserveAppleHiRes(existingThumb, nextThumb) {
  if (existingThumb && nextThumb && /[?&]s=1200\b/.test(existingThumb) &&
      typeof isSameCoverBase === 'function' && isSameCoverBase(existingThumb, nextThumb)) {
    return existingThumb;
  }
  return nextThumb;
}
function ingestTrack(t) {
  if (!t || !t.id) return null;
  if (t.artist) t.artist = cleanArtistLive(t.artist);
  const old = LIVE.known[t.id], oldEx = old && old.ex, prevArtId = old && old.artistId, o = old || (LIVE.known[t.id] = {});
  const inAlbName = (t.albumTitle !== undefined && (t.album === t.albumId || (typeof t.album === 'string' && t.album.indexOf('s_') === 0))) ? t.albumTitle : t.album;
  const inComp = _isCompilationAlbumName(inAlbName, t.title);
  const oldAlbName = old ? (old.albumTitle || (old.album && BYID[old.album] && BYID[old.album].title) || '') : '';
  const oldWasCompilation = Boolean(old && _isCompilationAlbumName(oldAlbName, old.title || t.title));
  const oldIsApple = Boolean(old && old.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(old.thumb));
  const inIsApple = Boolean(t.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(t.thumb));
  const preserveOld = Boolean(!t.canonicalCover && old && old.thumb && (
    old.canonicalCover ||
    (oldIsApple && !inIsApple) ||
    (!oldWasCompilation && (inComp || !inAlbName))
  ));
  const upgradeFromComp = Boolean(t.thumb && (t.canonicalCover || (old && oldWasCompilation && !inComp)));

  let key, effThumb, effAlbTitle, effAlbId;
  if (preserveOld) {
    effThumb = old.thumb;
    effAlbTitle = old.albumTitle;
    effAlbId = old.albumId !== undefined ? old.albumId : (old.album && String(old.album).indexOf('s_') !== 0 ? old.album : null);
    key = old.album || effAlbId || ('s_' + t.id);
  } else {
    effThumb = t.thumb || (old && old.thumb) || null;
    if (effThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(effThumb)) {
      effThumb = _normalizeAppleListThumb(effThumb);
      if (old && old.thumb) effThumb = _preserveAppleHiRes(old.thumb, effThumb);
    }
    effAlbTitle = inAlbName || (t.canonicalCover && old && !oldWasCompilation ? old.albumTitle : inAlbName);
    const rawAlbId = t.albumId;
    const rawAlbObj = rawAlbId && typeof BYID !== 'undefined' ? BYID[rawAlbId] : null;
    const rawAlbIdIsComp = Boolean(rawAlbObj && _isCompilationAlbumName(rawAlbObj.title, t.title));
    const rawAlbTitleMismatch = Boolean(
      rawAlbObj && rawAlbObj.title && effAlbTitle &&
      _cleanAlbumThumbKey(rawAlbObj.title, t.artist) !== _cleanAlbumThumbKey(effAlbTitle, t.artist)
    );
    const rawAlbThumbMismatch = Boolean(
      t.canonicalCover && rawAlbObj && rawAlbObj.thumb && effThumb &&
      typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(rawAlbObj.thumb) &&
      typeof isSameCoverBase === 'function' && !isSameCoverBase(rawAlbObj.thumb, effThumb)
    );
    const rawAlbSharedDifferent = Boolean(
      t.canonicalCover && rawAlbObj && rawAlbObj.thumb && effThumb &&
      typeof isSameCoverBase === 'function' && !isSameCoverBase(rawAlbObj.thumb, effThumb) &&
      typeof TRACKS !== 'undefined' &&
      TRACKS.some(x => x && x.id !== t.id && x.album === rawAlbId && x.thumb && !isSameCoverBase(x.thumb, effThumb))
    );
    const detachRawAlb = Boolean(
      rawAlbId && (
        (upgradeFromComp && !inComp && (rawAlbIdIsComp || rawAlbTitleMismatch || rawAlbThumbMismatch || rawAlbSharedDifferent)) ||
        (t.canonicalCover && (rawAlbIdIsComp || rawAlbTitleMismatch || rawAlbThumbMismatch || rawAlbSharedDifferent))
      )
    );
    if (detachRawAlb) {
      effAlbId = null;
      key = 's_' + t.id;
    } else {
      effAlbId = rawAlbId;
      key = rawAlbId || ('s_' + t.id);
    }
  }

  const existingAl = typeof BYID !== 'undefined' ? BYID[key] : null;
  const alPrevThumb = existingAl ? existingAl.thumb : null;
  const al = stubAlbum(key, { title: effAlbTitle || t.title, artist: t.artist, hue: t.hue, style: t.style, thumb: effThumb });
  if (!preserveOld && effThumb) {
    const albThumbChanged = alPrevThumb !== effThumb || al.thumb !== effThumb || Boolean(old && old.thumb && old.thumb !== effThumb);
    const sameBaseAlb = Boolean(alPrevThumb && typeof isSameCoverBase === 'function' && isSameCoverBase(alPrevThumb, effThumb));
    const sameBaseTrack = Boolean(old && old.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(old.thumb, effThumb));
    if (upgradeFromComp) {
      al.thumb = _preserveAppleHiRes(alPrevThumb || al.thumb, effThumb);
      if (effAlbTitle && (!al.title || al.id === 's_' + t.id || _isCompilationAlbumName(al.title, t.title))) {
        al.title = effAlbTitle;
      }
      if (albThumbChanged) {
        if (!sameBaseAlb) {
          delete ARTC[al.id];
          if (typeof PALC !== 'undefined') delete PALC[al.id];
          if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[al.id];
          if (typeof TINTC !== 'undefined') { delete TINTC[al.id + 'd']; delete TINTC[al.id + 'l']; }
        }
        if (!sameBaseTrack && !sameBaseAlb) {
          delete ARTC[t.id];
          if (typeof PALC !== 'undefined') delete PALC[t.id];
          if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[t.id];
          if (typeof TINTC !== 'undefined') { delete TINTC[t.id + 'd']; delete TINTC[t.id + 'l']; }
        }
        if (old && old.album && old.album !== al.id && BYID[old.album] &&
            (old.album === 's_' + t.id || _isCompilationAlbumName(BYID[old.album].title, t.title))) {
          const oldAlbSameBase = Boolean(BYID[old.album].thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(BYID[old.album].thumb, effThumb));
          if (!oldAlbSameBase) {
            delete ARTC[old.album];
            if (typeof PALC !== 'undefined') delete PALC[old.album];
            if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[old.album];
            if (typeof TINTC !== 'undefined') { delete TINTC[old.album + 'd']; delete TINTC[old.album + 'l']; }
          }
          if (old.album === 's_' + t.id) {
            BYID[old.album].thumb = _preserveAppleHiRes(BYID[old.album].thumb, effThumb);
            if (effAlbTitle) BYID[old.album].title = effAlbTitle;
          }
        }
      }
    } else if (!al.thumb ||
               (key === 's_' + t.id && al.thumb !== effThumb && !(sameBaseAlb && /[?&]s=1200\b/.test(al.thumb))) ||
               (typeof isHqThumb === 'function' && isHqThumb(effThumb) && !isHqThumb(al.thumb)) ||
               (typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(effThumb) &&
                (!isAppleArtistThumb(al.thumb) ||
                 (sameBaseAlb ? (!/[?&]s=1200\b/.test(al.thumb) && (/[?&]s=1200\b/.test(effThumb) || (/[?&]s=288\b/.test(al.thumb) && /[?&]s=544\b/.test(effThumb))))
                              : (/[?&]s=1200\b/.test(effThumb) && al.thumb !== effThumb))))) {
      al.thumb = effThumb;
      if (!sameBaseAlb) delete ARTC[al.id];
    }
  }

  const nextCanonical = preserveOld
    ? Boolean(old && old.canonicalCover)
    : Boolean(t.canonicalCover || (old && old.canonicalCover && !oldWasCompilation));
  const canonicalBecameTrue = Boolean(nextCanonical && (!old || !old.canonicalCover));
  const trackThumbChanged = !old || old.thumb !== effThumb;
  Object.assign(o, t, {
    album: key,
    albumTitle: effAlbTitle,
    albumId: effAlbId != null ? effAlbId : null,
    thumb: effThumb,
    src: '/api/stream/' + t.id,
    ex: Boolean(oldEx || t.ex),
    canonicalCover: nextCanonical
  });
  if (nextCanonical) o._appleUpgradeSettled = true;
  delete o._lyricMatch;
  delete o.kind; o.dur = o.dur || 210; if (!old) TRACKS.push(o);
  _indexTrackArtist(o, prevArtId);
  const albumChanged = Boolean(old && old.album !== key);
  if ((upgradeFromComp || t.canonicalCover) && (trackThumbChanged || albumChanged || canonicalBecameTrue)) {
    if (typeof _propagateCanonicalTrack === 'function') _propagateCanonicalTrack(o);
    else if (typeof _searchCacheUpgradeHook === 'function') _searchCacheUpgradeHook(o);
  }
  _libVersion++;
  return o;
}
const _artThumbCache = {};
const _artThumbCold = {};
const _artThumbPending = {};
const _artThumbQ = [], _artThumbWaiters = new Map();
const ART_THUMB_MAX_CONC = 2;
let _artThumbAct = 0, _artThumbTimer = 0, _artThumbStaggerCount = 0;
function isAppleThumbCold(name) {
  const clean = _cleanArtistThumbName(name);
  if (!clean) return false;
  return (_artThumbCold[clean.toLowerCase()] || 0) > Date.now();
}
window.isAppleThumbCold = isAppleThumbCold;
function _cleanArtistThumbName(name) {
  return (name || '').split(/,|&|\bfeat\.?\b|\bft\.?\b/i)[0].trim();
}
function _applyArtistThumb(t, rawName, thumb) {
  if (!t || !thumb) return;
  const listThumb = _forceAppleListThumb(thumb);
  const ar = t.artistId && BYID[t.artistId];
  const arPrev = ar && ar.thumb;
  const effArThumb = _preserveAppleHiRes(arPrev, listThumb);
  t.artistThumb = _preserveAppleHiRes(t.artistThumb, listThumb);
  if (ar) {
    const sameBase = Boolean(arPrev && typeof isSameCoverBase === 'function' && isSameCoverBase(arPrev, effArThumb));
    ar.thumb = effArThumb;
    if (!sameBase) delete ARTC[t.artistId];
  }
  if (typeof preloadArt === 'function') {
    preloadArt({ id: t.artistId || rawName, thumb: ar ? ar.thumb : t.artistThumb, kind: 'artist' }, false);
  }
}
function fetchArtistThumb(name, id) {
  const clean = _cleanArtistThumbName(name);
  if (!clean) return Promise.resolve(null);
  const cacheKey = clean.toLowerCase();
  if (_artThumbCache[cacheKey] && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(_artThumbCache[cacheKey]))) {
    return Promise.resolve(_forceAppleListThumb(_artThumbCache[cacheKey]));
  }
  const existing = id && BYID[id];
  if (existing && existing.kind === 'artist' && existing.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(existing.thumb)) {
    const normExisting = _normalizeAppleListThumb(existing.thumb);
    if (normExisting !== existing.thumb) existing.thumb = normExisting;
    const listCached = _forceAppleListThumb(existing.thumb);
    _artThumbCache[cacheKey] = listCached;
    return Promise.resolve(listCached);
  }
  if (_artThumbPending[cacheKey]) return _artThumbPending[cacheKey];
  const req = api('/api/artist_art?name=' + encodeURIComponent(clean) + (id ? '&id=' + encodeURIComponent(id) : ''))
    .then(d => {
      if (d && d.thumb) {
        const resolvedThumb = _forceAppleListThumb(d.thumb);
        const existingObj = id && BYID[id];
        const prevThumb = existingObj ? existingObj.thumb : null;
        const effThumb = _preserveAppleHiRes(prevThumb, resolvedThumb);
        delete _artThumbCold[cacheKey];
        _artThumbCache[cacheKey] = resolvedThumb;
        if (existingObj) {
          const sameBase = Boolean(prevThumb && typeof isSameCoverBase === 'function' && isSameCoverBase(prevThumb, effThumb));
          existingObj.thumb = effThumb;
          if (!sameBase) delete ARTC[id];
        }
        return resolvedThumb;
      }
      if (d && d.cold) {
        _artThumbCold[cacheKey] = Date.now() + 2000;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => { delete _artThumbPending[cacheKey]; });
  _artThumbPending[cacheKey] = req;
  return req;
}
const _albThumbCache = {};
const _albThumbCold = {};
const _albThumbMiss = {};
const _albThumbPending = {};
function _cleanAlbumThumbKey(title, artist) {
  const cleanTitle = (title || '')
    .replace(/\s*[(\[][^)\]]*(?:deluxe|expanded|remaster|bonus|edition|version|anniversary|explicit|clean)[^)\]]*[)\]]/gi, '')
    .replace(/\s*[-–—]\s*(?:Single|EP|Album)\s*$/i, '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleanTitle) return '';
  const leadArtist = _cleanArtistThumbName(artist || '').replace(/\u2019/g, "'").toLowerCase();
  return cleanTitle + '|' + leadArtist;
}
function isAppleAlbumThumbCold(title, artist) {
  const ck = _cleanAlbumThumbKey(title, artist);
  if (!ck) return false;
  return (_albThumbCold[ck] || 0) > Date.now();
}
if (typeof window !== 'undefined') window.isAppleAlbumThumbCold = isAppleAlbumThumbCold;
function _invalidateCoverCaches(k, sameBase) {
  if (!k || sameBase) return;
  if (typeof ARTC !== 'undefined' && ARTC[k] && ARTC[k]._real) return;
  if (typeof ARTC !== 'undefined') delete ARTC[k];
  if (typeof PALC !== 'undefined') delete PALC[k];
  if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[k];
  if (typeof TINTC !== 'undefined') { delete TINTC[k + 'd']; delete TINTC[k + 'l']; }
}
function _applyAlbumThumb(id, thumb, title, artist) {
  if (!thumb) return;
  thumb = _forceAppleListThumb(thumb);
  const ck = title ? _cleanAlbumThumbKey(title, artist) : '';
  if (id && typeof BYID !== 'undefined' && BYID[id]) {
    const alb = BYID[id];
    const sameBase = Boolean(alb.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(alb.thumb, thumb));
    const sameApple = alb.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(alb.thumb) && isAppleArtistThumb(thumb);
    const effAlbThumb = _preserveAppleHiRes(alb.thumb, thumb);
    const canUpdateAlb = sameBase
      ? (effAlbThumb !== alb.thumb)
      : (!sameApple || /[?&]s=1200\b/.test(effAlbThumb) || /[?&]s=288\b/.test(alb.thumb));
    if (alb.thumb !== effAlbThumb && canUpdateAlb) {
      alb.thumb = effAlbThumb;
      _invalidateCoverCaches(id, sameApple || sameBase);
    }
  }
  if (typeof TRACKS !== 'undefined' && Array.isArray(TRACKS)) {
    for (let i = 0; i < TRACKS.length; i++) {
      const t = TRACKS[i];
      if (!t) continue;
      const matchId = id && t.album === id;
      const tKey = !matchId && ck && t.albumTitle ? _cleanAlbumThumbKey(t.albumTitle, t.artist) : '';
      if (matchId || (tKey && tKey === ck && (!t.album || t.album.indexOf('s_') === 0))) {
        const tSameBase = Boolean(t.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(t.thumb, thumb));
        const tSameApple = t.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(t.thumb) && isAppleArtistThumb(thumb);
        const effTrkThumb = _preserveAppleHiRes(t.thumb, thumb);
        const canUpdateTrk = tSameBase
          ? (effTrkThumb !== t.thumb)
          : (!t.canonicalCover && (!tSameApple || /[?&]s=1200\b/.test(effTrkThumb) || /[?&]s=288\b/.test(t.thumb)));
        if (t.thumb !== effTrkThumb && canUpdateTrk) {
          t.thumb = effTrkThumb;
          _invalidateCoverCaches(t.id, tSameApple || tSameBase);
          if (typeof preloadArt === 'function') preloadArt(t, false);
        }
      }
    }
  }
  if (typeof _searchCacheAlbumUpgradeHook === 'function') {
    _searchCacheAlbumUpgradeHook(id, title, artist, thumb);
  }
}
function fetchAlbumThumb(title, artist, id) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return Promise.resolve(null);
  const ck = _cleanAlbumThumbKey(cleanTitle, artist);
  if (ck && _albThumbCache[ck] && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(_albThumbCache[ck]))) {
    return Promise.resolve(_forceAppleListThumb(_albThumbCache[ck]));
  }
  const existing = id && typeof BYID !== 'undefined' ? BYID[id] : null;
  if (existing && existing.kind === 'album' && existing.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(existing.thumb)) {
    const normExisting = _normalizeAppleListThumb(existing.thumb);
    if (normExisting !== existing.thumb) existing.thumb = normExisting;
    const listCached = _forceAppleListThumb(existing.thumb);
    if (ck) _albThumbCache[ck] = listCached;
    return Promise.resolve(listCached);
  }
  const pendingKey = ck || (id ? 'id:' + id : cleanTitle.toLowerCase());
  if ((_albThumbMiss[pendingKey] || 0) > Date.now()) return Promise.resolve(null);
  if (_albThumbPending[pendingKey]) return _albThumbPending[pendingKey];
  const qs = 'title=' + encodeURIComponent(cleanTitle) +
    (artist ? '&artist=' + encodeURIComponent(_cleanArtistThumbName(artist)) : '') +
    (id ? '&id=' + encodeURIComponent(id) : '');
  const req = api('/api/album_art?' + qs)
    .then(d => {
      if (d && d.thumb) {
        const resolvedThumb = _forceAppleListThumb(d.thumb);
        if (ck) {
          delete _albThumbCold[ck];
          delete _albThumbMiss[pendingKey];
          _albThumbCache[ck] = resolvedThumb;
        }
        _applyAlbumThumb(id, resolvedThumb, cleanTitle, artist);
        return resolvedThumb;
      }
      if (d && d.cold && ck) {
        _albThumbCold[ck] = Date.now() + 2000;
      } else {
        _albThumbMiss[pendingKey] = Date.now() + 120000;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => { delete _albThumbPending[pendingKey]; });
  _albThumbPending[pendingKey] = req;
  return req;
}
const _trkThumbCache = {};
const _trkThumbMiss = {};
const _trkThumbPending = {};
function _cleanTrackThumbKey(title, artist) {
  const cleanTitle = (title || '')
    .replace(/\s*[(\[]\s*(?:feat\.?|ft\.?|with|con|official|lyric|audio|video|videoclip|visualizer|remaster|explicit|clean|radio|live)[^)\]]*[)\]]/gi, ' ')
    .replace(/\s+-\s+(?:feat\.?|ft\.?|con|official|video|videoclip|lyric|remaster|radio|explicit|live).*$/i, '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleanTitle) return '';
  const leadArtist = _cleanArtistThumbName(artist || '').replace(/\u2019/g, "'").toLowerCase();
  return cleanTitle + '|' + leadArtist;
}
function _applyTrackThumb(track, thumb, resolvedAlbum, isCanonical) {
  if (!track || !thumb) return;
  const listThumb = _forceAppleListThumb(thumb);
  const resAlb = (resolvedAlbum || '').trim();
  const canon = isCanonical !== false;
  let anyChanged = false;
  const applyTo = obj => {
    if (!obj) return;
    const prev = obj.thumb;
    const prevAlb = obj.album;
    const prevAlbTitle = obj.albumTitle;
    const wasCanonical = Boolean(obj.canonicalCover);
    const eff = _preserveAppleHiRes(prev, listThumb);
    const sameBase = Boolean(prev && typeof isSameCoverBase === 'function' && isSameCoverBase(prev, eff));
    if (obj.thumb !== eff) {
      obj.thumb = eff;
      anyChanged = true;
      _invalidateCoverCaches(obj.id, sameBase);
    }
    if (canon && !obj.canonicalCover) { obj.canonicalCover = true; anyChanged = true; }
    obj._appleUpgradeSettled = true;
    const oldIsComp = Boolean(obj.albumTitle && typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(obj.albumTitle, obj.title));
    if (resAlb && (!obj.albumTitle || !wasCanonical || oldIsComp)) {
      if (obj.albumTitle !== resAlb) {
        obj.albumTitle = resAlb;
        anyChanged = true;
      }
    }
    const al = obj.album && typeof BYID !== 'undefined' ? BYID[obj.album] : null;
    if (al) {
      const isStub = String(al.id).indexOf('s_') === 0;
      const sameAlbName = Boolean(resAlb && al.title && _cleanAlbumThumbKey(al.title, obj.artist) === _cleanAlbumThumbKey(resAlb, obj.artist));
      const sameAlbCover = Boolean(al.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(al.thumb, eff));
      if (isStub || sameAlbName) {
        const alPrev = al.thumb;
        const alEff = _preserveAppleHiRes(alPrev, listThumb);
        const alSame = Boolean(alPrev && typeof isSameCoverBase === 'function' && isSameCoverBase(alPrev, alEff));
        if (al.thumb !== alEff) {
          al.thumb = alEff;
          anyChanged = true;
          _invalidateCoverCaches(al.id, alSame);
        }
        if (isStub && resAlb) al.title = resAlb;
        al._appleUpgradeSettled = true;
      } else if (obj.id && (resAlb || (al.thumb && !sameAlbCover))) {
        const stubId = 's_' + obj.id;
        obj.album = stubId;
        obj.albumId = null;
        if (typeof stubAlbum === 'function') {
          const stPrev = BYID[stubId] && BYID[stubId].thumb;
          const stAlb = stubAlbum(stubId, { title: obj.albumTitle || resAlb || obj.title, artist: obj.artist, hue: obj.hue, style: obj.style, thumb: eff });
          const stEff = _preserveAppleHiRes(stPrev, eff);
          const stSame = Boolean(stPrev && typeof isSameCoverBase === 'function' && isSameCoverBase(stPrev, stEff));
          stAlb.thumb = stEff;
          if (resAlb) stAlb.title = resAlb;
          stAlb._appleUpgradeSettled = true;
          _invalidateCoverCaches(stubId, stSame);
        }
      }
    } else if (!obj.album && obj.id && typeof stubAlbum === 'function') {
      const stubId = 's_' + obj.id;
      obj.album = stubId;
      obj.albumId = null;
      const stAlb = stubAlbum(stubId, { title: obj.albumTitle || resAlb || obj.title, artist: obj.artist, hue: obj.hue, style: obj.style, thumb: eff });
      stAlb.thumb = _preserveAppleHiRes(stAlb.thumb, eff);
      if (resAlb) stAlb.title = resAlb;
      stAlb._appleUpgradeSettled = true;
    }
    if (obj.album !== prevAlb || obj.albumTitle !== prevAlbTitle) anyChanged = true;
  };
  applyTo(track);
  if (track.id && typeof LIVE !== 'undefined' && LIVE.known && LIVE.known[track.id] && LIVE.known[track.id] !== track) {
    applyTo(LIVE.known[track.id]);
  }
  const canonicalSrc = (track.id && typeof LIVE !== 'undefined' && LIVE.known && LIVE.known[track.id]) || track;
  if (typeof _propagateCanonicalTrack === 'function' && _propagateCanonicalTrack(canonicalSrc)) {
    anyChanged = true;
  }
  if (typeof preloadArt === 'function') preloadArt(track, false);
  if (anyChanged) {
    if (typeof liveSave === 'function') liveSave();
    if (typeof savePlayerState === 'function') savePlayerState();
    if (typeof redraw === 'function') redraw();
  }
}
function fetchTrackThumb(track) {
  if (!track || !track.title || !track.artist) return Promise.resolve(null);
  const ck = _cleanTrackThumbKey(track.title, track.artist);
  if (!ck) return Promise.resolve(null);
  const cached = _trkThumbCache[ck];
  if (cached && cached.thumb && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(cached.thumb))) {
    _applyTrackThumb(track, cached.thumb, cached.album, cached.canonicalCover);
    return Promise.resolve(_forceAppleListThumb(cached.thumb));
  }
  if ((_trkThumbMiss[ck] || 0) > Date.now()) return Promise.resolve(null);
  if (_trkThumbPending[ck]) {
    return _trkThumbPending[ck].then(res => {
      if (res && res.thumb) {
        _applyTrackThumb(track, res.thumb, res.album, res.canonicalCover);
        return res.thumb;
      }
      return null;
    });
  }
  const albHint = (track.albumTitle && !(typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(track.albumTitle, track.title)))
    ? track.albumTitle : '';
  const qs = 'title=' + encodeURIComponent(track.title) +
    '&artist=' + encodeURIComponent(track.artist) +
    (albHint ? '&album=' + encodeURIComponent(albHint) : '') +
    (track.id ? '&id=' + encodeURIComponent(track.id) : '');
  const req = api('/api/track_art?' + qs)
    .then(d => {
      if (d && d.ok && d.thumb) {
        const resThumb = _forceAppleListThumb(d.thumb);
        const resAlb = (d.album || '').trim();
        const resCanonical = d.canonicalCover !== false;
        _trkThumbCache[ck] = { thumb: resThumb, album: resAlb, canonicalCover: resCanonical };
        delete _trkThumbMiss[ck];
        _applyTrackThumb(track, resThumb, resAlb, resCanonical);
        if (resCanonical && resAlb && !(typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(resAlb, track.title))) {
          const ack = _cleanAlbumThumbKey(resAlb, track.artist);
          if (ack && !_albThumbCache[ack]) _albThumbCache[ack] = resThumb;
        }
        return { thumb: resThumb, album: resAlb, canonicalCover: resCanonical };
      }
      _trkThumbMiss[ck] = Date.now() + 120000;
      return null;
    })
    .catch(() => null)
    .finally(() => { delete _trkThumbPending[ck]; });
  _trkThumbPending[ck] = req;
  return req.then(res => (res && res.thumb ? res.thumb : null));
}
let _startupGraceUntil = 0, _startupSecondaryTimer = 0, _startupSecondaryReady = false;
function _scheduleArtThumbPump(delayMs) {
  if (_artThumbTimer || !_artThumbQ.length) return;
  _artThumbTimer = setTimeout(() => {
    _artThumbTimer = 0;
    _pumpArtThumbQ();
  }, delayMs);
}
function _pumpArtThumbQ() {
  if (!_artThumbQ.length) { _artThumbStaggerCount = 0; return; }
  if (!_startupSecondaryReady && _artThumbAct === 0) {
    const rem = _startupGraceUntil - performance.now();
    if (rem > 0) {
      _scheduleArtThumbPump(Math.max(120, Math.round(rem)));
      return;
    }
  }
  if (_artThumbAct === 0 && _artThumbStaggerCount < 3 && (_covPriSet.size > 0 || _covAct >= 2 || _isUiAnimatingOrBusy())) {
    _artThumbStaggerCount++;
    _scheduleArtThumbPump(300);
    return;
  }
  while (_artThumbAct < ART_THUMB_MAX_CONC && _artThumbQ.length) {
    const cacheKey = _artThumbQ.shift();
    const entry = _artThumbWaiters.get(cacheKey);
    if (!entry) continue;
    if (_artThumbCache[cacheKey]) {
      _artThumbWaiters.delete(cacheKey);
      const cached = _artThumbCache[cacheKey];
      entry.tracks.forEach(tr => _applyArtistThumb(tr, entry.rawName, cached));
      continue;
    }
    _artThumbAct++;
    fetchArtistThumb(entry.rawName, entry.artistId)
      .then(thumb => {
        _artThumbWaiters.delete(cacheKey);
        if (thumb) entry.tracks.forEach(tr => _applyArtistThumb(tr, entry.rawName, thumb));
      })
      .finally(() => {
        _artThumbAct = Math.max(0, _artThumbAct - 1);
        _pumpArtThumbQ();
      });
  }
}
function prefetchArtistThumb(t) {
  if (!t || !t.artist || t._artThumbFetching) return;
  const rawName = _cleanArtistThumbName(t.artist);
  if (!rawName) return;
  t._artThumbFetching = true;
  const cacheKey = rawName.toLowerCase();
  if (_artThumbCache[cacheKey]) {
    _applyArtistThumb(t, rawName, _artThumbCache[cacheKey]);
    return;
  }
  if (_artThumbPending[cacheKey]) {
    _artThumbPending[cacheKey].then(thumb => { if (thumb) _applyArtistThumb(t, rawName, thumb); });
    return;
  }
  let entry = _artThumbWaiters.get(cacheKey);
  if (entry) {
    entry.tracks.add(t);
    if (!entry.artistId && t.artistId) entry.artistId = t.artistId;
  } else {
    entry = { rawName, artistId: t.artistId || null, tracks: new Set([t]) };
    _artThumbWaiters.set(cacheKey, entry);
    _artThumbQ.push(cacheKey);
  }
  const initDelay = _artThumbAct === 0
    ? (!_startupSecondaryReady && _startupGraceUntil > performance.now() ? Math.max(450, Math.round(_startupGraceUntil - performance.now())) : 450)
    : 60;
  _scheduleArtThumbPump(initDelay);
}
function ingestItem(x) {
  if (!x) return null;
  if (!x.kind || x.kind === 'track') return ingestTrack(x);
  const { tracks, songs, albums, singles, related, ...flat } = x;
  if (flat.thumb) flat.thumb = _normalizeAppleListThumb(flat.thumb);
  if (x.kind === 'artist' && x.title) {
    const ck = _cleanArtistThumbName(x.title).toLowerCase();
    const cachedApple = ck && _artThumbCache[ck];
    if (flat.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(flat.thumb)) {
      const listThumb = _forceAppleListThumb(flat.thumb);
      if (ck && (!cachedApple || /[?&]s=1200\b/.test(cachedApple) || (/[?&]s=288\b/.test(cachedApple) && !/[?&]s=288\b/.test(listThumb)))) _artThumbCache[ck] = listThumb;
    } else if (cachedApple && (!flat.thumb || typeof isAppleArtistThumb !== 'function' || !isAppleArtistThumb(flat.thumb))) {
      flat.thumb = _forceAppleListThumb(cachedApple);
    }
  } else if (x.kind === 'album' && x.title) {
    const ck = _cleanAlbumThumbKey(x.title, x.artist);
    const cachedApple = ck && _albThumbCache[ck];
    if (flat.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(flat.thumb)) {
      const listThumb = _forceAppleListThumb(flat.thumb);
      if (ck && (!cachedApple || /[?&]s=1200\b/.test(cachedApple) || (/[?&]s=288\b/.test(cachedApple) && !/[?&]s=288\b/.test(listThumb)))) _albThumbCache[ck] = listThumb;
    } else if (cachedApple && (!flat.thumb || typeof isAppleArtistThumb !== 'function' || !isAppleArtistThumb(flat.thumb))) {
      flat.thumb = _forceAppleListThumb(cachedApple);
    }
  }
  let e = BYID[x.id];
  if (e) {
    const prevThumb = e.thumb;
    const keepAppleArtist = e.kind === 'artist' && prevThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(prevThumb) && (!flat.thumb || !isAppleArtistThumb(flat.thumb));
    const keepAppleAlbum = e.kind === 'album' && prevThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(prevThumb) && (!flat.thumb || !isAppleArtistThumb(flat.thumb));
    const keepHiApple = Boolean(prevThumb && flat.thumb && _preserveAppleHiRes(prevThumb, flat.thumb) === prevThumb && prevThumb !== flat.thumb);
    for (const k in flat) {
      if (k === 'thumb' && (keepAppleArtist || keepAppleAlbum || keepHiApple)) continue;
      if (flat[k] != null) e[k] = flat[k];
    }
    const bothApple = prevThumb && e.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(prevThumb) && isAppleArtistThumb(e.thumb);
    const sameBase = Boolean(prevThumb && e.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(prevThumb, e.thumb));
    if (prevThumb !== e.thumb && x.id) {
      _invalidateCoverCaches(x.id, bothApple || sameBase);
    }
    if (x.kind === 'album' && e.thumb && prevThumb !== e.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(e.thumb) && typeof _searchCacheAlbumUpgradeHook === 'function') {
      _searchCacheAlbumUpgradeHook(e.id, e.title, e.artist, _forceAppleListThumb(e.thumb));
    }
  } else e = BYID[x.id] = flat;
  return e;
}
function liveArtistThumb(ar) {
  if (!ar || ar.kind !== 'artist' || !ar.id || ar.thumb || ar._thBusy) return;
  ar._thBusy = true;
  liveLoad(ar).finally(() => {
    ar._thBusy = false;
    if (ar.thumb) {
      const trSet = _byArtistId.get(ar.id);
      if (trSet) trSet.forEach(t => { t.artistThumb = ar.thumb; });
      liveSave(); redraw();
    }
  });
}
function liveLoad(it) {
  if (it.loaded && tracksOf(it).length && (it.kind !== 'artist' || (typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(it.thumb)))) return Promise.resolve(it);
  if (it._p) return it._p;
  it.loading = true; it.err = null;
  const hints = [];
  if (it.kind === 'album' || it.kind === 'artist') {
    if (it.title) hints.push('title=' + encodeURIComponent(it.title));
    if (it.artist) hints.push('artist=' + encodeURIComponent(it.artist));
  }
  const path = '/api/' + it.kind + '/' + encodeURIComponent(it.id) + (hints.length ? '?' + hints.join('&') : '');
  return it._p = api(path).then(d => {
    const prevThumb = it.thumb;
    const { tracks, songs, albums, singles, related, ...flat } = d;
    if (flat.thumb) flat.thumb = _normalizeAppleListThumb(flat.thumb);
    Object.assign(it, flat);
    if (it.kind === 'artist') {
      const nextThumb = flat.thumb;
      const incomingApple = nextThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(nextThumb);
      const prevApple = prevThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(prevThumb);
      if (prevThumb && nextThumb && _preserveAppleHiRes(prevThumb, nextThumb) === prevThumb) {
        it.thumb = prevThumb;
      } else if (incomingApple || (!prevApple && nextThumb && (typeof isHqThumb !== 'function' || isHqThumb(nextThumb)))) {
        it.thumb = nextThumb;
      } else if (prevApple && !incomingApple) {
        it.thumb = prevThumb;
      }
      const sameBaseArt = Boolean(prevThumb && it.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(prevThumb, it.thumb));
      if (it.thumb !== prevThumb && !sameBaseArt && !(ARTC[it.id] && ARTC[it.id]._real)) delete ARTC[it.id];
      const ck = _cleanArtistThumbName(d.title || it.title).toLowerCase();
      const listArtThumb = _forceAppleListThumb(incomingApple ? nextThumb : it.thumb);
      if (ck && listArtThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(listArtThumb)) {
        _artThumbCache[ck] = listArtThumb;
      }
      it.songs = (songs || []).map(ingestTrack).filter(Boolean);
      it.albums = (albums || []).map(ingestItem).filter(Boolean);
      it.singles = (singles || []).map(ingestItem).filter(Boolean);
      it.related = (related || []).map(ingestItem).filter(Boolean);
      if (listArtThumb) {
        const trSet = _byArtistId.get(it.id);
        if (trSet) trSet.forEach(t => { t.artistThumb = _preserveAppleHiRes(t.artistThumb, listArtThumb); });
      }
    } else {
      it.tracks = (tracks || []).map(ingestTrack).filter(Boolean);
      const nextThumb = flat.thumb;
      const prevApple = prevThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(prevThumb);
      const nextApple = nextThumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(nextThumb);
      if (prevThumb && nextThumb && _preserveAppleHiRes(prevThumb, nextThumb) === prevThumb) {
        it.thumb = prevThumb;
      } else if (nextThumb && nextThumb !== prevThumb) {
        if (nextApple || !prevApple) {
          it.thumb = nextThumb;
          const sameBaseAlb = Boolean(prevThumb && nextThumb && typeof isSameCoverBase === 'function' && isSameCoverBase(prevThumb, nextThumb));
          const hasRealHero = Boolean(ARTC[it.id] && ARTC[it.id]._real);
          if (!(prevApple && nextApple) && !sameBaseAlb && !hasRealHero) delete ARTC[it.id];
          if (!sameBaseAlb && !hasRealHero) {
            if (typeof PALC !== 'undefined') delete PALC[it.id];
            if (typeof TINTC !== 'undefined') { delete TINTC[it.id + 'd']; delete TINTC[it.id + 'l']; }
          }
        } else {
          it.thumb = prevThumb;
        }
      } else if (!nextThumb && prevThumb) {
        it.thumb = prevThumb;
      }
      if (it.kind === 'album' && it.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(it.thumb)) {
        const listAlbThumb = _forceAppleListThumb(nextApple ? nextThumb : it.thumb);
        const ck = _cleanAlbumThumbKey(it.title, it.artist);
        if (ck) {
          delete _albThumbCold[ck];
          delete _albThumbMiss[ck];
          _albThumbCache[ck] = listAlbThumb;
        }
        _applyAlbumThumb(it.id, listAlbThumb, it.title, it.artist);
      }
    }
    if (it.id && BYID[it.id] && it.thumb) {
      if (BYID[it.id] !== it && BYID[it.id].thumb) {
        it.thumb = _preserveAppleHiRes(BYID[it.id].thumb, it.thumb);
      }
      BYID[it.id].thumb = it.thumb;
    }
    it.loaded = true; it.loading = false; it._p = null; preloadArt(it, true);
    const loadedTracks = tracksOf(it);
    for (let i = 0; i < Math.min(10, loadedTracks.length); i++) {
      if (loadedTracks[i] && loadedTracks[i].thumb) preloadArt(loadedTracks[i], true);
    }
    loadedTracks.slice(0, 2).forEach(x => {
      if (x && x.id) {
        if (window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') window.SonoraNative.prefetch(x.id);
        else fetch('/api/prefetch/' + x.id).catch(() => {});
      }
    });
    liveSave(); redraw(); return it;
  }).catch(e => { it.err = e.message; it.loading = false; it._p = null; redraw(); });
}
const playOne = t => playList([t], 0);

/* ── copertine reali (coda con priorità ai brani visibili su schermo + deduplicazione per URL + LRU bounded + rasterizzazione distribuita) ── */
const IMGS = {}, _covUrl = {}, _covWait = {}, _covQ = [], _covRastQ = [];
const _covLru = new Map(), _covQSet = new Set(), _covPriSet = new Set(), COV_LRU_CAP = 220, COV_SCENE_COALESCE_MS = 16;
let _covAct = 0, _covRastRaf = 0, _covDirtyRaf = 0, _covPendingOv = false, _covFlushTimer = 0, _lastCovScenePaintAt = 0, _covScenePending = false;
function _isUiAnimatingOrBusy() {
  if (typeof INP !== 'undefined' && INP && INP.down) return true;
  if (typeof topPage === 'function') {
    const tp = topPage();
    if (tp && Math.abs(tp.vel || 0) > 45) return true;
  }
  if (typeof NAV !== 'undefined' && NAV && (NAV.popP > 0.01 || NAV.pushP > 0.01 || NAV.popT > 0.01)) return true;
  if (typeof _tabTrans !== 'undefined' && _tabTrans && _tabTrans.active) return true;
  if (typeof SH !== 'undefined' && SH && (SH.drag || (SH.t > 0.01 && SH.t < 0.99))) return true;
  return false;
}
function _isHeroOrActiveCoverUrl(u) {
  if (!u) return false;
  if (/[?&]s=(?:1080|1200|1400)\b/.test(u)) return true;
  if (typeof SH !== 'undefined' && SH && SH.t > 0.05) {
    const c = typeof cur === 'function' ? cur() : null;
    if (c) {
      if (c.thumb === u || c.artistThumb === u) return true;
      const cAlb = (!c.kind || c.kind === 'track') && typeof albumOf === 'function' ? albumOf(c) : null;
      if (cAlb && cAlb.thumb === u) return true;
    }
  }
  if (typeof topPage === 'function') {
    const tp = topPage();
    if (tp && (tp.kind === 'album' || tp.kind === 'artist' || tp.kind === 'playlist') && tp.data && tp.data.item && tp.data.item.thumb === u) return true;
  }
  return false;
}
function _isCoverReferenced(cv) {
  if (!cv) return false;
  for (const ak in ARTC) {
    if (ARTC[ak] === cv) return true;
  }
  for (const u in _covUrl) {
    if (_covUrl[u] === cv) return true;
  }
  return false;
}
let _covMatchedCur = false;
function _disposeCover(cv, forceClearRefs) {
  if (!cv) return;
  if (forceClearRefs) {
    for (const ak in ARTC) {
      if (ARTC[ak] === cv) delete ARTC[ak];
    }
    for (const u in _covUrl) {
      if (_covUrl[u] === cv) delete _covUrl[u];
    }
  } else if (_isCoverReferenced(cv)) {
    return;
  }
  try {
    if (cv._tiles) {
      for (const tk in cv._tiles) {
        const tc = cv._tiles[tk];
        if (tc && 'width' in tc) tc.width = tc.height = 0;
      }
      cv._tiles = null;
    }
    if (typeof cv.close === 'function') cv.close();
    else if ('width' in cv && 'height' in cv) { cv.width = cv.height = 0; }
  } catch (e) {}
}
function _markCoverDirty(priority) {
  const shVis = typeof SH !== 'undefined' && SH && SH.t > 0.01;
  const cmVis = typeof CM !== 'undefined' && CM && CM.open;
  const matchedCur = _covMatchedCur;
  _covMatchedCur = false;
  if (priority === true && (shVis || cmVis || matchedCur)) {
    if (typeof redraw === 'function') redraw();
    else if (typeof D !== 'undefined') { D.scene = D.ov = D.gl = true; }
  } else {
    if (typeof redrawSceneOnly === 'function') redrawSceneOnly();
    else if (typeof D !== 'undefined') { D.scene = D.gl = true; }
  }
}
function _coalesceCoverScene(needOv) {
  const now = performance.now();
  if (needOv) {
    if (_covFlushTimer) { clearTimeout(_covFlushTimer); _covFlushTimer = 0; }
    _covScenePending = false;
    _lastCovScenePaintAt = now;
    _markCoverDirty(true);
    return;
  }
  const queueDrained = !_covRastQ.length && _covAct === 0 && !_covQ.length;
  if (queueDrained || (now - _lastCovScenePaintAt >= COV_SCENE_COALESCE_MS)) {
    if (_covFlushTimer) { clearTimeout(_covFlushTimer); _covFlushTimer = 0; }
    _covScenePending = false;
    _lastCovScenePaintAt = now;
    _markCoverDirty(false);
    return;
  }
  _covScenePending = true;
  if (!_covFlushTimer) {
    const waitMs = Math.max(16, Math.round(COV_SCENE_COALESCE_MS - (now - _lastCovScenePaintAt)));
    _covFlushTimer = setTimeout(() => {
      _covFlushTimer = 0;
      if (_covScenePending) {
        _covScenePending = false;
        _lastCovScenePaintAt = performance.now();
        _markCoverDirty(false);
      }
    }, waitMs);
  }
}
function _scheduleCoverDirty(needOv) {
  if (needOv) _covPendingOv = true;
  if (_covDirtyRaf) return;
  _covDirtyRaf = requestAnimationFrame(() => {
    _covDirtyRaf = 0;
    const ov = _covPendingOv;
    _covPendingOv = false;
    _coalesceCoverScene(ov);
  });
}
function clearLiveCoverCache() {
  _covQ.length = 0;
  _covQSet.clear();
  _covPriSet.clear();
  if (_covRastRaf) { cancelAnimationFrame(_covRastRaf); _covRastRaf = 0; }
  if (_covDirtyRaf) { cancelAnimationFrame(_covDirtyRaf); _covDirtyRaf = 0; }
  if (_covFlushTimer) { clearTimeout(_covFlushTimer); _covFlushTimer = 0; }
  _covPendingOv = false;
  _covScenePending = false;
  _lastCovScenePaintAt = 0;
  for (const item of _covRastQ) {
    if (item && item.bmp && typeof item.bmp.close === 'function') {
      try { item.bmp.close(); } catch (e) {}
    }
  }
  _covRastQ.length = 0;
  const toDispose = Array.from(_covLru.values());
  _covLru.clear();
  for (const u in _covUrl) delete _covUrl[u];
  for (const u in _covWait) delete _covWait[u];
  for (const evCv of toDispose) _disposeCover(evCv, true);
}
function _isActiveCoverUrl(u) {
  const c = typeof cur === 'function' ? cur() : null;
  const check = tr => {
    if (!tr) return false;
    if (tr.thumb === u || tr.artistThumb === u) return true;
    const alb = (!tr.kind || tr.kind === 'track') && typeof albumOf === 'function' ? albumOf(tr) : null;
    return Boolean(alb && alb.thumb === u);
  };
  if (check(c)) return true;
  if (typeof PL !== 'undefined' && PL.queue) {
    if (PL.qi > 0 && check(PL.queue[PL.qi - 1])) return true;
    for (let i = 1; i <= 3; i++) {
      if (check(PL.queue[PL.qi + i])) return true;
    }
  }
  return false;
}
function _covStore(u, cv) {
  const prev = _covUrl[u];
  _covUrl[u] = cv;
  _covLru.delete(u);
  _covLru.set(u, cv);
  if (prev && prev !== cv) {
    if (prev._real && !prev._placeholder) {
      try { cv._fadePending = false; cv._t0 = 0; } catch (e) {}
    }
    for (const ak in ARTC) {
      if (ARTC[ak] === prev) ARTC[ak] = cv;
    }
    _disposeCover(prev, false);
  }
  if (_covLru.size > COV_LRU_CAP) {
    for (const [evUrl, evCv] of _covLru) {
      if (_covLru.size <= COV_LRU_CAP) break;
      if (_isActiveCoverUrl(evUrl)) continue;
      _covLru.delete(evUrl);
      if (_covUrl[evUrl] === evCv) delete _covUrl[evUrl];
      for (const ak in ARTC) {
        if (ARTC[ak] === evCv) delete ARTC[ak];
      }
      _disposeCover(evCv, false);
    }
  }
}
function _covApply(k, cv) {
  const prev = ARTC[k];
  const prevReal = Boolean(prev && prev._real && !prev._placeholder);
  const sameBase = Boolean(prevReal && prev._url && cv && cv._url && typeof isSameCoverBase === 'function' && isSameCoverBase(prev._url, cv._url));
  const isHiUrl = u => Boolean(u && /[?&]s=(?:1080|1200|1400)\b/.test(u));
  if (sameBase && isHiUrl(prev._url) && !isHiUrl(cv._url)) {
    return false;
  }
  if (prevReal) {
    try { cv._fadePending = false; cv._t0 = 0; } catch (e) {}
  }
  ARTC[k] = cv;
  if (!sameBase) {
    delete PALC[k];
    delete SHAD_PALC[k];
    delete TINTC[k + 'd'];
    delete TINTC[k + 'l'];
    if (FLU) FLU.key = null;
  }
  let needOv = false;
  const c = cur();
  if (c) {
    const cAlb = (!c.kind || c.kind === 'track') ? albumOf(c) : null;
    if (c.id === k || (cAlb && cAlb.id === k) || c.thumb === cv._url || c.artistThumb === cv._url || (cAlb && cAlb.thumb === cv._url)) {
      _covMatchedCur = true;
      needOv = true;
    }
  }
  if (!needOv && typeof CM !== 'undefined' && CM && CM.open && CM.tr) {
    const cmT = CM.tr, cmAlb = (!cmT.kind || cmT.kind === 'track') ? albumOf(cmT) : null;
    if (cmT.id === k || cmT.thumb === cv._url || (cmAlb && (cmAlb.id === k || cmAlb.thumb === cv._url))) {
      needOv = true;
    }
  }
  const sheetVis = typeof SH !== 'undefined' && SH && SH.t > 0.01;
  const queueToCheck = [];
  if (c) queueToCheck.push(c);
  if (typeof PL !== 'undefined' && PL.queue) {
    if (PL.qi > 0 && PL.queue[PL.qi - 1]) queueToCheck.push(PL.queue[PL.qi - 1]);
    for (let i = 1; i <= 3; i++) {
      const nx = PL.queue[PL.qi + i];
      if (nx) queueToCheck.push(nx);
    }
  }
  queueToCheck.forEach((tr, idx) => {
    const alb = (!tr.kind || tr.kind === 'track') ? albumOf(tr) : null;
    const albId = alb && alb.id;
    const trkId = tr.id;
    const matches = (trkId === k) || (albId && albId === k) || (tr.thumb && tr.thumb === cv._url) || (alb && alb.thumb && alb.thumb === cv._url);
    if (matches) {
      const trPrev = trkId ? ARTC[trkId] : null;
      const albPrev = albId ? ARTC[albId] : null;
      const trSameBase = Boolean(trPrev && trPrev._real && trPrev._url && cv && cv._url && typeof isSameCoverBase === 'function' && isSameCoverBase(trPrev._url, cv._url));
      const albSameBase = Boolean(albPrev && albPrev._real && albPrev._url && cv && cv._url && typeof isSameCoverBase === 'function' && isSameCoverBase(albPrev._url, cv._url));
      if (trSameBase || albSameBase || sameBase) {
        try { cv._fadePending = false; cv._t0 = 0; } catch (e) {}
      }
      const keepTrkPal = trSameBase || (!trPrev && (albSameBase || sameBase));
      const keepAlbPal = albSameBase || (!albPrev && sameBase);
      if (trkId) {
        if (!(trSameBase && isHiUrl(trPrev._url) && !isHiUrl(cv._url))) ARTC[trkId] = cv;
        if (!keepTrkPal) { delete SHAD_PALC[trkId]; delete PALC[trkId]; }
      }
      if (albId) {
        if (!(albSameBase && isHiUrl(albPrev._url) && !isHiUrl(cv._url))) ARTC[albId] = cv;
        if (!keepAlbPal) { delete SHAD_PALC[albId]; delete PALC[albId]; }
      }
      if (idx === 0) {
        _covMatchedCur = true; needOv = true;
        if (!keepTrkPal && !keepAlbPal && sheetVis && typeof shaderPalette === 'function') {
          setTimeout(() => { if (typeof shaderPalette === 'function') shaderPalette(tr); }, 24);
        }
      } else if (sheetVis) {
        needOv = true;
      }
    }
  });
  return needOv;
}
function _covStepRast() {
  _covRastRaf = 0;
  if (!_covRastQ.length) return;
  const t0 = performance.now();
  let n = 0, applied = false, needOv = false;
  while (_covRastQ.length && (n === 0 || (n < 6 && (performance.now() - t0) < 3.0))) {
    const item = _covRastQ.shift();
    const u = item.u, sz = item.sz;
    let cv = null;
    if (!item.needsCrop && item.bmp && item.bmp.width > 0 && item.bmp.height > 0) {
      try { item.bmp._real = true; item.bmp._url = u; item.bmp._tiles = {}; } catch (e) {}
      if (item.bmp._real === true && item.bmp._url === u) cv = item.bmp;
    }
    if (!cv) {
      const hasValidBmp = Boolean(item.bmp && item.bmp.width > 0 && item.bmp.height > 0);
      if (hasValidBmp || (item.im && item.im.naturalWidth > 0 && item.im.naturalHeight > 0)) {
        cv = document.createElement('canvas'); cv.width = cv.height = sz; cv._real = true; cv._url = u; cv._tiles = {};
        const x = cv.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        if (hasValidBmp) {
          const bw = item.bmp.width, bh = item.bmp.height, sw = item.sw || Math.min(bw, bh);
          const sx = Math.floor((bw - sw) / 2), sy = Math.floor((bh - sw) / 2);
          x.drawImage(item.bmp, sx, sy, sw, sw, 0, 0, cv.width, cv.height);
          if (typeof item.bmp.close === 'function') { try { item.bmp.close(); } catch (e) {} }
        } else {
          const im = item.im, sw = item.sw || Math.min(im.naturalWidth, im.naturalHeight);
          x.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sw) / 2, sw, sw, 0, 0, sz, sz);
        }
      } else if (item.bmp && typeof item.bmp.close === 'function') {
        try { item.bmp.close(); } catch (e) {}
      }
    }
    if (cv) {
      try {
        cv._loadedAt = performance.now();
        cv._fadePending = true;
        cv._t0 = 0;
      } catch (e) {}
      _covStore(u, cv);
      const ks = _covWait[u] || []; delete _covWait[u];
      for (let i = 0; i < ks.length; i++) {
        if (_covApply(ks[i], cv)) needOv = true;
      }
      applied = true;
    } else {
      delete _covWait[u];
    }
    n++;
  }
  if (applied) _coalesceCoverScene(needOv);
  _covPump();
  if (_covRastQ.length && !_covRastRaf) _covRastRaf = requestAnimationFrame(_covStepRast);
}
function _covEnqueueRast(entry) {
  entry.pri = _covPriSet.delete(entry.u);
  if (entry.pri) _covRastQ.unshift(entry);
  else _covRastQ.push(entry);
  if (!_covRastRaf) _covRastRaf = requestAnimationFrame(_covStepRast);
}
function _covPump() {
  if (_covRastQ.length >= 48) return;
  const maxConc = 6;
  while (_covAct < maxConc && _covQ.length) {
    const u = _covQ.shift();
    _covQSet.delete(u);
    const cached = _covUrl[u];
    if (cached && cached.width > 0) continue;
    if (cached) { delete _covUrl[u]; _covLru.delete(u); }
    if (IMGS['$' + u]) continue;
    IMGS['$' + u] = 1; _covAct++;
    let done = false;
    const finishLoad = () => {
      if (done) return false;
      done = true;
      delete IMGS['$' + u];
      _covAct = Math.max(0, _covAct - 1);
      return true;
    };
    fetch(u, { credentials: 'omit', cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error('http'); return r.blob(); })
      .then(blob => createImageBitmap(blob))
      .then(rawBmp => {
        if (!finishLoad()) {
          if (rawBmp && typeof rawBmp.close === 'function') { try { rawBmp.close(); } catch (e) {} }
          return;
        }
        const w = rawBmp ? (rawBmp.width || 0) : 0, h = rawBmp ? (rawBmp.height || 0) : 0;
        const sw = Math.min(w, h);
        if (sw <= 0) {
          if (rawBmp && typeof rawBmp.close === 'function') { try { rawBmp.close(); } catch (e) {} }
          _covPriSet.delete(u);
          delete _covWait[u];
          _covPump();
          return;
        }
        const maxCovSz = _isHeroOrActiveCoverUrl(u) ? 1080 : 384;
        const sz = Math.min(maxCovSz, Math.max(192, sw));
        const needsCrop = Math.abs(w - h) > 2 || w > maxCovSz + 64;
        _covEnqueueRast({ u, bmp: rawBmp, sw, sz: needsCrop ? sz : w, needsCrop });
        _covPump();
      })
      .catch(() => {
        if (!finishLoad()) return;
        _covPriSet.delete(u);
        delete _covWait[u];
        _covPump();
      });
  }
}
function liveCover(item, k, pri) {
  if (!item || !item.thumb) return;
  const u = item.thumb;
  const cached = _covUrl[u];
  if (cached && cached.width > 0) {
    _covLru.delete(u);
    _covLru.set(u, cached);
    if (ARTC[k] !== cached) {
      const needOv = _covApply(k, cached);
      if (!(typeof window !== 'undefined' && window.__IN_DRAW_SCENE)) _scheduleCoverDirty(needOv);
    }
    return;
  }
  if (cached) {
    delete _covUrl[u];
    _covLru.delete(u);
  }
  const w = _covWait[u] || (_covWait[u] = []);
  if (w.indexOf(k) < 0) w.push(k);
  if (pri) _covPriSet.add(u);
  if (IMGS['$' + u]) return;
  if (_covQSet.has(u)) {
    if (pri) {
      const idx = _covQ.indexOf(u);
      if (idx > 0) { _covQ.splice(idx, 1); _covQ.unshift(u); }
    }
  } else {
    if (pri) { _covQ.unshift(u); _covQSet.add(u); }
    else if (_covQ.length < 300) { _covQ.push(u); _covQSet.add(u); }
  }
  _covPump();
}

/* ── riproduzione: cronologia, radio infinita, tasti multimediali ── */
function liveOnTrack(t, restoreOnly) {
  if (!LIVE.on || !t) return;
  if (!restoreOnly) {
    _localeCountrySwitched = false;
    if (typeof getResolvedCountry === 'function') t._playedCountry = getResolvedCountry();
    LIVE.recent = [t].concat(LIVE.recent.filter(x => x.id !== t.id)).slice(0, 24); liveSave();
    if (typeof recRecordPlay === 'function') {
      recRecordPlay(t, 'play');
      if (typeof recStartTrack === 'function') recStartTrack(t, true);
      else { _recCurId = t.id; _recCurTrack = t; _recCurSec = 0; _recCounted = true; }
    }
    if (typeof savePlayerState === 'function') savePlayerState();
  }
  const shouldPrefetchExtras = !restoreOnly || (typeof PL !== 'undefined' && PL.playing);
  if (shouldPrefetchExtras) {
    if (_startupSecondaryReady && t.artist && !t.artistThumb && typeof prefetchArtistThumb === 'function') prefetchArtistThumb(t);
    liveLy(t); /* il testo parte a caricarsi appena scegli il brano, non quando apri la pagina testi */
    if (typeof prewarmLyrics === 'function' && cur() && cur().id === t.id) prewarmLyrics(t);
    for (let i = 1; i <= 2; i++) {
      const nx = PL.queue[PL.qi + i];
      if (nx && nx.id && nx.id !== t.id) {
        if (window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') window.SonoraNative.prefetch(nx.id);
        else if (i === 1) fetch('/api/prefetch/' + nx.id).catch(() => {});
        if (typeof preloadArt === 'function') preloadArt(nx, true);
        liveLy(nx);
      }
    }
  }
  const seedId = t && t.id;
  const pushFromRadio = () => {
    if (!LIVE.radio.length) return [];
    if (typeof isTrackFrequentlySkipped === 'function') {
      const kept = [], skipped = [];
      for (let i = 0; i < LIVE.radio.length; i++) {
        const rx = LIVE.radio[i];
        if (!rx) continue;
        if (rx.id !== seedId && isTrackFrequentlySkipped(rx)) skipped.push(rx);
        else kept.push(rx);
      }
      LIVE.radio = kept.length >= 3 ? kept : (kept.length ? kept.concat(skipped) : skipped);
    }
    const have = new Set(PL.queue.map(x => x && x.id).filter(Boolean));
    const added = [];
    while (LIVE.radio.length && added.length < 40) {
      const tr = LIVE.radio.shift();
      if (tr && tr.id && !have.has(tr.id)) { have.add(tr.id); added.push(tr); }
    }
    if (added.length) {
      PL.queue.push(...added);
      added.slice(0, 4).forEach(x => {
        if (window.SonoraNative && typeof window.SonoraNative.prefetch === 'function') window.SonoraNative.prefetch(x.id);
        else fetch('/api/prefetch/' + x.id).catch(() => {});
        if (typeof preloadArt === 'function') preloadArt(x, false);
      });
      if (typeof syncNativeNextTrack === 'function') syncNativeNextTrack();
      redraw();
    }
    return added;
  };
  if (PL.infinity && PL.queue.length - PL.qi <= 25 && LIVE.radio.length > 0) {
    pushFromRadio();
  }
  if (PL.queue.length - PL.qi <= 25 && LIVE.radio.length < 20 && !LIVE.radioBusy) {
    LIVE.radioBusy = true; const q = PL.queue;
    api('/api/radio/' + t.id).then(d => {
      if (q !== PL.queue) return;
      const have = new Set(PL.queue.map(x => x && x.id).filter(Boolean));
      const rawTrks = (d.tracks || []).map(ingestTrack).filter(x => x && !have.has(x.id));
      let trks = rawTrks;
      if (typeof isTrackFrequentlySkipped === 'function') {
        const kept = [], skipped = [];
        for (let i = 0; i < rawTrks.length; i++) {
          const rx = rawTrks[i];
          if (rx.id !== seedId && isTrackFrequentlySkipped(rx)) skipped.push(rx);
          else kept.push(rx);
        }
        trks = kept.length >= 3 ? kept : (kept.length ? kept.concat(skipped) : skipped);
      }
      LIVE.radio.push(...trks);
      if (PL.shuffle && PL.smartShuffle && typeof injectSmartShuffleRecs === 'function') {
        injectSmartShuffleRecs();
      }
      if (PL.infinity && PL.queue.length - PL.qi <= 30) {
        pushFromRadio();
      }
    }).catch(() => {}).finally(() => { LIVE.radioBusy = false; redraw(); });
  }
  try {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.albumTitle || '', artwork: t.thumb ? [{ src: location.origin + t.thumb, sizes: '600x600', type: 'image/jpeg' }] : [] });
      if (!liveOnTrack.ms) { liveOnTrack.ms = 1; const ms = navigator.mediaSession; ms.setActionHandler('play', togglePlay); ms.setActionHandler('pause', togglePlay); ms.setActionHandler('nexttrack', () => next(false)); ms.setActionHandler('previoustrack', prev); }
    }
  } catch (e) {}
}
/* testi: il backend interroga più fonti (Apple Music, Better Lyrics, LRCLIB, …); qui teniamo la migliore o quella scelta dall'utente */
const LY_KIND = {
  get word() { return typeof window !== 'undefined' && typeof window.lyKindLabel === 'function' ? window.lyKindLabel('word') : 'Parola per parola'; },
  get line() { return typeof window !== 'undefined' && typeof window.lyKindLabel === 'function' ? window.lyKindLabel('line') : 'Per riga'; },
  get plain() { return typeof window !== 'undefined' && typeof window.lyKindLabel === 'function' ? window.lyKindLabel('plain') : 'Non sincronizzato'; }
};
const OFFLINE_LYRICS_KEY = 'sonora-offline-lyrics-v1';
if (typeof LIVE !== 'undefined' && !LIVE.offlineLy) LIVE.offlineLy = {};
const _activeLyDlIds = new Set();
const _lyDlInFlight = new Map();
const _lyDlRev = Object.create(null);

function loadOfflineLyrics() {
  try {
    if (typeof localStorage === 'undefined' || typeof LIVE === 'undefined') return;
    const raw = localStorage.getItem(OFFLINE_LYRICS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    if (!LIVE.offlineLy) LIVE.offlineLy = {};
    if (!LIVE.ly) LIVE.ly = {};
    const keys = Object.keys(parsed);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      const item = parsed[id];
      if (!item || !Array.isArray(item.lines) || !item.lines.length) continue;
      const norm = {
        lines: item.lines,
        synced: !!item.synced,
        wordSync: !!item.wordSync,
        kind: item.kind || null,
        source: item.source || null,
        best: item.best || null,
        sources: Array.isArray(item.sources) ? item.sources : [],
        pending: [],
        v: item.v || ++LIVE.lyV
      };
      LIVE.offlineLy[id] = norm;
      if (!LIVE.ly[id] || LIVE.ly[id].loading) {
        LIVE.ly[id] = Object.assign({}, norm, { loading: false, v: ++LIVE.lyV });
      }
    }
  } catch (e) {}
}

function saveOfflineLyrics() {
  try {
    if (typeof localStorage === 'undefined' || typeof LIVE === 'undefined') return;
    const map = LIVE.offlineLy || (LIVE.offlineLy = {});
    try {
      localStorage.setItem(OFFLINE_LYRICS_KEY, JSON.stringify(map));
    } catch (err) {
      const keepSaved = new Set(_savedIdSet);
      if (Array.isArray(LIVE.saved)) {
        for (let i = 0; i < LIVE.saved.length; i++) {
          if (LIVE.saved[i] && LIVE.saved[i].id) keepSaved.add(LIVE.saved[i].id);
        }
      }
      const keys = Object.keys(map);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!keepSaved.has(k) && !_activeLyDlIds.has(k)) {
          delete map[k];
        }
      }
      try {
        localStorage.setItem(OFFLINE_LYRICS_KEY, JSON.stringify(map));
      } catch (_) {}
    }
  } catch (e) {}
}

function _removeOfflineLyrics(ids) {
  if (!ids) return;
  let changed = false;
  const list = Array.isArray(ids) ? ids : Array.from(ids);
  for (let i = 0; i < list.length; i++) {
    const id = list[i];
    if (!id) continue;
    _lyDlRev[id] = (_lyDlRev[id] || 0) + 1;
    if (LIVE.offlineLy && Object.prototype.hasOwnProperty.call(LIVE.offlineLy, id)) {
      delete LIVE.offlineLy[id];
      changed = true;
    }
  }
  if (changed) saveOfflineLyrics();
}

function hasOfflineLyrics(t) {
  return Boolean(
    t && t.id &&
    typeof LIVE !== 'undefined' &&
    LIVE.offlineLy && LIVE.offlineLy[t.id] &&
    Array.isArray(LIVE.offlineLy[t.id].lines) &&
    LIVE.offlineLy[t.id].lines.length
  );
}

async function downloadLyricsForTrack(t) {
  if (!t || !t.id || t._local) return false;
  const src = (LIVE.lySel && LIVE.lySel[t.id]) || (typeof PREFS !== 'undefined' && PREFS.prefLySource) || 'auto';
  const rev = _lyDlRev[t.id] || 0;
  const inflightKey = t.id + ':' + src + ':' + rev;
  if (_lyDlInFlight.has(inflightKey)) return _lyDlInFlight.get(inflightKey);

  const task = (async () => {
    _activeLyDlIds.add(t.id);
    try {
      let d = null;
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (LIVE.on && isOnline) {
        const url = '/api/lyrics/' + encodeURIComponent(t.id) +
          '?src=' + encodeURIComponent(src) +
          '&wait=all&title=' + encodeURIComponent(t.title || '') +
          '&artist=' + encodeURIComponent(t.artist || '') +
          '&dur=' + encodeURIComponent(t.dur || 0);
        try {
          d = await api(url);
        } catch (_) {
          d = null;
        }
      }
      if ((_lyDlRev[t.id] || 0) !== rev) return false;
      if (d && d.available && Array.isArray(d.lines) && d.lines.length) {
        const had = LIVE.ly && LIVE.ly[t.id];
        const norm = {
          lines: d.lines,
          synced: !!d.synced,
          wordSync: !!d.wordSync,
          kind: d.kind || null,
          source: d.source || null,
          best: d.best || null,
          sources: d.sources || [],
          pending: [],
          v: ++LIVE.lyV
        };
        if (!LIVE.ly) LIVE.ly = {};
        if (!LIVE.offlineLy) LIVE.offlineLy = {};
        LIVE.ly[t.id] = Object.assign({}, norm, { loading: false });
        delete LIVE.offlineLy[t.id];
        LIVE.offlineLy[t.id] = norm;
        saveOfflineLyrics();
        if (typeof cur === 'function' && cur() && cur().id === t.id) {
          if (typeof SH !== 'undefined' && SH && (!had || had.loading || had.source !== LIVE.ly[t.id].source)) {
            SH.lSnap = true;
          }
          if (typeof prewarmLyrics === 'function') prewarmLyrics(t);
          if (typeof redraw === 'function') redraw();
        }
        return true;
      }
      const existing = LIVE.ly && LIVE.ly[t.id];
      if (existing && !existing.loading && existing.source && Array.isArray(existing.lines) && existing.lines.length) {
        const norm = {
          lines: existing.lines,
          synced: !!existing.synced,
          wordSync: !!existing.wordSync,
          kind: existing.kind || null,
          source: existing.source || null,
          best: existing.best || null,
          sources: existing.sources || [],
          pending: [],
          v: existing.v || ++LIVE.lyV
        };
        if (!LIVE.offlineLy) LIVE.offlineLy = {};
        delete LIVE.offlineLy[t.id];
        LIVE.offlineLy[t.id] = norm;
        saveOfflineLyrics();
        return true;
      }
      return false;
    } finally {
      _activeLyDlIds.delete(t.id);
      _lyDlInFlight.delete(inflightKey);
    }
  })();

  _lyDlInFlight.set(inflightKey, task);
  return task;
}

const _lyUpgradeChecked = new Set();
const TOP_SRCS = ['apple', 'better'];
function _isTopTierLyric(L) {
  return !!(L && L.kind === 'word' && TOP_SRCS.indexOf(L.source) >= 0);
}
function _lyKindRank(kind) {
  return kind === 'word' ? 2 : (kind === 'line' ? 1 : 0);
}
function _isBetterLyric(cand, curL) {
  if (!cand || !cand.lines || !cand.lines.length || !cand.source) return false;
  if (!curL || curL.loading || !curL.source || !curL.lines || !curL.lines.length) return true;
  const cr = _lyKindRank(cand.kind);
  const br = _lyKindRank(curL.kind);
  if (cr !== br) return cr > br;
  const ci = LY_ORDER.indexOf(cand.source);
  const bi = LY_ORDER.indexOf(curL.source);
  if (ci >= 0 && bi >= 0) return ci < bi;
  return ci >= 0 && bi < 0;
}
function liveLy(t) {
  if (!t || !t.id) return { lines: [{ text: window.t('lyrics.unavailable'), _placeholder: true }], synced: false, sources: [], pending: [], v: 0 };
  const sel = LIVE.lySel[t.id] || (typeof PREFS !== 'undefined' && PREFS.prefLySource) || 'auto';
  const online = (typeof LIVE !== 'undefined' && LIVE.on) && (typeof navigator === 'undefined' || navigator.onLine !== false);
  const L = LIVE.ly[t.id];
  if (L) {
    if (online && sel === 'auto' && !L.loading && !_isTopTierLyric(L) && !_lyUpgradeChecked.has(t.id)) {
      _lyUpgradeChecked.add(t.id);
      lyFetch(t, 'auto', 'fast', 0, true);
    }
    return L;
  }
  if (LIVE.offlineLy && LIVE.offlineLy[t.id]) {
    const off = LIVE.ly[t.id] = Object.assign({}, LIVE.offlineLy[t.id], { loading: false, v: ++LIVE.lyV });
    if (online && sel === 'auto' && !_isTopTierLyric(off) && !_lyUpgradeChecked.has(t.id)) {
      _lyUpgradeChecked.add(t.id);
      lyFetch(t, 'auto', 'fast', 0, true);
    }
    return off;
  }
  lyFetch(t, sel, 'fast', 0, false);
  return LIVE.ly[t.id] = { lines: [{ text: window.t('lyrics.loading'), _placeholder: true }], synced: false, sources: [], pending: [], v: ++LIVE.lyV, loading: true };
}
window.liveLy = liveLy;
window.hasOfflineLyrics = hasOfflineLyrics;
window.downloadLyricsForTrack = downloadLyricsForTrack;
window.loadOfflineLyrics = loadOfflineLyrics;
window.saveOfflineLyrics = saveOfflineLyrics;

const LY_ORDER = ['apple', 'better', 'lrclib', 'netease', 'kugou', 'ovh'];
const WORD_SRCS = ['apple', 'better', 'netease', 'kugou'];
function lyFetch(t, src, mode, tries, upgradeOnly) {
  const extra = '&title=' + encodeURIComponent(t.title || '') + '&artist=' + encodeURIComponent(t.artist || '') + '&dur=' + (t.dur || 0);
  api('/api/lyrics/' + t.id + '?src=' + src + '&wait=' + mode + extra).then(d => {
    if ((LIVE.lySel[t.id] || (typeof PREFS !== 'undefined' && PREFS.prefLySource) || 'auto') !== src) return;
    const had = LIVE.ly[t.id], ok = d && d.available && d.lines && d.lines.length;
    const cand = ok ? { lines: d.lines, synced: d.synced, wordSync: d.wordSync, kind: d.kind || null, source: d.source, best: d.best, sources: d.sources || [], pending: d.pending || [], v: ++LIVE.lyV } : null;
    if (upgradeOnly && had && !had.loading && had.source) {
      if (cand && _isBetterLyric(cand, had)) {
        LIVE.ly[t.id] = cand;
        if (LIVE.offlineLy && LIVE.offlineLy[t.id]) {
          LIVE.offlineLy[t.id] = Object.assign({}, cand, { pending: [] });
          saveOfflineLyrics();
        }
        if (typeof SH !== 'undefined' && SH) SH.lSnap = true;
        if (typeof prewarmLyrics === 'function' && typeof cur === 'function' && cur() && cur().id === t.id) prewarmLyrics(t);
        if (typeof redraw === 'function') redraw();
      }
    } else {
      if (cand) {
        LIVE.ly[t.id] = cand;
      } else if (LIVE.offlineLy && LIVE.offlineLy[t.id]) {
        LIVE.ly[t.id] = Object.assign({}, LIVE.offlineLy[t.id], { loading: false, v: ++LIVE.lyV });
      } else {
        LIVE.ly[t.id] = { lines: [{ text: window.t('lyrics.unavailable'), _placeholder: true }], synced: false, kind: (d && d.kind) || null, source: null, best: d && d.best, sources: (d && d.sources) || [], pending: (d && d.pending) || [], v: ++LIVE.lyV };
      }
      if (typeof SH !== 'undefined' && SH && (!had || had.loading || had.source !== LIVE.ly[t.id].source || had.kind !== LIVE.ly[t.id].kind)) SH.lSnap = true;
      if (typeof prewarmLyrics === 'function' && typeof cur === 'function' && cur() && cur().id === t.id) prewarmLyrics(t);
      if (typeof redraw === 'function') redraw();
    }
    /* Poll fast while higher-tier lyrics providers are pending, then settle with wait=all. */
    if (src === 'auto' && mode === 'fast' && d) {
      const pend = d.pending || [];
      const curIdx = LY_ORDER.indexOf(d.source);
      const hasBetterPending = pend.length > 0 && (
        (!d.available) ||
        (d.kind !== 'word' && pend.some(p => WORD_SRCS.indexOf(p) >= 0)) ||
        (pend.some(p => {
          const pIdx = LY_ORDER.indexOf(p);
          return pIdx >= 0 && (curIdx < 0 || pIdx < curIdx);
        }))
      );
      if (hasBetterPending) {
        if (tries < 4) {
          setTimeout(() => lyFetch(t, src, 'fast', tries + 1, upgradeOnly), 900);
        } else if (tries === 4) {
          setTimeout(() => lyFetch(t, src, 'all', 9, upgradeOnly), 400);
        }
      }
    }
  }).catch(() => {
    if (!LIVE.ly[t.id] || LIVE.ly[t.id].loading) {
      if (LIVE.offlineLy && LIVE.offlineLy[t.id]) {
        LIVE.ly[t.id] = Object.assign({}, LIVE.offlineLy[t.id], { loading: false, v: ++LIVE.lyV });
      } else {
        LIVE.ly[t.id] = { lines: [{ text: window.t('lyrics.unavailable'), _placeholder: true }], synced: false, kind: null, sources: [], pending: [], v: ++LIVE.lyV };
      }
      if (typeof prewarmLyrics === 'function' && typeof cur === 'function' && cur() && cur().id === t.id) prewarmLyrics(t);
      if (typeof redraw === 'function') redraw();
    }
  });
}
function lyPick(t, id) {
  const d = LIVE.ly[t.id]; if (!d) return;
  if (id === d.best) delete LIVE.lySel[t.id]; else LIVE.lySel[t.id] = id;
  d.source = id; d.loading = true; redraw();
  lyFetch(t, LIVE.lySel[t.id] || 'auto', 'fast', 9);
}
function lyOpenPicker(t) {
  SRCUI.open = true; SRCUI.ex = false;
  if (typeof armHistory === 'function') armHistory();
  redraw();
  if (LIVE.on) lyFetch(t, LIVE.lySel[t.id] || 'auto', 'all', 9);
}

const slimT = t => {
  const o = { id: t.id, title: t.title, artist: t.artist, artistId: t.artistId, artistThumb: t.artistThumb || null, albumId: t.album && t.album.indexOf('s_') !== 0 ? t.album : null, album: t.albumTitle, dur: t.dur, ex: t.ex, hue: t.hue, style: t.style, thumb: t.thumb, canonicalCover: Boolean(t.canonicalCover) };
  if (t._playedCountry) o._playedCountry = t._playedCountry;
  return o;
};
const slimI = it => ({ kind: it.kind, id: it.id, title: it.title, artist: it.artist, hue: it.hue, style: it.style, thumb: it.thumb, year: it.year, desc: it.desc });
const favList = () => Object.keys(PL.fav).filter(k => PL.fav[k] && LIVE.known[k]).map(k => LIVE.known[k]);
LIVE.saved = []; LIVE.localFiles = [];
LIVE.userPlaylists = [];
let USER_PLAYLISTS = LIVE.userPlaylists;
window.USER_PLAYLISTS = USER_PLAYLISTS;

function saveUserPlaylists() {
  try {
    const raw = (LIVE.userPlaylists || []).map(pl => ({
      kind: 'playlist',
      id: pl.id,
      title: pl.title,
      artist: pl.artist || window.t('library.personal_playlist_sub'),
      tracks: (pl.tracks || []).map(slimT),
      hue: pl.hue != null ? pl.hue : Math.floor(Math.random() * 360),
      style: pl.style != null ? pl.style : Math.floor(Math.random() * 6),
      thumb: pl.thumb || null,
      user: true,
      loaded: true,
      created: pl.created || Date.now()
    }));
    localStorage.setItem('sonora-user-playlists', JSON.stringify(raw));
  } catch (e) {}
}

function restoreUserPlaylists() {
  try {
    let raw = null;
    const stored = localStorage.getItem('sonora-user-playlists');
    if (stored) {
      raw = JSON.parse(stored);
    } else {
      const st = JSON.parse(localStorage.getItem('sonora-live') || 'null');
      if (st && st.userPlaylists) raw = st.userPlaylists;
    }
    if (Array.isArray(raw)) {
      LIVE.userPlaylists = raw.map(pl => {
        const item = {
          kind: 'playlist',
          id: pl.id,
          title: pl.title,
          artist: pl.artist || window.t('library.personal_playlist_sub'),
          tracks: (pl.tracks || []).map(ingestTrack).filter(Boolean),
          hue: pl.hue != null ? pl.hue : Math.floor(Math.random() * 360),
          style: pl.style != null ? pl.style : Math.floor(Math.random() * 6),
          thumb: pl.thumb || null,
          user: true,
          loaded: true,
          created: pl.created || Date.now()
        };
        BYID[item.id] = item;
        return item;
      });
      USER_PLAYLISTS = LIVE.userPlaylists;
      window.USER_PLAYLISTS = USER_PLAYLISTS;
      if (!stored) saveUserPlaylists();
    }
  } catch (e) {}
}

function createUserPlaylist(title) {
  const plTitle = (title && typeof title === 'string' && title.trim()) || window.t('prompt.new_playlist_title');
  const id = 'upl_' + Date.now();
  const pl = {
    kind: 'playlist',
    id,
    title: plTitle,
    artist: window.t('library.personal_playlist_sub'),
    tracks: [],
    hue: Math.floor(Math.random() * 360),
    style: Math.floor(Math.random() * 6),
    user: true,
    loaded: true,
    created: Date.now()
  };
  BYID[pl.id] = pl;
  if (!Array.isArray(LIVE.userPlaylists)) LIVE.userPlaylists = [];
  LIVE.userPlaylists.unshift(pl);
  USER_PLAYLISTS = LIVE.userPlaylists;
  window.USER_PLAYLISTS = USER_PLAYLISTS;
  saveUserPlaylists();
  liveSave();
  if (typeof redraw === 'function') redraw();
  return pl;
}

const PLAYLIST_RECS_LIMIT = 15;
const _plRecCache = new Map();
const _plRecDebounceTimers = new Map();

function _plRecNormStr(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function _plRecNormTitle(title) {
  const stripped = String(title || '').replace(/\s*[\(\[]\s*(?:feat|ft|featuring|official|audio|video|lyrics|visualizer|hd|4k)[^\)\]]*[\)\]]/gi, ' ');
  return _plRecNormStr(stripped) || _plRecNormStr(title);
}

function _plRecNormPrimaryArtist(artist) {
  const raw = String(artist || '').split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b)\s*/i)[0] || artist;
  return _plRecNormStr(raw);
}

function _plRecTrackKey(tr) {
  if (!tr) return '';
  const nt = _plRecNormTitle(tr.title);
  const na = _plRecNormPrimaryArtist(tr.artist);
  if (!nt) return '';
  return nt + '||' + na;
}

function _plRecPlaylistKeys(pl) {
  const idSet = new Set();
  const normSet = new Set();
  const list = (pl && Array.isArray(pl.tracks)) ? pl.tracks : [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t) continue;
    if (t.id) idSet.add(String(t.id));
    const tk = _plRecTrackKey(t);
    if (tk) normSet.add(tk);
  }
  return { idSet, normSet };
}

function _plRecHash(str, seed) {
  let h = (seed || 2166136261) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function playlistRecsSig(pl) {
  if (!pl || !pl.user || !Array.isArray(pl.tracks) || pl.tracks.length === 0) return '';
  const parts = new Array(pl.tracks.length);
  for (let i = 0; i < pl.tracks.length; i++) {
    const t = pl.tracks[i] || {};
    const id = t.id ? String(t.id).trim() : '';
    const nt = _plRecNormTitle(t.title);
    const na = _plRecNormPrimaryArtist(t.artist);
    parts[i] = id + ':' + nt + ':' + na;
  }
  parts.sort();
  const joined = parts.join('|');
  return pl.tracks.length + ':' + _plRecHash(joined, 2166136261) + ':' + _plRecHash(joined, 33554467);
}

function _isPlaylistInCurrentStack(plId) {
  if (!plId || typeof stackOf !== 'function') return false;
  const st = stackOf();
  if (!Array.isArray(st)) return false;
  for (let i = 0; i < st.length; i++) {
    const pg = st[i];
    if (pg && (pg.kind === 'album' || pg.name === 'album') && pg.data && pg.data.item && pg.data.item.id === plId) return true;
  }
  return false;
}

function _plRecEntry(plId) {
  let entry = _plRecCache.get(plId);
  if (!entry) {
    entry = {
      sig: '',
      tracks: [],
      loading: false,
      err: null,
      refreshToken: 0,
      excludedIds: new Set(),
      invalidated: false,
      inFlightKey: '',
      reqSeq: 0,
      lastFetchAt: 0
    };
    _plRecCache.set(plId, entry);
  }
  return entry;
}

function _plRecFilterTracks(tracks, pl, extraExcludeSet) {
  const { idSet, normSet } = _plRecPlaylistKeys(pl);
  const seenIds = new Set();
  const seenKeys = new Set();
  const out = [];
  for (let i = 0; i < (tracks || []).length; i++) {
    const t = tracks[i];
    if (!t || !t.id) continue;
    const id = String(t.id);
    if (idSet.has(id) || seenIds.has(id)) continue;
    if (extraExcludeSet && extraExcludeSet.has(id)) continue;
    const tk = _plRecTrackKey(t);
    if (tk && (normSet.has(tk) || seenKeys.has(tk))) continue;
    seenIds.add(id);
    if (tk) seenKeys.add(tk);
    out.push(t);
  }
  return out;
}

function _serializePlaylistSeedTrack(t) {
  const o = {
    id: String(t.id),
    title: String(t.title || '').slice(0, 120),
    artist: String(t.artist || '').slice(0, 100)
  };
  if (t.artistId) o.artistId = String(t.artistId);
  const alb = t.albumTitle || (typeof t.album === 'string' && t.album.indexOf('s_') !== 0 && typeof BYID !== 'undefined' && BYID[t.album] ? BYID[t.album].title : '');
  if (alb) o.album = String(alb).slice(0, 100);
  return o;
}

function _selectSeedTracksForTransport(allTracks, maxCount) {
  if (!Array.isArray(allTracks) || allTracks.length <= maxCount) return allTracks || [];
  const out = [];
  const step = allTracks.length / maxCount;
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.min(allTracks.length - 1, Math.floor(i * step));
    out.push(allTracks[idx]);
  }
  return out;
}

function _computeOfflinePlaylistRecs(pl, excludedIds, salt, limit) {
  limit = limit || PLAYLIST_RECS_LIMIT;
  if (!pl || !Array.isArray(pl.tracks) || !pl.tracks.length) return [];

  const { idSet, normSet } = _plRecPlaylistKeys(pl);
  const artistFreq = Object.create(null);
  const artistIdFreq = Object.create(null);
  const albumFreq = Object.create(null);
  const genreFreq = Object.create(null);
  const titleWords = new Set();
  let durSum = 0, durCnt = 0;
  let hueSin = 0, hueCos = 0, hueCnt = 0;

  for (let i = 0; i < pl.tracks.length; i++) {
    const t = pl.tracks[i];
    if (!t) continue;
    const na = _plRecNormPrimaryArtist(t.artist);
    if (na) artistFreq[na] = (artistFreq[na] || 0) + 1;
    if (t.artistId) artistIdFreq[t.artistId] = (artistIdFreq[t.artistId] || 0) + 1;
    const albObj = typeof albumOf === 'function' ? albumOf(t) : (typeof BYID !== 'undefined' ? BYID[t.album] : null);
    const albKey = (t.album && String(t.album).indexOf('s_') !== 0 ? String(t.album) : '') || _plRecNormStr(t.albumTitle || (albObj && albObj.title));
    if (albKey) albumFreq[albKey] = (albumFreq[albKey] || 0) + 1;
    const genre = albObj && albObj.genre ? _plRecNormStr(albObj.genre) : '';
    if (genre) genreFreq[genre] = (genreFreq[genre] || 0) + 1;
    const words = _plRecNormTitle(t.title).split(' ');
    for (let w = 0; w < words.length; w++) {
      if (words[w].length >= 4) titleWords.add(words[w]);
    }
    if (t.dur > 0) { durSum += t.dur; durCnt++; }
    if (typeof t.hue === 'number') {
      const rad = (t.hue * Math.PI) / 180;
      hueSin += Math.sin(rad);
      hueCos += Math.cos(rad);
      hueCnt++;
    }
  }
  const avgDur = durCnt ? durSum / durCnt : 200;
  const avgHue = hueCnt ? ((Math.atan2(hueSin / hueCnt, hueCos / hueCnt) * 180) / Math.PI + 360) % 360 : null;

  const pool = [];
  const seenCandId = new Set();
  const seenCandKey = new Set();
  const pushPool = tr => {
    if (!tr || !tr.id || tr._local) return;
    if (typeof isTrackFrequentlySkipped === 'function' && isTrackFrequentlySkipped(tr)) return;
    const id = String(tr.id);
    if (idSet.has(id) || seenCandId.has(id)) return;
    const tk = _plRecTrackKey(tr);
    if (tk && (normSet.has(tk) || seenCandKey.has(tk))) return;
    seenCandId.add(id);
    if (tk) seenCandKey.add(tk);
    pool.push(tr);
  };

  if (typeof TRACKS !== 'undefined' && Array.isArray(TRACKS)) {
    for (let i = 0; i < TRACKS.length; i++) pushPool(TRACKS[i]);
  }
  if (typeof LIVE !== 'undefined' && LIVE) {
    if (LIVE.known) {
      for (const k in LIVE.known) pushPool(LIVE.known[k]);
    }
    if (Array.isArray(LIVE.recent)) LIVE.recent.forEach(pushPool);
    if (typeof favList === 'function') favList().forEach(pushPool);
    if (Array.isArray(LIVE.saved)) LIVE.saved.forEach(pushPool);
    if (Array.isArray(LIVE.radio)) LIVE.radio.forEach(pushPool);
    if (Array.isArray(LIVE.home)) {
      LIVE.home.forEach(r => {
        if (r && Array.isArray(r.items)) r.items.forEach(it => { if (it && !it.kind) pushPool(it); });
      });
    }
    if (LIVE.charts) {
      ['songs', 'trending', 'new_tracks'].forEach(ck => {
        if (Array.isArray(LIVE.charts[ck])) LIVE.charts[ck].forEach(pushPool);
      });
    }
  }

  const scoreCand = (tr, isExcluded) => {
    let sc = 0;
    const na = _plRecNormPrimaryArtist(tr.artist);
    if (na && artistFreq[na]) sc += 5.0 * artistFreq[na];
    if (tr.artistId && artistIdFreq[tr.artistId]) sc += 5.0 * artistIdFreq[tr.artistId];
    const albObj = typeof albumOf === 'function' ? albumOf(tr) : (typeof BYID !== 'undefined' ? BYID[tr.album] : null);
    const albKey = (tr.album && String(tr.album).indexOf('s_') !== 0 ? String(tr.album) : '') || _plRecNormStr(tr.albumTitle || (albObj && albObj.title));
    if (albKey && albumFreq[albKey]) sc += 2.2 * albumFreq[albKey];
    const genre = albObj && albObj.genre ? _plRecNormStr(albObj.genre) : '';
    if (genre && genreFreq[genre]) sc += 3.5 * genreFreq[genre];
    if (titleWords.size) {
      const words = _plRecNormTitle(tr.title).split(' ');
      for (let w = 0; w < words.length; w++) {
        if (words[w].length >= 4 && titleWords.has(words[w])) { sc += 0.8; break; }
      }
    }
    if (tr.dur > 0) {
      const diff = Math.abs(tr.dur - avgDur);
      if (diff <= 45) sc += 0.8 * (1 - diff / 45);
    }
    if (avgHue !== null && typeof tr.hue === 'number') {
      const dh = Math.abs(tr.hue - avgHue);
      const dist = Math.min(dh, 360 - dh);
      sc += Math.max(0, 1 - dist / 90) * 1.1;
    }
    const jitterSeed = (tr.id || '') + ':' + (salt || 0);
    const jitter = (parseInt(_plRecHash(jitterSeed, 2166136261), 36) % 1000) / 1000;
    sc += jitter * (salt ? 2.8 : 0.45);
    if (typeof getTrackAffinityScore === 'function') sc += getTrackAffinityScore(tr);
    if (typeof getArtistAffinityBonus === 'function') sc += getArtistAffinityBonus(tr.artist);
    if (isExcluded) sc -= 50;
    return sc;
  };

  const scored = pool.map(tr => ({
    tr,
    score: scoreCand(tr, Boolean(excludedIds && excludedIds.has(String(tr.id))))
  }));
  scored.sort((a, b) => b.score - a.score);

  const perArtist = Object.create(null);
  const picked = [];
  const overflow = [];
  const cap = pl.tracks.length <= 2 ? 3 : 2;

  for (let i = 0; i < scored.length; i++) {
    const it = scored[i];
    const na = _plRecNormPrimaryArtist(it.tr.artist) || String(it.tr.id);
    if ((perArtist[na] || 0) < cap) {
      perArtist[na] = (perArtist[na] || 0) + 1;
      picked.push(it.tr);
      if (picked.length >= limit) break;
    } else {
      overflow.push(it.tr);
    }
  }
  for (let i = 0; picked.length < limit && i < overflow.length; i++) {
    picked.push(overflow[i]);
  }
  return picked;
}

function _executePlaylistRecsFetch(pl, entry, sig) {
  if (!pl || !pl.user || !Array.isArray(pl.tracks) || !pl.tracks.length) {
    entry.loading = false;
    entry.tracks = [];
    entry.inFlightKey = '';
    return;
  }

  const refreshToken = entry.refreshToken || 0;
  const key = sig + '|' + refreshToken;
  if (entry.inFlightKey === key) return;

  if (typeof LIVE === 'undefined' || !LIVE.on) {
    entry.sig = sig;
    entry.invalidated = false;
    entry.loading = false;
    entry.err = null;
    entry.inFlightKey = '';
    entry.lastFetchAt = Date.now();
    entry.tracks = _computeOfflinePlaylistRecs(pl, entry.excludedIds, refreshToken, PLAYLIST_RECS_LIMIT);
    return;
  }

  const reqSeq = ++entry.reqSeq;
  entry.inFlightKey = key;
  entry.sig = sig;
  entry.invalidated = false;
  entry.loading = true;
  entry.err = null;
  entry.lastFetchAt = Date.now();

  const seedTracks = _selectSeedTracksForTransport(pl.tracks, 150);
  const excludeList = entry.excludedIds ? Array.from(entry.excludedIds).slice(-45) : [];
  const payload = {
    tracks: seedTracks.map(_serializePlaylistSeedTrack),
    excludeIds: excludeList,
    limit: PLAYLIST_RECS_LIMIT,
    refresh: refreshToken
  };
  const url = '/api/playlist_recs?data=' + encodeURIComponent(JSON.stringify(payload));

  api(url)
    .then(d => {
      if (entry.reqSeq !== reqSeq || _plRecCache.get(pl.id) !== entry) return;
      const curPl = getUserPlaylist(pl.id) || pl;
      if (playlistRecsSig(curPl) !== sig) return;
      const rawTracks = (d && Array.isArray(d.tracks)) ? d.tracks : [];
      const ingested = (typeof ingestTrack === 'function')
        ? rawTracks.map(ingestTrack).filter(Boolean)
        : rawTracks.filter(Boolean);
      let filtered = _plRecFilterTracks(ingested, curPl, null);
      if (!filtered.length) {
        filtered = _computeOfflinePlaylistRecs(curPl, entry.excludedIds, refreshToken, PLAYLIST_RECS_LIMIT);
      }
      entry.tracks = filtered.slice(0, PLAYLIST_RECS_LIMIT);
      entry.loading = false;
      entry.err = null;
      entry.inFlightKey = '';
      if (typeof preloadArt === 'function') {
        entry.tracks.slice(0, 6).forEach(t => preloadArt(t, false));
      }
      if (typeof redraw === 'function') redraw();
    })
    .catch(err => {
      if (entry.reqSeq !== reqSeq || _plRecCache.get(pl.id) !== entry) return;
      const curPl = getUserPlaylist(pl.id) || pl;
      if (playlistRecsSig(curPl) !== sig) return;
      const fallback = _computeOfflinePlaylistRecs(curPl, entry.excludedIds, refreshToken, PLAYLIST_RECS_LIMIT);
      entry.tracks = fallback;
      entry.loading = false;
      entry.err = fallback.length ? null : (err && err.message ? err.message : window.t('toast.recs_error'));
      entry.inFlightKey = '';
      if (typeof redraw === 'function') redraw();
    });
}

function _schedulePlaylistRecsFetch(pl, entry, opts) {
  opts = opts || {};
  const sig = playlistRecsSig(pl);
  if (!sig) return;

  const existingTimer = _plRecDebounceTimers.get(pl.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    _plRecDebounceTimers.delete(pl.id);
  }

  if (!opts.keepTracks) {
    entry.tracks = _plRecFilterTracks(entry.tracks || [], pl, null);
  }
  entry.sig = sig;
  entry.invalidated = false;
  entry.err = null;

  if (typeof LIVE === 'undefined' || !LIVE.on) {
    _executePlaylistRecsFetch(pl, entry, sig);
    return;
  }

  entry.loading = true;
  const elapsed = Date.now() - (entry.lastFetchAt || 0);
  const delay = opts.immediate ? 0 : (opts.delayMs != null ? opts.delayMs : (elapsed < 160 ? 160 : 0));

  if (delay <= 0) {
    _executePlaylistRecsFetch(pl, entry, sig);
    return;
  }

  const key = sig + '|' + (entry.refreshToken || 0);
  if (entry.inFlightKey === key) return;
  const timer = setTimeout(() => {
    _plRecDebounceTimers.delete(pl.id);
    const curPl = getUserPlaylist(pl.id) || pl;
    const curSig = playlistRecsSig(curPl);
    if (!curSig || _plRecCache.get(pl.id) !== entry) return;
    _executePlaylistRecsFetch(curPl, entry, curSig);
  }, delay);
  _plRecDebounceTimers.set(pl.id, timer);
}

function playlistRecsState(pl) {
  if (!pl || !pl.user || !Array.isArray(pl.tracks) || pl.tracks.length === 0) {
    return { loading: false, tracks: [], err: null, sig: '' };
  }
  const sig = playlistRecsSig(pl);
  const entry = _plRecEntry(pl.id);
  if (entry.sig === sig && !entry.invalidated) {
    const clean = _plRecFilterTracks(entry.tracks || [], pl, null);
    if (clean.length !== (entry.tracks || []).length) entry.tracks = clean;
    return {
      loading: !!entry.loading,
      tracks: entry.tracks || [],
      err: entry.err || null,
      sig
    };
  }
  _schedulePlaylistRecsFetch(pl, entry, { keepTracks: false });
  return {
    loading: !!entry.loading,
    tracks: entry.tracks || [],
    err: entry.err || null,
    sig
  };
}

function refreshPlaylistRecs(pl) {
  const targetPl = (pl && pl.id && getUserPlaylist(pl.id)) || pl;
  if (!targetPl || !targetPl.user || !Array.isArray(targetPl.tracks) || targetPl.tracks.length === 0) return;
  const entry = _plRecEntry(targetPl.id);
  if (!entry.excludedIds) entry.excludedIds = new Set();
  (entry.tracks || []).forEach(t => {
    if (t && t.id) entry.excludedIds.add(String(t.id));
  });
  if (entry.excludedIds.size > 45) {
    const trimmed = Array.from(entry.excludedIds).slice(-45);
    entry.excludedIds = new Set(trimmed);
  }
  entry.refreshToken = (entry.refreshToken || 0) + 1;
  entry.tracks = [];
  entry.inFlightKey = '';
  entry.invalidated = true;
  entry.err = null;
  entry.loading = true;
  _schedulePlaylistRecsFetch(targetPl, entry, { immediate: true, keepTracks: true });
  if (typeof redraw === 'function') redraw();
}

function _isAlreadyIngestedTrack(tr) {
  if (!tr || !tr.id) return false;
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.known && LIVE.known[tr.id] === tr) return true;
  if (typeof tr.src === 'string' && tr.src.indexOf('/api/stream/') === 0 &&
      (tr.albumTitle !== undefined || (typeof tr.album === 'string' && (tr.album.indexOf('s_') === 0 || (typeof BYID !== 'undefined' && BYID[tr.album] && BYID[tr.album].kind === 'album'))))) {
    return true;
  }
  return false;
}

function _ensureIngestedPlaylistTrack(tr) {
  if (!tr || !tr.id || tr._local) return tr;
  if (_isAlreadyIngestedTrack(tr)) return tr;
  if (typeof ingestTrack === 'function' && ((typeof LIVE !== 'undefined' && LIVE.on) || typeof BYID === 'undefined' || !BYID[tr.id])) {
    return ingestTrack(tr) || tr;
  }
  return tr;
}

function addTrackFromRec(pl, tr) {
  const targetPl = (pl && pl.id && getUserPlaylist(pl.id)) || pl;
  if (!targetPl || !tr || !tr.id) return false;
  if (!Array.isArray(targetPl.tracks)) targetPl.tracks = [];

  const existing = _plRecPlaylistKeys(targetPl);
  const trKey = _plRecTrackKey(tr);
  const entry = _plRecCache.get(targetPl.id);

  if (existing.idSet.has(String(tr.id)) || (trKey && existing.normSet.has(trKey))) {
    if (entry && Array.isArray(entry.tracks)) {
      entry.tracks = _plRecFilterTracks(entry.tracks, targetPl, null);
    }
    if (typeof redraw === 'function') redraw();
    return false;
  }

  const ing = _ensureIngestedPlaylistTrack(tr);

  targetPl.tracks.push(ing);
  if (typeof BYID !== 'undefined' && BYID[targetPl.id] && BYID[targetPl.id] !== targetPl && Array.isArray(BYID[targetPl.id].tracks)) {
    BYID[targetPl.id].tracks = targetPl.tracks;
  }

  if (!targetPl.thumb && ing.thumb) {
    targetPl.thumb = ing.thumb;
    if (typeof BYID !== 'undefined' && BYID[targetPl.id]) {
      BYID[targetPl.id].thumb = ing.thumb;
    }
    if (typeof ARTC !== 'undefined') delete ARTC[targetPl.id];
    if (typeof preloadArt === 'function') preloadArt(targetPl, true);
  }

  saveUserPlaylists();
  if (typeof liveSave === 'function') liveSave();
  if (typeof liveToast === 'function') {
    liveToast(window.t('toast.added_to', { name: targetPl.title || window.t('common.playlist_lc') }));
  }

  const activeEntry = _plRecEntry(targetPl.id);
  activeEntry.tracks = _plRecFilterTracks(activeEntry.tracks || [], targetPl, null);
  const newSig = playlistRecsSig(targetPl);
  activeEntry.sig = newSig;
  activeEntry.invalidated = false;
  activeEntry.err = null;
  _schedulePlaylistRecsFetch(targetPl, activeEntry, { keepTracks: true });

  if (typeof redraw === 'function') redraw();
  return true;
}

function invalidatePlaylistRecs(plOrId, opts) {
  opts = opts || {};
  const pl = typeof plOrId === 'string' ? getUserPlaylist(plOrId) : ((plOrId && plOrId.id && getUserPlaylist(plOrId.id)) || plOrId);
  if (!pl || !pl.id) return;
  const entry = _plRecCache.get(pl.id);
  const timer = _plRecDebounceTimers.get(pl.id);
  if (timer) {
    clearTimeout(timer);
    _plRecDebounceTimers.delete(pl.id);
  }
  if (!pl.user || !Array.isArray(pl.tracks) || pl.tracks.length === 0) {
    _plRecCache.delete(pl.id);
    return;
  }
  if (!entry) {
    if (_isPlaylistInCurrentStack(pl.id)) {
      playlistRecsState(pl);
    }
    return;
  }
  entry.tracks = _plRecFilterTracks(entry.tracks || [], pl, null);
  if (_isPlaylistInCurrentStack(pl.id) || opts.forceFetch) {
    _schedulePlaylistRecsFetch(pl, entry, { keepTracks: true });
  } else {
    entry.invalidated = true;
    entry.inFlightKey = '';
  }
}

function getUserPlaylist(id) {
  if (!id) return null;
  if (Array.isArray(LIVE.userPlaylists)) {
    const pl = LIVE.userPlaylists.find(p => p && p.id === id);
    if (pl) return pl;
  }
  const by = BYID[id];
  if (by && (by.user || by.kind === 'playlist')) return by;
  return null;
}

function addToUserPlaylist(plId, tracks) {
  const pl = getUserPlaylist(plId);
  if (!pl) return false;
  if (!Array.isArray(pl.tracks)) pl.tracks = [];
  const list = Array.isArray(tracks) ? tracks : (tracks ? [tracks] : []);
  const existing = _plRecPlaylistKeys(pl);
  let added = 0;
  list.forEach(t => {
    if (!t || !t.id) return;
    const tk = _plRecTrackKey(t);
    if (existing.idSet.has(String(t.id)) || (tk && existing.normSet.has(tk))) return;
    const ing = _ensureIngestedPlaylistTrack(t);
    pl.tracks.push(ing);
    if (typeof BYID !== 'undefined' && BYID[plId] && BYID[plId] !== pl && Array.isArray(BYID[plId].tracks)) {
      BYID[plId].tracks = pl.tracks;
    }
    existing.idSet.add(String(ing.id));
    if (tk) existing.normSet.add(tk);
    if (!pl.thumb && ing.thumb) {
      pl.thumb = ing.thumb;
      if (typeof BYID !== 'undefined' && BYID[pl.id]) BYID[pl.id].thumb = ing.thumb;
      if (typeof ARTC !== 'undefined') delete ARTC[pl.id];
      if (typeof preloadArt === 'function') preloadArt(pl, true);
    }
    added++;
  });
  saveUserPlaylists();
  liveSave();
  if (added > 0) invalidatePlaylistRecs(pl);
  if (typeof liveToast === 'function' && added > 0) {
    liveToast(window.t('toast.added_to', { name: pl.title }));
  }
  if (typeof redraw === 'function') redraw();
  return true;
}

function removeFromUserPlaylist(plId, trackId) {
  const pl = getUserPlaylist(plId);
  if (!pl || !Array.isArray(pl.tracks)) return false;
  const prevLen = pl.tracks.length;
  pl.tracks = pl.tracks.filter(t => t && t.id !== trackId);
  if (typeof BYID !== 'undefined' && BYID[plId] && BYID[plId] !== pl && Array.isArray(BYID[plId].tracks)) {
    BYID[plId].tracks = pl.tracks;
  }
  saveUserPlaylists();
  liveSave();
  if (pl.tracks.length !== prevLen) invalidatePlaylistRecs(pl);
  if (typeof redraw === 'function') redraw();
  return true;
}

function renameUserPlaylist(plId, newTitle) {
  const pl = getUserPlaylist(plId);
  if (!pl) return false;
  if (newTitle && typeof newTitle === 'string' && newTitle.trim()) {
    pl.title = newTitle.trim();
  }
  saveUserPlaylists();
  liveSave();
  if (typeof redraw === 'function') redraw();
  return true;
}

function deleteUserPlaylist(plId) {
  if (!plId) return false;
  const timer = _plRecDebounceTimers.get(plId);
  if (timer) {
    clearTimeout(timer);
    _plRecDebounceTimers.delete(plId);
  }
  _plRecCache.delete(plId);
  if (Array.isArray(LIVE.userPlaylists)) {
    LIVE.userPlaylists = LIVE.userPlaylists.filter(p => p.id !== plId);
    USER_PLAYLISTS = LIVE.userPlaylists;
    window.USER_PLAYLISTS = USER_PLAYLISTS;
  }
  if (BYID[plId]) delete BYID[plId];
  saveUserPlaylists();
  liveSave();
  if (typeof redraw === 'function') redraw();
  return true;
}

function isDownloaded(t) {
  return Boolean(t && t.id && _savedIdSet.has(t.id));
}

function allDownloaded(it) {
  if (!it) return false;
  const tr = typeof tracksOf === 'function' ? tracksOf(it) : (it.tracks || []);
  return Boolean(tr && tr.length > 0 && tr.every(isDownloaded));
}

const _dlJobs = {};
function _dlKeyFor(item, list) {
  if (item && item.id) return String(item.id);
  if (Array.isArray(list) && list[0] && list[0].album) return 'list:' + list[0].album;
  return 'list';
}
function getDownloadProgress(item, list) {
  const key = _dlKeyFor(item, list);
  const job = _dlJobs[key];
  const tr = (Array.isArray(list) && list.length) ? list : (item && typeof tracksOf === 'function' ? tracksOf(item) : []);
  const total = job ? job.total : (tr ? tr.length : 0);
  const done = job ? job.done : (tr ? tr.filter(isDownloaded).length : 0);
  const active = Boolean(job && !job.canceled);
  const allDone = Boolean(!active && total > 0 && done >= total);
  const pct = total > 0 ? clamp(done / total, 0, 1) : 0;
  return { key, active, done, total, pct, allDone };
}
function cancelDownloadItem(item, list) {
  const key = _dlKeyFor(item, list);
  if (_dlJobs[key]) {
    _dlJobs[key].canceled = true;
    if (typeof redraw === 'function') redraw();
  }
}
function removeDownloadedItem(item, list) {
  const tr = (Array.isArray(list) && list.length) ? list : (item && typeof tracksOf === 'function' ? tracksOf(item) : []);
  if (!tr || !tr.length) return;
  const ids = new Set(tr.map(t => t && t.id).filter(Boolean));
  LIVE.saved = LIVE.saved.filter(x => !ids.has(x.id));
  _syncSavedIndex();
  _removeOfflineLyrics(ids);
  if (LIVE.on) {
    tr.forEach(t => {
      if (t && t.id && !t._local) fetch('/api/remove_download/' + encodeURIComponent(t.id)).catch(() => {});
    });
  }
  liveSave(true);
  if (typeof redraw === 'function') redraw();
  liveToast(window.t('toast.removed_downloads'));
}
function startSequentialDownload(item, list) {
  const tracks = ((Array.isArray(list) && list.length) ? list : (item && typeof tracksOf === 'function' ? tracksOf(item) : [])).filter(t => t && t.id);
  if (!tracks.length) return;
  const key = _dlKeyFor(item, tracks);
  if (_dlJobs[key] && !_dlJobs[key].canceled) return;
  const job = _dlJobs[key] = {
    key,
    id: item && item.id,
    total: tracks.length,
    done: tracks.filter(isDownloaded).length,
    canceled: false
  };
  if (typeof redraw === 'function') redraw();
  (async () => {
    let downloadedNow = 0, failedNow = 0;
    const lyPromises = [];
    for (let i = 0; i < tracks.length; i++) {
      if (job.canceled) break;
      const tr = tracks[i];
      if (isDownloaded(tr)) {
        if (!hasOfflineLyrics(tr)) {
          lyPromises.push(downloadLyricsForTrack(tr).catch(() => {}));
        }
        job.done = tracks.filter(isDownloaded).length;
        continue;
      }
      if (typeof preloadArt === 'function') preloadArt(tr, false);
      lyPromises.push(downloadLyricsForTrack(tr).catch(() => {}));
      let ok = true;
      if (LIVE.on && tr.id && !tr._local) {
        try {
          const r = await fetch('/api/download_track/' + encodeURIComponent(tr.id));
          ok = Boolean(r && r.ok);
        } catch (_) {
          ok = false;
        }
      }
      if (job.canceled) break;
      if (ok) {
        if (!_savedIdSet.has(tr.id)) {
          LIVE.saved.unshift(tr);
          _savedIdSet.add(tr.id);
          liveSave();
        }
        downloadedNow++;
        job.done = tracks.filter(isDownloaded).length;
      } else {
        failedNow++;
      }
      if (typeof redraw === 'function') redraw();
      await new Promise(res => setTimeout(res, 16));
    }
    const wasCanceled = Boolean(job.canceled);
    if (!wasCanceled && lyPromises.length) {
      await Promise.all(lyPromises);
    }
    if (_dlJobs[key] === job) delete _dlJobs[key];
    liveSave(true);
    if (typeof redraw === 'function') redraw();
    const label = (item && item.title) ? ('“' + item.title + '”') : window.t('download.collection_fallback');
    if (wasCanceled) liveToast(window.t('toast.download_cancelled'));
    else if (failedNow > 0 && downloadedNow === 0) liveToast(window.t('toast.download_failed'));
    else if (failedNow > 0) liveToast(window.t('toast.download_done_partial', { done: downloadedNow, failed: failedNow }));
    else liveToast(window.t('toast.download_done_one', { title: label }));
  })();
}
function requestDownloadItem(item, list) {
  const tracks = (Array.isArray(list) && list.length) ? list : (item && typeof tracksOf === 'function' ? tracksOf(item) : []);
  if (item && !item.user && !item.loaded && (!tracks || !tracks.length)) {
    liveLoad(item);
    liveToast(window.t('download.loading_tracks'));
    return;
  }
  if (!tracks || !tracks.length) {
    liveToast(window.t('toast.download_empty'));
    return;
  }
  const prog = getDownloadProgress(item, tracks);
  const title = (item && item.title) || window.t('download.collection_title_fallback');
  if (prog.active) {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal({
        icon: 'download',
        title: window.t('download.in_progress_title'),
        subtitle: window.t('download.in_progress_msg', { done: prog.done, total: prog.total, title }),
        cancelText: window.t('common.continue'),
        confirmText: window.t('common.stop'),
        onConfirm: () => cancelDownloadItem(item, tracks)
      });
    } else {
      cancelDownloadItem(item, tracks);
    }
    return;
  }
  if (prog.allDone) {
    if (typeof showConfirmModal === 'function') {
      showConfirmModal({
        icon: 'trash',
        title: window.t('download.remove_title'),
        subtitle: window.tPlural(tracks.length, 'download.remove_msg_one', 'download.remove_msg_many', { title }),
        cancelText: window.t('common.cancel'),
        confirmText: window.t('common.remove'),
        onConfirm: () => removeDownloadedItem(item, tracks)
      });
    } else {
      removeDownloadedItem(item, tracks);
    }
    return;
  }
  const missing = tracks.filter(t => t && t.id && !isDownloaded(t));
  const kindTitle = item && item.kind === 'album' ? window.t('download.album_title') : window.t('download.playlist_title');
  if (typeof showConfirmModal === 'function') {
    showConfirmModal({
      icon: 'download',
      title: kindTitle,
      subtitle: window.tPlural(missing.length, 'download.confirm_msg_one', 'download.confirm_msg_many', { title }),
      cancelText: window.t('common.cancel'),
      confirmText: window.t('common.download'),
      onConfirm: () => startSequentialDownload(item, tracks)
    });
  } else {
    startSequentialDownload(item, tracks);
  }
}

function toggleDownloadTrack(t) {
  if (!t) return;
  const wasDl = isDownloaded(t);
  toggleSavedList([t]);
  if (!wasDl) {
    downloadLyricsForTrack(t).catch(() => {});
    if (LIVE.on && t.id && !t._local) {
      fetch('/api/download_track/' + encodeURIComponent(t.id)).catch(() => {});
    }
  } else {
    if (t.id) {
      _removeOfflineLyrics([t.id]);
    }
    if (LIVE.on && t.id && !t._local) {
      fetch('/api/remove_download/' + encodeURIComponent(t.id)).catch(() => {});
    }
  }
}

function toggleDownloadItem(it) {
  if (!it) return;
  requestDownloadItem(it, typeof tracksOf === 'function' ? tracksOf(it) : (it.tracks || []));
}

window.createUserPlaylist = createUserPlaylist;
window.getUserPlaylist = getUserPlaylist;
window.addToUserPlaylist = addToUserPlaylist;
window.removeFromUserPlaylist = removeFromUserPlaylist;
window.renameUserPlaylist = renameUserPlaylist;
window.deleteUserPlaylist = deleteUserPlaylist;
window.isDownloaded = isDownloaded;
window.allDownloaded = allDownloaded;
window.getDownloadProgress = getDownloadProgress;
window.requestDownloadItem = requestDownloadItem;
window.cancelDownloadItem = cancelDownloadItem;
window.toggleDownloadTrack = toggleDownloadTrack;
window.toggleDownloadItem = toggleDownloadItem;
window.saveUserPlaylists = saveUserPlaylists;
window.playlistRecsSig = playlistRecsSig;
window.playlistRecsState = playlistRecsState;
window.refreshPlaylistRecs = refreshPlaylistRecs;
window.addTrackFromRec = addTrackFromRec;
window.invalidatePlaylistRecs = invalidatePlaylistRecs;

restoreUserPlaylists();
loadOfflineLyrics();

function toggleSavedList(list, item) {
  if (!list || !list.length) return;
  const haveAll = list.every(t => t && _savedIdSet.has(t.id));
  if (haveAll) {
    const ids = new Set(list.map(t => t && t.id).filter(Boolean));
    LIVE.saved = LIVE.saved.filter(x => !ids.has(x.id));
    _syncSavedIndex();
    _removeOfflineLyrics(ids);
    liveToast(window.t('toast.removed_downloads'));
  } else {
    list.forEach(t => {
      if (t && t.id && !_savedIdSet.has(t.id)) {
        LIVE.saved.unshift(t);
        _savedIdSet.add(t.id);
      }
      if (t && t.id && !t._local) {
        downloadLyricsForTrack(t).catch(() => {});
      }
    });
    list.slice(0, 3).forEach(t => { if (t.id && t.src && t.src.indexOf('/api/') === 0) fetch('/api/prefetch/' + t.id).catch(() => {}); });
    liveToast(window.tPlural(list.length, 'toast.download_saved_one', 'toast.download_saved_many'));
  }
  liveSave(); redraw();
}
function pickLocalAudio() {
  let inp = document.getElementById('fLocal');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'fLocal'; inp.accept = 'audio/*'; inp.multiple = true; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const files = Array.from(inp.files || []);
      if (!files.length) return;
      files.forEach((f, idx) => {
        const raw = f.name.replace(/\.[^/.]+$/, '');
        const parts = raw.split(/\s+-\s+/);
        const artist = parts.length > 1 ? parts[0].trim() : window.t('local.file');
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : raw.trim();
        const id = 'loc_' + h32(f.name + '_' + f.size);
        const url = URL.createObjectURL(f);
        const tr = { id, title: title || f.name, artist, album: 'loc_alb', albumTitle: window.t('local.files'), dur: 180, ex: false, hue: (h32(id) % 360), style: (h32(id) >> 9) % 6, src: url, _local: true };
        stubAlbum('loc_alb', { title: window.t('local.files'), artist: window.t('local.device'), hue: 225, style: 2 });
        LIVE.known[id] = tr;
        if (!LIVE.localFiles.some(x => x.id === id)) LIVE.localFiles.unshift(tr);
      });
      liveToast(window.tPlural(files.length, 'toast.import_one', 'toast.import_many'));
      redraw();
    });
  }
  inp.click();
}
let _liveSaveTimer = 0, _liveSaveDirty = false;
function _writeLiveStorage() {
  try {
    localStorage.setItem('sonora-live', JSON.stringify({
      pins: PINS.map(slimI),
      favs: favList().map(slimT),
      recent: LIVE.recent.map(slimT),
      saved: (LIVE.saved || []).filter(t => !t._local).map(slimT)
    }));
  } catch (e) {}
}
function flushLiveSave() {
  if (_liveSaveTimer) { clearTimeout(_liveSaveTimer); _liveSaveTimer = 0; }
  if (!_liveSaveDirty) return;
  _liveSaveDirty = false;
  _writeLiveStorage();
}
function liveSave(immediate) {
  _liveSaveDirty = true;
  _libVersion++;
  if (immediate) { flushLiveSave(); return; }
  if (_liveSaveTimer) clearTimeout(_liveSaveTimer);
  _liveSaveTimer = setTimeout(flushLiveSave, 600);
}
const PLAYER_CACHE_KEY = 'sonora-player-v1';
let _playerSaveTimer = 0, _playerSaveDirty = false;
function _writePlayerStorage() {
  try {
    const rawQ = Array.isArray(PL.queue) ? PL.queue : [];
    const nonLocal = [];
    let curIdx = -1;
    for (let i = 0; i < rawQ.length; i++) {
      const t = rawQ[i];
      if (!t || t._local || !t.id) continue;
      if (i === PL.qi) curIdx = nonLocal.length;
      nonLocal.push(t);
    }
    if (!nonLocal.length) {
      localStorage.removeItem(PLAYER_CACHE_KEY);
      return;
    }
    const idx = curIdx >= 0 ? curIdx : 0;
    let start = Math.max(0, idx - 40);
    const end = Math.min(nonLocal.length, start + 120);
    if (end - start < 120) start = Math.max(0, end - 120);
    const win = nonLocal.slice(start, end);
    const relQi = clamp(idx - start, 0, Math.max(0, win.length - 1));
    const serTrack = t => {
      const o = slimT(t);
      if (t._queued) o._queued = true;
      if (t._smartRec) o._smartRec = true;
      return o;
    };
    localStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify({
      queue: win.map(serTrack),
      qi: relQi,
      pos: Math.max(0, PL.pos || 0),
      shuffle: !!PL.shuffle,
      smartShuffle: !!PL.smartShuffle,
      repeat: PL.repeat || 0,
      infinity: PL.infinity !== false,
      qualityLabel: PL.qualityLabel || '',
      qualityTrackId: PL.qualityTrackId || null,
      radio: (LIVE.radio || []).filter(t => t && t.id && !t._local).slice(0, 60).map(slimT)
    }));
  } catch (e) {}
}
function flushPlayerState() {
  if (_playerSaveTimer) { clearTimeout(_playerSaveTimer); _playerSaveTimer = 0; }
  if (!_playerSaveDirty) return;
  _playerSaveDirty = false;
  _writePlayerStorage();
}
function savePlayerState(immediate) {
  _playerSaveDirty = true;
  if (typeof syncNativeRepeat === 'function') syncNativeRepeat();
  if (immediate) { flushPlayerState(); return; }
  if (_playerSaveTimer) clearTimeout(_playerSaveTimer);
  _playerSaveTimer = setTimeout(flushPlayerState, _startupSecondaryReady ? 400 : 1200);
}
if (typeof window !== 'undefined') window.savePlayerState = savePlayerState;
function _restorePlayerSnapshot() {
  try {
    const pst = JSON.parse(localStorage.getItem(PLAYER_CACHE_KEY) || 'null');
    if (!pst || !Array.isArray(pst.queue) || !pst.queue.length) return;
    const q = [];
    for (let i = 0; i < pst.queue.length; i++) {
      const raw = pst.queue[i];
      const tr = ingestTrack(raw);
      if (!tr) continue;
      if (raw._queued) tr._queued = true;
      if (raw._smartRec) tr._smartRec = true;
      q.push(tr);
    }
    if (!q.length) return;
    PL.queue = q;
    PL.qi = clamp(pst.qi || 0, 0, q.length - 1);
    PL.pos = PL.sPos = Math.max(0, pst.pos || 0);
    PL.shuffle = !!pst.shuffle;
    PL.smartShuffle = !!pst.smartShuffle;
    PL.repeat = pst.repeat || 0;
    PL.infinity = pst.infinity !== undefined ? !!pst.infinity : true;
    PL.qualityLabel = pst.qualityLabel || '';
    PL.qualityTrackId = pst.qualityTrackId || null;
    LIVE.radio = Array.isArray(pst.radio) ? pst.radio.map(ingestTrack).filter(Boolean) : [];
  } catch (e) {}
}
function reconcileNativePlayback() {
  let snap = null;
  if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getPlaybackSnapshot === 'function') {
    try { snap = JSON.parse(window.SonoraNative.getPlaybackSnapshot() || 'null'); } catch (e) {}
  }
  if (snap && snap.active && snap.trackId) {
    if (!Array.isArray(PL.queue)) PL.queue = [];
    const idx = PL.queue.findIndex(x => x && x.id === snap.trackId);
    if (idx >= 0) {
      PL.qi = idx;
      if (snap.thumb && !PL.queue[idx].thumb) PL.queue[idx].thumb = snap.thumb;
    } else {
      const tr = ingestTrack({
        id: snap.trackId,
        title: snap.title || window.t('common.track'),
        artist: snap.artist || '',
        thumb: snap.thumb || null,
        dur: Math.round(snap.durSec > 1 ? snap.durSec : 180)
      });
      if (tr) {
        const ins = clamp(PL.qi || 0, 0, PL.queue.length);
        PL.queue.splice(ins, 0, tr);
        PL.qi = ins;
      }
    }
    const cTr = cur();
    if (cTr && snap.durSec > 1) cTr.dur = Math.round(snap.durSec);
    PL.playing = !!snap.isPlaying;
    PL.loading = !!snap.isBuffering;
    PL.trackLoading = false;
    PL.loadingSince = 0;
    PL.pos = PL.sPos = Math.max(0, snap.posSec || 0);
    if (snap.qualityLabel) {
      PL.qualityLabel = snap.qualityLabel;
      PL.qualityTrackId = snap.trackId;
    }
    if (cTr) {
      if (typeof preloadArt === 'function') preloadArt(cTr, true);
      if (typeof syncNativeFavorite === 'function') syncNativeFavorite(cTr);
      liveOnTrack(cTr, true);
    }
    if (typeof syncNativeRepeat === 'function') syncNativeRepeat();
    if (typeof syncNativeNextTrack === 'function') syncNativeNextTrack(true);
    savePlayerState();
    redraw();
    return;
  }
  if (cur()) {
    PL.playing = false;
    PL.loading = false;
    PL.trackLoading = false;
    PL.loadingSince = 0;
    if (typeof preloadArt === 'function') preloadArt(cur(), true);
    if (typeof syncNativeFavorite === 'function') syncNativeFavorite(cur());
    if (typeof syncNativeRepeat === 'function') syncNativeRepeat();
    liveOnTrack(cur(), true);
    redraw();
  } else if (typeof syncNativeRepeat === 'function') {
    syncNativeRepeat();
  }
}
const HOME_CACHE_KEY = 'sonora-home-v9';
let _localeCountrySwitched = false;
let _homeSnapPending = null;
let _homeSnapTimer = 0;
let _homeSnapIdleId = 0;
function _saveHomeSnapshot(rows) {
  try {
    const compact = (rows || []).slice(0, 8).map(r => ({
      title: r.title || '',
      type: r.type || '',
      artist: r.artist || '',
      items: (r.items || []).slice(0, 16).map(it => {
        if (!it) return null;
        if (!it.kind || it.kind === 'track') return slimT(it);
        const p = slimI(it);
        if (it.type) p.type = it.type;
        return p;
      }).filter(Boolean)
    })).filter(r => r.items.length);
    if (compact.length) localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(compact));
  } catch (e) {}
}
function flushHomeSnapshot() {
  if (_homeSnapTimer) { clearTimeout(_homeSnapTimer); _homeSnapTimer = 0; }
  if (_homeSnapIdleId && typeof cancelIdleCallback === 'function') { cancelIdleCallback(_homeSnapIdleId); _homeSnapIdleId = 0; }
  if (!_homeSnapPending) return;
  const rows = _homeSnapPending;
  _homeSnapPending = null;
  _saveHomeSnapshot(rows);
}
function _scheduleSaveHomeSnapshot(rows) {
  _homeSnapPending = rows;
  if (_homeSnapTimer) { clearTimeout(_homeSnapTimer); _homeSnapTimer = 0; }
  if (_homeSnapIdleId && typeof cancelIdleCallback === 'function') { cancelIdleCallback(_homeSnapIdleId); _homeSnapIdleId = 0; }
  if (typeof requestIdleCallback === 'function') {
    _homeSnapIdleId = requestIdleCallback(() => { _homeSnapIdleId = 0; flushHomeSnapshot(); }, { timeout: 1500 });
  } else {
    _homeSnapTimer = setTimeout(() => { _homeSnapTimer = 0; flushHomeSnapshot(); }, 1200);
  }
}
if (typeof window !== 'undefined') {
  window.reconcileNativePlayback = reconcileNativePlayback;
  window.addEventListener('pagehide', () => { flushLiveSave(); flushPlayerState(); flushHomeSnapshot(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushLiveSave(); flushPlayerState(); flushHomeSnapshot(); }
  });
}
function _restoreHomeSnapshot() {
  try {
    const raw = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) || 'null');
    if (!Array.isArray(raw) || !raw.length) return null;
    const rows = raw.map(r => ({
      title: r.title || '',
      type: r.type || '',
      artist: r.artist || '',
      items: (r.items || []).map(ingestItem).filter(Boolean)
    })).filter(r => r.items.length);
    return rows.length ? rows : null;
  } catch (e) { return null; }
}
function liveRestore() {
  try {
    const st = JSON.parse(localStorage.getItem('sonora-live') || 'null');
    restoreUserPlaylists();
    if (st) {
      (st.favs || []).forEach(ingestTrack); LIVE.recent = (st.recent || []).map(ingestTrack).filter(Boolean);
      LIVE.saved = (st.saved || []).map(ingestTrack).filter(Boolean);
      _syncSavedIndex();
      const trThumbs = new Set();
      for (const k in LIVE.known) {
        const t = LIVE.known[k];
        if (t && t.thumb) trThumbs.add(t.thumb);
      }
      (st.pins || []).forEach(p => {
        if (p && p.kind === 'artist' && p.thumb && trThumbs.has(p.thumb)) p.thumb = null;
        const e = ingestItem(p);
        if (e) { PINS.push(e); if (e.kind === 'artist' && !e.thumb) liveArtistThumb(e); }
      });
    }
    loadOfflineLyrics();
    if (!LIVE.home) {
      const cachedHome = _restoreHomeSnapshot();
      if (cachedHome) LIVE.home = cachedHome;
    }
    _restorePlayerSnapshot();
    reconcileNativePlayback();
    _libVersion++;
  } catch (e) {}
}

function liveToast(m, ms) {
  ms = ms || 4200;
  const now = performance.now();
  LIVE.toast = m;
  LIVE.toastStart = now;
  LIVE.toastT = now + ms;
  if (LIVE._toastTimer) clearTimeout(LIVE._toastTimer);
  if (typeof redraw === 'function') redraw();
  LIVE._toastTimer = setTimeout(() => { LIVE._toastTimer = 0; if (typeof redraw === 'function') redraw(); }, ms);
}
function liveAudioError(t) {
  liveToast(window.t('toast.cannot_play', { title: (t && t.title) || window.t('common.track') }));
  fetch(t.src, { headers: { Range: 'bytes=0-0' } }).then(async r => {
    if (r.ok) return; let d = 'HTTP ' + r.status; try { d = (await r.json()).detail || d; } catch (e) {}
    console.error('[sonora] audio non disponibile per ' + t.id + ': ' + d); LIVE.lastErr = d; liveToast(d.length > 78 ? d.slice(0, 75) + '…' : d, 9000);
  }).catch(() => {});
}
function liveToastDraw(c) {
  if (!LIVE.toast) return;
  const now = performance.now(), exitMs = 220, enterMs = 240;
  if (now > LIVE.toastT + exitMs) return;
  const ent = clamp((now - (LIVE.toastStart || 0)) / enterMs, 0, 1);
  const entE = 1 - Math.pow(1 - ent, 3);
  const ex = now > LIVE.toastT ? clamp((now - LIVE.toastT) / exitMs, 0, 1) : 0;
  const exE = ex * ex;
  const a = entE * (1 - exE);
  if (a <= 0.002) return;
  if (ent < 1 || (now >= LIVE.toastT && ex < 1)) {
    if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  }
  const dy = -12 * (1 - entE) - 8 * exE;
  const sc = mix(0.92, 1, entE) * mix(1, 0.94, exE);
  c.save();
  c.font = F(600, 15);
  const w = Math.min(W - 40, c.measureText(LIVE.toast).width + 40), x = (W - w) / 2, y = TOP + 62 + dy;
  const cx = W / 2, cy = y + 20;
  c.globalAlpha *= a;
  c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
  rrPath(c, x, y, w, 40, 20); c.fillStyle = 'rgba(28,28,30,.94)'; c.fill();
  txt(c, LIVE.toast, W / 2, y + 25, F(600, 15), '#fff', 'center', w - 24);
  c.restore();
}
function liveStatus(c, y, msg, retry) {
  txt(c, msg, W / 2, y + 44, F(500, 16), pal.sub, 'center', W - 48);
  if (retry) { txt(c, window.t('audio.tap_to_retry'), W / 2, y + 70, F(600, 16), pal.accent, 'center'); hit(0, y, W, 90, retry); }
}

function topArtistIds(maxCount) {
  const limit = maxCount || 3;
  const cnt = {};
  const artNames = {};
  (LIVE.recent || []).concat(favList()).forEach(t => {
    if (t && t.artistId && !t._local) {
      cnt[t.artistId] = (cnt[t.artistId] || 0) + 1;
      if (t.artist && !artNames[t.artistId]) artNames[t.artistId] = t.artist;
    }
  });
  const scoreOf = id => {
    const base = cnt[id] || 0;
    const name = artNames[id] || (typeof BYID !== 'undefined' && BYID[id] ? BYID[id].title : '');
    if (typeof getArtistAffinityBonus === 'function' && name) {
      return base * (1 + Math.max(-0.5, getArtistAffinityBonus(name) * 0.12));
    }
    return base;
  };
  return Object.keys(cnt).sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, limit);
}
let _homeIngestSeq = 0, _chartsIngestSeq = 0, _radioIngestSeq = 0;
function _sceneRedrawSoft() {
  if (typeof redrawSceneOnly === 'function') redrawSceneOnly();
  else redraw();
}
function _ingestHomeRow(r) {
  const items = (r && r.items ? r.items : []).map(ingestItem).filter(Boolean);
  if (!items.length) return null;
  return { title: r.title, sectionKey: r.sectionKey || '', type: r.type || '', artist: r.artist || '', items };
}
function liveHome(force) {
  const seq = ++_homeIngestSeq;
  LIVE.homeErr = null;
  if (!LIVE.home || !LIVE.home.length) LIVE.home = null;
  redraw();
  const curCty = typeof getResolvedCountry === 'function' ? getResolvedCountry() : '';
  const recentTr = LIVE.recent.length && !LIVE.recent[0]._local ? LIVE.recent[0] : null;
  const useSeed = recentTr && !_localeCountrySwitched && (!recentTr._playedCountry || !curCty || recentTr._playedCountry === curCty);
  const seed = useSeed ? '&seed=' + encodeURIComponent(recentTr.id) : '&noSeed=1';
  const ar = topArtistIds(), arq = ar.length ? '&artists=' + ar.join(',') : '';
  api('/api/home?rows=8' + seed + arq + (force ? '&refresh=1' : '')).then(d => {
    if (seq !== _homeIngestSeq) return;
    const rawRows = Array.isArray(d && d.rows) ? d.rows : [];
    const rows = [];
    for (let i = 0; i < rawRows.length; i++) {
      const r = _ingestHomeRow(rawRows[i]);
      if (r) rows.push(r);
    }
    if (rows.length) {
      LIVE.home = rows;
      _scheduleSaveHomeSnapshot(rows);
    } else if (!LIVE.home || !LIVE.home.length) {
      LIVE.home = [];
      LIVE.homeErr = window.t('audio.no_content');
    }
    _startupSecondaryReady = true;
    _sceneRedrawSoft();
  }).catch(e => {
    if (seq !== _homeIngestSeq) return;
    if (!LIVE.home || !LIVE.home.length) LIVE.homeErr = e.message;
    redraw();
  });
}
function liveCharts() {
  if (LIVE.chartsBusy) return;
  const seq = ++_chartsIngestSeq;
  LIVE.chartsBusy = true; LIVE.chartsErr = null;
  api('/api/charts').then(d => {
    if (seq !== _chartsIngestSeq) return;
    const o = {};
    for (const k in d) {
      if (k === 'moods') o.moods = d.moods || [];
      else if (Array.isArray(d[k])) o[k] = d[k].map(ingestItem).filter(Boolean);
    }
    LIVE.charts = o;
    LIVE.chartsBusy = false;
    _sceneRedrawSoft();
  }).catch(e => {
    if (seq !== _chartsIngestSeq) return;
    LIVE.chartsErr = e.message;
    LIVE.chartsBusy = false;
    redraw();
  });
}
function liveRadio() {
  if (LIVE.radioFeedBusy) return;
  const seq = ++_radioIngestSeq;
  LIVE.radioFeedBusy = true; LIVE.radioFeedErr = null;
  api('/api/radio_feed').then(d => {
    if (seq !== _radioIngestSeq) return;
    const rawSections = Array.isArray(d && d.sections) ? d.sections : [];
    const categories = (d && d.categories) || [];
    const sections = [];
    for (let i = 0; i < rawSections.length; i++) {
      const s = rawSections[i];
      const items = (s && s.items ? s.items : []).map(ingestItem).filter(Boolean);
      if (items.length) sections.push({ eyebrow: s.eyebrow || window.t('radio.moods_eyebrow'), eyebrowKey: s.eyebrowKey || '', title: s.title, params: s.params, items });
    }
    LIVE.radioFeed = { sections, categories };
    LIVE.radioFeedBusy = false;
    _sceneRedrawSoft();
  }).catch(e => {
    if (seq !== _radioIngestSeq) return;
    LIVE.radioFeedErr = e.message;
    LIVE.radioFeedBusy = false;
    redraw();
  });
}
function openMood(m) {
  const pageData = { title: m.title, params: m.params, items: null, loading: true, err: null };
  push('mood', pageData);
  api('/api/mood/' + encodeURIComponent(m.params)).then(d => {
    pageData.items = (d.items || []).map(ingestItem).filter(Boolean);
    pageData.loading = false; redraw();
  }).catch(e => { pageData.err = e.message; pageData.loading = false; redraw(); });
}
function livePlayItem(it) {
  if (isTr(it)) return playOne(it);
  const tr = tracksOf(it);
  if (tr && tr.length) return playList(tr, 0);
  liveToast(window.t('toast.starting_station', { title: it.title }), 2200);
  liveLoad(it).then(() => { const l = tracksOf(it); if (l && l.length) playList(l, 0); else liveToast(window.t('toast.no_tracks_available')); });
}
const _resKeys = [], RES_CACHE_CAP = 30;
const _searchMemCache = new Map();
let _searchAbort = null, _searchLyricsAbort = null, _searchInFlightKey = '', _searchPendingInput = 0;
function _setSearchMemCache(key, val) {
  _searchMemCache.delete(key);
  _searchMemCache.set(key, val);
  if (_searchMemCache.size > RES_CACHE_CAP) {
    _searchMemCache.delete(_searchMemCache.keys().next().value);
  }
}
function _setLiveRes(key, val) {
  if (!Object.prototype.hasOwnProperty.call(LIVE.res, key)) {
    _resKeys.push(key);
    while (_resKeys.length > RES_CACHE_CAP) {
      const old = _resKeys.shift();
      if (old !== key) delete LIVE.res[old];
    }
  }
  LIVE.res[key] = val;
}
function _tryUpgradeSongEntry(existing, tr) {
  if (!existing || !tr || !tr.thumb) return null;
  if (existing.canonicalCover && !tr.canonicalCover) return null;
  const exIsApple = Boolean(existing.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(existing.thumb));
  const trIsApple = Boolean(tr.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(tr.thumb));
  if (exIsApple && !trIsApple && !tr.canonicalCover) return null;
  const exAlbLabel = existing.albumTitle || (existing.album && typeof BYID !== 'undefined' && BYID[existing.album] && BYID[existing.album].title) || existing.album || '';
  const trAlbLabel = tr.albumTitle || (tr.album && typeof BYID !== 'undefined' && BYID[tr.album] && BYID[tr.album].title) || tr.album || '';
  const exIsComp = typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(exAlbLabel, existing.title);
  const trIsComp = typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(trAlbLabel, tr.title);
  const sameId = Boolean(existing.id && tr.id && String(existing.id) === String(tr.id));
  const wantsUpgrade = Boolean(tr.canonicalCover || (exIsComp && !trIsComp) || (sameId && !existing.canonicalCover && !trIsComp && tr.thumb !== existing.thumb));
  if (!wantsUpgrade) return null;
  const nextThumb = _preserveAppleHiRes(existing.thumb, _forceAppleListThumb(tr.thumb));
  const sameBase = Boolean(existing.thumb && nextThumb && typeof isSameCoverBase === 'function' && isSameCoverBase(existing.thumb, nextThumb));
  const hasDiff = Boolean(
    existing.thumb !== nextThumb ||
    existing.album !== tr.album ||
    existing.albumTitle !== tr.albumTitle ||
    (existing.albumId || null) !== (tr.albumId || null) ||
    Boolean(existing.canonicalCover) !== Boolean(tr.canonicalCover)
  );
  if (!hasDiff) return null;
  if (!sameBase && typeof ARTC !== 'undefined') {
    if (existing.id) delete ARTC[existing.id];
    if (tr.id) delete ARTC[tr.id];
    if (tr.album && (tr.album === 's_' + tr.id || tr.album === existing.album)) delete ARTC[tr.album];
  }
  if (existing.album && typeof BYID !== 'undefined' && BYID[existing.album]) {
    const isSameOrStubAlb = existing.album === tr.album || existing.album === 's_' + existing.id;
    const sharedOther = !isSameOrStubAlb &&
      typeof TRACKS !== 'undefined' &&
      TRACKS.some(x => x && x.id !== existing.id && x.id !== tr.id && x.album === existing.album);
    const albSameBase = Boolean(BYID[existing.album].thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(BYID[existing.album].thumb, nextThumb));
    if (isSameOrStubAlb || (!sharedOther && tr.album === existing.album)) {
      BYID[existing.album].thumb = _preserveAppleHiRes(BYID[existing.album].thumb, nextThumb);
      if (!albSameBase && !sameBase && typeof ARTC !== 'undefined') delete ARTC[existing.album];
    }
  }
  return {
    thumb: nextThumb,
    album: tr.album,
    albumTitle: tr.albumTitle,
    albumId: tr.albumId != null ? tr.albumId : null,
    canonicalCover: !!tr.canonicalCover,
    _appleUpgradeSettled: Boolean(tr._appleUpgradeSettled || tr.canonicalCover)
  };
}
function _upgradeResFromTrack(targetRes, tr) {
  if (!targetRes || !Array.isArray(targetRes.songs) || !tr || !tr.id) return false;
  const tk = _plRecTrackKey(tr);
  let changed = false;
  for (let i = 0; i < targetRes.songs.length; i++) {
    const s = targetRes.songs[i];
    if (!s || s === tr) continue;
    const sameId = s.id && String(s.id) === String(tr.id);
    const sameKey = !sameId && tk && _plRecTrackKey(s) === tk;
    if (!sameId && !sameKey) continue;
    const coverPatch = _tryUpgradeSongEntry(s, tr);
    if (coverPatch) {
      targetRes.songs[i] = Object.assign({}, s, coverPatch);
      changed = true;
    }
  }
  return changed;
}
function _syncResCoversFromKnown(targetRes) {
  if (!targetRes || typeof LIVE === 'undefined') return false;
  let changed = false;
  if (Array.isArray(targetRes.artists)) {
    for (let i = 0; i < targetRes.artists.length; i++) {
      const a = targetRes.artists[i];
      if (!a) continue;
      const byId = a.id && typeof BYID !== 'undefined' ? BYID[a.id] : null;
      const ck = a.title ? _cleanArtistThumbName(a.title).toLowerCase() : '';
      const rawCand = (byId && byId.thumb && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(byId.thumb)) ? byId.thumb : null) ||
        (ck && _artThumbCache[ck]) || null;
      const cand = _forceAppleListThumb(rawCand);
      if (cand && cand !== a.thumb && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(cand) || !a.thumb)) {
        const sameBase = Boolean(a.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(a.thumb, cand));
        if (sameBase && /[?&]s=1200\b/.test(a.thumb)) {
          if (byId && byId !== a && (!byId.thumb || (typeof isSameCoverBase === 'function' && isSameCoverBase(byId.thumb, a.thumb)))) byId.thumb = a.thumb;
        } else {
          const bothApple = Boolean(a.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(a.thumb) && isAppleArtistThumb(cand));
          if (!bothApple || sameBase || /[?&]s=1200\b/.test(cand) || /[?&]s=288\b/.test(a.thumb) || Boolean(byId && _forceAppleListThumb(byId.thumb) === cand)) {
            a.thumb = cand;
            if (byId && byId !== a) byId.thumb = _preserveAppleHiRes(byId.thumb, cand);
            if (a.id && !bothApple && !sameBase && typeof ARTC !== 'undefined') delete ARTC[a.id];
            changed = true;
          }
        }
      }
    }
  }
  if (Array.isArray(targetRes.albums)) {
    for (let i = 0; i < targetRes.albums.length; i++) {
      const a = targetRes.albums[i];
      if (!a) continue;
      const byId = a.id && typeof BYID !== 'undefined' ? BYID[a.id] : null;
      const ck = a.title ? _cleanAlbumThumbKey(a.title, a.artist) : '';
      const rawCand = (byId && byId.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(byId.thumb) ? byId.thumb : null) ||
        (ck && _albThumbCache[ck]) || null;
      const cand = _forceAppleListThumb(rawCand);
      if (cand && cand !== a.thumb && (typeof isAppleArtistThumb !== 'function' || isAppleArtistThumb(cand) || !a.thumb)) {
        const bothApple = a.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(a.thumb) && isAppleArtistThumb(cand);
        const sameBase = Boolean(a.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(a.thumb, cand));
        if (sameBase && /[?&]s=1200\b/.test(a.thumb)) continue;
        const canUpgrade = sameBase
          ? (/[?&]s=1200\b/.test(cand) || /[?&]s=288\b/.test(a.thumb))
          : (/[?&]s=1200\b/.test(cand) || /[?&]s=288\b/.test(a.thumb) || Boolean(byId && _forceAppleListThumb(byId.thumb) === cand));
        if (!bothApple || canUpgrade) {
          a.thumb = cand;
          if (byId && byId !== a) byId.thumb = _preserveAppleHiRes(byId.thumb, cand);
          if (a.id && !bothApple && !sameBase && typeof ARTC !== 'undefined') delete ARTC[a.id];
          changed = true;
        }
      }
    }
  }
  if (!Array.isArray(targetRes.songs)) return changed;
  for (let i = 0; i < targetRes.songs.length; i++) {
    const s = targetRes.songs[i];
    if (!s || !s.id) continue;
    const known = LIVE.known && LIVE.known[s.id];
    const coverPatch = known ? _tryUpgradeSongEntry(s, known) : null;
    if (coverPatch) {
      targetRes.songs[i] = Object.assign({}, s, coverPatch);
      changed = true;
    } else {
      const sAlb = s.albumTitle || (typeof s.album === 'string' ? s.album : '') || '';
      if (sAlb && !(typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(sAlb, s.title))) {
        const ack = _cleanAlbumThumbKey(sAlb, s.artist);
        const albCand = ack && _albThumbCache[ack];
        if (albCand && albCand !== s.thumb && !s.canonicalCover && !(typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(s.thumb))) {
          targetRes.songs[i] = Object.assign({}, s, { thumb: albCand });
          if (typeof ARTC !== 'undefined' && s.id) delete ARTC[s.id];
          changed = true;
        }
      }
    }
  }
  return changed;
}
function _propagateCanonicalTrack(tr) {
  if (!tr || !tr.id) return false;
  const src = (typeof LIVE !== 'undefined' && LIVE && LIVE.known && LIVE.known[tr.id]) || tr;
  let changed = false;
  const syncCopy = obj => {
    if (!obj || obj === src || !obj.id || String(obj.id) !== String(src.id)) return false;
    if (obj.canonicalCover && !src.canonicalCover) return false;
    const nextThumb = _preserveAppleHiRes(obj.thumb, src.thumb || obj.thumb);
    const diff = Boolean(
      (nextThumb && obj.thumb !== nextThumb) ||
      obj.album !== src.album ||
      obj.albumTitle !== src.albumTitle ||
      (obj.albumId || null) !== (src.albumId || null) ||
      Boolean(obj.canonicalCover) !== Boolean(src.canonicalCover)
    );
    if (!diff) return false;
    const sameBase = Boolean(obj.thumb && nextThumb && typeof isSameCoverBase === 'function' && isSameCoverBase(obj.thumb, nextThumb));
    const oldAlb = obj.album;
    if (nextThumb) obj.thumb = nextThumb;
    obj.album = src.album;
    obj.albumTitle = src.albumTitle;
    obj.albumId = src.albumId != null ? src.albumId : null;
    obj.canonicalCover = Boolean(src.canonicalCover);
    if (src._appleUpgradeSettled || src.canonicalCover) obj._appleUpgradeSettled = true;
    if (!sameBase && typeof ARTC !== 'undefined') {
      delete ARTC[obj.id];
      if (oldAlb && oldAlb === 's_' + obj.id && oldAlb !== src.album) delete ARTC[oldAlb];
    }
    return true;
  };
  const syncList = arr => {
    if (!Array.isArray(arr)) return;
    for (let i = 0; i < arr.length; i++) {
      if (syncCopy(arr[i])) changed = true;
    }
  };
  if (typeof PL !== 'undefined' && PL) syncList(PL.queue);
  if (typeof TRACKS !== 'undefined') syncList(TRACKS);
  if (typeof LIVE !== 'undefined' && LIVE) {
    syncList(LIVE.radio);
    syncList(LIVE.recent);
    syncList(LIVE.saved);
    if (Array.isArray(LIVE.home)) {
      for (let i = 0; i < LIVE.home.length; i++) {
        if (LIVE.home[i] && Array.isArray(LIVE.home[i].items)) syncList(LIVE.home[i].items);
      }
    }
    if (Array.isArray(LIVE.userPlaylists)) {
      for (let i = 0; i < LIVE.userPlaylists.length; i++) {
        if (LIVE.userPlaylists[i]) syncList(LIVE.userPlaylists[i].tracks);
      }
    }
  }
  if (typeof BYID !== 'undefined') {
    for (const k in BYID) {
      const it = BYID[k];
      if (!it || typeof it !== 'object') continue;
      if (Array.isArray(it.tracks)) syncList(it.tracks);
      if (Array.isArray(it.songs)) syncList(it.songs);
    }
  }
  if (typeof _searchCacheUpgradeHook === 'function') {
    _searchCacheUpgradeHook(src);
  }
  return changed;
}
_searchCacheUpgradeHook = function(tr) {
  if (!tr || !tr.id) return;
  const seen = new Set();
  let changed = false;
  for (const v of _searchMemCache.values()) {
    if (v && !seen.has(v)) { seen.add(v); if (_upgradeResFromTrack(v, tr)) changed = true; }
  }
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.res) {
    for (const k in LIVE.res) {
      const v = LIVE.res[k];
      if (v && !seen.has(v)) { seen.add(v); if (_upgradeResFromTrack(v, tr)) changed = true; }
    }
  }
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.lastSearch && !seen.has(LIVE.lastSearch)) {
    if (_upgradeResFromTrack(LIVE.lastSearch, tr)) changed = true;
  }
  if (changed && typeof redraw === 'function') redraw();
};
function _upgradeResFromAlbum(targetRes, id, title, artist, thumb) {
  if (!targetRes || !thumb) return false;
  let changed = false;
  const targetCk = title ? _cleanAlbumThumbKey(title, artist) : '';
  if (Array.isArray(targetRes.albums)) {
    for (let i = 0; i < targetRes.albums.length; i++) {
      const a = targetRes.albums[i];
      if (!a) continue;
      const sameId = id && a.id && String(a.id) === String(id);
      const aCk = !sameId && targetCk && a.title ? _cleanAlbumThumbKey(a.title, a.artist) : '';
      if (!sameId && (!aCk || aCk !== targetCk)) continue;
      const bothApple = a.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(a.thumb) && isAppleArtistThumb(thumb);
      const sameBase = Boolean(a.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(a.thumb, thumb));
      if (sameBase && /[?&]s=1200\b/.test(a.thumb)) continue;
      const allowApple = sameBase
        ? (/[?&]s=1200\b/.test(thumb) || /[?&]s=288\b/.test(a.thumb))
        : (/[?&]s=1200\b/.test(thumb) || /[?&]s=288\b/.test(a.thumb) || Boolean(id && a.id && String(a.id) === String(id)));
      if (a.thumb !== thumb && (!bothApple || allowApple)) {
        a.thumb = thumb;
        if (a.id && !bothApple && !sameBase && typeof ARTC !== 'undefined') delete ARTC[a.id];
        changed = true;
      }
    }
  }
  if (Array.isArray(targetRes.songs) && targetCk) {
    for (let i = 0; i < targetRes.songs.length; i++) {
      const s = targetRes.songs[i];
      if (!s) continue;
      const sAlb = s.albumTitle || (typeof s.album === 'string' ? s.album : '') || '';
      if (!sAlb) continue;
      if (typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(sAlb, s.title)) continue;
      const sCk = _cleanAlbumThumbKey(sAlb, s.artist);
      if (!sCk || sCk !== targetCk) continue;
      const bothApple = s.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(s.thumb) && isAppleArtistThumb(thumb);
      const sameBase = Boolean(s.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(s.thumb, thumb));
      if (sameBase && /[?&]s=1200\b/.test(s.thumb)) continue;
      const allowApple = sameBase
        ? (/[?&]s=1200\b/.test(thumb) || /[?&]s=288\b/.test(s.thumb))
        : !s.canonicalCover;
      if (s.thumb !== thumb && (!bothApple || allowApple) && (sameBase || !s.canonicalCover)) {
        targetRes.songs[i] = Object.assign({}, s, { thumb: thumb });
        if (s.id && !bothApple && !sameBase && typeof ARTC !== 'undefined') delete ARTC[s.id];
        changed = true;
      }
    }
  }
  return changed;
}
_searchCacheAlbumUpgradeHook = function(id, title, artist, thumb) {
  if (!thumb) return;
  thumb = _forceAppleListThumb(thumb);
  const seen = new Set();
  for (const v of _searchMemCache.values()) {
    if (v && !seen.has(v)) { seen.add(v); _upgradeResFromAlbum(v, id, title, artist, thumb); }
  }
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.res) {
    for (const k in LIVE.res) {
      const v = LIVE.res[k];
      if (v && !seen.has(v)) { seen.add(v); _upgradeResFromAlbum(v, id, title, artist, thumb); }
    }
  }
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.lastSearch && !seen.has(LIVE.lastSearch)) {
    _upgradeResFromAlbum(LIVE.lastSearch, id, title, artist, thumb);
  }
};
function _findLocalLyricSnippet(id, nq) {
  if (!id || !nq || nq.length < 4 || typeof LIVE === 'undefined') return '';
  const sources = [];
  if (LIVE.ly && LIVE.ly[id]) sources.push(LIVE.ly[id]);
  if (LIVE.offlineLy && LIVE.offlineLy[id]) sources.push(LIVE.offlineLy[id]);
  for (let s = 0; s < sources.length; s++) {
    const ly = sources[s];
    if (!ly || ly.loading || !Array.isArray(ly.lines) || !ly.lines.length) continue;
    for (let i = 0; i < ly.lines.length; i++) {
      const ln = ly.lines[i];
      if (ln && ln._placeholder) continue;
      const rawLine = (typeof ln === 'string' ? ln : (ln && typeof ln.text === 'string' ? ln.text : '')).trim();
      if (!rawLine || rawLine === window.t('lyrics.loading') || rawLine === window.t('lyrics.unavailable') || rawLine === 'Caricamento del testo…' || rawLine === 'Testo non disponibile') continue;
      const nl = _normSearch(rawLine);
      if (nl && nl.indexOf(nq) >= 0) {
        return '♪ «' + rawLine.slice(0, 60) + '»';
      }
    }
  }
  return '';
}
function _localSearchMatches(rawQ) {
  const nq = _normSearch(rawQ);
  if (!nq || nq.length < 2) return null;
  const songs = [], albums = [], artists = [], playlists = [];
  const seenS = new Set(), seenA = new Set(), seenR = new Set(), seenP = new Set();
  const match = (t, sub) => {
    const nt = _normSearch(t), ns = sub ? _normSearch(sub) : '';
    return nt.indexOf(nq) >= 0 || (ns && ns.indexOf(nq) >= 0);
  };
  const pushTrack = tr => {
    if (!tr || !tr.id || seenS.has(tr.id) || songs.length >= 8) return;
    if (match(tr.title, tr.artist)) {
      seenS.add(tr.id);
      const snippet = nq.length >= 4 ? _findLocalLyricSnippet(tr.id, nq) : '';
      songs.push(snippet ? Object.assign({}, tr, { _lyricMatch: snippet }) : tr);
    }
  };
  (LIVE.recent || []).forEach(pushTrack);
  favList().forEach(pushTrack);
  for (const k in LIVE.known) {
    if (songs.length >= 8) break;
    pushTrack(LIVE.known[k]);
  }
  if (nq.length >= 4 && songs.length < 8) {
    const lyIds = [];
    const lySeen = new Set();
    const collectKeys = map => {
      if (!map) return;
      const ks = Object.keys(map);
      for (let i = 0; i < ks.length; i++) {
        const id = ks[i];
        if (!lySeen.has(id)) { lySeen.add(id); lyIds.push(id); }
      }
    };
    collectKeys(LIVE.ly);
    collectKeys(LIVE.offlineLy);
    for (let i = 0; i < lyIds.length && songs.length < 8; i++) {
      const id = lyIds[i];
      if (seenS.has(id)) continue;
      const tr = (LIVE.known && LIVE.known[id]) ||
        (typeof BYID !== 'undefined' && BYID[id]) ||
        (LIVE.recent || []).find(x => x && x.id === id) ||
        favList().find(x => x && x.id === id);
      if (!tr || tr.kind) continue;
      const snippet = _findLocalLyricSnippet(id, nq);
      if (snippet) {
        seenS.add(id);
        songs.push(Object.assign({}, tr, { _lyricMatch: snippet }));
      }
    }
  }
  const pushItem = it => {
    if (!it || !it.id) return;
    if (it.kind === 'artist') {
      if (!seenR.has(it.id) && artists.length < 4 && match(it.title, '')) { seenR.add(it.id); artists.push(it); }
    } else if (it.kind === 'album') {
      if (!seenA.has(it.id) && albums.length < 4 && match(it.title, it.artist)) { seenA.add(it.id); albums.push(it); }
    } else if (it.kind === 'playlist') {
      if (!seenP.has(it.id) && playlists.length < 4 && match(it.title, it.artist)) { seenP.add(it.id); playlists.push(it); }
    }
  };
  PINS.forEach(pushItem);
  for (const k in BYID) pushItem(BYID[k]);
  if (!songs.length && !albums.length && !artists.length && !playlists.length) return null;
  return { songs, albums, artists, playlists, loading: true, _prelim: true };
}
function _mergeLyricTracksIntoRes(targetRes, lyTracks) {
  if (!targetRes || !Array.isArray(lyTracks) || !lyTracks.length) return false;
  if (!Array.isArray(targetRes.songs)) targetRes.songs = [];
  const byId = new Map();
  const byKey = new Map();
  for (let i = 0; i < targetRes.songs.length; i++) {
    const s = targetRes.songs[i];
    if (!s) continue;
    if (s.id) byId.set(String(s.id), i);
    const tk = _plRecTrackKey(s);
    if (tk && !byKey.has(tk)) byKey.set(tk, i);
  }
  let changed = false;
  let appended = 0;
  for (let i = 0; i < lyTracks.length; i++) {
    const tr = lyTracks[i];
    if (!tr || !tr.id) continue;
    const snippet = tr._lyricMatch || '';
    const tk = _plRecTrackKey(tr);
    const existingIdx = byId.has(String(tr.id)) ? byId.get(String(tr.id)) : (tk && byKey.has(tk) ? byKey.get(tk) : -1);
    if (existingIdx >= 0) {
      const existing = targetRes.songs[existingIdx];
      const coverPatch = _tryUpgradeSongEntry(existing, tr);
      const needsSnippet = Boolean(snippet && !existing._lyricMatch);
      if (coverPatch || needsSnippet) {
        const patch = coverPatch ? Object.assign({}, coverPatch) : {};
        if (needsSnippet) patch._lyricMatch = snippet;
        targetRes.songs[existingIdx] = Object.assign({}, existing, patch);
        changed = true;
      }
    } else if (appended < 4) {
      byId.set(String(tr.id), targetRes.songs.length);
      if (tk) byKey.set(tk, targetRes.songs.length);
      targetRes.songs.push(tr);
      appended++;
      changed = true;
    }
  }
  if (changed) delete targetRes._secOrder;
  return changed;
}
function liveSearch(q) {
  if (!LIVE.search) LIVE.search = { q: '', res: null };
  const rawQ = String(q || '').trim(), key = rawQ.toLowerCase();
  if (!key) {
    if (_searchAbort) { try { _searchAbort.abort(); } catch (e) {} _searchAbort = null; }
    if (_searchLyricsAbort) { try { _searchLyricsAbort.abort(); } catch (e) {} _searchLyricsAbort = null; }
    _searchInFlightKey = '';
    LIVE.search.q = '';
    LIVE.search.res = null;
    return;
  }
  LIVE.search.q = rawQ;
  const mem = _searchMemCache.get(key);
  if (mem) {
    if (_searchLyricsAbort) { try { _searchLyricsAbort.abort(); } catch (e) {} _searchLyricsAbort = null; }
    _syncResCoversFromKnown(mem);
    _setSearchMemCache(key, mem);
    _setLiveRes(key, mem);
    LIVE.search.res = mem;
    LIVE.lastSearch = mem;
    redraw();
    return;
  }
  const curRes = LIVE.res[key];
  if (curRes && !curRes.err && !curRes.loading && !curRes._prelim &&
      ((curRes.songs && curRes.songs.length) || (curRes.albums && curRes.albums.length) ||
       (curRes.artists && curRes.artists.length) || (curRes.playlists && curRes.playlists.length))) {
    if (_searchLyricsAbort) { try { _searchLyricsAbort.abort(); } catch (e) {} _searchLyricsAbort = null; }
    _syncResCoversFromKnown(curRes);
    _setSearchMemCache(key, curRes);
    LIVE.search.res = curRes;
    LIVE.lastSearch = curRes;
    redraw();
    return;
  }
  if (_searchInFlightKey === key && curRes && curRes.loading) return;
  if (_searchAbort) { try { _searchAbort.abort(); } catch (e) {} _searchAbort = null; }
  if (_searchLyricsAbort) { try { _searchLyricsAbort.abort(); } catch (e) {} _searchLyricsAbort = null; }
  const localPrelim = !LIVE.search.res || (curRes && curRes.loading) || (!curRes) ? _localSearchMatches(rawQ) : null;
  const localLyTracks = (localPrelim && Array.isArray(localPrelim.songs)) ? localPrelim.songs.filter(s => s && s._lyricMatch) : [];
  const initEntry = localPrelim || { loading: true };
  if (localPrelim) LIVE.search.res = localPrelim;
  _setLiveRes(key, initEntry);
  redraw();
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  _searchAbort = ctrl;
  _searchInFlightKey = key;
  const reqState = { lyTracks: null };
  api('/api/search?q=' + encodeURIComponent(rawQ) + '&limit=12', ctrl ? { signal: ctrl.signal } : undefined).then(d => {
    if (_searchAbort === ctrl) { _searchAbort = null; _searchInFlightKey = ''; }
    const res = {
      songs: (d.songs || []).map(ingestTrack).filter(Boolean),
      albums: (d.albums || []).map(ingestItem).filter(Boolean),
      artists: (d.artists || []).map(ingestItem).filter(Boolean),
      playlists: (d.playlists || []).map(ingestItem).filter(Boolean),
      topKind: d.topKind || null
    };
    if (localLyTracks.length) {
      _mergeLyricTracksIntoRes(res, localLyTracks);
    }
    if (reqState.lyTracks && reqState.lyTracks.length) {
      _mergeLyricTracksIntoRes(res, reqState.lyTracks);
    }
    _setSearchMemCache(key, res);
    _setLiveRes(key, res);
    LIVE.search.res = res;
    if (res.songs.length || res.albums.length || res.artists.length || res.playlists.length) LIVE.lastSearch = res;
    redraw();
  }).catch(e => {
    if (e && e.name === 'AbortError') return;
    if (_searchAbort === ctrl) { _searchAbort = null; _searchInFlightKey = ''; }
    _setLiveRes(key, { err: e.message });
    redraw();
  });

  const looksLikePhrase = rawQ.length >= 5 && (rawQ.split(/\s+/).length >= 2 || /^["'«].*["'»]$/.test(rawQ));
  if (looksLikePhrase) {
    const lyCtrl = typeof AbortController === 'function' ? new AbortController() : null;
    _searchLyricsAbort = lyCtrl;
    fetch('/api/lyrics_search?q=' + encodeURIComponent(rawQ), lyCtrl ? { signal: lyCtrl.signal } : undefined)
      .then(r => (r && r.ok ? r.json() : null))
      .then(d => {
        if (lyCtrl && lyCtrl.signal && lyCtrl.signal.aborted) return;
        if (_searchLyricsAbort === lyCtrl) _searchLyricsAbort = null;
        if (!LIVE.search || LIVE.search.q !== rawQ) return;
        const rawTracks = Array.isArray(d && d.tracks) ? d.tracks : [];
        if (!rawTracks.length) return;
        const lyTracks = [];
        for (let i = 0; i < rawTracks.length; i++) {
          const raw = rawTracks[i];
          const ingested = ingestTrack(raw);
          if (!ingested) continue;
          lyTracks.push(Object.assign({}, ingested, { _lyricMatch: raw.lyricSnippet || '' }));
        }
        if (!lyTracks.length) return;
        reqState.lyTracks = lyTracks;
        const curKeyRes = LIVE.res[key];
        if (curKeyRes && curKeyRes.loading && !curKeyRes.songs) {
          const prelim = { songs: [], albums: [], artists: [], playlists: [], loading: true, _prelim: true };
          _setLiveRes(key, prelim);
          LIVE.search.res = prelim;
        } else if (!LIVE.search.res) {
          const prelim = { songs: [], albums: [], artists: [], playlists: [], loading: true, _prelim: true };
          LIVE.search.res = prelim;
          if (curKeyRes && curKeyRes.loading) _setLiveRes(key, prelim);
        }
        let changed = false;
        const targetKeyRes = LIVE.res[key];
        if (targetKeyRes && targetKeyRes.songs) {
          if (_mergeLyricTracksIntoRes(targetKeyRes, lyTracks)) changed = true;
          if (LIVE.search.res && LIVE.search.res !== targetKeyRes && LIVE.search.res === LIVE.lastSearch) {
            LIVE.search.res = targetKeyRes;
          }
        }
        if (LIVE.search && LIVE.search.q === rawQ && LIVE.search.res && LIVE.search.res !== targetKeyRes && LIVE.search.res.songs) {
          if (_mergeLyricTracksIntoRes(LIVE.search.res, lyTracks)) changed = true;
        }
        const memEntry = _searchMemCache.get(key);
        if (memEntry && memEntry !== targetKeyRes && memEntry !== LIVE.search.res && memEntry.songs) {
          if (_mergeLyricTracksIntoRes(memEntry, lyTracks)) changed = true;
        }
        for (let i = 0; i < lyTracks.length; i++) _searchCacheUpgradeHook(lyTracks[i]);
        if (changed) redraw();
      })
      .catch(() => {
        if (_searchLyricsAbort === lyCtrl) _searchLyricsAbort = null;
      });
  }
}
function liveStation(s) {
  liveToast(window.t('toast.loading_station', { title: s[0] }));
  api('/api/search?q=' + encodeURIComponent(s[1]) + '&type=songs&limit=30').then(d => { const l = d.songs.map(ingestTrack).filter(Boolean); if (l.length) playShuffled(l); else liveToast(window.t('toast.no_songs_found')); }).catch(e => liveToast(window.t('toast.error_prefix', { msg: e.message })));
}

/* ── pagine live ── */
function _markSkelSeen(key) {
  if (typeof markSkelSeen === 'function') markSkelSeen(key);
}
function _drawLoadedWithFade(c, P, key, ySkel, skelFn, bodyFn) {
  const endY = (typeof drawSkelCrossfade === 'function')
    ? drawSkelCrossfade(c, P, key, ySkel, skelFn, bodyFn)
    : bodyFn(c);
  return end(endY);
}

/* ── Home in stile YouTube Music: chip, "Scelte rapide" a righe con pagine orizzontali, caroselli con copertine quadrate ── */
const _LIVE_CHIP_KEYS = ['energia', 'relax', 'workout', 'focus', 'romance', 'feelgood', 'party', 'commute', 'wellness', 'sad', 'sleep'];
const LIVE_CHIPS = _LIVE_CHIP_KEYS.map(k => [window.t('moods.' + k), window.t('moods.' + k + '_q')]);
let _liveChipWs = null;
function liveChip(q) { goTab('search'); NAV.query = q; $q.value = q; liveSearch(q); redraw(); }
function liveChips(c, P, y) {
  if (!_liveChipWs) {
    c.font = F(500, 15);
    _liveChipWs = LIVE_CHIPS.map(ch => Math.ceil(c.measureText(ch[0]).width) + 32);
  }
  const ws = _liveChipWs;
  return rail(c, P, 'chips', y, LIVE_CHIPS, 0, 10, 40, (c, ch, x, y, i) => {
    const w = ws[i], pk = 'lchip:' + ch[1];
    withPressScale(c, pk, x + w / 2, y + 18, () => {
      rrPath(c, x, y, w, 36, 18); c.fillStyle = pal.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.045)'; c.fill();
      drawRowPressTint(c, pk, x, y, w, 36, 18);
      c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.10)'; rrPath(c, x + .5, y + .5, w - 1, 35, 17.5); c.stroke();
      txt(c, ch[0], x + w / 2, y + 23.5, F(500, 15), pal.fg, 'center', w - 12);
    });
    hit(x, y, w, 36, () => liveChip(ch[1]), { pressKey: pk });
  }, { widths: ws });
}
/* "Scelte rapide": colonne da 4 righe (copertina, titolo, artista); si scorre a pagine e si vede l'inizio della colonna dopo */
function liveQuick(c, P, id, y, items) {
  const rows = 4, rh = 66, cw = W - 42, cols = Math.ceil(items.length / rows), groups = [];
  for (let i = 0; i < cols; i++) groups.push(items.slice(i * rows, i * rows + rows));
  return rail(c, P, id, y, groups, cw, 14, rows * rh, (c, g, x, y, ci) => {
    g.forEach((it, k) => {
      const ry = y + k * rh, tr = isTr(it), cu = tr && isCur(it);
      const pk = 'lq:' + id + ':' + ci + ':' + k + ':' + (it.id || '');
      drawRowPressTint(c, pk, x - 4, ry + 2, cw + 8, rh - 4, 12);
      drawArt(c, it, x, ry + 8, 50, 8); if (cu) { c.fillStyle = 'rgba(0,0,0,.32)'; rrPath(c, x, ry + 8, 50, 50, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.92)'; rrPath(c, x + 16, ry + 24, 18, 18, 4); c.fill(); icon(c, 'wave', x + 25, ry + 33, 12, '#111'); }
      txt(c, it.title, x + 64, ry + 31, F(500, 16), cu ? pal.accent : pal.fg, 'left', cw - 70); txt(c, subOf(it), x + 64, ry + 50, F(400, 14.5), pal.sub, 'left', cw - 70);
      hit(x, ry, cw, rh, () => { if (tr) playList(items, ci * rows + k); else open(it); }, { pressKey: pk });
    });
  }, { snap: cw + 14 }) + 6;
}
function liveShelf(c, P, id, y, title, items, sz) {
  y = section(c, P, y, title, 'big');
  const allTr = items.every(isTr), s = sz || (allTr ? 136 : 162);
  return rail(c, P, id, y + 6, items, s, 14, s + 56, (c, it, x, y) => card(c, it, x, y, s, it.kind === 'artist', 16)) + 16;
}
function artistSectionHead(c, P, y, titleText) {
  if (vis(P, y, 40)) {
    txt(c, titleText, 20, y + 26, F(600, 22), pal.fg, 'left', W - 40);
  }
  return y + 36;
}
function liveArtistPills(c, P, id, y, items) {
  const rows = 2, ph = 48, rGap = 8;
  const pw = Math.min(210, Math.max(172, Math.floor((W - 48) * 0.52)));
  const cols = Math.ceil(items.length / rows), groups = [];
  for (let i = 0; i < cols; i++) groups.push(items.slice(i * rows, i * rows + rows));
  return rail(c, P, id, y, groups, pw, 10, rows * ph + rGap, (c, g, x, y, ci) => {
    g.forEach((it, k) => {
      const ry = y + k * (ph + rGap);
      const pk = 'lap:' + id + ':' + ci + ':' + k + ':' + (it.id || '');
      if (vis(P, ry, ph)) {
        withPressScale(c, pk, x + pw / 2, ry + ph / 2, () => {
          rrPath(c, x, ry, pw, ph, ph / 2);
          c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)';
          c.fill();
          drawRowPressTint(c, pk, x, ry, pw, ph, ph / 2);
          c.lineWidth = 1;
          c.strokeStyle = pal.dark ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.08)';
          rrPath(c, x + .5, ry + .5, pw - 1, ph - 1, (ph - 1) / 2);
          c.stroke();
          drawArt(c, it, x + 4, ry + 4, 40, 20);
          txt(c, it.title, x + 52, ry + 21, F(600, 14), pal.fg, 'left', pw - 60);
          txt(c, window.t('common.artist'), x + 52, ry + 36, F(400, 11.5), pal.sub, 'left', pw - 60);
        });
      }
      hit(x, ry, pw, ph, () => open(it), { pressKey: pk });
    });
  }) + 14;
}
function liveArtistReleases(c, P, id, y, items) {
  const rows = 2, rh = 56, rGap = 8;
  const rw = Math.min(270, Math.max(220, W - 60));
  const cols = Math.ceil(items.length / rows), groups = [];
  for (let i = 0; i < cols; i++) groups.push(items.slice(i * rows, i * rows + rows));
  return rail(c, P, id, y, groups, rw, 10, rows * rh + rGap, (c, g, x, y, ci) => {
    g.forEach((it, k) => {
      const ry = y + k * (rh + rGap);
      const pk = 'lar:' + id + ':' + ci + ':' + k + ':' + (it.id || '');
      if (vis(P, ry, rh)) {
        withPressScale(c, pk, x + rw / 2, ry + rh / 2, () => {
          rrPath(c, x, ry, rw, rh, 12);
          c.fillStyle = pal.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.035)';
          c.fill();
          drawRowPressTint(c, pk, x, ry, rw, rh, 12);
          c.lineWidth = 1;
          c.strokeStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)';
          rrPath(c, x + .5, ry + .5, rw - 1, rh - 1, 11.5);
          c.stroke();
          drawArt(c, it, x + 6, ry + 6, 44, 8);
          const fallbackType = it.kind === 'album' ? window.t('common.album') : (it.typeKey === 'single' ? window.t('common.single') : window.t('common.single'));
          const sub = [it.type || fallbackType, it.year].filter(Boolean).join(' • ');
          txt(c, it.title, x + 58, ry + 24, F(600, 14.5), pal.fg, 'left', rw - 82);
          txt(c, sub || window.t('common.release'), x + 58, ry + 42, F(400, 12), pal.sub, 'left', rw - 82);
          icon(c, 'chev', x + rw - 14, ry + rh / 2, 13, pal.sub, { lw: 2 });
        });
      }
      hit(x, ry, rw, rh, () => open(it), { pressKey: pk });
    });
  }) + 16;
}
function getRediscoverClassics(maxCount) {
  const limit = maxCount || 12;
  const recentHead = new Set((LIVE.recent || []).slice(0, 6).map(x => x && x.id).filter(Boolean));
  const playCounts = Object.create(null);
  const recTrackFallback = Object.create(null);
  if (typeof REC_HIST !== 'undefined' && REC_HIST) {
    if (REC_HIST.months && typeof REC_HIST.months === 'object') {
      const mKeys = Object.keys(REC_HIST.months);
      for (let i = 0; i < mKeys.length; i++) {
        const m = REC_HIST.months[mKeys[i]];
        if (!m || !m.tracks || typeof m.tracks !== 'object') continue;
        const tKeys = Object.keys(m.tracks);
        for (let j = 0; j < tKeys.length; j++) {
          const e = m.tracks[tKeys[j]];
          if (!e || !e.id) continue;
          const p = e.plays || (e.sec > 30 ? 1 : 0);
          playCounts[e.id] = (playCounts[e.id] || 0) + p;
          if (!recTrackFallback[e.id]) recTrackFallback[e.id] = e;
        }
      }
    }
    if (REC_HIST.plays && typeof REC_HIST.plays === 'object') {
      const pKeys = Object.keys(REC_HIST.plays);
      for (let i = 0; i < pKeys.length; i++) {
        const id = pKeys[i];
        const val = REC_HIST.plays[id];
        const cnt = typeof val === 'number' ? val : (val && val.plays ? val.plays : 0);
        if (cnt > 0) playCounts[id] = Math.max(playCounts[id] || 0, cnt);
        if (val && typeof val === 'object' && val.id && !recTrackFallback[id]) recTrackFallback[id] = val;
      }
    }
  }
  const affTracks = (typeof AFFINITY !== 'undefined' && AFFINITY && AFFINITY.tracks) ? AFFINITY.tracks : {};
  const candIds = new Set();
  for (const id in playCounts) candIds.add(id);
  if (typeof PL !== 'undefined' && PL && PL.fav) {
    for (const id in PL.fav) if (PL.fav[id]) candIds.add(id);
  }
  if (typeof LIVE !== 'undefined' && LIVE && LIVE.known) {
    for (const id in LIVE.known) candIds.add(id);
  }
  for (const id in affTracks) candIds.add(id);

  const scored = [];
  candIds.forEach(id => {
    if (!id || recentHead.has(id)) return;
    const tr = (LIVE.known && LIVE.known[id]) || (typeof BYID !== 'undefined' && BYID[id]) || recTrackFallback[id];
    if (!tr || !tr.id || tr.kind || tr._local) return;
    if (typeof isTrackFrequentlySkipped === 'function' && isTrackFrequentlySkipped(tr)) return;
    const plays = playCounts[id] || 0;
    const comp = affTracks[id] ? (affTracks[id].c || 0) : 0;
    const isFav = !!(typeof PL !== 'undefined' && PL && PL.fav && PL.fav[id]);
    const eligible = isFav ? (plays >= 1 || comp >= 1) : (comp >= 2 || plays >= 2);
    if (!eligible) return;
    const aff = typeof getTrackAffinityScore === 'function' ? Math.max(0, getTrackAffinityScore(tr)) : 0;
    const score = comp * 3 + plays * 1.5 + (isFav ? 4 : 0) + aff * 0.5;
    scored.push({ tr, score });
  });

  scored.sort((a, b) => b.score - a.score);
  const out = [];
  const seenId = new Set();
  const seenKey = new Set();
  for (let i = 0; i < scored.length && out.length < limit; i++) {
    const tr = scored[i].tr;
    if (seenId.has(tr.id)) continue;
    const tk = typeof _plRecTrackKey === 'function' ? _plRecTrackKey(tr) : '';
    if (tk && seenKey.has(tk)) continue;
    seenId.add(tr.id);
    if (tk) seenKey.add(tk);
    out.push(tr);
  }
  return out;
}
if (typeof window !== 'undefined') window.getRediscoverClassics = getRediscoverClassics;
LIVEPAGES.home = (c, P) => {
  bigTitle(c, window.t('home.title')); let y = TOP + 56;
  if (!LIVE.home) {
    if (LIVE.homeErr) {
      liveStatus(c, y, window.t('home.load_error', { err: LIVE.homeErr }), liveHome);
      return end(y + 80);
    }
    _markSkelSeen('home');
    if (typeof drawHomeSkeleton === 'function') return end(drawHomeSkeleton(c, P, y));
    liveStatus(c, y, window.t('common.loading'));
    return end(y + 80);
  }
  return _drawLoadedWithFade(c, P, 'home', y, typeof drawHomeSkeleton === 'function' ? drawHomeSkeleton : null, (dc) => {
    let yy = y;
    LIVE.home.forEach((r, i) => {
      const quickTracks = r.items.filter(isTr);
      const isQuick = (r.sectionKey === 'quick_picks' || i === 0 || /scelte rapide|quick picks/i.test(r.title)) && quickTracks.length >= 4 &&
        (r.sectionKey === 'quick_picks' || /scelte rapide|quick picks/i.test(r.title) || r.items.every(isTr));
      const isTrend = (r.sectionKey === 'charts' || /in tendenza|trending|charts/i.test(r.title)) && quickTracks.length >= 4;
      const isSimilar = r.sectionKey === 'similar_artists' || r.type === 'similar_artists' || /^simile a|^similar to/i.test(r.title);
      const isReleases = r.sectionKey === 'artist_releases' || r.type === 'artist_releases' || /^altro da|^more from/i.test(r.title);

      if (isQuick || isTrend) {
        yy = section(dc, P, yy, r.title, 'big');
        yy = liveQuick(dc, P, 'h' + i, yy + 4, quickTracks.slice(0, 20)) + 14;
      } else if (isSimilar) {
        yy = artistSectionHead(dc, P, yy, r.title);
        yy = liveArtistPills(dc, P, 'h' + i, yy + 2, r.items) + 14;
      } else if (isReleases) {
        yy = artistSectionHead(dc, P, yy, r.title);
        yy = liveArtistReleases(dc, P, 'h' + i, yy + 2, r.items) + 16;
      } else {
        yy = liveShelf(dc, P, 'h' + i, yy, r.title, r.items);
      }
    });
    if (LIVE.recent && LIVE.recent.length) {
      yy = liveShelf(dc, P, 'recent', yy, window.t('home.recent'), LIVE.recent.slice(0, 12), 138);
    }
    const classics = typeof getRediscoverClassics === 'function' ? getRediscoverClassics(12) : [];
    if (classics.length >= 3) {
      yy = liveShelf(dc, P, 'classics', yy, window.t('home.forgotten'), classics, 138);
    }
    return yy;
  });
};

function moodPillsGrid(c, P, y, moods) {
  const cols = 2, gap = 12, cw = Math.floor((W - 40 - gap) / 2), ch = 54;
  moods.forEach((m, i) => {
    const x = 20 + (i % cols) * (cw + gap), ry = y + Math.floor(i / cols) * (ch + 10);
    const pk = 'mood:' + (m.id || m.title || i);
    if (vis(P, ry, ch)) {
      withPressScale(c, pk, x + cw / 2, ry + ch / 2, () => {
        rrPath(c, x, ry, cw, ch, 14);
        c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.045)'; c.fill();
        drawRowPressTint(c, pk, x, ry, cw, ch, 14);
        c.save(); rrPath(c, x, ry, cw, ch, 14); c.clip();
        c.fillStyle = hsl(m.hue || ((i * 47) % 360), 78, 54); c.fillRect(x, ry, 6, ch);
        c.restore();
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.07)'; rrPath(c, x + .5, ry + .5, cw - 1, ch - 1, 13.5); c.stroke();
        txt(c, m.title, x + 18, ry + 33, F(600, 15.5), pal.fg, 'left', cw - 28);
      });
    }
    hit(x, ry, cw, ch, () => openMood(m), { pressKey: pk });
  });
  return y + Math.ceil(moods.length / cols) * (ch + 10);
}
LIVEPAGES.new = (c, P) => {
  bigTitle(c, window.t('new_page.title')); let y = TOP + 74;
  if (!LIVE.charts) {
    if (!LIVE.chartsBusy && !LIVE.chartsErr) liveCharts();
    if (LIVE.chartsErr) {
      liveStatus(c, y, window.t('new_page.load_error', { err: LIVE.chartsErr }), () => { LIVE.chartsErr = null; liveCharts(); });
      return end(y + 80);
    }
    _markSkelSeen('new');
    if (typeof drawExploreSkeleton === 'function') return end(drawExploreSkeleton(c, P, y));
    liveStatus(c, y, window.t('common.loading'));
    return end(y + 80);
  }
  return _drawLoadedWithFade(c, P, 'new', y, typeof drawExploreSkeleton === 'function' ? drawExploreSkeleton : null, (dc) => {
    let yy = y;
    const ch = LIVE.charts;
    if (ch.albums && ch.albums.length) {
      yy = section(dc, P, yy, window.t('new_page.albums_singles'), 'big');
      const s = Math.min(176, Math.round((W - 54) * .46));
      yy = rail(dc, P, 'new_alb', yy + 6, ch.albums, s, 14, s + 58, (rc, it, x, ry) => {
        const pk = 'newalb:' + (it.id || '') + ':' + Math.round(x);
        withPressScale(rc, pk, x + s / 2, ry + s / 2, () => {
          drawArt(rc, it, x, ry, s, 16);
          drawRowPressTint(rc, pk, x, ry, s, s, 16);
          txt(rc, it.title, x, ry + s + 22, F(500, 16), pal.fg, 'left', s);
          txt(rc, it.artist || it.type || window.t('common.album'), x, ry + s + 42, F(400, 14.5), pal.sub, 'left', s);
        });
        hit(x, ry, s, s + 52, () => open(it), { pressKey: pk });
      }) + 18;
    }
    const hotTracks = (ch.trending && ch.trending.length ? ch.trending : ch.new_tracks || []).filter(isTr);
    if (hotTracks.length) {
      yy = section(dc, P, yy, window.t('new_page.top_tracks'), 'big');
      yy = liveQuick(dc, P, 'new_hot', yy + 4, hotTracks.slice(0, 20)) + 16;
    }
    const topSongs = (ch.songs && ch.songs.length ? ch.songs : ch.new_tracks || []).filter(isTr);
    if (topSongs.length) {
      yy = section(dc, P, yy, window.t('new_page.top_chart'), 'big');
      const l = topSongs.slice(0, 10);
      yy = songRows(dc, P, yy, l) + 18;
    }
    if (ch.artists && ch.artists.length) {
      yy = section(dc, P, yy, window.t('new_page.trending_artists'), 'big');
      yy = rail(dc, P, 'new_art', yy + 6, ch.artists, 146, 14, 204, (rc, it, x, ry) => card(rc, it, x, ry, 146, true)) + 16;
    }
    return yy;
  });
};

function radioCard(c, it, x, y, s) {
  const pk = 'radcard:' + (it.id || '') + ':' + Math.round(x) + ':' + Math.round(y);
  withPressScale(c, pk, x + s / 2, y + s / 2, () => {
    drawArt(c, it, x, y, s, 16);
    drawRowPressTint(c, pk, x, y, s, s, 16);
    txt(c, it.title, x, y + s + 22, F(500, 16), pal.fg, 'left', s);
    txt(c, window.t('common.playlist'), x, y + s + 42, F(400, 14.5), pal.sub, 'left', s);
  });
  hit(x, y, s, s + 52, () => open(it), { pressKey: pk });
}
function genreChips(c, P, y, cats) {
  c.font = F(600, 15.5);
  let x = 20, row = 0; const h = 40, gap = 10, pos = [];
  cats.forEach(m => { const w = Math.ceil(c.measureText(m.title).width) + 34; if (x + w > W - 20 && x > 20) { x = 20; row++; } pos.push([x, row, w]); x += w + gap; });
  cats.forEach((m, i) => {
    const [px, r, w] = pos[i], py = y + r * (h + gap), pk = 'gchip:' + (m.id || m.title || i);
    if (vis(P, py, h)) {
      const hu = m.hue != null ? m.hue : (i * 47) % 360;
      withPressScale(c, pk, px + w / 2, py + h / 2, () => {
        rrPath(c, px, py, w, h, h / 2);
        c.fillStyle = pal.dark ? hsl(hu, 55, 26) : hsl(hu, 70, 90); c.fill();
        drawRowPressTint(c, pk, px, py, w, h, h / 2);
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.06)'; rrPath(c, px + .5, py + .5, w - 1, h - 1, h / 2 - .5); c.stroke();
        txt(c, m.title, px + w / 2, py + 25.5, F(600, 15.5), pal.dark ? '#fff' : hsl(hu, 60, 24), 'center', w - 12);
      });
    }
    hit(px, py, w, h, () => openMood(m), { pressKey: pk });
  });
  return y + (pos.length ? pos[pos.length - 1][1] + 1 : 0) * (h + gap);
}
LIVEPAGES.radio = (c, P) => {
  bigTitle(c, window.t('radio.title')); let y = TOP + 74;
  if (!LIVE.radioFeed) {
    if (!LIVE.radioFeedBusy && !LIVE.radioFeedErr) liveRadio();
    if (LIVE.radioFeedErr) {
      liveStatus(c, y, window.t('radio.load_error', { err: LIVE.radioFeedErr }), () => { LIVE.radioFeedErr = null; liveRadio(); });
      return end(y + 80);
    }
    _markSkelSeen('radio');
    if (typeof drawRadioSkeleton === 'function') return end(drawRadioSkeleton(c, P, y));
    liveStatus(c, y, window.t('radio.loading_feed'));
    return end(y + 80);
  }
  return _drawLoadedWithFade(c, P, 'radio', y, typeof drawRadioSkeleton === 'function' ? drawRadioSkeleton : null, (dc) => {
    let yy = y;
    const rf = LIVE.radioFeed, s = Math.min(172, Math.round((W - 54) * .45));
    rf.sections.forEach((sec, idx) => {
      if (vis(P, yy, 56)) {
        eyebrow(dc, sec.eyebrow || window.t('radio.moods_eyebrow'), 20, yy + 14, pal.sub);
        txt(dc, sec.title, 20, yy + 42, F(700, 26), pal.fg, 'left', W - 40);
      }
      hit(20, yy, W - 40, 50, () => openMood({ title: sec.title, params: sec.params }));
      yy += 54;
      yy = rail(dc, P, 'rad_' + idx, yy, sec.items, s, 14, s + 58, (rc, it, x, ry) => radioCard(rc, it, x, ry, s)) + 18;
    });
    if (rf.categories && rf.categories.length) {
      yy = section(dc, P, yy, window.t('radio.explore_genres'), 'big') + 4;
      yy = genreChips(dc, P, yy, rf.categories) + 12;
    }
    return yy;
  });
};
LIVEPAGES.mood = (c, P) => {
  let y = listTop() + 6; const d = P.data;
  const moodSkelKey = 'mood:' + (d.id || d.title || 'm');
  if (d.loading) {
    _markSkelSeen(moodSkelKey);
    if (typeof drawAlbumsSkeleton === 'function') return end(drawAlbumsSkeleton(c, P, y, 6));
    liveStatus(c, y + 20, window.t('radio.loading_mood', { title: d.title }));
    return end(y + 120);
  }
  if (d.err) { liveStatus(c, y + 20, window.t('toast.error_prefix', { msg: d.err }), () => openMood(d)); return end(y + 120); }
  const items = d.items || [];
  if (!items.length) { txt(c, window.t('radio.no_playlists'), W / 2, y + 50, F(500, 16), pal.sub, 'center'); return end(y + 100); }
  return _drawLoadedWithFade(
    c,
    P,
    moodSkelKey,
    y,
    typeof drawAlbumsSkeleton === 'function' ? (sc, PP, sy) => drawAlbumsSkeleton(sc, PP, sy, 6) : null,
    (dc) => {
      const s = Math.floor((W - 40 - 16) / 2);
      items.forEach((it, i) => {
        const x = 20 + (i % 2) * (s + 16), yy = y + Math.floor(i / 2) * (s + 64);
        if (vis(P, yy, s + 62)) radioCard(dc, it, x, yy, s);
      });
      return y + Math.ceil(items.length / 2) * (s + 64);
    }
  );
};

const LIB_FILTERS = [
  ['all', window.t('library.filter_all')],
  ['playlist', window.t('library.filter_playlists')],
  ['artist', window.t('library.filter_artists')],
  ['album', window.t('library.filter_albums')],
  ['fav', window.t('library.filter_favorites')]
];
const LIB_SORTS = [
  ['recent', window.t('library.sort_recent_open')],
  ['alpha', window.t('library.sort_alpha')],
  ['added', window.t('library.sort_recent_added')]
];
function _syncLiveLocaleArrays() {
  for (let i = 0; i < _LIVE_CHIP_KEYS.length; i++) {
    const k = _LIVE_CHIP_KEYS[i];
    LIVE_CHIPS[i][0] = window.t('moods.' + k);
    LIVE_CHIPS[i][1] = window.t('moods.' + k + '_q');
  }
  const fKeys = { all: 'library.filter_all', playlist: 'library.filter_playlists', artist: 'library.filter_artists', album: 'library.filter_albums', fav: 'library.filter_favorites' };
  for (let i = 0; i < LIB_FILTERS.length; i++) {
    const fk = fKeys[LIB_FILTERS[i][0]];
    if (fk) LIB_FILTERS[i][1] = window.t(fk);
  }
  const sKeys = { recent: 'library.sort_recent_open', alpha: 'library.sort_alpha', added: 'library.sort_recent_added' };
  for (let i = 0; i < LIB_SORTS.length; i++) {
    const sk = sKeys[LIB_SORTS[i][0]];
    if (sk) LIB_SORTS[i][1] = window.t(sk);
  }
}
const _liveCanLS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
const _libCollator = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function' ? new Intl.Collator() : null;
let _libFilterWs = null;
let _libAutoCache = { sig: '', data: null };
let _libListCache = { sig: '', curF: '', sIdx: -1, lqLow: '', list: null };
function _getLibSig() {
  let favCnt = 0;
  for (const k in PL.fav) if (PL.fav[k] && LIVE.known[k]) favCnt++;
  const uLen = LIVE.userPlaylists ? LIVE.userPlaylists.length : 0;
  const rLen = LIVE.recent ? LIVE.recent.length : 0;
  const sLen = LIVE.saved ? LIVE.saved.length : 0;
  return _libVersion + '|' + PINS.length + '|' + favCnt + '|' + uLen + '|' + rLen + '|' + sLen;
}
function libAutoItems() {
  const sig = _getLibSig();
  if (_libAutoCache.data && _libAutoCache.sig === sig) return _libAutoCache.data;
  const seen = new Set(PINS.map(p => p.id)), albums = [], artists = [], playlists = [];
  PINS.forEach(p => {
    if (p.kind === 'playlist') playlists.push(p);
    else if (p.kind === 'artist') artists.push(p);
    else if (p.kind === 'album') albums.push(p);
  });
  (LIVE.userPlaylists || []).forEach(pl => {
    if (!seen.has(pl.id)) {
      seen.add(pl.id);
      playlists.push(pl);
    }
  });
  const pool = favList().concat(LIVE.recent || []).concat(LIVE.saved || []);
  const trThumbs = new Set(pool.map(t => t && t.thumb).filter(Boolean));
  pool.forEach(t => {
    if (t.album && t.album.indexOf('s_') !== 0 && BYID[t.album] && !seen.has(t.album)) {
      seen.add(t.album); albums.push(BYID[t.album]);
    }
    if (t.artistId && !seen.has(t.artistId)) {
      seen.add(t.artistId);
      let ar = BYID[t.artistId];
      if (!ar) {
        ar = BYID[t.artistId] = { kind: 'artist', id: t.artistId, title: t.artist.split(',')[0].trim(), hue: t.hue, style: t.style, thumb: t.artistThumb || null };
      } else if (ar.thumb && trThumbs.has(ar.thumb) && ar.thumb !== t.artistThumb) {
        ar.thumb = t.artistThumb || null;
        delete ARTC[ar.id];
      } else if (!ar.thumb && t.artistThumb) {
        ar.thumb = t.artistThumb;
      }
      if (!ar.thumb) liveArtistThumb(ar);
      artists.push(ar);
    }
  });
  const data = { playlists, artists, albums, all: PINS.concat(playlists.filter(p => !isPinned(p)), albums.filter(a => !isPinned(a)), artists.filter(a => !isPinned(a))) };
  _libAutoCache = { sig, data };
  return data;
}
function libBadgeRow(c, P, y, bgCol, icoCol, ico, title, sub, fn) {
  const h = 68, pk = 'libbadge:' + title;
  if (vis(P, y, h)) {
    drawRowPressTint(c, pk, 12, y + 2, W - 24, h - 4, 14);
    rrPath(c, 20, y + 8, 52, 52, 14); c.fillStyle = bgCol; c.fill();
    icon(c, ico, 46, y + 34, 22, icoCol, { lw: 2 });
    txt(c, title, 88, y + (sub ? 31 : 40), F(500, 17), pal.fg, 'left', W - 116);
    if (sub) txt(c, sub, 88, y + 51, F(400, 14), pal.sub, 'left', W - 116);
  }
  hit(0, y, W, h, fn, { pressKey: pk });
  return y + h;
}
const _libChipAnim = { x: null, w: null, t: 0 };
const _libContAnim = { key: null, t0: 0, sortIdx: null, sortT0: 0 };
LIVEPAGES.library = (c, P) => {
  const sig = _getLibSig();
  const auto = libAutoItems(), fav = favList(), sav = LIVE.saved || [], loc = LIVE.localFiles || [];
  const totalCount = 2 + (fav.length ? 1 : 0) + (LIVE.recent.length ? 1 : 0) + auto.all.length;
  let y = TOP + 58;
  if (vis(P, TOP, 72)) {
    const tp = tbP(P);
    c.save(); c.globalAlpha *= clamp(1 - tp * 1.8, 0, 1);
    txt(c, window.tPlural(totalCount, 'library.item_one', 'library.item_many'), 20, y, F(400, 14.5), pal.sub);
    c.restore();
  }
  y += 16;
  const curF = NAV.libFilter || 'all';
  if (typeof drawTintedFilterChips === 'function') {
    y = drawTintedFilterChips(c, P, y, 'lib_f', LIB_FILTERS, curF, _libChipAnim, 'lib_chip', id => {
      if (NAV.libFilter !== id) {
        NAV.libFilter = id;
        P.scroll = 0;
        redraw();
      }
    }) + 14;
  } else {
    if (!_libFilterWs) {
      c.font = F(600, 14.5);
      _libFilterWs = LIB_FILTERS.map(f => Math.ceil(c.measureText(f[1]).width) + 36);
    }
    const ws = _libFilterWs;
    const posX = [];
    { let ex = 20; for (let i = 0; i < ws.length; i++) { posX.push(ex); ex += ws[i] + 8; } }
    const chipY = y;
    y = rail(c, P, 'lib_f', y, LIB_FILTERS, 0, 8, 38, (c, f, x, ry, i) => {
      const w = ws[i], pk = 'lib_chip:' + f[0];
      withPressScale(c, pk, x + w / 2, ry + 18, () => {
        rrPath(c, x, ry, w, 36, 18);
        c.fillStyle = pal.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.045)'; c.fill();
        drawRowPressTint(c, pk, x, ry, w, 36, 18);
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.10)';
        rrPath(c, x + .5, ry + .5, w - 1, 35, 17.5); c.stroke();
        txt(c, f[1], x + w / 2, ry + 23, F(500, 14.5), pal.fg, 'center');
      });
      hit(x, ry, w, 36, () => {
        if (NAV.libFilter !== f[0]) {
          NAV.libFilter = f[0];
          P.scroll = 0;
          redraw();
        }
      }, { pressKey: pk });
    }, { widths: ws }) + 14;
    {
      const now = performance.now();
      const selIdx = Math.max(0, LIB_FILTERS.findIndex(f => f[0] === curF));
      const tgX = posX[selIdx], tgW = ws[selIdx];
      const dt = _libChipAnim.t ? clamp((now - _libChipAnim.t) / 1000, 0.001, 0.05) : 0.016;
      _libChipAnim.t = now;
      if (_libChipAnim.x == null) { _libChipAnim.x = tgX; _libChipAnim.w = tgW; }
      else if (Math.abs(_libChipAnim.x - tgX) > 0.35 || Math.abs(_libChipAnim.w - tgW) > 0.35) {
        _libChipAnim.x = ease(_libChipAnim.x, tgX, 20, dt);
        _libChipAnim.w = ease(_libChipAnim.w, tgW, 20, dt);
        if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
        else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
      } else { _libChipAnim.x = tgX; _libChipAnim.w = tgW; }
      if (vis(P, chipY, 38)) {
        const rx = (P.rails && P.rails.lib_f) ? P.rails.lib_f.x : 0;
        const scPill = typeof pressScale === 'function' ? pressScale('lib_chip:' + curF) : 1;
        c.save();
        c.beginPath(); c.rect(0, chipY - 4, W, 46); c.clip();
        c.translate(-rx, 0);
        const px = _libChipAnim.x, pw = _libChipAnim.w;
        if (scPill !== 1) { c.translate(px + pw / 2, chipY + 18); c.scale(scPill, scPill); c.translate(-(px + pw / 2), -(chipY + 18)); }
        rrPath(c, px, chipY, pw, 36, 18);
        c.fillStyle = pal.dark ? '#ffffff' : '#111111'; c.fill();
        c.clip();
        for (let i = 0; i < LIB_FILTERS.length; i++) {
          txt(c, LIB_FILTERS[i][1], posX[i] + ws[i] / 2, chipY + 23, F(600, 14.5), pal.dark ? '#000000' : '#ffffff', 'center');
        }
        c.restore();
      }
    }
  }

  const sIdx = NAV.libSortIdx || 0, sLabel = LIB_SORTS[sIdx][1];
  const nowLib = performance.now();
  const modeKey = curF + '|' + (NAV.libGrid ? 1 : 0) + '|' + sIdx;
  if (_libContAnim.key == null) _libContAnim.key = modeKey;
  else if (_libContAnim.key !== modeKey) { _libContAnim.key = modeKey; _libContAnim.t0 = nowLib; }
  if (_libContAnim.sortIdx == null) _libContAnim.sortIdx = sIdx;
  else if (_libContAnim.sortIdx !== sIdx) { _libContAnim.sortIdx = sIdx; _libContAnim.sortT0 = nowLib; }
  const sortP = _libContAnim.sortT0 ? clamp((nowLib - _libContAnim.sortT0) / 160, 0, 1) : 1;
  if (sortP < 1) {
    if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
    else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  }
  if (vis(P, y, 30)) {
    const spE = sortP * (2 - sortP);
    c.save();
    if (sortP < 1) { c.globalAlpha *= (0.25 + 0.75 * spE); c.translate(0, 4 * (1 - spE)); }
    drawRowPressTint(c, 'lib_sort', 16, y - 2, 210, 28, 10);
    icon(c, 'sort', 28, y + 12, 14, pal.sub, { lw: 2 });
    if (_liveCanLS) c.letterSpacing = '.5px';
    txt(c, sLabel, 44, y + 16.5, F(500, 13.5), pal.sub);
    if (_liveCanLS) c.letterSpacing = '0px';
    c.restore();
  }
  hit(16, y - 4, 210, 32, () => { NAV.libSortIdx = ((NAV.libSortIdx || 0) + 1) % LIB_SORTS.length; redraw(); }, { pressKey: 'lib_sort' });
  y += 30;

  const lq = (P.libQ || '').trim(), lqLow = lq.toLowerCase();
  if (vis(P, y, 52)) {
    rrPath(c, 20, y, W - 40, 44, 14);
    c.fillStyle = pal.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.055)'; c.fill();
    icon(c, 'search', 42, y + 22, 18, pal.sub, { lw: 2.2 });
    if (lq) {
      txt(c, lq, 64, y + 27.5, F(400, 16), pal.fg, 'left', W - 116);
      c.fillStyle = pal.sub2; c.beginPath(); c.arc(W - 42, y + 22, 9, 0, 7); c.fill();
      icon(c, 'x', W - 42, y + 22, 8.5, pal.dark ? '#000' : '#fff', { lw: 3 });
    } else {
      txt(c, window.t('library.search_placeholder'), 64, y + 27.5, F(400, 16), pal.sub, 'left', W - 94);
    }
    if (P.libQOpen && NAV.focus && performance.now() % 1000 < 520) {
      c.font = F(400, 16); const cx = 64 + (lq ? Math.min(c.measureText(lq).width, W - 116) : 0);
      c.fillStyle = pal.fg; c.fillRect(cx + 1, y + 12, 2, 20);
    }
  }
  if (lq) hit(W - 64, y, 44, 44, () => { P.libQ = ''; $q.value = ''; redraw(); });
  hit(20, y, W - (lq ? 84 : 40), 44, () => { P.libQOpen = true; $q.value = P.libQ || ''; NAV.focus = true; $q.focus(); INP.focusPending = true; redraw(); });
  y += 58;

  const contP = _libContAnim.t0 ? clamp((nowLib - _libContAnim.t0) / 180, 0, 1) : 1;
  const contE = contP * (2 - contP);
  if (contP < 1) {
    if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
    else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  }
  else if (_libContAnim.t0) _libContAnim.t0 = 0;

  c.save();
  if (contP < 1) {
    c.globalAlpha *= (0.15 + 0.85 * contE);
    c.translate(0, 6 * (1 - contE));
  }

  const matchQ = s => !lqLow || String(s || '').toLowerCase().includes(lqLow);

  if (curF === 'fav') {
    let fl;
    if (_libListCache.list && _libListCache.sig === sig && _libListCache.curF === curF && _libListCache.lqLow === lqLow) {
      fl = _libListCache.list;
    } else {
      fl = lqLow ? fav.filter(t => matchQ(t.title + ' ' + t.artist)) : fav;
      _libListCache = { sig, curF, sIdx, lqLow, list: fl };
    }
    if (!fl.length) txt(c, lq ? window.t('library.no_fav_match', { q: lq }) : window.t('library.no_fav'), W / 2, y + 48, F(400, 15.5), pal.sub, 'center');
    else y = songRows(c, P, y, fl);
    c.restore();
    return end(y + (NAV.focus ? KBH : 0));
  }

  if (curF === 'all') {
    const rows = [];
    if (matchQ(window.t('library.recap_keywords'))) {
      rows.push({ ico: 'stats', col: '#fa2e49', title: window.t('library.recap_title'), sub: fmtYmLabel(curYmKey(0)).split(' ')[0], fn: () => push('stats', { title: window.t('library.recap_title') }) });
    }
    if (matchQ(window.t('library.local_files_sub'))) rows.push({ ico: 'folder', col: '#34c759', title: window.t('library.local_files_sub'), sub: loc.length ? String(loc.length) : '', fn: () => { if (loc.length) push('songs', { title: window.t('library.local_files_sub'), list: loc, canImport: true }); else pickLocalAudio(); } });
    if (matchQ(window.t('library.downloads_sub'))) rows.push({ ico: 'down', col: '#0a84ff', title: window.t('library.downloads_sub'), sub: sav.length ? String(sav.length) : '', fn: () => push('songs', { title: window.t('library.downloads_sub'), list: sav }) });
    if (matchQ(window.t('library.fav_title'))) rows.push({ ico: 'star', col: '#ff375f', title: window.t('library.fav_title'), sub: fav.length ? String(fav.length) : '', fn: () => push('songs', { title: window.t('common.favorites'), list: favList() }) });
    if (matchQ(window.t('library.recent_title'))) rows.push({ ico: 'clock', col: '#bf5af2', title: window.t('library.recent_title'), sub: LIVE.recent.length ? String(LIVE.recent.length) : '', fn: () => push('songs', { title: window.t('common.recent'), list: LIVE.recent.slice() }) });
    if (rows.length) {
      const rh = 58, gh = rows.length * rh, gx = 20, gw = W - 40;
      if (vis(P, y, gh)) {
        c.save();
        rrPath(c, gx, y, gw, gh, 18); c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(120,120,128,.10)'; c.fill();
        c.clip();
        rows.forEach((r, i) => {
          const ry = y + i * rh, bx = gx + 14, by = ry + (rh - 34) / 2;
          drawRowPressTint(c, 'lib_in:' + r.title, gx, ry, gw, rh, 0);
          const g = c.createLinearGradient(bx, by, bx, by + 34); g.addColorStop(0, r.col); g.addColorStop(1, r.col + 'cc');
          rrPath(c, bx, by, 34, 34, 9); c.fillStyle = g; c.fill();
          icon(c, r.ico, bx + 17, by + 17, 19, '#fff', { lw: 2 });
          txt(c, r.title, gx + 62, ry + rh / 2 + 6, F(500, 17), pal.fg, 'left', gw - 62 - 70);
          icon(c, 'chev', gx + gw - 22, ry + rh / 2, 11, pal.sub2, { lw: 3 });
          if (r.sub) txt(c, r.sub, gx + gw - 38, ry + rh / 2 + 5.5, F(400, 15.5), pal.sub, 'right');
          if (i < rows.length - 1) { c.fillStyle = pal.sep; c.fillRect(gx + 62, ry + rh - .5, gw - 62, .5); }
        });
        c.restore();
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'; rrPath(c, gx + .5, y + .5, gw - 1, gh - 1, 17.5); c.stroke();
      }
      rows.forEach((r, i) => hit(gx, y + i * rh, gw, rh, r.fn, { pressKey: 'lib_in:' + r.title }));
      y += gh;
    }
  }

  let list;
  if (_libListCache.list && _libListCache.sig === sig && _libListCache.curF === curF && _libListCache.sIdx === sIdx && _libListCache.lqLow === lqLow) {
    list = _libListCache.list;
  } else {
    const base = curF === 'playlist' ? auto.playlists : curF === 'artist' ? auto.artists : curF === 'album' ? auto.albums : auto.all;
    list = lqLow ? base.filter(it => matchQ(it.title + ' ' + (it.artist || ''))) : base;
    if (sIdx === 1) {
      list = list.slice().sort(_libCollator
        ? (a, b) => _libCollator.compare(a.title || '', b.title || '')
        : (a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sIdx === 2) {
      list = list.slice().reverse();
    }
    _libListCache = { sig, curF, sIdx, lqLow, list };
  }

  if (curF === 'playlist' || curF === 'all') {
    y += 18;
    const bw = W - 40, bh = 46, bx = 20, pk = 'newPlaylistBtn';
    if (vis(P, y, bh)) {
      withPressScale(c, pk, bx + bw / 2, y + bh / 2, () => {
        rrPath(c, bx, y, bw, bh, 14);
        c.fillStyle = pal.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.045)';
        c.fill();
        drawRowPressTint(c, pk, bx, y, bw, bh, 14);
        c.lineWidth = 1;
        c.strokeStyle = pal.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
        rrPath(c, bx + .5, y + .5, bw - 1, bh - 1, 13.5);
        c.stroke();
        txt(c, window.t('prompt.new_playlist_btn'), W / 2, y + 29, F(600, 15.5), pal.accent, 'center');
      });
    }
    hit(0, y - 6, W, bh + 12, () => {
      showPromptModal({
        title: window.t('prompt.new_playlist_title'),
        placeholder: window.t('prompt.playlist_placeholder'),
        confirmText: window.t('prompt.create'),
        onConfirm: title => {
          if (!title || !title.trim()) return;
          const pl = createUserPlaylist(title.trim());
          if (pl && typeof open === 'function') open(pl);
        }
      });
    }, { tag: 'newPlaylistBtn', pressKey: pk });
    y += bh + 6;
  }

  if (list.length) {
    y += 16;
    y = section(c, P, y, curF === 'artist' ? window.t('common.artists') : curF === 'album' ? window.t('common.albums') : curF === 'playlist' ? window.t('common.playlists') : window.t('library.sort_recent_added'));
    if (NAV.libGrid) {
      y = grid2(c, P, y, list, true);
    } else {
      const lo = Math.max(0, Math.floor((P.scroll - 30 - y) / 64));
      const hi = Math.min(list.length, Math.ceil((P.scroll + H + 30 - y) / 64));
      for (let i = lo; i < hi; i++) {
        const it = list[i];
        const sub = it.kind === 'artist' ? window.t('common.artist') : it.kind === 'playlist' ? (window.t('common.playlist') + (it.artist ? ' · ' + it.artist : '')) : [it.artist, it.year].filter(Boolean).join(' · ') || window.t('common.album');
        liveRow(c, P, y + i * 64, it, sub, it.kind === 'artist');
      }
      y += list.length * 64;
    }
  } else if (curF !== 'all') {
    txt(c, curF === 'playlist' ? (lq ? window.t('library.empty_playlists_search') : window.t('library.empty_playlists_none')) : window.t('library.empty_category'), W / 2, y + 48, F(400, 15.5), pal.sub, 'center');
    y += 80;
  }
  c.restore();
  return end(y + (NAV.focus ? KBH : 0));
};

LIVEPAGES.stats = (c, P) => drawMonthlyRecapPage(c, P);

function liveRow(c, P, y, it, sub, round) {
  const pk = 'liverow:' + (it && it.id ? it.id : '') + ':' + Math.round(y);
  if (vis(P, y, 64)) {
    drawRowPressTint(c, pk, 12, y + 2, W - 24, 60, 14);
    drawArt(c, it, 24, y + 8, 48, round ? 24 : 8); txt(c, it.title, 84, y + (sub ? 28 : 38), F(500, 16.5), pal.fg, 'left', W - 124);
    if (sub) txt(c, sub, 84, y + 48, F(400, 14), pal.sub, 'left', W - 124);
    icon(c, 'chev', W - 32, y + 32, 12, pal.sub2, { lw: 3.2 });
    hit(0, y, W, 64, () => open(it), { pressKey: pk });
  }
  return y + 64;
}
function _normSearch(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function _searchSectionOrder(q, r) {
  if (r && r._secOrder && r._secOrderQ === q) return r._secOrder;
  const nq = _normSearch(q);
  let order;
  if (!nq) {
    order = ['songs', 'artists', 'albums', 'playlists'];
  } else if (r && r.topKind) {
    if (r.topKind === 'artists' && r.artists && r.artists.length) order = ['artists', 'songs', 'albums', 'playlists'];
    else if (r.topKind === 'albums' && r.albums && r.albums.length) order = ['albums', 'songs', 'artists', 'playlists'];
    else order = ['songs', 'artists', 'albums', 'playlists'];
  } else {
    const scoreTitle = (title, sub) => {
      const nt = _normSearch(title), ns = _normSearch(sub);
      if (!nt) return 0;
      if (nt === nq) return 100;
      if (nt.indexOf(nq + ' ') === 0 || nt.indexOf(nq) === 0) return 85 - Math.min(20, (nt.length - nq.length) * .8);
      if ((' ' + nt + ' ').indexOf(' ' + nq + ' ') >= 0) return 72;
      if (nt.indexOf(nq) >= 0) return 55;
      if (ns && (ns === nq || (' ' + ns + ' ').indexOf(' ' + nq + ' ') >= 0)) return 48;
      return 10;
    };
    const topArtist = r.artists && r.artists[0] ? scoreTitle(r.artists[0].title, '') + 6 : -1;
    const topSong = r.songs && r.songs[0] ? scoreTitle(r.songs[0].title, r.songs[0].artist) : -1;
    const topAlbum = r.albums && r.albums[0] ? scoreTitle(r.albums[0].title, r.albums[0].artist) - 2 : -1;
    if (topArtist >= 80 && topArtist >= topSong) order = ['artists', 'songs', 'albums', 'playlists'];
    else if (topAlbum >= 95 && topAlbum > topSong && topAlbum > topArtist) order = ['albums', 'songs', 'artists', 'playlists'];
    else order = ['songs', 'artists', 'albums', 'playlists'];
  }
  if (r) { r._secOrderQ = q; r._secOrder = order; }
  return order;
}
LIVEPAGES.search = (c, P) => {
  const q = NAV.query.trim(); let y = TOP + 10;
  if (!q) return drawSearchEmpty(c);
  y = searchFilters(c, P, y);
  const f = NAV.sFilter || 'all';
  const key = q.toLowerCase();
  const r0 = LIVE.res[key], loading = !r0 || r0.loading;
  if (!r0 && (_searchMemCache.has(key) || performance.now() > _searchPendingInput)) liveSearch(q);
  const hasPrelim = Boolean(r0 && r0._prelim && (r0.songs.length || r0.albums.length || r0.artists.length || r0.playlists.length));
  const localSnap = (!r0 && !LIVE.lastSearch) ? _localSearchMatches(q) : null;
  const r = hasPrelim ? r0 : (loading && LIVE.lastSearch) ? LIVE.lastSearch : (localSnap || r0);
  if (!r || (r.loading && !r._prelim)) { liveStatus(c, y + 32, window.t('search.searching', { q })); return end(y + 120); }
  if (r.err) { liveStatus(c, y + 32, window.t('search.failed', { err: r.err }), () => { delete LIVE.res[key]; liveSearch(q); }); return end(y + 130); }
  if (!r.songs.length && !r.albums.length && !r.artists.length && !r.playlists.length) { txt(c, window.t('search.no_results', { q }), W / 2, y + 60, F(600, 17), pal.fg, 'center', W - 40); return end(y + 120); }
  c.save(); if (loading) c.globalAlpha *= (hasPrelim || localSnap ? .78 : .55);
  const secs = f === 'all' ? _searchSectionOrder(q, r) : [f];
  secs.forEach(sec => {
    if (sec === 'songs' && r.songs.length) {
      y = searchHead(c, P, y, window.t('common.songs'));
      const nSongs = f === 'all' ? Math.min(8, r.songs.length) : r.songs.length;
      const loS = Math.max(0, Math.floor((P.scroll - 30 - y) / 64));
      const hiS = Math.min(nSongs, Math.ceil((P.scroll + H + 30 - y) / 64));
      for (let i = loS; i < hiS; i++) {
        songRow(c, P, y + i * 64, r.songs[i], r.songs, i, { noSep: true, single: true });
      }
      y += nSongs * 64 + 14;
    } else if (sec === 'artists' && r.artists.length) {
      y = searchHead(c, P, y, window.t('common.artists'));
      (f === 'all' ? r.artists.slice(0, 3) : r.artists).forEach(a => { y = liveRow(c, P, y, a, window.t('common.artist'), true); });
      y += 14;
    } else if (sec === 'albums' && r.albums.length) {
      y = searchHead(c, P, y, window.t('common.albums'));
      (f === 'all' ? r.albums.slice(0, 4) : r.albums).forEach(a => { y = liveRow(c, P, y, a, [a.artist, a.year].filter(Boolean).join(' · ')); });
      y += 14;
    } else if (sec === 'playlists' && r.playlists.length) {
      y = searchHead(c, P, y, window.t('common.playlists'));
      (f === 'all' ? r.playlists.slice(0, 4) : r.playlists).forEach(p => { y = liveRow(c, P, y, p, p.artist); });
      y += 14;
    }
  });
  c.restore();
  return end(y + (NAV.focus ? KBH : 0));
};

let liveTimer = 0;
$q.addEventListener('input', () => {
  if (!LIVE.on) return;
  const P = topPage(); if ((hasPill(P) && P.qOpen) || (NAV.tab === 'library' && stackOf().length === 1 && P.libQOpen)) return;
  clearTimeout(liveTimer);
  _searchPendingInput = performance.now() + 85;
  liveTimer = setTimeout(() => { _searchPendingInput = 0; liveSearch($q.value); }, 75);
});
$q.addEventListener('keydown', e => { if (LIVE.on && e.key === 'Enter') { clearTimeout(liveTimer); _searchPendingInput = 0; liveSearch($q.value); } });
let _startupSecondaryIdleId = 0;
function _scheduleSecondaryStartup() {
  if (_startupSecondaryTimer) { clearTimeout(_startupSecondaryTimer); _startupSecondaryTimer = 0; }
  if (_startupSecondaryIdleId && typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(_startupSecondaryIdleId);
    _startupSecondaryIdleId = 0;
  }
  const done = () => {
    _startupSecondaryTimer = 0;
    _startupSecondaryIdleId = 0;
    _startupSecondaryReady = true;
  };
  if (typeof requestIdleCallback === 'function') {
    _startupSecondaryIdleId = requestIdleCallback(done, { timeout: 600 });
  } else {
    _startupSecondaryTimer = setTimeout(done, 400);
  }
}
function liveEnable() {
  if (LIVE.on) return;
  LIVE.on = true;
  ALBUMS.length = TRACKS.length = ARTISTS.length = PLAYLISTS.length = 0; Object.keys(BYID).forEach(k => delete BYID[k]); PINS.length = 0;
  PL.queue = []; PL.qi = 0; PL.pos = 0; PL.playing = false; if (PL.audio) { PL.audio.pause(); PL.audio = null; }
  [ARTC, PALC, TINTC, SHAD_PALC].forEach(o => Object.keys(o).forEach(k => delete o[k])); if (FLU) FLU.key = null;
  clearLiveCoverCache();
  _plRecDebounceTimers.forEach(t => clearTimeout(t));
  _plRecDebounceTimers.clear();
  _plRecCache.clear();
  Object.assign(PAGES, LIVEPAGES);
  ['home', 'new', 'radio', 'library', 'search'].forEach(k => { NAV.stacks[k] = [mkPage(k)]; }); NAV.popP = NAV.popT = 0;
  _startupSecondaryReady = false;
  _startupGraceUntil = performance.now() + 1400;
  liveRestore(); liveHome();
  _scheduleSecondaryStartup(0);
  redraw();
}
if (location.protocol === 'http:' || location.protocol === 'https:') liveEnable();
init();
if (!LIVE.on) fetch('/api/health', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.ok) liveEnable(); }).catch(() => {});

let _promptModalCallback = null;
let _promptOpenTime = 0;
let _promptGlassRaf = 0;
let _promptCloseTimer = 0;
let _promptFocusGuardUntil = 0;

function stopPromptGlass() {
  if (_promptGlassRaf) {
    cancelAnimationFrame(_promptGlassRaf);
    _promptGlassRaf = 0;
  }
}

function isPromptGlassRunning(el) {
  if (!el || el.style.display === 'none') return false;
  if (el.classList.contains('visible') || el.classList.contains('active')) return true;
  return typeof window._promptGlassAlpha === 'number' && window._promptGlassAlpha > 0.01;
}

function pumpPromptGlass(ms) {
  stopPromptGlass();
  const el = document.getElementById('sonoraPrompt');
  if (!isPromptGlassRunning(el)) {
    if (typeof D !== 'undefined') D.gl = true;
    return;
  }
  const until = performance.now() + (ms || 360);
  const step = () => {
    _promptGlassRaf = 0;
    const curEl = document.getElementById('sonoraPrompt');
    if (!isPromptGlassRunning(curEl)) {
      if (typeof D !== 'undefined') D.gl = true;
      return;
    }
    if (typeof D !== 'undefined') D.gl = true;
    if (typeof FALLBACK !== 'undefined' && FALLBACK && typeof redraw === 'function') redraw();
    if (performance.now() < until) {
      _promptGlassRaf = requestAnimationFrame(step);
    }
  };
  _promptGlassRaf = requestAnimationFrame(step);
}

function closePromptModal() {
  const el = document.getElementById('sonoraPrompt');
  if (!el) return;
  _promptFocusGuardUntil = 0;
  el.classList.remove('visible', 'active');
  el.setAttribute('aria-hidden', 'true');
  const inp = document.getElementById('promptInput');
  if (inp) {
    inp.blur();
    inp.value = '';
  }
  _promptModalCallback = null;
  if (_promptCloseTimer) {
    clearTimeout(_promptCloseTimer);
    _promptCloseTimer = 0;
  }
  pumpPromptGlass(280);
  _promptCloseTimer = setTimeout(() => {
    _promptCloseTimer = 0;
    if (!el.classList.contains('visible') && !el.classList.contains('active')) {
      stopPromptGlass();
      el.style.display = 'none';
      window._promptGlassAlpha = 0;
      if (typeof D !== 'undefined') D.gl = true;
      if (typeof FALLBACK !== 'undefined' && FALLBACK && typeof redraw === 'function') redraw();
    }
  }, 260);
}

const _PROMPT_ICONS = {
  music: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
  download: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  trash: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
};
function showConfirmModal(opts) {
  return showPromptModal(Object.assign({ confirmOnly: true }, opts));
}
function showPromptModal(opts) {
  opts = opts || {};
  initPromptModal();
  const el = document.getElementById('sonoraPrompt');
  if (!el) return;
  if (_promptCloseTimer) {
    clearTimeout(_promptCloseTimer);
    _promptCloseTimer = 0;
  }
  stopPromptGlass();
  const titleEl = document.getElementById('promptTitle');
  const subEl = document.getElementById('promptSub');
  const badgeEl = el.querySelector('.prompt-badge');
  const inp = document.getElementById('promptInput');
  const cancelBtn = document.getElementById('promptCancel');
  const confirmBtn = document.getElementById('promptConfirm');
  const confirmOnly = Boolean(opts.confirmOnly);
  el.dataset.confirmOnly = confirmOnly ? '1' : '0';

  if (badgeEl) {
    badgeEl.innerHTML = _PROMPT_ICONS[opts.icon] || _PROMPT_ICONS.music;
  }
  if (titleEl) titleEl.textContent = opts.title || window.t('prompt.new_playlist_title');
  if (subEl) {
    subEl.textContent = opts.subtitle || (opts.defaultVal ? window.t('prompt.rename_playlist_sub') : window.t('prompt.new_playlist_sub'));
    subEl.style.marginBottom = confirmOnly ? '20px' : '';
  }
  if (inp) {
    inp.style.display = confirmOnly ? 'none' : '';
    inp.placeholder = opts.placeholder || window.t('prompt.playlist_placeholder');
    inp.value = confirmOnly ? '' : (opts.defaultVal || '');
  }
  if (cancelBtn) cancelBtn.textContent = opts.cancelText || window.t('prompt.cancel');
  if (confirmBtn) confirmBtn.textContent = opts.confirmText || window.t('prompt.create');

  _promptModalCallback = typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
  _promptOpenTime = Date.now();

  // Release any pointer capture on $out so touch/mouse interactions belong to the modal
  const out = document.getElementById('out');
  if (out) {
    try {
      if (typeof out.releasePointerCapture === 'function' && window.INP && window.INP.id != null) {
        out.releasePointerCapture(window.INP.id);
      }
    } catch (_) {}
  }
  if (typeof INP !== 'undefined' && INP) {
    INP.down = false;
    INP.focusPending = false;
    INP.mode = null;
    INP.tgt = null;
  }

  if (typeof $q !== 'undefined' && $q && document.activeElement === $q) {
    $q.blur();
  }

  el.style.display = 'flex';
  void el.offsetWidth;
  el.classList.add('visible', 'active');
  el.removeAttribute('aria-hidden');
  pumpPromptGlass(360);

  _promptFocusGuardUntil = 0;
  if (inp && !confirmOnly) {
    _promptFocusGuardUntil = performance.now() + 450;
    try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
    if (typeof inp.setSelectionRange === 'function' && typeof inp.value === 'string') {
      const len = inp.value.length;
      try { inp.setSelectionRange(0, len); } catch (_) {}
    }
    requestAnimationFrame(() => {
      if (el.classList.contains('visible') && !confirmOnly && document.activeElement !== inp) {
        try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
      }
    });
  }
}

function initPromptModal() {
  const el = document.getElementById('sonoraPrompt');
  if (!el || el._promptInited) return;
  el._promptInited = true;

  const inp = document.getElementById('promptInput');
  const cancelBtn = document.getElementById('promptCancel');
  const confirmBtn = document.getElementById('promptConfirm');
  const sheet = el.querySelector('.prompt-sheet');

  if (sheet) {
    sheet.addEventListener('click', e => e.stopPropagation());
    sheet.addEventListener('pointerdown', e => e.stopPropagation());
    sheet.addEventListener('mousedown', e => e.stopPropagation());
  }

  const doConfirm = () => {
    const confirmOnly = el.dataset.confirmOnly === '1';
    const val = (inp ? inp.value : '').trim();
    const cb = _promptModalCallback;
    _promptFocusGuardUntil = 0;
    closePromptModal();
    if (cb) cb(confirmOnly ? true : val);
  };

  if (confirmBtn) {
    confirmBtn.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      doConfirm();
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = e => {
      e.stopPropagation();
      e.preventDefault();
      closePromptModal();
    };
  }

  if (inp) {
    inp.addEventListener('blur', () => {
      if (el.classList.contains('visible') && (!el.dataset || el.dataset.confirmOnly !== '1') && performance.now() < _promptFocusGuardUntil) {
        try { inp.focus({ preventScroll: true }); } catch (_) { inp.focus(); }
      }
    });
    inp.onkeydown = e => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        e.preventDefault();
        doConfirm();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closePromptModal();
      }
    };
  }

  el.onclick = e => {
    if (Date.now() - _promptOpenTime < 400) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (e.target === el) {
      e.stopPropagation();
      closePromptModal();
    }
  };
  el.onpointerdown = e => {
    if (Date.now() - _promptOpenTime < 400) {
      e.stopPropagation();
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPromptModal);
} else {
  initPromptModal();
}

window.showConfirmModal = showConfirmModal;
window.showPromptModal = showPromptModal;
window.closePromptModal = closePromptModal;

const _origOnSonoraBackPressed = window.onSonoraBackPressed;
window.onSonoraBackPressed = function() {
  const promptEl = document.getElementById('sonoraPrompt');
  const isOpen = promptEl && (promptEl.classList.contains('visible') || promptEl.classList.contains('active') || (promptEl.style.display === 'flex' && promptEl.getAttribute('aria-hidden') !== 'true'));
  if (isOpen) {
    closePromptModal();
    return "true";
  }
  if (typeof _origOnSonoraBackPressed === 'function') {
    return _origOnSonoraBackPressed.apply(this, arguments);
  }
  return "false";
};

function clearLiveCachesAndRefresh() {
  try { localStorage.removeItem(HOME_CACHE_KEY); } catch (e) {}
  _homeSnapPending = null;
  if (_homeSnapTimer) { clearTimeout(_homeSnapTimer); _homeSnapTimer = 0; }
  if (_homeSnapIdleId && typeof cancelIdleCallback === 'function') { cancelIdleCallback(_homeSnapIdleId); _homeSnapIdleId = 0; }
  if (LIVE) {
    LIVE.home = null;
    LIVE.homeErr = null;
    LIVE.charts = null;
    LIVE.chartsBusy = false;
    LIVE.chartsErr = null;
    LIVE.radioFeed = null;
    LIVE.radioFeedBusy = false;
    LIVE.radioFeedErr = null;
    LIVE.res = {};
    LIVE.lastSearch = null;
  }
  if (typeof _searchMemCache !== 'undefined') _searchMemCache.clear();
  if (typeof _resKeys !== 'undefined') _resKeys.length = 0;
  if (LIVE && LIVE.on) {
    if (typeof liveHome === 'function') liveHome(true);
    if (typeof liveCharts === 'function') liveCharts();
    if (typeof liveRadio === 'function') liveRadio();
    if (typeof NAV !== 'undefined' && NAV.tab === 'search' && NAV.query && typeof liveSearch === 'function') {
      liveSearch(NAV.query);
    }
  }
}

function invalidateLiveLocaleCaches(langChanged, countryChanged) {
  _syncLiveLocaleArrays();
  _liveChipWs = null;
  _libFilterWs = null;
  _libListCache = { sig: '', curF: '', sIdx: -1, lqLow: '', list: null };
  if (typeof BYID !== 'undefined' && BYID.loc_alb) {
    BYID.loc_alb.title = window.t('local.files');
    BYID.loc_alb.artist = window.t('local.device');
  }
  if (LIVE && LIVE.ly) {
    for (const k in LIVE.ly) {
      const entry = LIVE.ly[k];
      if (!entry) continue;
      if (entry.loading || (Array.isArray(entry.lines) && entry.lines.length === 1 && entry.lines[0] && entry.lines[0]._placeholder)) {
        delete LIVE.ly[k];
      }
    }
  }
  if (langChanged || countryChanged) {
    if (countryChanged) _localeCountrySwitched = true;
    clearLiveCachesAndRefresh();
  }
}
window.clearLiveCachesAndRefresh = clearLiveCachesAndRefresh;
window.invalidateLiveLocaleCaches = invalidateLiveLocaleCaches;
