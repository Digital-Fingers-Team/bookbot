import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c2227",
        paper: "#f5f5f6",
        line: "#e7e7ea",
        moss: "#0a6b37",
        copper: "#d89516",
        sea: "#4f9a5f"
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgba(24, 24, 27, 0.04), 0 14px 40px -16px rgba(24, 24, 27, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
