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

export type ApiResponseBodyThrowErrors =
    | GetResponseSuccess
    | GetZoneRecordsResponseSuccess
    | SetResponseSuccess
    | DeleteResponseSuccess
    | SearchResponseSuccess
    | HealthResponseSuccess;

export type ApiResponseBodyError =
    | SetResponseError
    | DeleteResponseError
    | UnauthorizedError
    | InternalServerError;

export type ApiResponseBodyReturnErrors =
    | GetResponse
    | GetZoneRecordsResponse
    | SetResponse
    | DeleteResponse
    | SearchResponse
    | HealthResponse;

export type GetResponse = GetResponseSuccess | UnauthorizedError | InternalServerError;
export type GetZoneRecordsResponse =
    | GetZoneRecordsResponseSuccess
    | UnauthorizedError
    | InternalServerError;
export type SetResponse =
    | SetResponseSuccess
    | SetResponseError
    | UnauthorizedError
    | InternalServerError;
export type DeleteResponse =
    | DeleteResponseSuccess
    | DeleteResponseError
    | UnauthorizedError
    | InternalServerError;
export type SearchResponse = SearchResponseSuccess | UnauthorizedError | InternalServerError;
export type HealthResponse = HealthResponseSuccess | UnauthorizedError | InternalServerError;

export interface UnauthorizedError extends ApiResponseErrorBase {
    data?: null;
}
export interface InternalServerError extends ApiResponseErrorBase {
    data?: null;
}

export interface ApiResponseBase {
    message: string;
    time: number;
    type: ApiResponseType;
}

export type ApiResponseType = "success" | "error" | "ignored";
// response success
export interface ApiResponseSuccessBase extends ApiResponseBase {
    type: "success";
}

export interface GetResponseSuccessItem extends ApiResponseBase {
    data: ApiRecord | null;
}
export interface GetResponseSuccess extends ApiResponseSuccessBase {
    data: GetResponseSuccessItem[];
}

export interface GetZoneRecordsResponseSuccessItem extends ApiResponseBase {
    data: ApiRecord[] | null;
}
export interface GetZoneRecordsResponseSuccess extends ApiResponseSuccessBase {
    data: GetZoneRecordsResponseSuccessItem[];
}

export interface SetResponseSuccess extends ApiResponseSuccessBase {
    data: ApiResponseSuccessBase[];
}

export interface DeleteResponseSuccess extends ApiResponseSuccessBase {
    data: number;
}

export interface SearchResponseSuccess extends ApiResponseSuccessBase {
    data: string[];
}

export interface HealthResponseSuccessData {
    api: boolean;
    db: boolean;
    vault: number;
    ribston: number;
    all: boolean;
}
export interface HealthResponseSuccess extends ApiResponseSuccessBase {
    data: HealthResponseSuccessData;
}

// response errors
export interface ApiResponseErrorBase extends ApiResponseBase {
    type: "error";
}

export interface SetResponseErrorItem extends ApiResponseBase {
    type: "error" | "ignored";
}
export interface SetResponseError extends ApiResponseErrorBase {
    data: SetResponseErrorItem[];
}

export interface DeleteResponseErrorItem extends ApiResponseBase {
    type: "error" | "ignored";
}
export interface DeleteResponseError extends ApiResponseErrorBase {
    data: DeleteResponseErrorItem[];
}

export type ApiMethod = "get" | "set" | "search" | "delete" | "get-zone-records" | "health";

export type ApiRequestBody =
    | ApiGetRequestBody
    | ApiSetRequestBody
    | ApiSearchRequestBody
    | ApiDeleteRequestBody
    | ApiGetZoneRecordsRequestBody
    | ApiHealthRequestBody;

export interface ApiRequestBodyBase {
    confidant_password: ConfidantPassword;
    client_username: ClientName;
}

export interface ApiGetRequestBody extends ApiRequestBodyBase {
    keys: string[];
}
export interface ApiSetRequestBody extends ApiRequestBodyBase {
    records: ApiRecord[];
}
export interface ApiSearchRequestBody extends ApiRequestBodyBase {
    glob: string;
}
export interface ApiDeleteRequestRecord {
    name: string;
    rr_type: PektinRRType;
}
export interface ApiDeleteRequestBody extends ApiRequestBodyBase {
    records: ApiDeleteRequestRecord[];
}
export interface ApiGetZoneRecordsRequestBody extends ApiRequestBodyBase {
    names: string[];
}
export interface ApiHealthRequestBody extends ApiRequestBodyBase {}

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
export interface ApiRecordCAA extends ApiRecordBase {
    rr_type: PektinRRType.CAA;
    rr_set: CAARecord[];
}
export interface ApiRecordCNAME extends ApiRecordBase {
    rr_type: PektinRRType.CNAME;
    rr_set: CNAMERecord[];
}
export interface ApiRecordMX extends ApiRecordBase {
    rr_type: PektinRRType.MX;
    rr_set: MXRecord[];
}
export interface ApiRecordNS extends ApiRecordBase {
    rr_type: PektinRRType.NS;
    rr_set: NSRecord[];
}
export interface ApiRecordOPENPGPKEY extends ApiRecordBase {
    rr_type: PektinRRType.OPENPGPKEY;
    rr_set: OPENPGPKEYRecord[];
}
export interface ApiRecordSOA extends ApiRecordBase {
    rr_type: PektinRRType.SOA;
    rr_set: SOARecord[];
}
export interface ApiRecordSRV extends ApiRecordBase {
    rr_type: PektinRRType.SRV;
    rr_set: SRVRecord[];
}
export interface ApiRecordTLSA extends ApiRecordBase {
    rr_type: PektinRRType.TLSA;
    rr_set: TLSARecord[];
}
export interface ApiRecordTXT extends ApiRecordBase {
    rr_type: PektinRRType.TXT;
    rr_set: TXTRecord[];
}

export interface ResourceRecordBase {
    ttl: number;
}

export type ResourceRecord =
    | ARecord
    | AAAARecord
    | CAARecord
    | CNAMERecord
    | MXRecord
    | NSRecord
    | OPENPGPKEYRecord
    | SOARecord
    | SRVRecord
    | TLSARecord
    | TXTRecord;

export interface ARecord extends ResourceRecordBase {
    value: string;
}
export interface AAAARecord extends ResourceRecordBase {
    value: string;
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
export interface CNAMERecord extends ResourceRecordBase {
    value: string;
}
export interface MXRecord extends ResourceRecordBase {
    preference: number;
    exchange: string;
}
export interface NSRecord extends ResourceRecordBase {
    value: string;
}
export interface OPENPGPKEYRecord extends ResourceRecordBase {
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
export interface SRVRecord extends ResourceRecordBase {
    priority: number;
    weight: number;
    port: number;
    target: string;
}
export interface TLSARecord extends ResourceRecordBase {
    cert_usage: 0 | 1 | 2 | 3;
    selector: 0 | 1;
    matching: 0 | 1 | 2;
    cert_data: string;
}
export interface TXTRecord extends ResourceRecordBase {
    value: string;
}

export enum PektinRRType {
    A = "A",
    AAAA = "AAAA",
    CAA = "CAA",
    CNAME = "CNAME",
    MX = "MX",
    NS = "NS",
    OPENPGPKEY = "OPENPGPKEY",
    SOA = "SOA",
    SRV = "SRV",
    TLSA = "TLSA",
    TXT = "TXT"
}
