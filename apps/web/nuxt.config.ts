import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import "@trespass/env/web";

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf-8")
) as { version: string };

export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  modules: ["shadcn-nuxt", "@nuxtjs/color-mode"],
  colorMode: {
    classSuffix: "",
    defaultValue: "dark",
    fallback: "dark",
  },
  shadcn: {
    prefix: "",
    componentDir: "@/components/ui",
  },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    serverUrl: "",
    public: {
      serverUrl: process.env.NUXT_PUBLIC_SERVER_URL ?? "",
      version,
    },
  },
});
