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
    req.onsuccess = () => {
      const msgs = req.result as StoredMessage[]
      msgs.sort((a, b) => a.ts - b.ts)
      resolve(msgs)
    }
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

export async function getOrCreateChat(chat: Chat): Promise<Chat> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readwrite')
    const store = tx.objectStore('chats')
    const getReq = store.get(chat.id)
    getReq.onsuccess = () => {
      const existing = getReq.result as Chat | undefined
      if (existing) {
        resolve(existing)
      } else {
        store.put(chat)
        tx.oncomplete = () => resolve(chat)
      }
    }
    getReq.onerror = () => reject(getReq.error)
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

export async function deleteChat(chatId: string): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chats', 'messages'], 'readwrite')
    tx.objectStore('chats').delete(chatId)
    const msgStore = tx.objectStore('messages')
    const idx = msgStore.index('byChatId')
    const cursorReq = idx.openCursor(chatId)
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteMessage(msgId: string): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readwrite')
    tx.objectStore('messages').delete(msgId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function searchMessages(query: string): Promise<StoredMessage[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('messages', 'readonly')
    const req = tx.objectStore('messages').getAll()
    req.onsuccess = () => {
      const all = req.result as StoredMessage[]
      const q = query.toLowerCase()
      const matches = all
        .filter((m) => m.text.toLowerCase().includes(q))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50)
      resolve(matches)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function clearAllData(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
