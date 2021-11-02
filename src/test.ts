import { ExtendedPektinApiClient } from "./index.js";

const pc = new ExtendedPektinApiClient({
    username: "ui-lzMh07R7i71oFg",
    password:
        "TA8b8An9RP2dPkwQIAWk_vG--WDd2e-I-m28kk_yV4UDXldufkT_gucfXeavWlZi_wgz8s_TtqtyUIpFzcjc2mqiQL6Co-u5m-aRTudr8xsVQ0XKuK5PZAAauhHD3yHi78_b0Q",
    vaultEndpoint: "http://127.0.0.1:8200"
});

console.log(await pc.setupMainDomain());

console.log(await pc.getDomains());

console.log(await pc.deleteZone("example.com"));
