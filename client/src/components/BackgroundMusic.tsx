import { useEffect, useRef } from "react";
import { useSettings } from "../store/settingsStore";
import { useGame } from "../store/gameStore";

// Loops the SRK Warriors theme as low-volume background music, driven by the
// global 🎵 toggle. Paused while a question is on screen (quizActive) so it never
// clashes with the timer ticks. Browsers block autoplay until a user gesture, so
// if the first play() is rejected we retry on the next tap/click.
export default function BackgroundMusic() {
  const music = useSettings(s => s.music);
  const quizActive = useGame(s => s.quizActive);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      const a = new Audio(`${import.meta.env.BASE_URL}music.mp3`);
      a.loop = true; a.volume = 0.25;
      ref.current = a;
    }
    const a = ref.current;
    if (music && !quizActive) {
      a.play().catch(() => {
        const onGesture = () => {
          if (useSettings.getState().music && !useGame.getState().quizActive) a.play().catch(() => {});
        };
        window.addEventListener("pointerdown", onGesture, { once: true });
      });
    } else {
      a.pause();
    }
  }, [music, quizActive]);

  return null;
}
