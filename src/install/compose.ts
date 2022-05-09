import { promises as fs } from "fs";
import path from "path";
import {
    chownRecursive,
    chown,
    requestPektinDomain,
    configToCertbotIni,
    generatePerimeterAuth,
} from "./utils.js";
import crypto from "crypto";
/*@ts-ignore*/
//import cfonts from "cfonts";

import { updateKvValue } from "../vault/vault.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";

import { genTraefikConfs } from "./traefik/traefik.js";
import { getMainNode, getPektinEndpoint } from "../pureFunctions.js";
import { PC3, TempDomain } from "../types.js";
import { concatDomain, randomString } from "../utils/index.js";
import { toASCII } from "../utils/puny.js";
import { installVault } from "./install-vault.js";
import { declareFs } from "@pektin/declare-fs";

export const installPektinCompose = async (
    dir: string = `/pektin-compose/`,
    vaultUrl: string = `http://pektin-vault`
) => {
    /*
    cfonts.say(`install`, {
        font: `block`,
        align: `left`,
        colors: [`yellow`, `cyan`],
    });
*/
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

    // creates secrets directory
    await fs.mkdir(path.join(dir, `secrets`), { recursive: true }).catch(() => {});

    /*
                        $$\                          $$\ $$\ 
                        \__|                         $$ |$$ |
     $$$$$$\   $$$$$$\  $$\        $$$$$$$\ $$$$$$\  $$ |$$ |
     \____$$\ $$  __$$\ $$ |      $$  _____|\____$$\ $$ |$$ |
     $$$$$$$ |$$ /  $$ |$$ |      $$ /      $$$$$$$ |$$ |$$ |
    $$  __$$ |$$ |  $$ |$$ |      $$ |     $$  __$$ |$$ |$$ |
    \$$$$$$$ |$$$$$$$  |$$ |      \$$$$$$$\\$$$$$$$ |$$ |$$ |
     \_______|$$  ____/ \__|       \_______|\_______|\__|\__|
              $$ |                                           
              $$ |                                           
              \__|
    */
    const [PERIMETER_AUTH, PERIMETER_AUTH_HASHED, perimeterUsername, perimeterPassword] =
        generatePerimeterAuth();

    const {
        vaultTokens,
        tntBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
        pektinAdminConnectionConfig,
        acmeClientConnectionConfig,
        V_PEKTIN_API_USER_NAME,
    } = await installVault({ pektinConfig });

    /*
    $$\                                 $$\             $$\           $$\                      
    $$ |                                $$ |            $$ |          \__|                     
    $$$$$$$\   $$$$$$\   $$$$$$\   $$$$$$$ |       $$$$$$$ | $$$$$$\  $$\ $$\    $$\  $$$$$$\  
    $$  __$$\  \____$$\ $$  __$$\ $$  __$$ |      $$  __$$ |$$  __$$\ $$ |\$$\  $$  |$$  __$$\ 
    $$ |  $$ | $$$$$$$ |$$ |  \__|$$ /  $$ |      $$ /  $$ |$$ |  \__|$$ | \$$\$$  / $$$$$$$$ |
    $$ |  $$ |$$  __$$ |$$ |      $$ |  $$ |      $$ |  $$ |$$ |      $$ |  \$$$  /  $$   ____|
    $$ |  $$ |\$$$$$$$ |$$ |      \$$$$$$$ |      \$$$$$$$ |$$ |      $$ |   \$  /   \$$$$$$$\ 
    \__|  \__| \_______|\__|       \_______|       \_______|\__|      \__|    \_/     \_______|
    */

    pektinAdminConnectionConfig.perimeterAuth = PERIMETER_AUTH;
    if (typeof acmeClientConnectionConfig === `object`) {
        acmeClientConnectionConfig.perimeterAuth = PERIMETER_AUTH;
    }

    // init db access control
    const DB_PEKTIN_API_PASSWORD = randomString();
    const DB_PEKTIN_SERVER_PASSWORD = randomString();
    const DB_PEKTIN_GEWERKSCHAFT_PASSWORD = randomString();

    const dbPasswords = [
        [`DB_PEKTIN_API_PASSWORD`, DB_PEKTIN_API_PASSWORD],
        [`DB_PEKTIN_SERVER_PASSWORD`, DB_PEKTIN_SERVER_PASSWORD],
        [`DB_PEKTIN_GEWERKSCHAFT_PASSWORD`, DB_PEKTIN_GEWERKSCHAFT_PASSWORD],
    ];

    const tempDomain = await requestPektinDomain(pektinConfig);

    await updateKvValue(
        vaultUrl,
        vaultTokens.rootToken,
        `tempDomain`,
        { tempDomain: tempDomain },
        `pektin-kv`
    );

    if (pektinConfig.nodes.length > 1) {
        await createArbeiterConfig(
            { DB_PEKTIN_GEWERKSCHAFT_PASSWORD, pektinConfig, ...(tempDomain && { tempDomain }) },
            dir
        );
        const swarmScript = await createSwarmScript(pektinConfig);
        await fs.writeFile(path.join(dir, `swarm.sh`), swarmScript);

        await chownRecursive(
            path.join(dir, `arbeiter`),
            process.env.UID || `600`,
            process.env.GID || `600`
        );
        await chown(path.join(dir, `swarm.sh`), process.env.UID, process.env.GID);
    }

    const dbPasswordHashes = await genDbPasswordHashes(dbPasswords, pektinConfig, dir);

    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        tntAuth: tntBasicAuthHashed,
        ...(tempDomain && { tempDomain }),
        proxyAuth: proxyBasicAuthHashed,
        perimeterAuthHashed: PERIMETER_AUTH_HASHED,
    });

    const externalVaultUrl = getPektinEndpoint(pektinConfig, `vault`);

    // set the values in the .env file for provisioning them to the containers
    const envFile = await genEnvValues({
        vaultTokens,
        DB_PEKTIN_API_PASSWORD,
        DB_PEKTIN_SERVER_PASSWORD,
        V_PEKTIN_API_PASSWORD,
        V_PEKTIN_API_USER_NAME,
        PERIMETER_AUTH,
        PERIMETER_AUTH_HASHED,
        perimeterUsername,
        perimeterPassword,
        externalVaultUrl,
        pektinConfig,
        tntBasicAuthHashed,
        ...(tempDomain && { tempDomain }),
    });

    const useTempDomain =
        pektinConfig.reverseProxy.tempZone.enabled &&
        traefikConfs.tempDomain &&
        pektinConfig.reverseProxy.routing === `domain`;

    const user = `${process.env.UID}:${process.env.GID}`;

    await declareFs(
        {
            $ownerR: user,
            $filePermsR: `600`,
            $folderPermsR: `700`,
            "start.sh": await genStartScript(pektinConfig),
            "stop.sh": await genStopScript(pektinConfig),
            "update.sh": await genUpdateScript(pektinConfig),
            secrets: {
                ".env": envFile,
                ...(acmeClientConnectionConfig && {
                    "acme-client.pc3.json": {
                        $file: JSON.stringify(acmeClientConnectionConfig),
                    },
                    "certbot-acme-client.pc3.ini": {
                        $file: configToCertbotIni(acmeClientConnectionConfig as PC3),
                    },
                }),
                "server-admin.pc3.json": {
                    $file: JSON.stringify(pektinAdminConnectionConfig),
                },
                db: {
                    "users.acl": { $file: dbPasswordHashes, $perms: `644` },
                },
                letsencrypt: {},
                traefik: {
                    dynamic: {
                        "default.yml": traefikConfs.dynamic,
                        ...(useTempDomain && { "tempDomain.yml": traefikConfs.tempDomain }),
                    },
                    "static.yml": traefikConfs.static,
                },
            },
        },
        { method: `node`, basePath: dir }
    );
};

export const createArbeiterConfig = async (
    v: {
        pektinConfig: PektinConfig;
        DB_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
        tempDomain?: TempDomain;
    },
    dir: string
) => {
    for (let i = 0; i < v.pektinConfig.nodes.length; i++) {
        const node = v.pektinConfig.nodes[i];

        if (!node.main) {
            await fs
                .mkdir(path.join(dir, `arbeiter`, node.name, `secrets`, `db`), {
                    recursive: true,
                })
                .catch(() => {});
            const DB_PEKTIN_SERVER_PASSWORD = randomString();
            const dbAclFile = await genDbPasswordHashes(
                [[`DB_PEKTIN_SERVER_PASSWORD`, DB_PEKTIN_SERVER_PASSWORD]],
                v.pektinConfig,
                dir,
                true
            );
            if (dbAclFile === undefined) {
                throw new Error(`This should never happen: createArbeiterConfig > dbAclFile`);
            }

            const dbConf = await fs.readFile(
                path.join(dir, `config`, `db`, `arbeiter`, `db.conf`),
                { encoding: `utf8` }
            );

            const repls = [
                [`DB_PEKTIN_SERVER_PASSWORD`, DB_PEKTIN_SERVER_PASSWORD],
                [`SERVER_LOGGING`, v.pektinConfig.services.server.logging],
            ];

            const traefikConfs = genTraefikConfs({
                pektinConfig: v.pektinConfig,
                node: node,
                tempDomain: v.tempDomain,
            });

            const useTempDomain =
                v.pektinConfig.reverseProxy.tempZone.enabled &&
                traefikConfs.tempDomain &&
                v.pektinConfig.reverseProxy.routing === `domain`;

            /*
            traefik.tcp.routers.pektin-server-dot.tls.domains[0].main: "${SERVER_DOMAIN}"
            traefik.tcp.routers.pektin-server-dot.tls.domains[0].sans: "*.${SERVER_DOMAIN}"
            */

            let envFile = `# DO NOT EDIT THESE VARIABLES MANUALLY \n`;
            repls.forEach((repl) => {
                envFile = envFile += `${repl[0]}="${repl[1]}"\n`;
            });
            envFile += `# Some commands for debugging\n`;
            envFile += `# Logs into db (then try 'KEYS *' for example to get all record keys):\n`;
            envFile += `# bash -c 'docker exec -it $(docker ps --filter name=pektin-db --format {{.ID}}) keydb-cli --pass ${DB_PEKTIN_SERVER_PASSWORD} --user db-pektin-server'`;
            const composeCommand = `docker-compose --env-file secrets/.env -f pektin-compose/arbeiter/base.yml -f pektin-compose/traefik.yml`;

            const resetScript = `${composeCommand} down --remove-orphans\ndocker swarm leave --force\ndocker volume rm pektin-compose_db\nrm -rf update.sh start.sh stop.sh secrets/ `;

            const user = `${process.env.UID}:${process.env.GID}`;
            declareFs(
                {
                    $ownerR: user,
                    $filePermsR: `600`,
                    $folderPermsR: `700`,
                    "start.sh": `${composeCommand} up -d`,
                    "setup.sh": `docker swarm leave\n`,
                    "stop.sh": `${composeCommand} down --remove-orphans`,
                    "update.sh": `${composeCommand} pull\nsh start.sh`,
                    "reset.sh": resetScript,
                    secrets: {
                        ".env": envFile,
                        db: {
                            "db.conf": {
                                $file: dbConf.replace(
                                    `#MASTERAUTH`,
                                    v.DB_PEKTIN_GEWERKSCHAFT_PASSWORD
                                ),
                                $perms: `644`,
                            },
                            "users.acl": { $file: dbAclFile, $perms: `644` },
                        },
                        traefik: {
                            "static.yml": traefikConfs.static,
                            dynamic: {
                                "default.yml": traefikConfs.dynamic,
                                ...(useTempDomain && { "tempDomain.yml": traefikConfs.tempDomain }),
                            },
                        },
                    },
                },
                { basePath: path.join(dir, `arbeiter`, node.name), method: `node` }
            );
        }
    }
};

export const createSwarmScript = async (pektinConfig: PektinConfig) => {
    const mainNode = getMainNode(pektinConfig);
    const advertiseAddress =
        mainNode.ips?.[0] || mainNode.legacyIps?.[0]
            ? `--advertise-addr ${mainNode.ips?.[0] ?? mainNode.legacyIps?.[0]}`
            : ``;

    let swarmScript = `docker swarm init ${advertiseAddress}\n`;
    pektinConfig.nodes.forEach((node, i) => {
        if (i === 0) return;
        swarmScript += `docker swarm join-token worker | grep docker >> arbeiter/${node.name}/setup.sh\n`;
    });

    return swarmScript;
};

export const genDbPasswordHashes = async (
    repls: string[][],
    pektinConfig: PektinConfig,
    dir: string,
    arbeiter = false
) => {
    let readPath;
    if (arbeiter) {
        readPath = path.join(dir, `config`, `db`, `arbeiter`, `users.template.acl`);
    } else {
        readPath =
            pektinConfig.nodes.length > 1
                ? path.join(dir, `config`, `db`, `direktor`, `users.template.acl`)
                : path.join(dir, `config`, `db`, `users.template.acl`);
    }
    let file = await fs.readFile(readPath, {
        encoding: `utf-8`,
    });

    const hash = (a: string) => {
        return crypto.createHash(`sha256`).update(a, `utf8`).digest().toString(`hex`);
    };

    repls.forEach((repl) => {
        file = file.replaceAll(RegExp(`${repl[0]}_SHA256$`, `gm`), `${hash(repl[1])}`);
    });

    return file;
    //crypto.create;
};

const createCspConnectSources = (c: PektinConfig, tempDomain?: TempDomain) => {
    const sources: string[] = [];
    let connectSources = ``;
    Object.values(c.services).forEach((service) => {
        /*@ts-ignore*/
        if (service.enabled !== false && service.domain) {
            /*@ts-ignore*/
            const fd = concatDomain(service.domain, service.subDomain);
            if (c.reverseProxy.routing === `local`) {
                sources.push(concatDomain(`localhost`, fd));
            } else if (c.reverseProxy.routing === `domain`) {
                sources.push(fd);
                if (c.reverseProxy.tempZone && tempDomain) {
                    sources.push(
                        concatDomain(
                            concatDomain(tempDomain.zoneDomain, tempDomain.domain),
                            /*@ts-ignore*/
                            service.subDomain
                        )
                    );
                }
            }
        }
    });

    if (sources.length) sources.forEach((e) => (connectSources += ` ` + toASCII(e)));
    return connectSources;
};

export const genEnvValues = async (v: {
    pektinConfig: PektinConfig;
    DB_PEKTIN_API_PASSWORD: string;
    DB_PEKTIN_SERVER_PASSWORD: string;
    V_PEKTIN_API_PASSWORD: string;
    V_PEKTIN_API_USER_NAME: string;
    PERIMETER_AUTH: string;
    PERIMETER_AUTH_HASHED: string;
    perimeterUsername: string;
    perimeterPassword: string;
    externalVaultUrl: string;
    vaultTokens: {
        key: string;
        rootToken: string;
    };
    tntBasicAuthHashed: string;
    tempDomain?: TempDomain;
}) => {
    const repls = [
        [`PERIMETER_AUTH`, v.PERIMETER_AUTH],
        [`PERIMETER_AUTH_HASHED`, v.PERIMETER_AUTH_HASHED],
        [`PERIMETER_USERNAME`, v.perimeterUsername],
        [`PERIMETER_PASSWORD`, v.perimeterPassword],
        [`VAULT_API_ADDR`, v.externalVaultUrl],

        [`V_PEKTIN_API_PASSWORD`, v.V_PEKTIN_API_PASSWORD],
        [`V_PEKTIN_API_USER_NAME`, v.V_PEKTIN_API_USER_NAME],
        [`DB_PEKTIN_API_PASSWORD`, v.DB_PEKTIN_API_PASSWORD],
        [`DB_PEKTIN_SERVER_PASSWORD`, v.DB_PEKTIN_SERVER_PASSWORD],
        [`V_KEY`, v.vaultTokens.key],
        [`V_ROOT_TOKEN`, v.vaultTokens.rootToken],
        [`LETSENCRYPT_EMAIL`, v.pektinConfig.letsencrypt.letsencryptEmail],
        [`CSP_CONNECT_SRC`, createCspConnectSources(v.pektinConfig, v.tempDomain)],
        [`TNT_AUTH`, v.tntBasicAuthHashed],

        [`UI_BUILD_PATH`, v.pektinConfig.services.ui.build.path],
        [`API_BUILD_PATH`, v.pektinConfig.services.api.build.path],
        [`SERVER_BUILD_PATH`, v.pektinConfig.services.server.build.path],
        [`TNT_BUILD_PATH`, v.pektinConfig.services.tnt.build.path],
        [`RIBSTON_BUILD_PATH`, v.pektinConfig.services.ribston.build.path],
        [`VAULT_BUILD_PATH`, v.pektinConfig.services.vault.build.path],

        [`UI_DOCKERFILE`, v.pektinConfig.services.ui.build.dockerfile],
        [`API_DOCKERFILE`, v.pektinConfig.services.api.build.dockerfile],
        [`SERVER_DOCKERFILE`, v.pektinConfig.services.server.build.dockerfile],
        [`TNT_DOCKERFILE`, v.pektinConfig.services.tnt.build.dockerfile],
        [`RIBSTON_DOCKERFILE`, v.pektinConfig.services.ribston.build.dockerfile],
        [`VAULT_DOCKERFILE`, v.pektinConfig.services.vault.build.dockerfile],
        [`API_LOGGING`, v.pektinConfig.services.api.logging],
        [`SERVER_LOGGING`, v.pektinConfig.services.server.logging],

        [`USE_POLICIES`, v.pektinConfig.usePolicies],
    ];
    let file = `# DO NOT EDIT THESE VARIABLES MANUALLY  \n`;
    repls.forEach((repl) => {
        file = file += `${repl[0]}="${repl[1]}"\n`;
    });
    file += `# Some commands for debugging\n`;
    file += `# Logs into db (then try 'KEYS *' for example to get all record keys):\n`;
    file += `# bash -c 'docker exec -it $(docker ps --filter name=pektin-db --format {{.ID}}) keydb-cli --pass ${v.DB_PEKTIN_API_PASSWORD} --user db-pektin-api'`;
    return file;
};

export const genStartScript = async (pektinConfig: PektinConfig) => {
    let file = `#!/bin/bash\n
bash scripts/update-config.sh\n
SCRIPTS_IMAGE_NAME=pektin/scripts
SCRIPTS_CONTAINER_NAME=pektin-scripts
ACTIVE_COMPOSE_FILES="${activeComposeFiles(pektinConfig)}"\n\n`;
    // create pektin compose command with different options
    let composeCommand = `docker-compose --env-file secrets/.env`;

    composeCommand += `\${ACTIVE_COMPOSE_FILES}`;
    composeCommand += ` up -d --remove-orphans`;
    const buildAny = Object.values(pektinConfig.services).some((service) => service.build.enabled);
    composeCommand += buildAny ? ` --build` : ``;

    // create start script
    // start vault
    file += `${composeCommand} vault\n`;
    // run pektin-start
    file += `
docker rm \${SCRIPTS_CONTAINER_NAME} -v &> /dev/null 
docker run --env UID=$(id -u) --env GID=$(id -g) --env FORCE_COLOR=3 --name \${SCRIPTS_CONTAINER_NAME} --user $(id -u):$(id -g) --network container:pektin-vault --mount "type=bind,source=$PWD,dst=/pektin-compose/" -it \${SCRIPTS_IMAGE_NAME} node ./dist/js/install/scripts.js compose-start\n`;
    // remove pektin-start artifacts
    file += `docker rm \${SCRIPTS_CONTAINER_NAME} -v &> /dev/null \n`;
    // compose up everything
    file += composeCommand;

    return file;
};

export const genStopScript = async (pektinConfig: PektinConfig) => {
    let file = `#!/bin/bash\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);
    composeCommand += ` down`;
    file += composeCommand;

    return file;
};

export const genUpdateScript = async (pektinConfig: PektinConfig) => {
    let file = `#!/bin/bash\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);

    composeCommand += ` pull`;

    file += composeCommand + `\n`;
    file += `bash start.sh`;
    return file;
};

export const activeComposeFiles = (pektinConfig: PektinConfig) => {
    let composeCommand = ` -f pektin-compose/pektin.yml`;

    if (pektinConfig.nodes.length > 1) {
        composeCommand += ` -f pektin-compose/gewerkschaft-config.yml`;
    }
    if (pektinConfig.services.api.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/api.yml`;
    }
    if (pektinConfig.services.vault.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/vault.yml`;
    }
    if (pektinConfig.services.ui.enabled) {
        composeCommand += ` -f pektin-compose/services/ui.yml`;
        if (pektinConfig.services.ui.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/ui.yml`;
        }
    }
    if (pektinConfig.services.ribston.enabled) {
        composeCommand += ` -f pektin-compose/services/ribston.yml`;
        if (pektinConfig.services.ribston.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/ribston.yml`;
        }
    }
    if (pektinConfig.services.opa.enabled) {
        composeCommand += ` -f pektin-compose/services/opa.yml`;
    }

    if (pektinConfig.services.tnt.enabled) {
        composeCommand += ` -f pektin-compose/services/tnt.yml`;
        if (pektinConfig.services.tnt.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/tnt.yml`;
        }
    }

    if (pektinConfig.services.server.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/server.yml`;
    }

    if (pektinConfig.reverseProxy.createTraefik) {
        composeCommand += ` -f pektin-compose/traefik.yml`;
    }

    return composeCommand;
};
