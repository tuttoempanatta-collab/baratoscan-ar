'use client';

import React, { useState } from 'react';
import Scanner from '@/components/Scanner';
import ComparisonTable from '@/components/ComparisonTable';
import { Search, ScanBarcode, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface ScrapedProduct {
  ean: string;
  nombre?: string;
  precio?: number;
  precio_oferta?: number;
  imagen_url?: string;
  cadena: string;
  timestamp: string;
  url_producto?: string;
  error?: string;
}

export default function Home() {
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<ScrapedProduct[]>([]);
  const [currentQuery, setCurrentQuery] = useState<string>('');

  const handleScan = async (query: string) => {
    setIsScanning(false);
    setIsLoading(true);
    setCurrentQuery(query);
    setScrapedData([]);

    try {
      const res = await fetch(`/api/scan?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setScrapedData(data);
      } else {
        alert('Hubo un error al buscar el producto. Intenta nuevamente.');
        setIsScanning(true);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al buscar el producto.');
      setIsScanning(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Find the first valid product info for the card
  const validProduct = scrapedData.find(item => item.nombre && !item.error);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      
      {/* Header */}
      <header className="bg-indigo-600 text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-2xl mx-auto relative z-10 flex flex-col items-center text-center">
          <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm mb-4 inline-block">
            <ScanBarcode size={40} className="text-white drop-shadow-md" />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2 drop-shadow-sm">BaratoScan AR</h1>
          <p className="text-indigo-100 font-medium text-lg max-w-md mb-6">
            Escaneá el código de barras y encontrá el supermercado más barato al instante.
          </p>
          <Link href="/comparativa" className="bg-white/20 hover:bg-white/30 transition-all text-white px-6 py-2 rounded-full backdrop-blur-md border border-white/30 font-medium flex items-center gap-2">
            Ver Comparativa de CSVs
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`px-4 -mt-16 relative z-20 w-full mx-auto flex flex-col items-center transition-all duration-300 ${
        isScanning ? 'max-w-2xl' : (validProduct ? 'max-w-5xl' : 'max-w-2xl')
      }`}>
        
        {isScanning ? (
          <Scanner onScan={handleScan} />
        ) : (
          <div className="w-full flex flex-col items-center">
            
            {isLoading ? (
              <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center justify-center min-h-[300px] w-full max-w-md">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
                <h2 className="text-xl font-bold text-slate-800">Buscando precios...</h2>
                <p className="text-slate-500 text-center mt-2 text-sm font-medium">
                  Estamos consultando en Día, Coto, Carrefour y más supermercados. Esto puede demorar unos segundos.
                </p>
                <div className="mt-6 font-mono font-bold bg-slate-100 px-4 py-2 rounded-full text-slate-600">
                  Búsqueda: {currentQuery}
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-6">
                
                <button 
                  onClick={() => setIsScanning(true)}
                  className="bg-white border-2 border-indigo-100 text-indigo-600 font-bold py-3 px-8 rounded-full shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center gap-2 mb-2"
                >
                  <Search size={18} />
                  Escanear otro producto
                </button>

                {validProduct ? (
                  <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-2">
                    {/* Left Column: Large Image Card */}
                    <div className="lg:col-span-5 w-full flex flex-col gap-4">
                      <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100 flex items-center justify-center aspect-square w-full relative overflow-hidden group">
                        {validProduct.imagen_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img 
                            src={validProduct.imagen_url} 
                            alt={validProduct.nombre || 'Producto'} 
                            className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                          />
                        ) : (
                          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                            <span className="text-slate-400 font-bold text-sm">Sin Imagen</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Title, EAN & Rankings */}
                    <div className="lg:col-span-7 w-full flex flex-col gap-6">
                      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-lg border border-slate-100 text-left">
                        <div className="inline-block bg-slate-100 px-3 py-1 rounded-full text-slate-500 font-mono text-xs tracking-wider font-semibold border border-slate-200 mb-3">
                          {/^\d+$/.test(currentQuery) ? 'EAN: ' : 'Búsqueda: '}{currentQuery}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-snug mb-6">
                          {validProduct.nombre}
                        </h2>
                        
                        <div className="border-t border-slate-100 pt-6">
                          <h3 className="text-sm font-bold text-slate-400 tracking-wider uppercase mb-4">
                            Ranking de Precios
                          </h3>
                          <ComparisonTable prices={scrapedData as any} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 flex flex-col items-center text-center max-w-md w-full">
                     <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                       <Search size={32} />
                     </div>
                     <h2 className="text-2xl font-bold text-slate-800 mb-2">Producto no encontrado</h2>
                     <p className="text-slate-500 mb-6 font-medium">
                       No pudimos encontrar precios para <strong>{currentQuery}</strong> en ninguno de los supermercados.
                     </p>
                     <button 
                        onClick={() => setIsScanning(true)}
                        className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-md hover:bg-indigo-700 w-full transition-all"
                      >
                        Intentar con otro
                      </button>
                   </div>
                )}
              </div>
            )}
            
          </div>
        )}

      </main>

      {/* Footer references */}
      <footer className="mt-20 pb-8 text-center px-4">
        <p className="text-slate-400 text-sm font-medium">
          Inspirado en proyectos geniales como <a href="https://github.com/ratoneando-ar/ratoneando-go" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 underline decoration-indigo-200 underline-offset-2">ratoneando.ar</a>, <a href="#" className="text-indigo-400 hover:text-indigo-600 underline decoration-indigo-200 underline-offset-2">yapa.ar</a> y <a href="#" className="text-indigo-400 hover:text-indigo-600 underline decoration-indigo-200 underline-offset-2">superprecio.ar</a>
        </p>
      </footer>
    </div>
  );
}
