import { ORGANISME } from '@/lib/attestations/types'

export interface AutoevalParticipant {
  nom_complet: string // "Dr NOM Prénom"
  rpps: string
  profession: string
}

const ROSE: [number, number, number] = [236, 72, 153] // #EC4899

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Attestation de RÉALISATION de l'auto-évaluation santé (Axe 4 — Action B).
 * Nom + date, SANS aucun résultat (décision RGPD). Générée 100 % côté client :
 * aucun upload Storage, aucune écriture user_attestations.
 */
export async function generateAttestationPDF(
  participant: AutoevalParticipant,
  completedAt: string | Date
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const dark: [number, number, number] = [30, 30, 30]

  // En-tête rose
  doc.setFillColor(...ROSE)
  doc.rect(0, 0, 210, 35, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('DENTALLEARN', 105, 13, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('ATTESTATION DE RÉALISATION', 105, 21, { align: 'center' })
  doc.setFontSize(9)
  doc.text("Axe 4 — Action B : auto-évaluation de la santé du praticien", 105, 28, { align: 'center' })

  // Corps
  doc.setTextColor(...dark)
  doc.setFontSize(10)
  const intro =
    `Le praticien soussigné atteste avoir réalisé l'auto-évaluation de sa santé ` +
    `professionnelle proposée par Certily, dans le cadre de l'Action B de l'Axe 4 ` +
    `de la Certification Périodique des chirurgiens-dentistes.`
  doc.text(doc.splitTextToSize(intro, 182), 14, 50)

  // Identification
  doc.setFont('helvetica', 'bold')
  doc.text('IDENTIFICATION', 14, 72)
  doc.setDrawColor(...ROSE)
  doc.setLineWidth(0.5)
  doc.line(14, 74, 196, 74)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const rows: [string, string][] = [
    ['Nom et prénom', participant.nom_complet],
    ['N° RPPS', participant.rpps || '—'],
    ['Profession', participant.profession || 'Chirurgien-dentiste'],
    ['Date de réalisation', fmtDate(completedAt)],
  ]
  let y = 82
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'bold')
    doc.text(k, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(v, 80, y)
    y += 8
  })

  // Mention RGPD
  doc.setFillColor(252, 231, 243) // rose pâle
  doc.roundedRect(14, y + 4, 182, 20, 3, 3, 'F')
  doc.setTextColor(...ROSE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Confidentialité', 20, y + 12)
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    doc.splitTextToSize(
      "Cette attestation ne comporte aucun résultat. Les réponses au questionnaire ne sont pas conservées par Certily.",
      170
    ),
    20,
    y + 17
  )

  // Pied de page
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Fait à ${ORGANISME.ville}, le ${fmtDate(new Date())}`, 14, 270)
  doc.text(
    `${ORGANISME.nom_court} — ${ORGANISME.adresse} — SIRET ${ORGANISME.siret}`,
    105,
    284,
    { align: 'center' }
  )

  return doc.output('blob')
}

export function getAttestationFilename(): string {
  const dateStr = new Date().toISOString().split('T')[0]
  return `Attestation-AutoEvaluation-Sante_${dateStr}.pdf`
}
