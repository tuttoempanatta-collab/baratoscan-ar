import httpx
from typing import Optional, Dict, Any
from .base_scraper import BaseScraper

class DiaScraper(BaseScraper):
    chain_name = "Día"
    base_url = "https://diaonline.supermercadosdia.com.ar"

    async def _perform_scrape(self, client: httpx.AsyncClient, ean: str) -> Optional[Dict[str, Any]]:
        is_ean = ean.isdigit() and len(ean) >= 8
        if is_ean:
            api_url = f"{self.base_url}/api/catalog_system/pub/products/search/?fq=alternateIds_Ean:{ean}"
        else:
            # Handle spaces in text query
            query = ean.replace(' ', '%20')
            api_url = f"{self.base_url}/api/catalog_system/pub/products/search/{query}"
        
        response = await client.get(api_url)
        response.raise_for_status()
        
        data = response.json()
        if not data or len(data) == 0:
            return None

        matching_product = None
        matching_item = None
        matching_offer = None

        if is_ean:
            # 1. Search for the exact EAN item that is actively in stock
            for product in data:
                for item in product.get('items', []):
                    if item.get('ean') == ean:
                        for seller in item.get('sellers', []):
                            offer = seller.get('commertialOffer', {})
                            # Check stock/availability and verify active price
                            if offer.get('IsAvailable') and offer.get('AvailableQuantity', 0) > 0:
                                price = offer.get('Price')
                                if price is not None and price > 0:
                                    matching_product = product
                                    matching_item = item
                                    matching_offer = offer
                                    break
                        if matching_product:
                            break
                if matching_product:
                    break
        else:
            # 2. Search for any item of the first product that is actively in stock
            for product in data:
                for item in product.get('items', []):
                    for seller in item.get('sellers', []):
                        offer = seller.get('commertialOffer', {})
                        if offer.get('IsAvailable') and offer.get('AvailableQuantity', 0) > 0:
                            price = offer.get('Price')
                            if price is not None and price > 0:
                                matching_product = product
                                matching_item = item
                                matching_offer = offer
                                break
                    if matching_product:
                        break
                if matching_product:
                    break

        if not matching_product or not matching_item or not matching_offer:
            return None

        nombre = matching_product.get('productName')
        precio = matching_offer.get('Price')
        precio_oferta = None
        
        images = matching_item.get('images', [{}])
        imagen_url = images[0].get('imageUrl') if images else None
        
        link = matching_product.get('linkText')
        url_producto = f"{self.base_url}/{link}/p" if link else f"{self.base_url}/{ean}?_q={ean}&map=ft"

        return {
            "nombre": nombre,
            "precio": float(precio) if precio else None,
            "precio_oferta": precio_oferta,
            "imagen_url": imagen_url,
            "url_producto": url_producto
        }
