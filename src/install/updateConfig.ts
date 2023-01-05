import { promises as fs } from "fs";
import path from "path";
import { unsealVault } from "../vault/vault.js";
import { PC3 } from "../index.js";
import { config } from "dotenv";
import { genTraefikConfs } from "./traefik/traefik.js";
import { getMainNode } from "../pureFunctions.js";
import {
    createCspConnectSources,
    genStartScript,
    genStopScript,
    genUpdateScript,
} from "./compose.js";
import { TempDomain } from "../types.js";
import { PektinSetupClient } from "./first-start.js";
import { declareFs } from "@pektin/declare-fs";
import { deserializeEnvFile, readPektinConfig, serializeEnvFile } from "./utils.js";

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
    const pektinConfig = await readPektinConfig(path.join(dir, `pektin-config.yml`));

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
        proxyBasicAuthHashed,
    });

    // impl compose.compose-scripts
    // impl build
    // impl traefik.static-config.certificate-resolvers

    const user = `${process.env.UID}:${process.env.GID}`;

    const useTempDomain =
        pektinConfig.services.verkehr.tempZone.enabled &&
        traefikConfs.tempDomain &&
        pektinConfig.services.verkehr.routing === `domain`;

    const env = serializeEnvFile(
        await fs.readFile(path.join(dir, `secrets`, `.env`), {
            encoding: `utf-8`,
        })
    );
    env.LETSENCRYPT_EMAIL = pektinConfig.services.zertificat.acmeEmail;

    env.CSP_CONNECT_SRC = createCspConnectSources(pektinConfig, tempDomain);
    env.UI_BUILD_PATH = pektinConfig.services.ui.build.path;
    env.API_BUILD_PATH = pektinConfig.services.api.build.path;
    env.SERVER_BUILD_PATH = pektinConfig.services.server.build.path;
    env.TNT_BUILD_PATH = pektinConfig.services.tnt.build.path;
    env.RIBSTON_BUILD_PATH = pektinConfig.services.ribston.build.path;
    env.VAULT_BUILD_PATH = pektinConfig.services.vault.build.path;
    env.JAEGER_BUILD_PATH = pektinConfig.services.jaeger.build.path;
    env.PROMETHEUS_BUILD_PATH = pektinConfig.services.prometheus.build.path;
    env.ALERT_BUILD_PATH = pektinConfig.services.alert.build.path;
    env.GRAFANA_BUILD_PATH = pektinConfig.services.grafana.build.path;
    env.ZERTIFICAT_BUILD_PATH = pektinConfig.services.zertificat.build.path;
    env.VERKEHR_BUILD_PATH = pektinConfig.services.verkehr.build.path;
    env.UI_DOCKERFILE = pektinConfig.services.ui.build.dockerfile;
    env.API_DOCKERFILE = pektinConfig.services.api.build.dockerfile;
    env.SERVER_DOCKERFILE = pektinConfig.services.server.build.dockerfile;
    env.TNT_DOCKERFILE = pektinConfig.services.tnt.build.dockerfile;
    env.RIBSTON_DOCKERFILE = pektinConfig.services.ribston.build.dockerfile;
    env.VAULT_DOCKERFILE = pektinConfig.services.vault.build.dockerfile;
    env.JAEGER_DOCKERFILE = pektinConfig.services.jaeger.build.dockerfile;
    env.PROMETHEUS_DOCKERFILE = pektinConfig.services.prometheus.build.dockerfile;
    env.ALERT_DOCKERFILE = pektinConfig.services.alert.build.dockerfile;
    env.GRAFANA_DOCKERFILE = pektinConfig.services.grafana.build.dockerfile;
    env.ZERTIFICAT_DOCKERFILE = pektinConfig.services.zertificat.build.dockerfile;
    env.VERKEHR_DOCKERFILE = pektinConfig.services.verkehr.build.dockerfile;
    env.API_LOGGING = pektinConfig.services.api.logging;
    env.SERVER_LOGGING = pektinConfig.services.server.logging;
    env.USE_POLICIES = pektinConfig.usePolicies === false ? `false` : pektinConfig.usePolicies;

    let newEnvFile = deserializeEnvFile(env);
    newEnvFile += `# Some commands for debugging
# Logs into db (then try 'KEYS *' for example to get all record keys):
# bash -c 'docker exec -it $(docker ps --filter name=pektin-db --format {{.ID}}) keydb-cli --pass ${env.DB_PEKTIN_API_PASSWORD} --user db-pektin-api'`;

    await declareFs(
        {
            $ownerR: user,
            "start.sh": {
                $file: await genStartScript(pektinConfig),
                $perms: `700`,
            },
            "stop.sh": {
                $file: await genStopScript(pektinConfig),
                $perms: `700`,
            },
            "update.sh": {
                $file: await genUpdateScript(pektinConfig),
                $perms: `700`,
            },
            secrets: {
                ".env": newEnvFile,
                verkehr: {
                    dynamic: {
                        $perms: `777`,
                        "routing.yml": {
                            $file: traefikConfs.dynamic,
                            $perms: `644`,
                        },
                        ...(useTempDomain && {
                            "tempDomainRouting.yml": {
                                $file: traefikConfs.tempDomain,
                                $perms: `644`,
                            },
                        }),
                    },
                    "verkehr.yml": {
                        $file: traefikConfs.static,
                        $perms: `644`,
                    },
                },
                $perms: `700`,
            },
        },
        {
            method: `node`,
            basePath: dir,
        }
    );
};
