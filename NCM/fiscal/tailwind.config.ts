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
          DEFAULT: "#1A1F24",
          muted: "#5C6570",
        },
        paper: {
          DEFAULT: "#FFFFFF",
          raised: "#FFFFFF",
          sunken: "#F1F5F2",
        },
        line: {
          DEFAULT: "#C3CEC7",
          strong: "#1A1F24",
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
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(26, 31, 36, 0.06)",
        brand: "0 0 0 1px rgba(46, 164, 79, 0.45), 0 12px 28px -14px rgba(46, 164, 79, 0.65)",
        "brand-sm": "0 1px 8px -2px rgba(46, 164, 79, 0.45)",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
