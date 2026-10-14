// Copies the web app into electron/app, makes a build icon, and sets the package
// version from the app revision in index.html (AMENDMENTS), e.g. 01.00.004 -> 1.0.4.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const here = path.resolve(__dirname, '..');
const appDir = path.join(here, 'app');
const buildDir = path.join(here, 'build');

fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
for (const f of ['index.html', 'quickstart.html', 'manifest.json', 'sw.js']) {
  fs.copyFileSync(path.join(root, f), path.join(appDir, f));
}
fs.cpSync(path.join(root, 'icons'), path.join(appDir, 'icons'), { recursive: true });

fs.mkdirSync(buildDir, { recursive: true });
fs.copyFileSync(path.join(root, 'icons', 'icon-512.png'), path.join(buildDir, 'icon.png'));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const major = (html.match(/const APP_MAJOR = "(\d+)"/) || [])[1];
const minor = (html.match(/const APP_MINOR = "(\d+)"/) || [])[1];
const revs = [...html.matchAll(/\{\s*rev:\s*"(\d+)"(?:[^}]*?minor:\s*"(\d+)")?/g)];
if (!major || !minor || !revs.length) {
  throw new Error('Could not read the app revision from index.html');
}
const last = revs[revs.length - 1];
const revision = `${major}.${last[2] || minor}.${last[1]}`;
const version = revision.split('.').map(n => String(parseInt(n, 10))).join('.');

const pkgPath = path.join(here, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
pkg.appRevision = revision;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`Prepared app revision ${revision} (package version ${version})`);
