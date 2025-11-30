import { supabase } from "../../supabaseClient";
import type { Sale, CartItem } from "../../types";
import { RepoResult, success, failure } from "./types";
import { safeAudit } from "./auditLogsRepository";
import { fetchPartBySku } from "./partsRepository";
import { createInventoryTransaction } from "./inventoryTransactionsRepository";

const SALES_TABLE = "sales";

export async function fetchSales(): Promise<RepoResult<Sale[]>> {
  try {
    // Fetch without join first to avoid FK errors with old data
    const { data, error } = await supabase
      .from(SALES_TABLE)
      .select("*")
      .order("date", { ascending: false });

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách hóa đơn",
        cause: error,
      });

    // Map database columns to TypeScript interface
    const salesWithUserName = (data || []).map((sale: any) => ({
      ...sale,
      userName: sale.username || "N/A",
      paymentMethod: sale.paymentmethod || sale.paymentMethod || "cash", // Map lowercase to camelCase
      userId: sale.userid || sale.userId,
      branchId: sale.branchid || sale.branchId,
    }));

    return success(salesWithUserName as Sale[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

// Server-side paginated & filtered fetch
export interface SalesQuery {
  branchId?: string;
  fromDate?: string; // ISO date (inclusive)
  toDate?: string; // ISO date (inclusive)
  page?: number; // 1-based
  pageSize?: number; // default 20
  search?: string; // matches id or customer name
  status?: "completed" | "cancelled" | "refunded"; // extended server filter
  paymentMethod?: "cash" | "bank"; // payment method filter
  mode?: "offset" | "keyset"; // optional keyset pagination
  afterDate?: string; // when mode=keyset: last item's date from previous page
  afterId?: string; // tie-breaker if same date
}

export async function fetchSalesPaged(
  query: SalesQuery
): Promise<RepoResult<Sale[]>> {
  const {
    branchId,
    fromDate,
    toDate,
    page = 1,
    pageSize = 20,
    search,
    status,
    paymentMethod,
    mode = "offset",
    afterDate,
    afterId,
  } = query || {};
  try {
    // Fetch without join to avoid FK errors with old data
    let builder = supabase
      .from(SALES_TABLE)
      .select("*", { count: "exact" })
      .order("date", { ascending: false });

    if (branchId) builder = builder.eq("branchid", branchId);
    if (fromDate) builder = builder.gte("date", fromDate);
    if (toDate) builder = builder.lte("date", toDate);
    if (search) {
      // OR filter for id or customer.name (customer->>name JSON path)
      const escaped = search.replace(/[%_]/g, "");
      builder = builder.or(
        `id.ilike.%${escaped}%,customer->>name.ilike.%${escaped}%,sale_code.ilike.%${escaped}%`
      );
    }
    if (paymentMethod) builder = builder.eq("paymentmethod", paymentMethod);
    // status mapping: if status==='completed' we may treat refunded=false (assuming schema has refunded boolean)
    if (status) {
      if (status === "cancelled" || status === "refunded") {
        builder = builder.eq("refunded", true);
      } else if (status === "completed") {
        builder = builder.or("refunded.is.null,refunded.eq.false");
      }
    }
    let meta: any = {};
    if (mode === "keyset") {
      // Keyset: use date DESC ordering already set, apply cursor conditions
      if (afterDate) {
        // For tie-breaker use id when same date (assuming unique id)
        if (afterId) {
          builder = builder.or(
            `date.lt.${afterDate},and(date.eq.${afterDate},id.lt.${afterId})`
          );
        } else {
          builder = builder.lt("date", afterDate);
        }
      }
      builder = builder.limit(pageSize);
      const { data, error } = (await builder) as any;
      if (error)
        return failure({
          code: "supabase",
          message: "Không thể tải danh sách hóa đơn (keyset)",
          cause: error,
        });

      // Map database columns to TypeScript interface
      const rowsWithUserName = (data || []).map((sale: any) => ({
        ...sale,
        userName: sale.username || "N/A",
        paymentMethod: sale.paymentmethod || sale.paymentMethod || "cash",
        userId: sale.userid || sale.userId,
        branchId: sale.branchid || sale.branchId,
      }));
      const rows: Sale[] = rowsWithUserName as Sale[];

      meta = {
        mode: "keyset",
        pageSize,
        hasMore: rows.length === pageSize, // optimistic: assume more if filled
        nextAfterDate: rows.length ? rows[rows.length - 1].date : undefined,
        nextAfterId: rows.length ? rows[rows.length - 1].id : undefined,
      };
      return success(rows, meta);
    } else {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      builder = builder.range(from, to);
      const { data, error, count } = (await builder) as any;
      if (error)
        return failure({
          code: "supabase",
          message: "Không thể tải danh sách hóa đơn (phân trang)",
          cause: error,
        });

      // Map database columns to TypeScript interface
      const salesWithUserName = (data || []).map((sale: any) => ({
        ...sale,
        userName: sale.username || "N/A",
        paymentMethod: sale.paymentmethod || sale.paymentMethod || "cash",
        userId: sale.userid || sale.userId,
        branchId: sale.branchid || sale.branchId,
      }));

      const total = count || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      meta = {
        mode: "offset",
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      };
      return success(salesWithUserName as Sale[], meta);
    }
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải hóa đơn (phân trang)",
      cause: e,
    });
  }
}

export async function createSale(
  input: Partial<Sale>
): Promise<RepoResult<Sale>> {
  try {
    if (!input.items || !input.items.length)
      return failure({
        code: "validation",
        message: "Thiếu danh sách hàng hóa",
      });
    if (!input.total && input.total !== 0)
      return failure({ code: "validation", message: "Thiếu tổng tiền" });
    if (!input.paymentMethod)
      return failure({
        code: "validation",
        message: "Thiếu phương thức thanh toán",
      });
    const payload: any = {
      id: input.id,
      date: input.date || new Date().toISOString(),
      items: input.items,
      subtotal:
        input.subtotal ??
        input.items.reduce((s, it) => s + it.sellingPrice * it.quantity, 0),
      discount: input.discount ?? 0,
      total: input.total,
      customer: input.customer || { name: "Khách lẻ" },
      paymentmethod: input.paymentMethod,
      userid: input.userId || "unknown",
      username: input.userName || "Unknown",
      branchid: input.branchId || "CN1",
      cashtransactionid: input.cashTransactionId,
    };
    const { data, error } = await supabase
      .from(SALES_TABLE)
      .insert([payload])
      .select()
      .single();
    if (error || !data)
      return failure({
        code: "supabase",
        message: "Tạo hóa đơn thất bại",
        cause: error,
      });
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "sale.create",
      tableName: SALES_TABLE,
      recordId: (data as any).id,
      oldData: null,
      newData: data,
    });
    return success(data as Sale);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo hóa đơn",
      cause: e,
    });
  }
}

// Atomic variant: delegates to DB RPC to ensure stock decrement, inventory tx, cash tx, and sale insert happen in a single transaction.
export async function createSaleAtomic(
  input: Partial<Sale>
): Promise<
  RepoResult<Sale & { cashTransactionId?: string; inventoryTxCount?: number }>
> {
  try {
    if (!input.items || !input.items.length)
      return failure({
        code: "validation",
        message: "Thiếu danh sách hàng hóa",
      });
    if (!input.paymentMethod)
      return failure({
        code: "validation",
        message: "Thiếu phương thức thanh toán",
      });
    if (!input.id)
      return failure({ code: "validation", message: "Thiếu ID hóa đơn" });

    // Validate userId is a valid UUID or null
    const validUserId =
      input.userId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        input.userId
      )
        ? input.userId
        : null;

    const payload = {
      p_sale_id: input.id,
      p_items: input.items as any,
      p_discount: input.discount ?? 0,
      p_customer: input.customer ?? { name: "Khách lẻ" },
      p_payment_method: input.paymentMethod,
      p_user_id: validUserId,
      p_user_name: input.userName || "Unknown",
      p_branch_id: input.branchId || "CN1",
    } as any;

    const { data, error } = await supabase.rpc("sale_create_atomic", payload);
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
            : "Tồn kho không đủ cho một hoặc nhiều sản phẩm",
          cause: error,
        });
      }
      if (upper.includes("PART_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phụ tùng trong kho",
          cause: error,
        });
      if (upper.includes("INVALID_ITEM"))
        return failure({
          code: "validation",
          message: "Dữ liệu sản phẩm không hợp lệ",
          cause: error,
        });
      if (upper.includes("EMPTY_ITEMS"))
        return failure({
          code: "validation",
          message: "Danh sách hàng hóa trống",
          cause: error,
        });
      if (upper.includes("INVALID_PAYMENT_METHOD"))
        return failure({
          code: "validation",
          message: "Phương thức thanh toán không hợp lệ",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền tạo hóa đơn",
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
        message: "Tạo hóa đơn (atomic) thất bại",
        cause: error,
      });
    }
    const saleRow = (data as any).sale as Sale | undefined;
    const cashTransactionId = (data as any).cashTransactionId as
      | string
      | undefined;
    const inventoryTxCount = (data as any).inventoryTxCount as
      | number
      | undefined;
    if (!saleRow) {
      return failure({ code: "unknown", message: "Kết quả RPC không hợp lệ" });
    }

    // Audit (best-effort)
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "sale.create",
      tableName: SALES_TABLE,
      recordId: (saleRow as any).id,
      oldData: null,
      newData: saleRow,
    });

    return success({
      ...(saleRow as any),
      cashTransactionId,
      inventoryTxCount,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo hóa đơn (atomic)",
      cause: e,
    });
  }
}

export async function deleteSaleById(
  id: string
): Promise<RepoResult<{ id: string }>> {
  try {
    // Use atomic delete function that restores inventory
    const { data, error } = await supabase.rpc("sale_delete_atomic", {
      p_sale_id: id,
    });

    if (error) {
      // Map error messages
      const msg = error.message || "";
      if (msg.includes("SALE_NOT_FOUND")) {
        return failure({
          code: "not_found",
          message: "Không tìm thấy hóa đơn",
          cause: error,
        });
      }
      return failure({
        code: "supabase",
        message: "Xóa hóa đơn thất bại",
        cause: error,
      });
    }

    // Audit log
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}

    await safeAudit(userId, {
      action: "sale.delete",
      tableName: SALES_TABLE,
      recordId: id,
      oldData: null,
      newData: data,
    });

    return success({ id });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa hóa đơn",
      cause: e,
    });
  }
}

// Refund an entire sale (customer returned everything or full cancellation after payment)
export async function refundSale(
  id: string,
  reason?: string
): Promise<RepoResult<{ id: string; refunded: boolean }>> {
  try {
    // Fetch existing sale
    const { data: saleRow, error: fetchErr } = await supabase
      .from(SALES_TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !saleRow) {
      return failure({
        code: "not_found",
        message: "Không tìm thấy hóa đơn để hoàn tiền",
        cause: fetchErr,
      });
    }
    // Mark as refunded using explicit columns (refunded, refundReason)
    const patch: any = { refunded: true, refundReason: reason || null };
    const { error: updErr } = await supabase
      .from(SALES_TABLE)
      .update(patch)
      .eq("id", id);
    if (updErr) {
      return failure({
        code: "supabase",
        message: "Không thể cập nhật trạng thái hoàn tiền",
        cause: updErr,
      });
    }
    // Record cash refund (expense/negative income) to adjust payment source balance
    try {
      const refundAmount = 0 - Number((saleRow as any).total || 0);
      const branchId = (saleRow as Sale).branchId || "CN1";
      const paymentMethod = (saleRow as any).paymentMethod || null;
      await supabase.from("cash_transactions").insert([
        {
          category: "sale_refund",
          amount: refundAmount,
          date: new Date().toISOString(),
          description: `Hoàn tiền hóa đơn ${id}`,
          branchId,
          paymentSource: paymentMethod,
          reference: id,
        },
      ] as any);
    } catch {}
    // Restock all items (nhập trả) - best effort
    try {
      const branchId = (saleRow as Sale).branchId || "CN1";
      const items: CartItem[] = (saleRow as Sale).items || [];
      for (const it of items) {
        // Lookup partId via SKU if needed
        let partId = it.partId;
        if (!partId) {
          const lookup = await fetchPartBySku(it.sku);
          if (lookup.ok && lookup.data) {
            partId = (lookup.data as any).id;
          }
        }
        if (partId) {
          await createInventoryTransaction({
            type: "Nhập kho",
            partId,
            partName: it.partName,
            quantity: it.quantity, // nhập trả số lượng gốc
            branchId,
            notes: `Hoàn tiền hóa đơn ${id}`,
          });
        }
      }
    } catch {}
    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "sale.refund",
      tableName: SALES_TABLE,
      recordId: id,
      oldData: saleRow,
      newData: { refunded: true, refundReason: reason || null },
    });
    return success({ id, refunded: true });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn tiền hóa đơn",
      cause: e,
    });
  }
}

// Return a single item from sale (partial return)
export async function returnSaleItem(params: {
  saleId: string;
  itemSku: string; // identify item in sale
  quantity: number; // quantity being returned (<= original)
  reason?: string;
}): Promise<RepoResult<{ saleId: string; itemSku: string; returned: number }>> {
  try {
    if (params.quantity <= 0) {
      return failure({ code: "validation", message: "Số lượng trả phải > 0" });
    }
    // Fetch sale
    const { data: saleRow, error: fetchErr } = await supabase
      .from(SALES_TABLE)
      .select("*")
      .eq("id", params.saleId)
      .single();
    if (fetchErr || !saleRow) {
      return failure({
        code: "not_found",
        message: "Không tìm thấy hóa đơn để trả hàng",
        cause: fetchErr,
      });
    }
    const items: any[] = saleRow.items || [];
    const targetIndex = items.findIndex((it) => it.sku === params.itemSku);
    if (targetIndex === -1) {
      return failure({
        code: "not_found",
        message: "Không tìm thấy sản phẩm trong hóa đơn",
      });
    }
    const target = items[targetIndex];
    if (params.quantity > target.quantity) {
      return failure({
        code: "validation",
        message: "Số lượng trả vượt quá số lượng đã mua",
      });
    }
    // Adjust item quantity
    const newQty = target.quantity - params.quantity;
    if (newQty === 0) {
      items.splice(targetIndex, 1); // remove item completely
    } else {
      items[targetIndex] = { ...target, quantity: newQty };
    }
    // Recalculate totals
    const newSubtotal = items.reduce(
      (s, it) => s + it.sellingPrice * it.quantity,
      0
    );
    // Keep discount ratio; adjust total accordingly
    const discount = saleRow.discount || 0;
    const newTotal = Math.max(0, newSubtotal - discount);
    const patch = {
      items,
      subtotal: newSubtotal,
      total: newTotal,
      updated_at: new Date().toISOString(),
    } as any;
    const { error: updErr } = await supabase
      .from(SALES_TABLE)
      .update(patch)
      .eq("id", params.saleId);
    if (updErr) {
      return failure({
        code: "supabase",
        message: "Cập nhật hóa đơn sau trả hàng thất bại",
        cause: updErr,
      });
    }
    // Restock returned quantity (nhập trả)
    try {
      let partId = target.partId;
      if (!partId) {
        const lookup = await fetchPartBySku(target.sku);
        if (lookup.ok && lookup.data) partId = (lookup.data as any).id;
      }
      if (partId) {
        await createInventoryTransaction({
          type: "Nhập kho",
          partId,
          partName: target.partName,
          quantity: params.quantity,
          branchId: (saleRow as Sale).branchId || "CN1",
          notes: `Trả hàng SKU ${params.itemSku} từ hóa đơn ${params.saleId}`,
        });
      }
    } catch {}
    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {}
    await safeAudit(userId, {
      action: "sale.return_item",
      tableName: SALES_TABLE,
      recordId: params.saleId,
      oldData: saleRow,
      newData: {
        itemSku: params.itemSku,
        returned: params.quantity,
        remainingItems: items,
        subtotal: newSubtotal,
        total: newTotal,
        reason: params.reason || null,
      },
    });
    return success({
      saleId: params.saleId,
      itemSku: params.itemSku,
      returned: params.quantity,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi trả hàng cho hóa đơn",
      cause: e,
    });
  }
}
