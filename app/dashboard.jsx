import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView, Modal, ActivityIndicator, TextInput, Alert, Pressable } from 'react-native';
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import PagerView from 'react-native-pager-view';
import {
  fetchAllCategories,
  fetchAllRecipients,
  fetchRecordsWithFilters,
  RecordFilterConfig,
  RecordSortConfig,
} from '../components/dbClient';
import DashboardFilterModal from '../components/DashboardFilterModal';
import DashboardTrendFilter from '../components/DashboardTrendFilter';
import DashboardProjectionFilter from '../components/DashboardProjectionFilter';
import ThemedSelectList from '../components/ThemedSelectList';
import { Colors } from '../constants/Colors';
import { readDashboardSettings, writeDashboardSettings } from '../components/dashboardSettingsStore';
import {
  PROJECTION_SUBTYPE_MONTHLY_SPENDING,
  PROJECTION_SUBTYPE_OPTIONS,
  buildProjectionModel,
  normalizeProjectionConfig,
  toDefaultProjectionConfig,
  toProjectionSubtypeLabel,
} from '../components/dashboardProjectionUtils';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const PERIOD_COUNT = 12;
const Y_AXIS_SECTION_COUNT = 4;
const MAX_CATEGORY_CHART_ITEMS = 11;
const CHART_PRIMARY_COLOR = '#1f8a70';
const CHART_SECONDARY_COLOR = '#f97316';
const CHART_DASH_ARRAY = [5, 4];
const TREND_COLORS = ['#1f8a70', '#f97316', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ec4899'];
const PAGE_TYPE_PERIOD_TREND = 'period-trend';
const PAGE_TYPE_CATEGORY_GROUPS = 'category-groups';
const PAGE_TYPE_PROJECTION = 'projection';
const MAX_DASHBOARD_PAGES = 10;
const MAX_PAGE_TITLE_LENGTH = 25;

const defaultTrendConfig = () => ({
  mode: 'total',
  chartType: 'line',
  dayRangePreset: 'auto',
  dayRangeShift: 0,
  categoryIds: [],
  showRegressionLine: true,
});
const defaultSortConfig = () => RecordSortConfig.byDate('desc').build();
const defaultFilterConfig = () => RecordFilterConfig.from().build();

const buildDefaultPageConfig = (pageType = PAGE_TYPE_PERIOD_TREND) => ({
  filterConfig: defaultFilterConfig(),
  sortConfig: defaultSortConfig(),
  trendConfig: defaultTrendConfig(),
  page2ChartType: 'Bar',
  projectionConfig: normalizeProjectionConfig({}, pageType === PAGE_TYPE_PROJECTION ? PROJECTION_SUBTYPE_MONTHLY_SPENDING : undefined),
});

const normalizePageConfig = (source = {}, pageType = PAGE_TYPE_PERIOD_TREND) => {
  const defaults = buildDefaultPageConfig(pageType);
  return {
    ...defaults,
    ...source,
    filterConfig: RecordFilterConfig.from(source?.filterConfig || defaults.filterConfig).build(),
    sortConfig: RecordSortConfig.from(source?.sortConfig || defaults.sortConfig).build(),
    trendConfig: {
      ...defaults.trendConfig,
      ...(source?.trendConfig || {}),
      mode: source?.trendConfig?.mode === 'category' ? 'category' : 'total',
      chartType: source?.trendConfig?.chartType === 'stackedBar' ? 'stackedBar' : 'line',
      dayRangePreset: ['auto', 'closest90', 'closest30', 'closest7'].includes(source?.trendConfig?.dayRangePreset)
        ? source.trendConfig.dayRangePreset
        : 'auto',
      dayRangeShift: Math.max(0, Math.trunc(Number(source?.trendConfig?.dayRangeShift) || 0)),
      categoryIds: (source?.trendConfig?.categoryIds || []).map((item) => String(item)).filter(Boolean),
      showRegressionLine: source?.trendConfig?.showRegressionLine !== false,
    },
    page2ChartType: source?.page2ChartType === 'Pie' ? 'Pie' : 'Bar',
    projectionConfig: normalizeProjectionConfig(
      source?.projectionConfig || {},
      source?.projectionConfig?.subtype || (pageType === PAGE_TYPE_PROJECTION ? PROJECTION_SUBTYPE_MONTHLY_SPENDING : undefined)
    ),
  };
};

const defaultBasePages = [
  { id: 'base-period', type: PAGE_TYPE_PERIOD_TREND, title: 'Period Trend (default)' },
  { id: 'base-category', type: PAGE_TYPE_CATEGORY_GROUPS, title: 'Category groups (default)' },
];

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

const getNiceStepValue = (maxAbsValue) => {
  const safeValue = Math.max(1, Number(maxAbsValue) || 0);
  const roughStep = safeValue / Y_AXIS_SECTION_COUNT;
  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = 10 ** exponent;
  const residual = roughStep / magnitude;

  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
};

const getSignedAmount = (record) => {
  const rawAmount = Number(record?.amount) || 0;
  const transactionType = String(record?.type || '').toLowerCase();
  const magnitude = Math.abs(rawAmount);

  if (transactionType === 'spending') return -magnitude;
  if (transactionType === 'income') return magnitude;
  return rawAmount;
};

const toCategoryName = (record, categoriesById) => {
  const cid = record?.cid;
  const explicit = categoriesById?.[cid];
  if (explicit && String(explicit).trim()) return String(explicit).trim();
  return 'Uncategorized';
};

const aggregateByCategory = (records = [], categoriesById = {}) => {
  const categoryMap = records.reduce((acc, record) => {
    const categoryName = toCategoryName(record, categoriesById);
    acc[categoryName] = (acc[categoryName] || 0) + getSignedAmount(record);
    return acc;
  }, {});

  return Object.entries(categoryMap)
    .map(([categoryName, value]) => ({ month: categoryName, label: categoryName, value }))
    .sort((left, right) => left.month.localeCompare(right.month));
};

const toTopCategoryChartData = (categoryRows = []) => {
  if (categoryRows.length <= MAX_CATEGORY_CHART_ITEMS) {
    return [...categoryRows].sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  }

  const ranked = [...categoryRows].sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
  const top = ranked.slice(0, MAX_CATEGORY_CHART_ITEMS);
  const othersValue = ranked
    .slice(MAX_CATEGORY_CHART_ITEMS)
    .reduce((sum, row) => sum + row.value, 0);

  return [...top, { month: 'Others', label: 'Others', value: othersValue }];
};

const getAxisModel = (rows = []) => {
  const absMax = rows.length > 0 ? Math.max(...rows.map((item) => Math.abs(item.value))) : 0;
  const stepValue = getNiceStepValue(absMax);
  return {
    stepValue,
    yAxisRange: stepValue * Y_AXIS_SECTION_COUNT,
  };
};

const getDynamicSpacing = (chartWidth, pointsCount) => {
  if (pointsCount <= 1) return chartWidth * 0.35;
  return (chartWidth - 40) / (pointsCount - 1);
};

const toValidDate = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toSimpleDateString = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
};

const toTwoRowDateLabel = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}\n${month}/${day}`;
};

const resolveTrendEndDate = (filterConfig = {}) => {
  const dateFilter = filterConfig?.date || {};
  let candidate = null;

  if (dateFilter.mode === 'between' && dateFilter.betweenEnd) {
    candidate = toValidDate(dateFilter.betweenEnd);
  } else if (dateFilter.mode === 'before' && dateFilter.before) {
    candidate = toValidDate(dateFilter.before);
  }

  return candidate || new Date();
};

const toPeriodDefinitions = (records = [], trendConfig = {}, filterConfig = {}) => {
  const validDates = records
    .map((item) => toValidDate(item.date))
    .filter(Boolean)
    .map((item) => item.getTime())
    .sort((a, b) => a - b);

  const nowMs = new Date().getTime();
  const baseEndMs = Math.min(resolveTrendEndDate(filterConfig).getTime(), nowMs);
  const dayMs = 24 * 60 * 60 * 1000;

  const preset = trendConfig?.dayRangePreset || 'auto';
  const dayRangeShift = Math.max(0, Math.trunc(Number(trendConfig?.dayRangeShift) || 0));

  if (preset === 'closest7') {
    const days = 7;
    const endMs = baseEndMs - dayRangeShift * days * dayMs;
    return Array.from({ length: days }, (_, index) => {
      const dayOffset = days - 1 - index;
      const pointStart = endMs - dayOffset * dayMs;
      const pointEnd = pointStart + dayMs - 1;
      const startDate = new Date(pointStart);
      const finalDate = new Date(pointEnd);

      return {
        startMs: pointStart,
        endMs: pointEnd,
        startLabel: toSimpleDateString(startDate),
        endLabel: toSimpleDateString(finalDate),
        endChartLabel: toTwoRowDateLabel(finalDate),
        rangeLabel: `${toSimpleDateString(startDate)}-${toSimpleDateString(finalDate)}`,
      };
    });
  }

  if (preset === 'closest30' || preset === 'closest90') {
    const days = preset === 'closest30' ? 30 : 90;
    const endMs = baseEndMs - dayRangeShift * days * dayMs;
    const startMs = endMs - (days - 1) * dayMs;
    const span = Math.max(1, endMs - startMs + 1);

    return Array.from({ length: PERIOD_COUNT }, (_, index) => {
      const periodStart = startMs + Math.floor((span * index) / PERIOD_COUNT);
      const periodEnd = index === PERIOD_COUNT - 1
        ? endMs
        : startMs + Math.floor((span * (index + 1)) / PERIOD_COUNT) - 1;
      const startDate = new Date(periodStart);
      const finalDate = new Date(periodEnd);

      return {
        startMs: periodStart,
        endMs: periodEnd,
        startLabel: toSimpleDateString(startDate),
        endLabel: toSimpleDateString(finalDate),
        endChartLabel: toTwoRowDateLabel(finalDate),
        rangeLabel: `${toSimpleDateString(startDate)}-${toSimpleDateString(finalDate)}`,
      };
    });
  }

  if (validDates.length === 0) {
    const endMs = baseEndMs;
    const startMs = endMs - (PERIOD_COUNT - 1) * dayMs;
    return Array.from({ length: PERIOD_COUNT }, () => ({
      startMs,
      endMs,
      startLabel: toSimpleDateString(new Date(startMs)),
      endLabel: toSimpleDateString(new Date(endMs)),
      endChartLabel: toTwoRowDateLabel(new Date(endMs)),
      rangeLabel: `${toSimpleDateString(new Date(startMs))}-${toSimpleDateString(new Date(endMs))}`,
    }));
  }

  const minMs = validDates[0];
  const rangeEndMs = Math.max(minMs, baseEndMs);
  const span = Math.max(1, rangeEndMs - minMs + 1);

  return Array.from({ length: PERIOD_COUNT }, (_, index) => {
    const startMs = minMs + Math.floor((span * index) / PERIOD_COUNT);
    const endMs = index === PERIOD_COUNT - 1
      ? rangeEndMs
      : minMs + Math.floor((span * (index + 1)) / PERIOD_COUNT) - 1;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    return {
      startMs,
      endMs,
      startLabel: toSimpleDateString(startDate),
      endLabel: toSimpleDateString(endDate),
      endChartLabel: toTwoRowDateLabel(endDate),
      rangeLabel: `${toSimpleDateString(startDate)}-${toSimpleDateString(endDate)}`,
    };
  });
};

const toPeriodIndex = (dateValue, periods) => {
  if (!dateValue) return -1;
  const valueMs = dateValue.getTime();

  if (periods.length === 0) return -1;
  if (valueMs < periods[0].startMs || valueMs > periods[periods.length - 1].endMs) {
    return -1;
  }

  for (let index = 0; index < periods.length; index += 1) {
    if (valueMs >= periods[index].startMs && valueMs <= periods[index].endMs) {
      return index;
    }
  }

  return -1;
};

const buildTrendModel = (records = [], categoriesById = {}, trendConfig = {}, filterConfig = {}) => {
  const periods = toPeriodDefinitions(records, trendConfig, filterConfig);
  const totals = Array.from({ length: periods.length }, () => 0);

  const selectedCategoryIds = Array.from(new Set((trendConfig.categoryIds || []).map((item) => String(item)).filter(Boolean)));
  const seriesByCategoryId = selectedCategoryIds.reduce((acc, id) => {
    acc[id] = Array.from({ length: periods.length }, () => 0);
    return acc;
  }, {});

  records.forEach((record) => {
    const dateValue = toValidDate(record.date);
    const periodIndex = toPeriodIndex(dateValue, periods);
    if (periodIndex < 0) return;

    const amount = getSignedAmount(record);
    totals[periodIndex] += amount;

    const categoryId = String(record?.cid || '');
    if (seriesByCategoryId[categoryId]) {
      seriesByCategoryId[categoryId][periodIndex] += amount;
    }
  });

  const tableRows = periods.map((period, index) => ({
    month: period.rangeLabel,
    label: period.rangeLabel,
    value: totals[index],
  }));

  const totalLineData = periods.map((period, index) => ({
    label: period.endChartLabel || period.endLabel,
    value: totals[index],
  }));

  const totalBarData = periods.map((period, index) => ({
    label: period.endChartLabel || period.endLabel,
    value: totals[index],
    frontColor: totals[index] >= 0 ? CHART_PRIMARY_COLOR : '#d32f2f',
  }));

  const regressionLineData = (() => {
    const count = totals.length;
    if (count === 0) return [];

    const sumX = (count * (count - 1)) / 2;
    const sumX2 = ((count - 1) * count * (2 * count - 1)) / 6;
    const sumY = totals.reduce((sum, value) => sum + value, 0);
    const sumXY = totals.reduce((sum, value, index) => sum + index * value, 0);

    const denominator = count * sumX2 - sumX * sumX;
    const slope = denominator === 0 ? 0 : (count * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / count;

    return periods.map((period, index) => ({
      label: period.endChartLabel || period.endLabel,
      value: slope * index + intercept,
    }));
  })();

  const multiLineDataSet = selectedCategoryIds.map((categoryId, index) => ({
    data: periods.map((period, periodIndex) => ({
      label: period.endChartLabel || period.endLabel,
      value: seriesByCategoryId[categoryId]?.[periodIndex] || 0,
    })),
    color: TREND_COLORS[index % TREND_COLORS.length],
    dataPointsColor: TREND_COLORS[index % TREND_COLORS.length],
    thickness: 2,
    textShiftY: -4,
  }));

  const stackedBarData = periods.map((period, periodIndex) => ({
    label: period.endChartLabel || period.endLabel,
    stacks: selectedCategoryIds.map((categoryId, index) => ({
      value: seriesByCategoryId[categoryId]?.[periodIndex] || 0,
      color: TREND_COLORS[index % TREND_COLORS.length],
    })),
  }));

  const legend = selectedCategoryIds.map((categoryId, index) => ({
    key: categoryId,
    label: categoriesById[categoryId] || `Category ${categoryId}`,
    color: TREND_COLORS[index % TREND_COLORS.length],
  }));

  let maxAbsValue = Math.max(...totals.map((value) => Math.abs(value)), 1);

  if (trendConfig.mode === 'category') {
    const allSeriesValues = selectedCategoryIds.flatMap((categoryId) => seriesByCategoryId[categoryId] || []);
    const lineModeMax = allSeriesValues.length > 0 ? Math.max(...allSeriesValues.map((value) => Math.abs(value))) : 1;

    const stackedMax = stackedBarData.reduce((acc, period) => {
      const positive = period.stacks
        .filter((item) => item.value > 0)
        .reduce((sum, item) => sum + item.value, 0);
      const negative = period.stacks
        .filter((item) => item.value < 0)
        .reduce((sum, item) => sum + item.value, 0);
      return Math.max(acc, Math.abs(positive), Math.abs(negative));
    }, 1);

    maxAbsValue = Math.max(lineModeMax, stackedMax, 1);
  }

  return {
    periods,
    tableRows,
    totalLineData,
    totalBarData,
    regressionLineData,
    multiLineDataSet,
    stackedBarData,
    legend,
    maxAbsValue,
    pointsCount: periods.length,
  };
};

const Dashboard = () => {
  const pagerRef = useRef(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [trendFilterVisible, setTrendFilterVisible] = useState(false);
  const [projectionChartSetupVisible, setProjectionChartSetupVisible] = useState(false);
  const [projectionFilterSetupVisible, setProjectionFilterSetupVisible] = useState(false);
  const [chartModalVisible, setChartModalVisible] = useState(false);
  const [addPageModalVisible, setAddPageModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [customPages, setCustomPages] = useState([]);
  const [pageConfigById, setPageConfigById] = useState({});
  const [recordsByPageId, setRecordsByPageId] = useState({});
  const [pageLoadingById, setPageLoadingById] = useState({});
  const [settingsReady, setSettingsReady] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [newPageType, setNewPageType] = useState(PAGE_TYPE_PERIOD_TREND);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newProjectionSubtype, setNewProjectionSubtype] = useState(PROJECTION_SUBTYPE_MONTHLY_SPENDING);
  const [categoriesById, setCategoriesById] = useState({});
  const [recipientsById, setRecipientsById] = useState({});
  const [filterConfig, setFilterConfig] = useState(() => defaultFilterConfig());
  const [sortConfig, setSortConfig] = useState(() => defaultSortConfig());
  const [trendConfig, setTrendConfig] = useState(() => defaultTrendConfig());
  const [page2ChartType, setPage2ChartType] = useState('Bar');
  const [projectionConfig, setProjectionConfig] = useState(() => toDefaultProjectionConfig(PROJECTION_SUBTYPE_MONTHLY_SPENDING));

  const pageDefinitions = useMemo(() => {
    return [...defaultBasePages, ...customPages];
  }, [customPages]);

  const currentPageData = pageDefinitions[currentPage] || pageDefinitions[0] || defaultBasePages[0];
  const currentPageType = currentPageData?.type || PAGE_TYPE_PERIOD_TREND;
  const currentPageId = currentPageData?.id || 'base-period';
  const records = recordsByPageId[currentPageId] || [];
  const currentPageLoading = Boolean(pageLoadingById[currentPageId]);
  const hasCurrentPageRecords = Object.prototype.hasOwnProperty.call(recordsByPageId, currentPageId);

  const getNormalizedPageConfig = useCallback((pageId, pageType) => {
    return normalizePageConfig(pageConfigById?.[pageId] || {}, pageType);
  }, [pageConfigById]);

  const updatePageConfig = useCallback((pageId, pageType, patch) => {
    setPageConfigById((prev) => {
      const current = normalizePageConfig(prev?.[pageId] || {}, pageType);
      const nextRaw = typeof patch === 'function' ? patch(current) : { ...current, ...(patch || {}) };
      const next = normalizePageConfig(nextRaw, pageType);
      return {
        ...prev,
        [pageId]: next,
      };
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrateSettings = async () => {
      const defaults = {
        customPages: [],
        pageConfigById: {
          'base-period': buildDefaultPageConfig(PAGE_TYPE_PERIOD_TREND),
          'base-category': buildDefaultPageConfig(PAGE_TYPE_CATEGORY_GROUPS),
        },
        currentPage: 0,
      };

      const stored = await readDashboardSettings(defaults);
      if (!mounted) return;

      const nextCustomPages = Array.isArray(stored?.customPages)
        ? stored.customPages
          .filter((item) => item && item.id && item.type && item.title)
          .map((item) => ({ id: String(item.id), type: String(item.type), title: String(item.title) }))
        : [];

      const allPages = [...defaultBasePages, ...nextCustomPages];

      const rawConfigById = stored?.pageConfigById && typeof stored.pageConfigById === 'object'
        ? stored.pageConfigById
        : defaults.pageConfigById;

      const normalizedConfigById = allPages.reduce((acc, page) => {
        acc[page.id] = normalizePageConfig(rawConfigById?.[page.id] || {}, page.type);
        return acc;
      }, {});

      const savedPageIndex = Number(stored?.currentPage);
      const safePageIndex = Number.isFinite(savedPageIndex)
        ? Math.max(0, Math.min(Math.trunc(savedPageIndex), allPages.length - 1))
        : 0;

      setCustomPages(nextCustomPages);
      setPageConfigById(normalizedConfigById);
      setCurrentPage(safePageIndex);
      setSettingsReady(true);
    };

    hydrateSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settingsReady) return;

    writeDashboardSettings({
      customPages,
      pageConfigById,
      currentPage,
    });
  }, [settingsReady, customPages, pageConfigById, currentPage]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [categories, recipients] = await Promise.all([
        fetchAllCategories(),
        fetchAllRecipients(),
      ]);

      const categoryMap = (categories || []).reduce((acc, item) => {
        acc[String(item.cid)] = item.cname || '';
        return acc;
      }, {});

      const recipientMap = (recipients || []).reduce((acc, item) => {
        acc[String(item.rid)] = item.name || '';
        return acc;
      }, {});

      setCategoriesById(categoryMap);
      setRecipientsById(recipientMap);
    } catch (error) {
      console.error('Dashboard reference load error', error);
    }
  }, []);

  const loadPageData = useCallback(async (
    pageId,
    nextFilterConfig,
    nextSortConfig,
    options = {}
  ) => {
    const { background = false } = options;
    if (!background) {
      setPageLoadingById((prev) => ({
        ...prev,
        [pageId]: true,
      }));
    }

    try {
      const nextRecords = await fetchRecordsWithFilters(nextFilterConfig, nextSortConfig);
      setRecordsByPageId((prev) => ({
        ...prev,
        [pageId]: nextRecords || [],
      }));
    } catch (error) {
      console.error('Dashboard page data load error', error);
    } finally {
      setPageLoadingById((prev) => ({
        ...prev,
        [pageId]: false,
      }));
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    const page = pageDefinitions[currentPage] || pageDefinitions[0];
    if (!page) return;

    const nextConfig = getNormalizedPageConfig(page.id, page.type);
    setFilterConfig(nextConfig.filterConfig);
    setSortConfig(nextConfig.sortConfig);
    setTrendConfig(nextConfig.trendConfig);
    setPage2ChartType(nextConfig.page2ChartType);
    setProjectionConfig(nextConfig.projectionConfig);
  }, [settingsReady, currentPage, pageDefinitions, getNormalizedPageConfig]);

  useEffect(() => {
    if (!settingsReady) return;
    loadReferenceData();
  }, [settingsReady, loadReferenceData]);

  useEffect(() => {
    if (!settingsReady) return;
    if (!currentPageId) return;
    const hasCache = Object.prototype.hasOwnProperty.call(recordsByPageId, currentPageId);
    loadPageData(currentPageId, filterConfig, sortConfig, { background: hasCache });
  }, [settingsReady, currentPageId, filterConfig, sortConfig, loadPageData]);

  useFocusEffect(
    useCallback(() => {
      if (!settingsReady) return undefined;
      loadReferenceData();
      loadPageData(currentPageId, filterConfig, sortConfig, { background: true });
      return undefined;
    }, [settingsReady, loadReferenceData, loadPageData, currentPageId, filterConfig, sortConfig])
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

  const handleOpenFilterModal = () => {
    setFilterModalVisible(true);
  };

  const handleCloseFilterModal = () => {
    setFilterModalVisible(false);
  };

  const handleApplyFilterConfig = (nextConfig = {}) => {
    const normalizedFilter = RecordFilterConfig.from(nextConfig).build();
    const normalizedSort = RecordSortConfig.from(nextConfig.sort || sortConfig || defaultSortConfig()).build();
    setFilterConfig(normalizedFilter);
    setSortConfig(normalizedSort);
    updatePageConfig(currentPageData.id, currentPageType, (prev) => ({
      ...prev,
      filterConfig: normalizedFilter,
      sortConfig: normalizedSort,
    }));
    setFilterModalVisible(false);
  };

  const handleApplyTrendConfig = (nextTrendConfig = {}) => {
    const normalizedTrend = {
      ...trendConfig,
      mode: nextTrendConfig.mode === 'category' ? 'category' : 'total',
      chartType: nextTrendConfig.chartType === 'stackedBar' ? 'stackedBar' : 'line',
      dayRangePreset: ['auto', 'closest90', 'closest30', 'closest7'].includes(nextTrendConfig.dayRangePreset)
        ? nextTrendConfig.dayRangePreset
        : 'auto',
      dayRangeShift: 0,
      categoryIds: (nextTrendConfig.categoryIds || []).map((item) => String(item)).filter(Boolean),
      showRegressionLine: nextTrendConfig.showRegressionLine !== false,
    };
    setTrendConfig(normalizedTrend);
    updatePageConfig(currentPageData.id, currentPageType, (prev) => ({
      ...prev,
      trendConfig: normalizedTrend,
    }));
    setTrendFilterVisible(false);
  };

  const handleApplyProjectionConfig = (nextProjectionConfig = {}) => {
    const normalizedProjection = normalizeProjectionConfig(nextProjectionConfig, nextProjectionConfig?.subtype || projectionConfig?.subtype);
    setProjectionConfig(normalizedProjection);
    updatePageConfig(currentPageData.id, currentPageType, (prev) => ({
      ...prev,
      projectionConfig: normalizedProjection,
    }));
    setProjectionChartSetupVisible(false);
    setProjectionFilterSetupVisible(false);
  };

  const handleAddPage = () => {
    if (pageDefinitions.length >= MAX_DASHBOARD_PAGES) {
      Alert.alert('Page Limit Reached', `You can only have up to ${MAX_DASHBOARD_PAGES} pages.`);
      return;
    }

    const nextType = [PAGE_TYPE_CATEGORY_GROUPS, PAGE_TYPE_PROJECTION].includes(newPageType)
      ? newPageType
      : PAGE_TYPE_PERIOD_TREND;
    const fallbackTitle = nextType === PAGE_TYPE_PERIOD_TREND
      ? 'Period Trend'
      : nextType === PAGE_TYPE_CATEGORY_GROUPS
        ? 'Category groups'
        : toProjectionSubtypeLabel(newProjectionSubtype);
    const inputTitle = (newPageTitle || '').trim();

    if (inputTitle.length > MAX_PAGE_TITLE_LENGTH) {
      Alert.alert('Title Too Long', `Chart title cannot exceed ${MAX_PAGE_TITLE_LENGTH} characters.`);
      return;
    }

    const requestedTitle = inputTitle || fallbackTitle;

    const existingTitles = pageDefinitions.map((page) => String(page.title || '').trim());
    let uniqueTitle = requestedTitle;
    let suffix = 1;

    while (existingTitles.includes(uniqueTitle)) {
      const suffixText = ` (${suffix})`;
      const baseMaxLength = MAX_PAGE_TITLE_LENGTH - suffixText.length;
      if (baseMaxLength <= 0) {
        Alert.alert('Title Conflict', 'Unable to generate a unique title within 25 characters. Please choose a shorter name.');
        return;
      }

      const trimmedBase = requestedTitle.slice(0, baseMaxLength).trimEnd();
      uniqueTitle = `${trimmedBase}${suffixText}`;
      suffix += 1;
    }

    const nextPage = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type: nextType,
      title: uniqueTitle,
    };

    setCustomPages((prev) => [...prev, nextPage]);
    setPageConfigById((prev) => ({
      ...prev,
      [nextPage.id]: normalizePageConfig({
        ...buildDefaultPageConfig(nextType),
        projectionConfig: normalizeProjectionConfig({}, newProjectionSubtype),
      }, nextType),
    }));
    setNewPageType(PAGE_TYPE_PERIOD_TREND);
    setNewProjectionSubtype(PROJECTION_SUBTYPE_MONTHLY_SPENDING);
    setNewPageTitle('');
    setAddPageModalVisible(false);
  };

  const navigateToPage = (index) => {
    const safeIndex = Math.max(0, Math.min(index, pageDefinitions.length - 1));
    setCurrentPage(safeIndex);
    pagerRef.current?.setPage?.(safeIndex);
  };

  const handleDeleteCurrentPage = () => {
    if (currentPage < 2) {
      Alert.alert('Cannot Delete', 'Default page cannot be deleted.');
      return;
    }

    Alert.alert(
      'Delete Page',
      `Delete page "${pageDefinitions[currentPage]?.title || ''}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const pageId = pageDefinitions[currentPage]?.id;
            setCustomPages((prev) => prev.filter((item) => item.id !== pageId));
            setPageConfigById((prev) => {
              const next = { ...prev };
              delete next[pageId];
              return next;
            });
            setRecordsByPageId((prev) => {
              const next = { ...prev };
              delete next[pageId];
              return next;
            });
            setPageLoadingById((prev) => {
              const next = { ...prev };
              delete next[pageId];
              return next;
            });
            const nextIndex = Math.max(0, currentPage - 1);
            setCurrentPage(nextIndex);
            setTimeout(() => {
              pagerRef.current?.setPage?.(nextIndex);
            }, 0);
          },
        },
      ]
    );
  };

  const allCategoryRows = useMemo(() => {
    return aggregateByCategory(records, categoriesById);
  }, [records, categoriesById]);

  const categoryChartData = useMemo(() => {
    return toTopCategoryChartData(allCategoryRows);
  }, [allCategoryRows]);

  const trendModel = useMemo(() => {
    return buildTrendModel(records, categoriesById, trendConfig, filterConfig);
  }, [records, categoriesById, trendConfig, filterConfig]);

  const projectionModel = useMemo(() => {
    return buildProjectionModel({
      records,
      projectionConfig,
    });
  }, [records, projectionConfig]);

  const chartTitleOptions = useMemo(() => {
    return pageDefinitions.map((page, index) => ({ key: String(index), value: page.title }));
  }, [pageDefinitions]);

  const page1StepValue = getNiceStepValue(trendModel.maxAbsValue);
  const page1AxisRange = page1StepValue * Y_AXIS_SECTION_COUNT;
  const page2AxisModel = getAxisModel(categoryChartData);
  const projectionStepValue = getNiceStepValue(projectionModel.maxAbsValue);
  const projectionAxisRange = projectionStepValue * Y_AXIS_SECTION_COUNT;

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

  if (initialLoading && !hasCurrentPageRecords) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0BA5A4" style={{ marginTop: 40 }} />
      </View>
    );
  }

  const page2BarData = categoryChartData.map(item => ({
    ...item,
    frontColor: item.value >= 0 ? CHART_PRIMARY_COLOR : '#d32f2f',
  }));

  const chartWidth = screenWidth * 0.84;
  const page1Spacing = getDynamicSpacing(chartWidth, trendModel.pointsCount);
  const page2Spacing = getDynamicSpacing(chartWidth, categoryChartData.length);

  const pieColorPalette = ['#1f8a70', '#f97316', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#7c3aed'];
  const getSliceColor = (index) => pieColorPalette[index % pieColorPalette.length];

  const incomeCategoryPieData = categoryChartData
    .filter(item => item.value > 0)
    .map((item, index) => ({
      value: item.value,
      color: getSliceColor(index),
      label: item.month,
      text: item.month,
    }));

  const spendingCategoryPieData = categoryChartData
    .filter(item => item.value < 0)
    .map((item, index) => ({
      value: Math.abs(item.value),
      color: getSliceColor(index + incomeCategoryPieData.length),
      label: item.month,
      text: item.month,
    }));

  const pieLegendItems = [
    ...incomeCategoryPieData.map((item, index) => ({
      key: `income-${index}-${item.label}`,
      label: `Income: ${item.label}`,
      color: item.color,
    })),
    ...spendingCategoryPieData.map((item, index) => ({
      key: `spending-${index}-${item.label}`,
      label: `Spending: ${item.label}`,
      color: item.color,
    })),
  ];

  const chartCommonProps = {
    width: chartWidth,
    height: screenHeight * 0.1,
    noOfSections: Y_AXIS_SECTION_COUNT,
    disableScroll: true,
    initialSpacing: 8,
    yAxisLabelWidth: 40,
    xAxisLabelsVerticalShift: 0,
    xAxisTextNumberOfLines: 2,
    xAxisLabelsHeight: 30,
    labelsExtraHeight: 2,
    xAxisLabelTextStyle: { fontSize: 8, lineHeight: 10, textAlign: 'center' },
    yAxisTextStyle: { fontSize: 10 },
    formatYLabel: formatYAxisLabel,
  };

  const page1TotalLineDataSet = [
    {
      data: trendModel.totalLineData,
      color: CHART_PRIMARY_COLOR,
      thickness: 2,
      dataPointsColor: CHART_PRIMARY_COLOR,
      areaChart: true,
      startFillColor: CHART_PRIMARY_COLOR,
      endFillColor: CHART_PRIMARY_COLOR,
      startOpacity: 0.18,
      endOpacity: 0.02,
    },
    ...(trendConfig.showRegressionLine === false
      ? []
      : [{
        data: trendModel.regressionLineData,
        color: CHART_SECONDARY_COLOR,
        thickness: 2,
        strokeDashArray: CHART_DASH_ARRAY,
        hideDataPoints: true,
      }]),
  ];

  const page1TotalLineProps = {
    ...chartCommonProps,
    dataSet: page1TotalLineDataSet,
    maxValue: page1AxisRange,
    mostNegativeValue: -page1AxisRange,
    stepValue: page1StepValue,
    negativeStepValue: page1StepValue,
    spacing: page1Spacing,
  };

  const page1TotalBarProps = {
    ...chartCommonProps,
    data: trendModel.totalBarData,
    showLine: trendConfig.showRegressionLine !== false,
    lineData: trendConfig.showRegressionLine === false ? [] : trendModel.regressionLineData,
    lineConfig: {
      color: CHART_SECONDARY_COLOR,
      thickness: 2,
      strokeDashArray: CHART_DASH_ARRAY,
      hideDataPoints: true,
    },
    maxValue: page1AxisRange,
    mostNegativeValue: -page1AxisRange,
    stepValue: page1StepValue,
    negativeStepValue: page1StepValue,
    barWidth: 12,
    spacing: Math.max(8, page1Spacing - 10),
  };

  const page1MultiLineProps = {
    ...chartCommonProps,
    dataSet: trendModel.multiLineDataSet,
    maxValue: page1AxisRange,
    mostNegativeValue: -page1AxisRange,
    stepValue: page1StepValue,
    negativeStepValue: page1StepValue,
    spacing: page1Spacing,
  };

  const page1StackedBarProps = {
    ...chartCommonProps,
    xAxisLabelsVerticalShift: 0,
    stackData: trendModel.stackedBarData,
    maxValue: page1AxisRange,
    mostNegativeValue: -page1AxisRange,
    stepValue: page1StepValue,
    negativeStepValue: page1StepValue,
    barWidth: 10,
    spacing: Math.max(8, page1Spacing - 8),
  };

  const page2BarChartProps = {
    ...chartCommonProps,
    data: page2BarData,
    maxValue: page2AxisModel.yAxisRange,
    mostNegativeValue: -page2AxisModel.yAxisRange,
    stepValue: page2AxisModel.stepValue,
    negativeStepValue: page2AxisModel.stepValue,
    barWidth: 10,
    spacing: Math.max(8, page2Spacing - 10),
  };

  const projectionLineProps = {
    ...chartCommonProps,
    dataSet: projectionModel.dataSet,
    maxValue: projectionAxisRange,
    mostNegativeValue: -projectionAxisRange,
    stepValue: projectionStepValue,
    negativeStepValue: projectionStepValue,
    spacing: getDynamicSpacing(chartWidth, projectionModel.pointsCount),
  };

  const isShiftablePreset = ['closest90', 'closest30', 'closest7'].includes(trendConfig.dayRangePreset);
  const trendWindowRangeLabel = trendModel.periods.length > 0
    ? `${trendModel.periods[0].startLabel} - ${trendModel.periods[trendModel.periods.length - 1].endLabel}`
    : 'No period range';

  const shiftTrendWindow = (delta) => {
    if (!isShiftablePreset) return;

    setTrendConfig((prevTrend) => {
      const currentShift = Math.max(0, Math.trunc(Number(prevTrend.dayRangeShift) || 0));
      const nextShift = currentShift + delta;

      if (nextShift < 0) {
        Alert.alert('Latest Window Reached', 'You cannot go later than the current date range.');
        return prevTrend;
      }

      const nextTrendConfig = {
        ...prevTrend,
        dayRangeShift: nextShift,
      };

      updatePageConfig(currentPageData.id, currentPageType, (prevPageConfig) => ({
        ...prevPageConfig,
        trendConfig: nextTrendConfig,
      }));

      return nextTrendConfig;
    });
  };

  const filterSignature = JSON.stringify(filterConfig || {});

  const totalSeries = (trendModel.totalLineData || []).map((point) => Number(point?.value || 0).toFixed(4)).join('|');
  const regressionSeries = (trendModel.regressionLineData || []).map((point) => Number(point?.value || 0).toFixed(4)).join('|');
  const totalLineChartKey = `total-line-${currentPageId}-${trendConfig.dayRangePreset}-${trendConfig.dayRangeShift}-${filterSignature}-${totalSeries}-${regressionSeries}`;

  const seriesSignature = (trendModel.multiLineDataSet || [])
    .map((series) => (series?.data || []).map((point) => Number(point?.value || 0).toFixed(4)).join('|'))
    .join('||');
  const categoryLineChartKey = `category-line-${currentPageId}-${trendConfig.dayRangePreset}-${trendConfig.dayRangeShift}-${filterSignature}-${seriesSignature}`;

  const renderTrendRangeNavigator = () => {
    if (!isShiftablePreset) return null;

    return (
      <View style={styles.trendRangeNavigator}>
        <TouchableOpacity style={styles.trendRangeNavButton} onPress={() => shiftTrendWindow(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.trendRangeNavButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.trendRangeLabel}>{trendWindowRangeLabel}</Text>
        <TouchableOpacity style={styles.trendRangeNavButton} onPress={() => shiftTrendWindow(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.trendRangeNavButtonText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPage1Chart = () => {
    if (trendConfig.mode === 'category') {
      if (trendModel.legend.length < 2) {
        return <Text style={styles.chartHelpText}>Select 2 or more categories in Trend Chart Setup.</Text>;
      }

      if (trendConfig.chartType === 'line') {
        return <LineChart key={categoryLineChartKey} {...page1MultiLineProps} />;
      }

      return <BarChart {...page1StackedBarProps} />;
    }

    if (trendConfig.chartType === 'stackedBar') {
      return <BarChart {...page1TotalBarProps} />;
    }

    return <LineChart key={totalLineChartKey} {...page1TotalLineProps} />;
  };

  const renderPage2Chart = () => {
    if (page2ChartType === 'Bar') {
      return <BarChart {...page2BarChartProps} />;
    }

    return (
      <View style={styles.pieChartArea}>
        <View style={styles.pieContainer}>
        <View style={styles.pieWrapper}>
          <Text style={styles.miniChartLabel}>Income Categories</Text>
          <PieChart
            data={incomeCategoryPieData.length > 0 ? incomeCategoryPieData : [{ value: 1, color: '#eee', text: 'No data' }]}
            radius={screenWidth * 0.15}
            innerRadius={screenWidth * 0.08}
            showText
            textColor="white"
            textSize={12}
          />
        </View>

        <View style={styles.pieWrapper}>
          <Text style={styles.miniChartLabel}>Spending Categories</Text>
          <PieChart
            data={spendingCategoryPieData.length > 0 ? spendingCategoryPieData : [{ value: 1, color: '#eee', text: 'No data' }]}
            radius={screenWidth * 0.15}
            innerRadius={screenWidth * 0.08}
            showText
            textColor="white"
            textSize={12}
          />
        </View>
        </View>
      </View>
    );
  };

  const renderProjectionChart = () => {
    return <LineChart {...projectionLineProps} />;
  };

  const page1Title = trendConfig.mode === 'category'
    ? (trendConfig.chartType === 'line' ? 'Trend by Categories (Multi-Line)' : 'Trend by Categories (Stacked Bar)')
    : (trendConfig.chartType === 'line' ? 'Total Trend (Line)' : 'Total Trend (Bar)');

  const renderChartTitleDropdown = () => (
    <View style={styles.chartTitleDropdown}>
      <ThemedSelectList
        key={`chart-page-select-${currentPage}`}
        data={chartTitleOptions}
        search={false}
        floating={true}
        save="key"
        setSelected={(value) => navigateToPage(Number(value))}
        defaultOption={{ key: String(currentPage), value: pageDefinitions[currentPage]?.title || '' }}
        boxStyles={styles.chartTitleSelectBox}
        inputStyles={styles.chartTitleSelectInput}
        dropdownStyles={styles.chartTitleSelectDropdown}
        dropdownTextStyles={styles.chartTitleSelectDropdownText}
      />
    </View>
  );

  const renderLegend = (items = [], pageKey) => {
    if (!items || items.length === 0) return null;

    return (
      <View style={styles.legendStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={styles.legendWrap}
          contentContainerStyle={styles.legendRow}
        >
          {items.map((item) => (
            <View key={`${pageKey}-${item.key}`} style={styles.legendItem}>
              {item.dashed ? (
                <View style={[styles.legendDash, { borderColor: item.color }]} />
              ) : (
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              )}
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPageRefreshIndicator = () => {
    if (!currentPageLoading) return null;
    return (
      <View style={styles.pageRefreshIndicator}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.pageRefreshText}>Refreshing current page...</Text>
      </View>
    );
  };

  const renderPeriodTrendPage = (pageTitle, pageKey) => (
    <View key={pageKey} style={styles.page}>
      {renderPageRefreshIndicator()}
      <View style={styles.chartSection}>
        {renderChartTitleDropdown(pageTitle || page1Title)}
        {renderPage1Chart()}
        {renderTrendRangeNavigator()}
      </View>
      {trendConfig.mode === 'category' ? renderLegend(trendModel.legend, pageKey) : null}
      <TableComponent
        data={trendModel.tableRows}
        firstColumnTitle="Period"
        firstColumnFlex={2.4}
        amountColumnFlex={1.2}
      />
    </View>
  );

  const renderCategoryGroupsPage = (pageTitle, pageKey) => (
    <View key={pageKey} style={styles.page}>
      {renderPageRefreshIndicator()}
      <View style={styles.chartSection}>
        {renderChartTitleDropdown(pageTitle || (page2ChartType === 'Bar' ? 'Category Volume (Bar)' : 'Category Volume (Pie)'))}
        {renderPage2Chart()}
      </View>
      {page2ChartType === 'Pie' ? renderLegend(pieLegendItems, pageKey) : null}
      <TableComponent data={allCategoryRows} firstColumnTitle="Category" firstColumnFlex={1.4} amountColumnFlex={1.6} />
    </View>
  );

  const renderProjectionPage = (pageTitle, pageKey) => (
    <View key={pageKey} style={styles.page}>
      {renderPageRefreshIndicator()}
      <View style={styles.chartSection}>
        {renderChartTitleDropdown(pageTitle || projectionModel.title)}
        {renderProjectionChart()}
      </View>
      {renderLegend(projectionModel.legend, pageKey)}
      <Text style={styles.projectionSubtitle}>{projectionModel.subtitle}</Text>
      <TableComponent
        columns={projectionModel.table.columns}
        rows={projectionModel.table.rows}
        summaryLabel={projectionModel.table.summary?.label}
        summaryValue={projectionModel.table.summary?.value}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity style={styles.removePageButton} onPress={handleDeleteCurrentPage}>
          <Text style={styles.removePageButtonText}>-</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPageButton} onPress={() => setAddPageModalVisible(true)}>
          <Text style={styles.addPageButtonText}>+</Text>
        </TouchableOpacity>

        <View style={styles.paginationDots}>
          {pageDefinitions.map((page, index) => (
            <View key={page.id} style={[styles.dot, currentPage === index && styles.activeDot]} />
          ))}
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={(e) => setCurrentPage(e.nativeEvent.position)}
      >
        {pageDefinitions.map((page) => {
          if (page.type === PAGE_TYPE_CATEGORY_GROUPS) {
            return renderCategoryGroupsPage(page.title, page.id);
          }
          if (page.type === PAGE_TYPE_PROJECTION) {
            return renderProjectionPage(page.title, page.id);
          }
          return renderPeriodTrendPage(page.title, page.id);
        })}
      </PagerView>

      <View style={styles.footerContainer}>
        <TouchableOpacity
          style={styles.sideButton}
          onPress={() => {
            if (currentPageType === PAGE_TYPE_PERIOD_TREND) {
              setTrendFilterVisible(true);
            } else if (currentPageType === PAGE_TYPE_PROJECTION) {
              setProjectionChartSetupVisible(true);
            } else {
              setChartModalVisible(true);
            }
          }}
        >
          <Text style={styles.sideButtonText}>Chart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideButton}
          onPress={() => {
            if (currentPageType === PAGE_TYPE_PROJECTION) {
              setProjectionFilterSetupVisible(true);
              return;
            }
            handleOpenFilterModal();
          }}
        >
          <Text style={styles.sideButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={addPageModalVisible}
        statusBarTranslucent={true}
        presentationStyle="overFullScreen"
        onRequestClose={() => setAddPageModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setAddPageModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Dashboard Page</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setAddPageModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Choose page type and chart title.</Text>

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Page Type</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  style={[styles.optionButton, newPageType === PAGE_TYPE_PERIOD_TREND && styles.optionButtonActive]}
                  onPress={() => setNewPageType(PAGE_TYPE_PERIOD_TREND)}
                >
                  <Text style={[styles.optionButtonText, newPageType === PAGE_TYPE_PERIOD_TREND && styles.optionButtonTextActive]}>Period Trend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, newPageType === PAGE_TYPE_CATEGORY_GROUPS && styles.optionButtonActive]}
                  onPress={() => setNewPageType(PAGE_TYPE_CATEGORY_GROUPS)}
                >
                  <Text style={[styles.optionButtonText, newPageType === PAGE_TYPE_CATEGORY_GROUPS && styles.optionButtonTextActive]}>Category groups</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionButton, newPageType === PAGE_TYPE_PROJECTION && styles.optionButtonActive]}
                  onPress={() => setNewPageType(PAGE_TYPE_PROJECTION)}
                >
                  <Text style={[styles.optionButtonText, newPageType === PAGE_TYPE_PROJECTION && styles.optionButtonTextActive]}>Projection</Text>
                </TouchableOpacity>
              </View>
            </View>

            {newPageType === PAGE_TYPE_PROJECTION ? (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Projection Subcategory</Text>
                <View style={styles.optionRow}>
                  {PROJECTION_SUBTYPE_OPTIONS.map((option) => {
                    const isActive = newProjectionSubtype === option.key;
                    return (
                      <TouchableOpacity
                        key={option.key}
                        style={[styles.optionButton, isActive && styles.optionButtonActive]}
                        onPress={() => setNewProjectionSubtype(option.key)}
                      >
                        <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Chart Title</Text>
              <TextInput
                style={styles.pageTitleInput}
                value={newPageTitle}
                onChangeText={setNewPageTitle}
                placeholder="Enter chart title"
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalActionButton, styles.applyBtn]} onPress={handleAddPage}>
                <Text style={styles.applyBtnText}>Add Page</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionButton, styles.cancelBtn]} onPress={() => setAddPageModalVisible(false)}>
                <Text style={styles.applyBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={chartModalVisible}>
        <Pressable style={styles.modalOverlay} onPress={() => setChartModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Category Chart Setup</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setChartModalVisible(false)}>
                <Text style={styles.modalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            

            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Chart Type</Text>
              <View style={styles.optionRow}>
                {page2Charts.map((option) => {
                  const isActive = page2ChartType === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.optionButton, isActive && styles.optionButtonActive]}
                      onPress={() => {
                        setPage2ChartType(option.id);
                        updatePageConfig(currentPageData.id, currentPageType, (prev) => ({
                          ...prev,
                          page2ChartType: option.id,
                        }));
                      }}
                    >
                      <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalActionButton, styles.applyBtn]} onPress={() => setChartModalVisible(false)}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalActionButton, styles.cancelBtn]} onPress={() => setChartModalVisible(false)}>
                <Text style={styles.applyBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <DashboardFilterModal
        visible={filterModalVisible}
        initialConfig={filterConfig}
        categoryOptions={categoryOptions}
        recipientOptions={recipientOptions}
        onClose={handleCloseFilterModal}
        onApply={handleApplyFilterConfig}
      />

      <DashboardTrendFilter
        visible={trendFilterVisible}
        initialConfig={trendConfig}
        categoryOptions={categoryOptions}
        onClose={() => setTrendFilterVisible(false)}
        onApply={handleApplyTrendConfig}
      />

      <DashboardProjectionFilter
        visible={projectionChartSetupVisible}
        mode="chart"
        initialConfig={projectionConfig}
        categoryOptions={categoryOptions}
        recipientOptions={recipientOptions}
        onClose={() => setProjectionChartSetupVisible(false)}
        onApply={handleApplyProjectionConfig}
      />

      <DashboardProjectionFilter
        visible={projectionFilterSetupVisible}
        mode="filter"
        initialConfig={projectionConfig}
        categoryOptions={categoryOptions}
        recipientOptions={recipientOptions}
        onClose={() => setProjectionFilterSetupVisible(false)}
        onApply={handleApplyProjectionConfig}
      />
    </View>
  );
};

const TableComponent = ({
  data,
  rows,
  columns,
  firstColumnTitle = 'Month',
  firstColumnFlex = 1,
  amountColumnFlex = 2,
  summaryLabel = 'Summary',
  summaryValue,
}) => {
  const isDynamic = Array.isArray(columns) && columns.length > 0;
  const sourceRows = isDynamic ? (rows || []) : (data || []);

  const computedSummary = isDynamic
    ? (Number.isFinite(Number(summaryValue))
      ? Number(summaryValue)
      : sourceRows.reduce((acc, item) => {
        const numericValues = columns
          .filter((column) => column.type === 'amount')
          .map((column) => Number(item?.[column.key]))
          .filter((value) => Number.isFinite(value));

        if (numericValues.length === 0) return acc;
        return acc + numericValues[numericValues.length - 1];
      }, 0))
    : sourceRows.reduce((acc, item) => acc + Math.round((Number(item.value) || 0) * 100), 0) / 100;

  const formatAmountCell = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '-';
    return numeric >= 0 ? `+$${numeric.toFixed(2)}` : `-$${Math.abs(numeric).toFixed(2)}`;
  };

  const dynamicSummaryAmountFlex = isDynamic ? (columns?.[columns.length - 1]?.flex || 1) : amountColumnFlex;
  const dynamicSummaryLabelFlex = isDynamic
    ? Math.max(1, columns.slice(0, -1).reduce((sum, column) => sum + (column.flex || 1), 0))
    : firstColumnFlex;

  return (
    <View style={styles.tableSection}>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          {isDynamic ? (
            columns.map((column) => (
              <Text
                key={`header-${column.key}`}
                style={[
                  styles.columnHeader,
                  {
                    flex: column.flex || 1,
                    textAlign: column.align === 'right' ? 'right' : 'left',
                    paddingRight: column.align === 'right' ? 12 : 10,
                  },
                ]}
              >
                {column.label}
              </Text>
            ))
          ) : (
            <>
              <Text style={[styles.columnHeader, { flex: firstColumnFlex }]}>{firstColumnTitle}</Text>
              <Text style={[styles.columnHeader, { flex: amountColumnFlex, textAlign: 'right', paddingRight: 20 }]}>Amount</Text>
            </>
          )}
        </View>
        <ScrollView style={styles.scrollBody}>
          {sourceRows.map((item, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 0 ? styles.evenRow : styles.oddRow]}>
              {isDynamic ? (
                columns.map((column) => {
                  const value = item?.[column.key];
                  const numeric = Number(value);
                  const isAmount = column.type === 'amount';
                  const textValue = isAmount ? formatAmountCell(value) : (value == null || value === '' ? '-' : String(value));
                  const textColor = isAmount && Number.isFinite(numeric)
                    ? (numeric >= 0 ? '#2e7d32' : '#d32f2f')
                    : Colors.light.text;

                  return (
                    <Text
                      key={`cell-${index}-${column.key}`}
                      style={[
                        styles.cell,
                        {
                          flex: column.flex || 1,
                          textAlign: column.align === 'right' ? 'right' : 'left',
                          paddingRight: column.align === 'right' ? 12 : 9,
                          fontWeight: isAmount ? 'bold' : '400',
                          color: textColor,
                        },
                      ]}
                    >
                      {textValue}
                    </Text>
                  );
                })
              ) : (
                <>
                  <Text style={[styles.cell, { flex: firstColumnFlex }]}>{item.label || item.month}</Text>
                  <Text style={[styles.cell, { flex: amountColumnFlex, textAlign: 'right', paddingRight: 20, fontWeight: 'bold', color: item.value >= 0 ? '#2e7d32' : '#d32f2f' }]}>
                    {item.value >= 0 ? `+$${item.value.toFixed(2)}` : `-$${Math.abs(item.value).toFixed(2)}`}
                  </Text>
                </>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.summaryRow}>
          <Text style={[styles.cell, { flex: dynamicSummaryLabelFlex, fontWeight: 'bold' }]}>{summaryLabel}</Text>
          <Text style={[styles.cell, { flex: dynamicSummaryAmountFlex, textAlign: 'right', paddingRight: 20, fontWeight: 'bold', color: computedSummary >= 0 ? '#2e7d32' : '#d32f2f' }]}>
            ${computedSummary.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default Dashboard;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { paddingTop: 40, paddingHorizontal: 12, alignItems: 'center', marginBottom: 0, position: 'relative' },
  title: { fontSize: 20, fontWeight: '700', color: Colors.light.title },
  addPageButton: {
    position: 'absolute',
    right: 14,
    top: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  addPageButtonText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
  },
  removePageButton: {
    position: 'absolute',
    right: 56,
    top: 36,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  removePageButtonText: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
  },

  paginationDots: { flexDirection: 'row', marginTop: 8, marginBottom: 0 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#c4cfcb', marginHorizontal: 4 },
  activeDot: { backgroundColor: Colors.primary, width: 20 },

  pagerView: { flex: 1, marginTop: 5 },
  page: { flex: 1 },
  pageRefreshIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: -4,
    gap: 6,
  },
  pageRefreshText: {
    fontSize: 11,
    color: Colors.light.disabledText,
    fontWeight: '600',
  },

  chartSection: { flex: 3, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  chartLabel: { fontSize: 14, color: Colors.light.text, marginTop: 10, fontWeight: '600' },
  chartTitleDropdown: {
    width: '92%',
    marginTop: 10,
    marginBottom: 2,
  },
  chartTitleSelectBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    minHeight: 32,
    paddingVertical: 5,
  },
  chartTitleSelectInput: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 16,
    paddingVertical: 0,
  },
  chartTitleSelectDropdown: {
    backgroundColor: '#ffffff',
    top: 34,
  },
  chartTitleSelectDropdownText: {
    color: Colors.light.text,
  },
  chartHelpText: { marginTop: 12, color: Colors.warning, fontWeight: '600' },
  trendRangeNavigator: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -25,
    marginBottom: 5,
    zIndex: 5,
    elevation: 5,
  },
  trendRangeNavButton: {
    width: 34,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    elevation: 6,
  },
  trendRangeNavButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 16,
  },
  trendRangeLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.light.disabledText,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
  },

  legendStrip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: '4%',
    marginTop: 2,
    marginBottom: 0,
  },

  legendWrap: {
    width: '100%',
    maxHeight: 34,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef3f0',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendDash: {
    width: 14,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    marginRight: 6,
  },
  legendText: {
    color: Colors.light.text,
    fontSize: 12,
  },
  projectionSubtitle: {
    color: Colors.light.disabledText,
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
  },

  pieContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 10,
  },
  pieChartArea: {
    width: '100%',
    marginTop: 0,
    marginBottom: 6,
  },
  pieWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChartLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.disabledText,
    marginBottom: 8,
  },

  tableSection: { flex: 3.65, paddingHorizontal: '4%', paddingBottom: 4 },
  tableContainer: { flex: 1, borderWidth: 1, borderColor: '#d0d0d0', borderRadius: 10, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: Colors.primary, borderBottomWidth: 1, borderBottomColor: '#d0d0d0' },
  scrollBody: { flex: 1 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d0d0d0', alignItems: 'center' },
  evenRow: { backgroundColor: '#ffffff' },
  oddRow: { backgroundColor: '#f5f7fa' },
  columnHeader: { paddingVertical: 9, paddingHorizontal: 10, fontWeight: '700', fontSize: 13, color: '#fff' },
  cell: { paddingHorizontal: 9, paddingVertical: 7, fontSize: 12, borderRightWidth: 1, borderColor: '#d0d0d0' },
  summaryRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#d0d0d0', alignItems: 'center', paddingVertical: 3 },

  footerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: '5%', paddingBottom: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#d0d0d0' },

  sideButton: { width: screenWidth * 0.4, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', backgroundColor: Colors.primary },
  sideButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  modalOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  modalContent: { backgroundColor: '#fff', width: '100%', maxWidth: 760, maxHeight: '95%', borderRadius: 12, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, alignItems: 'stretch' },
  modalHeaderRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalSubtitle: { fontSize: 14, color: Colors.light.disabledText, marginBottom: 8 },
  modalCloseButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.warning },
  modalCloseButtonText: { color: '#fff', fontWeight: '700' },
  modalSection: {
    width: '100%',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#d2d7d4',
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  pageTitleInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    color: Colors.light.text,
  },
  optionRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  optionButtonActive: {
    backgroundColor: Colors.savings,
  },
  optionButtonText: {
    color: '#e8f0ec',
    fontWeight: '700',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  modalActionRow: {
    width: '100%',
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalActionButton: {
    minWidth: 120,
    justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: Colors.expense, paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 },
  applyBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 30, borderRadius: 8 },
  applyBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
