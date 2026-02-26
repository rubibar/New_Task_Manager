"use client";

import { useState, useCallback, useMemo } from "react";

export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const count = useMemo(() => selectedIds.size, [selectedIds]);

  const ids = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return {
    selectedIds: ids,
    count,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    hasSelection: count > 0,
  };
}
