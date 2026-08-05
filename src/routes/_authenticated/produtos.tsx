import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts, useSegmentProducts, useSegments } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e Serviços — LeadField" },
      {
        name: "description",
        content: "Cadastre soluções e vincule os segmentos compatíveis para cada produto ou serviço.",
      },
      { property: "og:title", content: "Produtos e Serviços — LeadField" },
      {
        property: "og:description",
        content: "Cadastre soluções e vincule os segmentos compatíveis para cada produto ou serviço.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Produtos,
});

function Produtos() {
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: segments = [] } = useSegments();
  const { data: segmentProducts = [] } = useSegmentProducts();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [segIds, setSegIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const segmentsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sp of segmentProducts) {
      const list = map.get(sp.product_id) ?? [];
      list.push(segments.find((s) => s.id === sp.segment_id)?.name ?? "");
      map.set(sp.product_id, list);
    }
    return map;
  }, [segmentProducts, segments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (segmentsOf.get(p.id) ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }, [products, search, segmentsOf]);

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setActive(true);
    setSegIds([]);
    setOpen(true);
  }

  function openEdit(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setEditing(id);
    setName(p.name);
    setDescription(p.description ?? "");
    setActive(p.active);
    setSegIds(segmentProducts.filter((sp) => sp.product_id === id).map((sp) => sp.segment_id));
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Informe o nome do produto/serviço.");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, active };
    let productId = editing;
    if (editing) {
      const { error } = await supabase.from("products_services").update(payload).eq("id", editing);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível salvar.");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("products_services")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error("Não foi possível salvar.");
        return;
      }
      productId = data.id;
    }

    await supabase.from("segment_products").delete().eq("product_id", productId!);
    if (segIds.length) {
      await supabase
        .from("segment_products")
        .insert(segIds.map((segment_id) => ({ segment_id, product_id: productId! })));
    }

    await queryClient.invalidateQueries({ queryKey: ["products"] });
    await queryClient.invalidateQueries({ queryKey: ["segment_products"] });
    setSaving(false);
    setOpen(false);
    toast.success("Produto/serviço salvo.");
  }

  async function remove(id: string) {
    await supabase.from("segment_products").delete().eq("product_id", id);
    const { error } = await supabase.from("products_services").delete().eq("id", id);
    if (error) {
      toast.error("Produto vinculado a leads não pode ser excluído.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["segment_products"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">Produtos / Serviços</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} solução(ões)</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      <Input
        className="h-11"
        placeholder="Pesquisar por nome ou segmento"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {p.name}
                {!p.active && (
                  <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    Inativo
                  </span>
                )}
              </p>
              {p.description && (
                <p className="truncate text-xs text-muted-foreground">{p.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {(segmentsOf.get(p.id) ?? []).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {s}
                  </span>
                ))}
                {!(segmentsOf.get(p.id) ?? []).length && (
                  <span className="text-[11px] text-muted-foreground">Sem segmentos vinculados</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(p.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto/serviço" : "Novo produto/serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pname">Nome</Label>
              <Input id="pname" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdesc">Descrição</Label>
              <Textarea id="pdesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="pactive">Ativo</Label>
              <Switch id="pactive" checked={active} onCheckedChange={setActive} />
            </div>
            <div className="space-y-2">
              <Label>Segmentos compatíveis</Label>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
                {segments.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={segIds.includes(s.id)}
                      onCheckedChange={(v) =>
                        setSegIds((prev) => (v ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                      }
                    />
                    <span className="min-w-0 truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="h-10 md:hidden" />
    </div>
  );
}
