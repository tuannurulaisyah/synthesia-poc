import { useRef, useState } from "react";
import { invoke } from "@forge/bridge";
import { Room, RoomEvent } from "livekit-client";
import { Box, xcss } from "@atlaskit/primitives";
import Button from "@atlaskit/button";
import Spinner from "@atlaskit/spinner";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";

const videoFrame = xcss({
  position: "relative",
  width: "100%",
  height: "500px",
  overflow: "hidden",
});

const overlay = xcss({
  position: "absolute",
  top: "0",
  left: "0",
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export default function App() {
  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | connecting | waiting | live
  const [error, setError] = useState(null);

  async function start() {
    try {
      setError(null);
      setState("connecting");
      const { url, token } = await invoke("getToken");

      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video") {
          track.attach(videoRef.current);
          setState("live");
        } else if (track.kind === "audio") {
          track.attach(audioRef.current);
        }
      });
      room.on(RoomEvent.Disconnected, () => setState("idle"));

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setState("waiting");
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  async function stop() {
    if (roomRef.current) await roomRef.current.disconnect();
  }

  const label = { idle: "Not connected", connecting: "Connecting", waiting: "Waiting for avatar", live: "Session On" }[state];
  const appearance = { idle: "default", connecting: "inprogress", waiting: "inprogress", live: "success" }[state];

  return (
    <Box padding="space.100">
      <Lozenge appearance={appearance}>{label}</Lozenge>

      {error && (
        <Box paddingBlock="space.100">
          <SectionMessage appearance="error" title="Could not start the session">
            <p>{error}</p>
          </SectionMessage>
        </Box>
      )}

      <Box paddingBlock="space.100">
        <Box xcss={videoFrame} style={{ background: "#000", borderRadius: 8 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
          {(state === "connecting" || state === "waiting") && (
            <Box xcss={overlay}>
              <Spinner size="large" />
            </Box>
          )}
        </Box>
      </Box>
      <audio ref={audioRef} autoPlay />

      {state === "idle" ? (
        <Button appearance="primary" onClick={start}>Start conversation</Button>
      ) : (
        <Button appearance="danger" onClick={stop}>End session</Button>
      )}
    </Box>
  );
}