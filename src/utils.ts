import crypto from "crypto";

import { promisify } from "util";
import { exec as execDefault } from "child_process";
import fs from "fs/promises";
import path from "path";
import { PektinConfig } from "@pektin/config/src/types";
import { PektinClientConnectionConfigOverride } from "./types";
const exec = promisify(execDefault);

export const randomString = (length = 100) =>
    crypto.randomBytes(length).toString(`base64url`).replaceAll(`=`, ``);

export const chmod = async (path: string, perms: string) => {
    await exec(`chmod ${perms} ${path}`);
};

export const chown = async (path: string, uid: string, gid: string) => {
    await exec(`chown ${uid}:${gid} ${path}`);
};

export const chownRecursive = async (
    path: string,
    uid: string,
    gid: string
) => {
    await exec(`chown -R ${uid}:${gid} ${path}`);
};

export const createSingleScript = async (
    sourceFolder: string,
    scriptDestination: string,
    node: PektinConfig[`nodes`][0],
    recursive: any
) => {
    if (!node.setup) return;
    const dirs = await recursive(sourceFolder);
    const out = [];
    let content = ``;

    if (node?.setup?.cloneRepo) {
        content += `rm -rf pektin-compose; git clone https://github.com/pektin-dns/pektin-compose ; cd pektin-compose; bash reset.sh;`;
    }

    for (let i = 0; i < dirs.length; i++) {
        const basePath = dirs[i];
        const contents = await fs.readFile(basePath, `utf-8`);
        const filePath = basePath.replace(sourceFolder, ``);

        out.push({
            basePath,
            filePath,
            contents,
        });
        content += `mkdir -p ${path.join(`.`, path.dirname(filePath))};`;

        content += `echo -ne '${contents.replaceAll(
            `\n`,
            `\\n`
        )}' > ${path.join(`.`, filePath)};`;
    }

    if (node?.setup?.root?.installDocker) {
        content += `sudo sh scripts/systems/${node.setup.system}/install-docker.sh; `;
    }
    if (node?.setup?.root?.disableSystemdResolved) {
        content += `sudo sh scripts/systems/${node.setup.system}/disable-systemd-resolved.sh; `;
    }
    if (node?.setup?.setup) {
        content += `bash setup.sh; `;
    }
    if (node?.setup?.start) {
        content += `bash start.sh; `;
    }
    await fs.writeFile(scriptDestination, `${content}history -d -1 || true`);
    return out;
};

// TODO fix ribston policies, check acme client in vault

export const configToCertbotIni = (
    cc: PektinClientConnectionConfigOverride
) => `dns_pektin_username = ${cc.username}
dns_pektin_confidant_password = ${cc.confidantPassword}
dns_pektin_api_endpoint = ${cc.override?.pektinApiEndpoint}
`;
