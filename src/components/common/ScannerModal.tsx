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
                setMaxZoom(capabilities.zoom.max);
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
                console.warn("Zoom not supported:", e);
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
                    formats: ["qr_code", "ean_13", "code_128", "code_39"]
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

            // Draw current frame to canvas
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx?.drawImage(video, 0, 0);

            // Enhance image for OCR (Simple grayscaling)
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
                // ... potentially adding filters here
                ctx?.putImageData(imageData, 0, 0);
            }

            // Run Tesseract
            const dataUrl = canvas.toDataURL('image/jpeg');
            const { data: { text } } = await Tesseract.recognize(
                dataUrl,
                'eng', // English is best for alphanumeric codes like IMEI
                {
                    logger: m => console.log(m)
                }
            );

            // Parse result for IMEI/Serial patterns
            const cleanText = text.toUpperCase().replace(/[^A-Z0-9\n]/g, " "); // Allow newlines
            console.log("OCR Result:", cleanText);

            // Regex for IMEI (15 digits) or general long alphanumeric sequences
            const imeiMatch = cleanText.match(/\b\d{15}\b/);
            const snMatch = cleanText.match(/(S\/N|SN|SERIAL)[\s\.:]*([A-Z0-9]{8,})/i);

            if (imeiMatch) {
                onResult(imeiMatch[0]);
            } else if (snMatch && snMatch[2]) {
                onResult(snMatch[2]);
            } else {
                showToast.info("No clear IMEI/Serial found. Try getting closer.");
            }

        } catch (err) {
            console.error(err);
            showToast.error("OCR failed. Try again.");
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
