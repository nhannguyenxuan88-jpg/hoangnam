import React, { createContext, useContext, useState, useCallback } from "react";
import type {
  Part,
  Customer,
  Sale,
  CartItem,
  WorkOrder,
  PaymentSource,
  CashTransaction,
  InventoryTransaction
} from "../types";

interface AppContextType {
  parts: Part[];
  customers: Customer[];
  sales: Sale[];
  workOrders: WorkOrder[];
  cartItems: CartItem[];
  paymentSources: PaymentSource[];
  cashTransactions: CashTransaction[];
  inventoryTransactions: InventoryTransaction[];
  currentBranchId: string;
  // setters / mutators
  setParts: React.Dispatch<React.SetStateAction<Part[]>>;
  upsertPart: (part: Partial<Part> & { id?: string }) => void;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  upsertCustomer: (customer: Partial<Customer> & { id?: string }) => void;
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  upsertWorkOrder: (order: WorkOrder) => void;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
  finalizeSale: (data: {
    items: CartItem[];
    discount: number;
    paymentMethod: "cash" | "bank";
    customer: { id?: string; name: string; phone?: string };
    note?: string;
  }) => void;
  setPaymentSources: React.Dispatch<React.SetStateAction<PaymentSource[]>>;
  setCashTransactions: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  recordInventoryTransaction: (tx: Omit<InventoryTransaction, "id">) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State ---
  const [currentBranchId] = useState("main");
  const [parts, setParts] = useState<Part[]>(() => []);
  const [customers, setCustomers] = useState<Customer[]>(() => []);
  const [sales, setSales] = useState<Sale[]>(() => []);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => []);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => []);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>(() => [
    { id: "cash", name: "Tiền mặt", balance: { main: 0 }, isDefault: true },
    { id: "bank", name: "Tài khoản ngân hàng", balance: { main: 0 } }
  ]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(() => []);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>(() => []);

  // --- Helpers ---
  const upsertPart = useCallback((part: Partial<Part> & { id?: string }) => {
    setParts(prev => {
      if (part.id) {
        return prev.map(p => (p.id === part.id ? { ...p, ...part } as Part : p));
      }
      const id = `PART-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newPart: Part = {
        id,
        name: part.name || "Tên phụ tùng",
        sku: part.sku || id,
        stock: part.stock || { [currentBranchId]: 0 },
        retailPrice: part.retailPrice || { [currentBranchId]: 0 },
        wholesalePrice: part.wholesalePrice || { [currentBranchId]: 0 },
        category: part.category,
        description: part.description,
        warrantyPeriod: part.warrantyPeriod,
        created_at: new Date().toISOString()
      };
      return [newPart, ...prev];
    });
  }, [currentBranchId]);

  const upsertCustomer = useCallback((customer: Partial<Customer> & { id?: string }) => {
    setCustomers(prev => {
      if (customer.id) {
        return prev.map(c => (c.id === customer.id ? { ...c, ...customer } as Customer : c));
      }
      const id = `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newCustomer: Customer = {
        id,
        name: customer.name || "Khách hàng",
        phone: customer.phone,
        created_at: new Date().toISOString()
      };
      return [newCustomer, ...prev];
    });
  }, []);

  const upsertWorkOrder = useCallback((order: WorkOrder) => {
    setWorkOrders(prev => {
      const existing = prev.find(w => w.id === order.id);
      if (existing) {
        return prev.map(w => w.id === order.id ? order : w);
      }
      return [order, ...prev];
    });
  }, []);

  const clearCart = useCallback(() => setCartItems([]), []);

  const finalizeSale = useCallback((data: {
    items: CartItem[];
    discount: number;
    paymentMethod: "cash" | "bank";
    customer: { id?: string; name: string; phone?: string };
    note?: string;
  }) => {
    if (!data.items.length) return;
    // Compute subtotal and per-line discounts if present
    const lineSubtotal = data.items.reduce((sum, it) => sum + it.sellingPrice * it.quantity, 0);
    const lineDiscounts = data.items.reduce((sum, it) => sum + (it.discount || 0), 0);
    const total = lineSubtotal - lineDiscounts - data.discount;
    const saleId = `SALE-${Date.now()}`;
    const newSale: Sale = {
      id: saleId,
      date: new Date().toISOString(),
      items: data.items,
      subtotal: lineSubtotal,
      discount: data.discount + lineDiscounts,
      total,
      customer: data.customer,
      paymentMethod: data.paymentMethod,
      userId: "local-user",
      userName: "Local User",
      branchId: currentBranchId,
      cashTransactionId: undefined
    };
    setSales(prev => [newSale, ...prev]);

    // Adjust part stock
    setParts(prev => prev.map(p => {
      const soldQty = data.items.filter(i => i.partId === p.id).reduce((s, i) => s + i.quantity, 0);
      if (!soldQty) return p;
      return {
        ...p,
        stock: {
          ...p.stock,
          [currentBranchId]: (p.stock[currentBranchId] || 0) - soldQty
        }
      };
    }));

    // Record cash transaction
    const ctId = `CT-${Date.now()}`;
    const cashTx: CashTransaction = {
      id: ctId,
      type: "income",
      date: new Date().toISOString(),
      amount: total,
      notes: data.note || "Thu tiền bán hàng",
      paymentSourceId: data.paymentMethod,
      branchId: currentBranchId,
      category: "sale_income",
      saleId
    };
    setCashTransactions(prev => [cashTx, ...prev]);

    // Update payment source balance
    setPaymentSources(prev => prev.map(ps => ps.id === data.paymentMethod ? {
      ...ps,
      balance: {
        ...ps.balance,
        [currentBranchId]: (ps.balance[currentBranchId] || 0) + total
      }
    } : ps));

    clearCart();
  }, [clearCart, currentBranchId]);

  const recordInventoryTransaction = useCallback((tx: Omit<InventoryTransaction, "id">) => {
    const id = `INV-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const full: InventoryTransaction = { id, ...tx };
    setInventoryTransactions(prev => [full, ...prev]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        parts,
        customers,
        sales,
        workOrders,
        cartItems,
        paymentSources,
        cashTransactions,
        inventoryTransactions,
        currentBranchId,
        setParts,
        upsertPart,
        setCustomers,
        upsertCustomer,
        setWorkOrders,
        upsertWorkOrder,
        setCartItems,
        clearCart,
        finalizeSale,
        setPaymentSources,
        setCashTransactions,
        recordInventoryTransaction
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext phải dùng bên trong AppProvider");
  return ctx;
};
