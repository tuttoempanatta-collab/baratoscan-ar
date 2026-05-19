'use client';

import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import { Upload, Plus, Trash2, Tag, ShoppingBag, FolderArchive, Loader2, FileText, FileSpreadsheet, Trophy, TrendingDown, ListFilter, Image as ImageIcon, Star, X, ChevronDown, ArrowUpDown, Minus, AlertCircle } from 'lucide-react';

interface CsvDataRow {
  ean?: string;
  nombre?: string;
  precio?: string | number;
  tipo_marca?: string; // 'Nacional' or 'Propia'
  marca?: string;
  familia?: string;
  [key: string]: string | number | undefined | null;
}

interface CommerceData {
  id: string;
  name: string;
  data: CsvDataRow[];
}

let nextId = 1;

interface ParsedUnit {
  quantity: number;
  unit: 'L' | 'Kg' | 'U';
}

function parseVolumeOrWeight(name: string): ParsedUnit | null {
  // Matches patterns like: 2.25L, 2,25 L, 500g, 500 gr, 1kg, 1.5 kg, 350 cc, 900 ml, 1 u, etc.
  const regex = /(\d+(?:[.,]\d+)?)\s*(ml|cc|l|lt|g|gr|kg|u)(?!\w)/i;
  const match = name.match(regex);
  if (!match) return null;

  const valueStr = match[1].replace(',', '.');
  const quantity = parseFloat(valueStr);
  const unitRaw = match[2].toLowerCase();

  if (isNaN(quantity) || quantity <= 0) return null;

  if (unitRaw === 'l' || unitRaw === 'lt') {
    return { quantity, unit: 'L' };
  } else if (unitRaw === 'ml' || unitRaw === 'cc') {
    return { quantity: quantity / 1000, unit: 'L' };
  } else if (unitRaw === 'kg') {
    return { quantity, unit: 'Kg' };
  } else if (unitRaw === 'g' || unitRaw === 'gr') {
    return { quantity: quantity / 1000, unit: 'Kg' };
  } else if (unitRaw === 'u') {
    return { quantity, unit: 'U' };
  }

  return null;
}

export default function ComparativaPage() {
  const [commerces, setCommerces] = useState<CommerceData[]>([]);
  const [newCommerceName, setNewCommerceName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Filtros
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMarca, setFilterMarca] = useState('');
  const [filterFamilia, setFilterFamilia] = useState('');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [importedBrandsInput, setImportedBrandsInput] = useState('');
  const [showImportBrands, setShowImportBrands] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState('');

  // Drill-down Fortaleza
  const [selectedFamilyDrillDown, setSelectedFamilyDrillDown] = useState<string | null>(null);

  // Marcas Propias
  const [showMarcasPropias, setShowMarcasPropias] = useState(false);
  const [marcasPropiasSortBy, setMarcasPropiasSortBy] = useState<'unitPrice' | 'nombre' | 'price'>('unitPrice');
  const [marcasPropiasSearch, setMarcasPropiasSearch] = useState('');

  // Duelo Multi-Comercio
  const [showDuel, setShowDuel] = useState(false);
  const [duelCommerces, setDuelCommerces] = useState<string[]>([]);
  const [duelSearch, setDuelSearch] = useState('');
  const [duelShowOnly, setDuelShowOnly] = useState<'todos' | 'compartidos' | 'soloA' | 'soloB'>('todos');
  const [duelProductMode, setDuelProductMode] = useState<'global' | 'filtrado' | 'articulo'>('global');
  const [duelSelectedEan, setDuelSelectedEan] = useState('');

  // Inicialización automática de comercios en el duelo
  React.useEffect(() => {
    if (commerces.length >= 2 && duelCommerces.length === 0) {
      setDuelCommerces([commerces[0].name, commerces[1].name]);
    }
  }, [commerces, duelCommerces]);



  // ZIP Processing state
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [isExportingPdf] = [false];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processMasterZip = async () => {
    if (!file) return;
    setIsProcessingZip(true);
    setProgressMsg('Abriendo archivo ZIP maestro...');
    try {
      const zip = new JSZip();
      const masterZip = await zip.loadAsync(file);
      
      const subZips: string[] = [];
      masterZip.forEach((relativePath, zipObj) => {
        if (!zipObj.dir && relativePath.endsWith('.zip')) {
          subZips.push(relativePath);
        }
      });

      if (subZips.length === 0) {
        alert('No se encontraron sub-archivos .zip dentro del maestro.');
        setIsProcessingZip(false);
        return;
      }

      const newCommerces: CommerceData[] = [];

      for (let i = 0; i < subZips.length; i++) {
        const subZipPath = subZips[i];
        setProgressMsg(`Procesando comercio ${i+1} de ${subZips.length}...`);
        
        const subZipFile = masterZip.file(subZipPath);
        if (!subZipFile) continue;
        
        let loadedInner: JSZip;
        try {
            const subZipData = await subZipFile.async('uint8array');
            const innerZip = new JSZip();
            loadedInner = await innerZip.loadAsync(subZipData);
        } catch (err) {
            console.warn(`Error abriendo el subzip ${subZipPath}, saltando...`, err);
            continue;
        }
        
        let comercioCsvText = '';
        let productosCsvText = '';
        
        loadedInner.forEach((relPath) => {
          if (relPath.endsWith('comercio.csv')) comercioCsvText = relPath;
          if (relPath.endsWith('productos.csv')) productosCsvText = relPath;
        });

        if (!productosCsvText) continue;

        let commerceName = `Comercio ${i+1}`;
        if (comercioCsvText) {
           try {
             const text = await loadedInner.file(comercioCsvText)!.async('string');
             const parsedComercio = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, delimiter: '|' });
             if (parsedComercio.data.length > 0) {
                const row = parsedComercio.data[0];
                commerceName = String(row['comercio_razon_social'] || row['comercio_bandera_nombre'] || commerceName);
             }
           } catch(e) {
             console.warn(`No se pudo leer comercio.csv de ${subZipPath}`, e);
           }
        }

        try {
          const prodBlob = await loadedInner.file(productosCsvText)!.async('blob');
          const data = await parseProductsData(prodBlob, commerceName, '|');
          if (data.length > 0) {
             newCommerces.push({ id: String(nextId++), name: commerceName, data });
          }
        } catch(e) {
           console.warn(`Error procesando productos.csv de ${subZipPath}`, e);
        }
      }

      setCommerces(prev => [...prev, ...newCommerces]);
      alert('¡Importación de ZIP completada con éxito!');
    } catch (e) {
      console.error(e);
      alert('Error procesando el ZIP maestro: ' + String(e));
    } finally {
      setIsProcessingZip(false);
      setProgressMsg('');
      setFile(null);
    }
  };

  const addCommerce = () => {
    if (!file) {
      alert('Por favor selecciona un archivo (CSV o ZIP).');
      return;
    }

    if (file.name.toLowerCase().endsWith('.zip')) {
      processMasterZip();
      return;
    }

    if (!newCommerceName.trim()) {
      alert('Por favor ingresa un nombre de comercio.');
      return;
    }

    // Process manual CSV directly with our new stream parser
    processParsedResults(file, newCommerceName.trim());
  };

  const parseProductsData = (source: string | Blob | File, commerceName: string, delimiter: string = ''): Promise<CsvDataRow[]> => {
    return new Promise((resolve, reject) => {
      const uniqueProducts = new Map<string, CsvDataRow>();

      const config: Papa.ParseConfig<Record<string, unknown>> = {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        step: (results) => {
          const row = results.data;
          if (!row) return;

          let ean = '';
          let nombre = '';
          let precio = 0;
          let marca = '';
          let familia = '';
          let tipo_marca = 'Nacional';

          if (row['id_producto'] !== undefined) ean = String(row['id_producto']);
          if (row['productos_descripcion'] !== undefined) nombre = String(row['productos_descripcion']);
          if (row['productos_precio_lista'] !== undefined) {
            precio = parseFloat(String(row['productos_precio_lista']).replace(/[^0-9,-.]+/g, "").replace(',', '.'));
          }
          if (row['productos_marca'] !== undefined) marca = String(row['productos_marca']);

          if (!ean || !nombre) {
            for (const key in row) {
              const lowerKey = key.toLowerCase().trim();
              if (!ean && (lowerKey === 'ean' || lowerKey === 'codigo' || lowerKey === 'código' || lowerKey.includes('id_producto'))) {
                ean = String(row[key]);
              } else if (!nombre && (lowerKey === 'nombre' || lowerKey === 'producto' || lowerKey.includes('descrip'))) {
                nombre = String(row[key]);
              } else if (!precio && (lowerKey === 'precio' || lowerKey.includes('importe') || lowerKey.includes('precio_lista'))) {
                precio = parseFloat(String(row[key] || '0').replace(/[^0-9,-.]+/g, "").replace(',', '.'));
              } else if (!marca && (lowerKey === 'marca' || lowerKey === 'tipo')) {
                marca = String(row[key]);
              } else if (!familia && (lowerKey.includes('familia') || lowerKey.includes('categoria') || lowerKey.includes('rubro'))) {
                familia = String(row[key]);
              }
            }
          }

          if (!ean || ean === 'undefined') return;

          const val = marca.toLowerCase();
          if (val.includes('propia') || val.includes('blanca') || val.includes(commerceName.toLowerCase())) {
            tipo_marca = 'Propia';
          }

          if (uniqueProducts.has(ean)) {
            const existing = uniqueProducts.get(ean)!;
            if (precio > 0 && (existing.precio === 0 || precio < Number(existing.precio))) {
              existing.precio = precio;
            }
          } else {
            uniqueProducts.set(ean, { ean, nombre, precio, tipo_marca, marca, familia });
          }
        },
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn("PapaParse parsing errors:", results.errors);
          }
          resolve(Array.from(uniqueProducts.values()));
        }
      };

      if (delimiter) {
         config.delimiter = delimiter;
      }

      Papa.parse<Record<string, unknown>>(source as File, config as any);
    });
  };

  const processParsedResults = async (file: File | Blob, commerceName: string, delimiter: string = '') => {
    try {
        const data = await parseProductsData(file, commerceName, delimiter);
        const newCommerce: CommerceData = {
          id: String(nextId++),
          name: commerceName,
          data,
        };
        setCommerces(prev => [...prev, newCommerce]);
        setNewCommerceName('');
        setFile(null);
    } catch(e) {
        alert('Hubo un error procesando los datos CSV.');
        console.error(e);
    }
  };


  const removeCommerce = (id: string) => {
    setCommerces(commerces.filter(c => c.id !== id));
  };

  // Group products — memoized so it only recomputes when commerces data changes
  const productsList = useMemo(() => {
    const combined: Record<string, { ean: string; nombre: string; tipo_marca: string; marca: string; familia: string; prices: Record<string, number> }> = {};
    commerces.forEach(commerce => {
      commerce.data.forEach(item => {
        const key = item.ean || item.nombre;
        if (!key) return;
        if (!combined[key]) {
          combined[key] = {
            ean: item.ean || '-',
            nombre: item.nombre || 'Producto Desconocido',
            tipo_marca: item.tipo_marca || 'Nacional',
            marca: item.marca || '',
            familia: item.familia || '',
            prices: {},
          };
        }
        if (item.tipo_marca) combined[key].tipo_marca = item.tipo_marca;
        if (item.marca) combined[key].marca = item.marca;
        if (item.familia) combined[key].familia = item.familia;
        if (item.precio && !isNaN(Number(item.precio))) {
          combined[key].prices[commerce.name] = Number(item.precio);
        }
      });
    });
    return Object.values(combined);
  }, [commerces]);

  // Unique brand/family lists
  const allBrands = useMemo(() => Array.from(new Set(productsList.map(p => p.marca).filter(Boolean))).sort(), [productsList]);
  const allFamilies = useMemo(() => Array.from(new Set(productsList.map(p => p.familia).filter(Boolean))).sort(), [productsList]);

  const importedBrandsList = useMemo(() =>
    importedBrandsInput.split(/[\n,]+/).map(b => b.trim().toLowerCase()).filter(Boolean),
  [importedBrandsInput]);

  // Filtered products — only recomputes when filters or productsList change
  const filteredProducts = useMemo(() => productsList.filter(p => {
    if (filterTipo !== 'Todos' && p.tipo_marca !== filterTipo) return false;
    if (filterMarca && p.marca !== filterMarca) return false;
    if (filterFamilia && p.familia !== filterFamilia) return false;
    if (importedBrandsList.length > 0) {
      if (!p.marca || !importedBrandsList.includes(p.marca.toLowerCase())) return false;
    }
    if (filterSearch) {
      const term = filterSearch.toLowerCase();
      if (
        !p.nombre.toLowerCase().includes(term) &&
        !p.ean.toLowerCase().includes(term) &&
        !p.familia?.toLowerCase().includes(term) &&
        !p.marca?.toLowerCase().includes(term)
      ) return false;
    }
    return true;
  }), [productsList, filterTipo, filterMarca, filterFamilia, filterSearch, importedBrandsList]);

  // Ranking — memoized on filteredProducts
  const { rankingOrdenado, totalVictorias } = useMemo(() => {
    const contador: Record<string, number> = {};
    commerces.forEach(c => { contador[c.name] = 0; });
    filteredProducts.forEach(p => {
      const allPrices = Object.values(p.prices);
      if (!allPrices.length) return;
      const minPrice = Math.min(...allPrices);
      Object.entries(p.prices).forEach(([name, price]) => {
        if (price === minPrice) contador[name] = (contador[name] || 0) + 1;
      });
    });
    const ordered = Object.entries(contador).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
    const total = ordered.reduce((acc, [, c]) => acc + c, 0);
    return { rankingOrdenado: ordered, totalVictorias: total };
  }, [filteredProducts, commerces]);

  // Commerce strength analysis
  type FamiliaStats = { familia: string; baratos: number; igual: number; caro: number; total: number };
  const comercioAnalysis = useMemo((): FamiliaStats[] => {
    if (!selectedAnalysis) return [];
    const statsMap: Record<string, FamiliaStats> = {};
    filteredProducts.forEach(p => {
      const myPrice = p.prices[selectedAnalysis];
      if (myPrice == null) return;
      const fam = p.familia || p.marca || 'Sin categoría';
      if (!statsMap[fam]) statsMap[fam] = { familia: fam, baratos: 0, igual: 0, caro: 0, total: 0 };
      statsMap[fam].total++;
      const allPrices = Object.values(p.prices);
      const minPrice = Math.min(...allPrices);
      if (myPrice === minPrice && allPrices.length > 1) statsMap[fam].baratos++;
      else if (myPrice === minPrice) statsMap[fam].igual++;
      else statsMap[fam].caro++;
    });
    return Object.values(statsMap).sort((a, b) => b.baratos - a.baratos);
  }, [filteredProducts, selectedAnalysis]);

  // Drill-down: productos detallados de la familia seleccionada
  type ProductStatus = 'barato' | 'empate' | 'unico' | 'caro';
  interface ProductDrillDown {
    ean: string; nombre: string; myPrice: number; minPrice: number; maxPrice: number;
    status: ProductStatus;
    cheaperThan: { name: string; price: number }[];
    tiedWith: { name: string; price: number }[];
    cheaperCommerces: { name: string; price: number; diff: number; diffPct: number }[];
  }
  const familyProductsDetail = useMemo((): ProductDrillDown[] => {
    if (!selectedAnalysis || !selectedFamilyDrillDown) return [];
    return filteredProducts
      .filter(p => (p.familia || p.marca || 'Sin categoría') === selectedFamilyDrillDown)
      .filter(p => p.prices[selectedAnalysis] != null)
      .map(p => {
        const myPrice = p.prices[selectedAnalysis];
        const entries = Object.entries(p.prices);
        const allPriceVals = Object.values(p.prices);
        const minPrice = Math.min(...allPriceVals);
        const maxPrice = Math.max(...allPriceVals);
        const others = entries.filter(([n]) => n !== selectedAnalysis);

        let status: ProductStatus;
        if (entries.length === 1) {
          status = 'unico';
        } else if (myPrice === minPrice) {
          const tied = others.filter(([, v]) => v === myPrice);
          status = tied.length > 0 ? 'empate' : 'barato';
        } else {
          status = 'caro';
        }

        const cheaperThan = others.filter(([, v]) => v > myPrice).map(([name, price]) => ({ name, price }));
        const tiedWith = others.filter(([, v]) => v === myPrice).map(([name, price]) => ({ name, price }));
        const cheaperCommerces = others
          .filter(([, v]) => v < myPrice)
          .sort((a, b) => a[1] - b[1])
          .map(([name, price]) => ({ name, price, diff: myPrice - price, diffPct: ((myPrice - price) / price) * 100 }));

        return { ean: p.ean, nombre: p.nombre, myPrice, minPrice, maxPrice, status, cheaperThan, tiedWith, cheaperCommerces };
      })
      .sort((a, b) => {
        const order: Record<ProductStatus, number> = { caro: 0, empate: 1, unico: 2, barato: 3 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        if (a.status === 'caro' && b.status === 'caro') return (b.myPrice - b.minPrice) - (a.myPrice - a.minPrice);
        return 0;
      });
  }, [filteredProducts, selectedAnalysis, selectedFamilyDrillDown]);

  // Marcas Propias: comparativa de precios de marcas propias entre todos los comercios
  const marcasPropiasComparative = useMemo(() => {
    // 1. Obtener todos los productos clasificados como Marca Propia
    const propias = productsList.filter(p => p.tipo_marca === 'Propia');
    
    // 2. Parsear el volumen/peso y calcular el precio unitario
    const parsedPropias = propias.map(p => {
      const stores = Object.keys(p.prices);
      if (stores.length === 0) return null;
      const storeName = stores[0]; // Como es marca propia, solo suele tener precio en su propio comercio
      const price = p.prices[storeName];
      
      const parsedUnit = parseVolumeOrWeight(p.nombre);
      let unitPrice = price;
      let displayUnitPrice = '';
      let displaySize = 'N/D';
      
      if (parsedUnit) {
        unitPrice = price / parsedUnit.quantity;
        displayUnitPrice = `$${unitPrice.toFixed(2)} / ${parsedUnit.unit}`;
        displaySize = `${parsedUnit.quantity} ${parsedUnit.unit}`;
      } else {
        displayUnitPrice = `$${price.toFixed(2)} / U`;
        displaySize = '1 U';
      }
      
      return {
        ...p,
        storeName,
        price,
        unitPrice,
        displayUnitPrice,
        displaySize,
        parsedUnit
      };
    }).filter((p): p is NonNullable<typeof p> => p !== null);

    // 3. Filtrar y ordenar los resultados según la búsqueda y el criterio de ordenamiento
    const term = marcasPropiasSearch.toLowerCase().trim();
    let result = parsedPropias;
    
    if (term) {
      result = parsedPropias.filter(p => 
        p.nombre.toLowerCase().includes(term) || 
        (p.familia?.toLowerCase() || '').includes(term) ||
        (p.marca?.toLowerCase() || '').includes(term)
      );
    }

    // Ordenar
    return [...result].sort((a, b) => {
      if (marcasPropiasSortBy === 'unitPrice') {
        return a.unitPrice - b.unitPrice;
      } else if (marcasPropiasSortBy === 'price') {
        return a.price - b.price;
      } else {
        return a.nombre.localeCompare(b.nombre);
      }
    });
  }, [productsList, marcasPropiasSortBy, marcasPropiasSearch]);

  // Duelo Multi-Comercio
  interface DuelProduct {
    ean: string;
    nombre: string;
    marca: string;
    familia: string;
    tipo_marca: string;
    prices: Record<string, number>; // commerceName -> price
    cheapestCommerce?: string;
    isTiedCheapest?: boolean;
    priceDiffPct?: number;
    priceDiffAbs?: number;
  }

  const duelProductsBase = useMemo(() => {
    let list = productsList;
    if (duelProductMode === 'filtrado' || duelProductMode === 'articulo') {
      list = filteredProducts;
    }
    
    if (duelProductMode === 'articulo') {
      if (duelSelectedEan) {
        list = list.filter(p => p.ean === duelSelectedEan);
      } else {
        list = [];
      }
    }

    const term = duelSearch.toLowerCase();
    if (term) {
      list = list.filter(p =>
        p.nombre.toLowerCase().includes(term) ||
        p.ean.toLowerCase().includes(term) ||
        (p.marca?.toLowerCase() || '').includes(term) ||
        (p.familia?.toLowerCase() || '').includes(term)
      );
    }
    
    return list;
  }, [productsList, filteredProducts, duelProductMode, duelSelectedEan, duelSearch]);

  const duelResults = useMemo(() => {
    if (duelCommerces.length === 0) return null;

    const products: DuelProduct[] = [];
    
    duelProductsBase.forEach(p => {
      const activePrices: Record<string, number> = {};
      duelCommerces.forEach(c => {
        const pr = p.prices[c];
        if (pr != null) {
          activePrices[c] = pr;
        }
      });

      if (Object.keys(activePrices).length === 0) return;

      const priceValues = Object.values(activePrices);
      const minPrice = Math.min(...priceValues);
      const maxPrice = Math.max(...priceValues);
      
      const cheapestStores = Object.entries(activePrices).filter(([, v]) => v === minPrice).map(([n]) => n);
      const cheapestCommerce = cheapestStores[0];
      const isTiedCheapest = cheapestStores.length > 1;
      
      const priceDiffAbs = maxPrice - minPrice;
      const priceDiffPct = minPrice > 0 ? (priceDiffAbs / minPrice) * 100 : 0;

      products.push({
        ean: p.ean,
        nombre: p.nombre,
        marca: p.marca || '',
        familia: p.familia || '',
        tipo_marca: p.tipo_marca || '',
        prices: activePrices,
        cheapestCommerce,
        isTiedCheapest,
        priceDiffPct,
        priceDiffAbs
      });
    });

    const winsMap: Record<string, number> = {};
    const tiesMap: Record<string, number> = {};
    const totalOffersMap: Record<string, number> = {};
    
    duelCommerces.forEach(c => {
      winsMap[c] = 0;
      tiesMap[c] = 0;
      totalOffersMap[c] = 0;
    });

    products.forEach(p => {
      Object.keys(p.prices).forEach(c => {
        totalOffersMap[c] = (totalOffersMap[c] || 0) + 1;
      });

      if (p.isTiedCheapest) {
        Object.entries(p.prices).forEach(([c, v]) => {
          if (v === Math.min(...Object.values(p.prices))) {
            tiesMap[c] = (tiesMap[c] || 0) + 1;
          }
        });
      } else if (p.cheapestCommerce) {
        winsMap[p.cheapestCommerce] = (winsMap[p.cheapestCommerce] || 0) + 1;
      }
    });

    const commonProducts = products.filter(p => Object.keys(p.prices).length === duelCommerces.length);
    const cartCosts: Record<string, number> = {};
    duelCommerces.forEach(c => {
      cartCosts[c] = commonProducts.reduce((s, p) => s + (p.prices[c] || 0), 0);
    });

    let leaderStore = 'Ninguno';
    let maxWins = -1;
    let isLeaderTie = false;
    
    Object.entries(winsMap).forEach(([c, w]) => {
      if (w > maxWins) {
        maxWins = w;
        leaderStore = c;
        isLeaderTie = false;
      } else if (w === maxWins) {
        isLeaderTie = true;
      }
    });

    return {
      products,
      winsMap,
      tiesMap,
      totalOffersMap,
      cartCosts,
      commonCount: commonProducts.length,
      leaderStore,
      isLeaderTie,
      maxWins
    };
  }, [duelProductsBase, duelCommerces]);

  const duelFiltered = useMemo(() => {
    if (!duelResults) return [];
    
    return duelResults.products.filter(p => {
      const priceCount = Object.keys(p.prices).length;
      if (duelShowOnly === 'compartidos') {
        return priceCount >= 2;
      }
      if (duelShowOnly === 'soloA') {
        const storeA = duelCommerces[0];
        return storeA ? (priceCount === 1 && p.prices[storeA] != null) : false;
      }
      if (duelShowOnly === 'soloB') {
        const storeB = duelCommerces[1];
        return storeB ? (priceCount === 1 && p.prices[storeB] != null) : false;
      }
      return true;
    });
  }, [duelResults, duelShowOnly, duelCommerces]);

  const exportToExcel = () => {
    if (filteredProducts.length === 0) return;
    
    const exportData = filteredProducts.map(p => {
      const row: Record<string, string | number | undefined> = {
        'Producto': p.nombre,
        'EAN': p.ean,
        'Marca': p.marca,
        'Familia': p.familia,
        'Tipo': p.tipo_marca,
      };
      
      commerces.forEach(c => {
        row[c.name] = p.prices[c.name] ? `$${p.prices[c.name].toFixed(2)}` : '-';
      });
      
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Comparativa');
    XLSX.writeFile(workbook, 'Comparativa_Supermercados.xlsx');
  };

  const exportToPdf = () => {
    if (filteredProducts.length === 0) return;

    const dateStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const filterInfo = [filterSearch && `Búsqueda: "${filterSearch}"`, filterFamilia && `Familia: "${filterFamilia}"`].filter(Boolean).join('  |  ');

    const headers = ['Producto', 'Marca / Familia', 'Tipo', ...commerces.map(c => c.name)];
    const rows = filteredProducts.map(p => [
      p.nombre || '-',
      [p.marca, p.familia].filter(Boolean).join(' / ') || '-',
      p.tipo_marca || '-',
      ...commerces.map(c => p.prices[c.name] ? `$${p.prices[c.name].toFixed(2)}` : '-'),
    ]);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Comparativa</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; font-family: Arial, sans-serif; }
        body { margin: 0; padding: 0; font-size: 8pt; color: #1e293b; }
        .hdr { background: #4f46e5; color: white; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px; }
        .hdr h1 { margin: 0; font-size: 12pt; }
        .hdr p { margin: 2px 0 0; font-size: 7pt; opacity: 0.85; }
        table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
        th { background: #4f46e5; color: white; padding: 4px 5px; text-align: center; font-weight: bold; border: 1px solid #3730a3; }
        td { padding: 3px 5px; border: 1px solid #e2e8f0; vertical-align: middle; }
        tr:nth-child(even) td { background: #f8fafc; }
        td:nth-child(n+4) { text-align: right; font-weight: 600; }
        .footer { margin-top: 6px; font-size: 6.5pt; color: #94a3b8; text-align: right; }
      </style></head><body>
      <div class="hdr"><h1>Comparativa de Supermercados</h1>
      <p>${filterInfo ? filterInfo + '  |  ' : ''}${filteredProducts.length} productos  |  Fecha: ${dateStr}</p></div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div class="footer">BaratoScan AR — ${new Date().toLocaleDateString('es-AR')}</div>
      </body></html>`;

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const exportSummaryToImage = async () => {
    const element = document.getElementById('summary-section');
    if (!element) return;
    
    try {
      const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.download = 'Resumen_Comparativa.png';
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Error exportando imagen:', e);
      alert('Hubo un error al exportar la imagen.');
    }
  };

  const exportDuelToExcel = () => {
    if (!duelResults) return;

    const data: Record<string, string | number | undefined>[] = [];

    duelResults.products.forEach(p => {
      const row: Record<string, string | number | undefined> = {
        'EAN': p.ean,
        'Producto': p.nombre,
        'Marca': p.marca,
        'Familia': p.familia,
        'Tipo de Marca': p.tipo_marca,
      };

      duelCommerces.forEach(c => {
        row[`Precio (${c})`] = p.prices[c] !== undefined ? p.prices[c] : 'No disponible';
      });

      row['Comercio más Barato'] = p.isTiedCheapest ? 'Empate' : (p.cheapestCommerce || '-');
      row['Diferencia Máxima ($)'] = p.priceDiffAbs;
      row['Diferencia Máxima (%)'] = p.priceDiffPct ? `${p.priceDiffPct.toFixed(1)}%` : '0%';

      data.push(row);
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Duelo Multi-Comercio');
    XLSX.writeFile(workbook, `Duelo_Precios_MultiComercio.xlsx`);
  };

  const exportDuelToPdf = () => {
    if (!duelResults) return;

    const dateStr = new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const title = `Duelo de Precios Multi-Comercio`;
    
    const headersHtml = `
      <tr>
        <th>Producto / EAN / Marca</th>
        ${duelCommerces.map(c => `<th>${c}</th>`).join('')}
        <th>Comparativa / Mejor</th>
      </tr>
    `;

    const rowsHtml = duelResults.products.map(p => {
      const cheapestPrice = Math.min(...Object.values(p.prices));
      
      const pricesHtml = duelCommerces.map(c => {
        const pr = p.prices[c];
        if (pr == null) return `<td style="text-align: right; color: #cbd5e1; font-style: italic;">-</td>`;
        
        const isMin = pr === cheapestPrice;
        const color = isMin ? '#15803d' : '#1e293b';
        const bg = isMin ? '#f0fdf4' : 'transparent';
        const weight = isMin ? 'bold' : 'normal';

        return `<td style="text-align: right; background-color: ${bg}; color: ${color}; font-weight: ${weight};">$${pr.toFixed(2)}</td>`;
      }).join('');

      return `
        <tr>
          <td><strong>${p.nombre || '-'}</strong><br/><span style="font-size: 6pt; color: #64748b;">EAN: ${p.ean} · ${p.marca}</span></td>
          ${pricesHtml}
          <td style="text-align: right; font-weight: bold; font-size: 7.5pt; color: ${p.isTiedCheapest ? '#0284c7' : '#15803d'}">
            ${p.isTiedCheapest ? 'Empate' : (p.cheapestCommerce || '-')}
            ${p.priceDiffPct ? `<br/><span style="font-size: 6pt; font-weight: normal; color: #ef4444;">Dif Max: ${p.priceDiffPct.toFixed(1)}%</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    const scoresHtml = duelCommerces.map(c => `
      <div class="stat-card">
        <h4>${c}</h4>
        <p>Líder: ${duelResults.winsMap[c] || 0} prod | Carrito: ${duelResults.cartCosts[c] > 0 ? `$${duelResults.cartCosts[c].toFixed(2)}` : '-'}</p>
      </div>
    `).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; font-family: Arial, sans-serif; }
        body { margin: 0; padding: 0; font-size: 8pt; color: #1e293b; }
        .hdr { background: linear-gradient(135deg, #4f46e5, #9333ea); color: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; }
        .hdr h1 { margin: 0; font-size: 14pt; font-weight: 800; }
        .hdr p { margin: 4px 0 0; font-size: 8pt; opacity: 0.9; }
        .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .stat-card { flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; text-align: center; }
        .stat-card h4 { margin: 0; font-size: 7.5pt; color: #4f46e5; text-transform: uppercase; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .stat-card p { margin: 2px 0 0; font-size: 8.5pt; font-weight: bold; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
        th { background: #334155; color: white; padding: 5px; text-align: center; font-weight: bold; border: 1px solid #1e293b; }
        td { padding: 4px; border: 1px solid #e2e8f0; vertical-align: middle; }
        .footer { margin-top: 10px; font-size: 6.5pt; color: #94a3b8; text-align: right; }
      </style></head><body>
      <div class="hdr"><h1>⚔️ Duelo de Precios Multi-Comercio</h1>
      <p>Comercios: ${duelCommerces.join(', ')} | Fecha: ${dateStr}</p></div>
      
      <div class="stats">${scoresHtml}</div>

      <table>
        <thead>
          ${headersHtml}
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="footer">Generado por BaratoScan AR</div>
      </body></html>`;

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const exportDuelToImage = async () => {
    const element = document.getElementById('duel-results-container');
    if (!element) return;

    try {
      const dataUrl = await toPng(element, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `Duelo_MultiComercio.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Error exportando imagen de duelo:', e);
      alert('Hubo un error al exportar la imagen del duelo.');
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      <header className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white pt-12 pb-24 px-6 rounded-b-[3rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
           <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm mb-4 inline-block">
            <ShoppingBag size={40} className="text-white drop-shadow-md" />
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2 drop-shadow-sm">Comparativa de Supermercados</h1>
          <p className="text-indigo-100 font-medium text-lg max-w-xl">
            Sube los archivos CSV de distintos comercios para comparar precios de marcas nacionales y propias.
          </p>
        </div>
      </header>

      <main className="px-4 -mt-16 relative z-20 max-w-6xl mx-auto flex flex-col gap-8">
        {/* Upload Section */}
        <section className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-slate-700 mb-2">Nombre del Comercio (Solo para CSV manual)</label>
            <input 
              type="text" 
              placeholder="Ej. Coto, Carrefour..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900"
              value={newCommerceName}
              onChange={(e) => setNewCommerceName(e.target.value)}
              disabled={file?.name.toLowerCase().endsWith('.zip')}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-slate-700 mb-2">Archivo (.csv o .zip maestro SEPA)</label>
            <div className="relative">
              <input 
                type="file" 
                accept=".csv,.zip"
                id="csv-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="csv-upload" 
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${file ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 hover:border-indigo-400 text-slate-500 hover:bg-slate-50'}`}
              >
                {file?.name.toLowerCase().endsWith('.zip') ? <FolderArchive size={18} /> : <Upload size={18} />}
                <span className="truncate font-medium">{file ? file.name : 'Seleccionar CSV / ZIP'}</span>
              </label>
            </div>
          </div>
          <button 
            onClick={addCommerce}
            disabled={isProcessingZip}
            className={`font-bold py-3 px-8 rounded-xl shadow-md transition-all flex items-center gap-2 h-[50px] whitespace-nowrap ${isProcessingZip ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            {isProcessingZip ? <Loader2 size={20} className="animate-spin" /> : (file?.name.toLowerCase().endsWith('.zip') ? <FolderArchive size={20} /> : <Plus size={20} />)}
            {isProcessingZip ? 'Procesando...' : (file?.name.toLowerCase().endsWith('.zip') ? 'Importar ZIP' : 'Agregar')}
          </button>
        </section>
        
        {isProcessingZip && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center text-indigo-700 font-medium flex items-center justify-center gap-3">
             <Loader2 size={24} className="animate-spin" />
             {progressMsg}
          </div>
        )}

        {/* Active Commerces */}
        {commerces.length > 0 && (
          <section className="flex flex-wrap gap-4">
            {commerces.map((c) => (
              <div key={c.id} className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="font-bold text-slate-700">{c.name}</span>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{c.data.length} items</span>
                <button 
                  onClick={() => removeCommerce(c.id)}
                  className="text-slate-400 hover:text-red-500 ml-2 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Table Section */}
        {commerces.length > 0 ? (
          <div className="flex flex-col gap-6">
            {/* Filtros */}
            <section className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Buscar Producto / EAN</label>
                <input 
                  type="text" 
                  placeholder="Ej. Harina, 779..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-900"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Marca</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white text-slate-900"
                  value={filterMarca}
                  onChange={(e) => setFilterMarca(e.target.value)}
                >
                  <option value="">Todas</option>
                  {allBrands.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {allFamilies.length > 0 && (
                <div className="w-full md:w-48">
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Familia</label>
                  <select 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white text-slate-900"
                    value={filterFamilia}
                    onChange={(e) => setFilterFamilia(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {allFamilies.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              <div className="w-full md:w-48">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Tipo</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm bg-white text-slate-900"
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Nacional">Nacional</option>
                  <option value="Propia">Propia</option>
                </select>
              </div>
              {(filterSearch || filterMarca || filterFamilia || filterTipo !== 'Todos' || importedBrandsInput) && (
                <button
                  onClick={() => {
                    setFilterSearch('');
                    setFilterMarca('');
                    setFilterFamilia('');
                    setFilterTipo('Todos');
                    setImportedBrandsInput('');
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100 transition-all whitespace-nowrap h-[42px]"
                  title="Limpiar todos los filtros"
                >
                  <X size={15} />
                  Limpiar filtros
                </button>
              )}
            </section>


            {/* Filter by imported brands */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
              <button 
                onClick={() => setShowImportBrands(!showImportBrands)}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:text-indigo-800 transition-colors"
              >
                <ListFilter size={18} />
                {showImportBrands ? 'Ocultar importación de marcas' : 'Importar Marcas Masivas (Filtro Avanzado)'}
              </button>
              
              {showImportBrands && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Pega una lista de marcas separadas por comas o saltos de línea. El sistema filtrará la tabla y calculará el ranking SOLO para estas marcas.
                  </label>
                  <textarea 
                    className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-slate-900"
                    placeholder="Ej. Marolio, Arcor, La Serenísima..."
                    value={importedBrandsInput}
                    onChange={(e) => setImportedBrandsInput(e.target.value)}
                  ></textarea>
                  {importedBrandsList.length > 0 && (
                    <div className="mt-2 text-sm text-indigo-600 font-medium bg-indigo-50 px-3 py-1.5 rounded-lg inline-block">
                      Filtro activo: {importedBrandsList.length} marcas detectadas
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Summary Section */}
            {filteredProducts.length > 0 && rankingOrdenado.length > 0 && (
               <div className="relative">
                 <button 
                   onClick={exportSummaryToImage}
                   className="absolute -top-12 right-0 flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-200 transition-all text-sm z-10"
                 >
                   <ImageIcon size={16} />
                   Exportar como Imagen
                 </button>
                 <section id="summary-section" className="flex flex-col gap-6 p-6 -mx-4 rounded-2xl bg-slate-50">
                    {/* Header del bloque exportable */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                      <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Comparativa de Supermercados</h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Fecha de comparación: <span className="font-semibold text-slate-700">{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </p>
                      </div>
                      <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        {filteredProducts.length} productos analizados
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 shadow-lg text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                        <Trophy size={120} />
                     </div>
                     <div className="relative z-10">
                       <div className="flex items-center gap-3 mb-4">
                         <div className="bg-white/20 p-2 rounded-xl">
                           <Trophy size={24} className="text-yellow-300" />
                         </div>
                         <h3 className="text-xl font-bold leading-tight">
                           Campeón de Precios
                           {(filterSearch || filterFamilia) && (
                             <span className="text-indigo-200 block text-base font-medium mt-0.5">
                               {[filterSearch, filterFamilia].filter(Boolean).join(' — ')}
                             </span>
                           )}
                         </h3>
                       </div>
                       <p className="text-indigo-100 mb-4 text-sm">
                         Basado en los {filteredProducts.length} productos filtrados, el comercio con mayor cantidad de precios más bajos es:
                       </p>
                       <div className="text-3xl font-black text-white flex items-center gap-2">
                         {rankingOrdenado[0][0]} 
                         <span className="text-lg font-medium text-indigo-200 bg-white/10 px-3 py-1 rounded-full ml-2">
                           {rankingOrdenado[0][1]} ganados
                         </span>
                       </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-100">
                     <div className="flex items-center gap-3 mb-4">
                       <div className="bg-emerald-100 p-2 rounded-xl">
                         <TrendingDown size={24} className="text-emerald-600" />
                       </div>
                       <h3 className="text-lg font-bold text-slate-800 leading-tight">
                         Ranking Completo
                         {(filterSearch || filterFamilia) && (
                           <span className="text-slate-500 block text-sm font-medium mt-0.5">
                             {[filterSearch, filterFamilia].filter(Boolean).join(' — ')}
                           </span>
                         )}
                       </h3>
                     </div>
                     <div className="space-y-3 mt-1">
                       {rankingOrdenado.map(([name, count], idx) => (
                         <div key={name} className="flex flex-col gap-1">
                           <div className="flex items-center justify-between text-sm">
                             <div className="flex items-center gap-2">
                               <span className={`font-bold w-6 text-center ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-400'}`}>#{idx + 1}</span>
                               <span className="font-bold text-slate-700 truncate max-w-[150px] sm:max-w-[200px]" title={name}>{name}</span>
                             </div>
                             <span className="font-medium text-slate-500 whitespace-nowrap">{count} pts ({Math.round((count / totalVictorias) * 100)}%)</span>
                           </div>
                           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((count / totalVictorias) * 100)}%` }}></div>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                    </div>
                  </section>
               </div>
            )}

            {/* Análisis de Fortaleza por Comercio */}
            {commerces.length > 0 && (
              <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Trophy className="text-yellow-500" size={22} />
                      Fortaleza por Comercio
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Seleccioná un comercio para ver en qué familias tiene los precios más bajos</p>
                  </div>
                  <select
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-56"
                    value={selectedAnalysis}
                    onChange={(e) => setSelectedAnalysis(e.target.value)}
                  >
                    <option value="">Seleccionar comercio...</option>
                    {commerces.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {selectedAnalysis && comercioAnalysis.length > 0 && (
                  <div className="p-6">
                    <div className="flex items-center gap-5 mb-6 text-sm flex-wrap">
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>Más barato</span>
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-sky-400 inline-block"></span>Empata precio</span>
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>Único (sin competencia)</span>
                      <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-400 inline-block"></span>Más caro</span>
                      <span className="ml-auto text-xs text-slate-400 italic">↓ Clic para ver detalle</span>
                    </div>
                    <div className="space-y-2">
                      {comercioAnalysis.map(row => {
                        const pctBaratos = Math.round((row.baratos / row.total) * 100);
                        const pctIgual = Math.round((row.igual / row.total) * 100);
                        const pctCaro = Math.round((row.caro / row.total) * 100);
                        const isOpen = selectedFamilyDrillDown === row.familia;
                        return (
                          <div key={row.familia}>
                            <div
                              className={`flex flex-col gap-1.5 p-3 rounded-xl cursor-pointer transition-all border-2 ${isOpen ? 'bg-indigo-50 border-indigo-300' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                              onClick={() => setSelectedFamilyDrillDown(isOpen ? null : row.familia)}
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-bold text-slate-700 truncate max-w-[200px] flex items-center gap-1.5" title={row.familia}>
                                  <ChevronDown size={14} className={`text-indigo-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                                  {row.familia}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                  {row.baratos > 0 && <span className="text-emerald-600 font-bold">{row.baratos} baratos</span>}
                                  {row.igual > 0 && <span className="text-amber-500 font-bold">{row.igual} únicos</span>}
                                  {row.caro > 0 && <span className="text-rose-500 font-bold">{row.caro} caro</span>}
                                  <span className="text-slate-400">({row.total} total)</span>
                                </div>
                              </div>
                              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctBaratos}%` }}></div>
                                <div className="h-full bg-sky-400 transition-all" style={{ width: `${0}%` }}></div>
                                <div className="h-full bg-amber-400 transition-all" style={{ width: `${pctIgual}%` }}></div>
                                <div className="h-full bg-rose-400 transition-all" style={{ width: `${pctCaro}%` }}></div>
                              </div>
                            </div>
                            {isOpen && familyProductsDetail.length > 0 && (
                              <div className="ml-4 mt-1 mb-3 border-l-2 border-indigo-200 pl-4 space-y-2">
                                {familyProductsDetail.map((prod, i) => {
                                  const statusColor = prod.status === 'barato' ? 'border-emerald-400 bg-emerald-50' : prod.status === 'empate' ? 'border-sky-400 bg-sky-50' : prod.status === 'unico' ? 'border-amber-400 bg-amber-50' : 'border-rose-400 bg-rose-50';
                                  const statusIcon = prod.status === 'barato' ? '▲' : prod.status === 'empate' ? '=' : prod.status === 'unico' ? '★' : '▼';
                                  const statusIconColor = prod.status === 'barato' ? 'text-emerald-600' : prod.status === 'empate' ? 'text-sky-600' : prod.status === 'unico' ? 'text-amber-600' : 'text-rose-600';
                                  return (
                                    <div key={i} className={`rounded-lg border-l-4 p-3 ${statusColor}`}>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="font-semibold text-slate-800 text-sm truncate" title={prod.nombre}>{prod.nombre}</p>
                                          <p className="text-xs text-slate-400 font-mono mt-0.5">EAN: {prod.ean}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <span className={`text-lg font-black ${statusIconColor}`}>{statusIcon}</span>
                                          <p className="font-bold text-slate-800 text-sm">${prod.myPrice.toFixed(2)}</p>
                                        </div>
                                      </div>
                                      {prod.status === 'caro' && prod.cheaperCommerces.length > 0 && (
                                        <div className="mt-2 text-xs space-y-0.5">
                                          {prod.cheaperCommerces.map(c => (
                                            <div key={c.name} className="flex justify-between text-slate-600">
                                              <span className="font-medium">{c.name}</span>
                                              <span className="text-rose-600 font-bold">${c.price.toFixed(2)} <span className="text-slate-400">(+${c.diff.toFixed(2)} / +{c.diffPct.toFixed(1)}%)</span></span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {prod.status === 'barato' && prod.cheaperThan.length > 0 && (
                                        <div className="mt-2 text-xs flex flex-wrap gap-1">
                                          <span className="text-slate-500">Más barato que:</span>
                                          {prod.cheaperThan.map(c => <span key={c.name} className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{c.name} ${c.price.toFixed(2)}</span>)}
                                        </div>
                                      )}
                                      {prod.status === 'empate' && prod.tiedWith.length > 0 && (
                                        <div className="mt-2 text-xs flex flex-wrap gap-1">
                                          <span className="text-slate-500">Empata con:</span>
                                          {prod.tiedWith.map(c => <span key={c.name} className="bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium">{c.name}</span>)}
                                        </div>
                                      )}
                                      {prod.status === 'unico' && (
                                        <p className="mt-2 text-xs text-amber-600 font-medium">★ Solo este comercio tiene precio para este producto</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedAnalysis && comercioAnalysis.length === 0 && (
                  <div className="p-10 text-center text-slate-400">
                    <Trophy size={36} className="mx-auto mb-3 text-slate-200" />
                    <p className="font-medium">No hay productos con precio de <strong>{selectedAnalysis}</strong> en el listado actual.</p>
                    <p className="text-sm mt-1">Cambiá los filtros o cargá más datos.</p>
                  </div>
                )}
              </section>
            )}


            {/* Duelo Multi-Comercio — Comparativa Directa */}
            {commerces.length > 1 && (
              <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div
                  className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer"
                  onClick={() => setShowDuel(!showDuel)}
                >
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <span className="text-indigo-600 text-2xl">⚔️</span>
                      Duelo de Precios Multi-Comercio
                      {duelCommerces.length > 0 && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full ml-2">
                          {duelCommerces.length} Comercios Seleccionados
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Elegí múltiples comercios para comparar de forma libre y transversal por artículos específicos o listados generales.</p>
                  </div>
                  <ChevronDown size={20} className={`text-slate-400 transition-transform shrink-0 ${showDuel ? 'rotate-180' : ''}`} />
                </div>
                
                {showDuel && (
                  <div className="p-6">
                    {/* Panel de Gestión de Comercios en Duelo */}
                    <div className="pb-6 border-b border-slate-100">
                      <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Comercios en Duelo</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {duelCommerces.map((name) => (
                          <div key={name} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm">
                            <span>{name}</span>
                            <button
                              onClick={() => setDuelCommerces(duelCommerces.filter(c => c !== name))}
                              className="hover:bg-indigo-100 p-0.5 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
                              title="Quitar del duelo"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        
                        {/* Selector para Agregar más Comercios */}
                        {commerces.some(c => !duelCommerces.includes(c.name)) && (
                          <select
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setDuelCommerces([...duelCommerces, e.target.value]);
                              }
                            }}
                          >
                            <option value="">+ Agregar tienda...</option>
                            {commerces
                              .filter(c => !duelCommerces.includes(c.name))
                              .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                            }
                          </select>
                        )}
                      </div>
                    </div>

                    {duelCommerces.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                        <span className="text-4xl mb-3">⚔️</span>
                        <p className="font-bold text-slate-600">Comenzá el Duelo</p>
                        <p className="text-sm mt-1 max-w-sm">Agregá al menos un comercio arriba para iniciar el duelo transversal de precios.</p>
                      </div>
                    ) : (
                      <div className="mt-6 space-y-6">
                        
                        {/* Configuración de Origen de Productos y Modos de Comparación */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-150 shadow-inner">
                          
                          {/* Col 1: Alcance / Modo */}
                          <div>
                            <label className="block text-xs font-extrabold text-slate-500 mb-2 uppercase tracking-wider">Alcance del Duelo</label>
                            <div className="flex flex-col gap-2">
                              {([
                                { id: 'global', title: 'Todo el Sistema', desc: 'Compara todo el catálogo disponible' },
                                { id: 'filtrado', title: 'Listado Filtrado de Página', desc: 'Compara solo los productos filtrados de la página' },
                                { id: 'articulo', title: 'Artículo Específico', desc: 'Inspecciona un artículo de forma unitaria' }
                              ] as const).map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => {
                                    setDuelProductMode(opt.id);
                                    if (opt.id === 'articulo' && filteredProducts.length > 0 && !duelSelectedEan) {
                                      setDuelSelectedEan(filteredProducts[0].ean || '');
                                    }
                                  }}
                                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                                    duelProductMode === opt.id
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="font-bold text-xs">{opt.title}</div>
                                  <div className={`text-[10px] mt-0.5 ${duelProductMode === opt.id ? 'text-indigo-100' : 'text-slate-400'}`}>{opt.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Col 2: Buscador o Selector de Artículo Específico */}
                          <div className="lg:col-span-2 flex flex-col justify-between">
                            {duelProductMode === 'articulo' ? (
                              <div className="h-full flex flex-col justify-start">
                                <label className="block text-xs font-extrabold text-slate-500 mb-2 uppercase tracking-wider">Seleccionar Artículo para Análisis</label>
                                <select
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white shadow-sm"
                                  value={duelSelectedEan}
                                  onChange={(e) => setDuelSelectedEan(e.target.value)}
                                >
                                  <option value="">Seleccioná un producto del listado...</option>
                                  {filteredProducts.map(p => (
                                    <option key={p.ean} value={p.ean}>
                                      {p.nombre} ({p.marca || 'Sin marca'}) - EAN: {p.ean}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[11px] text-slate-400 mt-2 italic">
                                  El listado está restringido por los filtros activos en la página (se muestran {filteredProducts.length} productos).
                                </p>
                              </div>
                            ) : (
                              <div className="h-full flex flex-col justify-start">
                                <label className="block text-xs font-extrabold text-slate-500 mb-2 uppercase tracking-wider">Buscar por término dentro del Duelo</label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Ej: harina, aceite, marca..."
                                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-950 bg-white"
                                    value={duelSearch}
                                    onChange={(e) => setDuelSearch(e.target.value)}
                                  />
                                  {(duelSearch || duelShowOnly !== 'todos') && (
                                    <button
                                      onClick={() => {
                                        setDuelSearch('');
                                        setDuelShowOnly('todos');
                                      }}
                                      className="px-4 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 border border-rose-200"
                                    >
                                      <X size={14} />
                                      Limpiar
                                    </button>
                                  )}
                                </div>
                                <div className="mt-4">
                                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Filtro por Tipo</label>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {(['todos', 'compartidos', 'soloA', 'soloB'] as const).map((opt) => {
                                      const labels: Record<string, string> = {
                                        todos: 'Todos',
                                        compartidos: 'Compartidos (2+ Tiendas)',
                                        soloA: duelCommerces[0] ? `Exclusivo ${duelCommerces[0]}` : 'Exclusivo A',
                                        soloB: duelCommerces[1] ? `Exclusivo ${duelCommerces[1]}` : 'Exclusivo B',
                                      };
                                      return (
                                        <button
                                          key={opt}
                                          onClick={() => setDuelShowOnly(opt)}
                                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                            duelShowOnly === opt
                                              ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                          }`}
                                        >
                                          {labels[opt]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botones de Exportación */}
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={exportDuelToExcel}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 transition-all text-xs shadow-sm"
                          >
                            <FileSpreadsheet size={14} />
                            Exportar Excel
                          </button>
                          <button
                            onClick={exportDuelToPdf}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition-all text-xs shadow-sm"
                          >
                            <FileText size={14} />
                            Exportar PDF
                          </button>
                          <button
                            onClick={exportDuelToImage}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 transition-all text-xs shadow-sm"
                          >
                            <ImageIcon size={14} />
                            Exportar Imagen
                          </button>
                        </div>

                        {/* Contenedor principal de Resultados */}
                        <div id="duel-results-container" className="space-y-6 bg-slate-50/20 p-4 rounded-3xl border border-slate-100">
                          
                          {/* Ficha de Análisis Unitario para Modo Artículo Específico */}
                          {duelProductMode === 'articulo' && duelResults && duelResults.products[0] && (
                            (() => {
                              const prod = duelResults.products[0];
                              const pricesList = Object.entries(prod.prices).sort((a, b) => a[1] - b[1]);
                              const cheapest = pricesList[0];
                              const expensive = pricesList[pricesList.length - 1];
                              const range = expensive[1] - cheapest[1];
                              const rangePct = cheapest[1] > 0 ? (range / cheapest[1]) * 100 : 0;
                              
                              return (
                                <div className="bg-white rounded-3xl p-6 border border-slate-150 shadow-md">
                                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                                    <div>
                                      <div className="flex flex-wrap gap-2 items-center">
                                        <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Ficha de Análisis</span>
                                        {prod.marca && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{prod.marca}</span>}
                                        {prod.familia && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{prod.familia}</span>}
                                      </div>
                                      <h3 className="text-xl font-black text-slate-900 mt-2">{prod.nombre}</h3>
                                      <p className="text-xs text-slate-400 mt-1">Código de barras (EAN): <span className="font-bold font-mono text-slate-600">{prod.ean}</span></p>
                                    </div>
                                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-right">
                                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Mejor precio disponible</p>
                                      <p className="text-2xl font-black text-emerald-600 mt-1">${cheapest[1].toFixed(2)}</p>
                                      <p className="text-[10px] text-emerald-500 mt-0.5 font-medium">En {cheapest[0]}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                                    {/* Gráfico Comparativo Dinámico de Barras Horizontales */}
                                    <div className="space-y-4">
                                      <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Gráfico Comparativo de Precios</h4>
                                      <div className="space-y-3">
                                        {duelCommerces.map((cName) => {
                                          const pr = prod.prices[cName];
                                          const isCheapest = pr === cheapest[1];
                                          const isExpensive = pr === expensive[1];
                                          const pctWidth = expensive[1] > 0 ? (pr / expensive[1]) * 100 : 0;
                                          
                                          if (pr == null) {
                                            return (
                                              <div key={cName} className="flex justify-between items-center text-slate-300 text-xs py-1 border-b border-dashed border-slate-100">
                                                <span className="font-bold">{cName}</span>
                                                <span className="italic">No disponible</span>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div key={cName} className="space-y-1">
                                              <div className="flex justify-between items-center text-xs">
                                                <span className={`font-bold ${isCheapest ? 'text-emerald-600' : isExpensive ? 'text-rose-600' : 'text-slate-700'}`}>{cName}</span>
                                                <span className="font-black text-slate-800">
                                                  ${pr.toFixed(2)}
                                                  {isCheapest && <span className="text-[10px] text-emerald-500 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded ml-1 font-bold">El más barato</span>}
                                                </span>
                                              </div>
                                              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full transition-all duration-500 ${
                                                    isCheapest
                                                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                                      : isExpensive
                                                      ? 'bg-gradient-to-r from-rose-400 to-rose-500'
                                                      : 'bg-gradient-to-r from-slate-400 to-slate-500'
                                                  }`}
                                                  style={{ width: `${pctWidth}%` }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Resumen & Tarjeta de Ahorro Proyectado */}
                                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between">
                                      <div>
                                        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Ahorro y Dispersión de Precios</h4>
                                        {range > 0 ? (
                                          <div className="mt-3 space-y-2">
                                            <p className="text-sm text-slate-700">
                                              La diferencia de precios para este producto es de <strong className="text-rose-600">${range.toFixed(2)}</strong> o un <strong className="text-rose-600">{rangePct.toFixed(1)}%</strong> entre la opción más económica y la más costosa.
                                            </p>
                                            <p className="text-xs text-slate-500">
                                              Te conviene comprar en <strong className="text-slate-800">{cheapest[0]}</strong> en lugar de <strong className="text-slate-800">{expensive[0]}</strong>.
                                            </p>
                                          </div>
                                        ) : (
                                          <p className="text-sm text-slate-600 mt-3 font-medium">El precio es idéntico en todos los comercios comparados.</p>
                                        )}
                                      </div>
                                      
                                      <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400">Estado de Marca</span>
                                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${prod.tipo_marca === 'Propia' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                                          Marca {prod.tipo_marca || 'Nacional'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          )}

                          {/* Estadísticas de Duelo General o Filtrado */}
                          {duelProductMode !== 'articulo' && duelResults && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Tarjeta 1: Líder de precios */}
                              <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-md flex flex-col justify-between">
                                <div>
                                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Líder del Duelo</p>
                                  <h3 className="text-xl font-black mt-1">
                                    {duelResults.isLeaderTie ? '¡Empate Técnico!' : duelResults.leaderStore}
                                  </h3>
                                </div>
                                <p className="text-xs text-indigo-100 mt-4">
                                  {duelResults.isLeaderTie
                                    ? 'Múltiples comercios empatan en la mayor cantidad de precios más bajos.'
                                    : `Tiene el mejor precio en ${duelResults.maxWins} productos comparados.`}
                                </p>
                              </div>

                              {/* Tarjeta 2: Marcador completo de victorias */}
                              <div className="bg-white border border-slate-150 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                                <div>
                                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Victorias Individuales</p>
                                  <div className="mt-3 space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                    {duelCommerces.map(cName => (
                                      <div key={cName} className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                                        <span className="font-semibold text-slate-700 truncate max-w-[150px]">{cName}</span>
                                        <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                          {duelResults.winsMap[cName] || 0} victorias
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Tarjeta 3: Costo de Compra Agregada / Carrito */}
                              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                                <div>
                                  <p className="text-emerald-800 text-xs font-bold uppercase tracking-wider">Costo Compra Agregada</p>
                                  <div className="mt-3 space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                    {duelCommerces.map(cName => {
                                      const cartVal = duelResults.cartCosts[cName];
                                      return (
                                        <div key={cName} className="flex justify-between items-center text-xs py-1 border-b border-emerald-100/50">
                                          <span className="font-semibold text-emerald-800 truncate max-w-[150px]">{cName}</span>
                                          <span className="font-black text-emerald-700">
                                            {cartVal > 0 ? `$${cartVal.toFixed(2)}` : 'Sin datos'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                                <p className="text-[10px] text-emerald-600 mt-2">
                                  Suma para los <strong>{duelResults.commonCount}</strong> artículos con stock y precios en todos los comercios elegidos.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Listado de Productos en Duelo */}
                          {duelProductMode !== 'articulo' && (
                            <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-sm">
                              <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left border-collapse text-sm">
                                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 text-xs text-slate-500 uppercase tracking-wider font-bold">
                                    <tr>
                                      <th className="p-4 min-w-[240px]">Producto / Detalle</th>
                                      {duelCommerces.map((cName) => (
                                        <th key={cName} className="p-4 text-right min-w-[130px] font-extrabold text-indigo-700 bg-indigo-50/20">{cName}</th>
                                      ))}
                                      <th className="p-4 text-right min-w-[150px]">Mejor Opción</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {duelFiltered.map((p, i) => {
                                      const priceValues = Object.values(p.prices);
                                      const cheapestPrice = Math.min(...priceValues);
                                      
                                      return (
                                        <tr key={`${p.ean}-${i}`} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4">
                                            <p className="font-semibold text-slate-800 truncate max-w-[300px]" title={p.nombre}>{p.nombre}</p>
                                            <p className="text-xs text-slate-400 mt-1">EAN: {p.ean} · {p.marca} · {p.familia}</p>
                                          </td>
                                          {duelCommerces.map((cName) => {
                                            const pr = p.prices[cName];
                                            if (pr == null) {
                                              return (
                                                <td key={cName} className="p-4 text-right text-slate-300 italic">
                                                  No disp.
                                                </td>
                                              );
                                            }
                                            
                                            const isCheapest = pr === cheapestPrice;
                                            return (
                                              <td key={cName} className={`p-4 text-right font-semibold ${isCheapest ? 'bg-emerald-50/10' : ''}`}>
                                                <span className={isCheapest ? 'text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg' : 'text-slate-700'}>
                                                  ${pr.toFixed(2)}
                                                </span>
                                              </td>
                                            );
                                          })}
                                          <td className="p-4 text-right font-bold">
                                            {p.isTiedCheapest ? (
                                              <span className="text-sky-600 bg-sky-50 px-2.5 py-0.5 border border-sky-100 rounded-lg text-xs font-bold inline-block">Empate</span>
                                            ) : (
                                              <div>
                                                <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg text-xs block font-extrabold truncate max-w-[120px] ml-auto">
                                                  {p.cheapestCommerce}
                                                </span>
                                                {p.priceDiffPct ? (
                                                  <p className="text-[10px] text-slate-400 mt-0.5 font-normal">Dif Max: +{p.priceDiffPct.toFixed(1)}%</p>
                                                ) : null}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {duelFiltered.length === 0 && (
                                      <tr>
                                        <td colSpan={duelCommerces.length + 2} className="p-12 text-center text-slate-400">
                                          <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                                          <p className="font-medium text-slate-500">No se encontraron productos en el Duelo para los criterios seleccionados.</p>
                                          <p className="text-xs mt-1">Intentá cambiar los filtros de marca/familia, o agregá más tiendas.</p>
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Marcas Propias — Comparativa entre Comercios */}

            {commerces.length > 1 && (
              <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div
                  className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer"
                  onClick={() => setShowMarcasPropias(!showMarcasPropias)}
                >
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <Star className="text-purple-500" size={22} />
                      Duelo de Marcas Propias Homologado
                      <span className="text-sm font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full ml-1">
                        {marcasPropiasComparative.length} productos
                      </span>
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Compará marcas propias (Dia, Coto, Carrefour, etc.) normalizando su precio por Litro o Kilogramo.</p>
                  </div>
                  <ChevronDown size={20} className={`text-slate-400 transition-transform shrink-0 ${showMarcasPropias ? 'rotate-180' : ''}`} />
                </div>
                {showMarcasPropias && (
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-3 mb-5">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          placeholder="Ingresá un término para comparar marcas propias (ej: cola, fideos, leche)..."
                          className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-slate-950 bg-white"
                          value={marcasPropiasSearch}
                          onChange={e => setMarcasPropiasSearch(e.target.value)}
                        />
                        {marcasPropiasSearch && (
                          <button 
                            onClick={() => setMarcasPropiasSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold animate-fade-in"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Ordenar por:</span>
                        <select
                          value={marcasPropiasSortBy}
                          onChange={e => setMarcasPropiasSortBy(e.target.value as any)}
                          className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        >
                          <option value="unitPrice">Precio Normalizado ($/Kg o $/L)</option>
                          <option value="price">Precio de Lista</option>
                          <option value="nombre">Nombre (A-Z)</option>
                        </select>
                      </div>
                    </div>

                    {/* Sugerencias de búsqueda rápida */}
                    <div className="flex flex-wrap gap-2 mb-6 items-center">
                      <span className="text-xs text-slate-400 font-medium">Búsquedas rápidas:</span>
                      {['Cola', 'Leche', 'Fideos', 'Azúcar', 'Harina', 'Aceite', 'Arroz', 'Puré', 'Galletitas', 'Jabón'].map(term => (
                        <button
                          key={term}
                          onClick={() => setMarcasPropiasSearch(term)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                            marcasPropiasSearch.toLowerCase() === term.toLowerCase()
                              ? 'bg-purple-600 text-white border-purple-600 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {term}
                        </button>
                      ))}
                    </div>

                    {!marcasPropiasSearch ? (
                      <div className="bg-slate-50 rounded-2xl p-6 text-center border border-dashed border-slate-200">
                        <Star className="text-purple-300 w-10 h-10 mx-auto mb-3 animate-pulse" />
                        <h3 className="font-bold text-slate-700 mb-1">Duelo de Marcas Propias</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          Las marcas propias tienen códigos de barras y descripciones diferentes. 
                          Ingresá un término de búsqueda (como <strong>"cola"</strong>) arriba o usá las sugerencias rápidas para normalizar sus precios y compararlos de forma justa.
                        </p>
                      </div>
                    ) : marcasPropiasComparative.length === 0 ? (
                      <div className="text-center text-slate-400 py-8">
                        <AlertCircle size={36} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-medium text-slate-600">No se encontraron productos de marca propia para "{marcasPropiasSearch}".</p>
                        <p className="text-xs mt-1">Asegurate de que las marcas de las cadenas cargadas estén marcadas como propia en el CSV.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Winner Banner Card */}
                        {marcasPropiasComparative.length > 1 && (() => {
                          const cheapest = marcasPropiasComparative[0];
                          const mostExpensive = marcasPropiasComparative[marcasPropiasComparative.length - 1];
                          const savingsPct = mostExpensive.unitPrice > 0 
                            ? ((mostExpensive.unitPrice - cheapest.unitPrice) / mostExpensive.unitPrice) * 100 
                            : 0;

                          return (
                            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
                                  <Trophy size={24} />
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Opción más barata
                                  </span>
                                  <h4 className="font-extrabold text-slate-800 text-base mt-1">
                                    {cheapest.nombre}
                                  </h4>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Cadena: <strong className="text-slate-700">{cheapest.storeName}</strong> ({cheapest.displaySize})
                                  </p>
                                </div>
                              </div>
                              <div className="text-left md:text-right shrink-0">
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Precio Unitario Normalizado</p>
                                <p className="text-2xl font-black text-emerald-600">{cheapest.displayUnitPrice}</p>
                                {savingsPct > 0 && (
                                  <p className="text-xs text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded mt-1 inline-block">
                                    Ahorro de hasta {savingsPct.toFixed(1)}% por unidad de medida
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Results Table */}
                        <div className="overflow-x-auto border border-slate-100 rounded-xl">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                                <th className="p-3 font-bold text-center w-12">Puesto</th>
                                <th className="p-3 font-bold">Producto / Marca</th>
                                <th className="p-3 font-bold">Supermercado</th>
                                <th className="p-3 font-bold text-center">Medida</th>
                                <th className="p-3 font-bold text-right">Precio Lista</th>
                                <th className="p-3 font-bold text-right text-purple-700 bg-purple-50/50">Precio Normalizado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {marcasPropiasComparative.map((p, i) => {
                                const isFirst = i === 0;
                                const isLast = i === marcasPropiasComparative.length - 1 && marcasPropiasComparative.length > 1;
                                
                                // Color helper for table tags
                                const getChainColor = (chain: string) => {
                                  const c = chain.toLowerCase();
                                  if (c.includes('dia')) return 'bg-red-100 text-red-700 border-red-200';
                                  if (c.includes('coto')) return 'bg-blue-100 text-blue-700 border-blue-200';
                                  if (c.includes('carrefour') || c.includes('inc')) return 'bg-sky-100 text-sky-700 border-sky-200';
                                  if (c.includes('vea')) return 'bg-green-100 text-green-700 border-green-200';
                                  if (c.includes('disco')) return 'bg-red-50 text-red-800 border-red-200';
                                  if (c.includes('chango')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                  return 'bg-slate-100 text-slate-700 border-slate-200';
                                };

                                return (
                                  <tr key={i} className={`hover:bg-slate-50/50 transition-colors ${isFirst ? 'bg-emerald-50/10' : ''}`}>
                                    <td className="p-3 text-center font-black">
                                      {isFirst ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-400 text-yellow-900 text-xs shadow-sm">🥇</span>
                                      ) : i === 1 ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-800 text-xs shadow-sm">🥈</span>
                                      ) : i === 2 ? (
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-amber-50 text-xs shadow-sm">🥉</span>
                                      ) : (
                                        <span className="text-slate-400 text-xs">#{i + 1}</span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <p className="font-semibold text-slate-800 leading-tight">{p.nombre}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">Marca: {p.marca || 'N/D'} · EAN: {p.ean}</p>
                                    </td>
                                    <td className="p-3">
                                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${getChainColor(p.storeName)}`}>
                                        {p.storeName}
                                      </span>
                                    </td>
                                    <td className="p-3 text-center text-xs font-medium text-slate-600">
                                      {p.displaySize}
                                    </td>
                                    <td className="p-3 text-right font-bold text-slate-700">
                                      ${p.price.toFixed(2)}
                                    </td>
                                    <td className={`p-3 text-right font-extrabold text-sm ${
                                      isFirst 
                                        ? 'text-emerald-600 bg-emerald-50/20' 
                                        : isLast 
                                          ? 'text-rose-600 bg-rose-50/10' 
                                          : 'text-slate-800 bg-purple-50/10'
                                    }`}>
                                      {p.displayUnitPrice}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4 bg-slate-50/50">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Tag className="text-indigo-500" size={24} />
                    Tabla Comparativa
                    <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full ml-2">
                      {filteredProducts.length} productos
                    </span>
                  </h2>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-all text-sm w-full md:w-auto"
                    >
                      <FileSpreadsheet size={16} />
                      Exportar Excel
                    </button>
                    <button 
                      onClick={exportToPdf}
                      disabled={isExportingPdf}
                      className={`flex items-center justify-center gap-2 px-4 py-2 font-bold rounded-xl border transition-all text-sm w-full md:w-auto ${isExportingPdf ? 'bg-rose-100 text-rose-400 border-rose-200 cursor-not-allowed' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                    >
                      {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      {isExportingPdf ? 'Generando PDF...' : 'Exportar PDF'}
                    </button>
                  </div>
               </div>
               <div className="overflow-x-auto max-h-[800px]">
                 <table className="w-full text-left border-collapse relative">
                   <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-sm text-slate-500 uppercase tracking-wider z-10 shadow-sm">
                     <tr>
                       <th className="p-4 font-bold">Producto</th>
                       <th className="p-4 font-bold">EAN / Marca</th>
                       <th className="p-4 font-bold text-center">Tipo</th>
                       {commerces.map(c => (
                         <th key={c.id} className="p-4 font-bold text-right text-indigo-700 bg-indigo-50/30">
                           {c.name}
                         </th>
                       ))}
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 text-slate-700">
                     {filteredProducts.slice(0, 500).map((product, idx) => (
                       <tr key={idx} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 max-w-[250px]">
                            <div className="font-medium truncate" title={product.nombre}>{product.nombre}</div>
                            {product.familia && <div className="text-xs text-slate-400 mt-1 truncate">{product.familia}</div>}
                         </td>
                         <td className="p-4">
                            <div className="font-mono text-sm text-slate-500">{product.ean}</div>
                            {product.marca && <div className="text-xs text-slate-400 mt-1 truncate max-w-[120px]" title={product.marca}>{product.marca}</div>}
                         </td>
                         <td className="p-4 text-center">
                           <span className={`text-xs font-bold px-2 py-1 rounded-md ${product.tipo_marca === 'Propia' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                             {product.tipo_marca}
                           </span>
                         </td>
                         {commerces.map(c => {
                           const price = product.prices[c.name];
                           const allPrices = Object.values(product.prices);
                           const isLowest = price && allPrices.length > 1 && price === Math.min(...allPrices);

                           return (
                             <td key={c.id} className="p-4 text-right font-medium">
                               {price ? (
                                 <span className={isLowest ? 'text-green-600 font-bold flex items-center justify-end gap-1' : ''}>
                                   {isLowest && <span className="text-green-500 text-xs">▼</span>}
                                   ${price.toFixed(2)}
                                 </span>
                               ) : (
                                 <span className="text-slate-300">-</span>
                               )}
                             </td>
                           )
                         })}
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {filteredProducts.length > 500 && (
                    <div className="p-4 text-center text-slate-500 text-sm border-t border-slate-100 bg-slate-50">
                      Mostrando los primeros 500 resultados. Usa los filtros para refinar la búsqueda.
                    </div>
                 )}
               </div>
               {filteredProducts.length === 0 && (
                 <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                   <ShoppingBag size={48} className="text-slate-300 mb-4" />
                   <p className="font-medium">No se encontraron productos.</p>
                   <p className="text-sm mt-1">Prueba cambiando los filtros o la búsqueda.</p>
                 </div>
               )}
            </section>
          </div>
        ) : (
          <div className="bg-indigo-50 rounded-3xl border border-indigo-100 p-12 text-center flex flex-col items-center">
             <Upload size={48} className="text-indigo-300 mb-4" />
             <h3 className="text-xl font-bold text-indigo-900 mb-2">Comienza tu Comparativa</h3>
             <p className="text-indigo-600 max-w-md">
               Agrega al menos un comercio y su archivo CSV para comenzar a ver el listado de productos y comparar precios.
             </p>
          </div>
        )}
      </main>
    </div>
  );
}
