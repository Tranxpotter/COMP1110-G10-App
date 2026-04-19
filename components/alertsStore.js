import * as FileSystem from 'expo-file-system/legacy'
import { executeSqlAsync, fetchAllCategories, fetchAllRecipients } from './dbClient'

const ALERT_TYPES = [
  'spending_limit',
  'big_one_time',
  'recurring_payment',
  'abnormal',
  'extra_surplus',
]
const ALERT_TYPE_SET = new Set(ALERT_TYPES)

const SAVINGS_MODES = ['category', 'residual']
const SAVINGS_MODE_SET = new Set(SAVINGS_MODES)

const ALERTS_STORE_FILENAME = 'alerts-store.json'
const ALERTS_STORE_BASE_DIR = FileSystem.documentDirectory || FileSystem.cacheDirectory || ''
export const ALERTS_STORE_FILE = `${ALERTS_STORE_BASE_DIR}${ALERTS_STORE_FILENAME}`

function toIsoNow() {
  return new Date().toISOString()
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeBoolean(value, fallback = true) {
  if (value == null) return fallback
  return Boolean(value)
}

function toDateOnlyString(value = null) {
  const source = value ?? new Date()
  const parsed = source instanceof Date ? source : new Date(source)
  if (Number.isNaN(parsed.getTime())) return ''

  const yyyy = parsed.getFullYear()
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeCutoffDateExclusive(value = null) {
  if (value == null || value === '') return null
  const normalized = toDateOnlyString(value)
  return normalized || null
}

function parseJsonObject(value, fallback = {}) {
  if (value == null || value === '') return { ...fallback }
  if (typeof value === 'object' && !Array.isArray(value)) return { ...fallback, ...value }

  try {
    const parsed = JSON.parse(String(value))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed }
    }
  } catch (e) {
    console.warn('parseJsonObject failed', e)
  }

  return { ...fallback }
}

function normalizeIdArray(values = []) {
  //console.log('normalizeIdArray input:', values) //debug
  if (!Array.isArray(values)) return []
  const ids = []
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) ids.push(parsed)
  }
  //console.log('normalizeIdArray output:', ids) //debug
  return Array.from(new Set(ids))
}

function normalizeCycleStartDay(value, fallback = 1) {
  const parsed = Math.trunc(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(31, parsed))
}

function normalizeAlertType(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return ALERT_TYPE_SET.has(normalized) ? normalized : 'spending_limit'
}

function normalizeSavingsMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return SAVINGS_MODE_SET.has(normalized) ? normalized : 'residual'
}

function normalizeIncomeBasis(value) {
  return String(value || '').trim().toLowerCase() === 'fixed' ? 'fixed' : 'transactions'
}

function normalizeThresholdMode(value) {
  return String(value || '').trim().toLowerCase() === 'percent' ? 'percent' : 'amount'
}

function getLastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function createDateWithDay(year, monthIndex, preferredDay) {
  const safeDay = Math.min(getLastDayOfMonth(year, monthIndex), Math.max(1, preferredDay))
  return new Date(year, monthIndex, safeDay)
}

function addMonthsKeepingPreferredDay(date, deltaMonths, preferredDay) {
  const source = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(source.getTime())) return new Date()
  const shifted = new Date(source.getFullYear(), source.getMonth() + deltaMonths, 1)
  return createDateWithDay(shifted.getFullYear(), shifted.getMonth(), preferredDay)
}

function getCycleBoundsForDate(referenceDate, cycleStartDay = 1) {
  const normalizedCycleStartDay = normalizeCycleStartDay(cycleStartDay, 1)
  const refDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate)
  const safeReferenceDate = Number.isNaN(refDate.getTime()) ? new Date() : refDate

  const currentMonthStart = createDateWithDay(
    safeReferenceDate.getFullYear(),
    safeReferenceDate.getMonth(),
    normalizedCycleStartDay
  )

  const startsCurrentMonthCycle = safeReferenceDate.getDate() >= currentMonthStart.getDate()
  const cycleStart = startsCurrentMonthCycle
    ? currentMonthStart
    : addMonthsKeepingPreferredDay(currentMonthStart, -1, normalizedCycleStartDay)

  const nextCycleStart = addMonthsKeepingPreferredDay(cycleStart, 1, normalizedCycleStartDay)
  const cycleEnd = new Date(nextCycleStart)
  cycleEnd.setDate(cycleEnd.getDate() - 1)

  return {
    cycleStart,
    cycleEnd,
    cycleStartDate: toDateOnlyString(cycleStart),
    cycleEndDate: toDateOnlyString(cycleEnd),
    cycleKey: `${toDateOnlyString(cycleStart)}__${toDateOnlyString(cycleEnd)}`,
  }
}

function shiftCycleBounds(bounds, deltaMonths, cycleStartDay = 1) {
  const normalizedCycleStartDay = normalizeCycleStartDay(cycleStartDay, 1)
  const shiftedStart = addMonthsKeepingPreferredDay(bounds.cycleStart, deltaMonths, normalizedCycleStartDay)
  return getCycleBoundsForDate(shiftedStart, normalizedCycleStartDay)
}

function buildDefaultAlertsStore() {
  return {
    version: 1,
    updatedAt: toIsoNow(),
    counters: {
      rule: 0,
      goal: 0,
      event: 0,
    },
    settings: {
      notifications: {
        channel: 'in_app',
      },
    },
    rules: [],
    goals: [],
    events: [],
  }
}

function normalizeRuleForStore(rule = {}) {
  const now = toIsoNow()
  return {
    rule_id: Math.max(1, Math.trunc(normalizeNumber(rule.rule_id, 1))),
    name: String(rule.name || '').trim(),
    alert_type: normalizeAlertType(rule.alert_type),
    enabled: normalizeBoolean(rule.enabled, true),
    cycle_start_day: normalizeCycleStartDay(rule.cycle_start_day, 1),
    income_basis: normalizeIncomeBasis(rule.income_basis),
    fixed_income: rule.fixed_income == null ? null : Math.max(0, normalizeNumber(rule.fixed_income, 0)),
    category_ids: normalizeIdArray(rule.category_ids),
    recipient_ids: normalizeIdArray(rule.recipient_ids),
    config: parseJsonObject(rule.config, {}),
    created_at: String(rule.created_at || now),
    updated_at: String(rule.updated_at || now),
  }
}

function normalizeGoalForStore(goal = {}) {
  console.log('Normalizing Goal:', goal)
  const now = toIsoNow()
  return {
    goal_id: Math.max(1, Math.trunc(normalizeNumber(goal.goal_id, 1))),
    name: String(goal.name || '').trim(),
    enabled: normalizeBoolean(goal.enabled, true),
    mode: normalizeSavingsMode(goal.mode),
    cycle_start_day: normalizeCycleStartDay(goal.cycle_start_day, 1),
    target_amount: Math.max(0, normalizeNumber(goal.target_amount, 0)),
    category_ids: normalizeIdArray(goal.category_ids),
    config: parseJsonObject(goal.config, {}),
    created_at: String(goal.created_at || now),
    updated_at: String(goal.updated_at || now),
  }
}

function normalizeEventForStore(event = {}) {
  const now = toIsoNow()
  const normalizedStatus = ['new', 'read', 'resolved'].includes(String(event.status || '').toLowerCase())
    ? String(event.status).toLowerCase()
    : 'new'

  return {
    event_id: Math.max(1, Math.trunc(normalizeNumber(event.event_id, 1))),
    source_type: String(event.source_type || 'rule'),
    rule_id: event.rule_id == null ? null : Number(event.rule_id),
    goal_id: event.goal_id == null ? null : Number(event.goal_id),
    cycle_key: String(event.cycle_key || ''),
    trigger_signature: String(event.trigger_signature || ''),
    title: String(event.title || 'Alert'),
    message: String(event.message || ''),
    severity: String(event.severity || 'info'),
    status: normalizedStatus,
    payload: parseJsonObject(event.payload, {}),
    created_at: String(event.created_at || now),
    read_at: event.read_at == null ? null : String(event.read_at),
    resolved_at: event.resolved_at == null ? null : String(event.resolved_at),
  }
}

function normalizeStoreSnapshot(raw = {}) {
  const base = buildDefaultAlertsStore()

  const rules = Array.isArray(raw.rules) ? raw.rules.map(normalizeRuleForStore).filter((rule) => rule.name) : []
  const goals = Array.isArray(raw.goals) ? raw.goals.map(normalizeGoalForStore).filter((goal) => goal.name) : []
  const events = Array.isArray(raw.events) ? raw.events.map(normalizeEventForStore) : []

  const maxRuleId = rules.reduce((max, rule) => Math.max(max, Number(rule.rule_id) || 0), 0)
  const maxGoalId = goals.reduce((max, goal) => Math.max(max, Number(goal.goal_id) || 0), 0)
  const maxEventId = events.reduce((max, event) => Math.max(max, Number(event.event_id) || 0), 0)

  return {
    version: normalizeNumber(raw.version, 1),
    updatedAt: String(raw.updatedAt || toIsoNow()),
    counters: {
      rule: Math.max(maxRuleId, normalizeNumber(raw?.counters?.rule, 0)),
      goal: Math.max(maxGoalId, normalizeNumber(raw?.counters?.goal, 0)),
      event: Math.max(maxEventId, normalizeNumber(raw?.counters?.event, 0)),
    },
    settings: parseJsonObject(raw.settings, base.settings),
    rules,
    goals,
    events,
  }
}

function nextId(store, key) {
  const currentValue = normalizeNumber(store?.counters?.[key], 0)
  const nextValue = Math.max(0, Math.trunc(currentValue)) + 1
  store.counters[key] = nextValue
  return nextValue
}

async function persistStore(store) {
  const normalized = normalizeStoreSnapshot(store)
  normalized.updatedAt = toIsoNow()

  const enc = FileSystem?.EncodingType?.UTF8 || 'utf8'
  await FileSystem.writeAsStringAsync(ALERTS_STORE_FILE, JSON.stringify(normalized, null, 2), { encoding: enc })
  return normalized
}

async function readStore() {
  if (!ALERTS_STORE_FILE) {
    return buildDefaultAlertsStore()
  }

  const info = await FileSystem.getInfoAsync(ALERTS_STORE_FILE)
  if (!info.exists) {
    const initial = buildDefaultAlertsStore()
    await persistStore(initial)
    return initial
  }

  try {
    const enc = FileSystem?.EncodingType?.UTF8 || 'utf8'
    const content = await FileSystem.readAsStringAsync(ALERTS_STORE_FILE, { encoding: enc })
    const parsed = JSON.parse(content)
    return normalizeStoreSnapshot(parsed)
  } catch (e) {
    console.warn('readStore failed, using default', e)
    const initial = buildDefaultAlertsStore()
    await persistStore(initial)
    return initial
  }
}

function formatCurrencyAmount(value) {
  const amount = normalizeNumber(value, 0)
  return `$${amount.toFixed(2)}`
}

function buildInClause(column, ids = [], params = []) {
  if (!Array.isArray(ids) || ids.length === 0) return ''
  const placeholders = ids.map(() => '?').join(', ')
  params.push(...ids)
  return `${column} IN (${placeholders})`
}

function appendCutoffDateClause(whereClauses = [], params = [], cutoffDateExclusive = null) {
  const normalizedCutoff = normalizeCutoffDateExclusive(cutoffDateExclusive)
  if (!normalizedCutoff) return
  whereClauses.push('date < ?')
  params.push(normalizedCutoff)
}

async function sumAmountsForPeriod({ startDate, endDate, type, categoryIds = [], recipientIds = [], cutoffDateExclusive = null }) {
  console.log('sumAmountsForPeriod params:', { startDate, endDate, categoryIds })
  const params = [startDate, endDate, type]
  const whereClauses = ['date BETWEEN ? AND ?', 'type = ?']

  appendCutoffDateClause(whereClauses, params, cutoffDateExclusive)

  const categoryClause = buildInClause('cid', normalizeIdArray(categoryIds), params)
  if (categoryClause) whereClauses.push(categoryClause)

  const recipientClause = buildInClause('rid', normalizeIdArray(recipientIds), params)
  if (recipientClause) whereClauses.push(recipientClause)

  const res = await executeSqlAsync(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM record WHERE ${whereClauses.join(' AND ')}`,
    params
  )
  console.log('sumAmountsForPeriod params:', { startDate, endDate, categoryIds }) //debug

  return normalizeNumber(res?.rows?._array?.[0]?.total, 0)
}

async function fetchSpendingTransactionsForPeriod({ startDate, endDate, categoryIds = [], recipientIds = [], cutoffDateExclusive = null }) {
  const params = [startDate, endDate, 'spending']
  const whereClauses = ['date BETWEEN ? AND ?', 'type = ?']

  appendCutoffDateClause(whereClauses, params, cutoffDateExclusive)

  const categoryClause = buildInClause('cid', normalizeIdArray(categoryIds), params)
  if (categoryClause) whereClauses.push(categoryClause)

  const recipientClause = buildInClause('rid', normalizeIdArray(recipientIds), params)
  if (recipientClause) whereClauses.push(recipientClause)

  const res = await executeSqlAsync(
    `SELECT tid, amount, date, cid, rid FROM record WHERE ${whereClauses.join(' AND ')} ORDER BY date ASC, tid ASC`,
    params
  )

  return res?.rows?._array || []
}

async function fetchPairAggregatesForPeriod({ startDate, endDate, categoryIds = [], recipientIds = [], cutoffDateExclusive = null }) {
  const params = [startDate, endDate, 'spending']
  const whereClauses = ['date BETWEEN ? AND ?', 'type = ?']

  appendCutoffDateClause(whereClauses, params, cutoffDateExclusive)

  const categoryClause = buildInClause('cid', normalizeIdArray(categoryIds), params)
  if (categoryClause) whereClauses.push(categoryClause)

  const recipientClause = buildInClause('rid', normalizeIdArray(recipientIds), params)
  if (recipientClause) whereClauses.push(recipientClause)

  const res = await executeSqlAsync(
    `
      SELECT rid, cid, COUNT(*) AS tx_count, COALESCE(SUM(amount), 0) AS total
      FROM record
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY rid, cid
    `,
    params
  )

  return (res?.rows?._array || []).map((item) => ({
    rid: item.rid == null ? null : Number(item.rid),
    cid: item.cid == null ? null : Number(item.cid),
    tx_count: normalizeNumber(item.tx_count, 0),
    total: normalizeNumber(item.total, 0),
  }))
}

async function fetchPairTotalForCycle(pair, cycleBounds, evaluationOptions = {}) {
  const params = [cycleBounds.cycleStartDate, cycleBounds.cycleEndDate, 'spending']
  const whereClauses = ['date BETWEEN ? AND ?', 'type = ?']

  appendCutoffDateClause(whereClauses, params, evaluationOptions?.cutoffDateExclusive)

  if (pair.rid == null) {
    whereClauses.push('rid IS NULL')
  } else {
    whereClauses.push('rid = ?')
    params.push(pair.rid)
  }

  if (pair.cid == null) {
    whereClauses.push('cid IS NULL')
  } else {
    whereClauses.push('cid = ?')
    params.push(pair.cid)
  }

  const res = await executeSqlAsync(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM record WHERE ${whereClauses.join(' AND ')}`,
    params
  )

  return normalizeNumber(res?.rows?._array?.[0]?.total, 0)
}

async function getCategoryNameByIdMap() {
  const categories = await fetchAllCategories()
  return categories.reduce((acc, item) => {
    acc[Number(item.cid)] = item.cname || `Category ${item.cid}`
    return acc
  }, {})
}

async function getRecipientNameByIdMap() {
  const recipients = await fetchAllRecipients()
  return recipients.reduce((acc, item) => {
    acc[Number(item.rid)] = item.name || `Recipient ${item.rid}`
    return acc
  }, {})
}

function getPairLabel(pair, context = {}) {
  const categoryNames = context.categoryNames || {}
  const recipientNames = context.recipientNames || {}
  const recipientLabel = pair.rid != null ? (recipientNames[pair.rid] || `Recipient ${pair.rid}`) : 'Unknown recipient'
  const categoryLabel = pair.cid != null ? (categoryNames[pair.cid] || `Category ${pair.cid}`) : 'Unknown category'
  return `${recipientLabel} / ${categoryLabel}`
}

function computeThresholdAmount(config, incomeAmount) {
  const thresholdMode = normalizeThresholdMode(config.thresholdMode)
  const thresholdValue = Math.max(0, normalizeNumber(config.thresholdValue, 0))
  if (thresholdMode === 'percent') {
    return (Math.max(0, incomeAmount) * thresholdValue) / 100
  }
  return thresholdValue
}

async function computeIncomeForRule(rule, cycleBounds, evaluationOptions = {}) {
  if (rule.income_basis === 'fixed') {
    return Math.max(0, normalizeNumber(rule.fixed_income, 0))
  }

  return sumAmountsForPeriod({
    startDate: cycleBounds.cycleStartDate,
    endDate: cycleBounds.cycleEndDate,
    type: 'income',
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })
}

function insertAlertEventInStore(store, inputEvent = {}) {
  const normalized = normalizeEventForStore({
    ...inputEvent,
    event_id: nextId(store, 'event'),
    created_at: toIsoNow(),
    status: inputEvent.status || 'new',
  })

  const alreadyExists = store.events.some((event) => (
    event.source_type === normalized.source_type &&
    event.rule_id === normalized.rule_id &&
    event.goal_id === normalized.goal_id &&
    event.cycle_key === normalized.cycle_key &&
    event.trigger_signature === normalized.trigger_signature
  ))

  console.log('Checking for existing alert:', {
  trigger_signature: inputEvent.trigger_signature,
})
  if (alreadyExists) {
    store.counters.event = Math.max(0, normalizeNumber(store.counters.event, 1) - 1)
    return false
  }

  store.events.push(normalized)
  return true
}

async function evaluateSpendingLimitRule(store, rule, referenceDate, context, evaluationOptions = {}) {
  const cycleBounds = getCycleBoundsForDate(referenceDate, rule.cycle_start_day)
  const config = parseJsonObject(rule.config, {})

  const spending = await sumAmountsForPeriod({
    startDate: cycleBounds.cycleStartDate,
    endDate: cycleBounds.cycleEndDate,
    type: 'spending',
    categoryIds: rule.category_ids,
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })
  const income = await computeIncomeForRule(rule, cycleBounds, evaluationOptions)
  const threshold = computeThresholdAmount(config, income)

  if (threshold <= 0 || spending <= threshold) return 0

  const inserted = insertAlertEventInStore(store, {
    source_type: 'rule',
    rule_id: rule.rule_id,
    goal_id: null,
    cycle_key: cycleBounds.cycleKey,
    trigger_signature: `spending_limit:${rule.rule_id}:${cycleBounds.cycleKey}`,
    title: `Spending limit exceeded: ${rule.name}`,
    message: `Spending reached ${formatCurrencyAmount(spending)} vs threshold ${formatCurrencyAmount(threshold)} for cycle ${cycleBounds.cycleStartDate} to ${cycleBounds.cycleEndDate}.`,
    severity: 'warning',
    payload: {
      spending,
      threshold,
      income,
      cycleStartDate: cycleBounds.cycleStartDate,
      cycleEndDate: cycleBounds.cycleEndDate,
      categoryIds: rule.category_ids,
      categoryNames: (rule.category_ids || []).map((id) => context.categoryNames?.[id] || String(id)),
    },
  })

  return inserted ? 1 : 0
}

async function evaluateBigOneTimeRule(store, rule, referenceDate, evaluationOptions = {}) {
  const cycleBounds = getCycleBoundsForDate(referenceDate, rule.cycle_start_day)
  const config = parseJsonObject(rule.config, {})

  const income = await computeIncomeForRule(rule, cycleBounds, evaluationOptions)
  const threshold = computeThresholdAmount(config, income)
  if (threshold <= 0) return 0

  const spendingRecords = await fetchSpendingTransactionsForPeriod({
    startDate: cycleBounds.cycleStartDate,
    endDate: cycleBounds.cycleEndDate,
    categoryIds: rule.category_ids,
    recipientIds: rule.recipient_ids,
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })

  let insertedCount = 0
  for (const record of spendingRecords) {
    const amount = normalizeNumber(record.amount, 0)
    if (amount <= threshold) continue

    const inserted = insertAlertEventInStore(store, {
      source_type: 'rule',
      rule_id: rule.rule_id,
      goal_id: null,
      cycle_key: cycleBounds.cycleKey,
      trigger_signature: `big_one_time:${rule.rule_id}:tid:${record.tid}`,
      title: `Large payment detected: ${rule.name}`,
      message: `Transaction #${record.tid} on ${record.date} was ${formatCurrencyAmount(amount)} and exceeded ${formatCurrencyAmount(threshold)}.`,
      severity: 'warning',
      payload: {
        tid: record.tid,
        date: record.date,
        amount,
        threshold,
      },
    })
    if (inserted) insertedCount += 1
  }

  return insertedCount
}

async function evaluateRecurringRule(store, rule, referenceDate, context, evaluationOptions = {}) {
  const config = parseJsonObject(rule.config, {})
  const minCount = Math.max(2, Math.trunc(normalizeNumber(config.minCount, 3)))
  const windowDays = Math.max(2, Math.trunc(normalizeNumber(config.windowDays, 30)))

  const endDate = new Date(referenceDate)
  if (Number.isNaN(endDate.getTime())) return 0
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (windowDays - 1))

  const startDateStr = toDateOnlyString(startDate)
  const endDateStr = toDateOnlyString(endDate)

  const pairs = await fetchPairAggregatesForPeriod({
    startDate: startDateStr,
    endDate: endDateStr,
    categoryIds: rule.category_ids,
    recipientIds: rule.recipient_ids,
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })

  let insertedCount = 0
  for (const pair of pairs) {
    if (pair.tx_count < minCount) continue

    const pairLabel = getPairLabel(pair, context)
    const inserted = insertAlertEventInStore(store, {
      source_type: 'rule',
      rule_id: rule.rule_id,
      goal_id: null,
      cycle_key: `${startDateStr}__${endDateStr}`,
      trigger_signature: `recurring:${rule.rule_id}:${pair.rid ?? 'none'}:${pair.cid ?? 'none'}:${minCount}`,
      title: `Recurring payment pattern: ${rule.name}`,
      message: `${pairLabel} appeared ${pair.tx_count} times in the last ${windowDays} days.`,
      severity: 'info',
      payload: {
        rid: pair.rid,
        cid: pair.cid,
        txCount: pair.tx_count,
        total: pair.total,
        windowDays,
        windowStart: startDateStr,
        windowEnd: endDateStr,
      },
    })
    if (inserted) insertedCount += 1
  }

  return insertedCount
}

async function evaluateAbnormalRule(store, rule, referenceDate, context, evaluationOptions = {}) {
  const config = parseJsonObject(rule.config, {})
  const lookbackMonths = Math.max(1, Math.trunc(normalizeNumber(config.lookbackMonths, 3)))
  const increasePercent = Math.max(0, normalizeNumber(config.increasePercent, 30))
  const currentCycle = getCycleBoundsForDate(referenceDate, rule.cycle_start_day)

  const currentPairs = await fetchPairAggregatesForPeriod({
    startDate: currentCycle.cycleStartDate,
    endDate: currentCycle.cycleEndDate,
    categoryIds: rule.category_ids,
    recipientIds: rule.recipient_ids,
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })

  let insertedCount = 0
  for (const pair of currentPairs) {
    if (pair.total <= 0) continue

    let historyTotal = 0
    for (let i = 1; i <= lookbackMonths; i += 1) {
      const historicalCycle = shiftCycleBounds(currentCycle, -i, rule.cycle_start_day)
      const historicalTotal = await fetchPairTotalForCycle(pair, historicalCycle, evaluationOptions)
      historyTotal += historicalTotal
    }

    const average = historyTotal / lookbackMonths
    if (average <= 0) continue

    const threshold = average * (1 + increasePercent / 100)
    if (pair.total <= threshold) continue

    const pairLabel = getPairLabel(pair, context)
    const inserted = insertAlertEventInStore(store, {
      source_type: 'rule',
      rule_id: rule.rule_id,
      goal_id: null,
      cycle_key: currentCycle.cycleKey,
      trigger_signature: `abnormal:${rule.rule_id}:${pair.rid ?? 'none'}:${pair.cid ?? 'none'}:${currentCycle.cycleKey}`,
      title: `Abnormal spending spike: ${rule.name}`,
      message: `${pairLabel} reached ${formatCurrencyAmount(pair.total)} this cycle, above ${increasePercent}% over average ${formatCurrencyAmount(average)}.`,
      severity: 'warning',
      payload: {
        rid: pair.rid,
        cid: pair.cid,
        currentTotal: pair.total,
        historicalAverage: average,
        threshold,
        lookbackMonths,
      },
    })
    if (inserted) insertedCount += 1
  }

  return insertedCount
}

async function evaluateExtraSurplusRule(store, rule, referenceDate, evaluationOptions = {}) {
  const config = parseJsonObject(rule.config, {})
  const activeCycle = getCycleBoundsForDate(referenceDate, rule.cycle_start_day)
  const completedCycle = shiftCycleBounds(activeCycle, -1, rule.cycle_start_day)

  const spending = await sumAmountsForPeriod({
    startDate: completedCycle.cycleStartDate,
    endDate: completedCycle.cycleEndDate,
    type: 'spending',
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })
  const income = await computeIncomeForRule(rule, completedCycle, evaluationOptions)
  const surplus = income - spending
  const threshold = computeThresholdAmount(config, income)

  if (threshold <= 0 || surplus <= threshold) return 0



  const inserted = insertAlertEventInStore(store, {
    source_type: 'rule',
    rule_id: rule.rule_id,
    goal_id: null,
    cycle_key: completedCycle.cycleKey,
    trigger_signature: `extra_surplus:${rule.rule_id}:${completedCycle.cycleKey}`,
    title: `Extra surplus reached: ${rule.name}`,
    message: `Surplus for ${completedCycle.cycleStartDate} to ${completedCycle.cycleEndDate} is ${formatCurrencyAmount(surplus)} (threshold ${formatCurrencyAmount(threshold)}).`,
    severity: 'success',
    payload: {
      surplus,
      threshold,
      income,
      spending,
      cycleStartDate: completedCycle.cycleStartDate,
      cycleEndDate: completedCycle.cycleEndDate,
    },
  })

  return inserted ? 1 : 0
}

async function evaluateRuleByType(store, rule, referenceDate, context, evaluationOptions = {}) {
  if (!rule?.enabled) return 0

  if (rule.alert_type === 'spending_limit') {
    return evaluateSpendingLimitRule(store, rule, referenceDate, context, evaluationOptions)
  }
  if (rule.alert_type === 'big_one_time') {
    return evaluateBigOneTimeRule(store, rule, referenceDate, evaluationOptions)
  }
  if (rule.alert_type === 'recurring_payment') {
    return evaluateRecurringRule(store, rule, referenceDate, context, evaluationOptions)
  }
  if (rule.alert_type === 'abnormal') {
    return evaluateAbnormalRule(store, rule, referenceDate, context, evaluationOptions)
  }
  if (rule.alert_type === 'extra_surplus') {
    return evaluateExtraSurplusRule(store, rule, referenceDate, evaluationOptions)
  }

  return 0
}

async function computeSavingsForGoal(goal, cycleBounds, evaluationOptions = {}) {
  console.log('Computing Savings for Goal:', goal)
  console.log('Cycle Bounds:', cycleBounds)
  console.log('Goal Category IDs:', goal.category_ids)

  if (goal.mode === 'category') {
    console.log('Category Mode: Passing categoryIds to sumAmountsForPeriod')
    return sumAmountsForPeriod({
      startDate: cycleBounds.cycleStartDate,
      endDate: cycleBounds.cycleEndDate,
      type: 'spending',
      categoryIds: goal.category_ids,
      cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
    })
  }

  const spending = await sumAmountsForPeriod({
    startDate: cycleBounds.cycleStartDate,
    endDate: cycleBounds.cycleEndDate,
    type: 'spending',
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })
  const income = await sumAmountsForPeriod({
    startDate: cycleBounds.cycleStartDate,
    endDate: cycleBounds.cycleEndDate,
    type: 'income',
    cutoffDateExclusive: evaluationOptions?.cutoffDateExclusive,
  })

  return Math.max(0, income - spending)
}

async function evaluateSavingsGoal(store, goal, referenceDate, evaluationOptions = {}) {
  console.log('Evaluating Goal:', goal)
  if (!goal?.enabled) return 0
  const cycleBounds = getCycleBoundsForDate(referenceDate, goal.cycle_start_day)
  const savings = await computeSavingsForGoal(goal, cycleBounds, evaluationOptions)
  const target = Math.max(0, normalizeNumber(goal.target_amount, 0))
  if (target <= 0 || savings < target) return 0

  const inserted = insertAlertEventInStore(store, {
    source_type: 'goal',
    rule_id: null,
    goal_id: goal.goal_id,
    cycle_key: cycleBounds.cycleKey,
    trigger_signature: `goal_reached:${goal.goal_id}:${cycleBounds.cycleKey}`,
    title: `Savings goal reached: ${goal.name}`,
    message: `Current savings ${formatCurrencyAmount(savings)} reached target ${formatCurrencyAmount(target)} for this cycle.`,
    severity: 'success',
    payload: {
      savings,
      target,
      mode: goal.mode,
      cycleStartDate: cycleBounds.cycleStartDate,
      cycleEndDate: cycleBounds.cycleEndDate,
    },
  })

  return inserted ? 1 : 0
}

export async function fetchAllAlertRules(options = {}) {
  const enabledOnly = options?.enabledOnly === true
  const store = await readStore()

  const rules = store.rules
    .filter((item) => (enabledOnly ? item.enabled : true))
    .sort((a, b) => {
      const dateDiff = String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      if (dateDiff !== 0) return dateDiff
      return Number(b.rule_id) - Number(a.rule_id)
    })

  return rules.map((item) => ({ ...item, config: parseJsonObject(item.config, {}) }))
}

export async function addAlertRule(input = {}) {
  const store = await readStore()
  const now = toIsoNow()

  const payload = normalizeRuleForStore({
    rule_id: nextId(store, 'rule'),
    name: String(input.name || `${normalizeAlertType(input.alert_type)} rule`).trim(),
    alert_type: normalizeAlertType(input.alert_type),
    enabled: normalizeBoolean(input.enabled, true),
    cycle_start_day: normalizeCycleStartDay(input.cycle_start_day, 1),
    income_basis: normalizeIncomeBasis(input.income_basis),
    fixed_income: input.fixed_income == null ? null : normalizeNumber(input.fixed_income, 0),
    category_ids: normalizeIdArray(input.category_ids),
    recipient_ids: normalizeIdArray(input.recipient_ids),
    config: parseJsonObject(input.config, {}),
    created_at: now,
    updated_at: now,
  })

  if (!payload.name) throw new Error('Rule name is required')
  if (payload.income_basis === 'fixed' && (payload.fixed_income == null || payload.fixed_income < 0)) {
    throw new Error('Fixed income must be set when using fixed income basis')
  }

  store.rules.push(payload)
  await persistStore(store)
  return payload.rule_id
}

export async function updateAlertRule(ruleId, patch = {}) {
  const numericRuleId = Number(ruleId)
  if (!Number.isFinite(numericRuleId)) throw new Error('ruleId required')

  const store = await readStore()
  const index = store.rules.findIndex((item) => Number(item.rule_id) === numericRuleId)
  if (index === -1) throw new Error('Alert rule not found')

  const current = store.rules[index]
  const merged = normalizeRuleForStore({
    ...current,
    ...patch,
    rule_id: current.rule_id,
    name: patch.name == null ? current.name : patch.name,
    alert_type: patch.alert_type == null ? current.alert_type : patch.alert_type,
    enabled: patch.enabled == null ? current.enabled : patch.enabled,
    cycle_start_day: patch.cycle_start_day == null ? current.cycle_start_day : patch.cycle_start_day,
    income_basis: patch.income_basis == null ? current.income_basis : patch.income_basis,
    fixed_income: patch.fixed_income == null ? current.fixed_income : patch.fixed_income,
    category_ids: patch.category_ids == null ? current.category_ids : patch.category_ids,
    recipient_ids: patch.recipient_ids == null ? current.recipient_ids : patch.recipient_ids,
    config: patch.config == null ? current.config : patch.config,
    created_at: current.created_at,
    updated_at: toIsoNow(),
  })

  if (!merged.name) throw new Error('Rule name is required')
  store.rules[index] = merged
  await persistStore(store)
  return true
}

export async function toggleAlertRule(ruleId, enabled) {
  return updateAlertRule(ruleId, { enabled: Boolean(enabled) })
}

export async function deleteAlertRule(ruleId) {
  const numericRuleId = Number(ruleId)
  if (!Number.isFinite(numericRuleId)) throw new Error('ruleId required')

  const store = await readStore()
  const beforeRules = store.rules.length

  store.rules = store.rules.filter((item) => Number(item.rule_id) !== numericRuleId)
  store.events = store.events.filter((event) => Number(event.rule_id) !== numericRuleId)

  if (store.rules.length === beforeRules) return 0
  await persistStore(store)
  return 1
}

export async function fetchAllSavingsGoals(options = {}) {
  const enabledOnly = options?.enabledOnly === true
  const store = await readStore()

  const goals = store.goals
    .filter((item) => (enabledOnly ? item.enabled : true))
    .sort((a, b) => {
      const dateDiff = String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      if (dateDiff !== 0) return dateDiff
      return Number(b.goal_id) - Number(a.goal_id)
    })

  return goals.map((item) => ({ ...item, config: parseJsonObject(item.config, {}) }))
}

export async function addSavingsGoal(input = {}) {
  console.log('Adding Savings Goal Input:', input)
  const store = await readStore()
  const now = toIsoNow()

  const payload = normalizeGoalForStore({
    
    goal_id: nextId(store, 'goal'),
    name: String(input.name || 'Savings goal').trim(),
    enabled: normalizeBoolean(input.enabled, true),
    mode: normalizeSavingsMode(input.mode),
    cycle_start_day: normalizeCycleStartDay(input.cycle_start_day, 1),
    target_amount: Math.max(0, normalizeNumber(input.target_amount, 0)),
    category_ids: normalizeIdArray(input.category_ids),
    config: parseJsonObject(input.config, {}),
    created_at: now,
    updated_at: now,
  })
  console.log('Adding Savings Goal:', payload)

  if (!payload.name) throw new Error('Goal name is required')
  if (payload.target_amount <= 0) throw new Error('Target amount must be greater than 0')

  store.goals.push(payload)
  await persistStore(store)
  return payload.goal_id
}

export async function updateSavingsGoal(goalId, patch = {}) {
  const numericGoalId = Number(goalId)
  if (!Number.isFinite(numericGoalId)) throw new Error('goalId required')

  const store = await readStore()
  const index = store.goals.findIndex((item) => Number(item.goal_id) === numericGoalId)
  if (index === -1) throw new Error('Savings goal not found')

  const current = store.goals[index]
  const merged = normalizeGoalForStore({
    ...current,
    ...patch,
    goal_id: current.goal_id,
    name: patch.name == null ? current.name : patch.name,
    enabled: patch.enabled == null ? current.enabled : patch.enabled,
    mode: patch.mode == null ? current.mode : patch.mode,
    cycle_start_day: patch.cycle_start_day == null ? current.cycle_start_day : patch.cycle_start_day,
    target_amount: patch.target_amount == null ? current.target_amount : patch.target_amount,
    category_ids: patch.category_ids == null ? current.category_ids : patch.category_ids,
    config: patch.config == null ? current.config : patch.config,
    created_at: current.created_at,
    updated_at: toIsoNow(),
  })

  if (!merged.name) throw new Error('Goal name is required')
  if (merged.target_amount <= 0) throw new Error('Target amount must be greater than 0')

  store.goals[index] = merged
  await persistStore(store)
  return true
}

export async function toggleSavingsGoal(goalId, enabled) {
  return updateSavingsGoal(goalId, { enabled: Boolean(enabled) })
}

export async function deleteSavingsGoal(goalId) {
  const numericGoalId = Number(goalId)
  if (!Number.isFinite(numericGoalId)) throw new Error('goalId required')

  const store = await readStore()
  const beforeGoals = store.goals.length

  store.goals = store.goals.filter((item) => Number(item.goal_id) !== numericGoalId)
  store.events = store.events.filter((event) => Number(event.goal_id) !== numericGoalId)

  if (store.goals.length === beforeGoals) return 0
  await persistStore(store)
  return 1
}

export async function fetchAlertEvents(options = {}) {
  const status = String(options?.status || 'all').toLowerCase()
  const limit = Number(options?.limit)
  const store = await readStore()

  const ruleById = store.rules.reduce((acc, item) => {
    acc[Number(item.rule_id)] = item
    return acc
  }, {})

  const goalById = store.goals.reduce((acc, item) => {
    acc[Number(item.goal_id)] = item
    return acc
  }, {})

  let events = [...store.events]
  if (status === 'new' || status === 'read' || status === 'resolved') {
    events = events.filter((item) => item.status === status)
  }

  events.sort((a, b) => {
    const dateDiff = String(b.created_at || '').localeCompare(String(a.created_at || ''))
    if (dateDiff !== 0) return dateDiff
    return Number(b.event_id) - Number(a.event_id)
  })

  if (Number.isFinite(limit) && limit > 0) {
    events = events.slice(0, Math.trunc(limit))
  }

  return events.map((item) => ({
    ...item,
    payload: parseJsonObject(item.payload, {}),
    rule_name: item.rule_id == null ? null : ruleById[Number(item.rule_id)]?.name || null,
    goal_name: item.goal_id == null ? null : goalById[Number(item.goal_id)]?.name || null,
    hasBeenRead: item.status === 'read' || item.status === 'resolved',
  }))
}

export async function markAlertEventRead(eventId) {
  const numericEventId = Number(eventId)
  if (!Number.isFinite(numericEventId)) throw new Error('eventId required')

  const store = await readStore()
  const index = store.events.findIndex((item) => Number(item.event_id) === numericEventId)
  if (index === -1) return false

  const current = store.events[index]
  if (current.status === 'resolved') return true

  store.events[index] = normalizeEventForStore({
    ...current,
    status: 'read',
    read_at: current.read_at || toIsoNow(),
  })

  await persistStore(store)
  return true
}

export async function resolveAlertEvent(eventId) {
  const numericEventId = Number(eventId)
  if (!Number.isFinite(numericEventId)) throw new Error('eventId required')

  const store = await readStore()
  const index = store.events.findIndex((item) => Number(item.event_id) === numericEventId)
  if (index === -1) return false

  const now = toIsoNow()
  const current = store.events[index]
  store.events[index] = normalizeEventForStore({
    ...current,
    status: 'resolved',
    read_at: current.read_at || now,
    resolved_at: now,
  })

  await persistStore(store)
  return true
}

export async function clearResolvedAlertEvents() {
  const store = await readStore()
  const beforeCount = store.events.length
  store.events = store.events.filter((item) => item.status !== 'resolved')
  const removed = beforeCount - store.events.length
  if (removed > 0) {
    await persistStore(store)
  }
  return removed
}

export async function evaluateAlertsForDate(referenceDate = null, options = {}) {
  const dateString = toDateOnlyString(referenceDate)
  if (!dateString) return { inserted: 0, date: '' }

  const store = await readStore()
  const evaluationOptions = {
    cutoffDateExclusive: normalizeCutoffDateExclusive(options?.cutoffDateExclusive),
  }

  const [categoryNames, recipientNames] = await Promise.all([
    getCategoryNameByIdMap(),
    getRecipientNameByIdMap(),
  ])

  let inserted = 0
  const context = { categoryNames, recipientNames }

  for (const rule of store.rules.filter((item) => item.enabled)) {
    try {
      inserted += await evaluateRuleByType(store, rule, dateString, context, evaluationOptions)
    } catch (e) {
      console.warn('evaluateRuleByType failed', rule?.rule_id, e)
    }
  }

  for (const goal of store.goals.filter((item) => item.enabled)) {
    try {
      inserted += await evaluateSavingsGoal(store, goal, dateString, evaluationOptions)
      console.log('Evaluating Goal:', goal)
    } catch (e) {
      console.warn('evaluateSavingsGoal failed', goal?.goal_id, e)
    }
  }



  if (inserted > 0) {
    await persistStore(store)
  }

  return { inserted, date: dateString }
}

export async function fetchSavingsGoalProgress(referenceDate = null, options = {}) {
  const dateString = toDateOnlyString(referenceDate)
  const store = await readStore()
  const categoryNames = await getCategoryNameByIdMap()
  const evaluationOptions = {
    cutoffDateExclusive: normalizeCutoffDateExclusive(options?.cutoffDateExclusive),
  }

  const result = []
  for (const goal of store.goals) {
    const cycleBounds = getCycleBoundsForDate(dateString, goal.cycle_start_day)
    const savedAmount = await computeSavingsForGoal(goal, cycleBounds, evaluationOptions)
    const target = Math.max(0, normalizeNumber(goal.target_amount, 0))
    const completion = target > 0 ? Math.min(1, savedAmount / target) : 0

    result.push({
      ...goal,
      savedAmount,
      targetAmount: target,
      completion,
      cycleStartDate: cycleBounds.cycleStartDate,
      cycleEndDate: cycleBounds.cycleEndDate,
      categoryNames: (goal.category_ids || []).map((id) => categoryNames[id] || String(id)),
    })
  }

  return result
}

export async function getAlertSetting(key, fallbackValue = null) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return fallbackValue

  const store = await readStore()
  if (store.settings[normalizedKey] === undefined) return fallbackValue
  return store.settings[normalizedKey]
}

export async function setAlertSetting(key, value) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) throw new Error('Setting key is required')

  const store = await readStore()
  store.settings[normalizedKey] = value
  await persistStore(store)
  return true
}

export async function getAlertsStoreSnapshot() {
  return readStore()
}

export async function resetAlertsStore() {
  const initial = buildDefaultAlertsStore()
  await persistStore(initial)
  return true
}

export async function refreshAlertEvaluations(options = {}) {
  const cutoffDateExclusive = normalizeCutoffDateExclusive(options?.cutoffDateExclusive)
  const store = await readStore()

  store.events = []
  store.counters.event = 0
  await persistStore(store)

  const params = []
  let sql = `
    SELECT DISTINCT date
    FROM record
    WHERE date IS NOT NULL
      AND TRIM(date) <> ''
  `

  // determine cycle bounds for the requested reference date (default = today)
  const referenceDate = toDateOnlyString(options?.referenceDate ?? new Date())
  const cycleStartDay = normalizeCycleStartDay(options?.cycle_start_day ?? 1)
  const cycleBounds = getCycleBoundsForDate(referenceDate, cycleStartDay)

  // start from either an explicit startDate option, or from the reference date (today/debug date)
  const queryStart = toDateOnlyString(options?.startDate ?? referenceDate)
  const queryEnd = cycleBounds.cycleEndDate

  // restrict fetched dates to the period [queryStart, queryEnd]
  sql += ' AND date BETWEEN ? AND ?'
  params.push(queryStart, queryEnd)

  if (cutoffDateExclusive) {
    sql += ' AND date < ?'
    params.push(cutoffDateExclusive)
  }

  sql += ' ORDER BY date ASC'

  const res = await executeSqlAsync(sql, params)
  const dates = (res?.rows?._array || [])
    .map((item) => String(item.date || '').trim())
    .filter(Boolean)

  let inserted = 0
  for (const dateValue of dates) {
    const result = await evaluateAlertsForDate(dateValue, { cutoffDateExclusive })
    inserted += Number(result?.inserted || 0)
  }

  return {
    cutoffDateExclusive,
    referenceDate,
    cycleStartDay,
    cycleStartDate: cycleBounds.cycleStartDate,
    cycleEndDate: cycleBounds.cycleEndDate,
    datesEvaluated: dates.length,
    inserted,
  }
}
