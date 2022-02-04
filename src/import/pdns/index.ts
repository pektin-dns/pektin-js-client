import { PektinZoneData, PektinRRType } from "../../types.js";
/*@ts-ignore*/
import { PowerdnsClient } from "@firstdorsal/powerdns-api";
import { isSupportedRecordType, textToRRValue } from "../../utils/index.js";
export const getAllFromPdns = async (baseurl: string, apikey: string): Promise<PektinZoneData> => {
    const pdns = new PowerdnsClient(baseurl, apikey);

    const zoneResponses: PdnsZonesReturn[] = await pdns.getZones();

    if (!zoneResponses) throw Error(`Couldn't get zones`);
    const zones = zoneResponses
        .map((zone: { name: string }) => zone.name)
        .filter((n: string) => !n.includes(`ip6.arpa.`) && !n.includes(`in-addr.arpa.`));

    let zoneRequests = zones.map(function (name: string) {
        return pdns.getZone(name);
    });

    let records: PdnsResourceRecord[][] = await Promise.all(zoneRequests);
    const out: PektinZoneData = {};
    zones.forEach((name: string, i: number) => {
        /*@ts-ignore*/
        out[name] = records[i]
            .filter((r) => isSupportedRecordType(r.type))
            .map((r) => {
                const rr_set = r.records.map((record) => {
                    return textToRRValue(record.content, r.type as PektinRRType, r.ttl);
                });
                return { name: r.name, rr_type: r.type as PektinRRType, rr_set };
            });
    });

    return out;
};

export interface PdnsResourceRecord {
    comments: string[];
    name: string;
    records: PdnsRecord[];
    ttl: number;
    type: string;
}
export interface PdnsRecord {
    content: string;
}
export interface PdnsZonesReturn {
    account: string;
    dnssec: true;
    edited_serial: number;
    id: string;
    kind: string;
    last_check: number;
    masters: [];
    name: string;
    notified_serial: number;
    serial: number;
    url: string;
}
