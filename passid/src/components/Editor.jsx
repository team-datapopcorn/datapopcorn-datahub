import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Download, RefreshCw, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import imglyRemoveBackground from "@imgly/background-removal";
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const FORMATS = [
    { id: 'passport', name: 'Passport', width: 35, height: 45, label: '3.5 x 4.5 cm' },
    { id: 'id_card', name: 'ID Card', width: 30, height: 40, label: '3 x 4 cm' },
    { id: 'driver', name: 'Driver License', width: 35, height: 45, label: '3.5 x 4.5 cm' },
    { id: 'resume', name: 'Resume', width: 30, height: 40, label: '3 x 4 cm' },
];

export default function Editor({ onBack }) {
    const [image, setImage] = useState(null);
    const [processedImage, setProcessedImage] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(FORMATS[0]);
    const [bgColor, setBgColor] = useState('#FFFFFF');

    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setImage(url);
            processImage(url);
        }
    };

    const processImage = async (imageUrl) => {
        setIsProcessing(true);
        setProcessedImage(null);
        try {
            // Configuration for imgly
            const config = {
                progress: (key, current, total) => {
                    console.log(`Processing: ${current}/${total}`);
                },
                debug: true,
                device: 'gpu' // Prefer GPU
            };

            const blob = await imglyRemoveBackground(imageUrl, config);
            const url = URL.createObjectURL(blob);
            setProcessedImage(url);
        } catch (error) {
            console.error("Background removal failed:", error);
            // Fallback: just show original if removal fails (for demo stability)
            setProcessedImage(imageUrl);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Editor Header */}
            <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 flex items-center gap-2"
                >
                    <X size={20} />
                    <span className="hidden sm:inline">Close Editor</span>
                </button>
                <div className="font-semibold text-lg">ID Photo Editor</div>
                <button
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
                    onClick={() => alert("Download feature would generate the final image here.")}
                    disabled={!processedImage}
                >
                    <Download size={18} />
                    <span className="hidden sm:inline">Download</span>
                </button>
            </header>

            <main className="flex-1 max-w-6xl mx-auto w-full p-4 lg:p-8 grid lg:grid-cols-[1fr_320px] gap-8">

                {/* Canvas Area */}
                <div className="bg-gray-200/50 rounded-2xl flex items-center justify-center p-8 border border-gray-200 overflow-hidden relative min-h-[500px]">
                    {!image ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="text-center cursor-pointer p-12 hover:bg-gray-200 transition-colors rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400"
                        >
                            <div className="bg-white p-4 rounded-full shadow-sm mx-auto mb-4 w-16 h-16 flex items-center justify-center">
                                <Upload size={32} className="text-blue-600" />
                            </div>
                            <h3 className="text-lg font-semibold mb-1">Upload a photo</h3>
                            <p className="text-gray-500 text-sm">JPG, PNG up to 10MB</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    ) : (
                        <div className="relative shadow-2xl" style={{
                            width: `${selectedFormat.width * 10}px`,
                            height: `${selectedFormat.height * 10}px`,
                            transition: 'width 0.3s, height 0.3s'
                        }}>
                            {/* This mimics the preview area with correct aspect ratio */}
                            <div
                                className="w-full h-full relative overflow-hidden"
                                style={{ backgroundColor: bgColor }}
                            >
                                {isProcessing && (
                                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                                        <p className="text-sm font-medium text-gray-600">Removing background...</p>
                                    </div>
                                )}

                                {processedImage && (
                                    <img
                                        src={processedImage}
                                        alt="Processed"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Controls */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit space-y-8">

                    {/* Format Selection */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Photo Format</h3>
                        <div className="space-y-3">
                            {FORMATS.map((fmt) => (
                                <button
                                    key={fmt.id}
                                    onClick={() => setSelectedFormat(fmt)}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                                        selectedFormat.id === fmt.id
                                            ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600/20"
                                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    <div>
                                        <div className="font-semibold text-sm">{fmt.name}</div>
                                        <div className="text-xs text-gray-500">{fmt.label}</div>
                                    </div>
                                    {selectedFormat.id === fmt.id && <Check size={16} className="text-blue-600" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Background Color */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">Background</h3>
                        <div className="grid grid-cols-5 gap-3">
                            {['#FFFFFF', '#4a90e2', '#d0021b', '#f8e71c', '#bd10e0', '#333333'].map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setBgColor(color)}
                                    className={cn(
                                        "w-8 h-8 rounded-full border border-gray-200 shadow-sm transition-transform hover:scale-110",
                                        bgColor === color && "ring-2 ring-offset-2 ring-gray-900"
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <button
                            onClick={() => { setImage(null); setProcessedImage(null); }}
                            className="w-full py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Start Over
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
