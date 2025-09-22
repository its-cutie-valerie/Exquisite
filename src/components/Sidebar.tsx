// src/components/Sidebar.tsx (Fixed)
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Book, BookCheck, Bookmark, Clock } from 'lucide-react';
import { Folder, FolderPlus, Leaf, Sparkles } from 'lucide-react';
import { Globe } from 'lucide-react';
import { Edit3, Trash2 } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import RenameModal from './RenameModal';
// Lazy-load heavy Project Gutenberg modal
const ProjectGutenbergModal = React.lazy(() => import('./ProjectGutenbergModal'));
import { useFilter } from '../contexts/FilterContext';

interface TooltipProps {
  children: React.ReactNode;
  message: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, message }) => {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);

  // When showing, calculate the position of the trigger
  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    }
  }, [show]);

  return (
    <div className="relative flex flex-col items-center group">
      <div
        ref={triggerRef}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-full"
      >
        {children}
      </div>
      {show && coords && createPortal(
        <div
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y - 12, // 12px above the trigger
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
          className="animate-fade-in"
        >
          <div className="bg-amber-900/95 backdrop-blur-sm text-amber-50 text-xs py-2 px-3 rounded-lg shadow-xl border border-amber-700/30 whitespace-nowrap relative">
            {message}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-amber-900/95"></div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface Folder {
  id: number;
  name: string;
}

interface SidebarProps {
  onCreateFolder: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onCreateFolder }) => {
  // Project Gutenberg modal state
  const [showGutenbergModal, setShowGutenbergModal] = useState(false);
  const [isImportingFromGutenberg, setIsImportingFromGutenberg] = useState(false);

  const handleOpenGutenbergModal = () => {
    setShowGutenbergModal(true);
  };

  const handleCloseGutenbergModal = () => {
    setShowGutenbergModal(false);
  };

  // Gutenberg import handler (duplicates handled by DuplicateWarningDialog in ProjectGutenbergModal)
  const handleGutenbergImport = async (bookUrl: string, bookData: any) => {
    setIsImportingFromGutenberg(true);
    try {
      console.log('Starting Gutenberg import:', bookData.title);

      // Download the EPUB bytes from Gutenberg
      const result = await window.db.downloadGutenbergBook(bookUrl, bookData);
      if (!result?.success) {
        throw new Error('Download failed');
      }
      console.log(`Downloaded ${result.size} bytes successfully`);

      // Import the EPUB from buffer with metadata
      const tempFileName = `gutenberg_${bookData.id}_${bookData.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.epub`;
      const importResult = await window.db.importEpubFromBuffer(
        result.buffer,
        tempFileName,
        {
          gutenberg_id: bookData.id,
          subjects: bookData.subjects,
          language: bookData.languages?.[0] || 'en',
          source: 'project_gutenberg'
        }
      );

      // If import was not blocked as duplicate in main process, add to DB
      if (importResult && !importResult.isDuplicate) {
        const newBook = await window.db.addBook(importResult);
        if (newBook) {
          if ((window as any).refreshBookCounts) (window as any).refreshBookCounts();
          if ((window as any).refreshBookList) (window as any).refreshBookList();
          console.log(`Successfully imported "${bookData.title}" from Project Gutenberg`);
        }
      } else if (importResult?.isDuplicate) {
        console.log(`Import flagged as duplicate in backend for "${bookData.title}"`);
        // No extra UI here; DuplicateWarningDialog is handled in ProjectGutenbergModal
      }
    } catch (error) {
      console.error('Error importing from Project Gutenberg:', error);
      throw error;
    } finally {
      setIsImportingFromGutenberg(false);
    }
  };


  return (
    <aside className="w-64 h-screen bg-gradient-to-b from-amber-50 to-orange-50 dark:from-stone-900 dark:to-amber-950 p-4 flex flex-col space-y-6 shadow-xl border-r border-amber-200/50 dark:border-amber-800/30 relative overflow-hidden">
      {/* Title with whimsical wizard hat */}
      <div className="text-center mb-4 relative flex-shrink-0 z-10">
        <div className="absolute top-0 right-4 text-amber-500/30">
          <Leaf size={16} className="transform rotate-12" />
        </div>
        <div className="relative inline-block px-2 py-1">
          {/* Brand title with hat anchored to the first letter */}
          <h1 className="text-2xl leading-none font-extrabold tracking-wide font-brand text-black dark:text-amber-100 select-none relative z-10 inline-flex items-center">
            <img
              src="/JumpCabt.gif"
              alt="Jumping cat"
              className="inline-block h-6 w-auto mr-2 align-[-0.2em] drop-shadow-sm select-none pointer-events-none"
            />
            <span>Exquisite</span>
          </h1>
        </div>
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50"></div>
      </div>
      
      <CategoriesSection />
      <FoldersSection onCreateFolder={onCreateFolder} />
      <IntegrationsSection onOpenGutenberg={handleOpenGutenbergModal} />

      {/* Project Gutenberg Modal */}
      <React.Suspense fallback={null}>
        <ProjectGutenbergModal
          isOpen={showGutenbergModal}
          onClose={handleCloseGutenbergModal}
          onImport={handleGutenbergImport}
          isImporting={isImportingFromGutenberg}
        />
      </React.Suspense>
    </aside>
  );
};

const CategoriesSection = () => {
  const { currentFilter, setFilter, clearFilter } = useFilter();
  const [bookCounts, setBookCounts] = useState({
    unread: 0,
    reading: 0,
    on_hold: 0,
    finished: 0
  });
  const [loading, setLoading] = useState(true);

  // Load book counts when component mounts
  useEffect(() => {
    const loadBookCounts = async () => {
      try {
        if (typeof window !== 'undefined' && window.db) {
          const books = await window.db.getBooks();
          
          const counts = {
            unread: books.filter(book => book.status === 'unread').length,
            reading: books.filter(book => book.status === 'reading').length,
            on_hold: books.filter(book => book.status === 'on_hold').length,
            finished: books.filter(book => book.status === 'finished').length
          };
          
          console.log('Book counts loaded:', counts);
          setBookCounts(counts);
        }
      } catch (error) {
        console.error('Error loading book counts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBookCounts();
  }, []);

  // Expose refresh function globally for sidebar counts
  useEffect(() => {
    const refreshBookCounts = async () => {
      try {
        if (typeof window !== 'undefined' && window.db) {
          const books = await window.db.getBooks();
          
          const counts = {
            unread: books.filter(book => book.status === 'unread').length,
            reading: books.filter(book => book.status === 'reading').length,
            on_hold: books.filter(book => book.status === 'on_hold').length,
            finished: books.filter(book => book.status === 'finished').length
          };
          
          setBookCounts(counts);
        }
      } catch (error) {
        console.error('Error refreshing book counts:', error);
      }
    };

    (window as any).refreshBookCounts = refreshBookCounts;
    return () => {
      delete (window as any).refreshBookCounts;
    };
  }, []);

  const categories = [
    { 
      name: 'All Books', 
      icon: <Book size={18} />, 
      count: bookCounts.unread + bookCounts.reading + bookCounts.on_hold + bookCounts.finished, 
      tooltip: 'All books in your library',
      status: 'all'
    },
    { 
      name: 'Unread', 
      icon: <Book size={18} />, 
      count: bookCounts.unread, 
      tooltip: 'Books you have not started reading yet',
      status: 'unread'
    },
    { 
      name: 'Reading', 
      icon: <BookCheck size={18} />, 
      count: bookCounts.reading, 
      tooltip: 'Books you are currently reading',
      status: 'reading'
    },
    { 
      name: 'Put on Hold', 
      icon: <Clock size={18} />, 
      count: bookCounts.on_hold, 
      tooltip: 'Books you paused or put on hold',
      status: 'on_hold'
    },
    { 
      name: 'Finished', 
      icon: <Bookmark size={18} />, 
      count: bookCounts.finished, 
      tooltip: 'Books you have finished reading',
      status: 'finished'
    },
  ];

  const handleCategoryClick = (category: any) => {
    if (category.status === 'all') {
      clearFilter();
    } else {
      setFilter('status', category.status, category.name);
    }
  };

  return (
    <nav className="bg-white/40 dark:bg-stone-800/40 p-3 rounded-2xl backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 shadow-lg">
      <h2 className="px-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Book size={14} className="text-amber-600 dark:text-amber-400" />
        Library
      </h2>
      <div className="space-y-1">
        {categories.map((category) => {
          const isActive = (currentFilter.type === 'status' && currentFilter.value === category.status) || 
                          (currentFilter.type === 'all' && category.status === 'all');
          
          return (
            <Tooltip key={category.name} message={category.tooltip}>
              <button
                onClick={() => handleCategoryClick(category)}
                className={`group w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-300/70 to-orange-300/70 dark:from-amber-700/70 dark:to-orange-700/70 text-amber-900 dark:text-amber-100 shadow-md'
                    : 'text-amber-900 dark:text-amber-100 hover:bg-gradient-to-r hover:from-amber-200/50 hover:to-orange-200/50 dark:hover:from-amber-800/30 dark:hover:to-orange-800/30'
                }`}
                aria-pressed={isActive}
              >
                <div className="flex items-center space-x-3">
                  <span className={`transition-colors duration-200 ${
                    isActive 
                      ? 'text-amber-800 dark:text-amber-200' 
                      : 'text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300'
                  }`}>
                    {category.icon}
                  </span>
                  <span className="font-medium">{category.name}</span>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all duration-200 shadow-sm min-w-[24px] text-center flex items-center justify-center ${
                  isActive
                    ? 'bg-amber-400/70 dark:bg-amber-600/70 text-amber-900 dark:text-amber-100'
                    : 'bg-gradient-to-r from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 text-amber-800 dark:text-amber-200 group-hover:from-amber-300 group-hover:to-orange-300 dark:group-hover:from-amber-700 dark:group-hover:to-orange-700'
                }`}>
                  {loading ? (
                    <div className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    category.count
                  )}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </nav>
  );
};

const FoldersSection: React.FC<{ onCreateFolder: () => void }> = ({ onCreateFolder }) => {
  const { currentFilter, setFilter } = useFilter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    const loadFolders = async () => {
      try {
        if (typeof window !== 'undefined' && window.db) {
          const foldersFromDb = await window.db.getFolders();
          setFolders(Array.isArray(foldersFromDb) ? foldersFromDb : []);
          setError(null);
        } else {
          setError('Database not available');
        }
      } catch (error: any) {
        console.error('Error loading folders:', error);
        setError(`Error loading folders: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(loadFolders, 500);
    return () => clearTimeout(timer);
  }, []);

  const refreshFolders = async () => {
    try {
      if (typeof window !== 'undefined' && window.db) {
        const foldersFromDb = await window.db.getFolders();
        setFolders(Array.isArray(foldersFromDb) ? foldersFromDb : []);
      }
    } catch (error) {
      console.error('Error refreshing folders:', error);
    }
  };

  useEffect(() => {
    (window as any).refreshFolders = refreshFolders;
    return () => {
      delete (window as any).refreshFolders;
    };
  }, []);

  const handleFolderClick = (folder: Folder) => {
    setFilter('folder', folder.id, folder.name);
  };

  const handleDeleteClick = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setSelectedFolder(folder);
    setShowDeleteConfirm(true);
  };

  const handleRenameClick = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setSelectedFolder(folder);
    setShowRenameModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedFolder) return;
    
    setIsDeleting(true);
    try {
      const success = await window.db.deleteFolder(selectedFolder.id);
      if (success) {
        setFolders(folders.filter(f => f.id !== selectedFolder.id));
        setShowDeleteConfirm(false);
        setSelectedFolder(null);
        // Notify other views to refresh state dependent on folders
        if ((window as any).refreshBookCounts) (window as any).refreshBookCounts();
        if ((window as any).refreshBookList) (window as any).refreshBookList();
        if ((window as any).refreshFolderNames) (window as any).refreshFolderNames();
      } else {
        alert('Failed to delete folder');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Error deleting folder');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRename = async (newName: string) => {
    if (!selectedFolder) return;
    
    setIsRenaming(true);
    try {
      const success = await window.db.renameFolder(selectedFolder.id, newName);
      if (success) {
        setFolders(folders.map(f => 
          f.id === selectedFolder.id ? { ...f, name: newName } : f
        ));
        setShowRenameModal(false);
        setSelectedFolder(null);
        // Notify other views so displayed names update
        if ((window as any).refreshFolderNames) (window as any).refreshFolderNames();
      } else {
        alert('Failed to rename folder');
      }
    } catch (error) {
      console.error('Error renaming folder:', error);
      alert('Error renaming folder');
    } finally {
      setIsRenaming(false);
    }
  };

  if (loading) {
    return (
      <nav className="bg-white/40 dark:bg-stone-800/40 p-3 rounded-2xl backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="px-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
            <Folder size={14} className="text-amber-600 dark:text-amber-400" />
            Folders
          </h2>
        </div>
        <div className="px-2 py-8 text-center text-sm text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          Loading folders...
        </div>
      </nav>
    );
  }

  if (error) {
    return (
      <nav className="bg-white/40 dark:bg-stone-800/40 p-3 rounded-2xl backdrop-blur-sm border border-red-200/30 dark:border-red-700/20 shadow-lg">
        <h2 className="px-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2 mb-3">
          <Folder size={14} className="text-amber-600 dark:text-amber-400" />
          Folders
        </h2>
        <div className="px-2 py-4 text-center text-xs text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/20 rounded-lg border border-red-200/30 dark:border-red-800/30">
          {error}
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className="bg-white/40 dark:bg-stone-800/40 p-3 rounded-2xl backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="px-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
            <Folder size={14} className="text-amber-600 dark:text-amber-400" />
            Folders
          </h2>
          <Tooltip message="Create New Folder">
            <button
              onClick={onCreateFolder}
              className="p-2 rounded-xl hover:bg-amber-200/50 dark:hover:bg-amber-800/30 transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              aria-label="Create new folder"
            >
              <FolderPlus size={16} className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors duration-200" />
            </button>
          </Tooltip>
        </div>

        <div
          className={`space-y-1 ${folders.length > 4 ? 'max-h-48 overflow-y-auto folders-scroll' : ''}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(245, 158, 11, 0.4) rgba(245, 158, 11, 0.1)',
            overflowX: 'hidden', // Prevent horizontal scrollbar
            position: 'relative',
            zIndex: 0,
          }}
        >
          <style>{`
            .folders-scroll::-webkit-scrollbar {
              width: 6px;
              height: 0px;
            }
            .folders-scroll::-webkit-scrollbar-track {
              background: rgba(245, 158, 11, 0.1);
              border-radius: 3px;
            }
            .folders-scroll::-webkit-scrollbar-thumb {
              background: rgba(245, 158, 11, 0.4);
              border-radius: 3px;
            }
            .folders-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(245, 158, 11, 0.6);
            }
          `}</style>

          {folders.length > 0 ? (
            folders.map((folder) => {
              const isActive = currentFilter.type === 'folder' && currentFilter.value === folder.id;

              return (
                <div key={folder.id} className="group relative z-10">
                  <div
                    onClick={() => handleFolderClick(folder)}
                    className={`w-full flex items-center space-x-2 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-300/70 to-orange-300/70 dark:from-amber-700/70 dark:to-orange-700/70 text-amber-900 dark:text-amber-100 shadow-md'
                        : 'text-amber-900 dark:text-amber-100 hover:bg-gradient-to-r hover:from-amber-200/50 hover:to-orange-200/50 dark:hover:from-amber-800/30 dark:hover:to-orange-800/30'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleFolderClick(folder);
                      }
                    }}
                    aria-pressed={isActive}
                    style={{ position: 'relative', zIndex: 10 }}
                  >
                    <Folder size={18} className="flex-shrink-0" />
                    <span className="truncate font-medium flex-grow min-w-0 pr-16 text-left">
                      {folder.name}
                    </span>

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center space-x-1 absolute right-3 top-2.5 z-30">
                      <Tooltip message="Rename folder">
                        <button
                          onClick={(e) => handleRenameClick(e, folder)}
                          className="p-1.5 rounded-lg hover:bg-amber-300/50 dark:hover:bg-amber-700/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                          aria-label={`Rename folder ${folder.name}`}
                          style={{ zIndex: 40, position: 'relative' }}
                        >
                          <Edit3 size={12} />
                        </button>
                      </Tooltip>
                      <Tooltip message="Delete folder">
                        <button
                          onClick={(e) => handleDeleteClick(e, folder)}
                          className="p-1.5 rounded-lg hover:bg-red-300/50 dark:hover:bg-red-700/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-400/50"
                          aria-label={`Delete folder ${folder.name}`}
                          style={{ zIndex: 40, position: 'relative' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-amber-700 dark:text-amber-300 border-2 border-dashed border-amber-300/50 dark:border-amber-600/30 rounded-xl bg-amber-50/30 dark:bg-amber-900/20">
              <div className="mb-2">
                <Leaf size={24} className="mx-auto text-amber-500/50 mb-2" />
              </div>
              <p className="mb-2 font-medium">No folders yet.</p>
              <button
                onClick={onCreateFolder}
                className="font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/50 rounded px-1"
              >
                Create your first folder
              </button>
            </div>
          )}
        </div>
      </nav>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Folder"
        message={`Are you sure you want to delete "${selectedFolder?.name}"? This action cannot be undone. Any books in this folder will be moved to "No Folder".`}
        confirmText="Delete"
        type="danger"
        isLoading={isDeleting}
      />

      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onRename={handleRename}
        currentName={selectedFolder?.name || ''}
        title="Rename Folder"
        isLoading={isRenaming}
      />
    </>
  );
};

const IntegrationsSection: React.FC<{ onOpenGutenberg: () => void }> = ({ onOpenGutenberg }) => {
  const integrations = [
    { 
      name: 'Project Gutenberg', 
      icon: <Globe size={18} />, 
      tooltip: 'Free public domain ebooks',
      onClick: onOpenGutenberg
    }
  ];

  return (
    <nav className="bg-white/40 dark:bg-stone-800/40 p-3 rounded-2xl backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 shadow-lg">
      <h2 className="px-2 text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
        Discover
      </h2>
      <div className="space-y-1">
        {integrations.map((item) => (
          <Tooltip key={item.name} message={item.tooltip}>
            <button
              onClick={item.onClick}
              className="group flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-xl text-amber-900 dark:text-amber-100 hover:bg-gradient-to-r hover:from-amber-200/50 hover:to-orange-200/50 dark:hover:from-amber-800/30 dark:hover:to-orange-800/30 transition-all duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400/50 w-full text-left"
            >
              <span className="text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors duration-200">
                {item.icon}
              </span>
              <span className="font-medium">{item.name}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;
