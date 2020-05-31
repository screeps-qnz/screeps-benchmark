import { CONSTRUCTION_COST } from "./constants";

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

interface CpuEventData {
  cpu: number;
  memory: number;
}

const cpuData: {
  [room: string]: {
    [tick: string]: CpuEventData;
  }
} = {};

let currentTick = -1;

export const setTickOffset = (offset: number) => {
  tickOffset = offset;
}

export const addCpuData = (key: string, data: CpuEventData) => {
  if (!cpuData[key]) {
    cpuData[key] = {};
  }
  cpuData[key][currentTick] = data;
}

export const getCurrentTickWithOffset = () => currentTick - tickOffset;

export const checkStructures = (room: string, data: any) => {
  if (!structuresSeen[room]) {
    structuresSeen[room] = {};
  }
  if (!controller[room]) {
    controller[room] = {};
  }
  if (data.gameTime) {
    currentTick = data.gameTime;
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
        controllerId[room] = id;
        if (obj.safeMode) {
          safeMode[room] = obj.safeMode;
        }
      }
    }
  }
  if ((safeMode[room] - data.gameTime || Infinity) <= 0) {
    console.log(`[${data.gameTime - tickOffset}][${room}]: safemode ended.`);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    if (data.gameTick % 500 === 0) {
      console.log(`[${data.gameTime - tickOffset}][${room}]: ticks til safe mode end: ${safeMode[room] - data.gameTime} `)
    }
  }
}
