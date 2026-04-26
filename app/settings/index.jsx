import React, { useMemo, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, View, useColorScheme } from 'react-native'
import { useRouter } from 'expo-router'
import DateTimePicker from '@react-native-community/datetimepicker'

import ThemedButton from '../../components/ThemedButton'
import ThemedCard from '../../components/ThemedCard'
import ThemedScrollView from '../../components/ThemedScrollView'
import ThemedText from '../../components/ThemedText'
import ThemedView from '../../components/ThemedView'
import { Colors } from '../../constants/Colors'
import { dropAllTables, initTables } from '../../components/dbClient'
import { deleteAllAlertRulesAndSavingsGoals } from '../../components/alertsStore'
import { useDateContext } from '../../contexts/DateContext'

function formatDateLabel(value) {
  if (!value) return 'Off (using today)'
  return value
}

const SettingsScreen = () => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const router = useRouter()
  const { debugDate, setDebugDate, clearDebugDate, getCurrentDate } = useDateContext()

  const [showDatePicker, setShowDatePicker] = useState(false)

  const debugLabel = useMemo(() => formatDateLabel(debugDate), [debugDate])

  const onConfirmResetDatabase = () => {
    Alert.alert('Danger — Reset DB', 'This will DROP ALL TABLES and recreate them. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        style: 'destructive',
        onPress: async () => {
          try {
            await dropAllTables()
            await initTables()
            Alert.alert('DB reset', 'All tables dropped and recreated.')
          } catch (e) {
            console.error('reset failed', e)
            Alert.alert('Reset failed', String(e))
          }
        },
      },
    ])
  }

  const onDeleteRulesAndGoals = () => {
    Alert.alert('Delete Rules And Goals', 'Delete all alert rules and monthly saving goals? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await deleteAllAlertRulesAndSavingsGoals()
            Alert.alert(
              'Debug cleanup complete',
              `Deleted ${result.rulesDeleted} rules, ${result.goalsDeleted} goals, ${result.eventsDeleted} related events.`
            )
          } catch (e) {
            console.error('deleteAllAlertRulesAndSavingsGoals failed', e)
            Alert.alert('Delete failed', String(e))
          }
        },
      },
    ])
  }

  const onDateChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false)
    }

    if (!selectedDate) return
    setDebugDate(selectedDate)
  }

  return (
    <ThemedView style={styles.screen}>
      <ThemedScrollView safe={true} contentContainerStyle={styles.content}>
        <ThemedText title={true} style={styles.pageTitle}>Settings</ThemedText>

        <ThemedCard style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Database</ThemedText>
          <ThemedText style={styles.sectionDescription}>
            Destructive actions for local storage and schema debug workflows.
          </ThemedText>

          <ThemedButton style={[styles.actionButton, { backgroundColor: Colors.warning }]} onPress={onConfirmResetDatabase}>
            <ThemedText style={styles.actionButtonText}>Clear all records in database</ThemedText>
          </ThemedButton>
        </ThemedCard>

        <ThemedCard style={styles.sectionCard}>
          <ThemedText style={styles.sectionTitle}>Debug</ThemedText>
          <ThemedText style={styles.sectionDescription}>Current debug date: {debugLabel}</ThemedText>

          <ThemedButton style={styles.actionButton} onPress={() => setShowDatePicker((prev) => !prev)}>
            <ThemedText style={styles.actionButtonText}>{showDatePicker ? 'Hide date picker' : 'Choose debug date'}</ThemedText>
          </ThemedButton>

          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.iconColor }]}
            onPress={clearDebugDate}
          >
            <ThemedText>Clear debug date</ThemedText>
          </Pressable>

          <ThemedButton style={styles.actionButton} onPress={() => router.push('/settings/db')}>
            <ThemedText style={styles.actionButtonText}>Open DB debug page</ThemedText>
          </ThemedButton>

          <ThemedButton style={[styles.actionButton, { backgroundColor: Colors.warning }]} onPress={onDeleteRulesAndGoals}>
            <ThemedText style={styles.actionButtonText}>Delete all alert rules and monthly goals</ThemedText>
          </ThemedButton>
        </ThemedCard>
      </ThemedScrollView>

      {showDatePicker ? (
        <DateTimePicker
          value={getCurrentDate()}
          mode="date"
          onChange={onDateChange}
        />
      ) : null}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  pageTitle: {
    marginTop: 10,
    marginBottom: 12,
    fontSize: 24,
    fontWeight: '700',
  },
  sectionCard: {
    marginBottom: 14,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDescription: {
    opacity: 0.85,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: 12,
    marginBottom: 0,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default SettingsScreen
