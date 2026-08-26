import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadInfo } from "@/components/lead/LeadInfo";
import { LEAD_STATUSES } from "@/lib/leads";
import { useAllSegmentFields, useProducts } from "@/lib/queries";

function renderValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "-");
}

/**
 * Área QUALIFICAÇÃO: status, segmento, campos dinâmicos do segmento,
 * soluções de interesse e observações da visita.
 * Reutiliza as regras existentes de atualização do lead (updateLead).
 */
export function LeadQualificationTab({
  status,
  segmentName,
  notes,
  productIds,
  customValues,
  canEdit,
  onUpdate,
}: {
  status: string;
  segmentName: string;
  notes: string | null;
  productIds: string[];
  customValues: { field_id: string; value: unknown }[];
  canEdit: boolean;
  onUpdate: (patch: Record<string, unknown>, message: string) => Promise<void>;
}) {
  const { data: products = [] } = useProducts();
  const { data: allFields = [] } = useAllSegmentFields();
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  useEffect(() => {
    setDraftNotes(notes ?? "");
  }, [notes]);

  const selectedProducts = products.filter((p) => productIds.includes(p.id));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Situação e segmento</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="leadStatusSelect"
              className="block text-xs text-muted-foreground"
            >
              Status
            </label>
            <Select
              value={status}
              disabled={!canEdit}
              onValueChange={(v) => void onUpdate({ status: v }, "Status atualizado.")}
            >
              <SelectTrigger id="leadStatusSelect" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <dl className="self-end">
            <LeadInfo label="Segmento" value={segmentName} />
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Soluções de interesse</h2>
        {selectedProducts.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedProducts.map((p) => (
              <span
                key={p.id}
                className="rounded-full border bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
              >
                {p.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma solução vinculada a este lead.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Campos de qualificação</h2>
        {customValues.length ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {customValues.map((cv) => (
              <LeadInfo
                key={cv.field_id}
                label={allFields.find((f) => f.id === cv.field_id)?.label ?? "Campo"}
                value={renderValue(cv.value)}
              />
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum campo de qualificação preenchido para o segmento.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold">Observações da visita</h2>
        <Textarea
          id="leadNotes"
          aria-label="Observações da visita"
          className="mt-3"
          rows={4}
          readOnly={!canEdit}
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
        />
        {canEdit && (
          <Button
            className="mt-3 h-11 w-full sm:w-auto"
            onClick={() => void onUpdate({ notes: draftNotes }, "Observações salvas.")}
          >
            Salvar observações
          </Button>
        )}
      </section>
    </div>
  );
}
