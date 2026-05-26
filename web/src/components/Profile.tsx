import { useState } from 'react'
import { ArrowLeft, LogOut, Trash2, MessageCircle, Bell, Keyboard, Type } from 'lucide-react'
import { getFas } from '../lib/fas'
import { useAuth } from '@freeappstore/sdk/hooks'
import { loadPrefs, savePrefs, type Prefs } from '../lib/prefs'
import { clearAllData } from '../lib/db'

interface ProfileProps {
  onBack: () => void
}

export function Profile({ onBack }: ProfileProps) {
  const fas = getFas()
  const { user, deleteAccount } = useAuth(fas)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const updatePref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await clearAllData()
      localStorage.removeItem('message-prefs')
      await deleteAccount()
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleClearData = async () => {
    await clearAllData()
    setShowClearConfirm(false)
    onBack()
  }

  if (!user) return null

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-3">
        <button onClick={onBack} className="rounded-lg p-1 transition hover:bg-[var(--line)]">
          <ArrowLeft size={20} />
        </button>
        <span className="font-medium">Profile</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* User info */}
        <div className="flex items-center gap-4 border-b border-[var(--line)] px-4 py-5">
          <img
            src={user.avatarUrl ?? `https://github.com/${user.login}.png?size=120`}
            alt=""
            className="h-16 w-16 rounded-full"
          />
          <div>
            <p className="text-lg font-semibold">@{user.login}</p>
            <p className="text-sm text-[var(--muted)]">ID: {user.id}</p>
          </div>
        </div>

        {/* Preferences */}
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Preferences</p>

          <label className="flex cursor-pointer items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-[var(--muted)]" />
              <span className="text-sm">Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={prefs.notifications}
              onChange={(e) => updatePref('notifications', e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Keyboard size={18} className="text-[var(--muted)]" />
              <div>
                <span className="text-sm">Enter to send</span>
                <p className="text-xs text-[var(--muted)]">Shift+Enter for new line</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.enterToSend}
              onChange={(e) => updatePref('enterToSend', e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Type size={18} className="text-[var(--muted)]" />
              <span className="text-sm">Font size</span>
            </div>
            <select
              value={prefs.fontSize}
              onChange={(e) => updatePref('fontSize', e.target.value as Prefs['fontSize'])}
              className="rounded-lg bg-[var(--received)] px-3 py-1.5 text-sm text-[var(--ink)] outline-none"
            >
              <option value="small">Small</option>
              <option value="default">Default</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        {/* About */}
        <div className="border-b border-[var(--line)] px-4 py-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">About</p>
          <div className="flex items-center gap-3 py-2">
            <MessageCircle size={18} className="text-[var(--accent)]" />
            <div>
              <p className="text-sm font-medium">Message</p>
              <p className="text-xs text-[var(--muted)]">Private relay messenger on FreeAppStore</p>
            </div>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Messages are relayed in real-time and stored only in your browser.
            No server-side message storage. Clearing browser data deletes all history.
          </p>
        </div>

        {/* Actions */}
        <div className="px-4 py-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Account</p>

          <button
            onClick={() => getFas().auth.signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition hover:bg-[var(--line)]"
          >
            <LogOut size={18} className="text-[var(--muted)]" />
            Sign out
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-orange-400 transition hover:bg-[var(--line)]"
          >
            <Trash2 size={18} />
            Clear all messages
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-red-400 transition hover:bg-[var(--line)]"
          >
            <Trash2 size={18} />
            Delete account
          </button>
        </div>
      </div>

      {/* Clear messages confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-6">
            <h2 className="text-lg font-bold">Clear all messages?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This deletes all conversations and messages from this device. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--line)] py-2.5 text-sm font-medium transition hover:bg-[var(--line)]"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="flex-1 rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-6">
            <h2 className="text-lg font-bold">Delete your account?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This permanently deletes your FreeAppStore account, all stored data, and clears local messages. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-[var(--line)] py-2.5 text-sm font-medium transition hover:bg-[var(--line)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
