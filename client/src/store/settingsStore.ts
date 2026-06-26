import { create } from "zustand";
import { persist } from "zustand/middleware";
interface S { music: boolean; sound: boolean; toggleMusic: () => void; toggleSound: () => void; }
export const useSettings = create<S>()(persist((set) => ({
  music: true, sound: true,
  toggleMusic: () => set(s => ({ music: !s.music })),
  toggleSound: () => set(s => ({ sound: !s.sound })),
}), { name: "srk-settings" }));
