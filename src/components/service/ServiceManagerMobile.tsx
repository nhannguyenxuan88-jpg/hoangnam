import React, { useState, useMemo } from "react";
import {
  FileText,
  Wrench,
  Check,
  Key,
  TrendingUp,
  DollarSign,
  Search,
  Plus,
  Filter,
  Phone,
  Edit2,
  Trash2,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import type { WorkOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";

interface ServiceManagerMobileProps {
  workOrders: WorkOrder[];
  onCreateWorkOrder: () => void;
  onEditWorkOrder: (workOrder: WorkOrder) => void;
  onDeleteWorkOrder: (workOrder: WorkOrder) => void;
  onCallCustomer: (phone: string) => void;
  currentBranchId: string;
}

type StatusFilter =
  | "all"
  | "Tiếp nhận"
  | "Đang sửa"
  | "Đã sửa xong"
  | "Trả máy";

export function ServiceManagerMobile({
  workOrders,
  onCreateWorkOrder,
  onEditWorkOrder,
  onDeleteWorkOrder,
  onCallCustomer,
  currentBranchId,
}: ServiceManagerMobileProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilterPopup, setShowFilterPopup] = useState(false);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const tiepNhan = workOrders.filter((w) => w.status === "Tiếp nhận").length;
    const dangSua = workOrders.filter((w) => w.status === "Đang sửa").length;
    const daHoanThanh = workOrders.filter(
      (w) => w.status === "Đã sửa xong"
    ).length;
    const traMay = workOrders.filter((w) => w.status === "Trả máy").length;

    const completedOrders = workOrders.filter(
      (w) => w.status === "Đã sửa xong" || w.status === "Trả máy"
    );
    const doanhThu = completedOrders.reduce(
      (sum, w) => sum + (w.total || 0),
      0
    );

    // Simple profit calculation - skip parts cost for now
    const loiNhuan = completedOrders.reduce((sum, w) => {
      return sum + (w.total || 0);
    }, 0);

    return { tiepNhan, dangSua, daHoanThanh, traMay, doanhThu, loiNhuan };
  }, [workOrders]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    let filtered = workOrders;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.customerName?.toLowerCase().includes(query) ||
          w.customerPhone?.toLowerCase().includes(query) ||
          w.licensePlate?.toLowerCase().includes(query) ||
          w.id?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.creationDate || 0).getTime();
      const dateB = new Date(b.creationDate || 0).getTime();
      return dateB - dateA;
    });
  }, [workOrders, statusFilter, searchQuery]);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Tiếp nhận":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "Đang sửa":
        return "bg-orange-500/10 text-orange-500 border-orange-500/30";
      case "Đã hoàn thành":
        return "bg-green-500/10 text-green-500 border-green-500/30";
      case "Trả máy":
        return "bg-purple-500/10 text-purple-500 border-purple-500/30";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/30";
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Tiếp nhận":
        return <FileText className="w-4 h-4" />;
      case "Đang sửa":
        return <Wrench className="w-4 h-4" />;
      case "Đã hoàn thành":
        return <Check className="w-4 h-4" />;
      case "Trả máy":
        return <Key className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="md:hidden flex flex-col h-screen bg-[#151521]">
      {/* KHỐI A: KPI DASHBOARD - Horizontal Scroll */}
      <div className="bg-[#1e1e2d] border-b border-gray-800">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 p-2 min-w-max">
            {/* Tiếp nhận */}
            <div className="flex-shrink-0 w-24 bg-[#2b2b40] rounded-lg p-2 border border-blue-500/20">
              <div className="flex justify-center mb-1">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-white text-center">
                {kpis.tiepNhan}
              </div>
              <div className="text-[10px] text-gray-400 text-center">
                Tiếp nhận
              </div>
            </div>

            {/* Đang sửa */}
            <div className="flex-shrink-0 w-24 bg-[#2b2b40] rounded-lg p-2 border border-orange-500/20">
              <div className="flex justify-center mb-1">
                <Wrench className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-xl font-bold text-white text-center">
                {kpis.dangSua}
              </div>
              <div className="text-[10px] text-gray-400 text-center">
                Đang sửa
              </div>
            </div>

            {/* Đã xong */}
            <div className="flex-shrink-0 w-24 bg-[#2b2b40] rounded-lg p-2 border border-green-500/20">
              <div className="flex justify-center mb-1">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-xl font-bold text-white text-center">
                {kpis.daHoanThanh}
              </div>
              <div className="text-[10px] text-gray-400 text-center">
                Đã xong
              </div>
            </div>

            {/* Trả máy */}
            <div className="flex-shrink-0 w-24 bg-[#2b2b40] rounded-lg p-2 border border-purple-500/20">
              <div className="flex justify-center mb-1">
                <Key className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-xl font-bold text-white text-center">
                {kpis.traMay}
              </div>
              <div className="text-[10px] text-gray-400 text-center">
                Trả máy
              </div>
            </div>

            {/* Doanh thu */}
            <div className="flex-shrink-0 w-32 bg-[#2b2b40] rounded-lg p-2 border border-emerald-500/20">
              <div className="flex justify-center mb-1">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-base font-bold text-white text-center">
                {formatCurrency(kpis.doanhThu)}
              </div>
              <div className="text-[10px] text-gray-400 text-center">
                Doanh thu
              </div>
            </div>

            {/* Lợi nhuận */}
            <div className="flex-shrink-0 w-32 bg-[#2b2b40] rounded-lg p-2 border border-cyan-500/20">
              <div className="flex justify-center mb-2">
                <DollarSign className="w-8 h-8 text-cyan-500" />
              </div>
              <div className="text-2xl font-bold text-white text-center mb-1">
                {formatCurrency(kpis.loiNhuan)}
              </div>
              <div className="text-xs text-gray-400 text-center">Lợi nhuận</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 text-center pb-2">
          ← Vuốt sang để xem thêm →
        </div>
      </div>

      {/* KHỐI B: STICKY SEARCH & FILTER HEADER */}
      <div className="sticky top-0 z-40 bg-[#1e1e2d] border-b border-gray-800 p-2 space-y-2">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Tìm tên, SĐT, biển số..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[#2b2b40] border border-gray-700 rounded-xl text-white placeholder-gray-500 text-base focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilterPopup(!showFilterPopup)}
            className="px-4 bg-[#2b2b40] border border-gray-700 rounded-xl hover:bg-[#3a3a52] transition-colors"
          >
            <Filter className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Status Tabs - Horizontal Scroll */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 min-w-max">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === "all"
                  ? "bg-blue-500 text-white"
                  : "bg-[#2b2b40] text-gray-400 hover:bg-[#3a3a52]"
              }`}
            >
              Tất cả ({workOrders.length})
            </button>
            <button
              onClick={() => setStatusFilter("Tiếp nhận")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === "Tiếp nhận"
                  ? "bg-blue-500 text-white"
                  : "bg-[#2b2b40] text-gray-400 hover:bg-[#3a3a52]"
              }`}
            >
              Tiếp nhận ({kpis.tiepNhan})
            </button>
            <button
              onClick={() => setStatusFilter("Đang sửa")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === "Đang sửa"
                  ? "bg-orange-500 text-white"
                  : "bg-[#2b2b40] text-gray-400 hover:bg-[#3a3a52]"
              }`}
            >
              Đang sửa ({kpis.dangSua})
            </button>
            <button
              onClick={() => setStatusFilter("Đã sửa xong")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === "Đã sửa xong"
                  ? "bg-green-500 text-white"
                  : "bg-[#2b2b40] text-gray-400 hover:bg-[#3a3a52]"
              }`}
            >
              Đã xong ({kpis.daHoanThanh})
            </button>
            <button
              onClick={() => setStatusFilter("Trả máy")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === "Trả máy"
                  ? "bg-purple-500 text-white"
                  : "bg-[#2b2b40] text-gray-400 hover:bg-[#3a3a52]"
              }`}
            >
              Trả máy ({kpis.traMay})
            </button>
          </div>
        </div>
      </div>

      {/* KHỐI C: DANH SÁCH PHIẾU */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 pb-20">
        {filteredWorkOrders.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-32 h-32 mb-6 flex items-center justify-center">
              <svg
                className="w-full h-full text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              Chưa có phiếu sửa chữa nào!
            </h3>
            <p className="text-gray-500 mb-6">
              Hãy tạo phiếu đầu tiên để quản lý dịch vụ sửa chữa
            </p>
            <button
              onClick={onCreateWorkOrder}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
            >
              + Tạo phiếu mới
            </button>
          </div>
        ) : (
          /* Work Order Cards */
          filteredWorkOrders.map((workOrder) => (
            <div
              key={workOrder.id}
              className="bg-[#1e1e2d] rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-blue-400 font-mono text-sm mb-1">
                      {formatWorkOrderId(workOrder.id)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(workOrder.creationDate)}
                    </div>
                  </div>
                  <button className="p-2 hover:bg-[#2b2b40] rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Customer & Vehicle */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">👤</span>
                    <span className="text-white font-medium">
                      {workOrder.customerName}
                    </span>
                    <span className="text-gray-500">-</span>
                    <span className="text-gray-400 text-sm">
                      {workOrder.customerPhone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">🏍️</span>
                    <span className="text-gray-300 text-sm">
                      Xe: {workOrder.vehicleModel}
                    </span>
                    <span className="text-gray-500">-</span>
                    <span className="text-blue-400 text-sm font-mono">
                      {workOrder.licensePlate}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500">Trạng thái:</span>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${getStatusColor(
                      workOrder.status
                    )}`}
                  >
                    {getStatusIcon(workOrder.status)}
                    {workOrder.status}
                  </div>
                </div>

                {/* Technician & Total */}
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-400">
                    KTV:{" "}
                    <span className="text-gray-300">
                      {workOrder.technicianName || "Chưa phân"}
                    </span>
                  </div>
                  <div className="text-white font-semibold">
                    💰 {formatCurrency(workOrder.total || 0)}
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex border-t border-gray-800">
                <button
                  onClick={() => onCallCustomer(workOrder.customerPhone || "")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-[#2b2b40] transition-colors text-green-500"
                >
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-medium">Gọi</span>
                </button>
                <div className="w-px bg-gray-800" />
                <button
                  onClick={() => onEditWorkOrder(workOrder)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-[#2b2b40] transition-colors text-blue-500"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Sửa</span>
                </button>
                <div className="w-px bg-gray-800" />
                <button
                  onClick={() => onDeleteWorkOrder(workOrder)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-[#2b2b40] transition-colors text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Xóa</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* KHỐI D: FAB (Floating Action Button) */}
      <button
        onClick={onCreateWorkOrder}
        className="fixed bottom-4 right-4 w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg shadow-blue-500/50 flex items-center justify-center hover:from-blue-600 hover:to-blue-700 transition-all z-50 active:scale-95"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Filter Popup (Optional) */}
      {showFilterPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
          <div className="bg-[#1e1e2d] rounded-t-3xl md:rounded-2xl w-full md:max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Bộ lọc nâng cao
              </h3>
              <button
                onClick={() => setShowFilterPopup(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            {/* Add more filter options here */}
            <div className="text-gray-400 text-sm text-center py-8">
              Các tùy chọn lọc sẽ được bổ sung...
            </div>
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
