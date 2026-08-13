import React from 'react';
import './AboutScreen.css';
import GothicCross from './GothicCross';

export default function AboutScreen() {
  return (
    <div className="about-screen">
      <div className="about-content">
        <h2>BANDAID: OFFLINE ARCHIVE</h2>

        <div className="system-log">
          <p>
            WARNING: This service may cause discomfort in users accustomed to being tracked.
          </p>

          <p>
            This application is a strictly offline, decentralized musical databank.
            Engineered to sever ties with corporate surveillance clouds and algorithmic dictation.
          </p>

          <p>
            No telemetry. No social integration. Pure data preservation.
          </p>
        </div>

        <div className="made-by">
          <span>&gt; Privacy First</span>
          <br /><br />
          Made by Nimal
        </div>
      </div>


      <div className="holo-wrapper">
        <GothicCross size={500} color="#8B0015" />
      </div>
    </div>
  );
}