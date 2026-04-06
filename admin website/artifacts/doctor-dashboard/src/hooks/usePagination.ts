import { useState, useMemo, useEffect } from "react";

interface UsePaginationOptions {
  totalItems: number;
  pageSize?: number;
  resetDeps?: unknown[];
}

interface UsePaginationResult {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  rangeStart: number;
  rangeEnd: number;
  setPage: (page: number) => void;
  goNext: () => void;
  goPrev: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function usePagination({
  totalItems,
  pageSize = 25,
  resetDeps = [],
}: UsePaginationOptions): UsePaginationResult {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return useMemo(
    () => ({
      currentPage,
      totalPages,
      startIndex,
      endIndex,
      rangeStart: totalItems === 0 ? 0 : startIndex + 1,
      rangeEnd: endIndex,
      setPage: setCurrentPage,
      goNext: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
      goPrev: () => setCurrentPage((p) => Math.max(p - 1, 1)),
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    }),
    [currentPage, totalPages, startIndex, endIndex, totalItems]
  );
}
