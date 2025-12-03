import React, { useMemo, useState, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Landmark,
  BarChart3,
  Package,
  Trash2,
  Trophy,
  Users,
  BriefcaseBusiness,
  Boxes,
  AlertTriangle,
  Wrench,
  ShoppingCart,
  FileText,
  HandCoins,
  UserCog,
  Settings,
  Bell,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  PackagePlus,
  PackageSearch,
  History,
  ArrowRight,
  List,
  Search,
  Receipt,
  TrendingDown,
  LineChart as LineChartIcon,
  Car,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import {
  getVehiclesNeedingMaintenance,
  formatKm,
  type VehicleMaintenanceStatus,
} from "../../utils/maintenanceReminder";

import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import {
  useCustomers,
  useWorkOrders,
} from "../../hooks/useSupabase";
import { useEmployeesRepo } from "../../hooks/useEmployeesRepository";
import { useLoansRepo } from "../../hooks/useLoansRepository";
import { formatCurrency } from "../../utils/format";
import { loadDemoData, clearDemoData } from "../../utils/demoData";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Stat Card Component
type CardColorKey = "blue" | "emerald" | "amber" | "violet";

const CARD_COLORS: Record<
  CardColorKey,
  { card: string; icon: string; accent: string }
> = {
  blue: {
    card: "bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/40",
    icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },
  emerald: {
    card: "bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    card: "bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },
  violet: {
    card: "bg-white dark:bg-slate-800 border border-violet-100 dark:border-violet-900/40",
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    accent: "text-violet-600 dark:text-violet-400",
  },
};

const StatCard: React.FC<{
  title: string;
  value: string;
  subtitle: string;
  colorKey: CardColorKey;
  icon: React.ReactNode;
}> = ({ title, value, subtitle, colorKey, icon }) => {
  const c = CARD_COLORS[colorKey];
  return (
    <div
      className={`${c.card} rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-0.5">
            {title}
          </p>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {value}
          </h3>
        </div>
        <div
          className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-xs ${c.accent}`}>{subtitle}</p>
    </div>
  );
};

// StatusItem Component
const StatusItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  color: "blue" | "green" | "amber" | "slate" | "red";
}> = ({ icon, label, count, color }) => {
  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    amber: "text-amber-600 dark:text-amber-400",
    slate: "text-slate-600 dark:text-slate-400",
    red: "text-red-600 dark:text-red-400",
  };

  return (
    <Link
      to="/service"
      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition group"
    >
      <div className="flex items-center gap-3">
        <div className={colorClasses[color]}>{icon}</div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {count}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition" />
      </div>
    </Link>
  );
};

// QuickActionCard Component với style tối giản cho mobile
const QUICK_ACTION_COLORS: Record<string, { text: string; bg: string }> = {
  purple: {
    text: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/20",
  },
  slate: {
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-800",
  },
};

const QuickActionCard: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  color:
    | "purple"
    | "orange"
    | "emerald"
    | "cyan"
    | "blue"
    | "amber"
    | "rose"
    | "violet"
    | "slate";
  labelClassName?: string;
}> = ({ to, icon, label, color, labelClassName }) => {
  const colors = QUICK_ACTION_COLORS[color] || QUICK_ACTION_COLORS.purple;

  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 group"
    >
      <div
        className={`w-12 h-12 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-200`}
      >
        {icon}
      </div>
      <span
        className={`text-[11px] font-medium text-center leading-tight text-slate-700 dark:text-slate-300 ${
          labelClassName || ""
        }`}
      >
        {label}
      </span>
    </Link>
  );
};

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  // --- Hook Imports ---
  const { data: sales = [], isLoading: salesLoading } = useSalesRepo();
  const { data: parts = [], isLoading: partsLoading } = usePartsRepo();
  const { data: cashTransactions = [], isLoading: cashTxLoading } =
    useCashTxRepo();
  const { data: customers = [], isLoading: customersLoading } = useCustomers();
  const { data: employees = [], isLoading: employeesLoading } =
    useEmployeesRepo();
  const { data: loans = [], isLoading: loansLoading } = useLoansRepo();
  const { data: workOrders = [], isLoading: workOrdersLoading } =
    useWorkOrders();
  const { currentBranchId, paymentSources } = useAppContext(); // Get paymentSources from context for consistency with CashBook

  const isLoading =
    salesLoading ||
    partsLoading ||
    cashTxLoading ||
    customersLoading ||
    employeesLoading ||
    loansLoading ||
    workOrdersLoading;

  const [showDemoButton, setShowDemoButton] = useState(false);
  const [reportFilter, setReportFilter] = useState<
    "today" | "week" | "month" | "year"
  >("month");
  const [showBalance, setShowBalance] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Build parts cost lookup map
  const partsCostMap = useMemo(() => {
    const map = new Map<string, number>();
    parts.forEach((part) => {
      const costPrice = part.costPrice?.[currentBranchId] || 0;
      map.set(part.id, costPrice);
      if (part.sku) map.set(part.sku, costPrice);
    });
    return map;
  }, [parts, currentBranchId]);

  // Helper to get cost (memoized)
  const getPartCost = useCallback(
    (partId: string, sku: string, fallback: number) => {
      return partsCostMap.get(partId) || partsCostMap.get(sku) || fallback || 0;
    },
    [partsCostMap]
  );

  // Calculate inventory stats from parts data directly
  const totalInvQty = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock?.[currentBranchId] || 0;
      return sum + stock;
    }, 0);
  }, [parts, currentBranchId]);

  const totalInvValue = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock?.[currentBranchId] || 0;
      const price = part.retailPrice?.[currentBranchId] || 0;
      return sum + stock * price;
    }, 0);
  }, [parts, currentBranchId]);

  // Vehicles needing maintenance
  const vehiclesNeedingMaintenance = useMemo(() => {
    return getVehiclesNeedingMaintenance(customers);
  }, [customers]);

  const maintenanceStats = useMemo(() => {
    const overdue = vehiclesNeedingMaintenance.filter(
      (v) => v.hasOverdue
    ).length;
    const dueSoon = vehiclesNeedingMaintenance.filter(
      (v) => v.hasDueSoon && !v.hasOverdue
    ).length;
    return { overdue, dueSoon, total: vehiclesNeedingMaintenance.length };
  }, [vehiclesNeedingMaintenance]);

  const handleLoadDemo = () => {
    loadDemoData();
    window.location.reload();
  };

  const handleClearDemo = () => {
    if (confirm("Bạn có chắc muốn xóa toàn bộ dữ liệu demo không?")) {
      clearDemoData();
      window.location.reload();
    }
  };

  // Các category phiếu thu đã được tính trong doanh thu (Sales/Work Orders)
  const excludedIncomeCategories = [
    "service",
    "dịch vụ",
    "sale_income", // Thu từ bán hàng
    "bán hàng",
    "service_income", // Thu từ phiếu sửa chữa
    "service_deposit", // Đặt cọc dịch vụ
  ];

  // Helper function để check exclude với case-insensitive
  const isExcludedIncomeCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedIncomeCategories.some(
      (exc) => exc.toLowerCase() === lowerCat
    );
  };

  // Thống kê hôm nay (bao gồm cả Sales và Work Orders đã thanh toán)
  const todayStats = useMemo(() => {
    // Sales revenue
    const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
    const salesRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const salesProfit = todaySales.reduce((sum, s) => {
      const cost = s.items.reduce((c, it) => {
        const partCost = getPartCost(
          it.partId,
          it.sku,
          (it as any).costPrice || 0
        );
        return c + partCost * it.quantity;
      }, 0);
      return sum + (s.total - cost);
    }, 0);

    // Work Orders revenue (chỉ tính những đơn đã thanh toán - paid hoặc partial)
    const todayWorkOrders = workOrders.filter((wo: any) => {
      const woDate =
        wo.creationDate?.slice(0, 10) || wo.creationdate?.slice(0, 10);
      const isPaid =
        wo.paymentStatus === "paid" ||
        wo.paymentstatus === "paid" ||
        wo.paymentStatus === "partial" ||
        wo.paymentstatus === "partial";
      return woDate === today && isPaid;
    });
    const woRevenue = todayWorkOrders.reduce(
      (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
      0
    );
    const woProfit = todayWorkOrders.reduce((sum, wo: any) => {
      const partsCost = (wo.partsUsed || wo.partsused || []).reduce(
        (c: number, p: any) => {
          const partId = p.partId || p.partid;
          const sku = p.sku;
          const cost = getPartCost(
            partId,
            sku,
            p.costPrice || p.costprice || 0
          );
          return c + cost * (p.quantity || 0);
        },
        0
      );
      return (
        sum + ((wo.totalPaid || wo.totalpaid || wo.total || 0) - partsCost)
      );
    }, 0);

    // Cash transactions: thu/chi trong ngày (loại trừ thu dịch vụ/bán hàng đã tính trong Sales/WO)
    const todayIncome = cashTransactions
      .filter(
        (t) =>
          t.type === "income" &&
          !isExcludedIncomeCategory(t.category) &&
          t.date.slice(0, 10) === today
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const todayExpense = cashTransactions
      .filter((t) => t.type === "expense" && t.date.slice(0, 10) === today)
      .reduce((sum, t) => sum + t.amount, 0);

    // Doanh thu = Sales + Work Orders + Phiếu thu (không tính thu dịch vụ)
    const revenue = salesRevenue + woRevenue + todayIncome;
    // Lợi nhuận thuần = (Doanh thu bán hàng - Giá vốn) - Phiếu chi
    const grossProfit = salesProfit + woProfit; // Lợi nhuận gộp
    const profit = grossProfit - todayExpense; // Lợi nhuận thuần

    // Count unique customers
    const salesCustomers = todaySales.map(
      (s) => s.customer.phone || s.customer.name
    );
    const woCustomers = todayWorkOrders.map(
      (wo: any) =>
        wo.customerPhone ||
        wo.customerphone ||
        wo.customerName ||
        wo.customername
    );
    const customerCount = new Set([...salesCustomers, ...woCustomers]).size;

    return {
      revenue,
      profit,
      grossProfit,
      income: todayIncome,
      expense: todayExpense,
      customerCount,
      orderCount: todaySales.length + todayWorkOrders.length,
      salesCount: todaySales.length,
      workOrdersCount: todayWorkOrders.length,
    };
  }, [sales, workOrders, cashTransactions, today, getPartCost]);

  // Thống kê theo filter (bao gồm cả Sales và Work Orders)
  const filteredStats = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now; // Ngày hiện tại

    switch (reportFilter) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - diff
        );
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Sử dụng local date format YYYY-MM-DD thay vì ISO string (tránh lỗi timezone)
    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Chuyển ISO string hoặc date string sang local date string YYYY-MM-DD
    const toLocalDateStr = (
      dateStr: string | undefined | null
    ): string | null => {
      if (!dateStr) return null;
      try {
        // Parse date string và chuyển sang local date
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return formatLocalDate(d);
      } catch {
        return null;
      }
    };

    const startDateStr = formatLocalDate(startDate);
    const endDateStr = formatLocalDate(endDate);

    // Sales - lọc theo ngày giao dịch trong khoảng thời gian
    const filteredSales = sales.filter((s) => {
      const saleDate = toLocalDateStr(s.date);
      return saleDate && saleDate >= startDateStr && saleDate <= endDateStr;
    });
    const salesRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const salesProfit = filteredSales.reduce((sum, s) => {
      const cost = s.items.reduce((c, it) => {
        const partCost = getPartCost(
          it.partId,
          it.sku,
          (it as any).costPrice || 0
        );
        return c + partCost * it.quantity;
      }, 0);
      return sum + (s.total - cost);
    }, 0);

    // Work Orders (đã thanh toán) - dùng paymentDate nếu có, fallback về creationDate
    const filteredWorkOrders = workOrders.filter((wo: any) => {
      // Ưu tiên dùng ngày thanh toán, nếu không có thì dùng ngày tạo
      const paymentDateRaw = wo.paymentDate || wo.paymentdate;
      const creationDateRaw = wo.creationDate || wo.creationdate;
      const woDate =
        toLocalDateStr(paymentDateRaw) || toLocalDateStr(creationDateRaw);

      const isPaid =
        wo.paymentStatus === "paid" ||
        wo.paymentstatus === "paid" ||
        wo.paymentStatus === "partial" ||
        wo.paymentstatus === "partial";
      return woDate && woDate >= startDateStr && woDate <= endDateStr && isPaid;
    });
    const woRevenue = filteredWorkOrders.reduce(
      (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
      0
    );
    const woProfit = filteredWorkOrders.reduce((sum, wo: any) => {
      const partsCost = (wo.partsUsed || wo.partsused || []).reduce(
        (c: number, p: any) => {
          const partId = p.partId || p.partid;
          const sku = p.sku;
          const cost = getPartCost(
            partId,
            sku,
            p.costPrice || p.costprice || 0
          );
          return c + cost * (p.quantity || 0);
        },
        0
      );
      return (
        sum + ((wo.totalPaid || wo.totalpaid || wo.total || 0) - partsCost)
      );
    }, 0);

    // Cash transactions: thu/chi trong khoảng thời gian (loại trừ thu dịch vụ/bán hàng)
    const filteredIncome = cashTransactions
      .filter((t) => {
        const txDate = toLocalDateStr(t.date);
        return (
          t.type === "income" &&
          !isExcludedIncomeCategory(t.category) &&
          txDate &&
          txDate >= startDateStr &&
          txDate <= endDateStr
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);
    const filteredExpense = cashTransactions
      .filter((t) => {
        const txDate = toLocalDateStr(t.date);
        return (
          t.type === "expense" &&
          txDate &&
          txDate >= startDateStr &&
          txDate <= endDateStr
        );
      })
      .reduce((sum, t) => sum + t.amount, 0);

    // Doanh thu = Sales + Work Orders + Phiếu thu (không tính thu dịch vụ)
    const revenue = salesRevenue + woRevenue + filteredIncome;
    // Lợi nhuận thuần = (Doanh thu bán hàng - Giá vốn) - Phiếu chi
    const grossProfit = salesProfit + woProfit;
    const profit = grossProfit - filteredExpense;

    const salesCustomers = filteredSales.map(
      (s) => s.customer.phone || s.customer.name
    );
    const woCustomers = filteredWorkOrders.map(
      (wo: any) =>
        wo.customerPhone ||
        wo.customerphone ||
        wo.customerName ||
        wo.customername
    );
    const customerCount = new Set([...salesCustomers, ...woCustomers]).size;

    return {
      revenue,
      profit,
      grossProfit,
      income: filteredIncome,
      expense: filteredExpense,
      customerCount,
      orderCount: filteredSales.length + filteredWorkOrders.length,
    };
  }, [sales, workOrders, cashTransactions, reportFilter, getPartCost]);

  // Dữ liệu doanh thu 7 ngày gần nhất (bao gồm cả Sales và Work Orders)
  const last7DaysRevenue = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);

      // Sales revenue
      const daySales = sales.filter((s) => s.date.slice(0, 10) === dateStr);
      const salesRevenue = daySales.reduce((sum, s) => sum + s.total, 0);

      // Work Orders revenue (đã thanh toán)
      const dayWorkOrders = workOrders.filter((wo: any) => {
        const woDate =
          wo.creationDate?.slice(0, 10) || wo.creationdate?.slice(0, 10);
        const isPaid =
          wo.paymentStatus === "paid" ||
          wo.paymentstatus === "paid" ||
          wo.paymentStatus === "partial" ||
          wo.paymentstatus === "partial";
        return woDate === dateStr && isPaid;
      });
      const woRevenue = dayWorkOrders.reduce(
        (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
        0
      );

      const revenue = salesRevenue + woRevenue;

      const expense = cashTransactions
        .filter((t) => t.type === "expense" && t.date.slice(0, 10) === dateStr)
        .reduce((sum, t) => sum + t.amount, 0);

      data.push({
        date: date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        revenue,
        expense,
        profit: revenue - expense,
      });
    }
    return data;
  }, [sales, workOrders, cashTransactions]);

  // Dữ liệu thu chi
  const incomeExpenseData = useMemo(() => {
    const income = cashTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = cashTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return [
      { name: "Thu", value: income, color: "#10b981" },
      { name: "Chi", value: expense, color: "#ef4444" },
    ];
  }, [cashTransactions]);

  // Top sản phẩm bán chạy (từ cả Sales và Work Orders)
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; quantity: number }> = {};

    // From sales
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!productSales[item.partId]) {
          productSales[item.partId] = {
            name: item.partName,
            quantity: 0,
          };
        }
        productSales[item.partId].quantity += item.quantity;
      });
    });

    // From work orders
    workOrders.forEach((wo: any) => {
      const parts = wo.partsUsed || wo.partsused || [];
      parts.forEach((part: any) => {
        const partId = part.partId || part.partid;
        const partName = part.partName || part.partname;
        if (partId && partName) {
          if (!productSales[partId]) {
            productSales[partId] = {
              name: partName,
              quantity: 0,
            };
          }
          productSales[partId].quantity += part.quantity || 0;
        }
      });
    });

    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales, workOrders]);

  // Helper to check income type
  const isIncomeType = (type: string | undefined) =>
    type === "income" || type === "deposit";

  // Lấy số dư ban đầu từ paymentSources (đã lưu trong DB)
  const savedInitialCash =
    paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
    0;
  const savedInitialBank =
    paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
    0;

  // Số dư tài khoản - tính từ số dư ban đầu + biến động từ giao dịch
  const { cashBalance, bankBalance } = useMemo(() => {
    const branchTransactions = cashTransactions.filter(
      (tx) => tx.branchId === currentBranchId
    );

    // Tính biến động tiền mặt từ transactions
    const cashDelta = branchTransactions
      .filter((tx) => tx.paymentSourceId === "cash")
      .reduce((sum, tx) => {
        if (isIncomeType(tx.type)) {
          return sum + Math.abs(tx.amount);
        } else {
          return sum - Math.abs(tx.amount);
        }
      }, 0);

    // Tính biến động ngân hàng từ transactions
    const bankDelta = branchTransactions
      .filter((tx) => tx.paymentSourceId === "bank")
      .reduce((sum, tx) => {
        if (isIncomeType(tx.type)) {
          return sum + Math.abs(tx.amount);
        } else {
          return sum - Math.abs(tx.amount);
        }
      }, 0);

    // Số dư = Số dư ban đầu + Biến động
    return {
      cashBalance: savedInitialCash + cashDelta,
      bankBalance: savedInitialBank + bankDelta,
    };
  }, [cashTransactions, currentBranchId, savedInitialCash, savedInitialBank]);

  // Thống kê work orders (phiếu sửa chữa)
  const workOrderStats = useMemo(() => {
    const newOrders = (workOrders || []).filter(
      (wo) => wo.status === "Tiếp nhận"
    ).length;
    const inProgress = (workOrders || []).filter(
      (wo) => wo.status === "Đang sửa"
    ).length;
    const completed = (workOrders || []).filter(
      (wo) => wo.status === "Đã sửa xong"
    ).length;
    // Đã trả/giao xe = status "Trả máy" hoặc "Đã giao"
    const delivered = (workOrders || []).filter(
      (wo) => wo.status === "Trả máy" || wo.status === "Đã giao"
    ).length;
    // Đã hủy
    const cancelled = (workOrders || []).filter(
      (wo) => wo.status === "Đã hủy"
    ).length;

    return { newOrders, inProgress, completed, delivered, cancelled };
  }, [workOrders]);

  // Cảnh báo
  const alerts = useMemo(() => {
    const warnings: Array<{ type: string; message: string; color: string }> =
      [];

    // Hàng sắp hết
    const lowStockParts = parts.filter(
      (p) => (p.stock[currentBranchId] || 0) < 10
    );
    if (lowStockParts.length > 0) {
      warnings.push({
        type: "Tồn kho thấp",
        message: `${lowStockParts.length} sản phẩm sắp hết hàng`,
        color: "text-orange-600 dark:text-orange-400",
      });
    }

    // Khoản vay đến hạn
    const upcomingLoans = loans.filter((loan) => {
      const daysUntilDue = Math.ceil(
        (new Date(loan.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue <= 30 && daysUntilDue > 0 && loan.status === "active";
    });
    if (upcomingLoans.length > 0) {
      warnings.push({
        type: "Nợ đến hạn",
        message: `${upcomingLoans.length} khoản vay sắp đến hạn`,
        color: "text-red-600 dark:text-red-400",
      });
    }

    // Số dư thấp
    if (cashBalance + bankBalance < 10000000) {
      warnings.push({
        type: "Số dư thấp",
        message: "Số dư tài khoản dưới 10 triệu",
        color: "text-amber-600 dark:text-amber-400",
      });
    }

    return warnings;
  }, [parts, loans, cashBalance, bankBalance, currentBranchId]);

  // Top Customers Data
  const topCustomersData = useMemo(() => {
    const customerSpending: Record<
      string,
      { name: string; phone?: string; total: number }
    > = {};

    sales.forEach((sale) => {
      const key = sale.customer.phone || sale.customer.name;
      if (!customerSpending[key]) {
        customerSpending[key] = {
          name: sale.customer.name,
          phone: sale.customer.phone,
          total: 0,
        };
      }
      customerSpending[key].total += sale.total;
    });

    return Object.values(customerSpending)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [sales]);

  // Monthly Comparison Data
  const monthlyComparisonData = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 2; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().slice(0, 7);
      const monthName = monthDate.toLocaleDateString("vi-VN", {
        month: "short",
        year: "numeric",
      });

      const monthSales = sales.filter((s) => s.date.startsWith(monthStr));
      const revenue = monthSales.reduce((sum, s) => sum + s.total, 0);
      const orders = monthSales.length;

      months.push({
        month: monthName,
        revenue: revenue,
        orders: orders,
      });
    }

    return months;
  }, [sales]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header - Lời chào người dùng - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-700 dark:to-violet-800 rounded-2xl p-4 md:p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-semibold mb-1">
              Xin chào,{" "}
              {profile?.name ||
                profile?.full_name ||
                profile?.email?.split("@")[0] ||
                "Người dùng"}{" "}
              👋
            </h1>
            <p className="text-sm md:text-base text-blue-100 dark:text-violet-100">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* Mini stats trong header */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-white/30 transition-colors"
              >
                {showBalance ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <div className="text-left">
                  <p className="text-[10px] opacity-80">Tiền mặt</p>
                  <p className="text-xs font-semibold">
                    {showBalance ? formatCurrency(cashBalance) : "••••••"}
                  </p>
                </div>
              </button>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-white/30 transition-colors"
              >
                <Landmark className="w-3.5 h-3.5" />
                <div className="text-left">
                  <p className="text-[10px] opacity-80">Ngân hàng</p>
                  <p className="text-xs font-semibold">
                    {showBalance ? formatCurrency(bankBalance) : "••••••"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <Bell className="w-6 h-6 md:w-7 md:h-7 opacity-80 hover:opacity-100 cursor-pointer transition" />
        </div>
      </div>

      {/* Báo cáo - Dropdown với Doanh thu & Lợi nhuận - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
            Báo cáo
          </h2>
          <select
            value={reportFilter}
            onChange={(e) =>
              setReportFilter(
                e.target.value as "today" | "week" | "month" | "year"
              )
            }
            className="text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="month">Tháng này</option>
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="year">Năm nay</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <Link
            to="/reports"
            className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 md:p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">
              Doanh thu
            </p>
            <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(filteredStats.revenue)}
            </p>
          </Link>
          <Link
            to="/reports"
            className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 md:p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">
              Lợi nhuận
            </p>
            <p
              className={`text-lg md:text-2xl font-bold ${
                filteredStats.profit >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(filteredStats.profit)}
            </p>
          </Link>
        </div>
      </div>

      {/* Danh sách trạng thái phiếu sửa chữa - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-3">
          Trạng thái phiếu sửa chữa
        </h3>
        <div className="space-y-2">
          <StatusItem
            icon={<Package className="w-5 h-5" />}
            label="Biên nhận mới"
            count={workOrderStats.newOrders}
            color="blue"
          />
          <StatusItem
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Đã sửa xong"
            count={workOrderStats.completed}
            color="green"
          />
          <StatusItem
            icon={<Clock className="w-5 h-5" />}
            label="Đang sửa"
            count={workOrderStats.inProgress}
            color="amber"
          />
          <StatusItem
            icon={<Car className="w-5 h-5" />}
            label="Đã trả/giao xe"
            count={workOrderStats.delivered}
            color="slate"
          />
          <StatusItem
            icon={<XCircle className="w-5 h-5" />}
            label="Đã hủy"
            count={workOrderStats.cancelled}
            color="red"
          />
        </div>
      </div>

      {/* Quick Actions - Grid 4 cột với 12 tính năng - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-4">
          Truy cập nhanh
        </h3>
        <div className="grid grid-cols-4 gap-3 md:gap-4">
          {/* Nhóm Chính - Hàng 1 */}
          <QuickActionCard
            to="/sales"
            icon={<ShoppingCart className="w-6 h-6 md:w-7 md:h-7" />}
            label="Bán hàng"
            color="emerald"
          />
          <QuickActionCard
            to="/service"
            icon={<Wrench className="w-6 h-6 md:w-7 md:h-7" />}
            label="Sửa chữa"
            color="blue"
          />
          <QuickActionCard
            to="/inventory"
            icon={<Boxes className="w-6 h-6 md:w-7 md:h-7" />}
            label="Kho hàng"
            color="orange"
          />
          <QuickActionCard
            to="/customers"
            icon={<Users className="w-6 h-6 md:w-7 md:h-7" />}
            label="Khách hàng"
            color="cyan"
          />

          {/* Nhóm Tài chính - Hàng 2 */}
          <QuickActionCard
            to="/finance"
            icon={<Landmark className="w-6 h-6 md:w-7 md:h-7" />}
            label="Tài chính"
            color="violet"
          />
          <QuickActionCard
            to="/debt"
            icon={<HandCoins className="w-6 h-6 md:w-7 md:h-7" />}
            label="Công nợ"
            color="rose"
          />
          <QuickActionCard
            to="/cashbook"
            icon={<Wallet className="w-6 h-6 md:w-7 md:h-7" />}
            label="Sổ quỹ"
            color="amber"
          />
          <QuickActionCard
            to="/reports"
            icon={<FileText className="w-6 h-6 md:w-7 md:h-7" />}
            label="Báo cáo"
            color="slate"
          />

          {/* Nhóm Quản lý & Khác - Hàng 3 */}
          <QuickActionCard
            to="/employees"
            icon={<BriefcaseBusiness className="w-6 h-6 md:w-7 md:h-7" />}
            label="Nhân viên"
            color="purple"
          />
          <QuickActionCard
            to="/categories"
            icon={<List className="w-6 h-6 md:w-7 md:h-7" />}
            label="Danh mục"
            color="slate"
          />
          <QuickActionCard
            to="/lookup"
            icon={<Search className="w-6 h-6 md:w-7 md:h-7" />}
            label="Tra cứu"
            color="slate"
          />
          <QuickActionCard
            to="/settings"
            icon={<Settings className="w-6 h-6 md:w-7 md:h-7" />}
            label="Cài đặt"
            color="slate"
          />
        </div>
      </div>

      {/* Cảnh báo quan trọng - Chỉ hiện trên mobile khi có cảnh báo */}
      {alerts.length > 0 && (
        <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Cảnh báo
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
              >
                <div className="flex-shrink-0">
                  {alert.type === "Tồn kho thấp" && (
                    <Package className="w-5 h-5 text-orange-500" />
                  )}
                  {alert.type === "Nợ đến hạn" && (
                    <HandCoins className="w-5 h-5 text-red-500" />
                  )}
                  {alert.type === "Số dư thấp" && (
                    <Wallet className="w-5 h-5 text-amber-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {alert.type}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {alert.message}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tổng tồn kho - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tổng SL tồn kho
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalInvQty.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gộp tất cả chi nhánh
            </p>
          </div>
          <Link
            to="/inventory"
            className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
          >
            <Boxes className="w-6 h-6" />
          </Link>
        </div>
      </div>

      {/* Các section cũ ẩn đi - chỉ giữ demo buttons */}
      <div className="hidden">
        {/* Demo Data Buttons - Ẩn đi nếu không cần */}
        {showDemoButton && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-2">
                  🎯 Chưa có dữ liệu
                </h3>
                <p className="text-slate-600 dark:text-slate-300 mb-4">
                  Hệ thống chưa có dữ liệu. Bạn có thể tải dữ liệu mẫu để khám
                  phá các tính năng hoặc bắt đầu nhập dữ liệu thực tế.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleLoadDemo}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
                  >
                    <Package className="w-5 h-5" /> Tải dữ liệu mẫu
                  </button>
                  <button
                    onClick={() => setShowDemoButton(false)}
                    className="px-6 py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200"
                  >
                    Bỏ qua
                  </button>
                </div>
              </div>
              <div className="hidden md:block text-6xl">
                <BarChart3 className="w-16 h-16 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        )}

        {/* Nút xóa demo data */}
        {sales.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleClearDemo}
              className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Xóa tất cả dữ liệu
            </button>
          </div>
        )}
      </div>
      {/* END Hidden Section */}

      {/* Thẻ thống kê chính - Ẩn trên mobile, giữ cho desktop */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Doanh thu hôm nay"
          value={formatCurrency(todayStats.revenue)}
          subtitle={`${todayStats.orderCount} đơn hàng`}
          colorKey="blue"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="Lợi nhuận hôm nay"
          value={formatCurrency(todayStats.profit)}
          subtitle={`${todayStats.customerCount} khách hàng`}
          colorKey="emerald"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Tiền mặt"
          value={formatCurrency(cashBalance)}
          subtitle="Quỹ tiền mặt"
          colorKey="amber"
          icon={<Wallet className="w-5 h-5" />}
        />
        <StatCard
          title="Ngân hàng"
          value={formatCurrency(bankBalance)}
          subtitle="Tài khoản ngân hàng"
          colorKey="violet"
          icon={<Landmark className="w-5 h-5" />}
        />
      </div>

      {/* Inventory KPIs from server (if available) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          title="Tổng SL tồn kho"
          value={isLoading ? "..." : `${totalInvQty}`}
          subtitle="Gộp tất cả chi nhánh"
          colorKey="blue"
          icon={<Boxes className="w-5 h-5" />}
        />
        <StatCard
          title="Tổng giá trị tồn kho"
          value={isLoading ? "..." : formatCurrency(totalInvValue)}
          subtitle="Theo giá bán lẻ hiện tại"
          colorKey="violet"
          icon={<Package className="w-5 h-5" />}
        />
      </div>

      {/* Cảnh báo - Ẩn trên mobile (đã có riêng ở trên) */}
      {alerts.length > 0 && (
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Cảnh báo
          </h3>
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
              >
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {alert.type}:
                  </span>{" "}
                  <span className={alert.color}>{alert.message}</span>
                </div>
                <button className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium">
                  Xem chi tiết →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Xe cần bảo dưỡng */}
      {vehiclesNeedingMaintenance.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-orange-500" /> Xe cần bảo dưỡng
            </h3>
            <div className="flex items-center gap-2">
              {maintenanceStats.overdue > 0 && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                  {maintenanceStats.overdue} quá hạn
                </span>
              )}
              {maintenanceStats.dueSoon > 0 && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">
                  {maintenanceStats.dueSoon} sắp đến hạn
                </span>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {vehiclesNeedingMaintenance.slice(0, 10).map((item, idx) => (
              <div
                key={`${item.vehicle.id}-${idx}`}
                className={`p-3 rounded-lg border ${
                  item.hasOverdue
                    ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                    : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {item.vehicle.licensePlate}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.vehicle.model} • {item.customer?.name} •{" "}
                      {item.customer?.phone}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {item.vehicle.currentKm
                      ? formatKm(item.vehicle.currentKm)
                      : "Chưa có km"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.warnings.map((warning) => (
                    <span
                      key={warning.type}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        warning.isOverdue
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {warning.icon} {warning.name}
                      <span className="opacity-75">
                        {warning.isOverdue
                          ? `(+${formatKm(Math.abs(warning.kmUntilDue))})`
                          : `(còn ${formatKm(warning.kmUntilDue)})`}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {vehiclesNeedingMaintenance.length > 10 && (
            <div className="mt-3 text-center">
              <Link
                to="/customers"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                Xem thêm {vehiclesNeedingMaintenance.length - 10} xe khác →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Biểu đồ - Ẩn trên mobile, chỉ hiện trên desktop */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ doanh thu 7 ngày */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Doanh thu & Chi phí 7 ngày gần đây
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={last7DaysRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                name="Doanh thu"
              />
              <Line
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={2}
                name="Chi phí"
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Lợi nhuận"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Biểu đồ tròn Thu/Chi */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Tỷ lệ Thu/Chi
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={incomeExpenseData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {incomeExpenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-center gap-6"></div>
        </div>

        {/* Top sản phẩm bán chạy */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top 5 sản phẩm bán chạy
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="quantity" fill="#3b82f6" name="Số lượng bán" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers và Monthly Comparison - Ẩn trên mobile */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 10 Khách hàng VIP
          </h3>
          <div className="space-y-3">
            {topCustomersData.map((customer, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {customer.name}
                    </div>
                    {customer.phone && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {customer.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(customer.total)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Tổng chi tiêu
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Comparison */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            So sánh 3 tháng gần đây
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#3b82f6" />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                }}
                formatter={(value: any, name: string) =>
                  name === "revenue" ? formatCurrency(value) : value
                }
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill="#3b82f6"
                name="Doanh thu"
              />
              <Bar
                yAxisId="right"
                dataKey="orders"
                fill="#10b981"
                name="Số đơn"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Thống kê tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng khách hàng
            </h3>
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {customers.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {customers.filter((c) => c.segment === "VIP").length} VIP
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng nhân viên
            </h3>
            <BriefcaseBusiness className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {employees.filter((e) => e.status === "active").length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Đang làm việc
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng sản phẩm
            </h3>
            <Boxes className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {parts.reduce((sum, p) => sum + (p.stock[currentBranchId] || 0), 0)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {parts.length} loại sản phẩm
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
