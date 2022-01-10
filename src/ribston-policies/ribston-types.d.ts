export interface PektinResourceRecord {
    ttl: number;
    value: PektinResourceRecordValue;
}

// the resource record value
export type PektinResourceRecordValue =
    | A
    | AAAA
    | NS
    | CNAME
    | SOA
    | MX
    | TXT
    | SRV
    | CAA
    | OPENPGPKEY
    | TLSA;

export interface A {
    [A: string]: string;
}
export interface AAAA {
    [AAAA: string]: string;
}
export interface NS {
    [NS: string]: string;
}
export interface CNAME {
    [CNAME: string]: string;
}

export interface SOA {
    [SOA: string]: SOAValue;
}
export interface SOAValue {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
}
export interface MX {
    [MX: string]: MXValue;
}
export interface MXValue {
    preference: number;
    exchange: string;
}
export interface TXT {
    [TXT: string]: string;
}

export interface SRV {
    [SRV: string]: SRVValue;
}
export interface SRVValue {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

export interface CAA {
    [CAA: string]: CAAValue;
}
export interface CAAValue {
    issuer_critical: boolean;
    tag: "Issue" | "IssueWild" | "Iodef";
    value: Issuer[] | Url;
}
export interface Issuer {
    key: string;
    value: string;
}
export type Url = `https://${string}` | `http://${string}` | `mailto:${string}`;

export interface OPENPGPKEY {
    [OPENPGPKEY: string]: string;
}

export interface TLSA {
    [TLSA: string]: TLSAValue;
}
export interface TLSAValue {
    cert_usage: number;
    selector: number;
    matching: number;
    cert_data: string;
}

export interface RedisEntry {
    name: string;
    rr_set: PektinRRset;
}

export type PektinRRset = Array<PektinResourceRecord>;

export interface RedisEntry {
    name: string;
    rr_set: PektinRRset;
}

export enum RequestType {
    Get = "get",
    GetZone = "get-zone",
    Delete = "delete",
    Set = "set",
    Search = "search",
    Health = "health"
}

export interface BaseInput {
    readonly ip: string;
    readonly utc_millis: number;
    readonly user_agent: string;
}

export interface GetInput extends BaseInput {
    readonly api_method: RequestType.Get;
    readonly request_body: {
        Get: {
            keys: string[];
        };
    };
}

export interface GetZoneInput extends BaseInput {
    readonly api_method: RequestType.GetZone;
    readonly request_body: {
        GetZone: {
            names: string[];
        };
    };
}

export interface DeleteInput extends BaseInput {
    readonly api_method: RequestType.Delete;
    readonly request_body: {
        Delete: {
            keys: string[];
        };
    };
}

export interface SetInput extends BaseInput {
    readonly api_method: RequestType.Set;
    readonly request_body: {
        Set: {
            records: RedisEntry[];
        };
    };
}

export interface SearchInput extends BaseInput {
    readonly api_method: RequestType.Search;
    readonly request_body: {
        Search: {
            glob: string;
        };
    };
}

export interface HealthInput extends BaseInput {
    readonly api_method: RequestType.Health;
    readonly request_body: {
        Health: {};
    };
}
