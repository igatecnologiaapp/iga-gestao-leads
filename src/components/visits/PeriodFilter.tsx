import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_PRESETS, periodLabel, presetRange, type DateRange } from "@/lib/dashboard";

/** Filtro de período reutilizado pelo Histórico e pela Inteligência Operacional. */
export function PeriodFilter({
  preset,
  range,
  onPreset,
  onRange,
}: {
  preset: string;
  range: DateRange;
  onPreset: (value: string) => void;
  onRange: (range: DateRange) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="min-w-0">
        <Label className="text-xs">Período</Label>
        <Select
          value={preset}
          onValueChange={(v) => {
            onPreset(v);
            if (v !== "custom") onRange(presetRange(v));
          }}
        >
          <SelectTrigger className="mt-1 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" ? (
        <>
          <div className="min-w-0">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              className="mt-1 h-11"
              value={range.from}
              onChange={(e) => onRange({ ...range, from: e.target.value })}
            />
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              className="mt-1 h-11"
              value={range.to}
              onChange={(e) => onRange({ ...range, to: e.target.value })}
            />
          </div>
        </>
      ) : (
        <p className="self-end text-xs text-muted-foreground sm:col-span-2">
          Exibindo {periodLabel(range)}.
        </p>
      )}
    </div>
  );
}
