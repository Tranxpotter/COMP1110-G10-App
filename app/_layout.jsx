import { View, Text, useColorScheme } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Colors } from '../constants/Colors'

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? colorScheme.light

  return (
    <Tabs 
      screenOptions={{ headerShown: false, tabBarStyle: {
        backgroundColor: theme.navBackground, 
        paddingTop: 10, 
        height: 90
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

export default RootLayout