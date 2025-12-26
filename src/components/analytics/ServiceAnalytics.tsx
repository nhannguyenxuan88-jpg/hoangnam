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
    Cell,
} from "recharts";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";

type TimeRange = "7days" | "30days" | "90days" | "all";

interface ServiceAnalyticsProps {
    workOrders: any[];
    currentBranchId: string;
}

const ServiceAnalytics: React.FC<ServiceAnalyticsProps> = ({
    workOrders,
    currentBranchId
}) => {
    const [timeRange, setTimeRange] = useState<TimeRange>("30days");
    const isLoading = false;

    // Filter by Time Range
    const filteredOrders = useMemo(() => {
        if (timeRange === "all") return workOrders;
        const now = new Date();
        const days = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
        const cutoff = new Date(now.setDate(now.getDate() - days));
        return workOrders.filter(wo => {
            const d = new Date(wo.creationDate || wo.creationdate);
            return d >= cutoff;
        });
    }, [workOrders, timeRange]);

    // --- Statistics ---

    // Technician Performance
    const technicianStats = useMemo(() => {
        const techMap = new Map<string, { revenue: number; count: number }>();

        filteredOrders.forEach((wo) => {
            // Only count completed/paid orders for revenue accuracy
            const isValid = wo.status === "Trả máy" ||
                wo.paymentStatus === "paid" ||
                wo.paymentStatus === "partial" ||
                (wo.totalPaid && wo.totalPaid > 0);

            if (!isValid || wo.refunded) return;

            const techName = wo.technicianName || "Chưa phân công";
            const existing = techMap.get(techName) || { revenue: 0, count: 0 };

            // Use totalPaid or total
            const income = wo.totalPaid || wo.total || 0;

            existing.revenue += income;
            existing.count += 1;
            techMap.set(techName, existing);
        });

        return Array.from(techMap.entries())
            .map(([name, data]) => ({
                name,
                revenue: Math.round(data.revenue),
                count: data.count,
                avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0
            }))
            .sort((a, b) => b.revenue - a.revenue);

    }, [filteredOrders]);

    // Vehicle Model Analysis
    const vehicleStats = useMemo(() => {
        const vehicleMap = new Map<string, { count: number; revenue: number }>();

        filteredOrders.forEach((wo) => {
            // Only count completed/paid orders
            const isValid = wo.status === "Trả máy" ||
                wo.paymentStatus === "paid" ||
                wo.paymentStatus === "partial" ||
                (wo.totalPaid && wo.totalPaid > 0);

            if (!isValid || wo.refunded) return;

            // Use joined vehicleModel or fallback to manual string
            const model = wo.vehicleModel || "Không xác định";
            const existing = vehicleMap.get(model) || { count: 0, revenue: 0 };

            const income = wo.totalPaid || wo.total || 0;

            existing.count += 1;
            existing.revenue += income;
            vehicleMap.set(model, existing);
        });

        return Array.from(vehicleMap.entries())
            .map(([name, data]) => ({
                name,
                count: data.count,
                revenue: Math.round(data.revenue)
            }))
            .sort((a, b) => b.count - a.count) // Sort by popularity (count)
            .slice(0, 10); // Top 10

    }, [filteredOrders]);

    // KPIs
    const totalServiceRevenue = technicianStats.reduce((sum, t) => sum + t.revenue, 0);
    const totalServiceTickets = technicianStats.reduce((sum, t) => sum + t.count, 0);
    const avgServiceTicket = totalServiceTickets > 0 ? totalServiceRevenue / totalServiceTickets : 0;
    const activeTechs = technicianStats.length;

    const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];


    return (
        <div className="space-y-4">
            {/* Time Range Selector */}
            <div className="flex gap-2 mb-4">
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
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                    <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                        Doanh thu Dịch vụ
                    </div>
                    <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                        {formatCurrency(totalServiceRevenue)}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 p-4 rounded-lg border border-cyan-200 dark:border-cyan-700">
                    <div className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mb-1">
                        Số lượng xe (Phiếu)
                    </div>
                    <div className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                        {totalServiceTickets}
                    </div>
                    <div className="text-[10px] text-cyan-700 dark:text-cyan-300 mt-0.5">
                        {activeTechs} thợ hoạt động
                    </div>
                </div>

                <div className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 p-4 rounded-lg border border-violet-200 dark:border-violet-700">
                    <div className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
                        Giá trị trung bình/Phiếu
                    </div>
                    <div className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                        {formatCurrency(avgServiceTicket)}
                    </div>
                </div>
            </div>

            {/* Charts Row 1: Technician Performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Tech Revenue */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        Doanh thu theo Thợ
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            layout="vertical"
                            data={technicianStats}
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={100}
                                stroke="#94a3b8"
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                                    border: "none",
                                    borderRadius: "8px",
                                    color: "#fff",
                                }}
                            />
                            <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} name="Doanh thu">
                                {technicianStats.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Tech Ticket Count */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        Số lượng xe tiếp nhận theo Thợ
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={technicianStats}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} interval={0} angle={-15} textAnchor="end" height={60} />
                            <YAxis stroke="#94a3b8" allowDecimals={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                                    border: "none",
                                    borderRadius: "8px",
                                    color: "#fff",
                                }}
                            />
                            <Bar dataKey="count" name="Số xe" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2: Vehicle Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Vehicle Models */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        Top dòng xe hay sửa
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            layout="vertical"
                            data={vehicleStats}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={100}
                                stroke="#94a3b8"
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [value, name === 'revenue' ? 'Doanh thu' : 'Số lượt']}
                                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                contentStyle={{
                                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                                    border: "none",
                                    borderRadius: "8px",
                                    color: "#fff",
                                }}
                            />
                            <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} name="Số lượt" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Vehicle Stats Table */}
                <div className="bg-white dark:bg-[#1e293b] p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                        Chi tiết theo dòng xe
                    </h3>
                    <div className="overflow-auto max-h-[300px]">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">Dòng xe</th>
                                    <th className="px-3 py-2 text-right font-medium">Số lượt</th>
                                    <th className="px-3 py-2 text-right font-medium">Doanh thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {vehicleStats.map((vehicle) => (
                                    <tr key={vehicle.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{vehicle.name}</td>
                                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{vehicle.count}</td>
                                        <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(vehicle.revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ServiceAnalytics;
