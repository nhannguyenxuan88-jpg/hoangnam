import React, { useState } from "react";
import { useCategories, useCreateCategory } from "../../../hooks/useCategories";
import { showToast } from "../../../utils/toast";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { validatePriceAndQty } from "../../../utils/validation";

export interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
    barcode: string;
    category: string;
    quantity: number;
    importPrice: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}
const AddProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
    barcode: string;
    category: string;
    quantity: number;
    importPrice: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [importPrice, setImportPrice] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [warranty, setWarranty] = useState<number>(1);
  const [warrantyUnit, setWarrantyUnit] = useState("th�ng");
  const [retailOverridden, setRetailOverridden] = useState<boolean>(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast.warning("Vui l�ng nh�p t�n s�n ph�m");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      barcode: barcode.trim(),
      category: category || "Ch�a ph�n lo�i",
      quantity: Number(quantity) || 1,
      importPrice: Number(importPrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      warranty: Number(warranty) || 0,
      warrantyUnit,
    });

    // Reset form
    setName("");
    setDescription("");
    setBarcode("");
    setCategory("");
    setQuantity(1);
    setImportPrice(0);
    setRetailPrice(0);
    setWarranty(1);
    setRetailOverridden(false);
    setWarrantyUnit("th�ng");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Th�m s�n ph�m m�:i
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
          >
            �
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* T�n s�n ph�m */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                T�n s�n ph�m <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Nh�p t�n s�n ph�m"
              />
            </div>

            {/* M� t� */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                M� t�
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="M� t� s�n ph�m"
              />
            </div>

            {/* M� v�ch (Barcode) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mã vạch (Barcode)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ví dụ: 06455-KYJ-841 (Honda), 5S9-F2101-00 (Yamaha)"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Nhập mã vạch từ bao bì gốc của hãng để quét nhanh khi bán hàng
              </p>
            </div>

            {/* Danh m�c s�n ph�m */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Danh m�c s�n ph�m
              </label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Ch�n ho�c t�o m�:i --</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowInlineCat(true)}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                    aria-label="Th�m danh m�c m�:i"
                  >
                    <span className="text-xl text-slate-600 dark:text-slate-300">
                      +
                    </span>
                  </button>
                </div>
                {showInlineCat && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const trimmed = inlineCatName.trim();
                      if (!trimmed) {
                        showToast.warning("Vui l�ng nh�p t�n danh m�c");
                        return;
                      }
                      if (trimmed.length < 2) {
                        showToast.warning("T�n qu� ng�n");
                        return;
                      }
                      try {
                        const res = await createCategory.mutateAsync({
                          name: trimmed,
                        });
                        setCategory(res.name);
                        setInlineCatName("");
                        setShowInlineCat(false);
                      } catch (err: any) {
                        showToast.error(err?.message || "L�i t�o danh m�c");
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      placeholder="Nh�p t�n danh m�c m�:i"
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      L�u
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineCat(false);
                        setInlineCatName("");
                      }}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                      H�y
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Th�ng tin nh�p kho */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Th�ng tin nh�p kho:
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    S� l��ng:
                  </label>
                  <FormattedNumberInput
                    value={quantity}
                    onValue={(v) => {
                      const result = validatePriceAndQty(importPrice, v);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setQuantity(Math.max(1, result.clean.quantity));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Gi� nh�p:
                  </label>
                  <FormattedNumberInput
                    value={importPrice}
                    onValue={(v) => {
                      const result = validatePriceAndQty(v, quantity);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setImportPrice(result.clean.importPrice);
                      if (!retailOverridden) {
                        setRetailPrice(
                          Math.round(result.clean.importPrice * 1.5)
                        );
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                    Gi� b�n l�:
                  </label>
                  <FormattedNumberInput
                    value={retailPrice}
                    onValue={(v) => {
                      setRetailPrice(Math.max(0, Math.round(v)));
                      setRetailOverridden(true);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
              </div>
            </div>

            {/* B�o h�nh */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                B�o h�nh
              </label>
              <div className="flex gap-2">
                <FormattedNumberInput
                  value={warranty}
                  onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                  className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                />
                <select
                  value={warrantyUnit}
                  onChange={(e) => setWarrantyUnit(e.target.value)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="th�ng">th�ng</option>
                  <option value="nm">nm</option>
                  <option value="ng�y">ng�y</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleSubmit}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-medium"
          >
            L�u v� Th�m v�o gi� h�ng
          </button>
        </div>
      </div>
    </div>
  );
};


export default AddProductModal;

