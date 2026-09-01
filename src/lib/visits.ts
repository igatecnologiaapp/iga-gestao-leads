/** Regras e rótulos compartilhados do módulo de Gestão de Visitas Comerciais. */

export type RouteStatus = "planejado" | "em_andamento" | "concluido" | "cancelado";
export type StopStatus =
  | "pendente"
  | "em_deslocamento"
  | "em_visita"
  | "visitado"
  | "nao_visitado"
  | "reagendado"
  | "cancelado";

export const ROUTE_STATUSES: { value: RouteStatus; label: string; className: string }[] = [
  { value: "planejado", label: "Planejado", className: "bg-info/15 text-info border-info/30" },
  { value: "em_andamento", label: "Em andamento", className: "bg-primary/15 text-primary border-primary/30" },
  { value: "concluido", label: "Concluído", className: "bg-success/15 text-success border-success/30" },
  { value: "cancelado", label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
];

export const STOP_STATUSES: { value: StopStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_deslocamento", label: "Em deslocamento" },
  { value: "em_visita", label: "Em visita" },
  { value: "visitado", label: "Visitado" },
  { value: "nao_visitado", label: "Não visitado" },
  { value: "reagendado", label: "Reagendado" },
  { value: "cancelado", label: "Cancelado" },
];

export const VISIT_RESULTS = [
  { value: "nao_informado", label: "Não informado" },
  { value: "responsavel_ausente", label: "Responsável ausente" },
  { value: "contato_realizado", label: "Contato realizado" },
  { value: "sem_interesse", label: "Sem interesse" },
  { value: "interessado", label: "Interessado" },
  { value: "demonstracao", label: "Demonstração" },
  { value: "proposta", label: "Proposta" },
  { value: "follow_up", label: "Follow-up" },
  { value: "venda", label: "Venda" },
] as const;

export const PRIORITIES = [
  { value: 1, label: "Alta" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Baixa" },
] as const;

export function routeStatusLabel(value: string): string {
  return ROUTE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function routeStatusClass(value: string): string {
  return (
    ROUTE_STATUSES.find((s) => s.value === value)?.className ?? "bg-muted text-muted-foreground"
  );
}

export function stopStatusLabel(value: string): string {
  return STOP_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function priorityLabel(value: number): string {
  return PRIORITIES.find((p) => p.value === value)?.label ?? String(value);
}

/** Custo estimado de combustível: distância ÷ consumo × preço do litro. */
export function fuelCost(distanceKm: number, kmPerLiter: number, pricePerLiter: number): number {
  if (!distanceKm || !kmPerLiter || kmPerLiter <= 0) return 0;
  return Math.round((distanceKm / kmPerLiter) * pricePerLiter * 100) / 100;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Normaliza nomes para comparação de duplicidade (sem acentos, pontuação ou caixa). */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function distanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type DuplicateCheckLead = {
  id: string;
  company_name: string;
  phone: string | null;
  street_name: string | null;
  number: string | null;
  latitude: number | null;
  longitude: number | null;
  source_external_id?: string | null;
};

export type DuplicateMatch = { leadId: string; reason: string } | null;

/**
 * Compara um estabelecimento pesquisado com os Leads existentes.
 * Critérios: identificador externo, telefone, nome + endereço e proximidade
 * geográfica (até 60 m) combinada com semelhança de nome.
 */
export function findDuplicate(
  place: {
    externalId: string;
    name: string;
    phone: string | null;
    street: string | null;
    number: string | null;
    latitude: number | null;
    longitude: number | null;
  },
  leads: DuplicateCheckLead[],
): DuplicateMatch {
  const placePhone = digitsOnly(place.phone);
  const placeName = normalizeName(place.name);

  for (const lead of leads) {
    if (place.externalId && lead.source_external_id === place.externalId) {
      return { leadId: lead.id, reason: "Mesmo registro já importado" };
    }
    if (placePhone.length >= 10 && digitsOnly(lead.phone).endsWith(placePhone.slice(-10))) {
      return { leadId: lead.id, reason: "Telefone já cadastrado" };
    }
    const leadName = normalizeName(lead.company_name);
    if (placeName && leadName === placeName) {
      return { leadId: lead.id, reason: "Nome já cadastrado" };
    }
    if (
      place.latitude != null &&
      place.longitude != null &&
      lead.latitude != null &&
      lead.longitude != null
    ) {
      const d = distanceKm(place.latitude, place.longitude, lead.latitude, lead.longitude);
      if (d <= 0.06 && placeName && leadName && (leadName.includes(placeName.split(" ")[0] ?? "") || placeName.includes(leadName.split(" ")[0] ?? ""))) {
        return { leadId: lead.id, reason: "Mesmo endereço/coordenada" };
      }
    }
  }
  return null;
}
