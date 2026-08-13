// src/components/StatsScreen.jsx
import React, { useEffect, useState } from 'react';
import './StatsScreen.css';

function ListeningHeatmap({ heardByDate }) {
  const WEEKS = 52;
  const DAYS = 7;
  const CELL = 11;
  const GAP = 2;
  const totalWidth = WEEKS * (CELL + GAP);
  const totalHeight = DAYS * (CELL + GAP);

  const dateMap = {};
  (heardByDate || []).forEach(r => { dateMap[r.date] = r.count; });

  // Build grid: last 52 weeks ending today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDow = today.getDay(); // 0=Sun
  // Back up to the Sunday 52 weeks ago
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - (WEEKS * 7 - 1) - startDow + today.getDay());

  const cells = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      const iso = date.toISOString().slice(0, 10);
      const count = dateMap[iso] || 0;
      let fill = '#111';
      if (count === 1) fill = 'rgba(204,0,34,0.3)';
      else if (count === 2) fill = 'rgba(204,0,34,0.6)';
      else if (count >= 3) fill = 'var(--cherry)';
      cells.push({ x: w * (CELL + GAP), y: d * (CELL + GAP), fill, iso, count });
    }
  }

  const [tooltip, setTooltip] = useState(null);

  return (
    <div className="chart heatmap-chart">
      <h3>LISTENING HEATMAP</h3>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg width={totalWidth} height={totalHeight} style={{ display: 'block' }}>
          {cells.map((c, i) => (
            <rect
              key={i}
              x={c.x} y={c.y}
              width={CELL} height={CELL}
              fill={c.fill}
              onMouseEnter={e => setTooltip({ x: c.x, y: c.y, iso: c.iso, count: c.count })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </svg>
        {tooltip && (
          <div className="heatmap-tooltip" style={{ left: tooltip.x + CELL + 4, top: tooltip.y }}>
            {tooltip.iso}: {tooltip.count} album{tooltip.count !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <div className="heatmap-legend">
        <span style={{ color: '#555' }}>NONE</span>
        <div className="legend-cell" style={{ background: 'rgba(204,0,34,0.3)' }}/>
        <div className="legend-cell" style={{ background: 'rgba(204,0,34,0.6)' }}/>
        <div className="legend-cell" style={{ background: 'var(--cherry)' }}/>
        <span style={{ color: '#ccc' }}>3+</span>
      </div>
    </div>
  );
}

function GenreChart({ genres, total }) {
  const [mode, setMode] = useState('bar');

  const sorted = [...(genres || [])].sort((a, b) => b.count - a.count).slice(0, 10);
  const max = sorted[0]?.count || 1;

  const renderBar = () => (
    <div>
      {sorted.map(g => (
        <div key={g.genre} className="bar-row">
          <span className="bar-lbl">{g.genre || 'Unknown'}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${total > 0 ? (g.count/total)*100 : 0}%` }}/></div>
          <span className="bar-val">{g.count}</span>
        </div>
      ))}
    </div>
  );

  const renderDonut = () => {
    const SIZE = 180;
    const R = 70;
    const CX = SIZE / 2;
    const CY = SIZE / 2;
    const totalCount = sorted.reduce((s, g) => s + g.count, 0) || 1;

    const COLORS = [
      'var(--cherry)', 'var(--cyan)', '#cc6600', '#009955', '#6600cc',
      '#cc0066', '#0066cc', '#999900', '#cc3300', '#006699'
    ];

    let angle = -Math.PI / 2;
    const arcs = sorted.map((g, i) => {
      const slice = (g.count / totalCount) * 2 * Math.PI;
      const x1 = CX + R * Math.cos(angle);
      const y1 = CY + R * Math.sin(angle);
      angle += slice;
      const x2 = CX + R * Math.cos(angle);
      const y2 = CY + R * Math.sin(angle);
      const large = slice > Math.PI ? 1 : 0;
      const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
      return { path, color: COLORS[i % COLORS.length], genre: g.genre || 'Unknown', count: g.count };
    });

    return (
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <svg width={SIZE} height={SIZE} style={{ flexShrink: 0 }}>
          {arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill={arc.color} stroke="var(--bg)" strokeWidth="2"/>
          ))}
          <circle cx={CX} cy={CY} r={R * 0.5} fill="var(--bg)"/>
        </svg>
        <div className="donut-legend">
          {arcs.map((arc, i) => (
            <div key={i} className="donut-legend-row">
              <div className="donut-swatch" style={{ background: arc.color }}/>
              <span>{arc.genre}</span>
              <span className="bar-val">{arc.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="chart">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>GENRES</h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className={`chart-toggle-btn ${mode === 'bar' ? 'active' : ''}`} onClick={() => setMode('bar')}>BAR</button>
          <button className={`chart-toggle-btn ${mode === 'donut' ? 'active' : ''}`} onClick={() => setMode('donut')}>DONUT</button>
        </div>
      </div>
      {mode === 'bar' ? renderBar() : renderDonut()}
    </div>
  );
}

export default function StatsScreen() {
  const [stats, setStats] = useState(null);

  useEffect(() => { window.api.dbGetStats().then(setStats); }, []);
  if (!stats) return <div>LOADING...</div>;

  const pct = stats.total === 0 ? 0 : Math.round((stats.heard / stats.total) * 100);

  const formatRuntime = (sec) => {
    if (!sec) return '0M';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    let str = '';
    if (d > 0) str += `${d}D `;
    if (h > 0) str += `${h}H `;
    str += `${m}M`;
    return str;
  };

  const formatRuntimeVerbose = (sec) => {
    if (!sec) return '0 minutes';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
    if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
    if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
    return parts.join(', ');
  };

  // D5 — find max listened month
  const maxMonthCount = Math.max(...(stats.listenedByMonth?.map(r => r.count) || [1]), 1);
  const maxMonthEntry = stats.listenedByMonth?.find(r => r.count === maxMonthCount);

  return (
    <div className="stats-screen">
      <h2>STATISTICS</h2>
      <div className="stat-hero">
        <div>TOTAL: {stats.total}</div>
        <div style={{ color: 'var(--accent)' }}>HEARD: {pct}%</div>
        <div title={formatRuntimeVerbose(stats.totalDurationSec)}>
          RUNTIME: {formatRuntime(stats.totalDurationSec)}
        </div>
      </div>

      {/* D1 — Listening heatmap */}
      <ListeningHeatmap heardByDate={stats.heardByDate} />

      <div className="charts-grid">
        <div className="chart">
          <h3>TOP ARTISTS</h3>
          {stats.topArtists?.sort((a,b) => b.count - a.count).slice(0,10).map(a => {
            const max = stats.topArtists[0]?.count || 1;
            return (
              <div key={a.artist} className="bar-row">
                <span className="bar-lbl">{a.artist || 'Unknown'}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(a.count/max)*100}%` }}/></div>
                <span className="bar-val">{a.count}</span>
              </div>
            );
          })}
        </div>

        <div className="chart">
          <h3>RATINGS</h3>
          {[1,2,3,4,5].map(star => {
            const entry = stats.ratingDist?.find(r => r.rating === star);
            const count = entry?.count || 0;
            const max = Math.max(...(stats.ratingDist?.map(r => r.count) || [1]), 1);
            return (
              <div key={star} className="bar-row">
                <span className="bar-lbl">{'★'.repeat(star)}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(count/max)*100}%` }}/></div>
                <span className="bar-val">{count}</span>
              </div>
            );
          })}
        </div>

        {/* D3 — Genre chart with donut toggle */}
        <GenreChart genres={stats.genres} total={stats.total} />

        <div className="chart">
          <h3>ALBUMS BY DECADE</h3>
          {stats.decades.sort((a,b) => a.decade - b.decade).map(d => {
            const max = Math.max(...stats.decades.map(x => x.count), 1);
            return (
              <div key={d.decade} className="bar-row">
                <span className="bar-lbl">{d.decade}s</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.count/max)*100}%` }}/></div>
                <span className="bar-val">{d.count}</span>
              </div>
            );
          })}
        </div>

        <div className="chart">
          <h3>FORMATS</h3>
          {stats.formats?.sort((a,b) => b.count - a.count).map(f => {
            const max = stats.formats[0]?.count || 1;
            return (
              <div key={f.format} className="bar-row">
                <span className="bar-lbl">{f.format || 'Unknown'}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(f.count/max)*100}%` }}/></div>
                <span className="bar-val">{f.count}</span>
              </div>
            );
          })}
        </div>

        {/* D5 — LISTENED BY MONTH with max highlighted */}
        <div className="chart">
          <h3>LISTENED BY MONTH</h3>
          {stats.listenedByMonth?.slice(-12).map(m => {
            const isMax = m.month === maxMonthEntry?.month;
            return (
              <div key={m.month} className="bar-row">
                <span className="bar-lbl">{isMax ? `★ ${m.month}` : (m.month || 'Unknown')}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(m.count/maxMonthCount)*100}%`, background: isMax ? 'var(--cyan)' : 'var(--accent)' }}/>
                </div>
                <span className="bar-val">{m.count}</span>
              </div>
            );
          })}
        </div>

        {/* D6 — Avg rating by genre */}
        {stats.avgRatingByGenre && stats.avgRatingByGenre.length > 0 && (
          <div className="chart">
            <h3>AVG RATING BY GENRE</h3>
            {stats.avgRatingByGenre.slice(0, 10).map(g => (
              <div key={g.genre} className="bar-row">
                <span className="bar-lbl">{g.genre || 'Unknown'}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(g.avg/5)*100}%` }}/></div>
                <span className="bar-val">{Number(g.avg).toFixed(1)}★</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
