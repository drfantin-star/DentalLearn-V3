// ============================================================================
// Génération PDF — Comparatif Tour 1 / Tour 2 (référentiel HAS §7.2)
// ----------------------------------------------------------------------------
// Même pattern que generatePlanActionsPDF.ts (jsPDF + jspdf-autotable en
// import dynamique) pour rester cohérent avec le reste du module EPP.
// ============================================================================

export interface ComparisonPdfCriterion {
  code: string
  type: string
  label: string
  t1Pct: number | null
  t2Pct: number | null
}

export interface ComparisonPdfInput {
  audit: { title: string; slug: string }
  scoreT1: number
  scoreT2: number
  nbDossiersT1: number | null
  nbDossiersT2: number | null
  eppValidated: boolean
  criteria: ComparisonPdfCriterion[]
}

export async function generateComparisonPDF(input: ComparisonPdfInput): Promise<void> {
  const { audit, scoreT1, scoreT2, nbDossiersT1, nbDossiersT2, eppValidated, criteria } = input
  const deltaGlobal = scoreT2 - scoreT1

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const teal = [15, 123, 108] as [number, number, number]
  const darkGray = [30, 30, 30] as [number, number, number]
  const lightGray = [245, 245, 245] as [number, number, number]
  const green = [22, 163, 74] as [number, number, number]
  const red = [220, 38, 38] as [number, number, number]
  const orange = [217, 119, 6] as [number, number, number]

  // ── EN-TÊTE ──────────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('CERTILY — EROJU SAS', 105, 10, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('COMPARATIF TOUR 1 / TOUR 2 — ÉVALUATION DES PRATIQUES PROFESSIONNELLES',
    105, 18, { align: 'center' })
  doc.text('Axe 2 — Certification Périodique | Méthodologie HAS',
    105, 24, { align: 'center' })

  // ── IDENTIFICATION + SCORES GLOBAUX ──────────────────────────
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('SCORES GLOBAUX', 14, 38)

  doc.setDrawColor(...teal)
  doc.setLineWidth(0.5)
  doc.line(14, 40, 196, 40)

  const deltaColor = deltaGlobal >= 0 ? green : red
  const deltaStr = `${deltaGlobal >= 0 ? '+' : ''}${deltaGlobal.toFixed(0)}%`

  autoTable(doc, {
    startY: 43,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: lightGray },
      1: { cellWidth: 127 },
    },
    body: [
      ['Thématique / Audit', audit.title],
      ['Dossiers T1', `${nbDossiersT1 ?? '—'} dossiers`],
      ['Dossiers T2', `${nbDossiersT2 ?? '—'} dossiers`],
      ['Score global T1', `${scoreT1.toFixed(0)}%`],
      ['Score global T2', `${scoreT2.toFixed(0)}%`],
      ['Amélioration T1 → T2', deltaStr],
      ['Organisme', 'EROJU SAS — Certification Qualiopi N° QUA006589 — NDA : 52441046544'],
    ],
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.row.index === 5 && data.column.index === 1) {
        data.cell.styles.textColor = deltaColor
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  // ── CRITÈRES DE VALIDATION EPP (§7.3) ─────────────────────────
  const currentY0 = (doc as any).lastAutoTable.finalY + 6
  doc.setFillColor(...(eppValidated ? [220, 252, 231] : [255, 237, 213]))
  doc.roundedRect(14, currentY0, 182, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...(eppValidated ? green : orange))
  const validationText = eppValidated
    ? 'Critères de validation EPP remplis (amélioration du score global, ou score déjà élevé et maintenu).'
    : 'Critères de validation EPP non remplis (score non amélioré et non déjà élevé).'
  doc.text(validationText, 105, currentY0 + 7.5, { align: 'center' })

  // ── TABLEAU COMPARATIF PAR CRITÈRE ────────────────────────────
  const currentY1 = currentY0 + 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.text('DÉTAIL PAR CRITÈRE — T1 vs T2', 14, currentY1)
  doc.line(14, currentY1 + 2, 196, currentY1 + 2)

  const rows = criteria.map(c => {
    const delta = (c.t1Pct !== null && c.t2Pct !== null) ? c.t2Pct - c.t1Pct : null
    const statut = delta === null ? '—' : delta > 0 ? 'Amélioré' : delta === 0 ? 'Stable' : 'Dégradé'
    return {
      code: c.code,
      type: c.type,
      label: c.label,
      t1: c.t1Pct !== null ? `${c.t1Pct}%` : 'N/A',
      t2: c.t2Pct !== null ? `${c.t2Pct}%` : 'N/A',
      delta,
      statut,
    }
  })

  autoTable(doc, {
    startY: currentY1 + 5,
    margin: { left: 14, right: 14 },
    theme: 'striped',
    headStyles: { fillColor: teal, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 10 },
      2: { cellWidth: 82 },
      3: { cellWidth: 16, halign: 'center' as const },
      4: { cellWidth: 16, halign: 'center' as const },
      5: { cellWidth: 16, halign: 'center' as const },
      6: { cellWidth: 30, halign: 'center' as const },
    },
    head: [['N°', 'Type', 'Critère', 'T1', 'T2', 'Δ', 'Statut']],
    body: rows.map(r => [
      r.code, r.type, r.label, r.t1, r.t2,
      r.delta !== null ? `${r.delta >= 0 ? '+' : ''}${r.delta}%` : '—',
      r.statut,
    ]),
    didParseCell: (data: any) => {
      if (data.section === 'body' && (data.column.index === 5 || data.column.index === 6)) {
        const delta = rows[data.row.index]?.delta
        if (delta !== null && delta !== undefined) {
          data.cell.styles.textColor = delta > 0 ? green : delta === 0 ? orange : red
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  // ── PIED DE PAGE ─────────────────────────────────────────────
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `CERTILY — EROJU SAS — Qualiopi QUA006589 — NDA 52441046544 — Document généré le ${new Date().toLocaleDateString('fr-FR')} — Page ${i}/${pageCount}`,
      105, 290, { align: 'center' }
    )
  }

  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`Comparatif-T1-T2-EPP_${audit.slug}_${dateStr}.pdf`)
}
