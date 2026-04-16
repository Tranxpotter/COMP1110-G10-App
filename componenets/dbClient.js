import * as SQLite from 'expo-sqlite'
import Papa from 'papaparse'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'

const db = SQLite.openDatabaseAsync('example.db') // singleton

export function executeSqlAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql(
                sql,
                params,
                (_tx, result) => resolve(result),
                (_tx, err) => { console.log('SQL error:', err); reject(err); return false }
            )
        }, (txError) => {
            console.log('Transaction error:', txError)
            reject(txError)
        })
    })
}

export async function initTables() {//obviously run this 
    await executeSqlAsync(`CREATE TABLE IF NOT EXISTS category (cid INTEGER PRIMARY KEY AUTOINCREMENT, cname TEXT, description TEXT)`)
    await executeSqlAsync(`CREATE TABLE IF NOT EXISTS recipient (rid INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, cid INTEGER)`)
    await executeSqlAsync(`CREATE TABLE IF NOT EXISTS record (tid INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL, cid INTEGER, date TEXT, type TEXT, currency TEXT, inputdatetime TEXT, description TEXT, rid INTEGER)`)
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

  // normalize rows into value arrays (match your record columns)
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
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        for (const vals of chunk) {
          tx.executeSql(
            `INSERT INTO record (amount, cid, date, type, currency, inputdatetime, description, rid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            vals,
            () => { inserted += 1 },
            (_tx, err) => { console.warn('insert failed', err); skipped += 1; return true }
          )
        }
      }, (txErr) => reject(txErr), () => resolve())
    })
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
    db,
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