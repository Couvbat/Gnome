/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gnome-gold': '#ffd700',
        'gnome-dark': '#1a1a2e',
        'gnome-blue': '#0f3460',
        'gnome-purple': '#302b63',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'felt-green': 'linear-gradient(135deg, #1a5c2e 0%, #0f3c1e 100%)',
        'felt-pattern': 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.02) 0%, transparent 50%), linear-gradient(135deg, #1a5c2e 0%, #0f3c1e 100%)',
        'dealer-red': 'linear-gradient(135deg, rgba(201, 42, 42, 0.4) 0%, rgba(134, 30, 30, 0.4) 100%)',
        'wood-border': 'linear-gradient(135deg, #8b4513 0%, #654321 50%, #8b4513 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'card-deal': 'card-deal 0.5s ease-out forwards',
        'card-flip': 'card-flip 0.6s ease-in-out',
        'chip-stack': 'chip-stack 0.3s ease-out forwards',
        'spin-wheel': 'spin-wheel 3s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards',
        'bounce-slot': 'bounce-slot 0.6s ease-in-out',
        'dice-roll': 'dice-roll 0.8s ease-in-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'card-deal': {
          '0%': { 
            transform: 'translateX(-100%) translateY(-50%) rotateY(180deg) scale(0.8)', 
            opacity: '0' 
          },
          '50%': { 
            transform: 'translateX(-50%) translateY(-25%) rotateY(90deg) scale(0.9)' 
          },
          '100%': { 
            transform: 'translateX(0) translateY(0) rotateY(0deg) scale(1)', 
            opacity: '1' 
          },
        },
        'card-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        'chip-stack': {
          '0%': { 
            transform: 'translateY(20px) scale(0.8)', 
            opacity: '0' 
          },
          '50%': { 
            transform: 'translateY(-5px) scale(1.05)' 
          },
          '100%': { 
            transform: 'translateY(0) scale(1)', 
            opacity: '1' 
          },
        },
        'spin-wheel': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(1800deg)' },
        },
        'bounce-slot': {
          '0%, 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-15px)' },
          '50%': { transform: 'translateY(-5px)' },
          '75%': { transform: 'translateY(-10px)' },
        },
        'dice-roll': {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(90deg) scale(1.1)' },
          '50%': { transform: 'rotate(180deg) scale(0.9)' },
          '75%': { transform: 'rotate(270deg) scale(1.1)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    },
  },
  plugins: [],
}
