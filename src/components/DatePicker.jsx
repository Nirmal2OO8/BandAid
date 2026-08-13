// src/components/DatePicker.jsx
// Scroll-wheel date picker — three columns: Day / Month / Year
// Props: value (ISO "YYYY-MM-DD" or ""), onChange(isoString)
import React, { useState, useEffect } from 'react';
import './DatePicker.css';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const CURRENT_YEAR = new Date().getFullYear();

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate(); // month is 1-based here
}

function parseISO(iso) {
  if (!iso || iso.length < 10) return null;
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return { y, m, d };
}

function toISO(y, m, d) {
  return `${y.toString().padStart(4,'0')}-${m.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
}

function Column({ label, value, min, max, onChange, display }) {
  const handleUp = () => onChange(value < max ? value + 1 : min);
  const handleDown = () => onChange(value > min ? value - 1 : max);

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) handleUp();
    else handleDown();
  };

  return (
    <div className="dp-column">
      <button className="dp-arrow" onClick={handleUp}>▲</button>
      <div className="dp-value" onWheel={handleWheel}>
        {display ? display(value) : String(value).padStart(2, '0')}
      </div>
      <button className="dp-arrow" onClick={handleDown}>▼</button>
      <div className="dp-label">{label}</div>
    </div>
  );
}

export default function DatePicker({ value, onChange }) {
  const parsed = parseISO(value);
  const now = new Date();

  const [day, setDay] = useState(parsed?.d || now.getDate());
  const [month, setMonth] = useState(parsed?.m || (now.getMonth() + 1));
  const [year, setYear] = useState(parsed?.y || now.getFullYear());

  // Clamp day when month/year changes
  useEffect(() => {
    const maxDay = daysInMonth(month, year);
    const clampedDay = Math.min(day, maxDay);
    if (clampedDay !== day) setDay(clampedDay);
    else onChange(toISO(year, month, clampedDay));
  }, [month, year]);

  useEffect(() => {
    const maxDay = daysInMonth(month, year);
    const clampedDay = Math.min(day, maxDay);
    onChange(toISO(year, month, clampedDay));
  }, [day]);

  // Sync from external value changes
  useEffect(() => {
    const p = parseISO(value);
    if (p) { setDay(p.d); setMonth(p.m); setYear(p.y); }
  }, [value]);

  const maxDay = daysInMonth(month, year);

  return (
    <div className="datepicker">
      <Column label="DAY" value={day} min={1} max={maxDay} onChange={setDay} />
      <div className="dp-sep">/</div>
      <Column label="MON" value={month} min={1} max={12} onChange={setMonth}
        display={v => MONTHS[v - 1]} />
      <div className="dp-sep">/</div>
      <Column label="YEAR" value={year} min={1900} max={CURRENT_YEAR} onChange={setYear}
        display={v => String(v)} />
    </div>
  );
}
