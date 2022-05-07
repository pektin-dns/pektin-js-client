export {};
/*
import { PektinClient } from "../main.js";
import { promises as fs } from "fs";

import { config } from "dotenv";
import { ApiRecordSOA, PektinRRType } from "../types.js";
import { listVaultUsers } from "../vault/vault.js";
import { createPektinClient, deleteClient, getPektinClients } from "../auth.js";
import { bitStringToInteger, calculateKeyTag } from "../pureFunctions.js";

import crypto from "crypto";

config({ path: `/home/paul/Documents/powerdns-api/.env` });

if (!process.env.PDNS_API_ENDPOINT || !process.env.PDNS_API_KEY) throw Error(`missing`);

const serverAdminConfig = await fs.readFile(`../pektin-compose/secrets/server-admin.pc3.json`, {
    encoding: `utf8`,
});

const acmeClientConfig = await fs.readFile(`../pektin-compose/secrets/acme-client.pc3.json`, {
    encoding: `utf8`,
});

const pc = new PektinClient(JSON.parse(serverAdminConfig));
await pc.init();

//console.log(await pc.getEverything());

//console.log(await pc.deletePektinSigner(`abc.de.`));

console.log(await pc.getPublicDnssecData(`pektin.club.`));

const pem = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE
96hv0yAGRMBEEyliSj+9pIorFRGnIgd4E0ra9NNhza
J9Ypg6fzHdiawUYehRQ/qBtof/1NnHtITmP1F3fNqLnw==
-----END PUBLIC KEY-----`;
*/
/*

-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE
96hv0yAGRMBEEyliSj+9pIorFRGnIgd4E0ra9NNhza
J9Ypg6fzHdiawUYehRQ/qBtof/1NnHtITmP1F3fNqLnw==
-----END PUBLIC KEY-----
full pem key above in binary
30 59 30 13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce 3d 03 01 07 03 42 00 04 

f7 a8 6f d3 20 06 44 c0 44 13 29 62 4a 3f bd a4 8a 2b 15 11 a7 22 07 78 13 4a da f4 d3 61 cd a2 
7d 62 98 3a 7f 31 dd 89 ac 14 61 e8 51 43 fa 81 b6 87 ff d4 d9 c7 b4 84 e6 3f 51 77 7c da 8b 9f

last 32 bytes are y
the 32 bytes before that are x

x
f7 a8 6f d3 20 06 44 c0 44 13 29 62 4a 3f bd a4 8a 2b 15 11 a7 22 07 78 13 4a da f4 d3 61 cd a2

y
7d 62 98 3a 7f 31 dd 89 ac 14 61 e8 51 43 fa 81 b6 87 ff d4 d9 c7 b4 84 e6 3f 51 77 7c da 8b 9f


------

-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE
8KGSgDJjmg2DafFiTtBjs7f/wUg1
58qtEsJ0EcwrN+bSZcP2cYfTaqkRTsDV3ArlUAKOJ19tLdVypoLXLZjHWQ==
-----END PUBLIC KEY-----

30 59 30 13 06 07 2a 86 48 ce 3d 02 01 06 08 2a 86 48 ce 3d 03 01 07 03 42 00 04 
f0 a1 92 80 32 63 9a 0d 83 69 f1 62 4e d0 63 b3 b7 ff c1 48 35 e7 ca ad 12 c2 74 11 cc 2b 37 e6 d2 65 c3 f6 71 87 d3 6a a9 11 4e c0 d5 dc 0a e5 50 02 8e 27 5f 6d 2d d5 72 a6 82 d7 2d 98 c7 59


*/
//const key2 = crypto.createPublicKey(key).export({ format: `pem`, type: `spki` });

/*
if (pc.vaultEndpoint && pc.managerToken) {
    //await createPektinClient({ endpoint: pc.vaultEndpoint, token: pc.managerToken });
    const clients = await getPektinClients(pc.vaultEndpoint, pc.managerToken);
    console.log(clients);
    await deleteClient(pc.vaultEndpoint, pc.managerToken, clients[0]);
    const c2 = await getPektinClients(pc.vaultEndpoint, pc.managerToken);
    console.log(c2);
}

//console.log(await pc.health());
//console.log(await pc.get([{ name: `_acme-challenge.pektin.club.`, rr_type: PektinRRType.TXT }]));
//console.log(await pc.get([{ name: `sneaky-beaky.pektin.club.`, rr_type: PektinRRType.TXT }]));

//console.log(await pc.getZoneRecords([`pektin.club.`]));

//const res = await pc.getCrtInfo(``);
//console.log(res);

const r: ApiRecordSOA = {
    name: `pektin.club.`,
    rr_type: PektinRRType.SOA,
    ttl: 3600,
    rr_set: [
        {
            mname: `ns1.example.com.`,
            rname: `hostmaster.example.com.`,
            refresh: 0,
            retry: 0,
            serial: 0,
            expire: 0,
            minimum: 0,
        },
    ],
};

/*
const c: PektinConfig = {
    ...JSON.parse(await fs.readFile(`../pektin-compose/pektin-config.json`, { encoding: `utf8` })),
} as const;
*/
//await isReady(`http://vault-н.яндекс.рф.localhost`);
//console.log(`ready`);

/*
pc.setupDomain(`example.com.`, [{ name: `ns1.example.com.`, ips: [`1::1`] }]);
pc.setupDomain(`a.example.com.`, [{ name: `ns1.a.example.com.`, ips: [`1::1`] }]);

*/
//console.log(await pc.get([{ name: `яндекс.рф.`, rr_type: PektinRRType.SOA }]));

//console.log(await pc.setupDomain(`a.de.`, [{ fullNsDomain: `.a.`, ips: [`1::1`] }]));
/*
console.log(
    beautifyJSON(
        await pc.search([
            {
                name_glob: `*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.*.`,
                rr_type_glob: `*`,
            },
        ])
    )
);
console.log(beautifyJSON(await pc.getDomains()));
*/
/*
genTraefikConfs({
    pektinConfig: c,
    node: c.nodes[0],
    tempDomain: requestPektinDomain(),
    trinitrotoluolAuth: `shahuhuiwqdr`,
}); //?
*/
//await pc.duplicateZone(`y.gy`, `k.xx`, true);
//import toluol from "@pektin/toluol-wasm-nodejs";
//console.log(await importByZoneWalking([`google.com`], pc, toluol, 200));

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
/*
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
*/
//await pc.setPektinZoneData(getZoneFromFile(file));
