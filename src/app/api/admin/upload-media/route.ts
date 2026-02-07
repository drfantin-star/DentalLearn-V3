import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'formations'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB (audio/video can be larger)
const ALLOWED_TYPES = [
  'audio/mpeg',       // MP3
  'audio/wav',        // WAV
  'audio/x-wav',      // WAV variant
  'audio/mp4',        // M4A
  'audio/x-m4a',      // M4A variant
  'audio/aac',        // AAC
  'video/mp4',        // MP4
  'video/webm',       // WebM
  'application/pdf',  // PDF
]
const ADMIN_EMAILS = ['drfantin@gmail.com']

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification admin
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 })
    }

    // Parser le FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const storagePath = formData.get('path') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    // Validation du type de fichier
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: 'Type de fichier non autorisé. Formats acceptés: MP3, WAV, M4A, MP4, WebM, PDF'
      }, { status: 400 })
    }

    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'Fichier trop volumineux. Taille maximale: 50MB'
      }, { status: 400 })
    }

    // Générer le chemin du fichier
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const timestamp = Date.now()
    const safeName = file.name
      .replace(/\.[^/.]+$/, '')  // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, '-')  // Sanitize
      .substring(0, 50)

    let filePath: string
    if (storagePath) {
      // Use provided path prefix (e.g., "eclaircissements/audio/")
      const cleanPath = storagePath.replace(/\/+$/, '') // Remove trailing slashes
      filePath = `${cleanPath}/${safeName}-${timestamp}.${fileExt}`
    } else {
      filePath = `misc/${safeName}-${timestamp}.${fileExt}`
    }

    // Upload vers Supabase Storage avec le client admin
    const adminClient = createAdminClient()
    const buffer = await file.arrayBuffer()

    const { data, error: uploadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
      console.error('Erreur upload Supabase:', uploadError)
      return NextResponse.json({
        error: 'Erreur lors de l\'upload: ' + uploadError.message
      }, { status: 500 })
    }

    // Générer l'URL publique
    const { data: publicUrl } = adminClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      url: publicUrl.publicUrl,
      path: data.path
    })

  } catch (error) {
    console.error('Erreur upload media:', error)
    return NextResponse.json({
      error: 'Erreur serveur lors de l\'upload'
    }, { status: 500 })
  }
}

// DELETE: Supprimer un fichier média
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 })
    }

    const { path } = await request.json()

    if (!path) {
      return NextResponse.json({ error: 'Chemin requis' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error: deleteError } = await adminClient.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (deleteError) {
      console.error('Erreur suppression:', deleteError)
      return NextResponse.json({
        error: 'Erreur lors de la suppression'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur suppression media:', error)
    return NextResponse.json({
      error: 'Erreur serveur lors de la suppression'
    }, { status: 500 })
  }
}
