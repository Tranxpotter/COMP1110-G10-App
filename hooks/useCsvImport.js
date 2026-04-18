import { useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import Papa from 'papaparse'
import { Alert } from 'react-native'
import { importRecordsFromRows } from '../components/dbClient' 

export function useCsvImport() {
  const [loading, setLoading] = useState(false)

  async function importCsv(input) {
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
        Alert.alert('Import', 'No rows found in CSV')
        setLoading(false)
        return
      }
      const result = await importRecordsFromRows(rows) // dbClient does validation & chunking
      Alert.alert('Import complete', `${result.inserted} inserted, ${result.skipped} skipped`)
    } catch (e) {
      console.log('importCsv error', e)
      Alert.alert('Import error', String(e))
    } finally {
      setLoading(false)
    }
  }

  return { importCsv, loading }
}