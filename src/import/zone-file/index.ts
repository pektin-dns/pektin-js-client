import zoneFile from "@pektin/dns-zonefile";
import {
    absoluteName,
    concatDomain,
    isAbsolute,
    supportedRecordTypesArray,
    ApiRecord,
    PektinRRType,
    PektinZoneData,
    ResourceRecord,
} from "../../index.js";

export const getZoneFromFile = (file: string, zoneName?: string): PektinZoneData => {
    const parsedFile = zoneFile.parse(file);
    let origin = absoluteName(parsedFile.$origin as string);
    if (!origin) {
        if (!zoneName)
            throw Error(
                `Zone name ist unknown. Either include $ORIGIN; or set this functions second parameter to the zone name`
            );
        origin = absoluteName(zoneName);
    }

    const newRecords: ApiRecord[] = [];
    supportedRecordTypesArray.forEach((type) => {
        if (type === `SOA`) {
            const zoneRecord = parsedFile[`soa`];
            if (!zoneRecord) throw Error(`No SOA record found`);
            newRecords.push({
                rr_type: PektinRRType.SOA,
                name: replaceOrigin(zoneRecord.name, origin),
                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                rr_set: [
                    {
                        minimum: zoneRecord.minimum,
                        expire: zoneRecord.expire,
                        retry: zoneRecord.retry,
                        refresh: zoneRecord.refresh,
                        serial: zoneRecord.serial,
                        rname: zoneRecord.rname.toLowerCase(),
                        mname: zoneRecord.mname.toLowerCase(),
                    },
                ],
            });
        } else {
            /*@ts-ignore*/
            if (parsedFile[type.toLowerCase()]?.length) {
                /*@ts-ignore*/
                parsedFile[type.toLowerCase()].forEach((zoneRecord) => {
                    switch (type) {
                        case PektinRRType.A:
                            newRecords.push({
                                rr_type: PektinRRType.A,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        value: zoneRecord.ip,
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.AAAA:
                            newRecords.push({
                                rr_type: PektinRRType.AAAA,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        value: zoneRecord.ip,
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.NS:
                            newRecords.push({
                                rr_type: PektinRRType.NS,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        value: zoneRecord.host.toLowerCase(),
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.CNAME:
                            newRecords.push({
                                rr_type: PektinRRType.CNAME,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        value: replaceOrigin(zoneRecord.alias, origin),
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.MX:
                            newRecords.push({
                                rr_type: PektinRRType.MX,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        preference: zoneRecord.preference,
                                        exchange: replaceOrigin(zoneRecord.host, origin),
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.TXT:
                            newRecords.push({
                                rr_type: PektinRRType.TXT,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        value: zoneRecord.txt,
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.SRV:
                            newRecords.push({
                                rr_type: PektinRRType.SRV,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        port: zoneRecord.port,
                                        priority: zoneRecord.priority,
                                        target: zoneRecord.target,
                                        weight: zoneRecord.weight,
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.CAA:
                            newRecords.push({
                                rr_type: PektinRRType.CAA,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        issuer_critical: zoneRecord.flags,
                                        tag: zoneRecord.tag,
                                        value: zoneRecord.value,
                                    },
                                ],
                            });
                            break;
                        case PektinRRType.TLSA:
                            newRecords.push({
                                rr_type: PektinRRType.TLSA,
                                name: replaceOrigin(zoneRecord.name, origin),
                                ttl: parseNum(zoneRecord.ttl, parsedFile.$ttl),
                                rr_set: [
                                    {
                                        cert_usage: zoneRecord.cert_usage,
                                        selector: zoneRecord.selector,
                                        matching: zoneRecord.matching,
                                        cert_data: zoneRecord.cert_data,
                                    },
                                ],
                            });
                            break;
                    }
                });
            }
        }
    });

    const distinctRecords = Array.from(
        new Set(
            newRecords.map((record) => {
                return `${record.name}:${record.rr_type}`;
            })
        )
    );
    // merge records
    const nrm: ApiRecord[] = distinctRecords.map((cri) => {
        const [name, rr_type] = cri.split(`:`);
        const mergedRecord = {
            name,
            rr_type: rr_type as PektinRRType,
            rr_set: [] as ResourceRecord[],
        };
        newRecords.forEach((newRecord) => {
            if (newRecord.rr_type === rr_type && newRecord.name === name) {
                mergedRecord.rr_set.push(newRecord.rr_set[0]);
            }
        });
        return mergedRecord;
    }) as ApiRecord[];

    return { [origin]: nrm };
};

const replaceOrigin = (inputName: string, origin: string) => {
    if (inputName.includes(`@`)) return inputName.replace(`@`, origin?.toLowerCase()).toLowerCase();
    if (!isAbsolute(inputName)) return concatDomain(origin, inputName).toLowerCase();
    return inputName.toLowerCase();
};

const parseNum = (recordTTL: number | string | undefined, zoneTTL: number | string | undefined) => {
    recordTTL = parseIntThrow(recordTTL);
    zoneTTL = parseIntThrow(zoneTTL);
    if (recordTTL) {
        if (typeof recordTTL === `string`) {
            return parseInt(recordTTL);
        } else {
            return recordTTL;
        }
    }
    if (zoneTTL) {
        if (typeof zoneTTL === `string`) {
            return parseInt(zoneTTL);
        } else {
            return zoneTTL;
        }
    }

    return 3600;
};

const parseIntThrow = (input: string | number | undefined) => {
    if (typeof input !== `string`) return input;
    const out = parseInt(input);
    if (input !== out.toString()) throw Error(`Invalid Number`);
    return out;
};
