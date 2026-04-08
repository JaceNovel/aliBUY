import { readFile } from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import type { SourcingOrder } from "@/lib/alibaba-sourcing";
import {
  AFRIPAY_COMPANY_ADDRESS,
  AFRIPAY_COMPANY_EMAIL,
  AFRIPAY_COMPANY_NAME,
  AFRIPAY_COMPANY_PHONE,
} from "@/lib/afripay-logistics";
import type { AdminOrderParcelSnapshot } from "@/lib/admin-order-parcel";
import {
  getDeliveryNoteCourierContact,
  getDeliveryNoteCustomerAddressLines,
  getDeliveryNoteCustomsDetails,
  getDeliveryNoteDocumentNumber,
  getDeliveryNoteFingerprint,
  getDeliveryNoteVerificationPayload,
} from "@/lib/admin-sourcing-delivery-note-data";
import { SITE_LOGO_PATH } from "@/lib/site-config";

const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.max(0, value)) + " FCFA";
}

function formatDate(value?: string) {
  if (!value) {
    return "A confirmer";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "A confirmer";
  }

  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(date);
}

function decodePublicPath(assetPath: string) {
  return decodeURIComponent(assetPath.startsWith("/") ? assetPath.slice(1) : assetPath);
}

async function loadLogoBuffer() {
  const relativePath = decodePublicPath(SITE_LOGO_PATH);
  return readFile(path.join(process.cwd(), "public", relativePath));
}

function collectPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function ensurePage(doc: PDFKit.PDFDocument, y: number, requiredHeight: number) {
  if (y + requiredHeight <= PAGE_HEIGHT - PAGE_MARGIN) {
    return y;
  }

  doc.addPage({ size: "A4", margin: PAGE_MARGIN });
  return PAGE_MARGIN;
}

function drawLabelValue(doc: PDFKit.PDFDocument, x: number, y: number, label: string, value: string, width: number) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#667085").text(label, x, y, { width });
  doc.font("Helvetica").fontSize(10.5).fillColor("#14213d").text(value, x, y + 12, { width });
}

function drawStamp(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save();
  doc.translate(x, y);
  doc.rotate(-12);
  doc.lineWidth(3).strokeColor("#b54708").circle(0, 0, 38).stroke();
  doc.lineWidth(1).dash(4, { space: 3 }).circle(0, 0, 28).stroke();
  doc.undash();
  doc.fillColor("#b54708").font("Helvetica-Bold").fontSize(10).text("AFRIPAY", -22, -8, { width: 44, align: "center" });
  doc.fontSize(7).text("OFFICIEL", -24, 5, { width: 48, align: "center" });
  doc.restore();
}

export async function generateAdminSourcingDeliveryNotePdf(order: SourcingOrder, parcelSnapshot: AdminOrderParcelSnapshot) {
  const [logoBuffer, qrBuffer] = await Promise.all([
    loadLogoBuffer(),
    QRCode.toBuffer(getDeliveryNoteVerificationPayload(order), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
      color: { dark: "#14213D", light: "#FFFFFF" },
    }),
  ]);

  const courier = getDeliveryNoteCourierContact(order);
  const documentNumber = getDeliveryNoteDocumentNumber(order);
  const fingerprint = getDeliveryNoteFingerprint(order);
  const customerAddressLines = getDeliveryNoteCustomerAddressLines(order, parcelSnapshot);
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, info: { Title: `Bon de sourcing ${order.orderNumber}`, Author: AFRIPAY_COMPANY_NAME } });
  const pdfPromise = collectPdfBuffer(doc);
  let y = PAGE_MARGIN;

  doc.image(logoBuffer, PAGE_MARGIN, y, { fit: [140, 56] });
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#b54708").text("BON DE SOURCING CLIENT", PAGE_MARGIN + 155, y + 4, { characterSpacing: 1.6 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#667085").text(`Document ${documentNumber}`, PAGE_MARGIN + 155, y + 18, { width: 180 });
  doc.font("Helvetica-Bold").fontSize(24).fillColor("#14213d").text(order.orderNumber, PAGE_MARGIN + 155, y + 22, { width: 250 });
  drawStamp(doc, PAGE_WIDTH - 92, y + 34);
  y += 72;

  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 78, 16).fillAndStroke("#f8fbff", "#d9e2ec");
  drawLabelValue(doc, PAGE_MARGIN + 16, y + 12, "Entreprise", AFRIPAY_COMPANY_NAME, 155);
  drawLabelValue(doc, PAGE_MARGIN + 16, y + 36, "Coordonnees", `${AFRIPAY_COMPANY_ADDRESS}\n${AFRIPAY_COMPANY_PHONE} · ${AFRIPAY_COMPANY_EMAIL}`, 210);
  drawLabelValue(doc, PAGE_MARGIN + 240, y + 12, "Client", `${order.customerName}\n${order.customerPhone}\n${order.customerEmail}`, 140);
  drawLabelValue(doc, PAGE_MARGIN + 390, y + 12, "Emission", `${formatDate(order.updatedAt || order.createdAt)}\n${documentNumber}`, 125);
  y += 98;

  y = ensurePage(doc, y, 110);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#14213d").text("Livraison et remise", PAGE_MARGIN, y);
  y += 18;
  doc.roundedRect(PAGE_MARGIN, y, 250, 82, 14).fillAndStroke("#fbfcfe", "#d9e2ec");
  doc.roundedRect(PAGE_MARGIN + 265, y, CONTENT_WIDTH - 265, 82, 14).fillAndStroke("#fbfcfe", "#d9e2ec");
  drawLabelValue(doc, PAGE_MARGIN + 14, y + 12, "Adresse de remise", customerAddressLines.join("\n"), 220);
  drawLabelValue(doc, PAGE_MARGIN + 279, y + 12, "Livreur / responsable", `${courier.courierName}\n${courier.courierPhone}\n${courier.courierCheckpoint}\n${courier.courierEta}`, 230);
  y += 100;

  doc.font("Helvetica-Bold").fontSize(13).fillColor("#14213d").text("Articles et declaration douaniere", PAGE_MARGIN, y);
  y += 20;

  for (const item of parcelSnapshot.items) {
    const customs = getDeliveryNoteCustomsDetails(item);
    const rowHeight = 116;
    y = ensurePage(doc, y, rowHeight + 12);
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, rowHeight, 14).fillAndStroke("#ffffff", "#d9e2ec");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#14213d").text(item.title, PAGE_MARGIN + 14, y + 12, { width: 220 });
    doc.font("Helvetica").fontSize(10).fillColor("#475467").text(`Quantite: ${item.quantity}${item.selectionLabel ? ` · ${item.selectionLabel}` : ""}${item.packaging ? ` · ${item.packaging}` : ""}`, PAGE_MARGIN + 14, y + 30, { width: 235 });
    doc.roundedRect(PAGE_MARGIN + 14, y + 52, 250, 48, 10).fillAndStroke("#fff7ec", "#f7d9b5");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#b54708").text("Nature de marchandise", PAGE_MARGIN + 24, y + 60);
    doc.font("Helvetica").fontSize(9.5).fillColor("#14213d").text(customs.natureLabel, PAGE_MARGIN + 24, y + 74, { width: 225 });

    doc.roundedRect(PAGE_MARGIN + 278, y + 12, 130, 88, 10).fillAndStroke("#f8fbff", "#d9e2ec");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#667085").text("Documents douaniers", PAGE_MARGIN + 288, y + 22);
    doc.font("Helvetica").fontSize(9).fillColor("#14213d").text(customs.documents.map((entry) => `• ${entry}`).join("\n"), PAGE_MARGIN + 288, y + 38, { width: 110 });

    doc.roundedRect(PAGE_MARGIN + 420, y + 12, 135, 88, 10).fillAndStroke("#f8fbff", "#d9e2ec");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#667085").text("Declaration", PAGE_MARGIN + 430, y + 22);
    doc.font("Helvetica").fontSize(9).fillColor("#14213d").text(customs.declarationLabel, PAGE_MARGIN + 430, y + 38, { width: 115 });
    y += rowHeight + 12;
  }

  y = ensurePage(doc, y, 180);
  doc.roundedRect(PAGE_MARGIN, y, 260, 88, 14).fillAndStroke("#fbfcfe", "#d9e2ec");
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#14213d").text("Montants declares", PAGE_MARGIN + 14, y + 14);
  doc.font("Helvetica").fontSize(10).fillColor("#14213d")
    .text(`Valeur produits: ${formatMoney(order.cartProductsTotalFcfa)}`, PAGE_MARGIN + 14, y + 34)
    .text(`Frais logistiques: ${formatMoney(order.shippingCostFcfa)}`, PAGE_MARGIN + 14, y + 50)
    .text(`Total commande: ${formatMoney(order.totalPriceFcfa)}`, PAGE_MARGIN + 14, y + 66);

  doc.roundedRect(PAGE_MARGIN + 276, y, CONTENT_WIDTH - 276, 88, 14).fillAndStroke("#fffdf8", "#d9e2ec");
  doc.image(qrBuffer, PAGE_MARGIN + 290, y + 12, { fit: [70, 70] });
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#14213d").text("Verification numerique", PAGE_MARGIN + 372, y + 14);
  doc.font("Helvetica").fontSize(9).fillColor("#475467").text("QR code et signature numerique relies a la reference de commande pour archivage et verification interne.", PAGE_MARGIN + 372, y + 32, { width: 150 });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#14213d").text(fingerprint, PAGE_MARGIN + 372, y + 65, { width: 150 });
  y += 108;

  y = ensurePage(doc, y, 170);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#14213d").text("Signatures et remise", PAGE_MARGIN, y);
  y += 18;
  const signatureWidth = 165;
  const signatureGap = 14;
  [
    { title: "Entreprise", name: AFRIPAY_COMPANY_NAME },
    { title: "Livreur", name: courier.courierName },
    { title: "Client", name: order.customerName },
  ].forEach((block, index) => {
    const x = PAGE_MARGIN + index * (signatureWidth + signatureGap);
    doc.roundedRect(x, y, signatureWidth, 128, 14).fillAndStroke("#ffffff", "#d9e2ec");
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#14213d").text(block.title, x + 12, y + 12);
    doc.font("Helvetica").fontSize(9.5).fillColor("#475467").text(block.name, x + 12, y + 28, { width: signatureWidth - 24 });
    doc.roundedRect(x + 12, y + 48, signatureWidth - 24, 42, 10).dash(3, { space: 2 }).stroke("#cbd5e1").undash();
    doc.font("Helvetica").fontSize(8.5).fillColor("#667085").text("Nom: __________________", x + 12, y + 98);
    doc.text("Date: __________________", x + 12, y + 112);
  });

  doc.end();
  return pdfPromise;
}