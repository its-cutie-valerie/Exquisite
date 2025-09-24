// src/App.tsx (add the FilterProvider around your existing content)
import { useEffect, useState } from 'react';
import { applyTheme, getIsDark, onThemeChange } from './utils/theme';
import Sidebar from './components/Sidebar';
import BooksGrid from './components/BooksGrid';
import CreateFolderModal from './components/NewFolderModal';
import { FilterProvider } from './contexts/FilterContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false)

  // Apply theme on startup and set initial Discord presence
  useEffect(() => {
    (async () => {
      try {
        const s = await window.db.getSettings().catch(() => null);
        const cleanup = applyTheme((s?.theme as any) || 'system');
        setIsDark(getIsDark())
        // Keep isDark state in sync for top-level container styling
        const off = onThemeChange(setIsDark)
        // store cleanup on window to be safe (not strictly necessary)
        ;(window as any).__themeAppCleanup = () => { try { cleanup?.(); off?.(); } catch {} }
      } catch {
        const cleanup = applyTheme('system');
        setIsDark(getIsDark())
        const off = onThemeChange(setIsDark)
        ;(window as any).__themeAppCleanup = () => { try { cleanup?.(); off?.(); } catch {} }
      }
      try { window.db.setPresenceBrowsing?.(); } catch {}
    })();
  }, []);

  return (
    <FilterProvider>
      <ErrorBoundary>
        <div className={`flex h-screen bg-gradient-to-br ${isDark ? 'from-stone-900 to-amber-950' : 'from-amber-50 to-orange-100'}`}>
          <Sidebar onCreateFolder={() => setShowCreateFolder(true)} />
          <BooksGrid />
          
          <CreateFolderModal
            isOpen={showCreateFolder}
            onClose={() => setShowCreateFolder(false)}
            onFolderCreated={() => {
              setShowCreateFolder(false);
              if ((window as any).refreshFolders) {
                (window as any).refreshFolders();
              }
            }}
          />
        </div>
      </ErrorBoundary>
    </FilterProvider>
  );
}

export default App;
