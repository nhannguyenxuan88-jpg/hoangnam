import React, { useState, useMemo } from "react";
import {
  Boxes,
  LineChart,
  HandCoins,
  AlertTriangle,
  FileText,
  Wrench,
  Users,
  Calendar,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAppContext } from "../../contexts/AppContext";
import InventoryAnalytics from "./InventoryAnalytics";
import SalesAnalytics from "./SalesAnalytics";
import FinancialAnalytics from "./FinancialAnalytics";
import ServiceAnalytics from "./ServiceAnalytics";
import CustomerAnalytics from "./CustomerAnalytics";
import KPICards from "./KPICards";
import {
  exportInventoryReport,
  exportSalesReport,
  exportFinancialReport,
  exportLowStockReport,
} from "../../utils/pdfExport";
import { showToast } from "../../utils/toast";
import { formatCurrency } from "../../utils/format";

// === FRESH DATA HOOKS (Real-time from Supabase) ===
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { useCustomerDebtsRepo, useSupplierDebtsRepo } from "../../hooks/useDebtsRepository";
import { useInventoryTxRepo } from "../../hooks/useInventoryTransactionsRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";

type TabType = "inventory" | "sales" | "financial" | "services" | "customers";

// Helper to get date range from filter
const getDateRange = (filter: string): { startDate: Date; endDate: Date; label: string } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let label = "";

  // Handle specific month filters (month1, month2, ... month12)
  if (filter.startsWith("month") && filter.length > 5) {
    const monthNum = parseInt(filter.slice(5), 10);
    if (monthNum >= 1 && monthNum <= 12) {
      startDate = new Date(now.getFullYear(), monthNum - 1, 1);
      endDate = new Date(now.getFullYear(), monthNum, 0, 23, 59, 59);
      label = `Tháng ${monthNum}`;
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Tháng này";
    }
  }
  // Handle quarter filters (q1, q2, q3, q4)
  else if (filter.startsWith("q") && filter.length === 2) {
    const quarterNum = parseInt(filter.slice(1), 10);
    if (quarterNum >= 1 && quarterNum <= 4) {
      const startMonth = (quarterNum - 1) * 3;
      startDate = new Date(now.getFullYear(), startMonth, 1);
      endDate = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59);
      label = `Quý ${quarterNum}`;
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Tháng này";
    }
  }
  // Handle standard filters
  else {
    switch (filter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        label = "Hôm nay";
        break;
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = "7 ngày qua";
        break;
      case "week":
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        label = "Tuần này";
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        label = "Tháng này";
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        label = `Năm ${now.getFullYear()}`;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        label = "Tháng này";
    }
  }

  return { startDate, endDate, label };
};

// Get previous period for comparison
const getPreviousPeriodRange = (filter: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (filter === "month" || filter === "Tháng này") {
    // Previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (filter === "year") {
    // Previous year
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  } else if (filter === "7days") {
    // Previous 7 days
    startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    endDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1);
  } else {
    // Default: previous month
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }

  return { startDate, endDate };
};

// Skeleton Loading Component
const AnalyticsSkeleton: React.FC = () => (
  <div className="animate-pulse">
    {/* KPI Cards Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div className="h-36 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      <div className="h-36 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
    {/* Chart Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  </div>
);

const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("inventory");
  const [dateFilter, setDateFilter] = useState<string>("month");

  // Get currentBranchId and customers from Context (customers don't have a separate hook)
  const { currentBranchId, customers } = useAppContext();

  // === FETCH FRESH DATA FROM HOOKS (Real-time from Supabase) ===
  const { data: sales = [], isLoading: salesLoading } = useSalesRepo();
  const { data: parts = [], isLoading: partsLoading } = usePartsRepo();
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersRepo();
  const { data: customerDebts = [], isLoading: customerDebtsLoading } = useCustomerDebtsRepo();
  const { data: supplierDebts = [], isLoading: supplierDebtsLoading } = useSupplierDebtsRepo();
  const { data: inventoryTransactions = [], isLoading: txLoading } = useInventoryTxRepo();

  // Fetch ALL cash transactions for the branch from the earliest relevant date (start of last year)
  // We need "Last Year" data for YoY comparison
  const lastYearStart = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1, 0, 1); // Jan 1st last year
    return d.toISOString();
  }, []);

  const { data: cashTransactions = [], isLoading: cashTxLoading } = useCashTxRepo({
    branchId: currentBranchId,
    startDate: lastYearStart,
    // No endDate implies "to now"
  });

  const isLoading = salesLoading || partsLoading || workOrdersLoading ||
    customerDebtsLoading || supplierDebtsLoading || txLoading || cashTxLoading;

  // Get date range from filter
  const currentDateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);
  const previousDateRange = useMemo(() => getPreviousPeriodRange(dateFilter), [dateFilter]);

  // === EXCLUDED CATEGORIES CONFIG (Mirrored from ReportsManager) ===
  const excludedIncomeCategories = useMemo(() => [
    "service",
    "dịch vụ",
    "sale_income",
    "bán hàng",
    "service_income",
    "service_deposit",
  ], []);

  const excludedExpenseCategories = useMemo(() => [
    "supplier_payment",
    "nhập kho",
    "nhập hàng",
    "goods_receipt",
    "import",
    "outsourcing",
    "service_cost",
    "refund",
  ], []);

  const isExcludedIncomeCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedIncomeCategories.some(
      (exc) => exc.toLowerCase() === lowerCat
    );
  };

  const isExcludedExpenseCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedExpenseCategories.some(
      (exc) => exc.toLowerCase() === lowerCat
    );
  };

  // === STATS CALCULATION (filtered by date range) ===
  const { currentStats, previousStats } = useMemo(() => {
    // Create costPrice lookup map from parts (partId -> costPrice)
    const costPriceMap = new Map<string, number>();
    parts.forEach((p: any) => {
      const cost = p.costPrice?.[currentBranchId] || 0;
      costPriceMap.set(p.id, cost);
    });

    const calculateStats = (startDate: Date, endDate: Date) => {
      // 1. SALES REVENUE (Bán hàng)
      const periodSales = sales.filter((s) => {
        const d = new Date(s.date);
        return d >= startDate && d <= endDate;
      });
      const salesRevenue = periodSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const salesCost = periodSales.reduce((sum, s: any) => {
        return sum + (s.items || []).reduce((c: number, item: any) => {
          const unitCost = item.isService ? 0 : (costPriceMap.get(item.partId) || 0);
          return c + (unitCost * (item.quantity || 0));
        }, 0);
      }, 0);
      const salesGrossProfit = salesRevenue - salesCost;

      // 2. WORKORDERS/SERVICES REVENUE (Dịch vụ sửa chữa)
      const periodWO = workOrders.filter((wo) => {
        const d = new Date(wo.creationDate);
        return d >= startDate && d <= endDate &&
          (wo.status === "Trả máy" || wo.paymentStatus === "paid" || wo.paymentStatus === "partial" || (wo.totalPaid && wo.totalPaid > 0)) &&
          !wo.refunded;
      });
      const woRevenue = periodWO.reduce((sum, wo: any) => sum + (wo.totalPaid || wo.total || 0), 0);

      const woCost = periodWO.reduce((sum, wo: any) => {
        const partsCost = (wo.partsUsed || []).reduce((c: number, p: any) =>
          c + ((p.costPrice || costPriceMap.get(p.partId) || 0) * (p.quantity || 0)), 0);
        const svcCost = (wo.additionalServices || []).reduce((c: number, svc: any) =>
          c + ((svc.costPrice || 0) * (svc.quantity || 0)), 0);
        return sum + partsCost + svcCost;
      }, 0);
      const woGrossProfit = woRevenue - woCost;

      // 3. CASH TRANSACTIONS (Revenue & Expenses)
      const periodCashTx = cashTransactions.filter((tx: any) => {
        const d = new Date(tx.date);
        return d >= startDate && d <= endDate;
      });

      // Extra Income (Thu khác, Thu nợ...) excluding Service/Sale income
      const cashIncome = periodCashTx
        .filter((tx: any) => tx.type === "income" && !isExcludedIncomeCategory(tx.category))
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      // Expenses (Chi phí vận hành...) excluding COGS/Import
      const cashExpense = periodCashTx
        .filter((tx: any) => tx.type === "expense" && (tx.amount || 0) > 0 && !isExcludedExpenseCategory(tx.category))
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      return {
        revenue: salesRevenue + woRevenue + cashIncome,
        profit: (salesGrossProfit + woGrossProfit + cashIncome) - cashExpense, // Net Profit
      };
    };

    return {
      currentStats: calculateStats(currentDateRange.startDate, currentDateRange.endDate),
      previousStats: calculateStats(previousDateRange.startDate, previousDateRange.endDate),
    };
  }, [sales, workOrders, parts, cashTransactions, currentBranchId, currentDateRange, previousDateRange]);

  // === 6-MONTH TREND DATA FOR SPARKLINE ===
  const monthlyTrendData = useMemo(() => {
    const now = new Date();
    const result: { month: string; revenue: number; profit: number }[] = [];

    // Create costPrice lookup
    const costPriceMap = new Map<string, number>();
    parts.forEach((p: any) => {
      costPriceMap.set(p.id, p.costPrice?.[currentBranchId] || 0);
    });

    for (let i = 5; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59);

      // Sales
      const monthSales = sales.filter((s) => {
        const d = new Date(s.date);
        return d >= targetMonth && d <= monthEnd;
      });
      const salesRevenue = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const salesCost = monthSales.reduce((sum, s: any) => {
        return sum + (s.items || []).reduce((c: number, item: any) => {
          const unitCost = item.isService ? 0 : (costPriceMap.get(item.partId) || 0);
          return c + (unitCost * (item.quantity || 0));
        }, 0);
      }, 0);

      // Work orders
      const monthWO = workOrders.filter((wo) => {
        const d = new Date(wo.creationDate);
        return d >= targetMonth && d <= monthEnd &&
          (wo.status === "Trả máy" || wo.paymentStatus === "paid" || wo.paymentStatus === "partial" || (wo.totalPaid && wo.totalPaid > 0)) &&
          !wo.refunded;
      });
      const woRevenue = monthWO.reduce((sum, wo: any) => sum + (wo.totalPaid || wo.total || 0), 0);
      const woCost = monthWO.reduce((sum, wo: any) => {
        const partsCost = (wo.partsUsed || []).reduce((c: number, p: any) =>
          c + ((p.costPrice || costPriceMap.get(p.partId) || 0) * (p.quantity || 0)), 0);
        const svcCost = (wo.additionalServices || []).reduce((c: number, svc: any) =>
          c + ((svc.costPrice || 0) * (svc.quantity || 0)), 0);
        return sum + partsCost + svcCost;
      }, 0);

      // Cash Transactions
      const monthCashTx = cashTransactions.filter((tx: any) => {
        const d = new Date(tx.date);
        return d >= targetMonth && d <= monthEnd;
      });

      const cashIncome = monthCashTx
        .filter((tx: any) => tx.type === "income" && !isExcludedIncomeCategory(tx.category))
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      const cashExpense = monthCashTx
        .filter((tx: any) => tx.type === "expense" && (tx.amount || 0) > 0 && !isExcludedExpenseCategory(tx.category))
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      const totalRevenue = salesRevenue + woRevenue + cashIncome;
      const totalProfit = (salesRevenue - salesCost) + (woRevenue - woCost) + cashIncome - cashExpense;

      result.push({
        month: targetMonth.toLocaleDateString('vi-VN', { month: 'short' }),
        revenue: Math.round(totalRevenue / 1000000), // In millions
        profit: Math.round(totalProfit / 1000000),
      });
    }
    return result;
  }, [sales, workOrders, parts, cashTransactions, currentBranchId]);

  // === PERFORMANCE COMPARISON ===

  // Month over Month comparison
  const monthOverMonth = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const calculateRevenue = (startDate: Date, endDate: Date) => {
      const salesRev = sales
        .filter((s) => { const d = new Date(s.date); return d >= startDate && d <= endDate; })
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const woRev = workOrders
        .filter((wo) => {
          const d = new Date(wo.creationDate);
          return d >= startDate && d <= endDate &&
            (wo.status === "Trả máy" || wo.paymentStatus === "paid" || wo.paymentStatus === "partial" || (wo.totalPaid && wo.totalPaid > 0)) &&
            !wo.refunded;
        })
        .reduce((sum, wo) => sum + (wo.totalPaid || wo.total || 0), 0);

      const cashRev = cashTransactions
        .filter((tx: any) => {
          const d = new Date(tx.date);
          return d >= startDate && d <= endDate && tx.type === "income" && !isExcludedIncomeCategory(tx.category);
        })
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      return salesRev + woRev + cashRev;
    };

    const thisMonth = calculateRevenue(thisMonthStart, thisMonthEnd);
    const lastMonth = calculateRevenue(lastMonthStart, lastMonthEnd);
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100) : 0;

    return { thisMonth, lastMonth, change };
  }, [sales, workOrders, cashTransactions]);

  // Year over Year comparison
  const yearOverYear = useMemo(() => {
    const now = new Date();
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const thisYearEnd = now;
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59);

    const calculateRevenue = (startDate: Date, endDate: Date) => {
      const salesRev = sales
        .filter((s) => { const d = new Date(s.date); return d >= startDate && d <= endDate; })
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const woRev = workOrders
        .filter((wo) => {
          const d = new Date(wo.creationDate);
          return d >= startDate && d <= endDate &&
            (wo.status === "Trả máy" || wo.paymentStatus === "paid" || wo.paymentStatus === "partial" || (wo.totalPaid && wo.totalPaid > 0)) &&
            !wo.refunded;
        })
        .reduce((sum, wo) => sum + (wo.totalPaid || wo.total || 0), 0);

      const cashRev = cashTransactions
        .filter((tx: any) => {
          const d = new Date(tx.date);
          return d >= startDate && d <= endDate && tx.type === "income" && !isExcludedIncomeCategory(tx.category);
        })
        .reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

      return salesRev + woRev + cashRev;
    };

    const thisYear = calculateRevenue(thisYearStart, thisYearEnd);
    const lastYear = calculateRevenue(lastYearStart, lastYearEnd);
    const change = lastYear > 0 ? ((thisYear - lastYear) / lastYear * 100) : 0;

    return { thisYear, lastYear, change };
  }, [sales, workOrders, cashTransactions]);

  // Simple forecast based on trend
  const forecast = useMemo(() => {
    if (monthlyTrendData.length < 3) return { nextMonth: 0, trend: 'stable' };

    // Use last 3 months for simple linear regression
    const recentMonths = monthlyTrendData.slice(-3);
    const avgGrowth = recentMonths.reduce((sum, m, i) => {
      if (i === 0) return 0;
      const prev = recentMonths[i - 1].revenue;
      return sum + (prev > 0 ? (m.revenue - prev) / prev : 0);
    }, 0) / (recentMonths.length - 1);

    const lastMonth = recentMonths[recentMonths.length - 1].revenue;
    const nextMonth = Math.round(lastMonth * (1 + avgGrowth));

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (avgGrowth > 0.05) trend = 'up';
    else if (avgGrowth < -0.05) trend = 'down';

    return { nextMonth, trend, growthRate: avgGrowth * 100 };
  }, [monthlyTrendData]);

  const handleExportPDF = () => {
    try {
      switch (activeTab) {
        case "inventory":
          exportInventoryReport(parts, currentBranchId);
          showToast.success("Đã xuất báo cáo tồn kho thành công!");
          break;
        case "sales":
          exportSalesReport(sales, parts);
          showToast.success("Đã xuất báo cáo bán hàng thành công!");
          break;
        case "financial":
          exportFinancialReport(
            sales,
            inventoryTransactions,
            parts,
            currentBranchId,
            customerDebts,
            supplierDebts
          );
          showToast.success("Đã xuất báo cáo tài chính thành công!");
          break;
      }
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Lỗi khi xuất báo cáo PDF");
    }
  };

  const handleExportLowStock = () => {
    try {
      exportLowStockReport(parts, currentBranchId);
      showToast.success("Đã xuất báo cáo cảnh báo tồn kho!");
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Lỗi khi xuất báo cáo");
    }
  };

  const tabs = [
    { id: "inventory" as const, label: "Tồn kho", icon: <Boxes className="w-4 h-4" /> },
    { id: "sales" as const, label: "Bán hàng", icon: <HandCoins className="w-4 h-4" /> },
    { id: "financial" as const, label: "Tài chính", icon: <LineChart className="w-4 h-4" /> },
    { id: "services" as const, label: "Dịch vụ", icon: <Wrench className="w-4 h-4" /> },
    { id: "customers" as const, label: "Khách hàng", icon: <Users className="w-4 h-4" /> },
  ];

  // Show loading state with skeleton
  if (isLoading) {
    return (
      <div className="p-4 max-w-[1600px] mx-auto">
        <div className="mb-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2 animate-pulse"></div>
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        </div>
        <AnalyticsSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Báo cáo & Phân tích
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Theo dõi và phân tích hiệu suất kinh doanh
            </p>
          </div>

          {/* Filter & Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-sm bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 cursor-pointer pr-6 dark:[color-scheme:dark]"
                style={{ colorScheme: 'auto' }}
              >
                <optgroup label="Thời gian">
                  <option value="today">Hôm nay</option>
                  <option value="7days">7 ngày qua</option>
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                  <option value="year">Năm nay</option>
                </optgroup>
                <optgroup label="Theo tháng">
                  <option value="month1">Tháng 1</option>
                  <option value="month2">Tháng 2</option>
                  <option value="month3">Tháng 3</option>
                  <option value="month4">Tháng 4</option>
                  <option value="month5">Tháng 5</option>
                  <option value="month6">Tháng 6</option>
                  <option value="month7">Tháng 7</option>
                  <option value="month8">Tháng 8</option>
                  <option value="month9">Tháng 9</option>
                  <option value="month10">Tháng 10</option>
                  <option value="month11">Tháng 11</option>
                  <option value="month12">Tháng 12</option>
                </optgroup>
                <optgroup label="Theo quý">
                  <option value="q1">Quý 1 (T1-T3)</option>
                  <option value="q2">Quý 2 (T4-T6)</option>
                  <option value="q3">Quý 3 (T7-T9)</option>
                  <option value="q4">Quý 4 (T10-T12)</option>
                </optgroup>
              </select>
            </div>

            {activeTab === "inventory" && (
              <button
                onClick={handleExportLowStock}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 text-sm"
              >
                <AlertTriangle className="w-4 h-4" /> Cảnh báo tồn kho
              </button>
            )}
            {(activeTab === "inventory" || activeTab === "sales" || activeTab === "financial") && (
              <button
                onClick={handleExportPDF}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 text-sm"
              >
                <FileText className="w-4 h-4" /> Xuất PDF
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards - With comparison to previous period */}
        <div className="mb-4">
          <KPICards
            currentRevenue={currentStats.revenue}
            currentProfit={currentStats.profit}
            previousRevenue={previousStats.revenue}
            previousProfit={previousStats.profit}
            dateRange={{
              label: currentDateRange.label,
              from: currentDateRange.startDate,
              to: currentDateRange.endDate
            }}
          />
        </div>

        {/* 6-Month Revenue Trend Chart */}
        <div className="mb-6 bg-white dark:bg-[#1e293b] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Xu hướng 6 tháng qua (triệu đồng)
          </h3>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} width={35} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [`${value}M`, name]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} name="Doanh thu" />
              <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} name="Lợi nhuận" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Doanh thu</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span>Lợi nhuận</span>
            </div>
          </div>
        </div>

        {/* Performance Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {/* Month over Month */}
          <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Tháng này vs Tháng trước
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(monthOverMonth.thisMonth)}
                </div>
                <div className="text-[10px] text-slate-500">
                  trước: {formatCurrency(monthOverMonth.lastMonth)}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${monthOverMonth.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                <span>{monthOverMonth.change >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(monthOverMonth.change).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Year over Year */}
          <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Năm nay vs Năm ngoái (YTD)
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(yearOverYear.thisYear)}
                </div>
                <div className="text-[10px] text-slate-500">
                  trước: {formatCurrency(yearOverYear.lastYear)}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm font-semibold ${yearOverYear.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                <span>{yearOverYear.change >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(yearOverYear.change).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Forecast */}
          <div className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 p-4 rounded-xl border border-violet-200 dark:border-violet-700">
            <div className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
              Dự báo tháng tới
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-bold text-violet-900 dark:text-violet-100">
                  ~{forecast.nextMonth}M đ
                </div>
                <div className="text-[10px] text-violet-600 dark:text-violet-400">
                  Dựa trên xu hướng 3 tháng
                </div>
              </div>
              <div className={`text-2xl ${forecast.trend === 'up' ? 'text-emerald-500' : forecast.trend === 'down' ? 'text-red-500' : 'text-slate-400'
                }`}>
                {forecast.trend === 'up' ? '📈' : forecast.trend === 'down' ? '📉' : '➡️'}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-all relative text-sm whitespace-nowrap ${activeTab === tab.id
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
            >
              <span className="flex items-center gap-1.5">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content - All children receive fresh data + dateFilter as props */}
      <div className="animate-fadeIn">
        {activeTab === "inventory" && (
          <InventoryAnalytics
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            inventoryTransactions={inventoryTransactions}
            currentBranchId={currentBranchId}
            dateFilter={dateFilter}
          />
        )}
        {activeTab === "sales" && (
          <SalesAnalytics
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            currentBranchId={currentBranchId}
            dateFilter={dateFilter}
          />
        )}
        {activeTab === "financial" && (
          <FinancialAnalytics
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            customerDebts={customerDebts}
            supplierDebts={supplierDebts}
            currentBranchId={currentBranchId}
            dateFilter={dateFilter}
          />
        )}
        {activeTab === "services" && (
          <ServiceAnalytics
            workOrders={workOrders}
            currentBranchId={currentBranchId}
            dateFilter={dateFilter}
          />
        )}
        {activeTab === "customers" && (
          <CustomerAnalytics
            customers={customers}
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            currentBranchId={currentBranchId}
            dateFilter={dateFilter}
          />
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
