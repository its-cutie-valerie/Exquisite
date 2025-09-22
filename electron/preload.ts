// src/preload.ts - FINAL CORRECTED VERSION
import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script: Loading...');

// Small helper to safely invoke IPC channels
const invoke = <T = any>(channel: string, ...args: any[]): Promise<T> => ipcRenderer.invoke(channel, ...args);

// --- Define the single, clean API for the renderer process ---
const api = {
  // Folder operations
  getFolders: () => invoke('db:get-folders'),
  addFolder: (name: string) => invoke('db:add-folder', name),
  deleteFolder: (id: number) => invoke('db:delete-folder', id),
  renameFolder: (id: number, newName: string) => invoke('db:rename-folder', id, newName),
  
  // Book and database operations
  getBooks: (folderId?: number) => invoke('db:get-books', folderId),
  getBookCounts: () => invoke('db:get-book-counts'),
  updateBook: (id: number, data: any) => invoke('db:update-book', id, data),
  deleteBook: (id: number) => invoke('db:delete-book', id),
  checkComprehensiveDuplicate: (data: any) => invoke('db:check-comprehensive-duplicate', data),
  
  // File, Import, and Cover operations
  openFileDialog: () => invoke('books:open-file-dialog'),
  openFolderDialog: () => invoke('app:open-folder-dialog'),
  importEpub: (filePath: string, force?: boolean) => invoke('books:import-epub', filePath, force),
  getCoverData: (coverPath: string) => invoke('books:get-cover-data', coverPath),
  importEpubFromBuffer: (buffer: number[], fileName: string, meta: any) => invoke('books:import-epub-from-buffer', buffer, fileName, meta),
  addBook: (bookData: any) => invoke('db:add-book', bookData),

  // --- THIS IS THE ONLY METHOD NEEDED FOR READING EPUB CONTENT ---
  // provide both names so renderer code can call either `getEpubContent` or `loadBookContent`
  loadBookContent: (filePath: string) => invoke('books:get-epub-content', filePath),
  getEpubContent: (filePath: string) => invoke('books:get-epub-content', filePath),

  // Project Gutenberg
  downloadGutenbergBook: (url: string, data: any) => invoke('download-gutenberg-book', { bookUrl: url, bookData: data }),
  
  // App settings
  getSettings: () => invoke('app:get-settings'),
  saveSettings: (data: any) => invoke('app:save-settings', data),
  
  // Reading sessions / stats
  addReadingSession: (data: { bookId: number; start: number; end: number; pages?: number }) => invoke('stats:add-reading-session', data),
  getReadingSessions: (filter?: { bookId?: number; since?: number; until?: number }) => invoke('stats:get-reading-sessions', filter),
  
  // Maintenance
  cleanupDuplicates: () => invoke('db:cleanup-duplicates'),

  // Media shortcuts from main (Windows global media keys)
  onMediaEvent: (callback: (type: 'play-pause'|'next'|'previous'|'stop') => void) => {
    console.log('[preload] onMediaEvent subscribed');
    const map: Record<string, 'play-pause'|'next'|'previous'|'stop'> = {
      'media:play-pause': 'play-pause',
      'media:next': 'next',
      'media:previous': 'previous',
      'media:stop': 'stop'
    };
    const handlers: Array<{ ch: string; fn: (...args: any[]) => void }> = [];
    Object.entries(map).forEach(([ch, type]) => {
      const fn = () => { console.log(`[preload] received ${ch}`); callback(type); };
      ipcRenderer.on(ch, fn as any);
      handlers.push({ ch, fn });
    });
    return () => {
      console.log('[preload] onMediaEvent unsubscribed');
      handlers.forEach(({ ch, fn }) => ipcRenderer.removeListener(ch, fn as any));
    };
  },
  getMediaRegistrationOnce: (): Promise<{ okPlay: boolean; okNext: boolean; okPrev: boolean; okStop: boolean } | null> => {
    return new Promise((resolve) => {
      const handler = (_: any, payload: any) => {
        console.log('[preload] received media:registered', payload);
        resolve(payload ?? null);
        ipcRenderer.removeListener('media:registered', handler as any);
      };
      ipcRenderer.on('media:registered', handler as any);
      // In case the event already fired before renderer subscribed, resolve after short timeout with null
      setTimeout(() => resolve(null), 2000);
    });
  },
  getMediaRegistrationNow: async (): Promise<{ okPlay: boolean; okNext: boolean; okPrev: boolean; okStop: boolean } | null> => {
    try {
  const result = await invoke('media:get-registration');
      return (result ?? null) as any;
    } catch (e) {
      console.warn('[preload] getMediaRegistrationNow failed', e);
      return null;
    }
  },
  sendMediaControl: (type: 'play-pause'|'next'|'previous'|'stop') => {
    try {
      console.log('[preload] send media:control ->', type);
      ipcRenderer.send('media:control', type);
    } catch (e) {
      console.warn('[preload] sendMediaControl failed', e);
    }
  }
  ,
  // Discord Rich Presence
  setPresenceBrowsing: () => { try { ipcRenderer.send('presence:browsing'); } catch {} },
  setPresenceReading: (title: string, author?: string) => { try { ipcRenderer.send('presence:reading', { title, author }); } catch {} },
  disablePresence: () => { try { ipcRenderer.send('presence:disable'); } catch {} }
};

// --- Expose the API to the Renderer Process on `window.db` ---
try {
  contextBridge.exposeInMainWorld('db', Object.freeze(api));
  console.log('Preload script: API exposed successfully on window.db');
} catch (error) {
  console.error('Preload script: Error exposing API:', error);
}

// --- Export the API type for TypeScript IntelliSense ---
export type ElectronApi = typeof api;
