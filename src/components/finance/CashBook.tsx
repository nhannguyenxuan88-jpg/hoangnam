import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import type { CashTransaction } from "../../types";
import { PlusIcon } from "../Icons";
import {
  useCashTxRepo,
  useCreateCashTxRepo,
  useUpdateCashTxRepo,
  useDeleteCashTxRepo,
} from "../../hooks/useCashTransactionsRepository";
import { useUpdatePaymentSourceBalanceRepo } from "../../hooks/usePaymentSourcesRepository";

const CashBook: React.FC = () => {
  const {
    paymentSources,
    currentBranchId,
    setCashTransactions,
    setPaymentSources,
  } = useAppContext();

  // Fetch cash transactions from database instead of localStorage
  const { data: cashTransactions = [], isLoading: isCashTxLoading } =
    useCashTxRepo({ branchId: currentBranchId });
  const authCtx = useAuth();
  const createCashTxRepo = useCreateCashTxRepo();
  const updateCashTxRepo = useUpdateCashTxRepo();
  const deleteCashTxRepo = useDeleteCashTxRepo();
  const updatePaymentSourceBalanceRepo = useUpdatePaymentSourceBalanceRepo();
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">(
    "all"
  );
  const [filterPaymentSource, setFilterPaymentSource] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<
    "today" | "week" | "month" | "all"
  >("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<CashTransaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] =
    useState<CashTransaction | null>(null);

  // State cho modal cài đặt số dư ban đầu
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false);
  const [initialCashBalance, setInitialCashBalance] = useState("");
  const [initialBankBalance, setInitialBankBalance] = useState("");

  // Lấy số dư ban đầu từ paymentSources (đã lưu trong DB)
  const savedInitialCash =
    paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
    0;
  const savedInitialBank =
    paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
    0;

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

  // Helper to check if transaction is income type (including "deposit" for backwards compatibility)
  const isIncomeType = (type: string | undefined) =>
    type === "income" || type === "deposit";

  // Calculate summary
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => isIncomeType(tx.type))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const expense = filteredTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const balance = income - expense;

    // Tính số dư thực tế từ TẤT CẢ giao dịch (không filter theo thời gian)
    // để hiển thị đúng số dư hiện tại của quỹ
    const allBranchTransactions = cashTransactions.filter(
      (tx) => tx.branchId === currentBranchId
    );

    // Tính biến động tiền mặt từ transactions
    const cashTransactionsDelta = allBranchTransactions
      .filter((tx) => tx.paymentSourceId === "cash")
      .reduce((sum, tx) => {
        if (isIncomeType(tx.type)) {
          return sum + Math.abs(tx.amount);
        } else {
          return sum - Math.abs(tx.amount);
        }
      }, 0);

    // Tính biến động ngân hàng từ transactions
    const bankTransactionsDelta = allBranchTransactions
      .filter((tx) => tx.paymentSourceId === "bank")
      .reduce((sum, tx) => {
        if (isIncomeType(tx.type)) {
          return sum + Math.abs(tx.amount);
        } else {
          return sum - Math.abs(tx.amount);
        }
      }, 0);

    // Số dư hiện tại = Số dư ban đầu + Biến động từ giao dịch
    const cashBalance = savedInitialCash + cashTransactionsDelta;
    const bankBalance = savedInitialBank + bankTransactionsDelta;

    return {
      income,
      expense: -expense, // Display as negative for expense
      balance,
      cashBalance,
      bankBalance,
      totalBalance: cashBalance + bankBalance,
    };
  }, [
    filteredTransactions,
    cashTransactions,
    currentBranchId,
    savedInitialCash,
    savedInitialBank,
  ]);

  // Hàm lưu số dư ban đầu
  const handleSaveInitialBalance = async () => {
    try {
      const cashAmount =
        parseFloat(initialCashBalance.replace(/[,.]/g, "")) || 0;
      const bankAmount =
        parseFloat(initialBankBalance.replace(/[,.]/g, "")) || 0;

      // Cập nhật số dư tiền mặt
      await updatePaymentSourceBalanceRepo.mutateAsync({
        id: "cash",
        branchId: currentBranchId,
        delta: cashAmount - savedInitialCash, // Delta để đạt được số dư mới
      });

      // Cập nhật số dư ngân hàng
      await updatePaymentSourceBalanceRepo.mutateAsync({
        id: "bank",
        branchId: currentBranchId,
        delta: bankAmount - savedInitialBank,
      });

      // Cập nhật local state
      setPaymentSources((prev) =>
        prev.map((ps) => {
          if (ps.id === "cash") {
            return {
              ...ps,
              balance: { ...ps.balance, [currentBranchId]: cashAmount },
            };
          }
          if (ps.id === "bank") {
            return {
              ...ps,
              balance: { ...ps.balance, [currentBranchId]: bankAmount },
            };
          }
          return ps;
        })
      );

      showToast.success("Đã cập nhật số dư ban đầu");
      setShowInitialBalanceModal(false);
    } catch (error) {
      showToast.error("Lỗi khi cập nhật số dư");
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Sổ quỹ
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi thu chi tiền mặt và chuyển khoản
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInitialCashBalance(savedInitialCash.toString());
                setInitialBankBalance(savedInitialBank.toString());
                setShowInitialBalanceModal(true);
              }}
              className="flex items-center gap-2 px-3 py-2.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-lg font-medium transition-colors"
              title="Cài đặt số dư ban đầu"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="hidden md:inline">Số dư ban đầu</span>
            </button>
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
      </div>

      {/* Modal cài đặt số dư ban đầu */}
      {showInitialBalanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Cài đặt số dư ban đầu
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nhập số dư thực tế khi bắt đầu sử dụng hệ thống
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  💵 Tiền mặt
                </label>
                <input
                  type="text"
                  value={initialCashBalance}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    setInitialCashBalance(value);
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Hiển thị:{" "}
                  {formatCurrency(parseFloat(initialCashBalance) || 0)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  🏦 Ngân hàng
                </label>
                <input
                  type="text"
                  value={initialBankBalance}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, "");
                    setInitialBankBalance(value);
                  }}
                  placeholder="0"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Hiển thị:{" "}
                  {formatCurrency(parseFloat(initialBankBalance) || 0)}
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Số dư ban đầu là số tiền thực tế bạn có{" "}
                  <strong>trước khi</strong> bắt đầu ghi chép. Các giao dịch sau
                  sẽ được cộng/trừ từ số này.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => setShowInitialBalanceModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveInitialBalance}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Lưu số dư
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="p-3 md:p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium mb-1">
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
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
              <span>Thu</span>
            </div>
            <div className="text-green-900 dark:text-green-100 text-xl font-bold">
              {formatCurrency(summary.income)}
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-medium mb-1">
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
                  d="M17 13l-5 5m0 0l-5-5m5 5V6"
                />
              </svg>
              <span>Chi</span>
            </div>
            <div className="text-red-900 dark:text-red-100 text-xl font-bold">
              {formatCurrency(summary.expense)}
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border-2 border-blue-200 dark:border-blue-800">
            <div className="text-blue-600 dark:text-blue-400 text-xs font-medium mb-1">
              Chênh lệch
            </div>
            <div
              className={`text-xl font-bold ${
                summary.balance >= 0
                  ? "text-blue-900 dark:text-blue-100"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(summary.balance)}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border-2 border-amber-200 dark:border-amber-800">
            <div className="text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">
              Tiền mặt
            </div>
            <div className="text-amber-900 dark:text-amber-100 text-xl font-bold">
              {formatCurrency(summary.cashBalance)}
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border-2 border-purple-200 dark:border-purple-800">
            <div className="text-purple-600 dark:text-purple-400 text-xs font-medium mb-1">
              Ngân hàng
            </div>
            <div className="text-purple-900 dark:text-purple-100 text-xl font-bold">
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filterType === option.value
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filterDateRange === option.value
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
          {isCashTxLoading ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Đang tải dữ liệu...
            </div>
          ) : filteredTransactions.length === 0 ? (
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
                  <div className="flex items-center gap-2">
                    <div
                      className={`font-bold ${
                        isIncomeType(tx.type)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncomeType(tx.type) ? "+" : "-"}
                      {formatCurrency(Math.abs(tx.amount))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[50%]">
                    {tx.notes || "--"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {(() => {
                        const source =
                          tx.paymentSourceId ||
                          (tx as any).paymentsource ||
                          (tx as any).paymentSource;
                        if (source === "cash") return "Tiền mặt";
                        if (source === "bank") return "Ngân hàng";
                        return source || "--";
                      })()}
                    </span>
                    <button
                      onClick={() => setEditingTransaction(tx)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
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
                      onClick={() => setDeletingTransaction(tx)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
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
              {isCashTxLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
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
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          isIncomeType(tx.type)
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {isIncomeType(tx.type) ? "↑ Thu" : "↓ Chi"}
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
                      {(() => {
                        const source =
                          tx.paymentSourceId ||
                          (tx as any).paymentsource ||
                          (tx as any).paymentSource;
                        if (source === "cash") return "Tiền mặt";
                        if (source === "bank") return "Ngân hàng";
                        return source || "--";
                      })()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-sm font-semibold ${
                        isIncomeType(tx.type)
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncomeType(tx.type) ? "+" : "-"}
                      {formatCurrency(Math.abs(tx.amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingTransaction(tx)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
                          onClick={() => setDeletingTransaction(tx)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={async (updatedData) => {
            try {
              const res = await updateCashTxRepo.mutateAsync({
                id: editingTransaction.id,
                ...updatedData,
              });
              if (res?.ok) {
                showToast.success("Đã cập nhật giao dịch");
                setEditingTransaction(null);
              } else if (res?.error) {
                showToast.error(res.error.message || "Cập nhật thất bại");
              }
            } catch (e: any) {
              showToast.error(e?.message || "Lỗi không xác định");
            }
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <DeleteConfirmModal
          transaction={deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          onConfirm={async () => {
            try {
              const res = await deleteCashTxRepo.mutateAsync(
                deletingTransaction.id
              );
              if (res?.ok) {
                showToast.success("Đã xóa giao dịch");
                setDeletingTransaction(null);
              } else if (res?.error) {
                showToast.error(res.error.message || "Xóa thất bại");
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
    outsourcing: "Gia công ngoài",
    service_deposit: "Đặt cọc dịch vụ",
    general_income: "Thu chung",
    general_expense: "Chi chung",
  };
  return category ? labels[category] || category : "--";
};

// Add Transaction Modal Component
const AddTransactionModal: React.FC<{
  onClose: () => void;
  onSave: (transaction: any) => void;
}> = ({ onClose, onSave }) => {
  const [type, setType] = useState<"income" | "expense">("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paymentSource, setPaymentSource] = useState("cash");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/\./g, "")) || 0;
    if (numAmount <= 0) {
      return;
    }
    onSave({
      type,
      amount: numAmount,
      category,
      paymentSourceId: paymentSource,
      recipient,
      notes,
      date: new Date(date).toISOString(),
    });
  };

  const incomeCategories = [
    { value: "sale_income", label: "💰 Tiền bán hàng", icon: "💰" },
    { value: "service_income", label: "🔧 Tiền dịch vụ", icon: "🔧" },
    { value: "other_income", label: "📥 Thu nhập khác", icon: "📥" },
  ];

  const expenseCategories = [
    { value: "inventory_purchase", label: "📦 Mua hàng", icon: "📦" },
    { value: "salary", label: "👥 Lương nhân viên", icon: "👥" },
    { value: "rent", label: "🏠 Tiền thuê mặt bằng", icon: "🏠" },
    { value: "utilities", label: "💡 Điện nước", icon: "💡" },
    { value: "sale_refund", label: "↩️ Hoàn trả khách", icon: "↩️" },
    { value: "other_expense", label: "📤 Chi phí khác", icon: "📤" },
  ];

  const categories = type === "income" ? incomeCategories : expenseCategories;

  // Format number with dots
  const formatNumber = (value: string) => {
    const num = value.replace(/\D/g, "");
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header with gradient */}
        <div className={`px-5 py-4 ${type === "income" ? "bg-gradient-to-r from-emerald-500 to-green-600" : "bg-gradient-to-r from-rose-500 to-red-600"}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              {type === "income" ? "📥 Thu tiền" : "📤 Chi tiền"}
            </h2>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setType("income"); setCategory(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === "income"
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              📥 Thu tiền
            </button>
            <button
              type="button"
              onClick={() => { setType("expense"); setCategory(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === "expense"
                  ? "bg-rose-500 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              📤 Chi tiền
            </button>
          </div>

          {/* Amount - Big Input */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              Số tiền
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(formatNumber(e.target.value))}
                placeholder="0"
                className={`w-full px-4 py-3 text-2xl font-bold bg-slate-50 dark:bg-slate-700/50 border-2 rounded-xl text-right pr-12 transition-colors ${
                  type === "income" 
                    ? "border-emerald-200 dark:border-emerald-800 focus:border-emerald-500 text-emerald-600 dark:text-emerald-400" 
                    : "border-rose-200 dark:border-rose-800 focus:border-rose-500 text-rose-600 dark:text-rose-400"
                } focus:outline-none`}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-slate-400">đ</span>
            </div>
          </div>

          {/* Category Grid */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Danh mục
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    category === cat.value
                      ? type === "income"
                        ? "bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500 text-rose-700 dark:text-rose-300"
                      : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="text-xl mb-1">{cat.icon}</div>
                  <div className="text-xs font-medium leading-tight">{cat.label.replace(/^\S+\s/, "")}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Source Toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Nguồn tiền
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentSource("cash")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  paymentSource === "cash"
                    ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 text-amber-700 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                💵 Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentSource("bank")}
                className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  paymentSource === "bank"
                    ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-700 dark:text-blue-300"
                    : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                🏦 Ngân hàng
              </button>
            </div>
          </div>

          {/* Recipient & Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Đối tượng
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={type === "income" ? "Ai trả?" : "Trả cho ai?"}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                Ngày
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
              Ghi chú
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Thêm ghi chú..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all shadow-lg hover:shadow-xl active:scale-[0.98] ${
              type === "income"
                ? "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                : "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700"
            }`}
          >
            {type === "income" ? "✓ Xác nhận thu tiền" : "✓ Xác nhận chi tiền"}
          </button>
        </form>
      </div>
    </div>
  );
};

// Edit Transaction Modal Component
const EditTransactionModal: React.FC<{
  transaction: CashTransaction;
  onClose: () => void;
  onSave: (updatedData: any) => void;
}> = ({ transaction, onClose, onSave }) => {
  const [type, setType] = useState<"income" | "expense">(
    transaction.type === "income" || transaction.type === "deposit"
      ? "income"
      : "expense"
  );
  const [amount, setAmount] = useState(String(Math.abs(transaction.amount)));
  const [category, setCategory] = useState(transaction.category || "");
  const [paymentSource, setPaymentSource] = useState(
    transaction.paymentSourceId || (transaction as any).paymentsource || "cash"
  );
  const [recipient, setRecipient] = useState(
    (transaction as any).recipient || ""
  );
  const [notes, setNotes] = useState(
    transaction.notes || (transaction as any).description || ""
  );
  const [date, setDate] = useState(
    transaction.date
      ? new Date(transaction.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );

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
    { value: "service_deposit", label: "Đặt cọc dịch vụ" },
    { value: "debt_collection", label: "Thu nợ khách hàng" },
    { value: "other_income", label: "Thu nhập khác" },
    { value: "general_income", label: "Thu chung" },
  ];

  const expenseCategories = [
    { value: "inventory_purchase", label: "Mua hàng" },
    { value: "salary", label: "Lương nhân viên" },
    { value: "rent", label: "Tiền thuê mặt bằng" },
    { value: "utilities", label: "Điện nước" },
    { value: "outsourcing", label: "Gia công ngoài" },
    { value: "loan_payment", label: "Trả nợ vay" },
    { value: "debt_payment", label: "Trả nợ nhà cung cấp" },
    { value: "sale_refund", label: "Hoàn trả khách hàng" },
    { value: "other_expense", label: "Chi phí khác" },
    { value: "general_expense", label: "Chi chung" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Chỉnh sửa giao dịch
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
              Cập nhật
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Delete Confirmation Modal Component
const DeleteConfirmModal: React.FC<{
  transaction: CashTransaction;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ transaction, onClose, onConfirm }) => {
  const isIncome =
    transaction.type === "income" || transaction.type === "deposit";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-center mb-2">
            Xác nhận xóa giao dịch
          </h3>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Loại:
              </span>
              <span
                className={`text-sm font-medium ${
                  isIncome ? "text-green-600" : "text-red-600"
                }`}
              >
                {isIncome ? "Thu" : "Chi"}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Số tiền:
              </span>
              <span
                className={`text-sm font-bold ${
                  isIncome ? "text-green-600" : "text-red-600"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(Math.abs(transaction.amount))}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Ngày:
              </span>
              <span className="text-sm text-slate-900 dark:text-white">
                {formatDate(new Date(transaction.date))}
              </span>
            </div>
            {transaction.notes && (
              <div className="flex justify-between items-start">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Nội dung:
                </span>
                <span className="text-sm text-slate-900 dark:text-white text-right max-w-[60%]">
                  {transaction.notes}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
            Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa giao
            dịch này?
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashBook;
