'use client';

import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, Keyboard, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScannerProps {
  onScan: (ean: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualEan, setManualEan] = useState('');

  useEffect(() => {
    if (mode === 'camera') {
      const scanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.0 },
        false
      );

      scanner.render(
        (decodedText) => {
          scanner.clear();
          onScan(decodedText);
        },
        (error) => {
          // Ignore frequent scanning errors
        }
      );

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [mode, onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualEan.trim().length > 0) {
      onScan(manualEan.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center">
      
      {/* Tabs */}
      <div className="flex w-full bg-slate-100 p-2">
        <button
          onClick={() => setMode('camera')}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all ${
            mode === 'camera' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Camera size={20} />
          Cámara
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold transition-all ${
            mode === 'manual' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Keyboard size={20} />
          Manual
        </button>
      </div>

      <div className="p-6 w-full flex flex-col items-center justify-center min-h-[350px]">
        {mode === 'camera' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full flex flex-col items-center justify-center"
          >
            <div id="reader" className="w-full overflow-hidden rounded-2xl [&>div]:!border-none [&>div]:!shadow-none" />
            <p className="text-slate-500 mt-4 text-center text-sm font-medium">Apunta la cámara al código de barras (EAN) del producto</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <label className="text-slate-700 font-semibold text-lg text-center">
                Ingresa el código de barras
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={manualEan}
                  onChange={(e) => setManualEan(e.target.value)}
                  placeholder="Ej: 7791234567890"
                  className="w-full text-2xl py-4 px-6 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 text-center tracking-widest font-mono shadow-inner transition-colors"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualEan.trim()}
                className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
              >
                <Search size={24} />
                Buscar Precios
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
