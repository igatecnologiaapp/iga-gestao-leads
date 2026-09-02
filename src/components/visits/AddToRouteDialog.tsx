import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/Combobox";
import { useVisitRoutes } from "@/lib/visitQueries";
import { routeStatusLabel } from "@/lib/visits";

/** Adiciona um ou mais Leads a um roteiro existente (ou cria um roteiro rápido). */
export function AddToRouteDialog({
  leadIds,
  open,
  onOpenChange,
}: {
  leadIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: routes = [] } = useVisitRoutes();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const openRoutes = routes.filter(
    (r) => r.status === "planejado" || r.status === "em_andamento",
  );

  async function addStops(targetRouteId: string) {
    const { data: leads, error: leadErr } = await supabase
      .from("leads")
      .select("id, street_name, number, neighborhood_name, city, state, latitude, longitude")
      .in("id", leadIds);
    if (leadErr) throw leadErr;

    const { data: existing } = await supabase
      .from("visit_route_stops")
      .select("lead_id, sort_order")
      .eq("route_id", targetRouteId);
    const already = new Set((existing ?? []).map((s) => s.lead_id));
    let order = Math.max(0, ...(existing ?? []).map((s) => s.sort_order ?? 0));

    const rows = (leads ?? [])
      .filter((l) => !already.has(l.id))
      .map((l) => ({
        route_id: targetRouteId,
        lead_id: l.id,
        sort_order: ++order,
        address: [
          [l.street_name, l.number].filter(Boolean).join(", "),
          l.neighborhood_name,
          [l.city, l.state].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" · "),
        latitude: l.latitude,
        longitude: l.longitude,
      }));

    if (rows.length === 0) {
      toast.info("Os Leads selecionados já estão neste roteiro.");
      return;
    }
    const { error } = await supabase.from("visit_route_stops").insert(rows);
    if (error) throw error;
    toast.success(`${rows.length} Lead(s) adicionado(s) ao roteiro.`);
  }

  async function confirm() {
    if (leadIds.length === 0) return;
    setSaving(true);
    try {
      let target = routeId;
      if (!target) {
        const { data, error } = await supabase
          .from("visit_routes")
          .insert({ route_date: newDate, title: "Roteiro rápido" })
          .select("id")
          .single();
        if (error) throw error;
        target = data.id;
      }
      await addStops(target);
      await queryClient.invalidateQueries({ queryKey: ["visit_routes"] });
      await queryClient.invalidateQueries({ queryKey: ["visit_route_stops"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível adicionar ao roteiro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar ao roteiro</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rota">Roteiro existente</Label>
            <Combobox
              id="rota"
              options={openRoutes.map((r) => ({
                value: r.id,
                label: `${new Date(`${r.route_date}T12:00:00`).toLocaleDateString("pt-BR")} — ${r.title ?? "Roteiro"}`,
                hint: routeStatusLabel(r.status),
              }))}
              value={routeId}
              onChange={setRouteId}
              placeholder="Criar novo roteiro"
            />
          </div>
          {!routeId ? (
            <div className="grid gap-1.5">
              <Label htmlFor="data-rota">Data do novo roteiro</Label>
              <Input
                id="data-rota"
                type="date"
                className="h-11"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {leadIds.length} Lead(s) selecionado(s).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={saving || leadIds.length === 0}>
            {saving ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
