import { existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import cac from "cac";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const cli = cac();

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
 * - `/README`         -> BASE_DIR/README.md
 * - `/bar.md`         -> BASE_DIR/bar.md
 * - `/bar`            -> BASE_DIR/bar.md, or BASE_DIR/bar/README.md
 * - `/foo/`           -> BASE_DIR/foo/README.md
 * - `/foo/README.md`  -> BASE_DIR/foo/README.md
 * - `/foo/README`     -> BASE_DIR/foo/README.md
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

	const filePath = (() => {
		if (trimmed === "") {
			return join(BASE_DIR, "README.md");
		}

		if (trimmed.endsWith(".md")) {
			return join(BASE_DIR, ...segments);
		}

		// An extensionless path can refer to either a markdown file or a
		// directory's README. Prefer the file when both happen to exist.
		const markdownFile = `${join(BASE_DIR, ...segments)}.md`;
		const readmeFile = join(BASE_DIR, ...segments, "README.md");
		return existsSync(markdownFile) ? markdownFile : readmeFile;
	})();

	// guard against traversal even after joining (e.g. absolute-ish encodings)
	const resolvedPath = resolve(filePath);
	if (!resolvedPath.startsWith(resolve(BASE_DIR) + sep)) {
		return null;
	}

	return resolvedPath;
};

/**
 * Map a request pathname to an image file inside BASE_DIR.
 *
 * Only image paths with a supported extension are served. Returns null for
 * unsupported, unsafe, or malformed paths.
 */
const resolveImageFile = ({ pathname }: { pathname: string }) => {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const trimmed = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
	const segments = trimmed.split("/");
	if (
		trimmed === "" ||
		segments.some((segment) => segment === ".." || segment.includes("\0"))
	) {
		return null;
	}

	const extension = trimmed.slice(trimmed.lastIndexOf(".") + 1).toLowerCase();
	if (!["jpg", "png", "svg", "jpeg"].includes(extension)) {
		return null;
	}

	const filePath = join(BASE_DIR, ...segments);
	const resolvedPath = resolve(filePath);
	if (!resolvedPath.startsWith(resolve(BASE_DIR) + sep)) {
		return null;
	}

	return resolvedPath;
};

const imageContentTypes: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
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

cli
	.command("serve", "Run the markdown live preview server")
	.option("--port <port>", "customize server port", { default: 3333 })
	.action((options) => {
		const server = Bun.serve({
			port: Number(options.port),
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
					const imagePath = resolveImageFile({ pathname });
					if (imagePath !== null) {
						const extension = imagePath
							.slice(imagePath.lastIndexOf(".") + 1)
							.toLowerCase();
						const contentType = imageContentTypes[extension];
						if (!existsSync(imagePath)) {
							return new Response("Not found", { status: 404 });
						}
						if (contentType === undefined) {
							return new Response("Not found", { status: 404 });
						}

						return new Response(Bun.file(imagePath), {
							status: 200,
							headers: {
								"content-type": contentType,
							},
						});
					}

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
	});

cli
	.command("pasteImg <fileName>", "paste image from clipboard")
	.action(async (fileName) => {
		const img = Bun.Image.fromClipboard();

		if (img) {
			// Resize or process the image
			const pngBytes = await img.png().bytes();

			// Write the processed image to a file
			await Bun.write(fileName, pngBytes);
			console.log("Image pasted and saved!");
		} else {
			console.log("No image found in clipboard.");
		}
	});

cli.version("0.0.1");
cli.help();
cli.parse();
