// src/components/BookActionsDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, FolderPlus, Trash2 } from 'lucide-react';

interface Folder {
  id: number;
  name: string;
}

interface BookActionsDropdownProps {
  bookTitle: string;
  currentFolderId?: number;
  onMoveToFolder: (folderId: number | null) => void;
  onDelete: () => void;
}

const BookActionsDropdown: React.FC<BookActionsDropdownProps> = ({
  bookTitle,
  currentFolderId,
  onMoveToFolder,
  onDelete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load folders when dropdown opens
  useEffect(() => {
    if (isOpen && folders.length === 0) {
      loadFolders();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const handleMoveToFolder = (folderId: number | null) => {
    onMoveToFolder(folderId);
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${bookTitle}"? This action cannot be undone.`)) {
      onDelete();
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-full hover:bg-amber-300/50 dark:hover:bg-amber-700/50 transition-colors duration-200 opacity-0 group-hover:opacity-100"
        title="Book options"
      >
        <MoreVertical size={16} className="text-amber-700 dark:text-amber-300" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-stone-800 rounded-xl shadow-xl border border-amber-200 dark:border-amber-700/50 py-2 z-50 min-w-48 backdrop-blur-sm animate-fade-in" role="menu" aria-label="Book actions" onClick={(e) => e.stopPropagation()}>
          
          {/* Move to Folder section */}
          <div className="px-3 py-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
              <FolderPlus size={12} />
              <span>Move to Folder</span>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-1">
                {/* No folder option */}
                <button
                  onClick={() => handleMoveToFolder(null)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    currentFolderId === null || currentFolderId === undefined
                      ? 'bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200'
                      : 'hover:bg-amber-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="w-2 h-2 bg-stone-400 rounded-full"></div>
                  <span>No Folder</span>
                  {(currentFolderId === null || currentFolderId === undefined) && (
                    <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">✓</span>
                  )}
                </button>
                
                {/* Folder options */}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveToFolder(folder.id)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                      currentFolderId === folder.id
                        ? 'bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200'
                        : 'hover:bg-amber-50 dark:hover:bg-stone-700/50 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    <span className="truncate">{folder.name}</span>
                    {currentFolderId === folder.id && (
                      <span className="ml-auto text-xs text-amber-600 dark:text-amber-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Divider */}
          <div className="my-2 border-t border-amber-200 dark:border-amber-700/50"></div>
          
          {/* Delete option */}
          <button
            onClick={handleDelete}
            className="w-full text-left px-6 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors duration-200 flex items-center gap-3"
          >
            <Trash2 size={14} />
            <span>Delete Book</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BookActionsDropdown;
