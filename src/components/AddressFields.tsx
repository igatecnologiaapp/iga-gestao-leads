import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/Combobox";
import { useNeighborhoods, useStreets } from "@/lib/queries";
import { isCepComplete, lookupCep, maskCep, normalizePlace } from "@/lib/leads";

/** Endereço do lead — estado único compartilhado entre Captação e Edição. */
export type AddressValue = {
  cep: string;
  streetId: string | null;
  streetName: string;
  number: string;
  neighborhoodId: string | null;
  /** Bairro informado pelo CEP quando ainda não existe cadastro. */
  neighborhoodName: string;
  /** Cidade/UF vindas do CEP (usadas quando o bairro não está cadastrado). */
  city: string | null;
  state: string | null;
};

export const emptyAddress: AddressValue = {
  cep: "",
  streetId: null,
  streetName: "",
  number: "",
  neighborhoodId: null,
  neighborhoodName: "",
  city: null,
  state: null,
};

/** Monta o valor inicial a partir de um lead já salvo. */
export function addressFromLead(lead: {
  postal_code?: string | null;
  street_id?: string | null;
  street_name?: string | null;
  number?: string | null;
  neighborhood_id?: string | null;
}): AddressValue {
  return {
    ...emptyAddress,
    cep: lead.postal_code ?? "",
    streetId: lead.street_id ?? null,
    streetName: lead.street_name ?? "",
    number: lead.number ?? "",
    neighborhoodId: lead.neighborhood_id ?? null,
  };
}

export function AddressFields({
  value,
  onChange,
  idPrefix = "addr",
  allowCreateStreet = false,
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  idPrefix?: string;
  allowCreateStreet?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: streets = [] } = useStreets();
  const { data: neighborhoods = [] } = useNeighborhoods();
  const numberRef = useRef<HTMLInputElement>(null);

  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [newStreetOpen, setNewStreetOpen] = useState(false);
  const [newStreetName, setNewStreetName] = useState("");
  const [newStreetNb, setNewStreetNb] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function focusNumber() {
    setTimeout(() => numberRef.current?.focus(), 60);
  }

  function selectStreet(id: string | null) {
    const street = streets.find((s) => s.id === id);
    if (!street) {
      onChange({ streetId: id });
      return;
    }
    onChange({
      streetId: id,
      streetName: street.name,
      ...(street.neighborhood_id ? { neighborhoodId: street.neighborhood_id } : {}),
    });
    focusNumber();
  }

  async function handleCep(raw: string) {
    const masked = maskCep(raw);
    onChange({ cep: masked });
    setCepMessage(null);
    if (!isCepComplete(masked)) return;
    setCepLoading(true);
    const result = await lookupCep(masked);
    setCepLoading(false);
    if (result.status === "unavailable") {
      setCepMessage("Busca automática indisponível no momento. Preencha o endereço manualmente.");
      return;
    }
    if (result.status === "not_found") {
      setCepMessage("CEP não localizado. Você pode preencher o endereço manualmente.");
      return;
    }
    const { street, neighborhood, city, state } = result.address;
    const nb = neighborhood
      ? neighborhoods.find((n) => normalizePlace(n.name) === normalizePlace(neighborhood))
      : undefined;
    const existing = street
      ? streets.find((s) => normalizePlace(s.name) === normalizePlace(street))
      : undefined;

    onChange({
      city,
      state,
      neighborhoodName: neighborhood,
      neighborhoodId: existing?.neighborhood_id ?? nb?.id ?? null,
      streetId: existing?.id ?? null,
      streetName: existing?.name ?? street,
    });

    setCepMessage(
      existing
        ? "Endereço preenchido pelo CEP (rua já cadastrada)."
        : street
          ? "Endereço preenchido pelo CEP. Esta rua ainda não está cadastrada."
          : "CEP encontrado, mas sem logradouro. Informe a rua manualmente.",
    );
    focusNumber();
  }

  async function createStreet() {
    if (!newStreetName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("streets")
      .insert({ name: newStreetName.trim(), neighborhood_id: newStreetNb })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Não foi possível cadastrar a rua.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["streets"] });
    setNewStreetOpen(false);
    setNewStreetName("");
    onChange({
      streetId: data.id,
      streetName: data.name,
      ...(data.neighborhood_id ? { neighborhoodId: data.neighborhood_id } : {}),
    });
    toast.success("Rua cadastrada.");
    focusNumber();
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-cep`}>CEP</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-cep`}
              className="h-11"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              value={value.cep}
              onChange={(e) => void handleCep(e.target.value)}
            />
            {cepLoading && (
              <Loader2
                className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {cepLoading ? "Consultando CEP..." : cepMessage}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Rua</Label>
          <Combobox
            options={streets.map((s) => ({
              value: s.id,
              label: s.name,
              hint: neighborhoods.find((n) => n.id === s.neighborhood_id)?.name,
            }))}
            value={value.streetId}
            onChange={selectStreet}
            placeholder="Pesquisar rua"
            searchPlaceholder="Digite o nome da rua"
            emptyText="Rua não cadastrada."
            {...(allowCreateStreet
              ? {
                  onCreate: (search: string) => {
                    setNewStreetName(search || value.streetName);
                    setNewStreetNb(value.neighborhoodId);
                    setNewStreetOpen(true);
                  },
                  createLabel: "Cadastrar nova rua",
                }
              : {})}
          />
          {!value.streetId && value.streetName && (
            <Input
              className="h-11"
              aria-label="Nome da rua (não cadastrada)"
              value={value.streetName}
              onChange={(e) => onChange({ streetName: e.target.value })}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-number`}>Número</Label>
          <Input
            id={`${idPrefix}-number`}
            ref={numberRef}
            className="h-11"
            inputMode="numeric"
            value={value.number}
            onChange={(e) => onChange({ number: e.target.value })}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>Bairro</Label>
          <Combobox
            options={neighborhoods.map((n) => ({ value: n.id, label: n.name, hint: n.city }))}
            value={value.neighborhoodId}
            onChange={(v) =>
              onChange({
                neighborhoodId: v,
                neighborhoodName: neighborhoods.find((n) => n.id === v)?.name ?? "",
              })
            }
            placeholder="Selecione o bairro"
          />
          {!value.neighborhoodId && value.neighborhoodName && (
            <p className="text-xs text-muted-foreground">
              Bairro informado pelo CEP: {value.neighborhoodName} (ainda não cadastrado)
            </p>
          )}
        </div>
      </div>

      {allowCreateStreet && (
        <Dialog open={newStreetOpen} onOpenChange={setNewStreetOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar nova rua</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-new-street`}>Nome da rua</Label>
                <Input
                  id={`${idPrefix}-new-street`}
                  className="h-11"
                  value={newStreetName}
                  onChange={(e) => setNewStreetName(e.target.value)}
                />
                {(() => {
                  const dup = newStreetName.trim()
                    ? streets.find((s) => normalizePlace(s.name) === normalizePlace(newStreetName))
                    : undefined;
                  if (!dup) return null;
                  return (
                    <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs">
                      Já existe uma rua parecida cadastrada: <strong>{dup.name}</strong>.{" "}
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => {
                          setNewStreetOpen(false);
                          selectStreet(dup.id);
                        }}
                      >
                        Usar a rua existente
                      </button>
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Combobox
                  options={neighborhoods.map((n) => ({ value: n.id, label: n.name, hint: n.city }))}
                  value={newStreetNb}
                  onChange={setNewStreetNb}
                  placeholder="Selecione o bairro"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => void createStreet()}
                disabled={creating || !newStreetName.trim()}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cadastrar rua
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
