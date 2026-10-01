import httpx
from typing import Optional, Dict, Any, List
from .base_scraper import BaseScraper

class YaguaneScraper(BaseScraper):
    chain_name = "Yaguané"
    base_url = "https://yaguaneonline.com.ar"
    api_base_url = "https://yaguaneonline.com.ar/backonline"

    def __init__(self):
        super().__init__()
        self.id_instalacion: Optional[int] = 3
        self.id_catalogo: Optional[int] = 1042

    async def _ensure_catalog_ids(self, client: httpx.AsyncClient) -> None:
        """Dynamically fetch or refresh installation and catalog IDs if needed."""
        try:
            if not self.id_instalacion:
                r_inst = await client.get(
                    f"{self.api_base_url}/api/Instalacion/Get",
                    params={"url": f"{self.base_url}/"}
                )
                if r_inst.status_code == 200:
                    self.id_instalacion = r_inst.json().get("idInstalacion", 3)
                else:
                    self.id_instalacion = 3

            if not self.id_catalogo:
                r_cat = await client.get(
                    f"{self.api_base_url}/api/Catalogo/GetCatalogosActivos",
                    params={"idInstalacion": self.id_instalacion}
                )
                if r_cat.status_code == 200:
                    cats = r_cat.json()
                    if cats and len(cats) > 0:
                        self.id_catalogo = cats[0].get("idCatalogo") or cats[0].get("id") or 1042
                    else:
                        self.id_catalogo = 1042
                else:
                    self.id_catalogo = 1042
        except Exception as e:
            print(f"[{self.chain_name}] Warning obtaining catalog IDs: {e}")
            self.id_instalacion = self.id_instalacion or 3
            self.id_catalogo = self.id_catalogo or 1042

    async def _perform_scrape(self, client: httpx.AsyncClient, query: str) -> Optional[Dict[str, Any]]:
        query_clean = query.strip()
        is_ean = query_clean.isdigit() and len(query_clean) >= 8

        # As requested, Yaguane does not support barcode/EAN searches directly
        if is_ean:
            return None

        if not query_clean:
            return None

        await self._ensure_catalog_ids(client)

        search_params = {
            "idCatalogo": self.id_catalogo,
            "filter": query_clean,
            "page": 1,
            "pageSize": 20,
            "idInstalacion": self.id_instalacion
        }

        search_headers = {
            "Accept": "application/json, text/plain, */*",
            "Referer": f"{self.base_url}/",
            "Origin": self.base_url
        }

        try:
            response = await client.get(
                f"{self.api_base_url}/api/Catalogo/GetCatalagoSeleccionado",
                params=search_params,
                headers=search_headers
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"[{self.chain_name}] Search request failed: {e}")
            return None

        if not data or not isinstance(data, dict):
            return None

        sections: List[Dict[str, Any]] = data.get("listadoSecciones", [])
        if not sections:
            return None

        # Collect all active articles
        all_articles = []
        for sec in sections:
            for art in sec.get("listaArticulos", []):
                if art.get("activo") and (art.get("stockDisponible") is None or art.get("stockDisponible") > 0):
                    all_articles.append(art)

        if not all_articles:
            return None

        # Choose best match based on query terms
        query_words = [w.lower() for w in query_clean.split() if len(w) > 1]
        
        def match_score(art: Dict[str, Any]) -> int:
            nombre = (art.get("nombre") or "").lower()
            score = 0
            for w in query_words:
                if w in nombre:
                    score += 1
            return score

        all_articles.sort(key=match_score, reverse=True)
        best_article = all_articles[0]

        nombre = best_article.get("nombre")
        precio_lista = best_article.get("precioLista")
        precio_promo = best_article.get("precioPromocional")

        if precio_promo and float(precio_promo) > 0 and (not precio_lista or float(precio_promo) < float(precio_lista)):
            precio = float(precio_promo)
            precio_oferta = float(precio_promo)
        elif precio_lista and float(precio_lista) > 0:
            precio = float(precio_lista)
            precio_oferta = None
        else:
            return None

        # Format image URL
        imagen_url = None
        images = best_article.get("listaImagenesArticulos", [])
        if images and isinstance(images, list):
            raw_path = images[0].get("path")
            if raw_path:
                imagen_url = raw_path.replace("\\", "/")

        url_producto = f"{self.base_url}/#/"

        return {
            "nombre": nombre,
            "precio": precio,
            "precio_oferta": precio_oferta,
            "imagen_url": imagen_url,
            "url_producto": url_producto
        }
