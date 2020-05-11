import childProcess, { ChildProcessWithoutNullStreams } from "child_process";
import path from "path";

const TIMEOUT_SERVER_START = 6000;

const children: ChildProcessWithoutNullStreams[] = [];

export const startServer = (filePath: string, params: any = []) => {
  const split = filePath.split(path.sep);
  split.pop();
  const directory = split.join(path.sep);

  return new Promise((resolve, reject) => {
    const server = childProcess.spawn(filePath, params, { cwd: directory, });
    server.stdout.setEncoding('utf8');
    server.stdout!.on("data", (data) => {
      if (data.toString().includes("Started")) {
        children.push(server);
        // resolve(true);
      }
    });
    server.stderr.on("data", (data) => {
      if (data.toString().includes("Started")) {
        children.push(server);
        // resolve(true);
      }
    });
    server.on("close", (code, signal) => {
      console.log(`[server] closed: ${code} ${signal}`);
    });
    setTimeout(() => {
      console.error(`server startup timed out.`);
      server.kill();
      reject(false);
    }, TIMEOUT_SERVER_START);
  });
}

export const killChildProcesses = () => {
  children.forEach((child) => {
    child.kill();
  });
}
