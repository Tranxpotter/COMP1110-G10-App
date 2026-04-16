import * as SQLite from 'expo-sqlite'
import Papa from 'papaparse'
import * as FileSystem from 'expo-file-system'
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
    if (typeof SQLite.openDatabase === 'function') {
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
// ...existing code...

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
      date TEXT,
      type TEXT,
      currency TEXT,
      inputdatetime TEXT,
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




export async function importRecordsFromRows(rows = [], chunkSize = 200) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 }
  let inserted = 0, skipped = 0
  const db = await getDb()

  // normalize rows first (keep names/cid/rid logic elsewhere if needed)
  const normalized = rows.map(r => ([
    Number(r.amount) || 0,
    r.cid ? Number(r.cid) : null,
    r.date ?? '',
    r.type ?? '',
    r.currency ?? '',
    r.inputdatetime ?? '',
    r.description ?? '',
    r.rid ? Number(r.rid) : null
  ]))

  for (let i = 0; i < normalized.length; i += chunkSize) {
    const chunk = normalized.slice(i, i + chunkSize)
    for (const vals of chunk) {
      try {
        const res = await db.runAsync(
          `INSERT INTO record (amount, cid, date, type, currency, inputdatetime, description, rid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          vals
        )
        if (res?.lastInsertRowId) inserted += 1
        else if (res?.changes) inserted += res.changes
      } catch (err) {
        console.warn('insert failed', err)
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
    await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 })
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