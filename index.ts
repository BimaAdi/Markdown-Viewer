import { join, relative, resolve, sep } from "node:path";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const parseMdtoHtml = async ({ filePath }: { filePath: string }) => {
	const inputFile = Bun.file(filePath);
	const text = await inputFile.text();

	const file = await unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkRehype)
		.use(rehypeStringify)
		.process(text);

	return String(file);
};

// markdown files are served relative to the directory the app is started from
const BASE_DIR = process.cwd();

// make sure the css file embeded during build
const cssFile = Bun.file(join(import.meta.dir, "./styles.css"));

/**
 * Map a request pathname to a markdown file path inside BASE_DIR.
 *
 * - `/`               -> BASE_DIR/README.md
 * - `/README.md`      -> BASE_DIR/README.md
 * - `/bar.md`         -> BASE_DIR/bar.md
 * - `/foo/`           -> BASE_DIR/foo/README.md
 * - `/foo/README.md`  -> BASE_DIR/foo/README.md
 * - `/foo/foo.md`     -> BASE_DIR/foo/foo.md
 *
 * Returns null for unsafe paths (path traversal, malformed encoding).
 */
const resolveMarkdownFile = ({ pathname }: { pathname: string }) => {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const trimmed = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
	const segments = trimmed.split("/");
	if (segments.some((segment) => segment === ".." || segment.includes("\0"))) {
		return null;
	}

	const filePath =
		trimmed === ""
			? join(BASE_DIR, "README.md")
			: trimmed.endsWith(".md")
				? join(BASE_DIR, ...segments)
				: join(BASE_DIR, ...segments, "README.md");

	// guard against traversal even after joining (e.g. absolute-ish encodings)
	const resolvedPath = resolve(filePath);
	if (!resolvedPath.startsWith(resolve(BASE_DIR) + sep)) {
		return null;
	}

	return resolvedPath;
};

const html = ({ title, rawBody }: { title: string; rawBody: string }) => `<html>
  <head>
  <title>${title}</title>
  <link rel="stylesheet" href="/styles.css">
  <style>
    .content {
      margin: auto;
    }
  </style>
  </head>
  <body>
  <div class="content">
  ${rawBody}
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs';

    mermaid.initialize({ startOnLoad: false });

    // Target the <code> elements created by remark-rehype
    document.addEventListener('DOMContentLoaded', () => {
      mermaid.run({
      querySelector: 'code.language-mermaid',
      });
    });
  </script>
  </body>
  </html>`;

const server = Bun.serve({
	routes: {
		"/styles.css": async () => {
			return new Response(await cssFile.text(), {
				headers: {
					"Content-Type": "text/css; charset=utf-8",
				},
			});
		},

		"/*": async (req) => {
			const { pathname } = new URL(req.url);

			const filePath = resolveMarkdownFile({ pathname });
			if (filePath === null) {
				return new Response("Not found", { status: 404 });
			}

			try {
				const rawBody = await parseMdtoHtml({ filePath });
				const rawHtml = html({
					title: relative(BASE_DIR, filePath),
					rawBody,
				});
				return new Response(rawHtml, {
					status: 200,
					headers: {
						"content-type": "text/html; charset=utf-8",
					},
				});
			} catch {
				return new Response("Not found", { status: 404 });
			}
		},
	},
});

console.log(`server run on ${server.port}`);
