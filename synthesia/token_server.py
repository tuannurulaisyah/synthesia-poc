import os
import uuid
from datetime import timedelta
from pathlib import Path

from aiohttp import web
from dotenv import load_dotenv
from livekit import api

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")


async def token(request: web.Request) -> web.Response:
    room = f"avatar-poc-{uuid.uuid4().hex[:8]}"   # new room each time so the agent is dispatched
    jwt = (
        api.AccessToken()   # reads LIVEKIT_API_KEY / LIVEKIT_API_SECRET
        .with_identity(f"user-{uuid.uuid4().hex[:8]}")
        .with_ttl(timedelta(minutes=5))
        .with_grants(api.VideoGrants(room_join=True, room=room))
        .with_room_config(
            api.RoomConfiguration(
                sync_streams=True,
                agents=[api.RoomAgentDispatch(agent_name="avatar-poc")],  # must match agent.py
            )
        )
        .to_jwt()
    )
    return web.json_response({"url": os.environ["LIVEKIT_URL"], "token": jwt})


app = web.Application()
app.router.add_get("/token", token)

if __name__ == "__main__":
    web.run_app(app, host="127.0.0.1", port=8080)