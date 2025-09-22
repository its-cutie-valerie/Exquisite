// renderer.d.ts - Updated with EPUB reading capabilities

export interface IDatabaseApi {
  // Folder operations
  getFolders: () => Promise<Array<{ id: number; name: string }>>;
  addFolder: (name: string) => Promise<{ id: number; name: string } | null>;
  deleteFolder: (id: number) => Promise<boolean>;
  renameFolder: (id: number, newName: string) => Promise<boolean>;
  
  // Book operations
  getBooks: (folderId?: number) => Promise<Array<{
    id: number;
    title: string;
    author: string;
    description?: string;
    publisher?: string;
    language: string;
    isbn?: string;
    published_date?: string;
    cover_path?: string;
    file_path: string;
    file_size: number;
    progress: number;
    status: 'unread' | 'reading' | 'on_hold' | 'finished';
    folder_id?: number;
    created_at: string;
    updated_at: string;
  }>>;
  getBookCounts: () => Promise<{ unread: number; reading: number; on_hold: number; finished: number }>;
  addBook: (bookData: any) => Promise<any>;
  updateBook: (id: number, bookData: any) => Promise<boolean>;
  deleteBook: (id: number) => Promise<boolean>;
  checkComprehensiveDuplicate: (data: any) => Promise<any>;
  
  // File operations
  openFileDialog: () => Promise<string[]>;
  openFolderDialog: () => Promise<string>;
  importEpub: (filePath: string, forceImport?: boolean) => Promise<any>;
  importEpubFromBuffer: (buffer: number[], fileName: string, meta: any) => Promise<any>;
  getCoverData: (coverPath: string) => Promise<string | null>;
  serveEpub: (filePath: string) => Promise<{ data: string; mimeType: string }>;
  
  // EPUB Reading operations - NEW METHODS
  getEpubContent: (filePath: string) => Promise<{
    title: string;
    author: string;
    language: string;
    chapters: Array<{
      id: string;
      title: string;
      href: string;
      content: string;
      order: number;
    }>;
    toc: Array<{
      title: string;
      href: string;
      level: number;
    }>;
  }>;
  getEpubText: (filePath: string) => Promise<string>;

  // Project Gutenberg
  downloadGutenbergBook: (url: string, data: any) => Promise<{ success: boolean; buffer: number[]; size: number; bookData?: any }>;

  // App settings
  getSettings: () => Promise<any>;
  saveSettings: (data: any) => Promise<boolean>;

  // Reading sessions / stats
  addReadingSession: (data: { bookId: number; start: number; end: number; pages?: number }) => Promise<boolean>;
  getReadingSessions: (filter?: { bookId?: number; since?: number; until?: number }) => Promise<Array<{ bookId: number; start: number; end: number; pages?: number }>>;

  // Media shortcuts from main (Windows global media keys)
  onMediaEvent?: (callback: (type: 'play-pause'|'next'|'previous'|'stop') => void) => () => void;
  getMediaRegistrationOnce?: () => Promise<{ okPlay: boolean; okNext: boolean; okPrev: boolean; okStop: boolean } | null>;
  getMediaRegistrationNow?: () => Promise<{ okPlay: boolean; okNext: boolean; okPrev: boolean; okStop: boolean } | null>;
  sendMediaControl?: (type: 'play-pause'|'next'|'previous'|'stop') => void;

  // Discord Rich Presence
  setPresenceBrowsing?: () => void;
  setPresenceReading?: (title: string, author?: string) => void;
  disablePresence?: () => void;
}

// Window interface to expose the database API
declare global {
  interface Window {
    db: IDatabaseApi;
  }
}
