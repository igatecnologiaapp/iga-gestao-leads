import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PageHeader";
import { SearchField } from "@/components/SearchField";
import { EmptyState, LoadingState } from "@/components/DataState";
import { useJobRoles, type JobRole } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/funcoes")({
  head: () => ({
    meta: [
      { title: "Funções e Cargos — IGA TECNOLOGIA" },
      {
        name: "description",
        content: "Cadastre as funções e cargos operacionais atribuídos aos usuários do sistema.",
      },
      { property: "og:title", content: "Funções e Cargos — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Cadastre as funções e cargos operacionais atribuídos aos usuários do sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FuncoesPage,
});

function FuncoesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data: roles = [], isLoading } = useJobRoles();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toRemove, setToRemove] = useState<JobRole | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.description ?? "").toLowerCase().includes(term),
    );
  }, [roles, search]);

  function openNew() {
    setEditing(null);
    setName("");
    setDescription("");
    setActive(true);
    setOpen(true);
  }

  function openEdit(role: JobRole) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setActive(role.active);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Informe o nome da função.");
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, active };
    const { error } = editing
      ? await supabase.from("job_roles").update(payload).eq("id", editing.id)
      : await supabase.from("job_roles").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Já existe uma função com esse nome."
          : "Não foi possível salvar a função.",
      );
      return;
    }
    toast.success("Função salva.");
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: ["job_roles"] });
  }

  async function remove(role: JobRole) {
    const { error } = await supabase.from("job_roles").delete().eq("id", role.id);
    if (error) {
      toast.error("Função vinculada a usuários: inative-a em vez de excluir.");
      return;
    }
    toast.success("Função excluída.");
    void queryClient.invalidateQueries({ queryKey: ["job_roles"] });
  }

  if (authLoading) return <LoadingState />;

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Somente administradores podem gerenciar as funções e cargos.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <PageHeader
        title="Funções / Cargos"
        description={`${roles.length} registro(s) — a função é organizacional e não altera permissões.`}
        actions={
          <Button className="h-10" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        }
      />

      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Pesquisar função..."
        label="Pesquisar funções"
      />

      {isLoading ? (
        <LoadingState label="Carregando funções..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma função encontrada"
          description="Cadastre funções como Colaborador, Vendedor ou Supervisor."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {r.name}
                  {!r.active && (
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                      Inativa
                    </span>
                  )}
                </p>
                {r.description && (
                  <p className="truncate text-xs text-muted-foreground">{r.description}</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10"
                  aria-label={`Editar ${r.name}`}
                  onClick={() => openEdit(r)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10"
                  aria-label={`Excluir ${r.name}`}
                  onClick={() => setToRemove(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar função" : "Nova função"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fn-nome">Nome da função</Label>
              <Input
                id="fn-nome"
                className="h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn-desc">Descrição (opcional)</Label>
              <Textarea
                id="fn-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="fn-ativa" className="text-sm">
                Função ativa
              </Label>
              <Switch id="fn-ativa" checked={active} onCheckedChange={setActive} />
            </div>
            <p className="text-xs text-muted-foreground">
              Funções inativas não ficam disponíveis para novos vínculos, mas o histórico dos
              usuários já vinculados é preservado.
            </p>
          </div>
          <DialogFooter>
            <Button className="h-11 w-full" onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir função?</AlertDialogTitle>
            <AlertDialogDescription>
              Funções vinculadas a usuários não podem ser excluídas — nesse caso, inative-a.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toRemove) void remove(toRemove);
                setToRemove(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
