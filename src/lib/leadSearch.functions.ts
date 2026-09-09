import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Camada de integração para pesquisa de estabelecimentos.
 *
 * Provedor atual: OpenStreetMap (Nominatim para geocodificação + Overpass API
 * para os estabelecimentos). Ambos são gratuitos e não exigem chave de API.
 *
 * A assinatura de `searchPlaces` é agnóstica ao provedor: para trocar/adicionar
 * outro fornecedor (Google Places, HERE, Foursquare...) basta implementar outro
 * `PlaceProvider` e selecioná-lo em `PROVIDERS`.
 */

const searchSchema = z.object({
  segment: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().max(2).optional().nullable(),
  region: z.string().trim().max(160).optional().nullable(),
  radiusKm: z.number().min(0.5).max(20),
  limit: z.number().int().min(1).max(60),
  provider: z.enum(["google", "osm"]).optional(),
});

export type PlaceResult = {
  externalId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  extra: Record<string, string>;
};

export type PlaceSearchResult = {
  provider: string;
  center: { lat: number; lon: number; label: string } | null;
  results: PlaceResult[];
  message?: string;
};

const UA = "IGA-Tecnologia-Gestao-de-Leads/1.0 (contato via aplicativo)";

/** Palavras-chave -> tags OSM. Livre: qualquer segmento cadastrado é aceito. */
const TAG_MAP: { match: RegExp; filters: string[] }[] = [
  { match: /a[çc]ougue|carne/i, filters: ['shop=butcher'] },
  { match: /adega|bebida|distribuidora de bebida/i, filters: ['shop=alcohol', 'shop=beverages'] },
  { match: /supermercad|mercad|atacad/i, filters: ['shop=supermarket', 'shop=convenience', 'shop=wholesale'] },
  { match: /floricultura|flor/i, filters: ['shop=florist'] },
  { match: /padaria|panific/i, filters: ['shop=bakery'] },
  { match: /restaurante|lanchonete|pizzaria/i, filters: ['amenity=restaurant', 'amenity=fast_food'] },
  { match: /bar\b|choperia|pub/i, filters: ['amenity=bar', 'amenity=pub'] },
  { match: /pet\s?shop|veterin|animal/i, filters: ['shop=pet', 'amenity=veterinary'] },
  { match: /material de constru|constru/i, filters: ['shop=doityourself', 'shop=hardware', 'shop=trade'] },
  { match: /oficina|mec[âa]nic|autopec|auto pe/i, filters: ['shop=car_repair', 'shop=car_parts'] },
  { match: /farm[áa]cia|drogaria/i, filters: ['amenity=pharmacy'] },
  { match: /hotel|pousada/i, filters: ['tourism=hotel', 'tourism=guest_house'] },
  { match: /academia|fitness/i, filters: ['leisure=fitness_centre'] },
  { match: /sal[ãa]o|cabelei|barbear|est[ée]tica/i, filters: ['shop=hairdresser', 'shop=beauty'] },
  { match: /cl[íi]nica|consult[óo]rio|odonto|dentista/i, filters: ['amenity=clinic', 'amenity=dentist', 'amenity=doctors'] },
  { match: /escola|col[ée]gio|creche/i, filters: ['amenity=school', 'amenity=kindergarten'] },
  { match: /hortifruti|sacol[ãa]o|quitanda/i, filters: ['shop=greengrocer'] },
  { match: /loja de roupa|confec|moda|vestu/i, filters: ['shop=clothes'] },
  { match: /papelaria/i, filters: ['shop=stationery'] },
  { match: /lavanderia/i, filters: ['shop=laundry'] },
];

function filtersForSegment(segment: string): { filters: string[]; byName: boolean } {
  const hit = TAG_MAP.find((t) => t.match.test(segment));
  if (hit) return { filters: hit.filters, byName: false };
  return { filters: [], byName: true };
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
}

async function geocode(query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const first = rows[0];
  if (!first) return null;
  return { lat: Number(first.lat), lon: Number(first.lon), label: first.display_name };
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Espelhos públicos do Overpass. O principal (overpass-api.de) responde HTTP 521
 *  quando o servidor de origem está fora do ar; nesse caso tentamos os demais. */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchOverpass(
  body: string,
): Promise<{ ok: true; elements: OverpassElement[] } | { ok: false; status: number }> {
  let lastStatus = 0;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain", "User-Agent": UA },
        body,
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        lastStatus = res.status;
        continue;
      }
      const json = (await res.json()) as { elements?: OverpassElement[] };
      return { ok: true, elements: json.elements ?? [] };
    } catch {
      lastStatus = lastStatus || 0;
    }
  }
  return { ok: false, status: lastStatus };
}


function onlyDigits(v: string | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}

function formatBrPhone(raw: string | undefined): string | null {
  const d = onlyDigits(raw);
  if (!d) return null;
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (local.startsWith("0800")) return raw ?? null;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return raw ?? null;
}

async function searchOsm(input: z.infer<typeof searchSchema>): Promise<PlaceSearchResult> {
  const parts = [input.region, input.city, input.state].filter(Boolean).join(", ");
  const center = await geocode(parts || input.city);
  if (!center) {
    return {
      provider: "OpenStreetMap (Nominatim + Overpass)",
      center: null,
      results: [],
      message: "Região não localizada pelo serviço de geocodificação.",
    };
  }

  const radius = Math.round(input.radiusKm * 1000);
  const { filters, byName } = filtersForSegment(input.segment);
  const around = `(around:${radius},${center.lat},${center.lon})`;
  const body = byName
    ? `[out:json][timeout:30];(nwr["name"~"${input.segment.replace(/["\\]/g, "")}",i]${around};);out center ${input.limit * 2};`
    : `[out:json][timeout:30];(${filters
        .map((f) => {
          const [k, v] = f.split("=");
          return `nwr["${k}"="${v}"]${around};`;
        })
        .join("")});out center ${input.limit * 2};`;

  const overpass = await fetchOverpass(body);
  if (!overpass.ok) {
    return {
      provider: "OpenStreetMap (Nominatim + Overpass)",
      center,
      results: [],
      message:
        "O serviço público de mapas (OpenStreetMap) está temporariamente indisponível. Nenhum dado foi alterado — aguarde alguns instantes e clique em PESQUISAR LEADS novamente.",
    };
  }
  const elements = overpass.elements;


  const results: PlaceResult[] = elements
    .map((el) => {
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat ?? null;
      const lon = el.lon ?? el.center?.lon ?? null;
      const phone = formatBrPhone(tags["phone"] ?? tags["contact:phone"]);
      const whats = formatBrPhone(tags["contact:whatsapp"] ?? tags["whatsapp"]);
      const extra: Record<string, string> = {};
      for (const key of ["opening_hours", "cuisine", "brand", "operator", "contact:instagram", "contact:facebook", "contact:email", "email"]) {
        const value = tags[key];
        if (value) extra[key] = value;
      }
      return {
        externalId: `${el.type}/${el.id}`,
        name: tags["name"] ?? "",
        phone,
        whatsapp: whats ?? (tags["contact:mobile"] ? formatBrPhone(tags["contact:mobile"]) : null),
        website: tags["website"] ?? tags["contact:website"] ?? null,
        street: tags["addr:street"] ?? null,
        number: tags["addr:housenumber"] ?? null,
        neighborhood: tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? null,
        city: tags["addr:city"] ?? null,
        state: tags["addr:state"] ?? null,
        postalCode: tags["addr:postcode"] ?? null,
        latitude: lat,
        longitude: lon,
        distanceKm: lat != null && lon != null ? haversineKm(center.lat, center.lon, lat, lon) : null,
        extra,
      } satisfies PlaceResult;
    })
    .filter((r) => r.name.trim().length > 1)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, input.limit);

  return { provider: "OpenStreetMap (Nominatim + Overpass)", center, results };
}

/* ------------------------------------------------------------------ */
/* Provedor: Google Places API (New) — Text Search                     */
/* ------------------------------------------------------------------ */

const GOOGLE_PROVIDER_LABEL = "Google Places API (New)";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

/** Somente os campos necessários ao fluxo — evita cobrança por dados extras. */
const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "nextPageToken",
].join(",");

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

function component(place: GooglePlace, type: string, short = false): string | null {
  const c = place.addressComponents?.find((x) => x.types?.includes(type));
  if (!c) return null;
  return (short ? c.shortText : c.longText) ?? null;
}

function googleErrorMessage(status: number, body: string): string {
  if (status === 401 || status === 403) {
    if (/API_KEY_HTTP_REFERRER_BLOCKED/.test(body))
      return "A chave do Google Maps está restrita por domínio e bloqueou a consulta do servidor. Ajuste as restrições da chave para 'Nenhuma' ou por endereço IP.";
    if (/API_KEY_SERVICE_BLOCKED|SERVICE_DISABLED|has not been used/i.test(body))
      return "A Places API (New) não está habilitada ou não é permitida para esta chave. Habilite a API e libere-a na chave.";
    return "Não foi possível autenticar na pesquisa do Google. Verifique a configuração da chave.";
  }
  if (status === 429) return "Limite de consultas do Google atingido no momento. Aguarde alguns instantes e tente novamente.";
  if (status === 400) return "Não foi possível montar a consulta com os filtros informados. Revise cidade, UF e região.";
  if (status >= 500) return "O serviço de pesquisa do Google está temporariamente indisponível. Tente novamente em instantes.";
  return "Não foi possível concluir a pesquisa agora. Tente novamente.";
}

async function searchGoogle(input: z.infer<typeof searchSchema>): Promise<PlaceSearchResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    return {
      provider: GOOGLE_PROVIDER_LABEL,
      center: null,
      results: [],
      message: "A pesquisa pelo Google ainda não está configurada neste ambiente.",
    };
  }

  const regionLabel = [input.region, input.city, input.state].filter(Boolean).join(", ");
  // Geocodificação gratuita (Nominatim) apenas para centrar o raio — evita SKU extra do Google.
  const center = await geocode(regionLabel || input.city);

  const textQuery = `${input.segment} em ${regionLabel || input.city}`;
  const radius = Math.min(Math.max(input.radiusKm * 1000, 500), 50_000);

  const collected: GooglePlace[] = [];
  let pageToken: string | null = null;
  // Máx. 3 páginas (60 resultados) — controle de custo.
  for (let page = 0; page < 3 && collected.length < input.limit; page += 1) {
    const body: Record<string, unknown> = {
      textQuery,
      languageCode: "pt-BR",
      regionCode: "BR",
      maxResultCount: Math.min(20, Math.max(1, input.limit - collected.length)),
    };
    if (center) {
      body["locationBias"] = {
        circle: { center: { latitude: center.lat, longitude: center.lon }, radius },
      };
    }
    if (pageToken) body["pageToken"] = pageToken;

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`Google Places falhou [${res.status}]: ${errorBody}`);
      if (collected.length > 0) break;
      return {
        provider: GOOGLE_PROVIDER_LABEL,
        center,
        results: [],
        message: googleErrorMessage(res.status, errorBody),
      };
    }

    const json = (await res.json()) as { places?: GooglePlace[]; nextPageToken?: string };
    collected.push(...(json.places ?? []));
    pageToken = json.nextPageToken ?? null;
    if (!pageToken) break;
  }

  const results: PlaceResult[] = collected
    .map((p) => {
      const lat = p.location?.latitude ?? null;
      const lon = p.location?.longitude ?? null;
      const extra: Record<string, string> = {};
      if (p.formattedAddress) extra["formatted_address"] = p.formattedAddress;
      return {
        externalId: p.id,
        name: p.displayName?.text ?? "",
        phone: formatBrPhone(p.nationalPhoneNumber),
        whatsapp: null,
        website: p.websiteUri ?? null,
        street: component(p, "route"),
        number: component(p, "street_number"),
        neighborhood: component(p, "sublocality_level_1") ?? component(p, "sublocality"),
        city: component(p, "administrative_area_level_2") ?? component(p, "locality"),
        state: component(p, "administrative_area_level_1", true),
        postalCode: component(p, "postal_code"),
        latitude: lat,
        longitude: lon,
        distanceKm:
          center && lat != null && lon != null ? haversineKm(center.lat, center.lon, lat, lon) : null,
        extra,
      } satisfies PlaceResult;
    })
    .filter((r) => r.name.trim().length > 1)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, input.limit);

  if (results.length === 0) {
    return {
      provider: GOOGLE_PROVIDER_LABEL,
      center,
      results,
      message: "Nenhum estabelecimento encontrado pelo Google para este segmento e região.",
    };
  }
  return { provider: GOOGLE_PROVIDER_LABEL, center, results };
}

const PROVIDERS = { google: searchGoogle, osm: searchOsm };

/** Pesquisa estabelecimentos reais por segmento e região. Requer usuário autenticado. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => searchSchema.parse(data))
  .handler(async ({ data }): Promise<PlaceSearchResult> => {
    const key = data.provider ?? "google";
    const provider = PROVIDERS[key];
    try {
      return await provider(data);
    } catch (e) {
      console.error("Falha na pesquisa externa de estabelecimentos:", e);
      return {
        provider: key === "google" ? GOOGLE_PROVIDER_LABEL : "OpenStreetMap (Nominatim + Overpass)",
        center: null,
        results: [],
        message: "Não foi possível concluir a pesquisa externa agora. Tente novamente.",
      };
    }
  });
