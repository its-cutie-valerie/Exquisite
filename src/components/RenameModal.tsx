// src/components/RenameModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Sparkles } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
  title: string;
  isLoading?: boolean;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentName,
  title,
  isLoading = false,
}) => {
  const [newName, setNewName] = useState(currentName);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, currentName]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      if (!isLoading) {
        onClose();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName.trim() !== currentName && !isLoading) {
      onRename(newName.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in p-4"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/15 via-orange-800/10 to-red-900/15 backdrop-blur-sm"></div>
      
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-900/50 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-amber-200/50 dark:border-amber-700/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-1 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 disabled:opacity-50"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 rounded-3xl flex items-center justify-center shadow-xl mb-3">
              <Edit3 size={28} className="text-white" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-center text-amber-900 dark:text-amber-100 mb-2">
            {title}
          </h3>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="mb-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-6 py-4 bg-white/90 dark:bg-stone-700/70 border-2 border-amber-200 dark:border-amber-700/50 rounded-2xl focus:ring-4 focus:ring-amber-300/40 focus:border-amber-400 dark:focus:border-amber-500 dark:text-amber-50 transition-all duration-300 text-center font-medium shadow-inner text-lg"
                disabled={isLoading}
                maxLength={50}
                autoComplete="off"
              />
            </div>
            <div className="flex justify-between items-center mt-3 px-2">
              <span className="text-xs text-amber-600/70 dark:text-amber-300/70 font-medium">
                {newName.length}/50 characters
              </span>
            </div>
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-4 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || newName.trim() === currentName || isLoading}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-600 dark:hover:to-orange-600 text-white rounded-2xl transition-all duration-200 font-medium shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Rename</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameModal;
