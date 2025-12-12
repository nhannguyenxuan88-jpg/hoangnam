import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
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
  Printer,
  ChevronRight,
  MoreVertical,
  Menu,
  Bell,
  Settings,
  History,
  ClipboardList,
} from "lucide-react";
import type { WorkOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";

interface ServiceManagerMobileProps {
  workOrders: WorkOrder[];
  onCreateWorkOrder: () => void;
  onEditWorkOrder: (workOrder: WorkOrder) => void;
  onDeleteWorkOrder: (workOrder: WorkOrder) => void;
  onCallCustomer: (phone: string) => void;
  onPrintWorkOrder: (workOrder: WorkOrder) => void;
  onOpenTemplates: () => void;
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
  onPrintWorkOrder,
  onOpenTemplates,
  currentBranchId,
}: ServiceManagerMobileProps) {
  const { profile } = useAuth();
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

    // Only count orders that are paid today
    const today = new Date().toDateString();
    const paidTodayOrders = workOrders.filter(
      (w) =>
        w.paymentStatus === "paid" &&
        new Date(w.creationDate).toDateString() === today
    );

    const doanhThu = paidTodayOrders.reduce(
      (sum, w) => sum + (w.total || 0),
      0
    );

    // Profit = Revenue - Cost (parts cost + additional services cost)
    const loiNhuan = paidTodayOrders.reduce((sum, w) => {
      // Calculate parts cost (costPrice * quantity)
      const partsCost =
        w.partsUsed?.reduce(
          (s, p) => s + (p.costPrice || 0) * (p.quantity || 1),
          0
        ) || 0;
      // Calculate additional services cost
      const servicesCost =
        w.additionalServices?.reduce(
          (s, svc) => s + (svc.costPrice || 0) * (svc.quantity || 1),
          0
        ) || 0;
      // Profit = total - costs
      return sum + ((w.total || 0) - partsCost - servicesCost);
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
      case "Đã sửa xong":
        return <Check className="w-4 h-4" />;
      case "Trả máy":
        return <Key className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="md:hidden flex flex-col h-screen bg-[#151521]">
      {/* KPI CARDS - Clickable for filtering - 4 columns compact */}
      <div className="bg-[#1e1e2d] border-b border-gray-800 p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {/* Tiếp nhận */}
          <button
            onClick={() =>
              setStatusFilter(
                statusFilter === "Tiếp nhận" ? "all" : "Tiếp nhận"
              )
            }
            className={`p-2 rounded-lg text-center transition-all ${
              statusFilter === "Tiếp nhận"
                ? "bg-gradient-to-br from-[#009ef7]/20 to-[#009ef7]/10 border-2 border-[#009ef7]"
                : "bg-[#2b2b40] border border-gray-700"
            }`}
          >
            <FileText className="w-4 h-4 text-[#009ef7] mx-auto mb-0.5" />
            <div className="text-lg font-bold text-white">{kpis.tiepNhan}</div>
            <span className="text-[8px] text-gray-400">Tiếp nhận</span>
          </button>

          {/* Đang sửa */}
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "Đang sửa" ? "all" : "Đang sửa")
            }
            className={`p-2 rounded-lg text-center transition-all ${
              statusFilter === "Đang sửa"
                ? "bg-gradient-to-br from-[#f1416c]/20 to-[#f1416c]/10 border-2 border-[#f1416c]"
                : "bg-[#2b2b40] border border-gray-700"
            }`}
          >
            <Wrench className="w-4 h-4 text-[#f1416c] mx-auto mb-0.5" />
            <div className="text-lg font-bold text-white">{kpis.dangSua}</div>
            <span className="text-[8px] text-gray-400">Đang sửa</span>
          </button>

          {/* Đã sửa xong */}
          <button
            onClick={() =>
              setStatusFilter(
                statusFilter === "Đã sửa xong" ? "all" : "Đã sửa xong"
              )
            }
            className={`p-2 rounded-lg text-center transition-all ${
              statusFilter === "Đã sửa xong"
                ? "bg-gradient-to-br from-[#50cd89]/20 to-[#50cd89]/10 border-2 border-[#50cd89]"
                : "bg-[#2b2b40] border border-gray-700"
            }`}
          >
            <Check className="w-4 h-4 text-[#50cd89] mx-auto mb-0.5" />
            <div className="text-lg font-bold text-white">
              {kpis.daHoanThanh}
            </div>
            <span className="text-[8px] text-gray-400">Đã sửa</span>
          </button>

          {/* Trả máy */}
          <button
            onClick={() =>
              setStatusFilter(statusFilter === "Trả máy" ? "all" : "Trả máy")
            }
            className={`p-2 rounded-lg text-center transition-all ${
              statusFilter === "Trả máy"
                ? "bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500"
                : "bg-[#2b2b40] border border-gray-700"
            }`}
          >
            <Key className="w-4 h-4 text-purple-500 mx-auto mb-0.5" />
            <div className="text-lg font-bold text-white">{kpis.traMay}</div>
            <span className="text-[8px] text-gray-400">Trả máy</span>
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

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onOpenTemplates}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-300">Mẫu SC</span>
          </button>
          <Link
            to="/service-history"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg transition-colors"
          >
            <History className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-300">
              Lịch sử SC
            </span>
          </Link>
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
              className="bg-[#1e1e2d] rounded-lg border border-gray-800 overflow-hidden active:scale-[0.99] transition-transform"
            >
              {/* Card Content */}
              <div className="p-2.5">
                {/* Header - Single row: ID + Date + Status */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#009ef7] font-mono text-xs font-semibold">
                      {formatWorkOrderId(workOrder.id)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {formatDate(workOrder.creationDate)}
                    </span>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${getStatusColor(
                      workOrder.status
                    )}`}
                  >
                    {getStatusIcon(workOrder.status)}
                    {workOrder.status}
                  </div>
                </div>

                {/* Customer & Vehicle - Single row */}
                <div className="flex items-center gap-2 mb-1.5 text-sm">
                  <span className="text-xs">👤</span>
                  <span className="text-white font-medium flex-1 min-w-0 truncate">
                    {workOrder.customerName}
                  </span>
                  <span className="text-gray-500 text-xs shrink-0">
                    {workOrder.customerPhone}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1.5 text-sm">
                  <span className="text-xs">🏍️</span>
                  <span className="text-gray-300 flex-1 min-w-0 truncate">
                    {workOrder.vehicleModel}
                  </span>
                  <span className="text-[#009ef7] text-xs font-mono shrink-0">
                    {workOrder.licensePlate}
                  </span>
                </div>
                {/* Issue Description - More compact */}
                {workOrder.issueDescription && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1.5 truncate">
                    <span>🔧</span>
                    <span className="truncate">
                      {workOrder.issueDescription}
                    </span>
                  </div>
                )}

                {/* Footer - Compact single row */}
                <div className="pt-1.5 border-t border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
                    <span className="text-gray-500 shrink-0">KTV:</span>
                    <span className="text-gray-300 truncate">
                      {workOrder.technicianName || "Chưa phân"}
                    </span>
                    {/* Payment badge */}
                    {workOrder.paymentStatus === "paid" &&
                      workOrder.remainingAmount === 0 && (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]">
                          ✓ Đủ
                        </span>
                      )}
                    {((workOrder.depositAmount &&
                      workOrder.depositAmount > 0) ||
                      workOrder.paymentStatus === "partial") &&
                      (workOrder.remainingAmount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                          Nợ {formatCurrency(workOrder.remainingAmount || 0)}
                        </span>
                      )}
                    {workOrder.paymentStatus === "unpaid" &&
                      (!workOrder.depositAmount ||
                        workOrder.depositAmount === 0) && (
                        <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded text-[10px]">
                          Chưa TT
                        </span>
                      )}
                  </div>
                  <div className="text-white font-bold text-sm">
                    {formatCurrency(workOrder.total || 0)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-4 border-t border-gray-800">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallCustomer(workOrder.customerPhone || "");
                  }}
                  className="flex items-center justify-center gap-1 py-3 bg-green-500/10 hover:bg-green-500/20 transition-colors border-r border-gray-800"
                >
                  <Phone className="w-4 h-4 text-green-500" />
                  <span className="text-[11px] font-semibold text-green-500">
                    Gọi
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrintWorkOrder(workOrder);
                  }}
                  className="flex items-center justify-center gap-1 py-3 bg-purple-500/10 hover:bg-purple-500/20 transition-colors border-r border-gray-800"
                >
                  <Printer className="w-4 h-4 text-purple-500" />
                  <span className="text-[11px] font-semibold text-purple-500">
                    In
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditWorkOrder(workOrder);
                  }}
                  className="flex items-center justify-center gap-1 py-3 bg-[#009ef7]/10 hover:bg-[#009ef7]/20 transition-colors border-r border-gray-800"
                >
                  <Edit2 className="w-4 h-4 text-[#009ef7]" />
                  <span className="text-[11px] font-semibold text-[#009ef7]">
                    Sửa
                  </span>
                </button>
                {canDo(profile?.role, "work_order.delete") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteWorkOrder(workOrder);
                    }}
                    className="flex items-center justify-center gap-1 py-3 bg-[#f1416c]/10 hover:bg-[#f1416c]/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-[#f1416c]" />
                    <span className="text-[11px] font-semibold text-[#f1416c]">
                      Xóa
                    </span>
                  </button>
                )}
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
