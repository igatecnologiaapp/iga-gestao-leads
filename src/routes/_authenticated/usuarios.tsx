import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Plus, ShieldCheck, UserCog } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  createSystemUser,
  listSystemUsers,
  resendUserInvite,
  updateSystemUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — IGA TECNOLOGIA" },
      { name: "description", content: "Administração de usuários e permissões do sistema." },
      { property: "og:title", content: "Usuários — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Administração de usuários e permissões do sistema.",
      },
    ],
  }),
  component: UsuariosPage,
});

type Row = {
  id: string;
  full_name: string;
  email: string | null;
  active: boolean;
  can_view_all_leads: boolean;
  can_delete_documents: boolean;
  role: "admin" | "captador";
};

const emptyForm = {
  fullName: "",
  email: "",
  role: "captador" as "admin" | "captador",
  canViewAllLeads: false,
  canDeleteDocuments: false,
};

function UsuariosPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const list = useServerFn(listSystemUsers);
  const create = useServerFn(createSystemUser);
  const update = useServerFn(updateSystemUser);
  const resend = useServerFn(resendUserInvite);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Row | null>(null);

  const usersQuery = useQuery({
    queryKey: ["system-users"],
    queryFn: () => list() as Promise<Row[]>,
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: { ...form, redirectTo: `${window.location.origin}/reset-password` },
      }),
    onSuccess: () => {
      toast.success("Usuário criado. Um convite foi enviado por e-mail.");
      setCreateOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["system-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (row: Row) =>
      update({
        data: {
          userId: row.id,
          fullName: row.full_name,
          role: row.role,
          active: row.active,
          canViewAllLeads: row.can_view_all_leads,
          canDeleteDocuments: row.can_delete_documents,
        },
      }),
    onSuccess: () => {
      toast.success("Usuário atualizado.");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["system-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) =>
      resend({ data: { email, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: () => toast.success("Instruções de acesso reenviadas."),
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-bold">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Somente administradores podem acessar a administração de usuários.
        </p>
      </div>
    );
  }

  const users = usersQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Crie e administre os acessos ao sistema.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-11">
          <Plus className="mr-2 h-4 w-4" /> Novo usuário
        </Button>
      </div>

      {usersQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : usersQuery.isError ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-destructive">
          {(usersQuery.error as Error).message}
        </p>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{u.full_name || "(sem nome)"}</p>
                  <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                    {u.role === "admin" ? "Administrador" : "Captador"}
                  </Badge>
                  {!u.active && <Badge variant="destructive">Inativo</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {u.email && (
                  <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => resendMutation.mutate(u.email!)}
                    disabled={resendMutation.isPending}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Reenviar acesso
                  </Button>
                )}
                <Button variant="outline" className="h-10" onClick={() => setEditing({ ...u })}>
                  <UserCog className="mr-2 h-4 w-4" /> Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Criar usuário */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nu-nome">Nome</Label>
              <Input
                id="nu-nome"
                className="h-11"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-email">E-mail</Label>
              <Input
                id="nu-email"
                type="email"
                className="h-11"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as "admin" | "captador" })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="captador">Captador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <PermSwitches
              canViewAllLeads={form.canViewAllLeads}
              canDeleteDocuments={form.canDeleteDocuments}
              onChange={(p) => setForm({ ...form, ...p })}
            />
            <p className="text-xs text-muted-foreground">
              O usuário receberá um e-mail para definir a própria senha com segurança.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="h-11 w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.fullName || !form.email}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Criar usuário"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar usuário */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eu-nome">Nome</Label>
                <Input
                  id="eu-nome"
                  className="h-11"
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input className="h-11" value={editing.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as "admin" | "captador" })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="captador">Captador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="eu-active" className="text-sm">
                  Usuário ativo
                </Label>
                <Switch
                  id="eu-active"
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
              </div>
              <PermSwitches
                canViewAllLeads={editing.can_view_all_leads}
                canDeleteDocuments={editing.can_delete_documents}
                onChange={(p) =>
                  setEditing({
                    ...editing,
                    can_view_all_leads: p.canViewAllLeads ?? editing.can_view_all_leads,
                    can_delete_documents:
                      p.canDeleteDocuments ?? editing.can_delete_documents,
                  })
                }
              />
              <Button
                className="h-11 w-full"
                onClick={() => updateMutation.mutate(editing)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermSwitches({
  canViewAllLeads,
  canDeleteDocuments,
  onChange,
}: {
  canViewAllLeads: boolean;
  canDeleteDocuments: boolean;
  onChange: (p: { canViewAllLeads?: boolean; canDeleteDocuments?: boolean }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl border p-3">
        <Label className="text-sm">Ver todos os leads</Label>
        <Switch
          checked={canViewAllLeads}
          onCheckedChange={(v) => onChange({ canViewAllLeads: v })}
        />
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <Label className="text-sm">Excluir documentos comerciais</Label>
        <Switch
          checked={canDeleteDocuments}
          onCheckedChange={(v) => onChange({ canDeleteDocuments: v })}
        />
      </div>
    </div>
  );
}
