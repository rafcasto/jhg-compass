import type { Config } from "tailwindcss";

// Brand tokens mirror /design-system/colors_and_type.css (JobHackers.Global)
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        jh: {
          red: "#c2001f",
          "red-hover": "#8a0016",
          ink: "#191c27",
          "red-soft": "#f6e0e3",
          "blue-grey": "#e2ebfb",
          paper: "#fafafa",
          mist: "#f3f5fa",
          line: "#e6e8ef",
          "line-2": "#d4d8e2",
          mute: "#6b7280",
          "mute-2": "#9aa0ad",
        },
        rb: {
          red: "#c2001f",
          orange: "#f08a1c",
          yellow: "#f5d000",
          "green-light": "#6bbf6b",
          "green-dark": "#2f7a3a",
          blue: "#0033cc",
          violet: "#7a1ec2",
        },
      },
      fontFamily: {
        display: ["Poppins", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      borderRadius: {
        xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px", pill: "999px",
      },
      boxShadow: {
        "jh-1": "0 1px 2px rgba(25,28,39,.06)",
        "jh-2": "0 4px 12px rgba(25,28,39,.08)",
        "jh-3": "0 10px 24px rgba(25,28,39,.10)",
        cta: "0 6px 18px rgba(194,0,31,.25)",
      },
    },
  },
  plugins: [],
};
export default config;
