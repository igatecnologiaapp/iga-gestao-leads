import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, LocateFixed, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/Combobox";
import { EmptyState, LoadingState } from "@/components/DataState";
import { useAuth } from "@/hooks/useAuth";
import { useProfiles, useSegments } from "@/lib/queries";
import { useVehicles, useVisitRoutes } from "@/lib/visitQueries";
import { routeStatusClass, routeStatusLabel } from "@/lib/visits";

const OPEN_STATUS = ["planejado", "em_andamento"];

export function RoutesPanel({ mode }: { mode: "abertos" | "historico" }) {
  const { data: routes = [], isLoading } = useVisitRoutes();
  const [open, setOpen] = useState(false);

  const list = routes.filter((r) =>
    mode === "abertos" ? OPEN_STATUS.includes(r.status) : !OPEN_STATUS.includes(r.status),
  );

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-3">
      {mode === "abertos" ? (
        <Button className="h-11" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo roteiro
        </Button>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title={mode === "abertos" ? "Nenhum roteiro em aberto" : "Nenhum roteiro no histórico"}
          description={
            mode === "abertos"
              ? "Crie um roteiro para planejar as visitas do dia."
              : "Roteiros concluídos ou cancelados aparecem aqui."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <Link
              key={r.id}
              to="/visitas/$id"
              params={{ id: r.id }}
              className="rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold">{r.title ?? "Roteiro"}</p>
                <Badge variant="outline" className={routeStatusClass(r.status)}>
                  {routeStatusLabel(r.status)}
                </Badge>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {new Date(`${r.route_date}T12:00:00`).toLocaleDateString("pt-BR")}
                {r.departure_time ? ` · saída ${r.departure_time.slice(0, 5)}` : ""}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {[r.region, r.city].filter(Boolean).join(" · ") || "Região não informada"}
              </p>
            </Link>
          ))}
        </div>
      )}

      <NewRouteDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewRouteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useProfiles();
  const { data: segments = [] } = useSegments();
  const { data: vehicles = [] } = useVehicles();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [departure, setDeparture] = useState("08:00");
  const [available, setAvailable] = useState("240");
  const [startLabel, setStartLabel] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [endLabel, setEndLabel] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Localização indisponível neste dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStartLabel("Localização atual");
        toast.success("Localização atual capturada.");
      },
      () => toast.error("Não foi possível obter a localização."),
    );
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("visit_routes")
      .insert({
        title: title.trim() || null,
        route_date: date,
        owner_id: ownerId ?? user.id,
        departure_time: departure || null,
        available_minutes: Number(available) || null,
        start_label: startLabel.trim() || null,
        start_address: startAddress.trim() || null,
        start_latitude: coords?.lat ?? null,
        start_longitude: coords?.lon ?? null,
        end_label: endLabel.trim() || null,
        end_address: endAddress.trim() || null,
        vehicle_id: vehicleId,
        segment_id: segmentId,
        region: region.trim() || null,
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
    onOpenChange(false);
    void navigate({ to: "/visitas/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo roteiro</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="r-titulo">Título</Label>
            <Input id="r-titulo" className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Açougues — Parque Boturussu" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-data">Data</Label>
            <Input id="r-data" className="h-11" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-resp">Responsável</Label>
            <Combobox
              id="r-resp"
              options={(isAdmin ? profiles : profiles.filter((p) => p.id === user?.id)).map((p) => ({
                value: p.id,
                label: p.full_name,
              }))}
              value={ownerId ?? user?.id ?? null}
              onChange={setOwnerId}
              placeholder="Selecione"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-saida">Horário de saída</Label>
            <Input id="r-saida" className="h-11" type="time" value={departure} onChange={(e) => setDeparture(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-tempo">Tempo disponível (min)</Label>
            <Input id="r-tempo" className="h-11" type="number" value={available} onChange={(e) => setAvailable(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="r-partida">Ponto de partida</Label>
            <div className="flex gap-2">
              <Input id="r-partida" className="h-11" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} placeholder="Endereço de partida" />
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={useCurrentLocation}>
                <LocateFixed className="h-4 w-4" /> Atual
              </Button>
            </div>
            {coords ? (
              <p className="text-xs text-muted-foreground">
                Coordenadas: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="r-final">Ponto final (opcional)</Label>
            <Input id="r-final" className="h-11" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} placeholder="Endereço de retorno" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-veic">Veículo</Label>
            <Combobox
              id="r-veic"
              options={vehicles.filter((v) => v.active).map((v) => ({ value: v.id, label: v.description }))}
              value={vehicleId}
              onChange={setVehicleId}
              placeholder="Selecione"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-seg">Segmento</Label>
            <Combobox
              id="r-seg"
              options={segments.map((s) => ({ value: s.id, label: s.name }))}
              value={segmentId}
              onChange={setSegmentId}
              placeholder="Selecione"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-regiao">Bairro / região</Label>
            <Input id="r-regiao" className="h-11" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div className="grid gap-1.5 grid-cols-[1fr_80px] sm:grid-cols-[1fr_80px]">
            <div className="grid gap-1.5">
              <Label htmlFor="r-cidade">Cidade</Label>
              <Input id="r-cidade" className="h-11" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-uf">UF</Label>
              <Input id="r-uf" className="h-11" maxLength={2} value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="r-obs">Observações</Label>
            <Textarea id="r-obs" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="r-ponto">Identificação do ponto de partida</Label>
            <Input id="r-ponto" className="h-11" value={startLabel} onChange={(e) => setStartLabel(e.target.value)} placeholder="Ex.: Escritório / Localização atual" />
            <Input className="h-11" value={endLabel} onChange={(e) => setEndLabel(e.target.value)} placeholder="Identificação do ponto final" aria-label="Identificação do ponto final" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Criando..." : "Criar roteiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
