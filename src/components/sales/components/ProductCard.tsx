import React from "react";
import type { Part, CartItem } from "../../../types";
import type { CategoryColors } from "../utils/categoryColors";
import { formatCurrency } from "../../../utils/format";
import { ShoppingCart, Package } from "lucide-react";

interface ProductCardProps {
    part: Part;
    currentBranchId: string;
    inCart: boolean;
    onAddToCart: (part: Part) => void;
    getCategoryColor: (category: string | undefined) => CategoryColors;
}

/**
 * Product card component for displaying a single product
 */
export const ProductCard: React.FC<ProductCardProps> = ({
    part,
    currentBranchId,
    inCart,
    onAddToCart,
    getCategoryColor,
}) => {
    const stock = Number(part.stock?.[currentBranchId] ?? 0);
    const price = part.retailPrice?.[currentBranchId] ?? 0;
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 5;
    const colors = getCategoryColor(part.category);

    return (
        <div
            onClick={() => !isOutOfStock && onAddToCart(part)}
            className={`group relative bg-white dark:bg-slate-800 rounded-xl border-2 transition-all duration-200 overflow-hidden ${isOutOfStock
                ? "border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
                : inCart
                    ? "border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl hover:shadow-blue-500/10 cursor-pointer active:scale-98"
                }`}
        >
            {/* In Cart Indicator */}
            {inCart && !isOutOfStock && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg">
                        <ShoppingCart className="w-4 h-4" />
                    </div>
                </div>
            )}

            {/* Out of Stock Badge */}
            {isOutOfStock && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
                        Hết hàng
                    </div>
                </div>
            )}

            {/* Low Stock Badge */}
            {isLowStock && !inCart && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-md">
                        Sắp hết
                    </div>
                </div>
            )}

            <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                {/* Product Icon */}
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                    <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>

                {/* Product Name */}
                <div className="min-h-[48px]">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 leading-tight">
                        {part.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                        {part.sku}
                    </p>
                </div>

                {/* Category Badge */}
                {part.category && (
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                            {part.category}
                        </span>
                    </div>
                )}

                {/* Price */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(price)}
                        </span>
                        <span
                            className={`text-sm font-medium ${isOutOfStock
                                ? "text-red-600 dark:text-red-400"
                                : isLowStock
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-green-600 dark:text-green-400"
                                }`}
                        >
                            Tồn: {stock}
                        </span>
                    </div>
                </div>
            </div>

            {/* Hover Effect */}
            {!isOutOfStock && (
                <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
        </div>
    );
};
