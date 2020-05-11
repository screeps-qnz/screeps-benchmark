import cp, { ChildProcess } from "child_process";
import path from "path";
import treekill from "tree-kill";

const TIMEOUT_SERVER_START = 60000;

const children: ChildProcess[] = [];

export const startServer = (filePath: string, params: any = []) => {
  const split = filePath.split(path.sep);
  split.pop();
  const directory = split.join(path.sep);

  return new Promise((resolve, reject) => {
    let isRunning = false;
    const server = cp.spawn(filePath, params, { cwd: directory });
    server.stdout!.setEncoding("utf8");
    server.stdout!.on("data", (data) => {
      if (data.toString().includes("Started")) {
        isRunning = true;
        children.push(server);
        resolve(true);
      }
    });
    server.stderr!.on("data", (data) => {
      if (data.toString().includes("Started")) {
        isRunning = true;
        children.push(server);
        resolve(true);
      }
    });
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
