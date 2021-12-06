import { absoluteName } from "./index.js";
import {
    createEntity,
    createEntityAlias,
    createUserPassAccount,
    getAuthMethods,
    getEntityByName
} from "./vault/vault.js";

export const createPektinSigner = async (
    endpoint: string,
    token: string,
    domainName: string,
    password: string
) => {
    const absDomain = absoluteName(domainName);
    const name = `pektin-signer-${absDomain.substring(0, absDomain.length - 1)}`;

    const entityResponse = await createEntity(endpoint, token, {
        name,
        metadata: { domain: absDomain.substring(0, absDomain.length - 1) },
        policies: ["pektin-signer"]
    });

    const entity =
        entityResponse?.data?.id === undefined
            ? await getEntityByName(endpoint, token, name)
            : entityResponse?.data;

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

    // check if userpass is present if not create it
    // check if transit is present if not create it
    // check if signer policy is present

    /*
    path "pektin-transit/sign/{{identity.entity.metadata.domain}}/sha2-256" {
        capabilities = ["update"]
    }
    */
};

export const createPektinOfficer = async (endpoint: string, token: string) => {};

export const createPektinClient = async (endpoint: string, token: string) => {};

export const createPektinApiAccount = async (endpoint: string, token: string) => {};
