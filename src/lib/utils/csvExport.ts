/**
 * Convert an array of objects into CSV text and trigger a browser download.
 * No external dependency. Handles strings, numbers, booleans, dates, null.
 * Escapes quotes and wraps in quotes when needed (commas, newlines, quotes).
 */

type CsvValue = string | number | boolean | Date | null | undefined

type CsvRow = Record<string, CsvValue>

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  let str: string
  if (value instanceof Date) {
    str = value.toISOString()
  } else if (typeof value === 'boolean') {
    str = value ? 'Oui' : 'Non'
  } else {
    str = String(value)
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function downloadCsv(
  filename: string,
  rows: CsvRow[],
  headers?: { key: string; label: string }[]
): void {
  if (rows.length === 0) {
    alert('Aucune donnée à exporter.')
    return
  }

  const cols = headers ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))

  const headerLine = cols.map((c) => escapeCsvValue(c.label)).join(',')
  const lines = rows.map((row) =>
    cols.map((c) => escapeCsvValue(row[c.key])).join(',')
  )
  const csv = '﻿' + [headerLine, ...lines].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
