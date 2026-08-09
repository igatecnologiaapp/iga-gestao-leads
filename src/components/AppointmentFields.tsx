import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { APPOINTMENT_STATUSES } from "@/lib/appointments";
import { useContactTypes } from "@/lib/queries";

export type AppointmentDraft = {
  date: string;
  time: string;
  contactTypeId: string | null;
  status: string;
};

export const emptyAppointment: AppointmentDraft = {
  date: "",
  time: "",
  contactTypeId: null,
  status: "agendado",
};

export function AppointmentFields({
  idPrefix,
  value,
  onChange,
  showStatus = false,
  onClear,
}: {
  idPrefix: string;
  value: AppointmentDraft;
  onChange: (next: AppointmentDraft) => void;
  showStatus?: boolean;
  onClear?: () => void;
}) {
  const { data: contactTypes = [] } = useContactTypes();
  const active = contactTypes.filter((c) => c.active);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-date`}>Data</Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          className="h-11"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-time`}>Hora</Label>
        <Input
          id={`${idPrefix}-time`}
          type="time"
          className="h-11"
          inputMode="numeric"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Tipo de contato</Label>
        <Select
          value={value.contactTypeId ?? ""}
          onValueChange={(v) => onChange({ ...value, contactTypeId: v })}
        >
          <SelectTrigger id={`${idPrefix}-type`} className="h-11">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {active.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showStatus && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Situação</Label>
          <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v })}>
            <SelectTrigger id={`${idPrefix}-status`} className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPOINTMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {onClear && (value.date || value.time) && (
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onClear}>
            Limpar agendamento
          </Button>
        </div>
      )}
    </div>
  );
}
