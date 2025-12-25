import React, { useState, useMemo, useEffect } from "react";
import { Banknote, CreditCard } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { PlusIcon } from "../Icons";
import { supabase } from "../../supabaseClient";
import type { CustomerDebt, SupplierDebt } from "../../types";
import {
  useCustomerDebtsRepo,
  useCreateCustomerDebtRepo,
  useUpdateCustomerDebtRepo,
  useDeleteCustomerDebtRepo,
  useSupplierDebtsRepo,
  useCreateSupplierDebtRepo,
  useUpdateSupplierDebtRepo,
  useDeleteSupplierDebtRepo,
} from "../../hooks/useDebtsRepository";
import { useInstallments, useRecordInstallmentPayment, type SalesInstallment } from "../../hooks/useInstallments";
import { createCashTransaction } from "../../lib/repository/cashTransactionsRepository";
import { useQueryClient } from "@tanstack/react-query";
import InstallmentList from "./components/InstallmentList";

// Success Receipt Modal
const DebtReceiptModal: React.FC<{
  isOpen: boolean;
  data: any;
  onClose: () => void;
  onPrint: () => void;
}> = ({ isOpen, data, onClose, onPrint }) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-sm w-full border border-green-500 overflow-hidden relative">
        <div className="bg-green-600 p-4 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold">Thanh toán thành công!</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">
              {data.isCustomer ? "Người nộp tiền" : "Người thụ hưởng"}
            </p>
            <p className="text-slate-900 dark:text-white font-bold text-lg">
              {data.customerName || data.supplierName}
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 text-center border border-slate-100 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Số tiền</p>
            <p className={`text-2xl font-bold ${data.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(data.amount)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{data.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p>
          </div>

          <p className="text-center text-xs text-slate-400">
            {data.timestamp}
          </p>

          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              onClick={onPrint}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              In Phiếu
            </button>
            <button
              onClick={() => {
                onPrint();
                showToast.info("Hệ thống sẽ mở hộp thoại in. Bạn có thể chọn 'Lưu dưới dạng PDF' hoặc chụp ảnh màn hình để chia sẻ.");
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Chia sẻ
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

const DebtManager: React.FC = () => {
  const {
    customers,
    suppliers,
    currentBranchId,
    setCashTransactions,
    cashTransactions,
    setPaymentSources,
    paymentSources,
  } = useAppContext();

  // Fetch debts from Supabase
  const { data: customerDebts = [], isLoading: loadingCustomerDebts } =
    useCustomerDebtsRepo();
  const { data: supplierDebts = [], isLoading: loadingSupplierDebts } =
    useSupplierDebtsRepo();
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const updateCustomerDebt = useUpdateCustomerDebtRepo();
  const deleteCustomerDebt = useDeleteCustomerDebtRepo();
  const createSupplierDebt = useCreateSupplierDebtRepo();
  const updateSupplierDebt = useUpdateSupplierDebtRepo();
  const deleteSupplierDebt = useDeleteSupplierDebtRepo();
  const queryClient = useQueryClient();

  // Fetch installments for stats
  const { data: installments = [] } = useInstallments();

  // 🔹 Fetch unpaid work orders (status="Trả máy" and remainingamount > 0)
  const [unpaidWorkOrders, setUnpaidWorkOrders] = useState<any[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(true);

  // 🔹 Fetch unpaid sales (remainingamount > 0)
  const [unpaidSales, setUnpaidSales] = useState<any[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);

  useEffect(() => {
    const fetchUnpaidWorkOrders = async () => {
      setLoadingWorkOrders(true);
      try {
        const { data, error } = await supabase
          .from("work_orders")
          .select("*")
          .eq("status", "Trả máy")
          .eq("branchid", currentBranchId)
          .gt("remainingamount", 0);

        if (error) {
          console.error("Error fetching unpaid work orders:", error);
        } else {
          setUnpaidWorkOrders(data || []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoadingWorkOrders(false);
      }
    };

    const fetchUnpaidSales = async () => {
      setLoadingSales(true);
      try {
        const { data, error } = await supabase
          .from("sales")
          .select("*")
          .eq("branchid", currentBranchId)
          .gt("remainingamount", 0);

        if (error) {
          console.error("Error fetching unpaid sales:", error);
        } else {
          setUnpaidSales(data || []);
        }
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoadingSales(false);
      }
    };

    // Sales table doesn't have remainingamount column yet, so we skip this
    // fetchUnpaidSales();
    setUnpaidSales([]);
    setLoadingSales(false);

    fetchUnpaidWorkOrders();

    // 🔹 Realtime subscription for work_orders changes
    const workOrdersChannel = supabase
      .channel("work_orders_debt_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_orders",
          filter: `branchid=eq.${currentBranchId}`,
        },
        (payload) => {
          console.log("Work order changed:", payload);
          fetchUnpaidWorkOrders(); // Refetch when any change happens
        }
      )
      .subscribe();

    // 🔹 Realtime subscription for sales changes
    const salesChannel = supabase
      .channel("sales_debt_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          filter: `branchid=eq.${currentBranchId}`,
        },
        (payload) => {
          console.log("Sale changed:", payload);
          fetchUnpaidSales(); // Refetch when any change happens
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(workOrdersChannel);
      supabase.removeChannel(salesChannel);
    };
  }, [currentBranchId]);

  // 🔹 Convert work orders to debt-like format for display
  const workOrderDebts = useMemo(() => {
    // Get work order IDs that already have a debt record
    const existingWorkOrderIds = new Set(
      customerDebts
        .filter((d: any) => d.workOrderId)
        .map((d: any) => d.workOrderId)
    );

    // Filter out work orders that already have debt records
    return unpaidWorkOrders
      .filter((wo) => !existingWorkOrderIds.has(wo.id))
      .map((wo) => {
        const totalPaid = (wo.depositamount || 0) + (wo.additionalpayment || 0);
        const remainingAmount = Math.max(0, (wo.total || 0) - totalPaid);

        // Build description from parts
        let description = `Phiếu: ${wo.id}`;
        if (wo.partsused && wo.partsused.length > 0) {
          const partsText = wo.partsused
            .map((p: any) => `${p.quantity}x ${p.partName}`)
            .join(", ");
          description += `\n${partsText}`;
        }
        if (wo.laborcost > 0) {
          description += `\nCông: ${(wo.laborcost || 0).toLocaleString()}đ`;
        }
        // Add technician info
        if (wo.technicianname) {
          description += `\nNV: ${wo.technicianname}`;
        }

        return {
          id: `WO-${wo.id}`, // Prefix to distinguish from regular debts
          customerId: wo.customerphone || wo.id,
          customerName: wo.customername || "Khách vãng lai",
          phone: wo.customerphone || null,
          licensePlate: wo.licenseplate || null,
          description: description,
          totalAmount: wo.total || 0,
          paidAmount: totalPaid,
          remainingAmount: remainingAmount,
          createdDate: wo.creationdate || wo.created_at,
          branchId: wo.branchid || currentBranchId,
          workOrderId: wo.id,
          isFromWorkOrder: true, // Flag to identify source
          technicianName: wo.technicianname || null, // Store directly too
        };
      });
  }, [unpaidWorkOrders, customerDebts, currentBranchId]);

  // Fetch store settings
  const [storeSettings, setStoreSettings] = useState<any>(null);
  useEffect(() => {
    const fetchStoreSettings = async () => {
      const { data } = await supabase
        .from("store_settings")
        .select("*")
        .single();
      if (data) setStoreSettings(data);
    };
    fetchStoreSettings();
  }, []);

  const [activeTab, setActiveTab] = useState<"customer" | "supplier" | "installment">(
    "customer"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);

  // New states for enhanced features
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [showEditDebtModal, setShowEditDebtModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<
    CustomerDebt | SupplierDebt | null
  >(null);

  // 🔹 Print Handler (Iframe based to avoid popup blockers)
  const handlePrintDebt = (debt: CustomerDebt | SupplierDebt) => {
    const isCustomerDebt = "customerName" in debt;

    // Create or get print iframe
    let iframe = document.getElementById('print-receipt-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-receipt-frame';
      // Hide iframe but keep it part of DOM for printing
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const html = `
      <html>
        <head>
          <title>Phiếu ${isCustomerDebt ? "Thu" : "Chi"}</title>
          <style>
            @page { size: auto; margin: 5mm; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 20px; 
              max-width: 800px; 
              margin: 0 auto; 
              color: #333; 
            }
            .store-header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #0ea5e9; }
            .store-header h2 { margin: 0 0 10px 0; font-size: 24px; color: #0ea5e9; text-transform: uppercase; letter-spacing: 1px; }
            .store-header p { margin: 2px 0; color: #666; font-size: 13px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 26px; color: #1e293b; text-transform: uppercase; }
            .receipt-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; background: #fff; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: 600; color: #64748b; font-size: 14px; }
            .info-value { font-weight: 700; color: #0f172a; font-size: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 2px solid #0ea5e9; }
            .total-label { font-size: 16px; font-weight: 700; color: #0ea5e9; }
            .total-value { font-size: 20px; font-weight: 800; color: #0f172a; }
            .notes { margin-top: 20px; font-size: 13px; color: #64748b; font-style: italic; text-align: center; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
            .signature-box { width: 45%; }
            .signature-line { margin-top: 50px; border-top: 1px solid #94a3b8; width: 80%; margin-left: auto; margin-right: auto; }
            @media print { 
               body { -webkit-print-color-adjust: exact; } 
            }
          </style>
        </head>
        <body>
           <div class="store-header">
              <h2>${storeSettings?.store_name || "MOTOCARE"}</h2>
              ${storeSettings?.address ? `<p>Địa chỉ: ${storeSettings.address}</p>` : ""}
              ${storeSettings?.phone ? `<p>Hotline: ${storeSettings.phone}</p>` : ""}
           </div>
           
           <h1>PHIẾU ${isCustomerDebt ? "THU TIỀN" : "CHI TIỀN"}</h1>
           
           <div class="receipt-box">
              <div class="info-row">
                 <span class="info-label">${isCustomerDebt ? "Người nộp tiền" : "Người nhận tiền"}:</span>
                 <span class="info-value">${isCustomerDebt ? (debt as CustomerDebt).customerName : (debt as SupplierDebt).supplierName}</span>
              </div>
              <div class="info-row">
                 <span class="info-label">Ngày giao dịch:</span>
                 <span class="info-value">${formatDate(new Date())}</span>
              </div>
              <div class="info-row">
                 <span class="info-label">Nội dung:</span>
                 <span class="info-value">${debt.description}</span>
              </div>
              <div class="total-row">
                 <span class="total-label">Số tiền:</span>
                 <span class="total-value">${formatCurrency(debt.totalAmount)}</span>
              </div>
           </div>

           <div class="footer">
             <div class="signature-box">
               <p style="font-weight: bold; margin-bottom: 5px;">Người lập phiếu</p>
               <p style="font-size: 11px; font-style: italic;">(Ký, họ tên)</p>
               <div class="signature-line"></div>
             </div>
             <div class="signature-box">
               <p style="font-weight: bold; margin-bottom: 5px;">${isCustomerDebt ? "Người nộp tiền" : "Người nhận tiền"}</p>
               <p style="font-size: 11px; font-style: italic;">(Ký, họ tên)</p>
               <div class="signature-line"></div>
             </div>
           </div>

           <div class="notes">
             Cảm ơn quý khách đã sử dụng dịch vụ!
           </div>
        </body>
      </html>
    `;

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      // Focus and print after a short delay to ensure rendering
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 500);
    }
  };

  // Filter by branch
  const branchCustomerDebts = useMemo(() => {
    const dbDebts = customerDebts.filter(
      (debt) => debt.branchId === currentBranchId
    );

    // 🔹 Filter out debts linked to fully paid work orders or sales
    const activeDbDebts = dbDebts.filter((debt: any) => {
      // If debt has remainingAmount = 0, it's already marked as paid in DB
      if (debt.remainingAmount === 0) return false;

      // If debt is linked to a work order, check if work order is fully paid
      if (debt.workOrderId) {
        // If work order is not in unpaidWorkOrders list, it means it's fully paid
        const workOrderStillUnpaid = unpaidWorkOrders.some(
          (wo) => wo.id === debt.workOrderId
        );
        if (!workOrderStillUnpaid) return false;
      }

      // If debt is linked to a sale, check if sale is fully paid
      if (debt.saleId) {
        // If sale is not in unpaidSales list, it means it's fully paid
        const saleStillUnpaid = unpaidSales.some(
          (sale) => sale.id === debt.saleId
        );
        if (!saleStillUnpaid) return false;
      }

      // Keep this debt in the list
      return true;
    });

    // Combine with work order debts (auto-merged)
    return [...activeDbDebts, ...workOrderDebts] as any[];
  }, [
    customerDebts,
    currentBranchId,
    workOrderDebts,
    unpaidWorkOrders,
    unpaidSales,
  ]);

  const branchSupplierDebts = useMemo(() => {
    return supplierDebts.filter((debt) => debt.branchId === currentBranchId);
  }, [supplierDebts, currentBranchId]);

  // Filter debts based on search and sort: unpaid debts first, then by date
  const filteredCustomerDebts = useMemo(() => {
    let filtered = branchCustomerDebts;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (debt: any) =>
          debt.customerName?.toLowerCase().includes(term) ||
          debt.phone?.includes(term) ||
          debt.licensePlate?.toLowerCase().includes(term) ||
          debt.description?.toLowerCase().includes(term)
      );
    }

    // Sort: unpaid debts first (remainingAmount > 0), then by creation date (newest first)
    return filtered.sort((a: any, b: any) => {
      // First priority: unpaid debts come first
      if (a.remainingAmount > 0 && b.remainingAmount === 0) return -1;
      if (a.remainingAmount === 0 && b.remainingAmount > 0) return 1;

      // Second priority: sort by date (newest first)
      return (
        new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
      );
    });
  }, [branchCustomerDebts, searchTerm]);

  // Debug: log debts count by branch
  useEffect(() => {
    console.log(
      "[DebtManager] branchCustomerDebts count:",
      branchCustomerDebts.length,
      "(DB:",
      customerDebts.filter((d) => d.branchId === currentBranchId).length,
      "+ WorkOrders:",
      workOrderDebts.length,
      ")",
      "branchId:",
      currentBranchId
    );
  }, [branchCustomerDebts, customerDebts, workOrderDebts, currentBranchId]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".debt-menu-dropdown")) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSupplierDebts = useMemo(() => {
    if (!searchTerm) return branchSupplierDebts;
    const term = searchTerm.toLowerCase();
    return branchSupplierDebts.filter((debt) =>
      debt.supplierName.toLowerCase().includes(term)
    );
  }, [branchSupplierDebts, searchTerm]);

  // Calculate totals
  const customerTotal = useMemo(
    () =>
      branchCustomerDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [branchCustomerDebts]
  );

  const supplierTotal = useMemo(
    () =>
      branchSupplierDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [branchSupplierDebts]
  );

  // Calculate selected debt total
  const selectedCustomerTotal = useMemo(() => {
    return selectedCustomerIds.reduce((sum, id) => {
      const debt = branchCustomerDebts.find((d) => d.customerId === id);
      return sum + (debt?.remainingAmount || 0);
    }, 0);
  }, [selectedCustomerIds, branchCustomerDebts]);

  const selectedSupplierTotal = useMemo(() => {
    return selectedSupplierIds.reduce((sum, id) => {
      const debt = branchSupplierDebts.find((d) => d.id === id);
      return sum + (debt?.remainingAmount || 0);
    }, 0);
  }, [selectedSupplierIds, branchSupplierDebts]);

  // Handle checkbox change
  const handleCustomerCheckbox = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds([...selectedCustomerIds, customerId]);
    } else {
      setSelectedCustomerIds(
        selectedCustomerIds.filter((id) => id !== customerId)
      );
    }
  };

  const handleSupplierCheckbox = (debtId: string, checked: boolean) => {
    if (checked) {
      setSelectedSupplierIds([...selectedSupplierIds, debtId]);
    } else {
      setSelectedSupplierIds(
        selectedSupplierIds.filter((id) => id !== debtId)
      );
    }
  };

  // Handle pay all selected debts
  const handlePaySelectedDebts = () => {
    setShowBulkPaymentModal(true);
  };

  return (
    <div className="h-full flex flex-col bg-secondary-bg">
      {/* Page Header with Title and Stats */}
      <div className="bg-primary-bg px-4 py-4 border-b border-primary-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Title Section */}
          <div>
            <h1 className="text-xl font-bold text-primary-text">Quản lý Công Nợ</h1>
            <p className="text-sm text-secondary-text">Theo dõi công nợ khách hàng và nhà cung cấp</p>
          </div>

          {/* Stats Boxes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {/* Total Debt */}
            <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-3 text-white">
              <div className="text-xs opacity-80 font-medium">Tổng công nợ</div>
              <div className="text-lg font-bold">{formatCurrency(customerTotal + supplierTotal)}</div>
              <div className="text-[10px] opacity-70">~{branchCustomerDebts.length + branchSupplierDebts.length} khoản</div>
            </div>

            {/* Customer Debt */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-3 text-white">
              <div className="text-xs opacity-80 font-medium">Công nợ KH</div>
              <div className="text-lg font-bold">{formatCurrency(customerTotal)}</div>
              <div className="text-[10px] opacity-70">~{branchCustomerDebts.length} khoản</div>
            </div>

            {/* Supplier Debt */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 text-white">
              <div className="text-xs opacity-80 font-medium">Công nợ NCC</div>
              <div className="text-lg font-bold">{formatCurrency(supplierTotal)}</div>
              <div className="text-[10px] opacity-70">~{branchSupplierDebts.length} khoản</div>
            </div>

            {/* Installment */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 text-white">
              <div className="text-xs opacity-80 font-medium">Trả góp</div>
              <div className="text-lg font-bold">{formatCurrency(installments.filter((i: any) => i.status === 'active').reduce((sum: number, item: any) => sum + (item.remaining_amount || 0), 0))}</div>
              <div className="text-[10px] opacity-70">~{installments.filter((i: any) => i.status === 'active').length} khoản</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs with Badges */}
      <div className="bg-primary-bg border-b border-primary-border">
        <div className="flex items-center px-4 gap-1">
          <button
            onClick={() => setActiveTab("customer")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all rounded-t-lg ${activeTab === "customer"
              ? "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400"
              : "text-secondary-text hover:text-primary-text hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
          >
            <span>👤 Công nợKH</span>
            <span className="px-1.5 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
              {branchCustomerDebts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("supplier")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all rounded-t-lg ${activeTab === "supplier"
              ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400"
              : "text-secondary-text hover:text-primary-text hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
          >
            <span>🏭 Công nợNCC</span>
            <span className="px-1.5 py-0.5 text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
              {branchSupplierDebts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("installment")}
            className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all rounded-t-lg ${activeTab === "installment"
              ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400"
              : "text-secondary-text hover:text-primary-text hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Trả góp</span>
            <span className="px-1.5 py-0.5 text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
              {installments.filter((i: any) => i.status === 'active').length}
            </span>
          </button>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div className="bg-primary-bg px-4 py-3 border-b border-primary-border">
        {loadingCustomerDebts || loadingSupplierDebts ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            <span className="ml-3 text-secondary-text">
              Đang tải dữ liệu...
            </span>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-full md:flex-1 relative">
              <svg
                className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-tertiary-text"
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
                placeholder={
                  activeTab === "customer"
                    ? "Tìm SĐT / Tên KH / Tên sản phẩm / IMEI"
                    : activeTab === "supplier"
                      ? "Tìm tên / SĐT nhà cung cấp"
                      : "Tìm tên khách hàng / mã đơn"
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-primary-bg border border-secondary-border rounded-lg text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {activeTab !== "installment" && (
              <>
                <div className="text-secondary-text text-sm whitespace-nowrap">
                  Tổng công nợ:{" "}
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(
                      activeTab === "customer" ? customerTotal : supplierTotal
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                  <button
                    onClick={() => setShowAddDebtModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                  >
                    <PlusIcon className="w-5 h-5" />
                    <span>Thêm công nợ</span>
                  </button>
                  <button
                    onClick={() =>
                      activeTab === "customer"
                        ? setShowCollectModal(true)
                        : setShowPaymentModal(true)
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
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
                    <span>
                      {activeTab === "customer" ? "Thu nợ" : "Chi trả nợ"}
                    </span>
                  </button>
                </div>

                <button className="hidden md:block p-2.5 text-secondary-text hover:text-primary-text transition-colors">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === "customer" ? (
          <div className="p-2 md:p-6">
            {loadingCustomerDebts || loadingWorkOrders ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                <span className="ml-3 text-secondary-text">Đang tải...</span>
              </div>
            ) : filteredCustomerDebts.length === 0 ? (
              <div className="text-center py-12 text-tertiary-text">
                Không có công nợ.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header Row - Hidden on Mobile */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <div className="col-span-4">Khách hàng nợ</div>
                  <div className="col-span-3">Nội dung</div>
                  <div className="col-span-1 text-right">Số tiền</div>
                  <div className="col-span-1 text-right">Đã trả</div>
                  <div className="col-span-2 text-right">Còn nợ</div>
                  <div className="col-span-1"></div>
                </div>

                {filteredCustomerDebts.map((debt: any) => {
                  const isPaid = debt.remainingAmount === 0;

                  return (
                    <div
                      key={debt.id}
                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 items-start bg-primary-bg border rounded-lg p-3 md:p-4 transition-all ${isPaid
                        ? "opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-600"
                        : "hover:border-cyan-500 hover:shadow-md cursor-pointer"
                        } ${debt.isFromWorkOrder
                          ? "border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10"
                          : "border-primary-border"
                        }`}
                      onClick={() => {
                        if (!isPaid) {
                          setSelectedDebt(debt);
                          setShowDetailModal(true);
                        }
                      }}
                    >
                      {/* Badge for paid status */}
                      {isPaid && (
                        <div className="col-span-full mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full font-semibold">
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Đã thanh toán
                          </span>
                        </div>
                      )}
                      {/* Badge for work order debts */}
                      {debt.isFromWorkOrder && (
                        <div className="col-span-full md:hidden mb-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                            Từ phiếu sửa chữa
                          </span>
                        </div>
                      )}
                      {/* Cột 1: Khách hàng nợ (4 cols) */}
                      <div className="col-span-1 md:col-span-4 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(
                            debt.customerId
                          )}
                          disabled={isPaid}
                          onChange={(e) => {
                            e.stopPropagation(); // Prevent opening modal
                            handleCustomerCheckbox(
                              debt.customerId,
                              e.target.checked
                            );
                          }}
                          onClick={(e) => e.stopPropagation()} // Prevent opening modal
                          className={`hidden md:block mt-1 w-4 h-4 rounded border-secondary-border text-cyan-600 focus:ring-cyan-500 ${isPaid ? "cursor-not-allowed opacity-50" : ""
                            }`}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-primary-text font-semibold text-base mb-1 truncate">
                            {debt.customerName}
                          </h3>
                          <div className="space-y-0.5 text-xs text-secondary-text">
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              <span>{debt.phone || "--"}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10"
                                />
                                <rect
                                  x="7"
                                  y="5"
                                  width="10"
                                  height="4"
                                  rx="1"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                />
                              </svg>
                              <span className="font-mono text-xs font-semibold">
                                {debt.licensePlate || "--"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span>
                                {formatDate(new Date(debt.createdDate))}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                              <span>
                                NV:{" "}
                                {(debt as any).technicianName ||
                                  debt.description
                                    .match(/NVKỹ thuật:([^\n]+)/)?.[1]
                                    ?.trim() ||
                                  debt.description
                                    .match(/NV:([^\n]+)/)?.[1]
                                    ?.trim() ||
                                  "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cột 2: Nội dung - Chi tiết sửa chữa/mua hàng (3 cols) */}
                      <div className="col-span-1 md:col-span-3">
                        <div className="text-sm text-primary-text space-y-1">
                          {(() => {
                            const lines = debt.description.split("\n");
                            // Lấy dòng đầu tiên (xe + số phiếu)
                            const firstLine = lines[0];

                            // Lấy phụ tùng (nếu có)
                            const partsSection = lines.find((l) =>
                              l.includes("Phụ tùng đã thay:")
                            );
                            const partsLines = partsSection
                              ? lines
                                .slice(
                                  lines.indexOf(partsSection) + 1,
                                  lines.findIndex(
                                    (l, i) =>
                                      i > lines.indexOf(partsSection) &&
                                      (l.includes("Dịch vụ:") ||
                                        l.includes("Công lao động:"))
                                  ) || lines.length
                                )
                                .filter((l) => l.trim().startsWith("•"))
                              : [];

                            // Lấy dịch vụ (nếu có)
                            const serviceSection = lines.find((l) =>
                              l.includes("Dịch vụ:")
                            );
                            const serviceLines = serviceSection
                              ? lines
                                .slice(
                                  lines.indexOf(serviceSection) + 1,
                                  lines.findIndex(
                                    (l, i) =>
                                      i > lines.indexOf(serviceSection) &&
                                      l.includes("Công lao động:")
                                  ) || lines.length
                                )
                                .filter((l) => l.trim().startsWith("•"))
                              : [];

                            // Lấy công lao động
                            const laborLine = lines.find((l) =>
                              l.includes("Công lao động:")
                            );

                            return (
                              <>
                                <div className="font-medium">{firstLine}</div>
                                {partsLines.length > 0 && (
                                  <div className="text-xs text-secondary-text">
                                    <span className="font-semibold">
                                      Phụ tùng:
                                    </span>{" "}
                                    {partsLines.length} món
                                  </div>
                                )}
                                {serviceLines.length > 0 && (
                                  <div className="text-xs text-secondary-text">
                                    <span className="font-semibold">
                                      Dịch vụ:
                                    </span>{" "}
                                    {serviceLines.length} món
                                  </div>
                                )}
                                {laborLine && (
                                  <div className="text-xs text-cyan-600 dark:text-cyan-400">
                                    {laborLine}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Cột 3: Số tiền (1 col) - Desktop Only */}
                      <div className="hidden md:block col-span-1 text-right">
                        <div className="text-sm font-semibold text-primary-text">
                          {formatCurrency(debt.totalAmount)}
                        </div>
                      </div>

                      {/* Cột 4: Đã trả (1 col) - Desktop Only */}
                      <div className="hidden md:block col-span-1 text-right">
                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(debt.paidAmount)}
                        </div>
                      </div>

                      {/* Cột 5: Còn nợ (2 cols) - Desktop Only */}
                      <div className="hidden md:block col-span-1 md:col-span-2 text-right">
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(debt.remainingAmount)}
                        </div>
                      </div>

                      {/* Mobile Financial Summary Block */}
                      <div className="col-span-full md:hidden bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg mt-1 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Tổng tiền:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(debt.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Đã trả:</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(debt.paidAmount)}</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Còn nợ:</span>
                          <span className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(debt.remainingAmount)}</span>
                        </div>
                      </div>

                      {/* Mobile Action Button */}
                      {!isPaid && (
                        <div className="col-span-full md:hidden mt-2 border-t pt-2 dark:border-gray-700">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDebt(debt);
                              setShowCollectModal(true);
                            }}
                            className="w-full py-2.5 bg-cyan-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
                          >
                            <Banknote className="w-4 h-4" />
                            Thanh toán công nợ
                          </button>
                        </div>
                      )}

                      {/* Menu dropdown (1 col) */}
                      <div className="col-span-1 flex justify-end hidden md:flex">
                        <div className="relative debt-menu-dropdown">
                          <button
                            onClick={() =>
                              setOpenMenuId(
                                openMenuId === debt.id ? null : debt.id
                              )
                            }
                            className="p-2 text-secondary-text hover:text-primary-text transition-colors"
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
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </button>

                          {openMenuId === debt.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                              <button
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setShowDetailModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                Xem chi tiết
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setShowEditDebtModal(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                                Sửa
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setShowDeleteConfirm(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "supplier" ? (
          <div className="p-2 md:p-6">
            {filteredSupplierDebts.length === 0 ? (
              <div className="text-center py-12 text-tertiary-text">
                Không có công nợ.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header Row - Hidden on Mobile */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <div className="col-span-4">Nhà cung cấp</div>
                  <div className="col-span-3">Nội dung</div>
                  <div className="col-span-1 text-right">Số tiền</div>
                  <div className="col-span-1 text-right">Đã trả</div>
                  <div className="col-span-2 text-right">Còn nợ</div>
                  <div className="col-span-1"></div>
                </div>

                {filteredSupplierDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 md:gap-4 md:p-4 items-start bg-primary-bg border border-primary-border rounded-lg hover:border-cyan-500 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => {
                      setSelectedDebt(debt);
                      setShowDetailModal(true);
                    }}
                  >
                    {/* Cột 1: Nhà cung cấp (4 cols) */}
                    <div className="col-span-1 md:col-span-4 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.includes(debt.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSupplierCheckbox(
                            debt.id,
                            e.target.checked
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden md:block mt-1 w-4 h-4 rounded border-secondary-border text-cyan-600 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-primary-text font-semibold text-base mb-1 truncate">
                          {debt.supplierName}
                        </h3>
                        <div className="space-y-0.5 text-xs text-secondary-text">
                          <div className="flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span>
                              {formatDate(new Date(debt.createdDate))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cột 2: Nội dung (3 cols) */}
                    <div className="col-span-1 md:col-span-3">
                      <div className="text-sm text-primary-text">
                        {debt.description}
                      </div>

                      {/* Mobile Financial Summary */}
                      <div className="md:hidden mt-1 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-secondary-text min-w-[60px]">
                            Tổng:
                          </span>
                          <span className="font-medium text-primary-text">
                            {formatCurrency(debt.totalAmount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-secondary-text min-w-[60px]">
                            Đã trả:
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(debt.paidAmount)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-secondary-text min-w-[60px]">
                            Còn nợ:
                          </span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(debt.remainingAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Action Buttons - "Chi trả nợ" */}
                      <div className="md:hidden mt-2 pt-2 border-t border-secondary-border flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDebt(debt);
                            setShowPaymentModal(true);
                          }}
                          className="px-3 py-1.5 bg-green-600/10 text-green-600 dark:text-green-400 rounded-lg text-sm font-medium hover:bg-green-600/20 flex items-center gap-1.5"
                        >
                          <Banknote className="w-4 h-4" />
                          Chi trả nợ
                        </button>
                      </div>
                    </div>

                    {/* Cột 3: Số tiền (1 col) */}
                    <div className="col-span-1 text-right md:text-right hidden md:block">
                      <span className="md:hidden text-sm text-secondary-text">
                        Số tiền:
                      </span>
                      <div className="text-sm text-primary-text font-semibold">
                        {formatCurrency(debt.totalAmount)}
                      </div>
                    </div>

                    {/* Cột 4: Đã trả (1 col) */}
                    <div className="col-span-1 text-right md:text-right hidden md:block">
                      <span className="md:hidden text-sm text-secondary-text">
                        Đã trả:
                      </span>
                      <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                        {formatCurrency(debt.paidAmount)}
                      </div>
                    </div>

                    {/* Cột 5: Còn nợ (2 cols) */}
                    <div className="col-span-1 md:col-span-2 text-right md:text-right hidden md:block">
                      <span className="md:hidden text-sm font-bold text-secondary-text">
                        Còn nợ:
                      </span>
                      <div className="text-base text-red-600 dark:text-red-400 font-bold">
                        {formatCurrency(debt.remainingAmount)}
                      </div>
                    </div>

                    {/* Cột 6: Menu actions (1 col) */}
                    <div className="col-span-1 flex justify-end relative debt-menu-dropdown hidden md:flex">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === debt.id ? null : debt.id
                          );
                        }}
                        className="p-1 text-secondary-text hover:text-primary-text transition-colors opacity-0 group-hover:opacity-100"
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
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>

                      {openMenuId === debt.id && (
                        <div className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDebt(debt);
                              setShowDetailModal(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                            Xem chi tiết
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDebt(debt);
                              setShowEditDebtModal(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                            Sửa
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDebt(debt);
                              setShowDeleteConfirm(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "installment" ? (
          <InstallmentList />
        ) : null}
      </div>



      {/* Fixed Bottom Button - Pay All Selected */}
      {((activeTab === "customer" && selectedCustomerIds.length > 0) ||
        (activeTab === "supplier" && selectedSupplierIds.length > 0)) && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <button
              onClick={handlePaySelectedDebts}
              className="flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-2xl transition-all hover:scale-105"
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
              <span>
                Đã chọn{" "}
                {activeTab === "customer"
                  ? selectedCustomerIds.length
                  : selectedSupplierIds.length}{" "}
                đơn
              </span>
              <span className="mx-2">|</span>
              <span className="text-xl font-bold">
                Trả hết nợ (
                {formatCurrency(
                  activeTab === "customer"
                    ? selectedCustomerTotal
                    : selectedSupplierTotal
                )}
                )
              </span>
            </button>
          </div>
        )}

      {/* Modals */}
      {showCollectModal && (
        <CollectDebtModal
          customers={customers}
          customerDebts={customerDebts}
          initialDebt={selectedDebt as CustomerDebt}
          onClose={() => setShowCollectModal(false)}
          onCollect={async (data) => {
            try {
              // 🔹 Find the debt record to update
              const debtToUpdate = branchCustomerDebts.find(
                (d) => d.customerId === data.customerId
              );

              if (debtToUpdate) {
                // Calculate new amounts
                const newPaidAmount = (debtToUpdate.paidAmount || 0) + data.amount;
                const newRemainingAmount = Math.max(0, debtToUpdate.totalAmount - newPaidAmount);

                // Check if debt is from work order or regular debt table
                if ((debtToUpdate as any).isFromWorkOrder && (debtToUpdate as any).workOrderId) {
                  // 🔹 Work Order debt - update work_orders table directly
                  console.log("📦 Updating Work Order debt:", (debtToUpdate as any).workOrderId);
                  await supabase
                    .from("work_orders")
                    .update({
                      remainingamount: newRemainingAmount,
                      // Also track payment
                    })
                    .eq("id", (debtToUpdate as any).workOrderId);
                } else {
                  // 🔹 Regular debt - update customer_debts table
                  console.log("📋 Updating Customer Debt:", debtToUpdate.id);
                  await updateCustomerDebt.mutateAsync({
                    id: debtToUpdate.id,
                    updates: {
                      paidAmount: newPaidAmount,
                      remainingAmount: newRemainingAmount,
                    },
                  });

                  // Also update linked work order if exists
                  if ((debtToUpdate as any).workOrderId) {
                    await supabase
                      .from("work_orders")
                      .update({ remainingamount: newRemainingAmount })
                      .eq("id", (debtToUpdate as any).workOrderId);
                  }

                  // Also update linked sale if exists
                  if ((debtToUpdate as any).saleId) {
                    await supabase
                      .from("sales")
                      .update({ remainingamount: newRemainingAmount })
                      .eq("id", (debtToUpdate as any).saleId);
                  }
                }

                // Invalidate queries to refresh UI
                queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
                queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
                queryClient.invalidateQueries({ queryKey: ["salesRepo"] });
              }

              // 💰 Tạo giao dịch thu trong Sổ quỹ (INSERT vào database)
              const cashTxResult = await createCashTransaction({
                type: "income",
                amount: data.amount,
                branchId: currentBranchId,
                paymentSourceId: data.paymentMethod,
                date: data.timestamp,
                notes: `Thu nợ khách hàng - ${data.customerName}`,
                category: "debt_collection",
                recipient: data.customerName,
                customerId: data.customerId,
              });

              if (cashTxResult.ok) {
                console.log("✅ Đã ghi sổ quỹ thu nợ KH:", cashTxResult.data);
              } else {
                console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
              }

              // Show success modal
              setReceiptData({
                ...data,
                type: "income",
                isCustomer: true
              });
              setShowReceiptModal(true);

              // Auto print if checked
              if (data.shouldPrint) {
                const debtForPrint = {
                  customerName: data.customerName,
                  totalAmount: data.amount,
                  remainingAmount: 0,
                  paidAmount: data.amount,
                  createdDate: new Date().toISOString(),
                  description: "Thu nợ (Thanh toán ngay)",
                };
                setTimeout(() => handlePrintDebt(debtForPrint as any), 500);
              }

              showToast.success(`Đã thu thành công ${formatCurrency(data.amount)} từ ${data.customerName}`);
            } catch (error: any) {
              console.error("❌ Lỗi thanh toán:", error);
              showToast.error(error.message || "Không thể thanh toán. Vui lòng thử lại.");
            }

            setShowCollectModal(false);
          }}
        />
      )}

      {/* Bulk Payment Modal */}
      {showBulkPaymentModal && (
        <BulkPaymentModal
          isOpen={showBulkPaymentModal}
          onClose={() => {
            setShowBulkPaymentModal(false);
          }}
          selectedDebts={
            activeTab === "customer"
              ? branchCustomerDebts.filter((d) =>
                selectedCustomerIds.includes(d.customerId)
              )
              : branchSupplierDebts.filter((d) =>
                selectedSupplierIds.includes(d.id)
              )
          }
          totalAmount={
            activeTab === "customer"
              ? selectedCustomerTotal
              : selectedSupplierTotal
          }
          debtType={activeTab}
          onConfirm={async (paymentMethod, paymentTime, shouldPrint) => {
            try {
              const totalAmount =
                activeTab === "customer"
                  ? selectedCustomerTotal
                  : selectedSupplierTotal;

              if (activeTab === "customer") {
                // Thu nợ hàng loạt từ khách hàng
                for (const customerId of selectedCustomerIds) {
                  const debt = branchCustomerDebts.find(
                    (d) => d.customerId === customerId
                  );
                  if (debt) {
                    // Check if debt is from work order
                    if ((debt as any).isFromWorkOrder && (debt as any).workOrderId) {
                      await supabase
                        .from("work_orders")
                        .update({ remainingamount: 0 })
                        .eq("id", (debt as any).workOrderId);
                    } else {
                      // Update debt record
                      await updateCustomerDebt.mutateAsync({
                        id: debt.id,
                        updates: {
                          paidAmount: debt.totalAmount,
                          remainingAmount: 0,
                        },
                      });

                      // If debt is linked to work order, update work order too
                      if ((debt as any).workOrderId) {
                        await supabase
                          .from("work_orders")
                          .update({ remainingamount: 0 })
                          .eq("id", (debt as any).workOrderId);
                      }

                      // If debt is linked to sale, update sale too
                      if ((debt as any).saleId) {
                        await supabase
                          .from("sales")
                          .update({ remainingamount: 0 })
                          .eq("id", (debt as any).saleId);
                      }
                    }
                  }
                }
                setSelectedCustomerIds([]);

                // 💰 Ghi sổ quỹ THU nợ khách hàng
                const cashTxResult = await createCashTransaction({
                  type: "income",
                  amount: totalAmount,
                  branchId: currentBranchId,
                  paymentSourceId: paymentMethod,
                  date: paymentTime,
                  notes: `Thu nợ hàng loạt - ${selectedCustomerIds.length} khách hàng`,
                  category: "debt_collection",
                  recipient: `${selectedCustomerIds.length} khách hàng`,
                });

                if (!cashTxResult.ok) {
                  console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
                }

                // Invalidate queries to refresh UI
                queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
                queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
                queryClient.invalidateQueries({ queryKey: ["salesRepo"] });
                queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
                queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
              } else {
                // Trả nợ hàng loạt cho nhà cung cấp
                for (const debtId of selectedSupplierIds) {
                  const debt = branchSupplierDebts.find(
                    (d) => d.id === debtId
                  );
                  if (debt) {
                    await updateSupplierDebt.mutateAsync({
                      id: debt.id,
                      updates: {
                        paidAmount: debt.totalAmount,
                        remainingAmount: 0,
                      },
                    });
                  }
                }
                setSelectedSupplierIds([]);

                // 💰 Ghi sổ quỹ CHI trả nợ nhà cung cấp
                const cashTxResult = await createCashTransaction({
                  type: "expense",
                  amount: totalAmount,
                  branchId: currentBranchId,
                  paymentSourceId: paymentMethod,
                  date: paymentTime,
                  notes: `Trả nợ hàng loạt - ${selectedSupplierIds.length} công nợ`,
                  category: "debt_payment",
                  recipient: `${selectedSupplierIds.length} công nợ`,
                });

                if (!cashTxResult.ok) {
                  console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
                }
              }

              setShowBulkPaymentModal(false);

              // Show success message
              showToast.success(
                `Đã thanh toán thành công ${formatCurrency(totalAmount)} qua ${paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"
                }`
              );

              // Trigger print if enabled
              if (shouldPrint) {
                const bulkDebtForPrint = {
                  customerName: activeTab === "customer"
                    ? `${selectedCustomerIds.length} khách hàng`
                    : undefined,
                  supplierName: activeTab === "supplier"
                    ? `${selectedSupplierIds.length} nhà cung cấp`
                    : undefined,
                  totalAmount: totalAmount,
                  remainingAmount: 0,
                  paidAmount: totalAmount,
                  createdDate: new Date().toISOString(),
                  description: activeTab === "customer"
                    ? "Thu nợ hàng loạt"
                    : "Trả nợ hàng loạt",
                };
                setTimeout(() => handlePrintDebt(bulkDebtForPrint as any), 500);
              }
            } catch (error: any) {
              showToast.error(error.message || "Không thể thanh toán");
            }
          }}
        />
      )}

      {showPaymentModal && (
        <PaySupplierModal
          suppliers={suppliers}
          supplierDebts={supplierDebts}
          initialDebt={selectedDebt as SupplierDebt}
          onClose={() => setShowPaymentModal(false)}
          onPay={async (data) => {
            try {
              // 🔹 Find the debt record to update
              const debtToUpdate = branchSupplierDebts.find(
                (d) => d.supplierId === data.supplierId
              );

              if (debtToUpdate) {
                // Calculate new amounts
                const newPaidAmount = (debtToUpdate.paidAmount || 0) + data.amount;
                const newRemainingAmount = Math.max(0, debtToUpdate.totalAmount - newPaidAmount);

                // 🔹 Update the supplier debt record in database
                await updateSupplierDebt.mutateAsync({
                  id: debtToUpdate.id,
                  updates: {
                    paidAmount: newPaidAmount,
                    remainingAmount: newRemainingAmount,
                  },
                });
              }

              // 💰 Tạo giao dịch chi trong Sổ quỹ (INSERT vào database)
              const cashTxResult = await createCashTransaction({
                type: "expense",
                amount: data.amount,
                branchId: currentBranchId,
                paymentSourceId: data.paymentMethod,
                date: data.timestamp,
                notes: `Trả nợ nhà cung cấp - ${data.supplierName}`,
                category: "debt_payment",
                recipient: data.supplierName,
                supplierId: data.supplierId,
              });

              if (cashTxResult.ok) {
                console.log("✅ Đã ghi sổ quỹ trả nợ NCC:", cashTxResult.data);
                queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
                queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
              } else {
                console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
              }

              // Show success modal
              setReceiptData({
                ...data,
                type: "expense",
                isCustomer: false
              });
              setShowReceiptModal(true);

              // Auto print if checked
              if (data.shouldPrint) {
                const debtForPrint = {
                  supplierName: data.supplierName,
                  totalAmount: data.amount,
                  remainingAmount: 0,
                  paidAmount: data.amount,
                  createdDate: new Date().toISOString(),
                  description: "Chi trả nợ (Thanh toán ngay)",
                };
                setTimeout(() => handlePrintDebt(debtForPrint as any), 500);
              }

              showToast.success(`Đã trả thành công ${formatCurrency(data.amount)} cho ${data.supplierName}`);
            } catch (error: any) {
              console.error("❌ Lỗi thanh toán:", error);
              showToast.error(error.message || "Không thể thanh toán. Vui lòng thử lại.");
            }

            setShowPaymentModal(false);
          }}
        />
      )}

      {/* Success Receipt Modal */}
      {showReceiptModal && receiptData && (
        <DebtReceiptModal
          isOpen={showReceiptModal}
          data={receiptData}
          onClose={() => setShowReceiptModal(false)}
          onPrint={() => {
            const debtForPrint = {
              customerName: receiptData.customerName,
              supplierName: receiptData.supplierName,
              totalAmount: receiptData.amount,
              remainingAmount: 0,
              paidAmount: receiptData.amount,
              createdDate: new Date().toISOString(),
              description: receiptData.isCustomer ? "Thu nợ (Thanh toán)" : "Chi trả nợ (Thanh toán)",
            };
            handlePrintDebt(debtForPrint as any);
          }}
        />
      )}

      {/* Add Debt Modal */}
      {showAddDebtModal && (
        <AddDebtModal
          activeTab={activeTab}
          customers={customers}
          suppliers={suppliers}
          currentBranchId={currentBranchId}
          onClose={() => setShowAddDebtModal(false)}
          onSave={async (debt) => {
            if (activeTab === "customer") {
              await createCustomerDebt.mutateAsync(debt as any);
            } else {
              await createSupplierDebt.mutateAsync(debt as any);
            }
            setShowAddDebtModal(false);
          }}
        />
      )}

      {/* Edit Debt Modal */}
      {showEditDebtModal && selectedDebt && (
        <EditDebtModal
          debt={selectedDebt}
          activeTab={activeTab}
          customers={customers}
          suppliers={suppliers}
          onClose={() => {
            setShowEditDebtModal(false);
            setSelectedDebt(null);
          }}
          onSave={async (updates) => {
            if (activeTab === "customer") {
              await updateCustomerDebt.mutateAsync({
                id: selectedDebt.id,
                updates: updates as any,
              });
            } else {
              await updateSupplierDebt.mutateAsync({
                id: selectedDebt.id,
                updates: updates as any,
              });
            }
            setShowEditDebtModal(false);
            setSelectedDebt(null);
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedDebt && (
        <DetailDebtModal
          debt={selectedDebt}
          activeTab={activeTab}
          storeSettings={storeSettings}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDebt(null);
          }}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && selectedDebt && (
        <DeleteConfirmDialog
          debt={selectedDebt}
          activeTab={activeTab}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedDebt(null);
          }}
          onConfirm={async () => {
            if (activeTab === "customer") {
              await deleteCustomerDebt.mutateAsync(selectedDebt.id);
            } else {
              await deleteSupplierDebt.mutateAsync(selectedDebt.id);
            }
            setShowDeleteConfirm(false);
            setSelectedDebt(null);
            // Invalidate to ensure other components (like dashboard) stay in sync
            queryClient.invalidateQueries({ queryKey: ["customer_debts"] });
            queryClient.invalidateQueries({ queryKey: ["supplier_debts"] });
          }}
        />
      )}
    </div>
  );
};

// Modal Thu nợ khách hàng
const CollectDebtModal: React.FC<{
  customers: any[];
  customerDebts: CustomerDebt[];
  initialDebt?: CustomerDebt | null;
  onClose: () => void;
  onCollect?: (data: {
    customerName: string;
    customerId: string;
    amount: number;
    paymentMethod: "cash" | "bank";
    timestamp: string;
    shouldPrint?: boolean;
  }) => void;
}> = ({ customers, customerDebts, initialDebt, onClose, onCollect }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialDebt?.customerId || "");
  const [paymentAmount, setPaymentAmount] = useState(initialDebt ? initialDebt.remainingAmount.toString() : "0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [createTime, setCreateTime] = useState(
    new Date()
      .toLocaleString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(" ", " ")
  );

  const selectedDebt = useMemo(() => {
    return customerDebts.find((d) => d.customerId === selectedCustomerId);
  }, [selectedCustomerId, customerDebts]);

  const remainingAmount = selectedDebt?.remainingAmount ?? initialDebt?.remainingAmount ?? 0;
  const [isPrintChecked, setIsPrintChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const paymentAmountNum = parseFloat(paymentAmount);

    // Validation: số tiền thanh toán không được vượt quá số nợ còn lại
    if (paymentAmountNum <= 0) {
      showToast.error("Số tiền thanh toán phải lớn hơn 0");
      return;
    }

    if (paymentAmountNum > remainingAmount) {
      showToast.error(
        `Số tiền thanh toán không được vượt quá số nợ còn lại (${formatCurrency(
          remainingAmount
        )})`
      );
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (customer && onCollect) {
      setIsSubmitting(true);
      try {
        await onCollect({
          customerName: customer.name,
          customerId: customer.id,
          amount: paymentAmountNum,
          paymentMethod,
          timestamp: createTime,
          shouldPrint: isPrintChecked,
        });
      } catch (error) {
        console.error(error);
        setIsSubmitting(false); // Only re-enable if error/not closed
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[100]">
      <div className="bg-secondary-bg rounded-t-xl md:rounded-xl shadow-2xl max-w-lg w-full border-x border-t border-primary-border max-h-[85vh] mb-20 md:mb-0 flex flex-col">
        <div className="px-4 py-3 border-b border-primary-border flex items-center justify-between flex-none">
          <h2 className="text-lg font-semibold text-primary-text">
            Thu nợ khách hàng
          </h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form id="collect-debt-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                Tìm kiếm và chọn một khách hàng đang nợ
              </label>
              {initialDebt ? (
                <div className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border border-secondary-border rounded-lg text-primary-text font-medium flex items-center justify-between">
                  <span>{initialDebt.customerName}</span>
                  <span className="text-sm text-secondary-text font-normal">
                    (Nợ: {formatCurrency(initialDebt.remainingAmount)})
                  </span>
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Chọn khách hàng...</option>
                  {customerDebts.map((debt) => (
                    <option key={debt.customerId} value={debt.customerId}>
                      {debt.customerName} - {formatCurrency(debt.remainingAmount)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-text">
                  Nhập số tiền thanh toán
                </label>
                <span className="text-cyan-600 dark:text-cyan-400 text-sm">
                  {formatCurrency(parseFloat(paymentAmount) || 0)}
                </span>
              </div>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Remaining Amount */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-tertiary-text">Còn nợ:</span>
                <span className="text-red-600 dark:text-red-400 font-bold text-base">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(remainingAmount.toString())}
                className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm mt-1"
              >
                Điền số còn nợ
              </button>
            </div>

            {/* Payment Method */}
            {/* Payment Method - Card Style */}
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-3">
                Hình thức thanh toán:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 text-cyan-700 dark:text-cyan-400' : 'border-secondary-border hover:bg-primary-bg'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === "cash"}
                    onChange={(e) => setPaymentMethod(e.target.value as "cash")}
                    className="hidden"
                  />
                  <span className="font-medium">Tiền mặt</span>
                </label>
                <label className={`cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'bank' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 text-cyan-700 dark:text-cyan-400' : 'border-secondary-border hover:bg-primary-bg'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank"
                    checked={paymentMethod === "bank"}
                    onChange={(e) => setPaymentMethod(e.target.value as "bank")}
                    className="hidden"
                  />
                  <span className="font-medium">Chuyển khoản</span>
                </label>
              </div>
            </div>

            {/* Create Time */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="print-receipt-customer"
                  checked={isPrintChecked}
                  onChange={(e) => setIsPrintChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-secondary-border text-cyan-600 focus:ring-cyan-500"
                />
                <label htmlFor="print-receipt-customer" className="text-sm font-medium text-primary-text select-none cursor-pointer">
                  In phiếu thu ngay sau khi tạo
                </label>
              </div>

              <label className="block text-sm font-medium text-secondary-text mb-2">
                Thời gian tạo phiếu thu
              </label>
              <input
                type="text"
                value={createTime}
                onChange={(e) => setCreateTime(e.target.value)}
                className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="px-4 py-3 border-t border-primary-border bg-secondary-bg flex items-center gap-3 justify-end flex-none rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary-text hover:text-primary-text transition-colors font-medium"
          >
            Đóng
          </button>
          <button
            type="submit"
            form="collect-debt-form"
            disabled={!selectedCustomerId || parseFloat(paymentAmount) <= 0 || isSubmitting}
            className="flex-1 md:flex-none px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/30 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? "Đang xử lý..." : "Tạo phiếu thu"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal Chi trả nợ nhà cung cấp
const PaySupplierModal: React.FC<{
  suppliers: any[];
  supplierDebts: SupplierDebt[];
  initialDebt?: SupplierDebt | null;
  onClose: () => void;
  onPay?: (data: {
    supplierName: string;
    supplierId: string;
    amount: number;
    paymentMethod: "cash" | "bank";
    timestamp: string;
    shouldPrint?: boolean;
  }) => void;
}> = ({ suppliers, supplierDebts, initialDebt, onClose, onPay }) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialDebt?.supplierId || "");
  const [paymentAmount, setPaymentAmount] = useState(initialDebt ? initialDebt.remainingAmount.toString() : "0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [createTime, setCreateTime] = useState(
    new Date()
      .toLocaleString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(" ", " ")
  );

  const selectedDebt = useMemo(() => {
    return supplierDebts.find((d) => d.supplierId === selectedSupplierId);
  }, [selectedSupplierId, supplierDebts]);

  const remainingAmount = selectedDebt?.remainingAmount ?? initialDebt?.remainingAmount ?? 0;
  const [isPrintChecked, setIsPrintChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const paymentAmountNum = parseFloat(paymentAmount);

    // Validation: số tiền thanh toán không được vượt quá số nợ còn lại
    if (paymentAmountNum <= 0) {
      showToast.error("Số tiền thanh toán phải lớn hơn 0");
      return;
    }

    if (paymentAmountNum > remainingAmount) {
      showToast.error(
        `Số tiền thanh toán không được vượt quá số nợ còn lại (${formatCurrency(
          remainingAmount
        )})`
      );
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (supplier && onPay) {
      setIsSubmitting(true);
      try {
        await onPay({
          supplierName: supplier.name,
          supplierId: supplier.id,
          amount: paymentAmountNum,
          paymentMethod,
          timestamp: createTime,
          shouldPrint: isPrintChecked,
        });
      } catch (error) {
        console.error(error);
        setIsSubmitting(false);
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[100]">
      <div className="bg-secondary-bg rounded-t-xl md:rounded-xl shadow-2xl max-w-lg w-full border-x border-t border-primary-border max-h-[85vh] mb-20 md:mb-0 flex flex-col">
        <div className="px-4 py-3 border-b border-primary-border flex items-center justify-between flex-none">
          <h2 className="text-lg font-semibold text-primary-text">
            Chi trả nợ nhà cung cấp
          </h2>
          <button onClick={onClose} className="text-secondary-text hover:text-primary-text">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form id="pay-supplier-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Supplier Selection */}
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-2">
                Tìm kiếm và chọn một nhà cung cấp đang nợ
              </label>
              {initialDebt ? (
                <div className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700/50 border border-secondary-border rounded-lg text-primary-text font-medium flex items-center justify-between">
                  <span>{initialDebt.supplierName}</span>
                  <span className="text-sm text-secondary-text font-normal">
                    (Nợ: {formatCurrency(initialDebt.remainingAmount)})
                  </span>
                </div>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Chọn nhà cung cấp...</option>
                  {supplierDebts.map((debt) => (
                    <option key={debt.supplierId} value={debt.supplierId}>
                      {debt.supplierName} - {formatCurrency(debt.remainingAmount)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-secondary-text">
                  Nhập số tiền thanh toán
                </label>
                <span className="text-cyan-600 dark:text-cyan-400 text-sm">
                  {formatCurrency(parseFloat(paymentAmount) || 0)}
                </span>
              </div>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Remaining Amount */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-tertiary-text">Còn nợ:</span>
                <span className="text-red-600 dark:text-red-400 font-bold text-base">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(remainingAmount.toString())}
                className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm mt-1"
              >
                Điền số còn nợ
              </button>
            </div>

            {/* Payment Method */}
            {/* Payment Method - Card Style */}
            <div>
              <label className="block text-sm font-medium text-secondary-text mb-3">
                Hình thức thanh toán:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'cash' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 text-cyan-700 dark:text-cyan-400' : 'border-secondary-border hover:bg-primary-bg'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === "cash"}
                    onChange={(e) => setPaymentMethod(e.target.value as "cash")}
                    className="hidden"
                  />
                  <span className="font-medium">Tiền mặt</span>
                </label>
                <label className={`cursor-pointer border rounded-lg p-3 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'bank' ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-500 text-cyan-700 dark:text-cyan-400' : 'border-secondary-border hover:bg-primary-bg'}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank"
                    checked={paymentMethod === "bank"}
                    onChange={(e) => setPaymentMethod(e.target.value as "bank")}
                    className="hidden"
                  />
                  <span className="font-medium">Chuyển khoản</span>
                </label>
              </div>
            </div>

            {/* Create Time */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="print-receipt-supplier"
                  checked={isPrintChecked}
                  onChange={(e) => setIsPrintChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-secondary-border text-red-600 focus:ring-red-500"
                />
                <label htmlFor="print-receipt-supplier" className="text-sm font-medium text-primary-text select-none cursor-pointer">
                  In phiếu chi ngay sau khi tạo
                </label>
              </div>

              <label className="block text-sm font-medium text-secondary-text mb-2">
                Thời gian tạo phiếu chi
              </label>
              <input
                type="text"
                value={createTime}
                onChange={(e) => setCreateTime(e.target.value)}
                className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Submit Button */}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="px-4 py-3 border-t border-primary-border bg-secondary-bg flex items-center gap-3 justify-end flex-none rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary-text hover:text-primary-text transition-colors font-medium"
          >
            Đóng
          </button>
          <button
            type="submit"
            form="pay-supplier-form"
            disabled={!selectedSupplierId || parseFloat(paymentAmount) <= 0}
            className="flex-1 md:flex-none px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg shadow-red-500/30 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Tạo phiếu chi
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Payment Modal Component
interface BulkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDebts: (CustomerDebt | SupplierDebt)[];
  totalAmount: number;
  debtType: "customer" | "supplier";
  onConfirm: (paymentMethod: "cash" | "bank", paymentTime: string, shouldPrint: boolean) => void;
}

const BulkPaymentModal: React.FC<BulkPaymentModalProps> = ({
  isOpen,
  onClose,
  selectedDebts,
  totalAmount,
  debtType,
  onConfirm,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentTime, setPaymentTime] = useState(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  });
  const [isPrintChecked, setIsPrintChecked] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) {
      showToast.warning("Vui lòng chọn hình thức thanh toán");
      return;
    }

    // Convert paymentTime to ISO string for storage
    const [datePart, timePart] = paymentTime.split(" ");
    const [day, month, year] = datePart.split("-");
    const [hours, minutes] = timePart.split(":");
    const isoTimestamp = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    ).toISOString();

    onConfirm(paymentMethod, isoTimestamp, isPrintChecked);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary-bg rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-border">
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-red-500"
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
            <h2 className="text-xl font-semibold text-primary-text">
              Trả hết nợ (
              {debtType === "customer"
                ? "nhiều đơn hàng"
                : "nhiều nhà cung cấp"}
              )
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary-text hover:text-primary-text transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Selected Debts List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-secondary-text">-</span>
              <span className="text-sm font-medium text-secondary-text">
                Chi tiết
              </span>
              <span className="text-sm font-medium text-secondary-text">
                Số tiền
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDebts.map((debt, index) => {
                const isCustomerDebt = "customerName" in debt;
                const name = isCustomerDebt
                  ? (debt as CustomerDebt).customerName
                  : (debt as SupplierDebt).supplierName;
                const detail = isCustomerDebt
                  ? (debt as CustomerDebt).description
                  : (debt as SupplierDebt).description;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-tertiary-bg rounded"
                  >
                    <span className="text-sm text-tertiary-text">
                      {index + 1}
                    </span>
                    <div className="flex-1 mx-3">
                      <div className="text-sm font-medium text-primary-text">
                        {detail}
                      </div>
                      <div className="text-xs text-tertiary-text">{name}</div>
                    </div>
                    <span className="text-sm font-semibold text-primary-text">
                      {formatCurrency(debt.remainingAmount)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-border">
              <span className="font-semibold text-primary-text">TỔNG</span>
              <span className="text-lg font-bold text-red-500">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-text mb-3">
              Hình thức thanh toán:
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-primary-text">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-primary-text">Chuyển khoản</span>
              </label>
            </div>
          </div>

          {/* Payment Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Thời gian tạo phiếu thu
            </label>
            <div className="flex items-center gap-2 px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg">
              <input
                type="text"
                value={paymentTime}
                onChange={(e) => setPaymentTime(e.target.value)}
                className="flex-1 bg-transparent text-primary-text outline-none"
              />
              <svg
                className="w-5 h-5 text-tertiary-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <svg
                className="w-5 h-5 text-tertiary-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Print Checkbox */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="print-receipt-bulk"
                checked={isPrintChecked}
                onChange={(e) => setIsPrintChecked(e.target.checked)}
                className="w-5 h-5 rounded border-secondary-border text-cyan-600 focus:ring-cyan-500"
              />
              <label htmlFor="print-receipt-bulk" className="text-sm font-medium text-primary-text select-none cursor-pointer flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                In phiếu thu ngay sau khi tạo
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-secondary-border text-secondary-text rounded-lg hover:bg-primary-bg transition-colors font-medium"
            >
              ĐÓNG
            </button>
            <button
              type="submit"
              disabled={!paymentMethod}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              TẠO PHIẾU THU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Debt Modal
const AddDebtModal: React.FC<{
  activeTab: "customer" | "supplier";
  customers: any[];
  suppliers: any[];
  currentBranchId: string;
  onClose: () => void;
  onSave: (debt: any) => void;
}> = ({
  activeTab,
  customers,
  suppliers,
  currentBranchId,
  onClose,
  onSave,
}) => {
    const [formData, setFormData] = useState({
      customerId: "",
      supplierId: "",
      description: "",
      totalAmount: 0,
      phone: "",
      licensePlate: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      if (activeTab === "customer") {
        const customer = customers.find((c) => c.id === formData.customerId);
        if (!customer) {
          showToast.error("Vui lòng chọn khách hàng");
          return;
        }

        onSave({
          customerId: formData.customerId,
          customerName: customer.name,
          phone: formData.phone || customer.phone,
          licensePlate: formData.licensePlate || customer.licensePlate,
          description: formData.description,
          totalAmount: formData.totalAmount,
          paidAmount: 0,
          remainingAmount: formData.totalAmount,
          createdDate: new Date().toISOString(),
          branchId: currentBranchId,
        });
      } else {
        const supplier = suppliers.find((s) => s.id === formData.supplierId);
        if (!supplier) {
          showToast.error("Vui lòng chọn nhà cung cấp");
          return;
        }

        onSave({
          supplierId: formData.supplierId,
          supplierName: supplier.name,
          description: formData.description,
          totalAmount: formData.totalAmount,
          paidAmount: 0,
          remainingAmount: formData.totalAmount,
          createdDate: new Date().toISOString(),
          branchId: currentBranchId,
        });
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Thêm công nợ{" "}
              {activeTab === "customer" ? "khách hàng" : "nhà cung cấp"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {activeTab === "customer" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Khách hàng <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.customerId}
                  onChange={(e) =>
                    setFormData({ ...formData, customerId: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Chọn khách hàng...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Nhà cung cấp <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) =>
                    setFormData({ ...formData, supplierId: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Chọn nhà cung cấp...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === "customer" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Biển số xe
                  </label>
                  <input
                    type="text"
                    value={formData.licensePlate}
                    onChange={(e) =>
                      setFormData({ ...formData, licensePlate: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Nội dung công nợ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder="Mô tả chi tiết công nợ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Số tiền <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.totalAmount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    totalAmount: Number(e.target.value),
                  })
                }
                required
                min="0"
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                placeholder="0"
              />
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {formatCurrency(formData.totalAmount || 0)}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                Thêm công nợ
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

// Edit Debt Modal
const EditDebtModal: React.FC<{
  debt: CustomerDebt | SupplierDebt;
  activeTab: "customer" | "supplier";
  customers: any[];
  suppliers: any[];
  onClose: () => void;
  onSave: (updates: any) => void;
}> = ({ debt, activeTab, customers, suppliers, onClose, onSave }) => {
  const isCustomerDebt = "customerName" in debt;
  const [formData, setFormData] = useState({
    description: debt.description,
    totalAmount: debt.totalAmount,
    paidAmount: debt.paidAmount,
    phone: isCustomerDebt ? (debt as CustomerDebt).phone : "",
    licensePlate: isCustomerDebt ? (debt as CustomerDebt).licensePlate : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const remainingAmount = formData.totalAmount - formData.paidAmount;

    if (formData.paidAmount > formData.totalAmount) {
      showToast.error("Số tiền đã trả không được lớn hơn tổng tiền!");
      return;
    }

    onSave({
      description: formData.description,
      totalAmount: formData.totalAmount,
      paidAmount: formData.paidAmount,
      remainingAmount,
      ...(isCustomerDebt && {
        phone: formData.phone,
        licensePlate: formData.licensePlate,
      }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Sửa công nợ
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {isCustomerDebt
                ? (debt as CustomerDebt).customerName
                : (debt as SupplierDebt).supplierName}
            </p>
          </div>

          {isCustomerDebt && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={formData.licensePlate}
                  onChange={(e) =>
                    setFormData({ ...formData, licensePlate: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nội dung công nợ
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tổng tiền
            </label>
            <input
              type="number"
              value={formData.totalAmount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  totalAmount: Number(e.target.value),
                })
              }
              min="0"
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Đã trả
            </label>
            <input
              type="number"
              value={formData.paidAmount}
              onChange={(e) =>
                setFormData({ ...formData, paidAmount: Number(e.target.value) })
              }
              min="0"
              max={formData.totalAmount}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Còn nợ:{" "}
              <span className="font-bold">
                {formatCurrency(formData.totalAmount - formData.paidAmount)}
              </span>
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Detail Debt Modal
const DetailDebtModal: React.FC<{
  debt: CustomerDebt | SupplierDebt;
  activeTab: "customer" | "supplier";
  storeSettings: any;
  onClose: () => void;
}> = ({ debt, activeTab, storeSettings, onClose }) => {
  const isCustomerDebt = "customerName" in debt;

  // State for fetched receipt items
  const [receiptItems, setReceiptItems] = React.useState<any[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);

  // Parse receipt code from description (e.g., "Phiếu NH-20251223-135")
  React.useEffect(() => {
    const fetchReceiptItems = async () => {
      // Extract receipt code pattern from description
      const receiptCodeMatch = debt.description?.match(/NH-\d{8}-\d+/);
      if (!receiptCodeMatch) return;

      const receiptCode = receiptCodeMatch[0];
      setLoadingItems(true);

      try {
        // Fetch items from inventory_transactions where notes contains the receipt code
        const { data, error } = await supabase
          .from("inventory_transactions")
          .select("*")
          .ilike("notes", `%${receiptCode}%`)
          .eq("type", "Nhập kho")
          .order("created_at", { ascending: true });

        if (error) throw error;
        setReceiptItems(data || []);
      } catch (err) {
        console.error("Error fetching receipt items:", err);
      } finally {
        setLoadingItems(false);
      }
    };

    if (!isCustomerDebt) {
      fetchReceiptItems();
    }
  }, [debt.description, isCustomerDebt]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 z-[100]">
      <div className="bg-white dark:bg-slate-800 rounded-t-xl md:rounded-xl shadow-2xl max-w-2xl w-full border-x border-t border-slate-200 dark:border-slate-700 max-h-[80vh] mb-20 md:mb-0 flex flex-col">
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-none">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Chi tiết công nợ
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isCustomerDebt ? "Khách hàng" : "Nhà cung cấp"}
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {isCustomerDebt
                  ? (debt as CustomerDebt).customerName
                  : (debt as SupplierDebt).supplierName}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ngày tạo
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">
                {formatDate(new Date(debt.createdDate))}
              </p>
            </div>
          </div>

          {isCustomerDebt && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Số điện thoại
                </p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {(debt as CustomerDebt).phone || "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Biển số xe
                </p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">
                  {(debt as CustomerDebt).licensePlate || "--"}
                </p>
              </div>
            </div>
          )}


          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Nội dung
            </p>
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-4">
              <p className="text-slate-900 dark:text-white whitespace-pre-line leading-relaxed">
                {debt.description}
              </p>
            </div>
          </div>

          {/* Receipt Items List (for supplier debts) */}
          {!isCustomerDebt && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                <span>📦 Danh sách hàng nhập</span>
                {receiptItems.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold">
                    {receiptItems.length} sản phẩm
                  </span>
                )}
              </p>
              {loadingItems ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
                </div>
              ) : receiptItems.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Sản phẩm</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">SL</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Giá nhập</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {receiptItems.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-slate-100 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900 dark:text-white">{item.partName}</div>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900 dark:text-white">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 dark:bg-slate-900/30 rounded-lg">
                  Không tìm thấy chi tiết hàng nhập
                </div>
              )}
            </div>
          )}

          {/* Financial Summary */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="grid grid-cols-3 gap-2 md:gap-4 divide-x divide-slate-100 dark:divide-slate-700">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Tổng tiền
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(debt.totalAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Đã trả
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(debt.paidAmount)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  Còn nợ
                </p>
                <p className="text-lg md:text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(debt.remainingAmount)}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-2">
              <span>Tiến độ thanh toán</span>
              <span>
                {Math.round((debt.paidAmount / debt.totalAmount) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
              <div
                className="bg-green-600 h-3 rounded-full transition-all"
                style={{
                  width: `${(debt.paidAmount / debt.totalAmount) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 flex justify-between flex-none bg-white dark:bg-slate-800 rounded-b-xl">
          <button
            onClick={() => {
              const printContent = document.getElementById("debt-print-area");
              if (printContent) {
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Phiếu Công Nợ - ${isCustomerDebt
                      ? (debt as CustomerDebt).customerName
                      : (debt as SupplierDebt).supplierName
                    }</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                          .store-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }
                          .store-header h2 { margin: 0 0 10px 0; font-size: 24px; color: #0ea5e9; }
                          .store-header p { margin: 5px 0; color: #666; }
                          h1 { text-align: center; margin-bottom: 20px; }
                          .info { margin-bottom: 15px; }
                          .info label { font-weight: bold; }
                          .description { white-space: pre-line; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
                          .amounts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
                          .amount-box { padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
                          .amount-box label { display: block; font-size: 12px; color: #666; margin-bottom: 5px; }
                          .amount-box .value { font-size: 20px; font-weight: bold; }
                          .total { color: #1e40af; }
                          .paid { color: #16a34a; }
                          .remaining { color: #dc2626; }
                          .bank-info { margin-top: 30px; padding: 20px; background: #f0f9ff; border: 2px solid #0ea5e9; border-radius: 8px; }
                          .bank-info h3 { margin: 0 0 15px 0; color: #0369a1; text-align: center; }
                          .bank-info p { margin: 8px 0; }
                          .bank-info strong { display: inline-block; min-width: 150px; }
                          .bank-qr { text-align: center; margin-top: 15px; }
                          .bank-qr img { max-width: 200px; border: 1px solid #ddd; padding: 10px; background: white; }
                          @media print { button { display: none; } }
                        </style>
                      </head>
                      <body>
                        ${storeSettings
                      ? `
                        <div class="store-header">
                          <h2>${storeSettings.store_name || "MOTOCARE"}</h2>
                          ${storeSettings.address
                        ? `<p><svg style="width:12px;height:12px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="#ef4444"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${storeSettings.address}</p>`
                        : ""
                      }
                          ${storeSettings.phone
                        ? `<p><svg style="width:12px;height:12px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="#16a34a"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>${storeSettings.phone}</p>`
                        : ""
                      }
                        </div>
                        `
                      : ""
                    }
                        ${printContent.innerHTML}
                        ${storeSettings &&
                      (storeSettings.bank_name ||
                        storeSettings.bank_account_number)
                      ? `
                        <div class="bank-info">
                          <h3><svg style="width:14px;height:14px;vertical-align:middle;margin-right:4px" viewBox="0 0 24 24" fill="#0891b2"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM4 0h16v2H4zm0 22h16v2H4zm8-10c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-4 4h8v-1c0-1.33-2.67-2-4-2s-4 .67-4 2v1z"/></svg>THÔNG TIN CHUYỂN KHOẢN</h3>
                          ${storeSettings.bank_name
                        ? `<p><strong>Ngân hàng:</strong> ${storeSettings.bank_name}</p>`
                        : ""
                      }
                          ${storeSettings.bank_account_number
                        ? `<p><strong>Số tài khoản:</strong> ${storeSettings.bank_account_number}</p>`
                        : ""
                      }
                          ${storeSettings.bank_account_holder
                        ? `<p><strong>Chủ tài khoản:</strong> ${storeSettings.bank_account_holder}</p>`
                        : ""
                      }
                          ${storeSettings.bank_branch
                        ? `<p><strong>Chi nhánh:</strong> ${storeSettings.bank_branch}</p>`
                        : ""
                      }
                          ${storeSettings.bank_qr_url
                        ? `<div class="bank-qr"><img src="${storeSettings.bank_qr_url}" alt="QR Code" /></div>`
                        : ""
                      }
                        </div>
                        `
                      : ""
                    }
                        <div style="margin-top: 30px; text-align: center;">
                          <button onclick="window.print()" style="padding: 10px 20px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px;">In Phiếu</button>
                        </div>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                }
              }
            }}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2"
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
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            In phiếu
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Đóng
          </button>
        </div>

        {/* Hidden print area */}
        <div id="debt-print-area" style={{ display: "none" }}>
          <h1>PHIẾU CÔNG NỢ</h1>
          <div className="info">
            <label>{isCustomerDebt ? "Khách hàng:" : "Nhà cung cấp:"}</label>{" "}
            {isCustomerDebt
              ? (debt as CustomerDebt).customerName
              : (debt as SupplierDebt).supplierName}
          </div>
          {isCustomerDebt && (
            <>
              <div className="info">
                <label>Số điện thoại:</label>{" "}
                {(debt as CustomerDebt).phone || "Chưa có"}
              </div>
              <div className="info">
                <label>Biển số xe:</label>{" "}
                {(debt as CustomerDebt).licensePlate || "Chưa có"}
              </div>
            </>
          )}
          <div className="info">
            <label>Ngày tạo:</label> {formatDate(new Date(debt.createdDate))}
          </div>
          <div className="description">
            <strong>Nội dung:</strong>
            <br />
            {debt.description}
          </div>
          <div className="amounts">
            <div className="amount-box">
              <label>Tổng tiền</label>
              <div className="value total">
                {formatCurrency(debt.totalAmount)}
              </div>
            </div>
            <div className="amount-box">
              <label>Đã trả</label>
              <div className="value paid">
                {formatCurrency(debt.paidAmount)}
              </div>
            </div>
            <div className="amount-box">
              <label>Còn nợ</label>
              <div className="value remaining">
                {formatCurrency(debt.remainingAmount)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Delete Confirm Dialog
const DeleteConfirmDialog: React.FC<{
  debt: CustomerDebt | SupplierDebt;
  activeTab: "customer" | "supplier";
  onClose: () => void;
  onConfirm: () => void;
}> = ({ debt, activeTab, onClose, onConfirm }) => {
  const isCustomerDebt = "customerName" in debt;
  const name = isCustomerDebt
    ? (debt as CustomerDebt).customerName
    : (debt as SupplierDebt).supplierName;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-center text-slate-900 dark:text-white mb-2">
            Xác nhận xóa công nợ
          </h3>

          <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
            Bạn có chắc chắn muốn xóa công nợ của{" "}
            <span className="font-semibold">{name}</span>?
            <br />
            <span className="text-red-600 dark:text-red-400 font-medium">
              Số tiền: {formatCurrency(debt.remainingAmount)}
            </span>
            <br />
            <span className="text-sm">Hành động này không thể hoàn tác!</span>
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebtManager;
