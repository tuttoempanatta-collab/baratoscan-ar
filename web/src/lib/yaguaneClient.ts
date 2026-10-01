export interface ScrapedProduct {
  ean: string;
  nombre?: string;
  precio?: number | null;
  precio_oferta?: number | null;
  imagen_url?: string | null;
  cadena: string;
  timestamp: string;
  url_producto?: string | null;
  error?: string | null;
}

export async function scrapeYaguane(query: string): Promise<ScrapedProduct | null> {
  const cleanQuery = query.trim();
  const isEan = /^\d+$/.test(cleanQuery) && cleanQuery.length >= 8;

  // Yaguane does not support barcode/EAN searches directly
  if (isEan) {
    return {
      ean: cleanQuery,
      cadena: 'Yaguané',
      timestamp: new Date().toISOString(),
      precio: null,
      error: 'Yaguané no admite búsqueda por código de barras'
    };
  }

  if (!cleanQuery) return null;

  try {
    const url = `https://yaguaneonline.com.ar/backonline/api/Catalogo/GetCatalagoSeleccionado?idCatalogo=1042&filter=${encodeURIComponent(cleanQuery)}&page=1&pageSize=20&idInstalacion=3`;

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://yaguaneonline.com.ar/',
        'Origin': 'https://yaguaneonline.com.ar',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return {
        ean: cleanQuery,
        cadena: 'Yaguané',
        timestamp: new Date().toISOString(),
        precio: null,
        error: `Error HTTP ${res.status}`
      };
    }

    const data = await res.json();
    const sections = data?.listadoSecciones;
    if (!sections || !Array.isArray(sections)) {
      return {
        ean: cleanQuery,
        cadena: 'Yaguané',
        timestamp: new Date().toISOString(),
        precio: null,
        error: 'No disponible'
      };
    }

    const allArticles: any[] = [];
    for (const sec of sections) {
      for (const art of sec.listaArticulos || []) {
        if (art.activo && (art.stockDisponible === null || art.stockDisponible > 0)) {
          allArticles.push(art);
        }
      }
    }

    if (allArticles.length === 0) {
      return {
        ean: cleanQuery,
        cadena: 'Yaguané',
        timestamp: new Date().toISOString(),
        precio: null,
        error: 'Producto no encontrado'
      };
    }

    // Rank articles by query term match score
    const queryWords = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    allArticles.sort((a, b) => {
      const aName = (a.nombre || '').toLowerCase();
      const bName = (b.nombre || '').toLowerCase();
      let aScore = 0;
      let bScore = 0;
      for (const w of queryWords) {
        if (aName.includes(w)) aScore++;
        if (bName.includes(w)) bScore++;
      }
      return bScore - aScore;
    });

    const best = allArticles[0];
    const precioPromo = best.precioPromocional ? Number(best.precioPromocional) : null;
    const precioLista = best.precioLista ? Number(best.precioLista) : null;

    let finalPrice: number | null = null;
    let finalOffer: number | null = null;

    if (precioPromo && precioPromo > 0 && (!precioLista || precioPromo < precioLista)) {
      finalPrice = precioPromo;
      finalOffer = precioPromo;
    } else if (precioLista && precioLista > 0) {
      finalPrice = precioLista;
      finalOffer = null;
    }

    let imagenUrl: string | null = null;
    if (best.listaImagenesArticulos && best.listaImagenesArticulos.length > 0) {
      const rawPath = best.listaImagenesArticulos[0].path;
      if (rawPath) {
        imagenUrl = rawPath.replace(/\\/g, '/');
      }
    }

    const productFilter = best.nombre || cleanQuery;
    return {
      ean: cleanQuery,
      cadena: 'Yaguané',
      nombre: best.nombre,
      precio: finalPrice,
      precio_oferta: finalOffer,
      imagen_url: imagenUrl,
      url_producto: `https://yaguaneonline.com.ar/#/?filter=${encodeURIComponent(productFilter)}`,
      timestamp: new Date().toISOString(),
      error: finalPrice ? null : 'Precio no disponible'
    };
  } catch (err: any) {
    console.error('Error scraping Yaguane in Next.js:', err);
    return {
      ean: cleanQuery,
      cadena: 'Yaguané',
      timestamp: new Date().toISOString(),
      precio: null,
      error: 'Error de conexión'
    };
  }
}
