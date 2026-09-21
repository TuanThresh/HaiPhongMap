import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function postToOverpass(body: string, contentType: string) {
  return new Promise<{
    statusCode: number;
    body: string;
  }>((resolve, reject) => {
    const curl = spawn('curl.exe', [
      '-sS',
      '-w',
      '\n__HTTP_STATUS__:%{http_code}',
      '-A',
      'HaiPhongMapChallenge/0.1',
      '-H',
      `Content-Type: ${contentType}`,
      '--data-binary',
      '@-',
      'http://overpass.openstreetmap.fr/api/interpreter',
    ]);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    curl.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    curl.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    curl.on('error', reject);
    curl.on('close', (code) => {
      const responseText = Buffer.concat(stdout).toString('utf8');
      const match = responseText.match(/\n__HTTP_STATUS__:(\d+)$/);

      if (code !== 0 || !match) {
        reject(
          new Error(
            Buffer.concat(stderr).toString('utf8') ||
              `curl exited with code ${code ?? 'unknown'}`
          )
        );
        return;
      }

      resolve({
        statusCode: Number(match[1]),
        body: responseText.replace(/\n__HTTP_STATUS__:\d+$/, ''),
      });
    });
    curl.stdin.end(body);
  });
}

function overpassDevProxy(): Plugin {
  return {
    name: 'overpass-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/overpass/api/interpreter', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        const chunks: Buffer[] = [];

        req.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        req.on('end', async () => {
          try {
            const contentType = req.headers['content-type'];
            const body = Buffer.concat(chunks).toString('utf8');
            const response = await postToOverpass(
              body,
              Array.isArray(contentType)
                ? contentType[0]
                : contentType ?? 'application/x-www-form-urlencoded;charset=UTF-8'
            );

            res.statusCode = response.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(response.body);
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Overpass proxy failed',
              })
            );
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), overpassDevProxy()],
  // Base path configuration:
  // - GitHub Actions: '/vite-maplibre-react/' for GitHub Pages
  // - Local: './' for relative paths (allows opening dist/index.html directly)
  base: process.env.GITHUB_ACTIONS ? '/vite-maplibre-react/' : './',
});
