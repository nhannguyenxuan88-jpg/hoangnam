/**
 * Purchase Orders Repository
 * Quản lý đơn đặt hàng từ nhà cung cấp
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "../types";

// =====================================================
// Query Keys
// =====================================================
export const PURCHASE_ORDERS_QUERY_KEY = "purchase_orders";
export const PURCHASE_ORDER_ITEMS_QUERY_KEY = "purchase_order_items";

// =====================================================
// Fetch all Purchase Orders
// =====================================================
export function usePurchaseOrders(branchId?: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, branchId],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(
          `
          *,
          supplier:suppliers(*),
          items:purchase_order_items(
            *,
            part:parts(*)
          )
        `
        )
        .order("created_at", { ascending: false });

      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user info for creators
      const pos = (data || []) as PurchaseOrder[];
      const userIds = [
        ...new Set(pos.map((po) => po.created_by).filter(Boolean)),
      ];

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (users) {
          const userMap = new Map(users.map((u) => [u.id, u]));
          pos.forEach((po) => {
            if (po.created_by) {
              const user = userMap.get(po.created_by);
              if (user) {
                po.creator = { email: user.email, name: user.full_name };
              }
            }
          });
        }
      }

      return pos;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =====================================================
// Fetch single Purchase Order by ID
// =====================================================
export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `
          *,
          supplier:suppliers(*),
          items:purchase_order_items(
            *,
            part:parts(*)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      const po = data as PurchaseOrder;

      // Fetch creator info
      if (po.created_by) {
        const { data: user } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .eq("id", po.created_by)
          .single();

        if (user) {
          po.creator = { email: user.email, name: user.full_name };
        }
      }

      return po;
    },
    enabled: !!id,
  });
}

// =====================================================
// Fetch PO Items for a specific PO
// =====================================================
export function usePurchaseOrderItems(poId: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY, poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(
          `
          *,
          part:parts(*)
        `
        )
        .eq("po_id", poId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as PurchaseOrderItem[];
    },
    enabled: !!poId,
  });
}

// =====================================================
// Check if part has pending/ordered POs
// Returns list of POs that contain this part
// =====================================================
export async function checkPartInPendingPOs(partId: string, branchId: string) {
  const { data, error } = await supabase
    .from("purchase_order_items")
    .select(
      `
      *,
      purchase_order:purchase_orders!inner(
        *,
        supplier:suppliers(name)
      )
    `
    )
    .eq("part_id", partId)
    .eq("purchase_order.branch_id", branchId)
    .in("purchase_order.status", ["draft", "ordered"]);

  if (error) throw error;
  return data || [];
}

// =====================================================
// Create Purchase Order
// =====================================================
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      // 1. Create PO header
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: input.supplier_id,
          branch_id: input.branch_id,
          expected_date: input.expected_date,
          notes: input.notes,
          status: "draft",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      // 2. Create PO items
      const itemsToInsert = input.items.map((item) => ({
        po_id: po.id,
        part_id: item.part_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update Purchase Order
// =====================================================
// =====================================================
// Update Purchase Order (Full: Header + Items)
// =====================================================
export function useUpdatePurchaseOrderFull() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: CreatePurchaseOrderInput;
    }) => {
      // 1. Update PO Header
      const { error: poError } = await supabase
        .from("purchase_orders")
        .update({
          supplier_id: input.supplier_id,
          expected_date: input.expected_date,
          notes: input.notes,
        })
        .eq("id", id);

      if (poError) throw poError;

      // 2. Delete existing items
      const { error: deleteError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id);

      if (deleteError) throw deleteError;

      // 3. Insert new items
      const itemsToInsert = input.items.map((item) => ({
        po_id: id,
        part_id: item.part_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        notes: item.notes,
      }));

      const { error: insertError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      return { id, ...input };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update Purchase Order (Header only)
// =====================================================
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePurchaseOrderInput) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update PO Item (e.g., quantity received)
// =====================================================
export function useUpdatePurchaseOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      quantity_received,
      notes,
    }: {
      id: string;
      quantity_received?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .update({ quantity_received, notes })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY],
      });
    },
  });
}

// =====================================================
// Delete Purchase Order (and cascade items)
// =====================================================
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Convert PO to Receipt (Inventory Transaction)
// This creates an inventory_transactions entry and updates PO status
// =====================================================
export async function convertPOToReceipt(poId: string) {
  // 1. Fetch PO with items
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(
      `
      *,
      items:purchase_order_items(
        *,
        part:parts(*)
      )
    `
    )
    .eq("id", poId)
    .single();

  if (poError) throw poError;
  if (!po) throw new Error("PO not found");

  if (po.status === "received") {
    throw new Error("Đơn đặt hàng này đã được nhập kho rồi");
  }

  // 2. Create inventory transaction
  const { data: receipt, error: receiptError } = await supabase
    .from("inventory_transactions")
    .insert({
      type: "in",
      supplier_id: po.supplier_id,
      branch_id: po.branch_id,
      notes: `Nhập kho từ đơn đặt hàng ${po.po_number}`,
    })
    .select()
    .single();

  if (receiptError) throw receiptError;

  // 3. Create transaction items from PO items
  const txItems = po.items.map((item: any) => ({
    transaction_id: receipt.id,
    part_id: item.part_id,
    quantity: item.quantity_ordered, // Or use quantity_received if partial receipt
    unit_price: item.unit_price,
  }));

  const { error: txItemsError } = await supabase
    .from("inventory_transaction_items")
    .insert(txItems);

  if (txItemsError) throw txItemsError;

  // 4. Update PO status and link to receipt
  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      status: "received",
      received_date: new Date().toISOString(),
      receipt_id: receipt.id,
    })
    .eq("id", poId);

  if (updateError) throw updateError;

  return receipt;
}

// =====================================================
// Hook: useConvertPOToReceipt
// Convert PO to inventory receipt
// =====================================================
export function useConvertPOToReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: convertPOToReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
    },
  });
}
