import { PektinClient } from "../index.js";
import { promises as fs } from "fs";
import f from "cross-fetch";

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

test(`contact api with invalid method`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(apiEndpoint, { method: `GET` });

    expect(res.status).toBe(404);
});

test(`contact api without path`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(apiEndpoint, { method: `POST` });
    expect(res.status).toBe(404);
});

test(`contact api without json header`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, { method: `POST` });
    const j = await res.json();

    expect(res.status).toBe(400);
    expect(j.message).toBe(`Content type error: must be 'application/json'`);
});

test(`contact api without body`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
    });
    const j = await res.json();

    expect(res.status).toBe(400);
    expect(j.message).toBe(`Json deserialize error: EOF while parsing a value at line 1 column 0`);
});

test(`contact api with empty body`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: JSON.stringify({}),
    });
    const j = await res.json();

    expect(res.status).toBe(400);
    expect(j.message).toBe(
        `Json deserialize error: missing field \`client_username\` at line 1 column 2`
    );
});

test(`contact api with invalid body 1`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: `{}{}{}{}{}`,
    });
    const j = await res.json();

    expect(res.status).toBe(400);
    expect(j.message).toBe(
        `Json deserialize error: missing field \`client_username\` at line 1 column 2`
    );
});

test(`contact api with invalid body 2`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: `{"client_username":""}`,
    });
    const j = await res.json();

    expect(res.status).toBe(400);
    expect(j.message).toBe(
        `Json deserialize error: missing field \`confidant_password\` at line 1 column 22`
    );
});

test(`contact api with empty records array for get`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/get`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: JSON.stringify({ confidant_password: ``, client_username: ``, records: [] }),
    });
    const j = await res.json();

    expect(res.status).toBe(401);
    expect(j.message).toBe(
        `Could not get Vault token for confidant: Invalid username or password\n`
    );
});

test(`contact api with empty records array for set`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/set`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: JSON.stringify({ confidant_password: ``, client_username: ``, records: [] }),
    });
    const j = await res.json();

    expect(res.status).toBe(401);
    expect(j.message).toBe(
        `Could not get Vault token for confidant: Invalid username or password\n`
    );
});

test(`contact api with empty globs array for search`, async () => {
    const apiEndpoint = await pc.getPektinEndpoint(`api`);
    const res = await f(`${apiEndpoint}/search`, {
        method: `POST`,
        headers: { "content-type": `application/json` },
        body: JSON.stringify({ confidant_password: ``, client_username: ``, globs: [] }),
    });
    const j = await res.json();

    expect(res.status).toBe(401);
    expect(j.message).toBe(
        `Could not get Vault token for confidant: Invalid username or password\n`
    );
});
