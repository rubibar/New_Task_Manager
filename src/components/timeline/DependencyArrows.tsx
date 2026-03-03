"use client";

import { useMemo } from "react";

export interface BarPosition {
  taskId: string;
  left: number;
  width: number;
  top: number;
  height: number;
}

export interface DependencyLink {
  fromTaskId: string;
  toTaskId: string;
}

interface DependencyArrowsProps {
  bars: BarPosition[];
  links: DependencyLink[];
  highlightedTaskIds?: Set<string>;
  svgWidth: number;
  svgHeight: number;
}

export function DependencyArrows({
  bars,
  links,
  highlightedTaskIds,
  svgWidth,
  svgHeight,
}: DependencyArrowsProps) {
  const barMap = useMemo(() => {
    const map = new Map<string, BarPosition>();
    for (const bar of bars) {
      map.set(bar.taskId, bar);
    }
    return map;
  }, [bars]);

  const paths = useMemo(() => {
    return links
      .map((link) => {
        const from = barMap.get(link.fromTaskId);
        const to = barMap.get(link.toTaskId);
        if (!from || !to) return null;

        const startX = from.left + from.width;
        const startY = from.top + from.height / 2;
        const endX = to.left;
        const endY = to.top + to.height / 2;

        const isHighlighted = highlightedTaskIds?.has(link.toTaskId);

        // Cubic bezier control points
        const dx = Math.abs(endX - startX);
        const cpOffset = Math.max(dx * 0.4, 20);

        const d = `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;

        return {
          key: `${link.fromTaskId}-${link.toTaskId}`,
          d,
          isHighlighted,
        };
      })
      .filter(Boolean) as { key: string; d: string; isHighlighted: boolean }[];
  }, [links, barMap, highlightedTaskIds]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={svgWidth}
      height={svgHeight}
      style={{ zIndex: 5 }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#cbd5e1" />
        </marker>
        <marker
          id="arrowhead-highlighted"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.isHighlighted ? "#f59e0b" : "#cbd5e1"}
          strokeWidth={p.isHighlighted ? 2 : 1.5}
          markerEnd={
            p.isHighlighted
              ? "url(#arrowhead-highlighted)"
              : "url(#arrowhead)"
          }
          className="pointer-events-[stroke] hover:stroke-slate-500 transition-colors"
        />
      ))}
    </svg>
  );
}
