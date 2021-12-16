import { deAbsolute } from "./index.js";
import { PearPolicy } from "./types.js";
import { pektinApiPolicy, pektinClientPolicy, pektinSignerPolicy } from "./vault/pektinPolicies.js";
import { VaultAuthEngine, VaultSecretEngine } from "./vault/types.js";
import {
    createEntity,
    createEntityAlias,
    createSigningKey,
    createUserPassAccount,
    createVaultPolicy,
    enableAuthMethod,
    enableSecretEngine,
    getAuthMethods,
    getEntityByName,
    updateKvValue
} from "./vault/vault.js";

export const createPektinSigner = async (
    endpoint: string,
    token: string,
    domainName: string,
    password: string
) => {
    domainName = deAbsolute(domainName);
    const name = `pektin-signer-${domainName}`;

    const metadata = { domain: domainName };

    createFullUserPass(endpoint, token, name, password, metadata, ["pektin-signer"]);

    createSigningKey(endpoint, token, domainName);
};

export const createFullPektinClient = async (
    endpoint: string,
    token: string,
    clientName: string,
    clientPassword: string,
    pearPolicy: PearPolicy,
    allowedSigningDomains: string[],
    allowAllSigningDomains?: boolean
) => {
    await createPektinPearPolicy(endpoint, token, clientName, pearPolicy);

    await createVaultPolicy(
        endpoint,
        token,
        clientName,
        pektinClientPolicy(allowedSigningDomains, allowAllSigningDomains)
    );

    await createPektinClient(endpoint, token, clientName, clientPassword, {
        pearPolicyLocation: "default"
    }); // default means in the "pektin-pear-policies" kv store
};

export const createPektinPearPolicy = async (
    endpoint: string,
    token: string,
    policyName: string,
    policy: PearPolicy
) => {
    updateKvValue(endpoint, token, policyName, { policy }, "pektin-pear-policies");
};

export const createPektinClient = async (
    endpoint: string,
    token: string,
    clientName: string,
    password: string,
    metadata: object
) => {
    createFullUserPass(endpoint, token, clientName, password, metadata, [clientName]);
};

export const createPektinApiAccount = async (endpoint: string, token: string, password: string) => {
    createFullUserPass(endpoint, token, "pektin-api", password, {}, ["pektin-api"]);
};

export const createPektinAuthVaultPolicies = async (endpoint: string, token: string) => {
    const policyPairs = [
        { name: "pektin-signer", policy: pektinSignerPolicy },
        { name: "pektin-api", policy: pektinApiPolicy }
    ];

    policyPairs.map(async e => {
        await createVaultPolicy(endpoint, token, e.name, e.policy);
    });
};

export const createPektinVaultEngines = async (
    endpoint: string,
    token: string,
    secretEngines: VaultSecretEngine[],
    authEngines: VaultAuthEngine[]
) => {
    for (let i = 0; i < secretEngines.length; i++) {
        const engine = secretEngines[i];
        await enableSecretEngine(endpoint, token, engine.path, engine.options);
    }

    for (let i = 0; i < authEngines.length; i++) {
        const engine = authEngines[i];
        await enableAuthMethod(endpoint, token, engine.options.type, engine.path);
    }
};

export const updatePektinAuthPasswords = async (
    endpoint: string,
    token: string,
    type: "signer",
    password: string,
    domainName: string
) => {
    const updatePassword = await updateKvValue(
        endpoint,
        token,
        deAbsolute(domainName),
        { password },
        `pektin-${type}-passwords`
    );

    for (let i = 1; i < 3; i++) {
        if (password.length % 2 !== 0) throw new Error("Password must have a even length");
        const passwordHalf =
            i === 1
                ? password.substring(0, password.length / 2)
                : password.substring(password.length / 2);
        const updatePasswordHalf = await updateKvValue(
            endpoint,
            token,
            deAbsolute(domainName),
            { password: passwordHalf },
            `pektin-${type}-passwords-${i}`
        );
    }
};

export const createFullUserPass = async (
    endpoint: string,
    token: string,
    name: string,
    password: string,
    metadata: Object,
    vaultPolicyNames: string[]
) => {
    const entityResponse = await createEntity(endpoint, token, {
        name,
        metadata,
        policies: vaultPolicyNames
    });

    const entity =
        entityResponse?.data?.id === undefined
            ? await getEntityByName(endpoint, token, name)
            : entityResponse?.data;

    if (!entity?.id)
        throw new Error(`Entity couldn't be created: ${JSON.stringify(entityResponse)}`);

    const authMethods = await getAuthMethods(endpoint, token);

    const userpassResponse = await createUserPassAccount(
        endpoint,
        token,
        name,
        "userpass/",
        password
    );

    const entityAliasResponse = await createEntityAlias(endpoint, token, {
        name,
        canonical_id: entity.id,
        mount_accessor: authMethods["userpass/"].accessor
    });
};
