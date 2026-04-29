export async function scrapeEAN(ean: string) {
  try {
    // Calling the FastAPI server running locally
    const res = await fetch(`http://127.0.0.1:8000/scrape/${ean}`);
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
