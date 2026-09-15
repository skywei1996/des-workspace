/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary-start': '#667eea',
        'primary-end': '#764ba2',
        'primary': '#6c63ff',
        'bg': '#f7f7fb',
        'text': '#1a1a1a',
        'muted': '#6b7280',
        'border': '#ececf5',
      },
      width: {
        'sidebar': '280px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
