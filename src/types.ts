import { PektinConfig } from "@pektin/config/src/config-types.js";

export enum DnsRecordTypeNum {
    A = 1,
    AAAA = 28,
    AFSDB = 18,
    APL = 42,
    CAA = 257,
    CDNSKEY = 60,
    CDS = 59,
    CERT = 37,
    CNAME = 5,
    CSYNC = 62,
    DHCID = 49,
    DLV = 32769,
    DNAME = 39,
    DNSKEY = 48,
    DS = 43,
    EUI48 = 108,
    EUI64 = 109,
    HINFO = 13,
    HIP = 55,
    HTTPS = 65,
    IPSECKEY = 45,
    KEY = 25,
    KX = 36,
    LOC = 29,
    MX = 15,
    NAPTR = 35,
    NS = 2,
    NSEC = 47,
    NSEC3 = 50,
    NSEC3PARAM = 51,
    OPENPGPKEY = 61,
    PTR = 12,
    RRSIG = 46,
    RP = 17,
    SIG = 24,
    SMIMEA = 53,
    SOA = 6,
    SRV = 33,
    SSHFP = 44,
    SVCB = 64,
    TA = 32768,
    TKEY = 249,
    TLSA = 52,
    TSIG = 250,
    TXT = 16,
    URI = 256,
    ZONEMD = 63,
}

export enum DnsRecordType {
    A = "A",
    AAAA = "AAAA",
    AFSDB = "AFSDB",
    APL = "APL",
    CAA = "CAA",
    CDNSKEY = "CDNSKEY",
    CDS = "CDS",
    CERT = "CERT",
    CNAME = "CNAME",
    CSYNC = "CSYNC",
    DHCID = "DHCID",
    DLV = "DLV",
    DNAME = "DNAME",
    DNSKEY = "DNSKEY",
    DS = "DS",
    EUI48 = "EUI48",
    EUI64 = "EUI64",
    HINFO = "HINFO",
    HIP = "HIP",
    HTTPS = "HTTPS",
    IPSECKEY = "IPSECKEY",
    KEY = "KEY",
    KX = "KX",
    LOC = "LOC",
    MX = "MX",
    NAPTR = "NAPTR",
    NS = "NS",
    NSEC = "NSEC",
    NSEC3 = "NSEC3",
    NSEC3PARAM = "NSEC3PARAM",
    OPENPGPKEY = "OPENPGPKEY",
    PTR = "PTR",
    RRSIG = "RRSIG",
    RP = "RP",
    SIG = "SIG",
    SMIMEA = "SMIMEA",
    SOA = "SOA",
    SRV = "SRV",
    SSHFP = "SSHFP",
    SVCB = "SVCB",
    TA = "TA",
    TKEY = "TKEY",
    TLSA = "TLSA",
    TSIG = "TSIG",
    TXT = "TXT",
    URI = "URI",
    ZONEMD = "ZONEMD",
}

export enum DnssecAlgorithmType {
    DELETE = 0,
    RSAMD5 = 1,
    DH = 2,
    DSA = 3,
    RSASHA1 = 5,
    "DSA-NSEC3-SHA1" = 6,
    "RSASHA1-NSEC3-SHA1" = 7,
    RSASHA256 = 8,
    RSASHA512 = 10,
    "ECC-GOST" = 12,
    ECDSAP256SHA256 = 13,
    ECDSAP384SHA384 = 14,
    ED25519 = 15,
    ED448 = 16,
}

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
    tntAccess?: boolean;
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

export type BasicAuthString = `Basic ${string}`;

// Pektin Client Connection Config
export interface PC3 {
    vaultEndpoint?: string;
    username: string;
    perimeterAuth?: BasicAuthString;
    confidantPassword?: ConfidantPassword;
    managerPassword?: ManagerPassword;
    internal?: boolean;
    override?: OverrideClientCredentials;
    info?: PC3Info;
}

export interface OverrideClientCredentials {
    pektinApiEndpoint?: string;
    pektinConfig?: PektinConfig;
}

export interface PC3Info {
    apiCredentials?: PC3InfoApiCredentials;
}

export interface PC3InfoApiCredentials {
    [key: string]: ApiCredential[];
}
export interface ApiCredential {}

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

interface ApiRequestBodyBase {
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
    meta?: string;
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

export interface PublicDnssecData {
    pubKeyPEM: string;
    pubKeyDns: string;
    algorithm: number;
    coordinates: {
        x: number;
        y: number;
    };
    flag: number;
    digests: {
        sha256: string;
        sha384: string;
        sha512: string;
    };
    keyTag: number;
}

export const supportedPektinRrTypes = [
    `A`,
    `AAAA`,
    `CAA`,
    `CNAME`,
    `MX`,
    `NS`,
    `OPENPGPKEY`,
    `SOA`,
    `SRV`,
    `TLSA`,
    `TXT`,
];

export interface ProxyOptions {
    proxyEndpoint: string;
    name: string;
    proxyAuth: string;
}
export enum FetchType {
    direct,
    proxy,
}
