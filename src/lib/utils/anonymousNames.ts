// Générateur de noms anonymes fun pour le leaderboard
// Utilise l'userId pour générer un nom cohérent (même user = même nom)

const adjectives = [
  // Gaming / Cool
  'Swift', 'Clever', 'Brave', 'Lucky', 'Mighty', 'Cosmic', 'Turbo', 'Ninja',
  'Epic', 'Super', 'Mega', 'Ultra', 'Pixel', 'Cyber', 'Neon', 'Astro',
  'Hyper', 'Atomic', 'Thunder', 'Flash', 'Storm', 'Blaze', 'Shadow', 'Stealth',
  'Golden', 'Silver', 'Crystal', 'Mystic', 'Phantom', 'Sonic', 'Rocket', 'Laser',
  // Fun / Positif
  'Happy', 'Sunny', 'Chill', 'Zen', 'Groovy', 'Funky', 'Sparkly', 'Shiny',
  'Jolly', 'Snappy', 'Zippy', 'Peppy', 'Bouncy', 'Fizzy', 'Breezy', 'Cozy',
  // Dentaire (clin d'œil)
  'Bright', 'Pearl', 'Minty', 'Fresh', 'Clean', 'Polished', 'Gleaming', 'Radiant'
];

const nouns = [
  // Animaux cool
  'Fox', 'Wolf', 'Eagle', 'Tiger', 'Panda', 'Dragon', 'Phoenix', 'Shark',
  'Lion', 'Bear', 'Falcon', 'Lynx', 'Jaguar', 'Cobra', 'Raven', 'Orca',
  'Panther', 'Hawk', 'Dolphin', 'Koala', 'Owl', 'Leopard', 'Husky', 'Raccoon',
  // Fantastique
  'Unicorn', 'Griffin', 'Pegasus', 'Sphinx', 'Kraken', 'Yeti', 'Hydra', 'Chimera',
  // Espace / Tech
  'Comet', 'Meteor', 'Nova', 'Pulsar', 'Quasar', 'Nebula', 'Orbit', 'Galaxy',
  // Dentaire (clin d'œil fun)
  'Molar', 'Canine', 'Incisor', 'Bicuspid', 'Crown', 'Flosser', 'Brusher', 'Smile'
];

export function getAnonymousName(userId: string): string {
  // Hash simple basé sur l'userId pour avoir un nom cohérent
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const adjective = adjectives[hash % adjectives.length];
  const noun = nouns[(hash * 7) % nouns.length];
  const number = (hash % 99) + 1;

  return `${adjective}${noun}${number}`;
}

export function getAnonymousAvatar(userId: string): string {
  // Génère une couleur de fond cohérente basée sur l'userId
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500',
    'bg-rose-500'
  ];

  return colors[hash % colors.length];
}

export function getAnonymousEmoji(userId: string): string {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const emojis = [
    '🦊', '🐺', '🦅', '🐯', '🐼', '🐉', '🦁', '🐻', '🦈', '🐬',
    '🦉', '🐆', '🦄', '🚀', '⭐', '🌟', '💫', '✨', '🔥', '💎',
    '🦷', '😁', '🪥', '✨'
  ];

  return emojis[hash % emojis.length];
}
