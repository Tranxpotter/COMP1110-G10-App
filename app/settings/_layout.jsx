import React from 'react'
import { Stack } from 'expo-router'
import { useColorScheme } from 'react-native'
import { Colors } from '../../constants/Colors'

const SettingsLayout = () => {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme] ?? Colors.light

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.navBackground },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.title },
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="db"
        options={{ title: 'DB Debug' }}
      />
    </Stack>
  )
}

export default SettingsLayout
