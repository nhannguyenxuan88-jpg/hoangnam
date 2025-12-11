import React, { useState, useMemo } from "react";
import { FileText, Download, Calendar, Info } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useSalesRepo } from "../../hooks/useSalesRepository";
import { useWorkOrders } from "../../hooks/useSupabase";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import {
  exportVATReportXML,
  exportRevenueXML,
  getPeriodFromDateRange,
  type OrganizationTaxInfo,
} from "../../utils/taxReportXML";

/**
 * TAX REPORT EXPORT COMPONENT
 * Component để xuất báo cáo thuế theo định dạng XML chuẩn Tổng cục Thuế
 */

const TaxReportExport: React.FC = () => {
  const { currentBranchId } = useAppContext();

  // Fetch data
  const { data: salesData = [] } = useSalesRepo({ branchId: currentBranchId });
  const { data: workOrdersData = [] } = useWorkOrders(currentBranchId);
  const { data: cashTxData = [] } = useCashTxRepo({
    branchId: currentBranchId,
  });

  // State
  const [reportType, setReportType] = useState<"vat" | "revenue">("vat");
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(
    Math.floor(new Date().getMonth() / 3) + 1
  );

  // Organization info (should be fetched from settings)
  const organizationInfo: OrganizationTaxInfo = {
    taxCode: "0123456789", // TODO: Fetch from settings
    name: "CÔNG TY TNHH MOTOCARE",
    address: "123 Đường ABC, Quận 1, TP.HCM",
    phone: "028.1234.5678",
    email: "contact@motocare.vn",
    taxAuthority: "Cục Thuế TP. Hồ Chí Minh",
    taxDepartment: "Chi cục Thuế Quận 1",
    legalRepresentative: "Nguyễn Văn A",
    accountantName: "Trần Thị B",
    accountantPhone: "090.123.4567",
  };

  // Calculate date range
  const getDateRange = () => {
    let startDate: Date;
    let endDate: Date;

    if (periodType === "month") {
      startDate = new Date(selectedYear, selectedMonth - 1, 1);
      endDate = new Date(selectedYear, selectedMonth, 0);
    } else {
      // Quarter
      const quarterStartMonth = (selectedQuarter - 1) * 3;
      startDate = new Date(selectedYear, quarterStartMonth, 1);
      endDate = new Date(selectedYear, quarterStartMonth + 3, 0);
    }

    return { startDate, endDate };
  };

  // Filter data by date range
  const getFilteredData = () => {
    const { startDate, endDate } = getDateRange();

    const filteredSales = salesData.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate >= startDate && saleDate <= endDate;
    });

    const filteredWorkOrders = workOrdersData.filter((wo: any) => {
      const woDate = new Date(wo.creationDate || wo.creationdate);
      return woDate >= startDate && woDate <= endDate;
    });

    const filteredCashTx = cashTxData.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });

    return {
      sales: filteredSales,
      workOrders: filteredWorkOrders,
      cashTransactions: filteredCashTx,
    };
  };

  // Calculate preview stats
  const previewStats = useMemo(() => {
    const { sales, workOrders } = getFilteredData();

    let totalRevenue = 0;
    let totalVAT = 0;
    let transactionCount = 0;

    // From sales
    sales.forEach((sale) => {
      const amountBeforeVAT = Math.round(sale.total / 1.1);
      const vatAmount = sale.total - amountBeforeVAT;
      totalRevenue += amountBeforeVAT;
      totalVAT += vatAmount;
      transactionCount++;
    });

    // From work orders (paid)
    workOrders.forEach((wo: any) => {
      const isPaid = wo.paymentStatus === "paid" || wo.paymentstatus === "paid";
      if (isPaid) {
        const total =
          parseFloat(wo.totalPrice || wo.totalprice || 0) +
          parseFloat(wo.laborCost || wo.laborcost || 0);
        const amountBeforeVAT = Math.round(total / 1.1);
        const vatAmount = total - amountBeforeVAT;
        totalRevenue += amountBeforeVAT;
        totalVAT += vatAmount;
        transactionCount++;
      }
    });

    return { totalRevenue, totalVAT, transactionCount };
  }, [
    salesData,
    workOrdersData,
    cashTxData,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    periodType,
  ]);

  // Handle export
  const handleExport = () => {
    try {
      const { startDate, endDate } = getDateRange();
      const { sales, workOrders, cashTransactions } = getFilteredData();

      if (sales.length === 0 && workOrders.length === 0) {
        showToast.warning("Không có dữ liệu trong kỳ này!");
        return;
      }

      let result;

      if (reportType === "vat") {
        result = exportVATReportXML(
          sales,
          workOrders,
          cashTransactions,
          organizationInfo,
          startDate,
          endDate
        );
        showToast.success(
          `Đã xuất tờ khai VAT: ${
            result.fileName
          }\nThuế phải nộp: ${formatCurrency(result.vatPayable)}`
        );
      } else {
        result = exportRevenueXML(
          sales,
          workOrders,
          organizationInfo,
          startDate,
          endDate
        );
        showToast.success(`Đã xuất báo cáo doanh thu: ${result.fileName}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất báo cáo thuế!");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Xuất báo cáo thuế
          </h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Xuất file XML theo định dạng chuẩn Tổng cục Thuế để nhập vào phần mềm
          kê khai thuế
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-1">Hướng dẫn sử dụng:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Chọn loại báo cáo và kỳ báo cáo</li>
              <li>Kiểm tra thông tin tổng quan</li>
              <li>Nhấn "Xuất XML" để tải file</li>
              <li>Mở phần mềm kê khai thuế và nhập file XML</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Cấu hình báo cáo
        </h2>

        <div className="space-y-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loại báo cáo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReportType("vat")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  reportType === "vat"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tờ khai VAT (01/GTGT)
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Kê khai thuế giá trị gia tăng
                </div>
              </button>

              <button
                onClick={() => setReportType("revenue")}
                className={`p-3 rounded-lg border-2 transition-all ${
                  reportType === "revenue"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Báo cáo doanh thu
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Chi tiết doanh thu theo kỳ
                </div>
              </button>
            </div>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Kỳ báo cáo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPeriodType("month")}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  periodType === "month"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-semibold"
                    : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                }`}
              >
                Theo tháng
              </button>
              <button
                onClick={() => setPeriodType("quarter")}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  periodType === "quarter"
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 font-semibold"
                    : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                }`}
              >
                Theo quý
              </button>
            </div>
          </div>

          {/* Year Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Năm
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              {[2023, 2024, 2025, 2026].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Month/Quarter Selection */}
          {periodType === "month" ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tháng
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Quý
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {[1, 2, 3, 4].map((quarter) => (
                  <option key={quarter} value={quarter}>
                    Quý {quarter}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Preview Stats */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Tổng quan dữ liệu
        </h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-400 mb-1">
              Số giao dịch
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {previewStats.transactionCount}
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-sm text-green-700 dark:text-green-400 mb-1">
              Doanh thu chưa VAT
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(previewStats.totalRevenue)}
            </div>
          </div>

          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-sm text-orange-700 dark:text-orange-400 mb-1">
              Thuế VAT
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(previewStats.totalVAT)}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Kỳ báo cáo:
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {periodType === "month"
                ? `Tháng ${selectedMonth}/${selectedYear}`
                : `Quý ${selectedQuarter}/${selectedYear}`}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-600 dark:text-slate-400">Từ ngày:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatDate(getDateRange().startDate)} -{" "}
              {formatDate(getDateRange().endDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={previewStats.transactionCount === 0}
        className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
          previewStats.transactionCount === 0
            ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl"
        }`}
      >
        <Download className="w-5 h-5" />
        Xuất file XML
      </button>

      {previewStats.transactionCount === 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
          Không có dữ liệu trong kỳ này
        </p>
      )}
    </div>
  );
};

export default TaxReportExport;
