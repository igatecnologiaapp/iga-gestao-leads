import { Facebook, Globe, Instagram } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidHandle, isValidWebsite } from "@/lib/leads";

export type ContactLinks = {
  website: string;
  instagram: string;
  facebook: string;
};

export const emptyContactLinks: ContactLinks = { website: "", instagram: "", facebook: "" };

/** Mensagens amigáveis de validação (vazio é sempre válido). */
export function contactLinksError(value: ContactLinks): string | null {
  if (!isValidWebsite(value.website))
    return "Informe um endereço de site válido, como www.empresa.com.br.";
  if (!isValidHandle(value.instagram))
    return "Informe o Instagram como @empresa ou instagram.com/empresa.";
  if (!isValidHandle(value.facebook))
    return "Informe o Facebook como facebook.com/empresa ou o nome da página.";
  return null;
}

/**
 * Campos de presença digital do lead (Site, Instagram e Facebook).
 * Reutilizado na Captação e na Edição para manter as mesmas regras.
 */
export function ContactLinksFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: ContactLinks;
  onChange: (patch: Partial<ContactLinks>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-site`} className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Site
        </Label>
        <Input
          id={`${idPrefix}-site`}
          className="h-11"
          inputMode="url"
          placeholder="https://www.empresa.com.br"
          value={value.website}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-instagram`} className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Instagram
        </Label>
        <Input
          id={`${idPrefix}-instagram`}
          className="h-11"
          placeholder="@empresa"
          value={value.instagram}
          onChange={(e) => onChange({ instagram: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-facebook`} className="flex items-center gap-2">
          <Facebook className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Facebook
        </Label>
        <Input
          id={`${idPrefix}-facebook`}
          className="h-11"
          placeholder="facebook.com/empresa"
          value={value.facebook}
          onChange={(e) => onChange({ facebook: e.target.value })}
        />
      </div>
    </div>
  );
}
