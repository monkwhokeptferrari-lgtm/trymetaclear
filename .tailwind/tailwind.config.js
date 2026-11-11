// Main site palette (all pages except the video page and the hidden Gemini page).
// Values are copied from the pages' former inline `tailwind.config` blocks.
module.exports = {
  content: ['../*.html', '../blog/**/*.html', '../clean-download.js'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef6ff', 100: '#e0f0ff', 500: '#00d2ff', 600: '#0066ff', 700: '#0052cc', 900: '#0a194f' },
        accent: { coral: '#ff4b4b', purple: '#3a1c71' },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
