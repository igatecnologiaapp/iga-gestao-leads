import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/SearchField";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNeighborhoods } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/bairros")({
  head: () => ({
    meta: [
      { title: "Bairros — IGA TECNOLOGIA" },
      { name: "description", content: "Cadastro prévio de bairros com cidade e estado." },
      { property: "og:title", content: "Bairros — IGA TECNOLOGIA" },
      { property: "og:description", content: "Cadastro prévio de bairros com cidade e estado." },
    ],
  }),
  component: Bairros,
});

function Bairros() {
  const queryClient = useQueryClient();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const list = neighborhoods.filter((n) =>
    `${n.name} ${n.city} ${n.state}`.toLowerCase().includes(search.toLowerCase()),
  );

  async function save() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), city: city.trim(), state: state.trim().toUpperCase() };
    const { error } = editing
      ? await supabase.from("neighborhoods").update(payload).eq("id", editing)
      : await supabase.from("neighborhoods").insert(payload);
    if (error) {
      toast.error("Não foi possível salvar o bairro.");
      return;
    }
    toast.success("Bairro salvo.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["neighborhoods"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("neighborhoods").delete().eq("id", id);
    if (error) {
      toast.error("Bairro em uso não pode ser excluído.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["neighborhoods"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Bairros"
        description={`${list.length} registro(s)`}
        actions={
          <Button
            className="h-10"
            onClick={() => { setEditing(null); setName(""); setCity(""); setState(""); setOpen(true); }}
          >
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <SearchField value={search} onChange={setSearch} label="Pesquisar bairro" placeholder="Pesquisar bairro" />

      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((n) => (
          <div key={n.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="min-w-0">
              <p className="truncate font-semibold">{n.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[n.city, n.state].filter(Boolean).join(" / ") || "Sem cidade"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => {
                setEditing(n.id); setName(n.name); setCity(n.city); setState(n.state); setOpen(true);
              }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(n.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar bairro" : "Novo bairro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nb">Nome do bairro</Label>
              <Input id="nb" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_100px]">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" className="h-11" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">Estado</Label>
                <Input id="uf" className="h-11" maxLength={2} value={state}
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
