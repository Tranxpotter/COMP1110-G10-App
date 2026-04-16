import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal } from 'react-native';
import React, { useState } from 'react';;
import { Link } from 'expo-router';
import { LineChart } from "react-native-gifted-charts";

// Get screen width for better chart scaling
const screenWidth = Dimensions.get('window').width;

const Dashboard = () => {
  // States for two different modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);

  // Added labels for the Month column
  const data = [
    { value: 1000.1, month: 'Jan', label: 'Jan' }, 
    { value: 203, month: 'Feb', label: 'Feb' },
    { value: 180, month: 'Mar', label: 'Mar' }, 
    { value: -40, month: 'Apr', label: 'Apr' },
    { value: 0, month: 'May', label: 'May' }, 
    { value: -3, month: 'Jun', label: 'Jun' },
    { value: -1310, month: 'Jul', label: 'Jul' }, 
    { value: 225, month: 'Aug', label: 'Aug' },
  ];

  // Calculate fixed y-axis range to keep chart consistent
  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));
  const yAxisRange = Math.ceil((absMax * 1.2) / 10) * 10; // Round to nearest multiple of 10 with 20% padding

  // Calculate the total sum of all values
  const totalAmount = data.reduce((acc, item) => {
    // Multiply by 100 and round to clear any existing float errors
    return acc + Math.round(item.value * 100);
  }, 0) / 100;
  const isTotalPositive = totalAmount >= 0;
  const totalColor = isTotalPositive ? '#2e7d32' : '#d32f2f';

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
          height={50}            // Fixed height for the chart
          noOfSections={4}        // Number of horizontal scale lines
          xAxisThickness={2}
          xAxisLabelsVerticalShift = {50} // Moves x-axis labels closer to the line
          areaChart
          startFillColor="#0BA5A4"
          startOpacity={0.2}
          endOpacity={0.01}
          // Fix y-axis alignment and scaling
          yAxisLabelWidth={35}
          yAxisTextStyle = {{fontSize: 10,}}
          yAxisAtOrigin
          yAxisThickness={2}
          maxValue={yAxisRange}
          hideDataPoints={false}
          spacing={40}
          initialSpacing={10}
          adjustToWidth
        />
      </View>

      {/* --- TABLE SECTION --- */}
      <View style={styles.tableContainer}>
        {/* Fixed Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Month</Text>
          {/* Added textAlign: 'right' and extra paddingRight to match the rows */}
          <Text style={[styles.columnHeader, { flex: 2, textAlign: 'right', paddingRight: 20 }]}>
            Total Spent/Income
          </Text>
        </View>

        {/* Scrollable Rows */}
        <ScrollView style={styles.scrollBody}>
          {data.map((item, index) => {
            const isPositive = item.value >= 0;
            const amountColor = isPositive ? '#2e7d32' : '#d32f2f';
            return (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.cell, { flex: 1 }]}>{item.month}</Text>
                {/* Use textAlign: 'right' here */}
                <Text style={[styles.cell, { flex: 2, color: amountColor, fontWeight: 'bold', textAlign: 'right', paddingRight: 20 }]}>
                  {isPositive ? `+$${item.value.toFixed(2)}` : `-$${Math.abs(item.value)}.00`}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Fixed Summary Row */}
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, { flex: 1, fontWeight: 'bold' }]}>Summary</Text>
          <Text style={[styles.cell, { flex: 2, color: totalColor, fontWeight: 'bold', textAlign: 'right', paddingRight: 20 }]}>
            {/* .toFixed(2) ensures two decimal places are always shown */}
            {isTotalPositive ? `+$${totalAmount.toFixed(2)}` : `-$${Math.abs(totalAmount).toFixed(2)}`}
          </Text>
        </View>
      </View>

      {/* --- FOOTER WITH THREE BUTTONS --- */}
      <View style={styles.footerContainer}>
        {/* Left Side: Chart Button */}
        <TouchableOpacity style={styles.sideButton} onPress={() => setChartModalVisible(true)}>
          <Text style={styles.sideButtonText}>Chart</Text>
        </TouchableOpacity>

        {/* Center: Back Home Button */}
        <Link href="/" asChild>
          <TouchableOpacity style={styles.centerButton}>
            <Text style={styles.buttonText}>Back home</Text>
          </TouchableOpacity>
        </Link>

        {/* Right Side: Filter Button */}
        <TouchableOpacity style={styles.sideButton} onPress={() => setFilterModalVisible(true)}>
          <Text style={styles.sideButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* --- CHART MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={chartModalVisible}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setChartModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chart Settings</Text>
            <Text style={styles.modalSubtitle}>Customize how your data is visualized.</Text>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setChartModalVisible(false)}>
              <Text style={styles.applyBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* --- FILTER MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={filterModalVisible}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Data</Text>
            <Text style={styles.modalSubtitle}>Choose specific months or values to display.</Text>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    height: 240,
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
    zIndex: 1,
  },
  scrollBody: {
    flex: 1,                 // Allows the scroll area to fill the container height
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
    paddingHorizontal: 12,
    paddingVertical: 3,
    color: '#555',
    fontSize: 14,
  },

  // NEW SUMMARY ROW STYLES
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa', // Light tint to make it stand out
    borderTopWidth: 2,
    borderTopColor: '#0BA5A4',
    paddingVertical: 10,
    alignItems: 'center',
  },
  summaryText: {
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },

  // FOOTER & BUTTONS
  footerContainer: {
    marginTop: 'auto',
    marginBottom: 40,
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Centers the children
  },
  invisibleSpacer: {
    width: 60, // Matches width of filter button to counterbalance it
  },
  button: {
    backgroundColor: '#0BA5A4',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    flex: 1, // Let center button take up core space
    maxWidth: 160,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterButton: {
    marginLeft: 'auto', // Pushes it to the far right
    width: 60,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#0BA5A4',
    alignItems: 'center',
  },
  filterText: {
    color: '#0BA5A4',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // MODAL STYLES
  // FOOTER & BUTTONS
  footerContainer: {
    marginTop: 'auto',
    marginBottom: 40,
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Ensures side buttons stay at edges
  },
  centerButton: {
    backgroundColor: '#0BA5A4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 140,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sideButton: {
    width: 65,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#0BA5A4',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  sideButtonText: { color: '#0BA5A4', fontWeight: 'bold', fontSize: 13 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '80%', padding: 25, borderRadius: 15, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  applyBtn: { backgroundColor: '#0BA5A4', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10, width: '100%' },
  applyBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
});