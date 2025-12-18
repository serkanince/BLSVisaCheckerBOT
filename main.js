const { spawn } = require('child_process');

(async function loop() {
  while (true) {
    await new Promise((resolve) => {
      const child = spawn('node', ['app.js'], { stdio: 'inherit' });
      child.on('exit', resolve);
    });
    console.log("10 minute...");
    await new Promise(res => setTimeout(res, 10 * 60 * 1000));
  }
})();