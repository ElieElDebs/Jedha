from pydantic import BaseModel, Field, PositiveInt


class GetReport(BaseModel):
    prompt: str
