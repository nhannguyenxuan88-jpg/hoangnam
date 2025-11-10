import * as XLSX from "xlsx";
import type { Part } from "../types";

/**
 * Export parts to Excel file
 */
export const exportPartsToExcel = (
  parts: Part[],
  currentBranchId: string,
  filename: string = "inventory-export.xlsx"
) => {
  // Prepare data for export
  const data = parts.map((part, index) => ({
    STT: index + 1,
    "Tên sản phẩm": part.name,
    SKU: part.sku,
    "Danh mục": part.category || "",
    "Tồn kho": part.stock[currentBranchId] || 0,
    "Giá bán lẻ": part.retailPrice[currentBranchId] || 0,
    "Giá bán sỉ": part.wholesalePrice?.[currentBranchId] || 0,
    "Giá trị tồn":
      (part.stock[currentBranchId] || 0) *
      (part.retailPrice[currentBranchId] || 0),
    "Mô tả": part.description || "",
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 }, // STT
    { wch: 30 }, // Tên sản phẩm
    { wch: 15 }, // SKU
    { wch: 20 }, // Danh mục
    { wch: 10 }, // Tồn kho
    { wch: 15 }, // Giá bán lẻ
    { wch: 15 }, // Giá bán sỉ
    { wch: 15 }, // Giá trị tồn
    { wch: 40 }, // Mô tả
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tồn kho");

  // Save file
  XLSX.writeFile(wb, filename);
};

/**
 * Export inventory template for import
 */
export const exportInventoryTemplate = (
  filename: string = "inventory-template.xlsx"
) => {
  const templateData = [
    {
      "Tên sản phẩm": "VD: Nhớt Motul 7100 10W40",
      SKU: "MOTUL-7100",
      "Danh mục": "Nhớt động cơ",
      "Số lượng nhập": 50,
      "Giá bán lẻ": 180000,
      "Giá bán sỉ": 150000,
      "Mô tả": "Nhớt cao cấp cho xe côn tay",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  ws["!cols"] = [
    { wch: 30 }, // Tên sản phẩm
    { wch: 15 }, // SKU
    { wch: 20 }, // Danh mục
    { wch: 15 }, // Số lượng nhập
    { wch: 15 }, // Giá bán lẻ
    { wch: 15 }, // Giá bán sỉ
    { wch: 40 }, // Mô tả
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");

  XLSX.writeFile(wb, filename);
};

/**
 * Import parts from Excel/CSV file
 */
export const importPartsFromExcel = (
  file: File,
  currentBranchId: string
): Promise<
  Array<{
    name: string;
    sku: string;
    category?: string;
    quantity: number;
    retailPrice: number;
    wholesalePrice: number;
    description?: string;
  }>
> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Helpers: normalize keys and parse numbers robustly
        const stripDiacritics = (s: string) =>
          s
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/đ/gi, (m) => (m === "đ" ? "d" : "D"));
        const norm = (s: string) =>
          stripDiacritics(String(s).toLowerCase().trim()).replace(
            /[^a-z0-9]+/g,
            ""
          );
        const parseNum = (v: any) => {
          if (v == null || v === "") return 0;
          if (typeof v === "number") return v;
          let t = String(v).trim();
          // remove spaces
          t = t.replace(/\s+/g, "");
          // if both dot and comma exist, assume dot is thousands and comma decimal
          if (t.includes(".") && t.includes(",")) {
            t = t.replace(/\./g, "").replace(/,/g, ".");
          } else if (t.includes(",") && !t.includes(".")) {
            // only comma present -> treat comma as decimal
            t = t.replace(/,/g, ".");
          } else {
            // only dot or none -> remove thousands commas just in case
            t = t.replace(/,/g, "");
          }
          const n = parseFloat(t);
          return isNaN(n) ? 0 : n;
        };

        // Build a per-row accessor that tolerates various header names
        const synonyms: Record<string, string[]> = {
          name: [
            "tensanpham",
            "ten",
            "productname",
            "name",
            "tenhang",
            "tenmh",
          ],
          sku: ["sku", "mahang", "mah", "code", "ma", "masp", "mavt"],
          category: ["danhmuc", "nhom", "loai", "category"],
          quantity: ["soluongnhap", "soluong", "ton", "tonkho", "sl", "qty"],
          retailPrice: [
            "giabanle",
            "giale",
            "giaban",
            "gia",
            "retailprice",
            "giabanra",
          ],
          wholesalePrice: ["giabansi", "giasi", "wholesaleprice", "giabuon"],
          description: ["mota", "ghichu", "note", "description"],
        };

        const parts = jsonData.map((rowAny: any) => {
          const row: Record<string, any> = rowAny || {};
          // Create a lookup map of normalized header -> value
          const dict: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            dict[norm(k)] = row[k];
          });
          const get = (key: keyof typeof synonyms, fallback?: any) => {
            for (const alias of synonyms[key]) {
              const v = dict[alias];
              if (v != null && v !== "") return v;
            }
            return fallback;
          };

          const name = String(get("name", "")).trim();
          const sku = String(get("sku", "")).trim();
          const category = get("category");
          const quantity = parseNum(get("quantity", 0));
          const retailPrice = parseNum(get("retailPrice", 0));
          const wholesalePrice = parseNum(get("wholesalePrice", 0));
          const description = get("description");

          if (!name || !sku) {
            throw new Error(
              `Dòng thiếu thông tin bắt buộc: Tên sản phẩm hoặc SKU`
            );
          }

          return {
            name,
            sku,
            category,
            quantity,
            retailPrice,
            wholesalePrice,
            description,
          };
        });

        resolve(parts);
      } catch (error) {
        // Surface helpful message
        const msg =
          error instanceof Error ? error.message : "Không đọc được dữ liệu";
        reject(new Error(msg));
      }
    };

    reader.onerror = () => {
      reject(new Error("Lỗi đọc file"));
    };

    reader.readAsBinaryString(file);
  });
};
