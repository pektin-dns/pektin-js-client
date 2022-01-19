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

export type PektinApiResponseBodyNoError =
    | SetResponseSuccess
    | GetResponseSuccess
    | SearchResponseSuccess
    | DeleteResponseSuccess
    | HealthResponseSuccess
    | GetZoneRecordsResponseSuccess;

export type PektinApiResponseBody =
    | SetResponse
    | GetResponse
    | SearchResponse
    | DeleteResponse
    | HealthResponse
    | GetZoneRecordsResponse;

export type SetResponse = SetResponseSuccess | SetResponseError;
export type GetResponse = GetResponseSuccess | GetResponseError;
export type SearchResponse = SearchResponseSuccess | SearchResponseError;
export type DeleteResponse = DeleteResponseSuccess | DeleteResponseError;
export type HealthResponse = HealthResponseSuccess | HealthResponseError;
export type GetZoneRecordsResponse = GetZoneRecordsResponseSuccess | GetZoneRecordsResponseError;

export interface PektinApiResponseBase {
    message: string;
    time: number;
}

// response success
export interface PektinApiResponseSuccessBase extends PektinApiResponseBase {
    error: false;
}

export interface SetResponseSuccess extends PektinApiResponseSuccessBase {
    data: null;
}

export interface GetResponseSuccess extends PektinApiResponseSuccessBase {
    data: RedisEntry[];
}
export interface SearchResponseSuccess extends PektinApiResponseSuccessBase {
    data: string[];
}
export interface DeleteResponseSuccess extends PektinApiResponseSuccessBase {
    data: { keys_removed: number };
}
export interface HealthResponseSuccess extends PektinApiResponseSuccessBase {}
export interface GetZoneRecordsResponseSuccess extends PektinApiResponseSuccessBase {
    data: { [domainName: DomainName]: RedisEntry[] };
}

// response errors
export interface PektinApiResponseErrorBase extends PektinApiResponseBase {
    error: true;
}
export interface SetResponseError extends PektinApiResponseErrorBase {
    data: string[];
}
export interface GetResponseError extends PektinApiResponseErrorBase {}
export interface SearchResponseError extends PektinApiResponseErrorBase {}
export interface DeleteResponseError extends PektinApiResponseErrorBase {}
export interface HealthResponseError extends PektinApiResponseErrorBase {}
export interface GetZoneRecordsResponseError extends PektinApiResponseErrorBase {}

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
    name: string;
    rr_set: PektinResourceRecord[];
}

// a resource record with a ttl and the rr value
export interface PektinResourceRecord {
    ttl: number;
    value: PektinResourceRecordValue;
}

type PektinRRTypes =
    | "A"
    | "AAAA"
    | "NS"
    | "CNAME"
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
    | SOA
    | MX
    | TXT
    | SRV
    | CAA
    | OPENPGPKEY
    | TLSA;

interface A {
    A: string;
}
interface AAAA {
    AAAA: string;
}
interface NS {
    NS: string;
}
interface CNAME {
    CNAME: string;
}

interface SOA {
    SOA: SOAValue;
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
    MX: MXValue;
}
interface MXValue {
    preference: number;
    exchange: string;
}
interface TXT {
    TXT: string;
}

interface SRV {
    SRV: SRVValue;
}
interface SRVValue {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

interface CAA {
    CAA: CAAValue;
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
    OPENPGPKEY: string;
}

interface TLSA {
    TLSA: TLSAValue;
}
interface TLSAValue {
    cert_usage: "CA" | "Service" | "TrustAnchor" | "DomainIssued";
    selector: "Full" | "Spki";
    matching: "Raw" | "Sha256" | "Sha512";
    cert_data: string;
}
