'use strict';
const { ensureTables, query } = require('./hub/db');
(async () => {
  await ensureTables();
  const cols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='portal_items' ORDER BY column_name`,
  );
  console.log('portal_items cols:', cols.rows.map((r) => r.column_name).join(', '));
  const u = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='hub_users' AND column_name IN ('department','onboarding_status')`,
  );
  console.log('hub_users:', u.rows.map((r) => r.column_name).join(', '));
  const chk = await query(
    `SELECT pg_get_constraintdef(c.oid) AS d FROM pg_constraint c WHERE c.conname='portal_items_kind_check'`,
  );
  console.log('kind check:', chk.rows[0] && chk.rows[0].d);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
