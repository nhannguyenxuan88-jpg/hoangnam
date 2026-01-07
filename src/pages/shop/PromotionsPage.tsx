import React from "react";
import { Tag, Gift, Clock, ChevronRight, Percent, Star, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percent?: number;
  discount_amount?: number;
  start_date: string;
  end_date: string;
  image_url?: string;
  products?: string[];
  min_purchase?: number;
  is_active: boolean;
  featured?: boolean;
}

export default function PromotionsPage() {
  // Fetch promotions from Supabase
  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .order('featured', { ascending: false })
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data as Promotion[];
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  // Keep backward compatibility with old format
  const formatPromotions = promotions.map(p => ({
    ...p,
    discountPercent: p.discount_percent,
    discountAmount: p.discount_amount,
    startDate: p.start_date,
    endDate: p.end_date,
    imageUrl: p.image_url,
    minPurchase: p.min_purchase,
    isActive: p.is_active,
  }));

  const activeFeatured = formatPromotions.filter(p => p.featured);

  const activePromotions = formatPromotions.filter((p) => p.isActive);
  const featuredPromotions = activePromotions.filter((p) => p.featured);
  const regularPromotions = activePromotions.filter((p) => !p.featured);

  const isPromotionActive = (promo: any) => {
    const now = new Date();
    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    return now >= start && now <= end;
  };

  const getDaysRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 dark:from-[#0a0a0f] dark:to-[#1a1a2e]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white py-8 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center mb-3">
            <Gift className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2 text-center">
            🎉 Chương Trình Khuyến Mãi
          </h1>
          <p className="text-sm md:text-base text-center text-purple-100 max-w-2xl mx-auto">
            Cập nhật liên tục các ưu đãi hấp dẫn dành cho bạn
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Featured Promotions */}
        {featuredPromotions.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-500" />
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
                Khuyến Mãi Nổi Bật
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {featuredPromotions.map((promo) => (
                <FeaturedPromoCard key={promo.id} promotion={promo} />
              ))}
            </div>
          </section>
        )}

        {/* Regular Promotions */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
              Ưu Đãi Khác
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPromotions.map((promo) => (
              <PromoCard key={promo.id} promotion={promo} />
            ))}
          </div>
        </section>

        {/* Call to Action */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-center text-white">
          <h3 className="text-lg md:text-xl font-bold mb-3">
            Đừng bỏ lỡ các ưu đãi đặc biệt!
          </h3>
          <p className="mb-4 text-sm md:text-base text-blue-100">
            Liên hệ ngay để được tư vấn và nhận thêm nhiều khuyến mãi hấp dẫn
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="tel:0947747907"
              className="px-4 py-2 md:px-6 md:py-3 bg-white text-blue-600 rounded-lg md:rounded-xl font-bold text-sm md:text-base hover:bg-blue-50 transition-colors"
            >
              📞 Gọi ngay: 0947.747.907
            </a>
            <a
              href="https://zalo.me/0947747907"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 md:px-6 md:py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg md:rounded-xl font-bold text-sm md:text-base transition-colors"
            >
              💬 Chat Zalo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Featured Promotion Card (Large)
function FeaturedPromoCard({ promotion }: { promotion: Promotion }) {
  const daysLeft = getDaysRemaining(promotion.endDate);
  const isActive = isPromotionActive(promotion);

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg overflow-hidden hover:scale-[1.02] transition-transform">
      {/* Image */}
      <div className="relative h-48 md:h-56 bg-gradient-to-br from-purple-400 to-pink-400">
        <img
          src={promotion.imageUrl}
          alt={promotion.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {!isActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg font-bold">
              Đã hết hạn
            </span>
          </div>
        )}
        {isActive && daysLeft <= 7 && (
          <div className="absolute top-3 right-3 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg font-bold animate-pulse">
            ⚡ Còn {daysLeft} ngày
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:p-5">
        <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mb-2">
          {promotion.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
          {promotion.description}
        </p>

        {/* Discount Info */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {promotion.discountPercent && (
            <div className="px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-bold text-sm">
              <Percent className="w-3 h-3 inline mr-1" />
              -{promotion.discountPercent}%
            </div>
          )}
          {promotion.discountAmount && (
            <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold text-sm">
              Giảm {formatCurrency(promotion.discountAmount)}
            </div>
          )}
          {promotion.minPurchase && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Đơn tối thiểu: {formatCurrency(promotion.minPurchase)}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <Clock className="w-3.5 h-3.5" />
          <span>
            {new Date(promotion.startDate).toLocaleDateString("vi-VN")} -{" "}
            {new Date(promotion.endDate).toLocaleDateString("vi-VN")}
          </span>
        </div>

        <button className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
          Xem chi tiết
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Regular Promotion Card (Small)
function PromoCard({ promotion }: { promotion: Promotion }) {
  const daysLeft = getDaysRemaining(promotion.endDate);
  const isActive = isPromotionActive(promotion);

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg hover:shadow-2xl transition-shadow overflow-hidden">
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-400">
        <img
          src={promotion.imageUrl}
          alt={promotion.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {!isActive && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-3 py-1 bg-red-500 text-white rounded text-sm font-bold">
              Hết hạn
            </span>
          </div>
        )}
        {isActive && daysLeft <= 3 && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-red-500 text-white rounded-lg text-sm font-bold animate-pulse">
            Còn {daysLeft} ngày
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
          {promotion.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
          {promotion.description}
        </p>

        {/* Discount Badge */}
        {promotion.discountPercent && (
          <div className="inline-block px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm font-bold mb-3">
            -{promotion.discountPercent}%
          </div>
        )}

        {/* Duration */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <Clock className="w-3 h-3" />
          <span>
            Đến {new Date(promotion.endDate).toLocaleDateString("vi-VN")}
          </span>
        </div>

        <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors">
          Xem chi tiết
        </button>
      </div>
    </div>
  );
}

function getDaysRemaining(endDate: string) {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isPromotionActive(promo: Promotion) {
  const now = new Date();
  const start = new Date(promo.startDate);
  const end = new Date(promo.endDate);
  return now >= start && now <= end;
}
