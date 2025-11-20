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
  Area,
  AreaChart,
} from "recharts";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";

type TimeRange = "7days" | "30days" | "90days" | "all";

import { useSalesRepo } from "../../hooks/useSalesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";

const SalesAnalytics: React.FC = () => {
  const { currentBranchId } = useAppContext();
  const { data: sales = [], isLoading: salesLoading } = useSalesRepo();
  const { data: parts = [], isLoading: partsLoading } = usePartsRepo();
  const [timeRange, setTimeRange] = useState<TimeRange>("30days");

  const isLoading = salesLoading || partsLoading;

  // Filter sales by time range
  const filteredSales = useMemo(() => {
    if (timeRange === "all") return sales;

    const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sales.filter((sale) => new Date(sale.date) >= cutoffDate);
  }, [sales, timeRange]);

  // Summary stats
  const stats = useMemo(() => {
    const totalRevenue = filteredSales.reduce(
      (sum, sale) => sum + sale.total,
      0
    );
    const totalOrders = filteredSales.length;
    const totalItems = filteredSales.reduce(
      (sum, sale) => sum + sale.items.reduce((s, item) => s + item.quantity, 0),
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalItems,
      avgOrderValue,
    };
  }, [filteredSales]);

  // Daily revenue
  const dailyRevenue = useMemo(() => {
    const revenueByDate = new Map<string, number>();

    filteredSales.forEach((sale) => {
      const date = sale.date.slice(0, 10);
      revenueByDate.set(date, (revenueByDate.get(date) || 0) + sale.total);
    });

    return Array.from(revenueByDate.entries())
      .map(([date, revenue]) => ({
        date: new Date(date).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        revenue: Math.round(revenue),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 data points
  }, [filteredSales]);

  // Top selling products
  const topProducts = useMemo(() => {
    const productSales = new Map<
      string,
      { quantity: number; revenue: number; partName: string }
    >();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = productSales.get(item.partId);
        const part = parts.find((p) => p.id === item.partId);
        const partName = part?.name || "Sản phẩm không xác định";

        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.sellingPrice * item.quantity;
        } else {
          productSales.set(item.partId, {
            quantity: item.quantity,
            revenue: item.sellingPrice * item.quantity,
            partName,
          });
        }
      });
    });

    return Array.from(productSales.entries())
      .map(([id, data]) => ({
        id,
        name: data.partName,
        quantity: data.quantity,
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredSales, parts]);

  // Sales by payment method
  const paymentMethodData = useMemo(() => {
    const methodMap = new Map<string, number>();

    filteredSales.forEach((sale) => {
      methodMap.set(
        sale.paymentMethod,
        (methodMap.get(sale.paymentMethod) || 0) + sale.total
      );
    });

    return Array.from(methodMap.entries())
      .map(([method, revenue]) => ({
        method,
        revenue: Math.round(revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Hourly distribution
  const hourlyDistribution = useMemo(() => {
    const hourMap = new Map<number, number>();

    filteredSales.forEach((sale) => {
      const hour = new Date(sale.date).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}h`,
      orders: hourMap.get(i) || 0,
    }));
  }, [filteredSales]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex gap-2">
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
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${timeRange === option.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
            Doanh thu
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            {formatCurrency(stats.totalRevenue)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700">
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
            Đơn hàng
          </div>
          <div className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">
            {stats.totalOrders}
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-6 rounded-lg border border-amber-200 dark:border-amber-700">
          <div className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
            Sản phẩm bán
          </div>
          <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
            {stats.totalItems}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
          <div className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
            Giá trị TB/đơn
          </div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
            {formatCurrency(stats.avgOrderValue)}
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Xu hướng doanh thu
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyRevenue}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Phương thức thanh toán
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentMethodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="method" stroke="#94a3b8" />
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
              <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Phân bố theo giờ
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hourlyDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.95)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#f59e0b"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Top 10 sản phẩm bán chạy
          </h3>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {product.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Đã bán: {product.quantity}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(product.revenue)}
                  </div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                Chưa có dữ liệu bán hàng
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesAnalytics;
