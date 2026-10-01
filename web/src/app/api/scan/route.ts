import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeEAN } from '@/lib/scraperClient';
import { scrapeYaguane } from '@/lib/yaguaneClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('query') || searchParams.get('ean'); // Support both for backwards compatibility

  if (!rawQuery) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  const query = rawQuery.trim().toLowerCase();

  try {
    // 1. Check Supabase for recent records (< 24h)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: existingData, error: dbError } = await supabase
      .from('prices')
      .select('*')
      .eq('ean', query) // Using query as EAN for caching purposes
      .gte('timestamp', twentyFourHoursAgo.toISOString());

    if (dbError) {
      console.error('Supabase query error:', dbError);
    }

    const isEan = /^\d+$/.test(rawQuery.trim()) && rawQuery.trim().length >= 8;

    if (existingData && existingData.length > 0) {
      const yaguaneIndex = existingData.findIndex((item: { cadena: string }) => item.cadena?.toLowerCase().includes('yaguan'));
      if (isEan) {
        const yaguaneEanItem = {
          ean: rawQuery.trim(),
          cadena: 'Yaguané',
          timestamp: new Date().toISOString(),
          precio: null,
          error: 'Yaguané no admite búsqueda por código de barras'
        };
        if (yaguaneIndex >= 0) {
          existingData[yaguaneIndex] = yaguaneEanItem;
        } else {
          existingData.push(yaguaneEanItem);
        }
      } else if (yaguaneIndex < 0) {
        try {
          const yaguaneItem = await scrapeYaguane(rawQuery);
          if (yaguaneItem) {
            existingData.push(yaguaneItem);
            if (!yaguaneItem.error && yaguaneItem.precio !== null) {
              const toInsert = {
                ean: yaguaneItem.ean,
                cadena: yaguaneItem.cadena,
                nombre: yaguaneItem.nombre,
                precio: yaguaneItem.precio,
                precio_oferta: yaguaneItem.precio_oferta || null,
                imagen_url: yaguaneItem.imagen_url || null,
                url_producto: yaguaneItem.url_producto || null,
                timestamp: yaguaneItem.timestamp
              };
              await supabase.from('prices').insert([toInsert]);
            }
          }
        } catch (e) {
          console.error('Error fetching Yaguane for cached query:', e);
        }
      }
      console.log(`Returning ${existingData.length} existing records for Query: ${query}`);
      return NextResponse.json(existingData);
    }

    // 2. If no recent data, call the Python Scraper API
    console.log(`No recent data found. Scraping live for Query: ${query}`);
    const scrapedData = await scrapeEAN(rawQuery);

    const finalResults = Array.isArray(scrapedData) ? [...scrapedData] : [];

    // Ensure Yaguané is properly handled
    const yaguaneIndex = finalResults.findIndex((item: { cadena: string }) => item.cadena?.toLowerCase().includes('yaguan'));
    if (isEan) {
      const yaguaneEanItem = {
        ean: rawQuery.trim(),
        cadena: 'Yaguané',
        timestamp: new Date().toISOString(),
        precio: null,
        error: 'Yaguané no admite búsqueda por código de barras'
      };
      if (yaguaneIndex >= 0) {
        finalResults[yaguaneIndex] = yaguaneEanItem;
      } else {
        finalResults.push(yaguaneEanItem);
      }
    } else if (yaguaneIndex < 0 || finalResults[yaguaneIndex].precio === null) {
      try {
        const yaguaneItem = await scrapeYaguane(rawQuery);
        if (yaguaneItem) {
          if (yaguaneIndex >= 0) {
            finalResults[yaguaneIndex] = yaguaneItem;
          } else {
            finalResults.push(yaguaneItem);
          }
        }
      } catch (e) {
        console.error('Error fetching Yaguane in live scrape:', e);
      }
    }

    if (finalResults.length === 0) {
      return NextResponse.json({ error: 'Failed to scrape data' }, { status: 500 });
    }

    // 3. Save new data to Supabase
    // We only insert valid records (where there's no error from the scraper)
    const validRecords = finalResults
      .filter((item: any) => !item.error && item.precio !== null)
      .map((item: any) => ({
        ean: item.ean,
        cadena: item.cadena,
        nombre: item.nombre,
        precio: item.precio,
        precio_oferta: item.precio_oferta || null,
        imagen_url: item.imagen_url || null,
        url_producto: item.url_producto || null,
        timestamp: item.timestamp || new Date().toISOString()
      }));
    
    if (validRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('prices')
        .insert(validRecords);

      if (insertError) {
        console.error('Error inserting to Supabase:', insertError);
      }
    }

    // Return the full result (including ones with errors so frontend knows which failed)
    return NextResponse.json(finalResults);

  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

