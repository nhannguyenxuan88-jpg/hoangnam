import React, { useState, useMemo } from "react";
import {
  DollarSign,
  Wallet,
  Boxes,
  BadgePercent,
  ClipboardList,
  Users,
  FileSpreadsheet,
  TrendingUp,
  Tag,
  Check,
  BriefcaseBusiness,
  FileText,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useWorkOrders } from "../../hooks/useSupabase";
import {
  useCustomerDebtsRepo,
  useSupplierDebtsRepo,
} from "../../hooks/useDebtsRepository";
import { supabase } from "../../supabaseClient";
import type { Sale, Part, WorkOrder } from "../../types";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import {
  exportRevenueReport,
  exportCashflowReport,
  exportInventoryReport,
  exportPayrollReport,
  exportDebtReport,
  exportTopProductsReport,
  exportProductProfitReport,
  exportDetailedInventoryReport,
} from "../../utils/excelExport";
import { DailyDetailModal } from "./DailyDetailModal";
import { ReportsManagerMobile } from "./ReportsManagerMobile";


type ReportTab =
  | "revenue"
  | "cashflow"
  | "inventory"
  | "payroll"
  | "debt"
  | "tax";
type DateRange = "today" | "week" | "month" | "quarter" | "year" | "custom";

const REPORT_TAB_CONFIGS: Array<{
  key: ReportTab;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
  dotClass: string;
}> = [
    {
      key: "revenue",
      label: "Doanh thu",
      icon: <DollarSign className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-blue-600 to-sky-500 text-white border-transparent shadow-lg shadow-blue-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-blue-700 dark:text-blue-200 border-blue-200 dark:border-blue-700 hover:bg-blue-50/80 dark:hover:bg-blue-900/20",
      dotClass: "bg-blue-400",
    },
    {
      key: "cashflow",
      label: "Thu chi",
      icon: <Wallet className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-emerald-500 to-lime-500 text-white border-transparent shadow-lg shadow-emerald-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50/70 dark:hover:bg-emerald-900/20",
      dotClass: "bg-emerald-400",
    },
    {
      key: "inventory",
      label: "Tồn kho",
      icon: <Boxes className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-lg shadow-orange-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:bg-amber-50/70 dark:hover:bg-amber-900/20",
      dotClass: "bg-amber-400",
    },
    {
      key: "payroll",
      label: "Lương",
      icon: <BriefcaseBusiness className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-lg shadow-violet-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-violet-700 dark:text-violet-200 border-violet-200 dark:border-violet-800 hover:bg-violet-50/70 dark:hover:bg-violet-900/20",
      dotClass: "bg-violet-400",
    },
    {
      key: "debt",
      label: "Công nợ",
      icon: <ClipboardList className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-rose-500 to-red-500 text-white border-transparent shadow-lg shadow-rose-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800 hover:bg-rose-50/70 dark:hover:bg-rose-900/20",
      dotClass: "bg-rose-400",
    },
    {
      key: "tax",
      label: "Báo cáo thuế",
      icon: <FileText className="w-4 h-4" />,
      activeClass:
        "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-500/30",
      inactiveClass:
        "bg-white dark:bg-slate-900/60 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20",
      dotClass: "bg-indigo-400",
    },
  ];

const ReportsManager: React.FC = () => {
  const { payrollRecords, customers, suppliers, currentBranchId, employees } =
    useAppContext();
  // Repository data (Supabase-backed)
  const { data: salesData = [], isLoading: salesLoading } = useSalesRepo();
  const { data: partsData = [], isLoading: partsLoading } = usePartsRepo();
  const { data: workOrdersData = [], isLoading: workOrdersLoading } =
    useWorkOrders();
  const { data: customerDebtsData = [], isLoading: customerDebtsLoading } =
    useCustomerDebtsRepo();
  const { data: supplierDebtsData = [], isLoading: supplierDebtsLoading } =
    useSupplierDebtsRepo();

  // Fetch unpaid work orders for debt calculation (same as DebtManager)
  const [unpaidWorkOrders, setUnpaidWorkOrders] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchUnpaidWorkOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("work_orders")
          .select("*")
          .eq("status", "Trả máy")
          .eq("branchid", currentBranchId)
          .gt("remainingamount", 0);

        if (!error && data) {
          setUnpaidWorkOrders(data);
        }
      } catch (err) {
        console.error("Error fetching unpaid work orders:", err);
      }
    };

    fetchUnpaidWorkOrders();
  }, [currentBranchId]);

  // Build parts cost lookup map
  const partsCostMap = useMemo(() => {
    const map = new Map<string, number>();
    partsData.forEach((part: Part) => {
      const costPrice = part.costPrice?.[currentBranchId] || 0;
      map.set(part.id, costPrice);
      map.set(part.sku, costPrice); // Also lookup by SKU
    });
    return map;
  }, [partsData, currentBranchId]);

  const [activeTab, setActiveTab] = useState<ReportTab>("revenue");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  ); // 1-12
  const [selectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);


  // Function to handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc"); // Default to descending for numbers
    }
  };

  // Tính toán khoảng thời gian
  const { start, end } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      return { start: new Date(startDate), end: new Date(endDate) };
    }

    switch (dateRange) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "week":
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        // Use selectedMonth instead of current month
        start = new Date(selectedYear, selectedMonth - 1, 1);
        end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        break;
      case "quarter":
        start = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case "year":
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }

    return { start, end };
  }, [dateRange, startDate, endDate, selectedMonth, selectedYear]);

  // Báo cáo doanh thu (bao gồm cả Sales và Work Orders đã thanh toán)
  const revenueReport = useMemo(() => {
    // Filter sales
    const filteredSales: Sale[] = salesData.filter((s: Sale) => {
      const saleDate = new Date(s.date);
      return saleDate >= start && saleDate <= end;
    });

    // Filter work orders (chỉ lấy những đơn đã thanh toán)
    const filteredWorkOrders = workOrdersData.filter((wo: any) => {
      const woDate = new Date(wo.creationDate || wo.creationdate);
      const isPaid =
        wo.paymentStatus === "paid" ||
        wo.paymentstatus === "paid" ||
        wo.paymentStatus === "partial" ||
        wo.paymentstatus === "partial";
      return woDate >= start && woDate <= end && isPaid;
    });



    // Helper function to get cost price from map or fallback
    const getPartCost = (partId: string, sku: string, fallbackCost: number) => {
      return (
        partsCostMap.get(partId) || partsCostMap.get(sku) || fallbackCost || 0
      );
    };

    // Sales totals
    const salesRevenue = filteredSales.reduce(
      (sum: number, s: Sale) => sum + s.total,
      0
    );
    const salesCost = filteredSales.reduce((sum: number, s: Sale) => {
      const cost = s.items.reduce((c: number, it: any) => {
        // Try to get cost from partsData first, then fallback to item's costPrice
        const partCost = getPartCost(
          it.partId,
          it.sku,
          (it as any).costPrice || 0
        );
        return c + partCost * it.quantity;
      }, 0);
      return sum + cost;
    }, 0);

    // Work orders totals
    const woRevenue = filteredWorkOrders.reduce(
      (sum: number, wo: any) =>
        sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
      0
    );
    const woCost = filteredWorkOrders.reduce((sum: number, wo: any) => {
      const parts = wo.partsUsed || wo.partsused || [];
      const partsCost = parts.reduce((c: number, p: any) => {
        const partId = p.partId || p.partid;
        const sku = p.sku;
        // Get cost from partsData, fallback to stored costPrice
        const cost = getPartCost(partId, sku, p.costPrice || p.costprice || 0);
        return c + cost * (p.quantity || 0);
      }, 0);
      // ✅ FIX: Ưu tiên field có dữ liệu thực (length > 0), không chỉ truthy
      // Vì empty array [] vẫn là truthy trong JS nên phải check length
      const servicesFromCamelCase = wo.additionalServices;
      const servicesFromLowercase = wo.additionalservices;
      const servicesFromSnakeCase = wo.additional_services;
      const services =
        (Array.isArray(servicesFromCamelCase) && servicesFromCamelCase.length > 0) ? servicesFromCamelCase :
          (Array.isArray(servicesFromLowercase) && servicesFromLowercase.length > 0) ? servicesFromLowercase :
            (Array.isArray(servicesFromSnakeCase) && servicesFromSnakeCase.length > 0) ? servicesFromSnakeCase :
              [];
      const servicesCost = (Array.isArray(services) ? services : []).reduce((c: number, s: any) => {
        // Hỗ trợ nhiều biến thể tên field từ database
        const rawCost = s.costPrice ?? s.costprice ?? s.cost_price ?? s.giaNhap ?? s.gia_nhap ?? 0;
        return c + (Number(rawCost) || 0) * (Number(s.quantity) || 0);
      }, 0);
      return sum + partsCost + servicesCost;
    }, 0);

    const totalRevenue = salesRevenue + woRevenue;
    const totalCost = salesCost + woCost;
    const totalProfit = totalRevenue - totalCost;

    // Group by date for daily report (combine sales and work orders)
    const dataByDate = new Map<
      string,
      {
        date: string;
        sales: Sale[];
        workOrders: any[];
        totalRevenue: number;
        totalCost: number;
        partsCost: number;
        servicesCost: number;
        totalProfit: number;
        orderCount: number;
      }
    >();

    // Add sales to daily data
    filteredSales.forEach((sale) => {
      const dateKey = new Date(sale.date).toISOString().split("T")[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {
          date: dateKey,
          sales: [],
          workOrders: [],
          totalRevenue: 0,
          totalCost: 0,
          partsCost: 0,
          servicesCost: 0,
          totalProfit: 0,
          orderCount: 0,
        });
      }
      const dayData = dataByDate.get(dateKey)!;
      const saleCost = sale.items.reduce((c: number, it: any) => {
        const partCost = getPartCost(
          it.partId,
          it.sku,
          (it as any).costPrice || 0
        );
        return c + partCost * it.quantity;
      }, 0);
      dayData.sales.push(sale);
      dayData.totalRevenue += sale.total;
      dayData.totalCost += saleCost;
      dayData.partsCost += saleCost;
      dayData.totalProfit += sale.total - saleCost;
      dayData.orderCount += 1;
    });

    // Add work orders to daily data
    filteredWorkOrders.forEach((wo: any) => {
      const dateKey = new Date(wo.creationDate || wo.creationdate)
        .toISOString()
        .split("T")[0];
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {
          date: dateKey,
          sales: [],
          workOrders: [],
          totalRevenue: 0,
          totalCost: 0,
          partsCost: 0,
          servicesCost: 0,
          totalProfit: 0,
          orderCount: 0,
        });
      }
      const dayData = dataByDate.get(dateKey)!;
      const parts = wo.partsUsed || wo.partsused || [];
      const partsCost = parts.reduce((c: number, p: any) => {
        const partId = p.partId || p.partid;
        const sku = p.sku;
        const cost = getPartCost(partId, sku, p.costPrice || p.costprice || 0);
        return c + cost * (p.quantity || 0);
      }, 0);
      // ✅ FIX: Ưu tiên field có dữ liệu thực (length > 0), không chỉ truthy
      const servicesFromCamelCase = wo.additionalServices;
      const servicesFromLowercase = wo.additionalservices;
      const servicesFromSnakeCase = wo.additional_services;
      const services =
        (Array.isArray(servicesFromCamelCase) && servicesFromCamelCase.length > 0) ? servicesFromCamelCase :
          (Array.isArray(servicesFromLowercase) && servicesFromLowercase.length > 0) ? servicesFromLowercase :
            (Array.isArray(servicesFromSnakeCase) && servicesFromSnakeCase.length > 0) ? servicesFromSnakeCase :
              [];
      const servicesCost = (Array.isArray(services) ? services : []).reduce((c: number, s: any) => {
        // Hỗ trợ nhiều biến thể tên field từ database
        const rawCost = s.costPrice ?? s.costprice ?? s.cost_price ?? s.giaNhap ?? s.gia_nhap ?? 0;
        return c + (Number(rawCost) || 0) * (Number(s.quantity) || 0);
      }, 0);



      const woCost = partsCost + servicesCost;
      const woTotal = wo.totalPaid || wo.totalpaid || wo.total || 0;
      dayData.workOrders.push(wo);
      dayData.totalRevenue += woTotal;
      dayData.totalCost += woCost;
      dayData.partsCost += partsCost;
      dayData.servicesCost += servicesCost;
      dayData.totalProfit += woTotal - woCost;
      dayData.orderCount += 1;
    });

    // Convert to array and sort by date
    const dailyReport = Array.from(dataByDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      sales: filteredSales,
      workOrders: filteredWorkOrders,
      dailyReport,
      totalRevenue,
      totalCost,
      totalProfit, // Lợi nhuận gộp (chưa trừ chi phí vận hành)
      profitMargin:
        totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0,
      orderCount: filteredSales.length + filteredWorkOrders.length,
      salesCount: filteredSales.length,
      workOrdersCount: filteredWorkOrders.length,
    };
  }, [salesData, workOrdersData, partsCostMap, start, end]);

  // Sorted daily report based on sortColumn and sortDirection
  const sortedDailyReport = useMemo(() => {
    if (!sortColumn) return revenueReport.dailyReport;

    return [...revenueReport.dailyReport].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "totalCost":
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
        case "totalRevenue":
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case "totalProfit":
          aValue = a.totalProfit;
          bValue = b.totalProfit;
          break;
        case "orderCount":
          aValue = a.orderCount;
          bValue = b.orderCount;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [revenueReport.dailyReport, sortColumn, sortDirection]);

  // Báo cáo thu chi
  // Fetch cash transactions via repository with range filters
  const { data: cashTxData = [], isLoading: cashTxLoading } = useCashTxRepo({
    branchId: currentBranchId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  // Tính tổng thu/chi từ phiếu thu chi (loại trừ phiếu thu "Dịch vụ" vì đã tính trong doanh thu sửa chữa)
  // Các category phiếu thu đã được tính trong doanh thu (Sales/Work Orders)
  const excludedIncomeCategories = [
    "service",
    "dịch vụ",
    "sale_income", // Thu từ bán hàng
    "bán hàng",
    "service_income", // Thu từ phiếu sửa chữa
    "service_deposit", // Đặt cọc dịch vụ
  ];

  // Các category phiếu chi KHÔNG tính vào lợi nhuận (vì đã tính trong giá vốn)
  const excludedExpenseCategories = [
    "supplier_payment", // Chi trả NCC (nhập kho) - đã tính trong giá vốn hàng bán
    "nhập kho",
    "nhập hàng",
    "goods_receipt",
    "import",
    "outsourcing",      // Chi gia công bên ngoài - đã tính trong lợi nhuận phiếu SC
    "service_cost",     // Chi phí dịch vụ - đã tính trong lợi nhuận phiếu SC
    "refund",           // Hoàn trả - không phải chi phí thực tế
  ];

  // Helper function để check exclude với case-insensitive
  const isExcludedIncomeCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedIncomeCategories.some(
      (exc) => exc.toLowerCase() === lowerCat
    );
  };

  // Helper function để check exclude expense categories
  const isExcludedExpenseCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedExpenseCategories.some(
      (exc) => exc.toLowerCase() === lowerCat
    );
  };

  // Helper function to translate category names to Vietnamese
  const translateCategory = (category: string): string => {
    const categoryMap: Record<string, string> = {
      // Income categories
      debt_collection: "Thu nợ",
      service_income: "Thu dịch vụ",
      sale_income: "Thu bán hàng",
      service_deposit: "Đặt cọc dịch vụ",
      other_income: "Thu khác",
      service: "Dịch vụ",

      // Expense categories
      supplier_payment: "Trả nhà cung cấp",
      salary: "Lương",
      rent: "Tiền thuê",
      utilities: "Tiền điện nước",
      marketing: "Marketing",
      maintenance: "Bảo trì",
      other_expense: "Chi khác",
      goods_receipt: "Nhập hàng",
      import: "Nhập kho",

      // Common Vietnamese
      "nhập kho": "Nhập kho",
      "nhập hàng": "Nhập hàng",
      "bán hàng": "Bán hàng",
      "dịch vụ": "Dịch vụ",
    };

    return categoryMap[category.toLowerCase()] || category;
  };

  const cashTotals = useMemo(() => {
    const filteredTransactions = cashTxData.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });
    // Phiếu thu: loại trừ thu từ dịch vụ/bán hàng (đã tính trong Sales/Work Orders)
    const totalIncome = filteredTransactions
      .filter(
        (t) => t.type === "income" && !isExcludedIncomeCategory(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);
    // Phiếu chi: loại trừ chi nhập kho (đã tính trong giá vốn hàng bán)
    // CHỈ TÍNH expense với amount DƯƠNG (chi thực tế)
    const totalExpense = filteredTransactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.amount > 0 && // CHỈ LẤY SỐ DƯƠNG
          !isExcludedExpenseCategory(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    // Debug log
    console.log("[ReportsManager] Cash totals:", {
      totalTransactions: filteredTransactions.length,
      incomeAfterFilter: totalIncome,
      expense: totalExpense,
      excludedIncomeCategories: excludedIncomeCategories,
      excludedExpenseCategories: excludedExpenseCategories,
      expenseByCategory: filteredTransactions
        .filter((t) => t.type === "expense")
        .reduce((acc, t) => {
          const cat = t.category || "unknown";
          acc[cat] = (acc[cat] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>),
    });

    return { totalIncome, totalExpense };
  }, [cashTxData, start, end]);

  // Doanh thu tổng hợp = Doanh thu bán hàng + Phiếu thu
  const combinedRevenue = revenueReport.totalRevenue + cashTotals.totalIncome;
  // Lợi nhuận ròng = Lợi nhuận + Thu khác - Chi khác
  const netProfit = revenueReport.totalProfit + cashTotals.totalIncome - cashTotals.totalExpense;

  const cashflowReport = useMemo(() => {
    const filteredTransactions = cashTxData.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });

    const income = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const byCategory: Record<string, { income: number; expense: number }> = {};
    filteredTransactions.forEach((t) => {
      const category = t.category || "other";
      if (!byCategory[category]) {
        byCategory[category] = { income: 0, expense: 0 };
      }
      if (t.type === "income") {
        byCategory[category].income += t.amount;
      } else {
        byCategory[category].expense += t.amount;
      }
    });

    return {
      transactions: filteredTransactions,
      totalIncome: income,
      totalExpense: expense,
      netCashFlow: income - expense,
      byCategory,
    };
  }, [cashTxData, start, end]);

  // Báo cáo tồn kho
  const inventoryReport = useMemo(() => {
    const currentStock = partsData.map((p: Part) => ({
      ...p,
      stock: p.stock[currentBranchId] || 0,
      price: p.retailPrice[currentBranchId] || 0,
      value:
        (p.stock[currentBranchId] || 0) * (p.retailPrice[currentBranchId] || 0),
    }));

    const totalValue = currentStock.reduce(
      (sum: number, p: any) => sum + p.value,
      0
    );
    const lowStock = currentStock.filter((p: any) => p.stock < 10);

    return {
      parts: currentStock,
      totalValue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    };
  }, [partsData, currentBranchId]);

  // Báo cáo lương
  const payrollReport = useMemo(() => {
    const filteredRecords = payrollRecords.filter((r) => {
      const recordDate = new Date(r.month);
      return recordDate >= start && recordDate <= end;
    });

    const totalSalary = filteredRecords.reduce(
      (sum, r) => sum + r.netSalary,
      0
    );
    const paidSalary = filteredRecords
      .filter((r) => r.paymentStatus === "paid")
      .reduce((sum, r) => sum + r.netSalary, 0);
    const unpaidSalary = totalSalary - paidSalary;

    return {
      records: filteredRecords,
      totalSalary,
      paidSalary,
      unpaidSalary,
      employeeCount: new Set(filteredRecords.map((r) => r.employeeId)).size,
    };
  }, [payrollRecords, start, end]);

  // Báo cáo công nợ
  const debtReport = useMemo(() => {
    // Convert unpaid work orders to debt format
    const existingWorkOrderIds = new Set(
      customerDebtsData
        .filter((d: any) => d.workOrderId)
        .map((d: any) => d.workOrderId)
    );

    const workOrderDebts = unpaidWorkOrders
      .filter((wo) => !existingWorkOrderIds.has(wo.id))
      .map((wo) => {
        const totalPaid = (wo.depositamount || 0) + (wo.additionalpayment || 0);
        const remainingAmount = Math.max(0, (wo.total || 0) - totalPaid);

        return {
          id: `WO-${wo.id}`,
          customerId: wo.customerphone || wo.id,
          customerName: wo.customername || "Khách vãng lai",
          phone: wo.customerphone || null,
          totalAmount: wo.total || 0,
          paidAmount: totalPaid,
          remainingAmount: remainingAmount,
          createdDate: wo.creationdate || wo.created_at,
          branchId: wo.branchid || currentBranchId,
          workOrderId: wo.id,
        };
      });

    // Lọc công nợ theo branch - combine DB debts + work order debts
    const allCustomerDebts = [...customerDebtsData, ...workOrderDebts];

    const branchCustomerDebts = allCustomerDebts.filter(
      (debt: any) =>
        debt.branchId === currentBranchId && debt.remainingAmount > 0
    );
    const branchSupplierDebts = supplierDebtsData.filter(
      (debt) => debt.branchId === currentBranchId && debt.remainingAmount > 0
    );

    // Tổng hợp theo khách hàng
    const customerDebtMap = new Map<
      string,
      { name: string; phone?: string; debt: number }
    >();
    branchCustomerDebts.forEach((debt) => {
      // Use phone as primary key, fallback to lowercase customerName for consistency
      const key =
        debt.phone || debt.customerName?.toLowerCase() || debt.customerName;
      if (!customerDebtMap.has(key)) {
        customerDebtMap.set(key, {
          name: debt.customerName,
          phone: debt.phone,
          debt: 0,
        });
      }
      const current = customerDebtMap.get(key)!;
      current.debt += debt.remainingAmount;
    });

    // Tổng hợp theo nhà cung cấp
    const supplierDebtMap = new Map<string, { name: string; debt: number }>();
    branchSupplierDebts.forEach((debt) => {
      const key = debt.supplierName;
      if (!supplierDebtMap.has(key)) {
        supplierDebtMap.set(key, {
          name: debt.supplierName,
          debt: 0,
        });
      }
      const current = supplierDebtMap.get(key)!;
      current.debt += debt.remainingAmount;
    });

    const customerDebts = Array.from(customerDebtMap.values()).sort(
      (a, b) => b.debt - a.debt
    );
    const supplierDebts = Array.from(supplierDebtMap.values()).sort(
      (a, b) => b.debt - a.debt
    );

    const totalCustomerDebt = customerDebts.reduce((sum, c) => sum + c.debt, 0);
    const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + s.debt, 0);

    return {
      customerDebts,
      supplierDebts,
      totalCustomerDebt,
      totalSupplierDebt,
      netDebt: totalCustomerDebt - totalSupplierDebt,
    };
  }, [customerDebtsData, supplierDebtsData, currentBranchId, unpaidWorkOrders]);

  const exportToExcel = () => {
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    try {
      switch (activeTab) {
        case "revenue":
          exportRevenueReport(revenueReport.sales, startStr, endStr);
          break;
        case "cashflow":
          exportCashflowReport(cashflowReport.transactions, startStr, endStr);
          break;
        case "inventory":
          exportInventoryReport(partsData, currentBranchId, startStr, endStr);
          break;
        case "payroll":
          const startMonth = start.toISOString().slice(0, 7);
          const endMonth = end.toISOString().slice(0, 7);
          exportPayrollReport(payrollReport.records, startMonth, endMonth);
          break;
        case "debt":
          exportDebtReport(
            customers,
            suppliers,
            revenueReport.sales,
            startStr,
            endStr
          );
          break;
      }
      showToast.success("Xuất Excel thành công! File đã được tải xuống.");
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất Excel. Vui lòng thử lại.");
    }
  };

  const printReport = () => {
    window.print();
  };

  return (
    <div className="space-y-3">
      {/* Mobile View - New Component */}
      <ReportsManagerMobile
        revenueReport={revenueReport}
        cashflowReport={cashflowReport}
        inventoryReport={inventoryReport}
        payrollReport={payrollReport}
        debtReport={debtReport}
        dateRange={dateRange}
        setDateRange={setDateRange}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportExcel={exportToExcel}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onDateClick={setSelectedDate}
        cashTotals={cashTotals}
      />

      {/* Desktop Controls - Hidden on Mobile */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        {/* Report Tabs */}
        {REPORT_TAB_CONFIGS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              type="button"
              aria-pressed={isActive}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all border text-sm ${isActive ? tab.activeClass : tab.inactiveClass
                }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`w-2 h-2 rounded-full ${isActive ? "bg-white/90" : tab.dotClass
                    }`}
                ></span>
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Divider */}
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

        {/* Date Range Selector */}
        {(["today", "week", "month", "quarter", "year", "custom"] as const).map(
          (range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${dateRange === range
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
            >
              {range === "today"
                ? "Hôm nay"
                : range === "week"
                  ? "7 ngày"
                  : range === "month"
                    ? "Tháng"
                    : range === "quarter"
                      ? "Quý"
                      : range === "year"
                        ? "Năm"
                        : "Tùy chỉnh"}
            </button>
          )
        )}

        {dateRange === "month" && (
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedMonth === month
                  ? "bg-blue-600 text-white shadow-md scale-105"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:scale-105"
                  }`}
              >
                T{month}
              </button>
            ))}
          </div>
        )}

        {dateRange === "custom" && (
          <>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            />
            <span className="text-slate-500 dark:text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
            />
          </>
        )}

        {/* Export Excel Button */}
        <div className="ml-auto flex gap-2">
          <button
            onClick={exportToExcel}
            className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-1.5 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
          </button>

          {/* Advanced Reports Dropdown */}
          {activeTab === "revenue" && (
            <div className="relative group">
              <button className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-4 h-4" /> Báo cáo nâng cao
              </button>

              {/* Dropdown menu */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <button
                  onClick={() => {
                    const startStr = start.toISOString().split("T")[0];
                    const endStr = end.toISOString().split("T")[0];
                    exportTopProductsReport(
                      revenueReport.sales,
                      startStr,
                      endStr,
                      20
                    );
                    showToast.success("Xuất Top sản phẩm thành công!");
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 rounded-t-lg"
                >
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span>Top sản phẩm bán chạy</span>
                </button>

                <button
                  onClick={() => {
                    const startStr = start.toISOString().split("T")[0];
                    const endStr = end.toISOString().split("T")[0];
                    exportProductProfitReport(
                      revenueReport.sales,
                      startStr,
                      endStr
                    );
                    showToast.success("Xuất lợi nhuận sản phẩm thành công!");
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 rounded-b-lg"
                >
                  <BadgePercent className="w-4 h-4 text-green-600" />
                  <span>Lợi nhuận theo sản phẩm</span>
                </button>
              </div>
            </div>
          )}

          {/* Inventory Advanced Report */}
          {activeTab === "inventory" && (
            <button
              onClick={() => {
                const startStr = start.toISOString().split("T")[0];
                const endStr = end.toISOString().split("T")[0];
                exportDetailedInventoryReport(
                  partsData,
                  currentBranchId,
                  startStr,
                  endStr
                );
                showToast.success("Xuất báo cáo tồn kho chi tiết thành công!");
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
            >
              <Boxes className="w-4 h-4" /> Tồn kho chi tiết
            </button>
          )}
        </div>
      </div>

      {/* Report Content - Desktop Only */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        {activeTab === "revenue" && (
          <div className="space-y-4">
            {salesLoading && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Đang tải doanh thu...
              </div>
            )}
            {/* Thống kê cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 mb-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Tổng doanh thu
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(combinedRevenue).replace("₫", "")}
                </div>
                <div className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5">
                  đ (Bán hàng: {formatCurrency(revenueReport.totalRevenue)} +
                  Phiếu thu: {formatCurrency(cashTotals.totalIncome)})
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 mb-1.5">
                  <Wallet className="w-3.5 h-3.5" /> Tổng chi phí
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(
                    revenueReport.totalCost + cashTotals.totalExpense
                  ).replace("₫", "")}
                </div>
                <div className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5">
                  đ (Giá vốn: {formatCurrency(revenueReport.totalCost)} + Phiếu
                  chi: {formatCurrency(cashTotals.totalExpense)})
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 mb-1.5">
                  <TrendingUp className="w-3.5 h-3.5" /> Lợi nhuận thuần
                </div>
                <div
                  className={`text-2xl font-bold ${netProfit >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                    }`}
                >
                  {formatCurrency(netProfit).replace("₫", "")}
                </div>
                <div className="text-[10px] text-green-600/70 dark:text-green-400/70 mt-0.5">
                  đ (Lợi nhuận gộp: {formatCurrency(revenueReport.totalProfit)}{" "}
                  - Phiếu chi: {formatCurrency(cashTotals.totalExpense)})
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400 mb-1.5">
                  <BadgePercent className="w-3.5 h-3.5" /> Tỷ suất lợi nhuận
                  thuần
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {combinedRevenue > 0
                    ? ((netProfit / combinedRevenue) * 100).toFixed(1)
                    : 0}
                </div>
                <div className="text-[10px] text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                  % (Lợi nhuận thuần / Doanh thu tổng)
                </div>
              </div>
            </div>

            {/* Bảng chi tiết theo ngày - Giống Excel */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Chi tiết đơn hàng theo ngày (
                  {revenueReport.dailyReport.length} ngày)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-2 py-2 text-center text-[10px] font-bold uppercase">
                        #
                      </th>
                      <th
                        className="px-2 py-2 text-left text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-700 transition-colors select-none"
                        onClick={() => handleSort("date")}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Ngày</span>
                          {sortColumn === "date" && (
                            <span className="text-yellow-300">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-2 py-2 text-right text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-700 transition-colors select-none"
                        onClick={() => handleSort("totalCost")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>
                            Vốn NK
                            <br />
                            (1)
                          </span>
                          {sortColumn === "totalCost" && (
                            <span className="text-yellow-300">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-2 py-2 text-right text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-700 transition-colors select-none"
                        onClick={() => handleSort("totalRevenue")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>
                            Tiền hàng
                            <br />
                            (2)
                          </span>
                          {sortColumn === "totalRevenue" && (
                            <span className="text-yellow-300">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Vốn SC
                        <br />
                        (3)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Công SC
                        <br />
                        (4)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Doanh thu
                        <br />
                        (5=2)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Lợi nhuận
                        <br />
                        (6=2-1)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Thu khác
                        <br />
                        (7)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase">
                        Chi khác
                        <br />
                        (8)
                      </th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase bg-green-700">
                        LN ròng
                        <br />
                        (9=(6+7)-8)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {sortedDailyReport.map((day, index) => {
                      // Tính toán từ dữ liệu thực
                      const vonNhapKho = day.partsCost || 0; // Giá vốn phụ tùng
                      const tienHang = day.totalRevenue; // Doanh thu từ bán hàng + sửa chữa
                      const vonSuaChua = day.servicesCost || 0; // Giá vốn dịch vụ gia công
                      const congSuaChua = 0; // Công thợ (nếu cần tách riêng trong tương lai)
                      const doanhThu = tienHang;
                      const loiNhuan = day.totalProfit; // Doanh thu - Giá vốn

                      // Tính phiếu thu/chi theo ngày từ cashTxData (loại trừ thu "Dịch vụ")
                      const dayDateStr = day.date; // Format: YYYY-MM-DD
                      const thuKhac = cashTxData
                        .filter(
                          (t) =>
                            t.type === "income" &&
                            !isExcludedIncomeCategory(t.category) &&
                            t.date.slice(0, 10) === dayDateStr
                        )
                        .reduce((sum, t) => sum + t.amount, 0);
                      // Chi khác: loại trừ chi nhập kho (đã tính trong giá vốn)
                      // CHỈ TÍNH expense với amount DƯƠNG (chi thực tế)
                      const chiKhac = cashTxData
                        .filter(
                          (t) =>
                            t.type === "expense" &&
                            t.amount > 0 && // CHỈ LẤY SỐ DƯƠNG
                            !isExcludedExpenseCategory(t.category) &&
                            t.date.slice(0, 10) === dayDateStr
                        )
                        .reduce((sum, t) => sum + t.amount, 0);
                      const loiNhuanRong = loiNhuan + thuKhac - chiKhac;

                      return (
                        <tr
                          key={day.date}
                          className="hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group"
                          onClick={() => setSelectedDate(day.date)}
                          title="Nhấn để xem chi tiết"
                        >
                          <td className="px-2 py-2 text-center text-xs font-medium text-slate-900 dark:text-white">
                            {index + 1}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">
                            {new Date(day.date).toLocaleDateString("vi-VN")}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${vonNhapKho === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(vonNhapKho)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs font-semibold ${tienHang === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`}>
                            {formatCurrency(tienHang)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${vonSuaChua === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(vonSuaChua)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${congSuaChua === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(congSuaChua)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs font-bold ${doanhThu === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`}>
                            {formatCurrency(doanhThu)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs font-bold ${loiNhuan === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-orange-600 dark:text-orange-400'}`}>
                            {formatCurrency(loiNhuan)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${thuKhac === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                            {formatCurrency(thuKhac)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs ${chiKhac === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(chiKhac)}
                          </td>
                          <td className={`px-2 py-2 text-right text-xs font-black ${loiNhuanRong === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-green-700 dark:text-green-400'} bg-green-50 dark:bg-green-900/20 group-hover:bg-green-100 dark:group-hover:bg-green-900/30`}>
                            {formatCurrency(loiNhuanRong)}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Tổng hàng */}
                    {revenueReport.dailyReport.length > 0 && (
                      <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t-2 border-blue-600">
                        <td
                          colSpan={2}
                          className="px-2 py-2 text-left text-xs font-black text-slate-900 dark:text-white"
                        >
                          Tổng:
                        </td>
                        {/* Vốn NK (1) */}
                        <td className={`px-2 py-2 text-right text-xs ${revenueReport.totalCost === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                          {formatCurrency(revenueReport.totalCost)}
                        </td>
                        {/* Tiền hàng (2) */}
                        <td className={`px-2 py-2 text-right text-xs font-black ${revenueReport.totalRevenue === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`}>
                          {formatCurrency(revenueReport.totalRevenue)}
                        </td>
                        {/* Vốn SC (3) - Tổng giá vốn dịch vụ gia công */}
                        <td className={`px-2 py-2 text-right text-xs ${revenueReport.dailyReport.reduce((sum, d) => sum + d.servicesCost, 0) === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                          {formatCurrency(revenueReport.dailyReport.reduce((sum, d) => sum + d.servicesCost, 0))}
                        </td>
                        {/* Công SC (4) = 0 - hiện tại chưa có dữ liệu công SC riêng */}
                        <td className="px-2 py-2 text-right text-xs text-slate-300 dark:text-slate-600">
                          {formatCurrency(0)}
                        </td>
                        {/* Doanh thu (5) = Tiền hàng */}
                        <td className={`px-2 py-2 text-right text-xs font-black ${revenueReport.totalRevenue === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`}>
                          {formatCurrency(revenueReport.totalRevenue)}
                        </td>
                        {/* Lợi nhuận (6) */}
                        <td className={`px-2 py-2 text-right text-xs font-black ${revenueReport.totalProfit === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-orange-600 dark:text-orange-400'}`}>
                          {formatCurrency(revenueReport.totalProfit)}
                        </td>
                        {/* Thu khác (7) */}
                        <td className={`px-2 py-2 text-right text-xs ${cashTotals.totalIncome === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>
                          {formatCurrency(cashTotals.totalIncome)}
                        </td>
                        {/* Chi khác (8) */}
                        <td className={`px-2 py-2 text-right text-xs ${cashTotals.totalExpense === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(cashTotals.totalExpense)}
                        </td>
                        {/* LN ròng (9) */}
                        <td
                          className={`px-2 py-2 text-right text-xs font-black ${netProfit === 0
                            ? 'text-slate-300 dark:text-slate-600'
                            : netProfit > 0
                              ? "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
                              : "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
                            }`}
                        >
                          {formatCurrency(netProfit)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bảng chi tiết đơn hàng - Ẩn vì không cần thiết */}
            {false && (
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Chi tiết tất cả đơn hàng ({revenueReport.orderCount} đơn)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Ngày
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Khách hàng
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Tổng tiền
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {revenueReport.sales.map((sale) => (
                        <tr
                          key={sale.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-900 dark:text-white">
                            {formatDate(sale.date)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs font-medium text-slate-900 dark:text-white">
                            {sale.customer.name}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs text-right font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${(sale as any).paymentStatus === "paid"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                }`}
                            >
                              {(sale as any).paymentStatus === "paid"
                                ? "Đã thanh toán"
                                : "Chưa thanh toán"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "cashflow" && (
          <div className="space-y-4">
            {cashTxLoading && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Đang tải sổ quỹ...
              </div>
            )}
            {/* Thống kê cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Tổng thu
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(cashflowReport.totalIncome).replace("₫", "")}
                </div>
                <div className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                  đ
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1.5 inline-flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-3.5 h-3.5"
                  >
                    <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                    <circle cx="12" cy="12" r="2" />
                    <path d="M6 12h.01M18 12h.01" />
                  </svg>
                  Tổng chi
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(cashflowReport.totalExpense).replace("₫", "")}
                </div>
                <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                  đ
                </div>
              </div>

              <div
                className={`bg-gradient-to-br rounded-lg p-4 border ${cashflowReport.netCashFlow >= 0
                  ? "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800"
                  : "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800"
                  }`}
              >
                <div
                  className={`text-sm font-medium mb-2 ${cashflowReport.netCashFlow >= 0
                    ? "text-blue-700 dark:text-blue-400"
                    : "text-orange-700 dark:text-orange-400"
                    }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> Dòng tiền ròng
                  </span>
                </div>
                <div
                  className={`text-3xl font-bold ${cashflowReport.netCashFlow >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                    }`}
                >
                  {formatCurrency(cashflowReport.netCashFlow).replace("₫", "")}
                </div>
                <div
                  className={`text-xs mt-1 ${cashflowReport.netCashFlow >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                    }`}
                >
                  đ
                </div>
              </div>
            </div>

            {/* Thu chi theo danh mục */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Thu chi theo danh mục
              </h3>
              <div className="space-y-3">
                {Object.entries(cashflowReport.byCategory).map(
                  ([category, amounts]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg hover:shadow-md transition-shadow"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {translateCategory(category)}
                      </span>
                      <div className="flex gap-6">
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Thu
                          </div>
                          <div className="text-green-600 dark:text-green-400 font-bold">
                            {formatCurrency(amounts.income)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Chi
                          </div>
                          <div className="text-red-600 dark:text-red-400 font-bold">
                            {formatCurrency(amounts.expense)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-6">
            {partsLoading && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Đang tải tồn kho...
              </div>
            )}
            {/* Thống kê cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="w-4 h-4" /> Tổng giá trị tồn kho
                  </span>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(inventoryReport.totalValue).replace("₫", "")}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  đ
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-4 h-4" /> Tổng sản phẩm
                  </span>
                </div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {inventoryReport.parts.length}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  sản phẩm
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4 text-amber-500"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v4m0 4h.01"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                      />
                    </svg>
                    Sản phẩm sắp hết
                  </span>
                </div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {inventoryReport.lowStockCount}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  sản phẩm
                </div>
              </div>
            </div>

            {inventoryReport.lowStockCount > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  <span className="inline-flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4 text-amber-500"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v4m0 4h.01"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                      />
                    </svg>
                    Cảnh báo hàng sắp hết
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                          Sản phẩm
                        </th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                          Tồn kho
                        </th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                          Đơn giá
                        </th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                          Giá trị
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {inventoryReport.lowStockItems.map((part) => (
                        <tr key={part.id}>
                          <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                            {part.name}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-red-600 dark:text-red-400 font-medium">
                            {part.stock}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900 dark:text-white">
                            {formatCurrency(part.price)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-slate-900 dark:text-white">
                            {formatCurrency(part.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "payroll" && (
          <div className="space-y-6">
            {/* Thống kê cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> Tổng lương
                  </span>
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(payrollReport.totalSalary).replace("₫", "")}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  đ
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-4 h-4" /> Đã thanh toán
                  </span>
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(payrollReport.paidSalary).replace("₫", "")}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  đ
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  ⏳ Chưa thanh toán
                </div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(payrollReport.unpaidSalary).replace("₫", "")}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  đ
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="w-4 h-4" /> Số nhân viên
                  </span>
                </div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {payrollReport.employeeCount}
                </div>
                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  nhân viên
                </div>
              </div>
            </div>

            {/* Bảng chi tiết lương */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Chi tiết lương
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Tháng
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Nhân viên
                      </th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Lương thực nhận
                      </th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {payrollReport.records.map((record) => {
                      const employee = employees.find(
                        (e) => e.id === record.employeeId
                      );
                      return (
                        <tr key={record.id}>
                          <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                            {record.month}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-900 dark:text-white">
                            {employee?.name || "N/A"}
                          </td>
                          <td className="px-4 py-2 text-sm text-right font-medium text-slate-900 dark:text-white">
                            {formatCurrency(record.netSalary)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${record.paymentStatus === "paid"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                }`}
                            >
                              {record.paymentStatus === "paid"
                                ? "Đã trả"
                                : "Chưa trả"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "debt" && (
          <div className="space-y-6">
            {/* Thống kê tổng quan - 3 cards ngang */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  Nợ khách hàng
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(debtReport.totalCustomerDebt)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {debtReport.customerDebts.length} khách hàng
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  Nợ nhà cung cấp
                </div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(debtReport.totalSupplierDebt)}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {debtReport.supplierDebts.length} nhà cung cấp
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
                  Công nợ ròng
                </div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(debtReport.netDebt)}
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Khách nợ - Nợ NCC
                </div>
              </div>
            </div>

            {/* Hai cột danh sách công nợ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Công nợ khách hàng */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                  Công nợ khách hàng
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {debtReport.customerDebts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">✓</div>
                      <p className="text-slate-500 dark:text-slate-400">
                        Không có công nợ
                      </p>
                    </div>
                  ) : (
                    debtReport.customerDebts.map((customer, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">
                          {customer.name}
                        </span>
                        <span className="text-green-600 dark:text-green-400 font-bold">
                          {formatCurrency(customer.debt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Công nợ nhà cung cấp */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="text-red-600 dark:text-red-400">🏢</span>
                  Công nợ nhà cung cấp
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {debtReport.supplierDebts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-4xl mb-3">✓</div>
                      <p className="text-slate-500 dark:text-slate-400">
                        Không có công nợ
                      </p>
                    </div>
                  ) : (
                    debtReport.supplierDebts.map((supplier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <span className="font-medium text-slate-900 dark:text-white">
                          {supplier.name}
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-bold">
                          {formatCurrency(supplier.debt)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tax" && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto mb-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Xuất báo cáo thuế
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Xuất file XML theo định dạng chuẩn Tổng cục Thuế để nhập vào
                phần mềm kê khai thuế (HTKK)
              </p>
              <a
                href="#/tax-report"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                <FileText className="w-5 h-5" />
                Mở trang xuất báo cáo thuế
              </a>
              <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                <p>💡 Hỗ trợ: Tờ khai VAT (01/GTGT) và Báo cáo doanh thu</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Daily Detail Modal */}
      {selectedDate && (
        <DailyDetailModal
          isOpen={!!selectedDate}
          onClose={() => setSelectedDate(null)}
          date={selectedDate}
          sales={
            revenueReport.dailyReport.find((d) => d.date === selectedDate)
              ?.sales || []
          }
          workOrders={
            revenueReport.dailyReport.find((d) => d.date === selectedDate)
              ?.workOrders || []
          }
          cashTransactions={cashTxData.filter(
            (t) => t.date.slice(0, 10) === selectedDate
          )}
        />
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: string;
  color: "blue" | "green" | "red" | "purple";
}> = ({ label, value, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green:
      "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className={`rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="text-sm font-medium opacity-75 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
};

export default ReportsManager;
