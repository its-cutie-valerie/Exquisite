"use strict";
const electron = require("electron");
console.log("Preload script: Loading...");
const invoke = (channel, ...args) => electron.ipcRenderer.invoke(channel, ...args);
const api = {
  // Folder operations
  getFolders: () => invoke("db:get-folders"),
  addFolder: (name) => invoke("db:add-folder", name),
  deleteFolder: (id) => invoke("db:delete-folder", id),
  renameFolder: (id, newName) => invoke("db:rename-folder", id, newName),
  // Book and database operations
  getBooks: (folderId) => invoke("db:get-books", folderId),
  getBookCounts: () => invoke("db:get-book-counts"),
  updateBook: (id, data) => invoke("db:update-book", id, data),
  deleteBook: (id) => invoke("db:delete-book", id),
  checkComprehensiveDuplicate: (data) => invoke("db:check-comprehensive-duplicate", data),
  // File, Import, and Cover operations
  openFileDialog: () => invoke("books:open-file-dialog"),
  openFolderDialog: () => invoke("app:open-folder-dialog"),
  importEpub: (filePath, force) => invoke("books:import-epub", filePath, force),
  getCoverData: (coverPath) => invoke("books:get-cover-data", coverPath),
  importEpubFromBuffer: (buffer, fileName, meta) => invoke("books:import-epub-from-buffer", buffer, fileName, meta),
  addBook: (bookData) => invoke("db:add-book", bookData),
  // --- THIS IS THE ONLY METHOD NEEDED FOR READING EPUB CONTENT ---
  // provide both names so renderer code can call either `getEpubContent` or `loadBookContent`
  loadBookContent: (filePath) => invoke("books:get-epub-content", filePath),
  getEpubContent: (filePath) => invoke("books:get-epub-content", filePath),
  // Project Gutenberg
  downloadGutenbergBook: (url, data) => invoke("download-gutenberg-book", { bookUrl: url, bookData: data }),
  // App settings
  getSettings: () => invoke("app:get-settings"),
  saveSettings: (data) => invoke("app:save-settings", data),
  // Reading sessions / stats
  addReadingSession: (data) => invoke("stats:add-reading-session", data),
  getReadingSessions: (filter) => invoke("stats:get-reading-sessions", filter),
  // Maintenance
  cleanupDuplicates: () => invoke("db:cleanup-duplicates"),
  // Media shortcuts from main (Windows global media keys)
  onMediaEvent: (callback) => {
    console.log("[preload] onMediaEvent subscribed");
    const map = {
      "media:play-pause": "play-pause",
      "media:next": "next",
      "media:previous": "previous",
      "media:stop": "stop"
    };
    const handlers = [];
    Object.entries(map).forEach(([ch, type]) => {
      const fn = () => {
        console.log(`[preload] received ${ch}`);
        callback(type);
      };
      electron.ipcRenderer.on(ch, fn);
      handlers.push({ ch, fn });
    });
    return () => {
      console.log("[preload] onMediaEvent unsubscribed");
      handlers.forEach(({ ch, fn }) => electron.ipcRenderer.removeListener(ch, fn));
    };
  },
  getMediaRegistrationOnce: () => {
    return new Promise((resolve) => {
      const handler = (_, payload) => {
        console.log("[preload] received media:registered", payload);
        resolve(payload ?? null);
        electron.ipcRenderer.removeListener("media:registered", handler);
      };
      electron.ipcRenderer.on("media:registered", handler);
      setTimeout(() => resolve(null), 2e3);
    });
  },
  getMediaRegistrationNow: async () => {
    try {
      const result = await invoke("media:get-registration");
      return result ?? null;
    } catch (e) {
      console.warn("[preload] getMediaRegistrationNow failed", e);
      return null;
    }
  },
  sendMediaControl: (type) => {
    try {
      console.log("[preload] send media:control ->", type);
      electron.ipcRenderer.send("media:control", type);
    } catch (e) {
      console.warn("[preload] sendMediaControl failed", e);
    }
  },
  // Discord Rich Presence
  setPresenceBrowsing: () => {
    try {
      electron.ipcRenderer.send("presence:browsing");
    } catch {
    }
  },
  setPresenceReading: (title, author) => {
    try {
      electron.ipcRenderer.send("presence:reading", { title, author });
    } catch {
    }
  },
  disablePresence: () => {
    try {
      electron.ipcRenderer.send("presence:disable");
    } catch {
    }
  }
};
try {
  electron.contextBridge.exposeInMainWorld("db", Object.freeze(api));
  console.log("Preload script: API exposed successfully on window.db");
} catch (error) {
  console.error("Preload script: Error exposing API:", error);
}
