const PAGES = {};
const vis = (P, y, h) => y + h > P.scroll - 30 && y < P.scroll + H + 30;
const isCur = t => cur() && cur().id === t.id;
const open = it => {
  if (isTr(it)) return playOne(it);
  if (it.kind === 'artist') {
    if (it.thumb && typeof isHqThumb === 'function' && !isHqThumb(it.thumb)) {
      it.thumb = null;
      if (it.id) delete ARTC[it.id];
    }
    if (LIVE.on && it.title && typeof fetchArtistThumb === 'function' &&
        (!it.thumb || (typeof isAppleArtistThumb === 'function' && !isAppleArtistThumb(it.thumb)))) {
      fetchArtistThumb(it.title, it.id).then(th => {
        if (th && (typeof isHqThumb !== 'function' || isHqThumb(th))) {
          const sameBase = Boolean(it.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(it.thumb, th));
          if (sameBase && /[?&]s=1200\b/.test(it.thumb) && !/[?&]s=1200\b/.test(th)) th = it.thumb;
          it.thumb = th;
          if (it.id && typeof BYID !== 'undefined' && BYID[it.id] && BYID[it.id] !== it) BYID[it.id].thumb = th;
          if (it.id && !sameBase) delete ARTC[it.id];
          if (typeof preloadArt === 'function') preloadArt(it, true);
          if (typeof redraw === 'function') redraw();
        }
      });
    }
  } else if (it.kind === 'album' && !it.user && it.id && String(it.id).indexOf('s_') !== 0) {
    if (LIVE.on && it.title && typeof fetchAlbumThumb === 'function' &&
        (!it.thumb || (typeof isAppleArtistThumb === 'function' && !isAppleArtistThumb(it.thumb)))) {
      fetchAlbumThumb(it.title, it.artist, it.id).then(th => {
        if (th) {
          const bothApple = it.thumb && typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(it.thumb) && isAppleArtistThumb(th);
          const sameBase = Boolean(it.thumb && typeof isSameCoverBase === 'function' && isSameCoverBase(it.thumb, th));
          if (sameBase && /[?&]s=1200\b/.test(it.thumb) && !/[?&]s=1200\b/.test(th)) th = it.thumb;
          it.thumb = th;
          if (typeof BYID !== 'undefined' && BYID[it.id] && BYID[it.id] !== it) BYID[it.id].thumb = th;
          if (!bothApple && !sameBase) delete ARTC[it.id];
          if (!sameBase) {
            if (typeof PALC !== 'undefined') delete PALC[it.id];
            if (typeof TINTC !== 'undefined') { delete TINTC[it.id + 'd']; delete TINTC[it.id + 'l']; }
          }
          if (typeof preloadArt === 'function') preloadArt(it, true);
          if (typeof redraw === 'function') redraw();
        }
      });
    }
  }
  if (LIVE.on && !it.loaded) liveLoad(it);
  if (it.kind === 'artist') push('artist', { item: it });
  else push('album', { item: it });
};
const trk = it => it.kind === 'album' || it.kind === 'playlist' ? it.tracks : [];
const subOf = it => it.kind === 'playlist' ? (it.desc || it.artist || t('common.playlist')) : it.kind === 'artist' ? (it.albums ? it.albums.length + ' ' + t(it.albums.length === 1 ? 'common.album' : 'common.albums').toLowerCase() : t('common.artist')) : it.artist;

function bigTitle(c, s) { if (CURP === stackOf()[0]) return; txt(c, s, 20, TOP + 38, F(700, 34), pal.fg); }
function eyebrow(c, s, x, y, col) { if (_canLS) c.letterSpacing = '.6px'; txt(c, s.toUpperCase(), x, y, F(600, 12), col || pal.sub); if (_canLS) c.letterSpacing = '0px'; }
const _canLS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
const _songTwCache = new Map();
function _measureSongTitle(c, shown) {
  let w = _songTwCache.get(shown);
  if (w !== undefined) return w;
  c.font = F(400, 16.5);
  w = c.measureText(shown).width;
  if (_songTwCache.size >= 400) _songTwCache.clear();
  _songTwCache.set(shown, w);
  return w;
}
function section(c, P, y, s, chev) {
  if (chev === 'big') { if (vis(P, y, 44)) txt(c, s, 20, y + 28, F(500, 26), pal.fg, 'left', W - 40); return y + 46; }
  if (vis(P, y, 40)) { txt(c, s, 20, y + 24, F(700, 22), pal.fg); if (chev) { c.font = F(700, 22); icon(c, 'chev', 20 + c.measureText(s).width + 12, y + 17, 13, pal.sub2, { lw: 3.2 }); } }
  return y + 42;
}
function rail(c, P, id, y, items, iw, gap, ch, draw, opt) {
  opt = opt || {}; const st = P.rails[id] || (P.rails[id] = { x: 0 }), ws = opt.widths || null;
  let total = 40;
  if (ws) {
    let sum = 20;
    for (let i = 0; i < items.length; i++) sum += ws[i] + gap;
    total = Math.max(40, sum - gap + 20);
  } else if (items.length) {
    total = Math.max(40, 20 + items.length * (iw + gap) - gap + 20);
  }
  const max = Math.max(0, total - W);
  st.max = max; st.snap = opt.snap || 0; if (REG) RAILS.push({ P, id, x: T.x, y: y + T.y, w: W, h: ch, max });
  if (!vis(P, y, ch)) return y + ch;
  c.save(); c.translate(-st.x, 0); const ox = T.x; T.x -= st.x;
  let ex = 20;
  for (let i = 0; i < items.length; i++) {
    const w = ws ? ws[i] : iw;
    if (ex + w - st.x >= -20 && ex - st.x <= W + 20) draw(c, items[i], ex, y, i);
    ex += w + gap;
  }
  T.x = ox; c.restore(); return y + ch;
}
function card(c, it, x, y, s, round, rad) {
  const pk = 'card:' + (it && it.id ? it.id : '') + ':' + Math.round(x) + ':' + Math.round(y);
  const r = round ? s / 2 : (rad || 10);
  withPressScale(c, pk, x + s / 2, y + s / 2, () => {
    drawArt(c, it, x, y, s, r);
    drawRowPressTint(c, pk, x, y, s, s, r);
    txt(c, it.title, round ? x + s / 2 : x, y + s + 21, F(500, 15), pal.fg, round ? 'center' : 'left', s);
    txt(c, subOf(it), round ? x + s / 2 : x, y + s + 40, F(400, 15), pal.sub, round ? 'center' : 'left', s);
  });
  hit(x, y, s, s + 48, () => open(it), { pressKey: pk });
}
function grid2(c, P, y, items, pinned) {
  const s = Math.floor((W - 40 - 16) / 2), rowH = s + 62, rows = Math.ceil(items.length / 2);
  if (rows > 0) {
    const rowLo = Math.max(0, Math.floor((P.scroll - 30 - y) / rowH) - 1);
    const rowHi = Math.min(rows - 1, Math.ceil((P.scroll + H + 30 - y) / rowH) + 1);
    const iLo = rowLo * 2, iHi = Math.min(items.length, (rowHi + 1) * 2);
    for (let i = iLo; i < iHi; i++) {
      const it = items[i], x = 20 + (i % 2) * (s + 16), yy = y + Math.floor(i / 2) * rowH;
      if (vis(P, yy, s + 60)) card(c, it, x, yy, s, it.kind === 'artist');
    }
  }
  return y + rows * rowH;
}
function drawSwipeQueueBg(c, rx, ry, rw, rh, r, tn, sw) {
  const sRow = sw || (typeof SWQ !== 'undefined' ? SWQ : null);
  const bgRgb = (tn && tn.rgb) ? tn.rgb : (pal.dark ? [13, 13, 13] : [255, 255, 255]);
  const ac4 = (tn && tn._accent) ? tn._accent : (typeof BARC !== 'undefined' && BARC.accent ? BARC.accent : [250, 46, 73, 1]);
  const acRgb = [Math.round(ac4[0]), Math.round(ac4[1]), Math.round(ac4[2])];
  const dimMix = pal.dark ? 0.28 : 0.16;
  const dimRgb = [
    Math.round(mix(bgRgb[0], acRgb[0], dimMix)),
    Math.round(mix(bgRgb[1], acRgb[1], dimMix)),
    Math.round(mix(bgRgb[2], acRgb[2], dimMix))
  ];
  const _lum = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const acLum = 0.2126 * _lum(acRgb[0]) + 0.7152 * _lum(acRgb[1]) + 0.0722 * _lum(acRgb[2]);
  const inkRgb = acLum > 0.40
    ? [Math.round(bgRgb[0] * 0.25), Math.round(bgRgb[1] * 0.25), Math.round(bgRgb[2] * 0.25)]
    : [255, 255, 255];

  const cp = clamp((sRow && sRow.crossP) || 0, 0, 1);
  const actRgb = [
    Math.round(mix(dimRgb[0], acRgb[0], cp)),
    Math.round(mix(dimRgb[1], acRgb[1], cp)),
    Math.round(mix(dimRgb[2], acRgb[2], cp))
  ];
  c.fillStyle = 'rgb(' + actRgb.join(',') + ')';
  c.fillRect(rx, ry, rw, rh);

  const glAlpha = Math.min(1, r / 40);
  if (glAlpha <= 0.01) return;

  const glRgb = [
    Math.round(mix(acRgb[0], inkRgb[0], cp)),
    Math.round(mix(acRgb[1], inkRgb[1], cp)),
    Math.round(mix(acRgb[2], inkRgb[2], cp))
  ];
  const glCol = 'rgb(' + glRgb.join(',') + ')';

  const shift = Math.min(r / 2, 46);
  const glScale = 0.55 + 0.45 * Math.min(1, r / 64);
  const gx = rx + rw - shift;
  const gy = ry + rh / 2;
  const nowMs = performance.now();

  let hitScale = 1;
  if (sRow && sRow.hitT > 0) {
    const ht = (nowMs - sRow.hitT) / 380;
    if (ht >= 0 && ht < 1) {
      if (ht < 0.4) {
        const p = ht / 0.4;
        hitScale = 1 + 0.32 * (1 - (1 - p) * (1 - p));
      } else {
        const p = (ht - 0.4) / 0.6;
        hitScale = 1.32 - 0.32 * (p * p * (3 - 2 * p));
      }
    }
  }

  const outBack = t => { const u = t - 1; return 1 + 2.2 * u * u * u + 1.2 * u * u; };
  const isDone = Boolean(sRow && sRow.done);
  const doneDt = isDone ? Math.max(0, nowMs - ((sRow && sRow.doneT) || 0)) : 0;

  c.save();
  c.translate(gx, gy);
  c.scale(glScale, glScale);
  c.globalAlpha *= glAlpha;

  c.save();
  c.translate(0, -8.5);
  if (hitScale !== 1) c.scale(hitScale, hitScale);
  c.strokeStyle = glCol;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const qAlpha = isDone ? clamp(1 - doneDt / 160, 0, 1) : 1;
  if (qAlpha > 0.01) {
    const qt = isDone ? outBack(clamp(doneDt / 260, 0, 1)) : 0;
    const qs = 1 - 0.5 * qt;
    const qr = (-25 * Math.PI / 180) * qt;
    c.save();
    c.globalAlpha *= qAlpha;
    if (qr) c.rotate(qr);
    if (qs !== 1) c.scale(qs, qs);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-8, -5.5); c.lineTo(3, -5.5);
    c.moveTo(-8, -0.5); c.lineTo(3, -0.5);
    c.moveTo(-8, 4.5); c.lineTo(-2, 4.5);
    c.moveTo(5.5, 2); c.lineTo(5.5, 9);
    c.moveTo(2, 5.5); c.lineTo(9, 5.5);
    c.stroke();
    c.restore();
  }

  if (isDone) {
    const ckAlpha = clamp(doneDt / 160, 0, 1);
    if (ckAlpha > 0.01) {
      const ckScale = 0.6 + 0.4 * outBack(clamp(doneDt / 260, 0, 1));
      const strokeT = clamp((doneDt - 90) / 340, 0, 1);
      const strokeP = 1 - Math.pow(1 - strokeT, 2.2);
      const drawLen = 20.16 * strokeP;
      if (drawLen > 0.2) {
        c.save();
        c.globalAlpha *= ckAlpha;
        c.scale(ckScale, ckScale);
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(-7, 0.5);
        if (drawLen <= 6.364) {
          const f = drawLen / 6.364;
          c.lineTo(-7 + 4.5 * f, 0.5 + 4.5 * f);
        } else {
          c.lineTo(-2.5, 5);
          const f = Math.min(1, (drawLen - 6.364) / 13.793);
          c.lineTo(-2.5 + 9.5 * f, 5 - 10 * f);
        }
        c.stroke();
        c.restore();
      }
    }
  }
  c.restore();

  const lblP = isDone ? clamp(doneDt / 180, 0, 1) : 0;
  c.font = F(600, 11.5);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = glCol;
  if (1 - lblP > 0.01) {
    c.save();
    c.globalAlpha *= (1 - lblP);
    c.fillText(t('common.queued'), 0, 15);
    c.restore();
  }
  if (lblP > 0.01) {
    c.save();
    c.globalAlpha *= lblP;
    c.fillText(t('common.added'), 0, 15);
    c.restore();
  }
  c.restore();
}
function songRow(c, P, y, t, list, idx, o) {
  o = o || {}; const h = 64;
  if (vis(P, y, h)) {
    const cu = isCur(t), tn = tintOf(P), fg = pageIco(P), sub = pageSubIco(P);
    const rKey = (P ? P.kind : 'p') + ':' + idx + ':' + t.id;
    const pk = 'song:' + rKey;
    const rowAcc = (tn && tn.accent) ? tn.accent : navAccent();
    const swSt = typeof swqRowState === 'function'
      ? swqRowState(rKey)
      : ((typeof SWQ !== 'undefined' && SWQ.key === rKey) ? SWQ : (typeof SWQ_ROWS !== 'undefined' ? SWQ_ROWS.get(rKey) : null));
    const swx = swSt ? swSt.x : 0;
    const isSw = Math.abs(swx) > 0.05;
    if (isSw) {
      const rx = 10, ry = y, rw = W - 20, rh = h;
      c.save();
      rrPath(c, rx, ry, rw, rh, 16);
      c.clip();
      if (swx < -0.5) drawSwipeQueueBg(c, rx, ry, rw, rh, -swx, tn, swSt);
      c.save();
      c.translate(swx, 0);
      c.fillStyle = tn ? tn.css : pal.bg;
      c.fillRect(rx, ry, rw, rh);
    } else {
      c.save();
      drawRowPressTint(c, pk, 12, y + 2, W - 24, h - 4, 14);
    }
    if (cu && !o.compact) {
      c.save(); rrPath(c, 12, y + 2, W - 24, h - 4, 14);
      c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; c.fill();
      c.strokeStyle = pal.dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.07)'; c.lineWidth = 1; c.stroke();
      c.restore();
    }
    let tx = 20, ty = y + 28, ay = y + 48;
    if (o.compact) { txt(c, String(t.no), 36, y + 34, F(400, 16), cu ? rowAcc : sub, 'center'); tx = 64; }
    else {
      drawArt(c, t, 24, y + 8, 48, 8); tx = 84;
      if (cu) {
        c.fillStyle = 'rgba(0,0,0,.32)'; rrPath(c, 24, y + 8, 48, 48, 8); c.fill();
        c.fillStyle = 'rgba(255,255,255,.92)'; rrPath(c, 39, y + 23, 18, 18, 4); c.fill();
        icon(c, 'wave', 48, y + 32, 12, '#111');
      }
    }
    const mw = W - tx - 52;
    txt(c, t.title, tx, ty, F(400, 16.5), cu && o.compact ? rowAcc : fg, 'left', mw);
    const isDl = typeof isDownloaded === 'function' ? isDownloaded(t) : (typeof LIVE !== 'undefined' && LIVE.saved && LIVE.saved.some(x => x.id === t.id));
    const hasEx = Boolean(t.ex && !o.compact);
    let sx = tx, subMw = mw;
    if (isDl) {
      const dlC = typeof dlBadgeColors === 'function' ? dlBadgeColors(tn, rowAcc, pal.dark) : { fill: rowAcc, arrow: pal.bg };
      if (typeof drawDlBadge === 'function') drawDlBadge(c, sx + 7.5, ay - 4.7, 7.5, dlC.fill, dlC.arrow);
      sx += 21; subMw -= 21;
    }
    if (hasEx) {
      rrPath(c, sx, ay - 11.5, 13, 13, 3);
      c.fillStyle = pal.sub2;
      c.fill();
      txt(c, 'E', sx + 6.5, ay - 1.5, F(700, 9), pal.bg, 'center');
      sx += 18; subMw -= 18;
    }
    const lySub = (t._lyricMatch && P && P.kind === 'search') ? (' · ' + t._lyricMatch) : '';
    if (o.compact && o.sub) txt(c, (t.artist === (BYID[t.album] || {}).artist ? fmt(t.dur) : t.artist + ' · ' + fmt(t.dur)) + lySub, sx, ay, F(400, 14), sub, 'left', subMw);
    if (!o.compact) txt(c, (o.sub ? t.artist + ' · ' + fmt(t.dur) : t.artist) + lySub, sx, ay, F(400, 14), sub, 'left', subMw);
    icon(c, 'dots', W - 32, y + h / 2, 18, sub);
    if (!tn && !cu && !o.noSep) { c.fillStyle = pal.sep; c.fillRect(tx, y + h - .5, W - tx, .5); }
    c.restore();
    if (isSw) c.restore();
    const swMeta = { rowTrack: t, rowKey: rKey, pressKey: pk };
    hit(0, y, W - 60, h, () => { if (o.single) playOne(t); else playList(list, idx); }, swMeta);
    const sy = y + h / 2 + T.y;
    hit(W - 60, y, 60, h, () => {
      let ctx = 'search', meta = {};
      if (P && P.data && P.data.item) {
        ctx = (P.data.item.kind === 'playlist') ? 'playlist' : 'album';
        meta = { playlist: P.data.item };
      } else if (P && (P.kind === 'home' || P.kind === 'search')) {
        ctx = 'search';
      }
      openCM(t, W - 30, sy, ctx, meta);
    }, swMeta);
  }
  return y + h;
}
function songRows(c, P, y, list, o) {
  const n = list ? list.length : 0;
  if (!n) return y;
  const h = 64;
  const lo = Math.max(0, Math.floor((P.scroll - 30 - y) / h));
  const hi = Math.min(n, Math.ceil((P.scroll + H + 30 - y) / h));
  for (let i = lo; i < hi; i++) {
    songRow(c, P, y + i * h, list[i], list, i, o);
  }
  return y + n * h;
}
function pillBtn(c, x, y, w, h, label, ico, fn) {
  const pk = 'pill:' + Math.round(x) + ':' + Math.round(y) + ':' + label;
  withPressScale(c, pk, x + w / 2, y + h / 2, () => {
    c.fillStyle = pal.fill; rrPath(c, x, y, w, h, 14); c.fill();
    drawRowPressTint(c, pk, x, y, w, h, 14);
    c.font = F(600, 17);
    const tw = c.measureText(label).width, st = x + (w - (tw + 30)) / 2;
    icon(c, ico, st + 10, y + h / 2, 21, pal.accent); txt(c, label, st + 30, y + h / 2 + 6, F(600, 17), pal.accent);
  });
  hit(x, y, w, h, fn, { pressKey: pk });
}
function actionRow(c, y, list) {
  const w = (W - 40 - 12) / 2;
  pillBtn(c, 20, y, w, 48, t('common.play'), 'play', () => { playList(list, 0); });
  pillBtn(c, 20 + w + 12, y, w, 48, t('common.shuffle'), 'shuffle', () => { playShuffled(list); });
  return y + 48;
}
function libRow(c, P, y, ico, label, fn) {
  const pk = 'librow:' + label + ':' + Math.round(y);
  if (vis(P, y, 60)) {
    drawRowPressTint(c, pk, 12, y + 2, W - 24, 56, 14);
    icon(c, ico, 38, y + 30, 26, pal.accent); txt(c, label, 78, y + 38, F(400, 20), pal.fg); icon(c, 'chev', W - 30, y + 30, 12, pal.sub2, { lw: 3.2 }); c.fillStyle = pal.sep; c.fillRect(78, y + 59.5, W - 78, .5);
  }
  hit(0, y, W, 60, fn, { pressKey: pk }); return y + 60;
}
const end = y => y + LAY.bottomPad + 20;
const downloaded = () => TRACKS.filter((t, i) => i % 3 === 0);

PAGES.home = (c, P) => {
  bigTitle(c, t('home.title')); let y = TOP + 78;
  const cw = Math.round(W * .78), recs = [PLAYLISTS[0], ALBUMS[4], PLAYLISTS[2], ALBUMS[6], PLAYLISTS[5]];
  y = rail(c, P, 'rec', y, recs, cw, 14, cw + 70, (c, it, x, y) => {
    const pk = 'rec:' + (it && it.id ? it.id : '') + ':' + Math.round(x);
    withPressScale(c, pk, x + cw / 2, y + 68 + cw / 2, () => {
      eyebrow(c, t(it.kind === 'playlist' ? 'home.playlists_for_you' : 'home.recommended_for_you'), x, y + 14);
      txt(c, it.title, x, y + 36, F(700, 20), pal.fg, 'left', cw); txt(c, subOf(it), x, y + 56, F(400, 16), pal.sub, 'left', cw);
      drawArt(c, it, x, y + 68, cw, 14);
      drawRowPressTint(c, pk, x, y + 68, cw, cw, 14);
    });
    hit(x, y, cw, cw + 70, () => open(it), { pressKey: pk });
  }) + 8;
  y = section(c, P, y, t('home.recent'), true);
  y = rail(c, P, 'recent', y, [ALBUMS[1], ALBUMS[9], ALBUMS[2], ALBUMS[7], ALBUMS[12], ALBUMS[3]], 156, 14, 214, (c, it, x, y) => card(c, it, x, y, 156)) + 10;
  y = section(c, P, y, t('home.playlists_for_you'), true);
  y = rail(c, P, 'pl', y, PLAYLISTS, 156, 14, 214, (c, it, x, y) => card(c, it, x, y, 156)) + 10;
  y = section(c, P, y, t('home.new_releases'), true);
  y = rail(c, P, 'new', y, ALBUMS.filter(a => a.year >= 2024), 156, 14, 214, (c, it, x, y) => card(c, it, x, y, 156)) + 10;
  y = section(c, P, y, t('home.artists_for_you'), true);
  y = rail(c, P, 'ar', y, ARTISTS, 132, 14, 190, (c, it, x, y) => card(c, it, x, y, 132, true));
  return end(y);
};

PAGES.new = (c, P) => {
  bigTitle(c, t('new_page.title')); let y = TOP + 78; const al = ALBUMS[4], w = W - 40, h = Math.round(w * .84);
  if (vis(P, y, h + 40)) {
    c.save(); rrPath(c, 20, y, w, h, 20); c.clip(); c.drawImage(artOf(al), 20, y - (w - h) / 2, w, w);
    const g = c.createLinearGradient(0, y + h * .4, 0, y + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.72)'); c.fillStyle = g; c.fillRect(20, y, w, h); c.restore();
    eyebrow(c, t('new_page.new_album'), 38, y + h - 66, 'rgba(255,255,255,.75)'); txt(c, al.title, 38, y + h - 38, F(700, 28), '#fff', 'left', w - 36); txt(c, al.artist + ' · ' + al.genre, 38, y + h - 16, F(400, 16), 'rgba(255,255,255,.8)', 'left', w - 36);
  }
  hit(20, y, w, h, () => open(al)); y += h + 28;
  y = section(c, P, y, t('new_page.latest_tracks'), true); const latest = TRACKS.filter(tr => BYID[tr.album].year >= 2024).slice(0, 8);
  latest.forEach((tr, i) => { y = songRow(c, P, y, tr, latest, i); }); y += 22;
  y = section(c, P, y, t('new_page.more_new'), true);
  y = rail(c, P, 'more', y, ALBUMS.slice().reverse().slice(0, 8), 156, 14, 214, (c, it, x, y) => card(c, it, x, y, 156));
  return end(y);
};

PAGES.radio = (c, P) => {
  bigTitle(c, t('radio.title')); let y = TOP + 78;
  STATIONS.forEach(s => {
    const w = W - 40, h = 140;
    if (vis(P, y, h)) {
      const g = c.createLinearGradient(20, y, 20 + w, y + h); g.addColorStop(0, hsl(s.hue, 80, 52)); g.addColorStop(1, hsl(s.hue + 40, 75, 26));
      rrPath(c, 20, y, w, h, 20); c.fillStyle = g; c.fill();
      c.save(); rrPath(c, 20, y, w, h, 20); c.clip(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = 2; for (let i = 1; i < 7; i++) { c.beginPath(); c.arc(20 + w - 30, y + h - 20, i * 34, 0, 7); c.stroke(); } c.restore();
      eyebrow(c, t('radio.live_now'), 38, y + 30, 'rgba(255,255,255,.8)'); txt(c, s.title, 38, y + 70, F(800, 32), '#fff', 'left', w - 110); txt(c, s.sub, 38, y + 98, F(400, 15), 'rgba(255,255,255,.85)', 'left', w - 110);
      c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.arc(20 + w - 40, y + h - 38, 22, 0, 7); c.fill(); icon(c, 'play', 20 + w - 38, y + h - 38, 18, hsl(s.hue + 20, 80, 38));
      hit(20, y, w, h, () => playShuffled(pick(h32(s.id), 14)));
    }
    y += h + 14;
  });
  return end(y);
};

PAGES.library = (c, P) => {
  bigTitle(c, t('library.title')); let y = TOP + 78;
  if (PINS.length) { y = grid2(c, P, y, PINS, true) + 4; }
  else if (!NAV.pinDismissed) {
    const h = 78; if (vis(P, y, h)) {
      rrPath(c, 20, y, W - 40, h, 22); c.fillStyle = pal.fill; c.fill(); icon(c, 'pin', 52, y + h / 2, 34, pal.fg, { lw: 1.8 });
      txt(c, t('library.pins_empty_title'), 88, y + 32, F(600, 17), pal.fg, 'left', W - 88 - 70); txt(c, t('library.pins_empty_l1'), 88, y + 52, F(400, 14), pal.sub, 'left', W - 88 - 60); txt(c, t('library.pins_empty_l2'), 88, y + 69, F(400, 14), pal.sub);
      c.fillStyle = pal.fill; c.beginPath(); c.arc(W - 20 - 28, y + 28, 15, 0, 7); c.fill(); icon(c, 'x', W - 48, y + 28, 12, pal.sub, { lw: 2.6 });
    }
    hit(W - 72, y, 52, 56, () => { NAV.pinDismissed = true; redraw(); }); y += h + 14;
  }
  y = libRow(c, P, y, 'stats', t('library.recap_title'), () => push('stats', { title: t('library.recap_title'), titleKey: 'library.recap_title' }));
  y = libRow(c, P, y, 'lib-playlist', t('common.playlists'), () => push('plist', { title: t('common.playlists'), titleKey: 'common.playlists' }));
  y = libRow(c, P, y, 'mic', t('common.artists'), () => push('artists', { title: t('common.artists'), titleKey: 'common.artists' }));
  y = libRow(c, P, y, 'lib-album', t('common.albums'), () => push('albums', { title: t('common.albums'), titleKey: 'common.albums' }));
  y = libRow(c, P, y, 'note', t('common.songs'), () => push('songs', { title: t('common.songs'), titleKey: 'common.songs', list: TRACKS }));
  y = libRow(c, P, y, 'down', t('common.offline_songs'), () => push('songs', { title: t('common.offline_songs'), titleKey: 'common.offline_songs', list: downloaded() }));
  y += 24; y = section(c, P, y, t('library.sort_recent_added')); y = grid2(c, P, y, ALBUMS.slice().reverse());
  return end(y);
};
const listTop = () => TOP + 66;
PAGES.albums = (c, P) => end(grid2(c, P, listTop(), ALBUMS));
PAGES.plist = (c, P) => {
  let y = listTop();
  const bw = W - 40, bh = 46, bx = 20;
  if (vis(P, y, bh)) {
    rrPath(c, bx, y, bw, bh, 14);
    c.fillStyle = pal.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.045)';
    c.fill();
    c.lineWidth = 1;
    c.strokeStyle = pal.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
    rrPath(c, bx + .5, y + .5, bw - 1, bh - 1, 13.5);
    c.stroke();
    txt(c, t('prompt.new_playlist_btn'), W / 2, y + 29, F(600, 15.5), pal.accent, 'center');
  }
  if (vis(P, y - 4, bh + 8)) {
    hit(0, y - 4, W, bh + 8, () => {
      if (typeof showPromptModal === 'function') {
        showPromptModal({
          title: t('prompt.new_playlist_title'),
          placeholder: t('prompt.playlist_placeholder'),
          confirmText: t('prompt.create'),
          onConfirm: title => {
            if (!title || !title.trim()) return;
            if (typeof createUserPlaylist === 'function') {
              const pl = createUserPlaylist(title.trim());
              if (pl && typeof open === 'function') open(pl);
            }
          }
        });
      }
    }, { tag: 'newPlaylistBtn' });
  }
  y += bh + 12;
  const loP = Math.max(0, Math.floor((P.scroll - 30 - y) / 76) - 1);
  const hiP = Math.min(PLAYLISTS.length, Math.ceil((P.scroll + H + 30 - y) / 76) + 1);
  for (let i = loP; i < hiP; i++) {
    const p = PLAYLISTS[i], py = y + i * 76;
    if (vis(P, py, 76)) {
      drawArt(c, p, 20, py + 8, 60, 8); txt(c, p.title, 96, py + 36, F(500, 17), pal.fg, 'left', W - 130); txt(c, tPlural(p.tracks.length, 'library.song_count_one', 'library.song_count_many'), 96, py + 58, F(400, 15), pal.sub); icon(c, 'chev', W - 30, py + 38, 12, pal.sub2, { lw: 3.2 }); c.fillStyle = pal.sep; c.fillRect(96, py + 75.5, W - 96, .5);
      hit(0, py, W, 76, () => open(p));
    }
  }
  return end(y + PLAYLISTS.length * 76);
};
PAGES.artists = (c, P) => {
  let y = listTop();
  const loA = Math.max(0, Math.floor((P.scroll - 30 - y) / 76) - 1);
  const hiA = Math.min(ARTISTS.length, Math.ceil((P.scroll + H + 30 - y) / 76) + 1);
  for (let i = loA; i < hiA; i++) {
    const a = ARTISTS[i], py = y + i * 76;
    if (vis(P, py, 76)) {
      drawArt(c, a, 20, py + 8, 60, 30); txt(c, a.title, 96, py + 36, F(500, 17), pal.fg, 'left', W - 130); txt(c, subOf(a), 96, py + 58, F(400, 15), pal.sub); icon(c, 'chev', W - 30, py + 38, 12, pal.sub2, { lw: 3.2 }); c.fillStyle = pal.sep; c.fillRect(96, py + 75.5, W - 96, .5);
      hit(0, py, W, 76, () => open(a));
    }
  }
  return end(y + ARTISTS.length * 76);
};
PAGES.songs = (c, P) => {
  let y = listTop() + 6; const list = P.data.list || [];
  if (P.data.canImport) {
    pillBtn(c, 20, y, W - 40, 44, t('local.import_title'), 'folder', () => { if (typeof pickLocalAudio === 'function') pickLocalAudio(); });
    y += 56;
  }
  if (list.length > 1) y = actionRow(c, y, list) + 14;
  y = songRows(c, P, y, list);
  txt(c, list.length ? tPlural(list.length, 'library.song_count_one', 'library.song_count_many') : t('library.no_songs_present'), W / 2, y + 38, F(400, 15), pal.sub, 'center');
  return end(y + 20);
};

const _SKEL_FADE_MS = 260;
const _skelFadeMap = new Map();
let _skelFadeCv = null, _skelFadeCtx = null;

function markSkelSeen(key) {
  if (!key) return;
  let st = _skelFadeMap.get(key);
  if (!st) { st = { seen: false, t0: 0, lastSkelMs: 0 }; _skelFadeMap.set(key, st); }
  st.seen = true;
  st.t0 = 0;
  st.lastSkelMs = performance.now();
}

function drawSkelCrossfade(c, P, key, ySkel, skelFn, bodyFn) {
  const st = key ? _skelFadeMap.get(key) : null;
  if (!st || (!st.seen && !st.t0)) {
    return bodyFn(c);
  }
  const now = performance.now();
  if (st.seen) {
    st.seen = false;
    // Trigger crossfade only if the skeleton was actively visible recently
    if (st.lastSkelMs && (now - st.lastSkelMs) < 1500) {
      st.t0 = now;
    } else {
      st.t0 = 0;
      return bodyFn(c);
    }
  }
  const dt = Math.max(0, now - st.t0);
  if (dt >= _SKEL_FADE_MS) {
    st.t0 = 0;
    return bodyFn(c);
  }
  const rawP = clamp(dt / _SKEL_FADE_MS, 0, 1);
  const k = 1 - Math.pow(1 - rawP, 3);

  if (skelFn && (1 - k) > 0.005) {
    c.save();
    c.globalAlpha *= (1 - k);
    skelFn(c, P, ySkel);
    c.restore();
  }

  const bw = (typeof S !== 'undefined' && S && S.width > 0) ? S.width : Math.round(W * 2);
  const bh = (typeof S !== 'undefined' && S && S.height > 0) ? S.height : Math.round(H * 2);
  let outY = ySkel;
  if (typeof document !== 'undefined' && bw > 0 && bh > 0) {
    if (!_skelFadeCv) { _skelFadeCv = document.createElement('canvas'); _skelFadeCtx = _skelFadeCv.getContext('2d'); }
    if (_skelFadeCv.width !== bw || _skelFadeCv.height !== bh) {
      _skelFadeCv.width = bw; _skelFadeCv.height = bh;
    }
    const fc = _skelFadeCtx;
    fc.setTransform(1, 0, 0, 1, 0, 0);
    fc.clearRect(0, 0, bw, bh);
    if (typeof c.getTransform === 'function') fc.setTransform(c.getTransform());
    outY = bodyFn(fc);
    if (k > 0.005) {
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha *= k;
      c.drawImage(_skelFadeCv, 0, 0);
      c.restore();
    }
  } else {
    outY = bodyFn(c);
  }

  if (typeof _skulletActive !== 'undefined') _skulletActive = true;
  if (typeof window !== 'undefined' && window.__IN_DRAW_SCENE && typeof scheduleSceneAnimRedraw === 'function') {
    scheduleSceneAnimRedraw();
  } else if (typeof scheduleAnimRedraw === 'function') {
    scheduleAnimRedraw();
  }
  return outY;
}

let _skWaveP = -1, _skWaveG = null, _skWaveDark = true, _skWaveW = 0, _skWavePeak = '';
function getSkulletGradient(c, p, isDark, peakCol) {
  const curW = typeof W !== 'undefined' && W > 0 ? W : 400;
  const peak = peakCol || (isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.09)');
  if (!peakCol && _skWaveP === p && _skWaveG && _skWaveDark === isDark && _skWaveW === curW && _skWavePeak === peak) {
    return _skWaveG;
  }
  const waveW = Math.max(160, curW * 0.45);
  const waveX = -waveW + (curW + waveW * 2) * p;
  const g = c.createLinearGradient(waveX, 0, waveX + waveW, 0);
  const zero = isDark || peakCol ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)';
  g.addColorStop(0, zero);
  g.addColorStop(0.5, peak);
  g.addColorStop(1, zero);
  g._x0 = waveX;
  g._x1 = waveX + waveW;
  if (!peakCol) {
    _skWaveP = p;
    _skWaveDark = isDark;
    _skWaveW = curW;
    _skWavePeak = peak;
    _skWaveG = g;
  }
  return g;
}

function skulletShimmer(c, x, y, w, h, r, p, opts) {
  if (w <= 0 || h <= 0) return;
  const isDark = typeof pal !== 'undefined' && pal ? pal.dark : true;
  c.fillStyle = (opts && opts.baseCol) || (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)');
  rrPath(c, x, y, w, h, r);
  c.fill();
  const phase = p != null ? p : ((performance.now() % 1400) / 1400);
  const g = getSkulletGradient(c, phase, isDark, opts && opts.peakCol);
  if (x + w >= g._x0 && x <= g._x1) {
    c.fillStyle = g;
    rrPath(c, x, y, w, h, r);
    c.fill();
  }
  if (typeof _skulletActive !== 'undefined') _skulletActive = true;
  if (typeof window !== 'undefined' && window.__IN_DRAW_SCENE && typeof scheduleSceneAnimRedraw === 'function') {
    scheduleSceneAnimRedraw();
  }
}

function drawHeroSkeleton(c, P, it, x, y, s, tn, rawItem) {
  const isDark = typeof pal !== 'undefined' && pal ? pal.dark : true;
  const H = (it && (it.hue != null ? it.hue : (typeof h32 === 'function' ? (h32(it.id || it.title || '') % 360) : 220))) || 220;
  c.save();
  c.fillStyle = (tn && tn.css) ? tn.css : (isDark ? hsl(H, 42, 14) : hsl(H, 48, 89));
  c.fillRect(Math.min(0, x), y, Math.max(W, s), s);
  c.restore();
}

function drawUserPlaylistHero(c, P, it, x, y, s, tn) {
  const isDark = typeof pal !== 'undefined' && pal ? pal.dark : true;
  const H = (it && (it.hue != null ? it.hue : (typeof h32 === 'function' ? (h32(it.id || it.title || '') % 360) : 220))) || 220;
  c.save();
  c.fillStyle = (tn && tn.css) ? tn.css : (isDark ? hsl(H, 42, 14) : hsl(H, 48, 89));
  c.fillRect(Math.min(0, x), y, Math.max(W, s), s);
  c.restore();
}

function drawSongListSkeleton(c, P, startY, count, opts) {
  opts = opts || {};
  const isCompact = Boolean(opts.compact);
  const tx = isCompact ? 64 : 84;
  const p = ((performance.now() % 1400) / 1400);
  const titleRatios = [0.54, 0.74, 0.46, 0.66, 0.58, 0.70, 0.50, 0.62];
  const subRatios = [0.34, 0.42, 0.30, 0.38, 0.33, 0.40, 0.28, 0.36];

  for (let i = 0; i < count; i++) {
    const y = startY + i * 64;
    if (!vis(P, y, 64)) continue;

    if (isCompact) {
      skulletShimmer(c, 28, y + 26, 16, 14, 4, p);
    } else {
      skulletShimmer(c, 24, y + 8, 48, 48, 8, p);
    }

    const mw = W - tx - 56;
    const tw = Math.round(mw * titleRatios[i % titleRatios.length]);
    skulletShimmer(c, tx, y + 17, tw, 14, 4, p);

    const sw = Math.round(mw * subRatios[i % subRatios.length]);
    skulletShimmer(c, tx, y + 38, sw, 11, 4, p);

    skulletShimmer(c, W - 34, y + 29, 6, 6, 3, p);

    c.fillStyle = pal.sep;
    c.fillRect(tx, y + 63.5, W - tx, 0.5);
  }

  return startY + count * 64;
}

function drawAlbumsSkeleton(c, P, startY, count) {
  const p = ((performance.now() % 1400) / 1400);
  const s = Math.floor((W - 40 - 16) / 2);
  const rows = Math.ceil(count / 2);
  for (let i = 0; i < count; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 20 + col * (s + 16), y = startY + row * (s + 62);
    if (!vis(P, y, s + 60)) continue;
    skulletShimmer(c, x, y, s, s, 10, p);
    skulletShimmer(c, x, y + s + 10, Math.round(s * 0.72), 14, 4, p);
    skulletShimmer(c, x, y + s + 30, Math.round(s * 0.44), 11, 4, p);
  }
  return startY + rows * (s + 62);
}

function drawArtistRailSkeleton(c, P, startY) {
  const p = ((performance.now() % 1400) / 1400);
  const s = 136;
  if (vis(P, startY, 194)) {
    for (let i = 0; i < 4; i++) {
      const cx = 20 + i * (s + 14);
      if (cx >= W) break;
      skulletShimmer(c, cx, startY, s, s, 14, p);
      skulletShimmer(c, cx, startY + s + 10, Math.round(s * 0.78), 14, 4, p);
      skulletShimmer(c, cx, startY + s + 30, Math.round(s * 0.44), 11, 4, p);
    }
  }
  return startY + 194;
}

function drawHomeSkeleton(c, P, y) {
  const p = ((performance.now() % 1400) / 1400);

  y = section(c, P, y, t('home.quick_picks'), 'big') + 4;
  const cw = W - 42;
  for (let r = 0; r < 4; r++) {
    const ry = y + r * 66;
    if (vis(P, ry, 66)) {
      skulletShimmer(c, 20, ry + 8, 50, 50, 8, p);
      skulletShimmer(c, 20 + 64, ry + 18, Math.round((cw - 74) * 0.62), 14, 4, p);
      skulletShimmer(c, 20 + 64, ry + 39, Math.round((cw - 74) * 0.38), 12, 4, p);
      c.fillStyle = pal.sep;
      c.fillRect(20 + 64, ry + 65.5, W - 84, 0.5);
    }
  }
  y += 4 * 66 + 20;

  y = section(c, P, y, t('home.new_releases'), 'big') + 6;
  const cardS = 162;
  for (let i = 0; i < 3; i++) {
    const cx = 20 + i * (cardS + 14);
    if (cx < W && vis(P, y, cardS + 56)) {
      skulletShimmer(c, cx, y, cardS, cardS, 16, p);
      skulletShimmer(c, cx, y + cardS + 10, Math.round(cardS * 0.78), 14, 4, p);
      skulletShimmer(c, cx, y + cardS + 30, Math.round(cardS * 0.48), 11, 4, p);
    }
  }
  y += cardS + 56 + 16;

  y = (typeof artistSectionHead === 'function')
    ? artistSectionHead(c, P, y, t('home.similar_to')) + 2
    : section(c, P, y, t('home.similar_to'), 'big');
  const pw = Math.min(210, Math.max(172, Math.floor((W - 48) * 0.52)));
  for (let col = 0; col < 2; col++) {
    const cx = 20 + col * (pw + 10);
    if (cx < W) {
      for (let k = 0; k < 2; k++) {
        const ry = y + k * 56;
        if (vis(P, ry, 48)) {
          const isDark = typeof pal !== 'undefined' && pal ? pal.dark : true;
          c.fillStyle = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)';
          rrPath(c, cx, ry, pw, 48, 24);
          c.fill();
          skulletShimmer(c, cx + 4, ry + 4, 40, 40, 20, p);
          skulletShimmer(c, cx + 52, ry + 14, Math.round((pw - 62) * 0.65), 12, 4, p);
          skulletShimmer(c, cx + 52, ry + 30, Math.round((pw - 62) * 0.38), 10, 3, p);
        }
      }
    }
  }
  y += 2 * 56 + 14;

  y = section(c, P, y, t('home.recommended_playlists'), 'big') + 6;
  const plS = 138;
  for (let i = 0; i < 3; i++) {
    const cx = 20 + i * (plS + 14);
    if (cx < W && vis(P, y, plS + 56)) {
      skulletShimmer(c, cx, y, plS, plS, 14, p);
      skulletShimmer(c, cx, y + plS + 10, Math.round(plS * 0.75), 14, 4, p);
      skulletShimmer(c, cx, y + plS + 30, Math.round(plS * 0.45), 11, 4, p);
    }
  }
  y += plS + 56 + 16;

  y = section(c, P, y, t('home.recent'), 'big') + 6;
  for (let i = 0; i < 3; i++) {
    const cx = 20 + i * (plS + 14);
    if (cx < W && vis(P, y, plS + 56)) {
      skulletShimmer(c, cx, y, plS, plS, 14, p);
      skulletShimmer(c, cx, y + plS + 10, Math.round(plS * 0.72), 14, 4, p);
      skulletShimmer(c, cx, y + plS + 30, Math.round(plS * 0.42), 11, 4, p);
    }
  }
  y += plS + 56 + 16;

  return y;
}

function drawExploreSkeleton(c, P, y) {
  const p = ((performance.now() % 1400) / 1400);
  y = section(c, P, y, t('new_page.albums_singles'), 'big');
  const s = Math.min(176, Math.round((W - 54) * .46));
  for (let i = 0; i < 3; i++) {
    const cx = 20 + i * (s + 14);
    if (cx < W && vis(P, y + 6, s + 52)) {
      skulletShimmer(c, cx, y + 6, s, s, 16, p);
      skulletShimmer(c, cx, y + s + 22, Math.round(s * 0.75), 14, 4, p);
      skulletShimmer(c, cx, y + s + 42, Math.round(s * 0.45), 11, 4, p);
    }
  }
  y += s + 58 + 18;

  y = section(c, P, y, t('new_page.top_tracks'), 'big') + 4;
  const cw = W - 42;
  for (let r = 0; r < 4; r++) {
    const ry = y + r * 66;
    if (vis(P, ry, 66)) {
      skulletShimmer(c, 20, ry + 8, 50, 50, 8, p);
      skulletShimmer(c, 84, ry + 18, Math.round((cw - 74) * 0.62), 14, 4, p);
      skulletShimmer(c, 84, ry + 39, Math.round((cw - 74) * 0.38), 12, 4, p);
      c.fillStyle = pal.sep;
      c.fillRect(84, ry + 65.5, W - 84, 0.5);
    }
  }
  y += 4 * 66 + 16;
  return y;
}

function drawRadioSkeleton(c, P, y) {
  const p = ((performance.now() % 1400) / 1400);
  const s = Math.min(172, Math.round((W - 54) * .45));
  for (let secIdx = 0; secIdx < 2; secIdx++) {
    if (vis(P, y, 54)) {
      if (secIdx === 0) {
        eyebrow(c, t('radio.moods_eyebrow'), 20, y + 14, pal.sub);
        txt(c, t('radio.stations_moods'), 20, y + 42, F(700, 26), pal.fg, 'left', W - 40);
      } else {
        skulletShimmer(c, 20, y + 4, 110, 11, 4, p);
        skulletShimmer(c, 20, y + 22, 180, 22, 6, p);
      }
    }
    y += 54;
    for (let i = 0; i < 3; i++) {
      const cx = 20 + i * (s + 14);
      if (cx < W && vis(P, y, s + 58)) {
        skulletShimmer(c, cx, y, s, s, 16, p);
        skulletShimmer(c, cx, y + s + 10, Math.round(s * 0.72), 14, 4, p);
        skulletShimmer(c, cx, y + s + 30, 56, 11, 4, p);
      }
    }
    y += s + 58 + 18;
  }
  return y;
}

function drawArtistBodySkeleton(c, P, y) {
  y = drawSongListSkeleton(c, P, y, 5, { sub: true });
  y += 22;
  y = section(c, P, y, t('artist_page.albums'));
  y = drawArtistRailSkeleton(c, P, y);
  y += 16;
  y = section(c, P, y, t('artist_page.singles_ep'));
  y = drawArtistRailSkeleton(c, P, y);
  return y;
}

function hero(c, P, it, sz) {
  const tn = tintOf(P), st = Math.max(0, -P.scroll), s = sz + st * 1.2, x = (W - s) / 2, y = -st;
  if (!vis(P, 0, sz)) return;
  const rawItem = artItem(it);
  if (rawItem && typeof rawItem.thumb === 'string' &&
      typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(rawItem.thumb) &&
      /[?&]s=(?:288|544)\b/.test(rawItem.thumb)) {
    const hiUrl = typeof appleThumbAtSize === 'function'
      ? appleThumbAtSize(rawItem.thumb, 1200)
      : rawItem.thumb.replace(/([?&])s=(?:288|544)\b/, '$1s=1200');
    rawItem.thumb = hiUrl;
    if (it && it !== rawItem && (!it.thumb || /[?&]s=(?:288|544)\b/.test(it.thumb))) it.thumb = hiUrl;
    if (rawItem.id && typeof BYID !== 'undefined' && BYID[rawItem.id] && BYID[rawItem.id] !== rawItem) BYID[rawItem.id].thumb = hiUrl;
  }
  const art = artOf(rawItem);
  if (art && art._real && art.width > 0 && art.width < 720 && rawItem && rawItem.thumb &&
      art._url === rawItem.thumb && !rawItem._heroHiResUpgraded &&
      (art.width <= 400 && ((typeof _isHiResCoverUrl === 'function' && _isHiResCoverUrl(rawItem.thumb)) || (typeof isAppleArtistThumb === 'function' && isAppleArtistThumb(rawItem.thumb)))) &&
      typeof _covUrl !== 'undefined' && typeof liveCover === 'function') {
    rawItem._heroHiResUpgraded = true;
    delete _covUrl[rawItem.thumb];
    if (typeof _covLru !== 'undefined') _covLru.delete(rawItem.thumb);
    liveCover(rawItem, rawItem.id, true);
  }
  const isArtist = (it && it.kind === 'artist') || (rawItem && rawItem.kind === 'artist');
  const hasReal = (it && it.user)
    ? Boolean(it.thumb && art && art._real)
    : Boolean(art && art._real && (!isArtist || (typeof isHqThumb === 'function' && isHqThumb(rawItem.thumb || (it && it.thumb)))));
  if (hasReal) {
    const a = typeof artFadeAlpha === 'function' ? artFadeAlpha(art) : 1;
    if (a < 1) {
      if (it && it.user) drawUserPlaylistHero(c, P, it, x, y, s, tn);
      else drawHeroSkeleton(c, P, it, x, y, s, tn, rawItem);
      c.save(); c.globalAlpha *= a; c.drawImage(art, x, y, s, s); c.restore();
    } else {
      c.drawImage(art, x, y, s, s);
    }
  } else if (it && it.user) {
    drawUserPlaylistHero(c, P, it, x, y, s, tn);
  } else {
    drawHeroSkeleton(c, P, it, x, y, s, tn, rawItem);
  }
  if (hasReal) {
    const g = c.createLinearGradient(0, y + s * .58, 0, y + s * .98);
    g.addColorStop(0, tintA(tn, 0)); g.addColorStop(.45, tintA(tn, .42)); g.addColorStop(.80, tintA(tn, .88)); g.addColorStop(1, tintA(tn, 1));
    c.fillStyle = g; c.fillRect(0, y + s * .58, W, s * .44 + 2);
  }
}
function circBtn(c, x, y, d, ico, fn) {
  const pk = 'circ:' + ico + ':' + Math.round(x) + ':' + Math.round(y);
  withPressScale(c, pk, x + d / 2, y + d / 2, () => {
    c.beginPath(); c.arc(x + d / 2, y + d / 2, d / 2, 0, 7); c.fillStyle = pal.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.07)'; c.fill();
    drawRowPressTint(c, pk, x, y, d, d, d / 2);
    c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.06)'; c.stroke();
    icon(c, ico, x + d / 2, y + d / 2, 22, pal.fg, { lw: 2 });
  });
  hit(x, y, d, d, fn, { pressKey: pk });
}
function heroGeom(y) {
  const ph = 50, pw = 166, px = Math.round((W - pw) / 2), cd = 48, gap = 20, cy = y + (ph - cd) / 2;
  return { y, ph, pw, px, cd, cy, x0: px - gap - cd, x1: px + pw + gap };
}
function heroBtnAlpha(P) {
  if (!P || !hasPill(P) || P.heroY == null) return 1;
  const dk = dock(), g = heroGeom(P.heroY), hy = g.cy - P.scroll, topLim = TOP + 52, botLim = (cur() ? dk.mini.y : dk.tab.y) - 8;
  return sstep(clamp((hy - topLim) / 128, 0, 1)) * sstep(clamp((botLim - (hy + g.cd)) / 44, 0, 1));
}
function heroControls(c, P, y, list) {
  const g = heroGeom(y), tn = tintOf(P), pCol = tn ? tn.playCol : '#111';
  P.heroY = y;
  const al = heroBtnAlpha(P);
  if (al > .01) {
    c.save(); c.globalAlpha *= al;
    c.save();
    if (!pal.dark) { c.shadowColor = 'rgba(0,0,0,' + (.12 * al).toFixed(3) + ')'; c.shadowBlur = 10; c.shadowOffsetY = 3; }
    rrPath(c, g.px, y, g.pw, g.ph, g.ph / 2); c.fillStyle = '#ffffff'; c.fill();
    c.restore();
    const playLbl = t('common.play');
    c.font = F(500, 16.5); const tw = c.measureText(playLbl).width, sx = g.px + (g.pw - (tw + 26)) / 2;
    icon(c, 'play', sx + 7, y + g.ph / 2, 16, pCol); txt(c, playLbl, sx + 25, y + g.ph / 2 + 5.8, F(500, 16.5), pCol);
    c.restore();
  }
  if (al > .2) {
    const curIt = P && P.data ? P.data.item : null;
    hit(g.x0, g.cy, g.cd, g.cd, () => playShuffled(list), { pressKey: 'hShuf:' + (curIt && curIt.id ? curIt.id : 'x') });
    hit(g.px, y, g.pw, g.ph, () => playList(list, 0), { pressKey: 'hPlay:' + (curIt && curIt.id ? curIt.id : 'x') });
    hit(g.x1, g.cy, g.cd, g.cd, () => {
      if (typeof requestDownloadItem === 'function') {
        requestDownloadItem(curIt, curIt ? tracksOf(curIt) : list);
      } else if (typeof toggleSavedList === 'function') {
        toggleSavedList(list, curIt);
      }
    }, { pressKey: 'hDown:' + (curIt && curIt.id ? curIt.id : 'x') });
  }
  return y + g.ph;
}
function upper(c, s, x, y, font, col, maxW) { try { c.letterSpacing = '.8px'; } catch (e) {} const r = txt(c, s.toUpperCase(), x, y, font, col, 'center', maxW); try { c.letterSpacing = '0px'; } catch (e) {} return r; }
function drawPlaylistRecsSection(c, P, it, y, fg, sub) {
  const recState = playlistRecsState(it) || {};
  const recTracks = Array.isArray(recState.tracks) ? recState.tracks.slice(0, 15) : [];
  const loading = Boolean(recState.loading);
  const tn = tintOf(P);
  const acc = typeof navAccent === 'function' ? navAccent() : pal.accent;

  if (vis(P, y - 14, 4)) {
    c.fillStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)';
    c.fillRect(22, y - 12, W - 44, .5);
  }

  c.font = F(600, 13);
  const refLabel = t('common.refresh');
  const refTw = c.measureText(refLabel).width;
  const btnW = Math.ceil(12 + 13 + 5 + refTw + 12);
  const btnH = 30;
  const btnX = W - 20 - btnW;
  const btnY = y + 2;
  const refPk = 'recs_ref:' + (it.id || 'pl');

  if (vis(P, y, 56)) {
    const titleMaxW = Math.max(80, btnX - 22 - 26);
    const shownTitle = txt(c, t('playlist_page.recommended_title'), 22, y + 23, F(700, 19), fg, 'left', titleMaxW);
    const titleW = c.measureText(shownTitle).width;
    icon(c, 'smart', 22 + titleW + 11, y + 16, 14, acc);

    withPressScale(c, refPk, btnX + btnW / 2, btnY + btnH / 2, () => {
      rrPath(c, btnX, btnY, btnW, btnH, btnH / 2);
      c.fillStyle = pal.dark ? 'rgba(255,255,255,.11)' : 'rgba(255,255,255,.58)';
      c.fill();
      drawRowPressTint(c, refPk, btnX, btnY, btnW, btnH, btnH / 2);
      c.lineWidth = 1;
      c.strokeStyle = pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.09)';
      rrPath(c, btnX + .5, btnY + .5, btnW - 1, btnH - 1, (btnH - 1) / 2);
      c.stroke();
      const icx = btnX + 12 + 6.5, icy = btnY + btnH / 2;
      if (loading) {
        c.save();
        c.translate(icx, icy);
        c.rotate((performance.now() * .006) % (Math.PI * 2));
        icon(c, 'refresh', 0, 0, 13, fg, { lw: 2.1 });
        c.restore();
        if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
        else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
      } else {
        icon(c, 'refresh', icx, icy, 13, fg, { lw: 2.1 });
      }
      txt(c, refLabel, btnX + 12 + 13 + 5, btnY + 19.5, F(600, 13), fg);
    }, 0.06);

    hit(btnX - 6, btnY - 8, btnW + 12, btnH + 16, () => {
      if (typeof refreshPlaylistRecs === 'function') refreshPlaylistRecs(it);
    }, { pressKey: refPk });

    txt(c, t('playlist_page.recommended_sub'), 22, y + 44, F(400, 13.5), sub, 'left', W - 44);
  }
  y += 58;

  const recSkelKey = 'plrec:' + (it && it.id ? it.id : 'x');
  if (loading && !recTracks.length) {
    markSkelSeen(recSkelKey);
    if (vis(P, y, 28)) txt(c, t('playlist_page.searching_compat'), 22, y + 18, F(400, 14), sub, 'left', W - 44);
    y += 28;
    y = drawSongListSkeleton(c, P, y, 4);
    return y;
  }

  if (!recTracks.length) {
    if (vis(P, y, 40)) {
      txt(c, t(recState.err ? 'playlist_page.no_recs' : 'playlist_page.no_compat'), 22, y + 24, F(400, 14), sub, 'left', W - 44);
    }
    return y + 42;
  }

  return drawSkelCrossfade(
    c,
    P,
    recSkelKey,
    y,
    (sc, PP, sy) => {
      if (vis(PP, sy, 28)) txt(sc, t('playlist_page.searching_compat'), 22, sy + 18, F(400, 14), sub, 'left', W - 44);
      return drawSongListSkeleton(sc, PP, sy + 28, 4);
    },
    (dc) => {
      let ry = y;
      const rowH = 64;
      for (let i = 0; i < recTracks.length; i++) {
        const tr = recTracks[i];
        if (vis(P, ry, rowH)) {
          const cu = isCur(tr);
          const rowPk = 'rec_row:' + i + ':' + tr.id;
          const addPk = 'rec_add:' + i + ':' + tr.id;

          drawRowPressTint(dc, rowPk, 12, ry + 2, W - 24, rowH - 4, 14);
          if (cu) {
            dc.save();
            rrPath(dc, 12, ry + 2, W - 24, rowH - 4, 14);
            dc.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
            dc.fill();
            dc.strokeStyle = pal.dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.07)';
            dc.lineWidth = 1;
            dc.stroke();
            dc.restore();
          }

          drawArt(dc, tr, 24, ry + 8, 48, 8);
          if (cu) {
            dc.fillStyle = 'rgba(0,0,0,.32)';
            rrPath(dc, 24, ry + 8, 48, 48, 8);
            dc.fill();
            dc.fillStyle = 'rgba(255,255,255,.92)';
            rrPath(dc, 39, ry + 23, 18, 18, 4);
            dc.fill();
            icon(dc, 'wave', 48, ry + 32, 12, '#111');
          }

          const tx = 84, ty = ry + 28, ay = ry + 48;
          const colW = W - 68 - tx;
          const shown = txt(dc, tr.title || '', tx, ty, F(400, 16.5), fg, 'left', Math.max(40, colW - 18));
          const shownW = dc.measureText(shown).width;
          icon(dc, 'smart', tx + shownW + 10.5, ty - 5.5, 13, acc);

          let sx = tx, subMw = colW;
          const isDl = typeof isDownloaded === 'function' ? isDownloaded(tr) : (typeof LIVE !== 'undefined' && LIVE.saved && LIVE.saved.some(x => x.id === tr.id));
          if (isDl) {
            const dlC = typeof dlBadgeColors === 'function' ? dlBadgeColors(tn, acc, pal.dark) : { fill: acc, arrow: pal.bg };
            if (typeof drawDlBadge === 'function') drawDlBadge(dc, sx + 7.5, ay - 4.7, 7.5, dlC.fill, dlC.arrow);
            sx += 21;
            subMw -= 21;
          }
          if (tr.ex) {
            rrPath(dc, sx, ay - 11.5, 13, 13, 3);
            dc.fillStyle = pal.sub2;
            dc.fill();
            txt(dc, 'E', sx + 6.5, ay - 1.5, F(700, 9), pal.bg, 'center');
            sx += 18;
            subMw -= 18;
          }
          txt(dc, tr.artist || '', sx, ay, F(400, 14), sub, 'left', Math.max(20, subMw));

          const btnCx = W - 41, btnCy = ry + rowH / 2, btnR = 17;
          withPressScale(dc, addPk, btnCx, btnCy, () => {
            dc.beginPath();
            dc.arc(btnCx, btnCy, btnR, 0, Math.PI * 2);
            dc.fillStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.58)';
            dc.fill();
            drawRowPressTint(dc, addPk, btnCx - btnR, btnCy - btnR, btnR * 2, btnR * 2, btnR);
            dc.lineWidth = 1;
            dc.strokeStyle = pal.dark ? 'rgba(255,255,255,.20)' : 'rgba(0,0,0,.11)';
            dc.stroke();
            icon(dc, 'plus', btnCx, btnCy, 15, fg, { lw: 2.3 });
          }, 0.08);

          if (!tn && !cu) {
            dc.fillStyle = pal.sep;
            dc.fillRect(tx, ry + rowH - .5, W - tx, .5);
          }

          hit(0, ry, W - 64, rowH, () => {
            if (typeof playOne === 'function') playOne(tr);
            else if (typeof playList === 'function') playList([tr], 0);
          }, { pressKey: rowPk });
          hit(W - 64, ry + 9, 46, 46, () => {
            if (typeof addTrackFromRec === 'function') addTrackFromRec(it, tr);
          }, { pressKey: addPk });
        }
        ry += rowH;
      }
      return ry;
    }
  );
}
PAGES.album = (c, P) => {
  const it = P.data.item, all = tracksOf(it), q = (P.q || '').trim().toLowerCase(), base = q ? all.filter(t => (t.title + ' ' + t.artist).toLowerCase().includes(q)) : all, list = P.rev ? base.slice().reverse() : base, isPl = it.kind === 'playlist', hs = Math.round(W * .95), fg = pageIco(P), sub = pageSubIco(P); let y = hs;
  hero(c, P, it, W);
  if (it && it.user && vis(P, 0, hs)) {
    hit(W * 0.2, 40, W * 0.6, hs * 0.55, () => {
      if (typeof openPlaylistCoverPicker === 'function') openPlaylistCoverPicker(it);
    });
  }
  y += 18;
  const subScreenY = y - P.scroll;
  const subAl = sstep(clamp((subScreenY - (TOP + 54)) / 80, 0, 1));
  if (subAl > 0.01) {
    c.save(); c.globalAlpha *= subAl;
    txt(c, isPl ? t('common.playlist') : [it.artist, it.genre || it.type, it.year].filter(Boolean).join(' · '), W / 2, y, F(400, 14.5), sub, 'center', W - 48);
    c.restore();
  }
  y += 22; y = heroControls(c, P, y, list) + 26;
  if (vis(P, y, 36)) { txt(c, t('common.songs'), 22, y + 16, F(500, 16), fg); icon(c, 'sort', W - 32, y + 10, 18, fg, { lw: 2 }); }
  hit(W - 60, y - 6, 52, 36, () => { P.rev = !P.rev; redraw(); });
  y += 28;
  const albSkelKey = 'album:' + (it && it.id ? it.id : 'x');
  if (!all.length) {
    if (it.user) {
      txt(c, t('playlist_page.empty'), W / 2, y + 40, F(500, 16.5), fg, 'center', W - 40);
      txt(c, t('playlist_page.empty_hint'), W / 2, y + 66, F(400, 14.5), sub, 'center', W - 40);
      y += 86;
    } else if (it.err) txt(c, t('playlist_page.load_error', { err: it.err }), W / 2, y + 40, F(400, 15), sub, 'center', W - 40);
    else {
      markSkelSeen(albSkelKey);
      y = drawSongListSkeleton(c, P, y, 6);
    }
  } else {
    y = drawSkelCrossfade(
      c,
      P,
      albSkelKey,
      y,
      (sc, PP, sy) => drawSongListSkeleton(sc, PP, sy, 6),
      (dc) => {
        let yy = songRows(dc, P, y, list, { sub: true });
        if (!list.length) txt(dc, t('playlist_page.no_match', { q: P.q }), W / 2, yy + 40, F(400, 15), sub, 'center', W - 40);
        else {
          const mins = Math.round(list.reduce((a, t) => a + t.dur, 0) / 60);
          if (vis(P, yy + 14, 28)) txt(dc, tPlural(list.length, 'playlist_page.songs_one_and_meta', 'playlist_page.songs_and_meta', { meta: mins + t('common.min_short') }), 22, yy + 34, F(400, 14), sub);
          if (isPl && it.user && all.length > 0 && !q && typeof playlistRecsState === 'function') {
            yy = drawPlaylistRecsSection(dc, P, it, yy + 64, fg, sub);
          }
        }
        return yy;
      }
    );
  }
  return end(y + 20);
};
function artistReleaseCard(c, P, it, x, y, s, isSingle) {
  const fg = pageIco(P), sub = pageSubIco(P);
  const pk = 'artrel:' + (isSingle ? 's:' : 'a:') + (it && it.id ? it.id : '') + ':' + Math.round(x) + ':' + Math.round(y);
  const r = 14;
  withPressScale(c, pk, x + s / 2, y + s / 2, () => {
    drawArt(c, it, x, y, s, r);
    drawRowPressTint(c, pk, x, y, s, s, r);
    txt(c, it.title, x, y + s + 21, F(500, 15), fg, 'left', s);
    const meta = it.year ? String(it.year) : (subOf(it) || t(isSingle ? 'common.single' : 'common.album'));
    txt(c, meta, x, y + s + 40, F(400, 14), sub, 'left', s);
  });
  hit(x, y, s, s + 48, () => open(it), { pressKey: pk });
}
PAGES.artist = (c, P) => {
  const a = P.data.item, hs = Math.round(W * .95), all = tracksOf(a), q = (P.q || '').trim().toLowerCase();
  const matchQ = it => it && ((it.title || '') + ' ' + (it.artist || '')).toLowerCase().includes(q);
  const tr = q ? all.filter(matchQ) : all;
  const rawAlbs = a.albums || [], rawSings = a.singles || [];
  const albs = q ? rawAlbs.filter(matchQ) : rawAlbs;
  const sings = q ? rawSings.filter(matchQ) : rawSings;
  const sub = pageSubIco(P); let y = hs;
  hero(c, P, a, W);
  y += 18;
  const subScreenY = y - P.scroll;
  const subAl = sstep(clamp((subScreenY - (TOP + 54)) / 80, 0, 1));
  if (subAl > 0.01) {
    c.save(); c.globalAlpha *= subAl;
    txt(c, t('common.artist'), W / 2, y, F(400, 14.5), sub, 'center');
    c.restore();
  }
  y += 22; y = heroControls(c, P, y, tr) + 26;
  y = section(c, P, y, t('artist_page.popular_songs'));
  const artSkelKey = 'artist:' + (a && a.id ? a.id : 'x');
  if (!all.length && !rawAlbs.length && !rawSings.length) {
    if (a.err) {
      txt(c, t('artist_page.load_error', { err: a.err }), W / 2, y + 40, F(400, 15), pal.sub, 'center', W - 40);
      y += 60;
    } else {
      markSkelSeen(artSkelKey);
      y = drawArtistBodySkeleton(c, P, y);
    }
  } else {
    y = drawSkelCrossfade(
      c,
      P,
      artSkelKey,
      y,
      drawArtistBodySkeleton,
      (dc) => {
        let yy = y;
        const top5 = tr.slice(0, 5);
        top5.forEach((t, i) => { yy = songRow(dc, P, yy, t, tr, i, { sub: true }); });
        if (albs.length) {
          yy += 22;
          yy = section(dc, P, yy, t('artist_page.albums'));
          yy = rail(dc, P, 'art_alb', yy, albs, 136, 14, 194, (rc, it, x, ry) => artistReleaseCard(rc, P, it, x, ry, 136, false));
        }
        if (sings.length) {
          yy += 16;
          yy = section(dc, P, yy, t('artist_page.singles_ep'));
          yy = rail(dc, P, 'art_sng', yy, sings, 136, 14, 194, (rc, it, x, ry) => artistReleaseCard(rc, P, it, x, ry, 136, true));
        }
        if (a.related && a.related.length) {
          yy += 14;
          yy = section(dc, P, yy, t('artist_page.similar_artists'));
          yy = rail(dc, P, 'rel', yy, a.related, 132, 14, 190, (rc, it, x, ry) => card(rc, it, x, ry, 132, true));
        }
        return yy;
      }
    );
  }
  return end(y);
};

NAV.query = '';
const getSearchFilters = () => [
  ['all', t('common.all')],
  ['songs', t('search.filter_songs')],
  ['artists', t('search.filter_artists')],
  ['albums', t('search.filter_albums')],
  ['playlists', t('search.filter_playlists')]
];
function drawSearchEmpty(c) {
  const dk = dock(), bot = cur() ? dk.mini.y : dk.search.y, cy = Math.round(TOP + 34 + (bot - (TOP + 34)) * .40);
  c.save();
  c.beginPath(); c.arc(W / 2, cy - 34, 34, 0, Math.PI * 2);
  c.fillStyle = pal.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'; c.fill();
  c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.07)'; c.stroke();
  icon(c, 'search', W / 2, cy - 34, 28, pal.sub, { lw: 2.3 });
  txt(c, t('search.empty_title'), W / 2, cy + 22, F(600, 18), pal.fg, 'center', W - 48);
  txt(c, t('search.empty_sub'), W / 2, cy + 45, F(400, 14.5), pal.sub, 'center', W - 48);
  c.restore();
  return H;
}
const _searchChipAnim = { x: null, w: null, t: 0 };
function drawTintedFilterChips(c, P, y, railId, filters, curF, animState, chipPrefix, onSelect, opts) {
  c.font = F(600, 14.5);
  const ws = filters.map(f => Math.ceil(c.measureText(f[1]).width) + 36);
  const posX = [];
  let ex = 20;
  for (let i = 0; i < ws.length; i++) { posX.push(ex); ex += ws[i] + 8; }
  const now = performance.now();
  const selIdx = Math.max(0, filters.findIndex(f => f[0] === curF));
  const tgX = posX[selIdx], tgW = ws[selIdx];
  const dt = animState.t ? clamp((now - animState.t) / 1000, 0.001, 0.05) : 0.016;
  animState.t = now;
  if (animState.x == null) { animState.x = tgX; animState.w = tgW; }
  else if (Math.abs(animState.x - tgX) > 0.35 || Math.abs(animState.w - tgW) > 0.35) {
    animState.x = ease(animState.x, tgX, 20, dt);
    animState.w = ease(animState.w, tgW, 20, dt);
    if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
    else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  } else { animState.x = tgX; animState.w = tgW; }
  const isFb = typeof FALLBACK !== 'undefined' && !!FALLBACK;
  const chipY = y;
  const outY = rail(c, P, railId, y, filters, 0, 8, 38, (c, f, rxItem, ry, i) => {
    const w = ws[i], pk = chipPrefix + ':' + f[0];
    if (isFb) {
      withPressScale(c, pk, rxItem + w / 2, ry + 18, () => {
        rrPath(c, rxItem, ry, w, 36, 18);
        c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.045)'; c.fill();
        if (typeof drawRowPressTint === 'function') drawRowPressTint(c, pk, rxItem, ry, w, 36, 18);
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.10)';
        rrPath(c, rxItem + .5, ry + .5, w - 1, 35, 17.5); c.stroke();
        txt(c, f[1], rxItem + w / 2, ry + 23, F(500, 14.5), pal.fg, 'center');
      });
    }
    hit(rxItem, ry, w, 36, () => onSelect(f[0]), { pressKey: pk });
  }, { widths: ws });
  if (vis(P, chipY, 38)) {
    const rx = (P.rails && P.rails[railId]) ? P.rails[railId].x : 0;
    const actSc = typeof pressScale === 'function' ? pressScale(chipPrefix + ':' + curF) : 1;
    if (isFb) {
      c.save();
      c.beginPath(); c.rect(0, chipY - 4, W, 46); c.clip();
      c.translate(-rx, 0);
      const px = animState.x, pw = animState.w;
      if (actSc !== 1) { c.translate(px + pw / 2, chipY + 18); c.scale(actSc, actSc); c.translate(-(px + pw / 2), -(chipY + 18)); }
      rrPath(c, px, chipY, pw, 36, 18);
      c.fillStyle = pal.dark ? '#ffffff' : '#111111'; c.fill();
      c.clip();
      for (let i = 0; i < filters.length; i++) {
        txt(c, filters[i][1], posX[i] + ws[i] / 2, chipY + 23, F(600, 14.5), pal.dark ? '#000000' : '#ffffff', 'center');
      }
      c.restore();
    } else if (typeof SET_GLASS !== 'undefined') {
      SET_GLASS.push({
        kind: 'filterRail',
        under: !REG,
        y: chipY + T.y,
        h: 36,
        topLim: opts && opts.noTopBar ? (TOP - 2) : undefined,
        topFade: opts && opts.noTopBar ? (TOP - 14) : undefined,
        rx,
        actX: animState.x - rx + T.x,
        actW: animState.w,
        actSc,
        chips: filters.map((f, i) => ({
          id: f[0],
          label: f[1],
          x: posX[i] - rx + T.x,
          w: ws[i],
          sc: typeof pressScale === 'function' ? pressScale(chipPrefix + ':' + f[0]) : 1
        }))
      });
    }
  }
  return outY;
}
function searchFilters(c, P, y) {
  return drawTintedFilterChips(c, P, y, 'sfilt', getSearchFilters(), NAV.sFilter || 'all', _searchChipAnim, 's_chip', id => {
    if (NAV.sFilter !== id) { NAV.sFilter = id; P.scroll = 0; P.vel = 0; redraw(); }
  }, { noTopBar: true }) + 12;
}
function searchHead(c, P, y, s) {
  if (vis(P, y, 28)) eyebrow(c, s, 24, y + 18, pal.sub);
  return y + 25;
}
PAGES.search = (c, P) => {
  const q = NAV.query.trim().toLowerCase(); let y = TOP + 10;
  if (!q) return drawSearchEmpty(c);
  y = searchFilters(c, P, y);
  const f = NAV.sFilter || 'all';
  const ts = TRACKS.filter(t => (t.title + ' ' + t.artist + ' ' + BYID[t.album].genre + ' ' + BYID[t.album].title).toLowerCase().includes(q));
  const als = ALBUMS.filter(a => (a.title + ' ' + a.artist + ' ' + a.genre).toLowerCase().includes(q)), ars = ARTISTS.filter(a => a.title.toLowerCase().includes(q));
  if (!ts.length && !als.length && !ars.length) { txt(c, t('search.no_results', { q: NAV.query }), W / 2, y + 60, F(600, 17), pal.fg, 'center', W - 40); txt(c, t('search.no_results_hint'), W / 2, y + 84, F(400, 15), pal.sub, 'center', W - 40); y += 110; }
  if ((f === 'all' || f === 'songs') && ts.length) { y = searchHead(c, P, y, t('search.filter_songs')); const l = ts.slice(0, f === 'all' ? 8 : 25); l.forEach((t, i) => { y = songRow(c, P, y, t, l, i, { noSep: true, single: true }); }); y += 12; }
  if ((f === 'all' || f === 'artists') && ars.length) { y = searchHead(c, P, y, t('search.filter_artists')); ars.slice(0, f === 'all' ? 3 : 15).forEach(a => { if (vis(P, y, 66)) { drawArt(c, a, 24, y + 7, 52, 26); txt(c, a.title, 88, y + 39, F(500, 16.5), pal.fg, 'left', W - 124); icon(c, 'chev', W - 30, y + 33, 12, pal.sub2, { lw: 3.2 }); } hit(0, y, W, 66, () => open(a)); y += 66; }); y += 12; }
  if ((f === 'all' || f === 'albums') && als.length) { y = searchHead(c, P, y, t('search.filter_albums')); als.slice(0, f === 'all' ? 4 : 15).forEach(a => { if (vis(P, y, 66)) { drawArt(c, a, 24, y + 7, 52, 8); txt(c, a.title, 88, y + 30, F(500, 16.5), pal.fg, 'left', W - 124); txt(c, a.artist + ' · ' + a.year, 88, y + 50, F(400, 14), pal.sub, 'left', W - 124); icon(c, 'chev', W - 30, y + 33, 12, pal.sub2, { lw: 3.2 }); } hit(0, y, W, 66, () => open(a)); y += 66; }); y += 12; }
  return end(y + (NAV.focus ? KBH : 0));
};

const getSetTiles = () => [
  ['playback', t('settings.cat_playback'), t('settings.cat_playback_sub'), 'sliders', '#fb7185'],
  ['eq', t('settings.cat_eq'), t('settings.cat_eq_sub'), 'eq', '#38bdf8'],
  ['glass', t('settings.cat_glass'), t('settings.cat_glass_sub'), 'drop', '#a78bfa'],
  ['storage', t('settings.cat_storage'), t('settings.cat_storage_sub'), 'info', '#34d399']
];
const CF_STEPS = [0, 2, 4, 6, 8, 12];
const getLySrcOpts = () => [
  ['auto', t('settings.source_auto')],
  ['apple', t('settings.source_apple')],
  ['better', t('settings.source_better')],
  ['lrclib', t('settings.source_lrclib')],
  ['netease', t('settings.source_netease')]
];
const getEqList = () => [
  ['flat', t('settings.eq_flat')],
  ['bass', t('settings.eq_bass')],
  ['vocal', t('settings.eq_vocal')],
  ['rock', t('settings.eq_rock')],
  ['pop', t('settings.eq_pop')],
  ['electronic', t('settings.eq_electro')]
];
const EQ_BANDS = ['60Hz', '230Hz', '910Hz', '3.6kHz', '14kHz'];
const getPrevTabs = () => [
  ['home', t('tab.home'), 'home'],
  ['new', t('tab.new'), 'new'],
  ['radio', t('tab.radio'), 'radio'],
  ['library', t('tab.library'), 'library']
];
const PREV_TABS = [['home', 'Home', 'home'], ['new', 'New', 'new'], ['radio', 'Radio', 'radio'], ['library', 'Library', 'library']];
function syncPrevTabs() {
  if (typeof t !== 'function') return;
  const next = getPrevTabs();
  for (let i = 0; i < next.length; i++) PREV_TABS[i] = next[i];
}
function drawGlobeIcon(c, x, y, sz, col) {
  const r = sz * .48;
  c.save();
  c.strokeStyle = col;
  c.lineWidth = 1.9;
  c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.ellipse(x, y, r * .48, r, 0, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(x - r * .94, y - r * .30); c.lineTo(x + r * .94, y - r * .30);
  c.moveTo(x - r * .94, y + r * .30); c.lineTo(x + r * .94, y + r * .30); c.stroke();
  c.restore();
}
let SET_GLASS = [];

const _SET_SUB_TITLE_KEYS = {
  playback: 'settings.cat_playback',
  eq: 'settings.cat_eq',
  glass: 'settings.cat_glass',
  language: 'settings.cat_language',
  storage: 'settings.cat_storage'
};
function setSubOf(P, sub, title) {
  if (sub) {
    const tk = _SET_SUB_TITLE_KEYS[sub] || 'settings.title';
    push('settings', { title: title || t(tk), titleKey: tk, subPage: sub });
  } else pop();
}

function lerpToggleCol(val) {
  const f = clamp(val, 0, 1);
  const r0 = 120, g0 = 120, b0 = 128, a0 = pal.dark ? .36 : .20;
  const r1 = pal.dark ? 48 : 52, g1 = pal.dark ? 209 : 199, b1 = pal.dark ? 88 : 89, a1 = 1;
  return 'rgba(' + Math.round(mix(r0, r1, f)) + ',' + Math.round(mix(g0, g1, f)) + ',' + Math.round(mix(b0, b1, f)) + ',' + (+mix(a0, a1, f).toFixed(3)) + ')';
}

function drawSetCard(c, x, y, w, h, rad) {
  rrPath(c, x, y, w, h, rad || 22);
  c.fillStyle = pal.dark ? 'rgba(255,255,255,.065)' : 'rgba(0,0,0,.042)';
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)';
  c.stroke();
}

function drawSetHeader(c, P, y, ico, title, sub, col) {
  const h = 76;
  if (vis(P, y, h)) {
    drawSetCard(c, 20, y, W - 40, h, 22);
    c.beginPath(); c.arc(54, y + h / 2, 20, 0, Math.PI * 2);
    c.fillStyle = col + '26'; c.fill();
    icon(c, ico, 54, y + h / 2, 20, col);
    txt(c, title, 86, y + 33, F(700, 18), pal.fg, 'left', W - 116);
    txt(c, sub, 86, y + 54, F(400, 13.5), pal.sub, 'left', W - 116);
  }
  return y + h + 18;
}

function setToggleRow(c, P, y, id, title, sub, val, onChange, isLast) {
  const h = sub ? 68 : 56;
  const ctrl = lqCtrl('tg_' + id, val ? 1 : 0);
  if (!ctrl.pressed) ctrl.val.t = val ? 1 : 0;
  const f = clamp(ctrl.val.x, 0, 1), pp = clamp(ctrl.pp.x, 0, 1);
  const vel = ctrl.vel.x / 50;
  const cvx = clamp(vel * .75, -.2, .2), cvy = clamp(vel * .25, -.2, .2);
  const sx = ctrl.sx.x / (1 - cvx), sy = ctrl.sy.x * (1 - cvy);
  const tx = W - 36 - 64, ty = y + h / 2 - 14;
  const trackBg = lerpToggleCol(f);
  const thumbW = 40 * sx, thumbH = 24 * sy;
  const thumbCX = tx + 2 + f * 20 + 20, thumbCY = ty + 14;

  if (vis(P, y, h)) {
    const cardBg = pal.dark ? '#1d1d1d' : '#f4f4f4';
    txt(c, title, 36, y + (sub ? 27 : 34), F(500, 15.8), pal.fg, 'left', W - 144);
    if (sub) txt(c, sub, 36, y + 48, F(400, 12.8), pal.sub, 'left', W - 144);
    rrPath(c, tx, ty, 64, 28, 14);
    c.fillStyle = trackBg;
    c.fill();
    if (!isLast) { c.fillStyle = pal.sep; c.fillRect(36, y + h - .5, W - 72, .5); }
    const isFbTg = typeof FALLBACK !== 'undefined' && !!FALLBACK;
    const fastSlideThumb = !isFbTg && typeof NAV !== 'undefined' && NAV.popP > 0.001 && pp <= 0.001;
    if (isFbTg || fastSlideThumb) {
      c.save();
      c.shadowColor = 'rgba(0,0,0,.10)'; c.shadowBlur = 4; c.shadowOffsetY = 2;
      rrPath(c, thumbCX - thumbW / 2, thumbCY - thumbH / 2, thumbW, thumbH, thumbH / 2);
      c.fillStyle = '#ffffff';
      c.fill();
      c.restore();
    } else {
      SET_GLASS.push({
        kind: 'toggle',
        under: !REG,
        x: thumbCX - thumbW / 2 + T.x,
        y: thumbCY - thumbH / 2 + T.y,
        w: thumbW, h: thumbH,
        tx: tx + T.x, ty: ty + T.y,
        f, pp, sx, sy, trackBg, cardBg
      });
    }
  }
  hit(20, y, W - 40, h, null, {
    lqCtrl: ctrl,
    lqSpan: 20,
    lqScale: 1.5,
    lqTap: () => { const next = !val; ctrl.val.t = next ? 1 : 0; onChange(next); },
    lqCommit: () => { const next = ctrl.val.t >= .5; ctrl.val.t = next ? 1 : 0; if (next !== val) onChange(next); }
  });
  return y + h;
}

function setSegmentedRow(c, P, y, label, opts, curVal, onPick, cfg) {
  const h = 84;
  const selIdx = Math.max(0, opts.findIndex(([id]) => id === curVal));
  const spKey = (cfg && cfg.spKey) || label;
  let sp = typeof SEG_SP !== 'undefined' ? SEG_SP[spKey] : null;
  if (!sp && typeof SEG_SP !== 'undefined') sp = SEG_SP[spKey] = new Spring(selIdx, 340, 35);
  if (sp) sp.t = selIdx;
  const animIdx = sp ? clamp(sp.x, -.08, opts.length - .92) : selIdx;

  if (vis(P, y, h)) {
    txt(c, label, 36, y + 24, F(600, 14.5), pal.fg);
    const rx = 32, rw = W - 64, ry = y + 34, rh = 38;
    rrPath(c, rx, ry, rw, rh, 12);
    c.fillStyle = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.055)';
    c.fill();
    const iw = (rw - 6) / opts.length;
    const pillX = rx + 3 + animIdx * iw;
    const useGlassPill = !!(cfg && cfg.glass && (typeof FALLBACK === 'undefined' || !FALLBACK));
    if (useGlassPill && typeof SET_GLASS !== 'undefined') {
      SET_GLASS.push({
        kind: 'segPill',
        under: !REG,
        x: pillX + T.x,
        y: ry + 3 + T.y,
        w: iw,
        h: rh - 6,
        rx: rx + T.x,
        ry: ry + T.y,
        rw,
        rh,
        animIdx,
        opts
      });
    } else {
      c.save();
      if (!pal.dark) { c.shadowColor = 'rgba(0,0,0,.10)'; c.shadowBlur = 6; c.shadowOffsetY = 2; }
      rrPath(c, pillX, ry + 3, iw, rh - 6, 9.5);
      c.fillStyle = pal.dark ? 'rgba(255,255,255,.18)' : '#ffffff';
      c.fill();
      c.restore();
    }

    opts.forEach(([id, lb], i) => {
      const ix = rx + 3 + i * iw;
      if (!useGlassPill) {
        const prox = clamp(1 - Math.abs(animIdx - i), 0, 1);
        const sel = prox > .5;
        const col = prox > .02 ? (prox > .5 ? pal.fg : pal.sub) : pal.sub;
        txt(c, lb, ix + iw / 2, ry + 24, F(sel ? 600 : 500, 13.5), col, 'center', iw - 4);
      }
      hit(ix, ry, iw, rh, () => onPick(id));
    });
  }
  return y + h;
}

function setSliderRow(c, P, y, id, label, valStr, norm, onSet, isLast, accentCol) {
  const h = 80, sx = 36, sw = W - 72, sy = y + 52, col = accentCol || '#0091FF';
  const ctrl = lqCtrl('sl_' + id, clamp(norm, 0, 1));
  if (!ctrl.pressed) ctrl.val.t = clamp(norm, 0, 1);
  const f = clamp(ctrl.val.x, 0, 1), pp = clamp(ctrl.pp.x, 0, 1);
  const vel = ctrl.vel.x / 10;
  const cv = clamp(vel * .75, -.2, .2);
  const scaleX = ctrl.sx.x / (1 - cv), scaleY = ctrl.sy.x * (1 - cv * .33);
  const thumbLeft = f * (sw - 40), thumbCX = sx + thumbLeft + 20, thumbCY = sy;
  const thumbW = 40 * scaleX, thumbH = 24 * scaleY;
  const activeW = clamp(f * (sw - 40) + 20, 0, sw);

  if (vis(P, y, h)) {
    txt(c, label, 36, y + 25, F(500, 15.5), pal.fg);
    txt(c, valStr, W - 36, y + 25, F(600, 14.5), col, 'right');
    rrPath(c, sx, sy - 3, sw, 6, 3);
    c.fillStyle = 'rgba(120,120,128,.36)';
    c.fill();
    if (activeW > 0) {
      rrPath(c, sx, sy - 3, activeW, 6, 3);
      c.fillStyle = col;
      c.fill();
    }
    if (!isLast) { c.fillStyle = pal.sep; c.fillRect(36, y + h - .5, W - 72, .5); }
    SET_GLASS.push({
      kind: 'slider',
      under: !REG,
      x: thumbCX - thumbW / 2 + T.x,
      y: thumbCY - thumbH / 2 + T.y,
      w: thumbW, h: thumbH,
      pp
    });
  }
  const span = Math.max(1, sw - 40);
  hit(20, y + 24, W - 40, 50, null, {
    lqCtrl: ctrl,
    lqSpan: span,
    lqScale: 1.5,
    lqDown: px => {
      const clickX = px - sx;
      if (Math.abs(clickX - (thumbLeft + 20)) > 28) {
        const nf = clamp((clickX - 20) / span, 0, 1);
        ctrl.val.t = nf; onSet(nf);
      }
    },
    lqMove: () => { onSet(clamp(ctrl.val.t, 0, 1)); },
    lqCommit: () => {
      onSet(clamp(ctrl.val.t, 0, 1));
      if (typeof flushPrefsSave === 'function') flushPrefsSave();
    }
  });
  return y + h;
}

PAGES.settings = (c, P) => {
  let y = listTop() + 6;
  const sub = (P.data && P.data.subPage) || P.subPage || null;
  const subTitleKey = sub ? (_SET_SUB_TITLE_KEYS[sub] || 'settings.title') : 'settings.title';
  if (P.data) {
    P.data.title = t(subTitleKey);
    P.data.titleKey = subTitleKey;
  }

  if (!sub) {
    eyebrow(c, t('settings.categories'), 26, y + 12);
    y += 22;
    const tw = Math.floor((W - 40 - 12) / 2), th = 112;
    getSetTiles().forEach(([id, title, desc, ic, col], i) => {
      const tx = 20 + (i % 2) * (tw + 12), ty = y + Math.floor(i / 2) * (th + 12), pk = 'set_tile:' + id;
      if (vis(P, ty, th)) {
        withPressScale(c, pk, tx + tw / 2, ty + th / 2, () => {
          drawSetCard(c, tx, ty, tw, th, 22);
          drawRowPressTint(c, pk, tx, ty, tw, th, 22);
          c.beginPath(); c.arc(tx + 32, ty + 32, 18, 0, Math.PI * 2);
          c.fillStyle = col + '24'; c.fill();
          icon(c, ic, tx + 32, ty + 32, 18, col);
          icon(c, 'chev', tx + tw - 22, ty + 28, 11, pal.sub2, { lw: 3 });
          txt(c, title, tx + 16, ty + 74, F(700, 16.5), pal.fg, 'left', tw - 28);
          txt(c, desc, tx + 16, ty + 94, F(400, 12.5), pal.sub, 'left', tw - 28);
        });
      }
      hit(tx, ty, tw, th, () => setSubOf(P, id, title), { pressKey: pk });
    });
    y += 2 * (th + 12);

    const langH = 72, langPk = 'set_tile:language';
    const curLangCfg = typeof getConfiguredLang === 'function' ? getConfiguredLang() : 'auto';
    const resLang = typeof getResolvedLang === 'function' ? getResolvedLang() : 'it';
    const curGeoCfg = typeof getConfiguredCountry === 'function' ? getConfiguredCountry() : 'auto';
    const resGeo = typeof getResolvedCountry === 'function' ? getResolvedCountry() : 'IT';
    const curLangLbl = curLangCfg === 'auto'
      ? (t('settings.lang_auto') + ' (' + resLang.toUpperCase() + ')')
      : t(curLangCfg === 'it' ? 'settings.lang_it' : 'settings.lang_en');
    const curGeoLbl = curGeoCfg === 'auto'
      ? (t('settings.country_auto') + ' (' + resGeo + ')')
      : (typeof getCountryLabel === 'function' ? getCountryLabel(curGeoCfg) : curGeoCfg);
    if (vis(P, y, langH)) {
      withPressScale(c, langPk, W / 2, y + langH / 2, () => {
        drawSetCard(c, 20, y, W - 40, langH, 22);
        drawRowPressTint(c, langPk, 20, y, W - 40, langH, 22);
        c.beginPath(); c.arc(54, y + langH / 2, 18, 0, Math.PI * 2);
        c.fillStyle = '#fb923c24'; c.fill();
        drawGlobeIcon(c, 54, y + langH / 2, 20, '#fb923c');
        txt(c, t('settings.cat_language'), 84, y + 31, F(700, 16), pal.fg, 'left', W - 140);
        txt(c, curLangLbl + ' · ' + curGeoLbl, 84, y + 51, F(400, 12.5), pal.sub, 'left', W - 140);
        icon(c, 'chev', W - 38, y + langH / 2, 11, pal.sub2, { lw: 3 });
      });
    }
    hit(20, y, W - 40, langH, () => setSubOf(P, 'language', t('settings.cat_language')), { pressKey: langPk });
    y += langH + 18;

    eyebrow(c, t('settings.quick_controls'), 26, y + 12);
    y += 22;
    const cardY = y, cardH = 84 + 68 + 68 + 68;
    if (vis(P, cardY, cardH)) drawSetCard(c, 20, cardY, W - 40, cardH, 22);
    y = setSegmentedRow(c, P, y, t('settings.theme_app'), [['auto', t('settings.theme_auto')], ['light', t('settings.theme_light')], ['dark', t('settings.theme_dark')]], themeMode, m => applyTheme(m), { spKey: 'theme' });
    c.fillStyle = pal.sep; c.fillRect(36, y - .5, W - 72, .5);
    y = setToggleRow(c, P, y, 'idx_alone', t('settings.lyrics_alone'), t('settings.lyrics_alone_short'), PREFS.lyricsAlone, v => { PREFS.lyricsAlone = v; savePrefs(); });
    y = setToggleRow(c, P, y, 'idx_skip', t('settings.skip_fade'), t('settings.skip_fade_short'), PREFS.skipFade, v => { PREFS.skipFade = v; savePrefs(); });
    y = setToggleRow(c, P, y, 'idx_swq', t('settings.swipe_queue'), t('settings.swipe_queue_short'), PREFS.swipeQueue, v => { PREFS.swipeQueue = v; savePrefs(); }, true);
    return end(y + 12);
  }

  if (sub === 'playback') {
    eyebrow(c, t('settings.audio_transitions'), 26, y + 12); y += 22;
    const h1 = 84 + 68 + 68 + 68 + 68 + 68;
    if (vis(P, y, h1)) drawSetCard(c, 20, y, W - 40, h1, 22);
    y = setSegmentedRow(c, P, y, t('settings.crossfade'), CF_STEPS.map(s => [s, s ? s + 's' : t('settings.off')]), PREFS.crossfade || 0, v => { PREFS.crossfade = v; savePrefs(); }, { spKey: 'crossfade' });
    c.fillStyle = pal.sep; c.fillRect(36, y - .5, W - 72, .5);
    y = setToggleRow(c, P, y, 'pb_vnorm', t('settings.volume_norm'), t('settings.volume_norm_sub'), PREFS.volumeNorm !== false, v => { PREFS.volumeNorm = v; savePrefs(); });
    y = setToggleRow(c, P, y, 'pb_skip', t('settings.skip_fade'), t('settings.skip_fade_sub'), PREFS.skipFade, v => { PREFS.skipFade = v; savePrefs(); });
    y = setToggleRow(c, P, y, 'pb_smart', t('settings.smart_shuffle'), t('settings.smart_shuffle_sub'), PREFS.smartShuffle, v => {
      PREFS.smartShuffle = v;
      if (PL.shuffle) setShuffle(true, v);
      savePrefs();
    });
    y = setToggleRow(c, P, y, 'pb_inf', t('settings.auto_queue'), t('settings.auto_queue_sub'), PL.infinity, v => { PL.infinity = v; redraw(); });
    y = setToggleRow(c, P, y, 'pb_swq', t('settings.swipe_queue'), t('settings.swipe_queue_sub'), PREFS.swipeQueue, v => { PREFS.swipeQueue = v; savePrefs(); }, true);

    y += 18;
    eyebrow(c, t('settings.lyrics_exp'), 26, y + 12); y += 22;
    const h2 = 68 + 84 + 84;
    if (vis(P, y, h2)) drawSetCard(c, 20, y, W - 40, h2, 22);
    y = setToggleRow(c, P, y, 'pb_alone', t('settings.lyrics_alone_focus'), t('settings.lyrics_alone_sub'), PREFS.lyricsAlone, v => { PREFS.lyricsAlone = v; savePrefs(); });
    y = setSegmentedRow(c, P, y, t('settings.lyrics_anim_style'), [['anim', t('lyrics.style_animated_sub')], ['classic', t('lyrics.style_classic')]], SRCUI.style || 'anim', st => { SRCUI.style = st; try { localStorage.setItem('sonora-ly-style', st); } catch (e) {} redraw(); }, { spKey: 'ly_anim' });
    c.fillStyle = pal.sep; c.fillRect(36, y - .5, W - 72, .5);
    y = setSegmentedRow(c, P, y, t('settings.lyrics_source_pref'), getLySrcOpts(), PREFS.prefLySource || 'auto', src => {
      PREFS.prefLySource = src;
      LIVE.ly = {}; LIVE.lySel = {};
      savePrefs();
    }, { spKey: 'ly_src' });
  } else if (sub === 'eq') {
    eyebrow(c, t('settings.sound_profile'), 26, y + 12); y += 22;
    const hP = 84;
    if (vis(P, y, hP)) drawSetCard(c, 20, y, W - 40, hP, 22);
    y = setSegmentedRow(c, P, y, t('settings.eq_preset'), getEqList(), PREFS.eqPreset || 'flat', id => applyEqPreset(id), { spKey: 'eq_preset' });

    y += 18;
    eyebrow(c, t('settings.eq_bands'), 26, y + 12); y += 22;
    const gh = 230;
    if (vis(P, y, gh)) {
      drawSetCard(c, 20, y, W - 40, gh, 22);
      const gains = PREFS.eqGains || [0, 0, 0, 0, 0];
      const nowEq = performance.now();
      if (!P._eqVis || !Array.isArray(P._eqVis.vals) || P._eqVis.vals.length !== EQ_BANDS.length) {
        P._eqVis = { vals: EQ_BANDS.map((_, i) => gains[i] || 0), t: nowEq };
      }
      const eqDt = P._eqVis.t ? clamp((nowEq - P._eqVis.t) / 1000, 0.001, 0.05) : 0.016;
      P._eqVis.t = nowEq;
      let eqAnim = false;
      const visGains = EQ_BANDS.map((_, i) => {
        const tg = gains[i] || 0, curV = P._eqVis.vals[i];
        if (Math.abs(curV - tg) > 0.02) {
          P._eqVis.vals[i] = ease(curV, tg, 14, eqDt);
          eqAnim = true;
        } else {
          P._eqVis.vals[i] = tg;
        }
        return P._eqVis.vals[i];
      });
      if (eqAnim) {
        if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw();
        else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
      }

      const bx0 = 46, bw = (W - 92) / 5, topY = y + 34, botY = y + gh - 44, midY = (topY + botY) / 2, trH = botY - topY;
      c.strokeStyle = pal.sep; c.lineWidth = 1; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(36, midY); c.lineTo(W - 36, midY); c.stroke(); c.setLineDash([]);
      txt(c, '0dB', 32, midY - 6, F(500, 10), pal.sub2);

      const pts = EQ_BANDS.map((_, i) => {
        const g = clamp(visGains[i] || 0, -9, 9);
        return { x: bx0 + i * bw + bw / 2, y: midY - (g / 9) * (trH / 2), g };
      });
      c.save();
      c.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) c.moveTo(p.x, p.y);
        else { const prev = pts[i - 1], cx = (prev.x + p.x) / 2; c.bezierCurveTo(cx, prev.y, cx, p.y, p.x, p.y); }
      });
      c.strokeStyle = '#38bdf8'; c.lineWidth = 2.5; c.stroke();
      c.restore();

      pts.forEach((p, i) => {
        rrPath(c, p.x - 3, topY, 6, trH, 3);
        c.fillStyle = pal.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'; c.fill();
        const yMin = Math.min(midY, p.y), fH = Math.max(4, Math.abs(p.y - midY));
        rrPath(c, p.x - 3, yMin, 6, fH, 3);
        c.fillStyle = '#38bdf8'; c.fill();
        const norm = clamp((p.g + 9) / 18, 0, 1);
        const ctrl = lqCtrl('eq_b' + i, norm);
        if (!ctrl.pressed) ctrl.val.t = norm;
        const pp = clamp(ctrl.pp.x, 0, 1), vel = ctrl.vel.x / 10, cv = clamp(vel * .75, -.2, .2);
        const scaleY = ctrl.sy.x / (1 - cv), scaleX = ctrl.sx.x * (1 - cv * .33);
        const thumbW = 24 * scaleX, thumbH = 32 * scaleY;
        if (typeof FALLBACK !== 'undefined' && FALLBACK) {
          c.save();
          c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 5; c.shadowOffsetY = 1.5;
          c.beginPath(); c.arc(p.x, p.y, 10, 0, Math.PI * 2);
          c.fillStyle = '#ffffff'; c.fill();
          c.restore();
        } else if (typeof SET_GLASS !== 'undefined') {
          SET_GLASS.push({
            kind: 'slider',
            under: !REG,
            x: p.x - thumbW / 2 + T.x,
            y: p.y - thumbH / 2 + T.y,
            w: thumbW,
            h: thumbH,
            pp
          });
        }
        const gStr = (p.g > 0.04 ? '+' : '') + p.g.toFixed(1);
        txt(c, gStr, p.x, topY - 12, F(600, 11.5), Math.abs(p.g) > .1 ? '#38bdf8' : pal.sub, 'center');
        txt(c, EQ_BANDS[i], p.x, botY + 24, F(600, 12), pal.sub, 'center');
        const setBand = py => {
          const bNorm = 1 - clamp((py - topY) / trH, 0, 1);
          const db = Math.round(((bNorm * 18) - 9) * 2) / 2;
          if (!Array.isArray(PREFS.eqGains)) PREFS.eqGains = [0, 0, 0, 0, 0];
          PREFS.eqGains[i] = db;
          if (P._eqVis && P._eqVis.vals) P._eqVis.vals[i] = db;
          PREFS.eqPreset = 'custom';
          if (PL.audio) attachAudioEq(PL.audio);
          syncEqFilters();
          savePrefs();
        };
        hit(p.x - bw / 2, topY - 16, bw, trH + 36, () => setBand(INP.y - T.y), {
          lqCtrl: ctrl,
          lqScale: 1.38,
          lqSpan: trH,
          setDrag: () => setBand(INP.y - (-P.scroll))
        });
      });
    }
    y += gh + 16;
    pillBtn(c, 20, y, W - 40, 46, t('settings.eq_reset'), 'eq', () => applyEqPreset('flat'));
    y += 54;
  } else if (sub === 'glass') {
    const ph = 152, px = 20, pw = W - 40;
    const pCtrl = lqCtrl('prev_nav', (P.prevTab || 0) / 3);
    if (!pCtrl.pressed) pCtrl.val.t = (P.prevTab || 0) / 3;
    const pVal = clamp(pCtrl.val.x, 0, 1) * 3, pPP = clamp(pCtrl.pp.x, 0, 1);
    const pVel = pCtrl.vel.x / 10, pVx = clamp(pVel * .75, -.2, .2), pVy = clamp(pVel * .25, -.2, .2);
    const pScale = 1 + (74 / 56 - 1) * pPP;
    const pSx = pScale / (1 - pVx), pSy = pScale * (1 - pVy);
    const barX = px + 18, barW = pw - 36, barH = 58, barY = y + ph - barH - 16;
    const tw = (barW - 8) / 4;
    const bCx = barX + 4 + tw / 2 + clamp(pVal, -.2, 3.2) * tw, bCy = barY + barH / 2;
    const bHw = tw * pSx / 2, bHh = (barH - 8) * pSy / 2;

    if (vis(P, y, ph)) {
      c.save();
      rrPath(c, px, y, pw, ph, 22); c.clip();
      const bgGrad = c.createLinearGradient(px, y, px + pw, y + ph);
      bgGrad.addColorStop(0, '#fa2e49');
      bgGrad.addColorStop(.34, '#ff7a45');
      bgGrad.addColorStop(.68, '#2ed3c6');
      bgGrad.addColorStop(1, '#1b1b1b');
      c.fillStyle = bgGrad; c.fillRect(px, y, pw, ph);

      const glow = c.createRadialGradient(px + pw * .72, y + ph * .32, 4, px + pw * .72, y + ph * .32, pw * .48);
      glow.addColorStop(0, 'rgba(255,255,255,.32)');
      glow.addColorStop(.5, 'rgba(167,139,250,.24)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = glow; c.fillRect(px, y, pw, ph);

      const stripeCount = 6, padY = 12, availH = ph - padY * 2;
      for (let i = 0; i < stripeCount; i++) {
        const sy = y + padY + (i + .5) * (availH / stripeCount) - 2.5;
        const sw = pw * (i % 2 === 0 ? .94 : .70);
        rrPath(c, px, sy, sw, 5, 2.5);
        c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.50)';
        c.fill();
      }
      c.restore();

      c.save();
      rrPath(c, px + .5, y + .5, pw - 1, ph - 1, 22);
      c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.10)'; c.stroke();
      c.restore();

      if (REG) {
        SET_GLASS.push({
          kind: 'prevBar',
          cardX: px + T.x, cardY: y + T.y, cardW: pw, cardH: ph,
          x: barX + T.x, y: barY + T.y, w: barW, h: barH,
          tw, pVal, pPP, bCx: bCx + T.x, bCy: bCy + T.y, bHw, bHh, slosh: pCtrl.vel.x * tw * .02
        });
      }
    }
    const barSpan = Math.max(1, barW - tw);
    hit(barX, barY - 6, barW, barH + 12, null, {
      lqCtrl: pCtrl,
      lqSpan: barSpan,
      lqScale: 74 / 56,
      lqDown: clickX => {
        const idx = clamp(Math.floor((clickX - barX) / tw), 0, 3);
        P.prevTab = idx; pCtrl.val.t = idx / 3;
      },
      lqMove: () => {
        P.prevTab = clamp(Math.round(pCtrl.val.t * 3), 0, 3);
      },
      lqCommit: () => {
        const idx = clamp(Math.round(pCtrl.val.t * 3), 0, 3);
        P.prevTab = idx; pCtrl.val.t = idx / 3;
      }
    });
    y += ph + 18;

    eyebrow(c, t('settings.glass_section'), 26, y + 12); y += 22;
    const hG1 = 84 + 84 + 80 + 80 + 68 + 68;
    if (vis(P, y, hG1)) drawSetCard(c, 20, y, W - 40, hG1, 22);
    y = setSegmentedRow(c, P, y, t('settings.theme_colors'), [['auto', t('settings.theme_auto')], ['light', t('settings.theme_light')], ['dark', t('settings.theme_dark')]], themeMode, m => applyTheme(m), { spKey: 'theme' });
    c.fillStyle = pal.sep; c.fillRect(36, y - .5, W - 72, .5);
    y = setSegmentedRow(c, P, y, t('settings.glass_profile'), [['light', t('settings.glass_light')], ['balanced', t('settings.glass_balanced')], ['vivid', t('settings.glass_vivid')]], PREFS.glassProfile || 'balanced', p => {
      PREFS.glassProfile = p;
      if (p === 'light') { PREFS.glassBlur = 0; PREFS.glassRefraction = 10; }
      else if (p === 'balanced') { PREFS.glassBlur = 2; PREFS.glassRefraction = 24; }
      else { PREFS.glassBlur = 4; PREFS.glassRefraction = 36; PREFS.glassChromatic = true; }
      if (LQ.sl_ref) LQ.sl_ref.val.t = (PREFS.glassRefraction || 0) / 42;
      if (LQ.sl_blur) LQ.sl_blur.val.t = (PREFS.glassBlur || 0) / 8;
      savePrefs();
    }, { spKey: 'glass_profile' });
    c.fillStyle = pal.sep; c.fillRect(36, y - .5, W - 72, .5);
    y = setSliderRow(c, P, y, 'ref', t('settings.glass_refraction'), Math.round(PREFS.glassRefraction || 0) + ' px', (PREFS.glassRefraction || 0) / 42, f => {
      PREFS.glassProfile = 'balanced';
      PREFS.glassRefraction = Math.round(f * 42);
      savePrefs();
    });
    y = setSliderRow(c, P, y, 'blur', t('settings.glass_blur'), (PREFS.glassBlur || 0).toFixed(1) + ' px', (PREFS.glassBlur || 0) / 8, f => {
      PREFS.glassProfile = 'balanced';
      PREFS.glassBlur = Math.round(f * 16) / 2;
      savePrefs();
    });
    y = setToggleRow(c, P, y, 'gl_chr', t('settings.glass_chromatic'), t('settings.glass_chromatic_sub'), PREFS.glassChromatic, v => { PREFS.glassChromatic = v; savePrefs(); });
    y = setToggleRow(c, P, y, 'gl_fold', t('settings.bar_folds'), t('settings.bar_folds_sub'), PREFS.barFolds, v => { PREFS.barFolds = v; if (!PREFS.barFolds) NAV.min = 0; savePrefs(); }, true);
  } else if (sub === 'language') {
    const curLang = typeof getConfiguredLang === 'function' ? getConfiguredLang() : (PREFS.lang || 'auto');
    const curCountry = typeof getConfiguredCountry === 'function' ? getConfiguredCountry() : (PREFS.country || 'auto');
    const resLang = typeof getResolvedLang === 'function' ? getResolvedLang() : 'it';
    const resCountry = typeof getResolvedCountry === 'function' ? getResolvedCountry() : 'US';
    const resLangLabel = resLang === 'it' ? t('settings.lang_it') : t('settings.lang_en');
    const resCountryLabel = typeof getCountryLabel === 'function' ? getCountryLabel(resCountry) : resCountry;

    eyebrow(c, t('settings.lang_section_app').toUpperCase(), 26, y + 12); y += 22;
    if (vis(P, y, 84)) drawSetCard(c, 20, y, W - 40, 84, 22);
    y = setSegmentedRow(
      c, P, y,
      t('settings.lang_app_label'),
      [['auto', t('settings.lang_auto')], ['it', t('settings.lang_it')], ['en', t('settings.lang_en')]],
      curLang,
      v => {
        if (v !== curLang && typeof setLocaleConfig === 'function') {
          setLocaleConfig(v, curCountry, { force: true });
          if (typeof liveToast === 'function') liveToast(t('toast.locale_updated'), 1800);
        }
      },
      { spKey: 'app_lang' }
    );
    y += 10;
    if (vis(P, y, 22)) {
      txt(c, t('settings.lang_resolved_info', { lang: resLangLabel, country: resCountryLabel + ' (' + resCountry + ')' }), 26, y + 12, F(400, 12.5), pal.sub, 'left', W - 52);
    }
    y += 28;

    eyebrow(c, t('settings.lang_section_region').toUpperCase(), 26, y + 12); y += 22;
    if (vis(P, y, 22)) {
      txt(c, t('settings.lang_region_hint'), 26, y + 10, F(400, 12.5), pal.sub, 'left', W - 52);
    }
    y += 24;

    const countries = typeof getI18nCountries === 'function' ? getI18nCountries() : [{ code: 'auto' }, { code: 'IT' }, { code: 'US' }];
    const rowH = 54, cardH = countries.length * rowH;
    if (vis(P, y, cardH)) drawSetCard(c, 20, y, W - 40, cardH, 22);
    countries.forEach((cty, i) => {
      const ry = y + i * rowH;
      const pk = 'geo:' + cty.code;
      const isSel = cty.code === curCountry;
      const label = typeof getCountryLabel === 'function' ? getCountryLabel(cty.code) : cty.code;
      const badge = cty.code === 'auto' ? resCountry : cty.code;
      if (vis(P, ry, rowH)) {
        if (i > 0) { c.fillStyle = pal.sep; c.fillRect(36, ry - .5, W - 72, .5); }
        c.save();
        if (i === 0 || i === countries.length - 1) { rrPath(c, 20, y, W - 40, cardH, 22); c.clip(); }
        drawRowPressTint(c, pk, 20, ry, W - 40, rowH, 0);
        c.restore();
        txt(c, label, 36, ry + 32, F(isSel ? 600 : 500, 15.5), isSel ? pal.accent : pal.fg, 'left', W - 140);
        if (badge) {
          txt(c, badge, W - (isSel ? 68 : 36), ry + 32, F(600, 12.5), isSel ? pal.accent : pal.sub, 'right');
        }
        if (isSel) {
          icon(c, 'check', W - 46, ry + 27, 17, pal.accent, { lw: 2.2 });
        }
      }
      hit(20, ry, W - 40, rowH, () => {
        if (cty.code !== curCountry && typeof setLocaleConfig === 'function') {
          setLocaleConfig(curLang, cty.code, { force: true });
          if (typeof liveToast === 'function') liveToast(t('toast.locale_updated'), 1800);
        }
      }, { pressKey: pk });
    });
    y += cardH + 18;
  } else if (sub === 'storage') {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!P._cacheStats || !P._cacheStatsAt || (now - P._cacheStatsAt) > 4000) {
      if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getCacheStats === 'function') {
        try {
          P._cacheStats = JSON.parse(window.SonoraNative.getCacheStats());
          P._cacheStatsAt = now;
        } catch (e) {}
      }
    }
    const stats = P._cacheStats || null;
    const nArt = stats && stats.coverCount != null ? stats.coverCount : Object.keys(ARTC).length;
    const nLy = stats && stats.lyricsCount != null ? stats.lyricsCount : Object.keys(LIVE.ly || {}).length;
    const nSav = (LIVE.saved || []).length, nLoc = (LIVE.localFiles || []).length;
    const toMb = b => +(Math.max(0, b) / (1024 * 1024)).toFixed(2);
    const mbSav = stats ? toMb(stats.mediaBytes || 0) : +(nSav * 3.4 + nLoc * 4.2).toFixed(1);
    const mbArt = stats ? toMb(stats.httpCoverBytes || 0) : +(nArt * .18).toFixed(1);
    const mbLy = stats ? toMb(stats.lyricsBytes || 0) : +(nLy * .04).toFixed(2);
    const totMb = stats ? Math.max(.01, toMb(stats.totalBytes || 0)) : Math.max(.1, +(mbArt + mbLy + mbSav).toFixed(1));
    const mbUnit = t('common.mb_unit');
    const chH = 196;
    if (vis(P, y, chH)) {
      drawSetCard(c, 20, y, W - 40, chH, 22);
      txt(c, t('settings.storage_used'), 36, y + 30, F(600, 15.5), pal.fg, 'left', W - 150);
      txt(c, totMb.toFixed(totMb < 10 ? 2 : 1) + ' ' + mbUnit, W - 36, y + 30, F(700, 16), '#34d399', 'right');
      const bx = 36, bw = W - 72, by = y + 46, bh = 14;
      c.save(); rrPath(c, bx, by, bw, bh, 7); c.clip();
      c.fillStyle = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)'; c.fillRect(bx, by, bw, bh);
      const w1 = bw * (mbSav / totMb), w2 = bw * (mbArt / totMb), w3 = Math.max(0, bw - w1 - w2);
      c.fillStyle = '#38bdf8'; c.fillRect(bx, by, w1, bh);
      c.fillStyle = '#a78bfa'; c.fillRect(bx + w1, by, w2, bh);
      c.fillStyle = '#34d399'; c.fillRect(bx + w1 + w2, by, w3, bh);
      c.restore();

      const audioSub = (nSav + nLoc)
        ? t('settings.storage_audio_sub', { mb: mbSav, count: nSav + nLoc })
        : (mbSav + ' ' + mbUnit);
      const leg = [
        ['#38bdf8', t('settings.storage_cache_audio'), audioSub],
        ['#a78bfa', t('settings.storage_cache_covers'), t('settings.storage_covers_sub', { count: nArt, mb: mbArt })],
        ['#34d399', t('settings.storage_cache_lyrics'), t('settings.storage_lyrics_sub', { count: nLy, mb: mbLy })]
      ];
      leg.forEach(([col, lb, valTxt], i) => {
        const ry = y + 84 + i * 32;
        c.beginPath(); c.arc(42, ry - 4, 5, 0, Math.PI * 2); c.fillStyle = col; c.fill();
        txt(c, lb, 56, ry, F(500, 13.5), pal.fg, 'left', W - 200);
        txt(c, valTxt, W - 36, ry, F(500, 13), pal.sub, 'right');
      });
    }
    y += chH + 18;

    eyebrow(c, t('settings.storage_actions'), 26, y + 12); y += 22;
    pillBtn(c, 20, y, W - 40, 48, t('settings.storage_import'), 'folder', () => { if (typeof pickLocalAudio === 'function') pickLocalAudio(); });
    y += 58;
    pillBtn(c, 20, y, W - 40, 48, t('settings.storage_clear'), 'trash', () => {
      if (typeof clearLiveCoverCache === 'function') clearLiveCoverCache();
      Object.keys(ARTC).forEach(k => delete ARTC[k]);
      Object.keys(PALC).forEach(k => delete PALC[k]);
      Object.keys(SHAD_PALC).forEach(k => delete SHAD_PALC[k]);
      Object.keys(TINTC).forEach(k => delete TINTC[k]);
      LIVE.ly = {};
      if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.clearCache === 'function') {
        try { window.SonoraNative.clearCache(); } catch (e) {}
      }
      if (typeof window !== 'undefined' && typeof window.clearLiveCachesAndRefresh === 'function') {
        window.clearLiveCachesAndRefresh();
      }
      P._cacheStats = null;
      P._cacheStatsAt = 0;
      liveToast(t('toast.cache_cleared'));
      redraw();
    });
    y += 66;

    if (vis(P, y, 48)) {
      txt(c, t('settings.version_label'), W / 2, y + 22, F(600, 14), pal.sub, 'center', W - 48);
    }
    y += 44;
  }

  return sub === 'language' ? end(y + 16) : y + 48;
};

function drawMonthlyRecapPage(c, P) {
  P.data.titleKey = 'recap.title';
  P.data.title = t('recap.title');
  let y = listTop() + 6;
  const rMonths = typeof REC_HIST !== 'undefined' && REC_HIST && REC_HIST.months ? REC_HIST.months : null;
  const mCount = rMonths ? Object.keys(rMonths).length : 0;
  let months = P._recapMonths;
  if (!months || P._recapMCount !== mCount) {
    months = typeof getRecapMonths === 'function' ? getRecapMonths() : [curYmKey(0)];
    P._recapMonths = months;
    P._recapMCount = mCount;
  }
  if (!P.recapYm || months.indexOf(P.recapYm) < 0) P.recapYm = months[months.length - 1];
  const mIdx = Math.max(0, months.indexOf(P.recapYm));
  const curM = rMonths && P.recapYm ? rMonths[P.recapYm] : null;
  const curPlays = curM ? (curM.plays || 0) : 0;
  const curSec = Math.floor(curM ? (curM.sec || 0) : 0);
  let rc = P._recapCache;
  if (!rc || rc.ym !== P.recapYm || rc.mCount !== mCount || rc.plays !== curPlays || rc.sec !== curSec) {
    const recData = getMonthlyRecap(P.recapYm);
    rc = P._recapCache = {
      ym: P.recapYm,
      mCount,
      plays: curPlays,
      sec: curSec,
      rec: recData,
      topList: recData.topTracks.map(x => x.track)
    };
  }
  const rec = rc.rec;
  const filmBg = pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.045)';
  const filmStroke = pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)';
  const nowR = performance.now();
  if (!P._recapAnim) P._recapAnim = { ym: P.recapYm, dir: 0, t0: 0, barT0: nowR };
  const ra = P._recapAnim;
  if (ra.ym !== P.recapYm) { ra.ym = P.recapYm; ra.barT0 = nowR; }
  const slideP = ra.t0 ? clamp((nowR - ra.t0) / 230, 0, 1) : 1;
  const ep = 1 - Math.pow(1 - slideP, 3);
  const barP = clamp((nowR - ra.barT0) / 420, 0, 1);
  const barEp = 1 - Math.pow(1 - barP, 3);
  if (slideP < 1 || barP < 1) {
    ra._animating = true;
    if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw(true);
    else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  } else if (ra._animating) {
    ra._animating = false;
    if (typeof scheduleSceneAnimRedraw === 'function') scheduleSceneAnimRedraw(true);
    else if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  }

  const som = rec.songOfTheMonth;
  let c0 = [250, 46, 73];
  if (som && typeof artPalette === 'function') {
    const somArt = artItem(som);
    const somIm = somArt && typeof artOf === 'function' ? artOf(somArt) : null;
    const somKey = (som.id || '') + '|' + (som.thumb || '') + '|' + (somIm && somIm._real ? 1 : 0);
    if (ra.somPalKey !== somKey) {
      ra.somPalKey = somKey;
      ra.somPal = artPalette(somArt);
    }
    if (ra.somPal && ra.somPal[0]) c0 = ra.somPal[0];
  }
  const [bh, bs, bl] = rgb2hsl(c0[0], c0[1], c0[2]), bNeu = bs < .08;
  const trgb = bNeu ? hsl2rgb(bh, 0, clamp(bl * 1.45 + .22, .48, .72)) : hsl2rgb(bh, clamp(bs * 1.15, .48, .95), clamp(bl * 1.2 + .08, .42, .58));
  const hrgb = bNeu ? hsl2rgb(bh, 0, .92) : hsl2rgb(bh, clamp(bs * 1.1, .45, .95), .82);
  const monthTint = 'rgba(' + (trgb[0] | 0) + ',' + (trgb[1] | 0) + ',' + (trgb[2] | 0) + ',' + (bNeu ? .58 : .74) + ')';
  const monthHlCol = 'rgba(' + (hrgb[0] | 0) + ',' + (hrgb[1] | 0) + ',' + (hrgb[2] | 0) + ',.9)';
  const isFb = typeof FALLBACK !== 'undefined' && !!FALLBACK;

  const selH = 44, mh = 42;
  c.font = F(700, 17.5);
  const mw = clamp(Math.ceil(c.measureText(rec.label).width) + 96, 212, W - 40);
  const mx = Math.round((W - mw) / 2), my = y + 1;
  const canPrev = mIdx > 0, canNext = mIdx < months.length - 1;
  if (vis(P, y, selH)) {
    if (isFb) {
      rrPath(c, mx, my, mw, mh, mh / 2);
      c.fillStyle = monthTint; c.fill();
      c.lineWidth = 1; c.strokeStyle = monthHlCol; c.stroke();
      icon(c, 'chevl', mx + 24, my + mh / 2, 16, canPrev ? '#ffffff' : 'rgba(255,255,255,.35)', { lw: 2.3 });
      icon(c, 'chev', mx + mw - 24, my + mh / 2, 16, canNext ? '#ffffff' : 'rgba(255,255,255,.35)', { lw: 2.3 });
      c.save();
      rrPath(c, mx + 30, my, Math.max(0, mw - 60), mh, mh / 2); c.clip();
      if (slideP < 1) { c.globalAlpha *= (0.2 + 0.8 * ep); c.translate(ra.dir * 10 * (1 - ep), 0); }
      txt(c, rec.label, mx + mw / 2, my + 27, F(700, 17.5), '#ffffff', 'center', Math.max(40, mw - 64));
      c.restore();
    } else if (typeof SET_GLASS !== 'undefined') {
      SET_GLASS.push({
        kind: 'recapMonth',
        under: !REG,
        x: mx + T.x,
        y: my + T.y,
        w: mw,
        h: mh,
        label: rec.label,
        canPrev,
        canNext,
        slideP,
        ep,
        dir: ra.dir || 0,
        tint: monthTint,
        hlColor: monthHlCol
      });
    }
  }
  if (canPrev) hit(mx, y, 54, 44, () => { P.recapYm = months[mIdx - 1]; ra.ym = P.recapYm; ra.dir = -1; ra.t0 = performance.now(); ra.barT0 = ra.t0; P.scroll = 0; P.vel = 0; redraw(); }, { pressKey: 'recap_prev' });
  if (canNext) hit(mx + mw - 54, y, 54, 44, () => { P.recapYm = months[mIdx + 1]; ra.ym = P.recapYm; ra.dir = 1; ra.t0 = performance.now(); ra.barT0 = ra.t0; P.scroll = 0; P.vel = 0; redraw(); }, { pressKey: 'recap_next' });
  y += selH + 14;

  c.save();
  if (slideP < 1) {
    c.translate(ra.dir * 26 * (1 - ep), 0);
    c.globalAlpha *= (0.15 + 0.85 * ep);
  }

  if (!rec.topTracks.length) {
    if (vis(P, y, 160)) {
      drawSetCard(c, 20, y, W - 40, 140, 22);
      icon(c, 'stats', W / 2, y + 48, 28, pal.sub);
      txt(c, t('recap.empty_title'), W / 2, y + 90, F(600, 16.5), pal.fg, 'center', W - 64);
      txt(c, t('recap.empty_sub'), W / 2, y + 114, F(400, 13.5), pal.sub, 'center', W - 64);
    }
    c.restore();
    return end(y + 160);
  }

  if (som) {
    const cw = W - 40, ch = Math.round(cw / 1.25), cx = 20, somPk = 'recap_som';
    if (vis(P, y, ch)) {
      withPressScale(c, somPk, cx + cw / 2, y + ch / 2, () => {
        c.save();
        rrPath(c, cx, y, cw, ch, 26);
        c.clip();
        const artCv = artOf(artItem(som));
        if (artCv) {
          const scale = Math.max(cw / artCv.width, ch / artCv.height);
          const dw = artCv.width * scale, dh = artCv.height * scale;
          const aArt = typeof artFadeAlpha === 'function' ? artFadeAlpha(artCv) : 1;
          if (aArt < 1) { c.fillStyle = '#222'; c.fillRect(cx, y, cw, ch); c.save(); c.globalAlpha *= aArt; c.drawImage(artCv, cx + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh); c.restore(); }
          else c.drawImage(artCv, cx + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh);
        } else {
          c.fillStyle = '#222'; c.fillRect(cx, y, cw, ch);
        }
        const g = c.createLinearGradient(0, y + ch * .32, 0, y + ch);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(.45, 'rgba(0,0,0,.38)');
        g.addColorStop(1, 'rgba(0,0,0,.86)');
        c.fillStyle = g;
        c.fillRect(cx, y, cw, ch);
        drawRowPressTint(c, somPk, cx, y, cw, ch, 26);

        if (_canLS) c.letterSpacing = '1.2px';
        txt(c, t('recap.song_of_month'), cx + 18, y + ch - 62, F(700, 11), 'rgba(255,255,255,.72)');
        if (_canLS) c.letterSpacing = '0px';
        txt(c, som.title, cx + 18, y + ch - 36, F(700, 22), '#ffffff', 'left', cw - 86);
        txt(c, som.artist, cx + 18, y + ch - 16, F(400, 14.5), 'rgba(255,255,255,.78)', 'left', cw - 86);

        const pbx = cx + cw - 38, pby = y + ch - 36;
        if (isFb) {
          c.beginPath(); c.arc(pbx, pby, 21, 0, Math.PI * 2);
          c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
          c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.35)'; c.stroke();
          icon(c, 'play', pbx, pby, 17, '#ffffff', { fill: true });
        }
        c.restore();

        c.save();
        rrPath(c, cx + .5, y + .5, cw - 1, ch - 1, 26);
        c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.10)'; c.stroke();
        c.restore();
      });
      if (!isFb && typeof SET_GLASS !== 'undefined') {
        const pbx = cx + cw - 38, pby = y + ch - 36;
        const scSom = typeof pressScale === 'function' ? pressScale(somPk) : 1;
        const slideDx = slideP < 1 ? (ra.dir || 0) * 26 * (1 - ep) : 0;
        const slideAl = slideP < 1 ? (0.15 + 0.85 * ep) : 1;
        const cardCx = cx + cw / 2, cardCy = y + ch / 2;
        const effPbx = cardCx + (pbx - cardCx) * scSom + slideDx;
        const effPby = cardCy + (pby - cardCy) * scSom;
        const effD = 42 * scSom;
        SET_GLASS.push({
          kind: 'recapPlay',
          under: !REG,
          x: effPbx - effD / 2 + T.x,
          y: effPby - effD / 2 + T.y,
          w: effD,
          h: effD,
          cx: effPbx + T.x,
          cy: effPby + T.y,
          sc: scSom,
          alpha: slideAl,
          tint: 'rgba(255,255,255,.20)',
          hlColor: monthHlCol
        });
      }
    }
    hit(cx, y, cw, ch, () => {
      playList(rc.topList, 0);
    }, { pressKey: somPk });
    y += ch + 14;
  }

  const stH = 88, stGap = 12, stW = Math.floor((W - 40 - stGap) / 2);
  if (vis(P, y, stH)) {
    [[String(rec.plays), t('recap.plays'), 20], [String(rec.minutes), t('recap.minutes_listened'), 20 + stW + stGap]].forEach(([val, lb, sx]) => {
      rrPath(c, sx, y, stW, stH, 22);
      c.fillStyle = filmBg; c.fill();
      c.lineWidth = 1; c.strokeStyle = filmStroke; c.stroke();
      txt(c, val, sx + 16, y + 44, F(700, 29), pal.fg, 'left', stW - 28);
      txt(c, lb, sx + 16, y + 68, F(400, 13.5), pal.sub, 'left', stW - 28);
    });
  }
  y += stH + 22;

  if (rec.topTracks.length) {
    if (vis(P, y, 28)) txt(c, t('recap.top_songs'), 20, y + 20, F(700, 18.5), pal.fg);
    y += 28;
    const tAll = rc.topList;
    rec.topTracks.forEach(({ track, plays }, i) => {
      const rh = 62, tPk = 'recap_tr:' + i + ':' + track.id;
      if (vis(P, y, rh)) {
        const cu = isCur(track);
        drawRowPressTint(c, tPk, 12, y + 2, W - 24, rh - 4, 14);
        txt(c, String(i + 1), 31, y + 37, F(700, 15.5), cu ? pal.accent : pal.sub, 'center');
        drawArt(c, track, 48, y + 8, 46, 10);
        txt(c, track.title, 106, y + 28, F(600, 15.5), cu ? pal.accent : pal.fg, 'left', W - 106 - 86);
        txt(c, track.artist, 106, y + 47, F(400, 13.5), pal.sub, 'left', W - 106 - 86);
        txt(c, tPlural(plays, 'recap.play_one', 'recap.play_many'), W - 22, y + 36, F(500, 13), pal.sub, 'right');
      }
      hit(0, y, W, rh, () => playList(tAll, i), { pressKey: tPk });
      y += rh;
    });
    y += 16;
  }

  if (rec.topArtists.length) {
    if (vis(P, y, 28)) txt(c, t('recap.top_artists'), 20, y + 20, F(700, 18.5), pal.fg);
    y += 28;
    const maxArtPlays = Math.max(1, rec.topArtists[0].plays);
    rec.topArtists.forEach((ar, i) => {
      const rh = 56, barX = 48, barW = W - 48 - 20, barH = 44, barY = y + 6, arPk = 'recap_ar:' + i + ':' + ar.name;
      const share = clamp(ar.plays / maxArtPlays, .12, 1);
      const animShare = mix(0.08, share, barEp);
      if (vis(P, y, rh)) {
        txt(c, String(i + 1), 31, y + 34, F(700, 15.5), pal.sub, 'center');
        c.save();
        rrPath(c, barX, barY, barW, barH, 14);
        c.fillStyle = filmBg; c.fill();
        c.clip();
        rrPath(c, barX, barY, barW * animShare, barH, 14);
        c.fillStyle = pal.dark ? 'rgba(250,46,73,.28)' : 'rgba(250,46,73,.18)';
        c.fill();
        drawRowPressTint(c, arPk, barX, barY, barW, barH, 14);
        c.restore();

        drawArt(c, ar.artist && ar.artist.thumb ? ar.artist : ar.sampleTrack, barX + 6, barY + 6, 32, 16);
        txt(c, ar.name, barX + 46, barY + 27.5, F(600, 15), pal.fg, 'left', barW - 118);
        txt(c, String(ar.plays), barX + barW - 14, barY + 27.5, F(600, 13.5), pal.sub, 'right');
      }
      hit(0, y, W, rh, () => {
        if (ar.sampleTrack) openTrackArtist(ar.sampleTrack);
      }, { pressKey: arPk });
      y += rh;
    });
  }

  c.restore();
  return end(y + 24);
}
PAGES.stats = drawMonthlyRecapPage;

const NAV_TITLED = { albums: 1, plist: 1, artists: 1, songs: 1, mood: 1, stats: 1, settings: 1 };

window.invalidatePagesLocaleCaches = function (langChanged, countryChanged) {
  if (typeof syncPrevTabs === 'function') syncPrevTabs();
  if (typeof _searchChipAnim !== 'undefined' && _searchChipAnim) {
    _searchChipAnim.x = null;
    _searchChipAnim.w = null;
  }
  const seen = new Set();
  const refreshPage = p => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    p._recapCache = null;
    p._recapMonths = null;
    if (!p.data) return;
    if (p.data.titleKey) {
      p.data.title = t(p.data.titleKey);
    } else if (p.name === 'settings') {
      const subKey = p.data.subPage && typeof _SET_SUB_TITLE_KEYS !== 'undefined' ? _SET_SUB_TITLE_KEYS[p.data.subPage] : null;
      p.data.title = t(subKey || 'settings.title');
    } else if (p.name === 'stats') {
      p.data.title = t('recap.title');
    } else if (p.name === 'home') {
      p.data.title = t('tab.home');
    } else if (p.name === 'new') {
      p.data.title = t('tab.new');
    } else if (p.name === 'radio') {
      p.data.title = t('tab.radio');
    } else if (p.name === 'library') {
      p.data.title = t('tab.library');
    } else if (p.name === 'search') {
      p.data.title = t('tab.search');
    }
  };
  if (typeof NAV !== 'undefined' && NAV) {
    (NAV.stack || []).forEach(refreshPage);
    if (NAV.stacks) Object.keys(NAV.stacks).forEach(k => (NAV.stacks[k] || []).forEach(refreshPage));
  }
  if (typeof window.invalidateLiveLocaleCaches !== 'function' && typeof LIVE !== 'undefined' && LIVE) {
    if (langChanged || countryChanged) {
      LIVE.home = null;
      LIVE.charts = null;
      LIVE.radioFeed = null;
      LIVE.res = null;
      LIVE.lastSearch = '';
    }
  }
};
