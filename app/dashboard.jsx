import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Button } from 'react-native';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart, PieChart } from "react-native-gifted-charts";
import PagerView from 'react-native-pager-view';
import RadioGroup from 'react-native-radio-buttons-group';
import {
  fetchAllCategories,
  fetchAllRecipients,
  fetchRecordsWithFilters,
  RecordFilterConfig,
  RecordSortConfig,
} from '../components/dbClient';
import RecordsFilterModal from '../components/RecordsFilterModal';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


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

const formatYAxisLabel = (value) => {
  const numericValue = Number(value) || 0;
  const sign = numericValue < 0 ? '-' : '';
  const absValue = Math.abs(numericValue);

  if (absValue >= 1000000) {
    const formatted = (absValue / 1000000).toFixed(absValue >= 10000000 ? 0 : 1);
    return `${sign}${formatted.replace(/\.0$/, '')}M`;
  }

  if (absValue >= 10000) {
    const formatted = (absValue / 1000).toFixed(absValue >= 100000 ? 0 : 1);
    return `${sign}${formatted.replace(/\.0$/, '')}k`;
  }

  return `${sign}${absValue}`;
};

const Y_AXIS_SECTION_COUNT = 4;

const getNiceStepValue = (maxAbsValue) => {
  const safeValue = Math.max(1, Number(maxAbsValue) || 0);
  const roughStep = safeValue / Y_AXIS_SECTION_COUNT;
  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = 10 ** exponent;
  const residual = roughStep / magnitude;

  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
};

const Dashboard = () => {
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [filterModalColumnKey, setFilterModalColumnKey] = useState('date');
  const [currentPage, setCurrentPage] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriesById, setCategoriesById] = useState({});
  const [recipientsById, setRecipientsById] = useState({});
  const [filterConfig, setFilterConfig] = useState(() => RecordFilterConfig.from().build());
  const [sortConfig, setSortConfig] = useState(() => RecordSortConfig.byDate('desc').build());

  // 1. Move the fetching logic into a reusable function
  const loadData = useCallback(async (
    nextFilterConfig = filterConfig,
    nextSortConfig = sortConfig,
  ) => {
    try {
      const [records, categories, recipients] = await Promise.all([
        fetchRecordsWithFilters(nextFilterConfig, nextSortConfig),
        fetchAllCategories(),
        fetchAllRecipients(),
      ]);

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[item.cid] = item.cname || '';
        return acc;
      }, {});

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[item.rid] = item.name || '';
        return acc;
      }, {});

      setCategoriesById(categoryMap);
      setRecipientsById(recipientMap);
      setData(formatRecordsToChartData(records));
    } catch (error) {
      console.error('Dashboard load error', error);
    } finally {
      setLoading(false);
    }
  }, [filterConfig, sortConfig]);

  // This runs every time the Dashboard screen comes into view
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const categoryOptions = useMemo(() => {
    return Object.entries(categoriesById)
      .map(([key, value]) => ({ key: String(key), value }))
      .filter((item) => item.value)
      .sort((left, right) => String(left.value).localeCompare(String(right.value)));
  }, [categoriesById]);

  const recipientOptions = useMemo(() => {
    return Object.entries(recipientsById)
      .map(([key, value]) => ({ key: String(key), value }))
      .filter((item) => item.value)
      .sort((left, right) => String(left.value).localeCompare(String(right.value)));
  }, [recipientsById]);

  const handleOpenFilterModal = (columnKey = 'date') => {
    setFilterModalColumnKey(columnKey);
    setFilterModalVisible(true);
  };

  const handleCloseFilterModal = () => {
    setFilterModalVisible(false);
  };

  const handleApplyFilterConfig = (nextConfig = {}) => {
    const normalizedFilter = RecordFilterConfig.from(nextConfig).build();
    const normalizedSort = RecordSortConfig.from(nextConfig.sort || sortConfig).build();
    setFilterConfig(normalizedFilter);
    setSortConfig(normalizedSort);
    setFilterModalVisible(false);
    loadData(normalizedFilter, normalizedSort);
  };

  
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0BA5A4" style={{ marginTop: 40 }} />
      </View>
    );
  }

  // Dynamic axis and color logic
  const absMax = data.length > 0 ? Math.max(...data.map(d => Math.abs(d.value))) : 0;
  const stepValue = getNiceStepValue(absMax);
  const yAxisRange = stepValue * Y_AXIS_SECTION_COUNT;
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
    noOfSections: Y_AXIS_SECTION_COUNT,
    maxValue: yAxisRange,
    mostNegativeValue: -yAxisRange,
    stepValue,
    negativeStepValue: stepValue,
    disableScroll: true,
    initialSpacing: 10,
    yAxisLabelWidth: 52,
    xAxisLabelsVerticalShift: screenHeight * 0.1,
    xAxisLabelTextStyle: { fontSize: 10 },
    yAxisTextStyle: { fontSize: 10 },
    formatYLabel: formatYAxisLabel,
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
        <TouchableOpacity style={styles.sideButton} onPress={() => handleOpenFilterModal('date')}>
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

      <RecordsFilterModal
        visible={filterModalVisible}
        activeColumnKey={filterModalColumnKey}
        initialConfig={{ ...filterConfig, sort: sortConfig }}
        categoryOptions={categoryOptions}
        recipientOptions={recipientOptions}
        onClose={handleCloseFilterModal}
        onApply={handleApplyFilterConfig}
      />
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
  chartLabel: { fontSize: 14, color: '#333', marginTop: 10, fontWeight: '500' },

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