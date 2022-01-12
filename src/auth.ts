import { deAbsolute } from "./index.js";
import { RibstonPolicy } from "./types";
import { randomString } from "./utils.js";
import {
    pektinApiPolicy,
    pektinConfidantPolicy,
    pektinOfficerPolicy,
    pektinSignerPolicy
} from "./vault/pektinVaultPolicies.js";
import {
    ClientName,
    DomainName,
    ManagerName,
    OfficerName,
    VaultAuthEngine,
    VaultSecretEngine
} from "./vault/types";
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

export const createPektinOfficer = async (
    endpoint: string,
    token: string,
    clientName: string,
    password: string,
    ribstonPolicy: RibstonPolicy
) => {
    const officerName: OfficerName = `pektin-officer-${clientName}`;

    await updateKvValue(
        endpoint,
        token,
        clientName,
        { policy: ribstonPolicy },
        "pektin-ribston-policies"
    );

    await createVaultPolicy(endpoint, token, officerName, pektinOfficerPolicy(officerName));

    await createFullUserPass(endpoint, token, officerName, password, {}, [officerName]);
};

export const createPektinClient = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    managerPassword: string,
    ribstonPolicy: RibstonPolicy,
    allowedSigningDomains: string[],
    allowAllSigningDomains?: boolean
) => {
    const officerPassword = randomString();

    await updatePektinSharedPasswords(endpoint, token, "officer", officerPassword, clientName);

    await createPektinOfficer(endpoint, token, clientName, officerPassword, ribstonPolicy);

    await createVaultPolicy(
        endpoint,
        token,
        clientName,
        pektinConfidantPolicy(clientName, allowedSigningDomains, allowAllSigningDomains)
    );

    await createPektinManager(endpoint, token, clientName, managerPassword);
    const confidantPassword = randomString();
    await updateConfidantPassword(endpoint, token, clientName, confidantPassword);

    await createPektinConfidant(endpoint, token, clientName, confidantPassword, {});
};

export const updateConfidantPassword = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    password: string
) => {
    await updateKvValue(endpoint, token, clientName, { password }, `pektin-confidant-passwords`);
};

export const createPektinManager = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    password: string
) => {
    const name: ManagerName = `pektin-client-manager-${clientName}`;
    createFullUserPass(endpoint, token, name, password, {}, [name]);
};

export const createPektinConfidant = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    password: string,
    metadata: object
) => {
    createFullUserPass(
        endpoint,
        token,
        `pektin-client-confidant-${clientName}`,
        password,
        metadata,
        [clientName]
    );
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

export const updatePektinSharedPasswords = async (
    endpoint: string,
    token: string,
    type: "signer" | "officer",
    password: string,
    authName:
        | ClientName
        | DomainName /* authName is either the client name for the officer or the domain name for the signer */
) => {
    await updateKvValue(
        endpoint,
        token,
        deAbsolute(authName),
        { password },
        `pektin-${type}-passwords`
    );

    for (let i = 1; i < 3; i++) {
        if (password.length % 2 !== 0) throw new Error("Password must have a even length");
        const passwordHalf =
            i === 1
                ? password.substring(0, password.length / 2)
                : password.substring(password.length / 2);
        await updateKvValue(
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

    await createUserPassAccount(endpoint, token, name, "userpass/", password);

    await createEntityAlias(endpoint, token, {
        name,
        canonical_id: entity.id,
        mount_accessor: authMethods["userpass/"].accessor
    });
};
