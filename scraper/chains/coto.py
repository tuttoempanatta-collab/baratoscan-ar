import httpx
import re
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper

class CotoScraper(BaseScraper):
    chain_name = "Coto"
    base_url = "https://www.cotodigital3.com.ar"

    async def _perform_scrape(self, client: httpx.AsyncClient, ean: str) -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/sitios/cdigi/buscar?_dyncharset=utf-8&q={ean}"
        
        response = await client.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        nombre_element = soup.select_one('div.descrip_full')
        if not nombre_element:
            return None
            
        nombre = nombre_element.get_text(strip=True)
        
        precio_element = soup.select_one('span.atg_store_newPrice')
        precio = self._parse_price(precio_element.get_text(strip=True)) if precio_element else None
        
        img_element = soup.select_one('img.product_image')
        imagen_url = img_element.get('src') if img_element else None
        
        link_element = soup.select_one('a.product_info_step')
        product_path = link_element.get('href') if link_element else f"/sitios/cdigi/buscar?q={ean}"
        url_producto = f"{self.base_url}{product_path}"

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
