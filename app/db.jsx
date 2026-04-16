import { StatusBar } from 'expo-status-bar';
// ...existing code...
import React, { useState, useEffect } from 'react'
import { StyleSheet, Text, View, TextInput, Button, Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'

const db = SQLite.openDatabaseAsync('example.db')

//A function for executing sql queries (I make this modular as we have multiple tables, u can copy this code or import this function)
function executeSqlAsync(sql, params = null) { //this params is like data binding, i set to null as we won't probably use(who will sql inject their own db haha??)
    return new Promise((resolve, reject) => {
        db.transaction(tx => {
            tx.executeSql(
            sql,
            params,
            (_tx, result) => resolve(result),
            (_tx, err) => { console.log('SQL error:', err); reject(err) }
        )
        }, (txError) => {
            console.log('Transaction error:', txError)
            reject(txError)
        })
    })
}




export default function DB() {
    const [isLoading, setIsLoading] = useState(true)
    const [categories, setCategories] = useState([]) //initialize storage of records in runtime.
    const [recipients, setRecipients] = useState([])
    const [records, setRecords] = useState([])
    const [currentName, setCurrentName] = useState('')

    async function initTables() { //placed creating tables into this function
        await executeSqlAsync(
          `CREATE TABLE IF NOT EXISTS category (
            cid INTEGER PRIMARY KEY AUTOINCREMENT,
            cname TEXT,
            description TEXT
            )`//use ` for us to see the sql clearer, if use ' it cant tab i think
        )
        await executeSqlAsync(
            `CREATE TABLE IF NOT EXISTS recipient (
                rid INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                cid INTEGER
            )`
        )
        await executeSqlAsync(
            `CREATE TABLE IF NOT EXISTS record (
                tid INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL,
                cid INTEGER,
                date TEXT,
                type TEXT,
                currency TEXT,
                inputdatetime TEXT,
                description TEXT,
                rid INTEGER
            )`//btw i didnt make foreign key, idk how we will insert records in the recipient table so I hold this for now.
        )
    }


    //nice structure aye?
    async function fetchAllCategories() {
        const result = await executeSqlAsync('SELECT * FROM category')  //if u want more complex queries, just use string concatenation, it's the db on their own phone bro.
        setCategories(result.rows._array) //array of row obj from sqlite
    }

    async function fetchAllRecipients() {
        const result = await executeSqlAsync('SELECT * FROM recipient')
        setRecipients(result.rows._array)
    }

    async function fetchAllRecords() {
        const result = await executeSqlAsync('SELECT * FROM record')
        setRecords(result.rows._array)
    }



    // init on mount and load all tables (here is where the running code start)

    //place this at the start of ur code to initialize sqlite, and collect all records into the respective initialzed fields.
    useEffect(() => {
        ;(async () => {
        try {
            await initTables()
            await Promise.all([fetchAllCategories(), fetchAllRecipients(), fetchAllRecords()])
        } catch (e) {
            console.log('DB init error', e)
        } finally {
            setIsLoading(false)
        }
        })()
    }, [])

    if (isLoading) {//u can copy this, because rn idk where to put these db codes actually haha
        return (
        <View style={styles.container}>
            <Text>Loading DB…</Text>
        </View>
        )
    }

    // add or update or delete a category record and refresh  //here is for category.
    async function addCategory() {
        if (!currentName.trim()) return //removing empty stuff.
        await executeSqlAsync('INSERT INTO category (cname, description) VALUES (?, ?)', [currentName.trim(), '']) //u find a way to add description.
        setCurrentName('')
        await fetchAllCategories()//refresh
    }

    async function updateCategory(cid, newName, newDescription = '') { //here we could lookup the cid for newName first if need
        if (!cid) throw new Error('cid is required')
        if (!String(newName).trim()) throw new Error('name is required')

        // execute UPDATE and return rowsAffected; refresh local state afterwards
        const result = await executeSqlAsync(
            'UPDATE category SET cname = ?, description = ? WHERE cid = ?',
            [newName.trim(), newDescription, cid]
        )
        await fetchAllCategories()
        return result.rowsAffected // number of rows updated (0 or 1)
    }

    async function deleteCategory(cid) {
        if (!cid) throw new Error('cid is required')
        try {
        // remove dependent rows first prevent causing foreign key dependency error (I forgot the name of the error haha)
        await executeSqlAsync('DELETE FROM record WHERE cid = ?', [cid])
        await executeSqlAsync('DELETE FROM recipient WHERE cid = ?', [cid])
        const result = await executeSqlAsync('DELETE FROM category WHERE cid = ?', [cid])

        // refresh local state
        await Promise.all([fetchAllCategories(), fetchAllRecipients(), fetchAllRecords()])
        return result.rowsAffected // number of rows deleted (0 or 1)
        } catch (e) {
            console.log('deleteCategory error', e)
            throw e
        }
    }



    //for recipient
    async function addRecipient(name, cid = null) {
        if (!String(name || '').trim()) return
        const result = await executeSqlAsync(
            'INSERT INTO recipient (name, cid) VALUES (?, ?)',
            [name.trim(), cid]
        )
        await fetchAllRecipients()
        return result.insertId ?? result.rowsAffected
    }

    async function updateRecipient(rid, newName, newCid = null) {
        if (!rid) throw new Error('rid is required')
        if (!String(newName).trim()) throw new Error('name is required')
        const result = await executeSqlAsync(
            'UPDATE recipient SET name = ?, cid = ? WHERE rid = ?',
            [newName.trim(), newCid, rid]
        )
        await fetchAllRecipients()
        return result.rowsAffected
    }

    async function deleteRecipient(rid) {
        if (!rid) throw new Error('rid is required')
        try {
            // remove dependent records first
            await executeSqlAsync('DELETE FROM record WHERE rid = ?', [rid])
            const result = await executeSqlAsync('DELETE FROM recipient WHERE rid = ?', [rid])
            await Promise.all([fetchAllRecipients(), fetchAllRecords()])
            return result.rowsAffected
        } catch (e) {
            console.log('deleteRecipient error', e)
            throw e
        }
    }


    //for record.
    async function addRecord({
        amount = 0,
        cid = null,
        date = '',
        type = '',
        currency = '',
        inputdatetime = '',
        description = '',
        rid = null
        } = {}) {
        const result = await executeSqlAsync(
            `INSERT INTO record
            (amount, cid, date, type, currency, inputdatetime, description, rid)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [amount, cid, date, type, currency, inputdatetime, description, rid]
        )
        await fetchAllRecords()
        return result.insertId ?? result.rowsAffected
    }

    async function updateRecord(tid, {
        amount,
        cid,
        date,
        type,
        currency,
        inputdatetime,
        description,
        rid
        } = {}) {
        if (!tid) throw new Error('tid is required')
        const result = await executeSqlAsync(
            `UPDATE record SET
            amount = ?, cid = ?, date = ?, type = ?, currency = ?, inputdatetime = ?, description = ?, rid = ?
            WHERE tid = ?`,
            [amount, cid, date, type, currency, inputdatetime, description, rid, tid]
        )
        await fetchAllRecords()
        return result.rowsAffected
    }

    async function deleteRecord(tid) {
        if (!tid) throw new Error('tid is required')
        try {
            const result = await executeSqlAsync('DELETE FROM record WHERE tid = ?', [tid])
            await fetchAllRecords()
            return result.rowsAffected
        } catch (e) {
            console.log('deleteRecord error', e)
            throw e
        }
    }



    return ( //an example of how we could insert or print all records.
        <View style={styles.container}>
            <TextInput
                value={currentName}
                placeholder="category name"
                onChangeText={setCurrentName} //here receive input field
                style={{ width: '80%', borderWidth: 1, padding: 8, marginBottom: 8 }}
            />
            <Button title="Add category" onPress={addCategory} />
        </View>
    )
}

/* the code for printing all records on screen(this will be huge haha) take this as an example of how to use the reocrds(maybe alert rule will use this.)
<Text style={{ marginTop: 16, fontWeight: 'bold' }}>Categories:</Text>
            {categories.map(c => (
                <Text key={c.cid}>{c.cname} (id:{c.cid})</Text>
            ))}
            <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Recipients:</Text>
            {recipients.map(r => (
                <Text key={r.rid}>{r.name} (cid:{r.cid})</Text>
            ))}
            <Text style={{ marginTop: 12, fontWeight: 'bold' }}>Records:</Text>
            {records.map(r => (
                <Text key={r.tid}>{r.tid}: {r.amount} {r.currency}</Text>
            ))}
*/


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
        justifyContent: 'space-between',
        margin: 8
    }//I follow a tutorial online, but this might not be present.
});