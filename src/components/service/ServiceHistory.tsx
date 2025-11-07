import React, { useState, useMemo } from 'react';
import { useWorkOrders } from '../../hooks/useSupabase';
import { formatCurrency, formatDate } from '../../utils/format';

interface ServiceHistoryProps {
  currentBranchId: string;
}

export const ServiceHistory: React.FC<ServiceHistoryProps> = ({ currentBranchId }) => {
  const { data: workOrders = [], isLoading } = useWorkOrders();
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter work orders
  const filteredOrders = useMemo(() => {
    return workOrders.filter(order => {
      // Branch filter
      if (order.branchId !== currentBranchId) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matches = [
          order.id?.toLowerCase(),
          order.customerName?.toLowerCase(),
          order.customerPhone?.toLowerCase(),
          order.vehicleModel?.toLowerCase(),
          order.licensePlate?.toLowerCase(),
          order.issueDescription?.toLowerCase()
        ].some(field => field?.includes(search));
        
        if (!matches) return false;
      }
      
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      
      // Date range filter
      if (startDate && order.creationDate < startDate) return false;
      if (endDate && order.creationDate > endDate) return false;
      
      return true;
    }).sort((a, b) => new Date(b.creationDate || 0).getTime() - new Date(a.creationDate || 0).getTime());
  }, [workOrders, searchTerm, statusFilter, startDate, endDate, currentBranchId]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Mã Phiếu', 'Ngày tạo', 'Khách hàng', 'Xe', 'Biển số', 'Trạng thái', 'Tổng chi phí'];
    const csvContent = [
      headers.join(','),
      ...filteredOrders.map(order => [
        `#${order.id?.slice(-6) || ''}`,
        formatDate(order.creationDate, true),
        order.customerName || '',
        order.vehicleModel || '',
        order.licensePlate || '',
        order.status || '',
        order.total?.toString() || '0'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `lich-su-sua-chua-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      'Tiếp nhận': { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
      'Đang sửa': { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300' },
      'Đã sửa xong': { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300' },
      'Trả máy': { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['Tiếp nhận'];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 sm:mb-0">
          Lịch sử sửa chữa
        </h1>
        
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
        >
          📥 Xuất CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Tìm theo mã, tên, SĐT, xe, biển số..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Tiếp nhận">Tiếp nhận</option>
            <option value="Đang sửa">Đang sửa</option>
            <option value="Đã sửa xong">Đã sửa xong</option>
            <option value="Trả máy">Trả máy</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Hiển thị {paginatedOrders.length} / {filteredOrders.length} phiếu sửa chữa
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Mã Phiếu
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Xe
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Biển số
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Tổng chi phí
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Không có phiếu sửa chữa nào.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => (
                  <tr 
                    key={order.id} 
                    className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                      index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-700/20'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">
                      #{order.id?.slice(-6) || ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(order.creationDate, true)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        {order.customerName || 'N/A'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {order.customerPhone || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {order.vehicleModel || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {order.licensePlate || 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status || 'Tiếp nhận'} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(order.total || 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-slate-800 px-4 py-3 border-t border-slate-200 dark:border-slate-700 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Trang {currentPage} / {totalPages}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};