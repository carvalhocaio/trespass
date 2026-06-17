import { createAuthClient } from "better-auth/vue";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();

  const authClient = createAuthClient({
    baseURL: (import.meta.server && config.serverUrl) || config.public.serverUrl,
  });

  return {
    provide: {
      authClient: authClient,
    },
  };
});
