import { type Dirent, readdirSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
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
 * - `/README.md`      -> BASE_DIR/README.md
 * - `/README`         -> BASE_DIR/README.md
 * - `/bar.md`         -> BASE_DIR/bar.md
 * - `/bar`            -> BASE_DIR/bar.md
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

	if (trimmed === "") {
		return null;
	}

	const filePath = (() => {
		if (trimmed.endsWith(".md")) {
			return join(BASE_DIR, ...segments);
		}

		// An extensionless path refers to a markdown file with the same name.
		const markdownFile = `${join(BASE_DIR, ...segments)}.md`;
		return markdownFile;
	})();

	// guard against traversal even after joining (e.g. absolute-ish encodings)
	const resolvedPath = resolve(filePath);
	if (!resolvedPath.startsWith(resolve(BASE_DIR) + sep)) {
		return null;
	}

	return resolvedPath;
};

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

/**
 * Render a directory as a simple list of navigable rendered files and folders.
 * Returns null when the pathname is unsafe or does not name a directory.
 */
export const showFileManager = ({ pathname }: { pathname: string }) => {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}

	const trimmed = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
	const segments = trimmed === "" ? [] : trimmed.split("/");
	if (segments.some((segment) => segment === ".." || segment.includes("\0"))) {
		return null;
	}

	const directoryPath = resolve(BASE_DIR, ...segments);
	const basePath = resolve(BASE_DIR);
	if (
		directoryPath !== basePath &&
		!directoryPath.startsWith(`${basePath}${sep}`)
	) {
		return null;
	}

	let entries: Dirent<string>[];
	try {
		entries = readdirSync(directoryPath, { withFileTypes: true });
	} catch {
		return null;
	}

	const parentPath =
		segments.length === 0
			? null
			: `/${segments.slice(0, -1).map(encodeURIComponent).join("/")}${segments.length > 1 ? "/" : ""}`;
	const items: string[] = [];
	if (parentPath !== null) {
		items.push(`<li><a href="${parentPath}">../</a></li>`);
	}

	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const hrefPath = `/${[...segments, entry.name].map(encodeURIComponent).join("/")}`;
		if (entry.isDirectory()) {
			const label = `${entry.name}/`;
			items.push(`<li><a href="${hrefPath}/">${escapeHtml(label)}</a></li>`);
			continue;
		}

		if (
			[".md", ".svg", ".png", ".jpg", ".jpeg"].includes(
				extname(entry.name).toLowerCase(),
			)
		) {
			items.push(
				`<li><a href="${hrefPath}">${escapeHtml(entry.name)}</a></li>`,
			);
		}
	}

	return `<ul>${items.join("")}</ul>`;
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
