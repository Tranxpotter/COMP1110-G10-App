import React, { useState , useEffect} from 'react'
import { View, Text, TextInput, Button, Alert, ScrollView, StyleSheet } from 'react-native'
import { addCategory, addRecipient, addRecord, initTables, fetchAllCategories, fetchAllRecipients, fetchAllRecords, dropAllTables } from '../components/dbClient'
import CsvUploader from '../components/CsvUploader'

export default function InputForms() {

  const [categories, setCategories] = useState([])
  const [recipients, setRecipients] = useState([])
  const [records, setRecords] = useState([])

  async function loadAll() {
    try {
      const [cats, recips, recs] = await Promise.all([
        fetchAllCategories().catch(() => []),
        fetchAllRecipients().catch(() => []),
        fetchAllRecords().catch(() => [])
      ])
      setCategories(cats || [])
      setRecipients(recips || [])
      setRecords(recs || [])

        // DEBUG: log summary and every record (helps trace blank page / large payload issues)
        /*
      const count = (recs || []).length
      console.log(`loadAll: fetched ${count} records`)
      if (count) {
        recs.forEach((r, i) => console.log(`record[${i}]`, r))
      }
*/
    } catch (e) {
      console.log('loadAll error', e)
    }
  }

  async function onDropAllConfirm() {
    Alert.alert('Danger — Reset DB', 'This will DROP ALL TABLES and recreate them. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        style: 'destructive',
        onPress: async () => {
          try {
            await dropAllTables()
            await initTables()
            await loadAll()
            Alert.alert('DB reset', 'All tables dropped and recreated.')
          } catch (e) {
            console.error('reset failed', e)
            Alert.alert('Reset failed', String(e))
          }
        }
      }
    ])
  }

  useEffect(() => {
    ;(async () => {
      try {
        await initTables()
      } catch (e) {
        console.error('initTables failed', e)
        Alert.alert('Database error', 'Failed to initialize database tables.')
      }
    })()
  }, [])

  // category
  const [catName, setCatName] = useState('')

  // recipient
  const [recName, setRecName] = useState('')
  const [recCid, setRecCid] = useState('') // string input -> convert to number

  // record
  const [amount, setAmount] = useState('')
  const [cnameForRecord, setCnameForRecord] = useState('')
  const [rnameForRecord, setRnameForRecord] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState('')
  const [currency, setCurrency] = useState('')
  const [description, setDescription] = useState('')



  async function onAddCategory() {//we need these function for button haha, safeguard is also here.
    try {
      if (!catName.trim()) return Alert.alert('Validation', 'Enter category name')
      const res = await addCategory(catName.trim(), '')
      setCatName('')
      await loadAll()
      Alert.alert('Category added', String(res))
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  async function onAddRecipient() {
    try {
      if (!recName.trim()) return Alert.alert('Validation', 'Enter recipient name')
      const cid = recCid ? Number(recCid) : null
      const res = await addRecipient(recName.trim(), cid)
      setRecName(''); setRecCid('')
      await loadAll()
      Alert.alert('Recipient added', String(res))
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  async function onAddRecord() {
    try {
      const amt = amount ? Number(amount) : 0

      // format date -> "YYYY-MM-DD" (leave empty string if none)
      const formattedDate = (() => {
        const raw = (date || '').trim()
        if (!raw) return ''
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          // if parsing fails, try to accept raw if it looks like YYYY-MM-DD; otherwise empty
          return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
        }
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      })()

      // format inputdatetime -> "YYYY-MM-DD HH:MM:SS"
      const inputdatetime = (() => {
        const now = new Date()
        const yyyy = now.getFullYear()
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const hh = String(now.getHours()).padStart(2, '0')
        const min = String(now.getMinutes()).padStart(2, '0')
        const ss = String(now.getSeconds()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
      })()

      const obj = {
        amount: amt,
        cname: cnameForRecord || null,
        date: formattedDate,
        type: type || '',
        currency: currency || '',
        inputdatetime,
        description: description || '',
        rname: rnameForRecord || null
      }
      const res = await addRecord(obj)
      // clear
      setAmount(''); setCnameForRecord(''); setDate(''); setType(''); setCurrency(''); setDescription(''); setRnameForRecord('')
      await loadAll()
      Alert.alert('Record added', String(res))
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Add Category</Text>
        <TextInput value={catName} onChangeText={setCatName} placeholder="Category name" style={styles.input} />
        <Button title="Add Category" onPress={onAddCategory} />
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Add Recipient</Text>
        <TextInput value={recName} onChangeText={setRecName} placeholder="Recipient name" style={styles.input} />
        <TextInput value={recCid} onChangeText={setRecCid} placeholder="Category id (optional)" style={styles.input} keyboardType="numeric" />
        <Button title="Add Recipient" onPress={onAddRecipient} />
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Add Record</Text>
        <TextInput value={amount} onChangeText={setAmount} placeholder="Amount" style={styles.input} keyboardType="numeric" />
        <TextInput value={cnameForRecord} onChangeText={setCnameForRecord} placeholder="Category name (optional)" style={styles.input} />
        <TextInput value={date} onChangeText={setDate} placeholder="Date (YYYY-MM-DD)" style={styles.input} />
        <TextInput value={type} onChangeText={setType} placeholder="Type" style={styles.input} />
        <TextInput value={currency} onChangeText={setCurrency} placeholder="Currency" style={styles.input} />
        <TextInput value={rnameForRecord} onChangeText={setRnameForRecord} placeholder="Recipient name (optional)" style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder="Description" style={styles.input} />
        <Button title="Add Record" onPress={onAddRecord} />
      </View>
    <View style={{ padding: 16, borderTopWidth: 1, borderColor: '#eee' }}>
        <Text style={styles.title}>Debug — Categories</Text>
        <Text selectable>{JSON.stringify(categories, null, 2)}</Text>

        <Text style={[styles.title, { marginTop: 12 }]}>Debug — Recipients</Text>
        <Text selectable>{JSON.stringify(recipients, null, 2)}</Text>

        <Text style={[styles.title, { marginTop: 12 }]}>Debug — Records</Text>
        <Text selectable>{JSON.stringify(records, null, 2)}</Text>
      </View>
      <View style={{ marginTop: 12 }}>
          <Button title="Drop all tables (debug)" color="#b22222" onPress={onDropAllConfirm} />
      </View>
      {/* CSV uploader (debug): upload CSV to import records, this is how u implement my csv uploader hahahahahhahahah*/}
      <View style={{ marginTop: 12 }}>
        <CsvUploader /> 
      </View>
      <View style={{ marginTop: 12 }}>
        <Button title="Refresh Records" onPress={loadAll} />
      </View>

      </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  section: { marginBottom: 24 },
  title: { fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8, borderRadius: 4 }
})