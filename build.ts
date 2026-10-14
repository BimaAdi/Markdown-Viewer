await Bun.build({
	entrypoints: ["./index.ts"],
	compile: {
		outfile: "./mdview",
		assets: ["./styles.css", "./static/"], // Embeds the entire directory and specific files
	},
});
