import { useState } from 'react'
import { fetchAllRecords, fetchRecordsByDateRange } from '../components/dbClient'



export async function oneBigPaymentRule(records = [], options = {}) { //I will probably make a comment on what options avaliable for major function.
  // options:
  //  - bigPaymentPercent: percent of income a single payment must exceed (default 50)
  //  - bigPaymentMinAmount: absolute minimum amount to consider (default 0)
  //  - resetDay: day of month for period reset (1..28) (default 1)
  const bigPaymentPercent = Number(options.bigPaymentPercent ?? 50) || 50
  const bigPaymentMinAmount = Number(options.bigPaymentMinAmount ?? 0) || 0
  const resetDay = Math.max(1, Math.min(28, Number(options.resetDay ?? 1)))

  // compute period start/end (same logic as monthlySpendvsIncomeRule)
  const now = new Date()
  let start
  if (now.getDate() >= resetDay) {
    start = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const nextReset = new Date(start.getFullYear(), start.getMonth() + 1, resetDay)
  const end = new Date(nextReset.getFullYear(), nextReset.getMonth(), nextReset.getDate() - 1)

  const formatDate = d => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // get rows for the period if none provided
  let rows = Array.isArray(records) && records.length ? records : null
  if (!rows) {
    try {
      rows = await fetchRecordsByDateRange(startDate, endDate)
    } catch (e) {
      console.warn('oneBigPaymentRule: fetchRecordsByDateRange failed', e)
      rows = []
    }
  } else {
    // filter passed-in rows to period
    rows = rows.filter(r => {
      const dStr = (r.date || '').slice(0, 10)
      if (dStr) return dStr >= startDate && dStr <= endDate
      if (r.inputdatetime) {
        const d = new Date(r.inputdatetime)
        if (!isNaN(d.getTime())) {
          const ds = formatDate(d)
          return ds >= startDate && ds <= endDate
        }
      }
      return false
    })
  }

  // compute total income for the period
  let income = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if ((r.type || '').toLowerCase() === 'income') income += amt
  }

  // if no income and no min amount set, skip
  if (income <= 0 && bigPaymentMinAmount <= 0) return []

  const threshold = Math.max(income * (bigPaymentPercent / 100), bigPaymentMinAmount)

  const out = []
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if ((r.type || '').toLowerCase() === 'income') continue
    if (amt >= threshold && amt > 0) {
      out.push({
        id: `onebig-${r.rid ?? r.id}-${amt}`,
        title: `Large single payment (${bigPaymentPercent}% of income)`,
        message: `Payment ${amt} in period ${startDate}→${endDate} is >= ${bigPaymentPercent}% of income (${Math.round(threshold)}).`,
        severity: 'medium',
        record: r,
        periodStart: startDate,
        periodEnd: endDate,
        income,
        threshold
      })
    }
  }

  return out
}



export async function monthlySpendvsIncomeRule(records = [], options = {}) { //amountThreshold, percentThreshold, resetDay
  // options:
  //  - amountThreshold: absolute amount by which spending must exceed income to alert (default 0)
  //  - percentThreshold: percent exceedance over income to alert (e.g. 20 for 20%) (default 0)
  //  - resetDay: day of month when the reporting period resets (1..28). default 1
  const amountThreshold = Number(options.amountThreshold ?? 0) || 0
  const percentThreshold = Number(options.percentThreshold ?? 0) || 0
  const resetDay = Math.max(1, Math.min(28, Number(options.resetDay ?? 1)))

  // determine period start/end based on resetDay
  const now = new Date()
  let start
  if (now.getDate() >= resetDay) {
    start = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const nextReset = new Date(start.getFullYear(), start.getMonth() + 1, resetDay)
  const end = new Date(nextReset.getFullYear(), nextReset.getMonth(), nextReset.getDate() - 1)

  const formatDate = d => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // fetch rows for period if none provided
  let rows = Array.isArray(records) && records.length ? records : null
  if (!rows) {
    try {
      rows = await fetchRecordsByDateRange(startDate, endDate)
    } catch (e) {
      console.warn('monthlySpendvsIncomeRule: fetchRecordsByDateRange failed', e)
      rows = []
    }
  } else {
    // filter passed-in rows to period (safe)
    rows = rows.filter(r => {
      const dStr = (r.date || '').slice(0, 10)
      if (dStr) return dStr >= startDate && dStr <= endDate
      if (r.inputdatetime) {
        const d = new Date(r.inputdatetime)
        if (!isNaN(d.getTime())) {
          const ds = formatDate(d)
          return ds >= startDate && ds <= endDate
        }
      }
      return false
    })
  }

  let income = 0
  let spending = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if ((r.type || '').toLowerCase() === 'income') income += amt
    else spending += amt
  }

  const out = []
  let exceeded = false
  const deficit = spending - income

  if (deficit >= amountThreshold && deficit > 0) exceeded = true
  else if (percentThreshold > 0) {
    if (income === 0) {
      exceeded = spending > 0
    } else {
      exceeded = spending > income * (1 + percentThreshold / 100)
    }
  } else {
    // if no thresholds provided, default alert when spending > income
    exceeded = deficit > 0
  }

  if (exceeded) {
    out.push({
      id: `balance-${startDate}_${endDate}`,
      title: `Monthly deficit (${startDate} → ${endDate})`,
      message: `Spending ${spending} exceeds income ${income} by ${deficit}.` +
               (amountThreshold ? ` Threshold: ${amountThreshold}.` : '') +
               (percentThreshold ? ` Percent threshold: ${percentThreshold}%.` : ''),
      severity: 'medium',
      startDate,
      endDate,
      income,
      spending,
      deficit
    })
  }

  return out
}



export async function recurringPaymentRule(records = [], options = {}) {
  // options:
  //  - recurringCount: number of occurrences in period to consider recurring (default 3)
  //  - resetDay: day of month when the period resets (1..28). default 1
  const recurringCount = Math.max(1, Number(options.recurringCount ?? 3) || 3)
  const resetDay = Math.max(1, Math.min(28, Number(options.resetDay ?? 1)))

  // determine period start/end based on resetDay (same logic used elsewhere)
  const now = new Date()
  let start
  if (now.getDate() >= resetDay) {
    start = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const nextReset = new Date(start.getFullYear(), start.getMonth() + 1, resetDay)
  const end = new Date(nextReset.getFullYear(), nextReset.getMonth(), nextReset.getDate() - 1)

  const formatDate = d => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // fetch rows for period if none provided
  let rows = Array.isArray(records) && records.length ? records : null
  if (!rows) {
    try {
      rows = await fetchRecordsByDateRange(startDate, endDate)
    } catch (e) {
      console.warn('recurringPaymentRule: fetchRecordsByDateRange failed', e)
      rows = []
    }
  } else {
    // filter passed-in rows to period
    rows = rows.filter(r => {
      const dStr = (r.date || '').slice(0, 10)
      if (dStr) return dStr >= startDate && dStr <= endDate
      if (r.inputdatetime) {
        const d = new Date(r.inputdatetime)
        if (!isNaN(d.getTime())) {
          const ds = formatDate(d)
          return ds >= startDate && ds <= endDate
        }
      }
      return false
    })
  }

  // count occurrences by recipient identity (use name if available, fallback to rid)
  const counts = {}
  for (const r of rows) {
    const rawName = r.rname || r.name || r.pname || r.recipient || null
    const key = (rawName && String(rawName).trim()) || (`rid:${String(r.rid ?? r.id ?? 'unknown')}`)
    counts[key] = (counts[key] || 0) + 1
  }

  const out = []
  for (const key of Object.keys(counts)) {
    const cnt = counts[key]
    if (cnt >= recurringCount) {
      out.push({
        id: `recurring-${startDate}-${key}-${cnt}`,
        title: `Recurring payments: ${key}`,
        message: `${key} appeared ${cnt} times between ${startDate} and ${endDate} (threshold ${recurringCount}).`,
        severity: 'low',
        recipient: key,
        count: cnt,
        periodStart: startDate,
        periodEnd: endDate
      })
    }
  }

  return out
}


export async function monthlySurplusRule(records = [], options = {}) {
  // options:
  //  - surAmountThreshold: absolute surplus to trigger (default 0)
  //  - surPercentThreshold: percent of income to trigger (e.g. 10 for 10%) (default 0)
  //  - resetDay: day of month when the reporting period resets (1..28). default 1
  const amountThreshold = Number(options.surAmountThreshold ?? 0) || 0
  const percentThreshold = Number(options.surPercentThreshold ?? 0) || 0
  const resetDay = Math.max(1, Math.min(28, Number(options.resetDay ?? 1)))

  // determine period start/end based on resetDay
  const now = new Date()
  let start
  if (now.getDate() >= resetDay) {
    start = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const nextReset = new Date(start.getFullYear(), start.getMonth() + 1, resetDay)
  const end = new Date(nextReset.getFullYear(), nextReset.getMonth(), nextReset.getDate() - 1)

  const formatDate = d => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // fetch rows for period if none provided
  let rows = Array.isArray(records) && records.length ? records : null
  if (!rows) {
    try {
      rows = await fetchRecordsByDateRange(startDate, endDate)
    } catch (e) {
      console.warn('monthlySurplusRule: fetchRecordsByDateRange failed', e)
      rows = []
    }
  } else {
    rows = rows.filter(r => {
      const dStr = (r.date || '').slice(0, 10)
      if (dStr) return dStr >= startDate && dStr <= endDate
      if (r.inputdatetime) {
        const d = new Date(r.inputdatetime)
        if (!isNaN(d.getTime())) {
          const ds = formatDate(d)
          return ds >= startDate && ds <= endDate
        }
      }
      return false
    })
  }

  let income = 0
  let spending = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if ((r.type || '').toLowerCase() === 'income') income += amt
    else spending += amt
  }

  const surplus = income - spending
  let triggered = false

  if (surplus <= 0) triggered = false
  else if (surplus >= amountThreshold && amountThreshold > 0) triggered = true
  else if (percentThreshold > 0 && income > 0 && surplus >= income * (percentThreshold / 100)) triggered = true
  else if (amountThreshold === 0 && percentThreshold === 0) {//default value
    triggered = surplus > 0
  }

  const out = []
  if (triggered) {
    out.push({
      id: `surplus-${startDate}_${endDate}`,
      title: `Monthly surplus (${startDate} → ${endDate})`,
      message: `Income ${income} exceeds spending ${spending} by ${surplus}.` +
               (amountThreshold ? ` Amount threshold: ${amountThreshold}.` : '') +
               (percentThreshold ? ` Percent threshold: ${percentThreshold}%.` : ''),
      severity: 'low',
      startDate,
      endDate,
      income,
      spending,
      surplus
    })
  }

  return out
}



export async function monthlySavingGoalRule(records = [], options = {}) {
  // options:
  //  - goalAmount: absolute saving goal to compare against (required to trigger)
  //  - resetDay: day of month when the reporting period resets (1..28). default 1
  const goalAmount = Number(options.goalAmount ?? 0) || 0
  const resetDay = Math.max(1, Math.min(28, Number(options.resetDay ?? 1)))

  // determine period start/end based on resetDay (same logic used in other rules)
  const now = new Date()
  let start
  if (now.getDate() >= resetDay) {
    start = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const nextReset = new Date(start.getFullYear(), start.getMonth() + 1, resetDay)
  const end = new Date(nextReset.getFullYear(), nextReset.getMonth(), nextReset.getDate() - 1)

  const formatDate = d => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const startDate = formatDate(start)
  const endDate = formatDate(end)

  // fetch rows for period if none provided
  let rows = Array.isArray(records) && records.length ? records : null
  if (!rows) {
    try {
      rows = await fetchRecordsByDateRange(startDate, endDate)
    } catch (e) {
      console.warn('monthlySavingGoalRule: fetchRecordsByDateRange failed', e)
      rows = []
    }
  } else {
    rows = rows.filter(r => {
      const dStr = (r.date || '').slice(0, 10)
      if (dStr) return dStr >= startDate && dStr <= endDate
      if (r.inputdatetime) {
        const d = new Date(r.inputdatetime)
        if (!isNaN(d.getTime())) {
          const ds = formatDate(d)
          return ds >= startDate && ds <= endDate
        }
      }
      return false
    })
  }

  // compute totals
  let income = 0
  let spending = 0
  for (const r of rows) {
    const amt = Number(r.amount) || 0
    if ((r.type || '').toLowerCase() === 'income') income += amt
    else spending += amt
  }

  const surplus = income - spending
  const out = []

  // only trigger if a meaningful goal is provided and surplus > goal
  if (goalAmount > 0 && surplus > goalAmount) {
    out.push({
      id: `savinggoal-${startDate}_${endDate}`,
      title: `Saving goal achieved (${startDate} → ${endDate})`,
      message: `You saved ${surplus} this period, which exceeds your goal of ${goalAmount}.`,
      severity: 'info',
      startDate,
      endDate,
      income,
      spending,
      surplus,
      goalAmount
    })
  }

  return out
}



//major exporting function
export function useAlertRules(defaultOptions = {}) { //I must rmb to explain the options and their default here that require passing
  const [alerts, setAlerts] = useState([])

  // runRules calls each rule and concatenates results
  async function runRules(options = {}) {
    const opts = { ...defaultOptions, ...(options || {}) } // merge defaults + per-run
    const records = await fetchAllRecords().catch(() => [])
    if (!records || records.length === 0) {
      setAlerts([])
      return []
    }

    const results = [
      await oneBigPaymentRule(records, opts), //one big
      await monthlySpendvsIncomeRule(records, opts), //spending limits
      await recurringPaymentRule(records, opts), //recurring payment alerts
      await monthlySurplusRule(records, opts), //extra surplus
      await monthlySavingGoalRule(records, opts), //monthly savings
      frequentPurchasesRule(records, opts)
    ].flat()

    setAlerts(results)
    return results
  }

  function clearAlerts() {
    setAlerts([])
  }

  return { alerts, runRules, clearAlerts }
}