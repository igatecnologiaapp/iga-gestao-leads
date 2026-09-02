import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Vehicle = {
  id: string;
  description: string;
  plate: string | null;
  fuel_type: string;
  avg_consumption: number;
  fuel_price: number;
  active: boolean;
};

export type VisitRoute = {
  id: string;
  title: string | null;
  route_date: string;
  owner_id: string;
  created_by: string;
  departure_time: string | null;
  available_minutes: number | null;
  start_label: string | null;
  start_address: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  end_label: string | null;
  end_address: string | null;
  vehicle_id: string | null;
  segment_id: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  status: string;
  planned_distance_km: number | null;
  estimated_cost: number | null;
};

export type RouteStop = {
  id: string;
  route_id: string;
  lead_id: string;
  sort_order: number;
  priority: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  planned_time: string | null;
  planned_travel_minutes: number | null;
  planned_visit_minutes: number;
  status: string;
  notes: string | null;
};

export type LeadLite = {
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
  source_external_id: string | null;
};

const LEAD_COLS =
  "id, company_name, contact_name, phone, status, segment_id, street_name, number, neighborhood_name, city, state, postal_code, latitude, longitude, source_external_id";

/** Veículos operacionais (leitura para todos, manutenção restrita a administradores). */
export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, description, plate, fuel_type, avg_consumption, fuel_price, active")
        .order("description");
      if (error) throw error;
      return data as unknown as Vehicle[];
    },
  });
}

/** Roteiros visíveis ao usuário (RLS: admin vê todos; colaborador vê os seus). */
export function useVisitRoutes() {
  return useQuery({
    queryKey: ["visit_routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_routes")
        .select("*")
        .order("route_date", { ascending: false });
      if (error) throw error;
      return data as unknown as VisitRoute[];
    },
  });
}

export function useVisitRoute(routeId: string) {
  return useQuery({
    queryKey: ["visit_routes", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_routes")
        .select("*")
        .eq("id", routeId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as VisitRoute) ?? null;
    },
  });
}

export function useRouteStops(routeId: string) {
  return useQuery({
    queryKey: ["visit_route_stops", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_route_stops")
        .select("*")
        .eq("route_id", routeId)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as RouteStop[];
    },
  });
}

/** Leads ativos visíveis ao usuário — base para duplicidade e seleção de roteiro. */
export function useLeadsLite() {
  return useQuery({
    queryKey: ["leads", "lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(LEAD_COLS)
        .is("deleted_at", null)
        .order("company_name");
      if (error) throw error;
      return data as unknown as LeadLite[];
    },
  });
}

export function leadAddress(lead: LeadLite): string {
  return [
    [lead.street_name, lead.number].filter(Boolean).join(", "),
    lead.neighborhood_name,
    [lead.city, lead.state].filter(Boolean).join("/"),
  ]
    .filter(Boolean)
    .join(" · ");
}
