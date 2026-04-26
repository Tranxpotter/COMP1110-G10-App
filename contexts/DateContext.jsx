import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const DateContext = createContext(null)

function toIsoDateString(value) {
  if (!value) return ''

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateFromIso(isoDate) {
  const text = String(isoDate || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return null

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null
  }

  return parsed
}

export function DateContextProvider({ children }) {
  const [debugDate, setDebugDateState] = useState('')

  const setDebugDate = useCallback((value) => {
    const normalized = toIsoDateString(value)
    if (!normalized) return false
    setDebugDateState(normalized)
    return true
  }, [])

  const clearDebugDate = useCallback(() => {
    setDebugDateState('')
  }, [])

  const getCurrentDate = useCallback(() => {
    const fromDebug = toDateFromIso(debugDate)
    return fromDebug || new Date()
  }, [debugDate])

  const value = useMemo(() => ({
    debugDate,
    setDebugDate,
    clearDebugDate,
    getCurrentDate,
  }), [debugDate, setDebugDate, clearDebugDate, getCurrentDate])

  return (
    <DateContext.Provider value={value}>
      {children}
    </DateContext.Provider>
  )
}

export function useDateContext() {
  const value = useContext(DateContext)
  if (!value) {
    throw new Error('useDateContext must be used within DateContextProvider')
  }
  return value
}
