export interface ThemeContent {
  type: string
  icon: string
  status: 'available' | 'coming'
  tag?: 'cp' | 'bonus'
  slug?: string
}

export interface Theme {
  id: string
  emoji: string
  title: string
  description: string
  color: string
  bgLight: string
  contents: ThemeContent[]
}
