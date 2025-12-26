import React, { useState, useMemo, useEffect } from "react";
import { useAppContext } from "../../contexts/AppContext";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import {
  Calendar,
  Search,
  Download,
  Printer,
  Edit2,
  ChevronRight,
} from "lucide-react";
import { printElementById } from "../../utils/print";
import { supabase } from "../../supabaseClient";
import type { WorkOrder } from "../../types";
import { useNavigate } from "react-router-dom";
import { WORK_ORDER_STATUS, PAYMENT_STATUS } from "../../constants";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import PrintOrderPreviewModal from "./modals/PrintOrderPreviewModal";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  work_order_prefix?: string;
}

interface ServiceHistoryProps {
  currentBranchId: string;
}

export const ServiceHistory: React.FC<ServiceHistoryProps> = ({
  currentBranchId,
}) => {
  const { workOrders: contextWorkOrders, setWorkOrders } = useAppContext();
  const { data: fetchedWorkOrders } = useWorkOrdersRepo();
  const workOrders = fetchedWorkOrders || contextWorkOrders;
  const navigate = useNavigate();

  // Sync fetched work orders to context
  useEffect(() => {
    if (fetchedWorkOrders) {
      console.log("[ServiceHistory] Fetched work orders:", fetchedWorkOrders);
      console.log("[ServiceHistory] Sample order:", fetchedWorkOrders[0]);
      setWorkOrders(fetchedWorkOrders);
    }
  }, [fetchedWorkOrders, setWorkOrders]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Advanced date filters
  const [dateFilterType, setDateFilterType] = useState<
    "quick" | "month" | "custom"
  >("quick");
  const [quickDateFilter, setQuickDateFilter] = useState("7days"); // today, yesterday, 3days, week, thisMonth, lastMonth
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `${year}-${month}`;
  });
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);

  // Default to current month (kept for backward compatibility)
  const getCurrentMonthFilter = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    return `Tháng ${month}/${year}`;
  };
  const [dateFilter, setDateFilter] = useState(getCurrentMonthFilter());

  // State for print preview modal
  const [printOrder, setPrintOrder] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  // Fetch store settings on mount
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select(
            "store_name, address, phone, email, logo_url, bank_qr_url, bank_name, bank_account_number, bank_account_holder, bank_branch"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching store settings:", error);
          return;
        }

        setStoreSettings(data);
      } catch (err) {
        console.error("Failed to fetch store settings:", err);
      }
    };

    fetchStoreSettings();
  }, []);

  const getDateRange = (filter: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (filter.includes("Tháng")) {
      const match = filter.match(/Tháng (\d+)\/(\d+)/);
      if (match) {
        const filterMonth = parseInt(match[1]) - 1;
        const filterYear = parseInt(match[2]);
        const start = new Date(filterYear, filterMonth, 1);
        const end = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
        return { start, end };
      }
    }

    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0, 23, 59, 59),
    };
  };

  // Get date range based on current filter type
  const getCurrentDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilterType === "quick") {
      switch (quickDateFilter) {
        case "today":
          return {
            start: today,
            end: new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate(),
              23,
              59,
              59
            ),
          };
        case "yesterday":
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return {
            start: yesterday,
            end: new Date(
              yesterday.getFullYear(),
              yesterday.getMonth(),
              yesterday.getDate(),
              23,
              59,
              59
            ),
          };
        case "3days":
          const threeDaysAgo = new Date(today);
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
          return {
            start: threeDaysAgo,
            end: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59
            ),
          };
        case "7days":
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          return {
            start: sevenDaysAgo,
            end: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59
            ),
          };
        case "thisWeek":
          const startOfWeek = new Date(today);
          const day = startOfWeek.getDay();
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
          startOfWeek.setDate(diff);
          return {
            start: startOfWeek,
            end: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59
            ),
          };
        case "lastWeek":
          const startOfLastWeek = new Date(today);
          const lastWeekDay = startOfLastWeek.getDay();
          const lastWeekDiff = startOfLastWeek.getDate() - lastWeekDay - 6;
          startOfLastWeek.setDate(lastWeekDiff);
          const endOfLastWeek = new Date(startOfLastWeek);
          endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
          endOfLastWeek.setHours(23, 59, 59);
          return { start: startOfLastWeek, end: endOfLastWeek };
        default:
          return {
            start: today,
            end: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              23,
              59,
              59
            ),
          };
      }
    } else if (dateFilterType === "month") {
      const [year, month] = monthFilter.split("-").map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      return { start, end };
    } else if (dateFilterType === "custom") {
      if (customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59);
        return { start, end };
      }
    }

    // Default: current month
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  };

  // Get display text for current date filter
  const getDateFilterDisplay = () => {
    if (dateFilterType === "quick") {
      switch (quickDateFilter) {
        case "today":
          return "Hôm nay";
        case "yesterday":
          return "Hôm qua";
        case "3days":
          return "3 ngày qua";
        case "7days":
          return "7 ngày qua";
        case "thisWeek":
          return "Tuần này";
        case "lastWeek":
          return "Tuần trước";
        default:
          return "Chọn thời gian";
      }
    } else if (dateFilterType === "month") {
      const [year, month] = monthFilter.split("-");
      return `Tháng ${month}/${year}`;
    } else if (dateFilterType === "custom") {
      if (customDateStart && customDateEnd) {
        const start = new Date(customDateStart).toLocaleDateString("vi-VN");
        const end = new Date(customDateEnd).toLocaleDateString("vi-VN");
        return `${start} - ${end}`;
      }
      return "Tùy chỉnh";
    }
    return "Chọn thời gian";
  };

  const filteredOrders = useMemo(() => {
    const { start, end } = getCurrentDateRange();

    return workOrders
      .filter((order) => {
        // ONLY show "Trả máy" status in history
        if (order.status !== WORK_ORDER_STATUS.DELIVERED) return false;

        if (order.branchId !== currentBranchId) return false;

        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const matches = [
            order.id?.toLowerCase(),
            order.customerName?.toLowerCase(),
            order.customerPhone?.toLowerCase(),
            order.vehicleModel?.toLowerCase(),
            order.licensePlate?.toLowerCase(),
          ].some((field) => field?.includes(search));

          if (!matches) return false;
        }

        if (statusFilter !== "all" && order.status !== statusFilter)
          return false;

        if (
          technicianFilter !== "all" &&
          order.technicianName !== technicianFilter
        )
          return false;

        if (paymentFilter !== "all") {
          if (paymentFilter === "paid" && order.paymentStatus !== "paid")
            return false;
          if (paymentFilter === "unpaid" && order.paymentStatus !== "unpaid")
            return false;
        }

        if (order.creationDate) {
          const orderDate = new Date(order.creationDate);
          if (orderDate < start || orderDate > end) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.creationDate || 0).getTime() -
          new Date(a.creationDate || 0).getTime()
      );
  }, [
    workOrders,
    searchTerm,
    statusFilter,
    dateFilterType,
    quickDateFilter,
    monthFilter,
    customDateStart,
    customDateEnd,
    technicianFilter,
    paymentFilter,
    currentBranchId,
  ]);

  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + (order.total || 0),
    0
  );

  // Generate month options (last 12 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      options.push(`Tháng ${month}/${year}`);
    }
    return options;
  };

  const exportToCSV = () => {
    const headers = [
      "Mã Phiếu",
      "Ngày tạo",
      "Khách hàng",
      "Xe",
      "Biển số",
      "Trạng thái",
      "Tổng chi phí",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredOrders.map((order) =>
        [
          formatWorkOrderId(order.id, storeSettings?.work_order_prefix) || "",
          formatDate(order.creationDate, true),
          order.customerName || "",
          order.vehicleModel || "",
          order.licensePlate || "",
          order.status || "",
          order.total?.toString() || "0",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `lich-su-sua-chua-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle print work order - show preview modal
  const handlePrintOrder = (order: WorkOrder) => {
    setPrintOrder(order);
    setShowPrintPreview(true);
  };

  // Handle edit work order - navigate to service page with order data
  const handleEditOrder = (order: WorkOrder) => {
    // Navigate to service manager with order ID in state
    navigate("/service", { state: { editOrder: order } });
  };

  // Handle actual print
  const handleDoPrint = () => {
    setTimeout(() => {
      printElementById("work-order-receipt");
    }, 500);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig: Record<string, { icon: string; color: string }> = {
      [WORK_ORDER_STATUS.RECEIVED]: {
        icon: "📋",
        color: "text-blue-600 dark:text-blue-400",
      },
      [WORK_ORDER_STATUS.IN_PROGRESS]: {
        icon: "🔧",
        color: "text-orange-600 dark:text-orange-400",
      },
      [WORK_ORDER_STATUS.COMPLETED]: {
        icon: "✓",
        color: "text-purple-600 dark:text-purple-400",
      },
      [WORK_ORDER_STATUS.DELIVERED]: {
        icon: "✓",
        color: "text-green-600 dark:text-green-400",
      },
    };
    const config =
      statusConfig[status] || statusConfig[WORK_ORDER_STATUS.RECEIVED];
    return (
      <span className={`flex items-center gap-1 text-sm ${config.color}`}>
        <span>{config.icon}</span>
        <span>{status}</span>
      </span>
    );
  };

  const PaymentBadge = ({ status }: { status?: string }) => {
    if (status === "paid") {
      return (
        <span className="text-xs text-green-600 dark:text-green-400">
          ✓ Đã thanh toán
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        ○ Chưa thanh toán
      </span>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Stats Cards - Mobile optimized */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                Tổng phiếu
              </p>
              <p className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {filteredOrders.length}
              </p>
            </div>
            <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                Tổng doanh thu
              </p>
              <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="p-2 md:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Download className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white dark:bg-slate-800 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700">
          <button
            onClick={exportToCSV}
            className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Action Bar - Mobile optimized */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-3 md:p-4 border border-slate-200 dark:border-slate-700">
        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Tìm theo mã, tên, SĐT, xe,..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
          <Search
            className="absolute left-3 top-3 w-4 h-4 text-slate-400"
            aria-hidden="true"
          />
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDateFilterModal(true)}
            className="flex-1 md:flex-none px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs md:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span className="truncate">{getDateFilterDisplay()}</span>
          </button>

          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="flex-1 md:flex-none px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs md:text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="all">Tất cả KTV</option>
            <option value="KTV 1">KTV 1</option>
            <option value="KTV 2">KTV 2</option>
          </select>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="flex-1 md:flex-none px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs md:text-sm text-slate-700 dark:text-slate-200"
          >
            <option value="all">Tất cả thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
          </select>
        </div>
      </div>

      {/* Date Filter Modal */}
      {showDateFilterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Chọn thời gian:
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Quick Filters */}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Theo ngày:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("today");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" && quickDateFilter === "today"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    Hôm nay
                  </button>
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("yesterday");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" &&
                      quickDateFilter === "yesterday"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    Hôm qua
                  </button>
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("3days");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" && quickDateFilter === "3days"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    3 ngày qua
                  </button>
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("thisWeek");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" &&
                      quickDateFilter === "thisWeek"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    Tuần này
                  </button>
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("lastWeek");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" &&
                      quickDateFilter === "lastWeek"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    Tuần trước
                  </button>
                  <button
                    onClick={() => {
                      setDateFilterType("quick");
                      setQuickDateFilter("7days");
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "quick" && quickDateFilter === "7days"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    ✓ 7 ngày qua
                  </button>
                </div>
              </div>

              {/* Month Filters */}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Theo tháng:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2, 3, 4, 5].map((offset) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - offset);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, "0");
                    const value = `${year}-${month}`;
                    const display = `Tháng ${month}/${year}`;

                    return (
                      <button
                        key={value}
                        onClick={() => {
                          setDateFilterType("month");
                          setMonthFilter(value);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dateFilterType === "month" && monthFilter === value
                          ? "bg-slate-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                          }`}
                      >
                        {display}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Range */}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  Tùy chỉnh:
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => {
                      setCustomDateStart(e.target.value);
                      if (e.target.value && customDateEnd) {
                        setDateFilterType("custom");
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => {
                      setCustomDateEnd(e.target.value);
                      if (customDateStart && e.target.value) {
                        setDateFilterType("custom");
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDateFilterModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => setShowDateFilterModal(false)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table - Desktop Only */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Table Header */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
          <div className="flex items-center gap-4">
            {/* Left: Checkbox */}
            <div className="w-16 text-center">
              <input type="checkbox" className="rounded border-slate-400" />
            </div>

            {/* Column 1: Mã phiếu */}
            <div className="flex-1 min-w-[180px]">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Mã phiếu
              </span>
            </div>

            {/* Column 2: Khách hàng */}
            <div className="flex-1 min-w-[180px]">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Khách hàng
              </span>
            </div>

            {/* Column 3: Chi tiết */}
            <div className="flex-1 min-w-[200px]">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Chi tiết
              </span>
            </div>

            {/* Column 4: Price Details */}
            <div className="w-56">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Hẹn trả
              </span>
            </div>

            {/* Column 5: Actions */}
            <div className="w-24 text-center">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">
                Thao tác
              </span>
            </div>
          </div>
        </div>

        {/* Orders List - Card Layout */}
        {filteredOrders.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-400">
            Không có phiếu sửa chữa nào.
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredOrders.map((order) => {
              const partsCost =
                order.partsUsed?.reduce(
                  (sum, p) => sum + p.quantity * p.price,
                  0
                ) || 0;

              const servicesTotal =
                order.additionalServices?.reduce(
                  (sum: number, s: any) =>
                    sum + (s.price || 0) * (s.quantity || 1),
                  0
                ) || 0;

              const laborCost = order.laborCost || 0;

              return (
                <div
                  key={order.id}
                  className="px-4 py-4 bg-slate-900 dark:bg-slate-950 hover:bg-slate-800 dark:hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Left: Checkbox + Icon */}
                    <div className="w-16 flex flex-col items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        className="rounded border-slate-600"
                      />
                      <div className="w-10 h-10 bg-slate-800 dark:bg-slate-700 rounded flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>

                    {/* Column 1: Mã phiếu */}
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-mono font-bold text-blue-400 text-sm mb-1">
                        {formatWorkOrderId(
                          order.id,
                          storeSettings?.work_order_prefix
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span>Ngày: </span>
                        <span className="text-slate-300">
                          {formatDate(order.creationDate, true)}
                        </span>
                      </div>
                      <div className="text-xs text-cyan-400">
                        NV: {order.technicianName || "Chưa phân công"}
                      </div>
                    </div>

                    {/* Column 2: Khách hàng */}
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-semibold text-base text-white mb-1">
                        {order.customerName}
                      </div>
                      <div className="text-xs text-slate-400">
                        {order.customerPhone}
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="font-medium">Xe: </span>
                        <span>{order.vehicleModel || "N/A"}</span>
                        {order.licensePlate && (
                          <span className="ml-1">- {order.licensePlate}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 italic mt-1">
                        {order.issueDescription || "Không có mô tả"}
                      </div>
                    </div>

                    {/* Column 3: Chi tiết */}
                    <div className="flex-1 min-w-[200px]">
                      <div className="space-y-1">
                        {/* Phụ tùng */}
                        {order.partsUsed && order.partsUsed.length > 0 && (
                          <div className="mb-2">
                            <div className="text-xs font-medium text-slate-400 mb-0.5">
                              Phụ tùng:
                            </div>
                            <div className="space-y-0.5">
                              {order.partsUsed.map((part, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-slate-300"
                                >
                                  • {part.partName} x{part.quantity}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Gia công/Đặt hàng */}
                        {order.additionalServices &&
                          order.additionalServices.length > 0 && (
                            <div className="mb-2">
                              <div className="text-xs font-medium text-slate-400 mb-0.5">
                                Gia công/Đặt hàng:
                              </div>
                              <div className="space-y-0.5">
                                {order.additionalServices.map((svc, idx) => (
                                  <div
                                    key={idx}
                                    className="text-xs text-slate-300"
                                  >
                                    • {svc.description} x{svc.quantity || 1}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Trạng thái */}
                        <div className="mt-2">
                          <StatusBadge status={order.status || "Tiếp nhận"} />
                        </div>

                        {/* Nếu không có gì */}
                        {(!order.partsUsed || order.partsUsed.length === 0) &&
                          (!order.additionalServices ||
                            order.additionalServices.length === 0) && (
                            <div className="text-xs text-slate-500 italic mb-2">
                              Chưa có chi tiết
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Column 4: All Price Details */}
                    <div className="w-56">
                      <div className="space-y-1 text-xs text-right mb-3">
                        {laborCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tiền công:</span>
                            <span className="text-slate-300">
                              {formatCurrency(laborCost)}
                            </span>
                          </div>
                        )}
                        {partsCost > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              Tiền phụ tùng:
                            </span>
                            <span className="text-blue-400 font-medium">
                              {formatCurrency(partsCost)}
                            </span>
                          </div>
                        )}
                        {servicesTotal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              Giá công/Đặt hàng:
                            </span>
                            <span className="text-slate-300">
                              {formatCurrency(servicesTotal)}
                            </span>
                          </div>
                        )}
                        {order.total > 0 && (
                          <div className="flex justify-between pt-2 border-t border-slate-700 text-sm">
                            <span className="text-slate-300 font-bold">
                              Tổng cộng:
                            </span>
                            <span className="text-blue-400 font-bold text-sm">
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                        )}
                        {order.discount && order.discount > 0 && (
                          <div className="flex justify-between text-right text-xs">
                            <span className="text-red-500">Giảm giá:</span>
                            <span className="text-red-500">
                              {formatCurrency(order.discount)}
                            </span>
                          </div>
                        )}
                        {order.depositAmount && order.depositAmount > 0 && (
                          <div className="flex justify-between text-right text-xs text-green-500">
                            <span>Đã đặt cọc:</span>
                            <span>-{formatCurrency(order.depositAmount)}</span>
                          </div>
                        )}
                        {order.additionalPayment &&
                          order.additionalPayment > 0 && (
                            <div className="flex justify-between text-right text-xs text-green-500">
                              <span>Thanh toán thêm:</span>
                              <span>
                                -{formatCurrency(order.additionalPayment)}
                              </span>
                            </div>
                          )}
                        {order.remainingAmount !== undefined &&
                          order.remainingAmount > 0 && (
                            <div className="flex justify-between text-right text-xs mt-1">
                              <span>Còn phải thu:</span>
                              <span
                                className={`font-bold ${order.remainingAmount > 0
                                  ? "text-red-500"
                                  : "text-green-500"
                                  }`}
                              >
                                {formatCurrency(order.remainingAmount)}
                              </span>
                            </div>
                          )}
                      </div>

                      <div className="mt-2">
                        <PaymentBadge status={order.paymentStatus} />
                      </div>
                    </div>

                    {/* Column 5: Actions */}
                    <div className="w-24 flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleEditOrder(order)}
                        className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded-md transition-colors min-w-[70px] flex items-center justify-center gap-1"
                        title="Chỉnh sửa phiếu"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors min-w-[70px] flex items-center justify-center gap-1"
                      >
                        <span>✏️</span>
                        <span>Xem</span>
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded transition-colors"
                        title="In phiếu dịch vụ"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-8 text-center text-slate-400">
            Không có phiếu sửa chữa nào.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const partsCost =
              order.partsUsed?.reduce(
                (sum, p) => sum + p.quantity * p.price,
                0
              ) || 0;
            const servicesTotal =
              order.additionalServices?.reduce(
                (sum: number, s: any) =>
                  sum + (s.price || 0) * (s.quantity || 1),
                0
              ) || 0;

            return (
              <div
                key={order.id}
                className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Card Header */}
                <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <div className="font-mono font-bold text-blue-400 text-sm">
                        {formatWorkOrderId(
                          order.id,
                          storeSettings?.work_order_prefix
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Ngày: {formatDate(order.creationDate, true)}
                      </div>
                      <div className="text-xs text-cyan-400">
                        NV: {order.technicianName || "Chưa phân công"}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={order.status || "Tiếp nhận"} />
                </div>

                {/* Customer Info */}
                <div className="px-4 py-3 border-b border-slate-700">
                  <div className="font-semibold text-white text-base">
                    {order.customerName}
                  </div>
                  <div className="text-sm text-slate-400">
                    {order.customerPhone}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Xe: {order.vehicleModel || "N/A"} -{" "}
                    {order.licensePlate || "N/A"}
                  </div>
                  {order.issueDescription && (
                    <div className="text-xs text-slate-500 italic mt-1">
                      {order.issueDescription}
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                <div className="px-4 py-3 space-y-2">
                  {order.laborCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tiền công:</span>
                      <span className="text-slate-300">
                        {formatCurrency(order.laborCost)}
                      </span>
                    </div>
                  )}
                  {partsCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Phụ tùng:</span>
                      <span className="text-blue-400">
                        {formatCurrency(partsCost)}
                      </span>
                    </div>
                  )}
                  {servicesTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Gia công:</span>
                      <span className="text-slate-300">
                        {formatCurrency(servicesTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-700">
                    <span className="text-slate-300">Tổng cộng:</span>
                    <span className="text-green-400">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  {(order.remainingAmount || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Còn phải thu:</span>
                      <span className="text-red-400 font-bold">
                        {formatCurrency(order.remainingAmount || 0)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2">
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-slate-700/30 border-t border-slate-700 flex items-center gap-2">
                  <button
                    onClick={() => handleEditOrder(order)}
                    className="flex-1 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Sửa</span>
                  </button>
                  <button
                    onClick={() => handlePrintOrder(order)}
                    className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <Printer className="w-4 h-4" />
                    <span>In</span>
                  </button>
                  <button
                    onClick={() => handlePrintOrder(order)}
                    className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded-lg transition-colors flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Print Preview Modal - Mobile optimized */}
      <PrintOrderPreviewModal
        isOpen={showPrintPreview}
        onClose={() => {
          setShowPrintPreview(false);
          setPrintOrder(null);
        }}
        printOrder={printOrder}
        storeSettings={storeSettings || undefined}
        onPrint={handleDoPrint}
      />

      {/* Hidden Print Template */}
      <div id="work-order-receipt" className="hidden" />
    </div>
  );
};

export default ServiceHistory;
