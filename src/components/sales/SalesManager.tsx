import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import {
  BarChart3,
  Boxes,
  ShoppingCart,
  CreditCard,
  Banknote,
  Star,
  MapPin,
  Printer,
  CalendarDays,
  Receipt,
  ScanLine,
  History,
  Plus,
  Share2,
  Download,
  Zap,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import {
  useSalesRepo,
  useSalesPagedRepo,
  useCreateSaleAtomicRepo,
  UseSalesPagedParams,
} from "../../hooks/useSalesRepository";
import { useLowStock } from "../../hooks/useLowStock";
import { formatCurrency, formatDate, formatAnyId } from "../../utils/format";
import { printElementById } from "../../utils/print";
import { showToast } from "../../utils/toast";
import { PlusIcon, XMarkIcon } from "../Icons";
import type { CartItem, Part, Customer, Sale } from "../../types";
import { safeAudit } from "../../lib/repository/auditLogsRepository";
import { supabase } from "../../supabaseClient";
import {
  useCreateCustomerDebtRepo,
  useCustomerDebtsRepo,
} from "../../hooks/useDebtsRepository";
import { useCustomers, useCreateCustomer } from "../../hooks/useSupabase";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import QuickServiceModal from "./QuickServiceModal";
import type { QuickService } from "../../hooks/useQuickServices";

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
}

type StockFilter = "all" | "low" | "out";

const LOW_STOCK_THRESHOLD = 5;

// Sale Detail Modal Component (for viewing/editing sale details)
interface SaleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onPrint: (sale: Sale) => void;
}

const SaleDetailModal: React.FC<SaleDetailModalProps> = ({
  isOpen,
  onClose,
  sale,
  onPrint,
}) => {
  if (!isOpen || !sale) return null;

  const itemsTotal = sale.items.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0
  );
  const totalDiscount = itemsTotal - sale.total;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Chi tiết đơn hàng
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Sale Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Mã đơn hàng
              </label>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {sale.sale_code || formatAnyId(sale.id) || sale.id}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Ngày tạo
              </label>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {formatDate(new Date(sale.date), false)}{" "}
                {new Date(sale.date).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Khách hàng
              </label>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {sale.customer.name}
              </div>
              {sale.customer.phone && (
                <div className="text-sm text-slate-500">
                  {sale.customer.phone}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Nhân viên bán hàng
              </label>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {(sale as any).username || sale.userName || "N/A"}
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Phương thức thanh toán
              </label>
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {sale.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Sản phẩm
            </h3>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Tên sản phẩm
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      SL
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Đơn giá
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {sale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                        {item.partName}
                        {item.sku && (
                          <div className="text-xs text-slate-500">
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-slate-100">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.quantity * item.sellingPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Tạm tính:
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(itemsTotal)}
                </span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Giảm giá:
                  </span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    -{formatCurrency(totalDiscount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-900 dark:text-slate-100">
                  Tổng cộng:
                </span>
                <span className="text-green-600 dark:text-green-400">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={() => {
              onPrint(sale);
              onClose();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
            In hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Sale Modal Component
interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  onSave: (updatedSale: {
    id: string;
    items: CartItem[];
    customer: { id?: string; name: string; phone?: string };
    paymentMethod: "cash" | "bank";
    discount: number;
  }) => Promise<void>;
}

const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSave,
}) => {
  const { customers, upsertCustomer } = useAppContext();
  const { data: repoParts = [] } = usePartsRepo();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [editCustomer, setEditCustomer] = useState({
    id: "",
    name: "",
    phone: "",
  });
  const [editPaymentMethod, setEditPaymentMethod] = useState<"cash" | "bank">(
    "cash"
  );
  const [editDiscount, setEditDiscount] = useState(0);

  // State for adding products
  const [searchPart, setSearchPart] = useState("");
  const [showPartDropdown, setShowPartDropdown] = useState(false);

  // State for adding customers
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [customerSearchText, setCustomerSearchText] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Initialize form when sale changes
  useEffect(() => {
    if (sale) {
      setEditItems([...sale.items]);
      setEditCustomer({
        id: sale.customer.id || "",
        name: sale.customer.name,
        phone: sale.customer.phone || "",
      });
      setCustomerSearchText(sale.customer.name);
      setEditPaymentMethod(sale.paymentMethod);
      setEditDiscount(sale.discount || 0);
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const subtotal = editItems.reduce(
    (sum, item) => sum + item.quantity * item.sellingPrice,
    0
  );
  const total = subtotal - editDiscount;

  // Filter parts for search
  const availableParts = repoParts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchPart.toLowerCase())
  );

  // Filter customers for search (by name, phone, or license plate)
  const filteredCustomers = customers.filter((c) => {
    const q = customerSearchText.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      (c.vehicles &&
        c.vehicles.some((v: any) => v.licensePlate?.toLowerCase().includes(q)))
    );
  });

  const handleAddPart = (part: Part) => {
    // Check if current branch has stock
    const branchStock =
      typeof part.stock === "object"
        ? part.stock[sale.branchId] || 0
        : part.stock;

    // Get selling price for current branch
    const branchPrice =
      typeof part.retailPrice === "object"
        ? part.retailPrice[sale.branchId] || 0
        : part.retailPrice || 0;

    const existing = editItems.find((i) => i.partId === part.id);
    if (existing) {
      // Increase quantity
      setEditItems(
        editItems.map((i) =>
          i.partId === part.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      // Add new item
      setEditItems([
        ...editItems,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          sellingPrice: branchPrice,
          stockSnapshot: typeof branchStock === "number" ? branchStock : 0,
        },
      ]);
    }
    setSearchPart("");
    setShowPartDropdown(false);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setEditCustomer({
      id: customer.id,
      name: customer.name,
      phone: customer.phone || "",
    });
    setCustomerSearchText(customer.name);
    setShowCustomerDropdown(false);
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    try {
      const newCustomer: Customer = {
        id: crypto.randomUUID(),
        name: newCustomerName,
        phone: newCustomerPhone || undefined,
        email: "",
        created_at: new Date().toISOString(),
      };

      await upsertCustomer(newCustomer);

      setEditCustomer({
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone || "",
      });
      setCustomerSearchText(newCustomer.name);
      setShowCustomerForm(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      showToast.success("Thêm khách hàng thành công");
    } catch (error) {
      console.error("Error adding customer:", error);
      showToast.error("Lỗi khi thêm khách hàng");
    }
  };

  const handleUpdateQuantity = (partId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setEditItems(editItems.filter((i) => i.partId !== partId));
    } else {
      setEditItems(
        editItems.map((i) =>
          i.partId === partId ? { ...i, quantity: newQuantity } : i
        )
      );
    }
  };

  const handleUpdatePrice = (partId: string, newPrice: number) => {
    setEditItems(
      editItems.map((i) =>
        i.partId === partId ? { ...i, sellingPrice: newPrice } : i
      )
    );
  };

  const handleRemoveItem = (partId: string) => {
    setEditItems(editItems.filter((i) => i.partId !== partId));
  };

  const handleSave = async () => {
    if (editItems.length === 0) {
      showToast.error("Vui lòng có ít nhất một sản phẩm");
      return;
    }
    if (!editCustomer.name) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    try {
      await onSave({
        id: sale.id,
        items: editItems,
        customer: editCustomer,
        paymentMethod: editPaymentMethod,
        discount: editDiscount,
      });
      // Success toast will be shown by onSave callback
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["salesRepoPaged"] });
      onClose();
    } catch (error) {
      console.error("Error saving sale:", error);
      // Error toast will be shown by onSave callback
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            ✏️ [Chỉnh sửa] Đơn Xuất Bán {sale.sale_code || formatAnyId(sale.id)}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Thời gian bán hàng */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Thời gian bán hàng:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formatDate(new Date(sale.date), false)}
                disabled
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={new Date(sale.date).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                disabled
                className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center"
              />
            </div>
          </div>

          {/* Khách hàng */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Khách hàng: ℹ️
            </label>
            {!showCustomerForm ? (
              <>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={customerSearchText}
                      onChange={(e) => {
                        setCustomerSearchText(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Tìm kiếm và chọn một khách hàng"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                        {filteredCustomers.slice(0, 10).map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => handleSelectCustomer(customer)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 text-sm"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {customer.name}
                            </div>
                            {customer.phone && (
                              <div className="text-xs text-slate-500">
                                {customer.phone}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCustomerForm(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Thêm mới
                  </button>
                </div>
              </>
            ) : (
              <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 space-y-2">
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Tên khách hàng"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Số điện thoại (tùy chọn)"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNewCustomer}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Lưu
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomerForm(false);
                      setNewCustomerName("");
                      setNewCustomerPhone("");
                    }}
                    className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chi tiết sản phẩm */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Chi tiết sản phẩm:
              </label>
            </div>

            {/* Product search */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchPart}
                onChange={(e) => {
                  setSearchPart(e.target.value);
                  setShowPartDropdown(true);
                }}
                onFocus={() => setShowPartDropdown(true)}
                placeholder="Tìm kiếm và thêm sản phẩm..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              {showPartDropdown && searchPart && availableParts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                  {availableParts.slice(0, 10).map((part) => (
                    <button
                      key={part.id}
                      onClick={() => handleAddPart(part)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 text-sm"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {part.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        SKU: {part.sku}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-8">
                      -
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Tên
                    </th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-20">
                      SL
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-24">
                      Đơn giá
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 w-28">
                      Thành tiền
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {editItems.map((item, idx) => (
                    <tr key={item.partId}>
                      <td className="px-2 py-2 text-center text-sm text-slate-900 dark:text-slate-100">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {item.partName}
                        </div>
                        <div className="text-xs text-slate-500">{item.sku}</div>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(
                              item.partId,
                              parseInt(e.target.value) || 0
                            )
                          }
                          min="1"
                          className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.sellingPrice}
                          onChange={(e) =>
                            handleUpdatePrice(
                              item.partId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          min="0"
                          step="1000"
                          className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.quantity * item.sellingPrice)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.partId)}
                          className="text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <XMarkIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editItems.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Chưa có sản phẩm nào
              </div>
            )}
            {editItems.length > 0 && (
              <div className="mt-2 text-right">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  TỔNG:
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(subtotal)}
                </div>
              </div>
            )}
          </div>

          {/* Chọn nhân viên bán hàng */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chọn nhân viên bán hàng
            </label>
            <select
              disabled
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option>{(sale as any).username || sale.userName}</option>
            </select>
          </div>

          {/* Công nợ section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Công nợ:
            </label>
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Khách hàng phải thanh toán
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  TỔNG PHẢI THU:
                </span>
                <span className="text-lg font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <input type="checkbox" checked readOnly />
                <span>Đã thanh toán đủ</span>
              </div>
            </div>

            {/* Payment method buttons */}
            <div className="mb-3">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                - Thời gian Người thu - Ghi chú
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditPaymentMethod("cash")}
                  className={`flex-1 py-2 rounded-lg border transition-colors text-sm font-medium ${
                    editPaymentMethod === "cash"
                      ? "bg-green-600 text-white border-green-600"
                      : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  Tiền mặt
                </button>
                <button
                  onClick={() => setEditPaymentMethod("bank")}
                  className={`flex-1 py-2 rounded-lg border transition-colors text-sm font-medium ${
                    editPaymentMethod === "bank"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  Chuyển khoản
                </button>
              </div>
            </div>

            {/* Payment details table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="text-center px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      -
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Thời gian
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Người thu - Ghi chú
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Số tiền
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800">
                  <tr>
                    <td className="px-2 py-2 text-center text-slate-900 dark:text-slate-100">
                      1
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-slate-900 dark:text-slate-100">
                        {new Date(sale.date).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        {formatDate(new Date(sale.date), false)}
                      </div>
                      <div className="text-xs text-slate-500">(Tiền mặt)</div>
                    </td>
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {(sale as any).username || sale.userName}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                      {formatCurrency(total)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-right">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Tổng đã thu
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(total)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors font-medium"
          >
            ĐÓNG
          </button>
          <button
            onClick={handleSave}
            disabled={editItems.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            LƯU
          </button>
        </div>
      </div>
    </div>
  );
};

// Sales History Modal Component (refactored to accept pagination & search props)
interface SalesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  currentBranchId: string;
  onPrintReceipt: (sale: Sale) => void;
  onEditSale: (sale: Sale) => void;
  onDeleteSale: (saleId: string) => void;
  page: number;
  totalPages: number;
  total: number;
  hasMore: boolean;
  pageSize: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (size: number) => void;
  search: string;
  onSearchChange: (s: string) => void;
  fromDate?: string;
  toDate?: string;
  onDateRangeChange: (from?: string, to?: string) => void;
  status?: "all" | "completed" | "cancelled" | "refunded";
  onStatusChange?: (s: "all" | "completed" | "cancelled" | "refunded") => void;
  paymentMethodFilter?: "all" | "cash" | "bank";
  onPaymentMethodFilterChange?: (m: "all" | "cash" | "bank") => void;
  keysetMode?: boolean;
  onToggleKeyset?: (checked: boolean) => void;
  customerDebts?: any[]; // Add customerDebts prop
}

const SalesHistoryModal: React.FC<SalesHistoryModalProps> = ({
  isOpen,
  onClose,
  sales,
  currentBranchId,
  onPrintReceipt,
  onEditSale,
  onDeleteSale,
  page,
  totalPages,
  total,
  hasMore,
  pageSize,
  onPrevPage,
  onNextPage,
  onPageSizeChange,
  search,
  onSearchChange,
  fromDate,
  toDate,
  onDateRangeChange,
  status = "all",
  onStatusChange,
  paymentMethodFilter = "all",
  onPaymentMethodFilterChange,
  keysetMode = false,
  onToggleKeyset,
  customerDebts = [], // Destructure customerDebts with default value
}) => {
  const { profile } = useAuth();
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [searchText, setSearchText] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dropdownOpenSaleId, setDropdownOpenSaleId] = useState<string | null>(
    null
  );
  const [salesDropdownPos, setSalesDropdownPos] = useState({
    top: 0,
    right: 0,
  });

  // Compute date range when filter changes
  useEffect(() => {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999
    );
    let from: Date | undefined;
    let to: Date | undefined;
    switch (activeTimeFilter) {
      case "today":
        from = startOfDay;
        to = endOfDay;
        break;
      case "week": {
        // Current week (Monday to Sunday)
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday
        const monday = new Date(today);
        monday.setDate(today.getDate() + diff);
        from = new Date(
          monday.getFullYear(),
          monday.getMonth(),
          monday.getDate()
        );
        to = endOfDay;
        break;
      }
      case "month": {
        // Current month
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        to = endOfDay;
        break;
      }
      case "7days": {
        const s = new Date(today);
        s.setDate(s.getDate() - 6);
        from = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        to = endOfDay;
        break;
      }
      case "30days": {
        const s = new Date(today);
        s.setDate(s.getDate() - 29);
        from = new Date(s.getFullYear(), s.getMonth(), s.getDate());
        to = endOfDay;
        break;
      }
      case "custom": {
        if (customStartDate && customEndDate) {
          from = new Date(customStartDate);
          to = new Date(customEndDate + "T23:59:59");
        }
        break;
      }
      case "all":
        from = undefined;
        to = undefined;
        break;
    }
    onDateRangeChange(
      from ? from.toISOString() : undefined,
      to ? to.toISOString() : undefined
    );
  }, [activeTimeFilter, customStartDate, customEndDate, onDateRangeChange]);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let filtered = sales.filter(
      (sale) =>
        sale.branchId === currentBranchId ||
        (sale as any).branchid === currentBranchId
    );

    // Search filter
    if (searchText) {
      filtered = filtered.filter(
        (sale) =>
          sale.id.toLowerCase().includes(searchText.toLowerCase()) ||
          (sale.sale_code || "")
            .toLowerCase()
            .includes(searchText.toLowerCase()) ||
          sale.customer.name.toLowerCase().includes(searchText.toLowerCase()) ||
          ((sale as any).username || sale.userName || "")
            .toLowerCase()
            .includes(searchText.toLowerCase())
      );
    }

    // Sort by date desc
    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return filtered;
  }, [sales, currentBranchId, searchText]);

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  }, [filteredSales]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".dropdown-menu-container")) {
        setDropdownOpenSaleId(null);
      }
    };
    if (dropdownOpenSaleId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpenSaleId]);

  if (!isOpen) return null;

  return (
    <React.Fragment>
      <div className="fixed inset-0 bg-black/60 z-50 flex md:items-center md:justify-center items-end justify-center p-0 md:p-4">
        <div className="bg-white dark:bg-slate-800 w-full md:max-w-7xl max-h-[95vh] md:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-slide-up-bottom">
          {/* Header with time filter and stats */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/70 backdrop-blur">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Lịch sử bán hàng
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  Theo dõi giao dịch gần đây
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-2xl leading-none px-2"
                aria-label="Đóng lịch sử bán hàng"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Time filter buttons */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin">
                {[
                  { key: "7days", label: "7 ngày qua" },
                  { key: "week", label: "Tuần" },
                  { key: "month", label: "Tháng" },
                  { key: "30days", label: "30 ngày qua" },
                  { key: "custom", label: "Tùy chọn" },
                  { key: "all", label: "Tất cả" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveTimeFilter(filter.key)}
                    className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap border transition-all min-w-[96px] ${
                      activeTimeFilter === filter.key
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-transparent"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Search and stats */}
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="w-full md:flex-1 relative">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Tìm hóa đơn, khách hàng hoặc mã phiếu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <svg
                    className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 19a8 8 0 100-16 8 8 0 000 16z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.3-4.3"
                    />
                  </svg>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Tổng doanh thu
                    </div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(totalRevenue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom date range picker */}
              {activeTimeFilter === "custom" && (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <label className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    Từ
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                    />
                  </label>
                  <label className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    Đến
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Sales list */}
          <div className="flex-1 overflow-y-auto">
            {filteredSales.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Không có hóa đơn nào
              </div>
            ) : (
              <div>
                {/* Header Row */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10">
                  <div className="col-span-1 text-xs font-semibold text-slate-600 dark:text-slate-300"></div>
                  <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Mã phiếu
                  </div>
                  <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Khách hàng
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

                {/* Sales List */}
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredSales.map((sale) => {
                    const saleDate = new Date(sale.date);
                    const subtotal = sale.items.reduce(
                      (sum, item) =>
                        sum + item.quantity * (item as any).sellingPrice,
                      0
                    );

                    // Check if this sale has debt
                    const saleDebt = (customerDebts || []).find((debt) =>
                      debt.description?.includes(sale.sale_code || sale.id)
                    );

                    const paidAmount = saleDebt
                      ? saleDebt.totalAmount - saleDebt.remainingAmount
                      : sale.total;
                    const remainingDebt = saleDebt?.remainingAmount || 0;
                    const hasDebt = remainingDebt > 0;
                    const itemDisplayLimit = 3;
                    const displayItems = sale.items.slice(0, itemDisplayLimit);
                    const remainingItems =
                      sale.items.length - displayItems.length;
                    const formattedDate = saleDate.toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    const formattedTime = saleDate.toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const customerInitial = (
                      sale.customer?.name?.charAt(0) || "K"
                    ).toUpperCase();
                    const paymentLabel =
                      sale.paymentMethod === "cash"
                        ? "Tiền mặt"
                        : "Chuyển khoản";

                    return (
                      <div
                        key={sale.id}
                        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        {/* Mobile friendly card */}
                        <div className="md:hidden flex flex-col gap-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              {sale.sale_code && (
                                <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-300">
                                  <Receipt className="w-4 h-4" />
                                  {sale.sale_code}
                                </div>
                              )}
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                                <CalendarDays className="w-3.5 h-3.5" />
                                <span>
                                  {formattedDate} · {formattedTime}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  NV
                                </span>
                                <span>
                                  {sale.userName ||
                                    (sale as any).username ||
                                    "N/A"}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Tổng tiền
                              </div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {formatCurrency(sale.total)}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 justify-end mt-1">
                                {sale.paymentMethod === "cash" ? (
                                  <Banknote className="w-4 h-4" />
                                ) : (
                                  <CreditCard className="w-4 h-4" />
                                )}
                                <span>{paymentLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-200 font-semibold">
                              {customerInitial}
                            </div>
                            <div>
                              <div className="text-base font-semibold text-slate-900 dark:text-white">
                                {sale.customer?.name || "Khách vãng lai"}
                              </div>
                              {sale.customer?.phone && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M2 5.5C2 4.119 3.12 3 4.5 3h1.76c.636 0 1.197.4 1.39 1.005l.8 2.47a1.5 1.5 0 01-.35 1.46L7.11 8.94a12.044 12.044 0 005.95 5.95l1.006-1.002a1.5 1.5 0 011.46-.349l2.469.8c.606.193 1.005.754 1.005 1.39V19.5c0 1.38-1.119 2.5-2.5 2.5h-.25C8.268 22 2 15.732 2 7.75v-.25z"
                                    />
                                  </svg>
                                  {sale.customer.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {displayItems.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-start justify-between text-sm text-slate-700 dark:text-slate-200"
                              >
                                <div>
                                  <span className="font-semibold">
                                    {item.quantity} x {item.partName}
                                  </span>
                                  <div className="text-xs text-slate-400">
                                    {formatCurrency(
                                      (item as any).sellingPrice || 0
                                    )}{" "}
                                    / sản phẩm
                                  </div>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {formatCurrency(
                                    item.quantity *
                                      ((item as any).sellingPrice || 0)
                                  )}
                                </span>
                              </div>
                            ))}
                            {remainingItems > 0 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                +{remainingItems} sản phẩm khác
                              </div>
                            )}
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
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {paymentLabel}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <button
                              onClick={() => onPrintReceipt(sale)}
                              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                            >
                              In hoá đơn
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowDetailModal(true);
                              }}
                              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                            >
                              Xem chi tiết
                            </button>
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowEditModal(true);
                              }}
                              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                            >
                              Chỉnh sửa
                            </button>
                            {canDo(profile?.role, "sale.delete") && (
                              <button
                                onClick={() => onDeleteSale(sale.id)}
                                className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm font-medium"
                              >
                                Xóa đơn
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="hidden md:grid grid-cols-12 gap-4 items-start">
                          {/* Checkbox */}
                          <div className="col-span-1 flex items-start pt-1">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300"
                            />
                          </div>

                          {/* Cột 1: Mã Phiếu + Thông tin */}
                          <div className="col-span-2">
                            <div className="space-y-1">
                              {sale.sale_code && (
                                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                  {sale.sale_code}
                                </div>
                              )}
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {saleDate.getDate()}/{saleDate.getMonth() + 1}/
                                {saleDate.getFullYear()}{" "}
                                {String(saleDate.getHours()).padStart(2, "0")}:
                                {String(saleDate.getMinutes()).padStart(2, "0")}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                <span className="font-medium">NV:</span>{" "}
                                {sale.userName ||
                                  (sale as any).username ||
                                  "N/A"}
                              </div>
                            </div>
                          </div>

                          {/* Cột 2: Khách hàng */}
                          <div className="col-span-2">
                            <div className="space-y-1">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {sale.customer?.name || "Khách vãng lai"}
                              </div>
                              {sale.customer?.phone && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  📞 {sale.customer.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Cột 3: Chi tiết sản phẩm */}
                          <div className="col-span-4">
                            <div className="space-y-1">
                              {sale.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs text-slate-700 dark:text-slate-300"
                                >
                                  <span className="font-medium">
                                    {item.quantity} x
                                  </span>{" "}
                                  {item.partName}
                                  <span className="text-slate-400 ml-1">
                                    (
                                    {formatCurrency(
                                      (item as any).sellingPrice || 0
                                    )}
                                    )
                                  </span>
                                  {" = "}
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {formatCurrency(
                                      item.quantity *
                                        ((item as any).sellingPrice || 0)
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Cột 4: Thông tin thanh toán */}
                          <div className="col-span-2">
                            <div className="space-y-1">
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                Tổng tiền:
                              </div>
                              <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                                {formatCurrency(sale.total)}
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

                              <div className="text-xs text-slate-500 mt-1">
                                {sale.paymentMethod === "cash"
                                  ? "💵 Tiền mặt"
                                  : "🏦 Chuyển khoản"}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 flex items-start justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
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
                            <div className="relative dropdown-menu-container">
                              <button
                                onClick={(e) => {
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  setSalesDropdownPos({
                                    top: rect.bottom + 4,
                                    right: window.innerWidth - rect.right,
                                  });
                                  setDropdownOpenSaleId(
                                    dropdownOpenSaleId === sale.id
                                      ? null
                                      : sale.id
                                  );
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                title="Tùy chọn"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>
                              {dropdownOpenSaleId === sale.id && (
                                <div
                                  className="fixed w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-[9999]"
                                  style={{
                                    top: salesDropdownPos.top,
                                    right: salesDropdownPos.right,
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      onPrintReceipt(sale);
                                      setDropdownOpenSaleId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-lg"
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
                                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                      />
                                    </svg>
                                    In lại hóa đơn
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedSale(sale);
                                      setShowDetailModal(true);
                                      setDropdownOpenSaleId(null);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                                  {canDo(profile?.role, "sale.delete") && (
                                    <button
                                      onClick={() => {
                                        if (onDeleteSale) {
                                          onDeleteSale(sale.id);
                                        }
                                        setDropdownOpenSaleId(null);
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-b-lg"
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
                                      Xóa hóa đơn
                                    </button>
                                  )}
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
            )}
          </div>

          {/* Footer with pagination */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Hiển thị {filteredSales.length} đơn hàng
            </div>
          </div>
        </div>
      </div>

      {/* Sale Detail Modal */}
      <SaleDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSale(null);
        }}
        sale={selectedSale}
        onPrint={onPrintReceipt}
      />

      {/* Edit Sale Modal */}
      <EditSaleModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedSale(null);
        }}
        sale={selectedSale}
        onSave={async (updatedSale) => {
          try {
            // Import supabase directly for update
            const { supabase } = await import("../../supabaseClient");
            const { profile: currentProfile } = await import(
              "../../contexts/AuthContext"
            ).then((m) => ({ profile: null }));

            // Calculate new total
            const subtotal = updatedSale.items.reduce(
              (sum, item) => sum + item.quantity * item.sellingPrice,
              0
            );
            const newTotal = subtotal - updatedSale.discount;

            // Update sales record
            const { error: updateError } = await supabase
              .from("sales")
              .update({
                items: updatedSale.items,
                customer: updatedSale.customer,
                paymentmethod: updatedSale.paymentMethod,
                discount: updatedSale.discount,
                total: newTotal,
              })
              .eq("id", updatedSale.id);

            if (updateError) {
              throw updateError;
            }

            // Audit log
            await safeAudit(null, {
              action: "sale_update",
              tableName: "sales",
              recordId: updatedSale.id,
              newData: {
                items: updatedSale.items,
                customer: updatedSale.customer,
                paymentMethod: updatedSale.paymentMethod,
                discount: updatedSale.discount,
                total: newTotal,
              },
            });

            // Invalidate queries to refresh data immediately
            queryClient.invalidateQueries({ queryKey: ["salesRepo"] });
            queryClient.invalidateQueries({ queryKey: ["salesRepoPaged"] });
            queryClient.invalidateQueries({ queryKey: ["salesRepoKeyset"] });

            showToast.success("Đã cập nhật đơn hàng thành công");
            setShowEditModal(false);
            setSelectedSale(null);
          } catch (error) {
            console.error("Error updating sale:", error);
            showToast.error(
              "Lỗi khi cập nhật đơn hàng: " + (error as any).message
            );
          }
        }}
      />
    </React.Fragment>
  );
};

const SalesManager: React.FC = () => {
  const {
    upsertCustomer,
    cartItems,
    setCartItems,
    clearCart,
    deleteSale,
    currentBranchId,
    finalizeSale,
    setCashTransactions,
    setPaymentSources,
  } = useAppContext();

  const queryClient = useQueryClient();

  // Fetch customers from Supabase
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const createCustomerMutation = useCreateCustomer();

  // Repository (read-only step 1)
  const {
    data: repoParts = [],
    isLoading: loadingParts,
    error: partsError,
  } = usePartsRepo();

  // Fetch customer debts to check payment status
  const { data: customerDebts = [] } = useCustomerDebtsRepo();

  // Server-side sales pagination parameters
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(20);
  const [salesSearchInput, setSalesSearchInput] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesFromDate, setSalesFromDate] = useState<string | undefined>();
  const [salesToDate, setSalesToDate] = useState<string | undefined>();
  const [salesStatus, setSalesStatus] = useState<
    "all" | "completed" | "cancelled" | "refunded"
  >("all");
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<
    "all" | "cash" | "bank"
  >("all");
  const [useKeysetMode, setUseKeysetMode] = useState(false);
  const [keysetCursor, setKeysetCursor] = useState<{
    afterDate?: string;
    afterId?: string;
  } | null>(null);
  const salesParams: UseSalesPagedParams = {
    branchId: currentBranchId,
    page: useKeysetMode ? undefined : salesPage,
    pageSize: salesPageSize,
    search: salesSearch || undefined,
    fromDate: salesFromDate,
    toDate: salesToDate,
    mode: useKeysetMode ? "keyset" : "offset",
    afterDate: useKeysetMode ? keysetCursor?.afterDate : undefined,
    afterId: useKeysetMode ? keysetCursor?.afterId : undefined,
    status:
      salesStatus === "all"
        ? undefined
        : salesStatus === "cancelled"
        ? "refunded"
        : salesStatus === "completed"
        ? "completed"
        : salesStatus,
    paymentMethod:
      salesPaymentMethod === "all" ? undefined : salesPaymentMethod,
  };
  const {
    data: pagedSalesData,
    isLoading: loadingSales,
    error: salesError,
  } = useSalesPagedRepo(salesParams);
  const repoSales = pagedSalesData?.data || [];
  const salesMeta = pagedSalesData?.meta || {
    page: 1,
    totalPages: 1,
    total: repoSales.length,
    hasMore: false,
  };
  // Advance keyset cursor when in keyset mode and new page loaded
  useEffect(() => {
    if (useKeysetMode && pagedSalesData?.meta?.mode === "keyset") {
      setKeysetCursor({
        afterDate: (pagedSalesData.meta as any).nextAfterDate,
        afterId: (pagedSalesData.meta as any).nextAfterId,
      });
    }
  }, [useKeysetMode, pagedSalesData]);
  const { mutateAsync: createSaleAtomicAsync } = useCreateSaleAtomicRepo();
  const createCustomerDebt = useCreateCustomerDebtRepo();

  // Pagination handlers
  const goPrevPage = useCallback(
    () => setSalesPage((p) => Math.max(1, p - 1)),
    []
  );
  const goNextPage = useCallback(() => setSalesPage((p) => p + 1), []);
  const changePageSize = useCallback((sz: number) => {
    setSalesPageSize(sz);
    setSalesPage(1);
    if (useKeysetMode) setKeysetCursor(null);
  }, []);

  // Debounce search (300ms) áp dụng vào tham số query
  useEffect(() => {
    const h = setTimeout(() => {
      setSalesSearch(salesSearchInput);
      setSalesPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [salesSearchInput]);
  // States
  const [partSearch, setPartSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  // Mobile tab state - 3 tabs: products, cart, history
  const [mobileTab, setMobileTab] = useState<"products" | "cart" | "history">(
    "products"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  ); // VNĐ or %
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showQuickServiceModal, setShowQuickServiceModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    vehicleModel: "",
    licensePlate: "",
  });
  const [receiptId, setReceiptId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);
  const [receiptDiscount, setReceiptDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentType, setPaymentType] = useState<
    "full" | "partial" | "note" | null
  >(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [showOrderNote, setShowOrderNote] = useState(false);
  const [customSaleTime, setCustomSaleTime] = useState("");
  const [orderNote, setOrderNote] = useState("");

  useEffect(() => {
    if (showBarcodeInput) {
      barcodeInputRef.current?.focus();
    }
  }, [showBarcodeInput]);

  // Print preview states
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  // Fetch store settings on mount
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select(
            "store_name, address, phone, email, logo_url, bank_qr_url, bank_name, bank_account_number, bank_account_holder, bank_branch"
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

  // Cart functions
  const addToCart = useCallback(
    (part: Part) => {
      const price = part.retailPrice?.[currentBranchId] ?? 0;
      const stock = part.stock?.[currentBranchId] ?? 0;
      const existing = cartItems.find((item) => item.partId === part.id);

      if (existing) {
        // Validate stock before adding more
        const newQuantity = existing.quantity + 1;
        if (newQuantity > stock) {
          showToast.error(`Không đủ hàng! Tồn kho: ${stock}`);
          return;
        }
        setCartItems((prev) =>
          prev.map((item) =>
            item.partId === part.id ? { ...item, quantity: newQuantity } : item
          )
        );
      } else {
        // Check if stock available
        if (stock < 1) {
          showToast.error("Sản phẩm đã hết hàng!");
          return;
        }
        const newItem: CartItem = {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          sellingPrice: price,
          stockSnapshot: stock,
          discount: 0,
        };
        setCartItems((prev) => [...prev, newItem]);
      }
    },
    [cartItems, setCartItems, currentBranchId]
  );

  const removeFromCart = useCallback(
    (partId: string) => {
      setCartItems((prev) => prev.filter((item) => item.partId !== partId));
    },
    [setCartItems]
  );

  const updateCartQuantity = useCallback(
    (partId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(partId);
        return;
      }

      // Validate against stock
      const item = cartItems.find((i) => i.partId === partId);
      if (item && quantity > item.stockSnapshot) {
        showToast.error(`Không đủ hàng! Tồn kho: ${item.stockSnapshot}`);
        return;
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.partId === partId ? { ...item, quantity } : item
        )
      );
    },
    [cartItems, setCartItems, removeFromCart]
  );

  // Calculate totals
  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const total = useMemo(
    () => Math.max(0, subtotal - orderDiscount),
    [subtotal, orderDiscount]
  );

  const cartItemById = useMemo(() => {
    const map = new Map<string, CartItem>();
    cartItems.forEach((item) => map.set(item.partId, item));
    return map;
  }, [cartItems]);

  // Category color mapping for visual distinction
  const getCategoryColor = (category: string | undefined) => {
    if (!category)
      return {
        bg: "bg-slate-100 dark:bg-slate-700",
        text: "text-slate-500 dark:text-slate-400",
      };

    const colors: Record<string, { bg: string; text: string }> = {
      // Nhớt, dầu
      Nhớt: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
      },
      Dầu: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
      },
      // Lọc
      Lọc: {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      "Lọc gió": {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      "Lọc nhớt": {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      // Bugi
      Bugi: {
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-400",
      },
      // Phanh
      Phanh: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
      "Má phanh": {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
      // Xích, sên
      Xích: {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      Sên: {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      "Nhông sên dĩa": {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      // Lốp, vỏ
      Lốp: {
        bg: "bg-slate-700 dark:bg-slate-600",
        text: "text-white dark:text-slate-100",
      },
      "Vỏ xe": {
        bg: "bg-slate-700 dark:bg-slate-600",
        text: "text-white dark:text-slate-100",
      },
      // Ắc quy
      "Ắc quy": {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
      },
      "Bình điện": {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
      },
      // Đèn
      Đèn: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      "Bóng đèn": {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      // Phụ tùng điện
      Điện: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
      },
      IC: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
      },
      // Gioăng, ron
      Gioăng: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-700 dark:text-orange-400",
      },
      Ron: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-700 dark:text-orange-400",
      },
      // Vòng bi
      "Vòng bi": {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      "Bạc đạn": {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      // Cao su
      "Cao su": {
        bg: "bg-stone-200 dark:bg-stone-700/50",
        text: "text-stone-700 dark:text-stone-300",
      },
      // Phụ kiện
      "Phụ kiện": {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
      },
      // === THƯƠNG HIỆU / HÃNG XE === (màu nhạt, dễ nhìn)
      // Honda - Đỏ nhạt
      Honda: {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-700 dark:text-red-400",
      },
      // Yamaha - Xanh dương nhạt
      Yamaha: {
        bg: "bg-blue-100 dark:bg-blue-900/40",
        text: "text-blue-700 dark:text-blue-400",
      },
      // Suzuki - Xanh dương đậm nhạt
      Suzuki: {
        bg: "bg-blue-200 dark:bg-blue-900/50",
        text: "text-blue-800 dark:text-blue-300",
      },
      // SYM - Xanh sky nhạt
      SYM: {
        bg: "bg-sky-100 dark:bg-sky-900/40",
        text: "text-sky-700 dark:text-sky-400",
      },
      // Piaggio/Vespa - Xanh emerald nhạt
      Piaggio: {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-700 dark:text-emerald-400",
      },
      Vespa: {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-700 dark:text-emerald-400",
      },
      // Kymco - Cam nhạt
      Kymco: {
        bg: "bg-orange-100 dark:bg-orange-900/40",
        text: "text-orange-700 dark:text-orange-400",
      },
      // === THƯƠNG HIỆU PHỤ TÙNG ===
      // NGK - Xanh lá nhạt
      NGK: {
        bg: "bg-green-100 dark:bg-green-900/40",
        text: "text-green-700 dark:text-green-400",
      },
      // Denso - Hồng nhạt
      Denso: {
        bg: "bg-rose-100 dark:bg-rose-900/40",
        text: "text-rose-700 dark:text-rose-400",
      },
      DENSO: {
        bg: "bg-rose-100 dark:bg-rose-900/40",
        text: "text-rose-700 dark:text-rose-400",
      },
      // Kenda - Vàng amber nhạt
      Kenda: {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-700 dark:text-amber-400",
      },
      // IRC - Tím nhạt
      IRC: {
        bg: "bg-violet-100 dark:bg-violet-900/40",
        text: "text-violet-700 dark:text-violet-400",
      },
      "IRC Tire": {
        bg: "bg-violet-100 dark:bg-violet-900/40",
        text: "text-violet-700 dark:text-violet-400",
      },
      // Michelin - Xanh đậm nhạt
      Michelin: {
        bg: "bg-indigo-100 dark:bg-indigo-900/40",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      // Dunlop - Vàng nhạt
      Dunlop: {
        bg: "bg-yellow-100 dark:bg-yellow-900/40",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      // Castrol - Xanh lá nhạt
      Castrol: {
        bg: "bg-lime-100 dark:bg-lime-900/40",
        text: "text-lime-700 dark:text-lime-400",
      },
      // Shell - Vàng nhạt
      Shell: {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-700 dark:text-amber-400",
      },
      // Motul - Đỏ nhạt
      Motul: {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-700 dark:text-red-400",
      },
      // Bosch - Xám nhạt
      Bosch: {
        bg: "bg-slate-200 dark:bg-slate-700/50",
        text: "text-slate-700 dark:text-slate-300",
      },
      // Default
      Khác: {
        bg: "bg-slate-100 dark:bg-slate-700",
        text: "text-slate-600 dark:text-slate-400",
      },
    };

    // Try exact match first
    if (colors[category]) return colors[category];

    // Try partial match
    const lowerCat = category.toLowerCase();
    for (const [key, value] of Object.entries(colors)) {
      if (
        lowerCat.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lowerCat)
      ) {
        return value;
      }
    }

    // Generate consistent color based on category string hash
    const hashColors = [
      {
        bg: "bg-pink-100 dark:bg-pink-900/30",
        text: "text-pink-700 dark:text-pink-400",
      },
      {
        bg: "bg-violet-100 dark:bg-violet-900/30",
        text: "text-violet-700 dark:text-violet-400",
      },
      {
        bg: "bg-teal-100 dark:bg-teal-900/30",
        text: "text-teal-700 dark:text-teal-400",
      },
      {
        bg: "bg-lime-100 dark:bg-lime-900/30",
        text: "text-lime-700 dark:text-lime-400",
      },
      {
        bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
        text: "text-fuchsia-700 dark:text-fuchsia-400",
      },
      {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-400",
      },
    ];
    const hash = category
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hashColors[hash % hashColors.length];
  };

  // Receipt calculations
  const receiptSubtotal = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0
      ),
    [receiptItems]
  );

  const receiptTotal = useMemo(
    () => Math.max(0, receiptSubtotal - receiptDiscount),
    [receiptSubtotal, receiptDiscount]
  );

  const receiptTotalQuantity = useMemo(
    () => receiptItems.reduce((sum, item) => sum + item.quantity, 0),
    [receiptItems]
  );

  // Filter parts by search and limit to 20 items for performance
  const filteredParts = useMemo(() => {
    if (loadingParts || partsError) return [];
    let filtered = repoParts;

    if (partSearch) {
      filtered = filtered.filter(
        (part) =>
          part.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          part.sku.toLowerCase().includes(partSearch.toLowerCase())
      );
    }

    return filtered;
  }, [repoParts, partSearch, loadingParts, partsError]);

  const displayedParts = useMemo(() => {
    if (!filteredParts.length) return [];

    const normalized = filteredParts.filter((part) => {
      const branchStock = Number(part.stock?.[currentBranchId] ?? 0);
      if (stockFilter === "low") {
        return branchStock > 0 && branchStock <= LOW_STOCK_THRESHOLD;
      }
      if (stockFilter === "out") {
        return branchStock <= 0;
      }
      return true;
    });

    const weight = (stock: number) => {
      if (stock <= 0) return 2;
      if (stock <= LOW_STOCK_THRESHOLD) return 1;
      return 0;
    };

    return normalized
      .slice()
      .sort((a, b) => {
        const aStock = Number(a.stock?.[currentBranchId] ?? 0);
        const bStock = Number(b.stock?.[currentBranchId] ?? 0);
        const weightDiff = weight(aStock) - weight(bStock);
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 36);
  }, [filteredParts, stockFilter, currentBranchId]);

  // Normalize barcode/SKU: loại bỏ ký tự đặc biệt để so sánh
  // Honda: 06455-KYJ-841 → 06455kyj841
  // Yamaha: 5S9-F2101-00 → 5s9f210100
  const normalizeCode = (code: string): string => {
    return code.toLowerCase().replace(/[-\s./\\]/g, "");
  };

  // Handle barcode scan for quick add to cart
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    const normalizedBarcode = normalizeCode(barcode);

    // Tìm part với logic ưu tiên: barcode > SKU > tên
    const foundPart = filteredParts.find(
      (p) =>
        // 1. Khớp chính xác barcode (field mới)
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        // 2. Khớp SKU (normalize hoặc chính xác)
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        // 3. Tìm trong tên sản phẩm
        p.name?.toLowerCase().includes(barcode.toLowerCase())
    );

    if (foundPart) {
      addToCart(foundPart);
      showToast.success(`Đã thêm ${foundPart.name} vào giỏ hàng`);
      setBarcodeInput("");
      // Focus back to barcode input for continuous scanning
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } else {
      showToast.error(`Không tìm thấy sản phẩm có mã: ${barcode}`);
      setBarcodeInput("");
    }
  };

  // Handle camera barcode scan - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {
    console.log("📷 Camera scanned:", barcode);

    const normalizedBarcode = normalizeCode(barcode);

    // Tìm trong TẤT CẢ sản phẩm (repoParts), không phải filteredParts
    const foundPart = repoParts.find(
      (p) =>
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase()
    );

    // KHÔNG cần đóng scanner - BarcodeScannerModal tự đóng

    if (foundPart) {
      // Kiểm tra đã có trong giỏ chưa - dùng cartItems thay vì cart
      const existingItem = cartItems.find(
        (item) => item.partId === foundPart.id
      );
      if (existingItem) {
        // Chỉ tăng số lượng, không hiện toast để tránh spam
        updateCartQuantity(foundPart.id, existingItem.quantity + 1);
      } else {
        addToCart(foundPart);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
    } else {
      showToast.error(`Không tìm thấy: ${barcode}`);
    }
  };

  // Low stock monitoring (threshold = 5)
  const { lowStockCount, outOfStockCount } = useLowStock(
    repoParts,
    currentBranchId,
    LOW_STOCK_THRESHOLD
  );

  const stockFilterOptions: Array<{
    key: StockFilter;
    label: string;
    count: number;
    activeClass: string;
    inactiveClass: string;
  }> = [
    {
      key: "all",
      label: "Tất cả",
      count: filteredParts.length,
      activeClass:
        "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-blue-500/30",
      inactiveClass:
        "bg-white/80 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
    },
    {
      key: "low",
      label: "Tồn thấp",
      count: lowStockCount,
      activeClass:
        "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-amber-500/30",
      inactiveClass:
        "bg-white/80 dark:bg-slate-900/50 text-amber-700 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/60",
    },
    {
      key: "out",
      label: "Hết hàng",
      count: outOfStockCount,
      activeClass:
        "bg-gradient-to-r from-rose-500 to-red-500 text-white border-transparent shadow-rose-500/30",
      inactiveClass:
        "bg-white/80 dark:bg-slate-900/50 text-rose-700 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/60",
    },
  ];

  // One-time toast to notify low stock when opening screen
  const lowStockToastShown = useRef(false);
  useEffect(() => {
    if (
      !lowStockToastShown.current &&
      (lowStockCount > 0 || outOfStockCount > 0)
    ) {
      const msgParts = [] as string[];
      if (outOfStockCount > 0) msgParts.push(`Hết hàng: ${outOfStockCount}`);
      if (lowStockCount > 0) msgParts.push(`Tồn thấp: ${lowStockCount}`);
      showToast.info(msgParts.join(" · "));
      lowStockToastShown.current = true;
    }
  }, [lowStockCount, outOfStockCount]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 10);
    return customers
      .filter(
        (customer) =>
          customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          customer.phone?.includes(customerSearch) ||
          false
      )
      .slice(0, 10);
  }, [customers, customerSearch]);

  // Handle add new customer
  const handleSaveNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert("Vui lòng nhập tên và số điện thoại");
      return;
    }

    // Check if customer already exists
    const existingCustomer = customers.find(
      (c) => c.phone === newCustomer.phone
    );
    if (existingCustomer) {
      alert("Số điện thoại này đã tồn tại!");
      return;
    }

    // Create new customer
    const customer: Customer = {
      id: `CUST-${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      vehicleModel: newCustomer.vehicleModel,
      licensePlate: newCustomer.licensePlate,
      status: "active" as const,
      segment: "New" as const,
      loyaltyPoints: 0,
      totalSpent: 0,
      visitCount: 1,
      lastVisit: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to database using mutation
    createCustomerMutation.mutate(customer, {
      onSuccess: () => {
        // Select the new customer
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);

        // Reset form and close modal
        setNewCustomer({
          name: "",
          phone: "",
          vehicleModel: "",
          licensePlate: "",
        });
        setShowAddCustomerModal(false);
        showToast.success("Đã thêm khách hàng mới!");
      },
      onError: (error) => {
        console.error("Error creating customer:", error);
        showToast.error("Không thể thêm khách hàng. Vui lòng thử lại.");
      },
    });
  };

  // Handle print receipt - Show preview modal
  const handlePrintReceipt = (sale: Sale) => {
    setPrintSale(sale);
    setShowPrintPreview(true);
  };

  // Ref for invoice preview content
  const invoicePreviewRef = useRef<HTMLDivElement>(null);

  // Handle share invoice as image
  const handleShareInvoice = async () => {
    if (!invoicePreviewRef.current || !printSale) return;

    try {
      showToast.info("Đang tạo hình ảnh...");

      // Dynamic import html2canvas
      const html2canvas = (await import("html2canvas")).default;

      const canvas = await html2canvas(invoicePreviewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      const fileName = `hoa-don-${
        printSale.sale_code || formatAnyId(printSale.id) || printSale.id
      }.png`;

      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share({
            files: [file],
            title: "Hóa đơn bán hàng",
            text: `Hóa đơn ${printSale.sale_code || formatAnyId(printSale.id)}`,
          });
          showToast.success("Đã chia sẻ hóa đơn!");
          return;
        }
      }

      // Fallback: Download image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast.success("Đã tải xuống hình ảnh hóa đơn!");
    } catch (error) {
      console.error("Share error:", error);
      showToast.error("Không thể chia sẻ hóa đơn");
    }
  };

  // Handle actual print after preview
  const handleDoPrint = () => {
    if (!printSale) return;

    // Set receipt data for hidden element
    setReceiptId(
      printSale.sale_code || formatAnyId(printSale.id) || printSale.id
    );
    setCustomerName(printSale.customer.name);
    setCustomerPhone(printSale.customer.phone || "");

    const normalizedItems: CartItem[] = printSale.items.map((item: any) => ({
      partId: item.partId || item.partid || "",
      partName: item.partName || item.partname || "",
      sku: item.sku || "",
      quantity: item.quantity || 0,
      sellingPrice:
        item.sellingPrice || item.sellingprice || (item as any).price || 0,
      stockSnapshot: item.stockSnapshot || 0,
      discount: item.discount || 0,
    }));

    setReceiptItems(normalizedItems);
    setReceiptDiscount(printSale.discount || 0);

    // Wait for state update then print
    setTimeout(() => {
      printElementById("last-receipt");
      setShowPrintPreview(false);
      setPrintSale(null);
    }, 100);
  };

  // Handle delete sale
  const { profile } = useAuth();
  const handleDeleteSale = async (saleId: string) => {
    if (!canDo(profile?.role, "sale.delete")) {
      showToast.error("Bạn không có quyền xóa hóa đơn");
      return;
    }
    if (
      !confirm("Xác nhận xóa hóa đơn này? Hành động này không thể hoàn tác.")
    ) {
      return;
    }

    try {
      // Import deleteSaleById directly
      const { deleteSaleById } = await import(
        "../../lib/repository/salesRepository"
      );
      const result = await deleteSaleById(saleId);

      if (!result.ok) {
        showToast.error(result.error?.message || "Xóa hóa đơn thất bại!");
        return;
      }

      // Invalidate and refetch sales query
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      showToast.success("Đã xóa hóa đơn thành công!");

      // Best-effort audit log (non-blocking)
      void safeAudit(profile?.id || null, {
        action: "sale.delete",
        tableName: "sales",
        recordId: saleId,
        oldData: null,
        newData: null,
      });
    } catch (error) {
      showToast.error("Xóa hóa đơn thất bại!");
      console.error("Delete sale error:", error);
    }
  };

  // Handle edit sale (reopen in cart)
  const handleEditSale = (sale: Sale) => {
    if (
      !confirm("Mở lại hóa đơn này để chỉnh sửa? Giỏ hàng hiện tại sẽ bị xóa.")
    ) {
      return;
    }

    // Clear current cart
    clearCart();

    // Load sale items into cart
    sale.items.forEach((item) => {
      // Find the part to add to cart
      const part = repoParts.find((p) => p.id === item.partId);
      if (part) {
        for (let i = 0; i < item.quantity; i++) {
          addToCart(part);
        }
      }
    });

    // Load customer if exists
    if (sale.customer.id) {
      const customer = customers.find((c) => c.id === sale.customer.id);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
      }
    } else {
      setCustomerName(sale.customer.name);
      setCustomerPhone(sale.customer.phone || "");
    }

    // Load discount
    setOrderDiscount(sale.discount || 0);

    // Close history modal
    setShowSalesHistory(false);

    alert("Hóa đơn đã được tải vào giỏ hàng để chỉnh sửa");
  };

  // Handle update sale (from edit modal)
  const handleUpdateSale = async (updatedSale: {
    id: string;
    items: CartItem[];
    customer: { id?: string; name: string; phone?: string };
    paymentMethod: "cash" | "bank";
    discount: number;
  }) => {
    try {
      // TODO: Implement actual update logic with Supabase
      // This would need to:
      // 1. Update the sales record
      // 2. Update inventory transactions (reverse old, apply new)
      // 3. Update cash transactions
      // For now, just show a message
      showToast.info("Tính năng cập nhật đơn hàng đang được phát triển");

      // Audit log
      await safeAudit(profile?.id || null, {
        action: "sale_update_attempt",
        tableName: "sales",
        recordId: updatedSale.id,
        newData: {
          items: updatedSale.items,
          customer: updatedSale.customer,
          paymentMethod: updatedSale.paymentMethod,
          discount: updatedSale.discount,
        },
      });

      // Note: When implemented, the sales list will refresh automatically
      // via React Query when the component re-renders
    } catch (error) {
      console.error("Error updating sale:", error);
      throw error;
    }
  };

  // Create customer debt if there's remaining amount (similar to ServiceManager)
  const createCustomerDebtIfNeeded = async (
    sale: Sale,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    console.log("[createCustomerDebtIfNeeded] CALLED with:", {
      saleId: sale.id,
      totalAmount,
      paidAmount,
      remainingAmount,
      customerName: sale.customer.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const safeCustomerId =
        sale.customer.id || sale.customer.phone || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        sale.customer.name?.trim() || sale.customer.phone || "Khách lẻ";

      // Tạo nội dung chi tiết từ hóa đơn bán hàng - dùng sale_code thay vì UUID
      const saleCode = sale.sale_code || sale.id;
      let description = `Bán hàng - Hóa đơn ${saleCode}`;

      // Danh sách sản phẩm đã mua
      if (sale.items && sale.items.length > 0) {
        description += "\n\nSản phẩm đã mua:";
        sale.items.forEach((item: any) => {
          const itemTotal = item.quantity * item.sellingPrice;
          const itemDiscount = item.discount || 0;
          description += `\n  • ${item.quantity} x ${
            item.partName
          } - ${formatCurrency(itemTotal)}`;
          if (itemDiscount > 0) {
            description += ` (Giảm: ${formatCurrency(itemDiscount)})`;
          }
        });
      }

      // Giảm giá đơn hàng (nếu có)
      if (sale.discount && sale.discount > 0) {
        description += `\n\nGiảm giá đơn hàng: -${formatCurrency(
          sale.discount
        )}`;
      }

      // Phương thức thanh toán
      const paymentMethodText =
        sale.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản";
      description += `\n\nPhương thức: ${paymentMethodText}`;

      // Thông tin nhân viên
      description += `\n\nNV: ${sale.userName || "N/A"}`;

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: sale.customer.phone || null,
        licensePlate: null, // Sales không có biển số xe
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        saleId: sale.id, // 🔹 Link debt với sale
      };

      console.log("[SalesManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[SalesManager] createCustomerDebt result:", result);
      showToast.success(
        `Đã tạo công nợ ${formatCurrency(
          remainingAmount
        )} cho ${safeCustomerName}`
      );
    } catch (error: any) {
      console.error("Error creating customer debt:", error);
      // Log chi tiết error để debug
      console.error("Error details:", {
        message: error?.message,
        cause: error?.cause,
        stack: error?.stack,
      });
      showToast.error(
        `Không thể tạo công nợ tự động: ${
          error?.message || "Lỗi không xác định"
        }`
      );
    }
  };

  // Handle finalize sale
  const handleFinalize = async () => {
    if (cartItems.length === 0) {
      alert("Vui lòng thêm sản phẩm vào giỏ hàng");
      return;
    }

    // Kiểm tra bắt buộc phải có thông tin khách hàng
    if (!selectedCustomer && !customerName && !customerPhone) {
      alert("Vui lòng nhập thông tin khách hàng trước khi bán hàng");
      return;
    }

    if (!paymentMethod) {
      alert("Vui lòng chọn phương thức thanh toán");
      return;
    }

    if (!paymentType) {
      alert("Vui lòng chọn hình thức thanh toán");
      return;
    }

    if (paymentType === "partial" && partialAmount <= 0) {
      alert("Vui lòng nhập số tiền khách trả");
      return;
    }

    try {
      // Kiểm tra tồn kho mới nhất trước khi tạo đơn
      for (const item of cartItems) {
        const part = repoParts.find((p) => p.id === item.partId);
        if (!part) {
          showToast.error(`Không tìm thấy sản phẩm: ${item.partName}`);
          return;
        }
        const stock = part.stock?.[currentBranchId] ?? 0;
        if (item.quantity > stock) {
          showToast.error(`Không đủ hàng cho ${part.name}. Tồn kho: ${stock}`);
          return;
        }
      }
      const saleId = `SALE-${Date.now()}`;
      const lineSubtotal = cartItems.reduce(
        (sum, it) => sum + it.sellingPrice * it.quantity,
        0
      );
      const lineDiscounts = cartItems.reduce(
        (sum, it) => sum + (it.discount || 0),
        0
      );
      const total = Math.max(0, lineSubtotal - lineDiscounts - orderDiscount);
      const customerObj = {
        id: selectedCustomer?.id,
        name: selectedCustomer?.name || customerName || "Khách lẻ",
        phone: selectedCustomer?.phone || customerPhone,
      };

      // Set receipt info for printing BEFORE clearing cart
      setReceiptId(saleId);
      setCustomerName(customerObj.name);
      setCustomerPhone(customerObj.phone || "");
      setReceiptItems([...cartItems]);
      setReceiptDiscount(orderDiscount + lineDiscounts);

      // Create customer if new (has phone nhưng chưa chọn từ danh sách)
      if (!selectedCustomer && customerPhone && customerName) {
        const existingCustomer = customers.find(
          (c) => c.phone === customerPhone
        );
        if (!existingCustomer) {
          upsertCustomer({
            id: `CUST-${Date.now()}`,
            name: customerName,
            phone: customerPhone,
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
      // Gọi RPC atomic đảm bảo tất cả bước (xuất kho, tiền mặt, cập nhật tồn, ghi hóa đơn, audit) thực hiện trong 1 transaction server
      const rpcRes = await createSaleAtomicAsync({
        id: saleId,
        items: cartItems,
        discount: orderDiscount + lineDiscounts,
        customer: customerObj,
        paymentMethod: paymentMethod!,
        userId: profile?.id || "local-user",
        userName: profile?.full_name || profile?.email || "Nhân viên",
        branchId: currentBranchId,
      } as any);
      if ((rpcRes as any)?.error) throw (rpcRes as any).error;

      // Calculate paid amount based on payment type
      const paidAmount =
        paymentType === "full"
          ? total
          : paymentType === "partial"
          ? partialAmount
          : 0; // paymentType === "note" (ghi nợ)

      const remainingAmount = total - paidAmount;

      console.log("[SalesManager] Payment details:", {
        paymentType,
        total,
        paidAmount,
        partialAmount,
        remainingAmount,
        hasCustomer: !!(selectedCustomer || customerName || customerPhone),
      });

      // Create customer debt if there's remaining amount
      if (remainingAmount > 0) {
        console.log("[SalesManager] Creating debt because remaining > 0");

        // Fetch the newly created sale to get the sale_code (generated by trigger)
        const { data: createdSale, error: fetchError } = await supabase
          .from("sales")
          .select(
            `
            *,
            user:userid(
              full_name,
              display_name,
              email
            )
          `
          )
          .eq("id", saleId)
          .single();

        if (fetchError) {
          console.error("[SalesManager] Error fetching sale:", fetchError);
        }

        // Map user info to userName
        const saleWithUserName = createdSale
          ? {
              ...createdSale,
              userName:
                createdSale.user?.full_name ||
                createdSale.user?.display_name ||
                createdSale.user?.email ||
                "N/A",
            }
          : null;

        const saleData: Sale =
          saleWithUserName ||
          ({
            id: saleId,
            sale_code: undefined,
            date: new Date().toISOString(),
            items: cartItems,
            subtotal: subtotal,
            discount: orderDiscount + lineDiscounts,
            total: total,
            customer: customerObj,
            paymentMethod: paymentMethod,
            userName: profile?.full_name || profile?.email || "Nhân viên",
            userId: profile?.id || "",
            branchId: currentBranchId || "",
          } as Sale);

        console.log("[SalesManager] Sale data for debt:", saleData);

        await createCustomerDebtIfNeeded(
          saleData,
          remainingAmount,
          total,
          paidAmount
        );
      } else {
        console.log("[SalesManager] No debt needed, paid in full");
      }

      // Clear form
      setSelectedCustomer(null);
      setCustomerSearch("");
      setOrderDiscount(0);
      setDiscountPercent(0);
      setDiscountType("amount");
      setPaymentMethod(null);
      setPaymentType(null);
      setPartialAmount(0);
      clearCart();

      // Print receipt after state updates only if autoPrintReceipt is checked
      if (autoPrintReceipt) {
        setTimeout(() => {
          printElementById("last-receipt");
        }, 100);
      }
    } catch (error: any) {
      console.error("Error finalizing sale (atomic):", error);
      showToast.error(error?.message || "Có lỗi khi tạo hóa đơn (atomic)");
    }
  };

  // Quick service handler
  const handleQuickServiceComplete = async (
    service: { id: string; name: string; price: number; category?: string },
    quantity: number,
    paymentMethod: "cash" | "bank",
    customer: {
      id?: string;
      name: string;
      phone: string;
      vehicleModel: string;
      licensePlate: string;
    }
  ) => {
    try {
      const servicePrice = service.price * quantity;
      const saleId = crypto.randomUUID();

      // Create a virtual cart item for the service
      const serviceItem: CartItem = {
        partId: `quick_service_${service.id}`,
        name: service.name,
        quantity: quantity,
        price: service.price,
        category: service.category || "Dịch vụ nhanh",
        discount: 0,
      };

      // Call RPC to create sale atomically
      const rpcRes = await createSaleAtomicAsync({
        id: saleId,
        items: [serviceItem],
        discount: 0,
        customer: customer,
        customerId: customer.id, // Truyền customerId để tích điểm
        paymentMethod: paymentMethod,
        userId: profile?.id || "local-user",
        userName: profile?.full_name || profile?.email || "Nhân viên",
        branchId: currentBranchId,
      } as any);

      if ((rpcRes as any)?.error) throw (rpcRes as any).error;

      // Nếu có customerId, cập nhật totalspent cho khách hàng
      if (customer.id) {
        try {
          // Lấy totalspent hiện tại
          const { data: currentCustomer } = await supabase
            .from("customers")
            .select("totalspent")
            .eq("id", customer.id)
            .single();

          const currentTotal = currentCustomer?.totalspent || 0;

          // Cập nhật totalspent mới
          await supabase
            .from("customers")
            .update({
              totalspent: currentTotal + servicePrice,
              lastvisit: new Date().toISOString(),
            })
            .eq("id", customer.id);

          console.log(
            `[QuickService] Updated customer ${customer.name} totalspent: ${currentTotal} + ${servicePrice}`
          );
        } catch (err) {
          console.error(
            "[QuickService] Error updating customer totalspent:",
            err
          );
        }
      }

      const customerLabel =
        customer.name !== "Khách vãng lai"
          ? customer.name
          : customer.licensePlate
          ? `Biển số ${customer.licensePlate}`
          : "Khách vãng lai";

      showToast.success(
        `✅ ${service.name} x${quantity} - ${servicePrice.toLocaleString(
          "vi-VN"
        )}đ (${customerLabel})`
      );

      // Close modal
      setShowQuickServiceModal(false);
    } catch (error: any) {
      console.error("Error creating quick service sale:", error);
      showToast.error(error?.message || "Có lỗi khi tạo đơn dịch vụ nhanh");
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".customer-dropdown-container")) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 pb-16 md:pb-0">
      {/* Mobile Bottom Tabs - Fixed at bottom - 4 tabs: Sản phẩm, Giỏ hàng, DV nhanh, Lịch sử */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-bottom">
        {/* Backdrop blur effect for modern look */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          <button
            onClick={() => setMobileTab("products")}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 ${
              mobileTab === "products"
                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                : "text-slate-600 dark:text-slate-400 active:scale-95"
            }`}
          >
            <Boxes
              className={`w-6 h-6 transition-transform ${
                mobileTab === "products" ? "scale-105" : ""
              }`}
            />
            <span
              className={`text-[9px] font-medium ${
                mobileTab === "products" ? "font-semibold" : ""
              }`}
            >
              Sản phẩm
            </span>
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 relative ${
              mobileTab === "cart"
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
                : "text-slate-600 dark:text-slate-400 active:scale-95"
            }`}
          >
            <div className="relative">
              <ShoppingCart
                className={`w-6 h-6 transition-transform ${
                  mobileTab === "cart" ? "scale-105" : ""
                }`}
              />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] text-[8px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </div>
            <span
              className={`text-[9px] font-medium ${
                mobileTab === "cart" ? "font-semibold" : ""
              }`}
            >
              Giỏ hàng
            </span>
          </button>
          <button
            onClick={() => setShowQuickServiceModal(true)}
            className="flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 text-amber-600 dark:text-amber-400 active:scale-95 active:bg-amber-50 dark:active:bg-amber-900/30"
          >
            <Zap className="w-6 h-6" />
            <span className="text-[9px] font-medium">DV nhanh</span>
          </button>
          <button
            onClick={() => {
              setMobileTab("history");
              setShowSalesHistory(true);
            }}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 ${
              mobileTab === "history"
                ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
                : "text-slate-600 dark:text-slate-400 active:scale-95"
            }`}
          >
            <History
              className={`w-6 h-6 transition-transform ${
                mobileTab === "history" ? "scale-105" : ""
              }`}
            />
            <span
              className={`text-[9px] font-medium ${
                mobileTab === "history" ? "font-semibold" : ""
              }`}
            >
              Lịch sử
            </span>
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)] md:h-screen">
        {/* Main Content Area - Products Grid */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            mobileTab !== "products" ? "hidden md:flex" : "animate-fade-in"
          }`}
        >
          {/* Search Bar */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 p-3 md:p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-stretch gap-2">
                  {/* Manual Search */}
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
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
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm..."
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-300/50 dark:border-slate-600/50 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeInput((prev) => !prev)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm flex items-center gap-2 transition-all ${
                      showBarcodeInput
                        ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-800"
                    }`}
                  >
                    <ScanLine className="w-4 h-4" />
                    <span className="hidden md:inline">
                      {showBarcodeInput ? "Đóng quét" : "Quét mã"}
                    </span>
                  </button>
                  {/* Camera scan button - mobile only */}
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="md:hidden px-3 py-2 rounded-xl border-2 border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-green-100"
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
                {showBarcodeInput && (
                  <form onSubmit={handleBarcodeSubmit} className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
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
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Nhập hoặc quét mã vạch..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-blue-400 dark:border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition-all placeholder:text-blue-500/70 font-mono"
                    />
                    {barcodeInput && (
                      <button
                        type="button"
                        onClick={() => setBarcodeInput("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                    )}
                  </form>
                )}
              </div>
              {/* History button - only show on desktop since mobile has tab */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setShowQuickServiceModal(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl whitespace-nowrap transition-all inline-flex items-center gap-2 text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Dịch vụ nhanh - Rửa xe, vá xe..."
                >
                  <Zap className="w-5 h-5" />
                  <span>Dịch vụ nhanh</span>
                </button>
                <button
                  onClick={() => setShowSalesHistory(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl whitespace-nowrap transition-all inline-flex items-center gap-2 text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Lịch sử bán hàng"
                >
                  <History className="w-5 h-5" />
                  <span>Lịch sử</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="bg-white/80 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/60 px-3 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
              Hiển thị {displayedParts.length} / {filteredParts.length || 0} sản
              phẩm
              {partSearch && " theo từ khóa"}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {stockFilterOptions.map((option) => {
                const isActive = stockFilter === option.key;
                return (
                  <button
                    type="button"
                    key={option.key}
                    aria-pressed={isActive}
                    onClick={() => setStockFilter(option.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                      isActive ? option.activeClass : option.inactiveClass
                    }`}
                  >
                    <span>{option.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                        isActive
                          ? "bg-white/30"
                          : "bg-slate-100 dark:bg-slate-800"
                      }`}
                    >
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-0 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-24 md:pb-6">
            {displayedParts.length === 0 ? (
              <div className="text-center text-slate-400 mt-20">
                <div className="mb-4 flex items-center justify-center">
                  <Boxes className="w-16 h-16 text-slate-300" />
                </div>
                <div className="text-xl font-medium mb-2">
                  {filteredParts.length === 0
                    ? partSearch
                      ? "Không tìm thấy sản phẩm nào"
                      : "Chưa có sản phẩm"
                    : stockFilter === "low"
                    ? "Không có sản phẩm tồn thấp"
                    : "Không có sản phẩm hết hàng"}
                </div>
                <div className="text-sm">
                  {filteredParts.length === 0
                    ? partSearch
                      ? "Hãy thử một từ khóa tìm kiếm khác"
                      : "Vui lòng thêm sản phẩm vào hệ thống"
                    : "Hãy chọn bộ lọc khác để xem thêm sản phẩm"}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-3">
                {displayedParts.map((part) => {
                  const price = Number(
                    part.retailPrice?.[currentBranchId] ?? 0
                  );
                  const stock = Number(part.stock?.[currentBranchId] ?? 0);
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
                  const cartItem = cartItemById.get(part.id);
                  const inCart = Boolean(cartItem);
                  const statusLabel = isOutOfStock
                    ? "Hết hàng"
                    : isLowStock
                    ? "Tồn thấp"
                    : "Sẵn hàng";
                  const statusClass = isOutOfStock
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-200"
                    : isLowStock
                    ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200"
                    : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200";
                  const stockBadgeClass = isOutOfStock
                    ? "bg-gradient-to-r from-rose-500 to-red-500 text-white"
                    : isLowStock
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    : "bg-gradient-to-r from-emerald-500 to-green-500 text-white";

                  return (
                    <div
                      key={part.id}
                      className={`group relative text-left p-2.5 md:p-3 rounded-xl border transition-all duration-200 h-full ${
                        isOutOfStock
                          ? "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60"
                          : "bg-white dark:bg-slate-800/70 border-slate-200/70 dark:border-slate-700 md:hover:border-blue-400 md:dark:hover:border-blue-500 md:hover:shadow-xl md:hover:-translate-y-0.5 md:cursor-pointer"
                      } ${
                        inCart
                          ? "ring-2 ring-blue-400 dark:ring-blue-500/60 shadow-md shadow-blue-500/20"
                          : ""
                      }`}
                      onClick={() => {
                        // Desktop: click anywhere to add
                        if (window.innerWidth >= 768 && !isOutOfStock) {
                          addToCart(part);
                        }
                      }}
                    >
                      <div className="flex flex-col h-full">
                        {/* Header: In cart badge */}
                        {inCart && (
                          <div className="absolute -top-2.5 -right-2.5 z-10">
                            <span className="flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-bold rounded-full bg-blue-500 text-white shadow-lg ring-2 ring-white dark:ring-slate-800">
                              {cartItem?.quantity}
                            </span>
                          </div>
                        )}

                        {/* Product name + SKU + Category */}
                        <div className="mb-2 flex-1">
                          <h3
                            className="font-semibold text-xs md:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight"
                            title={part.name}
                          >
                            {part.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
                              {part.sku}
                            </span>
                            {part.category && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[70px] ${
                                  getCategoryColor(part.category).bg
                                } ${getCategoryColor(part.category).text}`}
                              >
                                {part.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price + Stock + Add button */}
                        <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                          <div>
                            <p
                              className={`text-sm font-bold ${
                                isOutOfStock
                                  ? "text-slate-400 dark:text-slate-500"
                                  : "text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {formatCurrency(price)}
                            </p>
                            <span
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                isOutOfStock
                                  ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                  : isLowStock
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              }`}
                            >
                              Tồn: {Math.max(0, Math.floor(stock))}
                            </span>
                          </div>
                          {/* Mobile: Add to cart button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isOutOfStock) addToCart(part);
                            }}
                            disabled={isOutOfStock}
                            className={`md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                              isOutOfStock
                                ? "bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                                : "bg-blue-500 text-white shadow-md active:scale-95"
                            }`}
                          >
                            {isOutOfStock ? (
                              <span className="text-slate-400 text-xs">✕</span>
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Customer, Cart & Checkout */}
        <div
          className={`w-full md:w-[40%] bg-white dark:bg-slate-800 md:border-l border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 overflow-y-auto ${
            mobileTab !== "cart" ? "hidden md:flex" : "animate-fade-in"
          }`}
        >
          {/* Customer Selection */}
          <div className="p-3 md:p-4 border-b border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800 md:bg-gradient-to-r md:from-emerald-50/30 md:via-teal-50/20 md:to-cyan-50/30 dark:md:from-slate-800/50 dark:md:via-slate-800/30 dark:md:to-slate-800/50">
            <div className="customer-dropdown-container">
              <label className="flex items-center gap-2 text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-emerald-500 md:bg-gradient-to-br md:from-emerald-500 md:to-teal-500 rounded-lg flex items-center justify-center md:shadow-lg">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-white"
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
                </div>
                <span>Khách hàng</span>
              </label>
              <div className="relative flex flex-col md:flex-row gap-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm tên, số điện thoại..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => {
                      // Delay hiding dropdown to allow click on items
                      setTimeout(() => setShowCustomerDropdown(false), 200);
                    }}
                    className="w-full pl-10 pr-4 py-2 md:py-2.5 border md:border-2 border-slate-300 md:border-slate-300/50 dark:border-slate-600/50 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                  {/* Dropdown results - positioned relative to input container */}
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setCustomerSearch(customer.name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-600 border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                              {customer.name}
                            </div>
                            {customer.phone && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                📞 {customer.phone}
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-center text-slate-500 dark:text-slate-400 text-sm">
                          {customerSearch ? (
                            <>
                              <div>Không tìm thấy khách hàng</div>
                              <button
                                onClick={() => setShowAddCustomerModal(true)}
                                className="mt-2 text-emerald-500 hover:text-emerald-600 font-medium"
                              >
                                + Thêm khách hàng mới
                              </button>
                            </>
                          ) : customers.length === 0 ? (
                            <div>Chưa có khách hàng nào</div>
                          ) : (
                            <div>Nhập tên hoặc SĐT để tìm...</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-3 py-2 md:px-4 md:py-2.5 bg-emerald-500 md:bg-gradient-to-r md:from-emerald-500 md:to-teal-500 hover:bg-emerald-600 md:hover:from-emerald-600 md:hover:to-teal-600 text-white rounded-lg md:rounded-xl flex items-center justify-center gap-2 transition-all md:shadow-lg md:hover:shadow-xl md:hover:scale-105 md:active:scale-95 font-semibold md:font-bold"
                  title="Thêm khách hàng mới"
                >
                  <PlusIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline text-sm">Thêm</span>
                </button>
              </div>
              {selectedCustomer && (
                <div className="mt-2 md:mt-3 p-2 md:p-3.5 bg-emerald-50 dark:bg-emerald-900/20 md:bg-gradient-to-r md:from-emerald-50 md:to-teal-50 dark:md:from-emerald-900/20 dark:md:to-teal-900/20 rounded-lg md:rounded-xl border md:border-2 border-emerald-200 dark:border-emerald-800 md:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                      <div className="hidden md:flex w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg items-center justify-center shadow-lg flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-white"
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
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium md:font-bold text-emerald-900 dark:text-emerald-100 truncate text-sm md:text-base">
                          {selectedCustomer.name}
                        </div>
                        {selectedCustomer.phone && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                            <svg
                              className="w-3 h-3 flex-shrink-0 hidden md:inline"
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
                            <span className="truncate">
                              {selectedCustomer.phone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                      }}
                      className="w-7 h-7 md:w-8 md:h-8 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md md:rounded-lg flex items-center justify-center transition-all flex-shrink-0 md:shadow-sm md:hover:shadow-md text-lg"
                      title="Xóa"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 md:pb-3 border-b md:border-b-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg items-center justify-center shadow-lg">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-semibold md:font-black text-slate-900 dark:text-slate-100">
                  Giỏ hàng
                </h3>
              </div>
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-blue-100 md:bg-gradient-to-r md:from-blue-100 md:to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold md:font-bold md:shadow-sm">
                {cartItems.length}
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-12 md:py-16 mb-3">
                <div className="mb-3 md:mb-4 flex items-center justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 md:bg-gradient-to-br md:from-slate-100 md:to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl md:rounded-3xl flex items-center justify-center md:shadow-lg">
                    <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                <div className="text-sm md:text-base font-semibold md:font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Giỏ hàng trống
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  Chọn sản phẩm để thêm vào giỏ
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 md:space-y-2.5">
                {cartItems.map((item) => {
                  const partInfo = repoParts.find((p) => p.id === item.partId);
                  return (
                    <div
                      key={item.partId}
                      className="group p-2 md:p-3 border md:border-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 rounded-lg md:rounded-xl bg-white dark:bg-slate-800 md:hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 md:hover:shadow-lg md:hover:shadow-blue-500/10"
                    >
                      {/* Mobile: Compact horizontal layout */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between gap-2">
                          {/* Left: Name + SKU + Category */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight truncate"
                              title={item.partName}
                            >
                              {item.partName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {item.sku}
                              </span>
                              {partInfo?.category && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                    getCategoryColor(partInfo.category).bg
                                  } ${
                                    getCategoryColor(partInfo.category).text
                                  }`}
                                >
                                  {partInfo.category}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                              {formatCurrency(item.sellingPrice)}
                            </div>
                          </div>
                          {/* Right: Quantity controls */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  item.partId,
                                  item.quantity - 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all font-bold text-base"
                            >
                              -
                            </button>
                            <span className="w-7 text-center font-bold text-xs text-slate-900 dark:text-slate-100">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  item.partId,
                                  item.quantity + 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 rounded-md text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-all font-bold text-base"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Horizontal layout with category */}
                      <div className="hidden md:flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                          <Boxes className="w-6 h-6 text-orange-500 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 mb-0.5"
                            title={item.partName}
                          >
                            {item.partName}
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                              {item.sku}
                            </span>
                            {partInfo?.category && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  getCategoryColor(partInfo.category).bg
                                } ${getCategoryColor(partInfo.category).text}`}
                              >
                                {partInfo.category}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                            {formatCurrency(item.sellingPrice)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() =>
                              updateCartQuantity(item.partId, item.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/30 dark:hover:to-red-800/30 hover:text-red-500 transition-all shadow-sm hover:shadow-md font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-black text-sm text-slate-900 dark:text-slate-100 px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item.partId, item.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 rounded-lg text-white hover:from-blue-600 hover:to-indigo-600 dark:hover:from-blue-700 dark:hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checkout Section */}
          {cartItems.length > 0 && (
            <div className="border-t md:border-t-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800 md:bg-gradient-to-br md:from-slate-50 md:to-blue-50/30 dark:md:from-slate-800 dark:md:to-slate-800/50">
              {/* Summary */}
              <div className="p-3 md:p-4 space-y-2 md:space-y-3 pb-20 md:pb-3">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Tổng tiền hàng
                  </span>
                  <span className="font-semibold md:font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="space-y-2 md:space-y-2.5">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between text-xs md:text-sm gap-1.5 md:gap-2">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Giảm giá:
                    </span>
                    <div className="flex items-center gap-1.5 md:gap-2 w-full md:w-auto">
                      <input
                        type="number"
                        value={
                          discountType === "amount"
                            ? orderDiscount
                            : discountPercent
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (discountType === "amount") {
                            setOrderDiscount(Math.min(value, subtotal));
                          } else {
                            const percent = Math.min(value, 100);
                            setDiscountPercent(percent);
                            setOrderDiscount(
                              Math.round((subtotal * percent) / 100)
                            );
                          }
                        }}
                        className="flex-1 md:w-24 px-2 md:px-3 py-1.5 md:py-2 text-right text-xs md:text-sm border md:border-2 border-slate-300 md:border-slate-300 dark:border-slate-600 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium md:font-semibold"
                        placeholder="0"
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
                          setOrderDiscount(0);
                          setDiscountPercent(0);
                        }}
                        className="px-2 md:px-3 py-1.5 md:py-2 border md:border-2 border-slate-300 md:border-slate-300 dark:border-slate-600 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs md:text-sm font-semibold md:font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        <option value="amount">₫</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick percent buttons */}
                  {discountType === "percent" && (
                    <div className="flex gap-1.5 md:gap-2 justify-end flex-wrap">
                      {[5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => {
                            setDiscountPercent(percent);
                            setOrderDiscount(
                              Math.round((subtotal * percent) / 100)
                            );
                          }}
                          className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold md:font-bold bg-purple-100 md:bg-gradient-to-r md:from-purple-100 md:to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 hover:bg-purple-200 md:hover:from-purple-200 md:hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 text-purple-700 dark:text-purple-300 rounded-md md:rounded-lg transition-all md:shadow-sm md:hover:shadow-md"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show amount if percent mode */}
                  {discountType === "percent" && discountPercent > 0 && (
                    <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 text-right">
                      = {formatCurrency(orderDiscount)}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-2 md:pt-3 mt-2 md:mt-3 border-t md:border-t-2 border-slate-200 dark:border-slate-700 p-2 md:p-3 -mx-3 md:-mx-4 bg-blue-600 md:bg-gradient-to-r md:from-blue-600 md:to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-b-lg md:rounded-b-xl md:shadow-lg">
                  <span className="font-semibold md:font-bold text-white text-xs md:text-sm">
                    Khách phải trả
                  </span>
                  <span className="font-black text-lg md:text-2xl text-white">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-3 md:px-4 pb-3 md:pb-4">
                <label className="flex items-center gap-2 text-xs md:text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                  <span>Phương thức thanh toán</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border md:border-2 transition-all font-semibold md:font-bold md:shadow-sm md:hover:shadow-md ${
                      paymentMethod === "cash"
                        ? "border-emerald-600 bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white md:shadow-lg"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm">Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border md:border-2 transition-all font-semibold md:font-bold md:shadow-sm md:hover:shadow-md ${
                      paymentMethod === "bank"
                        ? "border-blue-600 bg-blue-500 text-white dark:bg-blue-600 dark:text-white md:shadow-lg"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm">Chuyển khoản</span>
                  </button>
                </div>
              </div>

              {/* Payment Type */}
              {paymentMethod && (
                <div className="px-3 md:px-4 pb-3 md:pb-4">
                  <label className="block text-xs md:text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                    Hình thức
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${
                        paymentType === "full"
                          ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                      }`}
                    >
                      Đủ
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${
                        paymentType === "partial"
                          ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                      }`}
                    >
                      1 phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${
                        paymentType === "note"
                          ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                      }`}
                    >
                      Ghi nợ
                    </button>
                  </div>
                </div>
              )}

              {/* Partial Payment Amount */}
              {paymentType === "partial" && (
                <div className="px-4 pb-3">
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Số tiền khách trả
                  </label>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) =>
                      setPartialAmount(Number(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    placeholder="0"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Còn lại:{" "}
                    {formatCurrency(
                      Math.max(0, total - orderDiscount - partialAmount)
                    )}{" "}
                    đ
                  </div>
                </div>
              )}

              {/* Options - Button Toggle Style */}
              <div className="px-3 md:px-4 pb-3 md:pb-3 space-y-3">
                {/* Thời gian bán hàng - Toggle buttons */}
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Thời gian bán hàng
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseCurrentTime(true)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${
                        useCurrentTime
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                      }`}
                    >
                      <span className="text-xs">🕐 Hiện tại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCurrentTime(false)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${
                        !useCurrentTime
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                      }`}
                    >
                      <span className="text-xs">📅 Tùy chỉnh</span>
                    </button>
                  </div>
                  {/* Datetime picker when custom time selected */}
                  {!useCurrentTime && (
                    <input
                      type="datetime-local"
                      value={customSaleTime}
                      onChange={(e) => setCustomSaleTime(e.target.value)}
                      className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>

                {/* Tùy chọn thêm - Toggle buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderNote(!showOrderNote)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${
                      showOrderNote
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    <span className="text-xs">📝 Ghi chú</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${
                      autoPrintReceipt
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                    }`}
                  >
                    <span className="text-xs">🖨️ In hoá đơn</span>
                  </button>
                </div>
                {/* Note textarea when note option selected */}
                {showOrderNote && (
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Nhập ghi chú cho đơn hàng..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-3 md:p-4 pt-0 flex flex-col md:flex-row gap-2 md:gap-3">
                <button
                  onClick={clearCart}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-white dark:bg-slate-700 border md:border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold md:font-bold rounded-lg md:rounded-xl transition-all md:shadow-sm md:hover:shadow-md text-sm md:text-base"
                >
                  LƯU NHÁP
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={!paymentMethod || !paymentType}
                  className={`flex-1 px-3 md:px-4 py-2 md:py-3 font-bold md:font-black rounded-lg md:rounded-xl transition-all md:shadow-lg text-sm md:text-base ${
                    paymentMethod && paymentType
                      ? "bg-orange-500 md:bg-gradient-to-r md:from-orange-500 md:to-red-500 hover:bg-orange-600 md:hover:from-orange-600 md:hover:to-red-600 text-white md:shadow-orange-500/30 md:hover:shadow-xl md:hover:shadow-orange-500/40 md:hover:scale-105 md:active:scale-95"
                      : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60"
                  }`}
                >
                  XUẤT BÁN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales History Modal */}
      <SalesHistoryModal
        isOpen={showSalesHistory}
        onClose={() => {
          setShowSalesHistory(false);
          // On mobile, switch back to products tab when closing history
          if (mobileTab === "history") {
            setMobileTab("products");
          }
        }}
        sales={repoSales}
        currentBranchId={currentBranchId}
        onPrintReceipt={handlePrintReceipt}
        onEditSale={handleEditSale}
        onDeleteSale={handleDeleteSale}
        page={salesMeta.page}
        totalPages={salesMeta.totalPages}
        total={salesMeta.total}
        hasMore={salesMeta.hasMore}
        pageSize={salesPageSize}
        onPrevPage={goPrevPage}
        onNextPage={() => {
          if (useKeysetMode) {
            const nextAfterDate = (pagedSalesData?.meta as any)?.nextAfterDate;
            const nextAfterId = (pagedSalesData?.meta as any)?.nextAfterId;
            if (nextAfterDate || nextAfterId) {
              setKeysetCursor({
                afterDate: nextAfterDate,
                afterId: nextAfterId,
              });
            }
          } else {
            goNextPage();
          }
        }}
        onPageSizeChange={changePageSize}
        search={salesSearchInput}
        onSearchChange={(s) => {
          setSalesSearchInput(s);
          if (!s) {
            // Khi xoá nhanh chuỗi tìm kiếm, reset ngay về trang 1 để UX tốt hơn
            setSalesPage(1);
          }
        }}
        fromDate={salesFromDate}
        toDate={salesToDate}
        onDateRangeChange={(from?: string, to?: string) => {
          setSalesFromDate(from);
          setSalesToDate(to);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        status={salesStatus}
        onStatusChange={(s) => {
          setSalesStatus(s);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        paymentMethodFilter={salesPaymentMethod}
        onPaymentMethodFilterChange={(m) => {
          setSalesPaymentMethod(m);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        keysetMode={useKeysetMode}
        onToggleKeyset={(checked) => {
          setUseKeysetMode(checked);
          setSalesPage(1);
          setKeysetCursor(null);
        }}
        customerDebts={customerDebts}
      />

      {/* Receipt Print Section (Hidden) - A5 Format */}
      {receiptId && (
        <div id="last-receipt" className="hidden print:block">
          <div
            style={{
              width: "148mm",
              minHeight: "210mm",
              margin: "0 auto",
              padding: "15mm",
              fontFamily: "Arial, sans-serif",
              fontSize: "12px",
              backgroundColor: "white",
              color: "#000",
              boxSizing: "border-box",
            }}
          >
            {/* Header - Logo bên trái, thông tin bên phải */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "15px",
                marginBottom: "20px",
                borderBottom: "2px solid #333",
                paddingBottom: "15px",
              }}
            >
              {/* Logo bên trái */}
              <img
                src={
                  storeSettings?.logo_url ||
                  "https://raw.githubusercontent.com/Nhan-Lam-SmartCare/Motocare/main/public/logo.png"
                }
                alt="Logo"
                style={{
                  width: "60px",
                  height: "60px",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              {/* Thông tin cửa hàng bên phải */}
              <div style={{ flex: 1 }}>
                <h1
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    margin: "0 0 5px 0",
                    color: "#1e40af",
                  }}
                >
                  {storeSettings?.store_name || "Nhạn-Lâm SmartCare"}
                </h1>
                <div style={{ fontSize: "11px", lineHeight: "1.5" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{
                        width: "12px",
                        height: "12px",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                      viewBox="0 0 24 24"
                      fill="#ef4444"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span>
                      {storeSettings?.address ||
                        "Ấp Phú Lợi B, Phú Thuận B, Hồng Ngự, Đồng Tháp"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{ width: "12px", height: "12px", flexShrink: 0 }}
                      viewBox="0 0 24 24"
                      fill="#16a34a"
                    >
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span>{storeSettings?.phone || "0947-747-907"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Info Section - giống ServiceManager: info bên trái, QR bên phải */}
            {storeSettings?.bank_name && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  marginBottom: "20px",
                  fontSize: "11px",
                }}
              >
                {/* Thông tin ngân hàng bên trái */}
                <div style={{ flex: 1, lineHeight: "1.5" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "3px",
                      color: "#1e40af",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{ width: "12px", height: "12px", flexShrink: 0 }}
                      viewBox="0 0 24 24"
                      fill="#0891b2"
                    >
                      <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                    </svg>
                    <span>Thông tin chuyển khoản:</span>
                  </div>
                  <div>
                    • Ngân hàng: <strong>{storeSettings.bank_name}</strong>
                  </div>
                  {storeSettings.bank_account_number && (
                    <div>
                      • Số tài khoản:{" "}
                      <strong style={{ color: "#2563eb" }}>
                        {storeSettings.bank_account_number}
                      </strong>
                    </div>
                  )}
                  {storeSettings.bank_account_holder && (
                    <div>
                      • Chủ tài khoản:{" "}
                      <strong>{storeSettings.bank_account_holder}</strong>
                    </div>
                  )}
                </div>
                {/* QR Code bên phải */}
                {storeSettings.bank_qr_url && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={storeSettings.bank_qr_url}
                      alt="QR Banking"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Invoice Title */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                HÓA ĐƠN BÁN HÀNG
              </h2>
              <div style={{ fontSize: "11px", color: "#666" }}>
                Số: <strong style={{ color: "#000" }}>{receiptId}</strong> -
                Ngày:{" "}
                <strong style={{ color: "#000" }}>
                  {formatDate(new Date(), true)}
                </strong>
              </div>
            </div>

            {/* Customer Info */}
            <div
              style={{
                marginBottom: "15px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontSize: "12px", lineHeight: "1.8" }}>
                <div>
                  <strong>Khách hàng:</strong> {customerName || "Khách lẻ"}
                </div>
                {customerPhone && (
                  <div>
                    <strong>Điện thoại:</strong> {customerPhone}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "15px",
                fontSize: "11px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f1f3f5",
                    borderTop: "2px solid #333",
                    borderBottom: "2px solid #333",
                  }}
                >
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      width: "8%",
                      fontWeight: "bold",
                    }}
                  >
                    STT
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      width: "37%",
                      fontWeight: "bold",
                    }}
                  >
                    Tên sản phẩm
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      width: "10%",
                      fontWeight: "bold",
                    }}
                  >
                    SL
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      width: "20%",
                      fontWeight: "bold",
                    }}
                  >
                    Đơn giá
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      width: "25%",
                      fontWeight: "bold",
                    }}
                  >
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, index) => (
                  <React.Fragment key={item.partId}>
                    <tr style={{ borderBottom: "1px solid #e9ecef" }}>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 4px",
                          verticalAlign: "top",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "600", marginBottom: "3px" }}>
                          {item.partName}
                        </div>
                        {item.sku && (
                          <div style={{ fontSize: "9px", color: "#868e96" }}>
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 4px",
                          verticalAlign: "top",
                          fontWeight: "600",
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 6px",
                          verticalAlign: "top",
                        }}
                      >
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 6px",
                          verticalAlign: "top",
                          fontWeight: "600",
                        }}
                      >
                        {formatCurrency(item.sellingPrice * item.quantity)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Summary Section */}
            <div
              style={{
                borderTop: "2px solid #333",
                paddingTop: "12px",
                marginBottom: "15px",
              }}
            >
              <table style={{ width: "100%", fontSize: "12px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 0", textAlign: "right" }}>
                      Tổng cộng ({receiptTotalQuantity} sản phẩm):
                    </td>
                    <td
                      style={{
                        padding: "6px 0 6px 20px",
                        textAlign: "right",
                        width: "30%",
                        fontWeight: "600",
                      }}
                    >
                      {formatCurrency(receiptSubtotal)}
                    </td>
                  </tr>
                  {receiptDiscount > 0 && (
                    <tr>
                      <td
                        style={{
                          padding: "6px 0",
                          textAlign: "right",
                          color: "#c92a2a",
                        }}
                      >
                        Giảm giá:
                      </td>
                      <td
                        style={{
                          padding: "6px 0 6px 20px",
                          textAlign: "right",
                          fontWeight: "600",
                          color: "#c92a2a",
                        }}
                      >
                        -{formatCurrency(receiptDiscount)}
                      </td>
                    </tr>
                  )}
                  <tr
                    style={{
                      borderTop: "1px solid #dee2e6",
                      fontSize: "14px",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 0",
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      TỔNG THANH TOÁN:
                    </td>
                    <td
                      style={{
                        padding: "10px 0 10px 20px",
                        textAlign: "right",
                        fontWeight: "bold",
                        fontSize: "16px",
                        color: "#2f9e44",
                      }}
                    >
                      {formatCurrency(receiptTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Method */}
            <div
              style={{
                marginBottom: "20px",
                padding: "10px 12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
                fontSize: "11px",
              }}
            >
              <div style={{ marginBottom: "4px" }}>
                <strong>Hình thức thanh toán:</strong>{" "}
                {paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}
              </div>
              <div style={{ fontStyle: "italic", color: "#495057" }}>
                {paymentType === "full"
                  ? "✓ Đã thanh toán đủ"
                  : paymentType === "partial"
                  ? `Thanh toán một phần: ${formatCurrency(partialAmount)}`
                  : "Ghi nợ"}
              </div>
            </div>

            {/* Footer Signatures */}
            <div
              style={{
                marginTop: "30px",
                borderTop: "1px solid #dee2e6",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <div style={{ textAlign: "center", width: "40%" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "50px",
                      fontSize: "12px",
                    }}
                  >
                    Khách hàng
                  </div>
                  <div style={{ fontStyle: "italic", color: "#868e96" }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                </div>
                <div style={{ textAlign: "center", width: "40%" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "50px",
                      fontSize: "12px",
                    }}
                  >
                    Người bán hàng
                  </div>
                  <div style={{ fontStyle: "italic", color: "#868e96" }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                </div>
              </div>
            </div>

            {/* Thank You Note */}
            <div
              style={{
                textAlign: "center",
                marginTop: "25px",
                paddingTop: "15px",
                borderTop: "1px dashed #adb5bd",
                fontSize: "11px",
                fontStyle: "italic",
                color: "#495057",
              }}
            >
              <div
                style={{
                  marginBottom: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span style={{ display: "inline-flex" }}>
                  {/* Decorative star icon replaced by text to keep receipt plain; could inject SVG if needed */}
                  *
                </span>
                Cảm ơn quý khách đã sử dụng dịch vụ
                <span style={{ display: "inline-flex" }}>*</span>
              </div>
              <div>Hẹn gặp lại quý khách!</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Thêm khách hàng mới
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên khách hàng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dòng xe
                </label>
                <input
                  type="text"
                  value={newCustomer.vehicleModel}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      vehicleModel: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Honda SH 2023"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={newCustomer.licensePlate}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      licensePlate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: 30A-12345"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
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
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveNewCustomer}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Xem trước hóa đơn
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareInvoice}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
                  title="Chia sẻ / Tải ảnh"
                >
                  <Share2 className="w-4 h-4" />
                  Chia sẻ
                </button>
                <button
                  onClick={handleDoPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  In hóa đơn
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreview(false);
                    setPrintSale(null);
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
                style={{ width: "80mm", minHeight: "100mm", color: "#000" }}
              >
                <div style={{ padding: "5mm" }}>
                  {/* Store Info Header - Logo bên trái, thông tin bên phải */}
                  <div
                    style={{
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "2mm",
                      marginBottom: "3mm",
                      display: "flex",
                      alignItems: "center",
                      gap: "3mm",
                    }}
                  >
                    {/* Logo bên trái */}
                    {storeSettings?.logo_url && (
                      <img
                        src={storeSettings.logo_url}
                        alt="Logo"
                        style={{
                          height: "14mm",
                          width: "14mm",
                          objectFit: "contain",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {/* Thông tin bên phải */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "10pt",
                          color: "#1e40af",
                          marginBottom: "1mm",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      {storeSettings?.address && (
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#000",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "1mm",
                            lineHeight: "1.3",
                          }}
                        >
                          <svg
                            style={{
                              width: "8px",
                              height: "8px",
                              flexShrink: 0,
                              marginTop: "1px",
                            }}
                            viewBox="0 0 24 24"
                            fill="#ef4444"
                          >
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                          </svg>
                          <span>{storeSettings.address}</span>
                        </div>
                      )}
                      {storeSettings?.phone && (
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#000",
                            display: "flex",
                            alignItems: "center",
                            gap: "1mm",
                          }}
                        >
                          <svg
                            style={{
                              width: "8px",
                              height: "8px",
                              flexShrink: 0,
                            }}
                            viewBox="0 0 24 24"
                            fill="#16a34a"
                          >
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                          <span>{storeSettings.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Date */}
                  <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                    <h1
                      style={{
                        fontSize: "14pt",
                        fontWeight: "bold",
                        margin: "0",
                        color: "#1e40af",
                      }}
                    >
                      HÓA ĐƠN BÁN HÀNG
                    </h1>
                    <div
                      style={{
                        fontSize: "8pt",
                        color: "#666",
                        marginTop: "1mm",
                      }}
                    >
                      {new Date(printSale.date).toLocaleString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: "8pt",
                        fontWeight: "bold",
                        marginTop: "0.5mm",
                      }}
                    >
                      Mã: {formatAnyId(printSale.id) || printSale.id}
                    </div>
                  </div>

                  {/* Customer Info - Compact */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      marginBottom: "3mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      fontSize: "8.5pt",
                    }}
                  >
                    <div style={{ marginBottom: "1mm" }}>
                      <span style={{ fontWeight: "bold" }}>KH:</span>{" "}
                      {printSale.customer.name}
                    </div>
                    {printSale.customer.phone && (
                      <div>
                        <span style={{ fontWeight: "bold" }}>SĐT:</span>{" "}
                        {printSale.customer.phone}
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginBottom: "3mm",
                      fontSize: "8.5pt",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #ddd" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "1mm",
                            fontSize: "8pt",
                          }}
                        >
                          Sản phẩm
                        </th>
                        <th
                          style={{
                            textAlign: "center",
                            padding: "1mm",
                            width: "15%",
                            fontSize: "8pt",
                          }}
                        >
                          SL
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "1mm",
                            width: "28%",
                            fontSize: "8pt",
                          }}
                        >
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {printSale.items.map((item: any, idx: number) => {
                        const price =
                          item.sellingPrice ||
                          item.sellingprice ||
                          item.price ||
                          0;
                        const qty = item.quantity || 0;
                        return (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px dashed #ddd" }}
                          >
                            <td
                              style={{
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                              }}
                            >
                              {item.partName || item.partname}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                              }}
                            >
                              {qty}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                                fontWeight: "bold",
                              }}
                            >
                              {formatCurrency(price * qty)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Total Summary */}
                  <div
                    style={{
                      borderTop: "2px solid #333",
                      paddingTop: "2mm",
                      marginBottom: "3mm",
                      fontSize: "9pt",
                    }}
                  >
                    {printSale.discount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "1mm",
                          color: "#e74c3c",
                        }}
                      >
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(printSale.discount)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: "bold",
                        fontSize: "11pt",
                      }}
                    >
                      <span>TỔNG CỘNG:</span>
                      <span style={{ color: "#2563eb" }}>
                        {formatCurrency(printSale.total)} ₫
                      </span>
                    </div>
                  </div>

                  {/* Bank Info Section - giống ServiceManager */}
                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        marginTop: "2mm",
                        border: "1px solid #ddd",
                        padding: "2mm",
                        borderRadius: "2mm",
                        backgroundColor: "#f0f9ff",
                        fontSize: "7.5pt",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "2mm",
                        }}
                      >
                        {/* Thông tin ngân hàng bên trái */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#1e40af",
                              fontSize: "8pt",
                            }}
                          >
                            Chuyển khoản: {storeSettings.bank_name}
                          </div>
                          {storeSettings.bank_account_number && (
                            <div
                              style={{ color: "#2563eb", fontWeight: "bold" }}
                            >
                              STK: {storeSettings.bank_account_number}
                            </div>
                          )}
                          {storeSettings.bank_account_holder && (
                            <div>{storeSettings.bank_account_holder}</div>
                          )}
                        </div>
                        {/* QR Code bên phải */}
                        {storeSettings.bank_qr_url && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={storeSettings.bank_qr_url}
                              alt="QR Banking"
                              style={{
                                height: "18mm",
                                width: "18mm",
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "7.5pt",
                      color: "#666",
                      borderTop: "1px dashed #999",
                      paddingTop: "2mm",
                    }}
                  >
                    <div>Cảm ơn quý khách!</div>
                    <div>Hẹn gặp lại</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Quét mã vạch sản phẩm"
      />

      {/* Quick Service Modal */}
      <QuickServiceModal
        isOpen={showQuickServiceModal}
        onClose={() => setShowQuickServiceModal(false)}
        onComplete={handleQuickServiceComplete}
        branchId={currentBranchId}
      />
    </div>
  );
};

export default SalesManager;
