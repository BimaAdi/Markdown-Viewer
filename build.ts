await Bun.build({
	entrypoints: ["./index.ts"],
	compile: {
		outfile: "./mdview",
		assets: ["./styles.css"], // Embeds the entire directory and specific files
	},
});
