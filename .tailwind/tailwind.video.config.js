// The video page uses different "brand" shades; kept separate so it looks exactly as before.
module.exports = {
  content: ['../remove-video-ai-metadata.html', '../clean-download.js'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#0066ff', 600: '#0052cc', 900: '#0a194f' },
      },
    },
  },
};
