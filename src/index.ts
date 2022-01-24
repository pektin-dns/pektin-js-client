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
    PektinRRType,
    SearchResponse,
    SearchResponseSuccess,
    SetResponse,
    SetResponseSuccess
} from "./types.js";
import { PektinConfig } from "@pektin/config/src/types.js";

import f from "cross-fetch";
import { vaultLoginUserpass, getVaultValue } from "./vault/vault.js";
import { colors } from "./colors.js";

export class PektinClient {
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
            this.pektinApiEndpoint = getPektinEndpoint(this.pektinConfig, "api");
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
        nameServers: { name: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        await this.setupSOA(domain, nameServers[0]);
        return await Promise.all([
            this.setupNameServers(domain, nameServers),
            this.setupNameServerIps(nameServers)
        ]);
    };

    // setup a soa record
    setupSOA = async (
        domain: string,
        nameServer: { name: string; ips: string[]; legacyIps: string[] }
    ) => {
        const rr_set = [
            {
                ttl: 60,
                mname: absoluteName(nameServer.name),
                rname: absoluteName("hostmaster." + domain),
                serial: 0,
                refresh: 0,
                retry: 0,
                expire: 0,
                minimum: 0
            }
        ];
        return await this.set([{ name: absoluteName(domain), rr_type: PektinRRType.SOA, rr_set }]);
    };
    setupNameServers = async (
        domain: string,
        nameServers: { name: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const subDomains = nameServers.map(ns => ns.name);
        const rr_set = subDomains.map(subDomain => {
            return {
                ttl: 60,
                value: absoluteName(subDomain)
            };
        });
        return await this.set([{ name: absoluteName(domain), rr_type: PektinRRType.NS, rr_set }]);
    };
    setupNameServerIps = async (
        nameServers: { name: string; ips: string[]; legacyIps: string[] }[]
    ) => {
        const records: ApiRecord[] = [];
        nameServers.forEach(ns => {
            if (ns.ips && ns.ips.length) {
                records.push({
                    name: absoluteName(ns.name),
                    rr_type: PektinRRType.AAAA,
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
                    name: absoluteName(ns.name),
                    rr_type: PektinRRType.A,
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

export const concatDomain = (domain: string, subDomain?: string) => {
    if (subDomain === undefined) return domain;
    return subDomain + "." + domain;
};

export const getMainNode = (pektinConfig: PektinConfig) => {
    return pektinConfig.nodes.filter(node => node.main === true)[0];
};

export const defaultLocalPorts = {
    api: "3001",
    vault: "8200",
    ui: "8080",
    recursor: "80"
};

// get the pektin api endpoint from  the pektin config
export const getPektinEndpoint = (
    pektinConfig: PektinConfig,
    endpointType: "api" | "vault" | "ui" | "recursor",
    ports = defaultLocalPorts
): string => {
    const devmode = pektinConfig.devmode.enabled;
    const protocol = devmode ? "http://" : "https://";
    let endpoint = "";
    if (devmode) {
        if (pektinConfig.devmode.type === "local") {
            endpoint = `127.0.0.1:${ports[endpointType]}`;
        } else {
            const mainNode = getMainNode(pektinConfig);
            if (mainNode.ips?.length) {
                endpoint = `[${mainNode.ips[0]}]`;
            } else if (mainNode.legacyIps?.length) {
                endpoint = mainNode.legacyIps[0];
            } else {
                throw Error("Main node has no ips or legacy ips");
            }
        }
    } else {
        pektinConfig[endpointType].subDomain + "." + pektinConfig[endpointType].domain;
    }

    return protocol + endpoint;
};

export const getRecursorAuth = async (vaultEndpoint: string, vaultToken: string) => {
    const res = await getVaultValue(vaultEndpoint, vaultToken, "recursor-auth", "pektin-kv");
    if (!res || !res.basicAuth) throw Error("Couldnt obtain recursor auth");
    return res.basicAuth as string;
};

export const getNodesNameservers = (pektinConfig: PektinConfig, nodeName: string) => {
    if (!pektinConfig.nameservers) return false;
    return pektinConfig.nameservers.filter(ns => ns.node === nodeName);
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
    // TODO add coloring
    try {
        json = JSON.parse(text);
        json.time = tEnd - tStart;
    } catch (e) {
        body.client_username = "<REDACTED>";
        if (body.confidant_password) body.confidant_password = "<REDACTED>" as ConfidantPassword;
        throw Error(
            `${colors.boldRed}Pektin client couldn't parse JSON response from API${colors.reset}\n
Pektin-API returned this body:\n
${text}\n
while client was trying to ${method} the following body:\n 
${JSON.stringify(body, null, "    ")}${colors.reset}`
        );
    }
    if (json.error === true && throwErrors) {
        body.client_username = "<REDACTED>";
        if (body.confidant_password) body.confidant_password = "<REDACTED>" as ConfidantPassword;

        throw Error(
            `${colors.boldRed}API Error:${colors.reset}\n 
${JSON.stringify(json, null, "    ")}\n 
${colors.bold}while client was trying to ${method} the following body: ${colors.reset}\n
${JSON.stringify(body, null, "    ")}${colors.reset}`
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

// TODO coloring only shows special characters in browser

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
