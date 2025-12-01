import { supabase } from "../../supabaseClient";
import type { CashTransaction } from "../../types";
import { RepoResult, success, failure } from "./types";
import { safeAudit } from "./auditLogsRepository";

const TABLE = "cash_transactions";

export interface CreateCashTxInput {
  type: CashTransaction["type"]; // "income" | "expense"
  amount: number;
  branchId: string;
  paymentSourceId: string; // maps to paymentSource column in DB
  date?: string;
  notes?: string;
  category?: string; // e.g. sale_income, debt_collection
  saleId?: string;
  workOrderId?: string;
  payrollRecordId?: string;
  loanPaymentId?: string;
  supplierId?: string;
  customerId?: string;
  recipient?: string; // human readable target
}

// Fetch cash transactions (optional filters)
export async function fetchCashTransactions(params?: {
  branchId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  type?: "income" | "expense";
}): Promise<RepoResult<CashTransaction[]>> {
  try {
    let query = supabase
      .from(TABLE)
      .select("*")
      .order("date", { ascending: false });
    if (params?.branchId) query = query.eq("branchId", params.branchId);
    if (params?.startDate) query = query.gte("date", params.startDate);
    if (params?.endDate) query = query.lte("date", params.endDate);
    if (params?.limit) query = query.limit(params.limit);
    if (params?.type) query = query.eq("type", params.type); // requires column 'type' to exist; if not present will fail
    const { data, error } = await query;
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải sổ quỹ",
        cause: error,
      });

    // Map DB columns to TypeScript interface
    const mappedData = (data || []).map((row: any) => ({
      ...row,
      paymentSourceId:
        row.paymentsource || row.paymentSource || row.paymentSourceId || "cash",
      branchId: row.branchid || row.branchId,
    })) as CashTransaction[];

    return success(mappedData);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải sổ quỹ",
      cause: e,
    });
  }
}

export async function createCashTransaction(
  input: CreateCashTxInput
): Promise<RepoResult<CashTransaction>> {
  try {
    if (!input.amount || input.amount <= 0)
      return failure({ code: "validation", message: "Số tiền phải > 0" });
    if (!input.branchId)
      return failure({ code: "validation", message: "Thiếu chi nhánh" });
    if (!input.paymentSourceId)
      return failure({ code: "validation", message: "Thiếu nguồn tiền" });
    if (!input.type)
      return failure({ code: "validation", message: "Thiếu loại thu/chi" });

    // Build payload with only columns that exist in DB schema
    // Required columns: id, category, amount, date, branchId, paymentSource
    // Optional columns (after migration): type, notes, recipient, saleId, workOrderId, etc.
    const payload: any = {
      id: crypto.randomUUID(), // Generate unique ID
      amount: input.amount,
      branchId: input.branchId,
      paymentSource: input.paymentSourceId, // DB column name
      category:
        input.category ||
        (input.type === "income" ? "general_income" : "general_expense"),
      date: input.date || new Date().toISOString(),
      description: input.notes || "", // Map notes to description (existing column)
    };

    // Add optional columns (these will be ignored by Supabase if they don't exist after migration)
    // Only add if migration has been run - for now, use description for notes
    if (input.type) payload.type = input.type;
    if (input.recipient) payload.recipient = input.recipient;
    if (input.saleId) payload.saleId = input.saleId;
    if (input.workOrderId) payload.workOrderId = input.workOrderId;
    if (input.payrollRecordId) payload.payrollRecordId = input.payrollRecordId;
    if (input.loanPaymentId) payload.loanPaymentId = input.loanPaymentId;
    if (input.supplierId) payload.supplierId = input.supplierId;
    if (input.customerId) payload.customerId = input.customerId;
    if (input.notes) payload.notes = input.notes;

    const { data, error } = await supabase
      .from(TABLE)
      .insert([payload])
      .select()
      .single();
    if (error || !data)
      return failure({
        code: "supabase",
        message: "Ghi sổ quỹ thất bại",
        cause: error,
      });
    const created = data as CashTransaction;
    // Best-effort audit: manual cash entry (exclude those tied to sale/debt if category already specific?)
    try {
      // Determine if this is manual: no saleId/workOrderId/payrollRecordId/loanPaymentId
      const isManual =
        !payload.saleId &&
        !payload.workOrderId &&
        !payload.payrollRecordId &&
        !payload.loanPaymentId;
      if (isManual) {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes?.user?.id || null;
        void safeAudit(userId, {
          action: "cash.manual",
          tableName: TABLE,
          recordId: created.id,
          oldData: null,
          newData: created,
        });
      }
    } catch {}
    return success(created);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi ghi sổ quỹ",
      cause: e,
    });
  }
}
