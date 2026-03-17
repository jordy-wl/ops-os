'use client'

import { TimerWidgetProvider } from './timer-widget-provider'
import { TimerWidget } from './timer-widget'

/**
 * TimerWidgetShell — client component wrapper that provides
 * the TimerWidgetProvider context and renders the TimerWidget.
 * Mounted in the server-rendered app layout alongside ChatWidgetShell.
 */
export function TimerWidgetShell() {
  return (
    <TimerWidgetProvider>
      <TimerWidget />
    </TimerWidgetProvider>
  )
}
