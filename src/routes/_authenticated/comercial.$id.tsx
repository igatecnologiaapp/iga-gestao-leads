import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Copy,
  FileDown,
  Mail,
  MessageCircle,
  Share2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DocumentItems } from "@/components/DocumentItems";
import {
  DOC_TYPES,
  HISTORY_LABELS,
  docStatusClass,
  docStatusLabel,
  docTypeLabel,
  fillTemplate,
  formatCurrency,
  isDraft,
  isEditable,
  statusesFor,
  toNumber,
  type DocType,
} from "@/lib/commercial";
import { formatDateOnly, formatDateTime, maskCep, maskPhone } from "@/lib/leads";
import { documentPdfBlob } from "@/lib/commercialPdf";
import {
  logDocumentEvent,
  useCommercialDocument,
  useCompanySettings,
  useDocumentHistory,
  useDocumentItems,
  useItemCategories,
  usePaymentMethods,
} from "@/lib/commercialQueries";
import { createCommercialDocument, softDeleteDocument } from "@/lib/commercialActions";
import { useProfiles } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/comercial/$id")({
  head: () => ({
    meta: [
      { title: "Documento Comercial — LeadField" },
      { name: "description", content: "Detalhes, itens, totais, PDF e histórico do documento comercial." },
      { property: "og:title", content: "Documento Comercial — LeadField" },
      { property: "og:description", content: "Detalhes, itens, totais, PDF e histórico do documento comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentDetail,
});

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  default_price: number | null;
  unit: string | null;
  category_id: string | null;
  active: boolean;
};

function DocumentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, canDeleteDocuments } = useAuth();

  const { data: doc, isLoading, isError } = useCommercialDocument(id);
  const { data: items = [] } = useDocumentItems(id);
  const { data: categories = [] } = useItemCategories();
  const { data: history = [] } = useDocumentHistory(id);
  const { data: company } = useCompanySettings();
  const { data: methods = [] } = usePaymentMethods();
  const { data: profiles = [] } = useProfiles();

  const { data: products = [] } = useQuery({
    queryKey: ["products", "commercial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products_services")
        .select("id, name, description, default_price, unit, category_id, active")
        .order("name");
      if (error) throw error;
      return data as unknown as ProductRow[];
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareChannel, setShareChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [shareMessage, setShareMessage] = useState("");
  const [shareTarget, setShareTarget] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertType, setConvertType] = useState<DocType>("proposta");
  const [busy, setBusy] = useState(false);

  const paymentMethodName = useMemo(
    () => methods.find((m) => m.id === doc?.payment_method_id)?.name ?? null,
    [methods, doc],
  );

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["commercial_document", id] }),
      queryClient.invalidateQueries({ queryKey: ["commercial_document_items", id] }),
      queryClient.invalidateQueries({ queryKey: ["commercial_document_history", id] }),
      queryClient.invalidateQueries({ queryKey: ["commercial_documents"] }),
    ]);
  }

  /** Documento já emitido que sofre alteração gera nova versão, preservando o histórico da anterior. */
  async function registerChange(event: string, description: string) {
    if (!doc) return;
    await logDocumentEvent(id, event, description);
    if (!isDraft(doc.status)) {
      const nextVersion = doc.version + 1;
      await supabase.from("commercial_documents").update({ version: nextVersion } as never).eq("id", id);
      await logDocumentEvent(id, "nova_versao", `Versão ${nextVersion} gerada após alteração do documento`);
    }
    await refresh();
  }

  async function changeStatus(status: string) {
    if (!doc) return;
    const patch: Record<string, unknown> = { status };
    if (!doc.issued_at && status !== "rascunho") patch['issued_at'] = new Date().toISOString();
    const { error } = await supabase.from("commercial_documents").update(patch as never).eq("id", id);
    if (error) {
      toast.error("Não foi possível alterar o status.");
      return;
    }
    await logDocumentEvent(
      id,
      "status",
      `Status alterado de ${docStatusLabel(doc.status)} para ${docStatusLabel(status)}`,
    );
    await refresh();
    toast.success("Status atualizado.");
  }

  async function buildPdf() {
    if (!doc) return null;
    return await documentPdfBlob({
      company: company ?? null,
      doc,
      items,
      categories,
      paymentMethod: paymentMethodName,
    });
  }

  async function generatePdf() {
    const out = await buildPdf();
    if (!out) return;
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    await logDocumentEvent(id, "pdf_gerado", `PDF gerado: ${out.fileName}`);
    await refresh();
  }

  async function nativeShare() {
    const out = await buildPdf();
    if (!out || !doc) return;
    const file = new File([out.blob], out.fileName, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: out.fileName });
        await logDocumentEvent(id, "envio_preparado", `PDF compartilhado pelo dispositivo (${out.fileName})`);
        await refresh();
      } catch {
        /* usuário cancelou */
      }
    } else {
      toast.info("Compartilhamento nativo indisponível neste dispositivo. O PDF será baixado.");
      await generatePdf();
    }
  }

  function openShare(channel: "whatsapp" | "email") {
    if (!doc) return;
    setShareChannel(channel);
    const vars = {
      CONTATO: doc.client_contact ?? doc.client_company,
      TIPO: docTypeLabel(doc.doc_type),
      NUMERO: doc.number_label,
      CLIENTE: doc.client_company,
      EMPRESA: company?.name ?? "",
      TELEFONE_EMPRESA: company?.phone ?? "",
      VALOR: formatCurrency(doc.total_general),
    };
    setShareMessage(fillTemplate(company?.whatsapp_template ?? "", vars));
    setShareTarget(channel === "whatsapp" ? (doc.client_phone ?? "") : (doc.client_email ?? ""));
    setShareOpen(true);
  }

  async function confirmShare() {
    if (!doc) return;
    const out = await buildPdf();
    if (!out) return;
    // O PDF é sempre baixado/compartilhado como arquivo — o canal apenas prepara a mensagem.
    const url = URL.createObjectURL(out.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    if (shareChannel === "whatsapp") {
      const digits = shareTarget.replace(/\D/g, "");
      const phone = digits.length >= 12 ? digits : `55${digits}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(shareMessage)}`, "_blank");
    } else {
      const subject = `${docTypeLabel(doc.doc_type)} nº ${doc.number_label} — ${doc.client_company}`;
      window.location.href = `mailto:${shareTarget}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage)}`;
    }

    await logDocumentEvent(
      id,
      "envio_preparado",
      `Envio preparado por ${shareChannel === "whatsapp" ? "WhatsApp" : "e-mail"} para ${shareTarget || "destinatário não informado"} (PDF ${out.fileName}). Anexe o PDF baixado antes de enviar.`,
      { channel: shareChannel, target: shareTarget, file: out.fileName },
    );
    setShareOpen(false);
    await refresh();
  }

  async function markSent() {
    if (!doc) return;
    await logDocumentEvent(
      id,
      "enviado",
      `Envio confirmado manualmente pelo usuário (${shareChannel === "whatsapp" ? "WhatsApp" : "e-mail"})`,
    );
    if (doc.status === "rascunho" || doc.status === "emitido") await changeStatus("enviado");
    else await refresh();
    toast.success("Envio registrado no histórico.");
  }

  async function duplicate() {
    if (!doc) return;
    setBusy(true);
    try {
      const newId = await createCommercialDocument({
        leadId: doc.lead_id,
        docType: doc.doc_type,
        sourceDocumentId: doc.id,
        reason: "duplicacao",
      });
      await refresh();
      toast.success("Documento duplicado.");
      void navigate({ to: "/comercial/$id", params: { id: newId } });
    } catch {
      toast.error("Não foi possível duplicar.");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!doc) return;
    setBusy(true);
    try {
      const newId = await createCommercialDocument({
        leadId: doc.lead_id,
        docType: convertType,
        sourceDocumentId: doc.id,
        reason: "conversao",
      });
      await refresh();
      setConvertOpen(false);
      toast.success(`Convertido em ${docTypeLabel(convertType)}.`);
      void navigate({ to: "/comercial/$id", params: { id: newId } });
    } catch {
      toast.error("Não foi possível converter.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (deleteReason.trim().length < 3) {
      toast.error("Informe o motivo da exclusão.");
      return;
    }
    try {
      await softDeleteDocument(id, deleteReason.trim());
      await queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
      setDeleteOpen(false);
      toast.success("Documento excluído.");
      void navigate({ to: "/comercial" });
    } catch {
      toast.error("Sem permissão para excluir documentos comerciais.");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (isError || !doc)
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border bg-card p-6 text-center">
        <p className="font-semibold">Documento não encontrado ou sem acesso</p>
        <Button asChild variant="outline">
          <Link to="/comercial">Voltar</Link>
        </Button>
      </div>
    );

  const editable = isEditable(doc.status);
  const statuses = statusesFor(doc.doc_type);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/comercial"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">
            {docTypeLabel(doc.doc_type)} {doc.number_label}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Emissão {formatDateOnly(doc.issue_date)} · Versão {doc.version} ·{" "}
            {profiles.find((p) => p.id === doc.owner_id)?.full_name ?? "-"}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${docStatusClass(doc.status)}`}>
          {docStatusLabel(doc.status)}
        </span>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button variant="outline" className="h-11" onClick={() => void generatePdf()}>
          <FileDown className="h-4 w-4" /> PDF
        </Button>
        <Button variant="outline" className="h-11" onClick={() => openShare("whatsapp")}>
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </Button>
        <Button variant="outline" className="h-11" onClick={() => openShare("email")}>
          <Mail className="h-4 w-4" /> E-mail
        </Button>
        <Button variant="outline" className="h-11" onClick={() => void nativeShare()}>
          <Share2 className="h-4 w-4" /> Compartilhar
        </Button>
      </div>

      {/* Cabeçalho / emissora */}
      <section className="rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Empresa emissora</h2>
        <p className="mt-1 font-semibold">{company?.name ?? "Configure a empresa emissora"}</p>
        <p className="text-xs text-muted-foreground">
          {[company?.cnpj && `CNPJ ${company.cnpj}`, company?.phone, company?.email].filter(Boolean).join(" · ")}
        </p>
      </section>

      {/* Cliente */}
      <section className="rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Cliente</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/leads/$id" params={{ id: doc.lead_id }}>Ver lead</Link>
          </Button>
        </div>
        <p className="mt-1 font-semibold">{doc.client_company}</p>
        <p className="text-xs text-muted-foreground">
          {[doc.client_contact, doc.client_phone, doc.client_email].filter(Boolean).join(" · ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            [doc.client_street, doc.client_number].filter(Boolean).join(", "),
            doc.client_neighborhood,
            [doc.client_city, doc.client_state].filter(Boolean).join("-"),
            doc.client_postal_code ? `CEP ${doc.client_postal_code}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Os dados acima são um snapshot do lead no momento da criação e não são alterados por edições posteriores no cadastro.
        </p>
      </section>

      <DocumentItems
        documentId={id}
        items={items}
        categories={categories}
        products={products}
        readOnly={!editable}
        onChanged={registerChange}
      />

      {/* Totais */}
      <section className="space-y-1 rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Totais</h2>
        <div className="flex justify-between"><span>Serviços</span><span>{formatCurrency(doc.total_services)}</span></div>
        <div className="flex justify-between"><span>Peças</span><span>{formatCurrency(doc.total_parts)}</span></div>
        <div className="flex justify-between text-muted-foreground">
          <span>Descontos</span><span>- {formatCurrency(doc.total_discount)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span><span>{formatCurrency(doc.total_general)}</span>
        </div>
      </section>

      {/* Pagamento e observações */}
      <section className="space-y-1 rounded-xl border bg-card p-3 text-sm shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Pagamento</h2>
        <p>{paymentMethodName ?? "Forma de pagamento não informada"}</p>
        {doc.payment_terms && <p className="text-xs text-muted-foreground">Condição: {doc.payment_terms}</p>}
        {doc.payment_deadline && <p className="text-xs text-muted-foreground">Prazo: {doc.payment_deadline}</p>}
        {doc.payment_notes && <p className="text-xs text-muted-foreground">{doc.payment_notes}</p>}
        {doc.notes && (
          <>
            <h2 className="pt-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Observações</h2>
            <p className="whitespace-pre-line text-sm">{doc.notes}</p>
          </>
        )}
      </section>

      {/* Ações do documento */}
      <section className="grid gap-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={doc.status} onValueChange={(v) => void changeStatus(v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:items-end">
          <Button variant="outline" className="h-11" onClick={() => setEditOpen(true)} disabled={!editable}>
            Editar dados
          </Button>
          <Button variant="outline" className="h-11" onClick={() => void duplicate()} disabled={busy}>
            <Copy className="h-4 w-4" /> Duplicar
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setConvertType(doc.doc_type === "orcamento" ? "proposta" : "pedido");
              setConvertOpen(true);
            }}
          >
            <ArrowRightLeft className="h-4 w-4" /> Converter
          </Button>
          {canDeleteDocuments && (
            <Button variant="outline" className="h-11" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 text-destructive" /> Excluir
            </Button>
          )}
        </div>
      </section>

      {/* Histórico */}
      <section className="space-y-2 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Histórico</h2>
        {!history.length && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
        {history.map((h) => (
          <div key={h.id} className="border-l-2 border-primary/40 pl-3 text-sm">
            <p className="font-medium">{HISTORY_LABELS[h.event_type] ?? h.event_type}</p>
            {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
            <p className="text-[11px] text-muted-foreground">
              {formatDateTime(h.created_at)} ·{" "}
              {profiles.find((p) => p.id === h.created_by)?.full_name ?? "Usuário"}
            </p>
          </div>
        ))}
      </section>

      <EditDocumentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        documentId={id}
        doc={doc}
        methods={methods}
        onSaved={registerChange}
      />

      {/* Compartilhamento */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {shareChannel === "whatsapp" ? "Enviar pelo WhatsApp" : "Enviar por e-mail"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{shareChannel === "whatsapp" ? "Telefone" : "E-mail"}</Label>
              <Input
                className="h-11"
                value={shareTarget}
                onChange={(e) =>
                  setShareTarget(shareChannel === "whatsapp" ? maskPhone(e.target.value) : e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea rows={7} value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} />
            </div>
            <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
              O PDF será baixado no dispositivo e o app de destino será aberto com a mensagem pronta. O anexo
              precisa ser adicionado manualmente — não há API oficial de WhatsApp/e-mail configurada. A ação é
              registrada como <strong>Envio preparado</strong>.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => void markSent()}>Marcar como enviado</Button>
            <Button onClick={() => void confirmShare()}>Gerar PDF e abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conversão */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converter documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Novo tipo</Label>
            <Select value={convertType} onValueChange={(v) => setConvertType(v as DocType)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.filter((t) => t.value !== doc.doc_type).map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O documento atual é preservado. Um novo documento será criado com novo número, copiando itens,
              preços, descontos e condições comerciais.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => void convert()} disabled={busy}>Converter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusão lógica */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão é lógica: o documento sai das listagens, mas número, itens, valores, versões e
              histórico são preservados para auditoria. Informe o motivo da exclusão (obrigatório).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            className="h-11"
            placeholder="Motivo da exclusão"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteReason.trim().length < 3}
              onClick={() => void remove()}
            >
              Excluir documento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && (
        <p className="text-center text-[11px] text-muted-foreground">
          Dados da empresa emissora em <Link to="/empresa" className="underline">Configurações da empresa</Link>.
        </p>
      )}
      <div className="h-10 md:hidden" />
    </div>
  );
}

function EditDocumentDialog({
  open,
  onOpenChange,
  documentId,
  doc,
  methods,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  doc: {
    issue_date: string;
    valid_until: string | null;
    client_company: string;
    client_contact: string | null;
    client_phone: string | null;
    client_email: string | null;
    client_postal_code: string | null;
    client_street: string | null;
    client_number: string | null;
    client_neighborhood: string | null;
    client_city: string | null;
    client_state: string | null;
    payment_method_id: string | null;
    payment_terms: string | null;
    payment_deadline: string | null;
    payment_notes: string | null;
    notes: string | null;
    discount_type: string;
    discount_value: number;
  };
  methods: { id: string; name: string }[];
  onSaved: (event: string, description: string) => Promise<void> | void;
}) {
  const [form, setForm] = useState(doc);
  const [saving, setSaving] = useState(false);

  // Reinicia o formulário sempre que o diálogo abre.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setForm(doc);
  }
  if (!open && wasOpen) setWasOpen(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    const discountChanged =
      Number(form.discount_value) !== Number(doc.discount_value) || form.discount_type !== doc.discount_type;
    const { error } = await supabase
      .from("commercial_documents")
      .update({
        ...form,
        discount_value: toNumber(form.discount_value),
      } as never)
      .eq("id", documentId);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    onOpenChange(false);
    await onSaved(discountChanged ? "desconto" : "editado", discountChanged ? "Desconto do documento alterado" : "Dados do documento editados");
    toast.success("Documento atualizado.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="issue">Data de emissão</Label>
              <Input id="issue" type="date" className="h-11" value={form.issue_date}
                onChange={(e) => set("issue_date", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid">Validade</Label>
              <Input id="valid" type="date" className="h-11" value={form.valid_until ?? ""}
                onChange={(e) => set("valid_until", e.target.value || null)} />
            </div>
          </div>

          <p className="text-xs font-bold uppercase text-muted-foreground">Cliente (somente neste documento)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc">Empresa</Label>
              <Input id="cc" className="h-11" value={form.client_company} onChange={(e) => set("client_company", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ct">Contato</Label>
              <Input id="ct" className="h-11" value={form.client_contact ?? ""} onChange={(e) => set("client_contact", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Telefone</Label>
              <Input id="cp" className="h-11" value={form.client_phone ?? ""} onChange={(e) => set("client_phone", maskPhone(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ce">E-mail</Label>
              <Input id="ce" className="h-11" value={form.client_email ?? ""} onChange={(e) => set("client_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cz">CEP</Label>
              <Input id="cz" className="h-11" value={form.client_postal_code ?? ""} onChange={(e) => set("client_postal_code", maskCep(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs">Rua</Label>
              <Input id="cs" className="h-11" value={form.client_street ?? ""} onChange={(e) => set("client_street", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cn">Número</Label>
              <Input id="cn" className="h-11" value={form.client_number ?? ""} onChange={(e) => set("client_number", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb">Bairro</Label>
              <Input id="cb" className="h-11" value={form.client_neighborhood ?? ""} onChange={(e) => set("client_neighborhood", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci">Cidade</Label>
              <Input id="ci" className="h-11" value={form.client_city ?? ""} onChange={(e) => set("client_city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cu">UF</Label>
              <Input id="cu" className="h-11" value={form.client_state ?? ""} onChange={(e) => set("client_state", e.target.value)} />
            </div>
          </div>

          <p className="text-xs font-bold uppercase text-muted-foreground">Condições comerciais</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select
                value={form.payment_method_id ?? "none"}
                onValueChange={(v) => set("payment_method_id", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pt">Condição de pagamento</Label>
              <Input id="pt" className="h-11" value={form.payment_terms ?? ""} onChange={(e) => set("payment_terms", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pd">Prazo</Label>
              <Input id="pd" className="h-11" value={form.payment_deadline ?? ""} onChange={(e) => set("payment_deadline", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt">Tipo de desconto</Label>
              <Select value={form.discount_type} onValueChange={(v) => set("discount_type", v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor">Valor (R$)</SelectItem>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dv">Desconto geral</Label>
              <Input id="dv" className="h-11" inputMode="decimal" value={String(form.discount_value)}
                onChange={(e) => set("discount_value", e.target.value as unknown as number)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pn">Observações de pagamento</Label>
            <Textarea id="pn" rows={2} value={form.payment_notes ?? ""} onChange={(e) => set("payment_notes", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt">Observações gerais</Label>
            <Textarea id="nt" rows={3} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
