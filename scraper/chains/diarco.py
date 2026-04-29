import httpx
import re
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper

class DiarcoScraper(BaseScraper):
    chain_name = "Diarco"
    base_url = "https://www.diarco.com.ar"

    async def _perform_scrape(self, client: httpx.AsyncClient, ean: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/catalogsearch/result/?q={ean}"
        
        response = await client.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        nombre_element = soup.select_one('a.product-item-link')
        if not nombre_element:
            return None
            
        nombre = nombre_element.get_text(strip=True)
        
        precio_element = soup.select_one('span.price')
        precio = self._parse_price(precio_element.get_text(strip=True)) if precio_element else None
        
        img_element = soup.select_one('img.product-image-photo')
        imagen_url = img_element.get('src') if img_element else None
        
        product_path = nombre_element.get('href')
        url_producto = product_path if "http" in product_path else f"{self.base_url}{product_path}"

        return {
            "nombre": nombre,
            "precio": precio,
            "precio_oferta": None,
            "imagen_url": imagen_url,
            "url_producto": url_producto
        }

    def _parse_price(self, text: str) -> Optional[float]:
        try:
            clean_text = text.replace('$', '').replace('.', '').replace(',', '.').strip()
            match = re.search(r'[\d\.]+', clean_text)
            if match:
                return float(match.group(0))
            return None
        except:
            return None
