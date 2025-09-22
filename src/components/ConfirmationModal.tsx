// src/components/ConfirmationModal.tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  type?: 'danger' | 'warning';
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  type = 'danger',
  isLoading = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    console.log('[ConfirmationModal] render - isOpen =', isOpen, 'isLoading =', isLoading);
  }, [isOpen, isLoading]);

  // Click handling is managed on the container via onMouseDown/onClick to avoid jumpy behavior.

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

  if (!isOpen) return null;

  const isDanger = type === 'danger';

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[9999] animate-fade-in p:4"
      role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={(e) => {
        // mark if the mousedown started on the backdrop (not on the modal)
        pointerDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if both mousedown and click happened on the backdrop
        const clickOnBackdrop = e.target === e.currentTarget;
        if (clickOnBackdrop && pointerDownOnBackdrop.current) {
          if (!isLoading) onClose();
        }
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-red-800/15 to-orange-900/20 backdrop-blur-sm"></div>
      
      <div 
        ref={modalRef}
        className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-red-900/30 rounded-3xl shadow-2xl w-full max-w-sm mx-4 animate-scale-in border border-amber-200/50 dark:border-red-700/30"
        onClick={(e) => { e.stopPropagation(); console.log('[ConfirmationModal] inner modal clicked'); }}
        role="dialog"
        aria-modal="true"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Header */}
        <div className="relative p-6 pb-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute top-4 right-4 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-1 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 disabled:opacity-50"
          >
            <X size={18} />
          </button>
          
          <div className="flex items-center justify-center mb-4">
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl mb-3 ${
              isDanger 
                ? 'bg-gradient-to-br from-red-500 to-red-600 dark:from-red-600 dark:to-red-700'
                : 'bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700'
            }`}>
              {isDanger ? (
                <Trash2 size={28} className="text-white" />
              ) : (
                <AlertTriangle size={28} className="text-white" />
              )}
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-center text-amber-900 dark:text-amber-100 mb-2">
            {title}
          </h3>
          <p className="text-sm text-amber-700/80 dark:text-amber-200/80 text-center leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Buttons */}
        <div className="px-6 pb-6">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDown={() => console.log('[ConfirmationModal] confirm mousedown')}
              onClick={(e) => { e.stopPropagation(); console.log('[ConfirmationModal] confirm clicked'); onConfirm(); }}
              disabled={isLoading}
              style={{ pointerEvents: 'auto' }}
              className={`flex-1 px-4 py-3 rounded-2xl transition-all duration-200 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                isDanger
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Please wait...</span>
                </>
              ) : (
                <span>{confirmText}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ConfirmationModal;
