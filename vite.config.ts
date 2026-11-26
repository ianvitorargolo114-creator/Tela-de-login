import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: fileURLToPath(new URL("./index.html", import.meta.url)),
                login: fileURLToPath(new URL("./login.html", import.meta.url)),
            },
        },
    },
});
