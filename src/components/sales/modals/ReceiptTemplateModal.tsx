import React, { useRef } from "react";
import { formatCurrency, formatDate } from "../../../utils/format";
import { Printer, Share2, Download } from "lucide-react";
import html2canvas from "html2canvas"; // Ensure this is installed or use an alternative if not

export interface StoreSettings {
    store_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    bank_qr_url?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_holder?: string;
    bank_branch?: string;
}

interface ReceiptTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    sale: any;
    storeSettings: StoreSettings | null;
    onPrint: (elementId: string) => void;
}

export const ReceiptTemplateModal: React.FC<ReceiptTemplateModalProps> = ({
    isOpen,
    onClose,
    sale,
    storeSettings,
    onPrint,
}) => {
    const invoicePreviewRef = useRef<HTMLDivElement>(null);

    if (!isOpen || !sale) return null;

    const handleShareInvoice = async () => {
        if (!invoicePreviewRef.current) return;
        try {
            // Note: This requires html2canvas to be available in the project
            // If not available, you might need to install it or skip this feature
            // For now, logging not implemented as we don't know if lib is present
            console.log("Sharing not fully implemented without html2canvas verification");
            alert("Chức năng chia sẻ hình ảnh đang được cập nhật");
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Printer className="w-5 h-5 text-blue-600" />
                        In Hóa Đơn
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Action Buttons */}
                        <button
                            onClick={() => onPrint("invoice-preview-content")}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors shadow-sm"
                        >
                            <Printer className="w-4 h-4" />
                            <span>In ngay</span>
                        </button>
                        <button
                            onClick={handleShareInvoice}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition-colors shadow-sm"
                        >
                            <Share2 className="w-4 h-4" />
                            <span>Chia sẻ ảnh</span>
                        </button>

                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2" />

                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-6 h-6"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Print Preview Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900 flex justify-center">
                    <div
                        id="invoice-preview-content"
                        ref={invoicePreviewRef}
                        className="bg-white shadow-lg"
                        style={{ width: "80mm", minHeight: "100mm", color: "#000", padding: "5mm" }}
                    >
                        {/* Store Info Header */}
                        <div
                            style={{
                                borderBottom: "2px solid #3b82f6",
                                paddingBottom: "2mm",
                                marginBottom: "3mm",
                                display: "flex",
                                alignItems: "center",
                                gap: "3mm",
                            }}
                        >
                            {/* Logo */}
                            {storeSettings?.logo_url && (
                                <img
                                    src={storeSettings.logo_url}
                                    alt="Logo"
                                    style={{
                                        height: "14mm",
                                        width: "14mm",
                                        objectFit: "contain",
                                        flexShrink: 0,
                                    }}
                                />
                            )}
                            {/* Info */}
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        fontSize: "11pt",
                                        fontWeight: "bold",
                                        textTransform: "uppercase",
                                        color: "#1e40af",
                                        marginBottom: "0.5mm",
                                    }}
                                >
                                    {storeSettings?.store_name || "CỬA HÀNG PHỤ TÙNG"}
                                </div>
                                <div style={{ fontSize: "8pt", marginBottom: "0.5mm" }}>
                                    {storeSettings?.address || "Địa chỉ cửa hàng..."}
                                </div>
                                <div style={{ fontSize: "8pt" }}>
                                    Tel: {storeSettings?.phone || "..."}
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                            <div
                                style={{
                                    fontSize: "14pt",
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                    marginBottom: "1mm",
                                }}
                            >
                                HÓA ĐƠN BÁN LẺ
                            </div>
                            <div style={{ fontSize: "9pt", fontWeight: "bold" }}>
                                #{sale.sale_code || sale.id.slice(0, 8)}
                            </div>
                            <div style={{ fontSize: "8pt", color: "#555" }}>
                                {formatDate(new Date(sale.date))} {new Date(sale.date).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div
                            style={{
                                borderBottom: "1px dashed #ccc",
                                paddingBottom: "2mm",
                                marginBottom: "3mm",
                                fontSize: "9pt",
                            }}
                        >
                            <div style={{ display: "flex", marginBottom: "1mm" }}>
                                <span style={{ width: "20mm", fontWeight: "bold" }}>Khách:</span>
                                <span>{sale.customer?.name || "Khách lẻ"}</span>
                            </div>
                            {sale.customer?.phone && (
                                <div style={{ display: "flex", marginBottom: "1mm" }}>
                                    <span style={{ width: "20mm", fontWeight: "bold" }}>SĐT:</span>
                                    <span>{sale.customer.phone}</span>
                                </div>
                            )}
                            {/* Check for vehicle info in newCustomer data if not on customer object directly */}
                            {(sale.customer?.vehicleModel || (sale as any).newCustomer?.vehicleModel) && (
                                <div style={{ display: "flex", marginBottom: "1mm" }}>
                                    <span style={{ width: "20mm", fontWeight: "bold" }}>Xe:</span>
                                    <span>
                                        {sale.customer.vehicleModel || (sale as any).newCustomer?.vehicleModel}{" "}
                                        {sale.customer.licensePlate || (sale as any).newCustomer?.licensePlate ? `- ${sale.customer.licensePlate || (sale as any).newCustomer?.licensePlate}` : ""}
                                    </span>
                                </div>
                            )}
                            <div style={{ display: "flex" }}>
                                <span style={{ width: "20mm", fontWeight: "bold" }}>NV:</span>
                                <span>{(sale as any).username || sale.userName || "N/A"}</span>
                            </div>
                        </div>

                        {/* Items Table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "3mm" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #000", fontSize: "8.5pt" }}>
                                    <th style={{ textAlign: "left", padding: "1mm 0" }}>Tên SP</th>
                                    <th style={{ textAlign: "center", width: "10mm", padding: "1mm 0" }}>SL</th>
                                    <th style={{ textAlign: "right", width: "22mm", padding: "1mm 0" }}>T.Tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((item: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px dashed #eee", fontSize: "8.5pt" }}>
                                        <td style={{ padding: "1.5mm 0" }}>
                                            <div style={{ fontWeight: "bold" }}>{item.partName}</div>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1.5mm 0", verticalAlign: "top" }}>
                                            {item.quantity}
                                        </td>
                                        <td style={{ textAlign: "right", padding: "1.5mm 0", fontWeight: "bold", verticalAlign: "top" }}>
                                            {formatCurrency(item.sellingPrice * item.quantity)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div
                            style={{
                                borderTop: "2px solid #333",
                                paddingTop: "2mm",
                                marginBottom: "3mm",
                                fontSize: "9pt",
                            }}
                        >
                            {sale.discount > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1mm", color: "#e74c3c" }}>
                                    <span>Giảm giá:</span>
                                    <span>-{formatCurrency(sale.discount)}</span>
                                </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "11pt" }}>
                                <span>TỔNG:</span>
                                <span>{formatCurrency(sale.total)}</span>
                            </div>
                            {/* Payment Method */}
                            <div style={{ fontSize: "8pt", textAlign: "right", marginTop: "1mm", fontStyle: "italic" }}>
                                ({sale.paymentMethod === "bank" ? "Chuyển khoản" : "Tiền mặt"})
                            </div>
                        </div>

                        {/* Bank Info */}
                        {storeSettings?.bank_name && (
                            <div
                                style={{
                                    marginTop: "2mm",
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    borderRadius: "2mm",
                                    backgroundColor: "#f0f9ff",
                                    fontSize: "7.5pt",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
                                    {/* QR Code - Left side */}
                                    {storeSettings.bank_qr_url && (
                                        <div style={{ flexShrink: 0 }}>
                                            <img
                                                src={storeSettings.bank_qr_url}
                                                alt="QR"
                                                style={{
                                                    width: "22mm",
                                                    height: "22mm",
                                                    display: "block",
                                                    border: "1px solid #fff",
                                                    borderRadius: "1mm"
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Bank Details - Right side */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: "bold", color: "#1e40af", marginBottom: "0.5mm" }}>
                                            Thông tin chuyển khoản:
                                        </div>
                                        <div>
                                            <span style={{ fontWeight: "bold" }}>{storeSettings.bank_name}</span>
                                        </div>
                                        <div style={{ fontWeight: "bold", color: "#2563eb", fontSize: "9pt" }}>
                                            {storeSettings.bank_account_number}
                                        </div>
                                        <div style={{ textTransform: "uppercase" }}>
                                            {storeSettings.bank_account_holder}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div style={{ textAlign: "center", fontSize: "7.5pt", color: "#666", marginTop: "4mm", borderTop: "1px dashed #ccc", paddingTop: "2mm" }}>
                            <div>Cảm ơn quý khách!</div>
                            <div>Hẹn gặp lại</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
