import React, { useState, useMemo, useEffect } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import type { CashTransaction } from "../../types";
import {
    useCashTxRepo,
    useCreateCashTxRepo,
    useUpdateCashTxRepo,
    useDeleteCashTxRepo,
} from "../../hooks/useCashTransactionsRepository";
import { useUpdatePaymentSourceBalanceRepo } from "../../hooks/usePaymentSourcesRepository";
import { supabase } from "../../supabaseClient";
import { Plus, Search, Filter, Wallet, ArrowUpCircle, ArrowDownCircle, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { AddTransactionModal, EditTransactionModal, DeleteConfirmModal, getCategoryLabel } from "./CashBookModals";


export const CashBookMobile: React.FC = () => {
    const {
        paymentSources,
        currentBranchId,
        setCashTransactions,
        setPaymentSources,
    } = useAppContext();

    // Fetch cash transactions
    const { data: cashTransactions = [], isLoading: isCashTxLoading } =
        useCashTxRepo({ branchId: currentBranchId });
    const createCashTxRepo = useCreateCashTxRepo();
    const updateCashTxRepo = useUpdateCashTxRepo();
    const deleteCashTxRepo = useDeleteCashTxRepo();
    const updatePaymentSourceBalanceRepo = useUpdatePaymentSourceBalanceRepo();

    // Fetch profiles for user names
    const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchProfiles = async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("id, name");
            if (!error && data) {
                const map: Record<string, string> = {};
                data.forEach((profile: any) => {
                    map[profile.id] = profile.name;
                });
                setProfilesMap(map);
            }
        };
        fetchProfiles();
    }, []);

    const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
    const [filterPaymentSource, setFilterPaymentSource] = useState<string>("all");
    const [filterDateRange, setFilterDateRange] = useState<"today" | "week" | "month" | "all">("month");
    const [searchQuery, setSearchQuery] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
    const [deletingTransaction, setDeletingTransaction] = useState<CashTransaction | null>(null);

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

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (tx) =>
                    ((tx as any).description || "").toLowerCase().includes(query) ||
                    (tx.notes || "").toLowerCase().includes(query) ||
                    ((tx as any).reference || "").toLowerCase().includes(query) ||
                    ((tx as any).recipient || "").toLowerCase().includes(query) ||
                    getCategoryLabel(tx.category).toLowerCase().includes(query)
            );
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
        searchQuery,
    ]);

    // Helper to check if transaction is income type
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

        const allBranchTransactions = cashTransactions.filter(
            (tx) => tx.branchId === currentBranchId
        );

        const cashTransactionsDelta = allBranchTransactions
            .filter((tx) => tx.paymentSourceId === "cash")
            .reduce((sum, tx) => {
                if (isIncomeType(tx.type)) {
                    return sum + Math.abs(tx.amount);
                } else {
                    return sum - Math.abs(tx.amount);
                }
            }, 0);

        const bankTransactionsDelta = allBranchTransactions
            .filter((tx) => tx.paymentSourceId === "bank")
            .reduce((sum, tx) => {
                if (isIncomeType(tx.type)) {
                    return sum + Math.abs(tx.amount);
                } else {
                    return sum - Math.abs(tx.amount);
                }
            }, 0);

        const savedInitialCash =
            paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] || 0;
        const savedInitialBank =
            paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] || 0;

        const cashBalance = savedInitialCash + cashTransactionsDelta;
        const bankBalance = savedInitialBank + bankTransactionsDelta;

        return {
            income,
            expense: -expense,
            balance,
            cashBalance,
            bankBalance,
            totalBalance: cashBalance + bankBalance,
        };
    }, [
        filteredTransactions,
        cashTransactions,
        currentBranchId,
        paymentSources,
    ]);

    return (
        <div className="bg-[#151521] min-h-screen text-white pb-20">
            {/* Stats Cards - Horizontal Scroll */}
            <div className="px-4 py-4 overflow-x-auto no-scrollbar flex gap-3 snap-x">
                {/* Balance Card */}
                <div className="snap-center shrink-0 w-[85vw] bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Wallet className="w-24 h-24 text-white" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-blue-100 text-sm font-medium mb-1">Tổng số dư</p>
                        <h3 className="text-3xl font-bold text-white mb-4">
                            {formatCurrency(summary.totalBalance)}
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm">
                                <p className="text-blue-100 text-xs mb-1">Tiền mặt</p>
                                <p className="font-semibold text-white">{formatCurrency(summary.cashBalance)}</p>
                            </div>
                            <div className="bg-white/10 rounded-xl p-2 backdrop-blur-sm">
                                <p className="text-blue-100 text-xs mb-1">Ngân hàng</p>
                                <p className="font-semibold text-white">{formatCurrency(summary.bankBalance)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Income/Expense Summary */}
                <div className="snap-center shrink-0 w-[85vw] bg-[#1e1e2d] rounded-2xl p-4 border border-slate-800 shadow-lg">
                    <h4 className="text-slate-400 text-sm font-medium mb-3">Thu chi trong kỳ</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <ArrowUpCircle className="w-6 h-6 text-green-500" />
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs">Tổng thu</p>
                                    <p className="text-green-500 font-bold">{formatCurrency(summary.income)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="w-full h-[1px] bg-slate-800"></div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <ArrowDownCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs">Tổng chi</p>
                                    <p className="text-red-500 font-bold">{formatCurrency(summary.expense)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="px-4 mb-4">
                <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm giao dịch..."
                            className="w-full bg-[#1e1e2d] border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2.5 rounded-xl border ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#1e1e2d] border-slate-800 text-slate-400'}`}
                    >
                        <Filter className="w-5 h-5" />
                    </button>
                </div>

                {showFilters && (
                    <div className="bg-[#1e1e2d] rounded-xl p-4 border border-slate-800 space-y-4 animate-in slide-in-from-top-2">
                        <div>
                            <label className="text-xs text-slate-400 mb-2 block">Thời gian</label>
                            <div className="flex bg-[#151521] p-1 rounded-lg">
                                {['today', 'week', 'month', 'all'].map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setFilterDateRange(range as any)}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${filterDateRange === range ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                                    >
                                        {range === 'today' ? 'Hôm nay' : range === 'week' ? '7 ngày' : range === 'month' ? '30 ngày' : 'Tất cả'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">Loại</label>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="w-full bg-[#151521] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="all">Tất cả</option>
                                    <option value="income">Thu</option>
                                    <option value="expense">Chi</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-2 block">Nguồn tiền</label>
                                <select
                                    value={filterPaymentSource}
                                    onChange={(e) => setFilterPaymentSource(e.target.value)}
                                    className="w-full bg-[#151521] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="all">Tất cả</option>
                                    <option value="cash">Tiền mặt</option>
                                    <option value="bank">Ngân hàng</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Transactions List */}
            <div className="px-4 space-y-3">
                <h3 className="text-slate-400 text-sm font-medium">Giao dịch gần đây</h3>
                {isCashTxLoading ? (
                    <div className="text-center py-8 text-slate-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        Đang tải dữ liệu...
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="text-center py-12 bg-[#1e1e2d] rounded-2xl border border-slate-800">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Wallet className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-slate-400">Không có giao dịch nào</p>
                    </div>
                ) : (
                    filteredTransactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="bg-[#1e1e2d] p-4 rounded-xl border border-slate-800 active:scale-[0.98] transition-transform"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isIncomeType(tx.type) ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                        {isIncomeType(tx.type) ? (
                                            <ArrowUpCircle className="w-6 h-6 text-green-500" />
                                        ) : (
                                            <ArrowDownCircle className="w-6 h-6 text-red-500" />
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-white">{getCategoryLabel(tx.category)}</h4>
                                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(new Date(tx.date))}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${isIncomeType(tx.type) ? 'text-green-500' : 'text-red-500'}`}>
                                        {isIncomeType(tx.type) ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                                    </p>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 inline-block mt-1">
                                        {tx.paymentSourceId === 'bank' ? 'Ngân hàng' : 'Tiền mặt'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center">
                                <p className="text-sm text-slate-300 line-clamp-1 flex-1 mr-2">
                                    {(tx as any).recipient && <span className="font-medium text-blue-400 mr-1">{(tx as any).recipient}:</span>}
                                    {tx.notes || (tx as any).description || <span className="italic text-slate-500">Không có ghi chú</span>}
                                </p>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => setEditingTransaction(tx)}
                                        className="p-2 bg-slate-800 rounded-lg text-blue-400 hover:bg-slate-700 active:scale-95 transition-all"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDeletingTransaction(tx)}
                                        className="p-2 bg-slate-800 rounded-lg text-red-400 hover:bg-slate-700 active:scale-95 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {/* Floating Action Button */}
            <button
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-24 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white z-10 active:scale-90 transition-transform"
            >
                <Plus className="w-8 h-8" />
            </button>

            {/* Modals */}
            {showAddModal && (
                <AddTransactionModal
                    onClose={() => setShowAddModal(false)}
                    onSave={async (transaction) => {
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
                                setCashTransactions((prev) => [res.data as CashTransaction, ...prev]);
                                const delta = transaction.type === "income" ? transaction.amount : -transaction.amount;
                                await updatePaymentSourceBalanceRepo.mutateAsync({
                                    id: transaction.paymentSourceId,
                                    branchId: currentBranchId,
                                    delta,
                                });
                                setPaymentSources((prev) =>
                                    prev.map((ps) =>
                                        ps.id === transaction.paymentSourceId
                                            ? { ...ps, balance: { ...ps.balance, [currentBranchId]: (ps.balance[currentBranchId] || 0) + delta } }
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

            {deletingTransaction && (
                <DeleteConfirmModal
                    transaction={deletingTransaction}
                    onClose={() => setDeletingTransaction(null)}
                    onConfirm={async () => {
                        try {
                            const res = await deleteCashTxRepo.mutateAsync(deletingTransaction.id);
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
