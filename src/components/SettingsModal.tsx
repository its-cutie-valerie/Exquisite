import React, { useEffect, useRef, useState } from 'react';
import { X, Settings, Save, Moon, Sun, Folder, Globe, Palette, BookOpen, Gamepad2 } from 'lucide-react';
import { applyTheme, getIsDark, onThemeChange } from '../utils/theme';

interface SettingsData {
  theme: 'light' | 'dark' | 'system';
  defaultImportFolder: string;
  autosave: boolean;
  fontSize: 'small' | 'normal' | 'large';
  // Discord Rich Presence
  discordEnabled: boolean;
  discordClientId: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: SettingsData) => Promise<void> | void;
}

const defaultSettings: SettingsData = {
  theme: 'system',
  defaultImportFolder: '',
  autosave: true,
  fontSize: 'normal',
  discordEnabled: false,
  discordClientId: '',
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [category, setCategory] = useState<'appearance' | 'library' | 'discord'>('appearance');

  useEffect(() => {
    if (isOpen) {
      // load from window.db if available
      (async () => {
        try {
          setLoaded(false);
          const stored = (window as any).db?.getSettings ? await (window as any).db.getSettings() : null;
          if (stored) {
            const next: SettingsData = {
              ...defaultSettings,
              // try to map common fields if present
              theme: stored.theme ?? defaultSettings.theme,
              defaultImportFolder: stored.defaultImportFolder ?? stored.importFolder ?? defaultSettings.defaultImportFolder,
              autosave: stored.autosave ?? defaultSettings.autosave,
              fontSize: stored.fontSize ?? defaultSettings.fontSize,
              discordEnabled: !!(stored.discord?.enabled ?? (stored as any).discordEnabled ?? false),
              discordClientId: String(stored.discord?.clientId ?? ''),
            };
            setSettings(next);
            setLoaded(true);
          } else {
            setLoaded(true);
          }
        } catch (err) {
          console.warn('No persistent settings found, using defaults.');
          setLoaded(true);
        }
      })();
    }
  }, [isOpen]);

  // Apply theme immediately when user changes theme inside the modal
  useEffect(() => {
    applyTheme(settings.theme);
    setIsDark(getIsDark());
    const off = onThemeChange(setIsDark);

    // Autosave theme changes (and other settings) if enabled, but only after hydration
    if (loaded && settings.autosave) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(async () => {
        try {
          const payload: any = {
            theme: settings.theme,
            defaultImportFolder: settings.defaultImportFolder,
            autosave: settings.autosave,
            fontSize: settings.fontSize,
            discord: {
              enabled: settings.discordEnabled,
              clientId: settings.discordClientId?.trim() || undefined,
            },
          };
          await (window as any).db?.saveSettings?.(payload);
        } catch {}
      }, 250);
    }

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      try { off?.(); } catch {}
    };
  }, [loaded, settings.theme, settings.autosave, settings.defaultImportFolder, settings.fontSize, settings.discordEnabled, settings.discordClientId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload: any = {
        theme: settings.theme,
        defaultImportFolder: settings.defaultImportFolder,
        autosave: settings.autosave,
        fontSize: settings.fontSize,
        discord: {
          enabled: settings.discordEnabled,
          clientId: settings.discordClientId?.trim() || undefined,
        },
      };
      if ((window as any).db?.saveSettings) {
        await (window as any).db.saveSettings(payload);
      } else {
        localStorage.setItem('appSettings', JSON.stringify(settings));
      }
      if (onSave) await onSave(settings);
      onClose();
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center z-60 ${isOpen ? 'animate-fade-in' : 'animate-fade-out'} p-4`} role="dialog" aria-modal="true" aria-label="Settings">
      {/* Cute gradient backdrop similar to Gutenberg duplicate modal */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-stone-800/30 to-orange-900/20 backdrop-blur-sm"
        onClick={onClose}
      />
  <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-5xl min-w-[900px] h-[80vh] rounded-3xl shadow-2xl border ${isDark ? 'border-amber-700/30' : 'border-amber-200/50'} bg-gradient-to-br ${isDark ? 'from-stone-900 to-amber-950' : 'from-amber-50 to-orange-50'} p-0 overflow-hidden animate-scale-in flex flex-col`}
      >
        {/* Header with icon, title, subtitle, close */}
  <div className={`flex items-center gap-3 p-4 border-b ${isDark ? 'border-amber-700/20' : 'border-amber-100/60'} bg-gradient-to-r ${isDark ? 'from-stone-900 to-amber-900' : 'from-amber-100 to-orange-100'}`}>
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg text-white">
            <Settings size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-0.5">Settings</h2>
            <p className="text-amber-700/80 dark:text-amber-200/80 text-sm">Customize your reading experience and app preferences</p>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-amber-600/60 hover:text-red-600 dark:text-amber-400/60 dark:hover:text-red-400 transition-all rounded-full p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 hover:scale-110 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content split into categories (scrollable area) */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-6">
          <div className="flex gap-6 items-stretch h-full">
            {/* Sidebar categories */}
            <aside className={`w-56 shrink-0 self-stretch h-full rounded-2xl border ${isDark ? 'border-amber-700/30 bg-stone-900/60' : 'border-amber-200/50 bg-white/70'} p-2`}>
              {([
                { key: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
                { key: 'library', label: 'Library', icon: <BookOpen size={16} /> },
                { key: 'discord', label: 'Discord', icon: <Gamepad2 size={16} /> },
              ] as const).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm mb-1.5 border transition ${
                    category === c.key
                      ? 'bg-amber-200/70 dark:bg-amber-700/50 border-amber-400 text-amber-900 dark:text-amber-100'
                      : 'bg-transparent border-transparent text-amber-800 dark:text-amber-100 hover:bg-amber-100/50 dark:hover:bg-stone-800/60'
                  }`}
                >
                  <span className="opacity-80">{c.icon}</span>
                  <span className="font-medium">{c.label}</span>
                </button>
              ))}
            </aside>

            {/* Main panel switches by category */}
            <main className="flex-1 space-y-7">
              {category === 'appearance' && (
                <>
                  <div>
                    <label className="block text-base font-semibold text-amber-800 dark:text-amber-100 mb-2">Theme</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(['light','dark','system'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setSettings(s => ({ ...s, theme: t }))}
                          className={`px-4 py-2 rounded-xl border text-base font-medium capitalize flex items-center gap-2 transition ${settings.theme === t ? 'bg-amber-200/80 dark:bg-amber-700/60 border-amber-400 text-amber-900 dark:text-amber-100 shadow' : 'bg-transparent border-amber-100/40 text-amber-700 dark:text-amber-200'}`}
                        >
                          {t === 'light' ? <Sun size={16} /> : t === 'dark' ? <Moon size={16} /> : <Globe size={16} />}
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-amber-800 dark:text-amber-100 mb-2">Font Size</label>
                    <div className="flex items-center gap-3">
                      {(['small','normal','large'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setSettings(s => ({ ...s, fontSize: f }))}
                          className={`px-4 py-2 rounded-xl border text-base font-medium capitalize transition ${settings.fontSize === f ? 'bg-amber-200/80 dark:bg-amber-700/60 border-amber-400 text-amber-900 dark:text-amber-100 shadow' : 'bg-transparent border-amber-100/40 text-amber-700 dark:text-amber-200'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {category === 'library' && (
                <>
                  <div>
                    <label className="block text-base font-semibold text-amber-800 dark:text-amber-100 mb-2">Default Import Folder</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settings.defaultImportFolder}
                        onChange={(e) => setSettings(s => ({ ...s, defaultImportFolder: e.target.value }))}
                        placeholder="e.g., C:\\Books"
                        className="flex-1 px-4 py-2 rounded-xl border border-amber-200/40 dark:border-amber-700/30 bg-white/80 dark:bg-stone-800/70 text-base"
                      />
                      <button onClick={async () => {
                        try {
                          const path = await (window as any).db?.openFolderDialog();
                          if (path) setSettings(s => ({ ...s, defaultImportFolder: path }));
                        } catch (err) {
                          console.error('Folder pick failed', err);
                        }
                      }} className="p-2 rounded-xl bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-amber-100 border border-amber-200/40 dark:border-amber-700/30">
                        <Folder />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-base font-semibold text-amber-800 dark:text-amber-100">Autosave</label>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Automatically save settings when changed</p>
                    </div>
                    <input type="checkbox" checked={settings.autosave} onChange={(e) => setSettings(s => ({ ...s, autosave: e.target.checked }))} className="w-5 h-5 accent-amber-500" />
                  </div>
                </>
              )}

              {category === 'discord' && (
                <>
                  <div className="rounded-2xl border border-amber-200/50 dark:border-amber-700/30 bg-white/70 dark:bg-stone-800/50 p-4">
                    <label className="block text-base font-semibold text-amber-800 dark:text-amber-100 mb-2">Discord Rich Presence</label>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm text-amber-700/90 dark:text-amber-200/90">Show what you’re doing in Discord</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Requires a Discord Application Client ID</p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-amber-800 dark:text-amber-100">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-amber-500"
                          checked={settings.discordEnabled}
                          onChange={async (e) => {
                            const checked = e.target.checked;
                            setSettings(s => ({ ...s, discordEnabled: checked }));
                            try {
                              // Persist enabled/disabled immediately
                              await (window as any).db?.saveSettings?.({
                                discord: { enabled: checked }
                              });
                              // Re-fetch to reflect normalized persisted state
                              const stored = await (window as any).db?.getSettings?.();
                              if (stored) {
                                setSettings(s => ({
                                  ...s,
                                  discordEnabled: !!(stored.discord?.enabled ?? (stored as any).discordEnabled ?? false),
                                  discordClientId: String(stored.discord?.clientId ?? s.discordClientId ?? ''),
                                }));
                              }
                            } catch {}
                          }}
                        />
                        Enabled
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={settings.discordClientId}
                        onChange={(e) => setSettings(s => ({ ...s, discordClientId: e.target.value }))}
                        placeholder="Discord Client ID"
                        className="flex-1 px-4 py-2 rounded-xl border border-amber-200/40 dark:border-amber-700/30 bg-white/80 dark:bg-stone-800/70 text-base"
                      />
                      <button
                        type="button"
                        disabled={!settings.discordEnabled || !settings.discordClientId.trim()}
                        onClick={async () => {
                          try {
                            // Persist discord settings so main enables RPC immediately
                            await (window as any).db?.saveSettings?.({
                              discord: {
                                enabled: settings.discordEnabled,
                                clientId: settings.discordClientId?.trim()
                              }
                            });
                            (window as any).db?.setPresenceBrowsing?.();
                          } catch {}
                        }}
                        className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-700 text-amber-800 dark:text-amber-100 border border-amber-200/40 dark:border-amber-700/30 disabled:opacity-50"
                        title="Send a test Browsing presence"
                      >
                        Test
                      </button>
                    </div>
                    {settings.discordEnabled && !settings.discordClientId.trim() && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">Client ID is required when enabled.</p>
                    )}
                  </div>
                </>
              )}
            </main>
          </div>
        </div>

  {/* Footer (slimmer) */}
  <div className="p-4 flex gap-4 border-t border-amber-100/60 dark:border-amber-700/20 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-stone-900 dark:to-amber-900">
    <button onClick={onClose} className="flex-1 px-5 py-3 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
    <button onClick={saveSettings} disabled={saving} className="flex-1 px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-600 dark:hover:to-orange-600 text-white rounded-2xl transition-all duration-200 font-medium shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
