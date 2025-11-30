import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Wrench,
  Check,
  TrendingUp,
  Search,
  Plus,
  Smartphone,
  HandCoins,
  Printer,
  History,
  ChevronDown,
  Share2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import type { WorkOrder, Part, WorkOrderPart, Vehicle } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
  useRefundWorkOrderRepo,
  useDeleteWorkOrderRepo,
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
import { WorkOrderMobileModal } from "./WorkOrderMobileModal";
import { ServiceManagerMobile } from "./ServiceManagerMobile";
import {
  validatePhoneNumber,
  validateDepositAmount,
} from "../../utils/validation";
import {
  detectMaintenancesFromWorkOrder,
  updateVehicleMaintenances,
} from "../../utils/maintenanceReminder";
import { RepairTemplatesModal } from "./components/RepairTemplatesModal";

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
type ServiceTabKey = "all" | "pending" | "inProgress" | "done" | "delivered";
type FilterColor = "slate" | "blue" | "orange" | "green" | "purple";

export default function ServiceManager() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth(); // Get user profile early for createCustomerDebtIfNeeded

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

  // Popular motorcycle models in Vietnam
  const POPULAR_MOTORCYCLES = [
    // Honda
    "Honda Wave RSX",
    "Honda Wave Alpha",
    "Honda Blade",
    "Honda Future",
    "Honda Winner X",
    "Honda Vision",
    "Honda Air Blade",
    "Honda SH Mode",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Vario",
    "Honda Lead",
    "Honda PCX",
    "Honda ADV",
    // Yamaha
    "Yamaha Exciter",
    "Yamaha Sirius",
    "Yamaha Jupiter",
    "Yamaha Grande",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX",
    "Yamaha XSR",
    // Suzuki
    "Suzuki Raider",
    "Suzuki Axelo",
    "Suzuki Satria",
    "Suzuki GD110",
    "Suzuki Impulse",
    "Suzuki Address",
    "Suzuki Revo",
    // SYM
    "SYM Elite",
    "SYM Galaxy",
    "SYM Star",
    "SYM Attila",
    "SYM Angela",
    "SYM Passing",
    // Piaggio & Vespa
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa GTS",
    // VinFast
    "VinFast Klara",
    "VinFast Evo200",
    "VinFast Ludo",
    "VinFast Impes",
    "VinFast Theon",
    // Khác
    "Khác",
  ];

  // Fetch parts from Supabase
  const { data: fetchedParts, isLoading: partsLoading } = usePartsRepo();

  // Fetch employees from Supabase
  const { data: fetchedEmployees, isLoading: employeesLoading } =
    useEmployeesRepo();

  // Fetch work orders from Supabase
  const { data: fetchedWorkOrders, isLoading: workOrdersLoading } =
    useWorkOrdersRepo();

  // Fetch customers from Supabase directly
  const [fetchedCustomers, setFetchedCustomers] = useState<any[]>([]);
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFetchedCustomers(data);
      }
    };
    fetchCustomers();
  }, []);

  // Use fetched data if available, otherwise use context
  const parts = fetchedParts || contextParts;
  const displayCustomers =
    fetchedCustomers.length > 0 ? fetchedCustomers : customers;
  const displayEmployees = fetchedEmployees || employees;
  const displayWorkOrders = fetchedWorkOrders || workOrders;

  // Sync fetched work orders to context
  useEffect(() => {
    console.log(
      "[ServiceManager] fetchedWorkOrders:",
      fetchedWorkOrders?.length,
      fetchedWorkOrders
    );
    console.log(
      "[ServiceManager] workOrders from context:",
      workOrders?.length,
      workOrders
    );
    if (fetchedWorkOrders) {
      setWorkOrders(fetchedWorkOrders);
    }
  }, [fetchedWorkOrders, setWorkOrders]);

  const [showModal, setShowModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileModalViewMode, setMobileModalViewMode] = useState(false); // true = xem chi tiết, false = chỉnh sửa
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WorkOrderStatus>(
    "all"
  );
  const [activeTab, setActiveTab] = useState<ServiceTabKey>("all");
  const [rowActionMenuId, setRowActionMenuId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });

  const location = useLocation();

  // Read status filter from URL query params (e.g., ?status=pending)
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "pending") {
      // Set to pending tab (Tiếp nhận + Đang sửa)
      setActiveTab("pending");
      // Clear the query param after applying
      searchParams.delete("status");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle navigation from ServiceHistory with editOrder state
  useEffect(() => {
    const state = location.state as { editOrder?: WorkOrder } | null;
    if (state?.editOrder) {
      // Set the editing order and open modal
      setEditingOrder(state.editOrder);
      setShowModal(true);
      // Clear the navigation state to prevent re-opening on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // State for print preview modal
  const [printOrder, setPrintOrder] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  // State for refund modal
  const [refundingOrder, setRefundingOrder] = useState<WorkOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  // Share invoice as image function
  const handleShareInvoice = async () => {
    if (!invoicePreviewRef.current || !printOrder) return;

    setIsSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoicePreviewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      const fileName = `phieu-sua-chua-${formatWorkOrderId(printOrder.id)}.png`;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Phiếu sửa chữa ${formatWorkOrderId(printOrder.id)}`,
          });
          showToast.success("Đã chia sẻ phiếu thành công!");
        } else {
          downloadImage(blob, fileName);
        }
      } else {
        downloadImage(blob, fileName);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing invoice:", error);
        showToast.error("Không thể chia sẻ phiếu");
      }
    } finally {
      setIsSharing(false);
    }
  };

  const downloadImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success("Đã tải phiếu xuống!");
  };

  // Open modal automatically if navigated from elsewhere with editOrder state

  useEffect(() => {
    if (!rowActionMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".service-row-menu")) {
        setRowActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rowActionMenuId]);

  const filteredOrders = useMemo(() => {
    let filtered = displayWorkOrders.filter((o) => !o.refunded);

    console.log(
      "[ServiceManager] Total displayWorkOrders:",
      displayWorkOrders.length
    );
    console.log(
      "[ServiceManager] Work orders status:",
      displayWorkOrders.map((o) => ({ id: o.id, status: o.status }))
    );

    if (activeTab === "delivered") {
      filtered = filtered.filter((o) => o.status === "Trả máy");
    } else {
      filtered = filtered.filter((o) => o.status !== "Trả máy");

      if (activeTab === "pending")
        filtered = filtered.filter((o) => o.status === "Tiếp nhận");
      else if (activeTab === "inProgress")
        filtered = filtered.filter((o) => o.status === "Đang sửa");
      else if (activeTab === "done")
        filtered = filtered.filter((o) => o.status === "Đã sửa xong");
    }

    console.log(
      "[ServiceManager] After tab filter:",
      activeTab,
      filtered.length
    );

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
  }, [displayWorkOrders, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const pending = displayWorkOrders.filter(
      (o) => o.status === "Tiếp nhận"
    ).length;
    const inProgress = displayWorkOrders.filter(
      (o) => o.status === "Đang sửa"
    ).length;
    const done = displayWorkOrders.filter(
      (o) => o.status === "Đã sửa xong"
    ).length;
    const delivered = displayWorkOrders.filter(
      (o) => o.status === "Trả máy"
    ).length;
    const todayRevenue = displayWorkOrders
      .filter(
        (o) =>
          o.paymentStatus === "paid" &&
          new Date(o.creationDate).toDateString() === new Date().toDateString()
      )
      .reduce((sum, o) => sum + o.total, 0);

    // Profit = Revenue - Cost (parts costPrice + services costPrice)
    const todayProfit = displayWorkOrders
      .filter(
        (o) =>
          o.paymentStatus === "paid" &&
          new Date(o.creationDate).toDateString() === new Date().toDateString()
      )
      .reduce((sum, o) => {
        // Calculate parts cost (costPrice * quantity)
        const partsCost =
          o.partsUsed?.reduce(
            (s: number, p: WorkOrderPart) =>
              s + (p.costPrice || 0) * (p.quantity || 1),
            0
          ) || 0;
        // Calculate additional services cost
        const servicesCost =
          o.additionalServices?.reduce(
            (s: number, svc: { costPrice?: number; quantity?: number }) =>
              s + (svc.costPrice || 0) * (svc.quantity || 1),
            0
          ) || 0;
        // Profit = total - costs
        return sum + (o.total - partsCost - servicesCost);
      }, 0);

    return { pending, inProgress, done, delivered, todayRevenue, todayProfit };
  }, [displayWorkOrders]);

  const totalOpenTickets = stats.pending + stats.inProgress + stats.done;
  const urgentTickets = stats.pending + stats.inProgress;
  const urgentRatio = totalOpenTickets
    ? Math.round((urgentTickets / totalOpenTickets) * 100)
    : 0;
  const completionRate = totalOpenTickets
    ? Math.round((stats.done / totalOpenTickets) * 100)
    : 0;
  const profitMargin = stats.todayRevenue
    ? Math.round((stats.todayProfit / stats.todayRevenue) * 100)
    : 0;

  const FILTER_BADGE_CLASSES: Record<FilterColor, string> = {
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-200",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    orange:
      "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
    green:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    purple:
      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
  };
  const filterInputClass =
    "px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200";

  const quickStatusFilters = useMemo(
    (): Array<{
      key: ServiceTabKey;
      label: string;
      color: FilterColor;
      count: number;
    }> => [
      {
        key: "all",
        label: "Tất cả",
        color: "slate",
        count: displayWorkOrders.filter(
          (o) => o.status !== "Trả máy" && !o.refunded
        ).length,
      },
      {
        key: "pending",
        label: "Tiếp nhận",
        color: "blue",
        count: stats.pending,
      },
      {
        key: "inProgress",
        label: "Đang sửa",
        color: "orange",
        count: stats.inProgress,
      },
      {
        key: "done",
        label: "Đã sửa xong",
        color: "green",
        count: stats.done,
      },
      {
        key: "delivered",
        label: "Đã trả máy",
        color: "purple",
        count: stats.delivered,
      },
    ],
    [
      displayWorkOrders,
      stats.delivered,
      stats.done,
      stats.inProgress,
      stats.pending,
    ]
  );

  const statusSnapshotCards: Array<{
    key: ServiceTabKey;
    label: string;
    value: number;
    subtitle: string;
    accent: string;
    dot: string;
  }> = [
    {
      key: "pending",
      label: "Tiếp nhận",
      value: stats.pending,
      subtitle: "Chờ phân công",
      accent:
        "from-sky-50 via-sky-50 to-white dark:from-sky-900/30 dark:via-sky-900/10",
      dot: "bg-sky-500",
    },
    {
      key: "inProgress",
      label: "Đang sửa",
      value: stats.inProgress,
      subtitle: "Đang thi công",
      accent:
        "from-amber-50 via-amber-50 to-white dark:from-amber-900/30 dark:via-amber-900/10",
      dot: "bg-amber-500",
    },
    {
      key: "done",
      label: "Đã sửa xong",
      value: stats.done,
      subtitle: "Chờ giao khách",
      accent:
        "from-emerald-50 via-emerald-50 to-white dark:from-emerald-900/30 dark:via-emerald-900/10",
      dot: "bg-emerald-500",
    },
    {
      key: "delivered",
      label: "Trả máy",
      value: stats.delivered,
      subtitle: "Hoàn tất",
      accent:
        "from-purple-50 via-purple-50 to-white dark:from-purple-900/30 dark:via-purple-900/10",
      dot: "bg-purple-500",
    },
  ];

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
  const handlePrintOrder = async (order: WorkOrder) => {
    setPrintOrder(order);

    // Load store settings for print preview (single row, no branch_id)
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .limit(1)
        .single();

      if (!error && data) {
        setStoreSettings(data);
      }
    } catch (err) {
      console.error("Error loading store settings:", err);
    }

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

  // 🔹 Handle delete work order
  const { mutateAsync: deleteWorkOrderAsync } = useDeleteWorkOrderRepo();

  // 🔹 Handle create/update customer debts
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const updateCustomerDebt = useUpdateCustomerDebtRepo();

  // Helper: Auto-create customer debt if there's remaining amount (defined early for handleMobileSave)
  const createCustomerDebtIfNeeded = async (
    workOrder: WorkOrder,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    console.log("[createCustomerDebtIfNeeded] CALLED with:", {
      workOrderId: workOrder.id,
      totalAmount,
      paidAmount,
      remainingAmount,
      customerName: workOrder.customerName,
      timestamp: new Date().toISOString(),
    });

    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Khách vãng lai";

      // Tạo nội dung chi tiết từ phiếu sửa chữa
      const workOrderNumber =
        formatWorkOrderId(workOrder.id, storeSettings?.work_order_prefix)
          .split("-")
          .pop() || "";

      let description = `${
        workOrder.vehicleModel || "Xe"
      } (Phiếu sửa chữa #${workOrderNumber})`;

      // Mô tả vấn đề
      if (workOrder.issueDescription) {
        description += `\nVấn đề: ${workOrder.issueDescription}`;
      }

      // Danh sách phụ tùng đã sử dụng
      if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
        description += "\n\nPhụ tùng đã thay:";
        workOrder.partsUsed.forEach((part) => {
          description += `\n  • ${part.quantity} x ${
            part.partName
          } - ${formatCurrency(part.price * part.quantity)}`;
        });
      }

      // Danh sách dịch vụ bổ sung (gia công, đặt hàng)
      if (
        workOrder.additionalServices &&
        workOrder.additionalServices.length > 0
      ) {
        description += "\n\nDịch vụ:";
        workOrder.additionalServices.forEach((service) => {
          description += `\n  • ${service.quantity} x ${
            service.description
          } - ${formatCurrency(service.price * service.quantity)}`;
        });
      }

      // Công lao động
      if (workOrder.laborCost && workOrder.laborCost > 0) {
        description += `\n\nCông lao động: ${formatCurrency(
          workOrder.laborCost
        )}`;
      }

      // Giảm giá (nếu có)
      if (workOrder.discount && workOrder.discount > 0) {
        description += `\nGiảm giá: -${formatCurrency(workOrder.discount)}`;
      }

      // Thông tin nhân viên tạo phiếu
      const createdByDisplay = profile?.full_name || "N/A";
      description += `\n\nNV: ${createdByDisplay}`;

      // Thông tin nhân viên kỹ thuật
      if (workOrder.technicianName) {
        description += `\nNVKỹ thuật: ${workOrder.technicianName}`;
      }

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: workOrder.customerPhone || null,
        licensePlate: workOrder.licensePlate || null,
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        workOrderId: workOrder.id, // 🔹 Link debt với work order
      };

      console.log("[ServiceManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[ServiceManager] createCustomerDebt result:", result);
      showToast.success(
        `Đã tạo/cập nhật công nợ ${remainingAmount.toLocaleString()}đ (Mã: ${
          result?.id || "N/A"
        })`
      );
    } catch (error) {
      console.error("Error creating/updating customer debt:", error);
      showToast.error("Không thể tạo/cập nhật công nợ tự động");
    }
  };

  // 🔹 Handle create/update work orders (for mobile)
  const { mutateAsync: createWorkOrderAtomicAsync } =
    useCreateWorkOrderAtomicRepo();
  const { mutateAsync: updateWorkOrderAtomicAsync } =
    useUpdateWorkOrderAtomicRepo();

  // 🔹 Handle Mobile Save - Similar to desktop handleSave
  const handleMobileSave = async (workOrderData: any) => {
    try {
      console.log("[handleMobileSave] Mobile Work Order Data:", workOrderData);

      // Validate required fields
      if (!workOrderData.customer?.name) {
        showToast.error("Vui lòng nhập tên khách hàng");
        return;
      }
      if (!workOrderData.customer?.phone) {
        showToast.error("Vui lòng nhập số điện thoại");
        return;
      }

      // Extract data from workOrderData
      const {
        status,
        customer,
        vehicle,
        currentKm = 0,
        issueDescription,
        technicianId,
        parts = [],
        additionalServices = [],
        laborCost = 0,
        discount = 0,
        total = 0,
        depositAmount = 0,
        paymentMethod,
        paymentType,
        totalPaid = 0,
        remainingAmount = 0,
      } = workOrderData;

      // Determine payment status
      let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
      if (totalPaid >= total) {
        paymentStatus = "paid";
      } else if (totalPaid > 0) {
        paymentStatus = "partial";
      }

      // Find technician name
      const technician = displayEmployees.find(
        (e: any) => e.id === technicianId
      );
      const technicianName = technician?.name || "";

      // If this is a NEW work order
      if (!editingOrder?.id) {
        const orderId = `${
          storeSettings?.work_order_prefix || "SC"
        }-${Date.now()}`;

        const responseData = await createWorkOrderAtomicAsync({
          id: orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalPaid > depositAmount ? totalPaid - depositAmount : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          creationDate: new Date().toISOString(),
        } as any);

        const finalOrder: WorkOrder = {
          id: orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          creationDate: new Date().toISOString(),
        };

        // Update vehicle currentKm and maintenance records if km was entered
        if (currentKm > 0 && customer?.id && vehicle?.id) {
          await updateVehicleKmAndMaintenance(
            customer,
            vehicle.id,
            currentKm,
            parts,
            additionalServices,
            issueDescription
          );
        }

        // Auto-create customer debt if status is "Trả máy" and there's remaining amount
        if (status === "Trả máy" && remainingAmount > 0) {
          await createCustomerDebtIfNeeded(
            finalOrder,
            remainingAmount,
            total,
            totalPaid
          );
        }

        showToast.success("Tạo phiếu sửa chữa thành công!");
      } else {
        // Update existing work order
        const responseData = await updateWorkOrderAtomicAsync({
          id: editingOrder.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalPaid > depositAmount ? totalPaid - depositAmount : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
        } as any);

        const finalOrder: WorkOrder = {
          ...editingOrder,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
        };

        // Update vehicle currentKm and maintenance records if km was entered
        if (currentKm > 0 && customer?.id && vehicle?.id) {
          await updateVehicleKmAndMaintenance(
            customer,
            vehicle.id,
            currentKm,
            parts,
            additionalServices,
            issueDescription
          );
        }

        // Auto-create customer debt if status is "Trả máy" and there's remaining amount
        if (status === "Trả máy" && remainingAmount > 0) {
          await createCustomerDebtIfNeeded(
            finalOrder,
            remainingAmount,
            total,
            totalPaid
          );
        }

        showToast.success("Cập nhật phiếu sửa chữa thành công!");
      }

      setShowMobileModal(false);
      setEditingOrder(undefined);
    } catch (error: any) {
      console.error("[handleMobileSave] Error:", error);
      showToast.error(
        `Lỗi: ${error.message || "Không thể lưu phiếu sửa chữa"}`
      );
    }
  };

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
      console.log(
        "[handleConfirmRefund] Starting refund for order:",
        refundingOrder.id
      );
      console.log("[handleConfirmRefund] Refund reason:", refundReason);

      const result = await refundWorkOrderAsync({
        orderId: refundingOrder.id,
        refundReason: refundReason,
      });

      console.log("[handleConfirmRefund] Refund result:", result);

      // Check if mutation succeeded
      if (!result || (result as any).error) {
        console.error("[handleConfirmRefund] Refund failed:", result);
        showToast.error("Không thể hủy đơn sửa chữa");
        return;
      }

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

      showToast.success("Đã hủy đơn sửa chữa thành công");
      setShowRefundModal(false);
      setRefundingOrder(null);
      setRefundReason("");
    } catch (error) {
      console.error("Error refunding work order:", error);
      showToast.error("Lỗi khi hủy đơn sửa chữa");
    }
  };

  // Handle call customer
  const handleCallCustomer = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  // Handle delete work order - using hook for proper query invalidation
  const handleDelete = async (workOrder: WorkOrder) => {
    if (!confirm(`Xác nhận xóa phiếu ${formatWorkOrderId(workOrder.id)}?`)) {
      return;
    }
    try {
      await deleteWorkOrderAsync({ id: workOrder.id });
      // Note: Toast and query invalidation are handled by the hook's onSuccess
    } catch (error) {
      console.error("Error deleting work order:", error);
      // Note: Error toast is handled by the hook's onError
    }
  };

  // Mobile view
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    return (
      <>
        <ServiceManagerMobile
          workOrders={displayWorkOrders || []}
          onCreateWorkOrder={() => {
            setEditingOrder(undefined);
            setMobileModalViewMode(false); // Tạo mới = edit mode
            setShowMobileModal(true);
          }}
          onEditWorkOrder={(workOrder) => {
            setEditingOrder(workOrder);
            setMobileModalViewMode(true); // Click vào phiếu = view mode trước
            setShowMobileModal(true);
          }}
          onDeleteWorkOrder={handleDelete}
          onCallCustomer={handleCallCustomer}
          onPrintWorkOrder={handlePrintOrder}
          onOpenTemplates={() => setShowTemplateModal(true)}
          currentBranchId={currentBranchId}
        />

        {/* Mobile Modal */}
        {showMobileModal && (
          <WorkOrderMobileModal
            isOpen={showMobileModal}
            onClose={() => {
              setShowMobileModal(false);
              setEditingOrder(undefined);
              setMobileModalViewMode(false);
            }}
            onSave={handleMobileSave}
            workOrder={editingOrder}
            customers={displayCustomers}
            parts={fetchedParts || []}
            employees={displayEmployees}
            currentBranchId={currentBranchId}
            upsertCustomer={upsertCustomer}
            viewMode={mobileModalViewMode}
            onSwitchToEdit={() => setMobileModalViewMode(false)}
          />
        )}

        {/* Mobile Print Preview Modal */}
        {showPrintPreview && printOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-full max-h-[95vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between rounded-t-xl flex-shrink-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xem trước phiếu
                </h2>
                <div className="flex items-center gap-2">
                  {/* Share Button - Share as Image */}
                  <button
                    onClick={async () => {
                      try {
                        showToast.info("Đang tạo hình ảnh...");

                        // Import html2canvas dynamically
                        const html2canvas = (await import("html2canvas"))
                          .default;

                        const element = document.getElementById(
                          "mobile-print-preview-content"
                        );
                        if (!element) {
                          showToast.error("Không tìm thấy nội dung phiếu!");
                          return;
                        }

                        // Capture the element as canvas
                        const canvas = await html2canvas(element, {
                          scale: 2, // Higher quality
                          backgroundColor: "#ffffff",
                          useCORS: true,
                          logging: false,
                        });

                        // Convert canvas to blob
                        const blob = await new Promise<Blob>((resolve) => {
                          canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
                        });

                        const fileName = `Phieu_${formatWorkOrderId(
                          printOrder.id,
                          storeSettings?.work_order_prefix
                        )}.png`;

                        // Try to share as image file
                        if (navigator.share && navigator.canShare) {
                          const file = new File([blob], fileName, {
                            type: "image/png",
                          });
                          const shareData = {
                            files: [file],
                            title: `Phiếu sửa chữa - ${formatWorkOrderId(
                              printOrder.id,
                              storeSettings?.work_order_prefix
                            )}`,
                          };

                          if (navigator.canShare(shareData)) {
                            await navigator.share(shareData);
                            showToast.success("Chia sẻ thành công!");
                          } else {
                            // Fallback: download the image
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                            showToast.success("Đã tải hình ảnh!");
                          }
                        } else {
                          // Fallback: download the image
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = fileName;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast.success("Đã tải hình ảnh!");
                        }
                      } catch (err) {
                        console.error("Share failed:", err);
                        showToast.error("Không thể chia sẻ. Vui lòng thử lại!");
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Chia sẻ
                  </button>
                  <button
                    onClick={handleDoPrint}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    In
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintPreview(false);
                      setPrintOrder(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
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

              {/* Print Preview Content - Mobile optimized */}
              <div className="flex-1 overflow-y-auto p-3 bg-slate-100 dark:bg-slate-900">
                <div
                  id="mobile-print-preview-content"
                  className="bg-white shadow-lg mx-auto"
                  style={{ maxWidth: "100%", color: "#000", padding: "4mm" }}
                >
                  {/* Store Info Header with Logo */}
                  <div
                    style={{
                      display: "flex",
                      gap: "3mm",
                      marginBottom: "3mm",
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "2mm",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Logo */}
                    {storeSettings?.logo_url && (
                      <div style={{ flexShrink: 0 }}>
                        <img
                          src={storeSettings.logo_url}
                          alt="Logo"
                          style={{
                            height: "15mm",
                            width: "auto",
                            objectFit: "contain",
                          }}
                          crossOrigin="anonymous"
                        />
                      </div>
                    )}
                    {/* Store Info */}
                    <div style={{ flex: 1, fontSize: "9pt" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "12pt",
                          color: "#1e40af",
                          marginBottom: "1mm",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#ef4444"
                        >
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span>
                          {storeSettings?.address ||
                            "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                        </span>
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#16a34a"
                        >
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                        <span>{storeSettings?.phone || "0947.747.907"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                    <h1
                      style={{
                        fontSize: "14pt",
                        fontWeight: "bold",
                        margin: "0",
                        color: "#1e40af",
                      }}
                    >
                      PHIẾU DỊCH VỤ SỬA CHỮA
                    </h1>
                    <div
                      style={{
                        fontSize: "9pt",
                        color: "#666",
                        marginTop: "1mm",
                      }}
                    >
                      Mã:{" "}
                      {formatWorkOrderId(
                        printOrder.id,
                        storeSettings?.work_order_prefix
                      )}
                    </div>
                    <div style={{ fontSize: "8pt", color: "#666" }}>
                      {new Date(printOrder.creationDate).toLocaleString(
                        "vi-VN"
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      marginBottom: "2mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      fontSize: "9pt",
                    }}
                  >
                    <div>
                      <strong>Khách hàng:</strong> {printOrder.customerName} -{" "}
                      {printOrder.customerPhone}
                    </div>
                    <div>
                      <strong>Xe:</strong> {printOrder.vehicleModel} -{" "}
                      <span style={{ color: "#3b82f6" }}>
                        {printOrder.licensePlate}
                      </span>
                    </div>
                  </div>

                  {/* Issue Description */}
                  {printOrder.issueDescription && (
                    <div
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        marginBottom: "2mm",
                        borderRadius: "2mm",
                        fontSize: "9pt",
                      }}
                    >
                      <strong>Mô tả sự cố:</strong>{" "}
                      {printOrder.issueDescription}
                    </div>
                  )}

                  {/* Parts Table */}
                  {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                    <div style={{ marginBottom: "2mm" }}>
                      <p
                        style={{
                          fontWeight: "bold",
                          margin: "0 0 1mm 0",
                          fontSize: "10pt",
                        }}
                      >
                        Phụ tùng:
                      </p>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #ddd",
                          fontSize: "9pt",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "left",
                              }}
                            >
                              Tên
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "center",
                                width: "12%",
                              }}
                            >
                              SL
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "right",
                                width: "28%",
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
                                    padding: "1.5mm",
                                  }}
                                >
                                  {part.partName}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "1.5mm",
                                    textAlign: "center",
                                  }}
                                >
                                  {part.quantity}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "1.5mm",
                                    textAlign: "right",
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
                      <div style={{ marginBottom: "2mm", fontSize: "9pt" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 1mm 0",
                            fontSize: "10pt",
                          }}
                        >
                          Dịch vụ bổ sung:
                        </p>
                        {printOrder.additionalServices.map(
                          (service: any, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>{service.description}</span>
                              <span style={{ fontWeight: "bold" }}>
                                {formatCurrency(
                                  service.price * (service.quantity || 1)
                                )}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {/* Cost Summary */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f9f9f9",
                      fontSize: "9pt",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1mm",
                      }}
                    >
                      <span>Tiền phụ tùng:</span>
                      <span>
                        {formatCurrency(
                          printOrder.partsUsed?.reduce(
                            (sum: number, p: WorkOrderPart) =>
                              sum + p.price * p.quantity,
                            0
                          ) || 0
                        )}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1mm",
                      }}
                    >
                      <span>Phí dịch vụ:</span>
                      <span>{formatCurrency(printOrder.laborCost || 0)}</span>
                    </div>
                    {printOrder.additionalServices &&
                      printOrder.additionalServices.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "1mm",
                          }}
                        >
                          <span>Giá công/Đặt hàng:</span>
                          <span>
                            {formatCurrency(
                              printOrder.additionalServices.reduce(
                                (sum: number, s: any) =>
                                  sum + (s.price || 0) * (s.quantity || 1),
                                0
                              )
                            )}
                          </span>
                        </div>
                      )}
                    {printOrder.discount != null && printOrder.discount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "1mm",
                          color: "#e74c3c",
                        }}
                      >
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(printOrder.discount)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: "2mm",
                        borderTop: "2px solid #3b82f6",
                        fontSize: "12pt",
                        fontWeight: "bold",
                        color: "#1e40af",
                      }}
                    >
                      <span>TỔNG CỘNG:</span>
                      <span>{formatCurrency(printOrder.total || 0)}</span>
                    </div>
                    {printOrder.depositAmount != null &&
                      printOrder.depositAmount > 0 && (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "1mm",
                              color: "#16a34a",
                            }}
                          >
                            <span>Đã đặt cọc:</span>
                            <span>
                              {formatCurrency(printOrder.depositAmount)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontWeight: "bold",
                              color: "#dc2626",
                            }}
                          >
                            <span>Còn lại:</span>
                            <span>
                              {formatCurrency(
                                printOrder.remainingAmount ||
                                  printOrder.total - printOrder.depositAmount
                              )}
                            </span>
                          </div>
                        </>
                      )}
                  </div>

                  {/* Bank Info Section */}
                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        marginTop: "3mm",
                        border: "1px solid #ddd",
                        padding: "2mm",
                        borderRadius: "2mm",
                        backgroundColor: "#f0f9ff",
                        fontSize: "9pt",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "3mm",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#1e40af",
                            }}
                          >
                            🏦 Thông tin thanh toán
                          </div>
                          <div style={{ color: "#000" }}>
                            Ngân hàng: {storeSettings.bank_name}
                          </div>
                          {storeSettings.bank_account_number && (
                            <div style={{ color: "#000" }}>
                              STK:{" "}
                              <strong>
                                {storeSettings.bank_account_number}
                              </strong>
                            </div>
                          )}
                          {storeSettings.bank_account_holder && (
                            <div style={{ color: "#000" }}>
                              Chủ TK: {storeSettings.bank_account_holder}
                            </div>
                          )}
                          {storeSettings.bank_branch && (
                            <div style={{ color: "#666", fontSize: "8pt" }}>
                              Chi nhánh: {storeSettings.bank_branch}
                            </div>
                          )}
                        </div>
                        {/* QR Code */}
                        {storeSettings.bank_qr_url && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={storeSettings.bank_qr_url}
                              alt="QR Banking"
                              style={{
                                height: "20mm",
                                width: "20mm",
                                objectFit: "contain",
                              }}
                              crossOrigin="anonymous"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer Note */}
                  <div
                    style={{
                      marginTop: "3mm",
                      padding: "2mm",
                      backgroundColor: "#fff9e6",
                      border: "1px solid #ffd700",
                      borderRadius: "2mm",
                      fontSize: "8pt",
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

                  {/* KTV Info */}
                  <div
                    style={{
                      marginTop: "2mm",
                      fontSize: "9pt",
                      textAlign: "right",
                      color: "#666",
                    }}
                  >
                    KTV: {printOrder.technicianName || "Chưa phân công"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repair Templates Modal for Mobile */}
        <RepairTemplatesModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onApplyTemplate={(template) => {
            // Convert and apply template to current work order for mobile
            const newOrder: WorkOrder = {
              id: `WO-${Date.now()}`,
              customerName: "",
              customerPhone: "",
              vehicleModel: "",
              issueDescription: template.description,
              status: "Tiếp nhận",
              creationDate: new Date().toISOString(),
              estimatedCompletion: new Date(
                Date.now() + template.duration * 60000
              ).toISOString(),
              assignedTechnician: "",
              laborCost: template.laborCost,
              partsUsed: template.parts.map((p) => ({
                partId: "",
                partName: p.name,
                quantity: p.quantity,
                unitPrice: p.price,
              })),
              notes: "",
              total: 0,
            };
            setEditingOrder(newOrder);
            setShowTemplateModal(false);
            setShowMobileModal(true);
          }}
          parts={fetchedParts || []}
          currentBranchId={currentBranchId}
        />
      </>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop insight cards */}
      <div className="grid gap-3 lg:grid-cols-[2fr,1fr]">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Phiếu cần xử lý
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {urgentTickets}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chiếm {urgentRatio}% của {totalOpenTickets || 0} phiếu đang mở
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Hoàn thành
              </p>
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {completionRate}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.done} phiếu chờ giao
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {statusSnapshotCards.map((card) => (
              <button
                key={card.key}
                onClick={() =>
                  setActiveTab(activeTab === card.key ? "all" : card.key)
                }
                className={`text-left rounded-lg border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                  activeTab === card.key
                    ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div
                  className={`rounded-lg bg-gradient-to-br ${card.accent} p-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {card.label}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {card.value}
                      </p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${card.dot}`}></span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {card.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-3 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                  Doanh thu hôm nay
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(stats.todayRevenue)}
                </p>
              </div>
              <HandCoins className="w-6 h-6 text-white/80" />
            </div>
            <p className="mt-1.5 text-[10px] text-white/80">
              Bao gồm các phiếu đã thanh toán trong ngày
            </p>
          </div>

          <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Lợi nhuận hôm nay
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(stats.todayProfit)}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400">
                Biên lợi nhuận
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {profitMargin}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick status filters - Hidden on desktop (lg+) since we have the stat cards above */}
      <div className="lg:hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Trạng thái nhanh
        </span>
        <div className="flex flex-wrap gap-2">
          {quickStatusFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() =>
                setActiveTab(activeTab === filter.key ? "all" : filter.key)
              }
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                activeTab === filter.key
                  ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              <span>{filter.label}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  FILTER_BADGE_CLASSES[filter.color]
                }`}
              >
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Bar - Single row on desktop */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <input
              type="text"
              placeholder="Mã phiếu, tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <Search
              className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400"
              aria-hidden="true"
            />
          </div>

          {/* Filters - inline */}
          <select className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg">
            <option>Tất cả ngày</option>
            <option>Hôm nay</option>
            <option>7 ngày qua</option>
            <option>30 ngày qua</option>
          </select>
          <select className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg">
            <option>Tất cả KTV</option>
            <option>KTV 1</option>
            <option>KTV 2</option>
          </select>
          <select className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg">
            <option>Thanh toán</option>
            <option>Đã TT</option>
            <option>Chưa TT</option>
          </select>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Action Buttons */}
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
            aria-label="Mở danh sách mẫu sửa chữa"
          >
            <FileText className="w-3.5 h-3.5" /> Mẫu SC
          </button>
          <Link
            to="/service-history"
            className="px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Lịch sử SC
          </Link>
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setShowMobileModal(true);
              } else {
                handleOpenModal();
              }
            }}
            className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
            aria-label="Tạo phiếu sửa chữa mới"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Phiếu
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 w-12">
                  <input type="checkbox" className="rounded" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Mã phiếu
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Chi tiết
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                  Thanh toán & trạng thái
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
                  const totalAmount = order.total || 0;
                  const paidAmount = totalAmount - (order.remainingAmount || 0);
                  const paymentProgress = totalAmount
                    ? Math.min(
                        100,
                        Math.round((paidAmount / totalAmount) * 100)
                      )
                    : 0;
                  const paymentPillClass =
                    order.paymentStatus === "paid"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300";
                  const visibleParts = order.partsUsed?.slice(0, 2) || [];
                  const remainingParts =
                    (order.partsUsed?.length || 0) - visibleParts.length;
                  const visibleServices =
                    order.additionalServices?.slice(0, 2) || [];
                  const remainingServices =
                    (order.additionalServices?.length || 0) -
                    visibleServices.length;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenModal(order)}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors"
                    >
                      {/* Checkbox column */}
                      <td
                        className="px-2 py-4 align-top"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input type="checkbox" className="rounded" />
                      </td>

                      {/* Column 1: Mã phiếu */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                            {formatWorkOrderId(
                              order.id,
                              storeSettings?.work_order_prefix
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            <span>Ngày: </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {formatDate(order.creationDate, true)}
                            </span>
                          </div>
                          <div className="text-xs text-cyan-600 dark:text-cyan-400">
                            NV: {order.technicianName || "Chưa phân công"}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Khách hàng */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                            {order.customerName}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {order.customerPhone}
                          </div>
                          <div className="text-xs text-slate-500">
                            <span className="font-medium">Xe: </span>
                            <span>{order.vehicleModel || "N/A"}</span>
                            {order.licensePlate && (
                              <span className="ml-1">
                                - {order.licensePlate}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 italic mt-1">
                            {order.issueDescription || "Không có mô tả"}
                          </div>
                        </div>
                      </td>

                      {/* Column 3: Chi tiết - Compact format */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5 max-w-[180px]">
                          {visibleParts.length > 0 && (
                            <div className="text-xs">
                              <span className="text-slate-500 dark:text-slate-400">
                                🔧{" "}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {visibleParts.slice(0, 2).map((p, i) => (
                                  <span key={i}>
                                    {p.partName?.length > 20
                                      ? p.partName.substring(0, 20) + "..."
                                      : p.partName}
                                    {p.quantity > 1 && ` x${p.quantity}`}
                                    {i < Math.min(visibleParts.length, 2) - 1 &&
                                      ", "}
                                  </span>
                                ))}
                                {visibleParts.length > 2 && (
                                  <span className="text-slate-400">
                                    {" "}
                                    +{visibleParts.length - 2}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {visibleServices.length > 0 && (
                            <div className="text-xs">
                              <span className="text-slate-500 dark:text-slate-400">
                                ⚙️{" "}
                              </span>
                              <span className="text-slate-700 dark:text-slate-300">
                                {visibleServices.slice(0, 2).map((s, i) => (
                                  <span key={i}>
                                    {s.description?.length > 15
                                      ? s.description.substring(0, 15) + "..."
                                      : s.description}
                                    {i <
                                      Math.min(visibleServices.length, 2) - 1 &&
                                      ", "}
                                  </span>
                                ))}
                                {visibleServices.length > 2 && (
                                  <span className="text-slate-400">
                                    {" "}
                                    +{visibleServices.length - 2}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {visibleParts.length === 0 &&
                            visibleServices.length === 0 && (
                              <div className="text-xs text-slate-400 italic">
                                —
                              </div>
                            )}
                        </div>
                      </td>

                      {/* Column 4: Thanh toán & trạng thái - Clean layout */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2 min-w-[200px]">
                          {/* Tổng tiền */}
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {formatCurrency(totalAmount)}
                          </div>

                          {/* Progress bar + Đã thu */}
                          {totalAmount > 0 && (
                            <div className="space-y-1">
                              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    paymentProgress >= 100
                                      ? "bg-emerald-500"
                                      : paymentProgress > 0
                                      ? "bg-blue-500"
                                      : "bg-slate-300"
                                  }`}
                                  style={{
                                    width: `${Math.min(paymentProgress, 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>
                                  Đã thu:{" "}
                                  {formatCurrency(Math.max(0, paidAmount))}
                                </span>
                                {order.remainingAmount !== undefined &&
                                  order.remainingAmount > 0 && (
                                    <span className="text-red-500 font-medium">
                                      Còn{" "}
                                      {formatCurrency(order.remainingAmount)}
                                    </span>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Status badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              status={order.status as WorkOrderStatus}
                            />
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${paymentPillClass}`}
                            >
                              {order.paymentStatus === "paid"
                                ? "Đã TT"
                                : order.paymentStatus === "partial"
                                ? "TT một phần"
                                : "Chưa TT"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td
                        className="px-4 py-4 align-top overflow-visible"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <div className="relative service-row-menu">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                                setRowActionMenuId(
                                  rowActionMenuId === order.id ? null : order.id
                                );
                              }}
                              aria-haspopup="menu"
                              aria-expanded={rowActionMenuId === order.id}
                              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {rowActionMenuId === order.id && (
                              <div
                                className="fixed w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl z-[9999]"
                                style={{
                                  top: dropdownPosition.top,
                                  right: dropdownPosition.right,
                                }}
                              >
                                <button
                                  onClick={() => {
                                    handlePrintOrder(order);
                                    setRowActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-t-lg"
                                >
                                  <Printer className="w-4 h-4" /> In phiếu
                                </button>
                                <button
                                  onClick={() => {
                                    handleCallCustomer(
                                      order.customerPhone || ""
                                    );
                                    setRowActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700"
                                >
                                  <Smartphone className="w-4 h-4" /> Gọi khách
                                </button>
                                {!order.refunded && (
                                  <button
                                    onClick={() => {
                                      handleRefundOrder(order);
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-lg"
                                  >
                                    Hủy/Hoàn tiền
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
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

      {/* Repair Templates Modal - Component tách riêng */}
      <RepairTemplatesModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApplyTemplate={(template) => {
          // Convert and apply template to current work order
          const newOrder: WorkOrder = {
            id: `WO-${Date.now()}`,
            customerName: "",
            customerPhone: "",
            vehicleModel: "",
            issueDescription: template.description,
            status: "Tiếp nhận",
            creationDate: new Date().toISOString(),
            estimatedCompletion: new Date(
              Date.now() + template.duration * 60000
            ).toISOString(),
            assignedTechnician: "",
            laborCost: template.laborCost,
            partsUsed: template.parts.map((p) => ({
              partId: "",
              partName: p.name,
              quantity: p.quantity,
              unitPrice: p.price,
            })),
            notes: "",
            total: 0,
          };
          setEditingOrder(newOrder);
          setShowTemplateModal(false);
          setShowModal(true);
        }}
        parts={fetchedParts || []}
        currentBranchId={currentBranchId}
      />

      {/* Work Order Modal */}
      {showModal && editingOrder && (
        <WorkOrderModal
          order={editingOrder}
          onClose={() => {
            setShowModal(false);
            setEditingOrder(undefined);
          }}
          onSave={() => {
            // React Query hooks already invalidate queries on success
            // Just close modal - data will auto-refresh via invalidateQueries
            setShowModal(false);
            setEditingOrder(undefined);
          }}
          parts={parts}
          partsLoading={partsLoading}
          customers={displayCustomers}
          employees={displayEmployees}
          upsertCustomer={upsertCustomer}
          setCashTransactions={setCashTransactions}
          setPaymentSources={setPaymentSources}
          paymentSources={paymentSources}
          currentBranchId={currentBranchId}
          storeSettings={storeSettings}
          invalidateWorkOrders={() =>
            queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] })
          }
        />
      )}

      {/* Mobile Work Order Modal */}
      <WorkOrderMobileModal
        isOpen={showMobileModal}
        onClose={() => {
          setShowMobileModal(false);
          setEditingOrder(undefined);
        }}
        onSave={handleMobileSave}
        workOrder={editingOrder}
        customers={displayCustomers}
        parts={fetchedParts || []}
        employees={displayEmployees || []}
        currentBranchId={currentBranchId}
      />

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
                  onClick={handleShareInvoice}
                  disabled={isSharing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Share2 className="w-4 h-4" />
                  {isSharing ? "Đang xử lý..." : "Chia sẻ"}
                </button>
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
                ref={invoicePreviewRef}
                className="bg-white shadow-lg mx-auto"
                style={{ width: "148mm", minHeight: "210mm", color: "#000" }}
              >
                <div style={{ padding: "10mm" }}>
                  {/* Store Info Header - Compact Layout */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "4mm",
                      marginBottom: "4mm",
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "3mm",
                    }}
                  >
                    {/* Left: Logo */}
                    {storeSettings?.logo_url && (
                      <img
                        src={storeSettings.logo_url}
                        alt="Logo"
                        style={{
                          height: "18mm",
                          width: "18mm",
                          objectFit: "contain",
                          flexShrink: 0,
                        }}
                      />
                    )}

                    {/* Center: Store Info */}
                    <div
                      style={{ fontSize: "8.5pt", lineHeight: "1.4", flex: 1 }}
                    >
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
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#ef4444"
                        >
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span>
                          {storeSettings?.address ||
                            "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                        </span>
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#16a34a"
                        >
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                        <span>{storeSettings?.phone || "0947.747.907"}</span>
                      </div>
                      {storeSettings?.email && (
                        <div
                          style={{
                            color: "#000",
                            display: "flex",
                            alignItems: "center",
                            gap: "1mm",
                          }}
                        >
                          <svg
                            style={{
                              width: "10px",
                              height: "10px",
                              flexShrink: 0,
                            }}
                            viewBox="0 0 24 24"
                            fill="#3b82f6"
                          >
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                          <span>{storeSettings.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Bank Info & QR */}
                    <div
                      style={{
                        fontSize: "8pt",
                        lineHeight: "1.4",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {storeSettings?.bank_name && (
                        <>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#000",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: "1mm",
                            }}
                          >
                            <svg
                              style={{
                                width: "10px",
                                height: "10px",
                                flexShrink: 0,
                              }}
                              viewBox="0 0 24 24"
                              fill="#0891b2"
                            >
                              <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                            </svg>
                            <span>{storeSettings.bank_name}</span>
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
                        {printOrder.totalPaid != null &&
                          printOrder.totalPaid > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  paddingTop: "2mm",
                                  fontSize: "10pt",
                                  color: "#16a34a",
                                }}
                              >
                                Đã thanh toán:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingTop: "2mm",
                                  fontSize: "10pt",
                                  color: "#16a34a",
                                }}
                              >
                                {formatCurrency(printOrder.totalPaid)}
                              </td>
                            </tr>
                          )}
                        {printOrder.remainingAmount != null &&
                          printOrder.remainingAmount > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "11pt",
                                  color: "#dc2626",
                                }}
                              >
                                Còn lại:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  fontSize: "11pt",
                                  fontWeight: "bold",
                                  color: "#dc2626",
                                }}
                              >
                                {formatCurrency(printOrder.remainingAmount)}
                              </td>
                            </tr>
                          )}
                        {printOrder.paymentMethod && (
                          <tr>
                            <td
                              style={{
                                paddingTop: "2mm",
                                fontSize: "9pt",
                                color: "#666",
                              }}
                            >
                              Hình thức thanh toán:
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                paddingTop: "2mm",
                                fontSize: "9pt",
                                color: "#666",
                              }}
                            >
                              {printOrder.paymentMethod === "cash"
                                ? "Tiền mặt"
                                : printOrder.paymentMethod === "bank"
                                ? "Chuyển khoản"
                                : printOrder.paymentMethod}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer - Signatures & Bank Info */}
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
                          {printOrder.technicianName || "(Ký và ghi rõ họ tên)"}
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

                  {/* Warranty Policy Disclaimer */}
                  <div
                    style={{
                      marginTop: "3mm",
                      padding: "2mm",
                      fontSize: "8pt",
                      color: "#666",
                      borderTop: "1px solid #e5e7eb",
                      lineHeight: "1.4",
                    }}
                  >
                    <p style={{ margin: "0 0 1mm 0", fontWeight: "bold" }}>
                      Chính sách bảo hành:
                    </p>
                    <ul
                      style={{
                        margin: "0",
                        paddingLeft: "5mm",
                        listStyleType: "disc",
                      }}
                    >
                      <li>
                        Bảo hành áp dụng cho phụ tùng chính hãng và lỗi kỹ thuật
                        do thợ
                      </li>
                      <li>
                        Không bảo hành đối với va chạm, ngã xe, ngập nước sau
                        khi nhận xe
                      </li>
                      <li>
                        Mang theo phiếu này khi đến bảo hành. Liên hệ hotline
                        nếu có thắc mắc
                      </li>
                    </ul>
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
          {/* Header with Logo, Store Info and Bank Info */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "4mm",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "3mm",
              marginBottom: "4mm",
            }}
          >
            {/* Left: Logo (if available) */}
            {storeSettings?.logo_url && (
              <img
                src={storeSettings.logo_url}
                alt="Logo"
                style={{
                  height: "18mm",
                  width: "18mm",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            )}

            {/* Center: Store Info */}
            <div style={{ fontSize: "8.5pt", lineHeight: "1.4", flex: 1 }}>
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
              <div
                style={{
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  gap: "1mm",
                }}
              >
                <svg
                  style={{ width: "10px", height: "10px", flexShrink: 0 }}
                  viewBox="0 0 24 24"
                  fill="#ef4444"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>
                  {storeSettings?.address ||
                    "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                </span>
              </div>
              <div
                style={{
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  gap: "1mm",
                }}
              >
                <svg
                  style={{ width: "10px", height: "10px", flexShrink: 0 }}
                  viewBox="0 0 24 24"
                  fill="#16a34a"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                <span>{storeSettings?.phone || "0947.747.907"}</span>
              </div>
              {storeSettings?.email && (
                <div
                  style={{
                    color: "#000",
                    display: "flex",
                    alignItems: "center",
                    gap: "1mm",
                  }}
                >
                  <svg
                    style={{ width: "10px", height: "10px", flexShrink: 0 }}
                    viewBox="0 0 24 24"
                    fill="#3b82f6"
                  >
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  <span>{storeSettings.email}</span>
                </div>
              )}
            </div>

            {/* Right: Bank Info & QR */}
            <div
              style={{
                fontSize: "8pt",
                lineHeight: "1.4",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {storeSettings?.bank_name && (
                <>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "1mm",
                      color: "#000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "1mm",
                    }}
                  >
                    <svg
                      style={{ width: "10px", height: "10px", flexShrink: 0 }}
                      viewBox="0 0 24 24"
                      fill="#0891b2"
                    >
                      <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                    </svg>
                    <span>{storeSettings.bank_name}</span>
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
                {new Date(printOrder.creationDate).toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
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
                {printOrder.totalPaid != null && printOrder.totalPaid > 0 && (
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingTop: "2mm",
                        fontSize: "10pt",
                        color: "#16a34a",
                      }}
                    >
                      Đã thanh toán:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingTop: "2mm",
                        fontSize: "10pt",
                        color: "#16a34a",
                      }}
                    >
                      {formatCurrency(printOrder.totalPaid)}
                    </td>
                  </tr>
                )}
                {printOrder.remainingAmount != null &&
                  printOrder.remainingAmount > 0 && (
                    <tr>
                      <td
                        style={{
                          fontWeight: "bold",
                          fontSize: "11pt",
                          color: "#dc2626",
                        }}
                      >
                        Còn lại:
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontSize: "11pt",
                          fontWeight: "bold",
                          color: "#dc2626",
                        }}
                      >
                        {formatCurrency(printOrder.remainingAmount)}
                      </td>
                    </tr>
                  )}
                {printOrder.paymentMethod && (
                  <tr>
                    <td
                      style={{
                        paddingTop: "2mm",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      Hình thức thanh toán:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingTop: "2mm",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      {printOrder.paymentMethod === "cash"
                        ? "Tiền mặt"
                        : printOrder.paymentMethod === "bank"
                        ? "Chuyển khoản"
                        : printOrder.paymentMethod}
                    </td>
                  </tr>
                )}
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
                  {printOrder.technicianName || "(Ký và ghi rõ họ tên)"}
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

          {/* Warranty Policy Disclaimer */}
          <div
            style={{
              marginTop: "3mm",
              padding: "2mm",
              fontSize: "8pt",
              color: "#666",
              borderTop: "1px solid #e5e7eb",
              lineHeight: "1.4",
            }}
          >
            <p style={{ margin: "0 0 1mm 0", fontWeight: "bold" }}>
              Chính sách bảo hành:
            </p>
            <ul
              style={{
                margin: "0",
                paddingLeft: "5mm",
                listStyleType: "disc",
              }}
            >
              <li>
                Bảo hành áp dụng cho phụ tùng chính hãng và lỗi kỹ thuật do thợ
              </li>
              <li>
                Không bảo hành đối với va chạm, ngã xe, ngập nước sau khi nhận
                xe
              </li>
              <li>
                Mang theo phiếu này khi đến bảo hành. Liên hệ hotline nếu có
                thắc mắc
              </li>
            </ul>
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
  invalidateWorkOrders?: () => void;
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
  invalidateWorkOrders,
}) => {
  // Popular motorcycle models in Vietnam
  const POPULAR_MOTORCYCLES = [
    // Honda
    "Honda Wave RSX",
    "Honda Wave Alpha",
    "Honda Blade",
    "Honda Future",
    "Honda Winner X",
    "Honda Vision",
    "Honda Air Blade",
    "Honda SH Mode",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Vario",
    "Honda Lead",
    "Honda PCX",
    "Honda ADV",
    // Yamaha
    "Yamaha Exciter",
    "Yamaha Sirius",
    "Yamaha Jupiter",
    "Yamaha Grande",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX",
    "Yamaha XSR",
    // Suzuki
    "Suzuki Raider",
    "Suzuki Axelo",
    "Suzuki Satria",
    "Suzuki GD110",
    "Suzuki Impulse",
    "Suzuki Address",
    "Suzuki Revo",
    // SYM
    "SYM Elite",
    "SYM Galaxy",
    "SYM Star",
    "SYM Attila",
    "SYM Angela",
    "SYM Passing",
    // Piaggio & Vespa
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa GTS",
    // VinFast
    "VinFast Klara",
    "VinFast Evo200",
    "VinFast Ludo",
    "VinFast Impes",
    "VinFast Theon",
    // Khác
    "Khác",
  ];

  // profile already destructured at component top level
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
      vehicleId: order?.vehicleId || "",
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
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
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
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    model: "",
    licensePlate: "",
  });

  // Get customer's vehicles
  const currentCustomer = customers.find(
    (c) => c.phone === formData.customerPhone
  );
  const customerVehicles = currentCustomer?.vehicles || [];
  const hasMultipleVehicles = customerVehicles.length > 1;

  // Discount state
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [discountPercent, setDiscountPercent] = useState(0);

  // Submission guard to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Additional services state (Báo giá - Gia công/Đặt hàng)
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      description: string;
      quantity: number;
      price: number;
      costPrice?: number; // Giá nhập (chi phí gia công bên ngoài)
    }>
  >([]);
  const [newService, setNewService] = useState({
    description: "",
    quantity: 1,
    price: 0,
    costPrice: 0,
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

    // Reset discount type to amount when opening/changing order
    setDiscountType("amount");
    setDiscountPercent(0);
  }, [order]);

  // Filter customers based on search - show all if search is empty
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) {
      // Show all customers when no search term
      return customers.slice(0, 10); // Limit to first 10 for performance
    }

    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            v.licensePlate?.toLowerCase().includes(q)
          ))
    );
  }, [customers, customerSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".customer-search-container")) {
        setShowCustomerDropdown(false);
      }
      if (!target.closest(".vehicle-search-container")) {
        setShowVehicleDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle vehicle selection
  const handleSelectVehicle = (vehicle: any) => {
    setFormData({
      ...formData,
      vehicleId: vehicle.id,
      vehicleModel: vehicle.model,
      licensePlate: vehicle.licensePlate,
    });
    setShowVehicleDropdown(false);
  };

  // Handler: Add new vehicle to current customer
  const handleAddVehicle = () => {
    if (!currentCustomer) return;
    if (!newVehicle.model.trim() || !newVehicle.licensePlate.trim()) {
      showToast.error("Vui lòng nhập đầy đủ loại xe và biển số");
      return;
    }

    const vehicleId = `VEH-${Date.now()}`;
    const existingVehicles = currentCustomer.vehicles || [];

    const updatedVehicles = [
      ...existingVehicles,
      {
        id: vehicleId,
        model: newVehicle.model.trim(),
        licensePlate: newVehicle.licensePlate.trim(),
        isPrimary: existingVehicles.length === 0, // First vehicle is primary
      },
    ];

    // Update customer with new vehicle
    upsertCustomer({
      ...currentCustomer,
      vehicles: updatedVehicles,
    });

    // Auto-select the newly added vehicle
    setFormData({
      ...formData,
      vehicleId: vehicleId,
      vehicleModel: newVehicle.model.trim(),
      licensePlate: newVehicle.licensePlate.trim(),
    });

    // Reset and close modal
    setNewVehicle({ model: "", licensePlate: "" });
    setShowAddVehicleModal(false);
    showToast.success("Đã thêm xe mới");
  };

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

  // Helper: Update vehicle currentKm and lastMaintenances in customer record
  const updateVehicleKmAndMaintenance = async (
    customer: any,
    vehicleId: string,
    newKm: number,
    partsUsed: Array<{ partName: string }> = [],
    additionalServices: Array<{ description: string }> = [],
    issueDescription?: string
  ) => {
    if (!customer?.id || !vehicleId || !newKm) return;

    try {
      // Detect maintenance types from work order
      const detectedMaintenances = detectMaintenancesFromWorkOrder(
        partsUsed,
        additionalServices,
        issueDescription
      );

      // Find and update the vehicle in customer's vehicles array
      const updatedVehicles = (customer.vehicles || []).map((v: any) => {
        if (v.id === vehicleId) {
          // If maintenances detected, update lastMaintenances
          if (detectedMaintenances.length > 0) {
            const updatedVehicle = updateVehicleMaintenances(
              v,
              detectedMaintenances,
              newKm
            );
            console.log(
              `[updateVehicleKmAndMaintenance] Updated maintenances:`,
              detectedMaintenances
            );
            return updatedVehicle;
          }
          // Otherwise just update km
          return { ...v, currentKm: newKm };
        }
        return v;
      });

      // Save updated customer with new vehicle km
      const updatedCustomer = {
        ...customer,
        vehicles: updatedVehicles,
      };

      await upsertCustomer(updatedCustomer);
      console.log(
        `[updateVehicleKmAndMaintenance] Updated vehicle ${vehicleId} to ${newKm} km`
      );
    } catch (error) {
      console.error("[updateVehicleKmAndMaintenance] Error:", error);
      // Don't throw - this is a non-critical update
    }
  };

  // Legacy helper (keep for backwards compatibility)
  const updateVehicleKm = async (
    customer: any,
    vehicleId: string,
    newKm: number
  ) => {
    return updateVehicleKmAndMaintenance(customer, vehicleId, newKm);
  };

  // 🔹 Function to handle deposit (đặt cọc để đặt hàng)
  const handleDeposit = async () => {
    // Validation
    if (!formData.customerName?.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui lòng nhập số điện thoại");
      return;
    }

    // Validate phone number format using utility
    const phoneValidation = validatePhoneNumber(formData.customerPhone);
    if (!phoneValidation.ok) {
      showToast.error(phoneValidation.error || "Số điện thoại không hợp lệ");
      return;
    }

    if (depositAmount <= 0) {
      showToast.error("Vui lòng nhập số tiền đặt cọc");
      return;
    }

    // Validate deposit amount using utility
    const depositValidation = validateDepositAmount(depositAmount, total);
    if (!depositValidation.ok) {
      showToast.error(depositValidation.error || "Tiền đặt cọc không hợp lệ");
      return;
    }

    if (!formData.paymentMethod) {
      showToast.error("Vui lòng chọn phương thức thanh toán");
      return;
    }

    try {
      const orderId =
        formData.id ||
        `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

      // Prepare work order data with deposit
      const workOrderData: WorkOrder = {
        id: orderId,
        customerName: formData.customerName || "",
        customerPhone: formData.customerPhone || "",
        vehicleId: formData.vehicleId,
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
        depositAmount: depositAmount,
        depositDate: new Date().toISOString(),
        paymentStatus: "partial",
        paymentMethod: formData.paymentMethod,
        totalPaid: depositAmount,
        remainingAmount: total - depositAmount,
        creationDate: formData.creationDate || new Date().toISOString(),
      };

      // Save to database using Supabase
      if (formData.id) {
        // Update existing work order
        await supabase
          .from("work_orders")
          .update({
            customername: workOrderData.customerName,
            customerphone: workOrderData.customerPhone,
            vehicleid: workOrderData.vehicleId,
            vehiclemodel: workOrderData.vehicleModel,
            licenseplate: workOrderData.licensePlate,
            issuedescription: workOrderData.issueDescription,
            technicianname: workOrderData.technicianName,
            status: workOrderData.status,
            laborcost: workOrderData.laborCost,
            discount: workOrderData.discount,
            partsused: workOrderData.partsUsed,
            additionalservices: workOrderData.additionalServices,
            total: workOrderData.total,
            depositamount: workOrderData.depositAmount,
            depositdate: workOrderData.depositDate,
            paymentstatus: workOrderData.paymentStatus,
            paymentmethod: workOrderData.paymentMethod,
            totalpaid: workOrderData.totalPaid,
            remainingamount: workOrderData.remainingAmount,
          })
          .eq("id", formData.id);
      } else {
        // Insert new work order
        await supabase.from("work_orders").insert({
          id: workOrderData.id,
          customername: workOrderData.customerName,
          customerphone: workOrderData.customerPhone,
          vehicleid: workOrderData.vehicleId,
          vehiclemodel: workOrderData.vehicleModel,
          licenseplate: workOrderData.licensePlate,
          issuedescription: workOrderData.issueDescription,
          technicianname: workOrderData.technicianName,
          status: workOrderData.status,
          laborcost: workOrderData.laborCost,
          discount: workOrderData.discount,
          partsused: workOrderData.partsUsed,
          additionalservices: workOrderData.additionalServices,
          total: workOrderData.total,
          branchid: workOrderData.branchId,
          depositamount: workOrderData.depositAmount,
          depositdate: workOrderData.depositDate,
          paymentstatus: workOrderData.paymentStatus,
          paymentmethod: workOrderData.paymentMethod,
          totalpaid: workOrderData.totalPaid,
          remainingamount: workOrderData.remainingAmount,
          creationDate: workOrderData.creationDate,
        });
      }

      // Create deposit cash transaction (Thu tiền cọc vào quỹ)
      const depositTxId = `TX-${Date.now()}-DEP`;
      await supabase.from("cash_transactions").insert({
        id: depositTxId,
        type: "income",
        category: "service_deposit",
        amount: depositAmount,
        date: new Date().toISOString(),
        description: `Đặt cọc sửa chữa #${orderId.split("-").pop()} - ${
          formData.customerName
        }`,
        branchid: currentBranchId,
        paymentsource: formData.paymentMethod,
        reference: orderId,
      });

      // Create expense transaction (Phiếu chi để đặt hàng)
      const expenseTxId = `TX-${Date.now()}-EXP`;
      await supabase.from("cash_transactions").insert({
        id: expenseTxId,
        type: "expense",
        category: "parts_purchase",
        amount: depositAmount,
        date: new Date().toISOString(),
        description: `Đặt hàng phụ tùng cho #${orderId.split("-").pop()} - ${
          formData.customerName
        }`,
        branchid: currentBranchId,
        paymentsource: formData.paymentMethod,
        reference: orderId,
      });

      // Update UI state
      workOrderData.depositTransactionId = depositTxId;
      onSave(workOrderData);

      showToast.success(
        "Đã đặt cọc thành công! Phiếu chi đặt hàng đã được tạo."
      );
      onClose();
    } catch (error: any) {
      console.error("Error processing deposit:", error);
      showToast.error("Lỗi khi xử lý đặt cọc");
    }
  };

  // 🔹 Function to save work order without payment processing
  const handleSaveOnly = async () => {
    // Validation
    if (!formData.customerName?.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui lòng nhập số điện thoại");
      return;
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.customerPhone.trim())) {
      showToast.error("Số điện thoại không hợp lệ (cần 10-11 chữ số)");
      return;
    }

    // Note: Không validate total > 0 vì có thể chỉ tiếp nhận thông tin, chưa báo giá

    // Add/update customer
    if (formData.customerName && formData.customerPhone) {
      const existingCustomer = customers.find(
        (c) => c.phone === formData.customerPhone
      );

      if (!existingCustomer) {
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

        const vehicleId = `VEH-${Date.now()}`;
        const vehicles = [];
        if (formData.vehicleModel || formData.licensePlate) {
          vehicles.push({
            id: vehicleId,
            model: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            isPrimary: true,
          });
        }

        upsertCustomer({
          id: `CUST-${Date.now()}`,
          name: formData.customerName,
          phone: formData.customerPhone,
          vehicles: vehicles.length > 0 ? vehicles : undefined,
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

    // Determine payment status based on existing payments only (not new ones)
    let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
    const existingPaid =
      (order?.depositAmount || 0) + (order?.additionalPayment || 0);
    if (existingPaid >= total) {
      paymentStatus = "paid";
    } else if (existingPaid > 0) {
      paymentStatus = "partial";
    }

    try {
      const orderId =
        order?.id ||
        `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

      const workOrderData = {
        id: orderId,
        customername: formData.customerName || "",
        customerphone: formData.customerPhone || "",
        vehicleid: formData.vehicleId,
        vehiclemodel: formData.vehicleModel || "",
        licenseplate: formData.licensePlate || "",
        issuedescription: formData.issueDescription || "",
        technicianname: formData.technicianName || "",
        status: formData.status || "Tiếp nhận",
        laborcost: formData.laborCost || 0,
        discount: discount,
        partsused: selectedParts,
        additionalservices:
          additionalServices.length > 0 ? additionalServices : undefined,
        total: total,
        branchid: currentBranchId,
        paymentstatus: paymentStatus,
        paymentmethod: formData.paymentMethod || null,
        depositamount: order?.depositAmount || null,
        totalpaid: existingPaid > 0 ? existingPaid : null,
        remainingamount: total - existingPaid,
        creationdate: order?.creationDate || new Date().toISOString(),
      };

      // Save to Supabase database
      if (order?.id) {
        // Update existing
        const { data, error } = await supabase
          .from("work_orders")
          .update(workOrderData)
          .eq("id", order.id)
          .select();

        if (error) {
          console.error("[UPDATE ERROR]", error);
          throw error;
        }
        console.log("[UPDATE SUCCESS]", data);
      } else {
        // Insert new
        console.log("[INSERT] Attempting to insert:", workOrderData);
        const { data, error } = await supabase
          .from("work_orders")
          .insert(workOrderData)
          .select();

        if (error) {
          console.error("[INSERT ERROR]", error);
          console.error(
            "[INSERT ERROR DETAILS]",
            JSON.stringify(error, null, 2)
          );
          throw error;
        }
        console.log("[INSERT SUCCESS]", data);
      }

      // Invalidate queries to refresh the list
      if (invalidateWorkOrders) {
        invalidateWorkOrders();
      }

      onSave(workOrderData as unknown as WorkOrder);
      showToast.success(
        order?.id ? "Đã cập nhật phiếu" : "Đã lưu phiếu thành công"
      );
      onClose();
    } catch (error: any) {
      console.error("Error saving work order:", error);
      showToast.error(
        "Lỗi khi lưu phiếu: " +
          (error.message || error.hint || "Không xác định")
      );
    }
  };

  // 🔹 Function to handle payment processing
  const handleSave = async () => {
    // 🔹 PREVENT DUPLICATE SUBMISSIONS
    if (isSubmitting) {
      console.log("[handleSave] Already submitting, skipping...");
      return;
    }

    setIsSubmitting(true);

    try {
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

          const vehicleId = `VEH-${Date.now()}`;
          const vehicles = [];
          if (formData.vehicleModel || formData.licensePlate) {
            vehicles.push({
              id: vehicleId,
              model: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              isPrimary: true,
            });
          }

          upsertCustomer({
            id: `CUST-${Date.now()}`,
            name: formData.customerName,
            phone: formData.customerPhone,
            vehicles: vehicles.length > 0 ? vehicles : undefined,
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

      // If this is a NEW work order (with parts OR additionalServices OR deposit), use atomic RPC
      if (
        !order?.id &&
        (selectedParts.length > 0 ||
          additionalServices.length > 0 ||
          depositAmount > 0)
      ) {
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
            depositDate:
              depositAmount > 0 ? new Date().toISOString() : undefined,
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
                type: "income",
                category: "service_deposit",
                amount: depositAmount,
                date: new Date().toISOString(),
                description: `Đặt cọc sửa chữa #${(
                  formatWorkOrderId(
                    orderId,
                    storeSettings?.work_order_prefix
                  ) || ""
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
                  formatWorkOrderId(
                    orderId,
                    storeSettings?.work_order_prefix
                  ) || ""
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

          // 🔹 Create cash transactions for outsourcing costs (Giá nhập từ gia công bên ngoài)
          if (additionalServices.length > 0) {
            const totalOutsourcingCost = additionalServices.reduce(
              (sum, service) =>
                sum + (service.costPrice || 0) * service.quantity,
              0
            );

            if (totalOutsourcingCost > 0) {
              const outsourcingTxId = `EXPENSE-${Date.now()}`;

              // Create expense transaction
              try {
                console.log("[Outsourcing] Inserting expense transaction:", {
                  id: outsourcingTxId,
                  amount: -totalOutsourcingCost,
                  branchid: currentBranchId,
                });

                const { error: expenseError } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: outsourcingTxId,
                    type: "expense",
                    category: "outsourcing",
                    amount: -totalOutsourcingCost, // Negative for expense
                    date: new Date().toISOString(),
                    description: `Chi phí gia công bên ngoài - Phiếu #${orderId
                      .split("-")
                      .pop()} - ${additionalServices
                      .map((s) => s.description)
                      .join(", ")}`,
                    branchid: currentBranchId,
                    paymentsource: "cash",
                    reference: orderId,
                  });

                if (expenseError) {
                  console.error("[Outsourcing] Insert FAILED:", expenseError);
                  showToast.error(
                    `Lỗi tạo phiếu chi gia công: ${expenseError.message}`
                  );
                } else {
                  console.log("[Outsourcing] Insert SUCCESS");
                  // Update context
                  setCashTransactions((prev: any[]) => [
                    ...prev,
                    {
                      id: outsourcingTxId,
                      type: "expense",
                      category: "outsourcing",
                      amount: -totalOutsourcingCost,
                      date: new Date().toISOString(),
                      description: `Chi phí gia công bên ngoài - Phiếu #${orderId
                        .split("-")
                        .pop()}`,
                      branchId: currentBranchId,
                      paymentSource: "cash",
                      reference: orderId,
                    },
                  ]);

                  // Update payment sources balance
                  setPaymentSources((prev: any[]) =>
                    prev.map((ps) => {
                      if (ps.id === "cash") {
                        return {
                          ...ps,
                          balance: {
                            ...ps.balance,
                            [currentBranchId]:
                              (ps.balance[currentBranchId] || 0) -
                              totalOutsourcingCost,
                          },
                        };
                      }
                      return ps;
                    })
                  );

                  showToast.info(
                    `Đã tạo phiếu chi ${formatCurrency(
                      totalOutsourcingCost
                    )} cho gia công bên ngoài`
                  );
                }
              } catch (err) {
                console.error("Error creating outsourcing expense:", err);
              }
            }
          }

          // Call onSave to update the workOrders state
          onSave(finalOrder);

          // 🔹 Auto-create customer debt ONLY when status is "Trả máy" and there's remaining amount
          if (formData.status === "Trả máy" && remainingAmount > 0) {
            console.log("[handleSave] Creating debt with finalOrder:", {
              id: finalOrder.id,
              customerName: finalOrder.customerName,
              customerPhone: finalOrder.customerPhone,
              licensePlate: finalOrder.licensePlate,
              vehicleModel: finalOrder.vehicleModel,
            });
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmount,
              total,
              totalPaid
            );
          }

          // Close modal after successful save
          onClose();
        } catch (error: any) {
          console.error("Error creating work order (atomic):", error);
          // Error toast is already shown by the hook's onError
        }
        return;
      }

      // 🔹 If this is an UPDATE (with or without parts), use atomic RPC
      if (order?.id) {
        console.log(
          "[handleSave] UPDATE block - Order ID:",
          order.id,
          "Status:",
          formData.status
        );
        try {
          console.log("[handleSave] Calling updateWorkOrderAtomicAsync...");
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
          } as any);

          const workOrderRow = (responseData as any).workOrder;
          const depositTxId = responseData?.depositTransactionId;
          const paymentTxId = responseData?.paymentTransactionId;

          // 🔹 Transform snake_case response to camelCase for WorkOrder interface
          // If workOrderRow is undefined, build from formData + order
          const finalOrder: WorkOrder = workOrderRow
            ? {
                id: (workOrderRow as any).id || order.id,
                customerName:
                  (workOrderRow as any).customername ||
                  (workOrderRow as any).customerName ||
                  order.customerName,
                customerPhone:
                  (workOrderRow as any).customerphone ||
                  (workOrderRow as any).customerPhone ||
                  order.customerPhone,
                vehicleModel:
                  (workOrderRow as any).vehiclemodel ||
                  (workOrderRow as any).vehicleModel ||
                  order.vehicleModel,
                licensePlate:
                  (workOrderRow as any).licenseplate ||
                  (workOrderRow as any).licensePlate ||
                  order.licensePlate,
                issueDescription:
                  (workOrderRow as any).issuedescription ||
                  (workOrderRow as any).issueDescription ||
                  order.issueDescription ||
                  "",
                technicianName:
                  (workOrderRow as any).technicianname ||
                  (workOrderRow as any).technicianName ||
                  order.technicianName ||
                  "",
                status: (workOrderRow as any).status || order.status,
                laborCost:
                  (workOrderRow as any).laborcost ||
                  (workOrderRow as any).laborCost ||
                  order.laborCost ||
                  0,
                discount: (workOrderRow as any).discount || order.discount || 0,
                partsUsed:
                  (workOrderRow as any).partsused ||
                  (workOrderRow as any).partsUsed ||
                  order.partsUsed ||
                  [],
                additionalServices:
                  (workOrderRow as any).additionalservices ||
                  (workOrderRow as any).additionalServices ||
                  order.additionalServices,
                total: (workOrderRow as any).total || order.total,
                branchId:
                  (workOrderRow as any).branchid ||
                  (workOrderRow as any).branchId ||
                  order.branchId,
                depositAmount:
                  (workOrderRow as any).depositamount ||
                  (workOrderRow as any).depositAmount ||
                  order.depositAmount,
                depositDate:
                  (workOrderRow as any).depositdate ||
                  (workOrderRow as any).depositDate ||
                  order.depositDate,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus:
                  (workOrderRow as any).paymentstatus ||
                  (workOrderRow as any).paymentStatus ||
                  order.paymentStatus,
                paymentMethod:
                  (workOrderRow as any).paymentmethod ||
                  (workOrderRow as any).paymentMethod ||
                  order.paymentMethod,
                additionalPayment:
                  (workOrderRow as any).additionalpayment ||
                  (workOrderRow as any).additionalPayment ||
                  order.additionalPayment,
                totalPaid:
                  (workOrderRow as any).totalpaid ||
                  (workOrderRow as any).totalPaid ||
                  order.totalPaid,
                remainingAmount:
                  (workOrderRow as any).remainingamount ||
                  (workOrderRow as any).remainingAmount ||
                  order.remainingAmount,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate:
                  (workOrderRow as any).paymentdate ||
                  (workOrderRow as any).paymentDate ||
                  order.paymentDate,
                creationDate:
                  (workOrderRow as any).creationdate ||
                  (workOrderRow as any).creationDate ||
                  order.creationDate,
              }
            : {
                // Build from formData when workOrderRow is undefined
                ...order,
                customerName: formData.customerName || order.customerName,
                customerPhone: formData.customerPhone || order.customerPhone,
                vehicleModel: formData.vehicleModel || order.vehicleModel,
                licensePlate: formData.licensePlate || order.licensePlate,
                issueDescription:
                  formData.issueDescription || order.issueDescription,
                technicianName: formData.technicianName || order.technicianName,
                status: formData.status || order.status,
                laborCost: formData.laborCost || order.laborCost,
                discount: discount,
                partsUsed: selectedParts,
                additionalServices:
                  additionalServices.length > 0
                    ? additionalServices
                    : order.additionalServices,
                total: total,
                depositAmount: depositAmount,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus: paymentStatus,
                paymentMethod: formData.paymentMethod || order.paymentMethod,
                additionalPayment: totalAdditionalPayment,
                totalPaid: totalPaid,
                remainingAmount: remainingAmount,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate: paymentTxId
                  ? new Date().toISOString()
                  : order.paymentDate,
              };

          // Update cash transactions in context if new transactions created
          if (depositTxId && depositAmount > order.depositAmount!) {
            setCashTransactions((prev: any[]) => [
              ...prev,
              {
                id: depositTxId,
                type: "income",
                category: "service_deposit",
                amount: depositAmount - (order.depositAmount || 0),
                date: new Date().toISOString(),
                description: `Đặt cọc bổ sung #${(
                  formatWorkOrderId(
                    order.id,
                    storeSettings?.work_order_prefix
                  ) || ""
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
                  formatWorkOrderId(
                    order.id,
                    storeSettings?.work_order_prefix
                  ) || ""
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
                        (totalAdditionalPayment -
                          (order.additionalPayment || 0)),
                    },
                  };
                }
                return ps;
              })
            );
          }

          console.log(
            "[handleSave] updateWorkOrderAtomicAsync SUCCESS - Response:",
            responseData
          );

          onSave(finalOrder);

          // 🔹 Auto-create customer debt ONLY when status is "Trả máy" and there's remaining amount
          if (formData.status === "Trả máy" && remainingAmount > 0) {
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmount,
              total,
              totalPaid
            );
          }

          // Close modal after successful update
          onClose();
        } catch (error: any) {
          console.error(
            "[handleSave] Error updating work order (atomic):",
            error
          );
        }
        return;
      }

      // If we get here, it means this is a NEW order without going through atomic create
      // This shouldn't happen in normal flow, but log it for debugging
      console.warn(
        "[handleSave] Unexpected code path - no atomic create/update was called"
      );
    } finally {
      setIsSubmitting(false);
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
          category: part.category || "",
          quantity: 1,
          price: part.retailPrice[currentBranchId] || 0,
          costPrice: part.costPrice?.[currentBranchId] || 0,
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl rounded-t-3xl md:rounded-xl shadow-2xl md:shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-xl flex-shrink-0">
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
        <div className="px-4 py-5 md:px-6 md:py-6 space-y-6 overflow-y-auto flex-1 pb-24 md:pb-6">
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
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                // Find primary vehicle or first vehicle
                                const primaryVehicle =
                                  customer.vehicles?.find(
                                    (v: Vehicle) => v.isPrimary
                                  ) || customer.vehicles?.[0];

                                setFormData({
                                  ...formData,
                                  customerName: customer.name,
                                  customerPhone: customer.phone,
                                  vehicleId: primaryVehicle?.id,
                                  vehicleModel:
                                    primaryVehicle?.model ||
                                    customer.vehicleModel ||
                                    "",
                                  licensePlate:
                                    primaryVehicle?.licensePlate ||
                                    customer.licensePlate ||
                                    "",
                                });
                                setCustomerSearch(customer.name);
                                setShowCustomerDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-600 last:border-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                                    {customer.name}
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                    📱 {customer.phone}
                                  </div>
                                  {(customer.vehicleModel ||
                                    customer.licensePlate) && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle cx="6" cy="17" r="2" />
                                        <circle cx="18" cy="17" r="2" />
                                        <path d="M4 17h2l4-6h2l2 3h4" />
                                      </svg>
                                      {customer.vehicleModel && (
                                        <span>{customer.vehicleModel}</span>
                                      )}
                                      {customer.licensePlate && (
                                        <span className="font-mono font-medium">
                                          {customer.vehicleModel && "•"}{" "}
                                          {customer.licensePlate}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            {customers.length === 0
                              ? "Chưa có khách hàng nào. Nhấn '+' để thêm khách hàng mới."
                              : "Không tìm thấy khách hàng phù hợp"}
                          </div>
                        )}
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
                            vehicleId: undefined,
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

                {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                {currentCustomer && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {customerVehicles.length > 0
                          ? "Chọn xe"
                          : "Xe của khách hàng"}
                        {customerVehicles.length > 0 && (
                          <span className="text-xs text-slate-500 ml-1">
                            ({customerVehicles.length} xe)
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddVehicleModal(true)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
                        title="Thêm xe mới"
                      >
                        + Thêm xe
                      </button>
                    </div>

                    {customerVehicles.length > 0 ? (
                      <div className="space-y-2">
                        {customerVehicles.map((vehicle: Vehicle) => {
                          const isSelected = formData.vehicleId === vehicle.id;
                          const isPrimary = vehicle.isPrimary;

                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              onClick={() => handleSelectVehicle(vehicle)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                                  : "border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isPrimary && (
                                  <span
                                    className="text-yellow-500"
                                    title="Xe chính"
                                  >
                                    ⭐
                                  </span>
                                )}
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                    {vehicle.model}
                                  </div>
                                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                                    {vehicle.licensePlate}
                                  </div>
                                </div>
                                {isSelected && (
                                  <svg
                                    className="w-5 h-5 text-blue-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Chưa có xe nào. Click "+ Thêm xe" để thêm.
                        </p>
                      </div>
                    )}
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
                          emp.status === "active" &&
                          (emp.department?.toLowerCase().includes("kỹ thuật") ||
                            emp.position?.toLowerCase().includes("kỹ thuật"))
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
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {part.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                              {part.sku}
                            </span>
                            {part.category && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
                                  getCategoryColor(part.category).bg
                                } ${getCategoryColor(part.category).text}`}
                              >
                                {part.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
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
                        <td className="px-4 py-2">
                          <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                            {part.partName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {part.sku && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                {part.sku}
                              </span>
                            )}
                            {part.category && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
                                  getCategoryColor(part.category).bg
                                } ${getCategoryColor(part.category).text}`}
                              >
                                {part.category}
                              </span>
                            )}
                          </div>
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
                      Giá nhập
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
                              costPrice: 0,
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
                      <td className="px-4 py-2 text-right text-sm text-orange-600 dark:text-orange-400">
                        {service.costPrice
                          ? formatCurrency(service.costPrice)
                          : "-"}
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
                        placeholder="Giá nhập"
                        value={newService.costPrice || ""}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            costPrice: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-orange-300 dark:border-orange-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
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
                        value={
                          discountType === "amount"
                            ? formData.discount || ""
                            : discountPercent
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (discountType === "amount") {
                            const maxDiscount = subtotal;
                            setFormData({
                              ...formData,
                              discount: Math.min(value, maxDiscount),
                            });
                          } else {
                            const percent = Math.min(value, 100);
                            setDiscountPercent(percent);
                            setFormData({
                              ...formData,
                              discount: Math.round((subtotal * percent) / 100),
                            });
                          }
                        }}
                        className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        min="0"
                        max={discountType === "amount" ? subtotal : 100}
                      />
                      <select
                        value={discountType}
                        onChange={(e) => {
                          const newType = e.target.value as
                            | "amount"
                            | "percent";
                          setDiscountType(newType);
                          setFormData({
                            ...formData,
                            discount: 0,
                          });
                          setDiscountPercent(0);
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      >
                        <option value="amount">₫</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick percent buttons */}
                  {discountType === "percent" && (
                    <div className="flex gap-1 justify-end mt-2">
                      {[5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => {
                            setDiscountPercent(percent);
                            setFormData({
                              ...formData,
                              discount: Math.round((subtotal * percent) / 100),
                            });
                          }}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded transition-colors"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show amount if percent mode */}
                  {discountType === "percent" && discountPercent > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">
                      = {formatCurrency(formData.discount || 0)}
                    </div>
                  )}
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
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 md:px-6 flex items-center justify-end gap-3 bg-white md:bg-slate-50 dark:bg-slate-800/70 md:dark:bg-slate-800/50 rounded-b-3xl md:rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            Hủy
          </button>

          {/* Always show "Lưu Phiếu" */}
          <button
            onClick={handleSaveOnly}
            className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
          >
            Lưu Phiếu
          </button>

          {/* Show "Đặt cọc" button only when status is NOT "Trả máy" and deposit input is shown */}
          {formData.status !== "Trả máy" && showDepositInput && (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Đặt cọc
            </button>
          )}

          {/* Show "Thanh toán" button only when status is "Trả máy" */}
          {formData.status === "Trả máy" && (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2"
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
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Thanh toán
            </button>
          )}
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
                <div className="relative vehicle-search-container">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Dòng xe
                  </label>
                  <input
                    type="text"
                    placeholder="Chọn hoặc nhập dòng xe"
                    value={newCustomer.vehicleModel}
                    onChange={(e) => {
                      setNewCustomer({
                        ...newCustomer,
                        vehicleModel: e.target.value,
                      });
                      setShowVehicleDropdown(true);
                    }}
                    onFocus={() => setShowVehicleDropdown(true)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />

                  {/* Vehicle Model Dropdown */}
                  {showVehicleDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                      {POPULAR_MOTORCYCLES.filter((model) =>
                        model
                          .toLowerCase()
                          .includes(newCustomer.vehicleModel.toLowerCase())
                      ).map((model: string) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            setNewCustomer({
                              ...newCustomer,
                              vehicleModel: model,
                            });
                            setShowVehicleDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0 text-slate-900 dark:text-slate-100"
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
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
                    const vehicleId = `VEH-${Date.now()}`;
                    const vehicles = [];
                    if (newCustomer.vehicleModel || newCustomer.licensePlate) {
                      vehicles.push({
                        id: vehicleId,
                        model: newCustomer.vehicleModel || "",
                        licensePlate: newCustomer.licensePlate || "",
                        isPrimary: true,
                      });
                    }

                    upsertCustomer({
                      id: customerId,
                      name: newCustomer.name,
                      phone: newCustomer.phone,
                      vehicles: vehicles.length > 0 ? vehicles : undefined,
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
                      vehicleId: vehicles.length > 0 ? vehicleId : undefined,
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

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && currentCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Thêm xe cho {currentCustomer.name}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Loại xe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Exciter, Vision, Wave..."
                  value={newVehicle.model}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, model: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Biển số <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 29A 12345"
                  value={newVehicle.licensePlate}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      licensePlate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                💡 Xe mới sẽ tự động được chọn sau khi thêm
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddVehicleModal(false);
                  setNewVehicle({ model: "", licensePlate: "" });
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleAddVehicle}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                disabled={
                  !newVehicle.model.trim() || !newVehicle.licensePlate.trim()
                }
              >
                Thêm xe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
