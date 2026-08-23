import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "captador"]),
  canViewAllLeads: z.boolean(),
  canDeleteDocuments: z.boolean(),
  phone: z.string().trim().max(30).optional().nullable(),
  jobRoleId: z.string().uuid().optional().nullable(),
  active: z.boolean().optional(),
  redirectTo: z.string().url().max(500),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "captador"]),
  active: z.boolean(),
  canViewAllLeads: z.boolean(),
  canDeleteDocuments: z.boolean(),
  phone: z.string().trim().max(30).optional().nullable(),
  jobRoleId: z.string().uuid().optional().nullable(),
});

/** Lista usuários (perfis + papéis). Apenas administradores. */
export const listSystemUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, phone, job_role_id, active, can_view_all_leads, can_delete_documents, created_at")
        .order("full_name"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);

    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    return (profiles ?? []).map((p) => ({
      ...p,
      role: (roleByUser.get(p.id) ?? "captador") as "admin" | "captador",
    }));
  });

/** Cria um usuário por convite por e-mail. Apenas administradores. */
export const createSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
      data: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Falha ao criar o usuário.");

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        email: data.email,
        can_view_all_leads: data.canViewAllLeads,
        can_delete_documents: data.canDeleteDocuments,
        phone: data.phone ?? null,
        job_role_id: data.jobRoleId ?? null,
        active: data.active ?? true,
      })
      .eq("id", newId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role });

    if (data.active === false) {
      await supabaseAdmin.auth.admin.updateUserById(newId, { ban_duration: "876000h" });
    }

    return { id: newId };
  });

/** Atualiza dados, perfil e permissões de um usuário. Apenas administradores. */
export const updateSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }
    if (data.userId === context.userId && !data.active) {
      throw new Error("Você não pode inativar o seu próprio usuário.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        active: data.active,
        can_view_all_leads: data.canViewAllLeads,
        can_delete_documents: data.canDeleteDocuments,
        phone: data.phone ?? null,
        job_role_id: data.jobRoleId ?? null,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });

    // Bloqueia/reativa o login no provedor de autenticação.
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.active ? "none" : "876000h",
    });

    return { ok: true };
  });

/** Reenvia o convite/definição de senha. Apenas administradores. */
export const resendUserInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().trim().email(), redirectTo: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
