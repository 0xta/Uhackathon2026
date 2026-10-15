import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        avax: {
          red: "#E84142",
          dark: "#B82F30",
        },
        taste: {
          gold: "#F59E0B",
          dark: "#0D0F12",
          card: "#161B22",
          border: "#30363D",
        },
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        dark: {
          ...require("daisyui/src/theming/themes")["dark"],
          primary: "#E84142",
          secondary: "#F59E0B",
          accent: "#10B981",
          neutral: "#161B22",
          "base-100": "#0D0F12",
          "base-200": "#161B22",
          "base-300": "#21262D",
        },
      },
      "coffee",
    ],
    defaultTheme: "dark",
  },
};

export default config;
