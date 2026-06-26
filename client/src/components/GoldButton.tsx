export default function GoldButton({ children, onClick, type = "button", disabled }:
  { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean }) {
  return <button type={type} onClick={onClick} disabled={disabled}
    className="font-bebas tracking-wider text-ink-900 text-xl px-8 py-3 rounded-full
      bg-gradient-to-r from-gold-700 via-gold-100 to-gold-700 shadow-goldglow
      hover:brightness-110 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
    {children}</button>;
}
