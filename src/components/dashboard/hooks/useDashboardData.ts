import { useMemo } from "react";
import { useSalesRepo } from "../../../hooks/useSalesRepository";
import { useWorkOrdersRepo } from "../../../hooks/useWorkOrdersRepository";
import { usePartsRepo } from "../../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../../hooks/useCashTransactionsRepository";
import { useCashBalance } from "../../../hooks/useCashBalance";
import { useLoansRepo } from "../../../hooks/useLoansRepository";
import { useAppContext } from "../../../contexts/AppContext";
import type { Part } from "../../../types";

// Các category phiếu thu KHÔNG tính vào doanh thu (vì đã tính trong Sales/WO)
const excludedIncomeCategories = [
    "doanh thu bán hàng",
    "sales",
    "dịch vụ sửa chữa",
    "bán hàng",
    "service_income", // Thu từ phiếu sửa chữa
    "service_deposit", // Đặt cọc dịch vụ
    "service", // Dịch vụ chung
];

// Các category phiếu chi KHÔNG tính vào lợi nhuận (vì đã tính trong giá vốn)
const excludedExpenseCategories = [
    "supplier_payment", // Chi trả NCC (nhập kho) - đã tính trong giá vốn hàng bán
    "nhập kho",
    "nhập hàng",
    "goods_receipt",
    "import",
    "outsourcing",      // Chi gia công bên ngoài - đã tính trong lợi nhuận phiếu SC
    "service_cost",     // Chi phí dịch vụ - đã tính trong lợi nhuận phiếu SC
    "refund",           // Hoàn trả - không phải chi phí thực tế
];

// Helper function để check exclude với case-insensitive
const isExcludedIncomeCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedIncomeCategories.some((exc) => exc.toLowerCase() === lowerCat);
};

// Helper function để check exclude expense categories
const isExcludedExpenseCategory = (category: string | undefined | null) => {
    if (!category) return false;
    const lowerCat = category.toLowerCase().trim();
    return excludedExpenseCategories.some(
        (exc) => exc.toLowerCase() === lowerCat
    );
};

export const useDashboardData = (
    reportFilter: string,
    selectedMonth?: number,
    selectedQuarter?: number
) => {
    const { data: sales = [] } = useSalesRepo();
    const { data: workOrders = [] } = useWorkOrdersRepo();
    const { data: parts = [] } = usePartsRepo();
    const { data: cashTransactions = [] } = useCashTxRepo();
    const { cashBalance, bankBalance } = useCashBalance();
    const { data: loans = [] } = useLoansRepo();
    const { currentBranchId } = useAppContext();

    const today = new Date().toISOString().slice(0, 10);

    // Build parts cost lookup map
    const { getPartCost } = useMemo(() => {
        const map = new Map<string, number>();
        parts.forEach((part: Part) => {
            const costPrice = part.costPrice?.[currentBranchId] || 0;
            map.set(part.id, costPrice);
            map.set(part.sku, costPrice); // Also lookup by SKU
        });

        const getPartCost = (
            partId: string,
            sku: string,
            fallbackCost: number
        ) => {
            // Priority: Historical value (fallbackCost) > Current master value > 0
            if (fallbackCost && fallbackCost > 0) return fallbackCost;
            return map.get(partId) || map.get(sku) || 0;
        };

        return { getPartCost };
    }, [parts, currentBranchId]);

    // Thống kê hôm nay (bao gồm cả Sales và Work Orders đã thanh toán)
    const todayStats = useMemo(() => {
        // Sales revenue
        const todaySales = sales.filter((s) => s.date.slice(0, 10) === today);
        const salesRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
        const salesProfit = todaySales.reduce((sum, s) => {
            const cost = s.items.reduce((c, it) => {
                const partCost = getPartCost(
                    it.partId,
                    it.sku,
                    (it as any).costPrice || 0
                );
                return c + partCost * it.quantity;
            }, 0);
            return sum + (s.total - cost);
        }, 0);

        // Work Orders revenue (chỉ tính những đơn đã thanh toán - paid hoặc partial)
        const todayWorkOrders = workOrders.filter((wo: any) => {
            // Dùng creationDate để xác định đơn trong ngày
            const woDate =
                wo.creationDate?.slice(0, 10) || wo.creationdate?.slice(0, 10);
            const isPaid =
                wo.paymentStatus === "paid" ||
                wo.paymentstatus === "paid" ||
                wo.paymentStatus === "partial" ||
                wo.paymentstatus === "partial";
            return woDate === today && isPaid;
        });
        const woRevenue = todayWorkOrders.reduce(
            (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
            0
        );
        const woProfit = todayWorkOrders.reduce((sum, wo: any) => {
            const partsCost = (wo.partsUsed || wo.partsused || []).reduce(
                (c: number, p: any) => {
                    const partId = p.partId || p.partid;
                    const sku = p.sku;
                    const cost = getPartCost(
                        partId,
                        sku,
                        p.costPrice || p.costprice || 0
                    );
                    return c + cost * (p.quantity || 0);
                },
                0
            );
            // Thêm giá vốn dịch vụ gia công bên ngoài
            const servicesCost = (
                wo.additionalServices ||
                wo.additionalservices ||
                []
            ).reduce((c: number, s: any) => {
                return c + (s.costPrice || s.costprice || 0) * (s.quantity || 0);
            }, 0);
            const totalCost = partsCost + servicesCost;
            return (
                sum + ((wo.totalPaid || wo.totalpaid || wo.total || 0) - totalCost)
            );
        }, 0);

        // Cash transactions: thu/chi trong ngày (loại trừ thu dịch vụ/bán hàng đã tính trong Sales/WO)
        const todayIncome = cashTransactions
            .filter(
                (t) =>
                    t.type === "income" &&
                    !isExcludedIncomeCategory(t.category) &&
                    t.date.slice(0, 10) === today
            )
            .reduce((sum, t) => sum + t.amount, 0);
        // Chi phí: loại trừ chi nhập kho (đã tính trong giá vốn hàng bán)
        const todayExpense = cashTransactions
            .filter(
                (t) =>
                    t.type === "expense" &&
                    t.amount > 0 &&
                    !isExcludedExpenseCategory(t.category) &&
                    t.date.slice(0, 10) === today
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // Doanh thu = Sales + Work Orders + Phiếu thu (không tính thu dịch vụ)
        const revenue = salesRevenue + woRevenue + todayIncome;
        // Lợi nhuận thuần = (Lợi nhuận gộp từ Sales/WO) + Thu khác - Chi khác
        const grossProfit = salesProfit + woProfit;
        const profit = grossProfit + todayIncome - todayExpense;

        // Count unique customers
        const salesCustomers = todaySales.map(
            (s) => s.customer.phone || s.customer.name
        );
        const woCustomers = todayWorkOrders.map(
            (wo: any) =>
                wo.customerPhone ||
                wo.customerphone ||
                wo.customerName ||
                wo.customername
        );
        const customerCount = new Set([...salesCustomers, ...woCustomers]).size;

        return {
            revenue,
            profit,
            grossProfit,
            income: todayIncome,
            expense: todayExpense,
            customerCount,
            orderCount: todaySales.length + todayWorkOrders.length,
            salesCount: todaySales.length,
            workOrdersCount: todayWorkOrders.length,
        };
    }, [sales, workOrders, cashTransactions, today, getPartCost]);

    // Thống kê theo filter (bao gồm cả Sales và Work Orders)
    const filteredStats = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now; // Ngày hiện tại

        // Handle specific month filters (month1, month2, ... month12)
        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0); // Last day of month
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }
        // Handle quarter filters (q1, q2, q3, q4)
        else if (reportFilter.startsWith("q") && reportFilter.length === 2) {
            const quarterNum = parseInt(reportFilter.slice(1), 10);
            if (quarterNum >= 1 && quarterNum <= 4) {
                const startMonth = (quarterNum - 1) * 3;
                startDate = new Date(now.getFullYear(), startMonth, 1);
                endDate = new Date(now.getFullYear(), startMonth + 3, 0); // Last day of quarter
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }
        // Handle standard filters
        else {
            switch (reportFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "week":
                    const dayOfWeek = now.getDay();
                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
                    startDate = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - diff
                    );
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }
        }

        // Sử dụng local date format YYYY-MM-DD thay vì ISO string (tránh lỗi timezone)
        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        // Chuyển ISO string hoặc date string sang local date string YYYY-MM-DD
        const toLocalDateStr = (
            dateStr: string | undefined | null
        ): string | null => {
            if (!dateStr) return null;
            try {
                // Parse date string và chuyển sang local date
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        // Sales - lọc theo ngày giao dịch trong khoảng thời gian
        const filteredSales = sales.filter((s) => {
            const saleDate = toLocalDateStr(s.date);
            return saleDate && saleDate >= startDateStr && saleDate <= endDateStr;
        });
        const salesRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const salesProfit = filteredSales.reduce((sum, s) => {
            const cost = s.items.reduce((c, it) => {
                const partCost = getPartCost(
                    it.partId,
                    it.sku,
                    (it as any).costPrice || 0
                );
                return c + partCost * it.quantity;
            }, 0);
            return sum + (s.total - cost);
        }, 0);

        // Work Orders (đã thanh toán) - dùng paymentDate nếu có, fallback về creationDate
        const filteredWorkOrders = workOrders.filter((wo: any) => {
            // Ưu tiên dùng ngày thanh toán, nếu không có thì dùng ngày tạo
            const paymentDateRaw = wo.paymentDate || wo.paymentdate;
            const creationDateRaw = wo.creationDate || wo.creationdate;
            const woDate =
                toLocalDateStr(paymentDateRaw) || toLocalDateStr(creationDateRaw);

            const isPaid =
                wo.paymentStatus === "paid" ||
                wo.paymentstatus === "paid" ||
                wo.paymentStatus === "partial" ||
                wo.paymentstatus === "partial";
            return woDate && woDate >= startDateStr && woDate <= endDateStr && isPaid;
        });
        const woRevenue = filteredWorkOrders.reduce(
            (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
            0
        );
        const woProfit = filteredWorkOrders.reduce((sum, wo: any) => {
            const partsCost = (wo.partsUsed || wo.partsused || []).reduce(
                (c: number, p: any) => {
                    const partId = p.partId || p.partid;
                    const sku = p.sku;
                    const cost = getPartCost(
                        partId,
                        sku,
                        p.costPrice || p.costprice || 0
                    );
                    return c + cost * (p.quantity || 0);
                },
                0
            );
            // Thêm giá vốn dịch vụ gia công bên ngoài
            const servicesCost = (
                wo.additionalServices ||
                wo.additionalservices ||
                []
            ).reduce((c: number, s: any) => {
                return c + (s.costPrice || s.costprice || 0) * (s.quantity || 0);
            }, 0);
            const totalCost = partsCost + servicesCost;
            return (
                sum + ((wo.totalPaid || wo.totalpaid || wo.total || 0) - totalCost)
            );
        }, 0);

        // Cash transactions: thu/chi trong khoảng thời gian (loại trừ thu dịch vụ/bán hàng)
        const filteredIncome = cashTransactions
            .filter((t) => {
                const txDate = toLocalDateStr(t.date);
                return (
                    t.type === "income" &&
                    !isExcludedIncomeCategory(t.category) &&
                    txDate &&
                    txDate >= startDateStr &&
                    txDate <= endDateStr
                );
            })
            .reduce((sum, t) => sum + t.amount, 0);
        // Chi phí: loại trừ chi nhập kho (đã tính trong giá vốn hàng bán)
        const filteredExpense = cashTransactions
            .filter((t) => {
                const txDate = toLocalDateStr(t.date);
                return (
                    t.type === "expense" &&
                    t.amount > 0 &&
                    !isExcludedExpenseCategory(t.category) &&
                    txDate &&
                    txDate >= startDateStr &&
                    txDate <= endDateStr
                );
            })
            .reduce((sum, t) => sum + t.amount, 0);

        // Doanh thu = Sales + Work Orders + Phiếu thu (không tính thu dịch vụ)
        const revenue = salesRevenue + woRevenue + filteredIncome;
        // Lợi nhuận thuần = (Lợi nhuận gộp từ Sales/WO) + Thu khác - Chi khác
        const grossProfit = salesProfit + woProfit;
        const profit = grossProfit + filteredIncome - filteredExpense;

        const salesCustomers = filteredSales.map(
            (s) => s.customer.phone || s.customer.name
        );
        const woCustomers = filteredWorkOrders.map(
            (wo: any) =>
                wo.customerPhone ||
                wo.customerphone ||
                wo.customerName ||
                wo.customername
        );
        const customerCount = new Set([...salesCustomers, ...woCustomers]).size;

        return {
            revenue,
            profit,
            grossProfit,
            income: filteredIncome,
            expense: filteredExpense,
            customerCount,
            orderCount: filteredSales.length + filteredWorkOrders.length,
        };
    }, [sales, workOrders, cashTransactions, reportFilter, getPartCost]);

    // Dữ liệu doanh thu 7 ngày gần nhất (bao gồm cả Sales và Work Orders)
    const last7DaysRevenue = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10);

            // Sales revenue
            const daySales = sales.filter((s) => s.date.slice(0, 10) === dateStr);
            const salesRevenue = daySales.reduce((sum, s) => sum + s.total, 0);

            // Work Orders revenue (đã thanh toán)
            const dayWorkOrders = workOrders.filter((wo: any) => {
                const woDate =
                    wo.creationDate?.slice(0, 10) || wo.creationdate?.slice(0, 10);
                const isPaid =
                    wo.paymentStatus === "paid" ||
                    wo.paymentstatus === "paid" ||
                    wo.paymentStatus === "partial" ||
                    wo.paymentstatus === "partial";
                return woDate === dateStr && isPaid;
            });
            const woRevenue = dayWorkOrders.reduce(
                (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
                0
            );

            const revenue = salesRevenue + woRevenue;

            const expense = cashTransactions
                .filter((t) => t.type === "expense" && t.date.slice(0, 10) === dateStr)
                .reduce((sum, t) => sum + t.amount, 0);

            data.push({
                date: date.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                }),
                revenue,
                expense,
                profit: revenue - expense, // FIXME: This profit calc is simplified for the chart, ideally should be grossProfit - expense
            });
        }
        return data;
    }, [sales, workOrders, cashTransactions]);

    // Dữ liệu thu chi
    const incomeExpenseData = useMemo(() => {
        const income = cashTransactions
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = cashTransactions
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);

        return [
            { name: "Thu", value: income, color: "#10b981" },
            { name: "Chi", value: expense, color: "#ef4444" },
        ];
    }, [cashTransactions]);

    // Top sản phẩm bán chạy (từ cả Sales và Work Orders)
    const topProducts = useMemo(() => {
        const productSales: Record<string, { name: string; quantity: number }> = {};

        // From sales
        sales.forEach((sale) => {
            sale.items.forEach((item) => {
                if (!productSales[item.partId]) {
                    productSales[item.partId] = {
                        name: item.partName,
                        quantity: 0,
                    };
                }
                productSales[item.partId].quantity += item.quantity;
            });
        });

        // From work orders
        workOrders.forEach((wo: any) => {
            const parts = wo.partsUsed || wo.partsused || [];
            parts.forEach((part: any) => {
                const partId = part.partId || part.partid;
                const partName = part.partName || part.partname;
                if (partId && partName) {
                    if (!productSales[partId]) {
                        productSales[partId] = {
                            name: partName,
                            quantity: 0,
                        };
                    }
                    productSales[partId].quantity += part.quantity || 0;
                }
            });
        });

        return Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [sales, workOrders]);

    // Thống kê work orders (phiếu sửa chữa)
    const workOrderStats = useMemo(() => {
        const newOrders = (workOrders || []).filter(
            (wo) => wo.status === "Tiếp nhận"
        ).length;
        const inProgress = (workOrders || []).filter(
            (wo) => wo.status === "Đang sửa"
        ).length;
        const completed = (workOrders || []).filter(
            (wo) => wo.status === "Đã sửa xong"
        ).length;
        // Đã trả/giao xe = status "Trả máy" hoặc "Đã giao"
        const delivered = (workOrders || []).filter(
            (wo) => wo.status === "Trả máy" || (wo.status as string) === "Đã giao"
        ).length;
        // Đã hủy
        const cancelled = (workOrders || []).filter(
            (wo) => (wo.status as string) === "Đã hủy"
        ).length;

        return { newOrders, inProgress, completed, delivered, cancelled };
    }, [workOrders]);

    // Cảnh báo
    const alerts = useMemo(() => {
        const warnings: Array<{ type: string; message: string; color: string }> =
            [];

        // Hàng sắp hết
        const lowStockParts = parts.filter(
            (p) => (p.stock[currentBranchId] || 0) < 10
        );
        if (lowStockParts.length > 0) {
            warnings.push({
                type: "Tồn kho thấp",
                message: `${lowStockParts.length} sản phẩm sắp hết hàng`,
                color: "text-orange-600 dark:text-orange-400",
            });
        }

        // Khoản vay đến hạn
        const upcomingLoans = loans.filter((loan) => {
            const daysUntilDue = Math.ceil(
                (new Date(loan.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilDue <= 30 && daysUntilDue > 0 && loan.status === "active";
        });
        if (upcomingLoans.length > 0) {
            warnings.push({
                type: "Nợ đến hạn",
                message: `${upcomingLoans.length} khoản vay sắp đến hạn`,
                color: "text-red-600 dark:text-red-400",
            });
        }

        // Số dư thấp
        if (cashBalance + bankBalance < 10000000) {
            warnings.push({
                type: "Số dư thấp",
                message: "Số dư tài khoản dưới 10 triệu",
                color: "text-amber-600 dark:text-amber-400",
            });
        }

        return warnings;
    }, [parts, loans, cashBalance, bankBalance, currentBranchId]);

    // Top Customers Data
    const topCustomersData = useMemo(() => {
        const customerSpending: Record<
            string,
            { name: string; phone?: string; total: number }
        > = {};

        // Tính từ Sales (bán hàng)
        sales.forEach((sale) => {
            const key = sale.customer.phone || sale.customer.name;
            if (!customerSpending[key]) {
                customerSpending[key] = {
                    name: sale.customer.name,
                    phone: sale.customer.phone,
                    total: 0,
                };
            }
            customerSpending[key].total += sale.total;
        });

        // Tính từ Work Orders (phiếu sửa chữa đã thanh toán)
        workOrders.forEach((wo: any) => {
            const isPaid =
                wo.paymentStatus === "paid" ||
                wo.paymentstatus === "paid" ||
                wo.paymentStatus === "partial" ||
                wo.paymentstatus === "partial";

            if (isPaid) {
                const customerName = wo.customerName || wo.customername || "";
                const customerPhone = wo.customerPhone || wo.customerphone || "";
                const key = customerPhone || customerName;

                if (key) {
                    if (!customerSpending[key]) {
                        customerSpending[key] = {
                            name: customerName,
                            phone: customerPhone,
                            total: 0,
                        };
                    }
                    customerSpending[key].total +=
                        wo.totalPaid || wo.totalpaid || wo.total || 0;
                }
            }
        });

        return Object.values(customerSpending)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [sales, workOrders]);

    // Monthly Comparison Data
    const monthlyComparisonData = useMemo(() => {
        const months = [];
        const now = new Date();

        for (let i = 2; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = monthDate.toISOString().slice(0, 7); // Format: YYYY-MM
            const monthName = monthDate.toLocaleDateString("vi-VN", {
                month: "short",
                year: "numeric",
            });

            // Tính doanh thu và đơn hàng từ Sales
            const monthSales = sales.filter((s) => {
                if (!s.date) return false;
                const saleMonth = s.date.slice(0, 7);
                return saleMonth === monthStr;
            });
            const salesRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);
            const salesOrders = monthSales.length;

            // Tính doanh thu và đơn hàng từ Work Orders (đã thanh toán)
            const monthWorkOrders = workOrders.filter((wo: any) => {
                // Ưu tiên dùng paymentDate, nếu không có thì dùng creationDate
                const dateRaw =
                    wo.paymentDate ||
                    wo.paymentdate ||
                    wo.creationDate ||
                    wo.creationdate;
                if (!dateRaw) return false;

                const woMonth = dateRaw.slice(0, 7);
                const isPaid =
                    wo.paymentStatus === "paid" ||
                    wo.paymentstatus === "paid" ||
                    wo.paymentStatus === "partial" ||
                    wo.paymentstatus === "partial";
                return woMonth === monthStr && isPaid;
            });
            const woRevenue = monthWorkOrders.reduce(
                (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
                0
            );
            const woOrders = monthWorkOrders.length;

            const totalRevenue = salesRevenue + woRevenue;
            const totalOrders = salesOrders + woOrders;

            months.push({
                month: monthName,
                revenue: totalRevenue,
                orders: totalOrders,
            });
        }

        return months;
    }, [sales, workOrders]);

    return {
        todayStats,
        filteredStats,
        last7DaysRevenue,
        incomeExpenseData,
        topProducts,
        workOrderStats,
        alerts,
        topCustomersData,
        monthlyComparisonData,
        cashBalance,
        bankBalance,
    };
};
