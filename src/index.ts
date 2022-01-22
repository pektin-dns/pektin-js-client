import {
    ApiRecord,
    ClientName,
    ClientVaultAccountType,
    ConfidantPassword,
    DeleteResponse,
    DeleteResponseSuccess,
    GetResponse,
    GetResponseSuccess,
    GetZoneRecordsResponse,
    GetZoneRecordsResponseSuccess,
    HealthResponse,
    HealthResponseSuccess,
    ManagerPassword,
    NameServer,
    PektinApiDeleteRequestBody,
    PektinApiGetRequestBody,
    PektinApiGetZoneRecordsRequestBody,
    PektinApiHealthRequestBody,
    PektinApiMethod,
    PektinApiRequestBody,
    PektinApiResponseBody,
    PektinApiResponseBodyReturnErrors,
    PektinApiSearchRequestBody,
    PektinApiSetRequestBody,
    PektinClientConnectionConfigOverride,
    PektinConfig,
    SearchResponse,
    SearchResponseSuccess,
    SetResponse,
    SetResponseSuccess
} from "./types";

import f from "cross-fetch";
import { vaultLoginUserpass, getVaultValue } from "./vault/vault.js";

export class BasicPektinClient {
    vaultEndpoint?: string;
    username: ClientName;
    confidantPassword?: ConfidantPassword;
    managerPassword?: ManagerPassword;
    recursorAuth?: string;
    throwErrors?: boolean;

    confidantToken: string | null;
    managerToken: string | null;

    pektinApiEndpoint: string | null;

    pektinConfig: PektinConfig | null;

    constructor(credentials: PektinClientConnectionConfigOverride, throwErrors?: boolean) {
        this.vaultEndpoint = credentials.vaultEndpoint;
        this.username = credentials.username;

        this.confidantPassword = checkConfidantPassword(credentials.confidantPassword);

        this.managerPassword = checkManagerPassword(credentials.managerPassword);

        this.confidantToken = null;
        this.managerToken = null;

        this.pektinApiEndpoint = credentials.override?.pektinApiEndpoint || null;
        this.pektinConfig = credentials.override?.pektinConfig || null;
        this.throwErrors = throwErrors;
    }

    init = async () => {
        await this.getVaultToken("confidant");
        await this.getPektinConfig();
    };

    // get the pektin config from vault
    getPektinConfig = async () => {
        if (!this.vaultEndpoint) {
            throw Error(
                "Tried to execute an action that requires the vault endpoint without it being supplied"
            );
        }
        if (!this.confidantToken) {
            await this.getVaultToken("confidant");
            if (!this.confidantToken) {
                throw Error("Couldn't obtain vault token while getting config");
            }
        }

        if (!this.pektinConfig) {
            this.pektinConfig = await getPektinConfig(this.vaultEndpoint, this.confidantToken);
        }

        if (!this.pektinApiEndpoint) {
            this.pektinApiEndpoint = getPektinApiEndpoint(this.pektinConfig);
        }
    };
    getRecursorAuth = async () => {
        if (!this.vaultEndpoint) {
            throw Error(
                "Tried to execute an action that requires the vault endpoint without it being supplied"
            );
        }
        if (!this.confidantToken) {
            await this.getVaultToken("confidant");
            if (!this.confidantToken) {
                throw Error("Couldn't obtain vault token while getting config");
            }
        }
        this.recursorAuth = await getRecursorAuth(this.vaultEndpoint, this.confidantToken);
    };

    // obtain the vault token by sending username and password to the vault endpoint
    getVaultToken = async (clientType: ClientVaultAccountType) => {
        if (!this.vaultEndpoint) {
            throw Error(
                "Tried to execute an action that requires the vault endpoint without it being supplied"
            );
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }
        if (clientType === undefined) throw Error("clientType cant be undefined");
        if (clientType !== "manager" && clientType !== "confidant") {
            throw Error("clientType must be either 'manager' or 'confidant'");
        }

        this[(clientType + "Token") as "confidantToken" | "managerToken"] =
            await vaultLoginUserpass({
                vaultEndpoint: this.vaultEndpoint,
                username: `pektin-client-${clientType}-${this.username}`,
                password: this.confidantPassword
            });
    };

    // get records from the api/redis based on their key
    get = async (keys: string[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await get(this.pektinApiEndpoint, {
            confidant_password: this.confidantPassword,
            client_username: this.username,
            keys
        });
    };

    // get whether or not the pektin setup is healthy
    health = async (throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await health(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username
            },
            throwErrors
        );
    };

    // set records via the api in redis
    set = async (records: ApiRecord[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await set(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                records
            },
            throwErrors
        );
    };

    // search for records in redis by providing a glob search string
    search = async (glob: string, throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await search(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                glob
            },
            throwErrors
        );
    };

    // delete records based on their keys
    deleteRecords = async (keys: string[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await deleteRecords(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                keys
            },
            throwErrors
        );
    };

    // get all records for zones
    getZoneRecords = async (names: string[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await getZoneRecords(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                names
            },
            throwErrors
        );
    };
}

export class ExtendedPektinApiClient extends BasicPektinClient {
    getDomains = async (): Promise<string[]> => {
        return ((await this.search("*.:SOA", true)) as SearchResponseSuccess).data.map(
            (name: string) => name.replace(":SOA", "")
        );
    };

    // returns number of removed keys
    deleteZone = async (name: string): Promise<number> => {
        const records = (await this.getZoneRecords([name])) as GetZoneRecordsResponseSuccess;
        const tbd = records.data[absoluteName(name)].map(entry => entry.name);
        return ((await this.deleteRecords(tbd)) as DeleteResponseSuccess).data.keys_removed;
    };

    // fully setup a domain with soa record and nameservers
    setupDomain = async (
        domain: string,
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        await this.setupSOA(domain, nameServers);
        return await Promise.all([
            this.setupNameServers(domain, nameServers),
            this.setupNameServerIps(nameServers)
        ]);
    };

    // fully setup the main domain specified in a d
    setupMainDomain = async (pektinConfig?: PektinConfig) => {
        if (pektinConfig === undefined) {
            if (!this.pektinConfig) {
                await this.getPektinConfig();
                if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
            }
            pektinConfig = this.pektinConfig;
        }
        await this.setupMainSOA(pektinConfig);
        return await Promise.all([
            this.setupMainNameServers(pektinConfig),
            this.setupMainNameServerIps(pektinConfig),
            this.setupPektinSubdomains(pektinConfig)
        ]);
    };

    // setup the pektin subdomains like vault.pektin.pektin.xyz and api.pektin.pektin.xyz
    setupPektinSubdomains = async (pektinConfig?: PektinConfig) => {
        if (pektinConfig === undefined) {
            if (!this.pektinConfig) {
                await this.getPektinConfig();
                if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
            }
            pektinConfig = this.pektinConfig;
        }
        const domains = [
            pektinConfig.uiSubDomain,
            pektinConfig.apiSubDomain,
            pektinConfig.vaultSubDomain,
            pektinConfig.recursorSubDomain
        ];
        const records = [] as ApiRecord[];

        domains.forEach((subDomain: string) => {
            if (pektinConfig?.nameServers[0].ips.length) {
                records.push({
                    name: absoluteName(subDomain + "." + pektinConfig?.domain),
                    rr_type: "AAAA",
                    rr_set: pektinConfig?.nameServers[0].ips.map(ip => {
                        return {
                            ttl: 60,
                            value: ip
                        };
                    })
                });
            }
            if (pektinConfig?.nameServers[0].legacyIps.length) {
                records.push({
                    name: absoluteName(subDomain + "." + pektinConfig?.domain),
                    rr_type: "A",
                    rr_set: pektinConfig?.nameServers[0].legacyIps.map(legacyIp => {
                        return {
                            ttl: 60,
                            value: legacyIp
                        };
                    })
                });
            }
        });

        if (!records.length) throw Error("No address set for primary nameserver");
        return await this.set(records);
    };

    setupMainSOA = async (pektinConfig?: PektinConfig) => {
        if (pektinConfig === undefined) {
            if (!this.pektinConfig) {
                await this.getPektinConfig();
                if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
            }
            pektinConfig = this.pektinConfig;
        }
        return await this.setupSOA(
            pektinConfig.domain,
            pektinConfig.nameServers.map((mns: NameServer) => {
                return {
                    domain: mns.subDomain + "." + pektinConfig?.domain,
                    ips: mns.ips,
                    legacyIps: mns.legacyIps
                };
            })
        );
    };

    setupSOA = async (
        domain: string,
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const mainSubdomain = nameServers.map(ns => ns.domain)[0];

        const rr_set = [
            {
                ttl: 60,
                mname: absoluteName(mainSubdomain),
                rname: absoluteName("hostmaster." + domain),
                serial: 0,
                refresh: 0,
                retry: 0,
                expire: 0,
                minimum: 0
            }
        ];
        return await this.set([{ name: absoluteName(domain), rr_type: "SOA", rr_set }]);
    };

    setupMainNameServers = async (pektinConfig?: PektinConfig) => {
        if (pektinConfig === undefined) {
            if (!this.pektinConfig) {
                await this.getPektinConfig();
                if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
            }
            pektinConfig = this.pektinConfig;
        }
        return await this.setupNameServers(
            pektinConfig.domain,
            pektinConfig.nameServers.map((mns: NameServer) => {
                return {
                    domain: mns.subDomain + "." + pektinConfig?.domain,
                    ips: mns.ips,
                    legacyIps: mns.legacyIps
                };
            })
        );
    };

    setupNameServers = async (
        domain: string,
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const subDomains = nameServers.map(ns => ns.domain);
        const rr_set = subDomains.map(subDomain => {
            return {
                ttl: 60,
                value: absoluteName(subDomain)
            };
        });
        return await this.set([{ name: absoluteName(domain), rr_type: "NS", rr_set }]);
    };

    setupMainNameServerIps = async (pektinConfig?: PektinConfig) => {
        if (pektinConfig === undefined) {
            if (!this.pektinConfig) {
                await this.getPektinConfig();
                if (!this.pektinConfig) throw Error("Failed to obtain pektinConfig");
            }
            pektinConfig = this.pektinConfig;
        }

        return await this.setupNameServerIps(
            pektinConfig.nameServers.map((mns: NameServer) => {
                return {
                    domain: mns.subDomain + "." + pektinConfig?.domain,
                    ips: mns.ips,
                    legacyIps: mns.legacyIps
                };
            })
        );
    };

    setupNameServerIps = async (
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const records: ApiRecord[] = [];
        nameServers.forEach(ns => {
            if (ns.ips && ns.ips.length) {
                records.push({
                    name: absoluteName(ns.domain),
                    rr_type: "AAAA",
                    rr_set: ns.ips.map(ip => {
                        return {
                            ttl: 60,
                            value: ip
                        };
                    })
                });
            }
            if (ns.legacyIps && ns.legacyIps.length) {
                records.push({
                    name: absoluteName(ns.domain),
                    rr_type: "A",
                    rr_set: ns.legacyIps.map(legacyIp => {
                        return {
                            ttl: 60,
                            value: legacyIp
                        };
                    })
                });
            }
        });

        return await this.set(records);
    };
}

// get the pektin api endpoint from  the pektin config
export const getPektinApiEndpoint = (pektinConfig: PektinConfig): string => {
    const protocol =
        pektinConfig.dev !== undefined && ["insecure-online", "local"].includes(pektinConfig.dev)
            ? "http://"
            : "https://";
    const endpoint =
        pektinConfig.dev !== undefined && ["insecure-online", "local"].includes(pektinConfig.dev)
            ? pektinConfig.dev === "local"
                ? "127.0.0.1:3001"
                : pektinConfig.insecureDevIp + ":3001"
            : pektinConfig.apiSubDomain + "." + pektinConfig.domain;
    return protocol + endpoint;
};

// get the pektin api endpoint from  the pektin config
export const getPektinRecursorEndpoint = (pektinConfig: PektinConfig): string => {
    const protocol =
        pektinConfig.dev !== undefined && ["insecure-online", "local"].includes(pektinConfig.dev)
            ? "http://"
            : "https://";
    const endpoint =
        pektinConfig.dev !== undefined && ["insecure-online", "local"].includes(pektinConfig.dev)
            ? pektinConfig.dev === "local"
                ? "127.0.0.1"
                : pektinConfig.insecureDevIp
            : pektinConfig.apiSubDomain + "." + pektinConfig.domain;
    return protocol + endpoint;
};

export const getRecursorAuth = async (vaultEndpoint: string, vaultToken: string) => {
    const res = await getVaultValue(vaultEndpoint, vaultToken, "recursor-auth", "pektin-kv");
    if (!res || !res.basicAuth) throw Error("Couldnt obtain recursor auth");
    return res.basicAuth as string;
};

export const absoluteName = (name: string) => {
    if (!name?.length) return "";
    name = name.replaceAll(/\s+/g, "");
    if (name[name.length - 1] !== ".") return name + ".";
    return name;
};

export const isAbsolute = (name: string): boolean => name[name.length - 1] === ".";

// get the pektin config
export const getPektinConfig = async (vaultEndpoint: string, vaultToken: string) => {
    return (await getVaultValue(
        vaultEndpoint,
        vaultToken,
        "pektin-config",
        "pektin-kv"
    )) as PektinConfig;
};

// get records from the api/redis based on their key
export const get = async (
    apiEndpoint: string,
    body: PektinApiGetRequestBody,
    throwErrors?: boolean
): Promise<GetResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "get", body, throwErrors);
    // TODO FIX TYPESCRIPT TYPES conditional types needed
    if (throwErrors) return res as GetResponseSuccess;
    return res as GetResponse;
};

// set records via the api in redis
export const set = async (
    apiEndpoint: string,
    body: PektinApiSetRequestBody,
    throwErrors?: boolean
): Promise<SetResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "set", body, throwErrors);
    if (throwErrors) return res as SetResponseSuccess;
    return res as SetResponse;
};

// search for records in redis by providing a glob search string
export const search = async (
    apiEndpoint: string,
    body: PektinApiSearchRequestBody,
    throwErrors?: boolean
): Promise<SearchResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "search", body, throwErrors);
    if (throwErrors) return res as SearchResponseSuccess;
    return res as SearchResponse;
};

// delete records based on their keys
export const deleteRecords = async (
    apiEndpoint: string,
    body: PektinApiDeleteRequestBody,
    throwErrors?: boolean
): Promise<DeleteResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "delete", body, throwErrors);
    if (throwErrors) return res as DeleteResponseSuccess;
    return res as DeleteResponse;
};

// get api health status
export const health = async (
    apiEndpoint: string,
    body: PektinApiHealthRequestBody,
    throwErrors?: boolean
): Promise<HealthResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "health", body, throwErrors);
    if (throwErrors) return res as HealthResponseSuccess;
    return res as HealthResponse;
};

// get all records for zones
export const getZoneRecords = async (
    apiEndpoint: string,
    body: PektinApiGetZoneRecordsRequestBody,
    throwErrors?: boolean
): Promise<GetZoneRecordsResponse> => {
    const res = await pektinApiRequest(apiEndpoint, "get-zone-records", body, throwErrors);
    if (throwErrors) return res as GetZoneRecordsResponseSuccess;
    return res as GetZoneRecordsResponse;
};

// send any request to the pektin api
export const pektinApiRequest = async (
    apiEndpoint: string,
    method: PektinApiMethod,
    body: PektinApiRequestBody,
    throwErrors = true
): Promise<PektinApiResponseBody> => {
    if (!apiEndpoint) throw Error("Pektin API details weren't obtained yet");
    const tStart = performance.now();
    const res = await f(`${apiEndpoint}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    }).catch(e => {
        throw Error("Couldn't fetch: " + e);
    });
    const tEnd = performance.now();
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
        json.time = tEnd - tStart;
    } catch (e) {
        throw Error(
            `Pektin client couldn't parse JSON response from API\nPektin-API returned body:\n${text}`
        );
    }
    if (json.error === true && throwErrors) {
        body.client_username = "<REDACTED>";
        if (body.confidant_password) body.confidant_password = "<REDACTED>" as ConfidantPassword;

        throw Error(
            `API Error:\n 
${JSON.stringify(json, null, "    ")}\n 
while trying to ${method}: \n
${JSON.stringify(body, null, "    ")}`
        );
    }
    if (throwErrors) return json as PektinApiResponseBodyReturnErrors;
    return json as PektinApiResponseBody;
};

export const deAbsolute = (domainName: string) => {
    const absDomain = absoluteName(domainName);
    return absDomain.substring(0, absDomain.length - 1);
};

export const checkConfidantPassword = (
    input: string | undefined
): ConfidantPassword | undefined => {
    if (input === undefined) return undefined;
    if (typeof input !== "string") throw Error("confidantPassword is not a string");

    if (input.startsWith("c.")) return input as ConfidantPassword;
    throw Error("Passed confidantPassword is not a confidant password");
};

export const checkManagerPassword = (input: string | undefined): ManagerPassword | undefined => {
    if (input === undefined) return undefined;

    if (typeof input !== "string") throw Error("managerPassword is not a string");
    if (input.startsWith("m.")) return input as ManagerPassword;
    throw Error("Passed managerPassword is not a manager password");
};

export const isSupportedRecordType = (type: string) => {
    if (supportedRecordTypes.indexOf(type) > -1) return true;
    return false;
};

export const supportedRecordTypes = [
    "A",
    "AAAA",
    "NS",
    "CNAME",
    "SOA",
    "MX",
    "TXT",
    "SRV",
    "CAA",
    "OPENPGPKEY",
    "TLSA"
];
