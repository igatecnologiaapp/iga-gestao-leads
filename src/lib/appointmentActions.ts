import { supabase } from "@/integrations/supabase/client";
import { appointmentStatusLabel, formatAppointment, toLocalParts } from "@/lib/appointments";

/**
 * Regras compartilhadas de agendamento (Central do Lead e Agenda Operacional).
 * O banco (RLS) continua sendo a autoridade final de permissão.
 */

/** Mantém leads.next_contact_date alinhado ao próximo agendamento ativo. */
export async function syncNextContactDate(leadId: string) {
  const { data } = await supabase
    .from("lead_appointments")
    .select("scheduled_at")
    .eq("lead_id", leadId)
    .eq("status", "agendado")
    .order("scheduled_at")
    .limit(1);
  const next = data?.[0]?.scheduled_at ?? null;
  await supabase
    .from("leads")
    .update({ next_contact_date: next ? toLocalParts(next).date : null })
    .eq("id", leadId);
}

/** Registra o evento no histórico do lead. */
export async function logAppointmentHistory(leadId: string, description: string) {
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("lead_history").insert({
    lead_id: leadId,
    user_id: userData.user?.id ?? null,
    event_type: "agendamento",
    description,
  });
}

/** Atualiza a situação de um agendamento, com histórico e sincronismo do lead. */
export async function setAppointmentStatus(
  appointment: { id: string; lead_id: string; scheduled_at: string },
  status: string,
): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from("lead_appointments")
    .update({ status: status as never })
    .eq("id", appointment.id);
  if (error) return { ok: false };
  await logAppointmentHistory(
    appointment.lead_id,
    `Agendamento de ${formatAppointment(appointment.scheduled_at)} marcado como ${appointmentStatusLabel(status).toLowerCase()}.`,
  );
  await syncNextContactDate(appointment.lead_id);
  return { ok: true };
}

/** Cria um agendamento (autoria definida pelo banco via auth.uid()). */
export async function createAppointment(input: {
  leadId: string;
  scheduledAt: string;
  contactTypeId: string | null;
  typeLabel: string;
}): Promise<{ ok: boolean }> {
  const { error } = await supabase.from("lead_appointments").insert({
    lead_id: input.leadId,
    scheduled_at: input.scheduledAt,
    contact_type_id: input.contactTypeId,
    status: "agendado",
  });
  if (error) return { ok: false };
  await logAppointmentHistory(
    input.leadId,
    `Agendamento criado para ${formatAppointment(input.scheduledAt)} — ${input.typeLabel}.`,
  );
  await syncNextContactDate(input.leadId);
  return { ok: true };
}

/** Atualiza data/hora, tipo e situação de um agendamento (fonte única de regra). */
export async function updateAppointment(input: {
  appointment: { id: string; lead_id: string; scheduled_at: string; status: string };
  scheduledAt: string;
  contactTypeId: string | null;
  status: string;
}): Promise<{ ok: boolean }> {
  const { appointment, scheduledAt, contactTypeId, status } = input;
  const { error } = await supabase
    .from("lead_appointments")
    .update({
      scheduled_at: scheduledAt,
      contact_type_id: contactTypeId,
      status: status as never,
    })
    .eq("id", appointment.id);
  if (error) return { ok: false };
  if (new Date(appointment.scheduled_at).getTime() !== new Date(scheduledAt).getTime()) {
    await logAppointmentHistory(
      appointment.lead_id,
      `Agendamento alterado de ${formatAppointment(appointment.scheduled_at)} para ${formatAppointment(scheduledAt)}.`,
    );
  }
  if (appointment.status !== status) {
    await logAppointmentHistory(
      appointment.lead_id,
      `Agendamento de ${formatAppointment(scheduledAt)} marcado como ${appointmentStatusLabel(status).toLowerCase()}.`,
    );
  }
  await syncNextContactDate(appointment.lead_id);
  return { ok: true };
}
