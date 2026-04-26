import React, { useEffect, useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'

import { Colors } from '../constants/Colors'
import ThemedButton from './ThemedButton'
import ThemedSelectList from './ThemedSelectList'
import ThemedText from './ThemedText'
import ThemedTextInput from './ThemedTextInput'
import ThemedView from './ThemedView'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SORT_COLUMNS = [
  { key: 'date', label: 'Date', direction: 'desc', enabled: true },
  { key: 'amount', label: 'Amount', direction: 'desc', enabled: false },
  { key: 'category', label: 'Category', direction: 'asc', enabled: false },
  { key: 'recipient', label: 'Recipient', direction: 'asc', enabled: false },
]

const toDateStringValue = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('en-CA')
  }

  return ''
}

const parseDateValue = (value) => {
  const parsed = value ? new Date(value) : new Date()
  if (Number.isNaN(parsed.getTime())) return new Date()
  return parsed
}

const defaultFilterState = () => ({
  date: {
    mode: 'all',
    before: '',
    after: '',
    betweenStart: '',
    betweenEnd: '',
  },
  amount: {
    type: 'all',
    rangeMode: 'all',
    min: '',
    max: '',
  },
  category: {
    selectedCandidateId: '',
    includeIds: [],
    excludeIds: [],
  },
  recipient: {
    selectedCandidateId: '',
    includeIds: [],
    excludeIds: [],
  },
  sortKey: 'date',
  sortDirection: 'desc',
})

const normalizeIds = (values) => Array.from(new Set((values || []).map((value) => String(value)).filter(Boolean)))

const RecordsFilterModal = ({
  visible,
  activeColumnKey,
  initialConfig,
  categoryOptions = [],
  recipientOptions = [],
  onClose,
  onApply,
}) => {
  const [filterState, setFilterState] = useState(defaultFilterState())
  const [activeDatePicker, setActiveDatePicker] = useState(null)
  const [modalResetKey, setModalResetKey] = useState(0)

  const insets = useSafeAreaInsets();

  const categoryLabelById = useMemo(() => {
    return (categoryOptions || []).reduce((acc, item) => {
      acc[String(item.key)] = item.value
      return acc
    }, {})
  }, [categoryOptions])

  const recipientLabelById = useMemo(() => {
    return (recipientOptions || []).reduce((acc, item) => {
      acc[String(item.key)] = item.value
      return acc
    }, {})
  }, [recipientOptions])

  useEffect(() => {
    if (!visible) return

    const source = initialConfig || {}
    const next = defaultFilterState()

    next.date = {
      ...next.date,
      ...(source.date || {}),
      before: source.date?.before || '',
      after: source.date?.after || '',
      betweenStart: source.date?.betweenStart || '',
      betweenEnd: source.date?.betweenEnd || '',
    }
    next.amount = {
      ...next.amount,
      ...(source.amount || {}),
      min: source.amount?.min || '',
      max: source.amount?.max || '',
    }
    next.category = {
      ...next.category,
      ...(source.category || {}),
      selectedCandidateId: source.category?.selectedCandidateId || '',
      includeIds: normalizeIds(source.category?.includeIds),
      excludeIds: normalizeIds(source.category?.excludeIds),
    }
    next.recipient = {
      ...next.recipient,
      ...(source.recipient || {}),
      selectedCandidateId: source.recipient?.selectedCandidateId || '',
      includeIds: normalizeIds(source.recipient?.includeIds),
      excludeIds: normalizeIds(source.recipient?.excludeIds),
    }

    if (Array.isArray(source.sort) && source.sort.length > 0) {
      const firstSort = source.sort[0]
      const normalizedKey = String(firstSort?.key || 'date')
      const allowedKeys = SORT_COLUMNS.map((item) => item.key)
      next.sortKey = allowedKeys.includes(normalizedKey) ? normalizedKey : 'date'
      next.sortDirection = firstSort?.direction === 'asc' ? 'asc' : 'desc'
    }

    setFilterState(next)
    setActiveDatePicker(null)
    setModalResetKey((prev) => prev + 1)
  }, [visible, initialConfig])

  const focusedTitle = useMemo(() => {
    const found = SORT_COLUMNS.find((item) => item.key === activeColumnKey)
    return found?.label || String(activeColumnKey || 'Records')
  }, [activeColumnKey])

  const setSortKey = (key) => {
    setFilterState((prev) => ({
      ...prev,
      sortKey: key,
    }))
  }

  const setSortDirection = (direction) => {
    setFilterState((prev) => ({
      ...prev,
      sortDirection: direction,
    }))
  }

  const updateDateField = (field, value) => {
    setFilterState((prev) => ({
      ...prev,
      date: {
        ...prev.date,
        [field]: value,
      },
    }))
  }

  const updateAmountField = (field, value) => {
    let nextValue = String(value || '')
    if (field === 'min' || field === 'max') {
      nextValue = nextValue.replace(/[^0-9.]/g, '')
      const firstDotIndex = nextValue.indexOf('.')
      if (firstDotIndex !== -1) {
        nextValue = nextValue.slice(0, firstDotIndex + 1) + nextValue.slice(firstDotIndex + 1).replace(/\./g, '')
      }
      if (nextValue.startsWith('.')) {
        nextValue = `0${nextValue}`
      }
    }

    setFilterState((prev) => ({
      ...prev,
      amount: {
        ...prev.amount,
        [field]: nextValue,
      },
    }))
  }

  const addCategoryChoice = (mode) => {
    setFilterState((prev) => {
      const candidateId = String(prev.category.selectedCandidateId || '')
      if (!candidateId) return prev

      const includeIds = new Set(prev.category.includeIds)
      const excludeIds = new Set(prev.category.excludeIds)
      if (mode === 'include') {
        includeIds.add(candidateId)
        excludeIds.delete(candidateId)
      } else {
        excludeIds.add(candidateId)
        includeIds.delete(candidateId)
      }

      return {
        ...prev,
        category: {
          ...prev.category,
          includeIds: Array.from(includeIds),
          excludeIds: Array.from(excludeIds),
        },
      }
    })
  }

  const addRecipientChoice = (mode) => {
    setFilterState((prev) => {
      const candidateId = String(prev.recipient.selectedCandidateId || '')
      if (!candidateId) return prev

      const includeIds = new Set(prev.recipient.includeIds)
      const excludeIds = new Set(prev.recipient.excludeIds)
      if (mode === 'include') {
        includeIds.add(candidateId)
        excludeIds.delete(candidateId)
      } else {
        excludeIds.add(candidateId)
        includeIds.delete(candidateId)
      }

      return {
        ...prev,
        recipient: {
          ...prev.recipient,
          includeIds: Array.from(includeIds),
          excludeIds: Array.from(excludeIds),
        },
      }
    })
  }

  const setAllCategories = (mode) => {
    const ids = (categoryOptions || []).map((item) => String(item.key))
    setFilterState((prev) => ({
      ...prev,
      category: {
        ...prev.category,
        includeIds: mode === 'include' ? ids : [],
        excludeIds: mode === 'exclude' ? ids : [],
      },
    }))
  }

  const setAllRecipients = (mode) => {
    const ids = (recipientOptions || []).map((item) => String(item.key))
    setFilterState((prev) => ({
      ...prev,
      recipient: {
        ...prev.recipient,
        includeIds: mode === 'include' ? ids : [],
        excludeIds: mode === 'exclude' ? ids : [],
      },
    }))
  }

  const removeCategoryId = (id, mode) => {
    setFilterState((prev) => ({
      ...prev,
      category: {
        ...prev.category,
        includeIds: mode === 'include' ? prev.category.includeIds.filter((value) => value !== id) : prev.category.includeIds,
        excludeIds: mode === 'exclude' ? prev.category.excludeIds.filter((value) => value !== id) : prev.category.excludeIds,
      },
    }))
  }

  const removeRecipientId = (id, mode) => {
    setFilterState((prev) => ({
      ...prev,
      recipient: {
        ...prev.recipient,
        includeIds: mode === 'include' ? prev.recipient.includeIds.filter((value) => value !== id) : prev.recipient.includeIds,
        excludeIds: mode === 'exclude' ? prev.recipient.excludeIds.filter((value) => value !== id) : prev.recipient.excludeIds,
      },
    }))
  }

  const clearAll = () => {
    setFilterState(defaultFilterState())
    setActiveDatePicker(null)
    setModalResetKey((prev) => prev + 1)
  }

  const apply = () => {
    const normalizedSortKey = SORT_COLUMNS.some((item) => item.key === filterState.sortKey)
      ? filterState.sortKey
      : 'date'
    const normalizedDirection = filterState.sortDirection === 'asc' ? 'asc' : 'desc'

    onApply?.({
      date: filterState.date,
      amount: filterState.amount,
      category: filterState.category,
      recipient: filterState.recipient,
      sort: [{ key: normalizedSortKey, direction: normalizedDirection }],
    })
  }

  const renderDatePicker = (field) => {
    const currentValue = parseDateValue(filterState.date[field])
    return (
      <DateTimePicker
        key={`${field}-${modalResetKey}`}
        value={currentValue}
        mode="date"
        onChange={(event, selectedDate) => {
          if (event?.type === 'dismissed') {
            setActiveDatePicker(null)
            return
          }

          if (selectedDate) {
            updateDateField(field, toDateStringValue(selectedDate))
          }

          if (Platform.OS === 'android') {
            setActiveDatePicker(null)
          }
        }}
      />
    )
  }

  const selectedCategoryCandidateLabel = categoryLabelById[String(filterState.category.selectedCandidateId || '')] || ''
  const selectedRecipientCandidateLabel = recipientLabelById[String(filterState.recipient.selectedCandidateId || '')] || ''

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ThemedView style={[styles.card, { marginTop: insets.top }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <ThemedText style={styles.title}>Filtering and Sorting</ThemedText>
                {/* <Text style={styles.subtitle}>Focused column: {focusedTitle}</Text> */}
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Date</ThemedText>
                <View style={styles.optionRow}>
                  {[
                    ['all', 'All'],
                    ['before', 'Before'],
                    ['after', 'After'],
                    ['between', 'Between'],
                  ].map(([value, label]) => (
                    <ThemedButton
                      key={value}
                      style={[styles.optionButton, filterState.date.mode === value && styles.optionButtonActive]}
                      onPress={() => updateDateField('mode', value)}
                    >
                      <Text style={[styles.optionButtonText, filterState.date.mode === value && styles.optionButtonTextActive]}>{label}</Text>
                    </ThemedButton>
                  ))}
                </View>

                {filterState.date.mode === 'before' && (
                  <View style={styles.inlineRow}>
                    <ThemedText style={styles.fieldLabel}>Date:</ThemedText>
                    <ThemedButton onPress={() => setActiveDatePicker('before')}>
                      <Text style={styles.buttonValueText}>{filterState.date.before || 'Choose date'}</Text>
                    </ThemedButton>
                    {activeDatePicker === 'before' && renderDatePicker('before')}
                  </View>
                )}

                {filterState.date.mode === 'after' && (
                  <View style={styles.inlineRow}>
                    <ThemedText style={styles.fieldLabel}>Date:</ThemedText>
                    <ThemedButton onPress={() => setActiveDatePicker('after')}>
                      <Text style={styles.buttonValueText}>{filterState.date.after || 'Choose date'}</Text>
                    </ThemedButton>
                    {activeDatePicker === 'after' && renderDatePicker('after')}
                  </View>
                )}

                {filterState.date.mode === 'between' && (
                  <View style={styles.inlineStack}>
                    <View style={styles.inlineRow}>
                      <ThemedText style={styles.fieldLabel}>Start:</ThemedText>
                      <ThemedButton onPress={() => setActiveDatePicker('betweenStart')}>
                        <Text style={styles.buttonValueText}>{filterState.date.betweenStart || 'Choose start'}</Text>
                      </ThemedButton>
                      {activeDatePicker === 'betweenStart' && renderDatePicker('betweenStart')}
                    </View>
                    <View style={styles.inlineRow}>
                      <ThemedText style={styles.fieldLabel}>End:</ThemedText>
                      <ThemedButton onPress={() => setActiveDatePicker('betweenEnd')}>
                        <Text style={styles.buttonValueText}>{filterState.date.betweenEnd || 'Choose end'}</Text>
                      </ThemedButton>
                      {activeDatePicker === 'betweenEnd' && renderDatePicker('betweenEnd')}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Amount</ThemedText>
                <View style={styles.optionRow}>
                  {[
                    ['all', 'All'],
                    ['spending', 'Spending'],
                    ['income', 'Income'],
                  ].map(([value, label]) => (
                    <ThemedButton
                      key={value}
                      style={[styles.optionButton, filterState.amount.type === value && styles.optionButtonActive]}
                      onPress={() => updateAmountField('type', value)}
                    >
                      <Text style={[styles.optionButtonText, filterState.amount.type === value && styles.optionButtonTextActive]}>{label}</Text>
                    </ThemedButton>
                  ))}
                </View>

                <View style={styles.optionRow}>
                  {[
                    ['all', 'All'],
                    ['above', 'Above'],
                    ['below', 'Below'],
                    ['between', 'Between'],
                  ].map(([value, label]) => (
                    <ThemedButton
                      key={value}
                      style={[styles.optionButton, filterState.amount.rangeMode === value && styles.optionButtonActive]}
                      onPress={() => updateAmountField('rangeMode', value)}
                    >
                      <Text style={[styles.optionButtonText, filterState.amount.rangeMode === value && styles.optionButtonTextActive]}>{label}</Text>
                    </ThemedButton>
                  ))}
                </View>

                {filterState.amount.rangeMode === 'above' && (
                  <View style={styles.inlineRow}>
                    <ThemedText style={styles.fieldLabel}>Amount:</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      style={styles.smallInput}
                      value={filterState.amount.min}
                      onChangeText={(value) => updateAmountField('min', value)}
                    />
                  </View>
                )}

                {filterState.amount.rangeMode === 'below' && (
                  <View style={styles.inlineRow}>
                    <ThemedText style={styles.fieldLabel}>Amount:</ThemedText>
                    <ThemedTextInput
                      keyboardType="numeric"
                      style={styles.smallInput}
                      value={filterState.amount.max}
                      onChangeText={(value) => updateAmountField('max', value)}
                    />
                  </View>
                )}

                {filterState.amount.rangeMode === 'between' && (
                  <View style={styles.inlineStack}>
                    <View style={styles.inlineRow}>
                      <ThemedText style={styles.fieldLabel}>Min:</ThemedText>
                      <ThemedTextInput
                        keyboardType="numeric"
                        style={styles.smallInput}
                        value={filterState.amount.min}
                        onChangeText={(value) => updateAmountField('min', value)}
                      />
                    </View>
                    <View style={styles.inlineRow}>
                      <ThemedText style={styles.fieldLabel}>Max:</ThemedText>
                      <ThemedTextInput
                        keyboardType="numeric"
                        style={styles.smallInput}
                        value={filterState.amount.max}
                        onChangeText={(value) => updateAmountField('max', value)}
                      />
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Category</ThemedText>
                <ThemedSelectList
                  key={`category-${modalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setFilterState((prev) => ({
                    ...prev,
                    category: {
                      ...prev.category,
                      selectedCandidateId: String(value || ''),
                    },
                  }))}
                  defaultOption={filterState.category.selectedCandidateId ? { key: filterState.category.selectedCandidateId, value: selectedCategoryCandidateLabel } : undefined}
                />

                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryChoice('include')}>
                    <Text style={styles.optionButtonText}>Include</Text>
                  </ThemedButton>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryChoice('exclude')}>
                    <Text style={styles.optionButtonText}>Exclude</Text>
                  </ThemedButton>
                  <ThemedButton style={[styles.optionButtonOrange, filterState.category.includeIds.length === categoryOptions.length && categoryOptions.length > 0 && styles.optionButtonActive]} onPress={() => setAllCategories('include')}>
                    <Text style={[styles.optionButtonText, filterState.category.includeIds.length === categoryOptions.length && categoryOptions.length > 0 && styles.optionButtonTextActive]}>Include All</Text>
                  </ThemedButton>
                  <ThemedButton style={[styles.optionButtonOrange, filterState.category.excludeIds.length === categoryOptions.length && categoryOptions.length > 0 && styles.optionButtonActive]} onPress={() => setAllCategories('exclude')}>
                    <Text style={[styles.optionButtonText, filterState.category.excludeIds.length === categoryOptions.length && categoryOptions.length > 0 && styles.optionButtonTextActive]}>Exclude All</Text>
                  </ThemedButton>
                </View>

                <View style={styles.selectionLists}>
                  <View style={styles.selectionGroup}>
                    <ThemedText style={styles.selectionTitle}>Included</ThemedText>
                    {filterState.category.includeIds.length === 0 ? (
                      <Text style={styles.emptyText}>None</Text>
                    ) : (
                      filterState.category.includeIds.map((id) => (
                        <View key={`cat-include-${id}`} style={styles.selectionRow}>
                          <Text style={styles.selectionLabel}>{categoryLabelById[id] || id}</Text>
                          <Pressable onPress={() => removeCategoryId(id, 'include')}>
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.selectionGroup}>
                    <ThemedText style={styles.selectionTitle}>Excluded</ThemedText>
                    {filterState.category.excludeIds.length === 0 ? (
                      <Text style={styles.emptyText}>None</Text>
                    ) : (
                      filterState.category.excludeIds.map((id) => (
                        <View key={`cat-exclude-${id}`} style={styles.selectionRow}>
                          <Text style={styles.selectionLabel}>{categoryLabelById[id] || id}</Text>
                          <Pressable onPress={() => removeCategoryId(id, 'exclude')}>
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Recipient</ThemedText>
                <ThemedSelectList
                  key={`recipient-${modalResetKey}`}
                  data={recipientOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setFilterState((prev) => ({
                    ...prev,
                    recipient: {
                      ...prev.recipient,
                      selectedCandidateId: String(value || ''),
                    },
                  }))}
                  defaultOption={filterState.recipient.selectedCandidateId ? { key: filterState.recipient.selectedCandidateId, value: selectedRecipientCandidateLabel } : undefined}
                />

                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addRecipientChoice('include')}>
                    <Text style={styles.optionButtonText}>Include</Text>
                  </ThemedButton>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addRecipientChoice('exclude')}>
                    <Text style={styles.optionButtonText}>Exclude</Text>
                  </ThemedButton>
                  <ThemedButton style={[styles.optionButtonOrange, filterState.recipient.includeIds.length === recipientOptions.length && recipientOptions.length > 0 && styles.optionButtonActive]} onPress={() => setAllRecipients('include')}>
                    <Text style={[styles.optionButtonText, filterState.recipient.includeIds.length === recipientOptions.length && recipientOptions.length > 0 && styles.optionButtonTextActive]}>Include All</Text>
                  </ThemedButton>
                  <ThemedButton style={[styles.optionButtonOrange, filterState.recipient.excludeIds.length === recipientOptions.length && recipientOptions.length > 0 && styles.optionButtonActive]} onPress={() => setAllRecipients('exclude')}>
                    <Text style={[styles.optionButtonText, filterState.recipient.excludeIds.length === recipientOptions.length && recipientOptions.length > 0 && styles.optionButtonTextActive]}>Exclude All</Text>
                  </ThemedButton>
                </View>

                <View style={styles.selectionLists}>
                  <View style={styles.selectionGroup}>
                    <ThemedText style={styles.selectionTitle}>Included</ThemedText>
                    {filterState.recipient.includeIds.length === 0 ? (
                      <Text style={styles.emptyText}>None</Text>
                    ) : (
                      filterState.recipient.includeIds.map((id) => (
                        <View key={`rec-include-${id}`} style={styles.selectionRow}>
                          <Text style={styles.selectionLabel}>{recipientLabelById[id] || id}</Text>
                          <Pressable onPress={() => removeRecipientId(id, 'include')}>
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.selectionGroup}>
                    <ThemedText style={styles.selectionTitle}>Excluded</ThemedText>
                    {filterState.recipient.excludeIds.length === 0 ? (
                      <Text style={styles.emptyText}>None</Text>
                    ) : (
                      filterState.recipient.excludeIds.map((id) => (
                        <View key={`rec-exclude-${id}`} style={styles.selectionRow}>
                          <Text style={styles.selectionLabel}>{recipientLabelById[id] || id}</Text>
                          <Pressable onPress={() => removeRecipientId(id, 'exclude')}>
                            <Text style={styles.removeText}>Remove</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Sort</ThemedText>
                <View style={styles.optionRow}>
                  {SORT_COLUMNS.map((item) => (
                    <ThemedButton
                      key={item.key}
                      style={[styles.sortToggle, filterState.sortKey === item.key && styles.sortToggleActive]}
                      onPress={() => setSortKey(item.key)}
                    >
                      <Text style={[styles.optionButtonText, filterState.sortKey === item.key && styles.optionButtonTextActive]}>{item.label}</Text>
                    </ThemedButton>
                  ))}
                </View>

                <View style={styles.optionRow}>
                  <ThemedButton
                    style={[styles.sortDirectionButton, filterState.sortDirection === 'asc' && styles.sortDirectionButtonActive]}
                    onPress={() => setSortDirection('asc')}
                  >
                    <Text style={[styles.optionButtonText, filterState.sortDirection === 'asc' && styles.optionButtonTextActive]}>Ascending</Text>
                  </ThemedButton>
                  <ThemedButton
                    style={[styles.sortDirectionButton, filterState.sortDirection === 'desc' && styles.sortDirectionButtonActive]}
                    onPress={() => setSortDirection('desc')}
                  >
                    <Text style={[styles.optionButtonText, filterState.sortDirection === 'desc' && styles.optionButtonTextActive]}>Descending</Text>
                  </ThemedButton>
                </View>
              </View>

              <View style={styles.noteSection}>
                <Text style={styles.noteText}>Description and Currency currently have no filter or sort options.</Text>
              </View>

              <View style={styles.actionRow}>
                <ThemedButton style={[styles.actionButton, styles.applyButton]} onPress={apply}>
                  <Text style={styles.actionButtonText}>Apply</Text>
                </ThemedButton>
                <ThemedButton style={[styles.actionButton, styles.clearButton]} onPress={clearAll}>
                  <Text style={styles.actionButtonText}>Clear</Text>
                </ThemedButton>
                <ThemedButton style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
                  <Text style={styles.actionButtonText}>Cancel</Text>
                </ThemedButton>
              </View>
            </ScrollView>
          </ThemedView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

export default RecordsFilterModal

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '100%',
  },
  card: {
    width: '100%',
    maxHeight: '95%',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: Colors.light.disabledText,
  },
  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.warning,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  scroll: {
    width: '100%',
  },
  section: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d2d7d4',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonOrange: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: Colors.savings,
    borderColor: '#f6fff9',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  optionButtonText: {
    color: '#e8f0ec',
    fontWeight: '700',
  },
  optionButtonTextActive: {
    color: '#ffffff',
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.18)',
    textShadowRadius: 1,
    textShadowOffset: { width: 0, height: 1 },
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  inlineStack: {
    gap: 8,
  },
  fieldLabel: {
    width: 70,
    textAlign: 'right',
    fontWeight: '600',
  },
  buttonValueText: {
    color: '#fff',
  },
  smallInput: {
    flex: 1,
    minWidth: 0,
  },
  selectionLists: {
    gap: 10,
  },
  selectionGroup: {
    gap: 6,
  },
  selectionTitle: {
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.light.disabledText,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#eef3f0',
  },
  selectionLabel: {
    flex: 1,
    paddingRight: 10,
  },
  removeText: {
    color: Colors.warning,
    fontWeight: '700',
  },
  sortToggle: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortToggleActive: {
    backgroundColor: Colors.savings,
    borderColor: '#f6fff9',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sortDirectionButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#89a79c',
  },
  sortDirectionButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: '#f6fff9',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  noteSection: {
    marginTop: 10,
  },
  noteText: {
    color: Colors.light.disabledText,
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    minWidth: 120,
    justifyContent: 'center',
  },
  applyButton: {
    backgroundColor: Colors.primary,
  },
  clearButton: {
    backgroundColor: Colors.warning,
  },
  cancelButton: {
    backgroundColor: Colors.expense,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
})