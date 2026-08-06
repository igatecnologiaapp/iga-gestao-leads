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
import { LEAD_STATUSES, formatDateTime, maskPhone } from "@/lib/leads";
import {
  useAllSegmentFields,
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
  const { isAdmin } = useAuth();
  const { data: segments = [] } = useSegments();
  const { data: products = [] } = useProducts();
  const { data: allFields = [] } = useAllSegmentFields();
  const [notes, setNotes] = useState("");

  const { data: lead } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
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
    return <p className="py-16 text-center text-sm text-muted-foreground">Carregando lead...</p>;
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
          <Info
            label="Endereço"
            value={`${lead.street_name ?? "-"}${lead.number ? ", " + lead.number : ""}`}
          />
          <Info label="Bairro" value={lead.neighborhood_name ?? "-"} />
          <Info label="Captado em" value={formatDateTime(lead.created_at)} />
          <Info label="Cidade / UF" value={[lead.city, lead.state].filter(Boolean).join(" / ") || "-"} />
        </dl>

        <div className="mt-5 grid gap-3 sm:grid-cols-[220px_auto]">
          <Select value={lead.status} onValueChange={(v) => updateLead({ status: v }, "Status atualizado.")}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lead.phone ? (
            <Button asChild variant="outline" className="h-11">
              <a href={`tel:${lead.phone.replace(/\D/g, "")}`}>
                <Phone className="h-4 w-4" /> Ligar
              </a>
            </Button>
          ) : null}
        </div>
      </div>

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
        <Button variant="outline" className="text-destructive" onClick={softDelete}>
          <Trash2 className="h-4 w-4" /> Excluir lead
        </Button>
      )}
      <div className="h-10 md:hidden" />
    </div>
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
