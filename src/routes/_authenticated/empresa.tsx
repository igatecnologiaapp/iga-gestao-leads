import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompanySettings, type CompanySettings } from "@/lib/commercialQueries";
import { maskCep, maskPhone } from "@/lib/leads";
import { useAuth } from "@/hooks/useAuth";
import igaLogo from "@/assets/iga-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa Emissora — IGA TECNOLOGIA" },
      { name: "description", content: "Dados da empresa que emite orçamentos, propostas e pedidos." },
      { property: "og:title", content: "Empresa Emissora — IGA TECNOLOGIA" },
      { property: "og:description", content: "Dados da empresa que emite orçamentos, propostas e pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Empresa,
});

function Empresa() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: company } = useCompanySettings();
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);

  const current = form ?? company ?? null;
  if (!current) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm({ ...(current as CompanySettings), [key]: value });
  }

  async function save() {
    setSaving(true);
    const { id, ...rest } = current as CompanySettings;
    const { error } = await supabase.from("company_settings").update(rest as never).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar (apenas administradores).");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["company_settings"] });
    toast.success("Dados da empresa salvos.");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Empresa emissora</h1>
        <p className="text-sm text-muted-foreground">
          Usados no cabeçalho e rodapé dos documentos comerciais em PDF.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] sm:grid-cols-2">
        <Field label="Nome" value={current.name} onChange={(v) => set("name", v)} />
        <Field label="Razão social" value={current.legal_name ?? ""} onChange={(v) => set("legal_name", v)} />
        <Field label="CNPJ" value={current.cnpj ?? ""} onChange={(v) => set("cnpj", v)} />
        <Field label="E-mail" value={current.email ?? ""} onChange={(v) => set("email", v)} />
        <Field label="Telefone" value={current.phone ?? ""} onChange={(v) => set("phone", maskPhone(v))} />
        <Field label="CEP" value={current.postal_code ?? ""} onChange={(v) => set("postal_code", maskCep(v))} />
        <Field label="Endereço" value={current.address ?? ""} onChange={(v) => set("address", v)} />
        <Field label="Cidade" value={current.city ?? ""} onChange={(v) => set("city", v)} />
        <Field label="UF" value={current.state ?? ""} onChange={(v) => set("state", v)} />
        <div className="space-y-2 sm:col-span-2">
          <Field
            label="Logo (URL) — deixe vazio para usar o logotipo IGA padrão"
            value={current.logo_url ?? ""}
            onChange={(v) => set("logo_url", v)}
          />
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
            <img
              src={current.logo_url || igaLogo.url}
              alt="Pré-visualização do logotipo usado no cabeçalho dos PDFs"
              className="h-12 w-auto max-w-[160px] object-contain"
            />
            <p className="text-xs text-muted-foreground">
              Este logotipo aparece no cabeçalho dos orçamentos, propostas e pedidos em PDF, com a
              proporção original preservada.
            </p>
          </div>
        </div>
        <Field label="Rodapé" value={current.footer_note ?? ""} onChange={(v) => set("footer_note", v)} />
        <Field
          label="Validade padrão (dias)"
          value={String(current.default_validity_days)}
          onChange={(v) => set("default_validity_days", Number(v) || 0)}
        />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="terms">Condição de pagamento padrão</Label>
          <Textarea
            id="terms"
            rows={2}
            value={current.default_payment_terms ?? ""}
            onChange={(e) => set("default_payment_terms", e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tpl">Mensagem padrão de envio</Label>
          <Textarea id="tpl" rows={8} value={current.whatsapp_template}
            onChange={(e) => set("whatsapp_template", e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Variáveis disponíveis: [CONTATO], [TIPO], [NUMERO], [CLIENTE], [EMPRESA], [TELEFONE_EMPRESA], [VALOR].
          </p>
        </div>
      </div>

      <Button onClick={save} disabled={saving || !isAdmin} className="h-11 w-full sm:w-auto">
        Salvar
      </Button>
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">Somente administradores podem alterar estes dados.</p>
      )}
      <div className="h-10 md:hidden" />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-11" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
