import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AppointmentFields,
  emptyAppointment,
  type AppointmentDraft,
} from "@/components/AppointmentFields";
import {
  appointmentStatusClass,
  appointmentStatusLabel,
  formatAppointment,
  fromLocalParts,
  isOverdue,
  toLocalParts,
} from "@/lib/appointments";
import { useContactTypes, useLeadAppointments, type Appointment } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  createAppointment,
  logAppointmentHistory,
  setAppointmentStatus,
  syncNextContactDate,
} from "@/lib/appointmentActions";


export function LeadAppointments({
  leadId,
  canEdit,
  createSignal = 0,
}: {
  leadId: string;
  canEdit: boolean;
  /** Incrementar para abrir o formulário de novo agendamento a partir de fora. */
  createSignal?: number;
}) {
  const queryClient = useQueryClient();
  const { data: appointments = [] } = useLeadAppointments(leadId);
  const { data: contactTypes = [] } = useContactTypes();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft>(emptyAppointment);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!createSignal || !canEdit) return;
    setEditing(null);
    setDraft(emptyAppointment);
    setOpen(true);
  }, [createSignal, canEdit]);

  const active = appointments.filter((a) => a.status === "agendado");
  const next = active[0] ?? null;

  function typeName(id: string | null) {
    return contactTypes.find((c) => c.id === id)?.name ?? "Não informado";
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["lead_appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["lead_history", leadId] });
    void queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  async function logHistory(description: string) {
    await logAppointmentHistory(leadId, description);
  }


  function startCreate() {
    setEditing(null);
    setDraft(emptyAppointment);
    setOpen(true);
  }

  function startEdit(a: Appointment) {
    const parts = toLocalParts(a.scheduled_at);
    setEditing(a);
    setDraft({
      date: parts.date,
      time: parts.time,
      contactTypeId: a.contact_type_id,
      status: a.status,
    });
    setOpen(true);
  }

  async function save() {
    const scheduledAt = fromLocalParts(draft.date, draft.time);
    if (!scheduledAt) {
      toast.error("Informe data e hora do agendamento.");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("lead_appointments")
        .update({
          scheduled_at: scheduledAt,
          contact_type_id: draft.contactTypeId,
          status: draft.status as never,
        })
        .eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível salvar o agendamento.");
        return;
      }
      if (new Date(editing.scheduled_at).getTime() !== new Date(scheduledAt).getTime()) {
        await logHistory(
          `Agendamento alterado de ${formatAppointment(editing.scheduled_at)} para ${formatAppointment(scheduledAt)}.`,
        );
      }
      if (editing.status !== draft.status) {
        await logHistory(
          `Agendamento de ${formatAppointment(scheduledAt)} marcado como ${appointmentStatusLabel(draft.status).toLowerCase()}.`,
        );
      }
      await syncNextContactDate(leadId);
    } else {
      // Autoria preenchida pelo banco (auth.uid()) — impede atribuição a outro usuário.
      const { ok } = await createAppointment({
        leadId,
        scheduledAt,
        contactTypeId: draft.contactTypeId,
        typeLabel: typeName(draft.contactTypeId),
      });
      if (!ok) {
        setSaving(false);
        toast.error("Não foi possível criar o agendamento.");
        return;
      }
    }
    setSaving(false);
    setOpen(false);
    refresh();
    toast.success("Agendamento salvo.");
  }

  async function changeStatus(a: Appointment, status: string) {
    const { ok } = await setAppointmentStatus(a, status);
    if (!ok) {
      toast.error("Não foi possível atualizar o agendamento.");
      return;
    }
    refresh();
    toast.success("Agendamento atualizado.");
  }


  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Agendamentos</h2>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-10" onClick={startCreate}>
            <Plus className="h-4 w-4" /> Novo agendamento
          </Button>
        )}
      </div>

      <div className="mt-3 rounded-xl border bg-muted/40 p-3">
        <p className="text-xs text-muted-foreground">Próximo agendamento</p>
        {next ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">{formatAppointment(next.scheduled_at)}</span>
            <span className="text-sm text-muted-foreground">· {typeName(next.contact_type_id)}</span>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                appointmentStatusClass(next.status),
              )}
            >
              {appointmentStatusLabel(next.status)}
              {isOverdue(next.scheduled_at, next.status) ? " — Atrasado" : ""}
            </span>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nenhum agendamento ativo.</p>
        )}
      </div>

      <ul className="mt-3 divide-y">
        {appointments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {formatAppointment(a.scheduled_at)}
                {isOverdue(a.scheduled_at, a.status) && (
                  <span className="ml-2 text-xs font-bold text-destructive">🔴 ATRASADO</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {typeName(a.contact_type_id)} · {appointmentStatusLabel(a.status)}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-1">
                {a.status === "agendado" && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(a, "realizado")}>
                      <Check className="h-4 w-4" /> Realizado
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(a, "nao_realizado")}>
                      <X className="h-4 w-4" /> Não realizado
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => changeStatus(a, "cancelado")}>
                      Cancelar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              </div>
            )}
          </li>
        ))}
        {!appointments.length && (
          <li className="py-4 text-sm text-muted-foreground">Nenhum agendamento registrado.</li>
        )}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          </DialogHeader>
          <AppointmentFields
            idPrefix="appt"
            value={draft}
            onChange={setDraft}
            showStatus={!!editing}
          />
          <DialogFooter>
            <Button className="h-11 w-full sm:w-auto" onClick={save} disabled={saving}>
              Salvar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
