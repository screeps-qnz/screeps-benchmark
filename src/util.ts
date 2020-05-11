export const SLEEP_DEFAULT = 5000;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
