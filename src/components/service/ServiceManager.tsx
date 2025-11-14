import React, { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FileText,
  Wrench,
  Check,
  TrendingUp,
  Search,
  Plus,
  Smartphone,
  ReceiptText,
  ClipboardList,
  HandCoins,
  Printer,
  MapPin,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import type { WorkOrder, Part, WorkOrderPart } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
  useRefundWorkOrderRepo,
  useWorkOrdersRepo,
} from "../../hooks/useWorkOrdersRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useEmployeesRepo } from "../../hooks/useEmployeesRepository";
import {
  useCreateCustomerDebtRepo,
  useUpdateCustomerDebtRepo,
} from "../../hooks/useDebtsRepository";
import { showToast } from "../../utils/toast";
import { printElementById } from "../../utils/print";
import { supabase } from "../../supabaseClient";

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

type WorkOrderStatus = "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";

export default function ServiceManager() {
  const {
    parts: contextParts,
    customers,
    employees,
    upsertCustomer,
    setCashTransactions,
    setPaymentSources,
    paymentSources,
    currentBranchId,
    workOrders,
    setWorkOrders,
  } = useAppContext();

  // Fetch parts from Supabase
  const { data: fetchedParts, isLoading: partsLoading } = usePartsRepo();

  // Fetch work orders from Supabase
  const { data: fetchedWorkOrders, isLoading: workOrdersLoading } =
    useWorkOrdersRepo();

  // Use fetched parts if available, otherwise use context parts
  const parts = fetchedParts || contextParts;

  // Sync fetched work orders to context
  useEffect(() => {
    if (fetchedWorkOrders) {
      setWorkOrders(fetchedWorkOrders);
    }
  }, [fetchedWorkOrders, setWorkOrders]);

  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WorkOrderStatus>(
    "all"
  );
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "inProgress" | "done" | "delivered"
  >("all");

  // State for print preview modal
  const [printOrder, setPrintOrder] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  // State for refund modal
  const [refundingOrder, setRefundingOrder] = useState<WorkOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  // Open modal automatically if navigated from elsewhere with editOrder state
  const location = useLocation();
  useEffect(() => {
    const state = (location && (location as any).state) as {
      editOrder?: WorkOrder;
    } | null;
    console.log("[ServiceManager] location.state:", state);
    if (state && state.editOrder) {
      setEditingOrder(state.editOrder);
      setShowModal(true);
      try {
        window.history.replaceState({}, document.title);
      } catch (e) {
        // ignore when not allowed
      }
    }
  }, [location]);

  // Fetch store settings on mount
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select(
            "store_name, address, phone, email, logo_url, bank_qr_url, bank_name, bank_account_number, bank_account_holder, bank_branch, work_order_prefix"
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

  // Service Templates
  const serviceTemplates = [
    {
      id: "oil-change",
      name: "Thay dầu động cơ",
      description: "Thay dầu và lọc dầu động cơ",
      duration: 30,
      laborCost: 300000,
      parts: [
        { name: "Dầu động cơ 10W40", quantity: 1, price: 120000, unit: "chai" },
        { name: "Lọc dầu", quantity: 1, price: 30000, unit: "cái" },
      ],
    },
    {
      id: "brake-service",
      name: "Sửa phanh",
      description: "Thay má phanh và bảo dưỡng hệ thống phanh",
      duration: 45,
      laborCost: 505000,
      parts: [
        { name: "Má phanh trước", quantity: 2, price: 160000, unit: "cái" },
        { name: "Má phanh sau", quantity: 2, price: 120000, unit: "cái" },
        { name: "Dầu phanh", quantity: 1, price: 25000, unit: "chai" },
      ],
    },
    {
      id: "cleaning",
      name: "Vệ sinh kim phun",
      description: "Vệ sinh và hiệu chỉnh kim phun xăng",
      duration: 60,
      laborCost: 150000,
      parts: [
        {
          name: "Dung dịch vệ sinh kim phun",
          quantity: 1,
          price: 50000,
          unit: "chai",
        },
      ],
    },
    {
      id: "oil-box",
      name: "Thay nhớt hộp số",
      description: "Thay dầu hộp số và kiểm tra",
      duration: 25,
      laborCost: 140000,
      parts: [{ name: "Dầu hộp số", quantity: 1, price: 60000, unit: "chai" }],
    },
    {
      id: "bug-check",
      name: "Thay bugi",
      description: "Thay bugi và kiểm tra hệ thống đánh lửa",
      duration: 20,
      laborCost: 85000,
      parts: [{ name: "Bugi", quantity: 1, price: 35000, unit: "cái" }],
    },
    {
      id: "full-maintenance",
      name: "Bảo dưỡng tổng quát",
      description: "Bảo dưỡng định kỳ đầy đủ",
      duration: 90,
      laborCost: 570000,
      parts: [
        { name: "Dầu động cơ 10W40", quantity: 1, price: 120000, unit: "chai" },
        { name: "Lọc dầu", quantity: 1, price: 30000, unit: "cái" },
        { name: "Lọc không khí", quantity: 1, price: 25000, unit: "cái" },
        { name: "Bugi", quantity: 1, price: 35000, unit: "cái" },
        { name: "Dầu hộp số", quantity: 1, price: 60000, unit: "chai" },
      ],
    },
  ];

  const filteredOrders = useMemo(() => {
    // Exclude "Trả máy" - those show in ServiceHistory
    let filtered = workOrders.filter((o) => o.status !== "Trả máy");

    // Tab filter
    if (activeTab === "pending")
      filtered = filtered.filter((o) => o.status === "Tiếp nhận");
    else if (activeTab === "inProgress")
      filtered = filtered.filter((o) => o.status === "Đang sửa");
    else if (activeTab === "done")
      filtered = filtered.filter((o) => o.status === "Đã sửa xong");

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.vehicleModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => {
      const dateA = a.creationDate || (a as any).creationdate;
      const dateB = b.creationDate || (b as any).creationdate;
      if (!dateA || !dateB) return 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [workOrders, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const pending = workOrders.filter((o) => o.status === "Tiếp nhận").length;
    const inProgress = workOrders.filter((o) => o.status === "Đang sửa").length;
    const done = workOrders.filter((o) => o.status === "Đã sửa xong").length;
    const delivered = workOrders.filter((o) => o.status === "Trả máy").length;
    const todayRevenue = workOrders
      .filter(
        (o) =>
          o.paymentStatus === "paid" &&
          new Date(o.creationDate).toDateString() === new Date().toDateString()
      )
      .reduce((sum, o) => sum + o.total, 0);
    const todayProfit = workOrders
      .filter(
        (o) =>
          o.paymentStatus === "paid" &&
          new Date(o.creationDate).toDateString() === new Date().toDateString()
      )
      .reduce(
        (sum, o) =>
          sum +
          (o.total -
            (o.partsUsed?.reduce(
              (s: number, p: WorkOrderPart) => s + p.price * p.quantity,
              0
            ) || 0)),
        0
      );

    return { pending, inProgress, done, delivered, todayRevenue, todayProfit };
  }, [workOrders]);

  const handleOpenModal = (order?: WorkOrder) => {
    if (order) {
      setEditingOrder(order);
    } else {
      // Create empty order template
      setEditingOrder({
        id: "",
        customerName: "",
        customerPhone: "",
        vehicleModel: "",
        licensePlate: "",
        issueDescription: "",
        technicianName: "",
        status: "Tiếp nhận",
        laborCost: 0,
        discount: 0,
        partsUsed: [],
        total: 0,
        branchId: currentBranchId,
        paymentStatus: "unpaid",
        creationDate: new Date().toISOString(),
      } as WorkOrder);
    }
    setShowModal(true);
  };

  const handleApplyTemplate = (template: (typeof serviceTemplates)[0]) => {
    const newOrder: Partial<WorkOrder> = {
      id: "",
      customerName: "",
      customerPhone: "",
      vehicleModel: "",
      licensePlate: "",
      issueDescription: template.description,
      laborCost: template.laborCost,
      partsUsed: template.parts.map((p, idx) => ({
        partId: `TEMPLATE-${idx}`,
        partName: p.name,
        sku: "",
        quantity: p.quantity,
        price: p.price,
      })),
      status: "Tiếp nhận",
      paymentStatus: "unpaid",
      discount: 0,
      total: 0,
      creationDate: new Date().toISOString(),
      branchId: currentBranchId,
      technicianName: "",
    };
    setEditingOrder(newOrder as WorkOrder);
    setShowTemplateModal(false);
    setShowModal(true);
  };

  // Handle print work order - show preview modal
  const handlePrintOrder = (order: WorkOrder) => {
    setPrintOrder(order);
    setShowPrintPreview(true);
  };

  // Handle actual print
  const handleDoPrint = () => {
    setTimeout(() => {
      printElementById("work-order-receipt");
    }, 100);
  };

  // 🔹 Handle refund work order
  const { mutateAsync: refundWorkOrderAsync } = useRefundWorkOrderRepo();

  // 🔹 Handle create/update customer debts
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const updateCustomerDebt = useUpdateCustomerDebtRepo();

  const handleRefundOrder = (order: WorkOrder) => {
    setRefundingOrder(order);
    setRefundReason("");
    setShowRefundModal(true);
  };

  const handleConfirmRefund = async () => {
    if (!refundingOrder) return;

    if (!refundReason.trim()) {
      showToast.error("Vui lòng nhập lý do hủy");
      return;
    }

    try {
      const result = await refundWorkOrderAsync({
        orderId: refundingOrder.id,
        refundReason: refundReason,
      });

      // Update context cash transactions and payment sources
      if (
        result &&
        "refund_transaction_id" in result &&
        "refundAmount" in result &&
        result.refund_transaction_id &&
        result.refundAmount
      ) {
        const refundAmount = result.refundAmount as number;
        setCashTransactions((prev: any[]) => [
          ...prev,
          {
            id: result.refund_transaction_id,
            type: "refund",
            category: "refund",
            amount: -refundAmount,
            date: new Date().toISOString(),
            description: `Hoàn tiền hủy phiếu #${(
              formatWorkOrderId(
                refundingOrder.id,
                storeSettings?.work_order_prefix
              ) || ""
            )
              .split("-")
              .pop()} - ${refundReason}`,
            branchId: currentBranchId,
            paymentSource: refundingOrder.paymentMethod,
            reference: refundingOrder.id,
          },
        ]);

        if (refundingOrder.paymentMethod) {
          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === refundingOrder.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) - refundAmount,
                  },
                };
              }
              return ps;
            })
          );
        }
      }

      // Update work orders state
      setWorkOrders((prev) =>
        prev.map((wo) =>
          wo.id === refundingOrder.id
            ? { ...wo, refunded: true, status: "Đã hủy" as any }
            : wo
        )
      );

      setShowRefundModal(false);
      setRefundingOrder(null);
    } catch (error) {
      console.error("Error refunding work order:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          label="Tiếp nhận"
          value={stats.pending}
          icon={<ClipboardList className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Đang sửa"
          value={stats.inProgress}
          icon={<Wrench className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          label="Đã sửa xong"
          value={stats.done}
          icon={<Check className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Trả máy"
          value={stats.delivered}
          icon={<ReceiptText className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Doanh thu hôm nay"
          value={`${formatCurrency(stats.todayRevenue).replace("₫", "")}₫`}
          icon={<HandCoins className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Lợi nhuận hôm nay"
          value={`${formatCurrency(stats.todayProfit).replace("₫", "")}₫`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Action Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Tìm theo mã, tên, SĐT, xe, biển số..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
              <Search
                className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
                aria-hidden="true"
              />
            </div>
          </div>

          <select className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200">
            <option>Tất cả ngày</option>
            <option>Hôm nay</option>
            <option>7 ngày qua</option>
            <option>30 ngày qua</option>
          </select>

          <select className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200">
            <option>Tất cả KTV</option>
            <option>KTV 1</option>
            <option>KTV 2</option>
          </select>

          <select className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200">
            <option>Tất cả thanh toán</option>
            <option>Đã thanh toán</option>
            <option>Chưa thanh toán</option>
          </select>

          <button
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            aria-label="Xem báo cáo"
          >
            <TrendingUp className="w-4 h-4" /> Báo cáo
          </button>

          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            aria-label="Mở danh sách mẫu sửa chữa"
          >
            <FileText className="w-4 h-4" /> Mẫu SC
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            aria-label="Tạo phiếu sửa chữa mới"
          >
            <Plus className="w-4 h-4" /> Thêm Phiếu
          </button>

          <button
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            aria-label="Gửi SMS nhắc khách hàng"
          >
            <Smartphone className="w-4 h-4" /> SMS QH
          </button>
        </div>
      </div>

      {/* Tabs and Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
          <TabButton
            label="Tất cả"
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
          />
          <TabButton
            label="Tiếp nhận"
            active={activeTab === "pending"}
            onClick={() => setActiveTab("pending")}
          />
          <TabButton
            label="Đang sửa"
            active={activeTab === "inProgress"}
            onClick={() => setActiveTab("inProgress")}
          />
          <TabButton
            label="Đã sửa xong"
            active={activeTab === "done"}
            onClick={() => setActiveTab("done")}
          />
          <TabButton
            label="Trả máy"
            active={activeTab === "delivered"}
            onClick={() => setActiveTab("delivered")}
          />

          <div className="ml-auto px-4 py-3">
            <Link
              to="/service-history"
              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded text-sm flex items-center gap-1 transition-colors"
            >
              🕐 Lịch sử SC
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 w-12">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Tên thiết bị
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Chi tiết
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Hẹn trả
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Không có phiếu sửa chữa nào.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  // Calculate costs based on actual form data structure
                  // Tiền phụ tùng = Tổng giá phụ tùng
                  const partsCost =
                    order.partsUsed?.reduce(
                      (sum, p) => sum + p.quantity * p.price,
                      0
                    ) || 0;

                  // Gia công/Đặt hàng = additionalServices total (price * qty)
                  const servicesTotal =
                    order.additionalServices?.reduce(
                      (sum: number, s: any) =>
                        sum + (s.price || 0) * (s.quantity || 1),
                      0
                    ) || 0;

                  // Phí dịch vụ = laborCost
                  const laborCost = order.laborCost || 0;

                  return (
                    <tr
                      key={order.id}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <td className="px-2 py-4 align-top">
                        <div className="flex flex-col items-center gap-2">
                          <input type="checkbox" className="rounded" />
                          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center flex-shrink-0">
                            <Wrench className="w-5 h-5 text-slate-400" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {(
                              formatWorkOrderId(
                                order.id,
                                storeSettings?.work_order_prefix
                              ) || ""
                            )
                              .split("-")
                              .pop()}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                            {order.vehicleModel || "N/A"}
                          </div>
                          <div className="text-xs text-slate-500">
                            <span>Imei: </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {order.licensePlate || "Chưa nhập imei"}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            <span>Lúc: </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {formatDate(order.creationDate, true)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {order.customerPhone}
                          </div>
                          <div className="text-xs text-slate-500 italic">
                            {order.issueDescription || "Không có ghi chú"}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          {/* Hiển thị danh sách phụ tùng đã thay */}
                          {order.partsUsed && order.partsUsed.length > 0 ? (
                            <div className="space-y-0.5">
                              {order.partsUsed.map((part, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-slate-700 dark:text-slate-300"
                                >
                                  • {part.partName} ({part.quantity})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">
                              {order.issueDescription || "Chưa có phụ tùng"}
                            </div>
                          )}

                          {/* Hiển thị kỹ thuật viên */}
                          <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-2">
                            {order.technicianName || "Chưa phân công"}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1 min-w-[160px] text-xs">
                          {/* Compact summary - inline to save space */}
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {laborCost > 0 && (
                              <span className="mr-2">
                                DV: {formatCurrency(laborCost)}
                              </span>
                            )}
                            {partsCost > 0 && (
                              <span className="mr-2">
                                P/tùng: {formatCurrency(partsCost)}
                              </span>
                            )}
                            {servicesTotal > 0 && (
                              <span className="mr-2">
                                Công: {formatCurrency(servicesTotal)}
                              </span>
                            )}
                          </div>
                          {order.total > 0 && (
                            <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-600">
                              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                Tổng cộng:
                              </span>
                              <span className="text-sm font-semibold text-blue-500 dark:text-blue-400 tabular-nums">
                                {formatCurrency(order.total).replace("₫", "")} đ
                              </span>
                            </div>
                          )}

                          {/* Optional discount */}
                          {order.discount && order.discount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-red-500">Giảm giá:</span>
                              <span className="font-medium text-red-500 tabular-nums">
                                {formatCurrency(order.discount)} đ
                              </span>
                            </div>
                          )}

                          {/* Thanh toán thêm (có thể là âm vì là khoản khách đã trả) */}
                          {order.additionalPayment &&
                            order.additionalPayment > 0 && (
                              <div className="flex items-center justify-between text-xs text-green-500">
                                <span>Thanh toán thêm:</span>
                                <span className="font-medium tabular-nums">
                                  -{formatCurrency(order.additionalPayment)} đ
                                </span>
                              </div>
                            )}

                          {/* Số tiền còn phải thu */}
                          {order.remainingAmount !== undefined &&
                            order.remainingAmount > 0 && (
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span>Còn phải thu:</span>
                                <span
                                  className={`font-bold tabular-nums ${
                                    order.remainingAmount > 0
                                      ? "text-red-500"
                                      : "text-green-500"
                                  }`}
                                >
                                  {formatCurrency(order.remainingAmount)} đ
                                </span>
                              </div>
                            )}

                          {/* Trạng thái badge */}
                          <div className="pt-2">
                            {order.status === "Trả máy" ? (
                              <span className="inline-block px-2.5 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded text-xs font-medium border border-green-500/20">
                                Đã sửa xong
                              </span>
                            ) : order.status === "Đã sửa xong" ? (
                              <span className="inline-block px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs font-medium border border-blue-500/20">
                                Đã sửa xong
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded text-xs font-medium border border-orange-500/20">
                                Đang sửa...
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2 items-center">
                          <button
                            onClick={() => handleOpenModal(order)}
                            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium min-w-[70px] flex items-center justify-center gap-1"
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
                          {!order.refunded && (
                            <button
                              onClick={() => handleRefundOrder(order)}
                              className="px-3 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded border border-red-500/20 transition-colors"
                              title="Hoàn tiền và hủy phiếu"
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Mẫu sửa chữa thường dùng
              </h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Đóng"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Chọn mẫu sửa chữa để tự động điền thông tin vào phiếu sửa chữa
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {serviceTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {template.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {template.description}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {template.duration} phút
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(
                            template.laborCost +
                              template.parts.reduce(
                                (s, p) => s + p.price * p.quantity,
                                0
                              )
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        Phụ tùng cần thiết:
                      </p>
                      {template.parts.map((part, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between text-xs text-slate-500 dark:text-slate-400"
                        >
                          <span>
                            {part.name} x{part.quantity} {part.unit}
                          </span>
                          <span>
                            {formatCurrency(part.price * part.quantity)}
                          </span>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleApplyTemplate(template)}
                          className="flex-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                        >
                          Áp dụng mẫu
                        </button>
                        <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-sm">
                          Tạo mới
                        </button>
                        <button className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-sm">
                          Sửa mẫu
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Order Modal */}
      {showModal && editingOrder && (
        <WorkOrderModal
          order={editingOrder}
          onClose={() => {
            setShowModal(false);
            setEditingOrder(undefined);
          }}
          onSave={(order) => {
            if (order.id && editingOrder?.id) {
              // Update existing
              setWorkOrders((prev) =>
                prev.map((wo) => (wo.id === order.id ? order : wo))
              );
            } else {
              // Create new
              const newOrder = {
                ...order,
                id: `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`,
              };
              setWorkOrders((prev) => [...prev, newOrder]);
            }
            setShowModal(false);
            setEditingOrder(undefined);
          }}
          parts={parts}
          partsLoading={partsLoading}
          customers={customers}
          employees={employees}
          upsertCustomer={upsertCustomer}
          setCashTransactions={setCashTransactions}
          setPaymentSources={setPaymentSources}
          paymentSources={paymentSources}
          currentBranchId={currentBranchId}
          storeSettings={storeSettings}
        />
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Xem trước phiếu in
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDoPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  In phiếu
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreview(false);
                    setPrintOrder(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Đóng"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Print Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900">
              <div
                className="bg-white shadow-lg mx-auto"
                style={{ width: "148mm", minHeight: "210mm", color: "#000" }}
              >
                <div style={{ padding: "10mm" }}>
                  {/* Store Info Header - Compact Layout */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      gap: "3mm",
                      marginBottom: "4mm",
                      alignItems: "start",
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "3mm",
                    }}
                  >
                    {/* Left: Store Info */}
                    <div style={{ fontSize: "8.5pt", lineHeight: "1.4" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "11pt",
                          marginBottom: "1mm",
                          color: "#1e40af",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      <div style={{ color: "#000" }}>
                        📍{" "}
                        {storeSettings?.address ||
                          "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                      </div>
                      <div style={{ color: "#000" }}>
                        📞 {storeSettings?.phone || "0947.747.907"}
                      </div>
                      {storeSettings?.email && (
                        <div style={{ color: "#000" }}>
                          ✉️ {storeSettings.email}
                        </div>
                      )}
                    </div>

                    {/* Center: Logo (if available) */}
                    {storeSettings?.logo_url && (
                      <div style={{ textAlign: "center" }}>
                        <img
                          src={storeSettings.logo_url}
                          alt="Logo"
                          style={{
                            height: "15mm",
                            width: "auto",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    )}

                    {/* Right: Bank Info & QR */}
                    <div
                      style={{
                        fontSize: "8pt",
                        lineHeight: "1.4",
                        textAlign: "right",
                      }}
                    >
                      {storeSettings?.bank_name && (
                        <>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#000",
                            }}
                          >
                            🏦 {storeSettings.bank_name}
                          </div>
                          {storeSettings.bank_account_number && (
                            <div style={{ color: "#000" }}>
                              STK: {storeSettings.bank_account_number}
                            </div>
                          )}
                          {storeSettings.bank_account_holder && (
                            <div style={{ color: "#000", fontSize: "7.5pt" }}>
                              {storeSettings.bank_account_holder}
                            </div>
                          )}
                          {storeSettings.bank_qr_url && (
                            <div
                              style={{
                                marginTop: "2mm",
                                display: "inline-block",
                              }}
                            >
                              <img
                                src={storeSettings.bank_qr_url}
                                alt="QR Banking"
                                style={{
                                  height: "15mm",
                                  width: "15mm",
                                  objectFit: "contain",
                                }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & Meta */}
                  <div style={{ marginBottom: "4mm" }}>
                    <div style={{ textAlign: "center", marginBottom: "2mm" }}>
                      <h1
                        style={{
                          fontSize: "16pt",
                          fontWeight: "bold",
                          margin: "0",
                          textTransform: "uppercase",
                          color: "#1e40af",
                        }}
                      >
                        PHIẾU DỊCH VỤ SỬA CHỮA
                      </h1>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      <div>
                        {new Date(printOrder.creationDate).toLocaleString(
                          "vi-VN",
                          {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                      <div style={{ fontWeight: "bold" }}>
                        Mã:{" "}
                        {formatWorkOrderId(
                          printOrder.id,
                          storeSettings?.work_order_prefix
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info - Compact */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "3mm",
                      marginBottom: "3mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      color: "#000",
                      fontSize: "9pt",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "4mm",
                        marginBottom: "1.5mm",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: "bold" }}>Khách hàng:</span>{" "}
                        {printOrder.customerName}
                      </div>
                      <div style={{ flex: "0 0 auto" }}>
                        <span style={{ fontWeight: "bold" }}>SĐT:</span>{" "}
                        {printOrder.customerPhone}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "4mm" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: "bold" }}>Loại xe:</span>{" "}
                        {printOrder.vehicleModel}
                      </div>
                      <div style={{ flex: "0 0 auto" }}>
                        <span style={{ fontWeight: "bold" }}>Biển số:</span>{" "}
                        {printOrder.licensePlate}
                      </div>
                    </div>
                  </div>

                  {/* Issue Description */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "4mm",
                      marginBottom: "4mm",
                      borderRadius: "2mm",
                      color: "#000",
                    }}
                  >
                    <div style={{ display: "flex", gap: "3mm" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          minWidth: "20%",
                          flexShrink: 0,
                        }}
                      >
                        Mô tả sự cố:
                      </div>
                      <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                        {printOrder.issueDescription || "Không có mô tả"}
                      </div>
                    </div>
                  </div>

                  {/* Parts Table */}
                  {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                    <div style={{ marginBottom: "4mm", color: "#000" }}>
                      <p
                        style={{
                          fontWeight: "bold",
                          margin: "0 0 2mm 0",
                          fontSize: "11pt",
                        }}
                      >
                        Phụ tùng sử dụng:
                      </p>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #ddd",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "left",
                                fontSize: "10pt",
                              }}
                            >
                              Tên phụ tùng
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "center",
                                fontSize: "10pt",
                                width: "15%",
                              }}
                            >
                              SL
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "right",
                                fontSize: "10pt",
                                width: "25%",
                              }}
                            >
                              Đơn giá
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "right",
                                fontSize: "10pt",
                                width: "25%",
                              }}
                            >
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {printOrder.partsUsed.map(
                            (part: WorkOrderPart, idx: number) => (
                              <tr key={idx}>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {part.partName}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "center",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {part.quantity}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "right",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {formatCurrency(part.price)}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "right",
                                    fontSize: "10pt",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {formatCurrency(part.price * part.quantity)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Additional Services */}
                  {printOrder.additionalServices &&
                    printOrder.additionalServices.length > 0 && (
                      <div style={{ marginBottom: "4mm", color: "#000" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 2mm 0",
                            fontSize: "11pt",
                            color: "#000",
                          }}
                        >
                          Dịch vụ bổ sung:
                        </p>
                        <ul
                          style={{
                            margin: "0",
                            paddingLeft: "5mm",
                            color: "#000",
                          }}
                        >
                          {printOrder.additionalServices.map((service, idx) => (
                            <li key={idx} style={{ marginBottom: "1mm" }}>
                              {service.description} -{" "}
                              {formatCurrency(service.price)} x{" "}
                              {service.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Cost Summary */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "4mm",
                      marginBottom: "4mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f9f9f9",
                      color: "#000",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderSpacing: "0",
                        color: "#000",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Tiền phụ tùng:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(
                              printOrder.partsUsed?.reduce(
                                (sum: number, p: WorkOrderPart) =>
                                  sum + p.price * p.quantity,
                                0
                              ) || 0
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Phí dịch vụ:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(printOrder.laborCost || 0)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Giá công/Đặt hàng:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(
                              printOrder.additionalServices?.reduce(
                                (sum: number, s: any) =>
                                  sum + (s.price || 0) * (s.quantity || 1),
                                0
                              ) || 0
                            )}
                          </td>
                        </tr>
                        {/* additionalServices aggregated above as Giá công/Đặt hàng */}
                        {printOrder.discount != null &&
                          printOrder.discount > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  paddingBottom: "2mm",
                                  fontSize: "10pt",
                                  color: "#e74c3c",
                                }}
                              >
                                Giảm giá:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingBottom: "2mm",
                                  fontSize: "10pt",
                                  color: "#e74c3c",
                                }}
                              >
                                -{formatCurrency(printOrder.discount)}
                              </td>
                            </tr>
                          )}
                        <tr style={{ borderTop: "2px solid #333" }}>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingTop: "2mm",
                              fontSize: "12pt",
                            }}
                          >
                            TỔNG CỘNG:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingTop: "2mm",
                              fontSize: "12pt",
                              fontWeight: "bold",
                              color: "#2563eb",
                            }}
                          >
                            {formatCurrency(printOrder.total)} ₫
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer - Signatures Only */}
                  <div
                    style={{
                      marginTop: "8mm",
                      paddingTop: "4mm",
                      borderTop: "1px dashed #999",
                      color: "#000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "10pt",
                      }}
                    >
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 10mm 0",
                            color: "#000",
                          }}
                        >
                          Khách hàng
                        </p>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "9pt",
                            color: "#666",
                          }}
                        >
                          (Ký và ghi rõ họ tên)
                        </p>
                      </div>
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 10mm 0",
                            color: "#000",
                          }}
                        >
                          Nhân viên
                        </p>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "9pt",
                            color: "#666",
                          }}
                        >
                          (Ký và ghi rõ họ tên)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  <div
                    style={{
                      marginTop: "4mm",
                      padding: "3mm",
                      backgroundColor: "#fff9e6",
                      border: "1px solid #ffd700",
                      borderRadius: "2mm",
                      fontSize: "9pt",
                      textAlign: "center",
                      color: "#000",
                    }}
                  >
                    <p
                      style={{
                        margin: "0",
                        fontStyle: "italic",
                        color: "#000",
                      }}
                    >
                      Cảm ơn quý khách đã sử dụng dịch vụ!
                    </p>
                    <p
                      style={{
                        margin: "1mm 0 0 0",
                        fontStyle: "italic",
                        color: "#000",
                      }}
                    >
                      Vui lòng giữ phiếu này để đối chiếu khi nhận xe
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Template (Hidden - only for actual printing) */}
      {printOrder && (
        <div
          id="work-order-receipt"
          className="hidden print:block"
          style={{
            width: "148mm",
            margin: "0 auto",
            padding: "10mm",
            fontFamily: "Arial, sans-serif",
            fontSize: "11pt",
            color: "#000",
            backgroundColor: "#fff",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: "5mm" }}>
            <div style={{ textAlign: "center", marginBottom: "3mm" }}>
              <h1
                style={{
                  fontSize: "18pt",
                  fontWeight: "bold",
                  margin: "0 0 1mm 0",
                  textTransform: "uppercase",
                }}
              >
                PHIẾU DỊCH VỤ SỬA CHỮA
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "9pt",
                color: "#666",
              }}
            >
              <div>
                {new Date(printOrder.creationDate).toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div>
                Mã phiếu:{" "}
                {formatWorkOrderId(
                  printOrder.id,
                  storeSettings?.work_order_prefix
                )}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
            }}
          >
            <table style={{ width: "100%", borderSpacing: "0" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      width: "20%",
                      paddingBottom: "2mm",
                    }}
                  >
                    Khách hàng:
                  </td>
                  <td style={{ paddingBottom: "2mm", width: "30%" }}>
                    {printOrder.customerName}
                  </td>
                  <td
                    style={{
                      fontWeight: "bold",
                      width: "15%",
                      paddingBottom: "2mm",
                      paddingLeft: "3mm",
                    }}
                  >
                    Thanh Lộc
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    {printOrder.customerPhone}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                    }}
                  >
                    Loại xe:
                  </td>
                  <td style={{ paddingBottom: "2mm" }} colSpan={3}>
                    {printOrder.vehicleModel}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Biển số:</td>
                  <td colSpan={3}>{printOrder.licensePlate}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Issue Description */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
            }}
          >
            <div style={{ display: "flex", gap: "3mm" }}>
              <div
                style={{ fontWeight: "bold", minWidth: "20%", flexShrink: 0 }}
              >
                Mô tả sự cố:
              </div>
              <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                {printOrder.issueDescription || "Không có mô tả"}
              </div>
            </div>
          </div>

          {/* Parts Table */}
          {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
            <div style={{ marginBottom: "4mm" }}>
              <p
                style={{
                  fontWeight: "bold",
                  margin: "0 0 2mm 0",
                  fontSize: "11pt",
                }}
              >
                Phụ tùng sử dụng:
              </p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1px solid #ddd",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "left",
                        fontSize: "10pt",
                      }}
                    >
                      Tên phụ tùng
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "center",
                        fontSize: "10pt",
                        width: "15%",
                      }}
                    >
                      SL
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "right",
                        fontSize: "10pt",
                        width: "25%",
                      }}
                    >
                      Đơn giá
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "right",
                        fontSize: "10pt",
                        width: "25%",
                      }}
                    >
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.partsUsed.map(
                    (part: WorkOrderPart, idx: number) => (
                      <tr key={idx}>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            fontSize: "10pt",
                          }}
                        >
                          {part.partName}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "center",
                            fontSize: "10pt",
                          }}
                        >
                          {part.quantity}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "right",
                            fontSize: "10pt",
                          }}
                        >
                          {formatCurrency(part.price)}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "right",
                            fontSize: "10pt",
                            fontWeight: "bold",
                          }}
                        >
                          {formatCurrency(part.price * part.quantity)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Additional Services */}
          {printOrder.additionalServices &&
            printOrder.additionalServices.length > 0 && (
              <div style={{ marginBottom: "4mm" }}>
                <p
                  style={{
                    fontWeight: "bold",
                    margin: "0 0 2mm 0",
                    fontSize: "11pt",
                  }}
                >
                  Dịch vụ bổ sung:
                </p>
                <ul style={{ margin: "0", paddingLeft: "5mm" }}>
                  {printOrder.additionalServices.map((service, idx) => (
                    <li key={idx} style={{ marginBottom: "1mm" }}>
                      {service.description} - {formatCurrency(service.price)} x{" "}
                      {service.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Cost Summary */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
              backgroundColor: "#f9f9f9",
            }}
          >
            <table style={{ width: "100%", borderSpacing: "0" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    Tiền phụ tùng:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    {formatCurrency(
                      printOrder.partsUsed?.reduce(
                        (sum: number, p: WorkOrderPart) =>
                          sum + p.price * p.quantity,
                        0
                      ) || 0
                    )}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    Giá công/Đặt hàng:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    {formatCurrency(
                      printOrder.additionalServices?.reduce(
                        (sum: number, s: any) =>
                          sum + (s.price || 0) * (s.quantity || 1),
                        0
                      ) || 0
                    )}
                  </td>
                </tr>
                {/* Dịch vụ bổ sung aggregated above as Giá công/Đặt hàng */}
                {printOrder.discount != null && printOrder.discount > 0 && (
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingBottom: "2mm",
                        fontSize: "10pt",
                        color: "#e74c3c",
                      }}
                    >
                      Giảm giá:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingBottom: "2mm",
                        fontSize: "10pt",
                        color: "#e74c3c",
                      }}
                    >
                      -{formatCurrency(printOrder.discount)}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #333" }}>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingTop: "2mm",
                      fontSize: "12pt",
                    }}
                  >
                    TỔNG CỘNG:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingTop: "2mm",
                      fontSize: "12pt",
                      fontWeight: "bold",
                      color: "#2563eb",
                    }}
                  >
                    {formatCurrency(printOrder.total)} ₫
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Shop Info and Bank Account */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
              backgroundColor: "#f0f9ff",
            }}
          >
            <table
              style={{ width: "100%", borderSpacing: "0", fontSize: "9pt" }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      width: "30%",
                      paddingBottom: "2mm",
                    }}
                  >
                    Cửa hàng:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    Motocare - Phụ tùng xe máy
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "2mm" }}>
                    Địa chỉ:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    [Địa chỉ cửa hàng của bạn]
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "2mm" }}>
                    Hotline:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>[Số điện thoại]</td>
                </tr>
                <tr style={{ borderTop: "1px dashed #999" }}>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingTop: "2mm",
                      paddingBottom: "2mm",
                    }}
                  >
                    Ngân hàng:
                  </td>
                  <td style={{ paddingTop: "2mm", paddingBottom: "2mm" }}>
                    [Tên ngân hàng]
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "2mm" }}>
                    Số tài khoản:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>[Số tài khoản]</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold" }}>Chủ tài khoản:</td>
                  <td>[Tên chủ tài khoản]</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: "8mm",
              paddingTop: "4mm",
              borderTop: "1px dashed #999",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10pt",
              }}
            >
              <div style={{ textAlign: "center", width: "45%" }}>
                <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
                  Khách hàng
                </p>
                <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
                  (Ký và ghi rõ họ tên)
                </p>
              </div>
              <div style={{ textAlign: "center", width: "45%" }}>
                <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
                  Nhân viên
                </p>
                <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
                  (Ký và ghi rõ họ tên)
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div
            style={{
              marginTop: "4mm",
              padding: "3mm",
              backgroundColor: "#fff9e6",
              border: "1px solid #ffd700",
              borderRadius: "2mm",
              fontSize: "9pt",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0", fontStyle: "italic" }}>
              Cảm ơn quý khách đã sử dụng dịch vụ!
            </p>
            <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
              Vui lòng giữ phiếu này để đối chiếu khi nhận xe
            </p>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Xác nhận hủy phiếu
              </h2>
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundingOrder(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ <strong>Cảnh báo:</strong> Hành động này sẽ:
                </p>
                <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                  <li>Hoàn trả tồn kho các phụ tùng đã sử dụng</li>
                  <li>
                    Hoàn tiền {formatCurrency(refundingOrder.totalPaid || 0)}{" "}
                    cho khách
                  </li>
                  <li>Đánh dấu phiếu là "Đã hủy"</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Lý do hủy phiếu <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Vd: Khách hàng không đồng ý chi phí, sửa nhầm xe..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                  rows={3}
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Phiếu:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    #
                    {formatWorkOrderId(
                      refundingOrder.id,
                      storeSettings?.work_order_prefix
                    )
                      .split("-")
                      .pop()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Khách hàng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {refundingOrder.customerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">
                    Phụ tùng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {refundingOrder.partsUsed?.length || 0} món
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2">
                  <span className="text-slate-600 dark:text-slate-400">
                    Số tiền hoàn:
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(refundingOrder.totalPaid || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundingOrder(null);
                }}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRefund}
                disabled={!refundReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900 text-white rounded-lg font-medium disabled:cursor-not-allowed"
              >
                Xác nhận hủy phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Work Order Modal Component
const WorkOrderModal: React.FC<{
  order: WorkOrder;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  parts: Part[];
  partsLoading: boolean;
  customers: any[];
  employees: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  paymentSources: any[];
  currentBranchId: string;
  storeSettings?: StoreSettings | null;
}> = ({
  order,
  onClose,
  onSave,
  parts,
  partsLoading,
  customers,
  employees,
  upsertCustomer,
  setCashTransactions,
  setPaymentSources,
  paymentSources,
  currentBranchId,
  storeSettings,
}) => {
  const { profile } = useAuth();
  const { mutateAsync: createWorkOrderAtomicAsync } =
    useCreateWorkOrderAtomicRepo();
  const { mutateAsync: updateWorkOrderAtomicAsync } =
    useUpdateWorkOrderAtomicRepo();

  const [formData, setFormData] = useState<Partial<WorkOrder>>(() => {
    if (order?.id) return order;
    return {
      id: order?.id || "",
      customerName: order?.customerName || "",
      customerPhone: order?.customerPhone || "",
      vehicleModel: order?.vehicleModel || "",
      licensePlate: order?.licensePlate || "",
      issueDescription: order?.issueDescription || "",
      technicianName: order?.technicianName || "",
      status: order?.status || "Tiếp nhận",
      laborCost: order?.laborCost || 0,
      discount: order?.discount || 0,
      partsUsed: order?.partsUsed || [],
      total: order?.total || 0,
      branchId: order?.branchId || currentBranchId,
      paymentStatus: order?.paymentStatus || "unpaid",
      creationDate: order?.creationDate || new Date().toISOString(),
    };
  });

  const [searchPart, setSearchPart] = useState("");
  const [selectedParts, setSelectedParts] = useState<WorkOrderPart[]>([]);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partialPayment, setPartialPayment] = useState(0);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    vehicleModel: "",
    licensePlate: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Additional services state (Báo giá - Gia công/Đặt hàng)
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      description: string;
      quantity: number;
      price: number;
    }>
  >([]);
  const [newService, setNewService] = useState({
    description: "",
    quantity: 1,
    price: 0,
  });

  // Sync selectedParts and deposit with formData on order change
  useEffect(() => {
    if (order?.partsUsed) {
      setSelectedParts(order.partsUsed);
    } else {
      setSelectedParts([]);
    }

    // Sync customer search
    if (order?.customerName) {
      setCustomerSearch(order.customerName);
    } else {
      setCustomerSearch("");
    }

    // Sync additional services (Báo giá)
    if (order?.additionalServices) {
      setAdditionalServices(order.additionalServices);
    } else {
      setAdditionalServices([]);
    }

    // Sync deposit amount
    if (order?.depositAmount) {
      setDepositAmount(order.depositAmount);
      setShowDepositInput(true);
    } else {
      setDepositAmount(0);
      setShowDepositInput(false);
    }

    // Sync partial payment
    if (order?.additionalPayment) {
      setPartialPayment(order.additionalPayment);
      setShowPartialPayment(true);
    } else {
      setPartialPayment(0);
      setShowPartialPayment(false);
    }
  }, [order]);

  // Filter customers based on search - show all if search is empty
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;

    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customers, customerSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".customer-search-container")) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate totals
  const partsTotal = selectedParts.reduce(
    (sum, p) => sum + (p.price || 0) * (p.quantity || 0),
    0
  );
  const servicesTotal = additionalServices.reduce(
    (sum, s) => sum + (s.price || 0) * (s.quantity || 0),
    0
  );
  const subtotal = (formData.laborCost || 0) + partsTotal + servicesTotal;
  const discount = formData.discount || 0;
  const total = Math.max(0, subtotal - discount);

  // Debug log
  console.log("Tinh toan:", {
    laborCost: formData.laborCost,
    partsTotal,
    servicesTotal,
    subtotal,
    discount,
    total,
  });

  // Calculate payment summary
  const totalDeposit = depositAmount || 0;
  const totalAdditionalPayment = showPartialPayment ? partialPayment : 0;
  const totalPaid = totalDeposit + totalAdditionalPayment;
  const remainingAmount = Math.max(0, total - totalPaid);

  // Helper: Auto-create customer debt if there's remaining amount
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const createCustomerDebtIfNeeded = async (
    workOrder: WorkOrder,
    remainingAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Khách vãng lai";

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: workOrder.customerPhone || null,
        licensePlate: workOrder.licensePlate || null,
        description: `Công nợ từ phiếu sửa chữa #${
          formatWorkOrderId(workOrder.id, storeSettings?.work_order_prefix)
            .split("-")
            .pop() || ""
        } - ${safeCustomerName} - Biển số: ${workOrder.licensePlate || ""}`,
        totalAmount: remainingAmount,
        paidAmount: 0,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
      };

      console.log("[ServiceManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[ServiceManager] createCustomerDebt result:", result);
      showToast.success(
        `Đã tạo công nợ ${remainingAmount.toLocaleString()}đ cho khách hàng (ID: ${
          result?.id
        })`
      );
    } catch (error) {
      console.error("Error creating customer debt:", error);
      showToast.error("Không thể tạo công nợ tự động");
    }
  };

  const handleSave = async () => {
    // 🔹 VALIDATION FRONTEND
    // 1. Validate customer name & phone required
    if (!formData.customerName?.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui lòng nhập số điện thoại");
      return;
    }

    // 2. Validate phone format (10-11 digits)
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.customerPhone.trim())) {
      showToast.error("Số điện thoại không hợp lệ (cần 10-11 chữ số)");
      return;
    }

    // 3. Validate total > 0
    if (total <= 0) {
      showToast.error("Tổng tiền phải lớn hơn 0");
      return;
    }

    // Add/update customer with duplicate check
    if (formData.customerName && formData.customerPhone) {
      const existingCustomer = customers.find(
        (c) => c.phone === formData.customerPhone
      );

      // 🔹 VALIDATE DUPLICATE PHONE
      if (!existingCustomer) {
        // Check if phone belongs to different customer name
        const duplicatePhone = customers.find(
          (c) =>
            c.phone === formData.customerPhone &&
            formData.customerName &&
            c.name.toLowerCase() !== formData.customerName.toLowerCase()
        );

        if (duplicatePhone) {
          showToast.warning(
            `SĐT đã tồn tại cho khách "${duplicatePhone.name}". Có thể trùng lặp?`
          );
        }

        upsertCustomer({
          id: `CUST-${Date.now()}`,
          name: formData.customerName,
          phone: formData.customerPhone,
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          status: "active",
          segment: "New",
          loyaltyPoints: 0,
          totalSpent: 0,
          visitCount: 1,
          lastVisit: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    }

    // Determine payment status
    let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
    if (totalPaid >= total) {
      paymentStatus = "paid";
    } else if (totalPaid > 0) {
      paymentStatus = "partial";
    }

    // If this is a NEW work order with parts, use atomic RPC
    if (!order?.id && selectedParts.length > 0) {
      try {
        const orderId = `${
          storeSettings?.work_order_prefix || "SC"
        }-${Date.now()}`;

        const responseData = await createWorkOrderAtomicAsync({
          id: orderId,
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleModel: formData.vehicleModel || "",
          licensePlate: formData.licensePlate || "",
          issueDescription: formData.issueDescription || "",
          technicianName: formData.technicianName || "",
          status: formData.status || "Tiếp nhận",
          laborCost: formData.laborCost || 0,
          discount: discount,
          partsUsed: selectedParts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: formData.paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          creationDate: new Date().toISOString(),
          userId: profile?.id || "unknown",
        } as any);

        // Extract transaction IDs from response
        const depositTxId = responseData?.depositTransactionId;
        const paymentTxId = responseData?.paymentTransactionId;

        // Create the finalOrder object to update the UI state
        const finalOrder: WorkOrder = {
          id: orderId,
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleModel: formData.vehicleModel || "",
          licensePlate: formData.licensePlate || "",
          issueDescription: formData.issueDescription || "",
          technicianName: formData.technicianName || "",
          status: formData.status || "Tiếp nhận",
          laborCost: formData.laborCost || 0,
          discount: discount,
          partsUsed: selectedParts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          depositDate: depositAmount > 0 ? new Date().toISOString() : undefined,
          depositTransactionId: depositTxId,
          paymentStatus: paymentStatus,
          paymentMethod: formData.paymentMethod,
          additionalPayment:
            totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          cashTransactionId: paymentTxId,
          paymentDate: paymentTxId ? new Date().toISOString() : undefined,
          creationDate: new Date().toISOString(),
        };

        // Update cash transactions in context (for UI consistency)
        if (depositTxId && depositAmount > 0) {
          setCashTransactions((prev: any[]) => [
            ...prev,
            {
              id: depositTxId,
              type: "deposit",
              category: "service_deposit",
              amount: depositAmount,
              date: new Date().toISOString(),
              description: `Đặt cọc sửa chữa #${(
                formatWorkOrderId(orderId, storeSettings?.work_order_prefix) ||
                ""
              )
                .split("-")
                .pop()} - ${formData.customerName}`,
              branchId: currentBranchId,
              paymentSource: formData.paymentMethod,
              reference: orderId,
            },
          ]);

          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === formData.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) + depositAmount,
                  },
                };
              }
              return ps;
            })
          );
        }

        if (paymentTxId && totalAdditionalPayment > 0) {
          setCashTransactions((prev: any[]) => [
            ...prev,
            {
              id: paymentTxId,
              type: "income",
              category: "service_income",
              amount: totalAdditionalPayment,
              date: new Date().toISOString(),
              description: `Thu tiền sửa chữa #${(
                formatWorkOrderId(orderId, storeSettings?.work_order_prefix) ||
                ""
              )
                .split("-")
                .pop()} - ${formData.customerName}`,
              branchId: currentBranchId,
              paymentSource: formData.paymentMethod,
              reference: orderId,
            },
          ]);

          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === formData.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) +
                      totalAdditionalPayment,
                  },
                };
              }
              return ps;
            })
          );
        }

        // Call onSave to update the workOrders state
        onSave(finalOrder);

        // 🔹 Auto-create customer debt if there's remaining amount
        if (remainingAmount > 0) {
          await createCustomerDebtIfNeeded(finalOrder, remainingAmount);
        }
      } catch (error: any) {
        console.error("Error creating work order (atomic):", error);
        // Error toast is already shown by the hook's onError
      }
      return;
    }

    // 🔹 If this is an UPDATE with parts changes, use atomic RPC
    if (order?.id && selectedParts.length > 0) {
      try {
        const responseData = await updateWorkOrderAtomicAsync({
          id: order.id,
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleModel: formData.vehicleModel || "",
          licensePlate: formData.licensePlate || "",
          issueDescription: formData.issueDescription || "",
          technicianName: formData.technicianName || "",
          status: formData.status || "Tiếp nhận",
          laborCost: formData.laborCost || 0,
          discount: discount,
          partsUsed: selectedParts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: formData.paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          userId: profile?.id || "unknown",
        } as any);

        const workOrderRow = (responseData as any).workOrder;
        const depositTxId = responseData?.depositTransactionId;
        const paymentTxId = responseData?.paymentTransactionId;

        const finalOrder: WorkOrder = {
          ...workOrderRow,
          depositTransactionId: depositTxId || order.depositTransactionId,
          cashTransactionId: paymentTxId || order.cashTransactionId,
        };

        // Update cash transactions in context if new transactions created
        if (depositTxId && depositAmount > order.depositAmount!) {
          setCashTransactions((prev: any[]) => [
            ...prev,
            {
              id: depositTxId,
              type: "deposit",
              category: "service_deposit",
              amount: depositAmount - (order.depositAmount || 0),
              date: new Date().toISOString(),
              description: `Đặt cọc bổ sung #${(
                formatWorkOrderId(order.id, storeSettings?.work_order_prefix) ||
                ""
              )
                .split("-")
                .pop()} - ${formData.customerName}`,
              branchId: currentBranchId,
              paymentSource: formData.paymentMethod,
              reference: order.id,
            },
          ]);

          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === formData.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) +
                      (depositAmount - (order.depositAmount || 0)),
                  },
                };
              }
              return ps;
            })
          );
        }

        if (
          paymentTxId &&
          totalAdditionalPayment > (order.additionalPayment || 0)
        ) {
          setCashTransactions((prev: any[]) => [
            ...prev,
            {
              id: paymentTxId,
              type: "income",
              category: "service_income",
              amount: totalAdditionalPayment - (order.additionalPayment || 0),
              date: new Date().toISOString(),
              description: `Thu tiền bổ sung #${(
                formatWorkOrderId(order.id, storeSettings?.work_order_prefix) ||
                ""
              )
                .split("-")
                .pop()} - ${formData.customerName}`,
              branchId: currentBranchId,
              paymentSource: formData.paymentMethod,
              reference: order.id,
            },
          ]);

          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === formData.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) +
                      (totalAdditionalPayment - (order.additionalPayment || 0)),
                  },
                };
              }
              return ps;
            })
          );
        }

        onSave(finalOrder);

        if (remainingAmount > 0) {
          await createCustomerDebtIfNeeded(finalOrder, remainingAmount);
        }
      } catch (error: any) {
        console.error("Error updating work order (atomic):", error);
      }
      return;
    }

    // Otherwise, use old logic for updates without parts
    const finalOrder: WorkOrder = {
      id:
        formData.id ||
        `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`,
      customerName: formData.customerName || "",
      customerPhone: formData.customerPhone || "",
      vehicleModel: formData.vehicleModel || "",
      licensePlate: formData.licensePlate || "",
      issueDescription: formData.issueDescription || "",
      technicianName: formData.technicianName || "",
      status: formData.status || "Tiếp nhận",
      laborCost: formData.laborCost || 0,
      discount: discount,
      partsUsed: selectedParts,
      additionalServices:
        additionalServices.length > 0 ? additionalServices : undefined,
      total: total,
      branchId: currentBranchId,

      // Deposit fields
      depositAmount: depositAmount > 0 ? depositAmount : undefined,
      depositDate:
        depositAmount > 0 && !order?.depositDate
          ? new Date().toISOString()
          : order?.depositDate,

      // Payment fields
      paymentStatus: paymentStatus,
      paymentMethod: formData.paymentMethod,
      additionalPayment:
        totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
      totalPaid: totalPaid > 0 ? totalPaid : undefined,
      remainingAmount: remainingAmount,

      creationDate: formData.creationDate || new Date().toISOString(),
    };

    // Handle deposit transaction (first time only)
    if (depositAmount > 0 && !order?.depositAmount && formData.paymentMethod) {
      const depositTxId = `DEP-${Date.now()}`;
      setCashTransactions((prev: any[]) => [
        ...prev,
        {
          id: depositTxId,
          type: "deposit",
          category: "service_deposit",
          amount: depositAmount,
          date: new Date().toISOString(),
          description: `Đặt cọc sửa chữa #${(
            formatWorkOrderId(
              finalOrder.id,
              storeSettings?.work_order_prefix
            ) || ""
          )
            .split("-")
            .pop()} - ${formData.customerName}`,
          branchId: currentBranchId,
          paymentSource: formData.paymentMethod,
          reference: finalOrder.id,
        },
      ]);

      setPaymentSources((prev: any[]) =>
        prev.map((ps) => {
          if (ps.id === formData.paymentMethod) {
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]:
                  (ps.balance[currentBranchId] || 0) + depositAmount,
              },
            };
          }
          return ps;
        })
      );

      finalOrder.depositTransactionId = depositTxId;
    }

    // Handle additional payment transaction (when paying more at pickup)
    if (totalAdditionalPayment > 0 && formData.paymentMethod) {
      const paymentTxId = `PAY-${Date.now()}`;
      setCashTransactions((prev: any[]) => [
        ...prev,
        {
          id: paymentTxId,
          type: "income",
          category: "service_income",
          amount: totalAdditionalPayment,
          date: new Date().toISOString(),
          description: `Thu tiền sửa chữa #${(
            formatWorkOrderId(
              finalOrder.id,
              storeSettings?.work_order_prefix
            ) || ""
          )
            .split("-")
            .pop()} - ${formData.customerName}`,
          branchId: currentBranchId,
          paymentSource: formData.paymentMethod,
          reference: finalOrder.id,
        },
      ]);

      setPaymentSources((prev: any[]) =>
        prev.map((ps) => {
          if (ps.id === formData.paymentMethod) {
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]:
                  (ps.balance[currentBranchId] || 0) + totalAdditionalPayment,
              },
            };
          }
          return ps;
        })
      );

      finalOrder.cashTransactionId = paymentTxId;
      finalOrder.paymentDate = new Date().toISOString();
    }

    onSave(finalOrder);

    if (remainingAmount > 0) {
      await createCustomerDebtIfNeeded(finalOrder, remainingAmount);
    }
  };

  const handleAddPart = (part: Part) => {
    const existing = selectedParts.find((p) => p.partId === part.id);
    if (existing) {
      setSelectedParts(
        selectedParts.map((p) =>
          p.partId === part.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku || "",
          quantity: 1,
          price: part.retailPrice[currentBranchId] || 0,
        },
      ]);
    }
    setShowPartSearch(false);
    setSearchPart("");
  };

  // Filter parts available at current branch with stock
  const availableParts = useMemo(() => {
    return parts.filter((part) => {
      const stock = part.stock?.[currentBranchId] || 0;
      return stock > 0;
    });
  }, [parts, currentBranchId]);

  // Filter parts based on search - show all available parts if search is empty
  const filteredParts = useMemo(() => {
    if (!searchPart.trim()) return availableParts;

    return availableParts.filter(
      (p) =>
        p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchPart.toLowerCase())
    );
  }, [availableParts, searchPart]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formData.id
              ? `Chi tiết phiếu sửa chữa - ${formatWorkOrderId(
                  formData.id,
                  storeSettings?.work_order_prefix
                )}`
              : "Tạo phiếu sửa chữa mới"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Đóng"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Customer & Vehicle Info */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Thông tin Khách hàng & Sự cố
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Khách hàng <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative customer-search-container">
                    <input
                      type="text"
                      placeholder="Tìm khách hàng..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        setFormData({
                          ...formData,
                          customerName: e.target.value,
                        });
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />

                    {/* Customer Dropdown */}
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                customerName: customer.name,
                                customerPhone: customer.phone,
                              });
                              setCustomerSearch(customer.name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {customer.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {customer.phone}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xl"
                    title="Thêm khách hàng mới"
                  >
                    +
                  </button>
                </div>

                {/* Display customer info after selection */}
                {formData.customerName && formData.customerPhone && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formData.customerName}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.25 6.75c0 8.284 6.716 15 15 15 .828 0 1.5-.672 1.5-1.5v-2.25a1.5 1.5 0 00-1.5-1.5h-1.158a1.5 1.5 0 00-1.092.468l-.936.996a1.5 1.5 0 01-1.392.444 12.035 12.035 0 01-7.29-7.29 1.5 1.5 0 01.444-1.392l.996-.936a1.5 1.5 0 00.468-1.092V6.75A1.5 1.5 0 006.75 5.25H4.5c-.828 0-1.5.672-1.5 1.5z"
                              />
                            </svg>
                            {formData.customerPhone}
                          </span>
                        </div>
                        {(formData.vehicleModel || formData.licensePlate) && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-3.5 h-3.5"
                              >
                                <circle cx="6" cy="17" r="2" />
                                <circle cx="18" cy="17" r="2" />
                                <path d="M4 17h2l4-6h2l2 3h4" />
                              </svg>
                              {formData.vehicleModel}{" "}
                              {formData.licensePlate &&
                                `- ${formData.licensePlate}`}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearch("");
                          setFormData({
                            ...formData,
                            customerName: "",
                            customerPhone: "",
                            vehicleModel: "",
                            licensePlate: "",
                          });
                        }}
                        className="text-slate-400 hover:text-red-500 text-sm flex items-center"
                        title="Xóa khách hàng"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-4 h-4"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số KM hiện tại
                </label>
                <input
                  type="number"
                  placeholder="15000"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả sự cố
                </label>
                <textarea
                  rows={4}
                  placeholder="Bảo dưỡng định kỳ, thay nhớt..."
                  value={formData.issueDescription || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      issueDescription: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chi tiết Dịch vụ
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={formData.status || "Tiếp nhận"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className={`w-full px-3 py-2 border rounded-lg font-medium ${
                      formData.status === "Tiếp nhận"
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                        : formData.status === "Đang sửa"
                        ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300"
                        : formData.status === "Đã sửa xong"
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                        : "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                    }`}
                  >
                    <option
                      value="Tiếp nhận"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Tiếp nhận
                    </option>
                    <option
                      value="Đang sửa"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Đang sửa
                    </option>
                    <option
                      value="Đã sửa xong"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Đã sửa xong
                    </option>
                    <option
                      value="Trả máy"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Trả máy
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Kỹ thuật viên
                  </label>
                  <select
                    value={formData.technicianName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        technicianName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Chọn kỹ thuật viên --</option>
                    {employees
                      .filter(
                        (emp) =>
                          emp.branchId === currentBranchId &&
                          emp.status === "active" &&
                          emp.department === "Kỹ thuật" &&
                          ["Kỹ thuật viên", "Kỹ thuật trưởng"].includes(
                            emp.position
                          )
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phí dịch vụ (Công thợ)
                </label>
                <input
                  type="number"
                  placeholder="100.000"
                  value={formData.laborCost || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      laborCost: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú nội bộ
                </label>
                <textarea
                  rows={4}
                  placeholder="VD: Khách yêu cầu kiểm tra thêm hệ thống điện"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Parts Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Phụ tùng sử dụng
              </h3>
              <button
                onClick={() => setShowPartSearch(!showPartSearch)}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-1"
              >
                ➕ Thêm phụ tùng
              </button>
            </div>

            {showPartSearch && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm phụ tùng theo tên hoặc SKU..."
                  value={searchPart}
                  onChange={(e) => setSearchPart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                  {partsLoading ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      Đang tải phụ tùng...
                    </div>
                  ) : filteredParts.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      Không tìm thấy phụ tùng
                    </div>
                  ) : (
                    filteredParts.slice(0, 10).map((part) => (
                      <button
                        key={part.id}
                        onClick={() => handleAddPart(part)}
                        className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {part.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {part.sku}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(
                            part.retailPrice[currentBranchId] || 0
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                      Tên
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      SL
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      Đ.Giá
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      T.Tiền
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {selectedParts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-400"
                      >
                        Chưa có phụ tùng nào
                      </td>
                    </tr>
                  ) : (
                    selectedParts.map((part, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800">
                        <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                          {part.partName}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              setSelectedParts(
                                selectedParts.map((p, i) =>
                                  i === idx ? { ...p, quantity: newQty } : p
                                )
                              );
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                          {formatCurrency(part.price)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(part.price * part.quantity)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() =>
                              setSelectedParts(
                                selectedParts.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-red-500 hover:text-red-700"
                            aria-label="Xóa phụ tùng"
                          >
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
                                d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quote/Estimate Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Báo giá (Gia công, Đặt hàng)
            </h3>

            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                      Mô tả
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      SL
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      Đơn giá
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      Thành tiền
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      <button
                        onClick={() => {
                          if (newService.description && newService.price > 0) {
                            setAdditionalServices([
                              ...additionalServices,
                              { ...newService, id: `SRV-${Date.now()}` },
                            ]);
                            setNewService({
                              description: "",
                              quantity: 1,
                              price: 0,
                            });
                          }
                        }}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                      >
                        Thêm
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Existing services */}
                  {additionalServices.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                        {service.description}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-slate-900 dark:text-slate-100">
                        {service.quantity}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(service.price)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(service.price * service.quantity)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() =>
                            setAdditionalServices(
                              additionalServices.filter(
                                (s) => s.id !== service.id
                              )
                            )
                          }
                          className="text-red-500 hover:text-red-700 text-sm"
                          aria-label="Xóa dịch vụ"
                        >
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
                              d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Input row */}
                  <tr className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Mô tả..."
                        value={newService.description}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={newService.quantity}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            quantity: Number(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        placeholder="Đơn giá"
                        value={newService.price || ""}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            price: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-slate-400">
                      {newService.price > 0
                        ? formatCurrency(newService.price * newService.quantity)
                        : "Thành tiền"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {/* Empty for add row */}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Payment Options */}
              <div className="space-y-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Thanh toán
                </h3>

                <div className="space-y-3">
                  {/* Deposit checkbox */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDepositInput}
                      onChange={(e) => {
                        setShowDepositInput(e.target.checked);
                        if (!e.target.checked) setDepositAmount(0);
                      }}
                      disabled={!!order?.depositAmount} // Disable if already deposited
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Đặt cọc{" "}
                      {order?.depositAmount
                        ? `(Đã cọc: ${formatCurrency(order.depositAmount)})`
                        : ""}
                    </span>
                  </label>

                  {/* Deposit input - only show when checkbox is checked and not already deposited */}
                  {showDepositInput && !order?.depositAmount && (
                    <div className="pl-6">
                      <input
                        type="number"
                        placeholder="Số tiền đặt cọc"
                        value={depositAmount || ""}
                        onChange={(e) =>
                          setDepositAmount(Number(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                  {/* Payment method selection */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      Phương thức thanh toán:
                    </label>
                    <div className="flex items-center gap-4 pl-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={formData.paymentMethod === "cash"}
                          onChange={(e) =>
                            setFormData({ ...formData, paymentMethod: "cash" })
                          }
                          className="w-4 h-4"
                        />
                        <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <rect
                              x="2"
                              y="6"
                              width="20"
                              height="12"
                              rx="2"
                              ry="2"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Tiền mặt
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank"
                          checked={formData.paymentMethod === "bank"}
                          onChange={(e) =>
                            setFormData({ ...formData, paymentMethod: "bank" })
                          }
                          className="w-4 h-4"
                        />
                        <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
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
                              d="M3 21h18M3 10h18M7 6h10l2 4H5l2-4Zm2 4v11m6-11v11"
                            />
                          </svg>
                          Chuyển khoản
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                  {/* Partial payment checkbox - only show if status is "Trả máy" */}
                  {formData.status === "Trả máy" && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showPartialPayment}
                          onChange={(e) => {
                            setShowPartialPayment(e.target.checked);
                            if (!e.target.checked) setPartialPayment(0);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Thanh toán khi trả xe
                        </span>
                      </label>

                      {/* Partial Payment Input - only show when checkbox is checked */}
                      {showPartialPayment && (
                        <div className="pl-6 space-y-2">
                          <label className="text-xs text-slate-600 dark:text-slate-400">
                            Số tiền thanh toán thêm:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              value={partialPayment || ""}
                              onChange={(e) =>
                                setPartialPayment(Number(e.target.value))
                              }
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <button
                              onClick={() => setPartialPayment(0)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              0%
                            </button>
                            <button
                              onClick={() =>
                                setPartialPayment(
                                  Math.round(remainingAmount * 0.5)
                                )
                              }
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              50%
                            </button>
                            <button
                              onClick={() => setPartialPayment(remainingAmount)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              100%
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {formData.status !== "Trả máy" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    * Thanh toán khi trả xe chỉ khả dụng khi trạng thái là "Trả
                    máy"
                  </p>
                )}
              </div>

              {/* Right: Summary */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Tổng kết
                </h3>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Phí dịch vụ:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(formData.laborCost || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Tiền phụ tùng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(partsTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Gia công/Đặt hàng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(servicesTotal)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-600 font-medium">Giảm giá:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.discount || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discount: Number(e.target.value),
                          })
                        }
                        className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                      <select className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm">
                        <option>₫</option>
                        <option>%</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t-2 border-slate-400 dark:border-slate-500">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Tổng cộng:
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  {/* Show payment breakdown if there's deposit or partial payment */}
                  {(totalDeposit > 0 || totalAdditionalPayment > 0) && (
                    <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-600">
                      {totalDeposit > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">
                            Đã đặt cọc:
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalDeposit)}
                          </span>
                        </div>
                      )}
                      {totalAdditionalPayment > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">
                            Thanh toán thêm:
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalAdditionalPayment)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {remainingAmount > 0
                            ? "Còn phải thu:"
                            : "Đã thanh toán đủ"}
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            remainingAmount > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {formatCurrency(remainingAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
          >
            Lưu Phiếu
          </button>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Thêm khách hàng
              </h3>
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({
                    name: "",
                    phone: "",
                    vehicleModel: "",
                    licensePlate: "",
                  });
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Đóng"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên khách
                </label>
                <input
                  type="text"
                  placeholder="Nhập tên khách"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  placeholder="VD: 09xxxx"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Xe
                  </label>
                  <input
                    type="text"
                    placeholder="Dòng xe"
                    value={newCustomer.vehicleModel}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        vehicleModel: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Biển số
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 59A1-123.45"
                    value={newCustomer.licensePlate}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        licensePlate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({
                    name: "",
                    phone: "",
                    vehicleModel: "",
                    licensePlate: "",
                  });
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (newCustomer.name && newCustomer.phone) {
                    const customerId = `CUST-${Date.now()}`;
                    upsertCustomer({
                      id: customerId,
                      name: newCustomer.name,
                      phone: newCustomer.phone,
                      vehicleModel: newCustomer.vehicleModel,
                      licensePlate: newCustomer.licensePlate,
                      status: "active",
                      segment: "New",
                      loyaltyPoints: 0,
                      totalSpent: 0,
                      visitCount: 1,
                      lastVisit: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                    });

                    // Set the new customer to the form AND search field
                    setFormData({
                      ...formData,
                      customerName: newCustomer.name,
                      customerPhone: newCustomer.phone,
                      vehicleModel: newCustomer.vehicleModel,
                      licensePlate: newCustomer.licensePlate,
                    });

                    // Update customer search to show the name
                    setCustomerSearch(newCustomer.name);

                    // Close modal and reset
                    setShowAddCustomerModal(false);
                    setNewCustomer({
                      name: "",
                      phone: "",
                      vehicleModel: "",
                      licensePlate: "",
                    });
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                disabled={!newCustomer.name || !newCustomer.phone}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, icon, color }) => {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    orange: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    green: "bg-green-500/20 text-green-600 dark:text-green-400",
    purple: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-lg ${
            colorClasses[color as keyof typeof colorClasses]
          } flex items-center justify-center`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
      active
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
    }`}
  >
    {label}
  </button>
);

const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => {
  const styles = {
    "Tiếp nhận":
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    "Đang sửa":
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    "Đã sửa xong":
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    "Trả máy":
      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  };

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};
