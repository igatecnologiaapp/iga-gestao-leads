import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useSegmentFields, useSegments, toOptions } from "@/lib/queries";
import { FIELD_TYPES } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/segmentos")({
  head: () => ({
    meta: [
      { title: "Segmentos — IGA TECNOLOGIA" },
      {
        name: "description",
        content: "Cadastre segmentos e configure os campos de qualificação exibidos na captação.",
      },
      { property: "og:title", content: "Segmentos — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Cadastre segmentos e configure os campos de qualificação exibidos na captação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [active, setActive] = useState(true);
  const [fieldsFor, setFieldsFor] = useState<{ id: string; name: string } | null>(null);

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setActive(true);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), description: description.trim() || null, active };
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
      <PageHeader
        title="Segmentos"
        description={`${segments.length} registro(s)`}
        actions={
          <Button className="h-10" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {segments.map((s) => (
          <div
            key={s.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {s.name}
                {!s.active && (
                  <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    Inativo
                  </span>
                )}
              </p>
              {s.description && (
                <p className="truncate text-xs text-muted-foreground">{s.description}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Campos de qualificação"
                onClick={() => setFieldsFor({ id: s.id, name: s.name })}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(s.id);
                  setName(s.name);
                  setDescription(s.description ?? "");
                  setActive(s.active);
                  setOpen(true);
                }}
              >
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
            <DialogTitle>{editing ? "Editar segmento" : "Novo segmento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição</Label>
              <Input
                id="desc"
                className="h-11"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="sactive">Ativo</Label>
              <Switch id="sactive" checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SegmentFieldsDialog segment={fieldsFor} onClose={() => setFieldsFor(null)} />
      <div className="h-10 md:hidden" />
    </div>
  );
}

function SegmentFieldsDialog({
  segment,
  onClose,
}: {
  segment: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: fields = [] } = useSegmentFields(segment?.id ?? null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const needsOptions = useMemo(() => type === "select" || type === "multiselect", [type]);

  function reset() {
    setEditingId(null);
    setLabel("");
    setType("text");
    setRequired(false);
    setOptionsText("");
  }

  async function saveField() {
    if (!segment) return;
    if (!label.trim()) {
      toast.error("Informe o nome do campo.");
      return;
    }
    const options = needsOptions
      ? optionsText
          .split("\n")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];
    const field_key = label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    const payload = {
      segment_id: segment.id,
      label: label.trim(),
      field_key,
      field_type: type,
      required,
      options: options as never,
      sort_order: editingId
        ? (fields.find((f) => f.id === editingId)?.sort_order ?? 0)
        : fields.length,
    };

    const { error } = editingId
      ? await supabase.from("segment_fields").update(payload).eq("id", editingId)
      : await supabase.from("segment_fields").insert(payload);

    if (error) {
      toast.error("Não foi possível salvar o campo.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["segment_fields"] });
    reset();
    toast.success("Campo salvo.");
  }

  async function removeField(id: string) {
    const { error } = await supabase.from("segment_fields").delete().eq("id", id);
    if (error) {
      toast.error("Campo já utilizado em leads não pode ser excluído.");
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["segment_fields"] });
  }

  return (
    <Dialog
      open={!!segment}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Campos de qualificação — {segment?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                  {toOptions(f.options).length ? ` · ${toOptions(f.options).join(", ")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingId(f.id);
                    setLabel(f.label);
                    setType(f.field_type);
                    setRequired(f.required);
                    setOptionsText(toOptions(f.options).join("\n"));
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeField(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {!fields.length && (
            <p className="text-sm text-muted-foreground">
              Nenhum campo configurado. Os campos criados aqui aparecem automaticamente na captação
              deste segmento.
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            {editingId ? "Editar campo" : "Novo campo"}
          </p>
          <div className="space-y-2">
            <Label htmlFor="flabel">Nome do campo</Label>
            <Input
              id="flabel"
              className="h-11"
              placeholder="Ex.: Quantidade de caixas"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions && (
            <div className="space-y-2">
              <Label htmlFor="fopts">Opções (uma por linha)</Label>
              <textarea
                id="fopts"
                rows={3}
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border bg-background p-3">
            <Label htmlFor="freq">Obrigatório</Label>
            <Switch id="freq" checked={required} onCheckedChange={setRequired} />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveField}>{editingId ? "Salvar campo" : "Adicionar campo"}</Button>
            {editingId && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
