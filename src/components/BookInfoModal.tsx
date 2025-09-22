// src/components/BookInfoModal.tsx (Polished version)
import { useState, useEffect, useRef } from 'react';
import { X, Book, Play, Clock, User, Calendar, FileText, Package, Globe, Hash, BarChart3, FolderPlus, Trash2, BookOpen, Pause, RotateCcw, CheckCircle } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import FolderSelectionModal from './FolderSelectionModal';
import BookReader from './BookReader';

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
  folder_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface Folder {
  id: number;
  name: string;
}

interface BookInfoModalProps {
  book: BookData | null;
  isOpen: boolean;
  onClose: () => void;
  onBookUpdated: () => void;
}

// BookDescription component stays the same
const BookDescription: React.FC<{ description: string }> = ({ description }) => {
  const hasHtmlTags = (text: string) => /<[^>]*>/g.test(text);
  
  const hasMarkdown = (text: string) => {
    const markdownPatterns = [
      /\*\*.*?\*\*/g, /\*.*?\*/g, /_.*?_/g, /`.*?`/g,
      /^#+\s/gm, /^\*\s/gm, /^\d+\.\s/gm, /\[.*?\]\(.*?\)/g,
    ];
    return markdownPatterns.some(pattern => pattern.test(text));
  };

  const markdownToHtml = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-amber-900 dark:text-amber-100 mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-amber-900 dark:text-amber-100 mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-4 mb-2">$1</h1>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/^\* (.*)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.*)$/gm, '<li class="ml-4">$1</li>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline">$1</a>');
  };

  const sanitizeHtml = (html: string) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
  };

  const renderContent = () => {
    if (hasHtmlTags(description)) {
      const sanitized = sanitizeHtml(description);
      return (
        <div 
          className="prose prose-amber dark:prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    } else if (hasMarkdown(description)) {
      const htmlContent = markdownToHtml(description);
      const wrapped = `<p class="mb-4">${htmlContent}</p>`;
      return (
        <div 
          className="prose prose-amber dark:prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(wrapped) }}
        />
      );
    } else {
      return (
        <div className="whitespace-pre-wrap leading-relaxed">
          {description}
        </div>
      );
    }
  };

  return renderContent();
};

const BookInfoModal: React.FC<BookInfoModalProps> = ({ book, isOpen, onClose, onBookUpdated }) => {
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Local book state for immediate UI updates
  const [localBook, setLocalBook] = useState<BookData | null>(null);
  
  // Modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFolderSelection, setShowFolderSelection] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReader, setShowReader] = useState(false);
  
  // Focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Update local book state when book prop changes
  useEffect(() => {
    setLocalBook(book);
  }, [book]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus the modal when it opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
      
      // Prevent background scrolling and hide background scrollbars
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Load cover and folder data when modal opens
  useEffect(() => {
    if (isOpen && book) {
      loadCoverData();
      loadFolders();
      setImageError(false);
    }
  }, [isOpen, book]);

  const loadCoverData = async () => {
    if (book?.cover_path) {
      try {
        const dataUrl = await window.db.getCoverData(book.cover_path);
        if (dataUrl) {
          setCoverDataUrl(dataUrl);
        } else {
          setImageError(true);
        }
      } catch (error) {
        console.error('Error loading cover:', error);
        setImageError(true);
      }
    }
  };

  const loadFolders = async () => {
    try {
      const foldersData = await window.db.getFolders();
      setFolders(foldersData);
      
      if (book?.folder_id) {
        const folder = foldersData.find(f => f.id === book.folder_id);
        setCurrentFolder(folder || null);
      } else {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleStatusChange = async (newStatus: 'unread' | 'reading' | 'on_hold' | 'finished') => {
    if (!localBook) return;
    
    // Update local state immediately for responsive UI
    const updatedBook = {
      ...localBook,
      status: newStatus,
      progress: newStatus === 'finished' ? 100 : localBook.progress
    };
    setLocalBook(updatedBook);
    
    setIsUpdating(true);
    try {
      const success = await window.db.updateBook(localBook.id, {
        title: localBook.title,
        author: localBook.author,
        progress: newStatus === 'finished' ? 100 : localBook.progress,
        status: newStatus,
        folderId: localBook.folder_id
      });
      
      if (success) {
        onBookUpdated();
        if ((window as any).refreshBookCounts) {
          (window as any).refreshBookCounts();
        }
      } else {
        setLocalBook(book);
        alert('Failed to update book status');
      }
    } catch (error) {
      console.error('Error updating book status:', error);
      setLocalBook(book);
      alert('Error updating book status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMoveToFolder = async (folderId: number | null) => {
    if (!localBook) return;
    
    // Update local state immediately
    const updatedBook = { ...localBook, folder_id: folderId };
    setLocalBook(updatedBook);
    
    setIsUpdating(true);
    try {
      const success = await window.db.updateBook(localBook.id, {
        title: localBook.title,
        author: localBook.author,
        progress: localBook.progress,
        status: localBook.status,
        folderId: folderId
      });
      
      if (success) {
        const folder = folders.find(f => f.id === folderId);
        setCurrentFolder(folder || null);
        onBookUpdated();
      } else {
        setLocalBook(book);
        alert('Failed to move book to folder');
      }
    } catch (error) {
      console.error('Error moving book:', error);
      setLocalBook(book);
      alert('Error moving book');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteBook = async () => {
    if (!localBook) return;
    
    setIsDeleting(true);
    try {
      const success = await window.db.deleteBook(localBook.id);
      
      if (success) {
        onBookUpdated();
        if ((window as any).refreshBookCounts) {
          (window as any).refreshBookCounts();
        }
        onClose();
      } else {
        alert('Failed to delete book');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Error deleting book');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'reading':
        return { icon: BookOpen, label: 'Reading', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'finished':
        return { icon: CheckCircle, label: 'Finished', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
      case 'on_hold':
        return { icon: Pause, label: 'On Hold', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' };
      default:
        return { icon: Book, label: 'Unread', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-900/30' };
    }
  };

  if (!isOpen || !localBook) return null;

  const statusInfo = getStatusInfo(localBook.status);
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <div 
        className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-modal-title"
        onKeyDown={handleKeyDown}
      >
        <div 
          className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-orange-800/15 to-red-900/20 backdrop-blur-sm" 
          onClick={onClose}
          aria-hidden="true"
        ></div>
        
        <div 
          ref={modalRef}
          className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-900/50 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] mx-4 animate-scale-in border border-amber-200/50 dark:border-amber-700/30 overflow-hidden flex flex-col"
        >
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-amber-200/50 dark:border-amber-700/30 flex-shrink-0">
            <h2 
              id="book-modal-title"
              className="text-2xl font-bold text-amber-900 dark:text-amber-100"
            >
              Book Details
            </h2>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors rounded-full p-2 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* Left Column - Cover and Actions */}
            <div className="w-1/3 border-r border-amber-200/50 dark:border-amber-700/30 flex flex-col">
              
              {/* Cover and Main Actions - Scrollable if needed */}
              <div className="flex-1 p-6 flex flex-col overflow-y-hidden">
                
                {/* Cover Image */}
                <div className="aspect-[3/4] relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-stone-700 dark:to-amber-900/30 mb-4 shadow-lg flex-shrink-0 group">
                  {coverDataUrl && !imageError ? (
                    <img
                      src={coverDataUrl}
                      alt={`Cover of ${localBook.title}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <Book size={64} className="text-amber-600/50 mx-auto mb-4" />
                        <div className="text-sm text-amber-600/70 dark:text-amber-400/70 font-medium px-4 line-clamp-3">
                          {localBook.title}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="flex gap-2 mb-4 flex-shrink-0">
                  {/* Start Reading Button - with Sitting cat overlay */}
                  <div className="relative flex-1">
                    <img
                      src="/Sittingb.gif"
                      alt="Sitting cat"
                      className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-10 w-auto drop-shadow-sm select-none"
                    />
                    <button
                      onClick={() => setShowReader(true)}
                      disabled={isUpdating}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-semibold shadow-lg flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      aria-label="Start reading this book"
                    >
                      <Play size={16} />
                      <span className="text-sm">Read</span>
                    </button>
                  </div>

                  {/* Status Toggle Buttons - Icon only for space efficiency */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStatusChange('finished')}
                      disabled={isUpdating || localBook.status === 'finished'}
                      className={`p-2.5 rounded-xl transition-all duration-200 transform hover:scale-[1.05] active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-green-400/50 ${
                        localBook.status === 'finished'
                          ? 'bg-green-200 dark:bg-green-800/60 text-green-800 dark:text-green-200 shadow-inner'
                          : 'bg-green-100/80 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-800/40 text-green-700 dark:text-green-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                      aria-label={localBook.status === 'finished' ? 'Book is finished' : 'Mark as finished'}
                      title={localBook.status === 'finished' ? 'Finished' : 'Mark as finished'}
                    >
                      <CheckCircle size={16} />
                    </button>
                    
                    <button
                      onClick={() => handleStatusChange('unread')}
                      disabled={isUpdating || localBook.status === 'unread'}
                      className={`p-2.5 rounded-xl transition-all duration-200 transform hover:scale-[1.05] active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-gray-400/50 ${
                        localBook.status === 'unread'
                          ? 'bg-gray-200 dark:bg-gray-800/60 text-gray-800 dark:text-gray-200 shadow-inner'
                          : 'bg-gray-100/80 hover:bg-gray-200 dark:bg-gray-900/30 dark:hover:bg-gray-800/40 text-gray-700 dark:text-gray-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                      aria-label={localBook.status === 'unread' ? 'Book is unread' : 'Mark as unread'}
                      title={localBook.status === 'unread' ? 'Unread' : 'Reset to unread'}
                    >
                      <RotateCcw size={16} />
                    </button>

                    <button
                      onClick={() => handleStatusChange('on_hold')}
                      disabled={isUpdating || localBook.status === 'on_hold'}
                      className={`p-2.5 rounded-xl transition-all duration-200 transform hover:scale-[1.05] active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-yellow-400/50 ${
                        localBook.status === 'on_hold'
                          ? 'bg-yellow-200 dark:bg-yellow-800/60 text-yellow-800 dark:text-yellow-200 shadow-inner'
                          : 'bg-yellow-100/80 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-800/40 text-yellow-700 dark:text-yellow-300'
                      } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                      aria-label={localBook.status === 'on_hold' ? 'Book is on hold' : 'Put on hold'}
                      title={localBook.status === 'on_hold' ? 'On Hold' : 'Put on hold'}
                    >
                      <Pause size={16} />
                    </button>
                  </div>
                </div>

                

                {/* Status Indicator */}
                <div className={`${statusInfo.bgColor} rounded-xl p-3 border border-amber-200/30 dark:border-amber-700/20 transition-all duration-300 mb-4 flex-shrink-0`}>
                  <div className="flex items-center space-x-2">
                    <StatusIcon size={16} className={statusInfo.color} />
                    <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      {statusInfo.label}
                    </span>
                    {isUpdating && (
                      <div className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin ml-auto"></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Action Buttons at Bottom */}
              <div className="p-6 pt-0 flex-shrink-0">
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowFolderSelection(true)}
                    disabled={isUpdating}
                    className="flex-1 px-4 py-3 bg-amber-100/80 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/40 disabled:opacity-50 disabled:cursor-not-allowed text-amber-800 dark:text-amber-200 rounded-xl transition-all duration-200 font-medium flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                    aria-label="Move book to folder"
                  >
                    <FolderPlus size={16} />
                    <span className="truncate max-w-[12rem]" title={currentFolder ? `Folder: ${currentFolder.name}` : 'Choose folder'}>
                      {currentFolder?.name || 'Folder'}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isUpdating}
                    className="flex-1 px-4 py-3 bg-red-100/80 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/40 disabled:opacity-50 disabled:cursor-not-allowed text-red-800 dark:text-red-200 rounded-xl transition-all duration-200 font-medium flex items-center justify-center space-x-2 transform hover:scale-[1.02] active:scale-[0.98] shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
                    aria-label="Delete this book"
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Book Information */}
            <div className="flex-1 p-6 overflow-y-auto booksgrid-scrollbar">
              
              {/* Title and Author */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-100 mb-3 leading-tight">
                  {localBook.title}
                </h1>
                <p className="text-xl text-amber-700 dark:text-amber-300 flex items-center space-x-2">
                  <User size={20} />
                  <span>{localBook.author}</span>
                </p>
              </div>

              {/* Progress Bar */}
              <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <BarChart3 size={20} className="text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-amber-900 dark:text-amber-100">Reading Progress</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-amber-200/50 dark:bg-amber-800/30 rounded-full h-3 shadow-inner">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${Math.min(Math.max(localBook.progress, 0), 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300 min-w-[48px] text-right">
                    {localBook.progress.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Description */}
              {localBook.description && (
                <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 mb-6">
                  <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-100 mb-3 flex items-center space-x-2">
                    <FileText size={20} />
                    <span>Description</span>
                  </h3>
                  <div className="text-amber-800/90 dark:text-amber-200/90 leading-relaxed max-h-48 overflow-y-auto booksgrid-scrollbar">
                    <BookDescription description={localBook.description} />
                  </div>
                </div>
              )}

              {/* Book Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {localBook.publisher && (
                  <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Package size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">Publisher</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-200">{localBook.publisher}</p>
                  </div>
                )}

                {localBook.language && (
                  <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Globe size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">Language</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-200">{localBook.language.toUpperCase()}</p>
                  </div>
                )}

                {localBook.published_date && (
                  <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">Published</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-200">{localBook.published_date}</p>
                  </div>
                )}

                {localBook.isbn && (
                  <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Hash size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">ISBN</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-200 font-mono text-sm">{localBook.isbn}</p>
                  </div>
                )}

                <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText size={16} className="text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">File Size</span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-200">{formatFileSize(localBook.file_size)}</p>
                </div>

                <div className="bg-white/60 dark:bg-stone-700/40 rounded-xl p-4 border border-amber-200/30 dark:border-amber-700/20 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">Added</span>
                  </div>
                  <p className="text-amber-800 dark:text-amber-200">{formatDate(localBook.created_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Folder Selection Modal */}
      <FolderSelectionModal
        isOpen={showFolderSelection}
        onClose={() => setShowFolderSelection(false)}
        folders={folders}
  currentFolderId={localBook?.folder_id ?? undefined}
        onFolderSelect={handleMoveToFolder}
        bookTitle={localBook?.title || ''}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteBook}
        title="Delete Book"
        message={`Are you sure you want to delete "${localBook?.title}"? This will permanently remove the book and its files from your library. This action cannot be undone.`}
        confirmText="Delete Book"
        type="danger"
        isLoading={isDeleting}
      />

      <BookReader
        book={localBook}
        isOpen={showReader}
        onClose={async () => {
          setShowReader(false);
          // Fetch the latest book from DB and update localBook (fallback: getBooks)
          if (localBook?.id && window.db && window.db.getBooks) {
            const allBooks = await window.db.getBooks();
            const latest = allBooks.find((b: any) => b.id === localBook.id);
            if (latest) setLocalBook(latest);
          }
          setTimeout(onBookUpdated, 0); // Still notify parent to refresh grid
        }}
        onProgressUpdate={(progress) => {
          setLocalBook(prev => {
            if (!prev) return prev;
            let newStatus: 'unread' | 'reading' | 'on_hold' | 'finished' = prev.status;
            if (progress >= 100) {
              newStatus = 'finished';
            } else if (progress > 0) {
              newStatus = 'reading';
            }
            return { ...prev, progress, status: newStatus };
          });
        }}
      />
    </>
  );
};

export default BookInfoModal;
