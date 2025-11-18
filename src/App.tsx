import React, { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { showToast } from "./utils/toast";
import ErrorBoundary from "./components/common/ErrorBoundary";
import TopProgressBar from "./components/common/TopProgressBar";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AppProvider } from "./contexts/AppContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./index.css";
import { LoginPage } from "./components/auth/LoginPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { useAppContext } from "./contexts/AppContext";
import {
  LayoutDashboard,
  Wrench,
  ShoppingCart as Cart,
  Boxes,
  Users,
  BriefcaseBusiness,
  Landmark,
  HandCoins,
  BarChart3,
  FileText,
  Settings as Cog,
  LogOut,
  Sun,
  Moon,
  Crown,
  UserCog,
  User,
  X,
  Menu,
} from "lucide-react";
import Dashboard from "./components/dashboard/Dashboard";

import SalesManager from "./components/sales/SalesManager";
import InventoryManager from "./components/inventory/InventoryManager";
import ServiceManager from "./components/service/ServiceManager";
import { ServiceHistory } from "./components/service/ServiceHistory";
import CustomerManager from "./components/customer/CustomerManager";
import DebtManager from "./components/debt/DebtManager";
import CashBook from "./components/finance/CashBook";
import LoansManager from "./components/finance/LoansManager";
import FinanceManager from "./components/finance/FinanceManager";
import PayrollManager from "./components/payroll/PayrollManager";
import ReportsManager from "./components/reports/ReportsManager";
import EmployeeManager from "./components/employee/EmployeeManager";
import CategoriesManager from "./components/categories/CategoriesManager";
import LookupManager from "./components/lookup/LookupManager";
import AnalyticsDashboard from "./components/analytics/AnalyticsDashboard";
import AuditLogsViewer from "./components/admin/AuditLogsViewer";
import { SettingsManager } from "./components/settings/SettingsManager";
import RepoErrorPanel from "./components/common/RepoErrorPanel";

const Sales = () => <SalesManager />;
const Inventory = () => <InventoryManager />;
const Service = () => <ServiceManager />;
const ServiceHistoryPage = () => (
  <ServiceHistory currentBranchId={useAppContext().currentBranchId} />
);
const Customers = () => <CustomerManager />;
const Debt = () => <DebtManager />;
const CashBookPage = () => <CashBook />;
const LoansPage = () => <LoansManager />;
const FinancePage = () => <FinanceManager />;
const PayrollPage = () => <PayrollManager />;
const ReportsPage = () => <ReportsManager />;
const EmployeesPage = () => <EmployeeManager />;
const CategoriesPage = () => <CategoriesManager />;
const LookupPage = () => <LookupManager />;
const AnalyticsPage = () => <AnalyticsDashboard />;
const SettingsPage = () => <SettingsManager />;

function Nav() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { profile, signOut } = useAuth();
  const role = profile?.role;
  const can = {
    viewFinance: role === "owner" || role === "manager",
    viewPayroll: role === "owner" || role === "manager",
    viewAnalytics: role === "owner" || role === "manager",
    viewDebt: role === "owner" || role === "manager",
    viewEmployees: role === "owner" || role === "manager",
    viewSettings: role === "owner" || role === "manager",
  } as const;

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Brand and Branch Selector */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              aria-label="Menu"
            >
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Brand Logo acts as settings toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="group flex items-center gap-3 focus:outline-none"
                aria-label="Mở cài đặt và tài khoản"
              >
                <img
                  src="/logo-smartcare.png"
                  alt="SmartCare Logo"
                  className="w-12 h-12 md:w-14 md:h-14 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 group-hover:shadow-md group-hover:ring-emerald-400/60 dark:group-hover:ring-emerald-500/60 transition"
                />
                <span className="font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-emerald-600 to-blue-600 text-transparent bg-clip-text dark:from-emerald-400 dark:to-blue-400 hidden lg:inline">
                  Nhạn Lâm SmartCare
                </span>
              </button>

              {/* Integrated Settings Dropdown */}
              {showSettings && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSettings(false)}
                  ></div>
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Cài đặt & tài khoản
                      </p>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                        aria-label="Đóng"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* User profile summary */}
                    {profile && (
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {profile.full_name?.[0] ||
                            profile.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {profile.full_name || profile.email}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            {profile.role === "owner" && (
                              <Crown className="w-3.5 h-3.5 text-yellow-500" />
                            )}
                            {profile.role === "manager" && (
                              <UserCog className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                            {profile.role === "staff" && (
                              <User className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>
                              {profile.role === "owner"
                                ? "Chủ cửa hàng"
                                : profile.role === "manager"
                                ? "Quản lý"
                                : "Nhân viên"}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Theme toggle */}
                    <button
                      onClick={() => {
                        toggleTheme();
                        setShowSettings(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-sm text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        {theme === "dark" ? (
                          <Moon className="w-4 h-4" />
                        ) : (
                          <Sun className="w-4 h-4" />
                        )}
                        <span>Chế độ {theme === "dark" ? "tối" : "sáng"}</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {theme === "dark"
                          ? "Chuyển sang sáng"
                          : "Chuyển sang tối"}
                      </span>
                    </button>

                    {/* Go to system settings (restricted) */}
                    {can.viewSettings && (
                      <Link
                        to="/settings"
                        onClick={() => setShowSettings(false)}
                        className="block w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <Cog className="w-4 h-4" />
                          <span>Cài đặt hệ thống</span>
                        </span>
                      </Link>
                    )}

                    {/* Logout */}
                    {profile && (
                      <button
                        onClick={async () => {
                          try {
                            await signOut();
                          } finally {
                            setShowSettings(false);
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <span className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" />
                          <span>Đăng xuất</span>
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Removed redundant brand title and branch selector as requested */}
          </div>

          {/* Center: Main Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink
              to="/dashboard"
              colorKey="blue"
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Tổng quan"
            />
            <NavLink
              to="/service"
              colorKey="violet"
              icon={<Wrench className="w-5 h-5" />}
              label="Sửa chữa"
            />
            <NavLink
              to="/sales"
              colorKey="emerald"
              icon={<Cart className="w-5 h-5" />}
              label="Bán hàng"
            />
            <NavLink
              to="/inventory"
              colorKey="amber"
              icon={<Boxes className="w-5 h-5" />}
              label="Quản lý kho"
            />
            <NavLink
              to="/customers"
              colorKey="cyan"
              icon={<Users className="w-5 h-5" />}
              label="Khách hàng"
            />
            {can.viewEmployees && (
              <NavLink
                to="/employees"
                colorKey="indigo"
                icon={<BriefcaseBusiness className="w-5 h-5" />}
                label="Nhân viên"
              />
            )}
            {can.viewFinance && (
              <NavLink
                to="/finance"
                colorKey="rose"
                icon={<Landmark className="w-5 h-5" />}
                label="Tài chính"
              />
            )}
            {can.viewDebt && (
              <NavLink
                to="/debt"
                colorKey="orange"
                icon={<HandCoins className="w-5 h-5" />}
                label="Công nợ"
              />
            )}
            {can.viewAnalytics && (
              <NavLink
                to="/analytics"
                colorKey="teal"
                icon={<BarChart3 className="w-5 h-5" />}
                label="Phân tích"
              />
            )}
            <NavLink
              to="/reports"
              colorKey="fuchsia"
              icon={<FileText className="w-5 h-5" />}
              label="Báo cáo"
            />
          </div>

          {/* Right: empty (user menu integrated into settings) */}
          <div className="flex items-center" />
        </div>

        {/* Mobile Menu Drawer - For Secondary Functions */}
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowMobileMenu(false)}
            ></div>

            {/* Menu Drawer - Redesigned with modern style */}
            <div className="fixed inset-y-0 left-0 w-80 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 z-50 shadow-2xl md:hidden overflow-y-auto animate-slide-in-left">
              {/* Header with Profile */}
              <div className="relative p-6 pb-8 bg-gradient-to-br from-blue-600 to-violet-600 dark:from-blue-700 dark:to-violet-800">
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                {profile && (
                  <div className="flex items-center gap-3 text-white mt-2">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-xl font-bold border-2 border-white/30">
                      {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">
                        {profile.full_name || profile.email}
                      </div>
                      <div className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                        {profile.role === "owner" && (
                          <Crown className="w-3 h-3" />
                        )}
                        {profile.role === "manager" && (
                          <UserCog className="w-3 h-3" />
                        )}
                        {profile.role === "staff" && (
                          <User className="w-3 h-3" />
                        )}
                        <span>
                          {profile.role === "owner"
                            ? "Chủ cửa hàng"
                            : profile.role === "manager"
                            ? "Quản lý"
                            : "Nhân viên"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary Functions - Grouped by category */}
              <div className="p-4 space-y-6">
                {/* Management Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                    Quản lý
                  </div>
                  <div className="space-y-1">
                    {can.viewEmployees && (
                      <MobileDrawerLink
                        to="/employees"
                        icon={<BriefcaseBusiness className="w-5 h-5" />}
                        label="Nhân viên"
                        color="indigo"
                        onClick={() => setShowMobileMenu(false)}
                      />
                    )}
                    {can.viewDebt && (
                      <MobileDrawerLink
                        to="/debt"
                        icon={<HandCoins className="w-5 h-5" />}
                        label="Công nợ"
                        color="orange"
                        onClick={() => setShowMobileMenu(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Finance & Reports Section */}
                {(can.viewFinance || can.viewAnalytics) && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                      Tài chính & Báo cáo
                    </div>
                    <div className="space-y-1">
                      {can.viewFinance && (
                        <MobileDrawerLink
                          to="/finance"
                          icon={<Landmark className="w-5 h-5" />}
                          label="Tài chính"
                          color="rose"
                          onClick={() => setShowMobileMenu(false)}
                        />
                      )}
                      {can.viewAnalytics && (
                        <MobileDrawerLink
                          to="/analytics"
                          icon={<BarChart3 className="w-5 h-5" />}
                          label="Phân tích"
                          color="teal"
                          onClick={() => setShowMobileMenu(false)}
                        />
                      )}
                      <MobileDrawerLink
                        to="/reports"
                        icon={<FileText className="w-5 h-5" />}
                        label="Báo cáo"
                        color="fuchsia"
                        onClick={() => setShowMobileMenu(false)}
                      />
                    </div>
                  </div>
                )}

                {/* Settings Section */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                    Hệ thống
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        toggleTheme();
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/50 transition text-slate-700 dark:text-slate-300"
                    >
                      {theme === "dark" ? (
                        <Moon className="w-5 h-5" />
                      ) : (
                        <Sun className="w-5 h-5" />
                      )}
                      <span className="font-medium">
                        Chế độ {theme === "dark" ? "tối" : "sáng"}
                      </span>
                    </button>

                    {can.viewSettings && (
                      <MobileDrawerLink
                        to="/settings"
                        icon={<Cog className="w-5 h-5" />}
                        label="Cài đặt"
                        color="slate"
                        onClick={() => setShowMobileMenu(false)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Logout Button - Fixed at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                    } finally {
                      setShowMobileMenu(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition shadow-lg shadow-red-500/20"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

type ColorKey =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "cyan"
  | "indigo"
  | "rose"
  | "orange"
  | "teal"
  | "fuchsia"
  | "slate";

const NAV_COLORS: Record<
  ColorKey,
  { text: string; bg: string; hoverBg: string }
> = {
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    hoverBg: "hover:bg-violet-50 dark:hover:bg-violet-900/20",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    hoverBg: "hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
  },
  indigo: {
    text: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    hoverBg: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/30",
    hoverBg: "hover:bg-rose-50 dark:hover:bg-rose-900/20",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/30",
    hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
  },
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/30",
    hoverBg: "hover:bg-teal-50 dark:hover:bg-teal-900/20",
  },
  fuchsia: {
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-900/30",
    hoverBg: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20",
  },
  slate: {
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    hoverBg: "hover:bg-slate-50 dark:hover:bg-slate-900/20",
  },
};

const MobileDrawerLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  color: ColorKey;
  onClick?: () => void;
}> = ({ to, icon, label, color, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  const colorConfig = NAV_COLORS[color as ColorKey] || NAV_COLORS.slate;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
        isActive
          ? `${colorConfig.bg} ${colorConfig.text} shadow-sm`
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
      }`}
    >
      <div className={`${isActive ? colorConfig.text : ""}`}>{icon}</div>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
};

const MobileNavLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ to, icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const NavLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  colorKey: ColorKey;
}> = ({ to, icon, label, colorKey }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
        isActive
          ? `${NAV_COLORS[colorKey].bg} ${NAV_COLORS[colorKey].text}`
          : `text-slate-600 dark:text-slate-300 ${NAV_COLORS[colorKey].hoverBg}`
      }`}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-xs font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
};

// Bottom Navigation Bar for Mobile
const BottomNav: React.FC = () => {
  const location = useLocation();

  const navItems = [
    {
      to: "/dashboard",
      icon: <LayoutDashboard className="w-6 h-6" />,
      label: "Tổng quan",
      color: "blue",
    },
    {
      to: "/service",
      icon: <Wrench className="w-6 h-6" />,
      label: "Sửa chữa",
      color: "violet",
    },
    {
      to: "/sales",
      icon: <Cart className="w-6 h-6" />,
      label: "Bán hàng",
      color: "emerald",
    },
    {
      to: "/inventory",
      icon: <Boxes className="w-6 h-6" />,
      label: "Kho",
      color: "amber",
    },
    {
      to: "/customers",
      icon: <Users className="w-6 h-6" />,
      label: "Khách hàng",
      color: "cyan",
    },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-bottom">
      {/* Backdrop blur effect for modern look */}
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>

      <div className="grid grid-cols-5 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const colorKey = item.color as ColorKey;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? `${NAV_COLORS[colorKey].bg} ${NAV_COLORS[colorKey].text} scale-105`
                  : "text-slate-600 dark:text-slate-400 active:scale-95"
              }`}
            >
              <div
                className={`transition-transform ${
                  isActive ? "scale-110" : ""
                }`}
              >
                {item.icon}
              </div>
              <span
                className={`text-[10px] font-medium truncate w-full text-center ${
                  isActive ? "font-semibold" : ""
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div
                  className={`h-1 w-8 rounded-full ${NAV_COLORS[colorKey].bg} mt-0.5`}
                ></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
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
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 2,
    },
  },
});

// Attach global error handlers using built-in callbacks by extending QueryCache/MutationCache
// Simplified: we rely on per-query onError via a wrapper helper if needed; fallback here is noop.

export default function App() {
  const { ready } = useFakeAuth();
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <HashRouter>
              <ErrorBoundary>
                <TopProgressBar />
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<LoginPage />} />

                  {/* Protected Routes */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors pb-20 md:pb-0">
                          <Nav />
                          <main className="max-w-[1600px] mx-auto p-4 md:p-6">
                            <Routes>
                              <Route
                                path="/"
                                element={<Navigate to="/dashboard" replace />}
                              />
                              <Route
                                path="/dashboard"
                                element={<Dashboard />}
                              />
                              <Route path="/sales" element={<Sales />} />
                              <Route
                                path="/audit-logs"
                                element={
                                  <ProtectedRoute requiredRoles={["owner"]}>
                                    <AuditLogsViewer />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/inventory"
                                element={<Inventory />}
                              />
                              <Route
                                path="/categories"
                                element={<CategoriesPage />}
                              />
                              <Route path="/lookup" element={<LookupPage />} />
                              <Route path="/service" element={<Service />} />
                              <Route
                                path="/service-history"
                                element={<ServiceHistoryPage />}
                              />
                              <Route
                                path="/customers"
                                element={<Customers />}
                              />
                              <Route
                                path="/debt"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <Debt />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/cashbook"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <CashBookPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/loans"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <LoansPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/payroll"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <PayrollPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/employees"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <EmployeesPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/finance"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <FinancePage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/analytics"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <AnalyticsPage />
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/reports"
                                element={<ReportsPage />}
                              />
                              <Route
                                path="/settings"
                                element={
                                  <ProtectedRoute
                                    requiredRoles={["owner", "manager"]}
                                  >
                                    <SettingsPage />
                                  </ProtectedRoute>
                                }
                              />
                            </Routes>
                          </main>
                          {/* Bottom Navigation for Mobile */}
                          <BottomNav />
                        </div>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
                <ReactQueryDevtools initialIsOpen={false} />
                {/* Dev-only repository error panel */}
                {import.meta.env.DEV && <RepoErrorPanel />}
              </ErrorBoundary>
            </HashRouter>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
