import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

const Dashboard = () => {
  return (
    <View style={styles.container}>

      <Text style={styles.title}>Dashboard Page</Text>
      <Link href="/" style={styles.link}>Back home</Link>

    </View>

  )
}

export default Dashboard

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center", 
    justifyContent: "center"
  }, 
  title: {
    fontSize: 20
  }, 
  link: {
    borderBottomWidth: 1
  }
})