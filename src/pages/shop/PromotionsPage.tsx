import React, { useState, useEffect } from "react";
import { Clock, ChevronRight, Tag, Star, Phone, MessageCircle, Gift, Percent, X, Calendar, Info } from "lucide-react";
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
  detail_image_url?: string; // Hình chi tiết khi bấm xem
  products?: string[];
  min_purchase?: number;
  is_active: boolean;
  featured?: boolean;
}

// Simple Countdown
function Countdown({ endDate }: { endDate: string }) {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const calc = () => {
      const diff = Math.max(0, new Date(endDate).getTime() - Date.now());
      return {
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      };
    };
    setTime(calc());
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return (
    <div className="flex items-center gap-1 text-sm font-mono">
      <span className="bg-red-600 text-white px-2 py-1 rounded font-bold">{time.d}d</span>
      <span className="text-slate-400">:</span>
      <span className="bg-slate-700 text-white px-2 py-1 rounded">{String(time.h).padStart(2, '0')}</span>
      <span className="text-slate-400">:</span>
      <span className="bg-slate-700 text-white px-2 py-1 rounded">{String(time.m).padStart(2, '0')}</span>
      <span className="text-slate-400">:</span>
      <span className="bg-slate-700 text-white px-2 py-1 rounded">{String(time.s).padStart(2, '0')}</span>
    </div>
  );
}

// Promotion Detail Modal
function PromoModal({ promotion, onClose }: { promotion: any; onClose: () => void }) {
  const daysLeft = getDaysRemaining(promotion.endDate);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image - Full Display (Use detail image if available) */}
        <div className="relative bg-slate-200 dark:bg-slate-700">
          <img
            src={promotion.detailImageUrl || promotion.imageUrl || "https://placehold.co/800x600/1e40af/white?text=Chi+Tiết+Khuyến+Mãi"}
            alt={promotion.title}
            className="w-full max-h-[60vh] object-contain bg-slate-100 dark:bg-slate-800"
          />

          {promotion.discountPercent && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl shadow-lg">
              <Percent className="w-5 h-5" />
              <span className="font-bold text-xl">Giảm {promotion.discountPercent}%</span>
            </div>
          )}

          {promotion.discountAmount && !promotion.discountPercent && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl shadow-lg">
              <span className="font-bold text-xl">Giảm {formatCurrency(promotion.discountAmount)}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            {promotion.title}
          </h2>

          {/* Description - Preserve line breaks */}
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed whitespace-pre-line">
            {promotion.description}
          </p>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                <span>Thời gian</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {new Date(promotion.startDate).toLocaleDateString("vi-VN")} - {new Date(promotion.endDate).toLocaleDateString("vi-VN")}
              </p>
            </div>

            <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
                <Clock className="w-4 h-4" />
                <span>Còn lại</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {daysLeft > 0 ? `${daysLeft} ngày` : 'Đã hết hạn'}
              </p>
            </div>
          </div>

          {promotion.minPurchase && (
            <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl mb-6">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-800 dark:text-blue-200">
                Áp dụng cho đơn hàng từ <strong>{formatCurrency(promotion.minPurchase)}</strong>
              </span>
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="tel:0947747907"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              <Phone className="w-5 h-5" />
              Gọi ngay: 0947.747.907
            </a>
            <a
              href="https://zalo.me/0947747907"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Chat Zalo
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const [selectedPromo, setSelectedPromo] = useState<any | null>(null);

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
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  const format = promotions.map(p => ({
    ...p,
    discountPercent: p.discount_percent,
    discountAmount: p.discount_amount,
    startDate: p.start_date,
    endDate: p.end_date,
    imageUrl: p.image_url,
    detailImageUrl: p.detail_image_url, // Hình chi tiết
    minPurchase: p.min_purchase,
    isActive: p.is_active,
  }));

  const active = format.filter(p => p.isActive);
  const featured = active.filter(p => p.featured);
  const regular = active.filter(p => !p.featured);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Modal */}
      {selectedPromo && (
        <PromoModal promotion={selectedPromo} onClose={() => setSelectedPromo(null)} />
      )}

      {/* Simple Clean Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Gift className="w-8 h-8" />
            <h1 className="text-2xl md:text-3xl font-bold">Chương Trình Khuyến Mãi</h1>
          </div>
          <p className="text-center text-blue-100">
            Tiết kiệm đến <span className="font-bold text-yellow-300">50%</span> cho dịch vụ bảo dưỡng
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Featured Section */}
        {featured.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Ưu Đãi Nổi Bật</h2>
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded animate-pulse">HOT</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {featured.map(promo => (
                <FeaturedCard key={promo.id} promotion={promo} onViewDetail={() => setSelectedPromo(promo)} />
              ))}
            </div>
          </section>
        )}

        {/* Regular Section */}
        {regular.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Ưu Đãi Khác</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regular.map(promo => (
                <RegularCard key={promo.id} promotion={promo} onViewDetail={() => setSelectedPromo(promo)} />
              ))}
            </div>
          </section>
        )}

        {/* Contact */}
        <section className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 text-center">
            Cần Tư Vấn?
          </h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="tel:0947747907"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
            >
              <Phone className="w-5 h-5" />
              0947.747.907
            </a>
            <a
              href="https://zalo.me/0947747907"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              Chat Zalo
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

// Featured Card - Clean Design with separate image and text
function FeaturedCard({ promotion, onViewDetail }: { promotion: any; onViewDetail: () => void }) {
  const daysLeft = getDaysRemaining(promotion.endDate);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Top: Image - 675x370 aspect ratio */}
      <div className="relative bg-slate-200 dark:bg-slate-700" style={{ aspectRatio: '675/370' }}>
        <img
          src={promotion.imageUrl || "https://placehold.co/675x370/1e40af/white?text=Khuyến+Mãi"}
          alt={promotion.title}
          className="w-full h-full object-cover"
        />

        {/* Discount Badge - Top Left */}
        {promotion.discountPercent && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg shadow-lg">
            <Percent className="w-4 h-4" />
            <span className="font-bold text-lg">-{promotion.discountPercent}%</span>
          </div>
        )}

        {/* Days Left - Top Right */}
        {daysLeft <= 7 && daysLeft > 0 && (
          <div className="absolute top-3 right-3 px-3 py-1.5 bg-orange-500 text-white text-sm font-bold rounded-lg shadow-lg">
            Còn {daysLeft} ngày
          </div>
        )}
      </div>

      {/* Bottom: Content - Clear Background */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
          {promotion.title}
        </h3>

        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
          {promotion.description}
        </p>

        {/* Countdown */}
        {daysLeft <= 7 && daysLeft > 0 && (
          <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Kết thúc trong:</span>
              <Countdown endDate={promotion.endDate} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>Đến {new Date(promotion.endDate).toLocaleDateString("vi-VN")}</span>
          </div>

          <button
            onClick={onViewDetail}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Xem chi tiết
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Regular Card - Simple Clean Design
function RegularCard({ promotion, onViewDetail }: { promotion: any; onViewDetail: () => void }) {
  const daysLeft = getDaysRemaining(promotion.endDate);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image - 675x370 aspect ratio */}
      <div className="relative bg-slate-200 dark:bg-slate-700" style={{ aspectRatio: '675/370' }}>
        <img
          src={promotion.imageUrl || "https://placehold.co/675x370/1e40af/white?text=Ưu+Đãi"}
          alt={promotion.title}
          className="w-full h-full object-cover"
        />

        {promotion.discountPercent && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-sm font-bold rounded">
            -{promotion.discountPercent}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
          {promotion.title}
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {promotion.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Đã hết hạn'}
          </span>

          <button
            onClick={onViewDetail}
            className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            Chi tiết <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getDaysRemaining(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}
