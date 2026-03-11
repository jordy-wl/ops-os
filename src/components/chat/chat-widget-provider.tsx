'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { PageContext } from '@/app/api/ai/page-context/route'

export type ChatMode = 'discuss' | 'plan' | 'execute'

interface ChatWidgetState {
  isOpen: boolean
  mode: ChatMode
  setMode: (mode: ChatMode) => void
  toggle: () => void
  open: () => void
  close: () => void
  pageContext: PageContext | null
  currentBlockId: string | null
}

const ChatWidgetContext = createContext<ChatWidgetState | null>(null)

const STORAGE_KEY = 'ops-os-chat-widget-open'

/** Extract block ID from pathname like /blocks/UUID or /library/blocks/UUID */
function extractBlockId(pathname: string): string | null {
  const match = pathname.match(/\/(?:blocks|library\/blocks)\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

export function ChatWidgetProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<ChatMode>('discuss')
  const [pageContext, setPageContext] = useState<PageContext | null>(null)

  const currentBlockId = extractBlockId(pathname)

  // Restore open state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') setIsOpen(true)
  }, [])

  // Persist open state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isOpen))
  }, [isOpen])

  // Fetch page context on route change
  useEffect(() => {
    let cancelled = false

    async function fetchContext() {
      try {
        const params = new URLSearchParams({ path: pathname })
        if (currentBlockId) params.set('blockId', currentBlockId)

        const res = await fetch(`/api/ai/page-context?${params}`)
        if (!res.ok) return

        const { data } = await res.json()
        if (!cancelled) setPageContext(data)
      } catch {
        // Non-critical — chat works without page context
      }
    }

    fetchContext()
    return () => { cancelled = true }
  }, [pathname, currentBlockId])

  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <ChatWidgetContext.Provider
      value={{ isOpen, mode, setMode, toggle, open, close, pageContext, currentBlockId }}
    >
      {children}
    </ChatWidgetContext.Provider>
  )
}

export function useChatWidget() {
  const ctx = useContext(ChatWidgetContext)
  if (!ctx) throw new Error('useChatWidget must be used within ChatWidgetProvider')
  return ctx
}
