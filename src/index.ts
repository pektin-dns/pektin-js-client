import {
    PektinApiDeleteRequestBody,
    PektinApiGetRequestBody,
    PektinApiGetZoneRecordsRequestBody,
    PektinApiMethod,
    PektinApiRequestBody,
    PektinApiSearchRequestBody,
    PektinApiSetRequestBody,
    PektinClientCredentials,
    PektinConfig,
    PektinRRset,
    RedisEntry,
    VaultAuthJSON
} from "./types";

const f = typeof window === "object" ? fetch : (await import("node-fetch")).default;

export class BasicPektinClient {
    vaultEndpoint: string;
    vaultUsername: string;
    vaultPassword: string;
    vaultToken: string | null;

    pektinApiEndpoint: string | null;
    pektinApiToken: string | null;

    pektinConfig: PektinConfig | null;

    constructor(credentials: PektinClientCredentials) {
        this.vaultEndpoint = credentials.vaultEndpoint;
        this.vaultUsername = credentials.username;
        this.vaultPassword = credentials.password;
        this.vaultToken = null;

        this.pektinApiEndpoint = null;
        this.pektinApiToken = null;
        this.pektinConfig = null;
    }

    init = async () => {
        await this.getVaultToken();
        await this.getPektinConfig();
        await this.getPektinApiToken();
    };

    // get the pektin config from vault
    getPektinConfig = async () => {
        if (!this.vaultToken) {
            await this.getVaultToken();
            if (!this.vaultToken) throw Error("Couldn't obtain vault token while getting config");
        }

        this.pektinConfig = await getPektinConfig(this.vaultEndpoint, this.vaultToken);
        this.pektinApiEndpoint = this.getPektinApiEndpoint(this.pektinConfig);
    };

    // get the pektin api endpoint from  the pektin config
    getPektinApiEndpoint = (pektinConfig: PektinConfig): string => {
        const protocol = ["insecure-online", "local"].includes(pektinConfig.dev)
            ? "http://"
            : "https://";
        return protocol + pektinConfig.apiSubDomain + "." + pektinConfig.domain;
    };

    // get whether or not the pektin setup is healthy
    health = async () => {};

    // obtain the vault token by sending username and password to the vault endpoint
    getVaultToken = async () => {
        this.vaultToken = await getVaultToken({
            vaultEndpoint: this.vaultEndpoint,
            username: this.vaultUsername,
            password: this.vaultPassword
        });
    };

    // get the pektin api token from vault
    getPektinApiToken = async () => {
        if (!this.vaultToken) {
            await this.getVaultToken();
            if (!this.vaultToken) {
                throw Error("Couldn't obtain vault token while getting pektin api token");
            }
        }
        this.pektinApiToken = await getPektinApiToken(this.vaultEndpoint, this.vaultToken);
    };

    // get records from the api/redis based on their key
    get = async (keys: string[]) => {
        if (!this.pektinApiEndpoint) {
            this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.pektinApiToken) {
            this.getPektinApiToken();
            if (!this.pektinApiToken) {
                throw Error("Couldn't obtain pektinApiToken");
            }
        }
        return await get(this.pektinApiEndpoint, { token: this.pektinApiToken, keys });
    };

    // set records via the api in redis
    set = async (records: RedisEntry[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.pektinApiToken) {
            await this.getPektinApiToken();
            if (!this.pektinApiToken) {
                throw Error("Couldn't obtain pektinApiToken");
            }
        }
        return await set(this.pektinApiEndpoint, { token: this.pektinApiToken, records });
    };

    // search for records in redis by providing a glob search string
    search = async (glob: string) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.pektinApiToken) {
            await this.getPektinApiToken();
            if (!this.pektinApiToken) {
                throw Error("Couldn't obtain pektinApiToken");
            }
        }
        return await search(this.pektinApiEndpoint, { token: this.pektinApiToken, glob });
    };

    // delete records based on their keys
    deleteRecords = async (keys: string[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.pektinApiToken) {
            await this.getPektinApiToken();
            if (!this.pektinApiToken) {
                throw Error("Couldn't obtain pektinApiToken");
            }
        }
        return await deleteRecords(this.pektinApiEndpoint, { token: this.pektinApiToken, keys });
    };

    // get all records for zones
    getZoneRecords = async (names: string[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.pektinApiToken) {
            await this.getPektinApiToken();
            if (!this.pektinApiToken) {
                throw Error("Couldn't obtain pektinApiToken");
            }
        }
        return await getZoneRecords(this.pektinApiEndpoint, { token: this.pektinApiToken, names });
    };
}

export class ExtendedPektinApiClient extends BasicPektinClient {
    getDomains = async () => {
        await this.search("*.:SOA");
    };

    setupMainSOA = async () => {
        if (!this.pektinConfig) {
            await this.getPektinConfig();
            if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
        }
        const domain = this.pektinConfig.domain;
        const mainSubdomain = this.pektinConfig.nameServers.map(
            ns => ns.subDomain + "." + domain
        )[0];

        const rr_set = [
            {
                ttl: 60,
                value: {
                    SOA: {
                        mname: absoluteName(mainSubdomain),
                        rname: absoluteName("hostmaster." + domain),
                        serial: 0,
                        refresh: 0,
                        retry: 0,
                        expire: 0,
                        minimum: 0
                    }
                }
            }
        ];
        await this.set([{ name: absoluteName(domain) + "SOA", rr_set }]);
    };

    setupMainNameServers = async () => {
        if (!this.pektinConfig) {
            await this.getPektinConfig();
            if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
        }
        const domain = this.pektinConfig.domain;
        const subDomains = this.pektinConfig.nameServers.map(ns => ns.subDomain + "." + domain);
        const rr_set: PektinRRset = subDomains.map(subDomain => {
            return {
                ttl: 60,
                value: { NS: absoluteName(subDomain) }
            };
        });
        await this.set([{ name: absoluteName(domain) + "NS", rr_set }]);
    };
    setupMainNameServerIps = async () => {
        if (!this.pektinConfig) {
            await this.getPektinConfig();
            if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
        }
        const domain = this.pektinConfig.domain;
        const records: RedisEntry[] = [];
        this.pektinConfig.nameServers.forEach(ns => {
            if (ns.ips && ns.ips.length) {
                records.push({
                    name: absoluteName(ns.subDomain + "." + domain) + ":AAAA",
                    rr_set: ns.ips.map(ip => {
                        return {
                            ttl: 60,
                            value: { AAAA: ip }
                        };
                    })
                });
            }
            if (ns.legacyIps && ns.legacyIps.length) {
                records.push({
                    name: absoluteName(ns.subDomain + "." + domain) + ":A",
                    rr_set: ns.legacyIps.map(legacyIp => {
                        return {
                            ttl: 60,
                            value: { A: legacyIp }
                        };
                    })
                });
            }
        });

        await this.set(records);
    };
}

export const absoluteName = (name: string) => {
    if (!name?.length) return "";
    name = name.replaceAll(/\s+/g, "");
    if (name[name.length - 1] !== ".") return name + ".";
    return name;
};

export const isAbsolute = (name: string): boolean => name[name.length - 1] === ".";

export const unsealVault = async (vaultEndpoint: string, vaultKey: string) => {
    const vaultRes = await f(`${vaultEndpoint}/v1/sys/unseal`, {
        method: "PUT",
        body: JSON.stringify({ key: vaultKey })
    });
    return await vaultRes.json();
};

// obtain the vault token by sending username and password to the vault endpoint
export const getVaultToken = async (auth: VaultAuthJSON): Promise<string> => {
    const res = await f(`${auth.vaultEndpoint}/v1/auth/userpass/login/${auth.username}`, {
        method: "POST",
        body: JSON.stringify({
            password: auth.password
        })
    }).catch(e => {
        throw Error("Couldn't fetch: " + e);
    });

    const json = await res.json().catch(e => {
        throw Error("Couldn't parse JSON response: " + e);
    });

    if (json.errors) {
        if (json.errors[0] === "Vault is sealed") {
            throw Error(
                `Vault is sealed
You can unseal it here: ${auth.vaultEndpoint}/ui/vault/unseal
or with the unsealVault() function

For compose setups the key can be found in the in the pektin-compose/secrets/.env file in the V_KEY constant.
It looks like  this: V_KEY="3ad0e26a9248a2ee6a07bc2c4a4d967589e74f02319d0f7ccb169918cd1e5b89"
                `
            );
        }
        throw Error("Couldn't obtain vault token: " + json.errors);
    }
    return json.auth.client_token;
};

// get the pektin config
export const getPektinConfig = async (vaultEndpoint: string, vaultToken: string) => {
    return (await getVaultValue({
        endpoint: vaultEndpoint,
        token: vaultToken,
        key: "pektin-config"
    })) as PektinConfig;
};

// get the basic pektin api token
export const getPektinApiToken = async (vaultEndpoint: string, vaultToken: string) => {
    return (
        await getVaultValue({
            endpoint: vaultEndpoint,
            token: vaultToken,
            key: "gss_token"
        })
    ).token;
};

// get the advanced pektin api token
export const getAdvancedPektinApiToken = async (vaultEndpoint: string, vaultToken: string) => {
    return (await getVaultValue({
        endpoint: vaultEndpoint,
        token: vaultToken,
        key: "gssr_token"
    })) as PektinConfig;
};

// get value for a key from vault
export const getVaultValue = async ({
    endpoint,
    token,
    key
}: {
    endpoint: string;
    token: string;
    key: string;
}) => {
    const res = await f(`${endpoint}/v1/pektin-kv/data/${key}`, {
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

// get records from the api/redis based on their key
export const get = async (apiEndpoint: string, body: PektinApiGetRequestBody) => {
    return await pektinApiRequest(apiEndpoint, "get", body);
};

// set records via the api in redis
export const set = async (apiEndpoint: string, body: PektinApiSetRequestBody) => {
    return await pektinApiRequest(apiEndpoint, "set", body);
};

// search for records in redis by providing a glob search string
export const search = async (apiEndpoint: string, body: PektinApiSearchRequestBody) => {
    return await pektinApiRequest(apiEndpoint, "search", body);
};

// delete records based on their keys
export const deleteRecords = async (apiEndpoint: string, body: PektinApiDeleteRequestBody) => {
    return await pektinApiRequest(apiEndpoint, "delete", body);
};

// get all records for zones
export const getZoneRecords = async (
    apiEndpoint: string,
    body: PektinApiGetZoneRecordsRequestBody
) => {
    return await pektinApiRequest(apiEndpoint, "get-zone-records", body);
};

// send any request to the pektin api
export const pektinApiRequest = async (
    apiEndpoint: string,
    method: PektinApiMethod,
    body: PektinApiRequestBody
) => {
    if (!apiEndpoint) throw Error("Pektin API details weren't obtained yet");

    const res = await f(`${apiEndpoint}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    }).catch(e => {
        throw Error("Couldn't fetch: " + e);
    });

    const json = await res.json().catch(e => {
        throw Error("Couldn't parse JSON response: " + e);
    });

    return json;
};
