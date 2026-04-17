import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Button } from 'react-native';
import React, { useMemo, useState, useEffect } from 'react';
import { LineChart, BarChart } from "react-native-gifted-charts";
import PagerView from 'react-native-pager-view';
import RadioGroup from 'react-native-radio-buttons-group';
import { fetchAllRecords, initTables } from '../components/dbClient';
import {MaterialIcons} from '@expo/vector-icons';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const year = 2023;

const items = [
  // this is the parent or 'item'
  {
    name: 'Fruits',
    id: 0,
    // these are the children or 'sub items'
    children: [
      {
        name: 'Apple',
        id: 10,
      },
      {
        name: 'Strawberry',
        id: 17,
      },
      {
        name: 'Pineapple',
        id: 13,
      },
      {
        name: 'Banana',
        id: 14,
      },
      {
        name: 'Watermelon',
        id: 15,
      },
      {
        name: 'Kiwi fruit',
        id: 16,
      },
    ],
  },

];


const formatRecordsToChartData = (records = []) => {
  const monthly = MONTH_LABELS.map(label => ({ month: label, label, value: 0 }));

  records.forEach(record => {
    const amount = Number(record.amount) || 0;
    const transactionType = record.type;
    const dateValue = record.date ? new Date(record.date) : null;
    const monthIndex = dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue.getMonth() : null;
    const yearIndex = dateValue instanceof Date && !Number.isNaN(dateValue.getTime()) ? dateValue.getFullYear() : null;

    if (monthIndex !== null && monthIndex >= 0 && monthIndex < 12 && yearIndex == year) {
      if (transactionType == "spending") {
        monthly[monthIndex].value -= amount;
      }
      else if (transactionType == "income") {
        monthly[monthIndex].value += amount;
      }
    }
  });

  return monthly;
};

const Dashboard = () => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        await initTables();
        const records = await fetchAllRecords();
        setData(formatRecordsToChartData(records));
      } catch (error) {
        console.error('Dashboard load error', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const charts = useMemo(() => ([
    {
      id: '1', // acts as primary key, should be unique and non-empty string
      label: 'Option 1',
      value: 'option1'
    },
    {
      id: '2',
      label: 'Option 2',
      value: 'option2'
    }
  ]), []);

  const [selectedId, setSelectedId] = useState();
  const [selectedItems, setSelectedItems] = useState([]);

  const onSelectedItemsChange = (items) => {
    setSelectedItems(items);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0BA5A4" style={{ marginTop: 40 }} />
      </View>
    );
  }

  // Dynamic axis and color logic
  const absMax = Math.max(...data.map(d => Math.abs(d.value)));
  const yAxisRange = Math.ceil((absMax * 1.2) / 10) * 10;
  const dynamicData = data.map(item => ({
    ...item,
    frontColor: item.value >= 0 ? '#0BA5A4' : '#d32f2f',
  }));

  const totalAmount = data.reduce((acc, item) => acc + Math.round(item.value * 100), 0) / 100;
  const chartWidth = screenWidth * 0.8;
  const numberOfPoints = data.length;
  const dynamicSpacing = (chartWidth - 40) / (numberOfPoints - 1);

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        
        {/* PAGINATION DOTS */}
        <View style={styles.paginationDots}>
          <View style={[styles.dot, currentPage === 0 && styles.activeDot]} />
          <View style={[styles.dot, currentPage === 1 && styles.activeDot]} />
        </View>
      </View>

      {/* CHART SECTION (Responsive Flex) */}
      <PagerView 
        style={styles.pagerView} 
        initialPage={0} 
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        <View key="1" style={styles.page}>
          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>Spending Trend (Line)</Text>
            <LineChart 
              data={data} 
              color="#0BA5A4" 
              width={chartWidth}
              height={screenHeight * 0.1}
              noOfSections={4}
              maxValue={yAxisRange}
              mostNegativeValue={-yAxisRange}
              areaChart
              disableScroll={true}
              initialSpacing={10}
              startFillColor="#0BA5A4"
              startOpacity={0.1}
              yAxisLabelWidth={40}
              xAxisLabelTextStyle={{fontSize: 12}}
              xAxisLabelsVerticalShift = {screenHeight * 0.1}
              spacing={dynamicSpacing}
            />
          </View>
          <TableComponent data={data} />
        </View>

          {/* PAGE 2: BAR CHART DASHBOARD */}
          <View key="2" style={styles.page}>
            <View style={styles.chartSection}>
              <Text style={styles.chartLabel}>Monthly Volume (Bar)</Text>
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
          </View>
          <TableComponent data={data} />
        </View>
      </PagerView>

      {/* --- FOOTER WITH TWO BUTTONS --- */}
      <View style={styles.footerContainer}>
        {/* Left Side: Chart Button */}
        <TouchableOpacity style={styles.sideButton} onPress={() => setChartModalVisible(true)}>
          <Text style={styles.sideButtonText}>Chart</Text>
        </TouchableOpacity>

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
            <RadioGroup 
              radioButtons={charts} 
              onPress={setSelectedId}
              selectedId={selectedId}
            />
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
            <View>
              <SectionedMultiSelect
                items={items}
                IconRenderer={MaterialIcons}
                uniqueKey="id"
                subKey="children"
                displayKey="name"
                selectText="Choose some things..."
                alwaysShowSelectText={true}
                showDropDowns={true}
                onSelectedItemsChange={onSelectedItemsChange}
                selectedItems={selectedItems}
                styles={{
                  selectToggle: {
                    marginTop: 10,
                    padding: 14,
                    width: screenWidth * 0.8 - 60,
                    borderWidth: 1,
                    borderColor: '#ccc',
                    borderRadius: 10,
                    backgroundColor: '#fff'
                  },
                  selectToggleText: {
                    color: '#333',
                    fontSize: 16
                  },
                  searchBar: {
                    backgroundColor: '#f5f5f5',
                    borderRadius: 10,
                    marginBottom: 10
                  },
                  searchTextInput: {
                    color: '#000'
                  },
                  chipsWrapper: {
                    marginTop: 12,
                    flexWrap: 'wrap'
                  },
                  chipContainer: {
                    backgroundColor: '#E3F2FD',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    margin: 4
                  },
                  chipText: {
                    color: '#0BA5A4'
                  }
                }}
              />
            </View>
            <TouchableOpacity style={styles.applyBtn} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Reusable Table
const TableComponent = ({ data }) => {
  const totalAmount = data.reduce((acc, item) => acc + Math.round(item.value * 100), 0) / 100;
  return (
    <View style={styles.tableSection}>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.columnHeader, { flex: 1 }]}>Month</Text>
          <Text style={[styles.columnHeader, { flex: 2, textAlign: 'right', paddingRight: 20 }]}>Amount</Text>
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
            ${totalAmount.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingTop: 50, alignItems: 'center' },
  title: { fontSize: screenHeight * 0.03, fontWeight: 'bold' },

  // Pagination Dots
  paginationDots: { flexDirection: 'row', marginTop: 10, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd', marginHorizontal: 4 },
  activeDot: { backgroundColor: '#0BA5A4', width: 20 },

  pagerView: { flex: 1 },
  page: { flex: 1 },

  // Responsive Chart Area
  chartSection: {flex: 3, justifyContent: 'center', alignItems: 'center', zIndex: 1,},
  chartLabel: { fontSize: 14, color: '#333', marginBottom: 10, fontWeight: '500' },

  // Responsive Table Area
  tableSection: {flex: 4, paddingHorizontal: '5%', paddingBottom: 10},
  tableContainer: {flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 10, overflow: 'hidden'},
  tableHeader: {flexDirection: 'row', backgroundColor: '#f9f9f9', borderBottomWidth: 1, borderBottomColor: '#eee'},
  scrollBody: {flex: 1},
  tableRow: {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center'},
  columnHeader: { padding: 12, fontWeight: 'bold', fontSize: 14 },
  cell: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  summaryRow: {flexDirection: 'row', backgroundColor: '#f0fdfa', borderTopWidth: 2, borderTopColor: '#0BA5A4', alignItems: 'center', paddingVertical: 5},

  // Footer Area
  footerContainer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '5%', paddingBottom: 30, paddingTop: 10},

  sideButton: {width: screenWidth*0.4, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#0BA5A4', alignItems: 'center', backgroundColor: '#fff'},
  sideButtonText: { color: '#0BA5A4', fontWeight: 'bold', fontSize: 13 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', width: '80%', padding: 25, borderRadius: 15, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  applyBtn: { backgroundColor: '#0BA5A4', paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10, width: '100%' },
  applyBtnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
});