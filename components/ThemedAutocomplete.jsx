import React from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native'

import { Colors } from '../constants/Colors'
import ThemedTextInput from './ThemedTextInput'
import ThemedScrollView from './ThemedScrollView'

const ThemedAutocomplete = ({
  inputRef,
  value,
  onChangeText,
  onFocus,
  onSubmitEditing,
  returnKeyType = 'next',
  blurOnSubmit = false,
  autoCorrect = false,
  suggestions = [],
  shouldShowSuggestions,
  onSelectSuggestion,
  onClose,
  getSuggestionLabel,
  getSuggestionKey,
  maxVisibleItems = 3,
  suggestionRowHeight = 50,
  closeLabel = 'X',
  containerStyle,
  inputStyle,
  panelStyle,
  listStyle,
  itemStyle,
  itemTextStyle,
  closeButtonStyle,
  closeButtonTextStyle,
}) => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  const borderColor = theme.iconColor || '#8f9a96'

  const showSuggestions =
    typeof shouldShowSuggestions === 'boolean'
      ? shouldShowSuggestions
      : !!String(value || '').trim() && suggestions.length > 0

  const labelFor = (item) => {
    if (typeof getSuggestionLabel === 'function') return getSuggestionLabel(item)
    if (typeof item === 'string') return item
    return item?.label || item?.name || String(item)
  }

  const keyFor = (item, index) => {
    if (typeof getSuggestionKey === 'function') return getSuggestionKey(item, index)
    const label = labelFor(item)
    return `${label}-${index}`
  }

  const maxHeight = Math.max(1, Number(maxVisibleItems)) * Math.max(1, Number(suggestionRowHeight))

  return (
    <View style={[styles.container, containerStyle]}>
      <ThemedTextInput
        ref={inputRef}
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        onSubmitEditing={onSubmitEditing}
        autoCorrect={autoCorrect}
      />

      {showSuggestions && (
        <View style={[styles.panel, panelStyle]}>
          <ThemedScrollView
            style={[
              styles.list,
              {
                borderColor,
                maxHeight,
              },
              listStyle,
            ]}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={suggestions.length > maxVisibleItems}
          >
            {suggestions.map((item, index) => (
              <Pressable
                key={keyFor(item, index)}
                style={[
                  styles.item,
                  {
                    borderBottomColor: borderColor,
                    backgroundColor: theme.uiBackground,
                    minHeight: suggestionRowHeight,
                  },
                  index === suggestions.length - 1 && styles.itemLast,
                  itemStyle,
                ]}
                onPress={() => onSelectSuggestion?.(item)}
              >
                <Text style={[styles.itemText, { color: theme.text }, itemTextStyle]}>
                  {labelFor(item)}
                </Text>
              </Pressable>
            ))}
          </ThemedScrollView>

          <Pressable
            style={[styles.closeButton, { backgroundColor: theme.background }, closeButtonStyle]}
            onPress={onClose}
          >
            <Text style={[styles.closeButtonText, { color: theme.text }, closeButtonTextStyle]}>
              {closeLabel}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

export default ThemedAutocomplete

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  input: {
    flex: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 6,
    zIndex: 100,
    elevation: 100,
  },
  list: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  item: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemText: {
    fontSize: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 200,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
})
