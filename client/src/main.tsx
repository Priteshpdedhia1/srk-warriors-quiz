import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import BackgroundMusic from "./components/BackgroundMusic";
import Landing from "./pages/Landing";
import Rules from "./pages/Rules";
import HostLogin from "./pages/HostLogin";
import HostDashboard from "./pages/HostDashboard";
import HostCreate from "./pages/HostCreate";
import HostResults from "./pages/HostResults";
import HostGame from "./pages/HostGame";
import HostEnd from "./pages/HostEnd";
import Join from "./pages/Join";
import PlayerLobby from "./pages/PlayerLobby";
import PlayerPlay from "./pages/PlayerPlay";
import PlayerEnd from "./pages/PlayerEnd";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/rules", element: <Rules /> },
  { path: "/host/login", element: <HostLogin /> },
  { path: "/host", element: <HostDashboard /> },
  { path: "/host/create", element: <HostCreate /> },
  { path: "/host/results", element: <HostResults /> },
  { path: "/host/game/:gameId", element: <HostGame /> },
  { path: "/host/end/:gameId", element: <HostEnd /> },
  { path: "/join", element: <Join /> },
  { path: "/play/lobby", element: <PlayerLobby /> },
  { path: "/play", element: <PlayerPlay /> },
  { path: "/play/end", element: <PlayerEnd /> },
]);
const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={qc}>
    <BackgroundMusic />
    <RouterProvider router={router} />
  </QueryClientProvider></React.StrictMode>
);
