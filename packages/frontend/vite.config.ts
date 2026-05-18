import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

function apiProxy(target: string) {
	return {
		target,
		bypass(req: any) {
			if (req.headers.accept?.includes('text/html')) {
				return req.url;
			}
		},
	};
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/api': apiProxy('http://localhost:3000'),
		},
	},
});
