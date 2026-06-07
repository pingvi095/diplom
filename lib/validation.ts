export const sanitizeName = (value: string) =>
  value.replace(/[^A-Za-zА-Яа-яЁё\s-]/g, '').replace(/\s{2,}/g, ' ')

export const sanitizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return value.trimStart().startsWith('+') ? `+${digits}` : digits
}

export const sanitizeDigits = (value: string) => value.replace(/\D/g, '')

export const sanitizeDisplayDateInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8)

  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`
}

export const sanitizeEmailInput = (value: string) =>
  value.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9@._%+-]/g, '')

export const sanitizeEmailListInput = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9@._%+,\-\s]/g, '')

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value))

export const parseEmailList = (value: string) =>
  Array.from(
    new Set(
      value
        .split(',')
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  )

export const isValidDisplayDate = (value: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value)

  if (!match) return false

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export const displayDateToIsoDate = (value: string) => {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value)

  if (!match) return value

  const day = match[1]
  const month = match[2]
  const year = match[3]

  return `${year}-${month}-${day}`
}

export const formatIsoDateForDisplay = (value: string | null | undefined) => {
  if (!value) return '—'

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) return value

  return `${match[3]}.${match[2]}.${match[1]}`
}