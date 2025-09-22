// src/components/BooksGrid.tsx (Complete fixed version)
import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { Book, Upload, Search, Filter, X, Grid3X3, List, SortAsc, SortDesc, Sparkles, Settings as SettingsIcon, Leaf } from 'lucide-react';
import FallingLeaves from './FallingLeaves';
// Lazy-load heavy modals to reduce initial bundle size
const WellbeingModal = React.lazy(() => import('./WellbeingModal'));
import { FolderPlus, Trash2, BookOpen, CheckCircle, Pause, Folder, ChevronDown } from 'lucide-react';
const DuplicateBookModal = React.lazy(() => import('./DuplicateBookModal'));
const BookInfoModal = React.lazy(() => import('./BookInfoModal'));
import ConfirmationModal from './ConfirmationModal';
const SettingsModal = React.lazy(() => import('./SettingsModal'));
const TributeModal = React.lazy(() => import('./TributeModal'));
import { useFilter } from '../contexts/FilterContext';

interface BookData {
  id: number;
  title: string;
  author: string;
  description?: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  published_date?: string;
  cover_path?: string;
  file_path: string;
  file_size: number;
  progress: number;
  status: 'unread' | 'reading' | 'on_hold' | 'finished';
  folder_id?: number;
  created_at: string;
  updated_at: string;
}

interface Folder {
  id: number;
  name: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'title' | 'author' | 'recent' | 'progress';
type SortDirection = 'asc' | 'desc';

// Fixed overlay leaves that align to the books scroll area and do not affect scroll height
const ViewportLeaves: React.FC = () => {
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const measure = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const el = document.getElementById('books-scroll-area');
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Limit overlay to the visible viewport portion of the scroll area so ground leaves are always visible
    const visibleHeight = Math.max(0, Math.min(r.height, window.innerHeight - r.top));
    const extendedHeight = visibleHeight + 24; // slight margin to hide bottom seam
    const width = Math.max(0, Math.min(r.width, window.innerWidth - r.left) - 12); // reserve 12px for scrollbar
    setRect({ top: r.top, left: r.left, width, height: extendedHeight });
  }, []);

  React.useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    const el = document.getElementById('books-scroll-area');
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, [measure]);

  if (!rect) return null;
  return (
    <FallingLeaves
      count={18}
      zIndex={0}
      positionMode="fixed"
      fixedRect={rect}
      respectReducedMotion={false}
      colors={["#f59e0b","#d97706","#b45309","#c2410c","#e76f51","#6b8e23"]}
      speedRange={[12, 22]}
    />
  );
};

// Fixed Context Menu Component
const BookContextMenu: React.FC<{
  bookId: number;
  bookTitle: string;
  currentFolderId?: number;
  currentStatus: 'unread' | 'reading' | 'on_hold' | 'finished';
  position: { x: number; y: number } | null;
  onClose: () => void;
  onMoveToFolder: (folderId: number | null) => void;
  onStatusChange: (status: 'unread' | 'reading' | 'on_hold' | 'finished') => void;
  onDelete: () => void;
  onRequestDelete?: () => void;
  onOpenDetails: () => void;
}> = ({
  bookId: _bookId,
  bookTitle,
  currentFolderId,
  currentStatus,
  position,
  onClose,
  onMoveToFolder,
  onStatusChange,
  onDelete,
  onRequestDelete,
  onOpenDetails,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFolders = async () => {
      setLoading(true);
      try {
        const foldersData = await window.db.getFolders();
        setFolders(foldersData);
      } catch (error) {
        console.error('Error loading folders:', error);
      } finally {
        setLoading(false);
      }
    };

    if (position) {
      loadFolders();
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const toggleFoldersMenu = () => {
    if (showStatuses) setShowStatuses(false);
    setShowFolders(!showFolders);
  };

  const toggleStatusMenu = () => {
    if (showFolders) setShowFolders(false);
    setShowStatuses(!showStatuses);
  };

  const handleMoveToFolder = useCallback((folderId: number | null) => {
    onMoveToFolder(folderId);
    onClose();
  }, [onMoveToFolder, onClose]);

  const handleStatusChange = useCallback((status: 'unread' | 'reading' | 'on_hold' | 'finished') => {
    onStatusChange(status);
    onClose();
  }, [onStatusChange, onClose]);

  const handleDeleteClick = useCallback(() => {
    // If parent wants to handle confirmation centrally, delegate
    if (typeof (onRequestDelete as any) === 'function') {
      (onRequestDelete as any)();
      return;
    }

    setShowDeleteConfirm(true);
  }, [onRequestDelete]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting book:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, onClose]);

  const getMenuPosition = () => {
    if (!position) return { left: 0, top: 0 };

    const menuWidth = 220;
    const menuHeight = 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 12;

    let left = position.x;
    let top = position.y;

    if (left + menuWidth > viewportWidth - padding) {
      left = position.x - menuWidth;
    }
    if (left < padding) {
      left = padding;
    }

    if (top + menuHeight > viewportHeight - padding) {
      top = position.y - menuHeight;
    }
    if (top < padding) {
      top = padding;
    }

    return { left, top };
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'reading':
        return { icon: BookOpen, label: 'Reading', color: 'text-blue-600 dark:text-blue-400' };
      case 'finished':
        return { icon: CheckCircle, label: 'Finished', color: 'text-green-600 dark:text-green-400' };
      case 'on_hold':
        return { icon: Pause, label: 'On Hold', color: 'text-yellow-600 dark:text-yellow-400' };
      default:
        return { icon: Book, label: 'Unread', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  if (!position) return null;

  const menuPosition = getMenuPosition();
  const statusOptions = [
    { key: 'unread', ...getStatusInfo('unread') },
    { key: 'reading', ...getStatusInfo('reading') },
    { key: 'on_hold', ...getStatusInfo('on_hold') },
    { key: 'finished', ...getStatusInfo('finished') },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      <div
        ref={menuRef}
        className="fixed z-50 bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-amber-200/50 dark:border-amber-700/30 py-2 context-menu-animation overflow-hidden"
        style={{ 
          left: menuPosition.left, 
          top: menuPosition.top,
          width: '220px',
          transformOrigin: position.x < window.innerWidth / 2 ? 'top left' : 'top right'
        }}
      >
        <button
          onClick={() => { onOpenDetails(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50/80 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-200 transition-colors duration-200 flex items-center gap-3 font-medium"
        >
          <BookOpen size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>View Details</span>
        </button>

        <div className="my-1 border-t border-amber-200/30 dark:border-amber-700/20"></div>

        <button
          onClick={toggleStatusMenu}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50/80 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-200 transition-colors duration-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            {React.createElement(getStatusInfo(currentStatus).icon, { 
              size: 16, 
              className: `${getStatusInfo(currentStatus).color} flex-shrink-0` 
            })}
            <span>Change Status</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600/70 dark:text-amber-400/70 truncate max-w-[50px]">
              {getStatusInfo(currentStatus).label}
            </span>
            <ChevronDown 
              size={12} 
              className={`text-amber-600/70 dark:text-amber-400/70 transition-transform duration-200 flex-shrink-0 ${showStatuses ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {showStatuses && (
          <div className="ml-6 mr-2 mb-2 menu-fade-in">
            {statusOptions.map((statusOption) => (
              <button
                key={statusOption.key}
                onClick={() => handleStatusChange(statusOption.key as any)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                  currentStatus === statusOption.key
                    ? 'bg-amber-100/80 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 font-medium'
                    : 'hover:bg-amber-50/60 dark:hover:bg-stone-700/40 text-stone-700 dark:text-stone-300'
                }`}
              >
                <statusOption.icon size={14} className={`${statusOption.color} flex-shrink-0`} />
                <span className="flex-1">{statusOption.label}</span>
                {currentStatus === statusOption.key && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={toggleFoldersMenu}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50/80 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-200 transition-colors duration-200 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <FolderPlus size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Move to Folder</span>
          </div>
          <div className="flex items-center gap-2">
            {currentFolderId && (
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70 truncate max-w-[50px]">
                {folders.find(f => f.id === currentFolderId)?.name || '...'}
              </span>
            )}
            <ChevronDown 
              size={12} 
              className={`text-amber-600/70 dark:text-amber-400/70 transition-transform duration-200 flex-shrink-0 ${showFolders ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {showFolders && (
          <div className="ml-6 mr-2 mb-2 menu-fade-in">
            <div className="max-h-32 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-1 pr-2">
                  <button
                    onClick={() => handleMoveToFolder(null)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                      currentFolderId === null || currentFolderId === undefined
                        ? 'bg-amber-100/80 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 font-medium'
                        : 'hover:bg-amber-50/60 dark:hover:bg-stone-700/40 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="w-2 h-2 bg-stone-400 rounded-full flex-shrink-0"></div>
                    <span className="flex-1">No Folder</span>
                    {(currentFolderId === null || currentFolderId === undefined) && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">✓</span>
                    )}
                  </button>
                  
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveToFolder(folder.id)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                        currentFolderId === folder.id
                          ? 'bg-amber-100/80 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 font-medium'
                          : 'hover:bg-amber-50/60 dark:hover:bg-stone-700/40 text-stone-700 dark:text-stone-300'
                      }`}
                      title={folder.name}
                    >
                      <Folder size={12} className="text-amber-500 flex-shrink-0" />
                      <span className="flex-1 truncate">{folder.name}</span>
                      {currentFolderId === folder.id && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="my-1 border-t border-amber-200/30 dark:border-amber-700/20"></div>

        <button
          onClick={handleDeleteClick}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50/80 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors duration-200 flex items-center gap-3"
        >
          <Trash2 size={16} className="flex-shrink-0" />
          <span>Delete Book</span>
        </button>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Book"
        message={`Are you sure you want to delete "${bookTitle}"? This will permanently remove the book and its files from your library. This action cannot be undone.`}
        confirmText="Delete Book"
        type="danger"
        isLoading={isDeleting}
      />
    </>
  );
};

const BooksGrid: React.FC = () => {
  const { currentFilter, clearFilter } = useFilter();
  const [books, setBooks] = useState<BookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWellbeing, setShowWellbeing] = useState(false);
  const [showTribute, setShowTribute] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // Map of folder id -> folder name for quick lookups in cards
  const [folderNames, setFolderNames] = useState<Record<number, string>>({});
  
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{
    filePath: string;
    newBookTitle: string;
    existingBook: any;
    matchType: 'title' | 'metadata' | 'file';
  } | null>(null);
  const [pendingImports, setPendingImports] = useState<string[]>([]);

  const [selectedBook, setSelectedBook] = useState<BookData | null>(null);
  const [showBookInfo, setShowBookInfo] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    book: BookData;
    position: { x: number; y: number };
  } | null>(null);

  // Centralized context-menu delete request state
  const [contextDelete, setContextDelete] = useState<{ book: BookData } | null>(null);
  const [isDeletingContext, setIsDeletingContext] = useState(false);
  // Soft-delete queue: holds pending deletes with timers so we can undo
  const [pendingDeletes, setPendingDeletes] = useState<Array<{
    book: BookData;
    timerId: number;
  }>>([]);
  const [lastDeleted, setLastDeleted] = useState<BookData | null>(null);
  const [toastDeadline, setToastDeadline] = useState<number | null>(null);
  const [toastProgress, setToastProgress] = useState<number>(0);
  const [toastExiting, setToastExiting] = useState(false);
  // Persist which book IDs have already revealed to avoid re-animating on resort/filter
  const revealedIdsRef = useRef<Set<number>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [filterVersion, setFilterVersion] = useState(0);

  useEffect(() => {
    // Detect user motion preference to disable fancy animations when reduced
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else if ((media as any).addListener) {
      (media as any).addListener(update);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update);
      } else if ((media as any).removeListener) {
        (media as any).removeListener(update);
      }
    };
  }, []);

  // Reset reveal tracking ONLY when switching categories (filter changes)
  // Keeps natural scrolling reveal for All view and other non-category toggles.
  useEffect(() => {
    revealedIdsRef.current.clear();
    setFilterVersion((v) => v + 1);
  }, [currentFilter]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  // Load folder names so we can display them on cards
  const refreshFolderNames = useCallback(async () => {
    try {
      const folders = await window.db.getFolders();
      const map: Record<number, string> = {};
      for (const f of folders) map[f.id] = f.name;
      setFolderNames(map);
    } catch (err) {
      console.error('Error loading folders for cards:', err);
    }
  }, []);

  useEffect(() => {
    refreshFolderNames();
    // Expose global so Sidebar or others can request a refresh after folder changes
    (window as any).refreshFolderNames = refreshFolderNames;
    return () => {
      if ((window as any).refreshFolderNames === refreshFolderNames) {
        delete (window as any).refreshFolderNames;
      }
    };
  }, [refreshFolderNames]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'f':
            e.preventDefault();
            searchInputRef.current?.focus();
            break;
          case 'i':
            e.preventDefault();
            if (!importing) handleImportBooks();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [importing]);

  const loadBooks = async () => {
    try {
      const booksData = await window.db.getBooks();
      console.log('Loaded books:', booksData); // Debug log
      setBooks(booksData);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  // In BooksGrid.tsx - add this useEffect after your existing loadBooks function
useEffect(() => {
  // Expose refresh function globally so Sidebar can trigger it
  (window as any).refreshBookList = loadBooks;
  return () => {
    delete (window as any).refreshBookList;
  };
}, [loadBooks]); // Add loadBooks as dependency


  const processedBooks = useMemo(() => {
    let filtered = books.filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           book.author.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      switch (currentFilter.type) {
        case 'status':
          return book.status === currentFilter.value;
        case 'folder':
          return book.folder_id === currentFilter.value;
        case 'all':
        default:
          return true;
      }
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'recent':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [books, searchTerm, currentFilter, sortBy, sortDirection]);

  const handleImportBooks = async () => {
    setImporting(true);
    try {
      const filePaths = await window.db.openFileDialog();
      setPendingImports(filePaths);
      
      for (const filePath of filePaths) {
        await processSingleImport(filePath);
      }
      
      // Force refresh sidebar counts
      await loadBooks();
      if ((window as any).refreshBookCounts) {
        (window as any).refreshBookCounts();
      }
    } catch (error) {
      console.error('Error importing books:', error);
    } finally {
      setImporting(false);
      setPendingImports([]);
    }
  };

  const processSingleImport = async (filePath: string, forceImport = false) => {
    try {
      const result = await window.db.importEpub(filePath, forceImport);
      
      if (result.isDuplicate && !forceImport) {
        setDuplicateData({
          filePath,
          newBookTitle: result.existingBook?.title || getFileNameFromPath(filePath),
          existingBook: result.existingBook,
          matchType: result.matchType
        });
        setShowDuplicateModal(true);
        return;
      }
      
      if (!result.isDuplicate) {
        const bookData = await window.db.addBook(result);
        if (bookData) {
          setBooks(prev => [...prev, bookData]);
        }
      }
    } catch (error) {
      console.error('Error importing book:', filePath, error);
    }
  };

  const getFileNameFromPath = (filePath: string) => {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    return fileName.replace(/\.epub$/i, '').replace(/[_-]+/g, ' ');
  };

  // (cleanup duplicates removed - not currently used)


  const handleDuplicateReplace = async () => {
    if (!duplicateData) return;
    
    try {
      await window.db.deleteBook(duplicateData.existingBook.id);
      const result = await window.db.importEpub(duplicateData.filePath, true);
      const bookData = await window.db.addBook(result);
      
      if (bookData) {
        setBooks(prev => prev.filter(book => book.id !== duplicateData.existingBook.id));
        setBooks(prev => [...prev, bookData]);
      }
      
      await loadBooks();
      if ((window as any).refreshBookCounts) {
        (window as any).refreshBookCounts();
      }
    } catch (error) {
      console.error('Error replacing book:', error);
      alert('Error replacing book. Please try again.');
    } finally {
      setShowDuplicateModal(false);
      setDuplicateData(null);
    }
  };

  const handleDuplicateKeepBoth = async () => {
    if (!duplicateData) return;
    
    try {
      const result = await window.db.importEpub(duplicateData.filePath, true);
      const bookData = await window.db.addBook(result);
      
      if (bookData) {
        setBooks(prev => [...prev, bookData]);
      }
      
      await loadBooks();
      if ((window as any).refreshBookCounts) {
        (window as any).refreshBookCounts();
      }
    } catch (error) {
      console.error('Error keeping both books:', error);
      alert('Error importing book. Please try again.');
    } finally {
      setShowDuplicateModal(false);
      setDuplicateData(null);
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateModal(false);
    setDuplicateData(null);
  };

  // Context menu handlers with proper refresh
  const handleOpenContextMenu = useCallback((book: BookData, position: { x: number; y: number }) => {
    setContextMenu({ book, position });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMoveToFolder = useCallback(async (folderId: number | null) => {
    if (!contextMenu) return;
    
    try {
      const success = await window.db.updateBook(contextMenu.book.id, {
        title: contextMenu.book.title,
        author: contextMenu.book.author,
        progress: contextMenu.book.progress,
        status: contextMenu.book.status,
        folderId: folderId
      });
      
      if (success) {
        await loadBooks(); // Refresh books list
        if ((window as any).refreshBookCounts) {
          (window as any).refreshBookCounts();
        }
      }
    } catch (error) {
      console.error('Error moving book to folder:', error);
    }
  }, [contextMenu]);

  const handleContextStatusChange = useCallback(async (newStatus: 'unread' | 'reading' | 'on_hold' | 'finished') => {
    if (!contextMenu) return;
    
    try {
      console.log('Updating book status to:', newStatus); // Debug log
      const success = await window.db.updateBook(contextMenu.book.id, {
        title: contextMenu.book.title,
        author: contextMenu.book.author,
        progress: contextMenu.book.progress,
        status: newStatus, // Ensure consistent status value
        folderId: contextMenu.book.folder_id
      });
      
      if (success) {
        console.log('Status updated successfully'); // Debug log
        await loadBooks(); // Refresh books list
        if ((window as any).refreshBookCounts) {
          (window as any).refreshBookCounts();
        }
      }
    } catch (error) {
      console.error('Error updating book status:', error);
    }
  }, [contextMenu]);

  // contextMenu deletions are handled centrally via contextDelete

  const handleBookClick = (book: BookData, event: React.MouseEvent) => {
    if (event.button === 2) return;
    
    setSelectedBook(book);
    setShowBookInfo(true);
  };

  const handleCloseBookInfo = () => {
    setShowBookInfo(false);
    setSelectedBook(null);
  };

  // Perform the centralized delete when user confirms from parent modal
  const performContextDelete = useCallback(async () => {
    if (!contextDelete) return;
    setIsDeletingContext(true);
    try {
      // Use soft-delete: enqueue a pending delete and allow undo
      softDeleteBook(contextDelete.book);
    } catch (error) {
      console.error('Error performing context delete:', error);
    } finally {
      setIsDeletingContext(false);
      setContextDelete(null);
    }
  }, [contextDelete]);

  // Soft-delete implementation
  const softDeleteBook = useCallback((book: BookData) => {
    // Remove from visible list immediately
    setBooks(prev => prev.filter(b => b.id !== book.id));
    setLastDeleted(book);

    // Start a timer (e.g., 6s) before finalizing delete
    const timer = window.setTimeout(async () => {
      try {
        const success = await window.db.deleteBook(book.id);
        console.log('[BooksGrid] softDelete finalized for id', book.id, 'success:', success);
        if (success) {
          await loadBooks();
          if ((window as any).refreshBookCounts) {
            (window as any).refreshBookCounts();
          }
        }
      } catch (err) {
        console.error('Error finalizing soft delete:', err);
      } finally {
        // remove from pendingDeletes
        setPendingDeletes(prev => prev.filter(p => p.book.id !== book.id));
        // animate exit then clear
        setToastExiting(true);
        setTimeout(() => setLastDeleted(null), 260);
      }
    }, 6000);

    setPendingDeletes(prev => [...prev, { book, timerId: timer }]);
    // set deadline for progress bar
    setToastDeadline(Date.now() + 6000);
    setToastExiting(false);
  }, []);

  const undoDelete = useCallback((bookId: number) => {
    const pending = pendingDeletes.find(p => p.book.id === bookId);
    if (!pending) return;
    clearTimeout(pending.timerId);
    setPendingDeletes(prev => prev.filter(p => p.book.id !== bookId));
    // restore book in UI by reloading from DB (simple and reliable)
    (async () => {
      try {
        await loadBooks();
      } catch (err) {
        console.error('Error restoring book after undo:', err);
      } finally {
        // animate exit then clear
        setToastExiting(true);
        setTimeout(() => setLastDeleted(null), 240);
      }
    })();
  }, [pendingDeletes]);

  // Progress bar updater
  useEffect(() => {
    if (!toastDeadline) {
      setToastProgress(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const total = Math.max(1, (toastDeadline - now));
      const elapsed = Math.max(0, 6000 - total);
      const pct = Math.min(100, Math.round((elapsed / 6000) * 100));
      setToastProgress(pct);
    };

    tick();
    const iv = setInterval(tick, 120);
    return () => clearInterval(iv);
  }, [toastDeadline]);

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortDirection(option === 'progress' ? 'desc' : 'asc');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-stone-900 dark:to-amber-950/30">
        <div className="text-center animate-fade-in">
          <div className="relative mb-6 flex items-center justify-center">
            <img
              src="/RunCatb.gif"
              alt="Running cat loading"
              className="h-20 w-auto drop-shadow-sm select-none"
            />
          </div>
          <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-2">
            Loading your library...
          </h3>
          <p className="text-amber-700/80 dark:text-amber-300/80">
            Please wait while we gather your books
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-full bg-gradient-to-br from-amber-50/30 to-orange-50/30 dark:from-stone-900 dark:to-amber-950/30 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-amber-200/50 dark:border-amber-700/20 bg-white/20 dark:bg-stone-900/20 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-800 to-orange-700 dark:from-amber-300 dark:to-orange-200 bg-clip-text text-transparent">
                {currentFilter.label}
              </h1>
              {currentFilter.type !== 'all' && (
                <span className="px-3 py-1 text-sm bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 rounded-full border border-amber-300/30 dark:border-amber-600/30 font-medium flex items-center gap-1">
                  <Filter size={14} />
                  {currentFilter.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <p className="text-amber-700/80 dark:text-amber-200/80 flex items-center gap-2">
                <Book size={16} />
                <span className="font-medium">
                  {processedBooks.length} {processedBooks.length === 1 ? 'book' : 'books'}
                </span>
              </p>
              {searchTerm && (
                <span className="px-2 py-1 text-xs bg-blue-200/60 dark:bg-blue-800/40 text-blue-800 dark:text-blue-200 rounded-full border border-blue-300/30 dark:border-blue-600/30 font-medium">
                  Search: "{searchTerm}"
                </span>
              )}
              {importing && pendingImports.length > 0 && (
                <span className="px-2 py-1 text-xs bg-green-200/60 dark:bg-green-800/40 text-green-800 dark:text-green-200 rounded-full border border-green-300/30 dark:border-green-600/30 font-medium animate-pulse">
                  Importing {pendingImports.length} books...
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowWellbeing(true)}
            className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-100/80 to-orange-100/80 hover:from-amber-200 hover:to-orange-200 text-amber-800 dark:text-amber-100 rounded-2xl border border-amber-200/60 dark:border-amber-700/30 shadow-sm font-semibold transition-all duration-200 mr-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transform hover:scale-105 active:scale-95"
            title="Wellbeing"
          >
            <Leaf size={20} className="text-emerald-700 dark:text-emerald-200" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-100/80 to-orange-100/80 hover:from-amber-200 hover:to-orange-200 text-amber-800 dark:text-amber-100 rounded-2xl border border-amber-200/60 dark:border-amber-700/30 shadow-sm font-semibold transition-all duration-200 mr-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transform hover:scale-105 active:scale-95"
            title="Settings"
          >
            <SettingsIcon size={20} className="text-amber-700 dark:text-amber-200" />
          </button>
          <button
            onClick={handleImportBooks}
            disabled={importing}
            className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            title="Import books (Ctrl+I)"
          >
            {importing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload size={20} />
                <span>Add Books</span>
              </>
            )}
          </button>
  </div>

        {/* Search and Controls */}
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px] max-w-md">
            <div className="relative">
              {/* Cute sleep cat overlayed above search bar without shifting layout */}
              <img
                src="/SleepCatb.gif"
                alt="Sleeping cat"
                className="absolute left-1/2 -translate-x-1/2 ml-6 -top-14 h-16 w-auto drop-shadow-sm pointer-events-none select-none z-10"
              />
              <Search size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-amber-600/60 transition-colors duration-200" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search your library... (Ctrl+F)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/70 dark:bg-stone-800/70 border border-amber-200 dark:border-amber-700/50 rounded-xl focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 dark:text-amber-50 transition-all duration-200 placeholder:text-amber-600/50 dark:placeholder:text-amber-400/50 shadow-sm focus:shadow-md transform focus:scale-[1.01]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 rounded-full hover:bg-amber-100/50 dark:hover:bg-amber-800/30 transition-all duration-200"
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center bg-white/60 dark:bg-stone-800/60 rounded-xl p-1 border border-amber-200/50 dark:border-amber-700/30">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'
                  : 'text-amber-600/70 dark:text-amber-400/70 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
              title="Grid view"
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'
                  : 'text-amber-600/70 dark:text-amber-400/70 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
              title="List view"
            >
              <List size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {['title', 'author', 'recent', 'progress'].map((option) => (
              <div key={option} className="relative">
                {option === 'recent' && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
                    <div className="relative group h-8 w-16">
                      <img
                        src="/968649631607189574.gif"
                        alt="Luky the fox (decorative)"
                        className="absolute inset-0 mx-auto h-8 w-auto drop-shadow-sm pointer-events-none transition-transform duration-200 group-hover:scale-[1.04] group-hover:-translate-y-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTribute(true)}
                        className="absolute inset-0 bg-transparent outline-none border-0"
                        aria-label="Open Luky's Tribute"
                        title="Luky's Tribute"
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50/95 dark:bg-stone-800/95 text-amber-900 dark:text-amber-100 border border-amber-200/60 dark:border-amber-700/40 shadow pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap">
                          Luky's Tribute
                        </div>
                        <span className="sr-only">Open Tribute</span>
                      </button>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => toggleSort(option as SortOption)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    sortBy === option
                      ? 'bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200'
                      : 'bg-white/60 dark:bg-stone-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 border border-amber-200/50 dark:border-amber-700/30'
                  }`}
                  title={`Sort by ${option}`}
                >
                  <span className="capitalize">{option === 'recent' ? 'Recent' : option}</span>
                  {sortBy === option && (
                    sortDirection === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>

          {(currentFilter.type !== 'all' || searchTerm) && (
            <div className="flex items-center gap-2">
              {currentFilter.type !== 'all' && (
                <button
                  onClick={clearFilter}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-amber-200/60 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-300/60 dark:hover:bg-amber-700/50 transition-all duration-200 border border-amber-300/30 dark:border-amber-600/30"
                >
                  <Filter size={14} />
                  <span>Clear Filter</span>
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
  </div>

  <Suspense fallback={null}>
    <WellbeingModal isOpen={showWellbeing} onClose={() => setShowWellbeing(false)} />
  </Suspense>
  <Suspense fallback={null}>
    <TributeModal isOpen={showTribute} onClose={() => setShowTribute(false)} />
  </Suspense>

      {/* Books Content */}
  <div className="relative flex-1 overflow-y-auto p-6 booksgrid-scrollbar" id="books-scroll-area">
      {/* Falling leaves in the books area only */}
  {/* Fixed overlay so leaves don't change scroll height */}
  <ViewportLeaves />
      {/* Scrollbar styles are now global via .booksgrid-scrollbar in index.css */}
        {processedBooks.length > 0 ? (
          <div
            key={`grid-${filterVersion}`}
            className={
              (viewMode === 'grid'
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6"
                : "space-y-4") + " animate-fade-in relative z-10"
            }>
            {processedBooks.map((book, index) => (
              <BookCard 
                key={book.id} 
                book={book} 
                onClick={handleBookClick}
                onOpenContextMenu={handleOpenContextMenu}
                animationDelay={index * 50}
                viewMode={viewMode}
                revealedIdsRef={revealedIdsRef}
                prefersReducedMotion={prefersReducedMotion}
                filterVersion={filterVersion}
                folderName={book.folder_id ? folderNames[book.folder_id] : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyState 
            books={books}
            searchTerm={searchTerm}
            currentFilter={currentFilter}
            onImport={handleImportBooks}
            onClearSearch={() => setSearchTerm('')}
            onClearFilter={clearFilter}
            importing={importing}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <BookContextMenu
          bookId={contextMenu.book.id}
          bookTitle={contextMenu.book.title}
          currentFolderId={contextMenu.book.folder_id}
          currentStatus={contextMenu.book.status}
          position={contextMenu.position}
          onClose={handleCloseContextMenu}
          onMoveToFolder={handleContextMoveToFolder}
          onStatusChange={handleContextStatusChange}
          onDelete={async () => {
            const bookId = contextMenu.book.id; // capture stable id
            console.log('[ContextMenu] Attempting to delete book with id:', bookId);
            try {
              const success = await window.db.deleteBook(bookId);
              console.log('[ContextMenu] DB deleteBook result:', success);
              if (success) {
                await loadBooks();
                if ((window as any).refreshBookCounts) {
                  (window as any).refreshBookCounts();
                }
                console.log('[ContextMenu] Book deleted and list refreshed.');
              } else {
                console.warn('[ContextMenu] deleteBook returned falsy value.');
              }
            } catch (error) {
              console.error('[ContextMenu] Error deleting book:', error);
            }
          }}
          onRequestDelete={() => {
            // Parent will show central confirmation modal and perform delete
            const bookId = contextMenu.book.id;
            console.log('[BooksGrid] onRequestDelete received for id:', bookId);
            setSelectedBook(contextMenu.book);
            setShowBookInfo(false);
            setShowDuplicateModal(false);
            setShowBookInfo(false);
            // set a local state to open a central confirmation modal
            setContextDelete({ book: contextMenu.book });
            handleCloseContextMenu();
          }}
          onOpenDetails={() => {
            setSelectedBook(contextMenu.book);
            setShowBookInfo(true);
          }}
        />
      )}

      {/* Modals */}
      <Suspense fallback={null}>
      <DuplicateBookModal
        isOpen={showDuplicateModal}
        onClose={handleDuplicateCancel}
        onReplace={handleDuplicateReplace}
        onKeepBoth={handleDuplicateKeepBoth}
        newBookTitle={duplicateData?.newBookTitle || ''}
        existingBook={duplicateData?.existingBook}
        matchType={duplicateData?.matchType || 'metadata'}
      />
      </Suspense>

      <Suspense fallback={null}>
      <BookInfoModal
        book={selectedBook}
        isOpen={showBookInfo}
        onClose={handleCloseBookInfo}
        onBookUpdated={loadBooks}
      />
      </Suspense>

      <Suspense fallback={null}>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={async (data) => {
          // apply immediate UI changes if needed (theme, font size)
          try {
            if (data.theme === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          } catch (err) {
            console.warn('Failed to apply theme immediately', err);
          }
        }}
      />
      </Suspense>

      {/* Central confirmation for context-menu deletes */}
      <ConfirmationModal
        isOpen={!!contextDelete}
        onClose={() => setContextDelete(null)}
        onConfirm={() => performContextDelete()}
        title="Delete Book"
        message={contextDelete ? `Are you sure you want to delete "${contextDelete.book.title}"? This will permanently remove the book.` : ''}
        confirmText="Delete Book"
        type="danger"
        isLoading={isDeletingContext}
      />

      {/* Centered toast/snackbar for undoable delete */}
      {lastDeleted && (
        <div
          className={`fixed left-1/2 transform -translate-x-1/2 bottom-24 z-60 ${toastExiting ? 'animate-toast-exit' : 'animate-toast'}`}
          role="status"
          aria-live="polite"
        >
          <div className="bg-white/95 dark:bg-stone-800/95 border border-amber-200/50 dark:border-amber-700/30 shadow-lg rounded-xl px-6 py-3 flex flex-col gap-3 w-[520px]">
            <div className="flex items-center justify-between">
              <div className="text-amber-900 dark:text-amber-100 font-medium truncate">
                Deleted "{lastDeleted.title}"
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => undoDelete(lastDeleted.id)}
                  className="px-4 py-2 bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-amber-100 rounded-lg font-medium hover:bg-amber-200 transition"
                >
                  Undo
                </button>
                <button
                  onClick={() => {
                    // Immediately finalize: find pending and clear timer then finalize immediately
                    const pending = pendingDeletes.find(p => p.book.id === lastDeleted.id);
                    if (pending) {
                      clearTimeout(pending.timerId);
                      setPendingDeletes(prev => prev.filter(p => p.book.id !== lastDeleted.id));
                    }
                    (async () => {
                      try {
                        const success = await window.db.deleteBook(lastDeleted.id);
                        if (success) {
                          await loadBooks();
                          if ((window as any).refreshBookCounts) {
                            (window as any).refreshBookCounts();
                          }
                        }
                      } catch (err) {
                        console.error('Error finalizing delete from toast:', err);
                      } finally {
                        setToastExiting(true);
                        setTimeout(() => setLastDeleted(null), 260);
                      }
                    })();
                  }}
                  className="px-3 py-2 bg-transparent text-amber-600 dark:text-amber-200 rounded-lg border border-transparent hover:bg-amber-50 transition"
                >
                  Done
                </button>
              </div>
            </div>

            <div className="toast-track">
              <div className="toast-progress" style={{ width: `${toastProgress}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Empty State Component
const EmptyState: React.FC<{
  books: BookData[];
  searchTerm: string;
  currentFilter: any;
  onImport: () => void;
  onClearSearch: () => void;
  onClearFilter: () => void;
  importing: boolean;
}> = ({ books, searchTerm, currentFilter, onImport, onClearSearch, onClearFilter, importing }) => {
  if (books.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-lg animate-fade-in">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-800 dark:to-orange-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Book size={48} className="text-amber-700 dark:text-amber-300" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 text-amber-500 animate-pulse" size={24} />
          </div>
          <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-3">
            Welcome to Your Digital Library
          </h3>
          <p className="text-amber-700/80 dark:text-amber-200/80 mb-8 leading-relaxed">
            Your library is empty, but that's about to change! Import your first EPUB books and start building your personal collection.
          </p>
          <div className="space-y-4">
            <button
              onClick={onImport}
              disabled={importing}
              className="flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg mx-auto transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload size={24} />
              <span>Import Your First Books</span>
            </button>
            <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
              Tip: You can also use <kbd className="px-2 py-1 bg-amber-100 dark:bg-amber-800 rounded text-xs font-mono">Ctrl+I</kbd> to import books
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (searchTerm) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={40} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-3">
            No books found for "{searchTerm}"
          </h3>
          <p className="text-amber-700/80 dark:text-amber-200/80 mb-6">
            Try adjusting your search terms or browse a different category
          </p>
          <div className="space-y-3">
            <button
              onClick={onClearSearch}
              className="px-6 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-all duration-200 font-medium"
            >
              Clear Search
            </button>
            <p className="text-sm text-amber-600/70 dark:text-amber-400/70">
              or try a different search term
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md animate-fade-in">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Filter size={40} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-3">
          No books in {currentFilter.label}
        </h3>
        <p className="text-amber-700/80 dark:text-amber-200/80 mb-6">
          {currentFilter.type === 'status' 
            ? `You don't have any ${currentFilter.value.replace('_', ' ')} books yet.`
            : currentFilter.type === 'folder'
            ? `This folder is currently empty.`
            : 'Try selecting a different category.'
          }
        </p>
        <button
          onClick={onClearFilter}
          className="px-6 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all duration-200 font-medium"
        >
          View All Books
        </button>
      </div>
    </div>
  );
};

// BookCard Component
const BookCard: React.FC<{ 
  book: BookData;
  onClick: (book: BookData, event: React.MouseEvent) => void;
  onOpenContextMenu: (book: BookData, position: { x: number; y: number }) => void;
  animationDelay?: number;
  viewMode: ViewMode;
  revealedIdsRef: React.MutableRefObject<Set<number>>;
  prefersReducedMotion: boolean;
  filterVersion: number;
  folderName?: string;
}> = ({ book, onClick, onOpenContextMenu, animationDelay = 0, viewMode, revealedIdsRef, prefersReducedMotion, filterVersion, folderName }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // hover state removed (unused)

  const reveal = useCallback(() => {
    if (isVisible) return;
    // Ensure the hidden state is painted before switching to visible to allow CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
        revealedIdsRef.current.add(book.id);
      });
    });
  }, [book.id, isVisible, revealedIdsRef]);
  
  useEffect(() => {
    const loadCoverData = async () => {
      if (book.cover_path && !imageError) {
        try {
          const dataUrl = await window.db.getCoverData(book.cover_path);
          if (dataUrl) {
            setCoverDataUrl(dataUrl);
          } else {
            setImageError(true);
          }
        } catch (error) {
          console.error('Error loading cover data:', error);
          setImageError(true);
        }
      }
    };
    
    loadCoverData();
  }, [book.cover_path, book.title, imageError]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reading': return 'bg-blue-500';
      case 'finished': return 'bg-green-500';
      case 'on_hold': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'reading': return 'Reading';
      case 'finished': return 'Finished';
      case 'on_hold': return 'On Hold';
      default: return 'Unread';
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenContextMenu(book, { x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.button === 2) return;
    onClick(book, e);
  };

  // Observe visibility for on-scroll reveal, with persistence per book id
  useEffect(() => {
    // On category switch, force re-animation by resetting local visibility and removing id from revealed set
    if (revealedIdsRef.current.has(book.id)) {
      revealedIdsRef.current.delete(book.id);
    }
    setIsVisible(false);
    // Re-run IO setup below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterVersion, book.id]);

  useEffect(() => {
    if (prefersReducedMotion) {
      reveal();
      return;
    }
    if (revealedIdsRef.current.has(book.id)) {
      setIsVisible(true);
      return;
    }
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }
    // If already in viewport at setup time, reveal immediately
    const rect = node.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
    if (inView) {
      reveal();
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          reveal();
          obs.disconnect();
          break;
        }
      }
    }, { threshold: 0.05, rootMargin: '0px 0px -5% 0px' });
    try {
      obs.observe(node);
    } catch {
      // If observe fails for any reason, show immediately to avoid stuck hidden items
      reveal();
      obs.disconnect();
    }
    return () => {
      obs.disconnect();
    };
  }, [book.id, prefersReducedMotion, revealedIdsRef, filterVersion, reveal]);

  if (viewMode === 'list') {
    return (
      <div 
        ref={rootRef}
  className={`group relative bg-white/60 dark:bg-stone-800/60 rounded-xl shadow-sm hover:shadow-lg transition-all duration-600 backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 cursor-pointer transform hover:scale-[1.01] p-4 will-change-transform will-change-opacity ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        style={isVisible ? { transitionDelay: `${animationDelay}ms` } : {}}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        
        title="Left-click for details, right-click for options"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-16 relative overflow-hidden rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 dark:from-stone-700 dark:to-amber-900/30 flex-shrink-0">
            {coverDataUrl && !imageError ? (
              <img
                src={coverDataUrl}
                alt={book.title}
                className="w-full h-full object-cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Book size={20} className="text-amber-600/50" />
              </div>
            )}
            <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${getStatusColor(book.status)}`}></div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 truncate mb-1" title={book.title}>
              {book.title}
            </h3>
            <p className="text-amber-700/80 dark:text-amber-200/80 text-sm truncate mb-2" title={book.author}>
              {book.author}
            </p>
            
            {book.progress > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <div className="w-16 bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-1">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${book.progress}%` }}
                  ></div>
                </div>
                <span>{book.progress.toFixed(0)}%</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
              book.status === 'reading' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' :
              book.status === 'finished' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
              book.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200'
            }`}>
              {getStatusLabel(book.status)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={rootRef}
  className={`group relative bg-white/60 dark:bg-stone-800/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-600 overflow-visible backdrop-blur-sm border border-amber-200/30 dark:border-amber-700/20 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] will-change-transform will-change-opacity ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={isVisible ? { transitionDelay: `${animationDelay}ms` } : {}}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      
      title="Left-click for details, right-click for options"
    >
      <div className="aspect-[3/4] relative overflow-hidden rounded-t-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-stone-700 dark:to-amber-900/30">
        {coverDataUrl && !imageError ? (
          <div className="relative w-full h-full">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <img
              src={coverDataUrl}
              alt={book.title}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Book size={48} className="text-amber-600/50 mx-auto mb-2 group-hover:scale-110 transition-transform duration-300" />
              <div className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium px-2 leading-tight">
                {book.title.length > 20 ? book.title.substring(0, 20) + '...' : book.title}
              </div>
            </div>
          </div>
        )}
        
        <div className={`absolute top-3 right-3 w-3 h-3 rounded-full ${getStatusColor(book.status)} shadow-lg border-2 border-white/50 ${book.status === 'reading' ? 'animate-pulse' : ''}`}></div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-4">
          <div className="bg-white/95 dark:bg-stone-800/95 rounded-lg px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300 shadow-lg">
            <div>Left-click: Details</div>
            <div>Right-click: Options</div>
          </div>
        </div>

        {book.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
              style={{ width: `${book.progress}%` }}
            ></div>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 text-sm leading-tight mb-1 truncate transition-colors duration-200 group-hover:text-amber-700 dark:group-hover:text-amber-200" title={book.title}>
          {book.title}
        </h3>
        <p className="text-amber-700/80 dark:text-amber-200/80 text-xs mb-3 truncate transition-colors duration-200 group-hover:text-amber-600 dark:group-hover:text-amber-300" title={book.author}>
          {book.author}
        </p>
        
        {book.progress > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70 font-medium">
                {book.progress.toFixed(0)}% complete
              </span>
            </div>
            <div className="w-full bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-2 shadow-inner">
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${book.progress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {book.folder_id && folderName && (
          <div className="text-xs text-amber-600/70 dark:text-amber-400/70 flex items-center gap-1 animate-fade-in">
            <Folder size={12} />
            <span>In folder</span>
            <span
              className="truncate max-w-[10rem] text-amber-700 dark:text-amber-300"
              title={folderName}
            >
              {folderName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BooksGrid;

//TODO fix the NaN/on hold not working