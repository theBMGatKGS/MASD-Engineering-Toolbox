// Builds the Windows NSIS installer, named with the app revision (e.g. ...-Setup-01.00.004.exe).
const builder = require('electron-builder');
const pkg = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "package.json"), "utf8"));

builder.build({
  targets: builder.Platform.WINDOWS.createTarget('nsis', builder.Arch.x64),
  publish: 'never',
  config: {
    win: {
      ...pkg.build.win,
      artifactName: `MASD-Engineering-Toolbox-Setup-${pkg.appRevision}.\${ext}`
    }
  }
}).then(files => {
  console.log('Built:\n' + files.join('\n'));
}).catch(err => {
  console.error(err);
  process.exit(1);
});
