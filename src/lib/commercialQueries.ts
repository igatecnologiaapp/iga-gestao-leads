import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocType } from "@/lib/commercial";

export type CompanySettings = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  footer_note: string | null;
  default_validity_days: number;
  default_payment_terms: string | null;
  whatsapp_template: string;
};

export type PaymentMethod = { id: string; name: string; active: boolean; sort_order: number };
export type ItemCategory = { id: string; name: string; kind: string; active: boolean; sort_order: number };

export type CommercialDocument = {
  id: string;
  doc_type: DocType;
  doc_year: number;
  doc_number: number;
  number_label: string;
  version: number;
  status: string;
  lead_id: string;
  owner_id: string;
  created_by: string;
  issue_date: string;
  valid_until: string | null;
  client_company: string;
  client_contact: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_postal_code: string | null;
  client_street: string | null;
  client_number: string | null;
  client_neighborhood: string | null;
  client_city: string | null;
  client_state: string | null;
  client_segment: string | null;
  payment_method_id: string | null;
  payment_terms: string | null;
  payment_deadline: string | null;
  payment_notes: string | null;
  notes: string | null;
  discount_type: string;
  discount_value: number;
  total_services: number;
  total_parts: number;
  total_discount: number;
  total_general: number;
  converted_from_id: string | null;
  issued_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentItem = {
  id: string;
  document_id: string;
  category_id: string | null;
  product_id: string | null;
  description: string;
  extra_notes: string | null;
  unit: string | null;
  unit_price: number;
  quantity: number;
  discount_value: number;
  total: number;
  sort_order: number;
};

export type DocumentHistory = {
  id: string;
  document_id: string;
  event_type: string;
  description: string | null;
  metadata: unknown;
  created_by: string;
  created_at: string;
};

export function useCompanySettings() {
  return useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data as CompanySettings | null) ?? null;
    },
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment_methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, name, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as PaymentMethod[];
    },
  });
}

export function useItemCategories() {
  return useQuery({
    queryKey: ["item_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_categories")
        .select("id, name, kind, active, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as ItemCategory[];
    },
  });
}

export function useCommercialDocuments() {
  return useQuery({
    queryKey: ["commercial_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_documents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CommercialDocument[];
    },
  });
}

export function useCommercialDocument(id: string) {
  return useQuery({
    queryKey: ["commercial_document", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_documents")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data as unknown as CommercialDocument | null) ?? null;
    },
  });
}

export function useDocumentItems(documentId: string) {
  return useQuery({
    queryKey: ["commercial_document_items", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_document_items")
        .select("*")
        .eq("document_id", documentId)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as DocumentItem[];
    },
  });
}

export function useDocumentHistory(documentId: string) {
  return useQuery({
    queryKey: ["commercial_document_history", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_document_history")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DocumentHistory[];
    },
  });
}

export function useLeadDocuments(leadId: string) {
  return useQuery({
    queryKey: ["commercial_documents", "lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_documents")
        .select("*")
        .eq("lead_id", leadId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CommercialDocument[];
    },
  });
}

export async function logDocumentEvent(
  documentId: string,
  eventType: string,
  description?: string,
  metadata?: Record<string, unknown>,
) {
  await supabase.from("commercial_document_history").insert({
    document_id: documentId,
    event_type: eventType,
    description: description ?? null,
    metadata: (metadata ?? null) as never,
  });
}
