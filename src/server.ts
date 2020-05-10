/* eslint-disable no-shadow */
import * as https from "https";
import * as url from "url";
import path from "path";
import fs from "fs";
import rimraf from "rimraf";
import { resolve } from "dns";
import { rejects } from "assert";

interface GitHubReleaseAssetInfo {
  url: string;
  id: string;
  // eslint-disable-next-line camelcase
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  assets: GitHubReleaseAssetInfo[];
}

const DIR_SERVER = "server";

/**
 * checks whether server files are missing and updates as necessary
 * @param directory the directory to set up
 * @returns the executable path or false in case of an error
 */
export const validateServerFiles = async (directory: string = DIR_SERVER): Promise<string | false> => {

  const fsDir = path.join(__dirname, directory);
  // skip non-windows for now
  if (process.platform !== "win32") {
    console.error(`only windows is supported for now`);
    return false;
  }

  if (!fs.existsSync(fsDir)) {
    console.log(`creating server directory: ${directory}`)
    fs.mkdirSync(fsDir);
  }

  // check whether we have the latest executable
  const releaseUrl = await getCurrentReleaseUrl();
  if (releaseUrl === null) {
    console.error("an error occured while getting the server version info.");
    return false;
  }

  const executableFileName = getLeafFileNameFromUrl(releaseUrl);
  const shouldUpgrade = await isUpgradeNeeded(directory, executableFileName);

  if (shouldUpgrade) {
    console.log(`upgrade needed, clearing ${directory}...`);
    // clear directory
    rimraf.sync(fsDir);
    fs.mkdirSync(fsDir);
    console.log(`ok.`);
    console.log(`downloading current release from: ${releaseUrl}...`);
    const status = await downloadBinaryFile(releaseUrl, `${fsDir}${path.sep}${executableFileName}`);
    console.log("ok.");
  }

  return `${fsDir}${path.sep}${executableFileName}`;
}

const downloadBinaryFile = (from: string, to: string): Promise<boolean> => new Promise((resolve, reject) => {
  const file = fs.createWriteStream(to);
  const request = https.get(from, (res) => res.pipe(file));
  request.on("error", (err) => {
    console.error(err);
    reject(false);
  });
  request.on("finish", () => {
    resolve(true);
  })
});

/**
 * get the last part of an url
 * @param input the url
 */
const getLeafFileNameFromUrl = (input: string) => {
  const split = input.split("/");
  if (split.length > 0) {
    return split[split.length - 1];
  }
  return input;
}

/**
 * checks if a file exists for fileNameExecutable
 * @param directory the directory to check
 * @param fileNameExecutable the file to check for
 */
const isUpgradeNeeded = async (directory: string, fileNameExecutable: string): Promise<boolean | null> => {
  const directoryPath = path.join(__dirname, directory);
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        console.log(`unable to scan directory: ${err}`);
        reject(null);
      }
      for (const file of files) {
        if (file === fileNameExecutable) {
          return resolve(false);
        }
      }
      resolve(true);
    });
  });
}

/**
 * gets the appropiate asset url for the current os
 * @param releaseInfo the json info from github
 */
const findAssetUrlForOS = (releaseInfo: GitHubReleaseResponse): string | null => {
  if (process.platform === "win32") {
    for (const assetInfo of releaseInfo.assets) {
      if (assetInfo.browser_download_url.endsWith("_windows_amd64.exe")) {
        return assetInfo.browser_download_url;
      }
    }
  }
  return null;
}

/**
 * returns the current release url for screeps-launcher
 */
const getCurrentReleaseUrl = async (): Promise<string | null> => {
  // we can find the latest release files in https://api.github.com/repos/screepers/screeps-launcher/releases/latest
  const requestUrl = url.parse("https://api.github.com/repos/screepers/screeps-launcher/releases/latest");

  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: requestUrl.hostname,
      path: requestUrl.path,
      headers: { "User-Agent": "screeps-benchmark" }
    }, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        const releaseInfo = JSON.parse(body);
        resolve(findAssetUrlForOS(releaseInfo));
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}
