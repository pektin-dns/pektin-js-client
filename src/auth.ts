import { ClientCapabilities, ClientName, DomainName, ManagerName, toASCII } from "./index.js";
import {
    pektinApiPolicy,
    pektinConfidantPolicy,
    pektinServerAdminManagerPolicy,
} from "./vault/pektinVaultPolicies.js";
import { VaultAuthEngine, VaultSecretEngine } from "./vault/types.js";
import {
    allowKeyDeletion,
    createEntity,
    createEntityAlias,
    createSigningKey,
    createUserPassAccount,
    createVaultPolicy,
    deleteKvValue,
    deleteSigningKey,
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

export const createDomainDnsKeys = async (endpoint: string, token: string, domainName: string) => {
    domainName = toASCII(deAbsolute(domainName));

    return await Promise.all([
        createSigningKey(endpoint, token, `${domainName}-ksk`),
        createSigningKey(endpoint, token, `${domainName}-zsk`),
    ]);
};

export const deleteDomainDnsKeys = async (endpoint: string, token: string, domainName: string) => {
    domainName = toASCII(deAbsolute(domainName));

    await Promise.all([
        allowKeyDeletion(endpoint, token, `${domainName}-zsk`),
        allowKeyDeletion(endpoint, token, `${domainName}-ksk`),
    ]);
    return await Promise.all([
        deleteSigningKey(endpoint, token, `${domainName}-zsk`),
        deleteSigningKey(endpoint, token, `${domainName}-ksk`),
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

export const createPektinApiAccount = async (
    endpoint: string,
    token: string,
    password: string,
    apiUserName: string
) => {
    createFullUserPass(endpoint, token, apiUserName, password, {}, [`pektin-api`]);
};

export const createPektinAuthVaultPolicies = async (endpoint: string, token: string) => {
    const policyPairs = [{ name: `pektin-api`, policy: pektinApiPolicy }];

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

export const deletePektinSharedPassword = async (
    endpoint: string,
    token: string,
    type: `signer`,
    domainName: DomainName
) => {
    domainName = toASCII(deAbsolute(domainName));
    return await Promise.all([
        await deleteKvValue(endpoint, token, domainName, `pektin-${type}-passwords`),
        await deleteKvValue(endpoint, token, domainName, `pektin-${type}-passwords-1`),
        await deleteKvValue(endpoint, token, domainName, `pektin-${type}-passwords-2`),
    ]);
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
