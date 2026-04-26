import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Colors } from '../constants/Colors'
import ThemedButton from './ThemedButton'
import ThemedSelectList from './ThemedSelectList'
import ThemedText from './ThemedText'
import ThemedView from './ThemedView'
import {
  HORIZON_OPTIONS,
  PROJECTION_SUBTYPE_MONTHLY_SPENDING,
  PROJECTION_SUBTYPE_OPTIONS,
  PROJECTION_SUBTYPE_SAVINGS_DEBT,
  PROJECTION_SUBTYPE_SUBSCRIPTIONS,
  PROJECTION_SUBTYPE_YEARLY_BILLS,
  normalizeProjectionConfig,
} from './dashboardProjectionUtils'

const toLabelMap = (options = []) => {
  return (options || []).reduce((acc, item) => {
    acc[String(item.key)] = item.value
    return acc
  }, {})
}

const defaultState = () => normalizeProjectionConfig({}, PROJECTION_SUBTYPE_MONTHLY_SPENDING)

const DashboardProjectionFilter = ({
  visible,
  mode = 'filter',
  initialConfig,
  categoryOptions = [],
  recipientOptions = [],
  onClose,
  onApply,
}) => {
  const [projectionState, setProjectionState] = useState(defaultState())
  const [categoryCandidateId, setCategoryCandidateId] = useState('')
  const [recipientCandidateId, setRecipientCandidateId] = useState('')
  const [modalResetKey, setModalResetKey] = useState(0)

  const categoryLabelById = useMemo(() => toLabelMap(categoryOptions), [categoryOptions])
  const recipientLabelById = useMemo(() => toLabelMap(recipientOptions), [recipientOptions])

  useEffect(() => {
    if (!visible) return

    const normalized = normalizeProjectionConfig(initialConfig || {}, initialConfig?.subtype)
    setProjectionState(normalized)
    setCategoryCandidateId('')
    setRecipientCandidateId('')
    setModalResetKey((prev) => prev + 1)
  }, [visible, initialConfig])

  const setSubtype = (subtype) => {
    setProjectionState((prev) => normalizeProjectionConfig({ ...prev, subtype }, subtype))
    setCategoryCandidateId('')
    setRecipientCandidateId('')
    setModalResetKey((prev) => prev + 1)
  }

  const addCategoryTo = (sectionKey, fieldKey = 'includeCategoryIds') => {
    const candidate = String(categoryCandidateId || '')
    if (!candidate) return

    setProjectionState((prev) => {
      const section = { ...(prev?.[sectionKey] || {}) }
      const nextIds = Array.from(new Set([...(section[fieldKey] || []), candidate]))
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          [fieldKey]: nextIds,
        },
      }
    })
  }

  const removeCategoryFrom = (sectionKey, id, fieldKey = 'includeCategoryIds') => {
    setProjectionState((prev) => {
      const section = { ...(prev?.[sectionKey] || {}) }
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          [fieldKey]: (section[fieldKey] || []).filter((item) => item !== id),
        },
      }
    })
  }

  const addRecipientTo = (sectionKey, fieldKey = 'includeRecipientIds') => {
    const candidate = String(recipientCandidateId || '')
    if (!candidate) return

    setProjectionState((prev) => {
      const section = { ...(prev?.[sectionKey] || {}) }
      const nextIds = Array.from(new Set([...(section[fieldKey] || []), candidate]))
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          [fieldKey]: nextIds,
        },
      }
    })
  }

  const removeRecipientFrom = (sectionKey, id, fieldKey = 'includeRecipientIds') => {
    setProjectionState((prev) => {
      const section = { ...(prev?.[sectionKey] || {}) }
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          [fieldKey]: (section[fieldKey] || []).filter((item) => item !== id),
        },
      }
    })
  }

  const addRecipientToBills = () => {
    addRecipientTo('yearlyBills', 'includeRecipientIds')
  }

  const removeRecipientFromBills = (id) => {
    removeRecipientFrom('yearlyBills', id, 'includeRecipientIds')
  }

  const apply = () => {
    onApply?.(normalizeProjectionConfig(projectionState, projectionState?.subtype))
  }

  const selectedCategoryCandidateLabel = categoryLabelById[String(categoryCandidateId || '')] || ''
  const selectedRecipientCandidateLabel = recipientLabelById[String(recipientCandidateId || '')] || ''
  const isChartMode = mode === 'chart'
  const isHorizonDisabled = isChartMode && projectionState.subtype === PROJECTION_SUBTYPE_MONTHLY_SPENDING
  const modalTitle = isChartMode ? 'Projection Chart Setup' : 'Projection Filter Setup'

  const renderIdList = ({
    title,
    ids,
    labelMap,
    onRemove,
  }) => (
    <View style={styles.selectionGroup}>
      <ThemedText style={styles.selectionTitle}>{title} ({ids.length})</ThemedText>
      {ids.length === 0 ? (
        <Text style={styles.emptyText}>None selected</Text>
      ) : (
        ids.map((id) => (
          <View key={`${title}-${id}`} style={styles.selectionRow}>
            <Text style={styles.selectionLabel}>{labelMap[id] || id}</Text>
            <Pressable onPress={() => onRemove(id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  )

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
        <ThemedView style={styles.card}>
          <View style={styles.headerRow}>
            <ThemedText style={styles.title}>{modalTitle}</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {isChartMode ? (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Projection Type</ThemedText>
                  <View style={styles.optionRow}>
                    {PROJECTION_SUBTYPE_OPTIONS.map((option) => {
                      const isActive = projectionState.subtype === option.key
                      return (
                        <ThemedButton
                          key={option.key}
                          style={[styles.optionButton, isActive && styles.optionButtonActive]}
                          onPress={() => setSubtype(option.key)}
                        >
                          <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>{option.label}</Text>
                        </ThemedButton>
                      )
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Forecast Horizon</ThemedText>
                  {isHorizonDisabled ? (
                    <ThemedText style={styles.noteText}>Forecast horizon is not applicable for Monthly Spending Projection.</ThemedText>
                  ) : null}
                  <View style={styles.optionRow}>
                    {HORIZON_OPTIONS.map((months) => {
                      const isActive = Number(projectionState.forecastHorizonMonths) === months
                      const isDisabled = isHorizonDisabled
                      return (
                        <ThemedButton
                          key={`horizon-${months}`}
                          style={[styles.optionButton, isActive && styles.optionButtonActive, isDisabled && styles.optionButtonDisabled]}
                          onPress={() => {
                            if (isDisabled) return
                            setProjectionState((prev) => ({ ...prev, forecastHorizonMonths: months }))
                          }}
                        >
                          <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive, isDisabled && styles.optionButtonTextDisabled]}>{months} months</Text>
                        </ThemedButton>
                      )
                    })}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Filters for {PROJECTION_SUBTYPE_OPTIONS.find((item) => item.key === projectionState.subtype)?.label || 'Projection'}</ThemedText>
                <ThemedText style={styles.noteText}>Configure data filters here. Use Chart setup to change projection type and forecast horizon.</ThemedText>
              </View>
            )}

            {!isChartMode && projectionState.subtype === PROJECTION_SUBTYPE_MONTHLY_SPENDING && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Exclude Categories</ThemedText>
                <ThemedSelectList
                  key={`projection-monthly-category-${modalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setCategoryCandidateId(String(value || ''))}
                  defaultOption={categoryCandidateId ? { key: categoryCandidateId, value: selectedCategoryCandidateLabel } : undefined}
                />
                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryTo('monthlySpending', 'excludedCategoryIds')}>
                    <Text style={styles.optionButtonText}>Add Exclusion</Text>
                  </ThemedButton>
                </View>
                {renderIdList({
                  title: 'Excluded categories',
                  ids: projectionState.monthlySpending.excludedCategoryIds,
                  labelMap: categoryLabelById,
                  onRemove: (id) => removeCategoryFrom('monthlySpending', id, 'excludedCategoryIds'),
                })}
              </View>
            )}

            {!isChartMode && projectionState.subtype === PROJECTION_SUBTYPE_SAVINGS_DEBT && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Savings/Debt Source</ThemedText>
                <View style={styles.optionRow}>
                  <ThemedButton
                    style={[styles.optionButton, projectionState.savingsDebt.mode === 'surplus' && styles.optionButtonActive]}
                    onPress={() => setProjectionState((prev) => ({
                      ...prev,
                      savingsDebt: {
                        ...prev.savingsDebt,
                        mode: 'surplus',
                      },
                    }))}
                  >
                    <Text style={[styles.optionButtonText, projectionState.savingsDebt.mode === 'surplus' && styles.optionButtonTextActive]}>Use month-end surplus/debt</Text>
                  </ThemedButton>
                  <ThemedButton
                    style={[styles.optionButton, projectionState.savingsDebt.mode === 'categories' && styles.optionButtonActive]}
                    onPress={() => setProjectionState((prev) => ({
                      ...prev,
                      savingsDebt: {
                        ...prev.savingsDebt,
                        mode: 'categories',
                      },
                    }))}
                  >
                    <Text style={[styles.optionButtonText, projectionState.savingsDebt.mode === 'categories' && styles.optionButtonTextActive]}>Use selected categories</Text>
                  </ThemedButton>
                </View>

                {projectionState.savingsDebt.mode === 'categories' ? (
                  <>
                    <ThemedSelectList
                      key={`projection-savings-category-${modalResetKey}`}
                      data={categoryOptions}
                      search={true}
                      save="key"
                      floating={true}
                      setSelected={(value) => setCategoryCandidateId(String(value || ''))}
                      defaultOption={categoryCandidateId ? { key: categoryCandidateId, value: selectedCategoryCandidateLabel } : undefined}
                    />
                    <View style={styles.optionRow}>
                      <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryTo('savingsDebt', 'includeCategoryIds')}>
                        <Text style={styles.optionButtonText}>Add Category</Text>
                      </ThemedButton>
                    </View>
                    {renderIdList({
                      title: 'Included categories',
                      ids: projectionState.savingsDebt.includeCategoryIds,
                      labelMap: categoryLabelById,
                      onRemove: (id) => removeCategoryFrom('savingsDebt', id, 'includeCategoryIds'),
                    })}
                  </>
                ) : null}
              </View>
            )}

            {!isChartMode && projectionState.subtype === PROJECTION_SUBTYPE_YEARLY_BILLS && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Track Bills</ThemedText>
                <ThemedText style={styles.noteText}>Select categories and recipients to define tracked bills.</ThemedText>
                <ThemedSelectList
                  key={`projection-bills-category-${modalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setCategoryCandidateId(String(value || ''))}
                  defaultOption={categoryCandidateId ? { key: categoryCandidateId, value: selectedCategoryCandidateLabel } : undefined}
                />
                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryTo('yearlyBills', 'includeCategoryIds')}>
                    <Text style={styles.optionButtonText}>Add Category</Text>
                  </ThemedButton>
                </View>
                {renderIdList({
                  title: 'Tracked categories',
                  ids: projectionState.yearlyBills.includeCategoryIds,
                  labelMap: categoryLabelById,
                  onRemove: (id) => removeCategoryFrom('yearlyBills', id, 'includeCategoryIds'),
                })}

                <ThemedSelectList
                  key={`projection-bills-recipient-${modalResetKey}`}
                  data={recipientOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setRecipientCandidateId(String(value || ''))}
                  defaultOption={recipientCandidateId ? { key: recipientCandidateId, value: selectedRecipientCandidateLabel } : undefined}
                />
                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={addRecipientToBills}>
                    <Text style={styles.optionButtonText}>Add Recipient</Text>
                  </ThemedButton>
                </View>
                {renderIdList({
                  title: 'Tracked recipients',
                  ids: projectionState.yearlyBills.includeRecipientIds,
                  labelMap: recipientLabelById,
                  onRemove: removeRecipientFromBills,
                })}
              </View>
            )}

            {!isChartMode && projectionState.subtype === PROJECTION_SUBTYPE_SUBSCRIPTIONS && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Track Subscriptions</ThemedText>
                <ThemedText style={styles.noteText}>Select categories and recipients for subscription tracking. Use one recipient to inspect an individual subscription.</ThemedText>
                <ThemedSelectList
                  key={`projection-subscriptions-category-${modalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setCategoryCandidateId(String(value || ''))}
                  defaultOption={categoryCandidateId ? { key: categoryCandidateId, value: selectedCategoryCandidateLabel } : undefined}
                />
                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addCategoryTo('subscriptions', 'includeCategoryIds')}>
                    <Text style={styles.optionButtonText}>Add Category</Text>
                  </ThemedButton>
                </View>
                {renderIdList({
                  title: 'Tracked categories',
                  ids: projectionState.subscriptions.includeCategoryIds,
                  labelMap: categoryLabelById,
                  onRemove: (id) => removeCategoryFrom('subscriptions', id, 'includeCategoryIds'),
                })}

                <ThemedSelectList
                  key={`projection-subscriptions-recipient-${modalResetKey}`}
                  data={recipientOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setRecipientCandidateId(String(value || ''))}
                  defaultOption={recipientCandidateId ? { key: recipientCandidateId, value: selectedRecipientCandidateLabel } : undefined}
                />
                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButtonOrange} onPress={() => addRecipientTo('subscriptions', 'includeRecipientIds')}>
                    <Text style={styles.optionButtonText}>Add Recipient</Text>
                  </ThemedButton>
                </View>
                {renderIdList({
                  title: 'Tracked recipients',
                  ids: projectionState.subscriptions.includeRecipientIds,
                  labelMap: recipientLabelById,
                  onRemove: (id) => removeRecipientFrom('subscriptions', id, 'includeRecipientIds'),
                })}
              </View>
            )}

            <View style={styles.actionRow}>
              <ThemedButton style={[styles.actionButton, styles.applyButton]} onPress={apply}>
                <Text style={styles.actionButtonText}>Apply</Text>
              </ThemedButton>
              <ThemedButton style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
                <Text style={styles.actionButtonText}>Cancel</Text>
              </ThemedButton>
            </View>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  )
}

export default DashboardProjectionFilter

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  card: {
    width: '100%',
    maxWidth: 760,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
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
  noteText: {
    color: Colors.light.disabledText,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  optionButton: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionButtonOrange: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: Colors.savings,
  },
  optionButtonDisabled: {
    backgroundColor: '#9ea9a4',
  },
  optionButtonText: {
    color: '#e8f0ec',
    fontWeight: '700',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  optionButtonTextDisabled: {
    color: '#f1f3f2',
  },
  selectionGroup: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#d2d7d4',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f6faf8',
  },
  selectionTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.light.disabledText,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectionLabel: {
    color: Colors.light.text,
    flex: 1,
  },
  removeText: {
    color: Colors.warning,
    fontWeight: '700',
    marginLeft: 8,
  },
  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    minWidth: 120,
    justifyContent: 'center',
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: Colors.expense,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
})
