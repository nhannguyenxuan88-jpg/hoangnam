import React, { useState } from "react";
import {
  Image as ImageIcon,
  Play,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Award,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";

interface MaintenanceGalleryItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoId?: string;
  vehicleModel?: string;
  serviceType?: string;
  date: string;
  beforeImage?: string;
  afterImage?: string;
  rating?: number;
  featured?: boolean;
}

interface DBGalleryItem {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  video_id?: string;
  vehicle_model?: string;
  service_type?: string;
  date: string;
  before_image?: string;
  after_image?: string;
  rating?: number;
  featured?: boolean;
}

export default function MaintenanceGallery() {
  // Fetch gallery items from Supabase
  const { data: galleryItems = [], isLoading } = useQuery({
    queryKey: ['gallery-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gallery_items')
        .select('*')
        .order('featured', { ascending: false })
        .order('date', { ascending: false });

      if (error) throw error;

      // Map snake_case to camelCase
      return (data as DBGalleryItem[]).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        imageUrl: item.image_url || '/images/maintenance/placeholder.jpg',
        videoId: item.video_id,
        vehicleModel: item.vehicle_model,
        serviceType: item.service_type,
        date: item.date,
        beforeImage: item.before_image,
        afterImage: item.after_image,
        rating: item.rating,
        featured: item.featured,
      })) as MaintenanceGalleryItem[];
    }
  });

  const [selectedItem, setSelectedItem] = useState<MaintenanceGalleryItem | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const featuredItems = galleryItems.filter((item) => item.featured);
  const serviceTypes = Array.from(new Set(galleryItems.map((item) => item.serviceType).filter(Boolean)));

  const filteredItems = galleryItems.filter((item) => {
    if (filter === "all") return true;
    return item.serviceType === filter;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-[#0a0a0f] dark:to-[#1a1a2e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50 dark:from-[#0a0a0f] dark:to-[#1a1a2e]">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center mb-4">
            <Award className="w-16 h-16" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
            📸 Thư Viện Bảo Trì
          </h1>
          <p className="text-xl text-center text-emerald-100 max-w-2xl mx-auto">
            Những công việc bảo trì, sửa chữa chất lượng của chúng tôi
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              500+
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Xe đã sửa chữa
            </div>
          </div>
          <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
              100%
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Khách hài lòng
            </div>
          </div>
          <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              5 ⭐
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Đánh giá trung bình
            </div>
          </div>
          <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-6 text-center shadow-lg">
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
              3+
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Năm kinh nghiệm
            </div>
          </div>
        </div>

        {/* Featured Works */}
        {featuredItems.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-8 h-8 text-yellow-500" />
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Công Việc Nổi Bật
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredItems.map((item) => (
                <FeaturedWorkCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === "all"
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-[#1e1e2d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2a2a3d]"
              }`}
          >
            Tất cả
          </button>
          {serviceTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type!)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === type
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-[#1e1e2d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#2a2a3d]"
                }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <GalleryCard
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedItem && (
        <LightboxModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

// Featured Work Card (Large)
function FeaturedWorkCard({
  item,
  onClick,
}: {
  item: MaintenanceGalleryItem;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
    >
      <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/images/maintenance/placeholder.jpg";
          }}
        />
        <div className="absolute top-3 right-3 px-3 py-1 bg-yellow-500 text-white rounded-lg font-bold text-sm flex items-center gap-1">
          <Star className="w-4 h-4 fill-white" />
          Nổi bật
        </div>
        {item.rating && (
          <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/70 text-white rounded-lg font-bold text-sm flex items-center gap-1">
            {[...Array(item.rating)].map((_, i) => (
              <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {item.title}
        </h3>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-3 line-clamp-2">
          {item.description}
        </p>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(item.date).toLocaleDateString("vi-VN")}
          </span>
          {item.vehicleModel && (
            <span className="font-medium">{item.vehicleModel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Gallery Card (Small)
function GalleryCard({
  item,
  onClick,
}: {
  item: MaintenanceGalleryItem;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-shadow group"
    >
      <div className="relative aspect-square bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.src = "/images/maintenance/placeholder.jpg";
          }}
        />
        {item.beforeImage && item.afterImage && (
          <div className="absolute top-3 left-3 px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold">
            Before/After
          </div>
        )}
        {item.rating && (
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 text-white rounded text-xs flex items-center gap-1">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            {item.rating}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">
          {item.title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.vehicleModel || item.serviceType}
        </p>
      </div>
    </div>
  );
}

// Lightbox Modal
function LightboxModal({
  item,
  onClose,
}: {
  item: MaintenanceGalleryItem;
  onClose: () => void;
}) {
  const [showBefore, setShowBefore] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors z-10"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-5xl w-full bg-white dark:bg-[#1e1e2d] rounded-2xl overflow-hidden">
        {/* Video or Image */}
        <div className="relative bg-slate-900">
          {/* YouTube Video */}
          {item.videoId && showVideo ? (
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${item.videoId}?autoplay=1`}
                title={item.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : item.beforeImage && item.afterImage ? (
            <div className="relative aspect-video">
              <img
                src={showBefore ? item.beforeImage : item.afterImage}
                alt={showBefore ? "Trước" : "Sau"}
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <button
                  onClick={() => setShowBefore(true)}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors ${showBefore
                    ? "bg-white text-slate-900"
                    : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                >
                  Trước
                </button>
                <button
                  onClick={() => setShowBefore(false)}
                  className={`px-4 py-2 rounded-lg font-bold transition-colors ${!showBefore
                    ? "bg-white text-slate-900"
                    : "bg-white/20 text-white hover:bg-white/30"
                    }`}
                >
                  Sau
                </button>
              </div>
            </div>
          ) : (
            <div className="aspect-video relative">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-contain"
              />
              {/* Play button overlay if video exists */}
              {item.videoId && !showVideo && (
                <button
                  onClick={() => setShowVideo(true)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
                >
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-2xl">
                    <Play className="w-10 h-10 text-white fill-white ml-1" />
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Video toggle button if has video */}
          {item.videoId && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="absolute top-4 left-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              {showVideo ? 'Xem ảnh' : 'Xem video'}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {item.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                {item.description}
              </p>
            </div>
            {item.rating && (
              <div className="flex items-center gap-1 ml-4">
                {[...Array(item.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {item.vehicleModel && (
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Xe
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {item.vehicleModel}
                </div>
              </div>
            )}
            {item.serviceType && (
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Dịch vụ
                </div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {item.serviceType}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Ngày hoàn thành
              </div>
              <div className="font-bold text-slate-900 dark:text-white">
                {new Date(item.date).toLocaleDateString("vi-VN")}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Chất lượng
              </div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Xuất sắc
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
