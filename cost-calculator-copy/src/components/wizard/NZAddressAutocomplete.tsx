import React, { useState, useRef, useEffect, useCallback } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface NZAddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  error?: string;
}

export function NZAddressAutocomplete({ value, onChange, error }: NZAddressAutocompleteProps) {
  const [query, setQuery]         = useState(value);
  const [results, setResults]     = useState<NominatimResult[]>([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setResults([]); setOpen(false); return; }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        countrycodes:   'nz',
        format:         'jsonv2',
        addressdetails: '1',
        limit:          '6',
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en-NZ,en' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('Search failed');
      const data: NominatimResult[] = await res.json();

      const cleaned = data.map((r) => ({
        ...r,
        display_name: r.display_name.replace(/, New Zealand$/, '').replace(/, Aotearoa$/, ''),
      }));

      setResults(cleaned);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 350);
  }

  function handleSelect(result: NominatimResult) {
    setQuery(result.display_name);
    onChange(result.display_name);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          autoComplete="off"
          placeholder="23 Example Street, Auckland"
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          aria-label="Project address"
          aria-autocomplete="list"
          aria-expanded={open}
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            border: `1px solid ${error ? '#f87171' : '#d1d5db'}`,
            background: error ? '#fef2f2' : 'white',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {loading && (
          <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
            <svg
              style={{ width: '16px', height: '16px', color: '#9ca3af', animation: 'rg-spin 1s linear infinite' }}
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            background: 'white',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            margin: 0,
            padding: 0,
            listStyle: 'none',
          }}
        >
          {results.map((r) => (
            <li
              key={r.place_id}
              role="option"
              aria-selected={false}
              onMouseEnter={() => setHoveredId(r.place_id)}
              onMouseLeave={() => setHoveredId(null)}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              style={{
                display: 'flex',
                cursor: 'pointer',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                fontSize: '14px',
                background: hoveredId === r.place_id ? '#eff6ff' : 'white',
              }}
            >
              <svg
                style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, color: '#9ca3af' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span style={{ color: '#374151', lineHeight: 1.4 }}>{r.display_name}</span>
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li style={{ padding: '10px 12px', fontSize: '14px', color: '#6b7280' }}>
              No NZ address suggestions found. Keep typing a fuller address.
            </li>
          )}
        </ul>
      )}

      {!error && (
        <p style={{ marginTop: '4px', fontSize: '12px', color: '#9ca3af' }}>
          Start typing your NZ address — suggestions will appear
        </p>
      )}
      {error && <p style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626' }}>{error}</p>}
    </div>
  );
}
