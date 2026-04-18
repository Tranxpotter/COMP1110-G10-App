import { ScrollView, useColorScheme } from 'react-native'
import { Colors } from "../constants/Colors"

import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const ThemedScrollView = ({ style, safe=false, useTopSafe=true, useBottomSafe=true, ...props }) => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light

  if (!safe){
    return (
      <ScrollView 
        style={[{ backgroundColor: theme.background }, style]}
        {...props}
      />
    )
  } 

  const insets = useSafeAreaInsets()
  var topPadding = insets.top;
  if (!useTopSafe){
    topPadding = 0;
  }
  var bottomPadding = insets.bottom;
  if (!useBottomSafe){
    bottomPadding = 0;
  }

  return (
    <ScrollView 
      style={[{ 
        backgroundColor: theme.background, 
        paddingTop: topPadding, 
        paddingBottom: bottomPadding 
      }, style]}
      {...props}
    />
  )
}

export default ThemedScrollView