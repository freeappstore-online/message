import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { getFas } from '../lib/fas'
import { getMessages, saveMessage, saveChat, makeChatId, type StoredMessage } from '../lib/db'
import { pushToMailbox } from '../lib/mailbox'
import type { User, RoomMessage } from '@freeappstore/sdk'
import type { Chat } from '../lib/db'

interface MsgPayload {
  id: string
  text: string
  fromLogin: string
  fromUid: string
  toUid: string
  ts: number
}

interface ChatViewProps {
  chat: Chat
  currentUser: User
  onBack: () => void
}

export function ChatView({ chat, currentUser, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    getMessages(chat.id).then((msgs) => {
      setMessages(msgs)
      setTimeout(scrollToBottom, 50)
    })
  }, [chat.id, scrollToBottom])

  // Listen for incoming messages in this chat
  useEffect(() => {
    const fas = getFas()
    const room = fas.rooms.join(`inbox-${currentUser.id}`)
    const off = room.onMessage<MsgPayload>(async (msg: RoomMessage<MsgPayload>) => {
      const payload = msg.data
      const chatId = makeChatId(currentUser.id, payload.fromUid)
      if (chatId !== chat.id) return
      const stored: StoredMessage = {
        id: payload.id,
        chatId,
        from: payload.fromUid,
        fromLogin: payload.fromLogin,
        text: payload.text,
        ts: payload.ts,
      }
      await saveMessage(stored)
      setMessages((prev) => [...prev, stored])
      scrollToBottom()
    })
    return () => {
      off()
      room.close()
    }
  }, [chat.id, currentUser.id, scrollToBottom])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    const fas = getFas()
    const msgId = crypto.randomUUID()
    const ts = Date.now()
    const chatId = chat.id

    const stored: StoredMessage = {
      id: msgId,
      chatId,
      from: currentUser.id,
      fromLogin: currentUser.login,
      text,
      ts,
    }

    await saveMessage(stored)
    await saveChat({ ...chat, lastMessage: text, lastTs: ts })
    setMessages((prev) => [...prev, stored])
    scrollToBottom()

    const payload: MsgPayload = {
      id: msgId,
      text,
      fromLogin: currentUser.login,
      fromUid: currentUser.id,
      toUid: chat.peerUid,
      ts,
    }

    // Try to relay via the recipient's inbox room
    const peerRoom = fas.rooms.join(`inbox-${chat.peerUid}`)
    peerRoom.send(payload)

    // Also drop in KV mailbox as fallback for offline delivery
    try {
      await pushToMailbox(chat.peerUid, stored)
    } catch {
      // Non-fatal — real-time delivery may still work
    }

    // Close the send-only room connection after a brief delay
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
        <span className="font-medium">@{chat.peerLogin}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isMine = msg.from === currentUser.id
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine
                      ? 'bg-[var(--sent)] text-white'
                      : 'bg-[var(--received)] text-[var(--ink)]'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className={`mt-1 text-[0.65rem] ${isMine ? 'text-blue-200' : 'text-[var(--muted)]'}`}>
                    {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })}
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
          onChange={(e) => setInput(e.target.value)}
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
    </div>
  )
}
