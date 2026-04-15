import { useColorScheme, TextInput } from 'react-native'
import React from 'react'
// import { TextInput } from 'react-native-web'
import { Colors } from '../constants/Colors'

const ThemedTextInput = React.forwardRef(({ style, ...props }, ref) => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  
  return (
    <TextInput 
      ref={ref}
      style={[
        {
          backgroundColor: theme.uiBackground, 
          color: theme.text, 
          padding: 20, 
          borderRadius: 6
        }, 
        style
        ]} 
        {...props} 
        placeholderTextColor={theme.text}
    />
  )
})

ThemedTextInput.displayName = "ThemedTextInput"

export default ThemedTextInput
