import { DnsRecordType, DnssecAlgorithmType } from "../types.js";

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
    };
}
