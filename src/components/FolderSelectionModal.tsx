// src/components/FolderSelectionModal.tsx
import React, { useState } from 'react';
import { X, Folder, FolderPlus, Search, Check } from 'lucide-react';

interface Folder {
  id: number;
  name: string;
}

interface FolderSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  currentFolderId?: number;
  onFolderSelect: (folderId: number | null) => void;
  bookTitle: string;
}

const FolderSelectionModal: React.FC<FolderSelectionModalProps> = ({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onFolderSelect,
  bookTitle
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFolderSelect = (folderId: number | null) => {
    onFolderSelect(folderId);
    onClose();
  };

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-60 animate-fade-in p-4" role="dialog" aria-modal="true" aria-label="Folder Selection">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      
  <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-900/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-amber-200/50 dark:border-amber-700/30 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-amber-200/50 dark:border-amber-700/30">
          <div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">Add to Folder</h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-200/80 mt-1 truncate">
              "{bookTitle}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-2 hover:bg-amber-100/50 dark:hover:bg-amber-800/30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-amber-200/50 dark:border-amber-700/30">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-600/60" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/70 dark:bg-stone-700/70 border border-amber-200 dark:border-amber-700/50 rounded-xl text-sm focus:ring-2 focus:ring-amber-300/50 focus:border-amber-400 dark:text-amber-50 transition-all duration-200"
            />
          </div>
        </div>

        {/* Folder List */}
        <div className="max-h-96 overflow-y-auto p-2">
          
          {/* No Folder Option */}
          <button
            onClick={() => handleFolderSelect(null)}
            className={`w-full flex items-center justify-between p-4 rounded-xl mb-2 transition-all duration-200 ${
              currentFolderId === null || currentFolderId === undefined
                ? 'bg-amber-200/70 dark:bg-amber-800/50 text-amber-900 dark:text-amber-100'
                : 'hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center">
                <Folder size={16} className="text-white" />
              </div>
              <span className="font-medium">No Folder</span>
            </div>
            {(currentFolderId === null || currentFolderId === undefined) && (
              <Check size={18} className="text-amber-600 dark:text-amber-400" />
            )}
          </button>

          {/* Divider */}
          {filteredFolders.length > 0 && (
            <div className="border-t border-amber-200/50 dark:border-amber-700/30 my-2"></div>
          )}

          {/* Folder Options */}
          {filteredFolders.length > 0 ? (
            filteredFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleFolderSelect(folder.id)}
                className={`w-full flex items-center justify-between p-4 rounded-xl mb-2 transition-all duration-200 ${
                  currentFolderId === folder.id
                    ? 'bg-amber-200/70 dark:bg-amber-800/50 text-amber-900 dark:text-amber-100'
                    : 'hover:bg-amber-100/50 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Folder size={16} className="text-white" />
                  </div>
                  <span className="font-medium truncate">{folder.name}</span>
                </div>
                {currentFolderId === folder.id && (
                  <Check size={18} className="text-amber-600 dark:text-amber-400" />
                )}
              </button>
            ))
          ) : searchTerm && (
            <div className="text-center py-8 text-amber-700/60 dark:text-amber-300/60">
              <Folder size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No folders found for "{searchTerm}"</p>
            </div>
          )}

          {/* Empty State */}
          {folders.length === 0 && !searchTerm && (
            <div className="text-center py-8 text-amber-700/60 dark:text-amber-300/60">
              <FolderPlus size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No folders created yet</p>
              <p className="text-xs mt-1">Create folders from the sidebar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FolderSelectionModal;
