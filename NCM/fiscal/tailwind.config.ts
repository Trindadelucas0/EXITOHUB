import type { Config } from "tailwindcss";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  content: [
    path.join(root, "app/**/*.{ts,tsx}"),
    path.join(root, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A1A1A",
          muted: "#6B7280",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          raised: "#FFFFFF",
          sunken: "#F8F9FA",
        },
        line: {
          DEFAULT: "#E5E7EB",
          strong: "#D1D5DB",
        },
        brand: {
          DEFAULT: "#2EA44F",
          hover: "#248A41",
          soft: "#DFF0E4",
          line: "#8FD3A6",
        },
        status: {
          ok: "#1F7A45",
          "ok-bg": "#E4F5EA",
          warn: "#1A1F24",
          "warn-bg": "#FFF6D6",
          bad: "#9B2C2C",
          "bad-bg": "#F8E8E8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Segoe UI", "sans-serif"],
        display: ["var(--font-sans)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        panel: "0 8px 32px rgba(0, 0, 0, 0.12)",
        brand: "0 8px 32px rgba(0, 0, 0, 0.12)",
        "brand-sm": "0 8px 24px rgba(0, 0, 0, 0.10)",
      },
      borderRadius: {
        sm: "10px",
        md: "10px",
        lg: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
