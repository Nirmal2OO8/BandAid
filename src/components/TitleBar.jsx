import React from 'react';
import './TitleBar.css';

export default function TitleBar({ setView, currentView }) {
  return (
    <div className="title-bar">
      <div className="title-logo">BANDAID</div>
      <div className="title-controls">
        <button className={`tb-btn ${currentView === 'library' ? 'active' : ''}`} onClick={() => setView('library')}>LIB</button>
        <button className={`tb-btn ${currentView === 'import' ? 'active' : ''}`} onClick={() => setView('import')}>IMPORT</button>
        <button className={`tb-btn ${currentView === 'stats' ? 'active' : ''}`} onClick={() => setView('stats')}>STATS</button>
        <button className={`tb-btn ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>SETTINGS</button>
        <button className={`tb-btn ${currentView === 'about' ? 'active' : ''}`} onClick={() => setView('about')}>ABOUT</button>
        <div className="window-btns">
          <button className="win-btn" onClick={() => window.api?.windowMinimize()}>_</button>
          <button className="win-btn" onClick={() => window.api?.windowMaximize()}>□</button>
          <button className="win-btn close" onClick={() => window.api?.windowClose()}>✕</button>
        </div>
      </div>
    </div>
  );
}
