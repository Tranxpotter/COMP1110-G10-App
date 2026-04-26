import React, { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native'

import { Colors } from '../constants/Colors'

const CurrencyPickerField = ({
  value,
  options = [],
  onSelect,
  placeholder = 'Select currency',
  disabled = false,
}) => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const [open, setOpen] = useState(false)

  const selectedLabel = useMemo(() => {
    const normalized = String(value || '').trim().toUpperCase()
    const matched = (options || []).find((item) => String(item?.key || '').toUpperCase() === normalized)
    return matched?.value || normalized || placeholder
  }, [value, options, placeholder])

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => {
          if (disabled) return
          setOpen(true)
        }}
        style={[
          styles.trigger,
          {
            backgroundColor: theme.uiBackground,
            borderColor: theme.inputBorder || theme.iconColor,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Text style={[styles.triggerText, { color: theme.text }]}>{selectedLabel}</Text>
        <Text style={[styles.chevron, { color: theme.text }]}>v</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.inputBorder || theme.iconColor }]}>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
              {(options || []).map((item) => {
                const key = String(item?.key || '').toUpperCase()
                const isActive = key === String(value || '').trim().toUpperCase()
                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.optionRow,
                      {
                        borderBottomColor: `${theme.iconColor}55`,
                        backgroundColor: isActive ? Colors.primary : theme.uiBackground,
                      },
                    ]}
                    onPress={() => {
                      onSelect?.(key)
                      setOpen(false)
                    }}
                  >
                    <Text style={[styles.optionText, { color: isActive ? '#fff' : theme.text }]}>{item?.value || key}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

export default CurrencyPickerField

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    fontSize: 15,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 320,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  list: {
    width: '100%',
  },
  listContent: {
    paddingBottom: 6,
  },
  optionRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 15,
  },
})
