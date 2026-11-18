"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TaraEmotion } from "./tara-avatar";

export interface Live2DAvatarCanvasProps {
  emotion: TaraEmotion;
  isSpeaking?: boolean;
  className?: string;
  onLoaded?: () => void;
  modelPath?: string;
}

const EMOTION_EXPRESSION_MAP: Record<TaraEmotion, string> = {
  idle: "F01",
  listening: "F01",
  thinking: "F02",
  speaking: "F01",
  alert: "F06",
  happy: "F05",
};

export const Live2DAvatarCanvas = React.memo(function Live2DAvatarCanvas({
  emotion,
  isSpeaking = false,
  className,
  onLoaded,
  modelPath = "/live2d/Haru/Haru.model3.json",
}: Live2DAvatarCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const modelRef = useRef<any>(null);
  const appRef = useRef<any>(null);
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;
  const emotionRef = useRef(emotion);
  emotionRef.current = emotion;
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  const currentExpressionRef = useRef<string | null>(null);

  // React to emotion changes
  useEffect(() => {
    if (!modelRef.current) return;
    const expressionName = EMOTION_EXPRESSION_MAP[emotion] || "F01";
    if (currentExpressionRef.current === expressionName) return;
    currentExpressionRef.current = expressionName;
    try {
      if (typeof modelRef.current.expression === "function") {
        modelRef.current.expression(expressionName);
      }
    } catch (e) {
      console.warn("[Live2D] Failed to set expression:", e);
    }
  }, [emotion]);

  useEffect(() => {
    let isDisposed = false;
    let localApp: any = null;
    let localModel: any = null;

    if (typeof window === "undefined" || !containerRef.current) return;

    const safeDestroyApp = (app: any) => {
      if (!app || app._isDestroyed) return;
      app._isDestroyed = true;
      try {
        if (typeof app.cancelResize !== "function") {
          app.cancelResize = () => {};
        }
        app.destroy(true, { children: true });
      } catch {}
    };

    const safeDestroyModel = (model: any) => {
      if (!model || model._isDestroyed) return;
      model._isDestroyed = true;
      try {
        if (model.internalModel?.motionManager?.expressionManager) {
          const expMgr = model.internalModel.motionManager.expressionManager;
          if (!Array.isArray(expMgr.expressions)) {
            expMgr.expressions = [];
          }
        }
        model.destroy();
      } catch {}
    };

    const initLive2D = async () => {
      try {
        // Step 1: Ensure Live2DCubismCore script is in document
        if (!(window as any).Live2DCubismCore) {
          await new Promise<void>((resolve, reject) => {
            const scriptId = "live2d-cubism-core-script";
            let script = document.getElementById(scriptId) as HTMLScriptElement | null;
            if (!script) {
              script = document.createElement("script");
              script.id = scriptId;
              script.src = "/live2d/live2dcubismcore.min.js";
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () =>
                reject(new Error("Failed to load live2dcubismcore.min.js"));
              document.head.appendChild(script);
            } else if ((window as any).Live2DCubismCore) {
              resolve();
            } else {
              script.addEventListener("load", () => resolve());
              script.addEventListener("error", reject);
            }
          });
        }

        if (isDisposed || !containerRef.current) return;

        // Step 2: Dynamically import PixiJS and Live2D plugin
        const PIXI = await import("pixi.js");
        (window as any).PIXI = PIXI;

        // Polyfill cancelResize for PixiJS v7 compatibility with pixi-live2d-display
        if (!(PIXI.Application.prototype as any).cancelResize) {
          (PIXI.Application.prototype as any).cancelResize = () => {};
        }

        const { Live2DModel, Cubism4ExpressionManager, config } = await import(
          "pixi-live2d-display/cubism4"
        );
        Live2DModel.registerTicker(PIXI.Ticker as any);

        // Safeguard ExpressionManager against aborted promises during unmount
        const proto = Cubism4ExpressionManager?.prototype as any;
        if (proto && !proto._isPatched) {
          proto._isPatched = true;
          proto.destroy = function (this: any) {
            this.destroyed = true;
            this.emit("destroy");
            this.definitions = [];
            this.expressions = [];
          };
        }

        // Seamless loop configuration: eliminate seam jumps, fading dips, and expression resets
        config.idleMotionFadingDuration = 0;
        config.motionFadingDuration = 300;
        config.preserveExpressionOnMotion = true;

        if (isDisposed || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const width = Math.max(250, rect.width || 256);
        const height = Math.max(250, rect.height || 256);

        // Step 3: Create Pixi Application (Unified shared ticker & stencil buffer for masks)
        localApp = new PIXI.Application({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
          sharedTicker: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          hello: false,
        });
        if (!(localApp as any).cancelResize) {
          (localApp as any).cancelResize = () => {};
        }
        appRef.current = localApp;
        (window as any).__live2dApp = localApp;

        if (isDisposed) {
          safeDestroyApp(localApp);
          return;
        }

        const canvasEl = localApp.view as HTMLCanvasElement;
        canvasEl.style.width = "100%";
        canvasEl.style.height = "100%";
        canvasEl.style.display = "block";
        canvasEl.style.pointerEvents = "auto";
        canvasEl.style.touchAction = "none";
        container.appendChild(canvasEl);

        // Step 4: Load Cubism 4 Model
        localModel = await Live2DModel.from(modelPath, {
          autoInteract: false,
        });

        if (isDisposed) {
          safeDestroyModel(localModel);
          safeDestroyApp(localApp);
          return;
        }

        modelRef.current = localModel;
        (window as any).__live2dModel = localModel;
        localApp.stage.addChild(localModel);

        // Configure natural procedural eye blink (gentle 5-second interval)
        if (localModel.internalModel?.eyeBlink) {
          localModel.internalModel.eyeBlink._blinkingIntervalSeconds = 5.0;
          localModel.internalModel.eyeBlink._closingSeconds = 0.12;
          localModel.internalModel.eyeBlink._closedSeconds = 0.05;
          localModel.internalModel.eyeBlink._openingSeconds = 0.15;
        }

        // Haru Model constants: Head center (1194, 562), Head width 772
        const headCenterX = 1194;
        const headCenterY = 562;
        const headWidth = 772;

        // Positioning & Scaling - Focus on Face & Head Area
        const updateLayout = () => {
          if (!localModel || !localApp?.renderer) return;
          const currentWidth = localApp.renderer.width / (window.devicePixelRatio || 1);
          const currentHeight = localApp.renderer.height / (window.devicePixelRatio || 1);

          // Scale so head takes ~75% of canvas width
          const scale = (currentWidth * 0.75) / headWidth;

          localModel.scale.set(scale);
          localModel.x = currentWidth / 2 - headCenterX * scale;
          localModel.y = currentHeight / 2 - (headCenterY + 40) * scale;
        };

        updateLayout();

        // Initial expression
        const initialExpr = EMOTION_EXPRESSION_MAP[emotionRef.current] || "F01";
        try {
          localModel.expression(initialExpr);
        } catch {}

        // Lip sync hook
        if (localModel.internalModel) {
          localModel.internalModel.on("beforeModelUpdate", () => {
            if (isSpeakingRef.current && localModel.internalModel?.coreModel) {
              const mouthOpen = Math.max(0, Math.sin(Date.now() / 90) * 0.65 + 0.35);
              (localModel.internalModel.coreModel as any).setParameterValueById?.(
                "ParamMouthOpenY",
                mouthOpen
              );
            }
          });
        }

        // Pointer tracking
        const handlePointerMove = (e: MouseEvent) => {
          if (!localModel || !containerRef.current) return;
          const containerRect = containerRef.current.getBoundingClientRect();
          const centerX = containerRect.left + containerRect.width / 2;
          const centerY = containerRect.top + containerRect.height / 2;

          const ndcX = Math.max(
            -1,
            Math.min(1, (e.clientX - centerX) / (window.innerWidth / 2))
          );
          const ndcY = Math.max(
            -1,
            Math.min(1, (e.clientY - centerY) / (window.innerHeight / 2))
          );

          if (localModel.internalModel?.focusController) {
            localModel.internalModel.focusController.focus(ndcX, -ndcY);
          }
        };

        window.addEventListener("pointermove", handlePointerMove, { passive: true });

        // Resize observer with integer rounding to prevent fractional jitter
        let lastW = Math.round(width);
        let lastH = Math.round(height);
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const newW = Math.round(entry.contentRect.width);
            const newH = Math.round(entry.contentRect.height);
            if (newW > 0 && newH > 0 && (newW !== lastW || newH !== lastH) && localApp?.renderer) {
              lastW = newW;
              lastH = newH;
              localApp.renderer.resize(newW, newH);
              updateLayout();
            }
          }
        });
        resizeObserver.observe(container);

        setIsLoading(false);
        onLoadedRef.current?.();

        return () => {
          window.removeEventListener("pointermove", handlePointerMove);
          resizeObserver.disconnect();
        };
      } catch (err: any) {
        console.error("[Live2D] Init error:", err);
        if (!isDisposed) {
          setLoadError(err?.message || "Failed to load Live2D avatar");
          setIsLoading(false);
        }
      }
    };

    let cleanupPromise = initLive2D();

    return () => {
      isDisposed = true;
      cleanupPromise.then((cleanupFn) => cleanupFn && cleanupFn());
      if (localModel) {
        safeDestroyModel(localModel);
        localModel = null;
      }
      if (localApp) {
        safeDestroyApp(localApp);
        localApp = null;
      }
      modelRef.current = null;
      appRef.current = null;
    };
  }, [modelPath]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
        className || ""
      }`}
    >
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-card/80 backdrop-blur-xs z-20 text-primary">
          <Loader2 className="w-7 h-7 animate-spin mb-2 text-primary" />
          <span className="text-[11px] tracking-wider font-mono text-muted-foreground">
            กำลังโหลด Live2D Engine...
          </span>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-card/90 p-4 text-center z-20">
          <p className="text-xs text-destructive font-mono mb-1">
            Live2D Error: {loadError}
          </p>
          <span className="text-[11px] text-muted-foreground">
            โปรดตรวจสอบการรองรับ WebGL ของเบราว์เซอร์
          </span>
        </div>
      )}
    </div>
  );
});
