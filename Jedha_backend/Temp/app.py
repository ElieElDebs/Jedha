import time

from playwright.sync_api import sync_playwright


def run():
    with sync_playwright() as p:
        # Utilisation du canal Chrome réel au lieu du binaire Chromium
        browser = p.chromium.launch(
            channel="chrome",  # Ouvre le vrai Chrome installé sur votre PC
            headless=False,
            args=["--start-maximized"],
        )

        context = browser.new_context(
            no_viewport=True, locale="fr-FR", timezone_id="Europe/Paris"
        )

        page = context.new_page()

        print("1. Accès à la page d'accueil pour obtenir des cookies légitimes...")
        page.goto("https://www.tripadvisor.fr", wait_until="domcontentloaded")
        time.sleep(3)

        # Simulation d'interaction humaine (mouvement de souris)
        page.mouse.move(200, 300)
        time.sleep(1)

        print("2. Navigation vers la fiche du restaurant...")
        page.goto(
            "https://www.tripadvisor.fr/Restaurant_Review-g187147-d26405745-Reviews-Ostra_Paris-Paris_Ile_de_France.html",
            wait_until="domcontentloaded",
            referer="https://www.tripadvisor.fr/",
        )

        time.sleep(5)

        title = page.title()
        print(f"Titre récupéré : {title}")
        page.screenshot(path="tripadvisor_success.png")

        browser.close()


if __name__ == "__main__":
    run()
