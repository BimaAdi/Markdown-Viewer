import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

// markdown files are served relative to the directory the app is started from
export const BASE_DIR = process.cwd();

// convert markdown to html using remark-gfm
export const parseMdtoHtml = async ({ filePath }: { filePath: string }) => {
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
export const resolveMarkdownFile = ({ pathname }: { pathname: string }) => {
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
export const resolveImageFile = ({ pathname }: { pathname: string }) => {
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

export const imageContentTypes: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
};
