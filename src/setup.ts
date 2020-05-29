/* eslint-disable no-shadow */
import https from "https";
import * as url from "url";
import path from "path";
import fs from "fs";
import rimraf from "rimraf";
import yaml from "js-yaml";
import { serverDefaultConfig } from "defaultConfig";
import yesno from "yesno";
import { DEFAULT_BOT_NAME } from "./constants";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prompt = require("prompt");

interface GitHubReleaseAssetInfo {
  url: string;
  id: string;
  // eslint-disable-next-line camelcase
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  assets: GitHubReleaseAssetInfo[];
}

export interface ParsedSLConfig {
  steamKey: string;
  mods: string[];
  bots: { [bot: string]: string };
  serverConfig: {
    tickRate: number;
  };
}

const DIR_SERVER = "server";
const CONFIG_NAME = "config.yml";
const HTTP_OK = 200;
const HTTP_MULTIPLE_CHOICES = 300;

/**
 * checks whether server files are missing and updates as necessary
 * @param directory the directory to set up
 * @returns the executable path or false in case of an error
 */
export const validateServerFiles = async (directory: string = DIR_SERVER): Promise<string | false> => {

  const fsDir = path.join(__dirname, directory);

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

  console.log(`checking for server executable update...`);
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
    if (!status) {
      console.error(`error downloading.`);
      return false;
    }
    console.log("ok.");
  } else {
    console.log(`server executable is up to date.`)
  }

  return `${fsDir}${path.sep}${executableFileName}`;
}

export const validateServerConfiguration = (directory: string = DIR_SERVER): string | false => {
  console.log(`checking ${CONFIG_NAME}...`);
  const fsDir = path.join(__dirname, directory);
  const validConfig = isConfigValid(`${fsDir}${path.sep}${CONFIG_NAME}`);
  if (!validConfig) {
    return false;
  }

  console.log("ok");
  return `${fsDir}${path.sep}${CONFIG_NAME}`;
}

export const getBotConfig = (configPath: string): { [bot: string]: string } | false => {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const config: ParsedSLConfig = yaml.safeLoad(content);
    return config.bots;
  } catch (exc) {
    console.error(`an error occured while reading the config: ${exc}`);
    return false;
  }
}

export const updateBotConfig = (configPath: string, bots: { [bot: string]: string }): boolean => {
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const config: ParsedSLConfig = yaml.safeLoad(content);
    config.bots = bots;
    const newContent = yaml.safeDump(config);
    fs.writeFileSync(configPath, newContent, "utf8");
    return true;
  } catch (exc) {
    console.error(`an error occured while reading the config: ${exc}`);
    return false;
  }
}

const isConfigValid = (configPath: string, createIfNotExists: boolean = true): boolean => {
  if (!fs.existsSync(configPath)) {
    console.error(`config not found at ${configPath}`);
    if (createIfNotExists) {
      console.log(`writing default config...`);
      fs.writeFileSync(configPath, yaml.safeDump(serverDefaultConfig))
      console.log(`ok`);
    }
  }
  try {
    const content = fs.readFileSync(configPath, "utf8");
    const config: ParsedSLConfig = yaml.safeLoad(content);
    if (!config.steamKey || config.steamKey.length === 0) {
      console.error(`the config needs a valid steamKey`);
      console.log(`check the README of screeps-launcher on how to get yours @ https://github.com/screepers/screeps-launcher`);
      console.log(`your config file is located here: ${configPath}`);
      return false;
    }
    return true;
  } catch (exc) {
    console.error(`an error occured while reading the config: ${exc}`);
    return false;
  }
}

const downloadBinaryFile = (from: string, to: string): Promise<boolean> => new Promise((resolve, reject) => {
  const file = fs.createWriteStream(to);
  const request = https.get(from, (res) => {
    if (res.statusCode && res.statusCode >= HTTP_OK && res.statusCode < HTTP_MULTIPLE_CHOICES) {
      res.pipe(file);
    } else if (res.headers.location) {
      resolve(downloadBinaryFile(res.headers.location, to));
    } else {
      file.close();
      fs.unlink(to, () => { /* */ });
      console.error(`server response: ${res.statusCode} - ${res.statusMessage}`);
      reject(false);
    }
  });
  request.on("error", (err) => {
    console.error(err);
    file.close();
    fs.unlink(to, () => { /* */ });
    reject(false);
  });
  file.on("finish", () => {
    resolve(true);
  });
  file.on("error", (err) => {
    console.log(`file error: ${err}`);
    reject(false);
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


export const validateBotConfig = async (configPath: string) => {
  let shouldUpdateBots = false;
  const bots = getBotConfig(configPath);
  if (Object.keys(bots).length === 0) {
    shouldUpdateBots = true;
  }
  console.log(`the following bots are configured:`);
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  console.log(JSON.stringify(bots, null, 2));

  const botConfigOK = await yesno({ question: "is this okay?" });

  if (shouldUpdateBots || !botConfigOK) {
    prompt.start();
    prompt.get("botPath", (err: any, result: any) => {
      if (err) {
        console.log(`error: ${err}`);
        return;
      }
      // updateBotConfig(configPath, { [DEFAULT_BOT_NAME]: `".\\\\..\\\\..\\\\..\\\\screeps-novatipu\\\\dist"` });
      updateBotConfig(configPath, { [DEFAULT_BOT_NAME]: result.botPath });
      console.log(`okay, path has been updated to ${result.botPath}`);
    });

  }
}
