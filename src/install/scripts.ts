import { config } from "dotenv";
import { installPektinCompose } from "./compose.js";
import { pektinComposeFirstStart } from "./first-start.js";
import { unsealVault } from "../vault/vault.js";
import { checkConfig } from "@pektin/config";
import { updateConfig } from "./updateConfig.js";
import { createSecrets, installK8s } from "./k8s.js";

config({ path: `/pektin-compose/secrets/.env` });

const argv = process.argv;
const script = argv[2];
(async () => {
    switch (script) {
        case `compose-install`:
            await checkConfig(
                `/pektin-compose/pektin-config.json`,
                `node_modules/@pektin/config/pektin-config.schema.yml`,
                `json`,
                false
            );
            await installPektinCompose();
            break;
        case `compose-start`:
            if (!process.env.V_KEY) throw Error(`Could not get key from .env file to unlock vault`);
            await unsealVault(`http://pektin-vault`, process.env.V_KEY);
            await checkConfig(
                `/pektin-compose/pektin-config.json`,
                `node_modules/@pektin/config/pektin-config.schema.yml`
            );
            await updateConfig();
            break;
        case `compose-first-start`:
            await pektinComposeFirstStart();
            break;
        case `k8s-install`:
            await installK8s();
            //await pektinComposeFirstStart(`/base/`);
            break;
        case `k8s-create-secrets`:
            await checkConfig(
                `/base/pektin-config.yml`,
                `node_modules/@pektin/config/pektin-config.schema.yml`,
                `yaml`,
                false
            );
            await createSecrets();
            break;
        default:
            throw Error(`Invalid script: ${script}`);
    }
})();
