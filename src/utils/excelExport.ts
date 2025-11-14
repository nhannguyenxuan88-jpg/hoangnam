import * as XLSX from "xlsx";
import {
  Sale,
  CashTransaction,
  Part,
  PayrollRecord,
  Customer,
  Supplier,
} from "../types";
import { formatCurrency, formatDate, formatAnyId } from "./format";

// ==================== REVENUE REPORT ====================
export const exportRevenueReport = (
  sales: Sale[],
  startDate: string,
  endDate: string
) => {
  // Tạo workbook
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((sum, s) => {
    return (
      sum +
      s.items.reduce(
        (c, it) => c + ((it as any).costPrice || 0) * it.quantity,
        0
      )
    );
  }, 0);
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const summaryData = [
    ["BÁO CÁO DOANH THU"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng doanh thu", formatCurrency(totalRevenue)],
    ["Tổng chi phí", formatCurrency(totalCost)],
    ["Lợi nhuận", formatCurrency(profit)],
    ["Biên lợi nhuận", `${margin.toFixed(2)}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed Sales Sheet
  const salesData: (string | number)[][] = [
    [
      "Mã đơn",
      "Ngày",
      "Khách hàng",
      "SĐT",
      "Sản phẩm",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Giảm giá",
      "Tổng",
      "Phương thức",
    ],
  ];

  sales.forEach((sale) => {
    sale.items.forEach((item, idx) => {
      salesData.push([
        idx === 0 ? formatAnyId(sale.id) : "",
        idx === 0 ? formatDate(sale.date) : "",
        idx === 0 ? sale.customer.name : "",
        idx === 0 ? sale.customer.phone || "" : "",
        item.partName,
        item.quantity,
        item.sellingPrice,
        item.sellingPrice * item.quantity,
        idx === 0 ? sale.discount : "",
        idx === 0 ? sale.total : "",
        idx === 0
          ? sale.paymentMethod === "cash"
            ? "Tiền mặt"
            : "Ngân hàng"
          : "",
      ]);
    });
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết bán hàng");

  // Export file
  const fileName = `BaoCaoDoanhThu_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== CASHFLOW REPORT ====================
export const exportCashflowReport = (
  transactions: CashTransaction[],
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  const summaryData = [
    ["BÁO CÁO THU CHI"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng thu", formatCurrency(income)],
    ["Tổng chi", formatCurrency(expense)],
    ["Thu chi ròng", formatCurrency(net)],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed transactions
  const transData: (string | number)[][] = [
    [
      "Ngày",
      "Loại",
      "Danh mục",
      "Số tiền",
      "Đối tượng",
      "Nguồn thanh toán",
      "Ghi chú",
    ],
  ];

  transactions.forEach((t) => {
    transData.push([
      formatDate(t.date),
      t.type === "income" ? "Thu" : "Chi",
      t.category || "",
      t.amount,
      t.recipient || "",
      t.paymentSourceId,
      t.notes,
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(transData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết giao dịch");

  // 3. Category breakdown
  const categoryMap: Record<string, { income: number; expense: number }> = {};

  transactions.forEach((t) => {
    const cat = t.category || "Khác";
    if (!categoryMap[cat]) {
      categoryMap[cat] = { income: 0, expense: 0 };
    }
    if (t.type === "income") {
      categoryMap[cat].income += t.amount;
    } else {
      categoryMap[cat].expense += t.amount;
    }
  });

  const categoryData: (string | number)[][] = [
    ["Danh mục", "Thu", "Chi", "Chênh lệch"],
  ];
  Object.entries(categoryMap).forEach(([cat, amounts]) => {
    categoryData.push([
      cat,
      amounts.income,
      amounts.expense,
      amounts.income - amounts.expense,
    ]);
  });

  const wsCategory = XLSX.utils.aoa_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(wb, wsCategory, "Theo danh mục");

  const fileName = `BaoCaoThuChi_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== INVENTORY REPORT ====================
export const exportInventoryReport = (
  parts: Part[],
  branchId: string,
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const totalValue = parts.reduce(
    (sum, p) =>
      sum + (p.stock[branchId] || 0) * (p.wholesalePrice?.[branchId] || 0),
    0
  );
  const lowStockCount = parts.filter(
    (p) => (p.stock[branchId] || 0) < 10
  ).length;

  const summaryData = [
    ["BÁO CÁO TỒN KHO"],
    [`Ngày: ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng giá trị tồn kho", formatCurrency(totalValue)],
    ["Số loại sản phẩm", parts.length],
    ["Sản phẩm tồn kho thấp", lowStockCount],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed inventory
  const inventoryData: (string | number)[][] = [
    [
      "Mã SKU",
      "Tên sản phẩm",
      "Danh mục",
      "Tồn kho",
      "Giá nhập",
      "Giá bán",
      "Giá trị tồn",
      "Trạng thái",
    ],
  ];

  parts.forEach((p) => {
    const stock = p.stock[branchId] || 0;
    const costPrice = p.wholesalePrice?.[branchId] || 0;
    const sellPrice = p.retailPrice[branchId] || 0;
    const value = stock * costPrice;
    const status = stock < 10 ? "Thấp" : stock < 50 ? "Trung bình" : "Đủ";

    inventoryData.push([
      p.sku,
      p.name,
      p.category || "",
      stock,
      costPrice,
      sellPrice,
      value,
      status,
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(inventoryData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết tồn kho");

  // 3. Low stock warnings
  const lowStock = parts.filter((p) => (p.stock[branchId] || 0) < 10);
  if (lowStock.length > 0) {
    const warningData: (string | number)[][] = [
      ["Mã SKU", "Tên sản phẩm", "Tồn kho", "Ghi chú"],
    ];

    lowStock.forEach((p) => {
      warningData.push([
        p.sku,
        p.name,
        p.stock[branchId] || 0,
        "Cần nhập thêm hàng",
      ]);
    });

    const wsWarning = XLSX.utils.aoa_to_sheet(warningData);
    XLSX.utils.book_append_sheet(wb, wsWarning, "Cảnh báo tồn kho");
  }

  const fileName = `BaoCaoTonKho_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== PAYROLL REPORT ====================
export const exportPayrollReport = (
  payrollRecords: PayrollRecord[],
  startMonth: string,
  endMonth: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const totalBase = payrollRecords.reduce((sum, p) => sum + p.baseSalary, 0);
  const totalNet = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);
  const paid = payrollRecords.filter((p) => p.paymentStatus === "paid").length;
  const pending = payrollRecords.filter(
    (p) => p.paymentStatus === "pending"
  ).length;

  const summaryData = [
    ["BÁO CÁO LƯƠNG"],
    [`Từ ${startMonth} đến ${endMonth}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng lương cơ bản", formatCurrency(totalBase)],
    ["Tổng lương thực nhận", formatCurrency(totalNet)],
    ["Số bảng lương đã trả", paid],
    ["Số bảng lương chưa trả", pending],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed payroll
  const payrollData: (string | number)[][] = [
    [
      "Nhân viên",
      "Tháng",
      "Lương cơ bản",
      "Phụ cấp",
      "Thưởng",
      "Khấu trừ",
      "BHXH",
      "BHYT",
      "BHTN",
      "Thuế TNCN",
      "Thực nhận",
      "Trạng thái",
      "Ngày trả",
    ],
  ];

  payrollRecords.forEach((p) => {
    payrollData.push([
      p.employeeName,
      p.month,
      p.baseSalary,
      p.allowances,
      p.bonus,
      p.deduction,
      p.socialInsurance,
      p.healthInsurance,
      p.unemploymentInsurance,
      p.personalIncomeTax,
      p.netSalary,
      p.paymentStatus === "paid" ? "Đã trả" : "Chưa trả",
      p.paymentDate ? formatDate(p.paymentDate) : "",
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(payrollData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết lương");

  // 3. By employee summary
  const employeeMap: Record<
    string,
    { totalBase: number; totalNet: number; months: number }
  > = {};

  payrollRecords.forEach((p) => {
    if (!employeeMap[p.employeeName]) {
      employeeMap[p.employeeName] = { totalBase: 0, totalNet: 0, months: 0 };
    }
    employeeMap[p.employeeName].totalBase += p.baseSalary;
    employeeMap[p.employeeName].totalNet += p.netSalary;
    employeeMap[p.employeeName].months += 1;
  });

  const employeeData: (string | number)[][] = [
    [
      "Nhân viên",
      "Số tháng",
      "Tổng lương cơ bản",
      "Tổng thực nhận",
      "TB/tháng",
    ],
  ];

  Object.entries(employeeMap).forEach(([name, data]) => {
    employeeData.push([
      name,
      data.months,
      data.totalBase,
      data.totalNet,
      Math.round(data.totalNet / data.months),
    ]);
  });

  const wsEmployee = XLSX.utils.aoa_to_sheet(employeeData);
  XLSX.utils.book_append_sheet(wb, wsEmployee, "Theo nhân viên");

  const fileName = `BaoCaoLuong_${startMonth}_${endMonth}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== DEBT REPORT ====================
export const exportDebtReport = (
  customers: Customer[],
  suppliers: Supplier[],
  sales: Sale[],
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // For now, create simple customer/supplier lists
  // In real app, you'd track actual debt amounts

  // 1. Summary
  const summaryData = [
    ["BÁO CÁO CÔNG NỢ"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Loại", "Số lượng"],
    ["Khách hàng", customers.length],
    ["Nhà cung cấp", suppliers.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Customers
  const customerData = [
    ["Tên khách hàng", "SĐT", "Xe", "Biển số", "Phân khúc"],
  ];

  customers.forEach((c) => {
    customerData.push([
      c.name,
      c.phone || "",
      c.vehicleModel || "",
      c.licensePlate || "",
      c.segment || "",
    ]);
  });

  const wsCustomers = XLSX.utils.aoa_to_sheet(customerData);
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Khách hàng");

  // 3. Suppliers
  const supplierData = [["Tên nhà cung cấp", "SĐT", "Email", "Địa chỉ"]];

  suppliers.forEach((s) => {
    supplierData.push([s.name, s.phone || "", s.email || "", s.address || ""]);
  });

  const wsSuppliers = XLSX.utils.aoa_to_sheet(supplierData);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Nhà cung cấp");

  const fileName = `BaoCaoCongNo_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
