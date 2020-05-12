import { checkStructures, addCpuData } from "stats"

export const parseRoomEventData = (key: string, event: any) => {
  checkStructures(key, event.data);
}

export const parseCpuEventData = (key: string, event: any) => {
  addCpuData(key, event.data);
}
