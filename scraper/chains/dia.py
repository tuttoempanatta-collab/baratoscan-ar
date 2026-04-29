import httpx
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper

class DiaScraper(BaseScraper):
    chain_name = "Día"
    base_url = "https://diaonline.supermercadosdia.com.ar"

    async def _perform_scrape(self, client: httpx.AsyncClient, ean: str) -> Optional[Dict[str, Any]]:
        # VTEX API is standard across many Argentine supermarkets
        api_url = f"{self.base_url}/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:{ean}"
        
        response = await client.get(api_url)
        response.raise_for_status()
        
        data = response.json()
        if not data or len(data) == 0:
            return None
            
        product = data[0]
        item = product.get('items', [{}])[0]
        seller = item.get('sellers', [{}])[0]
        offer = seller.get('commertialOffer', {})
        
        nombre = product.get('productName')
        precio = offer.get('Price')
        precio_oferta = None # Vtex offers usually depend on active promotions logic, keeping it simple
        
        images = item.get('images', [{}])
        imagen_url = images[0].get('imageUrl') if images else None
        
        link = product.get('linkText')
        url_producto = f"{self.base_url}/{link}/p" if link else f"{self.base_url}/{ean}?_q={ean}&map=ft"

        return {
            "nombre": nombre,
            "precio": float(precio) if precio else None,
            "precio_oferta": precio_oferta,
            "imagen_url": imagen_url,
            "url_producto": url_producto
        }
