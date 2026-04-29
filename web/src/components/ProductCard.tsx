import React from 'react';
import { motion } from 'framer-motion';

interface ProductCardProps {
  nombre: string;
  ean: string;
  imagen_url: string | null;
}

export default function ProductCard({ nombre, ean, imagen_url }: ProductCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 flex flex-col sm:flex-row items-center gap-6 w-full max-w-2xl mx-auto"
    >
      <div className="w-32 h-32 flex-shrink-0 bg-slate-50 rounded-2xl p-2 flex items-center justify-center border border-slate-100 overflow-hidden">
        {imagen_url ? (
          <img src={imagen_url} alt={nombre} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
            <span className="text-slate-400 font-bold">Sin Img</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 text-center sm:text-left">
        <h2 className="text-2xl font-bold text-slate-800 leading-tight mb-2 line-clamp-3">
          {nombre}
        </h2>
        <div className="inline-block bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-mono text-sm tracking-wider font-semibold border border-slate-200">
          EAN: {ean}
        </div>
      </div>
    </motion.div>
  );
}
