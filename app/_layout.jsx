<<<<<<< HEAD
import { useColorScheme } from 'react-native'
=======
import { View, Text, useColorScheme, Dimensions } from 'react-native'
>>>>>>> master
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import React, { useEffect } from 'react'
import { Colors } from '../constants/Colors'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { addCategory, addRecipient, addRecord, initTables, fetchAllCategories, fetchAllRecipients, fetchAllRecords, dropAllTables } from '../components/dbClient'

<<<<<<< HEAD
const TabsLayout = () => {
=======
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const RootLayout = () => {
>>>>>>> master
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
        paddingTop: 10, 
<<<<<<< HEAD
        paddingBottom: insets.bottom,
=======
        height: screenHeight *0.1
>>>>>>> master
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
        
    </Tabs>
  )
}

const RootLayout = () => {
  return (
    <SafeAreaProvider>
      <TabsLayout />
    </SafeAreaProvider>
  )
}

export default RootLayout