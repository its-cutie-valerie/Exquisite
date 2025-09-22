// src/components/DuplicateWarningDialog.tsx (Fixed with proper event handling)
import React from 'react';
import { AlertTriangle, Book, User } from 'lucide-react';

interface ExistingBook {
  title: string;
  author: string;
  id: number;
}

interface DuplicateWarningDialogProps {
  isOpen: boolean;
  visible?: boolean; // controls fade in/out while mounted
  title: string;
  message: string;
  existingBook?: ExistingBook;
  matchType?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

const DuplicateWarningDialog: React.FC<DuplicateWarningDialogProps> = ({
  isOpen,
  visible = true,
  title,
  message,
  existingBook,
  matchType,
  onConfirm,
  onCancel,
  isProcessing = false
}) => {
  // Close on Escape (only via buttons/backdrop remains disabled here)
  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getMatchTypeColor = (type?: string) => {
    switch (type) {
      case 'gutenberg_id':
        return 'text-blue-600 dark:text-blue-400';
      case 'title_author':
        return 'text-green-600 dark:text-green-400';
      case 'title_only':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getMatchTypeLabel = (type?: string) => {
    switch (type) {
      case 'gutenberg_id':
        return 'Exact Project Gutenberg Match';
      case 'title_author':
        return 'Title & Author Match';
      case 'title_only':
        return 'Title Match';
      default:
        return 'Duplicate Detected';
    }
  };

  return (
  <div className={`fixed inset-0 z-[70] transition-opacity duration-180 ${visible ? 'opacity-100' : 'opacity-0'}`} role="dialog" aria-modal="true" aria-label="Duplicate Warning">
      {/* Backdrop - clicking here does nothing, only buttons can close */}
  <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-stone-800/30 to-orange-900/20" />
      
      {/* Dialog Container - Center the dialog but don't close on click */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div 
          className={`relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-red-950/30 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200/50 dark:border-red-700/30 transform transition-all duration-180 will-change-transform will-change-opacity ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside dialog
        >
          
          {/* Header with pulse animation on warning icon */}
          <div className="relative p-6 pb-4 border-b border-red-200/50 dark:border-red-700/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 dark:text-red-100">
                  {title}
                </h3>
                {matchType && (
                  <p className={`text-sm font-medium transition-colors duration-300 ${getMatchTypeColor(matchType)}`}>
                    {getMatchTypeLabel(matchType)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Content with staggered animations */}
          <div className="p-6 space-y-4">
            {/* Warning Message with fade-in delay */}
            <div className="bg-red-50/80 dark:bg-red-900/20 rounded-xl p-4 border border-red-200/50 dark:border-red-800/30">
              <p className="text-red-800 dark:text-red-200 text-sm leading-relaxed">
                {message}
              </p>
            </div>

            {/* Existing Book Details with slide-in animation */}
            {existingBook && (
              <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-4 border border-amber-200/50 dark:border-amber-700/30 transform hover:scale-105 transition-transform duration-200">
                <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                  <Book size={16} />
                  Book Already in Library
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-amber-700 dark:text-amber-300 min-w-12">Title:</span>
                    <span className="text-amber-900 dark:text-amber-100 flex-1 line-clamp-2">
                      {existingBook.title}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="font-medium text-amber-700 dark:text-amber-300">Author:</span>
                    <span className="text-amber-900 dark:text-amber-100">
                      {existingBook.author}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-800/30 px-2 py-1 rounded-full">
                      Book ID: #{existingBook.id}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Question with fade-in */}
            <div className="text-center pt-2">
              <p className="text-amber-800 dark:text-amber-200 font-medium">
                Do you want to import this book anyway?
              </p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                This will add another copy to your library
              </p>
            </div>
          </div>

          {/* Actions with slide-up animation */}
          <div className="p-6 pt-2 flex gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-white/70 dark:bg-stone-700/70 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-800/20 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
            >
              Cancel Import
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-xl transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <span>Import Anyway</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuplicateWarningDialog;
//TODO fix the flickering