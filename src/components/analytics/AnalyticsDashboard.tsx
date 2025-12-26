import React, { useState, useMemo } from "react";
import {
  Boxes,
  LineChart,
  HandCoins,
  AlertTriangle,
  FileText,
  Wrench,
  Users,
} from "lucide-react";
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

// === FRESH DATA HOOKS (Real-time from Supabase) ===
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { useCustomerDebtsRepo, useSupplierDebtsRepo } from "../../hooks/useDebtsRepository";
import { useInventoryTxRepo } from "../../hooks/useInventoryTransactionsRepository";

type TabType = "inventory" | "sales" | "financial" | "services" | "customers";

const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("inventory");

  // Get currentBranchId and customers from Context (customers don't have a separate hook)
  const { currentBranchId, customers } = useAppContext();

  // === FETCH FRESH DATA FROM HOOKS (Real-time from Supabase) ===
  const { data: sales = [], isLoading: salesLoading } = useSalesRepo();
  const { data: parts = [], isLoading: partsLoading } = usePartsRepo();
  const { data: workOrders = [], isLoading: workOrdersLoading } = useWorkOrdersRepo();
  const { data: customerDebts = [], isLoading: customerDebtsLoading } = useCustomerDebtsRepo();
  const { data: supplierDebts = [], isLoading: supplierDebtsLoading } = useSupplierDebtsRepo();
  const { data: inventoryTransactions = [], isLoading: txLoading } = useInventoryTxRepo();

  const isLoading = salesLoading || partsLoading || workOrdersLoading ||
    customerDebtsLoading || supplierDebtsLoading || txLoading;

  // === MONTHLY STATS FOR KPI CARDS (calculated from fresh data) ===
  // MUST include both SALES and WORKORDERS revenue (like Reports page)
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Create costPrice lookup map from parts (partId -> costPrice)
    const costPriceMap = new Map<string, number>();
    parts.forEach((p: any) => {
      const cost = p.costPrice?.[currentBranchId] || 0;
      costPriceMap.set(p.id, cost);
    });

    // 1. SALES REVENUE (Bán hàng)
    const currentMonthSales = sales.filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const salesRevenue = currentMonthSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const salesCost = currentMonthSales.reduce((sum, s: any) => {
      return sum + (s.items || []).reduce((c: number, item: any) => {
        // Lookup cost from parts array, or use 0 for services
        const unitCost = item.isService ? 0 : (costPriceMap.get(item.partId) || 0);
        return c + (unitCost * (item.quantity || 0));
      }, 0);
    }, 0);
    const salesProfit = salesRevenue - salesCost;

    // 2. WORKORDERS/SERVICES REVENUE (Dịch vụ sửa chữa)
    const currentMonthWO = workOrders.filter((wo) => {
      const d = new Date(wo.creationDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear &&
        (wo.status === "Trả máy" || wo.paymentStatus === "paid" || wo.paymentStatus === "partial" || (wo.totalPaid && wo.totalPaid > 0)) &&
        !wo.refunded;
    });
    const woRevenue = currentMonthWO.reduce((sum, wo: any) => sum + (wo.totalPaid || wo.total || 0), 0);

    // WO Cost = Parts Cost (from partsUsed with costPrice) + additionalServices cost
    const woCost = currentMonthWO.reduce((sum, wo: any) => {
      const partsCost = (wo.partsUsed || []).reduce((c: number, p: any) =>
        c + ((p.costPrice || costPriceMap.get(p.partId) || 0) * (p.quantity || 0)), 0);
      const svcCost = (wo.additionalServices || []).reduce((c: number, svc: any) =>
        c + ((svc.costPrice || 0) * (svc.quantity || 0)), 0);
      return sum + partsCost + svcCost;
    }, 0);
    const woProfit = woRevenue - woCost;

    // TOTAL = Sales + WorkOrders
    const revenue = salesRevenue + woRevenue;
    const profit = salesProfit + woProfit;

    return { revenue, profit };
  }, [sales, workOrders, parts, currentBranchId]);

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

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4 max-w-[1600px] mx-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Đang tải dữ liệu phân tích...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Báo cáo & Phân tích
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Theo dõi và phân tích hiệu suất kinh doanh
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex gap-2">
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

        {/* KPI Cards - Using fresh monthly stats */}
        <div className="mb-6">
          <KPICards
            currentRevenue={monthlyStats.revenue}
            currentProfit={monthlyStats.profit}
            dateRange={{
              label: "Tháng này",
              from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
            }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium transition-all relative text-sm ${activeTab === tab.id
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

      {/* Content - UNIFIED DATA: All children receive fresh data as props */}
      <div className="animate-fadeIn">
        {activeTab === "inventory" && (
          <InventoryAnalytics
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            inventoryTransactions={inventoryTransactions}
            currentBranchId={currentBranchId}
          />
        )}
        {activeTab === "sales" && (
          <SalesAnalytics
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            currentBranchId={currentBranchId}
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
          />
        )}
        {activeTab === "services" && (
          <ServiceAnalytics
            workOrders={workOrders}
            currentBranchId={currentBranchId}
          />
        )}
        {activeTab === "customers" && (
          <CustomerAnalytics
            customers={customers}
            sales={sales}
            workOrders={workOrders}
            parts={parts}
            currentBranchId={currentBranchId}
          />
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
