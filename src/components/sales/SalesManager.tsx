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

  // Filter customers for search
  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearchText.toLowerCase())
  );

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
                            <button
                              onClick={() => onDeleteSale(sale.id)}
                              className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm font-medium"
                            >
                              Xóa đơn
                            </button>
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
                                onClick={() =>
                                  setDropdownOpenSaleId(
                                    dropdownOpenSaleId === sale.id
                                      ? null
                                      : sale.id
                                  )
                                }
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
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
                                  <button
                                    onClick={() => {
                                      onPrintReceipt(sale);
                                      setDropdownOpenSaleId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-lg"
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
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
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
                                      if (onDeleteSale) {
                                        onDeleteSale(sale.id);
                                      }
                                      setDropdownOpenSaleId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-b-lg"
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
    customers,
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
  const [customerSearch, setCustomerSearch] = useState("");

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
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

    // Filter out products with no stock in current branch
    filtered = filtered.filter((part) => {
      const branchStock = part.stock?.[currentBranchId];
      return branchStock && branchStock > 0;
    });

    if (partSearch) {
      filtered = filtered.filter(
        (part) =>
          part.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          part.sku.toLowerCase().includes(partSearch.toLowerCase())
      );
    }

    // Limit to 20 products to avoid heavy page load
    return filtered.slice(0, 20);
  }, [repoParts, partSearch, loadingParts, partsError, currentBranchId]);

  // Low stock monitoring (threshold = 5)
  const { lowStockCount, outOfStockCount } = useLowStock(
    repoParts,
    currentBranchId,
    5
  );

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
    const customer = {
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

    upsertCustomer(customer);

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
  };

  // Handle print receipt - Show preview modal
  const handlePrintReceipt = (sale: Sale) => {
    setPrintSale(sale);
    setShowPrintPreview(true);
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
        userName: profile?.email || profile?.full_name || "Local User",
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
            userName: profile?.email || profile?.full_name || "Local User",
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile Tabs - Visible only on mobile */}
      <div className="md:hidden sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setMobileTab("products")}
            className={`py-3 px-4 font-medium transition-colors relative ${
              mobileTab === "products"
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Boxes className="w-5 h-5" />
              <span>Sản phẩm</span>
            </div>
            {mobileTab === "products" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`py-3 px-4 font-medium transition-colors relative ${
              mobileTab === "cart"
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span>Giỏ hàng</span>
              {cartItems.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-600 text-white">
                  {cartItems.length}
                </span>
              )}
            </div>
            {mobileTab === "cart" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
            )}
          </button>
        </div>
      </div>

      <div className="flex h-screen">
        {/* Main Content Area - Products Grid */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${
            mobileTab === "cart" ? "hidden md:flex" : "animate-fade-in"
          }`}
        >
          {/* Search Bar */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 md:p-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Tìm sản phẩm hoặc SKU..."
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  className="w-full px-3 md:px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 text-sm md:text-base"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex md:hidden flex-1 items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 whitespace-nowrap">
                    Thấp: {lowStockCount}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap">
                    Hết: {outOfStockCount}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    Tồn thấp: {lowStockCount}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    Hết hàng: {outOfStockCount}
                  </span>
                </div>
                <button
                  onClick={() => setShowSalesHistory(true)}
                  className="px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-2 text-sm md:text-base"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Lịch sử</span>
                </button>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            {filteredParts.length === 0 ? (
              <div className="text-center text-slate-400 mt-20">
                <div className="mb-4 flex items-center justify-center">
                  <Boxes className="w-16 h-16 text-slate-300" />
                </div>
                <div className="text-xl font-medium mb-2">
                  {partSearch
                    ? "Không tìm thấy sản phẩm nào"
                    : "Chưa có sản phẩm"}
                </div>
                <div className="text-sm">
                  {partSearch
                    ? "Hãy thử một từ khóa tìm kiếm khác"
                    : "Vui lòng thêm sản phẩm vào hệ thống"}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
                {filteredParts.map((part) => {
                  const price = part.retailPrice?.[currentBranchId] ?? 0;
                  const stock = part.stock?.[currentBranchId] ?? 0;
                  const isOutOfStock = stock <= 0;

                  return (
                    <button
                      key={part.id}
                      onClick={() => !isOutOfStock && addToCart(part)}
                      disabled={isOutOfStock}
                      className={`group relative p-3 md:p-4 rounded-xl border transition-all duration-200 ${
                        isOutOfStock
                          ? "bg-primary-bg/50 border-primary-border opacity-50 cursor-not-allowed"
                          : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 border-blue-200 dark:border-slate-600 hover:shadow-xl hover:scale-105 active:scale-95"
                      }`}
                    >
                      <div className="flex flex-col h-full">
                        {/* Product Image with Icon */}
                        <div className="flex items-center justify-center mb-2 md:mb-3">
                          <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-100 dark:bg-orange-600/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Boxes className="w-8 h-8 md:w-10 md:h-10 text-orange-500 dark:text-orange-300" />
                          </div>
                        </div>

                        {/* Product Name */}
                        <div className="text-left mb-2 flex-1">
                          <h3
                            className="font-semibold text-sm md:text-base text-primary-text line-clamp-2 mb-1"
                            title={part.name}
                          >
                            {part.name}
                          </h3>
                          <div className="text-[10px] md:text-xs text-tertiary-text">
                            SKU: {part.sku}
                          </div>
                        </div>

                        {/* Price and Stock */}
                        <div className="flex justify-between items-end mt-auto">
                          <div className="text-left">
                            <div className="text-base md:text-lg font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(price)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 text-[10px] md:text-xs font-bold rounded-md ${
                                isOutOfStock
                                  ? "bg-red-600 text-white"
                                  : stock <= 5
                                  ? "bg-orange-600 text-white"
                                  : "bg-green-600 text-white"
                              }`}
                            >
                              {isOutOfStock ? "Hết" : stock}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Customer, Cart & Checkout */}
        <div
          className={`w-full md:w-96 bg-white dark:bg-slate-800 md:border-l border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 ${
            mobileTab === "products" ? "hidden md:flex" : "animate-fade-in"
          }`}
        >
          {/* Customer Selection */}
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="customer-dropdown-container">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                Chọn khách hàng
              </label>
              <div className="relative flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc số điện thoại..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="flex-1 px-3 py-2.5 md:py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-3 py-2.5 md:py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
                  title="Thêm khách hàng mới"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setCustomerSearch(customer.name);
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-600 border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {customer.name}
                        </div>
                        {customer.phone && (
                          <div className="text-sm text-slate-500">
                            {customer.phone}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedCustomer.name}
                  </div>
                  {selectedCustomer.phone && (
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      {selectedCustomer.phone}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch("");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    Xóa khách hàng
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Giỏ hàng
              </h3>
              <span className="text-sm text-slate-500">
                ({cartItems.length} sản phẩm)
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <div className="mb-2 flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10 text-slate-300" />
                </div>
                <div className="text-sm">Giỏ hàng trống</div>
                <div className="text-xs text-slate-400 mt-1">
                  Chọn sản phẩm để thêm vào giỏ
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map((item) => (
                  <div
                    key={item.partId}
                    className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-600 rounded-lg"
                  >
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Boxes className="w-6 h-6 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium text-sm text-slate-900 dark:text-slate-100 break-words"
                        title={item.partName}
                      >
                        {item.partName}
                      </div>
                      <div className="text-xs text-slate-500">
                        SKU: {item.sku}
                      </div>
                      <div className="text-sm text-blue-600 font-semibold">
                        {formatCurrency(item.sellingPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateCartQuantity(
                            item.partId,
                            Math.max(1, item.quantity - 1)
                          )
                        }
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-sm">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateCartQuantity(item.partId, item.quantity + 1)
                        }
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(item.partId)}
                        className="w-8 h-8 flex items-center justify-center bg-red-100 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Section */}
          {cartItems.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {/* Summary */}
              <div className="p-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                  <span>Tổng tiền hàng</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between text-sm gap-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Giảm giá:
                    </span>
                    <div className="flex items-center gap-2 w-full md:w-auto">
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
                        className="flex-1 md:w-20 px-3 py-2 md:py-1 text-right text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 min-h-[44px] md:min-h-0"
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
                        className="px-3 py-2 md:px-2 md:py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm min-h-[44px] md:min-h-0"
                      >
                        <option value="amount">₫</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick percent buttons */}
                  {discountType === "percent" && (
                    <div className="flex gap-1.5 md:gap-1 justify-end flex-wrap">
                      {[5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => {
                            setDiscountPercent(percent);
                            setOrderDiscount(
                              Math.round((subtotal * percent) / 100)
                            );
                          }}
                          className="px-3 py-2 md:px-2 md:py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded transition-colors min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show amount if percent mode */}
                  {discountType === "percent" && discountPercent > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                      = {formatCurrency(orderDiscount)}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    Khách phải trả
                  </span>
                  <span className="font-bold text-xl text-slate-900 dark:text-slate-100">
                    {formatCurrency(Math.max(0, total - orderDiscount))} đ
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-4 pb-3">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 rounded-lg border-2 transition-all min-h-[44px] ${
                      paymentMethod === "cash"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="font-medium text-sm">Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 md:py-2 rounded-lg border-2 transition-all min-h-[44px] ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span className="font-medium text-sm">Chuyển khoản</span>
                  </button>
                </div>
              </div>

              {/* Payment Type */}
              {paymentMethod && (
                <div className="px-4 pb-3">
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Hình thức
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`px-3 py-2.5 md:py-2 text-sm rounded-lg border transition-all min-h-[44px] ${
                        paymentType === "full"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-semibold"
                          : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                      }`}
                    >
                      Thanh toán đủ
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`px-3 py-2.5 md:py-2 text-sm rounded-lg border transition-all min-h-[44px] ${
                        paymentType === "partial"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-semibold"
                          : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                      }`}
                    >
                      Thanh toán 1 phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`px-3 py-2.5 md:py-2 text-sm rounded-lg border transition-all min-h-[44px] ${
                        paymentType === "note"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 font-semibold"
                          : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
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
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                    placeholder="0"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Còn lại:{" "}
                    {formatCurrency(
                      Math.max(0, total - orderDiscount - partialAmount)
                    )}{" "}
                    đ
                  </div>
                </div>
              )}

              {/* Checkboxes */}
              <div className="px-4 pb-3 space-y-2">
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Thời gian bán hàng
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="salesTime"
                    defaultChecked
                    className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Thời gian hiện tại
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="salesTime"
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Tùy chỉnh
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Ghi chú riêng cho đơn hàng
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintReceipt}
                    onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Đóng thời in hoá đơn
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="p-3 md:p-4 pt-0 flex flex-col md:flex-row gap-2 md:gap-3">
                <button
                  onClick={clearCart}
                  className="flex-1 px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors min-h-[44px]"
                >
                  LƯU NHẬP
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={!paymentMethod || !paymentType}
                  className={`flex-1 px-4 py-3 font-bold rounded-lg transition-all min-h-[44px] ${
                    paymentMethod && paymentType
                      ? "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-lg hover:shadow-xl"
                      : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed"
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
        onClose={() => setShowSalesHistory(false)}
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
            {/* Header with Logo */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "20px",
                borderBottom: "2px solid #333",
                paddingBottom: "15px",
              }}
            >
              <img
                src="https://raw.githubusercontent.com/Nhan-Lam-SmartCare/Motocare/main/public/logo.png"
                alt="Nhận-Lâm SmartCare"
                style={{
                  width: "120px",
                  height: "120px",
                  margin: "0 auto 10px",
                  display: "block",
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  color: "#c92a2a",
                }}
              >
                Nhận-Lâm SmartCare
              </h1>
              <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  <span>
                    Địa chỉ: 4p Phú Lợi B, Phú Thuận B, Hồng Ngự, Đồng Tháp
                  </span>
                </div>
                <div className="flex items-center gap-1">
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
                  <span>Điện thoại: 0947747907</span>
                </div>
              </div>
            </div>

            {/* Bank Info Box */}
            <div
              style={{
                backgroundColor: "#f8f9fa",
                border: "1px solid #dee2e6",
                borderRadius: "6px",
                padding: "10px 12px",
                marginBottom: "20px",
                fontSize: "11px",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
                💳 Thông tin chuyển khoản:
              </div>
              <div style={{ lineHeight: "1.6" }}>
                <div>
                  • Ngân hàng: <strong>NH Liên Việt (LPBank)</strong>
                </div>
                <div>
                  • Số tài khoản: <strong>LAMVOT</strong>
                </div>
                <div>
                  • Chủ tài khoản: <strong>VO THANH LAM</strong>
                </div>
              </div>
            </div>

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
              <div className="flex items-center gap-3">
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
                className="bg-white shadow-lg mx-auto"
                style={{ width: "80mm", minHeight: "100mm", color: "#000" }}
              >
                <div style={{ padding: "5mm" }}>
                  {/* Store Info Header - Compact for Receipt */}
                  <div
                    style={{
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "2mm",
                      marginBottom: "3mm",
                    }}
                  >
                    <div style={{ textAlign: "center" }}>
                      {storeSettings?.logo_url && (
                        <img
                          src={storeSettings.logo_url}
                          alt="Logo"
                          style={{
                            height: "12mm",
                            width: "auto",
                            objectFit: "contain",
                            margin: "0 auto 2mm",
                          }}
                        />
                      )}
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "11pt",
                          color: "#1e40af",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      <div
                        style={{
                          fontSize: "8pt",
                          color: "#000",
                          marginTop: "1mm",
                        }}
                      >
                        {storeSettings?.address &&
                          `📍 ${storeSettings.address}`}
                      </div>
                      <div style={{ fontSize: "8pt", color: "#000" }}>
                        {storeSettings?.phone && `📞 ${storeSettings.phone}`}
                      </div>
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

                  {/* Bank Info */}
                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        borderTop: "1px dashed #999",
                        paddingTop: "2mm",
                        marginBottom: "3mm",
                        fontSize: "7.5pt",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "1mm" }}>
                        Chuyển khoản: {storeSettings.bank_name}
                      </div>
                      {storeSettings.bank_account_number && (
                        <div>STK: {storeSettings.bank_account_number}</div>
                      )}
                      {storeSettings.bank_account_holder && (
                        <div style={{ fontSize: "7pt" }}>
                          {storeSettings.bank_account_holder}
                        </div>
                      )}
                      {storeSettings.bank_qr_url && (
                        <div style={{ marginTop: "2mm" }}>
                          <img
                            src={storeSettings.bank_qr_url}
                            alt="QR Banking"
                            style={{
                              height: "20mm",
                              width: "20mm",
                              objectFit: "contain",
                              margin: "0 auto",
                            }}
                          />
                        </div>
                      )}
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

      {/* Floating Cart Button - Mobile only, show when on products tab */}
      {mobileTab === "products" && cartItems.length > 0 && (
        <button
          onClick={() => setMobileTab("cart")}
          className="md:hidden fixed bottom-20 right-4 z-50 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-2xl p-4 transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            {cartItems.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                {cartItems.length}
              </span>
            )}
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
        </button>
      )}
    </div>
  );
};

export default SalesManager;
