import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { useNeighborhoods, useStreets } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/ruas")({
  head: () => ({
    meta: [
      { title: "Ruas — LeadField" },
      { name: "description", content: "Pré-cadastro de ruas com bairro, CEP, cidade e estado." },
      { property: "og:title", content: "Ruas — LeadField" },
      { property: "og:description", content: "Pré-cadastro de ruas com bairro, CEP, cidade e estado." },
    ],
  }),
  component: Ruas,
});

function Ruas() {
  const queryClient = useQueryClient();
  const { data: streets = [] } = useStreets();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nbId, setNbId] = useState<string | null>(null);
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const list = streets.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const nbName = (id: string | null) => neighborhoods.find((n) => n.id === id)?.name ?? "Sem bairro";

  async function save() {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      neighborhood_id: nbId,
      zip_code: zip.trim() || null,
      city: city.trim(),
      state: state.trim().toUpperCase(),
    };
    const { error } = editing
      ? await supabase.from("streets").update(payload).eq("id", editing)
      : await supabase.from("streets").insert(payload);
    if (error) {
      toast.error("Não foi possível salvar a rua.");
      return;
    }
    toast.success("Rua salva.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["streets"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("streets").delete().eq("id", id);
    if (error) {
      toast.error("Rua em uso não pode ser excluída.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["streets"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">Ruas</h1>
        <Button onClick={() => {
          setEditing(null); setName(""); setNbId(null); setZip(""); setCity(""); setState(""); setOpen(true);
        }}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
      </div>

      <Input className="h-11" placeholder="Pesquisar rua" value={search}
        onChange={(e) => setSearch(e.target.value)} />

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((s) => (
          <div key={s.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {nbName(s.neighborhood_id)}
                {s.zip_code ? ` · ${s.zip_code}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => {
                setEditing(s.id); setName(s.name); setNbId(s.neighborhood_id);
                setZip(s.zip_code ?? ""); setCity(s.city); setState(s.state); setOpen(true);
              }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar rua" : "Nova rua"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rua">Nome da rua</Label>
              <Input id="rua" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Combobox
                options={neighborhoods.map((n) => ({ value: n.id, label: n.name, hint: n.city }))}
                value={nbId}
                onChange={setNbId}
                placeholder="Selecione o bairro"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" className="h-11" value={zip} onChange={(e) => setZip(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" className="h-11" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" className="h-11" maxLength={2} value={state}
                  onChange={(e) => setState(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
