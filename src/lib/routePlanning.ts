import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fase 3.1 da Roteirização Inteligente — seleção de Pesquisas Arquivadas e
 * consolidação dos Leads candidatos.
 *
 * Não cria base paralela: lê os mesmos Leads oficiais (tabela `leads`), usando o
 * vínculo já existente `leads.search_id`. A RLS continua sendo a autoridade —
 * Leads sem permissão simplesmente não retornam na consulta.
 * Nesta fase não há cálculo de rota, distância, custo ou chamada externa.
 */

export type CandidateLead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
  segment_id: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_name: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  next_contact_date: string | null;
  created_by: string;
  search_id: string | null;
  deleted_at: string | null;
};

const LEAD_COLS =
  "id, company_name, contact_name, phone, status, segment_id, street_name, number, neighborhood_name, city, state, postal_code, latitude, longitude, next_contact_date, created_by, search_id, deleted_at";

/**
 * Leads das pesquisas selecionadas, sem duplicidade.
 * Uma única consulta com `in(...)` evita N+1; o mapa por id garante o conjunto único
 * mesmo que o mesmo Lead seja retornado mais de uma vez.
 */
export function useCandidateLeads(searchIds: string[]) {
  const key = searchIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["route_planning", "candidates", key],
    enabled: searchIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(LEAD_COLS)
        .in("search_id", searchIds)
        .is("deleted_at", null)
        .order("company_name");
      if (error) throw error;
      const unique = new Map<string, CandidateLead>();
      for (const row of (data ?? []) as unknown as CandidateLead[]) {
        if (!unique.has(row.id)) unique.set(row.id, row);
      }
      return Array.from(unique.values());
    },
  });
}

/** Leads com agendamento futuro em aberto na Agenda existente. */
export function useScheduledLeadIds(leadIds: string[]) {
  const key = leadIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["route_planning", "scheduled", key],
    enabled: leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_appointments")
        .select("lead_id")
        .in("lead_id", leadIds)
        .eq("status", "agendado")
        .gte("scheduled_at", new Date().toISOString());
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.lead_id as string));
    },
  });
}

export function hasLocation(lead: CandidateLead): boolean {
  return hasUsableCoords(lead.latitude, lead.longitude);
}

export function leadAddress(lead: CandidateLead): string {
  const parts = [
    [lead.street_name, lead.number].filter(Boolean).join(", "),
    lead.neighborhood_name,
    [lead.city, lead.state].filter(Boolean).join("/"),
  ].filter((p) => p && String(p).trim().length > 0);
  return parts.join(" · ");
}

/**
 * Persistência leve da seleção (pesquisas e Leads) apenas para não perder o trabalho
 * ao recarregar a página. O vínculo real permanece no banco; nada é gravado aqui.
 */
const STORAGE_KEY = "route-planning-selection-v1";

export type PlanningSelection = { searchIds: string[]; leadIds: string[] };

export function loadSelection(): PlanningSelection {
  if (typeof window === "undefined") return { searchIds: [], leadIds: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { searchIds: [], leadIds: [] };
    const parsed = JSON.parse(raw) as Partial<PlanningSelection>;
    return {
      searchIds: Array.isArray(parsed.searchIds) ? parsed.searchIds.filter((v) => typeof v === "string") : [],
      leadIds: Array.isArray(parsed.leadIds) ? parsed.leadIds.filter((v) => typeof v === "string") : [],
    };
  } catch {
    return { searchIds: [], leadIds: [] };
  }
}

export function saveSelection(selection: PlanningSelection) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* armazenamento indisponível: a seleção segue válida apenas na sessão atual */
  }
}

/* ------------------------------------------------------------------ */
/* Fase 3.2 — validação geográfica e pontos de saída/retorno           */
/* ------------------------------------------------------------------ */

/**
 * Coordenada utilizável: números finitos dentro dos limites geográficos reais.
 * Nada é estimado a partir do texto do endereço — sem coordenada, o Lead fica
 * identificado como pendente de localização.
 */
export function hasUsableCoords(lat: number | null, lon: number | null): boolean {
  if (lat == null || lon == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

export type GeoIssue = "ok" | "sem_latitude" | "sem_longitude" | "sem_coordenadas" | "invalida";

export function geoIssue(lead: CandidateLead): GeoIssue {
  const { latitude: lat, longitude: lon } = lead;
  if (lat == null && lon == null) return "sem_coordenadas";
  if (lat == null) return "sem_latitude";
  if (lon == null) return "sem_longitude";
  return hasUsableCoords(lat, lon) ? "ok" : "invalida";
}

export const GEO_ISSUE_LABEL: Record<GeoIssue, string> = {
  ok: "Com localização",
  sem_latitude: "Sem latitude",
  sem_longitude: "Sem longitude",
  sem_coordenadas: "Sem coordenadas",
  invalida: "Coordenada inválida",
};

/** Endereço completo já cadastrado, para ajudar a identificar o problema. */
export function leadFullAddress(lead: CandidateLead): string {
  const parts = [
    [lead.street_name, lead.number].filter(Boolean).join(", "),
    lead.neighborhood_name,
    [lead.city, lead.state].filter(Boolean).join("/"),
    lead.postal_code,
  ].filter((p) => p && String(p).trim().length > 0);
  return parts.join(" · ");
}

/**
 * Ponto de saída/retorno do planejamento. Nesta fase guarda o endereço digitado e,
 * quando o usuário usa a localização atual do aparelho, as coordenadas obtidas pelo
 * próprio navegador. Nenhuma API externa é chamada e nenhuma coordenada é inventada.
 */
export type PlanningPoint = {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  source: "endereco" | "localizacao_atual";
};

export type PlanningPoints = {
  start: PlanningPoint;
  sameAsStart: boolean;
  end: PlanningPoint;
};

export const emptyPoint: PlanningPoint = {
  label: "",
  address: "",
  latitude: null,
  longitude: null,
  source: "endereco",
};

export const defaultPoints: PlanningPoints = {
  start: emptyPoint,
  sameAsStart: true,
  end: emptyPoint,
};

const POINTS_KEY = "route-planning-points-v1";

function normalizePoint(value: unknown): PlanningPoint {
  const p = (value ?? {}) as Partial<PlanningPoint>;
  return {
    label: typeof p.label === "string" ? p.label : "",
    address: typeof p.address === "string" ? p.address : "",
    latitude: typeof p.latitude === "number" ? p.latitude : null,
    longitude: typeof p.longitude === "number" ? p.longitude : null,
    source: p.source === "localizacao_atual" ? "localizacao_atual" : "endereco",
  };
}

export function loadPoints(): PlanningPoints {
  if (typeof window === "undefined") return defaultPoints;
  try {
    const raw = window.localStorage.getItem(POINTS_KEY);
    if (!raw) return defaultPoints;
    const parsed = JSON.parse(raw) as Partial<PlanningPoints>;
    return {
      start: normalizePoint(parsed.start),
      sameAsStart: parsed.sameAsStart !== false,
      end: normalizePoint(parsed.end),
    };
  } catch {
    return defaultPoints;
  }
}

export function savePoints(points: PlanningPoints) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POINTS_KEY, JSON.stringify(points));
  } catch {
    /* armazenamento indisponível: os pontos seguem válidos apenas na sessão atual */
  }
}

export function isPointDefined(point: PlanningPoint): boolean {
  return point.address.trim().length > 0 || hasUsableCoords(point.latitude, point.longitude);
}
