import { supabase } from "../../supabaseClient";
import type { FixedAsset } from "../../types";
import { RepoResult, success, failure } from "./types";

// ========== FIXED ASSETS ==========

export async function fetchFixedAssets(): Promise<RepoResult<FixedAsset[]>> {
  try {
    const { data, error } = await supabase
      .from("fixed_assets")
      .select("*")
      .order("purchase_date", { ascending: false });

    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách tài sản cố định",
        cause: error,
      });
    }

    // Map database fields to FixedAsset type
    const assets: FixedAsset[] = (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      assetType: item.asset_type,
      purchasePrice: parseFloat(item.purchase_price),
      currentValue: parseFloat(item.current_value),
      purchaseDate: item.purchase_date,
      depreciationRate: parseFloat(item.depreciation_rate),
      depreciationMethod: item.depreciation_method,
      usefulLife: item.useful_life,
      status: item.status,
      serialNumber: item.serial_number,
      location: item.location,
      supplier: item.supplier,
      warranty: item.warranty,
      notes: item.notes,
      branchId: item.branch_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return success(assets);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải tài sản cố định",
      cause: e,
    });
  }
}

export async function createFixedAsset(
  asset: Omit<FixedAsset, "id" | "created_at">
): Promise<RepoResult<FixedAsset>> {
  try {
    const { data, error } = await supabase
      .from("fixed_assets")
      .insert({
        name: asset.name,
        asset_type: asset.assetType,
        purchase_price: asset.purchasePrice,
        current_value: asset.currentValue,
        purchase_date: asset.purchaseDate,
        depreciation_rate: asset.depreciationRate,
        depreciation_method: asset.depreciationMethod,
        useful_life: asset.usefulLife,
        status: asset.status,
        serial_number: asset.serialNumber,
        location: asset.location,
        supplier: asset.supplier,
        warranty: asset.warranty,
        notes: asset.notes,
        branch_id: asset.branchId,
      })
      .select()
      .single();

    if (error || !data) {
      return failure({
        code: "supabase",
        message: "Không thể thêm tài sản cố định",
        cause: error,
      });
    }

    return success({
      id: data.id,
      name: data.name,
      assetType: data.asset_type,
      purchasePrice: parseFloat(data.purchase_price),
      currentValue: parseFloat(data.current_value),
      purchaseDate: data.purchase_date,
      depreciationRate: parseFloat(data.depreciation_rate),
      depreciationMethod: data.depreciation_method,
      usefulLife: data.useful_life,
      status: data.status,
      serialNumber: data.serial_number,
      location: data.location,
      supplier: data.supplier,
      warranty: data.warranty,
      notes: data.notes,
      branchId: data.branch_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as FixedAsset);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm tài sản cố định",
      cause: e,
    });
  }
}

export async function updateFixedAsset(
  id: string,
  updates: Partial<FixedAsset>
): Promise<RepoResult<FixedAsset>> {
  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.assetType !== undefined)
      updateData.asset_type = updates.assetType;
    if (updates.purchasePrice !== undefined)
      updateData.purchase_price = updates.purchasePrice;
    if (updates.currentValue !== undefined)
      updateData.current_value = updates.currentValue;
    if (updates.purchaseDate !== undefined)
      updateData.purchase_date = updates.purchaseDate;
    if (updates.depreciationRate !== undefined)
      updateData.depreciation_rate = updates.depreciationRate;
    if (updates.depreciationMethod !== undefined)
      updateData.depreciation_method = updates.depreciationMethod;
    if (updates.usefulLife !== undefined)
      updateData.useful_life = updates.usefulLife;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.serialNumber !== undefined)
      updateData.serial_number = updates.serialNumber;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.supplier !== undefined) updateData.supplier = updates.supplier;
    if (updates.warranty !== undefined) updateData.warranty = updates.warranty;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const { data, error } = await supabase
      .from("fixed_assets")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return failure({
        code: "supabase",
        message: "Không thể cập nhật tài sản cố định",
        cause: error,
      });
    }

    return success({
      id: data.id,
      name: data.name,
      assetType: data.asset_type,
      purchasePrice: parseFloat(data.purchase_price),
      currentValue: parseFloat(data.current_value),
      purchaseDate: data.purchase_date,
      depreciationRate: parseFloat(data.depreciation_rate),
      depreciationMethod: data.depreciation_method,
      usefulLife: data.useful_life,
      status: data.status,
      serialNumber: data.serial_number,
      location: data.location,
      supplier: data.supplier,
      warranty: data.warranty,
      notes: data.notes,
      branchId: data.branch_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    } as FixedAsset);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật tài sản cố định",
      cause: e,
    });
  }
}

export async function deleteFixedAsset(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase.from("fixed_assets").delete().eq("id", id);

    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể xóa tài sản cố định",
        cause: error,
      });
    }

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa tài sản cố định",
      cause: e,
    });
  }
}
