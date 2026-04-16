import { StyleSheet, useColorScheme } from 'react-native'
import { SelectList } from "react-native-dropdown-select-list";
import { Colors } from '../constants/Colors';

/**
 * 
 * @param boxStyles Additional styles for select box parent wrapper
 * @param inputStyles Additional styles for text of selection box
 * @param dropdownStyles Additional styles for dropdown scrollview, specify 'top' to match box size for floating display
 * @param dropdownItemStyles Additional styles for dropdown single list item
 * @param dropdownTextStyles Additional styles for dropdown list items text
 * @param disabledItemStyles Additional styles for disabled dropdown list item
 * @param disabledTextStyles Additional styles for disabled dropdown list items text
 * @param floating If the selection dropdown list is floating
 * @returns 
 */
const ThemedSelectList = ({ boxStyles, inputStyles, dropdownStyles, dropdownItemStyles, dropdownTextStyles, disabledItemStyles, disabledTextStyles, floating=false, ...props }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  if (!floating){
    return (
      <SelectList 
        boxStyles={[{ backgroundColor: Colors.primary }, boxStyles]}
        inputStyles={[{ color: theme.text }, inputStyles]}
        dropdownStyles={[{ backgroundColor: theme.uiBackground }, dropdownStyles]}
        dropdownItemStyles={[{}, dropdownItemStyles]}
        dropdownTextStyles={[{ color: theme.text }, dropdownTextStyles]}
        disabledItemStyles={[{}, disabledItemStyles]}
        disabledTextStyles={[{ color: theme.disabledText }, disabledTextStyles]}
        { ...props }
      />
    )
  }

  else {
    return (
      <SelectList 
        boxStyles={[{ backgroundColor: Colors.primary }, boxStyles]}
        inputStyles={[{ color: theme.text }, inputStyles]}
        dropdownStyles={[{ backgroundColor: theme.uiBackground, position: "absolute", zIndex: 99, top:40 }, dropdownStyles]}
        dropdownItemStyles={[{}, dropdownItemStyles]}
        dropdownTextStyles={[{ color: theme.text }, dropdownTextStyles]}
        disabledItemStyles={[{}, disabledItemStyles]}
        disabledTextStyles={[{ color: theme.disabledText }, disabledTextStyles]}
        { ...props }
      />
    )
  }
  
}

export default ThemedSelectList

const styles = StyleSheet.create({})