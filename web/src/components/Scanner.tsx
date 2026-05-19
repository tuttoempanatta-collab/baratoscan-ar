'use client';

import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, Keyboard, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScannerProps {
  onScan: (query: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const [mode, setMode] = useState<'camera' | 'ean' | 'text'>('camera');
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (mode === 'camera') {
      const scanner = new Html5QrcodeScanner(
        'reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 }, 
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: { ideal: "environment" }
          }
        },
        false
      );

      scanner.render(
        (decodedText) => {
          scanner.clear();
          onScan(decodedText);
        },
        () => {
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
    if (manualValue.trim().length > 0) {
      onScan(manualValue.trim());
    }
  };

  const handleTabChange = (newMode: 'camera' | 'ean' | 'text') => {
    setMode(newMode);
    setManualValue(''); // Clear input when switching tabs
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col items-center">
      
      {/* Tabs */}
      <div className="flex w-full bg-slate-100 p-1.5 gap-1">
        <button
          onClick={() => handleTabChange('camera')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-sm transition-all ${
            mode === 'camera' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Camera size={18} />
          <span>Cámara</span>
        </button>
        <button
          onClick={() => handleTabChange('ean')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-sm transition-all ${
            mode === 'ean' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Keyboard size={18} />
          <span>EAN</span>
        </button>
        <button
          onClick={() => handleTabChange('text')}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-bold text-sm transition-all ${
            mode === 'text' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Search size={18} />
          <span>Producto</span>
        </button>
      </div>

      <div className="p-6 w-full flex flex-col items-center justify-center min-h-[320px]">
        {mode === 'camera' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full flex flex-col items-center justify-center"
          >
            <div id="reader" className="w-full overflow-hidden rounded-2xl [&>div]:!border-none [&>div]:!shadow-none" />
            <p className="text-slate-500 mt-4 text-center text-sm font-medium">Apunta la cámara al código de barras</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <label className="text-slate-700 font-bold text-lg text-center">
                {mode === 'ean' ? 'Ingresa el código EAN' : 'Busca por nombre'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode={mode === 'ean' ? 'numeric' : 'text'}
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={mode === 'ean' ? 'Ej: 7790580567903' : 'Ej: Banana, Leche, Yerba...'}
                  className="w-full text-xl py-4 px-6 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-500 text-center tracking-wide shadow-inner transition-colors text-slate-900 font-bold"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!manualValue.trim()}
                className="w-full py-4 mt-2 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-indigo-200"
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

