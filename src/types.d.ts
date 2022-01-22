export interface ClientCapabilities {
    ribstonPolicy: string;
    allowedSigningDomains?: string[];
    allowAllSigningDomains?: boolean;
    recursorAccess?: boolean;
    configAccess?: boolean;
}

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
    vaultEndpoint?: string;
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

export type PektinApiResponseBodyReturnErrors =
    | SetResponseSuccess
    | GetResponseSuccess
    | SearchResponseSuccess
    | DeleteResponseSuccess
    | HealthResponseSuccess
    | GetZoneRecordsResponseSuccess;

export type PektinApiResponseBodyError =
    | SetResponseError
    | GetResponseError
    | SearchResponseError
    | DeleteResponseError
    | HealthResponseError
    | GetZoneRecordsResponseError;

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
    data: Array<string | null>;
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

export type ApiRecord =
    | ApiRecordA
    | ApiRecordAAAA
    | ApiRecordNS
    | ApiRecordCNAME
    | ApiRecordSOA
    | ApiRecordMX
    | ApiRecordTXT
    | ApiRecordSRV
    | ApiRecordCAA
    | ApiRecordOPENPGPKEY
    | ApiRecordTLSA;

export interface ApiRecordBase {
    name: string;
}
export interface ApiRecordA extends ApiRecordBase {
    rr_type: "A";
    rr_set: ARecord[];
}

export interface ApiRecordAAAA extends ApiRecordBase {
    rr_type: "AAAA";
    rr_set: AAAARecord[];
}
export interface ApiRecordNS extends ApiRecordBase {
    rr_type: "NS";
    rr_set: NSRecord[];
}
export interface ApiRecordCNAME extends ApiRecordBase {
    rr_type: "CNAME";
    rr_set: CNAMERecord[];
}
export interface ApiRecordSOA extends ApiRecordBase {
    rr_type: "SOA";
    rr_set: SOARecord[];
}
export interface ApiRecordMX extends ApiRecordBase {
    rr_type: "MX";
    rr_set: MXRecord[];
}
export interface ApiRecordTXT extends ApiRecordBase {
    rr_type: "TXT";
    rr_set: TXTRecord[];
}
export interface ApiRecordSRV extends ApiRecordBase {
    rr_type: "SRV";
    rr_set: SRVRecord[];
}
export interface ApiRecordSOA extends ApiRecordBase {
    rr_type: "SOA";
    rr_set: SOARecord[];
}
export interface ApiRecordCAA extends ApiRecordBase {
    rr_type: "CAA";
    rr_set: CAARecord[];
}
export interface ApiRecordOPENPGPKEY extends ApiRecordBase {
    rr_type: "OPENPGPKEY";
    rr_set: OPENPGPKEYRecord[];
}
export interface ApiRecordTLSA extends ApiRecordBase {
    rr_type: "TLSA";
    rr_set: TLSARecord[];
}

export interface ResourceRecordBase {
    ttl: number;
}

export interface A extends ResourceRecordBase {
    value: string;
}
export interface ARecord extends ResourceRecordBase {
    value: string;
}
export interface AAAARecord extends ResourceRecordBase {
    value: string;
}
export interface NSRecord extends ResourceRecordBase {
    value: string;
}
export interface CNAMERecord extends ResourceRecordBase {
    value: string;
}
export interface SOARecord extends ResourceRecordBase {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
}

export interface OPENPGPKEYRecord extends ResourceRecordBase {
    value: string;
}
export interface TXTRecord extends ResourceRecordBase {
    value: string;
}

export interface MXRecord extends ResourceRecordBase {
    preference: number;
    exchange: string;
}

export interface SRVRecord extends ResourceRecordBase {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

export interface CAARecord extends ResourceRecordBase {
    flag: number; //0;
    tag: "issue" | "issuewild" | "iodef"; //"issue" | "issuewild" | "iodef" | "contactemail" | "contactphone";
    caaValue: string;
}

export interface TLSARecord extends ResourceRecordBase {
    usage: 0 | 1 | 2 | 3;
    selector: 0 | 1;
    matching_type: 0 | 1 | 2;
    data: string;
}

type PektinRRType =
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
