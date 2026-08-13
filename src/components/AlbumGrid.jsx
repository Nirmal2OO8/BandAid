import React from 'react';
import AlbumCard from './AlbumCard';

export default function AlbumGrid({ albums, onSelect, viewMode, columns = 4 }) {
  if (!albums.length) {
    return (
      <div style={{ padding: '40px', color: '#333', fontSize: '10px', textAlign: 'center' }}>
        NO ALBUMS YET — HIT IMPORT TO ADD SOME
      </div>
    );
  }

  if (viewMode === 'LIST') {
    return (
      <table className="list-view">
        <thead>
          <tr>
            <th>ARTIST</th><th>TITLE</th><th>YEAR</th>
            <th>GENRE</th><th>STATUS</th><th>RATING</th>
          </tr>
        </thead>
        <tbody>
          {albums.map(a => (
            <tr key={a.id} onClick={() => onSelect(a)}>
              <td>{a.artist}</td>
              <td>{a.title}</td>
              <td>{a.year}</td>
              <td>{a.genre}</td>
              <td>{(a.status || 'unheard').toUpperCase()}</td>
              <td>{a.rating ? `${a.rating}/5` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="album-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {albums.map(a => <AlbumCard key={a.id} album={a} onClick={() => onSelect(a)} />)}
    </div>
  );
}
