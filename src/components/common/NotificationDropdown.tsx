import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Package,
  HandCoins,
  Wallet,
  Wrench,
  AlertTriangle,
  X,
  ChevronRight,
} from "lucide-react";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useLoansRepo } from "../../hooks/useLoansRepository";
import { usePaymentSources, useWorkOrders } from "../../hooks/useSupabase";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";

interface Alert {
  id: string;
  type: "low-stock" | "loan-due" | "low-balance" | "work-order";
  title: string;
  message: string;
  link: string;
  icon: React.ReactNode;
  color: string;
}

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentBranchId } = useAppContext();

  // Fetch data
  const { data: parts = [] } = usePartsRepo();
  const { data: loans = [] } = useLoansRepo();
  const { data: paymentSources = [] } = usePaymentSources();
  const { data: workOrders = [] } = useWorkOrders();

  // Calculate alerts
  const alerts: Alert[] = [];

  // 1. Low stock alerts
  const lowStockParts = parts.filter(
    (p) =>
      (p.stock[currentBranchId] || 0) < 10 &&
      (p.stock[currentBranchId] || 0) > 0
  );
  const outOfStockParts = parts.filter(
    (p) => (p.stock[currentBranchId] || 0) === 0
  );

  if (outOfStockParts.length > 0) {
    alerts.push({
      id: "out-of-stock",
      type: "low-stock",
      title: "Hết hàng",
      message: `${outOfStockParts.length} sản phẩm đã hết hàng`,
      link: "/inventory",
      icon: <Package className="w-5 h-5" />,
      color: "text-red-500 bg-red-50 dark:bg-red-900/20",
    });
  }

  if (lowStockParts.length > 0) {
    alerts.push({
      id: "low-stock",
      type: "low-stock",
      title: "Sắp hết hàng",
      message: `${lowStockParts.length} sản phẩm cần nhập thêm`,
      link: "/inventory",
      icon: <Package className="w-5 h-5" />,
      color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
    });
  }

  // 2. Loan due alerts
  const upcomingLoans = loans.filter((loan) => {
    const daysUntilDue = Math.ceil(
      (new Date(loan.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDue <= 30 && daysUntilDue > 0 && loan.status === "active";
  });

  if (upcomingLoans.length > 0) {
    alerts.push({
      id: "loan-due",
      type: "loan-due",
      title: "Nợ sắp đến hạn",
      message: `${upcomingLoans.length} khoản vay trong 30 ngày tới`,
      link: "/finance",
      icon: <HandCoins className="w-5 h-5" />,
      color: "text-red-500 bg-red-50 dark:bg-red-900/20",
    });
  }

  // 3. Low balance alerts
  const cashBalance =
    paymentSources.find((ps) => ps.id === "cash")?.balance[currentBranchId] ||
    0;
  const bankBalance =
    paymentSources.find((ps) => ps.id === "bank")?.balance[currentBranchId] ||
    0;
  const totalBalance = cashBalance + bankBalance;

  if (totalBalance < 10000000) {
    alerts.push({
      id: "low-balance",
      type: "low-balance",
      title: "Số dư thấp",
      message: `Tổng số dư: ${formatCurrency(totalBalance)}`,
      link: "/cashbook",
      icon: <Wallet className="w-5 h-5" />,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-900/20",
    });
  }

  // 4. Pending work orders
  const pendingWorkOrders = (workOrders || []).filter(
    (wo) => wo.status === "Tiếp nhận" || wo.status === "Đang sửa"
  );

  if (pendingWorkOrders.length > 0) {
    alerts.push({
      id: "work-orders",
      type: "work-order",
      title: "Phiếu chờ xử lý",
      message: `${pendingWorkOrders.length} xe đang chờ sửa chữa`,
      link: "/service",
      icon: <Wrench className="w-5 h-5" />,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
    });
  }

  const alertCount = alerts.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {alertCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Thông báo
              </h3>
              {alertCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full">
                  {alertCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Alerts List */}
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-green-500" />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Không có thông báo mới
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Mọi thứ đang ổn! 👍
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    to={alert.link}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${alert.color}`}
                    >
                      {alert.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {alert.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {alert.message}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition flex-shrink-0 mt-1" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
                Click vào thông báo để xem chi tiết
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
