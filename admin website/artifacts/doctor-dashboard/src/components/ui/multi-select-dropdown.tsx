import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onSelectionChange,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((v) => v !== value));
    } else {
      onSelectionChange([...selected, value]);
    }
  };

  const activeCount = selected.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "rounded-lg shrink-0 gap-1.5 h-9 px-3",
            activeCount > 0
              ? "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10"
              : "bg-white"
          )}
        >
          {label}
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="ml-1 h-5 min-w-[20px] rounded-full px-1.5 text-[11px] font-medium"
            >
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => toggleOption(option.value)}
              />
              <span className="select-none">{option.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
