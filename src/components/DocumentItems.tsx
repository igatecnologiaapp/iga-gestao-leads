import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Combobox } from "@/components/Combobox";
import { formatCurrency, toNumber } from "@/lib/commercial";
import { logDocumentEvent, type DocumentItem, type ItemCategory } from "@/lib/commercialQueries";

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  default_price: number | null;
  unit: string | null;
  category_id: string | null;
  active: boolean;
};

export function DocumentItems({
  documentId,
  items,
  categories,
  products,
  readOnly,
  onChanged,
}: {
  documentId: string;
  items: DocumentItem[];
  categories: ItemCategory[];
  products: ProductRow[];
  readOnly: boolean;
  onChanged: (event: string, description: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [productId, setProductId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [unit, setUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) return;
    setCategoryId(categories[0]?.id ?? "");
  }, [open, editing, categories]);

  function openNew() {
    setEditing(null);
    setCategoryId(categories[0]?.id ?? "");
    setProductId(null);
    setDescription("");
    setExtraNotes("");
    setUnit("");
    setUnitPrice("0");
    setQuantity("1");
    setDiscount("0");
    setOpen(true);
  }

  function openEdit(item: DocumentItem) {
    setEditing(item);
    setCategoryId(item.category_id ?? categories[0]?.id ?? "");
    setProductId(item.product_id);
    setDescription(item.description);
    setExtraNotes(item.extra_notes ?? "");
    setUnit(item.unit ?? "");
    setUnitPrice(String(item.unit_price));
    setQuantity(String(Number(item.quantity)));
    setDiscount(String(item.discount_value));
    setOpen(true);
  }

  function pickProduct(id: string | null) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setDescription(p.name);
    if (p.description) setExtraNotes(p.description);
    if (p.unit) setUnit(p.unit);
    if (p.default_price != null) setUnitPrice(String(p.default_price));
    if (p.category_id) setCategoryId(p.category_id);
  }

  async function save() {
    if (!description.trim()) {
      toast.error("Informe a descrição do item.");
      return;
    }
    setSaving(true);
    const payload = {
      document_id: documentId,
      category_id: categoryId || null,
      product_id: productId,
      description: description.trim(),
      extra_notes: extraNotes.trim() || null,
      unit: unit.trim() || null,
      unit_price: toNumber(unitPrice),
      quantity: toNumber(quantity),
      discount_value: toNumber(discount),
      sort_order: editing?.sort_order ?? items.length,
    };
    const { error } = editing
      ? await supabase.from("commercial_document_items").update(payload as never).eq("id", editing.id)
      : await supabase.from("commercial_document_items").insert(payload as never);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar o item.");
      return;
    }
    setOpen(false);
    await onChanged(
      editing ? "item_alterado" : "item_adicionado",
      `${editing ? "Item alterado" : "Item adicionado"}: ${payload.description} (${formatCurrency(
        payload.unit_price * payload.quantity - payload.discount_value,
      )})`,
    );
    toast.success("Item salvo.");
  }

  async function remove(item: DocumentItem) {
    const { error } = await supabase.from("commercial_document_items").delete().eq("id", item.id);
    if (error) {
      toast.error("Não foi possível remover o item.");
      return;
    }
    await onChanged("item_removido", `Item removido: ${item.description}`);
  }

  const grouped = categories
    .map((c) => ({ category: c, list: items.filter((i) => i.category_id === c.id) }))
    .concat([
      {
        category: { id: "none", name: "Outros itens", kind: "servico", active: true, sort_order: 99 },
        list: items.filter((i) => !i.category_id),
      },
    ])
    .filter((g) => g.list.length);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Itens</h2>
        {!readOnly && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        )}
      </div>

      {!items.length && <p className="text-sm text-muted-foreground">Nenhum item adicionado.</p>}

      {grouped.map((g) => (
        <div key={g.category.id} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{g.category.name}</p>
          {g.list.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border p-2.5"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                {item.extra_notes && (
                  <p className="whitespace-pre-line text-xs text-muted-foreground">{item.extra_notes}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(item.unit_price)} × {Number(item.quantity)}
                  {item.unit ? ` ${item.unit}` : ""}
                  {Number(item.discount_value) ? ` − ${formatCurrency(item.discount_value)}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">{formatCurrency(item.total)}</p>
                {!readOnly && (
                  <div className="mt-1 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void remove(item)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Adicionar item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto / serviço cadastrado (opcional)</Label>
              <Combobox
                options={products.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))}
                value={productId}
                onChange={(v) => pickProduct(v)}
                placeholder="Item manual (sem cadastro)"
                searchPlaceholder="Pesquisar produto/serviço"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-desc">Descrição</Label>
              <Input id="item-desc" className="h-11" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-notes">Observações do item</Label>
              <Textarea id="item-notes" rows={2} value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={unit || "none"} onValueChange={(v) => setUnit(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informada</SelectItem>
                    {unitOptions.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-qty">Quantidade</Label>
                <Input id="item-qty" className="h-11" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-price">Preço unitário</Label>
                <Input id="item-price" className="h-11" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-disc">Desconto (R$)</Label>
                <Input id="item-disc" className="h-11" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>
            <p className="rounded-lg bg-muted p-2 text-sm">
              Total do item:{" "}
              <strong>
                {formatCurrency(Math.max(toNumber(unitPrice) * toNumber(quantity) - toNumber(discount), 0))}
              </strong>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={saving}>Salvar item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
