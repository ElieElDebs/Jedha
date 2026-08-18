/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a73e8',
        surface: '#ffffff',
        'surface-2': '#f6f8fa',
        accent: '#0f9d58',
      },
      boxShadow: {
        material: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)'
      }
    },
  },
  plugins: [],
};
