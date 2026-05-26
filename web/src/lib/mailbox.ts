import { getFas } from './fas'
import type { StoredMessage } from './db'

const MAILBOX_PREFIX = 'inbox:'

export async function pushToMailbox(_recipientUid: string, msg: StoredMessage): Promise<void> {
  const fas = getFas()
  const key = `${MAILBOX_PREFIX}${msg.id}`
  await fas.kv.set(key, msg)
}

export async function drainMailbox(): Promise<StoredMessage[]> {
  const fas = getFas()
  const keys = await fas.kv.list({ prefix: MAILBOX_PREFIX })
  if (keys.length === 0) return []

  const messages: StoredMessage[] = []
  for (const key of keys) {
    const msg = await fas.kv.get<StoredMessage>(key)
    if (msg) {
      messages.push(msg)
      await fas.kv.delete(key)
    }
  }
  return messages
}
