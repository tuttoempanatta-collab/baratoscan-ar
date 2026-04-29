import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeEAN } from '@/lib/scraperClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ean = searchParams.get('ean');

  if (!ean) {
    return NextResponse.json({ error: 'EAN is required' }, { status: 400 });
  }

  try {
    // 1. Check Supabase for recent records (< 24h)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: existingData, error: dbError } = await supabase
      .from('prices')
      .select('*')
      .eq('ean', ean)
      .gte('timestamp', twentyFourHoursAgo.toISOString());

    if (dbError) {
      console.error('Supabase query error:', dbError);
    }

    if (existingData && existingData.length > 0) {
      // If we have recent data from at least one chain (in a real app, you might want to ensure we have data for ALL chains, but for MVP this is fine, or we can just fetch all)
      console.log(`Returning ${existingData.length} existing records for EAN: ${ean}`);
      return NextResponse.json(existingData);
    }

    // 2. If no recent data, call the Python Scraper API
    console.log(`No recent data found. Scraping live for EAN: ${ean}`);
    const scrapedData = await scrapeEAN(ean);

    if (!scrapedData) {
      return NextResponse.json({ error: 'Failed to scrape data' }, { status: 500 });
    }

    // 3. Save new data to Supabase
    // We only insert valid records (where there's no error from the scraper)
    const validRecords = scrapedData.filter((item: any) => !item.error && item.precio !== null);
    
    if (validRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('prices')
        .insert(validRecords);

      if (insertError) {
        console.error('Error inserting to Supabase:', insertError);
      }
    }

    // Return the full result (including ones with errors so frontend knows which failed)
    return NextResponse.json(scrapedData);

  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
