import crypto from "crypto";

import { promisify } from "util";
import { exec as execDefault } from "child_process";
import fs from "fs/promises";
import path from "path";
import { PektinConfig } from "@pektin/config/src/config-types.js";
import { BasicAuthString, PC3, TempDomain } from "../types.js";
import f from "cross-fetch";
import c from "chalk";
import { toASCII } from "../index.js";
import { randomString } from "../utils/index.js";

const exec = promisify(execDefault);

export const genBasicAuthHashed = (username: string, password: string) => {
    const hash = (a: string) =>
        crypto.createHash(`sha1`).update(a, `utf8`).digest().toString(`base64`);
    return `${username}:{SHA}${hash(password)}`;
};

export const genBasicAuthString = (username: string, password: string): BasicAuthString => {
    const s = Buffer.from(`${username}:${password}`).toString(`base64`);
    return `Basic ${s}`;
};

export const generatePerimeterAuth = (): [BasicAuthString, string, string, string] => {
    const password = randomString(30);
    const username = randomString(30);
    return [
        genBasicAuthString(username, password),
        genBasicAuthHashed(username, password),
        username,
        password,
    ];
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

export const getFiles = async (dir: string) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files: any = await Promise.all(
        dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? getFiles(res) : res;
        })
    );
    return Array.prototype.concat(...files);
};

export const createSingleScript = async (sourceFolder: string, node: PektinConfig[`nodes`][0]) => {
    if (!node.setup) return;
    const dirs = await getFiles(sourceFolder);
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

        content += `echo -ne "${contents
            .replaceAll(`\n`, `\\n`)
            .replaceAll(`$`, `\\$`)
            .replaceAll(`"`, `\\"`)
            .replaceAll(`\``, `\\\``)}" > ${path.join(`.`, filePath)};`;
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
    return `${content}history -d -1 || true`;
};

export const configToCertbotIni = (cc: PC3) => `dns_pektin_username = ${cc.username}
dns_pektin_perimeter_auth = ${cc.perimeterAuth}
dns_pektin_confidant_password = ${cc.confidantPassword}
dns_pektin_api_endpoint = ${toASCII(cc.override?.pektinApiEndpoint)}
`;

export const requestPektinDomain = async (config: PektinConfig): Promise<TempDomain | false> => {
    const tempDomainProvider = config.reverseProxy.tempZone.provider;
    const routing = config.reverseProxy.tempZone.routing;
    const protcol = routing === `local` ? `http` : `https`;

    const address =
        routing === `local` ? `${tempDomainProvider}host.docker.internal` : tempDomainProvider;

    const err = () => {
        console.error(
            c.red.bold(
                `Couldn't get temp domain at address: ${address} for provider: ${tempDomainProvider}`
            )
        );
    };

    try {
        const res = await f(`${protcol}://${address}/v1/temp-domain`);
        const j = await res.json();
        if (!j.data.newZoneName) {
            err();
            return false;
        }
        const domain = j.data.newZoneName;

        if (typeof domain !== `string`) {
            err();
            return false;
        }

        return { domain, zoneDomain: tempDomainProvider };
    } catch (error) {
        err();
        return false;
    }
};
