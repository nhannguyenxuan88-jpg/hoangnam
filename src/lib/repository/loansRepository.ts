import { supabase } from "../../supabaseClient";
import type { Loan, LoanPayment } from "../../types";
import { RepoResult, success, failure } from "./types";

// ========== LOANS ==========

export async function fetchLoans(): Promise<RepoResult<Loan[]>> {
  try {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách khoản vay",
        cause: error,
      });

    const loans = (data || []).map((row: any) => ({
      id: row.id,
      lenderName: row.lender_name,
      loanType: row.loan_type,
      principal: row.principal,
      interestRate: row.interest_rate,
      term: row.term,
      startDate: row.start_date,
      endDate: row.end_date,
      remainingAmount: row.remaining_amount,
      monthlyPayment: row.monthly_payment,
      status: row.status,
      purpose: row.purpose,
      collateral: row.collateral,
      notes: row.notes,
      branchId: row.branch_id,
      created_at: row.created_at,
    }));

    return success(loans as Loan[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createLoan(
  loan: Omit<Loan, "id" | "created_at">
): Promise<RepoResult<Loan>> {
  try {
    const newLoan = {
      id: `LOAN-${Date.now()}`,
      lender_name: loan.lenderName,
      loan_type: loan.loanType,
      principal: loan.principal,
      interest_rate: loan.interestRate,
      term: loan.term,
      start_date: loan.startDate,
      end_date: loan.endDate,
      remaining_amount: loan.remainingAmount || loan.principal,
      monthly_payment: loan.monthlyPayment,
      status: loan.status || "active",
      purpose: loan.purpose,
      collateral: loan.collateral,
      notes: loan.notes,
      branch_id: loan.branchId || "CN1",
    };

    const { data, error } = await supabase
      .from("loans")
      .insert(newLoan)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: error?.message || "Không thể thêm khoản vay",
        cause: error || new Error("No data returned"),
      });

    return success({
      id: data.id,
      lenderName: data.lender_name,
      loanType: data.loan_type,
      principal: data.principal,
      interestRate: data.interest_rate,
      term: data.term,
      startDate: data.start_date,
      endDate: data.end_date,
      remainingAmount: data.remaining_amount,
      monthlyPayment: data.monthly_payment,
      status: data.status,
      purpose: data.purpose,
      collateral: data.collateral,
      notes: data.notes,
      branchId: data.branch_id,
      created_at: data.created_at,
    } as Loan);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm khoản vay",
      cause: e,
    });
  }
}

export async function updateLoan(
  id: string,
  updates: Partial<Loan>
): Promise<RepoResult<Loan>> {
  try {
    const updateData: any = {};
    if (updates.lenderName !== undefined)
      updateData.lender_name = updates.lenderName;
    if (updates.loanType !== undefined) updateData.loan_type = updates.loanType;
    if (updates.principal !== undefined)
      updateData.principal = updates.principal;
    if (updates.interestRate !== undefined)
      updateData.interest_rate = updates.interestRate;
    if (updates.term !== undefined) updateData.term = updates.term;
    if (updates.startDate !== undefined)
      updateData.start_date = updates.startDate;
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
    if (updates.remainingAmount !== undefined)
      updateData.remaining_amount = updates.remainingAmount;
    if (updates.monthlyPayment !== undefined)
      updateData.monthly_payment = updates.monthlyPayment;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.purpose !== undefined) updateData.purpose = updates.purpose;
    if (updates.collateral !== undefined)
      updateData.collateral = updates.collateral;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("loans")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật khoản vay",
        cause: error,
      });

    return success({
      id: data.id,
      lenderName: data.lender_name,
      loanType: data.loan_type,
      principal: data.principal,
      interestRate: data.interest_rate,
      term: data.term,
      startDate: data.start_date,
      endDate: data.end_date,
      remainingAmount: data.remaining_amount,
      monthlyPayment: data.monthly_payment,
      status: data.status,
      purpose: data.purpose,
      collateral: data.collateral,
      notes: data.notes,
      branchId: data.branch_id,
      created_at: data.created_at,
    } as Loan);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật khoản vay",
      cause: e,
    });
  }
}

export async function deleteLoan(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase.from("loans").delete().eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa khoản vay",
        cause: error,
      });

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa khoản vay",
      cause: e,
    });
  }
}

// ========== LOAN PAYMENTS ==========

export async function fetchLoanPayments(
  loanId?: string
): Promise<RepoResult<LoanPayment[]>> {
  try {
    let query = supabase
      .from("loan_payments")
      .select("*")
      .order("payment_date", { ascending: false });

    if (loanId) {
      query = query.eq("loan_id", loanId);
    }

    const { data, error } = await query;

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải lịch sử trả nợ",
        cause: error,
      });

    const payments = (data || []).map((row: any) => ({
      id: row.id,
      loanId: row.loan_id,
      paymentDate: row.payment_date,
      principalAmount: row.principal_amount,
      interestAmount: row.interest_amount,
      totalAmount: row.total_amount,
      remainingAmount: row.remaining_amount,
      paymentMethod: row.payment_method,
      notes: row.notes,
      branchId: row.branch_id,
      cashTransactionId: row.cash_transaction_id,
    }));

    return success(payments as LoanPayment[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createLoanPayment(
  payment: Omit<LoanPayment, "id">
): Promise<RepoResult<LoanPayment>> {
  try {
    const newPayment = {
      id: `LPAY-${Date.now()}`,
      loan_id: payment.loanId,
      payment_date: payment.paymentDate,
      principal_amount: payment.principalAmount,
      interest_amount: payment.interestAmount,
      total_amount: payment.totalAmount,
      remaining_amount: payment.remainingAmount,
      payment_method: payment.paymentMethod,
      notes: payment.notes,
      branch_id: payment.branchId || "CN1",
      cash_transaction_id: payment.cashTransactionId,
    };

    const { data, error } = await supabase
      .from("loan_payments")
      .insert(newPayment)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: error?.message || "Không thể thêm thanh toán",
        cause: error || new Error("No data returned"),
      });

    return success({
      id: data.id,
      loanId: data.loan_id,
      paymentDate: data.payment_date,
      principalAmount: data.principal_amount,
      interestAmount: data.interest_amount,
      totalAmount: data.total_amount,
      remainingAmount: data.remaining_amount,
      paymentMethod: data.payment_method,
      notes: data.notes,
      branchId: data.branch_id,
      cashTransactionId: data.cash_transaction_id,
    } as LoanPayment);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm thanh toán",
      cause: e,
    });
  }
}
