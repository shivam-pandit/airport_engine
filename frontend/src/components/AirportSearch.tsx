import React, { useState, useEffect, useRef } from 'react';

export interface SearchResult {
  iata: string;
  name: string;
  city: string;
  city_code: string | null;
  region: string;
  country: string;
  type: string;
  importance_score: number;
  score: number;
}

export const AirportSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  // Track selection to prevent searching for the formatted result string
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  
  // Store the fully selected airport details to show a visual confirmation panel
  const [selectedAirport, setSelectedAirport] = useState<SearchResult | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const testQueries = [
    { label: '🌴 Hawaii', query: 'Hawaii' },
    { label: '🇨🇦 Ontario', query: 'Ontario' },
    { label: '🇮🇩 Bali', query: 'Bali' },
    { label: '☀️ Florida', query: 'Florida' },
    { label: '🇧🇭 Manama', query: 'Manama' },
    { label: '🎯 TUL', query: 'TUL' },
    { label: '🇧🇪 Brussels', query: 'Brussels' },
    { label: '✍️ Londn (Typo)', query: 'Londn' },
    { label: '✈️ LON (City Code)', query: 'LON' },
    { label: '🗼 東京 (Tokyo)', query: '東京' },
    { label: '🇧🇷 São Paulo', query: 'São Paulo' }
  ];

  // Debounce logic: 200ms delay to limit API overhead
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  // Fetch results when debounced query changes
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    
    // Short circuit if query is empty OR matches the last selected formatted string
    if (trimmed === '' || debouncedQuery === lastSelected) {
      setResults([]);
      setLatency(null);
      setIsOpen(false);
      return;
    }

    const fetchAirports = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(trimmed)}`);
        if (!response.ok) {
          throw new Error('Failed to retrieve search results');
        }
        const data = await response.json();
        setResults(data.results || []);
        setLatency(data.latency || null);
        setIsOpen(true);
        setFocusedIndex(-1);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Something went wrong');
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAirports();
  }, [debouncedQuery, lastSelected]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetIndex = focusedIndex >= 0 ? focusedIndex : 0; // Default to first item if none highlighted
      if (targetIndex >= 0 && targetIndex < results.length) {
        handleSelect(results[targetIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (airport: SearchResult) => {
    const displayVal = `${airport.city} (${airport.iata})`;
    setQuery(displayVal);
    setLastSelected(displayVal); // Stop search query on this specific string
    setIsOpen(false);
    setSelectedAirport(airport); // Store the full airport details to display
    console.log('Selected airport:', airport);
  };

  const handlePlaygroundClick = (q: string) => {
    setQuery(q);
    setLastSelected(null); // Clear lastSelected since we clicked a new test keyword
    setSelectedAirport(null); // Reset selection
    setIsOpen(true);
    setFocusedIndex(0); // Focus the first result immediately

    // Focus the input element so keyboard navigation is active instantly
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'large_airport':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Major Hub
          </span>
        );
      case 'medium_airport':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Regional
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
            Local Field
          </span>
        );
    }
  };

  const isCityCodeQuery = results.length > 0 && 
    debouncedQuery.toUpperCase() === results[0].city_code;

  return (
    <div className="w-full flex flex-col gap-10">
      
      {/* Autocomplete Input Container */}
      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
        
        {/* Search Input Box */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(e) => {
              setQuery(e.target.value);
              setLastSelected(null); // Clear selection state when user edits manually
              setSelectedAirport(null); // Clear active selection card
              if (!isOpen) setIsOpen(true);
            }}
            placeholder="Where are you flying from? (City, IATA, Region, Typos...)"
            className="w-full pl-12 pr-12 py-4 text-base text-white placeholder-gray-500 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-lg group-hover:border-gray-700"
          />
          
          {/* Loading Spinner / Clear Button */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-4">
            {loading ? (
              <svg className="animate-spin h-5 h-5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : query ? (
              <button 
                onClick={() => { setQuery(''); setResults([]); setLastSelected(null); setSelectedAirport(null); setIsOpen(false); }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* Latency indicators */}
        {latency && results.length > 0 && (
          <div className="absolute right-2 -bottom-6 text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Indexed in {latency} (via SQLite Local Engine)</span>
          </div>
        )}

        {/* Dropdown Card */}
        {isOpen && (
          <div className="absolute w-full mt-3 overflow-hidden bg-gray-950/95 backdrop-blur-2xl border border-gray-800/80 rounded-2xl shadow-2xl z-50">
            
            {/* Multi-Airport City Special Header Card */}
            {isCityCodeQuery && (
              <div className="p-4 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border-b border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      {results[0].city} (All Airports)
                    </h4>
                    <p className="text-[11px] text-gray-400 font-medium">
                      City-level code resolver active for "{results[0].city_code}"
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-xs font-bold font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {results[0].city_code}
                </span>
              </div>
            )}

            {/* Autocomplete List */}
            <ul className="max-h-[340px] overflow-y-auto py-2">
              {error && (
                <li className="px-5 py-4 text-sm text-red-400 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Error: {error}</span>
                </li>
              )}

              {!loading && results.length === 0 && (
                <li className="px-5 py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-semibold text-white">No airports found</p>
                    <p className="text-xs text-gray-500">
                      We couldn't find matches for "{debouncedQuery}". Try another spelling or IATA code.
                    </p>
                  </div>
                </li>
              )}

              {results.map((airport, index) => {
                const isFocused = index === focusedIndex;
                return (
                  <li
                    key={`${airport.iata}-${index}`}
                    onMouseDown={() => handleSelect(airport)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`px-5 py-3 cursor-pointer flex items-center justify-between border-b border-gray-900 last:border-b-0 transition-all ${
                      isFocused 
                        ? 'bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border-l-4 border-l-indigo-500' 
                        : 'hover:bg-gray-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-4.5 pr-4 truncate">
                      <div className={`p-2.5 rounded-xl transition-all ${
                        isFocused ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-900 text-gray-400'
                      }`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </div>

                      <div className="truncate text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm truncate">
                            {airport.name}
                          </span>
                          {getTypeBadge(airport.type)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {airport.city}, {airport.region ? `${airport.region}, ` : ''}{airport.country}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-bold font-mono text-white text-lg tracking-wider bg-gray-900 px-3 py-1 rounded-xl border border-gray-800">
                        {airport.iata}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Selected Airport Visual Panel */}
      {selectedAirport && (
        <div className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-indigo-950/30 to-purple-950/30 border border-indigo-500/30 rounded-2xl animate-fade-in shadow-2xl relative overflow-hidden text-left">
          {/* Subtle neon glow inside card */}
          <div className="absolute -right-16 -top-16 w-36 h-36 rounded-full bg-indigo-500/10 blur-xl"></div>
          
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Selected Origin Airport
              </span>
              
              <h3 className="text-xl font-bold text-white leading-tight">
                {selectedAirport.name}
              </h3>
              
              <p className="text-sm text-gray-300">
                {selectedAirport.city}, {selectedAirport.region ? `${selectedAirport.region}, ` : ''}{selectedAirport.country}
              </p>
              
              <div className="flex flex-wrap items-center gap-3.5 mt-2">
                {getTypeBadge(selectedAirport.type)}
                <span className="text-xs font-mono text-gray-500">
                  Importance: {selectedAirport.importance_score}
                </span>
              </div>
            </div>

            {/* Glowing IATA display */}
            <div className="flex flex-col items-center justify-center p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl shadow-inner min-w-[90px]">
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest font-semibold mb-0.5">Code</span>
              <span className="text-3xl font-black font-mono text-white tracking-widest">{selectedAirport.iata}</span>
            </div>
          </div>

          {/* Action simulated booking section */}
          <div className="mt-6 pt-5 border-t border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-400 leading-normal max-w-sm">
              Origin successfully locked! Press "Search Flights" to find cheap flight options from {selectedAirport.city}.
            </p>
            <button 
              onClick={() => alert(`Searching best fares from ${selectedAirport.city} (${selectedAirport.iata}) on Fly Fairly...`)}
              className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all animate-pulse"
            >
              Search Flights
            </button>
          </div>
        </div>
      )}

      {/* Interactive Test Case Playground */}
      <div className="w-full max-w-2xl mx-auto p-6 bg-gray-900/30 backdrop-blur-md border border-gray-800/60 rounded-2xl">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 text-left">
          Interactive Test Case Playground
        </h3>
        <p className="text-xs text-gray-500 text-left mb-4">
          Click any of our 11 mandatory edge-case queries below to test how our tiered algorithm handles multi-airport codes, regional overrides, accents, and typos natively.
        </p>
        
        <div className="flex flex-wrap gap-2.5 justify-start">
          {testQueries.map((t) => (
            <button
              key={t.query}
              onMouseDown={() => handlePlaygroundClick(t.query)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-900 border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-gray-300 hover:text-white transition-all duration-200"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
