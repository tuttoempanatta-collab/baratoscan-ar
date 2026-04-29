import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ShoppingCart, AlertCircle } from 'lucide-react';

interface PriceRecord {
  cadena: string;
  precio: number | null;
  precio_oferta: number | null;
  url_producto: string | null;
  error: string | null;
  timestamp: string;
}

interface ComparisonTableProps {
  prices: PriceRecord[];
}

export default function ComparisonTable({ prices }: ComparisonTableProps) {
  // Sort by price (cheapest first), pushing errors/nulls to the bottom
  const sortedPrices = [...prices].sort((a, b) => {
    if (a.precio === null && b.precio === null) return 0;
    if (a.precio === null) return 1;
    if (b.precio === null) return -1;
    return a.precio - b.precio;
  });

  const cheapestPrice = sortedPrices.find(p => p.precio !== null)?.precio;

  const getChainColor = (chain: string) => {
    const colors: Record<string, string> = {
      'Día': 'bg-red-600',
      'Coto': 'bg-blue-600',
      'Disco': 'bg-red-700',
      'ChangoMás': 'bg-blue-500',
      'Carrefour': 'bg-blue-800',
      'Vea': 'bg-green-600',
      'Diarco': 'bg-orange-500'
    };
    return colors[chain] || 'bg-slate-600';
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4 mt-6">
      {sortedPrices.map((record, index) => {
        const isError = record.error || record.precio === null;
        const isCheapest = record.precio === cheapestPrice && !isError;
        
        return (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            key={record.cadena}
            className={`flex items-center justify-between p-4 sm:p-6 rounded-2xl border-2 transition-all gap-3 ${
              isCheapest 
                ? 'border-green-400 bg-green-50 shadow-md transform scale-[1.02]' 
                : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-inner ${getChainColor(record.cadena)}`}>
                {record.cadena.substring(0, 3).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-sm sm:text-lg truncate leading-tight">{record.cadena}</span>
                {isCheapest && (
                  <span className="text-[9px] sm:text-xs font-bold text-green-600 tracking-wide uppercase bg-green-200/50 px-2 py-0.5 rounded-full inline-block w-max mt-0.5">
                    Más Barato
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-6 shrink-0">
              {isError ? (
                <div className="flex items-center gap-1 sm:gap-2 text-slate-400">
                  <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-sm font-medium">No disponible</span>
                </div>
              ) : (
                <div className="text-right">
                  <div className={`text-lg sm:text-2xl font-black whitespace-nowrap ${isCheapest ? 'text-green-600' : 'text-slate-800'}`}>
                    ${record.precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  {record.precio_oferta && (
                    <div className="text-[9px] sm:text-xs text-red-500 font-bold bg-red-50 px-1 sm:px-2 py-0.5 rounded mt-0.5">
                      Oferta: ${record.precio_oferta.toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              )}

              {record.url_producto && !isError && (
                <a
                  href={record.url_producto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <ShoppingCart size={16} className="sm:w-[18px] sm:h-[18px]" />
                </a>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
