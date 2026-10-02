export type AppointmentStatus = "agendado" | "realizado" | "nao_realizado" | "cancelado";

/** Fuso oficial para datas e horários operacionais da empresa. */
export const COMMERCIAL_TIME_ZONE = "America/Sao_Paulo";
export const COMMERCIAL_TIME_ZONE_LABEL = "Horário de Brasília";

const commercialPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMMERCIAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function commercialParts(date: Date) {
  const values = Object.fromEntries(
    commercialPartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

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

/** ISO UTC -> data/hora comercial de São Paulo, independente do dispositivo. */
export function toLocalParts(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const parts = commercialParts(d);
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** Data/hora comercial de São Paulo -> ISO UTC. Retorna null para valor inválido. */
export function fromLocalParts(date: string, time: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) return null;

  let instant = wallClockUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = commercialParts(new Date(instant));
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const next = wallClockUtc - (representedAsUtc - instant);
    if (next === instant) break;
    instant = next;
  }

  const iso = new Date(instant).toISOString();
  const roundTrip = toLocalParts(iso);
  return roundTrip.date === date && roundTrip.time === time ? iso : null;
}

export function commercialToday(now = new Date()): string {
  return toLocalParts(now.toISOString()).date;
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
