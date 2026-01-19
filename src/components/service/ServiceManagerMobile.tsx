import React, { useState, useMemo, useCallback } from "react";
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
  Package,
  Eye,
  EyeOff,
} from "lucide-react";
import type { WorkOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import { ServiceHistory } from "./ServiceHistory";
import { useRepairTemplates, type RepairTemplate } from "../../hooks/useRepairTemplatesRepository";

import { RepairTemplatesModal } from "./components/RepairTemplatesModal";
import { PullToRefresh } from "../common/PullToRefresh";
import Skeleton, { CardSkeleton } from "../common/Skeleton";

interface ServiceManagerMobileProps {
  workOrders: WorkOrder[];
  onCreateWorkOrder: () => void;
  onEditWorkOrder: (workOrder: WorkOrder) => void;
  onDeleteWorkOrder: (workOrder: WorkOrder) => void;
  onCallCustomer: (phone: string) => void;
  onPrintWorkOrder: (workOrder: WorkOrder) => void;
  onOpenTemplates: () => void;
  onApplyTemplate: (template: RepairTemplate) => void;
  currentBranchId: string;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  setDateRangeDays: (days: number) => void;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

type StatusFilter =
  | "all"
  | "Tiếp nhận"
  | "Đang sửa"
  | "Đã sửa xong"
  | "Trả máy";

// Memoized WorkOrder Card Component
const WorkOrderCard = React.memo(({
  workOrder,
  onEdit,
  onCall,
  onPrint,
  onDelete,
  canDelete
}: {
  workOrder: WorkOrder;
  onEdit: (wo: WorkOrder) => void;
  onCall: (phone: string) => void;
  onPrint: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
  canDelete: boolean;
}) => {
  // Get status badge color
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
    <div
      onClick={() => onEdit(workOrder)}
      className="bg-white dark:bg-[#1e1e2d] rounded-lg border border-slate-200 dark:border-gray-800 overflow-hidden active:scale-[0.99] transition-transform shadow-sm"
    >
      {/* Card Content */}
      <div className="p-2.5">
        {/* Header - Single row: ID + Date + Status */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[#009ef7] font-mono text-xs font-semibold">
              {formatWorkOrderId(workOrder.id)}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-gray-500">
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
          <span className="text-slate-900 dark:text-white font-medium flex-1 min-w-0 truncate">
            {workOrder.customerName}
          </span>
          <span className="text-slate-600 dark:text-gray-500 text-xs shrink-0">
            {workOrder.customerPhone}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1.5 text-sm">
          <span className="text-xs">📱</span>
          <span className="text-slate-700 dark:text-gray-300 flex-1 min-w-0 truncate">
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
        <div className="pt-1.5 border-t border-slate-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
            <span className="text-slate-600 dark:text-gray-500 shrink-0">KTV:</span>
            <span className="text-slate-700 dark:text-gray-300 truncate">
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
          <div className="text-slate-900 dark:text-white font-bold text-sm">
            {formatCurrency(workOrder.total || 0)}
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-4 border-t border-slate-200 dark:border-gray-800">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCall(workOrder.customerPhone || "");
          }}
          className="flex items-center justify-center gap-1 py-3 bg-green-500/10 hover:bg-green-500/20 transition-colors border-r border-slate-200 dark:border-gray-800"
        >
          <Phone className="w-4 h-4 text-green-500" />
          <span className="text-[11px] font-semibold text-green-500">
            Gọi
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint(workOrder);
          }}
          className="flex items-center justify-center gap-1 py-3 bg-purple-500/10 hover:bg-purple-500/20 transition-colors border-r border-slate-200 dark:border-gray-800"
        >
          <Printer className="w-4 h-4 text-purple-500" />
          <span className="text-[11px] font-semibold text-purple-500">
            In
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(workOrder);
          }}
          className="flex items-center justify-center gap-1 py-3 bg-[#009ef7]/10 hover:bg-[#009ef7]/20 transition-colors border-r border-slate-200 dark:border-gray-800"
        >
          <Edit2 className="w-4 h-4 text-[#009ef7]" />
          <span className="text-[11px] font-semibold text-[#009ef7]">
            Sửa
          </span>
        </button>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(workOrder);
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
  );
});

export function ServiceManagerMobile({
  workOrders,
  onCreateWorkOrder,
  onEditWorkOrder,
  onDeleteWorkOrder,
  onCallCustomer,
  onPrintWorkOrder,
  onOpenTemplates,
  onApplyTemplate,
  currentBranchId,
  dateFilter,
  setDateFilter,

  setDateRangeDays,
  isLoading = false,
  onRefresh,
}: ServiceManagerMobileProps) {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "history" | "templates">("orders");
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);

  // Financial data visibility state (owner-only feature)
  const [showFinancials, setShowFinancials] = useState(false);
  const isOwner = profile?.role === "owner";

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  // Templates data
  const { data: templates } = useRepairTemplates();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  // Debounced create work order handler to prevent duplicate creation
  const handleCreateWorkOrder = useCallback(() => {
    if (isCreating) return;

    setIsCreating(true);
    onCreateWorkOrder();

    // Reset after 2 seconds to allow new creation
    setTimeout(() => {
      setIsCreating(false);
    }, 2000);
  }, [isCreating, onCreateWorkOrder]);

  // Filter work orders by date first
  const dateFilteredWorkOrders = useMemo(() => {
    const NOW = new Date();
    const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

    return workOrders.filter(w => {
      if (!w.creationDate) return false;
      const date = new Date(w.creationDate);

      switch (dateFilter) {
        case "today":
          return date >= startOfToday;
        case "week": {
          const sevenDaysAgo = new Date(NOW);
          sevenDaysAgo.setDate(NOW.getDate() - 7);
          return date >= sevenDaysAgo;
        }
        case "month": {
          const thirtyDaysAgo = new Date(NOW);
          thirtyDaysAgo.setDate(NOW.getDate() - 30);
          return date >= thirtyDaysAgo;
        }
        case "all":
        default:
          return true;
      }
    });
  }, [workOrders, dateFilter]);

  // Optimized KPI Calculation - Single pass
  const kpis = useMemo(() => {
    let tiepNhan = 0;
    let dangSua = 0;
    let daHoanThanh = 0;
    let traMay = 0;
    let doanhThu = 0;
    let loiNhuan = 0;

    dateFilteredWorkOrders.forEach(w => {
      // Count status
      switch (w.status) {
        case "Tiếp nhận": tiepNhan++; break;
        case "Đang sửa": dangSua++; break;
        case "Đã sửa xong": daHoanThanh++; break;
        case "Trả máy": traMay++; break;
      }

      // Calculate Revenue & Profit for paid orders
      if (w.paymentStatus === "paid" || (w.paymentStatus === "partial" && (w.totalPaid || 0) > 0)) {
        // Fix: Use totalPaid for partial payments, total for fully paid
        // Actually for revenue typically we want realized revenue (cash in)
        // But the previous code used w.total. Let's stick to w.total for consistency with desktop 
        // if desktop uses total. But wait, previous mobile code used w.total ONLY if paid.
        // Let's stick to previous logic: only count if "paid".
        // MODIFY: Also count if partial? The user screenshot shows "paid" icon.

        // Reverting to previous logic strictly but ensuring we use the date filtered list
        if (w.paymentStatus === "paid") {
          const total = w.total || 0;
          doanhThu += total;

          // Calculate costs
          const partsCost = w.partsUsed?.reduce(
            (s, p) => s + (p.costPrice || 0) * (p.quantity || 1),
            0
          ) || 0;

          const servicesCost = w.additionalServices?.reduce(
            (s, svc) => s + (svc.costPrice || 0) * (svc.quantity || 1),
            0
          ) || 0;

          loiNhuan += (total - partsCost - servicesCost);
        }
      }
    });

    return { tiepNhan, dangSua, daHoanThanh, traMay, doanhThu, loiNhuan };
  }, [dateFilteredWorkOrders]);

  // Get date label
  const getDateLabel = () => {
    switch (dateFilter) {
      case "today":
        return "hôm nay";
      case "week":
        return "7 ngày qua";
      case "month":
        return "tháng này";
      case "all":
        return "tất cả";
      default:
        return "";
    }
  };

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    let filtered = dateFilteredWorkOrders;

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
  }, [dateFilteredWorkOrders, statusFilter, searchQuery]);

  const canDeleteWorkOrder = canDo(profile?.role, "work_order.delete");

  return (
    <div className="md:hidden flex flex-col h-screen bg-slate-50 dark:bg-[#151521]">
      {/* CONTENT BASED ON TAB */}
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        {activeTab === "orders" && (
          <>
            {/* KPI CARDS */}
            <div className="bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-800 p-2">
              <div className="grid grid-cols-4 gap-1.5">
                {/* Tiếp nhận */}
                <button
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "Tiếp nhận" ? "all" : "Tiếp nhận"
                    )
                  }
                  className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Tiếp nhận"
                    ? "bg-gradient-to-br from-[#009ef7]/20 to-[#009ef7]/10 border-2 border-[#009ef7]"
                    : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                    }`}
                >
                  <FileText className="w-4 h-4 text-[#009ef7] mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.tiepNhan}</div>
                  <span className="text-[8px] text-slate-600 dark:text-gray-400">Tiếp nhận</span>
                </button>

                {/* Đang sửa */}
                <button
                  onClick={() =>
                    setStatusFilter(statusFilter === "Đang sửa" ? "all" : "Đang sửa")
                  }
                  className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Đang sửa"
                    ? "bg-gradient-to-br from-[#f1416c]/20 to-[#f1416c]/10 border-2 border-[#f1416c]"
                    : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                    }`}
                >
                  <Wrench className="w-4 h-4 text-[#f1416c] mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.dangSua}</div>
                  <span className="text-[8px] text-slate-600 dark:text-gray-400">Đang sửa</span>
                </button>

                {/* Đã sửa xong */}
                <button
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "Đã sửa xong" ? "all" : "Đã sửa xong"
                    )
                  }
                  className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Đã sửa xong"
                    ? "bg-gradient-to-br from-[#50cd89]/20 to-[#50cd89]/10 border-2 border-[#50cd89]"
                    : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                    }`}
                >
                  <Check className="w-4 h-4 text-[#50cd89] mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {kpis.daHoanThanh}
                  </div>
                  <span className="text-[8px] text-slate-600 dark:text-gray-400">Đã sửa</span>
                </button>

                {/* Trả máy */}
                <button
                  onClick={() =>
                    setStatusFilter(statusFilter === "Trả máy" ? "all" : "Trả máy")
                  }
                  className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Trả máy"
                    ? "bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500"
                    : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                    }`}
                >
                  <Key className="w-4 h-4 text-purple-500 mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.traMay}</div>
                  <span className="text-[8px] text-slate-600 dark:text-gray-400">Trả máy</span>
                </button>
              </div>

              {/* Doanh thu & Lợi nhuận */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 shadow-lg shadow-emerald-500/20 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-emerald-50 opacity-90">
                      Doanh thu {getDateLabel()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isOwner && (
                        <button
                          onClick={() => setShowFinancials(!showFinancials)}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                          aria-label="Toggle revenue visibility"
                        >
                          {showFinancials ? (
                            <Eye className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                      )}
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-base font-black text-white">
                    {showFinancials ? formatCurrency(kpis.doanhThu) : "•••••••"}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 shadow-lg shadow-blue-500/20 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-blue-50 opacity-90">
                      Lợi nhuận {getDateLabel()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isOwner && (
                        <button
                          onClick={() => setShowFinancials(!showFinancials)}
                          className="p-1 hover:bg-white/20 rounded transition-colors"
                          aria-label="Toggle profit visibility"
                        >
                          {showFinancials ? (
                            <Eye className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                      )}
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-base font-black text-white">
                    {showFinancials ? formatCurrency(kpis.loiNhuan) : "•••••••"}
                  </div>
                </div>
              </div>
            </div>

            {/* SEARCH BAR & DATE FILTER */}
            <div className="bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-800 px-2 py-2 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Tìm tên, SĐT, IMEI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-[#009ef7]"
                />
              </div>

              {/* Date Filter Segmented Control */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                {[
                  { label: "Hôm nay", value: "today" },
                  { label: "7 ngày", value: "week" },
                  { label: "Tháng", value: "month" },
                  { label: "Tất cả", value: "all" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDateFilter(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${dateFilter === option.value
                      ? "bg-[#009ef7]/20 text-[#009ef7] border border-[#009ef7]/50"
                      : "bg-slate-100 dark:bg-[#2b2b40] text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-gray-700"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* DANH SÁCH PHIẾU SỬA CHỮA */}
            <PullToRefresh onRefresh={onRefresh || (async () => { })}>
              <div className="space-y-2 px-2 pb-4 min-h-[50vh]">
                {isLoading ? (
                  // Loading Skeletons using shared Skeleton component
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-[#1e1e2d] rounded-lg border border-slate-200 dark:border-gray-800 p-4 space-y-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2">
                          <Skeleton width={60} height={20} className="bg-slate-700/50" />
                          <Skeleton width={80} height={20} className="bg-slate-700/50" />
                        </div>
                        <Skeleton width={70} height={24} className="rounded-full bg-slate-700/50" />
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Skeleton variant="circle" width={16} height={16} className="bg-slate-700/50" />
                          <Skeleton width="60%" height={16} className="bg-slate-300 dark:bg-slate-700/50" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton variant="circle" width={16} height={16} className="bg-slate-700/50" />
                          <Skeleton width="40%" height={16} className="bg-slate-700/50" />
                        </div>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-gray-800 items-end">
                        <div className="flex gap-2">
                          <Skeleton width={24} height={24} className="rounded-md bg-slate-700/50" />
                          <Skeleton width={24} height={24} className="rounded-md bg-slate-700/50" />
                        </div>
                        <Skeleton width={90} height={20} className="bg-slate-700/50" />
                      </div>
                    </div>
                  ))
                ) : filteredWorkOrders.length === 0 ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
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
                    <h3 className="text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">
                      Chưa có phiếu sửa chữa nào!
                    </h3>
                    <p className="text-slate-600 dark:text-gray-500 mb-6">
                      Hãy tạo phiếu đầu tiên để quản lý dịch vụ sửa chữa
                    </p>
                    <button
                      onClick={handleCreateWorkOrder}
                      disabled={isCreating}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Tạo phiếu mới
                    </button>
                  </div>
                ) : (
                  /* Work Order Cards - Compact for Mobile */
                  filteredWorkOrders.map((workOrder) => (
                    <WorkOrderCard
                      key={workOrder.id}
                      workOrder={workOrder}
                      onEdit={onEditWorkOrder}
                      onCall={onCallCustomer}
                      onPrint={onPrintWorkOrder}
                      onDelete={onDeleteWorkOrder}
                      canDelete={canDeleteWorkOrder}
                    />
                  ))
                )}
              </div>
            </PullToRefresh>

            {/* FAB (Floating Action Button) */}
            <button
              onClick={handleCreateWorkOrder}
              disabled={isCreating}
              className="fixed bottom-20 right-4 w-12 h-12 bg-gradient-to-br from-[#009ef7] to-[#0077b6] rounded-full shadow-xl shadow-[#009ef7]/50 flex items-center justify-center hover:from-[#0077b6] hover:to-[#005a8a] transition-all z-[60] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Tạo phiếu mới"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* HISTORY TAB */}
        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="pb-20">
            <ServiceHistory currentBranchId={currentBranchId} />
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <div className="p-3">
            <div className="space-y-3">
              {templates?.map((template) => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 border border-slate-200 dark:border-gray-800 active:bg-slate-50 dark:active:bg-[#2b2b40] transition-colors cursor-pointer"
                  onClick={() => onApplyTemplate(template)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-500 mt-1">
                        {template.description}
                      </p>
                    </div>
                    <span className="text-[#009ef7] font-bold">
                      {formatCurrency(
                        template.labor_cost +
                        (template.parts?.reduce(
                          (s: number, p: any) => s + p.price * p.quantity,
                          0
                        ) || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-gray-400 mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      {template.duration} phút
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {template.parts?.length || 0} phụ tùng
                    </div>
                  </div>
                </div>
              ))}

              {(!templates || templates.length === 0) && (
                <div className="text-center py-10 text-slate-600 dark:text-gray-500">
                  Chưa có mẫu sửa chữa nào
                </div>
              )}
            </div>

            {/* FAB for Templates */}
            <button
              onClick={() => {
                // Open template modal for creating
                // Since we don't have direct access to open the modal in create mode easily without prop drilling or state lift, 
                // we can use the existing onOpenTemplates which opens the modal in ServiceManager.
                // Ideally we should refactor to handle it here, but for now:
                onOpenTemplates();
              }}
              className="fixed bottom-20 right-4 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full shadow-xl shadow-purple-500/50 flex items-center justify-center hover:from-purple-600 hover:to-purple-800 transition-all z-[60] active:scale-95"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Filter Popup (Optional) */}
        {showFilterPopup && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
            <div className="bg-white dark:bg-[#1e1e2d] rounded-t-3xl md:rounded-2xl w-full md:max-w-md p-6 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Bộ lọc nâng cao
                </h3>
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="text-slate-600 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              {/* Add more filter options here */}
              <div className="text-slate-600 dark:text-gray-400 text-sm text-center py-8">
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

      {/* BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-gray-800 px-6 py-2 z-[100] flex justify-between items-center pb-safe">
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "orders" ? "text-[#009ef7]" : "text-slate-600 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300"
            }`}
        >
          <ClipboardList className={`w-6 h-6 ${activeTab === "orders" ? "fill-current/20" : ""}`} />
          <span className="text-[10px] font-medium">Tổng quan</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "history" ? "text-[#009ef7]" : "text-slate-600 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300"
            }`}
        >
          <History className={`w-6 h-6 ${activeTab === "history" ? "fill-current/20" : ""}`} />
          <span className="text-[10px] font-medium">Lịch sử</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === "templates" ? "text-[#009ef7]" : "text-gray-500 hover:text-gray-300"
            }`}
        >
          <FileText className={`w-6 h-6 ${activeTab === "templates" ? "fill-current/20" : ""}`} />
          <span className="text-[10px] font-medium">Mẫu SC</span>
        </button>
      </div>
    </div>
  );
}
