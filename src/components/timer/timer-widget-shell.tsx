'use client'

import { TimerWidgetProvider } from './timer-widget-provider'

/**
 * TimerWidgetShell — client component wrapper that provides
 * the TimerWidgetProvider context globally. The timer UI itself
 * is embedded in the My Work Time tab, not rendered here.
 */
export function TimerWidgetShell({ children }: { children: React.ReactNode }) {
  return <TimerWidgetProvider>{children}</TimerWidgetProvider>
}
