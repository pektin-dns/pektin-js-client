import { PektinClient } from "../index.js";
import { promises as fs } from "fs";
import { PektinRRType } from "../index.js";
const serverAdminConfig = await fs.readFile(
    `../pektin-compose/secrets/server-admin-connection-config.json`,
    { encoding: `utf8` }
);

const pc = new PektinClient(JSON.parse(serverAdminConfig));

await pc.setupDomain(`pektin.aaa.`, [
    { name: `ns1.pektin.aaa.`, ips: [`1::1`] },
]);
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

console.log(
    JSON.stringify(
        await pc.deleteRecords([
            {
                name: `xxx.pektin.aaa.`,
                rr_type: PektinRRType.A,
            },
        ]),
        null,
        `   `
    )
);

console.log(
    JSON.stringify(await pc.getZoneRecords([`pektin.aaa.`]), null, `   `)
);
