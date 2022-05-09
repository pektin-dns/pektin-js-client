import yaml from "yaml";
import { BasicAuthString, PC3 } from "../types.js";
import { installVault } from "./install-vault.js";
import {
    chownRecursive,
    configToCertbotIni,
    genBasicAuthHashed,
    generatePerimeterAuth,
} from "./utils.js";
import { promises as fs } from "fs";
import path from "path";
import { chmod } from "./utils.js";
import { PektinConfig } from "@pektin/config/src/config-types";
import { PektinSetupClient } from "./first-start.js";

import { declareFs } from "@pektin/declare-fs";
import { randomString } from "../utils/index.js";

export const installK8s = async (dir: string = `/base/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const { secrets }: { secrets: K8sSecrets } = yaml.parse(
        await fs.readFile(path.join(dir, `secrets.yml`), {
            encoding: `utf-8`,
        })
    );
    const pektinConfig = yaml.parse(
        await fs.readFile(path.join(dir, `pektin-config.yml`), {
            encoding: `utf-8`,
        })
    );

    const { pektinAdminConnectionConfig, vaultTokens, acmeClientConnectionConfig } =
        await installVault({
            pektinConfig,
            secrets: secrets,
            k8s: true,
            internalVaultUrl: `http://127.0.0.1:8227`,
        });

    pektinAdminConnectionConfig.perimeterAuth = secrets.PERIMETER_AUTH as BasicAuthString;
    if (typeof acmeClientConnectionConfig === `object`) {
        acmeClientConnectionConfig.perimeterAuth = secrets.PERIMETER_AUTH as BasicAuthString;
    }

    const user = `${process.env.UID}:${process.env.GID}`;

    await declareFs(
        {
            $ownerR: user,
            $filePermsR: `600`,
            $folderPermsR: `700`,
            secrets: {
                "acme-client.pc3.json": JSON.stringify(acmeClientConnectionConfig),
                "certbot-acme-client.pc3.ini": configToCertbotIni(
                    acmeClientConnectionConfig as PC3
                ),
                "vault-tokens.json": JSON.stringify(vaultTokens),
                "server-admin.pc3.json": JSON.stringify(pektinAdminConnectionConfig),
            },
        },
        { method: `node`, basePath: dir }
    );

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinSetupClient({
            username: pektinAdminConnectionConfig.username,
            perimeterAuth: secrets.PERIMETER_AUTH as BasicAuthString,
            /*@ts-ignore*/
            confidantPassword: pektinAdminConnectionConfig.confidantPassword,
            vaultEndpoint: `http://127.0.0.1:8200`,
            override: { pektinApiEndpoint: `http://127.0.0.1:3333` },
        });

        await pc.setup(pektinConfig);
    }
};

export const createSecrets = async (dir: string = `/base/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const pektinConfig: PektinConfig = yaml.parse(
        await fs.readFile(path.join(dir, `pektin-config.yml`), {
            encoding: `utf-8`,
        })
    );

    const [PERIMETER_AUTH, PERIMETER_AUTH_HASHED] = generatePerimeterAuth();

    const secrets: K8sSecrets = {
        PERIMETER_AUTH_HASHED,
        PERIMETER_AUTH,
        DB_PEKTIN_API_PASSWORD: randomString(),
        V_PEKTIN_API_PASSWORD: randomString(),
        DB_PEKTIN_GEWERKSCHAFT_PASSWORD: randomString(),
        DB_PEKTIN_SERVER_PASSWORD: randomString(),
        V_PEKTIN_API_USER_NAME: `pektin-api-${randomString(10).toLowerCase()}`,
        nodes: {},
        nameserverSignerPasswords: {},
        adminClientInfo: {
            username: `admin-${randomString(10)}`,
            confidant: `c.${randomString()}`,
            manager: `m.${randomString()}`,
        },
        acmeClientInfo: { confidant: `c.${randomString()}`, username: `acme-${randomString(10)}` },
        tntAuth: { username: randomString(20), password: randomString() },
        proxyAuth: { username: randomString(20), password: randomString() },
    } as K8sSecrets;

    pektinConfig.nodes.forEach((node) => {
        secrets.nodes[node.name] = { DB_PEKTIN_SERVER_PASSWORD: randomString() };
    });
    pektinConfig.nameservers.forEach((ns) => {
        /*@ts-ignore*/
        secrets.nameserverSignerPasswords[ns.domain] = randomString();
    });

    secrets.tntAuth.basicAuth = genBasicAuthHashed(
        secrets.tntAuth.username,
        secrets.tntAuth.password
    );
    secrets.proxyAuth.basicAuth = genBasicAuthHashed(
        secrets.proxyAuth.username,
        secrets.proxyAuth.password
    );

    /*
    const tempDomain = await requestPektinDomain(pektinConfig);
    const traefikConfs = genTraefikConfs({
        pektinConfig,
        node: getMainNode(pektinConfig),
        tntAuth: genBasicAuthHashed(
            secrets.tntAuth?.username as string,
            secrets.tntAuth?.password as string
        ),
        ...(tempDomain && { tempDomain }),
        proxyAuth: genBasicAuthHashed(
            secrets.proxyAuth?.username as string,
            secrets.proxyAuth?.password as string
        ),
    });
    await fs
        .mkdir(path.join(dir, `generated`, `traefik`, `dynamic`), { recursive: true })
        .catch(() => {});
    await fs.writeFile(
        path.join(dir, `generated`, `traefik`, `dynamic`, `default.yml`),
        traefikConfs.dynamic
    );
    await fs.writeFile(path.join(dir, `generated`, `traefik`, `static.yml`), traefikConfs.static);
*/
    await fs.writeFile(path.join(dir, `secrets.yml`), yaml.stringify({ secrets }));
    await chownRecursive(path.join(dir, `secrets.yml`), process.env.UID, process.env.GID);
    await chmod(path.join(dir, `secrets.yml`), `600`);
};

export interface K8sSecrets {
    PERIMETER_AUTH_HASHED: string;
    PERIMETER_AUTH: string;
    nameserverSignerPasswords: {
        [name: string]: string;
    };
    DB_PEKTIN_API_PASSWORD: string;
    V_PEKTIN_API_PASSWORD: string;
    V_PEKTIN_API_USER_NAME: string;
    DB_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
    DB_PEKTIN_SERVER_PASSWORD: string;
    adminClientInfo: {
        confidant: string;
        manager: string;
        username: string;
    };
    acmeClientInfo: {
        confidant: string;
        username: string;
    };
    tntAuth: {
        username: string;
        password: string;
        basicAuth: string;
    };
    proxyAuth: {
        username: string;
        password: string;
        basicAuth: string;
    };
    nodes: {
        [nodeNames: string]: {
            DB_PEKTIN_SERVER_PASSWORD: string;
        };
    };
}
