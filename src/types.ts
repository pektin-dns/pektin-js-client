import { PektinConfig } from "@pektin/config/src/config-types.js";

export interface Client {
    name: string;
    confidant: boolean;
    manager: boolean;
}

export interface TempDomain {
    domain: string;
    zoneDomain: string;
}

export interface SNSNameserver {
    fullNsDomain: string;
    ips?: string[];
    legacyIps?: string[];
}

export interface ClientCapabilities {
    ribstonPolicy: string;
    opaPolicy: string;
    allowedSigningDomains?: string[];
    allowAllSigningDomains?: boolean;
    allowFullUserManagement?: boolean;
    recursorAccess?: boolean;
    proxyAccess?: boolean;
    configAccess?: boolean;
    allAccess?: boolean;
}

export interface PektinZoneData {
    [domainName: string]: ApiRecord[];
}

export type RibstonPolicy = string; // A valid ribston policy
export type OpaPolicy = string; // A valid opa policy
export type ClientName = string;
export type DomainName = string;
export type ManagerName = `pektin-client-${ClientName}-manager`;
export type ConfidantName = `pektin-client-${ClientName}-confidant`;
export type SignerName = `pektin-signer-${DomainName}`;

export type ManagerPassword = `m.${string}`;
export type ConfidantPassword = `c.${string}`;

export type ClientVaultAccountType = `confidant` | `manager`;

// Pektin Client Connection Config
export interface PC3 {
    vaultEndpoint?: string;
    username: string;
    confidantPassword?: ConfidantPassword;
    managerPassword?: ManagerPassword;
    internal?: boolean;
    override?: OverrideClientCredentials;
}

export interface OverrideClientCredentials {
    pektinApiEndpoint?: string;
    pektinConfig?: PektinConfig;
}

export type ApiResponseBodyError =
    | SetResponseError
    | DeleteResponseError
    | UnauthorizedError
    | InternalServerError;

export type ApiResponseBody =
    | GetResponse
    | GetZoneRecordsResponse
    | SetResponse
    | DeleteResponse
    | SearchResponse
    | HealthResponse;

export type GetResponse =
    | GetResponseSuccess
    | GetResponsePartialSuccess
    | UnauthorizedError
    | InternalServerError;
export type GetZoneRecordsResponse =
    | GetZoneRecordsResponseSuccess
    | GetZoneRecordsResponsePartialSuccess
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
    data: null;
}
export interface InternalServerError extends ApiResponseErrorBase {
    data: null;
}

export interface ApiResponseBase {
    message: string;
    time: number;
    type: ApiResponseType;
}
/* eslint-disable no-unused-vars */
export enum ApiResponseType {
    Success = `success`,
    PartialSuccess = `partial-success`,
    Error = `error`,
    Ignored = `ignored`,
}
/* eslint-enable no-unused-vars */

// response success
export interface ApiResponseSuccessBase extends ApiResponseBase {
    type: ApiResponseType.Success;
}

export interface GetResponseSuccessItem extends ApiResponseBase {
    data: ApiRecord;
}
export interface GetResponseSuccess extends ApiResponseSuccessBase {
    data: GetResponseSuccessItem[];
}

export interface GetZoneRecordsResponseSuccessItem extends ApiResponseBase {
    data: ApiRecord[];
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

export interface SearchResponseSuccessItem extends ApiResponseBase {
    data: RecordIdentifier[];
}

export interface SearchResponseSuccess extends ApiResponseSuccessBase {
    data: SearchResponseSuccessItem[];
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

// response partial success
export interface ApiResponsePartialSuccessBase extends ApiResponseBase {
    type: ApiResponseType.PartialSuccess;
}

export interface GetResponsePartialSuccessItem extends ApiResponseBase {
    data: ApiRecord | null;
}
export interface GetResponsePartialSuccess extends ApiResponseSuccessBase {
    data: GetResponsePartialSuccessItem[];
}

export interface GetZoneRecordsResponsePartialSuccessItem extends ApiResponseBase {
    data: ApiRecord[] | null;
}
export interface GetZoneRecordsResponsePartialSuccess extends ApiResponseSuccessBase {
    data: GetZoneRecordsResponsePartialSuccessItem[];
}

// response errors
export interface ApiResponseErrorBase extends ApiResponseBase {
    type: ApiResponseType.Error;
}

export interface SetResponseErrorItem extends ApiResponseBase {
    type: ApiResponseType.Error | ApiResponseType.Ignored;
}
export interface SetResponseError extends ApiResponseErrorBase {
    data: SetResponseErrorItem[];
}

export interface DeleteResponseErrorItem extends ApiResponseBase {
    type: ApiResponseType.Error | ApiResponseType.Ignored;
}
export interface DeleteResponseError extends ApiResponseErrorBase {
    data: DeleteResponseErrorItem[];
}

export type ApiMethod = `get` | `set` | `search` | `delete` | `get-zone-records` | `health`;

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

export interface RecordIdentifier {
    name: string;
    rr_type: PektinRRType;
}
// API methods
export interface ApiGetRequestBody extends ApiRequestBodyBase {
    records: RecordIdentifier[];
}
export interface ApiSetRequestBody extends ApiRequestBodyBase {
    records: ApiRecord[];
}
export interface Glob {
    name_glob: string;
    rr_type_glob: string;
}
export interface ApiSearchRequestBody extends ApiRequestBodyBase {
    globs: Glob[];
}
export interface ApiDeleteRequestBody extends ApiRequestBodyBase {
    records: RecordIdentifier[];
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
    ttl: number;
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

export interface ARecord {
    value: string;
}
export interface AAAARecord {
    value: string;
}
export type CAARecord = CAARecordIssue | CAARecordIodef;
export interface CAARecordIssue {
    issuer_critical: boolean;
    tag: `issue` | `issuewild`;
    value: DomainName;
}
export interface CAARecordIodef {
    issuer_critical: boolean;
    tag: `iodef`;
    value: `https://${string}` | `http://${string}` | `mailto:${string}`;
}
export interface CNAMERecord {
    value: string;
}
export interface MXRecord {
    preference: number;
    exchange: string;
}
export interface NSRecord {
    value: string;
}
export interface OPENPGPKEYRecord {
    value: string;
}
export interface SOARecord {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
}
export interface SRVRecord {
    priority: number;
    weight: number;
    port: number;
    target: string;
}
export interface TLSARecord {
    cert_usage: 0 | 1 | 2 | 3;
    selector: 0 | 1;
    matching: 0 | 1 | 2;
    cert_data: string;
}
export interface TXTRecord {
    value: string;
}

/* eslint-disable no-unused-vars */
export enum PektinRRType {
    A = `A`,
    AAAA = `AAAA`,

    CAA = `CAA`,
    CNAME = `CNAME`,
    MX = `MX`,
    NS = `NS`,
    OPENPGPKEY = `OPENPGPKEY`,
    SOA = `SOA`,
    SRV = `SRV`,
    TLSA = `TLSA`,
    TXT = `TXT`,
}
/* eslint-enable no-unused-vars */
