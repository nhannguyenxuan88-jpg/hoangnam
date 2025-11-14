import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { Calendar, Search, Download, ChevronDown } from "lucide-react";

interface ServiceHistoryProps {
  currentBranchId: string;
}

export const ServiceHistory: React.FC<ServiceHistoryProps> = ({
  currentBranchId,
}) => {
  const { workOrders } = useAppContext();

  // State for filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("Tháng 09/2025");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  // Get date range based on filter
  const getDateRange = (filter: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (filter.includes("Tháng")) {
      // Extract month from filter like "Tháng 09/2025"
      const match = filter.match(/Tháng (\d+)\/(\d+)/);
      if (match) {
        const filterMonth = parseInt(match[1]) - 1;
        const filterYear = parseInt(match[2]);
        const start = new Date(filterYear, filterMonth, 1);
        const end = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59);
        return { start, end };
      }
    }

    // Default to current month
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0, 23, 59, 59),
    };
  };

  // Filter work orders
  const filteredOrders = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);

    return workOrders
      .filter((order) => {
        // Branch filter
        if (order.branchId !== currentBranchId) return false;

        // Search filter
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

        // Status filter
        if (statusFilter !== "all" && order.status !== statusFilter)
          return false;

        // Technician filter
        if (
          technicianFilter !== "all" &&
          order.technicianName !== technicianFilter
        )
          return false;

        // Payment filter
        if (paymentFilter !== "all") {
          if (paymentFilter === "paid" && order.paymentStatus !== "paid")
            return false;
          if (paymentFilter === "unpaid" && order.paymentStatus !== "unpaid")
            return false;
        }

        // Date range filter
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
    dateFilter,
    technicianFilter,
    paymentFilter,
    currentBranchId,
  ]);

  // Calculate total revenue
  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + (order.total || 0),
    0
  );

  // Pagination removed - show all filtered orders

  // Export to CSV
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
          `#${
            formatWorkOrderId(order.id, storeSettings?.work_order_prefix)
              ?.split("-")
              .pop() || ""
          }`,
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

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig: Record<string, { icon: string; color: string }> = {
      "Tiếp nhận": { icon: "📋", color: "text-blue-600 dark:text-blue-400" },
      "Đang sửa": { icon: "🔧", color: "text-orange-600 dark:text-orange-400" },
      "Đã sửa xong": {
        icon: "✓",
        color: "text-purple-600 dark:text-purple-400",
      },
      "Trả máy": { icon: "✓", color: "text-green-600 dark:text-green-400" },
    };

    const config = statusConfig[status] || statusConfig["Tiếp nhận"];

    return (
      <span className={`flex items-center gap-1 text-sm ${config.color}`}>
        <span>{config.icon}</span>
        <span>{status}</span>
      </span>
    );
  };

  // Payment status badge
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
    <div className="p-6 bg-white dark:bg-slate-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 sm:mb-0">
          Lịch sử sửa chữa
        </h1>

        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          📥 Xuất CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Tìm theo mã, tên, SĐT, xe, biển số..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Tiếp nhận">Tiếp nhận</option>
            <option value="Đang sửa">Đang sửa</option>
            <option value="Đã sửa xong">Đã sửa xong</option>
            <option value="Trả máy">Trả máy</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Hiển thị {paginatedOrders.length} / {filteredOrders.length} phiếu sửa
        chữa
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Mã Phiếu
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Xe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Biển số
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Tổng chi phí
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Không có phiếu sửa chữa nào.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                      index % 2 === 0
                        ? "bg-white dark:bg-slate-800"
                        : "bg-slate-50/50 dark:bg-slate-700/20"
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">
                      #
                      {formatWorkOrderId(
                        order.id,
                        storeSettings?.work_order_prefix
                      )
                        ?.split("-")
                        .pop() || ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(order.creationDate, true)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        {order.customerName || "N/A"}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {order.customerPhone || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {order.vehicleModel || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {order.licensePlate || "N/A"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status || "Tiếp nhận"} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(order.total || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Trang {currentPage} / {totalPages}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(
                    1,
                    Math.min(currentPage - 2 + i, totalPages - 4 + i)
                  );
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === page
                          ? "bg-blue-500 text-white"
                          : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
