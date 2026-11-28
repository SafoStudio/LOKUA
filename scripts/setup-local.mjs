import { spawnSync } from 'node:child_process';
import { constants, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command === 'pnpm'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

try {
  copyFileSync(
    new URL('../apps/api/.env.example', import.meta.url),
    new URL('../apps/api/.env', import.meta.url),
    constants.COPYFILE_EXCL
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}

run('pnpm', ['install', '--frozen-lockfile']);
run('docker', ['compose', 'up', '-d', '--wait', 'db', 'db-test', 'pgadmin', 'minio', 'mailpit']);
run('docker', ['compose', 'run', '--rm', 'minio-init']);

for (const [port, database] of [[5432, 'lokua'], [5433, 'lokua_test']]) {
  const url = `postgres://lokua:lokua@127.0.0.1:${port}/${database}`;
  console.log(`Applying migrations to local ${database} on port ${port}`);
  run('pnpm', ['--filter', 'api', 'm:run'], {
    ...process.env,
    NODE_ENV: 'development',
    LOCAL_SMTP_PORT: '1025',
    DATABASE_URL: url,
    DATABASE_URL_DIRECT: url
  });
}
