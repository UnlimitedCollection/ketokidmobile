import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Calendar, Printer, Search } from "lucide-react";
import { CalendarDateRangePicker } from "@/components/calendar-date-range-picker";

export interface CheckboxOption {
  id: string;
  label: string;
  defaultChecked?: boolean;
}

export interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

export type DatePreset = "7d" | "14d" | "30d" | "all" | "custom";

export interface PrintFilterResult {
  selectedIds: string[];
  selectedEntityIds: string[];
  datePreset: DatePreset;
  dateRange?: { start: string; end: string };
}

interface PrintFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  options: CheckboxOption[];
  showDateRange?: boolean;
  entities?: EntityOption[];
  entityLabel?: string;
  onConfirm: (result: PrintFilterResult) => void;
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d",     label: "Last 7 Days"  },
  { value: "14d",    label: "Last 14 Days" },
  { value: "30d",    label: "Last 30 Days" },
  { value: "all",    label: "All Time"     },
  { value: "custom", label: "Custom Range" },
];

function presetToDateRange(preset: DatePreset): { start: string; end: string } | undefined {
  if (preset === "all" || preset === "custom") return undefined;
  const days = preset === "7d" ? 7 : preset === "14d" ? 14 : 30;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

function getDefaultSelected(options: CheckboxOption[]): Set<string> {
  return new Set(options.filter((o) => o.defaultChecked !== false).map((o) => o.id));
}

export function PrintFilterDialog({
  open,
  onOpenChange,
  title,
  description,
  options,
  showDateRange = false,
  entities,
  entityLabel = "Entities",
  onConfirm,
}: PrintFilterDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => getDefaultSelected(options));
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | undefined>(undefined);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(
    () => new Set((entities ?? []).map((e) => e.id))
  );
  const [entitySearch, setEntitySearch] = useState("");

  useEffect(() => {
    if (open) {
      setSelected(getDefaultSelected(options));
      setDatePreset("all");
      setCustomDateRange(undefined);
      setSelectedEntities(new Set((entities ?? []).map((e) => e.id)));
      setEntitySearch("");
    }
  }, [open, options, entities]);

  const allSelected = selected.size === options.length && options.length > 0;
  const noneSelected = selected.size === 0;

  const filteredEntities = useMemo(() => {
    if (!entities) return [];
    const q = entitySearch.toLowerCase().trim();
    if (!q) return entities;
    return entities.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.sublabel ?? "").toLowerCase().includes(q)
    );
  }, [entities, entitySearch]);

  const allEntitiesSelected =
    entities && entities.length > 0 && selectedEntities.size === entities.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(options.map((o) => o.id)));
    }
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllEntities() {
    if (!entities) return;
    if (allEntitiesSelected) {
      setSelectedEntities(new Set());
    } else {
      setSelectedEntities(new Set(entities.map((e) => e.id)));
    }
  }

  function toggleEntity(id: string) {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const buildResult = useCallback(
    (sectionIds: string[]): PrintFilterResult => ({
      selectedIds: sectionIds,
      selectedEntityIds: Array.from(selectedEntities),
      datePreset,
      dateRange: datePreset === "custom" ? customDateRange : presetToDateRange(datePreset),
    }),
    [selectedEntities, datePreset, customDateRange]
  );

  function handlePrintSection(id: string) {
    onConfirm(buildResult([id]));
    onOpenChange(false);
  }

  function handleConfirm() {
    onConfirm(buildResult(Array.from(selected)));
    onOpenChange(false);
  }

  function handleCancel() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {showDateRange && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Date Range</p>
              <div className="flex flex-wrap gap-2">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setDatePreset(preset.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      datePreset === preset.value
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                    aria-label={preset.value === "custom" ? preset.label : undefined}
                    title={preset.value === "custom" ? preset.label : undefined}
                  >
                    {preset.value === "custom" ? (
                      <Calendar className="w-3.5 h-3.5" />
                    ) : (
                      preset.label
                    )}
                  </button>
                ))}
              </div>
              {datePreset !== "all" && datePreset !== "custom" && (
                <p className="text-xs text-slate-400">
                  {(() => {
                    const r = presetToDateRange(datePreset);
                    return r ? `${r.start} → ${r.end}` : "";
                  })()}
                </p>
              )}
              {datePreset === "custom" && (
                <CalendarDateRangePicker
                  value={customDateRange}
                  onChange={setCustomDateRange}
                />
              )}
            </div>
          )}

          {entities && entities.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">{entityLabel}</p>
                <button
                  type="button"
                  onClick={toggleAllEntities}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {allEntitiesSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              {entities.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              )}
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border border-slate-100 p-2">
                {filteredEntities.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No matches</p>
                ) : (
                  filteredEntities.map((entity) => (
                    <label
                      key={entity.id}
                      className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedEntities.has(entity.id)}
                        onCheckedChange={() => toggleEntity(entity.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700">{entity.label}</span>
                        {entity.sublabel && (
                          <span className="text-xs text-slate-400 ml-1.5">{entity.sublabel}</span>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Sections to Include</p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline font-medium"
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-md border border-slate-100 p-3">
              {options.map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selected.has(opt.id)}
                    onCheckedChange={() => toggleItem(opt.id)}
                  />
                  <label
                    className="flex-1 text-sm text-slate-700 cursor-pointer"
                    onClick={() => toggleItem(opt.id)}
                  >
                    {opt.label}
                  </label>
                  <button
                    type="button"
                    title={`Print "${opt.label}" only`}
                    onClick={() => handlePrintSection(opt.id)}
                    className="shrink-0 p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0 pt-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={noneSelected} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
