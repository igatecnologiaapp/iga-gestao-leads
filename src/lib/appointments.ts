export type AppointmentStatus = "agendado" | "realizado" | "nao_realizado" | "cancelado";

export const APPOINTMENT_STATUSES: {
  value: AppointmentStatus;
  label: string;
  className: string;
}[] = [
  { value: "agendado", label: "Agendado", className: "bg-info/15 text-info border-info/30" },
  { value: "realizado", label: "Realizado", className: "bg-success/15 text-success border-success/30" },
  {
    value: "nao_realizado",
    label: "Não realizado",
    className: "bg-warning/20 text-warning-foreground border-warning/40",
  },
  {
    value: "cancelado",
    label: "Cancelado",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
];

export function appointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function appointmentStatusClass(status: string): string {
  return (
    APPOINTMENT_STATUSES.find((s) => s.value === status)?.className ??
    "bg-muted text-muted-foreground border-border"
  );
}

/** ISO -> { date: "yyyy-mm-dd", time: "HH:MM" } no fuso local do usuário. */
export function toLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** "yyyy-mm-dd" + "HH:MM" -> ISO (fuso local). Retorna null se incompleto. */
export function fromLocalParts(date: string, time: string): string | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** "15/08/2026 — 14:30" */
export function formatAppointment(iso: string | null | undefined): string {
  if (!iso) return "-";
  const { date, time } = toLocalParts(iso);
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} — ${time}`;
}

export function formatAppointmentDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = toLocalParts(iso).date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatAppointmentTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return toLocalParts(iso).time;
}

export function isToday(iso: string): boolean {
  return toLocalParts(iso).date === toLocalParts(new Date().toISOString()).date;
}

/** Atrasado = data/hora passada e ainda com status "agendado". */
export function isOverdue(iso: string, status: string): boolean {
  return status === "agendado" && new Date(iso).getTime() < Date.now();
}

export const APPOINTMENT_PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7", label: "Próximos 7 dias" },
  { value: "30", label: "Próximos 30 dias" },
  { value: "todos", label: "Todos" },
] as const;

export type AppointmentPeriod = (typeof APPOINTMENT_PERIODS)[number]["value"];
