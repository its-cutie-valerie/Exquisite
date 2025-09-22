import React, { useEffect, useMemo, useState } from 'react';
import { X, Leaf, BookOpen, Clock, CalendarClock, BarChart3 } from 'lucide-react';

type Book = {
  id: number;
  title: string;
  author: string;
  progress: number;
  cover_path?: string;
};

type DayStats = {
  date: string; // YYYY-MM-DD
  minutes: number;
  pages: number;
};

// Lightweight local read of a potential client-side log (future-proofing)
// Format suggestion (not enforced yet):
// localStorage['reading_sessions'] = JSON.stringify(Array<{ bookId:number; start:number; end:number; pages:number }>())
function getLocalReadingSessions(): Array<{ bookId: number; start: number; end: number; pages?: number }> {
  try {
    const raw = localStorage.getItem('reading_sessions');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function groupSessionsByDay(sessions: Array<{ start: number; end: number; pages?: number }>): DayStats[] {
  const map = new Map<string, DayStats>();
  for (const s of sessions) {
    const day = new Date(s.start).toISOString().slice(0, 10);
    const minutes = Math.max(0, Math.round((s.end - s.start) / 60000));
    const entry = map.get(day) || { date: day, minutes: 0, pages: 0 };
    entry.minutes += minutes;
    entry.pages += s.pages ?? 0;
    map.set(day, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface WellbeingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WellbeingModal: React.FC<WellbeingModalProps> = ({ isOpen, onClose }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | 'all'>('all');

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const list = await (window as any).db?.getBooks?.();
        setBooks(list || []);
        setLoading(false);
      } catch (e) {
        console.warn('[Wellbeing] failed to load books', e);
        setLoading(false);
      }
    })();
  }, [isOpen]);

  // Refresh sessions each time the modal opens to show latest data, preferring DB
  const [sessions, setSessions] = useState<Array<{ bookId: number; start: number; end: number; pages?: number }>>([]);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const api = (window as any).db;
        if (api && typeof api.getReadingSessions === 'function') {
          const rows = await api.getReadingSessions();
          if (!cancelled) setSessions(rows || []);
          return;
        }
      } catch (e) {
        console.warn('[Wellbeing] getReadingSessions failed, falling back to localStorage', e);
      }
      if (!cancelled) setSessions(getLocalReadingSessions());
    })();
    return () => { cancelled = true; };
  }, [isOpen]);
  const filteredSessions = useMemo(() => {
    if (selectedId === 'all') return sessions;
    return sessions.filter(s => s.bookId === selectedId);
  }, [sessions, selectedId]);

  const totalMinutes = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + Math.max(0, Math.round((s.end - s.start) / 60000)), 0);
  }, [filteredSessions]);

  const totalPages = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + (s.pages || 0), 0);
  }, [filteredSessions]);

  const days = useMemo(() => groupSessionsByDay(filteredSessions), [filteredSessions]);

  // Additional ideas: current streak, best day, average session length
  const bestDay = useMemo(() => {
    if (days.length === 0) return null;
    return [...days].sort((a, b) => b.minutes - a.minutes)[0];
  }, [days]);
  const averageMinutesPerDay = useMemo(() => (days.length ? Math.round(totalMinutes / days.length) : 0), [days, totalMinutes]);

  // Close on Escape for consistency
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label="Wellbeing">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl rounded-3xl shadow-2xl border border-amber-200/50 dark:border-amber-700/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-900 dark:to-amber-950 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-amber-100/60 dark:border-amber-700/20 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-stone-900 dark:to-amber-900">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg text-white">
            <Leaf size={20} className="text-emerald-700 dark:text-emerald-200drop-shadow-sm" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-0.5">Wellbeing</h2>
            <p className="text-amber-700/80 dark:text-amber-200/80 text-sm">Reading habits and progress at a glance</p>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-amber-600/60 hover:text-red-600 dark:text-amber-400/60 dark:hover:text-red-400 transition-all rounded-full p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:scale-110 active:scale-95">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left: Book list */}
          <div className="rounded-2xl border border-amber-200/60 dark:border-amber-700/30 bg-white/70 dark:bg-stone-800/70 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <BookOpen size={18} />
                <h3 className="font-semibold">Books</h3>
              </div>
              <button
                onClick={() => setSelectedId('all')}
                className={`text-sm rounded-lg px-2 py-1 border transition ${selectedId === 'all' ? 'bg-amber-200/80 dark:bg-amber-700/60 border-amber-400 text-amber-900 dark:text-amber-100 shadow' : 'bg-transparent border-amber-100/40 text-amber-700 dark:text-amber-200'}`}
              >
                Show all
              </button>
            </div>
            <div className="h-[420px] overflow-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="text-sm text-amber-700/90 dark:text-amber-200/90">Loading…</div>
              ) : books.length === 0 ? (
                <div className="text-sm text-amber-700/90 dark:text-amber-200/90">No books imported yet.</div>
              ) : (
                <ul className="space-y-1">
                  {books.map(b => (
                    <li key={b.id}>
                      <button
                        onClick={() => setSelectedId(b.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition flex items-center justify-between gap-3 ${selectedId === b.id ? 'bg-amber-200/80 dark:bg-amber-700/60 border-amber-400 text-amber-900 dark:text-amber-100 shadow' : 'bg-white/60 dark:bg-stone-800/60 hover:bg-amber-50/60 dark:hover:bg-stone-800/80 border-amber-100/40 text-amber-700 dark:text-amber-200'}`}
                        title={b.title}
                      >
                        <span className="truncate">
                          <span className="font-medium">{b.title}</span>
                          {b.author ? <span className="opacity-70"> — {b.author}</span> : null}
                        </span>
                        <span className="text-xs opacity-70">{Math.round(b.progress)}%</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Stats */}
          <div className="rounded-2xl border border-amber-200/60 dark:border-amber-700/30 bg-white/70 dark:bg-stone-800/70 p-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-3">
              <BarChart3 size={18} />
              <h3 className="font-semibold">Reading Stats {selectedId !== 'all' ? '(selected book)' : '(all books)'}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/40 p-3">
                <div className="flex items-center gap-2 text-amber-700/90 dark:text-amber-200/90 mb-1"><Clock size={16} /> Total time</div>
                <div className="text-xl font-semibold text-amber-900 dark:text-amber-100">{formatMinutes(totalMinutes)}</div>
                {filteredSessions.length === 0 && <div className="text-xs opacity-70 mt-1">No tracked sessions yet.</div>}
              </div>
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/40 p-3">
                <div className="flex items-center gap-2 text-amber-700/90 dark:text-amber-200/90 mb-1"><BookOpen size={16} /> Total pages</div>
                <div className="text-xl font-semibold text-amber-900 dark:text-amber-100">{totalPages}</div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/40 p-3 mb-4">
              <div className="flex items-center gap-2 text-amber-700/90 dark:text-amber-200/90 mb-2"><CalendarClock size={16} /> Daily breakdown</div>
              {days.length === 0 ? (
                <div className="text-sm opacity-80">No activity yet. Start reading to see your daily stats here.</div>
              ) : (
                <div className="max-h-64 overflow-auto pr-1 custom-scrollbar">
                  <ul className="text-sm space-y-1">
                    {days.map(d => (
                      <li key={d.date} className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-amber-50/60 dark:hover:bg-stone-800/40">
                        <span className="opacity-80">{d.date}</span>
                        <span className="font-medium">
                          {formatMinutes(d.minutes)} • {d.pages} pages
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/40 p-3">
                <div className="text-amber-700/90 dark:text-amber-200/90 text-sm mb-1">Best day (time)</div>
                <div className="text-base font-semibold text-amber-900 dark:text-amber-100">{bestDay ? `${bestDay.date} — ${formatMinutes(bestDay.minutes)}` : '—'}</div>
              </div>
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-700/40 p-3">
                <div className="text-amber-700/90 dark:text-amber-200/90 text-sm mb-1">Avg minutes/day</div>
                <div className="text-base font-semibold text-amber-900 dark:text-amber-100">{averageMinutesPerDay}</div>
              </div>
            </div>

            <div className="text-xs opacity-70 mt-4">
              Tip: detailed stats improve after enabling reading session tracking. We can add this next.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-amber-100/60 dark:border-amber-700/20 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-stone-900 dark:to-amber-900 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

export default WellbeingModal;
