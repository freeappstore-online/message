import { getFas } from './fas'
import type { StoredMessage } from './db'

const MAILBOX_PREFIX = 'inbox:'

// KV is per-user scoped: fas.kv reads/writes to the currently signed-in
// user's namespace. We can't write to someone else's KV. Instead, the
// sender writes outgoing messages to their own KV under a "outbox:" prefix.
// The recipient polls for messages addressed to them by checking known
// senders' KV — but FAS KV doesn't support cross-user reads either.
//
// Revised approach: use the sender's own KV as a retry buffer. If the
// real-time room relay fails (recipient offline), the message stays in
// the sender's outbox. On next app open, we retry sending any outbox
// messages via rooms. This isn't true offline delivery — it requires the
// sender to reopen the app while the recipient is online. But it's the
// best we can do with per-user-scoped KV.

const OUTBOX_PREFIX = 'outbox:'

export async function pushToOutbox(msg: StoredMessage & { toUid: string }): Promise<void> {
  const fas = getFas()
  const key = `${OUTBOX_PREFIX}${msg.id}`
  await fas.kv.set(key, msg)
}

export async function drainOutbox(): Promise<(StoredMessage & { toUid: string })[]> {
  const fas = getFas()
  const keys = await fas.kv.list({ prefix: OUTBOX_PREFIX })
  if (keys.length === 0) return []

  const messages: (StoredMessage & { toUid: string })[] = []
  for (const key of keys) {
    const msg = await fas.kv.get<StoredMessage & { toUid: string }>(key)
    if (msg) messages.push(msg)
  }
  return messages
}

export async function removeFromOutbox(msgId: string): Promise<void> {
  const fas = getFas()
  await fas.kv.delete(`${OUTBOX_PREFIX}${msgId}`)
}

// Legacy — drain any old "inbox:" keys from prior version
export async function drainLegacyMailbox(): Promise<StoredMessage[]> {
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
