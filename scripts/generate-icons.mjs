/**
 * Génère toutes les icônes de l'app à partir d'un seul fichier source
 * (public/images/dentallearn-icon-source.png — symbole crowned-tooth, fond blanc).
 *
 * Usage : node scripts/generate-icons.mjs
 *
 * Sortie (racine /public) :
 *   - favicon-16x16.png, favicon-32x32.png        -> favicons
 *   - apple-touch-icon.png (180, fond blanc opaque) -> iOS / Safari
 *   - icon-192.png, icon-512.png                  -> manifest purpose "any"
 *   - icon-maskable-192.png, icon-maskable-512.png -> manifest purpose "maskable"
 *
 * Le fond est toujours blanc (jamais de couleur de marque codée en dur ici).
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'public/images/dentallearn-icon-source.png')
const OUT = path.join(root, 'public')
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 }

// Icônes "pleines" : resize + fond blanc opaque (flatten supprime toute transparence -> iOS)
const full = [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

// Maskable : symbole réduit à ~60% du canvas, centré sur blanc (safe zone Android,
// supprime le badge Google).
const maskable = [
  ['icon-maskable-192.png', 192],
  ['icon-maskable-512.png', 512],
]

async function run() {
  for (const [name, size] of full) {
    await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toFile(path.join(OUT, name))
    console.log('  generated', name, `(${size}x${size})`)
  }

  for (const [name, size] of maskable) {
    const inner = Math.round(size * 0.6)
    const padL = Math.round((size - inner) / 2)
    const padR = size - inner - padL
    await sharp(SRC)
      .resize(inner, inner, { fit: 'contain', background: WHITE })
      .extend({ top: padL, bottom: padR, left: padL, right: padR, background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toFile(path.join(OUT, name))
    console.log('  generated', name, `(${size}x${size}, symbole ~60%)`)
  }

  console.log('icons generated.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
