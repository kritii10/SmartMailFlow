import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10131a",
        sand: "#f6efe5",
        coral: "#d6644a",
        moss: "#29443a",
        gold: "#dcb967"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(16, 19, 26, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;

