export const SHIFT_TYPES = [
  { key: 'morning', label: 'Morning', labelHe: 'בוקר', hours: '06:00–14:00' },
  { key: 'evening', label: 'Evening', labelHe: 'ערב',  hours: '14:00–22:00' },
  { key: 'night',   label: 'Night',   labelHe: 'לילה', hours: '22:00–06:00' },
]

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function weekMonday(offsetWeeks = 0) {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offsetWeeks * 7)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function formatWeekLabel(monday) {
  const start = new Date(monday + 'T00:00:00')
  const end   = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (d, yr) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(yr ? { year: 'numeric' } : {}) })
  return `${fmt(start, false)} – ${fmt(end, true)}`
}
