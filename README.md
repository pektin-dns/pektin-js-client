TODO mark position in output when serde returns something like `at line 1 column 357`

# JavaScript / TypeScript

[git.y.gy](https://git.y.gy/pektin/pektin-js-client) | [GitLab](https://gitlab.com/pektin/pektin-js-client) | [GitHub](https://github.com/pektin-dns/pektin-js-client) | [NPM](https://www.npmjs.com/package/@pektin/client)

## Install

```shell
yarn add @pektin/client
```

```shell
npm i @pektin/client
```

## Basic Use

**Normaly you should NEVER store your credentials in a code file but use something like a .env file. Have a look at [dotenv](https://www.npmjs.com/package/dotenv) for Node.js.**

```ts
import { PektinClient } from "@pektin/client";

const pc = new PektinClient({
    username: "ui-j-6samfz_r1OTQ",
    password:
        "Bq9Wvf4_FeDtKNoxdFLJweZzYhKVnN4Ll9SiQniyBRQIu2c_1BIHqGihFr6KlQproTrMndkSA50aUQY_HS8VRJNWBdveGAeoWWwcGrECPBwgIygDbKUjeXHaGE2FOvXeWTmbHg",
    vaultEndpoint: "https://vault-pektin.pektin.xyz",
});

console.log(await pc.getDomains());
```

-   "manager" that can create vault roles holds pw for "confidant"
-   "confidant" holds half of password for "signers"
-   "signer" can sign for domains

# яндекс.рф
