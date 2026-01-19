import React, { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, RefreshCw } from "lucide-react";

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (result: string) => void;
    title?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
    isOpen,
    onClose,
    onScan,
    title = "Quét mã vạch / QR",
}) => {
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Clear previous instance just in case
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }

            // Initialize scanner
            // Use logic to mount after a small delay to ensure DOM is ready
            const timer = setTimeout(() => {
                try {
                    const scanner = new Html5QrcodeScanner(
                        "reader",
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0,
                            formatsToSupport: [
                                Html5QrcodeSupportedFormats.QR_CODE,
                                Html5QrcodeSupportedFormats.CODE_128,
                                Html5QrcodeSupportedFormats.EAN_13,
                                Html5QrcodeSupportedFormats.CODE_39,
                            ],
                        },
            /* verbose= */ false
                    );

                    scanner.render(
                        (decodedText) => {
                            onScan(decodedText);
                            onClose(); // Close on success
                        },
                        (errorMessage) => {
                            // Ignore standard scanning errors
                            // console.log(errorMessage);
                        }
                    );
                    scannerRef.current = scanner;
                } catch (err) {
                    console.error("Failed to start scanner:", err);
                    setError("Không thể khởi động camera. Vui lòng cấp quyền truy cập.");
                }
            }, 100);

            return () => clearTimeout(timer);
        } else {
            // Cleanup
            if (scannerRef.current) {
                scannerRef.current.clear().catch(console.error);
                scannerRef.current = null;
            }
        }
    }, [isOpen, onScan, onClose]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch((error) => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
            }
        };
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Scanner Area */}
                <div className="p-4 bg-black">
                    {error ? (
                        <div className="text-red-500 text-center p-8 bg-white dark:bg-slate-900 rounded-xl">
                            <p className="mb-2">⚠️ {error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-sm font-medium mt-4"
                            >
                                Đóng
                            </button>
                        </div>
                    ) : (
                        <div
                            id="reader"
                            className="w-full h-auto overflow-hidden rounded-lg border-2 border-slate-500/50"
                        ></div>
                    )}
                    <p className="text-center text-white/70 text-sm mt-4">
                        Di chuyển camera để quét mã vạch hoặc QR code
                    </p>
                </div>
            </div>
        </div>
    );
};
