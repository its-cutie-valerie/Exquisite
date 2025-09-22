// src/App.tsx (add the FilterProvider around your existing content)
import { useState } from 'react';
import Sidebar from './components/Sidebar';
import BooksGrid from './components/BooksGrid';
import CreateFolderModal from './components/NewFolderModal';
import { FilterProvider } from './contexts/FilterContext';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  return (
    <FilterProvider>
      <ErrorBoundary>
        <div className="flex h-screen bg-gradient-to-br from-amber-50 to-orange-100 dark:from-stone-900 dark:to-amber-950">
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
