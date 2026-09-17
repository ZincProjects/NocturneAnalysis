"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

interface Piece {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  delay: number;
  size: number;
}

/**
 * A short confetti burst from the centre of the screen. Purely decorative:
 * hidden from assistive technology, never intercepts clicks, gone in about a
 * second, and skipped entirely for people who ask for reduced motion.
 */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  const reduce = useReducedMotion();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!burstKey || reduce) return;
    setPieces(
      Array.from({ length: 70 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 140 + Math.random() * 260;
        return {
          id: burstKey * 1000 + i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 80,
          rotate: Math.random() * 720 - 360,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 0.08,
          size: 6 + Math.random() * 6,
        };
      }),
    );
    const id = setTimeout(() => setPieces([]), 1400);
    return () => clearTimeout(id);
  }, [burstKey, reduce]);

  if (pieces.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute top-1/2 left-1/2 rounded-[2px]"
          style={{ width: piece.size, height: piece.size * 0.45, background: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 240], opacity: [1, 1, 0], rotate: piece.rotate }}
          transition={{ duration: 1.2, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
