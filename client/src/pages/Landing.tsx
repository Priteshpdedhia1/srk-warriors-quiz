import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ParticleBg from "../components/ParticleBg";
import GoldButton from "../components/GoldButton";
import SrkLogo from "../components/SrkLogo";
import SrkMarquee from "../components/SrkMarquee";
import { useSettings } from "../store/settingsStore";
export default function Landing() {
  const nav = useNavigate();
  const { music, sound, toggleMusic, toggleSound } = useSettings();
  const fs = () => document.documentElement.requestFullscreen?.();
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center text-center px-6 py-10">
      <ParticleBg />
      <div className="absolute top-4 right-4 flex gap-3 z-10">
        <button onClick={toggleMusic} className="glass px-3 py-2">{music ? "🎵" : "🔇"}</button>
        <button onClick={toggleSound} className="glass px-3 py-2">{sound ? "🔊" : "🔕"}</button>
        <button onClick={fs} className="glass px-3 py-2">⛶</button>
      </div>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="z-10 flex flex-col items-center">
        <SrkLogo size={160} />
        <h1 className="font-cinzel font-black text-4xl md:text-6xl gold-text leading-tight mt-6">SRK WARRIORS<br/>QUIZ CHAMPIONSHIP</h1>
        <p className="font-vibes text-3xl text-cream-soft mt-3">Celebrating 34 Years of Shah Rukh Khan</p>
        <p className="font-vibes text-2xl text-cream-soft">Celebrating 7 Years of SRK Warriors</p>
      </motion.div>
      <div className="z-10 w-full max-w-5xl my-8"><SrkMarquee /></div>
      <div className="z-10 flex flex-wrap gap-4 justify-center">
        <GoldButton onClick={() => nav("/host/login")}>HOST QUIZ</GoldButton>
        <GoldButton onClick={() => nav("/join")}>JOIN QUIZ</GoldButton>
        <GoldButton onClick={() => nav("/rules")}>RULES</GoldButton>
      </div>
    </div>
  );
}
