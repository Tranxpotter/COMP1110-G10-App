import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Text, useColorScheme, Pressable, Alert } from 'react-native'
import React, { useRef, useState } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker';
import { SelectList } from "react-native-dropdown-select-list";
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context'
import { addCategory, addRecipient, addRecord, initTables, fetchAllCategories, fetchAllRecipients, fetchAllRecords, dropAllTables, executeSqlAsync } from '../components/dbClient'


// themed components
import { Colors } from '../constants/Colors'
import ThemedText from "../components/ThemedText"
import ThemedTextInput from "../components/ThemedTextInput"
import ThemedButton from "../components/ThemedButton"
import ThemedAutocomplete from '../components/ThemedAutocomplete';
import ThemedSelectList from '../components/ThemedSelectList';
import ThemedView from "../components/ThemedView"
import ThemedScrollView from '../components/ThemedScrollView';
import CsvUploader from '../components/CsvUploader'

const Input = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transaction_type, setTransactionType] = useState("spending");
  const [typeSelectResetKey, setTypeSelectResetKey] = useState(0.0);
  const [typeDropdownCloseKey, setTypeDropdownCloseKey] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("HKD");
  const [description, setDescription] = useState("");

  const [logMsg, setLogMsg] = useState("");
  const [matchingRecipients, setMatchingRecipients] = useState([])
  const [matchingCategories, setMatchingCategories] = useState([])

  const recipientInputRef = useRef(null);
  const categoryInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const descriptionInputRef = useRef(null);

  function handleAmountInput(text) {
    let numericValue = String(text || '').replace(/[^0-9.]/g, '');

    const firstDotIndex = numericValue.indexOf('.')
    if (firstDotIndex !== -1) {
      numericValue =
        numericValue.slice(0, firstDotIndex + 1) +
        numericValue.slice(firstDotIndex + 1).replace(/\./g, '')
    }

    if (numericValue.startsWith('.')) {
      numericValue = `0${numericValue}`
    }

    if (numericValue.includes('.')) {
      const [intPart, decimalPart] = numericValue.split('.')
      const normalizedIntPart = intPart.replace(/^0+(?=\d)/, '')
      numericValue = `${normalizedIntPart || '0'}.${decimalPart}`
    } else {
      numericValue = numericValue.replace(/^0+/, '')
    }

    if (numericValue){
      setAmount(numericValue);
    } else {
      setAmount(0);
    }
  }

  

  async function handleSubmit() {
    if (!date.toISOString() || !transaction_type.trim() || !recipient.trim() || !category.trim()){
      // console.log("Incomplete input");
      setLogMsg("Incomplete Input");
      return;
    }

    console.log(date.toLocaleDateString('en-CA'), transaction_type, recipient, category, amount, description);

    try {
      const obj = {
        amount: amount,
        cname: category || null,
        date: date.toLocaleDateString('en-CA'),
        type: transaction_type || '',
        currency: currency || '',
        inputdatetime: new Date().toISOString(),
        description: description || '',
        rname: recipient || null
      }
      const res = await addRecord(obj)
      // clear
      reset()

      setLogMsg("Record added")
      // Alert.alert('Record added', String(res))
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  

  function reset() {
    setDate(new Date())
    setTransactionType("spending")
    setTypeSelectResetKey((prev) => prev + 1)
    setTypeDropdownCloseKey((prev) => prev + 1)
    setRecipient("")
    setCategory("")
    setAmount(0)
    setDescription("")
    setLogMsg("")
  }

  function handleDateChange(event, selectedDate) {
    if (event?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    if (selectedDate) {
      setDate(selectedDate);
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  }

  async function lookupRecipientMatches(value) {
    const keyword = String(value || '').trim()

    if (!keyword) {
      setMatchingRecipients([])
      return
    }

    const res = await executeSqlAsync(
      `SELECT r.name, c.cname
       FROM recipient r
       LEFT JOIN category c ON c.cid = r.cid
       WHERE r.name LIKE ?
       ORDER BY r.name ASC
       LIMIT 8`,
      [`${keyword}%`]
    )

    setMatchingRecipients(res?.rows?._array || [])
  }

  async function maybeAutofillCategoryByRecipient(value) {
    if (String(category || '').trim()) return

    const exact = String(value || '').trim()
    if (!exact) return

    const res = await executeSqlAsync(
      `SELECT c.cname
       FROM recipient r
       LEFT JOIN category c ON c.cid = r.cid
       WHERE LOWER(r.name) = LOWER(?)
       LIMIT 1`,
      [exact]
    )

    const linkedCategory = res?.rows?._array?.[0]?.cname
    if (linkedCategory) {
      setCategory(linkedCategory)
    }
  }

  async function handleRecipientChange(value) {
    setRecipient(value)
    setLogMsg("")
    closeCategorySuggestions()

    try {
      await lookupRecipientMatches(value)
      await maybeAutofillCategoryByRecipient(value)
    } catch (e) {
      console.log('recipient lookup failed', e)
    }
  }

  async function handleRecipientSuggestionPress(item) {
    setRecipient(item?.name || '')
    setMatchingRecipients([])
    setLogMsg("")

    if (!String(category || '').trim() && item?.cname) {
      setCategory(item.cname)
    }
  }

  function closeRecipientSuggestions() {
    setMatchingRecipients([])
  }

  function closeTypeDropdownPanel() {
    setTypeDropdownCloseKey((prev) => prev + 1)
  }

  async function lookupCategoryMatches(value) {
    const keyword = String(value || '').trim()

    if (!keyword) {
      setMatchingCategories([])
      return
    }

    const res = await executeSqlAsync(
      `SELECT cname
       FROM category
       WHERE cname LIKE ?
       ORDER BY cname ASC
       LIMIT 8`,
      [`${keyword}%`]
    )

    setMatchingCategories(res?.rows?._array || [])
  }

  async function handleCategoryChange(value) {
    setCategory(value)
    setLogMsg("")
    closeRecipientSuggestions()

    try {
      await lookupCategoryMatches(value)
    } catch (e) {
      console.log('category lookup failed', e)
    }
  }

  function handleCategorySuggestionPress(item) {
    setCategory(item?.cname || '')
    setMatchingCategories([])
    setLogMsg("")
  }

  function closeCategorySuggestions() {
    setMatchingCategories([])
  }

  function closeAllSuggestions() {
    closeRecipientSuggestions()
    closeCategorySuggestions()
    closeTypeDropdownPanel()
  }

  function closeRecipientAndCategorySuggestions() {
    closeRecipientSuggestions()
    closeCategorySuggestions()
  }

  function handleTypeSelected(value) {
    const normalized = value === 'income' ? 'income' : 'spending'
    setTransactionType(normalized)
    closeRecipientAndCategorySuggestions()
  }

  const typeOptions = [
    { key: "spending", value: "Spending" },
    { key: "income", value: "Income" }
  ]

  const selectedTypeOption =
    transaction_type === 'income'
      ? { key: 'income', value: 'Income' }
      : { key: 'spending', value: 'Spending' }





  return (
    <KeyboardAvoidingView
      style={[styles.container]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ThemedScrollView
        // safe={true}
        useBottomSafe={false}
        style={[styles.scroll, { marginTop: insets.top }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        
        <View >
          <CsvUploader /> 
        </View>

        <ThemedView style={styles.form}>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldname}>Date:</ThemedText>

            <ThemedButton
              onPress={() => {
                closeAllSuggestions()
                setShowDatePicker(true)
              }}
            >
              <Text style={{color:"#fff"}} >{date.toDateString()}</Text>
            </ThemedButton>

            {showDatePicker && (<DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode='date'
              is24Hour={true}
              onValueChange={(event, selectedDate) => {setDate(selectedDate); setLogMsg("");}}
              onChange={handleDateChange}
            />)}

          </View>

          <View
            style={[styles.fieldRow, styles.typeRow]}
            onTouchStart={closeRecipientAndCategorySuggestions}
          >
            <ThemedText style={styles.fieldname}>Type:</ThemedText>
            
            <ThemedSelectList 
              key={`${typeSelectResetKey}-${typeDropdownCloseKey}`}
              setSelected={handleTypeSelected}
              data={typeOptions}
              floating={true}
              save="key"
              defaultOption={selectedTypeOption}
              search={false}
              inputStyles={{ color: '#fff' }}
              dropdownStyles={styles.typeDropdown}
            />

          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Recipient:</ThemedText>
            
            <ThemedAutocomplete
              inputRef={recipientInputRef}
              containerStyle={styles.autocompleteWrap}
              inputStyle={styles.textinput}
              value={recipient}
              onFocus={closeTypeDropdownPanel}
              onChangeText={handleRecipientChange}
              onSubmitEditing={() => {
                closeRecipientSuggestions()
                closeCategorySuggestions()
                categoryInputRef.current?.focus()
              }}
              returnKeyType="next"
              blurOnSubmit={false}
              autoCorrect={false}
              suggestions={matchingRecipients}
              shouldShowSuggestions={!!recipient.trim() && matchingRecipients.length > 0}
              onSelectSuggestion={handleRecipientSuggestionPress}
              onClose={closeRecipientSuggestions}
              getSuggestionLabel={(item) => item?.name || ''}
              maxVisibleItems={3}
              suggestionRowHeight={50}
            />


          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Category:</ThemedText>
            

            <ThemedAutocomplete
              inputRef={categoryInputRef}
              containerStyle={styles.autocompleteWrap}
              inputStyle={styles.textinput}
              value={category}
              onFocus={closeTypeDropdownPanel}
              onChangeText={handleCategoryChange}
              onSubmitEditing={() => {
                closeCategorySuggestions()
                amountInputRef.current?.focus()
              }}
              returnKeyType="next"
              blurOnSubmit={false}
              autoCorrect={false}
              suggestions={matchingCategories}
              shouldShowSuggestions={!!category.trim() && matchingCategories.length > 0}
              onSelectSuggestion={handleCategorySuggestionPress}
              onClose={closeCategorySuggestions}
              getSuggestionLabel={(item) => item?.cname || ''}
              maxVisibleItems={3}
              suggestionRowHeight={50}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Amount:</ThemedText>
            
            
            <ThemedTextInput
              keyboardType="numeric"
              ref={amountInputRef}
              style={styles.textinput}
              value={String(amount)}
              onFocus={closeAllSuggestions}
              onChangeText={(value) => {handleAmountInput(value); setLogMsg("");}}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => descriptionInputRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Description:</ThemedText>
            
            
            <ThemedTextInput
              ref={descriptionInputRef}
              style={styles.multiline}
              value={description}
              onFocus={closeAllSuggestions}
              onChangeText={(value) => {setDescription(value); setLogMsg("");}}
              multiline={true}
              // numberOfLines={5}
              textAlignVertical="top"
              returnKeyType="done"
            />
          </View>
        </ThemedView>


        <View style={[styles.container, { flexDirection: "row", justifyContent: "space-evenly", height: "30" }]}>

          <ThemedButton 
            style={{ backgroundColor: Colors.primary , justifyContent: "center", width: "150", padding: 10, height: 40 }}
            onPress={handleSubmit}
          >
            <Text style={{ color: "#fff", fontSize: 15, textAlign: "center"}}>Submit</Text>
          </ThemedButton>

          <ThemedButton 
            style={{ backgroundColor: Colors.warning , justifyContent: "center", width: "150", padding: 10, height: 40 }}
            onPress={reset}
          >
            <Text style={{ color: "#fff", fontSize: 15, textAlign: "center"}}>Reset</Text>
          </ThemedButton>

        </View>
            
        <View style={[styles.logRow, ]}>
          <Text style={styles.logText}>{logMsg}</Text>
        </View>
        
      </ThemedScrollView>
    </KeyboardAvoidingView>
  )
}

export default Input

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // containerRow: {
  //   flexDirection: "row", 
  //   width: "100%"
  // }, 
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  form: {
    flex: 1,
    width: "100%",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
    columnGap: 10,
  },
  typeRow: {
    zIndex: 300,
    elevation: 300,
  },
  typeDropdown: {
    zIndex: 400,
    elevation: 400,
  },
  textinput: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  autocompleteWrap: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  multiline: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    height: 100
  },
  fieldname: {
    width: 100,
    flexShrink: 0,

    fontSize: 18,
    textAlign: "right",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    marginTop: 12,
    minHeight: 40,
  },
  logRow: {
    marginTop: 30,
    minHeight: 24,
    justifyContent: "flex-start",
  },
  logText: {
    color: Colors.warning,
    width: "100%",
    textAlign: "center",
  },
})