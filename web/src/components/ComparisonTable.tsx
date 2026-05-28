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
    if (rank === 1) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs shadow-sm shrink-0 border border-amber-400">
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-400 text-white font-black text-xs shadow-sm shrink-0 border border-slate-300">
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs shadow-sm shrink-0 border border-amber-600">
          3
        </span>
      );
    }
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200 shrink-0">
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
            className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border transition-all gap-3 ${
              isCheapest 
                ? 'border-green-400 bg-green-50/70 shadow-sm transform scale-[1.01]' 
                : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {!isError && getRankBadge(itemRank)}
              <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-inner ${getChainColor(record.cadena)}`}>
                {record.cadena.substring(0, 3).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-sm sm:text-base truncate leading-tight">{record.cadena}</span>
                {isCheapest && (
                  <span className="text-[9px] sm:text-xs font-bold text-green-600 tracking-wide uppercase bg-green-200/50 px-2 py-0.5 rounded-full inline-block w-max mt-0.5">
                    Más Barato
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {isError ? (
                <div className="flex items-center gap-1 sm:gap-2 text-slate-400">
                  <AlertCircle size={14} className="sm:w-4 sm:h-4" />
                  <span className="text-[10px] sm:text-xs font-medium">No disponible</span>
                </div>
              ) : (
                <div className="text-right">
                  <div className={`text-base sm:text-xl font-black whitespace-nowrap ${isCheapest ? 'text-green-600' : 'text-slate-800'}`}>
                    ${record.precio?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </div>
                  {record.precio_oferta && (
                    <div className="text-[9px] sm:text-xs text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded mt-0.5">
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
                  className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  <ShoppingCart size={15} />
                </a>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
