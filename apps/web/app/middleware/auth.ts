export default defineNuxtRouteMiddleware(async (to) => {
  const { $authClient } = useNuxtApp();
  const { data: session } = await $authClient.useSession(useFetch);

  if (!session.value) {
    return navigateTo("/login");
  }
});
