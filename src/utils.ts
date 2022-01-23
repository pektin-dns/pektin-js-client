import crypto from "crypto";

import { promisify } from "util";
import { exec as exec_default } from "child_process";
import { NameServer, PektinClientConnectionConfigOverride } from "./types";
import fs from "fs/promises";
import path from "path";
const exec = promisify(exec_default);

export const randomString = (length = 100) => {
    return crypto.randomBytes(length).toString("base64url").replaceAll("=", "");
};

export const chmod = async (path: string, perms: string) => {
    await exec(`chmod ${perms} ${path}`);
};

export const chown = async (path: string, uid: string, gid: string) => {
    await exec(`chown ${uid}:${gid} ${path}`);
};

export const chownRecursive = async (path: string, uid: string, gid: string) => {
    await exec(`chown -R ${uid}:${gid} ${path}`);
};

export const createSingleScript = async (
    sourceFolder: string,
    scriptDestination: string,
    nsConfig: NameServer,
    recursive: any
) => {
    const dirs = await recursive(sourceFolder);
    const out = [];
    let content = ``;

    if (nsConfig?.createSingleScript?.cloneRepo) {
        content += `git clone https://github.com/pektin-dns/pektin-compose ; cd pektin-compose; `;
    }

    for (let i = 0; i < dirs.length; i++) {
        const basePath = dirs[i];
        const contents = await fs.readFile(basePath, "utf-8");
        const filePath = basePath.replace(sourceFolder, "");

        out.push({
            basePath,
            filePath,
            contents
        });
        content += `mkdir -p ${path.join(".", path.dirname(filePath))};`;

        content += `echo -ne '${contents.replaceAll("\n", "\\n")}' > ${path.join(".", filePath)};`;
    }

    if (nsConfig?.createSingleScript?.root?.installDocker) {
        content += `sudo sh scripts/systems/${nsConfig.createSingleScript.system}/install-docker.sh; `;
    }
    if (nsConfig?.createSingleScript?.root?.disableSystemdResolved) {
        content += `sudo sh scripts/systems/${nsConfig.createSingleScript.system}/disable-systemd-resolved.sh; `;
    }
    if (nsConfig?.createSingleScript?.setup) {
        content += `bash setup.sh; `;
    }
    if (nsConfig?.createSingleScript?.start) {
        content += `bash start.sh; `;
    }
    await fs.writeFile(scriptDestination, content + "history -d $(history 1)");
    return out;
};

export const configToCertbotIni = (cc: PektinClientConnectionConfigOverride) => {
    return `username = ${cc.username}
confidantPassword = ${cc.confidantPassword}
pektinApiEndpoint = ${cc.override?.pektinApiEndpoint}
`;
};

export const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",
    boldRed: "\x1b[31;1m",

    fg: {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
        crimson: "\x1b[38m" // Scarlet
    },
    bg: {
        black: "\x1b[40m",
        red: "\x1b[41m",
        green: "\x1b[42m",
        yellow: "\x1b[43m",
        blue: "\x1b[44m",
        magenta: "\x1b[45m",
        cyan: "\x1b[46m",
        white: "\x1b[47m",
        crimson: "\x1b[48m"
    }
};
