import React, { useEffect, useRef, useState } from 'react';
import { X, Settings, Save, Moon, Sun, Folder, Globe } from 'lucide-react';

interface SettingsData {
  theme: 'light' | 'dark' | 'system';
  defaultImportFolder: string;
  autosave: boolean;
  fontSize: 'small' | 'normal' | 'large';
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
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // load from window.db if available
      (async () => {
        try {
          const stored = (window as any).db?.getSettings ? await (window as any).db.getSettings() : null;
          if (stored) setSettings({ ...defaultSettings, ...stored });
        } catch (err) {
          console.warn('No persistent settings found, using defaults.');
        }
      })();
    }
  }, [isOpen]);

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
      if ((window as any).db?.saveSettings) {
        await (window as any).db.saveSettings(settings);
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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
  <div ref={modalRef} className="relative z-10 w-full max-w-2xl rounded-3xl shadow-2xl border border-amber-200/50 dark:border-amber-700/30 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-stone-900 dark:to-amber-950 p-0 overflow-hidden animate-scale-in">
        {/* Header with icon, title, subtitle, close */}
  <div className="flex items-center gap-3 p-6 border-b border-amber-100/60 dark:border-amber-700/20 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-stone-900 dark:to-amber-900">
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

        {/* Content */}
        <div className="px-8 py-8 space-y-7">
          <div>
            <label className="block text-base font-semibold text-amber-800 dark:text-amber-100 mb-2">Theme</label>
            <div className="flex items-center gap-3">
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
        </div>

        {/* Footer */}
  <div className="p-6 flex gap-4 border-t border-amber-100/60 dark:border-amber-700/20 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-stone-900 dark:to-amber-900">
          <button onClick={onClose} className="flex-1 px-6 py-4 bg-stone-200/80 dark:bg-stone-700/80 text-stone-700 dark:text-stone-300 rounded-2xl hover:bg-stone-300/80 dark:hover:bg-stone-600/80 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
          <button onClick={saveSettings} disabled={saving} className="flex-1 px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 dark:from-amber-500 dark:to-orange-500 dark:hover:from-amber-600 dark:hover:to-orange-600 text-white rounded-2xl transition-all duration-200 font-medium shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
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
