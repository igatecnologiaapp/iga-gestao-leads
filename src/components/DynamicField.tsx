import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/Combobox";
import { maskPhone } from "@/lib/leads";

export function DynamicField({
  id,
  type,
  options,
  value,
  onChange,
}: {
  id: string;
  type: string;
  options: string[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (type === "textarea")
    return (
      <Textarea
        id={id}
        rows={3}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  if (type === "boolean" || type === "checkbox")
    return (
      <div className="flex h-11 items-center">
        <Switch id={id} checked={!!value} onCheckedChange={(v) => onChange(v)} />
      </div>
    );
  if (type === "select")
    return (
      <Combobox
        id={id}
        options={options.map((o) => ({ value: o, label: o }))}
        value={(value as string) ?? null}
        onChange={(v) => onChange(v)}
        placeholder="Selecione"
      />
    );
  if (type === "multiselect") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(o)}
              onCheckedChange={(v) =>
                onChange(v ? [...selected, o] : selected.filter((s) => s !== o))
              }
            />
            {o}
          </label>
        ))}
      </div>
    );
  }
  if (type === "phone")
    return (
      <Input
        id={id}
        className="h-11"
        inputMode="tel"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(maskPhone(e.target.value))}
      />
    );
  return (
    <Input
      id={id}
      className="h-11"
      type={type === "number" ? "number" : type === "date" ? "date" : "text"}
      inputMode={type === "number" ? "numeric" : undefined}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
