import { useState } from 'react'
import { MessageCircle, Plus, Users, Search, X, Trash2 } from 'lucide-react'
import { deleteChat, searchMessages, getOrCreateChat, type Chat, type StoredMessage } from '../lib/db'
import type { User } from '@freeappstore/sdk'

interface ChatListProps {
  chats: Chat[]
  currentUser: User
  onSelect: (chat: Chat) => void
  onNewChat: () => void
  onContacts: () => void
  onProfile: () => void
  onRefresh: () => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function ChatList({ chats, currentUser, onSelect, onNewChat, onContacts, onProfile, onRefresh }: ChatListProps) {
  const [searchMode, setSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StoredMessage[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null)

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const results = await searchMessages(q.trim())
    setSearchResults(results)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteChat(deleteTarget.id)
    setDeleteTarget(null)
    onRefresh()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        {searchMode ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search messages..."
                className="w-full rounded-xl bg-[var(--received)] py-2 pl-9 pr-4 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
                autoFocus
              />
            </div>
            <button
              onClick={() => { setSearchMode(false); setSearchQuery(''); setSearchResults([]) }}
              className="rounded-lg p-1.5 transition hover:bg-[var(--line)]"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <MessageCircle size={20} className="text-[var(--accent)]" />
              <h1 className="text-lg font-bold">Message</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchMode(true)}
                className="rounded-lg p-2 transition hover:bg-[var(--line)]"
                title="Search"
              >
                <Search size={18} />
              </button>
              <button
                onClick={onContacts}
                className="rounded-lg p-2 transition hover:bg-[var(--line)]"
                title="Contacts"
              >
                <Users size={18} />
              </button>
              <button
                onClick={onNewChat}
                className="rounded-lg p-2 transition hover:bg-[var(--line)]"
                title="New chat"
              >
                <Plus size={18} />
              </button>
              <button
                onClick={onProfile}
                className="rounded-full transition hover:ring-2 hover:ring-[var(--accent)]"
                title="Profile"
              >
                <img
                  src={currentUser.avatarUrl ?? `https://github.com/${currentUser.login}.png?size=64`}
                  alt=""
                  className="h-7 w-7 rounded-full"
                />
              </button>
            </div>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {searchMode ? (
          searchQuery.trim().length < 2 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">Type at least 2 characters to search</p>
          ) : searchResults.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No messages found</p>
          ) : (
            <ul>
              {searchResults.map((msg) => (
                <li key={msg.id}>
                  <button
                    onClick={async () => {
                      const chat = await getOrCreateChat({
                        id: msg.chatId,
                        peerLogin: msg.from === currentUser.id ? '?' : msg.fromLogin,
                        peerUid: msg.from === currentUser.id
                          ? msg.chatId.split(':').find((id) => id !== currentUser.id) ?? msg.from
                          : msg.from,
                        lastMessage: msg.text,
                        lastTs: msg.ts,
                      })
                      setSearchMode(false)
                      setSearchQuery('')
                      setSearchResults([])
                      onSelect(chat)
                    }}
                    className="w-full border-b border-[var(--line)] px-4 py-3 text-left transition hover:bg-[var(--line)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--accent)]">@{msg.fromLogin}</span>
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(msg.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--ink)]">{msg.text}</p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <p className="text-[var(--muted)]">No conversations yet</p>
            <button
              onClick={onNewChat}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Start a chat
            </button>
          </div>
        ) : (
          <ul>
            {chats.map((chat) => (
              <li
                key={chat.id}
                className="flex border-b border-[var(--line)]"
              >
                <button
                  onClick={() => onSelect(chat)}
                  onContextMenu={(e) => { e.preventDefault(); setDeleteTarget(chat) }}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--line)]"
                >
                  <img
                    src={`https://github.com/${chat.peerLogin}.png?size=80`}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">@{chat.peerLogin}</span>
                      <span className="text-xs text-[var(--muted)]">{timeAgo(chat.lastTs)}</span>
                    </div>
                    <p className="truncate text-sm text-[var(--muted)]">{chat.lastMessage}</p>
                  </div>
                </button>
                <button
                  onClick={() => setDeleteTarget(chat)}
                  className="flex items-center px-3 text-[var(--muted)] transition hover:bg-red-500/20 hover:text-red-400"
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-6">
            <h2 className="text-lg font-bold">Delete conversation?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Delete your conversation with @{deleteTarget.peerLogin}? All messages will be removed from this device.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-[var(--line)] py-2.5 text-sm font-medium transition hover:bg-[var(--line)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
