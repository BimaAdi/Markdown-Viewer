import cac from "cac";
import routes from "./server";

const cli = cac();

cli
	.command("serve", "Run the markdown live preview server")
	.option("--port <port>", "customize server port", { default: 3333 })
	.action((options) => {
		const server = Bun.serve({
			port: Number(options.port),
			routes,
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
