import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, AlertCircle } from 'lucide-react';

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

  const getRankBadge = (rank: number) => {
    const baseClass = "flex items-center justify-center rounded-full text-white font-black shadow-sm shrink-0 w-7 h-7 text-xs sm:w-8 sm:h-8 sm:text-sm lg:w-6 lg:h-6 lg:text-xs xl:w-8 xl:h-8 xl:text-sm";
    if (rank === 1) {
      return (
        <span className={`${baseClass} bg-amber-500 border border-amber-400`}>
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className={`${baseClass} bg-slate-400 border border-slate-300`}>
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className={`${baseClass} bg-amber-700 border border-amber-600`}>
          3
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center rounded-full text-slate-500 font-bold border border-slate-200 shrink-0 w-7 h-7 text-xs sm:w-8 sm:h-8 sm:text-sm lg:w-6 lg:h-6 lg:text-xs xl:w-8 xl:h-8 xl:text-sm bg-slate-100">
        {rank}
      </span>
    );
  };

  let rankCounter = 0;

  return (
    <div className="w-full flex flex-col gap-3">
      {sortedPrices.map((record, index) => {
        const isError = record.error || record.precio === null;
        const isCheapest = record.precio === cheapestPrice && !isError;
        let itemRank = 0;
        if (!isError) {
          rankCounter++;
          itemRank = rankCounter;
        }
        
        return (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            key={record.cadena}
            className={`flex items-center justify-between p-4 sm:p-5 lg:p-3 xl:p-5 rounded-2xl border transition-all gap-3 ${
              isCheapest 
                ? 'border-green-400 bg-green-50/70 shadow-sm transform scale-[1.01]' 
                : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
              {!isError && getRankBadge(itemRank)}
              <div className={`w-12 h-12 lg:w-10 xl:w-12 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-sm lg:text-xs xl:text-sm shadow-inner ${getChainColor(record.cadena)}`}>
                {record.cadena.substring(0, 3).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-base sm:text-lg lg:text-sm xl:text-lg truncate leading-tight">{record.cadena}</span>
                {isCheapest && (
                  <span className="text-[10px] sm:text-xs lg:text-[9px] xl:text-xs font-bold text-green-600 tracking-wide uppercase bg-green-200/50 px-2 py-0.5 rounded-full inline-block w-max mt-0.5">
                    Más Barato
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              {isError ? (
                <div className="flex items-center gap-1 sm:gap-2 text-slate-400">
                  <AlertCircle className="w-4 h-4 lg:w-3.5 lg:h-3.5" />
                  <span className="text-xs sm:text-sm lg:text-xs font-medium">No disponible</span>
                </div>
              ) : (
                <div className="text-right">
                  <div className={`text-lg sm:text-2xl lg:text-lg xl:text-2xl font-black whitespace-nowrap ${isCheapest ? 'text-green-600' : 'text-slate-800'}`}>
                    ${record.precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  {record.precio_oferta && (
                    <div className="text-[10px] sm:text-xs lg:text-[9px] xl:text-xs text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded mt-0.5">
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
                  className="w-10 h-10 lg:w-8 lg:h-8 xl:w-10 xl:h-10 shrink-0 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5" />
                </a>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
