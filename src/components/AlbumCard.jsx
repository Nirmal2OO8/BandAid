import React from 'react';

const STATUS_COLORS = { heard: 'heard', unheard: 'unheard', skipped: 'skipped', wishlist: 'wishlist' };

export default function AlbumCard({ album, onClick }) {
  return (
    <div className="album-card" onClick={onClick}>
      <img
        src={album.cover_url || ''}
        alt={album.title}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      <div className="no-cover-fallback">
        {(album.artist || album.title || '??').slice(0, 2).toUpperCase()}
      </div>
      <div className={`status-dot ${STATUS_COLORS[album.status] || 'unheard'}`} />
      <div className="album-card-info">
        <div className="album-card-title">{album.title}</div>
        <div className="album-card-artist">{album.artist} {album.year ? `(${album.year})` : ''}</div>
      </div>
    </div>
  );
}
