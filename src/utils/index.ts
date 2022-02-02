import { PektinRRType } from "../index.js";
import { MXRecord, SOARecord, SRVRecord, CAARecord, TLSARecord, ResourceRecord } from "../types.js";

export const concatDomain = (domain: string, subDomain?: string) => {
    if (subDomain === undefined) return domain;
    return `${subDomain}.${domain}`;
};

export const absoluteName = (name: string) => {
    if (name === undefined) {
        throw Error(
            `Input was undefined. This error indicates an upstream undefined value. Check if all the keys have the right names or use TS.`
        );
    }
    if (name.endsWith(`.`)) {
        return name;
    }
    return name + `.`;
};

export const isAbsolute = (name: string): boolean => name.endsWith(`.`);

export const deAbsolute = (name: string) => {
    if (name.endsWith(`.`)) {
        return name.substring(0, name.length - 1);
    }
    return name;
};

export const textToRRValue = (
    val: string,
    recordType: PektinRRType,
    ttl: number
): ResourceRecord => {
    const t = val.split(` `);
    switch (recordType) {
        case `SOA`: {
            const r: SOARecord = {
                mname: t[0],
                rname: t[1],
                serial: parseInt(t[2]),
                refresh: parseInt(t[3]),
                retry: parseInt(t[4]),
                expire: parseInt(t[5]),
                minimum: parseInt(t[6]),
                ttl,
            };
            return r;
        }
        case `MX`: {
            const r: MXRecord = {
                preference: parseInt(t[0]),
                exchange: t[1],
                ttl,
            };
            return r;
        }
        case `SRV`: {
            const r: SRVRecord = {
                priority: parseInt(t[0]),
                weight: parseInt(t[1]),
                port: parseInt(t[2]),
                target: t[3],
                ttl,
            };
            return r;
        }
        case `CAA`: {
            const r: CAARecord = {
                /*@ts-ignore*/
                tag: t[1] as string,
                value: t[2].replaceAll(`"`, ``),
                issuer_critical: !!t[0],
                ttl,
            };
            return r;
        }
        case `TLSA`: {
            const r: TLSARecord = {
                cert_usage: parseInt(t[0]) as 0 | 1 | 2 | 3,
                selector: parseInt(t[1]) as 0 | 1,
                matching: parseInt(t[2]) as 0 | 1 | 2,
                cert_data: t[3],
                ttl,
            };
            return r;
        }
        default:
            return { value: val, ttl };
    }
};

export const supportedRecordTypes = [
    `A`,
    `AAAA`,
    `NS`,
    `CNAME`,
    `SOA`,
    `MX`,
    `TXT`,
    `SRV`,
    `CAA`,
    `OPENPGPKEY`,
    `TLSA`,
];
