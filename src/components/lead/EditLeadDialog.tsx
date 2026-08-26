import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/Combobox";
import { AddressFields, addressFromLead, type AddressValue } from "@/components/AddressFields";
import { DynamicField } from "@/components/DynamicField";
import {
  ContactLinksFields,
  contactLinksError,
  type ContactLinks,
} from "@/components/lead/ContactLinksFields";
import {
  AppointmentFields,
  emptyAppointment,
  type AppointmentDraft,
} from "@/components/AppointmentFields";
import { formatAppointment, fromLocalParts, toLocalParts } from "@/lib/appointments";
import { maskPhone } from "@/lib/leads";
import {
  useAllSegmentFields,
  useLeadAppointments,
  useNeighborhoods,
  useProducts,
  useSegmentProducts,
  useSegments,
  toOptions,
} from "@/lib/queries";

export type LeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  segment_id: string | null;
  street_id: string | null;
  street_name: string | null;
  number: string | null;
  neighborhood_id: string | null;
  postal_code: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  next_contact_date: string | null;
  notes: string | null;
};

export function EditLeadDialog({
  open,
  onOpenChange,
  lead,
  productIds: initialProducts,
  customValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  productIds: string[];
  customValues: { field_id: string; value: unknown }[];
  onSaved: () => void;
}) {
  const { data: segments = [] } = useSegments();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: products = [] } = useProducts();
  const { data: segmentProducts = [] } = useSegmentProducts();
  const { data: allFields = [] } = useAllSegmentFields();

  const [company, setCompany] = useState(lead.company_name);
  const [contact, setContact] = useState(lead.contact_name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [segmentId, setSegmentId] = useState<string | null>(lead.segment_id);
  const [links, setLinks] = useState<ContactLinks>({
    website: lead.website ?? "",
    instagram: lead.instagram ?? "",
    facebook: lead.facebook ?? "",
  });
  const [address, setAddress] = useState<AddressValue>(() => addressFromLead(lead));

  const { data: leadAppointments = [] } = useLeadAppointments(lead.id);
  const nextAppointment = leadAppointments.find((a) => a.status === "agendado") ?? null;
  const [appointment, setAppointment] = useState<AppointmentDraft>(emptyAppointment);
  const [productIds, setProductIds] = useState<string[]>(initialProducts);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompany(lead.company_name);
    setContact(lead.contact_name ?? "");
    setPhone(lead.phone ?? "");
    setSegmentId(lead.segment_id);
    setLinks({
      website: lead.website ?? "",
      instagram: lead.instagram ?? "",
      facebook: lead.facebook ?? "",
    });
    setAddress(addressFromLead(lead));

    setAppointment(
      nextAppointment
        ? {
            ...toLocalParts(nextAppointment.scheduled_at),
            contactTypeId: nextAppointment.contact_type_id,
            status: nextAppointment.status,
          }
        : emptyAppointment,
    );
    setProductIds(initialProducts);
    setNotes(lead.notes ?? "");
    setCustom(Object.fromEntries(customValues.map((cv) => [cv.field_id, cv.value])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nextAppointment?.id]);

  const fields = useMemo(
    () =>
      allFields
        .filter((f) => f.segment_id === segmentId)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allFields, segmentId],
  );

  const compatibleProducts = useMemo(() => {
    if (!segmentId) return [];
    const ids = new Set(
      segmentProducts.filter((sp) => sp.segment_id === segmentId).map((sp) => sp.product_id),
    );
    return products.filter((p) => ids.has(p.id) && p.active);
  }, [segmentId, segmentProducts, products]);

  async function save() {
    if (!company.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    for (const f of fields) {
      if (
        f.required &&
        (custom[f.id] === undefined || custom[f.id] === "" || custom[f.id] === null)
      ) {
        toast.error(`Preencha o campo "${f.label}".`);
        return;
      }
    }
    const linkError = contactLinksError(links);
    if (linkError) {
      toast.error(linkError);
      return;
    }
    setSaving(true);
    const nb = neighborhoods.find((n) => n.id === address.neighborhoodId);
    const { error } = await supabase
      .from("leads")
      .update({
        company_name: company.trim(),
        contact_name: contact.trim() || null,
        phone: phone || null,
        segment_id: segmentId,
        street_id: address.streetId,
        street_name: address.streetName || null,
        number: address.number || null,
        neighborhood_id: address.neighborhoodId,
        neighborhood_name: nb?.name ?? (address.neighborhoodName || null),
        city: nb?.city || address.city || null,
        state: nb?.state || address.state || null,
        postal_code: address.cep || null,
        website: links.website.trim() || null,
        instagram: links.instagram.trim() || null,
        facebook: links.facebook.trim() || null,

        next_contact_date: appointment.date || null,
        notes: notes.trim() || null,
      })
      .eq("id", lead.id);
    if (error) {
      setSaving(false);
      toast.error("Não foi possível salvar as alterações.");
      return;
    }

    const allowed = new Set(compatibleProducts.map((p) => p.id));
    const finalProducts = productIds.filter((pid) => allowed.has(pid));
    await supabase.from("lead_products").delete().eq("lead_id", lead.id);
    if (finalProducts.length) {
      await supabase
        .from("lead_products")
        .insert(finalProducts.map((product_id) => ({ lead_id: lead.id, product_id })));
    }

    const fieldIds = new Set(fields.map((f) => f.id));
    const rows = Object.entries(custom)
      .filter(([k, v]) => fieldIds.has(k) && v !== undefined && v !== "" && v !== null)
      .map(([field_id, value]) => ({ lead_id: lead.id, field_id, value: value as never }));
    await supabase.from("lead_custom_values").delete().eq("lead_id", lead.id);
    if (rows.length) await supabase.from("lead_custom_values").insert(rows);

    const { data: userData } = await supabase.auth.getUser();
    const historyRows: {
      lead_id: string;
      user_id: string | null;
      event_type: string;
      description: string;
    }[] = [
      {
        lead_id: lead.id,
        user_id: userData.user?.id ?? null,
        event_type: "edicao",
        description: "Dados do lead atualizados",
      },
    ];
    const scheduledAt = fromLocalParts(appointment.date, appointment.time);
    if (scheduledAt) {
      if (nextAppointment) {
        if (new Date(nextAppointment.scheduled_at).getTime() !== new Date(scheduledAt).getTime()) {
          historyRows.push({
            lead_id: lead.id,
            user_id: userData.user?.id ?? null,
            event_type: "agendamento",
            description: `Agendamento alterado de ${formatAppointment(nextAppointment.scheduled_at)} para ${formatAppointment(scheduledAt)}.`,
          });
        }
        await supabase
          .from("lead_appointments")
          .update({
            scheduled_at: scheduledAt,
            contact_type_id: appointment.contactTypeId,
            status: appointment.status as never,
          })
          .eq("id", nextAppointment.id);
      } else {
        await supabase.from("lead_appointments").insert({
          lead_id: lead.id,
          scheduled_at: scheduledAt,
          contact_type_id: appointment.contactTypeId,
          status: "agendado",
          // Autoria preenchida pelo banco (auth.uid()) — garante histórico confiável.
        });
        historyRows.push({
          lead_id: lead.id,
          user_id: userData.user?.id ?? null,
          event_type: "agendamento",
          description: `Agendamento criado para ${formatAppointment(scheduledAt)}.`,
        });
      }
    } else if (nextAppointment) {
      await supabase
        .from("lead_appointments")
        .update({ status: "cancelado" as never })
        .eq("id", nextAppointment.id);
      historyRows.push({
        lead_id: lead.id,
        user_id: userData.user?.id ?? null,
        event_type: "agendamento",
        description: `Agendamento de ${formatAppointment(nextAppointment.scheduled_at)} cancelado.`,
      });
    }
    await supabase.from("lead_history").insert(historyRows);

    setSaving(false);
    toast.success("Lead atualizado.");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editCompany">Nome da empresa *</Label>
            <Input
              id="editCompany"
              className="h-11"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editContact">Nome do contato</Label>
              <Input
                id="editContact"
                className="h-11"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Telefone</Label>
              <Input
                id="editPhone"
                className="h-11"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>
          </div>
          <ContactLinksFields
            idPrefix="edit"
            value={links}
            onChange={(patch) => setLinks((prev) => ({ ...prev, ...patch }))}
          />
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Combobox
              options={segments
                .filter((s) => s.active)
                .map((s) => ({ value: s.id, label: s.name }))}
              value={segmentId}
              onChange={(v) => {
                setSegmentId(v);
                const allowed = new Set(
                  segmentProducts.filter((sp) => sp.segment_id === v).map((sp) => sp.product_id),
                );
                setProductIds((prev) => prev.filter((pid) => allowed.has(pid)));
              }}
              placeholder="Selecione o segmento"
            />
          </div>
          {/* Mesmas regras da Captação: permite cadastrar rua nova, sempre com
              alerta de duplicidade e vínculo de bairro (nunca cadastro automático). */}
          <AddressFields
            idPrefix="edit"
            value={address}
            onChange={(patch) => setAddress((prev) => ({ ...prev, ...patch }))}
            allowCreateStreet
          />

          <div className="space-y-2 rounded-xl border p-3">
            <Label className="text-xs font-bold tracking-wide uppercase">Agendamento</Label>
            <AppointmentFields
              idPrefix="editAppt"
              value={appointment}
              onChange={setAppointment}
              showStatus={!!nextAppointment}
              onClear={() => setAppointment(emptyAppointment)}
            />
          </div>

          {compatibleProducts.length > 0 && (
            <div className="space-y-2">
              <Label>Soluções de interesse</Label>
              <div className="grid gap-2">
                {compatibleProducts.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"
                  >
                    <Checkbox
                      checked={productIds.includes(p.id)}
                      onCheckedChange={(v) =>
                        setProductIds((prev) =>
                          v ? [...prev, p.id] : prev.filter((pid) => pid !== p.id),
                        )
                      }
                    />
                    <span className="min-w-0 font-medium">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {fields.length > 0 && (
            <div className="space-y-3">
              <Label>Qualificação do segmento</Label>
              {fields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <Label htmlFor={`edit-${f.id}`}>
                    {f.label} {f.required ? "*" : ""}
                  </Label>
                  <DynamicField
                    id={`edit-${f.id}`}
                    type={f.field_type}
                    options={toOptions(f.options)}
                    value={custom[f.id]}
                    onChange={(v) => setCustom((prev) => ({ ...prev, [f.id]: v }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="editNotes">Observações da visita</Label>
            <Textarea
              id="editNotes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="h-11 w-full sm:w-auto" onClick={save} disabled={saving}>
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
