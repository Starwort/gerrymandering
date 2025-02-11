import suidPlugin from '@suid/vite-plugin';
import devtools from 'solid-devtools/vite';
import {defineConfig} from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    plugins: [
        suidPlugin(),
        devtools({
            autoname: true,
        }),
        solidPlugin(),
    ],
    server: {
        port: 3000,
    },
    build: {
        target: 'esnext',
    },
});
