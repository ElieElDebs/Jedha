# Jedha — GEO (Generative Engine Optimization) API

Projet de recherche GEO : interroge des moteurs de recherche génératifs (OpenAI
web-search via Azure OpenAI, et Google Gemini avec Google Search grounding) avec un
prompt, puis capture quelles sources web le modèle a consultées/citées, à quels
domaines elles appartiennent, et si une marque/asset cible (ex. "Kozy", "KANOPE")
apparaît dans les sources ou dans la réponse du LLM. Le tout est exposé via une API
FastAPI.

Tout le code vit dans le dossier [Jedha_backend/](Jedha_backend/).

## Structure du projet

```
Jedha_backend/
├── app.py                  # Point d'entrée FastAPI (monte les routers)
├── requirements.txt
├── Configuration/
│   ├── .env                # Secrets (git-ignoré)
│   └── .env.example        # Modèle des variables attendues
├── App/
│   ├── Sniffers/
│   │   └── Sniffer.py       # OpenAISniffer / GeminiSniffer : logique de collecte
│   ├── Security/
│   │   └── security.py      # Auth par header X-API-KEY (FastAPI Security)
│   └── Utils/
│       ├── kpi.py            # KPI texte (lisibilité, sentiment, ...) — WIP
│       ├── gen_ai_kpi.py     # KPI via LLM (extraction concurrents, similarité cosinus)
│       └── scrapper.py       # Scraping "stealth" Playwright (pas encore branché)
├── Routes/
│   ├── report.py             # Endpoints /report/gemini/get/ et /report/openai/get/
│   └── Models/
│       └── report.py         # Modèles Pydantic
├── Script/
│   └── evaluate.py           # Script CLI de bout en bout (hors API)
└── Temp/                     # Prototypes Playwright + résultats de scratch
```

## Prérequis

- Python 3.12 (un venv `.venv/` existe déjà dans `Jedha_backend/`)
- Un accès Azure OpenAI (modèle avec web search) et une clé API Google Gemini

## Installation

```powershell
cd Jedha_backend
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configuration

Copier `Jedha_backend/Configuration/.env.example` vers `Jedha_backend/Configuration/.env`
et renseigner :

| Variable | Description |
| --- | --- |
| `AZURE_OPENAI_ENDPOINT` | Endpoint Azure OpenAI |
| `AZURE_OPENAI_MODEL` | Nom du déploiement du modèle |
| `AZURE_OPENAI_key` | Clé API Azure OpenAI |
| `GEMINI_API_KEY` | Clé API Google Gemini |
| `GEMINI_MODEL_NAME` | Nom du modèle Gemini |
| `API_KEY` | Clé API interne exigée sur les routes (header `X-API-KEY`) |

Les scripts doivent être lancés depuis la racine `Jedha_backend/` pour que le chemin
relatif `./Configuration/.env` se résolve correctement.

## Lancer l'API

```powershell
cd Jedha_backend
uvicorn app:app --reload
```

Endpoints disponibles (tous protégés par le header `X-API-KEY`, sauf `/`) :

- `GET /` — health check
- `GET /report/openai/get/?prompt=...` — génère un rapport via OpenAISniffer
- `GET /report/gemini/get/?prompt=...` — génère un rapport via GeminiSniffer

## Lancer le script CLI

`Script/evaluate.py` exécute le flux complet en ligne de commande (prompt saisi de
manière interactive), imprime la réponse des deux LLM et écrit les rapports complets
dans `Res/open_ai_result.json` / `Res/gemini_result.json`.

```powershell
cd Jedha_backend
python Script/evaluate.py
```

## État du projet / notes

- Pas de suite de tests, de linter configuré, ni de CI pour l'instant.
- `black` et `isort` sont dans `requirements.txt` mais sans config dédiée — à lancer
  manuellement si besoin (`black .`, `isort .`).
- `App/Utils/kpi.py` est en cours de développement (le cas français de l'analyse de
  sentiment est un stub).
- `App/Utils/scrapper.py` (scraping Playwright "stealth") n'est pas encore relié au
  reste du pipeline.
- `test.ipynb` / `Temp/` contiennent des scripts et notebooks d'exploration jetables,
  à ne pas considérer comme source de vérité.
