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

const server = Bun.serve({
	routes: {
		"/styles.css": async () => {
			const cssFile = Bun.file("./styles.css");
			return new Response(await cssFile.text(), {
				headers: {
					"Content-Type": "text/css; charset=utf-8",
				},
			});
		},

		"/": async () => {
			const rawBody = await parseMdtoHtml({ filePath: "example.md" });
			const rawHtml = `<html>
      <head>
      <link rel="stylesheet" href="styles.css">
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
			return new Response(rawHtml, {
				status: 200,
				headers: {
					"content-type": "text/html; charset=utf-8",
				},
			});
		},
	},
});

console.log(`server run on ${server.port}`);
