"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  depth: number;
  size: number;
  color: string;
};

const STAR_COUNT = 280;
const FAR_DEPTH = 1.8;
const FRAME_INTERVAL = 1000 / 30;
const STAR_COLORS = ["210, 239, 255", "119, 195, 255", "244, 250, 255"];

/** Local canvas star field; independent of any commercial component registry. */
export function LightspeedBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let frameId = 0;
    let previousFrame = 0;
    let background: CanvasGradient | null = null;

    const makeStar = (initial = false): Star => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      depth: initial ? 0.25 + Math.random() * (FAR_DEPTH - 0.25) : FAR_DEPTH,
      size: 0.65 + Math.random() * 0.9,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    });
    const stars = Array.from({ length: STAR_COUNT }, () => makeStar(true));

    const draw = (delta: number) => {
      if (!width || !height) return;
      context.fillStyle = background ?? "#000000";
      context.fillRect(0, 0, width, height);
      context.lineCap = "round";
      const centerX = width * 0.5;
      const centerY = height * 0.47;

      for (let index = 0; index < stars.length; index += 1) {
        let star = stars[index];
        if (!reducedMotion) star.depth -= delta * 0.54;
        let x = centerX + (star.x * width * 0.62) / star.depth;
        let y = centerY + (star.y * height * 0.62) / star.depth;

        if (star.depth < 0.12 || x < -120 || x > width + 120 || y < -120 || y > height + 120) {
          star = makeStar();
          stars[index] = star;
          x = centerX + (star.x * width * 0.62) / star.depth;
          y = centerY + (star.y * height * 0.62) / star.depth;
        }

        const proximity = 1 - Math.min(1, star.depth / FAR_DEPTH);
        const opacity = 0.32 + proximity * 0.65;
        const radius = star.size * (0.55 + proximity * 0.75);

        if (!reducedMotion) {
          // A deeper sample forms a tail pointing back to the same vanishing point.
          const tailDepth = star.depth + 0.07 + proximity * 0.12;
          const tailX = centerX + (star.x * width * 0.62) / tailDepth;
          const tailY = centerY + (star.y * height * 0.62) / tailDepth;
          const trail = context.createLinearGradient(tailX, tailY, x, y);
          trail.addColorStop(0, `rgba(${star.color}, 0)`);
          trail.addColorStop(0.45, `rgba(${star.color}, ${opacity * 0.48})`);
          trail.addColorStop(1, `rgba(${star.color}, ${opacity})`);
          context.strokeStyle = trail;
          context.lineWidth = radius * 1.35;
          context.beginPath();
          context.moveTo(tailX, tailY);
          context.lineTo(x, y);
          context.stroke();
        }

        context.fillStyle = `rgba(${star.color}, ${opacity})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const stop = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      previousFrame = 0;
    };

    const tick = (now: number) => {
      frameId = 0;
      if (document.hidden || reducedMotion) return;
      if (!previousFrame) previousFrame = now - FRAME_INTERVAL;
      const elapsed = now - previousFrame;
      if (elapsed >= FRAME_INTERVAL) {
        draw(Math.min(elapsed / 1000, 0.08));
        previousFrame = now - (elapsed % FRAME_INTERVAL);
      }
      frameId = requestAnimationFrame(tick);
    };

    const updateActivity = () => {
      stop();
      if (document.hidden) return;
      draw(0);
      if (!reducedMotion) frameId = requestAnimationFrame(tick);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.round(bounds.width);
      const nextHeight = Math.round(bounds.height);
      const nextRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;
      width = nextWidth;
      height = nextHeight;
      pixelRatio = nextRatio;
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      background = context.createRadialGradient(
        width * 0.5, height * 0.47, 0,
        width * 0.5, height * 0.47, Math.max(width, height, 1) * 0.7,
      );
      background.addColorStop(0, "#010306");
      background.addColorStop(0.6, "#020a13");
      background.addColorStop(1, "#000000");
      updateActivity();
    };

    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      updateActivity();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", updateActivity);
    motionQuery.addEventListener("change", onMotionChange);
    resize();

    return () => {
      stop();
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", updateActivity);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden bg-black ${className}`.trim()}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
