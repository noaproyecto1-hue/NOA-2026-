/** @type {import('tailwindcss').Config} */
//
// NOA · Design System v1.0 · 2026 — tokens expuestos como utilidades Tailwind.
// Para el bundle completo de variables CSS y clases componentes, ver src/index.css.
//
// ── Brand Book (CAMBIOS_REV4): el navy domina y el púrpura/rosa están PROHIBIDOS. ──
// Las familias decorativas fuera de marca (purple, violet, indigo, fuchsia, pink) se
// remapean globalmente a esta escala navy, conservando la luminosidad de cada tono
// (50 = claro … 950 = navy oscuro) para no romper contraste ni layouts. Así cualquier
// `purple-600`, `from-indigo-900`, `bg-pink-50`, etc. de todo el frontend pasa a navy
// sin tocar los componentes. Verde/rojo/ámbar/azul se conservan: son el semáforo NOA.
const NAVY_SCALE = {
  50:  '#F3F5F9',
  100: '#E4E9F1',
  200: '#C9D2E1',
  300: '#A3B1C9',
  400: '#6E81A1',
  500: '#47587A',
  600: '#324367',
  700: '#233152',
  800: '#16223F',
  900: '#0C1B33',
  950: '#070F1F',
};

module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
  			sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
  			mono:    ['"DM Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
  		},
  		fontSize: {
  			// Escala NOA (px)
  			'noa-xs':   ['11px', { lineHeight: '1.4' }],
  			'noa-sm':   ['13px', { lineHeight: '1.5' }],
  			'noa-base': ['15px', { lineHeight: '1.6' }],
  			'noa-md':   ['17px', { lineHeight: '1.65' }],
  			'noa-lg':   ['20px', { lineHeight: '1.5' }],
  			'noa-xl':   ['24px', { lineHeight: '1.4' }],
  			'noa-2xl':  ['30px', { lineHeight: '1.25' }],
  			'noa-3xl':  ['36px', { lineHeight: '1.2' }],
  			'noa-4xl':  ['48px', { lineHeight: '1.1' }],
  			'noa-5xl':  ['60px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
  		},
  		spacing: {
  			'noa-1':  '4px',
  			'noa-2':  '8px',
  			'noa-3':  '12px',
  			'noa-4':  '16px',
  			'noa-5':  '20px',
  			'noa-6':  '24px',
  			'noa-8':  '32px',
  			'noa-10': '40px',
  			'noa-12': '48px',
  			'noa-16': '64px',
  			'noa-20': '80px',
  			'noa-24': '96px',
  		},
  		borderRadius: {
  			'noa-sm':   '4px',
  			'noa-md':   '8px',
  			'noa-lg':   '12px',
  			'noa-xl':   '16px',
  			'noa-2xl':  '20px',
  			'noa-full': '9999px',
  			// Compat shadcn
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			'noa-xs':     '0 1px 2px rgba(0,0,0,.05)',
  			'noa-sm':     '0 1px 4px rgba(0,0,0,.08)',
  			'noa-md':     '0 4px 12px rgba(0,0,0,.10)',
  			'noa-lg':     '0 12px 32px rgba(0,0,0,.12)',
  			'noa-xl':     '0 24px 48px rgba(0,0,0,.14)',
  			'noa-orange': '0 4px 20px rgba(245,158,11,.35)',
  			// ── Brand Book regla 6: sombras SUTILES, nunca glow/neón. Se capan las
  			// utilidades por defecto de Tailwind para que ningún componente del frontend
  			// use sombras pesadas (shadow-xl/2xl) ni glows. ──
  			DEFAULT: '0 1px 4px rgba(0,0,0,.08)',
  			sm:      '0 1px 2px rgba(0,0,0,.05)',
  			md:      '0 1px 4px rgba(0,0,0,.08)',
  			lg:      '0 2px 8px rgba(0,0,0,.08)',
  			xl:      '0 4px 12px rgba(0,0,0,.10)',
  			'2xl':   '0 4px 16px rgba(0,0,0,.10)',
  		},
  		transitionTimingFunction: {
  			'noa': 'cubic-bezier(.22,.68,0,1.2)',
  		},
  		transitionDuration: {
  			'noa-fast': '120ms',
  			'noa-base': '200ms',
  			'noa-slow': '350ms',
  		},
  		colors: {
  			// ─── Remap de familias fuera de marca → navy (Brand Book) ───
  			// Navy dominante: las familias decorativas que no están en la paleta NOA
  			// se llevan a navy. Se conserva el semáforo (green/red/amber, info azul/sky).
  			purple:  NAVY_SCALE,
  			violet:  NAVY_SCALE,
  			indigo:  NAVY_SCALE,
  			fuchsia: NAVY_SCALE,
  			pink:    NAVY_SCALE,
  			teal:    NAVY_SCALE,
  			cyan:    NAVY_SCALE,
  			lime:    NAVY_SCALE,

  			// ─── NOA palette ───
  			'noa-orange': {
  				DEFAULT: '#F59E0B',
  				dk:  '#D97706',
  				lt:  '#FCD34D',
  				xs:  '#FEF3C7',
  				// alias en inglés para compat
  				dark:  '#D97706',
  				light: '#FEF3C7',
  			},
  			'noa-navy': {
  				DEFAULT: '#0C1B33',
  				mid: '#142240',
  				lt:  '#1E3A5F',
  			},
  			'noa-cream': {
  				DEFAULT: '#F7F5F0',
  				dk: '#EDE9E0',
  			},
  			'noa-gray':    '#A2A2A2',
  			'noa-success': { DEFAULT: '#16A34A', lt: '#DCFCE7' },
  			'noa-warning': { DEFAULT: '#D97706', lt: '#FEF3C7' },
  			'noa-danger':  { DEFAULT: '#DC2626', lt: '#FEE2E2' },
  			'noa-info':    { DEFAULT: '#0EA5E9', lt: '#E0F2FE' },

  			// ─── shadcn theme tokens (siguen mapeando a CSS vars) ───
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card:       { DEFAULT: 'hsl(var(--card))',       foreground: 'hsl(var(--card-foreground))' },
  			popover:    { DEFAULT: 'hsl(var(--popover))',    foreground: 'hsl(var(--popover-foreground))' },
  			primary:    { DEFAULT: 'hsl(var(--primary))',    foreground: 'hsl(var(--primary-foreground))' },
  			secondary:  { DEFAULT: 'hsl(var(--secondary))',  foreground: 'hsl(var(--secondary-foreground))' },
  			muted:      { DEFAULT: 'hsl(var(--muted))',      foreground: 'hsl(var(--muted-foreground))' },
  			accent:     { DEFAULT: 'hsl(var(--accent))',     foreground: 'hsl(var(--accent-foreground))' },
  			destructive:{ DEFAULT: 'hsl(var(--destructive))',foreground: 'hsl(var(--destructive-foreground))' },
  			border: 'hsl(var(--border))',
  			input:  'hsl(var(--input))',
  			ring:   'hsl(var(--ring))',
  			chart:  {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
  			'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
  			'noa-skel':       { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up':   'accordion-up 0.2s ease-out',
  			'noa-skel':       'noa-skel 1.6s infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
