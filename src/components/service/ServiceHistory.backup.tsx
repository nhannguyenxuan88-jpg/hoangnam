import React, { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate, formatWorkOrderId } from "../../utils/format";
import type { WorkOrder } from "../../types";

interface ServiceHistoryProps {
  currentBranchId: string;
}

const PAGE_SIZE = 20;

export const ServiceHistory: React.FC<ServiceHistoryProps> = ({
  currentBranchId,
}) => {
  const { workOrders } = useAppContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<WorkOrder["status"] | "all">("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const technicians = useMemo(() => {
    const set = new Set<string>();
    workOrders.forEach((order) => {
      if (order.technicianName) {
        set.add(order.technicianName);
      }
    });
    return Array.from(set);
  }, [workOrders]);

  const filteredOrders = useMemo<WorkOrder[]>(() => {
    const manualStart = startDate ? new Date(startDate) : null;
    const manualEnd = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return workOrders
      .filter((order) => {
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

        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }

        if (
          technicianFilter !== "all" &&
          order.technicianName !== technicianFilter
        ) {
          return false;
        }

        if (paymentFilter !== "all") {
          const isPaid = order.paymentStatus === "paid";
          if (paymentFilter === "paid" && !isPaid) return false;
          if (paymentFilter === "unpaid" && isPaid) return false;
        }

        if (order.creationDate) {
          const createdAt = new Date(order.creationDate);
          if (manualStart && createdAt < manualStart) return false;
          if (manualEnd && createdAt > manualEnd) return false;
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
    currentBranchId,
    searchTerm,
    statusFilter,
    technicianFilter,
    paymentFilter,
    startDate,
    endDate,
  ]);

  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + (order.total || 0),
    0
  );

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const paginatedOrders = useMemo<WorkOrder[]>(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  const exportToCSV = () => {
    const headers = [
      "Mã Phiếu",
      "Ngày tạo",
      "Khách hàng",
      "Xe",
      "Biển số",
      "Trạng thái",
      "Thanh toán",
      "Tổng chi phí",
    ];

    const rows = filteredOrders.map((order) => [
      formatWorkOrderId(order.id)?.split("-").pop() || order.id,
      formatDate(order.creationDate, true),
      order.customerName || "",
      order.vehicleModel || "",
      order.licensePlate || "",
      order.status,
      order.paymentStatus || "unpaid",
      (order.total || 0).toString(),
    ]);

    const csv = [headers, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lich-su-sua-chua-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const StatusBadge: React.FC<{ status: WorkOrder["status"] }> = ({ status }) => {
    const color =
      status === "Trả máy"
        ? "bg-green-100 text-green-700"
        : status === "Đang sửa"
        ? "bg-blue-100 text-blue-700"
        : status === "Đã sửa xong"
        ? "bg-purple-100 text-purple-700"
        : "bg-slate-100 text-slate-700";

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${color}`}>
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Lịch sử sửa chữa
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tổng doanh thu: {formatCurrency(totalRevenue)}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          Xuất CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="Tìm mã, khách hàng, SĐT, xe"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as WorkOrder["status"] | "all")
          }
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="Tiếp nhận">Tiếp nhận</option>
          <option value="Đang sửa">Đang sửa</option>
          <option value="Đã sửa xong">Đã sửa xong</option>
          <option value="Trả máy">Trả máy</option>
        </select>
        <select
          value={technicianFilter}
          onChange={(e) => setTechnicianFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        >
          <option value="all">Tất cả kỹ thuật viên</option>
          {technicians.map((tech) => (
            <option key={tech} value={tech}>
              {tech}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as "all" | "paid" | "unpaid")}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        >
          <option value="all">Tất cả thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="unpaid">Chưa thanh toán</option>
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
        />
      </div>

      <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Hiển thị {paginatedOrders.length} / {filteredOrders.length} phiếu sửa chữa
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Mã phiếu</th>
                <th className="px-4 py-3 text-left">Ngày tạo</th>
                <th className="px-4 py-3 text-left">Khách hàng</th>
                <th className="px-4 py-3 text-left">Xe</th>
                <th className="px-4 py-3 text-left">Biển số</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-right">Tổng chi phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không có phiếu sửa chữa nào phù hợp.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      #{formatWorkOrderId(order.id)?.split("-").pop() || order.id}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatDate(order.creationDate, true)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {order.customerName || "Khách lẻ"}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {order.customerPhone || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {order.vehicleModel || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {order.licensePlate || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(order.total || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              Trang {currentPage} / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                Trước
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
