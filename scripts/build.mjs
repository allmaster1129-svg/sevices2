const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

if (isVercel) {
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("next", ["build"], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}

const { spawnSync } = await import("node:child_process");
const result = spawnSync("vinext", ["build"], { stdio: "inherit", shell: true });
process.exit(result.status ?? 1);
