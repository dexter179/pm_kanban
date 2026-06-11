import json
import os

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.models import Card, Column

DEFAULT_MODEL = "openai/gpt-oss-120b"


class AIResponseError(Exception):
    """The model did not return a usable structured response."""

# Strict structured-output schemas cannot express dict-with-arbitrary-keys,
# so the AI returns cards as a list; the endpoint converts to the Board shape.
class AIBoard(BaseModel):
    columns: list[Column]
    cards: list[Card]


class ChatResult(BaseModel):
    reply: str
    board: AIBoard | None = None


SYSTEM_PROMPT = """\
You are the assistant for a Kanban project management board.

The user's current board is the JSON below. Columns are in display order; each
column's cardIds lists its cards in order. Every card appears in exactly one
column.

You can create, edit, move, and delete cards, and rename columns, when the user
asks. If you change anything, return the FULL updated board in 'board' (columns
plus the complete card list); keep everything you did not change exactly as it
is, including ids. New cards get a unique id like 'card-<short-random>'. If no
change is needed, set 'board' to null. Always explain what you did (or answer
the question) in 'reply'.

Respond with a single JSON object and nothing else (no markdown fences, no
commentary), in exactly this shape:
{{"reply": "<your message to the user>", "board": <board object or null>}}
The board object has "columns" (same structure as the input) and "cards" as an
ARRAY of card objects (not a map). Use only standard ASCII double quotes in the
JSON.

Current board:
{board_json}
"""


def get_client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )


def model_name() -> str:
    return os.environ.get("OPENROUTER_MODEL_NAME", DEFAULT_MODEL)


def ask(prompt: str) -> str:
    response = get_client().chat.completions.create(
        model=model_name(),
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


def chat(board: dict, message: str, history: list[dict]) -> ChatResult:
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(board_json=json.dumps(board)),
        },
        *history,
        {"role": "user", "content": message},
    ]
    client = get_client()
    last_error: Exception | None = None
    for _ in range(3):
        try:
            # Some OpenRouter providers for this model ignore response_format
            # (none declare full structured-output support), so the schema is
            # also spelled out in the system prompt, temperature is kept low,
            # and bad or empty JSON is retried.
            response = client.chat.completions.parse(
                model=model_name(),
                messages=messages,
                response_format=ChatResult,
                temperature=0.2,
            )
            parsed = response.choices[0].message.parsed
            if parsed is not None:
                return parsed
            last_error = AIResponseError("model returned no parsable content")
        except ValidationError as error:
            last_error = error
    raise AIResponseError(str(last_error))
