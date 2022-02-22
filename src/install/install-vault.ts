import { absoluteName, deAbsolute, getPektinEndpoint, isReady } from "../index.js";
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
import { randomString } from "./utils.js";
import { PektinConfig } from "@pektin/config/src/config-types";
import { promises as fs } from "fs";
import { K8sSecrets } from "./k8s.js";
import { PC3 } from "../types.js";

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

                const domainSignerPassword = nsPass ?? randomString();
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
    if (!secrets?.V_PEKTIN_API_PASSWORD && k8s) {
        throw Error(`Trying to install vault for k8s but missing necessary api password`);
    }
    const V_PEKTIN_API_PASSWORD = secrets?.V_PEKTIN_API_PASSWORD ?? randomString();

    createPektinApiAccount(internalVaultUrl, vaultTokens.rootToken, V_PEKTIN_API_PASSWORD);

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

    let acmeClientConnectionConfig: false | PC3 = false;

    // create acme client if enabled
    if (pektinConfig.letsencrypt) {
        if (k8s) {
            if (!secrets?.acmeClientInfo?.confidant || !secrets?.acmeClientInfo?.username) {
                throw Error(`Trying to install vault for k8s but missing necessary acme passwords`);
            }
        }
        acmeClientConnectionConfig = {
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
            confidantPassword: acmeClientConnectionConfig.confidantPassword as string,
            capabilities: {
                ribstonPolicy: acmeClientRibstonPolicy,
                allowAllSigningDomains: true,
                opaPolicy: ``, // TODO add OPA policies
            },
        });
    }

    if (k8s) {
        if (pektinConfig.services.recursor.enabled) {
            if (!secrets?.recursorAuth?.password || !secrets?.recursorAuth?.username) {
                throw Error(
                    `Trying to install vault for k8s but missing necessary recursorAuth info`
                );
            }
        }
        if (pektinConfig.reverseProxy.external.enabled) {
            if (!secrets?.proxyAuth?.password || !secrets?.proxyAuth?.username) {
                throw Error(
                    `Trying to install vault for k8s but missing necessary recursorAuth info`
                );
            }
        }
    }

    // create basic auth for recursor
    const RECURSOR_USER = secrets?.recursorAuth?.username ?? randomString(20);
    const RECURSOR_PASSWORD = secrets?.recursorAuth?.password ?? randomString();
    const recursorBasicAuthHashed = genBasicAuthHashed(RECURSOR_USER, RECURSOR_PASSWORD);

    // create basic auth for recursor
    const PROXY_USER = secrets?.proxyAuth?.username ?? randomString(20);
    const PROXY_PASSWORD = secrets?.proxyAuth?.password ?? randomString();
    const proxyBasicAuthHashed = genBasicAuthHashed(PROXY_USER, PROXY_PASSWORD);

    // set recursor basic auth string on vault
    await updateKvValue(
        internalVaultUrl,
        vaultTokens.rootToken,
        `recursor-auth`,
        {
            basicAuth: genBasicAuthString(RECURSOR_USER, RECURSOR_PASSWORD),
            hashedAuth: recursorBasicAuthHashed,
            user: RECURSOR_USER,
            password: RECURSOR_PASSWORD,
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
        recursorBasicAuthHashed,
        proxyBasicAuthHashed,
        V_PEKTIN_API_PASSWORD,
        acmeClientConnectionConfig,
    };
};
