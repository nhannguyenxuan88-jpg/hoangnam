import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import {
  BarChart3,
  Boxes,
  ShoppingCart,
  CreditCard,
  Banknote,
  Star,
  MapPin,
  Printer,
  CalendarDays,
  Receipt,
  ScanLine,
  History,
  Plus,
  Share2,
  Download,
  Zap,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import {
  useSalesRepo,
  useSalesPagedRepo,
  useCreateSaleAtomicRepo,
  UseSalesPagedParams,
} from "../../hooks/useSalesRepository";
import { useLowStock } from "../../hooks/useLowStock";
import { formatCurrency, formatDate, formatAnyId } from "../../utils/format";
import { printElementById } from "../../utils/print";
import { showToast } from "../../utils/toast";
import { PlusIcon, XMarkIcon } from "../Icons";
import type { CartItem, Part, Customer, Sale } from "../../types";
import { safeAudit } from "../../lib/repository/auditLogsRepository";
import { supabase } from "../../supabaseClient";
import {
  useCreateCustomerDebtRepo,
  useCustomerDebtsRepo,
} from "../../hooks/useDebtsRepository";
import { useCustomers, useCreateCustomer } from "../../hooks/useSupabase";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import QuickServiceModal from "./QuickServiceModal";
import { NumberInput } from "../common/NumberInput";
import type { QuickService } from "../../hooks/useQuickServices";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
}

type StockFilter = "all" | "low" | "out";

const LOW_STOCK_THRESHOLD = 5;

// Sale Detail Modal Component (for viewing/editing sale details)
import { SaleDetailModal } from "./modals/SaleDetailModal";

// Edit Sale Modal Component
import { EditSaleModal } from "./modals/EditSaleModal";

// Sales History Modal Component (refactored to accept pagination & search props)
import { SalesHistoryModal } from "./modals/SalesHistoryModal";

const SalesManager: React.FC = () => {
  const {
    upsertCustomer,
    cartItems,
    setCartItems,
    clearCart,
    deleteSale,
    currentBranchId,
    finalizeSale,
    setCashTransactions,
    setPaymentSources,
  } = useAppContext();

  const queryClient = useQueryClient();

  // Fetch customers from Supabase
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const createCustomerMutation = useCreateCustomer();

  // Repository (read-only step 1)
  const {
    data: repoParts = [],
    isLoading: loadingParts,
    error: partsError,
  } = usePartsRepo();

  // Fetch customer debts to check payment status
  const { data: customerDebts = [] } = useCustomerDebtsRepo();

  // Server-side sales pagination parameters
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(20);
  const [salesSearchInput, setSalesSearchInput] = useState("");
  const [salesSearch, setSalesSearch] = useState("");
  const [salesFromDate, setSalesFromDate] = useState<string | undefined>();
  const [salesToDate, setSalesToDate] = useState<string | undefined>();
  const [salesStatus, setSalesStatus] = useState<
    "all" | "completed" | "cancelled" | "refunded"
  >("all");
  const [salesPaymentMethod, setSalesPaymentMethod] = useState<
    "all" | "cash" | "bank"
  >("all");
  const [useKeysetMode, setUseKeysetMode] = useState(false);
  const [keysetCursor, setKeysetCursor] = useState<{
    afterDate?: string;
    afterId?: string;
  } | null>(null);
  const salesParams: UseSalesPagedParams = {
    branchId: currentBranchId,
    page: useKeysetMode ? undefined : salesPage,
    pageSize: salesPageSize,
    search: salesSearch || undefined,
    fromDate: salesFromDate,
    toDate: salesToDate,
    mode: useKeysetMode ? "keyset" : "offset",
    afterDate: useKeysetMode ? keysetCursor?.afterDate : undefined,
    afterId: useKeysetMode ? keysetCursor?.afterId : undefined,
    status:
      salesStatus === "all"
        ? undefined
        : salesStatus === "cancelled"
          ? "refunded"
          : salesStatus === "completed"
            ? "completed"
            : salesStatus,
    paymentMethod:
      salesPaymentMethod === "all" ? undefined : salesPaymentMethod,
  };
  const {
    data: pagedSalesData,
    isLoading: loadingSales,
    error: salesError,
  } = useSalesPagedRepo(salesParams);
  const repoSales = pagedSalesData?.data || [];
  const salesMeta = pagedSalesData?.meta || {
    page: 1,
    totalPages: 1,
    total: repoSales.length,
    hasMore: false,
  };
  // Advance keyset cursor when in keyset mode and new page loaded
  useEffect(() => {
    if (useKeysetMode && pagedSalesData?.meta?.mode === "keyset") {
      setKeysetCursor({
        afterDate: (pagedSalesData.meta as any).nextAfterDate,
        afterId: (pagedSalesData.meta as any).nextAfterId,
      });
    }
  }, [useKeysetMode, pagedSalesData]);
  const { mutateAsync: createSaleAtomicAsync } = useCreateSaleAtomicRepo();
  const createCustomerDebt = useCreateCustomerDebtRepo();

  // Pagination handlers
  const goPrevPage = useCallback(
    () => setSalesPage((p) => Math.max(1, p - 1)),
    []
  );
  const goNextPage = useCallback(() => setSalesPage((p) => p + 1), []);
  const changePageSize = useCallback((sz: number) => {
    setSalesPageSize(sz);
    setSalesPage(1);
    if (useKeysetMode) setKeysetCursor(null);
  }, []);

  // Debounce search (300ms) áp dụng vào tham số query
  useEffect(() => {
    const h = setTimeout(() => {
      setSalesSearch(salesSearchInput);
      setSalesPage(1);
    }, 300);
    return () => clearTimeout(h);
  }, [salesSearchInput]);
  // States
  const [partSearch, setPartSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  // Mobile tab state - 3 tabs: products, cart, history
  const [mobileTab, setMobileTab] = useState<"products" | "cart" | "history">(
    "products"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  ); // VNĐ or %
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showQuickServiceModal, setShowQuickServiceModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    vehicleModel: "",
    licensePlate: "",
  });
  const [receiptId, setReceiptId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);
  const [receiptDiscount, setReceiptDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentType, setPaymentType] = useState<
    "full" | "partial" | "note" | null
  >(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [showOrderNote, setShowOrderNote] = useState(false);
  const [customSaleTime, setCustomSaleTime] = useState("");
  const [orderNote, setOrderNote] = useState("");

  useEffect(() => {
    if (showBarcodeInput) {
      barcodeInputRef.current?.focus();
    }
  }, [showBarcodeInput]);

  // Print preview states
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  // Fetch store settings on mount
  useEffect(() => {
    const fetchStoreSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("store_settings")
          .select(
            "store_name, address, phone, email, logo_url, bank_qr_url, bank_name, bank_account_number, bank_account_holder, bank_branch"
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.error("Error fetching store settings:", error);
          return;
        }

        setStoreSettings(data);
      } catch (err) {
        console.error("Failed to fetch store settings:", err);
      }
    };

    fetchStoreSettings();
  }, []);

  // Cart functions
  const addToCart = useCallback(
    (part: Part) => {
      const price = part.retailPrice?.[currentBranchId] ?? 0;
      const stock = part.stock?.[currentBranchId] ?? 0;
      const existing = cartItems.find((item) => item.partId === part.id);

      if (existing) {
        // Validate stock before adding more
        const newQuantity = existing.quantity + 1;
        if (newQuantity > stock) {
          showToast.error(`Không đủ hàng! Tồn kho: ${stock}`);
          return;
        }
        setCartItems((prev) =>
          prev.map((item) =>
            item.partId === part.id ? { ...item, quantity: newQuantity } : item
          )
        );
      } else {
        // Check if stock available
        if (stock < 1) {
          showToast.error("Sản phẩm đã hết hàng!");
          return;
        }
        const newItem: CartItem = {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          sellingPrice: price,
          stockSnapshot: stock,
          discount: 0,
        };
        setCartItems((prev) => [...prev, newItem]);
      }
    },
    [cartItems, setCartItems, currentBranchId]
  );

  const removeFromCart = useCallback(
    (partId: string) => {
      setCartItems((prev) => prev.filter((item) => item.partId !== partId));
    },
    [setCartItems]
  );

  const updateCartQuantity = useCallback(
    (partId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(partId);
        return;
      }

      // Validate against stock
      const item = cartItems.find((i) => i.partId === partId);
      if (item && quantity > item.stockSnapshot) {
        showToast.error(`Không đủ hàng! Tồn kho: ${item.stockSnapshot}`);
        return;
      }

      setCartItems((prev) =>
        prev.map((item) =>
          item.partId === partId ? { ...item, quantity } : item
        )
      );
    },
    [cartItems, setCartItems, removeFromCart]
  );

  // Cập nhật giá bán trong giỏ hàng
  const updateCartPrice = useCallback(
    (partId: string, newPrice: number) => {
      if (newPrice < 0) {
        showToast.error("Giá không được âm!");
        return;
      }
      setCartItems((prev) =>
        prev.map((item) =>
          item.partId === partId ? { ...item, sellingPrice: newPrice } : item
        )
      );
    },
    [setCartItems]
  );

  // Calculate totals
  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const total = useMemo(
    () => Math.max(0, subtotal - orderDiscount),
    [subtotal, orderDiscount]
  );

  const cartItemById = useMemo(() => {
    const map = new Map<string, CartItem>();
    cartItems.forEach((item) => map.set(item.partId, item));
    return map;
  }, [cartItems]);

  // Category color mapping for visual distinction
  const getCategoryColor = (category: string | undefined) => {
    if (!category)
      return {
        bg: "bg-slate-100 dark:bg-slate-700",
        text: "text-slate-500 dark:text-slate-400",
      };

    const colors: Record<string, { bg: string; text: string }> = {
      // Nhớt, dầu
      Nhớt: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
      },
      Dầu: {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400",
      },
      // Lọc
      Lọc: {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      "Lọc gió": {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      "Lọc nhớt": {
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        text: "text-cyan-700 dark:text-cyan-400",
      },
      // Bugi
      Bugi: {
        bg: "bg-rose-100 dark:bg-rose-900/30",
        text: "text-rose-700 dark:text-rose-400",
      },
      // Phanh
      Phanh: {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
      "Má phanh": {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-400",
      },
      // Xích, sên
      Xích: {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      Sên: {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      "Nhông sên dĩa": {
        bg: "bg-zinc-200 dark:bg-zinc-700/50",
        text: "text-zinc-700 dark:text-zinc-300",
      },
      // Lốp, vỏ
      Lốp: {
        bg: "bg-slate-700 dark:bg-slate-600",
        text: "text-white dark:text-slate-100",
      },
      "Vỏ xe": {
        bg: "bg-slate-700 dark:bg-slate-600",
        text: "text-white dark:text-slate-100",
      },
      // Ắc quy
      "Ắc quy": {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
      },
      "Bình điện": {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-400",
      },
      // Đèn
      Đèn: {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      "Bóng đèn": {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      // Phụ tùng điện
      Điện: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
      },
      IC: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
      },
      // Gioăng, ron
      Gioăng: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-700 dark:text-orange-400",
      },
      Ron: {
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-700 dark:text-orange-400",
      },
      // Vòng bi
      "Vòng bi": {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      "Bạc đạn": {
        bg: "bg-indigo-100 dark:bg-indigo-900/30",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      // Cao su
      "Cao su": {
        bg: "bg-stone-200 dark:bg-stone-700/50",
        text: "text-stone-700 dark:text-stone-300",
      },
      // Phụ kiện
      "Phụ kiện": {
        bg: "bg-purple-100 dark:bg-purple-900/30",
        text: "text-purple-700 dark:text-purple-400",
      },
      // === THƯƠNG HIỆU / HÃNG XE === (màu nhạt, dễ nhìn)
      // Honda - Đỏ nhạt
      Honda: {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-700 dark:text-red-400",
      },
      // Yamaha - Xanh dương nhạt
      Yamaha: {
        bg: "bg-blue-100 dark:bg-blue-900/40",
        text: "text-blue-700 dark:text-blue-400",
      },
      // Suzuki - Xanh dương đậm nhạt
      Suzuki: {
        bg: "bg-blue-200 dark:bg-blue-900/50",
        text: "text-blue-800 dark:text-blue-300",
      },
      // SYM - Xanh sky nhạt
      SYM: {
        bg: "bg-sky-100 dark:bg-sky-900/40",
        text: "text-sky-700 dark:text-sky-400",
      },
      // Piaggio/Vespa - Xanh emerald nhạt
      Piaggio: {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-700 dark:text-emerald-400",
      },
      Vespa: {
        bg: "bg-emerald-100 dark:bg-emerald-900/40",
        text: "text-emerald-700 dark:text-emerald-400",
      },
      // Kymco - Cam nhạt
      Kymco: {
        bg: "bg-orange-100 dark:bg-orange-900/40",
        text: "text-orange-700 dark:text-orange-400",
      },
      // === THƯƠNG HIỆU PHỤ TÙNG ===
      // NGK - Xanh lá nhạt
      NGK: {
        bg: "bg-green-100 dark:bg-green-900/40",
        text: "text-green-700 dark:text-green-400",
      },
      // Denso - Hồng nhạt
      Denso: {
        bg: "bg-rose-100 dark:bg-rose-900/40",
        text: "text-rose-700 dark:text-rose-400",
      },
      DENSO: {
        bg: "bg-rose-100 dark:bg-rose-900/40",
        text: "text-rose-700 dark:text-rose-400",
      },
      // Kenda - Vàng amber nhạt
      Kenda: {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-700 dark:text-amber-400",
      },
      // IRC - Tím nhạt
      IRC: {
        bg: "bg-violet-100 dark:bg-violet-900/40",
        text: "text-violet-700 dark:text-violet-400",
      },
      "IRC Tire": {
        bg: "bg-violet-100 dark:bg-violet-900/40",
        text: "text-violet-700 dark:text-violet-400",
      },
      // Michelin - Xanh đậm nhạt
      Michelin: {
        bg: "bg-indigo-100 dark:bg-indigo-900/40",
        text: "text-indigo-700 dark:text-indigo-400",
      },
      // Dunlop - Vàng nhạt
      Dunlop: {
        bg: "bg-yellow-100 dark:bg-yellow-900/40",
        text: "text-yellow-700 dark:text-yellow-400",
      },
      // Castrol - Xanh lá nhạt
      Castrol: {
        bg: "bg-lime-100 dark:bg-lime-900/40",
        text: "text-lime-700 dark:text-lime-400",
      },
      // Shell - Vàng nhạt
      Shell: {
        bg: "bg-amber-100 dark:bg-amber-900/40",
        text: "text-amber-700 dark:text-amber-400",
      },
      // Motul - Đỏ nhạt
      Motul: {
        bg: "bg-red-100 dark:bg-red-900/40",
        text: "text-red-700 dark:text-red-400",
      },
      // Bosch - Xám nhạt
      Bosch: {
        bg: "bg-slate-200 dark:bg-slate-700/50",
        text: "text-slate-700 dark:text-slate-300",
      },
      // Default
      Khác: {
        bg: "bg-slate-100 dark:bg-slate-700",
        text: "text-slate-600 dark:text-slate-400",
      },
    };

    // Try exact match first
    if (colors[category]) return colors[category];

    // Try partial match
    const lowerCat = category.toLowerCase();
    for (const [key, value] of Object.entries(colors)) {
      if (
        lowerCat.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(lowerCat)
      ) {
        return value;
      }
    }

    // Generate consistent color based on category string hash
    const hashColors = [
      {
        bg: "bg-pink-100 dark:bg-pink-900/30",
        text: "text-pink-700 dark:text-pink-400",
      },
      {
        bg: "bg-violet-100 dark:bg-violet-900/30",
        text: "text-violet-700 dark:text-violet-400",
      },
      {
        bg: "bg-teal-100 dark:bg-teal-900/30",
        text: "text-teal-700 dark:text-teal-400",
      },
      {
        bg: "bg-lime-100 dark:bg-lime-900/30",
        text: "text-lime-700 dark:text-lime-400",
      },
      {
        bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30",
        text: "text-fuchsia-700 dark:text-fuchsia-400",
      },
      {
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-700 dark:text-emerald-400",
      },
    ];
    const hash = category
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return hashColors[hash % hashColors.length];
  };

  // Receipt calculations
  const receiptSubtotal = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0
      ),
    [receiptItems]
  );

  const receiptTotal = useMemo(
    () => Math.max(0, receiptSubtotal - receiptDiscount),
    [receiptSubtotal, receiptDiscount]
  );

  const receiptTotalQuantity = useMemo(
    () => receiptItems.reduce((sum, item) => sum + item.quantity, 0),
    [receiptItems]
  );

  // Filter parts by search and limit to 20 items for performance
  const filteredParts = useMemo(() => {
    if (loadingParts || partsError) return [];
    let filtered = repoParts;

    if (partSearch) {
      filtered = filtered.filter(
        (part) =>
          part.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          part.sku.toLowerCase().includes(partSearch.toLowerCase())
      );
    }

    return filtered;
  }, [repoParts, partSearch, loadingParts, partsError]);

  const displayedParts = useMemo(() => {
    if (!filteredParts.length) return [];

    const normalized = filteredParts.filter((part) => {
      const branchStock = Number(part.stock?.[currentBranchId] ?? 0);
      if (stockFilter === "low") {
        return branchStock > 0 && branchStock <= LOW_STOCK_THRESHOLD;
      }
      if (stockFilter === "out") {
        return branchStock <= 0;
      }
      return true;
    });

    const weight = (stock: number) => {
      if (stock <= 0) return 2;
      if (stock <= LOW_STOCK_THRESHOLD) return 1;
      return 0;
    };

    return normalized
      .slice()
      .sort((a, b) => {
        const aStock = Number(a.stock?.[currentBranchId] ?? 0);
        const bStock = Number(b.stock?.[currentBranchId] ?? 0);
        const weightDiff = weight(aStock) - weight(bStock);
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 36);
  }, [filteredParts, stockFilter, currentBranchId]);

  // Normalize barcode/SKU: loại bỏ ký tự đặc biệt để so sánh
  // Honda: 06455-KYJ-841 → 06455kyj841
  // Yamaha: 5S9-F2101-00 → 5s9f210100
  const normalizeCode = (code: string): string => {
    return code.toLowerCase().replace(/[-\s./\\]/g, "");
  };

  // Handle barcode scan for quick add to cart
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    const normalizedBarcode = normalizeCode(barcode);

    // Tìm part với logic ưu tiên: barcode > SKU > tên
    const foundPart = filteredParts.find(
      (p) =>
        // 1. Khớp chính xác barcode (field mới)
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        // 2. Khớp SKU (normalize hoặc chính xác)
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        // 3. Tìm trong tên sản phẩm
        p.name?.toLowerCase().includes(barcode.toLowerCase())
    );

    if (foundPart) {
      addToCart(foundPart);
      showToast.success(`Đã thêm ${foundPart.name} vào giỏ hàng`);
      setBarcodeInput("");
      // Focus back to barcode input for continuous scanning
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } else {
      showToast.error(`Không tìm thấy sản phẩm có mã: ${barcode}`);
      setBarcodeInput("");
    }
  };

  // Handle camera barcode scan - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {
    console.log("📷 Camera scanned:", barcode);

    const normalizedBarcode = normalizeCode(barcode);

    // Tìm trong TẤT CẢ sản phẩm (repoParts), không phải filteredParts
    const foundPart = repoParts.find(
      (p) =>
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase()
    );

    // KHÔNG cần đóng scanner - BarcodeScannerModal tự đóng

    if (foundPart) {
      // Kiểm tra đã có trong giỏ chưa - dùng cartItems thay vì cart
      const existingItem = cartItems.find(
        (item) => item.partId === foundPart.id
      );
      if (existingItem) {
        // Chỉ tăng số lượng, không hiện toast để tránh spam
        updateCartQuantity(foundPart.id, existingItem.quantity + 1);
      } else {
        addToCart(foundPart);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
    } else {
      showToast.error(`Không tìm thấy: ${barcode}`);
    }
  };

  // Low stock monitoring (threshold = 5)
  const { lowStockCount, outOfStockCount } = useLowStock(
    repoParts,
    currentBranchId,
    LOW_STOCK_THRESHOLD
  );

  const stockFilterOptions: Array<{
    key: StockFilter;
    label: string;
    count: number;
    activeClass: string;
    inactiveClass: string;
  }> = [
      {
        key: "all",
        label: "Tất cả",
        count: filteredParts.length,
        activeClass:
          "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-blue-500/30",
        inactiveClass:
          "bg-white/80 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700",
      },
      {
        key: "low",
        label: "Tồn thấp",
        count: lowStockCount,
        activeClass:
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-amber-500/30",
        inactiveClass:
          "bg-white/80 dark:bg-slate-900/50 text-amber-700 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/60",
      },
      {
        key: "out",
        label: "Hết hàng",
        count: outOfStockCount,
        activeClass:
          "bg-gradient-to-r from-rose-500 to-red-500 text-white border-transparent shadow-rose-500/30",
        inactiveClass:
          "bg-white/80 dark:bg-slate-900/50 text-rose-700 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/60",
      },
    ];

  // One-time toast to notify low stock when opening screen
  const lowStockToastShown = useRef(false);
  useEffect(() => {
    if (
      !lowStockToastShown.current &&
      (lowStockCount > 0 || outOfStockCount > 0)
    ) {
      const msgParts = [] as string[];
      if (outOfStockCount > 0) msgParts.push(`Hết hàng: ${outOfStockCount}`);
      if (lowStockCount > 0) msgParts.push(`Tồn thấp: ${lowStockCount}`);
      showToast.info(msgParts.join(" · "));
      lowStockToastShown.current = true;
    }
  }, [lowStockCount, outOfStockCount]);

  // Filter customers by search - tìm theo tên, SĐT và biển số xe
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 10);
    const searchLower = customerSearch.toLowerCase();
    return customers
      .filter((customer) => {
        // Tìm theo tên
        if (customer.name.toLowerCase().includes(searchLower)) return true;
        // Tìm theo SĐT
        if (customer.phone?.includes(customerSearch)) return true;
        // Tìm theo biển số xe (trong mảng vehicles hoặc licensePlate cũ)
        if (customer.licensePlate?.toLowerCase().includes(searchLower))
          return true;
        if (
          customer.vehicles?.some(
            (v) =>
              v.licensePlate?.toLowerCase().includes(searchLower) ||
              v.model?.toLowerCase().includes(searchLower)
          )
        )
          return true;
        return false;
      })
      .slice(0, 10);
  }, [customers, customerSearch]);

  // Handle add new customer
  const handleSaveNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert("Vui lòng nhập tên và số điện thoại");
      return;
    }

    // Check if customer already exists
    const existingCustomer = customers.find(
      (c) => c.phone === newCustomer.phone
    );
    if (existingCustomer) {
      alert("Số điện thoại này đã tồn tại!");
      return;
    }

    // Create new customer with only valid database fields
    const customer = {
      id: `CUST-${Date.now()}`,
      name: newCustomer.name,
      phone: newCustomer.phone,
      created_at: new Date().toISOString(),
      // vehicleModel and licensePlate will be handled by createCustomer function
      vehicleModel: newCustomer.vehicleModel,
      licensePlate: newCustomer.licensePlate,
    };

    // Save to database using mutation
    createCustomerMutation.mutate(customer, {
      onSuccess: (savedCustomer) => {
        // Select the new customer
        setSelectedCustomer({
          id: savedCustomer.id,
          name: savedCustomer.name,
          phone: savedCustomer.phone,
          created_at: savedCustomer.created_at,
        });
        setCustomerSearch(savedCustomer.name);

        // Reset form and close modal
        setNewCustomer({
          name: "",
          phone: "",
          vehicleModel: "",
          licensePlate: "",
        });
        setShowAddCustomerModal(false);
        showToast.success("Đã thêm khách hàng mới!");
      },
      onError: (error) => {
        console.error("Error creating customer:", error);
        showToast.error("Không thể thêm khách hàng. Vui lòng thử lại.");
      },
    });
  };

  // Handle print receipt - Show preview modal
  const handlePrintReceipt = (sale: Sale) => {
    setPrintSale(sale);
    setShowPrintPreview(true);
  };

  // Ref for invoice preview content
  const invoicePreviewRef = useRef<HTMLDivElement>(null);

  // Handle share invoice as image
  const handleShareInvoice = async () => {
    if (!invoicePreviewRef.current || !printSale) return;

    try {
      showToast.info("Đang tạo hình ảnh...");

      // Dynamic import html2canvas
      const html2canvas = (await import("html2canvas")).default;

      const canvas = await html2canvas(invoicePreviewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
      });

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      const fileName = `hoa-don-${printSale.sale_code || formatAnyId(printSale.id) || printSale.id
        }.png`;

      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        const shareData = { files: [file] };

        if (navigator.canShare(shareData)) {
          await navigator.share({
            files: [file],
            title: "Hóa đơn bán hàng",
            text: `Hóa đơn ${printSale.sale_code || formatAnyId(printSale.id)}`,
          });
          showToast.success("Đã chia sẻ hóa đơn!");
          return;
        }
      }

      // Fallback: Download image
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast.success("Đã tải xuống hình ảnh hóa đơn!");
    } catch (error) {
      console.error("Share error:", error);
      showToast.error("Không thể chia sẻ hóa đơn");
    }
  };

  // Handle actual print after preview
  const handleDoPrint = () => {
    if (!printSale) return;

    // Set receipt data for hidden element
    setReceiptId(
      printSale.sale_code || formatAnyId(printSale.id) || printSale.id
    );
    setCustomerName(printSale.customer.name);
    setCustomerPhone(printSale.customer.phone || "");

    const normalizedItems: CartItem[] = printSale.items.map((item: any) => ({
      partId: item.partId || item.partid || "",
      partName: item.partName || item.partname || "",
      sku: item.sku || "",
      quantity: item.quantity || 0,
      sellingPrice:
        item.sellingPrice || item.sellingprice || (item as any).price || 0,
      stockSnapshot: item.stockSnapshot || 0,
      discount: item.discount || 0,
    }));

    setReceiptItems(normalizedItems);
    setReceiptDiscount(printSale.discount || 0);

    // Wait for state update then print
    setTimeout(() => {
      printElementById("last-receipt");
      setShowPrintPreview(false);
      setPrintSale(null);
    }, 100);
  };

  // Handle delete sale
  const { profile } = useAuth();
  const handleDeleteSale = async (saleId: string) => {
    if (!canDo(profile?.role, "sale.delete")) {
      showToast.error("Bạn không có quyền xóa hóa đơn");
      return;
    }
    if (
      !confirm("Xác nhận xóa hóa đơn này? Hành động này không thể hoàn tác.")
    ) {
      return;
    }

    try {
      // Import deleteSaleById directly
      const { deleteSaleById } = await import(
        "../../lib/repository/salesRepository"
      );
      const result = await deleteSaleById(saleId);

      if (!result.ok) {
        showToast.error(result.error?.message || "Xóa hóa đơn thất bại!");
        return;
      }

      // Invalidate and refetch sales query
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      showToast.success("Đã xóa hóa đơn thành công!");

      // Best-effort audit log (non-blocking)
      void safeAudit(profile?.id || null, {
        action: "sale.delete",
        tableName: "sales",
        recordId: saleId,
        oldData: null,
        newData: null,
      });
    } catch (error) {
      showToast.error("Xóa hóa đơn thất bại!");
      console.error("Delete sale error:", error);
    }
  };

  // Handle edit sale (reopen in cart)
  const handleEditSale = (sale: Sale) => {
    if (
      !confirm("Mở lại hóa đơn này để chỉnh sửa? Giỏ hàng hiện tại sẽ bị xóa.")
    ) {
      return;
    }

    // Clear current cart
    clearCart();

    // Load sale items into cart
    sale.items.forEach((item) => {
      // Find the part to add to cart
      const part = repoParts.find((p) => p.id === item.partId);
      if (part) {
        for (let i = 0; i < item.quantity; i++) {
          addToCart(part);
        }
      }
    });

    // Load customer if exists
    if (sale.customer.id) {
      const customer = customers.find((c) => c.id === sale.customer.id);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerSearch(customer.name);
      }
    } else {
      setCustomerName(sale.customer.name);
      setCustomerPhone(sale.customer.phone || "");
    }

    // Load discount
    setOrderDiscount(sale.discount || 0);

    // Close history modal
    setShowSalesHistory(false);

    alert("Hóa đơn đã được tải vào giỏ hàng để chỉnh sửa");
  };

  // Handle update sale (from edit modal)
  const handleUpdateSale = async (updatedSale: {
    id: string;
    items: CartItem[];
    customer: { id?: string; name: string; phone?: string };
    paymentMethod: "cash" | "bank";
    discount: number;
  }) => {
    try {
      // TODO: Implement actual update logic with Supabase
      // This would need to:
      // 1. Update the sales record
      // 2. Update inventory transactions (reverse old, apply new)
      // 3. Update cash transactions
      // For now, just show a message
      showToast.info("Tính năng cập nhật đơn hàng đang được phát triển");

      // Audit log
      await safeAudit(profile?.id || null, {
        action: "sale_update_attempt",
        tableName: "sales",
        recordId: updatedSale.id,
        newData: {
          items: updatedSale.items,
          customer: updatedSale.customer,
          paymentMethod: updatedSale.paymentMethod,
          discount: updatedSale.discount,
        },
      });

      // Note: When implemented, the sales list will refresh automatically
      // via React Query when the component re-renders
    } catch (error) {
      console.error("Error updating sale:", error);
      throw error;
    }
  };

  // Create customer debt if there's remaining amount (similar to ServiceManager)
  const createCustomerDebtIfNeeded = async (
    sale: Sale,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    console.log("[createCustomerDebtIfNeeded] CALLED with:", {
      saleId: sale.id,
      totalAmount,
      paidAmount,
      remainingAmount,
      customerName: sale.customer.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const safeCustomerId =
        sale.customer.id || sale.customer.phone || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        sale.customer.name?.trim() || sale.customer.phone || "Khách lẻ";

      // Tạo nội dung chi tiết từ hóa đơn bán hàng - dùng sale_code thay vì UUID
      const saleCode = sale.sale_code || sale.id;
      let description = `Bán hàng - Hóa đơn ${saleCode}`;

      // Danh sách sản phẩm đã mua
      if (sale.items && sale.items.length > 0) {
        description += "\n\nSản phẩm đã mua:";
        sale.items.forEach((item: any) => {
          const itemTotal = item.quantity * item.sellingPrice;
          const itemDiscount = item.discount || 0;
          description += `\n  • ${item.quantity} x ${item.partName
            } - ${formatCurrency(itemTotal)}`;
          if (itemDiscount > 0) {
            description += ` (Giảm: ${formatCurrency(itemDiscount)})`;
          }
        });
      }

      // Giảm giá đơn hàng (nếu có)
      if (sale.discount && sale.discount > 0) {
        description += `\n\nGiảm giá đơn hàng: -${formatCurrency(
          sale.discount
        )}`;
      }

      // Phương thức thanh toán
      const paymentMethodText =
        sale.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản";
      description += `\n\nPhương thức: ${paymentMethodText}`;

      // Thông tin nhân viên
      description += `\n\nNV: ${sale.userName || "N/A"}`;

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: sale.customer.phone || null,
        licensePlate: null, // Sales không có biển số xe
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        saleId: sale.id, // 🔹 Link debt với sale
      };

      console.log("[SalesManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[SalesManager] createCustomerDebt result:", result);
      showToast.success(
        `Đã tạo công nợ ${formatCurrency(
          remainingAmount
        )} cho ${safeCustomerName}`
      );
    } catch (error: any) {
      console.error("Error creating customer debt:", error);
      // Log chi tiết error để debug
      console.error("Error details:", {
        message: error?.message,
        cause: error?.cause,
        stack: error?.stack,
      });
      showToast.error(
        `Không thể tạo công nợ tự động: ${error?.message || "Lỗi không xác định"
        }`
      );
    }
  };

  // Handle finalize sale
  const handleFinalize = async () => {
    if (cartItems.length === 0) {
      alert("Vui lòng thêm sản phẩm vào giỏ hàng");
      return;
    }

    // Kiểm tra bắt buộc phải có thông tin khách hàng
    if (!selectedCustomer && !customerName && !customerPhone) {
      alert("Vui lòng nhập thông tin khách hàng trước khi bán hàng");
      return;
    }

    if (!paymentMethod) {
      alert("Vui lòng chọn phương thức thanh toán");
      return;
    }

    if (!paymentType) {
      alert("Vui lòng chọn hình thức thanh toán");
      return;
    }

    if (paymentType === "partial" && partialAmount <= 0) {
      alert("Vui lòng nhập số tiền khách trả");
      return;
    }

    try {
      // Kiểm tra tồn kho mới nhất trước khi tạo đơn
      for (const item of cartItems) {
        const part = repoParts.find((p) => p.id === item.partId);
        if (!part) {
          showToast.error(`Không tìm thấy sản phẩm: ${item.partName}`);
          return;
        }
        const stock = part.stock?.[currentBranchId] ?? 0;
        if (item.quantity > stock) {
          showToast.error(`Không đủ hàng cho ${part.name}. Tồn kho: ${stock}`);
          return;
        }
      }
      const saleId = `SALE-${Date.now()}`;
      const lineSubtotal = cartItems.reduce(
        (sum, it) => sum + it.sellingPrice * it.quantity,
        0
      );
      const lineDiscounts = cartItems.reduce(
        (sum, it) => sum + (it.discount || 0),
        0
      );
      const total = Math.max(0, lineSubtotal - lineDiscounts - orderDiscount);
      const customerObj = {
        id: selectedCustomer?.id,
        name: selectedCustomer?.name || customerName || "Khách lẻ",
        phone: selectedCustomer?.phone || customerPhone,
      };

      // Set receipt info for printing BEFORE clearing cart
      setReceiptId(saleId);
      setCustomerName(customerObj.name);
      setCustomerPhone(customerObj.phone || "");
      setReceiptItems([...cartItems]);
      setReceiptDiscount(orderDiscount + lineDiscounts);

      // Create customer if new (has phone nhưng chưa chọn từ danh sách)
      let newCustomerId: string | undefined;
      if (!selectedCustomer && customerPhone && customerName) {
        const existingCustomer = customers.find(
          (c) => c.phone === customerPhone
        );
        if (!existingCustomer) {
          newCustomerId = `CUST-${Date.now()}`;
          upsertCustomer({
            id: newCustomerId,
            name: customerName,
            phone: customerPhone,
            status: "active",
            segment: "New",
            loyaltyPoints: 0,
            totalSpent: 0,
            visitCount: 0, // Bắt đầu từ 0, sẽ được tăng lên 1 sau khi tạo đơn
            lastVisit: null,
            created_at: new Date().toISOString(),
          });
        } else {
          // Dùng ID của khách hàng đã tồn tại
          newCustomerId = existingCustomer.id;
        }
      }
      // Gọi RPC atomic đảm bảo tất cả bước (xuất kho, tiền mặt, cập nhật tồn, ghi hóa đơn, audit) thực hiện trong 1 transaction server
      const rpcRes = await createSaleAtomicAsync({
        id: saleId,
        items: cartItems,
        discount: orderDiscount + lineDiscounts,
        customer: customerObj,
        paymentMethod: paymentMethod!,
        userId: profile?.id || "local-user",
        userName:
          profile?.name || profile?.full_name || profile?.email || "Nhân viên",
        branchId: currentBranchId,
      } as any);
      if ((rpcRes as any)?.error) throw (rpcRes as any).error;

      // Cập nhật visitCount và totalSpent cho khách hàng nếu có phone
      const customerPhone = selectedCustomer?.phone || customerObj.phone;
      if (customerPhone) {
        try {
          // Chờ một chút để đảm bảo khách hàng đã được tạo trong DB
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Lấy thông tin hiện tại của khách hàng theo phone
          const { data: currentCustomer } = await supabase
            .from("customers")
            .select("id, totalSpent, visitCount")
            .eq("phone", customerPhone)
            .single();

          if (currentCustomer) {
            const currentTotal = currentCustomer?.totalSpent || 0;
            const currentVisits = currentCustomer?.visitCount || 0;

            // Cập nhật totalSpent, visitCount, lastVisit
            await supabase
              .from("customers")
              .update({
                totalSpent: currentTotal + total,
                visitCount: currentVisits + 1,
                lastVisit: new Date().toISOString(),
              })
              .eq("id", currentCustomer.id);

            console.log(
              `[Sale] Updated customer ${customerObj.name}: totalSpent ${currentTotal} + ${total}, visits ${currentVisits} + 1`
            );
          } else {
            console.warn(
              `[Sale] Customer not found for update: ${customerObj.name} (${customerPhone})`
            );
          }
        } catch (err) {
          console.error("[Sale] Error updating customer stats:", err);
        }
      }

      // Calculate paid amount based on payment type
      const paidAmount =
        paymentType === "full"
          ? total
          : paymentType === "partial"
            ? partialAmount
            : 0; // paymentType === "note" (ghi nợ)

      const remainingAmount = total - paidAmount;

      console.log("[SalesManager] Payment details:", {
        paymentType,
        total,
        paidAmount,
        partialAmount,
        remainingAmount,
        hasCustomer: !!(selectedCustomer || customerName || customerPhone),
      });

      // Create customer debt if there's remaining amount
      if (remainingAmount > 0) {
        console.log("[SalesManager] Creating debt because remaining > 0");

        // Fetch the newly created sale to get the sale_code (generated by trigger)
        const { data: createdSale, error: fetchError } = await supabase
          .from("sales")
          .select(
            `
            *,
            user:userid(
              full_name,
              display_name,
              email
            )
          `
          )
          .eq("id", saleId)
          .single();

        if (fetchError) {
          console.error("[SalesManager] Error fetching sale:", fetchError);
        }

        // Map user info to userName
        const saleWithUserName = createdSale
          ? {
            ...createdSale,
            userName:
              createdSale.user?.full_name ||
              createdSale.user?.display_name ||
              createdSale.user?.email ||
              "N/A",
          }
          : null;

        const saleData: Sale =
          saleWithUserName ||
          ({
            id: saleId,
            sale_code: undefined,
            date: new Date().toISOString(),
            items: cartItems,
            subtotal: subtotal,
            discount: orderDiscount + lineDiscounts,
            total: total,
            customer: customerObj,
            paymentMethod: paymentMethod,
            userName:
              profile?.name ||
              profile?.full_name ||
              profile?.email ||
              "Nhân viên",
            userId: profile?.id || "",
            branchId: currentBranchId || "",
          } as Sale);

        console.log("[SalesManager] Sale data for debt:", saleData);

        await createCustomerDebtIfNeeded(
          saleData,
          remainingAmount,
          total,
          paidAmount
        );
      } else {
        console.log("[SalesManager] No debt needed, paid in full");
      }

      // Clear form
      setSelectedCustomer(null);
      setCustomerSearch("");
      setOrderDiscount(0);
      setDiscountPercent(0);
      setDiscountType("amount");
      setPaymentMethod(null);
      setPaymentType(null);
      setPartialAmount(0);
      clearCart();

      // Print receipt after state updates only if autoPrintReceipt is checked
      if (autoPrintReceipt) {
        setTimeout(() => {
          printElementById("last-receipt");
        }, 100);
      }
    } catch (error: any) {
      console.error("Error finalizing sale (atomic):", error);
      showToast.error(error?.message || "Có lỗi khi tạo hóa đơn (atomic)");
    }
  };

  // Quick service handler
  const handleQuickServiceComplete = async (
    service: { id: string; name: string; price: number; category?: string },
    quantity: number,
    paymentMethod: "cash" | "bank",
    customer: {
      id?: string;
      name: string;
      phone: string;
      vehicleModel: string;
      licensePlate: string;
    }
  ) => {
    try {
      const servicePrice = service.price * quantity;
      const saleId = crypto.randomUUID();

      // Create a virtual cart item for the service
      // Use sellingPrice and partName to match CartItem interface and RPC expectations
      const serviceItem: CartItem = {
        partId: `quick_service_${service.id}`,
        partName: service.name,
        sku: `QS-${service.id}`,
        category: service.category || "Dịch vụ nhanh",
        quantity: quantity,
        sellingPrice: service.price,
        stockSnapshot: 999, // Virtual stock for services
        discount: 0,
        isService: true, // Mark as service to skip stock validation in RPC
      };

      // Call RPC to create sale atomically
      const rpcRes = await createSaleAtomicAsync({
        id: saleId,
        items: [serviceItem],
        discount: 0,
        customer: customer,
        customerId: customer.id, // Truyền customerId để tích điểm
        paymentMethod: paymentMethod,
        userId: profile?.id || "local-user",
        userName:
          profile?.name || profile?.full_name || profile?.email || "Nhân viên",
        branchId: currentBranchId,
      } as any);

      if ((rpcRes as any)?.error) throw (rpcRes as any).error;

      // Nếu có customerId, cập nhật totalSpent và visitCount cho khách hàng
      if (customer.id) {
        try {
          // Lấy thông tin hiện tại (dùng camelCase vì Supabase auto-convert)
          const { data: currentCustomer } = await supabase
            .from("customers")
            .select("totalSpent, visitCount")
            .eq("id", customer.id)
            .single();

          const currentTotal = currentCustomer?.totalSpent || 0;
          const currentVisits = currentCustomer?.visitCount || 0;

          // Cập nhật totalSpent, visitCount, lastVisit
          await supabase
            .from("customers")
            .update({
              totalSpent: currentTotal + servicePrice,
              visitCount: currentVisits + 1,
              lastVisit: new Date().toISOString(),
            })
            .eq("id", customer.id);

          console.log(
            `[QuickService] Updated customer ${customer.name}: totalSpent ${currentTotal} + ${servicePrice}, visits ${currentVisits} + 1`
          );
        } catch (err) {
          console.error("[QuickService] Error updating customer stats:", err);
        }
      }

      const customerLabel =
        customer.name !== "Khách vãng lai"
          ? customer.name
          : customer.licensePlate
            ? `Biển số ${customer.licensePlate}`
            : "Khách vãng lai";

      showToast.success(
        `✅ ${service.name} x${quantity} - ${servicePrice.toLocaleString(
          "vi-VN"
        )}đ (${customerLabel})`
      );

      // Close modal
      setShowQuickServiceModal(false);
    } catch (error: any) {
      console.error("Error creating quick service sale:", error);
      showToast.error(error?.message || "Có lỗi khi tạo đơn dịch vụ nhanh");
    }
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".customer-dropdown-container")) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 pb-16 md:pb-0">
      {/* Mobile Bottom Tabs - Fixed at bottom - 4 tabs: Sản phẩm, Giỏ hàng, DV nhanh, Lịch sử */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-bottom">
        {/* Backdrop blur effect for modern look */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          <button
            onClick={() => setMobileTab("products")}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 ${mobileTab === "products"
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
              : "text-slate-600 dark:text-slate-400 active:scale-95"
              }`}
          >
            <Boxes
              className={`w-6 h-6 transition-transform ${mobileTab === "products" ? "scale-105" : ""
                }`}
            />
            <span
              className={`text-[9px] font-medium ${mobileTab === "products" ? "font-semibold" : ""
                }`}
            >
              Sản phẩm
            </span>
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 relative ${mobileTab === "cart"
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
              : "text-slate-600 dark:text-slate-400 active:scale-95"
              }`}
          >
            <div className="relative">
              <ShoppingCart
                className={`w-6 h-6 transition-transform ${mobileTab === "cart" ? "scale-105" : ""
                  }`}
              />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] text-[8px] font-bold rounded-full bg-red-500 text-white flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </div>
            <span
              className={`text-[9px] font-medium ${mobileTab === "cart" ? "font-semibold" : ""
                }`}
            >
              Giỏ hàng
            </span>
          </button>
          <button
            onClick={() => setShowQuickServiceModal(true)}
            className="flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 text-amber-600 dark:text-amber-400 active:scale-95 active:bg-amber-50 dark:active:bg-amber-900/30"
          >
            <Zap className="w-6 h-6" />
            <span className="text-[9px] font-medium">DV nhanh</span>
          </button>
          <button
            onClick={() => {
              setMobileTab("history");
              setShowSalesHistory(true);
            }}
            className={`flex flex-col items-center gap-1 px-1 py-1.5 rounded-lg transition-all duration-200 ${mobileTab === "history"
              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30"
              : "text-slate-600 dark:text-slate-400 active:scale-95"
              }`}
          >
            <History
              className={`w-6 h-6 transition-transform ${mobileTab === "history" ? "scale-105" : ""
                }`}
            />
            <span
              className={`text-[9px] font-medium ${mobileTab === "history" ? "font-semibold" : ""
                }`}
            >
              Lịch sử
            </span>
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)] md:h-screen">
        {/* Main Content Area - Products Grid */}
        <div
          className={`flex-1 flex flex-col transition-all duration-300 ${mobileTab !== "products" ? "hidden md:flex" : "animate-fade-in"
            }`}
        >
          {/* Search Bar */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50 p-3 md:p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-stretch gap-2">
                  {/* Manual Search */}
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
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
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm..."
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-300/50 dark:border-slate-600/50 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeInput((prev) => !prev)}
                    className={`px-4 py-2 rounded-xl border-2 font-semibold text-sm flex items-center gap-2 transition-all ${showBarcodeInput
                      ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-800"
                      }`}
                  >
                    <ScanLine className="w-4 h-4" />
                    <span className="hidden md:inline">
                      {showBarcodeInput ? "Đóng quét" : "Quét mã"}
                    </span>
                  </button>
                  {/* Camera scan button - mobile only */}
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="md:hidden px-3 py-2 rounded-xl border-2 border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-green-100"
                    title="Quét bằng camera"
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
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
                {showBarcodeInput && (
                  <form onSubmit={handleBarcodeSubmit} className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500">
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
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                    </div>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      placeholder="Nhập hoặc quét mã vạch..."
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 border-2 border-blue-400 dark:border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base transition-all placeholder:text-blue-500/70 font-mono"
                    />
                    {barcodeInput && (
                      <button
                        type="button"
                        onClick={() => setBarcodeInput("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </form>
                )}
              </div>
              {/* History button - only show on desktop since mobile has tab */}
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={() => setShowQuickServiceModal(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl whitespace-nowrap transition-all inline-flex items-center gap-2 text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Dịch vụ nhanh - Rửa xe, vá xe..."
                >
                  <Zap className="w-5 h-5" />
                  <span>Dịch vụ nhanh</span>
                </button>
                <button
                  onClick={() => setShowSalesHistory(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl whitespace-nowrap transition-all inline-flex items-center gap-2 text-sm font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95"
                  title="Lịch sử bán hàng"
                >
                  <History className="w-5 h-5" />
                  <span>Lịch sử</span>
                </button>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="bg-white/80 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/60 px-3 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
              Hiển thị {displayedParts.length} / {filteredParts.length || 0} sản
              phẩm
              {partSearch && " theo từ khóa"}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {stockFilterOptions.map((option) => {
                const isActive = stockFilter === option.key;
                return (
                  <button
                    type="button"
                    key={option.key}
                    aria-pressed={isActive}
                    onClick={() => setStockFilter(option.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${isActive ? option.activeClass : option.inactiveClass
                      }`}
                  >
                    <span>{option.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive
                        ? "bg-white/30"
                        : "bg-slate-100 dark:bg-slate-800"
                        }`}
                    >
                      {option.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-0 md:p-6 overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-24 md:pb-6">
            {displayedParts.length === 0 ? (
              <div className="text-center text-slate-400 mt-20">
                <div className="mb-4 flex items-center justify-center">
                  <Boxes className="w-16 h-16 text-slate-300" />
                </div>
                <div className="text-xl font-medium mb-2">
                  {filteredParts.length === 0
                    ? partSearch
                      ? "Không tìm thấy sản phẩm nào"
                      : "Chưa có sản phẩm"
                    : stockFilter === "low"
                      ? "Không có sản phẩm tồn thấp"
                      : "Không có sản phẩm hết hàng"}
                </div>
                <div className="text-sm">
                  {filteredParts.length === 0
                    ? partSearch
                      ? "Hãy thử một từ khóa tìm kiếm khác"
                      : "Vui lòng thêm sản phẩm vào hệ thống"
                    : "Hãy chọn bộ lọc khác để xem thêm sản phẩm"}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-3">
                {displayedParts.map((part) => {
                  const price = Number(
                    part.retailPrice?.[currentBranchId] ?? 0
                  );
                  const stock = Number(part.stock?.[currentBranchId] ?? 0);
                  const isOutOfStock = stock <= 0;
                  const isLowStock = stock > 0 && stock <= LOW_STOCK_THRESHOLD;
                  const cartItem = cartItemById.get(part.id);
                  const inCart = Boolean(cartItem);
                  const statusLabel = isOutOfStock
                    ? "Hết hàng"
                    : isLowStock
                      ? "Tồn thấp"
                      : "Sẵn hàng";
                  const statusClass = isOutOfStock
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-200"
                    : isLowStock
                      ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200"
                      : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-200";
                  const stockBadgeClass = isOutOfStock
                    ? "bg-gradient-to-r from-rose-500 to-red-500 text-white"
                    : isLowStock
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                      : "bg-gradient-to-r from-emerald-500 to-green-500 text-white";

                  return (
                    <div
                      key={part.id}
                      className={`group relative text-left p-2.5 md:p-3 rounded-xl border transition-all duration-200 h-full ${isOutOfStock
                        ? "bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60"
                        : "bg-white dark:bg-slate-800/70 border-slate-200/70 dark:border-slate-700 md:hover:border-blue-400 md:dark:hover:border-blue-500 md:hover:shadow-xl md:hover:-translate-y-0.5 md:cursor-pointer"
                        } ${inCart
                          ? "ring-2 ring-blue-400 dark:ring-blue-500/60 shadow-md shadow-blue-500/20"
                          : ""
                        }`}
                      onClick={() => {
                        // Desktop: click anywhere to add
                        if (window.innerWidth >= 768 && !isOutOfStock) {
                          addToCart(part);
                        }
                      }}
                    >
                      <div className="flex flex-col h-full">
                        {/* Header: In cart badge */}
                        {inCart && (
                          <div className="absolute -top-2.5 -right-2.5 z-10">
                            <span className="flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-bold rounded-full bg-blue-500 text-white shadow-lg ring-2 ring-white dark:ring-slate-800">
                              {cartItem?.quantity}
                            </span>
                          </div>
                        )}

                        {/* Product name + SKU + Category */}
                        <div className="mb-2 flex-1">
                          <h3
                            className="font-semibold text-xs md:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight"
                            title={part.name}
                          >
                            {part.name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[100px]">
                              {part.sku}
                            </span>
                            {part.category && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[70px] ${getCategoryColor(part.category).bg
                                  } ${getCategoryColor(part.category).text}`}
                              >
                                {part.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price + Stock + Add button */}
                        <div className="flex items-end justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50">
                          <div>
                            <p
                              className={`text-sm font-bold ${isOutOfStock
                                ? "text-slate-400 dark:text-slate-500"
                                : "text-blue-600 dark:text-blue-400"
                                }`}
                            >
                              {formatCurrency(price)}
                            </p>
                            <span
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded ${isOutOfStock
                                ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                                : isLowStock
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                }`}
                            >
                              Tồn: {Math.max(0, Math.floor(stock))}
                            </span>
                          </div>
                          {/* Mobile: Add to cart button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isOutOfStock) addToCart(part);
                            }}
                            disabled={isOutOfStock}
                            className={`md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isOutOfStock
                              ? "bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                              : "bg-blue-500 text-white shadow-md active:scale-95"
                              }`}
                          >
                            {isOutOfStock ? (
                              <span className="text-slate-400 text-xs">✕</span>
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Customer, Cart & Checkout */}
        <div
          className={`w-full md:w-[40%] bg-white dark:bg-slate-800 md:border-l border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 overflow-y-auto ${mobileTab !== "cart" ? "hidden md:flex" : "animate-fade-in"
            }`}
        >
          {/* Customer Selection */}
          <div className="p-3 md:p-4 border-b border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800 md:bg-gradient-to-r md:from-emerald-50/30 md:via-teal-50/20 md:to-cyan-50/30 dark:md:from-slate-800/50 dark:md:via-slate-800/30 dark:md:to-slate-800/50">
            <div className="customer-dropdown-container">
              <label className="flex items-center gap-2 text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                <div className="w-7 h-7 md:w-8 md:h-8 bg-emerald-500 md:bg-gradient-to-br md:from-emerald-500 md:to-teal-500 rounded-lg flex items-center justify-center md:shadow-lg">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <span>Khách hàng</span>
              </label>
              <div className="relative flex flex-col md:flex-row gap-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg
                      className="w-4 h-4"
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
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm tên, số điện thoại..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    onBlur={() => {
                      // Delay hiding dropdown to allow click on items
                      setTimeout(() => setShowCustomerDropdown(false), 200);
                    }}
                    className="w-full pl-10 pr-4 py-2 md:py-2.5 border md:border-2 border-slate-300 md:border-slate-300/50 dark:border-slate-600/50 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                  />
                  {/* Dropdown results - positioned relative to input container */}
                  {showCustomerDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((customer) => {
                          const primaryVehicle =
                            customer.vehicles?.find((v) => v.isPrimary) ||
                            customer.vehicles?.[0];
                          const vehicleInfo =
                            primaryVehicle ||
                            (customer.licensePlate || customer.vehicleModel
                              ? {
                                model: customer.vehicleModel,
                                licensePlate: customer.licensePlate,
                              }
                              : null);

                          return (
                            <div
                              key={customer.id}
                              className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-600 border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                            >
                              <button
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setCustomerSearch(customer.name);
                                  setShowCustomerDropdown(false);
                                }}
                                className="flex-1 text-left"
                              >
                                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                  {customer.name}
                                </div>
                                {customer.phone && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    📞 {customer.phone}
                                  </div>
                                )}
                                {vehicleInfo && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                    🏍️ {vehicleInfo.model || ""}{" "}
                                    {vehicleInfo.licensePlate
                                      ? `• ${vehicleInfo.licensePlate}`
                                      : ""}
                                  </div>
                                )}
                              </button>
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  console.log(
                                    "Edit button clicked for customer:",
                                    customer.name
                                  );
                                  // Lưu customer ID để CustomerManager tự động mở form edit
                                  localStorage.setItem(
                                    "editCustomerId",
                                    customer.id
                                  );
                                  console.log(
                                    "Saved editCustomerId to localStorage:",
                                    customer.id
                                  );
                                  window.location.hash = "#/customers";
                                }}
                                className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex-shrink-0 font-semibold border-2 border-blue-600"
                                title="Chỉnh sửa khách hàng"
                              >
                                Sửa
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-3 text-center text-slate-500 dark:text-slate-400 text-sm">
                          {customerSearch ? (
                            <>
                              <div>Không tìm thấy khách hàng</div>
                              <button
                                onClick={() => setShowAddCustomerModal(true)}
                                className="mt-2 text-emerald-500 hover:text-emerald-600 font-medium"
                              >
                                + Thêm khách hàng mới
                              </button>
                            </>
                          ) : customers.length === 0 ? (
                            <div>Chưa có khách hàng nào</div>
                          ) : (
                            <div>Nhập tên hoặc SĐT để tìm...</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-3 py-2 md:px-4 md:py-2.5 bg-emerald-500 md:bg-gradient-to-r md:from-emerald-500 md:to-teal-500 hover:bg-emerald-600 md:hover:from-emerald-600 md:hover:to-teal-600 text-white rounded-lg md:rounded-xl flex items-center justify-center gap-2 transition-all md:shadow-lg md:hover:shadow-xl md:hover:scale-105 md:active:scale-95 font-semibold md:font-bold"
                  title="Thêm khách hàng mới"
                >
                  <PlusIcon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline text-sm">Thêm</span>
                </button>
              </div>
              {selectedCustomer && (
                <div className="mt-2 md:mt-3 p-2 md:p-3.5 bg-emerald-50 dark:bg-emerald-900/20 md:bg-gradient-to-r md:from-emerald-50 md:to-teal-50 dark:md:from-emerald-900/20 dark:md:to-teal-900/20 rounded-lg md:rounded-xl border md:border-2 border-emerald-200 dark:border-emerald-800 md:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-2.5 flex-1 min-w-0">
                      <div className="hidden md:flex w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg items-center justify-center shadow-lg flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium md:font-bold text-emerald-900 dark:text-emerald-100 truncate text-sm md:text-base">
                          {selectedCustomer.name}
                        </div>
                        {selectedCustomer.phone && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                            <svg
                              className="w-3 h-3 flex-shrink-0 hidden md:inline"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                              />
                            </svg>
                            <span className="truncate">
                              {selectedCustomer.phone}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const primaryVehicle =
                            selectedCustomer.vehicles?.find(
                              (v) => v.isPrimary
                            ) || selectedCustomer.vehicles?.[0];
                          const vehicleInfo =
                            primaryVehicle ||
                            (selectedCustomer.licensePlate ||
                              selectedCustomer.vehicleModel
                              ? {
                                model: selectedCustomer.vehicleModel,
                                licensePlate: selectedCustomer.licensePlate,
                              }
                              : null);

                          if (vehicleInfo) {
                            return (
                              <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                                🏍️ {vehicleInfo.model || ""}{" "}
                                {vehicleInfo.licensePlate
                                  ? `• ${vehicleInfo.licensePlate}`
                                  : ""}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                      }}
                      className="w-7 h-7 md:w-8 md:h-8 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-md md:rounded-lg flex items-center justify-center transition-all flex-shrink-0 md:shadow-sm md:hover:shadow-md text-lg"
                      title="Xóa"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cart Items */}
          <div className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 md:pb-3 border-b md:border-b-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="hidden md:flex w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg items-center justify-center shadow-lg">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-base md:text-lg font-semibold md:font-black text-slate-900 dark:text-slate-100">
                  Giỏ hàng
                </h3>
              </div>
              <span className="px-2 py-0.5 md:px-3 md:py-1 bg-blue-100 md:bg-gradient-to-r md:from-blue-100 md:to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold md:font-bold md:shadow-sm">
                {cartItems.length}
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-12 md:py-16 mb-3">
                <div className="mb-3 md:mb-4 flex items-center justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-100 md:bg-gradient-to-br md:from-slate-100 md:to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl md:rounded-3xl flex items-center justify-center md:shadow-lg">
                    <ShoppingCart className="w-8 h-8 md:w-10 md:h-10 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                <div className="text-sm md:text-base font-semibold md:font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Giỏ hàng trống
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-500">
                  Chọn sản phẩm để thêm vào giỏ
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 md:space-y-2.5">
                {cartItems.map((item) => {
                  const partInfo = repoParts.find((p) => p.id === item.partId);
                  return (
                    <div
                      key={item.partId}
                      className="group p-2 md:p-3 border md:border-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 rounded-lg md:rounded-xl bg-white dark:bg-slate-800 md:hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 md:hover:shadow-lg md:hover:shadow-blue-500/10"
                    >
                      {/* Mobile: Compact horizontal layout */}
                      <div className="md:hidden">
                        <div className="flex items-center justify-between gap-2">
                          {/* Left: Name + SKU + Category */}
                          <div className="flex-1 min-w-0">
                            <div
                              className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight truncate"
                              title={item.partName}
                            >
                              {item.partName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                {item.sku}
                              </span>
                              {partInfo?.category && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${getCategoryColor(partInfo.category).bg
                                    } ${getCategoryColor(partInfo.category).text
                                    }`}
                                >
                                  {partInfo.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.sellingPrice.toLocaleString(
                                  "vi-VN"
                                )}
                                onChange={(e) => {
                                  const rawValue = e.target.value
                                    .replace(/\./g, "")
                                    .replace(/\D/g, "");
                                  updateCartPrice(
                                    item.partId,
                                    Number(rawValue) || 0
                                  );
                                }}
                                className="w-24 px-1.5 py-0.5 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded bg-blue-50 dark:bg-blue-900/30 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                              <span className="text-[10px] text-slate-400">
                                đ
                              </span>
                            </div>
                          </div>
                          {/* Right: Quantity controls */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  item.partId,
                                  item.quantity - 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all font-bold text-base"
                            >
                              -
                            </button>
                            <span className="w-7 text-center font-bold text-xs text-slate-900 dark:text-slate-100">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateCartQuantity(
                                  item.partId,
                                  item.quantity + 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-blue-500 dark:bg-blue-600 rounded-md text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-all font-bold text-base"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: Horizontal layout with category */}
                      <div className="hidden md:flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                          <Boxes className="w-6 h-6 text-orange-500 dark:text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 mb-0.5"
                            title={item.partName}
                          >
                            {item.partName}
                          </div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                              {item.sku}
                            </span>
                            {partInfo?.category && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryColor(partInfo.category).bg
                                  } ${getCategoryColor(partInfo.category).text}`}
                              >
                                {partInfo.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={item.sellingPrice.toLocaleString("vi-VN")}
                              onChange={(e) => {
                                const rawValue = e.target.value
                                  .replace(/\./g, "")
                                  .replace(/\D/g, "");
                                updateCartPrice(
                                  item.partId,
                                  Number(rawValue) || 0
                                );
                              }}
                              className="w-28 px-2 py-1 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            />
                            <span className="text-xs text-slate-400 font-medium">
                              đ
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() =>
                              updateCartQuantity(item.partId, item.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:from-red-100 hover:to-red-200 dark:hover:from-red-900/30 dark:hover:to-red-800/30 hover:text-red-500 transition-all shadow-sm hover:shadow-md font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-black text-sm text-slate-900 dark:text-slate-100 px-2 py-1 bg-slate-50 dark:bg-slate-700 rounded-lg">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(item.partId, item.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 rounded-lg text-white hover:from-blue-600 hover:to-indigo-600 dark:hover:from-blue-700 dark:hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Checkout Section */}
          {cartItems.length > 0 && (
            <div className="border-t md:border-t-2 border-slate-200 md:border-slate-200/50 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800 md:bg-gradient-to-br md:from-slate-50 md:to-blue-50/30 dark:md:from-slate-800 dark:md:to-slate-800/50">
              {/* Summary */}
              <div className="p-3 md:p-4 space-y-2 md:space-y-3 pb-20 md:pb-3">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Tổng tiền hàng
                  </span>
                  <span className="font-semibold md:font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="space-y-2 md:space-y-2.5">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between text-xs md:text-sm gap-1.5 md:gap-2">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      Giảm giá:
                    </span>
                    <div className="flex items-center gap-1.5 md:gap-2 w-full md:w-auto">
                      <input
                        type="number"
                        value={
                          discountType === "amount"
                            ? orderDiscount
                            : discountPercent
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (discountType === "amount") {
                            setOrderDiscount(Math.min(value, subtotal));
                          } else {
                            const percent = Math.min(value, 100);
                            setDiscountPercent(percent);
                            setOrderDiscount(
                              Math.round((subtotal * percent) / 100)
                            );
                          }
                        }}
                        className="flex-1 md:w-24 px-2 md:px-3 py-1.5 md:py-2 text-right text-xs md:text-sm border md:border-2 border-slate-300 md:border-slate-300 dark:border-slate-600 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium md:font-semibold"
                        placeholder="0"
                        min="0"
                        max={discountType === "amount" ? subtotal : 100}
                      />
                      <select
                        value={discountType}
                        onChange={(e) => {
                          const newType = e.target.value as
                            | "amount"
                            | "percent";
                          setDiscountType(newType);
                          setOrderDiscount(0);
                          setDiscountPercent(0);
                        }}
                        className="px-2 md:px-3 py-1.5 md:py-2 border md:border-2 border-slate-300 md:border-slate-300 dark:border-slate-600 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs md:text-sm font-semibold md:font-bold focus:ring-2 focus:ring-purple-500 transition-all"
                      >
                        <option value="amount">₫</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick percent buttons */}
                  {discountType === "percent" && (
                    <div className="flex gap-1.5 md:gap-2 justify-end flex-wrap">
                      {[5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => {
                            setDiscountPercent(percent);
                            setOrderDiscount(
                              Math.round((subtotal * percent) / 100)
                            );
                          }}
                          className="px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-semibold md:font-bold bg-purple-100 md:bg-gradient-to-r md:from-purple-100 md:to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 hover:bg-purple-200 md:hover:from-purple-200 md:hover:to-pink-200 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 text-purple-700 dark:text-purple-300 rounded-md md:rounded-lg transition-all md:shadow-sm md:hover:shadow-md"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show amount if percent mode */}
                  {discountType === "percent" && discountPercent > 0 && (
                    <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 text-right">
                      = {formatCurrency(orderDiscount)}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-2 md:pt-3 mt-2 md:mt-3 border-t md:border-t-2 border-slate-200 dark:border-slate-700 p-2 md:p-3 -mx-3 md:-mx-4 bg-blue-600 md:bg-gradient-to-r md:from-blue-600 md:to-indigo-600 dark:from-blue-700 dark:to-indigo-700 rounded-b-lg md:rounded-b-xl md:shadow-lg">
                  <span className="font-semibold md:font-bold text-white text-xs md:text-sm">
                    Khách phải trả
                  </span>
                  <span className="font-black text-lg md:text-2xl text-white">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-3 md:px-4 pb-3 md:pb-4">
                <label className="flex items-center gap-2 text-xs md:text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                  <span>Phương thức thanh toán</span>
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border md:border-2 transition-all font-semibold md:font-bold md:shadow-sm md:hover:shadow-md ${paymentMethod === "cash"
                      ? "border-emerald-600 bg-emerald-500 text-white dark:bg-emerald-600 dark:text-white md:shadow-lg"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                      }`}
                  >
                    <Banknote className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm">Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border md:border-2 transition-all font-semibold md:font-bold md:shadow-sm md:hover:shadow-md ${paymentMethod === "bank"
                      ? "border-blue-600 bg-blue-500 text-white dark:bg-blue-600 dark:text-white md:shadow-lg"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                      }`}
                  >
                    <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-xs md:text-sm">Chuyển khoản</span>
                  </button>
                </div>
              </div>

              {/* Payment Type */}
              {paymentMethod && (
                <div className="px-3 md:px-4 pb-3 md:pb-4">
                  <label className="block text-xs md:text-sm font-semibold md:font-bold text-slate-900 dark:text-slate-100 mb-2 md:mb-3">
                    Hình thức
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${paymentType === "full"
                        ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                        }`}
                    >
                      Đủ
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${paymentType === "partial"
                        ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                        }`}
                    >
                      1 phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`px-2 md:px-3 py-2 md:py-2.5 text-xs md:text-sm rounded-lg md:rounded-xl border md:border-2 transition-all font-bold md:shadow-sm ${paymentType === "note"
                        ? "border-orange-600 bg-orange-500 text-white dark:bg-orange-600 dark:text-white md:shadow-lg"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-orange-400"
                        }`}
                    >
                      Ghi nợ
                    </button>
                  </div>
                </div>
              )}

              {/* Partial Payment Amount */}
              {paymentType === "partial" && (
                <div className="px-4 pb-3">
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                    Số tiền khách trả
                  </label>
                  <NumberInput
                    value={partialAmount}
                    onChange={(val) => setPartialAmount(val)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    placeholder="0"
                  />
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Còn lại:{" "}
                    {formatCurrency(
                      Math.max(0, total - orderDiscount - partialAmount)
                    )}{" "}
                    đ
                  </div>
                </div>
              )}

              {/* Options - Button Toggle Style */}
              <div className="px-3 md:px-4 pb-3 md:pb-3 space-y-3">
                {/* Thời gian bán hàng - Toggle buttons */}
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Thời gian bán hàng
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseCurrentTime(true)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${useCurrentTime
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                        }`}
                    >
                      <span className="text-xs">🕐 Hiện tại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseCurrentTime(false)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${!useCurrentTime
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                        }`}
                    >
                      <span className="text-xs">📅 Tùy chỉnh</span>
                    </button>
                  </div>
                  {/* Datetime picker when custom time selected */}
                  {!useCurrentTime && (
                    <input
                      type="datetime-local"
                      value={customSaleTime}
                      onChange={(e) => setCustomSaleTime(e.target.value)}
                      className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>

                {/* Tùy chọn thêm - Toggle buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderNote(!showOrderNote)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${showOrderNote
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                      }`}
                  >
                    <span className="text-xs">📝 Ghi chú</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoPrintReceipt(!autoPrintReceipt)}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all font-semibold ${autoPrintReceipt
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400"
                      }`}
                  >
                    <span className="text-xs">🖨️ In hoá đơn</span>
                  </button>
                </div>
                {/* Note textarea when note option selected */}
                {showOrderNote && (
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Nhập ghi chú cho đơn hàng..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-3 md:p-4 pt-0 flex flex-col md:flex-row gap-2 md:gap-3">
                <button
                  onClick={clearCart}
                  className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-white dark:bg-slate-700 border md:border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold md:font-bold rounded-lg md:rounded-xl transition-all md:shadow-sm md:hover:shadow-md text-sm md:text-base"
                >
                  LƯU NHÁP
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={!paymentMethod || !paymentType}
                  className={`flex-1 px-3 md:px-4 py-2 md:py-3 font-bold md:font-black rounded-lg md:rounded-xl transition-all md:shadow-lg text-sm md:text-base ${paymentMethod && paymentType
                    ? "bg-orange-500 md:bg-gradient-to-r md:from-orange-500 md:to-red-500 hover:bg-orange-600 md:hover:from-orange-600 md:hover:to-red-600 text-white md:shadow-orange-500/30 md:hover:shadow-xl md:hover:shadow-orange-500/40 md:hover:scale-105 md:active:scale-95"
                    : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed opacity-60"
                    }`}
                >
                  XUẤT BÁN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sales History Modal */}
      <SalesHistoryModal
        isOpen={showSalesHistory}
        onClose={() => {
          setShowSalesHistory(false);
          // On mobile, switch back to products tab when closing history
          if (mobileTab === "history") {
            setMobileTab("products");
          }
        }}
        sales={repoSales}
        currentBranchId={currentBranchId}
        onPrintReceipt={handlePrintReceipt}
        onEditSale={handleEditSale}
        onDeleteSale={handleDeleteSale}
        page={salesMeta.page}
        totalPages={salesMeta.totalPages}
        total={salesMeta.total}
        hasMore={salesMeta.hasMore}
        pageSize={salesPageSize}
        onPrevPage={goPrevPage}
        onNextPage={() => {
          if (useKeysetMode) {
            const nextAfterDate = (pagedSalesData?.meta as any)?.nextAfterDate;
            const nextAfterId = (pagedSalesData?.meta as any)?.nextAfterId;
            if (nextAfterDate || nextAfterId) {
              setKeysetCursor({
                afterDate: nextAfterDate,
                afterId: nextAfterId,
              });
            }
          } else {
            goNextPage();
          }
        }}
        onPageSizeChange={changePageSize}
        search={salesSearchInput}
        onSearchChange={(s) => {
          setSalesSearchInput(s);
          if (!s) {
            // Khi xoá nhanh chuỗi tìm kiếm, reset ngay về trang 1 để UX tốt hơn
            setSalesPage(1);
          }
        }}
        fromDate={salesFromDate}
        toDate={salesToDate}
        onDateRangeChange={(from?: string, to?: string) => {
          setSalesFromDate(from);
          setSalesToDate(to);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        status={salesStatus}
        onStatusChange={(s) => {
          setSalesStatus(s);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        paymentMethodFilter={salesPaymentMethod}
        onPaymentMethodFilterChange={(m) => {
          setSalesPaymentMethod(m);
          setSalesPage(1);
          if (useKeysetMode) setKeysetCursor(null);
        }}
        keysetMode={useKeysetMode}
        onToggleKeyset={(checked) => {
          setUseKeysetMode(checked);
          setSalesPage(1);
          setKeysetCursor(null);
        }}
        customerDebts={customerDebts}
      />

      {/* Receipt Print Section (Hidden) - A5 Format */}
      {receiptId && (
        <div id="last-receipt" className="hidden print:block">
          <div
            style={{
              width: "148mm",
              minHeight: "210mm",
              margin: "0 auto",
              padding: "15mm",
              fontFamily: "Arial, sans-serif",
              fontSize: "12px",
              backgroundColor: "white",
              color: "#000",
              boxSizing: "border-box",
            }}
          >
            {/* Header - Logo bên trái, thông tin bên phải */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "15px",
                marginBottom: "20px",
                borderBottom: "2px solid #333",
                paddingBottom: "15px",
              }}
            >
              {/* Logo bên trái */}
              <img
                src={
                  storeSettings?.logo_url ||
                  "https://raw.githubusercontent.com/Nhan-Lam-SmartCare/Motocare/main/public/logo.png"
                }
                alt="Logo"
                style={{
                  width: "60px",
                  height: "60px",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              {/* Thông tin cửa hàng bên phải */}
              <div style={{ flex: 1 }}>
                <h1
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    margin: "0 0 5px 0",
                    color: "#1e40af",
                  }}
                >
                  {storeSettings?.store_name || "Nhạn-Lâm SmartCare"}
                </h1>
                <div style={{ fontSize: "11px", lineHeight: "1.5" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{
                        width: "12px",
                        height: "12px",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                      viewBox="0 0 24 24"
                      fill="#ef4444"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span>
                      {storeSettings?.address ||
                        "Ấp Phú Lợi B, Phú Thuận B, Hồng Ngự, Đồng Tháp"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{ width: "12px", height: "12px", flexShrink: 0 }}
                      viewBox="0 0 24 24"
                      fill="#16a34a"
                    >
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span>{storeSettings?.phone || "0947-747-907"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Info Section - giống ServiceManager: info bên trái, QR bên phải */}
            {storeSettings?.bank_name && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #dee2e6",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  marginBottom: "20px",
                  fontSize: "11px",
                }}
              >
                {/* Thông tin ngân hàng bên trái */}
                <div style={{ flex: 1, lineHeight: "1.5" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "3px",
                      color: "#1e40af",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <svg
                      style={{ width: "12px", height: "12px", flexShrink: 0 }}
                      viewBox="0 0 24 24"
                      fill="#0891b2"
                    >
                      <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                    </svg>
                    <span>Thông tin chuyển khoản:</span>
                  </div>
                  <div>
                    • Ngân hàng: <strong>{storeSettings.bank_name}</strong>
                  </div>
                  {storeSettings.bank_account_number && (
                    <div>
                      • Số tài khoản:{" "}
                      <strong style={{ color: "#2563eb" }}>
                        {storeSettings.bank_account_number}
                      </strong>
                    </div>
                  )}
                  {storeSettings.bank_account_holder && (
                    <div>
                      • Chủ tài khoản:{" "}
                      <strong>{storeSettings.bank_account_holder}</strong>
                    </div>
                  )}
                </div>
                {/* QR Code bên phải */}
                {storeSettings.bank_qr_url && (
                  <div style={{ flexShrink: 0 }}>
                    <img
                      src={storeSettings.bank_qr_url}
                      alt="QR Banking"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Invoice Title */}
            <div
              style={{
                textAlign: "center",
                marginBottom: "15px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  margin: "0 0 8px 0",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                HÓA ĐƠN BÁN HÀNG
              </h2>
              <div style={{ fontSize: "11px", color: "#666" }}>
                Số: <strong style={{ color: "#000" }}>{receiptId}</strong> -
                Ngày:{" "}
                <strong style={{ color: "#000" }}>
                  {formatDate(new Date(), true)}
                </strong>
              </div>
            </div>

            {/* Customer Info */}
            <div
              style={{
                marginBottom: "15px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontSize: "12px", lineHeight: "1.8" }}>
                <div>
                  <strong>Khách hàng:</strong> {customerName || "Khách lẻ"}
                </div>
                {customerPhone && (
                  <div>
                    <strong>Điện thoại:</strong> {customerPhone}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "15px",
                fontSize: "11px",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#f1f3f5",
                    borderTop: "2px solid #333",
                    borderBottom: "2px solid #333",
                  }}
                >
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      width: "8%",
                      fontWeight: "bold",
                    }}
                  >
                    STT
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 6px",
                      width: "37%",
                      fontWeight: "bold",
                    }}
                  >
                    Tên sản phẩm
                  </th>
                  <th
                    style={{
                      textAlign: "center",
                      padding: "8px 4px",
                      width: "10%",
                      fontWeight: "bold",
                    }}
                  >
                    SL
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      width: "20%",
                      fontWeight: "bold",
                    }}
                  >
                    Đơn giá
                  </th>
                  <th
                    style={{
                      textAlign: "right",
                      padding: "8px 6px",
                      width: "25%",
                      fontWeight: "bold",
                    }}
                  >
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, index) => (
                  <React.Fragment key={item.partId}>
                    <tr style={{ borderBottom: "1px solid #e9ecef" }}>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 4px",
                          verticalAlign: "top",
                        }}
                      >
                        {index + 1}
                      </td>
                      <td style={{ padding: "10px 6px", verticalAlign: "top" }}>
                        <div style={{ fontWeight: "600", marginBottom: "3px" }}>
                          {item.partName}
                        </div>
                        {item.sku && (
                          <div style={{ fontSize: "9px", color: "#868e96" }}>
                            SKU: {item.sku}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          padding: "10px 4px",
                          verticalAlign: "top",
                          fontWeight: "600",
                        }}
                      >
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 6px",
                          verticalAlign: "top",
                        }}
                      >
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "10px 6px",
                          verticalAlign: "top",
                          fontWeight: "600",
                        }}
                      >
                        {formatCurrency(item.sellingPrice * item.quantity)}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Summary Section */}
            <div
              style={{
                borderTop: "2px solid #333",
                paddingTop: "12px",
                marginBottom: "15px",
              }}
            >
              <table style={{ width: "100%", fontSize: "12px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 0", textAlign: "right" }}>
                      Tổng cộng ({receiptTotalQuantity} sản phẩm):
                    </td>
                    <td
                      style={{
                        padding: "6px 0 6px 20px",
                        textAlign: "right",
                        width: "30%",
                        fontWeight: "600",
                      }}
                    >
                      {formatCurrency(receiptSubtotal)}
                    </td>
                  </tr>
                  {receiptDiscount > 0 && (
                    <tr>
                      <td
                        style={{
                          padding: "6px 0",
                          textAlign: "right",
                          color: "#c92a2a",
                        }}
                      >
                        Giảm giá:
                      </td>
                      <td
                        style={{
                          padding: "6px 0 6px 20px",
                          textAlign: "right",
                          fontWeight: "600",
                          color: "#c92a2a",
                        }}
                      >
                        -{formatCurrency(receiptDiscount)}
                      </td>
                    </tr>
                  )}
                  <tr
                    style={{
                      borderTop: "1px solid #dee2e6",
                      fontSize: "14px",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 0",
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      TỔNG THANH TOÁN:
                    </td>
                    <td
                      style={{
                        padding: "10px 0 10px 20px",
                        textAlign: "right",
                        fontWeight: "bold",
                        fontSize: "16px",
                        color: "#2f9e44",
                      }}
                    >
                      {formatCurrency(receiptTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Method */}
            <div
              style={{
                marginBottom: "20px",
                padding: "10px 12px",
                backgroundColor: "#f8f9fa",
                borderRadius: "4px",
                fontSize: "11px",
              }}
            >
              <div style={{ marginBottom: "4px" }}>
                <strong>Hình thức thanh toán:</strong>{" "}
                {paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}
              </div>
              <div style={{ fontStyle: "italic", color: "#495057" }}>
                {paymentType === "full"
                  ? "✓ Đã thanh toán đủ"
                  : paymentType === "partial"
                    ? `Thanh toán một phần: ${formatCurrency(partialAmount)}`
                    : "Ghi nợ"}
              </div>
            </div>

            {/* Footer Signatures */}
            <div
              style={{
                marginTop: "30px",
                borderTop: "1px solid #dee2e6",
                paddingTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <div style={{ textAlign: "center", width: "40%" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "50px",
                      fontSize: "12px",
                    }}
                  >
                    Khách hàng
                  </div>
                  <div style={{ fontStyle: "italic", color: "#868e96" }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                </div>
                <div style={{ textAlign: "center", width: "40%" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "50px",
                      fontSize: "12px",
                    }}
                  >
                    Người bán hàng
                  </div>
                  <div style={{ fontStyle: "italic", color: "#868e96" }}>
                    (Ký và ghi rõ họ tên)
                  </div>
                </div>
              </div>
            </div>

            {/* Thank You Note */}
            <div
              style={{
                textAlign: "center",
                marginTop: "25px",
                paddingTop: "15px",
                borderTop: "1px dashed #adb5bd",
                fontSize: "11px",
                fontStyle: "italic",
                color: "#495057",
              }}
            >
              <div
                style={{
                  marginBottom: "5px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span style={{ display: "inline-flex" }}>
                  {/* Decorative star icon replaced by text to keep receipt plain; could inject SVG if needed */}
                  *
                </span>
                Cảm ơn quý khách đã sử dụng dịch vụ
                <span style={{ display: "inline-flex" }}>*</span>
              </div>
              <div>Hẹn gặp lại quý khách!</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Thêm khách hàng mới
              </h3>
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({
                    name: "",
                    phone: "",
                    vehicleModel: "",
                    licensePlate: "",
                  });
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tên khách hàng"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập số điện thoại"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Dòng xe
                </label>
                <input
                  type="text"
                  value={newCustomer.vehicleModel}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      vehicleModel: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Honda SH 2023"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={newCustomer.licensePlate}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      licensePlate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: 30A-12345"
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setNewCustomer({
                    name: "",
                    phone: "",
                    vehicleModel: "",
                    licensePlate: "",
                  });
                }}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveNewCustomer}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Xem trước hóa đơn
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareInvoice}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition"
                  title="Chia sẻ / Tải ảnh"
                >
                  <Share2 className="w-4 h-4" />
                  Chia sẻ
                </button>
                <button
                  onClick={handleDoPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  In hóa đơn
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreview(false);
                    setPrintSale(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Đóng"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Print Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900">
              <div
                ref={invoicePreviewRef}
                className="bg-white shadow-lg mx-auto"
                style={{ width: "80mm", minHeight: "100mm", color: "#000" }}
              >
                <div style={{ padding: "5mm" }}>
                  {/* Store Info Header - Logo bên trái, thông tin bên phải */}
                  <div
                    style={{
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "2mm",
                      marginBottom: "3mm",
                      display: "flex",
                      alignItems: "center",
                      gap: "3mm",
                    }}
                  >
                    {/* Logo bên trái */}
                    {storeSettings?.logo_url && (
                      <img
                        src={storeSettings.logo_url}
                        alt="Logo"
                        style={{
                          height: "14mm",
                          width: "14mm",
                          objectFit: "contain",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {/* Thông tin bên phải */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "10pt",
                          color: "#1e40af",
                          marginBottom: "1mm",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      {storeSettings?.address && (
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#000",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "1mm",
                            lineHeight: "1.3",
                          }}
                        >
                          <svg
                            style={{
                              width: "8px",
                              height: "8px",
                              flexShrink: 0,
                              marginTop: "1px",
                            }}
                            viewBox="0 0 24 24"
                            fill="#ef4444"
                          >
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                          </svg>
                          <span>{storeSettings.address}</span>
                        </div>
                      )}
                      {storeSettings?.phone && (
                        <div
                          style={{
                            fontSize: "7pt",
                            color: "#000",
                            display: "flex",
                            alignItems: "center",
                            gap: "1mm",
                          }}
                        >
                          <svg
                            style={{
                              width: "8px",
                              height: "8px",
                              flexShrink: 0,
                            }}
                            viewBox="0 0 24 24"
                            fill="#16a34a"
                          >
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                          <span>{storeSettings.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Date */}
                  <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                    <h1
                      style={{
                        fontSize: "14pt",
                        fontWeight: "bold",
                        margin: "0",
                        color: "#1e40af",
                      }}
                    >
                      HÓA ĐƠN BÁN HÀNG
                    </h1>
                    <div
                      style={{
                        fontSize: "8pt",
                        color: "#666",
                        marginTop: "1mm",
                      }}
                    >
                      {new Date(printSale.date).toLocaleString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: "8pt",
                        fontWeight: "bold",
                        marginTop: "0.5mm",
                      }}
                    >
                      Mã: {formatAnyId(printSale.id) || printSale.id}
                    </div>
                  </div>

                  {/* Customer Info - Compact */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      marginBottom: "3mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      fontSize: "8.5pt",
                    }}
                  >
                    <div style={{ marginBottom: "1mm" }}>
                      <span style={{ fontWeight: "bold" }}>KH:</span>{" "}
                      {printSale.customer.name}
                    </div>
                    {printSale.customer.phone && (
                      <div>
                        <span style={{ fontWeight: "bold" }}>SĐT:</span>{" "}
                        {printSale.customer.phone}
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      marginBottom: "3mm",
                      fontSize: "8.5pt",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid #ddd" }}>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "1mm",
                            fontSize: "8pt",
                          }}
                        >
                          Sản phẩm
                        </th>
                        <th
                          style={{
                            textAlign: "center",
                            padding: "1mm",
                            width: "15%",
                            fontSize: "8pt",
                          }}
                        >
                          SL
                        </th>
                        <th
                          style={{
                            textAlign: "right",
                            padding: "1mm",
                            width: "28%",
                            fontSize: "8pt",
                          }}
                        >
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {printSale.items.map((item: any, idx: number) => {
                        const price =
                          item.sellingPrice ||
                          item.sellingprice ||
                          item.price ||
                          0;
                        const qty = item.quantity || 0;
                        return (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px dashed #ddd" }}
                          >
                            <td
                              style={{
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                              }}
                            >
                              {item.partName || item.partname}
                            </td>
                            <td
                              style={{
                                textAlign: "center",
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                              }}
                            >
                              {qty}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                padding: "1.5mm 1mm",
                                fontSize: "8.5pt",
                                fontWeight: "bold",
                              }}
                            >
                              {formatCurrency(price * qty)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Total Summary */}
                  <div
                    style={{
                      borderTop: "2px solid #333",
                      paddingTop: "2mm",
                      marginBottom: "3mm",
                      fontSize: "9pt",
                    }}
                  >
                    {printSale.discount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "1mm",
                          color: "#e74c3c",
                        }}
                      >
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(printSale.discount)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontWeight: "bold",
                        fontSize: "11pt",
                      }}
                    >
                      <span>TỔNG CỘNG:</span>
                      <span style={{ color: "#2563eb" }}>
                        {formatCurrency(printSale.total)} ₫
                      </span>
                    </div>
                  </div>

                  {/* Bank Info Section - giống ServiceManager */}
                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        marginTop: "2mm",
                        border: "1px solid #ddd",
                        padding: "2mm",
                        borderRadius: "2mm",
                        backgroundColor: "#f0f9ff",
                        fontSize: "7.5pt",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "2mm",
                        }}
                      >
                        {/* Thông tin ngân hàng bên trái */}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#1e40af",
                              fontSize: "8pt",
                            }}
                          >
                            Chuyển khoản: {storeSettings.bank_name}
                          </div>
                          {storeSettings.bank_account_number && (
                            <div
                              style={{ color: "#2563eb", fontWeight: "bold" }}
                            >
                              STK: {storeSettings.bank_account_number}
                            </div>
                          )}
                          {storeSettings.bank_account_holder && (
                            <div>{storeSettings.bank_account_holder}</div>
                          )}
                        </div>
                        {/* QR Code bên phải */}
                        {storeSettings.bank_qr_url && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={storeSettings.bank_qr_url}
                              alt="QR Banking"
                              style={{
                                height: "18mm",
                                width: "18mm",
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: "7.5pt",
                      color: "#666",
                      borderTop: "1px dashed #999",
                      paddingTop: "2mm",
                    }}
                  >
                    <div>Cảm ơn quý khách!</div>
                    <div>Hẹn gặp lại</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Quét mã vạch sản phẩm"
      />

      {/* Quick Service Modal */}
      <QuickServiceModal
        isOpen={showQuickServiceModal}
        onClose={() => setShowQuickServiceModal(false)}
        onComplete={handleQuickServiceComplete}
        branchId={currentBranchId}
      />
    </div>
  );
};

export default SalesManager;
