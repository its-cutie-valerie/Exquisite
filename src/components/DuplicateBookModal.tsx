// src/components/DuplicateBookModal.tsx
import React from 'react';
import { X, AlertCircle, Book, Calendar, User } from 'lucide-react';

interface DuplicateBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplace: () => void;
  onKeepBoth: () => void;
  newBookTitle: string;
  existingBook: {
    id: number;
    title: string;
    author: string;
    created_at: string;
    folder_id?: number;
    cover_path?: string;
  };
  matchType: 'file' | 'metadata' | 'title';
}

const DuplicateBookModal: React.FC<DuplicateBookModalProps> = ({
  isOpen,
  onClose,
  onReplace,
  onKeepBoth,
  newBookTitle,
  existingBook,
  matchType,
}) => {
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

  const getMatchTypeMessage = () => {
    switch (matchType) {
      case 'file':
        return 'This exact file is already in your library';
      case 'metadata':
        return 'A book with the same title and author is already in your library';
      case 'title':
        return 'A book with the same title is already in your library';
      default:
        return 'This book might already be in your library';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in p-4"
      role="dialog" aria-modal="true" aria-label="Duplicate Book"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-orange-800/15 to-red-900/20 backdrop-blur-sm animate-fade-in"></div>
      
  <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-900/50 rounded-3xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in border border-amber-200/50 dark:border-amber-700/30">
        
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-1 hover:bg-amber-100/50 dark:hover:bg-amber-800/30"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 dark:from-orange-600 dark:to-red-700 rounded-3xl flex items-center justify-center shadow-xl mb-3">
              <AlertCircle size={28} className="text-white" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-center text-amber-900 dark:text-amber-100 mb-2">
            Duplicate Book Found
          </h3>
          <p className="text-sm text-amber-700/80 dark:text-amber-200/80 text-center leading-relaxed">
            {getMatchTypeMessage()}
          </p>
        </div>
        
        {/* Book Comparison */}
        <div className="px-6 pb-2">
          <div className="grid grid-cols-1 gap-4">
            {/* New Book */}
            <div className="bg-white/60 dark:bg-stone-700/40 rounded-2xl p-4 border-2 border-green-200 dark:border-green-700/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">New Import</span>
              </div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                {newBookTitle}
              </h4>
            </div>

            {/* Existing Book */}
            <div className="bg-white/60 dark:bg-stone-700/40 rounded-2xl p-4 border-2 border-amber-200 dark:border-amber-700/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">In Library</span>
              </div>
              
              <div className="flex gap-3">
                {/* Cover thumbnail */}
                <div className="w-12 h-16 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-stone-600 dark:to-amber-800/30 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {existingBook.cover_path ? (
                    <img
                      src={`file://${existingBook.cover_path}`}
                      alt={existingBook.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <Book size={20} className={`text-amber-600/50 ${existingBook.cover_path ? 'hidden' : ''}`} />
                </div>
                
                {/* Book details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1 truncate">
                    {existingBook.title}
                  </h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-xs text-amber-700/80 dark:text-amber-200/80">
                      <User size={12} />
                      <span className="truncate">{existingBook.author}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-700/80 dark:text-amber-200/80">
                      <Calendar size={12} />
                      <span>Added {formatDate(existingBook.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="p-6">
          <div className="flex flex-col gap-3">
            <button
              onClick={onReplace}
              className="w-full px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl transition-all duration-200 font-medium shadow-lg flex items-center justify-center space-x-2"
            >
              <AlertCircle size={18} />
              <span>Replace Existing Book</span>
            </button>
            
            <button
              onClick={onKeepBoth}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl transition-all duration-200 font-medium shadow-lg flex items-center justify-center space-x-2"
            >
              <Book size={18} />
              <span>Keep Both Books</span>
            </button>
            
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium"
            >
              Cancel Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateBookModal;
