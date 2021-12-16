import { absoluteName, deAbsolute } from "./index.js";
import { PearPolicy, PektinOfficerMeta } from "./types.js";
import { randomString } from "./utils.js";
import { pektinApiPolicy, pektinClientPolicy, pektinSignerPolicy } from "./vault/pektinPolicies.js";
import { VaultAuthEngine, VaultSecretEngine } from "./vault/types.js";
import {
    createEntity,
    createEntityAlias,
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
    const absDomain = absoluteName(domainName);
    const name = `pektin-signer-${absDomain.substring(0, absDomain.length - 1)}`;

    const metadata = { domain: absDomain.substring(0, absDomain.length - 1) };

    createFullUserPass(endpoint, token, name, password, metadata, ["pektin-signer"]);
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
    const officerPassword = randomString();

    await updatePektinAuthPasswords(endpoint, token, "officer", officerPassword, clientName);

    await createPektinOfficer(endpoint, token, clientName, officerPassword, pearPolicy);

    await createVaultPolicy(
        endpoint,
        token,
        clientName,
        pektinClientPolicy(clientName, allowedSigningDomains, allowAllSigningDomains)
    );

    await createPektinClient(endpoint, token, clientName, clientPassword);
};

export const createPektinOfficer = async (
    endpoint: string,
    token: string,
    clientName: string,
    password: string,
    pearPolicy: PearPolicy
) => {
    const name = `pektin-officer-${clientName}`;
    const metadata: PektinOfficerMeta = { pearPolicy, pearTree: "meta/pearPolicy" };
    createFullUserPass(endpoint, token, name, password, metadata, []);
};

export const createPektinClient = async (
    endpoint: string,
    token: string,
    clientName: string,
    password: string
) => {
    createFullUserPass(endpoint, token, clientName, password, {}, [clientName]);
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
    type: "officer" | "signer",
    password: string,
    authName: string /* authName is either the client name for the officer or the domain name for the signer */
) => {
    const updatePassword = await updateKvValue(
        endpoint,
        token,
        deAbsolute(authName),
        { password },
        `pektin-${type}-passwords`
    );

    console.log(updatePassword);

    for (let i = 1; i < 3; i++) {
        if (password.length % 2 !== 0) throw new Error("Password must have a even length");
        const passwordHalf =
            i === 1
                ? password.substring(0, password.length / 2)
                : password.substring(password.length / 2);
        const updatePasswordHalf = await updateKvValue(
            endpoint,
            token,
            deAbsolute(authName),
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
