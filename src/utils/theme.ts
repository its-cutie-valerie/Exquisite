export type ThemeMode = 'light' | 'dark' | 'system'

// Keep one global cleanup so multiple callers don't stack listeners
declare global {
  interface Window { __themeMediaCleanup?: () => void }
}

function setDarkClass(on: boolean) {
  try {
    const root = document.documentElement
    const body = document.body
    root.classList.toggle('dark', on)
    body?.classList.toggle('dark', on)
    // Help some components and UA styles respect dark
    root.style.colorScheme = on ? 'dark' : 'light'
    root.setAttribute('data-theme', on ? 'dark' : 'light')
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { dark: on } }))
    } catch {}
  } catch {}
}

/**
 * Apply a theme and set up a listener for system changes when in 'system' mode.
 * Returns a cleanup function to remove any listeners.
 */
export function applyTheme(mode: ThemeMode): () => void {
  // Clear any previous system listener
  try { window.__themeMediaCleanup?.() } catch {}

  if (mode === 'dark') {
    setDarkClass(true)
    return () => {}
  }
  if (mode === 'light') {
    setDarkClass(false)
    return () => {}
  }

  // system
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkClass(media.matches)
    const handler = () => setDarkClass(media.matches)
    try { media.addEventListener('change', handler) } catch { /* Safari */ ;(media as any).addListener(handler) }
    const cleanup = () => {
      try { media.removeEventListener('change', handler) } catch { /* Safari */ ;(media as any).removeListener(handler) }
    }
    window.__themeMediaCleanup = cleanup
    return cleanup
  } catch {
    // Fallback to light if matchMedia not available
    setDarkClass(false)
    return () => {}
  }
}

export function getIsDark(): boolean {
  try {
    return document.documentElement.getAttribute('data-theme') === 'dark'
  } catch {
    return false
  }
}

export function onThemeChange(cb: (isDark: boolean) => void): () => void {
  const handler = (e: Event) => {
    // @ts-expect-error - CustomEvent detail
    const dark = typeof e.detail?.dark === 'boolean' ? e.detail.dark : getIsDark()
    cb(!!dark)
  }
  window.addEventListener('themechange', handler as any)
  return () => window.removeEventListener('themechange', handler as any)
}
