import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  UserCheck,
  DollarSign,
  ClipboardList,
  Clock,
  History,
  Search,
  Plus,
  Pencil,
  Save,
  X,
  Trash2,
  Phone,
  Mail,
  Wallet,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { Employee, AttendanceRecord } from "../../types";
import { formatCurrency, formatDate } from "../../utils/format";
import PayrollManager from "../payroll/PayrollManager";
import EmployeeAdvanceManager from "./EmployeeAdvanceManager";
import { showToast } from "../../utils/toast";
import {
  useEmployeesRepo,
  useCreateEmployeeRepo,
  useUpdateEmployeeRepo,
  useDeleteEmployeeRepo,
} from "../../hooks/useEmployeesRepository";

type Tab = "list" | "attendance" | "payroll" | "advance" | "history";

const EmployeeManager: React.FC = () => {
  const { employees: contextEmployees, setEmployees } = useAppContext();

  // Fetch employees from Supabase
  const { data: fetchedEmployees, isLoading } = useEmployeesRepo();
  const { mutateAsync: createEmployeeAsync } = useCreateEmployeeRepo();
  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployeeRepo();
  const { mutateAsync: deleteEmployeeAsync } = useDeleteEmployeeRepo();

  // Use fetched employees or context as fallback
  const employees = fetchedEmployees || contextEmployees;

  // Sync to context
  useEffect(() => {
    if (fetchedEmployees) {
      setEmployees(fetchedEmployees);
    }
  }, [fetchedEmployees, setEmployees]);
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "",
    phone: "",
    email: "",
    position: "",
    department: "",
    baseSalary: 0,
    allowances: 0,
    status: "active",
    startDate: new Date().toISOString().split("T")[0],
  });

  // Filter employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.position || !formData.baseSalary) {
      showToast.error("Vui lòng điền đầy đủ thông tin bắt buộc!");
      return;
    }

    try {
      if (editingEmployee) {
        await updateEmployeeAsync({
          id: editingEmployee.id,
          updates: formData,
        });
      } else {
        await createEmployeeAsync(
          formData as Omit<Employee, "id" | "created_at" | "updated_at">
        );
      }
      resetForm();
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      position: "",
      department: "",
      baseSalary: 0,
      allowances: 0,
      status: "active",
      startDate: new Date().toISOString().split("T")[0],
    });
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData(emp);
    setShowForm(true);
  };

  const handleDelete = async (emp: Employee) => {
    if (confirm(`Bạn có chắc muốn xóa nhân viên "${emp.name}" không?`)) {
      try {
        await deleteEmployeeAsync(emp.id);
      } catch (error) {
        // Error already handled by mutation
      }
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const totalSalary = employees
      .filter((e) => e.status === "active")
      .reduce((sum, e) => sum + e.baseSalary + (e.allowances || 0), 0);

    return { active, totalSalary, total: employees.length };
  }, [employees]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Quản lý nhân viên
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Thêm nhân viên
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-xs font-medium">
              Tổng nhân viên
            </span>
            <Users className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-white/70 text-xs mt-1">
            {stats.active} đang làm việc
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-xs font-medium">
              Đang hoạt động
            </span>
            <UserCheck className="w-6 h-6" />
          </div>
          <div className="text-2xl font-bold">{stats.active}</div>
          <div className="text-white/70 text-xs mt-1">Nhân viên active</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/80 text-xs font-medium">
              Tổng lương tháng
            </span>
            <DollarSign className="w-6 h-6" />
          </div>
          <div className="text-xl font-bold">
            {formatCurrency(stats.totalSalary)}
          </div>
          <div className="text-white/70 text-xs mt-1">Ước tính</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {[
          {
            key: "list",
            label: "Danh sách",
            icon: <ClipboardList className="w-3.5 h-3.5" />,
          },
          {
            key: "attendance",
            label: "Chấm công",
            icon: <Clock className="w-3.5 h-3.5" />,
          },
          {
            key: "payroll",
            label: "Quản lý lương",
            icon: <DollarSign className="w-3.5 h-3.5" />,
          },
          {
            key: "advance",
            label: "Ứng lương",
            icon: <Wallet className="w-3.5 h-3.5" />,
          },
          {
            key: "history",
            label: "Lịch sử",
            icon: <History className="w-3.5 h-3.5" />,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span className="inline-flex items-center gap-1">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === "list" && (
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Tìm kiếm nhân viên (tên, SĐT, chức vụ)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Content */}
      {activeTab === "list" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Nhân viên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Chức vụ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Phòng ban
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Lương CB
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Phụ cấp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Ngày vào
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      Không tìm thấy nhân viên nào
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {emp.name}
                          </div>
                          {emp.phone && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {emp.phone}
                              </span>
                            </div>
                          )}
                          {emp.email && (
                            <div className="text-sm text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {emp.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {emp.position}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {emp.department || "-"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {formatCurrency(emp.baseSalary)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {formatCurrency(emp.allowances || 0)}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {formatDate(emp.startDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            emp.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400/80"
                              : emp.status === "inactive"
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400/80"
                              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400/80"
                          }`}
                        >
                          {emp.status === "active"
                            ? "Hoạt động"
                            : emp.status === "inactive"
                            ? "Tạm nghỉ"
                            : "Nghỉ việc"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          onClick={() => handleEdit(emp)}
                          className="inline-flex items-center gap-1 text-blue-600/80 dark:text-blue-400/70 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors"
                        >
                          <Pencil className="w-4 h-4" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="inline-flex items-center gap-1 text-red-600/80 dark:text-red-400/70 hover:text-red-700 dark:hover:text-red-300 font-medium text-sm transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "attendance" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Clock className="w-16 h-16 mb-4 text-slate-400" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Chức năng chấm công
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Tính năng quản lý chấm công đang được phát triển...
          </p>
        </div>
      )}

      {activeTab === "payroll" && <PayrollManager />}

      {activeTab === "advance" && <EmployeeAdvanceManager />}

      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <History className="w-16 h-16 mb-4 text-slate-400" />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Lịch sử làm việc
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Tính năng xem lịch sử làm việc đang được phát triển...
          </p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingEmployee ? (
                  <span className="inline-flex items-center gap-2">
                    <Pencil className="w-5 h-5" /> Sửa nhân viên
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Plus className="w-5 h-5" /> Thêm nhân viên mới
                  </span>
                )}
              </h3>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-2xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Chức vụ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phòng ban
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Lương cơ bản <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        baseSalary: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phụ cấp
                  </label>
                  <input
                    type="number"
                    value={formData.allowances}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowances: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ngày vào làm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm nghỉ</option>
                    <option value="terminated">Nghỉ việc</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Số tài khoản
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) =>
                      setFormData({ ...formData, bankAccount: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ngân hàng
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mã số thuế
                  </label>
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(e) =>
                      setFormData({ ...formData, taxCode: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium shadow-md hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all inline-flex items-center justify-center gap-2"
                >
                  {editingEmployee ? (
                    <>
                      <Save className="w-5 h-5" /> Lưu thay đổi
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" /> Thêm nhân viên
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors inline-flex items-center gap-2"
                >
                  <X className="w-5 h-5" /> Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManager;
