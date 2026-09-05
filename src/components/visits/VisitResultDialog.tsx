import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/Combobox";
import { AppointmentFields, emptyAppointment, type AppointmentDraft } from "@/components/AppointmentFields";
import { useContactTypes } from "@/lib/queries";
import { STOP_STATUSES, VISIT_RESULTS } from "@/lib/visits";
import { finishVisit, type LeadVisit } from "@/lib/visitActions";

/** Resultados que normalmente exigem continuidade comercial. */
const FOLLOW_UP_RESULTS = ["interessado", "demonstracao", "proposta", "follow_up", "responsavel_ausente"];

const CLOSING_STOP_STATUSES = STOP_STATUSES.filter((s) =>
  ["visitado", "nao_visitado", "reagendado", "cancelado"].includes(s.value),
);

export function VisitResultDialog({
  open,
  onOpenChange,
  visit,
  stopId,
  leadName,
  routeTitle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: LeadVisit;
  stopId: string;
  leadName: string;
  routeTitle?: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const { data: contactTypes = [] } = useContactTypes();
  const [result, setResult] = useState<string>("contato_realizado");
  const [stopStatus, setStopStatus] = useState<string>("visitado");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");
  const [nextNotes, setNextNotes] = useState("");
  const [appointment, setAppointment] = useState<AppointmentDraft>(emptyAppointment);
  const [saving, setSaving] = useState(false);

  const suggestsFollowUp = FOLLOW_UP_RESULTS.includes(result);

  async function save() {
    if (appointment.date && !appointment.time) {
      toast.error("Informe o horário da próxima ação.");
      return;
    }
    setSaving(true);
    const typeLabel =
      contactTypes.find((c) => c.id === appointment.contactTypeId)?.name ?? "Contato";
    const res = await finishVisit({
      visit,
      stopId,
      stopStatus,
      result,
      notes: notes.trim() || null,
      contactPerson: contactPerson.trim() || null,
      nextAction: appointment.date
        ? {
            scheduledAt: new Date(`${appointment.date}T${appointment.time}`).toISOString(),
            contactTypeId: appointment.contactTypeId,
            typeLabel,
          }
        : null,
      nextActionNotes: nextNotes.trim() || null,
      routeTitle: routeTitle ?? null,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message ?? "Não foi possível registrar a visita.");
      return;
    }
    toast.success(res.message ?? "Visita registrada.");
    await onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar resultado</DialogTitle>
          <DialogDescription>{leadName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="visit-result">Resultado da visita</Label>
            <Combobox
              id="visit-result"
              options={VISIT_RESULTS.map((r) => ({ value: r.value, label: r.label }))}
              value={result}
              onChange={(v) => v && setResult(v)}
              placeholder="Selecione"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="visit-stop-status">Situação da parada</Label>
            <Combobox
              id="visit-stop-status"
              options={CLOSING_STOP_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              value={stopStatus}
              onChange={(v) => v && setStopStatus(v)}
              placeholder="Visitado"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="visit-contact">Pessoa atendida</Label>
            <Input
              id="visit-contact"
              className="h-11"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="visit-notes">Observações da visita</Label>
            <Textarea
              id="visit-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="O que foi tratado, necessidades identificadas..."
            />
          </div>

          <div className="rounded-xl border p-3">
            <p className="text-sm font-semibold">Próxima ação</p>
            <p className="mb-3 text-xs text-muted-foreground">
              {suggestsFollowUp
                ? "Este resultado costuma exigir retorno. Agende a próxima ação."
                : "Opcional — usa a mesma Agenda do sistema."}
            </p>
            <AppointmentFields
              idPrefix="visit-next"
              value={appointment}
              onChange={setAppointment}
              onClear={() => setAppointment(emptyAppointment)}
            />
            {appointment.date ? (
              <div className="mt-3 grid gap-1.5">
                <Label htmlFor="visit-next-notes">Observação da próxima ação</Label>
                <Input
                  id="visit-next-notes"
                  className="h-11"
                  value={nextNotes}
                  onChange={(e) => setNextNotes(e.target.value)}
                />
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Concluir visita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
