// src/components/ProjectGutenbergModal.tsx (FIXED - No more flickering)
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Download, Book, TrendingUp, Globe, Tag, Eye, ArrowLeft } from 'lucide-react';
import DuplicateWarningDialog from './DuplicateWarningDialog';

interface GutenbergBook {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  languages: string[];
  download_count: number;
  formats: { [key: string]: string };
  bookshelves: string[];
}

interface ProjectGutenbergModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (bookUrl: string, bookData: GutenbergBook) => Promise<void>;
  isImporting?: boolean;
}

interface DuplicateDialogState {
  book: GutenbergBook;
  epubUrl: string;
  duplicateInfo: {
    message: string;
    existingBook?: any;
    matchType?: string;
  };
}

const ProjectGutenbergModal: React.FC<ProjectGutenbergModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isImporting = false,
}) => {
  const [view, setView] = useState<'browse' | 'search' | 'detail'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [popularBooks, setPopularBooks] = useState<GutenbergBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GutenbergBook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateDialog, setDuplicateDialog] = useState<DuplicateDialogState | null>(null);
  const [duplicateVisible, setDuplicateVisible] = useState<boolean>(false);

  // Local mount/visibility for smooth enter/exit without flicker
  const [mounted, setMounted] = useState<boolean>(isOpen);
  const [visible, setVisible] = useState<boolean>(false);

  const [categories] = useState([
    'Fiction', 'Literature', 'Philosophy', 'History', 'Science',
    'Poetry', 'Biography', 'Religion', 'Politics', 'Adventure'
  ]);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // allow next frame to apply transitions
      requestAnimationFrame(() => setVisible(true));
      loadPopularBooks();
    } else {
      // start exit
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    if (isImporting) return; // prevent while importing
    setVisible(false);
    // delay notifying parent until after exit transition
    setTimeout(() => {
      onClose();
    }, 250);
  };

  // Click outside / Escape (disabled when duplicate dialog is shown)
  useEffect(() => {
    if (!mounted || duplicateDialog) return;

    const onMouseDown = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mounted, duplicateDialog, isImporting]);

  const loadPopularBooks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://gutendex.com/books/?sort=popular');
      const data = await response.json();
      setPopularBooks(data.results.slice(0, 12));
    } catch (err) {
      setError('Failed to load popular books. Please try again.');
      console.error('Error loading popular books:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchBooks = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSearchResults(data.results);
      setView('search');
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Error searching books:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchByCategory = async (category: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`https://gutendex.com/books/?topic=${encodeURIComponent(category.toLowerCase())}`);
      const data = await response.json();
      setSearchResults(data.results);
      setView('search');
    } catch (err) {
      setError('Failed to load category books. Please try again.');
      console.error('Error loading category:', err);
    } finally {
      setLoading(false);
    }
  };

  const viewBookDetails = (book: GutenbergBook) => {
    setSelectedBook(book);
    setView('detail');
  };

  const handleImportBook = async (book: GutenbergBook) => {
    const epubUrl = book.formats['application/epub+zip'];
    if (!epubUrl) {
      setError('EPUB format not available for this book.');
      return;
    }

    setError('');

    try {
      const duplicateCheck = await (window as any).db.checkComprehensiveDuplicate({
        title: book.title,
        author: book.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author',
        gutenbergId: book.id
      });

      if (duplicateCheck.isDuplicate) {
        setDuplicateDialog({
          book,
          epubUrl,
          duplicateInfo: {
            message: duplicateCheck.message,
            existingBook: duplicateCheck.existingBook,
            matchType: duplicateCheck.matchType
          }
        });
        requestAnimationFrame(() => setDuplicateVisible(true));
        return;
      }

      await proceedWithImport(epubUrl, book);
      
    } catch (err) {
      setError('Failed to import book. Please try again.');
      console.error('Error importing book:', err);
    }
  };

  const proceedWithImport = async (epubUrl: string, book: GutenbergBook) => {
    try {
      await onImport(epubUrl, book);
      onClose();
    } catch (err) {
      setError('Failed to import book. Please try again.');
      console.error('Error importing book:', err);
      throw err;
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateDialog) return;

    try {
  await proceedWithImport(duplicateDialog.epubUrl, duplicateDialog.book);
  setDuplicateVisible(false);
  setTimeout(() => setDuplicateDialog(null), 180);
    } catch (err) {
      // Error handled in proceedWithImport
    }
  };

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
  <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'} animate-fade-in`} role="dialog" aria-modal="true" aria-label="Project Gutenberg">
  <div className={`absolute inset-0 bg-gradient-to-br from-amber-900/20 via-stone-800/30 to-orange-900/20 ${duplicateDialog ? 'backdrop-blur-0' : 'backdrop-blur-sm'}`} />

        {/* Modal Container */}
        <div className="flex items-center justify-center min-h-screen p-4">
          <div
            ref={modalRef}
            className={`relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-950/30 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-amber-200/50 dark:border-amber-700/30 transform transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} animate-scale-in`}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-amber-200/50 dark:border-amber-700/30">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-amber-600/60 hover:text-amber-700 dark:text-amber-400/60 dark:hover:text-amber-300 transition-colors duration-200 rounded-full p-2 hover:bg-amber-100/50 dark:hover:bg-amber-800/30"
                disabled={isImporting}
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Globe size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">Project Gutenberg</h2>
                  <p className="text-sm text-amber-700/80 dark:text-amber-200/80">
                    Discover and import free books from the world's largest digital library
                  </p>
                </div>
              </div>

              {/* Search Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  searchBooks(searchTerm);
                }}
                className="relative"
              >
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-600/60" />
                <input
                  type="text"
                  placeholder="Search for books, authors, or topics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/70 dark:bg-stone-700/70 border border-amber-200 dark:border-amber-700/50 rounded-xl focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 dark:text-amber-50 transition-all duration-200 placeholder:text-amber-600/50 dark:placeholder:text-amber-400/50"
                  disabled={loading || isImporting}
                />
              </form>

              {/* Navigation */}
              <div className="flex items-center gap-2 mt-4">
                {view !== 'browse' && (
                  <button
                    onClick={() => setView('browse')}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-800/30 rounded-lg transition-colors duration-200"
                    disabled={isImporting}
                  >
                    <ArrowLeft size={16} />
                    Back to Browse
                  </button>
                )}
                <div className="flex items-center gap-2 text-xs text-amber-600/70 dark:text-amber-400/70 ml-auto">
                  {view === 'browse' && <span>Browse popular books and categories</span>}
                  {view === 'search' && <span>{searchResults.length} results found</span>}
                  {view === 'detail' && <span>Book details</span>}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] booksgrid-scrollbar">
              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {view === 'browse' && (
                <div className="space-y-8">
                  {/* Categories */}
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                      <Tag size={20} />
                      Browse by Category
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {categories.map((category) => (
                        <button
                          key={category}
                          onClick={() => searchByCategory(category)}
                          className="p-3 bg-white/60 dark:bg-stone-700/60 rounded-xl border border-amber-200/50 dark:border-amber-700/30 hover:bg-amber-50 dark:hover:bg-amber-800/20 transition-colors duration-200 text-left transform hover:scale-105"
                          disabled={loading || isImporting}
                        >
                          <div className="font-medium text-amber-900 dark:text-amber-100 text-sm">{category}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Popular Books */}
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                      <TrendingUp size={20} />
                      Most Popular Books
                    </h3>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-3 text-amber-700 dark:text-amber-300">Loading books...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {popularBooks.map((book) => (
                          <BookCard
                            key={book.id}
                            book={book}
                            onView={() => viewBookDetails(book)}
                            onImport={() => handleImportBook(book)}
                            isImporting={isImporting}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {view === 'search' && (
                <div>
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                    <Search size={20} />
                    Search Results
                  </h3>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                      <span className="ml-3 text-amber-700 dark:text-amber-300">Searching...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {searchResults.map((book) => (
                        <BookCard
                          key={book.id}
                          book={book}
                          onView={() => viewBookDetails(book)}
                          onImport={() => handleImportBook(book)}
                          isImporting={isImporting}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Book size={48} className="mx-auto text-amber-400/50 mb-4" />
                      <p className="text-amber-700/80 dark:text-amber-200/80">No books found. Try a different search term.</p>
                    </div>
                  )}
                </div>
              )}

              {view === 'detail' && selectedBook && (
                <BookDetail book={selectedBook} onImport={() => handleImportBook(selectedBook)} isImporting={isImporting} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Dialog */}
      <DuplicateWarningDialog
        isOpen={!!duplicateDialog}
        visible={duplicateVisible}
        title="Duplicate Book Detected"
        message={duplicateDialog?.duplicateInfo.message || ''}
        existingBook={duplicateDialog?.duplicateInfo.existingBook}
        matchType={duplicateDialog?.duplicateInfo.matchType}
        onConfirm={handleDuplicateConfirm}
        onCancel={() => {
          setDuplicateVisible(false);
          setTimeout(() => setDuplicateDialog(null), 180);
        }}
        isProcessing={isImporting}
      />
    </>
  );
};

// FIXED: Simplified BookCard without re-triggering animations
const BookCard: React.FC<{
  book: GutenbergBook;
  onView: () => void;
  onImport: () => void;
  isImporting: boolean;
}> = React.memo(({ book, onView, onImport, isImporting }) => {
  const hasEpub = !!book.formats['application/epub+zip'];

  return (
    <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl border border-amber-200/50 dark:border-amber-700/30 p-4 hover:shadow-lg transition-all duration-200 transform hover:scale-105">
      <div className="mb-3">
        <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm leading-tight mb-1 line-clamp-2">
          {book.title}
        </h4>
        <p className="text-amber-700/80 dark:text-amber-200/80 text-xs mb-2">
          {book.authors.length > 0 ? book.authors.map(a => a.name).join(', ') : 'Unknown Author'}
        </p>
        
        <div className="flex items-center gap-3 text-xs text-amber-600/70 dark:text-amber-400/70 mb-3">
          <div className="flex items-center gap-1">
            <TrendingUp size={12} />
            {book.download_count ? `${(book.download_count / 1000).toFixed(0)}K` : 'N/A'}
          </div>
          <div className="flex items-center gap-1">
            <Globe size={12} />
            {book.languages[0] || 'en'}
          </div>
        </div>
        
        {book.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {book.subjects.slice(0, 2).map((subject, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-amber-100/80 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-full"
              >
                {subject.length > 20 ? subject.substring(0, 20) + '...' : subject}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 px-3 py-2 text-sm bg-amber-100/60 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-700/40 transition-colors duration-200 flex items-center justify-center gap-1"
          disabled={isImporting}
        >
          <Eye size={14} />
          View
        </button>
        <button
          onClick={onImport}
          disabled={!hasEpub || isImporting}
          className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isImporting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Download size={14} />
              Import
            </>
          )}
        </button>
      </div>
      
      {!hasEpub && (
        <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-2 text-center">
          EPUB format not available
        </p>
      )}
    </div>
  );
});

// FIXED: Simplified BookDetail
const BookDetail: React.FC<{
  book: GutenbergBook;
  onImport: () => void;
  isImporting: boolean;
}> = ({ book, onImport, isImporting }) => {
  const hasEpub = !!book.formats['application/epub+zip'];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/60 dark:bg-stone-700/60 rounded-2xl border border-amber-200/50 dark:border-amber-700/30 p-6 shadow-lg">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-2">
            {book.title}
          </h3>
          <p className="text-lg text-amber-700/80 dark:text-amber-200/80 mb-4">
            by {book.authors.length > 0 ? book.authors.map(a => a.name).join(', ') : 'Unknown Author'}
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Downloads</span>
              </div>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {book.download_count ? (book.download_count / 1000).toFixed(0) + 'K' : 'N/A'}
              </p>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Language</span>
              </div>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {book.languages[0]?.toUpperCase() || 'EN'}
              </p>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Book size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">ID</span>
              </div>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                #{book.id}
              </p>
            </div>

            <div className="bg-amber-50/80 dark:bg-amber-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Formats</span>
              </div>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                {Object.keys(book.formats).length}
              </p>
            </div>
          </div>

          {/* Subjects and Bookshelves */}
          {book.subjects.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Subjects</h4>
              <div className="flex flex-wrap gap-2">
                {book.subjects.map((subject, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm bg-amber-100/80 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </div>
          )}

          {book.bookshelves.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3">Bookshelves</h4>
              <div className="flex flex-wrap gap-2">
                {book.bookshelves.map((shelf, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm bg-blue-100/80 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-full"
                  >
                    {shelf}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onImport}
            disabled={!hasEpub || isImporting}
            className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl transition-all duration-200 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transform hover:scale-105 active:scale-95"
          >
            {isImporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Importing Book...</span>
              </>
            ) : (
              <>
                <Download size={20} />
                <span>Import to Library</span>
              </>
            )}
          </button>
        </div>

        {!hasEpub && (
          <p className="text-center text-amber-600/70 dark:text-amber-400/70 mt-4">
            EPUB format is not available for this book
          </p>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProjectGutenbergModal);
//TODO fix the flickering