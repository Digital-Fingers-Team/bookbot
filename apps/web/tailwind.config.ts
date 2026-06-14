import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#263238",
        paper: "#faf9f4",
        line: "#ded8c9",
        moss: "#075f2f",
        copper: "#d89516",
        sea: "#4f9a5f"
      },
      boxShadow: {
        soft: "0 14px 35px rgba(38, 50, 56, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
