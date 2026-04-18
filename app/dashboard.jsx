import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Button } from 'react-native';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native'; // Add this import
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import PagerView from 'react-native-pager-view';
import RadioGroup from 'react-native-radio-buttons-group';
import { fetchAllRecords, initTables } from '../components/dbClient';
import {MaterialIcons} from '@expo/vector-icons';
import SectionedMultiSelect from 'react-native-sectioned-multi-select';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const initialFilters = [
  // this is the parent or 'item'
  {
    name: 'Categaries',
    id: 0,
    // only allow one child selection under this parent
    singleChildren: true,
    children: [
      {
        name: 'Apple',
        id: 110,
      },
      {
        name: 'Strawberry',
        id: 117,
      },
      {
        name: 'Pineapple',
        id: 113,
      },
      {
        name: 'Banana',
        id: 114,
      },
      {
        name: 'Watermelon',
        id: 115,
      },
      {
        name: 'Kiwi fruit',
        id: 116,
      },
    ],
  },
  {
    name: 'Recipients',
    id: 1,
    // allow multiple child selections under this parent
    singleChildren: false,
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

    if (monthIndex !== null && monthIndex >= 0 && monthIndex < 12) {
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
  const [items, setItems] = useState(initialFilters);


  const addMoreChildren = () => {
    const updatedItems = [...items];
    // Find the parent and push new children into its array
    updatedItems[0].children.push({ name: 'Mango', id: 25 }); 
    setItems(updatedItems);
  };

  // 1. Move the fetching logic into a reusable function
  const loadData = useCallback(async () => {
    try {
      // No need to initTables every time if already done once
      const records = await fetchAllRecords();
      setData(formatRecordsToChartData(records));
    } catch (error) {
      console.error('Dashboard load error', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Use useFocusEffect instead of useEffect
  // This runs every time the Dashboard screen comes into view
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  
  const charts = useMemo(() => ([
    {
      id: 'Line', // Used as the key for logic
      label: 'Line Chart',
      value: 'Line',
      color: '#0BA5A4',
      selected: true, // Default selection
    },
    {
      id: 'Bar',
      label: 'Bar Chart',
      value: 'Bar',
      color: '#0BA5A4',
    }
  ]), []);

  const page2Charts = useMemo(() => ([
    {
      id: 'Bar',
      label: 'Bar Chart',
      value: 'Bar',
      color: '#0BA5A4',
      selected: true,
    },
    {
      id: 'Pie',
      label: 'Pie Charts',
      value: 'Pie',
      color: '#0BA5A4',
    }
  ]), []);

  // Initialize state to 'Line'
  const [selectedId, setSelectedId] = useState('Line');
  const [page2ChartType, setPage2ChartType] = useState('Bar');
  const [selectedItems, setSelectedItems] = useState([]);

  const singleSelectionParentIds = items
    .filter(parent => parent.singleChildren)
    .map(parent => parent.id);

  const childToParentMap = items.reduce((map, parent) => {
    parent.children?.forEach(child => {
      map[child.id] = parent.id;
    });
    return map;
  }, {});

  const normalizeSelectedItems = (selectedIds) => {
    const singleParentSelections = {};

    selectedIds.forEach(id => {
      const parentId = childToParentMap[id];
      if (singleSelectionParentIds.includes(parentId)) {
        singleParentSelections[parentId] = singleParentSelections[parentId] || [];
        singleParentSelections[parentId].push(id);
      }
    });

    return selectedIds.filter(id => {
      const parentId = childToParentMap[id];
      if (!singleSelectionParentIds.includes(parentId)) {
        return true;
      }
      const selectedForParent = singleParentSelections[parentId];
      return selectedForParent[selectedForParent.length - 1] === id;
    });
  };

  const onSelectedItemsChange = (items) => {
    setSelectedItems(normalizeSelectedItems(items));
  };

  const multiSelectStyles = {
    modalWrapper: { backgroundColor: 'rgba(0,0,0,0.4)' },
    selectToggle: {
      marginTop: 10,
      padding: 14,
      width: screenWidth * 0.8 - 60,
      borderWidth: 1,
      borderColor: '#0BA5A4',
      borderRadius: 10,
      backgroundColor: '#f0fdfa',
    },
    selectToggleText: {
      color: '#0B7285',
      fontSize: 16,
    },
    item: {
      padding: 14,
      backgroundColor: '#ffffff',
    },
    selectedItem: {
      backgroundColor: '#d1fae5',
    },
    subItem: {
      paddingLeft: 26,
      paddingVertical: 12,
      backgroundColor: '#f8fafc',
    },
    selectedSubItem: {
      backgroundColor: '#c7f0e8',
    },
    itemText: {
      color: '#0f766e',
      fontSize: 15,
    },
    selectedItemText: {
      color: '#115e59',
      fontWeight: 'bold',
    },
    subItemText: {
      color: '#164e63',
      fontSize: 14,
    },
    selectedSubItemText: {
      color: '#0f5662',
      fontWeight: 'bold',
    },
    searchBar: {
      backgroundColor: '#e0f2fe',
      borderRadius: 10,
      marginBottom: 10,
    },
    searchTextInput: {
      color: '#0f172a',
    },
    chipsWrapper: {
      marginTop: 12,
      flexWrap: 'wrap',
    },
    chipContainer: {
      backgroundColor: '#0BA5A4',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      margin: 4,
    },
    chipText: {
      color: '#fff',
    },
    cancelButton: {
      backgroundColor: '#ef4444',
    },
    button: {
      backgroundColor: '#0BA5A4',
    },
    confirmText: {
      color: '#ffffff',
    },
    backdrop: {
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
  };

  const multiSelectColors = {
    primary: '#0BA5A4',
    success: '#10b981',
    cancel: '#ef4444',
    text: '#0f172a',
    subText: '#475569',
    selectToggleTextColor: '#0B7285',
    searchPlaceholderTextColor: '#94a3b8',
    searchSelectionColor: '#0BA5A4',
    chipColor: '#0BA5A4',
    itemBackground: '#ffffff',
    subItemBackground: '#f8fafc',
    disabled: '#cbd5e1',
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

  const pieColorPalette = ['#0BA5A4', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#7c3aed'];
  const getSliceColor = (index) => pieColorPalette[index % pieColorPalette.length];

  // Filter for positive values only
  const incomePieData = data
    .filter(item => item.value > 0)
    .map((item, index) => ({
      value: item.value,
      color: getSliceColor(index),
      label: item.month,
      text: item.month,
    }));

  // Filter for negative values only (converted to absolute)
  const spendingPieData = data
    .filter(item => item.value < 0)
    .map((item, index) => ({
      value: Math.abs(item.value),
      color: getSliceColor(index + incomePieData.length),
      label: item.month,
      text: item.month,
    }));


  const chartCommonProps = {
    width: chartWidth,
    height: screenHeight * 0.1,
    noOfSections: 4,
    maxValue: yAxisRange,
    mostNegativeValue: -yAxisRange,
    disableScroll: true,
    initialSpacing: 10,
    yAxisLabelWidth: 40,
    xAxisLabelsVerticalShift: screenHeight * 0.1,
    xAxisLabelTextStyle: {fontSize: 12,},
  };

  const lineChartProps = {
    ...chartCommonProps,
    data,
    color: '#0BA5A4',
    areaChart: true,
    startFillColor: '#0BA5A4',
    startOpacity: 0.1,
    spacing: dynamicSpacing,
  };

  const barChartProps = {
    ...chartCommonProps,
    data: dynamicData,
    barWidth: 10,
    spacing: dynamicSpacing - 10,
  };



  const renderChart = () =>
    selectedId === 'Line' ? <LineChart {...lineChartProps} /> : <BarChart {...barChartProps} />;

  // Example of toggling Page 2 visual style
  const renderPage2Chart = () => {
    if (page2ChartType === 'Bar') {
      return <BarChart {...barChartProps} />;
    }

    return (
      <View style={styles.pieContainer}>
        <View style={styles.pieWrapper}>
          <Text style={styles.miniChartLabel}>Income Sources</Text>
          <PieChart
            data={incomePieData.length > 0 ? incomePieData : [{ value: 1, color: '#eee', text: 'No data' }]}
            radius={screenWidth * 0.15}
            innerRadius={screenWidth * 0.08}
            showText
            textColor="white"
            textSize={12}
          />
        </View>

        <View style={styles.pieWrapper}>
          <Text style={styles.miniChartLabel}>Spending Breakdown</Text>
          <PieChart
            data={spendingPieData.length > 0 ? spendingPieData : [{ value: 1, color: '#eee', text: 'No data' }]}
            radius={screenWidth * 0.15}
            innerRadius={screenWidth * 0.08}
            showText
            textColor="white"
            textSize={12}
          />
        </View>
      </View>
    );
  };

  const isPage1 = currentPage === 0;
  const activePageChartOptions = isPage1 ? charts : page2Charts;
  const activePageChartSelection = isPage1 ? selectedId : page2ChartType;
  const activePageChartSetter = isPage1 ? setSelectedId : setPage2ChartType;


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
        {/* PAGE 1 */}
        <View key="1" style={styles.page}>
          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>
              {selectedId === 'Line' ? 'Spending Trend (Line)' : 'Spending Trend (Bar)'}
            </Text>
            {renderChart()}
          </View>
          <TableComponent data={data} />
        </View>

        <View key="2" style={styles.page}>
          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>
              {page2ChartType === 'Bar' ? 'Monthly Volume (Bar)' : 'Monthly Volume (Pie)'}
            </Text>
            {renderPage2Chart()}
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
              radioButtons={activePageChartOptions} 
              onPress={(id) => activePageChartSetter(id)}
              selectedId={activePageChartSelection}
              layout="row"
            />

            <TouchableOpacity style={[styles.applyBtn, { marginTop: 20 }]} onPress={() => setChartModalVisible(false)}>
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
                styles={multiSelectStyles}
                colors={multiSelectColors}
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

  pieContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 10,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChartLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },

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