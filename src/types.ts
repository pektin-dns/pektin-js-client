import { PektinConfig } from "@pektin/config/src/types";

export interface SNSNameserver {
    name: string;
    ips?: string[];
    legacyIps?: string[];
}

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
    data: ApiRecord[];
}
export interface SearchResponseSuccess extends PektinApiResponseSuccessBase {
    data: string[];
}
export interface DeleteResponseSuccess extends PektinApiResponseSuccessBase {
    data: { keys_removed: number };
}
export interface HealthResponseSuccess extends PektinApiResponseSuccessBase {}
export interface GetZoneRecordsResponseSuccess extends PektinApiResponseSuccessBase {
    data: { [domainName: DomainName]: ApiRecord[] };
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
    records: ApiRecord[];
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
    rr_type: PektinRRType.A;
    rr_set: ARecord[];
}

export interface ApiRecordAAAA extends ApiRecordBase {
    rr_type: PektinRRType.AAAA;
    rr_set: AAAARecord[];
}
export interface ApiRecordNS extends ApiRecordBase {
    rr_type: PektinRRType.NS;
    rr_set: NSRecord[];
}
export interface ApiRecordCNAME extends ApiRecordBase {
    rr_type: PektinRRType.CNAME;
    rr_set: CNAMERecord[];
}
export interface ApiRecordSOA extends ApiRecordBase {
    rr_type: PektinRRType.SOA;
    rr_set: SOARecord[];
}
export interface ApiRecordMX extends ApiRecordBase {
    rr_type: PektinRRType.MX;
    rr_set: MXRecord[];
}
export interface ApiRecordTXT extends ApiRecordBase {
    rr_type: PektinRRType.TXT;
    rr_set: TXTRecord[];
}
export interface ApiRecordSRV extends ApiRecordBase {
    rr_type: PektinRRType.SRV;
    rr_set: SRVRecord[];
}

export interface ApiRecordCAA extends ApiRecordBase {
    rr_type: PektinRRType.CAA;
    rr_set: CAARecord[];
}
export interface ApiRecordOPENPGPKEY extends ApiRecordBase {
    rr_type: PektinRRType.OPENPGPKEY;
    rr_set: OPENPGPKEYRecord[];
}
export interface ApiRecordTLSA extends ApiRecordBase {
    rr_type: PektinRRType.TLSA;
    rr_set: TLSARecord[];
}

export interface ResourceRecordBase {
    ttl: number;
}

export type ResourceRecord =
    | ARecord
    | AAAARecord
    | NSRecord
    | CNAMERecord
    | SOARecord
    | OPENPGPKEYRecord
    | TXTRecord
    | MXRecord
    | SRVRecord
    | CAARecord
    | TLSARecord;

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

export type CAARecord = CAARecordIssue | CAARecordIodef;

export interface CAARecordIssue extends ResourceRecordBase {
    issuer_critical: boolean;
    tag: "issue" | "issuewild";
    value: DomainName;
}

export interface CAARecordIodef extends ResourceRecordBase {
    issuer_critical: boolean;
    tag: "iodef";
    value: `https://${string}` | `http://${string}` | `mailto:${string}`;
}

export interface TLSARecord extends ResourceRecordBase {
    cert_usage: 0 | 1 | 2 | 3;
    selector: 0 | 1;
    matching: 0 | 1 | 2;
    cert_data: string;
}

export enum PektinRRType {
    A = "A",
    AAAA = "AAAA",
    NS = "NS",
    CNAME = "CNAME",
    SOA = "SOA",
    MX = "MX",
    TXT = "TXT",
    SRV = "SRV",
    CAA = "CAA",
    OPENPGPKEY = "OPENPGPKEY",
    TLSA = "TLSA"
}
