import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Users, UserPlus, Search, MessageCircle, Check, X, Clock, Globe } from 'lucide-react'
import { getFas } from '../lib/fas'
import { makeChatId, getOrCreateChat, type Chat } from '../lib/db'
import type { User, Friend, FriendSearchResult } from '@freeappstore/sdk'

type Tab = 'friends' | 'requests' | 'github' | 'search'

interface GhUser {
  id: number
  login: string
  avatar_url: string
}

type GhLoadState = 'idle' | 'loading' | 'done'

interface ContactsProps {
  currentUser: User
  onBack: () => void
  onStartChat: (chat: Chat) => void
}

export function Contacts({ currentUser, onBack, onStartChat }: ContactsProps) {
  const fas = getFas()
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Friend[]>([])
  const [ghFollowing, setGhFollowing] = useState<GhUser[]>([])
  const [ghLoadState, setGhLoadState] = useState<GhLoadState>('idle')
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadFriends = useCallback(async () => {
    setLoading(true)
    try {
      const [accepted, incoming] = await Promise.all([
        fas.friends.list('accepted'),
        fas.friends.list('pending_incoming'),
      ])
      setFriends(accepted)
      setRequests(incoming)
    } catch {
      // non-fatal
    }
    setLoading(false)
  }, [fas.friends])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const loadGithubFollowing = async () => {
    setGhLoadState('loading')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(currentUser.login)}/following?per_page=100`)
      if (res.status === 403) {
        setError('GitHub API rate limit. Try again later.')
        setLoading(false)
        setGhLoadState('done')
        return
      }
      if (!res.ok) {
        setError('Failed to load GitHub following')
        setLoading(false)
        setGhLoadState('done')
        return
      }
      const users = await res.json() as GhUser[]
      setGhFollowing(users)
    } catch {
      setError('Failed to load GitHub following')
    }
    setGhLoadState('done')
    setLoading(false)
  }

  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) return
    setLoading(true)
    setError('')
    try {
      const results = await fas.friends.search(q)
      setSearchResults(results)
      if (results.length === 0) setError('No users found')
    } catch {
      setError('Search failed')
    }
    setLoading(false)
  }

  const sendRequest = async (userId: string) => {
    setActionLoading(userId)
    try {
      await fas.friends.request(userId)
      await loadFriends()
    } catch {
      // non-fatal
    }
    setActionLoading(null)
  }

  const respondRequest = async (userId: string, action: 'accept' | 'decline') => {
    setActionLoading(userId)
    try {
      await fas.friends.respond(userId, action)
      await loadFriends()
    } catch {
      // non-fatal
    }
    setActionLoading(null)
  }

  const openChat = async (peerUid: string, peerLogin: string) => {
    const chatId = makeChatId(currentUser.id, peerUid)
    const chat = await getOrCreateChat({
      id: chatId,
      peerLogin,
      peerUid,
      lastMessage: '',
      lastTs: Date.now(),
    })
    onStartChat(chat)
  }

  const openChatFromGh = async (gh: GhUser) => {
    await openChat(`gh:${gh.id}`, gh.login)
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests', badge: requests.length },
    { key: 'github', label: 'GitHub' },
    { key: 'search', label: 'Search' },
  ]

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-3">
        <button onClick={onBack} className="rounded-lg p-1 transition hover:bg-[var(--line)]">
          <ArrowLeft size={20} />
        </button>
        <span className="font-medium">Contacts</span>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[var(--line)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setError('')
              if (t.key === 'github' && ghLoadState === 'idle') loadGithubFollowing()
            }}
            className={`relative flex-1 px-2 py-2.5 text-center text-xs font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[0.6rem] text-white">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        )}

        {error && <p className="px-4 py-3 text-sm text-red-400">{error}</p>}

        {/* Friends tab */}
        {tab === 'friends' && !loading && (
          friends.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Users size={32} className="text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">No friends yet</p>
              <p className="text-xs text-[var(--muted)]">Search for users or import from GitHub</p>
            </div>
          ) : (
            <ul>
              {friends.map((f) => (
                <li key={f.userId} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                  <img
                    src={f.avatarUrl ?? `https://github.com/${f.login}.png?size=64`}
                    alt="" className="h-10 w-10 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">@{f.login}</span>
                  </div>
                  <button
                    onClick={() => openChat(f.userId, f.login)}
                    className="rounded-lg p-2 text-[var(--accent)] transition hover:bg-[var(--line)]"
                    title="Send message"
                  >
                    <MessageCircle size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {/* Requests tab */}
        {tab === 'requests' && !loading && (
          requests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <UserPlus size={32} className="text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">No pending requests</p>
            </div>
          ) : (
            <ul>
              {requests.map((r) => (
                <li key={r.userId} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                  <img
                    src={r.avatarUrl ?? `https://github.com/${r.login}.png?size=64`}
                    alt="" className="h-10 w-10 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">@{r.login}</span>
                    <p className="text-xs text-[var(--muted)]">
                      <Clock size={10} className="mr-1 inline" />
                      wants to be friends
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => respondRequest(r.userId, 'accept')}
                      disabled={actionLoading === r.userId}
                      className="rounded-lg bg-[var(--accent)] p-2 text-white transition hover:opacity-90 disabled:opacity-40"
                      title="Accept"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => respondRequest(r.userId, 'decline')}
                      disabled={actionLoading === r.userId}
                      className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--line)] disabled:opacity-40"
                      title="Decline"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* GitHub following tab */}
        {tab === 'github' && !loading && (
          ghFollowing.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Globe size={32} className="text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">
                {ghLoadState === 'done' ? "You're not following anyone on GitHub" : 'Loading your GitHub following...'}
              </p>
            </div>
          ) : (
            <>
              <p className="px-4 py-2 text-xs text-[var(--muted)]">
                {ghFollowing.length} people you follow on GitHub. Tap to message or add as friend.
              </p>
              <ul>
                {ghFollowing.map((gh) => (
                  <li key={gh.id} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                    <img src={gh.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">@{gh.login}</span>
                    </div>
                    <button
                      onClick={() => sendRequest(`gh:${gh.id}`)}
                      disabled={actionLoading === `gh:${gh.id}`}
                      className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--line)] disabled:opacity-40"
                      title="Add friend"
                    >
                      <UserPlus size={16} />
                    </button>
                    <button
                      onClick={() => openChatFromGh(gh)}
                      className="rounded-lg p-2 text-[var(--accent)] transition hover:bg-[var(--line)]"
                      title="Send message"
                    >
                      <MessageCircle size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        )}

        {/* Search tab */}
        {tab === 'search' && (
          <>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch() }}
              className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3"
            >
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setError('') }}
                  placeholder="Search by username..."
                  className="w-full rounded-xl bg-[var(--received)] py-2.5 pl-9 pr-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim() || loading}
                className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Find
              </button>
            </form>
            {!loading && searchResults.length > 0 && (
              <ul>
                {searchResults.map((u) => (
                  <li key={u.userId} className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3">
                    <img
                      src={u.avatarUrl ?? `https://github.com/${u.login}.png?size=64`}
                      alt="" className="h-10 w-10 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">@{u.login}</span>
                      {u.friendStatus !== 'none' && (
                        <p className="text-xs text-[var(--muted)]">
                          {u.friendStatus === 'accepted' && 'Friend'}
                          {u.friendStatus === 'pending_outgoing' && 'Request sent'}
                          {u.friendStatus === 'pending_incoming' && 'Wants to be friends'}
                        </p>
                      )}
                    </div>
                    {u.friendStatus === 'none' && (
                      <button
                        onClick={() => sendRequest(u.userId)}
                        disabled={actionLoading === u.userId}
                        className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--line)] disabled:opacity-40"
                        title="Add friend"
                      >
                        <UserPlus size={16} />
                      </button>
                    )}
                    {u.friendStatus === 'pending_incoming' && (
                      <button
                        onClick={() => respondRequest(u.userId, 'accept')}
                        disabled={actionLoading === u.userId}
                        className="rounded-lg bg-[var(--accent)] p-2 text-white transition hover:opacity-90 disabled:opacity-40"
                        title="Accept"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openChat(u.userId, u.login)}
                      className="rounded-lg p-2 text-[var(--accent)] transition hover:bg-[var(--line)]"
                      title="Send message"
                    >
                      <MessageCircle size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
