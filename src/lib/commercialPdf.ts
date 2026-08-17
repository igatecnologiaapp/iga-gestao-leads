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
const LOGO_MAX_H = 18;

/**
 * Carrega o logotipo da empresa emissora (logo_url configurado ou o logotipo
 * oficial da IGA) como dataURL, preservando a proporção original.
 */
export async function loadCompanyLogo(logoUrl?: string | null): Promise<PdfLogo | null> {
  const url = logoUrl?.trim() ? logoUrl.trim() : igaLogo.url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
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

export function buildDocumentPdf({ company, doc, items, categories, paymentMethod, logo }: Input): jsPDF {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = MARGIN;

  // Logotipo (mantém proporção, sem distorcer nem sobrepor textos)
  let textLeft = MARGIN;
  let logoHeight = 0;
  if (logo) {
    const ratio = Math.min(LOGO_MAX_W / logo.width, LOGO_MAX_H / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    try {
      pdf.addImage(logo.dataUrl, "PNG", MARGIN, y, w, h, undefined, "FAST");
      textLeft = MARGIN + w + 5;
      logoHeight = h;
    } catch {
      /* logotipo inválido: segue sem imagem */
    }
  }

  // Cabeçalho — empresa emissora
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(company?.name ?? "Empresa", textLeft, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
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
  companyLines.forEach((line, i) => pdf.text(line, textLeft, y + 10 + i * 4));

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(`${docTypeLabel(doc.doc_type)} ${doc.number_label}`, pageWidth - MARGIN, y + 4, {
    align: "right",
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const headRight = [
    `Emissão: ${formatDateOnly(doc.issue_date)}`,
    `Status: ${docStatusLabel(doc.status)}`,
    `Versão: ${doc.version}`,
    doc.valid_until ? `Validade: ${formatDateOnly(doc.valid_until)}` : null,
  ].filter(Boolean) as string[];
  headRight.forEach((line, i) =>
    pdf.text(line, pageWidth - MARGIN, y + 10 + i * 4, { align: "right" }),
  );

  y = Math.max(y + 12 + Math.max(companyLines.length, headRight.length) * 4, y + logoHeight + 4);
  pdf.setDrawColor(200);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 7;

  // Cliente
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`Cliente: ${doc.client_company}`, MARGIN, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  const addr = [
    [doc.client_street, doc.client_number].filter(Boolean).join(", "),
    [doc.client_neighborhood, [doc.client_city, doc.client_state].filter(Boolean).join("-")]
      .filter(Boolean)
      .join(", "),
    doc.client_postal_code ? `CEP ${doc.client_postal_code}` : null,
  ].filter(Boolean) as string[];
  addr.forEach((line, i) => pdf.text(line, MARGIN, y + 5 + i * 4));
  const contact = [
    doc.client_contact ? `Contato: ${doc.client_contact}` : null,
    doc.client_phone,
    doc.client_email,
    doc.client_segment ? `Segmento: ${doc.client_segment}` : null,
  ].filter(Boolean) as string[];
  contact.forEach((line, i) =>
    pdf.text(line, pageWidth - MARGIN, y + 5 + i * 4, { align: "right" }),
  );
  y += 6 + Math.max(addr.length, contact.length) * 4;

  // Itens por categoria
  const catOf = (id: string | null) => categories.find((c) => c.id === id);
  const groups = new Map<string, { name: string; items: DocumentItem[] }>();
  for (const item of items) {
    const cat = catOf(item.category_id);
    const key = cat?.id ?? "sem-categoria";
    if (!groups.has(key)) groups.set(key, { name: cat?.name ?? "Outros itens", items: [] });
    groups.get(key)!.items.push(item);
  }

  for (const group of groups.values()) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    y += 5;
    pdf.text(group.name, MARGIN, y);
    autoTable(pdf, {
      startY: y + 2,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 8.5, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [235, 238, 243], textColor: 40, fontStyle: "bold" },
      columnStyles: {
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 26, halign: "right" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 26, halign: "right" },
      },
      head: [["Descrição", "Unidade", "Preço unit.", "Qtd.", "Desconto", "Preço"]],
      body: group.items.map((item) => [
        item.description + (item.extra_notes ? `\n${item.extra_notes}` : ""),
        item.unit ?? "",
        formatCurrency(item.unit_price),
        String(Number(item.quantity)),
        Number(item.discount_value) ? formatCurrency(item.discount_value) : "-",
        formatCurrency(item.total),
      ]),
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  }

  // Totais
  const totals: [string, string][] = [
    ["Serviços", formatCurrency(doc.total_services)],
    ["Peças", formatCurrency(doc.total_parts)],
  ];
  if (Number(doc.total_discount)) totals.push(["Descontos", `- ${formatCurrency(doc.total_discount)}`]);
  totals.push(["Total", formatCurrency(doc.total_general)]);

  autoTable(pdf, {
    startY: y + 4,
    margin: { left: pageWidth / 2, right: MARGIN },
    styles: { fontSize: 9.5, cellPadding: 2 },
    theme: "plain",
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    body: totals,
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Pagamento / observações
  const blocks: [string, string][] = [];
  const pay = [
    paymentMethod ? `Forma de pagamento: ${paymentMethod}` : null,
    doc.payment_terms ? `Condição: ${doc.payment_terms}` : null,
    doc.payment_deadline ? `Prazo: ${doc.payment_deadline}` : null,
    doc.payment_notes,
  ]
    .filter(Boolean)
    .join("\n");
  if (pay) blocks.push(["Pagamento", pay]);
  if (doc.notes) blocks.push(["Observações", doc.notes]);

  for (const [title, text] of blocks) {
    if (y > 255) {
      pdf.addPage();
      y = MARGIN;
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text(title, MARGIN, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(text, pageWidth - MARGIN * 2) as string[];
    pdf.text(lines, MARGIN, y + 5);
    y += 9 + lines.length * 4;
  }

  // Rodapé com paginação
  const total = pdf.getNumberOfPages();
  const footer = [company?.name, company?.phone, company?.email, company?.footer_note]
    .filter(Boolean)
    .join(" · ");
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const h = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(7.5);
    pdf.setTextColor(120);
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
