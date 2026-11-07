import { connect, isDsql } from './client';
import { migrate } from './migrate';

const sql = connect();
await migrate(sql, { dsql: isDsql, log: console.log });
await sql.end();
