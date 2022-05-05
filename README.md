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

TODO mark position in output when serde returns something like `at line 1 column 357`

pektin.club 3600 DNSKEY 257 3 ECDSAP256SHA256 8KGSgDJjmg2DafFiTtBjs7f/wUg158qtEsJ0EcwrN+bSZcP2cYfTaqkRTsDV3ArlUAKOJ19tLdVypoLXLZjHWQ==

ns1.pektin.club 3600 RRSIG AAAA ECDSAP256SHA256 2 60 20220509215921 20220504215921 35187 pektin.club mlkM/TEtj04JZbaW77Dw4nNiIkiHYm5Lcy/okLejb1jz1Qj4r4AnWYQCnSsutPmpq2xGR56cb7vY71q9GSS/+A==
