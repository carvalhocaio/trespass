import tailwindcss from "@tailwindcss/vite";
import "@trespass/env/web";

export default defineNuxtConfig({
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
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
    },
  },
});
