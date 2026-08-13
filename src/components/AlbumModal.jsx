// src/components/AlbumModal.jsx
import React, { useState, useEffect } from 'react';
import './AlbumModal.css';
import DatePicker from './DatePicker';

export default function AlbumModal({ album, onClose, onUpdateStatus, onUpdateRating, refreshAlbums, allAlbums }) {
  if (!album) return null;

  const [notes, setNotes] = useState(album.notes || '');
  const [dateHeard, setDateHeard] = useState(album.date_heard || '');
  const [playCount, setPlayCount] = useState(album.play_count || 0);

  useEffect(() => {
    if (window.api) {
      window.api.dbGetPlayCount(album.id).then(setPlayCount);
    }
  }, [album.id]);

  const handleNotesChange = async (e) => {
    const val = e.target.value;
    setNotes(val);
    await window.api.dbUpdateNotes({ albumId: album.id, notes: val });
  };

  const handleDateHeardChange = async (e) => {
    const val = e.target.value;
    setDateHeard(val);
    await window.api.dbUpdateDateHeard({ albumId: album.id, dateHeard: val });
  };

  const handleResetPlayCount = async () => {
    await window.api.dbResetPlayCount(album.id);
    setPlayCount(0);
  };

  const handleDelete = async () => {
    const ok = await window.api.dialogConfirm({ title: 'Delete Album', message: `Delete "${album.title}" from library? This cannot be undone.` });
    if (ok) {
      await window.api.dbDeleteAlbum(album.id);
      if (refreshAlbums) await refreshAlbums();
      onClose();
    }
  };

  const formatDuration = (sec) => {
    if (!sec) return 'N/A';
    const mins = Math.floor(sec / 60);
    const remainderSec = sec % 60;
    return `${mins}m ${remainderSec.toString().padStart(2, '0')}s`;
  };

  // Related albums by same artist
  const relatedAlbums = (allAlbums || [])
    .filter(a => a.id !== album.id && a.artist && album.artist && a.artist === album.artist)
    .slice(0, 8);

  const PLATFORM_LINKS = [
    {
      key: 'apple',
      url: `https://music.apple.com/search?term=${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Apple Music',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ),
    },
    {
      key: 'tidal',
      url: `https://listen.tidal.com/search?q=${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Tidal',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.012 3.992L8.008 7.996 4.004 3.992 0 7.996l4.004 4.004 4.004-4.004 4.004 4.004 4.004-4.004zM8.008 16.004l4.004-4.004 4.004 4.004 4.004-4.004-4.004-4.004-4.004 4.004-4.004-4.004-4.004 4.004z"/>
        </svg>
      ),
    },
    {
      key: 'deezer',
      url: `https://www.deezer.com/search/${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Deezer',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.944 18.524h2.638v1.19h-2.638zm-3.746 0H17.8v1.19h-2.602zm-3.745 0h2.601v1.19h-2.601zm-3.746 0h2.602v1.19H7.707zm-3.745 0h2.601v1.19H3.962zM18.944 16.18h2.638v1.19h-2.638zm-3.746 0H17.8v1.19h-2.602zm-3.745 0h2.601v1.19h-2.601zm-3.746 0h2.602v1.19H7.707zm-3.745 0h2.601v1.19H3.962zM18.944 13.836h2.638v1.19h-2.638zm-3.746 0H17.8v1.19h-2.602zm-3.745 0h2.601v1.19h-2.601zm-3.746 0h2.602v1.19H7.707zM18.944 11.491h2.638v1.19h-2.638zm-3.746 0H17.8v1.19h-2.602zm-3.745 0h2.601v1.19h-2.601zM18.944 9.147h2.638v1.19h-2.638zm-3.746 0H17.8v1.19h-2.602zM18.944 6.803h2.638v1.19h-2.638z"/>
        </svg>
      ),
    },
    {
      key: 'qobuz',
      url: `https://www.qobuz.com/search?q=${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Qobuz',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <text x="2" y="18" fontSize="14" fontFamily="serif" fill="#fff">Q</text>
        </svg>
      ),
    },
    {
      key: 'amazon',
      url: `https://music.amazon.com/search/${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Amazon Music',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.047-.869-1.233-1.272-1.814-2.101-1.733 1.768-2.959 2.297-5.207 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.095V6.43c0-.753.06-1.642-.383-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.661C5.751 2.238 8.847.9 11.654.9c1.435 0 3.311.383 4.443 1.467 1.435 1.342 1.298 3.134 1.298 5.085v4.607c0 1.386.576 1.995 1.118 2.742.19.266.233.584-.01.783l-1.359 1.211zm3.206 2.631C18.614 22.648 15.344 24 12.49 24c-4.045 0-7.686-1.496-10.437-3.985-.216-.195-.023-.462.236-.31 2.971 1.727 6.648 2.764 10.444 2.764 2.56 0 5.373-.529 7.962-1.629.39-.167.717.255.655.586zm.95-1.078c-.295-.38-1.955-.18-2.701-.091-.227.028-.262-.17-.057-.313 1.321-.928 3.489-.661 3.742-.35.253.313-.066 2.486-1.308 3.52-.191.16-.373.075-.288-.136.28-.697.907-2.254.612-2.63z"/>
        </svg>
      ),
    },
    {
      key: 'spotify',
      url: `https://open.spotify.com/search/${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Spotify',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      ),
    },
    {
      key: 'wikipedia',
      url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'Wikipedia',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.994-1.127.994l-3.261-8.307s-.353-.314-.653-.42c-.3-.12-.729-.173-.729-.173v-.48h3.508v.48s-.498.045-.724.183c-.226.138-.256.453-.256.453l2.112 5.573 1.713-3.455-1.014-2.609c-.27-.609-.344-.706-.564-.773-.22-.08-.621-.088-.621-.088v-.48h3.264v.48s-.442.046-.655.174c-.214.128-.257.45-.257.45l1.765 4.773 1.847-4.772c-.27-.607-.334-.705-.554-.773-.22-.08-.62-.088-.62-.088v-.48h3.264v.48s-.442.046-.655.174c-.214.128-.258.45-.258.45L12.09 13.12zM19.41 5H4.59A1.59 1.59 0 0 0 3 6.59v10.82A1.59 1.59 0 0 0 4.59 19h14.82A1.59 1.59 0 0 0 21 17.41V6.59A1.59 1.59 0 0 0 19.41 5z"/>
        </svg>
      ),
    },
    {
      key: 'allmusic',
      url: `https://www.allmusic.com/search/albums/${encodeURIComponent((album.artist||'')+' '+album.title)}`,
      label: 'AllMusic',
      logo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
          <text x="2" y="17" fontSize="11" fontFamily="'Press Start 2P', monospace" fill="#fff">AM</text>
        </svg>
      ),
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>×</button>

        <div className="modal-header">
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.title} className="modal-cover" />
          ) : (
            <div className="modal-cover-placeholder">NO COVER</div>
          )}
          <div className="modal-header-info">
            <h2>{album.title}</h2>
            <h3>{album.artist}</h3>
            <p className="modal-subheading">
              {album.year || '----'} • {album.genre || 'UNKNOWN'} {album.subgenre ? `(${album.subgenre})` : ''}
            </p>
          </div>
        </div>

        <div className="modal-section">
          <label className="section-label">STATUS</label>
          <div className="status-toggles">
            {['unheard', 'heard', 'skipped', 'wishlist'].map((st) => (
              <button key={st} className={`status-btn ${album.status === st ? `active ${st}` : ''}`}
                onClick={() => onUpdateStatus(st)}>
                {st === 'wishlist' ? 'WANT LIST' : st.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section-grid">
          <div className="modal-section">
            <label className="section-label">RATING</label>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span key={star} className={`star ${album.rating >= star ? 'filled' : ''}`}
                  onClick={() => onUpdateRating(album.rating === star ? null : star)}>★</span>
              ))}
            </div>
          </div>

          <div className="modal-section">
            <label className="section-label">DATE HEARD</label>
            <DatePicker value={dateHeard || ''} onChange={(iso) => {
              setDateHeard(iso);
              window.api.dbUpdateDateHeard({ albumId: album.id, dateHeard: iso });
            }} />
          </div>
        </div>

        <div className="modal-section">
          <label className="section-label">NOTES</label>
          <textarea value={notes || ''} onChange={handleNotesChange}
            placeholder="Add personal notes or review..." rows="3" className="modal-notes-input" />
        </div>

        <div className="modal-section about-section">
          <h3 className="about-header">ABOUT</h3>
          <div className="about-details-list">
            {album.is_classical ? (
              <>
                {album.composer && <div className="about-row"><span>Composer</span><strong>{album.composer}</strong></div>}
                {album.conductor && <div className="about-row"><span>Conductor</span><strong>{album.conductor}</strong></div>}
                {album.orchestra && <div className="about-row"><span>Orchestra</span><strong>{album.orchestra}</strong></div>}
                {album.period && <div className="about-row"><span>Period</span><strong>{album.period}</strong></div>}
                {album.catalogue_no && <div className="about-row"><span>Catalogue No</span><strong>{album.catalogue_no}</strong></div>}
              </>
            ) : null}
            {album.format && <div className="about-row"><span>FORMAT</span><strong>{album.format}</strong></div>}
            {album.label && <div className="about-row"><span>LABEL</span><strong>{album.label}</strong></div>}
            {album.country_code && <div className="about-row"><span>COUNTRY</span><strong>{album.country_code}</strong></div>}
            {album.track_count && <div className="about-row"><span>TRACKS</span><strong>{album.track_count}</strong></div>}
            {album.duration_sec && <div className="about-row"><span>RUNTIME</span><strong>{formatDuration(album.duration_sec)}</strong></div>}
            {album.added_at && <div className="about-row"><span>ADDED</span><strong>{album.added_at.slice(0, 10)}</strong></div>}
            <div className="about-row play-count-row">
              <span>PLAY COUNT</span>
              <strong className="play-count-val">
                {playCount}
                <button className="play-count-increment" onClick={async () => {
                  await window.api.dbIncrementPlayCount(album.id);
                  setPlayCount(p => p + 1);
                }}>+1</button>
                <button className="play-count-reset" onClick={handleResetPlayCount}>RESET</button>
              </strong>
            </div>
          </div>
        </div>

        <div className="modal-section ext-links-section">
          <label className="section-label">LISTEN ON</label>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
            {PLATFORM_LINKS.map(platform => (
              <button key={platform.key} onClick={() => window.api.openExternal(platform.url)}
                title={platform.label}
                style={{ background: 'transparent', border: '1px solid #333', padding: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#333'}>
                {platform.logo}
              </button>
            ))}
          </div>
        </div>

        {relatedAlbums.length > 0 && (
          <div className="modal-section">
            <label className="section-label">MORE BY {(album.artist || '').toUpperCase()}</label>
            <div className="related-albums-strip">
              {relatedAlbums.map(a => (
                <div key={a.id} className="related-album-thumb" title={a.title}>
                  {a.cover_url
                    ? <img src={a.cover_url} alt={a.title} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                    : null}
                  <div className="related-no-cover" style={{ display: a.cover_url ? 'none' : 'flex' }}>NO ART</div>
                  <div className="related-album-title">{a.title}</div>
                  <div className="related-album-year">{a.year || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="delete-btn" onClick={handleDelete}>DELETE ALBUM</button>
        </div>
      </div>
    </div>
  );
}
