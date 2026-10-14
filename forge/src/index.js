import Resolver from "@forge/resolver";
import { randomUUID } from "crypto";
import { AccessToken, RoomConfiguration, RoomAgentDispatch } from "livekit-server-sdk";

const resolver = new Resolver();

resolver.define("getToken", async () => {
  const room = `avatar-poc-${randomUUID().slice(0, 8)}`;
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: `user-${randomUUID().slice(0, 8)}`,
    ttl: "5m",
  });
  at.addGrant({ roomJoin: true, room });
  at.roomConfig = new RoomConfiguration({
    syncStreams: true,
    agents: [new RoomAgentDispatch({ agentName: "avatar-poc" })],
  });
  return { url: process.env.LIVEKIT_URL, token: await at.toJwt() };
});

export const handler = resolver.getDefinitions();