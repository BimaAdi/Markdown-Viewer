import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import server from "./server";

// Call the catch-all route handler directly with a synthetic Request, no
// HTTP server needed. The handler maps URL paths relative to the process
// working directory, so `data/*` refers to the fixtures in `data/`.
const handle = (pathname: string) => new Request(`http://localhost${pathname}`);

const fixtures = {
	markdownUrl: "/data/example.md",
	imageUrl: "/data/img/cac.png",
	imageFile: `${process.cwd()}/data/img/cac.png`,
};

describe("md-viewer server", () => {
	test("renders a markdown file as an HTML page", async () => {
		const response = await server["/*"](handle(fixtures.markdownUrl));

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/html; charset=utf-8",
		);

		const html = await response.text();
		// The page shell wraps the rendered markdown body.
		expect(html).toContain("<title>data/example.md</title>");
		expect(html).toContain('<div class="content">');
		expect(html).toContain('<link rel="stylesheet" href="/styles.css">');

		// Markdown is rendered to HTML via remark-gfm.
		expect(html).toContain("<h1>GFM</h1>");
		expect(html).toContain("<del>one</del> or <del>two</del> tildes.</p>");
		expect(html).toContain('<img src="img/cac.png" alt="cac png">');
		expect(html).toContain(
			'<li class="task-list-item"><input type="checkbox" checked disabled> done</li>',
		);
		expect(html).toContain('<th align="center">d</th>');
		expect(html).toContain('<td align="left">item 2</td>');
		expect(html).toContain('<code class="language-mermaid">');
	});

	test("shows a file manager at the root", async () => {
		const response = await server["/*"](handle("/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/html; charset=utf-8",
		);

		const html = await response.text();
		expect(html).toContain('<link rel="stylesheet" href="/styles.css">');
		expect(html).toContain('<div class="content">');
		expect(html).toContain('<a href="/README.md">README.md</a>');
		expect(html).toContain('<a href="/data/">data/</a>');
		expect(html).not.toContain("index.ts");
	});

	test("shows supported files and a parent link for directories", async () => {
		const response = await server["/*"](handle("/data"));
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('<li><a href="/">../</a></li>');
		expect(html).toContain('<a href="/data/example.md">example.md</a>');
		expect(html).toContain('<a href="/data/img/">img/</a>');
		expect(html).not.toContain(".txt");
	});

	test("serves an image with the right content type and bytes", async () => {
		const response = await server["/*"](handle(fixtures.imageUrl));

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");

		const served = new Uint8Array(await response.arrayBuffer());
		const expected = new Uint8Array(readFileSync(fixtures.imageFile));
		expect(served).toEqual(expected);
	});

	test("missing markdown file returns 404", async () => {
		const response = await server["/*"](handle("/data/missing.md"));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not found");
	});
});
