"""
This file contains the script to evaluate GEO and comprehend how
GEO works with differents version of  LLM
"""

import json
import os

from dotenv import load_dotenv

from App.Sniffers.Sniffer import GeminiSniffer, OpenAISniffer

print("Loading env file ....")
loaded = load_dotenv("./Configuration/.env")

if loaded == False:
    print("ERREUR while loading env file .... Abording")
    exit()

print("env file loaded correctly")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL")
AZURE_OPENAI_key = os.getenv("AZURE_OPENAI_key")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME")

ASSETS_TO_FINDS = ["ostra", "ostra paris", "casa ostra"]

PROMPT = input("Que recherchez-vous  : ")

print("Init Sniffers ...")

try:
    oas = OpenAISniffer(
        api_key=AZURE_OPENAI_key,
        endpoint=AZURE_OPENAI_ENDPOINT,
        model_name=AZURE_OPENAI_MODEL,
        assets_to_find=ASSETS_TO_FINDS,
        prompt=PROMPT,
    )

    gs = GeminiSniffer(
        api_key=GEMINI_API_KEY,
        endpoint=None,
        assets_to_find=ASSETS_TO_FINDS,
        model_name=GEMINI_MODEL_NAME,
        prompt=PROMPT,
    )

    print("Sniffers correctly initialize")

except Exception as e:
    print(e)
    exit()


print("Generating OpenAI Report ...")
oar = oas.generate_report()
print("Done ")
print("Generating Gemini Report ...")
gr = gs.generate_report()
print("Done ")

print("---------- OPEN AI Result ----------")
print(oar["llm_output"]["text"])
with open("./open_ai_result.json", "w", encoding="utf-8") as file:
    file.write(json.dumps(oar, indent=5))

print("---------- GEMINI Result ----------")
print(gr["llm_output"]["text"])
with open("./gemini_result.json", "w", encoding="utf-8") as file:
    file.write(json.dumps(gr, indent=5))
