import { ClientCapabilities } from "../types.js";
import { deAbsolute } from "../utils/index.js";
import { VaultPolicy } from "./types.js";

export const pektinSignerPolicy: VaultPolicy = `
path "pektin-transit/sign/{{identity.entity.metadata.domain}}-zsk/sha2-256" {
    capabilities = ["update"]
}

path "pektin-transit/keys/{{identity.entity.metadata.domain}}-zsk" {
    capabilities = ["read"]
}

path "pektin-transit/sign/{{identity.entity.metadata.domain}}-ksk/sha2-256" {
    capabilities = ["update"]
}

path "pektin-transit/keys/{{identity.entity.metadata.domain}}-ksk" {
    capabilities = ["read"]
}`;

export const pektinServerAdminManagerPolicy: VaultPolicy = `
path "auth/userpass/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-kv/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-transit/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "identity/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "sys/auth" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-signer-passwords/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-signer-passwords-1/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}
path "pektin-signer-passwords-2/*" {
    capabilities = ["create", "read", "update", "delete", "list"]
}

`;

export const pektinConfidantPolicy = (capabilities: ClientCapabilities): VaultPolicy => {
    let policy = ``;
    if (capabilities.allAccess) {
        policy += `
path "pektin-kv/data/*" {
    capabilities = ["read"]
}`;
    } else {
        if (capabilities.configAccess) {
            policy += `
path "pektin-kv/data/pektin-config" {
    capabilities = ["read"]
}`;
        }

        if (capabilities.tntAccess) {
            policy += `
path "pektin-kv/data/tnt-auth" {
    capabilities = ["read"]
}`;
        }
        if (capabilities.proxyAccess) {
            policy += `
path "pektin-kv/data/proxy-auth" {
    capabilities = ["read"]
}`;
        }
    }
    if (capabilities.allowAllSigningDomains) {
        policy += `
path "pektin-signer-passwords-1/data/*" {
    capabilities = ["read"]
}

path "pektin-transit/keys/*" {
    capabilities = ["read"]
}
`;
    } else if (capabilities.allowedSigningDomains) {
        capabilities.allowedSigningDomains.map((domain) => {
            policy += `
path "pektin-signer-passwords-1/data/${deAbsolute(domain)}" {
    capabilities = ["read"]
}`;
            policy += `
path "pektin-transit/keys/${deAbsolute(domain)}-zsk" {
    capabilities = ["read"]
}

path "pektin-transit/keys/${deAbsolute(domain)}-ksk" {
    capabilities = ["read"]
}`;
        });
    }

    return policy as VaultPolicy;
};
export const pektinApiPolicy: VaultPolicy = `
path "pektin-signer-passwords-2/data/*" {
    capabilities = ["read"]
}

path "pektin-policies/data/*" {
    capabilities = ["read"]
}`;
