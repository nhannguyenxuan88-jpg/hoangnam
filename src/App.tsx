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
      <div className="max-w-[1600px] mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Brand and Branch Selector */}
          <div className="flex items-center gap-4">
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
                  className="w-14 h-14 rounded-xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 group-hover:shadow-md group-hover:ring-emerald-400/60 dark:group-hover:ring-emerald-500/60 transition"
                />
                <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-emerald-600 to-blue-600 text-transparent bg-clip-text dark:from-emerald-400 dark:to-blue-400 hidden md:inline">
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

          {/* Center: Main Navigation */}
          <div className="flex items-center gap-2">
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
  | "fuchsia";

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
                        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
                          <Nav />
                          <main className="max-w-[1600px] mx-auto p-6">
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
