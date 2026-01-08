import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
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
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBranchId, setCurrentBranchId] = useState<string>("branch1"); // Default branch
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [showCart, setShowCart] = useState(false);
  const [displayCount, setDisplayCount] = useState(12); // Show 12 products initially

  // Fetch products from Supabase (public access)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log('🔍 [Shop] Bắt đầu fetch sản phẩm...');

        // Select only existing columns: id, name, sku, category, stock, retailPrice, wholesalePrice
        const { data, error } = await supabase
          .from('parts')
          .select('id, name, sku, category, stock, retailPrice, wholesalePrice')
          .order('name');

        console.log('📦 [Shop] Kết quả fetch:', {
          totalProducts: data?.length || 0,
          error: error?.message,
          sampleProduct: data?.[0],
          sampleStock: data?.[0]?.stock,
          sampleStockType: typeof data?.[0]?.stock,
          stockKeys: data?.[0]?.stock ? Object.keys(data?.[0]?.stock) : []
        });

        if (error) {
          console.error('❌ [Shop] Lỗi fetch:', error);
          throw error;
        }

        console.log('✅ [Shop] Fetch thành công!', {
          products: data?.length,
          currentBranchId
        });

        setParts(data || []);
      } catch (error) {
        console.error('❌ [Shop] Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(12);
  }, [searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(parts.map((p) => p.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [parts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    console.log('🔍 [Shop] Filtering products...', {
      totalParts: parts.length,
      currentBranchId,
      searchQuery,
      selectedCategory
    });

    let filtered = parts.filter((p) => {
      // Stock is JSONB: {CN1: quantity}
      // Get actual branch ID from stock keys (CN1, CN2, etc.)
      const stockKeys = p.stock && typeof p.stock === 'object' ? Object.keys(p.stock) : [];
      const actualBranchId = stockKeys[0] || 'CN1'; // Use first branch or default to CN1

      // Calculate TOTAL stock across ALL branches
      let totalStock = 0;
      if (p.stock && typeof p.stock === 'object') {
        totalStock = Object.values(p.stock).reduce((sum: number, qty: any) => {
          const numQty = Number(qty) || 0;
          return sum + numQty;
        }, 0);
      }

      const hasStock = totalStock > 0;

      if (!hasStock) return false;

      // Store actual branch ID in product for display
      (p as any).actualBranchId = actualBranchId;

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

    console.log('✅ [Shop] Filter result:', {
      filteredCount: filtered.length,
      sampleProduct: filtered[0]
    });

    return filtered;
  }, [parts, searchQuery, selectedCategory, currentBranchId]);

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
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <div className="relative overflow-hidden bg-slate-900 text-white py-20">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-20">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/50 to-transparent"></div>
            </div>

            <div className="container mx-auto px-4 relative z-10 text-center">
              <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                Phụ Tùng Xe Máy Chính Hãng
              </h1>
              <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                Tìm kiếm và đặt hàng phụ tùng chất lượng cao nhanh chóng, tiện lợi với mức giá tốt nhất
              </p>
            </div>
          </div>

          <div className="container mx-auto px-4 py-8">
            {/* Search & Filter Bar */}
            <div className="sticky top-4 z-40 bg-white/80 dark:bg-[#1e1e2d]/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-xl p-4 md:p-6 mb-8 transition-all duration-300">
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
                    className={`p-2 rounded-lg transition-colors ${viewMode === "grid"
                        ? "bg-blue-500 text-white"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 rounded-lg transition-colors ${viewMode === "list"
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
                Hiển thị <span className="font-bold text-blue-600 dark:text-blue-400">{Math.min(displayCount, filteredProducts.length)}</span> / {filteredProducts.length} sản phẩm
              </div>
            </div>

            {/* Products Grid/List */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
                {filteredProducts.slice(0, displayCount).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    cartQuantity={cart.get(product.id) || 0}
                    currentBranchId={currentBranchId}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.slice(0, displayCount).map((product) => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    cartQuantity={cart.get(product.id) || 0}
                    currentBranchId={currentBranchId}
                  />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {displayCount < filteredProducts.length && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setDisplayCount(prev => prev + 12)}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
                >
                  Xem thêm ({filteredProducts.length - displayCount} sản phẩm)
                </button>
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
                            src={item.part.imageUrl || `/images/products/${item.part.sku || 'placeholder'}.png`}
                            alt={item.part.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              if (e.currentTarget.src.endsWith('.png')) {
                                e.currentTarget.src = `/images/products/${item.part.sku || 'placeholder'}.jpg`;
                              } else {
                                e.currentTarget.src = "/images/products/placeholder.jpg";
                              }
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
        </>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  onAddToCart,
  cartQuantity,
  currentBranchId,
}: {
  product: Part;
  onAddToCart: (id: string) => void;
  cartQuantity: number;
  currentBranchId: string;
}) {
  const categoryColor = getCategoryColor(product.category || "");

  // Determine availability
  const stock = (product.stock && typeof product.stock === 'object')
    ? (product.stock[(product as any).actualBranchId || 'CN1'] || 0)
    : 0;
  const isOutOfStock = stock <= 0;

  return (
    <div className="group relative bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col h-full">
      {/* Image */}
      <div className="relative aspect-square bg-slate-50 dark:bg-[#151521] overflow-hidden">
        <img
          src={product.imageUrl || `/images/products/${product.sku || 'placeholder'}.webp`}
          alt={product.name}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
          onError={(e) => {
            const target = e.currentTarget;
            // Try .webp -> .png -> .jpg -> placeholder
            if (target.src.endsWith('.webp')) {
              target.src = `/images/products/${product.sku || 'placeholder'}.png`;
            } else if (target.src.endsWith('.png')) {
              target.src = `/images/products/${product.sku || 'placeholder'}.jpg`;
            } else {
              target.src = "/images/products/placeholder.jpg";
            }
          }}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {product.category && (
            <span className={`px-3 py-1 bg-black/50 backdrop-blur-md text-white text-xs font-bold rounded-full`}>
              {product.category}
            </span>
          )}
        </div>

        {cartQuantity > 0 && (
          <div className="absolute top-3 right-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg animate-scaleIn">
            {cartQuantity}
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          {!isOutOfStock && (
            <button
              onClick={() => onAddToCart(product.id)}
              className="bg-white text-slate-900 px-6 py-2 rounded-full font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-blue-50"
            >
              Thêm nhanh
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-auto">
          <p className="text-xs text-slate-400 font-mono mb-1">#{product.sku}</p>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight mb-2 line-clamp-2 group-hover:text-blue-500 transition-colors">
            {product.name}
          </h3>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Đơn giá</p>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {formatCurrency(
                (product.retailPrice && typeof product.retailPrice === 'object')
                  ? (product.retailPrice[(product as any).actualBranchId || 'CN1'] || 0)
                  : 0
              )}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Kho</p>
            {isOutOfStock ? (
              <span className="text-sm font-bold text-red-500">Hết hàng</span>
            ) : (
              <span className="text-sm font-bold text-emerald-500">{stock}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Product List Item Component
function ProductListItem({
  product,
  onAddToCart,
  cartQuantity,
  currentBranchId,
}: {
  product: Part;
  onAddToCart: (id: string) => void;
  cartQuantity: number;
  currentBranchId: string;
}) {
  const categoryColor = getCategoryColor(product.category || "");

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg hover:shadow-2xl transition-shadow p-4 flex items-center gap-4">
      {/* Image */}
      <div className="relative w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={product.imageUrl || `/images/products/${product.sku || 'placeholder'}.webp`}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.currentTarget;
            // Try .webp -> .png -> .jpg -> placeholder
            if (target.src.endsWith('.webp')) {
              target.src = `/images/products/${product.sku || 'placeholder'}.png`;
            } else if (target.src.endsWith('.png')) {
              target.src = `/images/products/${product.sku || 'placeholder'}.jpg`;
            } else {
              target.src = "/images/products/placeholder.jpg";
            }
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
          {formatCurrency(
            (product.retailPrice && typeof product.retailPrice === 'object')
              ? (product.retailPrice[(product as any).actualBranchId || 'CN1'] || 0)
              : 0
          )}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Còn: {
            (product.stock && typeof product.stock === 'object')
              ? (product.stock[(product as any).actualBranchId || 'CN1'] || 0)
              : 0
          }
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
