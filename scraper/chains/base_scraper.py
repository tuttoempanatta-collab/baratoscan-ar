import asyncio
import random
from typing import Optional, Dict, Any
import httpx
from datetime import datetime

class BaseScraper:
    chain_name: str = "Base"
    base_url: str = ""

    async def scrape(self, ean: str) -> Optional[Dict[str, Any]]:
        # Random delay between 1-3 seconds for lightweight requests
        await asyncio.sleep(random.uniform(1, 3))
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7"
        }

        try:
            async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        result = await self._perform_scrape(client, ean)
                        if result:
                            # Add common fields
                            result["ean"] = ean
                            result["cadena"] = self.chain_name
                            result["timestamp"] = datetime.now().isoformat()
                            return result
                        else:
                            return None
                    except httpx.HTTPError as e:
                        print(f"[{self.chain_name}] Attempt {attempt + 1} HTTP error: {e}")
                    except Exception as e:
                        print(f"[{self.chain_name}] Attempt {attempt + 1} failed: {e}")
                        
                    if attempt == max_retries - 1:
                        return None
                    
                    # Exponential backoff
                    await asyncio.sleep(random.uniform(2, 5) * (attempt + 1))
                        
                return None
        except Exception as e:
            print(f"[{self.chain_name}] Critical error: {e}")
            return None

    async def _perform_scrape(self, client: httpx.AsyncClient, ean: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError()
