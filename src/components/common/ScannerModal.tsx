import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import Tesseract from 'tesseract.js';
import {
    X,
    Maximize,
    Minimize,
    ZoomIn,
    ZoomOut,
    Type,
    ScanLine,
    Camera,
    Image as ImageIcon,
    Flashlight,
    RefreshCcw
} from "lucide-react";
import { showToast } from "../../utils/toast";

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (result: string) => void;
    title?: string;
}

type ScanMode = 'barcode' | 'ocr';

export const ScannerModal: React.FC<ScannerModalProps> = ({
    isOpen,
    onClose,
    onScan,
    title = "Smart Scanner",
}) => {
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<ScanMode>('barcode');
    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(3);
    const [isProcessing, setIsProcessing] = useState(false);
    const [flashOn, setFlashOn] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Camera
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1920 }, // Prefer Full HD
                    height: { ideal: 1080 },
                    focusMode: "continuous"
                }
            };
            // @ts-ignore
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }

            const track = stream.getVideoTracks()[0];
            trackRef.current = track;

            // Get capabilities for Zoom/Flash
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            // @ts-ignore - non-standard zoom property
            if (capabilities.zoom) {
                // @ts-ignore
                const z = capabilities.zoom;
                console.log("Zoom capabilities:", z);
                setMaxZoom(z.max || 3);
                // Also set initial zoom
                // @ts-ignore
                const settings = track.getSettings();
                // @ts-ignore
                if (settings.zoom) setZoom(settings.zoom);
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            setError("Cannot access camera. Please ensure permissions are granted.");
        }
    }, []);

    // Stop Camera
    const stopCamera = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
    }, []);

    // Handle Zoom
    const handleZoom = async (newZoom: number) => {
        setZoom(newZoom);
        if (trackRef.current) {
            try {
                // @ts-ignore
                await trackRef.current.applyConstraints({
                    advanced: [{ zoom: newZoom } as any]
                });
            } catch (e) {
                console.warn("Zoom constraint failed, retry with standard constraints:", e);
                // Fallback: try applying without "advanced" if browser supports it directly or different structure
                // But mostly, failure here means the device rejected the specific value or is busy.
            }
        }
    };

    // Handle Flash
    const toggleFlash = async () => {
        if (trackRef.current) {
            try {
                const newFlashState = !flashOn;
                // @ts-ignore
                await trackRef.current.applyConstraints({
                    advanced: [{ torch: newFlashState } as any]
                });
                setFlashOn(newFlashState);
            } catch (e) {
                showToast.error("Flash/Torch not supported on this device");
            }
        }
    };

    // --- BARCODE DETECTION (Native + Fallback) ---
    const scanBarcodeFrame = async () => {
        if (!videoRef.current || isProcessing) return;

        // 1. Try Native BarcodeDetector (Android/Chrome/iOS 17+)
        // @ts-ignore
        if (window.BarcodeDetector) {
            try {
                // @ts-ignore
                const barcodeDetector = new BarcodeDetector({
                    formats: [
                        "qr_code",
                        "ean_13", "ean_8",
                        "code_128", "code_39", "code_93",
                        "upc_a", "upc_e",
                        "itf", "codabar", "data_matrix"
                    ]
                });

                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    onResult(code);
                    return;
                }
            } catch (e) {
                // Fallback will run below
            }
        }

        // 2. Fallback to html5-qrcode (handled via separate dedicated running instance logic if desired, 
        // implies 'scanBarcodeFrame' is mostly for custom or native logic. 
        // For simplicity, we assume native is primary. If native fails, we rely on user manually triggering OCR 
        // or we could integrate html5-qrcode frame loop here.
        // Let's rely on Native for now, if not available, show warning or fallback.)
    };

    // --- OCR DETECTION (Tesseract) ---
    const captureAndOCR = async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;
        setIsProcessing(true);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // 1. Define Region of Interest (ROI) - Center 60% of frame
            // This matches the visual guide box in the UI
            const boxWidth = video.videoWidth * 0.8; // 80% width
            const boxHeight = video.videoWidth * 0.8 * (2 / 3); // Aspect ratio 3:2

            const startX = (video.videoWidth - boxWidth) / 2;
            const startY = (video.videoHeight - boxHeight) / 2;

            // UPSCALE for better OCR (Critical for small text)
            const scale = 2; // 2x upscale
            canvas.width = boxWidth * scale;
            canvas.height = boxHeight * scale;

            // 2. Crop Image to ROI & Scale Up
            ctx?.drawImage(
                video,
                startX, startY, boxWidth, boxHeight, // Source
                0, 0, canvas.width, canvas.height // Destination (Scaled)
            );

            // 3. Image Pre-processing (Grayscale + Contrast Boost)
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    // Grayscale (Luminosity method)
                    let gray = 0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2];

                    // Simple Contrast stretch (instead of fragile binary threshold)
                    // Push darks down, lights up
                    gray = (gray - 128) * 1.5 + 128;
                    if (gray < 0) gray = 0;
                    if (gray > 255) gray = 255;

                    data[i] = gray;     // R
                    data[i + 1] = gray; // G
                    data[i + 2] = gray; // B
                }
                ctx?.putImageData(imageData, 0, 0);
            }

            // 4. Run Tesseract with Whitelist
            const dataUrl = canvas.toDataURL('image/jpeg', 1.0); // High quality
            const { data: { text } } = await Tesseract.recognize(
                dataUrl,
                'eng',
                {
                    logger: m => {
                        // Optional: progress logging
                    }
                }
            );

            // Parse result for IMEI/Serial patterns
            // Allow alphanumeric + common separators, but filter garbage
            const cleanText = text.toUpperCase().replace(/[^A-Z0-9\n\-\.]/g, " ");
            console.log("OCR Result:", cleanText);

            // Regex for IMEI (15 digits) or general long alphanumeric sequences
            const imeiMatch = cleanText.match(/\b\d{15}\b/);

            // S/N regex: Expanded based on user images (S/N, P/N, Model, etc.)
            // Matches: "S/N: ...", "Serial No.: ...", "P/N: ...", "Model: ..." 
            const snMatch = cleanText.match(/(?:S\/N|SN|SERIAL|NO\.|P\/N|PN|PART|MODEL)[^A-Z0-9]*([A-Z0-9\-\.]{5,})/i);

            // Fallback: look for any long alphanumeric string (e.g. 10+ chars) that looks like a serial
            // Exclude common words to reduce noise
            const rawSerialMatch = cleanText.match(/\b(?!(?:TYPE|MODEL|INPUT|OUTPUT|MADE|CHINA|VIETNAM|NGUON|SOURCE))[A-Z0-9\-\.]{8,20}\b/i);

            if (imeiMatch) {
                onResult(imeiMatch[0]);
            } else if (snMatch && snMatch[1]) {
                onResult(snMatch[1]);
            } else if (rawSerialMatch) {
                // Heuristic: If it has both numbers and letters, it's likely a serial
                const val = rawSerialMatch[0];
                if (/\d/.test(val) && /[A-Z]/.test(val)) {
                    onResult(val.toUpperCase());
                } else if (/^\d{8,}$/.test(val)) {
                    // Just numbers, could be SN
                    onResult(val);
                } else {
                    showToast.info("Chưa rõ số serial (" + val + "). Xin thử lại.");
                }
            } else {
                showToast.info("Không nhận diện được mã. Hãy giữ chắc tay.");
            }

        } catch (err) {
            console.error(err);
            showToast.error("Lỗi nhận diện. Vui lòng thử lại.");
        } finally {
            setIsProcessing(false);
        }
    };

    const onResult = (result: string) => {
        if (navigator.vibrate) navigator.vibrate(200);
        onScan(result);
        onClose();
    };

    // Start scanning loop
    useEffect(() => {
        if (isOpen) {
            startCamera();
            if (mode === 'barcode') {
                intervalRef.current = setInterval(scanBarcodeFrame, 200);
            }
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, mode, startCamera]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur absolute top-0 left-0 right-0 z-10">
                <button onClick={toggleFlash} className="p-2 rounded-full bg-white/10">
                    <Flashlight className={`w-5 h-5 ${flashOn ? 'text-yellow-400' : 'text-white'}`} />
                </button>
                <div className="bg-black/60 px-4 py-1 rounded-full text-sm font-bold">
                    {mode === 'barcode' ? 'BARCODE / QR' : 'SCAN TEXT (OCR)'}
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-white/10">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Viewport */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                />

                {/* Visual Guide Box */}
                <div className="relative z-10 w-[80%] aspect-[3/2] border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -ml-1 -mt-1" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mr-1 -mt-1" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -ml-1 -mb-1" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mr-1 -mb-1" />

                    {isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                            <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    )}
                </div>

                {/* Zoom Controls Overlay */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4 bg-black/40 p-2 rounded-full backdrop-blur">
                    <button onClick={() => handleZoom(Math.min(maxZoom, zoom + 0.5))} className="p-2">
                        <ZoomIn className="w-6 h-6" />
                    </button>
                    <div className="text-xs font-bold text-center">{zoom}x</div>
                    <button onClick={() => handleZoom(Math.max(1, zoom - 0.5))} className="p-2">
                        <ZoomOut className="w-6 h-6" />
                    </button>
                </div>

                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Footer Control */}
            <div className="bg-black p-6 flex flex-col gap-4 pb-10">
                {/* Mode Switcher */}
                <div className="flex bg-white/10 p-1 rounded-xl self-center">
                    <button
                        onClick={() => setMode('barcode')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'barcode' ? 'bg-blue-600 shadow-lg' : 'text-slate-400'}`}
                    >
                        <ScanLine className="w-4 h-4" /> Barcode
                    </button>
                    <button
                        onClick={() => setMode('ocr')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'ocr' ? 'bg-purple-600 shadow-lg' : 'text-slate-400'}`}
                    >
                        <Type className="w-4 h-4" /> Scan Text
                    </button>
                </div>

                {/* Capture Button (Only for OCR or difficult manual capture) */}
                <div className="flex items-center justify-center gap-8 mt-2">
                    {mode === 'ocr' ? (
                        <button
                            onClick={captureAndOCR}
                            disabled={isProcessing}
                            className="w-16 h-16 rounded-full bg-white border-4 border-purple-500 flex items-center justify-center active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                        >
                            <Camera className="w-8 h-8 text-black" />
                        </button>
                    ) : (
                        <div className="text-center text-slate-400 text-sm">
                            Point camera at barcode<br />to scan automatically
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScannerModal;
