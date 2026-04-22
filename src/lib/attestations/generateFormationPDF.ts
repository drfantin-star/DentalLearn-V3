import { ORGANISME, AXE_LABELS, type FormationAttestationData } from './types'
import { SIGNATURE_BASE64, SIGNATURE_RATIO } from './signatureBase64'

/**
 * Génère un blob PDF pour une attestation de formation en ligne.
 * Style visuel cohérent avec l'attestation EPP (teal #0F7B6C, autoTable).
 */
export async function generateFormationPDF(
  data: FormationAttestationData
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const teal = [15, 123, 108] as [number, number, number]
  const darkGray = [30, 30, 30] as [number, number, number]
  const lightGray = [245, 245, 245] as [number, number, number]

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── EN-TÊTE TEAL ─────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('DENTALSCHOOL — EROJU SAS', 105, 12, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text("ATTESTATION DE FORMATION CONTINUE", 105, 20, { align: 'center' })
  doc.text("Parcours numérique en ligne — DentalLearn", 105, 26, { align: 'center' })

  const axeLabel = data.formation.axe_cp
    ? AXE_LABELS[data.formation.axe_cp] || `Axe ${data.formation.axe_cp}`
    : 'Hors Certification Périodique'
  doc.text(axeLabel, 105, 31, { align: 'center' })

  // ── TEXTE INTRO ───────────────────────────────────────────────
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const introText =
    `Le praticien soussigné atteste avoir suivi et complété dans son intégralité ` +
    `la formation continue en ligne dispensée par Dentalschool — EROJU SAS, ` +
    `conforme au cadre de la Certification Périodique (CP) des chirurgiens-dentistes.`
  const lines = doc.splitTextToSize(introText, 182)
  doc.text(lines, 14, 46)

  // ── IDENTIFICATION ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text("IDENTIFICATION DU PARCOURS", 14, 66)
  doc.setDrawColor(...teal)
  doc.setLineWidth(0.5)
  doc.line(14, 68, 196, 68)

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
      ['Formation suivie', data.formation.title],
      ['Formateur', data.formation.formateur],
      ['Comité scientifique', ORGANISME.comite_scientifique],
      ['Organisme formateur', `${ORGANISME.nom_court} — Qualiopi N° ${ORGANISME.qualiopi} — ODPC : ${ORGANISME.ndpc}`],
      ['Type action CNP', `Type ${data.formation.type_cnp} — labellisation CNP en cours`],
    ],
  })

  // ── PARCOURS PÉDAGOGIQUE ──────────────────────────────────────
  const y1 = (doc as any).lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text("PARCOURS PÉDAGOGIQUE", 14, y1)
  doc.line(14, y1 + 2, 196, y1 + 2)

  autoTable(doc, {
    startY: y1 + 5,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 65, fillColor: lightGray },
      1: { cellWidth: 117 },
    },
    body: [
      ['Date de début', fmtDate(data.parcours.started_at)],
      ['Date de fin', fmtDate(data.parcours.completed_at)],
      ['Durée équivalente', `${data.parcours.duree_heures} heures (durée forfaitaire)`],
      ['Séquences complétées', `${data.parcours.nb_sequences} / ${data.parcours.nb_sequences_total}`],
      ['Taux de complétion', `${data.parcours.taux_completion.toFixed(0)} %`],
      ['Taux de réussite aux quiz', `${data.parcours.taux_reussite_quiz.toFixed(1)} %`],
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
  doc.text("✓ FORMATION VALIDÉE — 100 % COMPLÉTÉE", 105, valY + 8, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(22, 101, 52)
  doc.text(
    `${data.parcours.nb_sequences_total} séquences complétées | ${data.parcours.taux_reussite_quiz.toFixed(1)} % de réussite | ${data.parcours.duree_heures} h équivalentes`,
    105, valY + 15, { align: 'center' }
  )

  // ── SIGNATURE / TAMPON ────────────────────────────────────────
  const sigY = valY + 30
  doc.setTextColor(...darkGray)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fait à ${ORGANISME.ville}, le ${fmtDate(new Date())}`, 14, sigY)

  // Insérer le tampon EROJU (signature + infos organisme)
  // Ratio 1.75 — largeur 70mm → hauteur 40mm
  const sigWidth = 70
  const sigHeight = sigWidth / SIGNATURE_RATIO
  try {
    doc.addImage(SIGNATURE_BASE64, 'JPEG', 14, sigY + 4, sigWidth, sigHeight)
  } catch (err) {
    console.error('Erreur insertion signature :', err)
    // Fallback texte si l'image plante
    doc.setFont('helvetica', 'bolditalic')
    doc.text('Dr Julie Fantin', 14, sigY + 15)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Responsable pédagogique', 14, sigY + 22)
  }

  // Code de vérification à droite de la signature
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
    doc.text(
      `${ORGANISME.nom_court} — ${ORGANISME.adresse} — SIRET ${ORGANISME.siret} — APE ${ORGANISME.ape}`,
      105, 284, { align: 'center' }
    )
    doc.text(
      `Qualiopi ${ORGANISME.qualiopi} — ODPC ${ORGANISME.ndpc} — Document conservé 6 ans | Page ${i}/${pageCount}`,
      105, 289, { align: 'center' }
    )
  }

  return doc.output('blob')
}

/**
 * Helper pour générer le nom de fichier lors du téléchargement.
 */
export function getFormationPDFFilename(formationSlug: string): string {
  const dateStr = new Date().toISOString().split('T')[0]
  return `Attestation-Formation_${formationSlug}_${dateStr}.pdf`
}
