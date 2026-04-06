import { useRef, useState, useCallback, useEffect } from "react";
import { useReactToPrint } from "react-to-print";

type DataReadyStatus = "loading" | "ready" | "error";

/**
 * usePrint - shared print hook.
 * @param documentTitle - document title for print dialog
 * @param awaitDataReady - if true, waits for onDataReady("ready") before triggering print.
 *   Used by pages with async print-report components. Defaults to false (prints immediately).
 */
export function usePrint(documentTitle: string, awaitDataReady = false) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [dataStatus, setDataStatus] = useState<DataReadyStatus>("loading");
  const [printError, setPrintError] = useState<string | null>(null);
  const pendingPrint = useRef(false);

  const resetPrintState = useCallback(() => {
    setIsPrinting(false);
    setDataStatus("loading");
    setPrintError(null);
    pendingPrint.current = false;
  }, []);

  const triggerPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle,
    onAfterPrint: resetPrintState,
  });

  const handlePrint = useCallback(() => {
    setPrintError(null);
    setDataStatus("loading");
    setIsPrinting(true);
    pendingPrint.current = true;
    if (!awaitDataReady) {
      setDataStatus("ready");
    }
  }, [awaitDataReady]);

  // Tracks error-clear timeout so it can be cleaned up on unmount
  const errorClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorClearTimer.current) clearTimeout(errorClearTimer.current);
    };
  }, []);

  /**
   * Signal readiness from async report components.
   * Call with "ready" when all data is loaded.
   * Call with "error" (and optional message) when data fetch failed.
   * Do NOT call with "loading" — just don't call until one of the above states.
   */
  const onDataReady = useCallback((status: DataReadyStatus, errorMsg?: string) => {
    if (!pendingPrint.current) return;
    if (status === "error") {
      const msg = errorMsg ?? "Failed to load report data. Please try again.";
      setPrintError(msg);
      // Reset printing state but keep error visible; clear error after 5 seconds
      setIsPrinting(false);
      setDataStatus("loading");
      pendingPrint.current = false;
      if (errorClearTimer.current) clearTimeout(errorClearTimer.current);
      errorClearTimer.current = setTimeout(() => setPrintError(null), 5000);
    } else if (status === "ready") {
      setDataStatus("ready");
    }
  }, []);

  useEffect(() => {
    if (!isPrinting || dataStatus !== "ready" || !pendingPrint.current) return;
    const id = setTimeout(() => triggerPrint(), 50);
    return () => clearTimeout(id);
  }, [isPrinting, dataStatus, triggerPrint]);

  return { printRef, handlePrint, isPrinting, onDataReady, printError, cancelPrint: resetPrintState };
}
