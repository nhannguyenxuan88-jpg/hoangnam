import React from 'react';
import { Share2, Printer, X } from 'lucide-react';
import { formatCurrency, formatWorkOrderId } from '../../../utils/format';
import { showToast } from '../../../utils/toast';
import type { WorkOrder, WorkOrderPart } from '../../../types';

interface StoreSettings {
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
    work_order_prefix?: string;
}

interface PrintOrderPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    printOrder: WorkOrder | null;
    storeSettings?: StoreSettings;
    onPrint: () => void;
}

const PrintOrderPreviewModal: React.FC<PrintOrderPreviewModalProps> = ({
    isOpen,
    onClose,
    printOrder,
    storeSettings,
    onPrint,
}) => {
    if (!isOpen || !printOrder) return null;

    const handleShare = async () => {
        try {
            showToast.info("Đang tạo hình ảnh...");

            // Import html2canvas dynamically
            const html2canvas = (await import("html2canvas")).default;

            const element = document.getElementById("mobile-print-preview-content");
            if (!element) {
                showToast.error("Không tìm thấy nội dung phiếu!");
                return;
            }

            // Capture the element as canvas
            const canvas = await html2canvas(element, {
                scale: 2, // Higher quality
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,
            });

            // Convert canvas to blob
            const blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
            });

            const fileName = `Phieu_${formatWorkOrderId(
                printOrder.id,
                storeSettings?.work_order_prefix
            )}.png`;

            // Try to share as image file
            if (navigator.share && navigator.canShare) {
                const file = new File([blob], fileName, {
                    type: "image/png",
                });
                const shareData = {
                    files: [file],
                    title: `Phiếu sửa chữa - ${formatWorkOrderId(
                        printOrder.id,
                        storeSettings?.work_order_prefix
                    )}`,
                };

                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    showToast.success("Chia sẻ thành công!");
                } else {
                    // Fallback: download
                    downloadImage(blob, fileName);
                }
            } else {
                // Fallback: download
                downloadImage(blob, fileName);
            }
        } catch (err) {
            console.error("Share failed:", err);
            showToast.error("Không thể chia sẻ. Vui lòng thử lại!");
        }
    };

    const downloadImage = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        showToast.success("Đã tải hình ảnh!");
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-full max-h-[95vh] flex flex-col">
                {/* Modal Header */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between rounded-t-xl flex-shrink-0">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Xem trước phiếu
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                        >
                            <Share2 className="w-4 h-4" />
                            Chia sẻ
                        </button>
                        <button
                            onClick={onPrint}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                        >
                            <Printer className="w-4 h-4" />
                            In
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
                            aria-label="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Print Preview Content - Mobile optimized */}
                <div className="flex-1 overflow-y-auto p-3 bg-slate-100 dark:bg-slate-900">
                    <div
                        id="mobile-print-preview-content"
                        className="bg-white shadow-lg mx-auto"
                        style={{ maxWidth: "100%", color: "#000", padding: "4mm" }}
                    >
                        {/* Store Info Header with Logo */}
                        <div
                            style={{
                                display: "flex",
                                gap: "3mm",
                                marginBottom: "3mm",
                                borderBottom: "2px solid #3b82f6",
                                paddingBottom: "2mm",
                                alignItems: "flex-start",
                            }}
                        >
                            {/* Logo */}
                            {storeSettings?.logo_url && (
                                <div style={{ flexShrink: 0 }}>
                                    <img
                                        src={storeSettings.logo_url}
                                        alt="Logo"
                                        style={{
                                            height: "15mm",
                                            width: "auto",
                                            objectFit: "contain",
                                        }}
                                    />
                                </div>
                            )}
                            {/* Store Info */}
                            <div style={{ flex: 1, fontSize: "9pt" }}>
                                <div
                                    style={{
                                        fontWeight: "bold",
                                        fontSize: "12pt",
                                        color: "#1e40af",
                                        marginBottom: "1mm",
                                    }}
                                >
                                    {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                                </div>
                                <div
                                    style={{
                                        color: "#000",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "1mm",
                                    }}
                                >
                                    {/* Address Icon */}
                                    <svg
                                        style={{ width: "10px", height: "10px", flexShrink: 0 }}
                                        viewBox="0 0 24 24"
                                        fill="#ef4444"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                    </svg>
                                    <span>
                                        {storeSettings?.address ||
                                            "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                                    </span>
                                </div>
                                <div
                                    style={{
                                        color: "#000",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "1mm",
                                    }}
                                >
                                    {/* Phone Icon */}
                                    <svg
                                        style={{ width: "10px", height: "10px", flexShrink: 0 }}
                                        viewBox="0 0 24 24"
                                        fill="#16a34a"
                                    >
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                    <span>{storeSettings?.phone || "0947.747.907"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Title */}
                        <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                            <h1
                                style={{
                                    fontSize: "14pt",
                                    fontWeight: "bold",
                                    margin: "0",
                                    color: "#1e40af",
                                }}
                            >
                                PHIẾU DỊCH VỤ SỬA CHỮA
                            </h1>
                            <div
                                style={{
                                    fontSize: "9pt",
                                    color: "#666",
                                    marginTop: "1mm",
                                }}
                            >
                                Mã:{" "}
                                {formatWorkOrderId(
                                    printOrder.id,
                                    storeSettings?.work_order_prefix
                                )}
                            </div>
                            <div style={{ fontSize: "8pt", color: "#666" }}>
                                {new Date(printOrder.creationDate).toLocaleString("vi-VN")}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div
                            style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                marginBottom: "2mm",
                                borderRadius: "2mm",
                                backgroundColor: "#f8fafc",
                                fontSize: "9pt",
                            }}
                        >
                            <div>
                                <strong>Khách hàng:</strong> {printOrder.customerName} -{" "}
                                {printOrder.customerPhone}
                            </div>
                            <div>
                                <strong>Xe:</strong> {printOrder.vehicleModel} -{" "}
                                <span style={{ color: "#3b82f6" }}>
                                    {printOrder.licensePlate}
                                </span>
                            </div>
                        </div>

                        {/* Issue Description */}
                        {printOrder.issueDescription && (
                            <div
                                style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    marginBottom: "2mm",
                                    borderRadius: "2mm",
                                    fontSize: "9pt",
                                }}
                            >
                                <strong>Mô tả sự cố:</strong> {printOrder.issueDescription}
                            </div>
                        )}

                        {/* Parts Table */}
                        {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                            <div style={{ marginBottom: "2mm" }}>
                                <p
                                    style={{
                                        fontWeight: "bold",
                                        margin: "0 0 1mm 0",
                                        fontSize: "10pt",
                                    }}
                                >
                                    Phụ tùng:
                                </p>
                                <table
                                    style={{
                                        width: "100%",
                                        borderCollapse: "collapse",
                                        border: "1px solid #ddd",
                                        fontSize: "9pt",
                                    }}
                                >
                                    <thead>
                                        <tr style={{ backgroundColor: "#f5f5f5" }}>
                                            <th
                                                style={{
                                                    border: "1px solid #ddd",
                                                    padding: "1.5mm",
                                                    textAlign: "left",
                                                }}
                                            >
                                                Tên
                                            </th>
                                            <th
                                                style={{
                                                    border: "1px solid #ddd",
                                                    padding: "1.5mm",
                                                    textAlign: "center",
                                                    width: "12%",
                                                }}
                                            >
                                                SL
                                            </th>
                                            <th
                                                style={{
                                                    border: "1px solid #ddd",
                                                    padding: "1.5mm",
                                                    textAlign: "right",
                                                    width: "28%",
                                                }}
                                            >
                                                Thành tiền
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {printOrder.partsUsed.map(
                                            (part: WorkOrderPart, idx: number) => (
                                                <tr key={idx}>
                                                    <td
                                                        style={{
                                                            border: "1px solid #ddd",
                                                            padding: "1.5mm",
                                                        }}
                                                    >
                                                        {part.partName}
                                                    </td>
                                                    <td
                                                        style={{
                                                            border: "1px solid #ddd",
                                                            padding: "1.5mm",
                                                            textAlign: "center",
                                                        }}
                                                    >
                                                        {part.quantity}
                                                    </td>
                                                    <td
                                                        style={{
                                                            border: "1px solid #ddd",
                                                            padding: "1.5mm",
                                                            textAlign: "right",
                                                            fontWeight: "bold",
                                                        }}
                                                    >
                                                        {formatCurrency(part.price * part.quantity)}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Additional Services */}
                        {printOrder.additionalServices &&
                            printOrder.additionalServices.length > 0 && (
                                <div style={{ marginBottom: "2mm", fontSize: "9pt" }}>
                                    <p
                                        style={{
                                            fontWeight: "bold",
                                            margin: "0 0 1mm 0",
                                            fontSize: "10pt",
                                        }}
                                    >
                                        Dịch vụ bổ sung:
                                    </p>
                                    <table
                                        style={{
                                            width: "100%",
                                            borderCollapse: "collapse",
                                            border: "1px solid #ddd",
                                            fontSize: "9pt",
                                        }}
                                    >
                                        <thead>
                                            <tr style={{ backgroundColor: "#f5f5f5" }}>
                                                <th style={{ border: "1px solid #ddd", padding: "1.5mm", textAlign: "left" }}>Tên dịch vụ</th>
                                                <th style={{ border: "1px solid #ddd", padding: "1.5mm", textAlign: "center", width: "12%" }}>SL</th>
                                                <th style={{ border: "1px solid #ddd", padding: "1.5mm", textAlign: "right", width: "28%" }}>Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {printOrder.additionalServices.map((service: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td style={{ border: "1px solid #ddd", padding: "1.5mm" }}>
                                                        {service.description}
                                                    </td>
                                                    <td style={{ border: "1px solid #ddd", padding: "1.5mm", textAlign: "center" }}>
                                                        {service.quantity || 1}
                                                    </td>
                                                    <td style={{ border: "1px solid #ddd", padding: "1.5mm", textAlign: "right", fontWeight: "bold" }}>
                                                        {formatCurrency(service.price * (service.quantity || 1))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        {/* Cost Summary - Only show items != 0 */}
                        <div
                            style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                borderRadius: "2mm",
                                backgroundColor: "#f9f9f9",
                                fontSize: "9pt",
                            }}
                        >
                            {/* Tiền phụ tùng - chỉ hiển thị khi != 0 */}
                            {(() => {
                                const partsTotal = printOrder.partsUsed?.reduce(
                                    (sum: number, p: WorkOrderPart) => sum + p.price * p.quantity,
                                    0
                                ) || 0;
                                return partsTotal !== 0 && (
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: "1mm",
                                        }}
                                    >
                                        <span>Tiền phụ tùng:</span>
                                        <span>{formatCurrency(partsTotal)}</span>
                                    </div>
                                );
                            })()}

                            {/* Phí dịch vụ (laborCost) - chỉ hiển thị khi != 0 */}
                            {(printOrder.laborCost ?? 0) !== 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "1mm",
                                    }}
                                >
                                    <span>Phí dịch vụ:</span>
                                    <span>{formatCurrency(printOrder.laborCost || 0)}</span>
                                </div>
                            )}

                            {/* Giá công/Đặt hàng - chỉ hiển thị khi có dịch vụ bổ sung và tổng != 0 */}
                            {(() => {
                                const additionalTotal = printOrder.additionalServices?.reduce(
                                    (sum: number, s: any) => sum + (s.price || 0) * (s.quantity || 1),
                                    0
                                ) || 0;
                                return additionalTotal !== 0 && (
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            marginBottom: "1mm",
                                        }}
                                    >
                                        <span>Giá công/Đặt hàng:</span>
                                        <span>{formatCurrency(additionalTotal)}</span>
                                    </div>
                                );
                            })()}
                            {printOrder.discount != null && printOrder.discount > 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "1mm",
                                        color: "#e74c3c",
                                    }}
                                >
                                    <span>Giảm giá:</span>
                                    <span>-{formatCurrency(printOrder.discount)}</span>
                                </div>
                            )}
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    paddingTop: "2mm",
                                    borderTop: "2px solid #3b82f6",
                                    fontSize: "12pt",
                                    fontWeight: "bold",
                                    color: "#1e40af",
                                }}
                            >
                                <span>TỔNG CỘNG:</span>
                                <span>{formatCurrency(printOrder.total || 0)}</span>
                            </div>
                            {printOrder.depositAmount != null &&
                                printOrder.depositAmount > 0 && (
                                    <>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginTop: "1mm",
                                                color: "#16a34a",
                                            }}
                                        >
                                            <span>Đã đặt cọc:</span>
                                            <span>{formatCurrency(printOrder.depositAmount)}</span>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                fontWeight: "bold",
                                                color: "#dc2626",
                                            }}
                                        >
                                            <span>Còn lại:</span>
                                            <span>
                                                {formatCurrency(
                                                    printOrder.remainingAmount ||
                                                    printOrder.total - printOrder.depositAmount
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )}
                        </div>

                        {/* Bank Info Section */}
                        {storeSettings?.bank_name && (
                            <div
                                style={{
                                    marginTop: "3mm",
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    borderRadius: "2mm",
                                    backgroundColor: "#f0f9ff",
                                    fontSize: "9pt",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "3mm",
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                fontWeight: "bold",
                                                marginBottom: "1mm",
                                                color: "#1e40af",
                                            }}
                                        >
                                            🏦 Thông tin thanh toán
                                        </div>
                                        <div style={{ color: "#000" }}>
                                            Ngân hàng: {storeSettings.bank_name}
                                        </div>
                                        {storeSettings.bank_account_number && (
                                            <div style={{ color: "#000" }}>
                                                STK: <strong>{storeSettings.bank_account_number}</strong>
                                            </div>
                                        )}
                                        {storeSettings.bank_account_holder && (
                                            <div style={{ color: "#000" }}>
                                                Chủ TK: {storeSettings.bank_account_holder}
                                            </div>
                                        )}
                                    </div>
                                    {/* QR Code */}
                                    {storeSettings.bank_qr_url && (
                                        <div style={{ flexShrink: 0 }}>
                                            <img
                                                src={storeSettings.bank_qr_url}
                                                alt="QR Banking"
                                                style={{
                                                    height: "25mm",
                                                    width: "25mm",
                                                    objectFit: "contain",
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Footer Note */}
                        <div
                            style={{
                                marginTop: "3mm",
                                padding: "2mm",
                                backgroundColor: "#fff9e6",
                                border: "1px solid #ffd700",
                                borderRadius: "2mm",
                                fontSize: "8pt",
                                textAlign: "center",
                            }}
                        >
                            <p style={{ margin: "0", fontStyle: "italic" }}>
                                Cảm ơn quý khách đã sử dụng dịch vụ!
                            </p>
                            <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
                                Vui lòng giữ phiếu này để đối chiếu khi nhận xe
                            </p>
                        </div>

                        {/* KTV Info */}
                        <div
                            style={{
                                marginTop: "2mm",
                                fontSize: "9pt",
                                textAlign: "right",
                                color: "#666",
                            }}
                        >
                            KTV: {printOrder.technicianName || "Chưa phân công"}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintOrderPreviewModal;
