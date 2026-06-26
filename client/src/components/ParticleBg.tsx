import { motion } from "framer-motion";
const dots = Array.from({ length: 18 }, (_, i) => ({
  id: i, x: Math.random() * 100, y: Math.random() * 100,
  s: 4 + Math.random() * 10, d: 6 + Math.random() * 8, delay: Math.random() * 5,
}));
export default function ParticleBg() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {dots.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s,
            background: "radial-gradient(circle, rgba(255,215,120,.9), rgba(255,200,80,.04) 70%)" }}
          animate={{ y: [0, -30, 0], opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: p.d, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </div>
  );
}
