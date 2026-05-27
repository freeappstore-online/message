import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send, Check, CheckCheck, Clock, Copy, Trash2, X } from 'lucide-react'
import { getFas } from '../lib/fas'
import { getMessages, saveMessage, saveChat, deleteMessage, type StoredMessage } from '../lib/db'
import { pushToOutbox, removeFromOutbox } from '../lib/mailbox'
import { loadPrefs } from '../lib/prefs'
import { MessageContent } from './MessageContent'
import type { User, Room, ConnectionState } from '@freeappstore/sdk'
import type { Chat } from '../lib/db'

interface ChatViewProps {
  chat: Chat
  currentUser: User
  onBack: () => void
}

function waitForOpen(room: Room): Promise<boolean> {
  if (room.state === 'open') return Promise.resolve(true)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      off()
      resolve(false)
    }, 5000)
    const off = room.onConnectionState((s: ConnectionState) => {
      if (s === 'open') {
        clearTimeout(timeout)
        off()
        resolve(true)
      } else if (s === 'error' || s === 'closed') {
        clearTimeout(timeout)
        off()
        resolve(false)
      }
    })
  })
}

const FONT_SIZE_MAP = { small: 'text-xs', default: 'text-sm', large: 'text-base' } as const

function isSameDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function formatDayLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(ts, now.getTime())) return 'Today'
  if (isSameDay(ts, yesterday.getTime())) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

type DeliveryStatus = 'sending' | 'sent' | 'delivered'

export function ChatView({ chat, currentUser, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [peerTyping, setPeerTyping] = useState(false)
  const [deliveryMap, setDeliveryMap] = useState<Map<string, DeliveryStatus>>(new Map())
  const [contextMsg, setContextMsg] = useState<StoredMessage | null>(null)
  const [toast, setToast] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingSent = useRef(0)
  const [prefs] = useState(loadPrefs)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    getMessages(chat.id).then((msgs) => {
      setMessages(msgs)
      setTimeout(scrollToBottom, 50)
    })
  }, [chat.id, scrollToBottom])

  // Listen for incoming messages and typing indicators
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.type === 'typing' && detail.chatId === chat.id) {
        setPeerTyping(true)
        if (typingTimeout.current) clearTimeout(typingTimeout.current)
        typingTimeout.current = setTimeout(() => setPeerTyping(false), 3000)
        return
      }
      const msg = detail as StoredMessage
      if (msg.chatId !== chat.id) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      scrollToBottom()
    }
    window.addEventListener('message-incoming', handler)
    return () => {
      window.removeEventListener('message-incoming', handler)
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
    }
  }, [chat.id, scrollToBottom])

  const typingRoomRef = useRef<Room | null>(null)
  const typingCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      typingRoomRef.current?.close()
      typingRoomRef.current = null
      if (typingCloseTimer.current) clearTimeout(typingCloseTimer.current)
    }
  }, [chat.peerUid])

  const sendTypingIndicator = () => {
    const now = Date.now()
    if (now - lastTypingSent.current < 2000) return
    lastTypingSent.current = now

    const typingPayload = {
      type: 'typing' as const,
      fromUid: currentUser.id,
      fromLogin: currentUser.login,
      chatId: chat.id,
    }

    if (typingRoomRef.current && typingRoomRef.current.state === 'open') {
      typingRoomRef.current.send(typingPayload)
      if (typingCloseTimer.current) clearTimeout(typingCloseTimer.current)
      typingCloseTimer.current = setTimeout(() => {
        typingRoomRef.current?.close()
        typingRoomRef.current = null
      }, 5000)
      return
    }

    typingRoomRef.current?.close()
    const fas = getFas()
    const room = fas.rooms.join(`inbox-${chat.peerUid}`)
    typingRoomRef.current = room
    const off = room.onConnectionState((s: ConnectionState) => {
      if (s === 'open') {
        off()
        room.send(typingPayload)
        if (typingCloseTimer.current) clearTimeout(typingCloseTimer.current)
        typingCloseTimer.current = setTimeout(() => {
          room.close()
          if (typingRoomRef.current === room) typingRoomRef.current = null
        }, 5000)
      } else if (s === 'error' || s === 'closed') {
        off()
        if (typingRoomRef.current === room) typingRoomRef.current = null
      }
    })
  }

  const setDelivery = (msgId: string, status: DeliveryStatus) => {
    setDeliveryMap((prev) => new Map(prev).set(msgId, status))
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    const fas = getFas()
    const msgId = crypto.randomUUID()
    const ts = Date.now()

    const stored: StoredMessage = {
      id: msgId,
      chatId: chat.id,
      from: currentUser.id,
      fromLogin: currentUser.login,
      text,
      ts,
    }

    setDelivery(msgId, 'sending')
    await saveMessage(stored)
    await saveChat({ ...chat, lastMessage: text, lastTs: ts })
    setMessages((prev) => [...prev, stored])
    scrollToBottom()

    const payload = {
      id: msgId,
      text,
      fromLogin: currentUser.login,
      fromUid: currentUser.id,
      toUid: chat.peerUid,
      ts,
    }

    const outboxMsg = { ...stored, toUid: chat.peerUid }
    try { await pushToOutbox(outboxMsg) } catch { /* non-fatal */ }

    const peerRoom = fas.rooms.join(`inbox-${chat.peerUid}`)
    const opened = await waitForOpen(peerRoom)
    if (opened) {
      peerRoom.send(payload)
      setDelivery(msgId, 'sent')
      try { await removeFromOutbox(msgId) } catch { /* non-fatal */ }
    } else {
      setDelivery(msgId, 'sending')
    }
    setTimeout(() => peerRoom.close(), 2000)

    setSending(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-3">
        <button onClick={onBack} className="rounded-lg p-1 transition hover:bg-[var(--line)]">
          <ArrowLeft size={20} />
        </button>
        <img
          src={`https://github.com/${chat.peerLogin}.png?size=80`}
          alt=""
          className="h-8 w-8 rounded-full"
        />
        <div className="min-w-0 flex-1">
          <span className="font-medium">@{chat.peerLogin}</span>
          {peerTyping && (
            <p className="text-xs text-[var(--accent)]">typing...</p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <img
                src={`https://github.com/${chat.peerLogin}.png?size=120`}
                alt=""
                className="h-16 w-16 rounded-full"
              />
              <p className="text-sm text-[var(--muted)]">
                Start a conversation with @{chat.peerLogin}
              </p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMine = msg.from === currentUser.id
            const delivery = deliveryMap.get(msg.id)
            const prevMsg = messages[idx - 1]
            const showDaySep = !prevMsg || !isSameDay(prevMsg.ts, msg.ts)
            return (
              <div key={msg.id}>
                {showDaySep && (
                  <div className="my-3 flex items-center gap-3">
                    <div className="flex-1 border-t border-[var(--line)]" />
                    <span className="text-[0.65rem] font-medium text-[var(--muted)]">{formatDayLabel(msg.ts)}</span>
                    <div className="flex-1 border-t border-[var(--line)]" />
                  </div>
                )}
                <div
                  className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  onContextMenu={(e) => { e.preventDefault(); setContextMsg(msg) }}
                  onClick={() => { if (contextMsg) setContextMsg(null) }}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${FONT_SIZE_MAP[prefs.fontSize]} ${
                      isMine
                        ? 'bg-[var(--sent)] text-white'
                        : 'bg-[var(--received)] text-[var(--ink)]'
                    }`}
                  >
                    <MessageContent text={msg.text} isMine={isMine} />
                    <div className={`mt-1 flex items-center gap-1 ${isMine ? 'justify-end' : ''}`}>
                      <span className={`text-[0.65rem] ${isMine ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                        {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMine && delivery === 'sending' && <Clock size={10} className="text-blue-200/60" />}
                      {isMine && delivery === 'sent' && <Check size={10} className="text-blue-200" />}
                      {isMine && delivery === 'delivered' && <CheckCheck size={10} className="text-blue-200" />}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {peerTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-[var(--received)] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)]" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleSend() }}
        className="flex items-center gap-2 border-t border-[var(--line)] px-3 py-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (e.target.value.trim()) sendTypingIndicator()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && prefs.enterToSend) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-xl bg-[var(--received)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
          autoFocus
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="rounded-full bg-[var(--accent)] p-2.5 text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </form>

      {contextMsg && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6" onClick={() => setContextMsg(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[var(--paper)] p-2" onClick={(e) => e.stopPropagation()}>
            <p className="truncate px-3 py-2 text-xs text-[var(--muted)]">{contextMsg.text}</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(contextMsg.text)
                } catch {
                  const ta = document.createElement('textarea')
                  ta.value = contextMsg.text
                  ta.style.position = 'fixed'
                  ta.style.opacity = '0'
                  document.body.appendChild(ta)
                  ta.select()
                  document.execCommand('copy')
                  document.body.removeChild(ta)
                }
                setContextMsg(null)
                setToast('Copied')
                setTimeout(() => setToast(''), 1500)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-[var(--line)]"
            >
              <Copy size={16} className="text-[var(--muted)]" />
              Copy text
            </button>
            <button
              onClick={async () => {
                await deleteMessage(contextMsg.id)
                setMessages((prev) => prev.filter((m) => m.id !== contextMsg.id))
                setContextMsg(null)
                setToast('Deleted')
                setTimeout(() => setToast(''), 1500)
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-red-400 transition hover:bg-[var(--line)]"
            >
              <Trash2 size={16} />
              Delete message
            </button>
            <button
              onClick={() => setContextMsg(null)}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] transition hover:bg-[var(--line)]"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--paper)]">
          {toast}
        </div>
      )}
    </div>
  )
}
