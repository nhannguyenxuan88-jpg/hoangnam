import { supabase } from "../../supabaseClient";
import type { WorkOrder } from "../../types";
import { RepoResult, success, failure } from "./types";
import { safeAudit } from "./auditLogsRepository";

const WORK_ORDERS_TABLE = "work_orders";

// Helper: Convert snake_case DB response to camelCase TypeScript
function normalizeWorkOrder(row: any): WorkOrder {
  return {
    id: row.id,
    creationDate: row.creationdate || row.creationDate,
    customerName: row.customername || row.customerName,
    customerPhone: row.customerphone || row.customerPhone,
    vehicleModel: row.vehiclemodel || row.vehicleModel,
    licensePlate: row.licenseplate || row.licensePlate,
    issueDescription: row.issuedescript || row.issueDescription,
    technicianName: row.technicianname || row.technicianName,
    status: row.status,
    laborCost: row.laborcost || row.laborCost || 0,
    discount: row.discount,
    partsUsed: row.partsused || row.partsUsed,
    additionalServices: row.additionalservices || row.additionalServices,
    notes: row.notes,
    total: row.total,
    branchId: row.branchid || row.branchId,
    depositAmount: row.depositamount || row.depositAmount,
    depositDate: row.depositdate || row.depositDate,
    depositTransactionId: row.deposittransactionid || row.depositTransactionId,
    paymentStatus: row.paymentstatus || row.paymentStatus,
    paymentMethod: row.paymentmethod || row.paymentMethod,
    additionalPayment: row.additionalpayment || row.additionalPayment,
    totalPaid: row.totalpaid || row.totalPaid,
    remainingAmount: row.remainingamount || row.remainingAmount,
    paymentDate: row.paymentdate || row.paymentDate,
    cashTransactionId: row.cashtransactionid || row.cashTransactionId,
    refunded: row.refunded,
    refunded_at: row.refunded_at || row.refundedAt,
    refund_transaction_id: row.refund_transaction_id || row.refundTransactionId,
    refund_reason: row.refund_reason || row.refundReason,
  };
}

export async function fetchWorkOrders(): Promise<RepoResult<WorkOrder[]>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationdate", { ascending: false }); // Use lowercase to match DB column

    console.log("[fetchWorkOrders] Raw data from DB:", data);
    console.log(
      "[fetchWorkOrders] Status values:",
      data?.map((d) => ({ id: d.id, status: d.status }))
    );

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    return success((data || []).map(normalizeWorkOrder));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

// Atomic variant: delegates to DB RPC to ensure stock decrement, inventory tx, cash tx, and work order insert happen in a single transaction.
export async function createWorkOrderAtomic(input: Partial<WorkOrder>): Promise<
  RepoResult<
    WorkOrder & {
      depositTransactionId?: string;
      paymentTransactionId?: string;
      inventoryTxCount?: number;
    }
  >
> {
  try {
    if (!input.id)
      return failure({
        code: "validation",
        message: "Thiếu ID phiếu sửa chữa",
      });

    const payload = {
      p_order_id: input.id,
      p_customer_name: input.customerName || "",
      p_customer_phone: input.customerPhone || "",
      p_vehicle_model: input.vehicleModel || "",
      p_license_plate: input.licensePlate || "",
      p_issue_description: input.issueDescription || "",
      p_technician_name: input.technicianName || "",
      p_status: input.status || "Tiếp nhận",
      p_labor_cost: input.laborCost || 0,
      p_discount: input.discount || 0,
      p_parts_used: input.partsUsed || [],
      p_additional_services: input.additionalServices || null,
      p_total: input.total || 0,
      p_branch_id: input.branchId || "CN1",
      p_payment_status: input.paymentStatus || "unpaid",
      p_payment_method: input.paymentMethod || null,
      p_deposit_amount: input.depositAmount || 0,
      p_additional_payment: input.additionalPayment || 0,
      p_user_id: null, // For audit log only
    } as any;

    console.log(
      "[DEBUG] Creating work order with payload:",
      JSON.stringify(payload, null, 2)
    );

    const { data, error } = await supabase.rpc(
      "work_order_create_atomic",
      payload
    );

    console.log("[DEBUG] RPC Response - data:", data, "error:", error);

    // 🔹 DETAILED ERROR LOGGING
    if (error) {
      console.error("[DEBUG] RPC Error Details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        fullError: JSON.stringify(error, null, 2),
      });
    }

    if (error || !data) {
      // Map PostgREST function error details to usable validation messages
      const rawDetails = error?.details || error?.message || "";
      const upper = rawDetails.toUpperCase();

      if (upper.includes("INSUFFICIENT_STOCK")) {
        // Try to parse JSON list after prefix 'INSUFFICIENT_STOCK:' from rawDetails
        let items: any[] = [];
        const colon = rawDetails.indexOf(":");
        if (colon !== -1) {
          const jsonStr = rawDetails.slice(colon + 1).trim();
          try {
            items = JSON.parse(jsonStr);
          } catch {}
        }
        const list = Array.isArray(items)
          ? items
              .map(
                (d: any) =>
                  `${d.partName || d.partId || "?"} (còn ${d.available}, cần ${
                    d.requested
                  })`
              )
              .join(", ")
          : "";
        return failure({
          code: "validation",
          message: list
            ? `Thiếu tồn kho: ${list}`
            : "Tồn kho không đủ cho một hoặc nhiều phụ tùng",
          cause: error,
        });
      }
      if (upper.includes("PART_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phụ tùng trong kho",
          cause: error,
        });
      if (upper.includes("INVALID_PART"))
        return failure({
          code: "validation",
          message: "Dữ liệu phụ tùng không hợp lệ",
          cause: error,
        });
      if (upper.includes("INVALID_STATUS"))
        return failure({
          code: "validation",
          message: "Trạng thái không hợp lệ",
          cause: error,
        });
      if (upper.includes("INVALID_PAYMENT_STATUS"))
        return failure({
          code: "validation",
          message: "Trạng thái thanh toán không hợp lệ",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền tạo phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("BRANCH_MISMATCH"))
        return failure({
          code: "validation",
          message: "Chi nhánh không khớp với quyền hiện tại",
          cause: error,
        });
      return failure({
        code: "supabase",
        message: "Tạo phiếu sửa chữa (atomic) thất bại",
        cause: error,
      });
    }

    // 🔹 FIX: RPC returns { success, orderId, depositTransactionId, paymentTransactionId }
    // Not { workOrder: {...} } format
    const workOrderRow = (data as any).workOrder as any;
    const orderId = (data as any).orderId as string | undefined;
    const depositTransactionId = (data as any).depositTransactionId as
      | string
      | undefined;
    const paymentTransactionId = (data as any).paymentTransactionId as
      | string
      | undefined;
    const inventoryTxCount = (data as any).inventoryTxCount as
      | number
      | undefined;

    // Accept either workOrder object OR orderId from RPC
    if (!workOrderRow && !orderId) {
      return failure({ code: "unknown", message: "Kết quả RPC không hợp lệ" });
    }

    let normalizedWorkOrder: WorkOrder | null = null;
    if (workOrderRow) {
      normalizedWorkOrder = normalizeWorkOrder(workOrderRow);
    } else if (orderId) {
      const { data: fetchedRow, error: fetchError } = await supabase
        .from(WORK_ORDERS_TABLE)
        .select("*")
        .eq("id", orderId)
        .single();

      if (fetchError) {
        console.error("[createWorkOrderAtomic] Cannot fetch order by ID", {
          orderId,
          fetchError,
        });
      } else if (fetchedRow) {
        normalizedWorkOrder = normalizeWorkOrder(fetchedRow);
      }
    }

    if (!normalizedWorkOrder) {
      return failure({
        code: "supabase",
        message: "Không thể tải dữ liệu phiếu sửa chữa vừa tạo",
      });
    }

    // Audit (best-effort)
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}

    await safeAudit(userId, {
      action: "work_order.create",
      tableName: WORK_ORDERS_TABLE,
      recordId: normalizedWorkOrder.id,
      oldData: null,
      newData: normalizedWorkOrder,
    });

    return success({
      ...normalizedWorkOrder,
      depositTransactionId,
      paymentTransactionId,
      inventoryTxCount,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phiếu sửa chữa (atomic)",
      cause: e,
    });
  }
}

// Atomic update variant: adjusts inventory and cash when parts are added/removed
export async function updateWorkOrderAtomic(input: Partial<WorkOrder>): Promise<
  RepoResult<
    WorkOrder & {
      depositTransactionId?: string;
      paymentTransactionId?: string;
    }
  >
> {
  try {
    if (!input.id)
      return failure({
        code: "validation",
        message: "Thiếu ID phiếu sửa chữa",
      });

    const payload = {
      p_order_id: input.id,
      p_customer_name: input.customerName || "",
      p_customer_phone: input.customerPhone || "",
      p_vehicle_model: input.vehicleModel || "",
      p_license_plate: input.licensePlate || "",
      p_issue_description: input.issueDescription || "",
      p_technician_name: input.technicianName || "",
      p_status: input.status || "Tiếp nhận",
      p_labor_cost: input.laborCost || 0,
      p_discount: input.discount || 0,
      p_parts_used: input.partsUsed || [],
      p_additional_services: input.additionalServices || null,
      p_total: input.total || 0,
      p_payment_status: input.paymentStatus || "unpaid",
      p_payment_method: input.paymentMethod || null,
      p_deposit_amount: input.depositAmount || 0,
      p_additional_payment: input.additionalPayment || 0,
      p_user_id: null, // For audit log only
    } as any;

    const { data, error } = await supabase.rpc(
      "work_order_update_atomic",
      payload
    );

    if (error || !data) {
      // Map error details similar to create
      const rawDetails = error?.details || error?.message || "";
      const upper = rawDetails.toUpperCase();

      if (upper.includes("INSUFFICIENT_STOCK")) {
        let items: any[] = [];
        const colon = rawDetails.indexOf(":");
        if (colon !== -1) {
          const jsonStr = rawDetails.slice(colon + 1).trim();
          try {
            items = JSON.parse(jsonStr);
          } catch {}
        }
        const list = Array.isArray(items)
          ? items
              .map(
                (d: any) =>
                  `${d.partName || d.partId || "?"} (còn ${d.available}, cần ${
                    d.requested
                  })`
              )
              .join(", ")
          : "";
        return failure({
          code: "validation",
          message: list
            ? `Thiếu tồn kho: ${list}`
            : "Tồn kho không đủ cho một hoặc nhiều phụ tùng",
          cause: error,
        });
      }
      if (upper.includes("ORDER_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("PART_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phụ tùng trong kho",
          cause: error,
        });
      if (upper.includes("INVALID_PART"))
        return failure({
          code: "validation",
          message: "Dữ liệu phụ tùng không hợp lệ",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền cập nhật phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("BRANCH_MISMATCH"))
        return failure({
          code: "validation",
          message: "Chi nhánh không khớp với quyền hiện tại",
          cause: error,
        });
      return failure({
        code: "supabase",
        message: "Cập nhật phiếu sửa chữa (atomic) thất bại",
        cause: error,
      });
    }

    const workOrderRow = (data as any).workOrder as WorkOrder | undefined;
    const depositTransactionId = (data as any).depositTransactionId as
      | string
      | undefined;
    const paymentTransactionId = (data as any).paymentTransactionId as
      | string
      | undefined;

    if (!workOrderRow) {
      return failure({ code: "unknown", message: "Kết quả RPC không hợp lệ" });
    }

    // Audit (best-effort)
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "work_order.update",
      tableName: WORK_ORDERS_TABLE,
      recordId: (workOrderRow as any).id,
      oldData: null,
      newData: workOrderRow,
    });

    return success({
      ...(workOrderRow as any),
      depositTransactionId,
      paymentTransactionId,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phiếu sửa chữa (atomic)",
      cause: e,
    });
  }
}

export async function updateWorkOrder(
  id: string,
  updates: Partial<WorkOrder>
): Promise<RepoResult<WorkOrder>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật phiếu sửa chữa",
        cause: error,
      });

    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "work_order.update",
      tableName: WORK_ORDERS_TABLE,
      recordId: id,
      oldData: null, // Would need to fetch before update
      newData: data,
    });

    return success(data as WorkOrder);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phiếu sửa chữa",
      cause: e,
    });
  }
}

export async function deleteWorkOrder(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .delete()
      .eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa phiếu sửa chữa",
        cause: error,
      });

    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "work_order.delete",
      tableName: WORK_ORDERS_TABLE,
      recordId: id,
      oldData: null,
      newData: null,
    });

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa phiếu sửa chữa",
      cause: e,
    });
  }
}

// Refund work order atomically: restore inventory, create refund transaction
export async function refundWorkOrder(
  orderId: string,
  refundReason: string
): Promise<
  RepoResult<
    WorkOrder & {
      refund_transaction_id?: string;
      refundAmount?: number;
    }
  >
> {
  try {
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}

    const { data, error } = await supabase.rpc("work_order_refund_atomic", {
      p_order_id: orderId,
      p_refund_reason: refundReason,
      p_user_id: userId || "unknown",
    });

    if (error || !data) {
      console.error("[refundWorkOrder] RPC error:", error);
      console.error("[refundWorkOrder] Error code:", error?.code);
      console.error("[refundWorkOrder] Error message:", error?.message);
      console.error("[refundWorkOrder] Error details:", error?.details);

      const rawDetails = error?.details || error?.message || "";
      const upper = rawDetails.toUpperCase();

      if (upper.includes("ORDER_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("ALREADY_REFUNDED"))
        return failure({
          code: "validation",
          message: "Phiếu này đã được hoàn tiền rồi",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền hoàn tiền",
          cause: error,
        });
      if (upper.includes("BRANCH_MISMATCH"))
        return failure({
          code: "validation",
          message: "Chi nhánh không khớp với quyền hiện tại",
          cause: error,
        });
      return failure({
        code: "supabase",
        message: `Hoàn tiền thất bại: ${error?.message || "Unknown error"}`,
        cause: error,
      });
    }

    const workOrderRow = (data as any).workOrder as WorkOrder | undefined;
    const refund_transaction_id = (data as any).refund_transaction_id as
      | string
      | undefined;
    const refundAmount = (data as any).refundAmount as number | undefined;

    if (!workOrderRow) {
      return failure({ code: "unknown", message: "Kết quả RPC không hợp lệ" });
    }

    await safeAudit(userId, {
      action: "work_order.refund",
      tableName: WORK_ORDERS_TABLE,
      recordId: orderId,
      oldData: null,
      newData: workOrderRow,
    });

    return success({
      ...(workOrderRow as any),
      refund_transaction_id,
      refundAmount,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn tiền",
      cause: e,
    });
  }
}
