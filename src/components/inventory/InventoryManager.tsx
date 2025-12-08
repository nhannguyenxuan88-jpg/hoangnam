import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import {
  Boxes,
  Package,
  Search,
  FileText,
  Filter,
  Edit,
  Trash2,
  Plus,
  Repeat,
  UploadCloud,
  DownloadCloud,
  MoreHorizontal,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { safeAudit } from "../../lib/repository/auditLogsRepository";
import { supabase } from "../../supabaseClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  usePartsRepoPaged,
  useCreatePartRepo,
  useUpdatePartRepo,
  useDeletePartRepo,
} from "../../hooks/usePartsRepository";
import { formatCurrency, formatDate } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import {
  exportPartsToExcel,
  exportInventoryTemplate,
  importPartsFromExcel,
  importPartsFromExcelDetailed,
} from "../../utils/excel";
import { showToast } from "../../utils/toast";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmModal from "../common/ConfirmModal";
import CategoriesManager from "../categories/CategoriesManager";
import LookupManager from "../lookup/LookupManager";
import LookupManagerMobile from "../lookup/LookupManagerMobile";
import {
  useInventoryTxRepo,
  useCreateInventoryTxRepo,
  useCreateReceiptAtomicRepo,
} from "../../hooks/useInventoryTransactionsRepository";
import { useCategories, useCreateCategory } from "../../hooks/useCategories";
import { useSuppliers, useCreateSupplier } from "../../hooks/useSuppliers";
import type { Part, InventoryTransaction } from "../../types";
import { fetchPartBySku } from "../../lib/repository/partsRepository";
import { useSupplierDebtsRepo } from "../../hooks/useDebtsRepository";
import { createCashTransaction } from "../../lib/repository/cashTransactionsRepository";
import FormattedNumberInput from "../common/FormattedNumberInput";
import { validatePriceAndQty } from "../../utils/validation";
import { GoodsReceiptMobileModal } from "./GoodsReceiptMobileModal";
import InventoryHistorySectionMobile from "./InventoryHistorySectionMobile";
import PrintBarcodeModal from "./PrintBarcodeModal";
import BatchPrintBarcodeModal from "./BatchPrintBarcodeModal";
import BarcodeScannerModal from "../common/BarcodeScannerModal";

const LOW_STOCK_THRESHOLD = 5;
const FILTER_THEME_STYLES: Record<
  "neutral" | "success" | "warning" | "danger",
  {
    buttonActive: string;
    buttonInactive: string;
    badgeActive: string;
    badgeInactive: string;
  }
> = {
  neutral: {
    buttonActive:
      "border-blue-500 bg-blue-500/10 shadow-[0_5px_25px_rgba(59,130,246,0.15)] text-slate-900 dark:text-slate-100",
    buttonInactive:
      "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300/70",
    badgeActive:
      "border-blue-500 text-blue-600 bg-white/60 dark:bg-slate-900/40 dark:text-blue-400",
    badgeInactive:
      "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300",
  },
  success: {
    buttonActive:
      "border-emerald-500 bg-emerald-50 shadow-[0_5px_25px_rgba(16,185,129,0.2)] text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    buttonInactive:
      "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400/70 dark:border-emerald-800 dark:bg-emerald-950/20",
    badgeActive:
      "border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-600",
    badgeInactive:
      "border-emerald-200 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400",
  },
  warning: {
    buttonActive:
      "border-amber-500 bg-amber-50 shadow-[0_5px_25px_rgba(245,158,11,0.25)] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    buttonInactive:
      "border-amber-200 bg-amber-50/40 hover:border-amber-400/70 dark:border-amber-800 dark:bg-amber-950/20",
    badgeActive:
      "border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-600",
    badgeInactive:
      "border-amber-200 text-amber-600 dark:border-amber-700 dark:text-amber-400",
  },
  danger: {
    buttonActive:
      "border-red-500 bg-red-50 shadow-[0_5px_25px_rgba(239,68,68,0.25)] text-red-900 dark:bg-red-950/50 dark:text-red-200",
    buttonInactive:
      "border-red-200 bg-red-50/40 hover:border-red-400/70 dark:border-red-800 dark:bg-red-950/20",
    badgeActive:
      "border-red-500 text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700",
    badgeInactive:
      "border-red-200 text-red-600 dark:border-red-700 dark:text-red-400",
  },
};
// Add New Product Modal Component
const AddProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
    barcode: string;
    category: string;
    quantity: number;
    importPrice: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [importPrice, setImportPrice] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [warranty, setWarranty] = useState<number>(0);
  const [warrantyUnit, setWarrantyUnit] = useState("tháng");
  const [retailOverridden, setRetailOverridden] = useState<boolean>(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      barcode: barcode.trim(),
      category: category || "Chưa phân loại",
      quantity: Number(quantity) || 1,
      importPrice: Number(importPrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      warranty: Number(warranty) || 0,
      warrantyUnit,
    });

    // Reset form
    setName("");
    setDescription("");
    setBarcode("");
    setCategory("");
    setQuantity(1);
    setImportPrice(0);
    setRetailPrice(0);
    setWarranty(0);
    setRetailOverridden(false);
    setWarrantyUnit("tháng");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full sm:rounded-xl sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl">
        {/* Header - Mobile optimized */}
        <div className="flex justify-between items-center px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 sm:bg-none sm:from-transparent sm:to-transparent">
          <h2 className="text-lg font-bold text-white sm:text-slate-900 sm:dark:text-slate-100">
            ➕ Thêm sản phẩm mới
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 sm:bg-slate-100 sm:dark:bg-slate-700 text-white sm:text-slate-600 sm:dark:text-slate-300 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="space-y-4">
            {/* Card: Thông tin sản phẩm */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                📦 Thông tin sản phẩm
              </h3>

              {/* Tên sản phẩm */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Tên sản phẩm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập tên sản phẩm"
                />
              </div>

              {/* Danh mục */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Danh mục sản phẩm
                </label>
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowInlineCat(true)}
                    className="w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                    aria-label="Thêm danh mục mới"
                  >
                    <span className="text-2xl text-blue-600 dark:text-blue-400">
                      +
                    </span>
                  </button>
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Mã vạch / SKU
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập mã vạch (nếu có)"
                />
              </div>
            </div>

            {/* Inline category form */}
            {showInlineCat && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = inlineCatName.trim();
                    if (!trimmed) {
                      showToast.warning("Vui lòng nhập tên danh mục");
                      return;
                    }
                    if (trimmed.length < 2) {
                      showToast.warning("Tên quá ngắn");
                      return;
                    }
                    try {
                      const res = await createCategory.mutateAsync({
                        name: trimmed,
                      });
                      setCategory(res.name);
                      setInlineCatName("");
                      setShowInlineCat(false);
                    } catch (err: any) {
                      showToast.error(err?.message || "Lỗi tạo danh mục");
                    }
                  }}
                  className="space-y-3"
                >
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Tạo danh mục mới
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nhập tên danh mục mới"
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                    >
                      Lưu danh mục
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineCat(false);
                        setInlineCatName("");
                      }}
                      className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Card: Mô tả */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                📝 Mô tả sản phẩm
              </h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                placeholder="Mô tả chi tiết sản phẩm (tùy chọn)"
              />
            </div>

            {/* Card: Thông tin nhập kho */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                💰 Thông tin nhập kho
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Số lượng */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Số lượng
                  </label>
                  <FormattedNumberInput
                    value={quantity}
                    onValue={(v) => {
                      const result = validatePriceAndQty(importPrice, v);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setQuantity(Math.max(1, result.clean.quantity));
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center font-bold"
                  />
                </div>

                {/* Giá nhập */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Giá nhập (đ)
                  </label>
                  <FormattedNumberInput
                    value={importPrice}
                    onValue={(v) => {
                      const result = validatePriceAndQty(v, quantity);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setImportPrice(result.clean.importPrice);
                      if (!retailOverridden) {
                        setRetailPrice(
                          Math.round(result.clean.importPrice * 1.5)
                        );
                      }
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>

                {/* Giá bán lẻ */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Giá bán lẻ (đ)
                  </label>
                  <FormattedNumberInput
                    value={retailPrice}
                    onValue={(v) => {
                      setRetailPrice(Math.max(0, Math.round(v)));
                      setRetailOverridden(true);
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>

                {/* Bảo hành */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Bảo hành
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={warranty}
                      onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                      className="w-16 px-2 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center"
                    />
                    <select
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value)}
                      className="flex-1 px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="tháng">tháng</option>
                      <option value="năm">năm</option>
                      <option value="ngày">ngày</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-98 transition-all"
          >
            ✓ Lưu và Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>
  );
};

// Mobile Goods Receipt Wrapper - manages state and renders mobile modal
const GoodsReceiptMobileWrapper: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  parts: Part[];
  currentBranchId: string;
  onSave: (
    items: Array<{
      partId: string;
      partName: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
      wholesalePrice?: number;
    }>,
    supplierId: string,
    totalAmount: number,
    note: string,
    paymentInfo?: {
      paymentMethod: "cash" | "bank";
      paymentType: "full" | "partial" | "note";
      paidAmount: number;
      discount: number;
    }
  ) => void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
  const [receiptItems, setReceiptItems] = useState<
    Array<{
      partId: string;
      partName: string;
      sku: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
      wholesalePrice: number;
    }>
  >([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "note">(
    "full"
  );
  const [partialAmount, setPartialAmount] = useState(0);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const createPartMutation = useCreatePartRepo();

  // Debug logging
  console.log(
    "📦 GoodsReceiptMobileWrapper - parts received:",
    parts?.length || 0,
    parts?.slice(0, 2)
  );
  console.log("📦 currentBranchId:", currentBranchId);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReceiptItems([]);
      setSelectedSupplier("");
      setSearchTerm("");
      setDiscount(0);
      setDiscountType("amount");
      setPaymentMethod("cash");
      setPaymentType("full");
      setPartialAmount(0);
    }
  }, [isOpen]);

  const handleAddNewProduct = (productData: any) => {
    // Chỉ thêm vào danh sách tạm thời, KHÔNG lưu vào DB ngay
    // Sản phẩm sẽ được tạo khi hoàn tất phiếu nhập (bấm "Nhập kho")
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempSku =
      productData.barcode?.trim() || productData.sku || `PT-${Date.now()}`;

    // Add to receipt items with temporary ID (marked as new product)
    setReceiptItems((items) => [
      ...items,
      {
        partId: tempId,
        partName: productData.name,
        sku: tempSku,
        quantity: productData.quantity,
        importPrice: productData.importPrice,
        sellingPrice: productData.retailPrice,
        wholesalePrice: productData.wholesalePrice || 0,
        // Store product data for later creation when receipt is finalized
        _isNewProduct: true,
        _productData: {
          name: productData.name,
          sku: tempSku,
          barcode: productData.barcode?.trim() || "",
          category: productData.category,
          description: productData.description || "",
          importPrice: productData.importPrice,
          retailPrice: productData.retailPrice,
          wholesalePrice:
            productData.wholesalePrice ||
            Math.round(productData.retailPrice * 0.9),
        },
      },
    ]);

    showToast.success(
      "Đã thêm sản phẩm mới vào phiếu. Sản phẩm sẽ được lưu khi nhập kho."
    );
    setShowAddProductModal(false);
  };

  const handleSave = () => {
    if (!selectedSupplier) {
      showToast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.error("Vui lòng thêm sản phẩm");
      return;
    }

    const subtotal = receiptItems.reduce(
      (sum, item) => sum + item.quantity * item.importPrice,
      0
    );
    const discountAmount =
      discountType === "percent"
        ? Math.round((subtotal * discount) / 100)
        : discount;
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // Calculate paid amount based on payment type
    // Default to "full" if paymentType is somehow not set
    const effectivePaymentType = paymentType || "full";
    let paidAmount = 0;
    if (effectivePaymentType === "full") {
      paidAmount = totalAmount;
    } else if (effectivePaymentType === "partial") {
      paidAmount = partialAmount;
    }
    // paymentType === "note" => paidAmount = 0

    onSave(receiptItems, selectedSupplier, totalAmount, "", {
      paymentMethod,
      paymentType: effectivePaymentType,
      paidAmount,
      discount: discountAmount,
    });
    clearDraft(); // Xóa draft sau khi hoàn tất
    onClose();
  };

  return (
    <>
      <GoodsReceiptMobileModal
        isOpen={isOpen}
        onClose={onClose}
        parts={parts}
        receiptItems={receiptItems}
        setReceiptItems={setReceiptItems}
        selectedSupplier={selectedSupplier}
        setSelectedSupplier={setSelectedSupplier}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSave={handleSave}
        discount={discount}
        setDiscount={setDiscount}
        discountType={discountType}
        setDiscountType={setDiscountType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        partialAmount={partialAmount}
        setPartialAmount={setPartialAmount}
        showAddProductModal={showAddProductModal}
        setShowAddProductModal={setShowAddProductModal}
        onAddNewProduct={handleAddNewProduct}
        currentBranchId={currentBranchId}
      />
      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSave={handleAddNewProduct}
      />
    </>
  );
};

// Goods Receipt Modal Component (Ảnh 2)
const GoodsReceiptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  parts: Part[];
  currentBranchId: string;
  onSave: (
    items: Array<{
      partId: string;
      partName: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
    }>,
    supplierId: string,
    totalAmount: number,
    note: string,
    paymentInfo?: {
      paymentMethod: "cash" | "bank";
      paymentType: "full" | "partial" | "note";
      paidAmount: number;
      discount: number;
    }
  ) => void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [step, setStep] = useState<1 | 2>(1); // 1: Chọn hàng, 2: Thanh toán
  const { data: suppliers = [] } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
  const createPartMutation = useCreatePartRepo();
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<
    Array<{
      partId: string;
      partName: string;
      sku: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
      wholesalePrice: number;
    }>
  >([]);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentType, setPaymentType] = useState<
    "full" | "partial" | "note" | null
  >(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [discountPercent, setDiscountPercent] = useState(0);

  // Auto-save key cho localStorage
  const DRAFT_KEY = `goods_receipt_draft_${currentBranchId}`;

  // Khôi phục dữ liệu từ localStorage khi mở modal
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          // Kiểm tra draft không quá 24h
          if (
            draft.timestamp &&
            Date.now() - draft.timestamp < 24 * 60 * 60 * 1000
          ) {
            if (draft.receiptItems?.length > 0 || draft.selectedSupplier) {
              const shouldRestore = window.confirm(
                `Phát hiện phiếu nhập chưa hoàn tất (${
                  draft.receiptItems?.length || 0
                } sản phẩm).\n\nBạn có muốn khôi phục không?`
              );
              if (shouldRestore) {
                setReceiptItems(draft.receiptItems || []);
                setSelectedSupplier(draft.selectedSupplier || "");
                setDiscount(draft.discount || 0);
                setDiscountType(draft.discountType || "amount");
                setDiscountPercent(draft.discountPercent || 0);
                showToast.success("Đã khôi phục phiếu nhập từ bản nháp");
              } else {
                localStorage.removeItem(DRAFT_KEY);
              }
            }
          } else {
            // Draft quá cũ, xóa đi
            localStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch (e) {
        console.error("Lỗi khôi phục draft:", e);
      }
    }
  }, [isOpen, DRAFT_KEY]);

  // Auto-save vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (isOpen && (receiptItems.length > 0 || selectedSupplier)) {
      const draft = {
        receiptItems,
        selectedSupplier,
        discount,
        discountType,
        discountPercent,
        timestamp: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [
    isOpen,
    receiptItems,
    selectedSupplier,
    discount,
    discountType,
    discountPercent,
    DRAFT_KEY,
  ]);

  // Xóa draft khi hoàn tất phiếu nhập thành công
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  const filteredParts = useMemo(() => {
    console.log(
      "🔍 Desktop Modal - parts:",
      parts?.length || 0,
      parts?.slice(0, 2)
    );
    console.log("🔍 Desktop Modal - searchTerm:", searchTerm);

    if (!parts || parts.length === 0) {
      console.log("⚠️ parts is empty or undefined");
      return [];
    }

    if (!searchTerm || searchTerm.trim() === "") {
      console.log("✅ Showing all parts:", parts.length);
      return parts;
    }

    const q = searchTerm.toLowerCase().trim();
    const filtered = parts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
    console.log("✅ Filtered results:", filtered.length);
    return filtered;
  }, [parts, searchTerm]);

  const addToReceipt = (part: Part) => {
    const existing = receiptItems.find((item) => item.partId === part.id);
    if (existing) {
      setReceiptItems((items) =>
        items.map((item) =>
          item.partId === part.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      // Không hiện toast khi tăng số lượng để tránh spam
    } else {
      setReceiptItems([
        ...receiptItems,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice: part.costPrice?.[currentBranchId] || 0,
          sellingPrice: part.retailPrice[currentBranchId] || 0,
          wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
        },
      ]);
      showToast.success(`Đã thêm ${part.name} vào phiếu nhập`);
    }
    setSearchTerm("");
    // Auto focus back to barcode input
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Handle barcode scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    // Normalize: loại bỏ ký tự đặc biệt để so sánh
    const normalizeCode = (code: string): string =>
      code.toLowerCase().replace(/[-\s./\\]/g, "");
    const normalizedBarcode = normalizeCode(barcode);

    // Tìm part với logic ưu tiên: barcode > SKU > tên
    const foundPart = parts.find(
      (p) =>
        // 1. Khớp barcode (field mới)
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        // 2. Khớp SKU
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        // 3. Tìm trong tên
        p.name?.toLowerCase().includes(barcode.toLowerCase())
    );

    if (foundPart) {
      addToReceipt(foundPart);
      setBarcodeInput("");
    } else {
      showToast.error(`Không tìm thấy sản phẩm có mã: ${barcode}`);
      setBarcodeInput("");
    }
  };

  // Handle camera barcode scan - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {
    console.log("📷 Camera scanned:", barcode);

    const normalizeCode = (code: string): string =>
      code.toLowerCase().replace(/[-\s./\\]/g, "");
    const normalizedBarcode = normalizeCode(barcode);

    const foundPart = parts.find(
      (p) =>
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase()
    );

    // KHÔNG cần đóng scanner - BarcodeScannerModal tự đóng

    if (foundPart) {
      // Kiểm tra đã có trong phiếu chưa
      const existingItem = receiptItems.find(
        (item) => item.partId === foundPart.id
      );
      if (existingItem) {
        // Chỉ tăng số lượng, KHÔNG hiện toast để tránh spam
        setReceiptItems((items) =>
          items.map((item) =>
            item.partId === foundPart.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        // Thêm mới - chỉ hiện 1 toast
        setReceiptItems((items) => [
          ...items,
          {
            partId: foundPart.id,
            partName: foundPart.name,
            sku: foundPart.sku,
            quantity: 1,
            importPrice: foundPart.costPrice?.[currentBranchId] || 0,
            sellingPrice: foundPart.retailPrice[currentBranchId] || 0,
            wholesalePrice: foundPart.wholesalePrice?.[currentBranchId] || 0,
          },
        ]);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
      setSearchTerm("");
    } else {
      showToast.error(`Không tìm thấy: ${barcode}`);
    }
  };

  // Auto focus barcode input when showBarcodeInput is enabled
  useEffect(() => {
    if (showBarcodeInput) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [showBarcodeInput]);

  const updateReceiptItem = (
    partId: string,
    field: "quantity" | "importPrice" | "sellingPrice" | "wholesalePrice",
    value: number
  ) => {
    setReceiptItems((items) =>
      items.map((item) =>
        item.partId === partId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeReceiptItem = (partId: string) => {
    setReceiptItems((items) => items.filter((item) => item.partId !== partId));
  };

  const subtotal = useMemo(() => {
    return receiptItems.reduce(
      (sum, item) => sum + item.importPrice * item.quantity,
      0
    );
  }, [receiptItems]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const { profile } = useAuth();
  const handleSave = () => {
    if (!canDo(profile?.role, "part.update_price")) {
      showToast.error("Bạn không có quyền cập nhật giá");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.warning("Vui lòng chọn sản phẩm nhập kho");
      return;
    }
    const supplierName =
      suppliers.find((s: any) => s.id === selectedSupplier)?.name || "";

    // Calculate paidAmount based on paymentType
    // Default to "full" if paymentType is null (user selected payment method but didn't explicitly click payment type)
    const effectivePaymentType = paymentType || "full";
    const calculatedPaidAmount =
      effectivePaymentType === "full"
        ? totalAmount
        : effectivePaymentType === "partial"
        ? partialAmount
        : 0;

    onSave(receiptItems, selectedSupplier, totalAmount, "", {
      paymentMethod: paymentMethod || "cash",
      paymentType: paymentType || "full",
      paidAmount: calculatedPaidAmount,
      discount,
    });
    clearDraft(); // Xóa draft sau khi hoàn tất
    setReceiptItems([]);
    setSelectedSupplier("");
    setSearchTerm("");
    setDiscount(0);
    setDiscountPercent(0);
    setDiscountType("amount");
  };

  const handleAddNewProduct = (productData: any) => {
    // Tạo sản phẩm mới với stock = 0, stock sẽ được cập nhật khi hoàn tất phiếu nhập
    (async () => {
      try {
        // Nếu người dùng nhập mã (Honda/Yamaha) thì dùng, không thì tự sinh PT-xxx
        const productSku = productData.barcode?.trim() || `PT-${Date.now()}`;
        const createRes = await createPartMutation.mutateAsync({
          name: productData.name,
          sku: productSku,
          barcode: productData.barcode?.trim() || "", // Lưu lại để tìm kiếm
          category: productData.category,
          description: productData.description,
          stock: { [currentBranchId]: 0 }, // Stock = 0, sẽ cập nhật khi hoàn tất phiếu nhập
          costPrice: { [currentBranchId]: productData.importPrice },
          retailPrice: { [currentBranchId]: productData.retailPrice },
          wholesalePrice: {
            [currentBranchId]: Math.round(productData.retailPrice * 0.9),
          },
        });

        // Xử lý response - có thể là { ok, data } hoặc trực tiếp Part object
        const partData = (createRes as any)?.data || createRes;
        const partId =
          partData?.id ||
          `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const partSku = partData?.sku || productSku;

        // Add to receipt items from persisted part
        setReceiptItems((prev) => [
          ...prev,
          {
            partId: partId,
            partName: productData.name,
            sku: partSku,
            quantity: productData.quantity,
            importPrice: productData.importPrice,
            sellingPrice: productData.retailPrice,
            wholesalePrice: productData.wholesalePrice || 0,
          },
        ]);
        showToast.success("Đã tạo phụ tùng mới và thêm vào phiếu nhập");
      } catch (e: any) {
        showToast.error(e?.message || "Lỗi tạo phụ tùng mới");
      } finally {
        setShowAddProductModal(false);
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex">
          {/* Left Panel - Product Browser (50%) */}
          <div className="w-1/2 flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200/50 dark:border-slate-700/50">
            {/* Modern Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-400 transition-all hover:scale-105"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Danh mục sản phẩm
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Chọn để thêm vào giỏ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Thêm mới</span>
              </button>
            </div>

            {/* Search Bar with Icon */}
            <div className="p-3 bg-white/50 dark:bg-slate-800/50 space-y-2">
              {/* Barcode Scanner Input - Toggle visibility */}
              {showBarcodeInput && (
                <form onSubmit={handleBarcodeSubmit}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder="Quét mã vạch hoặc nhập SKU..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 text-sm placeholder:text-blue-500/60 dark:placeholder:text-blue-400/60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                      />
                      {barcodeInput && (
                        <button
                          type="button"
                          onClick={() => setBarcodeInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    {/* Close barcode input */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowBarcodeInput(false);
                        setBarcodeInput("");
                      }}
                      className="px-3 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      title="Đóng"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </form>
              )}

              {/* Manual Search with barcode toggle */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                    placeholder="Hoặc tìm kiếm thủ công..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Barcode Toggle Button */}
                {!showBarcodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBarcodeInput(true);
                      setTimeout(() => barcodeInputRef.current?.focus(), 100);
                    }}
                    className="px-3 py-2.5 rounded-xl border-2 border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    title="Quét mã vạch"
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
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                  </button>
                )}

                {/* Camera Scanner Button */}
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  className="px-3 py-2.5 rounded-xl border-2 border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-green-100"
                  title="Quét bằng camera"
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
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredParts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <svg
                    className="w-16 h-16 mb-3 opacity-30"
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
                  <p className="text-sm font-medium">Không tìm thấy sản phẩm</p>
                  <p className="text-xs mt-1">Thử tìm kiếm với từ khóa khác</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredParts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => addToReceipt(part)}
                      className="group p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
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
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {part.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                              {part.sku}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                part.category
                                  ? `${getCategoryColor(part.category).bg} ${
                                      getCategoryColor(part.category).text
                                    }`
                                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {part.category || "Chưa phân loại"}
                            </span>
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Cart & Checkout (50%) */}
          <div className="w-1/2 bg-white dark:bg-slate-800 flex flex-col">
            {/* Supplier Selection - Modern */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
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
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nhà cung cấp
                </label>
                <button
                  onClick={() => {
                    setNewSupplier({
                      name: "",
                      phone: "",
                      address: "",
                      note: "",
                    });
                    setShowSupplierModal(true);
                  }}
                  className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 font-medium transition-all"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Thêm NCC
                </button>
              </div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              >
                <option value="">Chọn nhà cung cấp...</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `• ${s.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {showSupplierModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Thêm nhà cung cấp
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Tên *
                      </label>
                      <input
                        autoFocus
                        value={newSupplier.name}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                        placeholder="Tên nhà cung cấp"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Điện thoại
                      </label>
                      <input
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                        placeholder="SĐT"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Địa chỉ
                      </label>
                      <textarea
                        rows={2}
                        value={newSupplier.address}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm resize-none"
                        placeholder="Địa chỉ nhà cung cấp"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Ghi chú
                      </label>
                      <textarea
                        rows={2}
                        value={newSupplier.note}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            note: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm resize-none"
                        placeholder="Thông tin thêm (tùy chọn)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowSupplierModal(false)}
                      className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={async () => {
                        if (!newSupplier.name.trim()) {
                          showToast.warning("Nhập tên nhà cung cấp");
                          return;
                        }
                        try {
                          const res: any = await createSupplier.mutateAsync({
                            name: newSupplier.name.trim(),
                            phone: newSupplier.phone?.trim() || undefined,
                            address: newSupplier.address?.trim() || undefined,
                          });
                          setSelectedSupplier(res.id);
                          setShowSupplierModal(false);
                        } catch (e: any) {
                          // mutation hook đã show toast
                        }
                      }}
                      className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      disabled={createSupplier.isPending}
                    >
                      {createSupplier.isPending ? "Đang lưu..." : "Lưu"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cart Items - Modern Cards */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
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
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Giỏ hàng nhập
                  </h3>
                </div>
                <span className="text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 rounded-full font-semibold shadow-lg">
                  {receiptItems.length} sản phẩm
                </span>
              </div>

              {receiptItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-4">
                    <svg
                      className="w-12 h-12 text-slate-300 dark:text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Giỏ hàng trống
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Chọn sản phẩm bên trái để thêm vào
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {receiptItems.map((item, index) => {
                    // Tìm part gốc để lấy category
                    const originalPart = parts.find(
                      (p) => p.id === item.partId
                    );
                    return (
                      <div
                        key={item.partId}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 hover:shadow-md transition-shadow"
                      >
                        {/* Header: #, Name, SKU, Category, Delete */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">
                              #{index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                              {item.partName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-mono">
                                {item.sku}
                              </span>
                              {originalPart?.category && (
                                <span
                                  className={`inline-flex items-center px-1 py-0 rounded text-[8px] font-medium ${
                                    getCategoryColor(originalPart.category).bg
                                  } ${
                                    getCategoryColor(originalPart.category).text
                                  }`}
                                >
                                  {originalPart.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeReceiptItem(item.partId)}
                            className="w-5 h-5 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:bg-red-200 flex-shrink-0 text-sm"
                            title="Xóa"
                          >
                            ×
                          </button>
                        </div>

                        {/* All inputs in ONE row: Quantity | Import Price | Selling Price | Total */}
                        <div className="flex items-center gap-1.5">
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  Math.max(1, item.quantity - 1)
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-blue-50 text-sm"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  Math.max(1, val)
                                );
                              }}
                              className="w-10 px-1 py-1 text-center border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                              min="1"
                            />
                            <button
                              onClick={() =>
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  item.quantity + 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-blue-50 text-sm"
                            >
                              +
                            </button>
                          </div>

                          {/* Import price */}
                          <FormattedNumberInput
                            value={item.importPrice}
                            onValue={(val) => {
                              const { clean } = validatePriceAndQty(
                                val,
                                item.quantity
                              );
                              const newImport = clean.importPrice;
                              const autoPrice = Math.round(newImport * 1.5);
                              setReceiptItems((items) =>
                                items.map((it) =>
                                  it.partId === item.partId
                                    ? {
                                        ...it,
                                        importPrice: newImport,
                                        sellingPrice:
                                          it.sellingPrice === 0 ||
                                          it.sellingPrice ===
                                            Math.round(
                                              (it.importPrice || 0) * 1.5
                                            )
                                            ? autoPrice
                                            : it.sellingPrice,
                                      }
                                    : it
                                )
                              );
                            }}
                            className="min-w-[70px] max-w-[110px] flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-blue-500"
                            placeholder="Giá nhập"
                          />

                          {/* Selling price */}
                          <FormattedNumberInput
                            value={item.sellingPrice}
                            onValue={(val) =>
                              updateReceiptItem(
                                item.partId,
                                "sellingPrice",
                                Math.max(0, Math.round(val))
                              )
                            }
                            className="min-w-[70px] max-w-[110px] flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-emerald-500"
                            placeholder="Giá bán"
                          />

                          {/* Total amount */}
                          <div className="min-w-[70px] text-right flex-shrink-0">
                            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {formatCurrency(item.importPrice * item.quantity)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Section - Compact */}
            <div className="p-3 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {/* Total Display - Always visible */}
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase">
                    Tổng thanh toán
                  </span>
                  <div className="text-right">
                    <div className="text-xl font-black text-white">
                      {formatCurrency(totalAmount)}
                    </div>
                    <div className="text-[10px] text-white/70">
                      {receiptItems.length} SP
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method - Compact buttons */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    💵 Tiền mặt
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    🏦 Chuyển khoản
                  </button>
                </div>
              </div>

              {/* Show details only when payment method is selected */}
              {paymentMethod && (
                <>
                  {/* Payment Type */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hình thức thanh toán
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setPaymentType("full");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "full"
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Đủ
                      </button>
                      <button
                        onClick={() => setPaymentType("partial")}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "partial"
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        1 phần
                      </button>
                      <button
                        onClick={() => {
                          setPaymentType("note");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "note"
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Công nợ
                      </button>
                    </div>
                  </div>

                  {/* Partial Payment Input */}
                  {paymentType === "partial" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số tiền khách trả
                      </label>
                      <FormattedNumberInput
                        value={partialAmount}
                        onValue={(v) =>
                          setPartialAmount(Math.max(0, Math.round(v)))
                        }
                        className="w-full px-3 py-2 border-2 border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-sm font-bold focus:border-orange-500"
                        placeholder="Nhập số tiền..."
                      />
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Còn lại:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(
                            Math.max(0, totalAmount - partialAmount)
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Transaction Type */}
                  {paymentType && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Loại hạch toán
                      </label>
                      <select className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:border-blue-500">
                        <option>Mua hàng/nhập kho</option>
                        <option>Nhập trả hàng</option>
                        <option>Khác</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons - Always visible */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2.5 rounded-lg font-bold text-xs transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
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
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                    LƯU NHÁP
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (!paymentMethod) {
                      showToast.warning("Vui lòng chọn phương thức thanh toán");
                      return;
                    }
                    if (!paymentType) {
                      showToast.warning("Vui lòng chọn hình thức thanh toán");
                      return;
                    }
                    if (paymentType === "partial" && partialAmount <= 0) {
                      showToast.warning("Vui lòng nhập số tiền khách trả");
                      return;
                    }
                    handleSave();
                  }}
                  disabled={
                    !paymentMethod ||
                    !paymentType ||
                    (paymentType === "partial" && partialAmount <= 0)
                  }
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs transition-all disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
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
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                    NHẬP KHO
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSave={handleAddNewProduct}
      />
    </>
  );
};

// Add/Edit Supplier Modal Component
const SupplierModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: {
    name: string;
    phone: string;
    address: string;
    email: string;
  }) => void;
  initialData?: { name: string; phone: string; address: string; email: string };
  mode: "add" | "edit";
}> = ({ isOpen, onClose, onSave, initialData, mode }) => {
  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [email, setEmail] = useState(initialData?.email || "");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPhone(initialData.phone);
      setAddress(initialData.address);
      setEmail(initialData.email);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      email: email.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {mode === "add"
                ? "Thêm nhà cung cấp mới"
                : "Chỉnh sửa nhà cung cấp"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tên nhà cung cấp *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên nhà cung cấp"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Nhập số điện thoại"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Địa chỉ
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Nhập địa chỉ"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              {mode === "add" ? "Thêm" : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Product to Receipt Modal Component
const AddProductToReceiptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: {
    partId: string;
    partName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }) => void;
  currentBranchId: string;
}> = ({ isOpen, onClose, onAdd, currentBranchId }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Part | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  const { data: allParts = [] } = useQuery<Part[]>({
    queryKey: ["allPartsForReceipt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredParts = useMemo(() => {
    if (!searchTerm) return [];
    const q = searchTerm.toLowerCase();
    return allParts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [allParts, searchTerm]);

  const handleSelectProduct = (part: Part) => {
    setSelectedProduct(part);
    setUnitPrice(part.costPrice?.[currentBranchId] || 0);
    setSearchTerm(part.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      showToast.error("Vui lòng chọn sản phẩm");
      return;
    }
    if (quantity <= 0) {
      showToast.error("Số lượng phải lớn hơn 0");
      return;
    }
    if (unitPrice < 0) {
      showToast.error("Đơn giá không được âm");
      return;
    }

    onAdd({
      partId: selectedProduct.id,
      partName: selectedProduct.name,
      sku: selectedProduct.sku || "",
      quantity,
      unitPrice,
    });

    // Reset form
    setSearchTerm("");
    setSelectedProduct(null);
    setQuantity(1);
    setUnitPrice(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Thêm sản phẩm vào phiếu
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4">
            {/* Product Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tìm kiếm sản phẩm *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setSelectedProduct(null);
                  }}
                  placeholder="Nhập tên hoặc SKU sản phẩm..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
                {searchTerm && !selectedProduct && filteredParts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredParts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => handleSelectProduct(part)}
                        className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0"
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {part.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          SKU: {part.sku || "N/A"} | Giá nhập:{" "}
                          {formatCurrency(
                            part.costPrice?.[currentBranchId] || 0
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-800 dark:text-green-200">
                  ✓ Đã chọn: {selectedProduct.name} ({selectedProduct.sku})
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Số lượng *
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="1"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đơn giá nhập *
              </label>
              <FormattedNumberInput
                value={unitPrice}
                onValue={setUnitPrice}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="0"
              />
            </div>

            {/* Total */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Thành tiền
              </label>
              <input
                type="text"
                value={formatCurrency(quantity * unitPrice)}
                readOnly
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Thêm sản phẩm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Receipt Modal Component - Full Receipt Editing
const EditReceiptModal: React.FC<{
  receipt: {
    receiptCode: string;
    date: Date;
    supplier: string;
    items: InventoryTransaction[];
    total: number;
  };
  onClose: () => void;
  onSave: (data: any) => void;
  currentBranchId: string;
}> = ({ receipt, onClose, onSave, currentBranchId }) => {
  const { profile } = useAuth();
  const [supplier, setSupplier] = useState(receipt.supplier);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState(
    receipt.supplier
  );
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<"add" | "edit">(
    "add"
  );
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Fetch suppliers from database
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm) return allSuppliers;
    const q = supplierSearchTerm.toLowerCase();
    return allSuppliers.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [allSuppliers, supplierSearchTerm]);

  const [items, setItems] = useState(
    receipt.items.map((item) => ({
      id: item.id,
      partId: item.partId,
      partName: item.partName,
      sku: (item as any).sku || "",
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.quantity * (item.unitPrice || 0),
      notes: item.notes || "",
    }))
  );
  const [payments, setPayments] = useState<any[]>([]);
  const [isPaid, setIsPaid] = useState(true);

  // Fetch cash transactions for this receipt
  const { data: cashTransactions = [] } = useQuery({
    queryKey: ["cash-transactions-receipt", receipt.receiptCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*, profiles(full_name)")
        .eq("reference", receipt.receiptCode)
        .eq("branch_id", currentBranchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Update payments when cash transactions load
  React.useEffect(() => {
    console.log("[EditReceiptModal] Cash transactions:", cashTransactions);
    console.log("[EditReceiptModal] Receipt code:", receipt.receiptCode);
    console.log("[EditReceiptModal] Branch ID:", currentBranchId);

    if (cashTransactions.length > 0) {
      setPayments(
        cashTransactions.map((tx: any) => {
          const txDate = new Date(tx.created_at);
          return {
            time: txDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            date: txDate,
            payer: tx.description || "--",
            cashier: `${tx.profiles?.full_name || "--"} (${
              tx.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"
            })`,
            amount: Math.abs(tx.amount),
          };
        })
      );
    } else {
      console.log(
        "[EditReceiptModal] No cash transactions found, showing placeholder"
      );
      // Show placeholder payment if no transactions found
      setPayments([
        {
          time: new Date(receipt.date).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          date: receipt.date,
          payer: "Chưa có giao dịch",
          cashier: "--",
          amount: 0,
        },
      ]);
    }
  }, [cashTransactions, receipt]);

  // Extract phone from notes if available
  React.useEffect(() => {
    const firstItem = receipt.items[0];
    if (firstItem?.notes?.includes("Phone:")) {
      const phone = firstItem.notes.split("Phone:")[1]?.split("NV:")[0]?.trim();
      if (phone) setSupplierPhone(phone);
    }
  }, [receipt.items]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".supplier-dropdown-container")) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].totalPrice = quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  const updateItemPrice = (index: number, unitPrice: number) => {
    const newItems = [...items];
    newItems[index].unitPrice = unitPrice;
    newItems[index].totalPrice = newItems[index].quantity * unitPrice;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      showToast.error("Phải có ít nhất 1 sản phẩm");
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    showToast.success("Đã xóa sản phẩm");
  };

  const handleAddProduct = (product: {
    partId: string;
    partName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }) => {
    const newItem = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      partId: product.partId,
      partName: product.partName,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      totalPrice: product.quantity * product.unitPrice,
      notes: "",
      sku: product.sku,
    };
    setItems([...items, newItem]);
    setShowAddProductModal(false);
    showToast.success(`Đã thêm ${product.partName} (sẽ lưu khi bấm LƯU)`);
  };

  const handleSaveSupplier = (supplierData: {
    name: string;
    phone: string;
    address: string;
    email: string;
  }) => {
    setSupplier(supplierData.name);
    setSupplierPhone(supplierData.phone);
    setShowSupplierModal(false);
    showToast.success(
      supplierModalMode === "add"
        ? "Đã thêm nhà cung cấp"
        : "Đã cập nhật nhà cung cấp"
    );
  };

  const handleEditSupplier = () => {
    setSupplierModalMode("edit");
    setShowSupplierModal(true);
  };

  const handleAddSupplier = () => {
    setSupplierModalMode("add");
    setShowSupplierModal(true);
  };

  const handleEditItem = (index: number) => {
    const item = items[index];

    // Fetch part details including selling prices
    if (item.partId && !item.partId.startsWith("new-")) {
      supabase
        .from("parts")
        .select("price, wholesale_price")
        .eq("id", item.partId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setEditingProduct({
              ...item,
              index,
              sellingPrice: data.price || 0,
              wholesalePrice: data.wholesale_price || 0,
            });
          } else {
            setEditingProduct({
              ...item,
              index,
              sellingPrice: 0,
              wholesalePrice: 0,
            });
          }
          setShowEditProductModal(true);
        });
    } else {
      setEditingProduct({ ...item, index, sellingPrice: 0, wholesalePrice: 0 });
      setShowEditProductModal(true);
    }
  };

  const handleSaveEditedProduct = async (updatedProduct: any) => {
    const index = updatedProduct.index;
    const newItems = [...items];

    // Update item with new values including selling prices
    newItems[index] = {
      ...newItems[index],
      partName: updatedProduct.partName,
      sku: updatedProduct.sku,
      quantity: updatedProduct.quantity,
      unitPrice: updatedProduct.unitPrice,
      totalPrice: updatedProduct.quantity * updatedProduct.unitPrice,
      sellingPrice: updatedProduct.sellingPrice,
      wholesalePrice: updatedProduct.wholesalePrice,
    };

    setItems(newItems);
    setShowEditProductModal(false);
    setEditingProduct(null);

    // If product exists in database, update selling prices
    if (updatedProduct.partId && !updatedProduct.partId.startsWith("new-")) {
      try {
        const { error } = await supabase
          .from("parts")
          .update({
            price: updatedProduct.sellingPrice || 0,
            wholesale_price: updatedProduct.wholesalePrice || 0,
          })
          .eq("id", updatedProduct.partId);

        if (error) throw error;
        showToast.success("Đã cập nhật giá bán");
      } catch (error) {
        console.error("Error updating prices:", error);
        showToast.error("Không thể cập nhật giá bán vào database");
      }
    }
  };

  const handleItemMenu = (index: number) => {
    if (confirm("Bạn có muốn xóa sản phẩm này?")) {
      removeItem(index);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) {
      showToast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    if (items.some((item) => item.quantity <= 0)) {
      showToast.error("Số lượng phải lớn hơn 0");
      return;
    }
    onSave({ supplier, supplierPhone, items, payments, isPaid });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
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
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  [Chỉnh sửa] Phiếu Nhập Kho {receipt.receiptCode}
                </h3>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {new Date(receipt.date).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}{" "}
                {new Date(receipt.date).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Supplier Section */}
            <div>
              <label className="block text-base font-medium text-teal-600 dark:text-teal-400 mb-2">
                Nhà cung cấp:
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative supplier-dropdown-container">
                  <input
                    type="text"
                    value={supplierSearchTerm}
                    onChange={(e) => {
                      setSupplierSearchTerm(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Tìm kiếm và chọn một nhà cung cấp"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  {supplierSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierSearchTerm("");
                        setSupplier("");
                        setSupplierPhone("");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                  {/* Supplier Dropdown */}
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSuppliers.map((sup: any) => (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => {
                            setSupplier(sup.name);
                            setSupplierSearchTerm(sup.name);
                            setSupplierPhone(sup.phone || "");
                            setShowSupplierDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {sup.name}
                          </div>
                          {sup.phone && (
                            <div className="text-xs text-slate-500">
                              Phone: {sup.phone}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleEditSupplier}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2"
                >
                  <span className="text-xl">+</span>
                  Thêm mới
                </button>
              </div>
            </div>

            {/* Products Section */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-base font-medium text-teal-600 dark:text-teal-400">
                  Chi tiết sản phẩm nhập kho:
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1"
                >
                  <span className="text-lg">+</span>
                  Thêm sản phẩm
                </button>
              </div>

              {/* Products Table */}
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        -
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        SKU
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Tên
                      </th>
                      <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                        SL
                      </th>
                      <th className="px-3 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Đơn giá nhập
                      </th>
                      <th className="px-3 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Thành tiền
                      </th>
                      <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                          editingItemIndex === index
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-400">
                          {item.sku || "--"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {item.partName}
                          </div>
                          {item.sku && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              SKU: {item.sku}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(index, Number(e.target.value))
                            }
                            onFocus={() => setEditingItemIndex(index)}
                            onBlur={() => setEditingItemIndex(null)}
                            min="1"
                            className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <FormattedNumberInput
                            value={item.unitPrice}
                            onValue={(val) => updateItemPrice(index, val)}
                            className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.totalPrice)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(index)}
                              className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
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
                              type="button"
                              onClick={() => handleItemMenu(index)}
                              className="p-1 text-slate-400 hover:bg-slate-500/20 rounded"
                              title="Xóa sản phẩm"
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
                                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100"
                      >
                        TỔNG:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment Section */}
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-4">
              <label className="block text-base font-medium text-teal-600 dark:text-teal-400 mb-3">
                Công nợ:
              </label>

              {/* Total Payment */}
              <div className="flex items-center justify-between mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  TỔNG PHẢI CHI: {formatCurrency(totalAmount)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Đã thanh toán đủ
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1"
                  >
                    <span className="text-lg">+</span>
                    Tạo phiếu chi
                  </button>
                </div>
              </div>

              {/* Payment Notice */}
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-start gap-1">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Tổng phải chi là phí chưa phải trả cho đối tác sửa chữa
              </div>

              {/* Payment History Table */}
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      -
                    </th>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      Thời gian
                    </th>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      Người chi - Ghi chú
                    </th>
                    <th className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">
                      Số tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-2 py-2 text-slate-900 dark:text-slate-100">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 text-slate-900 dark:text-slate-100">
                        {payment.time}{" "}
                        {new Date(payment.date).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-slate-900 dark:text-slate-100">
                          {payment.payer}
                        </div>
                        <div className="text-xs text-slate-500">
                          {payment.cashier}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-900 dark:text-slate-100">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    >
                      Tổng đã chi
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(totalPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ĐÓNG
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              LƯU
            </button>
          </div>
        </form>

        {/* Supplier Modal */}
        <SupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSave={handleSaveSupplier}
          initialData={
            supplierModalMode === "edit"
              ? { name: supplier, phone: supplierPhone, address: "", email: "" }
              : undefined
          }
          mode={supplierModalMode}
        />

        {/* Add Product Modal */}
        <AddProductToReceiptModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onAdd={handleAddProduct}
          currentBranchId={currentBranchId}
        />

        {/* Edit Product Modal */}
        {showEditProductModal && editingProduct && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Chỉnh sửa sản phẩm
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tên sản phẩm
                  </label>
                  <input
                    type="text"
                    value={editingProduct.partName}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        partName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editingProduct.sku || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        sku: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Số lượng
                    </label>
                    <input
                      type="number"
                      value={editingProduct.quantity}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          quantity: Number(e.target.value),
                        })
                      }
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Giá nhập
                    </label>
                    <FormattedNumberInput
                      value={editingProduct.unitPrice}
                      onValue={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          unitPrice: val,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Giá bán lẻ
                    </label>
                    <FormattedNumberInput
                      value={editingProduct.sellingPrice || 0}
                      onValue={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          sellingPrice: val,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Giá bán sỉ
                    </label>
                    <FormattedNumberInput
                      value={editingProduct.wholesalePrice || 0}
                      onValue={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          wholesalePrice: val,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditedProduct(editingProduct)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Inventory History Section Component (Embedded in main page)
const InventoryHistorySection: React.FC<{
  transactions: InventoryTransaction[];
}> = ({ transactions }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { data: supplierDebts = [] } = useSupplierDebtsRepo();
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<{
    receiptCode: string;
    date: Date;
    supplier: string;
    items: InventoryTransaction[];
    total: number;
  } | null>(null);
  const { currentBranchId } = useAppContext();

  const filteredTransactions = useMemo(() => {
    // CHỈ LẤY GIAO DỊCH NHẬP KHO
    console.log(
      "📦 [InventoryHistorySection] Tổng số giao dịch:",
      transactions.length
    );
    let filtered = transactions.filter((t) => t.type === "Nhập kho");
    console.log(
      "📦 [InventoryHistorySection] Giao dịch 'Nhập kho':",
      filtered.length
    );
    const now = new Date();

    // Apply time filter
    switch (activeTimeFilter) {
      case "7days":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= sevenDaysAgo);
        break;
      case "30days":
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000
        );
        filtered = filtered.filter((t) => new Date(t.date) >= thirtyDaysAgo);
        break;
      case "thisMonth":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
        break;
      case "custom":
        filtered = filtered.filter((t) => {
          const date = new Date(t.date);
          return (
            date >= new Date(customStartDate) && date <= new Date(customEndDate)
          );
        });
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.partName.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    transactions,
    activeTimeFilter,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.totalPrice, 0);
  }, [filteredTransactions]);

  // Group transactions by receipt (same date, same supplier/notes)
  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, InventoryTransaction[]>();

    filteredTransactions.forEach((transaction) => {
      // Create a group key based on date and supplier
      const date = new Date(transaction.date);
      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const supplier = transaction.notes?.includes("NCC:")
        ? transaction.notes.split("NCC:")[1]?.trim()
        : "Không xác định";
      const groupKey = `${dateKey}_${supplier}_${date.getHours()}_${date.getMinutes()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(transaction);
    });

    // Convert to array and generate receipt codes
    return Array.from(groups.entries())
      .map(([key, items], index) => {
        const firstItem = items[0];
        const date = new Date(firstItem.date);

        // Extract receipt code from notes if exists (format: "NH-20251119-XXX | NCC: ...")
        let receiptCode = "";
        if (firstItem.notes) {
          const match = firstItem.notes.match(/NH-\d{8}-\d{3}/);
          if (match) {
            receiptCode = match[0];
          }
        }

        // If no receipt code in notes, generate one
        if (!receiptCode) {
          const dateStr = `${date.getFullYear()}${String(
            date.getMonth() + 1
          ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
          receiptCode = `NH-${dateStr}-${String(groups.size - index).padStart(
            3,
            "0"
          )}`;
        }

        return {
          receiptCode,
          date: firstItem.date,
          supplier: firstItem.notes?.includes("NCC:")
            ? firstItem.notes.split("NCC:")[1]?.split("|")[0]?.trim()
            : "Không xác định",
          items,
          total: items.reduce((sum, item) => sum + item.totalPrice, 0),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(
    new Set()
  );
  const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(
    new Set()
  );

  const toggleExpand = (receiptCode: string) => {
    setExpandedReceipts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(receiptCode)) {
        newSet.delete(receiptCode);
      } else {
        newSet.add(receiptCode);
      }
      return newSet;
    });
  };

  // Xóa phiếu nhập kho đã chọn
  const handleDeleteSelectedReceipts = async () => {
    if (selectedReceipts.size === 0) {
      showToast.warning("Vui lòng chọn ít nhất một phiếu nhập kho");
      return;
    }

    const confirmed = await confirm({
      title: "Xác nhận xóa phiếu nhập kho",
      message: `Bạn có chắc chắn muốn xóa ${selectedReceipts.size} phiếu nhập kho đã chọn? Hành động này sẽ:\n- Xóa các giao dịch nhập kho\n- KHÔNG hoàn lại tồn kho (cần điều chỉnh thủ công nếu cần)`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    try {
      // Get all transaction IDs for selected receipts
      const receiptCodesToDelete = Array.from(selectedReceipts);
      const transactionIds: string[] = [];

      groupedReceipts.forEach((receipt) => {
        if (receiptCodesToDelete.includes(receipt.receiptCode)) {
          receipt.items.forEach((item: any) => {
            if (item.id) transactionIds.push(item.id);
          });
        }
      });

      if (transactionIds.length === 0) {
        showToast.error("Không tìm thấy giao dịch để xóa");
        return;
      }

      // Delete transactions
      const { error } = await supabase
        .from("inventory_transactions")
        .delete()
        .in("id", transactionIds);

      if (error) throw error;

      showToast.success(`Đã xóa ${selectedReceipts.size} phiếu nhập kho`);
      setSelectedReceipts(new Set());

      // Refetch data
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
    } catch (err: any) {
      console.error("❌ Lỗi xóa phiếu nhập kho:", err);
      showToast.error(`Lỗi: ${err.message || "Không thể xóa"}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Lịch sử nhập kho
        </h2>

        {/* Time Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          {[
            { key: "7days", label: "7 ngày qua" },
            { key: "30days", label: "30 ngày qua" },
            { key: "thisMonth", label: "Tháng này" },
            { key: "custom", label: "Tùy chọn" },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveTimeFilter(filter.key)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${
                activeTimeFilter === filter.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {activeTimeFilter === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
              />
            </div>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Nhà cung cấp, SKU, tên phụ tùng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
        />
      </div>

      {/* Summary */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Tổng số phiếu:{" "}
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {groupedReceipts.length}
              </span>
            </div>
            {/* Nút xóa phiếu đã chọn */}
            {selectedReceipts.size > 0 && (
              <button
                onClick={handleDeleteSelectedReceipts}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Xóa {selectedReceipts.size} phiếu
              </button>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Tổng giá trị
            </div>
            <div className="text-base sm:text-lg font-bold text-blue-600">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Receipts List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {/* Header Row - Desktop only */}
        {groupedReceipts.length > 0 && (
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10">
            <div className="col-span-1 text-xs font-semibold text-slate-600 dark:text-slate-300"></div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Mã phiếu
            </div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nhà cung cấp
            </div>
            <div className="col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Chi tiết
            </div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Thanh toán
            </div>
            <div className="col-span-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Thao tác
            </div>
          </div>
        )}

        {groupedReceipts.length === 0 ? (
          <div className="px-3 py-8 sm:px-6 sm:py-12 text-center text-slate-500">
            <div className="text-4xl sm:text-6xl mb-4">📦</div>
            <div className="text-sm sm:text-base">Không có dữ liệu</div>
          </div>
        ) : (
          groupedReceipts.map((receipt, index) => {
            const receiptDate = new Date(receipt.date);
            const formattedDate = receiptDate.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const formattedTime = receiptDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Check if this receipt has debt
            const receiptDebt = supplierDebts.find((debt) =>
              debt.description?.includes(receipt.receiptCode)
            );

            const paidAmount = receiptDebt
              ? receiptDebt.totalAmount - receiptDebt.remainingAmount
              : receipt.total;
            const remainingDebt = receiptDebt?.remainingAmount || 0;
            const hasDebt = remainingDebt > 0;

            // Unique key combining receiptCode with index to handle duplicates
            const uniqueKey = `${receipt.receiptCode}-${index}`;

            return (
              <div
                key={uniqueKey}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                {/* Mobile Card */}
                <div className="md:hidden flex flex-col gap-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-300">
                        📦 {receipt.receiptCode}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        📅{" "}
                        <span>
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Tổng tiền
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(receipt.total)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-200 font-semibold text-lg">
                      🏢
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">
                        {receipt.supplier}
                      </div>
                      {receipt.items[0].notes?.includes("Phone:") && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          📞 {receipt.items[0].notes.split("Phone:")[1]?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const isExpanded = expandedReceipts.has(
                        receipt.receiptCode
                      );
                      const maxItems = 3;
                      const displayItems = isExpanded
                        ? receipt.items
                        : receipt.items.slice(0, maxItems);
                      const hasMore = receipt.items.length > maxItems;

                      return (
                        <>
                          {displayItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between text-sm text-slate-700 dark:text-slate-200"
                            >
                              <div>
                                <span className="font-semibold">
                                  {item.quantity} x {item.partName}
                                </span>
                                <div className="text-xs text-slate-400">
                                  {formatCurrency(item.unitPrice || 0)} / sản
                                  phẩm
                                </div>
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCurrency(
                                  item.quantity * (item.unitPrice || 0)
                                )}
                              </span>
                            </div>
                          ))}
                          {hasMore && (
                            <button
                              onClick={() => toggleExpand(receipt.receiptCode)}
                              className="w-full text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 flex items-center justify-center gap-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                            >
                              {isExpanded ? (
                                <>
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
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                  Thu gọn
                                </>
                              ) : (
                                <>
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
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  Xem thêm ({receipt.items.length - maxItems}{" "}
                                  sản phẩm)
                                </>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasDebt ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200">
                        ⚠️ Còn nợ {formatCurrency(remainingDebt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200">
                        ✓ Đã thanh toán
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() =>
                        setEditingReceipt({
                          ...receipt,
                          date: new Date(receipt.date),
                        })
                      }
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                    >
                      Chỉnh sửa
                    </button>
                  </div>
                </div>

                {/* Desktop Grid */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-start">
                  {/* Checkbox */}
                  <div className="col-span-1 flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedReceipts.has(receipt.receiptCode)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedReceipts);
                        if (e.target.checked) {
                          newSelected.add(receipt.receiptCode);
                        } else {
                          newSelected.delete(receipt.receiptCode);
                        }
                        setSelectedReceipts(newSelected);
                      }}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </div>

                  {/* Cột 1: Mã Phiếu + Thông tin */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                        {receipt.receiptCode}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formattedDate} {formattedTime}
                      </div>
                      {receipt.items[0].notes?.includes("NV:") && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-medium">NV:</span>{" "}
                          {receipt.items[0].notes
                            ?.split("NV:")[1]
                            ?.split("NCC:")[0]
                            ?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 2: Nhà cung cấp */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {receipt.supplier}
                      </div>
                      {receipt.items[0].notes?.includes("Phone:") && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          📞 {receipt.items[0].notes.split("Phone:")[1]?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 3: Chi tiết sản phẩm */}
                  <div className="col-span-4">
                    <div className="space-y-1">
                      {(() => {
                        const isExpanded = expandedReceipts.has(
                          receipt.receiptCode
                        );
                        const maxItems = 3;
                        const displayItems = isExpanded
                          ? receipt.items
                          : receipt.items.slice(0, maxItems);
                        const hasMore = receipt.items.length > maxItems;

                        return (
                          <>
                            {displayItems.map((item, idx) => (
                              <div
                                key={item.id}
                                className="text-xs text-slate-700 dark:text-slate-300"
                              >
                                <span className="font-medium">
                                  {item.quantity} x
                                </span>{" "}
                                {item.partName}
                                <span className="text-slate-400 ml-1">
                                  ({formatCurrency(item.unitPrice || 0)})
                                </span>
                              </div>
                            ))}
                            {hasMore && (
                              <button
                                onClick={() =>
                                  toggleExpand(receipt.receiptCode)
                                }
                                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium mt-1 flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>
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
                                        d="M5 15l7-7 7 7"
                                      />
                                    </svg>
                                    Thu gọn
                                  </>
                                ) : (
                                  <>
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
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                    Xem thêm ({receipt.items.length - maxItems}{" "}
                                    sản phẩm)
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Cột 4: Thanh toán */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Tổng tiền:
                      </div>
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {formatCurrency(receipt.total)}
                      </div>

                      {/* Payment details */}
                      {hasDebt ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-green-600 dark:text-green-400">
                            Đã trả: {formatCurrency(paidAmount)}
                          </div>
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            Còn nợ: {formatCurrency(remainingDebt)}
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            ⚠️ Còn nợ
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            ✓ Đã thanh toán
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 5: Thao tác */}
                  <div className="col-span-1">
                    <button
                      onClick={() =>
                        setEditingReceipt({
                          ...receipt,
                          date: new Date(receipt.date),
                        })
                      }
                      className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                      title="Chỉnh sửa"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - if needed */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Hiển thị {groupedReceipts.length} phiếu nhập
        </div>
      </div>

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSave={async (updatedData) => {
            try {
              // Track original item IDs to detect deletions
              const originalItemIds = new Set(
                editingReceipt.items.map((i) => i.id)
              );
              const updatedItemIds = new Set(
                updatedData.items
                  .filter((i: any) => !i.id.startsWith("new-"))
                  .map((i: any) => i.id)
              );

              // 1. Handle DELETED items - rollback stock
              const deletedItemIds = Array.from(originalItemIds).filter(
                (id) => !updatedItemIds.has(id)
              );

              for (const deletedId of deletedItemIds) {
                const deletedItem = editingReceipt.items.find(
                  (i) => i.id === deletedId
                );
                if (!deletedItem) continue;

                // Get part info
                const { data: part, error: fetchError } = await supabase
                  .from("parts")
                  .select("stock")
                  .eq("id", deletedItem.partId)
                  .single();

                if (fetchError) {
                  throw new Error(
                    `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                  );
                }

                if (part) {
                  const currentStock = part.stock?.[currentBranchId] || 0;
                  const newStock = currentStock - deletedItem.quantity;

                  if (newStock < 0) {
                    throw new Error(
                      `Không thể xóa sản phẩm "${deletedItem.partName}" vì sẽ làm tồn kho âm`
                    );
                  }

                  // Update stock
                  const { error: updateError } = await supabase
                    .from("parts")
                    .update({
                      stock: {
                        ...part.stock,
                        [currentBranchId]: newStock,
                      },
                    })
                    .eq("id", deletedItem.partId);

                  if (updateError) {
                    throw new Error(
                      `Không thể cập nhật tồn kho: ${updateError.message}`
                    );
                  }
                }

                // Delete transaction
                const { error: deleteError } = await supabase
                  .from("inventory_transactions")
                  .delete()
                  .eq("id", deletedId);

                if (deleteError) {
                  throw new Error(
                    `Không thể xóa giao dịch: ${deleteError.message}`
                  );
                }
              }

              // 2. Handle UPDATED items - update transaction and adjust stock
              for (const item of updatedData.items) {
                if (item.id.startsWith("new-")) continue; // Skip new items for now

                const originalItem = editingReceipt.items.find(
                  (i) => i.id === item.id
                );

                // Update the transaction record
                const { error } = await supabase
                  .from("inventory_transactions")
                  .update({
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    notes: `NV:${
                      updatedData.items[0].notes
                        ?.split("NV:")[1]
                        ?.split("NCC:")[0]
                        ?.trim() ||
                      profile?.name ||
                      profile?.full_name ||
                      "Nhân viên"
                    } NCC:${updatedData.supplier}${
                      updatedData.supplierPhone
                        ? ` Phone:${updatedData.supplierPhone}`
                        : ""
                    }`,
                  })
                  .eq("id", item.id);

                if (error) throw error;

                // If quantity changed, update parts.stock
                if (originalItem && originalItem.quantity !== item.quantity) {
                  const quantityDiff = item.quantity - originalItem.quantity;

                  // Get the part to update its stock
                  const { data: part, error: fetchError } = await supabase
                    .from("parts")
                    .select("stock, id")
                    .eq("id", originalItem.partId)
                    .single();

                  if (fetchError) {
                    throw new Error(
                      `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                    );
                  }

                  if (part) {
                    const currentStock = part.stock?.[currentBranchId] || 0;
                    const newStock = currentStock + quantityDiff;

                    if (newStock < 0) {
                      throw new Error(
                        `Không thể giảm số lượng vì sẽ làm tồn kho âm (hiện có: ${currentStock})`
                      );
                    }

                    // Update stock in database
                    const { error: updateError } = await supabase
                      .from("parts")
                      .update({
                        stock: {
                          ...part.stock,
                          [currentBranchId]: newStock,
                        },
                      })
                      .eq("id", part.id);

                    if (updateError) {
                      throw new Error(
                        `Không thể cập nhật tồn kho: ${updateError.message}`
                      );
                    }
                  }
                }
              }

              // 3. Handle NEW items - create transaction and add stock
              const newItems = updatedData.items.filter((i: any) =>
                i.id.startsWith("new-")
              );

              for (const newItem of newItems) {
                // Get part info
                const { data: part, error: fetchError } = await supabase
                  .from("parts")
                  .select("stock, id")
                  .eq("id", newItem.partId)
                  .single();

                if (fetchError) {
                  throw new Error(
                    `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                  );
                }

                if (part) {
                  const currentStock = part.stock?.[currentBranchId] || 0;
                  const newStock = currentStock + newItem.quantity;

                  // Update stock
                  const { error: updateError } = await supabase
                    .from("parts")
                    .update({
                      stock: {
                        ...part.stock,
                        [currentBranchId]: newStock,
                      },
                    })
                    .eq("id", part.id);

                  if (updateError) {
                    throw new Error(
                      `Không thể cập nhật tồn kho: ${updateError.message}`
                    );
                  }
                }

                // Create new transaction
                const { error: insertError } = await supabase
                  .from("inventory_transactions")
                  .insert({
                    type: "Nhập kho",
                    partId: newItem.partId,
                    partName: newItem.partName,
                    quantity: newItem.quantity,
                    date: editingReceipt.date.toISOString(),
                    unitPrice: newItem.unitPrice,
                    totalPrice: newItem.totalPrice,
                    branchId: currentBranchId,
                    notes: `NV:${
                      updatedData.items[0].notes
                        ?.split("NV:")[1]
                        ?.split("NCC:")[0]
                        ?.trim() ||
                      profile?.name ||
                      profile?.full_name ||
                      "Nhân viên"
                    } NCC:${updatedData.supplier}${
                      updatedData.supplierPhone
                        ? ` Phone:${updatedData.supplierPhone}`
                        : ""
                    }`,
                  });

                if (insertError) {
                  throw new Error(
                    `Không thể tạo giao dịch mới: ${insertError.message}`
                  );
                }
              }

              showToast.success(
                `Đã cập nhật phiếu nhập kho (${updatedData.items.length} sản phẩm)`
              );
              queryClient.invalidateQueries({
                queryKey: ["inventoryTransactions"],
              });
              queryClient.invalidateQueries({
                queryKey: ["partsRepo"],
              });
              queryClient.invalidateQueries({
                queryKey: ["partsRepoPaged"],
              });
              setEditingReceipt(null);
            } catch (err: any) {
              showToast.error(`Lỗi cập nhật: ${err.message || "Không rõ"}`);
            }
          }}
          currentBranchId={currentBranchId}
        />
      )}

      {/* Confirm Modal for delete */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
      />
    </div>
  );
};

// Inventory History Modal Component (Ảnh 3)
const InventoryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  transactions: InventoryTransaction[];
}> = ({ isOpen, onClose, transactions }) => {
  const queryClient = useQueryClient();
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = useMemo(() => {
    // CHỈ LẤY GIAO DỊCH NHẬP KHO
    let filtered = transactions.filter((t) => t.type === "Nhập kho");
    const now = new Date();

    // Apply time filter
    switch (activeTimeFilter) {
      case "7days":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= sevenDaysAgo);
        break;
      case "30days":
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000
        );
        filtered = filtered.filter((t) => new Date(t.date) >= thirtyDaysAgo);
        break;
      case "thisMonth":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
        break;
      case "custom":
        filtered = filtered.filter((t) => {
          const date = new Date(t.date);
          return (
            date >= new Date(customStartDate) && date <= new Date(customEndDate)
          );
        });
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.partName.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    transactions,
    activeTimeFilter,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.totalPrice, 0);
  }, [filteredTransactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Lịch sử nhập kho
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          {/* Time Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: "7days", label: "7 ngày qua" },
              { key: "30days", label: "30 ngày qua" },
              { key: "thisMonth", label: "Tháng này" },
              { key: "custom", label: "Tùy chọn" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTimeFilter === filter.key
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {activeTimeFilter === "custom" && (
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Nhà cung cấp, SKU, tên phụ tùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Tổng số phiếu:{" "}
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {filteredTransactions.length}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Tổng giá trị
              </div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ngày
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nhà cung cấp
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nội dung
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {formatDate(new Date(transaction.date), false)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(transaction.date).toLocaleTimeString(
                          "vi-VN",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {transaction.notes && transaction.notes.includes("NCC:")
                          ? transaction.notes.split("NCC:")[1]?.trim() ||
                            "Chưa rõ"
                          : "Chưa rõ"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {transaction.partName}
                      </div>
                      <div className="text-xs text-slate-500">
                        SL: {transaction.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(transaction.totalPrice)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            // TODO: Implement edit functionality
                            showToast.info("Tính năng đang phát triển");
                          }}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
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
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Bạn có chắc muốn xóa giao dịch nhập "${transaction.partName}"?`
                            );
                            if (confirmed) {
                              try {
                                const { error } = await supabase
                                  .from("inventory_transactions")
                                  .delete()
                                  .eq("id", transaction.id);

                                if (error) throw error;

                                showToast.success("Đã xóa giao dịch");
                                queryClient.invalidateQueries({
                                  queryKey: ["inventoryTransactions"],
                                });
                              } catch (err: any) {
                                showToast.error(
                                  `Lỗi xóa: ${err.message || "Không rõ"}`
                                );
                              }
                            }
                          }}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          title="Xóa"
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
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Hiển thị {filteredTransactions.length} kết quả
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Inventory Manager Component (Ảnh 1)
const InventoryManager: React.FC = () => {
  const { currentBranchId } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  // Supabase repository mutation for inventory transactions
  const { mutateAsync: createInventoryTxAsync } = useCreateInventoryTxRepo();
  const createReceiptAtomicMutation = useCreateReceiptAtomicRepo();
  const { data: invTx = [] } = useInventoryTxRepo({
    branchId: currentBranchId,
  });
  const [activeTab, setActiveTab] = useState("stock"); // stock, categories, lookup, history
  const [showGoodsReceipt, setShowGoodsReceipt] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [mobileMenuOpenIndex, setMobileMenuOpenIndex] = useState<number | null>(
    null
  );
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openActionRow, setOpenActionRow] = useState<string | null>(null);
  const [inventoryDropdownPos, setInventoryDropdownPos] = useState({
    top: 0,
    right: 0,
  });

  // Generate a color from category string for placeholder avatar
  const getAvatarColor = (name: string) => {
    if (!name) return "#94a3b8"; // slate-400
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return `#${"00000".substring(0, 6 - c.length) + c}`;
  };

  // Confirm dialog hook
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  // Read stock filter from URL query params (e.g., ?stock=low-stock)
  useEffect(() => {
    const stockParam = searchParams.get("stock");
    if (
      stockParam &&
      ["all", "in-stock", "low-stock", "out-of-stock"].includes(stockParam)
    ) {
      setStockFilter(stockParam);
      // Clear the query param after applying to avoid re-applying on navigation
      searchParams.delete("stock");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const {
    data: pagedResult,
    isLoading: partsLoading,
    isError: partsError,
  } = usePartsRepoPaged({
    page,
    pageSize,
    search,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });
  const repoParts = pagedResult?.data || [];
  const totalParts = pagedResult?.meta?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalParts / pageSize));

  // Fetch ALL parts for accurate totals calculation (stock, costPrice, retailPrice)
  const { data: allPartsData, refetch: refetchAllParts } = useQuery({
    queryKey: ["allPartsForTotals", currentBranchId, search, categoryFilter],
    queryFn: async () => {
      console.log("🔄 Fetching allPartsForTotals...");
      let query = supabase
        .from("parts")
        .select("id, name, sku, category, stock, costPrice, retailPrice")
        .order("name");

      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }
      if (search && search.trim()) {
        const term = search.trim();
        // Tìm kiếm theo tên, SKU và danh mục
        query = query.or(
          `name.ilike.%${term}%,sku.ilike.%${term}%,category.ilike.%${term}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      console.log(`✅ Fetched ${data?.length || 0} parts`);
      return data || [];
    },
    staleTime: 5_000, // Reduced from 30s to 5s for faster updates
  });

  const stockHealth = useMemo(() => {
    if (!allPartsData) {
      return {
        totalProducts: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
      };
    }

    const summary = {
      totalProducts: allPartsData.length,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
    };

    const branchKey = currentBranchId || "";

    allPartsData.forEach((part) => {
      const qty = part.stock?.[branchKey] || 0;
      if (qty > 0) summary.inStock += 1;
      if (qty === 0) summary.outOfStock += 1;
      if (qty > 0 && qty <= LOW_STOCK_THRESHOLD) summary.lowStock += 1;
    });

    return summary;
  }, [allPartsData, currentBranchId]);

  const stockQuickFilters = useMemo(
    () => [
      {
        id: "all",
        label: "Tất cả",
        description: "Toàn bộ kho",
        count: stockHealth.totalProducts,
        variant: "neutral" as const,
      },
      {
        id: "in-stock",
        label: "Còn hàng",
        description: "> 0",
        count: stockHealth.inStock,
        variant: "success" as const,
      },
      {
        id: "low-stock",
        label: "Sắp hết",
        description: `<= ${LOW_STOCK_THRESHOLD}`,
        count: stockHealth.lowStock,
        variant: "warning" as const,
      },
      {
        id: "out-of-stock",
        label: "Hết hàng",
        description: "= 0",
        count: stockHealth.outOfStock,
        variant: "danger" as const,
      },
    ],
    [stockHealth]
  );
  // Detect duplicate product SKUs (mã sản phẩm)
  const duplicateSkus = useMemo(() => {
    if (!allPartsData) return new Set<string>();
    const skuCount = new Map<string, number>();
    allPartsData.forEach((part: any) => {
      if (!part.sku) return; // Bỏ qua sản phẩm không có SKU
      const count = skuCount.get(part.sku) || 0;
      skuCount.set(part.sku, count + 1);
    });
    const duplicates = new Set(
      Array.from(skuCount.entries())
        .filter(([_, count]) => count > 1)
        .map(([sku, _]) => sku)
    );
    console.log(
      `🔍 Detected ${duplicates.size} duplicate product SKUs from ${allPartsData.length} parts`
    );
    if (duplicates.size > 0) {
      console.log("Duplicate SKUs:", Array.from(duplicates).slice(0, 5));
    }
    return duplicates;
  }, [allPartsData]);

  // Check if a part has duplicate SKU
  const hasDuplicateSku = useCallback(
    (partSku: string) => {
      return duplicateSkus.has(partSku);
    },
    [duplicateSkus]
  );

  // Fetch duplicate parts when filter is enabled
  const { data: duplicatePartsData } = useQuery({
    queryKey: ["duplicateParts", currentBranchId, Array.from(duplicateSkus)],
    queryFn: async () => {
      if (duplicateSkus.size === 0) return [];

      console.log(
        `🔍 Fetching all duplicate parts for ${duplicateSkus.size} SKUs...`
      );

      // Fetch all parts with duplicate SKUs
      const { data, error } = await supabase
        .from("parts")
        .select("*")
        .in("sku", Array.from(duplicateSkus))
        .order("sku");

      if (error) throw error;
      console.log(`✅ Found ${data?.length || 0} parts with duplicate SKUs`);
      return data || [];
    },
    enabled: showDuplicatesOnly && duplicateSkus.size > 0,
    staleTime: 5_000,
  });

  // Sau khi chuyển sang server filter, filteredParts = repoParts (có thể thêm client filter tồn kho nếu cần)
  const filteredParts = useMemo(() => {
    let baseList =
      showDuplicatesOnly && duplicateSkus.size > 0
        ? duplicatePartsData || []
        : repoParts;

    // Client-side multi-keyword search refinement
    // Khi người dùng nhập nhiều từ, filter thêm để chỉ hiện sản phẩm có TẤT CẢ các từ
    if (search && search.trim()) {
      const keywords = search.trim().toLowerCase().split(/\s+/);
      if (keywords.length > 1) {
        baseList = baseList.filter((part: any) => {
          const searchText = `${part.name || ""} ${part.sku || ""} ${
            part.category || ""
          } ${part.description || ""}`.toLowerCase();
          return keywords.every((keyword) => searchText.includes(keyword));
        });
      }
    }

    // Stock filter
    if (stockFilter === "all") {
      return baseList;
    }

    const branchKey = currentBranchId || "";

    return baseList.filter((part: any) => {
      const qty = part.stock?.[branchKey] || 0;
      if (stockFilter === "in-stock") return qty > 0;
      if (stockFilter === "low-stock")
        return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
      if (stockFilter === "out-of-stock") return qty === 0;
      return true;
    });
  }, [
    repoParts,
    showDuplicatesOnly,
    duplicateSkus,
    duplicatePartsData,
    stockFilter,
    currentBranchId,
    search,
  ]);

  // Auto-disable duplicate filter when no duplicates remain
  useEffect(() => {
    if (showDuplicatesOnly && duplicateSkus.size === 0) {
      setShowDuplicatesOnly(false);
    }
  }, [showDuplicatesOnly, duplicateSkus.size]);

  const totalStockQuantity = useMemo(() => {
    if (!allPartsData) return 0;
    return allPartsData.reduce((sum, part: any) => {
      return sum + (part.stock?.[currentBranchId] || 0);
    }, 0);
  }, [allPartsData, currentBranchId]);

  const totalStockValue = useMemo(() => {
    if (!allPartsData) return 0;
    return allPartsData.reduce((sum, part: any) => {
      const stock = part.stock?.[currentBranchId] || 0;
      const costPrice = part.costPrice?.[currentBranchId] || 0;
      return sum + stock * costPrice;
    }, 0);
  }, [allPartsData, currentBranchId]);

  const queryClient = useQueryClient();
  const updatePartMutation = useUpdatePartRepo();
  const createPartMutation = useCreatePartRepo();
  const deletePartMutation = useDeletePartRepo();
  const { data: allCategories = [] } = useCategories();

  const { profile } = useAuth();
  const handleSaveGoodsReceipt = useCallback(
    async (
      items: Array<{
        partId: string;
        partName: string;
        quantity: number;
        importPrice: number;
        sellingPrice: number;
        wholesalePrice?: number;
        _isNewProduct?: boolean;
        _productData?: {
          name: string;
          sku: string;
          barcode: string;
          category: string;
          description: string;
          importPrice: number;
          retailPrice: number;
          wholesalePrice: number;
        };
      }>,
      supplierId: string,
      totalAmount: number,
      note: string,
      paymentInfo?: {
        paymentMethod: "cash" | "bank";
        paymentType: "full" | "partial" | "note";
        paidAmount: number;
        discount: number;
      }
    ) => {
      // Generate receipt code: NH-YYYYMMDD-XXX
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const receiptCode = `NH-${dateStr}-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

      console.log("📦 Saving goods receipt:", {
        receiptCode,
        supplierId,
        totalAmount,
        paymentInfo,
        itemCount: items.length,
      });

      // Get supplier name
      const { data: suppliers } = await supabase
        .from("suppliers")
        .select("name")
        .eq("id", supplierId)
        .single();
      const supplierName = suppliers?.name || "Không xác định";

      // Calculate debt amount
      const paidAmount = paymentInfo?.paidAmount || 0;
      const debtAmount = totalAmount - paidAmount;

      console.log("💰 Payment calculation:", {
        totalAmount,
        paidAmount,
        debtAmount,
        paymentType: paymentInfo?.paymentType,
        paymentMethod: paymentInfo?.paymentMethod,
        willCreateDebt: debtAmount > 0,
      });

      // ⚠️ IMPORTANT: Stock is now auto-updated by trigger (trg_inventory_tx_after_insert)
      // We only need to:
      // 1. Create new products if any (for temp items)
      // 2. Create inventory_transaction (trigger will update stock)
      // 3. Update prices (retailPrice, wholesalePrice) - not handled by trigger
      // 4. Create supplier debt if needed

      try {
        // First, create any new products that were added temporarily
        const processedItems = await Promise.all(
          items.map(async (item) => {
            if (item._isNewProduct && item._productData) {
              console.log("🆕 Đang tạo sản phẩm mới:", item._productData.name);

              // Create the new product in DB
              try {
                const createdPart = await createPartMutation.mutateAsync({
                  name: item._productData.name,
                  sku: item._productData.sku,
                  barcode: item._productData.barcode || "",
                  category: item._productData.category,
                  description: item._productData.description || "",
                  stock: { [currentBranchId]: 0 }, // Stock = 0, sẽ cập nhật khi hoàn tất phiếu nhập
                  costPrice: {
                    [currentBranchId]: item._productData.importPrice,
                  },
                  retailPrice: {
                    [currentBranchId]: item._productData.retailPrice,
                  },
                  wholesalePrice: {
                    [currentBranchId]:
                      item._productData.wholesalePrice ||
                      Math.round(item._productData.retailPrice * 0.9),
                  },
                });

                // mutateAsync now returns Part directly (unwrapped)
                const realPartId = createdPart?.id;

                if (!realPartId || realPartId.startsWith("temp-")) {
                  console.error(
                    "❌ Không lấy được ID thật sau khi tạo sản phẩm:",
                    createdPart
                  );
                  throw new Error(
                    `Không thể tạo sản phẩm ${item._productData.name}`
                  );
                }

                console.log(
                  `✅ Đã tạo sản phẩm: ${item._productData.name} với ID: ${realPartId}`
                );

                return {
                  partId: realPartId,
                  partName: item.partName,
                  quantity: item.quantity,
                  importPrice: item.importPrice,
                  sellingPrice: item.sellingPrice,
                  wholesalePrice: item.wholesalePrice || 0,
                };
              } catch (error) {
                console.error("❌ Lỗi khi tạo sản phẩm:", error);
                throw new Error(
                  `Không thể tạo sản phẩm ${item._productData.name}: ${error}`
                );
              }
            }
            // Existing product, return as-is
            return {
              partId: item.partId,
              partName: item.partName,
              quantity: item.quantity,
              importPrice: item.importPrice,
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice || 0,
            };
          })
        );

        // Use atomic RPC for receipt creation and stock update
        console.log("📦 Profile data:", {
          id: profile?.id,
          name: profile?.name,
          full_name: profile?.full_name,
          email: profile?.email,
        });
        await createReceiptAtomicMutation.mutateAsync({
          items: processedItems,
          supplierId,
          branchId: currentBranchId,
          userId: profile?.id || "unknown",
          notes: `${receiptCode} | NV:${
            profile?.name || profile?.full_name || "Nhân viên"
          } NCC:${supplierName}${note ? " | " + note : ""}`,
        });

        // 💰 Ghi chi tiền vào sổ quỹ nếu có thanh toán (paidAmount > 0)
        if (paidAmount > 0 && paymentInfo) {
          const paymentSourceId =
            paymentInfo.paymentMethod === "bank" ? "bank" : "cash";
          const cashTxResult = await createCashTransaction({
            type: "expense",
            amount: paidAmount,
            branchId: currentBranchId,
            paymentSourceId: paymentSourceId,
            date: today.toISOString(),
            notes: `Chi trả NCC ${supplierName} - Phiếu nhập ${receiptCode}`,
            category: "supplier_payment",
            supplierId: supplierId,
            recipient: supplierName,
          });

          if (cashTxResult.ok) {
            console.log(
              `✅ Đã ghi chi tiền ${paidAmount.toLocaleString()} đ vào sổ quỹ (${paymentSourceId})`
            );
          } else {
            console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
            showToast.warning(
              `Nhập kho OK nhưng chưa ghi được sổ quỹ: ${cashTxResult.error?.message}`
            );
          }
        }

        // Create supplier debt if payment is partial or deferred
        if (debtAmount > 0 && paymentInfo) {
          const debtId = `DEBT-${dateStr}-${Math.random()
            .toString(36)
            .substring(2, 5)
            .toUpperCase()}`;
          const { error: debtError } = await supabase
            .from("supplier_debts")
            .insert({
              id: debtId,
              supplier_id: supplierId,
              supplier_name: supplierName,
              branch_id: currentBranchId,
              total_amount: debtAmount,
              paid_amount: 0,
              remaining_amount: debtAmount,
              description: `Nhập kho ${receiptCode} - Thanh toán ${paidAmount.toLocaleString()}/${totalAmount.toLocaleString()} đ`,
              created_date: today.toISOString().split("T")[0],
              created_at: today.toISOString(),
            });

          if (debtError) {
            console.error("❌ Error creating debt:", debtError);
            showToast.error("Lỗi tạo công nợ: " + debtError.message);
          } else {
            console.log(
              `✅ Created supplier debt: ${debtAmount.toLocaleString()} đ`
            );
          }
        }

        setShowGoodsReceipt(false);
        showToast.success(`Nhập kho thành công! Mã phiếu: ${receiptCode}`);

        // High-level audit of goods receipt batch
        void safeAudit(profile?.id || null, {
          action: "inventory.receipt",
          tableName: "inventory_transactions",
          oldData: null,
          newData: {
            receiptCode,
            supplierId,
            supplierName,
            items: items.map((i) => ({
              partId: i.partId,
              quantity: i.quantity,
              importPrice: i.importPrice,
              sellingPrice: i.sellingPrice,
            })),
            totalAmount,
            paidAmount,
            debtAmount,
            paymentInfo,
          },
        });
      } catch (err: any) {
        console.error("🛑 Lỗi lưu phiếu nhập kho:", err);
        showToast.error(`Lỗi: ${err.message || "Không rõ"}`);
      }
    },
    [
      allPartsData,
      currentBranchId,
      updatePartMutation,
      createPartMutation,
      createInventoryTxAsync,
      createReceiptAtomicMutation,
      profile?.id,
    ]
  );

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredParts.map((p) => p.id));
    } else {
      setSelectedItems([]);
    }
  };

  // Handle select item
  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems([...selectedItems, id]);
    } else {
      setSelectedItems(selectedItems.filter((i) => i !== id));
    }
  };

  // Handle delete single item
  const handleDeleteItem = async (id: string) => {
    const part = repoParts.find((p) => p.id === id);
    if (!part) return;

    const confirmed = await confirm({
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${part.name}"?`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    deletePartMutation.mutate(
      { id },
      {
        onSuccess: async () => {
          // Remove from selected items if it was selected
          setSelectedItems((prev) => prev.filter((i) => i !== id));
          // Force refetch to update duplicate detection immediately
          await refetchAllParts();
          console.log("🔄 Refetched allPartsForTotals after delete");
          showToast.success(`Đã xóa phụ tùng "${part.name}"`);
        },
        onError: (error) => {
          console.error("Delete error:", error);
          showToast.error(`Không thể xóa: ${error.message}`);
        },
      }
    );
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) {
      showToast.warning("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    const confirmed = await confirm({
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa ${selectedItems.length} sản phẩm đã chọn? Hành động này không thể hoàn tác.`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    // Track progress for bulk delete
    let successCount = 0;
    let errorCount = 0;
    const totalCount = selectedItems.length;

    // Delete all selected items
    selectedItems.forEach((id, index) => {
      deletePartMutation.mutate(
        { id },
        {
          onSuccess: async () => {
            successCount++;
            // Show toast only after last item
            if (successCount + errorCount === totalCount) {
              // Force refetch to update duplicate detection immediately
              await refetchAllParts();
              console.log("🔄 Refetched allPartsForTotals after bulk delete");
              if (errorCount === 0) {
                showToast.success(`Đã xóa ${successCount} phụ tùng`);
              } else {
                showToast.warning(
                  `Đã xóa ${successCount}/${totalCount} phụ tùng (${errorCount} lỗi)`
                );
              }
            }
          },
          onError: (error) => {
            console.error(`Delete error for item ${id}:`, error);
            errorCount++;
            // Show toast only after last item
            if (successCount + errorCount === totalCount) {
              if (successCount === 0) {
                showToast.error(`Không thể xóa ${totalCount} phụ tùng`);
              } else {
                showToast.warning(
                  `Đã xóa ${successCount}/${totalCount} phụ tùng (${errorCount} lỗi)`
                );
              }
            }
          },
        }
      );
    });

    setSelectedItems([]);
  };

  const handleStockFilterChange = (value: string) => {
    setPage(1);
    setStockFilter(value);
  };

  const handleCategoryFilterChange = (value: string) => {
    setPage(1);
    setCategoryFilter(value);
  };

  const resetFilters = () => {
    setStockFilter("all");
    setCategoryFilter("all");
    setShowDuplicatesOnly(false);
    setPage(1);
    setShowAdvancedFilters(false);
  };

  const advancedFiltersActive =
    stockFilter !== "all" || categoryFilter !== "all" || showDuplicatesOnly;

  const shouldShowLowStockBanner =
    stockHealth.lowStock > 0 && stockFilter !== "low-stock";

  const lowStockPercent =
    stockHealth.totalProducts > 0
      ? Math.round((stockHealth.lowStock / stockHealth.totalProducts) * 100)
      : 0;

  // Handle export to Excel
  const handleExportExcel = () => {
    try {
      const now = new Date();
      const filename = `ton-kho-${now.getDate()}-${
        now.getMonth() + 1
      }-${now.getFullYear()}.xlsx`;
      exportPartsToExcel(repoParts, currentBranchId, filename);
      showToast.success("Xuất file Excel thành công!");
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất file Excel");
    }
  };

  // Handle download template
  const handleDownloadTemplate = () => {
    try {
      exportInventoryTemplate();
      showToast.success(
        "Tải template thành công! Vui lòng điền thông tin và import lại."
      );
    } catch (error) {
      console.error("Template download error:", error);
      showToast.error("Có lỗi khi tải template");
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentClick = () => setOpenActionRow(null);
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 sm:bg-[#1e293b]">
      {/* Desktop Header - Compact */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-1.5">
        <div className="flex items-center justify-between gap-3">
          {/* Tabs - Compact */}
          <div className="flex gap-1">
            {[
              {
                key: "stock",
                label: "Tồn kho",
                icon: <Boxes className="w-3.5 h-3.5" />,
              },
              {
                key: "categories",
                label: "Danh mục",
                icon: <Package className="w-3.5 h-3.5" />,
              },
              {
                key: "lookup",
                label: "Tra cứu",
                icon: <Search className="w-3.5 h-3.5" />,
              },
              {
                key: "history",
                label: "Lịch sử",
                icon: <FileText className="w-3.5 h-3.5" />,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-700"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Action Buttons - Compact */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBatchPrintModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition"
              title="In mã vạch hàng loạt"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              In mã vạch
            </button>
            {canDo(profile?.role, "inventory.import") && (
              <button
                onClick={() => setShowGoodsReceipt(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo phiếu nhập
              </button>
            )}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 px-1 py-0.5">
              {canDo(profile?.role, "inventory.import") && (
                <button
                  onClick={() => {
                    showToast.info("Tính năng chuyển kho đang phát triển");
                  }}
                  className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:bg-slate-800 transition"
                  title="Chuyển kho"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-white dark:bg-slate-800 transition"
                title="Xuất Excel"
              >
                <UploadCloud className="w-3.5 h-3.5" />
              </button>
              {canDo(profile?.role, "inventory.import") && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:bg-slate-800 transition"
                    title="Nhập CSV"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-white dark:bg-slate-800 transition"
                    title="Tải mẫu import"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Compact & Clean */}
      <div className="sm:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-3">
        {/* Search and Create Button Row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, SKU, danh mục..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Create Button */}
          {canDo(profile?.role, "inventory.import") && (
            <button
              onClick={() => setShowGoodsReceipt(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tạo phiếu
            </button>
          )}
        </div>

        {/* Inline Stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">Tổng:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {totalStockQuantity.toLocaleString()} sp
              </span>
            </div>
            <div className="h-3 w-px bg-slate-300 dark:bg-slate-600"></div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">
                Giá trị:
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(totalStockValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Filters - Compact for small screens */}
      {activeTab === "stock" && (
        <div className="hidden sm:block bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
          <div className="space-y-2">
            {/* Row 1: Stats inline + Search */}
            <div className="flex items-center gap-3">
              {/* Compact Stats */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <Boxes className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {totalStockQuantity.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-300 ml-1">
                      sp
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(totalStockValue)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, SKU hoặc danh mục..."
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  className="w-full pl-9 pr-16 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 dark:text-slate-300">
                  {filteredParts.length}/{totalParts}
                </span>
              </div>
              {/* Filter button */}
              <button
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex-shrink-0 ${
                  showAdvancedFilters
                    ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Bộ lọc nâng cao
              </button>
            </div>

            {/* Row 2: Quick filters as horizontal pills + Low stock warning inline */}
            <div className="flex items-center gap-2 flex-wrap">
              {stockQuickFilters.map((filter) => {
                const isActive = stockFilter === filter.id;
                const colorMap: Record<string, string> = {
                  neutral: isActive
                    ? "bg-slate-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
                  success: isActive
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100",
                  warning: isActive
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100",
                  danger: isActive
                    ? "bg-red-600 text-white"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100",
                };
                return (
                  <button
                    key={filter.id}
                    onClick={() => handleStockFilterChange(filter.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${
                      colorMap[filter.variant || "neutral"]
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20"
                          : "bg-black/10 dark:bg-white/10"
                      }`}
                    >
                      {filter.count}
                    </span>
                  </button>
                );
              })}

              {/* Low stock warning inline */}
              {shouldShowLowStockBanner && (
                <div className="ml-auto flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <span className="text-xs">
                    ⚠️ {stockHealth.lowStock} sắp hết
                  </span>
                  <button
                    onClick={() => handleStockFilterChange("low-stock")}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Lọc
                  </button>
                </div>
              )}
            </div>

            {showAdvancedFilters && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Trạng thái tồn kho
                  </label>
                  <select
                    value={stockFilter}
                    onChange={(e) => handleStockFilterChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">Tất cả tồn kho</option>
                    <option value="in-stock">Còn hàng</option>
                    <option value="low-stock">Sắp hết</option>
                    <option value="out-of-stock">Hết hàng</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Danh mục
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => handleCategoryFilterChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {allCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Phát hiện trùng mã
                  </label>
                  <button
                    onClick={() => setShowDuplicatesOnly((prev) => !prev)}
                    className={`mt-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      showDuplicatesOnly
                        ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                        : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    {showDuplicatesOnly ? "Đang lọc trùng mã" : "Lọc trùng mã"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3">
        {activeTab === "stock" && (
          <div className="space-y-2">
            {/* Duplicate Warning Banner - More compact */}
            {duplicateSkus.size > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 px-3 py-2 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                    Phát hiện {duplicateSkus.size} sản phẩm trùng mã
                  </span>
                </div>
                <button
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    showDuplicatesOnly
                      ? "bg-orange-600 text-white"
                      : "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300"
                  }`}
                >
                  {showDuplicatesOnly ? "✓ Đang lọc" : "🔍 Lọc"}
                </button>
              </div>
            )}

            {/* Stock Table + Pagination */}
            <div className="rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              {/* Bulk Actions Bar */}
              {selectedItems.length > 0 && (
                <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
                    Đã chọn {selectedItems.length} sản phẩm
                  </div>
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
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
                    Xóa đã chọn
                  </button>
                </div>
              )}

              {/* Mobile: stacked cards (visible on small screens) */}
              <div className="block sm:hidden">
                <div className="space-y-3 p-3">
                  {filteredParts.map((part, index) => {
                    const stock = part.stock[currentBranchId] || 0;
                    const retailPrice = part.retailPrice[currentBranchId] || 0;
                    const isDuplicate = hasDuplicateSku(part.sku || "");
                    return (
                      <div
                        key={part.id}
                        className={`p-3 rounded-xl bg-[#2d3748] border border-slate-600 transition ${
                          isDuplicate ? "border-l-4 border-l-orange-500" : ""
                        }`}
                        role="listitem"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {/* Tên sản phẩm: hiển thị đầy đủ */}
                              <div className="text-[15px] font-medium text-white leading-tight">
                                {part.name}
                              </div>
                              <div className="text-[11px] text-blue-400 mt-1 truncate font-mono">
                                SKU: {part.sku}
                              </div>
                              {/* Danh mục với màu sắc */}
                              {part.category && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-[10px] font-medium ${
                                    getCategoryColor(part.category).bg
                                  } ${getCategoryColor(part.category).text}`}
                                >
                                  {part.category}
                                </span>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {/* Hiển thị giá bán */}
                              <div className="text-[13px] text-emerald-400 font-semibold">
                                {formatCurrency(retailPrice)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            {/* Badge số lượng tồn kho */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-bold rounded-lg ${
                                stock === 0
                                  ? "text-red-300 bg-red-900/40 border border-red-700/50"
                                  : stock < LOW_STOCK_THRESHOLD
                                  ? "text-yellow-300 bg-yellow-900/40 border border-yellow-700/50"
                                  : "text-emerald-300 bg-emerald-900/40 border border-emerald-700/50"
                              }`}
                            >
                              <span className="text-xs opacity-80">SL:</span>
                              {stock}
                            </span>
                            <div className="relative">
                              {/* Tăng vùng tap cho menu 3 chấm */}
                              <button
                                onClick={() =>
                                  setMobileMenuOpenIndex(
                                    mobileMenuOpenIndex === index ? null : index
                                  )
                                }
                                aria-haspopup="true"
                                aria-expanded={mobileMenuOpenIndex === index}
                                aria-label="Thêm hành động"
                                className="p-2.5 -m-1 text-slate-400 hover:bg-slate-600 rounded-lg transition active:bg-slate-500"
                              >
                                <MoreHorizontal className="w-5 h-5" />
                              </button>

                              {mobileMenuOpenIndex === index && (
                                <div className="absolute right-0 bottom-full mb-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[9999]">
                                  <button
                                    onClick={() => {
                                      setEditingPart(part);
                                      setMobileMenuOpenIndex(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 flex items-center gap-2 text-white rounded-t-lg"
                                    aria-label={`Chỉnh sửa ${part.name}`}
                                  >
                                    <Edit className="w-4 h-4 text-blue-400" />
                                    <span>Chỉnh sửa</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleDeleteItem(part.id);
                                      setMobileMenuOpenIndex(null);
                                    }}
                                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 flex items-center gap-2 text-red-400 rounded-b-lg"
                                    aria-label={`Xóa ${part.name}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Xóa</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Desktop / tablet: wide table (hidden on small screens) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 dark:bg-slate-700/50">
                    <tr className="border-b border-slate-200 dark:border-slate-600 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      <th className="px-3 py-2.5 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedItems.length === filteredParts.length &&
                            filteredParts.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">Sản phẩm</th>
                      <th className="px-3 py-2.5 text-center">Tồn kho</th>
                      <th className="px-3 py-2.5 text-right">Giá nhập</th>
                      <th className="px-3 py-2.5 text-right">Giá bán lẻ</th>
                      <th className="px-3 py-2.5 text-right">Giá bán sỉ</th>
                      <th className="px-3 py-2.5 text-right">Giá trị tồn</th>
                      <th className="px-3 py-2.5 text-center w-14">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-6 text-center text-slate-400 dark:text-slate-500"
                        >
                          <div className="text-4xl mb-2">🗂️</div>
                          <div className="text-sm">Không có sản phẩm nào</div>
                          <div className="text-xs">
                            Hãy thử một bộ lọc khác hoặc thêm sản phẩm mới
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((part) => {
                        const branchKey = currentBranchId || "";
                        const stock = part.stock?.[branchKey] || 0;
                        const retailPrice = part.retailPrice?.[branchKey] || 0;
                        const wholesalePrice =
                          part.wholesalePrice?.[branchKey] || 0;
                        const costPrice = part.costPrice?.[branchKey] || 0;
                        const value = stock * retailPrice;
                        const isSelected = selectedItems.includes(part.id);
                        const isDuplicate = hasDuplicateSku(part.sku || "");
                        const stockStatusClass =
                          stock === 0
                            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
                            : stock <= LOW_STOCK_THRESHOLD
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300";
                        const stockStatusLabel =
                          stock === 0
                            ? "Hết hàng"
                            : stock <= LOW_STOCK_THRESHOLD
                            ? "Sắp hết"
                            : "Ổn định";
                        const stockQtyClass =
                          stock === 0
                            ? "text-red-600 dark:text-red-400"
                            : stock <= LOW_STOCK_THRESHOLD
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400";
                        const productInitial =
                          part.name?.charAt(0)?.toUpperCase() || "?";
                        const rowHighlight = isSelected
                          ? "bg-blue-900/20 dark:bg-blue-900/20"
                          : isDuplicate
                          ? "bg-orange-500/10 border-l-4 border-l-orange-500"
                          : "";

                        return (
                          <tr
                            key={part.id}
                            className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${rowHighlight}`}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  handleSelectItem(part.id, e.target.checked)
                                }
                                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-2 min-w-[180px]">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                                  style={
                                    part.imageUrl
                                      ? undefined
                                      : {
                                          backgroundColor: getAvatarColor(
                                            part.category
                                          ),
                                        }
                                  }
                                >
                                  {part.imageUrl ? (
                                    <img
                                      src={part.imageUrl}
                                      alt={part.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span>{productInitial}</span>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {part.name}
                                    {isDuplicate && (
                                      <span
                                        className="inline-flex items-center gap-0.5 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0 text-[9px] font-semibold text-orange-700 dark:bg-orange-900/30 flex-shrink-0"
                                        title="Sản phẩm có mã trùng lặp"
                                      >
                                        ⚠️ Trùng
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    {part.barcode ? (
                                      <span className="text-blue-600 dark:text-blue-400">
                                        Mã: {part.barcode}
                                      </span>
                                    ) : (
                                      <span className="text-blue-600 dark:text-blue-400">
                                        SKU: {part.sku || "N/A"}
                                      </span>
                                    )}
                                  </div>
                                  {part.category && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
                                        getCategoryColor(part.category).bg
                                      } ${
                                        getCategoryColor(part.category).text
                                      }`}
                                    >
                                      {part.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className={`text-sm font-semibold ${stockQtyClass}`}
                                >
                                  {stock.toLocaleString()}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-semibold ${stockStatusClass}`}
                                >
                                  <span
                                    className={`h-1 w-1 rounded-full ${
                                      stock === 0
                                        ? "bg-red-500"
                                        : stock <= LOW_STOCK_THRESHOLD
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                  ></span>
                                  {stockStatusLabel}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-slate-600 dark:text-slate-300">
                              {formatCurrency(costPrice)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium text-slate-900 dark:text-slate-100">
                              {formatCurrency(retailPrice)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-slate-600 dark:text-slate-300">
                              {formatCurrency(wholesalePrice)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(value)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="relative flex justify-end">
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    const rect =
                                      event.currentTarget.getBoundingClientRect();
                                    setInventoryDropdownPos({
                                      top: rect.bottom + 4,
                                      right: window.innerWidth - rect.right,
                                    });
                                    setOpenActionRow((prev) =>
                                      prev === part.id ? null : part.id
                                    );
                                  }}
                                  className="rounded-full border border-transparent p-2 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:border-slate-600 hover:text-slate-900 dark:text-slate-100 transition"
                                  aria-haspopup="menu"
                                  aria-expanded={openActionRow === part.id}
                                  title="Thao tác nhanh"
                                >
                                  <MoreHorizontal className="w-5 h-5" />
                                </button>
                                {openActionRow === part.id && (
                                  <div
                                    className="fixed w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-xl dark:bg-slate-800 z-[9999]"
                                    style={{
                                      top: inventoryDropdownPos.top,
                                      right: inventoryDropdownPos.right,
                                    }}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setEditingPart(part);
                                        setOpenActionRow(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-slate-700 rounded-t-xl"
                                    >
                                      <Edit className="h-4 w-4 text-blue-500" />
                                      Chỉnh sửa
                                    </button>
                                    <button
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOpenActionRow(null);
                                        handleDeleteItem(part.id);
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-slate-700/70 rounded-b-xl"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Xóa
                                    </button>
                                  </div>
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
              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-center sm:text-left">
                  <span className="font-medium">
                    Trang {page}/{totalPages}
                  </span>
                  <span className="mx-1">•</span>
                  <span>{totalParts} phụ tùng</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    disabled={page === 1 || partsLoading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-700/50 transition-colors"
                  >
                    ←
                  </button>
                  <span className="px-2 py-1 text-xs sm:text-sm font-medium text-slate-300 min-w-[2rem] text-center">
                    {page}
                  </span>
                  <button
                    disabled={page >= totalPages || partsLoading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-700/50 transition-colors"
                  >
                    →
                  </button>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value) || 20;
                      setPageSize(newSize);
                      setPage(1);
                    }}
                    className="px-1.5 sm:px-2 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded bg-slate-800 text-slate-200"
                  >
                    {[10, 20, 50, 100].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <>
            {/* Desktop Version */}
            <div className="hidden sm:block">
              <InventoryHistorySection transactions={invTx} />
            </div>
            {/* Mobile Version */}
            <div className="sm:hidden">
              <InventoryHistorySectionMobile transactions={invTx} />
            </div>
          </>
        )}

        {activeTab === "categories" && (
          <div className="bg-[#0f172a] -m-3 sm:-m-6">
            <CategoriesManager />
          </div>
        )}

        {activeTab === "lookup" && (
          <div className="bg-[#0f172a] -m-3 sm:-m-6">
            {/* Desktop Version */}
            <div className="hidden sm:block">
              <LookupManager />
            </div>
            {/* Mobile Version */}
            <div className="sm:hidden">
              <LookupManagerMobile />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Desktop Version - Original */}
      <div className="hidden sm:block">
        <GoodsReceiptModal
          isOpen={showGoodsReceipt}
          onClose={() => setShowGoodsReceipt(false)}
          parts={allPartsData || []}
          currentBranchId={currentBranchId}
          onSave={handleSaveGoodsReceipt}
        />
      </div>

      {/* Mobile Version - New 2-step design */}
      <GoodsReceiptMobileWrapper
        isOpen={showGoodsReceipt}
        onClose={() => setShowGoodsReceipt(false)}
        parts={allPartsData || []}
        currentBranchId={currentBranchId}
        onSave={handleSaveGoodsReceipt}
      />

      {/* Batch Print Barcode Modal */}
      {showBatchPrintModal && (
        <BatchPrintBarcodeModal
          parts={allPartsData || []}
          currentBranchId={currentBranchId}
          onClose={() => setShowBatchPrintModal(false)}
        />
      )}

      {/* Edit Part Modal */}
      {editingPart && (
        <EditPartModal
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={(updatedPart) => {
            console.log("💾 Saving part updates:", updatedPart);
            // Only send fields that are allowed in database schema
            const updates: Partial<Part> = {
              name: updatedPart.name,
              barcode: updatedPart.barcode,
              category: updatedPart.category,
              stock: updatedPart.stock,
              retailPrice: updatedPart.retailPrice,
              wholesalePrice: updatedPart.wholesalePrice,
            };
            // Try to add costPrice if it exists in schema
            if (updatedPart.costPrice) {
              updates.costPrice = updatedPart.costPrice;
            }
            console.log("📤 Sending updates:", updates);
            updatePartMutation.mutate({
              id: updatedPart.id,
              updates,
            });
            setEditingPart(null);
          }}
          currentBranchId={currentBranchId}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportInventoryModal
          onClose={() => setShowImportModal(false)}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={async (file) => {
            try {
              const { items: importedData, errors: rowErrors } =
                await importPartsFromExcelDetailed(file, currentBranchId);

              if (importedData.length === 0) {
                const msg = rowErrors.length
                  ? `Không import được: ${rowErrors.slice(0, 3).join("; ")}`
                  : "File không có dữ liệu hợp lệ";
                throw new Error(msg);
              }

              // OPTIMIZATION: Batch fetch all parts by SKU in one query
              const allSkus = importedData.map((item) => item.sku);
              console.log(`🔍 Checking ${allSkus.length} SKUs...`);

              // Check for duplicate SKUs in import file
              const skuCounts = new Map<string, number>();
              allSkus.forEach((sku) => {
                skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
              });
              const duplicates = Array.from(skuCounts.entries())
                .filter(([_, count]) => count > 1)
                .map(([sku, count]) => `${sku}(${count}x)`);

              if (duplicates.length > 0) {
                console.warn(
                  `⚠️ Duplicate SKUs in file: ${duplicates
                    .slice(0, 5)
                    .join(", ")}`
                );
              }

              // Fetch existing parts in chunks (Supabase .in() has URL length limit)
              const uniqueSkus = Array.from(new Set(allSkus));
              const CHUNK_SIZE = 100; // Process 100 SKUs per request
              const allExistingParts: any[] = [];

              for (let i = 0; i < uniqueSkus.length; i += CHUNK_SIZE) {
                const chunk = uniqueSkus.slice(i, i + CHUNK_SIZE);
                const { data, error } = await supabase
                  .from("parts")
                  .select("*")
                  .in("sku", chunk);

                if (error) {
                  console.error(
                    `❌ Fetch chunk ${i / CHUNK_SIZE + 1} error:`,
                    error
                  );
                  throw new Error(`Lỗi kiểm tra phụ tùng: ${error.message}`);
                }

                if (data) {
                  allExistingParts.push(...data);
                }
              }

              console.log(`✅ Found ${allExistingParts.length} existing parts`);

              const existingPartsMap = new Map(
                allExistingParts.map((p) => [p.sku, p])
              );

              // Prepare batch operations
              const partsToCreate: any[] = [];
              const partsToUpdate: any[] = [];
              const inventoryTxToCreate: any[] = [];
              const processedSkus = new Set<string>(); // Track processed SKUs to avoid duplicates
              let createdCount = 0;
              let updatedCount = 0;
              let skippedCount = 0;
              const importDate = new Date().toISOString();

              for (const item of importedData) {
                // Skip if SKU already processed (duplicate in file)
                if (processedSkus.has(item.sku)) {
                  console.warn(
                    `⚠️ Skipping duplicate SKU in file: ${item.sku}`
                  );
                  skippedCount++;
                  continue;
                }
                processedSkus.add(item.sku);

                const existingPart = existingPartsMap.get(item.sku);

                if (existingPart) {
                  // Update existing part
                  updatedCount += 1;
                  partsToUpdate.push({
                    id: existingPart.id,
                    stock: {
                      ...existingPart.stock,
                      [currentBranchId]:
                        (existingPart.stock[currentBranchId] || 0) +
                        item.quantity,
                    },
                    costPrice: {
                      ...existingPart.costPrice,
                      [currentBranchId]: item.costPrice,
                    },
                    retailPrice: {
                      ...existingPart.retailPrice,
                      [currentBranchId]: item.retailPrice,
                    },
                    wholesalePrice: {
                      ...existingPart.wholesalePrice,
                      [currentBranchId]: item.wholesalePrice,
                    },
                  });

                  // Prepare inventory transaction
                  inventoryTxToCreate.push({
                    type: "Nhập kho",
                    date: importDate,
                    branchId: currentBranchId,
                    partId: existingPart.id,
                    partName: item.name,
                    quantity: item.quantity,
                    unitPrice: item.retailPrice,
                    totalPrice: item.quantity * item.retailPrice,
                    notes: `Nhập kho từ file Excel`,
                  });
                } else {
                  // Create new part
                  createdCount += 1;
                  const newPartId =
                    crypto?.randomUUID?.() ||
                    `${Math.random().toString(36).slice(2)}-${Date.now()}`;

                  partsToCreate.push({
                    id: newPartId,
                    name: item.name,
                    sku: item.sku,
                    category: item.category,
                    description: item.description,
                    stock: {
                      [currentBranchId]: item.quantity,
                    },
                    costPrice: {
                      [currentBranchId]: item.costPrice,
                    },
                    retailPrice: {
                      [currentBranchId]: item.retailPrice,
                    },
                    wholesalePrice: {
                      [currentBranchId]: item.wholesalePrice,
                    },
                  });

                  // Prepare inventory transaction
                  inventoryTxToCreate.push({
                    type: "Nhập kho",
                    date: importDate,
                    branchId: currentBranchId,
                    partId: newPartId,
                    partName: item.name,
                    quantity: item.quantity,
                    unitPrice: item.retailPrice,
                    totalPrice: item.quantity * item.retailPrice,
                    notes: `Nhập kho từ file Excel`,
                  });
                }
              }

              // BATCH: Execute all creates
              if (partsToCreate.length > 0) {
                const { data: createdParts, error: createError } =
                  await supabase.from("parts").insert(partsToCreate).select();

                if (createError) {
                  console.error("❌ Batch create error:", createError);
                  throw new Error(`Lỗi tạo phụ tùng: ${createError.message}`);
                }
                console.log(`✅ Created ${createdParts?.length || 0} parts`);
              }

              // BATCH: Execute all updates
              if (partsToUpdate.length > 0) {
                let updateSuccess = 0;
                let updateFailed = 0;

                for (const update of partsToUpdate) {
                  const { error } = await supabase
                    .from("parts")
                    .update({
                      stock: update.stock,
                      costPrice: update.costPrice,
                      retailPrice: update.retailPrice,
                      wholesalePrice: update.wholesalePrice,
                    })
                    .eq("id", update.id);

                  if (error) {
                    console.error(
                      `❌ Update error for part ${update.id}:`,
                      error
                    );
                    updateFailed++;
                  } else {
                    updateSuccess++;
                  }
                }
                console.log(
                  `✅ Updated ${updateSuccess}/${partsToUpdate.length} parts`
                );
              }

              // BATCH: Create inventory transactions
              if (inventoryTxToCreate.length > 0) {
                const { error: txError } = await supabase
                  .from("inventory_transactions")
                  .insert(inventoryTxToCreate);

                if (txError) {
                  console.warn("⚠️ Inventory transactions error:", txError);
                  // Don't throw - transactions are not critical
                }
              }

              // Invalidate queries to refresh UI
              queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
              queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });

              // Audit summary for import (best-effort)
              try {
                const { data: userData } = await supabase.auth.getUser();
                await safeAudit(userData?.user?.id || null, {
                  action: "inventory.import",
                  tableName: "inventory_transactions",
                  oldData: null,
                  newData: {
                    totalRows: importedData.length + rowErrors.length,
                    created: createdCount,
                    updated: updatedCount,
                    skipped: rowErrors.length,
                    sampleErrors: rowErrors.slice(0, 10),
                    branchId: currentBranchId,
                    at: importDate,
                  },
                });
              } catch {}

              setShowImportModal(false);

              let summaryMsg = `Import: tạo mới ${createdCount}, cập nhật ${updatedCount}`;
              if (skippedCount > 0) {
                summaryMsg += `, bỏ qua ${skippedCount} SKU trùng`;
              }
              if (rowErrors.length > 0) {
                summaryMsg += `, ${rowErrors.length} dòng lỗi`;
              }

              showToast.success(summaryMsg);
            } catch (error) {
              console.error("❌ Import error:", error);
              showToast.error(`Lỗi import: ${error}`);
            }
          }}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Mobile Floating Action Buttons */}
      <div className="sm:hidden fixed bottom-20 right-4 z-40 flex flex-col gap-3">
        <button
          onClick={() => setShowGoodsReceipt(true)}
          className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full shadow-lg shadow-green-500/30 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95"
          aria-label="Tạo phiếu nhập"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={handleExportExcel}
          className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full shadow-lg shadow-orange-500/30 flex items-center justify-center transition-all transform hover:scale-110 active:scale-95"
          aria-label="Xuất Excel"
        >
          <Repeat className="w-5 h-5" />
        </button>
      </div>

      {/* Custom Bottom Navigation for Inventory */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50 safe-area-bottom">
        {/* Backdrop blur effect */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          <button
            onClick={() => setActiveTab("stock")}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
              activeTab === "stock"
                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 scale-105"
                : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
          >
            <Boxes
              className={`w-5 h-5 ${
                activeTab === "stock" ? "scale-110" : ""
              } transition-transform`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "stock" ? "font-semibold" : ""
              }`}
            >
              Tồn kho
            </span>
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
              activeTab === "categories"
                ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 scale-105"
                : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
          >
            <Package
              className={`w-5 h-5 ${
                activeTab === "categories" ? "scale-110" : ""
              } transition-transform`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "categories" ? "font-semibold" : ""
              }`}
            >
              Danh mục
            </span>
          </button>
          <button
            onClick={() => setActiveTab("lookup")}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
              activeTab === "lookup"
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 scale-105"
                : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
          >
            <Search
              className={`w-5 h-5 ${
                activeTab === "lookup" ? "scale-110" : ""
              } transition-transform`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "lookup" ? "font-semibold" : ""
              }`}
            >
              Tra cứu
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${
              activeTab === "history"
                ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 scale-105"
                : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
          >
            <FileText
              className={`w-5 h-5 ${
                activeTab === "history" ? "scale-110" : ""
              } transition-transform`}
            />
            <span
              className={`text-[10px] font-medium ${
                activeTab === "history" ? "font-semibold" : ""
              }`}
            >
              Lịch sử
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Import Inventory Modal Component
interface ImportInventoryModalProps {
  onClose: () => void;
  onDownloadTemplate: () => void;
  onImport: (file: File) => Promise<void>;
}

const ImportInventoryModal: React.FC<ImportInventoryModalProps> = ({
  onClose,
  onDownloadTemplate,
  onImport,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        setSelectedFile(file);
      } else {
        showToast.warning(
          "Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV (.csv)"
        );
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showToast.warning("Vui lòng chọn file để import");
      return;
    }

    setIsProcessing(true);
    try {
      await onImport(selectedFile);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Nhập tồn kho từ Excel/CSV
          </h2>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50"
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
        <div className="p-6 space-y-6">
          {/* Download Template */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Hướng dẫn sử dụng
                </h3>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Tải file template mẫu</li>
                  <li>Điền thông tin sản phẩm vào file</li>
                  <li>Lưu file và chọn để import</li>
                </ol>
                <button
                  onClick={onDownloadTemplate}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  📥 Tải Template Excel
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chọn file để import
            </label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isProcessing}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-flex flex-col items-center"
              >
                <svg
                  className="w-12 h-12 text-slate-400 mb-3"
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
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Click để chọn file Excel hoặc CSV
                </span>
                {selectedFile && (
                  <span className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                    ✓ {selectedFile.name}
                  </span>
                )}
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedFile || isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Đang xử lý..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Part Modal Component
interface EditPartModalProps {
  part: Part;
  onClose: () => void;
  onSave: (part: Partial<Part> & { id: string }) => void;
  currentBranchId: string;
}

const EditPartModal: React.FC<EditPartModalProps> = ({
  part,
  onClose,
  onSave,
  currentBranchId,
}) => {
  const [formData, setFormData] = useState({
    name: part.name,
    barcode: part.barcode || "",
    category: part.category || "",
    retailPrice: part.retailPrice[currentBranchId] || 0,
    wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
    costPrice: part.costPrice?.[currentBranchId] || 0,
    stock: part.stock[currentBranchId] || 0,
  });
  const [showPrintBarcode, setShowPrintBarcode] = useState(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      id: part.id,
      name: formData.name.trim(),
      barcode: formData.barcode.trim() || undefined,
      category: formData.category.trim() || undefined,
      stock: {
        ...part.stock,
        [currentBranchId]: formData.stock,
      },
      costPrice: {
        ...part.costPrice,
        [currentBranchId]: formData.costPrice,
      },
      retailPrice: {
        ...part.retailPrice,
        [currentBranchId]: formData.retailPrice,
      },
      wholesalePrice: {
        ...part.wholesalePrice,
        [currentBranchId]: formData.wholesalePrice,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Chỉnh sửa sản phẩm
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tên sản phẩm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          {/* Mã sản phẩm */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mã sản phẩm
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) =>
                setFormData({ ...formData, barcode: e.target.value })
              }
              placeholder="VD: 06455-KYJ-841 (Honda), 5S9-F2101-00 (Yamaha)"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Nhập mã hãng (Honda/Yamaha) hoặc để trống để tự sinh mã nội bộ
              PT-xxxxx
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Danh mục
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Chọn hoặc tạo mới --</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowInlineCat(true)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                  title="Thêm danh mục mới"
                >
                  +
                </button>
              </div>
              {showInlineCat && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = inlineCatName.trim();
                    if (!trimmed)
                      return showToast.warning("Vui lòng nhập tên danh mục");
                    try {
                      const res = await createCategory.mutateAsync({
                        name: trimmed,
                      });
                      setFormData({ ...formData, category: res.name });
                      setInlineCatName("");
                      setShowInlineCat(false);
                    } catch (err: any) {
                      showToast.error(err?.message || "Lỗi tạo danh mục");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nhập tên danh mục mới"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineCat(false);
                      setInlineCatName("");
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    Hủy
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Giá nhập
              </label>
              <input
                type="number"
                value={formData.costPrice || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costPrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Giá bán lẻ
              </label>
              <input
                type="number"
                value={formData.retailPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    retailPrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Giá bán sỉ
              </label>
              <input
                type="number"
                value={formData.wholesalePrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wholesalePrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>
          </div>

          {/* Stock adjustment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tồn kho hiện tại
            </label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stock: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              min="0"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Số lượng tồn kho tại chi nhánh hiện tại
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <div className="font-medium mb-1">Lưu ý:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Bạn có thể chỉnh sửa trực tiếp giá nhập, giá bán và tồn kho
                </li>
                <li>
                  Hoặc sử dụng "Tạo phiếu nhập" để ghi nhận lịch sử nhập kho chi
                  tiết
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowPrintBarcode(true)}
              className="px-4 py-2 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
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
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
              In mã vạch
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </form>

        {/* Print Barcode Modal */}
        {showPrintBarcode && (
          <PrintBarcodeModal
            part={part}
            currentBranchId={currentBranchId}
            onClose={() => setShowPrintBarcode(false)}
          />
        )}
      </div>
    </div>
  );
};

// Export BatchPrintBarcodeModal renderer as part of main component
export { BatchPrintBarcodeModal };

export default InventoryManager;
