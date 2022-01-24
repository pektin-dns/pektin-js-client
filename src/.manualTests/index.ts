import { PektinClient } from "../index.js";
import { promises as fs } from "fs";
const serverAdminConfig = await fs.readFile(
    "../pektin-compose/secrets/server-admin-connection-config.json",
    { encoding: "utf8" }
);

const pc = new PektinClient(JSON.parse(serverAdminConfig));

console.log(await pc.setupDomain("pektin.abc.", [{ name: "ns1.pektin.abc.", ips: ["1::1"] }]));
