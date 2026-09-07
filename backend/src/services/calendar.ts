import ICAL from 'ical.js'
import type { createReminderService } from './reminders.js'
import type { z } from 'zod'
import type { reminderListInput } from './content-input.js'

export type CalendarReminder = { id: string; title: string; dueAt: Date; updatedAt: Date; status: 'pending' | 'completed' }

export const serializeReminders = (rows: CalendarReminder[], namespace: string) => {
  const calendar = new ICAL.Component('vcalendar')
  calendar.updatePropertyWithValue('version', '2.0')
  calendar.updatePropertyWithValue('prodid', '-//Memties//Reminders//EN')
  for (const row of rows) {
    const task = new ICAL.Component('vtodo')
    task.updatePropertyWithValue('uid', `${row.id}@${namespace}`)
    task.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))
    task.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(row.updatedAt, true))
    task.updatePropertyWithValue('due', ICAL.Time.fromJSDate(row.dueAt, true))
    task.updatePropertyWithValue('summary', row.title)
    task.updatePropertyWithValue('status', row.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION')
    calendar.addSubcomponent(task)
  }
  return `${calendar.toString()}\r\n`
}

export const exportCalendar = async (service: ReturnType<typeof createReminderService>, userId: string, input: z.infer<typeof reminderListInput>, namespace: string) => {
  const rows: CalendarReminder[] = []
  let offset: number | null = 0
  while (offset !== null) {
    const page = await service.list(userId, { ...input, offset, limit: 100 })
    rows.push(...page.items)
    offset = page.nextOffset
  }
  return serializeReminders(rows, namespace)
}
