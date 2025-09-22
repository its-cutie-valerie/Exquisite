// src/components/NewFolderModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Leaf, Sparkles } from 'lucide-react';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated: () => void;
}

const NewFolderModal: React.FC<NewFolderModalProps> = ({ isOpen, onClose, onFolderCreated }) => {
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle clicking outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      if (!isSubmitting) {
        handleClose();
      }
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus the input when modal opens
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select any existing text
        }
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        console.log('Creating folder:', folderName);
        if (typeof window !== 'undefined' && window.db) {
          const newFolder = await window.db.addFolder(folderName.trim());
          console.log('Folder creation result:', newFolder);
          if (newFolder && newFolder.id) {
            setFolderName('');
            // Call the global refresh function if it exists
            if ((window as any).refreshFolders) {
              await (window as any).refreshFolders();
            }
            onFolderCreated(); // This will close modal
            console.log('Folder created successfully');
          } else {
            console.log('Folder creation returned null - likely duplicate name');
            alert('A folder with that name already exists. Please choose another name.');
            // Refocus input after alert
            setTimeout(() => {
              if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
              }
            }, 100);
          }
        } else {
          console.error('Database API not available for folder creation');
          alert('Unable to create folder. Database not available.');
        }
      } catch (error) {
        console.error('Error in handleSubmit:', error);
        const msg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message as string : String(error);
        alert(`Error creating folder: ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFolderName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in p-4"
      role="dialog" aria-modal="true" aria-label="Create New Folder"
      onClick={handleBackdropClick} // Click outside to close
    >
      {/* More subtle background overlay - content still visible but muted */}
  <div className="absolute inset-0 bg-gradient-to-br from-amber-900/15 via-orange-800/10 to-red-900/15 backdrop-blur-sm animate-fade-in"></div>
      
      {/* Floating autumn leaves animation - more subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 text-amber-500/10 animate-bounce" style={{ animationDelay: '0s', animationDuration: '4s' }}>
          <Leaf size={20} className="transform rotate-12" />
        </div>
        <div className="absolute top-1/3 right-1/3 text-orange-400/10 animate-bounce" style={{ animationDelay: '1s', animationDuration: '5s' }}>
          <Leaf size={24} className="transform -rotate-45" />
        </div>
        <div className="absolute bottom-1/4 left-1/3 text-red-400/10 animate-bounce" style={{ animationDelay: '2s', animationDuration: '6s' }}>
          <Leaf size={20} className="transform rotate-90" />
        </div>
        <div className="absolute top-1/2 right-1/4 text-amber-600/8 animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '4.5s' }}>
          <Sparkles size={16} />
        </div>
        <div className="absolute bottom-1/3 right-1/2 text-orange-500/8 animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '5.5s' }}>
          <Leaf size={18} className="transform -rotate-12" />
        </div>
      </div>

      {/* Modal content - prevent click propagation */}
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-900/50 rounded-3xl shadow-2xl w-full max-w-md mx-4 animate-scale-in border border-amber-200/50 dark:border-amber-700/30 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on modal
      >
        
        {/* Cute decorative elements on modal */}
        <div className="absolute -top-3 -right-2 text-amber-600 dark:text-amber-400 opacity-80">
          <Leaf size={20} className="transform rotate-12" />
        </div>
        <div className="absolute -top-1 -left-3 text-orange-500 dark:text-orange-400 opacity-60">
          <Leaf size={16} className="transform -rotate-45" />
        </div>
        <div className="absolute top-4 right-8 text-red-500/40 dark:text-red-400/40">
          <Leaf size={12} className="transform rotate-90" />
        </div>

        {/* Header */}
        <div className="relative p-6 pb-2">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="absolute top-4 right-4 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-1 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 disabled:opacity-50 z-10"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 rounded-3xl flex items-center justify-center shadow-xl mb-3 relative">
              <div className="text-4xl">📁</div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-400 to-red-500 rounded-full flex items-center justify-center">
                <Leaf size={12} className="text-red-50" />
              </div>
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-center text-amber-900 dark:text-amber-100 mb-2">
            Create New Folder
          </h3>
          <p className="text-sm text-amber-700/80 dark:text-amber-200/80 text-center">
            Name your cozy reading collection 🍂
          </p>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6">
          <div className="mb-6">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Autumn Reads..."
                className="w-full px-6 py-4 pl-14 bg-white/90 dark:bg-stone-700/70 border-2 border-amber-200 dark:border-amber-700/50 rounded-2xl focus:ring-4 focus:ring-amber-300/40 focus:border-amber-400 dark:focus:border-amber-500 dark:text-amber-50 transition-all duration-300 placeholder-amber-600/60 dark:placeholder-amber-300/60 text-center font-medium shadow-inner text-lg"
                disabled={isSubmitting}
                maxLength={50}
                autoComplete="off"
              />
              <div className="absolute left-5 top-1/2 transform -translate-y-1/2 text-amber-600 dark:text-amber-400">
                <Leaf size={20} />
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 px-2">
              <span className="text-xs text-amber-600/70 dark:text-amber-300/70 font-medium">
                {folderName.length}/50 characters
              </span>
              {folderName.length > 0 && (
                <span className="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                  <Sparkles size={14} />
                  Perfect!
                </span>
              )}
            </div>
          </div>
          
          {/* Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-4 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              Not Now
            </button>
            <button
              type="submit"
              disabled={!folderName.trim() || isSubmitting}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-600 dark:hover:to-orange-600 text-white rounded-2xl transition-all duration-200 font-medium shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Cute bottom decoration */}
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 opacity-40">
          <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default NewFolderModal;
