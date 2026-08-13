const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const db = require('./database');
const https = require('https');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    backgroundColor: '#000000', titleBarStyle: 'hidden', frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: http: https://img.discogs.com https://*.discogs.com; connect-src 'self' https://api.discogs.com https://img.discogs.com https://*.discogs.com"]
      }
    });
  });

  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  runImportWorker();
});

app.on('before-quit', async () => {
  const autoBackup = db.getSetting('auto_backup');
  if (autoBackup === 'true') {
    try {
      const backupDir = db.getSetting('backup_dir') || app.getPath('downloads');
      const albums = db.getAllAlbums();
      const data = JSON.stringify({ bandaid_export: true, version: 1, exported_at: new Date().toISOString(), albums }, null, 2);
      const p = path.join(backupDir, `bandaid_autobackup_${new Date().toISOString().slice(0,10)}.json`);
      fs.writeFileSync(p, data);
    } catch(e) { /* silent fail */ }
  }
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); });
ipcMain.on('window-close', () => mainWindow.close());
ipcMain.handle('open-external', async (_, url) => shell.openExternal(url));

ipcMain.handle('db-get-all-albums', () => db.getAllAlbums());
ipcMain.handle('db-search-albums', (_, query) => db.searchAlbums(query));
ipcMain.handle('db-get-genres', () => db.getGenres());
ipcMain.handle('db-get-artists', () => db.getArtists());
ipcMain.handle('db-get-decades', () => db.getDecades());
ipcMain.handle('db-update-status', (_, { albumId, status }) => db.updateStatus(albumId, status));
ipcMain.handle('db-update-rating', (_, { albumId, rating }) => db.updateRating(albumId, rating));
ipcMain.handle('db-update-notes', (_, { albumId, notes }) => db.updateNotes(albumId, notes));
ipcMain.handle('db-update-date-heard', (_, { albumId, dateHeard }) => db.updateDateHeard(albumId, dateHeard));
ipcMain.handle('db-insert-album', (_, { album, status, notes }) => db.insertAlbum(album, status, notes));
ipcMain.handle('db-delete-album', (_, id) => db.deleteAlbum(id));
ipcMain.handle('db-delete-albums', (_, ids) => db.deleteAlbums(ids));
ipcMain.handle('db-get-stats', () => db.getStats());
ipcMain.handle('db-get-blocked-regions', () => db.getBlockedRegions());
ipcMain.handle('db-add-blocked-region', (_, { regionName, countryCodes }) => db.addBlockedRegion(regionName, countryCodes));
ipcMain.handle('db-remove-blocked-region', (_, name) => db.removeBlockedRegion(name));
ipcMain.handle('db-check-mbid-exists', (_, mbid) => db.checkMbidExists(mbid));

ipcMain.handle('db-get-setting', (_, key) => db.getSetting(key));
ipcMain.handle('db-set-setting', (_, { key, value }) => db.setSetting(key, value));
ipcMain.handle('db-check-title-artist-exists', (_, { title, artist }) => db.checkTitleArtistExists(title, artist));
ipcMain.handle('db-restore-albums', (_, albums) => { db.restoreAlbums(albums); return true; });
ipcMain.handle('db-restore-progress', (_, entries) => { db.restoreProgress(entries); return true; });

ipcMain.handle('db-get-play-count', (_, id) => db.getPlayCount(id));
ipcMain.handle('db-reset-play-count', (_, id) => db.resetPlayCount(id));
ipcMain.handle('db-increment-play-count', (_, id) => db.incrementPlayCount(id));

// Native dialog helpers — window.confirm/prompt are unreliable in Electron
ipcMain.handle('dialog-confirm', async (_, { title, message }) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Cancel', 'Confirm'], defaultId: 0, cancelId: 0,
    title, message
  });
  return result.response === 1;
});

ipcMain.handle('dialog-confirm-typed', async (_, { title, message, requiredText }) => {
  // Show warning then a separate input dialog via repeated prompts isn't possible natively.
  // Instead show two-step: first confirm, then a second confirm with the required text shown.
  const step1 = await dialog.showMessageBox(mainWindow, {
    type: 'warning', buttons: ['Cancel', 'Yes, delete everything'], defaultId: 0, cancelId: 0,
    title, message
  });
  if (step1.response !== 1) return false;
  const step2 = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', `DELETE ALL`],
    defaultId: 0, cancelId: 0,
    title: 'FINAL CONFIRMATION',
    message: `This will permanently delete ALL albums from your library.\n\nClick "DELETE ALL" to confirm.`
  });
  return step2.response === 1;
});

ipcMain.handle('choose-backup-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (!result.canceled && result.filePaths[0]) {
    db.setSetting('backup_dir', result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('get-data-dir', () => {
  return db.getCurrentDbPath ? path.dirname(db.getCurrentDbPath()) : db.getDefaultDataDir();
});

ipcMain.handle('choose-data-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose BandAid data directory'
  });
  if (!result.canceled && result.filePaths[0]) {
    const newDir = result.filePaths[0];
    try {
      db.migrateToDir(newDir);
      db.setSetting('data_dir', newDir);
      return { success: true, path: newDir };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }
  return null;
});

// Serve gothic cross image as base64 so canvas can load it in production
ipcMain.handle('get-cross-image', () => {
  const imgPath = isDev
    ? path.join(__dirname, '../public/gothic-cross-pixel.png')
    : path.join(process.resourcesPath, 'gothic-cross-pixel.png');
  try {
    const data = fs.readFileSync(imgPath);
    return 'data:image/png;base64,' + data.toString('base64');
  } catch(e) {
    return null;
  }
});

// LIVE SEARCH IPC
ipcMain.handle('search-live', async (_, query) => {
  const token = db.getSetting('discogs_token');
  if (!token) return { error: 'No Discogs token set.' };

  const options = {
    headers: {
      'User-Agent': 'BandaidDesktop/1.0',
      'Authorization': `Discogs token=${token}`
    }
  };

  const trim = query.trim();
  const strategies = [];

  const dashMatch = trim.match(/^(.+?)\s+[-–]\s+(.+)$/);
  if (dashMatch) {
    const a = encodeURIComponent(dashMatch[1].trim());
    const t = encodeURIComponent(dashMatch[2].trim());
    strategies.push(`https://api.discogs.com/database/search?artist=${a}&release_title=${t}&type=master&per_page=8`);
    // Also try reversed order in case user typed title - artist
    strategies.push(`https://api.discogs.com/database/search?artist=${t}&release_title=${a}&type=master&per_page=5`);
  } else {
    // No dash — try full string as title, then split permutations
    strategies.push(
      `https://api.discogs.com/database/search?release_title=${encodeURIComponent(trim)}&type=master&per_page=8`
    );
    const words = trim.split(/\s+/);
    if (words.length >= 2) {
      // Last word as artist
      const a1 = words[words.length - 1];
      const t1 = words.slice(0, -1).join(' ');
      strategies.push(`https://api.discogs.com/database/search?artist=${encodeURIComponent(a1)}&release_title=${encodeURIComponent(t1)}&type=master&per_page=5`);
      // First word as artist
      const a2 = words[0];
      const t2 = words.slice(1).join(' ');
      strategies.push(`https://api.discogs.com/database/search?artist=${encodeURIComponent(a2)}&release_title=${encodeURIComponent(t2)}&type=master&per_page=5`);
    }
  }

  const seen = new Set();
  const merged = [];

  for (const url of strategies) {
    try {
      const res = await httpsGetWithHeaders(url, options);
      if (res.status === 429) return { error: 'Rate limited by Discogs. Try again in a minute.' };
      if (res.status !== 200) continue;
      const json = JSON.parse(res.data);
      if (!json.results) continue;
      for (const r of json.results) {
        if (!seen.has(r.id)) {
          seen.add(r.id);
          merged.push(r);
        }
      }
    } catch (_) { continue; }
  }

  if (merged.length === 0) return [];

  const queryLower = trim.toLowerCase();
  const scored = merged.map(r => {
    const rTitle = (r.title || '').toLowerCase();
    const parts = rTitle.split(' - ');
    const rAlbum = parts.length > 1 ? parts[parts.length - 1] : rTitle;
    let score = 0;
    if (rAlbum.includes(queryLower) || queryLower.includes(rAlbum)) score += 10;
    if (rAlbum === queryLower) score += 20;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 8).map(({ r }) => ({
    id: r.id,
    display_title: r.title,
    year: r.year,
    cover_url: r.thumb || r.cover_image,
    genre: pickBestGenre(r.genre, r.style),
  }));
});

// IMPORT QUEUE IPC
ipcMain.handle('queue-insert-batch', (_, items) => db.queueInsertBatch(items));
ipcMain.handle('queue-get-all', () => db.queueGetAll());
ipcMain.handle('queue-get-stats', () => db.queueGetStats());
ipcMain.handle('queue-retry-failed', () => { db.queueRetryFailed(); runImportWorker(); });
ipcMain.handle('queue-clear', () => db.queueClear());

function httpsGetWithHeaders(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = urlStr.startsWith('https') ? https : http;
    lib.get(urlStr, options, (res) => {
      let data = '';
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return httpsGetWithHeaders(res.headers.location, options).then(resolve).catch(reject);
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

// Discogs returns genres like ["Electronic","Rock"] for Bowie — pick the most
// representative one by de-prioritising known catch-all genres.
const GENRE_DEPRIORITY = ['electronic', 'pop', 'stage & screen', 'non-music', 'children\'s', 'brass & military', 'reggae'];
function pickBestGenre(genres, styles) {
  if (!genres || genres.length === 0) return null;
  // Prefer styles (more specific) over genres
  if (styles && styles.length > 0) {
    // But only use a style if it's reasonably descriptive
    return styles[0];
  }
  // If multiple genres, pick first non-deprioritised one
  const preferred = genres.find(g => !GENRE_DEPRIORITY.includes(g.toLowerCase()));
  return preferred || genres[0];
}

async function searchDiscogs(artist, title) {
  const token = db.getSetting('discogs_token');
  if (!token) return null;

  const options = { headers: { 'User-Agent': 'BandaidDesktop/1.0', 'Authorization': `Discogs token=${token}` } };

  const titleLower = title.toLowerCase();
  const artistLower = (artist || '').toLowerCase();

  // Build multiple search strategies — try artist+title first, then title-only
  const strategies = [];
  if (artist) {
    strategies.push(`https://api.discogs.com/database/search?artist=${encodeURIComponent(artist)}&release_title=${encodeURIComponent(title)}&type=master&per_page=8`);
  }
  strategies.push(`https://api.discogs.com/database/search?release_title=${encodeURIComponent(title)}&type=master&per_page=8`);
  // If title has quotes (e.g. "Heroes"), also try without quotes
  if (title.includes('"') || title.includes("'")) {
    const stripped = title.replace(/['"]/g, '');
    if (artist) strategies.push(`https://api.discogs.com/database/search?artist=${encodeURIComponent(artist)}&release_title=${encodeURIComponent(stripped)}&type=master&per_page=5`);
    strategies.push(`https://api.discogs.com/database/search?release_title=${encodeURIComponent(stripped)}&type=master&per_page=5`);
  }

  const seen = new Set();
  let allResults = [];

  for (const url of strategies) {
    const res = await httpsGetWithHeaders(url, options);
    if (res.status === 429) {
      const retryAfter = res.headers['retry-after'] || '60';
      return { rateLimited: true, retryAfter: parseInt(retryAfter, 10) };
    }
    if (res.status !== 200) continue;
    let json;
    try { json = JSON.parse(res.data); } catch { continue; }
    if (!json.results) continue;
    for (const r of json.results) {
      if (!seen.has(r.id)) { seen.add(r.id); allResults.push(r); }
    }
    if (allResults.length >= 5) break; // enough candidates
  }

  if (allResults.length === 0) return null;

  let bestResult = null;
  let bestScore = -1;

  for (const r of allResults) {
    const rTitle = (r.title || '').toLowerCase();
    const parts = rTitle.split(' - ');
    const rArtist = parts.length > 1 ? parts.slice(0, -1).join(' - ') : '';
    const rAlbum = parts.length > 1 ? parts[parts.length - 1] : rTitle;

    let score = 0;
    if (rAlbum.includes(titleLower) || titleLower.includes(rAlbum)) score += 10;
    if (rAlbum === titleLower) score += 20;
    if (artist && (rArtist.includes(artistLower) || artistLower.includes(rArtist))) score += 10;
    if (artist && rArtist === artistLower) score += 20;

    if (score > bestScore) { bestScore = score; bestResult = r; }
  }

  if (!bestResult) bestResult = allResults[0];

  // The search result already contains: title, year, genre, style, cover_image, thumb, uri
  // Build a result from search data first — this always works
  // Then try to enrich with the master detail endpoint (optional, best-effort)
  
  // Parse artist/title from Discogs "Artist - Title" format in search result
  let cleanArtist = artist;
  let cleanTitle = title;
  const searchTitleStr = bestResult.title || '';
  const searchTitleParts = searchTitleStr.split(' - ');
  if (searchTitleParts.length >= 2) {
    const parsedArtist = searchTitleParts.slice(0, -1).join(' - ').replace(/\s*\(\d+\)$/, '');
    const parsedTitle = searchTitleParts[searchTitleParts.length - 1];
    if (parsedArtist) cleanArtist = parsedArtist;
    if (parsedTitle) cleanTitle = parsedTitle;
  }

  const searchGenres = bestResult.genre || [];
  const searchStyles = bestResult.style || [];
  const genre = pickBestGenre(
    Array.isArray(searchGenres) ? searchGenres : [searchGenres],
    Array.isArray(searchStyles) ? searchStyles : [searchStyles]
  );

  const discogs_url = bestResult.uri ? `https://www.discogs.com${bestResult.uri}` : null;

  // Base result from search — guaranteed to exist
  const base = {
    title: cleanTitle,
    artist: cleanArtist,
    year: bestResult.year || null,
    genre,
    country_code: null,
    cover_url: bestResult.cover_image || bestResult.thumb || null,
    duration_sec: null,
    track_count: null,
    format: bestResult.format?.[0] || null,
    label: bestResult.label?.[0] || null,
    discogs_url,
    discogs_master_id: bestResult.id || null,
  };

  // Try to enrich with master endpoint — optional, non-fatal
  if (bestResult.resource_url) {
    try {
      const masterDetailRes = await httpsGetWithHeaders(bestResult.resource_url, options);
      if (masterDetailRes.status === 429) {
        const retryAfter = masterDetailRes.headers['retry-after'] || '60';
        return { rateLimited: true, retryAfter: parseInt(retryAfter, 10) };
      }
      if (masterDetailRes.status === 200) {
        const master = JSON.parse(masterDetailRes.data);

        // Enrich tracklist
        if (master.tracklist && master.tracklist.length > 0) {
          base.track_count = master.tracklist.length;
          let sec = 0;
          for (const t of master.tracklist) {
            if (t.duration) {
              const p = t.duration.split(':');
              if (p.length === 2) sec += parseInt(p[0]) * 60 + parseInt(p[1]);
            }
          }
          if (sec > 0) base.duration_sec = sec;
        }

        // Enrich artist (cleaner from master.artists)
        if (master.artists && master.artists.length > 0) {
          base.artist = master.artists[0].name.replace(/\s*\(\d+\)$/, '');
        }

        // Enrich genre/style from master if better
        const mGenres = master.genres || [];
        const mStyles = master.styles || [];
        if (mGenres.length > 0 || mStyles.length > 0) {
          base.genre = pickBestGenre(mGenres, mStyles) || base.genre;
        }

        // Enrich title from master
        if (master.title) base.title = master.title;
        if (master.year) base.year = master.year;
        if (master.uri) base.discogs_url = `https://www.discogs.com${master.uri}`;
      }
    } catch (_) {
      // master fetch failed — use base search result data, still a success
    }
  }

  return base;
}

// --- DUPLICATE DETECTION HELPERS ---
function normTitle(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function isFuzzyDuplicate(title1, artist1, title2, artist2) {
  const tDist = levenshtein(normTitle(title1), normTitle(title2));
  const aDist = levenshtein(normTitle(artist1), normTitle(artist2));
  return tDist <= 3 && aDist <= 3;
}

let isWorkerRunning = false;
async function runImportWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    while (true) {
      db.queueResetRateLimited();
      const pending = db.queueGetPending();
      if (pending.length === 0) break;

      const blockedRegions = db.getBlockedRegions();
      let rateLimitedThisBatch = false;

      const allAlbums = db.getAllAlbums(); // cached outside loop - Bug 10 fix
      for (const item of pending) {
        // Exact duplicate check
        if (db.checkTitleArtistExists(item.parsed_title, item.parsed_artist)) {
          db.queueSetStatus(item.id, 'duplicate');
          mainWindow?.webContents.send('queue-progress');
          continue;
        }

        // Fuzzy duplicate check
        const sameArtistAlbums = allAlbums.filter(a =>
          levenshtein(normTitle(a.artist), normTitle(item.parsed_artist || '')) <= 3
        );
        const fuzzyDup = sameArtistAlbums.some(a =>
          isFuzzyDuplicate(item.parsed_title, item.parsed_artist || '', a.title, a.artist)
        );
        if (fuzzyDup) {
          db.queueSetStatus(item.id, 'duplicate', 'Fuzzy match — possible duplicate');
          mainWindow?.webContents.send('queue-progress');
          continue;
        }

        let searchArtist = item.parsed_artist;
        let isClassical = false;
        if (item.parsed_conductor && item.parsed_orchestra) {
          searchArtist = `${item.parsed_conductor} ${item.parsed_orchestra}`;
          isClassical = true;
        }

        const release = await searchDiscogs(searchArtist, item.parsed_title);

        if (release && release.rateLimited) {
          const retryDate = new Date();
          retryDate.setSeconds(retryDate.getSeconds() + release.retryAfter);
          db.queueSetRateLimited(item.id, retryDate.toISOString());
          mainWindow?.webContents.send('queue-progress');
          rateLimitedThisBatch = true;
          break; // T2 — break inner loop, let outer while handle sleep via nextRetry
        }

        if (release) {
          // MBID dedup
          if (release.mbid && db.checkMbidExists(release.mbid)) {
            db.queueSetStatus(item.id, 'duplicate', 'MBID already in library');
            mainWindow?.webContents.send('queue-progress');
            continue;
          }

          // Discogs master ID dedup (T4)
          if (release.discogs_master_id && db.checkDiscogsIdExists(release.discogs_master_id)) {
            db.queueSetStatus(item.id, 'duplicate', 'Discogs master ID already in library');
            mainWindow?.webContents.send('queue-progress');
            continue;
          }

          // Region blocking
          if (release.country_code) {
            const isBlocked = blockedRegions.some(br =>
              (br.country_codes || '').split(',').map(c => c.trim()).includes(release.country_code)
            );
            if (isBlocked) {
              db.queueSetStatus(item.id, 'blocked', `Country ${release.country_code} blocked`);
              mainWindow?.webContents.send('queue-progress');
              continue;
            }
          }

          const album = {
            title: release.title, artist: release.artist, year: item.parsed_year || release.year,
            genre: item.parsed_genre || release.genre || null,
            subgenre: null, country_code: release.country_code,
            cover_url: release.cover_url, duration_sec: release.duration_sec, track_count: release.track_count,
            format: release.format, label: release.label, discogs_url: release.discogs_url,
            discogs_master_id: release.discogs_master_id,
            is_classical: isClassical, composer: isClassical ? item.parsed_artist : null,
            conductor: item.parsed_conductor, orchestra: item.parsed_orchestra
          };
          db.insertAlbum(album, item.parsed_status, item.parsed_notes);
          db.queueSetStatus(item.id, 'done');
        } else {
          db.queueSetStatus(item.id, 'failed', 'Not found');
        }
        mainWindow?.webContents.send('queue-progress');
        await new Promise(r => setTimeout(r, 500));
      }

      const stats = db.queueGetStats();
      if (stats.nextRetry) {
        const now = new Date();
        const retry = new Date(stats.nextRetry);
        const diff = retry - now;
        if (diff > 0) {
          mainWindow?.webContents.send('queue-progress');
          await new Promise(r => setTimeout(r, diff));
        }
      } else if (!rateLimitedThisBatch) {
        break;
      }
    }
  } finally {
    isWorkerRunning = false;
  }
}

ipcMain.on('trigger-worker', () => runImportWorker());
