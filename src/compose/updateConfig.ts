import { promises as fs } from "fs";
import path from "path";
import { chownRecursive, chown, chmod, randomString, configToCertbotIni } from "./utils.js";

import { unsealVault } from "./../vault/vault.js";
import { PektinClientConnectionConfigOverride } from "./../index.js";
import { PektinConfig } from "@pektin/config/src/config-types.js";
import { config } from "dotenv";
config({ path: `/pektin-compose/secrets/.env` });
import { createPektinClient, createPektinSigner, updatePektinSharedPasswords } from "./../auth.js";
import { getPektinEndpoint } from "../index.js";
import { genTraefikConfs } from "../traefik/index.js";
import { getMainNode } from "../pureFunctions.js";
import { createStartScript, createStopScript, createUpdateScript } from "./install.js";
import { PektinClient } from "../main.js";
import { TempDomain } from "../types.js";

export const updateConfig = async (
    dir: string = `/pektin-compose/`,
    internalVaultUrl: string = `http://pektin-vault`
) => {
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

    const adminPC3: PektinClientConnectionConfigOverride = JSON.parse(
        await fs.readFile(path.join(dir, `secrets`, `server-admin-connection-config.json`), {
            encoding: `utf-8`,
        })
    );

    const pc = new PektinClient(adminPC3);

    if (process.env.V_KEY === undefined || process.env.V_ROOT_TOKEN === undefined) {
        throw Error(`Undefined vault key and/or root token`);
    }
    const vaultTokens = { key: process.env.V_KEY, rootToken: process.env.V_ROOT_TOKEN };

    // HTTP API CALL RELATED
    // init vault
    await unsealVault(internalVaultUrl, vaultTokens.key);

    // TODO delete old signer
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

    // TODO delete old acme client if disabled
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
                opaPolicy: ``, // TODO add OPA policies
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

    // HARD DRIVE RELATED

    await fs
        .mkdir(path.join(dir, `secrets`, `traefik`, `dynamic`), { recursive: true })
        .catch(() => {});

    const recursorBasicAuthHashed = await pc.getAuth(`recursor`, true);

    const proxyBasicAuthHashed = await pc.getAuth(`proxy`, true);

    const tempDomain = (await pc.getPektinKv(`tempDomain`)) as unknown as TempDomain;

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
    await chmod(path.join(dir, `secrets`, `acme-client-connection-config.json`), `600`);
    await chmod(path.join(dir, `secrets`, `server-admin-connection-config.json`), `600`);
    await chmod(path.join(dir, `secrets`, `certbot-acme-client-connection-config.ini`), `600`);
};
