export type LeadStatus =
  | "novo"
  | "em_contato"
  | "contatado"
  | "interessado"
  | "proposta_enviada"
  | "negociacao"
  | "convertido"
  | "perdido";

export const LEAD_STATUSES: { value: LeadStatus; label: string; className: string }[] = [
  { value: "novo", label: "Novo", className: "bg-info/15 text-info border-info/30" },
  { value: "em_contato", label: "Em contato", className: "bg-primary/15 text-primary border-primary/30" },
  { value: "contatado", label: "Contatado", className: "bg-accent text-accent-foreground border-border" },
  { value: "interessado", label: "Interessado", className: "bg-warning/20 text-warning-foreground border-warning/40" },
  { value: "proposta_enviada", label: "Proposta enviada", className: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
  { value: "negociacao", label: "Negociação", className: "bg-primary-glow/20 text-primary border-primary/30" },
  { value: "convertido", label: "Convertido", className: "bg-success/15 text-success border-success/30" },
  { value: "perdido", label: "Perdido", className: "bg-destructive/15 text-destructive border-destructive/30" },
];

export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function statusClass(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.className ?? "bg-muted text-muted-foreground";
}

/** Máscara de telefone brasileiro: (11) 99999-9999 ou (11) 3333-4444 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "phone", label: "Telefone" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista suspensa" },
  { value: "multiselect", label: "Seleção múltipla" },
  { value: "boolean", label: "Sim/Não" },
  { value: "textarea", label: "Área de texto" },
  { value: "checkbox", label: "Checkbox" },
] as const;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
