import React, { useState, useEffect } from 'react';

const STATUSES = ['unheard', 'heard', 'skipped', 'wishlist'];

export default function Sidebar({ filters, setFilters, albumCount }) {
  const [genresData, setGenresData] = useState([]);
  const [decades, setDecades] = useState([]);

  useEffect(() => {
    if (!window.api) return;
    window.api.dbGetGenres().then(setGenresData).catch(() => {});
    window.api.dbGetDecades().then(setDecades).catch(() => {});
  }, [albumCount]);

  const genreTree = genresData.reduce((acc, row) => {
    if (!row.genre) return acc;
    if (!acc[row.genre]) acc[row.genre] = [];
    if (row.subgenre && !acc[row.genre].includes(row.subgenre)) acc[row.genre].push(row.subgenre);
    return acc;
  }, {});

  const toggle = (type, val) => setFilters(prev => {
    const cur = prev[type] || [];
    return { ...prev, [type]: cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val] };
  });

  return (
    <div className="sidebar">
      <div className="filter-group">
        <h3>Status</h3>
        {STATUSES.map(s => (
          <label key={s}>
            <input type="checkbox" checked={filters.statuses.includes(s)} onChange={() => toggle('statuses', s)} />
            {s.toUpperCase()}
          </label>
        ))}
      </div>

      {decades.length > 0 && (
        <div className="filter-group">
          <h3>Decade</h3>
          {decades.map(d => (
            <label key={d}>
              <input type="checkbox" checked={filters.decades.includes(d)} onChange={() => toggle('decades', d)} />
              {d}s
            </label>
          ))}
        </div>
      )}

      {Object.keys(genreTree).length > 0 && (
        <div className="filter-group">
          <h3>Genre</h3>
          {Object.keys(genreTree).sort().map(g => (
            <div key={g}>
              <label>
                <input type="checkbox" checked={filters.genres.includes(g)} onChange={() => toggle('genres', g)} />
                {g}
              </label>
              {genreTree[g].length > 0 && (
                <div className="subgenre-group">
                  {genreTree[g].sort().map(sg => (
                    <label key={sg}>
                      <input type="checkbox" checked={filters.subgenres.includes(sg)} onChange={() => toggle('subgenres', sg)} />
                      {sg}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        style={{ marginTop: 'auto', width: '100%', borderColor: 'var(--red)', color: 'var(--red)' }}
        onClick={() => setFilters({ statuses: [], genres: [], subgenres: [], decades: [] })}
      >
        CLEAR ALL FILTERS
      </button>
    </div>
  );
}