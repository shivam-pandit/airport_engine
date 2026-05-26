import { AirportSearch } from './components/AirportSearch';

function App() {
  return (
    <div className="min-h-screen bg-[#06070a] text-white flex flex-col items-center justify-between font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Background Radial Glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none"></div>

      {/* Premium Header */}
      <header className="w-full max-w-7xl px-8 py-6 flex items-center justify-between border-b border-gray-900/50 z-10">
        <div className="flex items-center gap-3.5">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/20 text-white flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div className="text-left">
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              FLY FAIRLY
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mt-0.5">
              Next-Gen Search Engine
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs text-gray-400 font-mono">SQLite engine online</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-3xl px-6 py-12 flex-grow flex flex-col items-center justify-center text-center z-10">
        
        {/* Title Group */}
        <div className="mb-10 max-w-xl">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-white mb-4">
            Search Airports. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Zero Mistakes.
            </span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            A deterministic, 5-tier search ranking flow designed for Fly Fairly. Resolves typos, multi-airport cities, regions, and foreign scripts entirely offline with sub-millisecond latencies.
          </p>
        </div>

        {/* The Autocomplete Search Component & Integrated Playground */}
        <div className="w-full">
          <AirportSearch />
        </div>

      </main>

      {/* Premium Footer */}
      <footer className="w-full max-w-7xl px-8 py-6 border-t border-gray-900/50 text-center flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4 z-10">
        <p>© 2026 Fly Fairly. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <span className="hover:text-gray-300 transition-colors font-mono">SQLite + FTS5</span>
          <span className="hover:text-gray-300 transition-colors font-mono">Vite + React + TS</span>
          <span className="hover:text-gray-300 transition-colors font-mono">TailwindCSS</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
