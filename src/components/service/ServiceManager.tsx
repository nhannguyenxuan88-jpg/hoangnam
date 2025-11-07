import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { useWorkOrders, useCreateWorkOrder, useUpdateWorkOrder } from '../../hooks/useSupabase';
import type { WorkOrder, Part, WorkOrderPart } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

type WorkOrderStatus = 'Tiếp nhận' | 'Đang sửa' | 'Đã sửa xong' | 'Trả máy';

export default function ServiceManager() {
  const { parts, customers, upsertCustomer, setCashTransactions, setPaymentSources, paymentSources, currentBranchId } = useAppContext();
  
  // Supabase hooks
  const { data: workOrders = [], isLoading: loadingOrders } = useWorkOrders();
  const createWorkOrder = useCreateWorkOrder();
  const updateWorkOrder = useUpdateWorkOrder();
  
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkOrderStatus>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'inProgress' | 'done' | 'delivered'>('all');

  // Service Templates
  const serviceTemplates = [
    {
      id: 'oil-change',
      name: 'Thay dầu động cơ',
      description: 'Thay dầu và lọc dầu động cơ',
      duration: 30,
      laborCost: 300000,
      parts: [
        { name: 'Dầu động cơ 10W40', quantity: 1, price: 120000, unit: 'chai' },
        { name: 'Lọc dầu', quantity: 1, price: 30000, unit: 'cái' }
      ]
    },
    {
      id: 'brake-service',
      name: 'Sửa phanh',
      description: 'Thay má phanh và bảo dưỡng hệ thống phanh',
      duration: 45,
      laborCost: 505000,
      parts: [
        { name: 'Má phanh trước', quantity: 2, price: 160000, unit: 'cái' },
        { name: 'Má phanh sau', quantity: 2, price: 120000, unit: 'cái' },
        { name: 'Dầu phanh', quantity: 1, price: 25000, unit: 'chai' }
      ]
    },
    {
      id: 'cleaning',
      name: 'Vệ sinh kim phun',
      description: 'Vệ sinh và hiệu chỉnh kim phun xăng',
      duration: 60,
      laborCost: 150000,
      parts: [
        { name: 'Dung dịch vệ sinh kim phun', quantity: 1, price: 50000, unit: 'chai' }
      ]
    },
    {
      id: 'oil-box',
      name: 'Thay nhớt hộp số',
      description: 'Thay dầu hộp số và kiểm tra',
      duration: 25,
      laborCost: 140000,
      parts: [
        { name: 'Dầu hộp số', quantity: 1, price: 60000, unit: 'chai' }
      ]
    },
    {
      id: 'bug-check',
      name: 'Thay bugi',
      description: 'Thay bugi và kiểm tra hệ thống đánh lửa',
      duration: 20,
      laborCost: 85000,
      parts: [
        { name: 'Bugi', quantity: 1, price: 35000, unit: 'cái' }
      ]
    },
    {
      id: 'full-maintenance',
      name: 'Bảo dưỡng tổng quát',
      description: 'Bảo dưỡng định kỳ đầy đủ',
      duration: 90,
      laborCost: 570000,
      parts: [
        { name: 'Dầu động cơ 10W40', quantity: 1, price: 120000, unit: 'chai' },
        { name: 'Lọc dầu', quantity: 1, price: 30000, unit: 'cái' },
        { name: 'Lọc không khí', quantity: 1, price: 25000, unit: 'cái' },
        { name: 'Bugi', quantity: 1, price: 35000, unit: 'cái' },
        { name: 'Dầu hộp số', quantity: 1, price: 60000, unit: 'chai' }
      ]
    }
  ];

  const filteredOrders = useMemo(() => {
    let filtered = workOrders;
    
    // Tab filter
    if (activeTab === 'pending') filtered = filtered.filter(o => o.status === 'Tiếp nhận');
    else if (activeTab === 'inProgress') filtered = filtered.filter(o => o.status === 'Đang sửa');
    else if (activeTab === 'done') filtered = filtered.filter(o => o.status === 'Đã sửa xong');
    else if (activeTab === 'delivered') filtered = filtered.filter(o => o.status === 'Trả máy');
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(o => 
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.vehicleModel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.licensePlate?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  }, [workOrders, activeTab, searchQuery]);

  const stats = useMemo(() => {
    const pending = workOrders.filter(o => o.status === 'Tiếp nhận').length;
    const inProgress = workOrders.filter(o => o.status === 'Đang sửa').length;
    const done = workOrders.filter(o => o.status === 'Đã sửa xong').length;
    const delivered = workOrders.filter(o => o.status === 'Trả máy').length;
    const todayRevenue = workOrders
      .filter(o => o.paymentStatus === 'paid' && new Date(o.creationDate).toDateString() === new Date().toDateString())
      .reduce((sum, o) => sum + o.total, 0);
    const todayProfit = workOrders
      .filter(o => o.paymentStatus === 'paid' && new Date(o.creationDate).toDateString() === new Date().toDateString())
      .reduce((sum, o) => sum + (o.total - (o.partsUsed?.reduce((s: number, p: WorkOrderPart) => s + p.price * p.quantity, 0) || 0)), 0);
    
    return { pending, inProgress, done, delivered, todayRevenue, todayProfit };
  }, [workOrders]);

  const handleOpenModal = (order?: WorkOrder) => {
    if (order) {
      setEditingOrder(order);
    } else {
      // Create empty order template
      setEditingOrder({
        id: '',
        customerName: '',
        customerPhone: '',
        vehicleModel: '',
        licensePlate: '',
        issueDescription: '',
        technicianName: '',
        status: 'Tiếp nhận',
        laborCost: 0,
        discount: 0,
        partsUsed: [],
        total: 0,
        branchId: currentBranchId,
        paymentStatus: 'unpaid',
        creationDate: new Date().toISOString()
      } as WorkOrder);
    }
    setShowModal(true);
  };

  const handleApplyTemplate = (template: typeof serviceTemplates[0]) => {
    const newOrder: Partial<WorkOrder> = {
      id: '',
      customerName: '',
      customerPhone: '',
      vehicleModel: '',
      licensePlate: '',
      issueDescription: template.description,
      laborCost: template.laborCost,
      partsUsed: template.parts.map((p, idx) => ({
        partId: `TEMPLATE-${idx}`,
        partName: p.name,
        sku: '',
        quantity: p.quantity,
        price: p.price
      })),
      status: 'Tiếp nhận',
      paymentStatus: 'unpaid',
      discount: 0,
      total: 0,
      creationDate: new Date().toISOString(),
      branchId: currentBranchId,
      technicianName: ''
    };
    setEditingOrder(newOrder as WorkOrder);
    setShowTemplateModal(false);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {loadingOrders && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Đang tải dữ liệu...</p>
          </div>
        </div>
      )}

      {!loadingOrders && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard label="Tiếp nhận" value={stats.pending} icon="📋" color="blue" />
            <StatCard label="Đang sửa" value={stats.inProgress} icon="🔧" color="orange" />
            <StatCard label="Đã sửa xong" value={stats.done} icon="✅" color="green" />
            <StatCard label="Trả máy" value={stats.delivered} icon="✋" color="purple" />
            <StatCard label="Doanh thu hôm nay" value={`${formatCurrency(stats.todayRevenue).replace('₫', '')}₫`} icon="💰" color="green" />
            <StatCard label="Lợi nhuận hôm nay" value={`${formatCurrency(stats.todayProfit).replace('₫', '')}₫`} icon="📈" color="blue" />
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
              <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
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

          <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            📊 Báo cáo
          </button>
          
          <button 
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            📝 Mẫu SC
          </button>
          
          <button 
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            ➕ Thêm Phiếu
          </button>
          
          <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium">
            📱 SMS QH
          </button>
        </div>
      </div>

      {/* Tabs and Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-700">
          <TabButton label="Tất cả" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
          <TabButton label="Tiếp nhận" active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} />
          <TabButton label="Đang sửa" active={activeTab === 'inProgress'} onClick={() => setActiveTab('inProgress')} />
          <TabButton label="Đã sửa xong" active={activeTab === 'done'} onClick={() => setActiveTab('done')} />
          <TabButton label="Trả máy" active={activeTab === 'delivered'} onClick={() => setActiveTab('delivered')} />
          
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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Mã Phiếu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Khách hàng</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Xe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Ngày tạo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Trạng thái</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Tổng chi phí</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Không có phiếu sửa chữa nào.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">
                      #{order.id.slice(-6)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{order.customerName}</div>
                      <div className="text-xs text-slate-500">{order.customerPhone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900 dark:text-slate-100">{order.vehicleModel || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{order.licensePlate || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(order.creationDate, true)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleOpenModal(order)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Mẫu sửa chữa thường dùng</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">✕</button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Chọn mẫu sửa chữa để tự động điền thông tin vào phiếu sửa chữa
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {serviceTemplates.map(template => (
                  <div key={template.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{template.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{template.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{template.duration} phút</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(template.laborCost + template.parts.reduce((s, p) => s + p.price * p.quantity, 0))}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">Phụ tùng cần thiết:</p>
                      {template.parts.map((part, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{part.name} x{part.quantity} {part.unit}</span>
                          <span>{formatCurrency(part.price * part.quantity)}</span>
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
              updateWorkOrder.mutate({ id: order.id, updates: order });
            } else {
              // Create new
              createWorkOrder.mutate(order);
            }
            setShowModal(false);
            setEditingOrder(undefined);
          }}
          parts={parts}
          customers={customers}
          upsertCustomer={upsertCustomer}
          setCashTransactions={setCashTransactions}
          setPaymentSources={setPaymentSources}
          paymentSources={paymentSources}
          currentBranchId={currentBranchId}
        />
      )}
        </>
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
  customers: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  paymentSources: any[];
  currentBranchId: string;
}> = ({ order, onClose, onSave, parts, customers, upsertCustomer, setCashTransactions, setPaymentSources, paymentSources, currentBranchId }) => {
  const [formData, setFormData] = useState<Partial<WorkOrder>>(() => {
    if (order?.id) return order;
    return {
      id: order?.id || '',
      customerName: order?.customerName || '',
      customerPhone: order?.customerPhone || '',
      vehicleModel: order?.vehicleModel || '',
      licensePlate: order?.licensePlate || '',
      issueDescription: order?.issueDescription || '',
      technicianName: order?.technicianName || '',
      status: order?.status || 'Tiếp nhận',
      laborCost: order?.laborCost || 0,
      discount: order?.discount || 0,
      partsUsed: order?.partsUsed || [],
      total: order?.total || 0,
      branchId: order?.branchId || currentBranchId,
      paymentStatus: order?.paymentStatus || 'unpaid',
      creationDate: order?.creationDate || new Date().toISOString()
    };
  });

  const [searchPart, setSearchPart] = useState('');
  const [selectedParts, setSelectedParts] = useState<WorkOrderPart[]>([]);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partialPayment, setPartialPayment] = useState(0);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', vehicleModel: '', licensePlate: '' });
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Additional services state (Báo giá - Gia công/Đặt hàng)
  const [additionalServices, setAdditionalServices] = useState<Array<{
    id: string;
    description: string;
    quantity: number;
    price: number;
  }>>([]);
  const [newService, setNewService] = useState({
    description: '',
    quantity: 1,
    price: 0
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
      setCustomerSearch('');
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

  // Filter customers based on search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate totals
  const partsTotal = selectedParts.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 0), 0);
  const servicesTotal = additionalServices.reduce((sum, s) => sum + (s.price || 0) * (s.quantity || 0), 0);
  const subtotal = (formData.laborCost || 0) + partsTotal + servicesTotal;
  const discount = formData.discount || 0;
  const total = Math.max(0, subtotal - discount);
  
  // Debug log
  console.log('💰 Tính toán:', {
    laborCost: formData.laborCost,
    partsTotal,
    servicesTotal,
    subtotal,
    discount,
    total
  });
  
  // Calculate payment summary
  const totalDeposit = depositAmount || 0;
  const totalAdditionalPayment = showPartialPayment ? partialPayment : 0;
  const totalPaid = totalDeposit + totalAdditionalPayment;
  const remainingAmount = Math.max(0, total - totalPaid);

  const handleSave = () => {
    // Add/update customer
    if (formData.customerName && formData.customerPhone) {
      const existingCustomer = customers.find(c => c.phone === formData.customerPhone);
      if (!existingCustomer) {
        upsertCustomer({
          id: `CUST-${Date.now()}`,
          name: formData.customerName,
          phone: formData.customerPhone,
          created_at: new Date().toISOString()
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

    const finalOrder: WorkOrder = {
      id: formData.id || `WO-${Date.now()}`,
      customerName: formData.customerName || '',
      customerPhone: formData.customerPhone || '',
      vehicleModel: formData.vehicleModel || '',
      licensePlate: formData.licensePlate || '',
      issueDescription: formData.issueDescription || '',
      technicianName: formData.technicianName || '',
      status: formData.status || 'Tiếp nhận',
      laborCost: formData.laborCost || 0,
      discount: discount,
      partsUsed: selectedParts,
      total: total,
      branchId: currentBranchId,
      
      // Deposit fields
      depositAmount: depositAmount > 0 ? depositAmount : undefined,
      depositDate: depositAmount > 0 && !order?.depositDate ? new Date().toISOString() : order?.depositDate,
      
      // Payment fields
      paymentStatus: paymentStatus,
      paymentMethod: formData.paymentMethod,
      additionalPayment: totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
      totalPaid: totalPaid > 0 ? totalPaid : undefined,
      remainingAmount: remainingAmount,
      
      creationDate: formData.creationDate || new Date().toISOString()
    };

    // Handle deposit transaction (first time only)
    if (depositAmount > 0 && !order?.depositAmount && formData.paymentMethod) {
      const depositTxId = `DEP-${Date.now()}`;
      setCashTransactions((prev: any[]) => [
        ...prev,
        {
          id: depositTxId,
          type: 'deposit',
          category: 'service_deposit',
          amount: depositAmount,
          date: new Date().toISOString(),
          description: `Đặt cọc sửa chữa #${finalOrder.id.slice(-6)} - ${formData.customerName}`,
          branchId: currentBranchId,
          paymentSource: formData.paymentMethod,
          reference: finalOrder.id
        }
      ]);

      setPaymentSources((prev: any[]) => 
        prev.map(ps => {
          if (ps.id === formData.paymentMethod) {
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]: (ps.balance[currentBranchId] || 0) + depositAmount
              }
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
          type: 'income',
          category: 'service_income',
          amount: totalAdditionalPayment,
          date: new Date().toISOString(),
          description: `Thu tiền sửa chữa #${finalOrder.id.slice(-6)} - ${formData.customerName}`,
          branchId: currentBranchId,
          paymentSource: formData.paymentMethod,
          reference: finalOrder.id
        }
      ]);

      setPaymentSources((prev: any[]) => 
        prev.map(ps => {
          if (ps.id === formData.paymentMethod) {
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]: (ps.balance[currentBranchId] || 0) + totalAdditionalPayment
              }
            };
          }
          return ps;
        })
      );

      finalOrder.cashTransactionId = paymentTxId;
      finalOrder.paymentDate = new Date().toISOString();
    }

    onSave(finalOrder);
  };

  const handleAddPart = (part: Part) => {
    const existing = selectedParts.find(p => p.partId === part.id);
    if (existing) {
      setSelectedParts(selectedParts.map(p => 
        p.partId === part.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku || '',
          quantity: 1,
          price: part.retailPrice[currentBranchId] || 0
        }
      ]);
    }
    setShowPartSearch(false);
    setSearchPart('');
  };

  const filteredParts = parts.filter(p => 
    p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchPart.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formData.id ? 'Chi tiết phiếu sửa chữa' : 'Tạo phiếu sửa chữa mới'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-2xl">✕</button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Customer & Vehicle Info */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thông tin Khách hàng & Sự cố</h3>
              
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
                        setFormData({ ...formData, customerName: e.target.value });
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />
                    
                    {/* Customer Dropdown */}
                    {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.map(customer => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setFormData({ 
                                ...formData, 
                                customerName: customer.name,
                                customerPhone: customer.phone
                              });
                              setCustomerSearch(customer.name);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">{customer.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{customer.phone}</div>
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
                          📞 {formData.customerPhone}
                        </div>
                        {(formData.vehicleModel || formData.licensePlate) && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            🏍️ {formData.vehicleModel} {formData.licensePlate && `- ${formData.licensePlate}`}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearch('');
                          setFormData({
                            ...formData,
                            customerName: '',
                            customerPhone: '',
                            vehicleModel: '',
                            licensePlate: ''
                          });
                        }}
                        className="text-slate-400 hover:text-red-500 text-sm"
                        title="Xóa khách hàng"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Số KM hiện tại</label>
                <input
                  type="number"
                  placeholder="15000"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả sự cố</label>
                <textarea
                  rows={4}
                  placeholder="Bảo dưỡng định kỳ, thay nhớt..."
                  value={formData.issueDescription || ''}
                  onChange={(e) => setFormData({ ...formData, issueDescription: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chi tiết Dịch vụ</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trạng thái</label>
                  <select
                    value={formData.status || 'Tiếp nhận'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className={`w-full px-3 py-2 border rounded-lg font-medium ${
                      formData.status === 'Tiếp nhận' 
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : formData.status === 'Đang sửa'
                        ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300'
                        : formData.status === 'Đã sửa xong'
                        ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                        : 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                    }`}
                  >
                    <option value="Tiếp nhận" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Tiếp nhận</option>
                    <option value="Đang sửa" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Đang sửa</option>
                    <option value="Đã sửa xong" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Đã sửa xong</option>
                    <option value="Trả máy" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Trả máy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kỹ thuật viên</label>
                  <select
                    value={formData.technicianName || ''}
                    onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Chọn kỹ thuật viên --</option>
                    <option>KTV 1</option>
                    <option>KTV 2</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phí dịch vụ (Công thợ)</label>
                <input
                  type="number"
                  placeholder="100.000"
                  value={formData.laborCost || ''}
                  onChange={(e) => setFormData({ ...formData, laborCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ghi chú nội bộ</label>
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
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Phụ tùng sử dụng</h3>
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
                {searchPart && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                    {filteredParts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Không tìm thấy phụ tùng</div>
                    ) : (
                      filteredParts.slice(0, 10).map(part => (
                        <button
                          key={part.id}
                          onClick={() => handleAddPart(part)}
                          className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                            <div className="text-xs text-slate-500">{part.sku}</div>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(part.retailPrice[currentBranchId] || 0)}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Tên</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">SL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Đ.Giá</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">T.Tiền</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {selectedParts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                        Chưa có phụ tùng nào
                      </td>
                    </tr>
                  ) : (
                    selectedParts.map((part, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800">
                        <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">{part.partName}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              setSelectedParts(selectedParts.map((p, i) => 
                                i === idx ? { ...p, quantity: newQty } : p
                              ));
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
                            onClick={() => setSelectedParts(selectedParts.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            🗑️
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
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Báo giá (Gia công, Đặt hàng)</h3>
            
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Mô tả</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">SL</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Đơn giá</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Thành tiền</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      <button 
                        onClick={() => {
                          if (newService.description && newService.price > 0) {
                            setAdditionalServices([
                              ...additionalServices,
                              { ...newService, id: `SRV-${Date.now()}` }
                            ]);
                            setNewService({ description: '', quantity: 1, price: 0 });
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
                    <tr key={service.id} className="border-b border-slate-200 dark:border-slate-700">
                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">{service.description}</td>
                      <td className="px-4 py-2 text-center text-sm text-slate-900 dark:text-slate-100">{service.quantity}</td>
                      <td className="px-4 py-2 text-right text-sm text-slate-900 dark:text-slate-100">{formatCurrency(service.price)}</td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(service.price * service.quantity)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => setAdditionalServices(additionalServices.filter(s => s.id !== service.id))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          🗑️
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
                        onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={newService.quantity}
                        onChange={(e) => setNewService({ ...newService, quantity: Number(e.target.value) })}
                        className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        placeholder="Đơn giá"
                        value={newService.price || ''}
                        onChange={(e) => setNewService({ ...newService, price: Number(e.target.value) })}
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-slate-400">
                      {newService.price > 0 ? formatCurrency(newService.price * newService.quantity) : 'Thành tiền'}
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Thanh toán</h3>
                
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
                      Đặt cọc {order?.depositAmount ? `(Đã cọc: ${formatCurrency(order.depositAmount)})` : ''}
                    </span>
                  </label>
                  
                  {/* Deposit input - only show when checkbox is checked and not already deposited */}
                  {showDepositInput && !order?.depositAmount && (
                    <div className="pl-6">
                      <input
                        type="number"
                        placeholder="Số tiền đặt cọc"
                        value={depositAmount || ''}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
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
                          checked={formData.paymentMethod === 'cash'}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: 'cash' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">💵 Tiền mặt</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank"
                          checked={formData.paymentMethod === 'bank'}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: 'bank' })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">🏦 Chuyển khoản</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>
                  
                  {/* Partial payment checkbox - only show if status is "Trả máy" */}
                  {formData.status === 'Trả máy' && (
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
                        <span className="text-sm text-slate-700 dark:text-slate-300">Thanh toán khi trả xe</span>
                      </label>

                      {/* Partial Payment Input - only show when checkbox is checked */}
                      {showPartialPayment && (
                        <div className="pl-6 space-y-2">
                          <label className="text-xs text-slate-600 dark:text-slate-400">Số tiền thanh toán thêm:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              value={partialPayment || ''}
                              onChange={(e) => setPartialPayment(Number(e.target.value))}
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <button 
                              onClick={() => setPartialPayment(0)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              0%
                            </button>
                            <button 
                              onClick={() => setPartialPayment(Math.round(remainingAmount * 0.5))}
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

                {formData.status !== 'Trả máy' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    * Thanh toán khi trả xe chỉ khả dụng khi trạng thái là "Trả máy"
                  </p>
                )}
              </div>

              {/* Right: Summary */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tổng kết</h3>
                
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Phí dịch vụ:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(formData.laborCost || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Tiền phụ tùng:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(partsTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Gia công/Đặt hàng:</span>
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
                        value={formData.discount || ''}
                        onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
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
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">Tổng cộng:</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  
                  {/* Show payment breakdown if there's deposit or partial payment */}
                  {(totalDeposit > 0 || totalAdditionalPayment > 0) && (
                    <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-600">
                      {totalDeposit > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">Đã đặt cọc:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalDeposit)}
                          </span>
                        </div>
                      )}
                      {totalAdditionalPayment > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">Thanh toán thêm:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalAdditionalPayment)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {remainingAmount > 0 ? 'Còn phải thu:' : 'Đã thanh toán đủ'}
                        </span>
                        <span className={`text-lg font-bold ${remainingAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Thêm khách hàng</h3>
              <button 
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({ name: '', phone: '', vehicleModel: '', licensePlate: '' });
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl"
              >
                ✕
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
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
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
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
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
                    onChange={(e) => setNewCustomer({ ...newCustomer, vehicleModel: e.target.value })}
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
                    onChange={(e) => setNewCustomer({ ...newCustomer, licensePlate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({ name: '', phone: '', vehicleModel: '', licensePlate: '' });
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
                      created_at: new Date().toISOString()
                    });
                    
                    // Set the new customer to the form AND search field
                    setFormData({
                      ...formData,
                      customerName: newCustomer.name,
                      customerPhone: newCustomer.phone,
                      vehicleModel: newCustomer.vehicleModel,
                      licensePlate: newCustomer.licensePlate
                    });
                    
                    // Update customer search to show the name
                    setCustomerSearch(newCustomer.name);
                    
                    // Close modal and reset
                    setShowAddCustomerModal(false);
                    setNewCustomer({ name: '', phone: '', vehicleModel: '', licensePlate: '' });
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

const StatCard: React.FC<{ label: string; value: React.ReactNode; icon: string; color: string }> = ({ label, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    orange: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
    green: 'bg-green-500/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center text-2xl`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
      active
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
    }`}
  >
    {label}
  </button>
);

const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => {
  const styles = {
    'Tiếp nhận': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    'Đang sửa': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    'Đã sửa xong': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    'Trả máy': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
  };

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
};
