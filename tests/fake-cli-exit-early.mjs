// Test double that exits without reading stdin, printing a CLI-style error,
// to prove a failed prompt delivery is never reported as a successful run.
import fs from 'node:fs';
fs.writeSync(2, 'AUTHENTICATION FAILED\n');
process.exit(Number(process.env.FAKE_EXIT_CODE ?? 3));
