import React from "react";
import { CreditCard, Banknote, Wallet, FileText } from "lucide-react";
import { NumberInput } from "../../common/NumberInput";
import { formatCurrency } from "../../../utils/format";

interface PaymentMethodSelectorProps {
    paymentMethod: "cash" | "bank" | "card" | null;
    paymentType: "full" | "partial" | "note" | "installment" | null;
    partialAmount: number;
    total: number;
    onPaymentMethodChange: (method: "cash" | "bank" | "card") => void;
    onPaymentTypeChange: (type: "full" | "partial" | "note" | "installment") => void;
    onPartialAmountChange: (amount: number) => void;
    onOpenInstallmentSetup?: () => void;
    installmentDetails?: any;
}

/**
 * Payment method and type selector component
 */
export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
    paymentMethod,
    paymentType,
    partialAmount,
    total,
    onPaymentMethodChange,
    onPaymentTypeChange,
    onPartialAmountChange,
    onOpenInstallmentSetup,
    installmentDetails
}) => {
    return (
        <div className="space-y-3">
            {/* Payment Method Selection - Compact Design */}
            <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => onPaymentMethodChange("cash")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all ${paymentMethod === "cash"
                            ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                    >
                        <Banknote className="w-5 h-5" />
                        <span className="font-medium text-[11px]">Tiền mặt</span>
                    </button>
                    <button
                        onClick={() => onPaymentMethodChange("bank")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all ${paymentMethod === "bank"
                            ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                    >
                        <CreditCard className="w-5 h-5" />
                        <span className="font-medium text-[11px]">Chuyển khoản</span>
                    </button>
                    <button
                        onClick={() => onPaymentMethodChange("card")}
                        className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border transition-all ${paymentMethod === "card"
                            ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="font-medium text-[11px]">Quẹt thẻ</span>
                    </button>
                </div>
            </div>

            {/* Payment Type Selection (if method selected) */}
            {paymentMethod && (
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Hình thức thanh toán
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => onPaymentTypeChange("full")}
                            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all ${paymentType === "full"
                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-400"
                                }`}
                        >
                            <Wallet className="w-4 h-4" />
                            <span className="font-medium text-[10px]">Toàn bộ</span>
                        </button>
                        <button
                            onClick={() => onPaymentTypeChange("partial")}
                            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all ${paymentType === "partial"
                                ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-amber-400"
                                }`}
                        >
                            <Banknote className="w-4 h-4" />
                            <span className="font-medium text-[10px]">Trả 1 phần</span>
                        </button>
                        <button
                            onClick={() => onPaymentTypeChange("installment")}
                            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all ${paymentType === "installment"
                                ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400"
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium text-[10px]">Trả góp</span>
                        </button>
                        <button
                            onClick={() => onPaymentTypeChange("note")}
                            className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border transition-all ${paymentType === "note"
                                ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-orange-400"
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            <span className="font-medium text-[10px]">Ghi nợ</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Partial Amount Input */}
            {paymentType === "partial" && (
                <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Số tiền trả trước
                    </label>
                    <NumberInput
                        value={partialAmount}
                        onChange={onPartialAmountChange}
                        min={0}
                        max={total}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Còn lại (Nợ khách hàng):</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(total - partialAmount)}
                        </span>
                    </div>
                </div>
            )}

            {/* Installment Summary */}
            {paymentType === "installment" && (
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Thiết lập trả góp
                        </label>
                        <button
                            type="button"
                            onClick={onOpenInstallmentSetup}
                            className="text-xs px-3 py-1 bg-white dark:bg-slate-700 border border-blue-300 rounded shadow-sm text-blue-600 hover:bg-blue-50"
                        >
                            {installmentDetails?.financeCompany ? "Sửa thiết lập" : "Thiết lập ngay"}
                        </button>
                    </div>

                    {installmentDetails?.financeCompany ? (
                        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex justify-between">
                                <span>Công ty:</span>
                                <span className="font-bold">{installmentDetails.financeCompany === "Store" ? "Cửa hàng" : installmentDetails.financeCompany}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Kỳ hạn:</span>
                                <span>{installmentDetails.term} tháng</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Trả trước:</span>
                                <span>{formatCurrency(installmentDetails.prepaidAmount)}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 mt-2">
                                <span>Còn lại (Gốc):</span>
                                <span className="font-bold text-red-600">{formatCurrency(total - installmentDetails.prepaidAmount)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm text-center text-slate-500 py-2">
                            Chưa có thông tin trả góp
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
