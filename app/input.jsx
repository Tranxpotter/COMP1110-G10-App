import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Text, useColorScheme, Pressable } from 'react-native'
import React, { useRef, useState } from 'react'
import DateTimePicker from '@react-native-community/datetimepicker';

// themed components
import ThemedText from "../components/ThemedText"
import ThemedTextInput from "../components/ThemedTextInput"
import ThemedButton from "../components/ThemedButton"
import { Colors } from '../constants/Colors'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

const Input = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [transaction_type, setTransactionType] = useState("");
  const [recipient, setRecipient] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");

  const typeInputRef = useRef(null);
  const recipientInputRef = useRef(null);
  const categoryInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const descriptionInputRef = useRef(null);

  function handleAmountInput(text) {
    let numericValue = text.replace(/[^0-9]/, '');
    numericValue = numericValue.replace(/^0+/, '');
    if (numericValue){
      setAmount(numericValue);
    } else {
      setAmount(0);
    }
  }

  async function handleSubmit() {
    if (!date.trim() || !transaction_type.trim() || !recipient.trim() || !category.trim()){
      console.log("Incomplete input");
      return;
    }

    console.log(date, transaction_type, recipient, category, amount, description);

  }

  function reset() {
    setDate(new Date())
    setTransactionType("")
    setRecipient("")
    setCategory("")
    setAmount(0)
    setDescription("")
  }

  function handleDateChange(event, selectedDate) {
    if (event?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    if (selectedDate) {
      setDate(selectedDate);
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  }

  return (
    <SafeAreaInsetsContext.Consumer>
    {insets => <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldname}>Date</ThemedText>

            <ThemedButton
              onPress={() => setShowDatePicker(true)}
            >

            </ThemedButton>

            {showDatePicker && (<DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode='date'
              is24Hour={true}
              onValueChange={(event, selectedDate) => setDate(selectedDate)}
              onChange={handleDateChange}
            />)}
            
            {/* <ThemedTextInput
              style={styles.textinput}
              value={date}
              onChangeText={setDate}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => typeInputRef.current?.focus()}
            /> */}
          </View>

          <View style={styles.fieldRow}>
            <ThemedText style={styles.fieldname}>Type</ThemedText>
            
            <ThemedTextInput
              ref={typeInputRef}
              style={styles.textinput}
              value={transaction_type}
              onChangeText={setTransactionType}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => recipientInputRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Recipient</ThemedText>
            
            
            <ThemedTextInput
              ref={recipientInputRef}
              style={styles.textinput}
              value={recipient}
              onChangeText={setRecipient}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => categoryInputRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Category</ThemedText>
            
            
            <ThemedTextInput
              ref={categoryInputRef}
              style={styles.textinput}
              value={category}
              onChangeText={setCategory}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => amountInputRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Amount</ThemedText>
            
            
            <ThemedTextInput
              keyboardType="numeric"
              ref={amountInputRef}
              style={styles.textinput}
              value={String(amount)}
              onChangeText={handleAmountInput}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => descriptionInputRef.current?.focus()}
            />
          </View>

          <View style={styles.fieldRow}>
            
            <ThemedText style={styles.fieldname}>Description</ThemedText>
            
            
            <ThemedTextInput
              ref={descriptionInputRef}
              style={styles.multiline}
              value={description}
              onChangeText={setDescription}
              multiline={true}
              // numberOfLines={5}
              textAlignVertical="top"
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={[styles.container, { flexDirection: "row", justifyContent: "space-evenly", height: "30" }]}>

          <ThemedButton 
            style={{ backgroundColor: Colors.primary , justifyContent: "center", width: "150" }}
            onPress={handleSubmit}
          >
            <Text style={{ color: "#fff", fontSize: 15, textAlign: "center"}}>Submit</Text>
          </ThemedButton>

          <ThemedButton 
            style={{ backgroundColor: Colors.warning , justifyContent: "center", width: "150" }}
            onPress={reset}
          >
            <Text style={{ color: "#fff", fontSize: 15, textAlign: "center"}}>Reset</Text>
          </ThemedButton>

        </View>



      </ScrollView>
    </KeyboardAvoidingView>}
    </SafeAreaInsetsContext.Consumer>
  )
}

export default Input

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // containerRow: {
  //   flexDirection: "row", 
  //   width: "100%"
  // }, 
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  form: {
    flex: 1,
    width: "100%",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
    columnGap: 10,
  },
  textinput: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
  },
  multiline: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    height: 100
  },
  fieldname: {
    width: 100,
    flexShrink: 0,

    fontSize: 18,
    textAlign: "right",
  },
})