// electron/main.ts (Complete version with all functionality + Gutenberg support)
import { app, BrowserWindow, ipcMain, dialog, net, globalShortcut, shell, session } from 'electron'
import {
  setEnabled as presenceSetEnabled,
  setBrowsing as presenceSetBrowsing,
  setReading as presenceSetReading,
} from './discordPresence'
import { spawn } from 'node:child_process'
import path from 'node:path'

// Embedded PowerShell content as a fallback for when the script file isn't available (e.g. inside asar)
const PS_SCRIPT_CONTENT = `param(
  [Parameter(Mandatory=$true)][ValidateSet('play-pause','next','previous','stop')]
  [string]$Action
)

$VK = @{ 'play-pause' = 0xB3; 'next' = 0xB0; 'previous' = 0xB1; 'stop' = 0xB2 }

Add-Type -Namespace Native -Name KeySender -MemberDefinition @"
  using System;
  using System.Runtime.InteropServices;
  public static class KeySender {
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, IntPtr dwExtraInfo);
    public const int KEYEVENTF_KEYUP = 0x0002;
  }
"@

$vkCode = [byte]$VK[$Action]
[Native.KeySender]::keybd_event($vkCode, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 10
[Native.KeySender]::keybd_event($vkCode, 0, [Native.KeySender]::KEYEVENTF_KEYUP, [IntPtr]::Zero)
`;

function psMedia(action: 'play-pause'|'next'|'previous'|'stop') {
  if (process.platform !== 'win32') return;
  try {
    // Prefer a real file next to compiled code
    let scriptPath = path.join(__dirname, 'scripts', 'send-media-key.ps1');
    if (!fs.existsSync(scriptPath)) {
      // Try from source tree during dev
      const alt = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'electron', 'scripts', 'send-media-key.ps1');
      if (fs.existsSync(alt)) {
        scriptPath = alt;
      } else {
        // Write to temp if unavailable or when running inside asar
        const tempScript = path.join(os.tmpdir(), 'ebook_reader_send_media_key.ps1');
        try {
          if (!fs.existsSync(tempScript)) {
            fs.writeFileSync(tempScript, PS_SCRIPT_CONTENT, 'utf8');
          }
          scriptPath = tempScript;
        } catch (writeErr) {
          console.warn('[main] Failed to write temp PowerShell script, attempting inline command', writeErr);
          // Last-ditch: inline command
          const inline = `
            $Action = '${action}';
            $VK = @{ 'play-pause' = 0xB3; 'next' = 0xB0; 'previous' = 0xB1; 'stop' = 0xB2 };
            Add-Type -Namespace Native -Name KeySender -MemberDefinition @"using System;using System.Runtime.InteropServices;public static class KeySender{[DllImport(\"user32.dll\")] public static extern void keybd_event(byte bVk, byte bScan, int dwFlags, IntPtr dwExtraInfo); public const int KEYEVENTF_KEYUP=0x0002;}"@;
            $vkCode = [byte]$VK[$Action];
            [Native.KeySender]::keybd_event($vkCode,0,0,[IntPtr]::Zero); Start-Sleep -Milliseconds 10; [Native.KeySender]::keybd_event($vkCode,0,[Native.KeySender]::KEYEVENTF_KEYUP,[IntPtr]::Zero);
          `;
          const childInline = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', inline], { windowsHide: true });
          childInline.on('error', (e) => console.warn('[main] PowerShell inline media key failed', e));
          return;
        }
      }
    }
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, action], { windowsHide: true });
    child.on('error', (e) => console.warn('[main] PowerShell media key failed', e));
  } catch (e) {
    console.warn('[main] psMedia exception', e);
  }
}

// Use PowerShell-based media key simulation directly; FFI references are disabled/commented out
function mediaPlayPause() { psMedia('play-pause'); }
function mediaNext() { psMedia('next'); }
function mediaPrevious() { psMedia('previous'); }
function mediaStop() { psMedia('stop'); }
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Import better-sqlite3 and EPUB library using CommonJS require
const Database = require('better-sqlite3');
const EPub = require('epub');

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
const isDev = !!VITE_DEV_SERVER_URL
// Bump this when the EPUB sanitizer/output format changes to invalidate old caches
const EPUB_CACHE_VERSION = 2;

// Feature flag: avoid hijacking system media keys globally by default
const ENABLE_GLOBAL_MEDIA_KEYS = false;

// --- DATABASE SETUP ---
let db: any;
let settingsPath: string;
let settings: any = {
  discord: {
    enabled: true,
    clientId: '' // Provide your Discord Application Client ID here or via UI later
  }
};

// Normalize and migrate settings from older formats; returns whether a write-back is needed
function normalizeAndMigrateSettings(raw: any): { value: any; changed: boolean } {
  let changed = false;
  const out: any = { ...(raw || {}) };

  // Ensure nested discord object exists
  if (!out.discord || typeof out.discord !== 'object') {
    out.discord = {};
    changed = true;
  }

  // Migrate legacy top-level discordEnabled -> discord.enabled
  if (typeof out.discordEnabled !== 'undefined') {
    const v = !!out.discordEnabled;
    if (out.discord.enabled !== v) changed = true;
    out.discord.enabled = v;
    delete out.discordEnabled;
  }

  // Coerce types and trim values
  if (typeof out.discord.enabled !== 'boolean') {
    // Handle string/number truthy values
    out.discord.enabled = !!out.discord.enabled;
    changed = true;
  }
  if (typeof out.discord.clientId !== 'string') {
    if (out.discord.clientId == null) out.discord.clientId = '';
    else out.discord.clientId = String(out.discord.clientId);
    changed = true;
  }
  const trimmed = out.discord.clientId.trim();
  if (trimmed !== out.discord.clientId) {
    out.discord.clientId = trimmed;
    changed = true;
  }

  // Basic defaults for other common fields
  if (!('theme' in out)) out.theme = 'system';
  if (!('autosave' in out)) out.autosave = true;
  if (!('fontSize' in out)) out.fontSize = 'normal';

  return { value: out, changed };
}

function loadSettings() {
  try {
    const userDataPath = app.getPath('userData');
    settingsPath = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } else {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }

    // Normalize and migrate legacy fields
    try {
      const norm = normalizeAndMigrateSettings(settings);
      if (norm.changed) {
        settings = norm.value;
        // Write back the normalized file to persist migration
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      } else {
        settings = norm.value;
      }
    } catch (e) {
      // ignore
    }

    // Merge defaults from optional settings.defaults.json in app root (do not override user values)
    try {
      const defaultsPath = path.join(process.env.APP_ROOT || path.join(__dirname, '..'), 'settings.defaults.json');
      if (fs.existsSync(defaultsPath)) {
        const def = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
        // Normalize defaults too (defensive), but don't persist defaults
        const defNorm = normalizeAndMigrateSettings(def).value;
        settings = {
          ...defNorm,
          ...settings,
          discord: {
            ...(defNorm.discord || {}),
            ...(settings.discord || {}),
          },
        };
      }
    } catch (e) {
      // ignore
    }

    // Environment overrides for Discord client id if not set in user settings
    try {
      const envClient = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID;
      if (envClient && (!settings.discord || !settings.discord.clientId)) {
        settings.discord = { ...(settings.discord || {}), clientId: envClient };
      }
    } catch {}
  } catch (e) {
    console.warn('[main] Failed to load settings, using defaults', e);
  }
}

function saveSettings() {
  try {
    if (!settingsPath) {
      const userDataPath = app.getPath('userData');
      settingsPath = path.join(userDataPath, 'settings.json');
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.warn('[main] Failed to save settings', e);
  }
}

// In main.ts - Enhanced initializeDatabase function
function initializeDatabase() {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'ebook_reader.db');
    
    db = new Database(dbPath, { 
      verbose: console.log,
      fileMustExist: false
    });
    
    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const booksTable = tables.find((table: any) => table.name === 'books');
    
    if (booksTable) {
      // Add missing columns including new duplicate prevention columns
      const columns = db.prepare("PRAGMA table_info(books)").all();
  const columnNames = columns.map((col: any) => col.name);
      
      const requiredColumns = [
        'description', 'publisher', 'language', 'isbn', 'published_date', 
        'file_size', 'created_at', 'updated_at', 'gutenberg_id',
        'title_hash', 'content_hash' // New columns for duplicate detection
      ];
      
      for (const column of requiredColumns) {
        if (!columnNames.includes(column)) {
          try {
            switch (column) {
              case 'title_hash':
                db.exec('ALTER TABLE books ADD COLUMN title_hash TEXT');
                break;
              case 'content_hash':
                db.exec('ALTER TABLE books ADD COLUMN content_hash TEXT');
                break;
              // ... other existing cases
            }
          } catch (alterError) {
            console.error(`Error adding column ${column}:`, alterError);
          }
        }
      }

      // Create unique indexes for duplicate prevention
      try {
        // Prevent exact file path duplicates
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_file_path ON books(file_path)');
        
        // Prevent title+author duplicates (case-insensitive)
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_title_author ON books(LOWER(title), LOWER(author)) WHERE title IS NOT NULL AND author IS NOT NULL');
        
        // Prevent Gutenberg ID duplicates
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_gutenberg ON books(gutenberg_id) WHERE gutenberg_id IS NOT NULL');
        
        console.log('Unique indexes created successfully');
      } catch (indexError: any) {
        console.warn('Some indexes may already exist:', indexError?.message || indexError);
      }

    } else {
      // Create table with built-in constraints
      db.exec(`
        CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT,
          description TEXT,
          publisher TEXT,
          language TEXT DEFAULT 'en',
          isbn TEXT,
          published_date TEXT,
          cover_path TEXT,
          file_path TEXT NOT NULL UNIQUE,
          file_size INTEGER,
          progress REAL DEFAULT 0.0,
          status TEXT DEFAULT 'unread' CHECK(status IN ('unread', 'reading', 'on_hold', 'finished')),
          folder_id INTEGER,
          gutenberg_id INTEGER UNIQUE,
          title_hash TEXT,
          content_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_title_author ON books(LOWER(title), LOWER(author)) WHERE title IS NOT NULL AND author IS NOT NULL;
      `);
    }

    // Create reading_sessions table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS reading_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL,
        start_ts INTEGER NOT NULL,
        end_ts INTEGER NOT NULL,
        pages INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_book ON reading_sessions(book_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_time ON reading_sessions(start_ts, end_ts);
    `);

    // Test database
  const testStmt = db.prepare('SELECT COUNT(*) as count FROM folders');
  testStmt.get();
    console.log('Database initialized with duplicate prevention');

  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}


function registerIpcHandlers() {
  console.log('Registering IPC handlers...');
  
  // Remove any existing handlers first (do this BEFORE re-registering)
  const handlersToRemove = [
    'db:get-folders', 'db:add-folder', 'db:delete-folder', 'db:rename-folder',
    'db:get-books', 'db:add-book', 'db:update-book', 'db:delete-book',
    'db:get-book-counts', 'db:check-duplicate-book',
    'books:import-epub', 'books:open-file-dialog', 'books:get-cover-data',
    'books:get-epub-content', 'books:get-epub-text', 'books:serve-epub',
    'download-gutenberg-book', 'books:import-epub-from-buffer',
    // Stats / sessions
    'stats:add-reading-session', 'stats:get-reading-sessions',
  'app:get-settings', 'app:save-settings', 'app:open-folder-dialog',
    'presence:browsing', 'presence:reading', 'presence:disable'
  ];
  try {
    handlersToRemove.forEach((handler) => {
      try { ipcMain.removeHandler(handler); } catch {}
    });
    // Also clear any event listeners registered via ipcMain.on for presence/media events
    ['presence:browsing', 'presence:reading', 'presence:disable'].forEach((ch) => {
      try { ipcMain.removeAllListeners(ch); } catch {}
    });
  } catch {}
  // Settings IPC
  ipcMain.handle('app:get-settings', () => {
    return settings;
  });
  ipcMain.handle('app:save-settings', (_e, next: any) => {
    // Deep-merge settings; only override provided nested keys
    // Accept legacy top-level discordEnabled boolean as well
    if (next && typeof next.discordEnabled !== 'undefined') {
      next = { ...next, discord: { ...(next.discord || {}), enabled: !!next.discordEnabled } };
      delete next.discordEnabled;
    }

    const nextDiscordRaw = (next && next.discord) || {};
    const nextDiscord: any = {};
    try {
      Object.entries(nextDiscordRaw).forEach(([k, v]) => { if (v !== undefined) (nextDiscord as any)[k] = v; });
    } catch {}
    const prevDefaultFolder = (settings as any)?.defaultImportFolder || (settings as any)?.importFolder || '';
    const merged = {
      ...settings,
      ...next,
      discord: {
        ...(settings.discord || {}),
        ...nextDiscord,
      },
    };
    // Normalize the merged result for consistency
    const norm = normalizeAndMigrateSettings(merged);
    settings = norm.value;
    saveSettings();
    try {
      const nowDefaultFolder = (settings as any)?.defaultImportFolder || (settings as any)?.importFolder || '';
      if (nowDefaultFolder !== prevDefaultFolder) {
        startAutoImportWatcher();
      }
    } catch {}
    // Apply presence change immediately
    const d = settings.discord ?? {};
    presenceSetEnabled(!!d.enabled, d.clientId || undefined);
    return true;
  });

  // Open folder dialog (for SettingsModal default import folder)
  ipcMain.handle('app:open-folder-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths?.length) return '';
      return result.filePaths[0];
    } catch (e) {
      console.warn('open-folder-dialog failed', e);
      return '';
    }
  });

  // Presence IPC
  ipcMain.on('presence:browsing', () => {
    const d = settings.discord ?? {};
    if (d.enabled && d.clientId) presenceSetBrowsing();
  });
  ipcMain.on('presence:reading', (_e, payload: { title: string; author?: string }) => {
    const d = settings.discord ?? {};
    if (d.enabled && d.clientId) presenceSetReading(payload.title, payload.author);
  });
  ipcMain.on('presence:disable', () => {
    presenceSetEnabled(false);
  });

  // (Handlers were already removed at the start to avoid unregistering fresh ones.)

  // --- Reading sessions IPC ---
  ipcMain.handle('stats:add-reading-session', (_e, payload: { bookId: number; start: number; end: number; pages?: number }) => {
    try {
      const { bookId, start, end, pages = 0 } = payload || ({} as any);
      if (!bookId || !start || !end || end <= start) return false;
      const stmt = db.prepare('INSERT INTO reading_sessions (book_id, start_ts, end_ts, pages) VALUES (?, ?, ?, ?)');
      stmt.run(bookId, Math.floor(start), Math.floor(end), Math.max(0, Math.floor(pages)));
      return true;
    } catch (e) {
      console.warn('[main] stats:add-reading-session failed', e);
      return false;
    }
  });

  ipcMain.handle('stats:get-reading-sessions', (_e, filter?: { bookId?: number; since?: number; until?: number }) => {
    try {
      const where: string[] = [];
      const args: any[] = [];
      if (filter?.bookId) { where.push('book_id = ?'); args.push(filter.bookId); }
      if (filter?.since) { where.push('end_ts >= ?'); args.push(Math.floor(filter.since)); }
      if (filter?.until) { where.push('start_ts <= ?'); args.push(Math.floor(filter.until)); }
      const sql = `SELECT book_id as bookId, start_ts as start, end_ts as end, pages FROM reading_sessions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY start_ts ASC`;
      const rows = db.prepare(sql).all(...args);
      return rows;
    } catch (e) {
      console.warn('[main] stats:get-reading-sessions failed', e);
      return [];
    }
  });

  // --- NEW PROJECT GUTENBERG HANDLERS ---
  // In main.ts - Enhanced Project Gutenberg download handler
ipcMain.handle('download-gutenberg-book', async (_event: Electron.IpcMainInvokeEvent, { bookUrl, bookData }: { bookUrl: string, bookData?: any }) => {
  return new Promise((resolve, reject) => {
    console.log('Starting download from:', bookUrl);
    
    // Validate URL
    if (!bookUrl || typeof bookUrl !== 'string') {
      reject(new Error('Invalid book URL provided'));
      return;
    }

    try {
      // Create request with proper options
      const request = net.request({
        method: 'GET',
        url: bookUrl,
        redirect: 'follow',
        session: undefined // Use default session
      });
      
      const chunks: Buffer[] = [];
      let hasResponded = false;
      
      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          request.abort();
          reject(new Error('Download timeout after 30 seconds'));
        }
      }, 30000);
      
      request.on('response', (response) => {
        console.log('Response received:', response.statusCode, response.statusMessage);
        console.log('Response headers:', response.headers);
        
        if (hasResponded) return;
        
        if (response.statusCode === 200) {
          response.on('data', (chunk) => {
            chunks.push(chunk);
          });
          
          response.on('end', () => {
            if (hasResponded) return;
            hasResponded = true;
            clearTimeout(timeoutId);
            
            try {
              const buffer = Buffer.concat(chunks);
              console.log(`Successfully downloaded ${buffer.length} bytes`);
              
              resolve({
                success: true,
                buffer: Array.from(buffer),
                bookData,
                size: buffer.length
              });
            } catch (bufferError) {
                reject(new Error(`Failed to process downloaded data: ${(bufferError as any)?.message || bufferError}`));
            }
          });
          
          response.on('error', (error: any) => {
            if (hasResponded) return;
            hasResponded = true;
            clearTimeout(timeoutId);
            reject(new Error(`Response error: ${error?.message || error}`));
          });
          
        } else if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle manual redirect if needed
          hasResponded = true;
          clearTimeout(timeoutId);
          reject(new Error(`Unexpected redirect: ${response.statusCode}`));
        } else {
          hasResponded = true;
          clearTimeout(timeoutId);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }
      });
      
      request.on('error', (error: any) => {
        if (hasResponded) return;
        hasResponded = true;
        clearTimeout(timeoutId);
        console.error('Request error:', error);
        reject(new Error(`Network error: ${error?.message || error}`));
      });
      
      request.on('abort', () => {
        if (hasResponded) return;
        hasResponded = true;
        clearTimeout(timeoutId);
        reject(new Error('Download was aborted'));
      });
      
      // Start the request
      request.end();
      
    } catch (setupError: any) {
      reject(new Error(`Failed to setup request: ${setupError?.message || setupError}`));
    }
  });
});

  // Import EPUB from buffer (for Gutenberg books)
  ipcMain.handle('books:import-epub-from-buffer', async (_event: Electron.IpcMainInvokeEvent, bufferArray: number[], fileName: string, metadata: any = {}) => {
    try {
      console.log('Importing EPUB from buffer, size:', bufferArray.length, 'bytes');
      
      // Convert array back to buffer
      const buffer = Buffer.from(bufferArray);
      
      // Create temporary file
      const tempPath = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(tempPath, buffer);
      
      try {
        // Use existing import logic with the temporary file
        const result = await new Promise((resolve, reject) => {
          // Call the same EPUB import logic as your regular import
          const importPromise = importEpubFromPath(tempPath, true); // force import
          importPromise.then(resolve).catch(reject);
        });
        
        // Add Gutenberg-specific metadata if provided
        if (metadata.gutenberg_id && result && !(result as any).isDuplicate) {
          (result as any).gutenbergId = metadata.gutenberg_id;
          (result as any).description = metadata.subjects?.join(', ') || (result as any).description;
          (result as any).language = metadata.language || (result as any).language;
        }
        
        // Clean up temp file
        fs.unlinkSync(tempPath);
        
        return result;
      } catch (importError) {
        // Clean up temp file on error
        try {
          fs.unlinkSync(tempPath);
        } catch (unlinkError) {
          console.warn('Could not clean up temp file:', unlinkError);
        }
        throw importError;
      }
      
    } catch (error) {
      console.error('Error importing EPUB from buffer:', error);
      throw error;
    }
  });

  // In main.ts - Add enhanced duplicate detection handler
  ipcMain.handle('db:check-comprehensive-duplicate', (_event: Electron.IpcMainInvokeEvent, bookData: any) => {
  console.log('Comprehensive duplicate check for:', bookData.title);
  if (!db) {
    return { isDuplicate: false };
  }

  try {
    const { title, author, filePath, gutenbergId } = bookData;
    
    // 1. Check by Gutenberg ID (most reliable for Gutenberg books)
    if (gutenbergId) {
      const gutenbergStmt = db.prepare('SELECT * FROM books WHERE gutenberg_id = ?');
      const gutenbergMatch = gutenbergStmt.get(gutenbergId);
      if (gutenbergMatch) {
        return { 
          isDuplicate: true, 
          existingBook: gutenbergMatch, 
          matchType: 'gutenberg_id',
          message: `This Project Gutenberg book (ID: ${gutenbergId}) is already in your library.`
        };
      }
    }

    // 2. Check by file path
    if (filePath) {
      const fileName = path.basename(filePath);
      const pathStmt = db.prepare('SELECT * FROM books WHERE file_path LIKE ? OR file_path LIKE ?');
      const pathMatch = pathStmt.get(`%${fileName}`, `%${path.basename(fileName, path.extname(fileName))}%`);
      if (pathMatch) {
        return { 
          isDuplicate: true, 
          existingBook: pathMatch, 
          matchType: 'file_path',
          message: `A book with a similar filename already exists in your library.`
        };
      }
    }

    // 3. Check by title and author (case-insensitive)
    if (title && author && author !== 'Unknown Author') {
      const titleAuthorStmt = db.prepare('SELECT * FROM books WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND LOWER(TRIM(author)) = LOWER(TRIM(?))');
      const titleAuthorMatch = titleAuthorStmt.get(title, author);
      if (titleAuthorMatch) {
        return { 
          isDuplicate: true, 
          existingBook: titleAuthorMatch, 
          matchType: 'title_author',
          message: `"${title}" by ${author} is already in your library.`
        };
      }
    }

    // 4. Check by title only (fuzzy matching)
    if (title) {
      const titleStmt = db.prepare('SELECT * FROM books WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))');
      const titleMatch = titleStmt.get(title);
      if (titleMatch) {
        return { 
          isDuplicate: true, 
          existingBook: titleMatch, 
          matchType: 'title_only',
          message: `A book with the title "${title}" already exists in your library.`
        };
      }
    }

    return { isDuplicate: false };
    
  } catch (error) {
    console.error('Error in comprehensive duplicate check:', error);
    return { isDuplicate: false };
  }
});

// In main.ts - Add cleanup function for existing duplicates
ipcMain.handle('db:cleanup-duplicates', () => {
  if (!db) return false;
  
  try {
    // Remove duplicate books keeping the most recent one
    const cleanupStmt = db.prepare(`
      DELETE FROM books 
      WHERE id NOT IN (
        SELECT MAX(id) 
        FROM books 
        GROUP BY LOWER(title), LOWER(author)
      )
    `);
    
    const result = cleanupStmt.run();
    console.log(`Cleaned up ${result.changes} duplicate books`);
    return { success: true, deletedCount: result.changes };
    
  } catch (error: any) {
    console.error('Error cleaning up duplicates:', error?.message || error);
    return { success: false, error: error?.message || String(error) };
  }
});


  // --- FOLDER HANDLERS (Keep all your existing ones) ---
  ipcMain.handle('db:get-folders', () => {
    console.log('IPC handler called: db:get-folders');
    if (!db) {
      console.error('Database not initialized');
      return [];
    }
    try {
      const stmt = db.prepare('SELECT * FROM folders ORDER BY name ASC');
      const result = stmt.all();
      console.log('Folders query result:', result);
      return result;
    } catch (error: any) {
      console.error('Error getting folders:', error?.message || error);
      return [];
    }
  });

  ipcMain.handle('db:add-folder', (_event: Electron.IpcMainInvokeEvent, name: string) => {
    console.log('IPC handler called: db:add-folder with name:', name);
    if (!db) {
      console.error('Database not initialized');
      return null;
    }
    try {
      const stmt = db.prepare('INSERT INTO folders (name) VALUES (?)');
      const info = stmt.run(name);
      const newFolder = { id: Number(info.lastInsertRowid), name };
      console.log('Folder created:', newFolder);
      return newFolder;
    } catch (error: any) {
      console.error('Failed to add folder:', error?.message || error);
      return null;
    }
  });

  ipcMain.handle('db:delete-folder', (_event: Electron.IpcMainInvokeEvent, id: number) => {
    console.log('IPC handler called: db:delete-folder with id:', id);
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    try {
      // First, update any books in this folder to have no folder
      const updateBooksStmt = db.prepare('UPDATE books SET folder_id = NULL WHERE folder_id = ?');
      updateBooksStmt.run(id);
      
      // Then delete the folder
      const deleteFolderStmt = db.prepare('DELETE FROM folders WHERE id = ?');
      const result = deleteFolderStmt.run(id);
      
      console.log('Folder deleted, rows affected:', result.changes);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to delete folder:', error?.message || error);
      return false;
    }
  });

  ipcMain.handle('db:rename-folder', (_event: Electron.IpcMainInvokeEvent, id: number, newName: string) => {
    console.log('IPC handler called: db:rename-folder with id:', id, 'new name:', newName);
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    try {
      const stmt = db.prepare('UPDATE folders SET name = ? WHERE id = ?');
      const result = stmt.run(newName, id);
      
      console.log('Folder renamed, rows affected:', result.changes);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to rename folder:', error?.message || error);
      return false;
    }
  });

  // --- BOOK HANDLERS (Keep all your existing ones) ---
  ipcMain.handle('db:get-book-counts', () => {
    console.log('IPC handler called: db:get-book-counts');
    if (!db) {
      console.error('Database not initialized');
      return { unread: 0, reading: 0, on_hold: 0, finished: 0 };
    }
    try {
      const unreadStmt = db.prepare("SELECT COUNT(*) as count FROM books WHERE status = 'unread'");
      const readingStmt = db.prepare("SELECT COUNT(*) as count FROM books WHERE status = 'reading'");
      const onHoldStmt = db.prepare("SELECT COUNT(*) as count FROM books WHERE status = 'on_hold'");
      const finishedStmt = db.prepare("SELECT COUNT(*) as count FROM books WHERE status = 'finished'");
      
      const counts = {
        unread: unreadStmt.get().count,
        reading: readingStmt.get().count,
        on_hold: onHoldStmt.get().count,
        finished: finishedStmt.get().count
      };
      
      console.log('Book counts from database:', counts);
      return counts;
    } catch (error) {
      console.error('Error getting book counts:', error);
      return { unread: 0, reading: 0, on_hold: 0, finished: 0 };
    }
  });

  // NEW: Duplicate detection handler
  ipcMain.handle('db:check-duplicate-book', (_event: Electron.IpcMainInvokeEvent, filePath: string, title?: string, author?: string) => {
    console.log('IPC handler called: db:check-duplicate-book');
    if (!db) {
      console.error('Database not initialized');
      return null;
    }
    try {
      // Check by file name first (since we rename files with timestamps)
      const fileName = path.basename(filePath);
      const originalFileName = fileName.replace(/^\d+_/, ''); // Remove timestamp prefix
      const pathStmt = db.prepare('SELECT * FROM books WHERE file_path LIKE ?');
      const pathMatch = pathStmt.get(`%${originalFileName}%`);
      
      if (pathMatch) {
        return { isDuplicate: true, existingBook: pathMatch, matchType: 'file' };
      }
      
      // Check by title and author (fuzzy match)
      if (title && author && author !== 'Unknown Author') {
        const titleAuthorStmt = db.prepare('SELECT * FROM books WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?)');
        const titleAuthorMatch = titleAuthorStmt.get(title, author);
        
        if (titleAuthorMatch) {
          return { isDuplicate: true, existingBook: titleAuthorMatch, matchType: 'metadata' };
        }
      }
      
      // Check by title only if author is unknown
      if (title && (!author || author === 'Unknown Author')) {
        const titleStmt = db.prepare('SELECT * FROM books WHERE LOWER(title) = LOWER(?)');
        const titleMatch = titleStmt.get(title);
        
        if (titleMatch) {
          return { isDuplicate: true, existingBook: titleMatch, matchType: 'title' };
        }
      }
      
      return { isDuplicate: false };
    } catch (error) {
      console.error('Error checking duplicate book:', error);
      return null;
    }
  });

  ipcMain.handle('db:get-books', (_event: Electron.IpcMainInvokeEvent, folderId: number | null = null) => {
    console.log('IPC handler called: db:get-books with folderId:', folderId);
    if (!db) {
      console.error('Database not initialized');
      return [];
    }
    try {
      let stmt;
      if (folderId) {
        stmt = db.prepare('SELECT * FROM books WHERE folder_id = ? ORDER BY title ASC');
        return stmt.all(folderId);
      } else {
        stmt = db.prepare('SELECT * FROM books ORDER BY title ASC');
        return stmt.all();
      }
    } catch (error) {
      console.error('Error getting books:', error);
      return [];
    }
  });
  
  ipcMain.handle('books:get-cover-data', async (_event: Electron.IpcMainInvokeEvent, coverPath: string) => {
    try {
      if (!coverPath || !fs.existsSync(coverPath)) {
        return null;
      }
      
      const data = fs.readFileSync(coverPath);
      const base64 = data.toString('base64');
      const ext = path.extname(coverPath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error('Error reading cover file:', error);
      return null;
    }
  });

// In main.ts - Enhanced addBook handler with duplicate safety
ipcMain.handle('db:add-book', (_event: Electron.IpcMainInvokeEvent, bookData: any) => {
  console.log('Adding book with duplicate safety:', bookData.title);
  if (!db) {
    return null;
  }
  
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO books (
        title, author, description, publisher, language, isbn, 
        published_date, cover_path, file_path, file_size, 
        folder_id, gutenberg_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    const info = stmt.run(
      bookData.title,
      bookData.author,
      bookData.description || null,
      bookData.publisher || null,
      bookData.language || 'en',
      bookData.isbn || null,
      bookData.publishedDate || null,
      bookData.cover || null,
      bookData.filePath,
      bookData.fileSize,
      bookData.folderId || null,
      bookData.gutenbergId || null
    );
    
    if (info.changes > 0) {
      const newBook = { id: Number(info.lastInsertRowid), ...bookData };
      console.log('Book added successfully:', newBook.title);
      try {
        // Notify renderers so UIs can refresh automatically
        const all = BrowserWindow.getAllWindows();
        all.forEach(w => w.webContents.send('library:changed'));
      } catch {}
      return newBook;
    } else {
      console.log('Book not added - likely duplicate:', bookData.title);
      return { isDuplicate: true, message: 'Book already exists in library' };
    }
    
  } catch (error: any) {
    console.error('Failed to add book:', error?.message || error);
    
    // Handle specific constraint violations
    if ((error?.message || '').includes('UNIQUE constraint failed')) {
      const msg = error?.message || '';
      if (msg.includes('file_path')) {
        return { isDuplicate: true, message: 'A book with this file already exists' };
      } else if (msg.includes('gutenberg_id')) {
        return { isDuplicate: true, message: 'This Project Gutenberg book is already in your library' };
      } else if (msg.includes('title')) {
        return { isDuplicate: true, message: 'A book with this title and author already exists' };
      }
    }
    
    return null;
  }
});


  ipcMain.handle('db:update-book', (_event: Electron.IpcMainInvokeEvent, id: number, bookData: any) => {
    console.log('IPC handler called: db:update-book');
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    try {
      const stmt = db.prepare(`
        UPDATE books SET 
          title = ?, author = ?, progress = ?, status = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      const result = stmt.run(
        bookData.title,
        bookData.author,
        bookData.progress || 0,
        bookData.status || 'unread',
        bookData.folderId || null,
        id
      );
      if (result.changes > 0) {
        try {
          const all = BrowserWindow.getAllWindows();
          all.forEach(w => w.webContents.send('library:changed'));
        } catch {}
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Failed to update book:', error?.message || error);
      return false;
    }
  });

  // EPUB Content Reading Handler (Keep your existing one)
// Replace the existing 'books:get-epub-content' handler in main.ts with this:

ipcMain.handle('books:get-epub-content', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('EPUB file not found');
    }

    // Fast path: cache lookup by file hash (size+mtime+path)
    const stat = fs.statSync(filePath);
    const cacheRoot = path.join(app.getPath('userData'), 'epub_cache');
    if (!fs.existsSync(cacheRoot)) fs.mkdirSync(cacheRoot, { recursive: true });
    const cacheKey = crypto
      .createHash('sha1')
      .update(`v${EPUB_CACHE_VERSION}:`)
      .update(filePath)
      .update(String(stat.size))
      .update(String(stat.mtimeMs))
      .digest('hex');
    const cachePath = path.join(cacheRoot, `${cacheKey}.json.gz`);
    try {
      if (fs.existsSync(cachePath)) {
        const gz = fs.readFileSync(cachePath);
        const json = zlib.gunzipSync(gz).toString('utf8');
        const cached = JSON.parse(json);
        if (!isDev) return cached;
        // In dev, still return quickly but log once
        console.log('[books:get-epub-content] Cache hit ->', cachePath);
        return cached;
      }
    } catch (e) {
      if (isDev) console.warn('[books:get-epub-content] Cache read failed, continuing', e);
    }

    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const epub = new EPub(filePath);

      epub.on('end', async () => {
        try {
          const chapters: Array<{ id: string; title: string; href: string; content: string; order: number }> = [];

          // Collect spine/flow items
          let spineItems: any[] = [];
          if (Array.isArray(epub.spine)) spineItems = epub.spine as any[];
          else if (epub.spine && typeof epub.spine === 'object') spineItems = Object.values(epub.spine);
          else if (epub.flow && Array.isArray(epub.flow)) spineItems = epub.flow as any[];

          if (!spineItems.length && epub.manifest) {
            const manifestKeys = Object.keys(epub.manifest);
            const contentItems = manifestKeys.filter(key => {
              const item = (epub as any).manifest[key];
              const mt = item && item['media-type'];
              return !!mt && (mt.includes('html') || mt.includes('xml'));
            });
            spineItems = contentItems.map(key => {
              const item = (epub as any).manifest[key];
              return { id: key, href: item?.href || '', 'media-type': item?.['media-type'] };
            });
          }

          const MAX_CONCURRENCY = Math.max(2, Math.min(6, os.cpus().length || 4));
          const tasks: Array<() => Promise<void>> = [];

          const decodeEntities = (s: string) => s
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'");

          const makeTask = (spineItem: any, order: number) => async () => {
            if (!spineItem || !spineItem.id) return;
            const chapterTextRaw = await new Promise<string>((res) => {
              epub.getChapter(spineItem.id, (_err: any, text: any) => res(String(text || '')));
            });
            if (!chapterTextRaw) return;

            // Title resolution (quick)
            let chapterTitle = `Chapter ${order + 1}`;
            if (epub.toc && Array.isArray(epub.toc) && spineItem.href) {
              const entry = (epub.toc as any[]).find((toc: any) => toc?.href && (spineItem.href.includes(toc.href) || toc.href.includes(spineItem.href)));
              if (entry?.title) chapterTitle = entry.title;
            } else if (spineItem.href) {
              chapterTitle = spineItem.href.split('/').pop()?.replace(/\.(x)?html?$/i, '') || chapterTitle;
            }

            // Fast sanitize: keep structural tags (h1-6, p, br, em/strong/i/b, ul/ol/li, blockquote, hr),
            // drop scripts/styles/links/meta and all attributes; convert div/section/article to p.
            const allowed = '(h[1-6]|p|br|em|strong|i|b|ul|ol|li|blockquote|hr)';
            let html = chapterTextRaw
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<head\b[\s\S]*?<\/head>/gi, '')
              .replace(/<link\b[^>]*>/gi, '')
              .replace(/<meta\b[^>]*>/gi, '')
              // normalize common containers to paragraphs
              .replace(/<\/?(section|article|div)\b[^>]*>/gi, (m) => (m.startsWith('</') ? '</p>' : '<p>'))
              // drop attributes from allowed tags
              .replace(new RegExp(`<${allowed}\\b[^>]*>`, 'gi'), (m) => {
                const tag = m.match(/^<\/?\s*([a-z0-9]+)/i)?.[1] || 'p';
                return `<${tag}>`;
              })
              // self-close br variants
              .replace(/<br\b[^>]*>/gi, '<br>')
              // remove any other tags but keep text
              .replace(new RegExp(`<(?:(?!\/?${allowed}\b)[^>])+>`, 'gi'), '');

            // Collapse excessive whitespace while preserving basic breaks
            html = html
              .replace(/[\t\f\v]+/g, ' ')
              .replace(/\s*\n\s*/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            const cleaned = decodeEntities(html);

            if (cleaned.length > 10) {
              chapters.push({ id: spineItem.id || `chapter-${order}`, title: chapterTitle, href: spineItem.href || '', content: cleaned, order });
            }
          };

          for (let i = 0; i < spineItems.length; i++) {
            tasks.push(makeTask(spineItems[i], i));
          }

          // Run tasks in batches to increase throughput
          for (let i = 0; i < tasks.length; i += MAX_CONCURRENCY) {
            const slice = tasks.slice(i, i + MAX_CONCURRENCY);
            await Promise.all(slice.map(fn => fn()));
          }

          // Fallback: manifest sweep if empty
          if (!chapters.length && (epub as any).manifest) {
            const manifestIds = Object.keys((epub as any).manifest);
            for (const id of manifestIds) {
              const item: any = (epub as any).manifest[id];
              if (item && item['media-type'] && item['media-type'].includes('html')) {
                const contentRaw = await new Promise<string>((res) => {
                  epub.getChapter(id, (_err: any, text: any) => res(String(text || '')));
                });
                // Fallback simple clean for manifest items
                const cleaned = contentRaw
                  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                  .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                if (cleaned.length > 50) {
                  chapters.push({ id, title: item.href || 'Content', href: item.href || '', content: cleaned, order: chapters.length });
                }
              }
            }
          }

          // Build TOC
          let tocItems: Array<{ title: string; href: string; level: number }> = [];
          if (epub.toc && Array.isArray(epub.toc)) {
            tocItems = (epub.toc as any[]).map((item: any) => ({ title: item?.title || 'Untitled', href: item?.href || '', level: item?.level || 0 }));
          }

          const result = {
            title: epub.metadata?.title || 'Unknown Title',
            author: epub.metadata?.creator || 'Unknown Author',
            language: epub.metadata?.language || 'en',
            chapters: chapters.sort((a, b) => a.order - b.order),
            toc: tocItems
          };

          if (!result.chapters.length) {
            result.chapters.push({ id: 'no-content', title: 'No Content', href: '', content: 'This EPUB file appears to be empty or could not be read.', order: 0 });
          }

          // Store cache (best-effort)
          try {
            const json = JSON.stringify(result);
            const gz = zlib.gzipSync(Buffer.from(json, 'utf8'));
            fs.writeFileSync(cachePath, gz);
            if (isDev) console.log('[books:get-epub-content] Cache stored ->', cachePath, 'took', Date.now() - t0, 'ms');
          } catch (e) {
            if (isDev) console.warn('[books:get-epub-content] Cache write failed', e);
          }

          resolve(result);
        } catch (processingError: any) {
          reject(new Error(`Failed to process EPUB content: ${processingError?.message || processingError}`));
        }
      });

      epub.on('error', (error: any) => {
        reject(new Error(`Failed to parse EPUB: ${(error as any)?.message || error}`));
      });

      epub.parse();
    });
  } catch (error) {
    console.error('Error reading EPUB content:', error);
    throw error;
  }
});

  // Also add this fallback handler for getting text content (Keep your existing one)
  ipcMain.handle('books:get-epub-text', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
    try {
      console.log('Getting EPUB text content from:', filePath);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('EPUB file not found');
      }

      return new Promise((resolve) => {
        const epub = new EPub(filePath);
        
        epub.on('end', () => {
          try {
            let allText = '';
            let processedChapters = 0;
            
                if (!epub.spine || epub.spine.length === 0) {
              resolve('No content found in this EPUB file.');
              return;
            }
            
            // Extract text from each spine item
            (epub.spine as any[]).forEach((spineItem: any, index: number) => {
              epub.getChapter(spineItem.id, (error: any, text: any) => {
                if (!error && text) {
                  // Strip HTML tags and get plain text
                  const plainText = text
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                  
                  if (plainText) {
                    allText += `\n\n=== Chapter ${index + 1} ===\n\n${plainText}`;
                  }
                }
                
                processedChapters++;
                
                // When all chapters are processed
                if (processedChapters === epub.spine.length) {
                  if (allText.trim()) {
                    resolve(allText.trim());
                  } else {
                    resolve('Could not extract text content from this EPUB file.');
                  }
                }
              });
            });
          } catch (processingError) {
            console.error('Error extracting text:', (processingError as any)?.message || processingError);
            resolve('Error extracting text from EPUB file.');
          }
        });
        
        epub.on('error', (error: any) => {
          console.error('EPUB text extraction error:', error?.message || error);
          resolve('Failed to read EPUB file.');
        });
        
        epub.parse();
      });
      
    } catch (error) {
      console.error('Error getting EPUB text:', error);
      return 'Error reading EPUB file.';
    }
  });

  // Add this to your registerIpcHandlers() function in main.ts (Keep your existing one)
  ipcMain.handle('books:serve-epub', async (_event: Electron.IpcMainInvokeEvent, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('EPUB file not found');
      }
      
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      
      return {
        data: base64,
        mimeType: 'application/epub+zip'
      };
    } catch (error) {
      console.error('Error serving EPUB:', error);
      throw error;
    }
  });

  ipcMain.handle('db:delete-book', (_event: Electron.IpcMainInvokeEvent, id: number) => {
    console.log('IPC handler called: db:delete-book');
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    try {
      // Get book info first to delete files
      const getStmt = db.prepare('SELECT * FROM books WHERE id = ?');
      const book = getStmt.get(id);
      
      if (book) {
        // Delete physical files
        try {
          if (book.file_path && fs.existsSync(book.file_path)) {
            fs.unlinkSync(book.file_path);
          }
          if (book.cover_path && fs.existsSync(book.cover_path)) {
            fs.unlinkSync(book.cover_path);
          }
        } catch (fileError) {
          console.error('Error deleting book files:', fileError);
        }
      }
      
      // Delete from database
      const deleteStmt = db.prepare('DELETE FROM books WHERE id = ?');
      const result = deleteStmt.run(id);
      if (result.changes > 0) {
        try {
          const all = BrowserWindow.getAllWindows();
          all.forEach(w => w.webContents.send('library:changed'));
        } catch {}
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Failed to delete book:', error?.message || error);
      return false;
    }
  });

  // --- FILE HANDLERS (Keep your existing ones) ---
  ipcMain.handle('books:open-file-dialog', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'EPUB Files', extensions: ['epub'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result.filePaths;
    } catch (error) {
      console.error('Error opening file dialog:', error);
      return [];
    }
  });

  // UPDATED: Import handler with duplicate detection (Keep your existing logic)
  ipcMain.handle('books:import-epub', async (_event: Electron.IpcMainInvokeEvent, filePath: string, forceImport = false) => {
    return importEpubFromPath(filePath, forceImport);
  });

  console.log('IPC handlers registered successfully');
}

// Helper function for your existing EPUB import logic
async function importEpubFromPath(filePath: string, forceImport = false) {
  try {
    console.log('Importing EPUB from:', filePath, 'Force import:', forceImport);
    
    // First, extract basic metadata to check for duplicates (if not forcing import)
    if (!forceImport) {
      const basicTitle = path.basename(filePath, '.epub').replace(/[_-]+/g, ' ');
      let duplicateCheckData = { title: basicTitle, author: 'Unknown Author' };
      
      // Try to get real metadata for duplicate checking
      try {
        const tempEpub = new EPub(filePath);
        await new Promise((resolve) => {
          tempEpub.on('end', () => {
            duplicateCheckData = {
              title: tempEpub.metadata.title || basicTitle,
              author: tempEpub.metadata.creator || 'Unknown Author'
            };
            resolve(duplicateCheckData);
          });
          tempEpub.on('error', () => resolve(duplicateCheckData));
          tempEpub.parse();
        });
      } catch (metadataError) {
        console.log('Could not extract metadata for duplicate check, using filename');
      }
      
      // Check for duplicates
  const duplicateResult = await new Promise<any>(resolve => {
        try {
          // Check by title and author
          const titleAuthorStmt = db.prepare('SELECT * FROM books WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?)');
          const titleAuthorMatch = titleAuthorStmt.get(duplicateCheckData.title, duplicateCheckData.author);
          
          if (titleAuthorMatch) {
            resolve({ isDuplicate: true, existingBook: titleAuthorMatch, matchType: 'metadata' });
            return;
          }
          
          // Check by title only if author is unknown
          if (duplicateCheckData.author === 'Unknown Author') {
            const titleStmt = db.prepare('SELECT * FROM books WHERE LOWER(title) = LOWER(?)');
            const titleMatch = titleStmt.get(duplicateCheckData.title);
            
            if (titleMatch) {
              resolve({ isDuplicate: true, existingBook: titleMatch, matchType: 'title' });
              return;
            }
          }
          
          resolve({ isDuplicate: false });
        } catch (error) {
          console.error('Error checking duplicates:', error);
          resolve({ isDuplicate: false });
        }
      });
      
      if ((duplicateResult as any).isDuplicate) {
        return { isDuplicate: true, existingBook: (duplicateResult as any).existingBook, matchType: (duplicateResult as any).matchType };
      }
    }
    
    // Continue with import - create directories
    const booksDir = path.join(app.getPath('userData'), 'books');
    if (!fs.existsSync(booksDir)) {
      fs.mkdirSync(booksDir, { recursive: true });
    }

    const coverDir = path.join(app.getPath('userData'), 'covers');
    if (!fs.existsSync(coverDir)) {
      fs.mkdirSync(coverDir, { recursive: true });
    }

    // Generate unique filename
    const fileName = `${Date.now()}_${path.basename(filePath).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const bookPath = path.join(booksDir, fileName);

    // Copy file to books directory
    fs.copyFileSync(filePath, bookPath);

    // Extract metadata using epub library (Keep all your existing logic)
    return new Promise((resolve) => {
      const epub = new EPub(bookPath);
      
      epub.on('end', () => {
        try {
          console.log('EPUB metadata:', epub.metadata);
          console.log('EPUB manifest:', Object.keys(epub.manifest));
          
          const metadata = {
            title: epub.metadata.title || path.basename(filePath, '.epub').replace(/[_-]+/g, ' '),
            author: epub.metadata.creator || 'Unknown Author',
            description: epub.metadata.description || '',
            publisher: epub.metadata.publisher || '',
            language: epub.metadata.language || 'en',
            isbn: epub.metadata.ISBN || '',
            publishedDate: epub.metadata.date || '',
            cover: null,
            filePath: bookPath,
            originalPath: filePath,
            fileSize: fs.statSync(bookPath).size,
            addedAt: new Date().toISOString()
          };

          // Try to extract cover - multiple approaches (Keep all your existing cover extraction logic)
          let coverExtracted = false;

          const tryMetadataCover = () => {
            if (epub.metadata.cover && !coverExtracted) {
              console.log('Trying to extract cover using metadata.cover:', epub.metadata.cover);
              epub.getImage(epub.metadata.cover, (error: any, data: Buffer | null, mimeType: string | undefined) => {
                if (!error && data) {
                  try {
                    const extension = mimeType?.includes('png') ? 'png' : 'jpg';
                    const coverFileName = `${Date.now()}_cover.${extension}`;
                    const coverPath = path.join(coverDir, coverFileName);
                    
                    fs.writeFileSync(coverPath, data);
                    (metadata as any).cover = coverPath;
                    console.log('Cover extracted to:', coverPath);
                    coverExtracted = true;
                    resolve(metadata);
                  } catch (saveError) {
                    console.error('Error saving cover:', saveError);
                    tryAlternativeCover();
                  }
                } else {
                  console.log('No cover data from metadata.cover:', error);
                  tryAlternativeCover();
                }
              });
            } else {
              tryAlternativeCover();
            }
          };

          const tryAlternativeCover = () => {
            if (coverExtracted) return;

            // Look for cover image in manifest
            const manifestIds = Object.keys(epub.manifest);
            const possibleCovers = manifestIds.filter(id => {
              const item = epub.manifest[id];
              const href = item.href?.toLowerCase() || '';
              const mediaType = item['media-type'] || '';
              
              return mediaType.startsWith('image/') && (
                href.includes('cover') || 
                href.includes('front') ||
                id.toLowerCase().includes('cover') ||
                item.properties?.includes('cover-image')
              );
            });

            console.log('Possible cover images found:', possibleCovers);

            if (possibleCovers.length > 0) {
              const coverId = possibleCovers[0];
              epub.getImage(coverId, (error: any, data: Buffer | null, mimeType: string | undefined) => {
                if (!error && data) {
                  try {
                    const extension = mimeType?.includes('png') ? 'png' : 'jpg';
                    const coverFileName = `${Date.now()}_cover.${extension}`;
                    const coverPath = path.join(coverDir, coverFileName);
                    
                    fs.writeFileSync(coverPath, data);
                    (metadata as any).cover = coverPath;
                    console.log('Alternative cover extracted to:', coverPath);
                    coverExtracted = true;
                  } catch (saveError) {
                    console.error('Error saving alternative cover:', saveError);
                  }
                } else {
                  console.log('No alternative cover data:', error);
                }
                resolve(metadata);
              });
            } else {
              // Try first image in manifest
              const imageIds = manifestIds.filter(id => {
                const item = epub.manifest[id];
                return item['media-type']?.startsWith('image/');
              });

              if (imageIds.length > 0) {
                console.log('Trying first image as cover:', imageIds[0]);
                epub.getImage(imageIds[0], (error: any, data: Buffer | null, mimeType: string | undefined) => {
                  if (!error && data) {
                    try {
                      const extension = mimeType?.includes('png') ? 'png' : 'jpg';
                      const coverFileName = `${Date.now()}_cover.${extension}`;
                      const coverPath = path.join(coverDir, coverFileName);
                      
                      fs.writeFileSync(coverPath, data);
                      (metadata as any).cover = coverPath;
                      console.log('First image used as cover:', coverPath);
                    } catch (saveError) {
                      console.error('Error saving first image cover:', saveError);
                    }
                  }
                  resolve(metadata);
                });
              } else {
                console.log('No images found in EPUB');
                resolve(metadata);
              }
            }
          };

          // Start cover extraction
          tryMetadataCover();

        } catch (metadataError) {
          console.error('Error processing metadata:', metadataError);
          // Use fallback
          const fallbackMetadata = {
            title: path.basename(filePath, '.epub').replace(/[_-]+/g, ' '),
            author: 'Unknown Author',
            description: '',
            publisher: '',
            language: 'en',
            isbn: '',
            publishedDate: '',
            cover: null,
            filePath: bookPath,
            originalPath: filePath,
            fileSize: fs.statSync(bookPath).size,
            addedAt: new Date().toISOString()
          };
          resolve(fallbackMetadata);
        }
      });

      epub.on('error', (error: any) => {
        console.error('EPUB parsing error:', error?.message || error);
        // Use fallback
        const fallbackMetadata = {
          title: path.basename(filePath, '.epub').replace(/[_-]+/g, ' '),
          author: 'Unknown Author',
          description: '',
          publisher: '',
          language: 'en',
          isbn: '',
          publishedDate: '',
          cover: null,
          filePath: bookPath,
          originalPath: filePath,
          fileSize: fs.statSync(bookPath).size,
          addedAt: new Date().toISOString()
        };
        resolve(fallbackMetadata);
      });

      // Start parsing
      epub.parse();
    });
      
  } catch (error) {
    console.error('Error importing EPUB:', error);
    
    // Fallback: create basic metadata from filename
    try {
      const booksDir = path.join(app.getPath('userData'), 'books');
      if (!fs.existsSync(booksDir)) {
        fs.mkdirSync(booksDir, { recursive: true });
      }

      const fileName = `${Date.now()}_${path.basename(filePath).replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const bookPath = path.join(booksDir, fileName);
      fs.copyFileSync(filePath, bookPath);

      const fallbackMetadata = {
        title: path.basename(filePath, '.epub').replace(/[_-]+/g, ' '),
        author: 'Unknown Author',
        description: '',
        publisher: '',
        language: 'en',
        isbn: '',
        publishedDate: '',
        cover: null,
        filePath: bookPath,
        originalPath: filePath,
        fileSize: fs.statSync(bookPath).size,
        addedAt: new Date().toISOString()
      };

      console.log('Using fallback metadata:', fallbackMetadata);
      return fallbackMetadata;
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      throw error;
    }
  }
}

// --- Auto-import watcher (polling) ---
let autoImportTimer: NodeJS.Timeout | null = null;
let autoImportIndexPath: string;
let autoImportIndex: Record<string, { mtimeMs: number; size: number }> = {};

function loadAutoImportIndex() {
  try {
    const userDataPath = app.getPath('userData');
    autoImportIndexPath = path.join(userDataPath, 'auto_import_index.json');
    if (fs.existsSync(autoImportIndexPath)) {
      autoImportIndex = JSON.parse(fs.readFileSync(autoImportIndexPath, 'utf8')) || {};
    }
  } catch {
    autoImportIndex = {};
  }
}

function saveAutoImportIndex() {
  try {
    if (!autoImportIndexPath) {
      const userDataPath = app.getPath('userData');
      autoImportIndexPath = path.join(userDataPath, 'auto_import_index.json');
    }
    fs.writeFileSync(autoImportIndexPath, JSON.stringify(autoImportIndex, null, 2), 'utf8');
  } catch {}
}

async function scanAndImportOnce(folder: string) {
  try {
    if (!folder || !fs.existsSync(folder)) return;
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.epub$/i.test(entry.name)) continue;
      const full = path.join(folder, entry.name);
      let st: fs.Stats;
      try { st = fs.statSync(full); } catch { continue; }
      const key = full;
      const prev = autoImportIndex[key];
      const sig = { mtimeMs: st.mtimeMs, size: st.size };
      const isNew = !prev || prev.mtimeMs !== sig.mtimeMs || prev.size !== sig.size;
      if (!isNew) continue;
      try {
        const meta: any = await importEpubFromPath(full, false);
        if (meta && !(meta as any).isDuplicate) {
          // Insert into DB (reuse the same SQL as handler)
          try {
            const stmt = db.prepare(`
              INSERT OR IGNORE INTO books (
                title, author, description, publisher, language, isbn, 
                published_date, cover_path, file_path, file_size, 
                folder_id, gutenberg_id, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `);
            const info = stmt.run(
              meta.title,
              meta.author,
              meta.description || null,
              meta.publisher || null,
              meta.language || 'en',
              meta.isbn || null,
              meta.publishedDate || null,
              meta.cover || null,
              meta.filePath,
              meta.fileSize,
              null,
              null
            );
            if (info.changes > 0) {
              const all = BrowserWindow.getAllWindows();
              all.forEach(w => w.webContents.send('library:changed'));
            }
          } catch (e) {
            // ignore
          }
        }
      } catch {
        // ignore individual file errors
      } finally {
        autoImportIndex[key] = sig; // mark as seen to avoid loops, even if duplicate
        saveAutoImportIndex();
      }
    }
  } catch (e) {
    console.warn('[auto-import] scan failed', e);
  }
}

function stopAutoImportWatcher() {
  if (autoImportTimer) { clearInterval(autoImportTimer); autoImportTimer = null; }
}

function startAutoImportWatcher() {
  try {
    stopAutoImportWatcher();
    loadAutoImportIndex();
    const folder = (settings as any)?.defaultImportFolder || (settings as any)?.importFolder;
    if (!folder || typeof folder !== 'string' || !folder.trim()) return;
    autoImportTimer = setInterval(() => scanAndImportOnce(folder), 10000);
    // Run an initial scan shortly after startup
    setTimeout(() => scanAndImportOnce(folder), 2000);
    console.log('[auto-import] watching folder:', folder);
  } catch (e) {
    console.warn('[auto-import] failed to start', e);
  }
}

let win: BrowserWindow | null
let lastMediaRegistration: { okPlay: boolean; okNext: boolean; okPrev: boolean; okStop: boolean } | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    autoHideMenuBar: true,
    show: false, // avoid white flash; show on ready-to-show
    backgroundColor: '#f9fafb', // match light background
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      safeDialogs: true,
      devTools: !!VITE_DEV_SERVER_URL, // allow devtools only in dev server
    },
  })

  // Ensure the native menu bar is hidden/removed
  try {
    win?.setMenuBarVisibility(false)
    win?.removeMenu()
  } catch {}

  win.once('ready-to-show', () => {
    try { win?.show(); } catch {}
  })

  // Harden navigation and new window behavior for this window
  try {
    // Deny attempts to open new windows; open http/https externally
    win.webContents.setWindowOpenHandler(({ url }) => {
      try {
        const u = new URL(url)
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          shell.openExternal(url).catch(() => { /* ignore */ })
        }
      } catch {
        // ignore invalid url
      }
      return { action: 'deny' }
    })

    // Prevent navigation outside our app; allow only file:// or app served content
    win.webContents.on('will-navigate', (event, url) => {
      try {
        const u = new URL(url)
        const isLocal = u.protocol === 'file:' || u.origin === 'null'
        if (!isLocal) {
          event.preventDefault()
          if (u.protocol === 'http:' || u.protocol === 'https:') {
            shell.openExternal(url).catch(() => { /* ignore */ })
          }
        }
      } catch {
        // If parsing fails, block
        event.preventDefault()
      }
    })

    // Block attaching webviews
    win.webContents.on('will-attach-webview', (e) => {
      e.preventDefault()
    })

    // Log unexpected renderer exits
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error('[main] Renderer process gone:', details)
    })
  } catch (e) {
    console.warn('[main] Failed to harden webContents', e)
  }
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // Do not auto-open DevTools on load; use Ctrl+Shift+I manually if needed.
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function registerGlobalMediaShortcuts() {
  // Windows: optionally register global media keys to control in-app reader
  if (ENABLE_GLOBAL_MEDIA_KEYS) {
    try {
      const okPlay = globalShortcut.register('MediaPlayPause', () => {
        console.log('[main] MediaPlayPause pressed');
        try { win?.webContents.send('media:play-pause'); } catch (e) { console.warn('[main] send media:play-pause failed', e); }
      });
      const okNext = globalShortcut.register('MediaNextTrack', () => {
        console.log('[main] MediaNextTrack pressed');
        try { win?.webContents.send('media:next'); } catch (e) { console.warn('[main] send media:next failed', e); }
      });
      const okPrev = globalShortcut.register('MediaPreviousTrack', () => {
        console.log('[main] MediaPreviousTrack pressed');
        try { win?.webContents.send('media:previous'); } catch (e) { console.warn('[main] send media:previous failed', e); }
      });
      const okStop = globalShortcut.register('MediaStop', () => {
        console.log('[main] MediaStop pressed');
        try { win?.webContents.send('media:stop'); } catch (e) { console.warn('[main] send media:stop failed', e); }
      });
      const registration = { okPlay, okNext, okPrev, okStop };
      lastMediaRegistration = registration;
      console.log('[main] Global media shortcuts registered:', registration);
      try { win?.webContents.send('media:registered', registration); } catch (e) { console.warn('[main] send media:registered failed', e); }

      // Fallback debug accelerators if any media key failed to register
      if (!okPlay || !okNext || !okPrev || !okStop) {
        console.warn('[main] One or more media keys failed to register. Enabling fallback debug shortcuts.');
        const fbPlay = globalShortcut.register('Ctrl+Alt+Shift+P', () => {
          console.log('[main] Fallback Ctrl+Alt+Shift+P pressed');
          try { win?.webContents.send('media:play-pause'); } catch (e) { console.warn('[main] send media:play-pause failed', e); }
        });
        const fbNext = globalShortcut.register('Ctrl+Alt+Shift+Right', () => {
          console.log('[main] Fallback Ctrl+Alt+Shift+Right pressed');
          try { win?.webContents.send('media:next'); } catch (e) { console.warn('[main] send media:next failed', e); }
        });
        const fbPrev = globalShortcut.register('Ctrl+Alt+Shift+Left', () => {
          console.log('[main] Fallback Ctrl+Alt+Shift+Left pressed');
          try { win?.webContents.send('media:previous'); } catch (e) { console.warn('[main] send media:previous failed', e); }
        });
        const fbStop = globalShortcut.register('Ctrl+Alt+Shift+S', () => {
          console.log('[main] Fallback Ctrl+Alt+Shift+S pressed');
          try { win?.webContents.send('media:stop'); } catch (e) { console.warn('[main] send media:stop failed', e); }
        });
        console.log('[main] Fallback shortcuts registered:', { fbPlay, fbNext, fbPrev, fbStop });
      }
    } catch (err) {
      console.warn('Failed to register global media shortcuts:', err);
    }
  } else {
    // Explicitly record that we did not register global media keys
    lastMediaRegistration = { okPlay: false, okNext: false, okPrev: false, okStop: false };
    console.log('[main] Global media shortcuts are disabled (not registering).');
    try { win?.webContents.send('media:registered', lastMediaRegistration); } catch {}
  }
}
// Allow renderer to query media registration reliably at any time
ipcMain.handle('media:get-registration', () => {
  return lastMediaRegistration;
});
// Renderer-initiated media control events (from on-screen UI)
ipcMain.on('media:control', (_evt, type: 'play-pause'|'next'|'previous'|'stop') => {
  console.log('[main] media:control from renderer ->', type);
  // Send actual media key events to Windows so the active system player reacts
  try {
    switch (type) {
      case 'play-pause': mediaPlayPause(); break;
      case 'next': mediaNext(); break;
      case 'previous': mediaPrevious(); break;
      case 'stop': mediaStop(); break;
    }
  } catch (e) {
    console.warn('[main] media:control dispatch failed', e);
  }
});
// Dev-only cache tweak
if (isDev) app.commandLine.appendSwitch('disable-http-cache');
app.whenReady().then(() => {
  console.log('App is ready, initializing...');
  
  try {
    // Ensure a stable userData path across dev runs
    try {
      const appData = app.getPath('appData');
      const desired = path.join(appData, 'codedex_september_project');
      app.setPath('userData', desired);
      console.log('[main] userData path set to:', app.getPath('userData'));
    } catch (e) {
      console.warn('[main] failed to set userData path', e);
    }

    loadSettings();
    initializeDatabase();
    registerIpcHandlers(); // This registers the download handler
    createWindow();
    registerGlobalMediaShortcuts();
  // Start auto-import folder watcher if a default folder is configured
  try { startAutoImportWatcher(); } catch {}
    // Initialize Discord presence state based on settings
    const d = settings.discord ?? {};
    presenceSetEnabled(!!d.enabled, d.clientId || undefined);
    try { presenceSetBrowsing(); } catch {}
    console.log('App initialization complete');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }

  try {
    const ses = session.defaultSession
    // Deny all permission requests by default
    ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

    // Add a defense-in-depth CSP header in production (dev server needs websockets)
    if (!isDev) {
      ses.webRequest.onHeadersReceived((details, callback) => {
        const headers = details.responseHeaders || {}
        const csp = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
        headers['Content-Security-Policy'] = [csp]
        callback({ responseHeaders: headers })
      })
    }
  } catch (e) {
    console.warn('[main] session hardening failed', e)
  }
});

// Enforce single-instance behavior: focus existing window on second launch
const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}


app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  try { stopAutoImportWatcher(); } catch {}
  if (process.platform !== 'darwin') {
    // Close database connection before quitting
    if (db) {
      try {
        db.close();
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
    app.quit()
    win = null
  }
})

app.on('before-quit', () => {
  if (db) {
    try {
      db.close();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
  try { globalShortcut.unregisterAll(); } catch {}
});
