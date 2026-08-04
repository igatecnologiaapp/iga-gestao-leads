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

export function toOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}
