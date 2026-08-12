import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/Combobox";
import { DynamicField } from "@/components/DynamicField";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadAppointments } from "@/components/LeadAppointments";
import { AppointmentFields, emptyAppointment, type AppointmentDraft } from "@/components/AppointmentFields";
import { formatAppointment, fromLocalParts, toLocalParts } from "@/lib/appointments";
import {
  LEAD_STATUSES,
  formatDateTime,
  isCepComplete,
  lookupCep,
  maskCep,
  maskPhone,
  normalizePlace,
} from "@/lib/leads";
import {
  useAllSegmentFields,
  useLeadAppointments,
  useNeighborhoods,
  useProducts,
  useSegmentProducts,
  useSegments,
  useStreets,
  toOptions,
} from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";


export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "Detalhes do Lead — LeadField" },
      { name: "description", content: "Informações, qualificação e histórico completo do lead." },
      { property: "og:title", content: "Detalhes do Lead — LeadField" },
      { property: "og:description", content: "Informações, qualificação e histórico completo do lead." },
    ],
  }),
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();
  const { data: allFields = [] } = useAllSegmentFields();
  const [notes, setNotes] = useState("");
  const [editOpen, setEditOpen] = useState(false);


  const {
    data: lead,
    isLoading: leadLoading,
    isError: leadError,
  } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });


  const { data: leadProducts = [] } = useQuery({
    queryKey: ["lead_products", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_products")
        .select("product_id")
        .eq("lead_id", id);
      if (error) throw error;
      return data as { product_id: string }[];
    },
  });

  const { data: customValues = [] } = useQuery({
    queryKey: ["lead_custom_values", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_custom_values")
        .select("field_id, value")
        .eq("lead_id", id);
      if (error) throw error;
      return data as { field_id: string; value: unknown }[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["lead_history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_history")
        .select("id, event_type, description, created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; event_type: string; description: string | null; created_at: string }[];
    },
  });

  useEffect(() => {
    if (lead) setNotes(lead.notes ?? "");
  }, [lead]);

  if (!lead) {
    if (leadLoading) {
      return <p className="py-16 text-center text-sm text-muted-foreground">Carregando lead...</p>;
    }
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold">Lead não encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {leadError
            ? "Você não tem permissão para visualizar este lead."
            : "Este lead não existe ou foi removido."}
        </p>
        <Button asChild variant="outline" className="mt-4 h-11">
          <Link to="/leads">Voltar para os leads</Link>
        </Button>
      </div>
    );
  }


  async function updateLead(patch: Record<string, unknown>, message: string) {
    const { error } = await supabase.from("leads").update(patch as never).eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    void queryClient.invalidateQueries({ queryKey: ["lead_history", id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  async function softDelete() {
    await updateLead({ deleted_at: new Date().toISOString() }, "Lead excluído.");
    navigate({ to: "/leads" });
  }

  const segmentName = segments.find((s) => s.id === lead.segment_id)?.name ?? "-";
  const selectedProducts = products.filter((p) => leadProducts.some((lp) => lp.product_id === p.id));

  function renderValue(value: unknown) {
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) return value.join(", ");
    return String(value ?? "-");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/leads">
          <ArrowLeft className="h-4 w-4" /> Voltar para Leads
        </Link>
      </Button>

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{lead.company_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{segmentName}</p>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Info label="Contato" value={lead.contact_name ?? "-"} />
          <Info label="Telefone" value={lead.phone ?? "-"} />
          <Info label="CEP" value={lead.postal_code ?? "-"} />
          <Info
            label="Endereço"
            value={`${lead.street_name ?? "-"}${lead.number ? ", " + lead.number : ""}`}
          />
          <Info label="Bairro" value={lead.neighborhood_name ?? "-"} />
          <Info label="Captado em" value={formatDateTime(lead.created_at)} />
          <Info label="Cidade / UF" value={[lead.city, lead.state].filter(Boolean).join(" / ") || "-"} />
        </dl>

        <div className="mt-5 grid gap-3 sm:grid-cols-[220px_auto_auto]">
          <Select value={lead.status} onValueChange={(v) => updateLead({ status: v }, "Status atualizado.")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar lead
          </Button>
          {lead.phone ? (
            <Button asChild variant="outline" className="h-11">
              <a href={`tel:${lead.phone.replace(/\D/g, "")}`}>
                <Phone className="h-4 w-4" /> Ligar
              </a>
            </Button>
          ) : null}
        </div>
      </div>


      <LeadAppointments
        leadId={lead.id}
        canEdit={isAdmin || lead.created_by === user?.id}
      />

      {selectedProducts.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Soluções de interesse</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedProducts.map((p) => (
              <span key={p.id} className="rounded-full border bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {customValues.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-bold">Qualificação</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {customValues.map((cv) => (
              <Info
                key={cv.field_id}
                label={allFields.find((f) => f.id === cv.field_id)?.label ?? "Campo"}
                value={renderValue(cv.value)}
              />
            ))}
          </dl>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Observações da visita</h2>
        <Textarea className="mt-3" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button className="mt-3" onClick={() => updateLead({ notes }, "Observações salvas.")}>
          Salvar observações
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Histórico</h2>
        <ul className="mt-3 space-y-3">
          {history.map((h) => (
            <li key={h.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3">
              <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{h.description}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
              </div>
            </li>
          ))}
          {!history.length && <li className="text-sm text-muted-foreground">Sem registros.</li>}
        </ul>
      </div>

      {isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir lead
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
              <AlertDialogDescription>
                O lead deixará de aparecer nas listagens e indicadores. O histórico é preservado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={softDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="h-10 md:hidden" />

      <EditLeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        productIds={leadProducts.map((lp) => lp.product_id)}
        customValues={customValues}
        onSaved={() => {
          setEditOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["lead", id] });
          void queryClient.invalidateQueries({ queryKey: ["lead_products"] });
          void queryClient.invalidateQueries({ queryKey: ["lead_custom_values", id] });
          void queryClient.invalidateQueries({ queryKey: ["lead_history", id] });
          void queryClient.invalidateQueries({ queryKey: ["leads"] });
          void queryClient.invalidateQueries({ queryKey: ["lead_appointments"] });
        }}
      />
    </div>
  );
}

type LeadRow = {
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
  next_contact_date: string | null;
  notes: string | null;
};

function EditLeadDialog({
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
  const { data: streets = [] } = useStreets();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const { data: products = [] } = useProducts();
  const { data: segmentProducts = [] } = useSegmentProducts();
  const { data: allFields = [] } = useAllSegmentFields();

  const [company, setCompany] = useState(lead.company_name);
  const [contact, setContact] = useState(lead.contact_name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [segmentId, setSegmentId] = useState<string | null>(lead.segment_id);
  const [streetId, setStreetId] = useState<string | null>(lead.street_id);
  const [streetName, setStreetName] = useState(lead.street_name ?? "");
  const [number, setNumber] = useState(lead.number ?? "");
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(lead.neighborhood_id);
  const [neighborhoodName, setNeighborhoodName] = useState("");
  const [cep, setCep] = useState(lead.postal_code ?? "");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [cityUf, setCityUf] = useState<{ city: string; state: string } | null>(null);
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
    setStreetId(lead.street_id);
    setStreetName(lead.street_name ?? "");
    setNumber(lead.number ?? "");
    setNeighborhoodId(lead.neighborhood_id);
    setNeighborhoodName("");
    setCep(lead.postal_code ?? "");
    setCepMessage(null);
    setCityUf(null);
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
    () => allFields.filter((f) => f.segment_id === segmentId).sort((a, b) => a.sort_order - b.sort_order),
    [allFields, segmentId],
  );

  const compatibleProducts = useMemo(() => {
    if (!segmentId) return [];
    const ids = new Set(
      segmentProducts.filter((sp) => sp.segment_id === segmentId).map((sp) => sp.product_id),
    );
    return products.filter((p) => ids.has(p.id) && p.active);
  }, [segmentId, segmentProducts, products]);

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
    const nb = neighborhood
      ? neighborhoods.find((n) => normalizePlace(n.name) === normalizePlace(neighborhood))
      : undefined;
    setNeighborhoodName(neighborhood);
    setNeighborhoodId(nb?.id ?? null);
    const existing = street
      ? streets.find((st) => normalizePlace(st.name) === normalizePlace(street))
      : undefined;
    if (existing) {
      setStreetId(existing.id);
      setStreetName(existing.name);
      if (existing.neighborhood_id) setNeighborhoodId(existing.neighborhood_id);
      setCepMessage("Endereço preenchido pelo CEP (rua já cadastrada).");
    } else {
      setStreetId(null);
      setStreetName(street);
      setCepMessage("Endereço preenchido pelo CEP. Esta rua ainda não está cadastrada.");
    }
  }

  async function save() {
    if (!company.trim()) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    for (const f of fields) {
      if (f.required && (custom[f.id] === undefined || custom[f.id] === "" || custom[f.id] === null)) {
        toast.error(`Preencha o campo "${f.label}".`);
        return;
      }
    }
    setSaving(true);
    const nb = neighborhoods.find((n) => n.id === neighborhoodId);
    const { error } = await supabase
      .from("leads")
      .update({
        company_name: company.trim(),
        contact_name: contact.trim() || null,
        phone: phone || null,
        segment_id: segmentId,
        street_id: streetId,
        street_name: streetName || null,
        number: number || null,
        neighborhood_id: neighborhoodId,
        neighborhood_name: nb?.name ?? (neighborhoodName || null),
        city: nb?.city || cityUf?.city || null,
        state: nb?.state || cityUf?.state || null,
        postal_code: cep || null,
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
          created_by: userData.user?.id ?? null,
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
            <Input id="editCompany" className="h-11" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editContact">Nome do contato</Label>
              <Input id="editContact" className="h-11" value={contact} onChange={(e) => setContact(e.target.value)} />
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
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Combobox
              options={segments.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
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
          <div className="space-y-2">
            <Label htmlFor="editCep">CEP</Label>
            <Input
              id="editCep"
              className="h-11"
              inputMode="numeric"
              placeholder="00000-000"
              value={cep}
              onChange={(e) => void handleCep(e.target.value)}
            />
            {cepLoading && <p className="text-xs text-muted-foreground">Consultando CEP...</p>}
            {cepMessage && <p className="text-xs text-muted-foreground">{cepMessage}</p>}
          </div>
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
                onChange={(v) => {
                  setStreetId(v);
                  const st = streets.find((s) => s.id === v);
                  if (st) {
                    setStreetName(st.name);
                    if (st.neighborhood_id) setNeighborhoodId(st.neighborhood_id);
                  }
                }}
                placeholder="Pesquisar rua"
                searchPlaceholder="Digite o nome da rua"
                emptyText="Rua não cadastrada."
              />
              {!streetId && streetName && (
                <Input
                  className="h-11"
                  aria-label="Nome da rua (não cadastrada)"
                  value={streetName}
                  onChange={(e) => setStreetName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNumber">Número</Label>
              <Input
                id="editNumber"
                className="h-11"
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Combobox
              options={neighborhoods.map((n) => ({ value: n.id, label: n.name, hint: n.city }))}
              value={neighborhoodId}
              onChange={(v) => {
                setNeighborhoodId(v);
                setNeighborhoodName(neighborhoods.find((n) => n.id === v)?.name ?? "");
              }}
              placeholder="Selecione o bairro"
            />
            {!neighborhoodId && neighborhoodName && (
              <p className="text-xs text-muted-foreground">
                Bairro informado pelo CEP: {neighborhoodName} (ainda não cadastrado)
              </p>
            )}
          </div>

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
            <Textarea id="editNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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

function Info({ label, value }: { label: string; value: string }) {

  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
