export async function scrapeEAN(ean: string) {
  try {
    // Calling the FastAPI server
    // It will use the environment variable on Vercel, or localhost locally
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    
    const res = await fetch(`${baseUrl}/scrape/${ean}`);
    if (!res.ok) {
      throw new Error(`Scraper API returned ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error calling scraper API:", error);
    return null;
  }
}
