<script setup lang="ts">
import {
  Github,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from "lucide-vue-next";
import { toast } from "vue-sonner";

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();

async function signOut() {
  await $authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        toast.success("Signed out");
        navigateTo("/", { replace: true, external: true });
      },
      onError: (err: { error: { message: string } }) => {
        toast.error(err.error.message ?? "Sign out failed");
      },
    },
  });
}
</script>

<template>
  <div>
    <div
      v-if="session.isPending"
      class="h-8 w-24 rounded bg-secondary animate-pulse"
    />

    <Button
      v-else-if="!session.data"
      variant="outline"
      size="sm"
      as-child
      class="border-primary/50 text-primary hover:bg-primary/10"
    >
      <NuxtLink to="/login">
        <Github class="h-4 w-4 mr-2" />
        Sign In
      </NuxtLink>
    </Button>

    <DropdownMenu v-else>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Avatar class="h-7 w-7">
            <AvatarImage
              v-if="session.data.user.image"
              :src="session.data.user.image"
              :alt="session.data.user.name ?? 'User'"
            />
            <AvatarFallback class="bg-primary/20 text-primary text-xs">
              {{ (session.data.user.name ?? "U")[0]?.toUpperCase() }}
            </AvatarFallback>
          </Avatar>
          <span class="hidden sm:inline text-sm font-medium">
            {{ session.data.user.name ?? session.data.user.email }}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuLabel class="font-normal">
          <div class="flex flex-col gap-0.5">
            <span class="font-medium text-sm"
              >{{ session.data.user.name }}</span
            >
            <span class="text-xs text-muted-foreground truncate"
              >{{ session.data.user.email }}</span
            >
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem as-child>
          <NuxtLink
            to="/dashboard"
            class="flex items-center gap-2 cursor-pointer"
          >
            <LayoutDashboard class="h-4 w-4" />
            Dashboard
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <NuxtLink
            to="/settings"
            class="flex items-center gap-2 cursor-pointer"
          >
            <Settings class="h-4 w-4" />
            Settings
          </NuxtLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          class="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
          @click="signOut"
        >
          <LogOut class="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
