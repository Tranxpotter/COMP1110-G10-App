export const APP_BASE_CURRENCY = 'HKD'

export const CURRENCY_OPTIONS = [
  { key: 'HKD', value: 'HKD' },
  { key: 'TWD', value: 'TWD' },
  { key: 'USD', value: 'USD' },
  { key: 'CNY', value: 'CNY' },
  { key: 'EUR', value: 'EUR' },
  { key: 'JPY', value: 'JPY' },
  { key: 'GBP', value: 'GBP' },
  { key: 'AUD', value: 'AUD' },
  { key: 'CAD', value: 'CAD' },
  { key: 'SGD', value: 'SGD' },
]

const FX_PROVIDER = 'frankfurter.app'

function toCurrencyCode(value, fallback = APP_BASE_CURRENCY) {
  const normalized = String(value || '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) return fallback
  return normalized
}

function toIsoDate(value = '') {
  const raw = String(value || '').trim()
  const matched = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (matched) return `${matched[1]}-${matched[2]}-${matched[3]}`

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  const yyyy = parsed.getFullYear()
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export async function getFxRateToBase({
  fromCurrency,
  quoteCurrency = APP_BASE_CURRENCY,
  date = '',
}) {
  const from = toCurrencyCode(fromCurrency)
  const quote = toCurrencyCode(quoteCurrency)

  if (from === quote) {
    return {
      rate: 1,
      dateUsed: toIsoDate(date) || toIsoDate(new Date()),
      provider: FX_PROVIDER,
      from,
      quote,
    }
  }

  const isoDate = toIsoDate(date)
  const url = isoDate
    ? `https://api.frankfurter.app/${isoDate}?from=${from}&to=${quote}`
    : `https://api.frankfurter.app/latest?from=${from}&to=${quote}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`FX request failed (${res.status})`)
  }

  const payload = await res.json()
  const rate = toNumber(payload?.rates?.[quote], NaN)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('FX provider returned an invalid rate')
  }

  return {
    rate,
    dateUsed: toIsoDate(payload?.date) || isoDate || toIsoDate(new Date()),
    provider: FX_PROVIDER,
    from,
    quote,
  }
}

export async function convertToBaseAmount({
  amount,
  fromCurrency,
  quoteCurrency = APP_BASE_CURRENCY,
  date = '',
}) {
  const numericAmount = toNumber(amount, NaN)
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Amount must be a valid non-negative number')
  }

  const from = toCurrencyCode(fromCurrency)
  const quote = toCurrencyCode(quoteCurrency)

  if (from === quote) {
    const normalizedDate = toIsoDate(date) || toIsoDate(new Date())
    return {
      amountBase: numericAmount,
      fxRateToBase: 1,
      fxBaseCurrency: from,
      fxQuoteCurrency: quote,
      fxRateDate: normalizedDate,
      fxProvider: FX_PROVIDER,
    }
  }

  const fx = await getFxRateToBase({ fromCurrency: from, quoteCurrency: quote, date })
  const amountBase = numericAmount * fx.rate

  return {
    amountBase,
    fxRateToBase: fx.rate,
    fxBaseCurrency: fx.from,
    fxQuoteCurrency: fx.quote,
    fxRateDate: fx.dateUsed,
    fxProvider: fx.provider,
  }
}
