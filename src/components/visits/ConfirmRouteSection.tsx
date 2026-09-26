import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/Combobox";
import { useAuth } from "@/hooks/useAuth";
import { useProfiles } from "@/lib/queries";
import { useVehicles } from "@/lib/visitQueries";
import { hasUsableCoords, type CandidateLead, type PlanningPoints } from "@/lib/routePlanning";

/**
 * Fase 3.6 — Confirmação humana e criação do Roteiro oficial.
 * Grava em visit_routes + visit_route_stops por uma única função no banco
 * (transação única, RLS do próprio usuário, chave de idempotência).
 * A ordem enviada é exatamente a ordem apresentada — nada é reotimizado.
 */
export function ConfirmRouteSection({
  orderedLeads,
  manual,
  outdated,
  points,
}: {
  orderedLeads: CandidateLead[];
  manual: boolean;
  outdated: boolean;
  points: PlanningPoints;
}) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: vehicles = [] } = useVehicles();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [departure, setDeparture] = useState("");
  const [available, setAvailable] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Uma chave por "confirmação lógica": muda somente quando o conteúdo muda.
  const contentKey = JSON.stringify([
    orderedLeads.map((l) => l.id),
    points,
    title, date, ownerId, vehicleId, departure, available, notes,
  ]);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (!inFlight.current) {
      setRequestKey(crypto.randomUUID());
      setCreated(null);
    }
  }, [contentKey]);

  const start = points.start;
  const end = points.sameAsStart ? points.start : points.end;
  const startCoords = hasUsableCoords(start.latitude, start.longitude);
  const endCoords = hasUsableCoords(end.latitude, end.longitude);
  const activeVehicles = vehicles.filter((v) => v.active);
  const ownerOptions = (isAdmin ? profiles : profiles.filter((p) => p.id === user?.id)).map((p) => ({
    value: p.id,
    label: p.full_name,
  }));
  const effectiveOwner = ownerId ?? user?.id ?? null;
  const ownerName = profiles.find((p) => p.id === effectiveOwner)?.full_name ?? "Você";
  const vehicleName = activeVehicles.find((v) => v.id === vehicleId)?.description ?? "Não informado";
  const searchCount = useMemo(
    () => new Set(orderedLeads.map((l) => l.search_id).filter(Boolean)).size,
    [orderedLeads],
  );

  const blocked = outdated || orderedLeads.length === 0 || !date || saving;

  function pointText(label: string, address: string, coords: boolean) {
    const txt = [label, address].filter((s) => s.trim()).join(" — ");
    if (!txt && !coords) return "Não informado";
    return `${txt || "Localização atual"}${coords ? " (com coordenadas)" : " (somente endereço)"}`;
  }

  async function confirm() {
    if (blocked || inFlight.current || !user || !effectiveOwner) return;
    inFlight.current = true;
    setSaving(true);
    const origin = [
      "Origem: Planejar roteiro (Roteirização)",
      `Sequência: ${manual ? "ajustada manualmente" : "sugestão automática"}`,
      `Paradas: ${orderedLeads.length}`,
      searchCount ? `Pesquisas arquivadas de origem: ${searchCount}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const { data, error } = await supabase.rpc("create_route_from_plan", {
      _request_key: requestKey,
      _title: title.trim() || `Roteiro planejado — ${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}`,
      _route_date: date,
      _owner_id: effectiveOwner,
      _vehicle_id: vehicleId as string,
      _departure_time: (departure || null) as string,
      _available_minutes: (Number(available) || null) as number,
      _start_label: start.label,
      _start_address: start.address,
      _start_latitude: (startCoords ? start.latitude : null) as number,
      _start_longitude: (startCoords ? start.longitude : null) as number,
      _end_label: end.label,
      _end_address: end.address,
      _end_latitude: (endCoords ? end.latitude : null) as number,
      _end_longitude: (endCoords ? end.longitude : null) as number,
      _notes: [notes.trim(), origin].filter(Boolean).join("\n"),
      _lead_ids: orderedLeads.map((l) => l.id),
    });
    inFlight.current = false;
    setSaving(false);
    if (error) {
      console.error("create_route_from_plan", error.code);
      toast.error(error.message || "Não foi possível criar o roteiro. Nada foi gravado.");
      return;
    }
    const row = (data as { route_id: string; already_existed: boolean }[] | null)?.[0];
    if (!row) {
      toast.error("Não foi possível confirmar a criação. Nada foi gravado.");
      return;
    }
    setCreated(row.route_id);
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
    toast.success(row.already_existed ? "Este roteiro já havia sido criado." : "Roteiro criado com sucesso.");
  }

  if (created) {
    return (
      <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3" role="status">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> Roteiro criado com sucesso.
        </p>
        <p className="text-xs text-muted-foreground">
          {orderedLeads.length} parada(s) na ordem confirmada. Nenhuma visita foi iniciada.
        </p>
        <Button asChild className="h-11 w-full sm:w-auto">
          <Link to="/visitas/$id" params={{ id: created }}>Ver roteiro</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <h3 className="text-sm font-semibold">9. Confirmar e criar roteiro</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="cf-titulo">Título (opcional)</Label>
          <Input id="cf-titulo" className="h-11" value={title} disabled={saving} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-data">Data do roteiro</Label>
          <Input id="cf-data" type="date" className="h-11" value={date} disabled={saving} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-resp">Responsável</Label>
          <Combobox id="cf-resp" options={ownerOptions} value={effectiveOwner} onChange={setOwnerId} placeholder="Selecione" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-veic">Veículo (opcional)</Label>
          <Combobox
            id="cf-veic"
            options={activeVehicles.map((v) => ({ value: v.id, label: v.description }))}
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Selecione"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-saida">Horário de saída (opcional)</Label>
          <Input id="cf-saida" type="time" className="h-11" value={departure} disabled={saving} onChange={(e) => setDeparture(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-tempo">Tempo disponível em minutos (opcional)</Label>
          <Input id="cf-tempo" type="number" min={0} className="h-11" value={available} disabled={saving} onChange={(e) => setAvailable(e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="cf-obs">Observações (opcional)</Label>
          <Textarea id="cf-obs" value={notes} disabled={saving} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <dl className="grid gap-1 rounded-xl bg-muted/50 p-3 text-xs [&_dd]:break-words [&_dd]:font-medium">
        <div><dt className="inline text-muted-foreground">Data: </dt><dd className="inline">{date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</dd></div>
        <div><dt className="inline text-muted-foreground">Responsável: </dt><dd className="inline">{ownerName}</dd></div>
        <div><dt className="inline text-muted-foreground">Veículo: </dt><dd className="inline">{vehicleName}</dd></div>
        <div><dt className="inline text-muted-foreground">Saída: </dt><dd className="inline">{pointText(start.label, start.address, startCoords)}</dd></div>
        <div><dt className="inline text-muted-foreground">Retorno: </dt><dd className="inline">{points.sameAsStart ? "Mesmo ponto de saída" : pointText(end.label, end.address, endCoords)}</dd></div>
        <div><dt className="inline text-muted-foreground">Paradas: </dt><dd className="inline">{orderedLeads.length}</dd></div>
        <div><dt className="inline text-muted-foreground">Primeira parada: </dt><dd className="inline">{orderedLeads[0]?.company_name ?? "—"}</dd></div>
        <div><dt className="inline text-muted-foreground">Última parada: </dt><dd className="inline">{orderedLeads[orderedLeads.length - 1]?.company_name ?? "—"}</dd></div>
        <div><dt className="inline text-muted-foreground">Sequência: </dt><dd className="inline">{manual ? "Ajustada manualmente" : "Sugestão automática"}</dd></div>
      </dl>

      {outdated ? (
        <p className="text-xs font-medium text-destructive">
          A sequência está desatualizada. Recalcule a sugestão antes de confirmar.
        </p>
      ) : null}

      <Button type="button" className="h-11 w-full sm:w-auto" disabled={blocked} onClick={() => void confirm()}>
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Criando roteiro...</> : "Confirmar e criar roteiro"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Serão criados o roteiro e as paradas nesta ordem exata, tudo de uma vez. Distância, tempo e custo não são
        gravados — a distância exibida aqui é geográfica aproximada. Nenhuma visita ou compromisso é criado.
      </p>
    </div>
  );
}
