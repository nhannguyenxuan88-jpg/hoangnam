import React from "react";
import type { CartItem } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { Trash2, Package } from "lucide-react";
import { NumberInput } from "../../common/NumberInput";

interface CartItemRowProps {
    item: CartItem;
    onUpdateQuantity: (partId: string, quantity: number) => void;
    onUpdatePrice: (partId: string, price: number) => void;
    onRemove: (partId: string) => void;
}

/**
 * Cart item row component - Compact design matching original
 */
export const CartItemRow: React.FC<CartItemRowProps> = ({
    item,
    onUpdateQuantity,
    onUpdatePrice,
    onRemove,
}) => {
    const itemTotal = item.sellingPrice * item.quantity;

    return (
        <div className="group p-3 border-2 border-blue-500/50 rounded-xl bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 hover:border-blue-500 transition-all">
            {/* Top Row: Icon, Name, Delete */}
            <div className="flex items-start gap-3 mb-2">
                {/* Orange Icon */}
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg">
                    <Package className="w-5 h-5 text-white" />
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                        {item.partName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {item.sku}
                    </p>
                </div>

                {/* Delete Button */}
                <button
                    onClick={() => onRemove(item.partId)}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Xóa"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Bottom Row: Quantity + Price inline */}
            <div className="flex items-center gap-3">
                {/* Quantity Controls - Compact */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => onUpdateQuantity(item.partId, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white rounded-lg transition-all font-bold text-sm"
                        disabled={item.quantity <= 1}
                    >
                        −
                    </button>
                    <span className="w-8 text-center font-black text-sm text-slate-900 dark:text-white px-1.5 py-1">
                        {item.quantity}
                    </span>
                    <button
                        onClick={() => onUpdateQuantity(item.partId, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg transition-all font-bold text-sm shadow-sm"
                        disabled={item.quantity >= item.stockSnapshot}
                    >
                        +
                    </button>
                </div>

                {/* Price - Compact */}
                <div className="flex-1">
                    <input
                        type="number"
                        value={item.sellingPrice}
                        onChange={(e) => onUpdatePrice(item.partId, Number(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-sm font-bold text-white bg-slate-700/50 dark:bg-slate-800/50 border border-slate-600 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="0"
                    />
                </div>

                {/* Item Total */}
                <div className="text-right">
                    <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatCurrency(itemTotal)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">đ</span>
                </div>
            </div>
        </div>
    );
};
