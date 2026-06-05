import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  vite: {
    server: {
      allowedHosts: [
        "family-memory-vault-1.onrender.com",
        "family-memory-vault-production.up.railway.app",
      ],
    },
  },
});