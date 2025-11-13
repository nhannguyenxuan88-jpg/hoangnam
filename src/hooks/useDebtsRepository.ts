import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCustomerDebts,
  createCustomerDebt,
  updateCustomerDebt,
  deleteCustomerDebt,
  fetchSupplierDebts,
  createSupplierDebt,
  updateSupplierDebt,
  deleteSupplierDebt,
} from "../lib/repository/debtsRepository";
import type { CustomerDebt, SupplierDebt } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

// ========== CUSTOMER DEBTS HOOKS ==========

export function useCustomerDebtsRepo() {
  return useQuery({
    queryKey: ["customer_debts"],
    queryFn: async () => {
      const result = await fetchCustomerDebts();
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreateCustomerDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debt: Omit<CustomerDebt, "id">) => {
      const result = await createCustomerDebt(debt);
      if (!result.ok) {
        const errorMsg = result.error
          ? mapRepoErrorForUser(result.error)
          : "Không thể thêm công nợ";
        throw new Error(errorMsg);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_debts"] });
      showToast.success("Thêm công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}

export function useUpdateCustomerDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CustomerDebt>;
    }) => {
      const result = await updateCustomerDebt(id, updates);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_debts"] });
      showToast.success("Cập nhật công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}

export function useDeleteCustomerDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCustomerDebt(id);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer_debts"] });
      showToast.success("Xóa công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}

// ========== SUPPLIER DEBTS HOOKS ==========

export function useSupplierDebtsRepo() {
  return useQuery({
    queryKey: ["supplier_debts"],
    queryFn: async () => {
      const result = await fetchSupplierDebts();
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreateSupplierDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (debt: Omit<SupplierDebt, "id">) => {
      const result = await createSupplierDebt(debt);
      if (!result.ok) {
        const errorMsg = result.error
          ? mapRepoErrorForUser(result.error)
          : "Không thể thêm công nợ";
        throw new Error(errorMsg);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_debts"] });
      showToast.success("Thêm công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}

export function useUpdateSupplierDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<SupplierDebt>;
    }) => {
      const result = await updateSupplierDebt(id, updates);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_debts"] });
      showToast.success("Cập nhật công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}

export function useDeleteSupplierDebtRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSupplierDebt(id);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier_debts"] });
      showToast.success("Xóa công nợ thành công!");
    },
    onError: (error: any) => {
      showToast.error(error?.message || "Có lỗi xảy ra");
    },
  });
}
