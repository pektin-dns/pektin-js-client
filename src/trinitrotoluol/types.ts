import { DnsRecordType, DnssecAlgorithmType } from "../types.js";

export interface TntQuery {
    name: string;
    rr_type: string;
    server: string;
    port?: number;
    connection_type?: TntQueryConnectionType;
    fetch_dnssec?: boolean;
}

export enum TntQueryConnectionType {
    udp = `udp`,
    tcp = `tcp`,
    tls = `tls`,
    httpGet = `http-get`,
    httpPost = `http-post`,
    httpsGet = `https-get`,
    httpsPost = `https-post`,
}

export interface TntAnswer {
    owner: {
        labels: string[];
    };
    rtype: DnsRecordType;
    class: `IN`;
    ttl: number;
    rdata: {
        AAAA?: {
            address: string;
        };
        RRSIG?: {
            type_covered: DnsRecordType;
            algorithm: DnssecAlgorithmType;
            labels: number;
            original_ttl: number;
            signature_expiration: number;
            signature_inception: number;
            key_tag: number;
            signer_name: {
                labels: string[];
            };
            signature: Uint8Array;
        };
        NSEC: {
            next_domain_name: {
                labels: string[];
            };
            types: string[];
        };
    };
}
