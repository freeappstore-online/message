import { useState, useEffect, useCallback } from 'react'
import { getFas } from './lib/fas'
import { useAuth } from '@freeappstore/sdk/hooks'
import { ChatList } from './components/ChatList'
import { ChatView } from './components/ChatView'
import { NewChat } from './components/NewChat'
import { Contacts } from './components/Contacts'
import { Profile } from './components/Profile'
import { SignIn } from './components/SignIn'
import { drainOutbox, removeFromOutbox, drainLegacyMailbox } from './lib/mailbox'
import { saveMessage, saveChat, getChats, makeChatId, type Chat, type StoredMessage } from './lib/db'
import type { RoomMessage, ConnectionState } from '@freeappstore/sdk'

interface MsgPayload {
  id: string
  text: string
  fromLogin: string
  fromUid: string
  toUid: string
  ts: number
}

interface TypingPayload {
  type: 'typing'
  fromUid: string
  fromLogin: string
  chatId: string
}

export default function App() {
  const fas = getFas()
  const { user, loading } = useAuth(fas)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showContacts, setShowContacts] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

  const refreshChats = useCallback(async () => {
    const all = await getChats()
    setChats(all)
  }, [])

  useEffect(() => {
    if (!user) return
    refreshChats()

    // Drain legacy mailbox keys (from prior version)
    drainLegacyMailbox().then(async (msgs) => {
      for (const msg of msgs) {
        await saveMessage(msg)
        await saveChat({
          id: msg.chatId,
          peerLogin: msg.fromLogin,
          peerUid: msg.from,
          lastMessage: msg.text,
          lastTs: msg.ts,
        })
      }
      if (msgs.length > 0) refreshChats()
    })

    // Retry sending outbox messages
    drainOutbox().then(async (msgs) => {
      for (const msg of msgs) {
        const peerRoom = fas.rooms.join(`inbox-${msg.toUid}`)
        const opened = await new Promise<boolean>((resolve) => {
          if (peerRoom.state === 'open') { resolve(true); return }
          const timeout = setTimeout(() => { off(); resolve(false) }, 5000)
          const off = peerRoom.onConnectionState((s: ConnectionState) => {
            if (s === 'open') { clearTimeout(timeout); off(); resolve(true) }
            else if (s === 'error' || s === 'closed') { clearTimeout(timeout); off(); resolve(false) }
          })
        })
        if (opened) {
          peerRoom.send({
            id: msg.id,
            text: msg.text,
            fromLogin: msg.fromLogin,
            fromUid: msg.from,
            toUid: msg.toUid,
            ts: msg.ts,
          })
          try { await removeFromOutbox(msg.id) } catch { /* non-fatal */ }
        }
        setTimeout(() => peerRoom.close(), 2000)
      }
    })
  }, [user, fas.rooms, refreshChats])

  // Listen on personal inbox room for incoming messages and typing indicators
  useEffect(() => {
    if (!user) return
    const room = fas.rooms.join(`inbox-${user.id}`)
    const off = room.onMessage<MsgPayload | TypingPayload>(async (msg: RoomMessage<MsgPayload | TypingPayload>) => {
      const payload = msg.data

      // Typing indicator
      if ('type' in payload && payload.type === 'typing') {
        const chatId = makeChatId(user.id, payload.fromUid)
        window.dispatchEvent(new CustomEvent('message-incoming', {
          detail: { type: 'typing', chatId },
        }))
        return
      }

      // Regular message
      const msgPayload = payload as MsgPayload
      const chatId = makeChatId(user.id, msgPayload.fromUid)
      const stored: StoredMessage = {
        id: msgPayload.id,
        chatId,
        from: msgPayload.fromUid,
        fromLogin: msgPayload.fromLogin,
        text: msgPayload.text,
        ts: msgPayload.ts,
      }
      await saveMessage(stored)
      await saveChat({
        id: chatId,
        peerLogin: msgPayload.fromLogin,
        peerUid: msgPayload.fromUid,
        lastMessage: msgPayload.text,
        lastTs: msgPayload.ts,
      })
      refreshChats()
      window.dispatchEvent(new CustomEvent('message-incoming', { detail: stored }))
    })
    return () => {
      off()
      room.close()
    }
  }, [user, fas.rooms, refreshChats])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    )
  }

  if (!user) return <SignIn />

  if (showProfile) {
    return <Profile onBack={() => setShowProfile(false)} />
  }

  if (showContacts) {
    return (
      <Contacts
        currentUser={user}
        onBack={() => setShowContacts(false)}
        onStartChat={(chat) => {
          setShowContacts(false)
          setActiveChat(chat)
          refreshChats()
        }}
      />
    )
  }

  if (showNewChat) {
    return (
      <NewChat
        currentUser={user}
        onBack={() => setShowNewChat(false)}
        onStartChat={(chat) => {
          setShowNewChat(false)
          setActiveChat(chat)
          refreshChats()
        }}
      />
    )
  }

  if (activeChat) {
    return (
      <ChatView
        chat={activeChat}
        currentUser={user}
        onBack={() => {
          setActiveChat(null)
          refreshChats()
        }}
      />
    )
  }

  return (
    <ChatList
      chats={chats}
      currentUser={user}
      onSelect={setActiveChat}
      onNewChat={() => setShowNewChat(true)}
      onContacts={() => setShowContacts(true)}
      onProfile={() => setShowProfile(true)}
    />
  )
}
