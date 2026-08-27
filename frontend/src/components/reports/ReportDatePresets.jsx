import React, { useState } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

export const getPresetDates = (presetKey) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  switch (presetKey) {
    case 'today': {
      const d = formatDate(now);
      return { startDate: d, endDate: d };
    }
    case 'yesterday': {
      const yDate = new Date(year, month, day - 1);
      const d = formatDate(yDate);
      return { startDate: d, endDate: d };
    }
    case 'last7': {
      const past = new Date(year, month, day - 6);
      return { startDate: formatDate(past), endDate: formatDate(now) };
    }
    case 'thisMonth': {
      const start = new Date(year, month, 1);
      return { startDate: formatDate(start), endDate: formatDate(now) };
    }
    case 'lastMonth': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    case 'thisYear': {
      const start = new Date(year, 0, 1);
      return { startDate: formatDate(start), endDate: formatDate(now) };
    }
    default:
      return null;
  }
};

const PRESETS = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: 'last7', label: 'Últimos 7 dias' },
  { key: 'thisMonth', label: 'Este Mês' },
  { key: 'lastMonth', label: 'Mês Anterior' },
  { key: 'thisYear', label: 'Ano Atual' },
  { key: 'custom', label: 'Personalizado' },
];

export default function ReportDatePresets({
  defaultPreset = 'thisMonth',
  onDateChange,
  style = {}
}) {
  const [selectedPreset, setSelectedPreset] = useState(defaultPreset);
  const initial = getPresetDates(defaultPreset) || {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  };
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);

  const handlePresetClick = (presetKey) => {
    setSelectedPreset(presetKey);
    if (presetKey !== 'custom') {
      const dates = getPresetDates(presetKey);
      if (dates) {
        setStartDate(dates.startDate);
        setEndDate(dates.endDate);
        if (onDateChange) onDateChange(dates);
      }
    }
  };

  const handleManualDateChange = (type, val) => {
    setSelectedPreset('custom');
    let newStart = startDate;
    let newEnd = endDate;

    if (type === 'start') {
      newStart = val;
      setStartDate(val);
    } else {
      newEnd = val;
      setEndDate(val);
    }

    if (onDateChange) {
      onDateChange({ startDate: newStart, endDate: newEnd });
    }
  };

  return (
    <div 
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(226, 232, 240, 0.9)',
        borderRadius: '14px',
        padding: '12px 18px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        ...style
      }}
    >
      {/* Botões Rápidos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', marginRight: '4px' }}>
          <Calendar size={15} style={{ color: 'hsl(var(--primary))' }} />
          <span>Período:</span>
        </div>
        {PRESETS.map((p) => {
          const isActive = selectedPreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetClick(p.key)}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                borderRadius: '8px',
                border: isActive ? '1px solid hsl(var(--primary))' : '1px solid rgba(226, 232, 240, 0.8)',
                background: isActive ? 'hsl(var(--primary))' : 'rgba(248, 250, 252, 0.9)',
                color: isActive ? '#ffffff' : 'hsl(var(--text-secondary))',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 8px rgba(147, 51, 234, 0.25)' : 'none'
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Date Pickers */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(241, 245, 249, 0.7)',
          padding: '4px 10px',
          borderRadius: '10px',
          border: '1px solid rgba(203, 213, 225, 0.6)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
          <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>De:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleManualDateChange('start', e.target.value)}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
        <ChevronRight size={14} style={{ color: 'hsl(var(--text-muted))' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
          <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Até:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleManualDateChange('end', e.target.value)}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(203, 213, 225, 0.9)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.78rem',
              color: 'hsl(var(--text-primary))',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>
    </div>
  );
}
