const PROJECTION_SUBTYPE_MONTHLY_SPENDING = 'monthly-spending'
const PROJECTION_SUBTYPE_SAVINGS_DEBT = 'savings-debt'
const PROJECTION_SUBTYPE_YEARLY_BILLS = 'yearly-bills'
const PROJECTION_SUBTYPE_SUBSCRIPTIONS = 'subscriptions'

const PROJECTION_SUBTYPE_OPTIONS = [
  { key: PROJECTION_SUBTYPE_MONTHLY_SPENDING, label: 'Monthly Spending Projection' },
  { key: PROJECTION_SUBTYPE_SAVINGS_DEBT, label: 'Savings/Debt Projection' },
  { key: PROJECTION_SUBTYPE_YEARLY_BILLS, label: 'Yearly Bills Projection' },
  { key: PROJECTION_SUBTYPE_SUBSCRIPTIONS, label: 'Subscription Spending Projection' },
]

const PROJECTION_DASH_ARRAY = [5, 4]
const DEFAULT_FORECAST_HORIZON_MONTHS = 12
const HORIZON_OPTIONS = [6, 12, 24, 36]

const normalizeIdList = (values) => Array.from(new Set((values || []).map((value) => String(value)).filter(Boolean)))

const toDate = (value) => {
  const parsed = value ? new Date(value) : null
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null
  return parsed
}

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)

const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const parseMonthKey = (monthKey) => {
  const [yearText, monthText] = String(monthKey || '').split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null
  return new Date(year, month - 1, 1)
}

const toMonthChartLabel = (date) => `${date.getFullYear()}\n${String(date.getMonth() + 1).padStart(2, '0')}`
const toMonthRangeLabel = (months = []) => {
  if (!Array.isArray(months) || months.length === 0) return ''

  const toLabel = (date) => `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
  const start = months[0]
  const end = months[months.length - 1]
  return `${toLabel(start)} to ${toLabel(end)}`
}

const formatCurrency = (value) => {
  const numeric = Number(value) || 0
  const sign = numeric < 0 ? '-' : ''
  return `${sign}$${Math.abs(numeric).toFixed(2)}`
}

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return numeric
}

const safeRound2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const toLinearFit = (values = []) => {
  const points = (values || [])
    .map((value, index) => ({ x: index + 1, y: toNumber(value, 0) }))
    .filter((point) => Number.isFinite(point.y))

  if (points.length < 2) {
    const lastValue = points.length > 0 ? points[points.length - 1].y : 0
    return { slope: 0, intercept: lastValue }
  }

  const n = points.length
  const sumX = points.reduce((sum, point) => sum + point.x, 0)
  const sumY = points.reduce((sum, point) => sum + point.y, 0)
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0)
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0)

  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

const estimateLineValue = (lineFit, x) => safeRound2((lineFit?.slope || 0) * x + (lineFit?.intercept || 0))

const buildSeriesData = (labels = [], actualValues = [], projectedValues = []) => {
  const actualData = labels.map((label, index) => ({ label, value: actualValues[index] }))
  const projectedData = labels.map((label, index) => ({ label, value: projectedValues[index] }))

  return [
    {
      data: actualData,
      color: '#1f8a70',
      dataPointsColor: '#1f8a70',
      thickness: 2,
      textShiftY: -4,
      isAnimated: true,
      hideDataPoints: false,
    },
    {
      data: projectedData,
      color: '#f97316',
      dataPointsColor: '#f97316',
      thickness: 2,
      textShiftY: -4,
      isAnimated: true,
      hideDataPoints: false,
      strokeDashArray: PROJECTION_DASH_ARRAY,
    },
  ]
}

const getMaxAbsFromSeries = (seriesValues = []) => {
  const values = (seriesValues || []).filter((value) => Number.isFinite(value)).map((value) => Math.abs(value))
  if (values.length === 0) return 1
  return Math.max(1, ...values)
}

const getSignedAmount = (record) => {
  const rawAmount = Number(record?.amount) || 0
  const transactionType = String(record?.type || '').toLowerCase()
  const magnitude = Math.abs(rawAmount)

  if (transactionType === 'spending') return -magnitude
  if (transactionType === 'income') return magnitude
  return rawAmount
}

const toProjectionSubtypeLabel = (subtype) => {
  const found = PROJECTION_SUBTYPE_OPTIONS.find((item) => item.key === subtype)
  return found?.label || 'Projection'
}

const toDefaultProjectionConfig = (subtype = PROJECTION_SUBTYPE_MONTHLY_SPENDING) => ({
  subtype,
  forecastHorizonMonths: DEFAULT_FORECAST_HORIZON_MONTHS,
  monthlySpending: {
    excludedCategoryIds: [],
  },
  savingsDebt: {
    mode: 'surplus',
    includeCategoryIds: [],
  },
  yearlyBills: {
    includeCategoryIds: [],
    includeRecipientIds: [],
  },
  subscriptions: {
    includeCategoryIds: [],
    includeRecipientIds: [],
  },
})

const normalizeProjectionConfig = (source = {}, subtype = PROJECTION_SUBTYPE_MONTHLY_SPENDING) => {
  const defaults = toDefaultProjectionConfig(subtype)
  const nextSubtype = PROJECTION_SUBTYPE_OPTIONS.some((item) => item.key === source?.subtype) ? source.subtype : subtype

  return {
    ...defaults,
    ...source,
    subtype: nextSubtype,
    forecastHorizonMonths: HORIZON_OPTIONS.includes(Number(source?.forecastHorizonMonths))
      ? Number(source?.forecastHorizonMonths)
      : defaults.forecastHorizonMonths,
    monthlySpending: {
      ...defaults.monthlySpending,
      ...(source?.monthlySpending || {}),
      excludedCategoryIds: normalizeIdList(source?.monthlySpending?.excludedCategoryIds),
    },
    savingsDebt: {
      ...defaults.savingsDebt,
      ...(source?.savingsDebt || {}),
      mode: source?.savingsDebt?.mode === 'categories' ? 'categories' : 'surplus',
      includeCategoryIds: normalizeIdList(source?.savingsDebt?.includeCategoryIds),
    },
    yearlyBills: {
      ...defaults.yearlyBills,
      ...(source?.yearlyBills || {}),
      includeCategoryIds: normalizeIdList(source?.yearlyBills?.includeCategoryIds),
      includeRecipientIds: normalizeIdList(source?.yearlyBills?.includeRecipientIds),
    },
    subscriptions: {
      ...defaults.subscriptions,
      ...(source?.subscriptions || {}),
      includeCategoryIds: normalizeIdList(source?.subscriptions?.includeCategoryIds),
      includeRecipientIds: normalizeIdList(source?.subscriptions?.includeRecipientIds),
    },
  }
}

const buildMonthlySpendingModel = (records, projectionConfig) => {
  const excludedCategoryIds = new Set((projectionConfig?.monthlySpending?.excludedCategoryIds || []).map((item) => String(item)))
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const daysInMonth = monthEnd.getDate()
  const todayIndex = Math.min(daysInMonth, today.getDate())

  const dailySpend = Array.from({ length: daysInMonth }, () => 0)

  ;(records || []).forEach((record) => {
    const date = toDate(record?.date)
    if (!date) return
    if (date < monthStart || date > monthEnd) return
    if (String(record?.type || '').toLowerCase() !== 'spending') return

    const categoryId = String(record?.cid || '')
    if (excludedCategoryIds.has(categoryId)) return

    const dayIndex = date.getDate() - 1
    dailySpend[dayIndex] += Math.abs(toNumber(record?.amount, 0))
  })

  const cumulative = []
  let running = 0
  for (let index = 0; index < daysInMonth; index += 1) {
    running += dailySpend[index]
    cumulative.push(safeRound2(running))
  }

  const trainingValues = cumulative.slice(0, todayIndex)
  const lineFit = toLinearFit(trainingValues)

  const labels = Array.from({ length: daysInMonth }, (_, index) => String(index + 1))
  const actualValues = labels.map((_, index) => (index < todayIndex ? cumulative[index] : null))
  const projectedValues = labels.map((_, index) => {
    if (index < todayIndex - 1) return null
    if (index === todayIndex - 1) return cumulative[index]
    const predicted = estimateLineValue(lineFit, index + 1)
    return Math.max(cumulative[todayIndex - 1] || 0, predicted)
  })

  const tableRows = labels.map((label, index) => {
    const actualValue = index < todayIndex ? cumulative[index] : null
    const projectedValue = index >= todayIndex - 1 ? projectedValues[index] : null
    return {
      period: `Day ${label}`,
      actual: actualValue,
      projected: projectedValue,
      gap: Number.isFinite(actualValue) && Number.isFinite(projectedValue) ? safeRound2(projectedValue - actualValue) : null,
    }
  })

  return {
    title: 'Monthly Spending Projection',
    subtitle: 'Current month daily cumulative spending',
    dataSet: buildSeriesData(labels, actualValues, projectedValues),
    pointsCount: labels.length,
    maxAbsValue: getMaxAbsFromSeries([...actualValues, ...projectedValues]),
    legend: [
      { key: 'actual', label: 'Actual cumulative spending', color: '#1f8a70' },
      { key: 'projection', label: 'Projected cumulative spending', color: '#f97316', dashed: true },
    ],
    table: {
      columns: [
        { key: 'period', label: 'Day', flex: 1.4, type: 'text', align: 'left' },
        { key: 'actual', label: 'Actual', flex: 1.1, type: 'amount', align: 'right' },
        { key: 'projected', label: 'Projected', flex: 1.2, type: 'amount', align: 'right' },
        { key: 'gap', label: 'Gap', flex: 1, type: 'amount', align: 'right' },
      ],
      rows: tableRows,
      summary: {
        label: 'Month-end projected spending',
        value: Number.isFinite(projectedValues[projectedValues.length - 1]) ? projectedValues[projectedValues.length - 1] : cumulative[cumulative.length - 1] || 0,
      },
    },
  }
}

const toMonthSequence = (endDate, count) => {
  const end = startOfMonth(endDate)
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index
    return new Date(end.getFullYear(), end.getMonth() - offset, 1)
  })
}

const buildSavingsDebtModel = (records, projectionConfig) => {
  const horizon = projectionConfig?.forecastHorizonMonths || DEFAULT_FORECAST_HORIZON_MONTHS
  const mode = projectionConfig?.savingsDebt?.mode === 'categories' ? 'categories' : 'surplus'
  const includeCategorySet = new Set((projectionConfig?.savingsDebt?.includeCategoryIds || []).map((item) => String(item)))

  const currentMonth = startOfMonth(new Date())
  const actualMonths = toMonthSequence(currentMonth, 12)
  const monthlyNetByKey = {}

  ;(records || []).forEach((record) => {
    const date = toDate(record?.date)
    if (!date) return
    const monthDate = startOfMonth(date)
    const monthKey = toMonthKey(monthDate)

    if (mode === 'categories') {
      const categoryId = String(record?.cid || '')
      if (!includeCategorySet.has(categoryId)) return

      const transactionType = String(record?.type || '').toLowerCase()
      const amountMagnitude = Math.abs(toNumber(record?.amount, 0))
      const savingsContribution = transactionType === 'spending'
        ? amountMagnitude
        : transactionType === 'income'
          ? -amountMagnitude
          : 0

      monthlyNetByKey[monthKey] = safeRound2((monthlyNetByKey[monthKey] || 0) + savingsContribution)
      return
    }

    monthlyNetByKey[monthKey] = safeRound2((monthlyNetByKey[monthKey] || 0) + getSignedAmount(record))
  })

  const actualMonthlyNet = actualMonths.map((date) => monthlyNetByKey[toMonthKey(date)] || 0)
  const futureMonths = Array.from({ length: horizon }, (_, index) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + index + 1, 1))
  const forecastRangeLabel = toMonthRangeLabel(futureMonths)

  const labels = [...actualMonths, ...futureMonths].map((date) => toMonthChartLabel(date))

  const cumulativeActual = []
  let runningActual = 0
  for (let index = 0; index < actualMonthlyNet.length; index += 1) {
    runningActual += actualMonthlyNet[index]
    cumulativeActual.push(safeRound2(runningActual))
  }

  const currentMonthNet = actualMonthlyNet[actualMonthlyNet.length - 1] || 0
  const shouldIncludeCurrentMonth = Math.abs(currentMonthNet) > 0
  const regressionSeries = shouldIncludeCurrentMonth
    ? cumulativeActual
    : cumulativeActual.slice(0, -1)

  const cumulativeLineFit = toLinearFit(regressionSeries)
  const slopePerMonth = Number.isFinite(cumulativeLineFit?.slope) ? cumulativeLineFit.slope : 0

  const previousMonthCumulative = regressionSeries[regressionSeries.length - 1] || 0
  const projectedCurrentMonthCumulative = estimateLineValue(cumulativeLineFit, regressionSeries.length + 1)
  const projectedCurrentMonthNet = safeRound2(projectedCurrentMonthCumulative - previousMonthCumulative)

  const displayMonthlyNet = [...actualMonthlyNet]
  if (!shouldIncludeCurrentMonth) {
    displayMonthlyNet[displayMonthlyNet.length - 1] = projectedCurrentMonthNet
  }

  const displayCumulativeActual = []
  let runningDisplayCumulative = 0
  for (let index = 0; index < displayMonthlyNet.length; index += 1) {
    runningDisplayCumulative += displayMonthlyNet[index]
    displayCumulativeActual.push(safeRound2(runningDisplayCumulative))
  }

  const startingCumulative = displayCumulativeActual[displayCumulativeActual.length - 1] || 0

  const cumulativeProjected = []
  for (let index = 0; index < futureMonths.length; index += 1) {
    cumulativeProjected.push(safeRound2(startingCumulative + slopePerMonth * (index + 1)))
  }

  const futureNet = cumulativeProjected.map((value, index) => {
    const previous = index === 0 ? startingCumulative : cumulativeProjected[index - 1]
    return safeRound2(value - previous)
  })

  const actualValues = labels.map((_, index) => (index < actualMonths.length ? displayCumulativeActual[index] : null))
  const projectedValues = labels.map((_, index) => {
    if (index < actualMonths.length - 1) return null
    if (index === actualMonths.length - 1) return displayCumulativeActual[displayCumulativeActual.length - 1] || 0
    const futureIndex = index - actualMonths.length
    return cumulativeProjected[futureIndex]
  })

  const tableRows = labels.map((label, index) => {
    const monthlyActual = index < actualMonths.length ? displayMonthlyNet[index] : null
    const monthlyProjected = index >= actualMonths.length ? futureNet[index - actualMonths.length] : null
    return {
      period: label.replace('\n', '/'),
      monthlyActual,
      monthlyProjected,
      cumulative: index < actualMonths.length ? displayCumulativeActual[index] : cumulativeProjected[index - actualMonths.length],
    }
  })

  return {
    title: 'Savings/Debt Projection',
    subtitle: mode === 'categories' ? 'Cumulative selected savings categories' : 'Cumulative month-end surplus/debt',
    dataSet: buildSeriesData(labels, actualValues, projectedValues),
    pointsCount: labels.length,
    maxAbsValue: getMaxAbsFromSeries([...actualValues, ...projectedValues]),
    legend: [
      { key: 'actual', label: 'Actual cumulative', color: '#1f8a70' },
      { key: 'projection', label: 'Projected cumulative', color: '#f97316', dashed: true },
    ],
    table: {
      columns: [
        { key: 'period', label: 'Month', flex: 1.4, type: 'text', align: 'left' },
        { key: 'monthlyActual', label: 'Net Actual', flex: 1.1, type: 'amount', align: 'right' },
        { key: 'monthlyProjected', label: 'Net Projected', flex: 1.3, type: 'amount', align: 'right' },
        { key: 'cumulative', label: 'Cumulative', flex: 1.2, type: 'amount', align: 'right' },
      ],
      rows: tableRows,
      summary: {
        label: forecastRangeLabel
          ? `Projected cumulative (next ${horizon} months: ${forecastRangeLabel})`
          : `Projected cumulative (next ${horizon} months)`,
        value: cumulativeProjected[cumulativeProjected.length - 1] ?? displayCumulativeActual[displayCumulativeActual.length - 1] ?? 0,
      },
    },
  }
}

const buildYearlyBillsModel = (records, projectionConfig) => {
  const horizon = projectionConfig?.forecastHorizonMonths || DEFAULT_FORECAST_HORIZON_MONTHS
  const includeCategoryIds = new Set((projectionConfig?.yearlyBills?.includeCategoryIds || []).map((item) => String(item)))
  const includeRecipientIds = new Set((projectionConfig?.yearlyBills?.includeRecipientIds || []).map((item) => String(item)))

  const monthlyBillsByKey = {}

  ;(records || []).forEach((record) => {
    const date = toDate(record?.date)
    if (!date) return
    if (String(record?.type || '').toLowerCase() !== 'spending') return

    if (includeCategoryIds.size > 0 && !includeCategoryIds.has(String(record?.cid || ''))) return
    if (includeRecipientIds.size > 0 && !includeRecipientIds.has(String(record?.rid || ''))) return

    const monthKey = toMonthKey(startOfMonth(date))
    monthlyBillsByKey[monthKey] = safeRound2((monthlyBillsByKey[monthKey] || 0) + Math.abs(toNumber(record?.amount, 0)))
  })

  const currentMonth = startOfMonth(new Date())
  const currentMonthKey = toMonthKey(currentMonth)
  const actualMonths = toMonthSequence(currentMonth, 12)
  const futureMonths = Array.from({ length: horizon }, (_, index) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + index + 1, 1))
  const forecastRangeLabel = toMonthRangeLabel(futureMonths)

  const actualValuesOnly = actualMonths.map((date) => monthlyBillsByKey[toMonthKey(date)] || 0)

  const predictionBillsByKey = { ...monthlyBillsByKey }
  delete predictionBillsByKey[currentMonthKey]

  const estimateSeasonalValue = (date) => {
    const referenceDate = new Date(date.getFullYear() - 1, date.getMonth(), 1)
    const referenceKey = toMonthKey(referenceDate)

    if (Number.isFinite(predictionBillsByKey[referenceKey])) {
      return safeRound2(predictionBillsByKey[referenceKey])
    }

    const sameMonthValues = Object.entries(predictionBillsByKey)
      .filter(([monthKey]) => parseMonthKey(monthKey)?.getMonth() === date.getMonth())
      .map(([, value]) => toNumber(value, 0))

    if (sameMonthValues.length === 0) return 0
    const average = sameMonthValues.reduce((sum, value) => sum + value, 0) / sameMonthValues.length
    return safeRound2(average)
  }

  const projectedCurrentMonthValue = estimateSeasonalValue(currentMonth)
  const displayActualValuesOnly = [...actualValuesOnly]
  if ((displayActualValuesOnly[displayActualValuesOnly.length - 1] || 0) === 0) {
    displayActualValuesOnly[displayActualValuesOnly.length - 1] = projectedCurrentMonthValue
  }

  const projectedMonthly = futureMonths.map((date) => estimateSeasonalValue(date))

  const labels = [...actualMonths, ...futureMonths].map((date) => toMonthChartLabel(date))

  const actualValues = labels.map((_, index) => (index < actualMonths.length ? displayActualValuesOnly[index] : null))
  const projectedValues = labels.map((_, index) => {
    if (index < actualMonths.length - 1) return null
    if (index === actualMonths.length - 1) return displayActualValuesOnly[displayActualValuesOnly.length - 1] || 0
    return projectedMonthly[index - actualMonths.length]
  })

  const tableRows = labels.map((label, index) => ({
    period: label.replace('\n', '/'),
    actual: index < actualMonths.length ? displayActualValuesOnly[index] : null,
    projected: index >= actualMonths.length ? projectedMonthly[index - actualMonths.length] : null,
  }))

  return {
    title: 'Yearly Bills Projection',
    subtitle: 'Seasonal naive forecast by month-of-year',
    dataSet: buildSeriesData(labels, actualValues, projectedValues),
    pointsCount: labels.length,
    maxAbsValue: getMaxAbsFromSeries([...actualValues, ...projectedValues]),
    legend: [
      { key: 'actual', label: 'Actual monthly bills', color: '#1f8a70' },
      { key: 'projection', label: 'Projected monthly bills', color: '#f97316', dashed: true },
    ],
    table: {
      columns: [
        { key: 'period', label: 'Month', flex: 1.5, type: 'text', align: 'left' },
        { key: 'actual', label: 'Actual Bills', flex: 1.2, type: 'amount', align: 'right' },
        { key: 'projected', label: 'Projected Bills', flex: 1.4, type: 'amount', align: 'right' },
      ],
      rows: tableRows,
      summary: {
        label: forecastRangeLabel
          ? `Projected bills total (next ${horizon} months: ${forecastRangeLabel})`
          : `Projected bills total (next ${horizon} months)`,
        value: projectedMonthly.reduce((sum, value) => sum + value, 0),
      },
    },
  }
}

const buildSubscriptionModel = (records, projectionConfig) => {
  const horizon = projectionConfig?.forecastHorizonMonths || DEFAULT_FORECAST_HORIZON_MONTHS
  const includeCategoryIds = new Set((projectionConfig?.subscriptions?.includeCategoryIds || []).map((item) => String(item)))
  const includeRecipientIds = new Set((projectionConfig?.subscriptions?.includeRecipientIds || []).map((item) => String(item)))

  const monthlySpendByKey = {}

  ;(records || []).forEach((record) => {
    const date = toDate(record?.date)
    if (!date) return
    if (String(record?.type || '').toLowerCase() !== 'spending') return

    if (includeCategoryIds.size > 0 && !includeCategoryIds.has(String(record?.cid || ''))) return
    if (includeRecipientIds.size > 0 && !includeRecipientIds.has(String(record?.rid || ''))) return

    const monthKey = toMonthKey(startOfMonth(date))
    monthlySpendByKey[monthKey] = safeRound2((monthlySpendByKey[monthKey] || 0) + Math.abs(toNumber(record?.amount, 0)))
  })

  const currentMonth = startOfMonth(new Date())
  const previousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
  const previousMonthKey = toMonthKey(previousMonth)
  const previousMonthTotal = monthlySpendByKey[previousMonthKey] || 0
  const actualMonths = toMonthSequence(currentMonth, 12)
  const actualMonthlySpend = actualMonths.map((date) => monthlySpendByKey[toMonthKey(date)] || 0)
  const displayMonthlySpend = [...actualMonthlySpend]
  if ((displayMonthlySpend[displayMonthlySpend.length - 1] || 0) === 0) {
    displayMonthlySpend[displayMonthlySpend.length - 1] = previousMonthTotal
  }

  const futureMonths = Array.from({ length: horizon }, (_, index) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + index + 1, 1))
  const forecastRangeLabel = toMonthRangeLabel(futureMonths)
  const projectedMonthlySpend = futureMonths.map(() => previousMonthTotal)

  const cumulativeDisplayActual = []
  let runningDisplayActual = 0
  for (let index = 0; index < displayMonthlySpend.length; index += 1) {
    runningDisplayActual += displayMonthlySpend[index]
    cumulativeDisplayActual.push(safeRound2(runningDisplayActual))
  }

  const cumulativeProjected = []
  let runningProjected = cumulativeDisplayActual[cumulativeDisplayActual.length - 1] || 0
  for (let index = 0; index < projectedMonthlySpend.length; index += 1) {
    runningProjected += projectedMonthlySpend[index]
    cumulativeProjected.push(safeRound2(runningProjected))
  }

  const labels = [...actualMonths, ...futureMonths].map((date) => toMonthChartLabel(date))

  const actualValues = labels.map((_, index) => (index < actualMonths.length ? cumulativeDisplayActual[index] : null))
  const projectedValues = labels.map((_, index) => {
    if (index < actualMonths.length - 1) return null
    if (index === actualMonths.length - 1) return cumulativeDisplayActual[cumulativeDisplayActual.length - 1] || 0
    return cumulativeProjected[index - actualMonths.length]
  })

  const tableRows = labels.map((label, index) => ({
    period: label.replace('\n', '/'),
    monthlyActual: index < actualMonths.length ? displayMonthlySpend[index] : null,
    monthlyProjected: index >= actualMonths.length ? projectedMonthlySpend[index - actualMonths.length] : null,
    cumulative: index < actualMonths.length ? cumulativeDisplayActual[index] : cumulativeProjected[index - actualMonths.length],
  }))

  return {
    title: 'Subscription Spending Projection',
    subtitle: `Cumulative subscription spending forecast using previous month baseline (${previousMonthKey})`,
    dataSet: buildSeriesData(labels, actualValues, projectedValues),
    pointsCount: labels.length,
    maxAbsValue: getMaxAbsFromSeries([...actualValues, ...projectedValues]),
    legend: [
      { key: 'actual', label: 'Actual cumulative subscriptions', color: '#1f8a70' },
      { key: 'projection', label: 'Projected cumulative subscriptions', color: '#f97316', dashed: true },
    ],
    table: {
      columns: [
        { key: 'period', label: 'Month', flex: 1.4, type: 'text', align: 'left' },
        { key: 'monthlyActual', label: 'Actual Monthly', flex: 1.2, type: 'amount', align: 'right' },
        { key: 'monthlyProjected', label: 'Projected Monthly', flex: 1.3, type: 'amount', align: 'right' },
        { key: 'cumulative', label: 'Cumulative', flex: 1.2, type: 'amount', align: 'right' },
      ],
      rows: tableRows,
      summary: {
        label: forecastRangeLabel
          ? `Projected cumulative (next ${horizon} months: ${forecastRangeLabel})`
          : `Projected cumulative (next ${horizon} months)`,
        value: safeRound2(projectedMonthlySpend.reduce((sum, value) => sum + value, 0)),
      },
    },
  }
}

const buildProjectionModel = ({ records = [], projectionConfig = {} }) => {
  const normalized = normalizeProjectionConfig(projectionConfig, projectionConfig?.subtype)

  if (normalized.subtype === PROJECTION_SUBTYPE_SAVINGS_DEBT) {
    return buildSavingsDebtModel(records, normalized)
  }

  if (normalized.subtype === PROJECTION_SUBTYPE_YEARLY_BILLS) {
    return buildYearlyBillsModel(records, normalized)
  }

  if (normalized.subtype === PROJECTION_SUBTYPE_SUBSCRIPTIONS) {
    return buildSubscriptionModel(records, normalized)
  }

  return buildMonthlySpendingModel(records, normalized)
}

export {
  DEFAULT_FORECAST_HORIZON_MONTHS,
  HORIZON_OPTIONS,
  PROJECTION_DASH_ARRAY,
  PROJECTION_SUBTYPE_MONTHLY_SPENDING,
  PROJECTION_SUBTYPE_OPTIONS,
  PROJECTION_SUBTYPE_SAVINGS_DEBT,
  PROJECTION_SUBTYPE_SUBSCRIPTIONS,
  PROJECTION_SUBTYPE_YEARLY_BILLS,
  buildProjectionModel,
  formatCurrency,
  normalizeProjectionConfig,
  toDefaultProjectionConfig,
  toProjectionSubtypeLabel,
}
