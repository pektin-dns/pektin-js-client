import { promises as fs } from "fs";
import path from "path";
import {
    requestPektinDomain,
    configToCertbotIni,
    generatePerimeterAuth,
    genCertsScript,
} from "./utils.js";
import crypto from "crypto";
/*@ts-ignore*/
//import cfonts from "cfonts";

import { updateKvValue } from "../vault/vault.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";

import { genTraefikConfs } from "./traefik/traefik.js";
import { getMainNode, getPektinEndpoint } from "../pureFunctions.js";
import { PC3, TempDomain, ZertificatConsumerAccount, ZertificatManagerAccount } from "../types.js";
import { concatDomain, randomString, toBase64 } from "../utils/index.js";
import { toASCII } from "../utils/puny.js";
import { installVault } from "./install-vault.js";
import { declareFs } from "@pektin/declare-fs";
import { exec as exec_old } from "child_process";
import util from "util";
const exec = util.promisify(exec_old);

// this is for compat reasons
import _ from "lodash";
const { cloneDeep } = _;

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
    const [PERIMETER_AUTH, PERIMETER_AUTH_HASHED] = generatePerimeterAuth();

    const {
        vaultTokens,
        tntBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
        pektinAdminConnectionConfig,
        acmeClientConnectionConfig: acmeClientConnectionConfigExternal,
        V_PEKTIN_API_USER_NAME,
        zertificatManagerAccount,
        zertificatConsumerAccount,
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
    if (typeof acmeClientConnectionConfigExternal === `object`) {
        acmeClientConnectionConfigExternal.perimeterAuth = PERIMETER_AUTH;
    }

    const wgConfigs = await genWgConfigs(pektinConfig);

    // init db access control
    const DB_PEKTIN_API_PASSWORD = randomString();
    const DB_PEKTIN_SERVER_PASSWORD = randomString();
    const DB_PEKTIN_GEWERKSCHAFT_PASSWORD = randomString();

    const acmeClientConnectionConfigInternal = cloneDeep(acmeClientConnectionConfigExternal);
    if (
        typeof acmeClientConnectionConfigInternal !== `boolean` &&
        acmeClientConnectionConfigInternal?.override?.pektinApiEndpoint !== undefined
    ) {
        acmeClientConnectionConfigInternal.override.pektinApiEndpoint = `http://pektin-api`;
    }

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
            {
                DB_PEKTIN_GEWERKSCHAFT_PASSWORD,
                pektinConfig,
                ...(tempDomain && { tempDomain }),
                arbeiterWgConfigs: wgConfigs?.arbeiterWgConfigs,
            },
            dir
        );
    }

    const dbPasswordHashes = await genDbPasswordHashes(dbPasswords, pektinConfig, dir);

    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        tntAuth: tntBasicAuthHashed,
        ...(tempDomain && { tempDomain }),
        perimeterAuthHashed: PERIMETER_AUTH_HASHED,
        proxyBasicAuthHashed,
    });

    const externalVaultUrl = getPektinEndpoint(pektinConfig, `vault`);

    // set the values in the .env file for provisioning them to the containers
    const envFile = await genEnvValues({
        vaultTokens,
        DB_PEKTIN_API_PASSWORD,
        DB_PEKTIN_SERVER_PASSWORD,
        V_PEKTIN_API_PASSWORD,
        V_PEKTIN_API_USER_NAME,
        externalVaultUrl,
        pektinConfig,
        proxyBasicAuthHashed,
        acmeClientConnectionConfigInternal,
        zertificatManagerAccount,
        zertificatConsumerAccount,
        ...(tempDomain && { tempDomain }),
    });

    const useTempDomain =
        pektinConfig.services.verkehr.tempZone.enabled &&
        traefikConfs.tempDomain &&
        pektinConfig.services.verkehr.routing === `domain`;

    const user = `${process.env.UID}:${process.env.GID}`;

    await declareFs(
        {
            $ownerR: user,
            $filePermsR: `600`,
            $folderPermsR: `700`,
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
                ".env": envFile,
                ...(acmeClientConnectionConfigExternal && {
                    certs: {
                        "acme-client-external.pc3.json": JSON.stringify(
                            acmeClientConnectionConfigExternal
                        ),
                        "acme-client-internal.pc3.json": JSON.stringify(
                            acmeClientConnectionConfigInternal
                        ),
                        "certbot-acme-client-external.pc3.ini": configToCertbotIni(
                            acmeClientConnectionConfigExternal as PC3
                        ),
                        "certbot-acme-client-internal.pc3.ini": configToCertbotIni(
                            acmeClientConnectionConfigExternal as PC3,
                            true
                        ),
                        "generate-certs-internal.sh": genCertsScript(pektinConfig, true),
                        "generate-certs-external.sh": genCertsScript(pektinConfig),
                        letsencrypt: {},
                    },
                }),
                "server-admin.pc3.json": {
                    $file: JSON.stringify(pektinAdminConnectionConfig),
                },
                db: {
                    "users.acl": {
                        $file: dbPasswordHashes,
                        $perms: `644`,
                    },
                    "wg0.conf": {
                        $file: wgConfigs?.direktorWgConfig,
                        $perms: `644`,
                    },
                },
                verkehr: {
                    dynamic: {
                        $perms: `777`,
                        "routing.yml": { $file: traefikConfs.dynamic, $perms: `644` },
                        ...(useTempDomain && {
                            "tempDomainRouting.yml": {
                                $file: traefikConfs.tempDomain,
                                $perms: `644`,
                            },
                        }),
                    },
                    "verkehr.yml": { $file: traefikConfs.static, $perms: `644` },
                },
            },
            "overrides.yml": { $fileNoOverwrite: `version: "3.7"` },
        },
        { method: `node`, basePath: dir }
    );
};

export const createArbeiterConfig = async (
    v: {
        pektinConfig: PektinConfig;
        DB_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
        tempDomain?: TempDomain;
        arbeiterWgConfigs?: string[];
    },
    dir: string
) => {
    const nodes = v.pektinConfig.nodes.filter((n) => !n.main);
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        await fs
            .mkdir(path.join(dir, `arbeiter`, node.name), {
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

        const dbConf = await fs.readFile(path.join(dir, `config`, `db`, `arbeiter`, `db.conf`), {
            encoding: `utf8`,
        });

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
            v.pektinConfig.services.verkehr.tempZone.enabled &&
            traefikConfs.tempDomain &&
            v.pektinConfig.services.verkehr.routing === `domain`;

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
        const composeCommand = `docker compose --env-file secrets/.env -f pektin-compose/arbeiter/base.yml -f pektin-compose/services/verkehr.yml`;

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
                            $file: dbConf.replace(`#MASTERAUTH`, v.DB_PEKTIN_GEWERKSCHAFT_PASSWORD),
                            $perms: `644`,
                        },
                        "users.acl": {
                            $file: dbAclFile,
                            $perms: `644`,
                        },
                        "wg0.conf": {
                            $file: v.arbeiterWgConfigs?.[i],
                            $perms: `644`,
                        },
                    },
                    verkehr: {
                        "verkehr.yml": traefikConfs.static,
                        dynamic: {
                            "routing.yml": traefikConfs.dynamic,
                            ...(useTempDomain && {
                                "tempDomainRouting.yml": traefikConfs.tempDomain,
                            }),
                        },
                    },
                },
            },
            {
                basePath: path.join(dir, `arbeiter`, node.name),
                method: `node`,
            }
        );
    }
};

export const genWgConfigs = async (pektinConfig: PektinConfig) => {
    const nodes = [];
    for (let i = 0; i < pektinConfig.nodes.length; i++) {
        const node = pektinConfig.nodes[i];
        const { privkey, pubkey } = await genWgKeys();
        nodes.push({ main: node.main, privkey, pubkey });
    }

    const main = nodes.find((x) => x.main);
    if (!main) return;

    let direktorWgConfig = `[Interface]
PrivateKey = ${main.privkey}
ListenPort = 51820
Address = 10.111.0.1
`;
    const arbeiterWgConfigs: string[] = [];
    const arbeiterNodes = nodes.filter((x) => !x.main);

    for (let i = 0; i < arbeiterNodes.length; i++) {
        const node = arbeiterNodes[i];
        direktorWgConfig += `
[Peer]
PublicKey = ${node.pubkey}
AllowedIPs = 10.111.0.${i + 2}/32
    `;

        const ips = getMainNode(pektinConfig).ips;
        const legacyIps = getMainNode(pektinConfig).legacyIps;
        arbeiterWgConfigs.push(
            `[Interface]
PrivateKey = ${node.privkey}
ListenPort = 51820
Address = 10.111.0.${i + 2}

[Peer]
PublicKey = ${main.pubkey}
Endpoint = ${(() => {
                if (ips && ips.length > 0) return `[${ips[0]}]`;
                if (legacyIps && legacyIps.length > 0) return legacyIps[0];
                throw Error(`Neither a ip nor legacy ip address was found`);
            })()}:51820
PersistentKeepalive = 25
AllowedIPs = 10.111.0.1`
        );
    }

    return { direktorWgConfig, arbeiterWgConfigs };
};

export const genWgKeys = async () => {
    const privkey = (await exec(`wg genkey`)).stdout.replaceAll(`\n`, ``);
    const pubkey = (await exec(`echo "${privkey}" | wg pubkey `)).stdout.replaceAll(`\n`, ``);
    return { privkey, pubkey };
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

export const createCspConnectSources = (c: PektinConfig, tempDomain?: TempDomain) => {
    const sources: string[] = [];
    Object.values(c.services).forEach((service) => {
        /*@ts-ignore*/
        if (service.enabled !== false && service.domain) {
            /*@ts-ignore*/
            const fd = concatDomain(service.domain, service.subDomain);
            if (c.services.verkehr.routing === `local`) {
                sources.push(concatDomain(`localhost`, fd));
            } else if (c.services.verkehr.routing === `domain`) {
                sources.push(fd);
                if (c.services.verkehr.tempZone && tempDomain) {
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
    // add external verkehr proxy
    if (c.services.verkehr.enabled && c.services.verkehr.external.enabled) {
        const fd = concatDomain(
            c.services.verkehr.external.domain,
            c.services.verkehr.external.subDomain
        );
        if (c.services.verkehr.routing === `local`) {
            sources.push(concatDomain(`localhost`, fd));
        } else if (c.services.verkehr.routing === `domain`) {
            sources.push(fd);
            if (c.services.verkehr.tempZone && tempDomain) {
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
    let connectSources = ``;
    const protocol = c.services.verkehr.tls ? `https://` : `http://`;

    if (sources.length) {
        sources.forEach((e) => (connectSources += ` ` + protocol + toASCII(e)));
    }
    return connectSources.substring(1);
};

export const genEnvValues = async (v: {
    pektinConfig: PektinConfig;
    DB_PEKTIN_API_PASSWORD: string;
    DB_PEKTIN_SERVER_PASSWORD: string;
    V_PEKTIN_API_PASSWORD: string;
    V_PEKTIN_API_USER_NAME: string;
    externalVaultUrl: string;
    proxyBasicAuthHashed: string;
    zertificatManagerAccount: ZertificatManagerAccount;
    zertificatConsumerAccount: ZertificatConsumerAccount;
    vaultTokens: {
        key: string;
        rootToken: string;
    };
    acmeClientConnectionConfigInternal: PC3 | boolean;
    tempDomain?: TempDomain;
}) => {
    const repls = [
        [`VAULT_API_ADDR`, v.externalVaultUrl],

        [`V_PEKTIN_API_PASSWORD`, v.V_PEKTIN_API_PASSWORD],
        [`V_PEKTIN_API_USER_NAME`, v.V_PEKTIN_API_USER_NAME],
        [`DB_PEKTIN_API_PASSWORD`, v.DB_PEKTIN_API_PASSWORD],
        [`DB_PEKTIN_SERVER_PASSWORD`, v.DB_PEKTIN_SERVER_PASSWORD],

        [`V_KEY`, v.vaultTokens.key],
        [`V_ROOT_TOKEN`, v.vaultTokens.rootToken],

        [`LETSENCRYPT_EMAIL`, v.pektinConfig.services.zertificat.acmeEmail],

        [`CSP_CONNECT_SRC`, createCspConnectSources(v.pektinConfig, v.tempDomain)],

        [`PROXY_BASIC_AUTH_HASHED`, v.proxyBasicAuthHashed],

        [`UI_BUILD_PATH`, v.pektinConfig.services.ui.build.path],
        [`API_BUILD_PATH`, v.pektinConfig.services.api.build.path],
        [`SERVER_BUILD_PATH`, v.pektinConfig.services.server.build.path],
        [`TNT_BUILD_PATH`, v.pektinConfig.services.tnt.build.path],
        [`RIBSTON_BUILD_PATH`, v.pektinConfig.services.ribston.build.path],
        [`VAULT_BUILD_PATH`, v.pektinConfig.services.vault.build.path],
        [`JAEGER_BUILD_PATH`, v.pektinConfig.services.jaeger.build.path],
        [`PROMETHEUS_BUILD_PATH`, v.pektinConfig.services.prometheus.build.path],
        [`ALERT_BUILD_PATH`, v.pektinConfig.services.alert.build.path],
        [`GRAFANA_BUILD_PATH`, v.pektinConfig.services.grafana.build.path],
        [`ZERTIFICAT_BUILD_PATH`, v.pektinConfig.services.zertificat.build.path],
        [`VERKEHR_BUILD_PATH`, v.pektinConfig.services.verkehr.build.path],

        [`UI_DOCKERFILE`, v.pektinConfig.services.ui.build.dockerfile],
        [`API_DOCKERFILE`, v.pektinConfig.services.api.build.dockerfile],
        [`SERVER_DOCKERFILE`, v.pektinConfig.services.server.build.dockerfile],
        [`TNT_DOCKERFILE`, v.pektinConfig.services.tnt.build.dockerfile],
        [`RIBSTON_DOCKERFILE`, v.pektinConfig.services.ribston.build.dockerfile],
        [`VAULT_DOCKERFILE`, v.pektinConfig.services.vault.build.dockerfile],
        [`JAEGER_DOCKERFILE`, v.pektinConfig.services.jaeger.build.dockerfile],
        [`PROMETHEUS_DOCKERFILE`, v.pektinConfig.services.prometheus.build.dockerfile],
        [`ALERT_DOCKERFILE`, v.pektinConfig.services.alert.build.dockerfile],
        [`GRAFANA_DOCKERFILE`, v.pektinConfig.services.grafana.build.dockerfile],
        [`ZERTIFICAT_DOCKERFILE`, v.pektinConfig.services.zertificat.build.dockerfile],
        [`VERKEHR_DOCKERFILE`, v.pektinConfig.services.verkehr.build.dockerfile],

        [
            `ZERTIFICAT_PEKTIN_ACME_AUTH_INTERNAL`,
            toBase64(JSON.stringify(v.acmeClientConnectionConfigInternal)),
        ],
        [`ZERTIFICAT_MANAGER_VAULT_USERNAME`, v.zertificatManagerAccount.username],
        [`ZERTIFICAT_MANAGER_VAULT_PASSWORD`, v.zertificatManagerAccount.password],

        [`ZERTIFICAT_CONSUMER_VAULT_USERNAME`, v.zertificatConsumerAccount.username],
        [`ZERTIFICAT_CONSUMER_VAULT_PASSWORD`, v.zertificatConsumerAccount.password],

        [`API_LOGGING`, v.pektinConfig.services.api.logging],
        [`SERVER_LOGGING`, v.pektinConfig.services.server.logging],

        [`USE_POLICIES`, v.pektinConfig.usePolicies],
    ];
    let file = ``;
    repls.forEach((repl) => {
        file = file += `${repl[0]}="${repl[1]}"\n`;
    });
    file += `# Some commands for debugging
# Logs into db (then try 'KEYS *' for example to get all record keys):
# bash -c 'docker exec -it $(docker ps --filter name=pektin-db --format {{.ID}}) keydb-cli --pass ${v.DB_PEKTIN_API_PASSWORD} --user db-pektin-api'`;
    return file;
};

export const genStartScript = async (pektinConfig: PektinConfig) => {
    let file = `#!/bin/bash\n
bash scripts/update-config.sh\n
SCRIPTS_IMAGE_NAME=pektin/scripts
SCRIPTS_CONTAINER_NAME=pektin-scripts
ACTIVE_COMPOSE_FILES="${activeComposeFiles(pektinConfig)}"\n\n`;
    // create pektin compose command with different options
    let composeCommand = `docker compose --env-file secrets/.env`;

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
    let composeCommand = `docker compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);
    composeCommand += ` down`;
    file += composeCommand;

    return file;
};

export const genUpdateScript = async (pektinConfig: PektinConfig) => {
    let file = `#!/bin/bash\n`;
    let composeCommand = `docker compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);

    composeCommand += ` pull`;

    file += composeCommand + `\n`;
    file += `bash start.sh`;
    return file;
};

export const activeComposeFiles = (pektinConfig: PektinConfig) => {
    let composeCommand = ` -f pektin-compose/pektin.yml -f overrides.yml`;

    if (pektinConfig.nodes.length > 1) {
        composeCommand += ` -f pektin-compose/gewerkschaft-config.yml`;
    }

    if (pektinConfig.services.api.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/api.yml`;
    }

    if (pektinConfig.services.vault.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/vault.yml`;
    }

    if (pektinConfig.services.server.build.enabled) {
        composeCommand += ` -f pektin-compose/from-source/server.yml`;
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
        if (pektinConfig.services.opa.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/opa.yml`;
        }
    }

    if (pektinConfig.services.jaeger.enabled) {
        composeCommand += ` -f pektin-compose/services/jaeger.yml`;
        if (pektinConfig.services.jaeger.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/jaeger.yml`;
        }
    }

    if (pektinConfig.services.prometheus.enabled) {
        composeCommand += ` -f pektin-compose/services/prometheus.yml`;
        if (pektinConfig.services.prometheus.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/prometheus.yml`;
        }
    }

    if (pektinConfig.services.grafana.enabled) {
        composeCommand += ` -f pektin-compose/services/grafana.yml`;
        if (pektinConfig.services.grafana.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/grafana.yml`;
        }
    }

    if (pektinConfig.services.alert.enabled) {
        composeCommand += ` -f pektin-compose/services/alert.yml`;
        if (pektinConfig.services.alert.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/alert.yml`;
        }
    }

    if (pektinConfig.services.tnt.enabled) {
        composeCommand += ` -f pektin-compose/services/tnt.yml`;
        if (pektinConfig.services.tnt.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/tnt.yml`;
        }
    }

    if (pektinConfig.services.zertificat.enabled) {
        composeCommand += ` -f pektin-compose/services/zertificat.yml`;
        if (pektinConfig.services.zertificat.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/zertificat.yml`;
        }
        if (pektinConfig.services.zertificat.usePebble) {
            composeCommand += ` -f pektin-compose/dev/zertificat-pebble.yml`;
        }
    }

    if (pektinConfig.services.verkehr.enabled) {
        composeCommand += ` -f pektin-compose/services/verkehr.yml`;
        if (pektinConfig.services.verkehr.build.enabled) {
            composeCommand += ` -f pektin-compose/from-source/verkehr.yml`;
        }
    }

    return composeCommand;
};
