/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
// Removed @google/genai import as we're switching to a third-party API
import { Upload, Image as ImageIcon, Sparkles, Loader2, Download, RefreshCw, AlertCircle, Ghost, Zap, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Third-party API configuration removed - moved to server for security and rate limiting

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingUsage, setRemainingUsage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Too big! Keep it under 5MB, buddy.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setGeneratedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateHeTui = async () => {
    if (!selectedImage) return;

    setIsGenerating(true);
    setError(null);

    try {
      const base64Data = selectedImage.split(',')[1];
      const mimeType = selectedImage.split(';')[0].split(':')[1];

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: mimeType
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `Error: ${response.status}`);
      }

      setGeneratedImage(data.imageUrl);
      setRemainingUsage(data.remaining);
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Something went wrong. Maybe too much spit?");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'hetui-meme.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setSelectedImage(null);
    setGeneratedImage(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FFD700] text-black font-body selection:bg-black selection:text-[#FFD700] overflow-x-hidden relative">
      {/* Main Content Wrapper with higher z-index */}
      <div className="relative z-10">
        {/* Quirky Marquee Header */}
        <div className="bg-black text-[#FFD700] py-2 overflow-hidden whitespace-nowrap border-b-4 border-black">
          <motion.div 
            animate={{ x: [0, -1000] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
            className="inline-block text-sm font-bold uppercase tracking-tighter"
          >
            HE-TUI GENERATOR • NO SPITTING IN PUBLIC • MEME YOUR FRIENDS • 100% ORGANIC SPIT • HE-TUI GENERATOR • NO SPITTING IN PUBLIC • MEME YOUR FRIENDS • 100% ORGANIC SPIT • HE-TUI GENERATOR • NO SPITTING IN PUBLIC • MEME YOUR FRIENDS • 100% ORGANIC SPIT • 
          </motion.div>
        </div>

        <header className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center">
          <motion.div 
            whileHover={{ rotate: [-2, 2, -2] }}
            className="flex items-center gap-3 bg-black text-white p-4 -rotate-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black"
          >
            <Flame className="text-orange-500 fill-orange-500" />
            <h1 className="text-3xl font-display uppercase tracking-tighter">HE-TUI LABS</h1>
          </motion.div>
          
          <button 
            onClick={reset}
            className="bg-white border-4 border-black p-3 font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
          >
            <RefreshCw size={18} /> RESET
          </button>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            
            {/* Left Column: Upload & Input */}
            <section className="space-y-10">
              <div className="space-y-6">
                <motion.h2 
                  initial={{ x: -50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="text-7xl font-display uppercase leading-[0.9] tracking-tighter"
                >
                  SPIT ON <br /> 
                  <span className="bg-black text-[#FFD700] px-2 inline-block rotate-1">EVERYTHING.</span>
                </motion.h2>
                <p className="text-xl font-bold opacity-80 max-w-md">
                  Upload a victim's photo and let the AI do the dirty work. 
                </p>
              </div>

              <motion.div 
                whileHover={{ scale: 1.02 }}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative group cursor-pointer overflow-hidden
                  aspect-square bg-white border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]
                  hover:shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] transition-all duration-300
                  flex flex-col items-center justify-center gap-4
                  ${selectedImage ? 'rotate-1' : '-rotate-1'}
                `}
              >
                {selectedImage ? (
                  <>
                    <img 
                      src={selectedImage} 
                      alt="Selected" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-[#FFD700] font-display text-4xl uppercase">Change Victim</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 bg-[#FFD700] border-4 border-black flex items-center justify-center group-hover:rotate-12 transition-transform">
                      <Upload size={40} strokeWidth={3} />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-2xl font-display uppercase">Drop the photo here</p>
                      <p className="font-bold opacity-50">JPG/PNG (Max 5MB)</p>
                    </div>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  accept="image/*"
                />
              </motion.div>

              <button
                onClick={generateHeTui}
                disabled={!selectedImage || isGenerating}
                className={`
                  w-full py-6 border-8 border-black font-display text-4xl uppercase tracking-tighter
                  flex items-center justify-center gap-4 transition-all
                  ${!selectedImage || isGenerating 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-black text-[#FFD700] hover:-translate-y-1 hover:shadow-[0px_10px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none'}
                `}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={32} />
                    SPITTING...
                  </>
                ) : (
                  <>
                    <Zap size={32} fill="currentColor" />
                    HE-TUI IT!
                  </>
                )}
              </button>

              {remainingUsage !== null && (
                <div className="text-center font-bold uppercase tracking-tighter text-sm">
                  剩余次数: <span className="bg-black text-[#FFD700] px-2">{remainingUsage}</span>
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-6 bg-red-500 text-white border-4 border-black font-bold flex items-center gap-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Ghost size={32} />
                  <p className="text-xl uppercase tracking-tight">{error}</p>
                </motion.div>
              )}
            </section>

            {/* Right Column: Result */}
            <section className="space-y-10 lg:pt-20">
              <div className="flex justify-between items-end">
                <h3 className="text-2xl font-display uppercase bg-black text-white px-4 py-1 rotate-2">The Masterpiece</h3>
                {generatedImage && (
                  <button 
                    onClick={downloadImage}
                    className="bg-white border-4 border-black px-4 py-2 font-bold hover:bg-black hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Download size={20} /> SAVE MEME
                  </button>
                )}
              </div>

              <div className="aspect-square bg-white border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex items-center justify-center relative rotate-1">
                <AnimatePresence mode="wait">
                  {generatedImage ? (
                    <motion.div
                      key="generated"
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="w-full h-full p-4"
                    >
                      <img
                        src={generatedImage}
                        alt="Generated He-Tui"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  ) : isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-6 text-center px-8"
                    >
                      <div className="relative">
                        <div className="w-32 h-32 border-8 border-black border-t-transparent rounded-full animate-spin" />
                        <Sparkles size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-black animate-pulse" />
                      </div>
                      <div>
                        <p className="text-3xl font-display uppercase">Cooking the spit...</p>
                        <p className="font-bold opacity-50 mt-2">Patience is a virtue, memeing is an art.</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center gap-6 text-center opacity-10 px-8"
                    >
                      <ImageIcon size={120} strokeWidth={1} />
                      <p className="text-4xl font-display uppercase">Empty Spittoon</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="bg-black text-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,215,0,1)] -rotate-1">
                <p className="text-sm font-display uppercase text-[#FFD700] mb-2 tracking-widest">Meme Wisdom</p>
                <p className="text-xl font-bold italic">
                  "A picture is worth a thousand words, but a He-Tui is worth a million laughs."
                </p>
              </div>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-block border-4 border-black p-4 bg-white font-bold uppercase tracking-tighter rotate-2">
            Made with pure chaos and Gemini 2.5 Flash
          </div>
        </footer>
      </div>

      {/* Decorative Floating Elements - Moved to front (z-50) for maximum visibility */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        <motion.div 
          animate={{ 
            y: [0, -60, 0], 
            rotate: [0, 20, 0],
            x: [0, 15, 0]
          }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="absolute top-[10%] left-[10%] text-8xl opacity-40 select-none drop-shadow-2xl"
        >
          💦
        </motion.div>
        <motion.div 
          animate={{ 
            y: [0, 60, 0], 
            rotate: [0, -20, 0],
            x: [0, -15, 0]
          }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          className="absolute bottom-[15%] right-[10%] text-9xl opacity-40 select-none drop-shadow-2xl"
        >
          👅
        </motion.div>
        <motion.div 
          animate={{ 
            scale: [1, 1.4, 1],
            rotate: [0, 90, 0]
          }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="absolute top-[30%] right-[15%] text-7xl opacity-40 select-none drop-shadow-2xl"
        >
          ✨
        </motion.div>
        <motion.div 
          animate={{ 
            y: [0, -50, 0],
            x: [0, 30, 0],
            rotate: [0, -10, 0]
          }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[15%] text-8xl opacity-40 select-none drop-shadow-2xl"
        >
          💦
        </motion.div>
        <motion.div 
          animate={{ 
            rotate: [0, 360],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute top-[50%] left-[5%] text-6xl opacity-30 select-none"
        >
          💩
        </motion.div>
      </div>
    </div>
  );
}
