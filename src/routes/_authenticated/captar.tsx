import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { Combobox } from "@/components/Combobox";
import { PageHeader } from "@/components/PageHeader";
import {
  AddressFields,
  emptyAddress,
  useAddressResolver,
  type AddressValue,
} from "@/components/AddressFields";
import { BusinessCardScanner } from "@/components/BusinessCardScanner";
import type { BusinessCardData } from "@/lib/businessCard.functions";
import { maskCep, isCepComplete, normalizePlace } from "@/lib/leads";
import {
  AppointmentFields,
  emptyAppointment,
  type AppointmentDraft,
} from "@/components/AppointmentFields";
import { fromLocalParts, formatAppointment } from "@/lib/appointments";
import { DynamicField } from "@/components/DynamicField";
import {
  useNeighborhoods,
  useProducts,
  useSegmentFields,
  useSegmentProducts,
  useSegments,
  toOptions,
} from "@/lib/queries";
import { maskPhone } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/captar")({
  head: () => ({
    meta: [
      { title: "Captar Lead — IGA TECNOLOGIA" },
      { name: "description", content: "Cadastro rápido de leads durante a visita comercial." },
      { property: "og:title", content: "Captar Lead — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Cadastro rápido de leads durante a visita comercial.",
      },
    ],
  }),
  component: CaptarLead,
});

function CaptarLead() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: segments = [] } = useSegments();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: products = [] } = useProducts();
  const { data: segmentProducts = [] } = useSegmentProducts();

  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState<AddressValue>(emptyAddress);
  const [addressKey, setAddressKey] = useState(0);
  const [appointment, setAppointment] = useState<AppointmentDraft>(emptyAppointment);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const { data: fields = [] } = useSegmentFields(segmentId);

  function patchAddress(patch: Partial<AddressValue>) {
    setAddress((prev) => ({ ...prev, ...patch }));
  }

  // Lembrar o último segmento usado na sessão
  useEffect(() => {
    const last = sessionStorage.getItem("lastSegment");
    if (last) setSegmentId(last);
  }, []);
  useEffect(() => {
    if (segmentId) sessionStorage.setItem("lastSegment", segmentId);
  }, [segmentId]);

  const compatibleProducts = useMemo(() => {
    if (!segmentId) return [];
    const ids = new Set(
      segmentProducts.filter((sp) => sp.segment_id === segmentId).map((sp) => sp.product_id),
    );
    return products.filter((p) => ids.has(p.id) && p.active);
  }, [segmentId, segmentProducts, products]);

  function resetForm() {
    setCompany("");
    setContact("");
    setPhone("");
    setAddress(emptyAddress);
    setAddressKey((k) => k + 1);
    setAppointment(emptyAppointment);
    setProductIds([]);
    setCustom({});
    setNotes("");
    setSavedId(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    for (const f of fields) {
      if (f.required && (custom[f.id] === undefined || custom[f.id] === "")) {
        toast.error(`Preencha o campo "${f.label}".`);
        return;
      }
    }
    if ((appointment.date && !appointment.time) || (!appointment.date && appointment.time)) {
      toast.error("Informe data e hora do agendamento.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const nb = neighborhoods.find((n) => n.id === address.neighborhoodId);
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
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

        next_contact_date: appointment.date || null,
        notes: notes.trim() || null,
        created_by: userData.user!.id,
      })
      .select()
      .single();

    if (error || !lead) {
      setSaving(false);
      toast.error("Erro ao salvar o lead.");
      return;
    }

    if (productIds.length) {
      await supabase
        .from("lead_products")
        .insert(productIds.map((product_id) => ({ lead_id: lead.id, product_id })));
    }
    const customRows = Object.entries(custom)
      .filter(([, v]) => v !== undefined && v !== "" && v !== null)
      .map(([field_id, value]) => ({ lead_id: lead.id, field_id, value: value as never }));
    if (customRows.length) await supabase.from("lead_custom_values").insert(customRows);

    const scheduledAt = fromLocalParts(appointment.date, appointment.time);
    if (scheduledAt) {
      await supabase.from("lead_appointments").insert({
        lead_id: lead.id,
        scheduled_at: scheduledAt,
        contact_type_id: appointment.contactTypeId,
        status: "agendado",
        created_by: userData.user!.id,
      });
      await supabase.from("lead_history").insert({
        lead_id: lead.id,
        user_id: userData.user!.id,
        event_type: "agendamento",
        description: `Agendamento criado para ${formatAppointment(scheduledAt)}.`,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["lead_appointments"] });

    await queryClient.invalidateQueries({ queryKey: ["leads"] });
    setSaving(false);
    setSavedId(lead.id);
  }

  if (savedId) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-14 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">Lead cadastrado com sucesso!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Continue a prospecção agora mesmo.</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button className="h-12 text-base" onClick={resetForm}>
            Cadastrar outro Lead
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => navigate({ to: "/leads/$id", params: { id: savedId } })}
          >
            Ver lead cadastrado
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Captar Lead"
        description="Preencha o essencial. O restante pode ser completado depois."
      />

      <form className="mt-5 space-y-5" onSubmit={save}>
        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="mb-4 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Dados da empresa
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company">Nome da empresa *</Label>
              <Input
                id="company"
                className="h-11"
                value={company}
                autoFocus
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Nome do contato</Label>
              <Input
                id="contact"
                className="h-11"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                className="h-11"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Segmento</Label>
              <Combobox
                options={segments
                  .filter((s) => s.active)
                  .map((s) => ({ value: s.id, label: s.name }))}
                value={segmentId}
                onChange={(v) => {
                  setSegmentId(v);
                  // Mantém apenas as soluções compatíveis com o novo segmento
                  const allowed = new Set(
                    segmentProducts.filter((sp) => sp.segment_id === v).map((sp) => sp.product_id),
                  );
                  setProductIds((prev) => prev.filter((id) => allowed.has(id)));
                  setCustom({});
                }}
                placeholder="Selecione o segmento"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="mb-4 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Endereço
          </h2>
          <AddressFields
            key={addressKey}
            value={address}
            onChange={patchAddress}
            allowCreateStreet
          />
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Agendamento de contato
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional. Informe data e hora juntas para registrar o agendamento.
          </p>
          <div className="mt-4">
            <AppointmentFields
              idPrefix="novo"
              value={appointment}
              onChange={setAppointment}
              onClear={() => setAppointment(emptyAppointment)}
            />
          </div>
        </section>

        {segmentId && compatibleProducts.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Quais soluções podem atender este Lead?
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {compatibleProducts.map((p) => {
                const checked = productIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setProductIds((prev) =>
                          v ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                        )
                      }
                    />
                    <span className="min-w-0 text-sm font-medium">{p.name}</span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {fields.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h2 className="mb-4 text-sm font-bold tracking-wide text-muted-foreground uppercase">
              Qualificação do segmento
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.id} className="space-y-2">
                  <Label htmlFor={f.id}>
                    {f.label} {f.required ? "*" : ""}
                  </Label>
                  <DynamicField
                    id={f.id}
                    type={f.field_type}
                    options={toOptions(f.options)}
                    value={custom[f.id]}
                    onChange={(v) => setCustom((prev) => ({ ...prev, [f.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <Label
            htmlFor="notes"
            className="text-sm font-bold tracking-wide text-muted-foreground uppercase"
          >
            Observações da visita
          </Label>
          <Textarea
            id="notes"
            rows={4}
            className="mt-3"
            value={notes}
            placeholder="Ex.: Proprietário interessado em sistema de estoque."
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar Lead
        </Button>
        <div className="h-14 md:hidden" />
      </form>
    </div>
  );
}
