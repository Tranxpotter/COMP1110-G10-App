import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal, FlatList } from 'react-native';
import React, { useState } from 'react';
import { Link } from 'expo-router';
import { LineChart, BarChart } from "react-native-gifted-charts";
import { SelectList } from "react-native-dropdown-select-list";

const screenWidth = Dimensions.get('window').width;

const Dashboard = () => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [selectedChart, setSelectedChart] = useState("Line");
  
// Data for the dropdown
  const dropdownData = [
    { key: 'Line', value: 'Line Chart' },
    { key: 'Bar', value: 'Bar Chart' },
  ];

  const chartOptions = ['Line', 'Bar'];

  const data = [
    { value: 1000.1, month: 'Jan', label: 'Jan', frontColor: '#0BA5A4' }, 
    { value: 203, month: 'Feb', label: 'Feb', frontColor: '#0BA5A4' },
    { value: 180, month: 'Mar', label: 'Mar', frontColor: '#0BA5A4' }, 
    { value: -40, month: 'Apr', label: 'Apr', frontColor: '#0BA5A4' },
    { value: 0, month: 'May', label: 'May', frontColor: '#0BA5A4' }, 
    { value: -3, month: 'Jun', label: 'Jun', frontColor: '#0BA5A4' },
    { value: -1310, month: 'Jul', label: 'Jul', frontColor: '#0BA5A4' }, 
    { value: -1225, month: 'Aug', label: 'Aug', frontColor: '#0BA5A4' },
    { value: -900, month: 'Sep', label: 'Sep', frontColor: '#0BA5A4' }, 
    { value: -86, month: 'Oct', label: 'Oct', frontColor: '#0BA5A4' },
    { value: -130, month: 'Nov', label: 'Nov', frontColor: '#0BA5A4' }, 
    { value: 21, month: 'Dec', label: 'Dec', frontColor: '#0BA5A4' },
  ];

  const maxVal = Math.max(...data.map(d => d.value));
  const minVal = Math.min(...data.map(d => d.value));
  const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));
  const yAxisRange = Math.ceil((absMax * 1.2) / 10) * 10;

  const totalAmount = data.reduce((acc, item) => acc + Math.round(item.value * 100), 0) / 100;
  const isTotalPositive = totalAmount >= 0;
  const totalColor = isTotalPositive ? '#2e7d32' : '#d32f2f';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>

      {/* --- SELECT LIST DROPDOWN --- */}
      <View style={styles.dropdownContainer}>
        <SelectList 
          setSelected={(val) => setSelectedChart(val)} 
          data={dropdownData} 
          save="key"
          defaultOption={{ key: 'Line', value: 'Line Chart' }}
          search={false} // Keeps it clean
          boxStyles={styles.dropdownBox}
          dropdownStyles={styles.dropdownListFloating}
          inputStyles={styles.dropdownInput}
        />
      </View>

      {/* CONDITIONAL CHART RENDERING */}
      <View style={styles.chartWrapper}>
        {selectedChart === 'Line' ? (
          <LineChart 
            data={data} 
            color="#0BA5A4" 
            thickness={3}
            width={screenWidth * 0.8}
            height={50}
            noOfSections={4}
            xAxisLabelsVerticalShift={45}
            areaChart
            startFillColor="#0BA5A4"
            startOpacity={0.2}
            yAxisLabelWidth={35}
            yAxisTextStyle={{ fontSize: 10 }}
            maxValue={yAxisRange}
            mostNegativeValue={-yAxisRange}
            spacing={40}
            initialSpacing={10}
          />
        ) : (
          <BarChart 
            data={data} 
            barWidth={18}
            noOfSections={4}
            barBorderRadius={4}
            frontColor="#0BA5A4"
            width={screenWidth * 0.8}
            height={50}
            yAxisTextStyle={{ fontSize: 10 }}
            yAxisLabelWidth={35}
            maxValue={yAxisRange}
            mostNegativeValue={-yAxisRange}
            xAxisLabelsVerticalShift={45}
          />
        )}
      </View>

      {/* --- TABLE SECTION (remains the same) --- */}
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Month</Text>
          <Text style={[styles.columnHeader, { flex: 2, textAlign: 'right', paddingRight: 20 }]}>
            Total Spending/Income
          </Text>
        </View>
        <ScrollView style={styles.scrollBody}>
          {data.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cell, { flex: 1 }]}>{item.month}</Text>
              <Text style={[styles.cell, { flex: 2, color: item.value >= 0 ? '#2e7d32' : '#d32f2f', fontWeight: 'bold', textAlign: 'right', paddingRight: 20 }]}>
                {item.value >= 0 ? `+$${item.value.toFixed(2)}` : `-$${Math.abs(item.value).toFixed(2)}`}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, { flex: 1, fontWeight: 'bold' }]}>Summary</Text>
          <Text style={[styles.cell, { flex: 2, color: totalColor, fontWeight: 'bold', textAlign: 'right', paddingRight: 20 }]}>
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
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  title: { marginTop: 20, fontSize: 28, fontWeight: 'bold' },

  // --- NEW DROPDOWN STYLES ---
  dropdownContainer: {
    width: '60%',
    zIndex: 1000, 
  },
  dropdownBox: {
    borderColor: '#eee',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    height: 45,
    alignItems: 'center',
  },
  dropdownListFloating: {
    // This makes the list float instead of pushing content
    position: 'absolute',
    backgroundColor: 'white',
    width: '100%',
    top: 40, // Adjust based on your box height
    zIndex: 999,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5, // Adds shadow for Android
  },
  dropdownInput: { 
    fontSize: 14, 
    color: '#333' 
  },
  
  chartWrapper: { 
    marginTop: 10, 
    marginBottom: 5, 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: screenWidth,
    // Ensure this has a lower zIndex than the dropdown
    zIndex: 1, 
  },
  optionText: { fontSize: 14, color: '#555' },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  chartWrapper: { marginTop: 10, marginBottom: 5, alignItems: 'center', justifyContent: 'center', width: screenWidth },
  tableContainer: { width: '90%', height: 240, borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee' },
  scrollBody: { flex: 1 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  columnHeader: { padding: 12, fontWeight: 'bold', color: '#333', fontSize: 14 },
  cell: { paddingHorizontal: 12, paddingVertical: 8, color: '#555', fontSize: 14 },
  summaryRow: { flexDirection: 'row', backgroundColor: '#f0fdfa', borderTopWidth: 2, borderTopColor: '#0BA5A4', paddingVertical: 10, alignItems: 'center' },

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
    marginTop: 5,
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
    marginTop: 5,
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