import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../contexts/AppContext";
import {
  Search,
  Filter,
  ShoppingCart,
  Package,
  Tag,
  Grid,
  List,
  X,
  Phone,
  Mail,
  MessageCircle,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import type { Part } from "../../types";

export default function ProductCatalog() {
  const navigate = useNavigate();
  const { parts, currentBranchId } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [showCart, setShowCart] = useState(false);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(parts.map((p) => p.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [parts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = parts.filter((p) => {
      // Only show products with stock
      const hasStock = (p.stock?.[currentBranchId] || 0) > 0;
      if (!hasStock) return false;

      // Filter by search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(query);
        const matchesSku = p.sku?.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }

      // Filter by category
      if (selectedCategory !== "all" && p.category !== selectedCategory) {
        return false;
      }

      return true;
    });

    return filtered;
  }, [parts, searchQuery, selectedCategory]);

  const addToCart = (partId: string) => {
    setCart((prev) => {
      const newCart = new Map(prev);
      const currentQty = newCart.get(partId) || 0;
      newCart.set(partId, currentQty + 1);
      return newCart;
    });
  };

  const removeFromCart = (partId: string) => {
    setCart((prev) => {
      const newCart = new Map(prev);
      const currentQty = newCart.get(partId) || 0;
      if (currentQty <= 1) {
        newCart.delete(partId);
      } else {
        newCart.set(partId, currentQty - 1);
      }
      return newCart;
    });
  };

  const cartItems = useMemo(() => {
    return Array.from(cart.entries()).map(([partId, quantity]) => {
      const part = parts.find((p) => p.id === partId);
      return part ? { part, quantity } : null;
    }).filter(Boolean) as { part: Part; quantity: number }[];
  }, [cart, parts]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + (item.part.retailPrice?.[currentBranchId] || 0) * item.quantity;
    }, 0);
  }, [cartItems, currentBranchId]);

  const handleOrder = () => {
    if (cartItems.length === 0) return;

    // Format order message
    const orderDetails = cartItems
      .map(
        (item) =>
          `• ${item.part.name} (${item.part.sku}) x${item.quantity} = ${formatCurrency(
            (item.part.retailPrice?.[currentBranchId] || 0) * item.quantity
          )}`
      )
      .join("\n");

    const message = `🛒 ĐẶT HÀNG MỚI\n\n${orderDetails}\n\n💰 TỔNG: ${formatCurrency(
      cartTotal
    )}\n\nVui lòng liên hệ để xác nhận đơn hàng!`;

    // Open Zalo/Telegram with pre-filled message
    const encodedMessage = encodeURIComponent(message);
    // You can customize phone number or Telegram bot link
    window.open(`https://zalo.me/g/xxxx?message=${encodedMessage}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#0a0a0f] dark:to-[#1a1a2e]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            🏍️ Phụ Tùng Xe Máy Chính Hãng
          </h1>
          <p className="text-xl text-blue-100">
            Tìm kiếm và đặt hàng phụ tùng nhanh chóng, tiện lợi
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl p-4 md:p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc mã SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#151521] border-2 border-transparent focus:border-blue-500 rounded-xl text-slate-900 dark:text-white transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 bg-slate-50 dark:bg-[#151521] border-2 border-transparent focus:border-blue-500 rounded-xl text-slate-900 dark:text-white transition-colors"
              >
                <option value="all">Tất cả danh mục</option>
                {categories
                  .filter((c) => c !== "all")
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#151521] rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-blue-500 text-white"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-blue-500 text-white"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setShowCart(true)}
              className="relative px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              <span>Giỏ hàng</span>
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Tìm thấy <span className="font-bold text-blue-600 dark:text-blue-400">{filteredProducts.length}</span> sản phẩm
          </div>
        </div>

        {/* Products Grid/List */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
                cartQuantity={cart.get(product.id) || 0}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredProducts.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                onAddToCart={addToCart}
                cartQuantity={cart.get(product.id) || 0}
              />
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Không tìm thấy sản phẩm phù hợp
            </p>
          </div>
        )}
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white dark:bg-[#1e1e2d] w-full md:max-w-2xl md:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-6 h-6" />
                Giỏ hàng của bạn
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6">
              {cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    Giỏ hàng trống
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.part.id}
                      className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-[#151521] rounded-xl"
                    >
                      <img
                        src={`/images/products/${item.part.sku || 'placeholder'}.jpg`}
                        alt={item.part.name}
                        className="w-16 h-16 object-cover rounded-lg"
                        onError={(e) => {
                          e.currentTarget.src = "/images/products/placeholder.jpg";
                        }}
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 dark:text-white">
                          {item.part.name}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.part.sku}
                        </p>
                        <p className="font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.part.retailPrice?.[currentBranchId] || 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.part.id)}
                          className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item.part.id)}
                          className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {cartItems.length > 0 && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-slate-700 dark:text-slate-300">
                    Tổng cộng:
                  </span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>
                <button
                  onClick={handleOrder}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Đặt hàng ngay
                </button>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-3">
                  Nhấn để gửi đơn hàng qua Zalo
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  onAddToCart,
  cartQuantity,
}: {
  product: Part;
  onAddToCart: (id: string) => void;
  cartQuantity: number;
}) {
  const { currentBranchId } = useAppContext();
  const categoryColor = getCategoryColor(product.category || "");

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden">
      {/* Image */}
      <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
        <img
          src={`/images/products/${product.sku || 'placeholder'}.jpg`}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/images/products/placeholder.jpg";
          }}
        />
        {product.category && (
          <div
            className={`absolute top-3 right-3 px-3 py-1 ${categoryColor} rounded-full text-xs font-bold`}
          >
            {product.category}
          </div>
        )}
        {cartQuantity > 0 && (
          <div className="absolute top-3 left-3 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold">
            {cartQuantity}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          SKU: {product.sku}
        </p>

        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(product.retailPrice?.[currentBranchId] || 0)}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Còn: {product.stock?.[currentBranchId] || 0}
          </span>
        </div>

        <button
          onClick={() => onAddToCart(product.id)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-4 h-4" />
          Thêm vào giỏ
        </button>
      </div>
    </div>
  );
}

// Product List Item Component
function ProductListItem({
  product,
  onAddToCart,
  cartQuantity,
}: {
  product: Part;
  onAddToCart: (id: string) => void;
  cartQuantity: number;
}) {
  const { currentBranchId } = useAppContext();
  const categoryColor = getCategoryColor(product.category || "");

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-4 flex items-center gap-4">
      {/* Image */}
      <div className="relative w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={`/images/products/${product.sku || 'placeholder'}.jpg`}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/images/products/placeholder.jpg";
          }}
        />
        {cartQuantity > 0 && (
          <div className="absolute top-1 left-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-xs">
            {cartQuantity}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-900 dark:text-white mb-1">
          {product.name}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
          SKU: {product.sku}
        </p>
        {product.category && (
          <span
            className={`inline-block px-2 py-1 ${categoryColor} rounded text-xs font-bold`}
          >
            {product.category}
          </span>
        )}
      </div>

      {/* Price & Actions */}
      <div className="flex flex-col items-end gap-2">
        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          {formatCurrency(product.retailPrice?.[currentBranchId] || 0)}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Còn: {product.stock?.[currentBranchId] || 0}
        </span>
        <button
          onClick={() => onAddToCart(product.id)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <ShoppingCart className="w-4 h-4" />
          Thêm vào giỏ
        </button>
      </div>
    </div>
  );
}
