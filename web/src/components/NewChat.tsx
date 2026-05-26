import { useState } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { makeChatId, saveChat, type Chat } from '../lib/db'
import type { User } from '@freeappstore/sdk'

interface NewChatProps {
  currentUser: User
  onBack: () => void
  onStartChat: (chat: Chat) => void
}

export function NewChat({ currentUser, onBack, onStartChat }: NewChatProps) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    const login = username.trim().replace(/^@/, '')
    if (!login) return
    if (login.toLowerCase() === currentUser.login.toLowerCase()) {
      setError("You can't message yourself")
      return
    }

    setLoading(true)
    setError('')

    // Verify GitHub user exists
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}`)
      if (res.status === 403) {
        setError('GitHub API rate limit reached. Try again in a few minutes.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('GitHub user not found')
        setLoading(false)
        return
      }
      const gh = await res.json() as { id: number; login: string }
      const peerUid = String(gh.id)
      const chatId = makeChatId(currentUser.id, peerUid)
      const chat: Chat = {
        id: chatId,
        peerLogin: gh.login,
        peerUid,
        lastMessage: '',
        lastTs: Date.now(),
      }
      await saveChat(chat)
      onStartChat(chat)
    } catch {
      setError('Failed to look up user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-3">
        <button onClick={onBack} className="rounded-lg p-1 transition hover:bg-[var(--line)]">
          <ArrowLeft size={20} />
        </button>
        <span className="font-medium">New conversation</span>
      </header>

      <div className="flex flex-col gap-4 px-4 py-6">
        <p className="text-sm text-[var(--muted)]">
          Enter a GitHub username to start a conversation. They must also use Message to receive your messages.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); handleStart() }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="github-username"
              className="w-full rounded-xl bg-[var(--received)] py-2.5 pl-9 pr-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!username.trim() || loading}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {loading ? '...' : 'Chat'}
          </button>
        </form>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  )
}
