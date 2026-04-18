import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { Colors } from '../constants/Colors'
import ThemedButton from './ThemedButton'
import ThemedSelectList from './ThemedSelectList'
import ThemedText from './ThemedText'
import ThemedView from './ThemedView'

const defaultTrendState = () => ({
  mode: 'total',
  chartType: 'line',
  selectedCandidateId: '',
  categoryIds: [],
})

const normalizeIds = (values) => Array.from(new Set((values || []).map((value) => String(value)).filter(Boolean)))

const DashboardTrendFilter = ({
  visible,
  initialConfig,
  categoryOptions = [],
  onClose,
  onApply,
}) => {
  const [trendState, setTrendState] = useState(defaultTrendState())
  const [modalResetKey, setModalResetKey] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const categoryLabelById = useMemo(() => {
    return (categoryOptions || []).reduce((acc, item) => {
      acc[String(item.key)] = item.value
      return acc
    }, {})
  }, [categoryOptions])

  useEffect(() => {
    if (!visible) return

    const source = initialConfig || {}
    setTrendState({
      mode: source.mode === 'category' ? 'category' : 'total',
      chartType: source.chartType === 'stackedBar' ? 'stackedBar' : 'line',
      selectedCandidateId: '',
      categoryIds: normalizeIds(source.categoryIds),
    })
    setModalResetKey((prev) => prev + 1)
    setErrorMessage('')
  }, [visible, initialConfig])

  const addCategory = () => {
    setTrendState((prev) => {
      const candidate = String(prev.selectedCandidateId || '')
      if (!candidate) return prev
      return {
        ...prev,
        categoryIds: normalizeIds([...prev.categoryIds, candidate]),
      }
    })
  }

  const removeCategory = (categoryId) => {
    setTrendState((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.filter((id) => id !== categoryId),
    }))
  }

  const setAllCategories = () => {
    const ids = (categoryOptions || []).map((item) => String(item.key))
    setTrendState((prev) => ({
      ...prev,
      categoryIds: ids,
    }))
  }

  const clearAllCategories = () => {
    setTrendState((prev) => ({
      ...prev,
      categoryIds: [],
      selectedCandidateId: '',
    }))
  }

  const apply = () => {
    if (trendState.mode === 'category' && trendState.categoryIds.length < 2) {
      setErrorMessage('Please select at least 2 categories for category mode.')
      return
    }

    onApply?.({
      mode: trendState.mode,
      chartType: trendState.chartType,
      categoryIds: trendState.mode === 'category' ? normalizeIds(trendState.categoryIds) : [],
    })
  }

  const selectedCandidateLabel = categoryLabelById[String(trendState.selectedCandidateId || '')] || ''

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
            <ThemedText style={styles.title}>Trend Chart Setup</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Mode</ThemedText>
              <View style={styles.optionRow}>
                <ThemedButton
                  style={[styles.optionButton, trendState.mode === 'total' && styles.optionButtonActive]}
                  onPress={() => setTrendState((prev) => ({ ...prev, mode: 'total' }))}
                >
                  <Text style={[styles.optionButtonText, trendState.mode === 'total' && styles.optionButtonTextActive]}>
                    Total Amount (Single Series)
                  </Text>
                </ThemedButton>
                <ThemedButton
                  style={[styles.optionButton, trendState.mode === 'category' && styles.optionButtonActive]}
                  onPress={() => setTrendState((prev) => ({ ...prev, mode: 'category' }))}
                >
                  <Text style={[styles.optionButtonText, trendState.mode === 'category' && styles.optionButtonTextActive]}>
                    Category Split (2+ Series)
                  </Text>
                </ThemedButton>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Chart Type</ThemedText>
              <View style={styles.optionRow}>
                <ThemedButton
                  style={[styles.optionButton, trendState.chartType === 'line' && styles.optionButtonActive]}
                  onPress={() => setTrendState((prev) => ({ ...prev, chartType: 'line' }))}
                >
                  <Text style={[styles.optionButtonText, trendState.chartType === 'line' && styles.optionButtonTextActive]}>
                    Line
                  </Text>
                </ThemedButton>
                <ThemedButton
                  style={[styles.optionButton, trendState.chartType === 'stackedBar' && styles.optionButtonActive]}
                  onPress={() => setTrendState((prev) => ({ ...prev, chartType: 'stackedBar' }))}
                >
                  <Text style={[styles.optionButtonText, trendState.chartType === 'stackedBar' && styles.optionButtonTextActive]}>
                    Stacked Bar
                  </Text>
                </ThemedButton>
              </View>
            </View>

            {trendState.mode === 'category' && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
                <ThemedSelectList
                  key={`trend-category-${modalResetKey}`}
                  data={categoryOptions}
                  search={true}
                  save="key"
                  floating={true}
                  setSelected={(value) => setTrendState((prev) => ({
                    ...prev,
                    selectedCandidateId: String(value || ''),
                  }))}
                  defaultOption={trendState.selectedCandidateId ? { key: trendState.selectedCandidateId, value: selectedCandidateLabel } : undefined}
                />

                <View style={styles.optionRow}>
                  <ThemedButton style={styles.optionButton} onPress={addCategory}>
                    <Text style={styles.optionButtonText}>Add</Text>
                  </ThemedButton>
                  <ThemedButton style={styles.optionButton} onPress={setAllCategories}>
                    <Text style={styles.optionButtonText}>Add All</Text>
                  </ThemedButton>
                  <ThemedButton style={styles.optionButton} onPress={clearAllCategories}>
                    <Text style={styles.optionButtonText}>Clear</Text>
                  </ThemedButton>
                </View>

                <View style={styles.selectionGroup}>
                  <ThemedText style={styles.selectionTitle}>Selected ({trendState.categoryIds.length})</ThemedText>
                  {trendState.categoryIds.length === 0 ? (
                    <Text style={styles.emptyText}>No category selected</Text>
                  ) : (
                    trendState.categoryIds.map((id) => (
                      <View key={`trend-category-${id}`} style={styles.selectionRow}>
                        <Text style={styles.selectionLabel}>{categoryLabelById[id] || id}</Text>
                        <Pressable onPress={() => removeCategory(id)}>
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

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

export default DashboardTrendFilter

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
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: Colors.savings,
  },
  optionButtonText: {
    color: '#e8f0ec',
    fontWeight: '700',
  },
  optionButtonTextActive: {
    color: '#ffffff',
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
  errorText: {
    marginTop: 4,
    color: Colors.warning,
    fontWeight: '600',
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
  cancelButton: {
    backgroundColor: Colors.expense,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
})
