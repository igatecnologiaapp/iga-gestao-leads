import { toLocalParts } from "@/lib/appointments";

/** Lead reduzido usado pelos indicadores do Dashboard. */
export type DashLead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
  segment_id: string | null;
  created_at: string;
  created_by: string | null;
  neighborhood_name: string | null;
  street_name: string | null;
  city: string | null;
  next_contact_date: string | null;
};

export type DateRange = { from: string; to: string };

export const PERIOD_PRESETS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "mes", label: "Mês atual" },
  { value: "mes_anterior", label: "Mês anterior" },
  { value: "custom", label: "Período personalizado" },
] as const;

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return isoDate(new Date());
}

/** Converte um preset em intervalo de datas locais (yyyy-mm-dd). */
export function presetRange(preset: string): DateRange {
  const now = new Date();
  const today = isoDate(now);
  if (preset === "hoje") return { from: today, to: today };
  if (preset === "ontem") {
    const y = new Date(now.getTime() - 86400000);
    return { from: isoDate(y), to: isoDate(y) };
  }
  if (preset === "7") return { from: isoDate(new Date(now.getTime() - 6 * 86400000)), to: today };
  if (preset === "30") return { from: isoDate(new Date(now.getTime() - 29 * 86400000)), to: today };
  if (preset === "mes")
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  if (preset === "mes_anterior")
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
}

export function periodLabel(range: DateRange): string {
  const br = (v: string) => {
    const [y, m, d] = v.split("-");
    return `${d}/${m}/${y}`;
  };
  return range.from === range.to ? br(range.from) : `${br(range.from)} a ${br(range.to)}`;
}

/** Uma data ISO (timestamp) cai dentro do período, considerando o fuso local. */
export function inRangeIso(iso: string | null | undefined, range: DateRange): boolean {
  if (!iso) return false;
  const d = toLocalParts(iso).date;
  return d >= range.from && d <= range.to;
}

/** Uma data "yyyy-mm-dd" cai dentro do período. */
export function inRangeDate(value: string | null | undefined, range: DateRange): boolean {
  if (!value) return false;
  const d = value.slice(0, 10);
  return d >= range.from && d <= range.to;
}

/** Agrupa itens por chave preservando a ordem de maior volume. */
export function groupBy<T>(items: T[], key: (item: T) => string): { key: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    map.set(k, [...(map.get(k) ?? []), item]);
  }
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, items: v }))
    .sort((a, b) => b.items.length - a.items.length);
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);
}

/** Percentual seguro (0 quando a base é zero). */
export function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
