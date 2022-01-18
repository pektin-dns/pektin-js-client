export interface PektinOfficerMeta {
    [policy: string]: string;
}

export type RibstonPolicy = string; // A valid ribston policy

export type ClientName = string;
export type DomainName = string;
export type ManagerName = `pektin-client-manager-${ClientName}`;
export type ConfidantName = `pektin-client-confidant-${ClientName}`;
export type SignerName = `pektin-signer-${DomainName}`;
export type OfficerName = `pektin-officer-${ClientName}`;

export type ManagerPassword = `m.${string}`;
export type ConfidantPassword = `c.${string}`;

export type ClientVaultAccountType = "confidant" | "manager";

export interface PektinClientConnectionConfig {
    vaultEndpoint: string;
    username: string;
    confidantPassword?: ConfidantPassword;
    managerPassword?: ManagerPassword;
}

export interface PektinClientConnectionConfigOverride extends PektinClientConnectionConfig {
    override?: OverrideClientCredentials;
}

export interface OverrideClientCredentials {
    pektinApiEndpoint?: string;
    pektinConfig?: PektinConfig;
}

export interface PektinApiResponseBase {
    message: string;
}

export interface ApiErrorResponse extends PektinApiResponseBase {
    error: true;
}

export interface SetResponse extends PektinApiResponseBase {
    error: false;
    data: null;
}
export interface GetResponse extends PektinApiResponseBase {
    error: false;
    data: RedisEntry[];
}
export interface SearchResponse extends PektinApiResponseBase {
    error: false;
    data: string[];
}
export interface DeleteResponse extends PektinApiResponseBase {
    error: false;
    data: { keys_removed: number };
}
export interface HealthResponse extends PektinApiResponseBase {
    error: false;
}
export interface GetZoneRecordsResponse extends PektinApiResponseBase {
    error: false;
    data: { [domainName: DomainName]: RedisEntry[] };
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
    confidant_password: ConfidantPassword;
    client_username: ClientName;
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
    configureMainDomain: boolean;
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
    name: `${DomainName}:${PektinRRType}`;
    rr_set: PektinResourceRecord[];
}

// a resource record with a ttl and the rr value
export interface PektinResourceRecord {
    ttl: number;
    value: PektinResourceRecordValue;
}

enum PektinRRType {
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
}

// the resource record value
type PektinResourceRecordValue =
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

interface A {
    [type: PektinRRType.A]: string;
}
interface AAAA {
    [type: PektinRRType.AAAA]: string;
}
interface NS {
    [type: PektinRRType.NS]: string;
}
interface CNAME {
    [type: PektinRRType.CNAME]: string;
}

interface SOA {
    [type: PektinRRType.SOA]: SOAValue;
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
    [type: PektinRRType.MX]: MXValue;
}
interface MXValue {
    preference: number;
    exchange: string;
}
interface TXT {
    [type: PektinRRType.TXT]: string;
}

interface SRV {
    [type: PektinRRType.SRV]: SRVValue;
}
interface SRVValue {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

interface CAA {
    [type: PektinRRType.CAA]: CAAValue;
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
    [type: PektinRRType.OPENPGPKEY]: string;
}

interface TLSA {
    [type: PektinRRType.TLSA]: TLSAValue;
}
interface TLSAValue {
    cert_usage: "CA" | "Service" | "TrustAnchor" | "DomainIssued";
    selector: "Full" | "Spki";
    matching: "Raw" | "Sha256" | "Sha512";
    cert_data: string;
}
