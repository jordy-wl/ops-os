'use client'

import { ChatWidgetProvider } from './chat-widget-provider'
import { ChatWidget } from './chat-widget'

/**
 * ChatWidgetShell — client component wrapper that provides
 * the ChatWidgetProvider context and renders the ChatWidget.
 * Used in the server-rendered app layout.
 */
export function ChatWidgetShell() {
  return (
    <ChatWidgetProvider>
      <ChatWidget />
    </ChatWidgetProvider>
  )
}
