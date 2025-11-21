import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import type { CashTransaction } from "../../types";
import { PlusIcon } from "../Icons";
import { useCreateCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { useUpdatePaymentSourceBalanceRepo } from "../../hooks/usePaymentSourcesRepository";

const CashBook: React.FC = () => {
  const {
    cashTransactions,
    paymentSources,
    currentBranchId,
    setCashTransactions,
    setPaymentSources,
  } = useAppContext();
  const authCtx = useAuth();
  const createCashTxRepo = useCreateCashTxRepo();
  const updatePaymentSourceBalanceRepo = useUpdatePaymentSourceBalanceRepo();
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">(
    "all"
  );
  const [filterPaymentSource, setFilterPaymentSource] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<
    "today" | "week" | "month" | "all"
  >("month");
  const [showAddModal, setShowAddModal] = useState(false);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = cashTransactions.filter(
      (tx) => tx.branchId === currentBranchId
    );

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((tx) => tx.type === filterType);
    }

    // Filter by payment source
    if (filterPaymentSource !== "all") {
      filtered = filtered.filter(
        (tx) => tx.paymentSourceId === filterPaymentSource
      );
    }

    // Filter by date range
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filterDateRange) {
      case "today":
        filtered = filtered.filter((tx) => new Date(tx.date) >= today);
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter((tx) => new Date(tx.date) >= weekAgo);
        break;
      case "month":
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = filtered.filter((tx) => new Date(tx.date) >= monthAgo);
        break;
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    cashTransactions,
    currentBranchId,
    filterType,
    filterPaymentSource,
    filterDateRange,
  ]);

  // Calculate summary
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const expense = filteredTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const balance = income - expense;

    // Current balances
    const cashBalance =
      paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
      0;
    const bankBalance =
      paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
      0;

    return {
      income,
      expense,
      balance,
      cashBalance,
      bankBalance,
      totalBalance: cashBalance + bankBalance,
    };
  }, [filteredTransactions, paymentSources, currentBranchId]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Sổ quỹ
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi thu chi tiền mặt và chuyển khoản
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Thêm giao dịch</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium mb-2">
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
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
              <span>Thu</span>
            </div>
            <div className="text-green-900 dark:text-green-100 text-2xl font-bold">
              {formatCurrency(summary.income)}
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium mb-2">
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
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
              <span>Chi</span>
            </div>
            <div className="text-red-900 dark:text-red-100 text-2xl font-bold">
              {formatCurrency(summary.expense)}
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
            <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">
              Chênh lệch
            </div>
            <div
              className={`text-2xl font-bold ${summary.balance >= 0
                  ? "text-blue-900 dark:text-blue-100"
                  : "text-red-600 dark:text-red-400"
                }`}
            >
              {formatCurrency(summary.balance)}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-2 border-amber-200 dark:border-amber-800">
            <div className="text-amber-600 dark:text-amber-400 text-sm font-medium mb-2">
              Tiền mặt
            </div>
            <div className="text-amber-900 dark:text-amber-100 text-2xl font-bold">
              {formatCurrency(summary.cashBalance)}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-800">
            <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-2">
              Ngân hàng
            </div>
            <div className="text-purple-900 dark:text-purple-100 text-2xl font-bold">
              {formatCurrency(summary.bankBalance)}
            </div>
          </div>
        </div>

        {/* Filters */}
        {/* Mobile Filters */}
        <div className="md:hidden space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                Loại
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
                Nguồn tiền
              </label>
              <select
                value={filterPaymentSource}
                onChange={(e) => setFilterPaymentSource(e.target.value)}
                className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Ngân hàng</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              Thời gian
            </label>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value as any)}
              className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            >
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
              <option value="all">Tất cả</option>
            </select>
          </div>
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Loại:
              </span>
              <div className="flex gap-2">
                {[
                  { value: "all", label: "Tất cả" },
                  { value: "income", label: "Thu" },
                  { value: "expense", label: "Chi" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterType(option.value as any)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === option.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nguồn tiền:
              </span>
              <select
                value={filterPaymentSource}
                onChange={(e) => setFilterPaymentSource(e.target.value)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white"
              >
                <option value="all">Tất cả</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Ngân hàng</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Thời gian:
              </span>
              <div className="flex gap-2">
                {[
                  { value: "today", label: "Hôm nay" },
                  { value: "week", label: "7 ngày" },
                  { value: "month", label: "30 ngày" },
                  { value: "all", label: "Tất cả" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterDateRange(option.value as any)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterDateRange === option.value
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions List (Mobile) */}
        <div className="md:hidden space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              Không có giao dịch nào
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {getCategoryLabel(tx.category)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatDate(new Date(tx.date))}
                    </div>
                  </div>
                  <div
                    className={`font-bold ${tx.type === "income"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                      }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[60%]">
                    {tx.notes || "--"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {tx.paymentSourceId === "cash" ? "Tiền mặt" : "Ngân hàng"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Transactions Table (Desktop) */}
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Ngày
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Loại
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Danh mục
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Đối tượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Nội dung
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Nguồn tiền
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Số tiền
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Không có giao dịch nào
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      {formatDate(new Date(tx.date))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tx.type === "income"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                      >
                        {tx.type === "income" ? "↑ Thu" : "↓ Chi"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {getCategoryLabel(tx.category)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-medium">
                      {(tx as any).recipient || "--"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {tx.notes || "--"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {tx.paymentSourceId === "cash" ? "Tiền mặt" : "Ngân hàng"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold ${tx.type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                        }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
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
                            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <AddTransactionModal
          onClose={() => setShowAddModal(false)}
          onSave={async (transaction) => {
            // Basic validation
            if (!transaction.amount || transaction.amount <= 0) {
              showToast.warning("Số tiền phải > 0");
              return;
            }
            try {
              const res = await createCashTxRepo.mutateAsync({
                type: transaction.type,
                amount: transaction.amount,
                branchId: currentBranchId,
                paymentSourceId: transaction.paymentSourceId,
                date: transaction.date,
                notes: transaction.notes,
                category: transaction.category,
                recipient: transaction.recipient,
              });
              if (res?.ok) {
                // Optimistically update local state for immediate UI feedback
                setCashTransactions((prev) => [
                  res.data as CashTransaction,
                  ...prev,
                ]);
                const delta =
                  transaction.type === "income"
                    ? transaction.amount
                    : -transaction.amount;
                await updatePaymentSourceBalanceRepo.mutateAsync({
                  id: transaction.paymentSourceId,
                  branchId: currentBranchId,
                  delta,
                });
                setPaymentSources((prev) =>
                  prev.map((ps) =>
                    ps.id === transaction.paymentSourceId
                      ? {
                        ...ps,
                        balance: {
                          ...ps.balance,
                          [currentBranchId]:
                            (ps.balance[currentBranchId] || 0) + delta,
                        },
                      }
                      : ps
                  )
                );
                showToast.success("Đã thêm giao dịch sổ quỹ");
                setShowAddModal(false);
              } else if (res?.error) {
                showToast.error(res.error.message || "Ghi giao dịch thất bại");
              }
            } catch (e: any) {
              showToast.error(e?.message || "Lỗi không xác định");
            }
          }}
        />
      )}
    </div>
  );
};

// Helper function for category labels
const getCategoryLabel = (category?: string) => {
  const labels: Record<string, string> = {
    sale_income: "Bán hàng",
    service_income: "Dịch vụ",
    other_income: "Thu khác",
    inventory_purchase: "Mua hàng",
    salary: "Lương nhân viên",
    loan_payment: "Trả nợ vay",
    debt_collection: "Thu nợ khách hàng",
    debt_payment: "Trả nợ nhà cung cấp",
    sale_refund: "Hoàn trả",
    other_expense: "Chi khác",
  };
  return category ? labels[category] || category : "--";
};

// Add Transaction Modal Component
const AddTransactionModal: React.FC<{
  onClose: () => void;
  onSave: (transaction: any) => void;
}> = ({ onClose, onSave }) => {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("0");
  const [category, setCategory] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      type,
      amount: parseFloat(amount),
      category,
      paymentSourceId: paymentSource,
      recipient,
      notes,
      date: new Date(date).toISOString(),
    });
  };

  const incomeCategories = [
    { value: "sale_income", label: "Tiền bán hàng" },
    { value: "service_income", label: "Tiền dịch vụ" },
    { value: "other_income", label: "Thu nhập khác" },
  ];

  const expenseCategories = [
    { value: "inventory_purchase", label: "Mua hàng" },
    { value: "salary", label: "Lương nhân viên" },
    { value: "rent", label: "Tiền thuê mặt bằng" },
    { value: "utilities", label: "Điện nước" },
    { value: "sale_refund", label: "Hoàn trả khách hàng" },
    { value: "other_expense", label: "Chi phí khác" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Thêm giao dịch
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loại giao dịch
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="income"
                  checked={type === "income"}
                  onChange={(e) => setType(e.target.value as "income")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">Thu tiền</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="expense"
                  checked={type === "expense"}
                  onChange={(e) => setType(e.target.value as "expense")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">Chi tiền</span>
              </label>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số tiền
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Danh mục
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            >
              <option value="">Chọn danh mục</option>
              {(type === "income" ? incomeCategories : expenseCategories).map(
                (cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Recipient/Payer */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Đối tượng
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={
                type === "income" ? "Thu tiền từ ai?" : "Chi tiền cho ai?"
              }
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          {/* Payment Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nguồn tiền
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="cash"
                  checked={paymentSource === "cash"}
                  onChange={(e) => setPaymentSource(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentSource === "bank"}
                  onChange={(e) => setPaymentSource(e.target.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">
                  Ngân hàng
                </span>
              </label>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ngày giao dịch
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nội dung
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              placeholder="Ghi chú về giao dịch..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Lưu giao dịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CashBook;
