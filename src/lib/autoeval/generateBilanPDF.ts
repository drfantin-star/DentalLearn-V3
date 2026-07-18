import type { AutoevalParticipant } from './generateAttestationPDF'
import type { AutoevalResults, BlockRecap } from './types'
import { axeHex, hexToRgb } from '@/lib/cp/axeColors'

const ROSE: [number, number, number] = hexToRgb(axeHex(4))

export interface BilanData {
  participant: AutoevalParticipant
  completedAt: string | Date
  blocks: BlockRecap[]
  results: AutoevalResults
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Bilan personnel téléchargeable (avec résultats). Généré 100 % côté client et
 * destiné à RESTER sur l'appareil du praticien — DentalLearn ne le conserve pas.
 */
export async function generateBilanPDF(data: BilanData): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const dark: [number, number, number] = [30, 30, 30]

  // En-tête
  doc.setFillColor(...ROSE)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.text('MON BILAN — Santé professionnelle', 105, 14, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${data.participant.nom_complet}  ·  ${fmtDate(data.completedAt)}`, 105, 22, { align: 'center' })

  // Disclaimer
  doc.setTextColor(...dark)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text(
    doc.splitTextToSize(
      "Ce bilan est un miroir, pas un diagnostic. Vos réponses ne sont pas conservées sur nos serveurs et ne sont partagées avec personne — ni Ordre, ni employeur.",
      182
    ),
    14,
    40
  )

  let y = 54
  const PAGE_BOTTOM = 280
  const ensure = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = 20
    }
  }

  type Part = { txt: string; bold?: boolean; size?: number }
  const partHeight = (p: Part) => doc.splitTextToSize(p.txt, 182).length * 5 + 2
  const drawPart = (p: Part) => {
    doc.setFont('helvetica', p.bold ? 'bold' : 'normal')
    doc.setFontSize(p.size ?? 9)
    doc.setTextColor(...dark)
    const lines = doc.splitTextToSize(p.txt, 182)
    doc.text(lines, 14, y)
    y += lines.length * 5 + 2
  }
  // Dessine un groupe de lignes d'un seul tenant : si le groupe ne tient pas dans
  // l'espace restant, on saute la page AVANT (évite qu'une carte soit coupée).
  const group = (parts: Part[]) => {
    const total = parts.reduce((acc, p) => acc + partHeight(p), 0)
    ensure(total)
    parts.forEach(drawPart)
  }
  const heading = (txt: string) => {
    ensure(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...ROSE)
    doc.text(txt, 14, y)
    doc.setDrawColor(...ROSE)
    doc.setLineWidth(0.4)
    doc.line(14, y + 2, 196, y + 2)
    y += 8
    doc.setTextColor(...dark)
  }

  // Blocs
  for (const block of data.blocks) {
    heading(block.titre)
    if (block.cbi) {
      for (const sub of block.cbi) {
        const parts: Part[] = [{ txt: `${sub.label} — ${sub.bandLabel} (${sub.score}/100)`, bold: true }]
        if (sub.message) parts.push({ txt: sub.message })
        group(parts)
      }
    } else if (block.reflexif) {
      const palierLabel =
        block.reflexif.palier === 'rouge'
          ? 'À surveiller'
          : block.reflexif.palier === 'orange'
            ? 'Vigilance'
            : 'Équilibre'
      const parts: Part[] = [{ txt: `${palierLabel} (${block.reflexif.percent}%)`, bold: true }]
      if (block.reflexif.message) parts.push({ txt: block.reflexif.message })
      group(parts)
    } else if (block.substancesNeutralMessage) {
      group([{ txt: block.substancesNeutralMessage }])
    }
    y += 2
  }

  // Top 3
  if (data.results.topPreoccupations.length) {
    heading('Points qui ressortent')
    data.results.topPreoccupations.forEach((p, i) => group([{ txt: `${i + 1}. ${p.label}` }]))
    y += 2
  }

  // Carte ressource = boîte bordée, hauteur dérivée du nombre RÉEL de lignes
  // wrappées (mesure = dessin : même pas vertical), avec padding bas inclus pour
  // que la dernière ligne tienne en entier. Largeur de wrap = largeur interne
  // moins paddings (et colonne icône pour la pastille SPS).
  const drawResourceCard = (c: { title: string; body: string; phone?: string }) => {
    const boxX = 14
    const boxW = 182
    const padX = 5
    const padTop = 5
    const padBot = 4
    const ascent = 3.5
    const titleStep = 5
    const gap = 1.5
    const bodyStep = 4.6
    const phoneStep = 6
    const hasPhone = !!c.phone
    const iconCol = hasPhone ? 11 : 0
    const textX = boxX + padX + iconCol
    const textW = boxW - padX * 2 - iconCol

    // Mesure sur la largeur EXACTE de la zone de texte (paddings + colonne icône).
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const titleLines: string[] = doc.splitTextToSize(c.title, textW)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const bodyLines: string[] = doc.splitTextToSize(c.body, textW)

    const consumed =
      titleLines.length * titleStep + gap + bodyLines.length * bodyStep + (hasPhone ? phoneStep : 0)
    const boxH = padTop + consumed + padBot

    ensure(boxH + 3)

    // Boîte
    doc.setDrawColor(228, 228, 228)
    doc.setFillColor(250, 250, 250)
    doc.setLineWidth(0.3)
    doc.roundedRect(boxX, y, boxW, boxH, 2.5, 2.5, 'FD')

    // Pastille (cartes avec téléphone, ex. SPS) — vectoriel, pas de glyphe ☎.
    if (hasPhone) {
      doc.setFillColor(...ROSE)
      doc.circle(boxX + padX + 4, y + padTop + 3.2, 3.2, 'F')
    }

    // Texte ligne par ligne : même pas vertical que la mesure → jamais coupé.
    let ty = y + padTop + ascent
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...dark)
    for (const l of titleLines) {
      doc.text(l, textX, ty)
      ty += titleStep
    }
    ty += gap
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    for (const l of bodyLines) {
      doc.text(l, textX, ty)
      ty += bodyStep
    }
    if (c.phone) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...ROSE)
      doc.text(c.phone, textX, ty + 1)
    }

    y += boxH + 3
    doc.setTextColor(...dark)
  }

  // Ressources — chaque carte est insécable et dimensionnée à son contenu.
  if (data.results.cards.length) {
    heading('Ressources utiles')
    for (const c of data.results.cards) {
      drawResourceCard({ title: c.title, body: c.body, phone: c.phone })
    }
  }

  // Clôture
  ensure(16)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...ROSE)
  doc.text(
    doc.splitTextToSize(
      "Prendre soin de soi est la première condition de soins de qualité. Vous venez de faire un pas — c'est déjà ça.",
      182
    ),
    14,
    y + 4
  )

  // Pied de page
  const pageCount = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Document personnel généré sur votre appareil — non conservé par Certily | Page ${i}/${pageCount}`,
      105,
      290,
      { align: 'center' }
    )
  }

  return doc.output('blob')
}

export function getBilanFilename(): string {
  const dateStr = new Date().toISOString().split('T')[0]
  return `Mon-Bilan-Sante_${dateStr}.pdf`
}
