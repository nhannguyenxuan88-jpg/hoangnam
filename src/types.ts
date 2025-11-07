// Core session/user placeholder
export interface UserSession {
  id: string;
  email: string;
  name?: string;
}

// Domain Types (subset adapted from original repo for standalone needs)
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  created_at?: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  // Stock & pricing are branch-mapped for multi-branch future extension
  stock: { [branchId: string]: number };
  retailPrice: { [branchId: string]: number };
  wholesalePrice?: { [branchId: string]: number };
  category?: string;
  description?: string;
  warrantyPeriod?: string;
  created_at?: string;
}

export interface CartItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  sellingPrice: number; // Final unit price after selecting retail/wholesale
  stockSnapshot: number; // Stock at time added for validation
  discount?: number; // Per-line discount (absolute)
}

export interface Sale {
  id: string;
  date: string; // ISO
  items: CartItem[];
  subtotal: number; // Sum of (sellingPrice * quantity) before discounts
  discount: number; // Order-level discount (absolute)
  total: number; // subtotal - discount - sum(per-line discounts) if applied
  customer: { id?: string; name: string; phone?: string };
  paymentMethod: "cash" | "bank";
  userId: string; // snapshot user
  userName: string;
  branchId: string;
  cashTransactionId?: string; // link to recorded cash transaction
}

export interface WorkOrderPart {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  price: number; // Selling price snapshot
}

export interface WorkOrder {
  id: string;
  creationDate: string; // ISO
  customerName: string;
  customerPhone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  issueDescription?: string;
  technicianName?: string;
  status: "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";
  laborCost: number;
  discount?: number; // Order level discount
  partsUsed?: WorkOrderPart[];
  notes?: string;
  total: number; // labor + parts - discount
  branchId: string;
  
  // Deposit (Đặt cọc)
  depositAmount?: number; // Số tiền đặt cọc
  depositDate?: string; // Ngày đặt cọc
  depositTransactionId?: string; // Link to deposit transaction
  
  // Payment (Thanh toán)
  paymentStatus?: "unpaid" | "paid" | "partial";
  paymentMethod?: "cash" | "bank";
  additionalPayment?: number; // Số tiền thanh toán thêm khi trả xe
  totalPaid?: number; // Tổng đã trả = depositAmount + additionalPayment
  remainingAmount?: number; // Còn nợ = total - totalPaid
  paymentDate?: string;
  cashTransactionId?: string; // Link to final payment transaction
}

export interface InventoryTransaction {
  id: string;
  type: "Nhập kho" | "Xuất kho";
  partId: string;
  partName: string;
  quantity: number;
  date: string;
  unitPrice?: number; // for nhập kho (cost)
  totalPrice: number;
  branchId: string;
  notes?: string;
  saleId?: string;
  workOrderId?: string;
}

export interface PaymentSource {
  id: string; // e.g. 'cash', 'bank'
  name: string;
  balance: { [branchId: string]: number };
  isDefault?: boolean;
}

export type CashTransactionCategory =
  | "sale_income"
  | "service_income"
  | "other_income"
  | "inventory_purchase"
  | "sale_refund"
  | "other_expense";

export interface CashTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  notes: string;
  paymentSourceId: string;
  branchId: string;
  category?: CashTransactionCategory;
  saleId?: string;
  workOrderId?: string;
}

// High-level app state snapshot (not strictly used by context but handy)
export interface AppState {
  user: UserSession | null;
  customers: Customer[];
  parts: Part[];
  sales: Sale[];
  workOrders: WorkOrder[];
  cartItems: CartItem[];
  paymentSources: PaymentSource[];
  cashTransactions: CashTransaction[];
}
