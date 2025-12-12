import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import type { EmployeeAdvance, EmployeeAdvancePayment } from "../types";
import { showToast } from "../utils/toast";

// ============ Employee Advances ============

// Fetch all advances
export function useEmployeeAdvances(branchId?: string) {
  return useQuery({
    queryKey: ["employee-advances", branchId],
    queryFn: async () => {
      let query = supabase
        .from("employee_advances")
        .select("*")
        .order("advance_date", { ascending: false });

      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching employee advances:", error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...item,
        employeeId: item.employee_id,
        employeeName: item.employee_name,
        advanceAmount: parseFloat(item.advance_amount),
        monthlyDeduction: item.monthly_deduction
          ? parseFloat(item.monthly_deduction)
          : undefined,
        remainingAmount: parseFloat(item.remaining_amount),
        paidAmount: parseFloat(item.paid_amount),
        advanceDate: item.advance_date,
        approvedDate: item.approved_date,
        approvedBy: item.approved_by,
        isInstallment: item.is_installment,
        installmentMonths: item.installment_months,
        paymentMethod: item.payment_method,
        branchId: item.branch_id,
      })) as EmployeeAdvance[];
    },
  });
}

// Create advance
export function useCreateEmployeeAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      advance: Omit<EmployeeAdvance, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("employee_advances")
        .insert({
          employee_id: advance.employeeId,
          employee_name: advance.employeeName,
          advance_amount: advance.advanceAmount,
          advance_date: advance.advanceDate,
          reason: advance.reason,
          payment_method: advance.paymentMethod,
          status: advance.status,
          approved_by: advance.approvedBy,
          approved_date: advance.approvedDate,
          is_installment: advance.isInstallment,
          installment_months: advance.installmentMonths,
          monthly_deduction: advance.monthlyDeduction,
          remaining_amount: advance.remainingAmount,
          paid_amount: advance.paidAmount,
          branch_id: advance.branchId,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating employee advance:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      showToast.success("Tạo đơn ứng lương thành công");
    },
    onError: (error: any) => {
      showToast.error(
        `Lỗi tạo đơn ứng lương: ${error.message || "Vui lòng thử lại"}`
      );
    },
  });
}

// Update advance
export function useUpdateEmployeeAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<EmployeeAdvance>;
    }) => {
      const updateData: any = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.approvedBy !== undefined)
        updateData.approved_by = updates.approvedBy;
      if (updates.approvedDate !== undefined)
        updateData.approved_date = updates.approvedDate;
      if (updates.remainingAmount !== undefined)
        updateData.remaining_amount = updates.remainingAmount;
      if (updates.paidAmount !== undefined)
        updateData.paid_amount = updates.paidAmount;
      if (updates.reason !== undefined) updateData.reason = updates.reason;
      if (updates.paymentMethod !== undefined)
        updateData.payment_method = updates.paymentMethod;

      const { data, error } = await supabase
        .from("employee_advances")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating employee advance:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      showToast.success("Cập nhật thành công");
    },
    onError: (error: any) => {
      showToast.error(`Lỗi cập nhật: ${error.message || "Vui lòng thử lại"}`);
    },
  });
}

// Delete advance
export function useDeleteEmployeeAdvance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_advances")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting employee advance:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      showToast.success("Xóa đơn ứng lương thành công");
    },
    onError: (error: any) => {
      showToast.error(`Lỗi xóa: ${error.message || "Vui lòng thử lại"}`);
    },
  });
}

// ============ Advance Payments ============

// Fetch payments for an advance
export function useAdvancePayments(advanceId?: string) {
  return useQuery({
    queryKey: ["advance-payments", advanceId],
    queryFn: async () => {
      if (!advanceId) return [];

      const { data, error } = await supabase
        .from("employee_advance_payments")
        .select("*")
        .eq("advance_id", advanceId)
        .order("payment_date", { ascending: false });

      if (error) {
        console.error("Error fetching advance payments:", error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...item,
        amount: parseFloat(item.amount),
        paymentDate: item.payment_date,
        paymentMonth: item.payment_month,
        payrollRecordId: item.payroll_record_id,
      })) as EmployeeAdvancePayment[];
    },
    enabled: !!advanceId,
  });
}

// Create payment
export function useCreateAdvancePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payment: Omit<EmployeeAdvancePayment, "id" | "created_at">
    ) => {
      const { data, error } = await supabase
        .from("employee_advance_payments")
        .insert({
          advance_id: payment.advanceId,
          employee_id: payment.employeeId,
          amount: payment.amount,
          payment_date: payment.paymentDate,
          payment_month: payment.paymentMonth,
          payroll_record_id: payment.payrollRecordId,
          notes: payment.notes,
          branch_id: payment.branchId,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating advance payment:", error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["advance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["employee-advances"] });
      showToast.success("Ghi nhận thanh toán thành công");
    },
    onError: (error: any) => {
      showToast.error(
        `Lỗi ghi nhận thanh toán: ${error.message || "Vui lòng thử lại"}`
      );
    },
  });
}
