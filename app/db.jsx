import React, { useState } from 'react'
import { View, Text, TextInput, Button, Alert, ScrollView, StyleSheet } from 'react-native'
import { addCategory, addRecipient, addRecord } from '../components/dbClient'

export default function InputForms() {
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
      Alert.alert('Recipient added', String(res))
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  async function onAddRecord() {
    try {
      const amt = amount ? Number(amount) : 0
      const obj = {
        amount: amt,
        cname: cnameForRecord || null,
        date: date || '',
        type: type || '',
        currency: currency || '',
        inputdatetime: new Date().toISOString(),
        description: description || '',
        rname: rnameForRecord || null
      }
      const res = await addRecord(obj)
      // clear
      setAmount(''); setCnameForRecord(''); setDate(''); setType(''); setCurrency(''); setDescription(''); setRnameForRecord('')
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  section: { marginBottom: 24 },
  title: { fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8, borderRadius: 4 }
})