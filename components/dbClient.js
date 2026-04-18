import * as SQLite from 'expo-sqlite'
import Papa from 'papaparse'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'

// lazy/open async DB (uses new expo-sqlite async API)
let _db = null
let _dbPromise = null
async function getDb() {
  if (_db) return _db
  if (_dbPromise) return _dbPromise
  if (typeof SQLite.openDatabaseAsync !== 'function') {
    // fallback to sync APIs if present
    if (typeof SQLite.openDatabaseSync === 'function') {
      try {
        _db = SQLite.openDatabaseSync('example.db')
        return _db
      } catch (e) {
        _db = null
        throw e
      }
    }
    if (typeof SQLite.openDatabase === 'function') { //I think this is not used/
      _db = SQLite.openDatabase('example.db')
      return _db
    }
    throw new Error('No supported openDatabase API found on expo-sqlite')
  }
  _dbPromise = SQLite.openDatabaseAsync('example.db').then(db => {
    _db = db
    return _db
  })
  return _dbPromise
}

// wrapper: executes SQL using new API methods and returns compatible shape
export async function executeSqlAsync(sql, params = []) {
  const db = await getDb()
  const sqlTrim = String(sql || '').trim().toUpperCase()
  // SELECT -> use getAllAsync (returns array of rows)
  if (sqlTrim.startsWith('SELECT')) {
    // getAllAsync accepts params optional
    const rows = await db.getAllAsync(sql, params)
    return { rows: { _array: Array.isArray(rows) ? rows : [] } }
  }
  // For other statements use runAsync (returns { lastInsertRowId, changes })
  const res = await db.runAsync(sql, params)
  return { insertId: res?.lastInsertRowId ?? null, rowsAffected: res?.changes ?? 0, raw: res }
}
// alias
export const executeSql = executeSqlAsync


export async function dropAllTables() {  //this function is scary and should never be used!!!
  // drop in dependency order (ONLY USE IN TESTING)
  await executeSqlAsync('DROP TABLE IF EXISTS record')
  await executeSqlAsync('DROP TABLE IF EXISTS recipient')
  await executeSqlAsync('DROP TABLE IF EXISTS category')
  return true
}

export async function initTables() {
  // enable foreign keys on this connection
  try {
    await executeSqlAsync('PRAGMA foreign_keys = ON')
  } catch (e) {
    console.warn('Could not enable foreign_keys pragma', e)
  }

  // Create the canonical tables with foreign keys. Uses ON DELETE SET NULL to avoid accidental cascade deletes;
  // change to ON DELETE CASCADE if you want deleting a category/recipient to remove dependent records.
  await executeSqlAsync(`
    CREATE TABLE IF NOT EXISTS category (
      cid INTEGER PRIMARY KEY AUTOINCREMENT,
      cname TEXT,
      description TEXT
    )
  `)

  await executeSqlAsync(`
    CREATE TABLE IF NOT EXISTS recipient (
      rid INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      cid INTEGER,
      FOREIGN KEY (cid) REFERENCES category(cid) ON DELETE SET NULL
    )
  `)

  await executeSqlAsync(`
    CREATE TABLE IF NOT EXISTS record (
      tid INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL,
      cid INTEGER,
      date DATE,
      type TEXT,
      currency TEXT,
      inputdatetime DATETIME,
      description TEXT,
      rid INTEGER,
      FOREIGN KEY (cid) REFERENCES category(cid) ON DELETE SET NULL,
      FOREIGN KEY (rid) REFERENCES recipient(rid) ON DELETE SET NULL
    )
  `)
}



/* Fetch helpers */
export async function fetchAllCategories() {
    const res = await executeSqlAsync('SELECT * FROM category')
    return res.rows._array
}
export async function fetchAllRecipients() {
    const res = await executeSqlAsync('SELECT * FROM recipient')
    return res.rows._array
}
export async function fetchAllRecords() {
    const res = await executeSqlAsync('SELECT * FROM record')
    return res.rows._array
}


const RECORD_SORT_KEYS = ['date', 'amount', 'category', 'recipient']
const RECORD_SORT_KEY_SET = new Set(RECORD_SORT_KEYS)

function toSafeNonNegativeInteger(value, fallback = null) {
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.trunc(parsed))
}

/**
 * Builder-style config for record filtering.
 */
export class RecordFilterConfig {
  constructor(source = {}) {
    const safeSource = source && typeof source === 'object' ? source : {}

    this.date = {
      mode: 'all',
      before: '',
      after: '',
      betweenStart: '',
      betweenEnd: '',
      ...(safeSource.date || {}),
    }

    this.amount = {
      type: 'all',
      rangeMode: 'all',
      min: '',
      max: '',
      ...(safeSource.amount || {}),
    }

    this.category = {
      includeIds: [],
      excludeIds: [],
      ...(safeSource.category || {}),
    }

    this.recipient = {
      includeIds: [],
      excludeIds: [],
      ...(safeSource.recipient || {}),
    }

    this.limit = toSafeNonNegativeInteger(safeSource.limit, null)
    this.offset = toSafeNonNegativeInteger(safeSource.offset, 0)
  }

  static from(source = {}) {
    return new RecordFilterConfig(source)
  }

  withDate(partial = {}) {
    this.date = { ...this.date, ...(partial || {}) }
    return this
  }

  withAmount(partial = {}) {
    this.amount = { ...this.amount, ...(partial || {}) }
    return this
  }

  withCategory(partial = {}) {
    this.category = { ...this.category, ...(partial || {}) }
    return this
  }

  withRecipient(partial = {}) {
    this.recipient = { ...this.recipient, ...(partial || {}) }
    return this
  }

  withLimit(limit = null) {
    this.limit = toSafeNonNegativeInteger(limit, null)
    return this
  }

  withOffset(offset = 0) {
    this.offset = toSafeNonNegativeInteger(offset, 0)
    return this
  }

  withPagination(limit = null, offset = 0) {
    this.withLimit(limit)
    this.withOffset(offset)
    return this
  }

  build() {
    return {
      date: { ...this.date },
      amount: { ...this.amount },
      category: {
        ...this.category,
        includeIds: Array.isArray(this.category.includeIds) ? [...this.category.includeIds] : [],
        excludeIds: Array.isArray(this.category.excludeIds) ? [...this.category.excludeIds] : [],
      },
      recipient: {
        ...this.recipient,
        includeIds: Array.isArray(this.recipient.includeIds) ? [...this.recipient.includeIds] : [],
        excludeIds: Array.isArray(this.recipient.excludeIds) ? [...this.recipient.excludeIds] : [],
      },
      limit: this.limit,
      offset: this.offset,
    }
  }
}

/**
 * Builder-style config for record sorting.
 *
 * Each item has shape: { key, direction }
 */
export class RecordSortConfig {
  constructor(source = []) {
    this.items = []
    this.addMany(source)
  }

  static from(source = []) {
    return new RecordSortConfig(source)
  }

  static byDate(direction = 'desc') {
    return new RecordSortConfig().add('date', direction)
  }

  add(key, direction = 'desc') {
    const normalizedKey = String(key || '').toLowerCase()
    if (!RECORD_SORT_KEY_SET.has(normalizedKey)) return this

    const normalizedDirection = String(direction || '').toLowerCase() === 'asc' ? 'asc' : 'desc'
    this.items.push({ key: normalizedKey, direction: normalizedDirection })
    return this
  }

  addMany(source = []) {
    if (!Array.isArray(source)) return this
    for (const item of source) {
      this.add(item?.key, item?.direction)
    }
    return this
  }

  clear() {
    this.items = []
    return this
  }

  build() {
    return this.items.map((item) => ({ ...item }))
  }
}

function buildRecordWhereClauses(filterConfig = {}) {
  const normalizedFilterConfig = RecordFilterConfig.from(filterConfig).build()
  const dateFilter = normalizedFilterConfig.date || {}
  const amountFilter = normalizedFilterConfig.amount || {}
  const categoryFilter = normalizedFilterConfig.category || {}
  const recipientFilter = normalizedFilterConfig.recipient || {}

  const whereClauses = []
  const params = []

  if (dateFilter.mode === 'before' && dateFilter.before) {
    whereClauses.push('r.date < ?')
    params.push(dateFilter.before)
  } else if (dateFilter.mode === 'after' && dateFilter.after) {
    whereClauses.push('r.date > ?')
    params.push(dateFilter.after)
  } else if (dateFilter.mode === 'between' && dateFilter.betweenStart && dateFilter.betweenEnd) {
    const start = dateFilter.betweenStart <= dateFilter.betweenEnd ? dateFilter.betweenStart : dateFilter.betweenEnd
    const end = dateFilter.betweenStart <= dateFilter.betweenEnd ? dateFilter.betweenEnd : dateFilter.betweenStart
    whereClauses.push('r.date BETWEEN ? AND ?')
    params.push(start, end)
  }

  if (amountFilter.type === 'spending' || amountFilter.type === 'income') {
    whereClauses.push('r.type = ?')
    params.push(amountFilter.type)
  }

  if (amountFilter.rangeMode === 'above' && amountFilter.min !== '') {
    whereClauses.push('r.amount > ?')
    params.push(Number(amountFilter.min))
  } else if (amountFilter.rangeMode === 'below' && amountFilter.max !== '') {
    whereClauses.push('r.amount < ?')
    params.push(Number(amountFilter.max))
  } else if (amountFilter.rangeMode === 'between' && amountFilter.min !== '' && amountFilter.max !== '') {
    const min = Number(amountFilter.min)
    const max = Number(amountFilter.max)
    whereClauses.push('r.amount BETWEEN ? AND ?')
    params.push(Math.min(min, max), Math.max(min, max))
  }

  const categoryIncludeIds = Array.isArray(categoryFilter.includeIds)
    ? categoryFilter.includeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []
  const categoryExcludeIds = Array.isArray(categoryFilter.excludeIds)
    ? categoryFilter.excludeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []

  if (categoryIncludeIds.length > 0) {
    whereClauses.push(`c.cid IN (${categoryIncludeIds.map(() => '?').join(', ')})`)
    params.push(...categoryIncludeIds)
  }
  if (categoryExcludeIds.length > 0) {
    whereClauses.push(`c.cid NOT IN (${categoryExcludeIds.map(() => '?').join(', ')})`)
    params.push(...categoryExcludeIds)
  }

  const recipientIncludeIds = Array.isArray(recipientFilter.includeIds)
    ? recipientFilter.includeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []
  const recipientExcludeIds = Array.isArray(recipientFilter.excludeIds)
    ? recipientFilter.excludeIds.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : []

  if (recipientIncludeIds.length > 0) {
    whereClauses.push(`re.rid IN (${recipientIncludeIds.map(() => '?').join(', ')})`)
    params.push(...recipientIncludeIds)
  }
  if (recipientExcludeIds.length > 0) {
    whereClauses.push(`re.rid NOT IN (${recipientExcludeIds.map(() => '?').join(', ')})`)
    params.push(...recipientExcludeIds)
  }

  return {
    whereClauses,
    params,
    limit: normalizedFilterConfig.limit,
    offset: normalizedFilterConfig.offset,
  }
}






/**
 * Fetches records with optional filtering, multi-column sorting, and pagination.
 *
 * @param {object} [filterConfig={}] Filtering and pagination options.
 * @param {object} [filterConfig.date] Date filter.
 * @param {'all'|'before'|'after'|'between'} [filterConfig.date.mode='all'] Date matching mode.
 * @param {string} [filterConfig.date.before] Upper date bound for `before` mode.
 * @param {string} [filterConfig.date.after] Lower date bound for `after` mode.
 * @param {string} [filterConfig.date.betweenStart] First date for `between` mode.
 * @param {string} [filterConfig.date.betweenEnd] Second date for `between` mode.
 * @param {object} [filterConfig.amount] Amount filter.
 * @param {'all'|'spending'|'income'} [filterConfig.amount.type='all'] Transaction type filter.
 * @param {'all'|'above'|'below'|'between'} [filterConfig.amount.rangeMode='all'] Numeric range mode.
 * @param {number|string} [filterConfig.amount.min] Min amount for `above`/`between` modes.
 * @param {number|string} [filterConfig.amount.max] Max amount for `below`/`between` modes.
 * @param {object} [filterConfig.category] Category include/exclude IDs.
 * @param {Array<number|string>} [filterConfig.category.includeIds] Allowed category IDs.
 * @param {Array<number|string>} [filterConfig.category.excludeIds] Blocked category IDs.
 * @param {object} [filterConfig.recipient] Recipient include/exclude IDs.
 * @param {Array<number|string>} [filterConfig.recipient.includeIds] Allowed recipient IDs.
 * @param {Array<number|string>} [filterConfig.recipient.excludeIds] Blocked recipient IDs.
 * @param {number|string|null} [filterConfig.limit=null] Maximum rows returned.
 * @param {number|string} [filterConfig.offset=0] Rows skipped before returning results.
 * @param {Array<{key: 'date'|'amount'|'category'|'recipient', direction?: 'asc'|'desc'}>} [sortConfig=[]]
 * Sorting config, ordered by priority (first item has highest priority).
 *
 * @returns {Promise<Array<object>>} Matching records.
 */
export async function fetchRecordsWithFilters(filterConfig = {}, sortConfig = []) {
  const effectiveSortConfig = (Array.isArray(sortConfig) && sortConfig.length > 0)
    ? sortConfig
    : (Array.isArray(filterConfig?.sort) ? filterConfig.sort : [])
  const normalizedSortConfig = RecordSortConfig.from(effectiveSortConfig).build()
  const { whereClauses, params, limit, offset } = buildRecordWhereClauses(filterConfig)

  let sql = `
    SELECT r.*
    FROM record r
    LEFT JOIN category c ON c.cid = r.cid
    LEFT JOIN recipient re ON re.rid = r.rid
  `

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`
  }

  const orderClauses = []
  for (const item of normalizedSortConfig) {
    const direction = String(item?.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    if (item.key === 'date') {
      orderClauses.push(`r.date ${direction}`)
    } else if (item.key === 'amount') {
      orderClauses.push(`r.amount ${direction}`)
    } else if (item.key === 'category') {
      orderClauses.push(`LOWER(COALESCE(c.cname, '')) ${direction}`)
    } else if (item.key === 'recipient') {
      orderClauses.push(`LOWER(COALESCE(re.name, '')) ${direction}`)
    }
  }

  if (orderClauses.length === 0) {
    orderClauses.push('r.date DESC')
  }
  orderClauses.push('r.tid DESC')

  sql += ` ORDER BY ${orderClauses.join(', ')}`

  if (limit !== null) {
    sql += ' LIMIT ?'
    params.push(limit)
  }

  if (offset > 0) {
    if (limit === null) {
      sql += ' LIMIT -1'
    }
    sql += ' OFFSET ?'
    params.push(offset)
  }

  const res = await executeSqlAsync(sql, params)
  return res.rows._array
}

export async function fetchRecordCountWithFilters(filterConfig = {}) {
  const { whereClauses, params } = buildRecordWhereClauses(filterConfig)

  let sql = `
    SELECT COUNT(*) AS total
    FROM record r
    LEFT JOIN category c ON c.cid = r.cid
    LEFT JOIN recipient re ON re.rid = r.rid
  `

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`
  }

  const res = await executeSqlAsync(sql, params)
  const total = res?.rows?._array?.[0]?.total
  return Number(total) || 0
}




/* Category CRUD */
export async function addCategory(name, description = '') {
    if (!String(name || '').trim()) return null
    const res = await executeSqlAsync('INSERT INTO category (cname, description) VALUES (?, ?)', [name.trim(), description])
    return res.insertId ?? res.rowsAffected
}
export async function updateCategory(cid, name, description = '') {
    if (!cid) throw new Error('cid required')
    await executeSqlAsync('UPDATE category SET cname = ?, description = ? WHERE cid = ?', [String(name).trim(), description, cid])
    return true
}
export async function deleteCategory(cid) {
    if (!cid) throw new Error('cid required')
    await executeSqlAsync('DELETE FROM record WHERE cid = ?', [cid])
    await executeSqlAsync('DELETE FROM recipient WHERE cid = ?', [cid])
    const res = await executeSqlAsync('DELETE FROM category WHERE cid = ?', [cid])
    return res.rowsAffected
}





/* Recipient CRUD (similar) */
export async function addRecipient(name, cid = null) {
    if (!String(name || '').trim()) return null
    const res = await executeSqlAsync('INSERT INTO recipient (name, cid) VALUES (?, ?)', [name.trim(), cid])
    return res.insertId ?? res.rowsAffected
}
export async function updateRecipient(rid, name, cid = null) {
    if (!rid) throw new Error('rid required')
    await executeSqlAsync('UPDATE recipient SET name = ?, cid = ? WHERE rid = ?', [name.trim(), cid, rid])
    return true
}
export async function deleteRecipient(rid) {
    if (!rid) throw new Error('rid required')
    await executeSqlAsync('DELETE FROM record WHERE rid = ?', [rid])
    const res = await executeSqlAsync('DELETE FROM recipient WHERE rid = ?', [rid])
    return res.rowsAffected
}


async function ensureCategoryExists(cid) {
  if (cid == null) return null
  // check exists
  try {
    const check = await executeSqlAsync('SELECT cid FROM category WHERE cid = ? LIMIT 1', [cid])
    if (check.rows && check.rows._array && check.rows._array.length) return cid
  } catch (e) {
    console.warn('ensureCategoryExists check failed', e)
  }

  // try insert with explicit cid (if allowed)
  try {
    const res = await executeSqlAsync('INSERT INTO category (cid, cname, description) VALUES (?, ?, ?)', [cid, '', ''])
    // if explicit insert succeeded, return given cid
    return cid
  } catch (e) {
    // fallback: insert without cid (let SQLite pick id)
    try {
      const res2 = await executeSqlAsync('INSERT INTO category (cname, description) VALUES (?, ?)', ['', ''])
      return res2.insertId ?? (res2.rows && res2.rows._array && res2.rows._array[0]?.cid) ?? null
    } catch (e2) {
      console.error('ensureCategoryExists insert fallback failed', e2)
      throw e2
    }
  }
}


// helper: ensure recipient with given rid exists; if cid provided ensure category first
async function ensureRecipientExists(rid, cid = null) {
  if (rid == null) return null
  // check exists
  try {
    const check = await executeSqlAsync('SELECT rid FROM recipient WHERE rid = ? LIMIT 1', [rid])
    if (check.rows && check.rows._array && check.rows._array.length) return rid
  } catch (e) {
    console.warn('ensureRecipientExists check failed', e)
  }

  // ensure referenced category exists (if cid provided)
  let useCid = null
  if (cid != null) {
    useCid = await ensureCategoryExists(cid)
  }

  // try insert with explicit rid
  try {
    await executeSqlAsync('INSERT INTO recipient (rid, name, cid) VALUES (?, ?, ?)', [rid, '', useCid])
    return rid
  } catch (e) {
    // fallback: insert without rid
    try {
      const res2 = await executeSqlAsync('INSERT INTO recipient (name, cid) VALUES (?, ?)', ['', useCid])
      return res2.insertId ?? null
    } catch (e2) {
      console.error('ensureRecipientExists insert fallback failed', e2)
      throw e2
    }
  }
}


// resolve category by id or name; returns cid (creates if missing)
async function resolveCategory(value) {
  if (value == null) return null
  // numeric id (number or numeric string)
  const asNum = Number(value)
  if (Number.isFinite(asNum) && String(value).trim() !== '') {
    return await ensureCategoryExists(asNum)
  }
  // treat as name
  const name = String(value).trim()
  if (!name) return null
  try {
    const found = await executeSqlAsync('SELECT cid FROM category WHERE cname = ? LIMIT 1', [name])
    if (found.rows && found.rows._array && found.rows._array.length) return found.rows._array[0].cid
    const ins = await executeSqlAsync('INSERT INTO category (cname, description) VALUES (?, ?)', [name, ''])
    return ins.insertId ?? ins.rowsAffected
  } catch (e) {
    console.warn('resolveCategory failed', e)
    throw e
  }
}

// resolve recipient by id or name; cidContext optionally links new recipient to a category
async function resolveRecipient(value, cidContext = null) {
  if (value == null) return null
  const asNum = Number(value)
  if (Number.isFinite(asNum) && String(value).trim() !== '') {
    return await ensureRecipientExists(asNum, cidContext)
  }
  const name = String(value).trim()
  if (!name) return null
  try {
    const found = await executeSqlAsync('SELECT rid FROM recipient WHERE name = ? LIMIT 1', [name])
    if (found.rows && found.rows._array && found.rows._array.length) return found.rows._array[0].rid
    const ins = await executeSqlAsync('INSERT INTO recipient (name, cid) VALUES (?, ?)', [name, cidContext])
    return ins.insertId ?? ins.rowsAffected
  } catch (e) {
    console.warn('resolveRecipient failed', e)
    throw e
  }
}

/* Record CRUD - improved to accept cid/cname and rid/rname, auto-create refs */
export async function addRecord(obj) {
    const {
      amount = 0,
      cid = null,
      cname = null,        // optional category name
      date = '',
      type = '',
      currency = '',
      inputdatetime = '',
      description = '',
      rid = null,
      rname = null         // optional recipient name
    } = obj || {}

    // resolve category first (cid or cname)
    let resolvedCid = null
    try {
      resolvedCid = await resolveCategory(cid ?? cname)
    } catch (e) {
      console.warn('addRecord: resolveCategory failed', e)
    }

    // resolve recipient (use resolvedCid as context if creating by name)
    let resolvedRid = null
    try {
      resolvedRid = await resolveRecipient(rid ?? rname, resolvedCid)
    } catch (e) {
      console.warn('addRecord: resolveRecipient failed', e)
    }

    const res = await executeSqlAsync(
        `INSERT INTO record (amount, cid, date, type, currency, inputdatetime, description, rid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [Number(amount) || 0, resolvedCid, date, type, currency, inputdatetime, description, resolvedRid]
    )
    return res.insertId ?? res.rowsAffected
}


export async function updateRecord(tid, obj) {//this one need id need to consider how we actually let user update record.
    if (!tid) throw new Error('tid required')
    const {
      amount,
      cid,
      cname,
      date,
      type,
      currency,
      inputdatetime,
      description,
      rid,
      rname
    } = obj || {}

    // fetch existing row if some fields are undefined so we keep them
    let existing = null
    const needFetch = [amount, cid, date, type, currency, inputdatetime, description, rid].some(v => v === undefined)
    if (needFetch) {
      const cur = await executeSqlAsync('SELECT * FROM record WHERE tid = ? LIMIT 1', [tid])
      if (!cur || !cur.rows || !cur.rows._array || !cur.rows._array.length) {
        throw new Error('record not found')
      }
      existing = cur.rows._array[0]
    }

    //type casting
    const finalAmount = (amount === undefined) ? existing.amount : amount
    const finalDate = (date === undefined) ? existing.date : date
    const finalType = (type === undefined) ? existing.type : type
    const finalCurrency = (currency === undefined) ? existing.currency : currency
    const finalInputdatetime = (inputdatetime === undefined) ? existing.inputdatetime : inputdatetime
    const finalDescription = (description === undefined) ? existing.description : description

    // resolve category (prefer explicit cid, then cname, then existing cid)
    const categoryInput = (cid !== undefined) ? cid : (cname !== undefined ? cname : (existing ? existing.cid : null))
    let resolvedCid = null
    try {
      resolvedCid = await resolveCategory(categoryInput)
    } catch (e) {
      console.warn('updateRecord: resolveCategory failed', e)
      resolvedCid = (existing ? existing.cid : null)
    }

    // resolve recipient (prefer explicit rid, then rname, then existing rid)
    const recipientInput = (rid !== undefined) ? rid : (rname !== undefined ? rname : (existing ? existing.rid : null))
    let resolvedRid = null
    try {
      resolvedRid = await resolveRecipient(recipientInput, resolvedCid)
    } catch (e) {
      console.warn('updateRecord: resolveRecipient failed', e)
      resolvedRid = (existing ? existing.rid : null)
    }

    await executeSqlAsync(
        `UPDATE record SET amount = ?, cid = ?, date = ?, type = ?, currency = ?, inputdatetime = ?, description = ?, rid = ? WHERE tid = ?`,
        [finalAmount, resolvedCid, finalDate, finalType, finalCurrency, finalInputdatetime, finalDescription, resolvedRid, tid]
    )
    return true
}



export async function deleteRecord(tid) {
    if (!tid) throw new Error('tid required')
    const res = await executeSqlAsync('DELETE FROM record WHERE tid = ?', [tid])
    return res.rowsAffected
}




function normalizeCsvRow(row = {}) {
  const normalized = Object.keys(row).reduce((acc, rawKey) => {
    if (typeof rawKey !== 'string') return acc
    acc[rawKey.trim().toLowerCase()] = row[rawKey]
    return acc
  }, {})

  const get = (...keys) => {
    for (const key of keys) {
      if (normalized[key] !== undefined && normalized[key] !== null) return normalized[key]
    }
    return undefined
  }

  const normalizeAmount = (value) => {
    if (value === undefined || value === null) return 0
    const parsed = Number(String(value).replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : 0
  }

  const normalizeType = (value) => {
    const raw = String(value || '').trim().toLowerCase()
    if (raw === 'income') return 'income'
    if (raw === 'spending' || raw === 'expense' || raw === 'expenses' || raw === 'spend') return 'spending'
    return raw
  }

  const normalizeDate = (value) => {
    if (value === undefined || value === null) return ''
    const raw = String(value).trim()
    if (!raw) return ''

    const ymd = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/)
    if (ymd) {
      const yyyy = ymd[1]
      const mm = String(Number(ymd[2])).padStart(2, '0')
      const dd = String(Number(ymd[3])).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    const dmy = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/)
    if (dmy) {
      const dd = String(Number(dmy[1])).padStart(2, '0')
      const mm = String(Number(dmy[2])).padStart(2, '0')
      const yyyy = dmy[3]
      return `${yyyy}-${mm}-${dd}`
    }

    const parsed = new Date(raw)
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear()
      const mm = String(parsed.getMonth() + 1).padStart(2, '0')
      const dd = String(parsed.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    return ''
  }

  return {
    amount: normalizeAmount(get('amount', 'amt', 'value', 'transaction amount', 'transaction_amount')),
    cid: get('cid', 'categoryid', 'category_id'),
    cname: get('cname', 'category', 'category_name', 'categoryname'),
    date: normalizeDate(get('date', 'transactiondate', 'transaction_date', 'date_time', 'datetime')),
    type: normalizeType(get('type', 'transactiontype', 'transaction_type')),
    currency: get('currency', 'curr', 'currency_code') ?? '',
    inputdatetime: get('inputdatetime', 'input_datetime', 'timestamp', 'created_at') ?? '',
    description: get('description', 'desc', 'note', 'notes') ?? '',
    rid: get('rid', 'recipientid', 'recipient_id'),
    rname: get('rname', 'recipient', 'recipient_name', 'recipientname')
  }
}


export async function importRecordsFromRows(rows = [], chunkSize = 200) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 }
  let inserted = 0, skipped = 0

  const normalized = rows
    .map(normalizeCsvRow)
    .filter(row => Object.values(row).some(value => value !== undefined && value !== null && String(value).trim() !== ''))

  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize)
    for (const row of chunk) {
      try {
        const res = await addRecord(row)
        if (res) inserted += 1
      } catch (err) {
        console.warn('importRecordsFromRows insert failed', err)
        skipped += 1
      }
    }
  }

  return { inserted, skipped }
}



/* Export helper using Papa + expo-file-system + expo-sharing */
export async function exportRecordsToCsv() {
    const res = await executeSqlAsync('SELECT * FROM record')
    const rows = (res.rows && res.rows._array) ? res.rows._array : []
    const csv = Papa.unparse(rows)
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')
    const filename = `records-${ts}.csv`
    const path = `${FileSystem.cacheDirectory}${filename}`
    const enc = FileSystem?.EncodingType?.UTF8 || 'utf8'
    await FileSystem.writeAsStringAsync(path, csv, { encoding: enc })
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' })
    return path
}

export default {
    _db,
    executeSqlAsync,
    initTables,
    fetchAllCategories,
    fetchAllRecipients,
    fetchAllRecords,
    addCategory,
    updateCategory,
    deleteCategory,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    addRecord,
    updateRecord,
    deleteRecord,
    exportRecordsToCsv,
    importRecordsFromRows
}