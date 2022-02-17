import path from "path";
import { getPektinEndpoint, PC3 } from "../index.js";
import {
    createPektinVaultEngines,
    createPektinAuthVaultPolicies,
    createPektinSigner,
    updatePektinSharedPasswords,
    createPektinApiAccount,
    createPektinClient,
} from "../auth.js";
import { initVault, unsealVault, enableVaultCors, updateKvValue } from "../vault/vault.js";
import { genBasicAuthHashed, genBasicAuthString } from "./compose.js";
import { randomString, configToCertbotIni } from "./utils.js";
import { PektinConfig } from "@pektin/config/src/config-types";
import { promises as fs } from "fs";

export const installVault = async (
    pektinConfig: PektinConfig,
    dir: string = `/pektin-compose/`,
    internalVaultUrl: string = `http://pektin-vault`
) => {
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
                path: `pektin-policies`,
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
            allAccess: true,
            ribstonPolicy: pektinAdminRibstonPolicy,
            opaPolicy: ``, // TODO add OPA policies
        },
    });

    // create acme client if enabled
    if (pektinConfig.letsencrypt) {
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
            path.join(dir, `secrets`, `acme-client.pc3.json`),
            JSON.stringify(acmeClientConnectionConfig)
        );
        await fs.writeFile(
            path.join(dir, `secrets`, `certbot-acme-client.pc3.ini`),
            configToCertbotIni(acmeClientConnectionConfig as PC3)
        );
    }

    // create basic auth for recursor
    const RECURSOR_USER = randomString(20);
    const RECURSOR_PASSWORD = randomString();
    const recursorBasicAuthHashed = genBasicAuthHashed(RECURSOR_USER, RECURSOR_PASSWORD);

    // create basic auth for recursor
    const PROXY_USER = randomString(20);
    const PROXY_PASSWORD = randomString();
    const proxyBasicAuthHashed = genBasicAuthHashed(PROXY_USER, PROXY_PASSWORD);

    // set recursor basic auth string on vault
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `recursor-auth`,
        {
            basicAuth: genBasicAuthString(RECURSOR_USER, RECURSOR_PASSWORD),
            hashedAuth: recursorBasicAuthHashed,
        },
        `pektin-kv`
    );
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `proxy-auth`,
        {
            basicAuth: genBasicAuthString(PROXY_USER, PROXY_PASSWORD),
            hashedAuth: proxyBasicAuthHashed,
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

    await fs.writeFile(
        path.join(dir, `secrets`, `server-admin.pc3.json`),
        JSON.stringify(pektinAdminConnectionConfig)
    );

    return {
        pektinAdminConnectionConfig,
        vaultTokens,
        recursorBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
    };
};
