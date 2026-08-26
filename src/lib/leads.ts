export type LeadStatus =
  | "novo"
  | "em_contato"
  | "contatado"
  | "interessado"
  | "proposta_enviada"
  | "negociacao"
  | "convertido"
  | "perdido";

export const LEAD_STATUSES: { value: LeadStatus; label: string; className: string }[] = [
  { value: "novo", label: "Novo", className: "bg-info/15 text-info border-info/30" },
  { value: "em_contato", label: "Em contato", className: "bg-primary/15 text-primary border-primary/30" },
  { value: "contatado", label: "Contatado", className: "bg-accent text-accent-foreground border-border" },
  { value: "interessado", label: "Interessado", className: "bg-warning/20 text-warning-foreground border-warning/40" },
  { value: "proposta_enviada", label: "Proposta enviada", className: "bg-chart-5/15 text-chart-5 border-chart-5/30" },
  { value: "negociacao", label: "Negociação", className: "bg-primary-glow/20 text-primary border-primary/30" },
  { value: "convertido", label: "Convertido", className: "bg-success/15 text-success border-success/30" },
  { value: "perdido", label: "Perdido", className: "bg-destructive/15 text-destructive border-destructive/30" },
];

export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function statusClass(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.className ?? "bg-muted text-muted-foreground";
}

/** Máscara de telefone brasileiro: (11) 99999-9999 ou (11) 3333-4444 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara de CEP: 00000-000 */
export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isCepComplete(value: string): boolean {
  return value.replace(/\D/g, "").length === 8;
}

export type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CepLookup =
  | { status: "ok"; address: CepAddress }
  | { status: "not_found" }
  | { status: "unavailable" };

/** Consulta de CEP via ViaCEP (serviço público, sem chave de API). */
export async function lookupCep(cep: string): Promise<CepLookup> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return { status: "not_found" };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return { status: "unavailable" };
    const data = (await res.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro) return { status: "not_found" };
    return {
      status: "ok",
      address: {
        street: data.logradouro ?? "",
        neighborhood: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** Normaliza nomes de rua/bairro para comparação (sem acento, sem prefixo, minúsculo). */
export function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.:,]/g, " ")
    .replace(/\b(rua|r|avenida|av|travessa|tv|alameda|al|praca|estrada|est|rodovia|rod)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Data "yyyy-mm-dd" -> "dd/mm/aaaa" sem deslocamento de fuso. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}


export const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "phone", label: "Telefone" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista suspensa" },
  { value: "multiselect", label: "Seleção múltipla" },
  { value: "boolean", label: "Sim/Não" },
  { value: "textarea", label: "Área de texto" },
  { value: "checkbox", label: "Checkbox" },
] as const;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------------------------------------------------------------------
 * Presença digital do lead (Site, Instagram, Facebook)
 * ------------------------------------------------------------------------- */

/** Remove espaços e devolve null quando vazio. */
export function cleanSocial(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

/** Valida formato básico de endereço web (aceita com ou sem protocolo). */
export function isValidWebsite(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v);
}

/** Aceita URL completa, URL simplificada ou @usuario. */
export function isValidHandle(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/^@?[\w.\-]{1,60}$/.test(v)) return true;
  return isValidWebsite(v);
}

/** Extrai o usuário de uma URL de rede social ou de um @usuario. */
function handleOf(value: string, domain: string): string | null {
  const v = value.trim().replace(/^@/, "");
  const match = v.match(new RegExp(`${domain}\\.com(?:\\.br)?\\/([\\w.\\-]+)`, "i"));
  if (match) return match[1]!;
  if (/^[\w.\-]+$/.test(v)) return v;
  return null;
}

/** Link navegável para o site informado. */
export function websiteUrl(value: string | null | undefined): string | null {
  const v = cleanSocial(value);
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function instagramUrl(value: string | null | undefined): string | null {
  const v = cleanSocial(value);
  if (!v) return null;
  const handle = handleOf(v, "instagram");
  return handle ? `https://www.instagram.com/${handle}` : websiteUrl(v);
}

export function facebookUrl(value: string | null | undefined): string | null {
  const v = cleanSocial(value);
  if (!v) return null;
  const handle = handleOf(v, "facebook");
  return handle ? `https://www.facebook.com/${handle}` : websiteUrl(v);
}
