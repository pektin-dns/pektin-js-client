import { PektinClient } from "../index.js";
import { promises as fs } from "fs";
const serverAdminConfig = await fs.readFile(
    "../pektin-compose/secrets/server-admin-connection-config.json",
    { encoding: "utf8" }
);

const pc = new PektinClient(JSON.parse(serverAdminConfig));

console.log(await pc.setupDomain("pektin.xyz.", [{ name: "ns1.pektin.xyz.", ips: ["1::1"] }]));

console.log(JSON.stringify(await pc.getZoneRecords(["pektin.xyz."]), null, "   "));
