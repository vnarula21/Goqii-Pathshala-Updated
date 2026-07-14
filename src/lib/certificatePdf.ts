import jsPDF from "jspdf";
import type { EarnedCertificate } from "@/hooks/useCertificates";

export function downloadCertificatePDF(cert: EarnedCertificate, learnerName: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryColor = cert.certificate?.template_config?.primary_color || "#3b82f6";
  const secondaryColor = cert.certificate?.template_config?.secondary_color || "#1e40af";

  // Outer decorative border
  doc.setDrawColor(secondaryColor);
  doc.setLineWidth(1.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(secondaryColor);
  doc.text("Certificate of Completion", pageWidth / 2, 45, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(80, 80, 80);
  doc.text("This certifies that", pageWidth / 2, 65, { align: "center" });

  // Learner name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 30);
  doc.text(learnerName, pageWidth / 2, 82, { align: "center" });

  // Course completion line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(80, 80, 80);
  doc.text("has successfully completed the course", pageWidth / 2, 98, { align: "center" });

  // Course title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(primaryColor);
  const courseTitle = cert.course?.title || "Course";
  doc.text(courseTitle, pageWidth / 2, 112, { align: "center" });

  // Score
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text(`with a score of ${cert.score}%`, pageWidth / 2, 124, { align: "center" });

  // Footer: date + verification code
  const issuedDate = new Date(cert.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Issued on ${issuedDate}`, pageWidth / 2, pageHeight - 30, { align: "center" });
  doc.text(`Verification Code: ${cert.verification_code}`, pageWidth / 2, pageHeight - 22, { align: "center" });

  if (cert.expires_at) {
    const expiryDate = new Date(cert.expires_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Valid until ${expiryDate}`, pageWidth / 2, pageHeight - 14, { align: "center" });
  }

  const fileName = `Certificate-${courseTitle.replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
  doc.save(fileName);
}
