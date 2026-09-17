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
  return lead.latitude != null && lead.longitude != null;
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
