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
  Menu,
  Bell,
  Settings,
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

  // Get status badge color - Updated to match design spec
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Tiếp nhận":
        return "bg-[#009ef7]/10 text-[#009ef7] border-[#009ef7]/30";
      case "Đang sửa":
        return "bg-[#f1416c]/10 text-[#f1416c] border-[#f1416c]/30";
      case "Đã sửa xong":
        return "bg-[#50cd89]/10 text-[#50cd89] border-[#50cd89]/30";
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
      {/* KPI CARDS - Clickable for filtering */}
      <div className="bg-[#1e1e2d] border-b border-gray-800 p-3">
        <div className="grid grid-cols-2 gap-2">
          {/* Tiếp nhận */}
          <button
            onClick={() =>
              setStatusFilter(
                statusFilter === "Tiếp nhận" ? "all" : "Tiếp nhận"
              )
            }
            className={`p-3 rounded-xl text-left transition-all ${
              statusFilter === "Tiếp nhận"
                ? "bg-gradient-to-br from-[#009ef7]/20 to-[#009ef7]/10 border-2 border-[#009ef7] shadow-lg shadow-[#009ef7]/20"
                : "bg-[#2b2b40] border border-gray-700 hover:border-[#009ef7]/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">
                Tiếp nhận
              </span>
              <FileText className="w-4 h-4 text-[#009ef7]" />
            </div>
            <div className="text-2xl font-black text-white">
              {kpis.tiepNhan}
            </div>
          </button>

          {/* Đang sửa */}
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "Đang sửa" ? "all" : "Đang sửa")
            }
            className={`p-3 rounded-xl text-left transition-all ${
              statusFilter === "Đang sửa"
                ? "bg-gradient-to-br from-[#f1416c]/20 to-[#f1416c]/10 border-2 border-[#f1416c] shadow-lg shadow-[#f1416c]/20"
                : "bg-[#2b2b40] border border-gray-700 hover:border-[#f1416c]/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">
                Đang sửa
              </span>
              <Wrench className="w-4 h-4 text-[#f1416c]" />
            </div>
            <div className="text-2xl font-black text-white">{kpis.dangSua}</div>
          </button>

          {/* Đã sửa xong */}
          <button
            onClick={() =>
              setStatusFilter(
                statusFilter === "Đã sửa xong" ? "all" : "Đã sửa xong"
              )
            }
            className={`p-3 rounded-xl text-left transition-all ${
              statusFilter === "Đã sửa xong"
                ? "bg-gradient-to-br from-[#50cd89]/20 to-[#50cd89]/10 border-2 border-[#50cd89] shadow-lg shadow-[#50cd89]/20"
                : "bg-[#2b2b40] border border-gray-700 hover:border-[#50cd89]/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">
                Đã sửa xong
              </span>
              <Check className="w-4 h-4 text-[#50cd89]" />
            </div>
            <div className="text-2xl font-black text-white">
              {kpis.daHoanThanh}
            </div>
          </button>

          {/* Trả máy */}
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "Trả máy" ? "all" : "Trả máy")
            }
            className={`p-3 rounded-xl text-left transition-all ${
              statusFilter === "Trả máy"
                ? "bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500 shadow-lg shadow-purple-500/20"
                : "bg-[#2b2b40] border border-gray-700 hover:border-purple-500/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400 font-medium">
                Trả máy
              </span>
              <Key className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-black text-white">{kpis.traMay}</div>
          </button>
        </div>

        {/* Doanh thu & Lợi nhuận */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 border border-emerald-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-emerald-400 font-medium">
                Doanh thu hôm nay
              </span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-base font-black text-emerald-300">
              {formatCurrency(kpis.doanhThu)}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-blue-400 font-medium">
                Lợi nhuận hôm nay
              </span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-base font-black text-blue-300">
              {formatCurrency(kpis.loiNhuan)}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-[#1e1e2d] border-b border-gray-800 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Tìm tên, SĐT, biển số..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-[#2b2b40] border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#009ef7]"
          />
        </div>
      </div>

      {/* DANH SÁCH PHIẾU SỬA CHỮA */}
      <div className="flex-1 overflow-y-auto py-2 space-y-2 pb-20 scrollbar-hide">
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
          /* Work Order Cards - Compact for Mobile */
          filteredWorkOrders.map((workOrder) => (
            <div
              key={workOrder.id}
              onClick={() => onEditWorkOrder(workOrder)}
              className="bg-[#1e1e2d] rounded-xl border border-gray-800 overflow-hidden active:scale-[0.99] transition-transform"
            >
              {/* Card Content */}
              <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-[#009ef7] font-mono text-sm font-semibold mb-0.5">
                      {formatWorkOrderId(workOrder.id)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(workOrder.creationDate)}
                    </div>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold ${getStatusColor(
                      workOrder.status
                    )}`}
                  >
                    {getStatusIcon(workOrder.status)}
                    {workOrder.status}
                  </div>
                </div>

                {/* Customer & Vehicle */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👤</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {workOrder.customerName}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {workOrder.customerPhone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏍️</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-300 text-sm truncate">
                        {workOrder.vehicleModel}
                      </div>
                      <div className="text-[#009ef7] text-xs font-mono">
                        {workOrder.licensePlate}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                  <div className="text-xs text-gray-400">
                    KTV:{" "}
                    <span className="text-gray-300">
                      {workOrder.technicianName || "Chưa phân"}
                    </span>
                  </div>
                  <div className="text-white font-bold text-base">
                    {formatCurrency(workOrder.total || 0)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-3 border-t border-gray-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallCustomer(workOrder.customerPhone || "");
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 bg-green-500/10 hover:bg-green-500/20 transition-colors border-r border-gray-800"
                >
                  <Phone className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-semibold text-green-500">
                    Gọi
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditWorkOrder(workOrder);
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 bg-[#009ef7]/10 hover:bg-[#009ef7]/20 transition-colors border-r border-gray-800"
                >
                  <Edit2 className="w-4 h-4 text-[#009ef7]" />
                  <span className="text-xs font-semibold text-[#009ef7]">
                    Sửa
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteWorkOrder(workOrder);
                  }}
                  className="flex items-center justify-center gap-1.5 py-3 bg-[#f1416c]/10 hover:bg-[#f1416c]/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-[#f1416c]" />
                  <span className="text-xs font-semibold text-[#f1416c]">
                    Xóa
                  </span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB (Floating Action Button) */}
      <button
        onClick={onCreateWorkOrder}
        className="fixed bottom-20 right-4 w-12 h-12 bg-gradient-to-br from-[#009ef7] to-[#0077b6] rounded-full shadow-xl shadow-[#009ef7]/50 flex items-center justify-center hover:from-[#0077b6] hover:to-[#005a8a] transition-all z-[60] active:scale-95"
        aria-label="Tạo phiếu mới"
      >
        <Plus className="w-5 h-5 text-white" />
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
