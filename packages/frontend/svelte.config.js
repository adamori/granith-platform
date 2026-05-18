import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html',
		}),
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ["'self'"],
				'script-src': ["'self'", "'wasm-unsafe-eval'", 'https://static.cloudflareinsights.com'],
				'style-src': ["'self'", "'unsafe-inline'"],
				'img-src': ["'self'", 'data:'],
				'connect-src': ["'self'", 'https://api.granith.dev', 'https://cloudflareinsights.com'],
				'font-src': ["'self'"],
				'object-src': ["'none'"],
				'base-uri': ["'self'"],
				'form-action': ["'self'"],
			},
		},
	}
};

export default config;
