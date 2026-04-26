import { Alert, useColorScheme } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect } from 'react'
import { Colors } from '../constants/Colors'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { initTables } from '../components/dbClient'
import { DateContextProvider } from '../contexts/DateContext'

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light
  const insets = useSafeAreaInsets();

  useEffect(() => {
    ;(async () => {
      try {
        await initTables()
      } catch (e) {
        console.error('initTables failed', e)
        Alert.alert('Database error', 'Failed to initialize database tables.')
      }
    })()
  }, [])

  return (
    <Tabs 
      screenOptions={{ headerShown: false, tabBarStyle: {
        backgroundColor: theme.navBackground, 
        paddingBottom: insets.bottom,
      }, 
      tabBarActiveTintColor: theme.iconColorFocused, 
      tabBarInactiveTintColor: theme.iconColor
    }}

    >
      <Tabs.Screen 
        name="input" 
        options={{ title: "Input", tabBarIcon: ({ focused }) => (
          <Ionicons 
            size={24}
            name={focused ? 'person' : 'person-outline'}
            color={focused ? theme.iconColorFocused : theme.iconColor}
          />
        ) }} 
      />
      <Tabs.Screen 
        name="view" 
        options={{ title: "View" , tabBarIcon: ({ focused }) => (
          <Ionicons 
            size={24}
            name={focused ? 'book' : 'book-outline'}
            color={focused ? theme.iconColorFocused : theme.iconColor}
          />
        ) }}
        
      />
      <Tabs.Screen 
        name="dashboard" 
        options={{ title: "Dashboard" , tabBarIcon: ({ focused }) => (
          <Ionicons 
            size={24}
            name={focused ? 'create' : 'create-outline'}
            color={focused ? theme.iconColorFocused : theme.iconColor}
          />
        ) }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              size={24}
              name={focused ? 'notifications' : 'notifications-outline'}
              color={focused ? theme.iconColorFocused : theme.iconColor}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              size={24}
              name={focused ? 'settings' : 'settings-outline'}
              color={focused ? theme.iconColorFocused : theme.iconColor}
            />
          ),
        }}
      />
        
    </Tabs>
  )
}

const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <DateContextProvider>
        <TabsLayout />
      </DateContextProvider>
    </SafeAreaProvider>
  )
}

export default RootLayout