/**** Tailwind config for standalone MotoCarePro ****/
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")]
};
