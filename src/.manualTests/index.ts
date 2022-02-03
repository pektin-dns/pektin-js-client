import { PektinClient } from "../main.js";
import { promises as fs } from "fs";
import { PektinRRType } from "../index.js";

import { config } from "dotenv";
import { getAllFromPdns } from "../import/get/pdns/index.js";
import { getZoneFromFile } from "../import/get/zone-file/index.js";
import { get } from "../import/get/wanderlust/index.js";

config({ path: "/home/paul/Documents/powerdns-api/.env" });

if (!process.env.PDNS_API_ENDPOINT || !process.env.PDNS_API_KEY) throw Error("missing");

const serverAdminConfig = await fs.readFile(
    `../pektin-compose/secrets/server-admin-connection-config.json`,
    { encoding: `utf8` }
);

const pc = new PektinClient(JSON.parse(serverAdminConfig));
import toluol from "@pektin/toluol-wasm-nodejs";
console.log(await get([`y.gy.`], pc, toluol, 200));

/*
pc.restoreFromPektinZoneData(
    await getAllFromPdns(process.env.PDNS_API_ENDPOINT, process.env.PDNS_API_KEY)
);
*/
/*
await pc.setupDomain(`pektin.aaa.`, [{ name: `ns1.pektin.aaa.`, ips: [`1::1`] }]);

await pc.set([
    {
        name: `xxx.pektin.aaa.`,
        rr_type: PektinRRType.A,
        rr_set: [{ ttl: 60, value: `1.1.1.1` }],
    },
]);
await pc.set([
    {
        name: `xyz.pektin.aaa.`,
        rr_type: PektinRRType.A,
        rr_set: [{ ttl: 60, value: `1.1.1.1` }],
    },
]);
*/

const file = `$ORIGIN pektin.io
@ 86400 IN SOA ns1.gandi.net. hostmaster.gandi.net. 1643461544 10800 3600 604800 10800
@ 10800 IN A 217.70.184.38
@ 10800 IN MX 50 fb.mail.gandi.net.
@ 10800 IN TXT "v=spf1 include:_mailcust.gandi.net ?all"
_imaps._tcp 10800 IN SRV 0 1 993 mail.gandi.net.
_pop3s._tcp 10800 IN SRV 10 1 995 mail.gandi.net.
_submission._tcp 10800 IN SRV 0 1 465 mail.gandi.net.
gm1._domainkey 10800 IN CNAME gm1.gandimail.net.
gm2._domainkey 10800 IN CNAME gm2.gandimail.net.
gm3._domainkey 10800 IN CNAME gm3.gandimail.net.
webmail 10800 IN CNAME webmail.gandi.net.
www 10800 IN CNAME webredir.vip.gandi.net.
`;

await pc.restoreFromPektinZoneData(getZoneFromFile(file));
