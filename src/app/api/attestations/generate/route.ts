import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORGANISME = {
  nom_court: 'EROJU SAS — DENTALSCHOOL FORMATIONS',
  adresse: '76 BD MEUSNIER DE QUERLON, 44000 NANTES',
  tel: '07.84.56.01.06',
  email: 'info@dentalschool.fr',
  site: 'www.dentalschool.fr',
  siret: '95271921900018',
  ape: '8559A',
  capital: 'SASU au capital social de 1000€',
  ndpc: '9AGA',
  qualiopi: 'QUA006589',
  responsable: 'Dr Julie Fantin',
  ville: 'Nantes',
  comite_scientifique: 'Dr J. Fantin, Dr L. Elbeze, Dr A. Gaudin, Dr P. Bargman'
}

const COLORS = {
  primary: '#003366',
  text: '#222222',
  muted: '#555555',
  light: '#999999',
}

const AXE_LABELS: Record<number, string> = {
  1: 'Axe 1 — Actualiser les connaissances et compétences',
  2: 'Axe 2 — Renforcer la qualité des pratiques',
  3: 'Axe 3 — Améliorer la relation avec les patients',
  4: 'Axe 4 — Mieux prendre en compte sa santé personnelle',
}

function drawHeader(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, doc.page.width, 80).fill(COLORS.primary)
  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
     .text(ORGANISME.nom_court, 40, 22, { align: 'left' })
  doc.fontSize(9).font('Helvetica')
     .text(`N° Qualiopi : ${ORGANISME.qualiopi}  |  N° ODPC : ${ORGANISME.ndpc}`, 40, 52)
  doc.fillColor(COLORS.text)
}

function drawFooter(doc: PDFKit.PDFDocument, verificationCode: string) {
  const footerY = doc.page.height - 100
  doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY)
     .lineWidth(0.5).strokeColor(COLORS.light).stroke()
  doc.fillColor(COLORS.muted).fontSize(7).font('Helvetica')
     .text(`${ORGANISME.adresse}  |  Tél : ${ORGANISME.tel}  |  ${ORGANISME.email}  |  ${ORGANISME.site}`,
           40, footerY + 8, { align: 'center', width: doc.page.width - 80 })
  doc.text(`SIRET ${ORGANISME.siret}  |  APE ${ORGANISME.ape}  |  ${ORGANISME.capital}`,
           40, footerY + 22, { align: 'center', width: doc.page.width - 80 })
  doc.fillColor(COLORS.primary).fontSize(8).font('Helvetica-Bold')
     .text(`Code de vérification : ${verificationCode}`,
           40, footerY + 42, { align: 'center', width: doc.page.width - 80 })
  doc.fillColor(COLORS.light).fontSize(7).font('Helvetica-Oblique')
     .text('Document sécurisé conservé 6 ans conformément au référentiel de la Certification Périodique',
           40, footerY + 57, { align: 'center', width: doc.page.width - 80 })
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, y: number): number {
  doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
     .text(title.toUpperCase(), 40, y)
  doc.moveTo(40, y + 16).lineTo(doc.page.width - 40, y + 16)
     .lineWidth(1).strokeColor(COLORS.primary).stroke()
  return y + 24
}

function drawInfoRow(doc: PDFKit.PDFDocument, label: string, value: string, y: number): number {
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold')
     .text(label, 50, y, { width: 180, continued: false })
  doc.fillColor(COLORS.text).font('Helvetica')
     .text(value || '—', 230, y, { width: doc.page.width - 270 })
  return y + 18
}

function drawSignatureBlock(doc: PDFKit.PDFDocument, y: number): number {
  const signaturePath = path.join(process.cwd(), 'public', 'signature.png')
  const fmtDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Oblique')
     .text(`Fait à ${ORGANISME.ville}, le ${fmtDate}`, 40, y)
  y += 20
  if (fs.existsSync(signaturePath)) {
    doc.image(signaturePath, 40, y, { width: 280 })
    y += 170
  } else {
    doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-BoldOblique')
       .text('Dr Julie Fantin', 40, y + 20)
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
       .text('Responsable pédagogique', 40, y + 38)
    y += 80
  }
  return y
}

async function generateFormationPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 120, left: 40, right: 40 },
      info: {
        Title: `Attestation de formation — ${data.formation.title}`,
        Author: ORGANISME.nom_court,
      },
    })
    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    doc.registerFont('Helvetica', path.join(fontsDir, 'Inter-Regular.ttf'))
    doc.registerFont('Helvetica-Bold', path.join(fontsDir, 'Inter-Bold.ttf'))
    doc.registerFont('Helvetica-Oblique', path.join(fontsDir, 'Inter-Italic.ttf'))
    doc.registerFont('Helvetica-BoldOblique', path.join(fontsDir, 'Inter-Bold.ttf'))
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    drawHeader(doc)
    let y = 110
    doc.fillColor(COLORS.primary).fontSize(20).font('Helvetica-Bold')
       .text('ATTESTATION DE FORMATION CONTINUE', 40, y,
             { align: 'center', width: doc.page.width - 80 })
    y += 28
    doc.fillColor(COLORS.muted).fontSize(11).font('Helvetica-Oblique')
       .text('Parcours numérique en ligne — DentalLearn', 40, y,
             { align: 'center', width: doc.page.width - 80 })
    y += 30

    y = drawSectionTitle(doc, 'Participant', y)
    y = drawInfoRow(doc, 'Nom et prénom :', data.participant.nom_complet, y)
    y = drawInfoRow(doc, 'N° RPPS :', data.participant.rpps, y)
    y = drawInfoRow(doc, 'Profession :', data.participant.profession, y)
    y += 10

    y = drawSectionTitle(doc, 'Formation', y)
    y = drawInfoRow(doc, 'Intitulé :', data.formation.title, y)
    if (data.formation.axe_cp) {
      y = drawInfoRow(doc, 'Axe CP :', AXE_LABELS[data.formation.axe_cp] || `Axe ${data.formation.axe_cp}`, y)
    }
    const cnpText = data.formation.cnp_labellisation === 'labellisee'
      ? `Type ${data.formation.type_cnp} — labellisée CNP`
      : `Type ${data.formation.type_cnp} — labellisation CNP en cours`
    y = drawInfoRow(doc, 'Type action CNP :', cnpText, y)
    y = drawInfoRow(doc, 'Formateur :', data.formation.formateur, y)
    y = drawInfoRow(doc, 'Comité scientifique :', ORGANISME.comite_scientifique, y)
    y += 10

    y = drawSectionTitle(doc, 'Parcours pédagogique', y)
    const fmtD = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    y = drawInfoRow(doc, 'Période :', `Du ${fmtD(data.parcours.started_at)} au ${fmtD(data.parcours.completed_at)}`, y)
    y = drawInfoRow(doc, 'Durée :', `${data.parcours.duree_heures} heures (durée forfaitaire)`, y)
    y = drawInfoRow(doc, 'Séquences complétées :', `${data.parcours.nb_sequences} / ${data.parcours.nb_sequences_total}`, y)
    y = drawInfoRow(doc, 'Taux de réussite aux quiz :', `${data.parcours.taux_reussite_quiz.toFixed(1)} %`, y)
    y = drawInfoRow(doc, 'Taux de complétion :', `${data.parcours.taux_completion.toFixed(0)} %`, y)
    y += 15

    y = drawSectionTitle(doc, 'Attestation', y)
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica')
       .text(`Je soussignée, ${ORGANISME.responsable}, responsable pédagogique de ${ORGANISME.nom_court} (organisme enregistré ANDPC sous le n° ${ORGANISME.ndpc}, certifié Qualiopi n° ${ORGANISME.qualiopi}), atteste que ${data.participant.nom_complet} (N° RPPS ${data.participant.rpps}) a suivi et complété dans son intégralité la formation continue « ${data.formation.title} », d'une durée équivalente à ${data.parcours.duree_heures} heures, du ${fmtD(data.parcours.started_at)} au ${fmtD(data.parcours.completed_at)}.`,
             40, y, { width: doc.page.width - 80, align: 'justify', lineGap: 2 })
    y = doc.y + 10
    doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica-Oblique')
       .text(`L'assiduité est certifiée par les logs de traçabilité pédagogique conservés pendant 6 ans conformément au référentiel de la Certification Périodique.`,
             40, y, { width: doc.page.width - 80, align: 'justify' })
    y = doc.y + 20
    y = drawSignatureBlock(doc, y)
    drawFooter(doc, data.verification_code)
    doc.end()
  })
}

async function generateEppPDF(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 120, left: 40, right: 40 },
      info: {
        Title: `Attestation EPP — ${data.audit.title}`,
        Author: ORGANISME.nom_court,
      },
    })
    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    doc.registerFont('Helvetica', path.join(fontsDir, 'Inter-Regular.ttf'))
    doc.registerFont('Helvetica-Bold', path.join(fontsDir, 'Inter-Bold.ttf'))
    doc.registerFont('Helvetica-Oblique', path.join(fontsDir, 'Inter-Italic.ttf'))
    doc.registerFont('Helvetica-BoldOblique', path.join(fontsDir, 'Inter-Bold.ttf'))
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    drawHeader(doc)
    let y = 110
    doc.fillColor(COLORS.primary).fontSize(19).font('Helvetica-Bold')
       .text('ATTESTATION D\'ÉVALUATION DES PRATIQUES PROFESSIONNELLES', 40, y,
             { align: 'center', width: doc.page.width - 80 })
    y = doc.y + 8
    doc.fillColor(COLORS.muted).fontSize(11).font('Helvetica-Oblique')
       .text('Audit clinique conforme méthodologie HAS — DentalLearn', 40, y,
             { align: 'center', width: doc.page.width - 80 })
    y = doc.y + 20

    y = drawSectionTitle(doc, 'Participant', y)
    y = drawInfoRow(doc, 'Nom et prénom :', data.participant.nom_complet, y)
    y = drawInfoRow(doc, 'N° RPPS :', data.participant.rpps, y)
    y = drawInfoRow(doc, 'Profession :', data.participant.profession, y)
    y += 10

    y = drawSectionTitle(doc, 'Audit clinique', y)
    y = drawInfoRow(doc, 'Thématique :', data.audit.title, y)
    y = drawInfoRow(doc, 'Axe CP :', AXE_LABELS[2], y)
    y = drawInfoRow(doc, 'Type action CNP :', 'Type B — EPP / gestion des risques (labellisation CNP en cours)', y)
    y = drawInfoRow(doc, 'Méthodologie :', 'Audit clinique ciblé HAS — 2 tours comparatifs', y)
    y += 10

    y = drawSectionTitle(doc, 'Résultats de l\'audit', y)
    const fmtD = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    y = drawInfoRow(doc, 'Tour 1 — Date :', fmtD(data.tours.t1_completed_at), y)
    y = drawInfoRow(doc, 'Tour 1 — Dossiers :', `${data.tours.t1_nb_dossiers}`, y)
    y = drawInfoRow(doc, 'Tour 1 — Score :', `${data.tours.t1_score.toFixed(1)} %`, y)
    y += 4
    y = drawInfoRow(doc, 'Tour 2 — Date :', fmtD(data.tours.t2_completed_at), y)
    y = drawInfoRow(doc, 'Tour 2 — Dossiers :', `${data.tours.t2_nb_dossiers}`, y)
    y = drawInfoRow(doc, 'Tour 2 — Score :', `${data.tours.t2_score.toFixed(1)} %`, y)
    y += 4

    const deltaColor = data.tours.delta_score >= 0 ? '#10B981' : '#EF4444'
    const deltaSign = data.tours.delta_score >= 0 ? '+' : ''
    doc.fillColor(COLORS.muted).fontSize(9).font('Helvetica-Bold')
       .text('Delta T2 — T1 :', 50, y, { continued: true })
       .fillColor(deltaColor).font('Helvetica-Bold')
       .text(` ${deltaSign}${data.tours.delta_score.toFixed(1)} points`)
    y += 22

    y = drawInfoRow(doc, 'Durée équivalente :', `${data.audit.duree_forfaitaire} heures (durée forfaitaire)`, y)
    y += 15

    y = drawSectionTitle(doc, 'Attestation', y)
    doc.fillColor(COLORS.text).fontSize(10).font('Helvetica')
       .text(`Je soussignée, ${ORGANISME.responsable}, responsable pédagogique de ${ORGANISME.nom_court} (certifié Qualiopi n° ${ORGANISME.qualiopi}), atteste que ${data.participant.nom_complet} (N° RPPS ${data.participant.rpps}) a réalisé l'audit clinique EPP sur le thème « ${data.audit.title} », selon la méthodologie HAS en 2 tours comparatifs (T1 et T2), pour une durée équivalente de ${data.audit.duree_forfaitaire} heures.`,
             40, y, { width: doc.page.width - 80, align: 'justify', lineGap: 2 })
    y = doc.y + 20
    y = drawSignatureBlock(doc, y)
    drawFooter(doc, data.verification_code)
    doc.end()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, source_id } = body as { type: 'formation_online' | 'epp', source_id: string }

    if (!type || !source_id) {
      return NextResponse.json({ error: 'type et source_id requis' }, { status: 400 })
    }
    if (type !== 'formation_online' && type !== 'epp') {
      return NextResponse.json({ error: 'type invalide' }, { status: 400 })
    }

    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set() {},
          remove() {},
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('first_name, last_name, rpps, profession')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
    }

    if (!profile.rpps || profile.rpps.trim() === '') {
      return NextResponse.json({
        error: 'RPPS_MISSING',
        message: 'Votre numéro RPPS est requis pour générer l\'attestation.',
      }, { status: 400 })
    }

    const participant = {
      nom_complet: `Dr ${(profile.last_name || '').toUpperCase()} ${profile.first_name || ''}`.trim(),
      rpps: profile.rpps,
      profession: profile.profession || 'Chirurgien-dentiste',
    }

    const { data: existing } = await supabaseAdmin
      .from('user_attestations')
      .select('id, pdf_path, verification_code')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('source_id', source_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        already_exists: true,
        attestation_id: existing.id,
        pdf_path: existing.pdf_path,
        verification_code: existing.verification_code,
      })
    }

    const verificationCode = `DL-${Date.now().toString(36).toUpperCase().slice(-6)}-${Math.random().toString(36).toUpperCase().slice(-4)}`

    if (type === 'formation_online') {
      const { data: isComplete } = await supabaseAdmin.rpc('is_formation_fully_completed', {
        p_user_id: user.id, p_formation_id: source_id,
      })
      if (!isComplete) {
        return NextResponse.json({
          error: 'FORMATION_NOT_COMPLETED',
          message: 'Vous devez compléter 100% des séquences.',
        }, { status: 400 })
      }

      const { data: metrics, error: metricsErr } = await supabaseAdmin
        .rpc('get_formation_completion_metrics', {
          p_user_id: user.id, p_formation_id: source_id,
        })
        .single()
      if (metricsErr || !metrics) {
        return NextResponse.json({ error: 'Erreur métriques', detail: metricsErr }, { status: 500 })
      }

      const { data: formation } = await supabaseAdmin
        .from('formations')
        .select('title, axe_cp, instructor_name, cp_hours')
        .eq('id', source_id).single()
      if (!formation) {
        return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
      }

      const dureeHeures = formation.cp_hours || 6
      const typeCnpByAxe: Record<number, string> = { 1: 'D', 3: 'A', 4: 'A' }
      const typeCnp = typeCnpByAxe[formation.axe_cp || 1] || 'D'

      const m: any = metrics
      const pdfBuffer = await generateFormationPDF({
        participant,
        formation: {
          title: formation.title,
          axe_cp: formation.axe_cp,
          type_cnp: typeCnp,
          formateur: formation.instructor_name || ORGANISME.responsable,
          cnp_labellisation: 'en_cours',
        },
        parcours: {
          started_at: new Date(m.started_at || new Date()),
          completed_at: new Date(m.completed_at || new Date()),
          duree_heures: dureeHeures,
          nb_sequences: m.nb_sequences_done,
          nb_sequences_total: m.nb_sequences_total,
          taux_reussite_quiz: Number(m.taux_reussite_quiz || 0),
          taux_completion: Number(m.taux_completion || 0),
        },
        verification_code: verificationCode,
      })

      const pdfPath = `${user.id}/formation_online/${Date.now()}.pdf`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('attestations')
        .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false })
      if (uploadErr) {
        return NextResponse.json({ error: 'Upload échoué', detail: uploadErr }, { status: 500 })
      }

      const { data: attestation, error: insertErr } = await supabaseAdmin
        .from('user_attestations')
        .insert({
          user_id: user.id,
          type: 'formation_online',
          axe_cp: formation.axe_cp,
          type_action_cnp: typeCnp,
          cnp_labellisation: 'en_cours',
          source_id: source_id,
          title: formation.title,
          formateur: formation.instructor_name,
          comite_scientifique: ORGANISME.comite_scientifique,
          started_at: m.started_at,
          completed_at: m.completed_at,
          duree_heures: dureeHeures,
          taux_reussite_quiz: Number(m.taux_reussite_quiz || 0),
          taux_completion: Number(m.taux_completion || 0),
          nb_sequences: m.nb_sequences_done,
          nb_sequences_total: m.nb_sequences_total,
          pdf_path: pdfPath,
          verification_code: verificationCode,
        })
        .select().single()

      if (insertErr) {
        await supabaseAdmin.storage.from('attestations').remove([pdfPath])
        return NextResponse.json({ error: 'Insert DB échoué', detail: insertErr }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        attestation_id: attestation.id,
        pdf_path: pdfPath,
        verification_code: verificationCode,
      })
    }

    if (type === 'epp') {
      const { data: eppMetrics, error: eppErr } = await supabaseAdmin
        .rpc('get_epp_attestation_metrics', {
          p_user_id: user.id, p_audit_id: source_id,
        }).single()

      const em: any = eppMetrics
      if (eppErr || !em || !em.is_ready) {
        return NextResponse.json({
          error: 'EPP_NOT_COMPLETED',
          message: 'T1 et T2 doivent être complétés.',
        }, { status: 400 })
      }

      const pdfBuffer = await generateEppPDF({
        participant,
        audit: {
          title: em.audit_title,
          theme: em.audit_theme,
          duree_forfaitaire: Number(em.duree_forfaitaire || 6),
          duree_breakdown: em.duree_breakdown || {},
        },
        tours: {
          t1_completed_at: new Date(em.t1_completed_at),
          t1_nb_dossiers: em.t1_nb_dossiers,
          t1_score: Number(em.t1_score),
          t2_completed_at: new Date(em.t2_completed_at),
          t2_nb_dossiers: em.t2_nb_dossiers,
          t2_score: Number(em.t2_score),
          delta_score: Number(em.delta_score),
        },
        verification_code: verificationCode,
      })

      const pdfPath = `${user.id}/epp/${Date.now()}.pdf`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('attestations')
        .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false })
      if (uploadErr) {
        return NextResponse.json({ error: 'Upload échoué', detail: uploadErr }, { status: 500 })
      }

      const { data: attestation, error: insertErr } = await supabaseAdmin
        .from('user_attestations')
        .insert({
          user_id: user.id,
          type: 'epp',
          axe_cp: 2,
          type_action_cnp: 'B',
          cnp_labellisation: 'en_cours',
          source_id: source_id,
          title: em.audit_title,
          comite_scientifique: ORGANISME.comite_scientifique,
          completed_at: em.t2_completed_at,
          duree_heures: Number(em.duree_forfaitaire || 6),
          duree_breakdown: em.duree_breakdown,
          score_t1: Number(em.t1_score),
          score_t2: Number(em.t2_score),
          delta_score: Number(em.delta_score),
          nb_dossiers_t1: em.t1_nb_dossiers,
          nb_dossiers_t2: em.t2_nb_dossiers,
          pdf_path: pdfPath,
          verification_code: verificationCode,
        })
        .select().single()

      if (insertErr) {
        await supabaseAdmin.storage.from('attestations').remove([pdfPath])
        return NextResponse.json({ error: 'Insert DB échoué', detail: insertErr }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        attestation_id: attestation.id,
        pdf_path: pdfPath,
        verification_code: verificationCode,
      })
    }

    return NextResponse.json({ error: 'Type non géré' }, { status: 400 })
  } catch (err: any) {
    console.error('Attestation error:', err)
    return NextResponse.json({
      error: 'Erreur serveur',
      detail: err?.message || 'Unknown',
    }, { status: 500 })
  }
}
