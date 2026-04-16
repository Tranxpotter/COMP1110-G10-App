import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { Colors } from '../constants/Colors'
import { deleteRecord, fetchAllCategories, fetchAllRecipients, fetchAllRecords, initTables } from '../components/dbClient'
import ThemedText from '../components/ThemedText'
import ThemedView from '../components/ThemedView'

const RECORD_COLUMNS = [
  { key: 'date', width: 110, maxWidth: 110 },
  { key: 'amount', width: 92, maxWidth: 92 },
  { key: 'type', width: 90, maxWidth: 90 },
  { key: 'category', width: 120, maxWidth: 120 },
  { key: 'recipient', width: 120, maxWidth: 120 },
  { key: 'description', width: 240, maxWidth: 240 },
  { key: 'currency', width: 90, maxWidth: 90 },
]

const UPDATE_ACTION_COLUMN = { key: 'update', width: 120, maxWidth: 120 }
const DELETE_ACTION_COLUMN = { key: 'delete', width: 120, maxWidth: 120 }

const ViewTable = () => {
  const [records, setRecords] = useState([])
  const [categoriesById, setCategoriesById] = useState({})
  const [recipientsById, setRecipientsById] = useState({})
  const [loading, setLoading] = useState(true)

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true)
      await initTables()
      const [rows, categories, recipients] = await Promise.all([
        fetchAllRecords(),
        fetchAllCategories(),
        fetchAllRecipients(),
      ])

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[item.cid] = item.cname || ''
        return acc
      }, {})

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[item.rid] = item.name || ''
        return acc
      }, {})

      setRecords(rows || [])
      setCategoriesById(categoryMap)
      setRecipientsById(recipientMap)
    } catch (e) {
      console.error('loadRecords failed', e)
      Alert.alert('Database error', 'Failed to load records.')
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadRecords()
    }, [loadRecords])
  )

  const handleDelete = useCallback((tid) => {
    Alert.alert('Delete record', `Delete record #${tid}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecord(tid)
            await loadRecords()
          } catch (e) {
            console.error('deleteRecord failed', e)
            Alert.alert('Delete failed', String(e))
          }
        }
      }
    ])
  }, [loadRecords])

  const handleUpdate = useCallback((tid) => {
    Alert.alert('Not implemented', `Update for record #${tid} is not implemented yet.`)
  }, [])

  const getCellValue = useCallback((row, columnKey) => {
    if (columnKey === 'category') return categoriesById[row.cid] ?? ''
    if (columnKey === 'recipient') return recipientsById[row.rid] ?? ''
    return row[columnKey] ?? ''
  }, [categoriesById, recipientsById])

  const tableWidth = RECORD_COLUMNS.reduce((sum, col) => sum + col.width, 0) + UPDATE_ACTION_COLUMN.width + DELETE_ACTION_COLUMN.width

  return (
    <ThemedView style={styles.container} safe={true}>
      <ThemedText style={styles.title}>Records</ThemedText>

      {loading ? (
        <Text style={styles.statusText}>Loading records...</Text>
      ) : records.length === 0 ? (
        <Text style={styles.statusText}>No records yet.</Text>
      ) : (
        <ScrollView style={styles.verticalScroll} contentContainerStyle={styles.verticalContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
            <View style={[styles.table, { width: tableWidth }]}>
              <View style={[styles.row, styles.headerRow]}>
                {RECORD_COLUMNS.map((col) => (
                  <Text key={col.key} style={[styles.cell, styles.headerCell, { width: col.width, minWidth: col.width, maxWidth: col.maxWidth }]}>{col.key}</Text>
                ))}
                <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}>update</Text>
                <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}>delete</Text>
              </View>

              {records.map((row, index) => (
                <View key={row.tid ?? index} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                  {RECORD_COLUMNS.map((col) => (
                    <Text
                      key={`${row.tid ?? index}-${col.key}`}
                      style={[styles.cell, { width: col.width, minWidth: col.width, maxWidth: col.maxWidth }]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {String(getCellValue(row, col.key))}
                    </Text>
                  ))}

                  <View style={[styles.cell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}>
                    <Pressable style={[styles.actionButton, styles.updateButton]} onPress={() => handleUpdate(row.tid)}>
                      <Text style={styles.actionText}>Update</Text>
                    </Pressable>
                  </View>

                  <View style={[styles.cell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}>
                    <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(row.tid)}>
                      <Text style={styles.actionText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </ThemedView>

  )
}

export default ViewTable

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  verticalScroll: {
    flex: 1,
  },
  verticalContent: {
    paddingBottom: 20,
  },
  horizontalContent: {
    paddingRight: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: Colors.primary,
  },
  evenRow: {
    backgroundColor: '#ffffff',
  },
  oddRow: {
    backgroundColor: '#f5f7fa',
  },
  cell: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d0d0d0',
  },
  headerCell: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  actionCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  updateButton: {
    backgroundColor: '#2e7d32',
  },
  deleteButton: {
    backgroundColor: '#c62828',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
})