import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppContext } from "../../../contexts/AppContext";
import { usePartsRepo } from "../../../hooks/usePartsRepository";
import type { CartItem, Part, Customer, Sale } from "../../../types";
import { formatCurrency, formatDate, formatAnyId } from "../../../utils/format";
import { showToast } from "../../../utils/toast";
import { PlusIcon, XMarkIcon } from "../../Icons";

export interface EditSaleModalProps {
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

export default EditSaleModal;
