import os

from fastapi import APIRouter, Query, Security

from App.Security.security import get_api_key
from App.Sniffers.Sniffer import GeminiSniffer, OpenAISniffer

router = APIRouter()


@router.get("/report/gemini/get/", dependencies=[Security(get_api_key)])
def get_gemini_report(
    prompt: str,
    assets: list[str] = Query(
        ..., description="List of assets to detected in answer", min_length=1
    ),
):
    """
    This Route return the Gemini Report for GEO

    Arguments :
        prompt (str) : The query that is used to send to gemini

    Return :
        Dict with status and result
    """

    gs = GeminiSniffer(
        api_key=os.getenv("GEMINI_API_KEY"),
        endpoint=None,
        assets_to_find=assets,
        prompt=prompt,
        model_name=os.getenv("GEMINI_MODEL_NAME"),
    )

    try:

        gs.generate_report()

    except Exception as e:
        print("ERROR : Error while generating report")
        print(e)
        return {"status": 500, "message": "Internal Server Error", "data": []}

    return {"status": 200, "message": "Go to Data", "data": gs.report}


@router.get("/report/openai/get/", dependencies=[Security(get_api_key)])
def get_openai_report(
    prompt: str,
    assets: list[str] = Query(
        ..., description="List of assets to detected in answer", min_length=1
    ),
):

    oas = OpenAISniffer(
        api_key=os.getenv("AZURE_OPENAI_key"),
        endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        assets_to_find=assets,
        prompt=prompt,
        model_name=os.getenv("AZURE_OPENAI_MODEL"),
    )

    try:

        oas.generate_report()

    except Exception as e:
        print("ERROR : Error while generating report")
        print(e)
        return {"status": 500, "message": "Internal Server Error", "data": []}

    return {"status": 200, "message": "Go to Data", "data": oas.report}
