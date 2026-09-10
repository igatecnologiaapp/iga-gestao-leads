import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de leitura/escrita das Pesquisas Arquivadas.
 * Reutiliza o cadastro oficial de Leads: a pesquisa apenas referencia os Leads captados
 * (leads.search_id), sem criar base paralela.
 */
export type LeadSearch = {
  id: string;
  name: string;
  segment_id: string | null;
  segment_name: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  radius_km: number | null;
  requested_count: number;
  found_count: number;
  selected_count: number;
  imported_count: number;
  provider: string | null;
  status: string;
  notes: string | null;
  owner_id: string;
  created_by: string;
  searched_at: string;
  created_at: string;
  updated_at: string;
};

export type SearchLead = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
  neighborhood_name: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  next_contact_date: string | null;
  source: string;
  source_provider: string | null;
  created_by: string;
};

const SEARCH_COLS =
  "id, name, segment_id, segment_name, region, city, state, radius_km, requested_count, found_count, selected_count, imported_count, provider, status, notes, owner_id, created_by, searched_at, created_at, updated_at";

/** Pesquisas arquivadas visíveis ao usuário (a RLS é a autoridade final). */
export function useLeadSearches() {
  return useQuery({
    queryKey: ["lead_searches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_searches")
        .select(SEARCH_COLS)
        .order("searched_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as LeadSearch[];
    },
  });
}

/** Leads captados a partir de uma pesquisa arquivada. */
export function useSearchLeads(searchId: string | null) {
  return useQuery({
    queryKey: ["lead_searches", "leads", searchId],
    enabled: !!searchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, status, neighborhood_name, city, state, latitude, longitude, next_contact_date, source, source_provider, created_by",
        )
        .eq("search_id", searchId!)
        .is("deleted_at", null)
        .order("company_name");
      if (error) throw error;
      return (data ?? []) as unknown as SearchLead[];
    },
  });
}

/** Visitas registradas para um conjunto de Leads (indicação de visita na pesquisa). */
export function useVisitedLeadIds(leadIds: string[]) {
  const key = leadIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["lead_searches", "visited", key],
    enabled: leadIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_visits")
        .select("lead_id")
        .in("lead_id", leadIds);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.lead_id as string));
    },
  });
}

export type ArchiveSearchInput = {
  name: string;
  segmentId: string | null;
  segmentName: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  radiusKm: number | null;
  requested: number;
  found: number;
  selected: number;
  imported: number;
  provider: string | null;
  notes: string | null;
  userId: string;
  leadIds: string[];
};

/**
 * Arquiva a pesquisa e vincula os Leads captados.
 * Não altera dados de origem já existentes no Lead (provedor, id externo, região, data).
 */
export async function archiveSearch(input: ArchiveSearchInput) {
  const { data, error } = await supabase
    .from("lead_searches")
    .insert({
      name: input.name,
      segment_id: input.segmentId,
      segment_name: input.segmentName,
      region: input.region,
      city: input.city,
      state: input.state,
      radius_km: input.radiusKm,
      requested_count: input.requested,
      found_count: input.found,
      selected_count: input.selected,
      imported_count: input.imported,
      provider: input.provider,
      notes: input.notes,
      owner_id: input.userId,
      created_by: input.userId,
    } as never)
    .select("id")
    .single();
  if (error) throw error;

  const searchId = (data as { id: string }).id;
  if (input.leadIds.length > 0) {
    const { error: linkError } = await supabase
      .from("leads")
      .update({ search_id: searchId } as never)
      .in("id", input.leadIds);
    if (linkError) throw linkError;
  }
  return searchId;
}

/** Nome sugerido para a pesquisa: "Pesquisa — Parque Boturussu". */
export function suggestSearchName(region: string, city: string, segment: string) {
  const place = region.trim() || city.trim();
  return `Pesquisa — ${place || segment || "sem região"}`;
}
