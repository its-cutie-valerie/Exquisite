// Enhanced BookContextMenu Component - Polished for Tailwind v4
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, BookOpen, Pause, Folder, FolderPlus, Trash2, ChevronDown } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface Folder {
  id: number;
  name: string;
}

interface BookContextMenuProps {
  bookTitle: string;
  currentFolderId?: number;
  currentStatus: 'unread' | 'reading' | 'on_hold' | 'finished';
  position: { x: number; y: number } | null;
  onClose: () => void;
  onMoveToFolder: (folderId: number | null) => void;
  onStatusChange: (status: 'unread' | 'reading' | 'on_hold' | 'finished') => void;
  /**
   * onDelete MUST delete the book from the database and refresh the list.
   * This should be implemented in the parent (BooksGrid) and passed down.
   */
  onDelete: () => Promise<void>;
  /**
   * Request the parent to open a deletion confirmation for this book.
   * When provided, the parent will handle showing the modal and performing the delete.
   */
  onRequestDelete?: () => void;
  onOpenDetails: () => void;
}

const BookContextMenu: React.FC<BookContextMenuProps> = ({
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

  // Exclusive menu toggling - when one opens, the other closes
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
    console.log('[BookContextMenu] Delete button clicked - opening confirmation modal');
    // If parent provided a request handler, ask it to open the confirmation centrally
    if (typeof (onRequestDelete as any) === 'function') {
      console.log('[BookContextMenu] Delegating delete to parent via onRequestDelete');
      (onRequestDelete as any)();
      return;
    }

    // Fallback: if the nicer modal path is failing, allow a quick native confirm to test deletion
    try {
      const confirmed = window.confirm(`Delete "${bookTitle}"? This will permanently remove the book.`);
      if (confirmed) {
        console.log('[BookContextMenu] Native confirm accepted - calling onDelete directly');
        // call onDelete directly; parent should handle refreshing
        (async () => {
          try {
            await onDelete();
            onClose();
          } catch (err) {
            console.error('[BookContextMenu] Error in fallback onDelete:', err);
          }
        })();
        return;
      }
    } catch (err) {
      console.error('[BookContextMenu] Native confirm failed:', err);
    }

    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    console.log('[BookContextMenu] handleDeleteConfirm called');
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

  // Smart positioning with fixed width to prevent jumping
  const getMenuPosition = () => {
    if (!position) return { left: 0, top: 0 };

    const menuWidth = 220; // Slightly smaller fixed width
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
  return { icon: BookOpen, label: 'Finished', color: 'text-green-600 dark:text-green-400' };
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Context Menu - No title, fixed width to prevent jumping */}
      <div
        ref={menuRef}
        className="fixed z-50 bg-white/95 dark:bg-stone-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-amber-200/50 dark:border-amber-700/30 py-2 context-menu-animation overflow-hidden"
        style={{ 
          left: menuPosition.left, 
          top: menuPosition.top,
          width: '220px', // Fixed width prevents jumping
          transformOrigin: position.x < window.innerWidth / 2 ? 'top left' : 'top right'
        }}
      >
        {/* View Details - First option, no header needed */}
        <button
          onClick={() => { onOpenDetails(); onClose(); }}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50/80 dark:hover:bg-amber-900/20 text-amber-800 dark:text-amber-200 transition-colors duration-200 flex items-center gap-3 font-medium"
        >
          <BookOpen size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>View Details</span>
        </button>

        {/* Divider */}
        <div className="my-1 border-t border-amber-200/30 dark:border-amber-700/20"></div>

        {/* Change Status Button */}
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

        {/* Status Submenu */}
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

        {/* Move to Folder Button */}
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

        {/* Scrollable Folder Submenu */}
        {showFolders && (
          <div className="ml-6 mr-2 mb-2 menu-fade-in">
            <div className="max-h-32 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="space-y-1 pr-2">
                  {/* No folder option */}
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
                  
                  {/* Folder options */}
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

        {/* Divider */}
        <div className="my-1 border-t border-amber-200/30 dark:border-amber-700/20"></div>

        {/* Delete Button */}
        <button
          onClick={handleDeleteClick}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50/80 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors duration-200 flex items-center gap-3"
        >
          <Trash2 size={16} className="flex-shrink-0" />
          <span>Delete Book</span>
        </button>
      </div>

      {/* Enhanced Confirmation Modal Integration */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(false);
          }}
        >
          <div
            className="relative z-10"
            onClick={e => e.stopPropagation()}
          >
            <ConfirmationModal
              isOpen={true}
              onClose={() => setShowDeleteConfirm(false)}
              onConfirm={() => {
                console.log('[BookContextMenu] ConfirmationModal onConfirm called');
                handleDeleteConfirm();
              }}
              title="Delete Book"
              message={`Are you sure you want to delete "${bookTitle}"? This will permanently remove the book and its files from your library. This action cannot be undone.`}
              confirmText="Delete Book"
              type="danger"
              isLoading={isDeleting}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default BookContextMenu;
