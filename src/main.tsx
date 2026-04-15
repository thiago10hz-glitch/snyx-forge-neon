import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Render immediately
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Performance: report web vitals in dev
if (import.meta.env.DEV) {
  import('web-vitals').then(({ onCLS, onFID, onLCP, onFCP, onTTFB }) => {
    onCLS(console.log);
    onFID(console.log);
    onLCP(console.log);
    onFCP(console.log);
    onTTFB(console.log);
  }).catch(() => {});
}
