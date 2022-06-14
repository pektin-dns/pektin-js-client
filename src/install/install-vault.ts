import { absoluteName, deAbsolute, getPektinEndpoint, isReady } from "../index.js";
import {
    createPektinVaultEngines,
    createPektinAuthVaultPolicies,
    createDomainDnsKeys,
    createPektinApiAccount,
    createPektinClient,
} from "../auth.js";
import { initVault, unsealVault, enableVaultCors, updateKvValue } from "../vault/vault.js";
import { genBasicAuthHashed, genBasicAuthString } from "./utils.js";
import { PektinConfig } from "@pektin/config/src/config-types";
import { promises as fs } from "fs";
import { K8sSecrets } from "./k8s.js";
import { PC3 } from "../types.js";
import path from "path";
import { randomString } from "../utils/index.js";

export const installVault = async ({
    pektinConfig,
    internalVaultUrl = `http://pektin-vault`,
    secrets,
    k8s,
}: {
    pektinConfig: PektinConfig;
    internalVaultUrl?: string;
    secrets?: K8sSecrets;
    k8s?: boolean;
}) => {
    const policyFolder = `dist/policies`;
    const opaPolicyFolder = `src/opa-policies`;
    await isReady(internalVaultUrl);
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
            const nsPass =
                secrets?.nameserverSignerPasswords?.[absoluteName(ns.domain)] ??
                secrets?.nameserverSignerPasswords?.[deAbsolute(ns.domain)];
            if (ns.main) {
                if (!nsPass && k8s) {
                    throw Error(
                        `Trying to install vault for k8s but missing necessary signer passwords for domain: ${
                            ns.domain
                        } got nsPass: ${nsPass} and secrets?.nameserverSignerPasswords: ${JSON.stringify(
                            secrets?.nameserverSignerPasswords
                        )}`
                    );
                }

                await createDomainDnsKeys(internalVaultUrl, vaultTokens.rootToken, ns.domain);
            }
        });
    }
    // create the vault infra for the api
    if (!secrets?.V_PEKTIN_API_PASSWORD && k8s) {
        throw Error(`Trying to install vault for k8s but missing necessary api password`);
    }
    const V_PEKTIN_API_PASSWORD = secrets?.V_PEKTIN_API_PASSWORD ?? randomString();
    const V_PEKTIN_API_USER_NAME =
        secrets?.V_PEKTIN_API_USER_NAME ?? `pektin-api-${randomString(10).toLowerCase()}`;

    createPektinApiAccount(
        internalVaultUrl,
        vaultTokens.rootToken,
        V_PEKTIN_API_PASSWORD,
        V_PEKTIN_API_USER_NAME
    );

    let vaultEndpoint = getPektinEndpoint(pektinConfig, `vault`);

    await enableVaultCors(internalVaultUrl, vaultTokens.rootToken);

    // create admin account
    if (k8s) {
        if (
            !secrets?.adminClientInfo?.confidant ||
            !secrets?.adminClientInfo?.manager ||
            !secrets?.adminClientInfo?.username
        ) {
            throw Error(`Trying to install vault for k8s but missing necessary admin passwords`);
        }
    }
    const pektinAdminConnectionConfig = {
        username: `admin-${randomString(10).toLowerCase()}`,
        managerPassword: `m.${randomString()}`,
        confidantPassword: `c.${randomString()}`,
        vaultEndpoint,
        info: { apiCredentials: { gandi: [{ apiKey: `` }] } },
    } as PC3;

    const pektinAdminRibstonPolicy = await fs.readFile(
        path.join(policyFolder, `allow-everything.ribston.js`),
        `utf-8`
    );
    const pektinAdminOpaPolicy = await fs.readFile(
        path.join(opaPolicyFolder, `allow-everything.rego`),
        `utf-8`
    );

    await createPektinClient({
        endpoint: internalVaultUrl,
        token: vaultTokens.rootToken,
        clientName: pektinAdminConnectionConfig.username,
        managerPassword: pektinAdminConnectionConfig.managerPassword,
        confidantPassword: pektinAdminConnectionConfig.confidantPassword as string,
        capabilities: {
            allowAllSigningDomains: true,
            allAccess: true,
            allowFullUserManagement: true,
            ribstonPolicy: pektinAdminRibstonPolicy,
            opaPolicy: pektinAdminOpaPolicy,
        },
    });

    let acmeClientConnectionConfig: false | PC3 = false;

    // create acme client if enabled
    if (pektinConfig.letsencrypt) {
        if (k8s) {
            if (!secrets?.acmeClientInfo?.confidant || !secrets?.acmeClientInfo?.username) {
                throw Error(`Trying to install vault for k8s but missing necessary acme passwords`);
            }
        }
        acmeClientConnectionConfig = {
            username: `acme-${randomString(10).toLowerCase()}`,
            confidantPassword: `c.${randomString()}`,
            override: {
                pektinApiEndpoint: getPektinEndpoint(pektinConfig, `api`),
            },
        } as PC3;

        const acmeClientRibstonPolicy = await fs.readFile(
            path.join(policyFolder, `acme.ribston.js`),
            `utf-8`
        );

        const acmeClientOpaPolicy = await fs.readFile(
            path.join(opaPolicyFolder, `acme.rego`),
            `utf-8`
        );

        await createPektinClient({
            endpoint: internalVaultUrl,
            token: vaultTokens.rootToken,
            clientName: acmeClientConnectionConfig.username,
            confidantPassword: acmeClientConnectionConfig.confidantPassword as string,
            capabilities: {
                ribstonPolicy: acmeClientRibstonPolicy,
                allowAllSigningDomains: true,
                opaPolicy: acmeClientOpaPolicy,
            },
        });
    }

    if (k8s) {
        if (pektinConfig.services.tnt.enabled) {
            if (!secrets?.tntAuth?.password || !secrets?.tntAuth?.username) {
                throw Error(`Trying to install vault for k8s but missing necessary tntAuth info`);
            }
        }
        if (pektinConfig.reverseProxy.external.enabled) {
            if (!secrets?.proxyAuth?.password || !secrets?.proxyAuth?.username) {
                throw Error(`Trying to install vault for k8s but missing necessary tntAuth info`);
            }
        }
    }

    // create basic auth for tnt
    const TNT_USER = secrets?.tntAuth?.username ?? randomString(20);
    const TNT_PASSWORD = secrets?.tntAuth?.password ?? randomString();
    const tntBasicAuthHashed = genBasicAuthHashed(TNT_USER, TNT_PASSWORD);

    // create auth for proxy
    const PROXY_USER = secrets?.proxyAuth?.username ?? randomString(20);
    const PROXY_PASSWORD = secrets?.proxyAuth?.password ?? randomString();
    const proxyBasicAuthHashed = genBasicAuthHashed(PROXY_USER, PROXY_PASSWORD);

    // set tnt basic auth string on vault
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `tnt-auth`,
        {
            basicAuth: genBasicAuthString(TNT_USER, TNT_PASSWORD),
            hashedAuth: tntBasicAuthHashed,
            user: TNT_USER,
            password: TNT_PASSWORD,
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
            user: PROXY_USER,
            password: PROXY_PASSWORD,
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

    return {
        pektinAdminConnectionConfig,
        vaultTokens,
        tntBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
        acmeClientConnectionConfig,
        V_PEKTIN_API_USER_NAME,
    };
};
