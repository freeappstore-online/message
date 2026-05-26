export interface StoredMessage {
  id: string
  chatId: string
  from: string
  fromLogin: string
  text: string
  ts: number
}

export interface Chat {
  id: string
  peerLogin: string
  peerUid: string
  lastMessage: string
  lastTs: number
}

const DB_NAME = 'message-app'
const DB_VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('byChatId', 'chatId', { unique: false })
      }
      if (!db.objectStoreNames.contains('chats')) {
        db.createObjectStore('chats', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = open()
  return dbPromise
}

export async function saveMessage(msg: StoredMessage): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    tx.objectStore('messages').put(msg)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getMessages(chatId: string): Promise<StoredMessage[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly')
    const idx = tx.objectStore('messages').index('byChatId')
    const req = idx.getAll(chatId)
    req.onsuccess = () => resolve(req.result as StoredMessage[])
    req.onerror = () => reject(req.error)
  })
}

export async function saveChat(chat: Chat): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readwrite')
    tx.objectStore('chats').put(chat)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getChats(): Promise<Chat[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readonly')
    const req = tx.objectStore('chats').getAll()
    req.onsuccess = () => {
      const chats = req.result as Chat[]
      chats.sort((a, b) => b.lastTs - a.lastTs)
      resolve(chats)
    }
    req.onerror = () => reject(req.error)
  })
}

export function makeChatId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join(':')
}
