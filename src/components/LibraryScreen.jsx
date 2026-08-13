// src/components/LibraryScreen.jsx
import React, { useState, useEffect } from 'react';
import './LibraryScreen.css';

export default function LibraryScreen({ albums, onSelectAlbum, viewMode, refreshAlbums }) {
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('added_desc');

  // Persist sort preference
  useEffect(() => {
    window.api.dbGetSetting('library_sort').then(v => { if (v) setSort(v); });
  }, []);
  const handleSortChange = (v) => {
    setSort(v);
    window.api.dbSetSetting({ key: 'library_sort', value: v });
  };

  // Filter — search text only; sidebar handles status/genre/decade
  let visible = albums.filter(a => {
    if (query.trim() && ![ a.title, a.artist, a.genre, String(a.year || '') ].some(f => f && f.toLowerCase().includes(query.toLowerCase()))) return false;
    return true;
  });

  // Sort
  visible = [...visible].sort((a, b) => {
    switch (sort) {
      case 'title_asc':    return (a.title || '').localeCompare(b.title || '');
      case 'title_desc':   return (b.title || '').localeCompare(a.title || '');
      case 'artist_asc':   return (a.artist || '').localeCompare(b.artist || '');
      case 'artist_desc':  return (b.artist || '').localeCompare(a.artist || '');
      case 'year_asc':     return (a.year || 0) - (b.year || 0);
      case 'year_desc':    return (b.year || 0) - (a.year || 0);
      case 'rating_desc':  return (b.rating || 0) - (a.rating || 0);
      case 'rating_asc':   return (a.rating || 0) - (b.rating || 0);
      case 'status_asc':   return (a.status || '').localeCompare(b.status || '');
      case 'added_asc':    return (a.id || 0) - (b.id || 0);
      case 'added_desc':
      default:             return (b.id || 0) - (a.id || 0);
    }
  });

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const handleShuffle = () => {
    const unheard = albums.filter(a => (a.status || 'unheard') === 'unheard');
    if (!unheard.length) return;
    const pick = unheard[Math.floor(Math.random() * unheard.length)];
    onSelectAlbum(pick);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const ok = await window.api.dialogConfirm({
      title: 'Delete Albums',
      message: `Permanently delete ${selectedIds.size} album(s)? This cannot be undone.`
    });
    if (!ok) return;
    await window.api.dbDeleteAlbums([...selectedIds]);
    setSelectedIds(new Set());
    setEditMode(false);
    if (refreshAlbums) await refreshAlbums();
  };

  const handleDeleteAll = async () => {
    const ok = await window.api.dialogConfirmTyped({
      title: 'Delete Entire Library',
      message: `Delete ALL ${albums.length} albums? This cannot be undone.`,
      requiredText: 'DELETE ALL'
    });
    if (!ok) return;
    await window.api.dbDeleteAlbums(albums.map(a => a.id));
    setSelectedIds(new Set());
    setEditMode(false);
    if (refreshAlbums) await refreshAlbums();
  };

  const formatDur = sec => sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '—';

  const renderGrid = () => (
    <div className="album-grid">
      {visible.map(album => (
        <div key={album.id} className="album-card" onClick={() => !editMode && onSelectAlbum(album)}>
          <div className="cover-wrapper" style={{ position: 'relative' }}>
            {editMode && (
              <input type="checkbox" className="card-checkbox" checked={selectedIds.has(album.id)}
                onChange={e => toggleSelect(album.id, e)} onClick={e => e.stopPropagation()} />
            )}
            <img src={album.cover_url || ''} alt={album.title} loading="lazy"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div className="no-cover" style={{ display: 'none' }}>[ NO ART ]</div>
            <span className={`status-tag ${album.status || 'unheard'}`}>{(album.status || 'unheard').toUpperCase()}</span>
          </div>
          <div className="album-meta">
            <div className="album-title">{album.title}</div>
            <div className="album-artist">{album.artist}</div>
            <div className="album-genre">{album.genre || '—'}</div>
            <div className="album-genre">
              {album.track_count ? `${album.track_count} TRK` : ''}
              {album.track_count && album.duration_sec ? ' · ' : ''}
              {album.duration_sec ? formatDur(album.duration_sec) : ''}
            </div>
          </div>
        </div>
      ))}
      {visible.length === 0 && <div className="empty-library">NO ALBUMS MATCHING FILTERS</div>}
    </div>
  );

  const renderList = () => (
    <table className="list-view">
      <thead>
        <tr>
          {editMode && <th style={{ width: 24 }}></th>}
          <th style={{ width: 40 }}>ART</th>
          <th>TITLE</th><th>ARTIST</th><th>YEAR</th><th>GENRE</th>
          <th>TRACKS</th><th>RUNTIME</th><th>FORMAT</th><th>STATUS</th><th>RATING</th>
        </tr>
      </thead>
      <tbody>
        {visible.map(album => (
          <tr key={album.id} onClick={() => !editMode && onSelectAlbum(album)}>
            {editMode && (
              <td onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selectedIds.has(album.id)} onChange={e => toggleSelect(album.id, e)} />
              </td>
            )}
            <td>
              {album.cover_url
                ? <img src={album.cover_url} alt="" className="list-thumb" onError={e => { e.target.style.display='none'; }}/>
                : <div className="list-thumb-blank"/>}
            </td>
            <td>{album.title}</td>
            <td>{album.artist || '—'}</td>
            <td>{album.year || '—'}</td>
            <td>{album.genre || '—'}</td>
            <td>{album.track_count ?? '—'}</td>
            <td>{formatDur(album.duration_sec)}</td>
            <td>{album.format || '—'}</td>
            <td><span className={`status-tag ${album.status || 'unheard'}`}>{(album.status || 'unheard').toUpperCase()}</span></td>
            <td>{album.rating ? `${album.rating}/5` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="library-content">
      {/* Main toolbar */}
      <div className="library-toolbar">
        <div className="library-search">
          <input type="text" placeholder="SEARCH ALBUMS..." value={query}
            onChange={e => setQuery(e.target.value)} className="search-input" />
        </div>
        <select value={sort} onChange={e => handleSortChange(e.target.value)} className="sort-select">
          <option value="added_desc">ADDED ↓</option>
          <option value="added_asc">ADDED ↑</option>
          <option value="title_asc">TITLE A-Z</option>
          <option value="title_desc">TITLE Z-A</option>
          <option value="artist_asc">ARTIST A-Z</option>
          <option value="artist_desc">ARTIST Z-A</option>
          <option value="year_desc">YEAR ↓</option>
          <option value="year_asc">YEAR ↑</option>
          <option value="rating_desc">RATING ↓</option>
          <option value="rating_asc">RATING ↑</option>
          <option value="status_asc">STATUS</option>
        </select>
        <button className="shuffle-btn" onClick={handleShuffle} title="Random unheard album">⟳ SHUFFLE</button>
        <button className={`edit-mode-btn ${editMode ? 'active' : ''}`}
          onClick={() => { setEditMode(e => !e); setSelectedIds(new Set()); }}>
          {editMode ? '✕ CANCEL' : '☠ EDIT'}
        </button>
      </div>

      {viewMode === 'LIST' ? renderList() : renderGrid()}

      {editMode && (
        <div className="select-fab">
          {selectedIds.size > 0 && (
            <>
              <span className="selection-count">{selectedIds.size} SELECTED</span>
              <button onClick={handleDeleteSelected}>DELETE SELECTED</button>
              <button onClick={() => setSelectedIds(new Set())}>CLEAR</button>
            </>
          )}
          {albums.length > 0 && (
            <button className="delete-all-btn" onClick={handleDeleteAll}>⚠ DELETE ALL ({albums.length})</button>
          )}
        </div>
      )}
    </div>
  );
}
