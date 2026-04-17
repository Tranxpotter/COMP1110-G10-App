import { View, Text, useColorScheme, Dimensions } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { Colors } from '../constants/Colors'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const RootLayout = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? colorScheme.light

  return (
    <SafeAreaProvider>
    <Tabs 
      screenOptions={{ headerShown: false, tabBarStyle: {
        backgroundColor: theme.navBackground, 
        paddingTop: 10, 
        height: screenHeight *0.1
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
    </SafeAreaProvider>
  )
}

export default RootLayout