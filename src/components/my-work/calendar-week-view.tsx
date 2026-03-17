'use client'

import { cn } from '@/lib/utils'
import type { CalendarEvent } from './calendar-tab'

interface CalendarWeekViewProps {
  events: CalendarEvent[]
  currentDate: Date
  onEventClick: (event: CalendarEvent) => void
}

const HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 7am – 10pm
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekDays(date: Date): Date[] {
  const day = (date.getDay() + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - day)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function getEventPosition(event: CalendarEvent): { top: number; height: number } | null {
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const startHour = start.getHours() + start.getMinutes() / 60
  const endHour = end.getHours() + end.getMinutes() / 60

  // Clamp to visible range
  const visibleStart = Math.max(startHour, 7)
  const visibleEnd = Math.min(endHour, 23)

  if (visibleEnd <= visibleStart) return null

  const top = ((visibleStart - 7) / 16) * 100
  const height = ((visibleEnd - visibleStart) / 16) * 100

  return { top, height: Math.max(height, 1.5) }
}

const COLOR_CLASSES: Record<string, string> = {
  primary: 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/25',
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25',
  green: 'bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-300 hover:bg-green-500/25',
  red: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/25',
  orange: 'bg-orange-500/15 border-orange-500/30 text-orange-700 dark:text-orange-300 hover:bg-orange-500/25',
}

export function CalendarWeekView({ events, currentDate, onEventClick }: CalendarWeekViewProps) {
  const weekDays = getWeekDays(currentDate)

  // Separate all-day events
  const allDayEvents = events.filter((e) => e.all_day)
  const timedEvents = events.filter((e) => !e.all_day)

  return (
    <div className="overflow-x-auto">
      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
          <div className="px-1 py-1 text-[10px] text-muted-foreground text-right pr-2">all day</div>
          {weekDays.map((day, i) => {
            const dayEvents = allDayEvents.filter((e) => {
              const start = new Date(e.start_at)
              const end = new Date(e.end_at)
              return day >= start && day <= end
            })
            return (
              <div key={i} className="px-0.5 py-0.5 min-h-[24px] border-l border-border">
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className={cn(
                      'w-full text-left rounded px-1 py-0.5 text-[10px] font-medium truncate border-l-2 transition-colors',
                      COLOR_CLASSES[e.color] ?? COLOR_CLASSES.primary
                    )}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Day headers */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border sticky top-0 bg-card z-10">
        <div /> {/* spacer for time column */}
        {weekDays.map((day, i) => (
          <div
            key={i}
            className={cn(
              'text-center py-1.5 border-l border-border',
              isToday(day) && 'bg-primary/5'
            )}
          >
            <span className="text-[10px] text-muted-foreground">{DAY_LABELS[i]}</span>
            <span
              className={cn(
                'block text-[13px] font-medium',
                isToday(day)
                  ? 'text-primary'
                  : 'text-foreground'
              )}
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[48px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 48}px` }}>
        {/* Hour labels */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 w-[48px] text-[10px] text-muted-foreground text-right pr-2 -translate-y-1/2"
            style={{ top: `${((hour - 7) / 16) * 100}%` }}
          >
            {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
          </div>
        ))}

        {/* Hour grid lines */}
        {HOURS.map((hour) => (
          <div
            key={`line-${hour}`}
            className="absolute left-[48px] right-0 border-t border-border/50"
            style={{ top: `${((hour - 7) / 16) * 100}%` }}
          />
        ))}

        {/* Day columns with events */}
        {weekDays.map((day, dayIdx) => {
          const dayEvents = timedEvents.filter((e) => isSameDay(new Date(e.start_at), day))

          return (
            <div
              key={dayIdx}
              className={cn(
                'absolute top-0 bottom-0 border-l border-border',
                isToday(day) && 'bg-primary/[0.02]'
              )}
              style={{
                left: `calc(48px + ${(dayIdx / 7) * (100 - (48 / (typeof window !== 'undefined' ? window.innerWidth : 1000)) * 100)}%)`,
                width: `calc((100% - 48px) / 7)`,
              }}
            >
              {dayEvents.map((event) => {
                const pos = getEventPosition(event)
                if (!pos) return null

                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded border-l-2 px-1 overflow-hidden transition-colors cursor-pointer',
                      'text-left',
                      COLOR_CLASSES[event.color] ?? COLOR_CLASSES.primary
                    )}
                    style={{ top: `${pos.top}%`, height: `${pos.height}%`, minHeight: '18px' }}
                  >
                    <span className="text-[10px] font-medium leading-tight line-clamp-2">
                      {event.title}
                    </span>
                    <span className="text-[9px] opacity-70">
                      {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
