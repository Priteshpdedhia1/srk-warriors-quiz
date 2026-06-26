import { useNavigate } from "react-router-dom";
export const getToken = () => localStorage.getItem("srk-host-token") ?? "";
export function useHostAuth() {
  const nav = useNavigate();
  const token = getToken();
  return { token, require: () => { if (!token) nav("/host/login"); } };
}
