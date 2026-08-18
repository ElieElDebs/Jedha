import asyncio
import random
from typing import Optional

from playwright.async_api import Browser, Page, Playwright, async_playwright
from playwright_stealth import Stealth

# Global variables to keep active browser and playwright instances
PLAYWRIGHT_INSTANCE: Optional[Playwright] = None
BROWSER_INSTANCE: Optional[Browser] = None


async def init_browser() -> Browser:
    """Initialize and maintain a single instance of the Chromium browser."""
    global PLAYWRIGHT_INSTANCE, BROWSER_INSTANCE

    if BROWSER_INSTANCE is not None and BROWSER_INSTANCE.is_connected():
        return BROWSER_INSTANCE

    # Explicitly start Playwright without context manager to prevent auto-closure
    PLAYWRIGHT_INSTANCE = await async_playwright().start()

    BROWSER_INSTANCE = await PLAYWRIGHT_INSTANCE.chromium.launch(
        headless=False,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--window-size=1920,1080",
            "--ignore-certificate-errors",
        ],
    )

    return BROWSER_INSTANCE


async def close_browser() -> None:
    """Gently close the browser instance and stop Playwright."""
    global PLAYWRIGHT_INSTANCE, BROWSER_INSTANCE

    if BROWSER_INSTANCE is not None:
        await BROWSER_INSTANCE.close()
        BROWSER_INSTANCE = None

    if PLAYWRIGHT_INSTANCE is not None:
        await PLAYWRIGHT_INSTANCE.stop()
        PLAYWRIGHT_INSTANCE = None


async def create_stealth_page() -> Page:
    """Initialize a new stealth browser context and return a configured page."""
    browser = await init_browser()

    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        locale="fr-FR",
        timezone_id="Europe/Paris",
        geolocation={"latitude": 48.8566, "longitude": 2.3522},
        permissions=["geolocation"],
        extra_http_headers={
            "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        },
    )

    page = await context.new_page()

    # Apply stealth protection script
    stealth = Stealth()
    await stealth(page)

    return page


async def human_like_scroll(page: Page) -> None:
    """Simulate human-like scrolling behavior on the page."""
    total_height = await page.evaluate("document.body.scrollHeight")
    current_scroll = 0

    while current_scroll < min(total_height, 3000):  # Cap scroll depth to 3000px
        scroll_step = random.randint(300, 700)
        current_scroll += scroll_step
        await page.mouse.wheel(0, scroll_step)

        # Non-blocking pause for asyncio event loop
        await asyncio.sleep(random.uniform(0.3, 0.8))


async def get_html_page(url: str, timeout: float = 30000) -> Optional[str]:
    """
    Fetch and return rendered HTML content from a given URL.
    Creates a dedicated stealth context and ensures proper resource cleanup.

    Args:
        url (str): The target URL to scrape.
        timeout (float): Timeout limit in milliseconds for page load (default: 20000ms).

    Returns:
        Optional[str]: Rendered HTML content or None if an error occurs.
    """
    page: Optional[Page] = None
    try:
        page = await create_stealth_page()
        print(f"[Scraper] Loading {url}...")

        await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        await asyncio.sleep(random.uniform(1.2, 2.5))
        await human_like_scroll(page)

        html_rendered = await page.content()

        return html_rendered

    except Exception as e:
        print(f"[Scraper Error] Failed to fetch {url}: {e}")
        return None
