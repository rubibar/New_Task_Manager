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
        replica: {
          green: "#C8FF00",
          "green-dark": "#A3D600",
          "green-light": "#E5FF80",
        },
      },
    },
  },
  plugins: [],
};
export default config;
