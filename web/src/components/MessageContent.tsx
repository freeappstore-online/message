import { useState } from 'react'

const URL_REGEX = /(https?:\/\/[^\s<]+)/g
const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg)(\?[^\s]*)?$/i

interface MessageContentProps {
  text: string
  isMine: boolean
}

function isImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return IMAGE_EXT.test(u.pathname)
  } catch {
    return false
  }
}

function ImagePreview({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
        {url}
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`mt-1 max-w-full rounded-lg transition ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxHeight: 300 }}
      />
      {!loaded && (
        <div className="mt-1 h-32 w-48 animate-pulse rounded-lg bg-white/10" />
      )}
    </a>
  )
}

export function MessageContent({ text, isMine }: MessageContentProps) {
  const parts = text.split(URL_REGEX)
  const imageUrls: string[] = []

  const rendered = parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      if (isImageUrl(part)) {
        imageUrls.push(part)
        return null
      }
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${isMine ? 'text-blue-100' : 'text-[var(--accent)]'}`}
        >
          {prettifyUrl(part)}
        </a>
      )
    }
    return part || null
  })

  return (
    <>
      <p className="whitespace-pre-wrap break-words">{rendered}</p>
      {imageUrls.map((url, i) => (
        <ImagePreview key={i} url={url} />
      ))}
    </>
  )
}

function prettifyUrl(url: string): string {
  try {
    const u = new URL(url)
    let display = u.hostname + u.pathname
    if (display.endsWith('/')) display = display.slice(0, -1)
    if (display.length > 50) display = display.slice(0, 47) + '...'
    return display
  } catch {
    return url.length > 50 ? url.slice(0, 47) + '...' : url
  }
}
