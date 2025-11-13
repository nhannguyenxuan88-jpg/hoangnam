import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkOrders,
  createWorkOrderAtomic,
  updateWorkOrderAtomic,
  updateWorkOrder,
  deleteWorkOrder,
  refundWorkOrder,
} from "../lib/repository/workOrdersRepository";
import type { WorkOrder } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export const useWorkOrdersRepo = () => {
  return useQuery({
    queryKey: ["workOrdersRepo"],
    queryFn: async () => {
      const res = await fetchWorkOrders();
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
};

export const useCreateWorkOrderAtomicRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkOrder>) => {
      const res = await createWorkOrderAtomic(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh parts for stock update
      showToast.success("Đã tạo phiếu sửa chữa (atomic)");
      if (data?.inventoryTxCount) {
        showToast.info(`Xuất kho: ${data.inventoryTxCount} phụ tùng`);
      }
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useUpdateWorkOrderAtomicRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkOrder>) => {
      const res = await updateWorkOrderAtomic(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh parts for stock update
      showToast.success("Đã cập nhật phiếu sửa chữa (atomic)");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useUpdateWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<WorkOrder>;
    }) => updateWorkOrder(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      showToast.success("Đã cập nhật phiếu sửa chữa");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useDeleteWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteWorkOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      showToast.success("Đã xóa phiếu sửa chữa");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useRefundWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      refundReason,
    }: {
      orderId: string;
      refundReason: string;
    }) => refundWorkOrder(orderId, refundReason),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh for restored stock
      showToast.success("Đã hoàn tiền phiếu sửa chữa");
      if (result.ok && (result.data as any).refundAmount) {
        showToast.info(
          `Hoàn tiền: ${new Intl.NumberFormat("vi-VN").format(
            (result.data as any).refundAmount
          )}đ`
        );
      }
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};
