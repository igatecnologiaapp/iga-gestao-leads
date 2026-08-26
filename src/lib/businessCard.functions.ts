import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  /** Imagem do cartão em data URL (data:image/...;base64,...) */
  image: z
    .string()
    .max(8_000_000)
    .refine((v) => v.startsWith("data:image/"), "Formato de imagem inválido."),
  /** Nomes de segmentos já cadastrados, para casamento seguro. */
  segments: z.array(z.string().max(120)).max(200).default([]),
});

export type BusinessCardData = {
  company: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  segment: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  notes: string | null;
};

export type BusinessCardResult =
  | { status: "ok"; data: BusinessCardData }
  | { status: "unreadable"; message: string }
  | { status: "error"; message: string };

const cardSchema = z.object({
  company: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  number: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  cep: z.string().nullable().optional(),
  segment: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^(n\/?a|null|none|desconhecido|nao informado|não informado)$/i.test(v)) return null;
  return v;
}

/** Lê um cartão de visita com IA (visão) e devolve os campos identificados. */
export const readBusinessCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<BusinessCardResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { status: "error", message: "Serviço de leitura não configurado." };

    const segmentList = data.segments.filter(Boolean);
    const prompt = [
      "Você extrai dados de cartões de visita brasileiros.",
      "Responda SOMENTE com um JSON válido, sem markdown, com as chaves:",
      "company, contact, phone, email, street, number, neighborhood, city, state, cep, segment, website, instagram, facebook, notes.",
      "Use null quando a informação não estiver claramente legível no cartão. Nunca invente dados.",
      "phone: apenas um telefone principal, com DDD. cep: formato 00000-000. state: sigla UF.",
      "street: apenas o nome do logradouro (sem número). number: apenas o número.",
      segmentList.length
        ? `segment: escolha EXATAMENTE um destes valores se tiver certeza, senão null: ${segmentList.join(" | ")}`
        : "segment: null",
      "website: endereço do site da empresa, se houver (ex.: https://www.empresa.com.br), senão null.",
      "instagram: perfil do Instagram como @usuario ou a URL impressa no cartão, senão null.",
      "facebook: página do Facebook como URL ou nome da página, senão null.",
      "notes: outras informações relevantes do cartão (site, cargo, redes sociais) em uma linha, ou null.",
      "Se a imagem não for um cartão de visita legível, responda {\"unreadable\": true}.",
    ].join("\n");

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: data.image } },
              ],
            },
          ],
        }),
      });
    } catch {
      return { status: "error", message: "Não foi possível contatar o serviço de leitura." };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[businessCard] gateway", response.status, body.slice(0, 500));
      if (response.status === 429)
        return { status: "error", message: "Muitas leituras em sequência. Tente novamente em instantes." };
      if (response.status === 402)
        return { status: "error", message: "Créditos de IA esgotados. Fale com o administrador." };
      if (response.status === 403)
        return { status: "error", message: "Leitura por IA indisponível para este espaço de trabalho." };
      return { status: "error", message: "Falha ao processar a imagem. Tente novamente." };
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const json = raw.replace(/```json|```/g, "").trim();
    const start = json.indexOf("{");
    const end = json.lastIndexOf("}");
    if (start < 0 || end <= start)
      return { status: "unreadable", message: "Não foi possível ler o cartão. Preencha manualmente." };

    let parsed: unknown;
    try {
      parsed = JSON.parse(json.slice(start, end + 1));
    } catch {
      return { status: "unreadable", message: "Não foi possível ler o cartão. Preencha manualmente." };
    }

    if ((parsed as { unreadable?: boolean }).unreadable)
      return {
        status: "unreadable",
        message: "Imagem com baixa qualidade ou sem dados legíveis. Preencha manualmente.",
      };

    const safe = cardSchema.safeParse(parsed);
    if (!safe.success)
      return { status: "unreadable", message: "Não foi possível ler o cartão. Preencha manualmente." };

    const c = safe.data;
    const segment = clean(c.segment);
    const result: BusinessCardData = {
      company: clean(c.company),
      contact: clean(c.contact),
      phone: clean(c.phone),
      email: clean(c.email),
      street: clean(c.street),
      number: clean(c.number),
      neighborhood: clean(c.neighborhood),
      city: clean(c.city),
      state: clean(c.state),
      cep: clean(c.cep),
      segment:
        segment && segmentList.some((s) => s.toLowerCase() === segment.toLowerCase())
          ? segmentList.find((s) => s.toLowerCase() === segment.toLowerCase())!
          : null,
      website: clean(c.website),
      instagram: clean(c.instagram),
      facebook: clean(c.facebook),
      notes: clean(c.notes),
    };

    const hasAny = Object.values(result).some((v) => v !== null);
    if (!hasAny)
      return {
        status: "unreadable",
        message: "Nenhuma informação foi identificada no cartão. Preencha manualmente.",
      };

    return { status: "ok", data: result };
  });
