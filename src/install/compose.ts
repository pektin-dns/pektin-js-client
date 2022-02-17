import { promises as fs } from "fs";
import path from "path";
import {
    chownRecursive,
    chown,
    chmod,
    randomString,
    requestPektinDomain,
    configToCertbotIni,
} from "./utils.js";
import crypto from "crypto";
/*@ts-ignore*/
import cfonts from "cfonts";

import { updateKvValue } from "../vault/vault.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";

import { genTraefikConfs } from "../traefik/index.js";
import { getMainNode } from "../pureFunctions.js";
import { PC3, TempDomain } from "../types.js";
import { concatDomain } from "../utils/index.js";
import { toASCII } from "../utils/puny.js";
import { installVault } from "./install-vault.js";

export const installPektinCompose = async (
    dir: string = `/pektin-compose/`,
    vaultUrl: string = `http://pektin-vault`
) => {
    cfonts.say(`install`, {
        font: `block`,
        align: `left`,
        colors: [`yellow`, `cyan`],
    });

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

    const {
        vaultTokens,
        recursorBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
        pektinAdminConnectionConfig,
        acmeClientConnectionConfig,
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

    await fs.writeFile(
        path.join(dir, `secrets`, `server-admin.pc3.json`),
        JSON.stringify(pektinAdminConnectionConfig)
    );
    if (acmeClientConnectionConfig) {
        await fs.writeFile(
            path.join(dir, `secrets`, `acme-client.pc3.json`),
            JSON.stringify(acmeClientConnectionConfig)
        );
        await fs.writeFile(
            path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`),
            configToCertbotIni(acmeClientConnectionConfig as PC3)
        );
    }
    // init redis access control
    const R_PEKTIN_API_PASSWORD = randomString();
    const R_PEKTIN_SERVER_PASSWORD = randomString();
    const R_PEKTIN_GEWERKSCHAFT_PASSWORD = randomString();

    const redisPasswords = [
        [`R_PEKTIN_API_PASSWORD`, R_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_SERVER_PASSWORD`, R_PEKTIN_SERVER_PASSWORD],
        [`R_PEKTIN_GEWERKSCHAFT_PASSWORD`, R_PEKTIN_GEWERKSCHAFT_PASSWORD],
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
            { R_PEKTIN_GEWERKSCHAFT_PASSWORD, pektinConfig, ...(tempDomain && { tempDomain }) },
            dir
        );
        await createSwarmScript(pektinConfig, dir);

        await chownRecursive(
            path.join(dir, `arbeiter`),
            process.env.UID || `700`,
            process.env.GID || `700`
        );
        await chown(path.join(dir, `swarm.sh`), process.env.UID, process.env.GID);
    }

    await setRedisPasswordHashes(redisPasswords, pektinConfig, dir);

    await fs
        .mkdir(path.join(dir, `secrets`, `traefik`, `dynamic`), { recursive: true })
        .catch(() => {});

    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        recursorAuth: recursorBasicAuthHashed,
        ...(tempDomain && { tempDomain }),
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
    // set the values in the .env file for provisioning them to the containers
    await envSetValues(
        {
            vaultTokens,
            R_PEKTIN_API_PASSWORD,
            R_PEKTIN_SERVER_PASSWORD,
            V_PEKTIN_API_PASSWORD,
            pektinConfig,
            recursorBasicAuthHashed,
            ...(tempDomain && { tempDomain }),
        },
        dir
    );

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

export const genBasicAuthHashed = (username: string, password: string) => {
    const hash = (a: string) =>
        crypto.createHash(`sha1`).update(a, `utf8`).digest().toString(`base64`);
    return `${username}:{SHA}${hash(password)}`;
};

export const genBasicAuthString = (username: string, password: string) => {
    const s = Buffer.from(`${username}:${password}`).toString(`base64`);
    return `Basic ${s}`;
};

export const createArbeiterConfig = async (
    v: {
        pektinConfig: PektinConfig;
        R_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
        tempDomain?: TempDomain;
    },
    dir: string
) => {
    for (let i = 0; i < v.pektinConfig.nodes.length; i++) {
        const node = v.pektinConfig.nodes[i];

        if (!node.main) {
            await fs
                .mkdir(path.join(dir, `arbeiter`, node.name, `secrets`, `traefik`, `dynamic`), {
                    recursive: true,
                })
                .catch(() => {});
            await fs
                .mkdir(path.join(dir, `arbeiter`, node.name, `secrets`, `redis`), {
                    recursive: true,
                })
                .catch(() => {});
            const R_PEKTIN_SERVER_PASSWORD = randomString();
            const redisAclFile = await setRedisPasswordHashes(
                [[`R_PEKTIN_SERVER_PASSWORD`, R_PEKTIN_SERVER_PASSWORD]],
                v.pektinConfig,
                dir,
                true
            );
            if (redisAclFile === undefined) {
                throw new Error(`This should never happen: createArbeiterConfig`);
            }
            await fs.writeFile(
                path.join(dir, `arbeiter`, node.name, `secrets`, `redis`, `users.acl`),
                redisAclFile
            );

            const redisConf = await fs.readFile(
                path.join(dir, `config`, `redis`, `arbeiter`, `redis.conf`),
                { encoding: `utf8` }
            );

            await fs.writeFile(
                path.join(dir, `arbeiter`, node.name, `secrets`, `redis`, `redis.conf`),
                redisConf.replace(`#MASTERAUTH`, v.R_PEKTIN_GEWERKSCHAFT_PASSWORD)
            );

            const repls = [[`R_PEKTIN_SERVER_PASSWORD`, R_PEKTIN_SERVER_PASSWORD]];

            const traefikConfs = genTraefikConfs({
                pektinConfig: v.pektinConfig,
                node: getMainNode(v.pektinConfig),
                tempDomain: v.tempDomain,
            });
            await fs.writeFile(
                path.join(
                    dir,
                    `arbeiter`,
                    node.name,
                    `secrets`,
                    `traefik`,
                    `dynamic`,
                    `default.yml`
                ),
                traefikConfs.dynamic
            );
            await fs.writeFile(
                path.join(dir, `arbeiter`, node.name, `secrets`, `traefik`, `static.yml`),
                traefikConfs.static
            );
            if (
                v.pektinConfig.reverseProxy.tempZone.enabled &&
                traefikConfs.tempDomain &&
                v.pektinConfig.reverseProxy.routing === `domain`
            ) {
                await fs.writeFile(
                    path.join(
                        dir,
                        `arbeiter`,
                        node.name,
                        `secrets`,
                        `traefik`,
                        `dynamic`,
                        `tempDomain.yml`
                    ),
                    traefikConfs.tempDomain
                );
            }

            /*
            traefik.tcp.routers.pektin-server-dot.tls.domains[0].main: "${SERVER_DOMAIN}"
            traefik.tcp.routers.pektin-server-dot.tls.domains[0].sans: "*.${SERVER_DOMAIN}"
            */

            let file = `# DO NOT EDIT THESE VARIABLES MANUALLY \n`;
            repls.forEach((repl) => {
                file = file += `${repl[0]}="${repl[1]}"\n`;
            });
            file += `# Some commands for debugging\n`;
            file += `# Logs into redis (then try 'KEYS *' for example to get all record keys):\n`;
            file += `# bash -c 'docker exec -it $(docker ps --filter name=pektin-redis --format {{.ID}}) redis-cli --pass ${R_PEKTIN_SERVER_PASSWORD} --user r-pektin-server'`;
            const composeCommand = `docker-compose --env-file secrets/.env -f pektin-compose/arbeiter/base.yml -f pektin-compose/traefik.yml`;

            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `secrets`, `.env`), file);
            const startScript = `${composeCommand} up -d`;

            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `start.sh`), startScript);

            const setupScript = `docker swarm leave\n`;
            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `setup.sh`), setupScript);

            const stopScript = `${composeCommand} down --remove-orphans`;
            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `stop.sh`), stopScript);

            const updateScript = `${composeCommand} pull\nsh start.sh`;
            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `update.sh`), updateScript);

            const resetScript = `${composeCommand} down --remove-orphans\ndocker swarm leave --force\ndocker volume rm pektin-compose_db\nrm -rf update.sh start.sh stop.sh secrets/ `;
            await fs.writeFile(path.join(dir, `arbeiter`, node.name, `reset.sh`), resetScript);
        }
    }
};

export const createSwarmScript = async (pektinConfig: PektinConfig, dir: string) => {
    let swarmScript = `docker swarm init \n`;
    pektinConfig.nodes.forEach((node, i) => {
        if (i === 0) return;
        swarmScript += `docker swarm join-token worker | grep docker >> arbeiter/${node.name}/setup.sh\n`;
    });

    await fs.writeFile(path.join(dir, `swarm.sh`), swarmScript);
};

export const setRedisPasswordHashes = async (
    repls: string[][],
    pektinConfig: PektinConfig,
    dir: string,
    arbeiter = false
) => {
    let readPath;
    if (arbeiter) {
        readPath = path.join(dir, `config`, `redis`, `arbeiter`, `users.template.acl`);
    } else {
        readPath =
            pektinConfig.nodes.length > 1
                ? path.join(dir, `config`, `redis`, `direktor`, `users.template.acl`)
                : path.join(dir, `config`, `redis`, `users.template.acl`);
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
    if (arbeiter) {
        return file;
    }
    await fs.mkdir(path.join(dir, `secrets`, `redis`), { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(dir, `secrets`, `redis`, `users.acl`), file);
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

export const envSetValues = async (
    v: {
        pektinConfig: PektinConfig;
        R_PEKTIN_API_PASSWORD: string;
        R_PEKTIN_SERVER_PASSWORD: string;
        V_PEKTIN_API_PASSWORD: string;
        vaultTokens: {
            key: string;
            rootToken: string;
        };
        recursorBasicAuthHashed: string;
        tempDomain?: TempDomain;
    },
    dir: string
) => {
    const repls = [
        [`V_PEKTIN_API_PASSWORD`, v.V_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_API_PASSWORD`, v.R_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_SERVER_PASSWORD`, v.R_PEKTIN_SERVER_PASSWORD],
        [`V_KEY`, v.vaultTokens.key],
        [`V_ROOT_TOKEN`, v.vaultTokens.rootToken],
        [`LETSENCRYPT_EMAIL`, v.pektinConfig.letsencrypt.letsencryptEmail],
        [`CSP_CONNECT_SRC`, createCspConnectSources(v.pektinConfig, v.tempDomain)],
        [`RECURSOR_AUTH`, v.recursorBasicAuthHashed],
        [`UI_BUILD_PATH`, v.pektinConfig.build.ui.path],
        [`API_BUILD_PATH`, v.pektinConfig.build.api.path],
        [`SERVER_BUILD_PATH`, v.pektinConfig.build.server.path],
        [`RECURSOR_BUILD_PATH`, v.pektinConfig.build.recursor.path],
        [`RIBSTON_BUILD_PATH`, v.pektinConfig.build.ribston.path],
        [`VAULT_BUILD_PATH`, v.pektinConfig.build.vault.path],
        [`USE_POLICIES`, v.pektinConfig.usePolicies],
    ];
    let file = `# DO NOT EDIT THESE VARIABLES MANUALLY  \n`;
    repls.forEach((repl) => {
        file = file += `${repl[0]}="${repl[1]}"\n`;
    });
    file += `# Some commands for debugging\n`;
    file += `# Logs into redis (then try 'KEYS *' for example to get all record keys):\n`;
    file += `# bash -c 'docker exec -it $(docker ps --filter name=pektin-redis --format {{.ID}}) redis-cli --pass ${v.R_PEKTIN_API_PASSWORD} --user r-pektin-api'`;
    await fs.writeFile(path.join(dir, `secrets`, `.env`), file);
};

export const createStartScript = async (pektinConfig: PektinConfig, dir: string) => {
    const p = path.join(dir, `start.sh`);
    let file = `#!/bin/sh\n
SCRIPTS_IMAGE_NAME=pektin/scripts
SCRIPTS_CONTAINER_NAME=pektin-scripts
ACTIVE_COMPOSE_FILES="${activeComposeFiles(pektinConfig)}"\n\n`;
    // create pektin compose command with different options
    let composeCommand = `docker-compose --env-file secrets/.env`;

    composeCommand += `\${ACTIVE_COMPOSE_FILES}`;
    composeCommand += ` up -d`;
    const buildAny =
        pektinConfig.build.ui.enabled ||
        pektinConfig.build.api.enabled ||
        pektinConfig.build.server.enabled;
    composeCommand += buildAny ? ` --build` : ``;

    // create start script
    // start vault
    file += `${composeCommand} vault\n`;
    // run pektin-start
    file += `
docker rm \${SCRIPTS_CONTAINER_NAME} -v &> /dev/null 
docker run --env UID=$(id -u) --env GID=$(id -g) --env FORCE_COLOR=3 --name \${SCRIPTS_CONTAINER_NAME} --network container:pektin-vault --mount "type=bind,source=$PWD,dst=/pektin-compose/" -it \${SCRIPTS_IMAGE_NAME} node ./dist/js/install/scripts.js compose-start\n`;
    // remove pektin-start artifacts
    file += `docker rm \${SCRIPTS_CONTAINER_NAME} -v &> /dev/null \n`;
    // compose up everything
    file += composeCommand;

    await fs.writeFile(p, file);
};

export const createStopScript = async (pektinConfig: PektinConfig, dir: string) => {
    const p = path.join(dir, `stop.sh`);
    let file = `#!/bin/sh\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);
    composeCommand += ` down`;
    file += composeCommand;

    await fs.writeFile(p, file);
};

export const createUpdateScript = async (pektinConfig: PektinConfig, dir: string) => {
    const p = path.join(dir, `update.sh`);
    let file = `#!/bin/sh\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);

    composeCommand += ` pull`;

    file += composeCommand + `\n`;
    file += `sh start.sh`;
    await fs.writeFile(p, file);
};

export const activeComposeFiles = (pektinConfig: PektinConfig) => {
    let composeCommand = ` -f pektin-compose/pektin.yml`;

    if (pektinConfig.nodes.length > 1) {
        composeCommand += ` -f pektin-compose/gewerkschaft-config.yml`;
    }
    if (pektinConfig.build.api.enabled) {
        composeCommand += ` -f pektin-compose/from-source/api.yml`;
    }
    if (pektinConfig.build.vault.enabled) {
        composeCommand += ` -f pektin-compose/from-source/vault.yml`;
    }
    if (pektinConfig.services.ui.enabled) {
        composeCommand += ` -f pektin-compose/services/ui.yml`;
        if (pektinConfig.build.ui.enabled) {
            composeCommand += ` -f pektin-compose/from-source/ui.yml`;
        }
    }
    if (pektinConfig.services.ribston.enabled) {
        composeCommand += ` -f pektin-compose/services/ribston.yml`;
        if (pektinConfig.build.ribston.enabled) {
            composeCommand += ` -f pektin-compose/from-source/ribston.yml`;
        }
    }
    if (pektinConfig.services.opa.enabled) {
        composeCommand += ` -f pektin-compose/services/opa.yml`;
    }

    if (pektinConfig.services.recursor.enabled) {
        composeCommand += ` -f pektin-compose/services/recursor.yml`;
        if (pektinConfig.build.recursor.enabled) {
            composeCommand += ` -f pektin-compose/from-source/recursor.yml`;
        }
    }

    if (pektinConfig.build.server.enabled) {
        composeCommand += ` -f pektin-compose/from-source/server.yml`;
    }

    if (pektinConfig.reverseProxy.createTraefik) {
        composeCommand += ` -f pektin-compose/traefik.yml`;
    }

    return composeCommand;
};
