import React, { useState, useEffect } from "react";
import { formatCurrency, formatDate } from "../../utils/format";
import type { CashTransaction } from "../../types";

// Helper function for category labels
export const getCategoryLabel = (category?: string) => {
    const labels: Record<string, string> = {
        sale_income: "Bán hàng",
        service_income: "Dịch vụ",
        other_income: "Thu khác",
        inventory_purchase: "Mua hàng",
        salary: "Lương nhân viên",
        employee_advance: "Ứng lương",
        loan_payment: "Trả nợ vay",
        debt_collection: "Thu nợ khách hàng",
        debt_payment: "Trả nợ nhà cung cấp",
        sale_refund: "Hoàn trả",
        other_expense: "Chi khác",
        outsourcing: "Gia công ngoài",
        service_deposit: "Đặt cọc dịch vụ",
        general_income: "Thu chung",
        general_expense: "Chi chung",
        supplier_payment: "Chi trả NCC",
        utilities: "Điện nước",
        rent: "Tiền thuê mặt bằng",
        service_cost: "Giá vốn dịch vụ",
    };
    return category ? labels[category] || category : "--";
};

// Add Transaction Modal Component
export const AddTransactionModal: React.FC<{
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

    // Hide bottom navigation when modal is open
    useEffect(() => {
        document.body.classList.add("hide-bottom-nav");
        return () => {
            document.body.classList.remove("hide-bottom-nav");
        };
    }, []);

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] sm:max-h-[85vh] flex flex-col mb-16 sm:mb-0">
                {/* Header with gradient */}
                <div
                    className={`px-4 py-3 flex-shrink-0 ${type === "income"
                        ? "bg-gradient-to-r from-emerald-500 to-green-600"
                        : "bg-gradient-to-r from-rose-500 to-red-600"
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            {type === "income" ? "📥 Thu tiền" : "📤 Chi tiền"}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors p-1"
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
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <form
                    id="cashTxForm"
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0"
                >
                    {/* Type Toggle */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setType("income");
                                setCategory("");
                            }}
                            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${type === "income"
                                ? "bg-emerald-500 text-white shadow-md"
                                : "text-slate-600 dark:text-slate-300"
                                }`}
                        >
                            📥 Thu tiền
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setType("expense");
                                setCategory("");
                            }}
                            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${type === "expense"
                                ? "bg-rose-500 text-white shadow-md"
                                : "text-slate-600 dark:text-slate-300"
                                }`}
                        >
                            📤 Chi tiền
                        </button>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 uppercase">
                            Số tiền
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={amount}
                                onChange={(e) => setAmount(formatNumber(e.target.value))}
                                placeholder="0"
                                className={`w-full px-3 py-2 text-lg font-bold bg-slate-50 dark:bg-slate-700/50 border-2 rounded-lg text-right pr-8 ${type === "income"
                                    ? "border-emerald-200 dark:border-emerald-800 focus:border-emerald-500 text-emerald-600 dark:text-emerald-400"
                                    : "border-rose-200 dark:border-rose-800 focus:border-rose-500 text-rose-600 dark:text-rose-400"
                                    } focus:outline-none`}
                                required
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                                đ
                            </span>
                        </div>
                    </div>

                    {/* Category Grid - Compact */}
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase">
                            Danh mục
                        </label>
                        <div className="grid grid-cols-3 gap-1">
                            {categories.map((cat) => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    className={`p-1.5 rounded-lg text-center transition-all ${category === cat.value
                                        ? type === "income"
                                            ? "bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-300"
                                            : "bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-500 text-rose-700 dark:text-rose-300"
                                        : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent text-slate-700 dark:text-slate-300"
                                        }`}
                                >
                                    <div className="text-base leading-none">{cat.icon}</div>
                                    <div className="text-[8px] font-medium leading-tight mt-0.5">
                                        {cat.label.replace(/^\S+\s/, "")}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payment Source Toggle - Compact */}
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase">
                            Nguồn tiền
                        </label>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPaymentSource("cash")}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${paymentSource === "cash"
                                    ? "bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500 text-amber-700 dark:text-amber-300"
                                    : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent text-slate-600 dark:text-slate-400"
                                    }`}
                            >
                                💵 Tiền mặt
                            </button>
                            <button
                                type="button"
                                onClick={() => setPaymentSource("bank")}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 ${paymentSource === "bank"
                                    ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-700 dark:text-blue-300"
                                    : "bg-slate-50 dark:bg-slate-700/50 border-2 border-transparent text-slate-600 dark:text-slate-400"
                                    }`}
                            >
                                🏦 Ngân hàng
                            </button>
                        </div>
                    </div>

                    {/* Recipient & Date Row - Compact */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 uppercase">
                                Đối tượng
                            </label>
                            <input
                                type="text"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder={type === "income" ? "Ai trả?" : "Trả cho ai?"}
                                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 uppercase">
                                Ngày
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Notes - Compact */}
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 uppercase">
                            Nội dung
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            placeholder="Nội dung giao dịch..."
                        />
                    </div>
                </form>

                {/* Submit Button - Fixed at bottom with safe area */}
                <div
                    className="flex-shrink-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-10"
                    style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
                >
                    <button
                        type="submit"
                        form="cashTxForm"
                        className={`w-full py-3.5 rounded-xl font-bold text-white text-base shadow-xl active:scale-95 transition-all ${type === "income"
                            ? "bg-gradient-to-r from-emerald-500 to-green-600"
                            : "bg-gradient-to-r from-rose-500 to-red-600"
                            }`}
                    >
                        {type === "income" ? "✓ Xác nhận thu tiền" : "✓ Xác nhận chi tiền"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Edit Transaction Modal Component
export const EditTransactionModal: React.FC<{
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

    // Hide bottom navigation when modal is open
    useEffect(() => {
        document.body.classList.add("hide-bottom-nav");
        return () => {
            document.body.classList.remove("hide-bottom-nav");
        };
    }, []);

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base sm:text-xl font-semibold text-slate-900 dark:text-white">
                            Chỉnh sửa giao dịch
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4"
                >
                    {/* Type Selection */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                                <span className="text-sm text-slate-900 dark:text-white">
                                    Thu tiền
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="expense"
                                    checked={type === "expense"}
                                    onChange={(e) => setType(e.target.value as "expense")}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-slate-900 dark:text-white">
                                    Chi tiền
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Số tiền
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white"
                            required
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Danh mục
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white"
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
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Đối tượng
                        </label>
                        <input
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            placeholder={
                                type === "income" ? "Thu tiền từ ai?" : "Chi tiền cho ai?"
                            }
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Payment Source */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                                <span className="text-sm text-slate-900 dark:text-white">
                                    Tiền mặt
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="bank"
                                    checked={paymentSource === "bank"}
                                    onChange={(e) => setPaymentSource(e.target.value)}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-slate-900 dark:text-white">
                                    Ngân hàng
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Ngày giao dịch
                        </label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white"
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Nội dung
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm sm:text-base text-slate-900 dark:text-white resize-none"
                            placeholder="Ghi chú về giao dịch..."
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 sm:gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm sm:text-base font-medium transition-colors"
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
export const DeleteConfirmModal: React.FC<{
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
                                className={`text-sm font-medium ${isIncome ? "text-green-600" : "text-red-600"
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
                                className={`text-sm font-bold ${isIncome ? "text-green-600" : "text-red-600"
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
