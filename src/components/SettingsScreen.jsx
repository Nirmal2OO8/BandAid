import React, { useEffect, useState } from 'react';
import './SettingsScreen.css';

const PRESET_REGIONS = [
  { name: 'South Asia', codes: 'IN,PK,BD,LK,NP' },
  { name: 'Southeast Asia', codes: 'TH,VN,ID,MY,PH,SG,MM,KH,LA' },
  { name: 'Middle East', codes: 'SA,AE,IR,IQ,IL,TR,EG,JO,LB' },
  { name: 'West Africa', codes: 'NG,GH,SN,ML,CI' },
  { name: 'East Africa', codes: 'ET,KE,TZ,UG,RW' },
  { name: 'North Africa', codes: 'MA,DZ,TN,LY' },
  { name: 'Scandinavia', codes: 'SE,NO,DK,FI,IS' },
  { name: 'East Asia', codes: 'CN,JP,KR,TW,HK,MO' },
  { name: 'Latin America', codes: 'MX,BR,AR,CO,CL,PE,VE,GT,CU' },
  { name: 'Caribbean', codes: 'JM,TT,DO,HT' },
  { name: 'Eastern Europe', codes: 'RU,PL,CZ,SK,HU,RO,BG,UA,BY,RS' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function SettingsScreen({ settings, setSettings, albums, onThemeChange, onFontSizeChange }) {
  const [blocked, setBlocked] = useState([]);
  const [discogsToken, setDiscogsToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [theme, setTheme] = useState('red');
  const [fontSize, setFontSize] = useState('8');
  const [autoBackup, setAutoBackup] = useState(false);
  const [backupDir, setBackupDir] = useState('');

  useEffect(() => {
    window.api.dbGetBlockedRegions().then(setBlocked);
    window.api.dbGetSetting('discogs_token').then(token => {
      if (token) setDiscogsToken('••••••••');
    });
    window.api.dbGetSetting('theme').then(t => { if (t) setTheme(t); });
    window.api.dbGetSetting('font_size').then(s => { if (s) setFontSize(s); });
    window.api.dbGetSetting('auto_backup').then(v => { if (v) setAutoBackup(v === 'true'); });
    window.api.dbGetSetting('backup_dir').then(d => { if (d) setBackupDir(d); });
  }, []);

  const handleThemeChange = async (t) => {
    setTheme(t);
    await window.api.dbSetSetting({ key: 'theme', value: t });
    if (onThemeChange) onThemeChange(t);
  };

  const handleFontSizeChange = async (s) => {
    setFontSize(s);
    await window.api.dbSetSetting({ key: 'font_size', value: s });
    if (onFontSizeChange) onFontSizeChange(s);
  };

  const handleAutoBackupToggle = async () => {
    const next = !autoBackup;
    setAutoBackup(next);
    await window.api.dbSetSetting({ key: 'auto_backup', value: next ? 'true' : 'false' });
  };

  const handleChooseBackupDir = async () => {
    const dir = await window.api.chooseBackupDir();
    if (dir) setBackupDir(dir);
  };

  const addRegion = async (e) => {
    const name = e.target.value;
    if (!name) return;
    const r = PRESET_REGIONS.find(x => x.name === name);
    if (r) {
      await window.api.dbAddBlockedRegion({ regionName: r.name, countryCodes: r.codes });
      window.api.dbGetBlockedRegions().then(setBlocked);
    }
    e.target.value = '';
  };

  const removeRegion = async (name) => {
    await window.api.dbRemoveBlockedRegion(name);
    window.api.dbGetBlockedRegions().then(setBlocked);
  };

  const handleSaveDiscogsToken = async () => {
    if (discogsToken && discogsToken !== '••••••••') {
      await window.api.dbSetSetting({ key: 'discogs_token', value: discogsToken });
      setDiscogsToken('••••••••');
      setTokenSaved(true);
      setTimeout(() => setTokenSaved(false), 2000);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.bandaid_export) {
          await window.api.dbRestoreAlbums(json.albums);
          alert('Full Library Restored!');
        } else if (json.bandaid_progress_export) {
          await window.api.dbRestoreProgress(json.entries);
          alert('Progress Restored!');
        } else {
          alert('Invalid file format');
        }
      } catch (err) {
        alert('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
  };

  const exportFullJSON = () => {
    const exportData = {
      bandaid_export: true, version: 1, exported_at: new Date().toISOString(),
      album_count: albums.length, albums
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bandaid_library_${todayStr()}.json`; a.click();
  };

  const exportFullCSV = () => {
    if (!albums.length) return;
    const cols = ['id', 'title', 'artist', 'year', 'genre', 'subgenre', 'mbid', 'country_code', 'track_count', 'duration_sec', 'status', 'rating', 'notes', 'date_heard', 'cover_url'];
    const headers = cols.join(',');
    const rows = albums.map(a => cols.map(c => `"${(a[c]||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bandaid_library_${todayStr()}.csv`; a.click();
  };

  const exportProgressJSON = () => {
    const filtered = albums.filter(a => (a.status && a.status !== 'unheard') || a.rating != null || (a.notes && a.notes.trim() !== ''));
    const exportData = {
      bandaid_progress_export: true, version: 1, exported_at: new Date().toISOString(),
      entries: filtered.map(a => ({ mbid: a.mbid, title: a.title, artist: a.artist, status: a.status, rating: a.rating, notes: a.notes, date_heard: a.date_heard }))
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bandaid_progress_${todayStr()}.json`; a.click();
  };

  const exportProgressCSV = () => {
    const filtered = albums.filter(a => (a.status && a.status !== 'unheard') || a.rating != null || (a.notes && a.notes.trim() !== ''));
    if (!filtered.length) return;
    const cols = ['mbid', 'title', 'artist', 'status', 'rating', 'notes', 'date_heard'];
    const headers = cols.join(',');
    const rows = filtered.map(a => cols.map(c => `"${(a[c]||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bandaid_progress_${todayStr()}.csv`; a.click();
  };

  return (
    <div className="settings-screen">
      <div className="settings-section">
        <h3>THEME</h3>
        <div className="set-row">
          <button
            className={`theme-btn ${theme === 'red' ? 'active' : ''}`}
            onClick={() => handleThemeChange('red')}>
            DARK RED (DEFAULT)
          </button>
          <button
            className={`theme-btn ${theme === 'blue' ? 'active' : ''}`}
            onClick={() => handleThemeChange('blue')}>
            DARK BLUE
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>FONT SIZE</h3>
        <div className="set-row">
          <select value={fontSize} onChange={e => handleFontSizeChange(e.target.value)}>
            <option value="8">SMALL (8px)</option>
            <option value="10">NORMAL (10px)</option>
            <option value="12">LARGE (12px)</option>
          </select>
        </div>
        <div className="helper-text">AFFECTS GLOBAL TEXT SIZE — DEFAULT IS 8PX</div>
      </div>

      <div className="settings-section">
        <h3>AUTO-BACKUP ON CLOSE</h3>
        <div className="set-row">
          <label className="toggle-label">
            <input type="checkbox" checked={autoBackup} onChange={handleAutoBackupToggle} />
            AUTO-BACKUP ON CLOSE
          </label>
        </div>
        <div className="helper-text">SAVES A JSON BACKUP TO YOUR BACKUP FOLDER ON EVERY CLOSE</div>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleChooseBackupDir}>CHOOSE BACKUP FOLDER</button>
          {backupDir && <span className="backup-dir-display">{backupDir}</span>}
        </div>
        {!backupDir && <div className="helper-text" style={{ marginTop: '4px' }}>DEFAULT: DOWNLOADS FOLDER</div>}
      </div>

      <div className="settings-section">
        <h3>LIBRARY GRID COLUMNS</h3>
        <div className="helper-text" style={{ marginBottom: '12px' }}>CONTROLS HOW MANY ALBUMS APPEAR PER ROW IN GRID VIEW</div>
        <div className="set-row">
          <select value={settings.columns} onChange={e => setSettings({...settings, columns: parseInt(e.target.value)})}>
            <option>3</option><option>4</option><option>5</option><option>6</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h3>REGION FILTERS</h3>
        <select onChange={addRegion}><option value="">+ ADD REGION BLOCK</option>{PRESET_REGIONS.map(r => <option key={r.name}>{r.name}</option>)}</select>
        <div className="blocked-list">
          {blocked.map(b => (
            <div key={b.region_name} className="blocked-item">
              {b.region_name} <button onClick={() => removeRegion(b.region_name)}>X</button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>API KEYS</h3>
        <label>DISCOGS PERSONAL ACCESS TOKEN</label>
        <div className="helper-text">GET YOUR TOKEN AT discogs.com/settings/developers</div>
        <div className="api-key-row">
          <input
            type="password"
            placeholder="PASTE TOKEN HERE"
            value={discogsToken}
            onChange={e => setDiscogsToken(e.target.value)}
          />
          <button onClick={handleSaveDiscogsToken}>SAVE</button>
          {tokenSaved && <span style={{ color: '#00ff66', fontSize: '8px', alignSelf: 'center', marginLeft: '8px' }}>TOKEN SAVED</span>}
        </div>
      </div>

      <div className="settings-section">
        <h3>IMPORT / RESTORE</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <label
            htmlFor="settings-file-input"
            style={{
              border: '1px solid var(--cherry)', color: 'var(--cherry)', fontSize: '8px',
              padding: '8px 16px', cursor: 'pointer', fontFamily: '"Press Start 2P", monospace',
              background: 'transparent', display: 'inline-block',
            }}
          >
            CHOOSE FILE
          </label>
          <input
            id="settings-file-input"
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
        <div className="helper-text">SELECT A PREVIOUSLY EXPORTED JSON FILE</div>
      </div>

      <div className="settings-section">
        <h3>EXPORT</h3>
        <div className="export-grid">
          <button onClick={exportFullJSON}>FULL LIBRARY (JSON)</button>
          <button onClick={exportFullCSV}>FULL LIBRARY (CSV)</button>
          <button onClick={exportProgressJSON}>PROGRESS ONLY (JSON)</button>
          <button onClick={exportProgressCSV}>PROGRESS ONLY (CSV)</button>
        </div>
        <div className="helper-text">EXPORTS ARE SAVED TO YOUR DOWNLOADS FOLDER</div>
      </div>

      <div className="settings-section">
        <h3>SHORTCUTS</h3>
        <div className="shortcuts">
          <div>/ = SEARCH</div><div>ESC = CLOSE</div><div>H/U/S/W = STATUS</div>
          <div>1-5 = RATE</div><div>TOOLBAR = GRID/LIST</div>
        </div>
      </div>
    </div>
  );
}
