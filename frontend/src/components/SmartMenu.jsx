import React, { useState, useEffect } from "react";

const FAVORITES_KEY = (user) => `nova_lab_favs_${user || "default"}`;
const RECENTS_KEY = (user) => `nova_lab_recents_${user || "default"}`;

export function useFavorites(userId) {
  const key = FAVORITES_KEY(userId);
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });

  const toggle = (tab, label, icon) => {
    setFavs(prev => {
      const exists = prev.find(f => f.tab === tab);
      const next = exists ? prev.filter(f => f.tab !== tab) : [...prev.slice(0, 4), { tab, label, icon }];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  const isFav = (tab) => favs.some(f => f.tab === tab);
  return { favs, toggle, isFav };
}

export function useRecents(userId) {
  const key = RECENTS_KEY(userId);
  const [recents, setRecents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  });

  const push = (tab, label, icon) => {
    setRecents(prev => {
      const filtered = prev.filter(r => r.tab !== tab);
      const next = [{ tab, label, icon }, ...filtered].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return { recents, push };
}

export default function SmartMenuBar({ userId, onNavigate, activeTab }) {
  const { favs, toggle, isFav } = useFavorites(userId);
  const { recents } = useRecents(userId);

  if (favs.length === 0 && recents.length === 0) return null;

  return (
    <div className="smart-menu-bar">
      {favs.length > 0 && (
        <div className="smart-menu-section">
          <span className="smart-menu-section__label">★ Favoritos</span>
          {favs.map((f, i) => (
            <button
              key={f.tab}
              className={`smart-menu-btn ${activeTab === f.tab ? "active" : ""}`}
              onClick={() => onNavigate(f.tab)}
              title={`${f.label} · Alt+${i + 1}`}
            >
              {f.icon} {f.label}
              <span className="smart-menu-key">Alt+{i + 1}</span>
            </button>
          ))}
        </div>
      )}
      {recents.length > 0 && (
        <div className="smart-menu-section">
          <span className="smart-menu-section__label">🕐 Recentes</span>
          {recents.filter(r => !isFav(r.tab)).slice(0, 3).map(r => (
            <button
              key={r.tab}
              className={`smart-menu-btn ${activeTab === r.tab ? "active" : ""}`}
              onClick={() => onNavigate(r.tab)}
            >
              {r.icon} {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FavoriteToggle({ tab, label, icon, userId }) {
  const { toggle, isFav } = useFavorites(userId);
  const fav = isFav(tab);
  return (
    <button
      className={`fav-toggle ${fav ? "active" : ""}`}
      onClick={(e) => { e.stopPropagation(); toggle(tab, label, icon); }}
      title={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}
