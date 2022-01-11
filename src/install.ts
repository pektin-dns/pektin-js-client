import { promises as fs } from "fs";
import path from "path";
import { chownRecursive, chown, chmod, randomString } from "./utils.js";
import crypto from "crypto";

import { unsealVault, initVault, enableVaultCors, updateKvValue } from "./vault/vault.js";
import { PektinConfig } from "./types";
import {
    createFullPektinClient,
    createPektinApiAccount,
    createPektinAuthVaultPolicies,
    createPektinSigner,
    createPektinVaultEngines,
    updatePektinAuthPasswords
} from "./auth.js";

export const installPektinCompose = async (
    dir: string = "/pektin-compose/",
    internalVaultUrl: string = "http://pektin-vault:8200"
) => {
    if (process.env.UID === undefined || process.env.GID === undefined)
        throw Error(
            "No UID and/or GID defined. Current is: UID: " +
                process.env.UID +
                ", GID: " +
                process.env.GID
        );

    const pektinConfig: PektinConfig = JSON.parse(
        await fs.readFile(path.join(dir, "pektin-config.json"), { encoding: "utf-8" })
    );

    // creates secrets directory
    await fs.mkdir(path.join(dir, "secrets")).catch(() => {});

    // HTTP API CALL RELATED
    // init vault
    const vaultTokens = await initVault(internalVaultUrl);
    await unsealVault(internalVaultUrl, vaultTokens.key);

    // create resources on vault
    await createPektinVaultEngines(
        internalVaultUrl,
        vaultTokens.rootToken,
        [
            { path: "pektin-transit", options: { type: "transit" } },
            { path: "pektin-kv", options: { type: "kv", options: { version: 2 } } },
            { path: "pektin-signer-passwords-1", options: { type: "kv", options: { version: 2 } } },
            { path: "pektin-signer-passwords-2", options: { type: "kv", options: { version: 2 } } },
            { path: "pektin-signer-passwords", options: { type: "kv", options: { version: 2 } } },
            {
                path: "pektin-officer-passwords-1",
                options: { type: "kv", options: { version: 2 } }
            },
            {
                path: "pektin-officer-passwords-2",
                options: { type: "kv", options: { version: 2 } }
            },
            { path: "pektin-officer-passwords", options: { type: "kv", options: { version: 2 } } },
            { path: "pektin-ribston-policies", options: { type: "kv", options: { version: 2 } } }
        ],
        [{ path: "userpass", options: { type: "userpass" } }]
    );

    // create the 2 not domain or client related policies
    await createPektinAuthVaultPolicies(internalVaultUrl, vaultTokens.rootToken);

    // create the signer vault infra for the main domain
    {
        const mainDomainSignerPassword = randomString();
        await createPektinSigner(
            internalVaultUrl,
            vaultTokens.rootToken,
            pektinConfig.domain,
            mainDomainSignerPassword
        );

        await updatePektinAuthPasswords(
            internalVaultUrl,
            vaultTokens.rootToken,
            "signer",
            mainDomainSignerPassword,
            pektinConfig.domain
        );
    }

    // create the vault infra for the api
    const V_PEKTIN_API_PASSWORD = randomString();
    createPektinApiAccount(internalVaultUrl, vaultTokens.rootToken, V_PEKTIN_API_PASSWORD);

    let vaultEndpoint = "";
    if (pektinConfig.dev === "local") {
        vaultEndpoint = `http://127.0.0.1:8200`;
    } else if (pektinConfig.dev === "insecure-online") {
        vaultEndpoint = `http://${pektinConfig.insecureDevIp}:8200`;
    } else {
        vaultEndpoint = `https://${pektinConfig.vaultSubDomain}.${pektinConfig.domain}`;
    }
    await enableVaultCors(internalVaultUrl, vaultTokens.rootToken);

    // create admin account
    const pektinAdminConnectionConfig = {
        username: `pektin-admin-${randomString(10)}`,
        password: randomString(),
        vaultEndpoint
    };

    const pektinAdminRibstonPolicy = await fs.readFile(
        `/app/node_modules/@pektin/client/dist/ribston-policies/pektin-admin.ribston.js`,
        "utf-8"
    );

    await createFullPektinClient(
        internalVaultUrl,
        vaultTokens.rootToken,
        pektinAdminConnectionConfig.username,
        pektinAdminConnectionConfig.password,
        pektinAdminRibstonPolicy,
        [],
        true
    );

    await fs.writeFile(
        path.join(dir, "secrets", "admin-access.json"),
        JSON.stringify(pektinAdminConnectionConfig)
    );

    // create basic auth for recursor
    const RECURSOR_USER = randomString(20);
    const RECURSOR_PASSWORD = randomString();
    const recursorBasicAuthHashed = genBasicAuthHashed(RECURSOR_USER, RECURSOR_PASSWORD);
    // set recursor basic auth string on vault
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        "recursor-auth",
        {
            basicAuth: genBasicAuthString(RECURSOR_USER, RECURSOR_PASSWORD)
        },
        "pektin-kv"
    );

    // set the pektin config on vault for easy service discovery
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        "pektin-config",
        pektinConfig,
        "pektin-kv"
    );

    const pektinSignerPassword = randomString();
    await createPektinSigner(
        internalVaultUrl,
        vaultTokens.rootToken,
        pektinConfig.domain,
        pektinSignerPassword
    );

    // HARD DRIVE RELATED

    // init redis access control
    const R_PEKTIN_API_PASSWORD = randomString();
    const R_PEKTIN_SERVER_PASSWORD = randomString();
    const R_PEKTIN_GEWERKSCHAFT_PASSWORD = randomString();

    const redisPasswords = [
        ["R_PEKTIN_API_PASSWORD", R_PEKTIN_API_PASSWORD],
        ["R_PEKTIN_SERVER_PASSWORD", R_PEKTIN_SERVER_PASSWORD]
    ];

    if (pektinConfig.multiNode) {
        redisPasswords.push(["R_PEKTIN_GEWERKSCHAFT_PASSWORD", R_PEKTIN_GEWERKSCHAFT_PASSWORD]);

        await createArbeiterConfig({ R_PEKTIN_GEWERKSCHAFT_PASSWORD, pektinConfig }, dir);
        await createSwarmScript(pektinConfig, dir);

        await chownRecursive(
            path.join(dir, `arbeiter`),
            process.env.UID || "700",
            process.env.GID || "700"
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
            recursorBasicAuthHashed
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
    await chmod(path.join(dir, `secrets`, `.env`), `700`);
    await chmod(path.join(dir, `secrets`, `admin-access.json`), `700`);
};

export const genBasicAuthHashed = (username: string, password: string) => {
    const hash = (a: string) =>
        crypto.createHash("sha1").update(a, "utf8").digest().toString("base64");
    return `${username}:{SHA}${hash(password)}`;
};

export const genBasicAuthString = (username: string, password: string) => {
    const s = Buffer.from(`${username}:${password}`).toString("base64");
    return `Basic ${s}`;
};

export const createArbeiterConfig = async (
    v: {
        pektinConfig: PektinConfig;
        R_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
    },
    dir: string
) => {
    await fs.mkdir(path.join(dir, "arbeiter")).catch(() => {});
    for (let i = 0; i < v.pektinConfig.nameServers.length; i++) {
        const ns = v.pektinConfig.nameServers[i];

        if (i !== 0) {
            await fs.mkdir(path.join(dir, "arbeiter", ns.subDomain)).catch(() => {});

            await fs.mkdir(path.join(dir, "arbeiter", ns.subDomain, "secrets")).catch(() => {});
            await fs
                .mkdir(path.join(dir, "arbeiter", ns.subDomain, "secrets", "redis"))
                .catch(() => {});
            const R_PEKTIN_SERVER_PASSWORD = randomString();
            const redisFile = await setRedisPasswordHashes(
                [["R_PEKTIN_SERVER_PASSWORD", R_PEKTIN_SERVER_PASSWORD]],
                v.pektinConfig,
                dir,
                true
            );
            if (redisFile === undefined) {
                throw new Error("This should never happen: createArbeiterConfig");
            }
            await fs.writeFile(
                path.join(dir, "arbeiter", ns.subDomain, "secrets", "redis", "users.acl"),
                redisFile
            );

            const repls = [
                ["R_PEKTIN_GEWERKSCHAFT_PASSWORD", v.R_PEKTIN_GEWERKSCHAFT_PASSWORD],
                ["R_PEKTIN_SERVER_PASSWORD", R_PEKTIN_SERVER_PASSWORD],
                ["SERVER_DOMAINS_SNI", `\`${ns.subDomain}.${v.pektinConfig.domain}\``]
            ];

            let file = "# DO NOT EDIT THESE MANUALLY\n";
            repls.forEach(repl => {
                file = file += `${repl[0]}="${repl[1]}"\n`;
            });

            const composeCommand = `docker-compose --env-file secrets/.env -f pektin-compose/arbeiter/base.yml -f pektin-compose/arbeiter/traefik-config.yml -f pektin-compose/traefik.yml`;

            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "secrets", ".env"), file);
            const startScript = `${composeCommand} up -d`;

            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "start.sh"), startScript);

            const setupScript = `docker swarm leave\n`;
            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "setup.sh"), setupScript);

            const stopScript = `${composeCommand} down --remove-orphans`;
            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "stop.sh"), stopScript);

            const updateScript = `${composeCommand} pull\nsh start.sh`;
            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "update.sh"), updateScript);

            const resetScript = `${composeCommand} down --remove-orphans\ndocker swarm leave --force\ndocker volume rm pektin-compose_db\nrm -rf update.sh start.sh stop.sh secrets/ `;
            await fs.writeFile(path.join(dir, "arbeiter", ns.subDomain, "reset.sh"), resetScript);
        }
    }
};

export const createSwarmScript = async (pektinConfig: PektinConfig, dir: string) => {
    let swarmScript = `docker swarm init \n`;
    pektinConfig.nameServers.forEach((ns, i) => {
        if (i === 0) return;
        swarmScript += `docker swarm join-token worker | grep docker >> arbeiter/${ns.subDomain}/setup.sh\n`;
    });

    await fs.writeFile(path.join(dir, "swarm.sh"), swarmScript);
};

export const setRedisPasswordHashes = async (
    repls: string[][],
    pektinConfig: PektinConfig,
    dir: string,
    arbeiter = false
) => {
    let readPath;
    if (arbeiter) {
        readPath = path.join(dir, "config", "redis", "arbeiter", "users.template.acl");
    } else {
        readPath = pektinConfig.multiNode
            ? path.join(dir, "config", "redis", "direktor", "users.template.acl")
            : path.join(dir, "config", "redis", "users.template.acl");
    }
    let file = await fs.readFile(readPath, {
        encoding: "utf-8"
    });

    const hash = (a: string) => {
        return crypto.createHash("sha256").update(a, "utf8").digest().toString("hex");
    };

    repls.forEach(repl => {
        file = file.replaceAll(RegExp(`${repl[0]}_SHA256$`, "gm"), `${hash(repl[1])}`);
    });
    if (arbeiter) {
        return file;
    }
    await fs.mkdir(path.join(dir, "secrets", "redis")).catch(() => {});
    await fs.writeFile(path.join(dir, "secrets", "redis", "users.acl"), file);
    //crypto.create;
};

const addAllowedConnectSources = (connectSources: string) => {
    const sources: string[] = [];
    if (sources.length) sources.forEach(e => (connectSources += " " + e));
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
    },
    dir: string
) => {
    let CSP_CONNECT_SRC = "";
    if (v.pektinConfig.dev === "local") {
        CSP_CONNECT_SRC = `*`;
    } else if (v.pektinConfig.dev === "insecure-online") {
        const ip = v.pektinConfig.nameServers[0]?.ips?.length
            ? "[" + v.pektinConfig.nameServers[0]?.ips[0] + "]"
            : v.pektinConfig.nameServers[0]?.legacyIps[0];
        CSP_CONNECT_SRC = `http://${ip}:3001 http://${ip}:8200`;
    } else {
        CSP_CONNECT_SRC = `https://${v.pektinConfig.vaultSubDomain}.${v.pektinConfig.domain} https://${v.pektinConfig.apiSubDomain}.${v.pektinConfig.domain}`;
    }
    CSP_CONNECT_SRC = addAllowedConnectSources(CSP_CONNECT_SRC);

    const repls = [
        ["V_PEKTIN_API_PASSWORD", v.V_PEKTIN_API_PASSWORD],
        ["R_PEKTIN_API_PASSWORD", v.R_PEKTIN_API_PASSWORD],
        ["R_PEKTIN_SERVER_PASSWORD", v.R_PEKTIN_SERVER_PASSWORD],
        ["V_KEY", v.vaultTokens.key],
        ["V_ROOT_TOKEN", v.vaultTokens.rootToken],
        ["DOMAIN", v.pektinConfig.domain],
        ["UI_SUBDOMAIN", v.pektinConfig.uiSubDomain],
        ["API_SUBDOMAIN", v.pektinConfig.apiSubDomain],
        ["VAULT_SUBDOMAIN", v.pektinConfig.vaultSubDomain],
        ["LETSENCRYPT_EMAIL", v.pektinConfig.letsencryptEmail],
        ["CSP_CONNECT_SRC", CSP_CONNECT_SRC],
        ["RECURSOR_AUTH", v.recursorBasicAuthHashed],
        [
            "SERVER_DOMAINS_SNI",
            v.pektinConfig.nameServers
                .map(ns => `\`${ns.subDomain}.${v.pektinConfig.domain}\``)
                .toString()
        ],
        ["UI_BUILD_PATH", v.pektinConfig.sources?.ui || "https://github.com/pektin-dns/pektin-ui"],
        [
            "API_BUILD_PATH",
            v.pektinConfig.sources?.api || "https://github.com/pektin-dns/pektin-api"
        ],
        [
            "SERVER_BUILD_PATH",
            v.pektinConfig.sources?.server || "https://github.com/pektin-dns/pektin-server-"
        ]
    ];
    let file = "# DO NOT EDIT THESE MANUALLY \n";
    repls.forEach(repl => {
        file = file += `${repl[0]}="${repl[1]}"\n`;
    });
    file += `# Some commands for debugging`;
    file += `# redis-cli --pass ${v.R_PEKTIN_API_PASSWORD} --user r-pektin-api`;
    await fs.writeFile(path.join(dir, "secrets", ".env"), file);
};

export const createStartScript = async (pektinConfig: PektinConfig, dir: string) => {
    const p = path.join(dir, "start.sh");
    let file = `#!/bin/sh\n`;
    // create pektin compose command with different options
    let composeCommand = `docker-compose --env-file secrets/.env`;

    composeCommand += activeComposeFiles(pektinConfig);
    composeCommand += ` up -d`;
    composeCommand += pektinConfig.buildFromSource ? " --build" : "";

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
    const p = path.join(dir, "stop.sh");
    let file = `#!/bin/sh\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);
    composeCommand += ` down`;
    file += composeCommand;

    await fs.writeFile(p, file);
};

export const createUpdateScript = async (pektinConfig: PektinConfig, dir: string) => {
    const p = path.join(dir, "update.sh");
    let file = `#!/bin/sh\n`;
    let composeCommand = `docker-compose --env-file secrets/.env`;
    composeCommand += activeComposeFiles(pektinConfig);

    composeCommand += ` pull`;

    file += composeCommand + "\n";
    file += `sh start.sh`;
    await fs.writeFile(p, file);
};

export const activeComposeFiles = (pektinConfig: PektinConfig) => {
    let composeCommand = ` -f pektin-compose/pektin.yml`;

    if (pektinConfig.multiNode) {
        composeCommand += ` -f pektin-compose/gewerkschaft-config.yml`;
    }

    if (pektinConfig.dev === "insecure-online") {
        composeCommand += ` -f pektin-compose/insecure-online-dev.yml`;
    }

    if (pektinConfig.dev === "local") {
        composeCommand += ` -f pektin-compose/local-dev.yml`;
        if (pektinConfig.enableRecursor) {
            composeCommand += ` -f pektin-compose/recursor-dev.yml`;
        }
    } else {
        if (pektinConfig.enableRecursor) {
            composeCommand += ` -f pektin-compose/recursor.yml`;
        }
    }

    if (pektinConfig.buildFromSource) {
        composeCommand += ` -f pektin-compose/build-from-source.yml`;
    }

    if (pektinConfig.proxyConfig === "traefik") {
        composeCommand += ` -f pektin-compose/traefik-config.yml`;
    }

    if (pektinConfig.createProxy === true) {
        if (pektinConfig.proxyConfig === "traefik" && pektinConfig.dev !== "local") {
            composeCommand += ` -f pektin-compose/traefik.yml`;
        }
    }

    return composeCommand;
};
