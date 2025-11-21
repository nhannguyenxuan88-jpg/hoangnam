import React, { useState } from "react";
import { Banknote, Wallet, PiggyBank } from "lucide-react";
import CashBook from "./CashBook";
import LoansManager from "./LoansManager";

type Tab = "cashbook" | "loans";

const FinanceManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>("cashbook");

  return (
    <div className="space-y-6">
      {/* Header with Toggle Buttons */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-lg border border-primary-border p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-primary-text mb-2">
              <PiggyBank className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              Quản lý Tài chính
            </h1>
            <p className="text-secondary-text">
              Quản lý sổ quỹ, khoản vay và các giao dịch tài chính
            </p>
          </div>

          {/* Toggle Buttons */}
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
            <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
              <button
                onClick={() => setActiveTab("cashbook")}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition-all shadow-md flex items-center justify-center gap-2 ${activeTab === "cashbook"
                  ? "bg-blue-600 text-white shadow-blue-500/50 scale-105"
                  : "bg-primary-bg text-secondary-text border border-primary-border hover:bg-tertiary-bg"
                  }`}
              >
                <Wallet className="w-4 h-4" /> <span className="whitespace-nowrap">Sổ quỹ</span>
              </button>
              <button
                onClick={() => setActiveTab("loans")}
                className={`px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium transition-all shadow-md flex items-center justify-center gap-2 ${activeTab === "loans"
                  ? "bg-cyan-600 text-white shadow-cyan-500/50 scale-105"
                  : "bg-primary-bg text-secondary-text border border-primary-border hover:bg-tertiary-bg"
                  }`}
              >
                <Banknote className="w-4 h-4" /> <span className="whitespace-nowrap">Khoản vay</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === "cashbook" && <CashBook />}
        {activeTab === "loans" && <LoansManager />}
      </div>
    </div>
  );
};

export default FinanceManager;
