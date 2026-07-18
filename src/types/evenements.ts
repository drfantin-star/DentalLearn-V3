export type EvenementItemData = {
  id: string
  type: 'presentiel' | 'virtuel'
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  duration_min: number | null
  location_city: string | null
  location_venue: string | null
  capacity: number | null
  external_registration_url: string | null
  category: string | null
  formateur_display_name: string | null
  formateur_slug: string | null
  formateur_photo_url: string | null
}
