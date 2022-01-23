import f from "cross-fetch";
import { VaultAuthJSON } from "../types";
import { colors } from "../colors.js";
import {
    VaultSecretEngineOptions,
    VaultAuthEngineType,
    IdentityEntityDataRequestBody,
    IdentityEntityAliasRequestBody,
    VaultPolicy
} from "./types";

export const getAuthMethods = async (endpoint: string, token: string) => {
    const res = await f(`${endpoint}/v1/sys/auth`, {
        method: "GET",
        headers: {
            "X-Vault-Token": token
        }
    }).catch(e => {
        throw Error(`${colors.boldRed}Couldn't fetch: ${colors.reset}` + e);
    });
    const json = await res.json().catch(e => {
        throw Error(`${colors.boldRed}Couldn't parse JSON response: ${colors.reset}` + e);
    });
    return json;
};

export const enableVaultCors = async (endpoint: string, token: string) => {
    return await f(`${endpoint}/v1/sys/config/cors`, {
        method: "PUT",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({
            allowed_origins: "*",
            allowed_headers: ["X-Vault-Token"]
        })
    });
};

export const createUserPassAccount = async (
    endpoint: string,
    token: string,
    name: string,
    enginePath: string,
    password: string,
    policies?: string[]
) => {
    const res = await f(`${endpoint}/v1/auth/${enginePath}users/${name}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ policies, password })
    });

    return res.status;
};

export const createEntity = async (
    endpoint: string,
    token: string,
    identityEntityData: IdentityEntityDataRequestBody
) => {
    const res = await f(`${endpoint}/v1/identity/entity`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify(identityEntityData)
    });
    try {
        return await res.json();
    } catch (error) {
        return res.status;
    }
};

export const getEntityByName = async (endpoint: string, token: string, entityName: string) => {
    const res = await f(`${endpoint}/v1/identity/entity/name/${entityName}`, {
        method: "GET",
        headers: {
            "X-Vault-Token": token
        }
    }).catch(e => {
        throw Error(`${colors.boldRed}Couldn't fetch: ${colors.reset}` + e);
    });
    const json = await res.json().catch(e => {
        throw Error(`${colors.boldRed}Couldn't parse JSON response: ${colors.reset}` + e);
    });
    return json?.data;
};

export const createEntityAlias = async (
    endpoint: string,
    token: string,
    identityEntityAliasData: IdentityEntityAliasRequestBody
) => {
    const res = await f(`${endpoint}/v1/identity/entity-alias`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify(identityEntityAliasData)
    });

    return res.status;
};

export const createAppRole = async (
    endpoint: string,
    token: string,
    name: string,
    policies: string[]
) => {
    // create role
    await f(`${endpoint}/v1/auth/approle/role/${name}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ policies })
    });
    // get role id
    const roleIdRes = await await f(`${endpoint}/v1/auth/approle/role/${name}/role-id`, {
        headers: {
            "X-Vault-Token": token
        }
    });
    const roleIdParsed = await roleIdRes.json();
    // get secret
    const secretIdRes = await f(`${endpoint}/v1/auth/approle/role/${name}/secret-id`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        }
    });
    const secretIdParsed = await secretIdRes.json();

    return { role_id: roleIdParsed.data.role_id, secret_id: secretIdParsed.data.secret_id };
};

export const enableSecretEngine = async (
    endpoint: string,
    token: string,
    enginePath: string,
    engineOptions: VaultSecretEngineOptions
) => {
    const vaultRes = await f(`${endpoint}/v1/sys/mounts/${enginePath}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify(engineOptions)
    });
    return vaultRes.status === 204;
};

export const enableAuthMethod = async (
    endpoint: string,
    token: string,
    type: VaultAuthEngineType,
    path: string = type
) => {
    const vaultRes = await f(`${endpoint}/v1/sys/auth/${path}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ type })
    });
    return vaultRes.status === 204;
};

export const createVaultPolicy = async (
    endpoint: string,
    token: string,
    policyName: string,
    policy: VaultPolicy
) => {
    const vaultRes = await f(`${endpoint}/v1/sys/policies/acl/${policyName}`, {
        method: "PUT",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ policy, name: policyName })
    });

    return vaultRes.status === 204;
};

export const unsealVault = async (vaultEndpoint: string, vaultKey: string) => {
    const vaultRes = await f(`${vaultEndpoint}/v1/sys/unseal`, {
        method: "PUT",
        body: JSON.stringify({ key: vaultKey })
    });
    return await vaultRes.json();
};

export const initVault = async (vaultEndpoint: string) => {
    const vaultRes = await f(`${vaultEndpoint}/v1/sys/init`, {
        method: "PUT",
        body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 })
    });
    const vaultTokens = await vaultRes.json();
    if (!vaultTokens || !vaultTokens.keys) {
        throw new Error(
            `${colors.boldRed}Error: Vault has already been initialized${colors.reset}`
        );
    }
    return { key: vaultTokens.keys[0], rootToken: vaultTokens.root_token };
};

// obtain the vault token by sending username and password to the vault endpoint
export const vaultLoginUserpass = async (auth: VaultAuthJSON): Promise<string> => {
    const res = await f(`${auth.vaultEndpoint}/v1/auth/userpass/login/${auth.username}`, {
        method: "POST",
        body: JSON.stringify({
            password: auth.password
        })
    }).catch(e => {
        throw Error(`${colors.boldRed}Couldn't fetch: ${colors.reset}` + e);
    });

    const json = await res.json().catch(e => {
        throw Error(`${colors.boldRed}Couldn't parse JSON response: ${colors.reset}` + e);
    });

    if (json.errors) {
        if (json.errors[0] === "Vault is sealed") {
            throw Error(
                `${colors.boldRed}Vault is sealed. ${colors.reset}${colors.bold}\n
You can unseal it here: ${auth.vaultEndpoint}/ui/vault/unseal
or with the clients unsealVault() function

For compose setups the key can be found in the in the pektin-compose/secrets/.env file in the V_KEY constant.
It looks like this: V_KEY="3ad0e26a9248a2ee6a07bc2c4a4d967589e74f02319d0f7ccb169918cd1e5b89" (copy without quotes)
${colors.reset}`
            );
        }
        throw Error(`${colors.boldRed}Couldn't obtain vault token: ${colors.reset}` + json.errors);
    }
    return json.auth.client_token;
};

// get value for a key from vault
export const getVaultValue = async (
    endpoint: string,
    token: string,
    key: string,
    kvEngine: string
) => {
    const res = await f(`${endpoint}/v1/${kvEngine}/data/${key}`, {
        headers: {
            "X-Vault-Token": token
        }
    }).catch(e => {
        throw Error("Couldn't fetch: " + e);
    });
    const json = await res.json().catch(e => {
        throw Error("Couldn't parse JSON response: " + e);
    });
    return json?.data?.data;
};

export const updateKvValue = async (
    endpoint: string,
    token: string,
    key: string,
    value: object,
    kvEngine: string
) => {
    await f(`${endpoint}/v1/${kvEngine}/metadata/${key}`, {
        method: "DELETE",
        headers: {
            "X-Vault-Token": token
        }
    });
    const res = await f(`${endpoint}/v1/${kvEngine}/data/${key}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ data: value })
    });

    try {
        return await res.json();
    } catch (error) {
        return res.status;
    }
};

export const createSigningKey = async (endpoint: string, token: string, domainName: string) => {
    await f(`${endpoint}/v1/pektin-transit/keys/${domainName}`, {
        method: "POST",
        headers: {
            "X-Vault-Token": token
        },
        body: JSON.stringify({ type: "ecdsa-p256" })
    });
};

// get keys for a domain with vault metadata
export const getPubVaultKeys = async (endpoint: string, token: string, domainName: string) => {
    const getPubKeyRes = await f(`${endpoint}/v1/pektin-transit/keys/${domainName}`, {
        method: "GET",
        headers: {
            "X-Vault-Token": token
        }
    });
    try {
        return (await getPubKeyRes.json()).data.keys;
    } catch (error) {
        return getPubKeyRes.status;
    }
};

export const healthCheck = async (endpoint: string, token: string) => {
    const res: any = await f(endpoint + `/v1/sys/health`, {
        headers: {
            "X-Vault-Token": token
        }
    }).catch(e => {
        e = e.toString();
        e = e.substring(e.indexOf(":") + 2);
        return { error: e };
    });
    if (res.error) return res;

    const resJson = await res.json().catch(() => {});
    return resJson;
};
