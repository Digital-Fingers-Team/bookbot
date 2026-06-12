import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101417",
        paper: "#f7f6f2",
        line: "#d9ded8",
        moss: "#3e6652",
        copper: "#b65f3b",
        sea: "#287b8f"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(16, 20, 23, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
