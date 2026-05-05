"use client";

import { useEffect } from "react";

export default function PWAInstaller({ ...props }) {
  // 仅在客户端挂载后动态加载 Web Component 库
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@khmyznikov/pwa-install");
    }
  }, []);

  return (
    // @ts-ignore
    <pwa-install id={`pwa-install`} {...props}></pwa-install>
  );
}

export type PWAInstallerMethods = {
  install: (force?: boolean) => void;
  isListening?: boolean;
  showDialog: (force?: boolean) => void;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
};

export function usePWAInstaller() {
  // 增加环境判断，防止在服务端执行时报错
  const getInstallerElement = (): PWAInstallerMethods | null => {
    if (typeof window === "undefined") return null;
    return document.getElementById("pwa-install") as unknown as PWAInstallerMethods;
  };

  return {
    install: (force?: boolean) => {
      const installer = getInstallerElement();
      if (!installer) return; // 服务端直接返回

      installer.showDialog(force);

      console.log(
        `[installer] ${force ? "forced" : "prompted"} installation to:`,
        installer,
      );

      if (installer && !installer.isListening) {
        // register events
        installer.isListening = true;

        installer.addEventListener("pwa-install-success-event", (e) => {
          console.log("[installer] installation success:", e);
        });

        installer.addEventListener("pwa-install-fail-event", (e) => {
          console.error("[installer] installation failed:", e);
        });

        installer.addEventListener("pwa-install-available-event", (e) => {
          console.log("[installer] installation available:", e);
        });

        installer.addEventListener("pwa-user-choice-result-event", (e) => {
          console.log("[installer] user choice result:", e);
        });

        installer.addEventListener("pwa-install-how-to-event", (e) => {
          console.log("[installer] installation how to:", e);
        });

        installer.addEventListener("pwa-install-gallery-event", (e) => {
          console.log("[installer] installation gallery:", e);
        });
      }
    },
  };
}