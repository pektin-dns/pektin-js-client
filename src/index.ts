import {
    NameServer,
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
    RedisEntry
} from "./types";

import f from "cross-fetch";
import { vaultLoginUserpass, getVaultValue } from "./vault/vault.js";

export class BasicPektinClient {
    vaultEndpoint: string;
    username: string;
    confidantPassword?: string;
    managerPassword?: string;

    confidantToken: string | null;
    managerToken: string | null;

    pektinApiEndpoint: string | null;

    pektinConfig: PektinConfig | null;

    constructor(credentials: PektinClientCredentials) {
        this.vaultEndpoint = credentials.vaultEndpoint;
        this.username = credentials.username;
        this.confidantPassword = credentials.confidantPassword;
        this.managerPassword = credentials.managerPassword;
        this.confidantToken = null;
        this.managerToken = null;

        this.pektinApiEndpoint = credentials.override?.pektinApiEndpoint || null;
        this.pektinConfig = credentials.override?.pektinConfig || null;
    }

    init = async () => {
        await this.getVaultToken();
        await this.getPektinConfig();
    };

    // get the pektin config from vault
    getPektinConfig = async () => {
        if (!this.confidantToken) {
            await this.getVaultToken();
            if (!this.confidantToken)
                throw Error("Couldn't obtain vault token while getting config");
        }

        if (!this.pektinConfig) {
            this.pektinConfig = await getPektinConfig(this.vaultEndpoint, this.confidantToken);
        }

        if (!this.pektinApiEndpoint) {
            this.pektinApiEndpoint = getPektinApiEndpoint(this.pektinConfig);
        }
    };

    // get whether or not the pektin setup is healthy
    health = async () => {};

    // obtain the vault token by sending username and password to the vault endpoint
    getVaultToken = async () => {
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }
        this.confidantToken = await vaultLoginUserpass({
            vaultEndpoint: this.vaultEndpoint,
            username: this.username,
            password: this.confidantPassword
        });
    };

    // get records from the api/redis based on their key
    get = async (keys: string[]) => {
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

    // set records via the api in redis
    set = async (records: RedisEntry[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await set(this.pektinApiEndpoint, {
            confidant_password: this.confidantPassword,
            client_username: this.username,
            records
        });
    };

    // search for records in redis by providing a glob search string
    search = async (glob: string) => {
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

        return await search(this.pektinApiEndpoint, {
            confidant_password: this.confidantPassword,
            client_username: this.username,
            glob
        });
    };

    // delete records based on their keys
    deleteRecords = async (keys: string[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await deleteRecords(this.pektinApiEndpoint, {
            confidant_password: this.confidantPassword,
            client_username: this.username,
            keys
        });
    };

    // get all records for zones
    getZoneRecords = async (names: string[]) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error("Couldn't obtain pektinApiEndpoint");
            }
        }
        if (!this.confidantPassword) {
            throw Error("Client cannot use this function because it requires a confidantPassword");
        }

        return await getZoneRecords(this.pektinApiEndpoint, {
            confidant_password: this.confidantPassword,
            client_username: this.username,
            names
        });
    };
}

export class ExtendedPektinApiClient extends BasicPektinClient {
    getDomains = async (): Promise<string[]> => {
        return (await this.search("*.:SOA")).data.map((name: string) => name.replace(":SOA", ""));
    };

    // returns number of removed keys
    deleteZone = async (name: string): Promise<number> => {
        const records = await this.getZoneRecords([name]);
        const tbd = records.data[absoluteName(name)];
        return (await this.deleteRecords(tbd)).data.keys_removed;
    };

    // fully setup a domain with soa record and nameservers
    setupDomain = async (
        domain: string,
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        await this.setupSOA(domain, nameServers);
        return await Promise.all([
            this.setupNameServers(domain, nameServers),
            this.setupNameServerIps(domain, nameServers)
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
        const records = [] as RedisEntry[];

        domains.forEach((subDomain: string) => {
            if (pektinConfig?.nameServers[0].ips.length) {
                records.push({
                    name: absoluteName(subDomain + "." + pektinConfig?.domain) + ":AAAA",
                    rr_set: pektinConfig?.nameServers[0].ips.map(ip => {
                        return {
                            ttl: 60,
                            value: { AAAA: ip }
                        };
                    })
                });
            }
            if (pektinConfig?.nameServers[0].legacyIps.length) {
                records.push({
                    name: absoluteName(subDomain + "." + pektinConfig?.domain) + ":A",
                    rr_set: pektinConfig?.nameServers[0].legacyIps.map(legacyIp => {
                        return {
                            ttl: 60,
                            value: { A: legacyIp }
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
        return await this.set([{ name: absoluteName(domain) + ":SOA", rr_set }]);
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
        const rr_set: PektinRRset = subDomains.map(subDomain => {
            return {
                ttl: 60,
                value: { NS: absoluteName(subDomain) }
            };
        });
        return await this.set([{ name: absoluteName(domain) + ":NS", rr_set }]);
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

    setupNameServerIps = async (
        domain: string,
        nameServers: { domain: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const records: RedisEntry[] = [];
        nameServers.forEach(ns => {
            if (ns.ips && ns.ips.length) {
                records.push({
                    name: absoluteName(ns.domain) + ":AAAA",
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
                    name: absoluteName(ns.domain) + ":A",
                    rr_set: ns.legacyIps.map(legacyIp => {
                        return {
                            ttl: 60,
                            value: { A: legacyIp }
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
    if (json.error === true) {
        throw Error(
            "API Error: " +
                JSON.stringify(json, null, "    ") +
                "\n while trying to set: \n" +
                JSON.stringify(body, null, "    ")
        );
    }

    return json;
};

export const deAbsolute = (domainName: string) => {
    const absDomain = absoluteName(domainName);
    return absDomain.substring(0, absDomain.length - 1);
};
