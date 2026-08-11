import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./Root";
import { registerServiceWorker } from "./lib/pushNotifications";
import "./styles/index.css";

// Register the service worker as early as possible so the registration
// is cached and available synchronously during user gesture handlers (iOS).
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
