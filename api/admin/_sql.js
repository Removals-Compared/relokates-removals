// Neon Postgres access (HTTP driver, so no TCP pool: safe on serverless).
// One env var: DATABASE_URL (Neon pooled connection string).
// Type parsers keep row shapes identical to the old PostgREST output:
// bigint/numeric -> Number, date -> 'YYYY-MM-DD', timestamptz -> ISO string.
import { neon, types } from '@neondatabase/serverless';

const parsers = {
  20: (v) => Number(v),                    // int8
  1700: (v) => Number(v),                  // numeric
  1082: (v) => v,                          // date stays a plain string
  1184: (v) => new Date(v).toISOString(),  // timestamptz
};
const typeConfig = {
  getTypeParser: (oid, fmt) => parsers[oid] || types.getTypeParser(oid, fmt),
};

// Franchise branches have their OWN databases (e.g. BIRMINGHAM_DATABASE_URL)
// so branch data physically never mixes with head office. useDb() routes the
// rest of the current invocation at a branch database; useDb(null) routes
// back to head office. Vercel serves one request per instance at a time, so
// a module-level switch is safe.
const _clients = Object.create(null);
let _activeUrl = null;

export function useDb(url) { _activeUrl = url || null; }

// Connection string for a branch slug, or null when not configured.
export function branchDbUrl(slug) {
  if (!slug) return null;
  return process.env[`${String(slug).toUpperCase().replace(/-/g, '_')}_DATABASE_URL`] || null;
}

function client() {
  const url = _activeUrl || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!_clients[url]) _clients[url] = neon(url);
  return _clients[url];
}

// q('select * from t where id = $1', [id]) -> array of row objects.
// async so a missing DATABASE_URL becomes a rejected promise, not a sync throw.
export const q = async (text, params = []) => client().query(text, params, { types: typeConfig });

const COL = /^[a-z_][a-z0-9_]*$/;

// jsonb values must be sent as JSON text; the driver would otherwise
// serialise arrays as Postgres arrays.
export function jsonify(v) {
  return v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v;
}

// "a = $1, b = $2" from a plain object (column names validated).
export function setClause(fields, startAt = 1) {
  const keys = Object.keys(fields);
  keys.forEach((k) => { if (!COL.test(k)) throw new Error(`bad column ${k}`); });
  return {
    sql: keys.map((k, i) => `${k} = $${startAt + i}`).join(', '),
    values: keys.map((k) => jsonify(fields[k])),
    next: startAt + keys.length,
  };
}

// INSERT one row (object) ... RETURNING *.
export async function insertRow(table, row) {
  const keys = Object.keys(row);
  keys.forEach((k) => { if (!COL.test(k)) throw new Error(`bad column ${k}`); });
  const rows = await q(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    keys.map((k) => jsonify(row[k])),
  );
  return rows[0] || null;
}

// UPDATE ... WHERE id = $n RETURNING * for one table.
export async function updateById(table, id, fields) {
  if (!Object.keys(fields).length) return null;
  const s = setClause(fields);
  const rows = await q(`UPDATE ${table} SET ${s.sql} WHERE id = $${s.next} RETURNING *`, [...s.values, id]);
  return rows[0] || null;
}
