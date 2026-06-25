export default defineNuxtRouteMiddleware(async (to) => {
  try {
    const { $authClient } = useNuxtApp();
    const { data: session } = await $authClient.useSession(useFetch);

    if (!session.value) {
      return navigateTo("/login");
    }
  } catch {
    return navigateTo("/login");
  }
});
