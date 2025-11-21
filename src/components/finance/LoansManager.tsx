import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import type { Loan, LoanPayment } from "../../types";
import { PlusIcon } from "../Icons";
import {
  useLoansRepo,
  useCreateLoanRepo,
  useUpdateLoanRepo,
  useDeleteLoanRepo,
  useLoanPaymentsRepo,
  useCreateLoanPaymentRepo,
} from "../../hooks/useLoansRepository";
import { showToast } from "../../utils/toast";

const LoansManager: React.FC = () => {
  const {
    currentBranchId,
    setCashTransactions,
    cashTransactions,
    setPaymentSources,
    paymentSources,
  } = useAppContext();

  // Fetch loans from Supabase
  const { data: loans = [], isLoading: loadingLoans } = useLoansRepo();
  const { data: loanPayments = [], isLoading: loadingPayments } =
    useLoanPaymentsRepo();
  const createLoan = useCreateLoanRepo();
  const updateLoan = useUpdateLoanRepo();
  const deleteLoan = useDeleteLoanRepo();
  const createLoanPayment = useCreateLoanPaymentRepo();
  const [showAddLoanModal, setShowAddLoanModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  // Calculate summary
  const summary = useMemo(() => {
    const totalLoans = loans.reduce((sum, loan) => sum + loan.principal, 0);
    const totalRemaining = loans.reduce(
      (sum, loan) => sum + loan.remainingAmount,
      0
    );
    const totalPaid = totalLoans - totalRemaining;
    const activeLoans = loans.filter((l) => l.status === "active").length;
    const overdueLoans = loans.filter((l) => l.status === "overdue").length;

    return {
      totalLoans,
      totalRemaining,
      totalPaid,
      activeLoans,
      overdueLoans,
    };
  }, [loans]);

  // Group loans by status
  const groupedLoans = useMemo(() => {
    return {
      active: loans.filter((l) => l.status === "active"),
      overdue: loans.filter((l) => l.status === "overdue"),
      paid: loans.filter((l) => l.status === "paid"),
    };
  }, [loans]);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Quản lý vốn & vay
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Theo dõi các khoản vay và lịch trả nợ
            </p>
          </div>
          <button
            onClick={() => setShowAddLoanModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            <span>Thêm khoản vay</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4 md:p-6">
        {loadingLoans || loadingPayments ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            <span className="ml-3 text-secondary-text">
              Đang tải dữ liệu...
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
                <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-2">
                  Tổng vay
                </div>
                <div className="text-blue-900 dark:text-blue-100 text-xl md:text-2xl font-bold truncate">
                  {formatCurrency(summary.totalLoans)}
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-2 border-red-200 dark:border-red-800">
                <div className="text-red-600 dark:text-red-400 text-sm font-medium mb-2">
                  Còn nợ
                </div>
                <div className="text-red-900 dark:text-red-100 text-xl md:text-2xl font-bold truncate">
                  {formatCurrency(summary.totalRemaining)}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border-2 border-green-200 dark:border-green-800">
                <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-2">
                  Đã trả
                </div>
                <div className="text-green-900 dark:text-green-100 text-xl md:text-2xl font-bold truncate">
                  {formatCurrency(summary.totalPaid)}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border-2 border-amber-200 dark:border-amber-800">
                <div className="text-amber-600 dark:text-amber-400 text-sm font-medium mb-2">
                  Đang vay
                </div>
                <div className="text-amber-900 dark:text-amber-100 text-xl md:text-2xl font-bold">
                  {summary.activeLoans}
                </div>
                <div className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                  khoản
                </div>
              </div>

              <div className="col-span-2 md:col-span-1 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border-2 border-orange-200 dark:border-orange-800">
                <div className="text-orange-600 dark:text-orange-400 text-sm font-medium mb-2">
                  Quá hạn
                </div>
                <div className="text-orange-900 dark:text-orange-100 text-xl md:text-2xl font-bold">
                  {summary.overdueLoans}
                </div>
                <div className="text-orange-600 dark:text-orange-400 text-xs mt-1">
                  khoản
                </div>
              </div>
            </div>

            {/* Active Loans */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Các khoản vay đang hoạt động
              </h2>
              {groupedLoans.active.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                  Không có khoản vay nào đang hoạt động
                </div>
              ) : (
                <div className="grid gap-4">
                  {groupedLoans.active.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      onPayment={() => {
                        setSelectedLoan(loan);
                        setShowPaymentModal(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Overdue Loans */}
            {groupedLoans.overdue.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-orange-600 dark:text-orange-400 mb-4">
                  Các khoản vay quá hạn
                </h2>
                <div className="grid gap-4">
                  {groupedLoans.overdue.map((loan) => (
                    <LoanCard
                      key={loan.id}
                      loan={loan}
                      onPayment={() => {
                        setSelectedLoan(loan);
                        setShowPaymentModal(true);
                      }}
                      isOverdue
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Paid Loans */}
            {groupedLoans.paid.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  Các khoản vay đã thanh toán
                </h2>
                <div className="grid gap-4">
                  {groupedLoans.paid.map((loan) => (
                    <LoanCard key={loan.id} loan={loan} isPaid />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showAddLoanModal && (
        <AddLoanModal
          onClose={() => setShowAddLoanModal(false)}
          onSave={async (loan) => {
            try {
              await createLoan.mutateAsync(
                loan as Omit<Loan, "id" | "created_at">
              );
              showToast.success("Đã thêm khoản vay thành công");
              setShowAddLoanModal(false);
            } catch (error: any) {
              showToast.error(error.message || "Không thể thêm khoản vay");
            }
          }}
        />
      )}

      {showPaymentModal && selectedLoan && (
        <LoanPaymentModal
          loan={selectedLoan}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedLoan(null);
          }}
          onSave={async (payment) => {
            try {
              // Update loan remaining amount
              await updateLoan.mutateAsync({
                id: selectedLoan.id,
                updates: {
                  remainingAmount: payment.remainingAmount,
                  status:
                    payment.remainingAmount === 0
                      ? "paid"
                      : selectedLoan.status,
                },
              });

              // Create payment record
              await createLoanPayment.mutateAsync(payment);

              showToast.success("Đã ghi nhận thanh toán thành công");

              // Tự động tạo giao dịch chi trong Sổ quỹ
              const cashTxId = `CT-${Date.now()}`;
              const cashTransaction = {
                id: cashTxId,
                type: "expense" as const,
                date: payment.paymentDate,
                amount: payment.totalAmount,
                recipient: selectedLoan.lenderName,
                notes: `Trả nợ vay - ${selectedLoan.lenderName
                  } (Gốc: ${formatCurrency(
                    payment.principalAmount
                  )}, Lãi: ${formatCurrency(payment.interestAmount)})`,
                paymentSourceId: payment.paymentMethod,
                branchId: currentBranchId,
                category: "loan_payment" as const,
              };

              setCashTransactions([cashTransaction, ...cashTransactions]);

              // Cập nhật số dư nguồn tiền
              setPaymentSources(
                paymentSources.map((ps) =>
                  ps.id === payment.paymentMethod
                    ? {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) -
                          payment.totalAmount,
                      },
                    }
                    : ps
                )
              );

              setShowPaymentModal(false);
              setSelectedLoan(null);
            } catch (error: any) {
              showToast.error(error.message || "Không thể ghi nhận thanh toán");
            }
          }}
        />
      )}
    </div>
  );
};

// Loan Card Component
const LoanCard: React.FC<{
  loan: Loan;
  onPayment?: () => void;
  isOverdue?: boolean;
  isPaid?: boolean;
}> = ({ loan, onPayment, isOverdue, isPaid }) => {
  const progressPercent =
    ((loan.principal - loan.remainingAmount) / loan.principal) * 100;
  const daysUntilDue = Math.ceil(
    (new Date(loan.endDate).getTime() - new Date().getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border-2 p-6 ${isOverdue
          ? "border-orange-300 dark:border-orange-700"
          : isPaid
            ? "border-green-300 dark:border-green-700"
            : "border-slate-200 dark:border-slate-700"
        }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {loan.lenderName}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${loan.loanType === "bank"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  : loan.loanType === "personal"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400"
                }`}
            >
              {loan.loanType === "bank"
                ? "Ngân hàng"
                : loan.loanType === "personal"
                  ? "Cá nhân"
                  : "Khác"}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {loan.purpose}
          </p>
        </div>
        {!isPaid && (
          <button
            onClick={onPayment}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Trả nợ
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Số tiền vay
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {formatCurrency(loan.principal)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Còn nợ
          </div>
          <div className="text-sm font-semibold text-red-600 dark:text-red-400 truncate">
            {formatCurrency(loan.remainingAmount)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Lãi suất
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {loan.interestRate}%/năm
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            Trả hàng tháng
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {formatCurrency(loan.monthlyPayment)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span>Đã trả {progressPercent.toFixed(1)}%</span>
          <span>
            {!isPaid &&
              (isOverdue
                ? "Quá hạn"
                : daysUntilDue > 0
                  ? `Còn ${daysUntilDue} ngày`
                  : "Đến hạn hôm nay")}
          </span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${isOverdue
                ? "bg-orange-500"
                : isPaid
                  ? "bg-green-500"
                  : "bg-blue-500"
              }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Ngày vay: {formatDate(new Date(loan.startDate))}</span>
        <span>Đến hạn: {formatDate(new Date(loan.endDate))}</span>
      </div>
    </div>
  );
};

// Add Loan Modal
const AddLoanModal: React.FC<{
  onClose: () => void;
  onSave: (loan: Partial<Loan>) => void;
}> = ({ onClose, onSave }) => {
  const [lenderName, setLenderName] = useState("");
  const [loanType, setLoanType] = useState<"bank" | "personal" | "other">(
    "bank"
  );
  const [principal, setPrincipal] = useState("0");
  const [interestRate, setInterestRate] = useState("0");
  const [term, setTerm] = useState("12");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [purpose, setPurpose] = useState("");
  const [collateral, setCollateral] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const principalAmount = parseFloat(principal);
    const rate = parseFloat(interestRate);
    const termMonths = parseInt(term);

    // Calculate monthly payment (simple calculation)
    const monthlyRate = rate / 100 / 12;
    const monthlyPayment =
      (principalAmount *
        (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    const start = new Date(startDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + termMonths);

    const newLoan = {
      lenderName,
      loanType,
      principal: principalAmount,
      interestRate: rate,
      term: termMonths,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      remainingAmount: principalAmount,
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      status: "active" as const,
      purpose,
      collateral,
    };

    onSave(newLoan);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Thêm khoản vay mới
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tên ngân hàng/Người cho vay *
              </label>
              <input
                type="text"
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Loại vay *
              </label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as any)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="bank">Ngân hàng</option>
                <option value="personal">Cá nhân</option>
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Số tiền vay *
              </label>
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Lãi suất (%/năm) *
              </label>
              <input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kỳ hạn (tháng) *
              </label>
              <input
                type="number"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ngày vay *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Mục đích vay
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ví dụ: Mở rộng cửa hàng, mua thiết bị..."
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tài sản thế chấp
            </label>
            <input
              type="text"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              placeholder="Ví dụ: Sổ đỏ nhà, giấy tờ xe..."
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-4">
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
              Thêm khoản vay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Loan Payment Modal
const LoanPaymentModal: React.FC<{
  loan: Loan;
  onClose: () => void;
  onSave: (payment: LoanPayment) => void;
}> = ({ loan, onClose, onSave }) => {
  const [principalAmount, setPrincipalAmount] = useState(
    loan.monthlyPayment.toString()
  );
  const [interestAmount, setInterestAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("bank");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const totalAmount = parseFloat(principalAmount) + parseFloat(interestAmount);
  const remainingAfterPayment =
    loan.remainingAmount - parseFloat(principalAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payment: LoanPayment = {
      id: `LOANPAY-${Date.now()}`,
      loanId: loan.id,
      paymentDate: new Date(paymentDate).toISOString(),
      principalAmount: parseFloat(principalAmount),
      interestAmount: parseFloat(interestAmount),
      totalAmount,
      remainingAmount: Math.max(0, remainingAfterPayment),
      paymentMethod,
      notes,
      branchId: loan.branchId,
    };

    onSave(payment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Trả nợ - {loan.lenderName}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Còn nợ: {formatCurrency(loan.remainingAmount)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tiền gốc *
            </label>
            <input
              type="number"
              value={principalAmount}
              onChange={(e) => setPrincipalAmount(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tiền lãi
            </label>
            <input
              type="number"
              value={interestAmount}
              onChange={(e) => setInterestAmount(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600 dark:text-slate-400">
                Tổng tiền trả:
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                Còn lại sau khi trả:
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(Math.max(0, remainingAfterPayment))}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Hình thức thanh toán
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value as "bank")}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-slate-900 dark:text-white">
                  Chuyển khoản
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ngày trả
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ghi chú
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

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
              Xác nhận trả nợ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoansManager;
