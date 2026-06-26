import { getToken } from "../hooks/useHostAuth";

// Plain anchor downloads — the token rides in the query string because a browser
// download link can't send an Authorization header. Host-only, short-lived JWT.
export default function DownloadResults({ gameId }: { gameId: string }) {
  const base = import.meta.env.VITE_SERVER_URL as string;
  const token = encodeURIComponent(getToken());
  const link = (path: string) => `${base}/results/${gameId}/${path}?token=${token}`;
  const jsonLink = `${base}/results/${gameId}.json?token=${token}`;
  const btn = "glass px-5 py-2 font-semibold hover:border-gold-300 transition";
  return (
    <>
      <a className={btn} href={link("leaderboard.csv")}>⬇ Scores (CSV)</a>
      <a className={btn} href={link("answers.csv")}>⬇ All Answers (CSV)</a>
      <a className={btn} href={jsonLink}>⬇ Full Data (JSON)</a>
    </>
  );
}
