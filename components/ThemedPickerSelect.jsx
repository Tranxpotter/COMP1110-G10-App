import { useColorScheme } from 'react-native'
import { Colors } from "../constants/Colors"
import RNPickerSelect from "react-native-picker-select"

const ThemedText = ({ style, ...props }) => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light
  
  return (
    <RNPickerSelect 
      style={[{ backgroundColor: theme.uiBackground, color: theme.text }, style]}
      {...props}
    />
  )
}

export default ThemedText