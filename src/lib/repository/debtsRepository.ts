import { supabase } from "../../supabaseClient";
import type { CustomerDebt, SupplierDebt } from "../../types";
import { RepoResult, success, failure } from "./types";

// ========== CUSTOMER DEBTS ==========

export async function fetchCustomerDebts(): Promise<
  RepoResult<CustomerDebt[]>
> {
  try {
    const { data, error } = await supabase
      .from("customer_debts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách công nợ khách hàng",
        cause: error,
      });

    const debts = (data || []).map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      phone: row.phone,
      licensePlate: row.license_plate,
      description: row.description,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      remainingAmount: row.remaining_amount,
      createdDate: row.created_date,
      branchId: row.branch_id,
    }));

    return success(debts as CustomerDebt[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createCustomerDebt(
  debt: Omit<CustomerDebt, "id">
): Promise<RepoResult<CustomerDebt>> {
  try {
    const newDebt = {
      id: `CDEBT-${Date.now()}`,
      customer_id: debt.customerId,
      customer_name: debt.customerName,
      phone: debt.phone,
      license_plate: debt.licensePlate,
      description: debt.description,
      total_amount: debt.totalAmount,
      paid_amount: debt.paidAmount || 0,
      remaining_amount: debt.totalAmount - (debt.paidAmount || 0),
      created_date: debt.createdDate,
      branch_id: debt.branchId || "CN1",
    };

    const { data, error } = await supabase
      .from("customer_debts")
      .insert(newDebt)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: error?.message || "Không thể thêm công nợ",
        cause: error || new Error("No data returned"),
      });

    return success({
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      phone: data.phone,
      licensePlate: data.license_plate,
      description: data.description,
      totalAmount: data.total_amount,
      paidAmount: data.paid_amount,
      remainingAmount: data.remaining_amount,
      createdDate: data.created_date,
      branchId: data.branch_id,
    } as CustomerDebt);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm công nợ",
      cause: e,
    });
  }
}

export async function updateCustomerDebt(
  id: string,
  updates: Partial<CustomerDebt>
): Promise<RepoResult<CustomerDebt>> {
  try {
    const updateData: any = {};
    if (updates.customerName !== undefined)
      updateData.customer_name = updates.customerName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.licensePlate !== undefined)
      updateData.license_plate = updates.licensePlate;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.totalAmount !== undefined)
      updateData.total_amount = updates.totalAmount;
    if (updates.paidAmount !== undefined) {
      updateData.paid_amount = updates.paidAmount;
      updateData.remaining_amount =
        (updates.totalAmount || 0) - updates.paidAmount;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("customer_debts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật công nợ",
        cause: error,
      });

    return success({
      id: data.id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      phone: data.phone,
      licensePlate: data.license_plate,
      description: data.description,
      totalAmount: data.total_amount,
      paidAmount: data.paid_amount,
      remainingAmount: data.remaining_amount,
      createdDate: data.created_date,
      branchId: data.branch_id,
    } as CustomerDebt);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật công nợ",
      cause: e,
    });
  }
}

export async function deleteCustomerDebt(
  id: string
): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase
      .from("customer_debts")
      .delete()
      .eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa công nợ",
        cause: error,
      });

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa công nợ",
      cause: e,
    });
  }
}

// ========== SUPPLIER DEBTS ==========

export async function fetchSupplierDebts(): Promise<
  RepoResult<SupplierDebt[]>
> {
  try {
    const { data, error } = await supabase
      .from("supplier_debts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách công nợ nhà cung cấp",
        cause: error,
      });

    const debts = (data || []).map((row: any) => ({
      id: row.id,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      description: row.description,
      totalAmount: row.total_amount,
      paidAmount: row.paid_amount,
      remainingAmount: row.remaining_amount,
      createdDate: row.created_date,
      branchId: row.branch_id,
    }));

    return success(debts as SupplierDebt[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createSupplierDebt(
  debt: Omit<SupplierDebt, "id">
): Promise<RepoResult<SupplierDebt>> {
  try {
    const newDebt = {
      id: `SDEBT-${Date.now()}`,
      supplier_id: debt.supplierId,
      supplier_name: debt.supplierName,
      description: debt.description,
      total_amount: debt.totalAmount,
      paid_amount: debt.paidAmount || 0,
      remaining_amount: debt.totalAmount - (debt.paidAmount || 0),
      created_date: debt.createdDate,
      branch_id: debt.branchId || "CN1",
    };

    const { data, error } = await supabase
      .from("supplier_debts")
      .insert(newDebt)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: error?.message || "Không thể thêm công nợ",
        cause: error || new Error("No data returned"),
      });

    return success({
      id: data.id,
      supplierId: data.supplier_id,
      supplierName: data.supplier_name,
      description: data.description,
      totalAmount: data.total_amount,
      paidAmount: data.paid_amount,
      remainingAmount: data.remaining_amount,
      createdDate: data.created_date,
      branchId: data.branch_id,
    } as SupplierDebt);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm công nợ",
      cause: e,
    });
  }
}

export async function updateSupplierDebt(
  id: string,
  updates: Partial<SupplierDebt>
): Promise<RepoResult<SupplierDebt>> {
  try {
    const updateData: any = {};
    if (updates.supplierName !== undefined)
      updateData.supplier_name = updates.supplierName;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.totalAmount !== undefined)
      updateData.total_amount = updates.totalAmount;
    if (updates.paidAmount !== undefined) {
      updateData.paid_amount = updates.paidAmount;
      updateData.remaining_amount =
        (updates.totalAmount || 0) - updates.paidAmount;
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("supplier_debts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật công nợ",
        cause: error,
      });

    return success({
      id: data.id,
      supplierId: data.supplier_id,
      supplierName: data.supplier_name,
      description: data.description,
      totalAmount: data.total_amount,
      paidAmount: data.paid_amount,
      remainingAmount: data.remaining_amount,
      createdDate: data.created_date,
      branchId: data.branch_id,
    } as SupplierDebt);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật công nợ",
      cause: e,
    });
  }
}

export async function deleteSupplierDebt(
  id: string
): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase
      .from("supplier_debts")
      .delete()
      .eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa công nợ",
        cause: error,
      });

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa công nợ",
      cause: e,
    });
  }
}
