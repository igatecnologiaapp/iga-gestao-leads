import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { docTypeLabel, docStatusLabel, formatCurrency, pdfFileName } from "@/lib/commercial";
import { formatDateOnly } from "@/lib/leads";
import type {
  CommercialDocument,
  CompanySettings,
  DocumentItem,
  ItemCategory,
} from "@/lib/commercialQueries";

import igaLogo from "@/assets/iga-logo.png.asset.json";

export type PdfLogo = { dataUrl: string; width: number; height: number };

type Input = {
  company: CompanySettings | null;
  doc: CommercialDocument;
  items: DocumentItem[];
  categories: ItemCategory[];
  paymentMethod?: string | null;
  logo?: PdfLogo | null;
};

const MARGIN = 14;
const LOGO_MAX_W = 26;
const LOGO_MAX_H = 26;
/** Faixa reservada no topo das páginas seguintes para o cabeçalho compacto com logotipo. */
const CONT_HEADER_H = 26;
const BAND = [232, 235, 240] as const;
const MUTED = 110;

/**
 * Só aceitamos endereços realmente carregáveis pelo navegador.
 * Caminhos locais (ex.: "C:\\Iga\\logo.png") faziam o fetch falhar em silêncio
 * e o PDF saía sem logotipo — nesses casos usamos o ativo oficial da IGA.
 */
function usableLogoUrl(value?: string | null): string | null {
  const url = value?.trim();
  if (!url) return null;
  if (/^(https?:\/\/|data:image\/|blob:|\/)/i.test(url)) return url;
  return null;
}

async function fetchLogo(url: string): Promise<PdfLogo | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("logo"));
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("logo"));
      img.src = dataUrl;
    });
    if (!size.width || !size.height) return null;
    return { dataUrl, ...size };
  } catch {
    return null;
  }
}

/**
 * Carrega o logotipo da empresa emissora (logo_url configurado) e, em qualquer
 * falha, recorre ao logotipo oficial da IGA já existente no projeto.
 */
export async function loadCompanyLogo(logoUrl?: string | null): Promise<PdfLogo | null> {
  const configured = usableLogoUrl(logoUrl);
  if (configured) {
    const custom = await fetchLogo(configured);
    if (custom) return custom;
  }
  return fetchLogo(igaLogo.url);
}

function drawLogo(pdf: jsPDF, logo: PdfLogo | null | undefined, x: number, y: number, maxW: number, maxH: number) {
  if (!logo) return 0;
  const ratio = Math.min(maxW / logo.width, maxH / logo.height);
  const w = logo.width * ratio;
  const h = logo.height * ratio;
  try {
    pdf.addImage(logo.dataUrl, "PNG", x, y, w, h, undefined, "FAST");
    return w;
  } catch {
    return 0;
  }
}

function band(pdf: jsPDF, y: number, width: number, title: string, right?: string) {
  pdf.setFillColor(BAND[0], BAND[1], BAND[2]);
  pdf.rect(MARGIN, y, width, 9, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(30);
  pdf.text(title, MARGIN + 3, y + 6.2);
  if (right) {
    pdf.setFontSize(9);
    pdf.text(right, MARGIN + width - 3, y + 6.2, { align: "right" });
  }
  pdf.setTextColor(0);
  return y + 9;
}

export function buildDocumentPdf({ company, doc, items, categories, paymentMethod, logo }: Input): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentW = pageWidth - MARGIN * 2;
  let y = MARGIN;

  // ---------- Cabeçalho: logotipo + empresa emissora + data ----------
  const logoW = drawLogo(pdf, logo, MARGIN, y, LOGO_MAX_W, LOGO_MAX_H);
  const textLeft = MARGIN + (logoW ? logoW + 6 : 0);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(company?.name ?? "Empresa", textLeft, y + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(60);
  const companyLines = [
    company?.legal_name,
    company?.cnpj ? `CNPJ: ${company.cnpj}` : null,
    company?.email,
    company?.phone,
    [company?.address, company?.city && `${company.city}${company.state ? `-${company.state}` : ""}`]
      .filter(Boolean)
      .join(", ") || null,
    company?.postal_code ? `CEP ${company.postal_code}` : null,
  ].filter(Boolean) as string[];
  companyLines.forEach((line, i) => pdf.text(line, textLeft, y + 12 + i * 4));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(30);
  pdf.text(formatDateOnly(doc.issue_date), pageWidth - MARGIN, y + 5, { align: "right" });
  pdf.setTextColor(0);

  y = Math.max(y + 11 + companyLines.length * 4, y + (logo ? LOGO_MAX_H : 0)) + 3;
  if (company?.footer_note) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED);
    pdf.text(company.footer_note, MARGIN, y);
    pdf.setTextColor(0);
    y += 5;
  }

  // ---------- Identificação do documento ----------
  const rightInfo = [
    `Status: ${docStatusLabel(doc.status)}`,
    doc.version > 1 ? `Versão ${doc.version}` : null,
    doc.valid_until ? `Validade: ${formatDateOnly(doc.valid_until)}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  y = band(pdf, y + 1, contentW, `${docTypeLabel(doc.doc_type)} ${doc.number_label}`, rightInfo) + 6;

  // ---------- Dados do cliente ----------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`Cliente: ${doc.client_company}`, MARGIN, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(60);
  const addr = [
    [doc.client_street, doc.client_number].filter(Boolean).join(", "),
    [doc.client_neighborhood, [doc.client_city, doc.client_state].filter(Boolean).join("-")]
      .filter(Boolean)
      .join(", "),
    doc.client_postal_code ? `CEP ${doc.client_postal_code}` : null,
  ].filter(Boolean) as string[];
  addr.forEach((line, i) => pdf.text(line, MARGIN, y + 5 + i * 4));
  const contact = [
    doc.client_phone,
    doc.client_contact ? `Contato: ${doc.client_contact}` : null,
    doc.client_email,
    doc.client_segment ? `Segmento: ${doc.client_segment}` : null,
  ].filter(Boolean) as string[];
  contact.forEach((line, i) => pdf.text(line, pageWidth / 2 + 4, y + 5 + i * 4));
  pdf.setTextColor(0);
  y += 6 + Math.max(addr.length, contact.length) * 4;

  // ---------- Itens por categoria (Serviços, Peças, ...) ----------
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const groups = new Map<string, { name: string; order: number; items: DocumentItem[] }>();
  for (const item of items) {
    const cat = catOf(item.category_id);
    const key = cat?.id ?? "sem-categoria";
    if (!groups.has(key))
      groups.set(key, { name: cat?.name ?? "Outros itens", order: cat?.sort_order ?? 999, items: [] });
    groups.get(key)!.items.push(item);
  }
  const hasDiscount = items.some((i) => Number(i.discount_value));

  for (const group of [...groups.values()].sort((a, b) => a.order - b.order)) {
    if (y > 245) {
      pdf.addPage();
      y = CONT_HEADER_H;
    }
    y = band(pdf, y + 2, contentW, group.name) + 1;

    const head = ["Descrição", "Unidade", "Preço unit.", "Qtd."];
    if (hasDiscount) head.push("Desconto");
    head.push("Preço");

    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN, top: CONT_HEADER_H },
      theme: "plain",
      // Evita que a descrição de um item seja partida entre duas páginas.
      rowPageBreak: "avoid",
      styles: { fontSize: 8.5, cellPadding: { top: 1.9, bottom: 1.9, left: 2, right: 2 }, valign: "top" },
      headStyles: { textColor: MUTED, fontStyle: "normal", lineWidth: { bottom: 0.2 }, lineColor: 205 },
      bodyStyles: { lineWidth: { bottom: 0.1 }, lineColor: 225, textColor: 30 },
      columnStyles: hasDiscount
        ? {
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 26, halign: "right" },
            3: { cellWidth: 16, halign: "center" },
            4: { cellWidth: 22, halign: "right" },
            5: { cellWidth: 28, halign: "right" },
          }
        : {
            1: { cellWidth: 22, halign: "center" },
            2: { cellWidth: 30, halign: "right" },
            3: { cellWidth: 18, halign: "center" },
            4: { cellWidth: 30, halign: "right" },
          },
      head: [head],
      body: group.items.flatMap((item) => {
        const row: unknown[] = [
          { content: item.description, styles: { fontStyle: "bold" } },
          item.unit ?? "",
          formatCurrency(item.unit_price),
          String(Number(item.quantity)),
        ];
        if (hasDiscount)
          row.push(Number(item.discount_value) ? formatCurrency(item.discount_value) : "-");
        row.push(formatCurrency(item.total));
        if (!item.extra_notes) return [row as never];
        // Descrição complementar em linha própria (peso normal, sem sobreposição)
        const noteRow: unknown[] = [
          {
            content: item.extra_notes,
            colSpan: head.length,
            styles: { fontStyle: "normal", textColor: MUTED, cellPadding: { top: 0, bottom: 2.2, left: 2, right: 2 } },
          },
        ];
        return [
          [...(row as unknown[])].map((c, i) =>
            i === 0 ? c : c,
          ) as never,
          noteRow as never,
        ];
      }),
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  // ---------- Totais ----------
  const totals: [string, string][] = [
    ["Serviços", formatCurrency(doc.total_services)],
    ["Peças", formatCurrency(doc.total_parts)],
  ];
  if (Number(doc.total_discount)) totals.push(["Descontos", `- ${formatCurrency(doc.total_discount)}`]);
  totals.push(["Total", formatCurrency(doc.total_general)]);

  autoTable(pdf, {
    startY: y + 4,
    margin: { left: pageWidth / 2, right: MARGIN, top: CONT_HEADER_H },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 2.1, fillColor: [244, 246, 249] },
    columnStyles: { 1: { halign: "right" } },
    body: totals.map(([label, value], i) =>
      i === totals.length - 1
        ? [
            { content: label, styles: { fontStyle: "bold", fillColor: BAND as unknown as number[] } },
            {
              content: value,
              styles: { fontStyle: "bold", halign: "right", fillColor: BAND as unknown as number[] },
            },
          ]
        : [label, value],
    ) as never,
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // ---------- Pagamento / observações ----------
  const blocks: [string, string][] = [];
  const pay = [
    paymentMethod ? `Meios de pagamento: ${paymentMethod}` : null,
    doc.payment_terms ? `Condição: ${doc.payment_terms}` : null,
    doc.payment_deadline ? `Prazo: ${doc.payment_deadline}` : null,
    doc.payment_notes,
  ]
    .filter(Boolean)
    .join("\n");
  if (pay) blocks.push(["Pagamento", pay]);
  if (doc.notes) blocks.push(["Observações", doc.notes]);

  for (const [title, text] of blocks) {
    const lines = pdf.splitTextToSize(text, contentW - 4) as string[];
    if (y + 13 + lines.length * 4 > 282) {
      pdf.addPage();
      y = CONT_HEADER_H;
    }
    y = band(pdf, y, contentW, title) + 5.5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(30);
    pdf.text(lines, MARGIN, y);
    pdf.setTextColor(0);
    y += lines.length * 4 + 4;
  }

  // ---------- Assinatura da empresa emissora ----------
  const pageH = pdf.internal.pageSize.getHeight();
  if (y + 22 > pageH - 14) {
    pdf.addPage();
    y = CONT_HEADER_H;
  }
  const cx = pageWidth / 2;
  pdf.setDrawColor(120);
  pdf.line(cx - 40, y + 10, cx + 40, y + 10);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.text(company?.name ?? "Empresa", cx, y + 15, { align: "center" });
  if (company?.footer_note) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(MUTED);
    pdf.text(company.footer_note, cx, y + 20, { align: "center" });
    pdf.setTextColor(0);
  }

  // ---------- Cabeçalho compacto + rodapé em todas as páginas ----------
  const total = pdf.getNumberOfPages();
  const footer = [company?.name, company?.phone, company?.email].filter(Boolean).join(" · ");
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const h = pdf.internal.pageSize.getHeight();

    if (i > 1) {
      const w = drawLogo(pdf, logo, MARGIN, MARGIN - 5, 14, 10);
      const x = MARGIN + (w ? w + 4 : 0);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(40);
      pdf.text(company?.name ?? "Empresa", x, MARGIN + 1);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text(
        `${docTypeLabel(doc.doc_type)} ${doc.number_label}${doc.version > 1 ? ` · V${doc.version}` : ""}`,
        pageWidth - MARGIN,
        MARGIN + 1,
        { align: "right" },
      );
      pdf.setDrawColor(200);
      pdf.line(MARGIN, MARGIN + 5, pageWidth - MARGIN, MARGIN + 5);
      pdf.setTextColor(0);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(MUTED);
    pdf.text(footer, MARGIN, h - 8);
    pdf.text(
      `${docTypeLabel(doc.doc_type)} ${doc.number_label} — Página ${i}/${total}`,
      pageWidth - MARGIN,
      h - 8,
      { align: "right" },
    );
    pdf.setTextColor(0);
  }

  return pdf;
}

/** Gera o PDF já com o logotipo da empresa emissora carregado. */
export async function documentPdfBlob(
  input: Omit<Input, "logo">,
): Promise<{ blob: Blob; fileName: string }> {
  const logo = await loadCompanyLogo(input.company?.logo_url ?? null);
  const pdf = buildDocumentPdf({ ...input, logo });
  const fileName = pdfFileName(
    input.doc.doc_type,
    input.doc.number_label,
    input.doc.client_company,
    input.doc.version,
  );
  return { blob: pdf.output("blob"), fileName };
}
