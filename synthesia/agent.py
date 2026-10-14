from pathlib import Path
from html.parser import HTMLParser
import asyncio
import os
import re

import aiohttp
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, inference
from livekit.plugins import silero, synthesia

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

AVATAR_ID = os.environ["AVATAR_ID"]
CARTESIA_VOICE_ID = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4"


class _TextExtractor(HTMLParser):
    BLOCK = {"p", "br", "li", "tr", "div", "h1", "h2", "h3", "h4", "h5", "h6"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


async def fetch_confluence_page() -> tuple[str, str]:
    base = os.environ["CONFLUENCE_BASE_URL"]
    url = f"{base}/wiki/api/v2/pages/{os.environ['CONFLUENCE_PAGE_ID']}?body-format=storage"
    auth = aiohttp.BasicAuth(os.environ["CONFLUENCE_EMAIL"], os.environ["CONFLUENCE_API_TOKEN"])

    async with aiohttp.ClientSession(auth=auth, timeout=aiohttp.ClientTimeout(total=15)) as http:
        async with http.get(url) as resp:
            if resp.status != 200:
                raise RuntimeError(
                    f"Confluence returned HTTP {resp.status}. "
                    "401 = check email/token, 403/404 = check page ID or permissions."
                )
            data = await resp.json()

    extractor = _TextExtractor()
    extractor.feed(data["body"]["storage"]["value"])
    text = re.sub(r"\n\s*\n+", "\n", "".join(extractor.parts)).strip()
    return data["title"], text


def build_instructions(title: str, kb: str) -> str:
    return f"""
You are a friendly assistant shown as a real-time avatar.

Use the following Confluence page ("{title}") to answer the user's questions:

{kb}

Answer using this page when the question is related to it.
If the answer is not in the page, say that you don't have that information.

This is a spoken conversation, so never mention typing, reading or chat.
Answer in one to three short sentences. Never use bullet points or markdown.
"""


def prewarm(proc) -> None:
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    title, kb = await fetch_confluence_page()
    print(f"Loaded Confluence page '{title}' ({len(kb)} characters)")

    session = AgentSession(
        stt=inference.STT(model="cartesia/ink-2"),
        llm=inference.LLM(model="google/gemini-2.5-flash-lite"),
        tts=inference.TTS(
            model="cartesia/sonic-3.6",
            voice=CARTESIA_VOICE_ID,
        ),
        vad=ctx.proc.userdata["vad"],
    )

    avatar = synthesia.AvatarSession(
        synthesia.AvatarConfig(avatar_ids=[AVATAR_ID]),
        join_timeout=60.0,
    )

    for attempt in range(3):
        try:
            await avatar.start(session, room=ctx.room)
            break
        except synthesia.SynthesiaError as e:
            if not e.retryable or attempt == 2:
                raise
            await asyncio.sleep(2 * (attempt + 1))

    await session.start(
        agent=Agent(instructions=build_instructions(title, kb)),
        room=ctx.room,
    )

    session.generate_reply(
        instructions="Greet the user in one short sentence and invite them to ask about the page.",
        allow_interruptions=False,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="avatar-poc",
        )
    )