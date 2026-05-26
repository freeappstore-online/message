import { useState, useEffect, useCallback } from 'react'
import { getFas } from './lib/fas'
import { useAuth } from '@freeappstore/sdk/hooks'
import { ChatList } from './components/ChatList'
import { ChatView } from './components/ChatView'
import { NewChat } from './components/NewChat'
import { SignIn } from './components/SignIn'
import { drainMailbox } from './lib/mailbox'
import { saveMessage, saveChat, getChats, makeChatId, type Chat } from './lib/db'
import type { RoomMessage } from '@freeappstore/sdk'

interface MsgPayload {
  id: string
  text: string
  fromLogin: string
  fromUid: string
  toUid: string
  ts: number
}

export default function App() {
  const fas = getFas()
  const { user, loading } = useAuth(fas)
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)

  const refreshChats = useCallback(async () => {
    const all = await getChats()
    setChats(all)
  }, [])

  useEffect(() => {
    if (!user) return
    refreshChats()

    // Drain offline mailbox on login
    drainMailbox().then(async (msgs) => {
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
  }, [user, refreshChats])

  // Listen on personal inbox room for incoming messages
  useEffect(() => {
    if (!user) return
    const room = fas.rooms.join(`inbox-${user.id}`)
    const off = room.onMessage<MsgPayload>(async (msg: RoomMessage<MsgPayload>) => {
      const payload = msg.data
      const chatId = makeChatId(user.id, payload.fromUid)
      const stored = {
        id: payload.id,
        chatId,
        from: payload.fromUid,
        fromLogin: payload.fromLogin,
        text: payload.text,
        ts: payload.ts,
      }
      await saveMessage(stored)
      await saveChat({
        id: chatId,
        peerLogin: payload.fromLogin,
        peerUid: payload.fromUid,
        lastMessage: payload.text,
        lastTs: payload.ts,
      })
      refreshChats()
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
      onSelect={setActiveChat}
      onNewChat={() => setShowNewChat(true)}
    />
  )
}
