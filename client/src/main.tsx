import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import { AgeVerificationProvider } from "./contexts/AgeVerificationContext";

// Initialize Sentry for error tracking
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  enabled: !!import.meta.env.VITE_SENTRY_DSN, // Only enable if DSN is provided
});

createRoot(document.getElementById("root")!).render(
  <AgeVerificationProvider>
    <App />
  </AgeVerificationProvider>
);
