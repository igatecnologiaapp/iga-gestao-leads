import { supabase } from "@/integrations/supabase/client";
import { createAppointment } from "@/lib/appointmentActions";
import { formatAppointment } from "@/lib/appointments";
import { visitResultLabel } from "@/lib/visits";

/**
 * Regras compartilhadas de execução de visitas.
 * Reutiliza as regras já homologadas de agendamento (próxima ação) e o
 * histórico do Lead. O banco (RLS) continua sendo a autoridade final.
 */

export type LeadVisit = {
  id: string;
  lead_id: string;
  route_id: string | null;
  stop_id: string | null;
  user_id: string;
  arrived_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  result: string;
  contact_person: string | null;
  notes: string | null;
  next_contact_date: string | null;
  created_at: string;
};

/** Registra o evento da visita no histórico do Lead (nunca sobrescreve). */
export async function logVisitHistory(leadId: string, description: string) {
  const { data } = await supabase.auth.getUser();
  await supabase.from("lead_history").insert({
    lead_id: leadId,
    user_id: data.user?.id ?? null,
    event_type: "visita",
    description,
  });
}

/** Inicia a visita: cria o registro real e coloca a parada em atendimento. */
export async function startVisit(input: {
  leadId: string;
  routeId: string;
  stopId: string;
  userId: string;
  routeTitle?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("lead_visits").insert({
    lead_id: input.leadId,
    route_id: input.routeId,
    stop_id: input.stopId,
    user_id: input.userId,
    arrived_at: now,
    started_at: now,
    result: "nao_informado",
  } as never);
  if (error) return { ok: false, message: error.message };

  const { error: stopError } = await supabase
    .from("visit_route_stops")
    .update({ status: "em_visita" } as never)
    .eq("id", input.stopId);
  if (stopError) return { ok: false, message: stopError.message };

  await logVisitHistory(
    input.leadId,
    `Visita iniciada em ${formatAppointment(now)}${input.routeTitle ? ` — roteiro ${input.routeTitle}` : ""}.`,
  );
  return { ok: true };
}

/** Encerra a visita, registra o resultado e, quando informada, a próxima ação. */
export async function finishVisit(input: {
  visit: LeadVisit;
  stopId: string;
  stopStatus: string;
  result: string;
  notes: string | null;
  contactPerson: string | null;
  nextAction: { scheduledAt: string; contactTypeId: string | null; typeLabel: string } | null;
  nextActionNotes?: string | null;
  routeTitle?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const finishedAt = new Date().toISOString();
  const startedAt = input.visit.started_at ?? input.visit.created_at;
  const duration = Math.max(
    1,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60000),
  );
  const nextDate = input.nextAction ? input.nextAction.scheduledAt.slice(0, 10) : null;

  const { error } = await supabase
    .from("lead_visits")
    .update({
      finished_at: finishedAt,
      duration_minutes: duration,
      result: input.result,
      notes: input.notes,
      contact_person: input.contactPerson,
      next_contact_date: nextDate,
    } as never)
    .eq("id", input.visit.id);
  if (error) return { ok: false, message: error.message };

  const { error: stopError } = await supabase
    .from("visit_route_stops")
    .update({ status: input.stopStatus, actual_visit_minutes: duration } as never)
    .eq("id", input.stopId);
  if (stopError) return { ok: false, message: stopError.message };

  const parts = [
    `Visita finalizada em ${formatAppointment(finishedAt)}`,
    `resultado: ${visitResultLabel(input.result).toLowerCase()}`,
    `duração: ${duration} min`,
  ];
  if (input.routeTitle) parts.push(`roteiro: ${input.routeTitle}`);
  if (input.contactPerson) parts.push(`contato: ${input.contactPerson}`);
  if (input.notes) parts.push(`observações: ${input.notes}`);
  await logVisitHistory(input.visit.lead_id, `${parts.join(" · ")}.`);

  if (input.nextAction) {
    const created = await createAppointment({
      leadId: input.visit.lead_id,
      scheduledAt: input.nextAction.scheduledAt,
      contactTypeId: input.nextAction.contactTypeId,
      typeLabel: input.nextAction.typeLabel,
    });
    if (!created.ok) {
      return { ok: true, message: "Visita registrada, mas a próxima ação não pôde ser agendada." };
    }
    await logVisitHistory(
      input.visit.lead_id,
      `Próxima ação definida na visita para ${formatAppointment(input.nextAction.scheduledAt)}${
        input.nextActionNotes ? ` — ${input.nextActionNotes}` : ""
      }.`,
    );
  }
  return { ok: true };
}

/** Atualiza o status do roteiro registrando início/fim reais e histórico do roteiro. */
export async function setRouteStatus(
  routeId: string,
  status: "planejado" | "em_andamento" | "concluido" | "cancelado",
): Promise<{ ok: boolean; message?: string }> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "em_andamento") patch['started_at'] = now;
  if (status === "concluido" || status === "cancelado") patch['finished_at'] = now;
  const { error } = await supabase.from("visit_routes").update(patch as never).eq("id", routeId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Links de ação rápida a partir dos dados já cadastrados no Lead. */
export function telLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `tel:+55${digits}` : null;
}

export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/55${digits}` : null;
}

export function mapsLink(input: {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
}): string | null {
  if (input.latitude != null && input.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${input.latitude},${input.longitude}`;
  }
  if (input.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.address)}`;
  }
  return null;
}
