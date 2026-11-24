(function () {
  'use strict';

  const I18N_COUNTRIES = [
    { code: 'auto', it: 'Automatica', en: 'Automatic' },
    { code: 'IT', it: 'Italia (IT)', en: 'Italy (IT)' },
    { code: 'US', it: 'Stati Uniti (US)', en: 'United States (US)' },
    { code: 'GB', it: 'Regno Unito (GB)', en: 'United Kingdom (GB)' },
    { code: 'FR', it: 'Francia (FR)', en: 'France (FR)' },
    { code: 'DE', it: 'Germania (DE)', en: 'Germany (DE)' },
    { code: 'ES', it: 'Spagna (ES)', en: 'Spain (ES)' },
    { code: 'JP', it: 'Giappone (JP)', en: 'Japan (JP)' },
    { code: 'BR', it: 'Brasile (BR)', en: 'Brazil (BR)' },
    { code: 'CA', it: 'Canada (CA)', en: 'Canada (CA)' },
    { code: 'AU', it: 'Australia (AU)', en: 'Australia (AU)' },
    { code: 'CH', it: 'Svizzera (CH)', en: 'Switzerland (CH)' },
    { code: 'NL', it: 'Paesi Bassi (NL)', en: 'Netherlands (NL)' },
    { code: 'SE', it: 'Svezia (SE)', en: 'Sweden (SE)' },
    { code: 'PT', it: 'Portogallo (PT)', en: 'Portugal (PT)' },
    { code: 'MX', it: 'Messico (MX)', en: 'Mexico (MX)' },
    { code: 'AR', it: 'Argentina (AR)', en: 'Argentina (AR)' },
    { code: 'KR', it: 'Corea del Sud (KR)', en: 'South Korea (KR)' },
    { code: 'IN', it: 'India (IN)', en: 'India (IN)' },
    { code: 'PL', it: 'Polonia (PL)', en: 'Poland (PL)' }
  ];

  const I18N_MONTHS = {
    it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  const I18N_DICT = {
    it: {
      // Tabs
      'tab.home': 'Home',
      'tab.new': 'Novità',
      'tab.radio': 'Radio',
      'tab.library': 'Libreria',
      'tab.search': 'Cerca',

      // Common
      'common.track': 'Brano',
      'common.tracks': 'Brani',
      'common.artist': 'Artista',
      'common.artists': 'Artisti',
      'common.album': 'Album',
      'common.albums': 'Album',
      'common.playlist': 'Playlist',
      'common.playlist_lc': 'playlist',
      'common.playlists': 'Playlist',
      'common.single': 'Singolo',
      'common.release': 'Release',
      'common.cancel': 'Annulla',
      'common.create': 'Crea',
      'common.save': 'Salva',
      'common.remove': 'Rimuovi',
      'common.stop': 'Interrompi',
      'common.continue': 'Continua',
      'common.download': 'Scarica',
      'common.share': 'Condividi',
      'common.play': 'Riproduci',
      'common.shuffle': 'Casuale',
      'common.refresh': 'Aggiorna',
      'common.favorites': 'Preferiti',
      'common.recent': 'Recenti',
      'common.loading': 'Caricamento…',
      'common.month': 'Mese',
      'common.songs': 'Brani',
      'common.all': 'Tutto',
      'common.added': 'Aggiunto',
      'common.in_queue': 'In coda',
      'common.queued': 'In coda',
      'common.offline_songs': 'Scaricati',
      'common.mb_unit': 'MB',
      'common.hours_1': '1 ora',
      'common.minutes_n': '{count} minuti',
      'common.min_short': 'min',
      'common.brand': 'Sonora',

      // Months
      'months.0': 'Gennaio',
      'months.1': 'Febbraio',
      'months.2': 'Marzo',
      'months.3': 'Aprile',
      'months.4': 'Maggio',
      'months.5': 'Giugno',
      'months.6': 'Luglio',
      'months.7': 'Agosto',
      'months.8': 'Settembre',
      'months.9': 'Ottobre',
      'months.10': 'Novembre',
      'months.11': 'Dicembre',

      // Navigation & Search bars
      'nav.search_tracks_hint': 'Cerca fra i brani',
      'nav.search_all_hint': 'Brani, artisti, album, playlist',
      'nav.search_aria': 'Cerca',

      // Prompt modal & playlist creation
      'prompt.new_playlist_title': 'Nuova playlist',
      'prompt.new_playlist_sub': 'Inserisci un titolo o incolla un link YouTube Music / Spotify',
      'prompt.rename_playlist_sub': 'Scegli un nuovo titolo per la raccolta',
      'prompt.playlist_placeholder': 'Titolo o link playlist…',
      'prompt.cancel': 'Annulla',
      'prompt.create': 'Crea',
      'prompt.import': 'Importa',
      'prompt.save': 'Salva',
      'prompt.new_playlist_btn': '+ Nuova playlist',
      'prompt.importing_title': 'Importazione playlist',
      'prompt.importing_sub': 'Risolvo i brani dal link…',
      'prompt.import_download_title': 'Playlist importata',
      'prompt.import_download_msg': 'Importati {count} brani in “{name}”. Vuoi scaricarli per l’ascolto offline?',
      'prompt.not_now': 'Non ora',
      'prompt.download_now': 'Scarica',

      // Toasts
      'toast.browser_blocked': 'Riproduzione bloccata dal browser: tocca play',
      'toast.shuffle_on': 'Riproduzione casuale attiva',
      'toast.smart_shuffle_on': 'Smart Shuffle ✦ attivo · 1 brano consigliato ogni 3',
      'toast.shuffle_off': 'Riproduzione casuale disattivata',
      'toast.link_copied': 'Link copiato negli appunti',
      'toast.share_prefix': 'Condividi: {text}',
      'toast.added_to': 'Aggiunto a {name}',
      'toast.removed_from_playlist': 'Rimosso dalla playlist',
      'toast.playlist_created': 'Playlist “{name}” creata',
      'toast.playlist_renamed': 'Playlist rinominata',
      'toast.playlist_deleted': 'Playlist eliminata',
      'toast.cover_updated': 'Copertina aggiornata',
      'toast.removed_downloads': 'Rimosso dai brani scaricati',
      'toast.download_cancelled': 'Download annullato',
      'toast.download_failed': 'Impossibile scaricare i brani',
      'toast.download_empty': 'Nessun brano da scaricare',
      'toast.download_done_one': 'Scaricato: {title}',
      'toast.download_done_partial': 'Scaricati {done} brani ({failed} non riusciti)',
      'toast.download_saved_one': 'Salvato in Brani scaricati ({count} brano)',
      'toast.download_saved_many': 'Salvato in Brani scaricati ({count} brani)',
      'toast.import_one': '{count} file audio importato',
      'toast.import_many': '{count} file audio importati',
      'toast.cannot_play': 'Impossibile riprodurre “{title}”',
      'toast.no_tracks_available': 'Nessun brano disponibile',
      'toast.starting_station': 'Avvio {title}…',
      'toast.loading_station': 'Carico {title}…',
      'toast.no_songs_found': 'Nessun brano trovato',
      'toast.error_prefix': 'Errore: {msg}',
      'toast.sleep_off': 'Timer disattivato',
      'toast.sleep_eom': 'Spegnimento al termine del brano',
      'toast.sleep_done': 'Timer completato',
      'toast.sleep_set_1h': 'Timer impostato: 1 ora',
      'toast.sleep_set_min': 'Timer impostato: {count} minuti',
      'toast.song_radio_started': 'Radio brano avviata: {title}',
      'toast.artist_radio_started': 'Radio artista avviata: {name}',
      'toast.popular_added_queue': 'Brani popolari aggiunti in coda',
      'toast.play_next': 'Riproduci dopo: {title}',
      'toast.added_to_queue': 'Aggiunto in coda: {title}',
      'toast.fav_added': 'Aggiunto ai preferiti',
      'toast.fav_removed': 'Rimosso dai preferiti',
      'toast.pin_added': 'Fissato in cima',
      'toast.pin_removed': 'Rimosso dai fissati',
      'toast.cache_cleared': 'Cache svuotata',
      'toast.recs_error': 'Errore caricamento consigli',
      'toast.locale_updated': 'Lingua e regione aggiornate',
      'toast.backup_exported': 'Backup libreria esportato',
      'toast.backup_export_failed': 'Impossibile esportare il backup',
      'toast.backup_restored': 'Libreria ripristinata dal backup',
      'toast.backup_invalid': 'File di backup non valido',
      'toast.offline_mode': 'Modalità offline attiva',
      'toast.back_online': 'Connessione ripristinata',
      'toast.playlist_imported': 'Importati {count} brani in “{name}”',
      'toast.playlist_import_failed': 'Importazione non riuscita: {err}',

      // Offline mode & Search history
      'offline.title': 'Sei offline',
      'offline.sub': 'Ascolta i brani scaricati e i file locali senza connessione',
      'offline.downloads_btn': 'Download ({count})',
      'offline.local_btn': 'File locali ({count})',
      'offline.no_downloads': 'Nessun brano scaricato disponibile offline',
      'offline.search_badge': 'Risultati offline (Download e file locali)',
      'search.recent_title': 'DALLE TUE RICERCHE',
      'search.clear_history': 'Svuota',
      'search.suggestions': 'Suggerimenti',

      // Downloads
      'download.loading_tracks': 'Caricamento brani…',
      'download.collection_fallback': 'la raccolta',
      'download.collection_title_fallback': 'Raccolta',
      'download.in_progress_title': 'Download in corso',
      'download.in_progress_msg': 'Scaricati {done} di {total} brani da “{title}”. Vuoi interrompere?',
      'download.remove_title': 'Rimuovi dai download',
      'download.remove_msg_one': 'Rimuovere {count} brano di “{title}” dai file offline?',
      'download.remove_msg_many': 'Rimuovere {count} brani di “{title}” dai file offline?',
      'download.album_title': 'Scarica album',
      'download.playlist_title': 'Scarica playlist',
      'download.confirm_msg_one': 'Vuoi scaricare {count} brano da “{title}”?',
      'download.confirm_msg_many': 'Vuoi scaricare {count} brani da “{title}”?',
      'download.stopping': 'Interrompi download ({done}/{total})',

      // Local audio
      'local.file': 'File locale',
      'local.files': 'File locali',
      'local.device': 'Dispositivo',
      'local.import_title': 'Importa file audio',

      // Audio outputs & status
      'audio.speaker': 'Altoparlante dispositivo',
      'audio.auto_device': 'Automatico · {name}',
      'audio.auto_default': 'Automatico (Predefinito)',
      'audio.auto_label': 'Uscita audio automatica',
      'audio.android_system': 'Sistema Android',
      'audio.output_header': 'Uscita audio',
      'audio.output_toast': 'Uscita: {name}',
      'audio.selected_device': 'Dispositivo selezionato',
      'audio.tap_to_retry': 'Tocca per riprovare',
      'audio.no_content': 'nessun contenuto',
      'audio.webgl_fallback': 'WebGL non disponibile, uso il disegno semplice',
      'audio.quality_hires': 'Hi-Res Lossless',
      'audio.quality_lossless': 'Lossless',

      // Lyrics & player sheet
      'lyrics.kind_word': 'Parola per parola',
      'lyrics.kind_line': 'Per riga',
      'lyrics.kind_plain': 'Non sincronizzato',
      'lyrics.unavailable': 'Testo non disponibile',
      'lyrics.loading': 'Caricamento del testo…',
      'lyrics.sources_title': 'Testi',
      'lyrics.source_header': 'FONTE',
      'lyrics.sources_loading': 'Caricamento delle fonti…',
      'lyrics.backend_required': 'Disponibile con il backend collegato',
      'lyrics.status_loading': 'Caricamento…',
      'lyrics.status_unreachable': 'Non raggiungibile',
      'lyrics.status_none': 'Nessun testo',
      'lyrics.other_sources': 'Altre fonti',
      'lyrics.style_header': 'STILE',
      'lyrics.style_animated': 'Animato',
      'lyrics.style_classic': 'Classico',
      'lyrics.style_animated_sub': 'Animato (Sillabe)',

      // Queue
      'queue.in_queue_artist': 'In coda · {artist}',
      'queue.up_next': 'Prossimi brani',
      'queue.smart_shuffle_sub': 'Smart Shuffle ✦ · 1 consiglio ogni 3 brani',
      'queue.autoplay_sub': 'Continua con brani simili',
      'queue.end_sub': 'Fine della coda',
      'queue.infinity_off_prefix': 'La coda infinita',
      'queue.infinity_off_suffix': 'è disattivata.',
      'queue.infinity_off_hint': 'Attivala in alto per continuare con brani simili',

      // Home page
      'home.title': 'Home',
      'home.load_error': 'Impossibile caricare la Home: {err}',
      'home.recent': 'Ascoltati di recente',
      'home.forgotten': 'Riscopri i tuoi classici',
      'home.quick_picks': 'Scelte rapide',
      'home.new_releases': 'Nuove uscite',
      'home.similar_to': 'Simile a…',
      'home.recommended_playlists': 'Playlist consigliate',
      'home.recommended_for_you': 'Consigliato per te',
      'home.artists_for_you': 'Artisti per te',
      'home.playlists_for_you': 'Playlist per te',

      // New page
      'new_page.title': 'Novità',
      'new_page.load_error': 'Impossibile caricare le novità: {err}',
      'new_page.albums_singles': 'Album e singoli',
      'new_page.top_tracks': 'Brani del momento',
      'new_page.top_chart': 'Classifica Top Brani',
      'new_page.trending_artists': 'Artisti in tendenza',
      'new_page.new_album': 'Nuovo album',
      'new_page.latest_tracks': 'Brani più recenti',
      'new_page.more_new': 'Altre novità',

      // Radio & Moods
      'radio.title': 'Radio',
      'radio.load_error': 'Impossibile caricare Radio: {err}',
      'radio.loading_feed': 'Caricamento stazioni e mood…',
      'radio.moods_eyebrow': 'MOOD E MOMENTI',
      'radio.explore_genres': 'Esplora i generi',
      'radio.stations_moods': 'Stazioni e mood',
      'radio.live_now': 'In diretta',
      'radio.loading_mood': 'Caricamento playlist per “{title}”…',
      'radio.no_playlists': 'Nessuna playlist trovata',

      // Mood chips
      'moods.energia': 'Energia pura',
      'moods.energia_q': 'energia pura workout',
      'moods.relax': 'Relax',
      'moods.relax_q': 'relax chill',
      'moods.workout': 'Allenamento',
      'moods.workout_q': 'allenamento palestra',
      'moods.focus': 'Concentrazione',
      'moods.focus_q': 'concentrazione focus studio',
      'moods.romance': 'Romantica',
      'moods.romance_q': 'canzoni romantiche',
      'moods.feelgood': 'Feel good',
      'moods.feelgood_q': 'feel good',
      'moods.party': 'Festa',
      'moods.party_q': 'festa party',
      'moods.commute': 'Pendolarismo',
      'moods.commute_q': 'musica in viaggio',
      'moods.wellness': 'Benessere',
      'moods.wellness_q': 'benessere relax meditazione',
      'moods.sad': 'Triste',
      'moods.sad_q': 'canzoni tristi',
      'moods.sleep': 'Sonno',
      'moods.sleep_q': 'musica per dormire',

      // Library page
      'library.title': 'Libreria',
      'library.filter_all': 'Tutto',
      'library.filter_playlists': 'Playlist',
      'library.filter_artists': 'Artisti',
      'library.filter_albums': 'Album',
      'library.filter_favorites': 'Preferiti',
      'library.sort_recent_open': 'Aperte di recente',
      'library.sort_alpha': 'Ordine alfabetico',
      'library.sort_recent_added': 'Aggiunti di recente',
      'library.item_one': '{count} elemento',
      'library.item_many': '{count} elementi',
      'library.search_placeholder': 'Cerca nella libreria',
      'library.no_fav_match': 'Nessun preferito per “{q}”',
      'library.no_fav': 'Nessun brano nei preferiti',
      'library.recap_title': 'Il tuo mese in musica',
      'library.recap_keywords': 'Il tuo mese in musica recap mensile statistiche your month in music',
      'library.local_files_sub': 'File locali',
      'library.downloads_sub': 'Brani scaricati',
      'library.fav_title': 'Brani preferiti',
      'library.recent_title': 'Ascoltati di recente',
      'library.empty_playlists_search': 'Nessuna playlist trovata',
      'library.empty_playlists_none': 'Nessuna playlist creata',
      'library.empty_category': 'Nessun elemento in questa categoria',
      'library.pins_empty_title': 'Fissa i tuoi preferiti',
      'library.pins_empty_l1': 'Quando fissi la musica aggiunta alla',
      'library.pins_empty_l2': 'libreria, compare qui.',
      'library.personal_playlist_sub': 'Playlist personale',
      'library.no_songs_present': 'Nessun brano presente',
      'library.song_count_one': '{count} brano',
      'library.song_count_many': '{count} brani',

      // Search page
      'search.searching': 'Cerco “{q}”…',
      'search.failed': 'Ricerca non riuscita: {err}',
      'search.no_results': 'Nessun risultato per “{q}”',
      'search.no_results_hint': 'Controlla l’ortografia o prova un’altra ricerca.',
      'search.empty_title': 'Cerca qualcosa da ascoltare',
      'search.empty_sub': 'Brani, artisti, album e playlist',
      'search.filter_all': 'Tutto',
      'search.filter_songs': 'Brani',
      'search.filter_artists': 'Artisti',
      'search.filter_albums': 'Album',
      'search.filter_playlists': 'Playlist',

      // Playlist & Album page
      'playlist_page.recommended_title': 'Brani consigliati',
      'playlist_page.recommended_sub': 'In base ai brani inclusi in questa playlist',
      'playlist_page.searching_compat': 'Cerco brani compatibili…',
      'playlist_page.no_recs': 'Nessun consiglio disponibile al momento',
      'playlist_page.no_compat': 'Nessun brano compatibile trovato',
      'playlist_page.empty': 'Nessun brano in questa playlist.',
      'playlist_page.empty_hint': 'Aggiungi brani dal menu ··· dei brani!',
      'playlist_page.load_error': 'Impossibile caricare: {err}',
      'playlist_page.no_match': 'Nessun brano per “{q}”',
      'playlist_page.songs_and_meta': '{count} brani, {meta}',
      'playlist_page.songs_one_and_meta': '{count} brano, {meta}',

      // Artist page
      'artist_page.popular_songs': 'Brani popolari',
      'artist_page.load_error': 'Impossibile caricare: {err}',
      'artist_page.albums': 'Album',
      'artist_page.singles_ep': 'Singoli ed EP',
      'artist_page.similar_artists': 'Artisti simili',

      // Recap page
      'recap.title': 'Il tuo mese in musica',
      'recap.empty_title': 'Nessun ascolto in questo mese',
      'recap.empty_sub': 'Riproduci qualche brano per generare il tuo recap.',
      'recap.song_of_month': 'CANZONE DEL MESE',
      'recap.plays': 'Riproduzioni',
      'recap.minutes_listened': 'Minuti ascoltati',
      'recap.top_songs': 'Top Brani',
      'recap.play_one': '{count} ascolto',
      'recap.play_many': '{count} ascolti',
      'recap.top_artists': 'Top Artisti',

      // Context menu & Sleep timer
      'cm.start_artist_radio': 'Avvia radio artista',
      'cm.add_popular_queue': 'Aggiungi popolari in coda',
      'cm.unfollow': 'Non seguire',
      'cm.follow': 'Segui',
      'cm.share': 'Condividi',
      'cm.play_next': 'Riproduci dopo',
      'cm.add_queue': 'Aggiungi alla coda',
      'cm.unpin': 'Rimuovi dai fissati',
      'cm.pin': 'Fissa in cima',
      'cm.change_cover': 'Cambia copertina',
      'cm.rename_playlist': 'Rinomina playlist',
      'cm.delete_playlist': 'Elimina playlist',
      'cm.remove_download': 'Rimuovi dai download',
      'cm.download_playlist': 'Scarica playlist',
      'cm.download_album': 'Scarica album',
      'cm.download_track': 'Scarica brano',
      'cm.go_artist': 'Vai all\'artista',
      'cm.go_album': 'Vai all\'album',
      'cm.add_all_playlist': 'Aggiungi tutto a playlist',
      'cm.add_to_playlist': 'Aggiungi a playlist',
      'cm.remove_favorite': 'Rimuovi dai preferiti',
      'cm.favorite': 'Preferito',
      'cm.start_song_radio': 'Avvia radio brano',
      'cm.remove_from_playlist': 'Rimuovi da questa playlist',
      'cm.lyrics_source': 'Fonte del testo',
      'cm.sleep_timer': 'Timer spegnimento',
      'cm.sleep_eom': 'Fine brano',
      'cm.sleep_eom_full': 'Al termine del brano',
      'cm.sleep_in_min': 'Tra {count} min',
      'cm.sleep_disable': 'Disattiva timer',
      'cm.sleep_15m': '15 minuti',
      'cm.sleep_30m': '30 minuti',
      'cm.sleep_45m': '45 minuti',
      'cm.sleep_1h': '1 ora',
      'cm.pause_playback': 'Sospendi riproduzione',
      'cm.appearance': 'ASPETTO',

      // Settings
      'settings.title': 'Impostazioni',
      'settings.categories': 'CATEGORIE',
      'settings.cat_playback': 'Riproduzione',
      'settings.cat_playback_sub': 'Crossfade, testi e code',
      'settings.cat_eq': 'Equalizzatore',
      'settings.cat_eq_sub': '5 bande Web Audio & preset',
      'settings.cat_glass': 'LiquidGlass',
      'settings.cat_glass_sub': 'Rifrazione, sfocatura e tema',
      'settings.cat_language': 'Lingua e regione',
      'settings.cat_language_sub': 'Lingua app e catalogo musicale',
      'settings.cat_storage': 'Archivio & Info',
      'settings.cat_storage_sub': 'Cache, statistiche e file',
      'settings.quick_controls': 'CONTROLLI RAPIDI',
      'settings.theme_app': 'Tema dell’app',
      'settings.theme_colors': 'Tema colori',
      'settings.theme_auto': 'Automatico',
      'settings.theme_light': 'Chiaro',
      'settings.theme_dark': 'Scuro',
      'settings.lyrics_alone': 'Lyrics Alone',
      'settings.lyrics_alone_short': 'Nasconde i controlli dopo 4s mentre leggi il testo',
      'settings.skip_fade': 'Skip-Fade morbido',
      'settings.skip_fade_short': 'Dissolvenza incrociata fluida quando cambi brano',
      'settings.swipe_queue': 'Scorri brano per la coda',
      'settings.swipe_queue_short': 'Trascina un brano a sinistra per metterlo in coda',
      'settings.audio_transitions': 'TRANSIZIONI AUDIO',
      'settings.crossfade': 'Crossfade tra i brani',
      'settings.off': 'Off',
      'settings.volume_norm': 'Normalizzazione leggera',
      'settings.volume_norm_sub': 'Bilancia delicatamente il volume tra i brani senza alterare la dinamica',
      'settings.skip_fade_sub': 'Dissolvenza di 0.5s al cambio traccia manuale',
      'settings.smart_shuffle': 'Smart Shuffle (✦)',
      'settings.smart_shuffle_sub': 'Inserisce 1 brano consigliato ogni 3 nella coda casuale',
      'settings.auto_queue': 'Coda automatica infinita',
      'settings.auto_queue_sub': 'Aggiunge brani simili al termine della coda',
      'settings.swipe_queue_sub': 'Scorri orizzontalmente una riga per metterla in coda',
      'settings.lyrics_exp': 'ESPERIENZA TESTI',
      'settings.lyrics_alone_focus': 'Lyrics Alone (Focus automatico)',
      'settings.lyrics_alone_sub': 'Ritrae i controlli dopo 4s di inattività sui testi',
      'settings.lyrics_anim_style': 'Stile animazione testi',
      'settings.lyrics_source_pref': 'Fonte testi preferita',
      'settings.source_auto': 'Auto',
      'settings.source_apple': 'Apple Music',
      'settings.source_better': 'Better',
      'settings.source_lrclib': 'LRCLIB',
      'settings.source_netease': 'NetEase',
      'settings.sound_profile': 'PROFILO SONORO',
      'settings.eq_preset': 'Preset Equalizzatore',
      'settings.eq_bands': 'BANDE DI FREQUENZA (-9dB .. +9dB)',
      'settings.eq_reset': 'Ripristina risposta piatta (0 dB)',
      'settings.eq_flat': 'Piatto',
      'settings.eq_bass': 'Bass Boost',
      'settings.eq_vocal': 'Vocale',
      'settings.eq_rock': 'Rock',
      'settings.eq_pop': 'Pop',
      'settings.eq_electro': 'Electro',
      'settings.glass_section': 'TEMA E PROFILO VETRO',
      'settings.glass_profile': 'Profilo ottico LiquidGlass',
      'settings.glass_light': 'Leggero',
      'settings.glass_balanced': 'Bilanciato',
      'settings.glass_vivid': 'Intenso',
      'settings.glass_refraction': 'Intensità rifrazione lente',
      'settings.glass_blur': 'Sfocatura vetro (Blur)',
      'settings.glass_chromatic': 'Dispersione cromatica sui bordi',
      'settings.glass_chromatic_sub': 'Rifrazione prismatica RGB sui contorni della lente',
      'settings.bar_folds': 'Barra compatta allo scorrimento',
      'settings.bar_folds_sub': 'Riduce la barra inferiore mentre scorri le pagine',
      'settings.storage_used': 'Spazio utilizzato da Sonora',
      'settings.storage_cache_audio': 'Cache audio e brani offline',
      'settings.storage_cache_covers': 'Copertine album in cache',
      'settings.storage_cache_lyrics': 'Testi sincronizzati in cache',
      'settings.storage_audio_sub': '{mb} MB · {count} brani',
      'settings.storage_covers_sub': '{count} immagini · {mb} MB',
      'settings.storage_lyrics_sub': '{count} testi · {mb} MB',
      'settings.storage_actions': 'AZIONI ARCHIVIO',
      'settings.backup_section': 'BACKUP LIBRERIA',
      'settings.backup_export': 'Esporta backup libreria (.sonora)',
      'settings.backup_import': 'Ripristina libreria da backup',
      'backup.confirm_title': 'Ripristina backup',
      'backup.confirm_msg': 'Ripristinare {playlists} playlist, {favs} preferiti e {pins} fissati? I dati locali attuali verranno sostituiti.',
      'backup.restore_btn': 'Ripristina',
      'settings.storage_import': 'Importa file audio dal dispositivo',
      'settings.storage_clear': 'Svuota cache audio, testi e copertine',
      'settings.updates_section': 'AGGIORNAMENTI',
      'update.check': 'Cerca aggiornamenti',
      'update.checking': 'Controllo…',
      'update.none': 'Già aggiornata',
      'update.available': '{version} disponibile',
      'update.now': 'Aggiorna',
      'update.later': 'Più tardi',
      'update.downloading': 'Scarico…',
      'update.installing': 'Aspetto la tua conferma',
      'update.needs_permission': 'Consenti l’installazione — tocca',
      'update.failed': 'Non adesso — tocca per riprovare',
      'settings.version_label': 'Sonora v1.0.4-beta · LiquidGlass',

      // Language & Region settings
      'settings.lang_section_app': 'LINGUA INTERFACCIA',
      'settings.lang_app_label': 'Lingua dell’app',
      'settings.lang_auto': 'Automatica',
      'settings.lang_it': 'Italiano',
      'settings.lang_en': 'English',
      'settings.lang_section_region': 'REGIONE CONTENUTI',
      'settings.lang_region_label': 'Catalogo e classifiche (GEO)',
      'settings.lang_region_hint': 'Seleziona il Paese usato per Home, Novità, classifiche e risultati.',
      'settings.lang_resolved_info': 'Attivo: {lang} · Regione: {country}',
      'settings.country_auto': 'Automatica'
    },

    en: {
      // Tabs
      'tab.home': 'Home',
      'tab.new': 'New',
      'tab.radio': 'Radio',
      'tab.library': 'Library',
      'tab.search': 'Search',

      // Common
      'common.track': 'Track',
      'common.tracks': 'Tracks',
      'common.artist': 'Artist',
      'common.artists': 'Artists',
      'common.album': 'Album',
      'common.albums': 'Albums',
      'common.playlist': 'Playlist',
      'common.playlist_lc': 'playlist',
      'common.playlists': 'Playlists',
      'common.single': 'Single',
      'common.release': 'Release',
      'common.cancel': 'Cancel',
      'common.create': 'Create',
      'common.save': 'Save',
      'common.remove': 'Remove',
      'common.stop': 'Stop',
      'common.continue': 'Continue',
      'common.download': 'Download',
      'common.share': 'Share',
      'common.play': 'Play',
      'common.shuffle': 'Shuffle',
      'common.refresh': 'Refresh',
      'common.favorites': 'Favorites',
      'common.recent': 'Recent',
      'common.loading': 'Loading…',
      'common.month': 'Month',
      'common.songs': 'Songs',
      'common.all': 'All',
      'common.added': 'Added',
      'common.in_queue': 'Queued',
      'common.queued': 'Queued',
      'common.offline_songs': 'Downloaded',
      'common.mb_unit': 'MB',
      'common.hours_1': '1 hour',
      'common.minutes_n': '{count} minutes',
      'common.min_short': 'min',
      'common.brand': 'Sonora',

      // Months
      'months.0': 'January',
      'months.1': 'February',
      'months.2': 'March',
      'months.3': 'April',
      'months.4': 'May',
      'months.5': 'June',
      'months.6': 'July',
      'months.7': 'August',
      'months.8': 'September',
      'months.9': 'October',
      'months.10': 'November',
      'months.11': 'December',

      // Navigation & Search bars
      'nav.search_tracks_hint': 'Search songs',
      'nav.search_all_hint': 'Songs, artists, albums, playlists',
      'nav.search_aria': 'Search',

      // Prompt modal & playlist creation
      'prompt.new_playlist_title': 'New Playlist',
      'prompt.new_playlist_sub': 'Enter a title or paste a YouTube Music / Spotify link',
      'prompt.rename_playlist_sub': 'Choose a new title for this collection',
      'prompt.playlist_placeholder': 'Playlist title or link…',
      'prompt.cancel': 'Cancel',
      'prompt.create': 'Create',
      'prompt.import': 'Import',
      'prompt.save': 'Save',
      'prompt.new_playlist_btn': '+ New Playlist',
      'prompt.importing_title': 'Importing playlist',
      'prompt.importing_sub': 'Matching tracks from link…',
      'prompt.import_download_title': 'Playlist imported',
      'prompt.import_download_msg': 'Imported {count} tracks into “{name}”. Download them for offline listening?',
      'prompt.not_now': 'Not now',
      'prompt.download_now': 'Download',

      // Toasts
      'toast.browser_blocked': 'Playback blocked by browser: tap play',
      'toast.shuffle_on': 'Shuffle on',
      'toast.smart_shuffle_on': 'Smart Shuffle ✦ on · 1 recommended track every 3',
      'toast.shuffle_off': 'Shuffle off',
      'toast.link_copied': 'Link copied to clipboard',
      'toast.share_prefix': 'Share: {text}',
      'toast.added_to': 'Added to {name}',
      'toast.removed_from_playlist': 'Removed from playlist',
      'toast.playlist_created': 'Playlist “{name}” created',
      'toast.playlist_renamed': 'Playlist renamed',
      'toast.playlist_deleted': 'Playlist deleted',
      'toast.cover_updated': 'Cover updated',
      'toast.removed_downloads': 'Removed from downloads',
      'toast.download_cancelled': 'Download cancelled',
      'toast.download_failed': 'Could not download tracks',
      'toast.download_empty': 'No tracks to download',
      'toast.download_done_one': 'Downloaded: {title}',
      'toast.download_done_partial': 'Downloaded {done} tracks ({failed} failed)',
      'toast.download_saved_one': 'Saved to Downloaded ({count} track)',
      'toast.download_saved_many': 'Saved to Downloaded ({count} tracks)',
      'toast.import_one': '{count} audio file imported',
      'toast.import_many': '{count} audio files imported',
      'toast.cannot_play': 'Cannot play “{title}”',
      'toast.no_tracks_available': 'No tracks available',
      'toast.starting_station': 'Starting {title}…',
      'toast.loading_station': 'Loading {title}…',
      'toast.no_songs_found': 'No songs found',
      'toast.error_prefix': 'Error: {msg}',
      'toast.sleep_off': 'Sleep timer off',
      'toast.sleep_eom': 'Stopping at end of track',
      'toast.sleep_done': 'Sleep timer finished',
      'toast.sleep_set_1h': 'Sleep timer set: 1 hour',
      'toast.sleep_set_min': 'Sleep timer set: {count} minutes',
      'toast.song_radio_started': 'Song radio started: {title}',
      'toast.artist_radio_started': 'Artist radio started: {name}',
      'toast.popular_added_queue': 'Popular songs added to queue',
      'toast.play_next': 'Playing next: {title}',
      'toast.added_to_queue': 'Added to queue: {title}',
      'toast.fav_added': 'Added to favorites',
      'toast.fav_removed': 'Removed from favorites',
      'toast.pin_added': 'Pinned to top',
      'toast.pin_removed': 'Unpinned',
      'toast.cache_cleared': 'Cache cleared',
      'toast.recs_error': 'Error loading recommendations',
      'toast.locale_updated': 'Language and region updated',
      'toast.backup_exported': 'Library backup exported',
      'toast.backup_export_failed': 'Could not export backup',
      'toast.backup_restored': 'Library restored from backup',
      'toast.backup_invalid': 'Invalid backup file',
      'toast.offline_mode': 'Offline mode active',
      'toast.back_online': 'Back online',
      'toast.playlist_imported': 'Imported {count} tracks into “{name}”',
      'toast.playlist_import_failed': 'Import failed: {err}',

      // Offline mode & Search history
      'offline.title': 'You’re offline',
      'offline.sub': 'Listen to downloaded songs and local files without connection',
      'offline.downloads_btn': 'Downloads ({count})',
      'offline.local_btn': 'Local files ({count})',
      'offline.no_downloads': 'No downloaded songs available offline',
      'offline.search_badge': 'Offline results (Downloads & local files)',
      'search.recent_title': 'FROM YOUR SEARCHES',
      'search.clear_history': 'Clear',
      'search.suggestions': 'Suggestions',

      // Downloads
      'download.loading_tracks': 'Loading tracks…',
      'download.collection_fallback': 'this collection',
      'download.collection_title_fallback': 'Collection',
      'download.in_progress_title': 'Download in progress',
      'download.in_progress_msg': 'Downloaded {done} of {total} tracks from “{title}”. Stop downloading?',
      'download.remove_title': 'Remove from downloads',
      'download.remove_msg_one': 'Remove {count} track from “{title}” offline files?',
      'download.remove_msg_many': 'Remove {count} tracks from “{title}” offline files?',
      'download.album_title': 'Download album',
      'download.playlist_title': 'Download playlist',
      'download.confirm_msg_one': 'Download {count} track from “{title}”?',
      'download.confirm_msg_many': 'Download {count} tracks from “{title}”?',
      'download.stopping': 'Stop download ({done}/{total})',

      // Local audio
      'local.file': 'Local file',
      'local.files': 'Local files',
      'local.device': 'Device',
      'local.import_title': 'Import audio files',

      // Audio outputs & status
      'audio.speaker': 'Device speaker',
      'audio.auto_device': 'Automatic · {name}',
      'audio.auto_default': 'Automatic (Default)',
      'audio.auto_label': 'Automatic audio output',
      'audio.android_system': 'Android System',
      'audio.output_header': 'Audio output',
      'audio.output_toast': 'Output: {name}',
      'audio.selected_device': 'Selected device',
      'audio.tap_to_retry': 'Tap to retry',
      'audio.no_content': 'no content',
      'audio.webgl_fallback': 'WebGL unavailable, falling back to 2D canvas',
      'audio.quality_hires': 'Hi-Res Lossless',
      'audio.quality_lossless': 'Lossless',

      // Lyrics & player sheet
      'lyrics.kind_word': 'Word by word',
      'lyrics.kind_line': 'Line by line',
      'lyrics.kind_plain': 'Unsynced',
      'lyrics.unavailable': 'Lyrics unavailable',
      'lyrics.loading': 'Loading lyrics…',
      'lyrics.sources_title': 'Lyrics',
      'lyrics.source_header': 'SOURCE',
      'lyrics.sources_loading': 'Loading sources…',
      'lyrics.backend_required': 'Available when connected to backend',
      'lyrics.status_loading': 'Loading…',
      'lyrics.status_unreachable': 'Unreachable',
      'lyrics.status_none': 'No lyrics',
      'lyrics.other_sources': 'Other sources',
      'lyrics.style_header': 'STYLE',
      'lyrics.style_animated': 'Animated',
      'lyrics.style_classic': 'Classic',
      'lyrics.style_animated_sub': 'Animated (Syllables)',

      // Queue
      'queue.in_queue_artist': 'In queue · {artist}',
      'queue.up_next': 'Up Next',
      'queue.smart_shuffle_sub': 'Smart Shuffle ✦ · 1 recommendation every 3 songs',
      'queue.autoplay_sub': 'Continuing with similar songs',
      'queue.end_sub': 'End of queue',
      'queue.infinity_off_prefix': 'Infinite queue',
      'queue.infinity_off_suffix': 'is turned off.',
      'queue.infinity_off_hint': 'Turn it on above to continue with similar songs',

      // Home page
      'home.title': 'Home',
      'home.load_error': 'Could not load Home: {err}',
      'home.recent': 'Recently Played',
      'home.forgotten': 'Rediscover your classics',
      'home.quick_picks': 'Quick picks',
      'home.new_releases': 'New releases',
      'home.similar_to': 'Similar to…',
      'home.recommended_playlists': 'Recommended playlists',
      'home.recommended_for_you': 'Recommended for you',
      'home.artists_for_you': 'Artists for you',
      'home.playlists_for_you': 'Playlists for you',

      // New page
      'new_page.title': 'New',
      'new_page.load_error': 'Could not load New: {err}',
      'new_page.albums_singles': 'Albums & Singles',
      'new_page.top_tracks': 'Top Songs',
      'new_page.top_chart': 'Top Songs Chart',
      'new_page.trending_artists': 'Trending Artists',
      'new_page.new_album': 'New Album',
      'new_page.latest_tracks': 'Latest Songs',
      'new_page.more_new': 'More New Releases',

      // Radio & Moods
      'radio.title': 'Radio',
      'radio.load_error': 'Could not load Radio: {err}',
      'radio.loading_feed': 'Loading stations & moods…',
      'radio.moods_eyebrow': 'MOODS & MOMENTS',
      'radio.explore_genres': 'Explore genres',
      'radio.stations_moods': 'Stations & Moods',
      'radio.live_now': 'Live',
      'radio.loading_mood': 'Loading playlists for “{title}”…',
      'radio.no_playlists': 'No playlists found',

      // Mood chips
      'moods.energia': 'Energy Boost',
      'moods.energia_q': 'high energy workout music',
      'moods.relax': 'Chill',
      'moods.relax_q': 'chill relax music',
      'moods.workout': 'Workout',
      'moods.workout_q': 'workout gym music',
      'moods.focus': 'Focus',
      'moods.focus_q': 'focus study concentration music',
      'moods.romance': 'Romance',
      'moods.romance_q': 'romantic love songs',
      'moods.feelgood': 'Feel Good',
      'moods.feelgood_q': 'feel good hits',
      'moods.party': 'Party',
      'moods.party_q': 'party dance hits',
      'moods.commute': 'Commute',
      'moods.commute_q': 'driving road trip music',
      'moods.wellness': 'Wellness',
      'moods.wellness_q': 'wellness calm meditation music',
      'moods.sad': 'Sad',
      'moods.sad_q': 'sad songs',
      'moods.sleep': 'Sleep',
      'moods.sleep_q': 'sleep ambient music',

      // Library page
      'library.title': 'Library',
      'library.filter_all': 'All',
      'library.filter_playlists': 'Playlists',
      'library.filter_artists': 'Artists',
      'library.filter_albums': 'Albums',
      'library.filter_favorites': 'Favorites',
      'library.sort_recent_open': 'Recently opened',
      'library.sort_alpha': 'Alphabetical',
      'library.sort_recent_added': 'Recently added',
      'library.item_one': '{count} item',
      'library.item_many': '{count} items',
      'library.search_placeholder': 'Search in library',
      'library.no_fav_match': 'No favorites for “{q}”',
      'library.no_fav': 'No favorite songs yet',
      'library.recap_title': 'Your month in music',
      'library.recap_keywords': 'your month in music recap monthly stats il tuo mese in musica statistiche',
      'library.local_files_sub': 'Local files',
      'library.downloads_sub': 'Downloaded songs',
      'library.fav_title': 'Favorite Songs',
      'library.recent_title': 'Recently Played',
      'library.empty_playlists_search': 'No playlists found',
      'library.empty_playlists_none': 'No playlists created',
      'library.empty_category': 'No items in this category',
      'library.pins_empty_title': 'Pin your favorites',
      'library.pins_empty_l1': 'When you pin music added to your',
      'library.pins_empty_l2': 'library, it appears here.',
      'library.personal_playlist_sub': 'Personal playlist',
      'library.no_songs_present': 'No songs available',
      'library.song_count_one': '{count} song',
      'library.song_count_many': '{count} songs',

      // Search page
      'search.searching': 'Searching “{q}”…',
      'search.failed': 'Search failed: {err}',
      'search.no_results': 'No results for “{q}”',
      'search.no_results_hint': 'Check your spelling or try another search.',
      'search.empty_title': 'Search for something to listen to',
      'search.empty_sub': 'Songs, artists, albums & playlists',
      'search.filter_all': 'All',
      'search.filter_songs': 'Songs',
      'search.filter_artists': 'Artists',
      'search.filter_albums': 'Albums',
      'search.filter_playlists': 'Playlists',

      // Playlist & Album page
      'playlist_page.recommended_title': 'Recommended Songs',
      'playlist_page.recommended_sub': 'Based on the songs in this playlist',
      'playlist_page.searching_compat': 'Finding compatible songs…',
      'playlist_page.no_recs': 'No recommendations available right now',
      'playlist_page.no_compat': 'No compatible songs found',
      'playlist_page.empty': 'No songs in this playlist.',
      'playlist_page.empty_hint': 'Add songs from the ··· menu on any track!',
      'playlist_page.load_error': 'Could not load: {err}',
      'playlist_page.no_match': 'No songs matching “{q}”',
      'playlist_page.songs_and_meta': '{count} songs, {meta}',
      'playlist_page.songs_one_and_meta': '{count} song, {meta}',

      // Artist page
      'artist_page.popular_songs': 'Top Songs',
      'artist_page.load_error': 'Could not load: {err}',
      'artist_page.albums': 'Albums',
      'artist_page.singles_ep': 'Singles & EPs',
      'artist_page.similar_artists': 'Similar Artists',

      // Recap page
      'recap.title': 'Your month in music',
      'recap.empty_title': 'No plays this month',
      'recap.empty_sub': 'Play some songs to generate your recap.',
      'recap.song_of_month': 'SONG OF THE MONTH',
      'recap.plays': 'Plays',
      'recap.minutes_listened': 'Minutes listened',
      'recap.top_songs': 'Top Songs',
      'recap.play_one': '{count} play',
      'recap.play_many': '{count} plays',
      'recap.top_artists': 'Top Artists',

      // Context menu & Sleep timer
      'cm.start_artist_radio': 'Start artist radio',
      'cm.add_popular_queue': 'Add top songs to queue',
      'cm.unfollow': 'Unfollow',
      'cm.follow': 'Follow',
      'cm.share': 'Share',
      'cm.play_next': 'Play next',
      'cm.add_queue': 'Add to queue',
      'cm.unpin': 'Unpin',
      'cm.pin': 'Pin to top',
      'cm.change_cover': 'Change cover',
      'cm.rename_playlist': 'Rename playlist',
      'cm.delete_playlist': 'Delete playlist',
      'cm.remove_download': 'Remove download',
      'cm.download_playlist': 'Download playlist',
      'cm.download_album': 'Download album',
      'cm.download_track': 'Download song',
      'cm.go_artist': 'Go to artist',
      'cm.go_album': 'Go to album',
      'cm.add_all_playlist': 'Add all to playlist',
      'cm.add_to_playlist': 'Add to playlist',
      'cm.remove_favorite': 'Remove from favorites',
      'cm.favorite': 'Favorite',
      'cm.start_song_radio': 'Start song radio',
      'cm.remove_from_playlist': 'Remove from this playlist',
      'cm.lyrics_source': 'Lyrics source',
      'cm.sleep_timer': 'Sleep timer',
      'cm.sleep_eom': 'End of song',
      'cm.sleep_eom_full': 'When current song ends',
      'cm.sleep_in_min': 'In {count} min',
      'cm.sleep_disable': 'Turn off timer',
      'cm.sleep_15m': '15 minutes',
      'cm.sleep_30m': '30 minutes',
      'cm.sleep_45m': '45 minutes',
      'cm.sleep_1h': '1 hour',
      'cm.pause_playback': 'Pause playback',
      'cm.appearance': 'APPEARANCE',

      // Settings
      'settings.title': 'Settings',
      'settings.categories': 'CATEGORIES',
      'settings.cat_playback': 'Playback',
      'settings.cat_playback_sub': 'Crossfade, lyrics & queues',
      'settings.cat_eq': 'Equalizer',
      'settings.cat_eq_sub': '5-band Web Audio & presets',
      'settings.cat_glass': 'LiquidGlass',
      'settings.cat_glass_sub': 'Refraction, blur & theme',
      'settings.cat_language': 'Language & Region',
      'settings.cat_language_sub': 'App language & music catalog',
      'settings.cat_storage': 'Storage & Info',
      'settings.cat_storage_sub': 'Cache, stats & files',
      'settings.quick_controls': 'QUICK CONTROLS',
      'settings.theme_app': 'App theme',
      'settings.theme_colors': 'Color theme',
      'settings.theme_auto': 'Automatic',
      'settings.theme_light': 'Light',
      'settings.theme_dark': 'Dark',
      'settings.lyrics_alone': 'Lyrics Alone',
      'settings.lyrics_alone_short': 'Hides controls after 4s while reading lyrics',
      'settings.skip_fade': 'Smooth Skip-Fade',
      'settings.skip_fade_short': 'Smooth crossfade when skipping tracks',
      'settings.swipe_queue': 'Swipe song to queue',
      'settings.swipe_queue_short': 'Swipe a song left to add it to the queue',
      'settings.audio_transitions': 'AUDIO TRANSITIONS',
      'settings.crossfade': 'Crossfade between songs',
      'settings.off': 'Off',
      'settings.volume_norm': 'Light volume normalization',
      'settings.volume_norm_sub': 'Gently balances volume between songs without crushing dynamics',
      'settings.skip_fade_sub': '0.5s fade on manual track switch',
      'settings.smart_shuffle': 'Smart Shuffle (✦)',
      'settings.smart_shuffle_sub': 'Inserts 1 recommended song every 3 in shuffle queue',
      'settings.auto_queue': 'Infinite auto-queue',
      'settings.auto_queue_sub': 'Adds similar songs when the queue ends',
      'settings.swipe_queue_sub': 'Swipe horizontally on a row to add it to the queue',
      'settings.lyrics_exp': 'LYRICS EXPERIENCE',
      'settings.lyrics_alone_focus': 'Lyrics Alone (Auto-focus)',
      'settings.lyrics_alone_sub': 'Tucks controls away after 4s of inactivity on lyrics',
      'settings.lyrics_anim_style': 'Lyrics animation style',
      'settings.lyrics_source_pref': 'Preferred lyrics source',
      'settings.source_auto': 'Auto',
      'settings.source_apple': 'Apple Music',
      'settings.source_better': 'Better',
      'settings.source_lrclib': 'LRCLIB',
      'settings.source_netease': 'NetEase',
      'settings.sound_profile': 'SOUND PROFILE',
      'settings.eq_preset': 'Equalizer Preset',
      'settings.eq_bands': 'FREQUENCY BANDS (-9dB .. +9dB)',
      'settings.eq_reset': 'Reset flat response (0 dB)',
      'settings.eq_flat': 'Flat',
      'settings.eq_bass': 'Bass Boost',
      'settings.eq_vocal': 'Vocal',
      'settings.eq_rock': 'Rock',
      'settings.eq_pop': 'Pop',
      'settings.eq_electro': 'Electro',
      'settings.glass_section': 'THEME & GLASS PROFILE',
      'settings.glass_profile': 'LiquidGlass optical profile',
      'settings.glass_light': 'Light',
      'settings.glass_balanced': 'Balanced',
      'settings.glass_vivid': 'Vivid',
      'settings.glass_refraction': 'Lens refraction intensity',
      'settings.glass_blur': 'Glass blur',
      'settings.glass_chromatic': 'Edge chromatic dispersion',
      'settings.glass_chromatic_sub': 'RGB prismatic refraction along lens edges',
      'settings.bar_folds': 'Compact bar on scroll',
      'settings.bar_folds_sub': 'Shrinks the bottom bar while scrolling pages',
      'settings.storage_used': 'Storage used by Sonora',
      'settings.storage_cache_audio': 'Audio cache & offline songs',
      'settings.storage_cache_covers': 'Cached album covers',
      'settings.storage_cache_lyrics': 'Cached synced lyrics',
      'settings.storage_audio_sub': '{mb} MB · {count} tracks',
      'settings.storage_covers_sub': '{count} images · {mb} MB',
      'settings.storage_lyrics_sub': '{count} lyrics · {mb} MB',
      'settings.storage_actions': 'STORAGE ACTIONS',
      'settings.backup_section': 'LIBRARY BACKUP',
      'settings.backup_export': 'Export library backup (.sonora)',
      'settings.backup_import': 'Restore library from backup',
      'backup.confirm_title': 'Restore backup',
      'backup.confirm_msg': 'Restore {playlists} playlists, {favs} favorites, and {pins} pins? Current local library data will be replaced.',
      'backup.restore_btn': 'Restore',
      'settings.storage_import': 'Import audio files from device',
      'settings.storage_clear': 'Clear audio, lyrics & cover cache',
      'settings.updates_section': 'UPDATES',
      'update.check': 'Check for updates',
      'update.checking': 'Checking…',
      'update.none': 'Up to date',
      'update.available': '{version} available',
      'update.now': 'Update',
      'update.later': 'Later',
      'update.downloading': 'Downloading…',
      'update.installing': 'Waiting for you to confirm',
      'update.needs_permission': 'Allow installing — tap',
      'update.failed': 'Not now — tap to retry',
      'settings.version_label': 'Sonora v1.0.4-beta · LiquidGlass',

      // Language & Region settings
      'settings.lang_section_app': 'INTERFACE LANGUAGE',
      'settings.lang_app_label': 'App language',
      'settings.lang_auto': 'Automatic',
      'settings.lang_it': 'Italiano',
      'settings.lang_en': 'English',
      'settings.lang_section_region': 'CONTENT REGION',
      'settings.lang_region_label': 'Catalog & charts (GEO)',
      'settings.lang_region_hint': 'Country used for Home, New, charts, and search results.',
      'settings.lang_resolved_info': 'Active: {lang} · Region: {country}',
      'settings.country_auto': 'Automatic'
    }
  };

  function _readStoredPrefs() {
    if (typeof PREFS !== 'undefined' && PREFS && typeof PREFS === 'object') {
      return {
        lang: typeof PREFS.lang === 'string' ? PREFS.lang : 'auto',
        country: typeof PREFS.country === 'string' ? PREFS.country : 'auto'
      };
    }
    try {
      const sp = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem('sonora-prefs')) || 'null');
      if (sp && typeof sp === 'object') {
        return {
          lang: typeof sp.lang === 'string' ? sp.lang : 'auto',
          country: typeof sp.country === 'string' ? sp.country : 'auto'
        };
      }
    } catch (e) {}
    return { lang: 'auto', country: 'auto' };
  }

  function _normalizeLangPref(v) {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'it' || s === 'en' || s === 'auto') return s;
    if (s.startsWith('it')) return 'it';
    if (s.startsWith('en')) return 'en';
    return 'auto';
  }

  function _normalizeCountryPref(v) {
    const s = String(v || '').trim();
    if (!s || s.toLowerCase() === 'auto') return 'auto';
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
    return 'auto';
  }

  function _detectBrowserLang() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const raw = (nav && (nav.language || (Array.isArray(nav.languages) && nav.languages[0]))) || 'en';
    return String(raw).toLowerCase().startsWith('it') ? 'it' : 'en';
  }

  function _detectBrowserCountry() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    const raw = (nav && (nav.language || (Array.isArray(nav.languages) && nav.languages[0]))) || '';
    const m = /^([a-zA-Z]{2})[-_]([a-zA-Z]{2})/.exec(String(raw));
    if (m) return m[2].toUpperCase();
    if (String(raw).toLowerCase().startsWith('it')) return 'IT';
    return 'US';
  }

  function _readNativeLocale() {
    try {
      const N = typeof window !== 'undefined' && window.SonoraNative;
      if (N && typeof N.getLocaleConfig === 'function') {
        const parsed = JSON.parse(N.getLocaleConfig() || 'null');
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return null;
  }

  const _COUNTRY_BY_CODE = Object.create(null);
  for (let i = 0; i < I18N_COUNTRIES.length; i++) {
    _COUNTRY_BY_CODE[I18N_COUNTRIES[i].code] = I18N_COUNTRIES[i];
  }

  let _localeState = {
    lang: 'auto',
    country: 'auto',
    resolvedLang: 'en',
    resolvedCountry: 'US',
    storefront: 'us'
  };
  let _activeDict = I18N_DICT.en;
  let _staticI18nLang = null;
  let _staticI18nDomReady = false;

  function _syncActiveDict() {
    _activeDict = I18N_DICT[_localeState.resolvedLang] || I18N_DICT.en;
  }

  function _computeLocaleState(preferNative) {
    const stored = _readStoredPrefs();
    const nativeCfg = _readNativeLocale();

    let lang = _normalizeLangPref(stored.lang);
    let country = _normalizeCountryPref(stored.country);

    if (preferNative && nativeCfg) {
      if (nativeCfg.lang) lang = _normalizeLangPref(nativeCfg.lang);
      if (nativeCfg.country) country = _normalizeCountryPref(nativeCfg.country);
    }

    let resolvedLang;
    if (lang === 'it' || lang === 'en') {
      resolvedLang = lang;
    } else if (nativeCfg && (nativeCfg.resolvedLang === 'it' || nativeCfg.resolvedLang === 'en')) {
      resolvedLang = nativeCfg.resolvedLang;
    } else {
      resolvedLang = _detectBrowserLang();
    }

    let resolvedCountry;
    if (/^[A-Z]{2}$/.test(country)) {
      resolvedCountry = country;
    } else if (nativeCfg && /^[A-Za-z]{2}$/.test(String(nativeCfg.resolvedCountry || ''))) {
      resolvedCountry = String(nativeCfg.resolvedCountry).toUpperCase();
    } else {
      resolvedCountry = _detectBrowserCountry();
    }

    _localeState = {
      lang,
      country,
      resolvedLang,
      resolvedCountry,
      storefront: resolvedCountry.toLowerCase()
    };
    _syncActiveDict();
    return _localeState;
  }

  _computeLocaleState(true);

  function _syncHtmlLang() {
    if (typeof document !== 'undefined' && document.documentElement) {
      if (document.documentElement.lang !== _localeState.resolvedLang) {
        document.documentElement.lang = _localeState.resolvedLang;
      }
    }
  }

  function getLocaleConfig() {
    return Object.assign({}, _localeState);
  }

  function getConfiguredLang() {
    if (typeof PREFS !== 'undefined' && PREFS && typeof PREFS.lang === 'string') {
      const p = PREFS.lang;
      if (p === 'auto' || p === 'it' || p === 'en') return p;
      return _normalizeLangPref(p);
    }
    return _localeState.lang;
  }

  function getConfiguredCountry() {
    if (typeof PREFS !== 'undefined' && PREFS && typeof PREFS.country === 'string') {
      const c = PREFS.country;
      if (c === 'auto' || (c.length === 2 && _COUNTRY_BY_CODE[c])) return c;
      return _normalizeCountryPref(c);
    }
    return _localeState.country;
  }

  function getResolvedLang() {
    if (typeof PREFS !== 'undefined' && PREFS) {
      const p = PREFS.lang;
      if (p === 'it' || p === 'en') {
        if (_localeState.resolvedLang !== p) {
          _localeState.resolvedLang = p;
          _activeDict = I18N_DICT[p];
        }
        return p;
      }
      if (p === 'auto' || p == null) {
        return _localeState.resolvedLang || _detectBrowserLang();
      }
      const cfg = _normalizeLangPref(p);
      if (cfg === 'it' || cfg === 'en') {
        if (_localeState.resolvedLang !== cfg) {
          _localeState.resolvedLang = cfg;
          _activeDict = I18N_DICT[cfg];
        }
        return cfg;
      }
    }
    return _localeState.resolvedLang || _detectBrowserLang();
  }

  function getResolvedCountry() {
    const cfg = getConfiguredCountry();
    if (cfg !== 'auto' && /^[A-Z]{2}$/.test(cfg)) {
      _localeState.resolvedCountry = cfg;
      _localeState.storefront = cfg.toLowerCase();
      return cfg;
    }
    return _localeState.resolvedCountry || _detectBrowserCountry();
  }

  function getResolvedStorefront() {
    return getResolvedCountry().toLowerCase();
  }

  function _format(str, params) {
    if (!params || typeof str !== 'string') return str;
    return str.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(params, name) && params[name] !== undefined && params[name] !== null
        ? String(params[name])
        : match;
    });
  }

  function t(key, params) {
    const pLang = (typeof PREFS !== 'undefined' && PREFS) ? PREFS.lang : null;
    let dict;
    if (pLang === 'auto' || pLang == null) {
      dict = _activeDict;
    } else if (pLang === 'it' || pLang === 'en') {
      if (_localeState.resolvedLang !== pLang) {
        _localeState.resolvedLang = pLang;
        _activeDict = I18N_DICT[pLang];
      }
      dict = _activeDict;
    } else {
      dict = I18N_DICT[getResolvedLang()] || I18N_DICT.en;
    }
    let raw = dict[key];
    if (raw === undefined) raw = I18N_DICT.en[key];
    if (raw === undefined) raw = I18N_DICT.it[key];
    if (raw === undefined) return String(key);
    return params ? _format(raw, params) : raw;
  }

  function tPlural(count, oneKey, manyKey, params) {
    const n = Number(count);
    const key = Math.abs(n) === 1 ? oneKey : manyKey;
    if (!params) {
      const raw = t(key);
      return raw.indexOf('{count}') >= 0 ? raw.replace('{count}', String(n)) : raw;
    }
    const merged = Object.assign({ count: n }, params);
    return t(key, merged);
  }

  function getMonths(lang) {
    const l = lang === 'it' || lang === 'en' ? lang : getResolvedLang();
    return (I18N_MONTHS[l] || I18N_MONTHS.en).slice();
  }

  function lyKindLabel(kind) {
    if (kind === 'word') return t('lyrics.kind_word');
    if (kind === 'line') return t('lyrics.kind_line');
    return t('lyrics.kind_plain');
  }

  function getI18nCountries() {
    return I18N_COUNTRIES.slice();
  }

  function getCountryLabel(code, lang) {
    const l = lang === 'it' || lang === 'en' ? lang : getResolvedLang();
    let hit = _COUNTRY_BY_CODE[code];
    if (!hit) {
      const norm = _normalizeCountryPref(code);
      hit = _COUNTRY_BY_CODE[norm];
      if (!hit) return norm;
    }
    return hit[l] || hit.en;
  }

  function applyStaticI18n(root) {
    _syncHtmlLang();
    if (typeof document === 'undefined') return;
    const isFullDoc = !root || typeof root.querySelectorAll !== 'function';
    const domReady = document.readyState !== 'loading';
    if (isFullDoc && _staticI18nLang === _localeState.resolvedLang && (_staticI18nDomReady || !domReady)) {
      return;
    }
    const scope = isFullDoc ? document : root;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (k) el.setAttribute('placeholder', t(k));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const k = el.getAttribute('data-i18n-aria');
      if (k) el.setAttribute('aria-label', t(k));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      const k = el.getAttribute('data-i18n-title');
      if (k) el.setAttribute('title', t(k));
    });
    if (isFullDoc) {
      _staticI18nLang = _localeState.resolvedLang;
      _staticI18nDomReady = domReady;
    }
  }

  function _notifyLocaleCaches(langChanged, countryChanged) {
    if (typeof window === 'undefined') return;
    if (typeof window.syncTabLabels === 'function') window.syncTabLabels();
    if (typeof window.syncOutputDrawerLocale === 'function') window.syncOutputDrawerLocale();
    if (typeof window.invalidateLiveLocaleCaches === 'function') {
      window.invalidateLiveLocaleCaches(!!langChanged, !!countryChanged);
    }
    if (typeof window.invalidatePagesLocaleCaches === 'function') {
      window.invalidatePagesLocaleCaches(!!langChanged, !!countryChanged);
    }
    if (typeof redraw === 'function') redraw();
  }

  function setLocaleConfig(lang, country, opts) {
    const prevResolvedLang = getResolvedLang();
    const prevResolvedCountry = getResolvedCountry();

    const nextLang = lang !== undefined && lang !== null && lang !== ''
      ? _normalizeLangPref(lang)
      : getConfiguredLang();
    const nextCountry = country !== undefined && country !== null && country !== ''
      ? _normalizeCountryPref(country)
      : getConfiguredCountry();

    if (typeof PREFS !== 'undefined' && PREFS && typeof PREFS === 'object') {
      PREFS.lang = nextLang;
      PREFS.country = nextCountry;
      if (typeof savePrefs === 'function') savePrefs();
    } else if (typeof localStorage !== 'undefined') {
      try {
        const sp = JSON.parse(localStorage.getItem('sonora-prefs') || '{}') || {};
        sp.lang = nextLang;
        sp.country = nextCountry;
        localStorage.setItem('sonora-prefs', JSON.stringify(sp));
      } catch (e) {}
    }

    let nativeRes = null;
    try {
      const N = typeof window !== 'undefined' && window.SonoraNative;
      if (N && typeof N.setLocaleConfig === 'function') {
        nativeRes = JSON.parse(N.setLocaleConfig(nextLang, nextCountry) || 'null');
      }
    } catch (e) {}

    if (nativeRes && typeof nativeRes === 'object') {
      _localeState = {
        lang: _normalizeLangPref(nativeRes.lang || nextLang),
        country: _normalizeCountryPref(nativeRes.country || nextCountry),
        resolvedLang: nativeRes.resolvedLang === 'it' || nativeRes.resolvedLang === 'en'
          ? nativeRes.resolvedLang
          : (nextLang === 'it' || nextLang === 'en' ? nextLang : _detectBrowserLang()),
        resolvedCountry: /^[A-Za-z]{2}$/.test(String(nativeRes.resolvedCountry || ''))
          ? String(nativeRes.resolvedCountry).toUpperCase()
          : (/^[A-Z]{2}$/.test(nextCountry) ? nextCountry : _detectBrowserCountry()),
        storefront: String(nativeRes.storefront || '').toLowerCase()
      };
      if (!_localeState.storefront) _localeState.storefront = _localeState.resolvedCountry.toLowerCase();
      _syncActiveDict();
    } else {
      _computeLocaleState(false);
      if (typeof fetch === 'function' && (!opts || !opts.skipHttp)) {
        try {
          fetch('/api/locale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: nextLang, country: nextCountry })
          }).catch(() => {});
        } catch (e) {}
      }
    }

    const langChanged = _localeState.resolvedLang !== prevResolvedLang;
    const countryChanged = _localeState.resolvedCountry !== prevResolvedCountry;
    applyStaticI18n();
    if (langChanged || countryChanged || (opts && opts.force)) {
      _notifyLocaleCaches(langChanged, countryChanged);
    }
    return Object.assign({}, _localeState, { changed: langChanged || countryChanged });
  }

  function _handleNativeLocaleEvent(cfg) {
    let parsed = cfg;
    if (typeof cfg === 'string') {
      try { parsed = JSON.parse(cfg); } catch (e) { parsed = null; }
    }
    if (!parsed || typeof parsed !== 'object') return;
    const prevLang = getResolvedLang();
    const prevCountry = getResolvedCountry();

    const nextLang = _normalizeLangPref(parsed.lang || getConfiguredLang());
    const nextCountry = _normalizeCountryPref(parsed.country || getConfiguredCountry());
    const resolvedLang = parsed.resolvedLang === 'it' || parsed.resolvedLang === 'en'
      ? parsed.resolvedLang
      : (nextLang === 'it' || nextLang === 'en' ? nextLang : _detectBrowserLang());
    const resolvedCountry = /^[A-Za-z]{2}$/.test(String(parsed.resolvedCountry || ''))
      ? String(parsed.resolvedCountry).toUpperCase()
      : (/^[A-Z]{2}$/.test(nextCountry) ? nextCountry : _detectBrowserCountry());

    _localeState = {
      lang: nextLang,
      country: nextCountry,
      resolvedLang,
      resolvedCountry,
      storefront: String(parsed.storefront || resolvedCountry.toLowerCase()).toLowerCase()
    };
    _syncActiveDict();

    if (typeof PREFS !== 'undefined' && PREFS && typeof PREFS === 'object') {
      PREFS.lang = nextLang;
      PREFS.country = nextCountry;
      try { localStorage.setItem('sonora-prefs', JSON.stringify(PREFS)); } catch (e) {}
    }

    const langChanged = resolvedLang !== prevLang;
    const countryChanged = resolvedCountry !== prevCountry;
    applyStaticI18n();
    if (langChanged || countryChanged) {
      _notifyLocaleCaches(langChanged, countryChanged);
    }
  }

  function _hydrateBrowserHttpLocale() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    if (window.SonoraNative && typeof window.SonoraNative.getLocaleConfig === 'function') return;
    const cfgLang = getConfiguredLang();
    const cfgCountry = getConfiguredCountry();
    if (cfgLang !== 'auto' || cfgCountry !== 'auto') {
      fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: cfgLang, country: cfgCountry })
      }).catch(() => {});
      return;
    }
    fetch('/api/locale')
      .then(r => (r && r.ok ? r.json() : null))
      .then(data => {
        if (!data || typeof data !== 'object') return;
        const curL = getConfiguredLang();
        const curC = getConfiguredCountry();
        if (curL === 'auto' && curC === 'auto' && (data.lang !== 'auto' || data.country !== 'auto')) {
          _handleNativeLocaleEvent(data);
        }
      })
      .catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.I18N_DICT = I18N_DICT;
    window.I18N_COUNTRIES = I18N_COUNTRIES;
    window.I18N_MONTHS = I18N_MONTHS;
    window.t = t;
    window.tPlural = tPlural;
    window.getMonths = getMonths;
    window.lyKindLabel = lyKindLabel;
    window.getI18nCountries = getI18nCountries;
    window.getCountryLabel = getCountryLabel;
    window.getLocaleConfig = getLocaleConfig;
    window.getConfiguredLang = getConfiguredLang;
    window.getConfiguredCountry = getConfiguredCountry;
    window.getResolvedLang = getResolvedLang;
    window.getResolvedCountry = getResolvedCountry;
    window.getResolvedStorefront = getResolvedStorefront;
    window.setLocaleConfig = setLocaleConfig;
    window.applyStaticI18n = applyStaticI18n;
    window.onSonoraLocaleChanged = _handleNativeLocaleEvent;
  }

  if (typeof document !== 'undefined') {
    applyStaticI18n();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyStaticI18n();
        _hydrateBrowserHttpLocale();
      });
    } else {
      _hydrateBrowserHttpLocale();
    }
  }
})();
