import { config } from "dotenv";
import { installPektinCompose } from "./install.js";
import { pektinComposeFirstStart } from "./first-start.js";
import { unsealVault } from "../vault/vault.js";
import { checkConfig } from "@pektin/config";
import { updateConfig } from "./updateConfig.js";

config({ path: `/pektin-compose/secrets/.env` });

const argv = process.argv;
const script = argv[2];
(async () => {
    switch (script) {
        case `install`:
            await checkConfig(
                `/pektin-compose/pektin-config.json`,
                `node_modules/@pektin/config/pektin-config.schema.yml`,
                `json`,
                false
            );
            await installPektinCompose();
            break;
        case `start`:
            if (!process.env.V_KEY) throw Error(`Could not get key from .env file to unlock vault`);
            await unsealVault(`http://pektin-vault`, process.env.V_KEY);
            await checkConfig(
                `/pektin-compose/pektin-config.json`,
                `node_modules/@pektin/config/pektin-config.schema.yml`
            );
            await updateConfig();
            break;
        case `first-start`:
            await pektinComposeFirstStart();
            break;
        case `check-config`:
            await checkConfig(
                `/pektin-compose/pektin-config.json`,
                `node_modules/@pektin/config/pektin-config.schema.yml`
            );
            break;
        default:
            throw Error(`Invalid script: ${script}`);
    }
})();
