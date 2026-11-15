if (typeof HTMLInputElement !== 'undefined' && HTMLInputElement.prototype.focus) {
  const _origFocus = HTMLInputElement.prototype.focus;
  HTMLInputElement.prototype.focus = function(opts) {
    const res = _origFocus.call(this, Object.assign({ preventScroll: true }, opts));
    try {
      if (typeof this.setSelectionRange === 'function' && typeof this.value === 'string') {
        const len = this.value.length;
        this.setSelectionRange(len, len);
      }
    } catch (_) {}
    return res;
  };
}
const bgA = a => pal.dark ? 'rgba(13,13,13,' + a + ')' : 'rgba(255,255,255,' + a + ')';
const pillRect = P => { const p = P || topPage(), qt = sstep(clamp(p && p.qT || 0, 0, 1)), pk = p === topPage() ? NAV.pk : (hasPill(p) ? clamp(((p && p.scroll || 0) - 30) / 110, 0, 1) : 0), e = Math.max(sstep(clamp(pk, 0, 1)), qt), w = mix(100, 44, e); return { x: W - 16 - w, y: LAY.apill.y, w, h: 44, e, qt }; };
const pSearchRect = P => { const p = P || topPage(), qt = sstep(clamp(p && p.qT || 0, 0, 1)), mw = W - 136, w = mix(44, mw, qt); return { x: W - 68 - w, y: LAY.apill.y, w, h: 44, qt }; };
const sstep = x => x * x * (3 - 2 * x);
const OUT_HEAD = 84, OUT_PAD_BOT = 38, OUT_ROW_DEF = 58;
const _outIcon = k => k === 'bluetooth' ? 'bluetooth' : k === 'wired' ? 'headphones' : k === 'usb' ? 'usb' : 'spk1';
function refreshAudioOutputsCache() {
  let list = [];
  let isAuto = true;
  if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.getAudioOutputs === 'function') {
    try {
      const data = JSON.parse(window.SonoraNative.getAudioOutputs());
      isAuto = data.auto !== false;
      if (Array.isArray(data.outputs)) list = data.outputs;
    } catch (e) {}
  }
  if (!list.length) {
    list = [{ id: -1, kind: 'speaker', name: t('audio.speaker'), selected: true }];
  }
  OUT_DRAWER.auto = isAuto;
  OUT_DRAWER.outputs = list;
  const active = list.find(d => d.selected || d.isActive) || list[0];
  OUT_DRAWER.activeName = isAuto
    ? t('audio.auto_device', { name: active ? active.name : t('audio.android_system') })
    : (active ? active.name : t('audio.android_system'));
  let hasPickedDevice = false;
  const rows = list.map(d => {
    const isDevSel = !isAuto && !hasPickedDevice && !!(d.selected || d.isActive);
    if (isDevSel) hasPickedDevice = true;
    return {
      label: d.name,
      icon: _outIcon(d.kind),
      actKey: 'out_dev_' + d.id,
      devId: d.id,
      selected: isDevSel
    };
  });
  rows.push({
    label: t('audio.auto_default'),
    icon: 'airplay',
    actKey: 'out_auto',
    devId: -1,
    selected: isAuto
  });
  OUT_DRAWER.rows = rows;
}
if (typeof window !== 'undefined') window.syncOutputDrawerLocale = refreshAudioOutputsCache;
function updateOutDrawerLayout() {
  const n = Math.max(1, OUT_DRAWER.rows ? OUT_DRAWER.rows.length : 1);
  const side = 12;
  const w = Math.min(420, W - side * 2);
  const maxH = Math.max(240, H - TOP - 40);
  const rowH = Math.min(OUT_ROW_DEF, Math.max(42, Math.floor((maxH - OUT_HEAD - OUT_PAD_BOT) / n)));
  const h = Math.min(maxH, Math.max(252, OUT_HEAD + n * rowH + OUT_PAD_BOT));
  OUT_DRAWER.r = {
    x: Math.round((W - w) / 2),
    y: H - h,
    w,
    h,
    rowH
  };
}
function openOutDrawer() {
  if (CM.open) closeCM();
  refreshAudioOutputsCache();
  updateOutDrawerLayout();
  OUT_DRAWER.open = true;
  OUT_DRAWER.pressRow = -1;
  OUT_DRAWER.prevPressRow = -1;
  OUT_DRAWER.pressA = 0;
  OUT_DRAWER.drag = 0;
  OUT_DRAWER.sp.t = 1;
  OUT_DRAWER.sp.v = 0;
  if (typeof armHistory === 'function') armHistory();
  D.ov = D.gl = true;
}
function closeOutDrawer() {
  if (!OUT_DRAWER.open) return;
  OUT_DRAWER.open = false;
  OUT_DRAWER.pressRow = -1;
  OUT_DRAWER.sp.t = 0;
  OUT_DRAWER.sp.v = 0;
  D.ov = D.gl = true;
}
function outDrawerAct(i) {
  const row = OUT_DRAWER.rows && OUT_DRAWER.rows[i];
  if (!row) return;
  const k = row.actKey;
  if (k === 'out_auto') {
    OUT_DRAWER.auto = true;
    OUT_DRAWER.rows.forEach((r, idx) => { r.selected = idx === i; });
    const active = (OUT_DRAWER.outputs && (OUT_DRAWER.outputs.find(d => d.selected || d.isActive) || OUT_DRAWER.outputs[0])) || null;
    OUT_DRAWER.activeName = t('audio.auto_device', { name: active ? active.name : t('audio.android_system') });
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setAudioOutput === 'function') {
      window.SonoraNative.setAudioOutput(-1);
    }
    if (typeof liveToast === 'function') liveToast(t('audio.auto_label'), 1800);
    closeOutDrawer();
  } else if (k && k.startsWith('out_dev_')) {
    OUT_DRAWER.auto = false;
    OUT_DRAWER.rows.forEach((r, idx) => { r.selected = idx === i; });
    OUT_DRAWER.activeName = row.label || t('audio.android_system');
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setAudioOutput === 'function') {
      window.SonoraNative.setAudioOutput(row.devId);
    }
    if (typeof liveToast === 'function') liveToast(t('audio.output_toast', { name: row.label || t('audio.selected_device') }), 2000);
    closeOutDrawer();
  }
}
function openCM(t, ax, ay, ctx, meta) {
  CM.ctx = ctx || (isTr(t) ? 'search' : 'header');
  CM.meta = meta || {};
  CM.mode = 'menu';
  CM.prevMode = null;
  CM.fade = 1;
  CM.pendingAdd = null;
  const items = cmItems(t, CM.ctx, CM.meta);
  const w = Math.min(336, W - 36), h = CM_HEAD + items.length * CM_ROW + 10;
  const x = Math.round((W - w) / 2), y = Math.max(10, Math.round((H - h) / 2));
  Object.assign(CM, { open: true, tr: t, ax: x + w / 2, ay: y + h / 2, pressRow: -1, prevPressRow: -1, pressA: 0, animH: h, animY: y, r: { x, y, w, h } });
  CM.sp.t = 1; CM.sp.v = 0;
  if (typeof armHistory === 'function') armHistory();
  D.ov = D.gl = true;
}
function setCmMode(mode, pendingAdd) {
  CM.prevMode = CM.mode;
  CM.mode = mode;
  if (pendingAdd !== undefined) CM.pendingAdd = pendingAdd;
  CM.fade = 0;
  CM.pressRow = -1;
  CM.prevPressRow = -1;
  CM.pressA = 0;
  const nItems = cmItems(CM.tr, CM.ctx, CM.meta);
  const w = Math.min(336, W - 36), h = CM_HEAD + nItems.length * CM_ROW + 10;
  const y = Math.max(10, Math.round((H - h) / 2));
  if (!CM.animH) { CM.animH = CM.r.h; CM.animY = CM.r.y; }
  CM.r = { x: Math.round((W - w) / 2), y, w, h };
  CM.ax = CM.r.x + w / 2; CM.ay = CM.r.y + h / 2;
  D.ov = D.gl = true;
  redraw();
}
function closeCM() {
  if (!CM.open) return;
  CM.open = false; CM.pressRow = -1;
  CM.mode = 'menu';
  CM.prevMode = null;
  CM.fade = 1;
  CM.pendingAdd = null;
  CM.sp.t = 0; CM.sp.v = 0;
  D.ov = D.gl = true;
}
function cmItems(item, ctx, meta) {
  if (!item) return [];
  ctx = ctx || CM.ctx || (isTr(item) ? 'search' : 'header');
  meta = meta || CM.meta || {};

  if (CM.mode === 'playlists') {
    const list = [[t('prompt.new_playlist_btn'), 'lib-playlist', 'new_pl']];
    const userPls = (typeof window !== 'undefined' && window.USER_PLAYLISTS) || (typeof LIVE !== 'undefined' && LIVE.userPlaylists) || [];
    userPls.forEach(pl => {
      const cnt = pl.tracks ? pl.tracks.length : 0;
      list.push([pl.title + ' (' + cnt + ')', 'lib-playlist', 'add_to_' + pl.id]);
    });
    return list;
  }

  if (CM.mode === 'sleep_timer') {
    return [
      [t('cm.sleep_15m'), 'clock', 'sleep_15'],
      [t('cm.sleep_30m'), 'clock', 'sleep_30'],
      [t('cm.sleep_45m'), 'clock', 'sleep_45'],
      [t('cm.sleep_1h'), 'clock', 'sleep_60'],
      [t('cm.sleep_eom'), 'clock', 'sleep_end'],
      [t('cm.sleep_disable'), 'clock', 'sleep_off']
    ];
  }

  if (!isTr(item) || ctx === 'header') {
    if (item.kind === 'artist') {
      return [
        [t('cm.start_artist_radio'), 'radio', 'artist_radio'],
        [t('cm.add_popular_queue'), 'queue', 'queue_artist_top'],
        [t(isPinned(item) ? 'cm.unfollow' : 'cm.follow'), 'pin', 'pin'],
        [t('cm.share'), 'share', 'share']
      ];
    }
    const dlAll = (typeof allDownloaded === 'function' && allDownloaded(item));
    const dlProg = (typeof getDownloadProgress === 'function' && getDownloadProgress(item));
    const dlActiveLabel = dlProg && dlProg.active ? t('download.stopping', { done: dlProg.done, total: dlProg.total }) : null;
    if (item.kind === 'playlist') {
      const res = [
        [t('cm.play_next'), 'fwd', 'next'],
        [t('cm.add_queue'), 'queue', 'queue'],
        [t(isPinned(item) ? 'cm.unpin' : 'cm.pin'), 'pin', 'pin']
      ];
      if (item.user) {
        res.push([t('cm.change_cover'), 'folder', 'change_cover']);
        res.push([t('cm.rename_playlist'), 'note', 'rename_pl']);
        res.push([t('cm.delete_playlist'), 'trash', 'delete_pl', true]);
      }
      res.push([dlActiveLabel || t(dlAll ? 'cm.remove_download' : 'cm.download_playlist'), 'down', 'download_item']);
      res.push([t('cm.share'), 'share', 'share']);
      return res;
    }
    return [
      [t('cm.play_next'), 'fwd', 'next'],
      [t('cm.add_queue'), 'queue', 'queue'],
      [t('cm.go_artist'), 'user', 'goto_artist'],
      [t(isPinned(item) ? 'cm.unpin' : 'cm.pin'), 'pin', 'pin'],
      [t('cm.add_all_playlist'), 'lib-playlist', 'add_to_pl'],
      [dlActiveLabel || t(dlAll ? 'cm.remove_download' : 'cm.download_album'), 'down', 'download_item'],
      [t('cm.share'), 'share', 'share']
    ];
  }

  const isDl = (typeof isDownloaded === 'function' ? isDownloaded(item) : (typeof LIVE !== 'undefined' && LIVE.saved && LIVE.saved.some(x => x.id === item.id)));
  const favItem = [t(PL.fav[item.id] ? 'cm.remove_favorite' : 'cm.favorite'), 'star', 'fav'];
  const dlItem = [t(isDl ? 'cm.remove_download' : 'cm.download_track'), 'down', 'download_song'];

  if (ctx === 'album') {
    return [
      [t('cm.play_next'), 'fwd', 'next'],
      [t('cm.add_queue'), 'queue', 'queue'],
      [t('cm.add_to_playlist'), 'lib-playlist', 'add_to_pl'],
      favItem,
      [t('cm.go_artist'), 'user', 'goto_artist'],
      [t('cm.start_song_radio'), 'radio', 'song_radio'],
      dlItem,
      [t('cm.share'), 'share', 'share']
    ];
  }

  if (ctx === 'playlist') {
    const res = [
      [t('cm.play_next'), 'fwd', 'next'],
      [t('cm.add_queue'), 'queue', 'queue'],
      [t('cm.add_to_playlist'), 'lib-playlist', 'add_to_pl'],
      favItem,
      [t('cm.go_album'), 'lib-album', 'goto_album'],
      [t('cm.go_artist'), 'user', 'goto_artist'],
      [t('cm.start_song_radio'), 'radio', 'song_radio']
    ];
    if (meta && meta.playlist && meta.playlist.user) {
      res.push([t('cm.remove_from_playlist'), 'trash', 'remove_from_pl', true]);
    }
    res.push(dlItem);
    res.push([t('cm.share'), 'share', 'share']);
    return res;
  }

  if (ctx === 'player') {
    const hasLyrics = LIVE.on && SH.mode === 'lyrics' && cur() && item.id === cur().id;
    return [
      ...(hasLyrics ? [[t('cm.lyrics_source'), 'lyrics', 'src']] : []),
      [t('cm.go_album'), 'lib-album', 'goto_album'],
      [t('cm.go_artist'), 'user', 'goto_artist'],
      [t('cm.start_song_radio'), 'radio', 'song_radio'],
      [t('cm.add_to_playlist'), 'lib-playlist', 'add_to_pl'],
      dlItem,
      [t('cm.sleep_timer'), 'clock', 'sleep_timer'],
      [t('cm.share'), 'share', 'share']
    ];
  }

  return [
    [t('cm.play_next'), 'fwd', 'next'],
    [t('cm.add_queue'), 'queue', 'queue'],
    [t('cm.go_album'), 'lib-album', 'goto_album'],
    [t('cm.go_artist'), 'user', 'goto_artist'],
    [t('cm.start_song_radio'), 'radio', 'song_radio'],
    [t('cm.add_to_playlist'), 'lib-playlist', 'add_to_pl'],
    favItem,
    dlItem,
    [t('cm.share'), 'share', 'share']
  ];
}
const cmSub = trItem => isTr(trItem) ? trItem.artist : trItem.kind === 'playlist' ? t('common.playlist') : trItem.kind === 'artist' ? t('common.artist') : trItem.artist;
function applyPlaylistCoverDataUrl(plItem, dataUrl) {
  if (!plItem || !dataUrl) return;
  plItem.thumb = dataUrl;
  if (typeof BYID !== 'undefined' && BYID[plItem.id]) {
    BYID[plItem.id].thumb = dataUrl;
  }
  if (typeof saveUserPlaylists === 'function') saveUserPlaylists();
  else if (typeof window.saveUserPlaylists === 'function') window.saveUserPlaylists();
  if (typeof ARTC !== 'undefined') delete ARTC[plItem.id];
  if (typeof PALC !== 'undefined') delete PALC[plItem.id];
  if (typeof SHAD_PALC !== 'undefined') delete SHAD_PALC[plItem.id];
  if (typeof TINTC !== 'undefined') {
    delete TINTC[plItem.id + 'd'];
    delete TINTC[plItem.id + 'l'];
  }
  if (typeof preloadArt === 'function') preloadArt(plItem, true);
  if (typeof redraw === 'function') redraw();
  if (typeof liveToast === 'function') liveToast(t('toast.cover_updated'));
}
function openPlaylistCoverPicker(t) {
  if (!t) return;
  if (window.SonoraNative && typeof window.SonoraNative.pickImage === 'function') {
    window.onSonoraImagePicked = dataUrl => {
      window.onSonoraImagePicked = null;
      if (dataUrl) applyPlaylistCoverDataUrl(t, dataUrl);
    };
    window.SonoraNative.pickImage();
    return;
  }
  let fInput = document.getElementById('fPlaylistCover');
  if (!fInput) {
    fInput = document.createElement('input');
    fInput.type = 'file';
    fInput.id = 'fPlaylistCover';
    fInput.accept = 'image/*';
    fInput.style.display = 'none';
    document.body.appendChild(fInput);
  }
  fInput.value = '';
  fInput.onchange = ev => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = re => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 512;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round(h * (maxDim / w));
            w = maxDim;
          } else {
            w = Math.round(w * (maxDim / h));
            h = maxDim;
          }
        }
        const oc = document.createElement('canvas');
        oc.width = w;
        oc.height = h;
        const ocCtx = oc.getContext('2d');
        ocCtx.drawImage(img, 0, 0, w, h);
        applyPlaylistCoverDataUrl(t, oc.toDataURL('image/jpeg', 0.85));
      };
      img.src = re.target.result;
    };
    reader.readAsDataURL(file);
  };
  fInput.click();
}
window.openPlaylistCoverPicker = openPlaylistCoverPicker;
function cmAct(i) {
  const trItem = CM.tr, it = cmItems(trItem, CM.ctx, CM.meta)[i], k = it && it[2];
  if (!k) return;
  if (k === 'src') { closeCM(); lyOpenPicker(trItem); return; }
  const qWrap = x => Object.assign({}, x, { _queued: true, _smartRec: false });

  if (k === 'add_to_pl') {
    setCmMode('playlists', trItem);
    return;
  }

  if (k === 'sleep_timer') {
    setCmMode('sleep_timer');
    return;
  }

  if (k === 'new_pl') {
    const toAdd = CM.pendingAdd || trItem;
    closeCM();
    if (typeof window !== 'undefined' && typeof window.showPromptModal === 'function') {
      window.showPromptModal({
        title: t('prompt.new_playlist_title'),
        placeholder: t('prompt.playlist_placeholder'),
        confirmText: t('prompt.create'),
        onConfirm: name => {
          if (!name || !name.trim()) return;
          let newPl = null;
          if (typeof window.createUserPlaylist === 'function') {
            newPl = window.createUserPlaylist(name.trim());
          }
          if (newPl && toAdd) {
            const trs = isTr(toAdd) ? [toAdd] : (tracksOf(toAdd) || []);
            if (typeof window.addToUserPlaylist === 'function') {
              window.addToUserPlaylist(newPl.id, trs);
            }
          }
          if (typeof liveToast === 'function') liveToast(t('toast.playlist_created', { name: name.trim() }), 2000);
          redraw();
        }
      });
    }
    return;
  }

  if (k === 'change_cover') {
    closeCM();
    openPlaylistCoverPicker(trItem);
    return;
  }

  if (k.startsWith('add_to_')) {
    const plId = k.slice(7);
    const toAdd = CM.pendingAdd || trItem;
    closeCM();
    const trs = isTr(toAdd) ? [toAdd] : (tracksOf(toAdd) || []);
    if (typeof window !== 'undefined' && typeof window.addToUserPlaylist === 'function') {
      window.addToUserPlaylist(plId, trs);
      const plObj = typeof window.getUserPlaylist === 'function' ? window.getUserPlaylist(plId) : null;
      const plTitle = plObj ? plObj.title : t('common.playlist_lc');
      if (typeof liveToast === 'function') liveToast(t('toast.added_to', { name: plTitle }), 2000);
    }
    redraw();
    return;
  }

  if (k === 'remove_from_pl') {
    closeCM();
    const pl = CM.meta && CM.meta.playlist;
    if (pl && typeof window !== 'undefined' && typeof window.removeFromUserPlaylist === 'function') {
      window.removeFromUserPlaylist(pl.id, trItem.id);
      if (typeof liveToast === 'function') liveToast(t('toast.removed_from_playlist'), 2000);
      redraw();
    }
    return;
  }

  if (k === 'rename_pl') {
    closeCM();
    if (typeof window !== 'undefined' && typeof window.showPromptModal === 'function') {
      window.showPromptModal({
        title: t('cm.rename_playlist'),
        defaultVal: trItem.title,
        confirmText: t('prompt.save'),
        onConfirm: newTitle => {
          if (!newTitle || !newTitle.trim()) return;
          if (typeof window.renameUserPlaylist === 'function') {
            window.renameUserPlaylist(trItem.id, newTitle.trim());
          } else {
            trItem.title = newTitle.trim();
          }
          if (typeof liveToast === 'function') liveToast(t('toast.playlist_renamed'), 2000);
          redraw();
        }
      });
    }
    return;
  }

  if (k === 'delete_pl') {
    closeCM();
    if (typeof window !== 'undefined' && typeof window.deleteUserPlaylist === 'function') {
      window.deleteUserPlaylist(trItem.id);
      if (typeof liveToast === 'function') liveToast(t('toast.playlist_deleted'), 2000);
      const top = topPage();
      if (top && top.data && top.data.item && top.data.item.id === trItem.id) {
        pop();
      }
      redraw();
    }
    return;
  }

  if (k === 'sleep_off') {
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setSleepTimer === 'function') {
      window.SonoraNative.setSleepTimer('off', 0);
    }
    if (window._sleepTimer) { clearTimeout(window._sleepTimer); window._sleepTimer = null; }
    window._sleepOnEnd = false;
    PL.sleepActive = false; PL.sleepMode = 'off'; PL.sleepRemSec = 0;
    if (typeof liveToast === 'function') liveToast(t('toast.sleep_off'), 2000);
    closeCM();
    return;
  }

  if (k === 'sleep_end') {
    if (window._sleepTimer) { clearTimeout(window._sleepTimer); window._sleepTimer = null; }
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setSleepTimer === 'function') {
      window.SonoraNative.setSleepTimer('end', 0);
      window._sleepOnEnd = false;
    } else {
      window._sleepOnEnd = true;
    }
    PL.sleepActive = true; PL.sleepMode = 'end'; PL.sleepRemSec = 0;
    if (typeof liveToast === 'function') liveToast(t('toast.sleep_eom'), 2000);
    closeCM();
    return;
  }

  if (k.startsWith('sleep_')) {
    const mins = parseInt(k.replace('sleep_', ''), 10);
    if (window._sleepTimer) clearTimeout(window._sleepTimer);
    window._sleepOnEnd = false;
    if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setSleepTimer === 'function') {
      window.SonoraNative.setSleepTimer('minutes', mins);
    } else {
      window._sleepTimer = setTimeout(() => {
        if (PL.playing) togglePlay();
        if (typeof liveToast === 'function') liveToast(t('toast.sleep_done'), 2000);
      }, mins * 60 * 1000);
    }
    PL.sleepActive = true; PL.sleepMode = 'minutes'; PL.sleepRemSec = mins * 60;
    if (typeof liveToast === 'function') liveToast(mins === 60 ? t('toast.sleep_set_1h') : t('toast.sleep_set_min', { count: mins }), 2000);
    closeCM();
    return;
  }

  if (k === 'play_now') {
    cmPlayNow(trItem);
    return;
  }

  if (k === 'download_song') {
    closeCM();
    if (typeof toggleDownloadTrack === 'function') {
      toggleDownloadTrack(trItem);
    } else if (typeof toggleSavedList === 'function') {
      toggleSavedList([trItem]);
    }
    redraw();
    return;
  }

  if (k === 'download_item') {
    closeCM();
    if (typeof toggleDownloadItem === 'function') {
      toggleDownloadItem(trItem);
    } else if (typeof toggleSavedList === 'function') {
      toggleSavedList(tracksOf(trItem), trItem);
    }
    redraw();
    return;
  }

  if (k === 'goto_album') {
    closeCM();
    if (SH.target > .5 || SH.t > .5) closeSheet();
    const alb = (trItem.album && BYID[trItem.album]) || (typeof ALBUMS !== 'undefined' && ALBUMS.find(a => a.id === trItem.album || a.title === trItem.album));
    if (alb) {
      open(alb);
    } else if (trItem.album) {
      open({ kind: 'album', id: trItem.album, title: trItem.albumTitle || trItem.album, artist: trItem.artist, tracks: [trItem] });
    }
    return;
  }

  if (k === 'goto_artist') {
    closeCM();
    if (SH.target > .5 || SH.t > .5) closeSheet();
    const rawName = (trItem.artist || '').split(',')[0].trim();
    const ar = (trItem.artistId && BYID[trItem.artistId]) || (typeof ARTISTS !== 'undefined' && ARTISTS.find(a => a.title.toLowerCase() === rawName.toLowerCase())) || { kind: 'artist', id: trItem.artistId || ('ar_' + rawName), title: rawName };
    open(ar);
    return;
  }

  if (k === 'song_radio') {
    closeCM();
    if (LIVE.on && typeof api === 'function') {
      api('/api/radio/' + trItem.id).then(d => {
        const have = new Set([trItem.id]);
        const trks = (d.tracks || []).map(ingestTrack).filter(x => x && !have.has(x.id));
        playList([trItem, ...trks], 0);
      }).catch(() => {
        playOne(trItem);
      });
    } else {
      playOne(trItem);
    }
    if (typeof liveToast === 'function') liveToast(t('toast.song_radio_started', { title: trItem.title }), 2000);
    return;
  }

  if (k === 'artist_radio') {
    closeCM();
    const rawName = (trItem.title || trItem.artist || '').split(',')[0].trim();
    const arTracks = tracksOf(trItem).length ? tracksOf(trItem) : (typeof TRACKS !== 'undefined' ? TRACKS.filter(x => (x.artist || '').toLowerCase().includes(rawName.toLowerCase())) : []);
    if (arTracks.length) {
      playShuffled(arTracks);
    }
    if (typeof liveToast === 'function') liveToast(t('toast.artist_radio_started', { name: trItem.title || trItem.artist }), 2000);
    return;
  }

  if (k === 'queue_artist_top') {
    closeCM();
    const arTr = tracksOf(trItem).slice(0, 5);
    if (arTr.length) {
      if (typeof enqueueTracks === 'function') enqueueTracks(arTr, 'end', false);
      else { PL.queue.push(...arTr.map(qWrap)); redraw(); }
      if (typeof liveToast === 'function') liveToast(t('toast.popular_added_queue'), 2000);
    }
    return;
  }

  if (k === 'share') {
    closeCM();
    if (typeof window !== 'undefined' && typeof window.shareMediaItem === 'function') {
      window.shareMediaItem(trItem);
    } else {
      let url = '';
      if (trItem) {
        if (isTr(trItem)) url = 'https://music.youtube.com/watch?v=' + trItem.id;
        else if (trItem.kind === 'playlist') url = 'https://music.youtube.com/playlist?list=' + trItem.id;
        else if (trItem.kind === 'album') url = 'https://music.youtube.com/browse/' + trItem.id;
        else if (trItem.kind === 'artist') url = 'https://music.youtube.com/channel/' + trItem.id;
      }
      const title = trItem ? (trItem.title + (trItem.artist ? ' - ' + trItem.artist : '')) : t('common.brand');
      if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.share === 'function') {
        window.SonoraNative.share(url, title);
      } else if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({ title, text: title + (url ? '\n' + url : ''), url: url || undefined }).catch(() => {});
      } else if (url && typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          if (typeof liveToast === 'function') liveToast(t('toast.link_copied'));
        }).catch(() => {});
      } else if (typeof liveToast === 'function') {
        liveToast(t('toast.share_prefix', { text: trItem ? trItem.title : '' }));
      }
    }
    return;
  }

  if (isTr(trItem)) {
    if (k === 'next') {
      if (typeof enqueueTracks === 'function') enqueueTracks(trItem, 'next', false);
      else PL.queue.splice(PL.qi + 1, 0, qWrap(trItem));
      if (typeof liveToast === 'function') liveToast(t('toast.play_next', { title: trItem.title }), 2000);
    } else if (k === 'queue') {
      if (typeof enqueueTracks === 'function') enqueueTracks(trItem, 'end', false);
      else PL.queue.push(qWrap(trItem));
      if (typeof liveToast === 'function') liveToast(t('toast.added_to_queue', { title: trItem.title }), 2000);
    } else if (k === 'fav') {
      PL.fav[trItem.id] = !PL.fav[trItem.id];
      saveState();
      if (typeof liveToast === 'function') liveToast(t(PL.fav[trItem.id] ? 'toast.fav_added' : 'toast.fav_removed'), 1800);
    }
  } else if (k === 'pin') {
    togglePin(trItem);
    if (typeof liveToast === 'function') liveToast(t(isPinned(trItem) ? 'toast.pin_added' : 'toast.pin_removed'), 1800);
  } else if (k === 'next' || k === 'queue') {
    const add = tr => {
      if (typeof enqueueTracks === 'function') enqueueTracks(tr, k === 'next' ? 'next' : 'end', false);
      else {
        const wTr = tr.map(qWrap);
        if (k === 'next') PL.queue.splice(PL.qi + 1, 0, ...wTr);
        else PL.queue.push(...wTr);
        redraw();
      }
    };
    if (LIVE.on && !trItem.loaded && !tracksOf(trItem).length) {
      liveLoad(trItem).then(() => add(tracksOf(trItem)));
    } else {
      add(tracksOf(trItem));
    }
  }
  closeCM();
}
try {
  if (typeof next === 'function' && typeof window !== 'undefined' && !window._sleepTimerHooked) {
    window._sleepTimerHooked = true;
    const _origNext = next;
    next = function(auto, customFade) {
      if (auto && window._sleepOnEnd) {
        window._sleepOnEnd = false;
        if (PL.playing) togglePlay();
        if (typeof liveToast === 'function') liveToast(t('toast.sleep_done'), 2000);
        return;
      }
      return _origNext(auto, customFade);
    };
    window.next = next;
  }
} catch (_) {}
function cmGeom() {
  const r = CM.r, p = clamp(CM.sp.x, 0, 1), e = sstep(p);
  const rh = CM.animH > 0 ? CM.animH : r.h, ry = CM.animH > 0 ? CM.animY : r.y;
  const scale = mix(.92, 1, e), dy = (1 - e) * 14;
  const cx = r.x + r.w / 2, cy = ry + rh / 2 + dy;
  const w = r.w * scale, h = rh * scale, x = cx - w / 2, y = cy - h / 2;
  return { x, y, w, h, rx: r.x, ry, rw: r.w, rh, cx, cy, dy, kx: scale, ky: scale, rad: 28 * scale, al: clamp(p * 1.4, 0, 1), raw: p, v: 0 };
}
function outDrawerGeom() {
  updateOutDrawerLayout();
  const r = OUT_DRAWER.r, p = clamp(OUT_DRAWER.sp.x, 0, 1);
  const dragOff = Math.max(-16, OUT_DRAWER.drag);
  const y = mix(H, r.y, p) + dragOff;
  return { x: r.x, y, w: r.w, h: r.h, rowH: r.rowH, rad: 28, al: clamp(p * 1.4, 0, 1), raw: p };
}
function menuGeom() {
  const m = menuRect(), ax = W - 40, ay = LAY.avatar.y + 22, p = clamp(MENU_SP.x, 0, 1), e = sstep(p);
  const scale = mix(.90, 1, e);
  const x = ax + (m.x - ax) * scale, y = ay + (m.y - ay) * scale, w = m.w * scale, h = m.h * scale;
  return { x, y, w, h, kx: scale, ky: scale, ax, ay, rad: 24 * scale, al: clamp(p * 1.4, 0, 1), raw: p, v: 0 };
}
function cmTheme() {
  const inSh = SH.t > .5, d = inSh ? true : pal.dark;
  const Ptop = topPage(), root = stackOf().length === 1, tn = (!inSh && !root) ? tintOf(Ptop) : null;
  const glassTint = tn ? tn.topTint : (d ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.55)');
  const glassSurface = d ? 'rgba(20,20,24,.45)' : 'rgba(245,245,250,.48)';
  const glassHl = tn ? tn.btnHl : undefined;
  return {
    dark: d,
    glassTint,
    glassSurface,
    glassHl,
    hlAlpha: d ? .25 : .55,
    shadowCol: d ? 'rgba(0,0,0,.42)' : 'rgba(0,0,0,.16)',
    fg: d ? '#ffffff' : (tn ? tn.ico : pal.fg),
    sub: d ? 'rgba(235,235,245,.60)' : (tn ? tn.icoSub : pal.sub),
    accent: tn ? tn.accent : pal.accent,
    headBg: d ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.045)',
    pressBg: d ? 'rgba(255,255,255,.11)' : 'rgba(0,0,0,.065)',
    sep: d ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'
  };
}
const tbP = P => !P ? 0 : (P._tbP != null ? P._tbP : sstep(clamp((P.scroll || 0) / 96, 0, 1)));
function topBtns(p) { const s = mix(1, .8, p), cy = LAY.avatar.y + 22, rx = LAY.avatar.x + 44, d = 44 * s; return { s, av: { x: rx - d, y: cy - d / 2, w: d, h: d }, mo: { x: rx - d - 10 * s - d, y: cy - d / 2, w: d, h: d } }; }
let CURP = null;
const fgG = () => pal.dark ? pal.fg : (BARC.t > .1 ? rgba4(BARC.fg) : '#ffffff'), subG = () => pal.dark ? pal.sub : (BARC.t > .1 ? rgba4(BARC.sub) : 'rgba(255,255,255,.68)');
const hasPill = P => P.kind === 'album' || P.kind === 'artist';
const getMenuItems = () => [[t('settings.theme_auto'), 'auto'], [t('settings.theme_light'), 'light'], [t('settings.theme_dark'), 'dark']];
const menuRect = () => ({ x: W - 18 - 236, y: LAY.avatar.y + 52, w: 236, h: 42 + getMenuItems().length * 46 + 6 });
function dock() {
  const em0 = sstep(clamp(NAV.minT, 0, 1)), sm = sstep(clamp(NAV.sm, 0, 1)), e = Math.max(em0, sm), em = em0 * (1 - sm);
  const tb = LAY.tab, m = LAY.mini, se = LAY.search, sd = tb.h, sc = 46;
  const effectiveKb = Math.max(KBH || 0, window.__NATIVE_KBH__ || 0);
  const kbOpen = (effectiveKb > 1);
  if (!window.__MAX_H__ || (!kbOpen && H > window.__MAX_H__)) {
    window.__MAX_H__ = H;
  }
  const isViewResized = window.__MAX_H__ && (window.__MAX_H__ - H) > 100;
  const vvOffset = (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.offsetTop) || 0;
  const bot0 = tb.y + sd;
  const bot = kbOpen ? (isViewResized ? (H - 14 + vvOffset) : (bot0 - effectiveKb + vvOffset)) : bot0;
  const s = mix(sd, sc, e);
  const fh = 54, ts = mix(sd, mix(sc, fh, sm), e), c1 = tb.x + mix(sc, fh, sm) + 8, c2 = W - tb.x - sc - 8;
  const circ = { x: mix(se.x, W - tb.x - sc, e), y: bot - s, w: s, h: s }, field = { x: c1, y: bot - fh, w: W - tb.x - c1, h: fh };
  const my0 = bot - ts - 8 - m.h;
  return { e, em, sm,
    tab: { x: tb.x, y: bot - ts, w: mix(tb.w, ts, e), h: ts },
    search: { x: mix(circ.x, field.x, sm), y: mix(circ.y, field.y, sm), w: mix(circ.w, field.w, sm), h: mix(circ.h, field.h, sm) },
    mini: { x: mix(m.x, c1, em), y: mix(my0, bot - sc, em), w: mix(m.w, c2 - c1, em), h: mix(m.h, sc, em) } };
}
const TINTC = {};
function tintOf(P) {
  if (!P || (P.kind !== 'album' && P.kind !== 'artist')) return null;
  const it = P.data.item, k = it.id + (pal.dark ? 'd' : 'l'); if (TINTC[k]) return TINTC[k];
  const pc = artPalette(artItem(it)), [h0, s0] = rgb2hsl(...pc[0]), [domH, domS] = pc._dom || [h0, s0], [footH, footS, footL] = pc._foot || [domH, domS, .42];
  const [imgL, darkFrac, footAvgL, footDarkFrac] = pc._meta || [.42, 0, .42, 0];
  const useFoot = footS > .09, h = useFoot ? footH : domH;
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const align0 = useFoot ? Math.max(.22, 1 - Math.max(0, hueDist(h0, footH) - 18) / 52) : 1;
  const alignDom = useFoot ? Math.max(.35, 1 - Math.max(0, hueDist(domH, footH) - 18) / 62) : 1;
  const s = Math.max(footS, domS * .88 * alignDom, s0 * .78 * align0), neu = s < .07;
  const isDarkMutedWarm = !neu && pal.dark && (h >= 12 && h <= 52) && footS < .36 &&
    ((darkFrac > .26 && footDarkFrac > .15) || (darkFrac > .36 && imgL < .35));
  const surfS = isDarkMutedWarm ? Math.min(s, .28) : s;
  // Soften warm yellow/gold highlights on dark warm portraits into an espresso tone.
  const footRgb = isDarkMutedWarm
    ? hsl2rgb(h, clamp(footS * .62, .08, .20), clamp(footAvgL * .52 + .06, .11, .17))
    : hsl2rgb(h, clamp(s * .85, .22, .78), clamp(footL * .85 + .08, .24, .42));
  const darkRgb = neu ? [14, 14, 17] : [10 * .48 + footRgb[0] * .52, 10 * .48 + footRgb[1] * .52, 12 * .48 + footRgb[2] * .52];
  // Warm up light-mode oranges/reds (h < 34°) slightly to avoid washed-out salmon tints.
  const warmShift = (h >= 0 && h < 34) ? (34 - h) * .28 : (h >= 345 ? (360 - h + 24) * .20 : 0);
  const hLight = (h + warmShift) % 360, hAcc = (domH + warmShift * .45) % 360, sAcc = Math.max(domS, s);
  const lightRgb = neu ? [246, 245, 242] : hsl2rgb(hLight, clamp(s * .74, .34, .68), .89);
  const rgb = pal.dark ? darkRgb : lightRgb;
  const argb = neu ? [250, 46, 73] : hsl2rgb(pal.dark ? h : hAcc, isDarkMutedWarm ? clamp(sAcc * .85, .52, .72) : clamp(sAcc * 1.18, .78, .96), pal.dark ? .58 : .49);
  const irgb = neu ? (pal.dark ? [246, 246, 248] : [24, 24, 28]) : hsl2rgb(pal.dark ? h : hLight, clamp(surfS * .55, .18, .48), pal.dark ? .92 : .17);
  const srgb = neu ? (pal.dark ? [200, 200, 208] : [96, 96, 106]) : hsl2rgb(pal.dark ? h : hLight, clamp(surfS * .50, .18, .44), pal.dark ? .70 : .36);
  const prgb = neu ? [20, 20, 24] : hsl2rgb(h, isDarkMutedWarm ? clamp(surfS * .65, .14, .26) : clamp(s * .78, .38, .72), isDarkMutedWarm ? .16 : .19);
  const drgb = neu ? [18, 18, 22] : hsl2rgb(h, isDarkMutedWarm ? clamp(surfS * .55, .12, .22) : clamp(s * .68, .30, .58), isDarkMutedWarm ? .11 : .12);
  const hrgb = neu ? [255, 255, 255] : hsl2rgb(h, clamp(surfS * .45, .14, .42), .90);
  const ltrgb = neu ? [255, 255, 255] : hsl2rgb(hLight, clamp(s * .46, .20, .54), .95);
  const lbar = neu ? [255, 255, 255] : hsl2rgb(hLight, clamp(s * .38, .16, .48), .94);
  const outTint = {
    css: 'rgb(' + rgb.map(Math.round).join(',') + ')', rgb: rgb.map(Math.round),
    accent: 'rgb(' + argb.map(Math.round).join(',') + ')',
    pillBg: pal.dark ? 'rgba(' + drgb.map(Math.round).join(',') + ',.42)' : 'rgba(' + ltrgb.map(Math.round).join(',') + ',.65)',
    ico: 'rgb(' + irgb.map(Math.round).join(',') + ')',
    icoSub: 'rgb(' + srgb.map(Math.round).join(',') + ')',
    playCol: 'rgb(' + prgb.map(Math.round).join(',') + ')',
    topTint: pal.dark ? 'rgba(' + drgb.map(Math.round).join(',') + ',.32)' : 'rgba(' + ltrgb.map(Math.round).join(',') + ',.60)',
    heroTint: pal.dark ? 'rgba(255,255,255,.07)' : 'rgba(' + ltrgb.map(Math.round).join(',') + ',.55)',
    btnHl: pal.dark ? 'rgba(' + hrgb.map(Math.round).join(',') + ',.82)' : 'rgba(255,255,255,.88)',
    _accent: [argb[0], argb[1], argb[2], 1],
    _pillBg: pal.dark ? [drgb[0], drgb[1], drgb[2], .42] : [ltrgb[0], ltrgb[1], ltrgb[2], .65],
    _fg: [irgb[0], irgb[1], irgb[2], 1],
    _sub: [srgb[0], srgb[1], srgb[2], 1],
    _topTint: pal.dark ? [drgb[0], drgb[1], drgb[2], .32] : [lbar[0], lbar[1], lbar[2], .58],
    _btnHl: pal.dark ? [hrgb[0], hrgb[1], hrgb[2], .82] : [255, 255, 255, .88],
    toString() { return this.css; }
  };
  if (!pc._placeholder) TINTC[k] = outTint;
  return outTint;
}
const BARC = { init: false, accent: [250, 46, 73, 1], pillBg: [255, 255, 255, .14], fg: [255, 255, 255, 1], sub: [235, 235, 245, .60], topTint: [255, 255, 255, .16], btnHl: [255, 255, 255, .50], t: 0 };
const rgba4 = q => 'rgba(' + Math.round(q[0]) + ',' + Math.round(q[1]) + ',' + Math.round(q[2]) + ',' + (+q[3].toFixed(3)) + ')';
function barTargetCols() {
  const s = stackOf(), P = s[s.length - 1], Pprev = s.length > 1 ? s[s.length - 2] : null;
  const tn = s.length > 1 ? tintOf(P) : null, tnPrev = s.length > 2 ? tintOf(Pprev) : null, d = pal.dark;
  const def = {
    accent: [250, 46, 73, 1],
    pillBg: [255, 255, 255, d ? .14 : .16],
    fg: [255, 255, 255, 1],
    sub: d ? [235, 235, 245, .60] : [255, 255, 255, .68],
    topTint: d ? [255, 255, 255, .16] : [24, 24, 28, .28],
    btnHl: [255, 255, 255, .50],
    t: 0
  };
  const from = tnPrev ? { accent: tnPrev._accent, pillBg: tnPrev._pillBg, fg: tnPrev._fg, sub: tnPrev._sub, topTint: tnPrev._topTint, btnHl: tnPrev._btnHl, t: 1 } : def;
  const to = tn ? { accent: tn._accent, pillBg: tn._pillBg, fg: tn._fg, sub: tn._sub, topTint: tn._topTint, btnHl: tn._btnHl, t: 1 } : def;
  if (!tn && !tnPrev) return def;
  const w = clamp(1 - NAV.popP, 0, 1);
  if (w >= .999) return to;
  if (w <= .001) return from;
  const bl = (a, b) => [mix(a[0], b[0], w), mix(a[1], b[1], w), mix(a[2], b[2], w), mix(a[3], b[3], w)];
  return { accent: bl(from.accent, to.accent), pillBg: bl(from.pillBg, to.pillBg), fg: bl(from.fg, to.fg), sub: bl(from.sub, to.sub), topTint: bl(from.topTint, to.topTint), btnHl: bl(from.btnHl, to.btnHl), t: mix(from.t, to.t, w) };
}
function stepBarCols(dt) {
  const tg = barTargetCols();
  if (!BARC.init || dt <= 0) {
    ['accent', 'pillBg', 'fg', 'sub', 'topTint', 'btnHl'].forEach(k => { BARC[k] = tg[k].slice(); });
    BARC.t = tg.t; BARC.init = true; return false;
  }
  let ch = false;
  ['accent', 'pillBg', 'fg', 'sub', 'topTint', 'btnHl'].forEach(k => {
    const a = BARC[k], b = tg[k];
    for (let i = 0; i < 4; i++) {
      const lim = i < 3 ? .35 : .003;
      if (Math.abs(a[i] - b[i]) > lim) { a[i] = ease(a[i], b[i], 12, dt); ch = true; } else a[i] = b[i];
    }
  });
  if (Math.abs(BARC.t - tg.t) > .003) { BARC.t = ease(BARC.t, tg.t, 12, dt); ch = true; } else BARC.t = tg.t;
  return ch;
}
const navAccent = () => { if (!BARC.init) stepBarCols(0); return rgba4(BARC.accent); };
const pageIco = P => { const tn = tintOf(P); return tn ? tn.ico : pal.fg; };
const pageSubIco = P => { const tn = tintOf(P); return tn ? tn.icoSub : pal.sub; };
function barIco(sub) {
  if (!BARC.init) stepBarCols(0);
  return rgba4(sub ? BARC.sub : BARC.fg);
}
const tintA = (tn, a) => 'rgba(' + tn.rgb.join(',') + ',' + a + ')';
function drawPageAt(c, P, ox, under) {
  CURP = P;
  const tn = tintOf(P), bgc = tn ? tn.css : pal.bg; c.save(); c.beginPath(); c.rect(ox, 0, W, H); c.clip(); c.fillStyle = bgc; c.fillRect(ox, 0, W, H);
  c.save(); c.translate(ox, -P.scroll); T.x = ox; T.y = -P.scroll; P.h = PAGES[P.kind](c, P); c.restore(); T.x = T.y = 0;
  if (under) { c.fillStyle = 'rgba(0,0,0,' + (.22 * under) + ')'; c.fillRect(ox, 0, W, H); }
  c.restore();
}
const _TAB_ORDER = ['home', 'new', 'radio', 'library', 'search'];
let _tabPrevCv = null, _tabPrevCtx = null;
const _tabTrans = { active: false, step: 1, t0: 0, sp: new Spring(1, 380, 39.0) };
const _miniTrans = { tr: null, dx: 0, dir: 0, t: 0 };
let _miniDismissHaptic = false;
let _underPageCv = null, _underPageCtx = null;
const _underPageState = { page: null, kind: '', scroll: 0, w: 0, h: 0, dpr: 0, dark: null, glass: [] };
function _shiftGlassItem(it, dx) {
  const copy = Object.assign({}, it, { under: true });
  if (typeof copy.x === 'number') copy.x += dx;
  if (typeof copy.tx === 'number') copy.tx += dx;
  if (typeof copy.rx === 'number') copy.rx += dx;
  if (typeof copy.actX === 'number') copy.actX += dx;
  if (Array.isArray(copy.chips)) {
    copy.chips = copy.chips.map(ch => Object.assign({}, ch, { x: ch.x + dx }));
  }
  return copy;
}
function tabTransState() {
  if (!_tabTrans.active) return { on: false, al: 1, sc: 1, dx: 0 };
  const el = performance.now() - _tabTrans.t0;
  const spX = clamp(_tabTrans.sp.x, 0, 1);
  return {
    on: true,
    al: clamp(el / 220, 0, 1),
    sc: mix(0.97, 1, spX),
    dx: _tabTrans.step * (W / 12) * (1 - spX)
  };
}
function _tabRect(x, y, w, h, tr) {
  if (!tr || !tr.on) return { x, y, w, h };
  return {
    x: W / 2 + tr.dx + (x - W / 2) * tr.sc,
    y: H / 2 + (y - H / 2) * tr.sc,
    w: w * tr.sc,
    h: h * tr.sc
  };
}
window.onTabSwitch = function(fromTab, toTab) {
  if (!fromTab || !toTab || fromTab === toTab) return;
  if (typeof SH !== 'undefined' && SH.t > 0.98) return;
  if (typeof S === 'undefined' || !S.width || !S.height) return;
  const fi = _TAB_ORDER.indexOf(fromTab), ti = _TAB_ORDER.indexOf(toTab);
  const step = (fi >= 0 && ti >= 0 && fi !== ti) ? Math.sign(ti - fi) : 1;
  try {
    if (!_tabPrevCv) { _tabPrevCv = document.createElement('canvas'); _tabPrevCtx = _tabPrevCv.getContext('2d'); }
    if (_tabPrevCv.width !== S.width || _tabPrevCv.height !== S.height) { _tabPrevCv.width = S.width; _tabPrevCv.height = S.height; }
    _tabPrevCtx.setTransform(1, 0, 0, 1, 0, 0);
    _tabPrevCtx.clearRect(0, 0, _tabPrevCv.width, _tabPrevCv.height);
    _tabPrevCtx.drawImage(S, 0, 0);
    _tabTrans.active = true;
    _tabTrans.step = step;
    _tabTrans.t0 = performance.now();
    _tabTrans.sp.x = 0; _tabTrans.sp.v = 0; _tabTrans.sp.t = 1;
  } catch (e) {
    _tabTrans.active = false;
  }
};
let _inDrawScenePending = false, _inDrawScenePendingOv = false;
function scheduleSceneAnimRedraw(withOv) {
  if (window.__IN_DRAW_SCENE) {
    _inDrawScenePending = true;
    if (withOv) _inDrawScenePendingOv = true;
    return;
  }
  D.scene = true;
  if (withOv) D.ov = true;
  D.gl = true;
}
if (typeof window !== 'undefined') window.scheduleSceneAnimRedraw = scheduleSceneAnimRedraw;
function drawScene() {
  window.__IN_DRAW_SCENE = true;
  try {
    _waveVis = false;
    const c = sc; c.setTransform(S.width / W, 0, 0, S.height / H, 0, 0); c.fillStyle = pal.bg; c.fillRect(0, 0, W, H);
    HITS = []; RAILS = []; if (typeof SET_GLASS !== 'undefined') SET_GLASS.length = 0;
    const s = stackOf(), P = s[s.length - 1], pp = NAV.popP;
    if (SH.t < 0.999 || SH.drag) {
      const tr = tabTransState();
      const tabOn = tr.on;
      const el = tabOn ? (performance.now() - _tabTrans.t0) : 999;
      const spX = tabOn ? clamp(_tabTrans.sp.x, 0, 1) : 1;
      if (tabOn && _tabPrevCv) {
        const outAl = clamp(1 - el / 160, 0, 1);
        if (outAl > 0.01) {
          const outSc = mix(1, 0.97, spX), outDx = -_tabTrans.step * (W / 12) * spX;
          c.save();
          c.globalAlpha = outAl;
          c.translate(W / 2 + outDx, H / 2);
          c.scale(outSc, outSc);
          c.translate(-W / 2, -H / 2);
          c.drawImage(_tabPrevCv, 0, 0, W, H);
          c.restore();
        }
      }
      const inAl = tr.al, inSc = tr.sc, inDx = tr.dx;
      c.save();
      if (tabOn) {
        c.globalAlpha = inAl;
        c.translate(W / 2 + inDx, H / 2);
        c.scale(inSc, inSc);
        c.translate(-W / 2, -H / 2);
      }
      if (s.length > 1 && pp > .001) {
        const Punder = s[s.length - 2], oxUnder = -W * .28 * (1 - pp), underAmt = 1 - pp;
        const canUseUnderCache = typeof document !== 'undefined' && S.width > 0 && S.height > 0 &&
          !(typeof _skulletActive !== 'undefined' && _skulletActive) && !_waveVis && !(typeof window !== 'undefined' && window._artFadeActive);
        if (canUseUnderCache) {
          if (!_underPageCv) { _underPageCv = document.createElement('canvas'); _underPageCtx = _underPageCv.getContext('2d'); }
          if (_underPageCv.width !== S.width || _underPageCv.height !== S.height) {
            _underPageCv.width = S.width; _underPageCv.height = S.height;
            _underPageState.page = null;
          }
          const st = _underPageState;
          if (st.page !== Punder || st.kind !== Punder.kind || st.scroll !== Punder.scroll || st.w !== W || st.h !== H || st.dpr !== S.width || st.dark !== pal.dark) {
            const uc = _underPageCtx;
            const gStart = typeof SET_GLASS !== 'undefined' ? SET_GLASS.length : 0;
            uc.setTransform(S.width / W, 0, 0, S.height / H, 0, 0);
            uc.clearRect(0, 0, W, H);
            const prevArtFade = typeof window !== 'undefined' ? window._artFadeActive : false;
            if (typeof window !== 'undefined') window._artFadeActive = false;
            REG = false;
            drawPageAt(uc, Punder, 0, 0);
            REG = true;
            if (typeof SET_GLASS !== 'undefined') {
              st.glass = SET_GLASS.slice(gStart);
              SET_GLASS.length = gStart;
            } else {
              st.glass = [];
            }
            const hadAnim = (typeof _skulletActive !== 'undefined' && _skulletActive) || _waveVis || (typeof window !== 'undefined' && !!window._artFadeActive);
            if (typeof window !== 'undefined' && prevArtFade) window._artFadeActive = true;
            st.page = hadAnim ? null : Punder;
            st.kind = Punder.kind; st.scroll = Punder.scroll; st.w = W; st.h = H; st.dpr = S.width; st.dark = pal.dark;
          }
          c.save();
          c.beginPath(); c.rect(0, 0, Math.min(W, pp * W + 2), H); c.clip();
          c.drawImage(_underPageCv, oxUnder, 0, W, H);
          if (underAmt > 0.001) { c.fillStyle = 'rgba(0,0,0,' + (.22 * underAmt) + ')'; c.fillRect(oxUnder, 0, W, H); }
          c.restore();
          if (typeof SET_GLASS !== 'undefined' && st.glass.length) {
            for (let gi = 0; gi < st.glass.length; gi++) SET_GLASS.push(_shiftGlassItem(st.glass[gi], oxUnder));
          }
        } else {
          REG = false; drawPageAt(c, Punder, oxUnder, underAmt); REG = true;
        }
      } else if (_underPageState.page) {
        _underPageState.page = null;
        _underPageState.glass = [];
      }
      drawPageAt(c, P, pp * W, 0);
      if (pp > .001) { const w = 90, g = c.createLinearGradient(pp * W - w, 0, pp * W, 0), al = .26 * (1 - pp * .6); [[0, 0], [.35, .02], [.6, .07], [.82, .16], [1, 1]].forEach(([o, f]) => g.addColorStop(o, 'rgba(0,0,0,' + (al * (f === 1 ? 1 : f / .16 * .6)) + ')')); c.fillStyle = g; c.fillRect(pp * W - w, 0, w, H); }
      c.restore();
    }
    if (SH.t > .002 || SH.drag) drawSheet(c); else SHITS = [];
  } finally {
    window.__IN_DRAW_SCENE = false;
  }
}

function dockVis() {
  const s = stackOf(), P = s[s.length - 1], Pprev = s.length > 1 ? s[s.length - 2] : null;
  const curSet = P && P.kind === 'settings', prevSet = Pprev && Pprev.kind === 'settings';
  if (curSet && prevSet) return 0;
  if (curSet) return s.length > 1 ? clamp(NAV.popP, 0, 1) : 0;
  if (prevSet) return clamp(1 - NAV.popP, 0, 1);
  return 1;
}

function statusBar(c, col) {
  const d = new Date(), tm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  txt(c, tm, 52, 36, F(600, 16), col, 'center');
  c.fillStyle = col; [4, 6.5, 9, 11.5].forEach((h, i) => { rrPath(c, W - 88 + i * 4.6, 36 - h, 3, h, 1); c.fill(); });
  c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round'; [3, 6, 9].forEach(r => { c.beginPath(); c.arc(W - 62, 36, r + 1, -2.35, -.8); c.stroke(); });
  rrPath(c, W - 50, 25, 24, 12, 3.6); c.globalAlpha = .45; c.lineWidth = 1; c.stroke(); c.globalAlpha = 1; rrPath(c, W - 48, 27, 17, 8, 2); c.fill(); rrPath(c, W - 25, 29.5, 2, 4, 1); c.fill();
}
/* clamp press spring above zero after release to prevent a 1-frame dark bubble flash over the highlight */
const BUB = { mx: 1 };
function bubPress() { const r = clamp(SP.tabP.x, 0, 1); if (SP.tabP.t > .5) { BUB.mx = 1; return r; } BUB.mx = Math.min(BUB.mx, r); return BUB.mx; }
function bubble() {
  const tw = LAY.tabs[0].w, pp = bubPress(), tb = LAY.tab;
  const scale = 1 + (74 / 56 - 1) * pp;
  const vel = SP.tab.v / 10;
  const vx = clamp(vel * .75, -.2, .2), vy = clamp(vel * .25, -.2, .2);
  const sx = scale / (1 - vx), sy = scale * (1 - vy);
  return { tw, pp, cx: LAY.tabs[0].x + tw / 2 + clamp(SP.tab.x, -.25, 3.25) * tw, hw: tw * sx / 2, hh: (tb.h - 8) * sy / 2 };
}
const bubbleOn = () => bubPress() > .012 && dock().e < .05 && SH.t < .3 && dockVis() > .02;
function barGlyphs(c, withPill, innerPp) {
  if (!BARC.init) stepBarCols(0);
  const tb = LAY.tab, tw = LAY.tabs[0].w, px = LAY.tabs[0].x + clamp(SP.hl.x, 0, TABS.length - 1) * tw, idx = TABS.findIndex(x => x[0] === NAV.tab);
  const hi = rgba4(BARC.pillBg), actCol = navAccent(), subCol = barIco(true);
  if (withPill && idx >= 0) {
    c.save(); c.globalAlpha *= 1 - clamp(bubPress() * 2, 0, 1);
    c.fillStyle = hi; rrPath(c, px, tb.y + 4, tw, tb.h - 8, (tb.h - 8) / 2); c.fill();
    if (BARC.t > .02) { c.strokeStyle = 'rgba(255,255,255,' + (.10 * BARC.t).toFixed(3) + ')'; c.lineWidth = 1; c.stroke(); }
    c.restore();
  }
  TABS.forEach((tt, i) => {
    const r = LAY.tabs[i], sel = i === idx, col = sel ? actCol : subCol;
    const cx = r.x + r.w / 2, sc = innerPp ? 1 + .20 * innerPp * clamp(1 - Math.abs(SP.tab.x - i), 0, 1) : 1;
    c.save(); if (sc !== 1) { c.translate(cx, tb.y + tb.h / 2); c.scale(sc, sc); c.translate(-cx, -(tb.y + tb.h / 2)); }
    icon(c, tt[2], cx, tb.y + tb.h * .38, 22, col); txt(c, tt[1], cx, tb.y + tb.h * .82, F(sel ? 600 : 500, 10), col, 'center');
    c.restore();
  });
}
function prevBarGlyphs(c, it, withPill, innerPp) {
  const tw = it.tw, idx = Math.round(clamp(it.pVal, 0, 3)), px = it.x + 4 + clamp(it.pVal, 0, 3) * tw;
  const actCol = '#fa2e49', subCol = 'rgba(255,255,255,.72)';
  if (withPill) {
    c.save(); c.globalAlpha *= 1 - clamp(it.pPP * 2, 0, 1);
    c.fillStyle = 'rgba(255,255,255,.16)'; rrPath(c, px, it.y + 4, tw, it.h - 8, (it.h - 8) / 2); c.fill();
    c.restore();
  }
  const prevTabs = typeof getPrevTabs === 'function' ? getPrevTabs() : PREV_TABS;
  prevTabs.forEach((tt, i) => {
    const cx = it.x + 4 + i * tw + tw / 2, cy = it.y + it.h / 2, sel = i === idx, col = sel ? actCol : subCol;
    const sc = innerPp ? 1 + .20 * innerPp * clamp(1 - Math.abs(it.pVal - i), 0, 1) : 1;
    c.save(); if (sc !== 1) { c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); }
    icon(c, tt[2], cx, it.y + it.h * .38, 20, col);
    txt(c, tt[1], cx, it.y + it.h * .82, F(sel ? 600 : 500, 9.5), col, 'center');
    c.restore();
  });
}
let _rimWasEmpty = true;
function drawRim() {
  const hasGlassRim = typeof SET_GLASS !== 'undefined' && SET_GLASS.some(it =>
    (it.kind === 'toggle' && it.pp > .001) || (it.kind === 'prevBar' && it.pPP > .01));
  const hasBub = bubbleOn();
  const c = oc;
  if (!hasGlassRim && !hasBub) {
    if (_rimWasEmpty) return false;
    c.setTransform(O.width / W, 0, 0, O.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    _rimWasEmpty = true;
    return true;
  }
  _rimWasEmpty = false;
  c.setTransform(O.width / W, 0, 0, O.height / H, 0, 0); c.clearRect(0, 0, W, H);
  if (typeof SET_GLASS !== 'undefined' && SET_GLASS.length) {
    SET_GLASS.forEach(it => {
      if (it.kind === 'toggle' && it.pp > .001) {
        /* Inside the expanded thumb lens (40*sx x 24*sy), slightly scale the 64x28 track (.84 x .82) so top/bottom borders stay crisp */
        const tsx = (2 / 3 + (.84 - 2 / 3) * it.pp);
        const tsy = (.82 * it.pp);
        const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
        c.save();
        if (it.under && NAV.popP > .001) {
          c.beginPath(); c.rect(0, 0, NAV.popP * W, H); c.clip();
        }
        rrPath(c, it.x - 2, it.y - 2, it.w + 4, it.h + 4, (it.h + 4) / 2);
        c.clip();
        c.fillStyle = it.cardBg || (pal.dark ? '#1d1d1d' : '#f4f4f4');
        c.fillRect(it.x - 4, it.y - 4, it.w + 8, it.h + 8);
        c.translate(cx, cy); c.scale(tsx, tsy); c.translate(-cx, -cy);
        rrPath(c, it.tx, it.ty, 64, 28, 14);
        c.fillStyle = it.trackBg;
        c.fill();
        c.restore();
      } else if (it.kind === 'prevBar' && it.pPP > .01) {
        const pp = clamp(it.pPP, 0, 1);
        const cw = it.w - 8 * pp, ch = it.h - 10 * pp, cx = it.x + (it.w - cw) / 2, cy = it.y + (it.h - ch) / 2, cr = Math.min(29, ch / 2);
        c.save();
        rrPath(c, cx, cy, cw, ch, cr);
        c.fillStyle = 'rgba(255,255,255,.18)';
        c.fill();
        c.save(); rrPath(c, cx, cy, cw, ch, cr); c.clip();
        const ts = c.createLinearGradient(0, cy, 0, cy + 3);
        ts.addColorStop(0, 'rgba(255,255,255,' + (.30 * pp) + ')'); ts.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = ts; c.fillRect(cx, cy, cw, 3);
        const bs = c.createLinearGradient(0, cy + ch - 3, 0, cy + ch);
        bs.addColorStop(0, 'rgba(255,255,255,0)'); bs.addColorStop(1, 'rgba(255,255,255,' + (.25 * pp) + ')');
        c.fillStyle = bs; c.fillRect(cx, cy + ch - 3, cw, 3);
        c.restore();
        c.strokeStyle = 'rgba(255,255,255,' + (.28 * pp) + ')'; c.lineWidth = 1;
        rrPath(c, cx + .5, cy + .5, cw - 1, ch - 1, cr); c.stroke();
        barBloom(c, { cx: it.bCx }, { x: cx, y: cy, w: cw, h: ch }, cy + ch / 2, pp);
        prevBarGlyphs(c, it, false, pp);
        c.restore();
      }
    });
  }
  if (!hasBub) return true;
  if (!BARC.init) stepBarCols(0);
  const b = bubble(), pp = clamp(b.pp, 0, 1), tb = LAY.tab, dy = SH.t * 120, dk = dock(), dkbY = dk.tab.y - tb.y;
  const cw = tb.w - 8 * pp, ch = tb.h - 10 * pp, cx = tb.x + (tb.w - cw) / 2, cy = tb.y + (tb.h - ch) / 2, cr = Math.min(32, ch / 2);
  c.save(); c.translate(0, dy + dkbY);
  rrPath(c, cx, cy, cw, ch, cr);
  c.fillStyle = rgba4(BARC.topTint);
  c.fill();
  if (pp > .01) {
    c.save(); rrPath(c, cx, cy, cw, ch, cr); c.clip();
    const ts = c.createLinearGradient(0, cy, 0, cy + 3);
    ts.addColorStop(0, 'rgba(255,255,255,' + (.30 * pp) + ')'); ts.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = ts; c.fillRect(cx, cy, cw, 3);
    const bs = c.createLinearGradient(0, cy + ch - 3, 0, cy + ch);
    bs.addColorStop(0, 'rgba(255,255,255,0)'); bs.addColorStop(1, 'rgba(255,255,255,' + (.25 * pp) + ')');
    c.fillStyle = bs; c.fillRect(cx, cy + ch - 3, cw, 3);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,' + (.28 * pp) + ')'; c.lineWidth = 1;
    rrPath(c, cx + .5, cy + .5, cw - 1, ch - 1, cr); c.stroke();
  }
  barBloom(c, b, { x: cx, y: cy, w: cw, h: ch }, cy + ch / 2, pp);
  barGlyphs(c, false, pp);
  c.restore();
  return true;
}
function barBloom(c, b, tb, cy, pp) {
  if (pp < .001) return; c.save(); rrPath(c, tb.x, tb.y, tb.w, tb.h, tb.h / 2); c.clip(); c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,255,255,' + (.08 * pp) + ')'; c.fillRect(tb.x, tb.y, tb.w, tb.h);
  const g = c.createRadialGradient(b.cx, cy, 0, b.cx, cy, 96); g.addColorStop(0, 'rgba(255,255,255,' + (.22 * pp) + ')'); g.addColorStop(.5, 'rgba(255,255,255,' + (.10 * pp) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(b.cx - 96, cy - 96, 192, 192); c.restore();
}
const _dlRingAnim = {};
function drawHeroDownloadBtn(c, hb, Ppage, icCol) {
  const it = Ppage && Ppage.data && Ppage.data.item;
  const cx = hb.x1 + hb.d / 2, cy = hb.y + hb.d / 2;
  const dl = (typeof getDownloadProgress === 'function' && it) ? getDownloadProgress(it) : null;
  if (!dl || (!dl.active && !dl.allDone)) {
    if (it && _dlRingAnim[it.id]) delete _dlRingAnim[it.id];
    icon(c, 'arrowd', cx, cy, 20, icCol, { lw: 2.1 });
    return;
  }
  const key = dl.key || (it && it.id) || 'dl';
  const now = performance.now();
  let st = _dlRingAnim[key];
  if (!st) st = _dlRingAnim[key] = { p: dl.active ? 0 : dl.pct, t: now };
  const target = dl.allDone ? 1 : dl.pct;
  const dt = st.t ? clamp((now - st.t) / 1000, 0.001, 0.05) : 0.016;
  st.t = now;
  if (Math.abs(st.p - target) > 0.002) {
    st.p = ease(st.p, target, 14, dt);
    if (typeof scheduleAnimRedraw === 'function') scheduleAnimRedraw();
  } else {
    st.p = target;
  }
  const tn = typeof tintOf === 'function' ? tintOf(Ppage) : null;
  const acc = (tn && tn.accent) || pal.accent || '#fa2e49';
  const r = hb.d / 2 - 2.2;
  const fullCircle = Math.PI * 2;
  c.save();
  if (dl.active) {
    c.beginPath();
    c.arc(cx, cy, r, 0, fullCircle);
    c.lineWidth = 2.6;
    c.strokeStyle = pal.dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)';
    c.stroke();
    if (st.p > 0.004) {
      c.beginPath();
      c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + fullCircle * clamp(st.p, 0, 1));
      c.lineWidth = 2.8;
      c.lineCap = 'round';
      c.strokeStyle = acc;
      c.stroke();
    }
    icon(c, 'arrowd', cx, cy, 17, icCol, { lw: 2.1 });
  } else {
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, 0, fullCircle);
    c.lineWidth = 2.2;
    c.strokeStyle = acc;
    c.globalAlpha *= 0.88;
    c.stroke();
    c.restore();
    icon(c, 'check', cx, cy, 16, icCol, { lw: 2.5 });
  }
  c.restore();
}
function heroBtnState(P, dk, k) {
  if (!P || !hasPill(P) || P.heroY == null) return null;
  const g = heroGeom(P.heroY), hy = g.cy - P.scroll;
  const al = k * heroBtnAlpha(P);
  if (al <= .01) return null;
  return { y: hy, d: g.cd, x0: g.x0, x1: g.x1, al };
}
const _TOPBAR_GRAD = [
  'linear-gradient(to bottom, rgba(0,0,0,0) -16.7%, #000 0%, #000 16.7%, rgba(0,0,0,0) 33.3%)',
  'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 16.7%, #000 33.3%, rgba(0,0,0,0) 50%)',
  'linear-gradient(to bottom, rgba(0,0,0,0) 16.7%, #000 33.3%, #000 50%, rgba(0,0,0,0) 66.7%)',
  'linear-gradient(to bottom, rgba(0,0,0,0) 33.3%, #000 50%, #000 66.7%, rgba(0,0,0,0) 83.3%)',
  'linear-gradient(to bottom, rgba(0,0,0,0) 50%, #000 66.7%, #000 83.3%, rgba(0,0,0,0) 100%)',
  'linear-gradient(to bottom, rgba(0,0,0,0) 66.7%, #000 83.3%, rgba(0,0,0,0) 100%)',
  null
];
let _tbEl = null, _tbPrevEl = null, _tbCurrEl = null, _tbInited = false;
function drawHeroTopTitle(c, Ppage, icCol, qtVal) {
  const titleText = Ppage && Ppage.data && Ppage.data.item && Ppage.data.item.title;
  if (!titleText) return;
  const visA = clamp(1 - (qtVal || 0) * 1.4, 0, 1);
  if (visA <= 0.01) return;
  const rawY = Math.round(W * .95) - 4 - (Ppage.scroll || 0);
  const topY = TOP + 33;
  const ty = Math.max(topY, rawY);
  const dk = dock();
  const dkLim = Math.min((dk.mini && dk.mini.y) || dk.tab.y, dk.tab.y) - 6;
  const dockFade = clamp((dkLim - ty) / 24, 0, 1);
  const alpha = visA * dockFade;
  if (alpha <= 0.01) return;
  const tMorph = sstep(clamp(((topY + 64) - rawY) / 64, 0, 1));
  const fs = +mix(21, 17, tMorph).toFixed(2);
  const fw = Math.round(mix(500, 600, tMorph));
  const maxW = mix(W - 48, W - 2 * 116, tMorph);
  c.save();
  c.globalAlpha *= alpha;
  txt(c, titleText, W / 2, ty, F(fw, fs), icCol, 'center', maxW);
  c.restore();
}
function ensureTopbarRefs() {
  if (_tbInited) return;
  _tbInited = true;
  if (typeof document !== 'undefined') {
    _tbEl = document.getElementById('topbar');
    _tbPrevEl = document.getElementById('topbarPrev');
    _tbCurrEl = document.getElementById('topbarCurr');
    if (_tbEl && _tbPrevEl && _tbCurrEl) {
      _tbEl._spansPrev = Array.from(_tbPrevEl.querySelectorAll('span'));
      _tbEl._spansCurr = Array.from(_tbCurrEl.querySelectorAll('span'));
    }
  }
}
function drawOverlay() {
  const rimChanged = drawRim();
  const c = TC; c.setTransform($top.width / W, 0, 0, $top.height / H, 0, 0); c.clearRect(0, 0, W, H);
  const shVis = clamp(1 - shY() / H, 0, 1);
  const k = clamp(1 - shVis * 3, 0, 1), P = topPage(), st = stackOf(), t = cur();
  {
    ensureTopbarRefs();
    const tb = _tbEl, tbPrev = _tbPrevEl, tbCurr = _tbCurrEl;
    if (tb && tbPrev && tbCurr) {
      const root = st.length === 1, pp = NAV.popP;
      const sc1 = P ? (P.scroll || 0) : 0, p1 = clamp(sc1 / 60, 0, 1).toFixed(3);
      const Pprev = !root ? st[st.length - 2] : null;
      const sc0 = Pprev ? (Pprev.scroll || 0) : 0, p0 = (!root ? clamp(sc0 / 60, 0, 1) : 0).toFixed(3);
      const splitNum = !root && pp > .0001 ? +(pp * W).toFixed(2) : 0;
      const barH = (root && NAV.tab === 'search')
        ? Math.max(56, Math.ceil(TOP + 16))
        : Math.max(112, Math.ceil((LAY.back ? LAY.back.y + LAY.back.h : 96) + 16));
      const hasSheetCut = SH.t > .002 || SH.drag;
      const shTop = hasSheetCut ? shY() : barH;
      const sheetCov = hasSheetCut && shTop <= .5;
      const vis0 = !sheetCov && splitNum > 0 && sc0 > .1;
      const vis1 = !sheetCov && sc1 > .1 && splitNum < W;
      if (tb._vis0 !== vis0) { tb._vis0 = vis0; tbPrev.style.visibility = vis0 ? 'visible' : 'hidden'; }
      if (tb._vis1 !== vis1) { tb._vis1 = vis1; tbCurr.style.visibility = vis1 ? 'visible' : 'hidden'; }
      const split = splitNum + 'px';
      const barHVal = barH + 'px';
      if (tb._barH !== barHVal) { tb._barH = barHVal; tb.style.setProperty('--bar-h', barHVal); }
      if (tb._p0 !== p0) { tb._p0 = p0; tb.style.setProperty('--p0', p0); }
      if (tb._p1 !== p1) { tb._p1 = p1; tb.style.setProperty('--p1', p1); }
      if ((vis0 || vis1 || splitNum === 0) && tb._split !== split) { tb._split = split; tb.style.setProperty('--split', split); }
      const defRgb = pal.dark ? '0, 0, 0' : '255, 255, 255';
      const tn1 = !root ? tintOf(P) : null, rgb1 = tn1 ? tn1.rgb.join(', ') : defRgb;
      const tn0 = (Pprev && st.length > 2) ? tintOf(Pprev) : null, rgb0 = tn0 ? tn0.rgb.join(', ') : defRgb;
      if (tb._rgb0 !== rgb0) { tb._rgb0 = rgb0; tb.style.setProperty('--rgb0', rgb0); }
      if (tb._rgb1 !== rgb1) { tb._rgb1 = rgb1; tb.style.setProperty('--rgb1', rgb1); }
      const emptyHoleMask = tb._emptyMask || (tb._emptyMask = 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E")');
      const holeMask = (Ppage, dx, wBox, cacheBox) => {
        if (wBox <= 0) return 'none';
        if (sheetCov) return emptyHoleMask;
        const holes = [];
        if (Ppage) {
          if (Ppage === st[0]) {
            if (NAV.tab === 'home' || NAV.tab === 'library') {
              const tbn = topBtns(tbP(Ppage));
              if (NAV.tab === 'library') holes.push({ x: tbn.mo.x + dx, y: tbn.mo.y, w: tbn.mo.w, h: tbn.mo.h });
              holes.push({ x: tbn.av.x + dx, y: tbn.av.y, w: tbn.av.w, h: tbn.av.h });
            }
          } else {
            const bk = LAY.back;
            holes.push({ x: bk.x + dx, y: bk.y, w: bk.w, h: bk.h });
            if (hasPill(Ppage)) {
              const ap = pillRect(Ppage), ps = pSearchRect(Ppage);
              holes.push({ x: ap.x + dx, y: ap.y, w: ap.w, h: ap.h });
              if (ps.qt > .01) holes.push({ x: ps.x + dx, y: ps.y, w: ps.w, h: ps.h });
            }
          }
        }
        if (!holes.length && (!hasSheetCut || shTop >= barH)) return 'none';
        const mDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
        const svgW = Math.max(1, Math.round(wBox * mDpr));
        const svgH = Math.max(1, Math.round(barH * mDpr));
        const vbW = +wBox.toFixed(2);
        const hasCut = hasSheetCut && shTop < barH;
        const sy = hasCut ? +Math.max(0, shTop).toFixed(2) : -1;
        const sr = hasCut ? +Math.min(46 * (1 - clamp((SH.t - .9) / .1, 0, 1)), vbW / 2).toFixed(2) : -1;
        const inset = 0.65;
        let maskKey = svgW + 'x' + svgH + '|' + vbW + '|' + barH + '|' + sy + ',' + sr;
        const holeGeom = [];
        for (let i = 0; i < holes.length; i++) {
          const h = holes[i];
          if (h.y >= shTop + 46) continue;
          const hx = h.x + inset, hy = h.y + inset;
          const hw = h.w - inset * 2, hh = h.h - inset * 2;
          if (hw <= 0 || hh <= 0) continue;
          const hr = Math.max(0, Math.min(22 - inset, hw / 2, hh / 2));
          const x = +hx.toFixed(2), y = +hy.toFixed(2), w = +hw.toFixed(2), hh2 = +hh.toFixed(2), rr = +hr.toFixed(2);
          maskKey += '|' + x + ',' + y + ',' + w + ',' + hh2 + ',' + rr;
          holeGeom.push([x, y, w, hh2, rr]);
        }
        if (cacheBox && cacheBox._mKey === maskKey && cacheBox._mVal) return cacheBox._mVal;
        let clipDef = '', clipAttr = '';
        if (hasCut) {
          const cd = sr > .5
            ? 'M0,0H' + vbW + 'V' + +(sy + sr).toFixed(2) + 'A' + sr + ',' + sr + ' 0 0 0 ' + +(vbW - sr).toFixed(2) + ',' + sy + 'H' + sr + 'A' + sr + ',' + sr + ' 0 0 0 0,' + +(sy + sr).toFixed(2) + 'Z'
            : 'M0,0H' + vbW + 'V' + sy + 'H0Z';
          clipDef = '<defs><clipPath id="sc"><path d="' + cd + '"/></clipPath></defs>';
          clipAttr = ' clip-path="url(#sc)"';
        }
        let d = 'M0,0H' + vbW + 'V' + barH + 'H0Z';
        holeGeom.forEach(([x, y, w, hh2, rr]) => {
          const lineW = +(w - 2 * rr).toFixed(2), lineH = +(hh2 - 2 * rr).toFixed(2);
          if (lineW <= 0.01 && lineH <= 0.01 && rr > 0) {
            const cx = +(x + w / 2).toFixed(2), dRx = +(w / 2).toFixed(2), dRy = +(hh2 / 2).toFixed(2);
            d += 'M' + cx + ',' + y + 'a' + dRx + ',' + dRy + ' 0 1 1 0,' + +(dRy * 2).toFixed(2) + 'a' + dRx + ',' + dRy + ' 0 1 1 0,-' + +(dRy * 2).toFixed(2) + 'Z';
          } else {
            const x0 = +(x + rr).toFixed(2);
            d += 'M' + x0 + ',' + y;
            if (lineW > 0.01) d += 'h' + lineW;
            if (rr > 0) d += 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',' + rr;
            if (lineH > 0.01) d += 'v' + lineH;
            if (rr > 0) d += 'a' + rr + ',' + rr + ' 0 0 1 -' + rr + ',' + rr;
            if (lineW > 0.01) d += 'h-' + lineW;
            if (rr > 0) d += 'a' + rr + ',' + rr + ' 0 0 1 -' + rr + ',-' + rr;
            if (lineH > 0.01) d += 'v-' + lineH;
            if (rr > 0) d += 'a' + rr + ',' + rr + ' 0 0 1 ' + rr + ',-' + rr;
            d += 'Z';
          }
        });
        const url = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + vbW + ' ' + barH + '" preserveAspectRatio="none" shape-rendering="geometricPrecision">' + clipDef + '<path' + clipAttr + ' fill="black" fill-rule="evenodd" d="' + d + '"/></svg>') + '")';
        if (cacheBox) { cacheBox._mKey = maskKey; cacheBox._mVal = url; }
        return url;
      };
      const m0 = vis0 ? holeMask(Pprev, -W * .28 * (1 - pp), splitNum, tbPrev) : 'none';
      const m1 = vis1 ? holeMask(P, -splitNum, W - splitNum, tbCurr) : 'none';
      const applySpanMask = (spans, m, key, box) => {
        if (box[key] === m) return;
        box[key] = m;
        spans.forEach((sp, i) => {
          const g = _TOPBAR_GRAD[i];
          if (m === 'none') {
            const v = g || 'none';
            sp.style.webkitMaskImage = v; sp.style.maskImage = v;
            sp.style.webkitMaskComposite = ''; sp.style.maskComposite = '';
          } else if (g) {
            const v = g + ', ' + m;
            sp.style.webkitMaskImage = v; sp.style.maskImage = v;
            sp.style.webkitMaskComposite = 'source-in'; sp.style.maskComposite = 'intersect';
          } else {
            sp.style.webkitMaskImage = m; sp.style.maskImage = m;
          }
        });
      };
      applySpanMask(tb._spansPrev, m0, '_m', tbPrev);
      applySpanMask(tb._spansCurr, m1, '_m', tbCurr);
    }
  }
  {
    c.save(); c.globalAlpha = 1;
    const root = st.length === 1, title = NAV_TITLED[P.kind] ? P.data.title : null;
    const pp = NAV.popP, trans = !root && pp > .001, rootBar = (P0, withTitle) => {
      const tp = tbP(P0), tbn = topBtns(tp), av = tbn.av, mo = tbn.mo, sc2 = tbn.s;
      if (NAV.tab === 'home') {
        if (typeof FALLBACK !== 'undefined' && FALLBACK) {
          c.beginPath(); c.arc(av.x + av.w / 2, av.y + av.h / 2, av.w / 2, 0, 7);
          c.fillStyle = pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.60)'; c.fill();
          c.lineWidth = 1; c.strokeStyle = pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)'; c.stroke();
        }
        icon(c, 'gear', av.x + av.w / 2, av.y + av.h / 2, 19 * sc2, pageIco(P0), { lw: 1.85 });
      } else if (NAV.tab === 'library') {
        [ [mo, 'stats'], [av, NAV.libGrid ? 'queue' : 'grid4'] ].forEach(([b, ic]) => {
          icon(c, ic, b.x + b.w / 2, b.y + b.h / 2, 19 * sc2, pageIco(P0));
        });
      }
      if (withTitle) {
        const rt = { home: window.t('tab.home'), new: window.t('tab.new'), radio: window.t('tab.radio'), library: window.t('tab.library'), search: window.t('tab.search') }[NAV.tab], scT = mix(1, 24 / 34, tp);
        c.save();
        c.translate(20, mix(TOP + 38, TOP + 33, tp));
        if (scT < 0.9995) c.scale(scT, scT);
        txt(c, rt, 0, 0, F(700, 34), pal.fg, 'left');
        c.restore();
      }
    };
    const subBar = P0 => {
      const ic0 = pageIco(P0), t0 = NAV_TITLED[P0.kind] ? P0.data.title : null;
      icon(c, 'chevl', LAY.back.x + 21, LAY.back.y + 22, 21, ic0, { lw: 2.5 });
      if (t0) txt(c, t0, W / 2, TOP + 33, F(600, 17), pal.fg, 'center');
      if (hasPill(P0)) {
        const hb0 = heroBtnState(P0, dock(), 1);
        if (hb0) {
          c.save(); c.globalAlpha = hb0.al;
          icon(c, 'shuffle', hb0.x0 + hb0.d / 2, hb0.y + hb0.d / 2, 20, ic0, { lw: 2 });
          drawHeroDownloadBtn(c, hb0, P0, ic0);
          c.restore();
        }
        const ap0 = pillRect(P0), e0 = ap0.e, qt0 = ap0.qt, da0 = clamp(1 - e0 * 2.4, 0, 1);
        c.save(); rrPath(c, ap0.x, ap0.y, ap0.w, ap0.h, ap0.h / 2); c.clip();
        if (qt0 < .99) {
          c.globalAlpha = 1 - qt0;
          icon(c, 'search', mix(ap0.x + 27, ap0.x + ap0.w / 2, e0), ap0.y + 22, 20, ic0, { lw: 2.3 });
          if (da0 > .01) { c.globalAlpha = da0 * (1 - qt0); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(ap0.x + 53.5, ap0.y + 11, 1, 22); icon(c, 'dots', ap0.x + ap0.w - 28, ap0.y + 22, 20, ic0); }
        }
        if (qt0 > .01) { c.globalAlpha = qt0; icon(c, 'x', ap0.x + ap0.w / 2, ap0.y + 22, 13, ic0, { lw: 2.4 }); }
        c.restore();
        if (qt0 > .01) {
          const ps0 = pSearchRect(P0), pq0 = P0.q || '', pSub0 = pageSubIco(P0);
          c.save(); c.globalAlpha = qt0; rrPath(c, ps0.x, ps0.y, ps0.w, ps0.h, ps0.h / 2); c.clip();
          icon(c, 'search', ps0.x + 22, ps0.y + 22, 18, pSub0, { lw: 2.2 });
          const mw0 = ps0.w - 56;
          if (pq0) txt(c, pq0, ps0.x + 42, ps0.y + 28, F(400, 16.5), ic0, 'left', mw0);
          else txt(c, window.t('nav.search_tracks_hint'), ps0.x + 42, ps0.y + 28, F(400, 16.5), pSub0, 'left', mw0);
          c.restore();
        }
        drawHeroTopTitle(c, P0, ic0, qt0);
      }
    };
    if (root) { if (NAV.tab !== 'search') rootBar(P, true); }
    else {
      if (trans) {
        c.save(); c.beginPath(); c.rect(0, 0, pp * W, H); c.clip(); c.translate(-W * .28 * (1 - pp), 0);
        if (st.length === 2) { if (NAV.tab !== 'search') rootBar(st[0], true); }
        else subBar(st[st.length - 2]);
        c.restore();
      }
      c.save(); c.translate(pp * W, 0);
      const icCol = pageIco(P);
      icon(c, 'chevl', LAY.back.x + 21, LAY.back.y + 22, 21, icCol, { lw: 2.5 });
      if (title) txt(c, title, W / 2, TOP + 33, F(600, 17), pal.fg, 'center');
      if (hasPill(P)) {
        const hb = heroBtnState(P, dock(), 1);
        if (hb) {
          c.save(); c.globalAlpha = hb.al;
          icon(c, 'shuffle', hb.x0 + hb.d / 2, hb.y + hb.d / 2, 20, icCol, { lw: 2 });
          drawHeroDownloadBtn(c, hb, P, icCol);
          c.restore();
        }
        const ap = pillRect(P), e = ap.e, qt = ap.qt, da = clamp(1 - e * 2.4, 0, 1); c.save(); rrPath(c, ap.x, ap.y, ap.w, ap.h, ap.h / 2); c.clip();
        if (qt < .99) {
          c.globalAlpha = 1 - qt;
          icon(c, 'search', mix(ap.x + 27, ap.x + ap.w / 2, e), ap.y + 22, 20, icCol, { lw: 2.3 });
          if (da > .01) { c.globalAlpha = da * (1 - qt); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(ap.x + 53.5, ap.y + 11, 1, 22); icon(c, 'dots', ap.x + ap.w - 28, ap.y + 22, 20, icCol); }
        }
        if (qt > .01) { c.globalAlpha = qt; icon(c, 'x', ap.x + ap.w / 2, ap.y + 22, 13, icCol, { lw: 2.4 }); }
        c.restore();
        if (qt > .01) {
          const ps = pSearchRect(P), pq = P.q || '', pSub = pageSubIco(P);
          c.save(); c.globalAlpha = qt; rrPath(c, ps.x, ps.y, ps.w, ps.h, ps.h / 2); c.clip();
          icon(c, 'search', ps.x + 22, ps.y + 22, 18, pSub, { lw: 2.2 });
          const mw = ps.w - 56;
          if (pq) txt(c, pq, ps.x + 42, ps.y + 28, F(400, 16.5), icCol, 'left', mw);
          else txt(c, window.t('nav.search_tracks_hint'), ps.x + 42, ps.y + 28, F(400, 16.5), pSub, 'left', mw);
          if (NAV.focus && performance.now() % 1000 < 520) {
            c.font = F(400, 16.5); const cx = ps.x + 42 + (pq ? Math.min(c.measureText(pq).width, mw) : -1);
            c.fillStyle = icCol; c.fillRect(cx, ps.y + 11, 2, 22);
          }
          c.restore();
        }
        drawHeroTopTitle(c, P, icCol, qt);
      }
      c.restore();
    }
    c.restore();
  }
  const _trOv = tabTransState();
  const _oyOv = shY(), _shOpenOv = SH.t > .002 || SH.drag, _shRadOv = 46 * (1 - clamp((SH.t - .9) / .1, 0, 1));
  if (typeof SET_GLASS !== 'undefined' && SET_GLASS.length) {
    SET_GLASS.forEach(it => {
      if (it.kind !== 'prevBar') return;
      const topLim = TOP + 48;
      const op = clamp((it.y - topLim) / 18, 0, 1) * clamp(1 - NAV.popP, 0, 1) * (_trOv.on ? _trOv.al : 1);
      if (op <= .01 || (_shOpenOv && _oyOv + _shRadOv <= it.y - 16)) return;
      c.save();
      c.globalAlpha = op;
      c.beginPath(); c.rect(0, topLim, W, H - topLim); c.clip();
      if (_trOv.on) {
        c.translate(W / 2 + _trOv.dx, H / 2); c.scale(_trOv.sc, _trOv.sc); c.translate(-W / 2, -H / 2);
      }
      rrPath(c, it.cardX, it.cardY, it.cardW, it.cardH, 24); c.clip();
      if (it.pPP > .012) {
        const ex = new Path2D();
        ex.rect(-20, -20, W + 40, H + 40);
        ex.roundRect(it.bCx - it.bHw, it.bCy - it.bHh, 2 * it.bHw, 2 * it.bHh, it.bHh);
        c.clip(ex, 'evenodd');
        barBloom(c, { cx: it.bCx }, { x: it.x, y: it.y, w: it.w, h: it.h }, it.bCy, clamp(it.pPP, 0, 1));
      }
      prevBarGlyphs(c, it, true, 0);
      c.restore();
    });
    const gTopLim = TOP + 48;
    const gShY = _shOpenOv ? (_oyOv + _shRadOv) : (H + 40);
    const gDkV = dockVis();
    const gDkTop = (cur() ? dock().mini.y : dock().search.y) + shVis * 120;
    const gDkLim = gDkV > .05 ? Math.min(gShY, gDkTop - 4) : gShY;
    if (gDkLim > gTopLim + 2) {
      const popFade = clamp(1 - NAV.popP, 0, 1);
      const gClipItem = (it, fn) => {
        const isUnder = !!it.under;
        const itemTopLim = it.topLim != null ? it.topLim : gTopLim;
        const itemTopFade = it.topFade != null ? it.topFade : (TOP + 34);
        const trItem = (!isUnder && _trOv.on) ? _trOv : null;
        const tBox = trItem ? _tabRect(0, it.y, W, it.h, trItem) : { y: it.y, h: it.h };
        const op = clamp((it.y - itemTopFade) / 18, 0, 1) * (isUnder ? 1 : popFade) * (trItem ? trItem.al : 1);
        const aboveSh = !_shOpenOv || (_oyOv + _shRadOv > tBox.y - 16);
        if (op <= .01 || tBox.y >= gDkLim || tBox.y + tBox.h <= itemTopLim || !aboveSh) return;
        c.save();
        c.globalAlpha = op;
        c.beginPath(); c.rect(0, itemTopLim, W, gDkLim - itemTopLim); c.clip();
        if (NAV.popP > .001) {
          c.beginPath();
          if (isUnder) c.rect(0, 0, NAV.popP * W, H);
          else c.rect(NAV.popP * W, 0, W - NAV.popP * W, H);
          c.clip();
        }
        if (trItem) {
          c.translate(W / 2 + trItem.dx, H / 2); c.scale(trItem.sc, trItem.sc); c.translate(-W / 2, -H / 2);
        }
        fn(op);
        c.restore();
      };
      SET_GLASS.forEach(it => {
        if (it.kind === 'recapMonth') {
          gClipItem(it, () => {
            icon(c, 'chevl', it.x + 24, it.y + it.h / 2, 16, it.canPrev ? '#ffffff' : 'rgba(255,255,255,.35)', { lw: 2.3 });
            icon(c, 'chev', it.x + it.w - 24, it.y + it.h / 2, 16, it.canNext ? '#ffffff' : 'rgba(255,255,255,.35)', { lw: 2.3 });
            c.save();
            rrPath(c, it.x + 30, it.y, Math.max(0, it.w - 60), it.h, it.h / 2); c.clip();
            if (it.slideP < 1) { c.globalAlpha *= (0.2 + 0.8 * it.ep); c.translate((it.dir || 0) * 10 * (1 - it.ep), 0); }
            txt(c, it.label, it.x + it.w / 2, it.y + it.h / 2 + 6, F(700, 17.5), '#ffffff', 'center', Math.max(40, it.w - 64));
            c.restore();
          });
        } else if (it.kind === 'recapPlay') {
          gClipItem(it, () => {
            if (it.alpha != null) c.globalAlpha *= it.alpha;
            icon(c, 'play', it.cx, it.cy, 17 * (it.sc || 1), '#ffffff', { fill: true });
          });
        } else if (it.kind === 'filterRail' && it.chips) {
          gClipItem(it, () => {
            const actSc = it.actSc || 1;
            const actW = it.actW * actSc, actH = it.h * actSc;
            const actX = it.actX + (it.actW - actW) / 2, actY = it.y + (it.h - actH) / 2;
            c.save();
            const exClip = new Path2D();
            exClip.rect(-20, it.y - 8, W + 40, it.h + 16);
            exClip.roundRect(actX, actY, actW, actH, actH / 2);
            c.clip(exClip, 'evenodd');
            it.chips.forEach(ch => {
              const sc = ch.sc || 1;
              c.save();
              if (sc !== 1) { c.translate(ch.x + ch.w / 2, it.y + it.h / 2); c.scale(sc, sc); c.translate(-(ch.x + ch.w / 2), -(it.y + it.h / 2)); }
              txt(c, ch.label, ch.x + ch.w / 2, it.y + 23, F(500, 14.5), pal.fg, 'center');
              c.restore();
            });
            c.restore();
            c.save();
            rrPath(c, actX, actY, actW, actH, actH / 2); c.clip();
            it.chips.forEach(ch => {
              if (ch.x + ch.w <= actX || ch.x >= actX + actW) return;
              c.save();
              if (actSc !== 1) { c.translate(ch.x + ch.w / 2, it.y + it.h / 2); c.scale(actSc, actSc); c.translate(-(ch.x + ch.w / 2), -(it.y + it.h / 2)); }
              txt(c, ch.label, ch.x + ch.w / 2, it.y + 23, F(600, 14.5), '#ffffff', 'center');
              c.restore();
            });
            c.restore();
          });
        } else if (it.kind === 'segPill' && it.opts) {
          gClipItem(it, () => {
            const iw = (it.rw - 6) / it.opts.length;
            it.opts.forEach(([id, lb], i) => {
              const ix = it.rx + 3 + i * iw;
              const prox = clamp(1 - Math.abs(it.animIdx - i), 0, 1);
              const sel = prox > .5;
              const col = sel ? pal.fg : pal.sub;
              txt(c, lb, ix + iw / 2, it.ry + 24, F(sel ? 600 : 500, 13.5), col, 'center', iw - 4);
            });
          });
        }
      });
    }
  }
  const dkV = dockVis(), kDock = k * dkV;
  if (kDock > .01) {
    c.save(); c.globalAlpha = kDock;
    if (!BARC.init) stepBarCols(0);
    const dy = shVis * 120, tb = LAY.tab, dk = dock(), e = dk.e, idx = TABS.findIndex(x => x[0] === NAV.tab), hi = rgba4(BARC.pillBg);
    const tw = LAY.tabs[0].w, px = LAY.tabs[0].x + SP.tab.x * tw, bFg = barIco(false), bSub = barIco(true), actCol = navAccent();
    const dkbY = dk.tab.y - tb.y;
    c.save(); c.translate(0, dy);
    const ae = clamp(1 - e * 2.2, 0, 1);
    if (ae > .01) {
      c.save(); c.globalAlpha = kDock * ae;
      c.translate(0, dkbY);
      if (bubbleOn()) { const bb = bubble(), cy = tb.y + tb.h / 2, ex = new Path2D(); ex.rect(-20, -20, W + 40, H + 40); ex.roundRect(bb.cx - bb.hw, cy - bb.hh, 2 * bb.hw, 2 * bb.hh, bb.hh); c.clip(ex, 'evenodd'); barBloom(c, bb, tb, cy, clamp(bb.pp, 0, 1)); }
      barGlyphs(c, true);
      c.restore();
    }
    const ce = clamp(e * 2.2 - 1.2, 0, 1);
    if (ce > .01) {
      const inS = idx < 0, ti = TABS[inS ? Math.max(0, TABS.findIndex(x => x[0] === NAV.last)) : idx], hx = dk.tab.x + dk.tab.w / 2, hy = dk.tab.y + dk.tab.h / 2; c.save(); c.globalAlpha = kDock * ce;
      if (!inS) { c.fillStyle = hi; c.beginPath(); c.arc(hx, hy, dk.tab.h / 2 - 3, 0, 7); c.fill(); }
      icon(c, ti[2], hx, hy, 22, inS ? bFg : actCol); c.restore();
    }
    const s = dk.search, sm = dk.sm, sy = s.y + s.h / 2;
    if (NAV.tab === 'search' && sm < .98) { c.save(); c.globalAlpha = kDock * (1 - sm); c.fillStyle = hi; c.beginPath(); c.arc(s.x + s.w / 2, sy, s.h / 2 - 3, 0, 7); c.fill(); c.restore(); }
    icon(c, 'search', mix(s.x + s.w / 2, s.x + 25, sm), sy, mix(mix(23, 21, e), 19.5, sm), sm > .5 ? bSub : NAV.tab === 'search' ? actCol : bSub);
    if (sm > .5) {
      const fa = clamp(sm * 2.4 - 1.4, 0, 1), q = NAV.query; c.save(); c.globalAlpha = kDock * fa; rrPath(c, s.x, s.y, s.w, s.h, s.h / 2); c.clip();
      const mw = s.w - 48 - (q ? 44 : 20); if (q) txt(c, q, s.x + 48, sy + 6, F(400, 17), fgG(), 'left', mw); else txt(c, window.t('nav.search_all_hint'), s.x + 48, sy + 6, F(400, 17), subG(), 'left', mw);
      if (NAV.focus && performance.now() % 1000 < 520) { c.font = F(400, 17); const cx = s.x + 48 + (q ? Math.min(c.measureText(q).width, mw) : -2); c.fillStyle = fgG(); c.fillRect(cx + 1, sy - 11, 2, 22); }
      if (q) { c.fillStyle = pal.sub2; c.beginPath(); c.arc(s.x + s.w - 28, sy, 9, 0, 7); c.fill(); icon(c, 'x', s.x + s.w - 28, sy, 9, pal.dark ? '#000' : '#fff', { lw: 3.2 }); }
      c.restore();
    }
    const miniDispTr = t || (NAV.miniDismissT > 0.01 ? NAV.miniDismissTr : null);
    const miniDy = t ? (NAV.miniDy || 0) : (NAV.miniDismissY || 0);
    const miniDropA = t ? clamp(1 - Math.max(0, miniDy) / 52, 0, 1) : clamp(NAV.miniDismissT || 0, 0, 1);
    if (miniDispTr && miniDropA > .01) {
      const em = dk.em, m = dk.mini, as = mix(36, 32, em), pl = mix(12, 10, em), tx = m.x + pl + as + mix(11, 10, em), mw = m.x + m.w - tx - (em > .5 ? 44 : 92) + 14;
      const mdx = NAV.miniDx || 0, mal = clamp(1 - Math.abs(mdx) / (m.w * .48), 0, 1);
      c.save(); c.translate(0, miniDy); c.globalAlpha = kDock * miniDropA;
      c.save(); rrPath(c, m.x, m.y, m.w, m.h, m.h / 2); c.clip();
      const bodySc = typeof pressScale === 'function' ? pressScale('mini:body') : 1;
      const bodyTa = typeof pressTint === 'function' ? pressTint('mini:body') : 0;
      if (bodyTa > 0) { c.fillStyle = (pal.dark ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + bodyTa.toFixed(4) + ')'; c.fillRect(m.x, m.y, m.w, m.h); }
      const rightEdge = m.x + m.w - (em > .5 ? 48 : 96);
      c.save(); c.beginPath(); c.rect(m.x, m.y, rightEdge - m.x, m.h); c.clip();
      if (bodySc !== 1) {
        const bCx = m.x + (rightEdge - m.x) * 0.5, bCy = m.y + m.h * 0.5;
        c.translate(bCx, bCy); c.scale(bodySc, bodySc); c.translate(-bCx, -bCy);
      }
      if (_miniTrans.tr && _miniTrans.t > 0.01) {
        const ot = _miniTrans.tr;
        c.save(); c.translate(_miniTrans.dx, 0); c.globalAlpha = kDock * _miniTrans.t * miniDropA;
        drawArt(c, ot, m.x + pl, m.y + (m.h - as) / 2, as, mix(7, 6, em));
        txt(c, ot.title, tx, m.y + m.h / 2 - mix(1.8, 1.5, em), F(600, +mix(14.5, 13.5, em).toFixed(2)), fgG(), 'left', mw); txt(c, subOfTrack(ot), tx, m.y + m.h / 2 + mix(15.5, 13.5, em), F(400, +mix(13.5, 12, em).toFixed(2)), subG(), 'left', mw);
        c.restore();
      }
      c.save();
      c.translate(mdx * .82, 0); c.globalAlpha = kDock * mal * miniDropA * (_miniTrans.t > 0.01 ? clamp(1 - _miniTrans.t * 0.35, 0, 1) : 1);
      drawArt(c, miniDispTr, m.x + pl, m.y + (m.h - as) / 2, as, mix(7, 6, em));
      txt(c, miniDispTr.title, tx, m.y + m.h / 2 - mix(1.8, 1.5, em), F(600, +mix(14.5, 13.5, em).toFixed(2)), fgG(), 'left', mw); txt(c, subOfTrack(miniDispTr), tx, m.y + m.h / 2 + mix(15.5, 13.5, em), F(400, +mix(13.5, 12, em).toFixed(2)), subG(), 'left', mw);
      c.restore();
      c.restore();
      const btnX = mix(m.x + m.w - 72, m.x + m.w - 26, em), btnY = m.y + m.h / 2;
      const playSc = typeof pressScale === 'function' ? pressScale('mini:play') : 1;
      const playTa = typeof pressTint === 'function' ? pressTint('mini:play') : 0;
      c.save(); c.translate(btnX, btnY); c.scale(playSc, playSc);
      if (playTa > 0) { c.fillStyle = 'rgba(255,255,255,' + playTa.toFixed(4) + ')'; c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fill(); }
      icon(c, PL.playing ? 'pause' : 'play', 0, 0, mix(24, 21, em), bFg);
      c.restore();
      if (typeof isSpinnerActive === 'function' && isSpinnerActive()) {
        drawSpinnerRing(c, btnX, btnY, mix(17, 15, em), bFg, 2);
      }
      const na = clamp(1 - em * 2.2, 0, 1);
      if (na > .01) {
        const nxtSc = typeof pressScale === 'function' ? pressScale('mini:next') : 1;
        const nxtTa = typeof pressTint === 'function' ? pressTint('mini:next') : 0;
        c.save(); c.globalAlpha = kDock * na * miniDropA; c.translate(m.x + m.w - 32, m.y + m.h / 2); c.scale(nxtSc, nxtSc);
        if (nxtTa > 0) { c.fillStyle = 'rgba(255,255,255,' + nxtTa.toFixed(4) + ')'; c.beginPath(); c.arc(0, 0, 19, 0, 7); c.fill(); }
        icon(c, 'fwd', 0, 0, 25, bFg);
        c.restore();
      }
      c.restore();
      c.restore();
    }
    c.restore(); c.restore();
  }
  /* Clear the $top region covered by the rising Now Playing sheet before drawing sheet controls so the top bar stays crisp until covered */
  if (SH.t > .002 || SH.drag) {
    const oy = shY(), rad = 46 * (1 - clamp((SH.t - .9) / .1, 0, 1));
    c.save(); c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    rrPath(c, 0, oy, W, H + 80, rad); c.fill();
    c.restore();
  }
  OV_SHITS = [];
  if (SH.t > .01 && t) {
    const L = shLay(), oy = shY(); c.save(); c.translate(0, oy);
    const fav = PL.fav[t.id], pt = clamp(L.pt != null ? L.pt : (L.p || 0), 0, 1);
    const a0 = clamp(1 - pt * 1.5, 0, 1), a1 = clamp((pt - .25) * 1.35, 0, 1);
    const y0 = L.ty0_art + 8 + pt * 12, y1 = TOP + 54 + (1 - a1) * -14;
    const shFgInk = typeof shInk === 'function' ? shInk(t) : null;
    const shFg = shFgInk ? shFgInk.hi : '#fff';
    const drawShTopBtn = (key, x, y, drawFn) => {
      const sc = typeof pressScale === 'function' ? pressScale(key) : 1;
      const ta = typeof pressTint === 'function' ? pressTint(key) : 0;
      c.save();
      if (sc !== 1 || ta > 0) {
        c.translate(x, y); c.scale(sc, sc);
        if (ta > 0) { c.fillStyle = shFgInk ? shFgInk.rgba(ta.toFixed(4)) : ('rgba(255,255,255,' + ta.toFixed(4) + ')'); c.beginPath(); c.arc(0, 0, 17, 0, 7); c.fill(); }
        c.translate(-x, -y);
      }
      drawFn();
      c.restore();
    };
    if (a0 > .01) {
      c.save(); c.globalAlpha = a0;
      drawShTopBtn('sh:star', L.btnX[0], y0, () => icon(c, 'star', L.btnX[0], y0, 15.5, shFg, { fill: fav }));
      drawShTopBtn('sh:dots', L.btnX[1], y0, () => icon(c, 'dots', L.btnX[1], y0, 16, shFg));
      c.restore();
      if (pt < .5) {
        ovShit(L.btnX[0] - 20, y0 - 20, 40, 40, () => { PL.fav[t.id] = !PL.fav[t.id]; saveState(); redraw(); }, null, { pressKey: 'sh:star' });
        ovShit(L.btnX[1] - 20, y0 - 20, 40, 40, () => openCM(t, L.btnX[1], y0 + oy, 'player'), null, { pressKey: 'sh:dots' });
      }
    }
    if (a1 > .01) {
      c.save(); c.globalAlpha = a1;
      drawShTopBtn('sh:star', L.btnX[0], y1, () => icon(c, 'star', L.btnX[0], y1, 15.5, shFg, { fill: fav }));
      drawShTopBtn('sh:dots', L.btnX[1], y1, () => icon(c, 'dots', L.btnX[1], y1, 16, shFg));
      c.restore();
      if (pt >= .5) {
        ovShit(L.btnX[0] - 20, y1 - 20, 40, 40, () => { PL.fav[t.id] = !PL.fav[t.id]; saveState(); redraw(); }, null, { pressKey: 'sh:star' });
        ovShit(L.btnX[1] - 20, y1 - 20, 40, 40, () => openCM(t, L.btnX[1], y1 + oy, 'player'), null, { pressKey: 'sh:dots' });
      }
    }
    const isQueue = (SH.mode === 'queue') || (SH.mode === 'art' && SH.fromMode === 'queue');
    const isCross = (SH.mode === 'queue' && SH.fromMode === 'lyrics') || (SH.mode === 'lyrics' && SH.fromMode === 'queue');
    const qP = isCross ? (SH.qModeP != null ? SH.qModeP : (SH.mode === 'queue' ? 1 : 0)) : (isQueue ? 1 : 0);
    if ((isQueue || (isCross && qP > .02)) && (L.p || 0) > .25) {
      const qAlpha = isCross ? qP : 1;
      const totalAlpha = clamp(qAlpha * ((L.p || 0) - .2) * 2.5, 0, 1);
      if (totalAlpha > .01) {
        const pw = (W - 48 - 20) / 3, py = L.regTop - 4 + (1 - (isCross ? qP : clamp(L.p, 0, 1))) * 14;
        c.save(); c.globalAlpha = totalAlpha;
        [['shuffle', PL.shuffle, SP.sP1.x], ['repeat', PL.repeat > 0, SP.sP2.x], ['infinity', PL.infinity, SP.sP3.x]].forEach(([ic, on, spk], i) => {
          const x = 24 + i * (pw + 10);
          const k = clamp(spk, 0, 1);
          const sc = 1 + Math.sin(k * Math.PI) * .09;
          c.save();
          c.translate(x + pw / 2, py + 21);
          c.scale(sc, sc);
          if (i === 0 && PL.shuffle && PL.smartShuffle) {
            icon(c, ic, -4, 0, 21, shFg);
            icon(c, 'spark', 13, -7, 11, shFg, { fill: true });
          } else {
            icon(c, ic, 0, 0, 22, shFg, { one: ic === 'repeat' && PL.repeat === 2 });
          }
          c.restore();
        });
        c.restore();
      }
    }
    if (SRCUI.t > .01 && SH.lyStyleBtns && !(typeof FALLBACK !== 'undefined' && FALLBACK)) {
      const sb = SH.lyStyleBtns, alSt = L.alone || 0, ctrlA = (1 - alSt) * (1 - alSt);
      const sbAlpha = (sb.alpha != null ? sb.alpha : 1) * ctrlA;
      if (sbAlpha > .01) {
        const curSt = SRCUI.style || 'anim';
        [['anim', window.t('lyrics.style_animated'), 0], ['classic', window.t('lyrics.style_classic'), 1]].forEach(([id, lb, idx]) => {
          const sel = curSt === id;
          const cx = sb.x + idx * (sb.pw + sb.gap) + sb.pw / 2;
          const cy = sb.y + alSt * 40 + sb.ph / 2;
          c.save();
          c.globalAlpha *= sbAlpha;
          txt(c, lb, cx, cy + 5.5, F(sel ? 600 : 500, 15.5), '#ffffff', 'center', sb.pw - 12);
          c.restore();
        });
      }
    }
    c.restore();
  }
  /* Clear only the ··· modal or Appearance menu rect from $top before drawing modal contents so icons outside remain visible and none bleed through */
  if (CM.sp.x > .02 && CM.tr) {
    const cg = cmGeom();
    c.save(); c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,' + clamp(cg.al * 1.15, 0, 1).toFixed(3) + ')';
    rrPath(c, cg.x, cg.y, cg.w, cg.h, cg.rad); c.fill();
    c.restore();
  }
  if (OUT_DRAWER.sp.x > .005) {
    const og = outDrawerGeom();
    if (og.y < H + 4) {
      const visH = Math.max(og.h, H - og.y);
      c.save(); c.globalCompositeOperation = 'destination-out';
      c.fillStyle = 'rgba(0,0,0,' + clamp(og.al * 1.15, 0, 1).toFixed(3) + ')';
      rrTopPath(c, og.x, og.y, og.w, visH, og.rad); c.fill();
      c.restore();
    }
  }
  if (MENU_SP.x > .005) {
    const mg = menuGeom();
    c.save(); c.globalCompositeOperation = 'destination-out';
    c.fillStyle = 'rgba(0,0,0,' + clamp(mg.al * 1.15, 0, 1).toFixed(3) + ')';
    rrPath(c, mg.x, mg.y, mg.w, mg.h, mg.rad); c.fill();
    c.restore();
  }
  if (CM.sp.x > .005 && CM.tr) {
    const g = cmGeom(), ct = cmTheme(CM.tr), r = CM.r, t2 = CM.tr;
    const rx = g.rx, ry = g.ry, rw = g.rw, rh = g.rh;
    const al = clamp(g.raw * 1.6 - .08, 0, 1);
    if (al > .01) {
      c.save();
      const bd = new Path2D();
      bd.rect(0, 0, W, H);
      bd.roundRect(g.x, g.y, g.w, g.h, g.rad);
      c.fillStyle = 'rgba(0,0,0,' + ((ct.dark ? .38 : .22) * al).toFixed(3) + ')';
      c.fill(bd, 'evenodd');
      c.restore();

      c.save();
      rrPath(c, g.x, g.y, g.w, g.h, g.rad); c.clip();
      c.globalAlpha = al;
      c.translate(g.cx, g.cy); c.scale(g.kx, g.ky); c.translate(-(rx + rw / 2), -(ry + rh / 2));
      c.fillStyle = ct.headBg;
      rrPath(c, rx + 8, ry + 8, rw - 16, 64, 20); c.fill();
      drawArt(c, t2, rx + 16, ry + 16, 48, t2.kind === 'artist' ? 24 : 10);
      const titleStr = CM.mode === 'playlists' ? window.t('cm.add_to_playlist')
        : CM.mode === 'sleep_timer' ? window.t('cm.sleep_timer')
        : t2.title;
      const subStr = CM.mode === 'playlists' ? t2.title
        : CM.mode === 'sleep_timer' ? (PL.sleepActive ? (PL.sleepMode === 'end' ? window.t('cm.sleep_eom_full') : window.t('cm.sleep_in_min', { count: Math.max(1, Math.ceil((PL.sleepRemSec || 0) / 60)) })) : window.t('cm.pause_playback'))
        : cmSub(t2);
      const canBack = CM.mode && CM.mode !== 'menu';
      const showPlayBtn = cmCanPlayNow(t2, CM.ctx);
      const cmMaxW = showPlayBtn ? (rw - 166) : (rw - 126);
      txt(c, titleStr, rx + 76, ry + 35, F(600, 16.5), ct.fg, 'left', cmMaxW);
      txt(c, subStr, rx + 76, ry + 55, F(400, 13.5), ct.sub, 'left', cmMaxW);
      const btnBase = ct.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)';
      const btnPress = ct.dark ? 'rgba(255,255,255,.20)' : 'rgba(0,0,0,.14)';
      const cxBtn = rx + rw - 30, cyBtn = ry + 40;
      if (showPlayBtn) {
        const pxBtn = cxBtn - 36, pyBtn = cyBtn;
        c.fillStyle = CM.pressRow === -4 ? btnPress : btnBase;
        c.beginPath(); c.arc(pxBtn, pyBtn, 14, 0, Math.PI * 2); c.fill();
        icon(c, 'play', pxBtn + 0.8, pyBtn, 11.5, ct.fg);
      }
      c.fillStyle = CM.pressRow === -2 ? btnPress : btnBase;
      c.beginPath(); c.arc(cxBtn, cyBtn, 14, 0, Math.PI * 2); c.fill();
      icon(c, canBack ? 'chevl' : 'x', cxBtn, cyBtn, canBack ? 14 : 10.5, ct.sub, { lw: 2.2 });

      const mf = clamp(CM.fade != null ? CM.fade : 1, 0, 1);
      const drawCmList = (listItems, listAlpha, yShift, showPress) => {
        if (listAlpha <= 0.01) return;
        c.save();
        c.globalAlpha *= listAlpha;
        c.beginPath(); c.rect(rx, ry + CM_HEAD, rw, Math.max(0, rh - CM_HEAD)); c.clip();
        listItems.forEach(([lb, ic, actKey, isDestructive], i) => {
          const y = ry + CM_HEAD + i * CM_ROW + yShift;
          const pA = showPress ? ((CM.pressRow >= 0 ? CM.pressRow === i : CM.prevPressRow === i) ? (CM.pressA || 0) : 0) : 0;
          if (pA > 0.01) {
            c.save(); c.globalAlpha *= pA;
            c.fillStyle = ct.pressBg; rrPath(c, rx + 8, y + 3, rw - 16, CM_ROW - 6, 14); c.fill();
            c.restore();
          }
          c.fillStyle = ct.sep;
          c.fillRect(rx + 18, y, rw - 36, .5);
          const itemCol = isDestructive ? '#ff453a' : ct.fg;
          txt(c, lb, rx + 20, y + 31, F(500, 16.5), itemCol, 'left', rw - 72);
          const ix = rx + rw - 32, iy = y + CM_ROW / 2;
          const isFav = ic === 'star' && PL.fav[t2.id];
          const iconCol = isDestructive ? '#ff453a' : (isFav ? ct.accent : ct.fg);
          icon(c, ic, ix, iy, ic === 'fwd' ? 18 : 19, iconCol, { fill: isFav, lw: 2 });
        });
        c.restore();
      };
      if (CM.prevMode && mf < 0.99) {
        const curMode = CM.mode;
        let prevItems = [];
        try { CM.mode = CM.prevMode; prevItems = cmItems(t2, CM.ctx, CM.meta); } finally { CM.mode = curMode; }
        drawCmList(prevItems, 1 - mf, -6 * mf, false);
      }
      drawCmList(cmItems(t2, CM.ctx, CM.meta), mf, (1 - mf) * 6, true);
      c.restore();
    }
  }
  if (OUT_DRAWER.sp.x > .005) {
    const g = outDrawerGeom(), ct = cmTheme(null);
    const al = clamp(g.raw * 1.6 - .02, 0, 1);
    if (al > .01 && g.y < H + 4) {
      const visH = Math.max(g.h, H - g.y);
      c.save();
      const bd = new Path2D();
      bd.rect(0, 0, W, H);
      _rrTopSub(bd, g.x, g.y, g.w, visH, g.rad);
      c.fillStyle = 'rgba(0,0,0,' + ((ct.dark ? .44 : .26) * al).toFixed(3) + ')';
      c.fill(bd, 'evenodd');
      c.restore();

      c.save();
      rrTopPath(c, g.x, g.y, g.w, visH, g.rad); c.clip();
      c.globalAlpha = al;
      rrPath(c, g.x + g.w / 2 - 19, g.y + 8, 38, 4.5, 2.25);
      c.fillStyle = ct.dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.20)';
      c.fill();
      c.fillStyle = ct.headBg;
      rrPath(c, g.x + 8, g.y + 18, g.w - 16, 60, 20); c.fill();
      rrPath(c, g.x + 16, g.y + 26, 44, 44, 12);
      const outBtnBase = ct.dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.06)';
      const outBtnPress = ct.dark ? 'rgba(255,255,255,.20)' : 'rgba(0,0,0,.14)';
      c.fillStyle = outBtnBase;
      c.fill();
      icon(c, 'airplay', g.x + 38, g.y + 48, 21, ct.accent);
      const hasSysOut = typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.openSystemOutputSwitcher === 'function';
      const outMaxW = hasSysOut ? (g.w - 160) : (g.w - 122);
      txt(c, window.t('audio.output_header'), g.x + 72, g.y + 44, F(600, 16.5), ct.fg, 'left', outMaxW);
      txt(c, OUT_DRAWER.activeName || window.t('audio.android_system'), g.x + 72, g.y + 62, F(400, 13), ct.sub, 'left', outMaxW);
      const cxBtn = g.x + g.w - 30, cyBtn = g.y + 48;
      if (hasSysOut) {
        const bxBtn = cxBtn - 36, byBtn = cyBtn;
        c.fillStyle = OUT_DRAWER.pressRow === -4 ? outBtnPress : outBtnBase;
        c.beginPath(); c.arc(bxBtn, byBtn, 14, 0, Math.PI * 2); c.fill();
        icon(c, 'bt-gear', bxBtn, byBtn, 15, ct.sub, { lw: 1.65 });
      }
      c.fillStyle = OUT_DRAWER.pressRow === -2 ? outBtnPress : outBtnBase;
      c.beginPath(); c.arc(cxBtn, cyBtn, 14, 0, Math.PI * 2); c.fill();
      icon(c, 'x', cxBtn, cyBtn, 10.5, ct.sub, { lw: 2.2 });

      const rows = OUT_DRAWER.rows || [], rh = g.rowH;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const y = g.y + OUT_HEAD + i * rh;
        const pA = (OUT_DRAWER.pressRow >= 0 ? OUT_DRAWER.pressRow === i : OUT_DRAWER.prevPressRow === i) ? (OUT_DRAWER.pressA || 0) : 0;
        if (row.selected) {
          c.fillStyle = ct.dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.045)';
          rrPath(c, g.x + 8, y + 3, g.w - 16, rh - 6, 14); c.fill();
        }
        if (pA > 0.01) {
          c.save(); c.globalAlpha *= pA;
          c.fillStyle = ct.pressBg;
          rrPath(c, g.x + 8, y + 3, g.w - 16, rh - 6, 14); c.fill();
          c.restore();
        }
        if (i > 0) {
          c.fillStyle = ct.sep;
          c.fillRect(g.x + 18, y, g.w - 36, .5);
        }
        const rowCol = row.selected ? ct.accent : ct.fg;
        icon(c, row.icon, g.x + 32, y + rh / 2, 19, rowCol, { lw: row.selected ? 2.2 : 1.9 });
        txt(c, row.label, g.x + 56, y + rh / 2 + 5.5, F(row.selected ? 600 : 500, 16), rowCol, 'left', g.w - 98);
        if (row.selected) {
          icon(c, 'check', g.x + g.w - 30, y + rh / 2, 16, ct.accent, { lw: 2.4 });
        } else if (row.actKey === 'out_bt_sys') {
          icon(c, 'chev', g.x + g.w - 30, y + rh / 2, 13.5, ct.sub, { lw: 2 });
        }
      }
      c.restore();
    }
  }
  if (MENU_SP.x > .005) {
    const g = menuGeom(), ct = cmTheme(null), m = menuRect(), al = clamp(g.raw * 1.6 - .10, 0, 1);
    if (al > .01) {
      c.save();
      rrPath(c, g.x, g.y, g.w, g.h, g.rad); c.clip();
      c.globalAlpha = al;
      c.translate(g.ax, g.ay); c.scale(g.kx, g.ky); c.translate(-g.ax, -g.ay);
      txt(c, window.t('cm.appearance'), m.x + 18, m.y + 28, F(700, 12), ct.sub);
      getMenuItems().forEach(([lb, id], i) => {
        const y = m.y + 40 + i * 46, sel = themeMode === id;
        const pTa = typeof pressTint === 'function' ? pressTint('menu:' + i, 0.08) : 0;
        if (sel) { c.fillStyle = ct.headBg; rrPath(c, m.x + 8, y + 3, m.w - 16, 40, 12); c.fill(); }
        if (pTa > 0) { c.fillStyle = (ct.dark ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + pTa.toFixed(4) + ')'; rrPath(c, m.x + 8, y + 3, m.w - 16, 40, 12); c.fill(); }
        if (i) { c.fillStyle = ct.sep; c.fillRect(m.x + 18, y, m.w - 36, .5); }
        txt(c, lb, m.x + 18, y + 29, F(sel ? 600 : 400, 16.5), ct.fg);
        if (sel) icon(c, 'check', m.x + m.w - 28, y + 23, 16, ct.accent, { lw: 2.3 });
      });
      c.restore();
    }
  }
  if (_promptGlassVis && _promptGeom && !FALLBACK) {
    const pg = _promptGeom, ct = cmTheme(null), al = clamp(pg.op * 1.4 - .06, 0, 1);
    if (pg.w > 10 && al > .01) {
      c.save();
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = 'rgba(0,0,0,' + clamp(al * 1.15, 0, 1).toFixed(3) + ')';
      rrPath(c, pg.x, pg.y, pg.w, pg.h, pg.rad); c.fill();
      c.restore();

      c.save();
      const bd = new Path2D();
      bd.rect(0, 0, W, H);
      bd.roundRect(pg.x, pg.y, pg.w, pg.h, pg.rad);
      c.fillStyle = 'rgba(0,0,0,' + ((ct.dark ? .38 : .22) * al).toFixed(3) + ')';
      c.fill(bd, 'evenodd');
      c.restore();
    }
  }
  liveToastDraw(c);
  if (FRAME) { statusBar(c, SH.t > .5 ? '#fff' : pal.fg); c.fillStyle = '#000'; rrPath(c, W / 2 - 62, 12, 124, 36, 18); c.fill(); }
  return rimChanged;
}

function setG(g, r, vis, o) { g.set(Object.assign({ x: r.x, y: r.y, width: r.w, height: r.h, visible: vis }, o || {})); }
/* advance bar springs BEFORE drawing so the glass lens and refracted overlay share the same frame */
function stepNav(dt) {
  const idx = TABS.findIndex(x => x[0] === NAV.tab);
  if (!INP.thumb.on && idx >= 0) SP.tab.t = idx;
  const h0 = SP.hl.x, t0 = SP.tab.x, p0 = SP.tabP.x;
  SP.hl.t = clamp(SP.tab.t, 0, TABS.length - 1); SP.hl.step(dt); SP.tab.step(dt); SP.tabP.step(dt);
  const bc = stepBarCols(dt);
  if (SP.tab.busy || SP.tabP.busy || SP.hl.busy || SP.hl.x !== h0 || SP.tab.x !== t0 || SP.tabP.x !== p0 || bc) { D.ov = true; D.gl = true; }
}
/* cache HTML prompt modal DOM nodes to avoid 60fps querySelector/layout thrashing */
let _promptEl = null, _promptSheet = null, _promptInited = false, _promptGlassVis = false, _promptGeom = null, _lastPromptGeomKey = '';
function ensurePromptRefs() {
  if (_promptInited) return;
  _promptInited = true;
  if (typeof document !== 'undefined') {
    _promptEl = document.getElementById('sonoraPrompt');
    _promptSheet = _promptEl ? _promptEl.querySelector('.prompt-sheet') : null;
  }
}
function isSonoraPromptOpen() {
  const el = typeof document !== 'undefined' && document.getElementById('sonoraPrompt');
  return Boolean(el && el.style.display !== 'none' && (el.classList.contains('visible') || el.classList.contains('active')));
}
function syncPromptGeom() {
  ensurePromptRefs();
  if (_promptEl) _promptEl.classList.toggle('fallback-gl', !!FALLBACK);
  const pOpen = !!(_promptEl && _promptEl.style.display !== 'none');
  const pAnim = typeof window !== 'undefined' && typeof window._promptGlassAlpha === 'number' && window._promptGlassAlpha > 0.02;
  if (_promptSheet && (pOpen || pAnim)) {
    const pActive = _promptEl.classList.contains('visible') || _promptEl.classList.contains('active');
    if (pActive || pAnim) {
      const sr = _promptSheet.getBoundingClientRect();
      const or = OUT_RECT || $out.getBoundingClientRect();
      const cs = getComputedStyle(_promptSheet);
      const op = clamp(parseFloat(cs.opacity || (pActive ? '1' : '0')) || 0, 0, 1);
      window._promptGlassAlpha = op;
      const vis = op > .02 && sr.width > 10;
      const geom = { x: sr.left - or.left, y: sr.top - or.top, w: sr.width, h: sr.height, rad: 28, op };
      const key = vis ? `${geom.x.toFixed(1)},${geom.y.toFixed(1)},${geom.w.toFixed(1)},${geom.h.toFixed(1)},${op.toFixed(2)}` : '';
      const changed = key !== _lastPromptGeomKey || vis !== _promptGlassVis;
      _lastPromptGeomKey = key;
      _promptGlassVis = vis;
      _promptGeom = vis ? geom : null;
      return changed;
    }
  }
  const wasVis = _promptGlassVis || !!_promptGeom;
  _promptGlassVis = false;
  _promptGeom = null;
  _lastPromptGeomKey = '';
  if (typeof window !== 'undefined') window._promptGlassAlpha = 0;
  return wasVis;
}
function updateGlass(dt) {
  if (!BARC.init) stepBarCols(0);
  const shVis = clamp(1 - shY() / H, 0, 1);
  const k = clamp(1 - shVis * 3, 0, 1), dkV = dockVis(), kDock = k * dkV, dy = shVis * 120, vis = kDock > .02, st = stackOf(), root = st.length === 1, tb = LAY.tab, ch = false;
  const Ptop = topPage(), tn = !root ? tintOf(Ptop) : null;
  const topTint = tn ? tn.topTint : (pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.60)');
  const barTint = rgba4(BARC.topTint);
  const heroTint = tn ? tn.heroTint : topTint;
  const pHl = { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: tn ? tn.btnHl : undefined };
  const barHl = { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: BARC.t > .01 ? rgba4(BARC.btnHl) : undefined };
  const dk = dock();
  setG(G.tab, { x: dk.tab.x, y: dk.tab.y + dy, w: dk.tab.w, h: dk.tab.h }, vis, { opacity: kDock, tint: barTint, highlight: barHl });
  setG(G.search, { x: dk.search.x, y: dk.search.y + dy, w: dk.search.w, h: dk.search.h }, vis, { opacity: kDock, cornerRadius: dk.search.h / 2, tint: barTint, highlight: barHl });
  const hasCur = !!cur();
  const miniActiveVis = hasCur || (NAV.miniDismissT || 0) > 0.02;
  const miniDy = hasCur ? (NAV.miniDy || 0) : (NAV.miniDismissY || 0);
  const miniDropA = hasCur ? clamp(1 - Math.max(0, miniDy) / 52, 0, 1) : clamp(NAV.miniDismissT || 0, 0, 1);
  setG(G.mini, { x: dk.mini.x, y: dk.mini.y + dy + miniDy, w: dk.mini.w, h: dk.mini.h }, vis && miniActiveVis && miniDropA > .02, { opacity: kDock * miniDropA, cornerRadius: dk.mini.h / 2, tint: barTint, highlight: barHl });
  const bb = bubble(), pp = bb.pp, tcy = dk.tab.y + dk.tab.h / 2 + dy, on = pp > .01;
  setG(G.thumb, { x: bb.cx - bb.hw, y: tcy - bb.hh, w: 2 * bb.hw, h: 2 * bb.hh }, vis && dk.e < .05 && pp > .012, {
    press: pp, slosh: SP.tab.v * bb.tw * .02, opacity: clamp(pp * 5, 0, 1) * dkV, blur: 0, vibrancy: true,
    refractionHeight: 10 * pp, refractionAmount: 14 * pp, chromaticAberration: pp > .05, tint: null,
    highlight: on ? { style: 'default', width: .5, blurRadius: .25, alpha: pp } : null,
    shadow: on ? { radius: 24, offsetY: 4, color: 'rgba(0,0,0,.10)', alpha: pp } : null,
    innerShadow: on ? { radius: 8 * pp, offset: { x: 0, y: 8 * pp }, color: 'rgba(0,0,0,.15)', alpha: pp } : null,
    surfaceColor: 'rgba(0,0,0,' + (.03 * pp) + ')' });
  const oy = shY(), shOpen = SH.t > .002 || SH.drag, shRad = 46 * (1 - clamp((SH.t - .9) / .1, 0, 1));
  const clipSh = shOpen ? { y: oy, r: shRad } : null;
  const isAboveSheet = (y, h = 44) => !shOpen || (oy + shRad > y - 16);
  const trTab = tabTransState();
  {
    const items = typeof SET_GLASS !== 'undefined' ? SET_GLASS : [];
    const pv = items.find(it => it.kind === 'prevBar');
    const topLim = TOP + 48, popFade = clamp(1 - NAV.popP, 0, 1);
    if (pv) {
      const pvBox = trTab.on ? _tabRect(pv.x, pv.y, pv.w, pv.h, trTab) : { x: pv.x, y: pv.y, w: pv.w, h: pv.h };
      const pvOp = clamp((pv.y - topLim) / 18, 0, 1) * popFade * (trTab.on ? trTab.al : 1);
      const pvVis = pvOp > .02 && pvBox.y + pvBox.h < H + 40 && isAboveSheet(pvBox.y, pvBox.h);
      const pvPp = clamp(pv.pPP, 0, 1), pvOn = pvPp > .01;
      setG(G.setPrevBar, pvBox, pvVis, {
        opacity: pvOp, cornerRadius: pvBox.h / 2,
        tint: 'rgba(255,255,255,.16)',
        clipSheet: clipSh,
        highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 }
      });
      const thBox = trTab.on ? _tabRect(pv.bCx - pv.bHw, pv.bCy - pv.bHh, 2 * pv.bHw, 2 * pv.bHh, trTab) : { x: pv.bCx - pv.bHw, y: pv.bCy - pv.bHh, w: 2 * pv.bHw, h: 2 * pv.bHh };
      setG(G.setPrevThumb, thBox, pvVis && pvPp > .012, {
        press: pvPp, slosh: pv.slosh || 0, opacity: clamp(pvPp * 5, 0, 1) * pvOp,
        blur: 0, vibrancy: true, useOverlay: true, cornerRadius: thBox.h / 2,
        refractionHeight: 10 * pvPp, refractionAmount: 14 * pvPp, chromaticAberration: pvPp > .05, tint: null,
        clipSheet: clipSh,
        highlight: pvOn ? { style: 'default', width: .5, blurRadius: .25, alpha: pvPp } : null,
        shadow: pvOn ? { radius: 24, offsetY: 4, color: 'rgba(0,0,0,.12)', alpha: pvPp * pvOp } : null,
        innerShadow: pvOn ? { radius: 8 * pvPp, offset: { x: 0, y: 8 * pvPp }, color: 'rgba(0,0,0,.15)', alpha: pvPp * pvOp } : null,
        surfaceColor: 'rgba(0,0,0,' + (.03 * pvPp) + ')'
      });
    } else {
      G.setPrevBar.set({ visible: false });
      G.setPrevThumb.set({ visible: false });
    }
    const ctrls = items.filter(it => it.kind === 'toggle' || it.kind === 'slider' || it.kind === 'segPill');
    const bBlurS = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassBlur != null ? PREFS.glassBlur : 2);
    const rAmtS = PREFS.glassProfile === 'light' ? 0 : (PREFS.glassRefraction != null ? PREFS.glassRefraction : 24);
    const rH12S = PREFS.glassProfile === 'light' ? 0 : Math.round(rAmtS * (12 / 24));
    const chromS = PREFS.glassChromatic ? (PREFS.glassProfile === 'vivid' ? 1.0 : .8) : 0;
    for (let i = 0; i < 24; i++) {
      const g = G['setCtrl' + i], it = ctrls[i];
      if (!g) continue;
      if (!it) { g.set({ visible: false }); continue; }
      const isUnder = !!it.under;
      const trItem = (!isUnder && trTab.on) ? trTab : null;
      const cBox = trItem ? _tabRect(it.x, it.y, it.w, it.h, trItem) : { x: it.x, y: it.y, w: it.w, h: it.h };
      const slideClipMax = isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
      const slideClipMin = !isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
      const cOp = clamp((it.y - topLim) / 16, 0, 1) * (isUnder ? 1 : popFade) * (trItem ? trItem.al : 1);
      const cVis = cOp > .02 && cBox.y + cBox.h < H + 20 && cBox.y > topLim - 8 && (isUnder ? it.x < NAV.popP * W : cBox.x < W) && isAboveSheet(cBox.y, cBox.h);
      const cpp = clamp(it.pp || 0, 0, 1), cOn = cpp > .01;
      if (it.kind === 'toggle') {
        /* LiquidToggle: keep blur = 0 under the thumb (resting surfaceColor is opaque white) to avoid multipass FBO blur churn on toggle */
        setG(g, cBox, cVis, {
          opacity: cOp, cornerRadius: cBox.h / 2,
          blur: 0, vibrancy: true, useOverlay: true,
          refractionHeight: 5 * cpp, refractionAmount: 10 * cpp, chromaticAberration: cpp > .05 ? .8 : 0,
          tint: null,
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          surfaceColor: 'rgba(255,255,255,' + Math.max(0, 1 - cpp).toFixed(3) + ')',
          highlight: cOn ? { style: 'ambient', width: .33, blurRadius: .17, alpha: cpp } : false,
          innerShadow: cOn ? { radius: 4 * cpp, offset: { x: 0, y: 4 * cpp }, color: 'rgba(0,0,0,.15)', alpha: cpp } : null,
          shadow: { radius: 4, offsetY: 2, color: 'rgba(0,0,0,.10)', alpha: cOp }
        });
      } else if (it.kind === 'segPill') {
        setG(g, cBox, cVis, {
          opacity: cOp, cornerRadius: 9.5 * (trItem ? trItem.sc : 1),
          blur: bBlurS, vibrancy: true, useOverlay: false,
          refractionHeight: rH12S, refractionAmount: rAmtS, chromaticAberration: chromS,
          surfaceColor: null,
          tint: pal.dark ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.82)',
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          highlight: { width: 1.0, blurRadius: 0.5, alpha: 0.5, style: 'default', angle: 45, falloff: 1.0 },
          innerShadow: null,
          shadow: { radius: 12, offsetY: 2, color: pal.dark ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.10)', alpha: cOp }
        });
      } else {
        setG(g, cBox, cVis, {
          opacity: cOp, cornerRadius: Math.min(cBox.w, cBox.h) / 2,
          blur: 0, vibrancy: true, useOverlay: false,
          refractionHeight: 10 * cpp, refractionAmount: 14 * cpp, chromaticAberration: cpp > .05 ? .8 : 0,
          tint: null,
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          surfaceColor: 'rgba(255,255,255,' + Math.max(0, 1 - cpp).toFixed(3) + ')',
          highlight: cOn ? { style: 'ambient', width: .33, blurRadius: .25, alpha: cpp * .35 } : false,
          innerShadow: cOn ? { radius: 4 * cpp, offset: { x: 0, y: 4 * cpp }, color: 'rgba(0,0,0,.15)', alpha: cpp * .2 } : null,
          shadow: { radius: 4, offsetY: 2, color: 'rgba(0,0,0,.10)', alpha: cOp }
        });
      }
    }
  }
  {
    const items = typeof SET_GLASS !== 'undefined' ? SET_GLASS : [];
    const topLim = TOP + 48, popFade = clamp(1 - NAV.popP, 0, 1);
    const btnShCol = pal.dark ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.10)';
    const rm = items.find(it => it.kind === 'recapMonth' && !it.under) || items.find(it => it.kind === 'recapMonth');
    if (G.recapMonth) {
      if (rm) {
        const isUnder = !!rm.under;
        const trItem = (!isUnder && trTab.on) ? trTab : null;
        const rmBox = trItem ? _tabRect(rm.x, rm.y, rm.w, rm.h, trItem) : { x: rm.x, y: rm.y, w: rm.w, h: rm.h };
        const slideClipMax = isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const slideClipMin = !isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const rmOp = clamp((rm.y - (TOP + 34)) / 18, 0, 1) * (isUnder ? 1 : popFade) * (trItem ? trItem.al : 1);
        const rmVis = rmOp > .02 && rmBox.y + rmBox.h > topLim - 8 && rmBox.y < H + 20 && isAboveSheet(rmBox.y, rmBox.h);
        setG(G.recapMonth, rmBox, rmVis, {
          opacity: rmOp, cornerRadius: rmBox.h / 2,
          tint: rm.tint,
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: rm.hlColor },
          shadow: { radius: 12, offsetY: 2, color: btnShCol, alpha: rmOp }
        });
      } else G.recapMonth.set({ visible: false });
    }
    const rp = items.find(it => it.kind === 'recapPlay' && !it.under) || items.find(it => it.kind === 'recapPlay');
    if (G.recapPlay) {
      if (rp) {
        const isUnder = !!rp.under;
        const trItem = (!isUnder && trTab.on) ? trTab : null;
        const rpBox = trItem ? _tabRect(rp.x, rp.y, rp.w, rp.h, trItem) : { x: rp.x, y: rp.y, w: rp.w, h: rp.h };
        const slideClipMax = isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const slideClipMin = !isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const rpOp = clamp((rp.y - (TOP + 34)) / 18, 0, 1) * (isUnder ? 1 : popFade) * (rp.alpha != null ? rp.alpha : 1) * (trItem ? trItem.al : 1);
        const rpVis = rpOp > .02 && rpBox.y + rpBox.h > topLim - 8 && rpBox.y < H + 20 && isAboveSheet(rpBox.y, rpBox.h);
        setG(G.recapPlay, rpBox, rpVis, {
          opacity: rpOp, cornerRadius: rpBox.w / 2,
          tint: rp.tint || 'rgba(255,255,255,.20)',
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: rp.hlColor },
          shadow: { radius: 12, offsetY: 2, color: 'rgba(0,0,0,.22)', alpha: rpOp }
        });
      } else G.recapPlay.set({ visible: false });
    }
    const fr = items.find(it => it.kind === 'filterRail' && !it.under) || items.find(it => it.kind === 'filterRail');
    if (G.filtAct) {
      if (fr && fr.chips) {
        const isUnder = !!fr.under;
        const trItem = (!isUnder && trTab.on) ? trTab : null;
        const frBox = trItem ? _tabRect(0, fr.y, W, fr.h, trItem) : { x: 0, y: fr.y, w: W, h: fr.h };
        const slideClipMax = isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const slideClipMin = !isUnder && NAV.popP > .001 ? NAV.popP * W : undefined;
        const frTopLim = fr.topLim != null ? fr.topLim : topLim;
        const frTopFade = fr.topFade != null ? fr.topFade : (TOP + 34);
        const frOp = clamp((fr.y - frTopFade) / 18, 0, 1) * (isUnder ? 1 : popFade) * (trItem ? trItem.al : 1);
        const frVis = frOp > .02 && frBox.y + frBox.h > frTopLim - 8 && frBox.y < H + 20 && isAboveSheet(frBox.y, frBox.h);
        const actSc = fr.actSc || 1, actW = fr.actW * actSc, actH = fr.h * actSc;
        const actX = fr.actX + (fr.actW - actW) / 2, actY = fr.y + (fr.h - actH) / 2;
        const actBox = trItem ? _tabRect(actX, actY, actW, actH, trItem) : { x: actX, y: actY, w: actW, h: actH };
        for (let i = 0; i < 5; i++) {
          const fg = G['filt' + i];
          if (!fg) continue;
          const ch = fr.chips[i];
          if (!ch || !frVis) { fg.set({ visible: false }); continue; }
          const sc = ch.sc || 1, cw = ch.w * sc, chH = fr.h * sc;
          const cx = ch.x + (ch.w - cw) / 2, cy = fr.y + (fr.h - chH) / 2;
          const ovW = Math.max(0, Math.min(cx + cw, actX + actW) - Math.max(cx, actX));
          const ovFrac = clamp(ovW / Math.max(1, cw), 0, 1);
          const chipOp = frOp * clamp(1 - ovFrac * 0.92, 0.08, 1);
          const chBox = trItem ? _tabRect(cx, cy, cw, chH, trItem) : { x: cx, y: cy, w: cw, h: chH };
          const onScr = chBox.x + chBox.w > -10 && chBox.x < W + 10;
          setG(fg, chBox, onScr && chipOp > .02, {
            opacity: chipOp, cornerRadius: chBox.h / 2,
            tint: pal.dark ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.55)',
            clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
            highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 },
            shadow: { radius: 12, offsetY: 2, color: btnShCol, alpha: chipOp }
          });
        }
        const actOnScr = actBox.x + actBox.w > -10 && actBox.x < W + 10;
        setG(G.filtAct, actBox, frVis && actOnScr, {
          opacity: frOp, cornerRadius: actBox.h / 2,
          tint: pal.dark ? 'rgba(250, 46, 73, 0.78)' : 'rgba(250, 46, 73, 0.84)',
          clipXMin: slideClipMin, clipXMax: slideClipMax, clipSheet: clipSh,
          highlight: { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: 'rgba(255, 190, 200, 0.92)' },
          shadow: { radius: 12, offsetY: 2, color: btnShCol, alpha: frOp }
        });
      } else {
        for (let i = 0; i < 5; i++) if (G['filt' + i]) G['filt' + i].set({ visible: false });
        G.filtAct.set({ visible: false });
      }
    }
  }
  { const ppx = NAV.popP, below = !root && st.length === 2 && ppx > .001, P0 = root ? Ptop : st[0], tbn0 = topBtns(tbP(P0)), mo = tbn0.mo, av = tbn0.av, slide = ppx * W, par = -W * .28 * (1 - ppx), clipMax = below ? slide : undefined;
    const libBtns = isAboveSheet(mo.y, mo.h) && NAV.tab === 'library' && (root || below);
    const avVis = isAboveSheet(av.y, av.h) && (NAV.tab === 'home' || NAV.tab === 'library') && (root || below);
    const libTint = pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.60)';
    const libHl = { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1 };
    setG(G.more, { x: mo.x + (below ? par : 0), y: mo.y, w: mo.w, h: mo.h }, libBtns, { opacity: 1, cornerRadius: mo.h / 2, tint: libTint, highlight: libHl, clipXMax: clipMax, clipSheet: clipSh });
    setG(G.av, { x: av.x + (below ? par : 0), y: av.y, w: av.w, h: av.h }, avVis, { opacity: 1, cornerRadius: av.h / 2, tint: libTint, highlight: libHl, clipXMax: clipMax, clipSheet: clipSh });
    const bkVis = isAboveSheet(LAY.back.y, LAY.back.h);
    setG(G.back, { x: LAY.back.x + slide, y: LAY.back.y, w: LAY.back.w, h: LAY.back.h }, bkVis && !root, { opacity: 1, cornerRadius: 22, tint: topTint, highlight: pHl, clipSheet: clipSh });
    const hb = !root ? heroBtnState(Ptop, dk, 1) : null, hd = hb ? hb.d : 48, aHb = hb ? hb.al : 0;
    setG(G.hShuf, { x: (hb ? hb.x0 : 44) + slide, y: hb ? hb.y : 0, w: hd, h: hd }, aHb > .02 && !!hb && isAboveSheet(hb.y, hd), { opacity: aHb, cornerRadius: hd / 2, tint: heroTint, highlight: pHl, clipSheet: clipSh });
    setG(G.hDown, { x: (hb ? hb.x1 : W - 92) + slide, y: hb ? hb.y : 0, w: hd, h: hd }, aHb > .02 && !!hb && isAboveSheet(hb.y, hd), { opacity: aHb, cornerRadius: hd / 2, tint: heroTint, highlight: pHl, clipSheet: clipSh });
    const subBelow = !root && st.length > 2 && ppx > .001, Pprev = subBelow ? st[st.length - 2] : null;
    const tnPrev = Pprev ? tintOf(Pprev) : null;
    const topTintPrev = tnPrev ? tnPrev.topTint : (pal.dark ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.60)');
    const heroTintPrev = tnPrev ? tnPrev.heroTint : topTintPrev;
    const pHlPrev = { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: tnPrev ? tnPrev.btnHl : undefined };
    setG(G.backPrev, { x: LAY.back.x + par, y: LAY.back.y, w: LAY.back.w, h: LAY.back.h }, subBelow && bkVis, { opacity: 1, cornerRadius: 22, tint: topTintPrev, highlight: pHlPrev, clipXMax: slide, clipSheet: clipSh });
    const prPrev = Pprev ? pillRect(Pprev) : { x: 0, y: 0, w: 44, h: 44 }, prPrevVis = Pprev ? isAboveSheet(prPrev.y, prPrev.h) : false;
    prPrev.x += par;
    setG(G.apillPrev, prPrev, subBelow && prPrevVis && hasPill(Pprev), { opacity: 1, cornerRadius: 22, tint: topTintPrev, highlight: pHlPrev, clipXMax: slide, clipSheet: clipSh });
    const psPrev = Pprev ? pSearchRect(Pprev) : { x: 0, y: 0, w: 44, h: 44, qt: 0 }, aPsPrev = psPrev.qt;
    psPrev.x += par;
    setG(G.pSearchPrev, psPrev, subBelow && prPrevVis && aPsPrev > .02 && hasPill(Pprev), { opacity: aPsPrev, cornerRadius: 22, tint: topTintPrev, highlight: pHlPrev, clipXMax: slide, clipSheet: clipSh });
    const hbPrev = Pprev ? heroBtnState(Pprev, dk, 1) : null, hdPrev = hbPrev ? hbPrev.d : 48, aHbPrev = hbPrev ? hbPrev.al : 0;
    setG(G.hShufPrev, { x: (hbPrev ? hbPrev.x0 : 44) + par, y: hbPrev ? hbPrev.y : 0, w: hdPrev, h: hdPrev }, subBelow && aHbPrev > .02 && !!hbPrev && isAboveSheet(hbPrev.y, hdPrev), { opacity: aHbPrev, cornerRadius: hdPrev / 2, tint: heroTintPrev, highlight: pHlPrev, clipXMax: slide, clipSheet: clipSh });
    setG(G.hDownPrev, { x: (hbPrev ? hbPrev.x1 : W - 92) + par, y: hbPrev ? hbPrev.y : 0, w: hdPrev, h: hdPrev }, subBelow && aHbPrev > .02 && !!hbPrev && isAboveSheet(hbPrev.y, hdPrev), { opacity: aHbPrev, cornerRadius: hdPrev / 2, tint: heroTintPrev, highlight: pHlPrev, clipXMax: slide, clipSheet: clipSh }); }
  const pr = pillRect(Ptop), prVis = isAboveSheet(pr.y, pr.h); pr.x += NAV.popP * W; setG(G.apill, pr, prVis && !root && hasPill(Ptop), { opacity: 1, cornerRadius: 22, tint: topTint, highlight: pHl, clipSheet: clipSh });
  const ps = pSearchRect(Ptop), aPs = ps.qt; ps.x += NAV.popP * W; setG(G.pSearch, ps, prVis && aPs > .02 && !root && hasPill(Ptop), { opacity: aPs, cornerRadius: 22, tint: topTint, highlight: pHl, clipSheet: clipSh });
  { const mg = menuGeom(), mt = cmTheme(null);
    setG(G.menu, mg, MENU_SP.x > .02, {
      opacity: mg.al, cornerRadius: mg.rad,
      tint: mt.glassTint, surfaceColor: mt.glassSurface, slosh: 0,
      highlight: { width: 1, blurRadius: .5, alpha: mt.hlAlpha, style: 'default', angle: 45, falloff: 1, color: mt.glassHl },
      innerShadow: null,
      shadow: { radius: 28, offsetY: 10, color: mt.shadowCol, alpha: mg.al }
    }); }
  { const cg = cmGeom(), ct = cmTheme(CM.tr);
    setG(G.cm, cg, CM.sp.x > .02 && !!CM.tr, {
      opacity: cg.al, cornerRadius: cg.rad,
      tint: ct.glassTint, surfaceColor: ct.glassSurface, slosh: 0,
      highlight: { width: 1, blurRadius: .5, alpha: ct.hlAlpha, style: 'default', angle: 45, falloff: 1, color: ct.glassHl },
      innerShadow: null,
      shadow: { radius: 28, offsetY: 10, color: ct.shadowCol, alpha: cg.al }
    }); }
  if (G.outDrawer) {
    const og = outDrawerGeom(), ct = cmTheme(null);
    const glassG = { x: og.x, y: og.y, w: og.w, h: Math.max(og.h, H - og.y) + og.rad + 12 };
    setG(G.outDrawer, glassG, OUT_DRAWER.sp.x > .005 && og.y < H + 4, {
      opacity: og.al, cornerRadius: og.rad,
      tint: ct.glassTint, surfaceColor: ct.glassSurface, slosh: 0,
      highlight: { width: 1, blurRadius: .5, alpha: ct.hlAlpha, style: 'default', angle: 45, falloff: 1, color: ct.glassHl },
      innerShadow: null,
      shadow: { radius: 28, offsetY: 10, color: ct.shadowCol, alpha: og.al }
    });
  }
  if (G.prompt) {
    syncPromptGeom();
    if (_promptGlassVis && _promptGeom) {
      const pg = _promptGeom, pt = cmTheme(null);
      setG(G.prompt, { x: pg.x, y: pg.y, w: pg.w, h: pg.h }, true, {
        opacity: pg.op, cornerRadius: pg.rad,
        tint: pt.glassTint, surfaceColor: pt.glassSurface, slosh: 0,
        highlight: { width: 1, blurRadius: .5, alpha: pt.hlAlpha, style: 'default', angle: 45, falloff: 1, color: pt.glassHl },
        innerShadow: null,
        shadow: { radius: 28, offsetY: 10, color: pt.shadowCol, alpha: pg.op }
      });
    } else {
      G.prompt.set({ visible: false });
    }
  }
  const L = shLay(), so = SH.t > .01, br = (L.btnD || 34) / 2;
  const pt = clamp(L.pt != null ? L.pt : (L.p || 0), 0, 1), a0 = clamp(1 - pt * 1.5, 0, 1), a1 = clamp((pt - .25) * 1.35, 0, 1);
  const byGlass = pt < .5 ? (L.ty0_art + 8 + pt * 12) : (TOP + 54 + (1 - a1) * -14);
  const bAlpha = pt < .5 ? a0 : a1;
  setG(G.sStar, { x: L.btnX[0] - br, y: byGlass + oy - br, w: br * 2, h: br * 2 }, so && bAlpha > .05, { cornerRadius: br, opacity: bAlpha });
  setG(G.sMore, { x: L.btnX[1] - br, y: byGlass + oy - br, w: br * 2, h: br * 2 }, so && bAlpha > .05, { cornerRadius: br, opacity: bAlpha });
  const isQueue = (SH.mode === 'queue') || (SH.mode === 'art' && SH.fromMode === 'queue');
  const isCross = (SH.mode === 'queue' && SH.fromMode === 'lyrics') || (SH.mode === 'lyrics' && SH.fromMode === 'queue');
  const qP = isCross ? (SH.qModeP != null ? SH.qModeP : (SH.mode === 'queue' ? 1 : 0)) : (isQueue ? 1 : 0);
  const btnVis = so && (L.p || 0) > .25 && (isQueue || (isCross && qP > .02));
  const btnAlpha = isCross ? qP : clamp(((L.p || 0) - .2) * 2.5, 0, 1);
  const pw = (W - 48 - 20) / 3, py = (L.regTop || 0) - 4 + oy + (1 - (isCross ? qP : clamp(L.p, 0, 1))) * 14;
  ['sP1', 'sP2', 'sP3'].forEach((n, i) => setG(G[n], { x: 24 + i * (pw + 10), y: py, w: pw, h: 42 }, btnVis, { cornerRadius: 21, opacity: btnAlpha }));
  G.sP4.set({ visible: false });
  const t = cur(), fav = !!(t && PL.fav[t.id]);
  const cl = t ? (SH.cols || shaderPalette(t)) : null, c0 = cl ? cl[0] : [250, 46, 73];
  const [bh, bs, bl] = rgb2hsl(c0[0], c0[1], c0[2]), bNeu = bs < .08;
  const trgb = bNeu ? hsl2rgb(bh, 0, clamp(bl * 1.45 + .22, .48, .72)) : hsl2rgb(bh, clamp(bs * 1.15, .48, .95), clamp(bl * 1.2 + .08, .42, .58));
  const hrgb = bNeu ? hsl2rgb(bh, 0, .92) : hsl2rgb(bh, clamp(bs * 1.1, .45, .95), .82);
  const actTint = 'rgba(' + (trgb[0] | 0) + ',' + (trgb[1] | 0) + ',' + (trgb[2] | 0) + ',' + (bNeu ? .58 : .74) + ')';
  const actHl = { width: 1, blurRadius: .5, alpha: .5, style: 'default', angle: 45, falloff: 1, color: 'rgba(' + (hrgb[0] | 0) + ',' + (hrgb[1] | 0) + ',' + (hrgb[2] | 0) + ',.9)' };
  const neuHl = { width: 1, blurRadius: .5, alpha: .18, style: 'default', angle: 45, falloff: 1 };
  const setBtnT = (g, isOn) => g.set({ tint: isOn ? actTint : 'rgba(255,255,255,.15)', highlight: isOn ? actHl : neuHl });
  setBtnT(G.sStar, fav); setBtnT(G.sMore, false);
  const blendBtnT = (g, k) => {
    const rT = Math.round(mix(255, trgb[0], k)), gT = Math.round(mix(255, trgb[1], k)), bT = Math.round(mix(255, trgb[2], k));
    const aT = mix(.15, bNeu ? .58 : .74, k);
    const hlAlpha = mix(.18, .5, k);
    const hlCol = 'rgba(' + Math.round(mix(255, hrgb[0], k)) + ',' + Math.round(mix(255, hrgb[1], k)) + ',' + Math.round(mix(255, hrgb[2], k)) + ',' + (+mix(.5, .9, k).toFixed(2)) + ')';
    g.set({ tint: 'rgba(' + rT + ',' + gT + ',' + bT + ',' + (+aT.toFixed(3)) + ')', highlight: { width: 1, blurRadius: .5, alpha: hlAlpha, style: 'default', angle: 45, falloff: 1, color: hlCol } });
  };
  blendBtnT(G.sP1, clamp(SP.sP1.x, 0, 1));
  blendBtnT(G.sP2, clamp(SP.sP2.x, 0, 1));
  blendBtnT(G.sP3, clamp(SP.sP3.x, 0, 1));
  if (G.sLyAnim && G.sLyClassic) {
    const sb = SH.lyStyleBtns;
    const alSt = L.alone || 0, ctrlA = (1 - alSt) * (1 - alSt);
    const sbOp = sb ? clamp((sb.alpha != null ? sb.alpha : 1) * ctrlA, 0, 1) : 0;
    const sbVis = so && SRCUI.t > .01 && !!sb && sbOp > .02;
    if (sbVis) {
      const syOff = oy + alSt * 40;
      setG(G.sLyAnim, { x: sb.x, y: sb.y + syOff, w: sb.pw, h: sb.ph }, true, { cornerRadius: sb.ph / 2, opacity: sbOp });
      setG(G.sLyClassic, { x: sb.x + sb.pw + sb.gap, y: sb.y + syOff, w: sb.pw, h: sb.ph }, true, { cornerRadius: sb.ph / 2, opacity: sbOp });
      blendBtnT(G.sLyAnim, clamp(SP.sLyAnim ? SP.sLyAnim.x : (SRCUI.style === 'classic' ? 0 : 1), 0, 1));
      blendBtnT(G.sLyClassic, clamp(SP.sLyClassic ? SP.sLyClassic.x : (SRCUI.style === 'classic' ? 1 : 0), 0, 1));
    } else {
      G.sLyAnim.set({ visible: false });
      G.sLyClassic.set({ visible: false });
    }
  }
}

const INP = { rel: 0, down: false, id: -1, x0: 0, y0: 0, x: 0, y: 0, ly: 0, lx: 0, t0: 0, mode: null, tgt: null, samples: [], thumb: { on: false, x: 0, press: 0 } };
const tabPos = x => clamp((x - LAY.tabs[0].x) / LAY.tabs[0].w - .5, 0, 3);
const pt = e => { const r = $out.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
function topmost(list, x, y, needFn, pad) { for (let i = list.length - 1; i >= 0; i--) { const h = list[i]; if (inR(h, x, y, pad) && (!needFn || h.fn)) return h; } return null; }
const setVol = x => {
  PL.vol = clamp((x - 52) / (W - 104), 0, 1);
  if (PL.audio) PL.audio.volume = PL.vol;
  if (typeof syncNativeVolume === 'function') syncNativeVolume(PL.vol);
  else if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.setVolume === 'function') {
    try { window.SonoraNative.setVolume(PL.vol); } catch (e) {}
  }
  SH.volDrag = true;
  redraw();
};
let frameNo = 0;

const SWQ_THRESHOLD = 96;
const SWQ_HOLD      = 96;
const SWQ_OVERSHOOT = 28;
const SWQ_HOLD_MS   = 1300;
const SWQ_RESPONSE  = 0.45;
const SWQ_DAMPING   = 0.78;
const SWQ_W0        = 2 * Math.PI / SWQ_RESPONSE;
const SWQ_K         = SWQ_W0 * SWQ_W0;
const SWQ_C         = 2 * SWQ_DAMPING * SWQ_W0;

function swqLimit(raw) {
  if (raw > 0) return Math.min(18, raw * 0.2);
  const r = -raw;
  if (r <= SWQ_THRESHOLD) return -r;
  return -(SWQ_THRESHOLD + SWQ_OVERSHOOT * (1 - Math.exp(-(r - SWQ_THRESHOLD) / SWQ_OVERSHOOT)));
}

function swqReset(sw) {
  const t = sw || SWQ;
  t.tr = null;
  t.key = null;
  t.x = 0;
  t.v = 0;
  t.target = 0;
  t.state = 'idle';
  t.crossed = false;
  t.crossP = 0;
  t.done = false;
  t.doneT = 0;
  t.hitT = 0;
  t.holdUntil = 0;
  t.baseX = 0;
  t.startX = 0;
}

function swqClose(sw) {
  const t = sw || SWQ;
  t.target = 0;
  t.v = 0;
  t.state = 'returning';
}

function swqDetachToBg() {
  if (!SWQ.key || (SWQ.state === 'idle' && SWQ.x === 0 && SWQ.crossP <= 0)) {
    swqReset();
    return;
  }
  if (typeof SWQ_ROWS !== 'undefined') {
    SWQ_ROWS.set(SWQ.key, {
      tr: SWQ.tr, key: SWQ.key, x: SWQ.x, v: SWQ.v, target: SWQ.target,
      state: SWQ.state, crossed: SWQ.crossed, crossP: SWQ.crossP,
      done: SWQ.done, doneT: SWQ.doneT, hitT: SWQ.hitT, holdUntil: SWQ.holdUntil,
      baseX: SWQ.baseX, startX: SWQ.startX
    });
  }
  swqReset();
}

function swqAdoptFromBg(key) {
  if (!key || typeof SWQ_ROWS === 'undefined' || !SWQ_ROWS.has(key)) return false;
  const r = SWQ_ROWS.get(key);
  SWQ_ROWS.delete(key);
  Object.assign(SWQ, r);
  return true;
}

function swqStepItem(sw, dt, nowMs) {
  let swqDirty = false;
  const targetCrossP = sw.crossed ? 1 : 0;
  if (sw.crossP !== targetCrossP) {
    const stepC = dt / 0.18;
    sw.crossP = targetCrossP > sw.crossP
      ? Math.min(1, sw.crossP + stepC)
      : Math.max(0, sw.crossP - stepC);
    swqDirty = true;
  }
  if (sw.hitT > 0 && nowMs - sw.hitT < 400) swqDirty = true;
  else if (sw.hitT > 0) sw.hitT = 0;
  if (sw.done && sw.doneT > 0 && nowMs - sw.doneT < 460) swqDirty = true;

  if (sw.state === 'opening' || sw.state === 'returning') {
    const swqDt = Math.max(0, Math.min(0.034, dt));
    const n = Math.max(1, Math.ceil(swqDt * 240));
    const h = swqDt / n;
    for (let i = 0; i < n; i++) {
      sw.v += (-SWQ_K * (sw.x - sw.target) - SWQ_C * sw.v) * h;
      sw.x += sw.v * h;
    }
    if (Math.abs(sw.x - sw.target) < 0.25 && Math.abs(sw.v) < 6) {
      sw.x = sw.target;
      sw.v = 0;
      if (sw.state === 'opening') {
        sw.state = 'hold';
        sw.holdUntil = nowMs + SWQ_HOLD_MS;
      } else {
        swqReset(sw);
      }
    }
    swqDirty = true;
  } else if (sw.state === 'hold') {
    if (nowMs >= sw.holdUntil) {
      swqClose(sw);
      swqDirty = true;
    }
  }
  return swqDirty;
}

function swqFireThreshold() {
  if (typeof window !== 'undefined' && typeof window.haptic === 'function') window.haptic('threshold');
  else { try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10); } catch (_) {} }
  SWQ.hitT = performance.now();
}

function swqEnqueue(tr) {
  if (!tr) return;
  if (typeof enqueueTracks === 'function') {
    enqueueTracks(tr, 'next', true);
    return;
  }
  const qtr = Object.assign({}, tr, { _queued: true, _smartRec: false });
  if (!PL.queue.length) {
    if (typeof playOne === 'function') playOne(qtr);
    else playList([qtr], 0);
  } else {
    PL.qi = Math.max(0, Math.min(PL.qi | 0, PL.queue.length - 1));
    PL.queue.splice(PL.qi + 1, 0, qtr);
  }
}

function physics(dt) {
  frameNo++; const P = topPage();
  if (_tabTrans.active) {
    _tabTrans.sp.step(dt);
    const el = performance.now() - _tabTrans.t0;
    if (el >= 225 && !_tabTrans.sp.busy) { _tabTrans.active = false; }
    D.scene = D.ov = D.gl = true;
  }
  if (_miniTrans.t > 0.005) {
    _miniTrans.t = ease(_miniTrans.t, 0, 18, dt);
    _miniTrans.dx += _miniTrans.dir * 120 * dt;
    if (_miniTrans.t <= 0.01) { _miniTrans.t = 0; _miniTrans.tr = null; }
    D.ov = D.gl = true;
  }
  if (NAV.miniDismissT > 0.005) {
    NAV.miniDismissT = ease(NAV.miniDismissT, 0, 20, dt);
    NAV.miniDismissY = ease(NAV.miniDismissY || 0, 56, 16, dt);
    if (NAV.miniDismissT <= 0.02) { NAV.miniDismissT = 0; NAV.miniDismissY = 0; NAV.miniDismissTr = null; }
    D.ov = D.gl = true;
  }
  if (typeof stepPress === 'function' && stepPress(dt)) {
    D.scene = D.ov = D.gl = true;
  }
  if (SH.dragQueue && (SH.dragQueue.lift == null || SH.dragQueue.lift < 0.999)) {
    SH.dragQueue.lift = ease(SH.dragQueue.lift || 0, 1, 24, dt);
    if (1 - SH.dragQueue.lift < 0.005) SH.dragQueue.lift = 1;
    redraw();
  }
  if (SH.qSettle) {
    const tgtY = SH.qSettle.idx * 60;
    SH.qSettle.relY = ease(SH.qSettle.relY, tgtY, 24, dt);
    SH.qSettle.lift = ease(SH.qSettle.lift, 0, 20, dt);
    if (Math.abs(SH.qSettle.relY - tgtY) < 0.25 && SH.qSettle.lift < 0.008) SH.qSettle = null;
    redraw();
  }
  if (SH.qOff && SH.qOff.size) {
    let qCh = false;
    for (const [k, e] of SH.qOff) {
      e.cur = ease(e.cur, e.tgt, 22, dt);
      if (Math.abs(e.cur - e.tgt) < 0.2) {
        e.cur = e.tgt;
        if (!SH.dragQueue && !SH.qSettle) SH.qOff.delete(k);
      } else qCh = true;
    }
    if (qCh) redraw();
  }
  if (SH.qRemoving && SH.qRemoving.length) {
    if (SH.t < 0.02 || SH.mode !== 'queue') {
      SH.qRemoving.length = 0;
    } else {
      for (let i = SH.qRemoving.length - 1; i >= 0; i--) {
        const rm = SH.qRemoving[i];
        rm.hP = ease(rm.hP, 0, 22, dt);
        rm.x = ease(rm.x, -W, 18, dt);
        if (rm.hP < 0.008) SH.qRemoving.splice(i, 1);
      }
      redraw();
    }
  }
  if (SWQ.key && String(SWQ.key).indexOf('q:') === 0 && (SH.t < 0.05 || SH.mode !== 'queue') && SWQ.state !== 'idle') {
    swqReset();
  }
  if (INP.rel && !INP.down) { const el = performance.now() - INP.rel, st = Math.abs(SP.tab.x - SP.tab.t) < .05 && Math.abs(SP.tab.v) < .7; if ((st && el > 120) || el > 2200) { SP.tabP.t = 0; INP.rel = 0; } }
  { const pt = hasPill(P) ? clamp((P.scroll - 30) / 110, 0, 1) : 0; if (Math.abs(NAV.pk - pt) > .001) { NAV.pk = ease(NAV.pk, pt, 14, dt); if (Math.abs(NAV.pk - pt) <= .001) NAV.pk = pt; redraw(); } else if (NAV.pk !== pt) { NAV.pk = pt; redraw(); } }
  { const qt = hasPill(P) && P.qOpen ? 1 : 0; P.qT = P.qT || 0; if (Math.abs(P.qT - qt) > .001) { P.qT = ease(P.qT, qt, 16, dt); if (Math.abs(P.qT - qt) <= .001) P.qT = qt; redraw(); } else if (P.qT !== qt) { P.qT = qt; redraw(); } }
  if (!(INP.down && INP.mode === 'edge') && NAV.popP !== NAV.popT) {
    NAV.popP = ease(NAV.popP, NAV.popT, 13, dt);
    if (Math.abs(NAV.popP - NAV.popT) < .0015) { NAV.popP = NAV.popT; if (NAV.popT === 1) { stackOf().pop(); NAV.popP = NAV.popT = 0; } }
    redraw();
  }
  if (!(INP.down && INP.mode === 'scroll')) {
    const max = Math.max(0, P.h - H);
    if (P.scrollTo != null) { P.scroll = ease(P.scroll, P.scrollTo, 14, dt); if (Math.abs(P.scroll - P.scrollTo) < .2) { P.scroll = P.scrollTo; P.scrollTo = null; } redraw(); }
    else if (Math.abs(P.vel) > 8 || P.scroll < 0 || P.scroll > max) {
      if (P.scroll < 0 || P.scroll > max) {
        const tg = P.scroll < 0 ? 0 : max;
        P.scroll = ease(P.scroll, tg, 11, dt);
        P.vel *= Math.exp(-14 * dt);
        if (Math.abs(P.scroll - tg) < .15 && Math.abs(P.vel) < 8) P.scroll = tg;
      }
      if (P.vel) {
        const ns = P.scroll + P.vel * dt;
        if ((ns < 0 && P.vel < 0) || (ns > max && P.vel > 0)) P.vel *= .55;
        P.scroll = clamp(ns, -80, max + 80);
        P.vel *= Math.exp(-3.2 * dt);
        if (Math.abs(P.vel) < 8) P.vel = 0;
      }
      redraw();
    }
  }
  if (P) {
    const tbTgt = sstep(clamp((P.scroll || 0) / 96, 0, 1));
    if (P._tbP == null) P._tbP = tbTgt;
    else if (Math.abs(P._tbP - tbTgt) > 0.0008) {
      P._tbP = ease(P._tbP, tbTgt, 16, dt);
      if (Math.abs(P._tbP - tbTgt) <= 0.0008) P._tbP = tbTgt;
      D.ov = D.gl = true;
    }
  }
  for (const id in P.rails) {
    const r = P.rails[id], rmax = r.max || 0;
    if (INP.down && INP.mode === 'rail') continue;
    if (r.to != null) {
      r.x += (r.to - r.x) * Math.min(1, dt * 11);
      if (Math.abs(r.to - r.x) < .2) { r.x = r.to; r.to = null; }
      redraw();
    } else if (Math.abs(r.vel || 0) > 8 || r.x < 0 || r.x > rmax) {
      if (r.x < 0 || r.x > rmax) {
        const tg = r.x < 0 ? 0 : rmax;
        r.x = ease(r.x, tg, 11, dt);
        r.vel = (r.vel || 0) * Math.exp(-14 * dt);
        if (Math.abs(r.x - tg) < .15 && Math.abs(r.vel) < 8) r.x = tg;
      }
      if (r.vel) {
        const nx = r.x + r.vel * dt;
        if ((nx < 0 && r.vel < 0) || (nx > rmax && r.vel > 0)) r.vel *= .55;
        r.x = clamp(nx, -48, rmax + 48);
        r.vel *= Math.exp(-3.4 * dt);
        if (Math.abs(r.vel) < 8) r.vel = 0;
      }
      redraw();
    }
  }
  { const mx = Math.max(0, P.h - H);
    if (NAV.lastPage !== P) { NAV.lastPage = P; NAV.lastScroll = P.scroll; NAV.dirAcc = 0; }
    const d = P.scroll - NAV.lastScroll; NAV.lastScroll = P.scroll;
    if (!PREFS.barFolds) NAV.min = 0;
    else if (P.scroll > mx || P.scroll < 0) {  }
    else if (d !== 0) { if (d * NAV.dirAcc < 0) NAV.dirAcc = 0; NAV.dirAcc += d; if (NAV.dirAcc > 28 && P.scroll > 60 && cur() && mx > 120) NAV.min = 1; else if (NAV.dirAcc < -14) NAV.min = 0; }
    if (P.scroll < 12 || !cur()) NAV.min = 0;
    if (Math.abs(NAV.minT - NAV.min) > .001) { NAV.minT = ease(NAV.minT, NAV.min, 9, dt); if (Math.abs(NAV.minT - NAV.min) < .0015) NAV.minT = NAV.min; redraw(); } else if (NAV.minT !== NAV.min) { NAV.minT = NAV.min; redraw(); } }
  if (P.kind === 'settings' && P.subAnim != null && P.subAnim < 1) {
    P.subAnim = ease(P.subAnim, 1, 14, dt);
    if (1 - P.subAnim < .0015) P.subAnim = 1;
    redraw();
  }
  if (typeof stepLq === 'function' && stepLq(dt)) redraw();
  {
    const nowMs = performance.now();
    let swqDirty = false;
    if (SWQ.state !== 'idle' || SWQ.x !== 0 || SWQ.crossP > 0) {
      if (swqStepItem(SWQ, dt, nowMs)) swqDirty = true;
    }
    if (typeof SWQ_ROWS !== 'undefined' && SWQ_ROWS.size) {
      for (const [k, row] of SWQ_ROWS) {
        if (swqStepItem(row, dt, nowMs)) swqDirty = true;
        if (row.state === 'idle' && row.x === 0 && row.crossP <= 0) SWQ_ROWS.delete(k);
      }
    }
    if (swqDirty) redraw();
  }
  { const canAlone = PREFS.lyricsAlone && SH.t > .85 && SH.mode === 'lyrics' && !SRCUI.open && PL.playing && !(INP.down && (INP.mode === 'scrub' || INP.mode === 'vol' || INP.mode === 'dismiss'));
    const idleMs = performance.now() - (SH.lastTouch || 0);
    const alTarget = (canAlone && idleMs > 4000) ? 1 : 0;
    const alRate = alTarget > (SH.aloneT || 0) ? 3.2 : 10.5;
    if (Math.abs((SH.aloneT || 0) - alTarget) > .0015) {
      SH.aloneT = ease(SH.aloneT || 0, alTarget, alRate, dt);
      if (Math.abs(SH.aloneT - alTarget) <= .0015) SH.aloneT = alTarget;
      redraw();
    } else if ((SH.aloneT || 0) !== alTarget) { SH.aloneT = alTarget; redraw(); }
  }
  if (!(INP.down && INP.mode === 'dismiss')) { const pt0 = SH.t; SH.t = ease(SH.t, SH.target, 11, dt); if (Math.abs(SH.t - SH.target) < .0015) SH.t = SH.target; if (SH.t !== pt0) redraw(); }
  if (!(INP.down && INP.mode === 'dismiss') && SH.drag) { SH.drag = ease(SH.drag, 0, 14, dt); if (Math.abs(SH.drag) < .2) SH.drag = 0; redraw(); }
  if (!(INP.down && INP.mode === 'miniSwipe') && Math.abs(NAV.miniDx) > .15) { NAV.miniDx = ease(NAV.miniDx, 0, 18, dt); if (Math.abs(NAV.miniDx) < .15) NAV.miniDx = 0; D.ov = D.gl = true; } else if (!(INP.down && INP.mode === 'miniSwipe') && NAV.miniDx !== 0) { NAV.miniDx = 0; D.ov = D.gl = true; }
  if (!(INP.down && INP.mode === 'miniDismiss') && Math.abs(NAV.miniDy) > .15) { NAV.miniDy = ease(NAV.miniDy, 0, 18, dt); if (Math.abs(NAV.miniDy) < .15) NAV.miniDy = 0; D.ov = D.gl = true; } else if (!(INP.down && INP.mode === 'miniDismiss') && NAV.miniDy !== 0) { NAV.miniDy = 0; D.ov = D.gl = true; }
  { const a0 = SP.art.x; SP.art.t = PL.playing ? 1 : .82; SP.art.step(dt); SH.pk = SP.art.x; if ((SP.art.busy || SP.art.x !== a0) && SH.t > .01) redraw(); }
  { const m0 = SP.shMode.x, t0 = SP.shText.x, q0 = SP.qMode.x, p1 = SP.sP1.x, p2 = SP.sP2.x, p3 = SP.sP3.x, la0 = SP.sLyAnim ? SP.sLyAnim.x : 0, lc0 = SP.sLyClassic ? SP.sLyClassic.x : 0;
    SP.shMode.t = SH.mode === 'art' ? 0 : 1; SP.shMode.step(dt); SH.modeP = clamp(SP.shMode.x, 0, 1);
    SP.shText.t = SH.mode === 'art' ? 0 : 1; SP.shText.step(dt); SH.textP = clamp(SP.shText.x, 0, 1);
    SP.qMode.t = (SH.mode === 'queue' && SH.t > .05) ? 1 : 0; SP.qMode.step(dt); SH.qModeP = clamp(SP.qMode.x, 0, 1);
    SP.sP1.t = PL.shuffle ? 1 : 0; SP.sP1.step(dt);
    SP.sP2.t = PL.repeat > 0 ? 1 : 0; SP.sP2.step(dt);
    SP.sP3.t = PL.infinity ? 1 : 0; SP.sP3.step(dt);
    if (SP.sLyAnim) { SP.sLyAnim.t = (SRCUI.style === 'classic') ? 0 : 1; SP.sLyAnim.step(dt); }
    if (SP.sLyClassic) { SP.sLyClassic.t = (SRCUI.style === 'classic') ? 1 : 0; SP.sLyClassic.step(dt); }
    const shBusy = SP.shMode.busy || SP.shText.busy || SP.qMode.busy || SP.sP1.busy || SP.sP2.busy || SP.sP3.busy ||
      (SP.sLyAnim && (SP.sLyAnim.busy || SP.sLyAnim.x !== la0)) || (SP.sLyClassic && (SP.sLyClassic.busy || SP.sLyClassic.x !== lc0)) ||
      SP.shMode.x !== m0 || SP.shText.x !== t0 || SP.qMode.x !== q0 || SP.sP1.x !== p1 || SP.sP2.x !== p2 || SP.sP3.x !== p3;
    if (shBusy && SH.t > .01) redraw(); }
  {
    if (!SH.botHl) SH.botHl = { lyrics: 0, airplay: 0, queue: 0 };
    const isOutOn = typeof OUT_DRAWER !== 'undefined' && OUT_DRAWER.open;
    const tgBot = {
      lyrics: SH.mode === 'lyrics' ? 1 : 0,
      airplay: isOutOn ? 1 : 0,
      queue: SH.mode === 'queue' ? 1 : 0
    };
    let botCh = false;
    for (const k of ['lyrics', 'airplay', 'queue']) {
      const curV = SH.botHl[k] || 0;
      const tgV = tgBot[k];
      if (Math.abs(curV - tgV) > 0.0005) {
        const step = dt / (tgV > curV ? 0.14 : 0.16);
        SH.botHl[k] = tgV > curV ? Math.min(tgV, curV + step) : Math.max(tgV, curV - step);
        botCh = true;
      } else if (curV !== tgV) {
        SH.botHl[k] = tgV;
        botCh = true;
      }
    }
    if (botCh && SH.t > 0.01) { D.scene = D.ov = D.gl = true; }
  }
  if (SH.t > .01) {
    const tg = shaderPalette(cur());
    let colsSettling = false;
    if (!SH.cols || SH.cols.length !== tg.length) {
      SH.cols = tg.map(q => q.slice());
      colsSettling = true;
    } else {
      SH.cols.forEach((q, i) => {
        for (let k = 0; k < 3; k++) {
          const nv = ease(q[k], tg[i][k], 2.6, dt);
          if (Math.abs(nv - tg[i][k]) > 0.15) colsSettling = true;
          q[k] = nv;
        }
      });
    }
    const shAnim = PL.playing || colsSettling || SH.t <= .999 || SH.target < 1 || !!SH.drag || !!INP.down ||
      SP.art.busy || SP.shMode.busy || SP.shText.busy || SP.qMode.busy ||
      Math.abs(SH.lVel || 0) > 8 || Math.abs(SH.qVel || 0) > 8 ||
      !!SH.dragQueue || !!SH.qSettle || !!(SH.qOff && SH.qOff.size > 0) || !!(SH.qRemoving && SH.qRemoving.length > 0);
    if (shAnim) {
      SH.phase += dt * (PL.playing ? .3 : .12);
      if (frameNo & 1) {
        if (SH.t > .999) {
          if (typeof redrawSceneOnly === 'function') redrawSceneOnly();
          else { D.scene = D.gl = true; }
        } else {
          D.scene = D.gl = true;
          if (SH.t < .99) D.ov = true;
        }
      }
    }
  }
  if (SH.t > .5 && SH.mode === 'lyrics' && !(INP.down && INP.mode === 'list')) {
    if (SH.lHold > 0) {
      SH.lHold -= dt;
      if (Math.abs(SH.lVel || 0) > 8 || SH.lScroll < 0 || SH.lScroll > SH.lMax) {
        if (SH.lScroll < 0 || SH.lScroll > SH.lMax) {
          const tg = SH.lScroll < 0 ? 0 : SH.lMax;
          SH.lScroll = ease(SH.lScroll, tg, 11, dt);
          SH.lVel = (SH.lVel || 0) * Math.exp(-14 * dt);
          if (Math.abs(SH.lScroll - tg) < .15 && Math.abs(SH.lVel) < 8) SH.lScroll = tg;
        }
        if (SH.lVel) {
          const nl = SH.lScroll + SH.lVel * dt;
          if ((nl < 0 && SH.lVel < 0) || (nl > SH.lMax && SH.lVel > 0)) SH.lVel *= .55;
          SH.lScroll = clamp(nl, -56, SH.lMax + 56);
          SH.lVel *= Math.exp(-3.6 * dt);
          if (Math.abs(SH.lVel) < 8) SH.lVel = 0;
        }
        if (typeof redrawSheetContent === 'function') redrawSheetContent();
        else redraw();
      }
    }
    else if (Math.abs(SH.lScroll - SH.lTarget) > .15) { SH.lVel = 0; SH.lScroll = ease(SH.lScroll, SH.lTarget, 6.2, dt); if (Math.abs(SH.lScroll - SH.lTarget) <= .15) SH.lScroll = SH.lTarget; if (typeof redrawSheetContent === 'function') redrawSheetContent(); else redraw(); }
    else if (SH.lScroll !== SH.lTarget) { SH.lScroll = SH.lTarget; if (typeof redrawSheetContent === 'function') redrawSheetContent(); else redraw(); }
  }
  if (SH.mode === 'queue' && !(INP.down && INP.mode === 'list') && (Math.abs(SH.qVel) > 8 || SH.qScroll < 0 || SH.qScroll > SH.qMax)) {
    if (SH.qScroll < 0 || SH.qScroll > SH.qMax) {
      const tg = SH.qScroll < 0 ? 0 : SH.qMax;
      SH.qScroll = ease(SH.qScroll, tg, 11, dt);
      SH.qVel *= Math.exp(-14 * dt);
      if (Math.abs(SH.qScroll - tg) < .15 && Math.abs(SH.qVel) < 8) SH.qScroll = tg;
    }
    if (SH.qVel) {
      const nq = SH.qScroll + SH.qVel * dt;
      if ((nq < 0 && SH.qVel < 0) || (nq > SH.qMax && SH.qVel > 0)) SH.qVel *= .55;
      SH.qScroll = clamp(nq, -56, SH.qMax + 56);
      SH.qVel *= Math.exp(-3.4 * dt);
      if (Math.abs(SH.qVel) < 8) SH.qVel = 0;
    }
    if (typeof redrawSheetContent === 'function') redrawSheetContent();
    else redraw();
  }
  { const sStack = NAV.stacks && NAV.stacks.search ? NAV.stacks.search : [];
    const st = NAV.tab !== 'search' ? 0
      : (sStack.length <= 1 ? 1
        : (sStack.length === 2 && (NAV.popT === 1 || (INP.down && INP.mode === 'edge'))
          ? clamp(NAV.popP || NAV.popT, 0, 1)
          : 0));
    if (Math.abs(NAV.sm - st) > .0015) { NAV.sm = ease(NAV.sm, st, 10, dt); if (Math.abs(NAV.sm - st) <= .0015) NAV.sm = st; redraw(); } else if (NAV.sm !== st) { NAV.sm = st; redraw(); } }
  { const st = SRCUI.open && SH.t > .5 ? 1 : 0; if (Math.abs(SRCUI.t - st) > .0015) { SRCUI.t = ease(SRCUI.t, st, 14, dt); if (Math.abs(SRCUI.t - st) <= .0015) SRCUI.t = st; redraw(); } else if (SRCUI.t !== st) { SRCUI.t = st; redraw(); } if (!st && SRCUI.open && SH.t < .05) SRCUI.open = false;
    const exSt = SRCUI.ex ? 1 : 0; SRCUI.exT = SRCUI.exT || 0; if (Math.abs(SRCUI.exT - exSt) > .0015) { SRCUI.exT = ease(SRCUI.exT, exSt, 15, dt); if (Math.abs(SRCUI.exT - exSt) <= .0015) SRCUI.exT = exSt; redraw(); } else if (SRCUI.exT !== exSt) { SRCUI.exT = exSt; redraw(); } }
  if (SH.lyLay && SH.lyLay.blocks) {
    const ci = SH.lAct != null ? SH.lAct : -1;
    const fci = Math.max(0, ci);
    let chLy = false;
    SH.lyLay.blocks.forEach((b, idx) => {
      const tg = idx === ci ? 1 : 0;
      if (b.k == null) b.k = tg;
      else if (Math.abs(b.k - tg) > .0015) { b.k = ease(b.k, tg, tg > b.k ? 7.5 : 5.5, dt); if (Math.abs(b.k - tg) <= .0015) b.k = tg; chLy = true; }
      else if (b.k !== tg) { b.k = tg; chLy = true; }
      const dtg = idx === fci ? 1 : (idx < fci ? clamp(1 - (fci - idx) * .36, .16, 1) : clamp(1 - Math.max(0, idx - fci - 1) * .20, .28, 1));
      if (b.df == null) b.df = dtg;
      else if (Math.abs(b.df - dtg) > .002) { b.df = ease(b.df, dtg, 6, dt); if (Math.abs(b.df - dtg) <= .002) b.df = dtg; chLy = true; }
      else if (b.df !== dtg) { b.df = dtg; chLy = true; }
      const btg = idx === fci ? 0 : (idx > fci ? clamp((idx - fci) * .72, 0, 3.0) : clamp((fci - idx) * .85, 0, 2.8));
      if (b.blur == null) b.blur = btg;
      else if (Math.abs(b.blur - btg) > .012) { b.blur = ease(b.blur, btg, 6.5, dt); if (Math.abs(b.blur - btg) <= .012) b.blur = btg; chLy = true; }
      else if (b.blur !== btg) { b.blur = btg; chLy = true; }
    });
    if (chLy && SH.t > .5 && (SH.mode === 'lyrics' || SH.fromMode === 'lyrics')) redraw();
  }
  { const cm0 = CM.sp.x; CM.sp.step(dt);
    let cmCh = false;
    if (CM.animH && (Math.abs(CM.animH - CM.r.h) > 0.25 || Math.abs(CM.animY - CM.r.y) > 0.25)) {
      CM.animH = ease(CM.animH, CM.r.h, 18, dt); CM.animY = ease(CM.animY, CM.r.y, 18, dt);
      if (Math.abs(CM.animH - CM.r.h) <= 0.25) { CM.animH = CM.r.h; CM.animY = CM.r.y; }
      cmCh = true;
    }
    if (CM.fade != null && CM.fade < 1) {
      CM.fade = ease(CM.fade, 1, 16, dt);
      if (1 - CM.fade < 0.01) { CM.fade = 1; CM.prevMode = null; }
      cmCh = true;
    }
    if (CM.pressRow >= 0) {
      if ((CM.pressA || 0) < 0.999) {
        CM.pressA = Math.min(1, (CM.pressA || 0) + dt / 0.12);
        cmCh = true;
      } else if (CM.pressA !== 1) {
        CM.pressA = 1;
        cmCh = true;
      }
    } else if (CM.prevPressRow >= 0) {
      CM.pressA = ease(CM.pressA || 0, 0, 16, dt);
      if (CM.pressA < 0.01) { CM.pressA = 0; CM.prevPressRow = -1; }
      cmCh = true;
    }
    if (!CM.open && CM.sp.x < .005) { CM.sp.x = 0; CM.sp.v = 0; if (CM.tr) { CM.tr = null; CM.prevMode = null; CM.animH = 0; D.ov = D.gl = true; } }
    if (CM.sp.busy || CM.sp.x !== cm0 || cmCh) { D.ov = D.gl = true; } }
  { const od0 = OUT_DRAWER.sp.x; OUT_DRAWER.sp.step(dt);
    let odCh = false;
    if (OUT_DRAWER.pressRow >= 0) {
      if ((OUT_DRAWER.pressA || 0) < 0.999) {
        OUT_DRAWER.pressA = Math.min(1, (OUT_DRAWER.pressA || 0) + dt / 0.12);
        odCh = true;
      } else if (OUT_DRAWER.pressA !== 1) {
        OUT_DRAWER.pressA = 1;
        odCh = true;
      }
    } else if (OUT_DRAWER.prevPressRow >= 0) {
      OUT_DRAWER.pressA = ease(OUT_DRAWER.pressA || 0, 0, 16, dt);
      if (OUT_DRAWER.pressA < 0.01) { OUT_DRAWER.pressA = 0; OUT_DRAWER.prevPressRow = -1; }
      odCh = true;
    }
    if (!OUT_DRAWER.open && OUT_DRAWER.sp.x < .005) {
      if (OUT_DRAWER.sp.x !== 0 || OUT_DRAWER.drag !== 0) {
        OUT_DRAWER.sp.x = 0; OUT_DRAWER.sp.v = 0; OUT_DRAWER.drag = 0;
        D.ov = D.gl = true;
      }
    }
    if (!(INP.down && INP.mode === 'outDrawerDrag') && OUT_DRAWER.drag) {
      OUT_DRAWER.drag = ease(OUT_DRAWER.drag, 0, 14, dt);
      if (Math.abs(OUT_DRAWER.drag) < .2) OUT_DRAWER.drag = 0;
      D.ov = D.gl = true;
    }
    if (OUT_DRAWER.sp.busy || OUT_DRAWER.sp.x !== od0 || odCh) { D.ov = D.gl = true; } }
  { const mt = NAV.menu ? 1 : 0, ms0 = MENU_SP.x;
    if (MENU_SP.t !== mt) { MENU_SP.t = mt; MENU_SP.v = 0; }
    MENU_SP.step(dt);
    if (!NAV.menu && MENU_SP.x < .005) { MENU_SP.x = 0; MENU_SP.v = 0; }
    NAV.menuT = clamp(MENU_SP.x, 0, 1);
    if (MENU_SP.busy || MENU_SP.x !== ms0) { D.ov = D.gl = true; } }
  if (NAV.focus && Math.floor(performance.now() / 520) !== physics.q) { physics.q = Math.floor(performance.now() / 520); D.ov = D.gl = true; if (P && P.libQOpen) D.scene = true; }
}

function velocity() {
  const s = INP.samples, n = s.length; if (n < 2) return { x: 0, y: 0 }; const b = s[n - 1]; let a = s[0];
  for (let i = n - 1; i >= 0; i--) { if (b.t - s[i].t > 110) break; a = s[i]; } const dt = Math.max(16, b.t - a.t) / 1000; return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
}
function cmCanPlayNow(t, ctx) {
  if (!t || !isTr(t)) return false;
  if (CM.mode && CM.mode !== 'menu') return false;
  const c = ctx || CM.ctx || 'search';
  if (c === 'player' || c === 'header') return false;
  if (typeof cur === 'function' && cur() && cur().id === t.id) return false;
  return true;
}
function cmPlayNow(t) {
  if (!t) return;
  closeCM();
  if (isTr(t)) {
    playOne(t);
    return;
  }
  const list = typeof tracksOf === 'function' ? tracksOf(t) : [];
  if (list.length && typeof playList === 'function') {
    playList(list, 0);
  } else if (typeof LIVE !== 'undefined' && LIVE.on && typeof liveLoad === 'function') {
    liveLoad(t).then(() => {
      const l2 = typeof tracksOf === 'function' ? tracksOf(t) : [];
      if (l2.length && typeof playList === 'function') playList(l2, 0);
    }).catch(() => {});
  }
}
function cmHitRow(x, y) {
  const g = cmGeom();
  const r = { x: g.rx, y: g.ry, w: g.rw, h: g.rh };
  if (!CM.tr || !inR(r, x, y)) return -1;
  if (y < r.y + CM_HEAD) {
    if (Math.hypot(x - (r.x + r.w - 30), y - (r.y + 40)) < 20) return -2;
    if (cmCanPlayNow(CM.tr, CM.ctx) && Math.hypot(x - (r.x + r.w - 66), y - (r.y + 40)) < 20) return -4;
    return -1;
  }
  const i = Math.floor((y - (r.y + CM_HEAD)) / CM_ROW);
  return (i >= 0 && i < cmItems(CM.tr, CM.ctx, CM.meta).length) ? i : -1;
}
function outDrawerHit(x, y) {
  const g = outDrawerGeom();
  if (!inR(g, x, y)) return -3;
  if (Math.hypot(x - (g.x + g.w - 30), y - (g.y + 48)) < 20) return -2;
  if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.openSystemOutputSwitcher === 'function' &&
      Math.hypot(x - (g.x + g.w - 66), y - (g.y + 48)) < 20) return -4;
  if (y < g.y + OUT_HEAD) return -1;
  const i = Math.floor((y - (g.y + OUT_HEAD)) / g.rowH);
  return (i >= 0 && i < (OUT_DRAWER.rows ? OUT_DRAWER.rows.length : 0)) ? i : -1;
}
$out.addEventListener('pointerdown', e => {
  if (isSonoraPromptOpen()) return;
  if (typeof armHistory === 'function') armHistory();
  const p = pt(e), now = performance.now(), P = topPage(), st = stackOf();
  Object.assign(INP, { down: true, id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, lx: p.x, ly: p.y, t0: now, mode: null, tgt: null, samples: [{ t: now, x: p.x, y: p.y }] });
  pressAt(p.x, p.y);
  try { $out.setPointerCapture(e.pointerId); } catch (_) {}
  if (OUT_DRAWER.open) {
    INP.tgt = { type: 'outDrawer' };
    OUT_DRAWER.pressRow = outDrawerHit(p.x, p.y);
    if (OUT_DRAWER.pressRow >= 0) { OUT_DRAWER.prevPressRow = OUT_DRAWER.pressRow; OUT_DRAWER.pressA = 0; }
    D.ov = true; return;
  }
  if (CM.open) {
    INP.tgt = { type: 'cm' };
    CM.pressRow = cmHitRow(p.x, p.y);
    if (CM.pressRow >= 0) { CM.prevPressRow = CM.pressRow; CM.pressA = 0; }
    D.ov = true; return;
  }
  if (NAV.menu) {
    INP.tgt = { type: 'menu' };
    const m = menuRect();
    if (inR(m, p.x, p.y)) {
      const mi = Math.floor((p.y - (m.y + 40)) / 46);
      if (mi >= 0 && mi < getMenuItems().length && typeof pressDown === 'function') pressDown('menu:' + mi);
    }
    return;
  }
  if (SH.t > .05) {
    const h = (OV_SHITS.length && topmost(OV_SHITS, p.x, p.y, false)) || topmost(SHITS, p.x, p.y, false); INP.tgt = { type: 'sheet', hit: h };
    if ((!h || h.tag !== 'lyrics') && (SH.aloneT || 0) < .45) SH.lastTouch = now;
    if (h && h.tag === 'scrub') { SH.lastTouch = now; INP.mode = 'scrub'; SH.scrub = clamp((p.x - 28) / (W - 56), 0, 1); redraw(); }
    else if (h && h.tag === 'vol') { SH.lastTouch = now; INP.mode = 'vol'; setVol(p.x); }
    else if (h && h.tag === 'queueGrip') {
      if (SWQ.key && String(SWQ.key).indexOf('q:') === 0 && SWQ.state !== 'idle') swqClose();
      SH.lastTouch = now;
      INP.mode = 'queueGrip';
      const rowIdx = (h.rowIdx != null) ? h.rowIdx : (h.extra && h.extra.rowIdx != null ? h.extra.rowIdx : 0);
      SH.dragQueue = {
        fromIdx: rowIdx,
        toIdx: rowIdx,
        startY: p.y,
        curY: p.y,
        lift: 0,
        rowItem: h.item || (h.extra && h.extra.item)
      };
      if (typeof window.haptic === 'function') window.haptic('pickup');
      D.ov = true;
      redraw();
    } else {
      if (h && h.tag === 'queue' && h.qRowKey) {
        const qSw = (SWQ.key === h.qRowKey) ? SWQ : ((typeof SWQ_ROWS !== 'undefined' && SWQ_ROWS.get(h.qRowKey)) || null);
        if (qSw && qSw.state === 'returning') {
          if (qSw !== SWQ) {
            swqDetachToBg();
            swqAdoptFromBg(h.qRowKey);
          }
          SWQ.state = 'paused';
          SWQ.v = 0;
          SWQ.done = false;
          SWQ.tr = h.qRowTrack;
          SWQ.qIdx = h.qRowIdx;
          SWQ.baseX = SWQ.x;
          SWQ.startX = p.x;
        }
      }
      if (h && h.pressKey && typeof pressDown === 'function') pressDown(h.pressKey);
    }
    return;
  }
  P.vel = 0; P.scrollTo = null; for (const id in P.rails) { P.rails[id].vel = 0; P.rails[id].to = null; }
  const dk = dock();
  if (P.kind !== 'settings') {
    if (dk.e > .5) { if (inR(dk.tab, p.x, p.y)) { INP.tgt = { type: 'btn', fn: () => { if (dk.sm > .5) goTab(NAV.last || 'home'); else { NAV.min = 0; redraw(); } } }; return; } }
    else if (inR(dk.tab, p.x, p.y)) { INP.tgt = { type: 'tab' }; INP.thumb.on = true; SP.tabP.t = 1; SP.tabP.v += 2.4; SP.tab.t = tabPos(p.x); redraw(); return; }
    if (inR(dk.search, p.x, p.y)) { INP.tgt = { type: 'search' }; return; }
    if (cur() && inR(dk.mini, p.x, p.y, 6)) {
      const m = dk.mini;
      if (typeof pressDown === 'function') {
        if (dk.em > .5) pressDown(p.x > m.x + m.w - 56 ? 'mini:play' : 'mini:body');
        else if (p.x > m.x + m.w - 52) pressDown('mini:next');
        else if (p.x > m.x + m.w - 100) pressDown('mini:play');
        else pressDown('mini:body');
      }
      _miniDismissHaptic = false;
      INP.tgt = { type: 'mini' }; return;
    }
  }
  if (st.length === 1 && NAV.tab === 'home' && inR(topBtns(tbP(P)).av, p.x, p.y, 4)) { INP.tgt = { type: 'btn', fn: () => { push('settings', { title: t('settings.title'), titleKey: 'settings.title' }); } }; return; }
  if (st.length === 1 && NAV.tab === 'library' && inR(topBtns(tbP(P)).mo, p.x, p.y, 4)) { INP.tgt = { type: 'btn', fn: () => { push('stats', { title: t('recap.title'), titleKey: 'recap.title' }); } }; return; }
  if (st.length === 1 && NAV.tab === 'library' && inR(topBtns(tbP(P)).av, p.x, p.y, 4)) { INP.tgt = { type: 'btn', fn: () => { NAV.libGrid = !NAV.libGrid; redraw(); } }; return; }
  if (st.length > 1 && hasPill(P) && P.qOpen && inR(pSearchRect(P), p.x, p.y)) { INP.tgt = { type: 'btn', fn: () => { $q.value = P.q || ''; NAV.focus = true; $q.focus(); INP.focusPending = true; redraw(); } }; return; }
  if (st.length > 1 && hasPill(P) && inR(pillRect(P), p.x, p.y)) {
    const pr = pillRect(P), left = pr.e > .5 || p.x < pr.x + pr.w / 2;
    INP.tgt = { type: 'btn', fn: () => {
      if (P.qOpen) { if (P.q) { P.q = ''; $q.value = ''; $q.focus(); INP.focusPending = true; } else { P.qOpen = false; $q.blur(); } redraw(); }
      else if (left) { P.qOpen = true; P.q = P.q || ''; $q.value = P.q; NAV.focus = true; $q.focus(); INP.focusPending = true; redraw(); }
      else openCM(P.data.item, pr.x + pr.w - 28, pr.y + 22, 'header');
    } }; return;
  }
  if (st.length > 1 && inR(LAY.back, p.x, p.y, 4)) {
    INP.tgt = { type: 'btn', fn: () => {
      if (P.qOpen) { P.qOpen = false; P.q = ''; $q.value = ''; $q.blur(); redraw(); }
      else pop();
    } }; return;
  }
  if (st.length > 1 && p.x < 24) { INP.tgt = { type: 'edge' }; return; }
  const rail = RAILS.find(r => inR(r, p.x, p.y));
  const phit = topmost(HITS, p.x, p.y, false);
  const phitSw = (phit && phit.rowKey) ? ((SWQ.key === phit.rowKey) ? SWQ : ((typeof SWQ_ROWS !== 'undefined' && SWQ_ROWS.get(phit.rowKey)) || null)) : null;
  if (phitSw && (phitSw.state === 'opening' || phitSw.state === 'hold')) {
    swqClose(phitSw);
    redraw();
    INP.tgt = null;
    INP.mode = 'none';
    return;
  } else if (phitSw && phitSw.state === 'returning') {
    if (phitSw !== SWQ) {
      swqDetachToBg();
      swqAdoptFromBg(phit.rowKey);
    }
    SWQ.state = 'paused';
    SWQ.v = 0;
    SWQ.done = false;
    SWQ.tr = phit.rowTrack;
    SWQ.baseX = SWQ.x;
    SWQ.startX = p.x;
  }
  if (phit && phit.setDrag) {
    if (phit.lqCtrl) lqPress(phit.lqCtrl, p.y, phit.lqScale || 1.38);
    INP.tgt = { type: 'page', hit: phit }; INP.mode = 'setDrag'; phit.setDrag(p.x); return;
  }
  if (phit && phit.lqCtrl) {
    lqPress(phit.lqCtrl, p.x, phit.lqScale);
    if (phit.lqDown) {
      phit.lqDown(p.x);
      INP.tgt = { type: 'page', hit: phit };
      INP.mode = 'lqDrag';
      return;
    }
  }
  if (phit && phit.pressKey && typeof pressDown === 'function') pressDown(phit.pressKey);
  INP.tgt = { type: 'page', rail, hit: phit };
});
$out.addEventListener('pointermove', e => {
  if (!INP.down) return; const p = pt(e), now = performance.now(), dx = p.x - INP.x0, dy = p.y - INP.y0, ddx = p.x - INP.lx, ddy = p.y - INP.ly, tg = INP.tgt, P = topPage();
  INP.samples.push({ t: now, x: p.x, y: p.y }); if (INP.samples.length > 8) INP.samples.shift(); INP.lx = p.x; INP.ly = p.y; INP.x = p.x; INP.y = p.y;
  if (!tg) return;
  if (tg.type === 'outDrawer') {
    if (INP.mode === 'outDrawerDrag') {
      OUT_DRAWER.drag = dy >= 0 ? dy : -16 * (1 - Math.exp(dy / 110));
      D.ov = D.gl = true;
      return;
    }
    if (!INP.mode && Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx) && OUT_DRAWER.pressRow !== -3) {
      INP.mode = 'outDrawerDrag';
      OUT_DRAWER.pressRow = -1;
      OUT_DRAWER.drag = dy >= 0 ? dy : -16 * (1 - Math.exp(dy / 110));
      D.ov = D.gl = true;
      return;
    }
    const nr = outDrawerHit(p.x, p.y);
    if (nr !== OUT_DRAWER.pressRow) {
      if (nr >= 0) { OUT_DRAWER.prevPressRow = nr; OUT_DRAWER.pressA = 0; }
      else if (OUT_DRAWER.pressRow >= 0) OUT_DRAWER.prevPressRow = OUT_DRAWER.pressRow;
      OUT_DRAWER.pressRow = nr;
      D.ov = D.gl = true;
    }
    return;
  }
  if (tg.type === 'cm') {
    const nr = cmHitRow(p.x, p.y);
    if (nr !== CM.pressRow) {
      if (nr >= 0) { CM.prevPressRow = nr; CM.pressA = 0; }
      else if (CM.pressRow >= 0) CM.prevPressRow = CM.pressRow;
      CM.pressRow = nr;
      D.ov = D.gl = true;
    }
    return;
  }
  if (tg.type === 'menu' && typeof pressDown === 'function' && typeof pressUp === 'function') {
    const m = menuRect();
    if (inR(m, p.x, p.y)) {
      const mi = Math.floor((p.y - (m.y + 40)) / 46);
      if (mi >= 0 && mi < getMenuItems().length) pressDown('menu:' + mi);
      else pressUp();
    } else pressUp();
    return;
  }
  if (INP.mode === 'queueGrip') {
    if (SH.dragQueue) {
      SH.dragQueue.curY = p.y;
    }
    D.ov = true;
    redraw();
    return;
  }
  if (INP.mode === 'scrub') { SH.lastTouch = now; SH.scrub = clamp((p.x - 28) / (W - 56), 0, 1); redraw(); return; }
  if (INP.mode === 'vol') { SH.lastTouch = now; setVol(p.x); return; }
  if (INP.mode === 'setDrag' && tg.hit && tg.hit.setDrag) {
    if (tg.hit.lqCtrl) {
      const c = tg.hit.lqCtrl, nowM = performance.now(), dtM = (nowM - c.lastT) / 1000, dy = -(p.y - c.lastX), span = tg.hit.lqSpan || 120;
      if (dtM > .001 && span > 1) c.vel.t = dy / (span * dtM);
      c.lastX = p.y; c.lastT = nowM;
      _lqHasBusy = true;
    }
    tg.hit.setDrag(p.x);
    return;
  }
  if (INP.mode === 'lqDrag' && tg.hit && tg.hit.lqCtrl) {
    lqDrag(tg.hit.lqCtrl, p.x, tg.hit.lqSpan);
    if (tg.hit.lqMove) tg.hit.lqMove();
    return;
  }
  if (tg.type === 'page' && !INP.mode && tg.hit && tg.hit.lqCtrl && Math.abs(dx) > 4 && Math.abs(dx) >= Math.abs(dy) * .8) {
    INP.mode = 'lqDrag';
    lqDrag(tg.hit.lqCtrl, p.x, tg.hit.lqSpan);
    if (tg.hit.lqMove) tg.hit.lqMove();
    return;
  }
  if (tg.type === 'tab') { SP.tab.t = tabPos(p.x); redraw(); return; }
  if (tg.type === 'mini' && !INP.mode && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * .65) {
    INP.mode = 'miniSwipe';
  }
  if (!INP.mode && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
    const horiz = Math.abs(dx) > Math.abs(dy);
    const swqHoriz = Math.abs(dx) > Math.abs(dy) * 1.2;
    if (tg.type === 'page') {
      if (tg.hit && tg.hit.lqCtrl && !horiz) lqRelease(tg.hit.lqCtrl);
      if (tg.rail && horiz && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) INP.mode = 'rail';
      else if (swqHoriz && PREFS.swipeQueue && tg.hit && tg.hit.rowTrack && (dx < 0 || (SWQ.key === tg.hit.rowKey && SWQ.baseX < 0))) {
        INP.mode = 'swipeRow';
        if (SWQ.key !== tg.hit.rowKey) {
          swqDetachToBg();
          swqAdoptFromBg(tg.hit.rowKey);
        }
        SWQ.tr = tg.hit.rowTrack;
        SWQ.key = tg.hit.rowKey;
        if (SWQ.state !== 'paused') { SWQ.baseX = SWQ.x || 0; SWQ.crossed = -SWQ.baseX >= SWQ_THRESHOLD - 0.5; SWQ.done = false; if (SWQ.baseX === 0) SWQ.crossP = 0; }
        SWQ.v = 0;
        SWQ.state = 'dragging';
        SWQ.startX = INP.x0;
      } else if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (SWQ.state === 'paused') { swqClose(); redraw(); }
        INP.mode = !horiz ? 'scroll' : 'none';
      }
    }
    else if (tg.type === 'sheet') {
      const tag = tg.hit && tg.hit.tag;
      if (tag === 'queue' && tg.hit.qRowTrack && SH.mode === 'queue' && swqHoriz && !SH.dragQueue &&
          (dx < 0 || (SWQ.key === tg.hit.qRowKey && SWQ.baseX < 0))) {
        INP.mode = 'swipeQueueRow';
        if (SWQ.key !== tg.hit.qRowKey) {
          swqDetachToBg();
          swqAdoptFromBg(tg.hit.qRowKey);
        }
        SWQ.tr = tg.hit.qRowTrack;
        SWQ.key = tg.hit.qRowKey;
        SWQ.qIdx = tg.hit.qRowIdx;
        if (SWQ.state !== 'paused') { SWQ.baseX = SWQ.x || 0; SWQ.crossed = -SWQ.baseX >= SWQ_THRESHOLD - 0.5; SWQ.done = false; if (SWQ.baseX === 0) SWQ.crossP = 0; }
        SWQ.v = 0;
        SWQ.state = 'dragging';
        SWQ.startX = INP.x0;
      } else if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (SWQ.state === 'paused') { swqClose(); redraw(); }
        INP.mode = (tag === 'lyrics' || tag === 'queue') && !horiz ? 'list' : (!horiz && (dy > 0 || SH.drag > 0 || (SH.target === 1 && dy < -8)) ? 'dismiss' : 'none');
      }
    }
    else if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
      if (tg.type === 'edge') INP.mode = horiz && dx > 0 ? 'edge' : (!horiz ? 'scroll' : 'none');
      else if (tg.type === 'mini') {
        if (Math.abs(dx) > Math.abs(dy) * .65) INP.mode = 'miniSwipe';
        else if (dy > 8) { INP.mode = 'miniDismiss'; _miniDismissHaptic = false; }
        else { INP.mode = 'none'; if (dy < -10) openSheet(); }
      }
      else INP.mode = 'none';
    }
  }
  if (INP.mode && INP.mode !== 'none') { relGlass(); if (typeof pressUp === 'function') pressUp(); }
  switch (INP.mode) {
    case 'scroll': { const max = Math.max(0, P.h - H); let d = ddy; if (P.scroll < 0 || P.scroll > max) d *= .35; P.scroll = clamp(P.scroll - d, -80, max + 80); redraw(); break; }
    case 'rail': { const r = P.rails[tg.rail.id]; let d = ddx; if (r.x < 0 || r.x > r.max) d *= .35; r.x = clamp(r.x - d, -48, r.max + 48); redraw(); break; }
    case 'edge': NAV.popP = NAV.popT = clamp(p.x / W, 0, 1); redraw(); break;
    case 'dismiss': {
      SH.lastTouch = now;
      let nextD = SH.drag + (SH.drag < 0 || (SH.drag + ddy < 0) ? ddy * .18 : ddy);
      SH.drag = Math.max(-16, nextD);
      redraw();
      break;
    }
    case 'miniSwipe': NAV.miniDx = clamp(dx, -160, 160); D.ov = true; break;
    case 'miniDismiss': {
      const nextDy = dy >= 0 ? clamp(dy * .92, 0, 72) : Math.max(-8, dy * .18);
      NAV.miniDy = nextDy;
      const crossed = nextDy >= 28;
      if (crossed && !_miniDismissHaptic) {
        _miniDismissHaptic = true;
        if (typeof window.haptic === 'function') window.haptic('threshold');
      } else if (!crossed && nextDy < 20) {
        _miniDismissHaptic = false;
      }
      D.ov = D.gl = true;
      break;
    }
    case 'swipeRow':
    case 'swipeQueueRow': {
      const nx = swqLimit(SWQ.baseX + (p.x - SWQ.startX));
      SWQ.x = nx;
      const c = -nx >= SWQ_THRESHOLD - 0.5;
      if (c !== SWQ.crossed) {
        SWQ.crossed = c;
        if (c) swqFireThreshold();
      }
      if (typeof redrawSheetContent === 'function') redrawSheetContent();
      else redraw();
      break;
    }
    case 'list': {
      if (SH.mode === 'lyrics') {
        let d = ddy; if (SH.lScroll < 0 || SH.lScroll > SH.lMax) d *= .35;
        SH.lScroll = clamp(SH.lScroll - d, -56, SH.lMax + 56);
        SH.lVel = 0; SH.lHold = 3.5;
      } else {
        SH.lastTouch = now;
        let d = ddy; if (SH.qScroll < 0 || SH.qScroll > SH.qMax) d *= .35;
        SH.qScroll = clamp(SH.qScroll - d, -56, SH.qMax + 56);
        SH.qVel = 0;
      }
      if (typeof redrawSheetContent === 'function') redrawSheetContent();
      else redraw();
      break;
    }
  }
});
function endPointer(e, cancel) {
  if (!INP.down) return; INP.down = false; const p = pt(e), v = velocity(), mode = INP.mode, tg = INP.tgt, P = topPage(), moved = Math.hypot(p.x - INP.x0, p.y - INP.y0), quick = performance.now() - INP.t0 < 600;
  INP.thumb.on = false; CM.pressRow = -1; OUT_DRAWER.pressRow = -1; relGlass(); if (typeof pressUp === 'function') pressUp(); try { $out.releasePointerCapture(INP.id); } catch (_) {}
  if (tg && tg.hit && tg.hit.lqCtrl) lqRelease(tg.hit.lqCtrl);
  if (cancel) {
    INP.rel = performance.now();
    if (mode === 'edge') NAV.popT = 0;
    if (mode === 'miniSwipe') NAV.miniDx = 0;
    if (mode === 'miniDismiss') { NAV.miniDy = 0; _miniDismissHaptic = false; }
    if (mode === 'queueGrip') { SH.dragQueue = null; }
    if (mode === 'outDrawerDrag') { OUT_DRAWER.drag = 0; }
    if (mode === 'swipeRow' || mode === 'swipeQueueRow' || SWQ.state === 'paused') { swqClose(); }
    SH.scrub = null;
    SH.volDrag = false;
    redraw();
    return;
  }
  if (mode === 'outDrawerDrag') {
    const g = outDrawerGeom();
    if (OUT_DRAWER.drag > Math.min(90, g.h * .28) || v.y > 650) {
      OUT_DRAWER.sp.x = clamp(1 - OUT_DRAWER.drag / Math.max(1, H - OUT_DRAWER.r.y), 0, 1);
      OUT_DRAWER.drag = 0;
      closeOutDrawer();
    } else {
      D.ov = D.gl = true;
    }
    return;
  }
  if (mode === 'queueGrip') {
    if (SH.dragQueue) {
      const dq = SH.dragQueue;
      const fromIdx = dq.fromIdx;
      const toIdx = dq.toIdx != null ? dq.toIdx : fromIdx;
      if (fromIdx != null && toIdx != null && fromIdx !== toIdx) {
        if (typeof window.reorderQueue === 'function') window.reorderQueue(fromIdx, toIdx);
      }
      if (typeof window.haptic === 'function') window.haptic('drop');
      SH.qSettle = {
        item: dq.rowItem,
        idx: toIdx != null ? toIdx : (fromIdx || 0),
        relY: dq.lastRelY != null ? dq.lastRelY : ((toIdx != null ? toIdx : (fromIdx || 0)) * 60),
        lift: dq.lift != null ? dq.lift : 1
      };
      SH.dragQueue = null;
    }
    redraw();
    return;
  }
  if (mode === 'scrub') { seek(SH.scrub * cur().dur); SH.scrub = null; redraw(); return; }
  if (mode === 'vol') { SH.volDrag = false; redraw(); return; }
  if (mode === 'setDrag') { if (typeof flushPrefsSave === 'function') flushPrefsSave(); redraw(); return; }
  if (mode === 'lqDrag') {
    if (tg && tg.hit && tg.hit.lqCommit) tg.hit.lqCommit();
    redraw(); return;
  }
  if (mode === 'swipeQueueRow') {
    const nowMs = performance.now();
    const lastS = INP.samples.length ? INP.samples[INP.samples.length - 1] : null;
    const vx = (lastS && (nowMs - lastS.t) > 90) ? 0 : clamp(v.x, -3000, 3000);
    const flick = vx < -900 && -SWQ.x > SWQ_THRESHOLD * 0.55;
    if ((SWQ.crossed || flick) && SWQ.tr) {
      if (!SWQ.crossed) {
        SWQ.crossed = true;
        swqFireThreshold();
      }
      const snapSw = { x: SWQ.x, v: vx, crossP: SWQ.crossP, hitT: SWQ.hitT };
      const remIdx = SWQ.qIdx;
      const remTr = SWQ.tr;
      swqReset();
      if (typeof window.removeFromQueue === 'function') window.removeFromQueue(remIdx, remTr, snapSw);
      else if (typeof removeFromQueue === 'function') removeFromQueue(remIdx, remTr, snapSw);
    } else {
      SWQ.target = 0;
      SWQ.v = vx;
      SWQ.state = 'returning';
    }
    redraw(); return;
  }
  if (mode === 'swipeRow') {
    const nowMs = performance.now();
    const lastS = INP.samples.length ? INP.samples[INP.samples.length - 1] : null;
    const vx = (lastS && (nowMs - lastS.t) > 90) ? 0 : clamp(v.x, -3000, 3000);
    const flick = vx < -900 && -SWQ.x > SWQ_THRESHOLD * 0.55;
    if ((SWQ.crossed || flick) && SWQ.tr) {
      if (!SWQ.crossed) {
        SWQ.crossed = true;
        swqFireThreshold();
      }
      swqEnqueue(SWQ.tr);
      SWQ.done = true;
      SWQ.doneT = nowMs;
      SWQ.target = -SWQ_HOLD;
      SWQ.v = vx;
      SWQ.state = 'opening';
    } else {
      SWQ.target = 0;
      SWQ.v = vx;
      SWQ.state = 'returning';
    }
    redraw(); return;
  }
  if (mode === 'scroll') {
    const max = Math.max(0, P.h - H);
    P.vel = -v.y;
    if ((P.scroll < 0 && P.vel < 0) || (P.scroll > max && P.vel > 0)) P.vel *= .25;
    redraw(); return;
  }
  if (mode === 'rail') {
    const r = P.rails[tg.rail.id];
    r.vel = -v.x;
    if ((r.x < 0 && r.vel < 0) || (r.x > r.max && r.vel > 0)) r.vel *= .25;
    if (r.snap) { r.to = clamp(Math.round((r.x + r.vel * .16) / r.snap) * r.snap, 0, r.max); r.vel = 0; }
    redraw(); return;
  }
  if (mode === 'edge') {
    NAV.popT = (NAV.popP > .35 || v.x > 600) ? 1 : 0; redraw(); return;
  }
  if (mode === 'dismiss') { if (SH.drag > H * .16 || v.y > 700) { SH.t = clamp(1 - SH.drag / H, 0, 1); SH.drag = 0; SH.target = 0; } redraw(); return; }
  if (mode === 'miniDismiss') {
    const dy = p.y - INP.y0;
    const shouldDismiss = NAV.miniDy >= 28 || (v.y > 420 && dy > 10);
    _miniDismissHaptic = false;
    if (shouldDismiss) {
      if (typeof window.haptic === 'function') window.haptic('drop');
      if (typeof dismissMiniPlayer === 'function') dismissMiniPlayer();
      else if (typeof window.dismissMiniPlayer === 'function') window.dismissMiniPlayer();
    } else {
      redraw();
    }
    return;
  }
  if (mode === 'miniSwipe') {
    const dx = p.x - INP.x0;
    if (dx > 18 || v.x > 180) {
      const prevT = cur();
      if (prevT) { _miniTrans.tr = prevT; _miniTrans.dx = NAV.miniDx || 0; _miniTrans.dir = 1; _miniTrans.t = 1; }
      NAV.miniDx = -72;
      next();
    } else if (dx < -18 || v.x < -180) {
      const prevT = cur();
      if (prevT) { _miniTrans.tr = prevT; _miniTrans.dx = NAV.miniDx || 0; _miniTrans.dir = -1; _miniTrans.t = 1; }
      NAV.miniDx = 72;
      prev(true);
    }
    redraw(); return;
  }
  if (mode === 'list') {
    if (SH.mode === 'queue') {
      SH.qVel = -v.y;
      if ((SH.qScroll < 0 && SH.qVel < 0) || (SH.qScroll > SH.qMax && SH.qVel > 0)) SH.qVel *= .25;
    } else {
      SH.lVel = -v.y;
      if ((SH.lScroll < 0 && SH.lVel < 0) || (SH.lScroll > SH.lMax && SH.lVel > 0)) SH.lVel *= .25;
      SH.lHold = 3.5;
    }
    redraw(); return;
  }
  if (tg && tg.type === 'outDrawer') {
    const hit = outDrawerHit(p.x, p.y);
    if (hit === -3 || hit === -2) closeOutDrawer();
    else if (hit === -4) {
      closeOutDrawer();
      if (typeof window !== 'undefined' && window.SonoraNative && typeof window.SonoraNative.openSystemOutputSwitcher === 'function') {
        window.SonoraNative.openSystemOutputSwitcher();
      }
    } else if (hit >= 0) outDrawerAct(hit);
    else D.ov = true;
    return;
  }
  if (tg && tg.type === 'cm') {
    const g = cmGeom(), r = { x: g.rx, y: g.ry, w: g.rw, h: g.rh };
    if (inR(r, p.x, p.y)) {
      const i = cmHitRow(p.x, p.y);
      if (i >= 0) cmAct(i);
      else if (i === -4) {
        cmPlayNow(CM.tr);
      } else if (i === -2) {
        if (CM.mode && CM.mode !== 'menu') {
          setCmMode('menu', null);
        } else {
          closeCM();
        }
      } else D.ov = true;
    } else closeCM();
    return;
  }
  if (SWQ.state === 'paused') { swqClose(); redraw(); }
  if (mode === 'none' || !tg) return;
  if (tg.type === 'tab') { const i = clamp(Math.round(SP.tab.t), 0, 3); SP.tab.t = i; INP.rel = performance.now(); goTab(TABS[i][0]); return; }
  if (!quick || moved > 12) return;
  if (tg.type === 'menu') { const m = menuRect(); if (inR(m, p.x, p.y)) { const i = Math.floor((p.y - (m.y + 40)) / 46); const items = getMenuItems(); if (i >= 0 && i < items.length) applyTheme(items[i][1]); } NAV.menu = false; redraw(); return; }
  if (tg.type === 'search') {
    const dk = dock(), s = dk.search;
    if (dk.sm > .5 && NAV.tab === 'search' && NAV.query && p.x > s.x + s.w - 48) {
      NAV.query = ''; $q.value = '';
      const sp = NAV.stacks && NAV.stacks.search && NAV.stacks.search[0];
      if (sp) { sp.scroll = 0; sp.vel = 0; sp.scrollTo = null; }
    } else {
      if (NAV.tab !== 'search') goTab('search');
      else if (stackOf().length > 1) {
        NAV.stacks.search = [NAV.stacks.search[0]];
        NAV.popP = NAV.popT = 0;
        $q.value = NAV.query || '';
      }
      NAV.focus = true; $q.focus(); INP.focusPending = true;
    }
    redraw(); return;
  }
  if (tg.type === 'btn') { tg.fn(); return; }
  if (tg.type === 'mini') { const dk = dock(), m = dk.mini; if (dk.em > .5) { if (p.x > m.x + m.w - 56) togglePlay(); else openSheet(); } else if (p.x > m.x + m.w - 52) next(); else if (p.x > m.x + m.w - 100) togglePlay(); else openSheet(); return; }
  if (tg.type === 'sheet') {
    SH.lastTouch = performance.now();
    if (SH.aloneT > .45 && p.y > TOP + 106) { redraw(); return; }
    const h = (OV_SHITS.length && topmost(OV_SHITS, p.x, p.y, true)) || topmost(SHITS, p.x, p.y, true); if (h) h.fn(); return;
  }
  if (tg.type === 'page') {
    if (NAV.focus) { $q.blur(); }
    if (tg.hit && tg.hit.lqTap) { tg.hit.lqTap(); redraw(); return; }
    const h = (tg && tg.hit && tg.hit.fn) ? tg.hit : topmost(HITS, p.x, p.y, true, 8); if (h) h.fn();
  }
}
$out.addEventListener('pointerup', e => { endPointer(e, false); if (typeof armHistory === 'function') armHistory(); });
/* prevent synthetic browser mousedown/click after touch from stealing focus from the search input onto the canvas */
$out.addEventListener('mousedown', e => e.preventDefault());
$out.addEventListener('click', () => {
  if (isSonoraPromptOpen()) {
    INP.focusPending = false;
    const el = typeof document !== 'undefined' ? document.getElementById('sonoraPrompt') : null;
    const inp = typeof document !== 'undefined' ? document.getElementById('promptInput') : null;
    if (inp && el && (!el.dataset || el.dataset.confirmOnly !== '1') && document.activeElement !== inp) {
      try { inp.focus({ preventScroll: true }); } catch (_) { try { inp.focus(); } catch (_) {} }
    }
    return;
  }
  if (INP.focusPending) { INP.focusPending = false; if (document.activeElement !== $q) $q.focus(); }
});
$out.addEventListener('pointercancel', e => endPointer(e, true));
$out.addEventListener('wheel', e => {
  e.preventDefault();
  if (SH.t > .5) { if (SH.mode === 'queue') SH.qScroll = clamp(SH.qScroll + e.deltaY, 0, SH.qMax); else if (SH.mode === 'lyrics') { SH.lScroll = clamp(SH.lScroll + e.deltaY, 0, SH.lMax); SH.lHold = 3.5; } }
  else { const P = topPage(); P.scroll = clamp(P.scroll + e.deltaY, 0, Math.max(0, P.h - H)); P.vel = 0; }
  redraw();
}, { passive: false });
window.addEventListener('keydown', e => { if (e.target === $q) return; if (e.key === 'Escape') { NAV.menu = false; if (OUT_DRAWER.open) { closeOutDrawer(); } else if (CM.open) { closeCM(); } else if (SRCUI.open) { SRCUI.open = false; redraw(); } else closeSheet(); } else if (e.key === ' ') { e.preventDefault(); togglePlay(); } else if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); });
$q.addEventListener('input', () => {
  const P = topPage(), val = $q.value;
  if (hasPill(P) && P.qOpen) {
    if (P.q !== val) { P.q = val; redraw(); }
  } else if (NAV.tab === 'library' && stackOf().length === 1 && P.libQOpen) {
    if (P.libQ !== val) { P.libQ = val; redraw(); }
  } else {
    const prev = (NAV.query || '').trim(), next = val.trim(), sp = NAV.stacks.search[0];
    if (NAV.query === val) return;
    const hasActiveRes = typeof LIVE !== 'undefined' && LIVE.search && !!LIVE.search.res;
    const isAppend = prev.length > 0 && next.length >= prev.length && next.toLowerCase().startsWith(prev.toLowerCase()) && hasActiveRes;
    NAV.query = val;
    if (!isAppend) { sp.scroll = 0; sp.vel = 0; sp.scrollTo = null; }
    redraw();
  }
});
window.__NATIVE_KBH__ = 0;
window.updateKeyboardInset = function(imeDp) {
  const nk = imeDp < 1 ? 0 : imeDp;
  window.__NATIVE_KBH__ = nk;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--prompt-kb', Math.round(nk) + 'px');
  }
  if (Math.abs(nk - KBH) > 0.5) {
    KBH = nk;
    if (typeof layout === 'function') layout();
    redraw();
  } else if (typeof window._promptGlassAlpha === 'number' && window._promptGlassAlpha > 0.01) {
    redraw();
  }
};
function updateKBH() {
  const hasNative = (typeof window !== 'undefined' && window.SonoraNative);
  if (hasNative) {
    const nativeKb = (typeof window.SonoraNative.getKeyboardHeight === 'function')
      ? window.SonoraNative.getKeyboardHeight() : 0;
    const curNative = Math.max(window.__NATIVE_KBH__ || 0, nativeKb || 0);
    if (KBH !== curNative) {
      KBH = curNative;
      redraw();
    }
    return;
  }
  if (!window.visualViewport) return;
  OUT_RECT = $out.getBoundingClientRect();
  const kbTop = visualViewport.offsetTop + visualViewport.height - OUT_RECT.top;
  const k = Math.max(0, ($out.clientHeight || innerHeight) - kbTop);
  const nk = k < 40 ? 0 : k;
  if (nk !== KBH) { KBH = nk; redraw(); }
}
if (window.visualViewport) { visualViewport.addEventListener('resize', updateKBH); visualViewport.addEventListener('scroll', updateKBH); }
window.addEventListener('resize', () => {
  if (typeof relayout === 'function') relayout();
  else redraw();
});
if (typeof ResizeObserver !== 'undefined' && typeof $out !== 'undefined' && $out) {
  try {
    new ResizeObserver(() => {
      if (typeof relayout === 'function') relayout();
      else redraw();
    }).observe($out);
  } catch (_) {}
}
$q.addEventListener('focus', () => {
  if (SH.t > .05 || SH.target > .05 || OUT_DRAWER.open || CM.open || NAV.menu || SRCUI.open || isSonoraPromptOpen()) { $q.blur(); return; }
  const P = topPage();
  if (NAV.tab === 'search' && stackOf().length > 1 && !(hasPill(P) && P.qOpen)) { $q.blur(); return; }
  if (!(hasPill(P) && P.qOpen) && !(NAV.tab === 'library' && stackOf().length === 1 && P.libQOpen) && NAV.tab !== 'search') { $q.value = NAV.query || ''; goTab('search'); }
  NAV.focus = true; updateKBH(); redraw();
});
$q.addEventListener('blur', () => { const P = topPage(); if (P && P.libQOpen && !(P.libQ || '').trim()) P.libQOpen = false; NAV.focus = false; updateKBH(); redraw(); });
$q.addEventListener('keydown', e => { if (e.key === 'Enter') $q.blur(); });

let histDepth = 0, inPopState = false;
function navDepth() {
  const s = stackOf(), rem = Math.max(1, s.length - (NAV.popT === 1 ? 1 : 0)), P = s[rem - 1];
  let d = (NAV.tab !== 'home' ? 1 : 0) + (rem - 1);
  if (P && hasPill(P) && P.qOpen) d++;
  if (P && P.libQOpen) d++;
  if (SH.target > .5) d++;
  if (NAV.menu) d++;
  if (SRCUI.open) d++;
  if (CM.open) d++;
  if (OUT_DRAWER.open) d++;
  return d;
}
function canGoBack() { return navDepth() > 0; }
function armHistory() {
  if (inPopState) return;
  const need = navDepth();
  while (histDepth < need) {
    histDepth++;
    try { history.pushState({ sonora: histDepth }, ''); } catch (e) { break; }
  }
}
function syncHistory() {
  if (inPopState) return;
  const need = navDepth();
  if (need > histDepth) {
    armHistory();
  } else if (need < histDepth) {
    const diff = histDepth - need;
    inPopState = true;
    histDepth = need;
    try { history.go(-diff); } catch (e) {}
    setTimeout(() => { inPopState = false; }, 80);
  }
}
try { history.replaceState({ sonora: 0 }, ''); } catch (e) {}
window.addEventListener('popstate', () => {
  if (inPopState) return;
  histDepth = Math.max(0, histDepth - 1);
  const P = topPage(), s = stackOf();
  if (OUT_DRAWER.open) closeOutDrawer();
  else if (CM.open) closeCM();
  else if (SRCUI.open) { SRCUI.open = false; redraw(); }
  else if (NAV.menu) { NAV.menu = false; redraw(); }
  else if (SH.target > .5 || SH.t > .5) closeSheet();
  else if (P && hasPill(P) && P.qOpen) { P.qOpen = false; P.q = ''; $q.value = ''; $q.blur(); redraw(); }
  else if (P && P.libQOpen) { P.libQOpen = false; P.libQ = ''; $q.value = ''; $q.blur(); redraw(); }
  else if (s.length > 1) {
    if (NAV.popT === 1) { s.pop(); NAV.popP = NAV.popT = 0; }
    if (s.length > 1) pop(); else redraw();
  } else if (NAV.tab === 'search') goTab(NAV.last && NAV.last !== 'search' ? NAV.last : 'home');
  else if (NAV.tab !== 'home') goTab('home');
  const remNeed = navDepth();
  if (remNeed > histDepth) {
    while (histDepth < remNeed) {
      histDepth++;
      try { history.pushState({ sonora: histDepth }, ''); } catch (e) { break; }
    }
  }
});

/* Overlay the invisible <input> directly over the open search bar so touch opens the soft keyboard on first tap */
let qSty = '';
function syncQ() {
  const css = 'position:fixed;left:0;top:0;width:320px;height:48px;opacity:0;pointer-events:none;direction:ltr;text-align:left;';
  if (css !== qSty) { qSty = css; $q.style.cssText = css; }
}
let lastT = performance.now(), FALLBACK = null;
function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  physics(dt); stepNav(dt); tickPlayer(dt); syncQ(); syncHistory();
  const spinCont = typeof isSpinnerActive === 'function' && isSpinnerActive();
  const animCont = (spinCont && SH.t > .01) ||
    (typeof window !== 'undefined' && window._lyIntroActive && SH.t > .5 && SH.mode === 'lyrics' && PL.playing);
  const ovCont = spinCont && SH.t < .98 && typeof cur === 'function' && !!cur();
  if (animCont) {
    D.scene = true;
    D.gl = true;
  }
  if (ovCont) {
    D.ov = true;
    D.gl = true;
  }
  if (typeof syncPromptGeom === 'function' && syncPromptGeom()) {
    D.ov = true;
    D.gl = true;
  }
  if (D.scene) {
    if (typeof _skulletActive !== 'undefined') _skulletActive = false;
    if (typeof window !== 'undefined') window._artFadeActive = false;
    drawScene();
    if (!FALLBACK) lg.markSceneDirty();
    D.scene = _inDrawScenePending;
    if (_inDrawScenePendingOv) { D.ov = true; _inDrawScenePendingOv = false; }
    _inDrawScenePending = false;
    D.gl = true;
  }
  if (D.ov) { if (drawOverlay() && !FALLBACK) lg.markOverlayDirty(); D.ov = false; D.gl = true; }
  if (FALLBACK) { if (D.gl) { FALLBACK.setTransform(1, 0, 0, 1, 0, 0); FALLBACK.drawImage(S, 0, 0); FALLBACK.drawImage(O, 0, 0); D.gl = false; } }
  else {
    lg._blurFreeze = false;
    lg._blurStale = false;
    if (D.gl || INP.down || INP.thumb.press > 0 || lg.busy) {
      updateGlass(dt); lg.render(); D.gl = false;
    }
  }
  requestAnimationFrame(frame);
}
function init() {
  try { initGlass(); lg.setScene(S); lg.setOverlay(O); }
  catch (err) { console.warn('WebGL non disponibile, uso il disegno semplice', err); FALLBACK = $out.getContext('2d'); const tb = document.getElementById('topbar'); if (tb) tb.style.display = 'block'; new ResizeObserver(() => { $out.width = $out.clientWidth * 2; $out.height = $out.clientHeight * 2; relayout(); }).observe($out); }
  if (!FALLBACK) relayout(); else { $out.width = $out.clientWidth * 2; $out.height = $out.clientHeight * 2; relayout(); }
  applyTheme(); requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
    if (typeof _clearFitCache === 'function') _clearFitCache();
    Object.keys(ARTC).forEach(k => { if (ARTC[k] && !ARTC[k]._real) delete ARTC[k]; });
    Object.keys(PALC).forEach(k => { if (PALC[k] && !PALC[k]._real && ARTC[k] && !ARTC[k]._real) delete PALC[k]; });
    redraw();
  });
}

let _resumeTimer = null;
function _handleSonoraResume() {
  lastT = performance.now();
  if (typeof layout === 'function' && W > 0 && H > 0) layout();
  redraw();
  if (!FALLBACK && typeof lg !== 'undefined' && lg) {
    const lost = !!(lg._lost || (lg.gl && typeof lg.gl.isContextLost === 'function' && lg.gl.isContextLost()));
    if (!lost) {
      lg._sceneUp = false;
      lg._overlayUp = false;
      if (typeof lg.resize === 'function') lg.resize();
      if (typeof lg.markSceneDirty === 'function') lg.markSceneDirty();
      if (typeof lg.markOverlayDirty === 'function') lg.markOverlayDirty();
      if (S.width > 0 && W > 0 && H > 0) {
        drawScene();
        drawOverlay();
        updateGlass(0);
        lg.render();
        D.scene = D.ov = D.gl = false;
      }
    }
  } else if (FALLBACK && typeof S !== 'undefined' && S.width > 0 && W > 0 && H > 0) {
    drawScene();
    drawOverlay();
    FALLBACK.setTransform(1, 0, 0, 1, 0, 0);
    FALLBACK.drawImage(S, 0, 0);
    FALLBACK.drawImage(O, 0, 0);
    D.scene = D.ov = D.gl = false;
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { redraw(); });
  if (!_resumeTimer && typeof setTimeout === 'function') {
    _resumeTimer = setTimeout(() => {
      _resumeTimer = null;
      redraw();
    }, 48);
  }
}
if (typeof window !== 'undefined') {
  window.onSonoraResume = _handleSonoraResume;
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) _handleSonoraResume();
    });
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pageshow', _handleSonoraResume);
    window.addEventListener('focus', _handleSonoraResume);
  }
}
