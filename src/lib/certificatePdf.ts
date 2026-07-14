import jsPDF from "jspdf";
import type { EarnedCertificate } from "@/hooks/useCertificates";

let cachedLogoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const response = await fetch("/goqii-logo.png");
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch (e) {
    console.error("Failed to load certificate logo:", e);
    return null;
  }
}

// Draws an elegant double-line border with small corner accents, similar to
// a classic certificate frame.
function drawBorder(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const borderColor = "#1e3a5f";
  const margin = 10;
  const innerMargin = 14;
  const cornerSize = 8;

  doc.setDrawColor(borderColor);
  doc.setLineWidth(1.2);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  doc.setLineWidth(0.5);
  doc.rect(innerMargin, innerMargin, pageWidth - innerMargin * 2, pageHeight - innerMargin * 2);

  // Small decorative corner accents (simple flourish approximation)
  doc.setLineWidth(0.8);
  const corners = [
    [innerMargin, innerMargin, 1, 1],
    [pageWidth - innerMargin, innerMargin, -1, 1],
    [innerMargin, pageHeight - innerMargin, 1, -1],
    [pageWidth - innerMargin, pageHeight - innerMargin, -1, -1],
  ] as const;

  for (const [x, y, dx, dy] of corners) {
    doc.line(x, y, x + cornerSize * dx, y);
    doc.line(x, y, x, y + cornerSize * dy);
  }
}

export async function downloadCertificatePDF(cert: EarnedCertificate, learnerName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;

  const navy = "#1e3a5f";
  const gray = "#4b5563";
  const darkText = "#1f2937";

  drawBorder(doc, pageWidth, pageHeight);

  // Logo (centered, top)
  const logoDataUrl = await getLogoDataUrl();
  let cursorY = 24;
  if (logoDataUrl) {
    const logoWidth = 42;
    const logoHeight = 14;
    doc.addImage(logoDataUrl, "PNG", centerX - logoWidth / 2, cursorY - logoHeight / 2, logoWidth, logoHeight);
    cursorY += 14;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(navy);
    doc.text("GOQii", centerX, cursorY, { align: "center" });
    cursorY += 10;
  }

  cursorY += 8;

  // "CERTIFICATE OF COMPLETION" banner
  doc.setFillColor(250, 246, 235);
  doc.rect(30, cursorY - 7, pageWidth - 60, 14, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  doc.setTextColor(darkText);
  doc.text("CERTIFICATE OF COMPLETION", centerX, cursorY + 2, { align: "center" });

  cursorY += 20;

  // "This is to certify that"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(gray);
  doc.text("This is to certify that", centerX, cursorY, { align: "center" });

  cursorY += 14;

  // Recipient name
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(navy);
  doc.text(learnerName.toUpperCase(), centerX, cursorY, { align: "center" });

  cursorY += 12;

  // "has successfully completed the course"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(gray);
  doc.text("has successfully completed the course", centerX, cursorY, { align: "center" });

  cursorY += 11;

  // Course title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(darkText);
  const courseTitle = (cert.course?.title || "Course").toUpperCase();
  doc.text(courseTitle, centerX, cursorY, { align: "center" });

  cursorY += 10;

  // Description line
  const description = cert.course?.description?.trim() || "the subject matter covered in this course";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(gray);
  const descText = `This course validates foundational knowledge and practical skills in ${description}.`;
  const wrappedDesc = doc.splitTextToSize(descText, pageWidth - 90);
  doc.text(wrappedDesc, centerX, cursorY, { align: "center" });

  cursorY += wrappedDesc.length * 6 + 6;

  // Date + Certificate Number
  const issuedDate = new Date(cert.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(11);
  doc.setTextColor(darkText);
  doc.text(`Date: ${issuedDate}`, centerX, cursorY, { align: "center" });
  cursorY += 6;
  doc.text(`Certificate Number: ${cert.verification_code}`, centerX, cursorY, { align: "center" });

  // Signature block (bottom right)
  const sigX = pageWidth - 70;
  const sigY = pageHeight - 34;
  doc.setDrawColor(darkText);
  doc.setLineWidth(0.3);
  doc.line(sigX - 20, sigY, sigX + 20, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(gray);
  doc.text("Authorized Signature", sigX, sigY + 6, { align: "center" });
  doc.text("GOQii Technologies Pvt. Ltd.", sigX, sigY + 11, { align: "center" });

  const fileName = `Certificate-${(cert.course?.title || "Course").replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
  doc.save(fileName);
}
