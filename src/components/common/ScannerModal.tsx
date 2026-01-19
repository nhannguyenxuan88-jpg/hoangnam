import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X } from "lucide-react";

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
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const mountedRef = useRef(false);

    useEffect(() => {
        mountedRef.current = true;

        if (isOpen) {
            const startScanner = async () => {
                try {
                    // Wait for DOM element to be ready
                    await new Promise((resolve) => setTimeout(resolve, 100));

                    if (!mountedRef.current) return;

                    // Cleanup existing instance if any
                    if (scannerRef.current) {
                        try {
                            await scannerRef.current.stop();
                            scannerRef.current.clear();
                        } catch (e) {
                            console.warn("Failed to stop previous scanner", e);
                        }
                    }

                    const html5QrCode = new Html5Qrcode("reader");
                    scannerRef.current = html5QrCode;

                    await html5QrCode.start(
                        { facingMode: "environment" }, // Use back camera by default
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
                        (decodedText) => {
                            if (mountedRef.current) {
                                onScan(decodedText);
                                onClose();
                            }
                        },
                        () => {
                            // Ignore frame parse errors
                        }
                    );
                } catch (err: any) {
                    console.error("Failed to start scanner:", err);
                    if (mountedRef.current) {
                        setError(
                            err?.message?.includes("Permission")
                                ? "Vui lòng cấp quyền truy cập camera để quét mã."
                                : "Không thể khởi động camera. Hãy thử lại."
                        );
                    }
                }
            };

            startScanner();
        }

        return () => {
            mountedRef.current = false;
            if (scannerRef.current) {
                scannerRef.current
                    .stop()
                    .catch((err) => console.warn("Failed to stop scanner on cleanup", err))
                    .finally(() => {
                        scannerRef.current?.clear();
                        scannerRef.current = null;
                    });
            }
        };
    }, [isOpen, onScan, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
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
                <div className="p-4 bg-black relative min-h-[300px] flex items-center justify-center">
                    {error ? (
                        <div className="text-white text-center p-4">
                            <p className="mb-4 text-red-400">⚠️ {error}</p>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    ) : (
                        <>
                            <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
                        </>
                    )}

                    {!error && (
                        <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
                            <p className="text-white/70 text-sm bg-black/50 inline-block px-3 py-1 rounded-full">
                                🔍 Đang mở camera...
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
