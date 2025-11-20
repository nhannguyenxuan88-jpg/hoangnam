import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { useAppContext } from "../../contexts/AppContext";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useInventoryTxRepo } from "../../hooks/useInventoryTransactionsRepository";
import { formatCurrency } from "../../utils/format";

const InventoryAnalytics: React.FC = () => {
  const { currentBranchId } = useAppContext();
  const { data: parts = [], isLoading: partsLoading } = usePartsRepo();
  const { data: inventoryTransactions = [], isLoading: txLoading } = useInventoryTxRepo();

  const isLoading = partsLoading || txLoading;

  // Stock value by category
  const categoryData = useMemo(() => {
    const categoryMap = new Map<
      string,
      { value: number; count: number; stock: number }
    >();

    parts.forEach((part) => {
      const category = part.category || "Không phân loại";
      const stock = part.stock[currentBranchId] || 0;
      const price = part.retailPrice[currentBranchId] || 0;
      const value = stock * price;

      const existing = categoryMap.get(category);
      if (existing) {
        existing.value += value;
        existing.count += 1;
        existing.stock += stock;
      } else {
        categoryMap.set(category, { value, count: 1, stock });
      }
    });

    return Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        value: Math.round(data.value),
        count: data.count,
        stock: data.stock,
      }))
      .sort((a, b) => b.value - a.value);
  }, [parts, currentBranchId]);

  // Low stock alerts
  const lowStockItems = useMemo(() => {
    return parts
      .filter((p) => {
        const stock = p.stock[currentBranchId] || 0;
        return stock > 0 && stock <= 10;
      })
      .sort((a, b) => {
        const stockA = a.stock[currentBranchId] || 0;
        const stockB = b.stock[currentBranchId] || 0;
        return stockA - stockB;
      })
      .slice(0, 10);
  }, [parts, currentBranchId]);

  // Out of stock
  const outOfStockCount = useMemo(() => {
    return parts.filter((p) => (p.stock[currentBranchId] || 0) === 0).length;
  }, [parts, currentBranchId]);

  // Top value items
  const topValueItems = useMemo(() => {
    return parts
      .map((part) => {
        const stock = part.stock[currentBranchId] || 0;
        const price = part.retailPrice[currentBranchId] || 0;
        return {
          ...part,
          totalValue: stock * price,
        };
      })
      .filter((p) => p.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [parts, currentBranchId]);

  // Total inventory value
  const totalInventoryValue = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock[currentBranchId] || 0;
      const price = part.retailPrice[currentBranchId] || 0;
      return sum + stock * price;
    }, 0);
  }, [parts, currentBranchId]);

  // Total Inventory Quantity (Sum of all stock)
  const totalInventoryQty = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock[currentBranchId] || 0;
      return sum + stock;
    }, 0);
  }, [parts, currentBranchId]);

  // Recent transactions (last 30 days)
  const recentTransactions = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const txByDate = new Map<string, { in: number; out: number }>();

    inventoryTransactions
      .filter((tx) => new Date(tx.date) >= thirtyDaysAgo)
      .forEach((tx) => {
        const date = tx.date.slice(0, 10);
        const existing = txByDate.get(date) || { in: 0, out: 0 };

        if (tx.type === "Nhập kho") {
          existing.in += tx.quantity;
        } else {
          existing.out += tx.quantity;
        }

        txByDate.set(date, existing);
      });

    return Array.from(txByDate.entries())
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        "Nhập kho": data.in,
        "Xuất kho": data.out,
      }))
      .slice(-14); // Last 14 days
  }, [inventoryTransactions]);

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
            Tổng giá trị tồn kho
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(totalInventoryValue)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700">
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
            Tổng SL tồn kho
          </div>
          <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {totalInventoryQty}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
            {parts.length} mã sản phẩm
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-6 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
            Sắp hết hàng
          </div>
          <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
            {lowStockItems.length}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-lg border border-red-200 dark:border-red-700">
          <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
            Hết hàng
          </div>
          <div className="text-3xl font-bold text-red-900 dark:text-red-100">
            {outOfStockCount}
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Giá trị theo danh mục
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) =>
                  `${props.name}: ${(props.percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Inventory Transactions */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Nhập/Xuất kho (14 ngày gần nhất)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={recentTransactions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Nhập kho"
                stroke="#10b981"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Xuất kho"
                stroke="#ef4444"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Value Items */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Top 10 sản phẩm giá trị cao
          </h3>
          <div className="space-y-3">
            {topValueItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Tồn: {item.stock[currentBranchId] || 0}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(item.totalValue)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {formatCurrency(item.retailPrice[currentBranchId] || 0)}/sp
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span className="inline-flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                />
              </svg>
            </span>
            Cảnh báo tồn kho thấp
          </h3>
          <div className="space-y-3">
            {lowStockItems.map((item) => {
              const stock = item.stock[currentBranchId] || 0;
              const level =
                stock <= 3 ? "critical" : stock <= 5 ? "warning" : "low";

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${level === "critical"
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                    : level === "warning"
                      ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                      : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                    }`}
                >
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      SKU: {item.sku}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${level === "critical"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                        : level === "warning"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                        }`}
                    >
                      {stock} còn lại
                    </div>
                  </div>
                </div>
              );
            })}
            {lowStockItems.length === 0 && (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-green-500"
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
                Tất cả sản phẩm đều còn đủ hàng
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAnalytics;
