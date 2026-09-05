import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Phone,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/Combobox";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, LoadingState } from "@/components/DataState";
import { VisitResultDialog } from "@/components/visits/VisitResultDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  leadAddress,
  useLeadsLite,
  useRouteStops,
  useRouteVisits,
  useVehicles,
  useVisitRoute,
  type RouteStop,
} from "@/lib/visitQueries";
import {
  mapsLink,
  setRouteStatus,
  startVisit,
  telLink,
  whatsappLink,
  type LeadVisit,
} from "@/lib/visitActions";
import {
  PRIORITIES,
  ROUTE_STATUSES,
  STOP_STATUSES,
  distanceKm,
  formatCurrency,
  fuelCost,
  routeStatusClass,
  routeStatusLabel,
  stopStatusLabel,
} from "@/lib/visits";

export const Route = createFileRoute("/_authenticated/visitas/$id")({
  head: () => ({
    meta: [
      { title: "Roteiro de visitas — IGA TECNOLOGIA" },
      {
        name: "description",
        content: "Planeje a ordem das visitas, tempos previstos e custo estimado do roteiro.",
      },
      { property: "og:title", content: "Roteiro de visitas — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Planeje a ordem das visitas, tempos previstos e custo estimado do roteiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoteiroPage,
});

function RoteiroPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: route, isLoading } = useVisitRoute(id);
  const { data: stops = [] } = useRouteStops(id);
  const { data: leads = [] } = useLeadsLite();
  const { data: vehicles = [] } = useVehicles();
  const { data: visits = [] } = useRouteVisits(id);

  const [addLead, setAddLead] = useState<string | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [resultStopId, setResultStopId] = useState<string | null>(null);

  const canEdit = !!route && (isAdmin || route.owner_id === user?.id || route.created_by === user?.id);
  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const vehicle = vehicles.find((v) => v.id === route?.vehicle_id) ?? null;

  /** Visita em andamento por parada (sem horário de término). */
  const openVisitByStop = useMemo(() => {
    const map = new Map<string, LeadVisit>();
    for (const v of visits) if (v.stop_id && !v.finished_at) map.set(v.stop_id, v);
    return map;
  }, [visits]);

  const doneStops = stops.filter((s) => s.status === "visitado").length;
  const failedStops = stops.filter(
    (s) => s.status === "nao_visitado" || s.status === "cancelado",
  ).length;
  const pendingStops = Math.max(0, stops.length - doneStops - failedStops);
  const progress = stops.length ? Math.round((doneStops / stops.length) * 100) : 0;

  const totalDistance = useMemo(() => {
    let total = 0;
    let prev =
      route?.start_latitude != null && route?.start_longitude != null
        ? { lat: route.start_latitude, lon: route.start_longitude }
        : null;
    for (const s of stops) {
      if (s.latitude != null && s.longitude != null) {
        if (prev) total += distanceKm(prev.lat, prev.lon, s.latitude, s.longitude);
        prev = { lat: s.latitude, lon: s.longitude };
      }
    }
    return Math.round(total * 100) / 100;
  }, [stops, route]);

  const cost = vehicle ? fuelCost(totalDistance, vehicle.avg_consumption, vehicle.fuel_price) : 0;
  const plannedMinutes = stops.reduce(
    (acc, s) => acc + (s.planned_visit_minutes ?? 0) + (s.planned_travel_minutes ?? 0),
    0,
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["visit_route_stops", id] });
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
    await queryClient.invalidateQueries({ queryKey: ["lead_visits"] });
  }

  /** Inicia a visita da parada (data/hora real e status em visita). */
  async function handleStartVisit(stop: RouteStop) {
    if (!user) return;
    const res = await startVisit({
      leadId: stop.lead_id,
      routeId: id,
      stopId: stop.id,
      userId: user.id,
      routeTitle: route?.title ?? null,
    });
    if (!res.ok) {
      toast.error(res.message ?? "Não foi possível iniciar a visita.");
      return;
    }
    if (route?.status === "planejado") await setRouteStatus(id, "em_andamento");
    toast.success("Visita iniciada.");
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["visit_routes", id] });
  }

  async function handleRouteStatus(status: "em_andamento" | "concluido" | "cancelado") {
    const res = await setRouteStatus(id, status);
    if (!res.ok) {
      toast.error(res.message ?? "Não foi possível atualizar o roteiro.");
      return;
    }
    toast.success("Roteiro atualizado.");
    await queryClient.invalidateQueries({ queryKey: ["visit_routes", id] });
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
  }

  async function patchRoute(patch: Record<string, unknown>) {
    setSavingHeader(true);
    const { error } = await supabase.from("visit_routes").update(patch as never).eq("id", id);
    setSavingHeader(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["visit_routes", id] });
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
    toast.success("Roteiro atualizado.");
  }

  async function patchStop(stop: RouteStop, patch: Record<string, unknown>) {
    const { error } = await supabase.from("visit_route_stops").update(patch as never).eq("id", stop.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  async function addStop() {
    if (!addLead) return;
    const lead = leadById.get(addLead);
    if (!lead) return;
    const order = Math.max(0, ...stops.map((s) => s.sort_order)) + 1;
    const { error } = await supabase.from("visit_route_stops").insert({
      route_id: id,
      lead_id: lead.id,
      sort_order: order,
      address: leadAddress(lead),
      latitude: lead.latitude,
      longitude: lead.longitude,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAddLead(null);
    await refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const a = stops[index];
    const b = stops[index + dir];
    if (!a || !b) return;
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("visit_route_stops").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("visit_route_stops").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (e1 || e2) {
      toast.error("Não foi possível reordenar.");
      return;
    }
    await refresh();
  }

  async function removeStop(stop: RouteStop) {
    const { error } = await supabase.from("visit_route_stops").delete().eq("id", stop.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
  }

  async function removeRoute() {
    const { error } = await supabase.from("visit_routes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
    void navigate({ to: "/visitas" });
  }

  if (isLoading) return <LoadingState />;
  if (!route)
    return (
      <EmptyState
        title="Roteiro não encontrado"
        description="O roteiro pode ter sido excluído ou você não tem acesso a ele."
        action={
          <Button asChild>
            <Link to="/visitas">Voltar</Link>
          </Button>
        }
      />
    );

  const availableLeads = leads.filter((l) => !stops.some((s) => s.lead_id === l.id));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Button variant="ghost" asChild className="h-9 px-2">
        <Link to="/visitas">
          <ArrowLeft className="h-4 w-4" /> Gestão de Visitas
        </Link>
      </Button>

      <PageHeader
        title={route.title ?? "Roteiro"}
        description={`${new Date(`${route.route_date}T12:00:00`).toLocaleDateString("pt-BR")}${route.departure_time ? ` · saída ${route.departure_time.slice(0, 5)}` : ""}`}
        actions={
          <Badge variant="outline" className={routeStatusClass(route.status)}>
            {routeStatusLabel(route.status)}
          </Badge>
        }
      />

      <section className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-4 sm:p-4">
        <Metric label="Paradas" value={String(stops.length)} />
        <Metric label="Distância estimada" value={`${totalDistance} km`} />
        <Metric label="Tempo previsto" value={`${plannedMinutes} min`} />
        <Metric
          label="Custo estimado"
          value={vehicle ? formatCurrency(cost) : "Sem veículo"}
        />
      </section>

      {canEdit ? (
        <section className="grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-2 sm:p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status do roteiro</Label>
            <Combobox
              id="status"
              options={ROUTE_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
              value={route.status}
              onChange={(v) => v && void patchRoute({ status: v })}
              placeholder="Selecione"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="veiculo">Veículo</Label>
            <Combobox
              id="veiculo"
              options={vehicles.filter((v) => v.active).map((v) => ({ value: v.id, label: v.description }))}
              value={route.vehicle_id}
              onChange={(v) => void patchRoute({ vehicle_id: v })}
              placeholder="Selecione"
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              rows={2}
              value={draftNotes ?? route.notes ?? ""}
              onChange={(e) => setDraftNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={savingHeader || draftNotes === null}
                onClick={() => void patchRoute({ notes: draftNotes })}
              >
                <Save className="h-4 w-4" /> Salvar observações
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={savingHeader}
                onClick={() =>
                  void patchRoute({ planned_distance_km: totalDistance, estimated_cost: cost })
                }
              >
                Registrar previsão (km/custo)
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide uppercase">Clientes do roteiro</h2>

        {canEdit ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Combobox
              className="flex-1"
              options={availableLeads.map((l) => ({
                value: l.id,
                label: l.company_name,
                hint: leadAddress(l),
              }))}
              value={addLead}
              onChange={setAddLead}
              placeholder="Selecionar Lead"
            />
            <Button className="h-11" onClick={addStop} disabled={!addLead}>
              <Plus className="h-4 w-4" /> Adicionar ao roteiro
            </Button>
          </div>
        ) : null}

        {stops.length === 0 ? (
          <EmptyState
            title="Nenhum cliente no roteiro"
            description="Selecione Leads existentes ou importe novos pela Pesquisa de Leads."
          />
        ) : (
          <ol className="space-y-3">
            {stops.map((stop, index) => {
              const lead = leadById.get(stop.lead_id);
              return (
                <li key={stop.id} className="rounded-2xl border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/leads/$id"
                        params={{ id: stop.lead_id }}
                        className="block truncate text-sm font-semibold hover:underline"
                      >
                        {lead?.company_name ?? "Lead"}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {stop.address ?? (lead ? leadAddress(lead) : "Endereço não disponível")}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-4">
                        <FieldMini label="Prioridade">
                          <Combobox
                            options={PRIORITIES.map((p) => ({ value: String(p.value), label: p.label }))}
                            value={String(stop.priority)}
                            onChange={(v) => v && void patchStop(stop, { priority: Number(v) })}
                            placeholder="Normal"
                          />
                        </FieldMini>
                        <FieldMini label="Horário previsto">
                          <Input
                            className="h-11"
                            type="time"
                            disabled={!canEdit}
                            value={stop.planned_time?.slice(0, 5) ?? ""}
                            onChange={(e) => void patchStop(stop, { planned_time: e.target.value || null })}
                          />
                        </FieldMini>
                        <FieldMini label="Visita (min)">
                          <Input
                            className="h-11"
                            type="number"
                            disabled={!canEdit}
                            value={stop.planned_visit_minutes}
                            onChange={(e) =>
                              void patchStop(stop, { planned_visit_minutes: Number(e.target.value) || 0 })
                            }
                          />
                        </FieldMini>
                        <FieldMini label="Status">
                          <Combobox
                            options={STOP_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
                            value={stop.status}
                            onChange={(v) => v && void patchStop(stop, { status: v })}
                            placeholder="Pendente"
                          />
                        </FieldMini>
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        <Button variant="ghost" size="icon" aria-label="Subir" disabled={index === 0} onClick={() => void move(index, -1)}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Descer"
                          disabled={index === stops.length - 1}
                          onClick={() => void move(index, 1)}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Remover do roteiro" onClick={() => void removeStop(stop)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {canEdit ? (
        <Button variant="ghost" className="text-destructive" onClick={removeRoute}>
          <Trash2 className="h-4 w-4" /> Excluir roteiro
        </Button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function FieldMini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
