import routes from "./server";

const usage = `Usage: 
  mdview serve [--port <port>] Run the markdown live preview server.
  mdview help                  Show this help message`;

type CommandOptions = {
	args: string[];
	command: string;
	action: (args: string[]) => void;
};

/**
 * Checks whether the first argument matches a command and, if so, runs its action.
 * The matched command is removed from `args` before they are passed to `action`.
 * Use this to dispatch a command, for example `getCommand({ args, command: "serve", action })`.
 * Returns `true` when the command matched; otherwise returns `false`.
 */
function getCommand({ args, command, action }: CommandOptions): boolean {
	if (args[0] !== command) return false;

	args.shift();
	action(args);
	return true;
}

/**
 * Checks whether `args` contains any of the supplied flags. A flag matches either
 * exactly (for example, `--help`) or as an assignment (for example, `--port=3000`).
 * Use this to test for a flag: `isHasFlag({ args, flags: ["--help", "-h"] })`.
 */
function isHasFlag({
	args,
	flags,
}: {
	args: string[];
	flags: string[];
}): boolean {
	return args.some((arg) =>
		flags.some((flag) => arg === flag || arg.startsWith(`${flag}=`)),
	);
}

/**
 * Finds the first matching flag in `args`, removes it (and its separate value, if
 * present), and returns its value. Supports both `--port 3000` and `--port=3000`;
 * an absent value is returned as an empty string. Returns `null` when no flag is
 * present. Use it like `getFlag({ args, flags: ["--port"] })`.
 */
function getFlag({
	args,
	flags,
}: {
	args: string[];
	flags: string[];
}): string | null {
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === undefined) continue;
		const flag = flags.find(
			(candidate) => arg === candidate || arg.startsWith(`${candidate}=`),
		);
		if (!flag) continue;

		const value =
			arg === flag ? (args[index + 1] ?? "") : arg.slice(flag.length + 1);
		args.splice(index, arg === flag && args[index + 1] !== undefined ? 2 : 1);
		return value;
	}

	return null;
}

const args = process.argv.slice(2);
const command = args[0];

const hasHelpFlag = isHasFlag({ args, flags: ["help", "--help", "-h"] });
if (command === undefined || hasHelpFlag) {
	console.log(usage);
	process.exit(0);
}

const commandFound = getCommand({
	args,
	command: "serve",
	action: (args) => {
		if (args.some((arg) => arg === "--help" || arg === "-h")) {
			console.log(usage);
			process.exit(0);
		}

		const portFlag = getFlag({ args, flags: ["--port"] });
		let port = 3333;

		if (portFlag !== null) {
			const parsedPort = Number(portFlag);
			if (
				portFlag === "" ||
				!Number.isInteger(parsedPort) ||
				parsedPort < 0 ||
				parsedPort > 65535
			) {
				console.error(`Invalid port: ${portFlag}`);
				process.exit(1);
			}

			port = parsedPort;
		}

		if (args.length > 0) {
			console.error(`Unknown option: ${args[0]}\n\n${usage}`);
			process.exit(1);
		}

		const server = Bun.serve({
			port,
			routes,
		});

		console.log(`server run on ${server.port}`);
	},
});

if (!commandFound) {
	console.error(`command ${command} not found`);
	console.error(usage);
	process.exit(1);
}
