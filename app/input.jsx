import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Text, useColorScheme, Pressable, Alert, Modal } from 'react-native'
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
import { APP_BASE_CURRENCY, CURRENCY_OPTIONS, convertToBaseAmount } from '../components/fxService'

const Input = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const insets = useSafeAreaInsets();

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transaction_type, setTransactionType] = useState("spending");
  const [typeSelectResetKey, setTypeSelectResetKey] = useState(0.0);
  const [currencySelectResetKey, setCurrencySelectResetKey] = useState(0)
  const [typeDropdownCloseKey, setTypeDropdownCloseKey] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [currency, setCurrency] = useState("HKD");
  const [description, setDescription] = useState("");

  const [logMsg, setLogMsg] = useState("");
  const [matchingRecipients, setMatchingRecipients] = useState([])
  const [matchingCategories, setMatchingCategories] = useState([])
  const [showAddRecipientModal, setShowAddRecipientModal] = useState(false)
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false)
  const [newRecipientName, setNewRecipientName] = useState('')
  const [newRecipientNameExists, setNewRecipientNameExists] = useState(false)
  const [newRecipientDefaultCategory, setNewRecipientDefaultCategory] = useState('')
  const [recipientModalCategoryMatches, setRecipientModalCategoryMatches] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryNameExists, setNewCategoryNameExists] = useState(false)

  const recipientInputRef = useRef(null);
  const categoryInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const newRecipientNameInputRef = useRef(null);
  const newRecipientDefaultCategoryInputRef = useRef(null);
  const newCategoryNameInputRef = useRef(null);

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

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setLogMsg('Amount must be a positive number')
      return
    }

    const normalizedCurrency = String(currency || APP_BASE_CURRENCY).trim().toUpperCase()

    console.log(date.toLocaleDateString('en-CA'), transaction_type, recipient, category, amount, description);

    try {
      setLogMsg('Fetching FX rate...')
      const fx = await convertToBaseAmount({
        amount: numericAmount,
        fromCurrency: normalizedCurrency,
        quoteCurrency: APP_BASE_CURRENCY,
        date: date.toLocaleDateString('en-CA'),
      })

      const obj = {
        amount: numericAmount,
        amount_base: fx.amountBase,
        fx_rate_to_base: fx.fxRateToBase,
        fx_base_currency: fx.fxBaseCurrency,
        fx_quote_currency: fx.fxQuoteCurrency,
        fx_rate_date: fx.fxRateDate,
        fx_provider: fx.fxProvider,
        cname: category || null,
        date: date.toLocaleDateString('en-CA'),
        type: transaction_type || '',
        currency: normalizedCurrency,
        inputdatetime: new Date().toISOString(),
        description: description || '',
        rname: recipient || null
      }
      const res = await addRecord(obj)
      // clear
      reset()

      if (normalizedCurrency === APP_BASE_CURRENCY) {
        setLogMsg('Record added')
      } else {
        setLogMsg(`Record added (${normalizedCurrency}->${APP_BASE_CURRENCY} ${fx.fxRateToBase.toFixed(4)})`)
      }
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
    setCurrency(APP_BASE_CURRENCY)
    setCurrencySelectResetKey((prev) => prev + 1)
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

  async function isRecipientNameTaken(name) {
    const normalizedName = String(name || '').trim()
    if (!normalizedName) return false

    const res = await executeSqlAsync(
      `SELECT rid
       FROM recipient
       WHERE LOWER(name) = LOWER(?)
       LIMIT 1`,
      [normalizedName]
    )

    return !!res?.rows?._array?.length
  }

  async function isCategoryNameTaken(name) {
    const normalizedName = String(name || '').trim()
    if (!normalizedName) return false

    const res = await executeSqlAsync(
      `SELECT cid
       FROM category
       WHERE LOWER(cname) = LOWER(?)
       LIMIT 1`,
      [normalizedName]
    )

    return !!res?.rows?._array?.length
  }

  async function handleNewRecipientNameChange(value) {
    setNewRecipientName(value)
    try {
      const taken = await isRecipientNameTaken(value)
      setNewRecipientNameExists(taken)
    } catch (e) {
      console.log('recipient duplicate check failed', e)
      setNewRecipientNameExists(false)
    }
  }

  async function lookupRecipientModalCategoryMatches(value) {
    const keyword = String(value || '').trim()

    if (!keyword) {
      setRecipientModalCategoryMatches([])
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

    setRecipientModalCategoryMatches(res?.rows?._array || [])
  }

  async function handleNewRecipientDefaultCategoryChange(value) {
    setNewRecipientDefaultCategory(value)

    try {
      await lookupRecipientModalCategoryMatches(value)
    } catch (e) {
      console.log('recipient modal category lookup failed', e)
    }
  }

  function handleRecipientModalCategorySuggestionPress(item) {
    setNewRecipientDefaultCategory(item?.cname || '')
    setRecipientModalCategoryMatches([])
  }

  function closeRecipientModalCategorySuggestions() {
    setRecipientModalCategoryMatches([])
  }

  async function handleNewCategoryNameChange(value) {
    setNewCategoryName(value)
    try {
      const taken = await isCategoryNameTaken(value)
      setNewCategoryNameExists(taken)
    } catch (e) {
      console.log('category duplicate check failed', e)
      setNewCategoryNameExists(false)
    }
  }

  function resetAddRecipientModal() {
    setNewRecipientName('')
    setNewRecipientNameExists(false)
    setNewRecipientDefaultCategory('')
    setRecipientModalCategoryMatches([])
  }

  function resetAddCategoryModal() {
    setNewCategoryName('')
    setNewCategoryNameExists(false)
  }

  function openAddRecipientModal() {
    closeAllSuggestions()
    resetAddRecipientModal()
    setShowAddRecipientModal(true)
  }

  function closeAddRecipientModal() {
    setShowAddRecipientModal(false)
    resetAddRecipientModal()
  }

  function openAddCategoryModal() {
    closeAllSuggestions()
    resetAddCategoryModal()
    setShowAddCategoryModal(true)
  }

  function closeAddCategoryModal() {
    setShowAddCategoryModal(false)
    resetAddCategoryModal()
  }

  async function handleAddRecipientSubmit() {
    const trimmedRecipientName = String(newRecipientName || '').trim()
    const trimmedDefaultCategory = String(newRecipientDefaultCategory || '').trim()

    if (!trimmedRecipientName) {
      Alert.alert('Name required', 'Please enter a recipient name.')
      return
    }

    try {
      const duplicateRecipient = await isRecipientNameTaken(trimmedRecipientName)
      setNewRecipientNameExists(duplicateRecipient)
      if (duplicateRecipient) return

      let selectedCategoryId = null
      let selectedCategoryName = ''

      if (trimmedDefaultCategory) {
        const matchedCategoryRes = await executeSqlAsync(
          `SELECT cid, cname
           FROM category
           WHERE LOWER(cname) = LOWER(?)
           LIMIT 1`,
          [trimmedDefaultCategory]
        )

        const matchedCategory = matchedCategoryRes?.rows?._array?.[0]
        if (!matchedCategory) {
          Alert.alert('Category not found', 'Please select an existing default category or leave it blank.')
          return
        }

        selectedCategoryId = matchedCategory.cid
        selectedCategoryName = matchedCategory.cname
      }

      await addRecipient(trimmedRecipientName, selectedCategoryId)
      setRecipient(trimmedRecipientName)

      if (!String(category || '').trim() && selectedCategoryName) {
        setCategory(selectedCategoryName)
      }

      setLogMsg('Recipient added')
      closeAddRecipientModal()
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
  }

  async function handleAddCategorySubmit() {
    const trimmedCategoryName = String(newCategoryName || '').trim()

    if (!trimmedCategoryName) {
      Alert.alert('Name required', 'Please enter a category name.')
      return
    }

    try {
      const duplicateCategory = await isCategoryNameTaken(trimmedCategoryName)
      setNewCategoryNameExists(duplicateCategory)
      if (duplicateCategory) return

      await addCategory(trimmedCategoryName)
      setCategory(trimmedCategoryName)

      if (String(category || '').trim()) {
        await lookupCategoryMatches(category)
      }

      setLogMsg('Category added')
      closeAddCategoryModal()
    } catch (e) {
      console.log(e)
      Alert.alert('Error', String(e))
    }
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

  const selectedCurrencyOption =
    CURRENCY_OPTIONS.find((item) => item.key === String(currency || '').toUpperCase())
      || CURRENCY_OPTIONS[0]





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
        nestedScrollEnabled={true}
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
              dropdownStyles={styles.typeDropdown}
            />

          </View>

          <View style={styles.fieldRow}>
            
            <View style={styles.fieldLabelWrap}>
              <ThemedText style={styles.fieldname}>Recipient:</ThemedText>
              <ThemedButton style={styles.inlineAddButton} onPress={openAddRecipientModal}>
                <Text style={styles.inlineAddButtonText}>Add Recipient</Text>
              </ThemedButton>
            </View>
            
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
            
            <View style={styles.fieldLabelWrap}>
              <ThemedText style={styles.fieldname}>Category:</ThemedText>
              <ThemedButton style={styles.inlineAddButton} onPress={openAddCategoryModal}>
                <Text style={styles.inlineAddButtonText}>Add Category</Text>
              </ThemedButton>
            </View>
            

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
              onSubmitEditing={closeAllSuggestions}
            />
          </View>

          <View style={[styles.fieldRow, styles.currencyRow]}>
            <ThemedText style={styles.fieldname}>Currency:</ThemedText>

            <ThemedSelectList
              key={`currency-${currencySelectResetKey}`}
              setSelected={(value) => {
                setCurrency(String(value || APP_BASE_CURRENCY).toUpperCase())
                setLogMsg('')
              }}
              data={CURRENCY_OPTIONS}
              floating={true}
              save="key"
              defaultOption={selectedCurrencyOption}
              search={false}
              nestedScrollEnabled={true}
              dropdownStyles={styles.currencyDropdown}
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

      <Modal
        visible={showAddRecipientModal}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={closeAddRecipientModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 28}
          >
            <ThemedView style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Add Recipient</ThemedText>
                <Pressable onPress={closeAddRecipientModal} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.modalFieldLabel}>Name (required)</ThemedText>
                <ThemedTextInput
                  ref={newRecipientNameInputRef}
                  style={styles.modalInput}
                  value={newRecipientName}
                  onFocus={closeRecipientModalCategorySuggestions}
                  onChangeText={handleNewRecipientNameChange}
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => newRecipientDefaultCategoryInputRef.current?.focus()}
                />
                {newRecipientNameExists && (
                  <Text style={styles.duplicateWarning}>Recipient name already exists.</Text>
                )}

                <ThemedText style={styles.modalFieldLabel}>Default Category (optional)</ThemedText>
                <ThemedAutocomplete
                  inputRef={newRecipientDefaultCategoryInputRef}
                  containerStyle={styles.modalAutocompleteWrap}
                  inputStyle={styles.modalInput}
                  value={newRecipientDefaultCategory}
                  onChangeText={handleNewRecipientDefaultCategoryChange}
                  onFocus={closeRecipientModalCategorySuggestions}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  autoCorrect={false}
                  suggestions={recipientModalCategoryMatches}
                  shouldShowSuggestions={
                    !!newRecipientDefaultCategory.trim() && recipientModalCategoryMatches.length > 0
                  }
                  onSelectSuggestion={handleRecipientModalCategorySuggestionPress}
                  onClose={closeRecipientModalCategorySuggestions}
                  getSuggestionLabel={(item) => item?.cname || ''}
                  maxVisibleItems={3}
                  suggestionRowHeight={50}
                />

                <View style={styles.modalActions}>
                  <ThemedButton
                    style={[styles.modalButton, { backgroundColor: theme.iconColor }]}
                    onPress={closeAddRecipientModal}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </ThemedButton>

                  <ThemedButton
                    style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                    onPress={handleAddRecipientSubmit}
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </ThemedButton>
                </View>
              </ScrollView>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showAddCategoryModal}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={closeAddCategoryModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 28}
          >
            <ThemedView style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Add Category</ThemedText>
                <Pressable onPress={closeAddCategoryModal} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <ThemedText style={styles.modalFieldLabel}>Name (required)</ThemedText>
                <ThemedTextInput
                  ref={newCategoryNameInputRef}
                  style={styles.modalInput}
                  value={newCategoryName}
                  onChangeText={handleNewCategoryNameChange}
                  autoCorrect={false}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
                {newCategoryNameExists && (
                  <Text style={styles.duplicateWarning}>Category name already exists.</Text>
                )}

                <View style={styles.modalActions}>
                  <ThemedButton
                    style={[styles.modalButton, { backgroundColor: theme.iconColor }]}
                    onPress={closeAddCategoryModal}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </ThemedButton>

                  <ThemedButton
                    style={[styles.modalButton, { backgroundColor: Colors.primary }]}
                    onPress={handleAddCategorySubmit}
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </ThemedButton>
                </View>
              </ScrollView>
            </ThemedView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  fieldLabelWrap: {
    width: 100,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  typeRow: {
    zIndex: 300,
    elevation: 300,
  },
  typeDropdown: {
    zIndex: 400,
    elevation: 400,
  },
  currencyRow: {
    zIndex: 220,
    elevation: 220,
  },
  currencyDropdown: {
    zIndex: 260,
    elevation: 260,
    maxHeight: 180,
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
  inlineAddButton: {
    marginTop: 4,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  inlineAddButtonText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  modalKeyboardWrap: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    maxHeight: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxHeight: '95%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.warning,
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 72,
  },
  modalFieldLabel: {
    fontSize: 15,
    marginBottom: 4,
    marginTop: 6,
  },
  modalInput: {
    width: '100%',
  },
  modalAutocompleteWrap: {
    width: '100%',
    minWidth: 0,
    minHeight: 60,
  },
  duplicateWarning: {
    marginTop: 4,
    marginBottom: 8,
    color: Colors.warning,
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    columnGap: 10,
    marginTop: 14,
  },
  modalButton: {
    minWidth: 90,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
})