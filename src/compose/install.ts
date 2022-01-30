import { promises as fs } from "fs";
import path from "path";
import { chownRecursive, chown, chmod, randomString, configToCertbotIni } from "./../utils.js";
import crypto from "crypto";

import { unsealVault, initVault, enableVaultCors, updateKvValue } from "./../vault/vault.js";
import { PektinClientConnectionConfigOverride } from "./../types.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";

import {
    createPektinClient,
    createPektinApiAccount,
    createPektinAuthVaultPolicies,
    createPektinSigner,
    createPektinVaultEngines,
    updatePektinSharedPasswords,
} from "./../auth.js";
import { concatDomain, getMainNode, getNodesNameservers, getPektinEndpoint } from "../index.js";

export const installPektinCompose = async (
    dir: string = `/pektin-compose/`,
    internalVaultUrl: string = `http://pektin-vault:8200`
) => {
    if (process.env.UID === undefined || process.env.GID === undefined)
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );

    const pektinConfig: PektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, `pektin-config.json`), {
            encoding: `utf-8`,
        })
    );

    // creates secrets directory
    await fs.mkdir(path.join(dir, `secrets`)).catch(() => {});

    // HTTP API CALL RELATED
    // init vault
    const vaultTokens = await initVault(internalVaultUrl);
    await unsealVault(internalVaultUrl, vaultTokens.key);

    // create resources on vault
    await createPektinVaultEngines(
        internalVaultUrl,
        vaultTokens.rootToken,
        [
            { path: `pektin-transit`, options: { type: `transit` } },
            {
                path: `pektin-kv`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-signer-passwords-1`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-signer-passwords-2`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-signer-passwords`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-officer-passwords-1`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-officer-passwords-2`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-officer-passwords`,
                options: { type: `kv`, options: { version: 2 } },
            },
            {
                path: `pektin-ribston-policies`,
                options: { type: `kv`, options: { version: 2 } },
            },
        ],
        [{ path: `userpass`, options: { type: `userpass` } }]
    );

    // create the 2 not domain or client related policies
    await createPektinAuthVaultPolicies(internalVaultUrl, vaultTokens.rootToken);

    if (pektinConfig.nameservers !== undefined) {
        // create the signer vault infra for the nameserver domains
        pektinConfig.nameservers.forEach(async (ns) => {
            if (ns.main) {
                const domainSignerPassword = randomString();
                await createPektinSigner(
                    internalVaultUrl,
                    vaultTokens.rootToken,
                    ns.domain,
                    domainSignerPassword
                );

                await updatePektinSharedPasswords(
                    internalVaultUrl,
                    vaultTokens.rootToken,
                    `signer`,
                    domainSignerPassword,
                    ns.domain
                );
            }
        });
    }
    // create the vault infra for the api
    const V_PEKTIN_API_PASSWORD = randomString();

    createPektinApiAccount(internalVaultUrl, vaultTokens.rootToken, V_PEKTIN_API_PASSWORD);

    let vaultEndpoint = getPektinEndpoint(pektinConfig, `vault`);

    await enableVaultCors(internalVaultUrl, vaultTokens.rootToken);

    // create admin account
    const pektinAdminConnectionConfig = {
        username: `admin-${randomString(10)}`,
        managerPassword: `m.${randomString()}`,
        confidantPassword: `c.${randomString()}`,
        vaultEndpoint,
    };

    const pektinAdminRibstonPolicy = await fs.readFile(
        `/app/node_modules/@pektin/client/dist/policies/allow-everything.ribston.js`,
        `utf-8`
    );

    await createPektinClient({
        endpoint: internalVaultUrl,
        token: vaultTokens.rootToken,
        clientName: pektinAdminConnectionConfig.username,
        managerPassword: pektinAdminConnectionConfig.managerPassword,
        confidantPassword: pektinAdminConnectionConfig.confidantPassword,
        capabilities: {
            allowAllSigningDomains: true,
            recursorAccess: true,
            configAccess: true,
            ribstonPolicy: pektinAdminRibstonPolicy,
        },
    });

    await fs.writeFile(
        path.join(dir, `secrets`, `server-admin-connection-config.json`),
        JSON.stringify(pektinAdminConnectionConfig)
    );

    // create acme client if enabled
    if (pektinConfig.certificates) {
        const acmeClientConnectionConfig = {
            username: `acme-${randomString(10)}`,
            confidantPassword: `c.${randomString()}`,
            override: {
                pektinApiEndpoint: getPektinEndpoint(pektinConfig, `api`),
            },
        };
        const acmeClientRibstonPolicy = await fs.readFile(
            `/app/node_modules/@pektin/client/dist/policies/acme.ribston.js`,
            `utf-8`
        );
        await createPektinClient({
            endpoint: internalVaultUrl,
            token: vaultTokens.rootToken,
            clientName: acmeClientConnectionConfig.username,
            confidantPassword: acmeClientConnectionConfig.confidantPassword,
            capabilities: {
                ribstonPolicy: acmeClientRibstonPolicy,
                allowAllSigningDomains: true,
            },
        });
        await fs.writeFile(
            path.join(dir, `secrets`, `acme-client-connection-config.json`),
            JSON.stringify(acmeClientConnectionConfig)
        );
        await fs.writeFile(
            path.join(dir, `secrets`, `certbot-acme-client-connection-config.ini`),
            configToCertbotIni(acmeClientConnectionConfig as PektinClientConnectionConfigOverride)
        );
    }

    // create basic auth for recursor
    const RECURSOR_USER = randomString(20);
    const RECURSOR_PASSWORD = randomString();
    const recursorBasicAuthHashed = genBasicAuthHashed(RECURSOR_USER, RECURSOR_PASSWORD);

    // set recursor basic auth string on vault
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `recursor-auth`,
        {
            basicAuth: genBasicAuthString(RECURSOR_USER, RECURSOR_PASSWORD),
        },
        `pektin-kv`
    );

    // set the pektin config on vault for easy service discovery
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `pektin-config`,
        pektinConfig,
        `pektin-kv`
    );

    // HARD DRIVE RELATED

    // init redis access control
    const R_PEKTIN_API_PASSWORD = randomString();
    const R_PEKTIN_SERVER_PASSWORD = randomString();
    const R_PEKTIN_GEWERKSCHAFT_PASSWORD = randomString();

    const redisPasswords = [
        [`R_PEKTIN_API_PASSWORD`, R_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_SERVER_PASSWORD`, R_PEKTIN_SERVER_PASSWORD],
    ];

    if (pektinConfig.nodes.length > 1) {
        redisPasswords.push([`R_PEKTIN_GEWERKSCHAFT_PASSWORD`, R_PEKTIN_GEWERKSCHAFT_PASSWORD]);

        await createArbeiterConfig({ R_PEKTIN_GEWERKSCHAFT_PASSWORD, pektinConfig }, dir);
        await createSwarmScript(pektinConfig, dir);

        await chownRecursive(
            path.join(dir, `arbeiter`),
            process.env.UID || `700`,
            process.env.GID || `700`
        );
        await chown(path.join(dir, `swarm.sh`), process.env.UID, process.env.GID);
    }

    await setRedisPasswordHashes(redisPasswords, pektinConfig, dir);

    // set the values in the .env file for provisioning them to the containers
    await envSetValues(
        {
            vaultTokens,
            R_PEKTIN_API_PASSWORD,
            R_PEKTIN_SERVER_PASSWORD,
            V_PEKTIN_API_PASSWORD,
            pektinConfig,
            recursorBasicAuthHashed,
        },
        dir
    );

    await createStartScript(pektinConfig, dir);
    await createStopScript(pektinConfig, dir);
    await createUpdateScript(pektinConfig, dir);

    // change ownership of all created files to host user
    // also chmod 700 all secrets except for redis ACL
    await chown(path.join(dir, `start.sh`), process.env.UID, process.env.GID);
    await chown(path.join(dir, `stop.sh`), process.env.UID, process.env.GID);
    await chown(path.join(dir, `update.sh`), process.env.UID, process.env.GID);
    await chownRecursive(path.join(dir, `secrets`), process.env.UID, process.env.GID);
    await chmod(path.join(dir, `secrets`), `700`);
    await chmod(path.join(dir, `secrets`, `.env`), `600`);
    await chmod(path.join(dir, `secrets`, `acme-client-connection-config.json`), `600`);
    await chmod(path.join(dir, `secrets`, `server-admin-connection-config.json`), `600`);
    await chmod(path.join(dir, `secrets`, `certbot-acme-client-connection-config.ini`), `600`);
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
    },
    dir: string
) => {
    await fs.mkdir(path.join(dir, `arbeiter`)).catch(() => {});

    for (let i = 0; i < v.pektinConfig.nodes.length; i++) {
        const node = v.pektinConfig.nodes[i];

        if (i !== 0) {
            await fs.mkdir(path.join(dir, `arbeiter`, node.name)).catch(() => {});

            await fs.mkdir(path.join(dir, `arbeiter`, node.name, `secrets`)).catch(() => {});
            await fs
                .mkdir(path.join(dir, `arbeiter`, node.name, `secrets`, `redis`))
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

            const repls = [
                [`R_PEKTIN_SERVER_PASSWORD`, R_PEKTIN_SERVER_PASSWORD],
                [`SERVER_DOMAINS_SNI`, getSNI(v.pektinConfig, node.name)],
                [`SERVER_DOMAIN`, ``],
            ];
            // TODO SERVER_DOMAIN server certificates seperation for multiple domains
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
            const composeCommand = `docker-compose --env-file secrets/.env -f pektin-compose/arbeiter/base.yml -f pektin-compose/arbeiter/traefik-config.yml -f pektin-compose/traefik.yml`;

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
    await fs.mkdir(path.join(dir, `secrets`, `redis`)).catch(() => {});
    await fs.writeFile(path.join(dir, `secrets`, `redis`, `users.acl`), file);
    //crypto.create;
};

const addAllowedConnectSources = (connectSources: string) => {
    const sources: string[] = [];
    if (sources.length) sources.forEach((e) => (connectSources += ` ` + e));
    return connectSources;
};

export const getSNI = (pektinConfig: PektinConfig, nodeName: string) => {
    const nodeNameServers = getNodesNameservers(pektinConfig, nodeName);

    let sni = ``;
    if (nodeNameServers) {
        nodeNameServers.forEach((ns, i) => {
            if (i > 0) sni += `,`;
            sni += `\`${concatDomain(ns.domain, ns.subDomain)}\``;
        });
    }
    return sni;
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
    },
    dir: string
) => {
    let CSP_CONNECT_SRC = ``;
    if (v.pektinConfig.devmode.enabled && v.pektinConfig.devmode.type === `local`) {
        CSP_CONNECT_SRC = `*`;
    } else {
        const enabledServices = [
            v.pektinConfig.ui,
            v.pektinConfig.api,
            v.pektinConfig.vault,
            v.pektinConfig.recursor,
        ].filter((s) => s.enabled);
        enabledServices.forEach((s, i) => {
            if (i > 0) CSP_CONNECT_SRC += ` `;
            CSP_CONNECT_SRC += concatDomain(s.domain, s.subDomain);
        });
    }
    CSP_CONNECT_SRC = addAllowedConnectSources(CSP_CONNECT_SRC);

    // TODO SERVER_DOMAIN is only singular: see todo notice above
    const repls = [
        [`SERVER_DOMAIN`, ``],
        [`V_PEKTIN_API_PASSWORD`, v.V_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_API_PASSWORD`, v.R_PEKTIN_API_PASSWORD],
        [`R_PEKTIN_SERVER_PASSWORD`, v.R_PEKTIN_SERVER_PASSWORD],
        [`V_KEY`, v.vaultTokens.key],
        [`V_ROOT_TOKEN`, v.vaultTokens.rootToken],
        [`UI_CONCAT_DOMAIN`, concatDomain(v.pektinConfig.ui.domain, v.pektinConfig.ui.subDomain)],
        [`UI_DOMAIN`, v.pektinConfig.ui.domain],
        [
            `API_CONCAT_DOMAIN`,
            concatDomain(v.pektinConfig.api.domain, v.pektinConfig.api.subDomain),
        ],
        [`API_DOMAIN`, v.pektinConfig.api.domain],
        [
            `VAULT_CONCAT_DOMAIN`,
            concatDomain(v.pektinConfig.vault.domain, v.pektinConfig.vault.subDomain),
        ],
        [`VAULT_DOMAIN`, v.pektinConfig.vault.domain],
        [
            `RECURSOR_CONCAT_DOMAIN`,
            concatDomain(v.pektinConfig.recursor.domain, v.pektinConfig.recursor.subDomain),
        ],
        [`RECURSOR_DOMAIN`, v.pektinConfig.recursor.domain],
        [`LETSENCRYPT_EMAIL`, v.pektinConfig.certificates.letsencryptEmail],
        [`CSP_CONNECT_SRC`, CSP_CONNECT_SRC],
        [`RECURSOR_AUTH`, v.recursorBasicAuthHashed],
        [`SERVER_DOMAINS_SNI`, getSNI(v.pektinConfig, getMainNode(v.pektinConfig).name)],
        [`UI_BUILD_PATH`, v.pektinConfig.build.ui.path],
        [`API_BUILD_PATH`, v.pektinConfig.build.api.path],
        [`SERVER_BUILD_PATH`, v.pektinConfig.build.server.path],
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
    let file = `#!/bin/sh\n`;
    // create pektin compose command with different options
    let composeCommand = `docker-compose --env-file secrets/.env`;

    composeCommand += activeComposeFiles(pektinConfig);
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
    file += `docker run --name pektin-compose-start --network container:pektin-vault --mount "type=bind,source=$PWD,dst=/pektin-compose/" -it $(docker build -q ./scripts/start/)\n`;
    // remove pektin-start artifacts
    file += `docker rm pektin-compose-start -v\n`;
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

    if (pektinConfig.devmode.enabled && pektinConfig.devmode.type === `insecure-online`) {
        composeCommand += ` -f pektin-compose/insecure-online-dev.yml`;
    }

    if (pektinConfig.devmode.enabled && pektinConfig.devmode.type === `local`) {
        composeCommand += ` -f pektin-compose/local-dev.yml`;
        if (pektinConfig.recursor.enabled) {
            composeCommand += ` -f pektin-compose/recursor-dev.yml`;
        }
    } else {
        if (pektinConfig.recursor.enabled) {
            composeCommand += ` -f pektin-compose/recursor.yml`;
        }
    }

    if (pektinConfig.build.api.enabled) {
        composeCommand += ` -f pektin-compose/from-source/api.yml`;
    }

    if (pektinConfig.build.ui.enabled) {
        composeCommand += ` -f pektin-compose/from-source/ui.yml`;
    }

    if (pektinConfig.build.server.enabled) {
        composeCommand += ` -f pektin-compose/from-source/server.yml`;
    }

    if (pektinConfig.reverseProxy.applyTraefikConfig) {
        composeCommand += ` -f pektin-compose/traefik-config.yml`;
    }

    if (
        pektinConfig.reverseProxy.createTraefik &&
        (!pektinConfig.devmode.enabled ||
            (pektinConfig.devmode.enabled && pektinConfig.devmode.type !== `local`))
    ) {
        composeCommand += ` -f pektin-compose/traefik.yml`;
    }

    return composeCommand;
};
