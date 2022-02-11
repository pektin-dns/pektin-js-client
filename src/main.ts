import { PektinConfig } from "@pektin/config/src/config-types.js";

import {
    deleteRecords,
    duplicateZoneConversion,
    getPektinConfig,
    getPektinEndpoint,
    getAuth,
    getZoneRecords,
    health,
    search,
    set,
    ApiRecord,
    ClientName,
    ClientVaultAccountType,
    ConfidantPassword,
    DeleteResponseSuccess,
    GetZoneRecordsResponseSuccess,
    ManagerPassword,
    PektinClientConnectionConfigOverride,
    SearchResponseSuccess,
    SNSNameserver,
    ApiDeleteRequestRecord,
    PektinZoneData,
    absoluteName,
    checkConfidantPassword,
    checkManagerPassword,
    PektinRRType,
    DomainName,
    get,
} from "./index.js";
import { getVaultValue, vaultLoginUserpass } from "./vault/vault.js";

export class PektinClient {
    vaultEndpoint?: string;

    username: ClientName;

    confidantPassword?: ConfidantPassword;

    managerPassword?: ManagerPassword;

    recursorAuth?: string;
    proxyAuth?: string;

    throwErrors?: boolean;

    confidantToken: string | null;

    managerToken: string | null;

    pektinApiEndpoint: string | null;

    pektinConfig: PektinConfig | null;

    internal: boolean;

    constructor(connectionConfig: PektinClientConnectionConfigOverride, throwErrors?: boolean) {
        if (connectionConfig === undefined) throw Error(`Missing connectionConfig`);
        this.vaultEndpoint = connectionConfig.internal
            ? `http://pektin-vault`
            : connectionConfig.vaultEndpoint;
        this.username = connectionConfig.username;

        this.confidantPassword = checkConfidantPassword(connectionConfig.confidantPassword);

        this.managerPassword = checkManagerPassword(connectionConfig.managerPassword);

        this.confidantToken = null;
        this.managerToken = null;

        this.pektinApiEndpoint = connectionConfig.override?.pektinApiEndpoint || null;
        this.pektinConfig = connectionConfig.override?.pektinConfig || null;
        this.throwErrors = throwErrors;
        this.internal = connectionConfig.internal || false;
    }

    init = async () => {
        await this.getVaultToken(`confidant`);
        await this.getPektinConfig();
    };

    // gets the pektin config from vault
    getPektinConfig = async () => {
        if (!this.vaultEndpoint) {
            throw Error(
                `Tried to execute an action that requires the vault endpoint without it being supplied`
            );
        }
        if (!this.confidantToken) {
            await this.getVaultToken(`confidant`);
            if (!this.confidantToken) {
                throw Error(`Couldn't obtain vault token while getting config`);
            }
        }

        if (!this.pektinConfig) {
            this.pektinConfig = await getPektinConfig(this.vaultEndpoint, this.confidantToken);
        }

        if (!this.pektinApiEndpoint) {
            this.pektinApiEndpoint = getPektinEndpoint(this.pektinConfig, `api`, this.internal);
        }
        return this.pektinConfig;
    };

    // gets the auth info for the recursor
    getAuth = async (service: `recursor` | `proxy`, hashed = false) => {
        if (!this.vaultEndpoint) {
            throw Error(
                `Tried to execute an action that requires the vault endpoint without it being supplied`
            );
        }
        if (!this.confidantToken) {
            await this.getVaultToken(`confidant`);
            if (!this.confidantToken) {
                throw Error(`Couldn't obtain vault token while getting config`);
            }
        }
        const auth = await getAuth(this.vaultEndpoint, this.confidantToken, service, hashed);
        this[`${service}Auth`] = auth;
        return auth;
    };

    getPektinKv = async (key: string) => {
        if (!this.vaultEndpoint) {
            throw Error(
                `Tried to execute an action that requires the vault endpoint without it being supplied`
            );
        }
        if (!this.confidantToken) {
            await this.getVaultToken(`confidant`);
            if (!this.confidantToken) {
                throw Error(`Couldn't obtain vault token while getting config`);
            }
        }
        const res = await getVaultValue(this.vaultEndpoint, this.confidantToken, key, `pektin-kv`);
        if (!res) throw Error(`Couldnt obtain ${key}`);
        return res as Record<string, unknown>;
    };

    // obtain the vault token by sending username and password to the vault endpoint
    getVaultToken = async (clientType: ClientVaultAccountType) => {
        if (!this.vaultEndpoint) {
            throw Error(
                `Tried to execute an action that requires the vault endpoint without it being supplied`
            );
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }
        if (clientType === undefined) throw Error(`clientType cant be undefined`);
        if (clientType !== `manager` && clientType !== `confidant`) {
            throw Error(`clientType must be either 'manager' or 'confidant'`);
        }

        this[`${clientType}Token` as `confidantToken` | `managerToken`] = await vaultLoginUserpass({
            vaultEndpoint: this.vaultEndpoint,
            username: `pektin-client-${clientType}-${this.username}`,
            password: this.confidantPassword,
        });
    };

    // get records from the api/redis based on their key
    get = async (keys: string[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await get(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                keys,
            },
            throwErrors
        );
    };

    // get whether or not the pektin setup is healthy
    health = async (throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await health(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
            },
            throwErrors
        );
    };

    // set records via the api in redis
    set = async (records: ApiRecord[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await set(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                records,
            },
            throwErrors
        );
    };

    // search for records in redis by providing a glob search string
    search = async (glob: string, throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await search(
            this.pektinApiEndpoint,
            {
                /* @ts-ignore */
                confidantpassword: this.confidantPassword,
                client_username: this.username,
                glob,
            },
            throwErrors
        );
    };

    // delete records based on their keys
    deleteRecords = async (records: ApiDeleteRequestRecord[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await deleteRecords(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                records,
            },
            throwErrors
        );
    };

    // get all records for zones
    getZoneRecords = async (names: string[], throwErrors = this.throwErrors) => {
        if (!this.pektinApiEndpoint) {
            await this.getPektinConfig();
            if (!this.pektinApiEndpoint) {
                throw Error(`Couldn't obtain pektinApiEndpoint`);
            }
        }
        if (!this.confidantPassword) {
            throw Error(`Client cannot use this function because it requires a confidantPassword`);
        }

        return await getZoneRecords(
            this.pektinApiEndpoint,
            {
                confidant_password: this.confidantPassword,
                client_username: this.username,
                names: names.map(absoluteName),
            },
            throwErrors
        );
    };
    getPektinEndpoint = async (type: `api` | `vault` | `ui` | `recursor`) => {
        if (!this.pektinConfig) await this.getPektinConfig();
        if (!this.pektinConfig) throw Error(`Couldn't obtain pektin-config`);
        return getPektinEndpoint(this.pektinConfig, type, this.internal);
    };

    getDomains = async (): Promise<string[]> =>
        ((await this.search(`*.:SOA`, true)) as SearchResponseSuccess).data.map((name: string) =>
            name.replace(`:SOA`, ``)
        );

    // returns number of removed keys
    deleteZone = async (name: string): Promise<number> => {
        const records = (await this.getZoneRecords([name])) as GetZoneRecordsResponseSuccess;
        const tbd = records.data.flatMap((item) => {
            if (item.data) {
                return item.data.map((record) => ({
                    name: record.name,
                    rr_type: record.rr_type,
                }));
            }
            return [];
        });
        return ((await this.deleteRecords(tbd)) as DeleteResponseSuccess).data;
    };

    // fully setup a domain with soa record and nameservers
    setupDomain = async (domain: string, nameServers: SNSNameserver[]) => {
        await this.setupSOA(domain, nameServers[0]);
        return await Promise.all([
            this.setupNameServers(domain, nameServers),
            this.setupNameServerIps(nameServers),
        ]);
    };

    // setup a soa record
    setupSOA = async (domain: string, nameServer: SNSNameserver) => {
        const rr_set = [
            {
                ttl: 60,
                mname: absoluteName(nameServer.name),
                rname: absoluteName(`hostmaster.` + domain),
                serial: 0,
                refresh: 0,
                retry: 0,
                expire: 0,
                minimum: 0,
            },
        ];
        return await this.set([{ name: absoluteName(domain), rr_type: PektinRRType.SOA, rr_set }]);
    };

    setupNameServers = async (domain: string, nameServers: SNSNameserver[]) => {
        const subDomains = nameServers.map((ns) => ns.name);
        const rr_set = subDomains.map((subDomain) => ({
            ttl: 60,
            value: absoluteName(subDomain),
        }));
        return await this.set([{ name: absoluteName(domain), rr_type: PektinRRType.NS, rr_set }]);
    };

    setupNameServerIps = async (nameServers: SNSNameserver[]) => {
        const records: ApiRecord[] = [];
        nameServers.forEach((ns) => {
            if (ns.ips && ns.ips.length) {
                records.push({
                    name: absoluteName(ns.name),
                    rr_type: PektinRRType.AAAA,
                    rr_set: ns.ips.map((ip) => ({
                        ttl: 60,
                        value: ip,
                    })),
                });
            }
            if (ns.legacyIps && ns.legacyIps.length) {
                records.push({
                    name: absoluteName(ns.name),
                    rr_type: PektinRRType.A,
                    rr_set: ns.legacyIps.map((legacyIp) => ({
                        ttl: 60,
                        value: legacyIp,
                    })),
                });
            }
        });

        return await this.set(records);
    };
    // gets all records
    getEverything = async () => {
        const domains = await this.getDomains();
        if (!domains.length) return {};
        const records = await this.getZoneRecords(domains);
        const all: PektinZoneData = {};
        domains.forEach((domain, i) => {
            if (records?.data && records?.data[i]?.data) {
                all[domain] = records.data[i].data as ApiRecord[];
            }
        });

        return all;
    };

    // deletes everything on a pektin server
    deleteEverything = async () => {
        const all = await this.search(`*`);
        if (all.data === null) return false;
        const del = await this.deleteRecords(
            all.data.map((key) => {
                const [name, rr_type] = key.split(`:`) as [string, PektinRRType];
                return { name, rr_type };
            })
        );
        return del;
    };

    // takes records sorted by domain in the PektinZoneData format and sets them all on the server
    setPektinZoneData = async (data: PektinZoneData, deleteEverythingElse = false) => {
        if (deleteEverythingElse) {
            await this.deleteEverything();
        }
        const domains = Object.keys(data);
        let records: ApiRecord[] = [];
        domains.forEach((domain) => (records = records.concat(data[domain])));
        return await this.set(records);
    };
    // transfers all records from one pektin api/server to another one
    transferAll = async (
        foreignClient: PektinClient,
        direction: `foreignToLocal` | `localToForeign` = `foreignToLocal`,
        deleteEverything: boolean = false
    ) => {
        if (direction === `foreignToLocal`) {
            const all = await foreignClient.getEverything();
            const insert = await this.setPektinZoneData(all, deleteEverything);
            return insert;
        } else if (direction === `localToForeign`) {
            const all = await this.getEverything();
            const insert = await foreignClient.setPektinZoneData(all, deleteEverything);
            return insert;
        } else {
            throw Error(`Invalid direction`);
        }
    };
    // transfer specific zone from one pektin api/server to another one
    transferZone = async (
        foreignClient: PektinClient,
        domain: DomainName,
        direction: `foreignToLocal` | `localToForeign` = `foreignToLocal`
    ) => {
        if (direction === `foreignToLocal`) {
            const zone = await foreignClient.getZoneRecords([domain]);
            if (zone.type !== `success`) throw Error(`Could not get records`);
            const insert = await this.set(zone.data[0].data as ApiRecord[]);
            return insert;
        } else if (direction === `localToForeign`) {
            const zone = await this.getZoneRecords([domain]);
            if (zone.type !== `success`) throw Error(`Could not get records`);
            const insert = await foreignClient.set(zone.data[0].data as ApiRecord[]);
            return insert;
        } else {
            throw Error(`Invalid direction`);
        }
    };
    // gets a zone and duplicates it
    duplicateZone = async (
        zoneToDuplicate: DomainName,
        newZone: DomainName,
        replaceValues = false
    ) => {
        const zone = await this.getZoneRecords([zoneToDuplicate]);
        if (zone.type !== `success`) throw Error(`Could not get records`);
        const z = duplicateZoneConversion(
            zoneToDuplicate,
            newZone,
            zone.data[0].data as ApiRecord[],
            replaceValues
        );

        const insert = await this.set(z);
        return insert;
    };
    // replaces a name in an rrset
}

// TODO coloring only shows special characters in browser
