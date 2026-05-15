import { NextRequest, NextResponse } from 'next/server'
import { requireFormateur } from '@/middleware'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BUCKET = 'profile-photos'
const MAX_SIZE = 2 * 1024 * 1024 // 2 Mo
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

// POST /api/formateur/profil/avatar
// Upload de la photo de profil vers Supabase Storage.
// Valide : JPEG/PNG, <= 2 Mo.
// Écrase le fichier existant (upsert: true, même chemin).
export async function POST(request: NextRequest) {
  const redirect = await requireFormateur(request)
  if (redirect) return redirect

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'FormData invalide' }, { status: 400 })
  }

  const file = formData.get('avatar') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Champ "avatar" requis' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Format non accepté. Utilisez JPEG ou PNG.' },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'Fichier trop volumineux. Taille maximale : 2 Mo.' },
      { status: 400 }
    )
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : 'png'
  const storagePath = `formateurs/${user.id}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const adminClient = createAdminClient()

  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Erreur upload Storage' }, { status: 500 })
  }

  const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(storagePath)
  const avatarUrl = urlData.publicUrl

  // Mettre à jour photo_pro_url dans formateur_profiles
  const { error: updateError } = await supabase
    .from('formateur_profiles')
    .update({ photo_pro_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Erreur mise à jour profil' }, { status: 500 })
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}
