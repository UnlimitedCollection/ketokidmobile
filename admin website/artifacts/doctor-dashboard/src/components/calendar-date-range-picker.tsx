import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarDateRangePickerProps {
  value?: { start: string; end: string };
  onChange: (range: { start: string; end: string } | undefined) => void;
  className?: string;
}

function toDateRangePicker(value?: { start: string; end: string }): DateRange | undefined {
  if (!value?.start && !value?.end) return undefined;
  return {
    from: value.start ? new Date(value.start + "T00:00:00") : undefined,
    to: value.end ? new Date(value.end + "T00:00:00") : undefined,
  };
}

function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "";
  if (!range.to) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d")} – ${format(range.to, "MMM d, yyyy")}`;
}

export function CalendarDateRangePicker({
  value,
  onChange,
  className,
}: CalendarDateRangePickerProps) {
  const [range, setRange] = useState<DateRange | undefined>(() =>
    toDateRangePicker(value)
  );

  function handleSelect(selected: DateRange | undefined) {
    setRange(selected);
    if (!selected || (!selected.from && !selected.to)) {
      onChange(undefined);
    } else {
      onChange({
        start: selected.from ? format(selected.from, "yyyy-MM-dd") : "",
        end: selected.to ? format(selected.to, "yyyy-MM-dd") : "",
      });
    }
  }

  function handleClear() {
    setRange(undefined);
    onChange(undefined);
  }

  const label = formatRangeLabel(range);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between min-h-[1.5rem]">
        {label ? (
          <span className="text-sm font-medium text-slate-700">{label}</span>
        ) : (
          <span className="text-sm text-slate-400 italic">No dates selected</span>
        )}
        {label && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-slate-600"
            onClick={handleClear}
            aria-label="Clear date range"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="rounded-md border border-slate-200 overflow-hidden flex justify-center">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          className="[--cell-size:2rem] p-2"
        />
      </div>
    </div>
  );
}
