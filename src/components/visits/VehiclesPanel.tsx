import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Car, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/DataState";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles, type Vehicle } from "@/lib/visitQueries";
import { formatCurrency } from "@/lib/visits";

type Form = {
  description: string;
  plate: string;
  fuel_type: string;
  avg_consumption: string;
  fuel_price: string;
  active: boolean;
};

const EMPTY: Form = {
  description: "",
  plate: "",
  fuel_type: "gasolina",
  avg_consumption: "10",
  fuel_price: "6.00",
  active: true,
};

export function VehiclesPanel() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: vehicles = [], isLoading } = useVehicles();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  function startNew() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function startEdit(v: Vehicle) {
    setEditing(v);
    setForm({
      description: v.description,
      plate: v.plate ?? "",
      fuel_type: v.fuel_type,
      avg_consumption: String(v.avg_consumption),
      fuel_price: String(v.fuel_price),
      active: v.active,
    });
    setOpen(true);
  }

  async function save() {
    if (form.description.trim().length < 2) {
      toast.error("Informe a descrição do veículo.");
      return;
    }
    setSaving(true);
    const payload = {
      description: form.description.trim(),
      plate: form.plate.trim() || null,
      fuel_type: form.fuel_type,
      avg_consumption: Number(form.avg_consumption) || 0,
      fuel_price: Number(form.fuel_price) || 0,
      active: form.active,
    };
    const { error } = editing
      ? await supabase.from("vehicles").update(payload).eq("id", editing.id)
      : await supabase.from("vehicles").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Veículo atualizado." : "Veículo cadastrado.");
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-3">
      {isAdmin ? (
        <Button className="h-11" onClick={startNew}>
          <Plus className="h-4 w-4" /> Novo veículo
        </Button>
      ) : null}

      {vehicles.length === 0 ? (
        <EmptyState
          title="Nenhum veículo cadastrado"
          description="Cadastre os veículos para estimar custos de deslocamento."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) => (
            <article key={v.id} className="rounded-2xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    <Car className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {v.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.plate ?? "Sem placa"} · {v.fuel_type} · {v.avg_consumption} km/l ·{" "}
                    {formatCurrency(v.fuel_price)}/l
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline">{v.active ? "Ativo" : "Inativo"}</Badge>
                  {isAdmin ? (
                    <Button variant="ghost" size="icon" aria-label="Editar veículo" onClick={() => startEdit(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="v-desc">Descrição</Label>
              <Input id="v-desc" className="h-11" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="v-placa">Placa (opcional)</Label>
                <Input id="v-placa" className="h-11" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-comb">Combustível</Label>
                <Input id="v-comb" className="h-11" value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-cons">Consumo (km/l)</Label>
                <Input id="v-cons" className="h-11" type="number" step="0.1" value={form.avg_consumption} onChange={(e) => setForm({ ...form, avg_consumption: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="v-preco">Preço do litro</Label>
                <Input id="v-preco" className="h-11" type="number" step="0.01" value={form.fuel_price} onChange={(e) => setForm({ ...form, fuel_price: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
