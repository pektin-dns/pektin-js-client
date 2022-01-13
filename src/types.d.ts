export interface PektinOfficerMeta {
    [policy: string]: string;
}

export type RibstonPolicy = string; // A valid ribston policy

export interface PektinClientCredentials {
    vaultEndpoint: string;
    username: string;
    confidantPassword?: string;
    managerPassword?: string;
    override?: OverrideClientCredentials;
}
export interface OverrideClientCredentials {
    pektinApiEndpoint?: string;
    pektinConfig?: PektinConfig;
}

export type PektinApiMethod = "get" | "set" | "search" | "delete" | "get-zone-records" | "health";

export type PektinApiRequestBody =
    | PektinApiGetRequestBody
    | PektinApiSetRequestBody
    | PektinApiSearchRequestBody
    | PektinApiDeleteRequestBody
    | PektinApiGetZoneRecordsRequestBody
    | PektinApiHealthRequestBody;

export interface PektinApiRequestBodyBase {
    confidant_password: string;
    client_username: string;
}

export interface PektinApiGetRequestBody extends PektinApiRequestBodyBase {
    keys: string[];
}
export interface PektinApiSetRequestBody extends PektinApiRequestBodyBase {
    records: RedisEntry[];
}
export interface PektinApiSearchRequestBody extends PektinApiRequestBodyBase {
    glob: string;
}
export interface PektinApiDeleteRequestBody extends PektinApiRequestBodyBase {
    keys: string[];
}
export interface PektinApiGetZoneRecordsRequestBody extends PektinApiRequestBodyBase {
    names: string[];
}
export interface PektinApiHealthRequestBody extends PektinApiRequestBodyBase {}

export interface PektinConfig {
    domain: string;
    nameServers: NameServer[];
    multiNode: boolean;
    uiSubDomain: string;
    apiSubDomain: string;
    vaultSubDomain: string;
    recursorSubDomain: string;
    enableUi: boolean;
    enableApi: boolean;
    enableRecursor: boolean;
    enableRotate: boolean;
    createCerts: boolean;
    letsencryptEmail: string;
    autoConfigureMainDomain: boolean;
    proxyConfig: string;
    createProxy: boolean;
    buildFromSource: boolean;
    sources: {
        server: string;
        api: string;
        ui: string;
    };
    dev?: "local" | "insecure-online";
    insecureDevIp: string;
}

export interface NameServer {
    subDomain: string;
    ips: string[];
    legacyIps: string[];
    createSingleScript?: CreateSingleScript;
}
export interface CreateSingleScript {
    system: ComposeSupportedOS;
    cloneRepo: boolean;
    setup: boolean;
    start: boolean;
    root: SingleScriptRootOptions;
}
export interface SingleScriptRootOptions {
    disableSystemdResolved: boolean;
    installDocker: boolean;
}

export type ComposeSupportedOS = "ubuntu" | "arch";

export interface VaultAuthJSON {
    vaultEndpoint: string;
    username: string;
    password: string;
}
export interface RedisEntry {
    name: string;
    rr_set: PektinRRset;
}

export type PektinRRset = Array<PektinResourceRecord>;

// a resource record with a ttl and the rr value
export interface PektinResourceRecord {
    ttl: number;
    value: PektinResourceRecordValue;
}

type PektinRRTypes =
    | "NEW"
    | "A"
    | "AAAA"
    | "NS"
    | "CNAME"
    | "PTR"
    | "SOA"
    | "MX"
    | "TXT"
    | "SRV"
    | "CAA"
    | "OPENPGPKEY"
    | "TLSA";

// the resource record value
type PektinResourceRecordValue =
    | A
    | AAAA
    | NS
    | CNAME
    | PTR
    | SOA
    | MX
    | TXT
    | SRV
    | CAA
    | OPENPGPKEY
    | TLSA;

interface A {
    [A: string]: string;
}
interface AAAA {
    [AAAA: string]: string;
}
interface NS {
    [NS: string]: string;
}
interface CNAME {
    [CNAME: string]: string;
}
interface PTR {
    [PTR: string]: string;
}
interface SOA {
    [SOA: string]: SOAValue;
}
interface SOAValue {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
}
interface MX {
    [MX: string]: MXValue;
}
interface MXValue {
    preference: number;
    exchange: string;
}
interface TXT {
    [TXT: string]: TXTValue;
}
interface TXTValue {
    txt_data: Array<Array<number>>;
}

interface SRV {
    [SRV: string]: SRVValue;
}
interface SRVValue {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

interface CAA {
    [CAA: string]: CAAValue;
}
interface CAAValue {
    issuer_critical: boolean;
    tag: "Issue" | "IssueWild" | "Iodef";
    value: Issuer[] | Url;
}
interface Issuer {
    key: string;
    value: string;
}
type Url = `https://${string}` | `http://${string}` | `mailto:${string}`;

interface OPENPGPKEY {
    [OPENPGPKEY: string]: OPENPGPKEYValue;
}

interface OPENPGPKEYValue {
    [public_key: string]: Array<number>;
}
interface TLSA {
    [TLSA: string]: TLSAValue;
}
interface TLSAValue {
    cert_usage: "CA" | "Service" | "TrustAnchor" | "DomainIssued";
    selector: "Full" | "Spki";
    matching: "Raw" | "Sha256" | "Sha512";
    cert_data: string;
}
