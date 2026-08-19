"""
This file contains all the function that calculate KPI such as number of used word etc ...
"""

import re
from collections import Counter
from typing import Optional

import nltk
import spacy
import textstat
from nltk.sentiment import SentimentIntensityAnalyzer
from spacy.language import Language
from transformers import Pipeline, pipeline

# Lazily loaded / cached French pipelines (avoid reloading the models on every call)
_FRENCH_SENTIMENT_PIPELINE: Optional[Pipeline] = None
_FRENCH_NER_PIPELINE: Optional[Pipeline] = None

# Lazily loaded / cached spaCy pipelines. Requires the models to be downloaded once via
# `python -m spacy download fr_core_news_sm` and `python -m spacy download en_core_web_sm`.
_FRENCH_SPACY_PIPELINE: Optional[Language] = None
_ENGLISH_SPACY_PIPELINE: Optional[Language] = None


def __init_module():
    nltk.download("vader_lexicon", quiet=True)
    nltk.download("stopwords", quiet=True)
    nltk.download("words", quiet=True)
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    nltk.download("averaged_perceptron_tagger", quiet=True)
    nltk.download("averaged_perceptron_tagger_eng", quiet=True)
    nltk.download("maxent_ne_chunker", quiet=True)
    nltk.download("maxent_ne_chunker_tab", quiet=True)


def __get_french_sentiment_pipeline() -> Pipeline:
    """Lazily init and cache the French sentiment-analysis pipeline (DistilCamemBERT, 1-5 star rating)."""

    global _FRENCH_SENTIMENT_PIPELINE

    if _FRENCH_SENTIMENT_PIPELINE is None:
        _FRENCH_SENTIMENT_PIPELINE = pipeline(
            "sentiment-analysis", model="cmarkea/distilcamembert-base-sentiment"
        )

    return _FRENCH_SENTIMENT_PIPELINE


def __get_french_ner_pipeline() -> Pipeline:
    """Lazily init and cache the French NER pipeline (CamemBERT fine-tuned for NER)."""

    global _FRENCH_NER_PIPELINE

    if _FRENCH_NER_PIPELINE is None:
        _FRENCH_NER_PIPELINE = pipeline(
            "ner", model="Jean-Baptiste/camembert-ner", aggregation_strategy="simple"
        )

    return _FRENCH_NER_PIPELINE


def __get_french_spacy_pipeline() -> Language:
    """Lazily init and cache the French spaCy pipeline (fr_core_news_sm)."""

    global _FRENCH_SPACY_PIPELINE

    if _FRENCH_SPACY_PIPELINE is None:
        _FRENCH_SPACY_PIPELINE = spacy.load("fr_core_news_sm")

    return _FRENCH_SPACY_PIPELINE


def __get_english_spacy_pipeline() -> Language:
    """Lazily init and cache the English spaCy pipeline (en_core_web_sm)."""

    global _ENGLISH_SPACY_PIPELINE

    if _ENGLISH_SPACY_PIPELINE is None:
        _ENGLISH_SPACY_PIPELINE = spacy.load("en_core_web_sm")

    return _ENGLISH_SPACY_PIPELINE


def analyze_sentiment(text: str, lang: str = "FR") -> dict[str, float]:
    """
    Apply sentiment analysis.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        The result in dict format, with keys "neg", "neu", "pos" and "compound"
        (VADER's convention), regardless of the language used
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    if lang == "EN":

        print("The lang is english...")

        try:
            __init_module()
            sia = SentimentIntensityAnalyzer()
            return sia.polarity_scores(text)

        except Exception as e:
            print(e)
            return None

    else:

        print("The lang is french...")

        try:
            sentiment_pipeline = __get_french_sentiment_pipeline()
            star_scores = sentiment_pipeline(text, top_k=None)

            # The model rates the text on a "1 star" (very negative) to "5 stars" (very
            # positive) scale. Group 1-2 stars as negative, 3 stars as neutral and 4-5
            # stars as positive so the output matches VADER's pos/neu/neg/compound shape.
            negative = sum(
                s["score"] for s in star_scores if s["label"] in ("1 star", "2 stars")
            )
            neutral = sum(s["score"] for s in star_scores if s["label"] == "3 stars")
            positive = sum(
                s["score"] for s in star_scores if s["label"] in ("4 stars", "5 stars")
            )
            compound = sum(
                ((int(s["label"][0]) - 3) / 2) * s["score"] for s in star_scores
            )

            return {
                "neg": negative,
                "neu": neutral,
                "pos": positive,
                "compound": compound,
            }

        except Exception as e:
            print(e)
            return None


def readness_score(text: str, lang: str = "FR") -> float:
    """
    Apply Flesch-Szigriszt score.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        The result in float
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    text_to_analyze: str = text

    try:

        textstat.set_lang("fr" if lang == "FR" else "en")
        result = textstat.flesch_reading_ease(text_to_analyze)
        return result

    except Exception as e:
        print(e)
        return None


def lower_text(text: str) -> str:
    """
    Lower the text.

    Arguments :
            text (str) -> The text to be lowered

    Return :
        The text lowered
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    return text.lower()


def identify_entities(tokens: list[str], lang: str = "FR") -> list[tuple[str, str]]:
    """
    Apply NER in the tokens

    Arguments :
        tokens (list [str]) -> All the token (words) of thent sentence
        lang (str) -> The lang of the tokens

    Return :
        List of tuples containing (entity, label)
    """

    if type(tokens) is not list:
        print("ERROR, type of argument must be a list")
        return None

    if tokens is None or len(tokens) == 0:
        print("ERROR : Tokens list must not be empty.")
        return None

    if lang == "EN":

        print("The lang is english...")

        try:
            __init_module()
            tagged_tokens = nltk.pos_tag(tokens)
            chunked_tokens = nltk.ne_chunk(tagged_tokens)

            entities: list[tuple[str, str]] = [
                (" ".join(token for token, _ in chunk), chunk.label())
                for chunk in chunked_tokens
                if hasattr(chunk, "label")
            ]

            return entities

        except Exception as e:
            print(e)
            return None

    else:

        print("The lang is french...")

        try:
            ner_pipeline = __get_french_ner_pipeline()
            raw_entities = ner_pipeline(" ".join(tokens))

            entities: list[tuple[str, str]] = [
                (entity["word"], entity["entity_group"]) for entity in raw_entities
            ]

            return entities

        except Exception as e:
            print(e)
            return None


def tag_pos(text: str, lang: str = "FR") -> list[tuple[str, str]]:
    """
    Tag each token of the text with its part-of-speech (POS) using spaCy.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        List of tuples containing (token, POS tag). POS tags follow spaCy's
        universal scheme (e.g. "PROPN" for proper nouns, "NOUN" for common
        nouns, "VERB", "ADJ", ...)
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    if lang == "EN":

        print("The lang is english...")

        try:
            nlp = __get_english_spacy_pipeline()
            doc = nlp(text)
            return [(token.text, token.pos_) for token in doc if not token.is_space]

        except Exception as e:
            print(e)
            return None

    else:

        print("The lang is french...")

        try:
            nlp = __get_french_spacy_pipeline()
            doc = nlp(text)
            return [(token.text, token.pos_) for token in doc if not token.is_space]

        except Exception as e:
            print(e)
            return None


def extract_tokens_by_pos(
    text: str, pos_tags: list[str], lang: str = "FR"
) -> list[str]:
    """
    Extract the tokens of the text whose POS tag is in pos_tags.

    Arguments :
        text (str) -> The text to be analyzed
        pos_tags (list[str]) -> The spaCy POS tags to keep (e.g. ["PROPN"])
        lang (str) -> The lang of the text

    Return :
        List of tokens matching one of the requested POS tags
    """

    if type(pos_tags) is not list:
        print("ERROR, type of argument must be a list")
        return None

    if pos_tags is None or len(pos_tags) == 0:
        print("ERROR : POS tags list must not be empty.")
        return None

    tagged_tokens = tag_pos(text, lang=lang)

    if tagged_tokens is None:
        return None

    return [token for token, tag in tagged_tokens if tag in pos_tags]


def lemmatize(text: str, lang: str = "FR") -> list[tuple[str, str]]:
    """
    Lemmatize each token of the text using spaCy.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        List of tuples containing (token, lemma)
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    if lang == "EN":

        print("The lang is english...")

        try:
            nlp = __get_english_spacy_pipeline()
            doc = nlp(text)
            return [(token.text, token.lemma_) for token in doc if not token.is_space]

        except Exception as e:
            print(e)
            return None

    else:

        print("The lang is french...")

        try:
            nlp = __get_french_spacy_pipeline()
            doc = nlp(text)
            return [(token.text, token.lemma_) for token in doc if not token.is_space]

        except Exception as e:
            print(e)
            return None


def extract_proper_nouns(text: str, lang: str = "FR") -> list[str]:
    """
    Extract the proper nouns (e.g. names of people, places, brands) of the text.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        List of proper nouns found in the text
    """

    return extract_tokens_by_pos(text, ["PROPN"], lang=lang)


def extract_common_nouns(text: str, lang: str = "FR") -> list[str]:
    """
    Extract the common nouns of the text.

    Arguments :
        text (str) -> The text to be analyzed
        lang (str) -> The lang of the text

    Return :
        List of common nouns found in the text
    """

    return extract_tokens_by_pos(text, ["NOUN"], lang=lang)


def detect_language(text: str) -> str:
    """
    Detect the lang of the given text

    Arguments :
                text (str) -> The text to be lowered

    Return :
        FR | EN
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

        __init_module()

        tokens = nltk.word_tokenize(lower_text(text))

        french_stopwords = set(nltk.corpus.stopwords.words("french"))
        english_stopwords = set(nltk.corpus.stopwords.words("english"))

        french_score = sum(1 for token in tokens if token in french_stopwords)
        english_score = sum(1 for token in tokens if token in english_stopwords)

        return "FR" if french_score >= english_score else "EN"

    except Exception as e:
        print(e)
        return None


def detect_patterns_obselete(text: str, regexes: list[str]) -> bool:
    """
    Uses a list of regexes to find in a specific text.
    The goal of this is to detect special sentence for a exemple the name of the Compagny

    Argument :
        text (str) -> The text in which to detect pattern
        regexes (list[str]) -> The list of pattern to detect

    Return :
        True if at least one pattern is found in the text, False otherwise
    """

    if type(text) is not str:
        print("ERROR, type of argument must be a string")
        return None

    if text is None:
        return None

    if text == "" or text == " ":
        print("ERROR : Text must not be empty.")
        return None

    if type(regexes) is not list:
        print("ERROR, type of argument must be a list")
        return None

    if regexes is None or len(regexes) == 0:
        print("ERROR : Regexes list must not be empty.")
        return None

    for regex in regexes:
        try:
            if re.search(regex, text):
                return True

        except Exception as e:
            print(f"ERROR : Invalid pattern '{regex}' -> {e}")
            continue

    return False


def detect_asset(asset: str, text: str) -> dict[str, any]:
    """
    Detect asset and they occurences

    Argument :
        asset (str) - The pattern to detect
        text (str) - The text to search for the assets

    Return :
        {
            'asset': 'ostra',
            'count': 1,
            'positions': [2695],
            'first': 2695
        }
    """

    asset_lower = asset.lower()
    text_lower = text.lower()

    positions = [match.start() for match in re.finditer(asset_lower, text_lower)]

    answer: dict[str, any] = {
        "asset": asset_lower,
        "count": 0,
        "positions": None,
        "first": None,
    }

    if len(positions) == 0:
        return answer

    answer["count"] = len(positions)
    answer["positions"] = positions
    answer["first"] = positions[0]

    return answer


def sort_assets(assets: list[dict[str, any]], key: str) -> list[dict[str, any]]:
    """
    Sort all the assets based on a key

    Argument :
        assets (list) : The list of assets to sort
        key (str) : The Dictionnary's key to use

    Return :
        List of the assets sorted
    """

    positions: list[dict[str, any]] = list()

    for asset in assets:

        if asset["count"] != 0:
            positions.append(asset)

    positions.sort(key=lambda asset_element: asset_element[key])

    return positions
