import { useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";

export default function App() {
  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const [status, setStatus] = useState("Click Start and allow the microphone.");
  const [active, setActive] = useState(false);

  async function start() {
    try {
      setActive(true);
      setStatus("Connecting...");
      const { url, token } = await (await fetch("/token")).json();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "video") {
          track.attach(videoRef.current);
          setStatus("Connected. Say hello!");
        } else if (track.kind === "audio") {
          track.attach(audioRef.current);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        setActive(false);
        setStatus("Disconnected. Click Start to talk again.");
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setStatus("Connected. Waiting for the avatar to join...");
    } catch (err) {
      setActive(false);
      setStatus("Failed: " + err.message);
    }
  }

  async function stop() {
    if (roomRef.current) await roomRef.current.disconnect();
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Synthesia Interactive Avatar POC</h2>
      <video ref={videoRef} autoPlay playsInline style={{ width: "100%", background: "#000", borderRadius: 8 }} />
      <audio ref={audioRef} autoPlay />
      <p>{status}</p>
      <button onClick={active ? stop : start}>{active ? "End session" : "Start"}</button>
    </div>
  );
}