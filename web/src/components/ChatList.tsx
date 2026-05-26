import { MessageCircle, Plus, LogOut } from 'lucide-react'
import { getFas } from '../lib/fas'
import type { Chat } from '../lib/db'

interface ChatListProps {
  chats: Chat[]
  onSelect: (chat: Chat) => void
  onNewChat: () => void
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

export function ChatList({ chats, onSelect, onNewChat }: ChatListProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-[var(--accent)]" />
          <h1 className="text-lg font-bold">Message</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="rounded-lg p-2 transition hover:bg-[var(--line)]"
            title="New chat"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => getFas().auth.signOut()}
            className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--line)]"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
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
              <li key={chat.id}>
                <button
                  onClick={() => onSelect(chat)}
                  className="flex w-full items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition hover:bg-[var(--line)]"
                >
                  <img
                    src={`https://github.com/${chat.peerLogin}.png?size=80`}
                    alt=""
                    className="h-10 w-10 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">@{chat.peerLogin}</span>
                      <span className="text-xs text-[var(--muted)]">{timeAgo(chat.lastTs)}</span>
                    </div>
                    <p className="truncate text-sm text-[var(--muted)]">{chat.lastMessage}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
