import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Bike,
  LayoutGrid,
  List,
  AlertTriangle,
  Wrench,
  Droplets,
  Cog,
  Wind,
} from "lucide-react";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCreateCustomersBulk,
} from "../../hooks/useSupabase";
import { formatDate, formatCurrency, formatAnyId } from "../../utils/format";
import { validatePhoneNumber } from "../../utils/validation";
import { PlusIcon, TrashIcon, XMarkIcon, UsersIcon } from "../Icons";
import {
  useSuppliers,
  useCreateSupplier,
  useDeleteSupplier,
} from "../../hooks/useSuppliers";
import type { Customer, Sale, WorkOrder, Vehicle } from "../../types";
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { showToast } from "../../utils/toast";
import {
  getVehiclesNeedingMaintenance,
  MAINTENANCE_CYCLES,
} from "../../utils/maintenanceReminder";

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-0 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {customerSales.length}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Hóa đơn
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-600 dark:text-green-400">
              {customerWorkOrders.length}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Phiếu SC
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(actualTotalSpent)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Tổng chi
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {actualVisitCount}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Lần đến
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
              ⭐ {actualLoyaltyPoints.toLocaleString()}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Điểm TL
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 px-4 pt-3 border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-3 py-1.5 font-medium text-sm transition-colors ${
              activeTab === "sales"
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            🛒 Hóa đơn ({customerSales.length})
          </button>
          <button
            onClick={() => setActiveTab("workorders")}
            className={`px-3 py-1.5 font-medium text-sm transition-colors ${
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
  const deleteCustomer = useDeleteCustomer();

  // Lấy danh sách nhà cung cấp từ Supabase
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Fetch sales and work orders for history
  const { data: allSales = [] } = useSalesRepo();
  const { data: allWorkOrders = [] } = useWorkOrdersRepo();

  // Reset display count khi search hoặc filter thay đổi
  useEffect(() => {
    setDisplayCount(20);
  }, [search, activeFilter]);

  // Helper function to calculate actual stats for a customer (consistent with CustomerHistoryModal)
  const calculateCustomerStats = (customer: Customer) => {
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

    // Calculate visit count from unique dates
    const allVisitDates = [
      ...customerSales.map((s) => new Date(s.date).toDateString()),
      ...customerWorkOrders.map((wo) =>
        new Date(wo.creationDate || wo.id).toDateString()
      ),
    ];
    const visitCount = new Set(allVisitDates).size;

    // Calculate last visit date (most recent transaction)
    const allTransactionDates = [
      ...customerSales.map((s) => new Date(s.date)),
      ...customerWorkOrders.map((wo) => new Date(wo.creationDate || wo.id)),
    ];
    const lastVisit =
      allTransactionDates.length > 0
        ? new Date(
            Math.max(...allTransactionDates.map((d) => d.getTime()))
          ).toISOString()
        : null;

    // Get latest km from most recent work order
    const sortedWorkOrders = [...customerWorkOrders].sort((a, b) => {
      const dateA = new Date(a.creationDate || a.id).getTime();
      const dateB = new Date(b.creationDate || b.id).getTime();
      return dateB - dateA;
    });
    const latestKm = sortedWorkOrders[0]?.currentKm || null;

    // 1 điểm = 10,000đ
    const loyaltyPoints = Math.floor(totalSpent / 10000);

    return { totalSpent, visitCount, loyaltyPoints, lastVisit, latestKm };
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
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            v.licensePlate?.toLowerCase().includes(q)
          ))
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

  const displayedCustomers = useMemo(
    () => filtered.slice(0, displayCount),
    [filtered, displayCount]
  );

  // Cache customer stats calculation for performance
  const customerStatsMap = useMemo(() => {
    const map = new Map();
    displayedCustomers.forEach((customer) => {
      map.set(customer.id, calculateCustomerStats(customer));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedCustomers, allSales, allWorkOrders]);

  const handleDelete = async (id: string) => {
    if (
      !confirm("Xác nhận xoá khách hàng này? Hành động này không thể hoàn tác.")
    )
      return;
    try {
      // Xóa khách hàng thực sự từ Supabase
      await deleteCustomer.mutateAsync(id);
      showToast.success("Đã xóa khách hàng thành công");
      refetch();
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      showToast.error(
        "Không thể xóa khách hàng: " + (error.message || "Lỗi không xác định")
      );
    }
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

  // Vehicles needing maintenance for customer care team
  const vehiclesNeedingMaintenance = useMemo(() => {
    return getVehiclesNeedingMaintenance(customers);
  }, [customers]);

  const filterOptions = useMemo(
    () => [
      {
        id: "all",
        label: "Tất cả",
        hint: "Toàn bộ danh sách",
        count: stats.total,
        icon: "🌐",
        activeClasses:
          "border-slate-300 bg-slate-100/80 text-slate-900 shadow-sm",
      },
      {
        id: "vip",
        label: "VIP",
        hint: "≥ 5.000 điểm",
        count: stats.vip,
        icon: "👑",
        activeClasses:
          "border-purple-200 bg-purple-50 text-purple-700 shadow-sm",
      },
      {
        id: "loyal",
        label: "Trung thành",
        hint: "10+ lượt",
        count: stats.loyal,
        icon: "💎",
        activeClasses: "border-blue-200 bg-blue-50 text-blue-700 shadow-sm",
      },
      {
        id: "potential",
        label: "Tiềm năng",
        hint: "2-9 lượt",
        count: stats.potential,
        icon: "⭐",
        activeClasses: "border-green-200 bg-green-50 text-green-700 shadow-sm",
      },
      {
        id: "at-risk",
        label: "Cần chăm sóc",
        hint: ">90 ngày chưa đến",
        count: stats.atRisk,
        icon: "⚠️",
        activeClasses:
          "border-orange-200 bg-orange-50 text-orange-700 shadow-sm",
      },
      {
        id: "lost",
        label: "Đã mất",
        hint: "Không quay lại",
        count: stats.lost,
        icon: "❌",
        activeClasses: "border-red-200 bg-red-50 text-red-700 shadow-sm",
      },
      {
        id: "new",
        label: "Khách mới",
        hint: "Tháng này",
        count: stats.new,
        icon: "🆕",
        activeClasses: "border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm",
      },
    ],
    [stats]
  );

  const overviewCards = useMemo(
    () => [
      {
        id: "total",
        title: "Tổng KH",
        value: stats.total.toLocaleString(),
        subLabel: `${stats.active} hoạt động`,
        gradient:
          "from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20",
        border: "border-blue-200 dark:border-blue-800",
        labelClass: "text-blue-700 dark:text-blue-300",
        valueClass: "text-blue-900 dark:text-blue-100",
      },
      {
        id: "new",
        title: "Khách mới",
        value: stats.newThisMonth.toLocaleString(),
        subLabel: "↑ 0% tháng này",
        gradient:
          "from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-800/20",
        border: "border-green-200 dark:border-green-800",
        labelClass: "text-green-700 dark:text-green-300",
        valueClass: "text-green-900 dark:text-green-100",
      },
      {
        id: "avg",
        title: "DT TB",
        value: "0 đ",
        subLabel: "/ khách hàng",
        gradient:
          "from-purple-50 to-violet-100 dark:from-purple-900/30 dark:to-violet-800/20",
        border: "border-purple-200 dark:border-purple-800",
        labelClass: "text-purple-700 dark:text-purple-300",
        valueClass: "text-purple-900 dark:text-purple-100",
      },
      {
        id: "atRisk",
        title: "Cần CS",
        value: stats.atRisk.toLocaleString(),
        subLabel: "0đ tiềm năng",
        gradient:
          "from-orange-50 to-amber-100 dark:from-orange-900/30 dark:to-amber-800/20",
        border: "border-orange-200 dark:border-orange-800",
        labelClass: "text-orange-700 dark:text-orange-300",
        valueClass: "text-orange-900 dark:text-orange-100",
      },
    ],
    [stats]
  );

  const segmentStyles: Record<
    string,
    {
      label: string;
      badgeClass: string;
      avatarClass: string;
      icon: string;
    }
  > = {
    VIP: {
      label: "VIP",
      badgeClass:
        "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700",
      avatarClass: "bg-purple-50 text-purple-700 dark:bg-purple-900/40",
      icon: "👑",
    },
    Loyal: {
      label: "Trung thành",
      badgeClass:
        "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700",
      avatarClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/40",
      icon: "💎",
    },
    Potential: {
      label: "Tiềm năng",
      badgeClass:
        "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700",
      avatarClass: "bg-green-50 text-green-700 dark:bg-green-900/40",
      icon: "⭐",
    },
    "At Risk": {
      label: "Cần chăm sóc",
      badgeClass:
        "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700",
      avatarClass: "bg-orange-50 text-orange-700 dark:bg-orange-900/40",
      icon: "⚠️",
    },
    Lost: {
      label: "Đã mất",
      badgeClass:
        "bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700",
      avatarClass: "bg-red-50 text-red-600 dark:bg-red-900/40",
      icon: "❌",
    },
    New: {
      label: "Khách mới",
      badgeClass:
        "bg-cyan-100 text-cyan-700 border border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-200 dark:border-cyan-700",
      avatarClass: "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40",
      icon: "🆕",
    },
    default: {
      label: "Khách hàng",
      badgeClass:
        "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600",
      avatarClass: "bg-slate-100 text-slate-600 dark:bg-slate-800",
      icon: "👤",
    },
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Tabs Header - Fixed */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none z-20 shadow-sm">
        <div className="flex items-center px-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1.5 px-3 py-2 md:py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "customers"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Khách hàng ({stats.total})</span>
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-1.5 px-3 py-2 md:py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === "suppliers"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Nhà cung cấp ({suppliers?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Area */}
      {activeTab === "customers" ? (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 pb-3 -mt-2 pt-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm transition-all">
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <div className="flex-1 relative w-full">
                <svg
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
                  className="w-full pl-9 pr-14 md:pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                />
                <button
                  onClick={() => setShowActionSheet(true)}
                  className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.75a.75.75 0 100-1.5.75.75 0 000 1.5zm0 6a.75.75 0 100-1.5.75.75 0 000 1.5zm0 6a.75.75 0 100-1.5.75.75 0 000 1.5z"
                    />
                  </svg>
                  <span>Tác vụ</span>
                </button>
              </div>
              <div className="hidden md:flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
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
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span>Upload DS</span>
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
                  onClick={() => alert("Tính năng đang phát triển")}
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
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span>Nhắc BD</span>
                </button>
                <button
                  onClick={() => setEditCustomer({} as Customer)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Thêm KH</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 md:border-none md:bg-transparent md:p-0 md:shadow-none">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Phân khúc khách hàng
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Chạm để lọc nhanh
                  </p>
                </div>
                <div className="hidden sm:inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900/40">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-colors sm:flex-none ${
                      viewMode === "grid"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Thẻ</span>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-colors sm:flex-none ${
                      viewMode === "list"
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>Danh sách</span>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory md:mt-3 md:snap-none">
                {filterOptions.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`min-w-[160px] snap-start rounded-xl border px-3 py-2 text-left transition-all md:min-w-0 ${
                      activeFilter === filter.id
                        ? `${filter.activeClasses} dark:bg-slate-800/80 dark:border-slate-600 dark:text-white`
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{filter.icon}</span>
                        <div>
                          <p className="text-xs font-semibold">
                            {filter.label}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {filter.hint}
                          </p>
                        </div>
                      </div>
                      <div className="text-base font-black text-slate-900 dark:text-slate-100">
                        {filter.count}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:snap-none">
              {overviewCards.map((card) => (
                <div
                  key={card.id}
                  className={`snap-start min-w-[170px] rounded-lg border bg-gradient-to-br p-3 md:p-4 ${card.gradient} ${card.border}`}
                >
                  <div
                    className={`text-[10px] md:text-sm font-semibold mb-1 uppercase ${card.labelClass}`}
                  >
                    {card.title}
                  </div>
                  <div
                    className={`text-2xl md:text-3xl font-black ${card.valueClass}`}
                  >
                    {card.value}
                  </div>
                  <div className="text-[10px] md:text-xs mt-0.5 text-slate-600 dark:text-slate-300">
                    {card.subLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Reminder Section for Customer Care Team */}
          {vehiclesNeedingMaintenance.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Xe cần bảo dưỡng ({vehiclesNeedingMaintenance.length})
                </h2>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:snap-none">
                  {vehiclesNeedingMaintenance.slice(0, 9).map((item, index) => (
                    <div
                      key={`${item.customer.id}-${item.vehicle.licensePlate}-${index}`}
                      className="snap-start min-w-[280px] md:min-w-0 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.customer.name || "Khách hàng"}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {item.customer.phone}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                          <Bike className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            {item.vehicle.licensePlate}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        Số km hiện tại:{" "}
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {(item.vehicle.currentKm || 0).toLocaleString()} km
                        </span>
                      </div>

                      <div className="space-y-2">
                        {item.warnings.map((warning, wIdx) => {
                          const IconComponent =
                            warning.type === "oilChange"
                              ? Droplets
                              : warning.type === "gearboxOil"
                              ? Cog
                              : Wind;
                          return (
                            <div
                              key={wIdx}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                                warning.isOverdue
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              }`}
                            >
                              <IconComponent className="w-4 h-4 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">
                                  {warning.name}
                                </span>
                                <span className="ml-1">
                                  {warning.isOverdue
                                    ? `(quá ${Math.abs(
                                        warning.kmUntilDue
                                      ).toLocaleString()} km)`
                                    : `(còn ${warning.kmUntilDue.toLocaleString()} km)`}
                                </span>
                              </div>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  warning.isOverdue
                                    ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100"
                                    : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100"
                                }`}
                              >
                                {warning.isOverdue ? "QUÁ HẠN" : "SẮP ĐẾN"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {vehiclesNeedingMaintenance.length > 9 && (
                  <p className="text-center text-sm text-orange-600 dark:text-orange-400 mt-3 font-medium">
                    Và {vehiclesNeedingMaintenance.length - 9} xe khác cần bảo
                    dưỡng...
                  </p>
                )}
              </div>
            </div>
          )}

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
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {displayedCustomers.map((customer) => {
                    const config =
                      (customer.segment && segmentStyles[customer.segment]) ||
                      segmentStyles.default;
                    // Use cached stats for performance (consistent with CustomerHistoryModal)
                    const {
                      totalSpent,
                      visitCount,
                      loyaltyPoints: points,
                      lastVisit,
                      latestKm,
                    } = customerStatsMap.get(customer.id) || {
                      totalSpent: 0,
                      visitCount: 0,
                      loyaltyPoints: 0,
                      lastVisit: null,
                      latestKm: null,
                    };
                    const pointsPercent = Math.min((points / 10000) * 100, 100);
                    const vehicles =
                      (customer.vehicles as Vehicle[] | undefined) || [];
                    const primaryVehicle =
                      vehicles.find((v) => v.isPrimary) || vehicles[0];
                    const hasExtraVehicles = vehicles.length > 2;

                    return (
                      <div
                        key={customer.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl ${config.avatarClass}`}
                            >
                              {config.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {customer.name || "Chưa đặt tên"}
                              </p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span>{customer.phone || "Chưa có số"}</span>
                                {lastVisit && (
                                  <span className="text-slate-400">
                                    • Lần cuối {formatDate(lastVisit)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold uppercase px-3 py-1 rounded-full ${config.badgeClass}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        {vehicles.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {vehicles.slice(0, 2).map((vehicle) => (
                              <span
                                key={vehicle.id}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                              >
                                {vehicle.isPrimary && (
                                  <span className="text-amber-500">★</span>
                                )}
                                <span>{vehicle.model || "Không rõ"}</span>
                                {vehicle.licensePlate && (
                                  <span className="text-[10px] text-slate-400">
                                    • {vehicle.licensePlate}
                                  </span>
                                )}
                              </span>
                            ))}
                            {hasExtraVehicles && (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                +{vehicles.length - 2} xe nữa
                              </span>
                            )}
                          </div>
                        ) : customer.vehicleModel ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                            <Bike className="h-3.5 w-3.5" />
                            <span>
                              {customer.vehicleModel}
                              {customer.licensePlate
                                ? ` • ${customer.licensePlate}`
                                : ""}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] uppercase text-slate-500">
                              Tổng chi
                            </p>
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(totalSpent)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase text-slate-500">
                              Lần đến
                            </p>
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {visitCount}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase text-slate-500">
                              Km hiện tại
                            </p>
                            <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                              {latestKm ? `${latestKm.toLocaleString()} km` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase text-slate-500">
                              Cuối cùng
                            </p>
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {lastVisit ? formatDate(lastVisit) : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <span>Điểm tích luỹ</span>
                            <span>{points.toLocaleString()}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500"
                              style={{ width: `${pointsPercent}%` }}
                            ></div>
                          </div>
                        </div>
                        Chạm để lọc nhanh
                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                          <button
                            onClick={() => setViewHistoryCustomer(customer)}
                            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                          >
                            Xem lịch sử
                          </button>
                          <button
                            onClick={() => setEditCustomer(customer)}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200"
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-3">Khách hàng</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3">Xe</th>
                        <th className="px-4 py-3">Tổng chi</th>
                        <th className="px-4 py-3">Lần đến</th>
                        <th className="px-4 py-3">Lần cuối</th>
                        <th className="px-4 py-3 text-right">Tác vụ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedCustomers.map((customer) => {
                        const config =
                          (customer.segment &&
                            segmentStyles[customer.segment]) ||
                          segmentStyles.default;
                        const vehicles =
                          (customer.vehicles as Vehicle[] | undefined) || [];
                        const primaryVehicle =
                          vehicles.find((v) => v.isPrimary) || vehicles[0];
                        const vehicleLabel = primaryVehicle
                          ? `${primaryVehicle.model || "Không rõ"}${
                              primaryVehicle.licensePlate
                                ? ` • ${primaryVehicle.licensePlate}`
                                : ""
                            }`
                          : customer.vehicleModel
                          ? `${customer.vehicleModel}${
                              customer.licensePlate
                                ? ` • ${customer.licensePlate}`
                                : ""
                            }`
                          : "—";

                        return (
                          <tr
                            key={customer.id}
                            className="border-t border-slate-100 text-slate-600 dark:border-slate-700/60 dark:text-slate-300"
                          >
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {customer.name || "Chưa đặt tên"}
                              </div>
                              <span
                                className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.badgeClass}`}
                              >
                                {config.icon} {config.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {customer.phone || "—"}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Điểm:{" "}
                                {(
                                  customerStatsMap.get(customer.id)
                                    ?.loyaltyPoints || 0
                                ).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-900 dark:text-slate-100">
                              {vehicleLabel}
                            </td>
                            <td className="px-4 py-3 align-top font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(
                                customerStatsMap.get(customer.id)?.totalSpent ||
                                  0
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-900 dark:text-slate-100">
                              {customerStatsMap.get(customer.id)?.visitCount ||
                                0}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-900 dark:text-slate-100">
                              {customerStatsMap.get(customer.id)?.lastVisit
                                ? formatDate(
                                    customerStatsMap.get(customer.id)?.lastVisit
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() =>
                                    setViewHistoryCustomer(customer)
                                  }
                                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500"
                                  title="Xem lịch sử"
                                >
                                  <svg
                                    className="h-4 w-4"
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
                                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-blue-500"
                                  title="Chỉnh sửa"
                                >
                                  <svg
                                    className="h-4 w-4"
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
                                  className="rounded-lg border border-red-200 p-2 text-red-500 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-900/40"
                                  title="Xóa"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {displayCount < filtered.length && (
                <div className="flex justify-center pb-4 pt-8">
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                    className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-500 hover:text-blue-600 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>
                      Hiển thị thêm{" "}
                      {Math.min(20, filtered.length - displayCount)} khách hàng
                    </span>
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-y-1"
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

          {/* Floating Add Button for mobile */}
          <button
            onClick={() => setEditCustomer({} as Customer)}
            className="md:hidden fixed bottom-28 right-5 z-40 inline-flex items-center justify-center rounded-full bg-blue-600 p-4 text-white shadow-lg transition hover:bg-blue-700"
          >
            <PlusIcon className="h-6 w-6" />
            <span className="sr-only">Thêm khách hàng</span>
          </button>

          {/* Mobile action sheet */}
          {showActionSheet && (
            <div className="md:hidden fixed inset-0 z-30">
              <button
                onClick={() => setShowActionSheet(false)}
                className="absolute inset-0 bg-black/40"
                aria-label="Đóng"
              ></button>
              <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-800">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-600" />
                <h3 className="mb-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Tác vụ nhanh
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowImport(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-200"
                  >
                    <svg
                      className="h-5 w-5 text-green-500"
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
                    Upload danh sách
                  </button>
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      alert("Tính năng đang phát triển");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-200"
                  >
                    <svg
                      className="h-5 w-5 text-orange-500"
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
                    Nhắc bảo dưỡng
                  </button>
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setEditCustomer({} as Customer);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" /> Thêm khách hàng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {/* Suppliers Tab Content */}
          <SuppliersList
            suppliers={suppliers}
            isLoading={suppliersLoading}
            onAdd={() => setShowSupplierModal(true)}
            onImport={() => setShowImport(true)}
            onDelete={(id) => deleteSupplierMutation.mutate({ id })}
          />
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
  // Danh sách dòng xe phổ biến tại Việt Nam
  const POPULAR_MOTORCYCLES = [
    // === HONDA ===
    "Honda Wave Alpha",
    "Honda Wave RSX",
    "Honda Wave RSX FI",
    "Honda Wave 110",
    "Honda Super Dream",
    "Honda Dream",
    "Honda Dream II",
    "Honda Dream Thái",
    "Honda Blade 110",
    "Honda Future 125",
    "Honda Future Neo",
    "Honda Winner X",
    "Honda Winner 150",
    "Honda CB150R",
    "Honda CBR150R",
    "Honda Vision",
    "Honda Air Blade 125",
    "Honda Air Blade 150",
    "Honda Air Blade 160",
    "Honda SH Mode 125",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Lead 125",
    "Honda PCX 125",
    "Honda PCX 160",
    "Honda Vario 125",
    "Honda Vario 150",
    "Honda Vario 160",
    "Honda ADV 150",
    "Honda ADV 160",
    "Honda Forza 350",
    "Honda Giorno",
    "Honda Stylo 160",
    "Honda Cub 50",
    "Honda Cub 81",
    "Honda Super Cub",
    // === YAMAHA ===
    "Yamaha Sirius",
    "Yamaha Sirius FI",
    "Yamaha Jupiter",
    "Yamaha Jupiter FI",
    "Yamaha Jupiter Finn",
    "Yamaha Exciter 135",
    "Yamaha Exciter 150",
    "Yamaha Exciter 155",
    "Yamaha MT-15",
    "Yamaha R15",
    "Yamaha FZ150i",
    "Yamaha TFX 150",
    "Yamaha XSR155",
    "Yamaha Grande",
    "Yamaha Grande Hybrid",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX 125",
    "Yamaha NVX 155",
    "Yamaha NMAX 155",
    "Yamaha XMAX 300",
    "Yamaha Nouvo",
    "Yamaha Mio",
    // === SUZUKI ===
    "Suzuki Raider 150",
    "Suzuki Satria F150",
    "Suzuki GSX-R150",
    "Suzuki GSX-S150",
    "Suzuki Axelo",
    "Suzuki Revo",
    "Suzuki Address",
    "Suzuki Burgman",
    // === SYM ===
    "SYM Elegant",
    "SYM Attila",
    "SYM Angela",
    "SYM Galaxy",
    "SYM Star SR",
    "SYM Shark",
    // === PIAGGIO & VESPA ===
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa LX",
    "Vespa GTS",
    // === KYMCO ===
    "Kymco Like",
    "Kymco Many",
    "Kymco Jockey",
    // === VINFAST ===
    "VinFast Klara",
    "VinFast Ludo",
    "VinFast Feliz",
    "VinFast Theon",
    "VinFast Evo200",
    // === Khác ===
    "Xe điện khác",
    "Khác",
  ];

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
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

  // Lọc gợi ý dòng xe theo input
  const filteredModels = useMemo(() => {
    if (!newVehicle.model.trim()) return POPULAR_MOTORCYCLES.slice(0, 20);
    const search = newVehicle.model.toLowerCase();
    return POPULAR_MOTORCYCLES.filter((m) =>
      m.toLowerCase().includes(search)
    ).slice(0, 15);
  }, [newVehicle.model]);

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
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    // Validate phone if provided
    if (phone.trim()) {
      const phoneValidation = validatePhoneNumber(phone.trim());
      if (!phoneValidation.ok) {
        showToast.error(phoneValidation.error || "Số điện thoại không hợp lệ");
        return;
      }
    }

    const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0];
    onSave({
      id: customer.id,
      name: name.trim(),
      phone: phone.trim(),
      vehicles: vehicles,
      vehicleModel: primaryVehicle?.model || "",
      licensePlate: primaryVehicle?.licensePlate || "",
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
              <div className="relative">
                <input
                  type="text"
                  placeholder="Dòng xe"
                  value={newVehicle.model}
                  onChange={(e) => {
                    setNewVehicle({ ...newVehicle, model: e.target.value });
                    setShowModelSuggestions(true);
                  }}
                  onFocus={() => setShowModelSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowModelSuggestions(false), 200)
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {showModelSuggestions && filteredModels.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredModels.map((model, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setNewVehicle({ ...newVehicle, model });
                          setShowModelSuggestions(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

// --- SUPPLIERS LIST COMPONENT ---
const SuppliersList: React.FC<{
  suppliers: any[];
  isLoading: boolean;
  onAdd: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}> = ({ suppliers, isLoading, onAdd, onImport, onDelete }) => {
  const [search, setSearch] = useState("");

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6">
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
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-slate-600 dark:text-slate-400 text-sm font-medium whitespace-nowrap">
          Tổng: <span className="font-bold">{filteredSuppliers.length}</span>{" "}
          nhà cung cấp
        </div>
        <button
          onClick={onImport}
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
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Thêm mới</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
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
            {search ? "Không tìm thấy nhà cung cấp." : "Chưa có nhà cung cấp."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Tên NCC
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Điện thoại
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Địa chỉ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredSuppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {supplier.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {supplier.phone || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {supplier.address || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                    {supplier.created_at
                      ? new Date(supplier.created_at).toLocaleDateString(
                          "vi-VN"
                        )
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Xác nhận xóa nhà cung cấp "${supplier.name}"?`
                          )
                        ) {
                          onDelete(supplier.id);
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// --- SUPPLIER MODAL (NEW) ---
const SupplierModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createSupplier = useCreateSupplier();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    setSaving(true);
    try {
      await createSupplier.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      onClose();
    } catch (err: any) {
      // Hook đã show toast error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Thêm nhà cung cấp
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nhập tên NCC"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="text"
              placeholder="VD: 09xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Địa chỉ
            </label>
            <input
              type="text"
              placeholder="Địa chỉ liên hệ"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? "Đang lưu..." : "Lưu"}
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto p-6">
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
