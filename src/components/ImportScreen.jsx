// src/components/ImportScreen.jsx
import React, { useState, useEffect } from 'react';
import './ImportScreen.css';

function parseBatch(text) {
  const lines = text.split('\n');
  const items = [];
  let currentItem = null;
  let activeGenre = null;

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    if (/^(Best|Alt|Notes?):/i.test(line)) {
      if (currentItem) {
        currentItem.parsed_notes = currentItem.parsed_notes
          ? `${currentItem.parsed_notes}\n${line}`
          : line;
      }
      continue;
    }

    line = line.replace(/^[\-\*\_•\>\+]+\s*/, '').replace(/^\d+[\.]\]\s*/, '').trim();

    let status = 'unheard';
    if (/^\[[xX]\]/.test(line)) {
      status = 'heard';
      line = line.replace(/^\[[xX]\]\s*/, '');
    } else if (/^\[\s*\]/.test(line)) {
      status = 'unheard';
      line = line.replace(/^\[\s*\]\s*/, '');
    }

    line = line.replace(/^[\-\*\_•\>\+]+\s*/, '').replace(/^\d+[\.]\]\s*/, '').trim();
    if (!line) continue;

    let lineGenre = null;
    const emDashMatch = line.match(/^(.+?)\s+[—–]\s+(.+)$/);
    if (emDashMatch && (emDashMatch[2].includes(' - ') || emDashMatch[2].includes(' – '))) {
      lineGenre = emDashMatch[1].replace(/^\[.*?\]\s*/, '').trim();
      line = emDashMatch[2].trim();
      activeGenre = lineGenre;
    }

    const hasDashSeparator = /\s+[\-–]\s+/.test(line);
    const hasYear = /\(\d{4}\)/.test(line);
    if (!lineGenre && !hasDashSeparator && !hasYear) {
      activeGenre = line.replace(/^\[.*?\]\s*/, '').trim();
      continue;
    }

    const finalGenre = lineGenre || activeGenre || null;
    line = line.replace(/\s*\([^)]*(?:min|complete|~)[^)]*\)/gi, '').trim();

    const annotationMatch = line.match(/^(.*?)\s+(?:Best|Alt|Notes?):\s*.+$/i);
    if (annotationMatch) {
      const noteContent = line.slice(annotationMatch[1].length).trim();
      if (currentItem) currentItem.parsed_notes = noteContent;
      line = annotationMatch[1].trim();
    }

    let year = null;
    const yearMatch = line.match(/\((\d{4})\)\s*$/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      line = line.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    }

    let artist = null;
    let title = null;
    const dashMatch = line.match(/^(.+?)\s+[\-–]\s+(.+)$/);
    if (dashMatch) {
      artist = dashMatch[1].replace(/^\[.*?\]\s*/, '').trim();
      title = dashMatch[2].replace(/^\[.*?\]\s*/, '').trim();
    } else {
      title = line.replace(/^\[.*?\]\s*/, '').trim();
    }

    if (title) {
      currentItem = {
        raw_line: rawLine,
        parsed_artist: artist || null,
        parsed_title: title,
        parsed_year: year,
        parsed_genre: finalGenre,
        parsed_status: status,
        parsed_notes: null,
        parsed_conductor: null,
        parsed_orchestra: null,
      };
      items.push(currentItem);
    }
  }

  return items;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse CSV row respecting quoted fields
  const parseRow = (line) => {
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cols.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols;
  };

  const headers = parseRow(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const isRYM = headers.includes('RYM Rating') || headers.includes('First Name');

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });

    if (isRYM) {
      // RYM export format
      const firstName = row['First Name'] || '';
      const lastName = row['Last Name'] || '';
      const artist = [firstName, lastName].filter(Boolean).join(' ') || null;
      const title = row['Title'] || '';
      if (!title) continue;
      const releaseDate = row['Release_Date'] || '';
      const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null;
      const rymRating = parseFloat(row['RYM Rating'] || '0');
      const rating = rymRating > 0 ? Math.min(5, Math.round(rymRating)) : null;
      const ownership = (row['Ownership'] || '').toLowerCase();
      const status = ownership === 'own' ? 'heard' : 'wishlist';
      const notes = row['Review'] || null;

      items.push({
        raw_line: `CSV: ${artist || 'Unknown'} - ${title}`,
        parsed_artist: artist,
        parsed_title: title,
        parsed_year: year,
        parsed_genre: null,
        parsed_status: status,
        parsed_notes: notes,
        parsed_conductor: null,
        parsed_orchestra: null,
      });
    } else {
      // Generic CSV: artist,title,year,genre,status,notes
      const title = row['title'] || row['Title'] || '';
      if (!title) continue;
      const artist = row['artist'] || row['Artist'] || null;
      const year = parseInt(row['year'] || row['Year'] || '0', 10) || null;
      const genre = row['genre'] || row['Genre'] || null;
      const status = row['status'] || row['Status'] || 'unheard';
      const notes = row['notes'] || row['Notes'] || null;

      items.push({
        raw_line: `CSV: ${artist || 'Unknown'} - ${title}`,
        parsed_artist: artist,
        parsed_title: title,
        parsed_year: year,
        parsed_genre: genre,
        parsed_status: ['heard','unheard','wishlist','skipped'].includes(status) ? status : 'unheard',
        parsed_notes: notes,
        parsed_conductor: null,
        parsed_orchestra: null,
      });
    }
  }

  return items;
}

const EMPTY_MANUAL = {
  artist: '', title: '', year: '', genre: '', status: 'unheard',
  format: '', label: '', track_count: '', duration: '', notes: '',
  rating: null, cover_url: null,
};

export default function ImportScreen({ onClose, onGoToSettings }) {
  const [inputText, setInputText] = useState('');
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [hasDiscogsToken, setHasDiscogsToken] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Mode: 'batch' | 'live' | 'manual'
  const [mode, setMode] = useState('batch');

  const [liveQuery, setLiveQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);

  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [dupWarning, setDupWarning] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualSaved, setManualSaved] = useState(false);

  const refreshQueue = async () => {
    if (!window.api) return;
    const [s, q] = await Promise.all([window.api.queueGetStats(), window.api.queueGetAll()]);
    setStats(s); setQueue(q);
    if (s.nextRetry) {
      const diff = Math.max(0, Math.floor((new Date(s.nextRetry) - new Date()) / 1000));
      setTimeRemaining(diff);
    } else {
      setTimeRemaining(0);
    }
  };

  useEffect(() => {
    refreshQueue();
    window.api.dbGetSetting('discogs_token').then(t => setHasDiscogsToken(!!t));
    const unsub = window.api.onQueueProgress(() => refreshQueue());
    const tick = setInterval(() => setTimeRemaining(prev => Math.max(0, prev - 1)), 1000);
    return () => { unsub(); clearInterval(tick); };
  }, []);

  const handleParse = async () => {
    if (!inputText.trim()) return;
    const items = parseBatch(inputText);
    const duplicates = [];
    const toQueue = [];
    for (const item of items) {
      const isDup = await window.api.dbCheckTitleArtistExists({ title: item.parsed_title, artist: item.parsed_artist || '' });
      if (isDup) duplicates.push(item.parsed_title);
      else toQueue.push(item);
    }
    if (duplicates.length > 0) {
      const names = duplicates.slice(0, 5).join(', ') + (duplicates.length > 5 ? ` ...and ${duplicates.length - 5} more` : '');
      setDupWarning(`SKIPPED ${duplicates.length} DUPLICATE(S): ${names}`);
      setTimeout(() => setDupWarning(''), 6000);
    }
    if (toQueue.length === 0) { setInputText(''); return; }
    await window.api.queueInsertBatch(toQueue);
    setInputText('');
    refreshQueue();
    window.api.triggerWorker();
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const items = parseCSV(ev.target.result);
      if (!items.length) { console.warn('No valid rows found in CSV.'); return; }
      const duplicates = [];
      const toQueue = [];
      for (const item of items) {
        const isDup = await window.api.dbCheckTitleArtistExists({ title: item.parsed_title, artist: item.parsed_artist || '' });
        if (isDup) duplicates.push(item.parsed_title);
        else toQueue.push(item);
      }
      if (duplicates.length > 0) {
        const names = duplicates.slice(0, 5).join(', ') + (duplicates.length > 5 ? ` ...and ${duplicates.length - 5} more` : '');
        setDupWarning(`CSV: SKIPPED ${duplicates.length} DUPLICATE(S): ${names}`);
        setTimeout(() => setDupWarning(''), 6000);
      }
      if (toQueue.length === 0) return;
      await window.api.queueInsertBatch(toQueue);
      refreshQueue();
      window.api.triggerWorker();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLiveSearch = async (e) => {
    const val = e.target.value;
    setLiveQuery(val);
    if (val.trim().length > 2) {
      const results = await window.api.searchLive(val);
      setLiveResults(results);
    } else {
      setLiveResults([]);
    }
  };

  const addLiveResultToQueue = async (result) => {
    let artist = null;
    let title = result.display_title;
    const dashMatch = result.display_title.match(/^(.+?)\s+[-\u2013]\s+(.+)$/);
    if (dashMatch) { artist = dashMatch[1].trim(); title = dashMatch[2].trim(); }
    const isDup = await window.api.dbCheckTitleArtistExists({ title, artist: artist || '' });
    if (isDup) { console.warn(`"${title}" is already in your library.`); return; }
    const item = {
      raw_line: `Live Search: ${result.display_title} (${result.year || 'Unknown'})`,
      parsed_artist: artist, parsed_title: title,
      parsed_year: result.year ? parseInt(result.year, 10) : null,
      parsed_genre: result.genre || null, parsed_status: 'unheard',
      parsed_notes: null, parsed_conductor: null, parsed_orchestra: null,
    };
    await window.api.queueInsertBatch([item]);
    setLiveQuery(''); setLiveResults([]);
    refreshQueue();
    window.api.triggerWorker();
  };

  const handleManualCoverUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setManual(m => ({ ...m, cover_url: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualSubmit = async () => {
    if (!manual.title.trim()) { console.warn('TITLE IS REQUIRED.'); return; }
    setManualSaving(true);

    const parseDuration = (s) => {
      if (!s) return null;
      const p = s.split(':');
      if (p.length === 2) return parseInt(p[0]) * 60 + parseInt(p[1]);
      return null;
    };

    const album = {
      title: manual.title.trim(),
      artist: manual.artist.trim() || null,
      year: parseInt(manual.year, 10) || null,
      genre: manual.genre.trim() || null,
      format: manual.format.trim() || null,
      label: manual.label.trim() || null,
      track_count: parseInt(manual.track_count, 10) || null,
      duration_sec: parseDuration(manual.duration),
      cover_url: manual.cover_url || null,
      is_classical: 0,
      subgenre: null, composer: null, conductor: null, orchestra: null,
      catalogue_no: null, period: null, country_code: null, label_country: null,
      mbid: null, discogs_url: null, discogs_master_id: null,
    };

    await window.api.dbInsertAlbum(album, manual.status, manual.notes.trim() || null);
    if (manual.rating) {
      const id = await window.api.dbGetAllAlbums().then(all => all.find(a => a.title === album.title && a.artist === album.artist)?.id);
      if (id) await window.api.dbUpdateRating({ albumId: id, rating: manual.rating });
    }
    setManualSaving(false);
    setManualSaved(true);
    setManual(EMPTY_MANUAL);
    setTimeout(() => setManualSaved(false), 2000);
  };

  const renderQueuePanel = () => (
    <div className="import-right" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {stats && (
        <div className="queue-stats" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div className="stat-tile" style={{ border: '1px solid #444', padding: '8px', fontSize: '8px' }}><span>TOTAL </span><span className="v">{stats.total}</span></div>
          <div className="stat-tile" style={{ border: '1px solid yellow', color: 'yellow', padding: '8px', fontSize: '8px' }}><span>PENDING </span><span className="v">{stats.pending}</span></div>
          <div className="stat-tile" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)', padding: '8px', fontSize: '8px' }}><span>DONE </span><span className="v">{stats.done}</span></div>
          <div className="stat-tile" style={{ border: '1px solid var(--red)', padding: '8px', fontSize: '8px' }}><span>FAILED </span><span className="v">{stats.failed}</span></div>
          <div className="stat-tile" style={{ border: '1px solid orange', padding: '8px', fontSize: '8px' }}><span>RATE LMT </span><span className="v">{stats.rate_limited}</span></div>
        </div>
      )}
      <div className="queue-list" style={{ flex: 1, overflowY: 'auto', border: '1px solid #444', padding: '8px' }}>
        {queue.map(q => {
          let statusColor = '#888';
          if (q.status === 'done') statusColor = 'var(--cyan)';
          else if (q.status === 'pending') statusColor = 'yellow';
          else if (q.status === 'failed') statusColor = 'var(--red)';
          else if (q.status === 'blocked') statusColor = 'var(--red)';
          return (
            <div key={q.id} className={`queue-item ${q.status}`} style={{ fontSize: '8px', marginBottom: '8px', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
              <div className="qi-line">{q.raw_line}</div>
              <div className="qi-status" style={{ color: statusColor, marginTop: '4px' }}>
                {q.status.toUpperCase()}
                {q.error && <span className="qi-err"> - {q.error}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        {stats && stats.failed > 0 && (
          <button style={{ borderColor: 'orange', color: 'orange', background: 'transparent', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '8px', padding: '8px', flex: 1 }}
            onClick={async () => { await window.api.queueRetryFailed(); refreshQueue(); }}>
            ↺ RETRY FAILED ({stats.failed})
          </button>
        )}
        <button style={{ borderColor: 'var(--red)', color: 'var(--red)', background: 'transparent', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '8px', padding: '8px' }}
          onClick={async () => { await window.api.queueClear(); refreshQueue(); }}>CLEAR HISTORY</button>
      </div>
    </div>
  );

  // Bug 5: Full-screen gate when no Discogs token
  if (!hasDiscogsToken && mode !== 'manual') {
    return (
      <div className="import-screen">
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}>CLOSE</button>
        </div>
        <div className="no-token-gate">
          <h2>⚠ DISCOGS API TOKEN REQUIRED</h2>
          <p>To import albums, BandAid needs your free Discogs personal access token.</p>
          <div className="token-steps">
            <div className="token-step"><span>1</span>Go to <strong>discogs.com</strong> and create a free account</div>
            <div className="token-step"><span>2</span>Go to <strong>discogs.com/settings/developers</strong></div>
            <div className="token-step"><span>3</span>Click <strong>"Generate new token"</strong></div>
            <div className="token-step"><span>4</span>Copy the token</div>
            <div className="token-step"><span>5</span>Go to <strong>Settings → API Keys</strong> in BandAid and paste it</div>
          </div>
          <button onClick={() => { if (onGoToSettings) onGoToSettings(); else onClose(); }}>GO TO SETTINGS</button>
          <button style={{ marginTop: '8px', borderColor: '#444', color: '#888' }} onClick={() => setMode('manual')}>USE MANUAL ENTRY INSTEAD</button>
        </div>
      </div>
    );
  }

  return (
    <div className="import-screen">
      {/* Bug 6: Rate limit banner - visible regardless of mode */}
      {stats && stats.rate_limited > 0 && timeRemaining > 0 && (
        <div style={{ color: 'var(--red)', fontSize: '8px', marginBottom: '12px', padding: '8px', border: '1px solid var(--red)', background: 'rgba(255,0,60,0.05)' }}>
          ⏳ DISCOGS RATE LIMIT HIT — RESUMING IN {timeRemaining}s
        </div>
      )}
      {/* Bug 11: Duplicate warning banner */}
      {dupWarning && (
        <div style={{ color: 'orange', fontSize: '8px', marginBottom: '12px', padding: '8px', border: '1px solid orange', background: 'rgba(255,165,0,0.05)' }}>
          ⚠ {dupWarning}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>IMPORT</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['batch', 'live', 'manual'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ fontSize: '8px', padding: '6px 10px',
                borderColor: mode === m ? 'var(--cyan)' : '#333',
                color: mode === m ? 'var(--cyan)' : '#888',
                background: mode === m ? 'rgba(0,240,255,0.05)' : 'transparent' }}>
              {m === 'batch' ? 'BATCH' : m === 'live' ? 'LIVE SEARCH' : 'MANUAL'}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}>CLOSE</button>
      </div>



      <div className="import-container" style={{ display: 'flex', gap: '24px', width: '100%', height: '100%' }}>
        <div className="import-left" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* BATCH MODE */}
          {mode === 'batch' && (
            <>
              <div style={{ fontSize: '8px', color: '#888', marginBottom: '8px', lineHeight: '1.4' }}>
                Supported formats:<br/>
                Artist – Title (Year)<br/>
                Title (Year)<br/>
                Title<br/>
                [x] Artist – Title (Year) ← marks as already heard<br/><br/>
                Artist name is optional. Including it improves lookup accuracy.
              </div>
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label htmlFor="txt-import-input" className="import-file-btn">
                  IMPORT FROM .TXT FILE
                </label>
                <input id="txt-import-input" type="file" accept=".txt" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setInputText(ev.target.result);
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
                <label htmlFor="csv-import-input" className="import-file-btn">
                  IMPORT FROM .CSV FILE
                </label>
                <input id="csv-import-input" type="file" accept=".csv" style={{ display: 'none' }}
                  onChange={handleCSVImport}
                />
              </div>
              <textarea
                placeholder="Artist - Title - Year [HEARD] {Notes}&#10;&#10;Best: Notes..."
                value={inputText} onChange={e => setInputText(e.target.value)}
                style={{ flex: 1, marginBottom: '16px', background: '#000', color: '#fff', border: '1px solid #444', fontFamily: '"Press Start 2P", monospace', fontSize: '8px', padding: '12px', whiteSpace: 'pre-wrap' }}
              />
              <button className="import-btn" onClick={handleParse}>ADD TO QUEUE</button>

            </>
          )}

          {/* LIVE SEARCH MODE */}
          {mode === 'live' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <input
                type="text" placeholder="Search album (e.g. Master of Reality)..."
                value={liveQuery} onChange={handleLiveSearch}
                style={{ marginBottom: '8px', background: '#000', color: '#fff', border: '1px solid #444', fontFamily: '"Press Start 2P", monospace', fontSize: '8px', padding: '12px', width: '100%' }}
              />
              <div style={{ fontSize: '7px', color: 'var(--cyan)', marginBottom: '12px' }}>
                TIP: TYPE "ARTIST TITLE" OR "TITLE ARTIST" — BOTH WORK
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #444', padding: '12px', fontSize: '8px', color: '#ccc', background: 'var(--bg2)' }}>
                {liveResults?.error ? (
                  <div style={{ color: 'var(--red)' }}>⚠ {liveResults.error}</div>
                ) : liveResults?.length > 0 ? (
                  liveResults.map(res => (
                    <div key={res.id} onClick={() => addLiveResultToQueue(res)}
                      style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 8px', borderBottom: '1px solid #2a2a2a', cursor: 'pointer', minHeight: '64px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#222'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {res.cover_url
                        ? <img src={res.cover_url} alt="cover" style={{ width: '40px', height: '40px', objectFit: 'cover' }} />
                        : <div style={{ width: '40px', height: '40px', background: '#111', border: '1px solid #333' }} />}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ color: '#fff', fontSize: '8px', lineHeight: '1.6' }}>{res.display_title}</div>
                        <div style={{ color: 'var(--cyan)', fontSize: '7px' }}>{res.year || 'Unknown Year'}{res.genre ? ` • ${res.genre}` : ''}</div>
                      </div>
                      <button style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--cherry)', border: '1px solid var(--cherry)', fontSize: '8px', padding: '4px 8px', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace' }}>ADD</button>
                    </div>
                  ))
                ) : (
                  <div>{liveQuery.length > 2 ? 'No results found.' : 'Type at least 3 characters to search...'}</div>
                )}
              </div>
            </div>
          )}

          {/* MANUAL ENTRY MODE */}
          {mode === 'manual' && (
            <div className="manual-form">
              <div className="manual-row">
                <label>ARTIST</label>
                <input type="text" value={manual.artist} onChange={e => setManual(m => ({ ...m, artist: e.target.value }))} placeholder="Artist name" />
              </div>
              <div className="manual-row">
                <label>TITLE <span className="manual-required">*</span></label>
                <input type="text" value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} placeholder="Album title (required)" />
              </div>
              <div className="manual-row-grid">
                <div className="manual-row">
                  <label>YEAR</label>
                  <input type="number" value={manual.year} onChange={e => setManual(m => ({ ...m, year: e.target.value }))} placeholder="e.g. 1991" min="1000" max="2099" />
                </div>
                <div className="manual-row">
                  <label>STATUS</label>
                  <select value={manual.status} onChange={e => setManual(m => ({ ...m, status: e.target.value }))}>
                    <option value="unheard">UNHEARD</option>
                    <option value="heard">HEARD</option>
                    <option value="wishlist">WISHLIST</option>
                    <option value="skipped">SKIPPED</option>
                  </select>
                </div>
              </div>
              <div className="manual-row-grid">
                <div className="manual-row">
                  <label>GENRE</label>
                  <input type="text" value={manual.genre} onChange={e => setManual(m => ({ ...m, genre: e.target.value }))} placeholder="e.g. Rock" />
                </div>
                <div className="manual-row">
                  <label>FORMAT</label>
                  <input type="text" value={manual.format} onChange={e => setManual(m => ({ ...m, format: e.target.value }))} placeholder="e.g. Vinyl" />
                </div>
              </div>
              <div className="manual-row-grid">
                <div className="manual-row">
                  <label>LABEL</label>
                  <input type="text" value={manual.label} onChange={e => setManual(m => ({ ...m, label: e.target.value }))} placeholder="Record label" />
                </div>
                <div className="manual-row">
                  <label>TRACKS</label>
                  <input type="number" value={manual.track_count} onChange={e => setManual(m => ({ ...m, track_count: e.target.value }))} placeholder="e.g. 12" min="1" />
                </div>
              </div>
              <div className="manual-row">
                <label>DURATION</label>
                <input type="text" value={manual.duration} onChange={e => setManual(m => ({ ...m, duration: e.target.value }))} placeholder="e.g. 45:32 (MM:SS)" />
              </div>
              <div className="manual-row">
                <label>RATING</label>
                <div className="manual-stars">
                  {[1,2,3,4,5].map(s => (
                    <span key={s}
                      className={`manual-star ${manual.rating >= s ? 'filled' : ''}`}
                      onClick={() => setManual(m => ({ ...m, rating: m.rating === s ? null : s }))}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <div className="manual-row">
                <label>NOTES</label>
                <textarea value={manual.notes} onChange={e => setManual(m => ({ ...m, notes: e.target.value }))} placeholder="Personal notes..." rows="3" />
              </div>
              <div className="manual-row">
                <label>COVER ART</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label htmlFor="manual-cover-input" className="import-file-btn">CHOOSE IMAGE</label>
                  <input id="manual-cover-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleManualCoverUpload} />
                  {manual.cover_url && (
                    <img src={manual.cover_url} alt="preview" style={{ width: '48px', height: '48px', objectFit: 'cover', border: '1px solid #333' }} />
                  )}
                  {manual.cover_url && (
                    <button onClick={() => setManual(m => ({ ...m, cover_url: null }))} style={{ fontSize: '7px', borderColor: 'var(--red)', color: 'var(--red)' }}>REMOVE</button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                <button className="import-btn" onClick={handleManualSubmit} disabled={manualSaving}>
                  {manualSaving ? 'SAVING...' : 'ADD TO LIBRARY'}
                </button>
                {manualSaved && <span style={{ color: '#00ff66', fontSize: '8px' }}>✓ SAVED</span>}
              </div>
            </div>
          )}
        </div>

        {mode !== 'manual' && renderQueuePanel()}
      </div>
    </div>
  );
}
