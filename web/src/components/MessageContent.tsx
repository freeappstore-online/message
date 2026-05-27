import { useState } from 'react'

const URL_PATTERN = /https?:\/\/[^\s<]+/g
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

interface ParsedPart {
  type: 'text' | 'link' | 'image'
  value: string
}

function parseMessage(text: string): ParsedPart[] {
  const parts: ParsedPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(URL_PATTERN.source, 'g')
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const url = match[0]
    parts.push({ type: isImageUrl(url) ? 'image' : 'link', value: url })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts
}

export function MessageContent({ text, isMine }: MessageContentProps) {
  const parts = parseMessage(text)
  const textAndLinks = parts.filter((p) => p.type !== 'image')
  const images = parts.filter((p) => p.type === 'image')

  return (
    <>
      <p className="whitespace-pre-wrap break-words">
        {textAndLinks.map((part, i) => {
          if (part.type === 'link') {
            return (
              <a
                key={i}
                href={part.value}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline break-all ${isMine ? 'text-blue-100' : 'text-[var(--accent)]'}`}
              >
                {prettifyUrl(part.value)}
              </a>
            )
          }
          return <span key={i}>{part.value}</span>
        })}
      </p>
      {images.map((img, i) => (
        <ImagePreview key={i} url={img.value} />
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
