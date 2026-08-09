import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Segment = { id: string; name: string; description: string | null; active: boolean };
export type Neighborhood = { id: string; name: string; city: string; state: string };
export type Street = {
  id: string;
  name: string;
  neighborhood_id: string | null;
  zip_code: string | null;
  city: string;
  state: string;
};
export type Product = { id: string; name: string; description: string | null; active: boolean };
export type SegmentField = {
  id: string;
  segment_id: string;
  label: string;
  field_key: string;
  field_type: string;
  required: boolean;
  options: unknown;
  sort_order: number;
};

export function useSegments() {
  return useQuery({
    queryKey: ["segments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("segments").select("*").order("name");
      if (error) throw error;
      return data as Segment[];
    },
  });
}

export function useNeighborhoods() {
  return useQuery({
    queryKey: ["neighborhoods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("neighborhoods").select("*").order("name");
      if (error) throw error;
      return data as Neighborhood[];
    },
  });
}

export function useStreets() {
  return useQuery({
    queryKey: ["streets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("streets").select("*").order("name");
      if (error) throw error;
      return data as Street[];
    },
  });
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products_services").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useSegmentProducts() {
  return useQuery({
    queryKey: ["segment_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("segment_products").select("*");
      if (error) throw error;
      return data as { segment_id: string; product_id: string }[];
    },
  });
}

export function useSegmentFields(segmentId: string | null) {
  return useQuery({
    queryKey: ["segment_fields", segmentId],
    enabled: !!segmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segment_fields")
        .select("*")
        .eq("segment_id", segmentId!)
        .order("sort_order");
      if (error) throw error;
      return data as SegmentField[];
    },
  });
}

export function useAllSegmentFields() {
  return useQuery({
    queryKey: ["segment_fields", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segment_fields")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as SegmentField[];
    },
  });
}

export function useAllLeadProducts() {
  return useQuery({
    queryKey: ["lead_products", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_products").select("lead_id, product_id");
      if (error) throw error;
      return data as { lead_id: string; product_id: string }[];
    },
  });
}

export function toOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}


export type ContactType = {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  sort_order: number;
};

export type Appointment = {
  id: string;
  lead_id: string;
  scheduled_at: string;
  contact_type_id: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
};

export function useContactTypes() {
  return useQuery({
    queryKey: ["contact_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_types")
        .select("id, name, icon, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as ContactType[];
    },
  });
}

/** Agendamentos visíveis ao usuário (RLS aplica as mesmas regras do lead). */
export function useAppointments() {
  return useQuery({
    queryKey: ["lead_appointments", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_appointments")
        .select("id, lead_id, scheduled_at, contact_type_id, status, notes, created_by")
        .order("scheduled_at");
      if (error) throw error;
      return data as Appointment[];
    },
  });
}

export function useLeadAppointments(leadId: string) {
  return useQuery({
    queryKey: ["lead_appointments", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_appointments")
        .select("id, lead_id, scheduled_at, contact_type_id, status, notes, created_by")
        .eq("lead_id", leadId)
        .order("scheduled_at");
      if (error) throw error;
      return data as Appointment[];
    },
  });
}

export type ProfileLite = { id: string; full_name: string; email: string | null };

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data as ProfileLite[];
    },
  });
}
