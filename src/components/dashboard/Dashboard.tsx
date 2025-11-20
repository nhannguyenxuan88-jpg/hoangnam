import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";

import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import {
  useCustomers,
  usePaymentSources,
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
      className={`${c.card} rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">
            {title}
          </p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {value}
          </h3>
        </div>
        <div
          className={`w-10 h-10 rounded-lg ${c.icon} flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
      <p className={`text-sm ${c.accent}`}>{subtitle}</p>
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

// QuickActionCard Component với nhiều màu sắc
const QUICK_ACTION_COLORS: Record<string, { from: string; to: string }> = {
  purple: { from: "from-purple-600", to: "to-purple-700" },
  orange: { from: "from-orange-600", to: "to-orange-700" },
  emerald: { from: "from-emerald-600", to: "to-emerald-700" },
  cyan: { from: "from-cyan-600", to: "to-cyan-700" },
  blue: { from: "from-blue-600", to: "to-blue-700" },
  amber: { from: "from-amber-600", to: "to-amber-700" },
  rose: { from: "from-rose-600", to: "to-rose-700" },
  violet: { from: "from-violet-600", to: "to-violet-700" },
  slate: { from: "from-slate-600", to: "to-slate-700" },
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
      className={`flex flex-col items-center justify-center gap-2 p-3 md:p-4 bg-gradient-to-br ${colors.from} ${colors.to} dark:${colors.from} dark:${colors.to} rounded-xl text-white hover:shadow-lg hover:scale-105 transition-all duration-200`}
    >
      <div className="w-11 h-11 md:w-12 md:h-12 bg-white/20 rounded-full flex items-center justify-center">
        {icon}
      </div>
      <span
        className={`text-[11px] md:text-xs font-medium text-center leading-tight ${labelClassName || ""
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
  const { data: paymentSources = [], isLoading: sourcesLoading } =
    usePaymentSources();
  const { data: employees = [], isLoading: employeesLoading } =
    useEmployeesRepo();
  const { data: loans = [], isLoading: loansLoading } = useLoansRepo();
  const { data: workOrders = [], isLoading: workOrdersLoading } =
    useWorkOrders();
  const { currentBranchId } = useAppContext(); // Keep context only for branch ID

  const isLoading =
    salesLoading ||
    partsLoading ||
    cashTxLoading ||
    customersLoading ||
    sourcesLoading ||
    employeesLoading ||
    loansLoading ||
    workOrdersLoading;

  const [showDemoButton, setShowDemoButton] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  // Thống kê hôm nay
  const todayStats = useMemo(() => {
    const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
    const revenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const profit = todaySales.reduce((sum, s) => {
      const cost = s.items.reduce(
        (c, it) => c + ((it as any).costPrice || 0) * it.quantity,
        0
      );
      return sum + (s.total - cost);
    }, 0);
    const customerCount = new Set(
      todaySales.map((s) => s.customer.phone || s.customer.name)
    ).size;

    return { revenue, profit, customerCount, orderCount: todaySales.length };
  }, [sales, today]);

  // Dữ liệu doanh thu 7 ngày gần nhất
  const last7DaysRevenue = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const daySales = sales.filter((s) => s.date.slice(0, 10) === dateStr);
      const revenue = daySales.reduce((sum, s) => sum + s.total, 0);
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
  }, [sales, cashTransactions]);

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

  // Top sản phẩm bán chạy
  const topProducts = useMemo(() => {
    const productSales: Record<string, { name: string; quantity: number }> = {};

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

    return Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales]);

  // Số dư tài khoản
  const cashBalance =
    paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
    0;
  const bankBalance =
    paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
    0;

  // Thống kê work orders (phiếu sửa chữa)
  const workOrderStats = useMemo(() => {
    const newOrders = (workOrders || []).filter(
      (wo) => wo.status === "new"
    ).length;
    const inProgress = (workOrders || []).filter(
      (wo) => wo.status === "in_progress"
    ).length;
    const completed = (workOrders || []).filter(
      (wo) => wo.status === "completed"
    ).length;
    const cancelled = (workOrders || []).filter(
      (wo) => wo.status === "cancelled"
    ).length;
    const notRepairable = (workOrders || []).filter(
      (wo) => wo.status === "not_repairable"
    ).length;

    return { newOrders, inProgress, completed, cancelled, notRepairable };
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
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );
      const monthStr = monthDate.toISOString().slice(0, 7);
      const monthName = monthDate.toLocaleDateString("vi-VN", {
        month: "short",
        year: "numeric",
      });

      const monthSales = sales.filter((s) =>
        s.date.startsWith(monthStr)
      );
      const revenue = monthSales.reduce(
        (sum, s) => sum + s.total,
        0
      );
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
    <div className="space-y-4 md:space-y-6">
      {/* Header - Lời chào người dùng - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-700 dark:to-violet-800 rounded-2xl p-4 md:p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-semibold mb-1">
              Xin chào, @{profile?.full_name || profile?.email || "Người dùng"}{" "}
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
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <div>
                  <p className="text-xs opacity-90">Tiền mặt</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(cashBalance)}
                  </p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2">
                <Users className="w-4 h-4" />
                <div>
                  <p className="text-xs opacity-90">Quản lý</p>
                  <p className="text-sm font-semibold">
                    {employees.filter((e) => e.status === "active").length}
                  </p>
                </div>
              </div>
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
          <select className="text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option>Tháng này</option>
            <option>Hôm nay</option>
            <option>Tuần này</option>
            <option>Năm nay</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 md:p-4">
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">
              Doanh thu
            </p>
            <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(todayStats.revenue)}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 md:p-4">
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mb-1">
              Lợi nhuận
            </p>
            <p
              className={`text-lg md:text-2xl font-bold ${todayStats.profit >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
                }`}
            >
              {formatCurrency(todayStats.profit)}
            </p>
          </div>
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
            icon={<XCircle className="w-5 h-5" />}
            label="Đã hủy"
            count={workOrderStats.cancelled}
            color="slate"
          />
          <StatusItem
            icon={<Ban className="w-5 h-5" />}
            label="Không sửa được"
            count={workOrderStats.notRepairable}
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
          {/* Nhóm Kho hàng - Purple */}
          <QuickActionCard
            to="/inventory"
            icon={<Boxes className="w-7 h-7 md:w-8 md:h-8" />}
            label="Kho hàng"
            color="purple"
          />
          <QuickActionCard
            to="/categories"
            icon={<List className="w-7 h-7 md:w-8 md:h-8" />}
            label="Danh mục"
            color="purple"
          />
          <QuickActionCard
            to="/lookup"
            icon={<Search className="w-7 h-7 md:w-8 md:h-8" />}
            label="Tra cứu"
            color="purple"
          />

          {/* Nhóm Dịch vụ - Orange */}
          <QuickActionCard
            to="/service"
            icon={<Wrench className="w-7 h-7 md:w-8 md:h-8" />}
            label="Sửa chữa"
            color="orange"
          />
          <QuickActionCard
            to="/sales"
            icon={<ShoppingCart className="w-7 h-7 md:w-8 md:h-8" />}
            label="Bán hàng"
            color="emerald"
          />

          {/* Nhóm Khách hàng - Cyan */}
          <QuickActionCard
            to="/customers"
            icon={<Users className="w-7 h-7 md:w-8 md:h-8" />}
            label="Khách hàng"
            color="cyan"
          />

          {/* Nhóm Tài chính - Blue/Amber */}
          <QuickActionCard
            to="/finance"
            icon={<Landmark className="w-7 h-7 md:w-8 md:h-8" />}
            label="Tài chính"
            color="blue"
          />
          <QuickActionCard
            to="/debt"
            icon={<HandCoins className="w-7 h-7 md:w-8 md:h-8" />}
            label="Công nợ"
            color="amber"
          />
          <QuickActionCard
            to="/cashbook"
            icon={<Wallet className="w-7 h-7 md:w-8 md:h-8" />}
            label="Sổ quỹ"
            color="blue"
          />

          {/* Nhóm Báo cáo & Quản lý - Rose/Violet */}
          <QuickActionCard
            to="/reports"
            icon={<FileText className="w-7 h-7 md:w-8 md:h-8" />}
            label="Báo cáo"
            color="rose"
          />
          <QuickActionCard
            to="/analytics"
            icon={<LineChartIcon className="w-7 h-7 md:w-8 md:h-8" />}
            label="Phân tích"
            color="violet"
          />
          <QuickActionCard
            to="/settings"
            icon={<Settings className="w-7 h-7 md:w-8 md:h-8" />}
            label="Cài đặt"
            color="slate"
          />
        </div>
      </div>

      {/* Biểu đồ Biên nhận - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white">
            Biên nhận
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Sửa chữa / Bảo hành / Dụng mới</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={[
              { name: "Chưa sửa (0)", value: 0 },
              { name: "Đang sửa (0)", value: 0 },
              { name: "Sửa xong (0)", value: 0 },
            ]}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status Cards - Chưa sửa, Đang sửa, Sửa xong - Chỉ hiện trên mobile */}
      <div className="md:hidden grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Chưa sửa
            </h4>
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            0
          </p>
          <div className="mt-2 text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
            <p>Cơ giá: 0</p>
            <p>BH: 0</p>
            <p>Dụng: 0</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Đang sửa
            </h4>
            <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            0
          </p>
          <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
            <p>Cơ giá: 0</p>
            <p>BH: 0</p>
            <p>Dụng: 0</p>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-100">
              Sửa xong
            </h4>
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">
            0
          </p>
          <div className="mt-2 text-xs text-green-700 dark:text-green-300 space-y-0.5">
            <p>Cơ giá: 0</p>
            <p>BH: 0</p>
            <p>Dụng: 0</p>
          </div>
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

      {/* Cảnh báo */}
      {alerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
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

      {/* Biểu đồ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <div className="mt-4 flex justify-center gap-6">
          </div>
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

      {/* Top Customers và Monthly Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <BarChart
              data={monthlyComparisonData}
            >
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng khách hàng
            </h3>
            <Users className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {customers.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {customers.filter((c) => c.segment === "VIP").length} VIP
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng nhân viên
            </h3>
            <BriefcaseBusiness className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {employees.filter((e) => e.status === "active").length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Đang làm việc
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tổng sản phẩm
            </h3>
            <Boxes className="w-5 h-5 text-slate-500" />
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">
            {parts.reduce((sum, p) => sum + (p.stock[currentBranchId] || 0), 0)}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {parts.length} loại sản phẩm
          </div>
        </div>
      </div>
    </div>
  );
};



export default Dashboard;
