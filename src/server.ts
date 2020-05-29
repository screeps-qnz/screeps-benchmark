import cp, { ChildProcess } from "child_process";
import path from "path";
import treekill from "tree-kill";
import net from "net";
import { sleep, SLEEP_DEFAULT } from "./util";
import http from "http";
import { parseRoomEventData, parseCpuEventData } from "parser";
import { checkStructures, setTickOffset } from "stats";
import { DEFAULT_BOT_NAME } from "./constants";
const ScreepsAPI = require("screeps-api").ScreepsAPI;

const TIMEOUT_SERVER_START = 600000;
const TIMEOUT_SERVER_WARN_INSTALL = 30000;
const PORT_SERVER_CLI = 21026;
const PORT_SERVER_HTTP = 21025;
const ADDRESS_SERVER = "127.0.0.1";
const INTERVAL_CHECK_SERVER = 500;
const INTERVAL_ADD_USER = 1000;

export const checkServer = async () => new Promise(async (resolve, reject) => {
  setTimeout(() => {
    reject("timeout waiting for the server");
  }, TIMEOUT_SERVER_START);
  let success = false;
  while (!success) {
    await runCli(`console.log("test")`, false)
      .then(() => {
        resolve();
        success = true;
      })
      .catch(() => {
        console.log("server not ready yet...");
      });
    sleep(INTERVAL_CHECK_SERVER);
  }
});


export const runCli = (command: string, verboseError: boolean = true): Promise<string> => new Promise((resolve, reject) => {
  const options: http.RequestOptions = {
    protocol: "http:",
    hostname: ADDRESS_SERVER,
    port: PORT_SERVER_CLI,
    path: "/cli",
    method: "POST",
    headers: {
      "Content-Length": command.length,
      "Content-Type": "text/plain"
    }

  }
  const req = http.request(options, res => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      resolve(data);
    });
  })

  req.on("error", error => {
    if (verboseError) {
      console.error(error)
    }
    reject(error);
  })

  req.write(command);
  req.end()
});

export const getCurrentGameTime = (): Promise<number> => new Promise((resolve, reject) => {
  const options: http.RequestOptions = {
    protocol: "http:",
    hostname: ADDRESS_SERVER,
    port: PORT_SERVER_HTTP,
    path: "/api/game/time",
    method: "GET",

  }
  const req = http.get(options, res => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      try {
        const parsedData = JSON.parse(data);
        resolve(parsedData.time);
      } catch (exc) {
        reject(-1);
      }
    });
  });

  req.on("error", error => {
    console.error(error)
  });
});


export const prepareTestRun = async (rooms: string[], tickDuration: number): Promise<string> => new Promise(async (resolve, reject) => {
  console.log(`preparing test run...`);
  await sleep(SLEEP_DEFAULT);
  await runCli(`system.resetAllData();`).then((msg) => {
    if (msg.startsWith("Error")) {
      reject("error running initial resetAllData()");
    }
  }).catch((error) => {
    reject(error);
  })
  await sleep(SLEEP_DEFAULT);
  await runCli(`system.pauseSimulation();`);
  await sleep(SLEEP_DEFAULT);
  await runCli(`system.setTickDuration(${tickDuration});`);
  for (const room of rooms) {
    console.log(`spawning in ${room}`);
    await runCli(`bots.spawn("${DEFAULT_BOT_NAME}", "${room}", {username: "${room}", cpu: 100, gcl: 1});`).then((msg) => {
      if (msg.startsWith("Error")) {
        console.log(msg);
        reject("error spawning");
      }
    }).catch((error) => {
      reject(error);
    })
    await sleep(INTERVAL_ADD_USER);
  }
  const command = `storage.db["users"].find({ username: { $in: ${JSON.stringify(rooms)} } })`
    + `.then( users => users.map(u => u._id))`
    + `.then(ids => {`
    + `storage.db["rooms.objects"].removeWhere({ type: "spawn", user: { $in: ids }  });`
    + `storage.db["rooms.objects"].update({ type: "controller", user: { $in: ids } }, { $set: { autoSpawn: true, safeMode: 20001 } });`
    + `storage.db["users"].update({_id: { $in: ids}}, {$set: { password:"70940896d3c0f14463079b1d7c8e3ecc7b13f2a81a9f9e0a0d8ce9bab510ec6d21548c1096c1adafbed945c394a0f541b62153bcb3f9dddd28cd3d0f1f90de41b3268eb44336a17e36cd2c56cb4cf744ac7fe24c48ea01a3152903fecf3ebc0e7a92f5c13ab9309b2282bbd222fc3402d86f776ec23804aabeafc360dc448f08db1b309cd7c0d7ea4fde38c16fe2f93fd87ce6c2a704966f44135f3d23475ae7a8be9ea28ef7d36a9f5dc0d5c637d6fb33045fb802c31f22bef9d730d8e452d46772ca0b0216dfef967bcc33acc2bf2b130d75c5b3dadc82ddda31a582e9fc392e8346b80047c0f5c7add2792b309c5b24590bcd435f99e22cb06c438ba4e5f618943dd22af63965722921a9fac9c0eeb786865db6b33c8087c7675df2eba0787679b1ae6b11b16ab65ebd095dcdf19d4cb24ab6bfb3bae8fb454f0a0730f093ba7e31e7f4faee3529a813161f9d640d7a97bbf7d4e6427c852e97bf220123d59b6cb87e0fd432ef677bcb8f4ac1d6e5353d30ccc2dceaf3e0cb76979ade6369036966e56441ed042c2667468410dc04d443ff05091c4d392e3bc2e9b0bffad8c96600eee3378a4470b3c38381c126aac7491b3a210022638d2a48ade371ea3da1a2d8969af4e743bd8c5031480d3b7dc98eb5200327372fe27cec49b38bca9f8dec09bd9ddf40f7afdbdc01eeeaf0b065d7bf61768b3dc3f270a3e8fc5e0b4d",salt: "574316bd256397c9c02429b89f7b7820c2510e3120df7f80a60ed3e5d91c4d0f"}})`
    + `})`
  await runCli(command);
  console.log(`server is ready to run!`);
  const time = await getCurrentGameTime();
  setTickOffset(time);
  await sleep(INTERVAL_CHECK_SERVER);
  resolve();
});

const sockets: {
  [room: string]: any
} = {};

export const setupListener = async (rooms: string[]) => new Promise(async (resolve, reject) => {
  for (const room of rooms) {
    const api = new ScreepsAPI({
      email: room,
      password: "password",
      protocol: "http",
      hostname: "127.0.0.1",
      port: 21025,
      path: "/"
    });
    await api.auth(room, "password");

    api.socket.connect()

    api.socket.on("auth", (event: any) => {
      console.log(`auth status ${room}`, event.data.status);
    })

    api.socket.subscribe(`room:${room}`, (event: any) => {
      parseRoomEventData(room, event);
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      if (event.data.gameTime > 20000) {
        process.exit(0);
      }
    });

    api.socket.subscribe(`cpu`, (event: any) => {
      parseCpuEventData(room, event);
    });

    sockets[room] = api;
  }
  resolve();
})

export const runTests = async (rooms: string[]) => {
  // run
  await sleep(SLEEP_DEFAULT);
  console.log(`> system.resumeSimulation()`);
  await runCli(`system.resumeSimulation(); `);
}



