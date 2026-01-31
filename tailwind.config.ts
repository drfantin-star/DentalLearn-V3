import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dentalschool Brand
        'ds-turquoise': '#00D1C1',
        'ds-turquoise-dark': '#00B8A9',
        'ds-blue': '#2D1B96',
        'ds-blue-dark': '#1A0F5C',
        // Axes
        'axe1': '#2D1B96',
        'axe2': '#00D1C1',
        'axe3': '#F59E0B',
        'axe4': '#EC4899',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
