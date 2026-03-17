'use client'

import { cn } from '@/lib/utils'
import type { CalendarEvent } from './calendar-tab'

interface CalendarMonthViewProps {
  events: CalendarEvent[]
  currentDate: Date
  onEventClick: (event: CalendarEvent) => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthGrid(date: Date): (Date | null)[][] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday-based offset
  const startOffset = (firstDay.getDay() + 6) % 7

  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(startOffset).fill(null)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start_at)
    if (e.all_day) {
      const end = new Date(e.end_at)
      return day >= new Date(start.getFullYear(), start.getMonth(), start.getDate()) &&
             day <= new Date(end.getFullYear(), end.getMonth(), end.getDate())
    }
    return isSameDay(start, day)
  })
}

const DOT_COLORS: Record<string, string> = {
  primary: 'bg-primary',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
}

export function CalendarMonthView({ events, currentDate, onEventClick }: CalendarMonthViewProps) {
  const weeks = getMonthGrid(currentDate)

  return (
    <div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center py-1.5 text-[10px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="divide-y divide-border">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 min-h-[80px]">
            {week.map((day, dayIdx) => {
              if (!day) {
                return <div key={dayIdx} className="border-l border-border/30 bg-muted/20 first:border-l-0" />
              }

              const dayEvents = getEventsForDay(events, day)
              const displayEvents = dayEvents.slice(0, 3)
              const extraCount = dayEvents.length - 3

              return (
                <div
                  key={dayIdx}
                  className={cn(
                    'border-l border-border/30 first:border-l-0 p-1',
                    isToday(day) && 'bg-primary/5'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-medium',
                      isToday(day)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {/* Event dots and labels */}
                  <div className="mt-0.5 space-y-0.5">
                    {displayEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => onEventClick(event)}
                        className="w-full text-left flex items-center gap-1 group"
                      >
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          DOT_COLORS[event.color] ?? DOT_COLORS.primary
                        )} />
                        <span className="text-[10px] text-foreground truncate group-hover:underline">
                          {event.title}
                        </span>
                      </button>
                    ))}
                    {extraCount > 0 && (
                      <span className="text-[9px] text-muted-foreground pl-2.5">
                        +{extraCount} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
