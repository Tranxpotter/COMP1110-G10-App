import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

const Input = () => {
  return (
    <View style={styles.container}>

      <Text style={styles.title}>Input Page</Text>
      <Link href="/" style={styles.link}>Back home</Link>

    </View>

  )
}

export default Input

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