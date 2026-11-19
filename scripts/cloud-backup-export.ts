/**
 * KarWand SmartOrders — Nightly Cloud Backup Export
 * 
 * Safety Net for Liara Cloud Databases (which lack automated backups on basic tier).
 * 
 * Invariants:
 *  - Connection strings read strictly from gitignored `.env.cloud-check`.
 *  - Never prints passwords, tokens, or credentials to console or files.
 *  - Establishes read-only transaction: SET default_transaction_read_only = on;
 *  - Dumps schema DDL + data INSERTs to backups/<dbname>-<YYYYMMDD-HHmm>.sql
 *  - Dumps table row counts in the SQL header.
 *  - Exit 0 on success, non-zero on critical failure.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;

interface TableColumnMeta {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableDumpSummary {
  tableName: string;
  rowCount: number;
}

interface DatabaseTarget {
  name: string;
  url: string;
  required: boolean;
}

function formatSqlValue(val: any, udtName: string): string {
  if (val === null || val === undefined) {
    return 'NULL';
  }
  if (typeof val === 'boolean') {
    return val ? 'TRUE' : 'FALSE';
  }
  if (typeof val === 'number') {
    if (Number.isFinite(val)) return String(val);
    return 'NULL';
  }
  if (val instanceof Date) {
    return `'${val.toISOString()}'`;
  }
  if (typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  // Standard string escaping for PostgreSQL
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function getFormattedTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const mm = pad(now.getMinutes());
  return `${yyyy}${MM}${dd}-${HH}${mm}`;
}

async function dumpDatabase(target: DatabaseTarget, backupDir: string, timestamp: string): Promise<{ filePath: string; sizeBytes: number; tables: TableDumpSummary[] } | null> {
  const client = new Client({
    connectionString: target.url,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
  } catch (err: any) {
    if (!target.required) {
      console.warn(`[WARN] Database "${target.name}" is unreachable (${err.message}). Skipping optional target.`);
      return null;
    }
    throw new Error(`Failed to connect to required database "${target.name}": ${err.message}`);
  }

  try {
    // 1. Mandatory Read-Only enforcement
    await client.query('SET default_transaction_read_only = on;');

    // 2. Discover all public base tables
    const tablesRes = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map((r) => r.table_name);
    const tableSummaries: TableDumpSummary[] = [];
    const ddlStatements: string[] = [];
    const dataStatements: string[] = [];

    for (const tbl of tableNames) {
      // Query columns
      const colRes = await client.query<TableColumnMeta>(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tbl]);

      // Query primary key columns
      const pkRes = await client.query<{ column_name: string }>(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position;
      `, [tbl]);

      const pkCols = pkRes.rows.map((r) => `"${r.column_name}"`);

      // Construct CREATE TABLE
      const colDefs = colRes.rows.map((c) => {
        let typeStr = c.udt_name.toUpperCase();
        if (c.data_type === 'USER-DEFINED') typeStr = c.udt_name;
        if (c.data_type === 'ARRAY') typeStr = `${c.udt_name.replace(/^_/, '')}[]`;
        const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
        return `  "${c.column_name}" ${typeStr}${def}${nullable}`;
      });

      if (pkCols.length > 0) {
        colDefs.push(`  PRIMARY KEY (${pkCols.join(', ')})`);
      }

      ddlStatements.push(`-- DDL for table: public."${tbl}"\nCREATE TABLE IF NOT EXISTS public."${tbl}" (\n${colDefs.join(',\n')}\n);\n`);

      // Query table rows
      const rowsRes = await client.query(`SELECT * FROM public."${tbl}"`);
      tableSummaries.push({ tableName: tbl, rowCount: rowsRes.rows.length });

      if (rowsRes.rows.length > 0) {
        const cols = colRes.rows.map((c) => c.column_name);
        const quotedCols = cols.map((c) => `"${c}"`).join(', ');

        dataStatements.push(`-- Data for table: public."${tbl}" (${rowsRes.rows.length} rows)`);

        // Batch into chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < rowsRes.rows.length; i += chunkSize) {
          const slice = rowsRes.rows.slice(i, i + chunkSize);
          const valuesList = slice.map((row) => {
            const vals = colRes.rows.map((c) => formatSqlValue(row[c.column_name], c.udt_name));
            return `  (${vals.join(', ')})`;
          });
          dataStatements.push(`INSERT INTO public."${tbl}" (${quotedCols})\nVALUES\n${valuesList.join(',\n')}\nON CONFLICT DO NOTHING;\n`);
        }
      }
    }

    // 3. Assemble full SQL Dump
    const headerLines = [
      '-- ============================================================================',
      `-- KarWand SmartOrders — Automated Cloud Backup Export`,
      `-- Database Name: ${target.name}`,
      `-- Export Timestamp: ${new Date().toISOString()}`,
      `-- Read-Only Verification: Confirmed (SET default_transaction_read_only = on)`,
      `-- Total Tables Exported: ${tableNames.length}`,
      '-- Table Row Counts:',
      ...tableSummaries.map((s) => `--   - ${s.tableName.padEnd(30, ' ')}: ${s.rowCount.toLocaleString()} rows`),
      '-- ============================================================================',
      '',
      'BEGIN TRANSACTION READ ONLY;',
      'SET default_transaction_read_only = on;',
      'COMMIT;',
      '',
      '-- Schema Definition',
      ...ddlStatements,
      '',
      '-- Data Population',
      ...dataStatements,
      '',
      '-- End of Backup Dump',
    ];

    const outFileName = `${target.name}-${timestamp}.sql`;
    const outFilePath = path.join(backupDir, outFileName);

    fs.writeFileSync(outFilePath, headerLines.join('\n'), 'utf8');
    const stat = fs.statSync(outFilePath);

    return {
      filePath: outFilePath,
      sizeBytes: stat.size,
      tables: tableSummaries,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

export async function runCloudBackupExport(): Promise<void> {
  const envPath = path.resolve(process.cwd(), '.env.cloud-check');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `[CONFIG ERROR] .env.cloud-check does not exist at ${envPath}!\n` +
      `Please provide database connection URLs in .env.cloud-check (gitignored, never committed).`
    );
  }

  const parsedEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'));

  // Resolve DB targets strictly from .env.cloud-check
  const targets: DatabaseTarget[] = [];

  for (const [key, rawUrl] of Object.entries(parsedEnv)) {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('postgres')) {
      continue;
    }
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('karwand')) {
      targets.push({ name: 'karwand-db', url: rawUrl, required: true });
    } else if (lowerKey.includes('modendo')) {
      targets.push({ name: 'modendo-prod', url: rawUrl, required: false });
    } else {
      const customName = key.toLowerCase().replace(/_url$|_db$|^database_url_/g, '');
      targets.push({ name: customName || 'cloud-db', url: rawUrl, required: false });
    }
  }

  if (targets.length === 0) {
    throw new Error(`[CONFIG ERROR] No PostgreSQL connection strings found in .env.cloud-check.`);
  }

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = getFormattedTimestamp();
  console.log('=================================================================');
  console.log(`☕ KarWand Cloud Backup Export — [Timestamp: ${timestamp}]`);
  console.log(`Targeting ${targets.length} database(s) from .env.cloud-check`);
  console.log('Mode: STRICT READ-ONLY TRANSACTION');
  console.log('=================================================================\n');

  let successCount = 0;

  for (const target of targets) {
    console.log(`--> Processing database: [${target.name}]...`);
    const result = await dumpDatabase(target, backupDir, timestamp);
    if (result) {
      successCount++;
      const kb = (result.sizeBytes / 1024).toFixed(2);
      console.log(`    ✓ Dump complete: ${path.basename(result.filePath)} (${kb} KB)`);
      console.log('    Table row counts:');
      for (const t of result.tables) {
        console.log(`      • ${t.tableName}: ${t.rowCount} rows`);
      }
      console.log('');
    }
  }

  if (successCount === 0) {
    throw new Error('All database backup targets failed to export.');
  }

  console.log('=================================================================');
  console.log(`✓ Backup export successfully completed for ${successCount} database(s).`);
  console.log('Files safely preserved in ./backups/ directory (gitignored).');
  console.log('=================================================================');
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes('cloud-backup-export')) {
  runCloudBackupExport()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n🛑 [BACKUP ERROR]', err.message);
      process.exit(1);
    });
}
