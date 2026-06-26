import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { 50:"#fbe8a6", 100:"#f6d57a", 300:"#f0c75e", 500:"#d4a434", 700:"#c8922a", 900:"#b8860b" },
        ink: { 900:"#0a0703", 800:"#0d0a04", 700:"#14100a" },
        cream: { DEFAULT:"#faf6ea", soft:"#f3e3b3", dim:"#e8d9ad" },
        ruby: { DEFAULT:"#a31010", dark:"#7c0b0b" },
      },
      fontFamily: {
        cinzel: ['Cinzel','serif'], bebas: ['"Bebas Neue"','sans-serif'],
        vibes: ['"Great Vibes"','cursive'], body: ['Montserrat','sans-serif'],
      },
      boxShadow: { goldglow: "0 0 26px rgba(240,199,94,.30), inset 0 0 18px rgba(240,199,94,.12)" },
    },
  },
  plugins: [],
} satisfies Config;
