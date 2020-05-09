const ScreepsAPI = require("screeps-api").ScreepsAPI;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prompt = require('prompt-sync')({
  sigint: true
});

const tickDuration = 10;


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

const main = async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require("../package.json");
  console.log(`screeps-benchmark v.${pkg.version}`);
  console.log(`-------------------------`);
  const api = new ScreepsAPI({
    email: "qnz",
    password: "test",
    protocol: 'http',
    hostname: '127.0.0.1',
    port: 21025,
    path: '/' // Do no include '/api', it will be added automatically
  });
  await api.auth("qnz", "test");


  api.socket.connect()
  // Events have the structure of:
  // {
  //   channel: 'room',
  //   id: 'E3N3', // Only on certain events
  //   data: { ... }
  // }
  api.socket.on('connected', () => {
    // Do stuff after connected
  })
  api.socket.on('auth', (event: any) => {
    console.log("status", event.data.status); // contains either 'ok' or 'failed'
    // Do stuff after auth
  })

  // Events: (Not a complete list)
  // connected disconnected message auth time protocol package subscribe unsubscribe console

  // Subscribtions can be queued even before the socket connects or auths,
  // although you may want to subscribe from the connected or auth callback to better handle reconnects

  // Starting in 1.0, you can also pass a handler straight to subscribe!
  api.socket.subscribe('console', (event: any) => {
    // console.log(event.data.messages.log); // List of console.log output for tick
  })

  // api.socket.subscribe('cpu',(event)=>console.log('cpu',event.data))
  api.socket.subscribe('room:W8N3', (event: any) => {
    checkStructures(event.data);
  })
}
const structuresSeen: any = {}; // id: {lastseen:number, type: number}
let controllerId: any = "";
const controller: any = {}; // {[level:number]: number}
let tickOffset = 0;
let safeMode = 0;

const checkStructures = (data: any) => {
  for (const id in data.objects) {
    const obj = data.objects[id];
    // handle controller upgrade
    if (id === controllerId) {
      if (obj.level && !controller[obj.level]) {
        if (obj.level === 1) {
          tickOffset = data.gameTime || tickOffset;
        }
        controller[obj.level] = data.gameTime - tickOffset || -1;
        console.log(`${data.gameTime - tickOffset}: controller progress: level ${obj.level}`)
      }
    }

    // if we know the structure, update last seen
    if (structuresSeen[id]) {
      structuresSeen[id].lastseen = data.objects.gameTime - tickOffset || -1;
    } else {
      if (obj && obj.type && Object.keys(CONSTRUCTION_COST).includes(obj.type)) {
        if (obj.type !== "rampart") {
          console.log(`${data.gameTime - tickOffset}: new ${obj.type} detected: ${id}`);
        }
        structuresSeen[id] = {
          lastseen: data.gameTime,
          type: obj.type
        };
      }
      if (obj && obj.type === "controller") {
        controllerId = id;
        if (obj.safeMode) {
          safeMode = obj.safeMode;
        }
      }
    }
  }
  if ((safeMode - data.gameTick || Infinity) <= 0) {
    console.log(`${data.gameTime - tickOffset}: safemode ended.`);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.gameTick % 500 === 0) {
      console.log(`${data.gameTime - tickOffset}: ticks til safe mode end: ${safeMode - data.gameTick}`)
    }
  }
}

main();
