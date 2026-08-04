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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSegments } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/segmentos")({
  head: () => ({
    meta: [
      { title: "Segmentos — LeadField" },
      { name: "description", content: "Cadastre e gerencie os segmentos de empresas prospectadas." },
      { property: "og:title", content: "Segmentos — LeadField" },
      { property: "og:description", content: "Cadastre e gerencie os segmentos de empresas prospectadas." },
    ],
  }),
  component: Segmentos,
});

function Segmentos() {
  const queryClient = useQueryClient();
  const { data: segments = [] } = useSegments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: description.trim() || null };
    const { error } = editing
      ? await supabase.from("segments").update(payload).eq("id", editing)
      : await supabase.from("segments").insert(payload);
    if (error) {
      toast.error("Não foi possível salvar o segmento.");
      return;
    }
    toast.success("Segmento salvo.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["segments"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("segments").delete().eq("id", id);
    if (error) {
      toast.error("Segmento em uso não pode ser excluído.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["segments"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">Segmentos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar segmento" : "Novo segmento"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Descrição</Label>
                <Input id="desc" className="h-11" value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {segments.map((s) => (
          <div key={s.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
            <div className="min-w-0">
              <p className="truncate font-semibold">{s.name}</p>
              {s.description && <p className="truncate text-xs text-muted-foreground">{s.description}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => {
                setEditing(s.id);
                setName(s.name);
                setDescription(s.description ?? "");
                setOpen(true);
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
    </div>
  );
}
