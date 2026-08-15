import "dotenv/config";
import path from "node:path";
import type { PrismaConfig } from "prisma";

// With a config file present, the Prisma CLI no longer auto-loads .env — hence
// the explicit dotenv import. Without it every CLI command fails with
// "Environment variable not found: DATABASE_URL" while Next.js works fine.
export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
} satisfies PrismaConfig;
