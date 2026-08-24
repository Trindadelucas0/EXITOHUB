import { config } from "dotenv";
import { Client } from "pg";

config();

async function main() {
  const host = process.env.DB_HOST ?? "localhost";
  const port = Number(process.env.DB_PORT ?? "5432");
  const user = process.env.DB_USER ?? "postgres";
  const password = process.env.DB_PASSWORD;
  const name = process.env.DB_NAME ?? "fiscal-p";

  if (!password) {
    throw new Error("DB_PASSWORD ausente no .env");
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database: "postgres",
  });

  await client.connect();
  try {
    const found = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name.replaceAll('"', "")}"`);
      console.log(`Banco "${name}" criado.`);
    } else {
      console.log(`Banco "${name}" já existe.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
