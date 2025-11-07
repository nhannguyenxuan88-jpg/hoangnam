import React, { useEffect, useState, useMemo } from "react";
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AppProvider } from "./contexts/AppContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { supabase, IS_OFFLINE } from "./supabaseClient";
import "./index.css";

import { useAppContext } from "./contexts/AppContext";
import { formatCurrency, formatDate } from "./utils/format";
import { ShoppingCartIcon, CheckCircleIcon } from "./components/Icons";

const Dashboard: React.FC = () => {
  const { sales, parts, cartItems, cashTransactions, workOrders, customers, paymentSources, currentBranchId } = useAppContext();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []); // yyyy-mm-dd

  const todaySales = useMemo(
    () => sales.filter(s => s.date.slice(0, 10) === today),
    [sales, today]
  );
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayProfit = todaySales.reduce((sum, s) => {
    const cost = s.items.reduce((c, it) => c + ((it as any).costPrice || 0) * it.quantity, 0);
    return sum + (s.total - cost);
  }, 0);
  
  const todayCustomers = useMemo(() => {
    const uniqueCustomers = new Set(todaySales.map(s => s.customer.phone || s.customer.name));
    return uniqueCustomers.size;
  }, [todaySales]);

  const totalParts = parts.reduce((sum, p) => sum + (p.stock[currentBranchId] || 0), 0);

  const cashBalance = paymentSources.find(ps => ps.id === 'cash')?.balance[currentBranchId] || 0;
  const bankBalance = paymentSources.find(ps => ps.id === 'bank')?.balance[currentBranchId] || 0;

  // Hoạt động gần đây
  const recentActivities = useMemo(() => {
    const activities: Array<{ text: string; time: string; icon: 'customer' | 'sale' }> = [];
    
    // Khách hàng mới
    const recentCustomers = customers
      .filter(c => c.created_at && new Date(c.created_at).toISOString().slice(0, 10) === today)
      .slice(0, 2);
    recentCustomers.forEach(c => {
      const time = c.created_at ? new Date(c.created_at) : new Date();
      const hoursAgo = Math.floor((Date.now() - time.getTime()) / 3600000);
      activities.push({
        text: `Khách hàng ${c.name} đặt lịch thay nhớt.`,
        time: hoursAgo > 0 ? `${hoursAgo} giờ trước` : 'Vừa xong',
        icon: 'customer'
      });
    });

    // Đơn hàng gần đây
    todaySales.slice(0, 2).forEach(s => {
      const time = new Date(s.date);
      const hoursAgo = Math.floor((Date.now() - time.getTime()) / 3600000);
      activities.push({
        text: `Thanh toán đơn hàng #${s.id.slice(-4)}.`,
        time: hoursAgo > 0 ? `${hoursAgo} giờ trước` : 'Vừa xong',
        icon: 'sale'
      });
    });

    return activities.slice(0, 2);
  }, [customers, todaySales, today]);

  // Công việc cần chú ý
  const pendingTasks = useMemo(() => {
    const tasks: Array<{ title: string; status: 'urgent' | 'today' | 'pending' }> = [];
    
    // Đơn sửa chữa chưa hoàn thành
    const pendingOrders = workOrders.filter(w => w.status !== 'Trả máy' && w.paymentStatus === 'unpaid');
    if (pendingOrders.length > 0) {
      const first = pendingOrders[0];
      tasks.push({
        title: `Kiểm tra định kỳ xe SH của anh ${first.customerName}`,
        status: 'urgent'
      });
    }

    // Phụ tùng sắp hết
    const lowStock = parts.filter(p => (p.stock[currentBranchId] || 0) < 5);
    if (lowStock.length > 0) {
      tasks.push({
        title: `Gọi điện xác nhận lịch hẹn với chị ${customers[0]?.name || 'Mai'}`,
        status: 'today'
      });
    }

    // Đơn hàng đầu nhớt
    tasks.push({
      title: `Đặt hàng dầu nhớt Motul`,
      status: 'pending'
    });

    return tasks;
  }, [workOrders, parts, customers, currentBranchId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Nhân-Lâm SmartCare</h1>
          <p className="text-slate-400 text-sm mt-1">CN1</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard 
          label="Doanh thu hôm nay" 
          value={`${formatCurrency(todayRevenue).replace('₫', '')}₫`}
          icon="💰"
          iconBg="bg-blue-500/20"
          iconColor="text-blue-400"
        />
        <StatCard 
          label="Lợi nhuận hôm nay" 
          value={`${formatCurrency(todayProfit).replace('₫', '')}₫`}
          icon="📈"
          iconBg="bg-green-500/20"
          iconColor="text-green-400"
        />
        <StatCard 
          label="Lượt khách hôm nay" 
          value={todayCustomers}
          icon="👥"
          iconBg="bg-purple-500/20"
          iconColor="text-purple-400"
        />
        <StatCard 
          label="Phụ tùng sắp hết" 
          value={parts.filter(p => (p.stock[currentBranchId] || 0) < 5).length}
          icon="📦"
          iconBg="bg-orange-500/20"
          iconColor="text-orange-400"
        />
        <StatCard 
          label="Tổng doanh thu (Chi nhánh)" 
          value={`${formatCurrency(sales.reduce((s, sale) => s + sale.total, 0)).replace('₫', '')}₫`}
          icon="📊"
          iconBg="bg-pink-500/20"
          iconColor="text-pink-400"
        />
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Hoạt động gần đây */}
        <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Hoạt động gần đây</h2>
          <div className="space-y-4">
            {recentActivities.length === 0 && (
              <p className="text-slate-400 text-sm">Chưa có hoạt động nào hôm nay.</p>
            )}
            {recentActivities.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activity.icon === 'customer' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                }`}>
                  {activity.icon === 'customer' ? (
                    <span className="text-purple-400">👤</span>
                  ) : (
                    <ShoppingCartIcon className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm">{activity.text}</p>
                  <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                    🕐 {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tình hình tài chính */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Tình hình tài chính</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300 text-sm">Tiền mặt CN1</span>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Thu</span>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Chi</span>
                <span className="text-slate-100 text-sm font-semibold">{formatCurrency(cashBalance).replace('₫', '')}₫</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <span className="text-slate-300 text-sm">Ngân hàng CN1</span>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Thu</span>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Chi</span>
                <span className="text-slate-100 text-sm font-semibold">{formatCurrency(bankBalance).replace('₫', '')}₫</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Công việc cần chú ý */}
      <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Công việc cần chú ý</h2>
        <div className="space-y-3">
          {pendingTasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition">
              <span className="text-slate-200 text-sm">{task.title}</span>
              <div className="flex gap-2">
                <button className={`px-3 py-1 rounded text-xs font-medium ${
                  task.status === 'urgent' ? 'bg-red-500/20 text-red-400' :
                  task.status === 'today' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {task.status === 'urgent' ? 'Sắp tới hạn' : task.status === 'today' ? 'Hôm nay' : 'Cần thực hiện'}
                </button>
                <button className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded text-xs">
                  Đánh dấu xong
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ 
  label: string; 
  value: React.ReactNode; 
  icon: string;
  iconBg: string;
  iconColor: string;
}> = ({ label, value, icon, iconBg, iconColor }) => (
  <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition">
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center text-2xl`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className="text-xl font-bold text-slate-100 truncate">{value}</p>
      </div>
    </div>
  </div>
);

import SalesManager from './components/sales/SalesManager';
import InventoryManager from './components/inventory/InventoryManager';
import ServiceManager from './components/service/ServiceManager';
import { ServiceHistory } from './components/service/ServiceHistory';
import CustomerManager from './components/customer/CustomerManager';
const Sales = () => <SalesManager />;
const Inventory = () => <InventoryManager />;
const Service = () => <ServiceManager />;
const ServiceHistoryPage = () => <ServiceHistory currentBranchId={useAppContext().currentBranchId} />;
const Customers = () => <CustomerManager />;

function Nav() {
  const [showSettings, setShowSettings] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Brand and Branch Selector */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition"
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              {/* Settings Dropdown */}
              {showSettings && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSettings(false)}
                  ></div>
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cài đặt</p>
                    </div>
                    <button
                      onClick={() => {
                        toggleTheme();
                        setShowSettings(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-sm text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        {theme === 'dark' ? '🌙' : '☀️'}
                        <span>Chế độ {theme === 'dark' ? 'tối' : 'sáng'}</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {theme === 'dark' ? 'Chuyển sang sáng' : 'Chuyển sang tối'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nhân-Lâm SmartCare</h1>
              <select className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition">
                <option>CN1</option>
                <option>CN2</option>
              </select>
            </div>
          </div>

          {/* Center: Main Navigation */}
          <div className="flex items-center gap-2">
            <NavLink to="/dashboard" icon="📊" label="Tổng quan" />
            <NavLink to="/service" icon="🔧" label="Sửa chữa" />
            <NavLink to="/sales" icon="🛒" label="Bán hàng" />
            <NavLink to="/inventory" icon="📦" label="Quản lý kho" />
            <NavLink to="/customers" icon="👥" label="Khách hàng" />
            <NavLink to="/finance" icon="🏦" label="Tài chính" />
            <NavLink to="/payroll" icon="💰" label="Công nạ" />
            <NavLink to="/reports" icon="📈" label="Báo cáo" />
          </div>

          {/* Right: Spacer */}
          <div className="w-10"></div>
        </div>
      </div>
    </nav>
  );
}

const NavLink: React.FC<{ to: string; icon: string; label: string }> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
        isActive 
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
};

function useFakeAuth() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Không yêu cầu phân quyền: luôn coi là đăng nhập thành công (offline/dev)
    setReady(true);
  }, []);
  return { ready };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes default
      gcTime: 5 * 60 * 1000, // 5 minutes default
      refetchOnWindowFocus: false, // Prevent refetch when window regains focus
      refetchOnReconnect: 'always', // Refetch when network reconnects
      retry: 2, // Retry failed queries twice
    },
  },
});

export default function App() {
  const { ready } = useFakeAuth();
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppProvider>
          <HashRouter>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
              <Nav />
              <main className="max-w-[1600px] mx-auto p-6">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/sales" element={<Sales />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/service" element={<Service />} />
                  <Route path="/service-history" element={<ServiceHistoryPage />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/finance" element={<div className="text-center py-12 text-slate-400">Tài chính - Đang phát triển</div>} />
                  <Route path="/payroll" element={<div className="text-center py-12 text-slate-400">Công nạ - Đang phát triển</div>} />
                  <Route path="/reports" element={<div className="text-center py-12 text-slate-400">Báo cáo - Đang phát triển</div>} />
                </Routes>
              </main>
            </div>
            <ReactQueryDevtools initialIsOpen={false} />
          </HashRouter>
        </AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
