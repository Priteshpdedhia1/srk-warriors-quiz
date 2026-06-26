import { useState } from "react";
import { motion } from "framer-motion";

// Circular SRK Warriors medallion with a gold glow ring and a gentle float.
// Falls back to a crown if /logo.png isn't present yet.
export default function SrkLogo({ size = 150 }: { size?: number }) {
  const [ok, setOk] = useState(true);
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      className="rounded-full overflow-hidden"
      style={{ width: size, height: size,
        boxShadow: "0 0 42px rgba(240,199,94,.45), inset 0 0 18px rgba(0,0,0,.4)",
        border: "2px solid rgba(240,199,94,.65)",
        background: "radial-gradient(circle at 50% 35%, #2a2010, #0d0a04 75%)" }}>
      {ok
        ? <img src="/logo.png" alt="SRK Warriors" onError={() => setOk(false)}
            className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: size * 0.4 }}>👑</div>}
    </motion.div>
  );
}
