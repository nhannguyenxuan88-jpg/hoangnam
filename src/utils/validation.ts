export interface PriceQtyValidationResult {
  ok: boolean;
  warnings: string[];
  clean: { importPrice: number; quantity: number };
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const MAX_PRICE = 50_000_000; // 50 triệu
const MAX_QTY = 10_000;

export function validatePriceAndQty(
  importPrice: number,
  quantity: number
): PriceQtyValidationResult {
  const warnings: string[] = [];
  let price = Math.max(0, Math.round(importPrice));
  let qty = Math.max(0, Math.round(quantity));
  if (price > MAX_PRICE) {
    warnings.push("Giá nhập quá lớn (>50 triệu) đã được giới hạn.");
    price = MAX_PRICE;
  }
  if (qty > MAX_QTY) {
    warnings.push("Số lượng quá lớn (>10,000) đã được giới hạn.");
    qty = MAX_QTY;
  }
  return { ok: true, warnings, clean: { importPrice: price, quantity: qty } };
}

/**
 * Validate Vietnamese phone number format
 * Accepts: 0xxxxxxxxx (10 digits) or 0xxxxxxxxxx (11 digits) or +84xxxxxxxxx
 */
export function validatePhoneNumber(phone: string): ValidationResult {
  if (!phone || !phone.trim()) {
    return { ok: false, error: "Số điện thoại không được để trống" };
  }

  const cleaned = phone.trim().replace(/\s+/g, "");
  const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;

  if (!phoneRegex.test(cleaned)) {
    return {
      ok: false,
      error:
        "Số điện thoại không hợp lệ. Vui lòng nhập 10-11 số (VD: 0912345678)",
    };
  }

  return { ok: true };
}

/**
 * Validate stock quantity before sale
 */
export function validateStockQuantity(
  requestedQty: number,
  availableStock: number,
  productName: string
): ValidationResult {
  if (requestedQty <= 0) {
    return { ok: false, error: "Số lượng phải lớn hơn 0" };
  }

  if (requestedQty > availableStock) {
    return {
      ok: false,
      error: `Không đủ hàng! ${productName}: Tồn kho ${availableStock}, yêu cầu ${requestedQty}`,
    };
  }

  return { ok: true };
}

/**
 * Validate deposit amount (must not exceed total)
 */
export function validateDepositAmount(
  depositAmount: number,
  totalAmount: number
): ValidationResult {
  if (depositAmount < 0) {
    return { ok: false, error: "Tiền đặt cọc không được âm" };
  }

  if (depositAmount > totalAmount) {
    return {
      ok: false,
      error: `Tiền đặt cọc không được lớn hơn tổng tiền (${formatCurrency(
        totalAmount
      )})`,
    };
  }

  return { ok: true };
}

/**
 * Validate discount (must not exceed subtotal)
 */
export function validateDiscount(
  discountAmount: number,
  subtotal: number
): ValidationResult {
  if (discountAmount < 0) {
    return { ok: false, error: "Giảm giá không được âm" };
  }

  if (discountAmount > subtotal) {
    return {
      ok: false,
      error: `Giảm giá không được lớn hơn tổng tiền hàng (${formatCurrency(
        subtotal
      )})`,
    };
  }

  return { ok: true };
}

/**
 * Validate license plate (Vietnamese format)
 */
export function validateLicensePlate(plate: string): ValidationResult {
  if (!plate || !plate.trim()) {
    return { ok: true }; // Optional field
  }

  const cleaned = plate.trim().toUpperCase();
  // Vietnamese license plate: XX-YYY.ZZ or XX-YYYY.ZZ (X=number, Y=letter/number, Z=number)
  const plateRegex = /^[0-9]{2}[A-Z]{1,2}[-\s]?[0-9A-Z]{3,5}(\.[0-9]{2})?$/i;

  if (!plateRegex.test(cleaned)) {
    return {
      ok: false,
      error: "Biển số không hợp lệ. VD: 29A-12345, 51H-123.45",
    };
  }

  return { ok: true };
}

// Helper function for currency formatting (if not imported)
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}
