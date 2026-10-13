import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
	BASE_DIR,
	imageContentTypes,
	parseMdtoHtml,
	resolveImageFile,
	resolveMarkdownFile,
	showFileManager,
} from "./parser";

// make sure the css file embeded during build
const cssFile = Bun.file(join(import.meta.dir, "./styles.css"));

const htmlMarkdownPreview = ({
	title,
	rawBody,
}: {
	title: string;
	rawBody: string;
}) => `<html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script>
    // Apply a saved choice before the stylesheet loads. Without a saved
    // choice, CSS uses the device's prefers-color-scheme setting.
    // Shared so it can be re-run after the highlight.js <link> tags exist
    // and again whenever the theme toggle changes the theme.
    window.applyHljsStylesheet = () => {
      const isDark =
        document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.querySelectorAll('link[data-hljs-theme]').forEach((link) => {
        link.media =
          link.getAttribute('data-hljs-theme') === (isDark ? 'dark' : 'light')
            ? 'all'
            : 'not all';
      });
    };
    try {
      const theme = localStorage.getItem('md-viewer-theme');
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.dataset.theme = theme;
      }
    } catch {
      // Storage may be unavailable in private or restricted browsing modes.
    }
  </script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.12.0/styles/dark.min.css" media="(prefers-color-scheme: dark)" data-hljs-theme="dark">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.12.0/styles/default.min.css" media="(prefers-color-scheme: light)" data-hljs-theme="light">
  <script>window.applyHljsStylesheet();</script>
  <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
  <button class="theme-toggle" type="button" aria-label="Switch to dark mode">
    Dark mode
  </button>
  <div class="content">
  ${rawBody}
  </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>  
    <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@12/dist/mermaid.esm.min.mjs';

    mermaid.initialize({ startOnLoad: false });

    const themeToggle = document.querySelector('.theme-toggle');
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const currentTheme = () => document.documentElement.dataset.theme ||
      (mediaQuery.matches ? 'dark' : 'light');

    const updateThemeToggle = () => {
      const isDark = currentTheme() === 'dark';
      themeToggle.textContent = isDark ? 'Switch to Light mode' : 'Switch to Dark mode';
      themeToggle.setAttribute(
        'aria-label',
        isDark ? 'Switch to light mode' : 'Switch to dark mode',
      );
    };

    themeToggle.addEventListener('click', () => {
      const theme = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem('md-viewer-theme', theme);
      } catch {
        // Storage may be unavailable in private or restricted browsing modes.
      }
      updateThemeToggle();
      // Defined in the <head>; flips the highlight.js stylesheet to match.
      window.applyHljsStylesheet();
    });

    updateThemeToggle();
    window.applyHljsStylesheet();

    // Follow OS-level theme changes when the user hasn't picked one manually.
    mediaQuery.addEventListener('change', () => window.applyHljsStylesheet());

    // Target the <code> elements created by remark-rehype
    document.addEventListener('DOMContentLoaded', () => {
      mermaid.run({
      querySelector: 'code.language-mermaid',
      });
    });
  </script>
  </body>
  </html>`;

export default {
	"/styles.css": async () => {
		return new Response(await cssFile.text(), {
			headers: {
				"Content-Type": "text/css; charset=utf-8",
			},
		});
	},

	"/*": async (req: Request) => {
		const { pathname } = new URL(req.url);
		const fileManagerHtml = showFileManager({ pathname });
		if (fileManagerHtml !== null) {
			const rawHtml = htmlMarkdownPreview({
				title: pathname,
				rawBody: fileManagerHtml,
			});
			return new Response(rawHtml, {
				status: 200,
				headers: {
					"content-type": "text/html; charset=utf-8",
				},
			});
		}

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
			const rawHtml = htmlMarkdownPreview({
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
};
