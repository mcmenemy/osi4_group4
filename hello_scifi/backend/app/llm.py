"""Claude call that turns plain text into a 10x sci-fi version."""

import os
from functools import lru_cache

import anthropic

MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-5-5")

SYSTEM_PROMPT = """You rewrite ordinary text as science fiction, cranked up ten times.
Keep the core events and meaning of the original so the reader can still recognize it, \
but transform the setting, objects, and stakes into vivid, over-the-top sci-fi: \
starships, alien worlds, AI, time paradoxes, whatever fits best.
Reply with only the rewritten text, no title or preamble, in under 250 words."""


class RefusalError(Exception):
    """Claude declined to rewrite the text."""


class MissingKeyError(Exception):
    """ANTHROPIC_API_KEY isn't set on the server."""


@lru_cache
def get_client() -> anthropic.AsyncAnthropic:
    # Created on first use so the app can start (and tests can run) without a key.
    return anthropic.AsyncAnthropic()


async def make_scifi(text: str) -> str:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise MissingKeyError
    response = await get_client().messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        output_config={"effort": "low"},
        messages=[{"role": "user", "content": text}],
    )
    if response.stop_reason == "refusal":
        raise RefusalError
    return "".join(block.text for block in response.content if block.type == "text").strip()
