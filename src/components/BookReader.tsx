// src/components/BookReader.tsx - THE FINAL, COMPLETE VERSION
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
    X, Settings, ChevronLeft, ChevronRight, Minus, Plus,
    Sun, Moon, FileText, Type, Eye, AlertCircle,
    SkipBack, SkipForward, List, Bookmark, BookmarkCheck, Pencil, Trash
} from 'lucide-react';
import { BsDropletFill } from 'react-icons/bs';

// --- TYPE DEFINITIONS ---

interface BookData {
  id: number;
  title: string;
  author: string;
  file_path: string;
  progress: number;
}

interface BookReaderProps {
  book: BookData;
  isOpen: boolean;
  onClose: () => void;
  onProgressUpdate: (bookId: number, progress: number) => void;
}

interface Page {
  content: string;
  pageNumber: number;
  chapterTitle?: string;
}

interface Chapter {
    title: string;
    content: string;
    order: number;
}

interface BookmarkEntry {
    index: number;
    label?: string;
}

// --- LIGHTWEIGHT READING SESSION TRACKING (feeds WellbeingModal) ---
type ReadingSession = { bookId: number; start: number; end: number; pages?: number };
function loadReadingSessions(): ReadingSession[] {
    try {
        const raw = localStorage.getItem('reading_sessions');
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch { return []; }
}
function saveReadingSessions(s: ReadingSession[]) {
    try { localStorage.setItem('reading_sessions', JSON.stringify(s)); } catch {}
}
function appendReadingSession(s: ReadingSession) {
    const arr = loadReadingSessions();
    arr.push(s);
    saveReadingSessions(arr);
}

// --- HELPER & CHILD COMPONENTS ---

const AnimatedWrapper = memo(({ children, animationClass = 'animate-fade-in', delay = 0, className = '' }: {
    children: React.ReactNode;
    animationClass?: string;
    delay?: number;
    className?: string;
}) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return <div className={`${className} ${hasAnimated ? animationClass : 'opacity-0'}`} style={{ animationFillMode: 'forwards' }}>{children}</div>;
});
AnimatedWrapper.displayName = 'AnimatedWrapper';

const BookPage = memo(({ content, pageNumber, theme, fontSize, lineHeight, fontFamily, margin, isLeft }: {
    content: string;
    pageNumber: number;
    theme: 'light' | 'sepia' | 'dark';
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    margin: number;
    isLeft: boolean;
}) => {
  const themeClasses = useMemo(() => {
    switch (theme) {
      case 'dark': return 'bg-gray-900 text-gray-300 border-gray-700/50';
      case 'sepia': return 'bg-amber-50 text-stone-800 border-amber-200/50';
      default: return 'bg-white text-gray-800 border-gray-200/50';
    }
  }, [theme]);

  return (
    <div
    className={`relative w-full h-full border ${themeClasses} shadow-inner transition-colors duration-300 ${isLeft ? 'rounded-l-2xl' : 'rounded-r-2xl'} reader-prose ${theme === 'dark' ? 'reader-prose-dark' : theme === 'sepia' ? 'reader-prose-sepia' : ''}`}
      style={{ fontFamily, fontSize: `${fontSize}px`, lineHeight, padding: `${margin}px` }}
    >
            <div className="text-justify h-full overflow-hidden" style={{ hyphens: 'auto' }}>
                <div dangerouslySetInnerHTML={{ __html: content }} />
            </div>
      <div className={`absolute bottom-6 ${isLeft ? 'left-6' : 'right-6'} text-xs opacity-50 font-medium`}>
        {pageNumber}
      </div>
    </div>
  );
});
BookPage.displayName = 'BookPage';

interface ReaderSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    fontSize: number;
    onFontSizeChange: (size: number) => void;
    theme: 'light' | 'sepia' | 'dark';
    onThemeChange: (theme: 'light' | 'sepia' | 'dark') => void;
    lineHeight: number;
    onLineHeightChange: (lh: number) => void;
}

const ReaderSettings = memo(({
    isOpen,
    onClose,
    fontSize,
    onFontSizeChange,
    theme,
    onThemeChange,
    lineHeight,
    onLineHeightChange
}: ReaderSettingsProps) => {
    if (!isOpen) return null;

    const themeOptions = [
      { value: 'light', label: 'Light', icon: Sun, preview: 'bg-white text-gray-900' },
      { value: 'sepia', label: 'Sepia', icon: FileText, preview: 'bg-amber-50 text-amber-900' },
      { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-gray-900 text-gray-100' },
    ];

    // Debug logs
    console.log('[ReaderSettings] Rendered with:', { isOpen, fontSize, theme, lineHeight });
    return (
        <div className="fixed inset-0 z-[60]" onClick={() => { console.log('[ReaderSettings] Overlay click'); onClose(); }}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-stone-800/30 to-orange-900/20 backdrop-blur-lg" />
            <div className="flex items-center justify-center min-h-screen p-4">
                <AnimatedWrapper animationClass="animate-scale-in">
                    <div
                        className="relative bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-950/30 rounded-3xl shadow-2xl w-full max-w-md border border-amber-200/50 dark:border-amber-700/30"
                        onClick={(e) => { e.stopPropagation(); console.log('[ReaderSettings] Modal click'); }}
                    >
                        <div className="relative p-6 pb-4 border-b border-amber-200/50 dark:border-amber-700/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                                    <Settings size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100">Reading Settings</h3>
                                    <p className="text-sm text-amber-700/80 dark:text-amber-200/80">Customize your experience</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto custom-scrollbar">
                            <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-4 border border-amber-200/50 dark:border-amber-700/30">
                                <label className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2"><Type size={16} /> Font Size</label>
                                <div className="flex items-center justify-between">
                                    <button onClick={() => { console.log('[ReaderSettings] FontSize -1'); onFontSizeChange(Math.max(12, fontSize - 1)); }} className="p-3 bg-amber-100/60 dark:bg-amber-800/30 rounded-xl border border-amber-200/60 dark:border-amber-700/40 hover:bg-amber-100/80" disabled={fontSize <= 12}><Minus size={14} /></button>
                                    <span className="text-lg font-bold min-w-[60px] text-center">{fontSize}px</span>
                                    <button onClick={() => { console.log('[ReaderSettings] FontSize +1'); onFontSizeChange(Math.min(32, fontSize + 1)); }} className="p-3 bg-amber-100/60 dark:bg-amber-800/30 rounded-xl border border-amber-200/60 dark:border-amber-700/40 hover:bg-amber-100/80" disabled={fontSize >= 32}><Plus size={14} /></button>
                                </div>
                            </div>
                            <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-4 border border-amber-200/50 dark:border-amber-700/30">
                                <label className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2"><Eye size={16} /> Theme</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {themeOptions.map((t) => {
                                        const Icon = t.icon;
                                        return <button key={t.value} onClick={() => { console.log('[ReaderSettings] Theme change', t.value); onThemeChange(t.value as 'light' | 'sepia' | 'dark'); }} className={`p-4 rounded-xl border-2 shadow-sm hover:shadow transition-all ${t.preview} ${theme === t.value ? 'border-amber-500 ring-2 ring-amber-400/60' : 'border-amber-200/50 hover:border-amber-300'}`}><div className="flex flex-col items-center gap-2"><Icon size={20} /><span className="text-xs font-medium">{t.label}</span></div></button>;
                                    })}
                                </div>
                            </div>
                            <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-4 border border-amber-200/50 dark:border-amber-700/30">
                                <label className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3 flex justify-between"><span>Line Height</span><span>{lineHeight.toFixed(1)}</span></label>
                                <input type="range" min="1.2" max="2.2" step="0.1" value={lineHeight} onChange={(e) => { console.log('[ReaderSettings] LineHeight', e.target.value); onLineHeightChange(Number(e.target.value)); }} className="w-full h-3 bg-amber-200/50 dark:bg-amber-700/30 rounded-lg appearance-none cursor-pointer slider-thumb" />
                            </div>
                        </div>
                        <div className="p-6 pt-4 border-t border-amber-200/50 dark:border-amber-700/30">
                            <button onClick={() => { console.log('[ReaderSettings] Close button'); onClose(); }} className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all">Close</button>
                        </div>
                    </div>
                </AnimatedWrapper>
            </div>
        </div>
    );
});
ReaderSettings.displayName = 'ReaderSettings';

// --- MAIN BOOKREADER COMPONENT ---
const BookReader: React.FC<BookReaderProps> = ({ book, isOpen, onClose, onProgressUpdate }) => {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [pages, setPages] = useState<Page[]>([]);
    // Set initial page from book.progress (percentage)
    const [currentPage, setCurrentPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    // Discord presence: set reading when opened, browsing when closed
    useEffect(() => {
        try {
            if (isOpen) {
                window.db.setPresenceReading?.(book.title, book.author);
            } else {
                window.db.setPresenceBrowsing?.();
            }
        } catch {}
    }, [isOpen, book.title, book.author]);
    const [showToc, setShowToc] = useState(false);
    // Current time (UI, top-right)
    const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    // Session info (live): elapsed time and pages read this session
    const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
    const [sessionPages, setSessionPages] = useState(0);

    const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('reader-fontSize') || 18));
    const [theme, setTheme] = useState<'light' | 'sepia' | 'dark'>(() => (localStorage.getItem('reader-theme') as 'light' | 'sepia' | 'dark') || 'light');
    const [lineHeight, setLineHeight] = useState(() => Number(localStorage.getItem('reader-lineHeight') || 1.7));
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(() => {
        try {
            const raw = localStorage.getItem(`reader-bookmarks-${book?.id}`);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) {
                // Back-compat: numbers -> objects; sanitize to even, dedupe, sort
                const objs: BookmarkEntry[] = parsed.map((v: any) => {
                    if (typeof v === 'number') return { index: v } as BookmarkEntry;
                    if (v && typeof v === 'object' && Number.isFinite(v.index)) return { index: v.index, label: typeof v.label === 'string' ? v.label : undefined } as BookmarkEntry;
                    return null as any;
                }).filter(Boolean);
                const sanitized = Array.from(new Map(
                    objs
                        .filter(b => b.index >= 0)
                        .map(b => ({ index: b.index % 2 === 0 ? b.index : b.index - 1, label: b.label }))
                        .map(b => [b.index, b]) // dedupe by index, keep last label
                ).values()).sort((a, b) => a.index - b.index);
                return sanitized;
            }
            return [];
        } catch {
            return [];
        }
    });
    const [chapterStarts, setChapterStarts] = useState<number[]>([]);
    
    const pageContainerRef = useRef<HTMLDivElement>(null);
    const hideControlsTimer = useRef<NodeJS.Timeout>();
    const lastProgressUpdateRef = useRef<number>(0);
    const prevPageRef = useRef<number>(0);
    // Tracking for Wellbeing
    const sessionStartRef = useRef<number | null>(null);
    const sessionPagesRef = useRef<number>(0);
    const prevBookIdRef = useRef<number>(book.id);

    // Helper to flush the current session for a specific bookId
    const flushCurrentSession = (bookId: number) => {
        if (!sessionStartRef.current) return;
        const start = sessionStartRef.current;
        const end = Date.now();
        const pages = Math.max(0, sessionPagesRef.current);
        sessionStartRef.current = null;
        sessionPagesRef.current = 0;
        if (end - start < 30_000) return; // ignore trivial sessions
        // Try to persist to DB via preload; fallback to localStorage if unavailable
        try {
            const api = (window as any).db;
            if (api && typeof api.addReadingSession === 'function') {
                api.addReadingSession({ bookId, start, end, pages }).catch(() => {
                    appendReadingSession({ bookId, start, end, pages });
                });
            } else {
                appendReadingSession({ bookId, start, end, pages });
            }
        } catch {
            appendReadingSession({ bookId, start, end, pages });
        }
    };

    const fontFamily = 'Inter, sans-serif';
    const margin = 40;

    // Dev flag for conditional logging (Vite)
    const isDev = import.meta.env.DEV;

    // Trigger repagination on container resize (debounced)
    const [containerSizeKey, setContainerSizeKey] = useState(0);
    const resizeDebounceRef = useRef<NodeJS.Timeout | null>(null);

    
    
    // Keep current time updated (align to minute boundary)
    useEffect(() => {
        const update = () => setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        update();
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let intervalId: ReturnType<typeof setInterval> | undefined;
        const schedule = () => {
            const now = new Date();
            const delay = Math.max(0, (60 - now.getSeconds()) * 1000 - now.getMilliseconds());
            timeoutId = setTimeout(() => {
                update();
                intervalId = setInterval(update, 60 * 1000);
            }, delay);
        };
        schedule();
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            if (intervalId) clearInterval(intervalId);
        };
    }, []);

    // Track reading session lifecycle based on isOpen
    useEffect(() => {
        if (!isOpen) return; // only when opening
        // start session for current book
        sessionStartRef.current = Date.now();
        sessionPagesRef.current = 0;
        setSessionElapsedMs(0);
        setSessionPages(0);
        // reset hydration reminder state
        setShowHydration(false);
        lastHydrationSlotRef.current = -1;
    // We'll set prevPageRef to the starting page once pages are restored
    prevPageRef.current = Number.NaN as unknown as number;
        prevBookIdRef.current = book.id;

        const beforeUnload = () => flushCurrentSession(prevBookIdRef.current);
        window.addEventListener('beforeunload', beforeUnload);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            // On closing the reader (isOpen flips false or unmount), flush for last active book
            flushCurrentSession(prevBookIdRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Observe container size changes to repaginate when layout changes
    useEffect(() => {
        if (!isOpen) return;
        const el = pageContainerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => {
            if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
            resizeDebounceRef.current = setTimeout(() => {
                setContainerSizeKey((k) => (k + 1) % 1_000_000_000);
            }, 150);
        });
        ro.observe(el);
        return () => {
            ro.disconnect();
            if (resizeDebounceRef.current) {
                clearTimeout(resizeDebounceRef.current);
                resizeDebounceRef.current = null;
            }
        };
    }, [isOpen]);

    // If user switches to a different book while the reader stays open, split sessions
    useEffect(() => {
        if (!isOpen) return;
        const prevBookId = prevBookIdRef.current;
        if (prevBookId !== book.id) {
            // Flush the session for the previous book
            flushCurrentSession(prevBookId);
            // Start a new session for the new book
            sessionStartRef.current = Date.now();
            sessionPagesRef.current = 0;
            setSessionElapsedMs(0);
            setSessionPages(0);
            setShowHydration(false);
            lastHydrationSlotRef.current = -1;
            // Ignore the first page update
            prevPageRef.current = Number.NaN as unknown as number;
            prevBookIdRef.current = book.id;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book.id, isOpen]);

    // Count forward page turns for session pages metric
    useEffect(() => {
        if (!isOpen) return;
        const prev = prevPageRef.current as any;
        // If prev is not yet initialized (NaN), initialize without counting
        if (!Number.isFinite(prev)) {
            prevPageRef.current = currentPage;
            return;
        }
        const diff = currentPage - (prev as number);
        if (diff > 0) {
            const inc = diff; // two-page view counts both leaves
            sessionPagesRef.current += inc;
            setSessionPages((p) => p + inc);
        }
        prevPageRef.current = currentPage;
    }, [currentPage, isOpen]);

    // Live timer for current session
    useEffect(() => {
        if (!isOpen) return;
        const tick = () => {
            const start = sessionStartRef.current ?? Date.now();
            setSessionElapsedMs(Date.now() - start);
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [isOpen]);

    const formattedSessionTime = useMemo(() => {
        const total = Math.max(0, sessionElapsedMs);
        const h = Math.floor(total / 3_600_000);
        const m = Math.floor((total % 3_600_000) / 60_000);
        const s = Math.floor((total % 60_000) / 1000);
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    }, [sessionElapsedMs]);

    // Improved fallback splitter: splits at word/paragraph boundaries, never mid-word, prefers paragraph breaks.
    // DOM-based pagination: use a hidden measurement div to paginate content pixel-perfectly
    const splitChapterIntoPages = (
        content: string,
        pageWidth: number,
        pageHeight: number,
        fSize: number,
        lh: number
    ) => {
        if (!content) return [''];
        // Create a hidden measurement div if not already present
        let measurer = document.getElementById('page-measurer') as HTMLDivElement | null;
        if (!measurer) {
            measurer = document.createElement('div');
            measurer.id = 'page-measurer';
            measurer.style.position = 'absolute';
            measurer.style.visibility = 'hidden';
            measurer.style.pointerEvents = 'none';
            measurer.style.zIndex = '-1';
            measurer.style.left = '-99999px';
            measurer.style.top = '0';
            measurer.style.width = pageWidth + 'px';
            measurer.style.fontFamily = 'Inter, sans-serif';
            measurer.style.fontSize = fSize + 'px';
            measurer.style.lineHeight = lh.toString();
            // Match renderer text behavior for hyphenation/word-wrapping during measurement
            measurer.style.hyphens = 'auto';
            (measurer.style as any).wordBreak = 'normal';
            (measurer.style as any).overflowWrap = 'break-word';
            measurer.style.padding = '0';
            measurer.style.margin = '0';
            measurer.style.boxSizing = 'border-box';
            document.body.appendChild(measurer);
        } else {
            measurer.style.width = pageWidth + 'px';
            measurer.style.fontSize = fSize + 'px';
            measurer.style.lineHeight = lh.toString();
            measurer.style.hyphens = 'auto';
            (measurer.style as any).wordBreak = 'normal';
            (measurer.style as any).overflowWrap = 'break-word';
        }

        // Helpers
        const normalize = (s: string) => s.trim().startsWith('<') ? s : `<p>${s}</p>`;
        const joinCurrent = (arr: string[]) => arr.map(normalize).join('');
        const setMeasure = (html: string) => { measurer!.innerHTML = html; };
        const fitsHeight = (html: string) => { setMeasure(html); return measurer!.offsetHeight <= pageHeight; };
        const getWords = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const maxWordsThatFit = (prefixHtml: string, words: string[]): number => {
            let lo = 0, hi = words.length, best = 0;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                const candidate = prefixHtml + normalize(words.slice(0, mid).join(' '));
                if (fitsHeight(candidate)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
            }
            return best;
        };

        // Split into logical blocks by closing tags of common block elements; fallback to double newlines
        let paragraphs = content
            .split(/(?<=<\/p>|<\/h[1-6]>|<\/ul>|<\/ol>|<\/blockquote>|<hr\s*\/?\s*>)/gi)
            .map(p => p.trim())
            .filter(Boolean);
        if (paragraphs.length <= 1) {
            paragraphs = content.split(/\n\s*\n/gi).map(p => p.trim()).filter(Boolean);
        }
        const pages: string[] = [];
        let current: string[] = [];

        for (let i = 0; i < paragraphs.length; i++) {
            let para = paragraphs[i];
            if (!para) continue;

            const isHeading = /^\s*<h[1-6]\b/i.test(para);
            const nextPara = i + 1 < paragraphs.length ? paragraphs[i + 1] : '';

            const currentHtml = joinCurrent(current);
            const tryAdd = (htmlToAdd: string) => fitsHeight(currentHtml + normalize(htmlToAdd));

            // Keep-with-next for headings: avoid placing a heading at the bottom of a page
            if (isHeading) {
                const bothFitHere = nextPara ? fitsHeight(currentHtml + normalize(para) + normalize(nextPara)) : false;
                const headingFitsHere = tryAdd(para);
                if (!bothFitHere && headingFitsHere && current.length > 0) {
                    // Push current page to avoid heading at bottom
                    if (current.length > 0) pages.push(currentHtml);
                    current = [];
                    // Re-evaluate heading on a fresh page
                    const emptyHtml = '';
                    const bothFitFresh = nextPara ? fitsHeight(emptyHtml + normalize(para) + normalize(nextPara)) : false;
                    if (bothFitFresh) {
                        current.push(para);
                        current.push(nextPara);
                        i++; // consume next as well
                        continue;
                    } else {
                        current.push(para);
                        continue;
                    }
                }
            }

            // Try adding this paragraph
            if (tryAdd(para)) {
                current.push(para);
                continue;
            }

            // Overflow when adding para. First, basic widow/orphan control.
            // 1) Remove para from current (it wasn't actually added)
            // currentHtml already computed from current pre-add
            const linePx = Math.max(1, Math.round(fSize * lh));
            const getHeight = (html: string) => { setMeasure(html); return measurer!.offsetHeight; };
            const currHeight = getHeight(currentHtml);
            const leftover = Math.max(0, pageHeight - currHeight);
            const linesFit = Math.floor(leftover / linePx);
            const paraFitsFreshPage = fitsHeight(normalize(para));
            if (paraFitsFreshPage && linesFit < 2 && current.length > 0) {
                // Not enough lines to avoid a widow; push current page and start paragraph on next page intact
                pages.push(currentHtml);
                current = [para];
                continue;
            }

            // Otherwise: fill remaining space with part of this paragraph if possible.
            const words = getWords(para);
            let used = 0;
            if (current.length > 0) {
                const n = maxWordsThatFit(currentHtml, words);
                if (n > 0) {
                    const firstChunk = normalize(words.slice(0, n).join(' '));
                    pages.push(currentHtml + firstChunk);
                    used = n;
                } else {
                    // No room left on this page, push current as-is
                    pages.push(currentHtml);
                }
            }

            // 2) Split remaining words across full pages
            let remaining = words.slice(used);
            while (remaining.length > 0) {
                const m = maxWordsThatFit('', remaining);
                if (m <= 0) {
                    // Fallback safety: at least one word per page to avoid infinite loop
                    const fallback = normalize(remaining[0]);
                    pages.push(fallback);
                    remaining = remaining.slice(1);
                } else {
                    const chunkHtml = normalize(remaining.slice(0, m).join(' '));
                    pages.push(chunkHtml);
                    remaining = remaining.slice(m);
                }
            }

            // Start fresh for the next paragraph
            current = [];
        }

        if (current.length > 0) pages.push(joinCurrent(current));
        return pages;
    };
    
    const loadBook = useCallback(async () => {
        if (!book) {
            setError("No book selected.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        // Detect which API method is available in preload: prefer getEpubContent, fallback to loadBookContent
    const dbApi = (window as any).db || {};
    const loaderName = dbApi.getEpubContent ? 'getEpubContent' : (dbApi.loadBookContent ? 'loadBookContent' : null);
    if (isDev) console.log('[BookReader] Loading book, detected loader:', loaderName, 'for file:', book.file_path);

        if (!loaderName) {
            setError('Renderer API for reading EPUBs is not available (no getEpubContent / loadBookContent).');
            setIsLoading(false);
            return;
        }

        try {
            const bookContent = await (dbApi as any)[loaderName](book.file_path);
            if (isDev) console.log('[BookReader] Raw book content response:', bookContent);

            let loadedChapters: Chapter[] = [];

            // Common shape: { chapters: [...] }
            if (bookContent && Array.isArray(bookContent.chapters)) {
                loadedChapters = bookContent.chapters.map((c: any, idx: number) => ({ title: c.title || `Chapter ${idx+1}`, content: c.content || c.body || '', order: c.order ?? idx }));
            }

            // If handler returned just plain text, wrap into single chapter
            else if (typeof bookContent === 'string' && bookContent.trim().length > 0) {
                loadedChapters = [{ title: book.title || 'Book', content: bookContent, order: 0 }];
            }

            // If handler returned an array directly
            else if (Array.isArray(bookContent) && bookContent.length > 0 && typeof bookContent[0] === 'object') {
                loadedChapters = bookContent.map((c: any, idx: number) => ({ title: c.title || `Chapter ${idx+1}`, content: c.content || c.body || '', order: c.order ?? idx }));
            }

            if (isDev) console.log('[BookReader] Parsed chapters count from primary loader:', loadedChapters.length);

            // Fallback: if no chapters extracted, try getEpubText (plain text) if available
            if ((!loadedChapters || loadedChapters.length === 0) && dbApi.getEpubText) {
                if (isDev) console.log('[BookReader] Primary loader returned no chapters, trying getEpubText fallback');
                try {
                    const text = await dbApi.getEpubText(book.file_path);
                    if (typeof text === 'string' && text.trim().length > 0) {
                        loadedChapters = [{ title: book.title || 'Book', content: text, order: 0 }];
                        if (isDev) console.log('[BookReader] getEpubText returned content length:', text.length);
                    }
                } catch (textErr) {
                    if (isDev) console.warn('[BookReader] getEpubText fallback failed:', textErr);
                }
            }

            if (!loadedChapters || loadedChapters.length === 0) {
                throw new Error('No readable content was found in this book file.');
            }

            // Clean chapter titles to avoid showing file paths like "OEBPS/ch1.xhtml".
            const cleanTitle = (c: Chapter): string => {
                try {
                    const headingMatch = c.content.match(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i);
                    if (headingMatch) {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = headingMatch[2];
                        const text = (tmp.textContent || '').trim();
                        if (text) return text;
                    }
                } catch {}
                const raw = (c.title || '').trim();
                if (!raw) return raw;
                const looksLikeUrl = /^[a-z]+:\/\//i.test(raw);
                const looksLikePath = /[\\/]/.test(raw);
                const looksLikeFilename = /\.(x?html?|xml|txt)$/i.test(raw);
                if (looksLikeUrl || looksLikePath || looksLikeFilename) return '';
                return raw;
            };

            loadedChapters = loadedChapters.map((c) => ({
                ...c,
                title: cleanTitle(c) || c.title || ''
            }));

            setChapters(loadedChapters);
            if (isDev) console.log('[BookReader] setChapters called, count:', loadedChapters.length, loadedChapters[0] && { title: loadedChapters[0].title, snippet: loadedChapters[0].content?.slice(0,120) });
        } catch (err) {
            console.error('[BookReader] Error loading book content:', err);
            let message = 'An unknown error occurred while loading the book.';
            if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string') {
                message = (err as any).message;
            }
            setError(message);
            setIsLoading(false);
        }
    }, [book]);


    // Only load book when book.id or file_path changes, not on every open/close or progress update
    useEffect(() => {
        if (isOpen) {
            loadBook();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, book.id, book.file_path]);
    

    // Unified pagination effect: always splits chapters into pages, never single-page-per-chapter.
    useEffect(() => {
        let cancelled = false;
        const runPagination = async () => {
            if (chapters.length === 0) return;
            // Wait for the page container to mount and report a size.
            const waitForRef = (timeout = 2000) => new Promise<void>((resolve) => {
                const start = Date.now();
                const check = () => {
                    if (cancelled) return resolve();
                    if (pageContainerRef.current && pageContainerRef.current.offsetWidth > 0) return resolve();
                    if (Date.now() - start > timeout) return resolve();
                    requestAnimationFrame(check);
                };
                check();
            });
            await waitForRef(2000);
            if (cancelled) return;
            const container = pageContainerRef.current;
            // Get computed style to account for actual padding/border
            let pageContentWidth = 600;
            let pageContentHeight = 800;
            if (container) {
                const computed = window.getComputedStyle(container);
                const paddingTop = parseFloat(computed.paddingTop) || 0;
                const paddingBottom = parseFloat(computed.paddingBottom) || 0;
                const borderTop = parseFloat(computed.borderTopWidth) || 0;
                const borderBottom = parseFloat(computed.borderBottomWidth) || 0;
                pageContentWidth = Math.max(200, container.offsetWidth / 2 - (margin * 2));
                pageContentHeight = Math.max(
                    200,
                    container.offsetHeight - (margin * 2) - paddingTop - paddingBottom - borderTop - borderBottom
                );
                // Align height to line grid to avoid clipping last line
                const linePx = Math.max(1, Math.round(fontSize * lineHeight));
                if (linePx > 1) {
                    pageContentHeight = Math.floor(pageContentHeight / linePx) * linePx;
                }
            }
            let allPages: Page[] = [];
            const starts: number[] = [];
            let pnum = 1;
            const escHtml = (s: string) => s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            // Prefer a meaningful heading from chapter content; otherwise, only use chapter.title
            // when it doesn't look like a file path or URL.
            const deriveDisplayTitle = (c: Chapter): string | null => {
                try {
                    // 1) Look for the first h1/h2/h3 in the sanitized content
                    const headingMatch = c.content.match(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/i);
                    if (headingMatch) {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = headingMatch[2];
                        const text = (tmp.textContent || '').trim();
                        if (text) return text;
                    }

                    // 2) Fall back to chapter.title if it looks human-friendly
                    const raw = (c.title || '').trim();
                    if (!raw) return null;
                    const looksLikeUrl = /^[a-z]+:\/\//i.test(raw);
                    const looksLikePath = /[\\/]/.test(raw);
                    const looksLikeFilename = /\.(x?html?|xml|txt)$/i.test(raw);
                    if (looksLikeUrl || looksLikePath || looksLikeFilename) {
                        // Avoid showing paths like "OEBPS/chapter1.xhtml"
                        return null;
                    }
                    return raw;
                } catch {
                    return null;
                }
            };

            for (const c of chapters) {
                starts.push(allPages.length);
                let splits = splitChapterIntoPages(c.content, pageContentWidth, pageContentHeight, fontSize, lineHeight);
                // If the split somehow produced no visible content, fall back to plain-text page
                if (!splits || splits.length === 0 || splits.every(s => !s || !s.trim())) {
                    const plain = (c.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (plain) {
                        splits = [ `<p>${escHtml(plain)}</p>` ];
                    } else {
                        splits = [ '<p>\u00A0</p>' ]; // non-breaking space to ensure a minimal page
                    }
                }
                let isFirst = true;
                const chapterDisplayTitle = deriveDisplayTitle(c);
                for (let s of splits) {
                    if (isFirst) {
                        // If the first block doesn't already start with a heading, inject a meaningful title
                        if (!/^\s*<h[1-6]\b/i.test(s)) {
                            if (chapterDisplayTitle) {
                                s = `<h2>${escHtml(chapterDisplayTitle)}</h2>` + s;
                            }
                        }
                        isFirst = false;
                    }
                    allPages.push({ content: s, pageNumber: pnum++, chapterTitle: chapterDisplayTitle || c.title });
                }
                // yield to keep UI responsive
                // eslint-disable-next-line no-await-in-loop
                await new Promise(requestAnimationFrame);
            }
            if (!cancelled) {
                setPages(allPages);
                setChapterStarts(starts);
                if (isDev) console.log('[BookReader] unified pagination produced pages:', allPages.length);
                // Clamp currentPage to new page count
                setCurrentPage(prev => {
                    const maxIndex = Math.max(0, allPages.length - (allPages.length % 2 === 0 ? 2 : 1));
                    if (prev > maxIndex) return maxIndex;
                    return prev;
                });
            }
            if (!cancelled) setIsLoading(false);
        };
        runPagination();
        return () => { cancelled = true; };
    }, [chapters, fontSize, lineHeight, margin, containerSizeKey]);


    // When pages are ready, restore last-read page from book.progress
    useEffect(() => {
        if (pages.length === 0) return;
        // Only set on first load or when book changes
        let initialPage = 0;
        if (book.progress && book.progress > 0) {
            // Calculate the nearest valid even page index for two-page view
            const maxIndex = Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1));
            initialPage = Math.round((book.progress / 100) * pages.length);
            // Clamp to even page
            if (initialPage % 2 !== 0) initialPage--;
            initialPage = Math.max(0, Math.min(initialPage, maxIndex));
        }
        setCurrentPage(initialPage);
        // Initialize the prev page to the starting page so the first change isn't counted
        prevPageRef.current = initialPage;
    }, [pages.length, book.id]);

    useEffect(() => {
        if (isDev) console.log('[BookReader] currentPage changed to', currentPage, 'of', pages.length);
        // Do not update prevPageRef here; the counting effect manages it to avoid
        // counting the initial restore-from-progress jump as session pages.
    }, [currentPage, pages.length]);

    useEffect(() => {
        localStorage.setItem('reader-fontSize', String(fontSize));
        localStorage.setItem('reader-theme', theme);
        localStorage.setItem('reader-lineHeight', String(lineHeight));
    }, [fontSize, theme, lineHeight]);

    // Reload bookmarks when switching books so TOC shows correct entries (backward-compatible)
    useEffect(() => {
        try {
            const raw = localStorage.getItem(`reader-bookmarks-${book?.id}`);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) {
                const objs: BookmarkEntry[] = parsed.map((v: any) => {
                    if (typeof v === 'number') return { index: v } as BookmarkEntry;
                    if (v && typeof v === 'object' && Number.isFinite(v.index)) return { index: v.index, label: typeof v.label === 'string' ? v.label : undefined } as BookmarkEntry;
                    return null as any;
                }).filter(Boolean);
                const sanitized = Array.from(new Map(
                    objs
                        .filter(b => b.index >= 0)
                        .map(b => ({ index: b.index % 2 === 0 ? b.index : b.index - 1, label: b.label }))
                        .map(b => [b.index, b])
                ).values()).sort((a, b) => a.index - b.index);
                setBookmarks(sanitized);
            } else setBookmarks([]);
        } catch {
            setBookmarks([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [book?.id]);

    // Persist bookmarks (objects)
    useEffect(() => {
        try {
            localStorage.setItem(`reader-bookmarks-${book?.id}`, JSON.stringify(bookmarks));
        } catch {}
    }, [book?.id, bookmarks]);

    const changePage = useCallback((direction: number) => {
        setCurrentPage(prev => {
            const maxIndex = Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1));
            const newPage = Math.max(0, Math.min(prev + direction, maxIndex));
            if (pages.length > 0) {
                const update = () => {
                    let progress = ((newPage + 2) / pages.length) * 100;
                    const maxIdx = Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1));
                    if (newPage >= maxIdx) progress = 100;
                    const roundedProgress = Math.round(progress);
                    let newStatus = 'unread';
                    if (roundedProgress >= 100) newStatus = 'finished';
                    else if (roundedProgress > 0) newStatus = 'reading';
                    try {
                        const now = Date.now();
                        if (now - lastProgressUpdateRef.current > 500) {
                            lastProgressUpdateRef.current = now;
                            onProgressUpdate(book.id, roundedProgress);
                            if (window.db && window.db.updateBook) {
                                window.db.updateBook(book.id, {
                                    title: book.title,
                                    author: book.author,
                                    progress: roundedProgress,
                                    status: newStatus,
                                    file_path: book.file_path
                                });
                            }
                            if (isDev) console.log('[BookReader] onProgressUpdate called and saved to DB', { bookId: book.id, progress: roundedProgress, newStatus });
                        } else {
                            requestAnimationFrame(() => {
                                try {
                                    onProgressUpdate(book.id, roundedProgress);
                                    if (window.db && window.db.updateBook) {
                                        window.db.updateBook(book.id, {
                                            title: book.title,
                                            author: book.author,
                                            progress: roundedProgress,
                                            status: newStatus,
                                            file_path: book.file_path
                                        });
                                    }
                                } catch (e) {
                                    if (isDev) console.warn('[BookReader] deferred onProgressUpdate failed', e);
                                }
                            });
                        }
                    } catch (e) {
                        console.error('[BookReader] onProgressUpdate error:', e);
                    }
                };
                update();
            }
            return newPage;
        });
    }, [pages.length, onProgressUpdate, book.id, book.title, book.author, book.file_path]);

    const gotoPage = useCallback((pageIndex: number) => {
        setCurrentPage(() => {
            const evenIndex = pageIndex % 2 === 0 ? pageIndex : pageIndex - 1;
            const maxIndex = Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1));
            const clamped = Math.max(0, Math.min(evenIndex, maxIndex));
            // Save progress same as changePage
            if (pages.length > 0) {
                let progress = ((clamped + 2) / pages.length) * 100;
                const maxIdx = Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1));
                if (clamped >= maxIdx) progress = 100;
                const roundedProgress = Math.round(progress);
                let newStatus = 'unread';
                if (roundedProgress >= 100) newStatus = 'finished';
                else if (roundedProgress > 0) newStatus = 'reading';
                try {
                    const now = Date.now();
                    if (now - lastProgressUpdateRef.current > 500) {
                        lastProgressUpdateRef.current = now;
                        onProgressUpdate(book.id, roundedProgress);
                        if (window.db && window.db.updateBook) {
                            window.db.updateBook(book.id, {
                                title: book.title,
                                author: book.author,
                                progress: roundedProgress,
                                status: newStatus,
                                file_path: book.file_path
                            });
                        }
                    } else {
                        requestAnimationFrame(() => {
                            try {
                                onProgressUpdate(book.id, roundedProgress);
                                if (window.db && window.db.updateBook) {
                                    window.db.updateBook(book.id, {
                                        title: book.title,
                                        author: book.author,
                                        progress: roundedProgress,
                                        status: newStatus,
                                        file_path: book.file_path
                                    });
                                }
                            } catch (e) {
                                if (isDev) console.warn('[BookReader] deferred onProgressUpdate failed', e);
                            }
                        });
                    }
                } catch (e) {
                    console.error('[BookReader] onProgressUpdate error:', e);
                }
            }
            return clamped;
        });
    }, [pages.length, onProgressUpdate, book.id, book.title, book.author, book.file_path]);

    const toggleBookmark = useCallback(() => {
        setBookmarks(prev => {
            const evenIndex = currentPage % 2 === 0 ? currentPage : currentPage - 1;
            const existsIdx = prev.findIndex(b => b.index === evenIndex);
            if (existsIdx >= 0) {
                const next = [...prev];
                next.splice(existsIdx, 1);
                return next;
            }
            const chapter = pages[evenIndex]?.chapterTitle;
            const defaultLabel = `${chapter ?? 'Bookmark'} · Page ${evenIndex + 1}`;
            const next = [...prev, { index: evenIndex, label: defaultLabel }];
            next.sort((a, b) => a.index - b.index);
            return next;
        });
    }, [currentPage, pages]);

    const isBookmarked = useMemo(() => {
        const evenIndex = currentPage % 2 === 0 ? currentPage : currentPage - 1;
        return bookmarks.some(b => b.index === evenIndex);
    }, [bookmarks, currentPage]);

    // Determine current chapter based on page index
    const currentChapterIndex = useMemo(() => {
        if (chapterStarts.length === 0) return 0;
        let idx = 0;
        for (let i = 0; i < chapterStarts.length; i++) {
            if (chapterStarts[i] <= currentPage) idx = i; else break;
        }
        return idx;
    }, [chapterStarts, currentPage]);

    const goToChapter = useCallback((index: number) => {
        if (index < 0 || index >= chapterStarts.length) return;
        const start = chapterStarts[index];
        gotoPage(start);
        setShowToc(false);
    }, [chapterStarts, gotoPage]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (showSettings) return;
            switch (e.key) {
                case 'ArrowLeft': e.preventDefault(); changePage(-2); break;
                case 'ArrowRight': e.preventDefault(); changePage(2); break;
                case 'Home': e.preventDefault(); gotoPage(0); break;
                case 'End': e.preventDefault(); gotoPage(Number.MAX_SAFE_INTEGER); break;
                case 'b': case 'B': e.preventDefault(); toggleBookmark(); break;
                case 't': case 'T': e.preventDefault(); setShowToc(s => !s); break;
                case '+': case '=': e.preventDefault(); setFontSize(s => Math.min(32, s + 1)); break;
                case '-': e.preventDefault(); setFontSize(s => Math.max(12, s - 1)); break;
                case 'Escape': if (showToc) { e.preventDefault(); setShowToc(false); } break;
                default: break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, showSettings, showToc, changePage, gotoPage, toggleBookmark]);
    
    useEffect(() => {
        const handleActivity = () => {
            setShowControls(true);
            if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
            hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
        };
        if (isOpen && !showSettings) {
            window.addEventListener('mousemove', handleActivity, { passive: true });
            window.addEventListener('keydown', handleActivity);
            return () => {
                window.removeEventListener('mousemove', handleActivity as EventListener);
                window.removeEventListener('keydown', handleActivity as EventListener);
                if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
            };
        }
    }, [isOpen, showSettings]);

    // Cleanup hidden measurer node on unmount to avoid leaks
    useEffect(() => {
        return () => {
            const measurer = document.getElementById('page-measurer');
            if (measurer && measurer.parentElement) measurer.parentElement.removeChild(measurer);
        };
    }, []);

    const totalPages = pages.length;

    const backgroundClass = useMemo(() => {
        switch (theme) {
            case 'dark': return 'bg-gradient-to-br from-gray-800 to-black';
            case 'sepia': return 'bg-gradient-to-br from-amber-100 to-yellow-100';
            default: return 'bg-gradient-to-br from-stone-100 to-slate-100';
        }
    }, [theme]);

    // Subtle appear/disappear for HUD without unmounting
    const hudVisibilityClass = showControls
        ? 'opacity-100 translate-y-0 pointer-events-auto'
        : 'opacity-0 translate-y-2 pointer-events-none';

    // Media controls state disabled for submission
    // Hydration reminder state
    const [showHydration, setShowHydration] = useState(false);
    const lastHydrationSlotRef = useRef<number>(-1);
    // Hydration reminder: show once every 30 minutes of active session
    useEffect(() => {
        if (!isOpen) return;
        const slot = Math.floor(sessionElapsedMs / (30 * 60 * 1000));
        if (slot > 0 && slot !== lastHydrationSlotRef.current) {
            lastHydrationSlotRef.current = slot;
            setShowHydration(true);
        }
    }, [sessionElapsedMs, isOpen]);
    // Auto-hide the hydration toast after a few seconds
    useEffect(() => {
        if (!showHydration) return;
        const t = setTimeout(() => setShowHydration(false), 10000);
        return () => clearTimeout(t);
    }, [showHydration]);


    // Media controls disabled for submission
    useEffect(() => {
        // intentionally no-op
    }, []);

    // Media controls disabled for submission (playback state no-op)
    // useEffect(() => {
    //     // intentionally no-op
    // }, [isPlaying]);

    // Media controls disabled for submission (no global media key subscription)
    useEffect(() => {
        // intentionally no-op
    }, [changePage]);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-50 ${backgroundClass}`}>
            {isLoading && (
                <AnimatedWrapper>
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-900/25 backdrop-blur-md z-50">
                        <div className="text-center animate-fade-in">
                            <div className="relative mb-6 flex items-center justify-center">
                                <img
                                    src="/RunCatb.gif"
                                    alt="Running cat loading"
                                    className="h-20 w-auto drop-shadow-sm select-none"
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-1">
                                Loading your book...
                            </h3>
                            <p className="text-amber-800/80 dark:text-amber-200/80 text-sm">
                                Please wait while we prepare your pages
                            </p>
                        </div>
                    </div>
                </AnimatedWrapper>
            )}
            {error && (
                <AnimatedWrapper>
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-900/25 backdrop-blur-md z-50">
                        <div className="text-center p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-800 dark:to-amber-950/30 rounded-2xl max-w-md w-[92%] border border-amber-200/60 dark:border-amber-700/40 shadow-2xl">
                            <AlertCircle className="mx-auto text-red-500/90 mb-3" size={40} />
                            <h3 className="font-bold text-lg mb-2 text-amber-900 dark:text-amber-100">Error loading book</h3>
                            <p className="text-amber-800/80 dark:text-amber-200/80 text-sm">{error}</p>
                            <button onClick={onClose} className="mt-5 w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold shadow-lg">Close</button>
                        </div>
                    </div>
                </AnimatedWrapper>
            )}
            
            {!isLoading && !error && chapters.length > 0 && (
                <>
                    <div className="h-full flex items-center justify-center p-8" ref={pageContainerRef}>
                        <AnimatedWrapper animationClass="animate-scale-in" delay={100}>
                            <div className="relative shadow-2xl bg-black/10 rounded-3xl p-1" style={{ width: 'min(90vw, 1200px)', height: 'min(85vh, 800px)' }}>
                                <div className="flex h-full w-full">
                                    <div className="w-1/2 h-full">
                                        {pages[currentPage] && <BookPage {...pages[currentPage]} isLeft={true} {...{theme, fontSize, lineHeight, fontFamily, margin}} />}
                                    </div>
                                    <div className="w-1/2 h-full">
                                        {pages[currentPage + 1] && <BookPage {...pages[currentPage + 1]} isLeft={false} {...{theme, fontSize, lineHeight, fontFamily, margin}} />}
                                    </div>
                                </div>
                                <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-gradient-to-r from-black/0 via-black/20 to-black/0 -translate-x-1 z-10 pointer-events-none" />
                                {/* Click hot-zones for page navigation */}
                                <button
                                    type="button"
                                    aria-label="Previous pages"
                                    className="absolute top-0 left-0 h-full w-[18%] z-20 cursor-pointer bg-transparent hover:bg-black/0 focus:outline-none"
                                    onClick={() => changePage(-2)}
                                />
                                <button
                                    type="button"
                                    aria-label="Next pages"
                                    className="absolute top-0 right-0 h-full w-[18%] z-20 cursor-pointer bg-transparent hover:bg-black/0 focus:outline-none"
                                    onClick={() => changePage(2)}
                                />
                            </div>
                        </AnimatedWrapper>
                    </div>

                    {/* HUD: keep mounted and animate visibility for smoother in/out */}
                    <AnimatedWrapper animationClass="animate-slide-in-down" delay={200} className={`absolute top-6 left-6 right-6 flex justify-between items-start z-40 transition-all duration-300 ease-out ${hudVisibilityClass}`}>
                        <div className="bg-gradient-to-br from-amber-50/95 to-orange-50/90 dark:from-stone-800/95 dark:to-amber-950/80 rounded-2xl p-4 text-amber-900 max-w-md select-none border border-amber-200/60 dark:border-amber-700/40 shadow-lg">
                            <h2 className="font-bold text-lg mb-1">{book.title}</h2>
                            <p className="text-sm opacity-80">by {book.author}</p>
                            <p className="text-xs opacity-70 mt-1">
                                This session: {formattedSessionTime} · {sessionPages} page{sessionPages === 1 ? '' : 's'}
                            </p>
                            {totalPages > 0 && (
                                <button
                                    type="button"
                                    aria-label="Scrub reading progress"
                                    title="Click to jump"
                                    onClick={(e) => {
                                        const rect = (e.currentTarget.firstElementChild as HTMLDivElement)?.getBoundingClientRect();
                                        const x = e.clientX;
                                        if (!rect) return;
                                        const ratio = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
                                        const target = Math.round(ratio * Math.max(0, totalPages - 1));
                                        const aligned = target - (target % 2);
                                        gotoPage(aligned);
                                    }}
                                    className="mt-3 w-full"
                                >
                                    <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, ((currentPage + 1) / Math.max(totalPages, 1)) * 100))}%` }} />
                                    </div>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center space-x-3 select-none">
                            
                            <button onClick={() => setShowToc(s => !s)}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow-lg hover:shadow-xl hover:from-amber-500/95 hover:to-orange-600/95 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                                title="Contents (T)"><List size={20} /></button>
                            <button onClick={toggleBookmark}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow-lg hover:shadow-xl hover:from-amber-500/95 hover:to-orange-600/95 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                                title={isBookmarked ? 'Remove Bookmark (B)' : 'Add Bookmark (B)'}>{isBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}</button>
                            <button onClick={() => setShowSettings(true)}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow-lg hover:shadow-xl hover:from-amber-500/95 hover:to-orange-600/95 focus:outline-none focus:ring-2 focus:ring-amber-400/60"><Settings size={20} /></button>
                            <button onClick={onClose}
                                className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow-lg hover:shadow-xl hover:from-amber-500/95 hover:to-orange-600/95 focus:outline-none focus:ring-2 focus:ring-amber-400/60"><X size={20} /></button>
                            <div className="relative">
                                <img
                                    src="/SleepCatb.gif"
                                    alt="Sleeping cat"
                                    className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-10 w-auto drop-shadow-sm select-none"
                                />
                                <div
                                    className="h-12 px-4 flex items-center rounded-full bg-gradient-to-br from-amber-50/95 to-orange-50/90 dark:from-stone-800/95 dark:to-amber-950/80 border border-amber-200/60 dark:border-amber-700/40 text-amber-900 dark:text-amber-100 font-medium shadow-lg"
                                    aria-label="Current time"
                                    title="Current time"
                                >
                                    {currentTime}
                                </div>
                            </div>
                        </div>
                    </AnimatedWrapper>
                    {/* Hydration toast with smooth enter/exit and top-right alignment */}
                    <div
                        className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 top-6 z-40 transition-all duration-300 ease-out ${showHydration ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
                        aria-live="polite"
                        aria-atomic="true"
                        role="status"
                    >
                            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md bg-gradient-to-br from-sky-50/95 to-cyan-50/90 dark:from-sky-900/50 dark:to-cyan-900/40 border-sky-300/60 dark:border-sky-700/40 text-sky-900 dark:text-sky-100">
                                <div className="w-9 h-9 rounded-xl bg-sky-200/70 dark:bg-sky-800/60 flex items-center justify-center shadow">
                                    <BsDropletFill size={18} className="text-sky-600 dark:text-sky-400" />
                                </div>
                                <div className="text-sm font-semibold">Time to hydrate</div>
                                <div className="text-xs opacity-70 hidden sm:block">Take a sip of water</div>
                                <button
                                    className="ml-2 px-2 py-1 text-xs rounded-lg bg-sky-100/80 dark:bg-sky-800/60 border border-sky-300/60 dark:border-sky-700/40 hover:bg-sky-100 text-sky-800 dark:text-sky-100"
                                    onClick={() => setShowHydration(false)}
                                >
                                    Dismiss
                                </button>
                            </div>
                    </div>
                    <AnimatedWrapper animationClass="animate-slide-in-up" delay={250} className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-out ${hudVisibilityClass}`}>
                        <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/80 backdrop-blur-md rounded-full px-6 py-3 text-amber-900 flex items-center gap-10 border border-amber-200/60 shadow-xl">
                            {/* Left: navigation to start and previous */}
                            <div className="flex items-center gap-3">
                                <button onClick={() => setCurrentPage(0)} disabled={currentPage <= 0} className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-50 bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md"><SkipBack size={16} /></button>
                                <button onClick={() => changePage(-2)} disabled={currentPage <= 0} className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-50 bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md"><ChevronLeft size={18} /></button>
                            </div>

                            {/* Center: page counter above slider */}
                            <div className="flex flex-col items-center gap-2 min-w-[240px]">
                                <div className="text-xs">Page {currentPage + 1} of {totalPages}</div>
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.max(0, totalPages - 1)}
                                    step={2}
                                    value={currentPage}
                                    onChange={(e) => gotoPage(Number(e.target.value))}
                                    className="w-56 h-2 bg-amber-200/50 rounded-lg appearance-none cursor-pointer slider-thumb"
                                    title="Jump to page"
                                />
                            </div>

                            {/* Right: typography and forward navigation; room for media controls later */}
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    {/* <button onClick={() => setFontSize(s => Math.max(12, s - 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md" title="Smaller (−)"><Minus size={16} /></button>
                                    <button onClick={() => setFontSize(s => Math.min(32, s + 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md" title="Larger (+)"><Plus size={16} /></button> */}
                                    <button onClick={() => changePage(2)} disabled={currentPage >= totalPages - 2} className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-50 bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md"><ChevronRight size={18} /></button>
                                        <button onClick={() => setCurrentPage(Math.max(0, totalPages - (totalPages % 2 === 0 ? 2 : 1)))} disabled={currentPage >= totalPages - 2} className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-50 bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md"><SkipForward size={16} /></button>
                                </div>
                                {/* Media controls disabled for submission */}
                                {/* <div className="w-px h-8 bg-amber-200/60" />
                                <div className="flex items-center gap-2 bg-white/50 rounded-full px-3 py-1.5 border border-amber-200/60 shadow-sm">
                                    <span className="text-xs opacity-70 hidden sm:block">Now Playing: —</span>
                                    <div className="flex items-center gap-2">
                                        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md" aria-label="Previous track"><SkipBack size={14} /></button>
                                        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md" aria-label="Play/Pause"><Play size={14} /></button>
                                        <button className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white border border-amber-200/60 shadow hover:shadow-md" aria-label="Next track"><SkipForward size={14} /></button>
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </AnimatedWrapper>
                    {/* If pagination still hasn't produced pages, show a small notice */}
                    {pages.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold shadow-lg border border-amber-200/60">Preparing pages…</div>
                        </div>
                    )}
                </>
            )}

            <ReaderSettings isOpen={showSettings} onClose={() => setShowSettings(false)} {...{fontSize, onFontSizeChange: setFontSize, theme, onThemeChange: setTheme, lineHeight, onLineHeightChange: setLineHeight}} />

            {/* TOC / Bookmarks Sidebar */}
            {showToc && (
                <div className="absolute inset-0 z-50" onClick={() => setShowToc(false)}>
                    <div className="absolute inset-0 bg-amber-900/25 backdrop-blur-[1px]" />
                    <div className="absolute top-0 left-0 h-full w-[320px] bg-gradient-to-b from-amber-50/95 to-orange-50/95 dark:from-stone-800/95 dark:to-amber-950/80 border-r border-amber-200/60 dark:border-amber-700/40 shadow-2xl animate-slide-in-left" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4">
                            <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-4 border border-amber-200/60 dark:border-amber-700/40 shadow-sm">
                                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">Contents</h3>
                                <p className="text-xs text-amber-700/70 dark:text-amber-300/70">Jump to a chapter or a bookmark</p>
                            </div>
                        </div>
                        <div className="px-4 pb-4 space-y-4 overflow-y-auto h-[calc(100%-96px)] custom-scrollbar">
                            {/* Bookmarks first */}
                            <BookmarksSection
                                bookmarks={bookmarks}
                                onRename={(index, newLabel) => {
                                    setBookmarks(prev => prev.map(b => b.index === index ? { ...b, label: newLabel } : b));
                                }}
                                onNavigate={(index) => { gotoPage(index); setShowToc(false); }}
                                onRemove={(index) => {
                                    setBookmarks(prev => prev.filter(b => b.index !== index));
                                }}
                            />
                            {/* Chapters second */}
                            <ChaptersSection
                                chapters={chapters}
                                currentChapterIndex={currentChapterIndex}
                                onGoToChapter={goToChapter}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sidebar subcomponents: Bookmarks and Chapters ---
const BookmarksSection: React.FC<{
    bookmarks: BookmarkEntry[];
    onRename: (index: number, newLabel: string) => void;
    onNavigate: (index: number) => void;
    onRemove: (index: number) => void;
}> = ({ bookmarks, onRename, onNavigate, onRemove }) => {
    const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
    const [text, setText] = React.useState('');

    const startEdit = (index: number, current: string) => {
        setEditingIndex(index);
        setText(current);
    };
    const commit = () => {
        if (editingIndex === null) return;
        const trimmed = text.trim();
        if (!trimmed) {
            const existing = bookmarks.find(b => b.index === editingIndex);
            const fallback = existing?.label?.trim() || `Page ${editingIndex + 1}`;
            onRename(editingIndex, fallback);
        } else {
            onRename(editingIndex, trimmed);
        }
        setEditingIndex(null);
        setText('');
    };
    const cancel = () => { setEditingIndex(null); setText(''); };

    return (
        <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-3 border border-amber-200/60 dark:border-amber-700/40 shadow-sm">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2"><Bookmark size={14} /> Bookmarks</h4>
            {bookmarks.length === 0 ? (
                <p className="text-xs text-amber-700/70 dark:text-amber-300/70">No bookmarks yet. Add one with B.</p>
            ) : (
                <div className="space-y-1">
                    {bookmarks.map((b) => {
                        const label = b.label?.trim() || `Page ${b.index + 1}`;
                        const isEditing = editingIndex === b.index;
                        return (
                            <div key={b.index} className="w-full px-3 py-2 rounded-xl text-sm bg-white/50 dark:bg-stone-700/50 text-amber-800 dark:text-amber-200 border border-amber-200/50 shadow-sm flex items-center gap-2">
                                {isEditing ? (
                                    <>
                                        <input
                                            className="flex-1 min-w-0 bg-transparent outline-none border border-amber-300/60 rounded-lg px-2 py-1 text-sm"
                                            value={text}
                                            onChange={e => setText(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
                                            autoFocus
                                        />
                                        <button className="shrink-0 text-xs px-2 py-1 rounded-lg bg-amber-500/90 text-white border border-amber-200/50" onClick={commit}>Save</button>
                                        <button className="shrink-0 text-xs px-2 py-1 rounded-lg bg-stone-300/80 dark:bg-stone-600/80 border border-amber-200/50" onClick={cancel}>Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            className="flex-1 min-w-0 text-left truncate hover:underline"
                                            title={label}
                                            onClick={() => onNavigate(b.index)}
                                        >
                                            {label}
                                        </button>
                                        <button
                                            className="ml-2 p-1.5 rounded-lg bg-white/60 dark:bg-stone-700/60 hover:bg-amber-50/80 dark:hover:bg-stone-700 border border-amber-200/60"
                                            title="Rename bookmark"
                                            onClick={() => startEdit(b.index, label)}
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            className="p-1.5 rounded-lg bg-white/60 dark:bg-stone-700/60 hover:bg-red-50/80 dark:hover:bg-stone-700 border border-amber-200/60 text-red-600"
                                            title="Delete bookmark"
                                            onClick={() => onRemove(b.index)}
                                        >
                                            <Trash size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ChaptersSection: React.FC<{
    chapters: Chapter[];
    currentChapterIndex: number;
    onGoToChapter: (i: number) => void;
}> = ({ chapters, currentChapterIndex, onGoToChapter }) => {
    return (
        <div className="bg-white/60 dark:bg-stone-700/60 rounded-xl p-3 border border-amber-200/60 dark:border-amber-700/40 shadow-sm">
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">Chapters</h4>
            <div className="space-y-1">
                {chapters.map((c, i) => (
                    <button
                        key={i}
                        onClick={() => onGoToChapter(i)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm shadow-sm transition-colors ${i === currentChapterIndex
                            ? 'bg-amber-100/70 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 border border-amber-400/60 ring-2 ring-amber-300/40'
                            : 'bg-white/50 dark:bg-stone-700/50 hover:bg-amber-50/60 dark:hover:bg-stone-700/70 text-amber-800 dark:text-amber-200 border border-amber-200/50'}`}
                        title={c.title}
                    >
                        <span className="truncate block">{i + 1}. {c.title || `Chapter ${i + 1}`}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BookReader;