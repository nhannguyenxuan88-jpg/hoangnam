import React, { useEffect, useState, Suspense } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/common/ErrorBoundary";
import TopProgressBar from "./components/common/TopProgressBar";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AppProvider } from "./contexts/AppContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import { LoginPage } from "./components/auth/LoginPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleBasedRedirect } from "./components/auth/RoleBasedRedirect";
import { useAppContext } from "./contexts/AppContext";
import { BottomNav, Nav } from "./components/layout";
import { ShopLayout } from "./components/layout/ShopLayout";
import Dashboard from "./components/dashboard/Dashboard";
import RepoErrorPanel from "./components/common/RepoErrorPanel";
import TetTheme from "./components/common/TetTheme";
import { lazyImport } from "./utils/lazyImport";

// Lazy load large components for code splitting
const SalesManager = lazyImport(() => import("./components/sales/SalesManager"));
const InventoryManager = lazyImport(
  () => import("./components/inventory/InventoryManager")
);
// InventoryManagerNew removed - folder moved to __DEPRECATED_backups

// Delivery Manager - Standalone page for delivery orders
const DeliveryManager = lazyImport(() => import("./components/sales/DeliveryManager").then(m => ({ default: m.DeliveryManager })));

// Shop pages - Public access for customers
const ProductCatalog = lazyImport(() => import("./pages/shop/ProductCatalog"));
const PromotionsPage = lazyImport(() => import("./pages/shop/PromotionsPage"));
const MaintenanceGallery = lazyImport(() => import("./pages/shop/MaintenanceGallery"));

// Admin pages - For managing shop content
const PromotionManager = lazyImport(() => import("./pages/admin/PromotionManager"));

// Delivery Test Page (for testing only)
const DeliveryTest = lazyImport(() => import("./pages/DeliveryTest").then(m => ({ default: m.DeliveryTest })));
const ServiceManager = lazyImport(
  () => import("./components/service/ServiceManager")
);
// ServiceManagerNew removed - folder moved to __DEPRECATED_backups
const ServiceHistory = lazyImport(() =>
  import("./components/service/ServiceHistory").then((m) => ({
    default: m.ServiceHistory,
  }))
);
const CustomerManager = lazyImport(
  () => import("./components/customer/CustomerManager")
);
// CustomerManagerNew removed - folder moved to __DEPRECATED_backups
const DebtManager = lazyImport(() => import("./components/debt/DebtManager"));
// DebtManagerNew removed - folder moved to __DEPRECATED_backups
const CashBook = lazyImport(() => import("./components/finance/CashBook"));
const LoansManager = lazyImport(() => import("./components/finance/LoansManager"));
const FinanceManager = lazyImport(
  () => import("./components/finance/FinanceManager")
);
const PayrollManager = lazyImport(
  () => import("./components/payroll/PayrollManager")
);
const ReportsManager = lazyImport(
  () => import("./components/reports/ReportsManager")
);
// ReportsManagerNew removed - folder moved to __DEPRECATED_backups
const TaxReportExport = lazyImport(
  () => import("./components/reports/TaxReportExport")
);
const EmployeeManager = lazyImport(
  () => import("./components/employee/EmployeeManager")
);
const CategoriesManager = lazyImport(
  () => import("./components/categories/CategoriesManager")
);
const LookupManager = lazyImport(() => import("./components/lookup/LookupManager"));
const AnalyticsDashboard = lazyImport(
  () => import("./components/analytics/AnalyticsDashboard")
);
const AuditLogsViewer = lazyImport(
  () => import("./components/admin/AuditLogsViewer")
);
const MigrationTool = lazyImport(() => import("./components/admin/MigrationTool"));
const SettingsManager = lazyImport(() =>
  import("./components/settings/SettingsManager").then((m) => ({
    default: m.SettingsManager,
  }))
);
const StaffDashboard = lazyImport(() =>
  import("./components/dashboard/StaffDashboard").then((m) => ({
    default: m.StaffDashboard,
  }))
);

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

const Sales = () => (
  <Suspense fallback={<PageLoader />}>
    <SalesManager />
  </Suspense>
);
const Inventory = () => (
  <Suspense fallback={<PageLoader />}>
    <InventoryManager />
  </Suspense>
);
// InventoryNew removed - was using deprecated InventoryManagerNew
const Service = () => (
  <Suspense fallback={<PageLoader />}>
    <ServiceManager />
  </Suspense>
);
// ServiceNew removed - was using deprecated ServiceManagerNew
const ServiceHistoryPage = () => {
  const { currentBranchId } = useAppContext();
  return (
    <Suspense fallback={<PageLoader />}>
      <ServiceHistory currentBranchId={currentBranchId} />
    </Suspense>
  );
};
const Customers = () => (
  <Suspense fallback={<PageLoader />}>
    <CustomerManager />
  </Suspense>
);
// CustomersNew removed - was using deprecated CustomerManagerNew
const Debt = () => (
  <Suspense fallback={<PageLoader />}>
    <DebtManager />
  </Suspense>
);
// DebtNew removed - was using deprecated DebtManagerNew
const CashBookPage = () => (
  <Suspense fallback={<PageLoader />}>
    <CashBook />
  </Suspense>
);
const LoansPage = () => (
  <Suspense fallback={<PageLoader />}>
    <LoansManager />
  </Suspense>
);
const FinancePage = () => (
  <Suspense fallback={<PageLoader />}>
    <FinanceManager />
  </Suspense>
);
const PayrollPage = () => (
  <Suspense fallback={<PageLoader />}>
    <PayrollManager />
  </Suspense>
);
const ReportsPage = () => (
  <Suspense fallback={<PageLoader />}>
    <ReportsManager />
  </Suspense>
);
// ReportsPageNew removed - was using deprecated ReportsManagerNew
const TaxReportPage = () => (
  <Suspense fallback={<PageLoader />}>
    <TaxReportExport />
  </Suspense>
);
const EmployeesPage = () => (
  <Suspense fallback={<PageLoader />}>
    <EmployeeManager />
  </Suspense>
);
const CategoriesPage = () => (
  <Suspense fallback={<PageLoader />}>
    <CategoriesManager />
  </Suspense>
);
const LookupPage = () => (
  <Suspense fallback={<PageLoader />}>
    <LookupManager />
  </Suspense>
);
const AnalyticsPage = () => (
  <Suspense fallback={<PageLoader />}>
    <AnalyticsDashboard />
  </Suspense>
);
const SettingsPage = () => (
  <Suspense fallback={<PageLoader />}>
    <SettingsManager />
  </Suspense>
);
const StaffDashboardPage = () => (
  <Suspense fallback={<PageLoader />}>
    <StaffDashboard />
  </Suspense>
);

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

const MainLayout: React.FC = () => {
  const location = useLocation();
  const isSalesPage = location.pathname === "/sales";
  const isShopPage = ['/shop', '/promotions', '/gallery'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors pb-20 md:pb-0 relative overflow-hidden">
      {/* Subtle background watermark logo - centered */}
      {!isShopPage && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
        >
          <img
            src="/logo-smartcare.png"
            alt=""
            className="w-[60vw] h-[60vh] max-w-[500px] max-h-[500px] object-contain opacity-[0.05] dark:opacity-[0.04]"
            style={{
              filter: 'grayscale(100%)',
            }}
          />
        </div>
      )}
      <TetTheme />
      {!isShopPage && <Nav />}
      <main
        className={`max-w-[1600px] mx-auto ${isSalesPage ? "p-0" : "p-0 md:p-6"
          }`}
      >
        <Routes>
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute requiredRoles={["staff"]}>
                <StaffDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/sales" element={<Sales />} />
          <Route path="/delivery" element={<DeliveryManager />} />
          <Route path="/delivery-test" element={<DeliveryTest />} />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requiredRoles={["owner"]}>
                <Suspense fallback={<PageLoader />}>
                  <AuditLogsViewer />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <Inventory />
              </ProtectedRoute>
            }
          />
          {/* /inventory-new route removed - deprecated */}
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/service" element={<Service />} />
          {/* /service-new route removed - deprecated */}
          <Route path="/service-history" element={<ServiceHistoryPage />} />
          <Route path="/customers" element={<Customers />} />
          {/* /customers-new route removed - deprecated */}
          <Route
            path="/debt"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <Debt />
              </ProtectedRoute>
            }
          />
          {/* /debt-new route removed - deprecated */}
          <Route
            path="/cashbook"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <CashBookPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loans"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <LoansPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <PayrollPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <FinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          {/* /reports-new route removed - deprecated */}
          <Route
            path="/tax-report"
            element={
              <ProtectedRoute
                requiredRoles={["owner", "manager", "accountant"]}
              >
                <TaxReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          {/* Public Shop Pages - No authentication required */}
          <Route
            path="/shop"
            element={
              <ShopLayout>
                <Suspense fallback={<PageLoader />}>
                  <ProductCatalog />
                </Suspense>
              </ShopLayout>
            }
          />
          <Route
            path="/promotions"
            element={
              <ShopLayout>
                <Suspense fallback={<PageLoader />}>
                  <PromotionsPage />
                </Suspense>
              </ShopLayout>
            }
          />
          <Route
            path="/gallery"
            element={
              <ShopLayout>
                <Suspense fallback={<PageLoader />}>
                  <MaintenanceGallery />
                </Suspense>
              </ShopLayout>
            }
          />
          {/* Admin Shop Pages - Manage shop content */}
          <Route
            path="/admin/promotions"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <Suspense fallback={<PageLoader />}>
                  <PromotionManager />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/migration"
            element={
              <ProtectedRoute requiredRoles={["owner"]}>
                <Suspense fallback={<PageLoader />}>
                  <MigrationTool />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {/* Bottom Navigation for Mobile */}
      {!isShopPage && <BottomNav />}
    </div>
  );
};

export default function App() {
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
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />

                  {/* Protected Routes */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <MainLayout />
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
