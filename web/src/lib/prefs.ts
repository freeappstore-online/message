const PREFS_KEY = 'message-prefs'

export interface Prefs {
  notifications: boolean
  enterToSend: boolean
  fontSize: 'small' | 'default' | 'large'
}

const DEFAULTS: Prefs = {
  notifications: true,
  enterToSend: true,
  fontSize: 'default',
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePrefs(prefs: Prefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}
