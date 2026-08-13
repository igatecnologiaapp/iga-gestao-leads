import { supabase } from "@/integrations/supabase/client";
import type { DocType } from "@/lib/commercial";
import { docTypeLabel } from "@/lib/commercial";
import { logDocumentEvent } from "@/lib/commercialQueries";

type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  postal_code: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_name: string | null;
  city: string | null;
  state: string | null;
  segment_id: string | null;
};

/** Snapshot dos dados do lead no momento da criação do documento. */
export async function leadSnapshot(leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, company_name, contact_name, phone, postal_code, street_name, number, neighborhood_name, city, state, segment_id",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("Lead não encontrado");
  const lead = data as LeadRow;
  let segmentName: string | null = null;
  if (lead.segment_id) {
    const { data: seg } = await supabase
      .from("segments")
      .select("name")
      .eq("id", lead.segment_id)
      .maybeSingle();
    segmentName = (seg as { name: string } | null)?.name ?? null;
  }
  return {
    client_company: lead.company_name,
    client_contact: lead.contact_name,
    client_phone: lead.phone,
    client_postal_code: lead.postal_code,
    client_street: lead.street_name,
    client_number: lead.number,
    client_neighborhood: lead.neighborhood_name,
    client_city: lead.city,
    client_state: lead.state,
    client_segment: segmentName,
  };
}

async function nextNumber(docType: DocType) {
  const { data, error } = await supabase.rpc("next_document_number", { _doc_type: docType });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    doc_year: number;
    doc_number: number;
    number_label: string;
  };
  return row;
}

export type CreateDocumentInput = {
  leadId: string;
  docType: DocType;
  sourceDocumentId?: string;
  reason?: "conversao" | "duplicacao";
};

/** Cria um novo documento comercial, opcionalmente copiando itens/condições de outro. */
export async function createCommercialDocument({
  leadId,
  docType,
  sourceDocumentId,
  reason,
}: CreateDocumentInput): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Sessão expirada");

  const num = await nextNumber(docType);

  let base: Record<string, unknown> = {};
  if (sourceDocumentId) {
    const { data: src, error } = await supabase
      .from("commercial_documents")
      .select("*")
      .eq("id", sourceDocumentId)
      .maybeSingle();
    if (error || !src) throw error ?? new Error("Documento de origem não encontrado");
    const s = src as Record<string, unknown>;
    base = {
      client_company: s['client_company'],
      client_contact: s['client_contact'],
      client_phone: s['client_phone'],
      client_email: s['client_email'],
      client_postal_code: s['client_postal_code'],
      client_street: s['client_street'],
      client_number: s['client_number'],
      client_neighborhood: s['client_neighborhood'],
      client_city: s['client_city'],
      client_state: s['client_state'],
      client_segment: s['client_segment'],
      payment_method_id: s['payment_method_id'],
      payment_terms: s['payment_terms'],
      payment_deadline: s['payment_deadline'],
      payment_notes: s['payment_notes'],
      notes: s['notes'],
      discount_type: s['discount_type'],
      discount_value: s['discount_value'],
      valid_until: s['valid_until'],
      converted_from_id: sourceDocumentId,
    };
  } else {
    base = await leadSnapshot(leadId);
    const { data: company } = await supabase
      .from("company_settings")
      .select("default_payment_terms")
      .limit(1)
      .maybeSingle();
    base['payment_terms'] = (company as { default_payment_terms: string | null } | null)
      ?.default_payment_terms ?? null;
  }

  const { data: created, error: insertError } = await supabase
    .from("commercial_documents")
    .insert({
      ...base,
      doc_type: docType,
      doc_year: num.doc_year,
      doc_number: num.doc_number,
      number_label: num.number_label,
      lead_id: leadId,
      owner_id: uid,
      created_by: uid,
      status: "rascunho",
    } as never)
    .select("id")
    .single();
  if (insertError || !created) throw insertError ?? new Error("Falha ao criar documento");
  const newId = (created as { id: string }).id;

  if (sourceDocumentId) {
    const { data: items } = await supabase
      .from("commercial_document_items")
      .select("*")
      .eq("document_id", sourceDocumentId)
      .order("sort_order");
    const rows = (items ?? []) as Record<string, unknown>[];
    if (rows.length) {
      await supabase.from("commercial_document_items").insert(
        rows.map((i) => ({
          document_id: newId,
          category_id: i['category_id'],
          product_id: i['product_id'],
          description: i['description'],
          extra_notes: i['extra_notes'],
          unit: i['unit'],
          unit_price: i['unit_price'],
          quantity: i['quantity'],
          discount_value: i['discount_value'],
          sort_order: i['sort_order'],
        })) as never,
      );
    }
    const label = reason === "duplicacao" ? "duplicado" : "convertido";
    await logDocumentEvent(
      newId,
      "criado",
      `Documento criado por ${label === "duplicado" ? "duplicação" : "conversão"} (${docTypeLabel(docType)} ${num.number_label})`,
    );
    await logDocumentEvent(
      sourceDocumentId,
      label,
      `${label === "duplicado" ? "Duplicado" : "Convertido"} em ${docTypeLabel(docType)} ${num.number_label}`,
      { target_document_id: newId },
    );
  } else {
    await logDocumentEvent(newId, "criado", `${docTypeLabel(docType)} ${num.number_label} criado`);
  }

  return newId;
}

/** Exclusão lógica com motivo e autoria. */
export async function softDeleteDocument(documentId: string, reason: string) {
  const { data: userData } = await supabase.auth.getUser();
  await logDocumentEvent(documentId, "excluido", reason || "Documento excluído");
  const { error } = await supabase
    .from("commercial_documents")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userData.user?.id ?? null,
      delete_reason: reason || null,
    } as never)
    .eq("id", documentId);
  if (error) throw error;
}
