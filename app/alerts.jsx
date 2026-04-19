import React, { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useColorScheme,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

import { Colors } from '../constants/Colors'
import ThemedButton from '../components/ThemedButton'
import ThemedCard from '../components/ThemedCard'
import ThemedLoader from '../components/ThemedLoader'
import ThemedScrollView from '../components/ThemedScrollView'
import ThemedSelectList from '../components/ThemedSelectList'
import ThemedText from '../components/ThemedText'
import ThemedTextInput from '../components/ThemedTextInput'
import ThemedView from '../components/ThemedView'
import { fetchAllCategories, fetchAllRecipients } from '../components/dbClient'
import {
  addAlertRule,
  addSavingsGoal,
  clearResolvedAlertEvents,
  deleteAlertRule,
  deleteSavingsGoal,
  evaluateAlertsForDate,
  fetchAlertEvents,
  fetchAllAlertRules,
  fetchAllSavingsGoals,
  fetchSavingsGoalProgress,
  markAlertEventRead,
  refreshAlertEvaluations,
  resolveAlertEvent,
  toggleAlertRule,
  toggleSavingsGoal,
  updateAlertRule,
  updateSavingsGoal,
} from '../components/alertsStore'

const ISO_DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateInput(value = '') {
  return String(value || '').trim()
}

function isValidIsoDateInput(value = '') {
  const normalized = normalizeDateInput(value)
  if (!ISO_DATE_INPUT_REGEX.test(normalized)) return false

  const [year, month, day] = normalized.split('-').map((token) => Number(token))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return false

  const yyyy = date.getFullYear()
  const mm = date.getMonth() + 1
  const dd = date.getDate()
  return yyyy === year && mm === month && dd === day
}

const ALERT_TYPE_OPTIONS = [
  { key: 'spending_limit', label: 'Spending limits' },
  { key: 'big_one_time', label: 'Big one-time payment' },
  { key: 'recurring_payment', label: 'Recurring payment' },
  { key: 'abnormal', label: 'Abnormal payment' },
  { key: 'extra_surplus', label: 'Extra surplus' },
]

const INCOME_BASIS_OPTIONS = [
  { key: 'transactions', label: 'Use income transactions' },
  { key: 'fixed', label: 'Use fixed monthly income' },
]

const THRESHOLD_MODE_OPTIONS = [
  { key: 'amount', label: '$ Amount' },
  { key: 'percent', label: '% of income' },
]

const GOAL_MODE_OPTIONS = [
  { key: 'category', label: 'Category-based savings' },
  { key: 'residual', label: 'Residual month-end savings' },
]

const EVENT_STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'read', label: 'Read' },
  { key: 'resolved', label: 'Resolved' },
]

function normalizeNumericInput(value, fallback = 0) {
  const sanitized = String(value || '').replace(/[^0-9.]/g, '')
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeIntegerInput(value, fallback = 1) {
  const parsed = Math.trunc(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function getRuleTypeLabel(alertType) {
  const found = ALERT_TYPE_OPTIONS.find((item) => item.key === alertType)
  return found?.label || alertType
}

function getGoalModeLabel(mode) {
  const found = GOAL_MODE_OPTIONS.find((item) => item.key === mode)
  return found?.label || mode
}

function ActionChip({ label, active, onPress, theme }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? Colors.primary : theme.background,
          borderColor: active ? Colors.primary : theme.iconColor,
        },
      ]}
    >
      <ThemedText style={{ color: active ? '#ffffff' : theme.text, fontWeight: active ? '700' : '500' }}>
        {label}
      </ThemedText>
    </Pressable>
  )
}

function defaultRuleForm() {
  return {
    name: '',
    alert_type: 'spending_limit',
    enabled: true,
    cycle_start_day: '1',
    income_basis: 'transactions',
    fixed_income: '',
    category_ids: [],
    recipient_ids: [],
    thresholdMode: 'amount',
    thresholdValue: '',
    minCount: '3',
    windowDays: '30',
    lookbackMonths: '3',
    increasePercent: '30',
  }
}

function defaultGoalForm() {
  return {
    name: '',
    enabled: true,
    mode: 'category',
    cycle_start_day: '1',
    target_amount: '',
    category_ids: [],
  }
}

const Alerts = () => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light

  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState([])
  const [goals, setGoals] = useState([])
  const [goalProgress, setGoalProgress] = useState([])
  const [events, setEvents] = useState([])
  const [categories, setCategories] = useState([])
  const [recipients, setRecipients] = useState([])
  const [eventStatusFilter, setEventStatusFilter] = useState('all')
  const [debugDateInput, setDebugDateInput] = useState('')
  const [appliedDebugDate, setAppliedDebugDate] = useState('')
  const [showDebugControls, setShowDebugControls] = useState(false)

  const [ruleModalVisible, setRuleModalVisible] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [ruleForm, setRuleForm] = useState(defaultRuleForm())
  const [ruleCategoryCandidateId, setRuleCategoryCandidateId] = useState('')
  const [ruleRecipientCandidateId, setRuleRecipientCandidateId] = useState('')
  const [ruleModalResetKey, setRuleModalResetKey] = useState(0)

  const [goalModalVisible, setGoalModalVisible] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [goalForm, setGoalForm] = useState(defaultGoalForm())
  const [goalCategoryCandidateId, setGoalCategoryCandidateId] = useState('')
  const [goalModalResetKey, setGoalModalResetKey] = useState(0)

  const goalProgressById = useMemo(() => {
    return goalProgress.reduce((acc, item) => {
      acc[Number(item.goal_id)] = item
      return acc
    }, {})
  }, [goalProgress])

  const categoryOptions = useMemo(() => {
    return categories
      .map((item) => ({
        key: String(item.cid),
        value: item.cname || `Category ${item.cid}`,
      }))
      .sort((left, right) => String(left.value).localeCompare(String(right.value)))
  }, [categories])

  const recipientOptions = useMemo(() => {
    return recipients
      .map((item) => ({
        key: String(item.rid),
        value: item.name || `Recipient ${item.rid}`,
      }))
      .sort((left, right) => String(left.value).localeCompare(String(right.value)))
  }, [recipients])

  const categoryLabelById = useMemo(() => {
    return categoryOptions.reduce((acc, item) => {
      acc[String(item.key)] = item.value
      return acc
    }, {})
  }, [categoryOptions])

  const recipientLabelById = useMemo(() => {
    return recipientOptions.reduce((acc, item) => {
      acc[String(item.key)] = item.value
      return acc
    }, {})
  }, [recipientOptions])

  const reloadData = useCallback(async ({
    status = eventStatusFilter,
    evaluateDate = appliedDebugDate,
  } = {}) => {
    setLoading(true)
    try {
      const effectiveEvaluateDate = evaluateDate || new Date()
      const evaluationOptions = evaluateDate
        ? { cutoffDateExclusive: evaluateDate }
        : {}

      await evaluateAlertsForDate(effectiveEvaluateDate, evaluationOptions)

      const [
        fetchedRules,
        fetchedGoals,
        fetchedProgress,
        fetchedEvents,
        fetchedCategories,
        fetchedRecipients,
      ] = await Promise.all([
        fetchAllAlertRules(),
        fetchAllSavingsGoals(),
        fetchSavingsGoalProgress(effectiveEvaluateDate, evaluationOptions),
        fetchAlertEvents({ status, limit: 60 }),
        fetchAllCategories(),
        fetchAllRecipients(),
      ])

      setRules(fetchedRules)
      setGoals(fetchedGoals)
      setGoalProgress(fetchedProgress)
      setEvents(fetchedEvents)
      setCategories(fetchedCategories)
      setRecipients(fetchedRecipients)
    } catch (e) {
      console.error('alerts reloadData error', e)
      Alert.alert('Alerts', String(e?.message || e || 'Failed to load alerts data'))
    } finally {
      setLoading(false)
    }
  }, [appliedDebugDate, eventStatusFilter])

  useFocusEffect(
    useCallback(() => {
      reloadData({ status: eventStatusFilter })
    }, [reloadData, eventStatusFilter])
  )

  const onApplyDebugDate = async () => {
    const normalizedDate = normalizeDateInput(debugDateInput)
    if (!isValidIsoDateInput(normalizedDate)) {
      Alert.alert('Debug Date', 'Use valid date format YYYY-MM-DD.')
      return
    }

    setAppliedDebugDate(normalizedDate)
    setDebugDateInput(normalizedDate)
    await reloadData({ status: eventStatusFilter, evaluateDate: normalizedDate })
  }

  const onClearDebugDate = async () => {
    setAppliedDebugDate('')
    setDebugDateInput('')
    await reloadData({ status: eventStatusFilter, evaluateDate: '' })
  }

  const onRefreshEvaluations = async () => {
    setLoading(true)
    try {
      await refreshAlertEvaluations({
        cutoffDateExclusive: appliedDebugDate || null,
      })
      await reloadData({
        status: eventStatusFilter,
        evaluateDate: appliedDebugDate,
      })
    } catch (e) {
      console.error('onRefreshEvaluations failed', e)
      Alert.alert('Refresh', String(e?.message || e || 'Failed to refresh evaluations'))
      setLoading(false)
    }
  }

  const openCreateRule = () => {
    setEditingRuleId(null)
    setRuleForm(defaultRuleForm())
    setRuleCategoryCandidateId('')
    setRuleRecipientCandidateId('')
    setRuleModalResetKey((prev) => prev + 1)
    setRuleModalVisible(true)
  }

  const openEditRule = (rule) => {
    const config = rule.config || {}
    setEditingRuleId(rule.rule_id)
    setRuleForm({
      name: String(rule.name || ''),
      alert_type: rule.alert_type || 'spending_limit',
      enabled: Boolean(rule.enabled),
      cycle_start_day: String(rule.cycle_start_day || 1),
      income_basis: rule.income_basis || 'transactions',
      fixed_income: rule.fixed_income == null ? '' : String(rule.fixed_income),
      category_ids: Array.isArray(rule.category_ids) ? [...rule.category_ids] : [],
      recipient_ids: Array.isArray(rule.recipient_ids) ? [...rule.recipient_ids] : [],
      thresholdMode: config.thresholdMode || 'amount',
      thresholdValue: config.thresholdValue == null ? '' : String(config.thresholdValue),
      minCount: config.minCount == null ? '3' : String(config.minCount),
      windowDays: config.windowDays == null ? '30' : String(config.windowDays),
      lookbackMonths: config.lookbackMonths == null ? '3' : String(config.lookbackMonths),
      increasePercent: config.increasePercent == null ? '30' : String(config.increasePercent),
    })
    setRuleCategoryCandidateId('')
    setRuleRecipientCandidateId('')
    setRuleModalResetKey((prev) => prev + 1)
    setRuleModalVisible(true)
  }

  const openCreateGoal = () => {
    setEditingGoalId(null)
    setGoalForm(defaultGoalForm())
    setGoalCategoryCandidateId('')
    setGoalModalResetKey((prev) => prev + 1)
    setGoalModalVisible(true)
  }

  const openEditGoal = (goal) => {
    setEditingGoalId(goal.goal_id)
    setGoalForm({
      name: String(goal.name || ''),
      enabled: Boolean(goal.enabled),
      mode: goal.mode || 'category',
      cycle_start_day: String(goal.cycle_start_day || 1),
      target_amount: String(goal.target_amount || ''),
      category_ids: Array.isArray(goal.category_ids) ? [...goal.category_ids] : [],
    })
    setGoalCategoryCandidateId('')
    setGoalModalResetKey((prev) => prev + 1)
    setGoalModalVisible(true)
  }

  const toggleRuleCategory = (categoryId) => {
    setRuleForm((prev) => {
      const has = prev.category_ids.includes(categoryId)
      return {
        ...prev,
        category_ids: has
          ? prev.category_ids.filter((id) => id !== categoryId)
          : [...prev.category_ids, categoryId],
      }
    })
  }

  const toggleRuleRecipient = (recipientId) => {
    setRuleForm((prev) => {
      const has = prev.recipient_ids.includes(recipientId)
      return {
        ...prev,
        recipient_ids: has
          ? prev.recipient_ids.filter((id) => id !== recipientId)
          : [...prev.recipient_ids, recipientId],
      }
    })
  }

  const toggleGoalCategory = (categoryId) => {
    setGoalForm((prev) => {
      const has = prev.category_ids.includes(categoryId)
      return {
        ...prev,
        category_ids: has
          ? prev.category_ids.filter((id) => id !== categoryId)
          : [...prev.category_ids, categoryId],
      }
    })
  }

  const addRuleCategoryFilter = () => {
    const parsedId = Number(ruleCategoryCandidateId)
    if (!Number.isFinite(parsedId)) return
    setRuleForm((prev) => {
      if (prev.category_ids.includes(parsedId)) return prev
      return {
        ...prev,
        category_ids: [...prev.category_ids, parsedId],
      }
    })
  }

  const removeRuleCategoryFilter = (categoryId) => {
    setRuleForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.filter((id) => id !== categoryId),
    }))
  }

  const addRuleRecipientFilter = () => {
    const parsedId = Number(ruleRecipientCandidateId)
    if (!Number.isFinite(parsedId)) return
    setRuleForm((prev) => {
      if (prev.recipient_ids.includes(parsedId)) return prev
      return {
        ...prev,
        recipient_ids: [...prev.recipient_ids, parsedId],
      }
    })
  }

  const removeRuleRecipientFilter = (recipientId) => {
    setRuleForm((prev) => ({
      ...prev,
      recipient_ids: prev.recipient_ids.filter((id) => id !== recipientId),
    }))
  }

  const addGoalCategoryFilter = () => {
    const parsedId = Number(goalCategoryCandidateId)
    if (!Number.isFinite(parsedId)) return
    setGoalForm((prev) => {
      if (prev.category_ids.includes(parsedId)) return prev
      return {
        ...prev,
        category_ids: [...prev.category_ids, parsedId],
      }
    })
  }

  const removeGoalCategoryFilter = (categoryId) => {
    setGoalForm((prev) => ({
      ...prev,
      category_ids: prev.category_ids.filter((id) => id !== categoryId),
    }))
  }

  const saveRule = async () => {
    const name = String(ruleForm.name || '').trim()
    if (!name) {
      Alert.alert('Rule', 'Rule name is required')
      return
    }

    const cycleStartDay = Math.max(1, Math.min(31, normalizeIntegerInput(ruleForm.cycle_start_day, 1)))

    const config = {}
    if (
      ruleForm.alert_type === 'spending_limit' ||
      ruleForm.alert_type === 'big_one_time' ||
      ruleForm.alert_type === 'extra_surplus'
    ) {
      config.thresholdMode = ruleForm.thresholdMode
      config.thresholdValue = Math.max(0, normalizeNumericInput(ruleForm.thresholdValue, 0))
      if (config.thresholdValue <= 0) {
        Alert.alert('Rule', 'Threshold value must be greater than 0')
        return
      }
    } else if (ruleForm.alert_type === 'recurring_payment') {
      config.minCount = Math.max(2, normalizeIntegerInput(ruleForm.minCount, 3))
      config.windowDays = Math.max(2, normalizeIntegerInput(ruleForm.windowDays, 30))
    } else if (ruleForm.alert_type === 'abnormal') {
      config.lookbackMonths = Math.max(1, normalizeIntegerInput(ruleForm.lookbackMonths, 3))
      config.increasePercent = Math.max(0, normalizeNumericInput(ruleForm.increasePercent, 30))
    }

    const payload = {
      name,
      alert_type: ruleForm.alert_type,
      enabled: Boolean(ruleForm.enabled),
      cycle_start_day: cycleStartDay,
      income_basis: ruleForm.income_basis,
      fixed_income:
        ruleForm.income_basis === 'fixed'
          ? Math.max(0, normalizeNumericInput(ruleForm.fixed_income, 0))
          : null,
      category_ids: ruleForm.category_ids,
      recipient_ids: ruleForm.recipient_ids,
      config,
    }

    try {
      if (editingRuleId) {
        await updateAlertRule(editingRuleId, payload)
      } else {
        await addAlertRule(payload)
      }
      setRuleModalVisible(false)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      console.error('saveRule failed', e)
      Alert.alert('Rule', String(e?.message || e || 'Failed to save rule'))
    }
  }

  const saveGoal = async () => {
    const name = String(goalForm.name || '').trim()
    if (!name) {
      Alert.alert('Goal', 'Goal name is required')
      return
    }

    const targetAmount = Math.max(0, normalizeNumericInput(goalForm.target_amount, 0))
    if (targetAmount <= 0) {
      Alert.alert('Goal', 'Target amount must be greater than 0')
      return
    }

    const cycleStartDay = Math.max(1, Math.min(31, normalizeIntegerInput(goalForm.cycle_start_day, 1)))

    const payload = {
      name,
      enabled: Boolean(goalForm.enabled),
      mode: goalForm.mode,
      cycle_start_day: cycleStartDay,
      target_amount: targetAmount,
      category_ids: goalForm.mode === 'category' ? goalForm.category_ids : [],
    }

    try {
      if (editingGoalId) {
        await updateSavingsGoal(editingGoalId, payload)
      } else {
        await addSavingsGoal(payload)
      }
      setGoalModalVisible(false)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      console.error('saveGoal failed', e)
      Alert.alert('Goal', String(e?.message || e || 'Failed to save goal'))
    }
  }

  const onToggleRule = async (rule) => {
    try {
      await toggleAlertRule(rule.rule_id, !rule.enabled)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      Alert.alert('Rule', String(e?.message || e || 'Failed to update rule'))
    }
  }

  const onDeleteRule = async (rule) => {
    Alert.alert('Delete Rule', `Delete "${rule.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlertRule(rule.rule_id)
            await reloadData({ status: eventStatusFilter })
          } catch (e) {
            Alert.alert('Rule', String(e?.message || e || 'Failed to delete rule'))
          }
        },
      },
    ])
  }

  const onToggleGoal = async (goal) => {
    try {
      await toggleSavingsGoal(goal.goal_id, !goal.enabled)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      Alert.alert('Goal', String(e?.message || e || 'Failed to update goal'))
    }
  }

  const onDeleteGoal = async (goal) => {
    Alert.alert('Delete Goal', `Delete "${goal.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSavingsGoal(goal.goal_id)
            await reloadData({ status: eventStatusFilter })
          } catch (e) {
            Alert.alert('Goal', String(e?.message || e || 'Failed to delete goal'))
          }
        },
      },
    ])
  }

  const onMarkRead = async (eventId) => {
    try {
      await markAlertEventRead(eventId)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      Alert.alert('Inbox', String(e?.message || e || 'Failed to update event'))
    }
  }

  const onResolve = async (eventId) => {
    try {
      await resolveAlertEvent(eventId)
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      Alert.alert('Inbox', String(e?.message || e || 'Failed to update event'))
    }
  }

  const onClearResolved = async () => {
    try {
      await clearResolvedAlertEvents()
      await reloadData({ status: eventStatusFilter })
    } catch (e) {
      Alert.alert('Inbox', String(e?.message || e || 'Failed to clear events'))
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedScrollView
        safe={true}
        useBottomSafe={false}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText title={true} style={styles.title}>
          Rule-Based Alerts
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Configure spending alerts, payment pattern detection, and monthly savings goals.
        </ThemedText>

        <View style={styles.headerActionsRow}>
          <ThemedButton
            style={[styles.smallPrimaryButton, styles.headerActionButton]}
            onPress={() => setShowDebugControls((prev) => !prev)}
          >
            <ThemedText style={styles.buttonText}>{showDebugControls ? 'Hide Debug' : 'Debug Date'}</ThemedText>
          </ThemedButton>

          <ThemedButton
            style={[styles.smallPrimaryButton, styles.headerActionButton]}
            onPress={onRefreshEvaluations}
          >
            <ThemedText style={styles.buttonText}>Refresh</ThemedText>
          </ThemedButton>
        </View>

        {appliedDebugDate ? (
          <ThemedText style={styles.debugInfoText}>
            {`Debug date active: ${appliedDebugDate}. Evaluations only use records before this date.`}
          </ThemedText>
        ) : null}

        {showDebugControls ? (
          <ThemedCard style={styles.debugCard}>
            <ThemedText style={styles.sectionTitle}>Debug Evaluate Date</ThemedText>
            <ThemedText style={styles.itemMeta}>Set YYYY-MM-DD. Rules evaluate as-of this date and only include earlier records.</ThemedText>

            <ThemedText style={styles.fieldLabel}>Evaluate Date (YYYY-MM-DD)</ThemedText>
            <ThemedTextInput
              value={debugDateInput}
              onChangeText={setDebugDateInput}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.fieldInput}
            />

            <View style={styles.rowActions}>
              <ThemedButton style={[styles.smallPrimaryButton, styles.inlineActionButton]} onPress={onApplyDebugDate}>
                <ThemedText style={styles.buttonText}>Apply Date</ThemedText>
              </ThemedButton>
              <Pressable
                onPress={onClearDebugDate}
                style={[styles.secondaryAction, { borderColor: theme.iconColor }]}
              >
                <ThemedText>Clear Date</ThemedText>
              </Pressable>
            </View>
          </ThemedCard>
        ) : null}

        {loading ? <ThemedLoader /> : null}

        <ThemedCard style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Rules</ThemedText>
            <ThemedButton style={styles.smallPrimaryButton} onPress={openCreateRule}>
              <ThemedText style={styles.buttonText}>+ Add Rule</ThemedText>
            </ThemedButton>
          </View>

          {rules.length === 0 ? (
            <ThemedText style={styles.emptyText}>No alert rules yet.</ThemedText>
          ) : (
            rules.map((rule) => (
              <View key={rule.rule_id} style={[styles.itemRow, { borderBottomColor: theme.iconColor + '33' }]}>
                <View style={styles.itemHeaderRow}>
                  <ThemedText style={styles.itemTitle}>{rule.name}</ThemedText>
                  <Switch value={Boolean(rule.enabled)} onValueChange={() => onToggleRule(rule)} />
                </View>

                <ThemedText style={styles.itemMeta}>{getRuleTypeLabel(rule.alert_type)}</ThemedText>
                <ThemedText style={styles.itemMeta}>Cycle starts day {rule.cycle_start_day}</ThemedText>

                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => openEditRule(rule)}
                    style={[styles.secondaryAction, { borderColor: theme.iconColor }]}
                  >
                    <ThemedText>Edit</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteRule(rule)}
                    style={[styles.secondaryAction, { borderColor: theme.warning }]}
                  >
                    <ThemedText style={{ color: theme.warning }}>Delete</ThemedText>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ThemedCard>

        <ThemedCard style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Monthly Saving Goals</ThemedText>
            <ThemedButton style={styles.smallPrimaryButton} onPress={openCreateGoal}>
              <ThemedText style={styles.buttonText}>+ Add Goal</ThemedText>
            </ThemedButton>
          </View>

          {goals.length === 0 ? (
            <ThemedText style={styles.emptyText}>No savings goals yet.</ThemedText>
          ) : (
            goals.map((goal) => {
              const progress = goalProgressById[goal.goal_id]
              const completion = Math.max(0, Math.min(1, Number(progress?.completion || 0)))
              return (
                <View key={goal.goal_id} style={[styles.itemRow, { borderBottomColor: theme.iconColor + '33' }]}>
                  <View style={styles.itemHeaderRow}>
                    <ThemedText style={styles.itemTitle}>{goal.name}</ThemedText>
                    <Switch value={Boolean(goal.enabled)} onValueChange={() => onToggleGoal(goal)} />
                  </View>

                  <ThemedText style={styles.itemMeta}>{getGoalModeLabel(goal.mode)}</ThemedText>
                  <ThemedText style={styles.itemMeta}>
                    {`Progress $${Number(progress?.savedAmount || 0).toFixed(2)} / $${Number(progress?.targetAmount || goal.target_amount || 0).toFixed(2)}`}
                  </ThemedText>
                  <View style={[styles.progressTrack, { backgroundColor: theme.iconColor + '44' }]}>
                    <View style={[styles.progressFill, { width: `${completion * 100}%`, backgroundColor: Colors.savings }]} />
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable
                      onPress={() => openEditGoal(goal)}
                      style={[styles.secondaryAction, { borderColor: theme.iconColor }]}
                    >
                      <ThemedText>Edit</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => onDeleteGoal(goal)}
                      style={[styles.secondaryAction, { borderColor: theme.warning }]}
                    >
                      <ThemedText style={{ color: theme.warning }}>Delete</ThemedText>
                    </Pressable>
                  </View>
                </View>
              )
            })
          )}
        </ThemedCard>

        <ThemedCard style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Alerts Inbox</ThemedText>
            <Pressable onPress={onClearResolved}>
              <ThemedText style={{ color: Colors.primary }}>Clear resolved</ThemedText>
            </Pressable>
          </View>

          <View style={styles.filterWrap}>
            {EVENT_STATUS_OPTIONS.map((option) => (
              <ActionChip
                key={option.key}
                label={option.label}
                theme={theme}
                active={eventStatusFilter === option.key}
                onPress={async () => {
                  setEventStatusFilter(option.key)
                  await reloadData({ status: option.key })
                }}
              />
            ))}
          </View>

          {events.length === 0 ? (
            <ThemedText style={styles.emptyText}>No events in this filter.</ThemedText>
          ) : (
            events.map((event) => (
              <View key={event.event_id} style={[styles.itemRow, { borderBottomColor: theme.iconColor + '33' }]}>
                <View style={styles.itemHeaderRow}>
                  <ThemedText style={styles.itemTitle}>{event.title}</ThemedText>
                  <ThemedText style={styles.itemStatus}>{event.status}</ThemedText>
                </View>

                <ThemedText style={styles.itemMeta}>{event.message}</ThemedText>
                <ThemedText style={styles.itemMetaSmall}>{new Date(event.created_at).toLocaleString()}</ThemedText>

                <View style={styles.rowActions}>
                  {event.status === 'new' ? (
                    <Pressable
                      onPress={() => onMarkRead(event.event_id)}
                      style={[styles.secondaryAction, { borderColor: theme.iconColor }]}
                    >
                      <ThemedText>Mark read</ThemedText>
                    </Pressable>
                  ) : null}
                  {event.status !== 'resolved' ? (
                    <Pressable
                      onPress={() => onResolve(event.event_id)}
                      style={[styles.secondaryAction, { borderColor: Colors.savings }]}
                    >
                      <ThemedText style={{ color: Colors.savings }}>Resolve</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ThemedCard>
      </ThemedScrollView>

      <Modal
        visible={ruleModalVisible}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setRuleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ThemedView style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>{editingRuleId ? 'Edit Rule' : 'New Rule'}</ThemedText>
                <Pressable onPress={() => setRuleModalVisible(false)}>
                  <ThemedText style={{ color: Colors.primary }}>Close</ThemedText>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.fieldLabel}>Rule Name</ThemedText>
                <ThemedTextInput
                  value={ruleForm.name}
                  onChangeText={(value) => setRuleForm((prev) => ({ ...prev, name: value }))}
                  style={styles.fieldInput}
                />

                <ThemedText style={styles.fieldLabel}>Alert Type</ThemedText>
                <View style={styles.filterWrap}>
                  {ALERT_TYPE_OPTIONS.map((option) => (
                    <ActionChip
                      key={option.key}
                      label={option.label}
                      theme={theme}
                      active={ruleForm.alert_type === option.key}
                      onPress={() => setRuleForm((prev) => ({ ...prev, alert_type: option.key }))}
                    />
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <ThemedText style={styles.fieldLabel}>Enabled</ThemedText>
                  <Switch
                    value={Boolean(ruleForm.enabled)}
                    onValueChange={(value) => setRuleForm((prev) => ({ ...prev, enabled: value }))}
                  />
                </View>

                <ThemedText style={styles.fieldLabel}>Cycle Start Day (1-31)</ThemedText>
                <ThemedTextInput
                  keyboardType="numeric"
                  value={ruleForm.cycle_start_day}
                  onChangeText={(value) => setRuleForm((prev) => ({ ...prev, cycle_start_day: value }))}
                  style={styles.fieldInput}
                />

                <ThemedText style={styles.fieldLabel}>Income Basis</ThemedText>
                <View style={styles.filterWrap}>
                  {INCOME_BASIS_OPTIONS.map((option) => (
                    <ActionChip
                      key={option.key}
                      label={option.label}
                      theme={theme}
                      active={ruleForm.income_basis === option.key}
                      onPress={() => setRuleForm((prev) => ({ ...prev, income_basis: option.key }))}
                    />
                  ))}
                </View>

                {ruleForm.income_basis === 'fixed' ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Fixed Monthly Income</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.fixed_income}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, fixed_income: value }))}
                      style={styles.fieldInput}
                    />
                  </>
                ) : null}

                {ruleForm.alert_type === 'spending_limit' ||
                ruleForm.alert_type === 'big_one_time' ||
                ruleForm.alert_type === 'extra_surplus' ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Threshold Mode</ThemedText>
                    <View style={styles.filterWrap}>
                      {THRESHOLD_MODE_OPTIONS.map((option) => (
                        <ActionChip
                          key={option.key}
                          label={option.label}
                          theme={theme}
                          active={ruleForm.thresholdMode === option.key}
                          onPress={() => setRuleForm((prev) => ({ ...prev, thresholdMode: option.key }))}
                        />
                      ))}
                    </View>

                    <ThemedText style={styles.fieldLabel}>Threshold Value</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.thresholdValue}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, thresholdValue: value }))}
                      style={styles.fieldInput}
                    />
                  </>
                ) : null}

                {ruleForm.alert_type === 'recurring_payment' ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Occurrences Required</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.minCount}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, minCount: value }))}
                      style={styles.fieldInput}
                    />

                    <ThemedText style={styles.fieldLabel}>Window (days)</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.windowDays}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, windowDays: value }))}
                      style={styles.fieldInput}
                    />
                  </>
                ) : null}

                {ruleForm.alert_type === 'abnormal' ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Lookback Months</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.lookbackMonths}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, lookbackMonths: value }))}
                      style={styles.fieldInput}
                    />

                    <ThemedText style={styles.fieldLabel}>Increase Threshold (%)</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      value={ruleForm.increasePercent}
                      onChangeText={(value) => setRuleForm((prev) => ({ ...prev, increasePercent: value }))}
                      style={styles.fieldInput}
                    />
                  </>
                ) : null}

                <ThemedText style={styles.fieldLabel}>Categories (optional filters)</ThemedText>
                <ThemedSelectList
                  key={`rule-category-${ruleModalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setRuleCategoryCandidateId(String(value || ''))}
                  defaultOption={ruleCategoryCandidateId
                    ? {
                      key: ruleCategoryCandidateId,
                      value: categoryLabelById[ruleCategoryCandidateId] || '',
                    }
                    : undefined}
                />
                <View style={styles.rowActions}>
                  <ThemedButton style={[styles.smallPrimaryButton, styles.inlineActionButton]} onPress={addRuleCategoryFilter}>
                    <ThemedText style={styles.buttonText}>Add Category Filter</ThemedText>
                  </ThemedButton>
                </View>
                <View style={styles.selectionGroup}>
                  <ThemedText style={styles.selectionTitle}>Selected Categories ({ruleForm.category_ids.length})</ThemedText>
                  {ruleForm.category_ids.length === 0 ? (
                    <ThemedText style={styles.emptyText}>None selected</ThemedText>
                  ) : (
                    ruleForm.category_ids.map((id) => (
                      <View key={`rule-cat-${id}`} style={styles.selectionRow}>
                        <ThemedText style={styles.selectionLabel}>{categoryLabelById[String(id)] || `Category ${id}`}</ThemedText>
                        <Pressable onPress={() => removeRuleCategoryFilter(id)}>
                          <ThemedText style={styles.removeText}>Remove</ThemedText>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>

                <ThemedText style={styles.fieldLabel}>Recipients (optional filters)</ThemedText>
                <ThemedSelectList
                  key={`rule-recipient-${ruleModalResetKey}`}
                  data={recipientOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setRuleRecipientCandidateId(String(value || ''))}
                  defaultOption={ruleRecipientCandidateId
                    ? {
                      key: ruleRecipientCandidateId,
                      value: recipientLabelById[ruleRecipientCandidateId] || '',
                    }
                    : undefined}
                />
                <View style={styles.rowActions}>
                  <ThemedButton style={[styles.smallPrimaryButton, styles.inlineActionButton]} onPress={addRuleRecipientFilter}>
                    <ThemedText style={styles.buttonText}>Add Recipient Filter</ThemedText>
                  </ThemedButton>
                </View>
                <View style={styles.selectionGroup}>
                  <ThemedText style={styles.selectionTitle}>Selected Recipients ({ruleForm.recipient_ids.length})</ThemedText>
                  {ruleForm.recipient_ids.length === 0 ? (
                    <ThemedText style={styles.emptyText}>None selected</ThemedText>
                  ) : (
                    ruleForm.recipient_ids.map((id) => (
                      <View key={`rule-rec-${id}`} style={styles.selectionRow}>
                        <ThemedText style={styles.selectionLabel}>{recipientLabelById[String(id)] || `Recipient ${id}`}</ThemedText>
                        <Pressable onPress={() => removeRuleRecipientFilter(id)}>
                          <ThemedText style={styles.removeText}>Remove</ThemedText>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>

                <ThemedButton onPress={saveRule}>
                  <ThemedText style={styles.buttonText}>{editingRuleId ? 'Save Rule' : 'Create Rule'}</ThemedText>
                </ThemedButton>
              </ScrollView>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={goalModalVisible}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ThemedView style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>{editingGoalId ? 'Edit Goal' : 'New Goal'}</ThemedText>
                <Pressable onPress={() => setGoalModalVisible(false)}>
                  <ThemedText style={{ color: Colors.primary }}>Close</ThemedText>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                <ThemedText style={styles.fieldLabel}>Goal Name</ThemedText>
                <ThemedTextInput
                  value={goalForm.name}
                  onChangeText={(value) => setGoalForm((prev) => ({ ...prev, name: value }))}
                  style={styles.fieldInput}
                />

                <View style={styles.switchRow}>
                  <ThemedText style={styles.fieldLabel}>Enabled</ThemedText>
                  <Switch
                    value={Boolean(goalForm.enabled)}
                    onValueChange={(value) => setGoalForm((prev) => ({ ...prev, enabled: value }))}
                  />
                </View>

                <ThemedText style={styles.fieldLabel}>Tracking Mode</ThemedText>
                <View style={styles.filterWrap}>
                  {GOAL_MODE_OPTIONS.map((option) => (
                    <ActionChip
                      key={option.key}
                      label={option.label}
                      theme={theme}
                      active={goalForm.mode === option.key}
                      onPress={() => setGoalForm((prev) => ({ ...prev, mode: option.key }))}
                    />
                  ))}
                </View>

                <ThemedText style={styles.fieldLabel}>Target Amount</ThemedText>
                <ThemedTextInput
                  keyboardType="numeric"
                  value={goalForm.target_amount}
                  onChangeText={(value) => setGoalForm((prev) => ({ ...prev, target_amount: value }))}
                  style={styles.fieldInput}
                />

                <ThemedText style={styles.fieldLabel}>Cycle Start Day (1-31)</ThemedText>
                <ThemedTextInput
                  keyboardType="numeric"
                  value={goalForm.cycle_start_day}
                  onChangeText={(value) => setGoalForm((prev) => ({ ...prev, cycle_start_day: value }))}
                  style={styles.fieldInput}
                />

                {goalForm.mode === 'category' ? (
                  <>
                    <ThemedText style={styles.fieldLabel}>Saving Categories</ThemedText>
                    <ThemedSelectList
                      key={`goal-category-${goalModalResetKey}`}
                      data={categoryOptions}
                      search={true}
                      save="key"
                      floating={true}
                      setSelected={(value) => setGoalCategoryCandidateId(String(value || ''))}
                      defaultOption={goalCategoryCandidateId
                        ? {
                          key: goalCategoryCandidateId,
                          value: categoryLabelById[goalCategoryCandidateId] || '',
                        }
                        : undefined}
                    />
                    <View style={styles.rowActions}>
                      <ThemedButton style={[styles.smallPrimaryButton, styles.inlineActionButton]} onPress={addGoalCategoryFilter}>
                        <ThemedText style={styles.buttonText}>Add Goal Category</ThemedText>
                      </ThemedButton>
                    </View>
                    <View style={styles.selectionGroup}>
                      <ThemedText style={styles.selectionTitle}>Selected Categories ({goalForm.category_ids.length})</ThemedText>
                      {goalForm.category_ids.length === 0 ? (
                        <ThemedText style={styles.emptyText}>None selected</ThemedText>
                      ) : (
                        goalForm.category_ids.map((id) => (
                          <View key={`goal-cat-${id}`} style={styles.selectionRow}>
                            <ThemedText style={styles.selectionLabel}>{categoryLabelById[String(id)] || `Category ${id}`}</ThemedText>
                            <Pressable onPress={() => removeGoalCategoryFilter(id)}>
                              <ThemedText style={styles.removeText}>Remove</ThemedText>
                            </Pressable>
                          </View>
                        ))
                      )}
                    </View>
                  </>
                ) : null}

                <ThemedButton onPress={saveGoal}>
                  <ThemedText style={styles.buttonText}>{editingGoalId ? 'Save Goal' : 'Create Goal'}</ThemedText>
                </ThemedButton>
              </ScrollView>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ThemedView>
  )
}

export default Alerts

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 10,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 20,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  headerActionButton: {
    flex: 1,
  },
  debugInfoText: {
    opacity: 0.85,
    lineHeight: 18,
  },
  debugCard: {
    marginTop: 10,
    borderRadius: 10,
  },
  sectionCard: {
    marginTop: 16,
    borderRadius: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  smallPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 0,
  },
  inlineActionButton: {
    marginTop: 0,
    marginBottom: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 10,
    opacity: 0.8,
  },
  itemRow: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemTitle: {
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  itemMeta: {
    marginTop: 4,
    opacity: 0.9,
    lineHeight: 18,
  },
  itemMetaSmall: {
    marginTop: 4,
    opacity: 0.75,
    fontSize: 12,
  },
  itemStatus: {
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  secondaryAction: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  selectionGroup: {
    gap: 6,
    marginTop: 8,
  },
  selectionTitle: {
    fontWeight: '700',
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eef3f0',
  },
  selectionLabel: {
    flex: 1,
    paddingRight: 10,
  },
  removeText: {
    color: Colors.warning,
    fontWeight: '700',
  },
  progressTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 30,
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 12,
    maxHeight: '88%',
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '700',
  },
  fieldInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  switchRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
