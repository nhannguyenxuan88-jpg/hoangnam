import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import {
  useCustomerDebtsRepo,
  useSupplierDebtsRepo,
} from "../../hooks/useDebtsRepository";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";

type TimeRange = "7days" | "30days" | "90days" | "all";

interface FinancialAnalyticsProps {
  sales: any[];
  workOrders: any[];
  parts: any[];
  customerDebts: any[];
  supplierDebts: any[];
  currentBranchId: string;
}

const FinancialAnalytics: React.FC<FinancialAnalyticsProps> = ({
  sales,
  workOrders,
  parts,
  customerDebts,
  supplierDebts,
  currentBranchId
}) => {
  const isLoading = false; // Data comes from parent
  const [timeRange, setTimeRange] = useState<TimeRange>("30days");

  // Filter by time range
  const getCutoffDate = () => {
    if (timeRange === "all") return new Date(0);
    const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return cutoffDate;
  };

  // Income from Sales (bán hàng)
  const salesIncome = useMemo(() => {
    const cutoffDate = getCutoffDate();
    return sales
      .filter((s) => new Date(s.date) >= cutoffDate)
      .reduce((sum, s) => sum + s.total, 0);
  }, [sales, timeRange]);

  // Income from Work Orders (sửa chữa) - tính các đơn đã trả máy hoặc đã thanh toán
  const workOrderIncome = useMemo(() => {
    const cutoffDate = getCutoffDate();
    return workOrders
      .filter((wo) => {
        const woDate = new Date(wo.creationDate);
        // Tính đơn đã trả máy HOẶC đã thanh toán (paid/partial) trong khoảng thời gian
        // Không tính đơn đã hoàn tiền (refunded)
        const isCompleted = wo.status === "Trả máy" ||
          wo.paymentStatus === "paid" ||
          wo.paymentStatus === "partial" ||
          (wo.totalPaid && wo.totalPaid > 0);
        return woDate >= cutoffDate && isCompleted && !wo.refunded;
      })
      .reduce((sum, wo) => sum + (wo.totalPaid || wo.total || 0), 0);
  }, [workOrders, timeRange]);

  // Total Income
  const totalIncome = salesIncome + workOrderIncome;

  // Cost of Goods Sold from Sales
  const salesCOGS = useMemo(() => {
    const cutoffDate = getCutoffDate();
    return sales
      .filter((s) => new Date(s.date) >= cutoffDate)
      .reduce((sum, sale) => {
        const saleCost = sale.items.reduce((itemSum, item) => {
          const part = parts.find((p) => p.id === item.partId);
          const costPrice = part?.wholesalePrice?.[currentBranchId] || 0;
          return itemSum + costPrice * item.quantity;
        }, 0);
        return sum + saleCost;
      }, 0);
  }, [sales, parts, currentBranchId, timeRange]);

  // Cost of Goods Sold from Work Orders
  const workOrderCOGS = useMemo(() => {
    const cutoffDate = getCutoffDate();
    return workOrders
      .filter((wo) => {
        const woDate = new Date(wo.creationDate);
        const isCompleted = wo.status === "Trả máy" ||
          wo.paymentStatus === "paid" ||
          wo.paymentStatus === "partial" ||
          (wo.totalPaid && wo.totalPaid > 0);
        return woDate >= cutoffDate && isCompleted && !wo.refunded;
      })
      .reduce((sum, wo) => {
        // Giá vốn phụ tùng trong work order
        const partsCost = (wo.partsUsed || []).reduce((partSum, woPart) => {
          const part = parts.find((p) => p.id === woPart.partId);
          const costPrice = part?.wholesalePrice?.[currentBranchId] || 0;
          return partSum + costPrice * woPart.quantity;
        }, 0);
        // Giá vốn dịch vụ bên ngoài (gia công)
        const servicesCost = (wo.additionalServices || []).reduce(
          (svcSum, svc) => svcSum + (svc.costPrice || 0) * svc.quantity,
          0
        );
        return sum + partsCost + servicesCost;
      }, 0);
  }, [workOrders, parts, currentBranchId, timeRange]);

  // Total Cost of Goods Sold
  const totalCOGS = salesCOGS + workOrderCOGS;

  // Net profit = Doanh thu - Giá vốn hàng bán
  const netProfit = totalIncome - totalCOGS;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Daily income vs cost of goods sold
  const dailyFinancials = useMemo(() => {
    const cutoffDate = getCutoffDate();
    const financialMap = new Map<string, { income: number; expense: number }>();

    // Add sales income and calculate COGS for each sale
    sales
      .filter((s) => new Date(s.date) >= cutoffDate)
      .forEach((sale) => {
        const date = sale.date.slice(0, 10);
        const existing = financialMap.get(date) || { income: 0, expense: 0 };
        existing.income += sale.total;

        // Calculate cost of goods sold for this sale
        const saleCost = sale.items.reduce((itemSum, item) => {
          const part = parts.find((p) => p.id === item.partId);
          const costPrice = part?.wholesalePrice?.[currentBranchId] || 0;
          return itemSum + costPrice * item.quantity;
        }, 0);
        existing.expense += saleCost;

        financialMap.set(date, existing);
      });

    // Add work order income and COGS
    workOrders
      .filter((wo) => {
        const woDate = new Date(wo.creationDate);
        const isCompleted = wo.status === "Trả máy" ||
          wo.paymentStatus === "paid" ||
          wo.paymentStatus === "partial" ||
          (wo.totalPaid && wo.totalPaid > 0);
        return woDate >= cutoffDate && isCompleted && !wo.refunded;
      })
      .forEach((wo) => {
        const date = wo.creationDate.slice(0, 10);
        const existing = financialMap.get(date) || { income: 0, expense: 0 };
        existing.income += wo.totalPaid || wo.total || 0;

        // Calculate COGS for work order
        const partsCost = (wo.partsUsed || []).reduce((partSum, woPart) => {
          const part = parts.find((p) => p.id === woPart.partId);
          const costPrice = part?.wholesalePrice?.[currentBranchId] || 0;
          return partSum + costPrice * woPart.quantity;
        }, 0);
        const servicesCost = (wo.additionalServices || []).reduce(
          (svcSum, svc) => svcSum + (svc.costPrice || 0) * svc.quantity,
          0
        );
        existing.expense += partsCost + servicesCost;

        financialMap.set(date, existing);
      });

    return Array.from(financialMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by ISO date string (YYYY-MM-DD)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        income: Math.round(data.income),
        expense: Math.round(data.expense),
        profit: Math.round(data.income - data.expense),
      }))
      .slice(-30);
  }, [sales, workOrders, parts, currentBranchId, timeRange]);

  // Customer debts summary
  const customerDebtStats = useMemo(() => {
    const totalDebt = customerDebts.reduce(
      (sum, d) => sum + d.remainingAmount,
      0
    );
    const overdueCount = customerDebts.filter((d) => {
      return d.remainingAmount > 0;
    }).length;

    return { totalDebt, overdueCount, count: customerDebts.length };
  }, [customerDebts]);

  // Supplier debts summary
  const supplierDebtStats = useMemo(() => {
    const totalDebt = supplierDebts.reduce(
      (sum, d) => sum + d.remainingAmount,
      0
    );
    const overdueCount = supplierDebts.filter((d) => {
      return d.remainingAmount > 0;
    }).length;

    return { totalDebt, overdueCount, count: supplierDebts.length };
  }, [supplierDebts]);

  // Top customers by debt
  const topDebtors = useMemo(() => {
    return [...customerDebts]
      .filter((d) => d.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount)
      .slice(0, 5);
  }, [customerDebts]);

  // Inventory value
  const inventoryValue = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock[currentBranchId] || 0;
      const price = part.retailPrice[currentBranchId] || 0;
      return sum + stock * price;
    }, 0);
  }, [parts, currentBranchId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex gap-1.5">
        {(
          [
            { value: "7days", label: "7 ngày" },
            { value: "30days", label: "30 ngày" },
            { value: "90days", label: "90 ngày" },
            { value: "all", label: "Tất cả" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            onClick={() => setTimeRange(option.value)}
            className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${timeRange === option.value
              ? "bg-blue-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            Thu nhập
          </div>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
            {formatCurrency(totalIncome)}
          </div>
          <div className="text-[10px] mt-1 text-emerald-600 dark:text-emerald-400">
            Bán hàng: {formatCurrency(salesIncome)} | Sửa chữa: {formatCurrency(workOrderIncome)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
          <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
            Chi phí (Giá vốn)
          </div>
          <div className="text-2xl font-bold text-red-900 dark:text-red-100">
            {formatCurrency(totalCOGS)}
          </div>
          <div className="text-[10px] mt-1 text-red-600 dark:text-red-400">
            Bán hàng: {formatCurrency(salesCOGS)} | Sửa chữa: {formatCurrency(workOrderCOGS)}
          </div>
        </div>

        <div
          className={`bg-gradient-to-br p-4 rounded-lg border ${netProfit >= 0
            ? "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700"
            : "from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700"
            }`}
        >
          <div
            className={`text-xs font-medium mb-1 ${netProfit >= 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-red-600 dark:text-red-400"
              }`}
          >
            Lợi nhuận
          </div>
          <div
            className={`text-2xl font-bold ${netProfit >= 0
              ? "text-blue-900 dark:text-blue-100"
              : "text-red-900 dark:text-red-100"
              }`}
          >
            {formatCurrency(netProfit)}
          </div>
          <div
            className={`text-[10px] mt-0.5 ${netProfit >= 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-red-600 dark:text-red-400"
              }`}
          >
            Biên lợi nhuận: {profitMargin.toFixed(1)}%
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">
            Giá trị tồn kho
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {formatCurrency(inventoryValue)}
          </div>
        </div>
      </div>

      {/* Income vs Expense Chart */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
          Thu - Chi - Lợi nhuận
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={dailyFinancials}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend />
            <Bar dataKey="income" fill="#10b981" name="Thu nhập" />
            <Bar dataKey="expense" fill="#ef4444" name="Chi phí" />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Lợi nhuận"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Debts Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Customer Debts */}
        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Công nợ khách hàng
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
              <div>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Tổng công nợ
                </div>
                <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {formatCurrency(customerDebtStats.totalDebt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  Quá hạn
                </div>
                <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
                  {customerDebtStats.overdueCount}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Top 5 khách nợ nhiều nhất
              </div>
              <div className="space-y-1.5">
                {topDebtors.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {debt.customerName}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">
                        Ngày tạo:{" "}
                        {new Date(debt.createdDate).toLocaleDateString("vi-VN")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(debt.remainingAmount)}
                      </div>
                    </div>
                  </div>
                ))}
                {topDebtors.length === 0 && (
                  <div className="text-center py-3 text-slate-600 dark:text-slate-400 inline-flex items-center justify-center gap-2 text-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Không có công nợ
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Debts */}
        <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Công nợ nhà cung cấp
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
              <div>
                <div className="text-xs text-red-600 dark:text-red-400">
                  Tổng công nợ
                </div>
                <div className="text-xl font-bold text-red-900 dark:text-red-100">
                  {formatCurrency(supplierDebtStats.totalDebt)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-red-600 dark:text-red-400">
                  Quá hạn
                </div>
                <div className="text-xl font-bold text-red-900 dark:text-red-100">
                  {supplierDebtStats.overdueCount}
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1.5 inline-flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M11 2a1 1 0 011 1v1.07A7.002 7.002 0 0119 11a6.97 6.97 0 01-2.05 4.95A3.5 3.5 0 0014 19.5V20a1 1 0 11-2 0v-.5a3.5 3.5 0 00-2.95-3.45A6.97 6.97 0 017 11a7.002 7.002 0 016-6.93V3a1 1 0 011-1z" />
                  <path d="M13 22a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                Mẹo quản lý tài chính
              </div>
              <ul className="text-[10px] text-blue-700 dark:text-blue-300 space-y-0.5">
                <li>• Theo dõi biên lợi nhuận hàng tháng</li>
                <li>• Giữ tồn kho ở mức hợp lý</li>
                <li>• Thu hồi công nợ đúng hạn</li>
                <li>• Đàm phán điều khoản với nhà cung cấp</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                  Khách hàng nợ
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {customerDebtStats.count}
                </div>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
                <div className="text-[10px] text-slate-600 dark:text-slate-400">
                  NCC cần trả
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {supplierDebtStats.count}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialAnalytics;
