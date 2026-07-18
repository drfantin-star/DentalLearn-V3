export type EvenementItemData = {
  id: string
  type: 'presentiel' | 'virtuel'
  title: string
  starts_at: string
  category: string | null
  formateur_display_name: string | null
  formateur_slug: string | null
  formateur_photo_url: string | null
}
