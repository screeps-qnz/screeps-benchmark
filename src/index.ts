import { validateServerFiles, validateServerConfiguration, getBotConfig, updateBotConfig, validateBotConfig } from "setup";
import { prepareTestRun, setupListener, runTests, checkServer, } from "server";
import { sleep, SLEEP_DEFAULT } from "./util";
import { DEFAULT_BOT_NAME } from "./constants";
import yesno from "yesno";
import { getCurrentTickWithOffset } from "stats";


const main = async () => {
  // skip non-windows for now
  if (process.platform !== "win32") {
    console.error(`only windows is supported for now, sorry :(`);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require("../package.json");
  console.log(`screeps-benchmark v${pkg.version}`);
  console.log(`-------------------------`);

  console.log(`validating server files...`);
  const serverExecutable = await validateServerFiles();
  if (serverExecutable === false) {
    console.log(`server files invalid, stopping`);
    process.exit(1);
  }
  console.log(`server files are up to date!`);

  console.log(`validating server config...`);
  const configPath = validateServerConfiguration();
  if (!configPath) {
    console.log(`server config is invalid.`);
    process.exit(1);
  }

  await validateBotConfig(configPath);

  console.log(`please start the server now, it is located here: ${serverExecutable}`);
  await sleep(SLEEP_DEFAULT);

  await checkServer().catch((msg) => {
    console.log(`server not available, error was: ${msg}`);
    return;
  })

  console.log("waiting for cli...");
  await sleep(SLEEP_DEFAULT);

  const rooms = ["W8N3", "W2N5", "W8N7"];
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  await prepareTestRun(rooms, 100);
  await setupListener(rooms);
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  await runTests(() => getCurrentTickWithOffset() > 20000);

}

process.on("exit", () => {
  console.log(`\nbenchmark ended, remember to stop the server too if needed!`);
});

main();
