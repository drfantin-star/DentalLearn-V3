import {
  ORGANISME,
  AXE_LABELS,
  DENTALSCHOOL_ORGANISME,
  type EppAttestationData,
  type AttestationOrganisme,
} from './types'
import { SIGNATURE_BASE64, SIGNATURE_RATIO } from './signatureBase64'

const FALLBACK_ORGANISME: AttestationOrganisme = {
  nom: DENTALSCHOOL_ORGANISME,
  qualiopi: ORGANISME.qualiopi,
  odpc: ORGANISME.ndpc,
}

/**
 * Génère un blob PDF pour une attestation EPP (après T2).
 * Style visuel identique à generateFormationPDF pour cohérence.
 */
export async function generateEppPDF(
  data: EppAttestationData
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const teal = [15, 123, 108] as [number, number, number]
  const darkGray = [30, 30, 30] as [number, number, number]
  const lightGray = [245, 245, 245] as [number, number, number]

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  const organisme = data.organisme ?? FALLBACK_ORGANISME
  const isDentalschool = organisme.nom === DENTALSCHOOL_ORGANISME

  // ── EN-TÊTE TEAL ─────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  const headerTitle = isDentalschool ? 'DENTALSCHOOL — EROJU SAS' : organisme.nom.toUpperCase()
  doc.text(headerTitle, 105, 12, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text("ATTESTATION DE RÉALISATION", 105, 20, { align: 'center' })
  doc.text("ÉVALUATION DES PRATIQUES PROFESSIONNELLES (EPP)", 105, 26, { align: 'center' })
  doc.text(AXE_LABELS[2] + ' | Méthodologie HAS', 105, 31, { align: 'center' })

  // ── TEXTE INTRO ───────────────────────────────────────────────
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const introText =
    'Le praticien soussigné atteste avoir réalisé une Évaluation des Pratiques ' +
    'Professionnelles (EPP) complète (Tour 1 et Tour 2), conforme à la méthodologie ' +
    'de la Haute Autorité de Santé (HAS), dans le cadre de la Certification Périodique ' +
    '(CP) — Axe 2 : Amélioration de la qualité et de la sécurité des soins.'
  const lines = doc.splitTextToSize(introText, 182)
  doc.text(lines, 14, 46)

  // ── IDENTIFICATION ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text("IDENTIFICATION DE L'AUDIT", 14, 66)
  doc.setDrawColor(...teal)
  doc.setLineWidth(0.5)
  doc.line(14, 68, 196, 68)

  const deltaSign = data.tours.delta_score >= 0 ? '+' : ''
  const deltaStr = `${deltaSign}${data.tours.delta_score.toFixed(0)} %`

  autoTable(doc, {
    startY: 71,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65, fillColor: lightGray },
      1: { cellWidth: 117 },
    },
    body: [
      ['Nom et prénom', data.participant.nom_complet],
      ['N° RPPS', data.participant.rpps],
      ['Profession', data.participant.profession],
      ['Thématique / Audit', data.audit.title],
      [
        'Organisme formateur',
        isDentalschool
          ? `${ORGANISME.nom_court} — Qualiopi N° ${organisme.qualiopi}`
          : organisme.qualiopi
            ? `${organisme.nom} — Qualiopi N° ${organisme.qualiopi}`
            : organisme.nom,
      ],
      ['Type action CNP', 'Type B — EPP / gestion des risques (labellisation CNP en cours)'],
      ['Date Tour 1 (T1)', fmtDate(data.tours.t1_completed_at)],
      ['Dossiers T1', `${data.tours.t1_nb_dossiers} dossiers évalués`],
      ['Score conformité T1', `${data.tours.t1_score.toFixed(0)} %`],
      ['Date Tour 2 (T2)', fmtDate(data.tours.t2_completed_at)],
      ['Dossiers T2', `${data.tours.t2_nb_dossiers} dossiers évalués`],
      ['Score conformité T2', `${data.tours.t2_score.toFixed(0)} %`],
      ['Progression T1 → T2', deltaStr],
    ],
  })

  // ── VALIDATION ────────────────────────────────────────────────
  const valY = (doc as any).lastAutoTable.finalY + 8

  doc.setFillColor(220, 252, 231)
  doc.roundedRect(14, valY, 182, 22, 3, 3, 'F')
  doc.setDrawColor(22, 163, 74)
  doc.setLineWidth(0.5)
  doc.roundedRect(14, valY, 182, 22, 3, 3, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(22, 163, 74)
  doc.text('✓ EPP VALIDÉE — AXE 2 CERTIFICATION PÉRIODIQUE', 105, valY + 8, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(22, 101, 52)
  doc.text(
    `T1 : ${data.tours.t1_score.toFixed(0)} % → T2 : ${data.tours.t2_score.toFixed(0)} % | Progression : ${deltaStr}`,
    105, valY + 15, { align: 'center' }
  )

  // ── SIGNATURE / TAMPON ────────────────────────────────────────
  const sigY = valY + 30
  doc.setTextColor(...darkGray)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fait à ${ORGANISME.ville}, le ${fmtDate(new Date())}`, 14, sigY)

  const sigWidth = 70
  const sigHeight = sigWidth / SIGNATURE_RATIO
  if (isDentalschool) {
    try {
      doc.addImage(SIGNATURE_BASE64, 'JPEG', 14, sigY + 4, sigWidth, sigHeight)
    } catch (err) {
      console.error('Erreur insertion signature :', err)
      doc.setFont('helvetica', 'bolditalic')
      doc.text('Dr Julie Fantin', 14, sigY + 15)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text('Responsable pédagogique', 14, sigY + 22)
    }
  } else {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.3)
    doc.rect(14, sigY + 4, sigWidth, sigHeight, 'S')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.setFont('helvetica', 'italic')
    doc.text(
      "Cachet et signature de l'organisme",
      14 + sigWidth / 2,
      sigY + 4 + sigHeight / 2,
      { align: 'center' }
    )
  }

  doc.setFontSize(8)
  doc.setTextColor(...teal)
  doc.setFont('helvetica', 'bold')
  doc.text('Code de vérification :', 130, sigY + 20)
  doc.setFont('courier', 'normal')
  doc.text(data.verification_code, 130, sigY + 26)

  // ── PIED DE PAGE ─────────────────────────────────────────────
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    if (isDentalschool) {
      doc.text(
        `${ORGANISME.nom_court} — ${ORGANISME.adresse} — SIRET ${ORGANISME.siret} — APE ${ORGANISME.ape}`,
        105, 284, { align: 'center' }
      )
      doc.text(
        `Qualiopi ${organisme.qualiopi} — ODPC ${organisme.odpc} — Document conservé 6 ans | Page ${i}/${pageCount}`,
        105, 289, { align: 'center' }
      )
    } else {
      doc.text(organisme.nom, 105, 284, { align: 'center' })
      const qualiopiPart = organisme.qualiopi
        ? `Qualiopi ${organisme.qualiopi} — `
        : ''
      doc.text(
        `${qualiopiPart}Document conservé 6 ans | Page ${i}/${pageCount}`,
        105, 289, { align: 'center' }
      )
    }
  }

  return doc.output('blob')
}

export function getEppPDFFilename(auditSlug: string): string {
  const dateStr = new Date().toISOString().split('T')[0]
  return `Attestation-EPP_${auditSlug}_${dateStr}.pdf`
}
