import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket/socket";
import { getToken } from "../hooks/useHostAuth";
import { DEFAULT_SETTINGS, type PlayerPublic } from "../lib/types";
import GlassCard from "../components/GlassCard";
import GoldButton from "../components/GoldButton";
import ParticleBg from "../components/ParticleBg";

export default function HostCreate() {
  const nav = useNavigate();
  const [pin, setPin] = useState(""); const [gameId, setGameId] = useState("");
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}join`;

  useEffect(() => {
    socket.emit("host:create", { token: getToken(), settings: DEFAULT_SETTINGS }, (r) => {
      if (r.ok) { setPin(r.pin); setGameId(r.gameId); }
    });
    const onLobby = (p: { players: PlayerPublic[] }) => setPlayers(p.players);
    socket.on("lobby:update", onLobby);
    return () => { socket.off("lobby:update", onLobby); };
  }, []);

  const start = () => {
    socket.emit("host:control", { token: getToken(), gameId, action: "start" }, () => {});
    nav(`/host/game/${gameId}`);
  };

  return (
    <div className="relative min-h-dvh p-6 flex flex-col items-center z-10">
      <ParticleBg />
      <GlassCard className="z-10 w-full max-w-4xl text-center">
        <p className="font-cinzel text-2xl text-cream-soft">Join at <span className="gold-text">{joinUrl}</span></p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 my-6">
          <div className="bg-white p-4 rounded-2xl">{pin && <QRCodeSVG value={joinUrl} size={200} />}</div>
          <div>
            <p className="text-cream-dim">Game PIN</p>
            <div className="font-bebas text-7xl md:text-8xl gold-text tracking-widest">{pin || "······"}</div>
          </div>
        </div>
        <p className="font-bebas text-3xl">{players.length} PLAYERS JOINED</p>
        <div className="flex flex-wrap gap-2 justify-center my-4 max-h-40 overflow-y-auto">
          {players.map(p => <span key={p.id} className="glass px-3 py-1 text-sm">{p.name}</span>)}
        </div>
        <GoldButton onClick={start} disabled={!gameId || players.length === 0}>START QUIZ</GoldButton>
      </GlassCard>
    </div>
  );
}
