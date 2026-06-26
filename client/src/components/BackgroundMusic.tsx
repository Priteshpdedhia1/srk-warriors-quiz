import { useEffect, useRef } from "react";
import { useSettings } from "../store/settingsStore";

// Loops the SRK Warriors theme as low-volume background music, driven by the
// global 🎵 toggle. Browsers block autoplay until a user gesture, so if the
// first play() is rejected we retry on the next tap/click.
export default function BackgroundMusic() {
  const music = useSettings(s => s.music);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      const a = new Audio("/music.mp3");
      a.loop = true; a.volume = 0.25;
      ref.current = a;
    }
    const a = ref.current;
    if (music) {
      a.play().catch(() => {
        const onGesture = () => { if (useSettings.getState().music) a.play().catch(() => {}); };
        window.addEventListener("pointerdown", onGesture, { once: true });
      });
    } else {
      a.pause();
    }
  }, [music]);

  return null;
}
