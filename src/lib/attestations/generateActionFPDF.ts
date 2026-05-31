import { ORGANISME, DENTALSCHOOL_ORGANISME } from './types'
import { axePdfRgb } from '../cp/axeColors'

/**
 * Snapshot d'une ressource cochée par le praticien au moment de la déclaration.
 * On fige le titre / source / type pour que l'attestation reste reproductible
 * même si la ressource est modifiée ou supprimée par l'admin ultérieurement.
 */
export interface ActionFRessourceSnapshot {
  ressource_id: string
  titre: string
  source: string
  type: 'internal' | 'external'
  categorie?: string
}

export interface ActionFAttestationData {
  participant: {
    nom_complet: string // "Dr LENFANT Benoit"
    rpps: string
    profession: string // "Chirurgien-dentiste"
  }
  declaration_date: string | Date // date de la déclaration (= ce jour)
  ressources: ActionFRessourceSnapshot[]
  verification_code: string // "DL-XXXXXX-XXXX"
  verify_url?: string // URL publique de vérification, ex. https://app/verify/DL-...
}

/**
 * Dérive le libellé « Type » du tableau à partir de la catégorie du snapshot.
 * Catégories connues axe 3 : « Information patient », « Consentements »,
 * « Conseils post-opératoires », « Référence ». Fallback : « Information ».
 */
function deriveType(categorie?: string): string {
  if (!categorie) return 'Information'
  const c = categorie.toLowerCase()
  if (c.includes('consentement')) return 'Consentement'
  if (c.includes('référence') || c.includes('reference')) return 'Référence'
  return 'Information'
}

/**
 * Génère un blob PDF pour une attestation de démarche d'information du patient
 * (Certification Périodique — Axe 3, Action F). Déclaration sur l'honneur :
 * pas de signature manuelle, le code de vérification fait foi.
 *
 * Style visuel jumeau de generateFormationPDF / generateEppPDF ; couleur de
 * base dérivée de l'axe CP (Axe 3 — orange, cf. src/lib/cp/axeColors),
 * jsPDF + jspdf-autotable, mêmes marges et pied de page.
 */
export async function generateActionFPDF(
  data: ActionFAttestationData
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Action F = Axe 3 (orange) — couleur dérivée de la palette CP (cf. src/lib/cp/axeColors).
  const base = axePdfRgb(3)
  const darkGray = [30, 30, 30] as [number, number, number]
  const lightGray = [245, 245, 245] as [number, number, number]

  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  // ── EN-TÊTE (Axe 3 — orange) ─────────────────────────────────
  doc.setFillColor(...base)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('DENTALSCHOOL — EROJU SAS', 105, 11, { align: 'center' })

  doc.setFontSize(12)
  doc.text("ATTESTATION DE DÉMARCHE D'INFORMATION DU PATIENT", 105, 20, {
    align: 'center',
  })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Certification Périodique — Axe 3 (Relation avec les patients) — Action F',
    105,
    27,
    { align: 'center' }
  )

  // ── BLOC IDENTITÉ ─────────────────────────────────────────────
  doc.setTextColor(...darkGray)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('IDENTITÉ DU PRATICIEN', 14, 47)
  doc.setDrawColor(...base)
  doc.setLineWidth(0.5)
  doc.line(14, 49, 196, 49)

  autoTable(doc, {
    startY: 52,
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
      ['Date de la déclaration', fmtDate(data.declaration_date)],
    ],
  })

  // ── CORPS — DÉCLARATION ───────────────────────────────────────
  const declY = (doc as any).lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const declaration =
    `Je soussigné(e) ${data.participant.nom_complet}, chirurgien-dentiste ` +
    `(RPPS ${data.participant.rpps}), atteste sur l'honneur, en application du ` +
    `référentiel de Certification Périodique (Axe 3 — Relation avec les patients, ` +
    `Action F : s'assurer de la bonne information du patient/usager à la fois sur ` +
    `ses droits, sa situation et sa sécurité), mettre à disposition de mes patients, ` +
    `à la date du ${fmtDate(data.declaration_date)}, les ressources d'information ` +
    `suivantes :`
  const declLines = doc.splitTextToSize(declaration, 182)
  doc.text(declLines, 14, declY)

  // ── TABLEAU DES RESSOURCES COCHÉES ────────────────────────────
  const tableY = declY + declLines.length * 4.5 + 4
  autoTable(doc, {
    startY: tableY,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: base,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 112 },
      1: { cellWidth: 38 },
      2: { cellWidth: 32 },
    },
    head: [['Titre', 'Source', 'Type']],
    body: data.ressources.map((r) => [
      r.titre,
      r.source,
      deriveType(r.categorie),
    ]),
  })

  // ── MENTION FINALE ────────────────────────────────────────────
  let mentionY = (doc as any).lastAutoTable.finalY + 8
  // Saut de page si la mention ne tient pas (listes longues).
  if (mentionY > 250) {
    doc.addPage()
    mentionY = 20
  }
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(90, 90, 90)
  const mention =
    `Cette déclaration constitue un élément de preuve volontaire au titre de la ` +
    `démarche de Certification Périodique. Elle ne remplace ni l'information orale ` +
    `délivrée individuellement à chaque patient, ni les obligations légales du ` +
    `chirurgien-dentiste (Code de la santé publique, articles L.1111-2 et suivants).`
  const mentionLines = doc.splitTextToSize(mention, 182)
  doc.text(mentionLines, 14, mentionY)

  // ── BLOC CODE DE VÉRIFICATION ─────────────────────────────────
  const codeY = mentionY + mentionLines.length * 3.8 + 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.text(`Fait à ${ORGANISME.ville}, le ${fmtDate(new Date())}`, 14, codeY)

  doc.setFontSize(8)
  doc.setTextColor(...base)
  doc.setFont('helvetica', 'bold')
  doc.text('Code de vérification :', 14, codeY + 7)
  doc.setFont('courier', 'normal')
  doc.text(data.verification_code, 60, codeY + 7)

  if (data.verify_url) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(90, 90, 90)
    doc.text(`Vérification publique : ${data.verify_url}`, 14, codeY + 12)
  }

  // ── PIED DE PAGE (bandeau Qualiopi / ODPC) ────────────────────
  const issuedAt = new Date().toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `${ORGANISME.nom_court} — ${ORGANISME.adresse} — SIRET ${ORGANISME.siret} — APE ${ORGANISME.ape}`,
      105,
      279,
      { align: 'center' }
    )
    doc.text(
      `Qualiopi ${ORGANISME.qualiopi} — ODPC ${ORGANISME.ndpc} — Document conservé 6 ans | Page ${i}/${pageCount}`,
      105,
      284,
      { align: 'center' }
    )
    doc.text(
      `Attestation générée le ${issuedAt} par ${DENTALSCHOOL_ORGANISME}.`,
      105,
      289,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

/**
 * Nom de fichier pour le téléchargement de l'attestation Action F.
 */
export function getActionFPDFFilename(): string {
  const dateStr = new Date().toISOString().split('T')[0]
  return `Attestation-Action-F_Information-patient_${dateStr}.pdf`
}
