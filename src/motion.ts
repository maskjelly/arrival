import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
export const softEase = 'cubic-bezier(0.22, 1, 0.36, 1)';
export function motionIsInstant() {
  return (
    matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.input === 'keyboard'
  );
}
export function MotionEnvironment() {
  useEffect(() => {
    const pointer = () => {
      if (document.documentElement.dataset.input !== 'pointer')
        document.documentElement.dataset.input = 'pointer';
    };
    const keyboard = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey)
        document.documentElement.dataset.input = 'keyboard';
    };
    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('pointermove', pointer, { passive: true, capture: true });
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('pointermove', pointer, true);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, []);
  return null;
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
const numbers = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
// Only chart geometry needs per-frame painting. React does not render for animation frames.
// Interruptions continue from the last painted shape, not the previous filter's endpoint.
export function useChartPaths(
  elements: Record<string, RefObject<SVGPathElement | null>>,
  targets: Record<string, string>,
  layoutKey: string,
) {
  const displayed = useRef<Record<string, string>>({});
  const previousLayout = useRef(layoutKey);
  const reduced = useReducedMotion();
  const signature = JSON.stringify(targets);
  useLayoutEffect(() => {
    const layoutChanged = previousLayout.current !== layoutKey;
    previousLayout.current = layoutKey;
    const next = JSON.parse(signature) as Record<string, string>;
    const old = displayed.current;
    const keys = Object.keys(next);
    const write = (paths: Record<string, string>) => {
      displayed.current = paths;
      for (const key of keys) elements[key].current?.setAttribute('d', paths[key]);
    };
    const from = keys.map((key) => (old[key]?.match(numbers) ?? []).map(Number));
    const to = keys.map((key) => (next[key].match(numbers) ?? []).map(Number));
    if (
      layoutChanged ||
      reduced ||
      motionIsInstant() ||
      document.hidden ||
      keys.some((key, i) => !old[key] || from[i].length !== to[i].length)
    ) {
      write(next);
      return;
    }
    write(old);
    const started = performance.now();
    let frame = 0;
    const paint = (time: number) => {
      const progress = Math.min(1, (time - started) / 240),
        eased = 1 - Math.pow(1 - progress, 3);
      if (progress === 1) {
        write(next);
        return;
      }
      const paths: Record<string, string> = {};
      keys.forEach((key, i) => {
        let n = 0;
        paths[key] = next[key].replace(numbers, () => {
          const value = from[i][n] + (to[i][n] - from[i][n]) * eased;
          n++;
          return value.toFixed(3);
        });
      });
      write(paths);
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
    // Refs are stable; equal refreshes and tooltip updates must not restart chart motion.
  }, [signature, reduced, layoutKey]);
}
