import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  HandCoins,
  Plus,
  ChevronDown,
  Printer,
  Share2,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import type {
  WorkOrder,
  Part,
  WorkOrderPart,
  Customer,
  Vehicle,
} from "../../../types";
import { formatCurrency, formatWorkOrderId } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import { getCategoryColor } from "../../../utils/categoryColors";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
} from "../../../hooks/useWorkOrdersRepository";
import { useCreateCustomerDebtRepo } from "../../../hooks/useDebtsRepository";
import { showToast } from "../../../utils/toast";
import { printElementById } from "../../../utils/print";
import { supabase } from "../../../supabaseClient";
import {
  validatePhoneNumber,
  validateDepositAmount,
} from "../../../utils/validation";

export interface StoreSettings {
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
  work_order_prefix?: string;
}
const WorkOrderModal: React.FC<{
  order: WorkOrder;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  parts: Part[];
  partsLoading: boolean;
  customers: any[];
  employees: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  paymentSources: any[];
  currentBranchId: string;
  storeSettings?: StoreSettings | null;
}> = ({
  order,
  onClose,
  onSave,
  parts,
  partsLoading,
  customers,
  employees,
  upsertCustomer,
  setCashTransactions,
  setPaymentSources,
  paymentSources,
  currentBranchId,
  storeSettings,
}) => {
  // Popular motorcycle models in Vietnam
  const POPULAR_MOTORCYCLES = [
    // Honda
    "Honda Wave RSX",
    "Honda Wave Alpha",
    "Honda Blade",
    "Honda Future",
    "Honda Winner X",
    "Honda Vision",
    "Honda Air Blade",
    "Honda SH Mode",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Vario",
    "Honda Lead",
    "Honda PCX",
    "Honda ADV",
    // Yamaha
    "Yamaha Exciter",
    "Yamaha Sirius",
    "Yamaha Jupiter",
    "Yamaha Grande",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX",
    "Yamaha XSR",
    // Suzuki
    "Suzuki Raider",
    "Suzuki Axelo",
    "Suzuki Satria",
    "Suzuki GD110",
    "Suzuki Impulse",
    "Suzuki Address",
    "Suzuki Revo",
    // SYM
    "SYM Elite",
    "SYM Galaxy",
    "SYM Star",
    "SYM Attila",
    "SYM Angela",
    "SYM Passing",
    // Piaggio & Vespa
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa GTS",
    // VinFast
    "VinFast Klara",
    "VinFast Evo200",
    "VinFast Ludo",
    "VinFast Impes",
    "VinFast Theon",
    // Kh�c
    "Kh�c",
  ];

  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { mutateAsync: createWorkOrderAtomicAsync } =
    useCreateWorkOrderAtomicRepo();
  const { mutateAsync: updateWorkOrderAtomicAsync } =
    useUpdateWorkOrderAtomicRepo();

  const [formData, setFormData] = useState<Partial<WorkOrder>>(() => {
    if (order?.id) return order;
    return {
      id: order?.id || "",
      customerName: order?.customerName || "",
      customerPhone: order?.customerPhone || "",
      vehicleModel: order?.vehicleModel || "",
      licensePlate: order?.licensePlate || "",
      vehicleId: order?.vehicleId || "",
      currentKm: order?.currentKm || undefined,
      issueDescription: order?.issueDescription || "",
      technicianName: order?.technicianName || "",
      status: order?.status || "Tiếp nhận",
      laborCost: order?.laborCost || 0,
      discount: order?.discount || 0,
      partsUsed: order?.partsUsed || [],
      total: order?.total || 0,
      branchId: order?.branchId || currentBranchId,
      paymentStatus: order?.paymentStatus || "unpaid",
      creationDate: order?.creationDate || new Date().toISOString(),
    };
  });

  const [searchPart, setSearchPart] = useState("");
  const [selectedParts, setSelectedParts] = useState<WorkOrderPart[]>([]);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partialPayment, setPartialPayment] = useState(0);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    vehicleModel: "",
    licensePlate: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    model: "",
    licensePlate: "",
  });

  // Get customer's vehicles
  const currentCustomer = customers.find(
    (c) => c.phone === formData.customerPhone
  );
  const customerVehicles = currentCustomer?.vehicles || [];
  const hasMultipleVehicles = customerVehicles.length > 1;

  // Discount state
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [discountPercent, setDiscountPercent] = useState(0);

  // Submission guard to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Additional services state (B�o gi� - Gia c�ng/�t h�ng)
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      description: string;
      quantity: number;
      price: number;
      costPrice?: number; // Gi� nh�p (chi ph� gia c�ng b�n ngo�i)
    }>
  >([]);
  const [newService, setNewService] = useState({
    description: "",
    quantity: 1,
    price: 0,
    costPrice: 0,
  });

  // Sync selectedParts and deposit with formData on order change
  useEffect(() => {
    if (order?.partsUsed) {
      setSelectedParts(order.partsUsed);
    } else {
      setSelectedParts([]);
    }

    // Sync customer search
    if (order?.customerName) {
      setCustomerSearch(order.customerName);
    } else {
      setCustomerSearch("");
    }

    // Sync additional services (B�o gi�)
    if (order?.additionalServices) {
      setAdditionalServices(order.additionalServices);
    } else {
      setAdditionalServices([]);
    }

    // Sync deposit amount
    if (order?.depositAmount) {
      setDepositAmount(order.depositAmount);
      setShowDepositInput(true);
    } else {
      setDepositAmount(0);
      setShowDepositInput(false);
    }

    // Sync partial payment
    if (order?.additionalPayment) {
      setPartialPayment(order.additionalPayment);
      setShowPartialPayment(true);
    } else {
      setPartialPayment(0);
      setShowPartialPayment(false);
    }

    // Reset discount type to amount when opening/changing order
    setDiscountType("amount");
    setDiscountPercent(0);
  }, [order]);

  // Filter customers based on search - show all if search is empty
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) {
      // Show all customers when no search term
      return customers.slice(0, 10); // Limit to first 10 for performance
    }

    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        (c.vehicles && c.vehicles.some((v: any) => v.licensePlate?.toLowerCase().includes(q)))
    );
  }, [customers, customerSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".customer-search-container")) {
        setShowCustomerDropdown(false);
      }
      if (!target.closest(".vehicle-search-container")) {
        setShowVehicleDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle vehicle selection
  const handleSelectVehicle = (vehicle: any) => {
    setFormData({
      ...formData,
      vehicleId: vehicle.id,
      vehicleModel: vehicle.model,
      licensePlate: vehicle.licensePlate,
    });
    setShowVehicleDropdown(false);
  };

  // Handler: Add new vehicle to current customer
  const handleAddVehicle = () => {
    if (!currentCustomer) return;
    if (!newVehicle.model.trim() || !newVehicle.licensePlate.trim()) {
      showToast.error(
        "Vui l�ng nh�p ��y �� lo�i xe v� bi�n s�"
      );
      return;
    }

    const vehicleId = `VEH-${Date.now()}`;
    const existingVehicles = currentCustomer.vehicles || [];

    const updatedVehicles = [
      ...existingVehicles,
      {
        id: vehicleId,
        model: newVehicle.model.trim(),
        licensePlate: newVehicle.licensePlate.trim(),
        isPrimary: existingVehicles.length === 0, // First vehicle is primary
      },
    ];

    // Update customer with new vehicle
    upsertCustomer({
      ...currentCustomer,
      vehicles: updatedVehicles,
    });

    // Auto-select the newly added vehicle
    setFormData({
      ...formData,
      vehicleId: vehicleId,
      vehicleModel: newVehicle.model.trim(),
      licensePlate: newVehicle.licensePlate.trim(),
    });

    // Reset and close modal
    setNewVehicle({ model: "", licensePlate: "" });
    setShowAddVehicleModal(false);
    showToast.success("� th�m xe m�:i");
  };

  // Calculate totals
  const partsTotal = selectedParts.reduce(
    (sum, p) => sum + (p.price || 0) * (p.quantity || 0),
    0
  );
  const servicesTotal = additionalServices.reduce(
    (sum, s) => sum + (s.price || 0) * (s.quantity || 0),
    0
  );
  const subtotal = (formData.laborCost || 0) + partsTotal + servicesTotal;
  const discount = formData.discount || 0;
  const total = Math.max(0, subtotal - discount);

  // Debug log
  console.log("Tinh toan:", {
    laborCost: formData.laborCost,
    partsTotal,
    servicesTotal,
    subtotal,
    discount,
    total,
  });

  // Calculate payment summary
  const totalDeposit = depositAmount || 0;
  const totalAdditionalPayment = showPartialPayment ? partialPayment : 0;
  const totalPaid = totalDeposit + totalAdditionalPayment;
  const remainingAmount = Math.max(0, total - totalPaid);

  // Helper: Auto-create customer debt if there's remaining amount
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const createCustomerDebtIfNeeded = async (
    workOrder: WorkOrder,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    console.log("[createCustomerDebtIfNeeded] CALLED with:", {
      workOrderId: workOrder.id,
      totalAmount,
      paidAmount,
      remainingAmount,
      customerName: workOrder.customerName,
      timestamp: new Date().toISOString(),
    });

    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Kh�ch v�ng lai";

      // T�o n�"i dung chi ti�t t� phi�u s�a ch�a
      const workOrderNumber =
        formatWorkOrderId(workOrder.id, storeSettings?.work_order_prefix)
          .split("-")
          .pop() || "";

      let description = `${
        workOrder.vehicleModel || "Xe"
      } (Phi�u s�a ch�a #${workOrderNumber})`;

      // M� t� v�n ��
      if (workOrder.issueDescription) {
        description += `\nV�n ��: ${workOrder.issueDescription}`;
      }

      // Danh s�ch ph� t�ng �� s� d�ng
      if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
        description += "\n\nPh� t�ng �� thay:";
        workOrder.partsUsed.forEach((part) => {
          description += `\n  " ${part.quantity} x ${
            part.partName
          } - ${formatCurrency(part.price * part.quantity)}`;
        });
      }

      // Danh s�ch d�9ch v� b�" sung (gia c�ng, ��t h�ng)
      if (
        workOrder.additionalServices &&
        workOrder.additionalServices.length > 0
      ) {
        description += "\n\nD�9ch v�:";
        workOrder.additionalServices.forEach((service) => {
          description += `\n  " ${service.quantity} x ${
            service.description
          } - ${formatCurrency(service.price * service.quantity)}`;
        });
      }

      // C�ng lao ��"ng
      if (workOrder.laborCost && workOrder.laborCost > 0) {
        description += `\n\nC�ng lao ��"ng: ${formatCurrency(
          workOrder.laborCost
        )}`;
      }

      // Gi�m gi� (n�u c�)
      if (workOrder.discount && workOrder.discount > 0) {
        description += `\nGi�m gi�: -${formatCurrency(workOrder.discount)}`;
      }

      // Th�ng tin nh�n vi�n t�o phi�u
      const createdByDisplay = profile?.name || profile?.full_name || "N/A";
      description += `\n\nNV: ${createdByDisplay}`;

      // Th�ng tin nh�n vi�n k� thu�t
      if (workOrder.technicianName) {
        description += `\nNVK� thu�t: ${workOrder.technicianName}`;
      }

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: workOrder.customerPhone || null,
        licensePlate: workOrder.licensePlate || null,
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        workOrderId: workOrder.id, // �x� Link debt v�:i work order
      };

      console.log("[ServiceManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[ServiceManager] createCustomerDebt result:", result);
      showToast.success(
        `� t�o/c�p nh�t c�ng n� ${remainingAmount.toLocaleString()}� (M�: ${
          result?.id || "N/A"
        })`
      );
    } catch (error) {
      console.error("Error creating/updating customer debt:", error);
      showToast.error(
        "Kh�ng th� t�o/c�p nh�t c�ng n� t� ��"ng"
      );
    }
  };

  // �x� Function to handle deposit (��t c�c �� ��t h�ng)
  const handleDeposit = async () => {
    // Validation
    if (!formData.customerName?.trim()) {
      showToast.error("Vui l�ng nh�p t�n kh�ch h�ng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui l�ng nh�p s� �i�!n tho�i");
      return;
    }

    // Validate phone number format using utility
    const phoneValidation = validatePhoneNumber(formData.customerPhone);
    if (!phoneValidation.ok) {
      showToast.error(
        phoneValidation.error || "S� �i�!n tho�i kh�ng h�p l�!"
      );
      return;
    }

    if (depositAmount <= 0) {
      showToast.error("Vui l�ng nh�p s� ti�n ��t c�c");
      return;
    }

    // Validate deposit amount using utility
    const depositValidation = validateDepositAmount(depositAmount, total);
    if (!depositValidation.ok) {
      showToast.error(
        depositValidation.error || "Ti�n ��t c�c kh�ng h�p l�!"
      );
      return;
    }

    if (!formData.paymentMethod) {
      showToast.error("Vui l�ng ch�n ph��ng th�c thanh to�n");
      return;
    }

    try {
      const orderId =
        formData.id ||
        `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

      // Prepare work order data with deposit
      const workOrderData: WorkOrder = {
        id: orderId,
        customerName: formData.customerName || "",
        customerPhone: formData.customerPhone || "",
        vehicleId: formData.vehicleId,
        vehicleModel: formData.vehicleModel || "",
        licensePlate: formData.licensePlate || "",
        issueDescription: formData.issueDescription || "",
        technicianName: formData.technicianName || "",
        status: formData.status || "Ti�p nh�n",
        laborCost: formData.laborCost || 0,
        discount: discount,
        partsUsed: selectedParts,
        additionalServices:
          additionalServices.length > 0 ? additionalServices : undefined,
        total: total,
        branchId: currentBranchId,
        depositAmount: depositAmount,
        depositDate: new Date().toISOString(),
        paymentStatus: "partial",
        paymentMethod: formData.paymentMethod,
        totalPaid: depositAmount,
        remainingAmount: total - depositAmount,
        creationDate: formData.creationDate || new Date().toISOString(),
      };

      // Save to database using Supabase
      if (formData.id) {
        // Update existing work order
        await supabase
          .from("work_orders")
          .update({
            customername: workOrderData.customerName,
            customerphone: workOrderData.customerPhone,
            vehicleid: workOrderData.vehicleId,
            vehiclemodel: workOrderData.vehicleModel,
            licenseplate: workOrderData.licensePlate,
            issuedescription: workOrderData.issueDescription,
            technicianname: workOrderData.technicianName,
            status: workOrderData.status,
            laborcost: workOrderData.laborCost,
            discount: workOrderData.discount,
            partsused: workOrderData.partsUsed,
            additionalservices: workOrderData.additionalServices,
            total: workOrderData.total,
            depositamount: workOrderData.depositAmount,
            depositdate: workOrderData.depositDate,
            paymentstatus: workOrderData.paymentStatus,
            paymentmethod: workOrderData.paymentMethod,
            totalpaid: workOrderData.totalPaid,
            remainingamount: workOrderData.remainingAmount,
          })
          .eq("id", formData.id);
      } else {
        // Insert new work order
        await supabase.from("work_orders").insert({
          id: workOrderData.id,
          customername: workOrderData.customerName,
          customerphone: workOrderData.customerPhone,
          vehicleid: workOrderData.vehicleId,
          vehiclemodel: workOrderData.vehicleModel,
          licenseplate: workOrderData.licensePlate,
          issuedescription: workOrderData.issueDescription,
          technicianname: workOrderData.technicianName,
          status: workOrderData.status,
          laborcost: workOrderData.laborCost,
          discount: workOrderData.discount,
          partsused: workOrderData.partsUsed,
          additionalservices: workOrderData.additionalServices,
          total: workOrderData.total,
          branchid: workOrderData.branchId,
          depositamount: workOrderData.depositAmount,
          depositdate: workOrderData.depositDate,
          paymentstatus: workOrderData.paymentStatus,
          paymentmethod: workOrderData.paymentMethod,
          totalpaid: workOrderData.totalPaid,
          remainingamount: workOrderData.remainingAmount,
          creationDate: workOrderData.creationDate,
        });
      }

      // Create deposit cash transaction (Thu ti�n c�c v�o qu�)
      const depositTxId = `TX-${Date.now()}-DEP`;
      await supabase.from("cash_transactions").insert({
        id: depositTxId,
        type: "income",
        category: "service_deposit",
        amount: depositAmount,
        date: new Date().toISOString(),
        description: `�t c�c s�a ch�a #${orderId.split("-").pop()} - ${
          formData.customerName
        }`,
        branchid: currentBranchId,
        paymentsource: formData.paymentMethod,
        reference: orderId,
      });

      // Create expense transaction (Phi�u chi �� ��t h�ng)
      const expenseTxId = `TX-${Date.now()}-EXP`;
      await supabase.from("cash_transactions").insert({
        id: expenseTxId,
        type: "expense",
        category: "parts_purchase",
        amount: depositAmount,
        date: new Date().toISOString(),
        description: `�t h�ng ph� t�ng cho #${orderId
          .split("-")
          .pop()} - ${formData.customerName}`,
        branchid: currentBranchId,
        paymentsource: formData.paymentMethod,
        reference: orderId,
      });

      // Update UI state
      workOrderData.depositTransactionId = depositTxId;
      onSave(workOrderData);

      showToast.success(
        "� ��t c�c th�nh c�ng! Phi�u chi ��t h�ng �� ���c t�o."
      );
      onClose();
    } catch (error: any) {
      console.error("Error processing deposit:", error);
      showToast.error("L�i khi x� l� ��t c�c");
    }
  };

  // �x� Function to save work order without payment processing
  const handleSaveOnly = async () => {
    // Validation
    if (!formData.customerName?.trim()) {
      showToast.error("Vui l�ng nh�p t�n kh�ch h�ng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui l�ng nh�p s� �i�!n tho�i");
      return;
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.customerPhone.trim())) {
      showToast.error(
        "S� �i�!n tho�i kh�ng h�p l�! (c�n 10-11 ch� s�)"
      );
      return;
    }

    // Note: Kh�ng validate total > 0 v� c� th� ch�0 ti�p nh�n th�ng tin, ch�a b�o gi�

    // Add/update customer
    if (formData.customerName && formData.customerPhone) {
      const existingCustomer = customers.find(
        (c) => c.phone === formData.customerPhone
      );

      if (!existingCustomer) {
        const duplicatePhone = customers.find(
          (c) =>
            c.phone === formData.customerPhone &&
            formData.customerName &&
            c.name.toLowerCase() !== formData.customerName.toLowerCase()
        );

        if (duplicatePhone) {
          showToast.warning(
            `ST �� t�n t�i cho kh�ch "${duplicatePhone.name}". C� th� tr�ng l�p?`
          );
        }

        const vehicleId = `VEH-${Date.now()}`;
        const vehicles = [];
        if (formData.vehicleModel || formData.licensePlate) {
          vehicles.push({
            id: vehicleId,
            model: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            isPrimary: true,
          });
        }

        upsertCustomer({
          id: `CUST-${Date.now()}`,
          name: formData.customerName,
          phone: formData.customerPhone,
          vehicles: vehicles.length > 0 ? vehicles : undefined,
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          status: "active",
          segment: "New",
          loyaltyPoints: 0,
          totalSpent: 0,
          visitCount: 1,
          lastVisit: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      }
    }

    // Determine payment status based on existing payments only (not new ones)
    let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
    const existingPaid =
      (order?.depositAmount || 0) + (order?.additionalPayment || 0);
    if (existingPaid >= total) {
      paymentStatus = "paid";
    } else if (existingPaid > 0) {
      paymentStatus = "partial";
    }

    try {
      const orderId =
        order?.id ||
        `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

      const workOrderData = {
        id: orderId,
        customername: formData.customerName || "",
        customerphone: formData.customerPhone || "",
        vehicleid: formData.vehicleId,
        vehiclemodel: formData.vehicleModel || "",
        licenseplate: formData.licensePlate || "",
        issuedescription: formData.issueDescription || "",
        technicianname: formData.technicianName || "",
        status: formData.status || "Ti�p nh�n",
        laborcost: formData.laborCost || 0,
        discount: discount,
        partsused: selectedParts,
        additionalservices:
          additionalServices.length > 0 ? additionalServices : undefined,
        total: total,
        branchid: currentBranchId,
        paymentstatus: paymentStatus,
        paymentmethod: formData.paymentMethod || null,
        depositamount: order?.depositAmount || null,
        totalpaid: existingPaid > 0 ? existingPaid : null,
        remainingamount: total - existingPaid,
        creationdate: order?.creationDate || new Date().toISOString(),
      };

      // Save to Supabase database
      if (order?.id) {
        // Update existing
        const { data, error } = await supabase
          .from("work_orders")
          .update(workOrderData)
          .eq("id", order.id)
          .select();

        if (error) {
          console.error("[UPDATE ERROR]", error);
          throw error;
        }
        console.log("[UPDATE SUCCESS]", data);
      } else {
        // Insert new
        console.log("[INSERT] Attempting to insert:", workOrderData);
        const { data, error } = await supabase
          .from("work_orders")
          .insert(workOrderData)
          .select();

        if (error) {
          console.error("[INSERT ERROR]", error);
          console.error(
            "[INSERT ERROR DETAILS]",
            JSON.stringify(error, null, 2)
          );
          throw error;
        }
        console.log("[INSERT SUCCESS]", data);
      }

      onSave(workOrderData as unknown as WorkOrder);
      showToast.success(
        order?.id ? "� c�p nh�t phi�u" : "� l�u phi�u th�nh c�ng"
      );
      onClose();
    } catch (error: any) {
      console.error("Error saving work order:", error);
      showToast.error(
        "L�i khi l�u phi�u: " +
          (error.message || error.hint || "Kh�ng x�c ��9nh")
      );
    }
  };

  // �x� Function to handle payment processing
  const handleSave = async () => {
    // �x� PREVENT DUPLICATE SUBMISSIONS
    if (isSubmitting) {
      console.log("[handleSave] Already submitting, skipping...");
      return;
    }

    setIsSubmitting(true);

    try {
      // �x� VALIDATION FRONTEND
      // 1. Validate customer name & phone required
      if (!formData.customerName?.trim()) {
        showToast.error("Vui l�ng nh�p t�n kh�ch h�ng");
        return;
      }
      if (!formData.customerPhone?.trim()) {
        showToast.error("Vui l�ng nh�p s� �i�!n tho�i");
        return;
      }

      // 2. Validate phone format (10-11 digits)
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(formData.customerPhone.trim())) {
        showToast.error(
          "S� �i�!n tho�i kh�ng h�p l�! (c�n 10-11 ch� s�)"
        );
        return;
      }

      // 3. Validate total > 0
      if (total <= 0) {
        showToast.error("T�"ng ti�n ph�i l�:n h�n 0");
        return;
      }

      // Add/update customer with duplicate check
      if (formData.customerName && formData.customerPhone) {
        const existingCustomer = customers.find(
          (c) => c.phone === formData.customerPhone
        );

        // �x� VALIDATE DUPLICATE PHONE
        if (!existingCustomer) {
          // Check if phone belongs to different customer name
          const duplicatePhone = customers.find(
            (c) =>
              c.phone === formData.customerPhone &&
              formData.customerName &&
              c.name.toLowerCase() !== formData.customerName.toLowerCase()
          );

          if (duplicatePhone) {
            showToast.warning(
              `ST �� t�n t�i cho kh�ch "${duplicatePhone.name}". C� th� tr�ng l�p?`
            );
          }

          const vehicleId = `VEH-${Date.now()}`;
          const vehicles = [];
          if (formData.vehicleModel || formData.licensePlate) {
            vehicles.push({
              id: vehicleId,
              model: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              isPrimary: true,
            });
          }

          upsertCustomer({
            id: `CUST-${Date.now()}`,
            name: formData.customerName,
            phone: formData.customerPhone,
            vehicles: vehicles.length > 0 ? vehicles : undefined,
            vehicleModel: formData.vehicleModel,
            licensePlate: formData.licensePlate,
            status: "active",
            segment: "New",
            loyaltyPoints: 0,
            totalSpent: 0,
            visitCount: 1,
            lastVisit: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        }
      }

      // Determine payment status
      let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
      if (totalPaid >= total) {
        paymentStatus = "paid";
      } else if (totalPaid > 0) {
        paymentStatus = "partial";
      }

      // If this is a NEW work order (with parts OR additionalServices OR deposit), use atomic RPC
      if (
        !order?.id &&
        (selectedParts.length > 0 ||
          additionalServices.length > 0 ||
          depositAmount > 0)
      ) {
        try {
          const orderId = `${
            storeSettings?.work_order_prefix || "SC"
          }-${Date.now()}`;

          const responseData = await createWorkOrderAtomicAsync({
            id: orderId,
            customerName: formData.customerName || "",
            customerPhone: formData.customerPhone || "",
            vehicleModel: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            issueDescription: formData.issueDescription || "",
            technicianName: formData.technicianName || "",
            status: formData.status || "Ti�p nh�n",
            laborCost: formData.laborCost || 0,
            discount: discount,
            partsUsed: selectedParts,
            additionalServices:
              additionalServices.length > 0 ? additionalServices : undefined,
            total: total,
            branchId: currentBranchId,
            paymentStatus: paymentStatus,
            paymentMethod: formData.paymentMethod,
            depositAmount: depositAmount > 0 ? depositAmount : undefined,
            additionalPayment:
              totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
            totalPaid: totalPaid > 0 ? totalPaid : undefined,
            remainingAmount: remainingAmount,
            creationDate: new Date().toISOString(),
          } as any);

          // Extract transaction IDs from response
          const depositTxId = responseData?.depositTransactionId;
          const paymentTxId = responseData?.paymentTransactionId;

          // Create the finalOrder object to update the UI state
          const finalOrder: WorkOrder = {
            id: orderId,
            customerName: formData.customerName || "",
            customerPhone: formData.customerPhone || "",
            vehicleModel: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            issueDescription: formData.issueDescription || "",
            technicianName: formData.technicianName || "",
            status: formData.status || "Ti�p nh�n",
            laborCost: formData.laborCost || 0,
            discount: discount,
            partsUsed: selectedParts,
            additionalServices:
              additionalServices.length > 0 ? additionalServices : undefined,
            total: total,
            branchId: currentBranchId,
            depositAmount: depositAmount > 0 ? depositAmount : undefined,
            depositDate:
              depositAmount > 0 ? new Date().toISOString() : undefined,
            depositTransactionId: depositTxId,
            paymentStatus: paymentStatus,
            paymentMethod: formData.paymentMethod,
            additionalPayment:
              totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
            totalPaid: totalPaid > 0 ? totalPaid : undefined,
            remainingAmount: remainingAmount,
            cashTransactionId: paymentTxId,
            paymentDate: paymentTxId ? new Date().toISOString() : undefined,
            creationDate: new Date().toISOString(),
          };

          // Update cash transactions in context (for UI consistency)
          // 🔹 Also INSERT to database for persistence
          if (depositTxId && depositAmount > 0) {
            // INSERT deposit transaction to database
            try {
              const { error: depositDbError } = await supabase
                .from("cash_transactions")
                .insert({
                  id: depositTxId,
                  type: "income",
                  category: "service_deposit",
                  amount: depositAmount,
                  date: new Date().toISOString(),
                  description: `Dat coc sua chua #${(
                    formatWorkOrderId(orderId, storeSettings?.work_order_prefix) || ""
                  ).split("-").pop()} - ${formData.customerName}`,
                  branchid: currentBranchId,
                  paymentsource: formData.paymentMethod,
                  workorderid: orderId,
                });
              if (depositDbError) {
                console.error("[WorkOrderModal] deposit insert error:", depositDbError);
              }
            } catch (e) {
              console.error("[WorkOrderModal] deposit insert exception:", e);
            }

            setCashTransactions((prev: any[]) => [
              ...prev,
              {
                id: depositTxId,
                type: "income",
                category: "service_deposit",
                amount: depositAmount,
                date: new Date().toISOString(),
                description: `�t c�c s�a ch�a #${(
                  formatWorkOrderId(
                    orderId,
                    storeSettings?.work_order_prefix
                  ) || ""
                )
                  .split("-")
                  .pop()} - ${formData.customerName}`,
                branchId: currentBranchId,
                paymentSource: formData.paymentMethod,
                reference: orderId,
              },
            ]);

            setPaymentSources((prev: any[]) =>
              prev.map((ps) => {
                if (ps.id === formData.paymentMethod) {
                  return {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance[currentBranchId] || 0) + depositAmount,
                    },
                  };
                }
                return ps;
              })
            );
          }

          if (paymentTxId && totalAdditionalPayment > 0) {
            // INSERT payment transaction to database
            try {
              const { error: paymentDbError } = await supabase
                .from("cash_transactions")
                .insert({
                  id: paymentTxId,
                  type: "income",
                  category: "service_income",
                  amount: totalAdditionalPayment,
                  date: new Date().toISOString(),
                  description: `Thu tien sua chua #${(
                    formatWorkOrderId(orderId, storeSettings?.work_order_prefix) || ""
                  ).split("-").pop()} - ${formData.customerName}`,
                  branchid: currentBranchId,
                  paymentsource: formData.paymentMethod,
                  workorderid: orderId,
                });
              if (paymentDbError) {
                console.error("[WorkOrderModal] payment insert error:", paymentDbError);
              }
            } catch (e) {
              console.error("[WorkOrderModal] payment insert exception:", e);
            }

            setCashTransactions((prev: any[]) => [
              ...prev,
              {
                id: paymentTxId,
                type: "income",
                category: "service_income",
                amount: totalAdditionalPayment,
                date: new Date().toISOString(),
                description: `Thu ti�n s�a ch�a #${(
                  formatWorkOrderId(
                    orderId,
                    storeSettings?.work_order_prefix
                  ) || ""
                )
                  .split("-")
                  .pop()} - ${formData.customerName}`,
                branchId: currentBranchId,
                paymentSource: formData.paymentMethod,
                reference: orderId,
              },
            ]);

            setPaymentSources((prev: any[]) =>
              prev.map((ps) => {
                if (ps.id === formData.paymentMethod) {
                  return {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance[currentBranchId] || 0) +
                        totalAdditionalPayment,
                    },
                  };
                }
                return ps;
              })
            );
          }

          // �x� Create cash transactions for outsourcing costs (Gi� nh�p t� gia c�ng b�n ngo�i)
          if (additionalServices.length > 0) {
            const totalOutsourcingCost = additionalServices.reduce(
              (sum, service) =>
                sum + (service.costPrice || 0) * service.quantity,
              0
            );

            if (totalOutsourcingCost > 0) {
              const outsourcingTxId = `EXPENSE-${Date.now()}`;

              // Create expense transaction
              try {
                console.log("[Outsourcing] Inserting expense transaction:", {
                  id: outsourcingTxId,
                  amount: -totalOutsourcingCost,
                  branchid: currentBranchId,
                });
                
                const { error: expenseError } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: outsourcingTxId,
                    type: "expense",
                    category: "outsourcing",
                    amount: -totalOutsourcingCost, // Negative for expense
                    date: new Date().toISOString(),
                    description: `Chi phí gia công bên ngoài - Phiếu #${orderId
                      .split("-")
                      .pop()} - ${additionalServices
                      .map((s) => s.description)
                      .join(", ")}`,
                    branchid: currentBranchId,
                    paymentsource: "cash",
                    reference: orderId,
                  });

                if (expenseError) {
                  console.error("[Outsourcing] Insert FAILED:", expenseError);
                  showToast.error(`Lỗi tạo phiếu chi gia công: ${expenseError.message}`);
                } else {
                  console.log("[Outsourcing] Insert SUCCESS");
                  // Update context
                  setCashTransactions((prev: any[]) => [
                    ...prev,
                    {
                      id: outsourcingTxId,
                      type: "expense",
                      category: "outsourcing",
                      amount: -totalOutsourcingCost,
                      date: new Date().toISOString(),
                      description: `Chi ph� gia c�ng b�n ngo�i - Phi�u #${orderId
                        .split("-")
                        .pop()}`,
                      branchId: currentBranchId,
                      paymentSource: "cash",
                      reference: orderId,
                    },
                  ]);

                  // Update payment sources balance
                  setPaymentSources((prev: any[]) =>
                    prev.map((ps) => {
                      if (ps.id === "cash") {
                        return {
                          ...ps,
                          balance: {
                            ...ps.balance,
                            [currentBranchId]:
                              (ps.balance[currentBranchId] || 0) -
                              totalOutsourcingCost,
                          },
                        };
                      }
                      return ps;
                    })
                  );

                  showToast.info(
                    `� t�o phi�u chi ${formatCurrency(
                      totalOutsourcingCost
                    )} cho gia c�ng b�n ngo�i`
                  );
                }
              } catch (err) {
                console.error("Error creating outsourcing expense:", err);
              }
            }
          }

          // Call onSave to update the workOrders state
          onSave(finalOrder);

          // �x� Auto-create customer debt ONLY when status is "Tr� m�y" and there's remaining amount
          if (formData.status === "Tr� m�y" && remainingAmount > 0) {
            console.log("[handleSave] Creating debt with finalOrder:", {
              id: finalOrder.id,
              customerName: finalOrder.customerName,
              customerPhone: finalOrder.customerPhone,
              licensePlate: finalOrder.licensePlate,
              vehicleModel: finalOrder.vehicleModel,
            });
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmount,
              total,
              totalPaid
            );
          }

          // Close modal after successful save
          onClose();
        } catch (error: any) {
          console.error("Error creating work order (atomic):", error);
          // Error toast is already shown by the hook's onError
        }
        return;
      }

      // �x� If this is an UPDATE (with or without parts), use atomic RPC
      if (order?.id) {
        console.log(
          "[handleSave] UPDATE block - Order ID:",
          order.id,
          "Status:",
          formData.status
        );
        try {
          console.log("[handleSave] Calling updateWorkOrderAtomicAsync...");
          const responseData = await updateWorkOrderAtomicAsync({
            id: order.id,
            customerName: formData.customerName || "",
            customerPhone: formData.customerPhone || "",
            vehicleModel: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            issueDescription: formData.issueDescription || "",
            technicianName: formData.technicianName || "",
            status: formData.status || "Ti�p nh�n",
            laborCost: formData.laborCost || 0,
            discount: discount,
            partsUsed: selectedParts,
            additionalServices:
              additionalServices.length > 0 ? additionalServices : undefined,
            total: total,
            branchId: currentBranchId,
            paymentStatus: paymentStatus,
            paymentMethod: formData.paymentMethod,
            depositAmount: depositAmount > 0 ? depositAmount : undefined,
            additionalPayment:
              totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
            totalPaid: totalPaid > 0 ? totalPaid : undefined,
            remainingAmount: remainingAmount,
          } as any);

          const workOrderRow = (responseData as any).workOrder;
          const depositTxId = responseData?.depositTransactionId;
          const paymentTxId = responseData?.paymentTransactionId;

          // �x� Transform snake_case response to camelCase for WorkOrder interface
          // If workOrderRow is undefined, build from formData + order
          const finalOrder: WorkOrder = workOrderRow
            ? {
                id: (workOrderRow as any).id || order.id,
                customerName:
                  (workOrderRow as any).customername ||
                  (workOrderRow as any).customerName ||
                  order.customerName,
                customerPhone:
                  (workOrderRow as any).customerphone ||
                  (workOrderRow as any).customerPhone ||
                  order.customerPhone,
                vehicleModel:
                  (workOrderRow as any).vehiclemodel ||
                  (workOrderRow as any).vehicleModel ||
                  order.vehicleModel,
                licensePlate:
                  (workOrderRow as any).licenseplate ||
                  (workOrderRow as any).licensePlate ||
                  order.licensePlate,
                issueDescription:
                  (workOrderRow as any).issuedescription ||
                  (workOrderRow as any).issueDescription ||
                  order.issueDescription ||
                  "",
                technicianName:
                  (workOrderRow as any).technicianname ||
                  (workOrderRow as any).technicianName ||
                  order.technicianName ||
                  "",
                status: (workOrderRow as any).status || order.status,
                laborCost:
                  (workOrderRow as any).laborcost ||
                  (workOrderRow as any).laborCost ||
                  order.laborCost ||
                  0,
                discount: (workOrderRow as any).discount || order.discount || 0,
                partsUsed:
                  (workOrderRow as any).partsused ||
                  (workOrderRow as any).partsUsed ||
                  order.partsUsed ||
                  [],
                additionalServices:
                  (workOrderRow as any).additionalservices ||
                  (workOrderRow as any).additionalServices ||
                  order.additionalServices,
                total: (workOrderRow as any).total || order.total,
                branchId:
                  (workOrderRow as any).branchid ||
                  (workOrderRow as any).branchId ||
                  order.branchId,
                depositAmount:
                  (workOrderRow as any).depositamount ||
                  (workOrderRow as any).depositAmount ||
                  order.depositAmount,
                depositDate:
                  (workOrderRow as any).depositdate ||
                  (workOrderRow as any).depositDate ||
                  order.depositDate,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus:
                  (workOrderRow as any).paymentstatus ||
                  (workOrderRow as any).paymentStatus ||
                  order.paymentStatus,
                paymentMethod:
                  (workOrderRow as any).paymentmethod ||
                  (workOrderRow as any).paymentMethod ||
                  order.paymentMethod,
                additionalPayment:
                  (workOrderRow as any).additionalpayment ||
                  (workOrderRow as any).additionalPayment ||
                  order.additionalPayment,
                totalPaid:
                  (workOrderRow as any).totalpaid ||
                  (workOrderRow as any).totalPaid ||
                  order.totalPaid,
                remainingAmount:
                  (workOrderRow as any).remainingamount ||
                  (workOrderRow as any).remainingAmount ||
                  order.remainingAmount,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate:
                  (workOrderRow as any).paymentdate ||
                  (workOrderRow as any).paymentDate ||
                  order.paymentDate,
                creationDate:
                  (workOrderRow as any).creationdate ||
                  (workOrderRow as any).creationDate ||
                  order.creationDate,
              }
            : {
                // Build from formData when workOrderRow is undefined
                ...order,
                customerName: formData.customerName || order.customerName,
                customerPhone: formData.customerPhone || order.customerPhone,
                vehicleModel: formData.vehicleModel || order.vehicleModel,
                licensePlate: formData.licensePlate || order.licensePlate,
                issueDescription:
                  formData.issueDescription || order.issueDescription,
                technicianName: formData.technicianName || order.technicianName,
                status: formData.status || order.status,
                laborCost: formData.laborCost || order.laborCost,
                discount: discount,
                partsUsed: selectedParts,
                additionalServices:
                  additionalServices.length > 0
                    ? additionalServices
                    : order.additionalServices,
                total: total,
                depositAmount: depositAmount,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus: paymentStatus,
                paymentMethod: formData.paymentMethod || order.paymentMethod,
                additionalPayment: totalAdditionalPayment,
                totalPaid: totalPaid,
                remainingAmount: remainingAmount,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate: paymentTxId
                  ? new Date().toISOString()
                  : order.paymentDate,
              };

          // Update cash transactions in context AND database if new transactions created
          if (depositTxId && depositAmount > order.depositAmount!) {
            const additionalDeposit = depositAmount - (order.depositAmount || 0);
            // INSERT additional deposit to database
            try {
              const { error: addDepositErr } = await supabase
                .from("cash_transactions")
                .insert({
                  id: depositTxId,
                  type: "income",
                  category: "service_deposit",
                  amount: additionalDeposit,
                  date: new Date().toISOString(),
                  description: `Dat coc bo sung #${(
                    formatWorkOrderId(order.id, storeSettings?.work_order_prefix) || ""
                  ).split("-").pop()} - ${formData.customerName}`,
                  branchid: currentBranchId,
                  paymentsource: formData.paymentMethod,
                  workorderid: order.id,
                });
              if (addDepositErr) {
                console.error("[WorkOrderModal-update] additional deposit error:", addDepositErr);
              }
            } catch (e) {
              console.error("[WorkOrderModal-update] additional deposit exception:", e);
            }

            setCashTransactions((prev: any[]) => [
              ...prev,
              {
                id: depositTxId,
                type: "income",
                category: "service_deposit",
                amount: depositAmount - (order.depositAmount || 0),
                date: new Date().toISOString(),
                description: `�t c�c b�" sung #${(
                  formatWorkOrderId(
                    order.id,
                    storeSettings?.work_order_prefix
                  ) || ""
                )
                  .split("-")
                  .pop()} - ${formData.customerName}`,
                branchId: currentBranchId,
                paymentSource: formData.paymentMethod,
                reference: order.id,
              },
            ]);

            setPaymentSources((prev: any[]) =>
              prev.map((ps) => {
                if (ps.id === formData.paymentMethod) {
                  return {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance[currentBranchId] || 0) +
                        (depositAmount - (order.depositAmount || 0)),
                    },
                  };
                }
                return ps;
              })
            );
          }

          if (
            paymentTxId &&
            totalAdditionalPayment > (order.additionalPayment || 0)
          ) {
            const additionalPaymentAmount = totalAdditionalPayment - (order.additionalPayment || 0);
            // INSERT additional payment to database
            try {
              const { error: addPaymentErr } = await supabase
                .from("cash_transactions")
                .insert({
                  id: paymentTxId,
                  type: "income",
                  category: "service_income",
                  amount: additionalPaymentAmount,
                  date: new Date().toISOString(),
                  description: `Thu tien bo sung #${(
                    formatWorkOrderId(order.id, storeSettings?.work_order_prefix) || ""
                  ).split("-").pop()} - ${formData.customerName}`,
                  branchid: currentBranchId,
                  paymentsource: formData.paymentMethod,
                  workorderid: order.id,
                });
              if (addPaymentErr) {
                console.error("[WorkOrderModal-update] additional payment error:", addPaymentErr);
              }
            } catch (e) {
              console.error("[WorkOrderModal-update] additional payment exception:", e);
            }

            setCashTransactions((prev: any[]) => [
              ...prev,
              {
                id: paymentTxId,
                type: "income",
                category: "service_income",
                amount: totalAdditionalPayment - (order.additionalPayment || 0),
                date: new Date().toISOString(),
                description: `Thu ti�n b�" sung #${(
                  formatWorkOrderId(
                    order.id,
                    storeSettings?.work_order_prefix
                  ) || ""
                )
                  .split("-")
                  .pop()} - ${formData.customerName}`,
                branchId: currentBranchId,
                paymentSource: formData.paymentMethod,
                reference: order.id,
              },
            ]);

            setPaymentSources((prev: any[]) =>
              prev.map((ps) => {
                if (ps.id === formData.paymentMethod) {
                  return {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance[currentBranchId] || 0) +
                        (totalAdditionalPayment -
                          (order.additionalPayment || 0)),
                    },
                  };
                }
                return ps;
              })
            );
          }

          console.log(
            "[handleSave] updateWorkOrderAtomicAsync SUCCESS - Response:",
            responseData
          );

          onSave(finalOrder);

          // �x� Auto-create customer debt ONLY when status is "Tr� m�y" and there's remaining amount
          if (formData.status === "Tr� m�y" && remainingAmount > 0) {
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmount,
              total,
              totalPaid
            );
          }

          // Close modal after successful update
          onClose();
        } catch (error: any) {
          console.error(
            "[handleSave] Error updating work order (atomic):",
            error
          );
        }
        return;
      }

      // If we get here, it means this is a NEW order without going through atomic create
      // This shouldn't happen in normal flow, but log it for debugging
      console.warn(
        "[handleSave] Unexpected code path - no atomic create/update was called"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPart = (part: Part) => {
    const existing = selectedParts.find((p) => p.partId === part.id);
    if (existing) {
      setSelectedParts(
        selectedParts.map((p) =>
          p.partId === part.id ? { ...p, quantity: p.quantity + 1 } : p
        )
      );
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku || "",
          category: part.category || "",
          quantity: 1,
          price: part.retailPrice[currentBranchId] || 0,
        },
      ]);
    }
    setShowPartSearch(false);
    setSearchPart("");
  };

  // Filter parts available at current branch with stock
  const availableParts = useMemo(() => {
    return parts.filter((part) => {
      const stock = part.stock?.[currentBranchId] || 0;
      return stock > 0;
    });
  }, [parts, currentBranchId]);

  // Filter parts based on search - show all available parts if search is empty
  const filteredParts = useMemo(() => {
    if (!searchPart.trim()) return availableParts;

    return availableParts.filter(
      (p) =>
        p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchPart.toLowerCase())
    );
  }, [availableParts, searchPart]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl rounded-t-3xl md:rounded-xl shadow-2xl md:shadow-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-xl flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formData.id
              ? `Chi ti�t phi�u s�a ch�a - ${formatWorkOrderId(
                  formData.id,
                  storeSettings?.work_order_prefix
                )}`
              : "T�o phi�u s�a ch�a m�:i"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="�ng"
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

        {/* Scrollable Content */}
        <div className="px-4 py-5 md:px-6 md:py-6 space-y-6 overflow-y-auto flex-1 pb-24 md:pb-6">
          {/* Customer & Vehicle Info */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Th�ng tin Kh�ch h�ng & S� c�
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kh�ch h�ng <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative customer-search-container">
                    <input
                      type="text"
                      placeholder="T�m kh�ch h�ng..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                        setFormData({
                          ...formData,
                          customerName: e.target.value,
                        });
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />

                    {/* Customer Dropdown */}
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                // Find primary vehicle or first vehicle
                                const primaryVehicle =
                                  customer.vehicles?.find(
                                    (v: Vehicle) => v.isPrimary
                                  ) || customer.vehicles?.[0];

                                setFormData({
                                  ...formData,
                                  customerName: customer.name,
                                  customerPhone: customer.phone,
                                  vehicleId: primaryVehicle?.id,
                                  vehicleModel:
                                    primaryVehicle?.model ||
                                    customer.vehicleModel ||
                                    "",
                                  licensePlate:
                                    primaryVehicle?.licensePlate ||
                                    customer.licensePlate ||
                                    "",
                                });
                                setCustomerSearch(customer.name);
                                setShowCustomerDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-600 last:border-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                                    {customer.name}
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                    �x� {customer.phone}
                                  </div>
                                  {(customer.vehicleModel ||
                                    customer.licensePlate) && (
                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <circle cx="6" cy="17" r="2" />
                                        <circle cx="18" cy="17" r="2" />
                                        <path d="M4 17h2l4-6h2l2 3h4" />
                                      </svg>
                                      {customer.vehicleModel && (
                                        <span>{customer.vehicleModel}</span>
                                      )}
                                      {customer.licensePlate && (
                                        <span className="font-mono font-medium">
                                          {customer.vehicleModel && """}{" "}
                                          {customer.licensePlate}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                            {customers.length === 0
                              ? "Ch�a c� kh�ch h�ng n�o. Nh�n '+' �� th�m kh�ch h�ng m�:i."
                              : "Kh�ng t�m th�y kh�ch h�ng ph� h�p"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xl"
                    title="Th�m kh�ch h�ng m�:i"
                  >
                    +
                  </button>
                </div>

                {/* Display customer info after selection */}
                {formData.customerName && formData.customerPhone && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formData.customerName}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.25 6.75c0 8.284 6.716 15 15 15 .828 0 1.5-.672 1.5-1.5v-2.25a1.5 1.5 0 00-1.5-1.5h-1.158a1.5 1.5 0 00-1.092.468l-.936.996a1.5 1.5 0 01-1.392.444 12.035 12.035 0 01-7.29-7.29 1.5 1.5 0 01.444-1.392l.996-.936a1.5 1.5 0 00.468-1.092V6.75A1.5 1.5 0 006.75 5.25H4.5c-.828 0-1.5.672-1.5 1.5z"
                              />
                            </svg>
                            {formData.customerPhone}
                          </span>
                        </div>
                        {(formData.vehicleModel || formData.licensePlate) && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-3.5 h-3.5"
                              >
                                <circle cx="6" cy="17" r="2" />
                                <circle cx="18" cy="17" r="2" />
                                <path d="M4 17h2l4-6h2l2 3h4" />
                              </svg>
                              {formData.vehicleModel}{" "}
                              {formData.licensePlate &&
                                `- ${formData.licensePlate}`}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearch("");
                          setFormData({
                            ...formData,
                            customerName: "",
                            customerPhone: "",
                            vehicleId: undefined,
                            vehicleModel: "",
                            licensePlate: "",
                          });
                        }}
                        className="text-slate-400 hover:text-red-500 text-sm flex items-center"
                        title="X�a kh�ch h�ng"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-4 h-4"
                          aria-hidden="true"
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
                )}

                {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                {currentCustomer && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        {customerVehicles.length > 0
                          ? "Ch�n xe"
                          : "Xe c�a kh�ch h�ng"}
                        {customerVehicles.length > 0 && (
                          <span className="text-xs text-slate-500 ml-1">
                            ({customerVehicles.length} xe)
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddVehicleModal(true)}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
                        title="Th�m xe m�:i"
                      >
                        + Th�m xe
                      </button>
                    </div>

                    {customerVehicles.length > 0 ? (
                      <div className="space-y-2">
                        {customerVehicles.map((vehicle: Vehicle) => {
                          const isSelected = formData.vehicleId === vehicle.id;
                          const isPrimary = vehicle.isPrimary;

                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              onClick={() => handleSelectVehicle(vehicle)}
                              className={`w-full text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                                  : "border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isPrimary && (
                                  <span
                                    className="text-yellow-500"
                                    title="Xe ch�nh"
                                  >
                                    P
                                  </span>
                                )}
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                    {vehicle.model}
                                  </div>
                                  <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                                    {vehicle.licensePlate}
                                  </div>
                                </div>
                                {isSelected && (
                                  <svg
                                    className="w-5 h-5 text-blue-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Ch�a c� xe n�o. Click "+ Th�m xe" �� th�m.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  S� KM hi�!n t�i
                </label>
                <input
                  type="number"
                  placeholder="15000"`n                  value={formData.currentKm || ""}`n                  onChange={(e) =>`n                    setFormData({`n                      ...formData,`n                      currentKm: e.target.value`n                        ? parseInt(e.target.value)`n                        : undefined,`n                    })`n                  }`n                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  M� t� s� c�
                </label>
                <textarea
                  rows={4}
                  placeholder="B�o d��ng ��9nh k�, thay nh�:t..."
                  value={formData.issueDescription || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      issueDescription: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Chi ti�t D�9ch v�
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tr�ng th�i
                  </label>
                  <select
                    value={formData.status || "Ti�p nh�n"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className={`w-full px-3 py-2 border rounded-lg font-medium ${
                      formData.status === "Ti�p nh�n"
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                        : formData.status === "ang s�a"
                        ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300"
                        : formData.status === "� s�a xong"
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                        : "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                    }`}
                  >
                    <option
                      value="Ti�p nh�n"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Ti�p nh�n
                    </option>
                    <option
                      value="ang s�a"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      ang s�a
                    </option>
                    <option
                      value="� s�a xong"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      � s�a xong
                    </option>
                    <option
                      value="Tr� m�y"
                      className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      Tr� m�y
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    K� thu�t vi�n
                  </label>
                  <select
                    value={formData.technicianName || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        technicianName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Ch�n k� thu�t vi�n --</option>
                    {employees
                      .filter(
                        (emp) =>
                          emp.status === "active" &&
                          (emp.department
                            ?.toLowerCase()
                            .includes("k� thu�t") ||
                            emp.position
                              ?.toLowerCase()
                              .includes("k� thu�t"))
                      )
                      .map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ph� d�9ch v� (C�ng th�)
                </label>
                <NumberInput
                  placeholder="100.000"
                  value={formData.laborCost || ""}
                  onChange={(val) =>
                    setFormData({
                      ...formData,
                      laborCost: val,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ghi ch� n�"i b�"
                </label>
                <textarea
                  rows={4}
                  placeholder="VD: Kh�ch y�u c�u ki�m tra th�m h�! th�ng �i�!n"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Parts Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Ph� t�ng s� d�ng
              </h3>
              <button
                onClick={() => setShowPartSearch(!showPartSearch)}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm flex items-center gap-1"
              >
                �~" Th�m ph� t�ng
              </button>
            </div>

            {showPartSearch && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="T�m ki�m ph� t�ng theo t�n ho�c SKU..."
                  value={searchPart}
                  onChange={(e) => setSearchPart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                  {partsLoading ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      ang t�i ph� t�ng...
                    </div>
                  ) : filteredParts.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      Kh�ng t�m th�y ph� t�ng
                    </div>
                  ) : (
                    filteredParts.slice(0, 10).map((part) => (
                      <button
                        key={part.id}
                        onClick={() => handleAddPart(part)}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {part.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                              {part.sku}
                            </span>
                            {part.category && (
                              <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg} ${getCategoryColor(part.category).text}`}>
                                {part.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(
                            part.retailPrice[currentBranchId] || 0
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                      T�n
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      SL
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      .Gi�
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      T.Ti�n
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {selectedParts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-400"
                      >
                        Ch�a c� ph� t�ng n�o
                      </td>
                    </tr>
                  ) : (
                    selectedParts.map((part, idx) => (
                      <tr key={idx} className="bg-white dark:bg-slate-800">
                        <td className="px-4 py-2">
                          <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                            {part.partName}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {part.sku && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                {part.sku}
                              </span>
                            )}
                            {part.category && (
                              <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg} ${getCategoryColor(part.category).text}`}>
                                {part.category}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={part.quantity}
                            onChange={(e) => {
                              const newQty = Number(e.target.value);
                              setSelectedParts(
                                selectedParts.map((p, i) =>
                                  i === idx ? { ...p, quantity: newQty } : p
                                )
                              );
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                          {formatCurrency(part.price)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(part.price * part.quantity)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() =>
                              setSelectedParts(
                                selectedParts.filter((_, i) => i !== idx)
                              )
                            }
                            className="text-red-500 hover:text-red-700"
                            aria-label="X�a ph� t�ng"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quote/Estimate Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              B�o gi� (Gia c�ng, �t h�ng)
            </h3>

            <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                      M� t�
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      SL
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      Gi� nh�p
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      �n gi�
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                      Th�nh ti�n
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                      <button
                        onClick={() => {
                          if (newService.description && newService.price > 0) {
                            setAdditionalServices([
                              ...additionalServices,
                              { ...newService, id: `SRV-${Date.now()}` },
                            ]);
                            setNewService({
                              description: "",
                              quantity: 1,
                              price: 0,
                              costPrice: 0,
                            });
                          }
                        }}
                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                      >
                        Th�m
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Existing services */}
                  {additionalServices.map((service) => (
                    <tr
                      key={service.id}
                      className="border-b border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                        {service.description}
                      </td>
                      <td className="px-4 py-2 text-center text-sm text-slate-900 dark:text-slate-100">
                        {service.quantity}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-orange-600 dark:text-orange-400">
                        {service.costPrice
                          ? formatCurrency(service.costPrice)
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-900 dark:text-slate-100">
                        {formatCurrency(service.price)}
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(service.price * service.quantity)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() =>
                            setAdditionalServices(
                              additionalServices.filter(
                                (s) => s.id !== service.id
                              )
                            )
                          }
                          className="text-red-500 hover:text-red-700 text-sm"
                          aria-label="X�a d�9ch v�"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Input row */}
                  <tr className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="M� t�..."
                        value={newService.description}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={newService.quantity}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            quantity: Number(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <NumberInput
                        placeholder="Giá nhập"
                        value={newService.costPrice || ""}
                        onChange={(val) =>
                          setNewService({
                            ...newService,
                            costPrice: val,
                          })
                        }
                        className="w-full px-2 py-1 border border-orange-300 dark:border-orange-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <NumberInput
                        placeholder="Đơn giá"
                        value={newService.price || ""}
                        onChange={(val) =>
                          setNewService({
                            ...newService,
                            price: val,
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-slate-400">
                      {newService.price > 0
                        ? formatCurrency(newService.price * newService.quantity)
                        : "Th�nh ti�n"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {/* Empty for add row */}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Section */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Payment Options */}
              <div className="space-y-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Thanh to�n
                </h3>

                <div className="space-y-3">
                  {/* Deposit checkbox */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showDepositInput}
                      onChange={(e) => {
                        setShowDepositInput(e.target.checked);
                        if (!e.target.checked) setDepositAmount(0);
                      }}
                      disabled={!!order?.depositAmount} // Disable if already deposited
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      �t c�c{" "}
                      {order?.depositAmount
                        ? `(� c�c: ${formatCurrency(order.depositAmount)})`
                        : ""}
                    </span>
                  </label>

                  {/* Deposit input - only show when checkbox is checked and not already deposited */}
                  {showDepositInput && !order?.depositAmount && (
                    <div className="pl-6">
                      <NumberInput
                        placeholder="Số tiền đặt cọc"
                        value={depositAmount || ""}
                        onChange={(val) =>
                          setDepositAmount(val)
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  )}

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                  {/* Payment method selection */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                      Ph��ng th�c thanh to�n:
                    </label>
                    <div className="flex items-center gap-4 pl-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cash"
                          checked={formData.paymentMethod === "cash"}
                          onChange={(e) =>
                            setFormData({ ...formData, paymentMethod: "cash" })
                          }
                          className="w-4 h-4"
                        />
                        <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <rect
                              x="2"
                              y="6"
                              width="20"
                              height="12"
                              rx="2"
                              ry="2"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Ti�n m�t
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="bank"
                          checked={formData.paymentMethod === "bank"}
                          onChange={(e) =>
                            setFormData({ ...formData, paymentMethod: "bank" })
                          }
                          className="w-4 h-4"
                        />
                        <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 21h18M3 10h18M7 6h10l2 4H5l2-4Zm2 4v11m6-11v11"
                            />
                          </svg>
                          Chuy�n kho�n
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                  {/* Partial payment checkbox - only show if status is "Tr� m�y" */}
                  {formData.status === "Tr� m�y" && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={showPartialPayment}
                          onChange={(e) => {
                            setShowPartialPayment(e.target.checked);
                            if (!e.target.checked) setPartialPayment(0);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Thanh to�n khi tr� xe
                        </span>
                      </label>

                      {/* Partial Payment Input - only show when checkbox is checked */}
                      {showPartialPayment && (
                        <div className="pl-6 space-y-2">
                          <label className="text-xs text-slate-600 dark:text-slate-400">
                            S� ti�n thanh to�n th�m:
                          </label>
                          <div className="flex items-center gap-2">
                            <NumberInput
                              placeholder="0"
                              value={partialPayment || ""}
                              onChange={(val) =>
                                setPartialPayment(val)
                              }
                              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            />
                            <button
                              onClick={() => setPartialPayment(0)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              0%
                            </button>
                            <button
                              onClick={() =>
                                setPartialPayment(
                                  Math.round(remainingAmount * 0.5)
                                )
                              }
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              50%
                            </button>
                            <button
                              onClick={() => setPartialPayment(remainingAmount)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                            >
                              100%
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {formData.status !== "Tr� m�y" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    * Thanh to�n khi tr� xe ch�0 kh� d�ng khi tr�ng
                    th�i l� "Tr� m�y"
                  </p>
                )}
              </div>

              {/* Right: Summary */}
              <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  T�"ng k�t
                </h3>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Ph� d�9ch v�:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(formData.laborCost || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Ti�n ph� t�ng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(partsTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Gia c�ng/�t h�ng:
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(servicesTotal)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-600 font-medium">
                      Gi�m gi�:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={
                          discountType === "amount"
                            ? formData.discount || ""
                            : discountPercent
                        }
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          if (discountType === "amount") {
                            const maxDiscount = subtotal;
                            setFormData({
                              ...formData,
                              discount: Math.min(value, maxDiscount),
                            });
                          } else {
                            const percent = Math.min(value, 100);
                            setDiscountPercent(percent);
                            setFormData({
                              ...formData,
                              discount: Math.round((subtotal * percent) / 100),
                            });
                          }
                        }}
                        className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
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
                          setFormData({
                            ...formData,
                            discount: 0,
                          });
                          setDiscountPercent(0);
                        }}
                        className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                      >
                        <option value="amount">��</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick percent buttons */}
                  {discountType === "percent" && (
                    <div className="flex gap-1 justify-end mt-2">
                      {[5, 10, 15, 20].map((percent) => (
                        <button
                          key={percent}
                          onClick={() => {
                            setDiscountPercent(percent);
                            setFormData({
                              ...formData,
                              discount: Math.round((subtotal * percent) / 100),
                            });
                          }}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded transition-colors"
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show amount if percent mode */}
                  {discountType === "percent" && discountPercent > 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">
                      = {formatCurrency(formData.discount || 0)}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t-2 border-slate-400 dark:border-slate-500">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                      T�"ng c�"ng:
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  {/* Show payment breakdown if there's deposit or partial payment */}
                  {(totalDeposit > 0 || totalAdditionalPayment > 0) && (
                    <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-600">
                      {totalDeposit > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">
                            � ��t c�c:
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalDeposit)}
                          </span>
                        </div>
                      )}
                      {totalAdditionalPayment > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-green-600 dark:text-green-400">
                            Thanh to�n th�m:
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            -{formatCurrency(totalAdditionalPayment)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {remainingAmount > 0
                            ? "C�n ph�i thu:"
                            : "� thanh to�n ��"}
                        </span>
                        <span
                          className={`text-lg font-bold ${
                            remainingAmount > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                          }`}
                        >
                          {formatCurrency(remainingAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 md:px-6 flex items-center justify-end gap-3 bg-white md:bg-slate-50 dark:bg-slate-800/70 md:dark:bg-slate-800/50 rounded-b-3xl md:rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            H�y
          </button>

          {/* Always show "L�u Phi�u" */}
          <button
            onClick={handleSaveOnly}
            className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
          >
            L�u Phi�u
          </button>

          {/* Show "�t c�c" button only when status is NOT "Tr� m�y" and deposit input is shown */}
          {formData.status !== "Tr� m�y" && showDepositInput && (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
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
              �t c�c
            </button>
          )}

          {/* Show "Thanh to�n" button only when status is "Tr� m�y" */}
          {formData.status === "Tr� m�y" && (
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2"
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
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Thanh to�n
            </button>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Th�m kh�ch h�ng
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="�ng"
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  T�n kh�ch
                </label>
                <input
                  type="text"
                  placeholder="Nh�p t�n kh�ch"
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  S� �i�!n tho�i
                </label>
                <input
                  type="tel"
                  placeholder="VD: 09xxxx"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative vehicle-search-container">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    D�ng xe
                  </label>
                  <input
                    type="text"
                    placeholder="Ch�n ho�c nh�p d�ng xe"
                    value={newCustomer.vehicleModel}
                    onChange={(e) => {
                      setNewCustomer({
                        ...newCustomer,
                        vehicleModel: e.target.value,
                      });
                      setShowVehicleDropdown(true);
                    }}
                    onFocus={() => setShowVehicleDropdown(true)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />

                  {/* Vehicle Model Dropdown */}
                  {showVehicleDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                      {POPULAR_MOTORCYCLES.filter((model) =>
                        model
                          .toLowerCase()
                          .includes(newCustomer.vehicleModel.toLowerCase())
                      ).map((model: string) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            setNewCustomer({
                              ...newCustomer,
                              vehicleModel: model,
                            });
                            setShowVehicleDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0 text-slate-900 dark:text-slate-100"
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bi�n s�
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 59A1-123.45"
                    value={newCustomer.licensePlate}
                    onChange={(e) =>
                      setNewCustomer({
                        ...newCustomer,
                        licensePlate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
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
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                H�y
              </button>
              <button
                onClick={() => {
                  if (newCustomer.name && newCustomer.phone) {
                    const customerId = `CUST-${Date.now()}`;
                    const vehicleId = `VEH-${Date.now()}`;
                    const vehicles = [];
                    if (newCustomer.vehicleModel || newCustomer.licensePlate) {
                      vehicles.push({
                        id: vehicleId,
                        model: newCustomer.vehicleModel || "",
                        licensePlate: newCustomer.licensePlate || "",
                        isPrimary: true,
                      });
                    }

                    upsertCustomer({
                      id: customerId,
                      name: newCustomer.name,
                      phone: newCustomer.phone,
                      vehicles: vehicles.length > 0 ? vehicles : undefined,
                      vehicleModel: newCustomer.vehicleModel,
                      licensePlate: newCustomer.licensePlate,
                      status: "active",
                      segment: "New",
                      loyaltyPoints: 0,
                      totalSpent: 0,
                      visitCount: 1,
                      lastVisit: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                    });

                    // Set the new customer to the form AND search field
                    setFormData({
                      ...formData,
                      customerName: newCustomer.name,
                      customerPhone: newCustomer.phone,
                      vehicleId: vehicles.length > 0 ? vehicleId : undefined,
                      vehicleModel: newCustomer.vehicleModel,
                      licensePlate: newCustomer.licensePlate,
                    });

                    // Update customer search to show the name
                    setCustomerSearch(newCustomer.name);

                    // Close modal and reset
                    setShowAddCustomerModal(false);
                    setNewCustomer({
                      name: "",
                      phone: "",
                      vehicleModel: "",
                      licensePlate: "",
                    });
                  }
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                disabled={!newCustomer.name || !newCustomer.phone}
              >
                L�u
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicleModal && currentCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Th�m xe cho {currentCustomer.name}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lo�i xe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Exciter, Vision, Wave..."
                  value={newVehicle.model}
                  onChange={(e) =>
                    setNewVehicle({ ...newVehicle, model: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Bi�n s� <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 29A 12345"
                  value={newVehicle.licensePlate}
                  onChange={(e) =>
                    setNewVehicle({
                      ...newVehicle,
                      licensePlate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                �x� Xe m�:i s� t� ��"ng ���c ch�n sau khi th�m
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddVehicleModal(false);
                  setNewVehicle({ model: "", licensePlate: "" });
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                H�y
              </button>
              <button
                onClick={handleAddVehicle}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                disabled={
                  !newVehicle.model.trim() || !newVehicle.licensePlate.trim()
                }
              >
                Th�m xe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderModal;
