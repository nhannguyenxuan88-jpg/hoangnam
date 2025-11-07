import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { printElementById } from '../../utils/print';
import type { CartItem, Part, Customer, Sale } from '../../types';

// Sales History Modal Component
const SalesHistoryModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  sales: Sale[];
  currentBranchId: string;
}> = ({ isOpen, onClose, sales, currentBranchId }) => {
  const [activeTimeFilter, setActiveTimeFilter] = useState('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [customStartDate, setCustomStartDate] = useState(formatDate(new Date(), true));
  const [customEndDate, setCustomEndDate] = useState(formatDate(new Date(), true));

  // Filter sales based on selected criteria
  const filteredSales = useMemo(() => {
    let filtered = sales.filter(sale => sale.branchId === currentBranchId);
    
    // Time filter
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    switch (activeTimeFilter) {
      case 'today':
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate >= startOfDay && saleDate <= endOfDay;
        });
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate >= startOfYesterday && saleDate <= endOfYesterday;
        });
        break;
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(sale => new Date(sale.date) >= sevenDaysAgo);
        break;
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filtered = filtered.filter(sale => new Date(sale.date) >= thirtyDaysAgo);
        break;
      case 'custom':
        const customStart = new Date(customStartDate);
        const customEnd = new Date(customEndDate + 'T23:59:59');
        filtered = filtered.filter(sale => {
          const saleDate = new Date(sale.date);
          return saleDate >= customStart && saleDate <= customEnd;
        });
        break;
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'newest':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [sales, currentBranchId, activeTimeFilter, searchTerm, statusFilter, sortOrder, customStartDate, customEndDate]);

  // Calculate statistics
  const stats = useMemo(() => {
    const revenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const profit = filteredSales.reduce((sum, sale) => sum + (sale.total - sale.discount), 0);
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const orderCount = filteredSales.length;

    return { revenue, profit, profitMargin, orderCount };
  }, [filteredSales]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Lịch sử hóa đơn</h2>
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
              { key: 'today', label: 'Hôm nay' },
              { key: 'yesterday', label: 'Hôm qua' },
              { key: '7days', label: '7 ngày' },
              { key: '30days', label: '30 ngày' },
              { key: 'custom', label: 'Tùy chỉnh' }
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTimeFilter === filter.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {activeTimeFilter === 'custom' && (
            <div className="flex items-center gap-4 mb-4">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-500">đến</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          {/* Search and Sort */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Tìm mã hóa đơn hoặc tên khách hàng"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">Tất cả</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="p-6 grid grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">Doanh thu</div>
            <div className="text-blue-900 dark:text-blue-100 text-2xl font-bold">{formatCurrency(stats.revenue)}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="text-green-600 dark:text-green-400 text-sm font-medium">Lợi nhuận gộp</div>
            <div className="text-green-900 dark:text-green-100 text-2xl font-bold">{formatCurrency(stats.profit)}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="text-orange-600 dark:text-orange-400 text-sm font-medium">GM%</div>
            <div className="text-orange-900 dark:text-orange-100 text-2xl font-bold">{stats.profitMargin.toFixed(1)}%</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">Số hóa đơn</div>
            <div className="text-purple-900 dark:text-purple-100 text-2xl font-bold">{stats.orderCount}</div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredSales.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              Không có hóa đơn nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">MÃ</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">THỜI GIAN</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">TỔNG</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">SL HÀNG</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">KHÁCH HÀNG</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">THANH TOÁN</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{sale.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{formatDate(new Date(sale.date), false)}</div>
                      <div className="text-xs text-slate-500">{new Date(sale.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(sale.total)}</div>
                      {sale.discount > 0 && (
                        <div className="text-xs text-slate-500">Giảm: {formatCurrency(sale.discount)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{sale.customer.name}</div>
                      {sale.customer.phone && (
                        <div className="text-xs text-slate-500">{sale.customer.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        sale.paymentMethod === 'cash'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      }`}>
                        {sale.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          // TODO: Implement print receipt functionality
                          alert('Chức năng in hóa đơn sẽ được phát triển');
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        In lại
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            Trang 1 / 1
          </div>
          <div className="text-sm text-slate-500">
            Hiển thị {filteredSales.length} hóa đơn
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesManager: React.FC = () => {
  const { 
    parts, 
    customers, 
    sales,
    cartItems,
    setCartItems,
    clearCart,
    currentBranchId,
    finalizeSale
  } = useAppContext();

  // States
  const [partSearch, setPartSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [receiptId, setReceiptId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Cart functions
  const addToCart = useCallback((part: Part) => {
    const price = part.retailPrice?.[currentBranchId] ?? 0;
    const existing = cartItems.find(item => item.partId === part.id);
    
    if (existing) {
      setCartItems(prev => prev.map(item => 
        item.partId === part.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      const newItem: CartItem = {
        partId: part.id,
        partName: part.name,
        sku: part.sku,
        quantity: 1,
        sellingPrice: price,
        stockSnapshot: part.stock?.[currentBranchId] ?? 0,
        discount: 0
      };
      setCartItems(prev => [...prev, newItem]);
    }
  }, [cartItems, setCartItems, currentBranchId]);

  const removeFromCart = useCallback((partId: string) => {
    setCartItems(prev => prev.filter(item => item.partId !== partId));
  }, [setCartItems]);

  const updateCartQuantity = useCallback((partId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(partId);
      return;
    }
    
    setCartItems(prev => prev.map(item =>
      item.partId === partId
        ? { ...item, quantity }
        : item
    ));
  }, [setCartItems, removeFromCart]);

  // Calculate totals
  const subtotal = useMemo(() => 
    cartItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
    [cartItems]
  );

  const total = useMemo(() => 
    Math.max(0, subtotal - orderDiscount),
    [subtotal, orderDiscount]
  );

  // Filter parts by search
  const filteredParts = useMemo(() => {
    if (!partSearch) return parts;
    return parts.filter(part =>
      part.name.toLowerCase().includes(partSearch.toLowerCase()) ||
      part.sku.toLowerCase().includes(partSearch.toLowerCase())
    );
  }, [parts, partSearch]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 10);
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone?.includes(customerSearch) || false
    ).slice(0, 10);
  }, [customers, customerSearch]);

  // Handle finalize sale
  const handleFinalize = async () => {
    if (cartItems.length === 0) {
      alert('Vui lòng thêm sản phẩm vào giỏ hàng');
      return;
    }

    try {
      const saleData = {
        items: cartItems,
        customer: {
          id: selectedCustomer?.id,
          name: selectedCustomer?.name || customerName || 'Khách lẻ',
          phone: selectedCustomer?.phone || customerPhone,
        },
        discount: orderDiscount,
        paymentMethod: 'cash' as const,
        note: '',
      };

      finalizeSale(saleData);
      
      // Set receipt info for printing
      setReceiptId(`INV-${Date.now()}`);
      setCustomerName(saleData.customer.name);
      setCustomerPhone(saleData.customer.phone || '');

      // Clear form
      setSelectedCustomer(null);
      setCustomerSearch('');
      setOrderDiscount(0);

      // Print receipt
      setTimeout(() => {
        printElementById('last-receipt');
      }, 100);

    } catch (error) {
      console.error('Error finalizing sale:', error);
      alert('Có lỗi xảy ra khi hoàn tất giao dịch');
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.customer-dropdown-container')) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex h-screen">
        {/* Main Content Area - Products Grid */}
        <div className="flex-1 flex flex-col">
          {/* Search Bar */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Tìm theo tên sản phẩm hoặc SKU..."
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setShowSalesHistory(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg whitespace-nowrap transition-colors"
              >
                📊 Lịch sử bán hàng
              </button>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-6 overflow-y-auto">
            {filteredParts.length === 0 ? (
              <div className="text-center text-slate-400 mt-20">
                <div className="text-6xl mb-4">📦</div>
                <div className="text-xl font-medium mb-2">
                  {partSearch ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
                </div>
                <div className="text-sm">
                  {partSearch ? 'Hãy thử một từ khóa tìm kiếm khác' : 'Vui lòng thêm sản phẩm vào hệ thống'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {filteredParts.map(part => {
                  const price = part.retailPrice?.[currentBranchId] ?? 0;
                  const stock = part.stock?.[currentBranchId] ?? 0;
                  const isOutOfStock = stock <= 0;
                  
                  return (
                    <button
                      key={part.id}
                      onClick={() => !isOutOfStock && addToCart(part)}
                      disabled={isOutOfStock}
                      className={`aspect-square p-4 border rounded-xl transition-all duration-200 ${
                        isOutOfStock 
                          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 opacity-50 cursor-not-allowed'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1'
                      }`}
                    >
                      <div className="h-full flex flex-col">
                        {/* Product Image Placeholder */}
                        <div className="flex-1 flex items-center justify-center mb-3">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                          </div>
                        </div>
                        
                        {/* Product Info */}
                        <div className="text-left">
                          <div className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2 mb-1" title={part.name}>
                            {part.name}
                          </div>
                          <div className="text-xs text-slate-500 mb-2">SKU: {part.sku}</div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold text-blue-600">{formatCurrency(price)}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              isOutOfStock 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                : stock <= 5
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                            }`}>
                              {isOutOfStock ? 'Hết' : stock}
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
        <div className="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col">
          {/* Customer Selection */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="customer-dropdown-container">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                Chọn khách hàng
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc số điện thoại..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                />
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
                        <div className="font-medium text-slate-900 dark:text-slate-100">{customer.name}</div>
                        {customer.phone && <div className="text-sm text-slate-500">{customer.phone}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="font-medium text-blue-900 dark:text-blue-100">{selectedCustomer.name}</div>
                  {selectedCustomer.phone && <div className="text-sm text-blue-700 dark:text-blue-300">{selectedCustomer.phone}</div>}
                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setCustomerSearch('');
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
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Giỏ hàng</h3>
              <span className="text-sm text-slate-500">({cartItems.length} sản phẩm)</span>
            </div>
            
            {cartItems.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <div className="text-4xl mb-2">🛒</div>
                <div className="text-sm">Giỏ hàng trống</div>
                <div className="text-xs text-slate-400 mt-1">Chọn sản phẩm để thêm vào giỏ</div>
              </div>
            ) : (
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.partId} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-600 rounded-lg">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <span className="text-lg">📦</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-1">{item.partName}</div>
                      <div className="text-xs text-slate-500">SKU: {item.sku}</div>
                      <div className="text-sm text-blue-600 font-semibold">{formatCurrency(item.sellingPrice)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQuantity(item.partId, Math.max(1, item.quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-600 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-500"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.partId, item.quantity + 1)}
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
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Tạm tính:</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Giảm giá:</span>
                  <input
                    type="number"
                    value={orderDiscount}
                    onChange={(e) => setOrderDiscount(Number(e.target.value) || 0)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                    placeholder="0"
                  />
                  <span className="text-sm font-medium">{formatCurrency(orderDiscount)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-300 dark:border-slate-600">
                  <span>Tổng cộng:</span>
                  <span className="text-blue-600">{formatCurrency(Math.max(0, total - orderDiscount))}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={clearCart}
                  className="flex-1 px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Xóa hết
                </button>
                <button
                  onClick={handleFinalize}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
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
        sales={sales}
        currentBranchId={currentBranchId}
      />

      {/* Receipt Print Section (Hidden) */}
      {receiptId && (
        <div id="last-receipt" className="hidden">
          <div className="text-xs p-4 max-w-md mx-auto">
            <div className="font-semibold text-center text-sm mb-3">HÓA ĐƠN BÁN LẺ</div>
            <div>Mã: #{receiptId}</div>
            <div>Ngày: {formatDate(new Date(), false)}</div>
            <div>Khách: {customerName} {customerPhone && `(${customerPhone})`}</div>
            <table className="w-full mt-3 border-t text-xs">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-1">Mặt hàng</th>
                  <th className="py-1 text-center">SL</th>
                  <th className="py-1 text-right">Giá</th>
                  <th className="py-1 text-right">T.Tiền</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map(item => (
                  <tr key={item.partId}>
                    <td className="py-0.5 pr-2">{item.partName}</td>
                    <td className="py-0.5 text-center">{item.quantity}</td>
                    <td className="py-0.5 text-right">{formatCurrency(item.sellingPrice)}</td>
                    <td className="py-0.5 text-right">{formatCurrency(item.sellingPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t pt-2">
              <div className="flex justify-between"><span>Tạm tính:</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>Giảm giá:</span><span>{formatCurrency(orderDiscount)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1"><span>Tổng cộng:</span><span>{formatCurrency(Math.max(0, total - orderDiscount))}</span></div>
            </div>
            <div className="mt-4 text-center text-xs">
              <div>Cảm ơn quý khách đã mua hàng!</div>
              <div>Hẹn gặp lại!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManager;