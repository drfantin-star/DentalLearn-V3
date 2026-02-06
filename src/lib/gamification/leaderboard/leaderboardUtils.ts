// Génère un pseudo anonyme déterministe à partir d'un user_id
const adjectives = [
  'Brave', 'Agile', 'Vif', 'Malin', 'Sage',
  'Rusé', 'Fort', 'Rapide', 'Calme', 'Fier',
  'Juste', 'Noble', 'Doux', 'Fin', 'Grand',
]

const animals = [
  'Renard', 'Aigle', 'Loup', 'Dauphin', 'Lion',
  'Faucon', 'Ours', 'Tigre', 'Cerf', 'Lynx',
  'Panda', 'Koala', 'Hibou', 'Phénix', 'Dragon',
]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export function getAnonymousUsername(userId: string): string {
  const hash = hashCode(userId)
  const adj = adjectives[hash % adjectives.length]
  const animal = animals[(hash >> 4) % animals.length]
  return `${adj} ${animal}`
}
