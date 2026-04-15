import { StyleSheet, Text, View, Dimensions, TouchableOpacity } from 'react-native';
import React from 'react';
import { Link } from 'expo-router';
import { LineChart } from "react-native-gifted-charts";

// Get screen width for better chart scaling
const screenWidth = Dimensions.get('window').width;

const Dashboard = () => {
  // Added labels for the Month column
  const data = [
    { value: 10, month: 'Jan' },
    { value: 20, month: 'Feb' },
    { value: 18, month: 'Mar' },
    { value: -20, month: 'Apr' }
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      
      {/* This container will now grow to fill the middle space */}
      <View style={styles.chartWrapper}>
        <LineChart 
          data={data} 
          color="#0BA5A4" 
          thickness={3}
          width={screenWidth * 0.8} // Sets chart width to 80% of screen
          height={100}            // Total height of the chart drawing area
          noOfSections={4}        // Number of horizontal scale lines
          areaChart
          startFillColor="#0BA5A4"
          startOpacity={0.2}
          endOpacity={0.01}
        />
      </View>

      {/* Table Section */}
      <View style={styles.tableContainer}>
        {/* Table Header - Changed from div to View */}
        <View style={styles.tableHeader}>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Month</Text>
          <Text style={[styles.columnHeader, { flex: 2 }]}>Total Spent/Income</Text>
        </View>

        {/* Table Rows */}
        {data.map((item, index) => {
          // Determine color based on positive or negative value
          const isPositive = item.value >= 0;
          const amountColor = isPositive ? '#2e7d32' : '#d32f2f'; // Green vs Red

          return (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 1 }]}>{item.month}</Text>
              
              {/* Dynamic styling applied here */}
              <Text style={[
                styles.cell, 
                { flex: 2, color: amountColor, fontWeight: 'bold' }
              ]}>
                {isPositive ? `+$${item.value}.00` : `-$${Math.abs(item.value)}.00`}
              </Text>
            </View>
          );
        })}
      </View>

      
        {/* Wrap the Link in asChild so it behaves like a button */}
      <Link href="/" asChild>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Back home</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

export default Dashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  }, 
  title: {
    marginTop: 50,
    fontSize: 28,
    fontWeight: 'bold',
  }, 
  chartWrapper: {
    marginTop: 10,
    marginBottom: 20,
    // Ensure no extra padding is pushing the chart to one side
    alignItems: 'center',
    justifyContent: 'center',
    width: screenWidth,
  },
  tableContainer: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  columnHeader: {
    padding: 12,
    fontWeight: 'bold',
    color: '#333',
    fontSize: 14,
  },
  cell: {
    padding: 12,
    color: '#555',
    fontSize: 14,
  },
  button: {
    marginTop: 'auto',
    marginBottom: 40,
    backgroundColor: '#0BA5A4', // Matching chart color
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,          // Rounded corners
    elevation: 3,               // Shadow for Android
    shadowColor: '#000',        // Shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  }
});