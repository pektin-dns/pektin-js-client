import { ClientCapabilities, ClientName, DomainName, ManagerName, toASCII } from "./index.js";
import {
    pektinApiPolicy,
    pektinConfidantPolicy,
    pektinServerAdminManagerPolicy,
    pektinSignerPolicy,
} from "./vault/pektinVaultPolicies.js";
import { VaultAuthEngine, VaultSecretEngine } from "./vault/types.js";
import {
    createEntity,
    createEntityAlias,
    createSigningKey,
    createUserPassAccount,
    createVaultPolicy,
    deleteUserPass,
    deleteVaultPolicy,
    enableAuthMethod,
    enableSecretEngine,
    getAuthMethods,
    getEntityByName,
    listVaultUsers,
    updateKvValue,
} from "./vault/vault.js";
import { deAbsolute, isOnlyLowercase } from "./utils/index.js";
import { Client } from "./types.js";

export const createPektinSigner = async (
    endpoint: string,
    token: string,
    domainName: string,
    password: string
) => {
    domainName = toASCII(deAbsolute(domainName));

    const name = `pektin-signer-${domainName}`;

    const metadata = { domain: domainName };

    await Promise.all([
        createFullUserPass(endpoint, token, name, password, metadata, [`pektin-signer`]),
        createSigningKey(endpoint, token, `${domainName}-ksk`),
        createSigningKey(endpoint, token, `${domainName}-zsk`),
    ]);
};

export const createPektinClient = async ({
    endpoint,
    token,
    clientName,
    managerPassword,
    confidantPassword,
    capabilities,
}: {
    endpoint: string;
    token: string;
    clientName: ClientName;
    managerPassword?: string;
    confidantPassword: string;
    capabilities: ClientCapabilities;
}) => {
    if (!isOnlyLowercase(clientName)) {
        throw Error(
            `Vault normaly silently mangles usernames to lowercase thus we will tell you right away that any clients name must be lowercase. See https://github.com/hashicorp/vault/issues/13647`
        );
    }
    await updateKvValue(
        endpoint,
        token,
        clientName,
        { ribstonPolicy: capabilities.ribstonPolicy, opaPolicy: capabilities.opaPolicy },
        `pektin-policies`
    );
    if (managerPassword) {
        await createPektinClientManager(endpoint, token, clientName, managerPassword, capabilities);
    }

    await createPektinClientConfidant(
        endpoint,
        token,
        clientName,
        confidantPassword,
        {},
        capabilities
    );

    return confidantPassword;
};

export const createPektinClientManager = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    password: string,
    capabilities: ClientCapabilities
) => {
    const name: ManagerName = `pektin-client-${clientName}-manager`;

    await createFullUserPass(endpoint, token, name, password, {}, [name]);
    if (capabilities.allowFullUserManagement) {
        await createVaultPolicy(endpoint, token, name, pektinServerAdminManagerPolicy);
    }
};

export const createPektinClientConfidant = async (
    endpoint: string,
    token: string,
    clientName: ClientName,
    password: string,
    metadata: object,
    capabilities: ClientCapabilities
) => {
    const confidantName = `pektin-client-${clientName}-confidant`;
    await createFullUserPass(endpoint, token, confidantName, password, metadata, [confidantName]);

    await createVaultPolicy(endpoint, token, confidantName, pektinConfidantPolicy(capabilities));
};

export const createPektinApiAccount = async (endpoint: string, token: string, password: string) => {
    createFullUserPass(endpoint, token, `pektin-api`, password, {}, [`pektin-api`]);
};

export const createPektinAuthVaultPolicies = async (endpoint: string, token: string) => {
    const policyPairs = [
        { name: `pektin-signer`, policy: pektinSignerPolicy },
        { name: `pektin-api`, policy: pektinApiPolicy },
    ];

    policyPairs.map(async (e) => {
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
    type: `signer`,
    password: string,
    authName: DomainName
) => {
    await updateKvValue(
        endpoint,
        token,
        deAbsolute(authName),
        { password },
        `pektin-${type}-passwords`
    );

    for (let i = 1; i < 3; i++) {
        if (password.length % 2 !== 0) throw new Error(`Password must have an even length`);
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
        policies: vaultPolicyNames,
    });

    const entity =
        entityResponse?.data?.id === undefined
            ? await getEntityByName(endpoint, token, name)
            : entityResponse?.data;

    if (!entity?.id)
        throw new Error(`Entity couldn't be created: ${JSON.stringify(entityResponse)}`);

    const authMethods = await getAuthMethods(endpoint, token);

    await createUserPassAccount(endpoint, token, name, `userpass/`, password);

    await createEntityAlias(endpoint, token, {
        name,
        canonical_id: entity.id,
        mount_accessor: authMethods[`userpass/`].accessor,
    });
};

// TODO
export const deleteClient = async (endpoint: string, token: string, client: Client) => {
    const deleteRequests = [];
    if (client.confidant) {
        const n = `pektin-client-${client.name}-confidant`;
        deleteRequests.push(deleteUserPass(endpoint, token, n));
        deleteRequests.push(deleteVaultPolicy(endpoint, token, n));
    }
    if (client.manager) {
        const n = `pektin-client-${client.name}-manager`;
        deleteRequests.push(deleteUserPass(endpoint, token, n));
        deleteRequests.push(deleteVaultPolicy(endpoint, token, n));
    }
    return await Promise.all([deleteRequests]);
};

export const getPektinClients = async (endpoint: string, token: string) => {
    const vaultUsers = await listVaultUsers(endpoint, token);
    return filterDistinctClients(vaultUsers);
};

export const filterDistinctClients = (vaultClients: string[]) => {
    vaultClients = filterStartsWith(vaultClients, `pektin-client`);
    const clientList: Client[] = [];

    const rec = () => {
        const client = vaultClients[0];

        const name = client.substring(14, client.lastIndexOf(`-`));
        const confidant = vaultClients.findIndex((e) => e === `pektin-client-${name}-confidant`);
        if (confidant > -1) vaultClients.splice(confidant, 1);

        const manager = vaultClients.findIndex((e) => e === `pektin-client-${name}-manager`);
        if (manager > -1) vaultClients.splice(manager, 1);

        clientList.push({ confidant: confidant > -1, name, manager: manager > -1 });
        if (vaultClients.length) rec();
    };
    rec();
    return clientList;
};

export const filterStartsWith = (a: string[], startsWith: string) => {
    return a.filter((b) => b.startsWith(startsWith));
};
