import crypto from "crypto";

import { promisify } from "util";
import { exec as exec_default } from "child_process";
import { NameServer } from "./types";
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
