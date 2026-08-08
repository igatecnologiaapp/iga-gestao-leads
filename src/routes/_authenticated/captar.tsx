import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/Combobox";
import { DynamicField } from "@/components/DynamicField";
import {
  useNeighborhoods,
  useProducts,
  useSegmentFields,
  useSegmentProducts,
  useSegments,
  useStreets,
  toOptions,
} from "@/lib/queries";
import {
  isCepComplete,
  lookupCep,
  maskCep,
  maskPhone,
  normalizePlace,
} from "@/lib/leads";


export const Route = createFileRoute("/_authenticated/captar")({
  head: () => ({
    meta: [
      { title: "Captar Lead — LeadField" },
      { name: "description", content: "Cadastro rápido de leads durante a visita comercial." },
      { property: "og:title", content: "Captar Lead — LeadField" },
      { property: "og:description", content: "Cadastro rápido de leads durante a visita comercial." },
    ],
  }),
  component: CaptarLead,
});

function CaptarLead() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const numberRef = useRef<HTMLInputElement>(null);

  const { data: segments = [] } = useSegments();
  const { data: streets = [] } = useStreets();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: products = [] } = useProducts();
  const { data: segmentProducts = [] } = useSegmentProducts();

  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [streetId, setStreetId] = useState<string | null>(null);
  const [streetName, setStreetName] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);
  const [neighborhoodName, setNeighborhoodName] = useState("");
  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [cityUf, setCityUf] = useState<{ city: string; state: string } | null>(null);
  const [nextContactDate, setNextContactDate] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [newStreetOpen, setNewStreetOpen] = useState(false);
  const [newStreetName, setNewStreetName] = useState("");
  const [newStreetNb, setNewStreetNb] = useState<string | null>(null);
  const [newStreetDup, setNewStreetDup] = useState<string | null>(null);


  const { data: fields = [] } = useSegmentFields(segmentId);

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

  function selectStreet(id: string | null) {
    setStreetId(id);
    const street = streets.find((s) => s.id === id);
    if (street) {
      setStreetName(street.name);
      if (street.neighborhood_id) setNeighborhoodId(street.neighborhood_id);
      setTimeout(() => numberRef.current?.focus(), 60);
    }
  }

  async function handleCep(value: string) {
    const masked = maskCep(value);
    setCep(masked);
    setCepMessage(null);
    if (!isCepComplete(masked)) return;
    setCepLoading(true);
    const result = await lookupCep(masked);
    setCepLoading(false);
    if (result.status === "unavailable") {
      setCepMessage("Busca automática indisponível no momento. Preencha o endereço manualmente.");
      return;
    }
    if (result.status === "not_found") {
      setCepMessage("CEP não localizado. Você pode preencher o endereço manualmente.");
      return;
    }
    const { street, neighborhood, city, state } = result.address;
    setCityUf({ city, state });
    // Bairro: reaproveita cadastro existente quando houver
    const nb = neighborhood
      ? neighborhoods.find((n) => normalizePlace(n.name) === normalizePlace(neighborhood))
      : undefined;
    setNeighborhoodName(neighborhood);
    setNeighborhoodId(nb?.id ?? null);
    // Rua: nunca cria automaticamente, apenas reutiliza cadastro existente
    const existing = street
      ? streets.find((s) => normalizePlace(s.name) === normalizePlace(street))
      : undefined;
    if (existing) {
      setStreetId(existing.id);
      setStreetName(existing.name);
      if (existing.neighborhood_id) setNeighborhoodId(existing.neighborhood_id);
    } else {
      setStreetId(null);
      setStreetName(street);
    }
    setCepMessage(
      existing
        ? "Endereço preenchido pelo CEP (rua já cadastrada)."
        : street
          ? "Endereço preenchido pelo CEP. Esta rua ainda não está cadastrada."
          : "CEP encontrado, mas sem logradouro. Informe a rua manualmente.",
    );
    setTimeout(() => numberRef.current?.focus(), 60);
  }

  async function createStreet() {
    if (!newStreetName.trim()) return;
    const { data, error } = await supabase
      .from("streets")
      .insert({ name: newStreetName.trim(), neighborhood_id: newStreetNb })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível cadastrar a rua.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["streets"] });
    setNewStreetOpen(false);
    setNewStreetName("");
    setNewStreetDup(null);
    setStreetId(data.id);
    setStreetName(data.name);
    if (data.neighborhood_id) setNeighborhoodId(data.neighborhood_id);
    setTimeout(() => numberRef.current?.focus(), 60);
  }

  function resetForm() {
    setCompany("");
    setContact("");
    setPhone("");
    setStreetId(null);
    setStreetName("");
    setNumber("");
    setNeighborhoodId(null);
    setNeighborhoodName("");
    setCep("");
    setCepMessage(null);
    setCityUf(null);
    setNextContactDate("");
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
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const nb = neighborhoods.find((n) => n.id === neighborhoodId);
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        company_name: company.trim(),
        contact_name: contact.trim() || null,
        phone: phone || null,
        segment_id: segmentId,
        street_id: streetId,
        street_name: streetName || null,
        number: number || null,
        neighborhood_id: neighborhoodId,
        neighborhood_name: nb?.name ?? null,
        city: nb?.city ?? null,
        state: nb?.state ?? null,
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
      <h1 className="text-2xl font-extrabold tracking-tight">Captar Lead</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Preencha o essencial. O restante pode ser completado depois.
      </p>

      <form className="mt-5 space-y-5" onSubmit={save}>
        <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h2 className="mb-4 text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Dados da empresa
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="company">Nome da empresa *</Label>
              <Input id="company" className="h-11" value={company} autoFocus
                onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Nome do contato</Label>
              <Input id="contact" className="h-11" value={contact}
                onChange={(e) => setContact(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" className="h-11" inputMode="tel" placeholder="(11) 99999-9999"
                value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Segmento</Label>
              <Combobox
                options={segments.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
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
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Rua</Label>
              <Combobox
                options={streets.map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: neighborhoods.find((n) => n.id === s.neighborhood_id)?.name,
                }))}
                value={streetId}
                onChange={selectStreet}
                placeholder="Pesquisar rua"
                searchPlaceholder="Digite o nome da rua"
                emptyText="Rua não cadastrada."
                onCreate={(search) => {
                  setNewStreetName(search);
                  setNewStreetNb(neighborhoodId);
                  setNewStreetOpen(true);
                }}
                createLabel="Cadastrar nova rua"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input id="number" ref={numberRef} className="h-11" inputMode="numeric"
                value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Bairro</Label>
              <Combobox
                options={neighborhoods.map((n) => ({
                  value: n.id,
                  label: n.name,
                  hint: n.city,
                }))}
                value={neighborhoodId}
                onChange={setNeighborhoodId}
                placeholder="Selecione o bairro"
              />
            </div>
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
          <Label htmlFor="notes" className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            Observações da visita
          </Label>
          <Textarea id="notes" rows={4} className="mt-3" value={notes}
            placeholder="Ex.: Proprietário interessado em sistema de estoque."
            onChange={(e) => setNotes(e.target.value)} />
        </section>

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar Lead
        </Button>
        <div className="h-14 md:hidden" />
      </form>

      <Dialog open={newStreetOpen} onOpenChange={setNewStreetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar nova rua</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newStreet">Nome da rua</Label>
              <Input id="newStreet" className="h-11" value={newStreetName}
                onChange={(e) => setNewStreetName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Combobox
                options={neighborhoods.map((n) => ({ value: n.id, label: n.name, hint: n.city }))}
                value={newStreetNb}
                onChange={setNewStreetNb}
                placeholder="Selecione o bairro"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createStreet}>Salvar rua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

