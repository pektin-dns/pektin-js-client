import { PektinClient } from "../index.js";
import { promises as fs } from "fs";
import { PektinRRType } from "../types.js";
import { jest } from "@jest/globals";

const serverAdminConfig = JSON.parse(
    await fs.readFile(`../pektin-compose/secrets/server-admin.pc3.json`, {
        encoding: `utf8`,
    })
);
const pc = new PektinClient(serverAdminConfig);

beforeEach(async () => {
    await pc.deleteEverything();
});

afterEach(async () => {
    await pc.deleteEverything();
});
test(`setup a domain`, async () => {
    await pc.setupDomain(`example.jest.`, [{ fullNsDomain: `ns1.example.jest.`, ips: [`1::1`] }]);
});

// api
test(`try to create a record for a domain where no SOA exists`, async () => {
    expect(async () => {
        await pc.set([
            {
                name: `hallo.example.jest.`,
                rr_set: [{ value: `hallo das ist ein test` }],
                rr_type: PektinRRType.TXT,
                ttl: 3600,
            },
        ]);
    }).rejects.toThrow(/No SOA record found for this zone/);
});

test(`try to set a txt record and check if it exists`, async () => {
    await pc.setupDomain(`example.jest.`, [{ fullNsDomain: `ns1.example.jest.`, ips: [`1::1`] }]);

    await pc.set([
        {
            name: `hallo.example.jest.`,
            rr_set: [{ value: `hallo das ist ein test` }],
            rr_type: PektinRRType.TXT,
            ttl: 3600,
        },
    ]);

    const a = await pc.get([{ name: `hallo.example.jest.`, rr_type: PektinRRType.TXT }]);
    expect(a.type).toBe(`success`);
});

test(`try to set a record with an empty rr_set`, async () => {
    await pc.setupDomain(`example.jest.`, [{ fullNsDomain: `ns1.example.jest.`, ips: [`1::1`] }]);

    expect(async () => {
        await pc.set([
            {
                name: `hallo.example.jest.`,
                rr_set: [],
                rr_type: PektinRRType.TXT,
                ttl: 3600,
            },
        ]);
    }).rejects.toThrow(/The record's RR set is empty/);
});

test(`try to set a record with only the root label`, async () => {
    await pc.setupDomain(`.`, [{ fullNsDomain: `ns1`, ips: [`1::1`] }]);
});

test(`try to set a record with only the root label`, async () => {
    expect(async () => {
        await pc.setupDomain(`....`, [{ fullNsDomain: `.....`, ips: [`1::1`] }]);
    }).rejects.toThrow(/Json deserialize error: Malformed label:  at line 1 column 227/);
});
