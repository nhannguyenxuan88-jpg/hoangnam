import React, { useState, useMemo } from "react";
import {
  DollarSign,
  Plus,
  Check,
  X,
  Clock,
  Calendar,
  TrendingDown,
  Search,
  Trash2,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import type { EmployeeAdvance, EmployeeAdvancePayment } from "../../types";
import { formatCurrency, formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import {
  useEmployeeAdvances,
  useCreateEmployeeAdvance,
  useUpdateEmployeeAdvance,
  useDeleteEmployeeAdvance,
  useAdvancePayments,
} from "../../hooks/useEmployeeAdvanceRepository";

export default function EmployeeAdvanceManager() {
  const { employees, currentBranchId } = useAppContext();
  const { profile } = useAuth();

  // Fetch data from Supabase
  const { data: advances = [], isLoading } =
    useEmployeeAdvances(currentBranchId);
  const { mutateAsync: createAdvance } = useCreateEmployeeAdvance();
  const { mutateAsync: updateAdvance } = useUpdateEmployeeAdvance();
  const { mutateAsync: deleteAdvance } = useDeleteEmployeeAdvance();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] =
    useState<EmployeeAdvance | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | EmployeeAdvance["status"]
  >("all");

  // Form state
  const [formData, setFormData] = useState({
    employeeId: "",
    advanceAmount: "",
    reason: "",
    paymentMethod: "cash" as "cash" | "transfer",
    isInstallment: false,
    installmentMonths: "3",
  });

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees]
  );

  const filteredAdvances = useMemo(() => {
    return advances.filter((advance) => {
      const matchesSearch =
        advance.employeeName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        advance.reason?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || advance.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [advances, searchQuery, statusFilter]);

  const handleCreateAdvance = async () => {
    if (!formData.employeeId || !formData.advanceAmount) {
      showToast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    const employee = employees.find((e) => e.id === formData.employeeId);
    if (!employee) {
      showToast.error("Không tìm thấy nhân viên");
      return;
    }

    const advanceAmount = parseFloat(formData.advanceAmount);
    const installmentMonths = formData.isInstallment
      ? parseInt(formData.installmentMonths)
      : 0;
    const monthlyDeduction = formData.isInstallment
      ? Math.ceil(advanceAmount / installmentMonths)
      : 0;

    try {
      await createAdvance({
        employeeId: formData.employeeId,
        employeeName: employee.name,
        advanceAmount,
        advanceDate: new Date().toISOString(),
        reason: formData.reason,
        paymentMethod: formData.paymentMethod,
        status: "pending",
        isInstallment: formData.isInstallment,
        installmentMonths: formData.isInstallment
          ? installmentMonths
          : undefined,
        monthlyDeduction: formData.isInstallment ? monthlyDeduction : undefined,
        remainingAmount: advanceAmount,
        paidAmount: 0,
        branchId: currentBranchId,
      });

      setShowCreateModal(false);
      setFormData({
        employeeId: "",
        advanceAmount: "",
        reason: "",
        paymentMethod: "cash",
        isInstallment: false,
        installmentMonths: "3",
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleApprove = async (advanceId: string) => {
    if (!profile) return;

    try {
      await updateAdvance({
        id: advanceId,
        updates: {
          status: "approved",
          approvedBy: profile.full_name || profile.email,
          approvedDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReject = async (advanceId: string) => {
    try {
      await updateAdvance({
        id: advanceId,
        updates: {
          status: "rejected",
        },
      });
      showToast.info("Đã từ chối đơn ứng lương");
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handlePay = async (advanceId: string) => {
    try {
      await updateAdvance({
        id: advanceId,
        updates: {
          status: "paid",
        },
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (advanceId: string) => {
    if (!confirm("Bạn có chắc muốn xóa đơn ứng lương này không?")) return;

    try {
      await deleteAdvance(advanceId);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const getStatusBadge = (status: EmployeeAdvance["status"]) => {
    const styles = {
      pending:
        "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
      approved:
        "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
      rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
      paid: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    };

    const labels = {
      pending: "Chờ duyệt",
      approved: "Đã duyệt",
      rejected: "Từ chối",
      paid: "Đã chi trả",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {status === "pending" && <Clock className="w-3 h-3" />}
        {status === "approved" && <Check className="w-3 h-3" />}
        {status === "rejected" && <X className="w-3 h-3" />}
        {status === "paid" && <DollarSign className="w-3 h-3" />}
        {labels[status]}
      </span>
    );
  };

  const totalAdvances = useMemo(() => {
    return advances.reduce((sum, adv) => sum + adv.advanceAmount, 0);
  }, [advances]);

  const totalRemaining = useMemo(() => {
    return advances
      .filter((adv) => adv.status === "paid" || adv.status === "approved")
      .reduce((sum, adv) => sum + adv.remainingAmount, 0);
  }, [advances]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">
            Đang tải dữ liệu...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Quản lý Ứng lương
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Quản lý các khoản ứng lương và trả góp của nhân viên
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Tạo đơn ứng lương</span>
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Tổng ứng lương
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(totalAdvances)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Còn phải thu
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(totalRemaining)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Số đơn chờ duyệt
                  </p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {advances.filter((a) => a.status === "pending").length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhân viên, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã chi trả</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>
        </div>

        {/* Advances Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Nhân viên
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Ngày ứng
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Số tiền
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Nguồn
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Trả góp
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Còn lại
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredAdvances.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      {searchQuery || statusFilter !== "all"
                        ? "Không tìm thấy đơn ứng lương nào"
                        : "Chưa có đơn ứng lương nào"}
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((advance) => (
                    <tr
                      key={advance.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                      onClick={() => {
                        setSelectedAdvance(advance);
                        setShowDetailModal(true);
                      }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {advance.employeeName}
                          </div>
                          {advance.reason && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              {advance.reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(advance.advanceDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(advance.advanceAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm">
                          {advance.paymentMethod === "cash"
                            ? "💵 Mặt"
                            : "🏦 CK"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {advance.isInstallment ? (
                          <div className="text-sm">
                            <div className="text-blue-600 dark:text-blue-400 font-medium">
                              {advance.installmentMonths} tháng
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 text-xs">
                              {formatCurrency(advance.monthlyDeduction || 0)}
                              /tháng
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(advance.remainingAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(advance.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {advance.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApprove(advance.id)}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                title="Duyệt"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(advance.id)}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Từ chối"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {advance.status === "approved" && (
                            <button
                              onClick={() => handlePay(advance.id)}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                            >
                              Chi trả
                            </button>
                          )}
                          {(advance.status === "rejected" ||
                            advance.status === "pending") && (
                            <button
                              onClick={() => handleDelete(advance.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Tạo đơn ứng lương mới
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nhân viên <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">Chọn nhân viên...</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.position} (
                      {formatCurrency(emp.baseSalary)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số tiền ứng <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.advanceAmount}
                  onChange={(e) =>
                    setFormData({ ...formData, advanceAmount: e.target.value })
                  }
                  placeholder="VD: 5000000"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                {formData.advanceAmount && (
                  <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                    = {formatCurrency(parseFloat(formData.advanceAmount) || 0)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lý do ứng lương
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="VD: Đóng học phí cho con, chi phí y tế..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Nguồn tiền <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={formData.paymentMethod === "cash"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentMethod: e.target.value as "cash" | "transfer",
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      💵 Tiền mặt
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="transfer"
                      checked={formData.paymentMethod === "transfer"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          paymentMethod: e.target.value as "cash" | "transfer",
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      🏦 Chuyển khoản
                    </span>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isInstallment}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isInstallment: e.target.checked,
                      })
                    }
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cho phép trả góp hàng tháng
                  </span>
                </label>

                {formData.isInstallment && (
                  <div className="mt-4 ml-8 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Số tháng trả góp
                      </label>
                      <select
                        value={formData.installmentMonths}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            installmentMonths: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="2">2 tháng</option>
                        <option value="3">3 tháng</option>
                        <option value="4">4 tháng</option>
                        <option value="5">5 tháng</option>
                        <option value="6">6 tháng</option>
                        <option value="12">12 tháng</option>
                      </select>
                    </div>

                    {formData.advanceAmount && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          💡 Sẽ trừ khoảng{" "}
                          <strong>
                            {formatCurrency(
                              Math.ceil(
                                parseFloat(formData.advanceAmount) /
                                  parseInt(formData.installmentMonths)
                              )
                            )}
                          </strong>
                          /tháng trong{" "}
                          <strong>{formData.installmentMonths} tháng</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    employeeId: "",
                    advanceAmount: "",
                    reason: "",
                    paymentMethod: "cash",
                    isInstallment: false,
                    installmentMonths: "3",
                  });
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateAdvance}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Tạo đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Chi tiết đơn ứng lương
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAdvance(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Nhân viên
                  </p>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {selectedAdvance.employeeName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Trạng thái
                  </p>
                  <div className="mt-1">
                    {getStatusBadge(selectedAdvance.status)}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ngày ứng
                </p>
                <p className="text-base font-medium text-slate-900 dark:text-white">
                  {formatDate(selectedAdvance.advanceDate)}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Nguồn tiền
                </p>
                <p className="text-base font-medium text-slate-900 dark:text-white">
                  {selectedAdvance.paymentMethod === "cash"
                    ? "💵 Tiền mặt"
                    : "🏦 Chuyển khoản"}
                </p>
              </div>

              {selectedAdvance.reason && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                    Lý do
                  </p>
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3">
                    <p className="text-slate-900 dark:text-white">
                      {selectedAdvance.reason}
                    </p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      Số tiền ứng
                    </p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(selectedAdvance.advanceAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      Đã trả
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(selectedAdvance.paidAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                      Còn lại
                    </p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(selectedAdvance.remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedAdvance.isInstallment && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    📅 Trả góp hàng tháng
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Số tháng
                      </p>
                      <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                        {selectedAdvance.installmentMonths} tháng
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Trừ hàng tháng
                      </p>
                      <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                        {formatCurrency(selectedAdvance.monthlyDeduction || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedAdvance.approvedBy && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Người duyệt
                  </p>
                  <p className="text-base font-medium text-slate-900 dark:text-white">
                    {selectedAdvance.approvedBy} -{" "}
                    {formatDate(selectedAdvance.approvedDate || "")}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedAdvance(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
