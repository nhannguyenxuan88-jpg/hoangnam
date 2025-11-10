import React, { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import { Boxes, Package, Search, FileText } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import {
  usePartsRepo,
  useCreatePartRepo,
  useUpdatePartRepo,
  useDeletePartRepo,
} from "../../hooks/usePartsRepository";
import { formatCurrency, formatDate } from "../../utils/format";
import {
  exportPartsToExcel,
  exportInventoryTemplate,
  importPartsFromExcel,
} from "../../utils/excel";
import { showToast } from "../../utils/toast";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmModal from "../common/ConfirmModal";
import CategoriesManager from "../categories/CategoriesManager";
import LookupManager from "../lookup/LookupManager";
import type { Part, InventoryTransaction } from "../../types";
import { useCreateInventoryTxRepo } from "../../hooks/useInventoryTransactionsRepository";

// Add New Product Modal Component
const AddProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
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
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [importPrice, setImportPrice] = useState("0");
  const [retailPrice, setRetailPrice] = useState("0");
  const [warranty, setWarranty] = useState("1");
  const [warrantyUnit, setWarrantyUnit] = useState("tháng");

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      category: category || "Chưa phân loại",
      quantity: parseInt(quantity) || 1,
      importPrice: parseFloat(importPrice) || 0,
      retailPrice: parseFloat(retailPrice) || 0,
      warranty: parseInt(warranty) || 0,
      warrantyUnit,
    });

    // Reset form
    setName("");
    setDescription("");
    setCategory("");
    setQuantity("1");
    setImportPrice("0");
    setRetailPrice("0");
    setWarranty("1");
    setWarrantyUnit("tháng");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Thêm sản phẩm mới
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Tên sản phẩm */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tên sản phẩm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Nhập tên sản phẩm"
              />
            </div>

            {/* Mô tả */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mô tả
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Mô tả sản phẩm"
              />
            </div>

            {/* Danh mục sản phẩm */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Danh mục sản phẩm
              </label>
              <div className="flex gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Chọn hoặc tạo mới --</option>
                  <option value="Phụ tùng">Phụ tùng</option>
                  <option value="Vòng bi">Vòng bi</option>
                  <option value="Nhớt">Nhớt</option>
                  <option value="Đèn">Đèn</option>
                  <option value="Lốp xe">Lốp xe</option>
                </select>
                <button className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">
                  <span className="text-xl text-slate-600 dark:text-slate-300">
                    +
                  </span>
                </button>
              </div>
            </div>

            {/* Thông tin nhập kho */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Thông tin nhập kho:
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Số lượng:
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Giá nhập:
                  </label>
                  <input
                    type="number"
                    value={importPrice}
                    onChange={(e) => setImportPrice(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Giá bán lẻ:
                  </label>
                  <input
                    type="number"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Bảo hành */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bảo hành
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  min="0"
                  className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={warrantyUnit}
                  onChange={(e) => setWarrantyUnit(e.target.value)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="tháng">tháng</option>
                  <option value="năm">năm</option>
                  <option value="ngày">ngày</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleSubmit}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-medium"
          >
            Lưu và Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>
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
    supplier: string,
    totalAmount: number,
    note: string
  ) => void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<
    Array<{
      partId: string;
      partName: string;
      sku: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
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

  const filteredParts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!searchTerm) return parts; // Show all parts when no search term
    return parts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
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
    } else {
      setReceiptItems([
        ...receiptItems,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice: 0,
          sellingPrice: part.retailPrice[currentBranchId] || 0,
        },
      ]);
    }
    setSearchTerm("");
  };

  const updateReceiptItem = (
    partId: string,
    field: "quantity" | "importPrice" | "sellingPrice",
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
    onSave(receiptItems, selectedSupplier, totalAmount, "");
    setReceiptItems([]);
    setSelectedSupplier("");
    setSearchTerm("");
    setDiscount(0);
    setDiscountPercent(0);
    setDiscountType("amount");
  };

  const handleAddNewProduct = (productData: any) => {
    // Add new product to receipt items
    const newItem = {
      partId: `temp-${Date.now()}`, // Temporary ID
      partName: productData.name,
      sku: `SKU-${Date.now()}`,
      quantity: productData.quantity,
      importPrice: productData.importPrice,
      sellingPrice: productData.retailPrice,
    };
    setReceiptItems([...receiptItems, newItem]);
    setShowAddProductModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
          {/* Left Side - Product Selection */}
          <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
                >
                  ←
                </button>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Chọn sản phẩm nhập kho
                </h2>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                <span className="text-xl">+</span>
                <span>Thêm sản phẩm mới</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-6 bg-white dark:bg-slate-800">
              <input
                type="text"
                placeholder="Tìm theo tên sản phẩm, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Products List */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredParts.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  Không tìm thấy sản phẩm nào
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredParts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => addToReceipt(part)}
                      className="p-4 bg-white dark:bg-slate-800 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border border-slate-200 dark:border-slate-600 transition-colors"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {part.name}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        SKU: {part.sku}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Receipt Details */}
          <div className="w-[500px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
            {/* Supplier Selection */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Nhà cung cấp (NCC):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tìm nhà cung cấp"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">
                  <span className="text-xl text-slate-600 dark:text-slate-300">
                    +
                  </span>
                </button>
              </div>
            </div>

            {/* Receipt Items */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Giỏ hàng nhập kho
                </h3>
                <span className="text-sm text-slate-500">
                  ({receiptItems.length} sản phẩm)
                </span>
              </div>

              {receiptItems.length === 0 ? (
                <div className="text-center text-slate-400 py-12">
                  <div className="text-4xl mb-2">
                    <Boxes className="w-10 h-10 mx-auto text-slate-300" />
                  </div>
                  <div className="text-sm">Giỏ hàng trống</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Chọn sản phẩm để thêm vào giỏ
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {receiptItems.map((item) => (
                    <div
                      key={item.partId}
                      className="border border-slate-200 dark:border-slate-600 rounded-lg p-3"
                    >
                      {/* Header: Product Info + Delete */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Boxes className="w-6 h-6 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
                            {item.partName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            SKU: {item.sku}
                          </div>
                        </div>
                        <button
                          onClick={() => removeReceiptItem(item.partId)}
                          className="w-8 h-8 flex items-center justify-center bg-red-100 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 flex-shrink-0"
                          title="Xóa"
                        >
                          ×
                        </button>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          Số lượng:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateReceiptItem(
                                item.partId,
                                "quantity",
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium text-sm text-slate-900 dark:text-slate-100">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateReceiptItem(
                                item.partId,
                                "quantity",
                                item.quantity + 1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Price Inputs */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            Giá nhập:
                          </label>
                          <input
                            type="number"
                            value={item.importPrice}
                            onChange={(e) =>
                              updateReceiptItem(
                                item.partId,
                                "importPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-32 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm text-right focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            Giá bán:
                          </label>
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) =>
                              updateReceiptItem(
                                item.partId,
                                "sellingPrice",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-32 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm text-right focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>

                        {/* Subtotal */}
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Thành tiền:
                          </span>
                          <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.importPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
              {/* Total Amount */}
              <div className="flex justify-between items-center text-lg font-bold">
                <span className="text-slate-700 dark:text-slate-300">
                  Tổng tiền hàng
                </span>
                <span className="text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {/* Discount - Optional */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Giảm giá:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={
                        discountType === "amount"
                          ? discount || ""
                          : discountPercent
                      }
                      onChange={(e) => {
                        const value = Number(e.target.value) || 0;
                        if (discountType === "amount") {
                          if (value > subtotal) {
                            showToast.warning(
                              "Giảm giá không được lớn hơn tổng tiền!"
                            );
                            setDiscount(subtotal);
                          } else {
                            setDiscount(value);
                          }
                        } else {
                          const percent = Math.min(value, 100);
                          setDiscountPercent(percent);
                          setDiscount(Math.round((subtotal * percent) / 100));
                        }
                      }}
                      placeholder="0"
                      className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      min="0"
                      max={discountType === "amount" ? subtotal : 100}
                    />
                    <select
                      value={discountType}
                      onChange={(e) => {
                        const newType = e.target.value as "amount" | "percent";
                        setDiscountType(newType);
                        setDiscount(0);
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
                  <div className="flex gap-1 justify-end">
                    {[5, 10, 15, 20].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => {
                          setDiscountPercent(percent);
                          setDiscount(Math.round((subtotal * percent) / 100));
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
                  <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                    = {formatCurrency(discount)}
                  </div>
                )}
              </div>

              {/* Amount to Pay */}
              <div className="flex justify-between items-center text-xl font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-900 dark:text-slate-100">
                  Khách phải trả
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-all ${
                      paymentMethod === "cash"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-6 h-6"
                    >
                      <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span className="font-medium">Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg transition-all ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-6 h-6"
                    >
                      <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
                      <path d="M2 10h20" />
                      <path d="M6 14h4" />
                    </svg>
                    <span className="font-medium">Chuyển khoản</span>
                  </button>
                </div>
              </div>

              {/* Payment Type - Only show after payment method is selected */}
              {paymentMethod && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                    Hình thức
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`px-3 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${
                        paymentType === "full"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      Thanh toán đủ
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`px-3 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${
                        paymentType === "partial"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      Thanh toán 1 phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`px-3 py-2.5 border-2 rounded-lg text-sm font-medium transition-all ${
                        paymentType === "note"
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                      }`}
                    >
                      Ghi nợ
                    </button>
                  </div>
                </div>
              )}

              {/* Partial Payment Amount Input */}
              {paymentType === "partial" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Số tiền khách trả
                  </label>
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) =>
                      setPartialAmount(parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-lg font-medium"
                    placeholder="0"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    Còn lại:{" "}
                    {formatCurrency(Math.max(0, totalAmount - partialAmount))} ₫
                  </div>
                </div>
              )}

              {/* Account Category */}
              {paymentMethod && paymentType && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Hạch toán:
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                    <option>Mua hàng/nhập kho</option>
                    <option>Nhập trả hàng</option>
                    <option>Khác</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  LƯU NHÁP
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                >
                  NHẬP KHO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSave={handleAddNewProduct}
      />
    </>
  );
};

// Inventory History Section Component (Embedded in main page)
const InventoryHistorySection: React.FC<{
  transactions: InventoryTransaction[];
}> = ({ transactions }) => {
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
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

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Lịch sử nhập kho
        </h2>

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
        <input
          type="text"
          placeholder="Nhà cung cấp, SKU, tên phụ tùng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
        />
      </div>

      {/* Summary */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Tổng số tiền:{" "}
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
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-700">
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
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
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
                      {new Date(transaction.date).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
  );
};

// Inventory History Modal Component (Ảnh 3)
const InventoryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  transactions: InventoryTransaction[];
}> = ({ isOpen, onClose, transactions }) => {
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
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
              Tổng số tiền:{" "}
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
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
  const { currentBranchId, inventoryTransactions } = useAppContext();
  // Supabase repository mutation for inventory transactions
  const { mutateAsync: createInventoryTxAsync } = useCreateInventoryTxRepo();
  const [activeTab, setActiveTab] = useState("stock"); // stock, categories, lookup, history
  const [showGoodsReceipt, setShowGoodsReceipt] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Confirm dialog hook
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const {
    data: repoParts = [],
    isLoading: partsLoading,
    isError: partsError,
    refetch: refetchParts,
  } = usePartsRepo();

  const filteredParts = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = repoParts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );

    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    return filtered;
  }, [repoParts, search, categoryFilter]);

  const totalStockValue = useMemo(() => {
    return repoParts.reduce((sum, part) => {
      const stock = part.stock[currentBranchId] || 0;
      const price = part.retailPrice[currentBranchId] || 0;
      return sum + stock * price;
    }, 0);
  }, [repoParts, currentBranchId]);

  const totalStockQuantity = useMemo(() => {
    return repoParts.reduce((sum, part) => {
      return sum + (part.stock[currentBranchId] || 0);
    }, 0);
  }, [repoParts, currentBranchId]);

  const updatePartMutation = useUpdatePartRepo();
  const createPartMutation = useCreatePartRepo();
  const deletePartMutation = useDeletePartRepo();

  const handleSaveGoodsReceipt = useCallback(
    (
      items: Array<{
        partId: string;
        partName: string;
        quantity: number;
        importPrice: number;
        sellingPrice: number;
      }>,
      supplier: string,
      totalAmount: number,
      note: string
    ) => {
      // Update stock and prices for each item
      items.forEach((item) => {
        const part = repoParts.find((p) => p.id === item.partId);
        if (part) {
          const currentStock = part.stock[currentBranchId] || 0;
          updatePartMutation.mutate({
            id: item.partId,
            updates: {
              stock: {
                ...part.stock,
                [currentBranchId]: currentStock + item.quantity,
              },
              retailPrice: {
                ...part.retailPrice,
                [currentBranchId]: item.sellingPrice,
              },
            },
          });

          // Record transaction to Supabase
          createInventoryTxAsync({
            type: "Nhập kho",
            partId: item.partId,
            partName: item.partName,
            quantity: item.quantity,
            date: new Date().toISOString(),
            unitPrice: item.importPrice,
            totalPrice: item.importPrice * item.quantity,
            branchId: currentBranchId,
            notes: `NCC: ${supplier}`,
          });
        }
      });

      setShowGoodsReceipt(false);
      showToast.success("Nhập kho thành công!");
    },
    [repoParts, currentBranchId, updatePartMutation, createInventoryTxAsync]
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

    deletePartMutation.mutate({ id });
    // Remove from selected items if it was selected
    setSelectedItems((prev) => prev.filter((i) => i !== id));
    showToast.success(`Đã xóa sản phẩm "${part.name}"`);
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

    // Delete all selected items
    selectedItems.forEach((id) => deletePartMutation.mutate({ id }));
    setSelectedItems([]);
    showToast.success(`Đã xóa ${selectedItems.length} sản phẩm`);
  };

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

  return (
    <div className="h-full flex flex-col bg-secondary-bg">
      {/* Header */}
      <div className="bg-primary-bg border-b border-primary-border px-6 py-4">
        {/* Tabs and Buttons Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {[
              {
                key: "stock",
                label: "Tồn kho",
                icon: <Boxes className="w-4 h-4" />,
              },
              {
                key: "categories",
                label: "Danh mục",
                icon: <Package className="w-4 h-4" />,
              },
              {
                key: "lookup",
                label: "Tra cứu",
                icon: <Search className="w-4 h-4" />,
              },
              {
                key: "history",
                label: "Lịch sử",
                icon: <FileText className="w-4 h-4" />,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-blue-600 text-white"
                    : "text-secondary-text hover:bg-tertiary-bg"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {tab.icon}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGoodsReceipt(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <span className="text-xl">+</span>
              <span>Tạo phiếu nhập</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
              <span className="text-xl">🔄</span>
              <span>Chuyển kho</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              <span className="text-xl">📤</span>
              <span>Xuất Excel</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <span className="text-xl">📥</span>
              <span>Nhập CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "stock" && (
          <div className="space-y-4">
            {/* Stats Cards and Search/Filters in One Row */}
            <div className="flex gap-4 items-center">
              {/* Stats Cards */}
              <div className="flex gap-3">
                <div className="bg-accent-blue-bg rounded-lg px-5 py-3 border border-accent-blue-border min-w-[140px]">
                  <div className="text-xs text-accent-blue-text mb-1">
                    Tổng SL tồn
                  </div>
                  <div className="text-xl font-bold text-primary-text">
                    {totalStockQuantity}
                  </div>
                </div>

                <div className="bg-accent-green-bg rounded-lg px-5 py-3 border border-accent-green-border min-w-[180px]">
                  <div className="text-xs text-accent-green-text mb-1">
                    Giá trị tồn
                  </div>
                  <div className="text-xl font-bold text-accent-green-text">
                    {formatCurrency(totalStockValue)}
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex gap-3 flex-1">
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-secondary-border rounded-lg bg-primary-bg text-primary-text placeholder-tertiary-text focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2.5 border border-secondary-border rounded-lg bg-primary-bg text-secondary-text focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                >
                  <option value="all">Còn hàng</option>
                  <option value="lowStock">Sắp hết</option>
                  <option value="outOfStock">Hết hàng</option>
                </select>

                <select className="px-4 py-2.5 border border-secondary-border rounded-lg bg-primary-bg text-secondary-text focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors">
                  <option>Tất cả danh mục</option>
                </select>
              </div>
            </div>

            {/* Stock Table */}
            <div className="rounded-lg overflow-hidden border border-primary-border">
              {/* Bulk Actions Bar */}
              {selectedItems.length > 0 && (
                <div className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 border-b border-primary-border flex items-center justify-between">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
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

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-tertiary-bg">
                    <tr className="border-b border-primary-border">
                      <th className="px-6 py-4 text-center w-12">
                        <input
                          type="checkbox"
                          checked={
                            selectedItems.length === filteredParts.length &&
                            filteredParts.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-secondary-border focus:ring-blue-500"
                        />
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        STT
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Tên sản phẩm
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Danh mục
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Tồn kho
                      </th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Giá bán
                      </th>
                      <th className="text-right px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Giá trị
                      </th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-secondary-text uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-primary-bg divide-y divide-primary-border">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-8 text-center text-tertiary-text"
                        >
                          <div className="text-6xl mb-4">🗂️</div>
                          <div className="text-lg">Không có sản phẩm nào</div>
                          <div className="text-sm">
                            Hãy thử một bộ lọc khác hoặc thêm sản phẩm mới
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((part, index) => {
                        const stock = part.stock[currentBranchId] || 0;
                        const price = part.retailPrice[currentBranchId] || 0;
                        const value = stock * price;
                        const isSelected = selectedItems.includes(part.id);

                        return (
                          <tr
                            key={part.id}
                            className={`border-b border-primary-border hover:bg-tertiary-bg transition-colors ${
                              isSelected
                                ? "bg-blue-900/20 dark:bg-blue-900/20"
                                : ""
                            }`}
                          >
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  handleSelectItem(part.id, e.target.checked)
                                }
                                className="w-4 h-4 text-blue-600 rounded border-secondary-border focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-primary-text">
                                {part.name}
                              </div>
                              <div className="text-xs text-tertiary-text">
                                SKU: {part.sku}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-text">
                              {part.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex px-3 py-1 text-sm font-bold rounded ${
                                  stock === 0
                                    ? "text-red-600 dark:text-red-400"
                                    : stock < 10
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {stock}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-primary-text">
                              {formatCurrency(price)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-primary-text">
                              {formatCurrency(value)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setEditingPart(part)}
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
                                  onClick={() => handleDeleteItem(part.id)}
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <InventoryHistorySection transactions={inventoryTransactions} />
        )}

        {activeTab === "categories" && (
          <div className="bg-[#0f172a] -m-6">
            <CategoriesManager />
          </div>
        )}

        {activeTab === "lookup" && (
          <div className="bg-[#0f172a] -m-6">
            <LookupManager />
          </div>
        )}
      </div>

      {/* Modals */}
      <GoodsReceiptModal
        isOpen={showGoodsReceipt}
        onClose={() => setShowGoodsReceipt(false)}
        parts={repoParts}
        currentBranchId={currentBranchId}
        onSave={handleSaveGoodsReceipt}
      />

      {/* Edit Part Modal */}
      {editingPart && (
        <EditPartModal
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={(updatedPart) => {
            updatePartMutation.mutate({
              id: updatedPart.id,
              updates: updatedPart,
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
              const importedData = await importPartsFromExcel(
                file,
                currentBranchId
              );

              // Process imported data
              importedData.forEach((item) => {
                // Check if part exists by SKU
                const existingPart = repoParts.find((p) => p.sku === item.sku);

                if (existingPart) {
                  // Update existing part
                  updatePartMutation.mutate({
                    id: existingPart.id,
                    updates: {
                      stock: {
                        ...existingPart.stock,
                        [currentBranchId]:
                          (existingPart.stock[currentBranchId] || 0) +
                          item.quantity,
                      },
                      retailPrice: {
                        ...existingPart.retailPrice,
                        [currentBranchId]: item.retailPrice,
                      },
                      wholesalePrice: {
                        ...existingPart.wholesalePrice,
                        [currentBranchId]: item.wholesalePrice,
                      },
                    },
                  });
                } else {
                  // Create new part
                  createPartMutation.mutate({
                    name: item.name,
                    sku: item.sku,
                    category: item.category,
                    description: item.description,
                    stock: {
                      [currentBranchId]: item.quantity,
                    },
                    retailPrice: {
                      [currentBranchId]: item.retailPrice,
                    },
                    wholesalePrice: {
                      [currentBranchId]: item.wholesalePrice,
                    },
                  });
                }
              });

              // Record inventory transactions for each imported item
              const importDate = new Date().toISOString();
              importedData.forEach((item) => {
                const existingPart = repoParts.find((p) => p.sku === item.sku);
                if (existingPart) {
                  createInventoryTxAsync({
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
                }
              });

              setShowImportModal(false);
              showToast.success(
                `Import thành công ${importedData.length} sản phẩm!`
              );
            } catch (error) {
              console.error("Import error:", error);
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
    category: part.category || "",
    retailPrice: part.retailPrice[currentBranchId] || 0,
    wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      id: part.id,
      name: formData.name.trim(),
      category: formData.category.trim() || undefined,
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

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Danh mục
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              placeholder="VD: Nhớt động cơ, Lốp xe, Phanh..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <div className="font-medium mb-1">Lưu ý:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Tồn kho hiện tại:{" "}
                  <strong>{part.stock[currentBranchId] || 0}</strong>
                </li>
                <li>
                  Để thay đổi tồn kho, vui lòng sử dụng chức năng "Tạo phiếu
                  nhập" hoặc "Chuyển kho"
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
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
        </form>
      </div>
    </div>
  );
};

export default InventoryManager;
