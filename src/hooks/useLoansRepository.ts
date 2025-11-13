import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Loan, LoanPayment } from "../types";
import {
  fetchLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  fetchLoanPayments,
  createLoanPayment,
} from "../lib/repository/loansRepository";
import { mapRepoErrorForUser } from "../utils/errorMapping";
import type { RepoResult } from "../lib/repository/types";

// ========== LOANS HOOKS ==========

export function useLoansRepo() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: fetchLoans,
    select: (result: RepoResult<Loan[]>) => {
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreateLoanRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (loan: Omit<Loan, "id" | "created_at">) => createLoan(loan),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["loans"] });
      } else {
        throw new Error(mapRepoErrorForUser(result.error));
      }
    },
  });
}

export function useUpdateLoanRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Loan> }) =>
      updateLoan(id, updates),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["loans"] });
      } else {
        throw new Error(mapRepoErrorForUser(result.error));
      }
    },
  });
}

export function useDeleteLoanRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLoan(id),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["loans"] });
      } else {
        throw new Error(mapRepoErrorForUser(result.error));
      }
    },
  });
}

// ========== LOAN PAYMENTS HOOKS ==========

export function useLoanPaymentsRepo(loanId?: string) {
  return useQuery({
    queryKey: ["loanPayments", loanId],
    queryFn: () => fetchLoanPayments(loanId),
    select: (result: RepoResult<LoanPayment[]>) => {
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreateLoanPaymentRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payment: Omit<LoanPayment, "id">) =>
      createLoanPayment(payment),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ["loanPayments"] });
        queryClient.invalidateQueries({ queryKey: ["loans"] });
      } else {
        throw new Error(mapRepoErrorForUser(result.error));
      }
    },
  });
}
