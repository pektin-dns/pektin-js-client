import { promises as fs } from "fs";
import path from "path";
import { chownRecursive, chown, chmod } from "./utils.js";
import { unsealVault } from "../vault/vault.js";
import { PC3 } from "../index.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";
import { config } from "dotenv";
import { genTraefikConfs } from "../traefik/index.js";
import { getMainNode } from "../pureFunctions.js";
import { createStartScript, createStopScript, createUpdateScript } from "./compose.js";
import { TempDomain } from "../types.js";
import { PektinComposeClient } from "./first-start.js";

config({ path: `/pektin-compose/secrets/.env` });

export const updateConfig = async (dir: string = `/pektin-compose/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const pektinConfig: PektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, `pektin-config.json`), {
            encoding: `utf-8`,
        })
    );

    const adminPC3: PC3 = JSON.parse(
        await fs.readFile(path.join(dir, `secrets`, `server-admin.pc3.json`), {
            encoding: `utf-8`,
        })
    );

    const pc = new PektinComposeClient({
        ...adminPC3,
        internal: true,
    });
    const internalVaultUrl = await pc.getPektinEndpoint(`vault`);

    if (process.env.V_KEY === undefined || process.env.V_ROOT_TOKEN === undefined) {
        throw Error(`Undefined vault key and/or root token`);
    }
    const vaultTokens = { key: process.env.V_KEY, rootToken: process.env.V_ROOT_TOKEN };

    // HTTP API CALL RELATED
    // init vault
    await unsealVault(internalVaultUrl, vaultTokens.key);

    // HARD DRIVE RELATED

    await fs
        .mkdir(path.join(dir, `secrets`, `traefik`, `dynamic`), { recursive: true })
        .catch(() => {});

    const recursorBasicAuthHashed = await pc.getAuth(`recursor`, true);

    const proxyBasicAuthHashed = await pc.getAuth(`proxy`, true);

    const tempDomain = (await pc.getPektinKv(`tempDomain`)) as unknown as TempDomain;

    // impl compose.secrets.traefik.dynamic-config
    // through complete regeneration

    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        recursorAuth: recursorBasicAuthHashed,
        tempDomain,
        proxyAuth: proxyBasicAuthHashed,
    });
    await fs.writeFile(
        path.join(dir, `secrets`, `traefik`, `dynamic`, `default.yml`),
        traefikConfs.dynamic
    );
    await fs.writeFile(path.join(dir, `secrets`, `traefik`, `static.yml`), traefikConfs.static);
    if (
        pektinConfig.reverseProxy.tempZone.enabled &&
        traefikConfs.tempDomain &&
        pektinConfig.reverseProxy.routing === `domain`
    ) {
        await fs.writeFile(
            path.join(dir, `secrets`, `traefik`, `dynamic`, `tempDomain.yml`),
            traefikConfs.tempDomain
        );
    }
    // impl compose.compose-scripts
    // impl build
    // impl traefik.static-config.certificate-resolvers

    await createStartScript(pektinConfig, dir);
    await createStopScript(pektinConfig, dir);
    await createUpdateScript(pektinConfig, dir);

    await fs.mkdir(path.join(dir, `secrets`, `letsencrypt`), { recursive: true }).catch(() => {});

    // change ownership of all created files to host user
    // also chmod 700 all secrets except for redis ACL
    await chown(path.join(dir, `start.sh`), process.env.UID, process.env.GID);
    await chown(path.join(dir, `stop.sh`), process.env.UID, process.env.GID);
    await chown(path.join(dir, `update.sh`), process.env.UID, process.env.GID);
    await chownRecursive(path.join(dir, `secrets`), process.env.UID, process.env.GID);
    await chmod(path.join(dir, `secrets`), `700`);
    await chmod(path.join(dir, `secrets`, `.env`), `600`);
    await chmod(path.join(dir, `secrets`, `acme-client.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `server-admin.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`), `600`);
};
