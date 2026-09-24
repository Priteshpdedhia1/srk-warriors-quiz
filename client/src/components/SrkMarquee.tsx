import { motion } from "framer-motion";

const imgs = [1, 2, 3, 4, 5, 6].map(n => `${import.meta.env.BASE_URL}srk/${n}.jpg`);

// Auto-scrolling strip of gold-framed SRK photos. The row is duplicated so the
// loop is seamless, with a fade mask on both edges.
export default function SrkMarquee() {
  const row = [...imgs, ...imgs];
  return (
    <div className="w-full overflow-hidden py-2"
      style={{ WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
               maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
      <motion.div className="flex gap-4 w-max"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 30, ease: "linear" }}>
        {row.map((src, i) => (
          <div key={i}
            className="shrink-0 w-24 h-32 md:w-36 md:h-48 rounded-xl overflow-hidden border-2 border-gold-500/60 shadow-goldglow">
            <img src={src} alt="" className="w-full h-full object-cover" style={{ objectPosition: "50% 18%" }} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
