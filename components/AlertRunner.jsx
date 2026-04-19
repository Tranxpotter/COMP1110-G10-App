import React from 'react'
import { View, Button, Text, StyleSheet, Alert } from 'react-native'
import { useAlertRules } from '../hooks/useAlertRules'

export default function AlertRunner() {
  /* all default options and desctiptions (note these all should be passed as key value pairs in dict format)
    u find a way to store user choice(or u might want to store in db because u don't want user to choose everytime they use isn't it?)


    resetDay = 1, (for all alert ruls that need reset day of month)
    bigPaymentPercent = 50 (for bigpayment alert quiteria)
    bigPaymentMinAmount = 0(for bigpayment alert quiteria)
    amountThreshold = 0 (for spending vs income)
    percentThreshold= 0 (for spending vs income)
    recurringCount = 3 (for recurring times of recipient)i.e. I went to KFC 3 times.
    surAmountThreshold = 0 (for surplus rule trigger)
    surPercentThreshold = 0 (fro surplus rule trigger)
    goalAmount = 0 (savings goal amount)
   

    useAlertRules({ resetDay: 10 }) //example of how to change resetDay
   
   */
  const { alerts, runRules, clearAlerts } = useAlertRules({ resetDay: 1 }) 

  async function onRun() {
    const res = await runRules() // uses resetDay = 1
    if (!res || res.length === 0) {
      Alert.alert('Rules', 'No alerts triggered')
      return
    }
    // show first alert as modal and log rest to console
    Alert.alert(res[0].title || 'Alert', res[0].message)
    console.log('Alert rules triggered:', res)
  }


  //change how it looks here, mainly use a button to run alerts I think, but u can call the function by following my code directly
  return (
    <View style={styles.container}>
      <Button title="Run Alert Rules" onPress={onRun} />
      {alerts.length ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.count}>{alerts.length} alerts</Text>
          <Button title="Clear" onPress={clearAlerts} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 8 },
  count: { marginVertical: 6, fontWeight: '600' }
})