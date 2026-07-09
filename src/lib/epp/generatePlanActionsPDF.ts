// ============================================================================
// Génération PDF — Plan d'actions d'amélioration EPP (Tour 1)
// ----------------------------------------------------------------------------
// Logique extraite de src/app/(app)/formation/[theme]/epp/page.tsx afin d'être
// réutilisable depuis « Ma Certif → Mes attestations et documents » (re-
// téléchargement d'un plan sauvegardé) sans dupliquer le rendu.
// ============================================================================

export interface PlanActionsCriterion {
  id: string
  code: string
  type: string
  label: string
}

export interface PlanActionsSuggestion {
  id: string
  text: string
}

export interface PlanActionsPdfInput {
  audit: { title: string; slug: string }
  t1Session: {
    completed_at: string | null
    nb_dossiers: number | null
    score_global: number | null
  }
  /** Critères de l'audit, dans l'ordre d'affichage. */
  criteria: PlanActionsCriterion[]
  /** responses[dossierNumber][criterionId] = 'oui' | 'non' | 'na' */
  responses: Record<string, Record<string, 'oui' | 'non' | 'na'>>
  /** suggestions[criterionId] = liste des suggestions d'amélioration */
  suggestions: Record<string, PlanActionsSuggestion[]>
  /** planActions[criterionCode] = texte d'action corrective libre */
  planActions: Record<string, string>
  /** checkedSuggestions[criterionCode] = ids de suggestions cochées */
  checkedSuggestions: Record<string, string[]>
}

export async function generatePlanActionsPDF(input: PlanActionsPdfInput): Promise<void> {
  const {
    audit,
    t1Session,
    criteria,
    responses,
    suggestions,
    planActions,
    checkedSuggestions,
  } = input

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const teal = [15, 123, 108] as [number, number, number]
  const darkGray = [30, 30, 30] as [number, number, number]
  const lightGray = [245, 245, 245] as [number, number, number]

  // ── EN-TÊTE ──────────────────────────────────────────────────
  doc.setFillColor(...teal)
  doc.rect(0, 0, 210, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('DENTALSCHOOL — EROJU SAS', 105, 10, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('PLAN D\'ACTIONS D\'AMÉLIORATION — ÉVALUATION DES PRATIQUES PROFESSIONNELLES',
    105, 18, { align: 'center' })
  doc.text('Axe 2 — Certification Périodique | Méthodologie HAS',
    105, 24, { align: 'center' })

  // ── IDENTIFICATION ────────────────────────────────────────────
  doc.setTextColor(...darkGray)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('IDENTIFICATION DE L\'AUDIT', 14, 38)

  doc.setDrawColor(...teal)
  doc.setLineWidth(0.5)
  doc.line(14, 40, 196, 40)

  autoTable(doc, {
    startY: 43,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, fillColor: lightGray },
      1: { cellWidth: 127 }
    },
    body: [
      ['Thématique / Audit', audit.title],
      ['Date Tour 1', t1Session?.completed_at
        ? new Date(t1Session.completed_at).toLocaleDateString('fr-FR')
        : '—'],
      ['Dossiers évalués', `${t1Session?.nb_dossiers || '—'} dossiers`],
      ['Score global T1', `${t1Session?.score_global?.toFixed(0) || '—'}%`],
      ['Organisme', 'EROJU SAS — Certification Qualiopi N° QUA006589 — NDA : 52441046544'],
    ]
  })

  // ── RÉSULTATS PAR CRITÈRE ────────────────────────────────────
  const currentY1 = (doc as any).lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('RÉSULTATS PAR CRITÈRE', 14, currentY1)
  doc.line(14, currentY1 + 2, 196, currentY1 + 2)

  const statsForPDF = criteria.map(c => {
    let oui = 0, non = 0, na = 0
    Object.values(responses).forEach((dossier: any) => {
      const r = dossier[c.id]
      if (r === 'oui') oui++
      else if (r === 'non') non++
      else if (r === 'na') na++
    })
    const pct = oui + non > 0 ? Math.round((oui / (oui + non)) * 100) : null
    return { code: c.code, type: c.type, label: c.label, oui, non, na, pct }
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
      2: { cellWidth: 100 },
      3: { cellWidth: 14, halign: 'center' as const },
      4: { cellWidth: 14, halign: 'center' as const },
      5: { cellWidth: 12, halign: 'center' as const },
      6: { cellWidth: 20, halign: 'center' as const },
    },
    head: [['N°', 'Type', 'Critère', 'OUI', 'NON', 'NA', 'Conformité']],
    body: statsForPDF.map(c => [
      c.code, c.type, c.label, c.oui, c.non, c.na,
      c.pct !== null ? `${c.pct}%` : 'N/A'
    ]),
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 6) {
        const pct = statsForPDF[data.row.index]?.pct
        if (pct !== null && pct !== undefined) {
          if (pct >= 80) data.cell.styles.textColor = [22, 163, 74]
          else if (pct >= 60) data.cell.styles.textColor = [217, 119, 6]
          else data.cell.styles.textColor = [220, 38, 38]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    }
  })

  // ── PLAN D'ACTIONS ───────────────────────────────────────────
  const currentY2 = (doc as any).lastAutoTable.finalY + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('PLAN D\'ACTIONS D\'AMÉLIORATION', 14, currentY2)
  doc.line(14, currentY2 + 2, 196, currentY2 + 2)

  const planRows: string[][] = []

  criteria
    .filter(c => {
      const stat = statsForPDF.find(s => s.code === c.code)
      return stat?.pct !== null && stat!.pct! < 80
    })
    .sort((a, b) => {
      const pa = statsForPDF.find(s => s.code === a.code)?.pct || 0
      const pb = statsForPDF.find(s => s.code === b.code)?.pct || 0
      return pa - pb
    })
    .forEach(c => {
      const stat = statsForPDF.find(s => s.code === c.code)

      const criterionSuggestions = suggestions[c.id] || []
      const checkedIds = checkedSuggestions[c.code] || []
      const checkedTexts = criterionSuggestions
        .filter(s => checkedIds.includes(s.id))
        .map(s => `• ${s.text}`)

      const freeText = planActions[c.code]
        ? [`→ ${planActions[c.code]}`]
        : []

      const allActions = [...checkedTexts, ...freeText]
      const actionsText = allActions.length > 0
        ? allActions.join('\n')
        : 'Aucune action définie'

      planRows.push([
        `${c.code}\n${stat?.pct ?? '—'}%`,
        c.label,
        actionsText
      ])
    })

  if (planRows.length > 0) {
    autoTable(doc, {
      startY: currentY2 + 5,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center' as const, fontStyle: 'bold' },
        1: { cellWidth: 80 },
        2: { cellWidth: 84 },
      },
      head: [['Critère', 'Libellé', 'Actions correctives prévues']],
      body: planRows
    })
  }

  // ── PIED DE PAGE ─────────────────────────────────────────────
  const pageCount = (doc as any).getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `EROJU SAS — Qualiopi QUA006589 — NDA 52441046544 — Document généré le ${new Date().toLocaleDateString('fr-FR')} — Page ${i}/${pageCount}`,
      105, 290, { align: 'center' }
    )
  }

  const dateStr = new Date().toISOString().split('T')[0]
  doc.save(`Plan-Actions-EPP_${audit.slug}_${dateStr}.pdf`)
}
