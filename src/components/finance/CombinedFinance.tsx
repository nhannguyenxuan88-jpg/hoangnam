import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import {
  fetchPinCashTransactions,
  fetchPinBalanceSummary,
  PinCashTransaction,
} from "../../lib/pinSupabase";
import { formatCurrency, formatDate } from "../../utils/format";
import { Loader2, RefreshCw, Building2, Wrench, Filter } from "lucide-react";

type SourceFilter = "all" | "motocare" | "pin";

interface CombinedTransaction {
  id: string;
  type: "income" | "expense";
  category?: string;
  amount: number;
  date: string;
  description?: string;
  source: "motocare" | "pin";
}

const CombinedFinance: React.FC = () => {
  const { currentBranchId, paymentSources } = useAppContext();

  // Motocare data
  const { data: motocareTx = [], isLoading: motocareLoading } = useCashTxRepo({
    branchId: currentBranchId,
  });

  // Pin data
  const [pinTx, setPinTx] = useState<PinCashTransaction[]>([]);
  const [pinBalance, setPinBalance] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  });
  const [pinLoading, setPinLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "month" | "week" | "today"
  >("month");

  // Fetch Pin data
  const loadPinData = async () => {
    setPinLoading(true);
    try {
      const [transactions, balance] = await Promise.all([
        fetchPinCashTransactions(),
        fetchPinBalanceSummary(),
      ]);
      setPinTx(transactions);
      setPinBalance(balance);
    } catch (error) {
      console.error("Error loading Pin data:", error);
    }
    setPinLoading(false);
  };

  useEffect(() => {
    loadPinData();
  }, []);

  // Helper functions
  const isIncomeType = (type: string) =>
    type === "income" || type === "deposit";

  // Motocare balance calculation
  const motocareBalance = useMemo(() => {
    const savedInitialCash =
      paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
      0;
    const savedInitialBank =
      paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
      0;

    const branchTx = motocareTx.filter((tx) => tx.branchId === currentBranchId);

    const cashDelta = branchTx
      .filter((tx) => tx.paymentSourceId === "cash")
      .reduce((sum, tx) => {
        return isIncomeType(tx.type)
          ? sum + Math.abs(tx.amount)
          : sum - Math.abs(tx.amount);
      }, 0);

    const bankDelta = branchTx
      .filter((tx) => tx.paymentSourceId === "bank")
      .reduce((sum, tx) => {
        return isIncomeType(tx.type)
          ? sum + Math.abs(tx.amount)
          : sum - Math.abs(tx.amount);
      }, 0);

    return {
      cash: savedInitialCash + cashDelta,
      bank: savedInitialBank + bankDelta,
      total: savedInitialCash + cashDelta + savedInitialBank + bankDelta,
    };
  }, [motocareTx, currentBranchId, paymentSources]);

  // Combined transactions
  const combinedTransactions = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.setDate(now.getDate() - 7))
      .toISOString()
      .slice(0, 10);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toISOString().slice(0, 10);

    // Convert Motocare transactions
    const motocareCombined: CombinedTransaction[] = motocareTx
      .filter((tx) => tx.branchId === currentBranchId)
      .map((tx) => ({
        id: tx.id,
        type: tx.type as "income" | "expense",
        category: tx.category,
        amount: tx.amount,
        date: tx.date,
        description: tx.notes || tx.description,
        source: "motocare" as const,
      }));

    // Convert Pin transactions
    const pinCombined: CombinedTransaction[] = pinTx.map((tx) => ({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      date: tx.date,
      description: tx.description,
      source: "pin" as const,
    }));

    let combined = [...motocareCombined, ...pinCombined];

    // Filter by source
    if (sourceFilter !== "all") {
      combined = combined.filter((tx) => tx.source === sourceFilter);
    }

    // Filter by date
    if (dateFilter === "today") {
      combined = combined.filter((tx) => tx.date.slice(0, 10) === today);
    } else if (dateFilter === "week") {
      combined = combined.filter((tx) => tx.date.slice(0, 10) >= weekAgo);
    } else if (dateFilter === "month") {
      combined = combined.filter((tx) => tx.date.slice(0, 10) >= monthAgoStr);
    }

    // Sort by date descending
    return combined.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [motocareTx, pinTx, currentBranchId, sourceFilter, dateFilter]);

  // Total balance
  const totalBalance = motocareBalance.total + pinBalance.balance;

  const isLoading = motocareLoading || pinLoading;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">📊 Tổng hợp Tài chính</h1>
            <p className="text-sm opacity-80 mt-1">
              Kết hợp dữ liệu từ Motocare & Pin Factory
            </p>
          </div>
          <button
            onClick={loadPinData}
            disabled={isLoading}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <RefreshCw
              className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Total Balance */}
        <div className="mt-4 bg-white/10 backdrop-blur rounded-xl p-4">
          <p className="text-sm opacity-80">Tổng số dư tất cả nguồn</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {/* Motocare Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              Motocare
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(motocareBalance.total)}
          </p>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
            <p>💵 Tiền mặt: {formatCurrency(motocareBalance.cash)}</p>
            <p>🏦 Ngân hàng: {formatCurrency(motocareBalance.bank)}</p>
          </div>
        </div>

        {/* Pin Factory Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-2 border-amber-200 dark:border-amber-800 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              Pin Factory
            </span>
          </div>
          {pinLoading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang tải...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(pinBalance.balance)}
              </p>
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                <p>📈 Thu: {formatCurrency(pinBalance.totalIncome)}</p>
                <p>📉 Chi: {formatCurrency(pinBalance.totalExpense)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {/* Source Filter */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === "all"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setSourceFilter("motocare")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === "motocare"
                ? "bg-blue-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            🔧 Motocare
          </button>
          <button
            onClick={() => setSourceFilter("pin")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sourceFilter === "pin"
                ? "bg-amber-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            🏭 Pin
          </button>
        </div>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300"
        >
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày</option>
          <option value="month">30 ngày</option>
          <option value="all">Tất cả</option>
        </select>
      </div>

      {/* Transactions List */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Giao dịch ({combinedTransactions.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-slate-500 mt-2">Đang tải dữ liệu...</p>
            </div>
          ) : combinedTransactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Không có giao dịch nào
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {combinedTransactions.map((tx) => (
                <div
                  key={`${tx.source}-${tx.id}`}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  {/* Source Badge */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                      tx.source === "motocare"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                    }`}
                  >
                    {tx.source === "motocare" ? "🔧" : "🏭"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isIncomeType(tx.type)
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}
                      >
                        {isIncomeType(tx.type) ? "Thu" : "Chi"}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {tx.category || "--"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate mt-0.5">
                      {tx.description || "--"}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(tx.date)}
                    </p>
                  </div>

                  {/* Amount */}
                  <div
                    className={`text-right font-bold ${
                      isIncomeType(tx.type)
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isIncomeType(tx.type) ? "+" : "-"}
                    {formatCurrency(Math.abs(tx.amount))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CombinedFinance;
