import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal } from 'react-native';
import React, { useState } from 'react';
import { Link } from 'expo-router';
import { LineChart, BarChart } from "react-native-gifted-charts";
import { SelectList } from "react-native-dropdown-select-list";

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const Dashboard = () => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [selectedChart, setSelectedChart] = useState("Line");

  const dropdownData = [
    { key: 'Line', value: 'Line Chart' },
    { key: 'Bar', value: 'Bar Chart' },
  ];

  const data = [
    { value: 1000.1, month: 'Jan', label: 'Jan' }, 
    { value: 203, month: 'Feb', label: 'Feb' },
    { value: 180, month: 'Mar', label: 'Mar' }, 
    { value: -40, month: 'Apr', label: 'Apr' },
    { value: 0, month: 'May', label: 'May' }, 
    { value: -3, month: 'Jun', label: 'Jun' },
    { value: -1310, month: 'Jul', label: 'Jul' }, 
    { value: -1225, month: 'Aug', label: 'Aug' },
    { value: -900, month: 'Sep', label: 'Sep' }, 
    { value: -86, month: 'Oct', label: 'Oct' },
    { value: -130, month: 'Nov', label: 'Nov' }, 
    { value: 21, month: 'Dec', label: 'Dec' },
  ];

  // Dynamic axis and color logic
  const absMax = Math.max(...data.map(d => Math.abs(d.value)));
  const yAxisRange = Math.ceil((absMax * 1.2) / 10) * 10;
  const dynamicData = data.map(item => ({
    ...item,
    frontColor: item.value >= 0 ? '#0BA5A4' : '#d32f2f',
  }));

  const totalAmount = data.reduce((acc, item) => acc + Math.round(item.value * 100), 0) / 100;
  // Calculate the exact spacing to fit all 12 months within the available width
  const chartWidth = screenWidth * 0.8;
  const numberOfPoints = data.length;
  // Formula: (Total Width - Y-Axis Width) / (Number of data points - 1)
  const dynamicSpacing = (chartWidth - 40) / (numberOfPoints - 1);

  return (
    <View style={styles.container}>
      {/* HEADER SECTION (Fixed height) */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <View style={styles.dropdownContainer}>
          <SelectList 
            setSelected={(val) => setSelectedChart(val)} 
            data={dropdownData} 
            save="key"
            defaultOption={{ key: 'Line', value: 'Line Chart' }}
            search={false}
            boxStyles={styles.dropdownBox}
            dropdownStyles={styles.dropdownListFloating}
          />
        </View>
      </View>

      {/* CHART SECTION (Responsive Flex) */}
      <View style={styles.chartSection}>
        <View style={styles.chartWrapper}>
          {selectedChart === 'Line' ? (
            <LineChart 
              data={data} 
              color="#0BA5A4" 
              width={chartWidth}
              height={screenHeight * 0.1} // Chart drawing area
              noOfSections={4}
              maxValue={yAxisRange}
              mostNegativeValue={-yAxisRange}
              areaChart
              disableScroll={true}
              initialSpacing={0}
              startFillColor="#0BA5A4"
              startOpacity={0.1}
              yAxisLabelWidth={40}
              xAxisLabelTextStyle={{fontSize: 12}}
              xAxisLabelsVerticalShift = {screenHeight * 0.1}
              spacing={dynamicSpacing}
            />
          ) : (
            <BarChart 
              data={dynamicData} 
              width={chartWidth}
              height={screenHeight * 0.1}
              barWidth={10}
              noOfSections={4}
              maxValue={yAxisRange}
              mostNegativeValue={-yAxisRange}
              initialSpacing={10}
              yAxisLabelWidth={40}
              disableScroll={true}
              xAxisLabelTextStyle={{fontSize: 12}}
              xAxisLabelsVerticalShift = {screenHeight * 0.1}
              spacing={dynamicSpacing-10}
            />
          )}
        </View>
      </View>

      {/* TABLE SECTION (Responsive Flex) */}
      <View style={styles.tableSection}>
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHeader, { flex: 1 }]}>Month</Text>
            <Text style={[styles.columnHeader, { flex: 2, textAlign: 'right', paddingRight: 20 }]}>Total Spending/Income</Text>
          </View>
          <ScrollView style={styles.scrollBody}>
            {data.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.cell, { flex: 1 }]}>{item.month}</Text>
                <Text style={[styles.cell, { flex: 2, textAlign: 'right', paddingRight: 20, fontWeight: 'bold', color: item.value >= 0 ? '#2e7d32' : '#d32f2f' }]}>
                  {item.value >= 0 ? `+$${item.value.toFixed(2)}` : `-$${Math.abs(item.value).toFixed(2)}`}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.summaryRow}>
            <Text style={[styles.cell, { flex: 1, fontWeight: 'bold' }]}>Summary</Text>
            <Text style={[styles.cell, { flex: 2, textAlign: 'right', paddingRight: 20, fontWeight: 'bold', color: totalAmount >= 0 ? '#2e7d32' : '#d32f2f' }]}>
              {totalAmount >= 0 ? `+$${totalAmount.toFixed(2)}` : `-$${Math.abs(totalAmount).toFixed(2)}`}
            </Text>
          </View>
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
  },
  header: {
    paddingTop: 30,
    alignItems: 'center',
    paddingBottom: 10,
  },
  title: {
    fontSize: screenHeight * 0.03,
    fontWeight: 'bold',
  },
  dropdownContainer: {
    flex: 1,
    width: '65%',
    zIndex: 1000,
  },
  dropdownBox: {
    borderColor: '#eee',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    height: 45,
  },
  dropdownListFloating: {
    position: 'absolute',
    backgroundColor: 'white',
    width: '100%',
    top: 45,
    zIndex: 999,
    elevation: 5,
    borderColor: '#eee',
  },

  // Responsive Chart Area
  chartSection: {
    flex: 3, // Takes 3 parts of available height
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  chartWrapper: {
    width: screenWidth,
    alignItems: 'center',
    paddingBottom: 20,
  },

  // Responsive Table Area
  tableSection: {
    flex: 4, // Takes 4 parts of available height (bigger than chart)
    paddingHorizontal: '5%',
    paddingBottom: 10,
  },
  tableContainer: {
    flex: 1, // Fills the tableSection
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scrollBody: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  columnHeader: { padding: 12, fontWeight: 'bold', fontSize: 14 },
  cell: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f0fdfa',
    borderTopWidth: 2,
    borderTopColor: '#0BA5A4',
    alignItems: 'center',
    paddingVertical: 5,
  },

  // Footer Area
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '5%',
    paddingBottom: 30,
    paddingTop: 10,
  },
  centerButton: {
    backgroundColor: '#0BA5A4',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    minWidth: 140,
    elevation: 3,
  },
  sideButton: {
    width: 65,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#0BA5A4',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sideButtonText: { color: '#0BA5A4', fontWeight: 'bold', fontSize: 13 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '80%', padding: 25, borderRadius: 15, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  applyBtn: { backgroundColor: '#0BA5A4', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10, width: '100%' },
  applyBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
});