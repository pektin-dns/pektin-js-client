import yaml from "yaml";
import { PC3 } from "../types.js";
import { installVault } from "./install-vault.js";
import { chownRecursive, configToCertbotIni, randomString, requestPektinDomain } from "./utils.js";
import { promises as fs } from "fs";
import path from "path";
import { chmod } from "./utils.js";
import { PektinConfig } from "@pektin/config/src/config-types";
import { PektinSetupClient } from "./first-start.js";
import { genTraefikConfs } from "../traefik/index.js";
import { getMainNode } from "../pureFunctions.js";
import { genBasicAuthHashed } from "./compose.js";

export const installK8s = async (dir: string = `/base/`) => {
    if (process.env.UID === undefined || process.env.GID === undefined) {
        throw Error(
            `No UID and/or GID defined. Current is: UID: ` +
                process.env.UID +
                `, GID: ` +
                process.env.GID
        );
    }
    const secrets = yaml.parse(
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
            secrets: secrets.secrets,
            k8s: true,
            internalVaultUrl: `http://127.0.0.1:8200`,
        });

    await fs.mkdir(path.join(dir, `secrets`), { recursive: true });
    await fs.writeFile(
        path.join(dir, `secrets`, `server-admin.pc3.json`),
        JSON.stringify(pektinAdminConnectionConfig)
    );
    await fs.writeFile(path.join(dir, `secrets`, `vault-tokens.json`), JSON.stringify(vaultTokens));
    await fs.writeFile(
        path.join(dir, `secrets`, `acme-client.pc3.json`),
        JSON.stringify(acmeClientConnectionConfig)
    );
    await fs.writeFile(
        path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`),
        configToCertbotIni(acmeClientConnectionConfig as PC3)
    );

    await chownRecursive(path.join(dir, `secrets`), process.env.UID, process.env.GID);

    await chmod(path.join(dir, `secrets`), `700`);
    await chmod(path.join(dir, `secrets`, `acme-client.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `server-admin.pc3.json`), `600`);
    await chmod(path.join(dir, `secrets`, `vault-tokens.json`), `600`);
    await chmod(path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`), `600`);

    if (pektinConfig.nameservers?.length) {
        const pc = new PektinSetupClient({
            username: pektinAdminConnectionConfig.username,
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

    const secrets: K8sSecrets = {
        R_PEKTIN_API_PASSWORD: randomString(),
        V_PEKTIN_API_PASSWORD: randomString(),
        R_PEKTIN_GEWERKSCHAFT_PASSWORD: randomString(),
        R_PEKTIN_SERVER_PASSWORD: randomString(),
        nodes: {},
        nameserverSignerPasswords: {},
        adminClientInfo: {
            username: `admin-${randomString(10)}`,
            confidant: `c.${randomString()}`,
            manager: `m.${randomString()}`,
        },
        acmeClientInfo: { confidant: `c.${randomString()}`, username: `acme-${randomString(10)}` },
        recursorAuth: { username: randomString(20), password: randomString() },
        proxyAuth: { username: randomString(20), password: randomString() },
    } as K8sSecrets;

    pektinConfig.nodes.forEach((node) => {
        secrets.nodes[node.name] = { R_PEKTIN_SERVER_PASSWORD: randomString() };
    });
    pektinConfig.nameservers.forEach((ns) => {
        /*@ts-ignore*/
        secrets.nameserverSignerPasswords[ns.domain] = randomString();
    });

    secrets.recursorAuth.basicAuth = genBasicAuthHashed(
        secrets.recursorAuth.username,
        secrets.recursorAuth.password
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
        recursorAuth: genBasicAuthHashed(
            secrets.recursorAuth?.username as string,
            secrets.recursorAuth?.password as string
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
    nameserverSignerPasswords: {
        [name: string]: string;
    };
    R_PEKTIN_API_PASSWORD: string;
    V_PEKTIN_API_PASSWORD: string;
    R_PEKTIN_GEWERKSCHAFT_PASSWORD: string;
    R_PEKTIN_SERVER_PASSWORD: string;
    adminClientInfo: {
        confidant: string;
        manager: string;
        username: string;
    };
    acmeClientInfo: {
        confidant: string;
        username: string;
    };
    recursorAuth: {
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
            R_PEKTIN_SERVER_PASSWORD: string;
        };
    };
}
