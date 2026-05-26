import { getFas } from '../lib/fas'
import { MessageCircle } from 'lucide-react'

export function SignIn() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <MessageCircle size={48} className="text-[var(--accent)]" />
        <h1 className="text-2xl font-bold">Message</h1>
        <p className="text-center text-sm text-[var(--muted)]">
          Private relay messenger. No server storage.<br />
          Your messages live only on your device.
        </p>
      </div>
      <button
        onClick={() => getFas().auth.signIn()}
        className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition hover:opacity-90"
      >
        Sign in with GitHub
      </button>
    </div>
  )
}
