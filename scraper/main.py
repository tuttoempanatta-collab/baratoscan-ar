import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Import scrapers
from chains.dia import DiaScraper
from chains.coto import CotoScraper
from chains.disco import DiscoScraper
from chains.changomas import ChangoMasScraper
from chains.carrefour import CarrefourScraper
from chains.vea import VeaScraper
from chains.diarco import DiarcoScraper

app = FastAPI(title="BaratoScan Scraper API")

class ScrapeResponse(BaseModel):
    ean: str
    nombre: Optional[str] = None
    precio: Optional[float] = None
    precio_oferta: Optional[float] = None
    imagen_url: Optional[str] = None
    cadena: str
    timestamp: str
    url_producto: Optional[str] = None
    error: Optional[str] = None

@app.get("/scrape/{ean}", response_model=List[ScrapeResponse])
async def scrape_product(ean: str):
    scrapers = [
        DiaScraper(),
        CotoScraper(),
        DiscoScraper(),
        ChangoMasScraper(),
        CarrefourScraper(),
        VeaScraper(),
        DiarcoScraper()
    ]
    
    # Run all scrapers concurrently
    results = await asyncio.gather(*(scraper.scrape(ean) for scraper in scrapers), return_exceptions=True)
    
    parsed_results = []
    for i, res in enumerate(results):
        chain_name = scrapers[i].chain_name
        if isinstance(res, Exception):
            parsed_results.append(ScrapeResponse(
                ean=ean,
                cadena=chain_name,
                timestamp=datetime.now().isoformat(),
                error=str(res)
            ))
        elif res is None:
            parsed_results.append(ScrapeResponse(
                ean=ean,
                cadena=chain_name,
                timestamp=datetime.now().isoformat(),
                error="Product not found or failed to scrape"
            ))
        else:
            parsed_results.append(ScrapeResponse(**res))
            
    return parsed_results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
