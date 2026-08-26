import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { DOC_TYPES, type DocType } from "@/lib/commercial";
import { createCommercialDocument } from "@/lib/commercialActions";

/**
 * Criação de documento comercial. Quando chamado a partir da Central do Lead,
 * `fixedLeadId` aproveita automaticamente os dados do lead (snapshot feito
 * pelas regras já existentes em createCommercialDocument).
 */
export function NewDocumentDialog({
  open,
  onOpenChange,
  onCreated,
  fixedLeadId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void | Promise<void>;
  fixedLeadId?: string;
}) {
  const [docType, setDocType] = useState<DocType>("orcamento");
  const [leadId, setLeadId] = useState<string | null>(fixedLeadId ?? null);
  const [saving, setSaving] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "picker"],
    enabled: open && !fixedLeadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, neighborhood_name")
        .is("deleted_at", null)
        .order("company_name");
      if (error) throw error;
      return data as {
        id: string;
        company_name: string;
        contact_name: string | null;
        neighborhood_name: string | null;
      }[];
    },
  });

  async function create() {
    const targetLead = fixedLeadId ?? leadId;
    if (!targetLead) {
      toast.error("Selecione o lead.");
      return;
    }
    setSaving(true);
    try {
      const id = await createCommercialDocument({ leadId: targetLead, docType });
      toast.success("Documento criado.");
      onOpenChange(false);
      await onCreated(id);
    } catch {
      toast.error("Não foi possível criar o documento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo documento comercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!fixedLeadId && (
            <div className="space-y-2">
              <Label>Lead / cliente</Label>
              <Combobox
                options={leads.map((l) => ({
                  value: l.id,
                  label: l.company_name,
                  hint: l.contact_name ?? l.neighborhood_name ?? undefined,
                }))}
                value={leadId}
                onChange={(v) => setLeadId(v)}
                placeholder="Pesquisar lead"
                searchPlaceholder="Digite o nome da empresa"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button className="h-11 w-full sm:w-auto" onClick={create} disabled={saving}>
            Criar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
