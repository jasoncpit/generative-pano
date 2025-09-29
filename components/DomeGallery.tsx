"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useGesture } from "@use-gesture/react";
import styles from "./DomeGallery.module.css";

export type DomeImage = { src: string; alt?: string } | string;

const DEFAULTS = {
  maxVerticalRotationDeg: 5,
  dragSensitivity: 20,
  enlargeTransitionMs: 300,
  segments: 32,
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const wrapAngleSigned = (deg: number) => {
  const a = (((deg + 180) % 360) + 360) % 360;
  return a - 180;
};

const normalizeAngle = (deg: number) => ((deg % 360) + 360) % 360;

const getDataNumber = (el: HTMLElement, name: string, fallback: number) => {
  const attr = (el as any).dataset?.[name] ?? el.getAttribute(`data-${name}`);
  const n = attr == null ? NaN : parseFloat(String(attr));
  return Number.isFinite(n) ? (n as number) : fallback;
};

function computeItemBaseRotation(offsetX: number, offsetY: number, sizeX: number, sizeY: number, segments: number) {
  const unit = 360 / segments / 2;
  const rotateY = unit * (offsetX + (sizeX - 1) / 2);
  const rotateX = unit * (offsetY - (sizeY - 1) / 2);
  return { rotateX, rotateY };
}

function normalizeSrc(src: string): string {
  if (!src) return src;
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return src;
  // handle './images/foo.jpg' or 'images/foo.jpg'
  if (src.startsWith('./')) return src.slice(1);
  if (src.startsWith('images/')) return `/${src}`;
  return src;
}

function buildItems(pool: DomeImage[], seg: number) {
  const xCols = Array.from({ length: seg }, (_, i) => -37 + i * 2);
  const evenYs = [-4, -2, 0, 2, 4];
  const oddYs = [-3, -1, 1, 3, 5];

  const coords = xCols.flatMap((x, c) => {
    const ys = c % 2 === 0 ? evenYs : oddYs;
    return ys.map((y) => ({ x, y, sizeX: 2, sizeY: 2 }));
  });

  const totalSlots = coords.length;
  if (pool.length === 0) return coords.map((c) => ({ ...c, src: "", alt: "" }));

  const normalized = pool.map((image) => (typeof image === "string" ? { src: normalizeSrc(image), alt: "" } : { src: normalizeSrc(image.src || ""), alt: image.alt || "" }));
  const used = Array.from({ length: totalSlots }, (_, i) => normalized[i % normalized.length]);

  for (let i = 1; i < used.length; i++) {
    if (used[i].src === used[i - 1].src) {
      for (let j = i + 1; j < used.length; j++) {
        if (used[j].src !== used[i].src) {
          const t = used[i];
          used[i] = used[j];
          used[j] = t;
          break;
        }
      }
    }
  }

  return coords.map((c, i) => ({ ...c, src: used[i].src, alt: used[i].alt }));
}

export default function DomeGallery({
  images,
  onSelect,
  fit = 1,
  fitBasis = "auto",
  minRadius = 2000,
  maxRadius = Infinity,
  padFactor = 0.25,
  overlayBlurColor = "#060010",
  maxVerticalRotationDeg = DEFAULTS.maxVerticalRotationDeg,
  dragSensitivity = DEFAULTS.dragSensitivity,
  enlargeTransitionMs = DEFAULTS.enlargeTransitionMs,
  segments = DEFAULTS.segments,
  dragDampening = 2,
  imageBorderRadius = "30px",
  openedImageBorderRadius = "30px",
  grayscale = false,
  openedImageWidth,
  openedImageHeight,
}: {
  images: DomeImage[];
  onSelect: (src: string) => void;
  fit?: number;
  fitBasis?: "auto" | "min" | "max" | "width" | "height";
  minRadius?: number;
  maxRadius?: number;
  padFactor?: number;
  overlayBlurColor?: string;
  maxVerticalRotationDeg?: number;
  dragSensitivity?: number;
  enlargeTransitionMs?: number;
  segments?: number;
  dragDampening?: number;
  imageBorderRadius?: string;
  openedImageBorderRadius?: string;
  grayscale?: boolean;
  openedImageWidth?: string;
  openedImageHeight?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const sphereRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const focusedElRef = useRef<HTMLElement | null>(null);
  const originalTilePositionRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const rotationRef = useRef({ x: 0, y: 0 });
  const startRotRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const inertiaRAF = useRef<number | null>(null);

  const openingRef = useRef(false);
  const openStartedAtRef = useRef(0);
  const lastDragEndAt = useRef(0);

  const scrollLockedRef = useRef(false);
  const lockScroll = useCallback(() => {
    if (scrollLockedRef.current) return;
    scrollLockedRef.current = true;
    document.body.classList.add(styles.dgScrollLock);
  }, []);
  const unlockScroll = useCallback(() => {
    if (!scrollLockedRef.current) return;
    if (rootRef.current?.getAttribute("data-enlarging") === "true") return;
    scrollLockedRef.current = false;
    document.body.classList.remove(styles.dgScrollLock);
  }, []);

  const items = useMemo(() => buildItems(images, segments), [images, segments]);

  const applyTransform = (xDeg: number, yDeg: number) => {
    const el = sphereRef.current;
    if (el) el.style.transform = `translateZ(calc(var(--radius) * -1)) rotateX(${xDeg}deg) rotateY(${yDeg}deg)`;
  };

  // Resolve CSS module class names that are used dynamically
  const enlargeClass = (styles as any).enlarge || "enlarge";
  const enlargeClosingClass = (styles as any)["enlarge-closing"] || "enlarge-closing";
  const scrimClass = (styles as any).scrim || "scrim";
  const frameClass = (styles as any).frame || "frame";

  const lockedRadiusRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current!;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const w = Math.max(1, cr.width), h = Math.max(1, cr.height);
      const minDim = Math.min(w, h), maxDim = Math.max(w, h), aspect = w / h;
      let basis: number;
      switch (fitBasis) {
        case "min": basis = minDim; break;
        case "max": basis = maxDim; break;
        case "width": basis = w; break;
        case "height": basis = h; break;
        default: basis = aspect >= 1.3 ? w : minDim;
      }
      let radius = basis * fit;
      const heightGuard = h * 1.35;
      radius = Math.min(radius, heightGuard);
      radius = clamp(radius, minRadius, maxRadius);
      lockedRadiusRef.current = Math.round(radius);

      const viewerPad = Math.max(8, Math.round(minDim * padFactor));
      root.style.setProperty("--radius", `${lockedRadiusRef.current}px`);
      root.style.setProperty("--viewer-pad", `${viewerPad}px`);
      root.style.setProperty("--overlay-blur-color", overlayBlurColor);
      root.style.setProperty("--tile-radius", imageBorderRadius);
      root.style.setProperty("--enlarge-radius", openedImageBorderRadius);
      root.style.setProperty("--image-filter", grayscale ? "grayscale(1)" : "none");
      applyTransform(rotationRef.current.x, rotationRef.current.y);

      const enlargedOverlay = viewerRef.current?.querySelector(`.${enlargeClass}`) as HTMLElement | null;
      if (enlargedOverlay && frameRef.current && mainRef.current) {
        const frameR = frameRef.current.getBoundingClientRect();
        const mainR = mainRef.current.getBoundingClientRect();

        const hasCustomSize = Boolean(openedImageWidth && openedImageHeight);
        if (hasCustomSize) {
          const tempDiv = document.createElement("div");
          tempDiv.style.cssText = `position: absolute; width: ${openedImageWidth}; height: ${openedImageHeight}; visibility: hidden;`;
          document.body.appendChild(tempDiv);
          const tempRect = tempDiv.getBoundingClientRect();
          document.body.removeChild(tempDiv);

          const centeredLeft = frameR.left - mainR.left + (frameR.width - tempRect.width) / 2;
          const centeredTop = frameR.top - mainR.top + (frameR.height - tempRect.height) / 2;

          enlargedOverlay.style.left = `${centeredLeft}px`;
          enlargedOverlay.style.top = `${centeredTop}px`;
        } else {
          enlargedOverlay.style.left = `${frameR.left - mainR.left}px`;
          enlargedOverlay.style.top = `${frameR.top - mainR.top}px`;
          enlargedOverlay.style.width = `${frameR.width}px`;
          enlargedOverlay.style.height = `${frameR.height}px`;
        }
      }
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [fit, fitBasis, minRadius, maxRadius, padFactor, overlayBlurColor, grayscale, imageBorderRadius, openedImageBorderRadius, openedImageWidth, openedImageHeight]);

  useEffect(() => { applyTransform(rotationRef.current.x, rotationRef.current.y); }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRAF.current) {
      cancelAnimationFrame(inertiaRAF.current);
      inertiaRAF.current = null;
    }
  }, []);

  const startInertia = useCallback((vx: number, vy: number) => {
    const MAX_V = 1.4;
    let vX = clamp(vx, -MAX_V, MAX_V) * 80;
    let vY = clamp(vy, -MAX_V, MAX_V) * 80;
    let frames = 0;
    const d = clamp(dragDampening ?? 0.6, 0, 1);
    const frictionMul = 0.94 + 0.055 * d;
    const stopThreshold = 0.015 - 0.01 * d;
    const maxFrames = Math.round(90 + 270 * d);
    const step = () => {
      vX *= frictionMul; vY *= frictionMul;
      if (Math.abs(vX) < stopThreshold && Math.abs(vY) < stopThreshold) { inertiaRAF.current = null; return; }
      if (++frames > maxFrames) { inertiaRAF.current = null; return; }
      const nextX = clamp(rotationRef.current.x - vY / 200, -maxVerticalRotationDeg, maxVerticalRotationDeg);
      const nextY = wrapAngleSigned(rotationRef.current.y + vX / 200);
      rotationRef.current = { x: nextX, y: nextY };
      applyTransform(nextX, nextY);
      inertiaRAF.current = requestAnimationFrame(step);
    };
    stopInertia();
    inertiaRAF.current = requestAnimationFrame(step);
  }, [dragDampening, maxVerticalRotationDeg, stopInertia]);

  useGesture(
    {
      onDragStart: ({ event }) => {
        if (focusedElRef.current) return;
        stopInertia();
        const evt = event as PointerEvent;
        draggingRef.current = true; movedRef.current = false;
        startRotRef.current = { ...rotationRef.current };
        startPosRef.current = { x: evt.clientX, y: evt.clientY };
      },
      onDrag: ({ event, last, velocity = [0, 0], direction = [0, 0], movement }) => {
        if (focusedElRef.current || !draggingRef.current || !startPosRef.current) return;
        const evt = event as PointerEvent;
        const dxTotal = evt.clientX - startPosRef.current.x;
        const dyTotal = evt.clientY - startPosRef.current.y;
        if (!movedRef.current) {
          const dist2 = dxTotal * dxTotal + dyTotal * dyTotal;
          if (dist2 > 16) movedRef.current = true;
        }
        const nextX = clamp(startRotRef.current.x - dyTotal / dragSensitivity, -maxVerticalRotationDeg, maxVerticalRotationDeg);
        const nextY = wrapAngleSigned(startRotRef.current.y + dxTotal / dragSensitivity);
        if (rotationRef.current.x !== nextX || rotationRef.current.y !== nextY) {
          rotationRef.current = { x: nextX, y: nextY };
          applyTransform(nextX, nextY);
        }
        if (last) {
          draggingRef.current = false;
          let [vMagX, vMagY] = velocity;
          const [dirX, dirY] = direction as number[];
          let vx = vMagX * dirX; let vy = vMagY * dirY;
          if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001 && Array.isArray(movement)) {
            const [mx, my] = movement as number[];
            vx = clamp((mx / dragSensitivity) * 0.02, -1.2, 1.2);
            vy = clamp((my / dragSensitivity) * 0.02, -1.2, 1.2);
          }
          if (Math.abs(vx) > 0.005 || Math.abs(vy) > 0.005) startInertia(vx, vy);
          if (movedRef.current) lastDragEndAt.current = performance.now();
          movedRef.current = false;
        }
      },
    },
    { target: mainRef as any, eventOptions: { passive: true } }
  );

  const openItemFromElement = useCallback((el: HTMLElement) => {
    if (openingRef.current) return;
    openingRef.current = true;
    openStartedAtRef.current = performance.now();
    lockScroll();

    const parent = el.parentElement as HTMLElement;
    focusedElRef.current = el;
    el.setAttribute("data-focused", "true");

    const offsetX = getDataNumber(parent, "offsetX", 0);
    const offsetY = getDataNumber(parent, "offsetY", 0);
    const sizeX = getDataNumber(parent, "sizeX", 2);
    const sizeY = getDataNumber(parent, "sizeY", 2);

    const parentRot = computeItemBaseRotation(offsetX, offsetY, sizeX, sizeY, segments);
    const parentY = normalizeAngle(parentRot.rotateY);
    const globalY = normalizeAngle(rotationRef.current.y);
    let rotY = -(parentY + globalY) % 360;
    if (rotY < -180) rotY += 360;
    const rotX = -parentRot.rotateX - rotationRef.current.x;
    parent.style.setProperty("--rot-y-delta", `${rotY}deg`);
    parent.style.setProperty("--rot-x-delta", `${rotX}deg`);

    const tileR = el.getBoundingClientRect();
    const mainR = mainRef.current!.getBoundingClientRect();
    const frameR = frameRef.current!.getBoundingClientRect();
    originalTilePositionRef.current = {
      left: tileR.left,
      top: tileR.top,
      width: tileR.width,
      height: tileR.height,
    };

    el.style.visibility = "hidden";
    (el.style as any).zIndex = 0;

    const overlay = document.createElement("div");
    overlay.className = enlargeClass;
    overlay.style.position = "absolute";
    overlay.style.left = frameR.left - mainR.left + "px";
    overlay.style.top = frameR.top - mainR.top + "px";
    overlay.style.width = frameR.width + "px";
    overlay.style.height = frameR.height + "px";
    overlay.style.opacity = "0";
    overlay.style.zIndex = "30";
    overlay.style.willChange = "transform, opacity";
    overlay.style.transformOrigin = "top left";
    overlay.style.transition = `transform ${enlargeTransitionMs}ms ease, opacity ${enlargeTransitionMs}ms ease`;

    const rawSrc = parent.getAttribute("data-src") || (el.querySelector("img") as HTMLImageElement)?.src || "";
    const rawAlt = (el.querySelector("img") as HTMLImageElement)?.alt || "";
    const img = document.createElement("img");
    img.src = rawSrc;
    overlay.appendChild(img);

    // Action bar (alt + button)
    const actionBar = document.createElement("div");
    actionBar.style.position = "absolute";
    actionBar.style.left = "0";
    actionBar.style.right = "0";
    actionBar.style.bottom = "0";
    actionBar.style.padding = "12px 14px";
    actionBar.style.display = "flex";
    actionBar.style.alignItems = "center";
    actionBar.style.justifyContent = "space-between";
    actionBar.style.background = "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.7) 100%)";
    actionBar.style.color = "white";
    actionBar.style.gap = "12px";
    actionBar.style.pointerEvents = "auto";

    const altSpan = document.createElement("div");
    altSpan.textContent = rawAlt || "Selected image";
    altSpan.style.fontSize = "14px";
    altSpan.style.textShadow = "0 1px 2px rgba(0,0,0,.7)";
    altSpan.style.overflow = "hidden";
    altSpan.style.textOverflow = "ellipsis";
    altSpan.style.whiteSpace = "nowrap";
    altSpan.style.flex = "1 1 auto";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open";
    openBtn.style.flex = "0 0 auto";
    openBtn.style.padding = "8px 12px";
    openBtn.style.borderRadius = "10px";
    openBtn.style.border = "1px solid rgba(255,255,255,.6)";
    openBtn.style.background = "rgba(255,255,255,.1)";
    openBtn.style.color = "white";
    openBtn.style.backdropFilter = "blur(6px)";
    openBtn.style.cursor = "pointer";
    openBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (rawSrc) onSelect(rawSrc);
    });

    actionBar.appendChild(altSpan);
    actionBar.appendChild(openBtn);
    overlay.appendChild(actionBar);

    viewerRef.current!.appendChild(overlay);

    const tx0 = tileR.left - frameR.left;
    const ty0 = tileR.top - frameR.top;
    const sx0 = tileR.width / frameR.width;
    const sy0 = tileR.height / frameR.height;
    overlay.style.transform = `translate(${tx0}px, ${ty0}px) scale(${sx0}, ${sy0})`;
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "translate(0px, 0px) scale(1, 1)";
      rootRef.current?.setAttribute("data-enlarging", "true");
    });

    const wantsResize = Boolean(openedImageWidth || openedImageHeight);
    if (wantsResize) {
      const onFirstEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== "transform") return;
        overlay.removeEventListener("transitionend", onFirstEnd);
        const prevTransition = overlay.style.transition;
        overlay.style.transition = "none";
        const tempWidth = openedImageWidth || `${frameR.width}px`;
        const tempHeight = openedImageHeight || `${frameR.height}px`;
        overlay.style.width = tempWidth;
        overlay.style.height = tempHeight;
        const newRect = overlay.getBoundingClientRect();
        overlay.style.width = frameR.width + "px";
        overlay.style.height = frameR.height + "px";
        void overlay.offsetWidth;
        overlay.style.transition = `left ${enlargeTransitionMs}ms ease, top ${enlargeTransitionMs}ms ease, width ${enlargeTransitionMs}ms ease, height ${enlargeTransitionMs}ms ease`;
        const centeredLeft = frameR.left - mainR.left + (frameR.width - newRect.width) / 2;
        const centeredTop = frameR.top - mainR.top + (frameR.height - newRect.height) / 2;
        requestAnimationFrame(() => {
          overlay.style.left = `${centeredLeft}px`;
          overlay.style.top = `${centeredTop}px`;
          overlay.style.width = tempWidth;
          overlay.style.height = tempHeight;
        });
        const cleanupSecond = () => {
          overlay.removeEventListener("transitionend", cleanupSecond);
          overlay.style.transition = prevTransition;
        };
        overlay.addEventListener("transitionend", cleanupSecond, { once: true });
      };
      overlay.addEventListener("transitionend", onFirstEnd);
    }
  }, [dragSensitivity, enlargeTransitionMs, lockScroll, openedImageHeight, openedImageWidth, segments]);

  const onTileClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingRef.current) return;
    if (performance.now() - lastDragEndAt.current < 80) return;
    if (openingRef.current) return;
    openItemFromElement(e.currentTarget as HTMLElement);
  }, [openItemFromElement]);

  const onTilePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    if (draggingRef.current) return;
    if (performance.now() - lastDragEndAt.current < 80) return;
    if (openingRef.current) return;
    openItemFromElement(e.currentTarget as HTMLElement);
  }, [openItemFromElement]);

  const onTileTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (draggingRef.current) return;
    if (performance.now() - lastDragEndAt.current < 80) return;
    if (openingRef.current) return;
    openItemFromElement(e.currentTarget as HTMLElement);
  }, [openItemFromElement]);

  useEffect(() => {
    const scrim = scrimRef.current;
    if (!scrim) return;

    const close = () => {
      if (performance.now() - openStartedAtRef.current < 250) return;

      const el = focusedElRef.current;
      if (!el) return;
      const parent = el.parentElement as HTMLElement;
      const overlay = viewerRef.current?.querySelector(`.${enlargeClass}`) as HTMLElement | null;
      if (!overlay) return;

      const originalPos = originalTilePositionRef.current;
      if (!originalPos) {
        overlay.remove();
        parent.style.setProperty("--rot-y-delta", `0deg`);
        parent.style.setProperty("--rot-x-delta", `0deg`);
        el.style.visibility = "";
        (el.style as any).zIndex = 0;
        focusedElRef.current = null;
        rootRef.current?.removeAttribute("data-enlarging");
        openingRef.current = false;
        unlockScroll();
        return;
      }

      const currentRect = overlay.getBoundingClientRect();
      const rootRect = rootRef.current!.getBoundingClientRect();

      const originalPosRelativeToRoot = {
        left: originalPos.left - rootRect.left,
        top: originalPos.top - rootRect.top,
        width: originalPos.width,
        height: originalPos.height,
      };

      const overlayRelativeToRoot = {
        left: currentRect.left - rootRect.left,
        top: currentRect.top - rootRect.top,
        width: currentRect.width,
        height: currentRect.height,
      };

      const animatingOverlay = document.createElement("div");
      animatingOverlay.className = enlargeClosingClass;
      animatingOverlay.style.cssText = `
        position: absolute;
        left: ${overlayRelativeToRoot.left}px;
        top: ${overlayRelativeToRoot.top}px;
        width: ${overlayRelativeToRoot.width}px;
        height: ${overlayRelativeToRoot.height}px;
        z-index: 9999;
        border-radius: var(--enlarge-radius, 32px);
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        transition: all ${enlargeTransitionMs}ms ease-out;
        pointer-events: none;
        margin: 0;
        transform: none;
      `;

      const originalImg = overlay.querySelector("img");
      if (originalImg) {
        const img = originalImg.cloneNode() as HTMLImageElement;
        (img.style as any).width = "100%";
        (img.style as any).height = "100%";
        (img.style as any).objectFit = "cover";
        animatingOverlay.appendChild(img);
      }

      overlay.remove();
      rootRef.current!.appendChild(animatingOverlay);

      void animatingOverlay.getBoundingClientRect();

      requestAnimationFrame(() => {
        animatingOverlay.style.left = originalPosRelativeToRoot.left + "px";
        animatingOverlay.style.top = originalPosRelativeToRoot.top + "px";
        animatingOverlay.style.width = originalPosRelativeToRoot.width + "px";
        animatingOverlay.style.height = originalPosRelativeToRoot.height + "px";
        (animatingOverlay.style as any).opacity = "0";
      });

      const cleanup = () => {
        animatingOverlay.remove();
        originalTilePositionRef.current = null;

        parent.style.transition = "none";
        el.style.transition = "none";

        parent.style.setProperty("--rot-y-delta", `0deg`);
        parent.style.setProperty("--rot-x-delta", `0deg`);

        requestAnimationFrame(() => {
          el.style.visibility = "";
          (el.style as any).opacity = "0";
          (el.style as any).zIndex = 0;
          focusedElRef.current = null;
          rootRef.current?.removeAttribute("data-enlarging");

          requestAnimationFrame(() => {
            parent.style.transition = "";
            el.style.transition = "opacity 300ms ease-out";

            requestAnimationFrame(() => {
              (el.style as any).opacity = "1";
              setTimeout(() => {
                el.style.transition = "";
                (el.style as any).opacity = "";
                openingRef.current = false;
                if (!draggingRef.current && rootRef.current?.getAttribute("data-enlarging") !== "true") {
                  document.body.classList.remove(styles.dgScrollLock);
                }
              }, 300);
            });
          });
        });
      };

      animatingOverlay.addEventListener("transitionend", cleanup, { once: true });
    };

    scrim.addEventListener("click", close);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => {
      scrim.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [enlargeTransitionMs, unlockScroll]);

  useEffect(() => {
    return () => {
      document.body.classList.remove(styles.dgScrollLock);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.sphereRoot}
      style={{
        ["--segments-x" as any]: segments,
        ["--segments-y" as any]: segments,
        ["--overlay-blur-color" as any]: overlayBlurColor,
        ["--tile-radius" as any]: imageBorderRadius,
        ["--enlarge-radius" as any]: openedImageBorderRadius,
        ["--image-filter" as any]: grayscale ? "grayscale(1)" : "none",
      }}
    >
      <main ref={mainRef as any} className={styles.sphereMain}>
        <div className={styles.stage}>
          <div ref={sphereRef} className={styles.sphere}>
            {items.map((it, i) => (
              <div
                key={`${it.x},${it.y},${i}`}
                className={styles.item}
                data-src={it.src}
                data-offset-x={it.x}
                data-offset-y={it.y}
                data-size-x={it.sizeX}
                data-size-y={it.sizeY}
                style={{
                  ["--offset-x" as any]: it.x,
                  ["--offset-y" as any]: it.y,
                  ["--item-size-x" as any]: it.sizeX,
                  ["--item-size-y" as any]: it.sizeY,
                }}
              >
                <div className={styles.itemImage} role="button" tabIndex={0} aria-label={it.alt || "Open image"} onClick={onTileClick} onPointerUp={onTilePointerUp} onTouchEnd={onTileTouchEnd}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} draggable={false} alt={it.alt} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.overlay} />
        <div className={styles.overlayBlur} />
        <div className={`${styles.edgeFade} ${styles.edgeFadeTop}`} />
        <div className={`${styles.edgeFade} ${styles.edgeFadeBottom}`} />

        <div className={styles.viewer} ref={viewerRef}>
          <div ref={scrimRef} className={scrimClass} />
          <div ref={frameRef} className={frameClass} />
        </div>
      </main>
    </div>
  );
}
