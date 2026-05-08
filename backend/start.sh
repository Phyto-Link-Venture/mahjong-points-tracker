#!/bin/sh
set -e

echo "[startup] applying schema migrations..."
node - <<'EOF'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  await p.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false`);
  await p.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT`);
  await p.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerifyToken_key" ON "User"("emailVerifyToken")`);
  console.log('[startup] migrations done');
  await p.$disconnect();
}
run().catch(e => { console.error('[startup] migration failed:', e.message); process.exit(1); });
EOF

echo "[startup] starting server..."
exec node server.js
