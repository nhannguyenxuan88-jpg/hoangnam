import React, { useState, useMemo, useEffect } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { PlusIcon } from "../Icons";
import type { CustomerDebt, SupplierDebt } from "../../types";
import {
  useCustomerDebtsRepo,
  useCreateCustomerDebtRepo,
  useUpdateCustomerDebtRepo,
  useDeleteCustomerDebtRepo,
  useSupplierDebtsRepo,
  useCreateSupplierDebtRepo,
  useUpdateSupplierDebtRepo,
  useDeleteSupplierDebtRepo,
} from "../../hooks/useDebtsRepository";

const DebtManager: React.FC = () => {
  const {
    customers,
    suppliers,
    currentBranchId,
    setCashTransactions,
    cashTransactions,
    setPaymentSources,
    paymentSources,
  } = useAppContext();

  // Fetch debts from Supabase
  const { data: customerDebts = [], isLoading: loadingCustomerDebts } =
    useCustomerDebtsRepo();
  const { data: supplierDebts = [], isLoading: loadingSupplierDebts } =
    useSupplierDebtsRepo();
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const updateCustomerDebt = useUpdateCustomerDebtRepo();
  const deleteCustomerDebt = useDeleteCustomerDebtRepo();
  const createSupplierDebt = useCreateSupplierDebtRepo();
  const updateSupplierDebt = useUpdateSupplierDebtRepo();
  const deleteSupplierDebt = useDeleteSupplierDebtRepo();
  const [activeTab, setActiveTab] = useState<"customer" | "supplier">(
    "customer"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);

  // Filter by branch
  const branchCustomerDebts = useMemo(() => {
    return customerDebts.filter((debt) => debt.branchId === currentBranchId);
  }, [customerDebts, currentBranchId]);

  const branchSupplierDebts = useMemo(() => {
    return supplierDebts.filter((debt) => debt.branchId === currentBranchId);
  }, [supplierDebts, currentBranchId]);

  // Filter debts based on search
  const filteredCustomerDebts = useMemo(() => {
    if (!searchTerm) return branchCustomerDebts;
    const term = searchTerm.toLowerCase();
    return branchCustomerDebts.filter(
      (debt) =>
        debt.customerName.toLowerCase().includes(term) ||
        debt.phone?.includes(term) ||
        debt.licensePlate?.toLowerCase().includes(term)
    );
  }, [branchCustomerDebts, searchTerm]);

  // Debug: log debts count by branch
  useEffect(() => {
    console.log(
      "[DebtManager] branchCustomerDebts count:",
      branchCustomerDebts.length,
      "branchId:",
      currentBranchId
    );
  }, [branchCustomerDebts, currentBranchId]);

  const filteredSupplierDebts = useMemo(() => {
    if (!searchTerm) return branchSupplierDebts;
    const term = searchTerm.toLowerCase();
    return branchSupplierDebts.filter((debt) =>
      debt.supplierName.toLowerCase().includes(term)
    );
  }, [branchSupplierDebts, searchTerm]);

  // Calculate totals
  const customerTotal = useMemo(
    () =>
      branchCustomerDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [branchCustomerDebts]
  );

  const supplierTotal = useMemo(
    () =>
      branchSupplierDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    [branchSupplierDebts]
  );

  // Calculate selected debt total
  const selectedCustomerTotal = useMemo(() => {
    return selectedCustomerIds.reduce((sum, id) => {
      const debt = branchCustomerDebts.find((d) => d.customerId === id);
      return sum + (debt?.remainingAmount || 0);
    }, 0);
  }, [selectedCustomerIds, branchCustomerDebts]);

  const selectedSupplierTotal = useMemo(() => {
    return selectedSupplierIds.reduce((sum, id) => {
      const debt = branchSupplierDebts.find((d) => d.supplierId === id);
      return sum + (debt?.remainingAmount || 0);
    }, 0);
  }, [selectedSupplierIds, branchSupplierDebts]);

  // Handle checkbox change
  const handleCustomerCheckbox = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds([...selectedCustomerIds, customerId]);
    } else {
      setSelectedCustomerIds(
        selectedCustomerIds.filter((id) => id !== customerId)
      );
    }
  };

  const handleSupplierCheckbox = (supplierId: string, checked: boolean) => {
    if (checked) {
      setSelectedSupplierIds([...selectedSupplierIds, supplierId]);
    } else {
      setSelectedSupplierIds(
        selectedSupplierIds.filter((id) => id !== supplierId)
      );
    }
  };

  // Handle pay all selected debts
  const handlePaySelectedDebts = () => {
    setShowBulkPaymentModal(true);
  };

  return (
    <div className="h-full flex flex-col bg-secondary-bg">
      {/* Header with Tabs */}
      <div className="bg-primary-bg border-b border-primary-border">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center">
            <button
              onClick={() => setActiveTab("customer")}
              className={`px-6 py-4 font-medium text-sm transition-all ${
                activeTab === "customer"
                  ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400"
                  : "text-secondary-text hover:text-primary-text"
              }`}
            >
              Công nợ khách hàng
            </button>
            <button
              onClick={() => setActiveTab("supplier")}
              className={`px-6 py-4 font-medium text-sm transition-all ${
                activeTab === "supplier"
                  ? "text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600 dark:border-cyan-400"
                  : "text-secondary-text hover:text-primary-text"
              }`}
            >
              Công nợ nhà cung cấp
            </button>
          </div>
        </div>
      </div>

      {/* Search and Actions Bar */}
      <div className="bg-primary-bg px-6 py-4 border-b border-primary-border">
        {loadingCustomerDebts || loadingSupplierDebts ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            <span className="ml-3 text-secondary-text">
              Đang tải dữ liệu...
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <svg
                className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-tertiary-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder={
                  activeTab === "customer"
                    ? "Tìm SĐT / Tên KH / Tên sản phẩm / IMEI"
                    : "Tìm tên / SĐT nhà cung cấp"
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-primary-bg border border-secondary-border rounded-lg text-primary-text placeholder-tertiary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="text-secondary-text text-sm">
              Tổng công nợ:{" "}
              <span className="font-bold text-red-600 dark:text-red-400">
                {formatCurrency(
                  activeTab === "customer" ? customerTotal : supplierTotal
                )}
              </span>
            </div>
            <button
              onClick={() =>
                activeTab === "customer"
                  ? setShowCollectModal(true)
                  : setShowPaymentModal(true)
              }
              className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span>{activeTab === "customer" ? "Thư nợ" : "Chi trả nợ"}</span>
            </button>
            <button className="p-2.5 text-secondary-text hover:text-primary-text transition-colors">
              <svg
                className="w-6 h-6"
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
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === "customer" ? (
          <div className="p-6">
            {filteredCustomerDebts.length === 0 ? (
              <div className="text-center py-12 text-tertiary-text">
                Không có công nợ.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCustomerDebts.map((debt) => (
                  <div
                    key={debt.customerId}
                    className="bg-primary-bg border border-primary-border rounded-lg p-4 hover:border-secondary-border transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(
                            debt.customerId
                          )}
                          onChange={(e) =>
                            handleCustomerCheckbox(
                              debt.customerId,
                              e.target.checked
                            )
                          }
                          className="mt-1 w-4 h-4 rounded border-secondary-border text-cyan-600 focus:ring-cyan-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-primary-text font-semibold text-lg">
                              {debt.customerName}
                            </h3>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="text-cyan-600 dark:text-cyan-400">
                              Phone: {debt.phone || "--"}
                            </div>
                            <div className="text-cyan-600 dark:text-cyan-400">
                              Đơn Hàng: {debt.licensePlate || "--"}
                            </div>
                            <div className="text-tertiary-text">
                              Ngày tạo đơn:{" "}
                              {formatDate(new Date(debt.createdDate))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            NỘI DUNG
                          </div>
                          <div className="text-primary-text text-sm">
                            {debt.description}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            SỐ TIỀN
                          </div>
                          <div className="text-primary-text font-semibold">
                            {formatCurrency(debt.totalAmount)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            ĐÃ TRẢ
                          </div>
                          <div className="text-primary-text font-semibold">
                            {formatCurrency(debt.paidAmount)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            CÒN NỢ
                          </div>
                          <div className="text-red-600 dark:text-red-400 font-bold text-lg">
                            {formatCurrency(debt.remainingAmount)}
                          </div>
                        </div>
                      </div>

                      <button className="ml-4 p-2 text-secondary-text hover:text-primary-text transition-colors">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            {filteredSupplierDebts.length === 0 ? (
              <div className="text-center py-12 text-tertiary-text">
                Không có công nợ.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSupplierDebts.map((debt) => (
                  <div
                    key={debt.supplierId}
                    className="bg-primary-bg border border-primary-border rounded-lg p-4 hover:border-secondary-border transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedSupplierIds.includes(
                            debt.supplierId
                          )}
                          onChange={(e) =>
                            handleSupplierCheckbox(
                              debt.supplierId,
                              e.target.checked
                            )
                          }
                          className="mt-1 w-4 h-4 rounded border-secondary-border bg-primary-bg text-cyan-600 focus:ring-cyan-500 focus:ring-offset-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-primary-text font-semibold text-lg">
                              {debt.supplierName}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            NỘI DUNG
                          </div>
                          <div className="text-primary-text text-sm">
                            {debt.description}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            SỐ TIỀN
                          </div>
                          <div className="text-primary-text font-semibold">
                            {formatCurrency(debt.totalAmount)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            ĐÃ TRẢ
                          </div>
                          <div className="text-primary-text font-semibold">
                            {formatCurrency(debt.paidAmount)}
                          </div>
                        </div>
                      </div>

                      <div className="text-right ml-8">
                        <div className="mb-2">
                          <div className="text-tertiary-text text-xs mb-1">
                            CÒN NỢ
                          </div>
                          <div className="text-red-600 dark:text-red-400 font-bold text-lg">
                            {formatCurrency(debt.remainingAmount)}
                          </div>
                        </div>
                      </div>

                      <button className="ml-4 p-2 text-secondary-text hover:text-primary-text transition-colors">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Button - Pay All Selected */}
      {((activeTab === "customer" && selectedCustomerIds.length > 0) ||
        (activeTab === "supplier" && selectedSupplierIds.length > 0)) && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <button
            onClick={handlePaySelectedDebts}
            className="flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-2xl transition-all hover:scale-105"
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Đã chọn{" "}
              {activeTab === "customer"
                ? selectedCustomerIds.length
                : selectedSupplierIds.length}{" "}
              đơn
            </span>
            <span className="mx-2">|</span>
            <span className="text-xl font-bold">
              Trả hết nợ (
              {formatCurrency(
                activeTab === "customer"
                  ? selectedCustomerTotal
                  : selectedSupplierTotal
              )}
              )
            </span>
          </button>
        </div>
      )}

      {/* Modals */}
      {showCollectModal && (
        <CollectDebtModal
          customers={customers}
          customerDebts={customerDebts}
          onClose={() => setShowCollectModal(false)}
          onCollect={(data) => {
            // Tự động tạo giao dịch thu trong Sổ quỹ
            const cashTxId = `CT-${Date.now()}`;
            const cashTransaction = {
              id: cashTxId,
              type: "income" as const,
              date: data.timestamp,
              amount: data.amount,
              recipient: data.customerName,
              notes: `Thu nợ khách hàng - ${data.customerName}`,
              paymentSourceId: data.paymentMethod,
              branchId: currentBranchId,
              category: "debt_collection" as const,
            };

            setCashTransactions([cashTransaction, ...cashTransactions]);

            // Cập nhật số dư nguồn tiền
            setPaymentSources(
              paymentSources.map((ps) =>
                ps.id === data.paymentMethod
                  ? {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) + data.amount,
                      },
                    }
                  : ps
              )
            );

            setShowCollectModal(false);
          }}
        />
      )}

      {/* Bulk Payment Modal */}
      {showBulkPaymentModal && (
        <BulkPaymentModal
          isOpen={showBulkPaymentModal}
          onClose={() => {
            setShowBulkPaymentModal(false);
          }}
          selectedDebts={
            activeTab === "customer"
              ? branchCustomerDebts.filter((d) =>
                  selectedCustomerIds.includes(d.customerId)
                )
              : branchSupplierDebts.filter((d) =>
                  selectedSupplierIds.includes(d.supplierId)
                )
          }
          totalAmount={
            activeTab === "customer"
              ? selectedCustomerTotal
              : selectedSupplierTotal
          }
          debtType={activeTab}
          onConfirm={async (paymentMethod, paymentTime) => {
            // TODO: Implement bulk payment with repository
            // For now, just update individual debts
            try {
              if (activeTab === "customer") {
                for (const customerId of selectedCustomerIds) {
                  const debt = branchCustomerDebts.find(
                    (d) => d.customerId === customerId
                  );
                  if (debt) {
                    await updateCustomerDebt.mutateAsync({
                      id: debt.id,
                      updates: {
                        paidAmount: debt.totalAmount,
                        remainingAmount: 0,
                      },
                    });
                  }
                }
                setSelectedCustomerIds([]);
              } else {
                for (const supplierId of selectedSupplierIds) {
                  const debt = branchSupplierDebts.find(
                    (d) => d.supplierId === supplierId
                  );
                  if (debt) {
                    await updateSupplierDebt.mutateAsync({
                      id: debt.id,
                      updates: {
                        paidAmount: debt.totalAmount,
                        remainingAmount: 0,
                      },
                    });
                  }
                }
                setSelectedSupplierIds([]);
              }

              setShowBulkPaymentModal(false);

              // Show success message
              showToast.success(
                `Đã thanh toán thành công ${formatCurrency(
                  activeTab === "customer"
                    ? selectedCustomerTotal
                    : selectedSupplierTotal
                )} qua ${
                  paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"
                }`
              );
            } catch (error: any) {
              showToast.error(error.message || "Không thể thanh toán");
            }
          }}
        />
      )}

      {showPaymentModal && (
        <PaySupplierModal
          suppliers={suppliers}
          supplierDebts={supplierDebts}
          onClose={() => setShowPaymentModal(false)}
          onPay={(data) => {
            // Tự động tạo giao dịch chi trong Sổ quỹ
            const cashTxId = `CT-${Date.now()}`;
            const cashTransaction = {
              id: cashTxId,
              type: "expense" as const,
              date: data.timestamp,
              amount: data.amount,
              recipient: data.supplierName,
              notes: `Trả nợ nhà cung cấp - ${data.supplierName}`,
              paymentSourceId: data.paymentMethod,
              branchId: currentBranchId,
              category: "debt_payment" as const,
            };

            setCashTransactions([cashTransaction, ...cashTransactions]);

            // Cập nhật số dư nguồn tiền
            setPaymentSources(
              paymentSources.map((ps) =>
                ps.id === data.paymentMethod
                  ? {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) - data.amount,
                      },
                    }
                  : ps
              )
            );

            setShowPaymentModal(false);
          }}
        />
      )}
    </div>
  );
};

// Modal Thu nợ khách hàng
const CollectDebtModal: React.FC<{
  customers: any[];
  customerDebts: CustomerDebt[];
  onClose: () => void;
  onCollect?: (data: {
    customerName: string;
    amount: number;
    paymentMethod: "cash" | "bank";
    timestamp: string;
  }) => void;
}> = ({ customers, customerDebts, onClose, onCollect }) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [createTime, setCreateTime] = useState(
    new Date()
      .toLocaleString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(" ", " ")
  );

  const selectedDebt = useMemo(() => {
    return customerDebts.find((d) => d.customerId === selectedCustomerId);
  }, [selectedCustomerId, customerDebts]);

  const remainingAmount = selectedDebt?.remainingAmount || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (customer && onCollect) {
      onCollect({
        customerName: customer.name,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        timestamp: createTime,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-secondary-bg rounded-xl shadow-2xl max-w-lg w-full border border-primary-border">
        <div className="px-6 py-4 border-b border-primary-border">
          <h2 className="text-xl font-semibold text-primary-text">
            Thu nợ khách hàng
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer Selection */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Tìm kiếm và chọn một khách hàng đang nợ
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Chọn khách hàng...</option>
              {customerDebts.map((debt) => (
                <option key={debt.customerId} value={debt.customerId}>
                  {debt.customerName} - {formatCurrency(debt.remainingAmount)}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-secondary-text">
                Nhập số tiền thanh toán
              </label>
              <span className="text-cyan-600 dark:text-cyan-400 text-sm">
                {formatCurrency(parseFloat(paymentAmount) || 0)}
              </span>
            </div>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Remaining Amount */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-tertiary-text">Còn nợ:</span>
              <span className="text-red-600 dark:text-red-400 font-bold text-base">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPaymentAmount(remainingAmount.toString())}
              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm mt-1"
            >
              Điền số còn nợ
            </button>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-3">
              Hình thức thanh toán:
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash")}
                  className="w-4 h-4 text-cyan-600 bg-primary-bg border-secondary-border focus:ring-cyan-500"
                />
                <span className="text-primary-text">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value as "bank")}
                  className="w-4 h-4 text-cyan-600 bg-primary-bg border-secondary-border focus:ring-cyan-500"
                />
                <span className="text-primary-text">Chuyển khoản</span>
              </label>
            </div>
          </div>

          {/* Create Time */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Thời gian tạo phiếu thu
            </label>
            <input
              type="text"
              value={createTime}
              onChange={(e) => setCreateTime(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedCustomerId || parseFloat(paymentAmount) <= 0}
            className="w-full py-3 bg-primary-bg hover:bg-tertiary-bg text-primary-text rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tạo phiếu thu
          </button>
        </form>

        {/* Close Button */}
        <div className="px-6 py-4 border-t border-primary-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-secondary-text hover:text-primary-text transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal Chi trả nợ nhà cung cấp
const PaySupplierModal: React.FC<{
  suppliers: any[];
  supplierDebts: SupplierDebt[];
  onClose: () => void;
  onPay?: (data: {
    supplierName: string;
    amount: number;
    paymentMethod: "cash" | "bank";
    timestamp: string;
  }) => void;
}> = ({ suppliers, supplierDebts, onClose, onPay }) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [createTime, setCreateTime] = useState(
    new Date()
      .toLocaleString("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(" ", " ")
  );

  const selectedDebt = useMemo(() => {
    return supplierDebts.find((d) => d.supplierId === selectedSupplierId);
  }, [selectedSupplierId, supplierDebts]);

  const remainingAmount = selectedDebt?.remainingAmount || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (supplier && onPay) {
      onPay({
        supplierName: supplier.name,
        amount: parseFloat(paymentAmount),
        paymentMethod,
        timestamp: createTime,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-secondary-bg rounded-xl shadow-2xl max-w-lg w-full border border-primary-border">
        <div className="px-6 py-4 border-b border-primary-border">
          <h2 className="text-xl font-semibold text-primary-text">
            Chi trả nợ nhà cung cấp
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Tìm kiếm và chọn một nhà cung cấp đang nợ
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Chọn nhà cung cấp...</option>
              {supplierDebts.map((debt) => (
                <option key={debt.supplierId} value={debt.supplierId}>
                  {debt.supplierName} - {formatCurrency(debt.remainingAmount)}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-secondary-text">
                Nhập số tiền thanh toán
              </label>
              <span className="text-cyan-600 dark:text-cyan-400 text-sm">
                {formatCurrency(parseFloat(paymentAmount) || 0)}
              </span>
            </div>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Remaining Amount */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-tertiary-text">Còn nợ:</span>
              <span className="text-red-600 dark:text-red-400 font-bold text-base">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPaymentAmount(remainingAmount.toString())}
              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-sm mt-1"
            >
              Điền số còn nợ
            </button>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-3">
              Hình thức thanh toán:
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash")}
                  className="w-4 h-4 text-cyan-600 bg-primary-bg border-secondary-border focus:ring-cyan-500"
                />
                <span className="text-primary-text">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value as "bank")}
                  className="w-4 h-4 text-cyan-600 bg-primary-bg border-secondary-border focus:ring-cyan-500"
                />
                <span className="text-primary-text">Chuyển khoản</span>
              </label>
            </div>
          </div>

          {/* Create Time */}
          <div>
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Thời gian tạo phiếu chi
            </label>
            <input
              type="text"
              value={createTime}
              onChange={(e) => setCreateTime(e.target.value)}
              className="w-full px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg text-primary-text focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedSupplierId || parseFloat(paymentAmount) <= 0}
            className="w-full py-3 bg-primary-bg hover:bg-tertiary-bg text-primary-text rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tạo phiếu chi
          </button>
        </form>

        {/* Close Button */}
        <div className="px-6 py-4 border-t border-primary-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-secondary-text hover:text-primary-text transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Payment Modal Component
interface BulkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDebts: (CustomerDebt | SupplierDebt)[];
  totalAmount: number;
  debtType: "customer" | "supplier";
  onConfirm: (paymentMethod: "cash" | "bank", paymentTime: string) => void;
}

const BulkPaymentModal: React.FC<BulkPaymentModalProps> = ({
  isOpen,
  onClose,
  selectedDebts,
  totalAmount,
  debtType,
  onConfirm,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentTime, setPaymentTime] = useState(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMethod) {
      showToast.warning("Vui lòng chọn hình thức thanh toán");
      return;
    }

    // Convert paymentTime to ISO string for storage
    const [datePart, timePart] = paymentTime.split(" ");
    const [day, month, year] = datePart.split("-");
    const [hours, minutes] = timePart.split(":");
    const isoTimestamp = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    ).toISOString();

    onConfirm(paymentMethod, isoTimestamp);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-secondary-bg rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-border">
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-primary-text">
              Trả hết nợ (
              {debtType === "customer"
                ? "nhiều đơn hàng"
                : "nhiều nhà cung cấp"}
              )
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-secondary-text hover:text-primary-text transition-colors"
          >
            <svg
              className="w-6 h-6"
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Selected Debts List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-secondary-text">-</span>
              <span className="text-sm font-medium text-secondary-text">
                Chi tiết
              </span>
              <span className="text-sm font-medium text-secondary-text">
                Số tiền
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDebts.map((debt, index) => {
                const isCustomerDebt = "customerName" in debt;
                const name = isCustomerDebt
                  ? (debt as CustomerDebt).customerName
                  : (debt as SupplierDebt).supplierName;
                const detail = isCustomerDebt
                  ? (debt as CustomerDebt).description
                  : (debt as SupplierDebt).description;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 bg-tertiary-bg rounded"
                  >
                    <span className="text-sm text-tertiary-text">
                      {index + 1}
                    </span>
                    <div className="flex-1 mx-3">
                      <div className="text-sm font-medium text-primary-text">
                        {detail}
                      </div>
                      <div className="text-xs text-tertiary-text">{name}</div>
                    </div>
                    <span className="text-sm font-semibold text-primary-text">
                      {formatCurrency(debt.remainingAmount)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-border">
              <span className="font-semibold text-primary-text">TỔNG</span>
              <span className="text-lg font-bold text-red-500">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-text mb-3">
              Hình thức thanh toán:
            </label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-primary-text">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-primary-text">Chuyển khoản</span>
              </label>
            </div>
          </div>

          {/* Payment Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-secondary-text mb-2">
              Thời gian tạo phiếu thu
            </label>
            <div className="flex items-center gap-2 px-4 py-3 bg-primary-bg border border-secondary-border rounded-lg">
              <input
                type="text"
                value={paymentTime}
                onChange={(e) => setPaymentTime(e.target.value)}
                className="flex-1 bg-transparent text-primary-text outline-none"
              />
              <svg
                className="w-5 h-5 text-tertiary-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <svg
                className="w-5 h-5 text-tertiary-text"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-secondary-border text-secondary-text rounded-lg hover:bg-primary-bg transition-colors font-medium"
            >
              ĐÓNG
            </button>
            <button
              type="submit"
              disabled={!paymentMethod}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              TẠO PHIẾU THU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DebtManager;
