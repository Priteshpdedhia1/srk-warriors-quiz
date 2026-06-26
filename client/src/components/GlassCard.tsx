import { motion } from "framer-motion";
export default function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
    className={`glass shadow-goldglow p-6 ${className}`}>{children}</motion.div>;
}
