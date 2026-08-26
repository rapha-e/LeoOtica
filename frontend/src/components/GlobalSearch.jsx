import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../services/api";

const TYPE_ICONS = { os: "📋", otica: "🏪", lente: "🔬", nfe: "🧾" };
const TYPE_LABELS = { os: "Ordem de Servico", otica: "Otica", lente: "Lente", nfe: "NF-e" };

export default function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Atalho "/" para focar
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/search/?q=${encodeURIComponent(q)}&limit=10`);
      setResults(res.data);
      setSelected(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  const handleSelect = (result) => {
    onNavigate?.(result.tab, result);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); handleSelect(results[selected]); }
  };

  return (
    <div className="global-search" style={{ position: "relative" }}>
      <div className="global-search__input-wrap">
        <span className="global-search__icon">🔍</span>
        <input
          ref={inputRef}
          className="global-search__input"
          placeholder="Pesquisar OS, Pedido Loja, cliente, ótica... (/)"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {loading && <span className="global-search__spinner">⟳</span>}
        {query && <span className="global-search__hint">ESC</span>}
      </div>

      {open && (query.length >= 2) && (
        <div className="global-search__dropdown">
          {results.length === 0 && !loading && (
            <div className="global-search__empty">Nenhum resultado para "{query}"</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id + r.type}
              className={`global-search__item ${i === selected ? "active" : ""}`}
              onMouseDown={() => handleSelect(r)}
            >
              <span className="global-search__item-icon">{TYPE_ICONS[r.type] || "📌"}</span>
              <span className="global-search__item-body">
                <span className="global-search__item-title">{r.title}</span>
                <span className="global-search__item-sub">{r.subtitle}</span>
              </span>
              <span className="global-search__item-type">{TYPE_LABELS[r.type]}</span>
            </button>
          ))}
          <div className="global-search__footer">
            ↑↓ navegar · Enter selecionar · Esc fechar
          </div>
        </div>
      )}
    </div>
  );
}
