import { Printer } from "lucide-react";

interface PrintButtonProps {
  onPrint: () => void;
  className?: string;
}

export function PrintButton({ onPrint, className }: PrintButtonProps) {
  return (
    <button
      onClick={onPrint}
      title="Print Report"
      className={`no-print inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ${className ?? ""}`}
      aria-label="Print Report"
    >
      <Printer className="h-4 w-4" />
    </button>
  );
}
