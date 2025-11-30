import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Check,
  ChevronDown,
  Search,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatWorkOrderId } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import type { WorkOrder, Part, Customer, Vehicle, Employee } from "../../types";
import {
  checkVehicleMaintenance,
  formatKm,
  getWarningBadgeColor,
  type MaintenanceWarning,
} from "../../utils/maintenanceReminder";
import { WORK_ORDER_STATUS, type WorkOrderStatus } from "../../constants";

interface WorkOrderMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workOrderData: any) => void;
  workOrder?: WorkOrder | null;
  customers: Customer[];
  parts: Part[];
  employees: Employee[];
  currentBranchId: string;
  upsertCustomer?: (customer: any) => void;
  viewMode?: boolean; // true = xem chi tiết, false = chỉnh sửa
  onSwitchToEdit?: () => void; // callback khi bấm nút chỉnh sửa từ view mode
}

type WorkOrderStatus = "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";

export const WorkOrderMobileModal: React.FC<WorkOrderMobileModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workOrder,
  customers,
  parts,
  employees,
  currentBranchId,
  upsertCustomer,
  viewMode = false,
  onSwitchToEdit,
}) => {
  // Find customer and vehicle from workOrder data
  const initialCustomer = useMemo(() => {
    if (!workOrder) return null;
    const foundCustomer = customers.find(
      (c) =>
        c.phone === workOrder.customerPhone || c.name === workOrder.customerName
    );

    // If not found, create a temporary customer object from workOrder data
    if (!foundCustomer && workOrder.customerName) {
      return {
        id: `temp-${Date.now()}`,
        name: workOrder.customerName,
        phone: workOrder.customerPhone || "",
        vehicles: workOrder.licensePlate
          ? [
              {
                id: `temp-veh-${Date.now()}`,
                licensePlate: workOrder.licensePlate,
                model: workOrder.vehicleModel || "",
              },
            ]
          : [],
      } as Customer;
    }

    // If found customer, check if workOrder's vehicle exists in customer's vehicles
    // If not, add it as a temporary vehicle
    if (foundCustomer && workOrder.licensePlate) {
      const vehicleExists = foundCustomer.vehicles?.some(
        (v) => v.licensePlate === workOrder.licensePlate
      );

      if (!vehicleExists) {
        // Clone customer and add temp vehicle
        return {
          ...foundCustomer,
          vehicles: [
            ...(foundCustomer.vehicles || []),
            {
              id: `temp-veh-${Date.now()}`,
              licensePlate: workOrder.licensePlate,
              model: workOrder.vehicleModel || "",
            },
          ],
        } as Customer;
      }
    }

    return foundCustomer || null;
  }, [workOrder, customers]);

  const initialVehicles = useMemo(() => {
    if (!initialCustomer?.vehicles) return [];
    return initialCustomer.vehicles;
  }, [initialCustomer]);

  const initialVehicle = useMemo(() => {
    if (!workOrder) return null;
    if (!initialVehicles.length) return null;

    // Try to find by license plate first
    let foundVehicle = initialVehicles.find(
      (v) => v.licensePlate === workOrder.licensePlate
    );

    // If not found by license plate, try by model
    if (!foundVehicle && workOrder.vehicleModel) {
      foundVehicle = initialVehicles.find(
        (v) => v.model === workOrder.vehicleModel
      );
    }

    // If still not found, use first vehicle or create temp vehicle from workOrder data
    if (!foundVehicle) {
      if (workOrder.licensePlate || workOrder.vehicleModel) {
        return {
          id: `temp-veh-${Date.now()}`,
          licensePlate: workOrder.licensePlate || "",
          model: workOrder.vehicleModel || "",
          customerId: initialCustomer?.id || "",
        } as Vehicle;
      }
      return initialVehicles[0] || null;
    }

    return foundVehicle;
  }, [workOrder, initialVehicles, initialCustomer]);

  // States
  const [status, setStatus] = useState<WorkOrderStatus>(
    (workOrder?.status as WorkOrderStatus) || WORK_ORDER_STATUS.RECEIVED
  );
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(
    employees.find((e) => e.name === workOrder?.technicianName)?.id || ""
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Update selectedCustomer and selectedVehicle when workOrder changes
  useEffect(() => {
    console.log("[WorkOrderMobileModal] workOrder:", workOrder);
    console.log("[WorkOrderMobileModal] initialCustomer:", initialCustomer);
    console.log("[WorkOrderMobileModal] initialVehicle:", initialVehicle);

    if (workOrder) {
      setSelectedCustomer(initialCustomer);
      setSelectedVehicle(initialVehicle);
      // Load currentKm: ưu tiên từ workOrder, nếu không có thì từ vehicle
      if (workOrder.currentKm) {
        setCurrentKm(workOrder.currentKm.toString());
      } else if (initialVehicle?.currentKm) {
        setCurrentKm(initialVehicle.currentKm.toString());
      }
      // Nếu đang edit và có initialCustomer, ẩn form tìm kiếm
      setShowCustomerSearch(!initialCustomer);

      // Sync deposit amount từ workOrder (để hiển thị số tiền đã đặt cọc)
      if (workOrder.depositAmount && workOrder.depositAmount > 0) {
        setDepositAmount(workOrder.depositAmount);
        setIsDeposit(true);
      } else {
        setDepositAmount(0);
        setIsDeposit(false);
      }
    } else {
      setSelectedCustomer(null);
      setSelectedVehicle(null);
      setCurrentKm("");
      setShowCustomerSearch(true);
      setDepositAmount(0);
      setIsDeposit(false);
    }
  }, [workOrder, initialCustomer, initialVehicle]);

  const [currentKm, setCurrentKm] = useState(
    workOrder?.currentKm?.toString() || ""
  );
  const [issueDescription, setIssueDescription] = useState(
    workOrder?.issueDescription || ""
  );
  const [selectedParts, setSelectedParts] = useState<
    Array<{
      partId: string;
      partName: string;
      quantity: number;
      sellingPrice: number;
      costPrice?: number;
      sku?: string;
      category?: string;
    }>
  >(
    workOrder?.partsUsed?.map((p) => ({
      partId: p.partId || "",
      partName: p.partName,
      quantity: p.quantity,
      sellingPrice: p.price || 0,
      costPrice: p.costPrice || 0,
      sku: p.sku || "",
      category: p.category || "",
    })) || []
  );
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      name: string;
      costPrice: number;
      sellingPrice: number;
    }>
  >(
    workOrder?.additionalServices?.map((s) => ({
      id: s.id || `srv-${Date.now()}-${Math.random()}`,
      name: s.description || "",
      costPrice: s.costPrice || 0,
      sellingPrice: s.price || 0,
    })) || []
  );
  const [laborCost, setLaborCost] = useState(workOrder?.laborCost || 0);
  const [discount, setDiscount] = useState(workOrder?.discount || 0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [isDeposit, setIsDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [partialAmount, setPartialAmount] = useState(0);

  // UI States - khởi tạo showCustomerSearch dựa trên initialCustomer để đảm bảo đúng khi edit
  const [showCustomerSearch, setShowCustomerSearch] = useState(
    !initialCustomer
  );
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceCost, setNewServiceCost] = useState(0);
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [newServiceQuantity, setNewServiceQuantity] = useState(1);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerVehicleModel, setNewCustomerVehicleModel] = useState("");
  const [newCustomerLicensePlate, setNewCustomerLicensePlate] = useState("");
  
  // State for editing existing customer
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");

  // Helper functions for number formatting
  const formatNumberWithDots = (value: number | string): string => {
    if (value === 0 || value === "0") return "0";
    if (!value) return "";
    const numStr = value.toString().replace(/\D/g, "");
    if (!numStr) return "";
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseFormattedNumber = (value: string): number => {
    const cleaned = value.replace(/\./g, "");
    return cleaned ? Number(cleaned) : 0;
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    console.log(
      "[WorkOrderMobileModal] Total customers:",
      customers?.length,
      customers
    );
    if (!customerSearchTerm) return customers;
    const term = customerSearchTerm.toLowerCase();
    const filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            v.licensePlate?.toLowerCase().includes(term)
          ))
    );
    console.log(
      "[WorkOrderMobileModal] Filtered customers:",
      filtered.length,
      "Search term:",
      customerSearchTerm
    );
    return filtered;
  }, [customers, customerSearchTerm]);

  // Filtered parts
  const filteredParts = useMemo(() => {
    if (!partSearchTerm) return parts;
    const term = partSearchTerm.toLowerCase();
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term)
    );
  }, [parts, partSearchTerm]);

  // Customer vehicles - bao gồm cả xe từ workOrder nếu đang edit
  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const existingVehicles = selectedCustomer.vehicles || [];

    // Nếu đang edit workOrder và có selectedVehicle là temp vehicle (không có trong danh sách)
    // thì thêm nó vào để hiển thị
    if (
      selectedVehicle &&
      !existingVehicles.find((v) => v.id === selectedVehicle.id)
    ) {
      return [...existingVehicles, selectedVehicle];
    }

    return existingVehicles;
  }, [selectedCustomer, selectedVehicle]);

  // Check maintenance warnings for selected vehicle
  const maintenanceWarnings = useMemo((): MaintenanceWarning[] => {
    if (!selectedVehicle) return [];
    // Update currentKm in vehicle for accurate check
    const vehicleWithKm = {
      ...selectedVehicle,
      currentKm: currentKm ? parseInt(currentKm) : selectedVehicle.currentKm,
    };
    return checkVehicleMaintenance(vehicleWithKm);
  }, [selectedVehicle, currentKm]);

  // Auto-select vehicle if customer has only one and load km
  React.useEffect(() => {
    if (customerVehicles.length === 1 && !selectedVehicle) {
      const vehicle = customerVehicles[0];
      setSelectedVehicle(vehicle);
      // Load currentKm from vehicle if exists
      if (vehicle.currentKm) {
        setCurrentKm(vehicle.currentKm.toString());
      }
    }
  }, [customerVehicles, selectedVehicle]);

  // Calculations
  const partsTotal = useMemo(() => {
    return selectedParts.reduce(
      (sum, p) => sum + p.quantity * p.sellingPrice,
      0
    );
  }, [selectedParts]);

  const servicesTotal = useMemo(() => {
    return additionalServices.reduce((sum, s) => sum + s.sellingPrice, 0);
  }, [additionalServices]);

  const subtotal = partsTotal + servicesTotal + laborCost;

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * discount) / 100;
    }
    return discount;
  }, [subtotal, discount, discountType]);

  const total = Math.max(0, subtotal - discountAmount);

  // Handlers
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearchTerm("");
    setSelectedVehicle(null);
    setCurrentKm(""); // Reset km when changing customer
    // Reset edit mode
    setIsEditingCustomer(false);
    setEditCustomerName(customer.name);
    setEditCustomerPhone(customer.phone || "");
  };

  // Handle save edited customer info
  const handleSaveEditedCustomer = () => {
    if (!selectedCustomer) return;
    if (!editCustomerName.trim()) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!editCustomerPhone.trim()) {
      alert("Vui lòng nhập số điện thoại");
      return;
    }

    const updatedCustomer = {
      ...selectedCustomer,
      name: editCustomerName.trim(),
      phone: editCustomerPhone.trim(),
    };

    // Save to database if upsertCustomer is available
    if (upsertCustomer) {
      upsertCustomer(updatedCustomer);
    }

    // Update local state
    setSelectedCustomer(updatedCustomer);
    setIsEditingCustomer(false);
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    // Load currentKm from vehicle if exists
    if (vehicle.currentKm) {
      setCurrentKm(vehicle.currentKm.toString());
    } else {
      setCurrentKm("");
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
          quantity: 1,
          sellingPrice: part.retailPrice?.[currentBranchId] || 0,
          costPrice: part.costPrice?.[currentBranchId] || 0,
          sku: part.sku || "",
          category: part.category || "",
        },
      ]);
    }
    setShowPartSearch(false);
    setPartSearchTerm("");
  };

  const handleUpdatePartQuantity = (partId: string, delta: number) => {
    setSelectedParts((prev) =>
      prev
        .map((p) =>
          p.partId === partId ? { ...p, quantity: p.quantity + delta } : p
        )
        .filter((p) => p.quantity > 0)
    );
  };

  const handleAddService = () => {
    if (!newServiceName || newServicePrice <= 0) return;
    setAdditionalServices([
      ...additionalServices,
      {
        id: `srv-${Date.now()}`,
        name: newServiceName,
        costPrice: newServiceCost,
        sellingPrice: newServicePrice,
      },
    ]);
    setNewServiceName("");
    setNewServiceCost(0);
    setNewServicePrice(0);
    setShowAddService(false);
  };

  const handleRemoveService = (id: string) => {
    setAdditionalServices(additionalServices.filter((s) => s.id !== id));
  };

  const handleAddVehicle = () => {
    if (!newVehiclePlate || !newVehicleName) return;
    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      licensePlate: newVehiclePlate,
      model: newVehicleName,
    };

    // Add to customer vehicles
    if (selectedCustomer) {
      const updatedVehicles = [
        ...(selectedCustomer.vehicles || []),
        newVehicle,
      ];

      // Update customer with new vehicle and save to database
      const updatedCustomer = {
        ...selectedCustomer,
        vehicles: updatedVehicles,
      };

      // Save to database via upsertCustomer
      if (upsertCustomer) {
        upsertCustomer(updatedCustomer);
      }

      // Update local state
      setSelectedCustomer(updatedCustomer);
      setSelectedVehicle(newVehicle);
    }

    setNewVehiclePlate("");
    setNewVehicleName("");
    setShowAddVehicle(false);
  };

  const handleAddNewCustomer = () => {
    if (!newCustomerName || !newCustomerPhone) return;

    const customerId = `CUST-${Date.now()}`;
    const vehicleId = `VEH-${Date.now()}`;

    // Create vehicles array if vehicle info provided
    const vehicles: Vehicle[] = [];
    if (newCustomerVehicleModel || newCustomerLicensePlate) {
      vehicles.push({
        id: vehicleId,
        model: newCustomerVehicleModel || "",
        licensePlate: newCustomerLicensePlate || "",
        isPrimary: true,
      } as Vehicle);
    }

    // Create new customer object
    const newCustomerObj: Customer = {
      id: customerId,
      name: newCustomerName,
      phone: newCustomerPhone,
      vehicles: vehicles,
      vehicleModel: newCustomerVehicleModel,
      licensePlate: newCustomerLicensePlate,
      status: "active",
      segment: "New",
      loyaltyPoints: 0,
      totalSpent: 0,
      visitCount: 1,
      lastVisit: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to database if upsertCustomer is available
    if (upsertCustomer) {
      upsertCustomer(newCustomerObj);
    }

    // Set selected customer and vehicle
    setSelectedCustomer(newCustomerObj);
    if (vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }

    // Reset form and close modal
    setShowCustomerSearch(false);
    setShowAddCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerVehicleModel("");
    setNewCustomerLicensePlate("");
    setCustomerSearchTerm("");
  };

  const handleSave = () => {
    if (!selectedCustomer || !selectedVehicle) {
      alert("Vui lòng chọn khách hàng và xe");
      return;
    }

    // Calculate total paid and remaining based on showPaymentInput (similar to desktop logic)
    const totalDeposit = isDeposit ? depositAmount : 0;
    const additionalPayment = showPaymentInput ? partialAmount : 0;
    const totalPaid = totalDeposit + additionalPayment;
    const remainingAmount = total - totalPaid;

    // Transform parts to use 'price' field (as expected by SQL/types)
    const transformedParts = selectedParts.map((p) => ({
      partId: p.partId,
      partName: p.partName,
      quantity: p.quantity,
      price: p.sellingPrice, // Map sellingPrice to price for SQL
      costPrice: p.costPrice || 0, // Cost price for profit calculation
      sku: p.sku || "",
      category: p.category || "",
    }));

    // Transform additional services to use 'price' field
    const transformedServices = additionalServices.map((s) => ({
      id: s.id,
      description: s.name,
      quantity: 1,
      price: s.sellingPrice, // Map sellingPrice to price
      costPrice: s.costPrice,
    }));

    const workOrderData = {
      status,
      technicianId: selectedTechnicianId,
      customer: selectedCustomer,
      vehicle: selectedVehicle,
      currentKm: parseInt(currentKm) || 0,
      issueDescription,
      parts: transformedParts,
      additionalServices: transformedServices,
      laborCost,
      discount: discountAmount,
      total: total,
      depositAmount: totalDeposit,
      paymentMethod,
      totalPaid: status === WORK_ORDER_STATUS.DELIVERED ? totalPaid : undefined,
      remainingAmount:
        status === WORK_ORDER_STATUS.DELIVERED ? remainingAmount : undefined,
    };

    onSave(workOrderData);
  };

  // Status colors
  const getStatusColor = (s: WorkOrderStatus) => {
    switch (s) {
      case WORK_ORDER_STATUS.RECEIVED:
        return "bg-blue-500";
      case WORK_ORDER_STATUS.IN_PROGRESS:
        return "bg-yellow-500";
      case WORK_ORDER_STATUS.COMPLETED:
        return "bg-green-500";
      case WORK_ORDER_STATUS.DELIVERED:
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  // Hide bottom navigation when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("hide-bottom-nav");
    } else {
      document.body.classList.remove("hide-bottom-nav");
    }

    return () => {
      document.body.classList.remove("hide-bottom-nav");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // VIEW MODE - Hiển thị chi tiết phiếu (không cho chỉnh sửa)
  if (viewMode && workOrder) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center">
        {/* Mobile Full Screen */}
        <div className="md:hidden w-full h-full bg-[#151521] flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-3 flex items-center justify-between">
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white">
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-bold text-white">
              📋 Chi tiết phiếu #{formatWorkOrderId(workOrder.id)}
            </h2>
            {onSwitchToEdit && (
              <button 
                onClick={onSwitchToEdit}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium flex items-center gap-1"
              >
                ✏️ Sửa
              </button>
            )}
            {!onSwitchToEdit && <div className="w-8"></div>}
          </div>

          {/* Scrollable Content - View Only */}
          <div className="flex-1 overflow-y-auto bg-[#151521]">
            {/* Trạng thái & Thời gian */}
            <div className="p-3 bg-[#1e1e2d] border-b border-slate-700">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusColor(workOrder.status)}`}>
                  {workOrder.status}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(workOrder.creationDate).toLocaleDateString('vi-VN')} {new Date(workOrder.creationDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {workOrder.assignedTechnician && (
                <div className="mt-2 text-xs text-slate-300">
                  👤 KTV: <span className="font-medium text-white">{workOrder.assignedTechnician}</span>
                </div>
              )}
            </div>

            {/* Thông tin khách hàng */}
            <div className="p-3 border-b border-slate-700">
              <h3 className="text-xs font-semibold text-blue-400 mb-2">👤 KHÁCH HÀNG</h3>
              <div className="bg-[#1e1e2d] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{workOrder.customerName || "—"}</span>
                  {workOrder.customerPhone && (
                    <a href={`tel:${workOrder.customerPhone}`} className="text-blue-400 text-sm">
                      📞 {workOrder.customerPhone}
                    </a>
                  )}
                </div>
                <div className="text-sm text-slate-300">
                  🏍️ {workOrder.vehicleModel || "—"} • <span className="text-yellow-400 font-mono">{workOrder.licensePlate || "—"}</span>
                </div>
                {workOrder.currentKm && (
                  <div className="text-xs text-slate-400">
                    📏 Số km hiện tại: {formatKm(workOrder.currentKm)} km
                  </div>
                )}
              </div>
            </div>

            {/* Mô tả vấn đề */}
            {workOrder.description && (
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-xs font-semibold text-orange-400 mb-2">📝 MÔ TẢ VẤN ĐỀ</h3>
                <div className="bg-[#1e1e2d] rounded-xl p-3 text-sm text-slate-300 whitespace-pre-wrap">
                  {workOrder.description}
                </div>
              </div>
            )}

            {/* Phụ tùng */}
            {workOrder.partsUsed && workOrder.partsUsed.length > 0 && (
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-xs font-semibold text-emerald-400 mb-2">🔧 PHỤ TÙNG ({workOrder.partsUsed.length})</h3>
                <div className="space-y-2">
                  {workOrder.partsUsed.map((part, idx) => (
                    <div key={idx} className="bg-[#1e1e2d] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm text-white font-medium truncate">{part.partName || part.name || 'Phụ tùng'}</div>
                          <div className="text-xs text-slate-400">SL: {part.quantity} {part.sku && `• ${part.sku}`}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-emerald-400">{formatCurrency(part.price * part.quantity)}</div>
                          <div className="text-xs text-slate-500">{formatCurrency(part.price)}/cái</div>
                        </div>
                      </div>
                      {/* Hiển thị giá vốn để debug */}
                      <div className="mt-1 text-[10px] text-slate-500 flex justify-between">
                        <span>Giá vốn: {formatCurrency(part.costPrice || 0)}/cái</span>
                        <span className="text-yellow-400">Lãi: {formatCurrency((part.price - (part.costPrice || 0)) * part.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dịch vụ */}
            {workOrder.additionalServices && workOrder.additionalServices.length > 0 && (
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-xs font-semibold text-purple-400 mb-2">🛠️ DỊCH VỤ ({workOrder.additionalServices.length})</h3>
                <div className="space-y-2">
                  {workOrder.additionalServices.map((svc, idx) => (
                    <div key={idx} className="bg-[#1e1e2d] rounded-xl p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm text-white font-medium truncate">{svc.description || svc.name || 'Dịch vụ'}</div>
                        {svc.quantity > 1 && <div className="text-xs text-slate-400">SL: {svc.quantity}</div>}
                      </div>
                      <div className="text-sm font-bold text-purple-400 flex-shrink-0">{formatCurrency(svc.price * (svc.quantity || 1))}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ghi chú */}
            {workOrder.note && (
              <div className="p-3 border-b border-slate-700">
                <h3 className="text-xs font-semibold text-yellow-400 mb-2">💬 GHI CHÚ</h3>
                <div className="bg-[#1e1e2d] rounded-xl p-3 text-sm text-slate-300 whitespace-pre-wrap">
                  {workOrder.note}
                </div>
              </div>
            )}

            {/* Tổng tiền */}
            <div className="p-3">
              <div className="bg-gradient-to-r from-emerald-900/50 to-emerald-800/30 rounded-xl p-4 border border-emerald-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Tổng phụ tùng</span>
                  <span className="text-white font-medium">
                    {formatCurrency(workOrder.partsUsed?.reduce((s, p) => s + p.price * p.quantity, 0) || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300">Tổng dịch vụ</span>
                  <span className="text-white font-medium">
                    {formatCurrency(workOrder.additionalServices?.reduce((s, svc) => s + svc.price * (svc.quantity || 1), 0) || 0)}
                  </span>
                </div>
                {(workOrder.discount || 0) > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-300">Giảm giá</span>
                    <span className="text-red-400 font-medium">-{formatCurrency(workOrder.discount || 0)}</span>
                  </div>
                )}
                <div className="border-t border-emerald-600 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold text-white">TỔNG CỘNG</span>
                  <span className="text-2xl font-black text-emerald-400">{formatCurrency(workOrder.total)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-400">Trạng thái thanh toán</span>
                  <span className={`font-medium ${workOrder.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                    {workOrder.paymentStatus === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Nút chỉnh sửa */}
          {onSwitchToEdit && (
            <div className="flex-shrink-0 p-3 bg-[#1e1e2d] border-t border-slate-700">
              <button
                onClick={onSwitchToEdit}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2"
              >
                ✏️ Chỉnh sửa phiếu
              </button>
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Similar content for desktop - simplified */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Chi tiết phiếu #{formatWorkOrderId(workOrder.id)}
            </h2>
            <div className="flex items-center gap-2">
              {onSwitchToEdit && (
                <button onClick={onSwitchToEdit} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                  ✏️ Chỉnh sửa
                </button>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
            {/* Desktop content similar to mobile */}
            <div className="text-center text-slate-500 py-8">
              Vui lòng bấm "Chỉnh sửa" để xem và sửa chi tiết phiếu
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE - Form chỉnh sửa (code cũ)
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center">
      {/* Mobile Full Screen */}
      <div className="md:hidden w-full h-full bg-[#151521] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-[#1e1e2d] px-3 py-2.5 flex items-center justify-between border-b border-slate-700">
          <button onClick={onClose} className="text-slate-400">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-white">
            {workOrder
              ? `✏️ Sửa phiếu #${formatWorkOrderId(workOrder.id)}`
              : "Tạo phiếu sửa chữa"}
          </h2>
          <div className="w-8"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-32">
          {/* KHỐI 1: TRẠNG THÁI & KỸ THUẬT VIÊN */}
          <div className="p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {/* Status Dropdown */}
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkOrderStatus)}
                  className={`w-full px-2.5 py-2 rounded-lg text-white text-xs font-medium appearance-none pr-7 ${getStatusColor(
                    status
                  )}`}
                >
                  <option value={WORK_ORDER_STATUS.RECEIVED}>
                    🔧 Tiếp nhận
                  </option>
                  <option value={WORK_ORDER_STATUS.IN_PROGRESS}>
                    ⚙️ Đang sửa
                  </option>
                  <option value={WORK_ORDER_STATUS.COMPLETED}>
                    ✅ Đã sửa xong
                  </option>
                  <option value={WORK_ORDER_STATUS.DELIVERED}>🚗 Trả xe</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
              </div>

              {/* Technician Dropdown */}
              <div className="relative">
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-[#2b2b40] rounded-lg text-white text-xs appearance-none pr-7"
                >
                  <option value="">👤 Chọn KTV</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* KHỐI 2: KHÁCH HÀNG & XE */}
          <div className="px-3 pb-3 space-y-2">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
              Khách hàng
            </h3>

            {/* Customer Selection */}
            {showCustomerSearch ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="🔍 Tìm tên hoặc SĐT khách..."
                    className="w-full pl-9 pr-3 py-2 bg-[#2b2b40] rounded-lg text-white text-xs placeholder-slate-500"
                    autoFocus
                  />
                </div>

                {/* Customer List */}
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {filteredCustomers.slice(0, 5).map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className="p-3 bg-[#1e1e2d] rounded-lg cursor-pointer hover:bg-[#2b2b40] transition-colors"
                    >
                      <div className="text-white font-medium">
                        {customer.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {customer.phone}
                      </div>
                    </div>
                  ))}

                  {/* Show add new customer when no results or always at bottom */}
                  {customerSearchTerm && filteredCustomers.length === 0 && (
                    <div className="text-center py-3 text-slate-400 text-xs">
                      Không tìm thấy khách hàng
                    </div>
                  )}

                  {/* Add new customer button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomer(true);
                      // Pre-fill phone if search term looks like a phone number
                      if (/^[0-9]+$/.test(customerSearchTerm)) {
                        setNewCustomerPhone(customerSearchTerm);
                        setNewCustomerName("");
                      } else {
                        setNewCustomerName(customerSearchTerm);
                        setNewCustomerPhone("");
                      }
                    }}
                    className="w-full p-3 bg-green-500/20 border-2 border-dashed border-green-500/50 rounded-lg text-green-400 font-medium flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm khách hàng mới
                  </button>
                </div>
              </div>
            ) : selectedCustomer ? (
              <div className="p-2.5 bg-[#1e1e2d] rounded-lg">
                {isEditingCustomer ? (
                  // Edit mode - show input fields
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Tên khách hàng
                      </label>
                      <input
                        type="text"
                        value={editCustomerName}
                        onChange={(e) => setEditCustomerName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                        placeholder="Nhập tên khách hàng"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-1">
                        Số điện thoại
                      </label>
                      <input
                        type="tel"
                        value={editCustomerPhone}
                        onChange={(e) => setEditCustomerPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          setIsEditingCustomer(false);
                          setEditCustomerName(selectedCustomer.name);
                          setEditCustomerPhone(selectedCustomer.phone || "");
                        }}
                        className="flex-1 py-1.5 bg-[#2b2b40] text-slate-300 rounded-lg text-[10px] font-medium"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleSaveEditedCustomer}
                        className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-medium"
                      >
                        💾 Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode - show customer info with edit button
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-xs">
                        {selectedCustomer.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-medium text-xs">
                          {selectedCustomer.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          📞 {selectedCustomer.phone}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditCustomerName(selectedCustomer.name);
                          setEditCustomerPhone(selectedCustomer.phone || "");
                          setIsEditingCustomer(true);
                        }}
                        className="p-1 text-blue-400 hover:text-blue-300"
                        title="Sửa thông tin khách hàng"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setSelectedVehicle(null);
                          setShowCustomerSearch(true);
                          setIsEditingCustomer(false);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Vehicle Selection */}
            {selectedCustomer && (
              <>
                <h3 className="text-xs font-semibold text-white mt-3 uppercase tracking-wide">
                  XE CỦA KHÁCH (Chọn 1):
                </h3>

                <div className="space-y-2">
                  {customerVehicles.map((vehicle) => {
                    const isActive = selectedVehicle?.id === vehicle.id;
                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => handleSelectVehicle(vehicle)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          isActive
                            ? "bg-blue-500/20 border-2 border-blue-500"
                            : "bg-[#1e1e2d] border-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="text-2xl">
                              {isActive ? (
                                <Check className="w-4 h-4 text-blue-400" />
                              ) : (
                                "🏍️"
                              )}
                            </div>
                            <div>
                              <div
                                className={`font-semibold ${
                                  isActive ? "text-blue-400" : "text-white"
                                }`}
                              >
                                {vehicle.model}
                                {isActive && " (ĐANG CHỌN)"}
                              </div>
                              <div className="text-xs text-slate-400">
                                BKS: {vehicle.licensePlate}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add New Vehicle Button */}
                  <button
                    onClick={() => setShowAddVehicle(true)}
                    className="w-full py-1.5 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-colors flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Thêm xe mới
                  </button>
                </div>
              </>
            )}

            {/* Vehicle Info Inputs */}
            {selectedVehicle && (
              <div className="space-y-2 mt-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Số KM hiện tại
                  </label>
                  <input
                    type="number"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                    placeholder="Nhập số KM"
                    className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                  />
                </div>

                {/* Maintenance Warnings */}
                {maintenanceWarnings.length > 0 && (
                  <div className="p-2.5 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-semibold text-orange-400">
                        Cần bảo dưỡng
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {maintenanceWarnings.map((warning) => (
                        <div
                          key={warning.type}
                          className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
                            warning.isOverdue
                              ? "bg-red-500/20 text-red-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          <span>
                            {warning.icon} {warning.name}
                          </span>
                          <span className="font-medium">
                            {warning.isOverdue
                              ? `Quá ${formatKm(Math.abs(warning.kmUntilDue))}`
                              : `Còn ${formatKm(warning.kmUntilDue)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Mô tả sự cố
                  </label>
                  <textarea
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Thay nhớt, kêu cò..."
                    rows={3}
                    className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* KHỐI 3A: PHỤ TÙNG */}
          {selectedCustomer && selectedVehicle && (
            <>
              <div className="px-3 pb-3 space-y-2.5">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
                  PHỤ TÙNG SỬ DỤNG
                </h3>

                {/* Parts List */}
                {selectedParts.length > 0 && (
                  <div className="space-y-2">
                    {selectedParts.map((part, index) => (
                      <div
                        key={part.partId}
                        className="p-3 bg-[#1e1e2d] rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-white text-xs font-medium">
                              {index + 1}. {part.partName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {part.sku && (
                                <span className="text-[11px] text-blue-400 font-mono">
                                  {part.sku}
                                </span>
                              )}
                              {part.category && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                                    getCategoryColor(part.category).bg
                                  } ${getCategoryColor(part.category).text}`}
                                >
                                  {part.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {formatCurrency(part.sellingPrice)} / cái
                            </div>
                          </div>
                          <div className="text-[#50cd89] font-bold">
                            {formatCurrency(part.quantity * part.sellingPrice)}
                          </div>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center justify-end">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                handleUpdatePartQuantity(part.partId, -1)
                              }
                              className="w-8 h-8 bg-[#2b2b40] rounded-lg flex items-center justify-center text-white hover:bg-red-500/20 hover:text-red-400"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-white font-semibold">
                              {part.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdatePartQuantity(part.partId, 1)
                              }
                              className="w-8 h-8 bg-[#2b2b40] rounded-lg flex items-center justify-center text-white hover:bg-blue-500/20 hover:text-blue-400"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Part Button */}
                <button
                  onClick={() => setShowPartSearch(true)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium flex items-center justify-center gap-1.5 transition-colors text-xs"
                >
                  <Plus className="w-4 h-4" />+ THÊM PHỤ TÙNG
                </button>
              </div>

              {/* KHỐI 3B: GIA CÔNG */}
              <div className="px-3 pb-3 space-y-2.5">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
                  BÁO GIÁ (GIA CÔNG, ĐẶT NGOÀI)
                </h3>

                {/* Services List - Card Design */}
                {additionalServices.length > 0 && (
                  <div className="space-y-2">
                    {additionalServices.map((service, index) => (
                      <div
                        key={service.id}
                        className="p-3 bg-[#1e1e2d] rounded-lg border border-slate-700/50"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-lg">🛠️</span>
                          <div className="flex-1">
                            <div className="text-white text-sm font-medium">
                              {service.name}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              1 x {formatCurrency(service.sellingPrice)}
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-slate-700 pt-2 mt-2 flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500">
                              Thành tiền:
                            </div>
                            <div className="text-[#50cd89] font-bold text-sm">
                              💵 {formatCurrency(service.sellingPrice)}
                            </div>
                            {service.costPrice > 0 && (
                              <div className="text-[10px] text-slate-600 mt-0.5">
                                (Vốn: {formatCurrency(service.costPrice)})
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                // TODO: Edit service
                                setShowAddService(true);
                              }}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleRemoveService(service.id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Service Button - Dashed Border */}
                <button
                  onClick={() => setShowAddService(true)}
                  className="w-full py-3 border border-dashed border-[#009ef7] rounded-lg text-[#009ef7] font-medium flex items-center justify-center gap-2 transition-all hover:bg-[#009ef7]/10 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  THÊM CÔNG VIỆC KHÁC (GIA CÔNG)
                </button>
              </div>

              {/* KHỐI 4: TÀI CHÍNH */}
              <div className="px-3 pb-3 space-y-2.5">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
                  THANH TOÁN
                </h3>

                <div className="p-4 bg-[#1e1e2d] rounded-lg space-y-2">
                  {/* Labor Cost */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Tiền công
                    </label>
                    <input
                      type="text"
                      value={formatNumberWithDots(laborCost)}
                      onChange={(e) =>
                        setLaborCost(parseFormattedNumber(e.target.value))
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                    />
                  </div>

                  {/* Deposit Toggle */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between p-3 bg-[#2b2b40] rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <span className="text-lg">💳</span>
                        </div>
                        <span className="text-white font-medium text-sm">
                          Đặt cọc trước
                        </span>
                      </div>
                      <button
                        onClick={() => setIsDeposit(!isDeposit)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          isDeposit ? "bg-[#009ef7]" : "bg-slate-600"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                            isDeposit ? "right-0.5" : "left-0.5"
                          }`}
                        >
                          {isDeposit && (
                            <span className="absolute inset-0 flex items-center justify-center text-[#009ef7] text-[10px] font-bold">
                              ON
                            </span>
                          )}
                        </div>
                      </button>
                    </div>

                    {isDeposit && (
                      <div className="mt-3 p-3 bg-[#151521] border-2 border-[#009ef7] rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">💵</span>
                          <span className="text-slate-400 text-xs">
                            Nhập số tiền cọc...
                          </span>
                        </div>
                        <input
                          type="text"
                          value={formatNumberWithDots(depositAmount)}
                          onChange={(e) =>
                            setDepositAmount(
                              parseFormattedNumber(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="w-full px-3 py-2.5 bg-[#2b2b40] border border-slate-600 rounded-lg text-white text-sm focus:border-[#009ef7] focus:outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div className="pt-2">
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Phương thức thanh toán
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentMethod("cash")}
                        className={`relative p-3 rounded-lg transition-all border-2 ${
                          paymentMethod === "cash"
                            ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/20"
                            : "bg-[#2b2b40] border-transparent hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`text-xl ${
                              paymentMethod === "cash" ? "scale-110" : ""
                            } transition-transform`}
                          >
                            💵
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              paymentMethod === "cash"
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            Tiền mặt
                          </span>
                        </div>
                        {paymentMethod === "cash" && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => setPaymentMethod("bank")}
                        className={`relative p-3 rounded-lg transition-all border-2 ${
                          paymentMethod === "bank"
                            ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/20"
                            : "bg-[#2b2b40] border-transparent hover:border-slate-600"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`text-xl ${
                              paymentMethod === "bank" ? "scale-110" : ""
                            } transition-transform`}
                          >
                            🏦
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              paymentMethod === "bank"
                                ? "text-blue-400"
                                : "text-slate-400"
                            }`}
                          >
                            Chuyển khoản
                          </span>
                        </div>
                        {paymentMethod === "bank" && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    </div>

                    {/* Payment at return - only show when status is "Trả máy" */}
                    {status === "Trả máy" && (
                      <div className="mt-3">
                        {/* Checkbox to enable payment */}
                        <div className="flex items-center justify-between p-3 bg-[#2b2b40] rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                              <span className="text-lg">✅</span>
                            </div>
                            <span className="text-white font-medium text-sm">
                              Thanh toán khi trả xe
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const newValue = !showPaymentInput;
                              setShowPaymentInput(newValue);
                              if (!newValue) {
                                setPartialAmount(0);
                              }
                            }}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                              showPaymentInput
                                ? "bg-emerald-500"
                                : "bg-slate-600"
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                                showPaymentInput ? "right-0.5" : "left-0.5"
                              }`}
                            >
                              {showPaymentInput && (
                                <span className="absolute inset-0 flex items-center justify-center text-emerald-500 text-[10px] font-bold">
                                  ON
                                </span>
                              )}
                            </div>
                          </button>
                        </div>

                        {/* Payment Input - show when checkbox is enabled */}
                        {showPaymentInput && (
                          <div className="mt-3 p-3 bg-[#151521] border-2 border-emerald-500 rounded-lg">
                            <label className="block text-xs font-medium text-slate-400 mb-2">
                              Số tiền thanh toán thêm:
                            </label>
                            <input
                              type="text"
                              value={formatNumberWithDots(partialAmount)}
                              onChange={(e) =>
                                setPartialAmount(
                                  parseFormattedNumber(e.target.value)
                                )
                              }
                              placeholder="0"
                              className="w-full px-3 py-2.5 bg-[#2b2b40] border border-slate-600 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors mb-2"
                            />
                            {/* Quick amount buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setPartialAmount(0)}
                                className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                0%
                              </button>
                              <button
                                onClick={() => {
                                  const remainingToPay =
                                    total - (isDeposit ? depositAmount : 0);
                                  setPartialAmount(
                                    Math.round(remainingToPay * 0.5)
                                  );
                                }}
                                className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                50%
                              </button>
                              <button
                                onClick={() => {
                                  const remainingToPay =
                                    total - (isDeposit ? depositAmount : 0);
                                  setPartialAmount(remainingToPay);
                                }}
                                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                              >
                                100%
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Info Note */}
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                        <span className="text-blue-400 text-xs">ℹ️</span>
                      </div>
                      <p className="text-blue-300 text-xs leading-relaxed">
                        <span className="font-semibold">Lưu ý:</span> Chỉ thanh
                        toán khi trả xe, chỉ khả dụng khi trạng thái "Trả máy"
                      </p>
                    </div>
                  </div>

                  {/* Summary - Moved to end */}
                  <div className="pt-2 border-t border-slate-700 space-y-2">
                    <h3 className="text-xs font-semibold text-slate-300 mb-2">
                      Tổng kết
                    </h3>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Phí dịch vụ:</span>
                      <span className="text-white font-medium">
                        {formatCurrency(laborCost)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Tiền phụ tùng:</span>
                      <span className="text-white font-medium">
                        {formatCurrency(partsTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Gia công/Đặt hàng:</span>
                      <span className="text-white font-medium">
                        {formatCurrency(servicesTotal)}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="pt-2 border-t border-slate-700">
                      <div className="flex gap-2 items-center justify-between mb-2">
                        <label className="text-red-400 text-xs font-medium">
                          Giảm giá:
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={formatNumberWithDots(discount)}
                            onChange={(e) =>
                              setDiscount(parseFormattedNumber(e.target.value))
                            }
                            placeholder="0"
                            className="w-20 px-2 py-1.5 bg-[#2b2b40] border border-slate-600 rounded text-white text-xs text-right focus:border-red-500 focus:outline-none"
                          />
                          <select
                            value={discountType}
                            onChange={(e) =>
                              setDiscountType(
                                e.target.value as "amount" | "percent"
                              )
                            }
                            className="px-2 py-1.5 bg-[#2b2b40] border border-slate-600 rounded text-white text-xs focus:border-red-500 focus:outline-none"
                          >
                            <option value="amount">₫</option>
                            <option value="percent">%</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick percent buttons - only show in percent mode */}
                      {discountType === "percent" && (
                        <div className="flex gap-1.5 justify-end">
                          {[5, 10, 15, 20].map((percent) => (
                            <button
                              key={percent}
                              onClick={() => setDiscount(percent)}
                              className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Show discount amount if in percent mode */}
                      {discountType === "percent" && discount > 0 && (
                        <div className="text-xs text-slate-400 text-right mt-1">
                          = {formatCurrency(discountAmount)}
                        </div>
                      )}
                    </div>

                    {/* Total */}
                    <div className="pt-2 border-t-2 border-slate-600">
                      <div className="flex justify-between text-sm font-bold mb-2">
                        <span className="text-white">Tổng cộng:</span>
                        <span className="text-blue-400 text-base">
                          {formatCurrency(total)}
                        </span>
                      </div>

                      {/* Payment breakdown - only show if there's deposit or additional payment */}
                      {((isDeposit && depositAmount > 0) ||
                        (showPaymentInput && partialAmount > 0)) && (
                        <div className="space-y-1 pt-2 border-t border-slate-700">
                          {isDeposit && depositAmount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-green-400">
                                Đã đặt cọc:
                              </span>
                              <span className="font-medium text-green-400">
                                -{formatCurrency(depositAmount)}
                              </span>
                            </div>
                          )}
                          {showPaymentInput && partialAmount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-green-400">
                                Thanh toán thêm:
                              </span>
                              <span className="font-medium text-green-400">
                                -{formatCurrency(partialAmount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                            <span className="text-sm font-bold text-white">
                              {total -
                                (isDeposit ? depositAmount : 0) -
                                (showPaymentInput ? partialAmount : 0) >
                              0
                                ? "Còn phải thu:"
                                : "Đã thanh toán đủ"}
                            </span>
                            <span
                              className={`text-base font-bold ${
                                total -
                                  (isDeposit ? depositAmount : 0) -
                                  (showPaymentInput ? partialAmount : 0) >
                                0
                                  ? "text-red-400"
                                  : "text-green-400"
                              }`}
                            >
                              {formatCurrency(
                                total -
                                  (isDeposit ? depositAmount : 0) -
                                  (showPaymentInput ? partialAmount : 0)
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* STICKY FOOTER - Action Buttons */}
        <div className="flex-shrink-0 bg-[#1e1e2d] border-t border-slate-700 p-3">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#2b2b40] text-slate-300 rounded-lg font-medium hover:bg-slate-700 transition-colors text-xs"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors text-xs ${
                status === "Trả máy"
                  ? "bg-green-600 hover:bg-green-700"
                  : isDeposit
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {status === "Trả máy"
                ? "✅ THANH TOÁN & TRẢ XE"
                : isDeposit
                ? "💰 LƯU & ĐẶT CỌC"
                : "💾 LƯU PHIẾU"}
            </button>
          </div>
        </div>
      </div>

      {/* Desktop - Keep Original (Not Changed) */}
      <div className="hidden md:block">
        {/* Desktop modal would go here - keeping original unchanged */}
      </div>

      {/* Part Search Bottom Sheet - Fixed for keyboard visibility */}
      {showPartSearch && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex flex-col">
          {/* Spacer to push content up when keyboard appears */}
          <div className="flex-1 min-h-[10vh]" onClick={() => {
            setShowPartSearch(false);
            setPartSearchTerm("");
          }} />
          
          {/* Bottom Sheet Container - positioned at bottom, height adjusts with keyboard */}
          <div className="w-full bg-[#151521] rounded-t-2xl flex flex-col" style={{ maxHeight: '70vh' }}>
            <div className="flex-shrink-0 p-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                Chọn phụ tùng
              </h3>
              <button
                onClick={() => {
                  setShowPartSearch(false);
                  setPartSearchTerm("");
                }}
                className="p-1.5 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input - Sticky at top */}
            <div className="flex-shrink-0 p-3 bg-[#151521] sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={partSearchTerm}
                  onChange={(e) => setPartSearchTerm(e.target.value)}
                  placeholder="Tìm tên hoặc SKU..."
                  className="w-full pl-9 pr-3 py-2.5 bg-[#2b2b40] rounded-lg text-white text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* Results List - Scrollable */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 overscroll-contain">
              <div className="space-y-2">
                {filteredParts.slice(0, 20).map((part) => {
                  const stock = part.stock?.[currentBranchId] || 0;
                  const price = part.retailPrice?.[currentBranchId] || 0;
                  return (
                    <div
                      key={part.id}
                      onClick={() => handleAddPart(part)}
                      className="p-2.5 bg-[#1e1e2d] rounded-lg cursor-pointer hover:bg-[#2b2b40] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-xs">
                            {part.name}
                          </div>
                          <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                            SKU: {part.sku} • Tồn: {stock}
                          </div>
                          {part.category && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded-full text-[9px] font-medium ${
                                getCategoryColor(part.category).bg
                              } ${getCategoryColor(part.category).text}`}
                            >
                              {part.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[#50cd89] font-bold text-xs flex-shrink-0">
                          {formatCurrency(price)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Service Modal - Bottom Sheet Design */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center md:justify-center">
          <div className="w-full md:max-w-md bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-base">
                THÊM DỊCH VỤ GIA CÔNG
              </h3>
              <button
                onClick={() => {
                  setShowAddService(false);
                  setNewServiceName("");
                  setNewServiceCost(0);
                  setNewServicePrice(0);
                  setNewServiceQuantity(1);
                }}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tên công việc / Mô tả:
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Nhập tên (VD: Hàn yếm, Sơn...)"
                  className="w-full px-4 py-3 bg-[#151521] border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-[#009ef7] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Quantity Stepper */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Số lượng:
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() =>
                      setNewServiceQuantity(Math.max(1, newServiceQuantity - 1))
                    }
                    className="w-12 h-12 bg-[#2b2b40] hover:bg-slate-700 rounded-lg flex items-center justify-center text-white text-2xl font-bold transition-colors"
                  >
                    −
                  </button>
                  <div className="w-20 h-12 bg-[#151521] border border-slate-700 rounded-lg flex items-center justify-center">
                    <span className="text-white text-xl font-bold">
                      {newServiceQuantity}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setNewServiceQuantity(newServiceQuantity + 1)
                    }
                    className="w-12 h-12 bg-[#2b2b40] hover:bg-slate-700 rounded-lg flex items-center justify-center text-white text-2xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cost & Price Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wide">
                  CHI PHÍ & GIÁ BÁN
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cost Price */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">
                      Giá nhập (Vốn):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formatNumberWithDots(newServiceCost)}
                        onChange={(e) =>
                          setNewServiceCost(
                            parseFormattedNumber(e.target.value)
                          )
                        }
                        placeholder="0"
                        className="w-full px-3 py-3 pr-8 bg-[#151521] border border-slate-700 rounded-lg text-slate-400 text-sm focus:border-slate-600 focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                        đ
                      </span>
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs text-[#ffc700] mb-1.5 font-medium">
                      Đơn giá (Báo khách):
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formatNumberWithDots(newServicePrice)}
                        onChange={(e) =>
                          setNewServicePrice(
                            parseFormattedNumber(e.target.value)
                          )
                        }
                        placeholder="0"
                        className="w-full px-3 py-3 pr-8 bg-gradient-to-br from-[#009ef7]/10 to-purple-600/10 border-2 border-[#009ef7] rounded-lg text-white text-sm font-semibold focus:border-[#0077c7] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#009ef7] text-xs font-bold">
                        đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Amount - Auto Calculate */}
              <div className="p-4 bg-[#151521] border border-slate-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">
                    Thành tiền (Tự tính):
                  </span>
                  <span className="text-[#50cd89] text-xl font-bold">
                    {formatCurrency(newServicePrice * newServiceQuantity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Button */}
            <div className="p-4 border-t border-slate-700">
              <button
                onClick={handleAddService}
                disabled={!newServiceName.trim() || newServicePrice <= 0}
                className="w-full py-4 bg-gradient-to-r from-[#009ef7] to-purple-600 hover:from-[#0077c7] hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-all shadow-lg"
              >
                LƯU VÀO PHIẾU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1e1e2d] rounded-xl p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">Thêm xe mới</h3>
              <button
                onClick={() => setShowAddVehicle(false)}
                className="p-1.5 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Biển số xe
                </label>
                <input
                  type="text"
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                  placeholder="59G1-123.45"
                  className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tên xe
                </label>
                <input
                  type="text"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  placeholder="Honda Wave RSX"
                  className="w-full px-2.5 py-1.5 bg-[#2b2b40] rounded-lg text-white text-xs"
                />
              </div>

              <div className="flex gap-2 pt-1.5">
                <button
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 py-2 bg-[#2b2b40] text-slate-300 rounded-lg font-medium text-xs"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddVehicle}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-xs"
                >
                  Thêm xe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1e1e2d] rounded-xl p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Thêm khách hàng mới</h3>
              <button
                onClick={() => {
                  setShowAddCustomer(false);
                  setNewCustomerName("");
                  setNewCustomerPhone("");
                  setNewCustomerVehicleModel("");
                  setNewCustomerLicensePlate("");
                }}
                className="p-1.5 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Customer Info Section */}
              <div className="bg-[#2b2b40]/50 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                  Thông tin khách hàng
                </h4>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Tên khách hàng <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2.5 bg-[#2b2b40] rounded-lg text-white text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Số điện thoại <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full px-3 py-2.5 bg-[#2b2b40] rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              {/* Vehicle Info Section */}
              <div className="bg-[#2b2b40]/50 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                  🏍️ Thông tin xe
                </h4>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Loại xe
                  </label>
                  <input
                    type="text"
                    value={newCustomerVehicleModel}
                    onChange={(e) => setNewCustomerVehicleModel(e.target.value)}
                    placeholder="Wave, Exciter, Vision..."
                    className="w-full px-3 py-2.5 bg-[#2b2b40] rounded-lg text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Biển số xe
                  </label>
                  <input
                    type="text"
                    value={newCustomerLicensePlate}
                    onChange={(e) =>
                      setNewCustomerLicensePlate(e.target.value.toUpperCase())
                    }
                    placeholder="59G1-12345"
                    className="w-full px-3 py-2.5 bg-[#2b2b40] rounded-lg text-white text-sm uppercase"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddCustomer(false);
                    setNewCustomerName("");
                    setNewCustomerPhone("");
                    setNewCustomerVehicleModel("");
                    setNewCustomerLicensePlate("");
                  }}
                  className="flex-1 py-2.5 bg-[#2b2b40] text-slate-300 rounded-lg font-medium text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddNewCustomer}
                  disabled={!newCustomerName || !newCustomerPhone}
                  className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💾 Lưu khách hàng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
