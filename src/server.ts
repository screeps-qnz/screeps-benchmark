import cp, { ChildProcess } from "child_process";
import path from "path";
import treekill from "tree-kill";
import net from "net";
import { sleep, SLEEP_DEFAULT } from "./util";
import http from "http";
const ScreepsAPI = require("screeps-api").ScreepsAPI;

const TIMEOUT_SERVER_START = 600000;
const TIMEOUT_SERVER_WARN_INSTALL = 30000;
const PORT_SERVER = 21026;
const ADDRESS_SERVER = "127.0.0.1";

const children: ChildProcess[] = [];

const CONSTRUCTION_COST = {
  "spawn": 15000,
  "extension": 3000,
  "road": 300,
  "constructedWall": 1,
  "rampart": 1,
  "link": 5000,
  "storage": 30000,
  "tower": 5000,
  "observer": 8000,
  "powerSpawn": 100000,
  "extractor": 5000,
  "lab": 50000,
  "terminal": 100000,
  "container": 5000,
  "nuker": 100000,
  "factory": 100000
};

export const startServer = (filePath: string, params: any = []) => {
  const split = filePath.split(path.sep);
  split.pop();
  const directory = split.join(path.sep);

  return new Promise((resolve, reject) => {
    let isRunning = false;
    const cbRunning = (data: any) => {
      if (data.toString().includes("Exited with error")) {
        console.log(`[server] error: ${data}`);
        reject(false);
      }
      if (data.toString().includes("Started")) {
        isRunning = true;
        children.push(server);
        resolve(true);
      }
    }
    const server = cp.spawn(filePath, params, { cwd: directory });
    server.stdout!.setEncoding("utf8");
    server.stdout!.on("data", cbRunning);
    server.stderr!.on("data", cbRunning);
    server.on("close", (code, signal) => {
      console.log(`[server] closed: ${code} ${signal}`);
    });
    server.on("exit", (code, signal) => {
      console.log(`[server] exit: ${code} ${signal}`);
    })
    setTimeout(() => {
      if (isRunning) {
        return;
      }
      console.log(`this is taking a while... server might be installing/updating`)
    }, TIMEOUT_SERVER_WARN_INSTALL);
    setTimeout(() => {
      if (isRunning) {
        return;
      }
      console.error(`server startup timed out.`);
      console.log(`pid: ${server.pid}`);
      treekill(server.pid, "SIGINT");
      reject(false);
    }, TIMEOUT_SERVER_START);
  });
}

export const killChildProcesses = () => {
  children.forEach((child) => {
    treekill(child.pid, "SIGINT");
  });
}


export const runCli = (command: string) => new Promise((resolve, reject) => {
  const options: http.RequestOptions = {
    protocol: "http:",
    hostname: ADDRESS_SERVER,
    port: PORT_SERVER,
    path: "/cli",
    method: "POST",
    headers: {
      "Content-Length": command.length,
      "Content-Type": "text/plain"
    }

  }
  const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)

    res.on("data", d => {
      process.stdout.write(d)
    })
    resolve();
  })

  req.on("error", error => {
    console.error(error)
  })

  req.write(command);
  req.end()
})




export const prepareTestRun = async (rooms: string[], tickDuration: number) => new Promise(async (resolve, reject) => {
  await sleep(SLEEP_DEFAULT);
  console.log(`> system.resetAllData()`);
  await runCli(`system.resetAllData();`);
  await sleep(SLEEP_DEFAULT);
  console.log(`> system.pauseSimulation()`);
  await runCli(`system.pauseSimulation();`);
  await sleep(SLEEP_DEFAULT);
  console.log(`> system.setTickDuration(${tickDuration})`);
  await runCli(`system.setTickDuration(${tickDuration});`);
  for (const room of rooms) {
    console.log("> Spawn bot " + room);
    await runCli(`bots.spawn("test", "${room}", {username: "${room}", cpu: 100, gcl: 1});`);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    await sleep(1000);
  }

  console.log(`remove spawns and set auto spawn`);
  const command = `storage.db["users"].find({ username: { $in: ${JSON.stringify(rooms)} } })`
    + `.then( users => users.map(u => u._id))`
    + `.then(ids => {`
    + `storage.db["rooms.objects"].removeWhere({ type: "spawn", user: { $in: ids }  });`
    + `storage.db["rooms.objects"].update({ type: "controller", user: { $in: ids } }, { $set: { autoSpawn: true, safeMode: 20001 } });`
    + `storage.db["users"].update({_id: { $in: ids}}, {$set: { password:"70940896d3c0f14463079b1d7c8e3ecc7b13f2a81a9f9e0a0d8ce9bab510ec6d21548c1096c1adafbed945c394a0f541b62153bcb3f9dddd28cd3d0f1f90de41b3268eb44336a17e36cd2c56cb4cf744ac7fe24c48ea01a3152903fecf3ebc0e7a92f5c13ab9309b2282bbd222fc3402d86f776ec23804aabeafc360dc448f08db1b309cd7c0d7ea4fde38c16fe2f93fd87ce6c2a704966f44135f3d23475ae7a8be9ea28ef7d36a9f5dc0d5c637d6fb33045fb802c31f22bef9d730d8e452d46772ca0b0216dfef967bcc33acc2bf2b130d75c5b3dadc82ddda31a582e9fc392e8346b80047c0f5c7add2792b309c5b24590bcd435f99e22cb06c438ba4e5f618943dd22af63965722921a9fac9c0eeb786865db6b33c8087c7675df2eba0787679b1ae6b11b16ab65ebd095dcdf19d4cb24ab6bfb3bae8fb454f0a0730f093ba7e31e7f4faee3529a813161f9d640d7a97bbf7d4e6427c852e97bf220123d59b6cb87e0fd432ef677bcb8f4ac1d6e5353d30ccc2dceaf3e0cb76979ade6369036966e56441ed042c2667468410dc04d443ff05091c4d392e3bc2e9b0bffad8c96600eee3378a4470b3c38381c126aac7491b3a210022638d2a48ade371ea3da1a2d8969af4e743bd8c5031480d3b7dc98eb5200327372fe27cec49b38bca9f8dec09bd9ddf40f7afdbdc01eeeaf0b065d7bf61768b3dc3f270a3e8fc5e0b4d",salt: "574316bd256397c9c02429b89f7b7820c2510e3120df7f80a60ed3e5d91c4d0f"}})`
    + `})`
  await runCli(command);
  resolve();
});

const apis: {
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
      checkStructures(room, event.data);
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers
      if (event.data.gameTime - tickOffset > 20000) {
        process.exit(0);
      }
    });
    apis[room] = api;
  }
  resolve();
})

export const runTests = async (rooms: string[]) => {
  // run
  await sleep(SLEEP_DEFAULT);
  console.log(`> system.resumeSimulation()`);
  await runCli(`system.resumeSimulation(); `);
}



const structuresSeen: {
  [room: string]: {
    [id: string]: {
      lastseen: number;
      type: string;
    }
  }
} = {};
const controllerId: {
  [room: string]: string;
} = {};
const controller: {
  [room: string]: {
    [level: string]: number;
  }
} = {};
let tickOffset = -1;
const safeMode: {
  [room: string]: number;
} = {};

const checkStructures = (room: string, data: any) => {
  if (!structuresSeen[room]) {
    structuresSeen[room] = {};
  }
  if (!controller[room]) {
    controller[room] = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  if (tickOffset < 0 && safeMode[room] >= 20000 && data.gameTime) {
    tickOffset = data.gameTime || tickOffset;
  }
  for (const id in data.objects) {
    const obj = data.objects[id];
    // handle controller upgrade
    if (id === controllerId[room]) {
      if (obj.level && !controller[obj.level]) {
        controller[room][obj.level] = data.gameTime - tickOffset || -1;
        console.log(`[${data.gameTime - tickOffset}][${room}]: controller progress: level ${obj.level}`)
      }
    }

    // if we know the structure, update last seen
    if (structuresSeen[room][id]) {
      structuresSeen[room][id].lastseen = data.objects.gameTime - tickOffset || -1;
    } else {
      if (obj && obj.type && Object.keys(CONSTRUCTION_COST).includes(obj.type)) {
        if (obj.type !== "rampart") {
          console.log(`[${data.gameTime - tickOffset}][${room}]: new ${obj.type} detected: ${id}`);
        }
        structuresSeen[room][id] = {
          lastseen: data.gameTime,
          type: obj.type
        };
      }
      if (obj && obj.type === "controller") {
        console.log("controller detected")
        controllerId[room] = id;
        if (obj.safeMode) {
          safeMode[room] = obj.safeMode;
        }
      }
    }
  }
  if ((safeMode[room] - data.gameTick || Infinity) <= 0) {
    console.log(`[${data.gameTime - tickOffset}][${room}]: safemode ended.`);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.gameTick % 500 === 0) {
      console.log(`[${data.gameTime - tickOffset}][${room}]: ticks til safe mode end: ${safeMode[room] - data.gameTick} `)
    }
  }
}
