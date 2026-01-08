import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, Play, Star, AlertCircle } from 'lucide-react';

interface GalleryItem {
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
    rating: number;
    featured: boolean;
}

export default function GalleryManager() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
    const queryClient = useQueryClient();

    // Fetch gallery items
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['gallery-items-admin'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('gallery_items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as GalleryItem[];
        }
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (formData: Partial<GalleryItem>) => {
            if (editingItem) {
                const { error } = await supabase
                    .from('gallery_items')
                    .update(formData)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('gallery_items')
                    .insert([formData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery-items-admin'] });
            queryClient.invalidateQueries({ queryKey: ['gallery-items'] });
            resetForm();
            alert('✅ Lưu thành công!');
        },
        onError: (error: Error) => {
            alert(`❌ Lỗi: ${error.message}`);
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('gallery_items')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gallery-items-admin'] });
            queryClient.invalidateQueries({ queryKey: ['gallery-items'] });
        }
    });

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const item: Partial<GalleryItem> = {
            title: formData.get('title') as string,
            description: formData.get('description') as string,
            image_url: formData.get('image_url') as string || undefined,
            video_id: formData.get('video_id') as string || undefined,
            vehicle_model: formData.get('vehicle_model') as string || undefined,
            service_type: formData.get('service_type') as string || undefined,
            date: formData.get('date') as string,
            before_image: formData.get('before_image') as string || undefined,
            after_image: formData.get('after_image') as string || undefined,
            rating: Number(formData.get('rating')) || 5,
            featured: formData.get('featured') === 'on',
        };

        saveMutation.mutate(item);
    };

    const resetForm = () => {
        setIsFormOpen(false);
        setEditingItem(null);
    };

    const startEdit = (item: GalleryItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Bạn có chắc muốn xóa mục này?')) {
            deleteMutation.mutate(id);
        }
    };

    const serviceTypes = ['Đại tu động cơ', 'Sơn xe', 'Thay phanh', 'Độ xe', 'Bảo dưỡng', 'Sửa chữa điện', 'Phục hồi tai nạn'];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản Lý Thư Viện</h1>
                    <p className="text-sm text-gray-500 mt-1">Thêm, sửa, xóa các công việc bảo trì</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus className="h-5 w-5" />
                    Thêm Mới
                </button>
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingItem ? 'Sửa Công Việc' : 'Thêm Công Việc Mới'}
                                </h2>
                                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tiêu Đề *
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        required
                                        defaultValue={editingItem?.title}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="VD: Đại Tu Động Cơ Honda Winner X"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Mô Tả
                                    </label>
                                    <textarea
                                        name="description"
                                        rows={3}
                                        defaultValue={editingItem?.description}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="Mô tả công việc..."
                                    />
                                </div>

                                {/* Image URL */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Đường Dẫn Hình Ảnh
                                    </label>
                                    <input
                                        type="text"
                                        name="image_url"
                                        defaultValue={editingItem?.image_url}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="/images/maintenance/ten-file.jpg"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Lưu ảnh vào thư mục public/images/maintenance/
                                    </p>
                                </div>

                                {/* Video ID */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        YouTube Video ID
                                    </label>
                                    <input
                                        type="text"
                                        name="video_id"
                                        defaultValue={editingItem?.video_id}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        placeholder="VD: dQw4w9WgXcQ (từ youtube.com/watch?v=dQw4w9WgXcQ)"
                                    />
                                </div>

                                {/* Vehicle Model & Service Type */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Dòng Xe
                                        </label>
                                        <input
                                            type="text"
                                            name="vehicle_model"
                                            defaultValue={editingItem?.vehicle_model}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="VD: Honda Winner X"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Loại Dịch Vụ
                                        </label>
                                        <select
                                            name="service_type"
                                            defaultValue={editingItem?.service_type}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        >
                                            <option value="">Chọn loại dịch vụ</option>
                                            {serviceTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Date */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ngày Hoàn Thành
                                    </label>
                                    <input
                                        type="date"
                                        name="date"
                                        defaultValue={editingItem?.date || new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Before/After Images */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hình Trước
                                        </label>
                                        <input
                                            type="text"
                                            name="before_image"
                                            defaultValue={editingItem?.before_image}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="/images/maintenance/before.jpg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Hình Sau
                                        </label>
                                        <input
                                            type="text"
                                            name="after_image"
                                            defaultValue={editingItem?.after_image}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="/images/maintenance/after.jpg"
                                        />
                                    </div>
                                </div>

                                {/* Rating & Featured */}
                                <div className="flex items-center gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Đánh Giá
                                        </label>
                                        <select
                                            name="rating"
                                            defaultValue={editingItem?.rating || 5}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                        >
                                            {[1, 2, 3, 4, 5].map(r => (
                                                <option key={r} value={r}>{r} ⭐</option>
                                            ))}
                                        </select>
                                    </div>
                                    <label className="flex items-center gap-2 mt-6">
                                        <input
                                            type="checkbox"
                                            name="featured"
                                            defaultChecked={editingItem?.featured ?? false}
                                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-700">Nổi bật</span>
                                    </label>
                                </div>

                                {/* Buttons */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saveMutation.isPending}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                    >
                                        <Save className="h-4 w-4" />
                                        {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Items List */}
            <div className="grid gap-4">
                {items.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-12 text-center">
                        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">Chưa có mục nào. Nhấn "Thêm Mới" để bắt đầu!</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                            <div className="flex gap-4">
                                {/* Image */}
                                <div className="w-32 h-24 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-gray-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                {item.title}
                                                {item.video_id && <Play className="w-4 h-4 text-red-500" />}
                                            </h3>
                                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                {item.description}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span>{new Date(item.date).toLocaleDateString('vi-VN')}</span>
                                                {item.vehicle_model && <span>{item.vehicle_model}</span>}
                                                {item.service_type && <span className="text-emerald-600">{item.service_type}</span>}
                                                <span className="flex items-center gap-0.5">
                                                    {[...Array(item.rating)].map((_, i) => (
                                                        <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                    ))}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {item.featured && (
                                                <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded">
                                                    Nổi bật
                                                </span>
                                            )}
                                            <button
                                                onClick={() => startEdit(item)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
