import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingState } from "@/components/DataState";
import { LeadAppointments } from "@/components/LeadAppointments";
import { LeadCommercialDocs } from "@/components/LeadCommercialDocs";
import { NewDocumentDialog } from "@/components/NewDocumentDialog";
import { EditLeadDialog } from "@/components/lead/EditLeadDialog";
import { LeadHeaderCard } from "@/components/lead/LeadHeaderCard";
import { LeadDataTab } from "@/components/lead/LeadDataTab";
import { LeadQualificationTab } from "@/components/lead/LeadQualificationTab";
import { formatDateTime } from "@/lib/leads";
import { useLeadAppointments, useProfiles, useSegments } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  head: () => ({
    meta: [
      { title: "Central do Lead — IGA TECNOLOGIA" },
      {
        name: "description",
        content: "Dados, qualificação, agenda, documentos comerciais e histórico do lead.",
      },
      { property: "og:title", content: "Central do Lead — IGA TECNOLOGIA" },
      {
        property: "og:description",
        content: "Dados, qualificação, agenda, documentos comerciais e histórico do lead.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const { data: segments = [] } = useSegments();
  const { data: profiles = [] } = useProfiles();
  const { data: appointments = [] } = useLeadAppointments(id);
  const [editOpen, setEditOpen] = useState(false);
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [appointmentSignal, setAppointmentSignal] = useState(0);
  const [tab, setTab] = useState("dados");

  const {
    data: lead,
    isLoading: leadLoading,
    isError: leadError,
  } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: leadProducts = [] } = useQuery({
    queryKey: ["lead_products", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_products")
        .select("product_id")
        .eq("lead_id", id);
      if (error) throw error;
      return data as { product_id: string }[];
    },
  });

  const { data: customValues = [] } = useQuery({
    queryKey: ["lead_custom_values", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_custom_values")
        .select("field_id, value")
        .eq("lead_id", id);
      if (error) throw error;
      return data as { field_id: string; value: unknown }[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["lead_history", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_history")
        .select("id, event_type, description, created_at")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as {
        id: string;
        event_type: string;
        description: string | null;
        created_at: string;
      }[];
    },
  });

  if (!lead) {
    if (leadLoading) return <LoadingState label="Carregando lead..." />;
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold">Lead não encontrado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {leadError
            ? "Você não tem permissão para visualizar este lead."
            : "Este lead não existe ou foi removido."}
        </p>
        <Button asChild variant="outline" className="mt-4 h-11">
          <Link to="/leads">Voltar para os leads</Link>
        </Button>
      </div>
    );
  }

  /** Mesmas regras já homologadas: RLS decide o que é permitido no banco. */
  const canEdit = isAdmin || lead.created_by === user?.id;

  async function updateLead(patch: Record<string, unknown>, message: string) {
    const { error } = await supabase
      .from("leads")
      .update(patch as never)
      .eq("id", id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    void queryClient.invalidateQueries({ queryKey: ["lead_history", id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
  }

  async function softDelete() {
    await updateLead({ deleted_at: new Date().toISOString() }, "Lead excluído.");
    navigate({ to: "/leads" });
  }

  const segmentName = segments.find((s) => s.id === lead.segment_id)?.name ?? "-";
  const ownerName =
    profiles.find((p) => p.id === lead.created_by)?.full_name ??
    (lead.created_by === user?.id ? "Você" : "-");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/leads">
          <ArrowLeft className="h-4 w-4" /> Voltar para Leads
        </Link>
      </Button>

      <LeadHeaderCard
        companyName={lead.company_name}
        segmentName={segmentName}
        status={lead.status}
        ownerName={ownerName}
        nextContactDate={lead.next_contact_date}
        appointments={appointments}
        phone={lead.phone}
        canEdit={canEdit}
        onEdit={() => setEditOpen(true)}
        onNewAppointment={() => {
          setTab("agenda");
          setAppointmentSignal((n) => n + 1);
        }}
        onNewDocument={() => setNewDocOpen(true)}
      />

      <Tabs value={tab} onValueChange={setTab}>
        {/* Mobile: duas linhas de abas (sem rolagem horizontal). Desktop: uma linha. */}
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 sm:grid-cols-5">
          <TabsTrigger value="dados" className="h-10">
            Dados
          </TabsTrigger>
          <TabsTrigger value="qualificacao" className="h-10">
            Qualificação
          </TabsTrigger>
          <TabsTrigger value="agenda" className="h-10">
            Agenda
          </TabsTrigger>
          <TabsTrigger value="comercial" className="h-10">
            Comercial
          </TabsTrigger>
          <TabsTrigger value="historico" className="h-10">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <LeadDataTab lead={lead} segmentName={segmentName} />
        </TabsContent>

        <TabsContent value="qualificacao" className="mt-4">
          <LeadQualificationTab
            status={lead.status}
            segmentName={segmentName}
            notes={lead.notes}
            productIds={leadProducts.map((lp) => lp.product_id)}
            customValues={customValues}
            canEdit={canEdit}
            onUpdate={updateLead}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <LeadAppointments leadId={lead.id} canEdit={canEdit} createSignal={appointmentSignal} />
        </TabsContent>

        <TabsContent value="comercial" className="mt-4">
          <LeadCommercialDocs leadId={lead.id} onNewDocument={() => setNewDocOpen(true)} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-bold">Histórico do relacionamento</h2>
            <ul className="mt-3 space-y-3">
              {history.map((h) => (
                <li key={h.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{h.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                  </div>
                </li>
              ))}
              {!history.length && (
                <li className="text-sm text-muted-foreground">Sem registros.</li>
              )}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="h-11 text-destructive">
              <Trash2 className="h-4 w-4" /> Excluir lead
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
              <AlertDialogDescription>
                O lead deixará de aparecer nas listagens e indicadores. O histórico é preservado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={softDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <div className="h-10 md:hidden" />

      <NewDocumentDialog
        open={newDocOpen}
        onOpenChange={setNewDocOpen}
        fixedLeadId={lead.id}
        onCreated={async (docId) => {
          await queryClient.invalidateQueries({ queryKey: ["commercial_documents"] });
          void navigate({ to: "/comercial/$id", params: { id: docId } });
        }}
      />

      <EditLeadDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        productIds={leadProducts.map((lp) => lp.product_id)}
        customValues={customValues}
        onSaved={() => {
          setEditOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["lead", id] });
          void queryClient.invalidateQueries({ queryKey: ["lead_products"] });
          void queryClient.invalidateQueries({ queryKey: ["lead_custom_values", id] });
          void queryClient.invalidateQueries({ queryKey: ["lead_history", id] });
          void queryClient.invalidateQueries({ queryKey: ["leads"] });
          void queryClient.invalidateQueries({ queryKey: ["lead_appointments"] });
        }}
      />
    </div>
  );
}
