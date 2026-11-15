const ARTC = {};
const hsl = (h, s, l, a) => 'hsla(' + ((h % 360 + 360) % 360) + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
function rrPath(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function _rrTopSub(p, x, y, w, h, r) { r = Math.min(r, w / 2, h); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.arcTo(x, y, x + w, y, r); p.closePath(); }
function rrTopPath(c, x, y, w, h, r) { c.beginPath(); _rrTopSub(c, x, y, w, h, r); }
function drawSpinnerRing(c, cx, cy, rad, col, lw) {
  const nowMs = performance.now();
  const speed = 0.8;
  const cycleMs = 1333 / speed;
  const fullCycles = Math.floor(nowMs / cycleMs);
  const t = (nowMs % cycleMs) / cycleMs;

  const rot = ((nowMs / 1000 * speed) * (Math.PI * 2 / 1.333)) % (Math.PI * 2);
  const maxSweep = Math.PI * 1.5;
  const baseOffset = (fullCycles * maxSweep) % (Math.PI * 2);

  let headOffset, tailOffset;
  if (t < 0.5) {
    const p = t * 2;
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    headOffset = ease * maxSweep;
    tailOffset = 0;
  } else {
    const p = (t - 0.5) * 2;
    const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    headOffset = maxSweep;
    tailOffset = ease * maxSweep;
  }

  const startAngle = rot + baseOffset + tailOffset;
  const endAngle = rot + baseOffset + Math.max(0.12, headOffset);

  c.save();
  c.lineWidth = lw || 2.2;
  c.lineCap = 'round';
  c.strokeStyle = col || '#ffffff';
  c.globalAlpha = (c.globalAlpha || 1) * 0.90;

  c.beginPath();
  c.arc(cx, cy, rad, startAngle, endAngle);
  c.stroke();
  c.restore();
}
const _PHC = {};
function makeArt(o) {
  if (o.user && !o.thumb) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d');
    const H = o.hue || 220;
    const bg = c.createLinearGradient(0, 0, 128, 128);
    bg.addColorStop(0, hsl(H, 50, 32));
    bg.addColorStop(1, hsl(H, 45, 14));
    c.fillStyle = bg;
    c.fillRect(0, 0, 128, 128);
    c.beginPath();
    c.arc(64, 64, 28, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fill();
    icon(c, 'lib-playlist', 64, 64, 28, 'rgba(255,255,255,0.85)', { lw: 2.2 });
    cv._real = true;
    return cv;
  }
  if (o.thumb || (typeof LIVE !== 'undefined' && LIVE.on)) {
    const d = typeof pal !== 'undefined' && pal ? pal.dark : true, pk = d ? 'd' : 'l';
    if (_PHC[pk]) return _PHC[pk];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; cv._placeholder = true;
    const c = cv.getContext('2d'), bg = c.createLinearGradient(0, 0, 64, 64);
    bg.addColorStop(0, d ? '#1e1e22' : '#ececf1'); bg.addColorStop(1, d ? '#151518' : '#e0e0e7');
    c.fillStyle = bg; c.fillRect(0, 0, 64, 64);
    return (_PHC[pk] = cv);
  }
  const CV_S = (o && (o._hero || o.hero)) ? 480 : 256, S = 480, cv = document.createElement('canvas'); cv.width = cv.height = CV_S;
  const c = cv.getContext('2d');
  if (CV_S !== S) c.scale(CV_S / S, CV_S / S);
  const r = rng(h32(o.id)), H = o.hue, st = o.style;
  const bg = c.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, hsl(H, 70, 58)); bg.addColorStop(1, hsl(H + 38, 75, 24));
  c.fillStyle = bg; c.fillRect(0, 0, S, S);
  if (st === 0) {
    for (let i = 0; i < 5; i++) { const x = r() * S, y = r() * S, rad = 90 + r() * 170, g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, hsl(H + r() * 80 - 20, 85, 65, .9)); g.addColorStop(1, hsl(H, 85, 50, 0)); c.fillStyle = g; c.fillRect(0, 0, S, S); }
    c.fillStyle = hsl(H + 150, 90, 82); c.beginPath(); c.arc(S * .62, S * .38, 54, 0, 7); c.fill();
  } else if (st === 1) {
    c.save(); c.rotate(-.5); for (let i = -6; i < 12; i++) { c.fillStyle = hsl(H + (i % 3) * 22, 70 - (i % 2) * 20, 22 + ((i * 7) % 5) * 11); c.fillRect(-S, i * 54, S * 3, 30 + r() * 20); } c.restore();
  } else if (st === 2) {
    const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, hsl(H + 20, 80, 20)); g.addColorStop(.6, hsl(H, 85, 55)); g.addColorStop(1, hsl(H - 20, 80, 70)); c.fillStyle = g; c.fillRect(0, 0, S, S);
    c.fillStyle = hsl(H + 170, 95, 85); c.beginPath(); c.arc(S / 2, S * .58, 110, Math.PI, 0); c.fill();
    c.fillStyle = hsl(H + 10, 60, 14); c.fillRect(0, S * .58, S, S); for (let i = 0; i < 6; i++) { c.fillStyle = hsl(H + 170, 90, 80, .5 - i * .07); c.fillRect(S / 2 - 100 + i * 12, S * .62 + i * 26, 200 - i * 24, 8); }
  } else if (st === 3) {
    const n = 4, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.fillStyle = hsl(H + Math.floor(r() * 4) * 30, 55 + r() * 35, 20 + r() * 55); c.fillRect(i * w, j * w, w, w); if (r() > .55) { c.fillStyle = hsl(H + 180, 80, 88); c.beginPath(); c.arc(i * w + w / 2, j * w + w / 2, w * .28, 0, 7); c.fill(); } }
  } else if (st === 4) {
    c.fillStyle = hsl(H, 60, 14); c.fillRect(0, 0, S, S); const cx = S * (.4 + r() * .2), cy = S * (.4 + r() * .2);
    for (let i = 9; i > 0; i--) { c.fillStyle = hsl(H + i * 9, 80, 18 + i * 6); c.beginPath(); c.arc(cx + (9 - i) * 6, cy - (9 - i) * 4, i * 30, 0, 7); c.fill(); }
  } else {
    for (let k = 0; k < 7; k++) { c.fillStyle = hsl(H + k * 12, 70, 16 + k * 9); c.beginPath(); c.moveTo(0, S); for (let x = 0; x <= S; x += 8) c.lineTo(x, 110 + k * 50 + Math.sin(x / 60 + k * 1.3) * 26); c.lineTo(S, S); c.fill(); }
  }
  c.fillStyle = 'rgba(0,0,0,.18)'; const gr = c.createLinearGradient(0, S * .55, 0, S); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = gr; c.fillRect(0, 0, S, S);
  if (o.kind !== 'artist') { if (!o.thumb) { c.fillStyle = 'rgba(255,255,255,.92)'; c.font = '800 34px ui-sans-serif,system-ui,-apple-system,"Inter",sans-serif'; const words = (o.title || '').toUpperCase().split(' '); let ly = S - 28 - (words.length - 1) * 36; words.forEach(w => { c.fillText(w, 28, ly); ly += 36; }); } }
  else {  }
  return cv;
}
const _artUpQ = [];
let _artUpAct = 0, _artUpTimer = 0, _artColdRetryTimer = 0;
function _isScrollOrAnimBusy() {
  if (typeof _isUiAnimatingOrBusy === 'function') return _isUiAnimatingOrBusy();
  if (typeof INP !== 'undefined' && INP && INP.down) return true;
  if (typeof topPage === 'function') {
    const tp = topPage();
    if (tp && Math.abs(tp.vel || 0) > 45) return true;
  }
  if (typeof NAV !== 'undefined' && NAV && (NAV.popP > 0.01 || NAV.pushP > 0.01 || NAV.popT > 0.01)) return true;
  if (typeof _tabTrans !== 'undefined' && _tabTrans && _tabTrans.active) return true;
  if (typeof SH !== 'undefined' && SH && (SH.drag || (SH.t > 0.01 && SH.t < 0.99) || Math.abs(SH.qVel || 0) > 25 || Math.abs(SH.lVel || 0) > 25)) return true;
  return false;
}
function _redrawAfterArt(it) {
  const cTr = typeof cur === 'function' ? cur() : null;
  const isCur = Boolean(it && cTr && (cTr.id === it.id || (it.kind === 'album' && cTr.album === it.id)));
  if (!isCur && typeof redrawSheetContent === 'function') redrawSheetContent();
  else if (typeof redraw === 'function') redraw();
}
function _isHiResCoverUrl(u) {
  return Boolean(u && /[?&]s=(?:1080|1200|1400)\b/.test(u));
}
function _enqueueArtUp(target, pri) {
  if (!target) return;
  if (pri) target._artUpPri = true;
  if (!target._appleUpgradeTried) {
    target._appleUpgradeTried = true;
    if (pri) _artUpQ.unshift(target);
    else _artUpQ.push(target);
    if (!_artUpTimer) {
      const busy = _isScrollOrAnimBusy();
      if ((typeof window !== 'undefined' && window.__IN_DRAW_SCENE) || busy) {
        if (typeof setTimeout === 'function') _artUpTimer = setTimeout(_pumpArtUpQ, busy ? 28 : 0);
      } else {
        _pumpArtUpQ();
      }
    }
  } else if (pri) {
    const idx = _artUpQ.indexOf(target);
    if (idx > 0) {
      _artUpQ.splice(idx, 1);
      _artUpQ.unshift(target);
    }
  }
}
if (typeof window !== 'undefined') window._enqueueArtUp = _enqueueArtUp;
function _pumpArtUpQ() {
  _artUpTimer = 0;
  if (!_artUpQ.length) return;
  const busy = _isScrollOrAnimBusy();
  const maxConc = busy ? 2 : 6;
  while (_artUpAct < maxConc && _artUpQ.length) {
    const it = _artUpQ.shift();
    if (!it) continue;
    const isAlbum = it.kind === 'album';
    const isTrack = !isAlbum && it.kind !== 'artist' && (!it.kind || it.kind === 'track');
    if (it._appleUpgradeSettled || (isTrack && it.canonicalCover)) continue;
    const fetcher = isAlbum
      ? (typeof fetchAlbumThumb === 'function' ? () => fetchAlbumThumb(it.title, it.artist, it.id) : null)
      : isTrack
        ? (typeof fetchTrackThumb === 'function' ? () => fetchTrackThumb(it) : null)
        : (typeof fetchArtistThumb === 'function' ? () => fetchArtistThumb(it.title, it.id) : null);
    if (!fetcher) continue;
    _artUpAct++;
    const isCur = Boolean(typeof cur === 'function' && cur() && cur().id === it.id);
    const priArt = isCur || Boolean(it._artUpPri);
    Promise.resolve(fetcher()).then(hq => {
      if (hq) {
        it._appleUpgradeSettled = true;
        const sameBase = Boolean(it.thumb && hq && typeof isSameCoverBase === 'function' && isSameCoverBase(it.thumb, hq));
        if (sameBase && _isHiResCoverUrl(it.thumb) && !_isHiResCoverUrl(hq)) {
          if (typeof preloadArt === 'function') preloadArt(it, priArt);
          return;
        }
        const hasSameArt = Boolean(it.id && ARTC[it.id] && ARTC[it.id]._real &&
          (ARTC[it.id]._url === hq || (typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[it.id]._url, hq) && (!_isHiResCoverUrl(hq) || _isHiResCoverUrl(ARTC[it.id]._url)))));
        const bothApple = it.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(it.thumb) && isAppleArtistThumb(hq);
        const hqReady = Boolean(typeof _covUrl !== 'undefined' && _covUrl[hq] && _covUrl[hq].width > 0);
        const hadRealArt = Boolean((it.id && ARTC[it.id] && ARTC[it.id]._real) || (it.album && ARTC[it.album] && ARTC[it.album]._real));
        if (hqReady && hadRealArt) {
          try { _covUrl[hq]._fadePending = false; _covUrl[hq]._t0 = 0; } catch (e) {}
        }
        if (it.thumb !== hq || !hasSameArt) {
          it.thumb = hq;
          if (it.id && typeof BYID !== 'undefined' && BYID[it.id] && BYID[it.id] !== it) {
            const by = BYID[it.id];
            if (!(by.thumb && _isHiResCoverUrl(by.thumb) && !_isHiResCoverUrl(hq) && typeof isSameCoverBase === 'function' && isSameCoverBase(by.thumb, hq))) {
              by.thumb = hq;
            }
          }
          if (isTrack && it.album && typeof BYID !== 'undefined' && BYID[it.album] &&
              (it.album === 's_' + it.id || !(ARTC[it.album] && ARTC[it.album]._real && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(ARTC[it.album]._url)))) {
            if ((hqReady || !(ARTC[it.album] && ARTC[it.album]._real)) &&
                !(ARTC[it.album] && ARTC[it.album]._real && typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[it.album]._url, hq))) {
              delete ARTC[it.album];
            }
          }
          if (it.id && !sameBase && (hqReady || !(ARTC[it.id] && ARTC[it.id]._real)) && (isTrack || !bothApple || !(ARTC[it.id] && ARTC[it.id]._real))) delete ARTC[it.id];
          if (it.id && !sameBase && (hqReady || !(ARTC[it.id] && ARTC[it.id]._real))) {
            if (typeof PALC !== 'undefined') delete PALC[it.id];
            if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[it.id];
            if (typeof TINTC !== 'undefined') { delete TINTC[it.id + 'd']; delete TINTC[it.id + 'l']; }
          }
          if (typeof preloadArt === 'function') preloadArt(it, priArt);
          _redrawAfterArt(it);
        } else if (isTrack) {
          if (it.album === 's_' + it.id && ARTC[it.album] && ARTC[it.album]._real && hqReady &&
              typeof isSameCoverBase === 'function' && !isSameCoverBase(ARTC[it.album]._url, hq)) {
            delete ARTC[it.album];
          }
          if (typeof preloadArt === 'function') preloadArt(it, priArt);
          _redrawAfterArt(it);
        }
      } else if (!isTrack && it.title && (isAlbum
          ? (typeof isAppleAlbumThumbCold === 'function' && isAppleAlbumThumbCold(it.title, it.artist))
          : (typeof isAppleThumbCold === 'function' && isAppleThumbCold(it.title)))) {
        it._coldRetries = (it._coldRetries || 0) + 1;
        if (it._coldRetries >= 4) {
          it._appleUpgradeSettled = true;
          if (it.thumb) {
            if (typeof preloadArt === 'function') preloadArt(it, priArt);
            _redrawAfterArt(it);
          }
        } else {
          it._appleUpgradeTried = false;
          if (!_artColdRetryTimer && typeof setTimeout === 'function') {
            _artColdRetryTimer = setTimeout(() => {
              _artColdRetryTimer = 0;
              _redrawAfterArt(it);
            }, 2100);
          }
        }
      } else {
        it._appleUpgradeSettled = true;
        if (it.thumb) {
          if (typeof preloadArt === 'function') preloadArt(it, priArt);
          _redrawAfterArt(it);
        }
      }
    }).catch(() => {
      it._appleUpgradeSettled = true;
    }).finally(() => {
      _artUpAct = Math.max(0, _artUpAct - 1);
      if (_artUpQ.length && !_artUpTimer && typeof setTimeout === 'function') {
        _artUpTimer = setTimeout(_pumpArtUpQ, _isScrollOrAnimBusy() ? 36 : 0);
      }
    });
  }
}
function _resolveTrackArtItem(item) {
  if (!item) return item;
  const kKnown = (typeof LIVE !== 'undefined' && LIVE.known && item.id) ? LIVE.known[item.id] : null;
  if (kKnown && kKnown !== item) {
    if (kKnown._appleUpgradeSettled && !item._appleUpgradeSettled) item._appleUpgradeSettled = true;
    if (kKnown.thumb) {
      const shouldSync = Boolean(
        (kKnown.canonicalCover && (!item.canonicalCover || kKnown.thumb !== item.thumb || kKnown.album !== item.album || kKnown.albumTitle !== item.albumTitle)) ||
        !item.thumb
      );
      if (shouldSync) {
        item.thumb = kKnown.thumb;
        item.album = kKnown.album;
        item.albumTitle = kKnown.albumTitle;
        item.albumId = kKnown.albumId;
        item.canonicalCover = kKnown.canonicalCover;
        if (kKnown._appleUpgradeSettled || kKnown.canonicalCover) item._appleUpgradeSettled = true;
      }
    }
  }
  const alb = albumOf(item);
  if (item.canonicalCover && item.thumb && alb && alb !== item) {
    const sameCover = Boolean(
      alb.thumb && (typeof isSameCoverBase === 'function' ? isSameCoverBase(alb.thumb, item.thumb) : alb.thumb === item.thumb)
    );
    const titleMismatch = Boolean(
      item.albumTitle && alb.title && typeof _cleanAlbumThumbKey === 'function' &&
      _cleanAlbumThumbKey(alb.title, item.artist) !== _cleanAlbumThumbKey(item.albumTitle, item.artist)
    );
    const compAlb = typeof _isCompilationAlbumName === 'function' && _isCompilationAlbumName(alb.title, item.title);
    const rawHigherRes = _isHiResCoverUrl(item.thumb) && !_isHiResCoverUrl(alb.thumb);
    if (!alb.thumb || !sameCover || titleMismatch || compAlb || rawHigherRes) {
      return item;
    }
  }
  return alb;
}
function artOf(item) {
  const raw = item;
  if (item.kind === 'track' || !item.kind) {
    item = _resolveTrackArtItem(item);
  }
  const k = item.id;
  const isArtist = item.kind === 'artist' || (raw && raw.kind === 'artist');
  const isAlbum = !isArtist && item.kind === 'album' && !item.user && k && String(k).indexOf('s_') !== 0;
  let th = (raw && raw !== item && raw.canonicalCover && raw.thumb)
    ? raw.thumb
    : (item.thumb || (raw && raw.kind !== 'artist' && raw.thumb));
  if (isArtist && th && typeof isHqThumb === 'function' && !isHqThumb(th)) {
    th = null; item.thumb = null; if (raw) raw.thumb = null;
  }
  if (th && !item.thumb) item.thumb = th;
  const liveOn = typeof LIVE === 'undefined' || Boolean(LIVE && LIVE.on);
  const needsArtistApple = isArtist && liveOn &&
    (!th || (typeof isAppleArtistThumb === 'function' && !isAppleArtistThumb(th))) &&
    typeof fetchArtistThumb === 'function' && Boolean(item.title);
  const isTrackRaw = Boolean(raw && (!raw.kind || raw.kind === 'track') && !raw._local && (!item || !item.user));
  const needsTrackApple = isTrackRaw && liveOn && !needsArtistApple &&
    !raw.canonicalCover && !raw._appleUpgradeSettled &&
    typeof fetchTrackThumb === 'function' && Boolean(raw.title) && Boolean(raw.artist);
  const needsAlbumApple = isAlbum && !isTrackRaw && liveOn &&
    typeof isAppleArtistThumb === 'function' && (!th || !isAppleArtistThumb(th)) &&
    typeof fetchAlbumThumb === 'function' && Boolean(item.title);
  const isAppleUrl = u => Boolean(u && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(u));
  const thIsApple = isAppleUrl(th);
  const saveReal = cv => { if (raw && cv && cv._real && cv.width > 0) raw._lastRealArt = cv; return cv; };
  const canSeedKey = Boolean(k && raw && (k === raw.id || String(k).indexOf('s_') === 0));
  if (needsTrackApple) {
    _enqueueArtUp(raw, false);
    if (th && thIsApple && typeof liveCover === 'function' &&
        (!ARTC[k] || !ARTC[k]._real || (ARTC[k]._url !== th && !(typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[k]._url, th))))) {
      liveCover(item, k, false);
    }
    if (ARTC[k] && ARTC[k].width > 0 && ARTC[k]._real && isAppleUrl(ARTC[k]._url)) return saveReal(ARTC[k]);
    if (raw && raw.id && ARTC[raw.id] && ARTC[raw.id]._real && ARTC[raw.id].width > 0 && isAppleUrl(ARTC[raw.id]._url)) return saveReal(ARTC[raw.id]);
    if (raw && raw._lastRealArt && raw._lastRealArt._real && raw._lastRealArt.width > 0 && isAppleUrl(raw._lastRealArt._url)) return raw._lastRealArt;
    if (ARTC[k] && ARTC[k].width > 0 && !ARTC[k]._real) return ARTC[k];
    const ph = makeArt(item);
    if (!ARTC[k] || !ARTC[k]._real) ARTC[k] = ph;
    return ph;
  }
  if ((needsArtistApple || needsAlbumApple) && !item._appleUpgradeSettled) {
    _enqueueArtUp(item, false);
    if (th && thIsApple && typeof liveCover === 'function' &&
        (!ARTC[k] || !ARTC[k]._real || (ARTC[k]._url !== th && !(typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[k]._url, th))))) {
      liveCover(item, k, false);
    }
    if (ARTC[k] && ARTC[k].width > 0 && ARTC[k]._real && isAppleUrl(ARTC[k]._url)) return saveReal(ARTC[k]);
    if (raw && raw._lastRealArt && raw._lastRealArt._real && raw._lastRealArt.width > 0 && isAppleUrl(raw._lastRealArt._url)) return raw._lastRealArt;
    if (ARTC[k] && ARTC[k].width > 0 && !ARTC[k]._real) return ARTC[k];
    const ph = makeArt(item);
    if (!ARTC[k] || !ARTC[k]._real) ARTC[k] = ph;
    return ph;
  }
  if (ARTC[k] && ARTC[k]._real && ARTC[k].width > 0) {
    if (ARTC[k]._url === th) return saveReal(ARTC[k]);
    if (th && typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[k]._url, th)) {
      if ((!_isHiResCoverUrl(ARTC[k]._url) || _isHiResCoverUrl(th)) && typeof liveCover === 'function') {
        liveCover(item, k, true);
      }
      return saveReal(ARTC[k]);
    }
    if (th && typeof liveCover === 'function') liveCover(item, k, true);
    return saveReal(ARTC[k]);
  }
  if (raw && raw.id && ARTC[raw.id] && ARTC[raw.id]._real && ARTC[raw.id].width > 0) {
    const prevRawArt = ARTC[raw.id];
    if (prevRawArt._url === th) return saveReal(prevRawArt);
    if (canSeedKey && (!ARTC[k] || !ARTC[k]._real)) ARTC[k] = prevRawArt;
    if (th && typeof isSameCoverBase === 'function' && isSameCoverBase(prevRawArt._url, th)) {
      if ((!_isHiResCoverUrl(prevRawArt._url) || _isHiResCoverUrl(th)) && typeof liveCover === 'function') {
        liveCover(item, k, true);
      }
      return saveReal((ARTC[k] && ARTC[k]._real && ARTC[k].width > 0) ? ARTC[k] : prevRawArt);
    }
    if (th && typeof liveCover === 'function') liveCover(item, k, true);
    return saveReal((ARTC[k] && ARTC[k]._real && ARTC[k].width > 0) ? ARTC[k] : prevRawArt);
  }
  if (raw && raw._lastRealArt && raw._lastRealArt._real && raw._lastRealArt.width > 0) {
    const lastReal = raw._lastRealArt;
    if (canSeedKey && (!ARTC[k] || !ARTC[k]._real)) ARTC[k] = lastReal;
    if (th && typeof liveCover === 'function') liveCover(item, k, true);
    return saveReal((ARTC[k] && ARTC[k]._real && ARTC[k].width > 0) ? ARTC[k] : lastReal);
  }
  if (th && typeof liveCover === 'function') liveCover(item, k, true);
  if (ARTC[k] && ARTC[k].width > 0) return saveReal(ARTC[k]);
  return (ARTC[k] = makeArt(item));
}
function preloadArt(it, pri) {
  if (!it) return;
  const isTrack = !it.kind || it.kind === 'track';
  const a = isTrack ? _resolveTrackArtItem(it) : artItem(it);
  const isArtist = (a && a.kind === 'artist') || it.kind === 'artist';
  let th = (isTrack && it.canonicalCover && it.thumb) ? it.thumb : ((a && a.thumb) || it.thumb);
  if (isArtist && th && typeof isHqThumb === 'function' && !isHqThumb(th)) {
    th = null; if (a) a.thumb = null; it.thumb = null;
  }
  if (a && th && !a.thumb) a.thumb = th;
  const isRealAlbum = a && a.kind === 'album' && !a.user && a.id && String(a.id).indexOf('s_') !== 0;
  const liveOn = typeof LIVE === 'undefined' || Boolean(LIVE && LIVE.on);
  const needsArtistApple = isArtist && liveOn &&
    (!th || (typeof isAppleArtistThumb === 'function' && !isAppleArtistThumb(th))) &&
    typeof fetchArtistThumb === 'function' && Boolean((a && a.title) || it.title);
  const isTrackRaw = isTrack && !it._local && (!a || !a.user);
  const needsTrackApple = isTrackRaw && liveOn && !needsArtistApple &&
    !it.canonicalCover && !it._appleUpgradeSettled &&
    typeof fetchTrackThumb === 'function' && Boolean(it.title) && Boolean(it.artist);
  const needsAlbumApple = isRealAlbum && !isTrackRaw && liveOn &&
    typeof isAppleArtistThumb === 'function' && (!th || !isAppleArtistThumb(th)) &&
    typeof fetchAlbumThumb === 'function' && Boolean(a && a.title);
  if (needsTrackApple) {
    _enqueueArtUp(it, Boolean(pri));
    return;
  }
  if ((needsArtistApple || needsAlbumApple) && a && !a._appleUpgradeSettled) {
    _enqueueArtUp(a, Boolean(pri));
    return;
  }
  const aHasArt = a && a.thumb && ARTC[a.id] && ARTC[a.id]._real && ARTC[a.id].width > 0 &&
    (ARTC[a.id]._url === a.thumb || (_isHiResCoverUrl(ARTC[a.id]._url) && !_isHiResCoverUrl(a.thumb) && typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[a.id]._url, a.thumb)));
  if (a && a.thumb && !aHasArt) liveCover(a, a.id, Boolean(pri));
  const itHasArt = it.id && it.thumb && ARTC[it.id] && ARTC[it.id]._real && ARTC[it.id].width > 0 &&
    (ARTC[it.id]._url === it.thumb || (_isHiResCoverUrl(ARTC[it.id]._url) && !_isHiResCoverUrl(it.thumb) && typeof isSameCoverBase === 'function' && isSameCoverBase(ARTC[it.id]._url, it.thumb)));
  if (it.id && it.thumb && !itHasArt) liveCover(it, it.id, Boolean(pri));
}
let _animRaf = 0;
function scheduleAnimRedraw() {
  if (_animRaf) return;
  if (typeof requestAnimationFrame === 'function') {
    _animRaf = requestAnimationFrame(() => {
      _animRaf = 0;
      if (typeof redrawSheetContent === 'function') redrawSheetContent();
      else if (typeof redraw === 'function') redraw();
    });
  }
}
function artFadeAlpha(im) {
  if (!im || !im._real) return 1;
  const now = performance.now();
  if (im._fadePending) {
    im._fadePending = false;
    if (im._loadedAt && (now - im._loadedAt) < 600) {
      im._t0 = now;
    } else {
      im._t0 = 0;
      return 1;
    }
  }
  if (!im._t0) return 1;
  const dt = now - im._t0;
  const dur = 180;
  if (dt >= dur) {
    im._t0 = 0;
    return 1;
  }
  if (typeof window !== 'undefined') window._artFadeActive = true;
  if (typeof window !== 'undefined' && window.__IN_DRAW_SCENE && typeof scheduleSceneAnimRedraw === 'function') {
    scheduleSceneAnimRedraw();
  } else {
    scheduleAnimRedraw();
  }
  const rawP = dt <= 0 ? 0.08 : dt / dur;
  const p = rawP < 0.08 ? 0.08 : (rawP > 1 ? 1 : rawP);
  return p * (2 - p);
}
function withPressScale(c, key, cx, cy, fn, amt) {
  const sc = typeof pressScale === 'function' ? pressScale(key, amt) : 1;
  if (sc === 1) { fn(); return; }
  c.save();
  c.translate(cx, cy);
  c.scale(sc, sc);
  c.translate(-cx, -cy);
  fn();
  c.restore();
}
function drawRowPressTint(c, key, x, y, w, h, rad) {
  const ta = typeof pressTint === 'function' ? pressTint(key) : 0;
  if (ta <= 0.001) return;
  c.save();
  c.fillStyle = (typeof pal !== 'undefined' && pal.dark)
    ? ('rgba(255,255,255,' + ta.toFixed(4) + ')')
    : ('rgba(0,0,0,' + ta.toFixed(4) + ')');
  if (rad) { rrPath(c, x, y, w, h, rad); c.fill(); }
  else c.fillRect(x, y, w, h);
  c.restore();
}
let _tileBudgetRaf = 0, _tileBuiltFrame = 0;
function drawArt(c, item, x, y, s, r) {
  const im = artOf(item);
  const rad = r == null ? Math.max(4, s * .07) : r;
  const a = (im && im._real) ? artFadeAlpha(im) : 1;
  if (a >= 0.999 && s <= 200 && Math.abs(s - Math.round(s)) < 0.01 && im && im._real && im.width > 0) {
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 2, 2);
    const pw = Math.round(s * dpr), pr = Math.round(rad * dpr), key = pw + ':' + pr;
    let tc = im._tiles && im._tiles[key];
    const deferTileBuild = _isScrollOrAnimBusy();
    if (!tc && !deferTileBuild && _tileBuiltFrame < 3 && pw > 0) {
      if (!_tileBudgetRaf && typeof requestAnimationFrame === 'function') {
        _tileBudgetRaf = requestAnimationFrame(() => { _tileBudgetRaf = 0; _tileBuiltFrame = 0; });
      }
      _tileBuiltFrame++;
      tc = document.createElement('canvas');
      tc.width = tc.height = pw;
      const tx = tc.getContext('2d');
      const sx = pw / s;
      tx.save();
      tx.scale(sx, sx);
      rrPath(tx, 0, 0, s, s, rad);
      tx.clip();
      tx.drawImage(im, 0, 0, s, s);
      tx.restore();
      tx.save();
      tx.scale(sx, sx);
      rrPath(tx, .5, .5, s - 1, s - 1, rad);
      tx.lineWidth = 1;
      tx.strokeStyle = 'rgba(128,128,128,.22)';
      tx.stroke();
      tx.restore();
      try {
        if (!im._tiles) im._tiles = {};
        const tKeys = Object.keys(im._tiles);
        if (tKeys.length >= 3) {
          const oldT = im._tiles[tKeys[0]];
          delete im._tiles[tKeys[0]];
          if (oldT && 'width' in oldT) { try { oldT.width = oldT.height = 0; } catch (e) {} }
        }
        im._tiles[key] = tc;
      } catch (e) {}
    }
    if (tc) {
      c.drawImage(tc, x, y, s, s);
      return;
    }
  }
  c.save(); rrPath(c, x, y, s, s, rad); c.clip();
  if (a < 0.999) {
    const ph = typeof _PHC !== 'undefined' ? _PHC[(typeof pal !== 'undefined' && pal && !pal.dark) ? 'l' : 'd'] : null;
    if (ph && ph.width > 0) {
      c.drawImage(ph, x, y, s, s);
    } else {
      c.fillStyle = (typeof pal !== 'undefined' && pal && !pal.dark) ? '#e6e6ec' : '#18181c';
      c.fillRect(x, y, s, s);
    }
    c.globalAlpha *= a;
  }
  if (im && im.width > 0) c.drawImage(im, x, y, s, s);
  c.restore();
  c.save(); rrPath(c, x + .5, y + .5, s - 1, s - 1, rad); c.lineWidth = 1; c.strokeStyle = 'rgba(128,128,128,.22)'; c.stroke(); c.restore();
}
function artColors(item) { const H = (item.kind === 'track' ? albumOf(item) : item).hue; return [hsl(H, 62, 30), hsl(H + 40, 70, 42), hsl(H - 30, 65, 36), hsl(H + 10, 70, 18)]; }

const _COLC = {};
function splitCol(col) {
  if (!col) return ['#000', 1];
  if (_COLC[col]) return _COLC[col];
  let m = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i.exec(col);
  if (m) return (_COLC[col] = ['rgb(' + (m[1] | 0) + ',' + (m[2] | 0) + ',' + (m[3] | 0) + ')', +m[4]]);
  m = /^hsla\(\s*([\d.+-]+)\s*,\s*([\d.]+%)\s*,\s*([\d.]+%)\s*,\s*([\d.]+)\s*\)$/i.exec(col);
  if (m) return (_COLC[col] = ['hsl(' + m[1] + ',' + m[2] + ',' + m[3] + ')', +m[4]]);
  return (_COLC[col] = [col, 1]);
}
const _TAU = Math.PI * 2;
const _ICON_EMPTY = {};
const _HOME_R = 1.2, _HOME_A = Math.atan2(9.5, 10.5);
const _PLAY_TRI = [[-7.2, -10.2], [10.4, 0], [-7.2, 10.2]];
const _FWD_TRI1 = [[-11.6, -7.8], [-.4, 0], [-11.6, 7.8]], _FWD_TRI2 = [[.2, -7.8], [11.4, 0], [.2, 7.8]];
const _STAR_PTS = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5.1 : 9.6;
  return [Math.cos(a) * r, Math.sin(a) * r + .8];
});
const _DOTS_X = [-6.5, 0, 6.5];
const _RADIO_R = [5.8, 10], _RADIO_SG = [-1, 1];
const _SHUFFLE_Y = [-6, 6];
const _AIRPLAY_R = [5.4, 9.2], _AIRPLAY_TRI = [[0, 1.8], [6.6, 10.6], [-6.6, 10.6]];
const _QUEUE_Y = [-5.8, 0, 5.8];
const _LOSSLESS_RIBBON_D = 'M110,510 C123,431 150,357 190,309 C198,300 263,232 351,300 C465,388 512,722 595,840 C624,881 666,885 705,843 C747,798 767,721 780,680 L794,680 C766,813 718,887 670,898 C631,907 585,920 523,840 C432,721 393,473 328,360 C308,326 267,266 204,330 C159,376 141,450 123,510Z';
const _LOSSLESS_TAIL_D = 'M94,633 C119,453 150,388 189,330 M722,840 C733,821 789,747 812,542';
const _LOSSLESS_OFFS = [0, 137.5, 275];
let _losslessMask = null;
const _losslessTintCache = {};
function _buildLosslessMask() {
  if (_losslessMask) return _losslessMask;
  const MW = 208, MH = 134;
  const m = document.createElement('canvas'); m.width = MW; m.height = MH;
  const mc = m.getContext('2d');
  const p = document.createElement('canvas'); p.width = MW; p.height = MH;
  const pc = p.getContext('2d');
  const sc = MW / 1038;
  const rib = new Path2D(_LOSSLESS_RIBBON_D), tail = new Path2D(_LOSSLESS_TAIL_D);
  const setupXform = (ctx, dx) => { ctx.setTransform(sc, 0, 0, sc, (-72 + dx) * sc, -254 * sc); };
  const cut = (cuts, clipFn) => {
    pc.save();
    pc.globalCompositeOperation = 'destination-out';
    if (clipFn) { pc.setTransform(1, 0, 0, 1, 0, 0); pc.beginPath(); clipFn(); pc.clip(); }
    pc.lineWidth = 18; pc.lineJoin = 'round'; pc.strokeStyle = '#000';
    for (let k = 0; k < cuts.length; k++) { setupXform(pc, _LOSSLESS_OFFS[cuts[k]]); pc.stroke(rib); }
    pc.restore();
  };
  const upY = (600 - 254) * sc;
  const nCutUp = [[], [0], [0, 1]], nCutLo = [[1, 2], [2], []], tCut = [[1, 2], [0, 2], [0, 1]];
  for (let i = 0; i < 3; i++) {
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, MW, MH);
    setupXform(pc, _LOSSLESS_OFFS[i]); pc.fillStyle = '#000'; pc.fill(rib);
    if (nCutUp[i].length) cut(nCutUp[i], () => pc.rect(0, 0, MW, upY));
    if (nCutLo[i].length) cut(nCutLo[i], () => pc.rect(0, upY, MW, MH - upY));
    mc.drawImage(p, 0, 0);
  }
  for (let i = 0; i < 3; i++) {
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.clearRect(0, 0, MW, MH);
    setupXform(pc, _LOSSLESS_OFFS[i]); pc.lineWidth = 15; pc.lineCap = 'round'; pc.strokeStyle = '#000'; pc.stroke(tail);
    cut(tCut[i], null);
    mc.drawImage(p, 0, 0);
  }
  p.width = p.height = 0;
  return (_losslessMask = m);
}
function _drawLosslessIcon(c, rgb) {
  let tc = _losslessTintCache[rgb];
  if (!tc) {
    const mask = _buildLosslessMask();
    tc = document.createElement('canvas'); tc.width = mask.width; tc.height = mask.height;
    const tx = tc.getContext('2d');
    tx.drawImage(mask, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = rgb;
    tx.fillRect(0, 0, tc.width, tc.height);
    const ks = Object.keys(_losslessTintCache);
    if (ks.length >= 12) { const old = _losslessTintCache[ks[0]]; delete _losslessTintCache[ks[0]]; if (old) old.width = old.height = 0; }
    _losslessTintCache[rgb] = tc;
  }
  const w = 26, h = 26 * (667 / 1038);
  c.drawImage(tc, -w / 2, -h / 2, w, h);
}
const _LIB_PL_LINES = [[-10, 2, -7], [-10, 2, -1.5], [-10, -3, 4]];
const _NOTE_STEM = [[.4, 6.2], [.4, -9.4], [9.2, -6.7], [9.2, -2.6], [.4, -5.2]];
const _SPK0_POLY = [[2.4 - 8.8, -3.4], [2.4 - 4.6, -3.4], [2.4 + 1.1, -8.2], [2.4 + 1.1, 8.2], [2.4 - 4.6, 3.4], [2.4 - 8.8, 3.4]];
const _SPK1_POLY = [[-1.2 - 8.8, -3.4], [-1.2 - 4.6, -3.4], [-1.2 + 1.1, -8.2], [-1.2 + 1.1, 8.2], [-1.2 - 4.6, 3.4], [-1.2 - 8.8, 3.4]];
const _SPK_RADII = [4.2, 7.8];
const _GRIP_Y = [-4.5, 0, 4.5];
const _WAVE_X = [-8, -4, 0, 4, 8], _WAVE_IDLE = [3.2, 5.2, 7.6, 4.8, 3.2], _WAVE_CUR = [0, 0, 0, 0, 0];
const _GRID4_POS = [[-8, -8], [1.6, -8], [-8, 1.6], [1.6, 1.6]];
const _FOLDER_POLY = [[-9, -6.5], [-2.5, -6.5], [-.2, -4], [9, -4], [9, 6.8], [-9, 6.8]];
const _EQ_PTS = [[-6.5, -2.5], [0, 3.5], [6.5, -4]];
const _SLIDERS_PTS = [[-6, -3], [0, 3], [6, -2]];
const _SUN_RAYS = Array.from({ length: 8 }, (_, i) => {
  const a = i * Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
  return [cs * 6.8, sn * 6.8, cs * 9.6, sn * 9.6];
});
const _GEAR_D = 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915Z';
let _GEAR_PATH = null;
try { if (typeof Path2D !== 'undefined') _GEAR_PATH = new Path2D(_GEAR_D); } catch (e) {}
function _rPoly(c, pts, r) {
  const m = pts.length, p0 = pts[m - 1], p1 = pts[0];
  c.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
  for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % m]; c.arcTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, r); }
  c.closePath();
}
function _lyBub(c) {
  c.moveTo(-5.8, -9.2); c.lineTo(5.8, -9.2); c.arcTo(10.2, -9.2, 10.2, -4.8, 4.4);
  c.lineTo(10.2, 1.8); c.arcTo(10.2, 6.2, 5.8, 6.2, 4.4); c.lineTo(1.2, 6.2);
  c.lineTo(-4.8, 10.6); c.lineTo(-4.2, 6.2); c.lineTo(-5.8, 6.2);
  c.arcTo(-10.2, 6.2, -10.2, 1.8, 4.4); c.lineTo(-10.2, -4.8); c.arcTo(-10.2, -9.2, -5.8, -9.2, 4.4); c.closePath();
}
function _lyQMark(c, dx) {
  c.moveTo(dx + 1.85, -2.5);
  c.arc(dx, -2.5, 1.85, 0, Math.PI * .62, true);
  c.quadraticCurveTo(dx + .25, .2, dx - 1.2, 1.5);
  c.arcTo(dx - 1.8, 2.05, dx - 1.1, 2.75, .82);
  c.quadraticCurveTo(dx - .4, 3.05, dx + .25, 2.45);
  c.quadraticCurveTo(dx + 2.02, .75, dx + 1.85, -2.5);
  c.closePath();
}
function icon(c, n, x, y, s, col, o) {
  o = o || _ICON_EMPTY;
  const [rgb, al] = splitCol(col), TAU = _TAU;
  c.save(); c.translate(x, y); const u = s / 24; c.scale(u, u);
  c.globalAlpha *= al; c.fillStyle = c.strokeStyle = rgb; c.lineWidth = o.lw || 2; c.lineCap = c.lineJoin = 'round';
  switch (n) {
    case 'home':
      c.beginPath();
      c.arc(0, -10, _HOME_R, -Math.PI + _HOME_A, -_HOME_A);
      c.arc(10.5, -.5, _HOME_R, -_HOME_A, Math.PI / 2);
      c.lineTo(9.7, .7); c.lineTo(9.7, 9.5);
      c.arc(8.5, 9.5, _HOME_R, 0, Math.PI / 2);
      c.lineTo(2.8, 10.7); c.arc(2.8, 9.5, _HOME_R, Math.PI / 2, Math.PI);
      c.lineTo(1.6, 4.7); c.lineTo(-1.6, 4.7); c.lineTo(-1.6, 9.5);
      c.arc(-2.8, 9.5, _HOME_R, 0, Math.PI / 2);
      c.lineTo(-8.5, 10.7); c.arc(-8.5, 9.5, _HOME_R, Math.PI / 2, Math.PI);
      c.lineTo(-9.7, .7);
      c.arc(-10.5, -.5, _HOME_R, Math.PI / 2, Math.PI + _HOME_A);
      c.closePath();
      c.fill(); break;
    case 'new': for (let i = 0; i < 4; i++) { rrPath(c, (i % 2 ? .9 : -9.5), (i > 1 ? .9 : -9.5), 8.6, 8.6, 2.6); c.fill(); } break;
    case 'radio':
      c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fill();
      c.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const k = _RADIO_R[i]; for (let j = 0; j < 2; j++) { const sg = _RADIO_SG[j]; c.beginPath(); c.arc(0, 0, k, sg > 0 ? -.8 : Math.PI - .8, sg > 0 ? .8 : Math.PI + .8); c.stroke(); } }
      break;
    case 'library':
      c.lineWidth = 1.9; c.beginPath(); c.moveTo(-6, -10.2); c.lineTo(6, -10.2); c.stroke();
      c.beginPath(); c.moveTo(-8, -6.6); c.lineTo(8, -6.6); c.stroke();
      rrPath(c, -10, -3.2, 20, 13.4, 3.2); c.lineWidth = 2; c.stroke();
      c.beginPath(); c.arc(-1.8, 5.8, 1.9, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(0, 4.2); c.lineTo(0, .6); c.lineTo(3.8, 1.6); c.lineWidth = 1.7; c.stroke();
      break;
    case 'search':
      c.lineWidth = 2.6; c.beginPath(); c.arc(-1.5, -1.5, 7.4, 0, TAU); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(4.2, 4.2); c.lineTo(10, 10); c.lineWidth = 3; c.stroke();
      break;
    case 'play': c.beginPath(); _rPoly(c, _PLAY_TRI, 1.85); c.fill(); break;
    case 'pause': rrPath(c, -7.8, -9.2, 5.4, 18.4, 2.1); c.fill(); rrPath(c, 2.4, -9.2, 5.4, 18.4, 2.1); c.fill(); break;
    case 'fwd': case 'back': if (n === 'back') c.scale(-1, 1); c.beginPath(); _rPoly(c, _FWD_TRI1, 1.35); _rPoly(c, _FWD_TRI2, 1.35); c.fill(); break;
    case 'star': {
      c.lineWidth = o.lw || 2.1;
      c.beginPath();
      for (let i = 0; i < 10; i++) { const pt = _STAR_PTS[i]; if (i) c.lineTo(pt[0], pt[1]); else c.moveTo(pt[0], pt[1]); }
      c.closePath();
      if (o.fill) c.fill();
      c.stroke();
      break;
    }
    case 'dots': for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(_DOTS_X[i], 0, 1.9, 0, TAU); c.fill(); } break;
    case 'shuffle':
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-10, -6); c.lineTo(-5, -6); c.bezierCurveTo(-1, -6, -1, 6, 3, 6); c.lineTo(8, 6); c.stroke();
      c.beginPath(); c.moveTo(-10, 6); c.lineTo(-5, 6); c.bezierCurveTo(-3, 6, -2.5, 4.2, -2, 3.2); c.stroke();
      c.beginPath(); c.moveTo(3, -6); c.lineTo(8, -6); c.stroke();
      for (let i = 0; i < 2; i++) { const yy = _SHUFFLE_Y[i]; c.beginPath(); c.moveTo(6, yy - 3.4); c.lineTo(10, yy); c.lineTo(6, yy + 3.4); c.stroke(); }
      break;
    case 'repeat':
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-5, -7); c.lineTo(5, -7); c.arcTo(10, -7, 10, -2, 5); c.lineTo(10, 0); c.stroke();
      c.beginPath(); c.moveTo(5, 7); c.lineTo(-5, 7); c.arcTo(-10, 7, -10, 2, 5); c.lineTo(-10, 0); c.stroke();
      c.beginPath(); c.moveTo(-8, -10); c.lineTo(-4.6, -7); c.lineTo(-8, -4); c.stroke();
      c.beginPath(); c.moveTo(8, 10); c.lineTo(4.6, 7); c.lineTo(8, 4); c.stroke();
      if (o.one) {
        c.lineWidth = 1.85; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(-1.15, -1.8); c.lineTo(1.15, -3.8); c.lineTo(1.15, 3.8); c.stroke();
      }
      break;
    case 'infinity': c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(3, -6.5, 10.5, -6.5, 10.5, 0); c.bezierCurveTo(10.5, 6.5, 3, 6.5, 0, 0); c.bezierCurveTo(-3, -6.5, -10.5, -6.5, -10.5, 0); c.bezierCurveTo(-10.5, 6.5, -3, 6.5, 0, 0); c.stroke(); break;
    case 'lyrics':
      if (o.fill) { c.beginPath(); _lyBub(c); _lyQMark(c, -3.1); _lyQMark(c, 2.7); c.fill('evenodd'); }
      else { c.lineWidth = 2.1; c.beginPath(); _lyBub(c); c.stroke(); c.beginPath(); _lyQMark(c, -3.1); _lyQMark(c, 2.7); c.fill(); }
      break;
    case 'airplay':
      c.beginPath(); c.arc(0, -1.8, 1.9, 0, TAU); c.fill();
      c.lineWidth = 2.1;
      for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(0, -1.8, _AIRPLAY_R[i], -Math.PI * 1.23, Math.PI * .23); c.stroke(); }
      c.beginPath(); _rPoly(c, _AIRPLAY_TRI, 1.3); c.fill();
      break;
    case 'queue': c.lineWidth = 2.4; for (let i = 0; i < 3; i++) { const yy = _QUEUE_Y[i]; c.beginPath(); c.arc(-8.4, yy, 1.65, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-3.4, yy); c.lineTo(9.6, yy); c.stroke(); } break;
    case 'lossless': _drawLosslessIcon(c, rgb); break;
    case 'chev': c.lineWidth = o.lw || 2.6; c.beginPath(); c.moveTo(-3.5, -7); c.lineTo(3.5, 0); c.lineTo(-3.5, 7); c.stroke(); break;
    case 'chevl': c.lineWidth = o.lw || 2.8; c.beginPath(); c.moveTo(3.5, -8); c.lineTo(-3.5, 0); c.lineTo(3.5, 8); c.stroke(); break;
    case 'chevu': c.lineWidth = o.lw || 3; c.beginPath(); c.moveTo(-8, 3); c.lineTo(0, -4); c.lineTo(8, 3); c.stroke(); break;
    case 'chevd': c.lineWidth = o.lw || 3; c.beginPath(); c.moveTo(-8, -3); c.lineTo(0, 4); c.lineTo(8, -3); c.stroke(); break;
    case 'x': c.lineWidth = 2.6; c.beginPath(); c.moveTo(-6, -6); c.lineTo(6, 6); c.moveTo(6, -6); c.lineTo(-6, 6); c.stroke(); break;
    case 'pin': c.rotate(.6); rrPath(c, -4, -10, 8, 3.4, 1.4); c.fill(); c.beginPath(); c.moveTo(-3, -7); c.lineTo(-3, -1.5); c.lineTo(-6.6, 3); c.lineTo(6.6, 3); c.lineTo(3, -1.5); c.lineTo(3, -7); c.closePath(); c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(0, 3); c.lineTo(0, 11); c.lineWidth = 2.2; c.stroke(); break;
    case 'mic': c.rotate(.65); rrPath(c, -3.8, -10.5, 7.6, 12, 3.8); c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(-3.8, -4); c.lineTo(3.8, -4); c.stroke(); c.beginPath(); c.moveTo(0, 1.5); c.lineTo(0, 11); c.lineWidth = 2.4; c.stroke(); break;
    case 'lib-playlist': c.lineWidth = 2.2; for (let i = 0; i < 3; i++) { const ln = _LIB_PL_LINES[i]; c.beginPath(); c.moveTo(ln[0], ln[2]); c.lineTo(ln[1], ln[2]); c.stroke(); } c.beginPath(); c.arc(5.2, 6.4, 3, 0, TAU); c.fill(); c.beginPath(); c.moveTo(8.2, 4.2); c.lineTo(8.2, -6); c.lineTo(12, -4.6); c.lineWidth = 2; c.stroke(); break;
    case 'lib-album': c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -10); c.lineTo(6, -10); c.stroke(); c.beginPath(); c.moveTo(-8, -6.6); c.lineTo(8, -6.6); c.stroke(); rrPath(c, -10, -3.4, 20, 14, 3.4); c.stroke(); break;
    case 'note': c.beginPath(); c.ellipse(-3.4, 7, 4.2, 3.4, -.4, 0, TAU); c.fill(); c.beginPath(); _rPoly(c, _NOTE_STEM, .8); c.fill(); break;
    case 'down': c.beginPath(); c.arc(0, 0, 9.6, 0, TAU); c.closePath(); c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(0, -5); c.lineTo(0, 4.4); c.moveTo(-4, 1); c.lineTo(0, 5); c.lineTo(4, 1); c.stroke(); break;
    case 'arrowd': c.lineWidth = o.lw || 2.1; c.beginPath(); c.moveTo(0, -7.2); c.lineTo(0, 6.4); c.moveTo(-5.2, 1.4); c.lineTo(0, 6.8); c.lineTo(5.2, 1.4); c.stroke(); break;
    case 'spk0': case 'spk1': {
      const poly = n === 'spk0' ? _SPK0_POLY : _SPK1_POLY, ox = n === 'spk0' ? 2.4 : -1.2;
      c.beginPath(); _rPoly(c, poly, .9); c.fill();
      if (n === 'spk1') { c.lineWidth = 2; for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(ox + .2, 0, _SPK_RADII[i], -.78, .78); c.stroke(); } }
      break;
    }
    case 'grip': c.lineWidth = 2; for (let i = 0; i < 3; i++) { const yy = _GRIP_Y[i]; c.beginPath(); c.moveTo(-8, yy); c.lineTo(8, yy); c.stroke(); } break;
    case 'wave': {
      if (typeof _waveVis !== 'undefined') _waveVis = true;
      c.lineWidth = 2.4;
      const t = (typeof PL !== 'undefined' && PL.playing) ? performance.now() * .0085 : 0;
      let hs;
      if (t) {
        _WAVE_CUR[0] = 3.2 + 5.4 * (.5 + .5 * Math.sin(t * 1.35 + .2));
        _WAVE_CUR[1] = 3.8 + 9.2 * (.5 + .5 * Math.sin(t * 1.85 + 1.7));
        _WAVE_CUR[2] = 4.2 + 10.6 * (.5 + .5 * Math.sin(t * 1.55 + 3.1));
        _WAVE_CUR[3] = 3.6 + 8.6 * (.5 + .5 * Math.sin(t * 2.05 + 4.6));
        _WAVE_CUR[4] = 3.2 + 5.0 * (.5 + .5 * Math.sin(t * 1.45 + 2.3));
        hs = _WAVE_CUR;
      } else hs = _WAVE_IDLE;
      for (let i = 0; i < 5; i++) { const dx = _WAVE_X[i], h = hs[i]; c.beginPath(); c.moveTo(dx, -h / 2); c.lineTo(dx, h / 2); c.stroke(); }
      break;
    }
    case 'share': c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -1); c.lineTo(-8, -1); c.lineTo(-8, 10); c.lineTo(8, 10); c.lineTo(8, -1); c.lineTo(5, -1); c.stroke(); c.beginPath(); c.moveTo(0, -10.2); c.lineTo(0, 4); c.moveTo(-4.5, -6.5); c.lineTo(0, -11); c.lineTo(4.5, -6.5); c.stroke(); break;
    case 'sort': c.lineWidth = 2.2; c.beginPath(); c.moveTo(-4.5, -8); c.lineTo(-4.5, 7.2); c.moveTo(-8.5, 4); c.lineTo(-4.5, 8); c.lineTo(-.5, 4); c.stroke(); c.beginPath(); c.moveTo(5, 8); c.lineTo(5, -7.2); c.moveTo(1, -4); c.lineTo(5, -8); c.lineTo(9, -4); c.stroke(); break;
    case 'check': c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-3, 6); c.lineTo(8, -7); c.stroke(); break;
    case 'stats': c.lineWidth = 1.9; rrPath(c, -8.5, -8.5, 17, 17, 3.2); c.stroke(); c.beginPath(); c.moveTo(-4.2, 4.8); c.lineTo(-4.2, .2); c.moveTo(0, 4.8); c.lineTo(0, -4.6); c.moveTo(4.2, 4.8); c.lineTo(4.2, -1.8); c.stroke(); break;
    case 'grid4': c.lineWidth = 1.9; for (let i = 0; i < 4; i++) { const g = _GRID4_POS[i]; rrPath(c, g[0], g[1], 6.4, 6.4, 1.6); c.stroke(); } break;
    case 'folder': c.lineWidth = 2; c.beginPath(); _rPoly(c, _FOLDER_POLY, 1.8); c.stroke(); break;
    case 'clock': c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 9.2, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(0, -5); c.lineTo(0, .5); c.lineTo(4, 2.8); c.stroke(); break;
    case 'gear':
      c.lineWidth = o.lw || 1.9;
      if (_GEAR_PATH) {
        c.save(); c.translate(-12, -12);
        c.stroke(_GEAR_PATH);
        c.restore();
      } else {
        c.beginPath(); c.arc(0, 0, 8.2, 0, TAU); c.stroke();
      }
      c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.stroke();
      break;
    case 'user':
      c.beginPath(); c.arc(0, -3.5, 4.1, 0, TAU); c.fill();
      c.beginPath();
      c.moveTo(-8.2, 8.6);
      c.quadraticCurveTo(-7.6, 2.5, 0, 2.5);
      c.quadraticCurveTo(7.6, 2.5, 8.2, 8.6);
      c.quadraticCurveTo(8.2, 10.2, 6.4, 10.2);
      c.lineTo(-6.4, 10.2);
      c.quadraticCurveTo(-8.2, 10.2, -8.2, 8.6);
      c.closePath();
      c.fill();
      break;
    case 'eq':
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const gx = _EQ_PTS[i][0], gy = _EQ_PTS[i][1];
        c.beginPath(); c.moveTo(gx, -9); c.lineTo(gx, gy - 2.6); c.moveTo(gx, gy + 2.6); c.lineTo(gx, 9); c.stroke();
        c.beginPath(); c.arc(gx, gy, 2.4, 0, TAU); c.stroke();
      }
      break;
    case 'drop':
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -9.8);
      c.bezierCurveTo(4.6, -3.5, 7.6, .6, 7.6, 4.2);
      c.arc(0, 3.6, 7.6, .08, Math.PI - .08);
      c.bezierCurveTo(-7.6, .6, -4.6, -3.5, 0, -9.8);
      c.closePath();
      if (o.fill) c.fill(); else c.stroke();
      break;
    case 'sliders':
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const yy = _SLIDERS_PTS[i][0], gx = _SLIDERS_PTS[i][1];
        c.beginPath(); c.moveTo(-9, yy); c.lineTo(gx - 2.5, yy); c.moveTo(gx + 2.5, yy); c.lineTo(9, yy); c.stroke();
        c.beginPath(); c.arc(gx, yy, 2.3, 0, TAU); c.stroke();
      }
      break;
    case 'info':
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 9.4, 0, TAU); c.stroke();
      c.beginPath(); c.arc(0, -4.4, 1.3, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(0, -1); c.lineTo(0, 5.2); c.stroke();
      break;
    case 'sun':
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 4.2, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) {
        const r = _SUN_RAYS[i];
        c.beginPath(); c.moveTo(r[0], r[1]); c.lineTo(r[2], r[3]); c.stroke();
      }
      break;
    case 'moon':
      c.lineWidth = 2;
      c.beginPath();
      c.arc(1.2, -.8, 7.8, .45, Math.PI * 1.42);
      c.arc(-2.6, -3.4, 6.8, Math.PI * 1.32, .35, true);
      c.closePath();
      c.stroke();
      break;
    case 'trash':
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-8.5, -5.5); c.lineTo(8.5, -5.5); c.moveTo(-3.2, -5.5); c.lineTo(-2.4, -8.5); c.lineTo(2.4, -8.5); c.lineTo(3.2, -5.5); c.stroke();
      c.beginPath(); c.moveTo(-6.4, -5.5); c.lineTo(-5.4, 8.2); c.arcTo(-5.2, 9.5, -3.5, 9.5, 1.6); c.lineTo(3.5, 9.5); c.arcTo(5.2, 9.5, 5.4, 8.2, 1.6); c.lineTo(6.4, -5.5); c.stroke();
      c.beginPath(); c.moveTo(-2.2, -1.5); c.lineTo(-2.2, 5.5); c.moveTo(2.2, -1.5); c.lineTo(2.2, 5.5); c.stroke();
      break;
    case 'bluetooth':
      c.lineWidth = 2.05;
      c.beginPath(); c.moveTo(-4.5, -4.5); c.lineTo(4.5, 4.5); c.lineTo(0, 9); c.lineTo(0, -9); c.lineTo(4.5, -4.5); c.lineTo(-4.5, 4.5); c.stroke();
      break;
    case 'bt-gear': {
      c.lineWidth = o.lw || 1.65;
      const bx = -4.0;
      c.beginPath();
      c.moveTo(bx - 3.5, -4.0); c.lineTo(bx + 3.5, 3.6); c.lineTo(bx, 7.8);
      c.lineTo(bx, -7.8); c.lineTo(bx + 3.5, -3.6); c.lineTo(bx - 3.5, 4.0);
      c.stroke();
      const gx = 4.8, gy = 4.0, gr = 2.6, tr = 4.2;
      c.beginPath();
      c.arc(gx, gy, gr, 0, TAU);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, cs = Math.cos(a), sn = Math.sin(a);
        c.moveTo(gx + cs * gr, gy + sn * gr);
        c.lineTo(gx + cs * tr, gy + sn * tr);
      }
      c.stroke();
      break;
    }
    case 'headphones':
      c.lineWidth = 2.05;
      c.beginPath(); c.arc(0, 0, 8.6, Math.PI, 0); c.stroke();
      rrPath(c, -9.8, 0, 4.4, 8, 2.2); c.fill();
      rrPath(c, 5.4, 0, 4.4, 8, 2.2); c.fill();
      break;
    case 'usb':
      c.lineWidth = 2;
      rrPath(c, -5.8, -4.5, 11.6, 13, 3.2); c.stroke();
      c.beginPath(); c.moveTo(-3.2, -4.5); c.lineTo(-3.2, -9); c.lineTo(3.2, -9); c.lineTo(3.2, -4.5); c.stroke();
      c.beginPath(); c.moveTo(0, 8.5); c.lineTo(0, 11); c.stroke();
      break;
    case 'spark':
      c.beginPath();
      c.moveTo(0, -10); c.quadraticCurveTo(1.2, -1.2, 10, 0);
      c.quadraticCurveTo(1.2, 1.2, 0, 10); c.quadraticCurveTo(-1.2, 1.2, -10, 0);
      c.quadraticCurveTo(-1.2, -1.2, 0, -10); c.closePath();
      if (o.fill) c.fill(); else c.stroke();
      break;
    case 'smart': {
      const star = (cx, cy, r, w) => {
        c.moveTo(cx, cy - r);
        c.quadraticCurveTo(cx + w, cy - w, cx + r, cy);
        c.quadraticCurveTo(cx + w, cy + w, cx, cy + r);
        c.quadraticCurveTo(cx - w, cy + w, cx - r, cy);
        c.quadraticCurveTo(cx - w, cy - w, cx, cy - r);
        c.closePath();
      };
      c.beginPath();
      star(-2.2, 1.6, 8.8, 1.55);
      star(6.8, -6.2, 3.9, 0.78);
      if (o.stroke) { c.lineWidth = o.lw || 1.6; c.stroke(); }
      else c.fill();
      break;
    }
    case 'plus':
      c.lineWidth = o.lw || 2.3;
      c.beginPath();
      c.moveTo(0, -6.8); c.lineTo(0, 6.8);
      c.moveTo(-6.8, 0); c.lineTo(6.8, 0);
      c.stroke();
      break;
    case 'plus-circle':
      c.lineWidth = o.lw || 1.9;
      c.beginPath(); c.arc(0, 0, 9.6, 0, TAU); c.stroke();
      c.beginPath();
      c.moveTo(0, -4.6); c.lineTo(0, 4.6);
      c.moveTo(-4.6, 0); c.lineTo(4.6, 0);
      c.stroke();
      break;
    case 'refresh': {
      c.lineWidth = o.lw || 2.1;
      const r = 7.6, a0 = 0.38, a1 = TAU - 0.52;
      c.beginPath(); c.arc(0, 0, r, a0, a1); c.stroke();
      const ex = r * Math.cos(a1), ey = r * Math.sin(a1);
      c.beginPath();
      c.moveTo(ex - 0.1, ey - 4.2);
      c.lineTo(ex, ey);
      c.lineTo(ex - 4.0, ey - 1.3);
      c.stroke();
      break;
    }
  }
  c.restore();
}
function _relLuma(r, g, b) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function _parseCssRgb(col) {
  if (!col || typeof col !== 'string') return null;
  const s = col.trim();
  if (s[0] === '#') {
    const hex = s.length === 4 ? s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s.slice(1, 7);
    if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function dlBadgeColors(tn, accCss, isDark) {
  let fillRgb = null;
  let arrowRgb = null;
  if (tn && tn._accent) {
    const [h, s, l] = rgb2hsl(tn._accent[0], tn._accent[1], tn._accent[2]);
    if (isDark) {
      fillRgb = s < 0.08
        ? [220, 220, 226]
        : hsl2rgb(h, clamp(s * 0.72, 0.42, 0.68), clamp(l * 1.18, 0.66, 0.74));
      arrowRgb = s < 0.08
        ? [34, 34, 38]
        : hsl2rgb(h, clamp(s * 0.36, 0.18, 0.34), 0.18);
    } else {
      fillRgb = tn._accent.slice(0, 3);
    }
  } else {
    const base = _parseCssRgb(accCss) || [250, 46, 73];
    if (isDark) {
      const [h, s, l] = rgb2hsl(base[0], base[1], base[2]);
      fillRgb = s < 0.08
        ? [212, 212, 218]
        : hsl2rgb(h, clamp(s * 0.88, 0.50, 0.84), clamp(l * 1.09, 0.61, 0.66));
      arrowRgb = s < 0.08
        ? [24, 24, 28]
        : hsl2rgb(h, clamp(s * 0.42, 0.20, 0.40), 0.085);
    } else {
      fillRgb = base;
    }
  }
  if (!arrowRgb) {
    arrowRgb = _relLuma(fillRgb[0], fillRgb[1], fillRgb[2]) > 0.34 ? [26, 26, 30] : [255, 255, 255];
  }
  return {
    fill: 'rgb(' + Math.round(fillRgb[0]) + ',' + Math.round(fillRgb[1]) + ',' + Math.round(fillRgb[2]) + ')',
    arrow: 'rgb(' + Math.round(arrowRgb[0]) + ',' + Math.round(arrowRgb[1]) + ',' + Math.round(arrowRgb[2]) + ')'
  };
}
function drawDlBadge(c, cx, cy, r, fillCol, arrowCol) {
  if (!arrowCol) {
    const rgb = _parseCssRgb(fillCol);
    arrowCol = rgb && _relLuma(rgb[0], rgb[1], rgb[2]) > 0.34 ? '#1a1a1d' : '#ffffff';
  }
  c.save();
  c.translate(cx, cy);
  c.fillStyle = fillCol;
  c.beginPath();
  c.arc(0, 0, r, 0, _TAU);
  c.fill();
  c.strokeStyle = arrowCol;
  c.lineWidth = Math.max(1.25, r * (2 / 11));
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(0, -(5.5 / 11) * r);
  c.lineTo(0, (3.5 / 11) * r);
  c.moveTo(-(3.5 / 11) * r, (0.5 / 11) * r);
  c.lineTo(0, (4.0 / 11) * r);
  c.lineTo((3.5 / 11) * r, (0.5 / 11) * r);
  c.stroke();
  c.restore();
}

const PALC = {};
const SHAD_PALC = {};
function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }, q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]; }

let _PAL_CV = null, _PAL_CTX = null;
function artPalette(item) {
  if (item.kind === 'track') item = albumOf(item); if (PALC[item.id]) return PALC[item.id];
  const im = artOf(item);
  if (im && !im._real && im._placeholder) {
    const res = [[28, 28, 32], [44, 44, 50], [22, 22, 26], [36, 36, 42], [26, 26, 30], [18, 18, 22]];
    res._dom = [0, 0, .25];
    res._foot = [0, 0, .22];
    res._meta = [.25, .4, .22, .3];
    res._placeholder = true;
    return res;
  }
  const N = 24;
  if (!_PAL_CV) { _PAL_CV = document.createElement('canvas'); _PAL_CV.width = _PAL_CV.height = N; _PAL_CTX = _PAL_CV.getContext('2d', { willReadFrequently: true }); }
  const c = _PAL_CTX; c.clearRect(0, 0, N, N); if (im && im.width > 0) c.drawImage(im, 0, 0, N, N);
  const d = c.getImageData(0, 0, N, N).data, px = [];
  let fx = 0, fy = 0, fs = 0, fl = 0, fw = 0, dx = 0, dy = 0, ds = 0, dl = 0, dw = 0;
  let sumL = 0, darkCnt = 0, footSumL = 0, footCnt = 0, footDarkCnt = 0;
  for (let y = 0; y < N; y++) {
    const inFoot = y >= Math.floor(N * .76);
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const [h, s, l] = rgb2hsl(r, g, b), rad = h * Math.PI / 180, mx = Math.max(r, g, b) / 255, ch = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      sumL += l;
      if (l < .22) darkCnt++;
      if ((y & 1) === 0 && (x & 1) === 0) px.push({ r, g, b, h, s, l, ch, score: s * (1 - Math.abs(l - .5)) });
      const wD = ch * ch * (1 - Math.abs(l - .52) * 1.15) + .004;
      if (wD > 0) { dx += Math.cos(rad) * wD; dy += Math.sin(rad) * wD; ds += s * wD; dl += l * wD; dw += wD; }
      if (inFoot) {
        const wF = ch * mx + .025;
        fx += Math.cos(rad) * wF; fy += Math.sin(rad) * wF; fs += s * wF; fl += l * wF; fw += wF;
        footSumL += l;
        footCnt++;
        if (l < .22) footDarkCnt++;
      }
    }
  }
  const pick = [];
  px.sort((a, b) => b.score - a.score); pick.push(px[0]);
  while (pick.length < 6) {
    let best = null, bd = -1;
    for (let i = 0; i < px.length; i++) {
      const p = px[i];
      let m = 1e12;
      for (let j = 0; j < pick.length; j++) {
        const q = pick[j];
        const dd = (p.r - q.r) * (p.r - q.r) + (p.g - q.g) * (p.g - q.g) + (p.b - q.b) * (p.b - q.b);
        if (dd < m) m = dd;
      }
      if (m > bd) { bd = m; best = p; }
    }
    pick.push(best);
  }
  const res = pick.map(p => {
    const neu = p.ch < .12;
    if (neu) return hsl2rgb(p.h, 0, .16 + .38 * p.l);
    const isPink = p.h >= 320 && p.h <= 358;
    const s2 = clamp(p.s * (isPink ? 1.2 : 1.35), .35, .95);
    const h2 = isPink ? clamp(p.h, 334, 348) : p.h;
    const l2 = isPink ? clamp(p.l * 1.05, .46, .68) : clamp(p.l, .34, .64);
    return hsl2rgb(h2, s2, l2);
  });
  const domH = dw > 0 ? ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360 : 0, domS = dw > 0 ? ds / dw : 0, domL = dw > 0 ? dl / dw : .5;
  const footH = fw > 0 ? ((Math.atan2(fy, fx) * 180 / Math.PI) + 360) % 360 : domH, footS = fw > 0 ? fs / fw : domS, footL = fw > 0 ? fl / fw : domL;
  res._dom = [domH, domS, domL];
  res._foot = [footH, footS, footL];
  res._meta = [sumL / (N * N), darkCnt / (N * N), footCnt > 0 ? footSumL / footCnt : .42, footCnt > 0 ? footDarkCnt / footCnt : 0];
  return PALC[item.id] = res;
}

let _SPAL_CV = null, _SPAL_CTX = null;
function shaderPalette(item) {
  if (!item) return [[250, 46, 73], [255, 122, 69], [46, 211, 198], [27, 27, 27], [220, 40, 80], [35, 180, 170]];
  const alb = (!item.kind || item.kind === 'track') ? albumOf(item) : null;
  const albId = alb && alb.id;
  const trkId = item.id;
  if (trkId && SHAD_PALC[trkId]) return SHAD_PALC[trkId];
  if (albId && SHAD_PALC[albId]) return SHAD_PALC[albId];

  let art = (trkId && ARTC[trkId] && ARTC[trkId]._real && ARTC[trkId].width > 0) ? ARTC[trkId] : null;
  if (!art && albId && ARTC[albId] && ARTC[albId]._real && ARTC[albId].width > 0) {
    art = ARTC[albId];
  }
  if (!art) {
    art = artOf(item);
  }

  // Keep the current shader colors until real cover artwork loads instead of caching fallback hues.
  if (!art || !art._real) {
    if (typeof SH !== 'undefined' && SH.cols && SH.cols.length === 6) {
      return SH.cols.map(q => q.slice());
    }
    return [[250, 46, 73], [255, 122, 69], [46, 211, 198], [27, 27, 27], [220, 40, 80], [35, 180, 170]];
  }

  const N = 32;
  if (!_SPAL_CV) { _SPAL_CV = document.createElement('canvas'); _SPAL_CV.width = _SPAL_CV.height = N; _SPAL_CTX = _SPAL_CV.getContext('2d', { willReadFrequently: true }); }
  const c = _SPAL_CTX; c.clearRect(0, 0, N, N);
  if (art.width > 0) c.drawImage(art, 0, 0, N, N);
  const d = c.getImageData(0, 0, N, N).data;
  const bins = new Map();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      const bKey = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let e = bins.get(bKey); if (!e) { e = { n: 0, r: 0, g: 0, b: 0 }; bins.set(bKey, e); }
      e.n++; e.r += r; e.g += g; e.b += b;
    }
  }
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const list = [];
  bins.forEach(e => {
    const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n, ch = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    list.push({ c: [r, g, b], n: e.n, sc: e.n * (.5 + ch * 1.7) });
  });
  list.sort((a, b) => b.sc - a.sc);
  const cls = [];
  list.forEach(e => {
    let best = null, bd = 1e12; cls.forEach(k => { const dd = dist(e.c, k.c); if (dd < bd) { bd = dd; best = k; } });
    if (best && (bd < 2800 || cls.length >= 10)) { const w = best.sc + e.sc; best.c = best.c.map((v, i) => (v * best.sc + e.c[i] * e.sc) / w); best.sc = w; best.n += e.n; }
    else cls.push({ c: e.c.slice(), sc: e.sc, n: e.n });
  });
  cls.sort((a, b) => b.sc - a.sc);
  const total = N * N, big = cls.filter(k => k.n >= total * .012);
  const pick = (big.length >= 4 ? big : cls).slice(0, 6).map(k => k.c);
  if (!pick.length) {
    return [[250, 46, 73], [255, 122, 69], [46, 211, 198], [27, 27, 27], [220, 40, 80], [35, 180, 170]];
  }
  for (let i = 0; pick.length < 6 && i < 12; i++) {
    const [h, s, l] = rgb2hsl(...pick[i % pick.length]);
    const v = i % 2 ? -1 : 1;
    pick.push(hsl2rgb(h + v * (6 + i * 3), clamp(s, .2, .9), clamp(l + v * (.10 + .02 * i), .12, .82)));
  }
  const res = pick.map(p => {
    const [h, s, l] = rgb2hsl(...p), ch = (Math.max(...p) - Math.min(...p)) / 255, neu = ch < .12;
    if (neu) return hsl2rgb(h, 0, .16 + .38 * l);
    const isPink = h >= 320 && h <= 358;
    const s2 = clamp(s * (isPink ? 1.2 : 1.35), .35, .95);
    const h2 = isPink ? clamp(h, 334, 348) : h;
    const l2 = isPink ? clamp(l * 1.05, .46, .68) : clamp(l, .34, .64);
    return hsl2rgb(h2, s2, l2);
  });
  const firstChr = res.findIndex(p => (Math.max(...p) - Math.min(...p)) / 255 >= .12);
  if (firstChr > 0) { const [c] = res.splice(firstChr, 1); res.unshift(c); }
  if (trkId) SHAD_PALC[trkId] = res;
  if (albId) SHAD_PALC[albId] = res;
  return res;
}

function txt(c, s, x, y, font, col, align, maxW, subpx) {
  c.font = font; c.fillStyle = col; c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
  if (maxW) s = fit(c, s, maxW);
  if (subpx === false) c.fillText(s, Math.round(x), Math.round(y)); else c.fillText(s, x, y);
  return s;
}
const _FIT_CACHE = new Map(), _FIT_MAX = 800;
const _WRAP_CACHE = new Map(), _WRAP_MAX = 600;
function _clearFitCache() { _FIT_CACHE.clear(); _WRAP_CACHE.clear(); }
function fit(c, s, w) {
  if (!s) return s;
  const key = c.font + '\0' + w + '\0' + s;
  const hit = _FIT_CACHE.get(key);
  if (hit !== undefined) {
    _FIT_CACHE.delete(key);
    _FIT_CACHE.set(key, hit);
    return hit;
  }
  let res;
  if (c.measureText(s).width <= w) res = s;
  else {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c.measureText(s.slice(0, m) + '…').width <= w) lo = m; else hi = m - 1; }
    res = s.slice(0, lo).trimEnd() + '…';
  }
  if (_FIT_CACHE.size >= _FIT_MAX) _FIT_CACHE.delete(_FIT_CACHE.keys().next().value);
  _FIT_CACHE.set(key, res);
  return res;
}
function wrap(c, s, w) {
  const key = c.font + '|' + w + '|' + s;
  const hit = _WRAP_CACHE.get(key);
  if (hit !== undefined) {
    _WRAP_CACHE.delete(key);
    _WRAP_CACHE.set(key, hit);
    return hit.slice();
  }
  const words = s.split(' '), out = []; let line = '';
  words.forEach(wd => { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w && line) { out.push(line); line = wd; } else line = t; });
  if (line) out.push(line);
  if (_WRAP_CACHE.size >= _WRAP_MAX) _WRAP_CACHE.delete(_WRAP_CACHE.keys().next().value);
  _WRAP_CACHE.set(key, out);
  return out.slice();
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (v, t, rate, dt) => v + (t - v) * (1 - Math.exp(-rate * dt));
const mix = (a, b, t) => a + (b - a) * t;

let HITS = [], RAILS = [], T = { x: 0, y: 0 }, REG = true;
function hit(x, y, w, h, fn, extra) { if (REG) HITS.push(Object.assign({ x: x + T.x, y: y + T.y, w, h, fn }, extra || {})); }
const inR = (r, x, y, pad) => { pad = pad || 0; return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad; };
