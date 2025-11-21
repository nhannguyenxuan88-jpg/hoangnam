import React, { useState, useMemo, useRef, useEffect } from "react";
import { User, Bike } from "lucide-react";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useCreateCustomersBulk,
} from "../../hooks/useSupabase";
import { formatDate, formatCurrency, formatAnyId } from "../../utils/format";
import { PlusIcon, TrashIcon, XMarkIcon, UsersIcon } from "../Icons";
import type { Customer, Sale, WorkOrder, Vehicle } from "../../types";
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";

// --- COMPONENTS ---

// Customer History Modal Component
interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  sales: Sale[];
  workOrders: WorkOrder[];
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  isOpen,
  onClose,
  customer,
  sales,
  workOrders,
}) => {
  const [activeTab, setActiveTab] = useState<"sales" | "workorders">("sales");

  if (!isOpen || !customer) return null;

  // Filter by customer
  const customerSales = sales.filter(
    (s) =>
      s.customer?.id === customer.id || s.customer?.phone === customer.phone
  );
  const customerWorkOrders = workOrders.filter(
    (wo) => wo.customerPhone === customer.phone
  );

  // Calculate actual total spent from sales and work orders
  const totalSpentFromSales = customerSales.reduce(
    (sum, sale) => sum + (sale.total || 0),
    0
  );
  const totalSpentFromWorkOrders = customerWorkOrders.reduce(
    (sum, wo) => sum + (wo.total || 0),
    0
  );
  const actualTotalSpent = totalSpentFromSales + totalSpentFromWorkOrders;

  // Calculate actual visit count from unique dates
  const allVisitDates = [
    ...customerSales.map((s) => new Date(s.date).toDateString()),
    ...customerWorkOrders.map((wo) =>
      new Date(wo.creationDate || wo.id).toDateString()
    ),
  ];
  const uniqueVisitDates = new Set(allVisitDates);
  const actualVisitCount = uniqueVisitDates.size;

  // Calculate loyalty points: 1 point = 10,000đ
  const actualLoyaltyPoints = Math.floor(actualTotalSpent / 10000);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Lịch sử: {customer.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              📞 {customer.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {customerSales.length}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Hóa đơn
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {customerWorkOrders.length}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Phiếu SC
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(actualTotalSpent)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Tổng chi
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {actualVisitCount}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Lần đến
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              ⭐ {actualLoyaltyPoints.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Điểm TL
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-4 border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "sales"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            🛒 Hóa đơn ({customerSales.length})
          </button>
          <button
            onClick={() => setActiveTab("workorders")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "workorders"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            🔧 Phiếu sửa chữa ({customerWorkOrders.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {activeTab === "sales" ? (
            <div className="space-y-3">
              {customerSales.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Chưa có hóa đơn nào
                </div>
              ) : (
                customerSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-blue-600 dark:text-blue-400">
                          {sale.sale_code || sale.id}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(sale.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(sale.total)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {sale.paymentMethod === "cash"
                            ? "💵 Tiền mặt"
                            : "🏦 CK"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {sale.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="text-sm text-slate-700 dark:text-slate-300 flex justify-between"
                        >
                          <span>
                            {item.quantity} x {item.partName}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(item.quantity * item.sellingPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {customerWorkOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  Chưa có phiếu sửa chữa nào
                </div>
              ) : (
                customerWorkOrders.map((wo) => {
                  const isCompleted =
                    wo.status === "Trả máy" || wo.status === "Đã sửa xong";
                  const isInProgress = wo.status === "Đang sửa";
                  const statusClass = isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : isInProgress
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
                  const statusLabel = isCompleted
                    ? "Hoàn thành"
                    : isInProgress
                    ? "Đang SC"
                    : "Chờ xử lý";

                  return (
                    <div
                      key={wo.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-green-600 dark:text-green-400">
                            {formatAnyId(wo.id)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {wo.vehicleModel} - {wo.licensePlate}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(wo.total)}
                          </div>
                          <div
                            className={`text-xs px-2 py-1 rounded inline-block ${statusClass}`}
                          >
                            {statusLabel}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        <div className="mb-2">
                          <span className="font-medium">Vấn đề:</span>{" "}
                          {wo.issueDescription}
                        </div>
                        {wo.partsUsed && wo.partsUsed.length > 0 && (
                          <div>
                            <span className="font-medium">Phụ tùng:</span>
                            <div className="ml-4 space-y-1 mt-1">
                              {wo.partsUsed.map((part: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="text-xs flex justify-between"
                                >
                                  <span>
                                    {part.quantity} x {part.name}
                                  </span>
                                  <span>
                                    {formatCurrency(part.price * part.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Auto-classify customer segment based on business rules
const classifyCustomer = (customer: Customer): Customer["segment"] => {
  const points = customer.loyaltyPoints || 0;
  const spent = customer.totalSpent || 0;
  const visits = customer.visitCount || 0;
  const lastVisit = customer.lastVisit
    ? new Date(customer.lastVisit)
    : new Date();
  const daysSinceLastVisit = Math.floor(
    (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
  );

  // VIP: >= 5000 points OR >= 20M spent OR >= 20 visits
  if (points >= 5000 || spent >= 20000000 || visits >= 20) {
    return "VIP";
  }

  // Loyal: >= 2000 points OR >= 10M spent OR >= 10 visits
  if (points >= 2000 || spent >= 10000000 || visits >= 10) {
    return "Loyal";
  }

  // Lost: No visit in 180+ days (6 months)
  if (daysSinceLastVisit > 180 && visits > 0) {
    return "Lost";
  }

  // At Risk: No visit in 90+ days (3 months) but not lost yet
  if (daysSinceLastVisit > 90 && visits > 0) {
    return "At Risk";
  }

  // Potential: Has visited 2-9 times
  if (visits >= 2 && visits < 10) {
    return "Potential";
  }

  // New: First time or very few visits
  return "New";
};

// --- MAIN COMPONENT ---

const CustomerManager: React.FC = () => {
  // Lấy danh sách khách hàng từ Supabase
  const { data: customers = [], isLoading, refetch } = useCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  // State cho Load More
  const [displayCount, setDisplayCount] = useState(20);

  // Hàm lưu khách hàng (tạo mới hoặc cập nhật)
  const handleSaveCustomer = async (c: Partial<Customer> & { id?: string }) => {
    if (c.id) {
      // Cập nhật
      await updateCustomer.mutateAsync({ id: c.id, updates: c });
    } else {
      // Tạo mới, sinh id nếu chưa có
      const newCustomer = {
        ...c,
        id: `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
      await createCustomer.mutateAsync(newCustomer);
    }
    refetch();
    setEditCustomer(null);
  };
  const [search, setSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  // STATE MỚI: Cho việc thêm Nhà cung cấp
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">(
    "customers"
  );
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewHistoryCustomer, setViewHistoryCustomer] =
    useState<Customer | null>(null);

  // Fetch sales and work orders for history
  const { data: allSales = [] } = useSalesRepo();
  const { data: allWorkOrders = [] } = useWorkOrdersRepo();

  // Reset display count khi search hoặc filter thay đổi
  useEffect(() => {
    setDisplayCount(20);
  }, [search, activeFilter]);

  // Helper function to calculate actual loyalty points for a customer
  const calculateLoyaltyPoints = (customer: Customer) => {
    const customerSales = allSales.filter(
      (s) =>
        s.customer?.id === customer.id || s.customer?.phone === customer.phone
    );
    const customerWorkOrders = allWorkOrders.filter(
      (wo) => wo.customerPhone === customer.phone
    );

    const totalFromSales = customerSales.reduce(
      (sum, s) => sum + (s.total || 0),
      0
    );
    const totalFromWorkOrders = customerWorkOrders.reduce(
      (sum, wo) => sum + (wo.total || 0),
      0
    );
    const totalSpent = totalFromSales + totalFromWorkOrders;

    // 1 điểm = 10,000đ
    return Math.floor(totalSpent / 10000);
  };

  // Auto-classify customers on mount only
  useEffect(() => {
    let hasChanges = false;
    customers.forEach((customer) => {
      if (!customer.segment) {
        const newSegment = classifyCustomer(customer);
        hasChanges = true;
        // Cập nhật segment lên Supabase
        updateCustomer.mutate({
          id: customer.id,
          updates: { segment: newSegment },
        });
      }
    });
  }, [customers.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q))
    );

    // Apply segment filter
    if (activeFilter !== "all") {
      const segmentMap: Record<string, string> = {
        vip: "VIP",
        loyal: "Loyal",
        potential: "Potential",
        "at-risk": "At Risk",
        lost: "Lost",
        new: "New",
      };
      const targetSegment = segmentMap[activeFilter];
      result = result.filter((c) => c.segment === targetSegment);
    }

    return result;
  }, [customers, search, activeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xoá khách hàng này?")) return;
    // Xóa khách hàng trên Supabase
    await updateCustomer.mutateAsync({ id, updates: { status: "inactive" } });
    refetch();
  };

  // Statistics calculations
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === "active").length;
    return {
      total,
      active,
      newThisMonth: customers.filter((c) => {
        if (!c.created_at) return false;
        const date = new Date(c.created_at);
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }).length,
      revenue: 0, // Placeholder
      vip: customers.filter((c) => c.segment === "VIP").length,
      loyal: customers.filter((c) => c.segment === "Loyal").length,
      potential: customers.filter((c) => c.segment === "Potential").length,
      atRisk: customers.filter((c) => c.segment === "At Risk").length,
      lost: customers.filter((c) => c.segment === "Lost").length,
      new: customers.filter((c) => c.segment === "New").length,
    };
  }, [customers]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Tabs Header - Fixed */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none z-20 shadow-sm">
        <div className="flex items-center px-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-2 px-4 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "customers"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UsersIcon className="w-5 h-5" />
            <span>Khách hàng ({stats.total})</span>
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 px-4 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "suppliers"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Nhà cung cấp (0)</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Area */}
      {activeTab === "customers" ? (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 pb-4 -mt-2 pt-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm transition-all">
            <div className="flex flex-col md:flex-row gap-3 mb-4">
              <div className="flex-1 relative w-full">
                <svg
                  className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Tìm theo tên, SĐT, biển số xe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span>Upload DS</span>
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
                  onClick={() => alert("Tính năng đang phát triển")}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span>Nhắc BD</span>
                </button>
                <button
                  onClick={() => setEditCustomer({} as Customer)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Thêm KH</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {[
                {
                  id: "all",
                  label: "Tất cả",
                  shortLabel: "Tất cả",
                  color: "blue",
                  icon: "●",
                },
                {
                  id: "vip",
                  label: "VIP",
                  shortLabel: "VIP",
                  color: "purple",
                  icon: "👑",
                },
                {
                  id: "loyal",
                  label: "Trung thành",
                  shortLabel: "Trung thành",
                  color: "blue",
                  icon: "💎",
                },
                {
                  id: "potential",
                  label: "Tiềm năng",
                  shortLabel: "Tiềm năng",
                  color: "green",
                  icon: "⭐",
                },
                {
                  id: "at-risk",
                  label: "Cần chăm sóc",
                  shortLabel: "Cần CS",
                  color: "orange",
                  icon: "⚠️",
                },
                {
                  id: "lost",
                  label: "Đã mất",
                  shortLabel: "Đã mất",
                  color: "red",
                  icon: "❌",
                },
                {
                  id: "new",
                  label: "Khách mới",
                  shortLabel: "Khách mới",
                  color: "cyan",
                  icon: "🆕",
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-2 py-1 md:px-3 md:py-1.5 rounded-md text-[10px] md:text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-0.5 md:gap-1 ${
                    activeFilter === filter.id
                      ? `bg-${filter.color}-600 text-white border-${filter.color}-600 shadow-md`
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="text-xs md:text-sm">{filter.icon}</span>
                  <span className="hidden sm:inline">{filter.label}</span>
                  <span className="inline sm:hidden">{filter.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Statistics Section - Scrolled with content */}
          <div className="mb-6 mt-2">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-slate-600 dark:text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Thống kê tổng quan
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Total Customers */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">
                  Tổng khách hàng
                </div>
                <div className="text-blue-900 dark:text-blue-100 text-3xl font-bold">
                  {stats.total}
                </div>
                <div className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                  {stats.active} hoạt động
                </div>
              </div>

              {/* New This Month */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">
                  Khách mới tháng này
                </div>
                <div className="text-green-900 dark:text-green-100 text-3xl font-bold">
                  {stats.newThisMonth}
                </div>
                <div className="text-green-600 dark:text-green-400 text-xs mt-1">
                  ↑ 0.0% so với tháng trước
                </div>
              </div>

              {/* Average Revenue */}
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-1">
                  Doanh thu trung bình
                </div>
                <div className="text-purple-900 dark:text-purple-100 text-3xl font-bold">
                  0 đ
                </div>
                <div className="text-purple-600 dark:text-purple-400 text-xs mt-1">
                  / khách hàng
                </div>
              </div>

              {/* At Risk */}
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="text-orange-600 dark:text-orange-400 text-sm font-medium mb-1">
                  Cần chăm sóc
                </div>
                <div className="text-orange-900 dark:text-orange-100 text-3xl font-bold">
                  {stats.atRisk}
                </div>
                <div className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                  0 đ tiềm năng
                </div>
              </div>
            </div>
          </div>

          {/* Customer Cards Grid */}
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-16 h-16 text-slate-300 dark:text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                Không tìm thấy khách hàng nào.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.slice(0, displayCount).map((customer) => {
                  const segmentConfig = {
                    VIP: {
                      bg: "bg-gradient-to-br from-purple-400 to-purple-600 dark:from-purple-500 dark:to-purple-700",
                      text: "VIP",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m3 7 5 5-5 5 19-5L3 7Z"
                          />
                        </svg>
                      ),
                    },
                    Loyal: {
                      bg: "bg-gradient-to-br from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700",
                      text: "Trung thành",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 17.75 6.825 20.995l.99-5.766L3.63 11.255l5.807-.844L12 5l2.563 5.411 5.807.844-4.186 3.974.99 5.766L12 17.75Z"
                          />
                        </svg>
                      ),
                    },
                    Potential: {
                      bg: "bg-gradient-to-br from-green-400 to-green-600 dark:from-green-500 dark:to-green-700",
                      text: "Tiềm năng",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 2v5m0 0c1.886-1.257 4.63-1.034 6 1-1.886 1.257-1.886 3.743 0 5-1.37 2.034-4.114 2.257-6 1m0-12c-1.886-1.257-4.63-1.034-6 1 1.886 1.257 1.886 3.743 0 5 1.37 2.034 4.114 2.257 6 1m0 0v5"
                          />
                        </svg>
                      ),
                    },
                    "At Risk": {
                      bg: "bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-700",
                      text: "Cần chăm sóc",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                          />
                        </svg>
                      ),
                    },
                    Lost: {
                      bg: "bg-gradient-to-br from-red-400 to-red-600 dark:from-red-500 dark:to-red-700",
                      text: "Đã mất",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m15 9-6 6m0-6 6 6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                      ),
                    },
                    New: {
                      bg: "bg-gradient-to-br from-cyan-400 to-cyan-600 dark:from-cyan-500 dark:to-cyan-700",
                      text: "Khách mới",
                      icon: (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-6 h-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 2v2m0 4v2m0 4v2m0 4v2M4.93 4.93l1.414 1.414M7.757 12l-1.414 1.414M4.93 19.07l1.414-1.414M19.07 4.93l-1.414 1.414M16.243 12l1.414 1.414M19.07 19.07l-1.414-1.414M2 12h2m4 0h2m4 0h2m4 0h2"
                          />
                        </svg>
                      ),
                    },
                  } as const;

                  const config = customer.segment
                    ? segmentConfig[customer.segment]
                    : {
                        bg: "bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-500 dark:to-slate-700",
                        text: "Khách hàng",
                        icon: <User className="w-6 h-6" />,
                      };
                  const points = calculateLoyaltyPoints(customer);
                  const pointsPercent = Math.min((points / 10000) * 100, 100);

                  return (
                    <div
                      key={customer.id}
                      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-shadow"
                    >
                      {/* Card Header with Gradient */}
                      <div className={`${config.bg} p-4 text-white relative`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl flex items-center justify-center">
                              {config.icon}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-white/20 rounded-full backdrop-blur">
                              {config.text}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setViewHistoryCustomer(customer)}
                              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur"
                              title="Xem lịch sử"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditCustomer(customer)}
                              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur"
                              title="Chỉnh sửa"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-1.5 bg-white/20 hover:bg-red-500 rounded-lg transition-colors backdrop-blur"
                              title="Xóa"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold mb-1">
                            {customer.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm opacity-90">
                            <span className="inline-flex items-center gap-1">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-4 h-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M2.25 6.75c0 8.284 6.716 15 15 15 .828 0 1.5-.672 1.5-1.5v-2.25a1.5 1.5 0 00-1.5-1.5h-1.158a1.5 1.5 0 00-1.092.468l-.936.996a1.5 1.5 0 01-1.392.444 12.035 12.035 0 01-7.29-7.29 1.5 1.5 0 01.444-1.392l.996-.936a1.5 1.5 0 00.468-1.092V6.75A1.5 1.5 0 006.75 5.25H4.5c-.828 0-1.5.672-1.5 1.5z"
                                />
                              </svg>
                              {customer.phone || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3">
                        {/* Vehicle Info */}
                        {customer.vehicles && customer.vehicles.length > 0 ? (
                          <div className="space-y-2">
                            {customer.vehicles.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                className="flex items-center gap-2 text-sm"
                              >
                                {vehicle.isPrimary && (
                                  <span
                                    className="text-yellow-500"
                                    title="Xe chính"
                                  >
                                    <svg
                                      className="w-3 h-3"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                  </span>
                                )}
                                <span className="text-slate-400 dark:text-slate-500">
                                  <Bike className="w-4 h-4" />
                                </span>
                                <div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100">
                                    {vehicle.model}
                                  </div>
                                  {vehicle.licensePlate && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      Biển số: {vehicle.licensePlate}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : customer.vehicleModel ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-400 dark:text-slate-500">
                              <Bike className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {customer.vehicleModel}
                              </div>
                              {customer.licensePlate && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Biển số: {customer.licensePlate}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Loyalty Points Section */}
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎁</span>
                              <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                                ĐIỂM TÍCH LŨY
                              </span>
                            </div>
                            <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                              {points.toLocaleString()}
                            </span>
                          </div>

                          {/* Points Progress Bar */}
                          <div className="mb-1">
                            <div className="h-2 bg-amber-200 dark:bg-amber-900/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                                style={{ width: `${pointsPercent}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 text-right">
                            Mục tiêu: 10,000 điểm
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="text-center">
                            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {customer.visitCount || 0}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Lần đến
                            </div>
                          </div>
                          <div className="text-center border-x border-slate-200 dark:border-slate-700">
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                              {((customer.totalSpent || 0) / 1000000).toFixed(
                                1
                              )}
                              M
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Chi tiêu
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {customer.lastVisit
                                ? `${Math.floor(
                                    (Date.now() -
                                      new Date(customer.lastVisit).getTime()) /
                                      (1000 * 60 * 60 * 24)
                                  )} ngày`
                                : "—"}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Ghé cuối
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {displayCount < filtered.length && (
                <div className="flex justify-center mt-8 pb-4">
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                    className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-full shadow-sm hover:shadow-md transition-all font-medium"
                  >
                    <span>
                      Hiển thị thêm{" "}
                      {Math.min(20, filtered.length - displayCount)} khách hàng
                    </span>
                    <svg
                      className="w-4 h-4 group-hover:translate-y-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {/* Suppliers Tab Content */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 relative">
              <svg
                className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Tìm theo tên hoặc số điện thoại..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-slate-600 dark:text-slate-400 text-sm font-medium">
              Tổng: <span className="font-bold">0</span> nhà cung cấp
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span>Upload CSV</span>
            </button>
            <button
              onClick={() => setShowSupplierModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Thêm mới</span>
            </button>
          </div>

          {/* Empty State for Suppliers */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="flex justify-center mb-4">
              <svg
                className="w-16 h-16 text-slate-300 dark:text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Chưa có nhà cung cấp.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <CustomerHistoryModal
        isOpen={!!viewHistoryCustomer}
        onClose={() => setViewHistoryCustomer(null)}
        customer={viewHistoryCustomer}
        sales={allSales}
        workOrders={allWorkOrders}
      />

      {editCustomer && (
        <CustomerModal
          customer={editCustomer}
          onSave={handleSaveCustomer}
          onClose={() => setEditCustomer(null)}
        />
      )}

      {showSupplierModal && (
        <SupplierModal onClose={() => setShowSupplierModal(false)} />
      )}

      {showImport && (
        <ImportCSVModal onClose={() => setShowImport(false)} type={activeTab} />
      )}
    </div>
  );
};

// --- SUB COMPONENTS (CustomerModal, SupplierModal, ImportCSVModal) ---

const CustomerModal: React.FC<{
  customer: Customer;
  onSave: (c: Partial<Customer> & { id?: string }) => void;
  onClose: () => void;
}> = ({ customer, onSave, onClose }) => {
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(customer.phone || "");

  const initVehicles = () => {
    if (customer.vehicles && customer.vehicles.length > 0) {
      return customer.vehicles;
    }
    if (customer.vehicleModel || customer.licensePlate) {
      return [
        {
          id: `VEH-${Date.now()}`,
          model: customer.vehicleModel || "",
          licensePlate: customer.licensePlate || "",
          isPrimary: true,
        },
      ];
    }
    return [];
  };

  const [vehicles, setVehicles] = useState<Vehicle[]>(initVehicles());
  const [newVehicle, setNewVehicle] = useState({ model: "", licensePlate: "" });

  const addVehicle = () => {
    if (!newVehicle.model.trim() && !newVehicle.licensePlate.trim()) return;
    const vehicle: Vehicle = {
      id: `VEH-${Date.now()}`,
      model: newVehicle.model.trim(),
      licensePlate: newVehicle.licensePlate.trim(),
      isPrimary: vehicles.length === 0,
    };
    setVehicles([...vehicles, vehicle]);
    setNewVehicle({ model: "", licensePlate: "" });
  };

  const removeVehicle = (id: string) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  const setPrimaryVehicle = (id: string) => {
    setVehicles(
      vehicles.map((v) => ({
        ...v,
        isPrimary: v.id === id,
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0];
    onSave({
      id: customer.id,
      name: name.trim(),
      phone: phone.trim(),
      vehicles: vehicles,
      vehiclemodel: primaryVehicle?.model || "",
      licenseplate: primaryVehicle?.licensePlate || "",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {customer.id ? "Sửa khách hàng" : "Thêm khách hàng"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tên khách
            </label>
            <input
              type="text"
              placeholder="Nhập tên khách"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="text"
              placeholder="VD: 09xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Danh sách xe
            </label>
            {vehicles.length > 0 && (
              <div className="space-y-2 mb-3">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setPrimaryVehicle(vehicle.id)}
                      className={`flex-shrink-0 ${
                        vehicle.isPrimary
                          ? "text-yellow-400"
                          : "text-slate-500 hover:text-yellow-400"
                      }`}
                      title={
                        vehicle.isPrimary ? "Xe chính" : "Đặt làm xe chính"
                      }
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                    <Bike className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="flex-1 text-sm text-white">
                      <span className="font-medium">
                        {vehicle.model || "—"}
                      </span>
                      {vehicle.licensePlate && (
                        <span className="text-slate-400 ml-2">
                          • {vehicle.licensePlate}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVehicle(vehicle.id)}
                      className="flex-shrink-0 text-red-400 hover:text-red-300"
                      title="Xóa xe"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Dòng xe"
                value={newVehicle.model}
                onChange={(e) =>
                  setNewVehicle({ ...newVehicle, model: e.target.value })
                }
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Biển số"
                value={newVehicle.licensePlate}
                onChange={(e) =>
                  setNewVehicle({
                    ...newVehicle,
                    licensePlate: e.target.value,
                  })
                }
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={addVehicle}
              className="mt-2 w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Thêm xe
            </button>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- SUPPLIER MODAL (NEW) ---
const SupplierModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // TODO: Gọi API tạo Supplier ở đây khi bạn đã có hook useCreateSupplier
    // const newSupplier = { name, phone, address, note };
    // await createSupplier.mutateAsync(newSupplier);

    alert(`[Mô phỏng] Đã lưu nhà cung cấp: ${name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Thêm nhà cung cấp
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nhập tên NCC"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="text"
              placeholder="VD: 09xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Địa chỉ
            </label>
            <input
              type="text"
              placeholder="Địa chỉ liên hệ"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Ghi chú
            </label>
            <textarea
              rows={3}
              placeholder="Ghi chú thêm..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- UPDATED IMPORT MODAL ---

const ImportCSVModal: React.FC<{
  onClose: () => void;
  type: "customers" | "suppliers";
}> = ({ onClose, type }) => {
  const createCustomersBulk = useCreateCustomersBulk();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
    Array<{ name: string; phone?: string }>
  >([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        setError("File CSV trống.");
        return;
      }
      const firstLine = lines[0].toLowerCase();
      const hasHeader =
        firstLine.includes("name") ||
        firstLine.includes("phone") ||
        firstLine.includes("tên") ||
        firstLine.includes("sđt");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const parsed: Array<{ name: string; phone?: string }> = [];
      for (const line of dataLines) {
        const cols = line.split(",").map((c) => c.trim());
        if (cols.length === 0 || !cols[0]) continue;
        parsed.push({ name: cols[0], phone: cols[1] || undefined });
      }
      if (parsed.length === 0) {
        setError("Không tìm thấy dữ liệu hợp lệ trong CSV.");
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    try {
      if (type === "customers") {
        // Import Khách hàng
        const newCustomers = preview.map((p) => ({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: p.name,
          phone: p.phone || "",
          created_at: new Date().toISOString(),
        }));
        await createCustomersBulk.mutateAsync(newCustomers);
        alert(`Đã import thành công ${newCustomers.length} khách hàng!`);
      } else {
        // Import Nhà cung cấp
        // LƯU Ý: Hiện tại chưa có hook useCreateSuppliersBulk, nên mình để tạm alert
        // Bạn cần tạo hook này tương tự như useCreateCustomersBulk trong useSupabase.ts
        alert(
          "Chức năng import Nhà cung cấp đang được phát triển. Vui lòng thêm hook useCreateSuppliersBulk để kích hoạt."
        );
        // Ví dụ logic khi có hook:
        // await createSuppliersBulk.mutateAsync(newSuppliers);
      }

      onClose();
    } catch (err) {
      console.error("Import error:", err);
      setError("Có lỗi xảy ra khi import. Vui lòng thử lại.");
    } finally {
      setImporting(false);
    }
  };

  const isCustomer = type === "customers";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import {isCustomer ? "khách hàng" : "nhà cung cấp"} từ CSV
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Chọn file CSV với cột đầu tiên là{" "}
            <strong>tên {isCustomer ? "khách hàng" : "nhà cung cấp"}</strong>,
            cột thứ hai là <strong>số điện thoại</strong> (tùy chọn).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {error && <div className="text-red-600 text-xs">{error}</div>}
          {preview.length > 0 && (
            <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900 max-h-64 overflow-y-auto custom-scrollbar">
              <div className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                Xem trước ({preview.length} mục):
              </div>
              <table className="w-full text-xs text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="text-left border-b dark:border-slate-700">
                    <th className="p-1">Tên</th>
                    <th className="p-1">SĐT</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b dark:border-slate-700">
                      <td className="p-1">{p.name}</td>
                      <td className="p-1">{p.phone || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              Huỷ
            </button>
            <button
              disabled={preview.length === 0 || importing}
              onClick={handleImport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? "Đang import..."
                : `Import ${preview.length > 0 ? `(${preview.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerManager;
