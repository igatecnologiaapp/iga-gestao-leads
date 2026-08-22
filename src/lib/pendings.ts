import { toLocalParts } from "@/lib/appointments";

export type PendingTone = "atrasado" | "hoje" | "agendado" | "sem_acao";

export type LeadPending = {
  tone: PendingTone;
  /** Rótulo curto para badge (ex.: "Atrasado"). */
  label: string;
  /** Descrição completa (ex.: "Retorno hoje — 14:30"). */
  detail: string;
  /** Data (yyyy-mm-dd) da próxima ação, quando existir. */
  date: string | null;
};

const TONE_CLASS: Record<PendingTone, string> = {
  atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  hoje: "bg-warning/20 text-warning-foreground border-warning/40",
  agendado: "bg-success/15 text-success border-success/30",
  sem_acao: "bg-muted text-muted-foreground border-border",
};

export function pendingClass(tone: PendingTone): string {
  return TONE_CLASS[tone];
}

function todayKey(): string {
  return toLocalParts(new Date().toISOString()).date;
}

function br(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Situação da próxima ação de um lead.
 * Prioriza o agendamento ativo mais próximo; se não houver, usa a previsão de retorno.
 */
export function leadPending(
  lead: { next_contact_date?: string | null },
  appointments: { scheduled_at: string; status: string }[],
): LeadPending {
  const today = todayKey();
  const active = appointments
    .filter((a) => a.status === "agendado")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  if (active.length) {
    const next = active[0]!;
    const { date, time } = toLocalParts(next.scheduled_at);
    if (date < today) {
      return { tone: "atrasado", label: "Atrasado", detail: `Agendado em ${br(date)} — ${time}`, date };
    }
    if (date === today) {
      return { tone: "hoje", label: "Hoje", detail: `Contato hoje — ${time}`, date };
    }
    return { tone: "agendado", label: "Agendado", detail: `Agendado ${br(date)} — ${time}`, date };
  }

  const planned = lead.next_contact_date?.slice(0, 10) ?? null;
  if (planned) {
    if (planned < today) {
      return { tone: "atrasado", label: "Atrasado", detail: `Retorno previsto ${br(planned)}`, date: planned };
    }
    if (planned === today) {
      return { tone: "hoje", label: "Hoje", detail: "Retorno previsto para hoje", date: planned };
    }
    return { tone: "agendado", label: "Agendado", detail: `Retorno previsto ${br(planned)}`, date: planned };
  }

  return { tone: "sem_acao", label: "Sem próxima ação", detail: "Sem próxima ação definida", date: null };
}
