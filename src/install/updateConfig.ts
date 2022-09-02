import { promises as fs } from "fs";
import path from "path";
import { unsealVault } from "../vault/vault.js";
import { PC3 } from "../index.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";
import { config } from "dotenv";
import { genTraefikConfs } from "./traefik/traefik.js";
import { getMainNode } from "../pureFunctions.js";
import { genStartScript, genStopScript, genUpdateScript } from "./compose.js";
import { TempDomain } from "../types.js";
import { PektinSetupClient } from "./first-start.js";
import { declareFs } from "@pektin/declare-fs";

config({ path: `/pektin-compose/secrets/.env` });

export const updateConfig = async (dir: string = `/pektin-compose/`) => {
    console.log(`Updating config`);

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

    const pc = new PektinSetupClient({
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

    const tntBasicAuthHashed = await pc.getAuth(`tnt`, true);
    const proxyBasicAuthHashed = await pc.getAuth(`proxy`, true);

    const tempDomain = (await pc.getPektinKv(`tempDomain`)).tempDomain as unknown as TempDomain;

    // impl compose.secrets.traefik.dynamic-config
    // through complete regeneration

    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        tntAuth: tntBasicAuthHashed,
        ...(tempDomain && { tempDomain }),
        perimeterAuthHashed: process.env.PERIMETER_AUTH_HASHED,
    });

    // impl compose.compose-scripts
    // impl build
    // impl traefik.static-config.certificate-resolvers

    const user = `${process.env.UID}:${process.env.GID}`;

    const useTempDomain =
        pektinConfig.services.verkehr.tempZone.enabled &&
        traefikConfs.tempDomain &&
        pektinConfig.services.verkehr.routing === `domain`;
    await declareFs(
        {
            "start.sh": {
                $file: await genStartScript(pektinConfig),
                $owner: user,
                $perms: `700`,
            },
            "stop.sh": {
                $file: await genStopScript(pektinConfig),
                $owner: user,
                $perms: `700`,
            },
            "update.sh": {
                $file: await genUpdateScript(pektinConfig),
                $owner: user,
                $perms: `700`,
            },
            secrets: {
                traefik: {
                    dynamic: {
                        "default.yml": {
                            $file: traefikConfs.dynamic,
                            $owner: user,
                            $perms: `600`,
                        },
                        ...(useTempDomain && {
                            "tempDomain.yml": traefikConfs.tempDomain,
                        }),
                    },
                    "static.yml": {
                        $file: traefikConfs.static,
                        $owner: user,
                        $perms: `600`,
                    },
                },
                $owner: user,
                $perms: `700`,
            },
        },
        {
            method: `node`,
            basePath: dir,
        }
    );
};
