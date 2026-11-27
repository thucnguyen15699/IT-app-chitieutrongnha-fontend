import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { watchForNewVersion } from "./appUpdate";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache "none": luôn tải sw.js mới từ mạng để bản cập nhật đến được iPhone.
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error: unknown) => {
      console.error("Không thể đăng ký service worker:", error);
    });
  });
}

// Có bản mới sau khi deploy → tự tải lại, không cần tắt hẳn app trên iPhone.
watchForNewVersion();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
