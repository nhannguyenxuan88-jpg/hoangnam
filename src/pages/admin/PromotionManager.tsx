import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface Promotion {
  id: string;
  title: string;
  description: string;
  discount_percent?: number;
  discount_amount?: number;
  start_date: string;
  end_date: string;
  image_url?: string;
  detail_image_url?: string;
  products?: string[];
  min_purchase?: number;
  is_active: boolean;
  featured: boolean;
}

export default function PromotionManager() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [detailImageFile, setDetailImageFile] = useState<File | null>(null);
  const [detailImagePreview, setDetailImagePreview] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  // Fetch promotions
  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Promotion[];
    }
  });

  // Upload image to Supabase Storage
  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `promotions/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('images').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: Partial<Promotion>) => {
      console.log('💾 Saving promotion:', formData);

      let imageUrl = formData.image_url;
      let detailImageUrl = formData.detail_image_url;

      // Upload thumbnail image if new file selected
      if (imageFile) {
        console.log('📷 Uploading thumbnail image...');
        setUploadProgress(25);
        try {
          imageUrl = await uploadImage(imageFile);
          console.log('✅ Thumbnail uploaded:', imageUrl);
        } catch (uploadErr) {
          console.error('❌ Thumbnail upload failed:', uploadErr);
          throw new Error('Không thể tải hình thumbnail lên. Vui lòng thử lại.');
        }
      }

      // Upload detail image if new file selected
      if (detailImageFile) {
        console.log('📷 Uploading detail image...');
        setUploadProgress(50);
        try {
          detailImageUrl = await uploadImage(detailImageFile);
          console.log('✅ Detail image uploaded:', detailImageUrl);
        } catch (uploadErr) {
          console.error('❌ Detail image upload failed:', uploadErr);
          throw new Error('Không thể tải hình chi tiết lên. Vui lòng thử lại.');
        }
      }

      setUploadProgress(75);

      const promotionData = {
        ...formData,
        image_url: imageUrl,
        detail_image_url: detailImageUrl
      };

      console.log('📤 Sending to database:', promotionData);

      if (editingPromotion) {
        // Update
        console.log('🔄 Updating promotion ID:', editingPromotion.id);
        const { data, error } = await supabase
          .from('promotions')
          .update(promotionData)
          .eq('id', editingPromotion.id)
          .select();

        if (error) {
          console.error('❌ Update error:', error);
          throw new Error(`Lỗi cập nhật: ${error.message}`);
        }
        console.log('✅ Update success:', data);
        return data;
      } else {
        // Insert
        console.log('➕ Creating new promotion');
        const { data, error } = await supabase
          .from('promotions')
          .insert([promotionData])
          .select();

        if (error) {
          console.error('❌ Insert error:', error);
          throw new Error(`Lỗi thêm mới: ${error.message}`);
        }
        console.log('✅ Insert success:', data);
        return data;
      }
    },
    onSuccess: (data) => {
      console.log('🎉 Mutation success, refreshing data...');
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      resetForm();
      alert('✅ Lưu thành công!');
    },
    onError: (error: Error) => {
      console.error('❌ Mutation error:', error);
      alert(`❌ Lỗi: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions-admin'] });
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    }
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDetailImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDetailImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDetailImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const promotion: Partial<Promotion> = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      discount_percent: formData.get('discount_percent') ? Number(formData.get('discount_percent')) : undefined,
      discount_amount: formData.get('discount_amount') ? Number(formData.get('discount_amount')) : undefined,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      min_purchase: formData.get('min_purchase') ? Number(formData.get('min_purchase')) : undefined,
      is_active: formData.get('is_active') === 'on',
      featured: formData.get('featured') === 'on',
      image_url: editingPromotion?.image_url,
      detail_image_url: editingPromotion?.detail_image_url
    };

    saveMutation.mutate(promotion);
  };

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingPromotion(null);
    setImageFile(null);
    setImagePreview('');
    setDetailImageFile(null);
    setDetailImagePreview('');
    setUploadProgress(0);
  };

  const startEdit = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setImagePreview(promotion.image_url || '');
    setDetailImagePreview(promotion.detail_image_url || '');
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc muốn xóa khuyến mãi này?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản Lý Khuyến Mãi</h1>
          <p className="text-sm text-gray-500 mt-1">Thêm, sửa, xóa các chương trình khuyến mãi</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Thêm Khuyến Mãi
        </button>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingPromotion ? 'Sửa Khuyến Mãi' : 'Thêm Khuyến Mãi Mới'}
                </h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hình Ảnh Khuyến Mãi
                  </label>
                  <div className="flex items-center gap-4">
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-32 w-48 object-cover rounded-lg border-2 border-gray-200"
                      />
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-500 transition-colors">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {imageFile ? imageFile.name : 'Chọn hình thumbnail...'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Kích thước: 800 x 400 px (tỷ lệ 2:1)</p>
                </div>

                {/* Detail Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hình Chi Tiết (hiển thị khi bấm Xem chi tiết)
                  </label>
                  <div className="flex items-center gap-4">
                    {detailImagePreview && (
                      <img
                        src={detailImagePreview}
                        alt="Detail Preview"
                        className="h-40 w-32 object-cover rounded-lg border-2 border-blue-200"
                      />
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 transition-colors bg-blue-50">
                        <ImageIcon className="h-5 w-5 text-blue-400" />
                        <span className="text-sm text-blue-600">
                          {detailImageFile ? detailImageFile.name : 'Chọn hình chi tiết...'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDetailImageSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Kích thước: 800 x 1000 px hoặc tự do</p>
                </div>

                {/* Upload Progress */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Đang tải lên... {uploadProgress}%</p>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiêu Đề *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={editingPromotion?.title}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="VD: 🔧 Thay Chén Cổ Honda Chính Hãng"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mô Tả
                  </label>
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={editingPromotion?.description}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Nhập chi tiết chương trình khuyến mãi..."
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ngày Bắt Đầu *
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      required
                      defaultValue={editingPromotion?.start_date}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ngày Kết Thúc *
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      required
                      defaultValue={editingPromotion?.end_date}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Discount */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giảm Giá (%)
                    </label>
                    <input
                      type="number"
                      name="discount_percent"
                      min="0"
                      max="100"
                      defaultValue={editingPromotion?.discount_percent}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="VD: 20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giảm Giá (VNĐ)
                    </label>
                    <input
                      type="number"
                      name="discount_amount"
                      min="0"
                      step="1000"
                      defaultValue={editingPromotion?.discount_amount}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="VD: 100000"
                    />
                  </div>
                </div>

                {/* Min Purchase */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đơn Tối Thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    name="min_purchase"
                    min="0"
                    step="1000"
                    defaultValue={editingPromotion?.min_purchase}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="VD: 500000"
                  />
                </div>

                {/* Checkboxes */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={editingPromotion?.is_active ?? true}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Kích hoạt</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="featured"
                      defaultChecked={editingPromotion?.featured ?? false}
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
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
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
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

      {/* Promotions List */}
      <div className="grid gap-4">
        {promotions.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">Chưa có khuyến mãi nào. Nhấn "Thêm Khuyến Mãi" để bắt đầu!</p>
          </div>
        ) : (
          promotions.map((promotion) => (
            <div
              key={promotion.id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {/* Image */}
                {promotion.image_url && (
                  <img
                    src={promotion.image_url}
                    alt={promotion.title}
                    className="w-32 h-20 object-cover rounded-lg"
                  />
                )}

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{promotion.title}</h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {promotion.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{new Date(promotion.start_date).toLocaleDateString('vi-VN')} - {new Date(promotion.end_date).toLocaleDateString('vi-VN')}</span>
                        {promotion.discount_percent && (
                          <span className="text-orange-600 font-medium">-{promotion.discount_percent}%</span>
                        )}
                        {promotion.discount_amount && (
                          <span className="text-orange-600 font-medium">-{promotion.discount_amount.toLocaleString()}đ</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {promotion.is_active && (
                        <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
                          Đang chạy
                        </span>
                      )}
                      {promotion.featured && (
                        <span className="px-2 py-1 text-xs font-medium text-orange-700 bg-orange-100 rounded">
                          Nổi bật
                        </span>
                      )}
                      <button
                        onClick={() => startEdit(promotion)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(promotion.id)}
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
