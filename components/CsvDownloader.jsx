import React, { useState } from 'react'
import { View, Button, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { exportRecordsToCsv } from './dbClient' // keep path consistent with your repo

export default function CsvDownloader() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    try {
      setLoading(true)
      const path = await exportRecordsToCsv()
      if (path) {
        Alert.alert('Export', 'CSV export complete.')
      }
    } catch (e) {
      console.log('export error', e)
      Alert.alert('Export error', String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button title={loading ? 'Exporting...' : 'Export CSV'} onPress={handleExport} disabled={loading} />
  )
}
