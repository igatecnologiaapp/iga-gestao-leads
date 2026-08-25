import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/AdminOnly";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Filter, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/SearchField";
import { PaginationBar } from "@/components/PaginationBar";
import { EmptyState, LoadingState } from "@/components/DataState";
import { usePagedList } from "@/hooks/usePagedList";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeasurementUnits, useProducts, useSegmentProducts, useSegments } from "@/lib/queries";
import { useItemCategories } from "@/lib/commercialQueries";
import { formatCurrency, toNumber } from "@/lib/commercial";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos e Serviços — IGA TECNOLOGIA" },
      {
        name: "description",
        content:
          "Cadastro comercial de produtos e serviços: tipo, categoria, unidade, preço padrão e segmentos compatíveis.",
      },
      { property: "og:title", content: "Produtos e Serviços — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content:
          "Cadastro comercial de produtos e serviços: tipo, categoria, unidade, preço padrão e segmentos compatíveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdutosPage,
});

const KINDS = [
  { value: "produto", label: "Produto" },
  { value: "servico", label: "Serviço" },
];

function kindLabel(kind: string) {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function ProdutosPage() {
  return (
    <AdminOnly message="Somente administradores podem gerenciar produtos e serviços.">
      <Produtos />
    </AdminOnly>
  );
}

function Produtos() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: products = [], isLoading } = useProducts();
  const { data: segments = [] } = useSegments();
  const { data: segmentProducts = [] } = useSegmentProducts();
  const { data: categories = [] } = useItemCategories();
  const { data: units = [] } = useMeasurementUnits();

  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("servico");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [unit, setUnit] = useState<string>("none");
  const [price, setPrice] = useState("");
  const [active, setActive] = useState(true);
  const [segIds, setSegIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [fKind, setFKind] = useState("todos");
  const [fCategory, setFCategory] = useState("todos");
  const [fSegment, setFSegment] = useState("todos");
  const [fStatus, setFStatus] = useState("ativos");
  const [more, setMore] = useState(false);

  const segmentsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sp of segmentProducts) {
      const list = map.get(sp.product_id) ?? [];
      const segName = segments.find((s) => s.id === sp.segment_id)?.name;
      if (segName) list.push(segName);
      map.set(sp.product_id, list);
    }
    return map;
  }, [segmentProducts, segments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (fKind !== "todos" && p.kind !== fKind) return false;
      if (fCategory !== "todos" && (p.category_id ?? "none") !== fCategory) return false;
      if (fStatus === "ativos" && !p.active) return false;
      if (fStatus === "inativos" && p.active) return false;
      if (
        fSegment !== "todos" &&
        !segmentProducts.some((sp) => sp.product_id === p.id && sp.segment_id === fSegment)
      )
        return false;
      if (
        q &&
        !`${p.name} ${p.description ?? ""} ${(segmentsOf.get(p.id) ?? []).join(" ")}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [products, search, fKind, fCategory, fSegment, fStatus, segmentProducts, segmentsOf]);

  const paged = usePagedList(filtered, 25);
  const incomplete = products.filter((p) => p.default_price == null || !p.unit).length;

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setKind("servico");
    setCategoryId("none");
    setUnit("none");
    setPrice("");
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
    setKind(p.kind ?? "servico");
    setCategoryId(p.category_id ?? "none");
    setUnit(p.unit ?? "none");
    setPrice(p.default_price == null ? "" : String(p.default_price));
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
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      kind,
      category_id: categoryId === "none" ? null : categoryId,
      unit: unit === "none" ? null : unit,
      default_price: price.trim() === "" ? null : toNumber(price),
      active,
    };
    let productId = editing;
    if (editing) {
      const { error } = await supabase
        .from("products_services")
        .update(payload as never)
        .eq("id", editing);
      if (error) {
        setSaving(false);
        toast.error("Não foi possível salvar (apenas administradores).");
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("products_services")
        .insert(payload as never)
        .select("id")
        .single();
      if (error || !data) {
        setSaving(false);
        toast.error("Não foi possível salvar (apenas administradores).");
        return;
      }
      productId = (data as { id: string }).id;
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

  /** Exclusão física só é permitida quando o item nunca foi utilizado; caso contrário, inativa. */
  async function remove(id: string) {
    const { error } = await supabase.from("products_services").delete().eq("id", id);
    if (error) {
      toast.error(
        "Produto/serviço já utilizado em leads ou documentos. Use Inativo para retirá-lo de novas seleções.",
      );
      return;
    }
    await supabase.from("segment_products").delete().eq("product_id", id);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["segment_products"] });
    toast.success("Produto/serviço excluído.");
  }

  async function toggleActive(id: string, value: boolean) {
    const { error } = await supabase
      .from("products_services")
      .update({ active: value } as never)
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível alterar o status (apenas administradores).");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Produtos / Serviços"
        description={`${filtered.length} de ${products.length} solução(ões)${
          incomplete ? ` · ${incomplete} sem preço ou unidade` : ""
        }`}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" className="h-10" onClick={() => setCatOpen(true)}>
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Categorias</span>
              </Button>
            )}
            <Button className="h-10" onClick={openNew} disabled={!isAdmin}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          </>
        }
      />

      {/* Filtros */}
      <div className="space-y-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <SearchField
            value={search}
            onChange={setSearch}
            label="Pesquisar produto ou serviço"
            placeholder="Pesquisar por nome, descrição ou segmento"
          />
          <Button variant="outline" className="h-11" onClick={() => setMore((v) => !v)}>
            <Filter className="h-4 w-4" /> Mais filtros
          </Button>
        </div>
        {more && (
          <div className="grid gap-2 sm:grid-cols-4">
            <FilterSelect
              label="Tipo"
              value={fKind}
              onChange={setFKind}
              options={[{ value: "todos", label: "Todos os tipos" }, ...KINDS]}
            />
            <FilterSelect
              label="Categoria"
              value={fCategory}
              onChange={setFCategory}
              options={[
                { value: "todos", label: "Todas as categorias" },
                { value: "none", label: "Sem categoria" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FilterSelect
              label="Segmento"
              value={fSegment}
              onChange={setFSegment}
              options={[
                { value: "todos", label: "Todos os segmentos" },
                ...segments.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <FilterSelect
              label="Status"
              value={fStatus}
              onChange={setFStatus}
              options={[
                { value: "ativos", label: "Somente ativos" },
                { value: "inativos", label: "Somente inativos" },
                { value: "todos", label: "Todos" },
              ]}
            />
          </div>
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)] md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Unidade</th>
              <th className="p-3 text-right">Preço padrão</th>
              <th className="p-3">Segmentos</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {paged.pageItems.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="p-3">
                  <p className="font-semibold">{p.name}</p>
                  {p.description && (
                    <p className="max-w-xs truncate text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                </td>
                <td className="p-3">{kindLabel(p.kind)}</td>
                <td className="p-3">
                  {categories.find((c) => c.id === p.category_id)?.name ?? "—"}
                </td>
                <td className="p-3">{p.unit ?? "—"}</td>
                <td className="p-3 text-right">
                  {p.default_price == null ? "—" : formatCurrency(p.default_price)}
                </td>
                <td className="p-3">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {Array.from(new Set(segmentsOf.get(p.id) ?? [])).map((s) => (
                      <span
                        key={`${p.id}-${s}`}
                        className="rounded-full border bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {s}
                      </span>
                    ))}
                    {!(segmentsOf.get(p.id) ?? []).length && (
                      <span className="text-[11px] text-muted-foreground">Sem segmentos</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <Switch
                    checked={p.active}
                    disabled={!isAdmin}
                    onCheckedChange={(v) => void toggleActive(p.id, v)}
                    aria-label="Ativo"
                  />
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(p.id)}
                    disabled={!isAdmin}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void remove(p.id)}
                    disabled={!isAdmin}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-sm text-muted-foreground">
                  {isLoading
                    ? "Carregando produtos e serviços..."
                    : "Nenhum produto/serviço encontrado com os filtros atuais."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="grid gap-2 md:hidden">
        {paged.pageItems.map((p) => (
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
              <p className="text-xs text-muted-foreground">
                {[
                  kindLabel(p.kind),
                  categories.find((c) => c.id === p.category_id)?.name,
                  p.unit,
                  p.default_price == null ? null : formatCurrency(p.default_price),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from(new Set(segmentsOf.get(p.id) ?? [])).map((s) => (
                  <span
                    key={`${p.id}-${s}`}
                    className="rounded-full border bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {s}
                  </span>
                ))}
                {!(segmentsOf.get(p.id) ?? []).length && (
                  <span className="text-[11px] text-muted-foreground">
                    Sem segmentos vinculados
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEdit(p.id)}
                disabled={!isAdmin}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void remove(p.id)}
                disabled={!isAdmin}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {isLoading && <LoadingState label="Carregando soluções..." />}
        {!isLoading && !filtered.length && (
          <div className="rounded-xl border bg-card">
            <EmptyState
              title="Nenhum produto/serviço encontrado"
              description="Ajuste a busca ou os filtros para ver outras soluções cadastradas."
            />
          </div>
        )}
      </div>

      <PaginationBar
        page={paged.page}
        pageCount={paged.pageCount}
        from={paged.from}
        to={paged.to}
        total={paged.total}
        onPrev={paged.prev}
        onNext={paged.next}
        label="solução(ões)"
      />


      {/* Cadastro / edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto/serviço" : "Novo produto/serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Identificação
              </p>
              <div className="space-y-2">
                <Label htmlFor="pname">Nome</Label>
                <Input
                  id="pname"
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdesc">Descrição</Label>
                <Textarea
                  id="pdesc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Classificação
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories
                        .filter((c) => c.active)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informada</SelectItem>
                      {units
                        .filter((u) => u.active)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.code}>
                            {u.code} — {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
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
                          setSegIds((prev) =>
                            v ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )
                        }
                      />
                      <span className="min-w-0 truncate">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Comercial
              </p>
              <div className="space-y-2">
                <Label htmlFor="pprice">Preço padrão (R$)</Label>
                <Input
                  id="pprice"
                  className="h-11"
                  inputMode="decimal"
                  placeholder="Ex.: 1500,00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sugerido automaticamente ao inserir o item em orçamentos, propostas e pedidos.
                  Alterar o preço dentro do documento não altera este cadastro.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <Label htmlFor="pactive">Ativo</Label>
                  <p className="text-xs text-muted-foreground">
                    Inativos não aparecem em novas seleções, mas permanecem nos documentos já
                    existentes.
                  </p>
                </div>
                <Switch id="pactive" checked={active} onCheckedChange={setActive} />
              </div>
            </section>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving || !isAdmin}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CategoriesDialog open={catOpen} onOpenChange={setCatOpen} />
      <div className="h-10 md:hidden" />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Cadastro administrativo de categorias usadas nos itens dos documentos comerciais. */
function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useItemCategories();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("servico");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("item_categories").insert({
      name: name.trim(),
      kind,
      sort_order: categories.length + 1,
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível criar a categoria.");
      return;
    }
    setName("");
    await queryClient.invalidateQueries({ queryKey: ["item_categories"] });
    toast.success("Categoria criada.");
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase
      .from("item_categories")
      .update({ active } as never)
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível alterar a categoria.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["item_categories"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorias de itens</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            As categorias agrupam os itens no documento e no PDF. O tipo define se o valor entra no
            total de serviços ou de peças.
          </p>
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.kind === "peca" ? "Peças" : "Serviços"}
                </p>
              </div>
              <Switch checked={c.active} onCheckedChange={(v) => void toggle(c.id, v)} />
            </div>
          ))}
          <div className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              className="h-11"
              placeholder="Nova categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-11 sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="servico">Serviços</SelectItem>
                <SelectItem value="peca">Peças</SelectItem>
              </SelectContent>
            </Select>
            <Button className="h-11" onClick={() => void add()} disabled={saving}>
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
