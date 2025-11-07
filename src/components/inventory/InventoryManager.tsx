import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Part, InventoryTransaction } from '../../types';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [importPrice, setImportPrice] = useState('0');
  const [retailPrice, setRetailPrice] = useState('0');
  const [warranty, setWarranty] = useState('1');
  const [warrantyUnit, setWarrantyUnit] = useState('tháng');

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      category: category || 'Chưa phân loại',
      quantity: parseInt(quantity) || 1,
      importPrice: parseFloat(importPrice) || 0,
      retailPrice: parseFloat(retailPrice) || 0,
      warranty: parseInt(warranty) || 0,
      warrantyUnit
    });

    // Reset form
    setName('');
    setDescription('');
    setCategory('');
    setQuantity('1');
    setImportPrice('0');
    setRetailPrice('0');
    setWarranty('1');
    setWarrantyUnit('tháng');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Thêm sản phẩm mới</h2>
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
                onChange={e => setName(e.target.value)}
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
                onChange={e => setDescription(e.target.value)}
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
                  onChange={e => setCategory(e.target.value)}
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
                  <span className="text-xl text-slate-600 dark:text-slate-300">+</span>
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
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Số lượng:</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Giá nhập:</label>
                  <input
                    type="number"
                    value={importPrice}
                    onChange={e => setImportPrice(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Giá bán lẻ:</label>
                  <input
                    type="number"
                    value={retailPrice}
                    onChange={e => setRetailPrice(e.target.value)}
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
                  onChange={e => setWarranty(e.target.value)}
                  min="0"
                  className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <select
                  value={warrantyUnit}
                  onChange={e => setWarrantyUnit(e.target.value)}
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
  onSave: (items: Array<{ partId: string; partName: string; quantity: number; importPrice: number; sellingPrice: number }>, supplier: string, totalAmount: number, note: string) => void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<Array<{
    partId: string;
    partName: string;
    sku: string;
    quantity: number;
    importPrice: number;
    sellingPrice: number;
  }>>([]);

  const filteredParts = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!searchTerm) return parts; // Show all parts when no search term
    return parts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q)
    );
  }, [parts, searchTerm]);

  const addToReceipt = (part: Part) => {
    const existing = receiptItems.find(item => item.partId === part.id);
    if (existing) {
      setReceiptItems(items => 
        items.map(item => 
          item.partId === part.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setReceiptItems([...receiptItems, {
        partId: part.id,
        partName: part.name,
        sku: part.sku,
        quantity: 1,
        importPrice: 0,
        sellingPrice: part.retailPrice[currentBranchId] || 0
      }]);
    }
    setSearchTerm('');
  };

  const updateReceiptItem = (partId: string, field: 'quantity' | 'importPrice' | 'sellingPrice', value: number) => {
    setReceiptItems(items =>
      items.map(item =>
        item.partId === partId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeReceiptItem = (partId: string) => {
    setReceiptItems(items => items.filter(item => item.partId !== partId));
  };

  const totalAmount = useMemo(() => {
    return receiptItems.reduce((sum, item) => sum + (item.importPrice * item.quantity), 0);
  }, [receiptItems]);

  const handleSave = () => {
    if (receiptItems.length === 0) {
      alert('Vui lòng chọn sản phẩm nhập kho');
      return;
    }
    onSave(receiptItems, selectedSupplier, totalAmount, '');
    setReceiptItems([]);
    setSelectedSupplier('');
    setSearchTerm('');
  };

  const handleAddNewProduct = (productData: any) => {
    // Add new product to receipt items
    const newItem = {
      partId: `temp-${Date.now()}`, // Temporary ID
      partName: productData.name,
      sku: `SKU-${Date.now()}`,
      quantity: productData.quantity,
      importPrice: productData.importPrice,
      sellingPrice: productData.retailPrice
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Chọn sản phẩm nhập kho</h2>
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
              onChange={e => setSearchTerm(e.target.value)}
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
                {filteredParts.map(part => (
                  <div
                    key={part.id}
                    onClick={() => addToReceipt(part)}
                    className="p-4 bg-white dark:bg-slate-800 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border border-slate-200 dark:border-slate-600 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                    <div className="text-sm text-slate-500 mt-1">SKU: {part.sku}</div>
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
                onChange={e => setSelectedSupplier(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <button className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600">
                <span className="text-xl text-slate-600 dark:text-slate-300">+</span>
              </button>
            </div>
          </div>

          {/* Receipt Items */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Giỏ hàng nhập kho:</h3>
            
            {receiptItems.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                Chưa có sản phẩm nào
              </div>
            ) : (
              receiptItems.map(item => (
                <div key={item.partId} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  {/* Product Name & Delete */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{item.partName}</div>
                      <div className="text-xs text-slate-500 mt-1">SKU: {item.sku}</div>
                    </div>
                    <button
                      onClick={() => removeReceiptItem(item.partId)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Số lượng:</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateReceiptItem(item.partId, 'quantity', Math.max(1, item.quantity - 1))}
                          className="w-7 h-7 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateReceiptItem(item.partId, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                        <button
                          onClick={() => updateReceiptItem(item.partId, 'quantity', item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Price Inputs */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Giá nhập:</label>
                      <input
                        type="number"
                        value={item.importPrice}
                        onChange={e => updateReceiptItem(item.partId, 'importPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm text-right"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Giá bán:</label>
                      <input
                        type="number"
                        value={item.sellingPrice}
                        onChange={e => updateReceiptItem(item.partId, 'sellingPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm text-right"
                        placeholder="0"
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Thành tiền:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(item.importPrice * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Payment Section */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Thanh toán:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentType" defaultChecked className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Thanh toán một phần</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentType" className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Thanh toán đủ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentType" className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Ghi nợ</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 text-sm">
                <div className="flex-1">
                  <label className="text-slate-600 dark:text-slate-400">Số tiền thanh toán</label>
                  <input
                    type="number"
                    defaultValue={0}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 mt-1"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-slate-600 dark:text-slate-400">Còn nợ: {formatCurrency(totalAmount)}</label>
                </div>
              </div>

              <div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" defaultChecked className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Tiền mặt</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Chuyển khoản</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Hạch toán:</label>
                <select className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                  <option>Mua hàng/nhập kho</option>
                  <option>Nhập trả hàng</option>
                  <option>Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Thời gian nhập hàng:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeOption" defaultChecked className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Thời gian hiện tại</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeOption" className="text-blue-600" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Tùy chỉnh</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 px-4 py-3 rounded-lg font-medium"
              >
                LƯU NHÁP
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-medium"
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

// Inventory History Modal Component (Ảnh 3)
const InventoryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  transactions: InventoryTransaction[];
}> = ({ isOpen, onClose, transactions }) => {
  const [activeTimeFilter, setActiveTimeFilter] = useState('7days');
  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date(), true));
  const [customEndDate, setCustomEndDate] = useState(formatDate(new Date(), true));
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    const now = new Date();
    
    // Apply time filter
    switch (activeTimeFilter) {
      case '7days':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.date) >= sevenDaysAgo);
        break;
      case '30days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => new Date(t.date) >= thirtyDaysAgo);
        break;
      case 'thisMonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter(t => new Date(t.date) >= startOfMonth);
        break;
      case 'custom':
        filtered = filtered.filter(t => {
          const date = new Date(t.date);
          return date >= new Date(customStartDate) && date <= new Date(customEndDate);
        });
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.partName.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, activeTimeFilter, customStartDate, customEndDate, searchTerm]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.totalPrice, 0);
  }, [filteredTransactions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Lịch sử nhập kho</h2>
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
              { key: '7days', label: '7 ngày qua' },
              { key: '30days', label: '30 ngày qua' },
              { key: 'thisMonth', label: 'Tháng này' },
              { key: 'custom', label: 'Tùy chọn' }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTimeFilter === filter.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {activeTimeFilter === 'custom' && (
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Từ ngày</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Đến ngày</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
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
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Tổng số tiền: <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{filteredTransactions.length}</span>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-400">Tổng giá trị</div>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(totalAmount)}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ngày</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nhà cung cấp</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nội dung</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Số tiền</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{formatDate(new Date(transaction.date), false)}</div>
                      <div className="text-xs text-slate-500">{new Date(transaction.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {transaction.notes && transaction.notes.includes('NCC:') 
                          ? transaction.notes.split('NCC:')[1]?.trim() || 'Chưa rõ'
                          : 'Chưa rõ'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{transaction.partName}</div>
                      <div className="text-xs text-slate-500">SL: {transaction.quantity}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(transaction.totalPrice)}</div>
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
  const { parts, upsertPart, currentBranchId, recordInventoryTransaction, inventoryTransactions } = useAppContext();
  const [activeTab, setActiveTab] = useState('stock'); // stock, categories, lookup, history
  const [showGoodsReceipt, setShowGoodsReceipt] = useState(false);
  const [showInventoryHistory, setShowInventoryHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredParts = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = parts.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q)
    );

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }

    return filtered;
  }, [parts, search, categoryFilter]);

  const totalStockValue = useMemo(() => {
    return parts.reduce((sum, part) => {
      const stock = part.stock[currentBranchId] || 0;
      const price = part.retailPrice[currentBranchId] || 0;
      return sum + (stock * price);
    }, 0);
  }, [parts, currentBranchId]);

  const totalStockQuantity = useMemo(() => {
    return parts.reduce((sum, part) => {
      return sum + (part.stock[currentBranchId] || 0);
    }, 0);
  }, [parts, currentBranchId]);

  const handleSaveGoodsReceipt = useCallback((
    items: Array<{ partId: string; partName: string; quantity: number; importPrice: number; sellingPrice: number }>,
    supplier: string,
    totalAmount: number,
    note: string
  ) => {
    // Update stock and prices for each item
    items.forEach(item => {
      const part = parts.find(p => p.id === item.partId);
      if (part) {
        const currentStock = part.stock[currentBranchId] || 0;
        upsertPart({
          id: item.partId,
          stock: { ...part.stock, [currentBranchId]: currentStock + item.quantity },
          retailPrice: { ...part.retailPrice, [currentBranchId]: item.sellingPrice }
        });

        // Record transaction
        recordInventoryTransaction({
          type: 'Nhập kho',
          partId: item.partId,
          partName: item.partName,
          quantity: item.quantity,
          date: new Date().toISOString(),
          totalPrice: item.importPrice * item.quantity,
          branchId: currentBranchId,
          notes: `NCC: ${supplier}`
        });
      }
    });

    setShowGoodsReceipt(false);
    alert('Nhập kho thành công!');
  }, [parts, currentBranchId, upsertPart, recordInventoryTransaction]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        {/* Tabs and Buttons Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'stock', label: '📦 Tồn kho', icon: '📦' },
              { key: 'categories', label: '📑 Danh mục sản phẩm', icon: '📑' },
              { key: 'lookup', label: '🔍 Tra cứu Phụ tùng', icon: '🔍' },
              { key: 'history', label: '📋 Lịch sử', icon: '📋' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowGoodsReceipt(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              <span className="text-xl">+</span>
              <span>Tạo phiếu nhập</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium">
              <span className="text-xl">�</span>
              <span>Chuyển kho</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium">
              <span className="text-xl">📥</span>
              <span>Nhập CSV tồn kho</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'stock' && (
          <div className="space-y-6">
            {/* Search and Filters Row */}
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="all">Còn hàng</option>
                <option value="lowStock">Sắp hết</option>
                <option value="outOfStock">Hết hàng</option>
              </select>

              <select className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                <option>Tất cả danh mục</option>
              </select>
            </div>
            
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Tổng SL tồn</span>
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📦</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totalStockQuantity}</div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Giá trị tồn</span>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-green-600">{formatCurrency(totalStockValue)}</div>
              </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">STT</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tên sản phẩm</th>
                      <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tồn kho</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giá bán</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          <div className="text-6xl mb-4">🗂️</div>
                          <div className="text-lg">Không có sản phẩm nào</div>
                          <div className="text-sm">Hãy thử một bộ lọc khác hoặc thêm sản phẩm mới</div>
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((part, index) => {
                        const stock = part.stock[currentBranchId] || 0;
                        const price = part.retailPrice[currentBranchId] || 0;
                        const value = stock * price;

                        return (
                          <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                              <div className="text-xs text-slate-500">SKU: {part.sku}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                                stock === 0 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  : stock < 10
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {stock}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900 dark:text-slate-100">
                              {formatCurrency(price)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrency(value)}
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

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Lịch sử giao dịch kho</h2>
              <button
                onClick={() => setShowInventoryHistory(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Xem chi tiết
              </button>
            </div>
            <div className="text-center text-slate-500 py-8">
              Click "Xem chi tiết" để xem lịch sử nhập kho
            </div>
          </div>
        )}

        {(activeTab === 'categories' || activeTab === 'lookup') && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-center text-slate-500 py-8">
              Chức năng đang phát triển
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <GoodsReceiptModal
        isOpen={showGoodsReceipt}
        onClose={() => setShowGoodsReceipt(false)}
        parts={parts}
        currentBranchId={currentBranchId}
        onSave={handleSaveGoodsReceipt}
      />

      <InventoryHistoryModal
        isOpen={showInventoryHistory}
        onClose={() => setShowInventoryHistory(false)}
        transactions={inventoryTransactions}
      />
    </div>
  );
};

export default InventoryManager;
