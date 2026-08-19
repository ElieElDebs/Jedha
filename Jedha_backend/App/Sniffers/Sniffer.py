from google import genai
from google.genai.types import GenerateContentConfig, GoogleSearch, Tool
from openai import OpenAI
from trafilatura import extract, fetch_url

from App.Utils.kpi import detect_asset, sort_assets
from App.Utils.gen_ai_kpi import (
    calculate_cosine_similarity_grounding,
    extract_competitors,
)


class SnifferError(Exception):
    """Error Thrown when something is going wrong in the sniffer"""

    pass


class SnifferFetchingError(SnifferError):
    """Levée quand un retrait dépasse le solde disponible."""

    def __init__(
        self, prompt: str, generative_engine: str = "OpenAI", message: str = None
    ) -> None:
        self.prompt = prompt
        self.generative_engine = generative_engine
        self.message = message

        message = (
            f"Erreur au moment de l'appel du moteur : {self.generative_engine}"
            f"Voici le prompt utilisé {self.prompt}"
            f"Le message de l'erreur {self.message}"
        )
        super().__init__(message)


class Sniffer:
    """
    Sniffer is a class that will take arguments and search on Generative Engine for answers.

    Attributes :

    """

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model_name: str,
        assets_to_find: list[str],
        prompt: str,
    ):

        self._api_key: str = api_key
        self._endpoint: str = endpoint
        self._model_name: str = model_name
        self._prompt: str = prompt
        self._assets_to_find: list[str] = assets_to_find

        self._sniffer_configuration: dict[str, any] = {
            "api_key": self._api_key,
            "endpoint": self._endpoint,
            "model_name": self._model_name,
            "assets_to_find": self._assets_to_find,
            "prompt": self._prompt,
        }

        self.report: dict[str, any] = None

    @staticmethod
    def convert_html_to_markdown(url: str) -> tuple[str, str]:
        """
        Function that fetch urls and transforms them into markdown format

        Argument:
            url (str) : url to fetch

        Return :
            Return the url and the markdown version
        """

        downloaded = fetch_url(url)

        markdown_content = extract(
            downloaded,
            output_format="markdown",
            include_links=True,
            include_images=False,
            include_tables=True,
            no_fallback=False,
        )

        if markdown_content == None:  # It means that we need to activate Javascript
            print(f"The website {url} needs Advance Scrapping ...")

        return (url, markdown_content)


class OpenAISniffer(Sniffer):
    """
    OpenAISniffer Class
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model_name: str,
        assets_to_find: list[str],
        prompt: str,
    ):
        super().__init__(api_key, endpoint, model_name, assets_to_find, prompt)

        # Init Arguments
        self.__client = self.__init_client()
        self._response = None

    def __init_client(self):
        """Init the OpenAI client"""

        client: OpenAI = OpenAI(base_url=self._endpoint, api_key=self._api_key)

        return client

    @staticmethod
    def count_used_domain(used_domain: list[dict[str, any]]) -> list[tuple[str, int]]:
        """
        This function enumerates all the domains that are contains in the links

        Arguments :
            used_domain (list[[dict[str, any]]) :

        Return :
            list of tuple containings the domain and the number of time it is mentionned
        """

        domains: list[str] = []

        for domain in used_domain:
            domains.append(domain["url"].split("/")[2])

        result: list[tuple[str, int]] = []

        for domain in domains:
            temp = domains.count(domain)

            result.append((domain, temp))

        return list(set(result))

    @staticmethod
    def count_all_domain(all_domains: list[str]) -> list[tuple[str, int]]:
        """
        This function enumerates all the domains that are contains in the links

        Arguments :
            all_domains (list[str]) :

        Return :
            list of tuple containings the domain and the number of time it is mentionned
        """

        domains: list[str] = list()

        for link in all_domains:
            domains.append(link.split("/")[2])

        result: list[tuple[str, int]] = []

        for domain in domains:
            temp = domains.count(domain)

            result.append((domain, temp))

        return list(set(result))

    def _fetch_to_openAi(self) -> OpenAI.responses:
        """
        Use the prompt to execute a requests to openAI using the configuration of the object

        Return :
            The "Response" Object of OpenAI
        """

        try:
            response = self.__client.responses.create(
                model=self._model_name,
                input=self._prompt,
                tools=[{"type": "web_search"}],
                include=["web_search_call.action.sources"],
            )

        except Exception as e:
            raise SnifferFetchingError(
                message=e, generative_engine="openAI", prompt=self._prompt
            )

        self._response = response

        return response

    def generate_report(self) -> dict[str, any]:
        """
        Generate a Dict report that is gonna be use to generate KPI
        """

        fetch = self._fetch_to_openAi()

        response_sources: list[any] = self._response.output[0].action.sources
        response_used_sources: list[any] = (
            self._response.output[1].content[0].annotations
        )

        structure_sources: list[any] = [element.url for element in response_sources]
        structure_used_sources: list[dict[str, any]] = [
            {"title": element.title, "url": element.url}
            for element in response_used_sources
        ]

        llm_text: str = self._response.output[1].content[0].text

        # Extract the competitor brands mentioned in the LLM answer, via tool calling
        competitors: list[dict[str, any]] = extract_competitors(llm_text)

        assets: list[dict[str, any]] = list()
        assets_detected: bool = False

        for asset in self._assets_to_find:

            temp_asset: dict[str, any] = detect_asset(asset, llm_text)

            if temp_asset["count"] != 0:
                assets_detected = True

            assets.append(temp_asset)

        if assets_detected == True:

            for competitors_names in [name["name"].lower() for name in competitors]:
                temp_asset: dict[str, any] = detect_asset(competitors_names, llm_text)
                if temp_asset["count"] != 0:
                    assets.append(temp_asset)

            assets = sort_assets(assets=assets, key="first")

        # sources_markdown:list[tuple[str, str]] = [self.convert_html_to_markdown(url) for url in structure_sources]
        all_source_markdown: list[tuple[str, str]] = [
            self.convert_html_to_markdown(element["url"])
            for element in structure_used_sources
        ]

        structured_format: dict[str] = {
            "queries": self._response.output[0].action.queries,
            "engine": "openAI",
            "competitors": competitors,
            "sources": {
                "metadata": {
                    "all_sources": structure_sources,
                    "used_sources": structure_used_sources,
                    "number_of_sources": len(response_sources),
                    "number_of_used_sources": len(response_used_sources),
                    "used_source_with_markdown": all_source_markdown,
                },
                "kpi": {
                    "used_domains": self.count_used_domain(structure_used_sources),
                    "all_domains": self.count_all_domain(structure_sources),
                    "asset_detected": assets_detected,
                    "assets_and_competitors_sorted": assets,
                },
            },
            "llm_output": {
                "text": llm_text,
            },
        }

        self.report = structured_format

        return structured_format


class GeminiSniffer(Sniffer):
    """GeminiSniffer class implementing the Sniffer architecture for Google
    Gemini models."""

    def __init__(
        self,
        api_key: str,
        endpoint: str,
        model_name: str,
        assets_to_find: list[str],
        prompt: str,
    ):
        super().__init__(api_key, endpoint, model_name, assets_to_find, prompt)

        # Init Arguments
        self.__client = self.__init_client()
        self._response = None

    def __init_client(self) -> genai:
        """Init the Gemini client using the Google Generative AI SDK."""
        client = genai.Client(api_key=self._api_key)
        return client

    @staticmethod
    def count_used_domain(used_domain: list[dict[str, any]]) -> list[tuple[str, int]]:
        """Enumerates domain titles contained in used_sources.

        Arguments :
            used_domain (list[dict[str, Any]]) : List of dicts with 'title' and
            'url'

        Return :
            List of tuples containing (domain_title, occurrence_count)
        """
        domains: list[str] = []

        for item in used_domain:
            val = item.get("title", "") or item.get("url", "")
            # Safely handle both URLs (http://...) and plain titles/domains
            if "/" in val and len(val.split("/")) > 2:
                domains.append(val.split("/")[2])
            else:
                domains.append(val)

        result: list[tuple[str, int]] = []
        for domain in domains:
            if domain:
                result.append((domain, domains.count(domain)))

        return list(set(result))

    @staticmethod
    def count_all_domain(all_domains: list[str]) -> list[tuple[str, int]]:
        """Enumerates all domain titles retrieved by the model.

        Arguments :
            all_domains (list[str]) : List of domain titles or URLs

        Return :
            List of tuples containing (domain_title, occurrence_count)
        """
        domains: list[str] = []

        for item in all_domains:
            # Safely handle both URLs (http://...) and plain titles/domains
            if "/" in item and len(item.split("/")) > 2:
                domains.append(item.split("/")[2])
            else:
                domains.append(item)

        result: list[tuple[str, int]] = []
        for domain in domains:
            if domain:
                result.append((domain, domains.count(domain)))

        return list(set(result))

    def _fetch_to_gemini(self) -> any:
        """Execute a request to Gemini using the prompt and the object's
        configuration.

        Return :
            The "GenerateContentResponse" object from Gemini
        """
        try:
            response = self.__client.models.generate_content(
                model=self._model_name,
                contents=self._prompt,
                config=GenerateContentConfig(
                    tools=[Tool(google_search=GoogleSearch())]
                ),
            )

        except Exception as e:
            raise SnifferFetchingError(
                message=e, generative_engine="gemini", prompt=self._prompt
            )

        self._response = response
        return response

    def generate_report(self) -> dict[str, any]:
        """Generate a dictionary report containing sources and KPIs."""
        fetch = self._fetch_to_gemini()

        candidate = self._response.candidates[0]
        g_meta = getattr(candidate, "grounding_metadata", None)

        # 1. Extract search queries executed by Gemini
        queries: list[str] = getattr(g_meta, "web_search_queries", []) or []

        # 2. Extract raw grounding chunks
        raw_chunks = getattr(g_meta, "grounding_chunks", []) or []

        structure_sources: list[str] = []
        all_domain_titles: list[str] = []

        for chunk in raw_chunks:
            if hasattr(chunk, "web") and chunk.web and chunk.web.uri:
                structure_sources.append(chunk.web.uri)
                # Store titles to resolve the Vertex redirect URL issue
                title = getattr(chunk.web, "title", "")
                if title:
                    all_domain_titles.append(title)

        # Remove duplicate URLs while preserving order
        structure_sources = list(dict.fromkeys(structure_sources))

        # 3. Extract actually cited/used sources via grounding_supports
        supports = getattr(g_meta, "grounding_supports", []) or []
        used_indices = set()
        for support in supports:
            indices = getattr(support, "grounding_chunk_indices", []) or []
            used_indices.update(indices)

        structure_used_sources: list[dict[str, any]] = []
        seen_used_urls = set()

        for idx in used_indices:
            if idx < len(raw_chunks):
                chunk = raw_chunks[idx]
                if hasattr(chunk, "web") and chunk.web:
                    url = chunk.web.uri
                    title = getattr(chunk.web, "title", "")
                    if url not in seen_used_urls:
                        structure_used_sources.append({"title": title, "url": url})
                        seen_used_urls.add(url)

        # 4. Extract generated LLM text
        llm_text: str = self._response.text

        # 7. Extract the competitor brands mentioned in the LLM answer, via
        # tool calling
        competitors: list[dict[str, any]] = extract_competitors(llm_text)

        assets: list[dict[str, any]] = list()
        assets_detected: bool = False

        for asset in self._assets_to_find:

            temp_asset: dict[str, any] = detect_asset(asset, llm_text)

            if temp_asset["count"] != 0:
                assets_detected = True

                assets.append(temp_asset)

            if assets_detected == True:

                for competitors_names in [name["name"].lower() for name in competitors]:
                    temp_asset: dict[str, any] = detect_asset(
                        competitors_names, llm_text
                    )
                    if temp_asset["count"] != 0:
                        assets.append(temp_asset)

                assets = sort_assets(assets=assets, key="first")

        # 5. Convert used sources content to Markdown format
        all_source_markdown: list[tuple[str, str]] = [
            self.convert_html_to_markdown(element["url"])
            for element in structure_used_sources
        ]

        # 6. Calculate the cosine similarity between each grounding support
        # (the answer segments Gemini backed with sources) and the initial
        # prompt. Gemini-only KPI: OpenAI's response API doesn't expose
        # grounding supports.
        grounding_cosine_similarities: list[dict[str, any]] = [
            {
                "text": support.segment.text,
                "grounding_chunk_indices": getattr(
                    support, "grounding_chunk_indices", []
                )
                or [],
                "cosine_similarity": calculate_cosine_similarity_grounding(
                    support.segment.text, self._prompt
                ),
            }
            for support in supports
            if getattr(support, "segment", None) and support.segment.text
        ]

        # 8. Format the structured dictionary output
        structured_format: dict[str, any] = {
            "queries": queries,
            "engine": "google",
            "competitors": competitors,
            "sources": {
                "metadata": {
                    "all_sources": structure_sources,
                    "used_sources": structure_used_sources,
                    "number_of_sources": len(structure_sources),
                    "number_of_used_sources": len(structure_used_sources),
                    "used_source_with_markdown": all_source_markdown,
                },
                "kpi": {
                    "used_domains": self.count_used_domain(structure_used_sources),
                    "all_domains": self.count_all_domain(all_domain_titles),
                    "grounding_cosine_similarities": grounding_cosine_similarities,
                    "asset_detected": assets_detected,
                    "assets_and_competitors_sorted": assets,
                },
            },
            "llm_output": {
                "text": llm_text,
            },
        }

        self.report = structured_format

        return structured_format
