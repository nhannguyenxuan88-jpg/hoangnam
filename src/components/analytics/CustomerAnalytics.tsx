import React, { useMemo, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";
import { Users, UserCheck, UserPlus, Award, Clock, AlertTriangle, TrendingUp, Zap, RefreshCw } from "lucide-react";

type TimeRange = "7days" | "30days" | "90days" | "all";

interface CustomerAnalyticsProps {
    customers: any[];
    sales: any[];
    workOrders: any[];
    parts: any[];
    currentBranchId: string;
}

const CustomerAnalytics: React.FC<CustomerAnalyticsProps> = ({
    customers,
    sales,
    workOrders,
    parts,
    currentBranchId
}) => {
    const [timeRange, setTimeRange] = useState<TimeRange>("30days");
    const isLoading = false;

    const { filteredSales, filteredWorkOrders } = useMemo(() => {
        if (timeRange === "all") return { filteredSales: sales, filteredWorkOrders: workOrders };

        const now = new Date();
        const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
        const cutoff = new Date(now.setDate(now.getDate() - days));

        return {
            filteredSales: sales.filter(s => new Date(s.date) >= cutoff),
            filteredWorkOrders: workOrders.filter(wo => new Date(wo.creationDate || wo.creationdate) >= cutoff)
        };
    }, [sales, workOrders, timeRange]);

    // Helper Map (Phone -> ID)
    const phoneToIdMap = useMemo(() => {
        const map = new Map<string, string>();
        customers.forEach(c => {
            if (c.phone) map.set(c.phone, c.id);
        });
        return map;
    }, [customers]);

    // Calculate Metrics
    const metrics = useMemo(() => {
        // Unique Customers in Period
        const activeCustomerIds = new Set<string>();

        filteredSales.forEach((s) => {
            if (s.customer?.id) activeCustomerIds.add(s.customer.id);
        });

        filteredWorkOrders.forEach((w) => {
            // Try to match Work Order to Customer ID via Phone
            // If not found, use Phone as unique identifier
            // If no phone, use Name + LicensePlate as identifier
            const phone = w.customerPhone;
            if (phone) {
                const id = phoneToIdMap.get(phone);
                if (id) activeCustomerIds.add(id);
                else activeCustomerIds.add(phone);
            } else {
                // Fallback for walk-ins without phone
                const key = `${w.customerName}-${w.licensePlate || ''}`;
                activeCustomerIds.add(key);
            }
        });

        // Total Revenue in Period (to calc CLV/Avg Value)
        const totalRevenue =
            filteredSales.reduce((sum, s) => sum + s.total, 0) +
            filteredWorkOrders.reduce((sum, w) => sum + (w.totalPaid || w.total || 0), 0);

        const averageValuePerUser = activeCustomerIds.size > 0
            ? totalRevenue / activeCustomerIds.size
            : 0;

        return {
            activeCount: activeCustomerIds.size,
            totalRevenue,
            averageValuePerUser
        };
    }, [filteredSales, filteredWorkOrders, phoneToIdMap]);

    // Segmentation & Retention Logic (Uses GLOBAL history, not just filtered)
    const customerStats = useMemo(() => {
        const stats = new Map<string, {
            visitCount: number;
            totalSpent: number;
            firstVisit: Date;
            lastVisit: Date;
            name: string;
            phone?: string;
        }>();

        // Helper to process transactions
        const process = (customerId: string, date: string, amount: number, name: string, phone?: string) => {
            if (!customerId) return;
            const d = new Date(date);
            const existing = stats.get(customerId) || {
                visitCount: 0,
                totalSpent: 0,
                firstVisit: d,
                lastVisit: d,
                name,
                phone
            };

            existing.visitCount += 1;
            existing.totalSpent += amount;
            if (d < existing.firstVisit) existing.firstVisit = d;
            if (d > existing.lastVisit) existing.lastVisit = d;

            stats.set(customerId, existing);
        };

        // Process ALL history for accurate classification
        sales.forEach(s => {
            if (s.customer?.id) process(s.customer.id, s.date, s.total, s.customer.name, s.customer.phone);
        });

        workOrders.forEach(w => {
            if (w.status === "Đã hủy") return;

            let id = "";
            if (w.customerPhone) {
                id = phoneToIdMap.get(w.customerPhone) || w.customerPhone;
            } else {
                id = `${w.customerName}-${w.licensePlate || ''}`;
            }

            process(id, w.creationDate, w.totalPaid || w.total || 0, w.customerName, w.customerPhone);
        });

        // Classify
        let returningCount = 0;
        let newCount = 0;
        let vipCount = 0;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const segmentationData = [
            { name: "Khách mới", value: 0, color: "#3b82f6" }, // Blue
            { name: "Khách quen", value: 0, color: "#10b981" }, // Green
            { name: "VIP", value: 0, color: "#f59e0b" }, // Amber
        ];

        const maintenanceList: any[] = [];
        const churnList: any[] = [];

        const list = Array.from(stats.entries()).map(([id, data]) => {
            const isNew = data.firstVisit >= thirtyDaysAgo;
            const isReturning = data.visitCount > 1;
            const isVIP = data.totalSpent >= 5000000 || data.visitCount >= 5;

            if (isVIP) {
                vipCount++;
                segmentationData[2].value++;
            } else if (isReturning) {
                returningCount++;
                segmentationData[1].value++;
            } else {
                newCount++;
                segmentationData[0].value++;
            }

            const customerObj = { id, ...data, isVIP, isReturning, isNew };

            // Insights Logic
            const daysSinceLastVisit = (now.getTime() - data.lastVisit.getTime()) / (1000 * 60 * 60 * 24);

            // Maintenance: Returning/VIP customer, last visit 90-120 days ago
            if ((isVIP || isReturning) && daysSinceLastVisit >= 90 && daysSinceLastVisit <= 120) {
                maintenanceList.push(customerObj);
            }

            // Churn: VIP inactive for > 150 days
            if (isVIP && daysSinceLastVisit > 150) {
                churnList.push(customerObj);
            }

            return customerObj;
        });

        return {
            list,
            returningRate: list.length > 0 ? (returningCount + vipCount) / list.length * 100 : 0,
            vipCount,
            newCount,
            segmentationData: segmentationData.filter(d => d.value > 0),
            maintenanceList: maintenanceList.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
            churnList: churnList.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5)
        };
    }, [sales, workOrders]);

    // Product Association Analysis (Upsell/Cross-sell)
    const associations = useMemo(() => {
        const pairFreq = new Map<string, { count: number; partA: string; partB: string }>();

        const processItems = (items: { partId: string; name?: string }[]) => {
            if (items.length < 2) return;
            const uniqueIds = [...new Set(items.map(i => i.partId))].sort();

            for (let i = 0; i < uniqueIds.length; i++) {
                for (let j = i + 1; j < uniqueIds.length; j++) {
                    const key = `${uniqueIds[i]}|${uniqueIds[j]}`;
                    const entry = pairFreq.get(key) || { count: 0, partA: uniqueIds[i], partB: uniqueIds[j] };
                    entry.count++;
                    pairFreq.set(key, entry);
                }
            }
        };

        sales.forEach(s => processItems(s.items));
        workOrders.forEach(w => {
            if (w.status === "Đã hủy" || !w.partsUsed) return;
            processItems(w.partsUsed);
        });

        return Array.from(pairFreq.values())
            .map(p => ({
                ...p,
                nameA: parts.find(it => it.id === p.partA)?.name || "Sản phẩm A",
                nameB: parts.find(it => it.id === p.partB)?.name || "Sản phẩm B",
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [sales, workOrders, parts]);

    // Top Lists
    const topSpenders = useMemo(() => {
        return [...customerStats.list]
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 10);
    }, [customerStats.list]);

    const mostFrequent = useMemo(() => {
        return [...customerStats.list]
            .sort((a, b) => b.visitCount - a.visitCount)
            .slice(0, 10);
    }, [customerStats.list]);


    return (
        <div className="space-y-6">
            {/* Time Range Selector */}
            <div className="flex gap-2">
                {(["7days", "30days", "90days", "all"] as const).map((range) => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${timeRange === range
                                ? "bg-indigo-600 text-white"
                                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                    >
                        {range === "7days" && "7 ngày"}
                        {range === "30days" && "30 ngày"}
                        {range === "90days" && "3 tháng"}
                        {range === "all" && "Tất cả"}
                    </button>
                ))}
            </div>
            {/* 1. Header & Controls */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    {/* Title handled by parent tab but nice to have summary here if needed */}
                </div>
            </div>

            {/* 2. Key Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Active Customers */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                            <Users size={20} />
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Khách hàng hoạt động</div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {metrics.activeCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Trong kỳ đã chọn
                    </div>
                </div>

                {/* Retention Rate */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                            <UserCheck size={20} />
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Tỷ lệ quay lại</div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {customerStats.returningRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Trên tổng số khách hàng
                    </div>
                </div>

                {/* Average Value */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                            <Award size={20} />
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Giá trị trung bình/Khách</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {formatCurrency(metrics.averageValuePerUser)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Doanh thu chia đều (CLV ngắn hạn)
                    </div>
                </div>

                {/* VIP Count */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                            <UserPlus size={20} />
                        </div>
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Khách hàng VIP</div>
                    </div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {customerStats.vipCount}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Chi trên 5tr hoặc &gt; 5 lần ghé
                    </div>
                </div>
            </div>

            {/* 3. Charts & Lists Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Segmentation Chart */}
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-6">Phân loại khách hàng</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={customerStats.segmentationData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {customerStats.segmentationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [value, 'Khách hàng']}
                                    contentStyle={{
                                        backgroundColor: "rgba(255, 255, 255, 0.9)",
                                        borderRadius: "8px",
                                        border: "none",
                                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Spenders List */}
                <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Top khách hàng chi tiêu cao (VIP)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Khách hàng</th>
                                    <th className="px-4 py-3 text-center">Số lần ghé</th>
                                    <th className="px-4 py-3 text-right">Tổng chi tiêu</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">Lần cuối</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topSpenders.map((c, idx) => (
                                    <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <div>{c.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-normal">{c.phone || "Không SĐT"}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                                            {c.visitCount}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatCurrency(c.totalSpent)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500">
                                            {c.lastVisit.toLocaleDateString('vi-VN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* 4. Advanced Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Maintenance & Churn */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Maintenance Forecast */}
                    <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Clock size={16} className="text-blue-500" />
                                Dự báo bảo dưỡng (90-120 ngày)
                            </h3>
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium">Gợi ý nhắc lịch</span>
                        </div>
                        <div className="space-y-3">
                            {customerStats.maintenanceList.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs italic">Không có khách hàng trong diện bảo trì định kỳ.</div>
                            ) : (
                                customerStats.maintenanceList.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30">
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{c.name}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">{c.phone} • Lần cuối: {c.lastVisit.toLocaleDateString('vi-VN')}</div>
                                        </div>
                                        <button className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-800 text-blue-600 transition-colors shadow-sm border border-blue-100 dark:border-blue-800">
                                            <Zap size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Churn Warning */}
                    <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-500" />
                                Cảnh báo khách rớt (Churn &gt; 150 ngày)
                            </h3>
                            <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-medium">Khách VIP ngưng ghé</span>
                        </div>
                        <div className="space-y-3">
                            {customerStats.churnList.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs italic">Chưa phát hiện khách VIP nào ngưng ghé lâu ngày.</div>
                            ) : (
                                customerStats.churnList.map(c => (
                                    <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-800/30">
                                        <div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{c.name}</div>
                                            <div className="text-[10px] text-slate-500 font-medium">Chi tiêu: {formatCurrency(c.totalSpent)} • {Math.floor((new Date().getTime() - c.lastVisit.getTime()) / (1000 * 60 * 60 * 24))} ngày chưa ghé</div>
                                        </div>
                                        <button className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-800 text-red-600 transition-colors shadow-sm border border-red-100 dark:border-red-800">
                                            <RefreshCw size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Product Association (Upsell) */}
                <div className="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" />
                            Ghi chú bán thêm (Upsell/Cross-sell)
                        </h3>
                    </div>
                    <div className="space-y-4">
                        {associations.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic">Chưa đủ dữ liệu để phân tích cặp sản phẩm.</div>
                        ) : (
                            associations.map((pair, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-[10px]">{idx + 1}</div>
                                        Cặp sản phẩm phổ biến
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">{pair.nameA}</div>
                                        <div className="flex items-center gap-2 text-[9px] text-slate-400 mb-1 pl-4 uppercase tracking-wider font-bold">
                                            <div className="w-px h-2 bg-slate-300 dark:bg-slate-600"></div>
                                            thường đi kèm với
                                        </div>
                                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{pair.nameB}</div>
                                        <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full inline-block">
                                            {pair.count} đơn hàng cùng nhau
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerAnalytics;
