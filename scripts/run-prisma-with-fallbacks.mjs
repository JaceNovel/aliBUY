import { spawn } from "node:child_process";

const DATABASE_URL_ENV_KEYS = [
  "DATABASE_URL",
  "PRISMA_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
];

function resolveDatabaseUrl(env) {
  for (const key of DATABASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

const databaseUrl = resolveDatabaseUrl(process.env);

if (!databaseUrl) {
  process.stderr.write(
    "Missing database URL. Set DATABASE_URL, PRISMA_DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL before running Prisma.\n",
  );
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  process.stderr.write("Usage: node scripts/run-prisma-with-fallbacks.mjs <prisma-command> [args...]\n");
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
