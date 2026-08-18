"""
This file contains all the function that construct KPI using genAI
"""

import json
import os
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI
from sentence_transformers import SentenceTransformer, util

# Lazily loaded / cached Azure OpenAI client (avoid reloading the client on every call)
_OPENAI_CLIENT: Optional[OpenAI] = None

# Lazily loaded / cached multilingual sentence-embedding model. This single model
# supports both French and English (and other languages) in the same embedding
# space, so texts don't need to be split by language before comparison.
_MULTILINGUAL_EMBEDDING_MODEL: Optional[SentenceTransformer] = None

_EXTRACT_COMPETITORS_TOOL: dict[str, any] = {
    "type": "function",
    "name": "extract_competitors",
    "description": (
        "Extract the competitor brands mentioned in a text, ranked by their "
        "positionning (how prominently they are featured, 0 being the most "
        "prominent)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "competitors": {
                "type": "array",
                "description": "The list of competitor brands found in the text",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The competitor brand name",
                        },
                        "positionning": {
                            "type": "integer",
                            "description": (
                                "The rank of the competitor in the text, 0 being "
                                "the most prominently featured"
                            ),
                        },
                    },
                    "required": ["name", "positionning"],
                },
            }
        },
        "required": ["competitors"],
    },
}


def __get_openai_client() -> OpenAI:
    """Lazily init and cache the Azure OpenAI client used for tool-calling based KPIs."""

    global _OPENAI_CLIENT

    if _OPENAI_CLIENT is None:
        load_dotenv("./Configuration/.env")

        _OPENAI_CLIENT = OpenAI(
            base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_key=os.getenv("AZURE_OPENAI_key"),
        )

    return _OPENAI_CLIENT


def __get_multilingual_embedding_model() -> SentenceTransformer:
    """Lazily init and cache the multilingual sentence-embedding model."""

    global _MULTILINGUAL_EMBEDDING_MODEL

    if _MULTILINGUAL_EMBEDDING_MODEL is None:
        _MULTILINGUAL_EMBEDDING_MODEL = SentenceTransformer(
            "paraphrase-multilingual-MiniLM-L12-v2"
        )

    return _MULTILINGUAL_EMBEDDING_MODEL


def extract_competitors(text: str) -> list[dict[str, any]]:
    """
    Uses tool Calling an genAI to list competitors and their positionning

    Arguments :
        text (str) -> The text to extract competitors

    Return :
        dict :
        [
            {
                "name" : "Molard",
                "positionning" : 0
            },
            {
                "name" : "Kozy",
                "positionning" : 1
            }

        ]
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    try:
        client = __get_openai_client()

        response = client.responses.create(
            model=os.getenv("AZURE_OPENAI_MODEL"),
            input=[
                {
                    "role": "system",
                    "content": (
                        "Tu es un assistant qui identifie les marques concurrentes "
                        "mentionnees dans un texte, et les classe selon leur "
                        "positionnement (0 = la plus mise en avant)."
                    ),
                },
                {"role": "user", "content": text},
            ],
            tools=[_EXTRACT_COMPETITORS_TOOL],
            tool_choice={"type": "function", "name": "extract_competitors"},
        )

        tool_call = next(
            (
                item
                for item in response.output
                if getattr(item, "type", None) == "function_call"
            ),
            None,
        )

        if tool_call is None:
            print("ERROR : The model did not return a function call.")
            return None

        arguments: dict[str, any] = json.loads(tool_call.arguments)

        return arguments.get("competitors", [])

    except Exception as e:
        print(e)
        return None


def calculate_cosine_similarity_grounding(text: str, text_to_compared: str) -> float:
    """
    Calculate the cosine similarity between both arguments using a multilingual
    sentence-embedding model. The model handles French and English (and other
    languages) within the same embedding space, so both texts can be compared
    directly regardless of their language, without needing a lang argument.

    Arguments:
        text (str) : The text based
        text_to_compared (str) : The text to be compared

    Return:
        The cosine similarity (float)
    """

    if type(text) is not str or type(text_to_compared) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None or text_to_compared is None:
        return None

    if text in ("", " ") or text_to_compared in ("", " "):
        print("ERROR : Text must not be empty.")
        return None

    try:
        model = __get_multilingual_embedding_model()

        embeddings = model.encode([text, text_to_compared], convert_to_tensor=True)

        similarity = util.cos_sim(embeddings[0], embeddings[1])

        return float(similarity.item())

    except Exception as e:
        print(e)
        return None
