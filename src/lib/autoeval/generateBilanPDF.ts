import type { AutoevalParticipant } from './generateAttestationPDF'
import type { AutoevalResults, BlockRecap } from './types'

const ROSE: [number, number, number] = [236, 72, 153] // #EC4899

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
  const ensure = (needed: number) => {
    if (y + needed > 280) {
      doc.addPage()
      y = 20
    }
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
  const line = (txt: string, bold = false, size = 9) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(txt, 182)
    ensure(lines.length * 5 + 2)
    doc.text(lines, 14, y)
    y += lines.length * 5 + 2
  }

  // Blocs
  for (const block of data.blocks) {
    heading(block.titre)
    if (block.cbi) {
      for (const sub of block.cbi) {
        line(`${sub.label} — ${sub.bandLabel} (${sub.score}/100)`, true)
        if (sub.message) line(sub.message)
      }
    } else if (block.reflexif) {
      const palierLabel =
        block.reflexif.palier === 'rouge'
          ? 'À surveiller'
          : block.reflexif.palier === 'orange'
            ? 'Vigilance'
            : 'Équilibre'
      line(`${palierLabel} (${block.reflexif.percent}%)`, true)
      if (block.reflexif.message) line(block.reflexif.message)
    } else if (block.substancesNeutralMessage) {
      line(block.substancesNeutralMessage)
    }
    y += 2
  }

  // Top 3
  if (data.results.topPreoccupations.length) {
    heading('Points qui ressortent')
    data.results.topPreoccupations.forEach((p, i) => line(`${i + 1}. ${p.label}`))
    y += 2
  }

  // Ressources
  if (data.results.cards.length) {
    heading('Ressources utiles')
    for (const c of data.results.cards) {
      line(c.title, true)
      line(c.body + (c.phone ? `  ☎ ${c.phone}` : ''))
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
      `Document personnel généré sur votre appareil — non conservé par DentalLearn | Page ${i}/${pageCount}`,
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
