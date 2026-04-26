import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Colors } from '../constants/Colors'
import { RecordFilterConfig, RecordSortConfig, deleteCategory, deleteRecord, deleteRecipient, executeSqlAsync, fetchAllCategories, fetchAllRecipients, fetchRecordCountWithFilters, fetchRecordsWithFilters, initTables, updateCategory, updateRecord, updateRecipient } from '../components/dbClient'
import ThemedAutocomplete from '../components/ThemedAutocomplete'
import ThemedButton from '../components/ThemedButton'
import ThemedSelectList from '../components/ThemedSelectList'
import ThemedText from '../components/ThemedText'
import ThemedTextInput from '../components/ThemedTextInput'
import ThemedView from '../components/ThemedView'
import RecordsFilterModal from '../components/RecordsFilterModal'
import CsvDownloader from '../components/CsvDownloader'
import { APP_BASE_CURRENCY, CURRENCY_OPTIONS, convertToBaseAmount } from '../components/fxService'
import { useDateContext } from '../contexts/DateContext'

const RECORD_COLUMNS = [
  { key: 'date', width: 110, maxWidth: 110 },
  { key: 'amount', width: 92, maxWidth: 92 },
  { key: 'category', width: 120, maxWidth: 120 },
  { key: 'recipient', width: 120, maxWidth: 120 },
  { key: 'description', width: 240, maxWidth: 240 },
  { key: 'currency', width: 90, maxWidth: 90 },
]

const UPDATE_ACTION_COLUMN = { key: 'update', width: 120, maxWidth: 120 }
const DELETE_ACTION_COLUMN = { key: 'delete', width: 120, maxWidth: 120 }
const SELECT_COLUMN = { key: 'select', width: 68, maxWidth: 68 }

const TABLE_MODE_OPTIONS = [
  { key: 'transactions', value: 'Transactions' },
  { key: 'categories', value: 'Categories' },
  { key: 'recipients', value: 'Recipients' },
]

const CATEGORY_COLUMNS = [
  { key: 'name', label: 'name', width: 220, maxWidth: 220 },
  { key: 'count', label: 'count of transactions', width: 190, maxWidth: 190 },
]

const RECIPIENT_COLUMNS = [
  { key: 'name', label: 'name', width: 180, maxWidth: 180 },
  { key: 'count', label: 'count of transactions', width: 190, maxWidth: 190 },
  { key: 'defaultCategory', label: 'default category', width: 220, maxWidth: 220 },
]

const TYPE_OPTIONS = [
  { key: 'spending', value: 'Spending' },
  { key: 'income', value: 'Income' },
]

const PAGE_SIZE_OPTIONS = [
  { key: '10', value: '10 / page' },
  { key: '20', value: '20 / page' },
  { key: '50', value: '50 / page' },
]
const ALLOWED_PAGE_SIZES = [10, 20, 50]
const DEFAULT_ROWS_PER_PAGE = 20

const normalizePageSize = (value) => {
  const parsed = Number(value)
  return ALLOWED_PAGE_SIZES.includes(parsed) ? parsed : DEFAULT_ROWS_PER_PAGE
}

const normalizePage = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.trunc(parsed)
}

const parseDateValue = (value, fallbackDate = null) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallbackDate || new Date()
  return parsed
}

const UpdateRecordModal = ({
  visible,
  record,
  categoriesById,
  recipientsById,
  onClose,
  onSave,
}) => {
  const { debugDate, getCurrentDate } = useDateContext()
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [transactionType, setTransactionType] = useState('spending')
  const [typeSelectResetKey, setTypeSelectResetKey] = useState(0)
  const [typeDropdownCloseKey, setTypeDropdownCloseKey] = useState(0)
  const [currencySelectResetKey, setCurrencySelectResetKey] = useState(0)
  const [recipient, setRecipient] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('0')
  const [currency, setCurrency] = useState('HKD')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [matchingRecipients, setMatchingRecipients] = useState([])
  const [matchingCategories, setMatchingCategories] = useState([])

  const recipientInputRef = useRef(null)
  const categoryInputRef = useRef(null)
  const amountInputRef = useRef(null)
  const descriptionInputRef = useRef(null)
  const initialValuesRef = useRef(null)

  useEffect(() => {
    if (!visible || !record) return

    const nextType = String(record.type || '').toLowerCase() === 'income' ? 'income' : 'spending'
    const initialDate = parseDateValue(record.date, getCurrentDate())
    const initialRecipient = String(recipientsById[record.rid] || '')
    const initialCategory = String(categoriesById[record.cid] || '')
    const initialAmount = String(record.amount ?? 0)
    const initialCurrency = String(record.currency ?? 'HKD')
    const initialDescription = String(record.description ?? '')

    setDate(initialDate)
    setTransactionType(nextType)
    setTypeSelectResetKey((prev) => prev + 1)
    setTypeDropdownCloseKey((prev) => prev + 1)
    setCurrencySelectResetKey((prev) => prev + 1)
    setRecipient(initialRecipient)
    setCategory(initialCategory)
    setAmount(initialAmount)
    setCurrency(initialCurrency)
    setDescription(initialDescription)
    setMatchingRecipients([])
    setMatchingCategories([])
    setShowDatePicker(false)
    setSaving(false)
    setErrorMsg('')

    initialValuesRef.current = {
      date: initialDate.toLocaleDateString('en-CA'),
      type: nextType,
      recipient: initialRecipient,
      category: initialCategory,
      amount: Number(initialAmount),
      amountRaw: initialAmount,
      currency: initialCurrency,
      description: initialDescription,
    }
  }, [visible, record, categoriesById, recipientsById, debugDate, getCurrentDate])

  const hasUnsavedChanges = useMemo(() => {
    if (!visible || !record || !initialValuesRef.current) return false

    const initial = initialValuesRef.current
    const currentDate = date?.toLocaleDateString?.('en-CA') || ''
    const currentAmount = Number(amount)

    const amountChanged = Number.isFinite(currentAmount) && Number.isFinite(initial.amount)
      ? currentAmount !== initial.amount
      : String(amount) !== String(initial.amountRaw || '')

    return (
      currentDate !== initial.date ||
      transactionType !== initial.type ||
      recipient !== initial.recipient ||
      category !== initial.category ||
      amountChanged ||
      currency !== initial.currency ||
      description !== initial.description
    )
  }, [visible, record, date, transactionType, recipient, category, amount, currency, description])

  const handleAttemptClose = useCallback(() => {
    if (saving) return

    if (!hasUnsavedChanges) {
      onClose()
      return
    }

    Alert.alert(
      'Discard unsaved changes?',
      'You have unsaved changes. Close without saving?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]
    )
  }, [saving, hasUnsavedChanges, onClose])

  const selectedTypeOption =
    transactionType === 'income'
      ? { key: 'income', value: 'Income' }
      : { key: 'spending', value: 'Spending' }

  const selectedCurrencyOption =
    CURRENCY_OPTIONS.find((item) => item.key === String(currency || '').toUpperCase())
      || CURRENCY_OPTIONS[0]

  const closeRecipientSuggestions = useCallback(() => {
    setMatchingRecipients([])
  }, [])

  const closeCategorySuggestions = useCallback(() => {
    setMatchingCategories([])
  }, [])

  const closeTypeDropdownPanel = useCallback(() => {
    setTypeDropdownCloseKey((prev) => prev + 1)
  }, [])

  const closeAllSuggestions = useCallback(() => {
    closeRecipientSuggestions()
    closeCategorySuggestions()
    closeTypeDropdownPanel()
  }, [closeRecipientSuggestions, closeCategorySuggestions, closeTypeDropdownPanel])

  const handleAmountInput = useCallback((text) => {
    let numericValue = String(text || '').replace(/[^0-9.]/g, '')

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

    setAmount(numericValue || '0')
    setErrorMsg('')
  }, [])

  const lookupRecipientMatches = useCallback(async (value) => {
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
  }, [])

  const maybeAutofillCategoryByRecipient = useCallback(async (value) => {
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
    if (linkedCategory) setCategory(linkedCategory)
  }, [category])

  const lookupCategoryMatches = useCallback(async (value) => {
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
  }, [])

  const handleRecipientChange = useCallback(async (value) => {
    setRecipient(value)
    setErrorMsg('')
    closeCategorySuggestions()

    try {
      await lookupRecipientMatches(value)
      await maybeAutofillCategoryByRecipient(value)
    } catch (e) {
      console.error('recipient lookup failed', e)
    }
  }, [closeCategorySuggestions, lookupRecipientMatches, maybeAutofillCategoryByRecipient])

  const handleCategoryChange = useCallback(async (value) => {
    setCategory(value)
    setErrorMsg('')
    closeRecipientSuggestions()

    try {
      await lookupCategoryMatches(value)
    } catch (e) {
      console.error('category lookup failed', e)
    }
  }, [closeRecipientSuggestions, lookupCategoryMatches])

  const handleSave = useCallback(async () => {
    if (!record?.tid) {
      setErrorMsg('Invalid record.')
      return
    }

    const formattedDate = date?.toLocaleDateString?.('en-CA')
    const trimmedRecipient = String(recipient || '').trim()
    const trimmedCategory = String(category || '').trim()
    const normalizedType = transactionType === 'income' ? 'income' : 'spending'
    const numericAmount = Number(amount)

    if (!formattedDate || !trimmedRecipient || !trimmedCategory) {
      setErrorMsg('Incomplete input.')
      return
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Amount must be a positive number.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        tid: record.tid,
        amount: numericAmount,
        date: formattedDate,
        type: normalizedType,
        recipient: trimmedRecipient,
        category: trimmedCategory,
        currency: String(currency || APP_BASE_CURRENCY).trim().toUpperCase(),
        description: String(description || ''),
      })
    } catch (e) {
      setErrorMsg(String(e?.message || e || 'Update failed'))
    } finally {
      setSaving(false)
    }
  }, [record, date, recipient, category, transactionType, amount, onSave, currency, description])

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={handleAttemptClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Update Record</ThemedText>
              <Pressable onPress={handleAttemptClose} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Date:</ThemedText>
                <ThemedButton
                  onPress={() => {
                    closeAllSuggestions()
                    setShowDatePicker(true)
                    setErrorMsg('')
                  }}
                >
                  <Text style={styles.dateButtonText}>{date.toDateString()}</Text>
                </ThemedButton>

                {showDatePicker && (
                  <DateTimePicker
                    testID="updateDatePicker"
                    value={date}
                    mode="date"
                    is24Hour={true}
                    onChange={(event, selectedDate) => {
                      if (event?.type === 'dismissed') {
                        setShowDatePicker(false)
                        return
                      }

                      if (selectedDate) {
                        setDate(selectedDate)
                        setErrorMsg('')
                      }

                      if (Platform.OS === 'android') {
                        setShowDatePicker(false)
                      }
                    }}
                  />
                )}
              </View>

              <View
                style={[styles.modalFieldRow, styles.modalTypeRow]}
                onTouchStart={() => {
                  closeRecipientSuggestions()
                  closeCategorySuggestions()
                }}
              >
                <ThemedText style={styles.modalFieldName}>Type:</ThemedText>
                <ThemedSelectList
                  key={`${typeSelectResetKey}-${typeDropdownCloseKey}`}
                  setSelected={(value) => {
                    const normalized = value === 'income' ? 'income' : 'spending'
                    setTransactionType(normalized)
                    setErrorMsg('')
                    closeRecipientSuggestions()
                    closeCategorySuggestions()
                  }}
                  data={TYPE_OPTIONS}
                  floating={true}
                  save="key"
                  defaultOption={selectedTypeOption}
                  search={false}
                  dropdownStyles={styles.modalTypeDropdown}
                />
              </View>

              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Recipient:</ThemedText>
                <ThemedAutocomplete
                  inputRef={recipientInputRef}
                  containerStyle={styles.modalAutocompleteWrap}
                  inputStyle={styles.modalTextInput}
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
                  onSelectSuggestion={(item) => {
                    setRecipient(item?.name || '')
                    setMatchingRecipients([])
                    setErrorMsg('')

                    if (!String(category || '').trim() && item?.cname) {
                      setCategory(item.cname)
                    }
                  }}
                  onClose={closeRecipientSuggestions}
                  getSuggestionLabel={(item) => item?.name || ''}
                  maxVisibleItems={3}
                  suggestionRowHeight={50}
                />
              </View>

              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Category:</ThemedText>
                <ThemedAutocomplete
                  inputRef={categoryInputRef}
                  containerStyle={styles.modalAutocompleteWrap}
                  inputStyle={styles.modalTextInput}
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
                  onSelectSuggestion={(item) => {
                    setCategory(item?.cname || '')
                    setMatchingCategories([])
                    setErrorMsg('')
                  }}
                  onClose={closeCategorySuggestions}
                  getSuggestionLabel={(item) => item?.cname || ''}
                  maxVisibleItems={3}
                  suggestionRowHeight={50}
                />
              </View>

              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Amount:</ThemedText>
                <ThemedTextInput
                  keyboardType="numeric"
                  ref={amountInputRef}
                  style={styles.modalTextInput}
                  value={String(amount)}
                  onFocus={closeAllSuggestions}
                  onChangeText={handleAmountInput}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={closeAllSuggestions}
                />
              </View>

              <View style={[styles.modalFieldRow, styles.modalCurrencyRow]}>
                <ThemedText style={styles.modalFieldName}>Currency:</ThemedText>
                <ThemedSelectList
                  key={`update-currency-${currencySelectResetKey}`}
                  setSelected={(value) => {
                    setCurrency(String(value || APP_BASE_CURRENCY).toUpperCase())
                    setErrorMsg('')
                  }}
                  data={CURRENCY_OPTIONS}
                  floating={true}
                  save="key"
                  defaultOption={selectedCurrencyOption}
                  search={false}
                  nestedScrollEnabled={true}
                  dropdownStyles={styles.modalCurrencyDropdown}
                />
              </View>

              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Description:</ThemedText>
                <ThemedTextInput
                  ref={descriptionInputRef}
                  style={styles.modalMultiline}
                  value={description}
                  onFocus={closeAllSuggestions}
                  onChangeText={(value) => {
                    setDescription(value)
                    setErrorMsg('')
                  }}
                  multiline={true}
                  textAlignVertical="top"
                  returnKeyType="done"
                />
              </View>

              <View style={styles.modalActionRow}>
                <ThemedButton
                  style={[styles.modalActionButton, styles.modalSaveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.modalActionText}>{saving ? 'Saving...' : 'Save'}</Text>
                </ThemedButton>

                <ThemedButton
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={handleAttemptClose}
                >
                  <Text style={styles.modalActionText}>Cancel</Text>
                </ThemedButton>
              </View>

              {!!errorMsg && <Text style={styles.modalErrorText}>{errorMsg}</Text>}
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const UpdateCategoryModal = ({ visible, category, onClose, onSave }) => {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const initialNameRef = useRef('')

  useEffect(() => {
    if (!visible || !category) return

    const initialName = String(category.cname || '')
    setName(initialName)
    setSaving(false)
    setErrorMsg('')
    initialNameRef.current = initialName
  }, [visible, category])

  const hasUnsavedChanges = useMemo(() => {
    if (!visible || !category) return false
    return String(name) !== String(initialNameRef.current || '')
  }, [visible, category, name])

  const handleAttemptClose = useCallback(() => {
    if (saving) return

    if (!hasUnsavedChanges) {
      onClose()
      return
    }

    Alert.alert(
      'Discard unsaved changes?',
      'You have unsaved changes. Close without saving?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]
    )
  }, [saving, hasUnsavedChanges, onClose])

  const handleSave = useCallback(async () => {
    if (!category?.cid) {
      setErrorMsg('Invalid category.')
      return
    }

    const trimmedName = String(name || '').trim()
    if (!trimmedName) {
      setErrorMsg('Name is required.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        cid: category.cid,
        name: trimmedName,
      })
    } catch (e) {
      setErrorMsg(String(e?.message || e || 'Update failed'))
    } finally {
      setSaving(false)
    }
  }, [category, name, onSave])

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={handleAttemptClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Update Category</ThemedText>
              <Pressable onPress={handleAttemptClose} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Name:</ThemedText>
                <ThemedTextInput
                  style={styles.modalTextInput}
                  value={name}
                  onChangeText={(value) => {
                    setName(value)
                    setErrorMsg('')
                  }}
                  autoCorrect={false}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.modalActionRow}>
                <ThemedButton
                  style={[styles.modalActionButton, styles.modalSaveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.modalActionText}>{saving ? 'Saving...' : 'Save'}</Text>
                </ThemedButton>

                <ThemedButton
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={handleAttemptClose}
                >
                  <Text style={styles.modalActionText}>Cancel</Text>
                </ThemedButton>
              </View>

              {!!errorMsg && <Text style={styles.modalErrorText}>{errorMsg}</Text>}
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const UpdateRecipientModal = ({ visible, recipient, onClose, onSave }) => {
  const [name, setName] = useState('')
  const [defaultCategory, setDefaultCategory] = useState('')
  const [matchingCategories, setMatchingCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const initialValuesRef = useRef({ name: '', defaultCategory: '' })
  const defaultCategoryInputRef = useRef(null)

  useEffect(() => {
    if (!visible || !recipient) return

    const initialName = String(recipient.name || '')
    const initialDefaultCategory = String(recipient.defaultCategory || '')

    setName(initialName)
    setDefaultCategory(initialDefaultCategory)
    setMatchingCategories([])
    setSaving(false)
    setErrorMsg('')
    initialValuesRef.current = {
      name: initialName,
      defaultCategory: initialDefaultCategory,
    }
  }, [visible, recipient])

  const hasUnsavedChanges = useMemo(() => {
    if (!visible || !recipient) return false

    return (
      String(name) !== String(initialValuesRef.current.name || '') ||
      String(defaultCategory) !== String(initialValuesRef.current.defaultCategory || '')
    )
  }, [visible, recipient, name, defaultCategory])

  const closeCategorySuggestions = useCallback(() => {
    setMatchingCategories([])
  }, [])

  const lookupCategoryMatches = useCallback(async (value) => {
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
  }, [])

  const handleDefaultCategoryChange = useCallback(async (value) => {
    setDefaultCategory(value)
    setErrorMsg('')

    try {
      await lookupCategoryMatches(value)
    } catch (e) {
      console.error('default category lookup failed', e)
    }
  }, [lookupCategoryMatches])

  const handleAttemptClose = useCallback(() => {
    if (saving) return

    if (!hasUnsavedChanges) {
      onClose()
      return
    }

    Alert.alert(
      'Discard unsaved changes?',
      'You have unsaved changes. Close without saving?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]
    )
  }, [saving, hasUnsavedChanges, onClose])

  const handleSave = useCallback(async () => {
    if (!recipient?.rid) {
      setErrorMsg('Invalid recipient.')
      return
    }

    const trimmedName = String(name || '').trim()
    const trimmedDefaultCategory = String(defaultCategory || '').trim()
    if (!trimmedName) {
      setErrorMsg('Name is required.')
      return
    }

    let defaultCategoryCid = null
    if (trimmedDefaultCategory) {
      const matchRes = await executeSqlAsync(
        `SELECT cid
         FROM category
         WHERE LOWER(cname) = LOWER(?)
         LIMIT 1`,
        [trimmedDefaultCategory]
      )
      const matchedCategory = matchRes?.rows?._array?.[0]
      if (!matchedCategory?.cid) {
        setErrorMsg('Default category must be an existing category.')
        return
      }
      defaultCategoryCid = matchedCategory.cid
    }

    setSaving(true)
    try {
      await onSave({
        rid: recipient.rid,
        name: trimmedName,
        defaultCategoryCid,
      })
    } catch (e) {
      setErrorMsg(String(e?.message || e || 'Update failed'))
    } finally {
      setSaving(false)
    }
  }, [recipient, name, defaultCategory, onSave])

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={handleAttemptClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Update Recipient</ThemedText>
              <Pressable onPress={handleAttemptClose} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Name:</ThemedText>
                <ThemedTextInput
                  style={styles.modalTextInput}
                  value={name}
                  onFocus={closeCategorySuggestions}
                  onChangeText={(value) => {
                    setName(value)
                    setErrorMsg('')
                  }}
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => defaultCategoryInputRef.current?.focus()}
                />
              </View>

              <View style={styles.modalFieldRow}>
                <ThemedText style={styles.modalFieldName}>Default Category:</ThemedText>
                <ThemedAutocomplete
                  inputRef={defaultCategoryInputRef}
                  containerStyle={styles.modalAutocompleteWrap}
                  inputStyle={styles.modalTextInput}
                  value={defaultCategory}
                  onChangeText={handleDefaultCategoryChange}
                  returnKeyType="done"
                  blurOnSubmit={false}
                  autoCorrect={false}
                  suggestions={matchingCategories}
                  shouldShowSuggestions={!!defaultCategory.trim() && matchingCategories.length > 0}
                  onSelectSuggestion={(item) => {
                    setDefaultCategory(item?.cname || '')
                    setMatchingCategories([])
                    setErrorMsg('')
                  }}
                  onClose={closeCategorySuggestions}
                  getSuggestionLabel={(item) => item?.cname || ''}
                  maxVisibleItems={3}
                  suggestionRowHeight={50}
                />
              </View>

              <View style={styles.modalActionRow}>
                <ThemedButton
                  style={[styles.modalActionButton, styles.modalSaveButton]}
                  onPress={handleSave}
                >
                  <Text style={styles.modalActionText}>{saving ? 'Saving...' : 'Save'}</Text>
                </ThemedButton>

                <ThemedButton
                  style={[styles.modalActionButton, styles.modalCancelButton]}
                  onPress={handleAttemptClose}
                >
                  <Text style={styles.modalActionText}>Cancel</Text>
                </ThemedButton>
              </View>

              {!!errorMsg && <Text style={styles.modalErrorText}>{errorMsg}</Text>}
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const ViewTable = () => {
  const { debugDate, getCurrentDate } = useDateContext()
  const [tableMode, setTableMode] = useState('transactions')
  const [records, setRecords] = useState([])
  const [categoriesTableRows, setCategoriesTableRows] = useState([])
  const [recipientsTableRows, setRecipientsTableRows] = useState([])
  const [categoriesById, setCategoriesById] = useState({})
  const [recipientsById, setRecipientsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editingCategory, setEditingCategory] = useState(null)
  const [editingRecipient, setEditingRecipient] = useState(null)
  const [filterModalVisible, setFilterModalVisible] = useState(false)
  const [filterModalColumnKey, setFilterModalColumnKey] = useState('date')
  const [filterConfig, setFilterConfig] = useState(() => (
    RecordFilterConfig.from().build()
  ))
  const [sortConfig, setSortConfig] = useState(() => RecordSortConfig.byDate('desc').build())
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [pageInput, setPageInput] = useState('1')
  const [totalRecords, setTotalRecords] = useState(0)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState([])

  const isTransactionsMode = tableMode === 'transactions'
  const isCategoriesMode = tableMode === 'categories'
  const isRecipientsMode = tableMode === 'recipients'

  const selectedTableModeOption = useMemo(() => {
    return TABLE_MODE_OPTIONS.find((item) => item.key === tableMode) || TABLE_MODE_OPTIONS[0]
  }, [tableMode])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalRecords / rowsPerPage))
  }, [totalRecords, rowsPerPage])

  const isFirstPage = currentPage <= 1
  const isLastPage = currentPage >= totalPages

  const categoryOptions = useMemo(() => {
    return Object.entries(categoriesById)
      .map(([key, value]) => ({ key: String(key), value }))
      .filter((item) => item.value)
      .sort((left, right) => String(left.value).localeCompare(String(right.value)))
  }, [categoriesById])

  const recipientOptions = useMemo(() => {
    return Object.entries(recipientsById)
      .map(([key, value]) => ({ key: String(key), value }))
      .filter((item) => item.value)
      .sort((left, right) => String(left.value).localeCompare(String(right.value)))
  }, [recipientsById])

  const currentDate = useMemo(() => getCurrentDate(), [debugDate, getCurrentDate])

  const loadRecords = useCallback(async (
    nextFilterConfig = filterConfig,
    nextSortConfig = sortConfig,
    targetPage = currentPage,
    targetRowsPerPage = rowsPerPage,
  ) => {
    const safeRowsPerPage = normalizePageSize(targetRowsPerPage)
    const requestedPage = normalizePage(targetPage)

    try {
      setLoading(true)
      await initTables()
      const [count, categories, recipients] = await Promise.all([
        fetchRecordCountWithFilters(nextFilterConfig),
        fetchAllCategories(),
        fetchAllRecipients(),
      ])

      const safeTotalRecords = Number(count) || 0
      const safeTotalPages = Math.max(1, Math.ceil(safeTotalRecords / safeRowsPerPage))
      const finalPage = Math.min(requestedPage, safeTotalPages)
      const offset = (finalPage - 1) * safeRowsPerPage

      const pagedFilterConfig = RecordFilterConfig
        .from(nextFilterConfig)
        .withPagination(safeRowsPerPage, offset)
        .build()

      const rows = await fetchRecordsWithFilters(pagedFilterConfig, nextSortConfig)

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[item.cid] = item.cname || ''
        return acc
      }, {})

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[item.rid] = item.name || ''
        return acc
      }, {})

      setRecords(rows || [])
      setCategoriesById(categoryMap)
      setRecipientsById(recipientMap)
      setTotalRecords(safeTotalRecords)
      setRowsPerPage(safeRowsPerPage)
      setCurrentPage(finalPage)
      setPageInput(String(finalPage))
      setSelectedRecordIds([])
    } catch (e) {
      console.error('loadRecords failed', e)
      Alert.alert('Database error', 'Failed to load records.')
    } finally {
      setLoading(false)
    }
  }, [filterConfig, sortConfig, currentPage, rowsPerPage])

  const loadCategories = useCallback(async (
    targetPage = currentPage,
    targetRowsPerPage = rowsPerPage,
  ) => {
    const safeRowsPerPage = normalizePageSize(targetRowsPerPage)
    const requestedPage = normalizePage(targetPage)

    try {
      setLoading(true)
      await initTables()

      const [countRes, categories, recipients] = await Promise.all([
        executeSqlAsync('SELECT COUNT(*) AS total FROM category'),
        fetchAllCategories(),
        fetchAllRecipients(),
      ])

      const safeTotalRecords = Number(countRes?.rows?._array?.[0]?.total) || 0
      const safeTotalPages = Math.max(1, Math.ceil(safeTotalRecords / safeRowsPerPage))
      const finalPage = Math.min(requestedPage, safeTotalPages)
      const offset = (finalPage - 1) * safeRowsPerPage

      const rows = await executeSqlAsync(
        `SELECT c.cid, c.cname, COUNT(r.tid) AS transactionCount
         FROM category c
         LEFT JOIN record r ON r.cid = c.cid
         GROUP BY c.cid, c.cname
         ORDER BY LOWER(COALESCE(c.cname, '')) ASC, c.cid ASC
         LIMIT ? OFFSET ?`,
        [safeRowsPerPage, offset]
      )

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[item.cid] = item.cname || ''
        return acc
      }, {})

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[item.rid] = item.name || ''
        return acc
      }, {})

      setCategoriesTableRows(rows?.rows?._array || [])
      setCategoriesById(categoryMap)
      setRecipientsById(recipientMap)
      setTotalRecords(safeTotalRecords)
      setRowsPerPage(safeRowsPerPage)
      setCurrentPage(finalPage)
      setPageInput(String(finalPage))
    } catch (e) {
      console.error('loadCategories failed', e)
      Alert.alert('Database error', 'Failed to load categories.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, rowsPerPage])

  const loadRecipients = useCallback(async (
    targetPage = currentPage,
    targetRowsPerPage = rowsPerPage,
  ) => {
    const safeRowsPerPage = normalizePageSize(targetRowsPerPage)
    const requestedPage = normalizePage(targetPage)

    try {
      setLoading(true)
      await initTables()

      const [countRes, categories, recipients] = await Promise.all([
        executeSqlAsync('SELECT COUNT(*) AS total FROM recipient'),
        fetchAllCategories(),
        fetchAllRecipients(),
      ])

      const safeTotalRecords = Number(countRes?.rows?._array?.[0]?.total) || 0
      const safeTotalPages = Math.max(1, Math.ceil(safeTotalRecords / safeRowsPerPage))
      const finalPage = Math.min(requestedPage, safeTotalPages)
      const offset = (finalPage - 1) * safeRowsPerPage

      const rows = await executeSqlAsync(
        `SELECT re.rid, re.name, re.cid, COALESCE(c.cname, '') AS defaultCategory, COUNT(r.tid) AS transactionCount
         FROM recipient re
         LEFT JOIN category c ON c.cid = re.cid
         LEFT JOIN record r ON r.rid = re.rid
         GROUP BY re.rid, re.name, re.cid, c.cname
         ORDER BY LOWER(COALESCE(re.name, '')) ASC, re.rid ASC
         LIMIT ? OFFSET ?`,
        [safeRowsPerPage, offset]
      )

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[item.cid] = item.cname || ''
        return acc
      }, {})

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[item.rid] = item.name || ''
        return acc
      }, {})

      setRecipientsTableRows(rows?.rows?._array || [])
      setCategoriesById(categoryMap)
      setRecipientsById(recipientMap)
      setTotalRecords(safeTotalRecords)
      setRowsPerPage(safeRowsPerPage)
      setCurrentPage(finalPage)
      setPageInput(String(finalPage))
    } catch (e) {
      console.error('loadRecipients failed', e)
      Alert.alert('Database error', 'Failed to load recipients.')
    } finally {
      setLoading(false)
    }
  }, [currentPage, rowsPerPage])

  useFocusEffect(
    useCallback(() => {
      if (isCategoriesMode) {
        loadCategories()
        return
      }

      if (isRecipientsMode) {
        loadRecipients()
        return
      }

      loadRecords()
    }, [isCategoriesMode, isRecipientsMode, loadRecords, loadCategories, loadRecipients])
  )

  useEffect(() => {
    if (!selectMode && selectedRecordIds.length > 0) {
      setSelectedRecordIds([])
    }
  }, [selectMode, selectedRecordIds.length])

  useEffect(() => {
    if (isTransactionsMode) return
    if (!selectMode && selectedRecordIds.length === 0) return

    setSelectMode(false)
    setSelectedRecordIds([])
  }, [isTransactionsMode, selectMode, selectedRecordIds.length])

  const handleTableModeChange = useCallback((value) => {
    const normalized = ['transactions', 'categories', 'recipients'].includes(value)
      ? value
      : 'transactions'

    setTableMode(normalized)
    setFilterModalVisible(false)
    setEditingRecord(null)
    setEditingCategory(null)
    setEditingRecipient(null)
    setCurrentPage(1)
    setPageInput('1')
  }, [])

  const handleDelete = useCallback((tid) => {
    Alert.alert('Delete record', `Delete record #${tid}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecord(tid)
            await loadRecords()
          } catch (e) {
            console.error('deleteRecord failed', e)
            Alert.alert('Delete failed', String(e))
          }
        }
      }
    ])
  }, [loadRecords])

  const handleUpdate = useCallback((tid) => {
    const row = records.find((item) => item.tid === tid)
    if (!row) {
      Alert.alert('Update failed', `Record #${tid} was not found.`)
      return
    }

    setEditingRecord(row)
  }, [records])

  const handleCloseUpdateModal = useCallback(() => {
    setEditingRecord(null)
  }, [])

  const handleUpdateCategory = useCallback((cid) => {
    const row = categoriesTableRows.find((item) => item.cid === cid)
    if (!row) {
      Alert.alert('Update failed', 'Category was not found.')
      return
    }

    setEditingCategory(row)
  }, [categoriesTableRows])

  const handleDeleteCategory = useCallback((cid) => {
    Alert.alert('Delete category', 'Delete this category and its related data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(cid)
            await loadCategories()
          } catch (e) {
            console.error('deleteCategory failed', e)
            Alert.alert('Delete failed', String(e))
          }
        },
      },
    ])
  }, [loadCategories])

  const handleSaveCategoryUpdate = useCallback(async (payload) => {
    const trimmedName = String(payload?.name || '').trim()
    if (!payload?.cid || !trimmedName) {
      throw new Error('Invalid category update payload.')
    }

    const duplicate = await executeSqlAsync(
      `SELECT cid
       FROM category
       WHERE LOWER(cname) = LOWER(?) AND cid <> ?
       LIMIT 1`,
      [trimmedName, payload.cid]
    )

    if (duplicate?.rows?._array?.length) {
      throw new Error('Category name already exists.')
    }

    await updateCategory(payload.cid, trimmedName)
    await loadCategories()
    setEditingCategory(null)
  }, [loadCategories])

  const handleUpdateRecipient = useCallback((rid) => {
    const row = recipientsTableRows.find((item) => item.rid === rid)
    if (!row) {
      Alert.alert('Update failed', 'Recipient was not found.')
      return
    }

    setEditingRecipient(row)
  }, [recipientsTableRows])

  const handleDeleteRecipient = useCallback((rid) => {
    Alert.alert('Delete recipient', 'Delete this recipient and its related transactions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecipient(rid)
            await loadRecipients()
          } catch (e) {
            console.error('deleteRecipient failed', e)
            Alert.alert('Delete failed', String(e))
          }
        },
      },
    ])
  }, [loadRecipients])

  const handleSaveRecipientUpdate = useCallback(async (payload) => {
    const trimmedName = String(payload?.name || '').trim()
    if (!payload?.rid || !trimmedName) {
      throw new Error('Invalid recipient update payload.')
    }

    const duplicate = await executeSqlAsync(
      `SELECT rid
       FROM recipient
       WHERE LOWER(name) = LOWER(?) AND rid <> ?
       LIMIT 1`,
      [trimmedName, payload.rid]
    )

    if (duplicate?.rows?._array?.length) {
      throw new Error('Recipient name already exists.')
    }

    await updateRecipient(payload.rid, trimmedName, payload.defaultCategoryCid ?? null)
    await loadRecipients()
    setEditingRecipient(null)
  }, [loadRecipients])

  const handleOpenFilterModal = useCallback((columnKey) => {
    setFilterModalColumnKey(columnKey)
    setFilterModalVisible(true)
  }, [])

  const handleCloseFilterModal = useCallback(() => {
    setFilterModalVisible(false)
  }, [])

  const handleApplyFilterConfig = useCallback(async (nextConfig) => {
    const source = nextConfig || {}
    const nextSortConfig = RecordSortConfig.from(source.sort).build()
    const nextFilterConfig = RecordFilterConfig
      .from(source)
      .withPagination(null, 0)
      .build()

    setFilterConfig(nextFilterConfig)
    setSortConfig(nextSortConfig)
    setCurrentPage(1)
    setPageInput('1')
    setFilterModalVisible(false)
    await loadRecords(nextFilterConfig, nextSortConfig, 1, rowsPerPage)
  }, [loadRecords, rowsPerPage])

  const handleSaveUpdate = useCallback(async (payload) => {
    const normalizedCurrency = String(payload.currency || APP_BASE_CURRENCY).trim().toUpperCase()
    const fx = await convertToBaseAmount({
      amount: payload.amount,
      fromCurrency: normalizedCurrency,
      quoteCurrency: APP_BASE_CURRENCY,
      date: payload.date,
    })

    await updateRecord(payload.tid, {
      amount: payload.amount,
      amount_base: fx.amountBase,
      fx_rate_to_base: fx.fxRateToBase,
      fx_base_currency: fx.fxBaseCurrency,
      fx_quote_currency: fx.fxQuoteCurrency,
      fx_rate_date: fx.fxRateDate,
      fx_provider: fx.fxProvider,
      cname: payload.category,
      rname: payload.recipient,
      date: payload.date,
      type: payload.type,
      currency: normalizedCurrency,
      description: payload.description,
      inputdatetime: new Date().toISOString(),
    })

    await loadRecords()
    setEditingRecord(null)
  }, [loadRecords])

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => !prev)
  }, [])

  const toggleRecordSelected = useCallback((tid) => {
    setSelectedRecordIds((prev) => {
      if (prev.includes(tid)) {
        return prev.filter((id) => id !== tid)
      }

      return [...prev, tid]
    })
  }, [])

  const isRecordSelected = useCallback((tid) => selectedRecordIds.includes(tid), [selectedRecordIds])

  const handleDeleteSelected = useCallback(() => {
    if (selectedRecordIds.length === 0) return

    Alert.alert(
      'Delete selected records',
      `Delete ${selectedRecordIds.length} selected record${selectedRecordIds.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const tid of selectedRecordIds) {
                await deleteRecord(tid)
              }

              setSelectedRecordIds([])
              await loadRecords()
            } catch (e) {
              console.error('bulk delete failed', e)
              Alert.alert('Delete failed', String(e))
            }
          },
        },
      ]
    )
  }, [selectedRecordIds, loadRecords])

  const navigateToPage = useCallback(async (nextPage) => {
    const normalized = normalizePage(nextPage)
    const bounded = Math.min(normalized, totalPages)
    setCurrentPage(bounded)
    setPageInput(String(bounded))

    if (isCategoriesMode) {
      await loadCategories(bounded, rowsPerPage)
      return
    }

    if (isRecipientsMode) {
      await loadRecipients(bounded, rowsPerPage)
      return
    }

    await loadRecords(filterConfig, sortConfig, bounded, rowsPerPage)
  }, [loadRecords, loadCategories, loadRecipients, filterConfig, sortConfig, rowsPerPage, totalPages, isCategoriesMode, isRecipientsMode])

  const handlePageInputSubmit = useCallback(async () => {
    const numericInput = pageInput.trim() === '' ? 1 : normalizePage(pageInput)
    const bounded = Math.min(numericInput, totalPages)
    setPageInput(String(bounded))
    await navigateToPage(bounded)
  }, [pageInput, totalPages, navigateToPage])

  const handleRowsPerPageChange = useCallback(async (value) => {
    const nextRowsPerPage = normalizePageSize(value)
    setRowsPerPage(nextRowsPerPage)
    setCurrentPage(1)
    setPageInput('1')

    if (isCategoriesMode) {
      await loadCategories(1, nextRowsPerPage)
      return
    }

    if (isRecipientsMode) {
      await loadRecipients(1, nextRowsPerPage)
      return
    }

    await loadRecords(filterConfig, sortConfig, 1, nextRowsPerPage)
  }, [loadRecords, loadCategories, loadRecipients, filterConfig, sortConfig, isCategoriesMode, isRecipientsMode])

  const getCellValue = useCallback((row, columnKey) => {
    if (columnKey === 'category') return categoriesById[row.cid] ?? ''
    if (columnKey === 'recipient') return recipientsById[row.rid] ?? ''
    return row[columnKey] ?? ''
  }, [categoriesById, recipientsById])

  const getAmountDisplay = useCallback((row) => {
    const amount = row.amount ?? ''
    const type = String(row.type ?? '').toLowerCase()

    if (type === 'spending') return `-${amount}`
    if (type === 'income') return `+${amount}`
    return String(amount)
  }, [])

  const getAmountColor = useCallback((row) => {
    const type = String(row.type ?? '').toLowerCase()

    if (type === 'spending') return Colors.expense
    if (type === 'income') return Colors.income
    return undefined
  }, [])

  const transactionTableWidth = RECORD_COLUMNS.reduce((sum, col) => sum + col.width, 0) + (selectMode ? SELECT_COLUMN.width : 0) + (selectMode ? 0 : UPDATE_ACTION_COLUMN.width + DELETE_ACTION_COLUMN.width)
  const categoryTableWidth = CATEGORY_COLUMNS.reduce((sum, col) => sum + col.width, 0) + UPDATE_ACTION_COLUMN.width + DELETE_ACTION_COLUMN.width
  const recipientTableWidth = RECIPIENT_COLUMNS.reduce((sum, col) => sum + col.width, 0) + UPDATE_ACTION_COLUMN.width + DELETE_ACTION_COLUMN.width

  return (
    <ThemedView style={styles.container} safe={true}>
      <View style={styles.headerBar}>
        <View style={styles.tableModeSelectWrap}>
          <ThemedSelectList
            key={`table-mode-${tableMode}`}
            setSelected={handleTableModeChange}
            data={TABLE_MODE_OPTIONS}
            floating={true}
            save="key"
            defaultOption={selectedTableModeOption}
            search={false}
            boxStyles={styles.tableModeSelectBox}
            inputStyles={styles.tableModeSelectInput}
          />
        </View>

        <View style={styles.headerActionsWrap}>
          {isTransactionsMode && selectMode && selectedRecordIds.length > 0 && (
            <ThemedButton style={styles.bulkDeleteButton} onPress={handleDeleteSelected}>
              <Text style={styles.bulkDeleteButtonText}>Delete ({selectedRecordIds.length})</Text>
            </ThemedButton>
          )}

          {isTransactionsMode && !selectMode && (
            <CsvDownloader />
          )}

          {isTransactionsMode && (
            <ThemedButton style={styles.selectModeButton} onPress={toggleSelectMode}>
              <Text style={styles.selectModeButtonText}>{selectMode ? 'Exit Select' : 'Select'}</Text>
            </ThemedButton>
          )}
        </View>
      </View>

      <UpdateRecordModal
        visible={!!editingRecord}
        record={editingRecord}
        categoriesById={categoriesById}
        recipientsById={recipientsById}
        onClose={handleCloseUpdateModal}
        onSave={handleSaveUpdate}
      />

      <UpdateCategoryModal
        visible={!!editingCategory}
        category={editingCategory}
        onClose={() => setEditingCategory(null)}
        onSave={handleSaveCategoryUpdate}
      />

      <UpdateRecipientModal
        visible={!!editingRecipient}
        recipient={editingRecipient}
        onClose={() => setEditingRecipient(null)}
        onSave={handleSaveRecipientUpdate}
      />

      <RecordsFilterModal
        visible={isTransactionsMode && filterModalVisible}
        activeColumnKey={filterModalColumnKey}
        initialConfig={{ ...filterConfig, sort: sortConfig }}
        defaultDate={currentDate}
        categoryOptions={categoryOptions}
        recipientOptions={recipientOptions}
        onClose={handleCloseFilterModal}
        onApply={handleApplyFilterConfig}
      />

      {loading ? (
        <Text style={styles.statusText}>Loading data...</Text>
      ) : isTransactionsMode && records.length === 0 ? (
        <Text style={styles.statusText}>No transactions yet.</Text>
      ) : isCategoriesMode && categoriesTableRows.length === 0 ? (
        <Text style={styles.statusText}>No categories yet.</Text>
      ) : isRecipientsMode && recipientsTableRows.length === 0 ? (
        <Text style={styles.statusText}>No recipients yet.</Text>
      ) : (
        <ScrollView style={styles.verticalScroll} contentContainerStyle={styles.verticalContent}>
          {isTransactionsMode && (
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
              <View style={[styles.table, { width: transactionTableWidth }]}> 
                <View style={[styles.row, styles.headerRow]}>
                  {selectMode && (
                    <Text style={[styles.cell, styles.headerCell, styles.selectCell, { width: SELECT_COLUMN.width, minWidth: SELECT_COLUMN.width, maxWidth: SELECT_COLUMN.maxWidth }]}>select</Text>
                  )}
                  {RECORD_COLUMNS.map((col) => (
                    <Pressable
                      key={col.key}
                      style={[styles.cell, styles.headerCell, styles.headerButton, { width: col.width, minWidth: col.width, maxWidth: col.maxWidth }]}
                      onPress={() => handleOpenFilterModal(col.key)}
                    >
                      <Text style={styles.headerButtonText}>{col.key}</Text>
                    </Pressable>
                  ))}
                  {!selectMode && (
                    <>
                      <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}>update</Text>
                      <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}>delete</Text>
                    </>
                  )}
                </View>

                {records.map((row, index) => (
                  <View key={row.tid ?? index} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                    {selectMode && (
                      <View style={[styles.cell, styles.selectCell, { width: SELECT_COLUMN.width, minWidth: SELECT_COLUMN.width, maxWidth: SELECT_COLUMN.maxWidth }]}> 
                        <Pressable
                          style={[styles.checkbox, isRecordSelected(row.tid) && styles.checkboxChecked]}
                          onPress={() => toggleRecordSelected(row.tid)}
                          hitSlop={8}
                        >
                          {isRecordSelected(row.tid) && <View style={styles.checkboxInner} />}
                        </Pressable>
                      </View>
                    )}

                    {RECORD_COLUMNS.map((col) => (
                      <Text
                        key={`${row.tid ?? index}-${col.key}`}
                        style={[
                          styles.cell,
                          { width: col.width, minWidth: col.width, maxWidth: col.maxWidth },
                          col.key === 'amount' && { color: getAmountColor(row) }
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {col.key === 'amount' ? getAmountDisplay(row) : String(getCellValue(row, col.key))}
                      </Text>
                    ))}

                    {!selectMode && (
                      <>
                        <View style={[styles.cell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}> 
                          <Pressable style={[styles.actionButton, styles.updateButton]} onPress={() => handleUpdate(row.tid)}>
                            <Text style={styles.actionText}>Update</Text>
                          </Pressable>
                        </View>

                        <View style={[styles.cell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}> 
                          <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(row.tid)}>
                            <Text style={styles.actionText}>Delete</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {isCategoriesMode && (
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
              <View style={[styles.table, { width: categoryTableWidth }]}> 
                <View style={[styles.row, styles.headerRow]}>
                  {CATEGORY_COLUMNS.map((col) => (
                    <Text
                      key={col.key}
                      style={[styles.cell, styles.headerCell, { width: col.width, minWidth: col.width, maxWidth: col.maxWidth }]}
                    >
                      {col.label}
                    </Text>
                  ))}
                  <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}>update</Text>
                  <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}>delete</Text>
                </View>

                {categoriesTableRows.map((row, index) => (
                  <View key={row.cid ?? index} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                    <Text style={[styles.cell, { width: CATEGORY_COLUMNS[0].width, minWidth: CATEGORY_COLUMNS[0].width, maxWidth: CATEGORY_COLUMNS[0].maxWidth }]} numberOfLines={2} ellipsizeMode="tail">
                      {String(row.cname || '')}
                    </Text>
                    <Text style={[styles.cell, { width: CATEGORY_COLUMNS[1].width, minWidth: CATEGORY_COLUMNS[1].width, maxWidth: CATEGORY_COLUMNS[1].maxWidth }]}>
                      {String(Number(row.transactionCount) || 0)}
                    </Text>

                    <View style={[styles.cell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}> 
                      <Pressable style={[styles.actionButton, styles.updateButton]} onPress={() => handleUpdateCategory(row.cid)}>
                        <Text style={styles.actionText}>Update</Text>
                      </Pressable>
                    </View>

                    <View style={[styles.cell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}> 
                      <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteCategory(row.cid)}>
                        <Text style={styles.actionText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {isRecipientsMode && (
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
              <View style={[styles.table, { width: recipientTableWidth }]}> 
                <View style={[styles.row, styles.headerRow]}>
                  {RECIPIENT_COLUMNS.map((col) => (
                    <Text
                      key={col.key}
                      style={[styles.cell, styles.headerCell, { width: col.width, minWidth: col.width, maxWidth: col.maxWidth }]}
                    >
                      {col.label}
                    </Text>
                  ))}
                  <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}>update</Text>
                  <Text style={[styles.cell, styles.headerCell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}>delete</Text>
                </View>

                {recipientsTableRows.map((row, index) => (
                  <View key={row.rid ?? index} style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
                    <Text style={[styles.cell, { width: RECIPIENT_COLUMNS[0].width, minWidth: RECIPIENT_COLUMNS[0].width, maxWidth: RECIPIENT_COLUMNS[0].maxWidth }]} numberOfLines={2} ellipsizeMode="tail">
                      {String(row.name || '')}
                    </Text>
                    <Text style={[styles.cell, { width: RECIPIENT_COLUMNS[1].width, minWidth: RECIPIENT_COLUMNS[1].width, maxWidth: RECIPIENT_COLUMNS[1].maxWidth }]}>
                      {String(Number(row.transactionCount) || 0)}
                    </Text>
                    <Text style={[styles.cell, { width: RECIPIENT_COLUMNS[2].width, minWidth: RECIPIENT_COLUMNS[2].width, maxWidth: RECIPIENT_COLUMNS[2].maxWidth }]} numberOfLines={2} ellipsizeMode="tail">
                      {String(row.defaultCategory || '')}
                    </Text>

                    <View style={[styles.cell, styles.actionCell, { width: UPDATE_ACTION_COLUMN.width, minWidth: UPDATE_ACTION_COLUMN.width, maxWidth: UPDATE_ACTION_COLUMN.maxWidth }]}> 
                      <Pressable style={[styles.actionButton, styles.updateButton]} onPress={() => handleUpdateRecipient(row.rid)}>
                        <Text style={styles.actionText}>Update</Text>
                      </Pressable>
                    </View>

                    <View style={[styles.cell, styles.actionCell, { width: DELETE_ACTION_COLUMN.width, minWidth: DELETE_ACTION_COLUMN.width, maxWidth: DELETE_ACTION_COLUMN.maxWidth }]}> 
                      <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteRecipient(row.rid)}>
                        <Text style={styles.actionText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}

      <View style={styles.paginationBar}>
        <Pressable
          style={[styles.pageButton, isFirstPage && styles.pageButtonDisabled]}
          onPress={() => navigateToPage(1)}
          disabled={isFirstPage || loading}
        >
          <Text style={styles.pageButtonText}>{'<<'}</Text>
        </Pressable>

        <Pressable
          style={[styles.pageButton, isFirstPage && styles.pageButtonDisabled]}
          onPress={() => navigateToPage(currentPage - 1)}
          disabled={isFirstPage || loading}
        >
          <Text style={styles.pageButtonText}>{'<'}</Text>
        </Pressable>

        <ThemedTextInput
          style={styles.pageInput}
          keyboardType="number-pad"
          value={pageInput}
          onChangeText={(value) => setPageInput(String(value || '').replace(/[^0-9]/g, ''))}
          onSubmitEditing={handlePageInputSubmit}
          onBlur={handlePageInputSubmit}
          returnKeyType="done"
        />

        <Pressable
          style={[styles.pageButton, isLastPage && styles.pageButtonDisabled]}
          onPress={() => navigateToPage(currentPage + 1)}
          disabled={isLastPage || loading}
        >
          <Text style={styles.pageButtonText}>{'>'}</Text>
        </Pressable>

        <Pressable
          style={[styles.pageButton, isLastPage && styles.pageButtonDisabled]}
          onPress={() => navigateToPage(totalPages)}
          disabled={isLastPage || loading}
        >
          <Text style={styles.pageButtonText}>{'>>'}</Text>
        </Pressable>

        <View style={styles.pageSizeSelectWrap}>
          <ThemedSelectList
            key={`rows-${rowsPerPage}`}
            data={PAGE_SIZE_OPTIONS}
            setSelected={handleRowsPerPageChange}
            save="key"
            search={false}
            defaultOption={{ key: String(rowsPerPage), value: `${rowsPerPage}/page` }}
            style={styles.rowsPerPageInput}
            // dropdownStyles={{top: -150}}
            // floating={true}
          />
        </View>
      </View>
    </ThemedView>

  )
}

export default ViewTable

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tableModeSelectWrap: {
    width: 140,
    zIndex: 600,
    elevation: 600,
  },
  tableModeSelectBox: {
    minHeight: 44,
  },
  tableModeSelectInput: {
    fontWeight: '700',
  },
  headerActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  selectModeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectModeButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  bulkActionRow: {
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  bulkDeleteButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bulkDeleteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  paginationBar: { 
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#d0d0d0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // columnGap: 10,
  },
  pageNavSection: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    flexShrink: 1,
  },
  pageButton: {
    minWidth: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.45,
  },
  pageButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  pageInput: {
    width: 40,
    textAlign: 'center',
    minWidth: 40,
    padding: 10
  },
  rowsPerPageInput: {
    width: 40, 
    textAlign: "center", 
    minWidth: 40, 
    padding: 10
  }, 
  pageMetaText: {
    fontSize: 14,
    marginLeft: 2,
  },
  pageSizeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 8,
  },
  pageSizeLabel: {
    fontSize: 14,
  },
  pageSizeSelectWrap: {
    minWidth: 50
  },
  verticalScroll: {
    flex: 1,
  },
  verticalContent: {
    paddingBottom: 20,
  },
  horizontalContent: {
    paddingRight: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    backgroundColor: Colors.primary,
  },
  evenRow: {
    backgroundColor: '#ffffff',
  },
  oddRow: {
    backgroundColor: '#f5f7fa',
  },
  cell: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d0d0d0',
  },
  headerCell: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  headerButton: {
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#fff',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  selectCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  updateButton: {
    backgroundColor: '#2e7d32',
  },
  deleteButton: {
    backgroundColor: '#c62828',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
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
    width: '100%',
    maxWidth: 720,
    maxHeight: '100%',
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
  modalFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    columnGap: 10,
  },
  modalTypeRow: {
    zIndex: 300,
    elevation: 300,
  },
  modalTypeDropdown: {
    zIndex: 400,
    elevation: 400,
  },
  modalCurrencyRow: {
    width: "100%"
  },
  modalCurrencyDropdown: {
    zIndex: 300,
    elevation: 300,
    maxHeight: 180,
  },
  modalFieldName: {
    width: 100,
    flexShrink: 0,
    fontSize: 18,
    textAlign: 'right',
  },
  modalAutocompleteWrap: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  modalTextInput: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  modalMultiline: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
    height: 100,
  },
  dateButtonText: {
    color: '#fff',
  },
  modalActionRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  modalActionButton: {
    justifyContent: 'center',
    width: 150,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
  },
  modalCancelButton: {
    backgroundColor: Colors.warning,
  },
  modalActionText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
  },
  modalErrorText: {
    color: Colors.warning,
    width: '100%',
    textAlign: 'center',
    marginTop: 10,
  },
})