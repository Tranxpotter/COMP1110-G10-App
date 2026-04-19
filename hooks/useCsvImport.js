import { useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import Papa from 'papaparse'
import { importRecordsFromRows } from '../components/dbClient' 

export function useCsvImport() {
  const [loading, setLoading] = useState(false)

  async function importCsv(input, options = {}) {
    const onProgress = options?.onProgress

    setLoading(true)
    try {
      let rows = input
      if (!Array.isArray(rows)) {
        const enc = FileSystem?.EncodingType?.UTF8 || 'utf8'
        const content = await FileSystem.readAsStringAsync(input, { encoding: enc })
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true })
        if (parsed.errors && parsed.errors.length) {
          console.warn('CSV parse errors', parsed.errors)
        }
        rows = parsed.data || []
      }
      if (!rows.length) {
        return { inserted: 0, skipped: 0, total: 0 }
      }

      const result = await importRecordsFromRows(rows, 200, (payload) => {
        if (typeof onProgress === 'function') {
          onProgress(payload)
        }
      })

      return result
    } catch (e) {
      console.log('importCsv error', e)
      throw e
    } finally {
      setLoading(false)
    }
  }

  return { importCsv, loading }
}