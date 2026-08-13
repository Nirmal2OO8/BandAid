import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import LibraryScreen from './components/LibraryScreen';
import AlbumModal from './components/AlbumModal';
import ImportScreen from './components/ImportScreen';
import StatsScreen from './components/StatsScreen';
import SettingsScreen from './components/SettingsScreen';
import AboutScreen from './components/AboutScreen';

// Apply theme immediately to <html> so it survives React re-renders and Ctrl+R
function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.remove('theme-blue');
  if (theme === 'blue') html.classList.add('theme-blue');
}

function applyFontSize(size) {
  if (!size) return;
  document.documentElement.style.setProperty('--base-font', size + 'px');
  // Also set actual root font-size for rem-based and px-based rules
  document.documentElement.style.fontSize = size + 'px';
}

export default function App() {
  const [albums, setAlbums] = useState([]);
  const [filters, setFilters] = useState({ statuses: [], genres: [], subgenres: [], decades: [] });
  const [viewMode, setViewMode] = useState('GRID');
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [view, setView] = useState('library');
  const [settings, setSettings] = useState({ columns: 4 });

  const loadAlbums = async () => {
    if (!window.api) return;
    const data = await window.api.dbGetAllAlbums();
    setAlbums(data);
  };

  // Bug 2: Subscribe to queue progress and reload albums when queue updates
  useEffect(() => {
    if (!window.api) return;
    const unsub = window.api.onQueueProgress(() => {
      loadAlbums();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    loadAlbums();
    if (!window.api) return;

    // Load and apply saved view
    window.api.dbGetSetting('active_view').then(v => {
      if (v && ['library','import','stats','settings','about'].includes(v)) setView(v);
    });

    // Load and apply theme — applied to <html> so it persists across re-renders
    window.api.dbGetSetting('theme').then(theme => {
      applyTheme(theme || 'red');
    });

    // Load and apply font size
    window.api.dbGetSetting('font_size').then(size => {
      applyFontSize(size || '8');
    });
  }, []);

  // Persist active view to DB whenever it changes
  const handleSetView = (v) => {
    setView(v);
    window.api?.dbSetSetting({ key: 'active_view', value: v });
  };

  const updateAlbumStatus = async (id, status) => {
    await window.api.dbUpdateStatus({ albumId: id, status });
    if (selectedAlbum?.id === id) setSelectedAlbum(p => ({ ...p, status }));
    loadAlbums();
  };

  const updateAlbumRating = async (id, rating) => {
    await window.api.dbUpdateRating({ albumId: id, rating });
    if (selectedAlbum?.id === id) setSelectedAlbum(p => ({ ...p, rating }));
    loadAlbums();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setSelectedAlbum(null); }
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (selectedAlbum) {
        if (e.key === 'h' || e.key === 'H') updateAlbumStatus(selectedAlbum.id, 'heard');
        if (e.key === 'u' || e.key === 'U') updateAlbumStatus(selectedAlbum.id, 'unheard');
        if (e.key === 's' || e.key === 'S') updateAlbumStatus(selectedAlbum.id, 'skipped');
        if (e.key === 'w' || e.key === 'W') updateAlbumStatus(selectedAlbum.id, 'wishlist');
        if (['1','2','3','4','5'].includes(e.key)) updateAlbumRating(selectedAlbum.id, parseInt(e.key));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedAlbum]);

  const filtered = albums.filter(a => {
    if (filters.statuses.length && !filters.statuses.includes(a.status)) return false;
    if (filters.genres.length && !filters.genres.includes(a.genre)) return false;
    if (filters.subgenres.length && !filters.subgenres.includes(a.subgenre)) return false;
    if (filters.decades.length && !filters.decades.includes(Math.floor((a.year || 0) / 10) * 10)) return false;
    return true;
  });

  const renderMain = () => {
    switch (view) {
      case 'import': return <ImportScreen onClose={() => { handleSetView('library'); loadAlbums(); }} onGoToSettings={() => handleSetView('settings')} />;
      case 'stats': return <StatsScreen />;
      case 'settings': return <SettingsScreen settings={settings} setSettings={setSettings} albums={albums} onThemeChange={applyTheme} onFontSizeChange={applyFontSize} />;
      case 'about': return <AboutScreen />;
      default: return (
        <div className="library-layout">
          <Sidebar filters={filters} setFilters={setFilters} albumCount={albums.length} />
          <div className="grid-area">
            <div className="view-toolbar">
              <span className="view-mode-label">VIEW:</span>
              <button className={`view-btn ${viewMode === 'GRID' ? 'active' : ''}`} onClick={() => setViewMode('GRID')}>GRID</button>
              <button className={`view-btn ${viewMode === 'LIST' ? 'active' : ''}`} onClick={() => setViewMode('LIST')}>LIST</button>
            </div>
            <LibraryScreen albums={filtered} onSelectAlbum={setSelectedAlbum} viewMode={viewMode} refreshAlbums={loadAlbums} />
          </div>
        </div>
      );
    }
  };

  return (
    <div className="app-root">
      <TitleBar setView={handleSetView} currentView={view} />
      <div className="app-body">
        {renderMain()}
      </div>
      {selectedAlbum && (
        <AlbumModal
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          onUpdateStatus={(s) => updateAlbumStatus(selectedAlbum.id, s)}
          onUpdateRating={(r) => updateAlbumRating(selectedAlbum.id, r)}
          refreshAlbums={loadAlbums}
          allAlbums={albums}
        />
      )}
    </div>
  );
}
