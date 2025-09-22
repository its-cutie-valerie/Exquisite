// src/components/FallingLeaves.tsx
import React, { useEffect, useRef, useState } from 'react';
import { GiMapleLeaf, GiOakLeaf, GiFallingLeaf } from 'react-icons/gi';
import { RiLeafFill } from 'react-icons/ri';

type LeafShape = 'reactIcon';
type ReactIconKey = 'GiMapleLeaf' | 'GiOakLeaf' | 'GiFallingLeaf' | 'RiLeafFill';

const LEAF_COLORS = [
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#b45309', // amber-700 (ochre)
  '#c2410c', // orange-700 (rust)
  '#e76f51', // terracotta
  '#6b8e23', // olive
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

interface FallingLeavesProps {
  count?: number;
  zIndex?: number;
  colors?: string[];
  sizeRange?: [number, number];
  speedRange?: [number, number];
  driftRange?: [number, number]; // px horizontal sway amplitude
  swayDurationRange?: [number, number]; // seconds for side-to-side
  respectReducedMotion?: boolean;
  insetRight?: number; // reserve space for scrollbar
  positionMode?: 'absolute' | 'fixed';
  fixedRect?: { top: number; left: number; width: number; height: number };
  shapes?: LeafShape[]; // React Icons only for consistent cross-platform look
}

const FallingLeaves: React.FC<FallingLeavesProps> = ({
  count = 8,
  zIndex = 0,
  colors = LEAF_COLORS,
  sizeRange = [18, 32],
  speedRange = [5, 12],
  driftRange = [6, 14],
  swayDurationRange = [3.5, 7.5],
  respectReducedMotion = true,
  insetRight = 0,
  positionMode = 'absolute',
  fixedRect,
  shapes = ['reactIcon'],
}) => {
  const [reducedMotion, setReducedMotion] = useState(false);
  const initialFallDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReducedMotion(media.matches);
      update();
      if (media.addEventListener) media.addEventListener('change', update);
      else if ((media as any).addListener) (media as any).addListener(update);
      return () => {
        if (media.removeEventListener) media.removeEventListener('change', update);
        else if ((media as any).removeListener) (media as any).removeListener(update);
      };
    }
  }, []);

  if (respectReducedMotion && reducedMotion) return null;

  // Precompute falling leaf configs to keep animation stable across re-renders
  interface LeafSpec {
    id: number; left: number; duration: number; delay: number; size: number; color: string; rotate: number; drift: number; sway: number; shape: LeafShape; iconKey?: ReactIconKey;
  }

  const REACT_ICON_KEYS: ReactIconKey[] = ['GiMapleLeaf', 'GiOakLeaf', 'GiFallingLeaf', 'RiLeafFill'];
  const leavesRef = useRef<LeafSpec[] | null>(null);
  if (!leavesRef.current) {
    leavesRef.current = Array.from({ length: count }).map((_, idx) => {
      const left = randomBetween(0, 90); // vw percent relative to container width
      const duration = randomBetween(speedRange[0], speedRange[1]);
      const delay = randomBetween(0, 6);
      const size = randomBetween(sizeRange[0], sizeRange[1]);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rotate = randomBetween(-30, 30);
      const drift = randomBetween(driftRange[0], driftRange[1]) * (Math.random() < 0.5 ? -1 : 1); // px, includes direction
      const sway = randomBetween(swayDurationRange[0], swayDurationRange[1]);
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const spec: LeafSpec = { id: idx, left, duration, delay, size, color, rotate, drift, sway, shape };
      if (shape === 'reactIcon') {
        const iconKey = REACT_ICON_KEYS[Math.floor(Math.random() * REACT_ICON_KEYS.length)];
        spec.iconKey = iconKey;
      }
      return spec;
    });
  }
  const leaves = leavesRef.current!;

  const ICON_MAP: Record<ReactIconKey, React.ComponentType<{ size?: number; color?: string }>> = {
    GiMapleLeaf,
    GiOakLeaf,
    GiFallingLeaf,
    RiLeafFill
  };

  const renderShape = (_shape: LeafShape, size: number, color: string, iconKey?: ReactIconKey) => {
    const IconComp = iconKey ? ICON_MAP[iconKey] : GiMapleLeaf;
    return <IconComp size={size} color={color} />;
  };

  // Container style: either absolute (inside scroll area) or fixed (viewport-aligned)
  useEffect(() => {
    if (positionMode === 'fixed' && fixedRect && initialFallDistanceRef.current == null) {
      initialFallDistanceRef.current = Math.max(80, Math.floor(fixedRect.height - 20));
    }
  }, [positionMode, fixedRect]);

  const fallDistance = initialFallDistanceRef.current ?? (positionMode === 'fixed' && fixedRect ? Math.max(80, Math.floor(fixedRect.height - 20)) : undefined);

  const containerStyle: React.CSSProperties = positionMode === 'fixed' && fixedRect
    ? {
        pointerEvents: 'none',
        position: 'fixed',
        top: fixedRect.top,
        left: fixedRect.left,
        width: fixedRect.width,
        height: fixedRect.height,
        zIndex,
        overflow: 'hidden',
        contain: 'paint',
        // Pass fall distance to keyframes via CSS var
        // @ts-ignore CSS var custom prop
        ['--leafFallDistance' as any]: fallDistance ? `${fallDistance}px` : undefined,
      }
    : {
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: insetRight,
        zIndex,
        overflow: 'hidden',
        contain: 'paint',
      };

  return (
  <div style={containerStyle} aria-hidden="true">
      {/* Falling layer only (continuous) */}
      {leaves.map((leaf) => (
        <span
          key={leaf.id}
          style={{
            position: 'absolute',
            left: `${leaf.left}%`,
            top: `-${leaf.size}px`,
            width: leaf.size,
            height: leaf.size,
            // Outer wrapper handles horizontal drift only
            animation: `leaf-drift ${leaf.sway}s ease-in-out ${leaf.delay}s infinite alternate`,
            willChange: 'transform',
            // @ts-ignore custom CSS vars
            ['--leafDrift' as any]: `${leaf.drift}px`,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: leaf.size,
              height: leaf.size,
              opacity: 0.7,
              animation: `leaf-drop-straight ${leaf.duration}s linear ${leaf.delay}s infinite`,
              willChange: 'transform',
              // @ts-ignore custom CSS vars
              ['--leafRotStart' as any]: `${leaf.rotate}deg`,
            }}
          >
            {renderShape(leaf.shape, leaf.size, leaf.color, leaf.iconKey)}
          </span>
        </span>
      ))}
      <style>{`
        @keyframes leaf-drop-straight {
          0% {
            transform: translateY(0) rotate(var(--leafRotStart, 0deg));
          }
          100% {
            transform: translateY(var(--leafFallDistance, 100vh)) rotate(var(--leafRotStart, 0deg));
          }
        }
        @keyframes leaf-drift {
          0% {
            transform: translateX(calc(-1 * var(--leafDrift, 10px)));
          }
          100% {
            transform: translateX(var(--leafDrift, 10px));
          }
        }
      `}</style>
    </div>
  );
};

export default React.memo(FallingLeaves);
