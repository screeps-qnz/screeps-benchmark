import { validateServerFiles } from "setup";
import { startServer, killChildProcesses, prepareTestRun, setupListener, runTests, } from "server";
import { sleep, SLEEP_DEFAULT } from "./util";


const main = async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require("../package.json");
  console.log(`screeps-benchmark v${pkg.version}`);
  console.log(`-------------------------`);
  console.log(`validating server files...`);
  const serverExecutable = await validateServerFiles();
  if (serverExecutable === false) {
    console.log(`server files invalid, stopping`);
    killChildProcesses();
    process.exit(1);
  }
  console.log(`server files are up to date!`);

  console.log(`starting server...`);

  const result = await startServer(serverExecutable)
    .catch((success) => {
      if (!success) {
        console.log("error starting server, stopping");
        killChildProcesses();
        process.exit(1);
      }
    });
  console.log("ok.");

  console.log("waiting for cli...");
  await sleep(SLEEP_DEFAULT);

  const rooms = ["W8N3", "W2N5", "W8N7"];
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  await prepareTestRun(rooms, 100);
  await setupListener(rooms);
  runTests(rooms);

}

process.on("exit", () => {
  killChildProcesses();
});

main();
