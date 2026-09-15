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
  /** Exclusão lógica do Lead: mantido no histórico da pesquisa, sem ações ativas. */
  deleted_at: string | null;
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

/**
 * Leads captados a partir de uma pesquisa arquivada.
 * Inclui Leads excluídos logicamente para preservar a fotografia histórica da pesquisa.
 */
export function useSearchLeads(searchId: string | null) {
  return useQuery({
    queryKey: ["lead_searches", "leads", searchId],
    enabled: !!searchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, company_name, contact_name, phone, status, neighborhood_name, city, state, latitude, longitude, next_contact_date, source, source_provider, created_by, deleted_at",
        )
        .eq("search_id", searchId!)
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
  /** Quando informado, atualiza a pesquisa existente (rascunho) em vez de criar outra. */
  searchId?: string | null;
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
  /** "rascunho" enquanto a captação está em andamento; "arquivada" quando concluída. */
  status?: string;
  leadIds: string[];
};

/**
 * Grava a pesquisa e vincula os Leads captados em uma única operação transacional no banco.
 * Se qualquer vínculo falhar, nada é gravado — não existe pesquisa "arquivada sem Leads".
 * Não altera dados de origem já existentes no Lead (provedor, id externo, região, data)
 * e nunca reatribui um Lead já vinculado a outra pesquisa.
 */
export async function archiveSearch(input: ArchiveSearchInput) {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: { message: string } | null }>
  )("upsert_lead_search_link", {
    _search_id: input.searchId ?? null,
    _name: input.name,
    _segment_id: input.segmentId,
    _segment_name: input.segmentName,
    _region: input.region,
    _city: input.city,
    _state: input.state,
    _radius_km: input.radiusKm,
    _requested: input.requested,
    _found: input.found,
    _selected: input.selected,
    _imported: input.imported,
    _provider: input.provider,
    _status: input.status ?? "arquivada",
    _notes: input.notes,
    _lead_ids: input.leadIds,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível registrar a pesquisa.");
  return data;
}

/** Nome sugerido para a pesquisa: "Pesquisa — Parque Boturussu". */
export function suggestSearchName(region: string, city: string, segment: string) {
  const place = region.trim() || city.trim();
  return `Pesquisa — ${place || segment || "sem região"}`;
}

/**
 * Conclui o arquivamento de uma pesquisa que ficou como rascunho
 * (por exemplo, quando a página foi recarregada antes de arquivar).
 * Não recalcula contagens históricas nem altera os Leads já vinculados.
 */
export async function finalizeSearch(searchId: string, name: string) {
  const { error } = await supabase
    .from("lead_searches")
    .update({ name, status: "arquivada", updated_at: new Date().toISOString() } as never)
    .eq("id", searchId);
  if (error) throw error;
  return searchId;
}
