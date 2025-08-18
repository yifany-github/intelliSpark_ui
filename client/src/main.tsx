import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AgeVerificationProvider } from "./contexts/AgeVerificationContext";

createRoot(document.getElementById("root")!).render(
  <AgeVerificationProvider>
    <App />
  </AgeVerificationProvider>
);
