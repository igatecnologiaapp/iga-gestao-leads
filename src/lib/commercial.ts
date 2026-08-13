export type DocType = "orcamento" | "proposta" | "pedido";

export const DOC_TYPES: { value: DocType; label: string; plural: string }[] = [
  { value: "orcamento", label: "Orçamento", plural: "Orçamentos" },
  { value: "proposta", label: "Proposta", plural: "Propostas" },
  { value: "pedido", label: "Pedido", plural: "Pedidos" },
];

export function docTypeLabel(t: string): string {
  return DOC_TYPES.find((d) => d.value === t)?.label ?? t;
}

type StatusDef = { value: string; label: string; className: string };

const COMMON_CLASSES: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  emitido: "bg-info/15 text-info border-info/30",
  enviado: "bg-primary/15 text-primary border-primary/30",
  em_negociacao: "bg-warning/20 text-warning-foreground border-warning/40",
  aprovado: "bg-success/15 text-success border-success/30",
  recusado: "bg-destructive/15 text-destructive border-destructive/30",
  expirado: "bg-muted text-muted-foreground border-border",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
  confirmado: "bg-info/15 text-info border-info/30",
  em_processamento: "bg-primary/15 text-primary border-primary/30",
  faturado: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  concluido: "bg-success/15 text-success border-success/30",
};

const LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  emitido: "Emitido",
  enviado: "Enviado",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
  em_processamento: "Em processamento",
  faturado: "Faturado",
  concluido: "Concluído",
};

const PROPOSAL_FLOW = [
  "rascunho",
  "emitido",
  "enviado",
  "em_negociacao",
  "aprovado",
  "recusado",
  "expirado",
  "cancelado",
];
const ORDER_FLOW = ["rascunho", "confirmado", "em_processamento", "faturado", "concluido", "cancelado"];

export function statusesFor(type: DocType): StatusDef[] {
  const flow = type === "pedido" ? ORDER_FLOW : PROPOSAL_FLOW;
  return flow.map((value) => ({
    value,
    label: LABELS[value] ?? value,
    className: COMMON_CLASSES[value] ?? "bg-muted text-muted-foreground",
  }));
}

export function docStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function docStatusClass(status: string): string {
  return COMMON_CLASSES[status] ?? "bg-muted text-muted-foreground border-border";
}

/** Documentos em rascunho são totalmente editáveis; demais só permitem itens quando não finalizados. */
export const LOCKED_STATUSES = ["aprovado", "recusado", "cancelado", "faturado", "concluido"];

export function isEditable(status: string): boolean {
  return !LOCKED_STATUSES.includes(status);
}

export function isDraft(status: string): boolean {
  return status === "rascunho";
}

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function sanitizeFileName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 60);
}

export function pdfFileName(type: string, numberLabel: string, client: string, version: number): string {
  const base = `${sanitizeFileName(docTypeLabel(type))}-${sanitizeFileName(numberLabel)}-${sanitizeFileName(client || "CLIENTE")}`;
  return `${base}${version > 1 ? `-V${version}` : ""}.pdf`;
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\[([A-Z_]+)\]/g, (m, key: string) => vars[key] ?? m);
}

export const HISTORY_LABELS: Record<string, string> = {
  criado: "Documento criado",
  editado: "Documento editado",
  status: "Status alterado",
  item_adicionado: "Item adicionado",
  item_removido: "Item removido",
  item_alterado: "Item alterado",
  desconto: "Desconto alterado",
  pdf_gerado: "PDF gerado",
  envio_preparado: "Envio preparado",
  enviado: "Envio confirmado",
  falha_envio: "Falha no envio",
  convertido: "Documento convertido",
  duplicado: "Documento duplicado",
  excluido: "Documento excluído",
  nova_versao: "Nova versão gerada",
};
