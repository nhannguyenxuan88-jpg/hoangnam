import { useState, useEffect } from "react";
// Dùng supabaseClient thống nhất để tránh nhiều phiên GoTrue
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { safeAudit } from "../../lib/repository/auditLogsRepository";
import LoadingSpinner from "../common/LoadingSpinner";
import {
  Lock,
  Settings as SettingsIcon,
  Save,
  Info,
  Store,
  Palette,
  Landmark,
  FileText,
  Upload,
  Image as ImageIcon,
} from "lucide-react";

interface StoreSettings {
  id: string;
  store_name: string;
  store_name_en?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_code?: string;
  logo_url?: string;
  bank_qr_url?: string;
  primary_color?: string;
  business_hours?: string;
  established_year?: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  invoice_prefix?: string;
  receipt_prefix?: string;
  work_order_prefix?: string;
  invoice_footer_note?: string;
  currency?: string;
  date_format?: string;
  timezone?: string;
}

export const SettingsManager = () => {
  const { profile, hasRole } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "branding" | "banking" | "invoice"
  >("general");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
      showToast.error("Không thể tải cài đặt");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const previous = { ...settings };

      console.log("Saving settings:", settings);

      // Update settings
      const { error, data } = await supabase
        .from("store_settings")
        .update(settings)
        .eq("id", settings.id)
        .select();

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      console.log("Update result:", data);

      // Reload settings after save to confirm changes
      await loadSettings();

      showToast.success("Đã lưu cài đặt thành công!");
      void safeAudit(profile?.id || null, {
        action: "settings.update",
        tableName: "store_settings",
        recordId: settings.id,
        oldData: previous,
        newData: settings,
      });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      showToast.error(error.message || "Không thể lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof StoreSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showToast.error("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `store-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      updateField("logo_url", data.publicUrl);
      showToast.success("Đã tải logo lên thành công!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      showToast.error(error.message || "Không thể tải logo lên");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast.error("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    setUploadingQR(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `bank-qr-${Date.now()}.${fileExt}`;
      const filePath = `store-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      updateField("bank_qr_url", data.publicUrl);
      showToast.success("Đã tải mã QR ngân hàng lên thành công!");
    } catch (error: any) {
      console.error("Error uploading QR:", error);
      showToast.error(error.message || "Không thể tải mã QR lên");
    } finally {
      setUploadingQR(false);
    }
  };

  // Check permissions
  if (!hasRole(["owner", "manager"])) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Lock className="w-5 h-5" aria-hidden="true" />
          <p className="text-lg">
            Chỉ chủ cửa hàng và quản lý mới có quyền truy cập cài đặt
          </p>
        </div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isOwner = hasRole(["owner"]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <SettingsIcon
              className="w-6 h-6 md:w-7 md:h-7 text-blue-600"
              aria-hidden="true"
            />
            <span>Cài đặt hệ thống</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Quản lý thông tin cửa hàng và cấu hình hệ thống
          </p>
        </div>
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm md:text-base font-semibold transition-colors inline-flex items-center justify-center gap-2"
            aria-label="Lưu thay đổi"
          >
            {saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 md:p-4 flex items-start gap-2">
          <Info
            className="w-4 h-4 md:w-5 md:h-5 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200">
            Bạn chỉ có quyền xem. Chỉ chủ cửa hàng mới có thể chỉnh sửa cài đặt.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-2 md:gap-4 overflow-x-auto pb-px">
          {[
            {
              id: "general",
              label: "Thông tin chung",
              shortLabel: "Thông tin",
              icon: (
                <Store
                  className="w-3.5 h-3.5 md:w-4 md:h-4"
                  aria-hidden="true"
                />
              ),
            },
            {
              id: "branding",
              label: "Thương hiệu",
              shortLabel: "Thương hiệu",
              icon: (
                <Palette
                  className="w-3.5 h-3.5 md:w-4 md:h-4"
                  aria-hidden="true"
                />
              ),
            },
            {
              id: "banking",
              label: "Ngân hàng",
              shortLabel: "Ngân hàng",
              icon: (
                <Landmark
                  className="w-3.5 h-3.5 md:w-4 md:h-4"
                  aria-hidden="true"
                />
              ),
            },
            {
              id: "invoice",
              label: "Hóa đơn",
              shortLabel: "Hóa đơn",
              icon: (
                <FileText
                  className="w-3.5 h-3.5 md:w-4 md:h-4"
                  aria-hidden="true"
                />
              ),
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-2.5 py-2 md:px-4 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5 md:gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="inline sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 md:p-6">
        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thông tin cửa hàng
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên cửa hàng *
                </label>
                <input
                  type="text"
                  value={settings.store_name || ""}
                  onChange={(e) => updateField("store_name", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên tiếng Anh
                </label>
                <input
                  type="text"
                  value={settings.store_name_en || ""}
                  onChange={(e) => updateField("store_name_en", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Slogan
                </label>
                <input
                  type="text"
                  value={settings.slogan || ""}
                  onChange={(e) => updateField("slogan", e.target.value)}
                  disabled={!isOwner}
                  placeholder="Chăm sóc xe máy chuyên nghiệp"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) => updateField("address", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={settings.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={settings.website || ""}
                  onChange={(e) => updateField("website", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã số thuế
                </label>
                <input
                  type="text"
                  value={settings.tax_code || ""}
                  onChange={(e) => updateField("tax_code", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Giờ mở cửa
                </label>
                <input
                  type="text"
                  value={settings.business_hours || ""}
                  onChange={(e) =>
                    updateField("business_hours", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="8:00 - 18:00 (T2-T7)"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Năm thành lập
                </label>
                <input
                  type="number"
                  value={settings.established_year || ""}
                  onChange={(e) =>
                    updateField("established_year", Number(e.target.value))
                  }
                  disabled={!isOwner}
                  placeholder="2020"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === "branding" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thương hiệu & Hình ảnh
            </h2>

            {/* Logo Upload */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Logo cửa hàng
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label
                      className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${
                        isOwner
                          ? "cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <Upload className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                      <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                        {uploadingLogo ? "Đang tải lên..." : "Chọn ảnh logo"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={!isOwner || uploadingLogo}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Kích thước tối đa: 2MB. Định dạng: JPG, PNG, SVG
                    </p>
                  </div>
                  {settings.logo_url && (
                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center">
                      <img
                        src={settings.logo_url}
                        alt="Store Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Hoặc nhập URL Logo
                </label>
                <input
                  type="url"
                  value={settings.logo_url || ""}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* QR Code Upload */}
            <div className="space-y-4 pt-4 md:pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã QR ngân hàng
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label
                      className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${
                        isOwner
                          ? "cursor-pointer"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                      <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                        {uploadingQR ? "Đang tải lên..." : "Chọn ảnh QR Code"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQRUpload}
                        disabled={!isOwner || uploadingQR}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Kích thước tối đa: 2MB. Định dạng: JPG, PNG
                    </p>
                  </div>
                  {settings.bank_qr_url && (
                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center">
                      <img
                        src={settings.bank_qr_url}
                        alt="Bank QR Code"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Hoặc nhập URL mã QR
                </label>
                <input
                  type="url"
                  value={settings.bank_qr_url || ""}
                  onChange={(e) => updateField("bank_qr_url", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* Color Theme */}
            <div className="pt-4 md:pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Màu chủ đạo
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primary_color || "#3B82F6"}
                    onChange={(e) =>
                      updateField("primary_color", e.target.value)
                    }
                    disabled={!isOwner}
                    className="w-12 h-10 md:w-16 md:h-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={settings.primary_color || "#3B82F6"}
                    onChange={(e) =>
                      updateField("primary_color", e.target.value)
                    }
                    disabled={!isOwner}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Màu này sẽ được sử dụng trong giao diện hệ thống
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banking Tab */}
        {activeTab === "banking" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thông tin ngân hàng
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên ngân hàng *
                </label>
                <input
                  type="text"
                  value={settings.bank_name || ""}
                  onChange={(e) => updateField("bank_name", e.target.value)}
                  disabled={!isOwner}
                  placeholder="VD: Vietcombank, Techcombank, MB Bank..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Số tài khoản *
                </label>
                <input
                  type="text"
                  value={settings.bank_account_number || ""}
                  onChange={(e) =>
                    updateField("bank_account_number", e.target.value)
                  }
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Chủ tài khoản *
                </label>
                <input
                  type="text"
                  value={settings.bank_account_holder || ""}
                  onChange={(e) =>
                    updateField("bank_account_holder", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Chi nhánh
                </label>
                <input
                  type="text"
                  value={settings.bank_branch || ""}
                  onChange={(e) => updateField("bank_branch", e.target.value)}
                  disabled={!isOwner}
                  placeholder="VD: Chi nhánh Quận 1, TP.HCM"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4">
              <div className="flex gap-2 md:gap-3">
                <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Thông tin ngân hàng</p>
                  <p>
                    Thông tin này sẽ được hiển thị trên các hóa đơn, biên nhận
                    và phiếu dịch vụ. Khách hàng có thể quét mã QR hoặc chuyển
                    khoản theo thông tin này.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === "invoice" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Cấu hình hóa đơn
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã hóa đơn bán
                </label>
                <input
                  type="text"
                  value={settings.invoice_prefix || "HD"}
                  onChange={(e) =>
                    updateField("invoice_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="HD"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: HD-001, HD-002
                </p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã phiếu nhập
                </label>
                <input
                  type="text"
                  value={settings.receipt_prefix || "PN"}
                  onChange={(e) =>
                    updateField("receipt_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="PN"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: PN-001, PN-002
                </p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã phiếu sửa chữa
                </label>
                <input
                  type="text"
                  value={settings.work_order_prefix || "SC"}
                  onChange={(e) =>
                    updateField("work_order_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="SC"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: SC-001, SC-002
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Ghi chú cuối hóa đơn
              </label>
              <textarea
                rows={3}
                value={settings.invoice_footer_note || ""}
                onChange={(e) =>
                  updateField("invoice_footer_note", e.target.value)
                }
                disabled={!isOwner}
                placeholder="Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ!"
                className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Định dạng ngày
                </label>
                <select
                  value={settings.date_format || "DD/MM/YYYY"}
                  onChange={(e) => updateField("date_format", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Đơn vị tiền tệ
                </label>
                <select
                  value={settings.currency || "VND"}
                  onChange={(e) => updateField("currency", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="VND">VND - Việt Nam Đồng</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Múi giờ
                </label>
                <select
                  value={settings.timezone || "Asia/Ho_Chi_Minh"}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="Asia/Ho_Chi_Minh">Hồ Chí Minh (GMT+7)</option>
                  <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore">Singapore (GMT+8)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button (Bottom) */}
      {isOwner && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm md:text-base font-semibold transition-colors inline-flex items-center justify-center gap-2"
            aria-label="Lưu tất cả thay đổi"
          >
            {saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
                <span>Lưu tất cả thay đổi</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
